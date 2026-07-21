# Japan Festival 福引アプリ (campaign ca26) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Japan Festival raffle (campaign `ca26`): a minimal English join form that issues a sequential `ca26-NNNNNN` number, a magic-link confirmation/profile screen, best-effort Shopify customer sync, a stubbed confirmation email, and an operator CSV export — then run it locally end-to-end.

**Architecture:** New module inside the existing monorepo. Pure rules (serial formatting, window status, campaign config) live in `packages/domain`. `packages/db` gets two new Prisma models. `apps/api` gets a public `RaffleController`/`RaffleService`, a Shopify customer-upsert extension to the existing Admin Client, and two new endpoints on the existing `OperatorController`. `apps/web` gets two new public pages under `/raffle/ca26`, a minimal-chrome root layout branch (via a middleware-forwarded pathname header), and one new operator page.

**Tech Stack:** Next.js App Router (React Server Components + Server Actions), NestJS + Prisma + PostgreSQL, class-validator, vitest.

**Spec:** `docs/superpowers/specs/2026-07-21-japan-festival-raffle-design.md`

## Global Constraints

- Campaign code for this round is fixed: `ca26`. Display format: `{campaignCode}-{serialNumber zero-padded to 6 digits}` (e.g. `ca26-000123`).
- Entry window (UTC, both endpoints inclusive): opens `2026-08-01T04:00:00.000Z`, closes `2026-08-15T22:00:00.000Z` (America/Toronto EDT). No timezone library — hardcoded UTC instants.
- Customer-facing copy is English only, using the exact wording in spec §7 (see Task 16/17 for the literal strings).
- Privacy consent checkbox is required, plain text, no link (no privacy policy page exists yet in this repo).
- Marketing opt-in checkbox is separate from privacy consent, unchecked by default (CASL-style explicit opt-in), never required.
- Email delivery is a stub (`ConsoleRaffleMailer` logs instead of sending) — do not add a real email provider in this plan.
- Shopify customer sync is best-effort: a failure must never block an entry from being created or updated. Record failures on the entry row; never throw them to the caller.
- No new git branch — all work happens on the current branch.
- Public raffle endpoints (`/raffle/*`) take no auth guard (anonymous participants). Operator endpoints reuse the existing `AuthGuard` + `RolesGuard("OPERATOR", "ADMIN")` pattern already used by `OperatorController`.
- Business rules (serial formatting, window status) are pure functions in `packages/domain`, framework-free, unit tested there — not inline in NestJS services.

---

## Task 1: Domain — raffle campaign config, serial formatting, window status

**Files:**
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/test/raffle.test.ts`

**Interfaces:**
- Produces: `export type RaffleCampaignConfig = { campaignCode: string; opensAt: Date; closesAt: Date; serialDigits: number }`
- Produces: `export const RAFFLE_CAMPAIGNS: Record<string, RaffleCampaignConfig>`
- Produces: `export function getRaffleCampaign(campaignCode: string): RaffleCampaignConfig | undefined`
- Produces: `export function formatRaffleSerialNumber(campaignCode: string, serialNumber: number, digits = 6): string`
- Produces: `export type RaffleWindowStatus = "BEFORE_OPEN" | "OPEN" | "CLOSED"`
- Produces: `export function getRaffleWindowStatus(now: Date, opensAt: Date, closesAt: Date): RaffleWindowStatus`

- [ ] **Step 1: Write the failing test**

Create `packages/domain/test/raffle.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w packages/domain -- raffle.test.ts`
Expected: FAIL — `formatRaffleSerialNumber`/`getRaffleCampaign`/`getRaffleWindowStatus` are not exported from `../src/index.js`.

- [ ] **Step 3: Write minimal implementation**

Append to the end of `packages/domain/src/index.ts`:

```ts
export type RaffleCampaignConfig = {
  campaignCode: string;
  opensAt: Date;
  closesAt: Date;
  serialDigits: number;
};

// Single fixed campaign for the 2026 LIVAPON Japan Festival raffle (Canada).
// Both instants fall inside DST (America/Toronto, EDT/UTC-4), so they are
// hardcoded as UTC rather than pulled through a timezone library:
// Aug 1 2026 00:00 EDT and Aug 15 2026 18:00 EDT.
export const RAFFLE_CAMPAIGNS: Record<string, RaffleCampaignConfig> = {
  ca26: {
    campaignCode: "ca26",
    opensAt: new Date("2026-08-01T04:00:00.000Z"),
    closesAt: new Date("2026-08-15T22:00:00.000Z"),
    serialDigits: 6
  }
};

export function getRaffleCampaign(campaignCode: string): RaffleCampaignConfig | undefined {
  return RAFFLE_CAMPAIGNS[campaignCode];
}

/** Display-facing raffle number, e.g. formatRaffleSerialNumber("ca26", 123) -> "ca26-000123". */
export function formatRaffleSerialNumber(campaignCode: string, serialNumber: number, digits = 6): string {
  return `${campaignCode}-${String(serialNumber).padStart(digits, "0")}`;
}

export type RaffleWindowStatus = "BEFORE_OPEN" | "OPEN" | "CLOSED";

