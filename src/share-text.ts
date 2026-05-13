/**
 * Share text: Wordle-style text representation of the user's results,
 * suitable for copy/paste into social posts.
 *
 * Each plate is a single emoji block: ⚫ for missed, ⚪ for read.
 * Blocks are grouped per axis in rows of 6 with a divider between
 * axes. Encoding is luminance-only (no chromatic distinction) so the
 * share remains legible to viewers with any form of color vision
 * deficiency — the population the test is about.
 */

import type { Axis, Response, TestSession } from "./test-session";

const READ = "⚪";
const MISS = "⚫";
const DIVIDER = "────────────";
const SHARE_URL = "https://obang.pub/cvd/";
const ROW_WIDTH = 6;

function blocksForAxis(responses: readonly Response[]): string {
  const blocks = responses.map((r) => (r.correct ? READ : MISS));
  const rows: string[] = [];
  for (let i = 0; i < blocks.length; i += ROW_WIDTH) {
    rows.push(blocks.slice(i, i + ROW_WIDTH).join(""));
  }
  return rows.join("\n");
}

function axisLabel(axis: Axis, read: number, total: number): string {
  const name = axis === "rg" ? "Red-green" : "Blue-yellow";
  return `${name} ${read}/${total}`;
}

export function formatShareText(session: TestSession): string {
  const rgResponses = session.responses.filter((r) => r.item.axis === "rg");
  const byResponses = session.responses.filter((r) => r.item.axis === "by");
  const rgRead = rgResponses.filter((r) => r.correct).length;
  const byRead = byResponses.filter((r) => r.correct).length;

  return [
    "Reverse Colorblindness Test",
    "",
    axisLabel("rg", rgRead, rgResponses.length),
    blocksForAxis(rgResponses),
    DIVIDER,
    axisLabel("by", byRead, byResponses.length),
    blocksForAxis(byResponses),
    "",
    SHARE_URL,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Copy / native-share actions
// ---------------------------------------------------------------------------

export interface ShareActions {
  /** True if the browser supports navigator.share for plain text. */
  canShareNative: boolean;
  /** Copy the share text to the clipboard. */
  copy: () => Promise<void>;
  /** Open the native share sheet with the text pre-filled. Mobile mostly. */
  shareNative: () => Promise<void>;
}

export function createShareActions(text: string): ShareActions {
  const canShareNative =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function";

  return {
    canShareNative,
    async copy() {
      await navigator.clipboard.writeText(text);
    },
    async shareNative() {
      await navigator.share({
        title: "Reverse Colorblindness Test",
        text,
      });
    },
  };
}
