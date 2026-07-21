import { describe, expect, it } from "vitest";
import { buildRaffleEntriesCsv } from "../../src/operator/raffle-csv.js";

describe("buildRaffleEntriesCsv", () => {
  it("renders a header row and one row per entry with the display number", () => {
    const csv = buildRaffleEntriesCsv([
      {
        campaignCode: "ca26",
        serialNumber: 5,
        email: "guest@example.com",
        phone: "+1-555-0100",
        firstName: "Aki",
        lastName: "Tanaka",
        gender: null,
        dateOfBirth: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        region: null,
        postalCode: null,
        country: null,
        marketingOptIn: true,
        createdAt: new Date("2026-08-05T12:00:00.000Z")
      }
    ]);

    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(
      "displayNumber,email,phone,firstName,lastName,gender,dateOfBirth,addressLine1,addressLine2,city,region,postalCode,country,marketingOptIn,createdAt"
    );
    expect(lines[1]).toBe("ca26-000005,guest@example.com,+1-555-0100,Aki,Tanaka,,,,,,,,,true,2026-08-05T12:00:00.000Z");
  });

  it("quotes fields containing a comma", () => {
    const csv = buildRaffleEntriesCsv([
      {
        campaignCode: "ca26",
        serialNumber: 1,
        email: "a@example.com",
        phone: null,
        firstName: null,
        lastName: null,
        gender: null,
        dateOfBirth: null,
        addressLine1: "123 Main St, Suite 4",
        addressLine2: null,
        city: null,
        region: null,
        postalCode: null,
        country: null,
        marketingOptIn: false,
        createdAt: new Date("2026-08-05T12:00:00.000Z")
      }
    ]);

    expect(csv.split("\r\n")[1]).toContain('"123 Main St, Suite 4"');
  });

  it("returns just the header row for an empty entry list", () => {
    const csv = buildRaffleEntriesCsv([]);
    expect(csv.split("\r\n")).toHaveLength(1);
  });
});
