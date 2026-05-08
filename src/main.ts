import "./style.css";
import { generateAcceptedPlate, drawPlate } from "./plate";
import type { AcceptedPlateResult } from "./plate";
import type { DeficiencyType } from "./cvd";
import { scorePlate } from "./score";
import { createResults, generatePlaceholderRecords } from "./results";
import { runCalibration, formatCalibrationReport } from "./calibrate";

type Mode = "test" | "learn";

// Dev-only UI (visibility scores, results placeholder, calibration panel)
// is gated behind a URL flag: append `?dev` to the address bar to enable.
// Keeps the wiring intact without exposing it to end users.
const DEV_MODE = new URLSearchParams(window.location.search).has("dev");

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

const app = document.getElementById("app")!;

// --- Header ---
const heading = document.createElement("h1");
heading.textContent = "Reverse Colorblindness Test";
app.appendChild(heading);

const info = document.createElement("p");
info.className = "info";
info.textContent =
  "A hidden digit is easier to read with color vision deficiency " +
  "than with typical color vision.";
app.appendChild(info);

// --- Mode toggle ---
const modeToggle = document.createElement("div");
modeToggle.className = "mode-toggle";

const testModeBtn = document.createElement("button");
testModeBtn.textContent = "Test";
testModeBtn.className = "mode-btn active";

const learnModeBtn = document.createElement("button");
learnModeBtn.textContent = "Learn";
learnModeBtn.className = "mode-btn";

modeToggle.appendChild(testModeBtn);
modeToggle.appendChild(learnModeBtn);
app.appendChild(modeToggle);

// --- Controls ---
const controls = document.createElement("div");
controls.className = "controls";

const deficiencySelect = document.createElement("select");
const deficiencyOptions: Array<{ value: string; label: string }> = [
  { value: "random", label: "Surprise me" },
  { value: "protanopia", label: "Protanopia (red-blind)" },
  { value: "deuteranopia", label: "Deuteranopia (green-blind)" },
  { value: "tritanopia", label: "Tritanopia (blue-blind)" },
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
app.appendChild(controls);

// --- Canvases ---
const canvasContainer = document.createElement("div");
canvasContainer.className = "canvas-container";

const PLATE_SIZE = 500;

// Trichromat view
const trichPanel = document.createElement("div");
trichPanel.className = "canvas-panel";
const trichCanvas = document.createElement("canvas");
trichCanvas.width = PLATE_SIZE;
trichCanvas.height = PLATE_SIZE;
const trichCaption = document.createElement("div");
trichCaption.className = "caption";
trichCaption.textContent = "What you see";
trichPanel.appendChild(trichCanvas);
trichPanel.appendChild(trichCaption);

// Simulated dichromat view
const simPanel = document.createElement("div");
simPanel.className = "canvas-panel";
const simCanvas = document.createElement("canvas");
simCanvas.width = PLATE_SIZE;
simCanvas.height = PLATE_SIZE;
const simCaption = document.createElement("div");
simCaption.className = "caption";
simCaption.textContent = "Simulated dichromat view";
simPanel.appendChild(simCanvas);
simPanel.appendChild(simCaption);

canvasContainer.appendChild(trichPanel);
canvasContainer.appendChild(simPanel);
app.appendChild(canvasContainer);

// --- Educational explanation (learn mode only) ---
const explanation = document.createElement("div");
explanation.className = "explanation";
app.appendChild(explanation);

// --- Reveal ---
const revealContainer = document.createElement("div");
revealContainer.className = "reveal-container";

const revealBtn = document.createElement("button");
revealBtn.textContent = "Reveal answer";

const revealText = document.createElement("span");
revealText.className = "reveal-text";

revealContainer.appendChild(revealBtn);
revealContainer.appendChild(revealText);
app.appendChild(revealContainer);

// --- Score display (dev only) ---
const scoreDisplay = document.createElement("div");
scoreDisplay.className = "score-display";
if (DEV_MODE) app.appendChild(scoreDisplay);

// --- Test results placeholder (dev only) ---
// The results visualization will be driven by real test sessions once the
// test flow ships. Until then, only show under DEV_MODE so end users
// don't see a fake results panel.
if (DEV_MODE) {
  const resultsContainer = document.createElement("div");
  resultsContainer.className = "results-container";

  const resultsHeading = document.createElement("h2");
  resultsHeading.textContent = "Your test results";
  resultsContainer.appendChild(resultsHeading);

  let resultsBody = createResults();
  resultsContainer.appendChild(resultsBody);

  const resultsCaption = document.createElement("p");
  resultsCaption.className = "results-caption";
  resultsCaption.textContent =
    "Each row records your responses on one axis of the test. The swatch " +
    "pair shows two colors that look identical to viewers along that " +
    "confusion line. The bar's two stripes start as those distinct colors " +
    "(left, what a trichromat sees) and fade into a single tone (right, " +
    "what a dichromat sees) — so the bar itself demonstrates the " +
    "collapse. Click any plate thumbnail to view it at full size and " +
    "toggle between trichromat and simulated views. " +
    "For educational purposes — not a clinical assessment.";
  resultsContainer.appendChild(resultsCaption);

  app.appendChild(resultsContainer);

  // Generate a placeholder plate battery after first paint so initial load
  // stays responsive. Real flow will populate from a completed test session.
  setTimeout(() => {
    const records = generatePlaceholderRecords();
    const populated = createResults({
      rgRecords: records.rg,
      byRecords: records.by,
    });
    resultsContainer.replaceChild(populated, resultsBody);
    resultsBody = populated;
  }, 50);
}

// --- Calibration debug panel (dev only) ---
if (DEV_MODE) {
  const calibContainer = document.createElement("div");
  calibContainer.className = "calib-container";

  const calibHeading = document.createElement("h2");
  calibHeading.textContent = "Calibration (debug)";
  calibContainer.appendChild(calibHeading);

  const calibBtn = document.createElement("button");
  calibBtn.textContent = "Run calibration";
  calibContainer.appendChild(calibBtn);

  const calibOutput = document.createElement("pre");
  calibOutput.className = "calib-output";
  calibContainer.appendChild(calibOutput);

  calibBtn.addEventListener("click", () => {
    calibBtn.disabled = true;
    calibBtn.textContent = "Running...";
    calibOutput.textContent = "";
    setTimeout(() => {
      const t0 = performance.now();
      const result = runCalibration();
      const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
      calibOutput.textContent =
        formatCalibrationReport(result) + `\n\n(${elapsed}s)`;
      calibBtn.disabled = false;
      calibBtn.textContent = "Run calibration";
    }, 50);
  });

  app.appendChild(calibContainer);
}

// --- State ---
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

  const trichCtx = trichCanvas.getContext("2d")!;
  const simCtx = simCanvas.getContext("2d")!;

  drawPlate(trichCtx, plate, false);
  drawPlate(simCtx, plate, true);

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

window.addEventListener("resize", updatePlateDisplaySize);
updatePlateDisplaySize();

generateBtn.addEventListener("click", () => {
  const plate = generateAcceptedPlate({
    size: PLATE_SIZE,
    deficiency: getSelectedDeficiency(),
  });
  render(plate);
});

revealBtn.addEventListener("click", () => {
  if (currentPlate) {
    revealText.textContent = `The hidden digit is: ${currentPlate.character}`;
  }
});

// Generate an initial plate on load.
render(generateAcceptedPlate({
  size: PLATE_SIZE,
  deficiency: getSelectedDeficiency(),
}));
