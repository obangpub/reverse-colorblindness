/**
 * Results view: per-axis bars, plate thumbnails with click-to-enlarge,
 * and navigation to restart or move to explore mode.
 *
 * Each axis is rendered as a two-stripe bar where the left edge shows
 * the two confused colors and the right edge shows their post-simulation
 * collapse. A translucent band marks the Wilson 95% confidence interval
 * around the user's score.
 */

import type { RGB, DeficiencyType } from "../cvd";
import { simulateCVD } from "../cvd";
import { confusionPair } from "../color";
import { drawPlate } from "../plate";
import type { Axis, Response, TestSession } from "../test-session";
import { scoreAxis } from "../test-session";
import { recordEvent, recordTestSummary } from "../telemetry";
import {
  formatShareText,
  createShareActions,
  type ShareActions,
} from "../share-text";

const SWATCH_BASE: RGB = { r: 0.55, g: 0.45, b: 0.4 };
const SWATCH_AMPLITUDE = 0.5;
const PLATE_SIZE = 400;

export interface ResultsCallbacks {
  onRestart: () => void;
  onExplore: () => void;
}

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

function responsesForAxis(
  session: TestSession,
  axis: Axis,
): Response[] {
  return session.responses.filter((r) => r.item.axis === axis);
}

function describeChoice(r: Response): string {
  if (r.choice.type === "digit") return `you answered ${r.choice.value}`;
  return "you answered “not sure”";
}

