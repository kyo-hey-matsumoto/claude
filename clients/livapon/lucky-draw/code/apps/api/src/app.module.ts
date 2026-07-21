import { Module } from "@nestjs/common";
import { globalValidationPipeProvider } from "./common/validation.js";
import { HealthController } from "./health.controller.js";
import { PrismaService } from "./common/prisma.service.js";
import { CurrentUserService } from "./common/current-user.service.js";
import { EnvService } from "./common/env.service.js";
import { CatalogController } from "./catalog/catalog.controller.js";
import { CatalogService } from "./catalog/catalog.service.js";
import { CheckoutController } from "./checkout/checkout.controller.js";
import { MockShopifyService } from "./checkout/mock-shopify.service.js";
import { WebhookController } from "./webhooks/webhook.controller.js";
import { WebhookService } from "./webhooks/webhook.service.js";
import { OrderProcessorService } from "./webhooks/order-processor.service.js";
import { RefundProcessorService } from "./webhooks/refund-processor.service.js";
import { MeController } from "./me/me.controller.js";
import { MeService } from "./me/me.service.js";
import { SessionReservationService } from "./me/session-reservation.service.js";
import { OperatorController } from "./operator/operator.controller.js";
import { ProviderCancellationService } from "./operator/provider-cancellation.service.js";
import { CourseOpsService } from "./operator/course-ops.service.js";
import { ShopifyCatalogProductService } from "./shopify/catalog-products.js";
import { ShopifyRefundService } from "./shopify/shopify-refund.service.js";
import { AccountResolutionService } from "./auth/account-resolution.service.js";
import { AuthGuard, OptionalAuthGuard } from "./auth/auth.guard.js";
import { RolesGuard } from "./auth/roles.guard.js";
import { RaffleController } from "./raffle/raffle.controller.js";
import { RaffleService } from "./raffle/raffle.service.js";
import { RaffleMailer, ConsoleRaffleMailer } from "./raffle/raffle-mailer.js";
import { RaffleShopifySyncService } from "./shopify/raffle-shopify-sync.service.js";

@Module({
  controllers: [
    HealthController,
    CatalogController,
    CheckoutController,
    WebhookController,
    MeController,
    OperatorController,
    RaffleController
  ],
  providers: [
    globalValidationPipeProvider,
    EnvService,
    PrismaService,
    CurrentUserService,
    CatalogService,
    ShopifyCatalogProductService,
    MockShopifyService,
    WebhookService,
    OrderProcessorService,
    RefundProcessorService,
    MeService,
    SessionReservationService,
    ShopifyRefundService,
    ProviderCancellationService,
    CourseOpsService,
    AccountResolutionService,
    AuthGuard,
    OptionalAuthGuard,
    RolesGuard,
    RaffleService,
    { provide: RaffleMailer, useClass: ConsoleRaffleMailer },
    RaffleShopifySyncService
  ]
})
export class AppModule {}
