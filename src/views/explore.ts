/**
 * Explore view: free-form plate generator. Lets users pick a deficiency
 * type, generate plates on demand, and compare trichromat and simulated
 * views side by side with an educational explanation. A secondary
 * feature alongside the primary test flow.
 */

import { generateAcceptedPlate, drawPlate } from "../plate";
import type { AcceptedPlateResult } from "../plate";
import type { DeficiencyType } from "../cvd";
import { scorePlate } from "../score";

type Mode = "test" | "learn";

const PLATE_SIZE = 500;

const deficiencyDescriptions: Record<string, string> = {
  protanopia:
    "Protanopia is a form of red-green color vision deficiency where the " +
    "long-wavelength (red) cone photopigment is absent. People with protanopia " +
    "cannot distinguish colors along the red-green axis, but perceive luminance " +
    "and blue-yellow differences normally.",
  deuteranopia:
    "Deuteranopia is a form of red-green color vision deficiency where the " +
    "medium-wavelength (green) cone photopigment is absent. It is the most " +
    "common inherited color vision deficiency, affecting roughly 1% of males.",
  tritanopia:
    "Tritanopia is a blue-yellow color vision deficiency where the " +
    "short-wavelength (blue) cone photopigment is absent. It is much rarer " +
    "than red-green deficiencies and affects the blue-yellow axis rather than " +
    "red-green.",
};

export interface ExploreCallbacks {
  onBackToTest: () => void;
  /** When true, expose the numerical visibility scores. */
  showDevPanel?: boolean;
}

