/**
 * Intro view: landing page. Explains the task, shows a non-CVD example
 * plate readable by everyone, and offers entry points into the test or
 * the explore-mode plate generator.
 */

import { generateExamplePlate, drawPlate } from "../plate";

export interface IntroCallbacks {
  onStart: () => void;
  onExplore: () => void;
}

export function mount(
  host: HTMLElement,
  callbacks: IntroCallbacks,
): () => void {
  const root = document.createElement("div");
  root.className = "view view-intro";

  const heading = document.createElement("h1");
  heading.textContent = "Reverse Colorblindness Test";
  root.appendChild(heading);

  const lede = document.createElement("p");
  lede.className = "intro-lede";
  lede.textContent =
    "A short test — 24 plates, three to five minutes. You'll look at " +
    "dot patterns and identify any digit you see in each one. Some " +
    "patterns hide a digit only viewers with color vision differences " +
    "can read; others hide nothing at all. Your responses sketch a " +
    "picture of how your color vision compares to typical-trichromat " +
    "and full-dichromat references on this test.";
  root.appendChild(lede);

  const example = document.createElement("section");
  example.className = "intro-example";

  const exampleHeading = document.createElement("h2");
  exampleHeading.textContent = "What you'll see";
  example.appendChild(exampleHeading);

  const exampleDesc = document.createElement("p");
  exampleDesc.textContent =
    "Each plate is a circle of colored dots. Look for a digit hidden in " +
    "the pattern. Click the digit if you see one, or click “Not " +
    "sure” if you don't.";
  example.appendChild(exampleDesc);

  const examplePlate = generateExamplePlate({ size: 320 });
  const canvas = document.createElement("canvas");
  canvas.width = examplePlate.size;
  canvas.height = examplePlate.size;
  canvas.className = "intro-example-plate";
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    `Example plate showing the digit ${examplePlate.character}`,
  );
  drawPlate(canvas.getContext("2d")!, examplePlate, false);
  example.appendChild(canvas);

  const exampleCaption = document.createElement("p");
  exampleCaption.className = "intro-example-caption";
  exampleCaption.textContent = `(In this example the digit is ${examplePlate.character}.)`;
  example.appendChild(exampleCaption);

  root.appendChild(example);

  const disclaimer = document.createElement("p");
  disclaimer.className = "intro-disclaimer";
  disclaimer.textContent =
    "This test depends on your screen's color rendering. Take it on a " +
    "well-lit, calibrated display in normal lighting. For educational " +
    "purposes only — not a clinical assessment.";
  root.appendChild(disclaimer);

  const actions = document.createElement("div");
  actions.className = "intro-actions";

  const startBtn = document.createElement("button");
  startBtn.className = "btn-primary intro-start-btn";
  startBtn.textContent = "Start test";
  startBtn.addEventListener("click", callbacks.onStart);
  actions.appendChild(startBtn);

  const exploreBtn = document.createElement("button");
  exploreBtn.className = "btn-secondary intro-explore-btn";
  exploreBtn.textContent = "Explore plate generator";
  exploreBtn.addEventListener("click", callbacks.onExplore);
  actions.appendChild(exploreBtn);

  root.appendChild(actions);

  host.appendChild(root);

  return () => {
    host.removeChild(root);
  };
}
