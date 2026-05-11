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
  heading.tabIndex = -1;
  root.appendChild(heading);

  const lede = document.createElement("p");
  lede.className = "intro-lede";
  lede.textContent =
    "A short test — 24 plates, three to five minutes. Each plate hides " +
    "a digit that's easier to see if you're colorblind in certain ways. " +
    "Most people with typical color vision can't see them at all. " +
    "We'll show you where your color vision sits between typical and " +
    "fully colorblind.";
  root.appendChild(lede);

  const example = document.createElement("section");
  example.className = "intro-example";

  const exampleHeading = document.createElement("h2");
  exampleHeading.textContent = "What you'll see";
  example.appendChild(exampleHeading);

  const exampleDesc = document.createElement("p");
  exampleDesc.textContent =
    "Each plate is a circle of colored dots with a digit hidden in the " +
    "pattern. Click the digit if you see one, or “Not sure” if you " +
    "don't — which will often be the right answer. The example below " +
    "is deliberately easier to read than the actual test plates.";
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
    "Your screen affects the test. Take it on a well-lit, calibrated " +
    "display in normal lighting. This is for learning about color " +
    "vision, not for diagnosing anything.";
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
  heading.focus();

  return () => {
    host.removeChild(root);
  };
}
