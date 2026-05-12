/**
 * Application entry point.
 *
 * Owns the top-level view state machine. Views are independent modules
 * that mount/unmount into the same #app host. The router holds the
 * active TestSession across the running → results transition; views
 * never mutate the session they don't own.
 *
 * Dev-only tooling (calibration runner, results preview with placeholder
 * data) appears as a fixed toolbar when the URL contains `?dev`.
 */

import "./style.css";
import * as introView from "./views/intro";
import * as runnerView from "./views/runner";
import * as resultsView from "./views/results";
import * as exploreView from "./views/explore";
import * as aboutView from "./views/about";
import type { TestSession } from "./test-session";
import {
  newSession,
  generateOneMore,
  generatePlaceholderSession,
} from "./test-session";
import { runCalibration, formatCalibrationReport } from "./calibrate";
import { recordEvent } from "./telemetry";

type View = "intro" | "running" | "results" | "explore" | "about";

const DEV_MODE = new URLSearchParams(window.location.search).has("dev");

const app = document.getElementById("app")!;

let currentSession: TestSession | null = null;
let currentUnmount: (() => void) | null = null;
let cancelGeneration: (() => void) | null = null;

/**
 * Drive `generateOneMore` from a setTimeout(0) loop so plates keep
 * appearing in `session.battery` without blocking the UI. The caller's
 * returned function cancels the loop (used during view transitions).
 */
function startBackgroundGeneration(session: TestSession): () => void {
  let cancelled = false;
  const tick = (): void => {
    if (cancelled) return;
    if (generateOneMore(session)) {
      setTimeout(tick, 0);
    }
  };
  setTimeout(tick, 0);
  return () => {
    cancelled = true;
  };
}

function navigate(next: View, session?: TestSession): void {
  if (currentUnmount) {
    currentUnmount();
    currentUnmount = null;
  }
  if (cancelGeneration) {
    cancelGeneration();
    cancelGeneration = null;
  }
  if (session !== undefined) currentSession = session;

  // Reset scroll on every view change so the user starts at the top.
  window.scrollTo({ top: 0, behavior: "instant" });

  switch (next) {
    case "intro":
      currentUnmount = introView.mount(app, {
        onStart: () => {
          recordEvent("intro_action_start");
          navigate("running", newSession());
        },
        onExplore: () => {
          recordEvent("intro_action_explore");
          navigate("explore");
        },
        onAbout: () => {
          recordEvent("intro_action_about");
          navigate("about");
        },
      });
      break;

    case "running":
      if (!currentSession) {
        navigate("intro");
        return;
      }
      cancelGeneration = startBackgroundGeneration(currentSession);
      currentUnmount = runnerView.mount(app, currentSession, {
        onComplete: (s) => navigate("results", s),
        onExit: () => navigate("intro"),
      });
      break;

    case "results":
      if (!currentSession) {
        navigate("intro");
        return;
      }
      currentUnmount = resultsView.mount(app, currentSession, {
        onRestart: () => {
          recordEvent("restart_clicked");
          navigate("running", newSession());
        },
        onExplore: () => navigate("explore"),
      });
      break;

    case "explore":
      currentUnmount = exploreView.mount(app, {
        onBackToTest: () => navigate("intro"),
        showDevPanel: DEV_MODE,
      });
      break;

    case "about":
      currentUnmount = aboutView.mount(app, {
        onBack: () => navigate("intro"),
      });
      break;
  }
}

navigate("intro");
mountPrivacyFooter();

if (DEV_MODE) {
  setupDevToolbar();
}

/**
 * Render a persistent privacy disclosure at the bottom of the page when
 * telemetry is enabled. Hidden entirely when VITE_TELEMETRY_URL is unset
 * (dev / forks / CI) so we never claim to collect data we aren't.
 */
function mountPrivacyFooter(): void {
  if (!import.meta.env.VITE_TELEMETRY_URL) return;
  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.textContent =
    "This site records anonymous, aggregate counts of test responses to " +
    "help improve the plate-generation algorithm. No personal data, IP " +
    "addresses, cookies, or identifiers are collected or stored.";
  document.body.appendChild(footer);
}

function setupDevToolbar(): void {
  const bar = document.createElement("div");
  bar.className = "dev-toolbar";

  const label = document.createElement("span");
  label.className = "dev-toolbar-label";
  label.textContent = "Dev:";
  bar.appendChild(label);

  const calibBtn = document.createElement("button");
  calibBtn.textContent = "Run calibration";

  const previewBtn = document.createElement("button");
  previewBtn.textContent = "Preview results";
  previewBtn.addEventListener("click", () => {
    navigate("results", generatePlaceholderSession());
  });

  const clearBtn = document.createElement("button");
  clearBtn.textContent = "Clear output";
  clearBtn.className = "hidden";
  clearBtn.setAttribute("aria-label", "Clear calibration output");

  const calibOutput = document.createElement("pre");
  calibOutput.className = "dev-toolbar-output hidden";

  const showOutput = (text: string): void => {
    calibOutput.textContent = text;
    calibOutput.classList.remove("hidden");
    clearBtn.classList.remove("hidden");
  };

  const clearOutput = (): void => {
    calibOutput.textContent = "";
    calibOutput.classList.add("hidden");
    clearBtn.classList.add("hidden");
  };

  clearBtn.addEventListener("click", clearOutput);

  calibBtn.addEventListener("click", () => {
    calibBtn.disabled = true;
    calibBtn.textContent = "Running...";
    showOutput("");
    setTimeout(() => {
      const t0 = performance.now();
      const result = runCalibration();
      const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
      showOutput(formatCalibrationReport(result) + `\n\n(${elapsed}s)`);
      calibBtn.disabled = false;
      calibBtn.textContent = "Run calibration";
    }, 50);
  });

  bar.appendChild(calibBtn);
  bar.appendChild(previewBtn);
  bar.appendChild(clearBtn);
  bar.appendChild(calibOutput);

  document.body.appendChild(bar);
}
