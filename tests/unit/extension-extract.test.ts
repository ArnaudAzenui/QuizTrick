// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { extractFromPage } from "../../extension/lib/extract.js";

const fixturesDir = path.resolve(__dirname, "../fixtures/canvas");
const extractPath = path.resolve(__dirname, "../../extension/lib/extract.js");

/** Swaps the whole test document for `html` and moves the URL to `pathname`. */
function loadPage(html: string, pathname = "/") {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.replaceChild(document.importNode(parsed.documentElement, true), document.documentElement);
  window.history.replaceState(null, "", pathname);
}

const loadFixture = (file: string, pathname: string) =>
  loadPage(readFileSync(path.join(fixturesDir, file), "utf8"), pathname);

/** Highlights everything inside the first element matching `selector`. */
function highlight(selector: string) {
  const range = document.createRange();
  range.selectNodeContents(document.querySelector(selector)!);
  window.getSelection()!.removeAllRanges();
  window.getSelection()!.addRange(range);
}

/** A minimal Canvas page: the app root plus whatever goes in the content column. */
const canvasPage = (content: string, title = "Canvas") =>
  `<html><head><title>${title}</title></head><body><div id="application" class="ic-app">` +
  `<div id="left-side"><nav>Home Modules Grades</nav></div>` +
  `<div id="content" role="main">${content}</div>` +
  `<div id="right-side">To Do</div></div></body></html>`;

/** What a tidy body looks like: no blank-line runs, no padded lines, no tabs or double spaces. */
function expectTidy(body: string) {
  expect(body).not.toMatch(/\n{3,}/);
  expect(body).not.toMatch(/^[ \t]|[ \t]$/m);
  expect(body).not.toMatch(/[ \t]{2,}|\t| /);
  expect(body).toBe(body.trim());
}

afterEach(() => window.getSelection()?.removeAllRanges());

describe("extractFromPage — injected with chrome.scripting.executeScript({ func })", () => {
  it("is one self-contained function: rebuilt from its source alone, it still works", () => {
    // What Chrome does: copy the function's source into the tab and call it there.
    const injected = new Function(`return (${extractFromPage.toString()})`)() as typeof extractFromPage;
    loadFixture("page.html", "/courses/1000/pages/week-5");
    expect(injected()).toEqual(extractFromPage());
    expect(injected().kind).toBe("page");
  });

  it("uses no imports, and is the file's only top-level function", () => {
    const source = readFileSync(extractPath, "utf8");
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source.match(/^(export\s+)?(async\s+)?function\s/gm)).toHaveLength(1);
    expect(source.match(/^(export\s+)?(const|let|var|class)\s/gm)).toBeNull();
  });

  it("runs in jsdom, which has no innerText, by falling back to textContent", () => {
    expect("innerText" in document.body).toBe(false);
    loadFixture("assignment.html", "/courses/1000/assignments/3");
    expect(extractFromPage().body.length).toBeGreaterThan(200);
  });
});

describe("extractFromPage — Canvas fixtures", () => {
  it("reads a wiki page: title from h1.page-title, body from .show-content.user_content", () => {
    loadFixture("page.html", "/courses/1000/pages/week-5");
    const result = extractFromPage();

    expect(result.kind).toBe("page");
    expect(result.title).toBe("Responsive Use of AI Tools");
    expect(result.sourceUrl).toBe(`${window.location.origin}/courses/1000/pages/week-5`);
    expect(result.body.split("\n\n").slice(0, 3)).toEqual([
      "Responsive Use of AI Tools",
      "Use of AI Tools",
      "You are welcome—and encouraged—to use AI tools in this course. They can assist with brainstorming ideas, debugging code, improving documentation, and exploring alternative approaches.",
    ]);
    // Bold and italic runs inside a paragraph stay on the paragraph's line.
    expect(result.body).toContain("\n\nFailure to demonstrate understanding may be treated as academic dishonesty (cheating).\n\n");
    expect(result.body).toContain(
      "Using AI to brainstorm project ideas and then refining them with your team.\n\nAsking AI to help debug code you have already written",
    );
    expect(result.body.endsWith("Claiming AI output as your original work when you cannot explain or defend it.")).toBe(true);
    expectTidy(result.body);
  });

  it("leaves out Canvas chrome: course menu, breadcrumbs, View All Pages, module footer, file links", () => {
    loadFixture("page.html", "/courses/1000/pages/week-5");
    const { body } = extractFromPage();
    for (const noise of ["CSC-4900-001-F26", "Announcements", "Tutor.com", "2026 Fall", "View All Pages", "Previous", "Next", "CSC4900-Schedule", "GitHub Link"]) {
      expect(body).not.toContain(noise);
    }
  });

  it("reads an assignment description, without the due date, points list or rubric", () => {
    loadFixture("assignment.html", "/courses/1000/assignments/3");
    const result = extractFromPage();

    expect(result.kind).toBe("assignment");
    expect(result.title).toBe(
      "GROUP PROJECT- PRESENTATION (Final Group Project Presentation Slides: Due Nov 30th & Presentation & Product Demonstration Dec 1st & 3rd)",
    );
    expect(result.body.split("\n\n").slice(0, 3)).toEqual([
      "Submit Final Group Presentation Slides (see the template below)- only one submission for each group",
      "Presentation- Marking Scheme- Group.docx",
      "Final Presentation Slides",
    ]);
    expect(result.body).toContain("Major Acceptance Test Cases\n\ntwo test cases & test results\n\nPossible Future Enhancement");
    expect(result.body.endsWith("Git hub (5 points)\n\nAll (5 points)")).toBe(true);
    // The overview list (due date, points, submission types) and the hidden rubric editor sit outside the description.
    expect(result.body).not.toMatch(/11:59pm|Submitting|Start Assignment|Find a Rubric|Full Marks/);
    expectTidy(result.body);
  });

  it("finds #course_syllabus on a real syllabus page, and moves on to #content when it is empty", () => {
    loadFixture("syllabus.html", "/courses/1000/assignments/syllabus");
    // This course has no syllabus body, so the selector matches an empty element.
    expect(document.querySelector("#course_syllabus")).not.toBeNull();
    expect(document.querySelector("#course_syllabus")!.textContent!.trim()).toBe("");

    const result = extractFromPage();
    expect(result.kind).toBe("content");
    expect(result.title).toBe("Course Syllabus");
    expectTidy(result.body);
  });

  it("skips elements hidden with an inline display: none, as innerText does", () => {
    loadFixture("syllabus.html", "/courses/1000/assignments/syllabus");
    // Canvas keeps its "how to edit the syllabus" help text in a hidden div inside #content.
    expect(document.querySelector("#course_syllabus_details")!.getAttribute("style")).toMatch(/display:\s*none/);
    expect(extractFromPage().body).not.toContain("The syllabus page shows a table-oriented view");

    loadPage(canvasPage('<p>Shown</p><div style="display:none"><p>Hidden</p></div><p style="display: none;">Also hidden</p>'));
    expect(extractFromPage().body).toBe("Shown");
  });
});

