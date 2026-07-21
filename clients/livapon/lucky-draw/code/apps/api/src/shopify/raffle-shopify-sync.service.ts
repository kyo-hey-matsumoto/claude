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
