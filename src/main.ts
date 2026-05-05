import "./style.css";
import { generateAcceptedPlate, drawPlate } from "./plate";
import type { AcceptedPlateResult } from "./plate";
import type { DeficiencyType } from "./cvd";
import { scorePlate } from "./score";

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
trichCaption.textContent = "Trichromat view";
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

// --- Score display ---
const scoreDisplay = document.createElement("div");
scoreDisplay.className = "score-display";
app.appendChild(scoreDisplay);

// --- State ---
let currentPlate: AcceptedPlateResult | null = null;

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
}

function getSelectedDeficiency(): DeficiencyType | undefined {
  const val = deficiencySelect.value;
  if (val === "random") return undefined;
  return val as DeficiencyType;
}

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
