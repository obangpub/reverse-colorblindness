/**
 * About view: explains why this test exists and how it works. Linked
 * from the intro for users who want context beyond the short lede.
 */

const REPO_URL = "https://github.com/obangpub/cvd";

export interface AboutCallbacks {
  onBack: () => void;
}

function makeParagraph(html: string): HTMLParagraphElement {
  const p = document.createElement("p");
  p.innerHTML = html;
  return p;
}

function makeSection(
  title: string,
  ...children: HTMLElement[]
): HTMLElement {
  const section = document.createElement("section");
  const h = document.createElement("h2");
  h.textContent = title;
  section.appendChild(h);
  for (const child of children) section.appendChild(child);
  return section;
}

export function mount(
  host: HTMLElement,
  callbacks: AboutCallbacks,
): () => void {
  const root = document.createElement("div");
  root.className = "view view-about";

  const topBar = document.createElement("div");
  topBar.className = "about-topbar";

  const backBtn = document.createElement("button");
  backBtn.className = "btn-secondary about-back-btn";
  backBtn.textContent = "← Back";
  backBtn.addEventListener("click", callbacks.onBack);
  topBar.appendChild(backBtn);
  root.appendChild(topBar);

  const heading = document.createElement("h1");
  heading.textContent = "About this test";
  heading.tabIndex = -1;
  root.appendChild(heading);

  const lede = document.createElement("p");
  lede.className = "about-lede";
  lede.textContent =
    "Most demonstrations of colorblindness show what a colorblind " +
    "viewer can't see. This test shows what they can see — and that " +
    "typical viewers usually can't. The trick is simple: someone " +
    "missing one kind of cone sees any two colors that differ only " +
    "along the missing axis as identical. The plates hide a digit in " +
    "exactly that kind of color difference.";
  root.appendChild(lede);

  root.appendChild(
    makeSection(
      "Why this might be useful",
      makeParagraph(
        "<strong>Empathy and education.</strong> Sitting with a plate " +
        "you can't read while someone else reads it instantly is a " +
        "useful counterpart to the more familiar direction. For " +
        "designers, teachers, accessibility advocates, and anyone " +
        "curious about how perception varies, the experience tends to " +
        "land harder than reading about it.",
      ),
      makeParagraph(
        "<strong>Self-discovery.</strong> Mild or anomalous color " +
        "vision is common and often goes unnoticed. Reading a plate " +
        "intended for a protan, deutan, or tritan deficiency may be " +
        "the first concrete signal that something in your color " +
        "processing differs from typical.",
      ),
      makeParagraph(
        "<strong>A counterpart to standard plates.</strong> A standard " +
        "plate is easy to fail by saying \"I don't see anything.\" A " +
        "reverse plate flips that: someone who claims colorblindness " +
        "should be able to read the matching plate. The two directions " +
        "together carry more evidence than either alone. Optometry " +
        "uses this property to screen for false claims of CVD in " +
        "occupational and forensic contexts.",
      ),
    ),
  );

  root.appendChild(
    makeSection(
      "What this is not",
      makeParagraph(
        "This is not a diagnostic test. Screens vary widely in how " +
        "they reproduce color, ambient lighting matters, and a handful " +
        "of plates on a webpage cannot substitute for clinical " +
        "instruments like an anomaloscope or the HRR and Farnsworth " +
        "tests. If there is a real reason to know whether you or " +
        "someone in your family has a color vision deficiency, see an " +
        "eye doctor.",
      ),
      makeParagraph(
        "The plates target the dichromat endpoint of each axis — full " +
        "absence of one cone type. Most people who would call " +
        "themselves colorblind are anomalous trichromats, not " +
        "dichromats: they have a weakened cone rather than a missing " +
        "one, and retain partial discrimination on the affected axis. " +
        "Such viewers may read these plates only weakly, or not at " +
        "all, even though their color vision really does differ from " +
        "typical. A negative result here does not rule out a color " +
        "vision deficiency.",
      ),
    ),
  );

  root.appendChild(
    makeSection(
      "How it works",
      makeParagraph(
        "Each plate is a circle of dots. The figure dots and " +
        "background dots are placed on a <em>confusion line</em> — a " +
        "path through color space that one type of colorblindness " +
        "collapses into a single color. Background dots are colored " +
        "along that line, so they merge into one color under simulated " +
        "dichromacy. Figure dots are offset orthogonally to the line, " +
        "so they remain visible after the collapse.",
      ),
      makeParagraph(
        "Simulation uses the Machado, Oliveira, and Fernandes (2009) " +
        "severity-1.0 matrices for protanopia, deuteranopia, and " +
        "tritanopia, applied in linear sRGB. Each matrix has one " +
        "direction in color space it maps to zero — that direction is " +
        "the confusion line for the corresponding deficiency. (In " +
        "linear-algebra terms, it is the matrix's null space.)",
      ),
      makeParagraph(
        "Each plate's color assignment is scored by computing the " +
        "perceptual distance (CIE76 ΔE in CIE Lab) between figure and " +
        "background dots in both the trichromat and simulated-" +
        "dichromat views, and accepted only when the dichromat-to-" +
        "trichromat ratio clears a visibility threshold. Dot layout is " +
        "rejection-sampling circle packing in a circular plate region.",
      ),
    ),
  );

  const source = document.createElement("p");
  source.className = "about-source";
  const link = document.createElement("a");
  link.href = REPO_URL;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Source on GitHub";
  source.appendChild(link);
  root.appendChild(source);

  host.appendChild(root);
  heading.focus();

  return () => {
    host.removeChild(root);
  };
}
