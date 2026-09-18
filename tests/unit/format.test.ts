import { describe, expect, it } from "vitest";
import { formatElapsed, formatScore } from "@shared/utils/format";

describe("formatElapsed (FR-7.1 h:mm:ss)", () => {
  it("formats zero and sub-minute values", () => {
    expect(formatElapsed(0)).toBe("0:00:00");
    expect(formatElapsed(59)).toBe("0:00:59");
  });
  it("rolls over minutes and hours", () => {
    expect(formatElapsed(60)).toBe("0:01:00");
    expect(formatElapsed(3599)).toBe("0:59:59");
    expect(formatElapsed(3600)).toBe("1:00:00");
    expect(formatElapsed(36_000 + 61)).toBe("10:01:01");
  });
  it("floors fractional seconds and clamps negatives", () => {
    expect(formatElapsed(12.9)).toBe("0:00:12");
    expect(formatElapsed(-5)).toBe("0:00:00");
  });
});

describe("formatScore", () => {
  it("renders a rounded percent", () => {
    expect(formatScore(80)).toBe("80%");
    expect(formatScore(66.6)).toBe("67%");
  });
});
