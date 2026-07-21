import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { RaffleService } from "../../src/raffle/raffle.service.js";
import type { PrismaService } from "../../src/common/prisma.service.js";
import type { EnvService } from "../../src/common/env.service.js";
import type { RaffleMailer } from "../../src/raffle/raffle-mailer.js";
import type { RaffleShopifySyncService } from "../../src/shopify/raffle-shopify-sync.service.js";

const WITHIN_WINDOW = new Date("2026-08-05T12:00:00.000Z");
const BEFORE_WINDOW = new Date("2026-07-25T12:00:00.000Z");

function makeDeps(config: {
  existingEntry?: Record<string, unknown> | null;
  lastNumber?: number;
  syncResult?: { ok: true; customerId: string } | { ok: false; error: string };
}) {
  const created: Array<Record<string, unknown>> = [];
  const updates: Array<{ where: unknown; data: Record<string, unknown> }> = [];
  let storedEntry: Record<string, unknown> | null = config.existingEntry ?? null;

  const txRaffleEntry = {
    findUnique: vi.fn(async () => config.existingEntry ?? null),
    update: vi.fn(async ({ where, data }: { where: unknown; data: Record<string, unknown> }) => {
      updates.push({ where, data });
      storedEntry = { ...(storedEntry as Record<string, unknown>), ...data };
      return storedEntry;
    }),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      created.push(data);
      storedEntry = { id: "entry_new", ...data };
      return storedEntry;
    })
  };
  const txRaffleCounter = { update: vi.fn(async () => ({})) };

  const prisma = {
    raffleEntry: {
      findFirst: vi.fn(async () => storedEntry),
      findUniqueOrThrow: vi.fn(async () => storedEntry),
      update: vi.fn(async ({ where, data }: { where: unknown; data: Record<string, unknown> }) => {
        updates.push({ where, data });
        storedEntry = { ...(storedEntry as Record<string, unknown>), ...data };
        return storedEntry;
      })
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({
        raffleEntry: txRaffleEntry,
        raffleCounter: txRaffleCounter,
        $executeRawUnsafe: vi.fn(async () => 0),
        $queryRawUnsafe: vi.fn(async () => [{ lastNumber: config.lastNumber ?? 0 }])
      })
    )
  } as unknown as PrismaService;

  const env = {
    isProduction: () => true,
    get: (_name: string, fallback?: string) => fallback
  } as unknown as EnvService;

  const mailer = { sendConfirmation: vi.fn(async () => {}) } as unknown as RaffleMailer;
  const shopifySync = {
    upsertEntry: vi.fn(async () => config.syncResult ?? { ok: true, customerId: "gid://shopify/Customer/1" })
  } as unknown as RaffleShopifySyncService;

  return {
    service: new RaffleService(prisma, env, mailer, shopifySync),
    prisma,
    mailer,
    shopifySync,
    created,
    updates,
    txRaffleEntry
  };
}

describe("RaffleService.join", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("allocates the next serial number, creates the entry, and sends the confirmation email", async () => {
    vi.setSystemTime(WITHIN_WINDOW);
    const { service, created, mailer } = makeDeps({ existingEntry: null, lastNumber: 41 });

    const entry = await service.join("ca26", { email: "Guest@Example.com", privacyConsent: true, marketingOptIn: true });

    expect(created[0]).toMatchObject({ campaignCode: "ca26", serialNumber: 42, email: "guest@example.com", marketingOptIn: true });
    expect(entry).toMatchObject({ serialNumber: 42 });
    expect(mailer.sendConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ email: "guest@example.com", displayNumber: "ca26-000042" })
    );
  });

  it("returns the existing entry idempotently for a repeat email instead of creating a duplicate", async () => {
    vi.setSystemTime(WITHIN_WINDOW);
    const { service, created, txRaffleEntry } = makeDeps({
      existingEntry: { id: "entry_1", campaignCode: "ca26", serialNumber: 7, email: "again@example.com", accessToken: "tok" }
    });

    await service.join("ca26", { email: "again@example.com", privacyConsent: true, marketingOptIn: false });

    expect(created).toHaveLength(0);
    expect(txRaffleEntry.update).toHaveBeenCalled();
  });

  it("rejects joining before the campaign window opens", async () => {
    vi.setSystemTime(BEFORE_WINDOW);
    const { service, prisma } = makeDeps({ existingEntry: null });

    await expect(service.join("ca26", { email: "early@example.com", privacyConsent: true })).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an unknown campaign code", async () => {
    vi.setSystemTime(WITHIN_WINDOW);
    const { service } = makeDeps({ existingEntry: null });

    await expect(service.join("jp27", { email: "x@example.com", privacyConsent: true })).rejects.toThrow(NotFoundException);
  });

  it("records the Shopify sync error on the entry without failing the join", async () => {
    vi.setSystemTime(WITHIN_WINDOW);
    const { service, updates } = makeDeps({
      existingEntry: null,
      lastNumber: 0,
      syncResult: { ok: false, error: "Shopify unavailable" }
    });

    await service.join("ca26", { email: "sync-fail@example.com", privacyConsent: true });

    expect(updates.at(-1)?.data).toMatchObject({ shopifySyncError: "Shopify unavailable" });
  });
});

describe("RaffleService.getByToken", () => {
  it("throws NotFoundException when no entry matches the token", async () => {
    const { service } = makeDeps({ existingEntry: null });
    await expect(service.getByToken("ca26", "missing-token")).rejects.toThrow(NotFoundException);
  });
});

describe("RaffleService.updateProfile", () => {
  it("merges only the provided fields and re-syncs to Shopify", async () => {
    const { service, updates, shopifySync } = makeDeps({
      existingEntry: { id: "entry_1", campaignCode: "ca26", accessToken: "tok", email: "profile@example.com", marketingOptIn: false }
    });

    await service.updateProfile("ca26", "tok", { firstName: "Aki", marketingOptIn: true });

    expect(updates[0].data).toMatchObject({ firstName: "Aki", marketingOptIn: true });
    expect(shopifySync.upsertEntry).toHaveBeenCalled();
  });
});
