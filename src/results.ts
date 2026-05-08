/**
 * Test result display.
 *
 * Two stacked horizontal rows, one per axis (red-green, blue-yellow).
 * Each row contains:
 *
 *   - Axis title with inline labeled swatch pair
 *   - A two-stripe bar that demonstrates the confusion: the left end
 *     shows the two confused colors stacked; the right end shows what
 *     those colors collapse to under the relevant simulation. To a
 *     trichromat the stripes start distinct and fade into one; to a
 *     dichromat the whole bar is uniform. The user's position marker
 *     shows where their responses land between the trichromat reference
 *     (left) and dichromat reference (right).
 *   - A strip of plate thumbnails. Click a thumbnail to open a modal
 *     showing the plate at full size with a toggle between trichromat
 *     view and simulated-dichromat view.
 */

import type { RGB, DeficiencyType } from "./cvd";
import { simulateCVD } from "./cvd";
import { confusionPair } from "./color";
import { generateAcceptedPlate, drawPlate } from "./plate";
import type { AcceptedPlateResult } from "./plate";

const SWATCH_BASE: RGB = { r: 0.55, g: 0.45, b: 0.4 };
const SWATCH_AMPLITUDE = 0.5;
const PLATE_SIZE = 400;

function rgbToCss(c: RGB): string {
  return `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function redGreenPair(): { red: RGB; green: RGB } {
  const [a, b] = confusionPair("protanopia", SWATCH_BASE, SWATCH_AMPLITUDE);
  return a.r - a.g > b.r - b.g
    ? { red: a, green: b }
    : { red: b, green: a };
}

function blueYellowPair(): { blue: RGB; yellow: RGB } {
  const [a, b] = confusionPair("tritanopia", SWATCH_BASE, SWATCH_AMPLITUDE);
  return a.b > b.b ? { blue: a, yellow: b } : { blue: b, yellow: a };
}

export interface PlateRecord {
  plate: AcceptedPlateResult;
  correct: boolean;
}

export interface ResultsOptions {
  /** Red-green score in [0, 1]. If absent, derived from rgRecords. */
  rg?: number;
  /** Blue-yellow score in [0, 1]. If absent, derived from byRecords. */
  by?: number;
  /** Plates and per-plate correctness for the red-green battery. */
  rgRecords?: PlateRecord[];
  /** Plates and per-plate correctness for the blue-yellow battery. */
  byRecords?: PlateRecord[];
}

/**
 * Generate a placeholder battery of real plates plus arbitrary
 * correctness flags. For the prototype only — the real flow will pass
 * actual records collected during a user test session.
 */
export function generatePlaceholderRecords(): {
  rg: PlateRecord[];
  by: PlateRecord[];
} {
  const rgDefs: DeficiencyType[] = [
    "protanopia",
    "protanopia",
    "protanopia",
    "deuteranopia",
    "deuteranopia",
    "deuteranopia",
  ];
  const rgCorrect = [true, false, true, true, false, true];
  const byCorrect = [false, false, true, false, false, false];

  const rg = rgDefs.map((d, i) => ({
    plate: generateAcceptedPlate({ size: PLATE_SIZE, deficiency: d }),
    correct: rgCorrect[i]!,
  }));
  const by = byCorrect.map((c) => ({
    plate: generateAcceptedPlate({
      size: PLATE_SIZE,
      deficiency: "tritanopia",
    }),
    correct: c,
  }));

  return { rg, by };
}

interface ColorWithLabel {
  color: RGB;
  label: string;
}

interface RowSpec {
  axisTitle: string;
  deficiency: DeficiencyType;
  topColor: ColorWithLabel;
  bottomColor: ColorWithLabel;
  records: PlateRecord[];
  score: number;
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

interface PlateModal {
  element: HTMLDivElement;
  show: (record: PlateRecord) => void;
  hide: () => void;
}

function createModal(): PlateModal {
  const overlay = document.createElement("div");
  overlay.className = "plate-modal-overlay hidden";

  const content = document.createElement("div");
  content.className = "plate-modal-content";
  content.addEventListener("click", (e) => e.stopPropagation());

  const closeBtn = document.createElement("button");
  closeBtn.className = "plate-modal-close";
  closeBtn.textContent = "×";
  closeBtn.setAttribute("aria-label", "Close");
  content.appendChild(closeBtn);

  const title = document.createElement("h3");
  title.className = "plate-modal-title";
  content.appendChild(title);

  const toggle = document.createElement("div");
  toggle.className = "plate-modal-toggle";

  const triBtn = document.createElement("button");
  triBtn.textContent = "What you see";
  triBtn.className = "plate-modal-toggle-btn active";

  const simBtn = document.createElement("button");
  simBtn.textContent = "Simulated dichromat view";
  simBtn.className = "plate-modal-toggle-btn";

  toggle.appendChild(triBtn);
  toggle.appendChild(simBtn);
  content.appendChild(toggle);

  const canvas = document.createElement("canvas");
  canvas.width = PLATE_SIZE;
  canvas.height = PLATE_SIZE;
  canvas.className = "plate-modal-canvas";
  content.appendChild(canvas);

  const footer = document.createElement("div");
  footer.className = "plate-modal-footer";
  content.appendChild(footer);

  overlay.appendChild(content);

  let currentRecord: PlateRecord | null = null;
  let simulate = false;

  const redraw = (): void => {
    if (!currentRecord) return;
    const ctx = canvas.getContext("2d")!;
    drawPlate(ctx, currentRecord.plate, simulate);
  };

  const setSimulate = (v: boolean): void => {
    simulate = v;
    triBtn.classList.toggle("active", !v);
    simBtn.classList.toggle("active", v);
    redraw();
  };

  triBtn.addEventListener("click", () => setSimulate(false));
  simBtn.addEventListener("click", () => setSimulate(true));

  const hide = (): void => {
    overlay.classList.add("hidden");
    currentRecord = null;
  };

  closeBtn.addEventListener("click", hide);
  overlay.addEventListener("click", hide);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.classList.contains("hidden")) {
      hide();
    }
  });

  return {
    element: overlay,
    show: (record) => {
      currentRecord = record;
      title.textContent = `Hidden digit: ${record.plate.character}`;
      simBtn.textContent = `Simulated ${record.plate.deficiency} view`;
      const status = record.correct ? "Read correctly" : "Not read";
      footer.innerHTML = `<span class="plate-modal-result ${record.correct ? "correct" : "incorrect"}">${record.correct ? "✓" : "✗"} ${status}</span>`;
      setSimulate(false);
      overlay.classList.remove("hidden");
    },
    hide,
  };
}

// ---------------------------------------------------------------------------
// Row construction
// ---------------------------------------------------------------------------

function makeSwatch(color: RGB, label: string): HTMLSpanElement {
  const wrap = document.createElement("span");
  wrap.className = "result-swatch";

  const dot = document.createElement("span");
  dot.className = "result-swatch-dot";
  dot.style.background = rgbToCss(color);
  wrap.appendChild(dot);

  const lbl = document.createElement("span");
  lbl.className = "result-swatch-label";
  lbl.textContent = label;
  wrap.appendChild(lbl);

  return wrap;
}

function makeStripe(
  color: RGB,
  deficiency: DeficiencyType,
  className: string,
): HTMLDivElement {
  const stripe = document.createElement("div");
  stripe.className = className;
  const sim = simulateCVD(color, deficiency);
  stripe.style.background = `linear-gradient(to right, ${rgbToCss(color)}, ${rgbToCss(sim)})`;
  return stripe;
}

function makeThumbnail(
  record: PlateRecord,
  modal: PlateModal,
): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "result-thumb clickable";
  wrap.setAttribute("role", "button");
  wrap.setAttribute("tabindex", "0");
  wrap.setAttribute(
    "aria-label",
    `Plate, ${record.correct ? "read correctly" : "not read"}. Click to enlarge.`,
  );

  const canvas = document.createElement("canvas");
  canvas.width = PLATE_SIZE;
  canvas.height = PLATE_SIZE;
  canvas.className = "result-thumb-canvas";
  const ctx = canvas.getContext("2d")!;
  drawPlate(ctx, record.plate, false);
  wrap.appendChild(canvas);

  const mark = document.createElement("span");
  mark.className = `result-thumb-mark ${record.correct ? "correct" : "incorrect"}`;
  mark.textContent = record.correct ? "✓" : "✗";
  wrap.appendChild(mark);

  const open = (): void => modal.show(record);
  wrap.addEventListener("click", open);
  wrap.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  });

  return wrap;
}

function makeRow(spec: RowSpec, modal: PlateModal): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "result-row";

  const header = document.createElement("div");
  header.className = "result-header";

  const title = document.createElement("span");
  title.className = "result-axis-title";
  title.textContent = spec.axisTitle;
  header.appendChild(title);

  const swatches = document.createElement("span");
  swatches.className = "result-swatches";
  swatches.appendChild(makeSwatch(spec.topColor.color, spec.topColor.label));
  swatches.appendChild(
    makeSwatch(spec.bottomColor.color, spec.bottomColor.label),
  );
  header.appendChild(swatches);

  row.appendChild(header);

  const bar = document.createElement("div");
  bar.className = "result-bar";

  const left = document.createElement("span");
  left.className = "result-bar-endpoint result-bar-endpoint-left";
  left.textContent = "Trichromat";
  bar.appendChild(left);

  const track = document.createElement("div");
  track.className = "result-bar-track";

  track.appendChild(
    makeStripe(spec.topColor.color, spec.deficiency, "result-bar-stripe top"),
  );
  track.appendChild(
    makeStripe(
      spec.bottomColor.color,
      spec.deficiency,
      "result-bar-stripe bottom",
    ),
  );

  const marker = document.createElement("div");
  marker.className = "result-bar-marker";
  marker.style.left = `${clamp01(spec.score) * 100}%`;
  track.appendChild(marker);

  bar.appendChild(track);

  const right = document.createElement("span");
  right.className = "result-bar-endpoint result-bar-endpoint-right";
  right.textContent = "Dichromat";
  bar.appendChild(right);

  row.appendChild(bar);

  const readout = document.createElement("div");
  readout.className = "result-readout";
  const correctCount = spec.records.filter((r) => r.correct).length;
  readout.textContent = `${correctCount} of ${spec.records.length} plates read — click a thumbnail to view`;
  row.appendChild(readout);

  const thumbs = document.createElement("div");
  thumbs.className = "result-thumbs";
  for (const record of spec.records) {
    thumbs.appendChild(makeThumbnail(record, modal));
  }
  row.appendChild(thumbs);

  return row;
}

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

export function createResults(opts: ResultsOptions = {}): HTMLDivElement {
  const container = document.createElement("div");
  container.className = "results";

  const { red, green } = redGreenPair();
  const { blue, yellow } = blueYellowPair();

  const rgRecords = opts.rgRecords ?? [];
  const byRecords = opts.byRecords ?? [];
  const rgScore =
    opts.rg ??
    (rgRecords.length > 0
      ? rgRecords.filter((r) => r.correct).length / rgRecords.length
      : 0);
  const byScore =
    opts.by ??
    (byRecords.length > 0
      ? byRecords.filter((r) => r.correct).length / byRecords.length
      : 0);

  const modal = createModal();
  document.body.appendChild(modal.element);

  container.appendChild(
    makeRow(
      {
        axisTitle: "Red-green response",
        deficiency: "protanopia",
        topColor: { color: red, label: "Red" },
        bottomColor: { color: green, label: "Green" },
        records: rgRecords,
        score: rgScore,
      },
      modal,
    ),
  );

  container.appendChild(
    makeRow(
      {
        axisTitle: "Blue-yellow response",
        deficiency: "tritanopia",
        topColor: { color: blue, label: "Blue" },
        bottomColor: { color: yellow, label: "Yellow" },
        records: byRecords,
        score: byScore,
      },
      modal,
    ),
  );

  return container;
}
