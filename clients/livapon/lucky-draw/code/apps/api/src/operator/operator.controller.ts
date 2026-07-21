import { Body, Controller, Get, Header, Param, Post, Put, UseGuards } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma.service.js";
import { WebhookService } from "../webhooks/webhook.service.js";
import { ProviderCancellationService } from "./provider-cancellation.service.js";
import { CourseOpsService } from "./course-ops.service.js";
import { CancelSlotDto } from "./dto/cancel-slot.dto.js";
import { SetMeetUrlDto } from "./dto/set-meet-url.dto.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { RolesGuard, Roles } from "../auth/roles.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { buildRaffleEntriesCsv } from "./raffle-csv.js";

@UseGuards(AuthGuard, RolesGuard)
@Roles("OPERATOR", "ADMIN")
@Controller("operator")
export class OperatorController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooks: WebhookService,
    private readonly providerCancellation: ProviderCancellationService,
    private readonly courseOps: CourseOpsService
  ) {}

  @Get("bookings")
  listBookings() {
    return this.prisma.booking.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: true,
        experienceSlot: { include: { experience: true } },
        participantCounts: { include: { participantCategory: true } },
        cancellationRequests: { orderBy: { requestedAt: "desc" }, take: 1 }
      }
    });
  }

  @Get("webhooks")
  listWebhooks() {
    return this.prisma.shopifyWebhookEvent.findMany({
      orderBy: { receivedAt: "desc" },
      take: 50
    });
  }

  @Get("product-mappings")
  async listProductMappings() {
    const mappings = await this.prisma.shopifyProductMapping.findMany({
      orderBy: [{ resourceType: "asc" }, { createdAt: "desc" }],
      include: {
        courseOffering: { include: { course: true } },
        experience: true,
        participantCategory: true
      }
    });

    return mappings.map((mapping) => ({
      id: mapping.id,
      resourceType: mapping.resourceType,
      resourceId: mapping.resourceId,
      resourceName: mapping.courseOffering?.course.title ?? mapping.experience?.title ?? mapping.resourceId,
      mappedItemName:
        mapping.courseOffering?.title ??
        (mapping.participantCategory
          ? `${mapping.participantCategory.label} (${mapping.participantCategory.code})`
          : null),
      localStatus: mapping.courseOffering?.status ?? mapping.experience?.status ?? null,
      shopifyProductGid: mapping.shopifyProductGid,
      shopifyVariantGid: mapping.shopifyVariantGid,
      isActive: mapping.isActive,
      createdAt: mapping.createdAt
    }));
  }

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

  @Post("webhooks/:id/reprocess")
  async reprocessWebhook(@Param("id") id: string, @CurrentUser() actor: { id?: string } | undefined) {
    const result = await this.webhooks.reprocess(id);

    // Reprocessing replays a webhook and can flip Booking/Enrollment state, so
    // it is an operator-initiated state change and must leave an audit trail
    // (CLAUDE.md: every manual operator state change writes an AuditLog row).
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor?.id,
        action: "WEBHOOK_REPROCESSED",
        entityType: "ShopifyWebhookEvent",
        entityId: id,
        after: { status: result.status } as Prisma.InputJsonValue
      }
    });

    return result;
  }

  // Provider-initiated cancellation of an experience slot: cancels the slot and
  // refunds every CONFIRMED booking on it in full (#26). Experiences only.
  @Post("experience-slots/:id/cancel")
  cancelExperienceSlot(@Param("id") id: string, @Body() body: CancelSlotDto) {
    return this.providerCancellation.cancelSlot(id, body.reason);
  }

  // Course lifecycle manual actions (Option B).
  @Post("enrollments/:id/kit-shipped")
  markKitShipped(@Param("id") id: string) {
    return this.courseOps.markKitShipped(id);
  }

  @Put("session-slots/:id/meet-url")
  setSessionSlotMeetUrl(@Param("id") id: string, @Body() body: SetMeetUrlDto) {
    return this.courseOps.setSlotMeetUrl(id, body.url);
  }
}
