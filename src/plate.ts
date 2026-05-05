/**
 * Plate renderer: orchestrates dot packing, figure masking, color
 * assignment, and canvas drawing to produce a reverse Ishihara plate.
 */

import type { RGB, DeficiencyType } from "./cvd";
import { simulateCVD } from "./cvd";
import { packDots } from "./dots";
import { createFigureMask, randomDigit } from "./mask";
import { colorDots } from "./color";
import type { ColoredDot } from "./color";

export interface PlateResult {
  /** The hidden figure character. */
  character: string;
  /** Target deficiency type. */
  deficiency: DeficiencyType;
  /** The colored dots that make up the plate. */
  dots: ColoredDot[];
  /** Plate diameter in pixels. */
  size: number;
}

export interface PlateOptions {
  /** Plate diameter in pixels. */
  size?: number;
  /** Target deficiency. */
  deficiency?: DeficiencyType;
  /** Character to hide. If omitted, a random digit is chosen. */
  character?: string;
}

const DEFICIENCIES: DeficiencyType[] = [
  "protanopia",
  "deuteranopia",
  "tritanopia",
];

/**
 * Generate a complete reverse Ishihara plate: pack dots, create the
 * figure mask, assign colors, and return the result ready for drawing.
 */
export function generatePlate(opts: PlateOptions = {}): PlateResult {
  const size = opts.size ?? 500;
  const deficiency =
    opts.deficiency ?? DEFICIENCIES[Math.floor(Math.random() * DEFICIENCIES.length)]!;
  const character = opts.character ?? randomDigit();

  const radius = size / 2;
  const cx = radius;
  const cy = radius;

  const dots = packDots({
    cx,
    cy,
    plateRadius: radius * 0.92, // small inset so dots don't touch the edge
    minRadius: size * 0.008,
    maxRadius: size * 0.024,
    padding: size * 0.003,
    maxAttempts: 30_000,
  });

  const mask = createFigureMask(character, {
    width: size,
    height: size,
  });

  const colored = colorDots(dots, mask, { deficiency });

  return {
    character,
    deficiency,
    dots: colored,
    size,
  };
}

function rgbToCSS(c: RGB): string {
  return `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
}

/**
 * Draw a plate's dots onto a canvas context.
 * Optionally simulate the target deficiency on each dot color.
 */
export function drawPlate(
  ctx: CanvasRenderingContext2D,
  plate: PlateResult,
  simulate: boolean = false,
): void {
  const { size, dots, deficiency } = plate;

  // Clear and fill with a neutral dark background.
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#222";
  ctx.fillRect(0, 0, size, size);

  // Draw circular plate boundary.
  const cx = size / 2;
  const cy = size / 2;
  const plateRadius = size / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, plateRadius, 0, Math.PI * 2);
  ctx.clip();

  // Plate background (slightly lighter than outer background).
  ctx.fillStyle = "#333";
  ctx.fillRect(0, 0, size, size);

  // Draw each dot.
  for (const dot of dots) {
    const color = simulate ? simulateCVD(dot.color, deficiency) : dot.color;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
    ctx.fillStyle = rgbToCSS(color);
    ctx.fill();
  }

  ctx.restore();
}
