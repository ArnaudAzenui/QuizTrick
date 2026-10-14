import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GeneratePanel } from "@frontend/components/quiz/GeneratePanel";
import { StudyTextEditor } from "@frontend/components/texts/StudyTextEditor";
import { titleFromFileName, validateTextFile } from "@frontend/components/texts/text-file";
import DashboardPage from "@/app/(app)/dashboard/page";
import NewTextPage from "@/app/(app)/texts/new/page";
import TextsPage from "@/app/(app)/texts/page";
import { LIMITS, ROUTES } from "@shared/constants";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));

describe("validateTextFile (FR-2.2, FR-2.3)", () => {
  it("accepts a .txt file within the size limit, whatever the case of the extension", () => {
    expect(validateTextFile({ name: "notes.txt", size: 2048 })).toEqual({ ok: true });
    expect(validateTextFile({ name: "NOTES.TXT", size: LIMITS.TEXT_FILE_MAX_BYTES })).toEqual({ ok: true });
  });

  it("rejects other file types with a message naming the accepted type", () => {
    for (const name of ["notes.pdf", "notes.docx", "notes.txt.exe", "notes"]) {
      const result = validateTextFile({ name, size: 100 });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toContain(".txt");
    }
  });

  it("rejects a file one byte over the limit and states the limit", () => {
    const result = validateTextFile({ name: "big.txt", size: LIMITS.TEXT_FILE_MAX_BYTES + 1 });
    expect(result).toEqual({ ok: false, message: "That file is too large. The limit is 100 KB." });
  });

  it("rejects an empty file", () => {
    expect(validateTextFile({ name: "empty.txt", size: 0 }).ok).toBe(false);
  });
});

describe("titleFromFileName", () => {
  it("drops the extension and respects the title limit", () => {
    expect(titleFromFileName("BIO-110 Chapter 4.txt")).toBe("BIO-110 Chapter 4");
    expect(titleFromFileName(`${"a".repeat(300)}.TXT`)).toHaveLength(LIMITS.TEXT_TITLE_MAX);
  });
});

describe("StudyTextEditor (FR-2.1 - FR-2.5)", () => {
  const html = renderToStaticMarkup(<StudyTextEditor />);

  it("has a labelled paste area and a .txt-only file input", () => {
    expect(html).toMatch(/<textarea[^>]*id="body"/);
    expect(html).toContain('for="body"');
    expect(html).toMatch(/<input[^>]*type="file"[^>]*accept="\.txt,text\/plain"/);
  });

  it("shows the live character count against the maximum and what is still needed", () => {
    expect(html).toContain("0 / 20,000 characters");
    expect(html).toContain(`${LIMITS.TEXT_MIN_CHARS} more needed`);
  });

  it("ties the count to the textarea for screen readers", () => {
    expect(html).toMatch(/<textarea[^>]*aria-describedby="body-count"/);
  });
});

describe("GeneratePanel (FR-3.1, FR-3.2)", () => {
  it("offers 5, 10 and 15 questions with 10 selected and shows the 70/30 mix", () => {
    const html = renderToStaticMarkup(<GeneratePanel textId="00000000-0000-4000-8000-000000000000" />);
    for (const n of LIMITS.QUESTION_COUNTS) expect(html).toContain(`${n} questions`);
    expect(html).toMatch(/<option value="10" selected="">/);
    expect(html).toContain("7 multiple choice and 3 short answer");
    expect(html).toContain("Generate quiz");
    expect(html).not.toContain('role="alert"');
  });

  it("words the heading as a regeneration when quizzes already exist", () => {
    const html = renderToStaticMarkup(<GeneratePanel textId="x" hasQuizzes />);
    expect(html).toContain("Generate another quiz");
  });
});

describe("study text pages", () => {
  it("texts page links to the add page and starts in a loading state", () => {
    const html = renderToStaticMarkup(<TextsPage />);
    expect(html).toContain(`href="${ROUTES.newText}"`);
    expect(html).toContain("Loading your study texts");
    expect(html).not.toContain("Coming soon");
  });

  it("add page renders the editor instead of the placeholder", () => {
    const html = renderToStaticMarkup(<NewTextPage />);
    expect(html).toContain("Save study text");
    expect(html).not.toContain("Coming soon");
  });

  it("dashboard leads with adding text and links the other study tools", () => {
    const html = renderToStaticMarkup(<DashboardPage />);
    expect(html).toContain(`href="${ROUTES.newText}"`);
    for (const href of [ROUTES.texts, ROUTES.tasks, ROUTES.timer, ROUTES.history]) expect(html).toContain(`href="${href}"`);
    expect(html).not.toContain("Coming soon");
  });
});
