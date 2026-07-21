import { describe, expect, it } from "vitest";
import { formatCountdownDuration, millisecondsUntil } from "../lib/raffle-countdown";

describe("formatCountdownDuration", () => {
  it("formats days, hours, minutes, and seconds", () => {
    const ms = 2 * 86_400_000 + 3 * 3_600_000 + 4 * 60_000 + 5_000;
    expect(formatCountdownDuration(ms)).toBe("2d 3h 4m 5s");
  });

  it("floors to zero for a non-positive duration", () => {
    expect(formatCountdownDuration(-1000)).toBe("0d 0h 0m 0s");
  });
});

describe("millisecondsUntil", () => {
  it("returns the gap between now and the target instant", () => {
    const target = "2026-08-01T04:00:00.000Z";
    const now = () => new Date("2026-08-01T03:00:00.000Z").getTime();
    expect(millisecondsUntil(target, now)).toBe(3_600_000);
  });

  it("never returns a negative number once the target has passed", () => {
    const target = "2026-08-01T04:00:00.000Z";
    const now = () => new Date("2026-08-01T05:00:00.000Z").getTime();
    expect(millisecondsUntil(target, now)).toBe(0);
  });
});
