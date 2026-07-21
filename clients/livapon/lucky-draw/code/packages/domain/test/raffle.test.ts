import { describe, expect, it } from "vitest";
import { formatRaffleSerialNumber, getRaffleCampaign, getRaffleWindowStatus } from "../src/index.js";

describe("raffle campaign config", () => {
  it("exposes the ca26 campaign with the documented open/close instants", () => {
    const campaign = getRaffleCampaign("ca26");
    expect(campaign).toBeDefined();
    expect(campaign?.opensAt.toISOString()).toBe("2026-08-01T04:00:00.000Z");
    expect(campaign?.closesAt.toISOString()).toBe("2026-08-15T22:00:00.000Z");
    expect(campaign?.serialDigits).toBe(6);
  });

  it("returns undefined for an unknown campaign code", () => {
    expect(getRaffleCampaign("jp27")).toBeUndefined();
  });
});

describe("formatRaffleSerialNumber", () => {
  it("zero-pads the serial number to 6 digits with the campaign prefix", () => {
    expect(formatRaffleSerialNumber("ca26", 123)).toBe("ca26-000123");
  });

  it("does not truncate a serial number wider than the padding", () => {
    expect(formatRaffleSerialNumber("ca26", 1234567)).toBe("ca26-1234567");
  });
});

describe("getRaffleWindowStatus", () => {
  const opensAt = new Date("2026-08-01T04:00:00.000Z");
  const closesAt = new Date("2026-08-15T22:00:00.000Z");

  it("is BEFORE_OPEN before the opening instant", () => {
    expect(getRaffleWindowStatus(new Date("2026-07-31T23:59:59.000Z"), opensAt, closesAt)).toBe("BEFORE_OPEN");
  });

  it("is OPEN at the opening instant (inclusive)", () => {
    expect(getRaffleWindowStatus(opensAt, opensAt, closesAt)).toBe("OPEN");
  });

  it("is OPEN at the closing instant (inclusive)", () => {
    expect(getRaffleWindowStatus(closesAt, opensAt, closesAt)).toBe("OPEN");
  });

  it("is CLOSED after the closing instant", () => {
    expect(getRaffleWindowStatus(new Date("2026-08-15T22:00:01.000Z"), opensAt, closesAt)).toBe("CLOSED");
  });
});
