/**
 * Test session: pure data layer for the user-facing test flow.
 *
 * A session holds a pre-generated, shuffled battery of plates and a
 * growing list of user responses. Scoring is reported per axis with
 * Wilson 95% confidence intervals on the underlying read-probability,
 * which is the strongest honest claim we can make from N Bernoulli
 * trials.
 *
 * Pure data — no DOM access, no rendering. Views consume this module
 * but do not mutate session state directly outside the provided helpers.
 */

import type { DeficiencyType } from "./cvd";
import { generateAcceptedPlate } from "./plate";
import type { AcceptedPlateResult } from "./plate";

export type Axis = "rg" | "by";

export interface PlateItem {
  /** Position in the shuffled battery (0-based). */
  index: number;
  axis: Axis;
  plate: AcceptedPlateResult;
}

export type Choice =
  | { type: "digit"; value: string }
  | { type: "not-sure" };

export interface Response {
  item: PlateItem;
  choice: Choice;
  /** True iff choice was a digit matching the plate's hidden character. */
  correct: boolean;
}

export interface AxisScore {
  correct: number;
  total: number;
  /** Point estimate correct / total. */
  proportion: number;
  /** Wilson 95% confidence interval [low, high] on read-probability. */
  ci: { low: number; high: number };
}

interface BatterySpec {
  axis: Axis;
  deficiency: DeficiencyType;
}

export interface TestSession {
  /** Plates generated so far. Grows during background generation. */
  battery: PlateItem[];
  /** Plates still to be generated, in order. Drained by generateOneMore. */
  pending: BatterySpec[];
  responses: Response[];
  /** Total plates in the battery (battery.length + pending.length, frozen at start). */
  totalCount: number;
}

const PLATE_SIZE = 400;
const RG_PROTAN_COUNT = 6;
const RG_DEUTAN_COUNT = 6;
const BY_COUNT = 12;

export const TOTAL_PLATES =
  RG_PROTAN_COUNT + RG_DEUTAN_COUNT + BY_COUNT;

function fisherYatesShuffle<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function buildSpecs(): BatterySpec[] {
  const specs: BatterySpec[] = [];
  for (let i = 0; i < RG_PROTAN_COUNT; i++) {
    specs.push({ axis: "rg", deficiency: "protanopia" });
  }
  for (let i = 0; i < RG_DEUTAN_COUNT; i++) {
    specs.push({ axis: "rg", deficiency: "deuteranopia" });
  }
  for (let i = 0; i < BY_COUNT; i++) {
    specs.push({ axis: "by", deficiency: "tritanopia" });
  }
  return fisherYatesShuffle(specs);
}

function specToItem(spec: BatterySpec, index: number): PlateItem {
  return {
    index,
    axis: spec.axis,
    plate: generateAcceptedPlate({
      size: PLATE_SIZE,
      deficiency: spec.deficiency,
    }),
  };
}

/**
 * Start a new session. The first plate is generated synchronously
 * (~100ms) so the runner can mount immediately; the remaining plates
 * sit in `pending` and are produced one at a time by background
 * `generateOneMore` calls. By the time the user has spent a few seconds
 * on plate 1, generation is typically far ahead of their pace.
 */
export function newSession(): TestSession {
  const specs = buildSpecs();
  const firstSpec = specs.shift()!;
  return {
    battery: [specToItem(firstSpec, 0)],
    pending: specs,
    responses: [],
    totalCount: TOTAL_PLATES,
  };
}

/**
 * Generate the next pending plate and append it to the battery. Returns
 * true if a plate was generated, false if `pending` is empty. Designed
 * to be called from a setTimeout(0) loop so the event loop stays
 * responsive between plates.
 */
export function generateOneMore(session: TestSession): boolean {
  if (session.pending.length === 0) return false;
  const spec = session.pending.shift()!;
  session.battery.push(specToItem(spec, session.battery.length));
  return true;
}

export function isFullyGenerated(session: TestSession): boolean {
  return session.pending.length === 0;
}

export function nextItem(session: TestSession): PlateItem | null {
  return session.battery[session.responses.length] ?? null;
}

export function progress(session: TestSession): {
  current: number;
  total: number;
} {
  return {
    current: Math.min(session.responses.length + 1, session.totalCount),
    total: session.totalCount,
  };
}

export function isComplete(session: TestSession): boolean {
  return (
    isFullyGenerated(session) &&
    session.responses.length >= session.battery.length
  );
}

export function gradeResponse(item: PlateItem, choice: Choice): Response {
  const correct =
    choice.type === "digit" && choice.value === item.plate.character;
  return { item, choice, correct };
}

export function recordResponse(
  session: TestSession,
  item: PlateItem,
  choice: Choice,
): void {
  session.responses.push(gradeResponse(item, choice));
}

/**
 * Wilson 95% confidence interval for a binomial proportion. Returns
 * [0, 1] for empty input (undefined proportion).
 */
export function wilsonCI(
  correct: number,
  total: number,
): { low: number; high: number } {
  if (total === 0) return { low: 0, high: 1 };
  const z = 1.96;
  const p = correct / total;
  const denom = 1 + (z * z) / total;
  const center = (p + (z * z) / (2 * total)) / denom;
  const halfWidth =
    (z / denom) *
    Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));
  return {
    low: Math.max(0, center - halfWidth),
    high: Math.min(1, center + halfWidth),
  };
}

export function scoreAxis(
  responses: readonly Response[],
  axis: Axis,
): AxisScore {
  const onAxis = responses.filter((r) => r.item.axis === axis);
  const correct = onAxis.filter((r) => r.correct).length;
  const total = onAxis.length;
  return {
    correct,
    total,
    proportion: total > 0 ? correct / total : 0,
    ci: wilsonCI(correct, total),
  };
}

/**
 * Generate a session with pre-filled responses for previewing the
 * results view in dev mode. Simulates a user with mild red-green
 * deficiency: high RG read rate, low BY read rate.
 *
 * Fully materializes the battery up front (no lazy generation) since
 * the placeholder skips the test flow entirely.
 */
export function generatePlaceholderSession(): TestSession {
  const session = newSession();
  while (generateOneMore(session)) {
    // drain pending
  }
  const rgPattern = [true, false, true, true, false, true];
  const byPattern = [false, false, true, false, false, false];
  let rgIdx = 0;
  let byIdx = 0;
  for (const item of session.battery) {
    const correct =
      item.axis === "rg"
        ? rgPattern[rgIdx++ % rgPattern.length]!
        : byPattern[byIdx++ % byPattern.length]!;
    const choice: Choice = correct
      ? { type: "digit", value: item.plate.character }
      : { type: "not-sure" };
    session.responses.push({ item, choice, correct });
  }
  return session;
}