function plainDeficiencyName(d: DeficiencyType): string {
  switch (d) {
    case "protanopia":
      return "red-green (protan)";
    case "deuteranopia":
      return "red-green (deutan)";
    case "tritanopia":
      return "blue-yellow (tritan)";
  }
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

interface PlateModal {
  element: HTMLDivElement;
  show: (response: Response) => void;
  hide: () => void;
  destroy: () => void;
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
  simBtn.textContent = "Simulated view";
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

  let currentResponse: Response | null = null;
  let simulate = false;
  let previouslyFocused: HTMLElement | null = null;

  const focusables = (): HTMLElement[] => [closeBtn, triBtn, simBtn];

  const redraw = (): void => {
    if (!currentResponse) return;
    const ctx = canvas.getContext("2d")!;
    drawPlate(ctx, currentResponse.item.plate, simulate);
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
    currentResponse = null;
    // Restore focus to whatever triggered the modal.
    if (previouslyFocused && previouslyFocused.isConnected) {
      previouslyFocused.focus();
    }
    previouslyFocused = null;
  };

  closeBtn.addEventListener("click", hide);
  overlay.addEventListener("click", hide);

  // Focus trap: Tab and Shift+Tab cycle within the modal's focusables.
  // Escape closes.
  const onKeydown = (e: KeyboardEvent): void => {
    if (overlay.classList.contains("hidden")) return;
    if (e.key === "Escape") {
      e.preventDefault();
      hide();
      return;
    }
    if (e.key !== "Tab") return;
    const items = focusables();
    if (items.length === 0) return;
    const active = document.activeElement as HTMLElement | null;
    const idx = active ? items.indexOf(active) : -1;
    if (e.shiftKey) {
      if (idx <= 0) {
        e.preventDefault();
        items[items.length - 1]!.focus();
      }
    } else {
      if (idx === items.length - 1 || idx === -1) {
        e.preventDefault();
        items[0]!.focus();
      }
    }
  };
  document.addEventListener("keydown", onKeydown);

  return {
    element: overlay,
    show: (response) => {
      recordEvent("modal_opened");
      previouslyFocused = document.activeElement as HTMLElement | null;
      currentResponse = response;
      const def = response.item.plate.deficiency;
      title.textContent = `Hidden digit: ${response.item.plate.character} — ${plainDeficiencyName(def)} plate`;
      simBtn.textContent = `Simulated ${plainDeficiencyName(def)} view`;

      const status = response.correct ? "Read correctly" : "Not read";
      const choice = describeChoice(response);
      footer.innerHTML = `<span class="plate-modal-result ${response.correct ? "correct" : "incorrect"}">${response.correct ? "✓" : "✗"} ${status}</span> — ${choice}`;
      setSimulate(false);
      overlay.classList.remove("hidden");
      closeBtn.focus();
    },
    hide,
    destroy: () => {
      document.removeEventListener("keydown", onKeydown);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    },
  };
}

// ---------------------------------------------------------------------------
// Row construction
// ---------------------------------------------------------------------------

interface ColorWithLabel {
  color: RGB;
  label: string;
}

interface RowSpec {
  axisTitle: string;
  deficiency: DeficiencyType;
  topColor: ColorWithLabel;
  bottomColor: ColorWithLabel;
  responses: Response[];
}

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
  response: Response,
  modal: PlateModal,
): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "result-thumb clickable";
  wrap.setAttribute("role", "button");
  wrap.setAttribute("tabindex", "0");
  wrap.setAttribute(
    "aria-label",
    `Plate, ${response.correct ? "read correctly" : "not read"}. Click to enlarge.`,
  );

  const canvas = document.createElement("canvas");
  canvas.width = PLATE_SIZE;
  canvas.height = PLATE_SIZE;
  canvas.className = "result-thumb-canvas";
  drawPlate(canvas.getContext("2d")!, response.item.plate, false);
  wrap.appendChild(canvas);

  const mark = document.createElement("span");
  mark.className = `result-thumb-mark ${response.correct ? "correct" : "incorrect"}`;
  mark.textContent = response.correct ? "✓" : "✗";
  wrap.appendChild(mark);

  const open = (): void => modal.show(response);
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
  left.textContent = "None read";
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

  // Wilson 95% CI shaded band.
  const score = scoreAxis(
    spec.responses,
    spec.responses[0]?.item.axis ?? "rg",
  );
  if (score.total > 0) {
    const ciBand = document.createElement("div");
    ciBand.className = "result-bar-ci";
    const lowPct = clamp01(score.ci.low) * 100;
    const widthPct = (clamp01(score.ci.high) - clamp01(score.ci.low)) * 100;
    ciBand.style.left = `${lowPct}%`;
    ciBand.style.width = `${widthPct}%`;
    ciBand.setAttribute(
      "aria-label",
      `95% confidence interval: ${score.ci.low.toFixed(2)} to ${score.ci.high.toFixed(2)}`,
    );
    track.appendChild(ciBand);
  }

  const marker = document.createElement("div");
  marker.className = "result-bar-marker";
  marker.style.left = `${clamp01(score.proportion) * 100}%`;
  track.appendChild(marker);

  bar.appendChild(track);

  const right = document.createElement("span");
  right.className = "result-bar-endpoint result-bar-endpoint-right";
  right.textContent = "All read";
  bar.appendChild(right);

  row.appendChild(bar);

  const readout = document.createElement("div");
  readout.className = "result-readout";
  if (score.total > 0) {
    readout.textContent =
      `${score.correct} of ${score.total} plates read ` +
      "— click any plate to see it in full size";
  } else {
    readout.textContent = "No plates on this axis";
  }
  row.appendChild(readout);

  const thumbs = document.createElement("div");
  thumbs.className = "result-thumbs";
  for (const response of spec.responses) {
    thumbs.appendChild(makeThumbnail(response, modal));
  }
  row.appendChild(thumbs);

  return row;
}

// ---------------------------------------------------------------------------
// Public mount
// ---------------------------------------------------------------------------

