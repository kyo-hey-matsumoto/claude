import { formatRaffleSerialNumber } from "@livapon/domain";

export type RaffleEntryCsvRow = {
  campaignCode: string;
  serialNumber: number;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  gender: string | null;
  dateOfBirth: Date | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  marketingOptIn: boolean;
  createdAt: Date;
};

const HEADERS = [
  "displayNumber",
  "email",
  "phone",
  "firstName",
  "lastName",
  "gender",
  "dateOfBirth",
  "addressLine1",
  "addressLine2",
  "city",
  "region",
  "postalCode",
  "country",
  "marketingOptIn",
  "createdAt"
];

/** Hands the raffle entry list to an operator for the external drawing system (spec §5, out of scope here). */
export function buildRaffleEntriesCsv(entries: RaffleEntryCsvRow[]): string {
  const rows = entries.map((entry) => [
    formatRaffleSerialNumber(entry.campaignCode, entry.serialNumber),
    entry.email,
    entry.phone ?? "",
    entry.firstName ?? "",
    entry.lastName ?? "",
    entry.gender ?? "",
    entry.dateOfBirth ? entry.dateOfBirth.toISOString().slice(0, 10) : "",
    entry.addressLine1 ?? "",
    entry.addressLine2 ?? "",
    entry.city ?? "",
    entry.region ?? "",
    entry.postalCode ?? "",
    entry.country ?? "",
    entry.marketingOptIn ? "true" : "false",
    entry.createdAt.toISOString()
  ]);

  return [HEADERS, ...rows].map((row) => row.map(escapeCsvField).join(",")).join("\r\n");
}

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