/** Entries are accepted from opensAt through closesAt, inclusive of both endpoints. */
export function getRaffleWindowStatus(now: Date, opensAt: Date, closesAt: Date): RaffleWindowStatus {
  if (now.getTime() < opensAt.getTime()) {
    return "BEFORE_OPEN";
  }
  if (now.getTime() > closesAt.getTime()) {
    return "CLOSED";
  }
  return "OPEN";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w packages/domain -- raffle.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/index.ts packages/domain/test/raffle.test.ts
git commit -m "feat(domain): add raffle campaign config, serial formatting, window status"
```

---

## Task 2: DB — RaffleCounter / RaffleEntry Prisma models + migration

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create (generated): `packages/db/prisma/migrations/<timestamp>_add_raffle_entries/migration.sql`

**Interfaces:**
- Produces: Prisma models `RaffleCounter` (`campaignCode` PK) and `RaffleEntry` (uuid PK, `@@unique([campaignCode, email])`, `@@unique([campaignCode, serialNumber])`, `@@index([campaignCode])`), used by Task 7 (`RaffleService`) and Task 9 (`OperatorController`, `raffle-csv.ts`).

- [ ] **Step 1: Append the new models**

Add to the end of `packages/db/prisma/schema.prisma`:

```prisma
model RaffleCounter {
  campaignCode String @id
  lastNumber   Int    @default(0)
}

model RaffleEntry {
  id                String    @id @default(uuid()) @db.Uuid
  campaignCode      String
  serialNumber      Int
  accessToken       String    @unique
  email             String
  phone             String?
  firstName         String?
  lastName          String?
  gender            String?
  dateOfBirth       DateTime? @db.Date
  addressLine1      String?
  addressLine2      String?
  city              String?
  region            String?
  postalCode        String?
  country           String?
  privacyConsentAt  DateTime
  marketingOptIn    Boolean   @default(false)
  marketingOptInAt  DateTime?
  shopifyCustomerId String?
  shopifySyncedAt   DateTime?
  shopifySyncError  String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@unique([campaignCode, email])
  @@unique([campaignCode, serialNumber])
  @@index([campaignCode])
}
```

- [ ] **Step 2: Format the schema**

Run: `npm run db:generate -w packages/db -- --schema prisma/schema.prisma` is not needed yet — first run formatting:

```bash
cd packages/db && npx prisma format --schema prisma/schema.prisma && cd ../..
```

Expected: no errors; column alignment in the two new models may be adjusted by the formatter.

- [ ] **Step 3: Start local Postgres if not already running**

```bash
docker compose up -d db
```

Expected: `db` container reports healthy (`docker compose ps` shows `healthy`).

- [ ] **Step 4: Generate and apply the migration**

```bash
DATABASE_URL="postgresql://livapon:livapon@localhost:55432/livapon?schema=public" \
  npm run db:migrate -w packages/db -- --name add_raffle_entries
```

Expected: prompts none (non-interactive), creates `packages/db/prisma/migrations/<timestamp>_add_raffle_entries/migration.sql` with `CREATE TABLE "RaffleCounter"` and `CREATE TABLE "RaffleEntry"` statements, applies it, and regenerates the Prisma client (`@prisma/client` now exposes `prisma.raffleCounter` / `prisma.raffleEntry`).

- [ ] **Step 5: Typecheck the db package**

Run: `npm run typecheck -w packages/db`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations
git commit -m "feat(db): add RaffleCounter and RaffleEntry models"
```

---

## Task 3: API — raffle DTOs

**Files:**
- Create: `apps/api/src/raffle/dto/join-raffle.dto.ts`
- Create: `apps/api/src/raffle/dto/update-raffle-profile.dto.ts`

**Interfaces:**
- Produces: `export class JoinRaffleDto { email: string; privacyConsent: boolean; marketingOptIn?: boolean }`
- Produces: `export class UpdateRaffleProfileDto { phone?, firstName?, lastName?, gender?, dateOfBirth?: string, addressLine1?, addressLine2?, city?, region?, postalCode?, country?, marketingOptIn?: boolean }`
- Consumed by: Task 8 (`RaffleController`), Task 7 (`RaffleService`)

- [ ] **Step 1: Create `join-raffle.dto.ts`**

```ts
import { Equals, IsBoolean, IsEmail, IsOptional, MaxLength } from "class-validator";

export class JoinRaffleDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsBoolean()
  @Equals(true, { message: "privacyConsent must be true" })
  privacyConsent!: boolean;

  @IsOptional()
  @IsBoolean()
  marketingOptIn?: boolean;
}
```

- [ ] **Step 2: Create `update-raffle-profile.dto.ts`**

```ts
import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateRaffleProfileDto {
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @IsString() @MaxLength(200) firstName?: string;
  @IsOptional() @IsString() @MaxLength(200) lastName?: string;
  @IsOptional() @IsString() @MaxLength(50) gender?: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsString() @MaxLength(200) addressLine1?: string;
  @IsOptional() @IsString() @MaxLength(200) addressLine2?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(100) region?: string;
  @IsOptional() @IsString() @MaxLength(20) postalCode?: string;
  @IsOptional() @IsString() @MaxLength(100) country?: string;
  @IsOptional() @IsBoolean() marketingOptIn?: boolean;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck -w apps/api`
Expected: PASS (these files are not imported anywhere yet, but must compile standalone)

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/raffle/dto
git commit -m "feat(api): add raffle join/update DTOs"
```

---

## Task 4: API — RaffleMailer (console stub)

**Files:**
- Create: `apps/api/src/raffle/raffle-mailer.ts`

**Interfaces:**
- Produces: `export type RaffleConfirmationEmail = { email: string; displayNumber: string; entryUrl: string }`
- Produces: `export abstract class RaffleMailer { abstract sendConfirmation(input: RaffleConfirmationEmail): Promise<void> }`
- Produces: `export class ConsoleRaffleMailer extends RaffleMailer`
- Consumed by: Task 7 (`RaffleService`, constructor param typed `RaffleMailer`), Task 10 (`app.module.ts` provider registration `{ provide: RaffleMailer, useClass: ConsoleRaffleMailer }`)

- [ ] **Step 1: Create the file**

```ts
import { Injectable, Logger } from "@nestjs/common";

export type RaffleConfirmationEmail = {
  email: string;
  displayNumber: string;
  entryUrl: string;
};

/**
 * Abstract class (not an interface) so it doubles as a NestJS DI token —
 * swap the real provider later with `{ provide: RaffleMailer, useClass: SomeRealMailer }`
 * in app.module.ts without touching RaffleService.
 */
export abstract class RaffleMailer {
  abstract sendConfirmation(input: RaffleConfirmationEmail): Promise<void>;
}

// No email provider is wired up yet (spec: docs/superpowers/specs/2026-07-21-japan-festival-raffle-design.md §5).
// Logs what a real provider would send so the flow is verifiable end-to-end locally.
@Injectable()
export class ConsoleRaffleMailer extends RaffleMailer {
  private readonly logger = new Logger(ConsoleRaffleMailer.name);

  async sendConfirmation(input: RaffleConfirmationEmail): Promise<void> {
    this.logger.log(
      [
        `To: ${input.email}`,
        "Subject: You're in! Your LIVAPON Japan Festival raffle number",
        "",
        `Your raffle number is ${input.displayNumber}.`,
        "Take a screenshot of this number to keep it handy.",
        "",
        `View or update your entry any time: ${input.entryUrl}`
      ].join("\n")
    );
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck -w apps/api`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/raffle/raffle-mailer.ts
git commit -m "feat(api): add RaffleMailer with console stub implementation"
```

---

## Task 5: API — ShopifyAdminClient customer upsert

**Files:**
- Modify: `apps/api/src/shopify/admin-client.ts`
- Test: `apps/api/test/shopify/admin-client.test.ts`

**Interfaces:**
- Produces: `export type RaffleCustomerInput = { email: string; phone?, firstName?, lastName?, gender?, dateOfBirth?: string, addressLine1?, addressLine2?, city?, region?, postalCode?, country?: string, marketingOptIn: boolean }`
- Produces (method on `ShopifyAdminClient`): `upsertRaffleCustomer(input: RaffleCustomerInput): Promise<string>` — returns the Shopify customer gid, finds-then-updates on an existing email match, otherwise creates.
- Consumed by: Task 6 (`RaffleShopifySyncService`)

- [ ] **Step 1: Write the failing tests**

Add to the end of `apps/api/test/shopify/admin-client.test.ts`, inside the existing `describe("ShopifyAdminClient", ...)` block (before its closing `});`):

```ts
  describe("upsertRaffleCustomer", () => {
    function stubUpsertFetcher(steps: { findResponse: unknown; mutationResponse: unknown }) {
      let graphqlCallIndex = 0;
      return vi.fn(async (url: string) => {
        if (String(url).includes("/admin/oauth/access_token")) {
          return TOKEN_RESPONSE;
        }
        graphqlCallIndex += 1;
        return graphqlCallIndex === 1 ? steps.findResponse : steps.mutationResponse;
      });
    }

    it("creates a new customer when no existing customer matches the email", async () => {
      const fetcher = stubUpsertFetcher({
        findResponse: { ok: true, json: async () => ({ data: { customers: { edges: [] } } }) },
        mutationResponse: {
          ok: true,
          json: async () => ({ data: { customerCreate: { customer: { id: "gid://shopify/Customer/1" }, userErrors: [] } } })
        }
      });
      const client = makeClient(fetcher);

      const customerId = await client.upsertRaffleCustomer({
        email: "guest@example.com",
        marketingOptIn: true
      });

      expect(customerId).toBe("gid://shopify/Customer/1");
      const mutationBody = JSON.parse(fetcher.mock.calls[2][1].body);
      expect(mutationBody.query).toContain("customerCreate");
      expect(mutationBody.variables.input.email).toBe("guest@example.com");
      expect(mutationBody.variables.input.emailMarketingConsent.marketingState).toBe("SUBSCRIBED");
    });

    it("updates the existing customer when the email already matches one", async () => {
      const fetcher = stubUpsertFetcher({
        findResponse: {
          ok: true,
          json: async () => ({ data: { customers: { edges: [{ node: { id: "gid://shopify/Customer/9" } }] } } })
        },
        mutationResponse: {
          ok: true,
          json: async () => ({ data: { customerUpdate: { customer: { id: "gid://shopify/Customer/9" }, userErrors: [] } } })
        }
      });
      const client = makeClient(fetcher);

      const customerId = await client.upsertRaffleCustomer({
        email: "returning@example.com",
        gender: "female",
        dateOfBirth: "1990-01-01",
        marketingOptIn: false
      });

      expect(customerId).toBe("gid://shopify/Customer/9");
      const mutationBody = JSON.parse(fetcher.mock.calls[2][1].body);
      expect(mutationBody.query).toContain("customerUpdate");
      expect(mutationBody.variables.input.id).toBe("gid://shopify/Customer/9");
      expect(mutationBody.variables.input.emailMarketingConsent.marketingState).toBe("NOT_SUBSCRIBED");
      expect(mutationBody.variables.input.metafields).toEqual([
        { namespace: "raffle", key: "gender", type: "single_line_text_field", value: "female" },
        { namespace: "raffle", key: "date_of_birth", type: "date", value: "1990-01-01" }
      ]);
    });

    it("throws with Shopify user errors from the mutation", async () => {
      const fetcher = stubUpsertFetcher({
        findResponse: { ok: true, json: async () => ({ data: { customers: { edges: [] } } }) },
        mutationResponse: {
          ok: true,
          json: async () => ({
            data: { customerCreate: { customer: null, userErrors: [{ field: ["email"], message: "Email has already been taken" }] } }
          })
        }
      });
      const client = makeClient(fetcher);

      await expect(client.upsertRaffleCustomer({ email: "dup@example.com", marketingOptIn: false })).rejects.toThrow(
        "Email has already been taken"
      );
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -w apps/api -- admin-client.test.ts`
Expected: FAIL — `client.upsertRaffleCustomer is not a function`

- [ ] **Step 3: Implement `upsertRaffleCustomer` in `admin-client.ts`**

Add near the other query/mutation constants (after `CREATE_REFUND_MUTATION`, before `REFUNDABLE_TRANSACTION_KIND_PRIORITY`):

```ts
const FIND_CUSTOMER_BY_EMAIL_QUERY = `
query FindCustomerByEmail($query: String!) {
  customers(first: 1, query: $query) {
    edges {
      node {
        id
      }
    }
  }
}
`;

const CUSTOMER_UPSERT_FIELDS = `
    customer {
      id
    }
    userErrors {
      field
      message
    }
`;

const CREATE_CUSTOMER_MUTATION = `
mutation CreateRaffleCustomer($input: CustomerInput!) {
  customerCreate(input: $input) {
${CUSTOMER_UPSERT_FIELDS}
  }
}
`;

const UPDATE_CUSTOMER_MUTATION = `
mutation UpdateRaffleCustomer($input: CustomerInput!) {
  customerUpdate(input: $input) {
${CUSTOMER_UPSERT_FIELDS}
  }
}
`;
```

Add near the other response types (after `type CreateRefundResponse = {...}`):

```ts
type FindCustomerByEmailResponse = {
  data?: { customers?: { edges: Array<{ node: { id: string } }> } };
  errors?: Array<{ message: string }>;
};

type CustomerUpsertResult = { customer?: { id: string } | null; userErrors: Array<{ field?: string[] | null; message: string }> };

type CustomerUpsertResponse = {
  data?: {
    customerCreate?: CustomerUpsertResult;
    customerUpdate?: CustomerUpsertResult;
  };
  errors?: Array<{ message: string }>;
};

export type RaffleCustomerInput = {
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  gender?: string;
  dateOfBirth?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  marketingOptIn: boolean;
};
```

Add two methods inside the `ShopifyAdminClient` class (after `createRefund`, before `private async getAccessToken()`):

```ts
  /**
   * Upserts a raffle entrant as a Shopify customer for later marketing use
   * (spec §5). Standard fields map to native customer fields; gender/date of
   * birth have no native customer field so they are stored as `raffle`
   * namespace metafields. Never called from inside a DB transaction — callers
   * treat this as a slow, best-effort side effect (see RaffleShopifySyncService).
   */
  async upsertRaffleCustomer(input: RaffleCustomerInput): Promise<string> {
    const existingId = await this.findCustomerIdByEmail(input.email);
    const customerInput = this.buildRaffleCustomerInput(input, existingId);

    const mutation = existingId ? UPDATE_CUSTOMER_MUTATION : CREATE_CUSTOMER_MUTATION;
    const payload = await this.request<CustomerUpsertResponse>(mutation, { input: customerInput });
    const result = existingId ? payload.data?.customerUpdate : payload.data?.customerCreate;

    if (result?.userErrors.length) {
      throw new Error(result.userErrors.map((error) => error.message).join(", "));
    }
    if (!result?.customer) {
      throw new Error("Shopify Admin customer upsert did not return a customer");
    }
    return result.customer.id;
  }

  private async findCustomerIdByEmail(email: string): Promise<string | null> {
    const payload = await this.request<FindCustomerByEmailResponse>(FIND_CUSTOMER_BY_EMAIL_QUERY, {
      query: `email:${JSON.stringify(email)}`
    });
    return payload.data?.customers?.edges[0]?.node.id ?? null;
  }

  private buildRaffleCustomerInput(input: RaffleCustomerInput, existingId: string | null) {
    const metafields = [
      input.gender ? { namespace: "raffle", key: "gender", type: "single_line_text_field", value: input.gender } : null,
      input.dateOfBirth ? { namespace: "raffle", key: "date_of_birth", type: "date", value: input.dateOfBirth } : null
    ].filter((metafield): metafield is NonNullable<typeof metafield> => metafield !== null);

    return {
      id: existingId ?? undefined,
      email: input.email,
      phone: input.phone,
      firstName: input.firstName,
      lastName: input.lastName,
      addresses:
        input.addressLine1 || input.city
          ? [
              {
                address1: input.addressLine1,
                address2: input.addressLine2,
                city: input.city,
                province: input.region,
                zip: input.postalCode,
                country: input.country
              }
            ]
          : undefined,
      emailMarketingConsent: {
        marketingState: input.marketingOptIn ? "SUBSCRIBED" : "NOT_SUBSCRIBED",
        marketingOptInLevel: "SINGLE_OPT_IN",
        consentUpdatedAt: new Date().toISOString()
      },
      metafields: metafields.length ? metafields : undefined
    };
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -w apps/api -- admin-client.test.ts`
Expected: PASS (all tests in the file, including the pre-existing ones)

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck -w apps/api`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/shopify/admin-client.ts apps/api/test/shopify/admin-client.test.ts
git commit -m "feat(api): add Shopify customer upsert for raffle entrants"
```

---

## Task 6: API — RaffleShopifySyncService (best-effort wrapper)

**Files:**
- Create: `apps/api/src/shopify/raffle-shopify-sync.service.ts`

**Interfaces:**
- Consumes: `ShopifyAdminClient.upsertRaffleCustomer` (Task 5), `EnvService.get` (existing)
- Produces: `export type RaffleEntryForSync = { email: string; phone: string | null; firstName: string | null; lastName: string | null; gender: string | null; dateOfBirth: Date | null; addressLine1: string | null; addressLine2: string | null; city: string | null; region: string | null; postalCode: string | null; country: string | null; marketingOptIn: boolean }`
- Produces: `export type RaffleSyncResult = { ok: true; customerId: string } | { ok: false; error: string }`
- Produces: `export class RaffleShopifySyncService { upsertEntry(entry: RaffleEntryForSync): Promise<RaffleSyncResult> }`
- Consumed by: Task 7 (`RaffleService`)

No dedicated unit test for this file — matches the existing convention for `ShopifyRefundService` (also constructs `ShopifyAdminClient` internally from env and has no standalone test file; consumers mock the whole service). It is exercised indirectly by Task 7's `RaffleService` tests, which mock this service entirely.

- [ ] **Step 1: Create the file**

```ts
import { Injectable, Logger } from "@nestjs/common";
import { EnvService } from "../common/env.service.js";
import { ShopifyAdminClient } from "./admin-client.js";

export type RaffleEntryForSync = {
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
};

export type RaffleSyncResult = { ok: true; customerId: string } | { ok: false; error: string };

/**
 * Best-effort Shopify customer sync for raffle entrants (spec §5). Never
 * throws — a Shopify outage or credential issue must not block raffle
 * participation; failures are reported back to the caller to record on the
 * entry instead (RaffleEntry.shopifySyncError).
 */
@Injectable()
export class RaffleShopifySyncService {
  private readonly logger = new Logger(RaffleShopifySyncService.name);

  constructor(private readonly env: EnvService) {}

  async upsertEntry(entry: RaffleEntryForSync): Promise<RaffleSyncResult> {
    try {
      // SHOPIFY_ADMIN_API_CLIENT_ID/SECRET are intentionally NOT boot-required
      // (matches ShopifyRefundService): if unset, the token exchange fails and
      // this method catches it below rather than crashing the API.
      const client = new ShopifyAdminClient({
        storeDomain: this.env.get("SHOPIFY_STORE_DOMAIN", "livapon-dev.myshopify.com") as string,
        clientId: this.env.get("SHOPIFY_ADMIN_API_CLIENT_ID", "dev-shopify-admin-client-id") as string,
        clientSecret: this.env.get("SHOPIFY_ADMIN_API_CLIENT_SECRET", "dev-shopify-admin-client-secret") as string,
        apiVersion: this.env.get("SHOPIFY_ADMIN_API_VERSION", "2026-04") as string
      });

      const customerId = await client.upsertRaffleCustomer({
        email: entry.email,
        phone: entry.phone ?? undefined,
        firstName: entry.firstName ?? undefined,
        lastName: entry.lastName ?? undefined,
        gender: entry.gender ?? undefined,
        dateOfBirth: entry.dateOfBirth ? entry.dateOfBirth.toISOString().slice(0, 10) : undefined,
        addressLine1: entry.addressLine1 ?? undefined,
        addressLine2: entry.addressLine2 ?? undefined,
        city: entry.city ?? undefined,
        region: entry.region ?? undefined,
        postalCode: entry.postalCode ?? undefined,
        country: entry.country ?? undefined,
        marketingOptIn: entry.marketingOptIn
      });

      return { ok: true, customerId };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Shopify customer sync failed for raffle entry: ${message}`);
      return { ok: false, error: message };
    }
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck -w apps/api`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/shopify/raffle-shopify-sync.service.ts
git commit -m "feat(api): add best-effort Shopify sync wrapper for raffle entries"
```

---

## Task 7: API — RaffleService (join / getByToken / updateProfile)

**Files:**
- Create: `apps/api/src/raffle/raffle.service.ts`
- Test: `apps/api/test/raffle/raffle-service.test.ts`

**Interfaces:**
- Consumes: `getRaffleCampaign`, `getRaffleWindowStatus`, `formatRaffleSerialNumber` (Task 1), `PrismaService` (existing, now with `raffleEntry`/`raffleCounter` from Task 2), `EnvService.isProduction`/`.get` (existing), `RaffleMailer.sendConfirmation` (Task 4), `RaffleShopifySyncService.upsertEntry` (Task 6), `JoinRaffleDto`/`UpdateRaffleProfileDto` (Task 3)
- Produces: `export class RaffleService { join(campaignCode: string, dto: JoinRaffleDto): Promise<RaffleEntry>; getByToken(campaignCode: string, token: string): Promise<RaffleEntry>; updateProfile(campaignCode: string, token: string, dto: UpdateRaffleProfileDto): Promise<RaffleEntry> }` (return type is the Prisma `RaffleEntry` row)
- Consumed by: Task 8 (`RaffleController`)

- [ ] **Step 1: Write the failing tests**

Create `apps/api/test/raffle/raffle-service.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -w apps/api -- raffle-service.test.ts`
Expected: FAIL — cannot find module `../../src/raffle/raffle.service.js`

- [ ] **Step 3: Implement `raffle.service.ts`**

Create `apps/api/src/raffle/raffle.service.ts`:

```ts
import { randomBytes } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { formatRaffleSerialNumber, getRaffleCampaign, getRaffleWindowStatus, type RaffleCampaignConfig } from "@livapon/domain";
import { PrismaService } from "../common/prisma.service.js";
import { EnvService } from "../common/env.service.js";
import { RaffleMailer } from "./raffle-mailer.js";
import { RaffleShopifySyncService } from "../shopify/raffle-shopify-sync.service.js";
import type { JoinRaffleDto } from "./dto/join-raffle.dto.js";
import type { UpdateRaffleProfileDto } from "./dto/update-raffle-profile.dto.js";

@Injectable()
export class RaffleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly env: EnvService,
    private readonly mailer: RaffleMailer,
    private readonly shopifySync: RaffleShopifySyncService
  ) {}

  async join(campaignCode: string, dto: JoinRaffleDto) {
    const campaign = this.requireCampaign(campaignCode);
    if (this.resolveWindowStatus(campaign) !== "OPEN") {
      throw new BadRequestException("Raffle entries are not open for this campaign");
    }

    const email = dto.email.trim().toLowerCase();
    const now = new Date();

    const entry = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.raffleEntry.findUnique({
        where: { campaignCode_email: { campaignCode, email } }
      });
      if (existing) {
        // Resubmitting the same email is idempotent, but consent is always
        // refreshed to the latest submitted values (spec §5).
        return tx.raffleEntry.update({
          where: { id: existing.id },
          data: {
            privacyConsentAt: now,
            marketingOptIn: dto.marketingOptIn ?? false,
            marketingOptInAt: dto.marketingOptIn ? now : existing.marketingOptInAt
          }
        });
      }

      await tx.$executeRawUnsafe(
        'INSERT INTO "RaffleCounter" ("campaignCode","lastNumber") VALUES ($1, 0) ON CONFLICT ("campaignCode") DO NOTHING',
        campaignCode
      );
      const rows = await tx.$queryRawUnsafe<Array<{ lastNumber: number }>>(
        'SELECT "lastNumber" FROM "RaffleCounter" WHERE "campaignCode" = $1 FOR UPDATE',
        campaignCode
      );
      const nextNumber = (rows[0]?.lastNumber ?? 0) + 1;
      await tx.raffleCounter.update({ where: { campaignCode }, data: { lastNumber: nextNumber } });

      return tx.raffleEntry.create({
        data: {
          campaignCode,
          serialNumber: nextNumber,
          accessToken: randomBytes(24).toString("hex"),
          email,
          privacyConsentAt: now,
          marketingOptIn: dto.marketingOptIn ?? false,
          marketingOptInAt: dto.marketingOptIn ? now : null
        }
      });
    });

    await this.mailer.sendConfirmation({
      email: entry.email,
      displayNumber: formatRaffleSerialNumber(entry.campaignCode, entry.serialNumber, campaign.serialDigits),
      entryUrl: this.buildEntryUrl(campaignCode, entry.accessToken)
    });

    await this.syncToShopify(entry.id);

    return entry;
  }

  async getByToken(campaignCode: string, token: string) {
    const entry = await this.prisma.raffleEntry.findFirst({ where: { campaignCode, accessToken: token } });
    if (!entry) {
      throw new NotFoundException("Raffle entry not found");
    }
    return entry;
  }

  async updateProfile(campaignCode: string, token: string, dto: UpdateRaffleProfileDto) {
    const entry = await this.getByToken(campaignCode, token);
    const now = new Date();

    const updated = await this.prisma.raffleEntry.update({
      where: { id: entry.id },
      data: {
        ...dto,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        marketingOptIn: dto.marketingOptIn ?? entry.marketingOptIn,
        marketingOptInAt: dto.marketingOptIn ? now : entry.marketingOptInAt
      }
    });

    await this.syncToShopify(updated.id);
    return updated;
  }

  private async syncToShopify(entryId: string) {
    const entry = await this.prisma.raffleEntry.findUniqueOrThrow({ where: { id: entryId } });
    const result = await this.shopifySync.upsertEntry(entry);
    await this.prisma.raffleEntry.update({
      where: { id: entryId },
      data: result.ok
        ? { shopifyCustomerId: result.customerId, shopifySyncedAt: new Date(), shopifySyncError: null }
        : { shopifySyncError: result.error }
    });
  }

  private requireCampaign(campaignCode: string): RaffleCampaignConfig {
    const campaign = getRaffleCampaign(campaignCode);
    if (!campaign) {
      throw new NotFoundException(`Unknown raffle campaign: ${campaignCode}`);
    }
    return campaign;
  }

  // Local/staging convenience: preview the OPEN state without waiting for the
  // real campaign window. Never active in production (EnvService.isProduction).
  private resolveWindowStatus(campaign: RaffleCampaignConfig) {
    if (!this.env.isProduction() && process.env.RAFFLE_PREVIEW_FORCE_OPEN === "true") {
      return "OPEN" as const;
    }
    return getRaffleWindowStatus(new Date(), campaign.opensAt, campaign.closesAt);
  }

  private buildEntryUrl(campaignCode: string, token: string) {
    const base = this.env.get("APP_BASE_URL", "http://localhost:3100");
    return `${base}/raffle/${campaignCode}/entry/${token}`;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -w apps/api -- raffle-service.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck -w apps/api`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/raffle/raffle.service.ts apps/api/test/raffle/raffle-service.test.ts
git commit -m "feat(api): add RaffleService (join, lookup, profile update)"
```

---

## Task 8: API — RaffleController (public endpoints)

**Files:**
- Create: `apps/api/src/raffle/raffle.controller.ts`

**Interfaces:**
- Consumes: `RaffleService` (Task 7), `getRaffleCampaign`/`formatRaffleSerialNumber` (Task 1)
- Produces: HTTP routes `POST /raffle/:campaignCode/entries`, `GET /raffle/:campaignCode/entries/:token`, `PATCH /raffle/:campaignCode/entries/:token`, each returning `{ campaignCode, serialNumber, displayNumber, accessToken, email, phone, firstName, lastName, gender, dateOfBirth, addressLine1, addressLine2, city, region, postalCode, country, marketingOptIn }` (`dateOfBirth` as `YYYY-MM-DD` string or `null`)
- Consumed by: Task 10 (`app.module.ts`), Task 16/17 (web pages, via `apiFetch`)

- [ ] **Step 1: Create the file**

```ts
import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { formatRaffleSerialNumber, getRaffleCampaign } from "@livapon/domain";
import { RaffleService } from "./raffle.service.js";
import { JoinRaffleDto } from "./dto/join-raffle.dto.js";
import { UpdateRaffleProfileDto } from "./dto/update-raffle-profile.dto.js";

type RaffleEntryRecord = {
  campaignCode: string;
  serialNumber: number;
  accessToken: string;
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
};

// No @UseGuards: raffle participants are anonymous festival guests, not
// LIVAPON accounts (spec §5).
@Controller("raffle")
export class RaffleController {
  constructor(private readonly raffle: RaffleService) {}

  @Post(":campaignCode/entries")
  async join(@Param("campaignCode") campaignCode: string, @Body() body: JoinRaffleDto) {
    const entry = await this.raffle.join(campaignCode, body);
    return this.toResponse(entry);
  }

  @Get(":campaignCode/entries/:token")
  async getEntry(@Param("campaignCode") campaignCode: string, @Param("token") token: string) {
    const entry = await this.raffle.getByToken(campaignCode, token);
    return this.toResponse(entry);
  }

  @Patch(":campaignCode/entries/:token")
  async updateEntry(
    @Param("campaignCode") campaignCode: string,
    @Param("token") token: string,
    @Body() body: UpdateRaffleProfileDto
  ) {
    const entry = await this.raffle.updateProfile(campaignCode, token, body);
    return this.toResponse(entry);
  }

  private toResponse(entry: RaffleEntryRecord) {
    const campaign = getRaffleCampaign(entry.campaignCode);
    return {
      campaignCode: entry.campaignCode,
      serialNumber: entry.serialNumber,
      displayNumber: formatRaffleSerialNumber(entry.campaignCode, entry.serialNumber, campaign?.serialDigits ?? 6),
      accessToken: entry.accessToken,
      email: entry.email,
      phone: entry.phone,
      firstName: entry.firstName,
      lastName: entry.lastName,
      gender: entry.gender,
      dateOfBirth: entry.dateOfBirth ? entry.dateOfBirth.toISOString().slice(0, 10) : null,
      addressLine1: entry.addressLine1,
      addressLine2: entry.addressLine2,
      city: entry.city,
      region: entry.region,
      postalCode: entry.postalCode,
      country: entry.country,
      marketingOptIn: entry.marketingOptIn
    };
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck -w apps/api`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/raffle/raffle.controller.ts
git commit -m "feat(api): add public RaffleController"
```

---

## Task 9: API — Operator raffle list + CSV export

**Files:**
- Create: `apps/api/src/operator/raffle-csv.ts`
- Test: `apps/api/test/operator/raffle-csv.test.ts`
- Modify: `apps/api/src/operator/operator.controller.ts`

**Interfaces:**
- Produces: `export function buildRaffleEntriesCsv(entries: RaffleEntryCsvRow[]): string`
- Produces (new routes on `OperatorController`, guarded by existing `AuthGuard`+`RolesGuard("OPERATOR","ADMIN")`): `GET /operator/raffle/:campaignCode/entries`, `GET /operator/raffle/:campaignCode/entries.csv`
- Consumed by: Task 18 (web operator page + CSV route handler)

- [ ] **Step 1: Write the failing test**

Create `apps/api/test/operator/raffle-csv.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/api -- raffle-csv.test.ts`
Expected: FAIL — cannot find module `../../src/operator/raffle-csv.js`

- [ ] **Step 3: Implement `raffle-csv.ts`**

Create `apps/api/src/operator/raffle-csv.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w apps/api -- raffle-csv.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Wire the two new routes into `OperatorController`**

In `apps/api/src/operator/operator.controller.ts`, add to the imports at the top:

```ts
import { Body, Controller, Get, Header, Param, Post, Put, UseGuards } from "@nestjs/common";
import { buildRaffleEntriesCsv } from "./raffle-csv.js";
```

(This replaces the existing `import { Body, Controller, Get, Param, Post, Put, UseGuards } from "@nestjs/common";` line — only `Header` is newly added.)

Add these two methods inside the `OperatorController` class, after `listProductMappings()`:

```ts
  @Get("raffle/:campaignCode/entries")
  listRaffleEntries(@Param("campaignCode") campaignCode: string) {
    return this.prisma.raffleEntry.findMany({ where: { campaignCode }, orderBy: { serialNumber: "asc" } });
  }

  @Get("raffle/:campaignCode/entries.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="raffle-entries.csv"')
  async exportRaffleEntriesCsv(@Param("campaignCode") campaignCode: string) {
    const entries = await this.prisma.raffleEntry.findMany({ where: { campaignCode }, orderBy: { serialNumber: "asc" } });
    return buildRaffleEntriesCsv(entries);
  }
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck -w apps/api`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/operator/raffle-csv.ts apps/api/test/operator/raffle-csv.test.ts apps/api/src/operator/operator.controller.ts
git commit -m "feat(api): add operator raffle entries list and CSV export"
```

---

## Task 10: API — register the raffle module in AppModule

**Files:**
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/raffle/raffle-controller.e2e.test.ts`

**Interfaces:**
- Consumes: `RaffleController` (Task 8), `RaffleService` (Task 7), `RaffleMailer`/`ConsoleRaffleMailer` (Task 4), `RaffleShopifySyncService` (Task 6)

- [ ] **Step 1: Write the failing e2e test**

Create `apps/api/test/raffle/raffle-controller.e2e.test.ts`:

```ts
import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../../src/app.module.js";
import { RaffleController } from "../../src/raffle/raffle.controller.js";
import { RaffleService } from "../../src/raffle/raffle.service.js";
import { globalValidationPipeProvider } from "../../src/common/validation.js";

describe("raffle wiring", () => {
  it("AppModule registers RaffleController", () => {
    const controllers: unknown[] = Reflect.getMetadata("controllers", AppModule) ?? [];
    expect(controllers).toContain(RaffleController);
  });

  describe("on the wire", () => {
    let app: INestApplication;
    const join = vi.fn(async () => ({
      campaignCode: "ca26",
      serialNumber: 1,
      accessToken: "tok_1",
      email: "guest@example.com",
      phone: null,
      firstName: null,
      lastName: null,
      gender: null,
      dateOfBirth: null,
      addressLine1: null,
      addressLine2: null,
      city: null,
      region: null,
      postalCode: null,
      country: null,
      marketingOptIn: false
    }));

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        controllers: [RaffleController],
        providers: [globalValidationPipeProvider, { provide: RaffleService, useValue: { join } }]
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it("accepts a valid join body and passes only whitelisted properties to the service", async () => {
      await request(app.getHttpServer())
        .post("/raffle/ca26/entries")
        .send({ email: "guest@example.com", privacyConsent: true, marketingOptIn: true })
        .expect(201);

      expect(join).toHaveBeenCalledWith(
        "ca26",
        expect.objectContaining({ email: "guest@example.com", privacyConsent: true, marketingOptIn: true })
      );
    });

    it("rejects a join body missing privacyConsent", async () => {
      await request(app.getHttpServer()).post("/raffle/ca26/entries").send({ email: "guest@example.com" }).expect(400);
    });

    it("rejects unknown body properties", async () => {
      await request(app.getHttpServer())
        .post("/raffle/ca26/entries")
        .send({ email: "guest@example.com", privacyConsent: true, isWinner: true })
        .expect(400);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/api -- raffle-controller.e2e.test.ts`
Expected: FAIL — `RaffleController`/`RaffleService` modules don't exist yet from `AppModule`'s perspective (first assertion fails: not registered)

- [ ] **Step 3: Register everything in `app.module.ts`**

Add these imports to `apps/api/src/app.module.ts` (alongside the existing ones):

```ts
import { RaffleController } from "./raffle/raffle.controller.js";
import { RaffleService } from "./raffle/raffle.service.js";
import { RaffleMailer, ConsoleRaffleMailer } from "./raffle/raffle-mailer.js";
import { RaffleShopifySyncService } from "./shopify/raffle-shopify-sync.service.js";
```

Add `RaffleController` to the `controllers` array, and add these to the `providers` array:

```ts
    RaffleService,
    { provide: RaffleMailer, useClass: ConsoleRaffleMailer },
    RaffleShopifySyncService,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w apps/api -- raffle-controller.e2e.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Run the full API test suite**

Run: `npm run test -w apps/api`
Expected: PASS (all tests, including every pre-existing test file)

- [ ] **Step 6: Typecheck and build**

Run: `npm run typecheck -w apps/api && npm run build -w apps/api`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/app.module.ts apps/api/test/raffle/raffle-controller.e2e.test.ts
git commit -m "feat(api): register raffle module in AppModule"
```

---

## Task 11: Web — apiFetch refactor to support raw text responses (CSV)

**Files:**
- Modify: `apps/web/lib/api.ts`

**Interfaces:**
- Produces: `export async function apiFetchText(path: string, init?: RequestInit): Promise<string>` (alongside the existing `apiFetch<T>`)
- Consumed by: Task 18 (operator CSV route handler)

- [ ] **Step 1: Refactor `apiFetch` to share its auth/fetch logic**

Replace the body of `apps/web/lib/api.ts` from `export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {` through the end of that function with:

```ts
async function buildAuthHeaders(): Promise<Record<string, string>> {
  try {
    const store = await cookies();
    const raw = store.get(SESSION_COOKIE_NAME)?.value;
    const session = raw ? await readSessionValue(raw) : null;
    if (session) {
      try {
        const token = await mintApiToken(session);
        return { authorization: `Bearer ${token}` };
      } catch (error) {
        // A valid session exists but minting the API token failed (e.g. WEB_API_JWT_SECRET unset).
        // Fail safe (proceed unauthenticated) but surface the misconfiguration instead of hiding it as a 401.
        console.warn("apiFetch: failed to mint API token for an authenticated session", error);
      }
    }
  } catch {
    // proceed unauthenticated (public pages must still render)
  }
  return {};
}

async function rawApiFetch(path: string, init?: RequestInit): Promise<Response> {
  const baseUrl =
    process.env.INTERNAL_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
  const authHeaders = await buildAuthHeaders();

  const response = await fetch(`${baseUrl}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      "content-type": "application/json",
      ...authHeaders,
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, `API ${path} failed: ${response.status} ${text}`);
  }

  return response;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await rawApiFetch(path, init);
  return response.json() as Promise<T>;
}

export async function apiFetchText(path: string, init?: RequestInit): Promise<string> {
  const response = await rawApiFetch(path, init);
  return response.text();
}
```

- [ ] **Step 2: Run the existing web test suite (regression check)**

Run: `npm run test -w apps/web`
Expected: PASS (no test exercises `apiFetch` directly today, but this confirms nothing else broke)

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck -w apps/web`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/api.ts
git commit -m "refactor(web): extract apiFetch's fetch/auth core, add apiFetchText"
```

---

## Task 12: Web — middleware forwards the request pathname

**Files:**
- Create: `apps/web/lib/pathname-header.ts`
- Modify: `apps/web/middleware.ts`
- Modify: `apps/web/test/middleware.test.ts`

**Interfaces:**
- Produces: `export const PATHNAME_HEADER = "x-livapon-pathname"` (in `lib/pathname-header.ts`)
- Produces: `export function buildForwardedRequestHeaders(request: NextRequest): Headers` (in `middleware.ts`)
- Consumed by: Task 13 (root layout reads the header via `next/headers`)

- [ ] **Step 1: Write the failing test**

Add to `apps/web/test/middleware.test.ts`, after the existing imports:

```ts
import { PATHNAME_HEADER } from "../lib/pathname-header";
import { buildForwardedRequestHeaders } from "../middleware";
```

Add a new top-level `describe` block at the end of the file:

```ts
describe("middleware — pathname forwarding", () => {
  it("sets the pathname header for the root layout to read", () => {
    const request = new NextRequest("https://livapon.example.com/raffle/ca26");
    const headers = buildForwardedRequestHeaders(request);
    expect(headers.get(PATHNAME_HEADER)).toBe("/raffle/ca26");
  });

  it("preserves the request's existing headers alongside the new one", () => {
    const request = new NextRequest("https://livapon.example.com/me", { headers: { "x-forwarded-for": "203.0.113.9" } });
    const headers = buildForwardedRequestHeaders(request);
    expect(headers.get("x-forwarded-for")).toBe("203.0.113.9");
    expect(headers.get(PATHNAME_HEADER)).toBe("/me");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/web -- middleware.test.ts`
Expected: FAIL — cannot find module `../lib/pathname-header`, `buildForwardedRequestHeaders` is not exported from `../middleware`

- [ ] **Step 3: Create `lib/pathname-header.ts`**

```ts
/**
 * Header middleware.ts forwards to the root layout so it knows the request
 * pathname. Root layouts render for every route and get no pathname prop of
 * their own — this header is how a standalone campaign microsite (e.g.
 * /raffle/*) can opt out of the Academy shop chrome. Kept in its own file
 * (rather than middleware.ts) so app/layout.tsx doesn't need to import
 * next/server just to read one constant.
 */
export const PATHNAME_HEADER = "x-livapon-pathname";
```

- [ ] **Step 4: Update `middleware.ts`**

Replace the full contents of `apps/web/middleware.ts` with:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { checkBasicAuth } from "./lib/auth/basic-auth";
import { getClientIp } from "./lib/auth/client-ip";
import { createFixedWindowRateLimiter } from "./lib/auth/rate-limiter";
import { PATHNAME_HEADER } from "./lib/pathname-header";

// Module-level singleton: persists for the lifetime of one server/edge
// instance (not distributed across regions/restarts — see rate-limiter.ts).
// 5 wrong passwords per IP per minute is generous for a real visitor who
// mistypes, tight enough to blunt a naive password-guessing loop against the
// single shared pre-launch credential.
const basicAuthLimiter = createFixedWindowRateLimiter({ maxFailures: 5, windowMs: 60_000 });

export function buildForwardedRequestHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers);
  headers.set(PATHNAME_HEADER, request.nextUrl.pathname);
  return headers;
}

/**
 * Pre-launch site-wide gate: this store already moves real money (Shopify
 * checkout + automatic refunds) while the catalog/branding is still
 * incomplete, so the public URL shouldn't be freely browsable/purchasable
 * before launch. No Vercel plan upgrade needed (Password Protection is a
 * Pro+ feature) — this is a plain HTTP Basic Auth challenge.
 *
 * Controlled by env: unset SITE_BASIC_AUTH_USER/SITE_BASIC_AUTH_PASSWORD to
 * disable entirely (e.g. after the real launch), no code change needed.
 */
export async function middleware(request: NextRequest) {
  const passThroughInit = { request: { headers: buildForwardedRequestHeaders(request) } };

  const user = process.env.SITE_BASIC_AUTH_USER;
  const password = process.env.SITE_BASIC_AUTH_PASSWORD;

  if (!user || !password) {
    return NextResponse.next(passThroughInit);
  }

  const clientIp = getClientIp(request.headers);

  // Blocked IPs are rejected before touching checkBasicAuth at all, so a
  // guessing loop can't keep spending compute on the constant-time compare
  // once it has already burned through its allowance.
  if (basicAuthLimiter.isBlocked(clientIp)) {
    return new NextResponse("Too many attempts. Try again shortly.", { status: 429 });
  }

  if (await checkBasicAuth(request.headers.get("authorization"), user, password)) {
    basicAuthLimiter.recordSuccess(clientIp);
    return NextResponse.next(passThroughInit);
  }

  basicAuthLimiter.recordFailure(clientIp);
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="LIVAPON Academy (pre-launch)"' }
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"]
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -w apps/web -- middleware.test.ts`
Expected: PASS (all tests in the file, including the pre-existing Basic Auth ones)

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck -w apps/web`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/pathname-header.ts apps/web/middleware.ts apps/web/test/middleware.test.ts
git commit -m "feat(web): forward request pathname from middleware for layout branching"
```

---

## Task 13: Web — root layout skips shop chrome for /raffle/* routes

**Files:**
- Modify: `apps/web/app/layout.tsx`

**Interfaces:**
- Consumes: `PATHNAME_HEADER` (Task 12)

- [ ] **Step 1: Update `layout.tsx`**

Add this import alongside the existing ones in `apps/web/app/layout.tsx`:

```ts
import { headers } from "next/headers";
import { PATHNAME_HEADER } from "../lib/pathname-header";
```

Replace the `RootLayout` function body:

```tsx
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const pathname = headerList.get(PATHNAME_HEADER) ?? "";
  // Standalone campaign microsites (e.g. the Japan Festival raffle) render
  // their own minimal chrome — no Academy header/search/nav (spec:
  // docs/superpowers/specs/2026-07-21-japan-festival-raffle-design.md §6).
  const isStandaloneCampaign = pathname.startsWith("/raffle/");

  return (
    <html lang="en" className={`${inter.variable} ${notoSansJp.variable} ${ebGaramond.variable}`}>
      <body>
        {isStandaloneCampaign ? (
          children
        ) : (
          <div className="shell">
            <header className="topbar">
              <Link className="brand" href="/">
                LIVAPON <span>Academy</span>
              </Link>
              <SearchPill />
              <nav className="nav" aria-label="Primary navigation">
                <NavLink href="/courses">Courses</NavLink>
                <NavLink href="/experiences">Experiences</NavLink>
                <NavLink href="/me">My Page</NavLink>
                <OperatorNavLink />
                <AuthControl />
              </nav>
            </header>
            <CategoryRow />
            <main className="main">{children}</main>
          </div>
        )}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck -w apps/web`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/layout.tsx
git commit -m "feat(web): render minimal chrome for standalone /raffle/* pages"
```

---

## Task 14: Web — raffle page styles

**Files:**
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Produces CSS classes consumed by Task 16/17: `.raffle-page`, `.raffle-logo`, `.raffle-form`, `.raffle-email-field`, `.raffle-checkbox`, `.raffle-number`, `.raffle-countdown`, `.raffle-profile`

- [ ] **Step 1: Append the new styles**

Add to the end of `apps/web/app/globals.css`:

```css

/* ---------- Raffle campaign pages (minimal, no shop chrome — see layout.tsx) ---------- */

.raffle-page {
  max-width: 480px;
  margin: 0 auto;
  padding: var(--space-9) var(--space-4);
  display: grid;
  gap: var(--space-4);
  text-align: center;
}

.raffle-logo {
  font-family: var(--font-voice-en);
  font-size: var(--text-2xl);
  letter-spacing: 0.06em;
  margin: 0;
}

.raffle-page h1 {
  margin: 0;
  line-height: var(--leading-heading);
}

.raffle-form {
  display: grid;
  gap: var(--space-4);
  text-align: left;
}

.raffle-email-field {
  display: grid;
  gap: var(--space-1);
}

.raffle-email-field input {
  width: 100%;
  min-height: var(--control-height);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  padding: var(--space-2) var(--space-3);
}

.raffle-checkbox {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-2);
  align-items: start;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  text-align: left;
}

.raffle-checkbox input {
  width: auto;
  min-height: auto;
  margin-top: 3px;
}

.raffle-number {
  font-family: var(--font-voice-en);
  font-size: var(--text-display);
  margin: 0;
}

.raffle-countdown {
  font-size: var(--text-xl);
  font-weight: 600;
  margin: 0;
}

.raffle-profile {
  margin-top: var(--space-6);
  text-align: left;
  border-top: 1px solid var(--line);
  padding-top: var(--space-6);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "style(web): add minimal raffle campaign page styles"
```

---

## Task 15: Web — countdown helper + component

**Files:**
- Create: `apps/web/lib/raffle-countdown.ts`
- Test: `apps/web/test/raffle-countdown.test.ts`
- Create: `apps/web/components/RaffleCountdown.tsx`

**Interfaces:**
- Produces: `export function formatCountdownDuration(ms: number): string` and `export function millisecondsUntil(targetIso: string, now?: () => number): number` (`lib/raffle-countdown.ts`)
- Produces: `export function RaffleCountdown({ target }: { target: string })` — client component
- Consumed by: Task 16 (join page, before-open state)

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/raffle-countdown.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/web -- raffle-countdown.test.ts`
Expected: FAIL — cannot find module `../lib/raffle-countdown`

- [ ] **Step 3: Implement `lib/raffle-countdown.ts`**

```ts
export function millisecondsUntil(targetIso: string, now: () => number = Date.now): number {
  return Math.max(0, new Date(targetIso).getTime() - now());
}

export function formatCountdownDuration(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w apps/web -- raffle-countdown.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Create the client component**

Create `apps/web/components/RaffleCountdown.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { formatCountdownDuration, millisecondsUntil } from "../lib/raffle-countdown";

export function RaffleCountdown({ target }: { target: string }) {
  const [msRemaining, setMsRemaining] = useState(() => millisecondsUntil(target));

  useEffect(() => {
    const interval = setInterval(() => setMsRemaining(millisecondsUntil(target)), 1000);
    return () => clearInterval(interval);
  }, [target]);

  return <p className="raffle-countdown">{formatCountdownDuration(msRemaining)}</p>;
}
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck -w apps/web`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/raffle-countdown.ts apps/web/test/raffle-countdown.test.ts apps/web/components/RaffleCountdown.tsx
git commit -m "feat(web): add raffle countdown helper and client component"
```

---

## Task 16: Web — join page (`/raffle/[campaign]`)

**Files:**
- Create: `apps/web/app/raffle/[campaign]/page.tsx`

**Interfaces:**
- Consumes: `getRaffleCampaign`, `getRaffleWindowStatus` (Task 1, via `@livapon/domain`), `apiFetch`, `ApiError` (existing, from Task 11's `lib/api.ts`), `RaffleCountdown` (Task 15)
- Produces: page at route `/raffle/ca26`, posts to `POST /raffle/ca26/entries` (Task 8), redirects to `/raffle/ca26/entry/[accessToken]` (Task 17) on success

- [ ] **Step 1: Create the page**

```tsx
import { redirect } from "next/navigation";
import { getRaffleCampaign, getRaffleWindowStatus, type RaffleCampaignConfig } from "@livapon/domain";
import { apiFetch, ApiError } from "../../../lib/api";
import { RaffleCountdown } from "../../../components/RaffleCountdown";

// Local/staging convenience: preview the OPEN state without waiting for the
// real campaign window. Must mirror RaffleService.resolveWindowStatus
// (apps/api/src/raffle/raffle.service.ts) so the client and server never
// disagree about whether entries are open.
function resolveWindowStatus(campaign: RaffleCampaignConfig) {
  if (process.env.NODE_ENV !== "production" && process.env.RAFFLE_PREVIEW_FORCE_OPEN === "true") {
    return "OPEN" as const;
  }
  return getRaffleWindowStatus(new Date(), campaign.opensAt, campaign.closesAt);
}

export default async function RaffleJoinPage({
  params,
  searchParams
}: {
  params: Promise<{ campaign: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { campaign: campaignCode } = await params;
  const { error } = await searchParams;
  const campaign = getRaffleCampaign(campaignCode);

  if (!campaign) {
    return (
      <div className="raffle-page">
        <p className="raffle-logo">LIVAPON</p>
        <p>We couldn&apos;t find that raffle.</p>
      </div>
    );
  }

  const status = resolveWindowStatus(campaign);

  async function join(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    const privacyConsent = formData.get("privacyConsent") === "on";
    const marketingOptIn = formData.get("marketingOptIn") === "on";

    try {
      const entry = await apiFetch<{ accessToken: string }>(`/raffle/${campaignCode}/entries`, {
        method: "POST",
        body: JSON.stringify({ email, privacyConsent, marketingOptIn })
      });
      redirect(`/raffle/${campaignCode}/entry/${entry.accessToken}`);
    } catch (err) {
      if (err instanceof ApiError) {
        redirect(`/raffle/${campaignCode}?error=1`);
      }
      throw err;
    }
  }

  return (
    <div className="raffle-page">
      <p className="raffle-logo">LIVAPON</p>
      {status === "BEFORE_OPEN" ? (
        <>
          <h1>Join the LIVAPON Japan Festival Raffle</h1>
          <p>Entries open in:</p>
          <RaffleCountdown target={campaign.opensAt.toISOString()} />
        </>
      ) : status === "CLOSED" ? (
        <>
          <h1>Entries are now closed</h1>
          <p>Thanks for your interest! Watch for the winners announcement at the festival.</p>
        </>
      ) : (
        <>
          <h1>Join the LIVAPON Japan Festival Raffle</h1>
          {error ? <p className="notice danger">Please check your details and agree to the terms below, then try again.</p> : null}
          <form className="raffle-form" action={join}>
            <label className="raffle-email-field" htmlFor="email">
              <span>Email address</span>
              <input id="email" name="email" type="email" required maxLength={320} />
            </label>
            <label className="raffle-checkbox">
              <input name="privacyConsent" type="checkbox" required />
              <span>
                By joining, you agree that LIVAPON may collect and use the information you provide to run this
                raffle and to deliver LIVAPON services.
              </span>
            </label>
            <label className="raffle-checkbox">
              <input name="marketingOptIn" type="checkbox" />
              <span>Yes, I&apos;d like to receive offers and updates from LIVAPON by email.</span>
            </label>
            <button className="button primary" type="submit">
              Join
            </button>
          </form>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck -w apps/web`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/raffle/[campaign]/page.tsx
git commit -m "feat(web): add raffle join page with countdown/closed states"
```

---

## Task 17: Web — confirmation / re-access page (`/raffle/[campaign]/entry/[token]`)

**Files:**
- Create: `apps/web/app/raffle/[campaign]/entry/[token]/page.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `ApiError` (existing), `FormField` (existing component)
- Produces: page at route `/raffle/ca26/entry/:token`; `GET /raffle/:campaignCode/entries/:token` and `PATCH /raffle/:campaignCode/entries/:token` (Task 8) as its data source/sink

- [ ] **Step 1: Create the page**

```tsx
import { redirect } from "next/navigation";
import { apiFetch, ApiError } from "../../../../../lib/api";
import { FormField } from "../../../../../components/FormField";

type RaffleEntry = {
  campaignCode: string;
  displayNumber: string;
  accessToken: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  marketingOptIn: boolean;
};

const PROFILE_TEXT_FIELDS = [
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
  "country"
] as const;

export default async function RaffleEntryPage({
  params,
  searchParams
}: {
  params: Promise<{ campaign: string; token: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { campaign: campaignCode, token } = await params;
  const { saved } = await searchParams;

  let entry: RaffleEntry;
  try {
    entry = await apiFetch<RaffleEntry>(`/raffle/${campaignCode}/entries/${token}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return (
        <div className="raffle-page">
          <p className="raffle-logo">LIVAPON</p>
          <p>We couldn&apos;t find that entry. Please use the link from your confirmation email.</p>
        </div>
      );
    }
    throw err;
  }

  async function updateProfile(formData: FormData) {
    "use server";
    const body: Record<string, string | boolean> = {};
    for (const key of PROFILE_TEXT_FIELDS) {
      const value = String(formData.get(key) ?? "").trim();
      if (value) {
        body[key] = value;
      }
    }
    body.marketingOptIn = formData.get("marketingOptIn") === "on";

    await apiFetch(`/raffle/${campaignCode}/entries/${token}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    });
    redirect(`/raffle/${campaignCode}/entry/${token}?saved=1`);
  }

  return (
    <div className="raffle-page">
      <p className="raffle-logo">LIVAPON</p>
      <h1>You&apos;re in!</h1>
      <p className="raffle-number">{entry.displayNumber}</p>
      <p>Take a screenshot of this number to keep it handy for the draw.</p>
      {saved ? <p className="notice">Your details were saved.</p> : null}

      <section className="raffle-profile">
        <h2>Add a few more details</h2>
        <p>We&apos;ll get to know you better before the festival. Everything here is optional.</p>
        <form className="form-grid" action={updateProfile}>
          <FormField htmlFor="firstName" label="First name">
            <input id="firstName" name="firstName" defaultValue={entry.firstName ?? ""} />
          </FormField>
          <FormField htmlFor="lastName" label="Last name">
            <input id="lastName" name="lastName" defaultValue={entry.lastName ?? ""} />
          </FormField>
          <FormField htmlFor="phone" label="Phone">
            <input id="phone" name="phone" defaultValue={entry.phone ?? ""} />
          </FormField>
          <FormField htmlFor="gender" label="Gender">
            <input id="gender" name="gender" defaultValue={entry.gender ?? ""} />
          </FormField>
          <FormField htmlFor="dateOfBirth" label="Date of birth">
            <input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={entry.dateOfBirth ?? ""} />
          </FormField>
          <FormField htmlFor="addressLine1" label="Address line 1">
            <input id="addressLine1" name="addressLine1" defaultValue={entry.addressLine1 ?? ""} />
          </FormField>
          <FormField htmlFor="addressLine2" label="Address line 2">
            <input id="addressLine2" name="addressLine2" defaultValue={entry.addressLine2 ?? ""} />
          </FormField>
          <FormField htmlFor="city" label="City">
            <input id="city" name="city" defaultValue={entry.city ?? ""} />
          </FormField>
          <FormField htmlFor="region" label="Province / State">
            <input id="region" name="region" defaultValue={entry.region ?? ""} />
          </FormField>
          <FormField htmlFor="postalCode" label="Postal code">
            <input id="postalCode" name="postalCode" defaultValue={entry.postalCode ?? ""} />
          </FormField>
          <FormField htmlFor="country" label="Country">
            <input id="country" name="country" defaultValue={entry.country ?? ""} />
          </FormField>
          <label className="raffle-checkbox">
            <input name="marketingOptIn" type="checkbox" defaultChecked={entry.marketingOptIn} />
            <span>Yes, I&apos;d like to receive offers and updates from LIVAPON by email.</span>
          </label>
          <button className="button primary" type="submit">
            Save details
          </button>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck -w apps/web`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/raffle/[campaign]/entry/[token]/page.tsx"
git commit -m "feat(web): add raffle confirmation/re-access page with profile form"
```

---

## Task 18: Web — operator raffle entries page + CSV download route

**Files:**
- Create: `apps/web/app/operator/raffle/[campaign]/page.tsx`
- Create: `apps/web/app/operator/raffle/[campaign]/entries.csv/route.ts`
- Modify: `apps/web/app/operator/operator-nav.tsx`

**Interfaces:**
- Consumes: `apiFetch` (existing), `apiFetchText` (Task 11), `GET /operator/raffle/:campaignCode/entries` and `.../entries.csv` (Task 9)

- [ ] **Step 1: Create the operator list page**

Create `apps/web/app/operator/raffle/[campaign]/page.tsx`:

```tsx
import { apiFetch } from "../../../../lib/api";
import { OperatorNav } from "../../operator-nav";
import { PageHeader } from "../../../../components/PageHeader";
import { TableRegion } from "../../../../components/TableRegion";
import { EmptyState } from "../../../../components/EmptyState";

type RaffleEntry = {
  serialNumber: number;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  marketingOptIn: boolean;
};

export default async function OperatorRaffleEntriesPage({ params }: { params: Promise<{ campaign: string }> }) {
  const { campaign: campaignCode } = await params;
  const entries = await apiFetch<RaffleEntry[]>(`/operator/raffle/${campaignCode}/entries`);

  return (
    <>
      <OperatorNav />
      <PageHeader
        title={<span lang="ja">福引応募一覧（{campaignCode}）</span>}
        lede={<a href={`/operator/raffle/${campaignCode}/entries.csv`}>CSVをダウンロード</a>}
      />
      {entries.length === 0 ? (
        <EmptyState>応募がまだありません。</EmptyState>
      ) : (
        <TableRegion label="福引応募一覧">
          <table>
            <thead>
              <tr>
                <th>番号</th>
                <th>メール</th>
                <th>氏名</th>
                <th>電話</th>
                <th>メルマガ同意</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.serialNumber}>
                  <td>{campaignCode}-{String(entry.serialNumber).padStart(6, "0")}</td>
                  <td>{entry.email}</td>
                  <td>
                    {entry.firstName ?? ""} {entry.lastName ?? ""}
                  </td>
                  <td>{entry.phone ?? "-"}</td>
                  <td>{entry.marketingOptIn ? "○" : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableRegion>
      )}
    </>
  );
}
```

- [ ] **Step 2: Create the CSV download route handler**

Create `apps/web/app/operator/raffle/[campaign]/entries.csv/route.ts`:

```ts
import { apiFetchText } from "../../../../../lib/api";

export async function GET(_request: Request, { params }: { params: Promise<{ campaign: string }> }) {
  const { campaign } = await params;
  const csv = await apiFetchText(`/operator/raffle/${campaign}/entries.csv`);

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${campaign}-raffle-entries.csv"`
    }
  });
}
```

- [ ] **Step 3: Add the operator nav link**

In `apps/web/app/operator/operator-nav.tsx`, add a line inside the `<nav>`:

```tsx
      <NavLink href="/operator/raffle/ca26">福引応募一覧</NavLink>
```

(Placed after the existing `Shopify連携診断` link, before the closing `</nav>`.)

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck -w apps/web`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/operator/raffle" apps/web/app/operator/operator-nav.tsx
git commit -m "feat(web): add operator raffle entries page and CSV download"
```

---

## Task 19: Full-stack build, test suite, and local preview

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite and typecheck across every package**

```bash
npm run typecheck
npm run test
```

Expected: PASS everywhere (this also runs the pre-existing full suite, confirming nothing regressed).

- [ ] **Step 2: Build every package**

```bash
npm run build
```

Expected: PASS (`packages/domain`, `packages/db`, `apps/api`, `apps/web` all build clean)

- [ ] **Step 3: Ensure the local Postgres has the raffle tables**

```bash
docker compose up -d db
DATABASE_URL="postgresql://livapon:livapon@localhost:55432/livapon?schema=public" npm run db:generate -w packages/db
```

Expected: no pending migrations reported (Task 2 already applied `add_raffle_entries`).

- [ ] **Step 4: Start the API with the preview override enabled**

Run in the background (new terminal / background shell):

```bash
DATABASE_URL="postgresql://livapon:livapon@localhost:55432/livapon?schema=public" \
SHOPIFY_WEBHOOK_SECRET="dev-shopify-webhook-secret" \
JWT_SECRET="dev-jwt-secret-change-me" \
RAFFLE_PREVIEW_FORCE_OPEN="true" \
PORT=4000 \
npm run start -w apps/api
```

Expected log line: `Nest application successfully started` (or equivalent), listening on port 4000.

- [ ] **Step 5: Start the web app**

Run in the background (separate terminal / background shell):

```bash
INTERNAL_API_BASE_URL="http://localhost:4000" \
NEXT_PUBLIC_API_BASE_URL="http://localhost:4000" \
RAFFLE_PREVIEW_FORCE_OPEN="true" \
npm run dev -w apps/web
```

Expected: Next.js reports ready on `http://localhost:3000`.

- [ ] **Step 6: Smoke-test the join flow with curl**

```bash
curl -s -X POST http://localhost:4000/raffle/ca26/entries \
  -H 'content-type: application/json' \
  -d '{"email":"preview-smoke-test@example.com","privacyConsent":true,"marketingOptIn":true}' | python3 -m json.tool
```

Expected: JSON body with `"displayNumber": "ca26-000001"` (or the next sequential number if run more than once) and a non-empty `"accessToken"`.

- [ ] **Step 7: Smoke-test the entry lookup with the token from Step 6**

```bash
TOKEN="<accessToken from step 6>"
curl -s http://localhost:4000/raffle/ca26/entries/$TOKEN | python3 -m json.tool
```

Expected: same entry, `displayNumber` matches Step 6.

- [ ] **Step 8: Visually verify in the browser**

Open `http://localhost:3000/raffle/ca26` — confirm: no Academy header/nav is present, only the LIVAPON wordmark, the join form, and both checkboxes. Submit the form; confirm redirect to `/raffle/ca26/entry/<token>` shows the raffle number and the profile form. Fill in a couple of profile fields, save, and confirm the page reloads with those values persisted. Re-open the same `/raffle/ca26/entry/<token>` URL directly and confirm the saved values are still shown.

(This step is performed interactively after the plan finishes executing — not part of the automated task run.)

---

## Self-Review Notes

- **Spec coverage:** every §-numbered item in the design doc maps to a task — §2 campaign/window/serial (Task 1), §3 schema (Task 2), §5 API + Shopify sync + mailer + CSV (Tasks 3–10), §6 web routing/minimal layout/pages (Tasks 11–18), §7 exact UI copy (Task 16/17), §8 test plan (every TDD task), preview (Task 19). The `RAFFLE_PREVIEW_FORCE_OPEN` override from §6 is implemented identically in both `RaffleService` (Task 7) and the join page (Task 16) — verified the two conditions are copy-identical.
- **Type consistency:** `RaffleEntry`/`RaffleEntryRecord` field names match across `raffle.service.ts`, `raffle.controller.ts`, `raffle-csv.ts`, and the two web page types — checked `dateOfBirth` is consistently `Date | null` in API-internal code and `string | null` (ISO date) only at the controller's JSON boundary and in web types.
- **No placeholders:** confirmed no TBD/TODO markers; every step has runnable code or an exact command with expected output.
