/**
 * Reads the study text out of the page the student is looking at (I-5).
 *
 * The popup injects this with `chrome.scripting.executeScript({ func: extractFromPage })`.
 * Chrome copies only the function's source into the tab, so everything it
 * needs is declared inside it: no imports, no calls to anything else in this
 * file. tests/unit/extension-extract.test.ts runs it from its source text to
 * keep it that way.
 *
 * Order: highlighted text, then the Canvas page body, the assignment
 * description, the syllabus, then the `#content` column. Outside Canvas (no
 * `#application.ic-app`) only highlighted text is read.
 *
 * `kind` is one of:
 * - "selection"  the student's highlighted text
 * - "page"       a Canvas wiki page
 * - "assignment" an assignment description
 * - "syllabus"   the course syllabus
 * - "content"    the main column of any other Canvas page
 * - "none"       nothing to read (body is "")
 *
 * @returns {{ kind: string, title: string, body: string, sourceUrl: string }}
 */
export function extractFromPage() {
  // Canvas chrome that can sit inside a content column: toolbars, edit links,
  // the Previous/Next module footer.
  const NOISE = [
    "script", "style", "noscript", "template", "button",
    ".screenreader-only", ".hidden", "[hidden]", "[aria-hidden='true']",
    ".header-bar", ".page-toolbar", ".admin-links", ".ic-Action-header",
    ".module-sequence-footer", "#sequence_footer", "#module_navigation_target",
  ].join(", ");
  const BLOCKS = "p, div, li, h1, h2, h3, h4, h5, h6, tr, blockquote, pre, section, article, dt, dd, figcaption";

  const tidy = (text) =>
    String(text ?? "")
      .replace(/\r\n?/g, "\n")
      .replace(/ /g, " ")
      // Canvas appends this after every external link, for screen readers.
      .replace(/\s*Links to an external site\.?/g, "")
      .split("\n")
      .map((line) => line.replace(/[ \t\f\v]+/g, " ").trim())
      .filter(Boolean)
      .join("\n\n");

  const textOf = (element) => {
    // Browsers: innerText follows the rendering (hidden elements are skipped,
    // blocks become line breaks). Drop the lines that come from Canvas chrome.
    if (typeof element.innerText === "string") {
      const noise = new Set();
      element.querySelectorAll(NOISE).forEach((node) => {
        String(node.innerText ?? "").split("\n").forEach((line) => {
          if (line.trim()) noise.add(line.trim());
        });
      });
      return element.innerText
        .split("\n")
        .filter((line) => !noise.has(line.trim()))
        .join("\n");
    }
    // jsdom has no innerText: textContent of a copy, with the chrome and the
    // inline-hidden elements removed (innerText skips those too), and a line
    // break after every block so paragraphs stay apart.
    const copy = element.cloneNode(true);
    copy.querySelectorAll(`${NOISE}, [style*="display: none"], [style*="display:none"]`).forEach((node) => node.remove());
    copy.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
    copy.querySelectorAll("td, th").forEach((node) => node.after("\t")); // cells apart, as innerText does
    copy.querySelectorAll(BLOCKS).forEach((node) => node.after("\n"));
    return copy.textContent;
  };

  const sourceUrl = window.location.href;
  const pageTitle = tidy(document.title).split("\n")[0] ?? "";

  const selection = tidy(window.getSelection?.()?.toString());
  if (selection) return { kind: "selection", title: pageTitle, body: selection, sourceUrl };

  if (!document.querySelector("#application.ic-app")) {
    return { kind: "none", title: pageTitle, body: "", sourceUrl };
  }

  const candidates = [
    { kind: "page", body: ".show-content.user_content", title: "h1.page-title" },
    { kind: "assignment", body: "#assignment_show .description.user_content", title: "#assignment_show h1.title" },
    { kind: "syllabus", body: "#course_syllabus", title: null },
    { kind: "content", body: "#content", title: "#content h1, #content h2" },
  ];
  for (const candidate of candidates) {
    const element = document.querySelector(candidate.body);
    if (!element) continue;
    const body = tidy(textOf(element));
    if (!body) continue; // an empty page: try the next place
    const heading = candidate.title ? document.querySelector(candidate.title) : null;
    const title = (heading && tidy(textOf(heading)).split("\n")[0]) || pageTitle;
    return { kind: candidate.kind, title, body, sourceUrl };
  }

  return { kind: "none", title: pageTitle, body: "", sourceUrl };
}
