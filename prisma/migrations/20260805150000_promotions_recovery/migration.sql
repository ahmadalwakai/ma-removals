CREATE TYPE "PromotionCampaignType" AS ENUM (
  'STANDARD',
  'GROWTH',
  'AGGRESSIVE',
  'OCCUPANCY_FILL',
  'BACKHAUL',
  'STUDENT_MOVE',
  'SINGLE_ITEM',
  'LAST_MINUTE',
  'RECOVERY',
  'MANUAL_CAMPAIGN'
);

CREATE TYPE "PromotionDiscountType" AS ENUM (
  'PERCENTAGE',
  'FIXED'
);

CREATE TYPE "PromotionRedemptionStatus" AS ENUM (
  'RESERVED',
  'REDEEMED',
  'RELEASED',
  'EXPIRED'
);

ALTER TABLE "Item"
  ADD COLUMN "heavy" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "specialist" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reassemblyAvailable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "minimumCrew" INTEGER,
  ADD COLUMN "vehicleRestrictions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Quote"
  ADD COLUMN "promotionCampaignId" TEXT,
  ADD COLUMN "promotionCodeId" TEXT,
  ADD COLUMN "moveSize" TEXT,
  ADD COLUMN "flexibleTime" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "exactTime" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "earliestDate" TIMESTAMP(3),
  ADD COLUMN "latestDate" TIMESTAMP(3),
  ADD COLUMN "preferredContactMethod" TEXT,
  ADD COLUMN "promotionSnapshot" JSONB,
  ADD COLUMN "flexibilitySnapshot" JSONB,
  ADD COLUMN "experimentAssignment" JSONB,
  ADD COLUMN "preDiscountTotalPence" INTEGER,
  ADD COLUMN "originalTotalPence" INTEGER,
  ADD COLUMN "discountTotalPence" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "roundingAdjustmentPence" INTEGER,
  ADD COLUMN "contributionPence" INTEGER,
  ADD COLUMN "grossMarginPercentage" DOUBLE PRECISION,
  ADD COLUMN "sourceChannel" TEXT,
  ADD COLUMN "utmSource" TEXT,
  ADD COLUMN "utmMedium" TEXT,
  ADD COLUMN "utmCampaign" TEXT,
  ADD COLUMN "referralCode" TEXT,
  ADD COLUMN "recoveryStatus" TEXT;

