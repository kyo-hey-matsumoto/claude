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
