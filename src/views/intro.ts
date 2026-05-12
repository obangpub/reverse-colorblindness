/**
 * Intro view: landing page. Explains the task, shows a non-CVD example
 * plate readable by everyone, and offers entry points into the test or
 * the explore-mode plate generator.
 */

import { generateExamplePlate, drawPlate } from "../plate";

export interface IntroCallbacks {
  onStart: () => void;
  onExplore: () => void;
  onAbout: () => void;
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
    "Standard colorblindness tests hide a digit that most people can " +
    "read but colorblind viewers can't. This one flips it: the digits " +
    "are easier to see with red-green or blue-yellow color vision " +
    "deficiency. Twenty-four plates, three to five minutes.";
  root.appendChild(lede);

  const example = document.createElement("section");
  example.className = "intro-example";

  const exampleHeading = document.createElement("h2");
  exampleHeading.textContent = "What you'll see";
  example.appendChild(exampleHeading);

  const exampleDesc = document.createElement("p");
  exampleDesc.textContent =
    "Each plate is a circle of colored dots with a digit hidden inside. " +
    "Click the digit you see, or “Not sure.” The example below is " +
    "easier than the real plates.";
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
    "Screen and lighting affect the test — use a calibrated display in " +
    "normal light. This is for learning about color vision, not diagnosis.";
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

  const aboutLink = document.createElement("button");
  aboutLink.className = "intro-about-link";
  aboutLink.textContent = "About this test";
  aboutLink.addEventListener("click", callbacks.onAbout);
  actions.appendChild(aboutLink);

  root.appendChild(actions);

  host.appendChild(root);
  heading.focus();

  return () => {
    host.removeChild(root);
  };
}
