/**
 * Telemetry emission for the reverse-colorblindness site.
 *
 * Sends fire-and-forget beacons to a Cloudflare Worker that aggregates
 * anonymous counters in KV. Designed so:
 *
 *   - The endpoint URL is read from VITE_TELEMETRY_URL at build time;
 *     when unset (dev, forks, CI) every emit is a no-op.
 *   - Beacons are silently dropped if the user has Do Not Track or
 *     Global Privacy Control enabled.
 *   - sendBeacon uses text/plain so the request never triggers a CORS
 *     preflight, even though the body is JSON.
 *   - No persistent identifiers, timestamps, IPs, or user agents are
 *     attached; each beacon carries only the dimensions the Worker's
 *     whitelist accepts.
 *
 * Callers should treat this module as best-effort. Failures are silent
 * by design.
 */

import type { Response, TestSession } from "./test-session";

export type EventName =
  | "intro_action_start"
  | "intro_action_explore"
  | "intro_action_about"
  | "test_started"
  | "test_exited_at_1_5"
  | "test_exited_at_6_12"
  | "test_exited_at_13_23"
  | "test_completed"
  | "restart_clicked"
  | "modal_opened";

type RatioBucket = "lt_1_5" | "1_5_2_0" | "2_0_2_5" | "2_5_plus";

interface EventPayload {
  kind: "event";
  name: EventName;
}

interface PlateSummary {
  axis: "rg" | "by";
  deficiency: "protanopia" | "deuteranopia" | "tritanopia";
  character: string;
  ratio_bucket: RatioBucket;
  correct: boolean;
  choice: "digit" | "not_sure";
}

interface TestSummaryPayload {
  kind: "test_summary";
  rg_correct: number;
  by_correct: number;
  not_sure_count: number;
  plates: PlateSummary[];
}

type Payload = EventPayload | TestSummaryPayload;

const ENDPOINT = import.meta.env.VITE_TELEMETRY_URL as string | undefined;

function isDisabledByUser(): boolean {
  if (typeof navigator === "undefined") return true;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (nav.doNotTrack === "1") return true;
  if (nav.globalPrivacyControl === true) return true;
  return false;
}

function send(payload: Payload): void {
  if (!ENDPOINT) return;
  if (isDisabledByUser()) return;
  try {
    const body = new Blob([JSON.stringify(payload)], { type: "text/plain" });
    navigator.sendBeacon(ENDPOINT, body);
  } catch {
    // sendBeacon throws if the queue is full or the URL is invalid.
    // Telemetry is best-effort; drop the event.
  }
}

export function recordEvent(name: EventName): void {
  send({ kind: "event", name });
}

function ratioBucket(ratio: number): RatioBucket {
  if (ratio < 1.5) return "lt_1_5";
  if (ratio < 2.0) return "1_5_2_0";
  if (ratio < 2.5) return "2_0_2_5";
  return "2_5_plus";
}

export function exitBucketEvent(currentPlate: number): EventName | null {
  if (currentPlate < 1) return null;
  if (currentPlate <= 5) return "test_exited_at_1_5";
  if (currentPlate <= 12) return "test_exited_at_6_12";
  return "test_exited_at_13_23";
}

export function recordTestSummary(session: TestSession): void {
  let rgCorrect = 0;
  let byCorrect = 0;
  let notSureCount = 0;
  const plates: PlateSummary[] = [];

  for (const r of session.responses) {
    if (r.choice.type === "not-sure") notSureCount++;
    if (r.correct) {
      if (r.item.axis === "rg") rgCorrect++;
      else byCorrect++;
    }
    plates.push(plateSummary(r));
  }

  send({
    kind: "test_summary",
    rg_correct: rgCorrect,
    by_correct: byCorrect,
    not_sure_count: notSureCount,
    plates,
  });
}

function plateSummary(r: Response): PlateSummary {
  return {
    axis: r.item.axis,
    deficiency: r.item.plate.deficiency,
    character: r.item.plate.character,
    ratio_bucket: ratioBucket(r.item.plate.ratio),
    correct: r.correct,
    choice: r.choice.type === "digit" ? "digit" : "not_sure",
  };
}
