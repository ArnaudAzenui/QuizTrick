import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TimerProvider } from "@frontend/components/timer/TimerProvider";
import { StudyTimer } from "@frontend/components/timer/StudyTimer";
import { finishSession, MAX_TIMER_MS, timerDisplaySeconds, timerLimitMilliseconds } from "@frontend/components/timer/timer";

describe("timer modes", () => {
  it("offers countdown and stopwatch controls", () => {
    const html = renderToStaticMarkup(<TimerProvider><StudyTimer /></TimerProvider>);
    expect(html).toContain('value="countdown"');
    expect(html).toContain('value="stopwatch"');
    expect(html).toContain("Stopwatch (until stopped)");
  });
  it("counts down to zero without showing negative time", () => {
    expect(timerDisplaySeconds("countdown", 25, 0)).toBe(1500);
    expect(timerDisplaySeconds("countdown", 25, 60)).toBe(1440);
    expect(timerDisplaySeconds("countdown", 25, 1500)).toBe(0);
    expect(timerDisplaySeconds("countdown", 25, 1600)).toBe(0);
  });
  it("keeps counting up in stopwatch mode", () => {
    expect(timerDisplaySeconds("stopwatch", 25, 1600)).toBe(1600);
    expect(timerLimitMilliseconds("stopwatch", 25)).toBe(MAX_TIMER_MS);
  });
  it("sets countdown deadlines and saves the deadline rather than a delayed tick", () => {
    const startTime = "2026-10-19T12:00:00.000Z";
    const limit = timerLimitMilliseconds("countdown", 5);
    const delayedTick = Date.parse(startTime) + limit + 20000;
    const session = finishSession(startTime, Math.min(delayedTick, Date.parse(startTime) + limit), "");
    expect(limit).toBe(300000);
    expect(session.endTime).toBe("2026-10-19T12:05:00.000Z");
  });
});
