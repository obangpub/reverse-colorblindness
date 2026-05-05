/**
 * Confusion-line color sampling for reverse Ishihara plates.
 *
 * Background dots get colors spread along the dichromat's confusion line
 * (the axis that collapses under simulation). This looks chromatically
 * busy to trichromats but uniform to dichromats. Figure dots share the
 * same confusion-line noise but carry an additional offset along an
 * orthogonal axis that dichromats can still perceive, making the figure
 * pop out only under simulated (or real) color vision deficiency.
 */

import type { RGB, DeficiencyType } from "./cvd";
import { DEFICIENCY_MATRICES, srgbToLinear, linearToSrgb } from "./cvd";
import type { Dot } from "./dots";
import type { FigureMask } from "./mask";

/** 3-component vector for linear-RGB math. */
type Vec3 = [number, number, number];

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function vecLength(v: Vec3): number {
  return Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
}

function normalize(v: Vec3): Vec3 {
  const len = vecLength(v);
  if (len === 0) return [0, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

function vecDot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Compute the confusion-line direction for a deficiency simulation matrix.
 *
 * For a severity-1.0 (dichromat) simulation matrix M, rank(M) = 2, so
 * its null space is one-dimensional. Colors differing only along this
 * direction appear identical after simulation. The null vector is the
 * cross product of any two linearly independent rows of M.
 */
function confusionDirection(matrix: readonly number[]): Vec3 {
  const row0: Vec3 = [matrix[0]!, matrix[1]!, matrix[2]!];
  const row1: Vec3 = [matrix[3]!, matrix[4]!, matrix[5]!];
  return normalize(cross(row0, row1));
}

/**
 * Compute a signal direction orthogonal to the confusion line that
 * produces a difference dichromats can perceive.
 *
 * Projects the luminance axis onto the plane orthogonal to the confusion
 * direction. The resulting vector represents a luminance-ish shift that
 * survives simulation and serves as the figure-background signal.
 */
function signalDirection(confDir: Vec3): Vec3 {
  // sRGB luminance coefficients (linear space)
  const lum: Vec3 = [0.2126, 0.7152, 0.0722];
  // Remove the component along the confusion direction
  const proj = vecDot(lum, confDir);
  const ortho: Vec3 = [
    lum[0] - proj * confDir[0],
    lum[1] - proj * confDir[1],
    lum[2] - proj * confDir[2],
  ];
  return normalize(ortho);
}

// Precompute per-deficiency directions in linear RGB space.
const CONFUSION_DIRS: Record<DeficiencyType, Vec3> = {
  protanopia: confusionDirection(DEFICIENCY_MATRICES.protanopia),
  deuteranopia: confusionDirection(DEFICIENCY_MATRICES.deuteranopia),
  tritanopia: confusionDirection(DEFICIENCY_MATRICES.tritanopia),
};

const SIGNAL_DIRS: Record<DeficiencyType, Vec3> = {
  protanopia: signalDirection(CONFUSION_DIRS.protanopia),
  deuteranopia: signalDirection(CONFUSION_DIRS.deuteranopia),
  tritanopia: signalDirection(CONFUSION_DIRS.tritanopia),
};

export interface ColoredDot extends Dot {
  color: RGB;
  isFigure: boolean;
}

export interface PlateColorOptions {
  /** Target color vision deficiency. */
  deficiency: DeficiencyType;
  /** Base color in sRGB (0-1). Defaults to a warm mid-tone. */
  baseColor?: RGB;
  /**
   * Amplitude of confusion-line noise in linear-RGB units.
   * Higher values make the plate busier for trichromats (and therefore
   * harder to read), but risk gamut clipping at the extremes.
   */
  confusionAmplitude?: number;
  /**
   * Amplitude of the figure signal along the orthogonal axis.
   * This is the luminance/chroma shift that dichromats use to read the
   * figure. Larger values make the figure easier for dichromats but
   * also more detectable by trichromats.
   */
  signalAmplitude?: number;
}

const DEFAULTS = {
  baseColor: { r: 0.55, g: 0.45, b: 0.40 } as RGB,
  confusionAmplitude: 0.15,
  signalAmplitude: 0.08,
};

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/**
 * Assign colors to a dot field based on figure-mask membership.
 *
 * Background dots receive random noise along the confusion line.
 * Figure dots receive the same noise plus an orthogonal luminance shift.
 * Both groups get a small amount of cross-axis jitter to prevent clean
 * boundaries that trichromats could detect.
 */
export function colorDots(
  dots: Dot[],
  mask: FigureMask,
  opts: PlateColorOptions,
): ColoredDot[] {
  const confDir = CONFUSION_DIRS[opts.deficiency];
  const sigDir = SIGNAL_DIRS[opts.deficiency];
  const amplitude =
    opts.confusionAmplitude ?? DEFAULTS.confusionAmplitude;
  const signal = opts.signalAmplitude ?? DEFAULTS.signalAmplitude;

  const base = opts.baseColor ?? DEFAULTS.baseColor;
  const baseLinear: Vec3 = [
    srgbToLinear(base.r),
    srgbToLinear(base.g),
    srgbToLinear(base.b),
  ];

  return dots.map((d) => {
    const isFigure = mask.contains(d.x, d.y);

    // Confusion-line noise: uniform, centered at zero.
    const confNoise = (Math.random() * 2 - 1) * amplitude;

    let lr = baseLinear[0] + confNoise * confDir[0];
    let lg = baseLinear[1] + confNoise * confDir[1];
    let lb = baseLinear[2] + confNoise * confDir[2];

    if (isFigure) {
      // Orthogonal signal with per-dot variation (70-130% of nominal)
      // to avoid a perfectly uniform shift that trichromats might detect.
      const sigAmount = signal * (0.7 + Math.random() * 0.6);
      lr += sigAmount * sigDir[0];
      lg += sigAmount * sigDir[1];
      lb += sigAmount * sigDir[2];
    } else {
      // Small orthogonal jitter on background dots to soften the
      // luminance boundary between figure and background regions.
      const bgJitter = (Math.random() * 2 - 1) * signal * 0.3;
      lr += bgJitter * sigDir[0];
      lg += bgJitter * sigDir[1];
      lb += bgJitter * sigDir[2];
    }

    const color: RGB = {
      r: linearToSrgb(clamp01(lr)),
      g: linearToSrgb(clamp01(lg)),
      b: linearToSrgb(clamp01(lb)),
    };

    return { ...d, color, isFigure };
  });
}
