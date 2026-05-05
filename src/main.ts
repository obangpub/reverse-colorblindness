import { generatePlate, drawPlate } from "./plate";
import type { PlateResult } from "./plate";

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

// --- Generate button ---
const controls = document.createElement("div");
controls.style.marginBottom = "1rem";

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

// --- State ---
let currentPlate: PlateResult | null = null;

function render(plate: PlateResult): void {
  currentPlate = plate;
  revealText.textContent = "";

  const trichCtx = trichCanvas.getContext("2d")!;
  const simCtx = simCanvas.getContext("2d")!;

  drawPlate(trichCtx, plate, false);
  drawPlate(simCtx, plate, true);

  simCaption.textContent = `Simulated ${plate.deficiency} view`;
}

generateBtn.addEventListener("click", () => {
  const plate = generatePlate({ size: PLATE_SIZE });
  render(plate);
});

revealBtn.addEventListener("click", () => {
  if (currentPlate) {
    revealText.textContent = `The hidden digit is: ${currentPlate.character}`;
  }
});

// Generate an initial plate on load.
render(generatePlate({ size: PLATE_SIZE }));
