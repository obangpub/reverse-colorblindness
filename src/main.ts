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
info.textContent =
  "A hidden digit is easier to read with color vision deficiency " +
  "than with typical color vision.";
app.appendChild(info);

// --- Controls ---
const controls = document.createElement("div");
controls.style.marginBottom = "1rem";
controls.style.display = "flex";
controls.style.gap = "0.5rem";
controls.style.alignItems = "center";
controls.style.flexWrap = "wrap";

const deficiencySelect = document.createElement("select");
deficiencySelect.style.fontSize = "1rem";
deficiencySelect.style.padding = "0.4rem 0.6rem";
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
generateBtn.style.fontSize = "1rem";
generateBtn.style.padding = "0.4rem 1.2rem";
generateBtn.style.cursor = "pointer";
controls.appendChild(generateBtn);
app.appendChild(controls);

// --- Canvases ---
const canvasContainer = document.createElement("div");
canvasContainer.style.display = "flex";
canvasContainer.style.gap = "1rem";
canvasContainer.style.flexWrap = "wrap";

const PLATE_SIZE = 500;

// Trichromat view
const trichLabel = document.createElement("div");
const trichCanvas = document.createElement("canvas");
trichCanvas.width = PLATE_SIZE;
trichCanvas.height = PLATE_SIZE;
trichCanvas.style.maxWidth = "100%";
trichCanvas.style.height = "auto";
const trichCaption = document.createElement("div");
trichCaption.textContent = "Trichromat view";
trichCaption.style.textAlign = "center";
trichCaption.style.marginTop = "0.3rem";
trichLabel.appendChild(trichCanvas);
trichLabel.appendChild(trichCaption);

// Simulated dichromat view
const simLabel = document.createElement("div");
const simCanvas = document.createElement("canvas");
simCanvas.width = PLATE_SIZE;
simCanvas.height = PLATE_SIZE;
simCanvas.style.maxWidth = "100%";
simCanvas.style.height = "auto";
const simCaption = document.createElement("div");
simCaption.textContent = "Simulated dichromat view";
simCaption.style.textAlign = "center";
simCaption.style.marginTop = "0.3rem";
simLabel.appendChild(simCanvas);
simLabel.appendChild(simCaption);

canvasContainer.appendChild(trichLabel);
canvasContainer.appendChild(simLabel);
app.appendChild(canvasContainer);

// --- Reveal ---
const revealContainer = document.createElement("div");
revealContainer.style.marginTop = "1rem";

const revealBtn = document.createElement("button");
revealBtn.textContent = "Reveal answer";
revealBtn.style.fontSize = "1rem";
revealBtn.style.padding = "0.4rem 1.2rem";
revealBtn.style.cursor = "pointer";

const revealText = document.createElement("span");
revealText.style.marginLeft = "1rem";
revealText.style.fontSize = "1.2rem";

revealContainer.appendChild(revealBtn);
revealContainer.appendChild(revealText);
app.appendChild(revealContainer);

// --- Score display ---
const scoreDisplay = document.createElement("div");
scoreDisplay.style.marginTop = "1rem";
scoreDisplay.style.fontFamily = "monospace";
scoreDisplay.style.fontSize = "0.85rem";
scoreDisplay.style.color = "#aaa";
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
