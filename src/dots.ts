/**
 * Ishihara-style dot packing: generate a dense field of random
 * non-overlapping circles within a circular plate region.
 *
 * Uses rejection sampling: pick a random position and radius, accept if it
 * doesn't overlap any existing dot, retry otherwise. Simple and sufficient
 * for the density levels we need.
 */

export interface Dot {
  x: number;
  y: number;
  radius: number;
}

export interface DotPackingOptions {
  /** Center X of the circular plate region. */
  cx: number;
  /** Center Y of the circular plate region. */
  cy: number;
  /** Radius of the circular plate region. */
  plateRadius: number;
  /** Minimum dot radius. */
  minRadius: number;
  /** Maximum dot radius. */
  maxRadius: number;
  /** Minimum gap between dots (edge to edge). */
  padding: number;
  /** Maximum placement attempts before stopping. */
  maxAttempts: number;
}

const DEFAULT_OPTIONS: DotPackingOptions = {
  cx: 250,
  cy: 250,
  plateRadius: 230,
  minRadius: 4,
  maxRadius: 12,
  padding: 1.5,
  maxAttempts: 20_000,
};

/**
 * Generate a packed field of non-overlapping circles inside a circular plate.
 *
 * Returns dots sorted large-to-small (placed first to maximize packing density).
 */
export function packDots(opts: Partial<DotPackingOptions> = {}): Dot[] {
  const o = { ...DEFAULT_OPTIONS, ...opts };
  const dots: Dot[] = [];

  // Spatial grid for fast overlap checks. Cell size = max possible
  // center-to-center distance that could still overlap.
  const cellSize = (o.maxRadius + o.maxRadius + o.padding) || 1;
  const grid = new Map<string, Dot[]>();

  function cellKey(x: number, y: number): string {
    return `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;
  }

  function addToGrid(dot: Dot): void {
    const key = cellKey(dot.x, dot.y);
    const cell = grid.get(key);
    if (cell) {
      cell.push(dot);
    } else {
      grid.set(key, [dot]);
    }
  }

  function overlapsExisting(x: number, y: number, r: number): boolean {
    const gx = Math.floor(x / cellSize);
    const gy = Math.floor(y / cellSize);
    // Check 3x3 neighborhood of grid cells.
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cell = grid.get(`${gx + dx},${gy + dy}`);
        if (!cell) continue;
        for (const d of cell) {
          const distSq = (d.x - x) ** 2 + (d.y - y) ** 2;
          const minDist = d.radius + r + o.padding;
          if (distSq < minDist * minDist) return true;
        }
      }
    }
    return false;
  }

  let consecutiveFails = 0;
  const maxConsecutiveFails = 500;

  for (let attempt = 0; attempt < o.maxAttempts; attempt++) {
    // Random position inside the plate circle (uniform distribution).
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.sqrt(Math.random()) * o.plateRadius;
    const x = o.cx + dist * Math.cos(angle);
    const y = o.cy + dist * Math.sin(angle);

    // Random radius, biased slightly toward smaller dots for denser packing.
    const r = o.minRadius + Math.random() * (o.maxRadius - o.minRadius);

    // Dot must fit entirely inside the plate.
    if (dist + r + o.padding > o.plateRadius) {
      continue;
    }

    if (overlapsExisting(x, y, r)) {
      consecutiveFails++;
      if (consecutiveFails >= maxConsecutiveFails) break;
      continue;
    }

    const dot: Dot = { x, y, radius: r };
    dots.push(dot);
    addToGrid(dot);
    consecutiveFails = 0;
  }

  return dots;
}
