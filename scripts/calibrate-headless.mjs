#!/usr/bin/env node
/**
 * Headless calibration runner. Inlines the math from cvd.ts, color.ts,
 * dots.ts, and score.ts so it runs in Node without canvas. The figure
 * mask is a centered rectangle (an approximation of a digit's bounding
 * box) rather than a rasterized digit, so absolute SNR numbers will
 * differ slightly from the in-browser calibration — but scaling with
 * parameters is directionally faithful.
 *
 * Run: node scripts/calibrate-headless.mjs
 */

// ============================================================
// sRGB ↔ linear
// ============================================================

function srgbToLinear(c) {
  if (c <= 0) return 0;
  if (c >= 1) return 1;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c) {
  if (c <= 0) return 0;
  if (c >= 1) return 1;
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

// ============================================================
// CVD matrices (Machado 2009, severity 1.0, row-major 3x3)
// ============================================================

const DEFICIENCY_MATRICES = {
  protanopia: [
    0.152286, 1.052583, -0.204868,
    0.114503, 0.786281, 0.099216,
    -0.003882, -0.048116, 1.051998,
  ],
  deuteranopia: [
    0.367322, 0.860646, -0.227968,
    0.280085, 0.672501, 0.047413,
    -0.01182, 0.04294, 0.968881,
  ],
  tritanopia: [
    // Viénot/Brettel/Mollon 1999. Rank 2 by construction so the cross-
    // product confusion direction lies in the true null space.
    1.0, 0.0, 0.0,
    0.0, 0.7438, 0.2562,
    0.0, 0.7438, 0.2562,
  ],
};

function simulateCVD(rgb, deficiency) {
  const m = DEFICIENCY_MATRICES[deficiency];
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return {
    r: linearToSrgb(m[0] * r + m[1] * g + m[2] * b),
    g: linearToSrgb(m[3] * r + m[4] * g + m[5] * b),
    b: linearToSrgb(m[6] * r + m[7] * g + m[8] * b),
  };
}

// ============================================================
// Confusion and signal directions (in linear RGB)
// ============================================================

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function vlen(v) {
  return Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
}

function normalize(v) {
  const l = vlen(v);
  if (l === 0) return [0, 0, 0];
  return [v[0] / l, v[1] / l, v[2] / l];
}

function vdot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function confusionDirection(matrix) {
  const row0 = [matrix[0], matrix[1], matrix[2]];
  const row1 = [matrix[3], matrix[4], matrix[5]];
  return normalize(cross(row0, row1));
}

const SIGNAL_LUMINANCE_BLEND = 0;

function signalDirection(confDir) {
  const lum = [0.2126, 0.7152, 0.0722];
  const proj = vdot(lum, confDir);
  const ortho = [
    lum[0] - proj * confDir[0],
    lum[1] - proj * confDir[1],
    lum[2] - proj * confDir[2],
  ];
  const b = SIGNAL_LUMINANCE_BLEND;
  return normalize([
    (1 - b) * ortho[0] + b * lum[0],
    (1 - b) * ortho[1] + b * lum[1],
    (1 - b) * ortho[2] + b * lum[2],
  ]);
}

const CONFUSION_DIRS = {
  protanopia: confusionDirection(DEFICIENCY_MATRICES.protanopia),
  deuteranopia: confusionDirection(DEFICIENCY_MATRICES.deuteranopia),
  tritanopia: confusionDirection(DEFICIENCY_MATRICES.tritanopia),
};

const SIGNAL_DIRS = {
  protanopia: signalDirection(CONFUSION_DIRS.protanopia),
  deuteranopia: signalDirection(CONFUSION_DIRS.deuteranopia),
  tritanopia: signalDirection(CONFUSION_DIRS.tritanopia),
};

// ============================================================
// Dot packing
// ============================================================

function packDots(opts) {
  const o = {
    cx: 250, cy: 250, plateRadius: 230,
    minRadius: 4, maxRadius: 12, padding: 1.5,
    maxAttempts: 20000,
    ...opts,
  };
  const dots = [];
  const cellSize = o.maxRadius + o.maxRadius + o.padding || 1;
  const grid = new Map();
  const cellKey = (x, y) =>
    `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;
  const addToGrid = (dot) => {
    const key = cellKey(dot.x, dot.y);
    const cell = grid.get(key);
    if (cell) cell.push(dot);
    else grid.set(key, [dot]);
  };
  const overlaps = (x, y, r) => {
    const gx = Math.floor(x / cellSize);
    const gy = Math.floor(y / cellSize);
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
  };

  let consecutiveFails = 0;
  const maxConsecutiveFails = 500;
  for (let attempt = 0; attempt < o.maxAttempts; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.sqrt(Math.random()) * o.plateRadius;
    const x = o.cx + dist * Math.cos(angle);
    const y = o.cy + dist * Math.sin(angle);
    const r = o.minRadius + Math.random() * (o.maxRadius - o.minRadius);
    if (dist + r + o.padding > o.plateRadius) continue;
    if (overlaps(x, y, r)) {
      consecutiveFails++;
      if (consecutiveFails >= maxConsecutiveFails) break;
      continue;
    }
    const dot = { x, y, radius: r };
    dots.push(dot);
    addToGrid(dot);
    consecutiveFails = 0;
  }
  return dots;
}

// ============================================================
// Stub mask: centered rectangle
// ============================================================

function stubMask(width, height) {
  const x0 = Math.floor(width * 0.35);
  const x1 = Math.floor(width * 0.65);
  const y0 = Math.floor(height * 0.20);
  const y1 = Math.floor(height * 0.80);
  return {
    contains: (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1,
  };
}

// ============================================================
// Color dots (mirrors color.ts colorDots)
// ============================================================

function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

const DEFAULTS = {
  baseColor: { r: 0.55, g: 0.45, b: 0.55 },
  confusionAmplitude: 0.22,
  signalAmplitude: 0.08,
};

function colorDots(dots, mask, opts) {
  const confDir = CONFUSION_DIRS[opts.deficiency];
  const sigDir = SIGNAL_DIRS[opts.deficiency];
  const amplitude = opts.confusionAmplitude ?? DEFAULTS.confusionAmplitude;
  const signal = opts.signalAmplitude ?? DEFAULTS.signalAmplitude;
  const base = opts.baseColor ?? DEFAULTS.baseColor;
  const baseLin = [
    srgbToLinear(base.r),
    srgbToLinear(base.g),
    srgbToLinear(base.b),
  ];

  return dots.map((d) => {
    const isFigure = mask.contains(d.x, d.y);
    const confNoise = (Math.random() * 2 - 1) * amplitude;
    let lr = baseLin[0] + confNoise * confDir[0];
    let lg = baseLin[1] + confNoise * confDir[1];
    let lb = baseLin[2] + confNoise * confDir[2];

    if (isFigure) {
      const sigAmount = signal * (0.7 + Math.random() * 0.6);
      lr += sigAmount * sigDir[0];
      lg += sigAmount * sigDir[1];
      lb += sigAmount * sigDir[2];
    } else {
      const bgJitter = (Math.random() * 2 - 1) * signal * 0.3;
      lr += bgJitter * sigDir[0];
      lg += bgJitter * sigDir[1];
      lb += bgJitter * sigDir[2];
    }

    return {
      ...d,
      color: {
        r: linearToSrgb(clamp01(lr)),
        g: linearToSrgb(clamp01(lg)),
        b: linearToSrgb(clamp01(lb)),
      },
      isFigure,
    };
  });
}

// ============================================================
// Lab + deltaE (mirrors score.ts)
// ============================================================

const D65 = { X: 0.95047, Y: 1.0, Z: 1.08883 };

function rgbToXYZ(rgb) {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return {
    X: 0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
    Y: 0.2126729 * r + 0.7151522 * g + 0.0721750 * b,
    Z: 0.0193339 * r + 0.1191920 * g + 0.9503041 * b,
  };
}

function labF(t) {
  const delta = 6 / 29;
  return t > delta ** 3
    ? Math.cbrt(t)
    : t / (3 * delta * delta) + 4 / 29;
}

function rgbToLab(rgb) {
  const { X, Y, Z } = rgbToXYZ(rgb);
  const fx = labF(X / D65.X);
  const fy = labF(Y / D65.Y);
  const fz = labF(Z / D65.Z);
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

function deltaE(a, b) {
  return Math.sqrt(
    (a.L - b.L) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2,
  );
}

// ============================================================
// Readability score (mirrors score.ts readabilityScore)
// ============================================================

function readabilityScore(dots, viewer, k = 6) {
  const figureDots = dots.filter((d) => d.isFigure);
  const bgDots = dots.filter((d) => !d.isFigure);
  if (figureDots.length === 0 || bgDots.length < 2) {
    return { signal: 0, noise: 0, snr: 0 };
  }

  const labOf = (rgb) =>
    viewer === "trichromat"
      ? rgbToLab(rgb)
      : rgbToLab(simulateCVD(rgb, viewer));

  const bgLabs = bgDots.map((d) => labOf(d.color));

  let signalSum = 0;
  for (const fd of figureDots) {
    const fdLab = labOf(fd.color);
    const dists = bgDots.map((bd, i) => ({
      idx: i,
      d2: (fd.x - bd.x) ** 2 + (fd.y - bd.y) ** 2,
    }));
    dists.sort((a, b) => a.d2 - b.d2);
    const neighbors = dists.slice(0, Math.min(k, dists.length));
    let s = 0;
    for (const n of neighbors) s += deltaE(fdLab, bgLabs[n.idx]);
    signalSum += s / neighbors.length;
  }
  const signal = signalSum / figureDots.length;

  let noiseSum = 0;
  for (let i = 0; i < bgDots.length; i++) {
    const bd = bgDots[i];
    const bdLab = bgLabs[i];
    const dists = [];
    for (let j = 0; j < bgDots.length; j++) {
      if (j === i) continue;
      const ob = bgDots[j];
      dists.push({
        idx: j,
        d2: (bd.x - ob.x) ** 2 + (bd.y - ob.y) ** 2,
      });
    }
    dists.sort((a, b) => a.d2 - b.d2);
    const neighbors = dists.slice(0, Math.min(k, dists.length));
    let s = 0;
    for (const n of neighbors) s += deltaE(bdLab, bgLabs[n.idx]);
    noiseSum += s / neighbors.length;
  }
  const noise = noiseSum / bgDots.length;

  const snr = signal / Math.max(noise, 0.1);
  return { signal, noise, snr };
}

// ============================================================
// Run
// ============================================================

const AXES = ["protanopia", "deuteranopia", "tritanopia"];
const VIEWERS = ["trichromat", "protanopia", "deuteranopia", "tritanopia"];
const SIGNAL_AMPLITUDES = [0.04, 0.06, 0.08, 0.1, 0.12, 0.14];
const READABLE_SNR = 2.0;
const PLATE_SIZE = 400;

function makePlate(axis, signalAmplitude) {
  const radius = PLATE_SIZE / 2;
  const dots = packDots({
    cx: radius,
    cy: radius,
    plateRadius: radius * 0.92,
    minRadius: PLATE_SIZE * 0.008,
    maxRadius: PLATE_SIZE * 0.024,
    padding: PLATE_SIZE * 0.003,
    maxAttempts: 30000,
  });
  const mask = stubMask(PLATE_SIZE, PLATE_SIZE);
  return colorDots(dots, mask, { deficiency: axis, signalAmplitude });
}

const t0 = performance.now();
const plates = [];

for (const axis of AXES) {
  for (const sa of SIGNAL_AMPLITUDES) {
    const colored = makePlate(axis, sa);
    const scores = {};
    for (const v of VIEWERS) scores[v] = readabilityScore(colored, v);
    plates.push({ axis, sa, scores });
  }
}

const fmtFrac = (x) => x.toFixed(2);
const fmtNum = (x, w = 5) => x.toFixed(1).padStart(w, " ");

console.log(
  `Headless calibration (stub rect mask, confusion=${DEFAULTS.confusionAmplitude}, SNR threshold=${READABLE_SNR})`,
);
console.log(
  "Note: numbers may differ from in-browser values because the figure mask is a rectangle, not a rasterized digit.\n",
);

console.log("Readable fraction per (viewer × plate-axis):");
console.log(
  "                  protan plates   deutan plates   tritan plates",
);
for (const v of VIEWERS) {
  const cells = AXES.map((axis) => {
    const onAxis = plates.filter((p) => p.axis === axis);
    const readable = onAxis.filter(
      (p) => p.scores[v].snr >= READABLE_SNR,
    ).length;
    return fmtFrac(readable / onAxis.length);
  });
  console.log(`  ${v.padEnd(15)}    ${cells.join("          ")}`);
}

console.log("\nPer-plate SNR (rows = plates, cols = viewer):");
console.log(
  "  axis         signalAmp     trich   protan   deutan   tritan",
);
for (const p of plates) {
  const v = (k) => fmtNum(p.scores[k].snr);
  console.log(
    `  ${p.axis.padEnd(13)}  ${p.sa.toFixed(2)}      ${v("trichromat")}    ${v("protanopia")}    ${v("deuteranopia")}    ${v("tritanopia")}`,
  );
}

console.log("\nPer-plate signal / noise (target axis only):");
console.log(
  "  axis         signalAmp     signal(trich)  noise(trich)  signal(target)  noise(target)",
);
for (const p of plates) {
  const s = p.scores;
  console.log(
    `  ${p.axis.padEnd(13)}  ${p.sa.toFixed(2)}        ${fmtNum(s.trichromat.signal)}         ${fmtNum(s.trichromat.noise)}          ${fmtNum(s[p.axis].signal)}           ${fmtNum(s[p.axis].noise)}`,
  );
}

const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
console.log(`\n(${elapsed}s)`);
