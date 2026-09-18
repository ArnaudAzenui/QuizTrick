import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Placeholder } from "@frontend/components/Placeholder";

const props = {
  title: "Create account",
  note: "Registration form posting to /api/auth/register.",
  refs: "FR-1.1, FR-1.2 | WBS 1.4.1.2",
  owner: "Frontend (screens) + Isaiah (API)",
};

afterEach(() => vi.unstubAllEnvs());

describe("Placeholder", () => {
  it("in production shows a neutral 'coming soon' card and NO team notes, names or spec IDs", () => {
    vi.stubEnv("NODE_ENV", "production");
    const html = renderToStaticMarkup(<Placeholder {...props} />);
    expect(html).toContain("Coming soon");
    expect(html).toContain("Create account");
    expect(html).not.toContain("Isaiah");
    expect(html).not.toContain("WBS");
    expect(html).not.toContain("/api/auth/register");
    expect(html).not.toContain("Owner");
  });

  it("in development additionally shows the team notes", () => {
    vi.stubEnv("NODE_ENV", "development");
    const html = renderToStaticMarkup(<Placeholder {...props} />);
    expect(html).toContain("Coming soon");
    expect(html).toContain("Dev notes");
    expect(html).toContain("Isaiah");
    expect(html).toContain("WBS 1.4.1.2");
  });
});
