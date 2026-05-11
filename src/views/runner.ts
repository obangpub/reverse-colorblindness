/**
 * Runner view: walks the user through the test battery, one plate at a
 * time. Captures responses (digit guess or "not sure"), auto-advances
 * with a brief fade transition, surfaces progress, and offers a restart
 * escape.
 *
 * Keyboard: number keys 0-9 enter that digit; "n" or "?" answers
 * "not sure".
 */

import { drawPlate } from "../plate";
import type { Choice, TestSession } from "../test-session";
import {
  isComplete,
  nextItem,
  progress,
  recordResponse,
} from "../test-session";

export interface RunnerCallbacks {
  onComplete: (session: TestSession) => void;
  onExit: () => void;
}

const PLATE_DISPLAY_SIZE = 400;
const TRANSITION_MS = 100;

export function mount(
  host: HTMLElement,
  session: TestSession,
  callbacks: RunnerCallbacks,
): () => void {
  const root = document.createElement("div");
  root.className = "view view-runner";

  // Visually-hidden heading so screen-reader users know which view they're
  // in. Focused on mount so screen readers announce the view transition.
  const srHeading = document.createElement("h1");
  srHeading.className = "sr-only";
  srHeading.textContent = "Color vision test";
  srHeading.tabIndex = -1;
  root.appendChild(srHeading);

  // Top bar: progress label + bar + exit link.
  const topBar = document.createElement("div");
  topBar.className = "runner-topbar";

  // Progress label doubles as the ARIA live region: when its text updates
  // ("Plate N of M"), screen readers announce the new plate.
  const progressLabel = document.createElement("div");
  progressLabel.className = "runner-progress-label";
  progressLabel.setAttribute("aria-live", "polite");
  progressLabel.setAttribute("aria-atomic", "true");
  topBar.appendChild(progressLabel);

  const progressBar = document.createElement("div");
  progressBar.className = "runner-progress-bar";
  progressBar.setAttribute("role", "progressbar");
  progressBar.setAttribute("aria-valuemin", "0");
  progressBar.setAttribute(
    "aria-valuemax",
    String(session.battery.length),
  );

  const progressFill = document.createElement("div");
  progressFill.className = "runner-progress-fill";
  progressBar.appendChild(progressFill);
  topBar.appendChild(progressBar);

  const exitBtn = document.createElement("button");
  exitBtn.className = "runner-restart-link";
  exitBtn.textContent = "Exit test";
  exitBtn.setAttribute(
    "aria-label",
    "Exit the test, discarding current progress",
  );
  exitBtn.addEventListener("click", () => {
    const ok = window.confirm(
      "Exit the test? Your current progress will be discarded.",
    );
    if (ok) callbacks.onExit();
  });
  topBar.appendChild(exitBtn);

  root.appendChild(topBar);

  // Plate canvas. (No aria-live here — the canvas itself can't be read
  // aloud; we announce plate transitions via the progress label.)
  const plateContainer = document.createElement("div");
  plateContainer.className = "runner-plate-container";

  const canvas = document.createElement("canvas");
  canvas.width = PLATE_DISPLAY_SIZE;
  canvas.height = PLATE_DISPLAY_SIZE;
  canvas.className = "runner-plate";
  canvas.setAttribute("role", "img");
  plateContainer.appendChild(canvas);
  root.appendChild(plateContainer);

  // Question prompt.
  const prompt = document.createElement("p");
  prompt.className = "runner-prompt";
  prompt.textContent = "What digit do you see?";
  root.appendChild(prompt);

  // Answer buttons.
  const buttons = document.createElement("div");
  buttons.className = "runner-buttons";

  for (let d = 0; d <= 9; d++) {
    const btn = document.createElement("button");
    btn.className = "runner-digit-btn";
    btn.textContent = String(d);
    btn.setAttribute("aria-label", `Digit ${d}`);
    btn.addEventListener("click", () =>
      answer({ type: "digit", value: String(d) }),
    );
    buttons.appendChild(btn);
  }

  const notSureBtn = document.createElement("button");
  notSureBtn.className = "runner-not-sure-btn";
  notSureBtn.textContent = "Not sure";
  notSureBtn.setAttribute(
    "aria-label",
    "Not sure or no digit visible",
  );
  notSureBtn.addEventListener("click", () =>
    answer({ type: "not-sure" }),
  );
  buttons.appendChild(notSureBtn);

  root.appendChild(buttons);
  host.appendChild(root);
  srHeading.focus();

  let busy = false;
  let pendingTimeout: number | null = null;
  let pendingRAF: number | null = null;

  function updateProgressUI(): void {
    const p = progress(session);
    progressLabel.textContent = `Plate ${p.current} of ${p.total}`;
    progressBar.setAttribute("aria-valuenow", String(p.current));
    progressFill.style.width = `${(p.current / p.total) * 100}%`;
    canvas.setAttribute(
      "aria-label",
      `Test plate ${p.current} of ${p.total}. Look for a hidden digit.`,
    );
  }

  function render(): void {
    const item = nextItem(session);
    if (!item) return;
    drawPlate(canvas.getContext("2d")!, item.plate, false);
    updateProgressUI();
  }

  /**
   * After the fade-out finishes, try to render the next plate. If
   * background generation hasn't caught up, poll on each animation
   * frame until it's ready — typically immediate, but covers the edge
   * case where the user answers faster than plates are produced.
   */
  function showNextWhenReady(): void {
    pendingRAF = null;
    if (nextItem(session)) {
      render();
      plateContainer.classList.remove("fading");
      busy = false;
    } else {
      pendingRAF = requestAnimationFrame(showNextWhenReady);
    }
  }

  function answer(choice: Choice): void {
    if (busy) return;
    const item = nextItem(session);
    if (!item) return;
    busy = true;
    recordResponse(session, item, choice);

    if (isComplete(session)) {
      callbacks.onComplete(session);
      return;
    }

    plateContainer.classList.add("fading");
    pendingTimeout = window.setTimeout(() => {
      pendingTimeout = null;
      showNextWhenReady();
    }, TRANSITION_MS);
  }

  // Keyboard shortcuts: 0-9 for digits, "n" or "?" for not-sure.
  const onKeydown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    // Don't trigger if the user is typing in an input or has modifiers.
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

    if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      answer({ type: "digit", value: e.key });
    } else if (e.key === "n" || e.key === "N" || e.key === "?") {
      e.preventDefault();
      answer({ type: "not-sure" });
    }
  };
  document.addEventListener("keydown", onKeydown);

  render();

  return () => {
    if (pendingTimeout !== null) {
      clearTimeout(pendingTimeout);
      pendingTimeout = null;
    }
    if (pendingRAF !== null) {
      cancelAnimationFrame(pendingRAF);
      pendingRAF = null;
    }
    document.removeEventListener("keydown", onKeydown);
    host.removeChild(root);
  };
}
