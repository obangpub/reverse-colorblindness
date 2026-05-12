/**
 * Telemetry collector for the reverse-colorblindness site.
 *
 * Accepts POST beacons sent by the Pages frontend via navigator.sendBeacon.
 * The Worker validates every incoming field against a strict allow-list,
 * derives stable counter keys, and increments those keys in KV. No raw
 * request bodies are stored — only aggregated monthly counts.
 *
 * Design constraints:
 *   - No raw IP, user agent, or request-id logging.
 *   - Whitelist-only parsing: unknown fields and out-of-range values are
 *     silently dropped (204) so a hostile client cannot grow the keyspace.
 *   - One KV operation per counter (cheap; rate-limit at the edge if it
 *     ever becomes a cost concern).
 *   - CORS open to all origins for the POST itself; sendBeacon's
 *     text/plain content-type avoids a preflight, so OPTIONS is a no-op.
 */

export interface Env {
  COUNTERS: KVNamespace;
}

type Axis = "rg" | "by";
type Deficiency = "protanopia" | "deuteranopia" | "tritanopia";
type RatioBucket = "lt_1_5" | "1_5_2_0" | "2_0_2_5" | "2_5_plus";
type Choice = "digit" | "not_sure";

const EVENT_NAMES = new Set([
  "intro_action_start",
  "intro_action_explore",
  "intro_action_about",
  "test_started",
  "test_exited_at_1_5",
  "test_exited_at_6_12",
  "test_exited_at_13_23",
  "test_completed",
  "restart_clicked",
  "modal_opened",
]);

const AXES: ReadonlySet<Axis> = new Set(["rg", "by"]);
const DEFICIENCIES: ReadonlySet<Deficiency> = new Set([
  "protanopia",
  "deuteranopia",
  "tritanopia",
]);
const RATIO_BUCKETS: ReadonlySet<RatioBucket> = new Set([
  "lt_1_5",
  "1_5_2_0",
  "2_0_2_5",
  "2_5_plus",
]);
const CHOICES: ReadonlySet<Choice> = new Set(["digit", "not_sure"]);
const DIGITS = new Set(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);

const MAX_PLATES_PER_SUMMARY = 30;
const SCORE_BUCKETS = ["0_2", "3_5", "6_8", "9_12"] as const;
type ScoreBucket = (typeof SCORE_BUCKETS)[number];

function monthKey(now: Date): string {
  return now.toISOString().slice(0, 7); // YYYY-MM
}

function scoreBucket(n: number): ScoreBucket | null {
  if (!Number.isInteger(n) || n < 0 || n > 12) return null;
  if (n <= 2) return "0_2";
  if (n <= 5) return "3_5";
  if (n <= 8) return "6_8";
  return "9_12";
}

async function increment(env: Env, key: string): Promise<void> {
  const cur = Number((await env.COUNTERS.get(key)) ?? 0);
  await env.COUNTERS.put(key, String(cur + 1));
}

interface EventPayload {
  kind: "event";
  name: string;
}

interface TestSummaryPayload {
  kind: "test_summary";
  rg_correct: number;
  by_correct: number;
  not_sure_count: number;
  plates: Array<{
    axis: string;
    deficiency: string;
    character: string;
    ratio_bucket: string;
    correct: boolean;
    choice: string;
  }>;
}

type Payload = EventPayload | TestSummaryPayload;

function parsePayload(raw: unknown): Payload | null {
  if (typeof raw !== "object" || raw === null) return null;
  const body = raw as Record<string, unknown>;
  if (body.kind === "event") {
    if (typeof body.name !== "string") return null;
    return { kind: "event", name: body.name };
  }
  if (body.kind === "test_summary") {
    if (
      typeof body.rg_correct !== "number" ||
      typeof body.by_correct !== "number" ||
      typeof body.not_sure_count !== "number" ||
      !Array.isArray(body.plates)
    ) {
      return null;
    }
    const plates: TestSummaryPayload["plates"] = [];
    for (const p of body.plates) {
      if (typeof p !== "object" || p === null) continue;
      const r = p as Record<string, unknown>;
      plates.push({
        axis: String(r.axis ?? ""),
        deficiency: String(r.deficiency ?? ""),
        character: String(r.character ?? ""),
        ratio_bucket: String(r.ratio_bucket ?? ""),
        correct: Boolean(r.correct),
        choice: String(r.choice ?? ""),
      });
    }
    return {
      kind: "test_summary",
      rg_correct: body.rg_correct,
      by_correct: body.by_correct,
      not_sure_count: body.not_sure_count,
      plates,
    };
  }
  return null;
}

async function handleEvent(
  env: Env,
  month: string,
  payload: EventPayload,
): Promise<void> {
  if (!EVENT_NAMES.has(payload.name)) return;
  await increment(env, `event:${payload.name}:${month}`);
}

async function handleSummary(
  env: Env,
  month: string,
  payload: TestSummaryPayload,
): Promise<void> {
  const rg = scoreBucket(payload.rg_correct);
  const by = scoreBucket(payload.by_correct);
  if (!rg || !by) return;
  await increment(env, `summary:score:${rg}:${by}:${month}`);

  const notSure = scoreBucket(payload.not_sure_count);
  if (notSure) {
    await increment(env, `summary:not_sure:${notSure}:${month}`);
  }

  const plates = payload.plates.slice(0, MAX_PLATES_PER_SUMMARY);
  for (const p of plates) {
    if (!AXES.has(p.axis as Axis)) continue;
    if (!DEFICIENCIES.has(p.deficiency as Deficiency)) continue;
    if (!DIGITS.has(p.character)) continue;
    if (!RATIO_BUCKETS.has(p.ratio_bucket as RatioBucket)) continue;
    if (!CHOICES.has(p.choice as Choice)) continue;
    const correct = p.correct ? "y" : "n";
    const key = [
      "plate",
      p.axis,
      p.deficiency,
      p.character,
      p.ratio_bucket,
      correct,
      p.choice,
      month,
    ].join(":");
    await increment(env, key);
  }
}

const CORS_HEADERS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (req.method !== "POST") {
      return new Response(null, { status: 405, headers: CORS_HEADERS });
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const payload = parsePayload(raw);
    if (!payload) {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const month = monthKey(new Date());
    if (payload.kind === "event") {
      await handleEvent(env, month, payload);
    } else {
      await handleSummary(env, month, payload);
    }

    return new Response(null, { status: 204, headers: CORS_HEADERS });
  },
};
