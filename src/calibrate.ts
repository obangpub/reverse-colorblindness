/**
 * Calibration: generate a candidate test battery and report how each
 * "viewer" (trichromat + three dichromat types) scores on each axis
 * of plates. Uses signal-to-noise ratio (figure-vs-background deltaE
 * divided by background-vs-background deltaE) as the readability
 * metric, since the reverse-Ishihara plate hides the figure inside
 * chromatic noise of comparable magnitude — only the SNR collapse for
 * the target dichromat reveals the figure.
 */

import type { DeficiencyType } from "./cvd";
import { packDots } from "./dots";
import { createFigureMask, randomDigit } from "./mask";
import { colorDots } from "./color";
import { readabilityScore } from "./score";
import type { Viewer } from "./score";

const AXES: readonly DeficiencyType[] = [
  "protanopia",
  "deuteranopia",
  "tritanopia",
];

const VIEWERS: readonly Viewer[] = [
  "trichromat",
  "protanopia",
  "deuteranopia",
  "tritanopia",
];

/** Signal amplitudes spanning hard-for-trichromats to easy-for-trichromats. */
const SIGNAL_AMPLITUDES: readonly number[] = [0.04, 0.06, 0.08, 0.10, 0.12, 0.14];

/**
 * SNR threshold above which we treat the figure as "readable." SNR ≈ 1
 * means figure deltaE is comparable to background variance (camouflaged).
 * SNR ≥ 2 means the figure stands out as roughly twice the background
 * variation — a reasonable proxy for "the digit is recognizable."
 */
const READABLE_SNR = 2.0;

const PLATE_SIZE = 400;

interface ViewerScores {
  signal: Record<Viewer, number>;
  noise: Record<Viewer, number>;
  snr: Record<Viewer, number>;
}

export interface PlateRecord {
  axis: DeficiencyType;
  signalAmplitude: number;
  scores: ViewerScores;
}

export interface CalibrationResult {
  plates: PlateRecord[];
  /** grid[viewer][axis] = fraction of plates on that axis the viewer can read. */
  grid: Record<Viewer, Record<DeficiencyType, number>>;
  threshold: number;
}

function generateCalibrationPlate(
  axis: DeficiencyType,
  signalAmplitude: number,
) {
  const radius = PLATE_SIZE / 2;
  const dots = packDots({
    cx: radius,
    cy: radius,
    plateRadius: radius * 0.92,
    minRadius: PLATE_SIZE * 0.008,
    maxRadius: PLATE_SIZE * 0.024,
    padding: PLATE_SIZE * 0.003,
    maxAttempts: 30_000,
  });
  const mask = createFigureMask(randomDigit(), {
    width: PLATE_SIZE,
    height: PLATE_SIZE,
  });
  return colorDots(dots, mask, { deficiency: axis, signalAmplitude });
}

function emptyViewerMap<T>(init: T): Record<Viewer, T> {
  return {
    trichromat: init,
    protanopia: init,
    deuteranopia: init,
    tritanopia: init,
  };
}

export function runCalibration(): CalibrationResult {
  const plates: PlateRecord[] = [];

  for (const axis of AXES) {
    for (const sa of SIGNAL_AMPLITUDES) {
      const colored = generateCalibrationPlate(axis, sa);

      const signal = emptyViewerMap(0);
      const noise = emptyViewerMap(0);
      const snr = emptyViewerMap(0);
      for (const v of VIEWERS) {
        const r = readabilityScore(colored, v);
        signal[v] = r.signal;
        noise[v] = r.noise;
        snr[v] = r.snr;
      }

      plates.push({
        axis,
        signalAmplitude: sa,
        scores: { signal, noise, snr },
      });
    }
  }

  const grid = {} as Record<Viewer, Record<DeficiencyType, number>>;
  for (const v of VIEWERS) {
    grid[v] = {} as Record<DeficiencyType, number>;
    for (const axis of AXES) {
      const onAxis = plates.filter((p) => p.axis === axis);
      const readable = onAxis.filter(
        (p) => p.scores.snr[v] >= READABLE_SNR,
      ).length;
      grid[v][axis] = readable / onAxis.length;
    }
  }

  return { plates, grid, threshold: READABLE_SNR };
}

function fmtFrac(x: number): string {
  return x.toFixed(2);
}

function fmtNum(x: number, w: number = 5): string {
  return x.toFixed(1).padStart(w, " ");
}

/** Render the calibration result as a fixed-width text report. */
export function formatCalibrationReport(result: CalibrationResult): string {
  const lines: string[] = [];

  lines.push(
    `Readable fraction per (viewer × plate-axis), SNR threshold = ${result.threshold}`,
  );
  lines.push(
    "                  protan plates   deutan plates   tritan plates",
  );
  for (const v of VIEWERS) {
    const row = AXES.map((a) => fmtFrac(result.grid[v][a])).join(
      "          ",
    );
    lines.push(`  ${v.padEnd(15)}    ${row}`);
  }

  lines.push("");
  lines.push("Per-plate SNR (rows = plates, cols = viewer)");
  lines.push(
    "  axis         signalAmp     trich   protan   deutan   tritan",
  );
  for (const p of result.plates) {
    const sa = p.signalAmplitude.toFixed(2);
    const t = fmtNum(p.scores.snr.trichromat);
    const pr = fmtNum(p.scores.snr.protanopia);
    const de = fmtNum(p.scores.snr.deuteranopia);
    const tr = fmtNum(p.scores.snr.tritanopia);
    lines.push(
      `  ${p.axis.padEnd(13)}  ${sa}      ${t}    ${pr}    ${de}    ${tr}`,
    );
  }

  lines.push("");
  lines.push("Per-plate signal / noise (target axis only)");
  lines.push(
    "  axis         signalAmp     signal(trich)  noise(trich)  signal(target)  noise(target)",
  );
  for (const p of result.plates) {
    const sa = p.signalAmplitude.toFixed(2);
    const sigT = fmtNum(p.scores.signal.trichromat, 5);
    const noiT = fmtNum(p.scores.noise.trichromat, 5);
    const sigD = fmtNum(p.scores.signal[p.axis], 5);
    const noiD = fmtNum(p.scores.noise[p.axis], 5);
    lines.push(
      `  ${p.axis.padEnd(13)}  ${sa}        ${sigT}         ${noiT}          ${sigD}           ${noiD}`,
    );
  }

  return lines.join("\n");
}
