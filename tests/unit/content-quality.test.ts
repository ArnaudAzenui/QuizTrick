import { expect, it } from "vitest";
import { assessContentQuality } from "@shared/utils/content-quality";
import { parseGeneratedQuiz } from "@backend/services/quiz-generator/parser";

it("detects broken extraction, symbols, and repeated filler", () => {
  for (const text of ["�".repeat(250), "@#$%^&*".repeat(40), "test ".repeat(100), "x".repeat(300)]) {
    expect(assessContentQuality(text).level).toBe("unusable");
  }
});
it("warns about borderline notes without blocking them", () => {
  expect(assessContentQuality("force mass acceleration energy speed velocity distance time ".repeat(5)).level).toBe("warning");
});
it("accepts prose and non-English study notes", () => {
  expect(assessContentQuality("Cells contain a nucleus. Mitochondria provide energy. Ribosomes produce proteins.").level).toBe("ok");
  expect(assessContentQuality("细胞包含细胞核。线粒体通过细胞呼吸产生能量。核糖体负责合成蛋白质。").level).toBe("ok");
});
it("does not reject ordinary equations or vocabulary lists", () => {
  expect(assessContentQuality("F = ma; E = mc²; v = d/t; p = mv; work = force × distance").level).not.toBe("unusable");
});
it("stops unsuitable model responses before accepting questions", () => {
  expect(() => parseGeneratedQuiz(JSON.stringify({ contentStatus: "unsuitable", questions: [] }), { mcq: 4, shortAnswer: 1 })).toThrow("doesn't contain enough clear study information");
});
