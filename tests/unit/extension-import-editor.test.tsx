// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudyTextEditor } from "@frontend/components/texts/StudyTextEditor";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));

/**
 * The editor's side of a Canvas file import, in a real document: the message
 * the extension posts must end up in the same upload the file input uses.
 */
const extracted = "Photosynthesis turns light into chemical energy. ".repeat(8).trim();
const fileMessage = { type: "quiztrick:import-file", name: "Lecture 3.pptx", mimeType: "application/x-test", dataBase64: btoa("PK fake pptx bytes"), sourceUrl: "https://canvas.example/courses/1/files/3" };

let root: Root;
let container: HTMLElement;
let fetchMock: ReturnType<typeof vi.fn>;
let posted: unknown[];

/** Delivers a message the way the browser does for window.postMessage from this page. */
async function receive(data: unknown, from: { origin?: string } = {}) {
  await act(async () => {
    window.dispatchEvent(new MessageEvent("message", { data, origin: from.origin ?? window.location.origin, source: window }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function mount(search: string) {
  window.history.replaceState(null, "", `/texts/new${search}`);
  await act(async () => {
    root.render(<StudyTextEditor />);
  });
}

const field = (id: string) => container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`)!;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  posted = [];
  vi.spyOn(window, "postMessage").mockImplementation((data: unknown) => void posted.push(data));
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { text: extracted } }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("StudyTextEditor receiving a Canvas file", () => {
  it("uploads the file once, fills in the text and title, and tells the extension it arrived", async () => {
    await mount("?from=extension");
    expect(posted).toContainEqual({ type: "quiztrick:import-request" });

    await receive(fileMessage);
    await receive(fileMessage); // both sides speak first, so it can arrive twice

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/texts/extract");
    const sent = (init.body as FormData).get("file") as File;
    expect(sent.name).toBe("Lecture 3.pptx");
    const contents = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsText(sent);
    });
    expect(contents).toBe("PK fake pptx bytes");

    expect(field("body").value).toBe(extracted);
    expect(field("title").value).toBe("Lecture 3");
    expect(container.textContent).toContain("Imported Lecture 3.pptx from Canvas. Review it below before saving.");
    expect(posted.filter((data) => (data as { type: string }).type === "quiztrick:import-received")).toHaveLength(1);
  });

  it("shows the server's message when the document cannot be read, and leaves the form empty", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: false, error: { code: "RATE_LIMITED", message: "You can upload up to 30 documents an hour." } }), { status: 429 }));
    await mount("?from=extension");
    await receive(fileMessage);
    expect(field("body").value).toBe("");
    expect(container.querySelector("[role=alert]")?.textContent).toBe("You can upload up to 30 documents an hour.");
  });

  it("refuses a file type the app does not read, without uploading it", async () => {
    await mount("?from=extension");
    await receive({ ...fileMessage, name: "Lecture 3.ppt" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.querySelector("[role=alert]")?.textContent).toContain(".pptx");
  });

  it("ignores the file when the page was not opened by the extension, or the message is from another site", async () => {
    await mount("");
    await receive(fileMessage);
    expect(fetchMock).not.toHaveBeenCalled();

    await mount("?from=extension");
    await receive(fileMessage, { origin: "https://evil.example" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(field("body").value).toBe("");
  });
});
