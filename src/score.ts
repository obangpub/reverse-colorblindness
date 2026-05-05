/**
 * Visibility scoring for reverse Ishihara plates.
 *
 * Measures average CIE Lab color distance between figure dots and their
 * neighboring background dots. A plate works well when the dichromat
 * score is high (figure pops out) and the trichromat score is low
 * (figure blends into the background noise).
 */

import type { RGB, DeficiencyType } from "./cvd";
import { simulateCVD } from "./cvd";
import type { ColoredDot } from "./color";

// ---------------------------------------------------------------------------
// sRGB -> CIE Lab conversion
// ---------------------------------------------------------------------------

/** CIE Lab color. */
export interface Lab {
  L: number;
  a: number;
  b: number;
}

/** D65 reference white in XYZ. */
const D65_X = 0.95047;
const D65_Y = 1.0;
const D65_Z = 1.08883;

/** Convert a single sRGB channel (0-1) to linear light. */
function srgbToLinear(c: number): number {
  if (c <= 0) return 0;
  if (c >= 1) return 1;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Convert sRGB (0-1) to CIE XYZ using the sRGB-to-XYZ matrix (D65). */
function rgbToXYZ(rgb: RGB): { X: number; Y: number; Z: number } {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return {
    X: 0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
    Y: 0.2126729 * r + 0.7151522 * g + 0.0721750 * b,
    Z: 0.0193339 * r + 0.1191920 * g + 0.9503041 * b,
  };
}

/** CIE Lab transfer function. */
function labF(t: number): number {
  const delta = 6 / 29;
  return t > delta ** 3
    ? Math.cbrt(t)
    : t / (3 * delta * delta) + 4 / 29;
}

/** Convert sRGB (0-1) to CIE Lab (D65 illuminant). */
export function rgbToLab(rgb: RGB): Lab {
  const { X, Y, Z } = rgbToXYZ(rgb);
  const fx = labF(X / D65_X);
  const fy = labF(Y / D65_Y);
  const fz = labF(Z / D65_Z);
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/** CIE76 color difference (Euclidean distance in Lab space). */
function deltaE(a: Lab, b: Lab): number {
  return Math.sqrt(
    (a.L - b.L) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2,
  );
}

// ---------------------------------------------------------------------------
// Visibility scoring
// ---------------------------------------------------------------------------

export interface VisibilityScore {
  /** Average deltaE between figure dots and their background neighbors (trichromat view). */
  trichromat: number;
  /** Average deltaE between figure dots and their background neighbors (simulated dichromat view). */
  dichromat: number;
  /** Ratio of dichromat to trichromat scores. Higher is better. */
  ratio: number;
}

/**
 * Score how visible the hidden figure is in both trichromat and simulated
 * dichromat views.
 *
 * For each figure dot, finds the K nearest background dots and computes
 * the average CIE76 deltaE between the figure dot and those neighbors.
 * The overall score is the mean across all figure dots.
 *
 * @param dots - The colored dots from the plate.
 * @param deficiency - The target deficiency for simulation.
 * @param k - Number of nearest background neighbors per figure dot (default 6).
 */
export function scorePlate(
  dots: ColoredDot[],
  deficiency: DeficiencyType,
  k: number = 6,
): VisibilityScore {
  const figureDots = dots.filter((d) => d.isFigure);
  const bgDots = dots.filter((d) => !d.isFigure);

  if (figureDots.length === 0 || bgDots.length === 0) {
    return { trichromat: 0, dichromat: 0, ratio: 0 };
  }

  // Precompute Lab colors for background dots (both views).
  const bgLabTri = bgDots.map((d) => rgbToLab(d.color));
  const bgLabSim = bgDots.map((d) => rgbToLab(simulateCVD(d.color, deficiency)));

  let sumTri = 0;
  let sumSim = 0;

  for (const fd of figureDots) {
    const fdLabTri = rgbToLab(fd.color);
    const fdLabSim = rgbToLab(simulateCVD(fd.color, deficiency));

    // Compute spatial distances to all background dots, then pick K nearest.
    const dists = bgDots.map((bd, i) => ({
      idx: i,
      dist2: (fd.x - bd.x) ** 2 + (fd.y - bd.y) ** 2,
    }));

    // Partial sort: find K smallest by distance. For typical plate sizes
    // (~1000-2000 dots) a full sort is fast enough.
    dists.sort((a, b) => a.dist2 - b.dist2);
    const neighbors = dists.slice(0, Math.min(k, dists.length));

    let dotSumTri = 0;
    let dotSumSim = 0;
    for (const n of neighbors) {
      dotSumTri += deltaE(fdLabTri, bgLabTri[n.idx]!);
      dotSumSim += deltaE(fdLabSim, bgLabSim[n.idx]!);
    }
    sumTri += dotSumTri / neighbors.length;
    sumSim += dotSumSim / neighbors.length;
  }

  const trichromat = sumTri / figureDots.length;
  const dichromat = sumSim / figureDots.length;
  const ratio = trichromat > 0 ? dichromat / trichromat : 0;

  return { trichromat, dichromat, ratio };
}