export function mount(
  host: HTMLElement,
  session: TestSession,
  callbacks: ResultsCallbacks,
): () => void {
  const root = document.createElement("div");
  root.className = "view view-results";

  const heading = document.createElement("h1");
  heading.textContent = "Your test results";
  heading.tabIndex = -1;
  root.appendChild(heading);

  const results = document.createElement("div");
  results.className = "results";

  const { red, green } = redGreenPair();
  const { blue, yellow } = blueYellowPair();

  const modal = createModal();
  document.body.appendChild(modal.element);

  results.appendChild(
    makeRow(
      {
        axisTitle: "Red-green response",
        deficiency: "protanopia",
        topColor: { color: red, label: "Red" },
        bottomColor: { color: green, label: "Green" },
        responses: responsesForAxis(session, "rg"),
      },
      modal,
    ),
  );

  results.appendChild(
    makeRow(
      {
        axisTitle: "Blue-yellow response",
        deficiency: "tritanopia",
        topColor: { color: blue, label: "Blue" },
        bottomColor: { color: yellow, label: "Yellow" },
        responses: responsesForAxis(session, "by"),
      },
      modal,
    ),
  );

  const caption = document.createElement("p");
  caption.className = "results-caption";
  caption.textContent =
    "The bar's gradient shows the two confused colors merging as the " +
    "matching deficiency strengthens. The marker is your score; the " +
    "crossbar shows uncertainty. A high score doesn't mean your " +
    "vision is dichromatic — milder, more common deficiencies often " +
    "score near 'None read' even when present. For learning about " +
    "color vision, not diagnosis.";

  // Two-column layout: bars + caption on left, share preview on right.
  // Stacks to single column at narrower viewports (see CSS).
  const layout = document.createElement("div");
  layout.className = "results-layout";

  const main = document.createElement("div");
  main.className = "results-main";
  main.appendChild(results);
  main.appendChild(caption);
  layout.appendChild(main);

  const shareSection = document.createElement("section");
  shareSection.className = "results-share";

  const shareHeading = document.createElement("h2");
  shareHeading.className = "share-heading";
  shareHeading.textContent = "Share your result";
  shareSection.appendChild(shareHeading);

  const shareText = formatShareText(session);
  const shareActions: ShareActions = createShareActions(shareText);

  const shareTextBlock = document.createElement("pre");
  shareTextBlock.className = "share-text-block";
  shareTextBlock.textContent = shareText;
  shareTextBlock.setAttribute("aria-label", "Shareable result text");
  shareSection.appendChild(shareTextBlock);

  const shareActionsRow = document.createElement("div");
  shareActionsRow.className = "share-actions-row";

  const copyBtn = document.createElement("button");
  copyBtn.className = "btn-primary";
  copyBtn.textContent = "Copy";
  shareActionsRow.appendChild(copyBtn);

  const shareNativeBtn = document.createElement("button");
  shareNativeBtn.className = "btn-secondary";
  shareNativeBtn.textContent = "Share";
  if (!shareActions.canShareNative) shareNativeBtn.classList.add("hidden");
  shareActionsRow.appendChild(shareNativeBtn);

  shareSection.appendChild(shareActionsRow);

  layout.appendChild(shareSection);
  root.appendChild(layout);

  let copyResetTimeout: number | null = null;

  copyBtn.addEventListener("click", () => {
    shareActions
      .copy()
      .then(() => {
        const original = "Copy";
        copyBtn.textContent = "Copied!";
        copyBtn.disabled = true;
        if (copyResetTimeout !== null) {
          clearTimeout(copyResetTimeout);
        }
        copyResetTimeout = window.setTimeout(() => {
          copyBtn.textContent = original;
          copyBtn.disabled = false;
          copyResetTimeout = null;
        }, 2000);
      })
      .catch((err: unknown) => {
        console.error("Copy failed:", err);
      });
  });

  shareNativeBtn.addEventListener("click", () => {
    shareActions.shareNative().catch((err: unknown) => {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("Share failed:", err);
    });
  });

  const actions = document.createElement("div");
  actions.className = "results-actions";

  const restartBtn = document.createElement("button");
  restartBtn.className = "btn-primary";
  restartBtn.textContent = "Take test again";
  restartBtn.addEventListener("click", callbacks.onRestart);
  actions.appendChild(restartBtn);

  const exploreBtn = document.createElement("button");
  exploreBtn.className = "btn-secondary";
  exploreBtn.textContent = "Explore plate generator";
  exploreBtn.addEventListener("click", callbacks.onExplore);
  actions.appendChild(exploreBtn);

  root.appendChild(actions);

  host.appendChild(root);
  heading.focus();

  recordEvent("test_completed");
  recordTestSummary(session);

  return () => {
    if (copyResetTimeout !== null) clearTimeout(copyResetTimeout);
    modal.destroy();
    host.removeChild(root);
  };
}