describe("extractFromPage — order", () => {
  it("prefers highlighted text over the page, keeping the page title", () => {
    loadFixture("page.html", "/courses/1000/pages/week-5");
    highlight(".show-content.user_content ul");
    const result = extractFromPage();

    expect(result.kind).toBe("selection");
    expect(result.title).toBe("Responsive Use of AI Tools: Advanced Software Project");
    expect(result.body.startsWith("Using AI to brainstorm project ideas and then refining them with your team.")).toBe(true);
    expect(result.body).not.toContain("Use of AI Tools");
  });

  it("ignores a selection that is only whitespace", () => {
    loadFixture("page.html", "/courses/1000/pages/week-5");
    document.querySelector("#content")!.insertAdjacentHTML("beforeend", '<span id="blank">   \n  </span>');
    highlight("#blank");
    expect(extractFromPage().kind).toBe("page");
  });

  it("takes the page body before the assignment, the assignment before the syllabus", () => {
    loadPage(canvasPage(
      '<div id="course_syllabus">Syllabus text</div>' +
      '<div id="assignment_show"><div class="description user_content">Assignment text</div></div>' +
      '<div class="show-content user_content">Page text</div>',
    ));
    expect(extractFromPage()).toMatchObject({ kind: "page", body: "Page text" });

    document.querySelector(".show-content")!.remove();
    expect(extractFromPage()).toMatchObject({ kind: "assignment", body: "Assignment text" });

    document.querySelector("#assignment_show")!.remove();
    expect(extractFromPage()).toMatchObject({ kind: "syllabus", body: "Syllabus text" });
  });

  it("skips an empty page body and moves on to the next place", () => {
    loadPage(canvasPage('<div class="show-content user_content"> <p></p> </div><div id="course_syllabus">Syllabus text</div>'));
    expect(extractFromPage()).toMatchObject({ kind: "syllabus", body: "Syllabus text" });
  });

  it("falls back to the #content column on other Canvas pages, titled by its first heading", () => {
    loadPage(canvasPage(
      '<div class="discussion"><h1 class="discussion-title">Week 6 discussion</h1>' +
      "<p>Compare mitosis and meiosis.</p><p>Reply to two classmates.</p></div>" +
      '<div class="module-sequence-footer"><a>Previous</a><a>Next</a></div>',
    ));
    expect(extractFromPage()).toMatchObject({
      kind: "content",
      title: "Week 6 discussion",
      body: "Week 6 discussion\n\nCompare mitosis and meiosis.\n\nReply to two classmates.",
    });
  });

  it("uses the document title when the page has no heading of its own", () => {
    loadPage(canvasPage('<div class="show-content user_content"><p>Page text</p></div>', "Notes: BIO 1000-01"));
    expect(extractFromPage().title).toBe("Notes: BIO 1000-01");
  });

  it("returns kind none with an empty body when a Canvas page has nothing to read", () => {
    loadPage(canvasPage(""));
    expect(extractFromPage()).toMatchObject({ kind: "none", body: "" });
  });
});

describe("extractFromPage — pages outside Canvas", () => {
  const otherSite =
    '<html><head><title>Mitosis - Example Encyclopedia</title></head><body>' +
    '<main id="content"><div class="show-content user_content"><p id="lead">Mitosis is how one cell divides into two identical cells.</p></div></main></body></html>';

  it("reads nothing but highlighted text, even if the page happens to use Canvas class names", () => {
    loadPage(otherSite, "/wiki/mitosis");
    expect(extractFromPage()).toEqual({
      kind: "none",
      title: "Mitosis - Example Encyclopedia",
      body: "",
      sourceUrl: `${window.location.origin}/wiki/mitosis`,
    });
  });

  it("reads the highlighted text", () => {
    loadPage(otherSite, "/wiki/mitosis");
    highlight("#lead");
    expect(extractFromPage()).toMatchObject({
      kind: "selection",
      title: "Mitosis - Example Encyclopedia",
      body: "Mitosis is how one cell divides into two identical cells.",
    });
  });

  it("returns strings in every field", () => {
    loadPage("<html><head></head><body></body></html>");
    const result = extractFromPage();
    for (const key of ["kind", "title", "body", "sourceUrl"] as const) expect(typeof result[key]).toBe("string");
  });
});