export function mount(
  host: HTMLElement,
  callbacks: ExploreCallbacks,
): () => void {
  const root = document.createElement("div");
  root.className = "view view-explore";

  const topBar = document.createElement("div");
  topBar.className = "explore-topbar";

  const backBtn = document.createElement("button");
  backBtn.className = "btn-secondary explore-back-btn";
  backBtn.textContent = "← Back to test";
  backBtn.addEventListener("click", callbacks.onBackToTest);
  topBar.appendChild(backBtn);
  root.appendChild(topBar);

  const heading = document.createElement("h1");
  heading.textContent = "Plate generator";
  heading.tabIndex = -1;
  root.appendChild(heading);

  const info = document.createElement("p");
  info.className = "info";
  info.textContent =
    "Generate reverse Ishihara plates and compare what you see with what " +
    "someone with the target color vision deficiency sees.";
  root.appendChild(info);

  // Mode toggle.
  const modeToggle = document.createElement("div");
  modeToggle.className = "mode-toggle";

  const testModeBtn = document.createElement("button");
  testModeBtn.textContent = "Single";
  testModeBtn.className = "mode-btn active";
  testModeBtn.setAttribute("aria-label", "Show only what you see");

  const learnModeBtn = document.createElement("button");
  learnModeBtn.textContent = "Compare";
  learnModeBtn.className = "mode-btn";
  learnModeBtn.setAttribute(
    "aria-label",
    "Show side-by-side comparison with explanation",
  );

  modeToggle.appendChild(testModeBtn);
  modeToggle.appendChild(learnModeBtn);
  root.appendChild(modeToggle);

  // Controls.
  const controls = document.createElement("div");
  controls.className = "controls";

  const deficiencyLabel = document.createElement("label");
  deficiencyLabel.htmlFor = "deficiency-select";
  deficiencyLabel.textContent = "Target:";
  deficiencyLabel.className = "control-label";
  controls.appendChild(deficiencyLabel);

  const deficiencySelect = document.createElement("select");
  deficiencySelect.id = "deficiency-select";
  const deficiencyOptions: Array<{ value: string; label: string }> = [
    { value: "random", label: "Surprise me" },
    { value: "protanopia", label: "Red-blind (protanopia)" },
    { value: "deuteranopia", label: "Green-blind (deuteranopia)" },
    { value: "tritanopia", label: "Blue-yellow blind (tritanopia)" },
  ];
  for (const opt of deficiencyOptions) {
    const el = document.createElement("option");
    el.value = opt.value;
    el.textContent = opt.label;
    deficiencySelect.appendChild(el);
  }
  controls.appendChild(deficiencySelect);

  const generateBtn = document.createElement("button");
  generateBtn.textContent = "Generate";
  controls.appendChild(generateBtn);
  root.appendChild(controls);

  // Canvases.
  const canvasContainer = document.createElement("div");
  canvasContainer.className = "canvas-container";

  const trichPanel = document.createElement("div");
  trichPanel.className = "canvas-panel";
  const trichCanvas = document.createElement("canvas");
  trichCanvas.width = PLATE_SIZE;
  trichCanvas.height = PLATE_SIZE;
  trichCanvas.setAttribute("role", "img");
  trichCanvas.setAttribute("aria-label", "Generated plate, trichromat view");
  const trichCaption = document.createElement("div");
  trichCaption.className = "caption";
  trichCaption.textContent = "What you see";
  trichPanel.appendChild(trichCanvas);
  trichPanel.appendChild(trichCaption);

  const simPanel = document.createElement("div");
  simPanel.className = "canvas-panel";
  const simCanvas = document.createElement("canvas");
  simCanvas.width = PLATE_SIZE;
  simCanvas.height = PLATE_SIZE;
  simCanvas.setAttribute("role", "img");
  simCanvas.setAttribute(
    "aria-label",
    "Generated plate, simulated dichromat view",
  );
  const simCaption = document.createElement("div");
  simCaption.className = "caption";
  simCaption.textContent = "Simulated dichromat view";
  simPanel.appendChild(simCanvas);
  simPanel.appendChild(simCaption);

  canvasContainer.appendChild(trichPanel);
  canvasContainer.appendChild(simPanel);
  root.appendChild(canvasContainer);

  // Educational explanation (compare mode only).
  const explanation = document.createElement("div");
  explanation.className = "explanation";
  root.appendChild(explanation);

  // Reveal.
  const revealContainer = document.createElement("div");
  revealContainer.className = "reveal-container";

  const revealBtn = document.createElement("button");
  revealBtn.textContent = "Reveal answer";

  const revealText = document.createElement("span");
  revealText.className = "reveal-text";

  revealContainer.appendChild(revealBtn);
  revealContainer.appendChild(revealText);
  root.appendChild(revealContainer);

  // Score display (dev only).
  const scoreDisplay = document.createElement("div");
  scoreDisplay.className = "score-display";
  if (callbacks.showDevPanel) root.appendChild(scoreDisplay);

  // State.
  let currentPlate: AcceptedPlateResult | null = null;
  let currentMode: Mode = "test";

  function setMode(mode: Mode): void {
    currentMode = mode;
    testModeBtn.className = `mode-btn${mode === "test" ? " active" : ""}`;
    learnModeBtn.className = `mode-btn${mode === "learn" ? " active" : ""}`;
    applyMode();
    updatePlateDisplaySize();
  }

  function applyMode(): void {
    if (currentMode === "test") {
      simPanel.classList.add("hidden");
      explanation.classList.add("hidden");
      scoreDisplay.classList.add("hidden");
      trichCaption.textContent = "Can you read the hidden digit?";
    } else {
      simPanel.classList.remove("hidden");
      explanation.classList.remove("hidden");
      scoreDisplay.classList.remove("hidden");
      trichCaption.textContent = "What you see (typical color vision)";
      updateExplanation();
    }
  }

  function updatePlateDisplaySize(): void {
    const HORIZONTAL_PADDING = 32;
    const PANEL_GAP = 16;
    const RESERVED_VERTICAL = 260;
    const MIN_SIZE = 200;
    const MAX_SIZE = 600;

    const isWide = window.innerWidth > 640;
    const showingBoth = currentMode === "learn";

    const availWidth = window.innerWidth - HORIZONTAL_PADDING;
    const availHeight = window.innerHeight - RESERVED_VERTICAL;

    const widthBudget =
      showingBoth && isWide ? (availWidth - PANEL_GAP) / 2 : availWidth;

    const size = Math.max(
      MIN_SIZE,
      Math.min(widthBudget, availHeight, MAX_SIZE),
    );

    for (const canvas of [trichCanvas, simCanvas]) {
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
    }
  }

  function updateExplanation(): void {
    if (!currentPlate) {
      explanation.textContent = "";
      return;
    }
    const deficiency = currentPlate.deficiency;
    const desc = deficiencyDescriptions[deficiency] || "";
    explanation.innerHTML =
      `<p class="explanation-heading">How this plate works</p>` +
      `<p>${desc}</p>` +
      `<p>The background dots are colored along the confusion line for ` +
      `${deficiency} — colors that look identical to someone with this ` +
      `deficiency but varied to a typical viewer. The figure dots differ in ` +
      `luminance and saturation along an axis the deficient viewer can still ` +
      `perceive. The result: chromatic noise masks the figure for typical ` +
      `vision, but collapses away for the target deficiency, revealing the digit.</p>`;
  }

  function render(plate: AcceptedPlateResult): void {
    currentPlate = plate;
    revealText.textContent = "";

    drawPlate(trichCanvas.getContext("2d")!, plate, false);
    drawPlate(simCanvas.getContext("2d")!, plate, true);

    simCaption.textContent = `Simulated ${plate.deficiency} view`;

    const score = scorePlate(plate.dots, plate.deficiency);
    scoreDisplay.textContent =
      `Visibility — trichromat: ${score.trichromat.toFixed(1)} ` +
      `| dichromat: ${score.dichromat.toFixed(1)} ` +
      `| ratio: ${score.ratio.toFixed(2)}x` +
      ` | attempts: ${plate.attempts}`;

    updateExplanation();
    applyMode();
  }

  function getSelectedDeficiency(): DeficiencyType | undefined {
    const val = deficiencySelect.value;
    if (val === "random") return undefined;
    return val as DeficiencyType;
  }

  testModeBtn.addEventListener("click", () => setMode("test"));
  learnModeBtn.addEventListener("click", () => setMode("learn"));

  const onResize = (): void => updatePlateDisplaySize();
  window.addEventListener("resize", onResize);

  generateBtn.addEventListener("click", () => {
    render(
      generateAcceptedPlate({
        size: PLATE_SIZE,
        deficiency: getSelectedDeficiency(),
      }),
    );
  });

  revealBtn.addEventListener("click", () => {
    if (currentPlate) {
      revealText.textContent = `The hidden digit is: ${currentPlate.character}`;
    }
  });

  host.appendChild(root);
  heading.focus();
  updatePlateDisplaySize();

  // Generate an initial plate.
  render(
    generateAcceptedPlate({
      size: PLATE_SIZE,
      deficiency: getSelectedDeficiency(),
    }),
  );

  return () => {
    window.removeEventListener("resize", onResize);
    host.removeChild(root);
  };
}
