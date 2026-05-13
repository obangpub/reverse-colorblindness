/**
 * OG image renderer: composes a 1200×630 image suitable for Open Graph
 * and Twitter Card link previews. A single large plate on the left
 * carries the visual concept; title, tagline, and URL on the right.
 *
 * Invoked via the dev toolbar in main.ts. The resulting PNG is
 * downloaded by the developer and committed to public/og-image.png.
 * Plate selection is non-deterministic — re-roll until visually
 * pleasing, then commit.
 */

import { generateAcceptedPlate, drawPlate } from "./plate";

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 630;

export function renderOGImage(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d")!;

  // Background
  ctx.fillStyle = "#222";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Single large plate on the left as the visual anchor.
  const plateSize = 480;
  const plateX = 60;
  const plateY = (CANVAS_HEIGHT - plateSize) / 2;
  const plate = generateAcceptedPlate({
    size: plateSize,
    deficiency: "deuteranopia",
  });
  const sub = document.createElement("canvas");
  sub.width = plateSize;
  sub.height = plateSize;
  drawPlate(sub.getContext("2d")!, plate, false);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(sub, plateX, plateY);

  // Text stack on the right.
  const textLeft = 600;
  const textRight = 1140;
  const textCenter = (textLeft + textRight) / 2;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Title — two lines for visual balance with the square plate.
  ctx.fillStyle = "#fff";
  ctx.font = "bold 60px system-ui, -apple-system, sans-serif";
  ctx.fillText("Reverse", textCenter, 200);
  ctx.fillText("Ishihara Test", textCenter, 275);

  // Tagline — concrete, search-aligned phrasing.
  ctx.fillStyle = "#bbb";
  ctx.font = "28px system-ui, -apple-system, sans-serif";
  ctx.fillText("Hidden digits, easier to see", textCenter, 365);
  ctx.fillText("if you're colorblind.", textCenter, 405);

  // URL — protocol omitted in display; meta tags carry the full URL.
  ctx.fillStyle = "#888";
  ctx.font = "26px system-ui, -apple-system, sans-serif";
  ctx.fillText("obang.pub/cvd", textCenter, 510);

  return canvas;
}

/**
 * Trigger a download of the rendered OG image. Designed to be wired
 * to a dev-toolbar button. Filename matches public/og-image.png so the
 * developer can drop the download into the repo without renaming.
 */
export function downloadOGImage(): void {
  const canvas = renderOGImage();
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "og-image.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, "image/png");
}
