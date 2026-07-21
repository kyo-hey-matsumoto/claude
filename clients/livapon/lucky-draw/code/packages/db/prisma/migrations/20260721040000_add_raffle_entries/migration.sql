-- CreateTable
CREATE TABLE "RaffleCounter" (
    "campaignCode" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RaffleCounter_pkey" PRIMARY KEY ("campaignCode")
);

-- CreateTable
CREATE TABLE "RaffleEntry" (
    "id" UUID NOT NULL,
    "campaignCode" TEXT NOT NULL,
    "serialNumber" INTEGER NOT NULL,
    "accessToken" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "gender" TEXT,
    "dateOfBirth" DATE,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "privacyConsentAt" TIMESTAMP(3) NOT NULL,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "marketingOptInAt" TIMESTAMP(3),
    "shopifyCustomerId" TEXT,
    "shopifySyncedAt" TIMESTAMP(3),
    "shopifySyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaffleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RaffleEntry_accessToken_key" ON "RaffleEntry"("accessToken");

-- CreateIndex
CREATE INDEX "RaffleEntry_campaignCode_idx" ON "RaffleEntry"("campaignCode");

-- CreateIndex
CREATE UNIQUE INDEX "RaffleEntry_campaignCode_email_key" ON "RaffleEntry"("campaignCode", "email");

-- CreateIndex
CREATE UNIQUE INDEX "RaffleEntry_campaignCode_serialNumber_key" ON "RaffleEntry"("campaignCode", "serialNumber");