CREATE TABLE "PromotionCampaign" (
  "id" TEXT NOT NULL,
  "type" "PromotionCampaignType" NOT NULL DEFAULT 'MANUAL_CAMPAIGN',
  "internalName" TEXT NOT NULL,
  "customerLabel" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "percentageReduction" DOUBLE PRECISION,
  "fixedReductionPence" INTEGER,
  "maximumDiscountPence" INTEGER,
  "maximumDiscountPercent" DOUBLE PRECISION,
  "hardMinimumPricePence" INTEGER,
  "hardMinimumContributionPence" INTEGER,
  "hardMinimumMarginPercent" DOUBLE PRECISION,
  "allowZeroMargin" BOOLEAN NOT NULL DEFAULT false,
  "allowNegativeMargin" BOOLEAN NOT NULL DEFAULT false,
  "maximumPermittedLossPence" INTEGER,
  "campaignBudgetPence" INTEGER,
  "dailyBudgetPence" INTEGER,
  "spentBudgetPence" INTEGER NOT NULL DEFAULT 0,
  "dailySpentBudgetPence" INTEGER NOT NULL DEFAULT 0,
  "dailyBudgetDate" TIMESTAMP(3),
  "maximumRedemptions" INTEGER,
  "redemptionCount" INTEGER NOT NULL DEFAULT 0,
  "stackable" BOOLEAN NOT NULL DEFAULT false,
  "autoPauseOnBudget" BOOLEAN NOT NULL DEFAULT true,
  "pausedAt" TIMESTAMP(3),
  "pauseReason" TEXT,
  "rules" JSONB,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromotionCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionCode" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "normalizedCode" TEXT NOT NULL,
  "internalName" TEXT NOT NULL,
  "customerLabel" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "discountType" "PromotionDiscountType" NOT NULL,
  "discountValue" INTEGER NOT NULL,
  "maximumDiscountPence" INTEGER,
  "minimumSubtotalPence" INTEGER,
  "maximumSubtotalPence" INTEGER,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "maximumRedemptions" INTEGER,
  "maximumRedemptionsPerCustomer" INTEGER,
  "applicableMoveTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "applicableRegions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "applicableWeekdays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "applicableVehicleClasses" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "firstBookingOnly" BOOLEAN NOT NULL DEFAULT false,
  "stackable" BOOLEAN NOT NULL DEFAULT false,
  "redemptionCount" INTEGER NOT NULL DEFAULT 0,
  "campaignId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromotionCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionRedemption" (
  "id" TEXT NOT NULL,
  "quoteId" TEXT,
  "bookingId" TEXT,
  "campaignId" TEXT,
  "codeId" TEXT,
  "idempotencyKey" TEXT,
  "customerEmailHash" TEXT,
  "customerPhoneHash" TEXT,
  "discountPence" INTEGER NOT NULL DEFAULT 0,
  "status" "PromotionRedemptionStatus" NOT NULL DEFAULT 'RESERVED',
  "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "redeemedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "metadata" JSONB,
  CONSTRAINT "PromotionRedemption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuoteEvent" (
  "id" TEXT NOT NULL,
  "quoteId" TEXT,
  "reference" TEXT,
  "type" TEXT NOT NULL,
  "step" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuoteEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuoteRecoveryEvent" (
  "id" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "campaignName" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "offerPence" INTEGER,
  "offerExpiresAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "convertedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuoteRecoveryEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PricingExperiment" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "controlPricingVersionId" TEXT,
  "variantPricingVersionId" TEXT,
  "allocationPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "eligibleMoveTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "eligibleRegions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "hardMarginProtectionPercent" DOUBLE PRECISION,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PricingExperiment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Quote_promotionCampaignId_idx" ON "Quote"("promotionCampaignId");
CREATE INDEX "Quote_promotionCodeId_idx" ON "Quote"("promotionCodeId");
CREATE INDEX "Quote_sourceChannel_idx" ON "Quote"("sourceChannel");
CREATE INDEX "Quote_utmCampaign_idx" ON "Quote"("utmCampaign");

CREATE INDEX "PromotionCampaign_active_idx" ON "PromotionCampaign"("active");
CREATE INDEX "PromotionCampaign_type_idx" ON "PromotionCampaign"("type");
CREATE INDEX "PromotionCampaign_startsAt_endsAt_idx" ON "PromotionCampaign"("startsAt", "endsAt");

CREATE UNIQUE INDEX "PromotionCode_code_key" ON "PromotionCode"("code");
CREATE UNIQUE INDEX "PromotionCode_normalizedCode_key" ON "PromotionCode"("normalizedCode");
CREATE INDEX "PromotionCode_active_idx" ON "PromotionCode"("active");
CREATE INDEX "PromotionCode_campaignId_idx" ON "PromotionCode"("campaignId");

CREATE UNIQUE INDEX "PromotionRedemption_quoteId_campaignId_codeId_key" ON "PromotionRedemption"("quoteId", "campaignId", "codeId");
CREATE UNIQUE INDEX "PromotionRedemption_idempotencyKey_key" ON "PromotionRedemption"("idempotencyKey");
CREATE INDEX "PromotionRedemption_status_idx" ON "PromotionRedemption"("status");
CREATE INDEX "PromotionRedemption_campaignId_idx" ON "PromotionRedemption"("campaignId");
CREATE INDEX "PromotionRedemption_codeId_idx" ON "PromotionRedemption"("codeId");
CREATE INDEX "PromotionRedemption_customerEmailHash_idx" ON "PromotionRedemption"("customerEmailHash");
CREATE INDEX "PromotionRedemption_customerPhoneHash_idx" ON "PromotionRedemption"("customerPhoneHash");

CREATE INDEX "QuoteEvent_quoteId_idx" ON "QuoteEvent"("quoteId");
CREATE INDEX "QuoteEvent_reference_idx" ON "QuoteEvent"("reference");
CREATE INDEX "QuoteEvent_type_idx" ON "QuoteEvent"("type");
CREATE INDEX "QuoteEvent_createdAt_idx" ON "QuoteEvent"("createdAt");

CREATE INDEX "QuoteRecoveryEvent_quoteId_idx" ON "QuoteRecoveryEvent"("quoteId");
CREATE INDEX "QuoteRecoveryEvent_status_idx" ON "QuoteRecoveryEvent"("status");
CREATE INDEX "QuoteRecoveryEvent_sentAt_idx" ON "QuoteRecoveryEvent"("sentAt");

CREATE INDEX "PricingExperiment_active_idx" ON "PricingExperiment"("active");
CREATE INDEX "PricingExperiment_startsAt_endsAt_idx" ON "PricingExperiment"("startsAt", "endsAt");

ALTER TABLE "Quote"
  ADD CONSTRAINT "Quote_promotionCampaignId_fkey"
  FOREIGN KEY ("promotionCampaignId") REFERENCES "PromotionCampaign"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Quote"
  ADD CONSTRAINT "Quote_promotionCodeId_fkey"
  FOREIGN KEY ("promotionCodeId") REFERENCES "PromotionCode"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PromotionCode"
  ADD CONSTRAINT "PromotionCode_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "PromotionCampaign"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PromotionRedemption"
  ADD CONSTRAINT "PromotionRedemption_quoteId_fkey"
  FOREIGN KEY ("quoteId") REFERENCES "Quote"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PromotionRedemption"
  ADD CONSTRAINT "PromotionRedemption_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PromotionRedemption"
  ADD CONSTRAINT "PromotionRedemption_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "PromotionCampaign"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PromotionRedemption"
  ADD CONSTRAINT "PromotionRedemption_codeId_fkey"
  FOREIGN KEY ("codeId") REFERENCES "PromotionCode"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "QuoteEvent"
  ADD CONSTRAINT "QuoteEvent_quoteId_fkey"
  FOREIGN KEY ("quoteId") REFERENCES "Quote"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuoteRecoveryEvent"
  ADD CONSTRAINT "QuoteRecoveryEvent_quoteId_fkey"
  FOREIGN KEY ("quoteId") REFERENCES "Quote"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
