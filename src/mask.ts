/**
 * Figure mask: render a digit (or character) onto an offscreen canvas
 * and expose a pixel-level lookup to classify dot centers as figure
 * or background.
 */

export interface MaskOptions {
  /** Width of the mask bitmap in pixels. */
  width: number;
  /** Height of the mask bitmap in pixels. */
  height: number;
  /** Font size in pixels. Auto-sized to fill most of the canvas if omitted. */
  fontSize?: number;
  /** CSS font family. */
  fontFamily?: string;
}

const DEFAULT_OPTIONS: MaskOptions = {
  width: 500,
  height: 500,
  fontFamily: "Arial, Helvetica, sans-serif",
};

export interface FigureMask {
  /** The character rendered into the mask. */
  character: string;
  /** Mask bitmap width. */
  width: number;
  /** Mask bitmap height. */
  height: number;
  /**
   * Returns true if the pixel at (x, y) falls inside the rendered figure.
   * Coordinates are in the same space as the mask dimensions.
   * Out-of-bounds coordinates return false.
   */
  contains(x: number, y: number): boolean;
}

/**
 * Render a single character onto an offscreen canvas and return a
 * FigureMask that supports point-in-figure queries.
 */
export function createFigureMask(
  character: string,
  opts: Partial<MaskOptions> = {},
): FigureMask {
  const o = { ...DEFAULT_OPTIONS, ...opts };
  const { width, height, fontFamily } = o;

  // Auto-size font to roughly 70% of canvas height for good coverage.
  const fontSize = o.fontSize ?? Math.round(height * 0.7);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d")!;

  // Clear to transparent / black.
  ctx.clearRect(0, 0, width, height);

  // Draw the character centered, white on transparent.
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(character, width / 2, height / 2);

  // Read pixel data once and store the alpha channel as a flat boolean array.
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data; // Uint8ClampedArray, RGBA interleaved

  // Threshold: any pixel with alpha > 127 counts as "inside the figure."
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    mask[i] = pixels[i * 4 + 3] > 127 ? 1 : 0;
  }

  return {
    character,
    width,
    height,
    contains(x: number, y: number): boolean {
      const px = Math.round(x);
      const py = Math.round(y);
      if (px < 0 || px >= width || py < 0 || py >= height) return false;
      return mask[py * width + px] === 1;
    },
  };
}

/**
 * Pick a random digit character (0-9).
 */
export function randomDigit(): string {
  return String(Math.floor(Math.random() * 10));
}
