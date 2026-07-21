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
