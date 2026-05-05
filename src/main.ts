import { simulateCVD } from "./cvd";
import type { DeficiencyType, RGB } from "./cvd";

const app = document.getElementById("app")!;

// Smoke test: render a small grid showing original vs simulated colors.
const deficiencies: DeficiencyType[] = ["protanopia", "deuteranopia", "tritanopia"];
const testColors: RGB[] = [
  { r: 1, g: 0, b: 0 },
  { r: 0, g: 1, b: 0 },
  { r: 0, g: 0, b: 1 },
  { r: 1, g: 1, b: 0 },
  { r: 0.5, g: 0.5, b: 0.5 },
];

function rgbToCSS(c: RGB): string {
  return `rgb(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)})`;
}

const heading = document.createElement("h1");
heading.textContent = "Reverse Colorblindness Test";
app.appendChild(heading);

const info = document.createElement("p");
info.textContent = "CVD simulation smoke test (scaffold). Plate generation coming soon.";
app.appendChild(info);

for (const deficiency of deficiencies) {
  const section = document.createElement("div");
  section.style.marginBottom = "1rem";

  const label = document.createElement("h3");
  label.textContent = deficiency;
  section.appendChild(label);

  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.gap = "8px";

  for (const color of testColors) {
    const simulated = simulateCVD(color, deficiency);
    const pair = document.createElement("div");
    pair.style.display = "flex";
    pair.style.flexDirection = "column";
    pair.style.gap = "2px";

    const orig = document.createElement("div");
    orig.style.width = "40px";
    orig.style.height = "40px";
    orig.style.backgroundColor = rgbToCSS(color);

    const sim = document.createElement("div");
    sim.style.width = "40px";
    sim.style.height = "40px";
    sim.style.backgroundColor = rgbToCSS(simulated);

    pair.appendChild(orig);
    pair.appendChild(sim);
    row.appendChild(pair);
  }
  section.appendChild(row);
  app.appendChild(section);
}
