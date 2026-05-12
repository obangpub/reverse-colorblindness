/**
 * Color vision deficiency simulation in linear-sRGB space.
 *
 * Protanopia and deuteranopia: Machado, Oliveira, Fernandes (2009),
 * severity 1.0. Copied from the sibling Cubehelix Studio project
 * (../lumenfast); the two projects are intentionally decoupled.
 *
 * Tritanopia: Viénot, Brettel, Mollon (1999). The Machado tritanopia
 * matrix at severity 1.0 is empirically rank 3 (det ≈ 0.24), so the
 * cross-product confusion direction does not lie in its null space and
 * confusion noise on tritan plates fails to fully collapse under
 * simulation. Viénot/Brettel is rank 2 by construction (rows 1 and 2
 * are identical), giving a clean null space.
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export type DeficiencyType = "protanopia" | "deuteranopia" | "tritanopia";

// Machado et al. (2009) severity-1.0 simulation matrices (row-major 3x3).
const PROTANOPIA_MATRIX: readonly number[] = [
  0.152286, 1.052583, -0.204868,
  0.114503, 0.786281, 0.099216,
  -0.003882, -0.048116, 1.051998,
];

const DEUTERANOPIA_MATRIX: readonly number[] = [
  0.367322, 0.860646, -0.227968,
  0.280085, 0.672501, 0.047413,
  -0.01182, 0.04294, 0.968881,
];

const TRITANOPIA_MATRIX: readonly number[] = [
  1.0, 0.0, 0.0,
  0.0, 0.7438, 0.2562,
  0.0, 0.7438, 0.2562,
];

export const DEFICIENCY_MATRICES: Record<DeficiencyType, readonly number[]> = {
  protanopia: PROTANOPIA_MATRIX,
  deuteranopia: DEUTERANOPIA_MATRIX,
  tritanopia: TRITANOPIA_MATRIX,
};

/** Convert a single sRGB channel (0-1) to linear light. */
export function srgbToLinear(c: number): number {
  if (c <= 0) return 0;
  if (c >= 1) return 1;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Convert a single linear-light channel to sRGB (0-1). */
export function linearToSrgb(c: number): number {
  if (c <= 0) return 0;
  if (c >= 1) return 1;
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** Apply a 3x3 row-major matrix in linear-sRGB space. */
function applyMatrixLinear(rgb: RGB, m: readonly number[]): RGB {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return {
    r: linearToSrgb(m[0]! * r + m[1]! * g + m[2]! * b),
    g: linearToSrgb(m[3]! * r + m[4]! * g + m[5]! * b),
    b: linearToSrgb(m[6]! * r + m[7]! * g + m[8]! * b),
  };
}

/** Simulate how an RGB color (channels 0-1) appears under a given deficiency. */
export function simulateCVD(rgb: RGB, deficiency: DeficiencyType): RGB {
  return applyMatrixLinear(rgb, DEFICIENCY_MATRICES[deficiency]);
}
