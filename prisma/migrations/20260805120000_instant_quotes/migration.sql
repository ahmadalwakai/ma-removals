CREATE TYPE "QuoteStatus" AS ENUM (
  'DRAFT',
  'FIXED',
  'MANUAL_REVIEW',
  'ACCEPTED',
  'CONSUMED',
  'EXPIRED',
  'REJECTED'
);

CREATE TYPE "PricingVersionStatus" AS ENUM (
  'DRAFT',
  'ACTIVE',
  'ARCHIVED'
);

ALTER TABLE "Item"
  ADD COLUMN "estimatedVolumeM3" DOUBLE PRECISION,
  ADD COLUMN "estimatedWeightKg" DOUBLE PRECISION,
  ADD COLUMN "handlingMinutes" INTEGER,
  ADD COLUMN "requiresTwoPeople" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "fragile" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "dismantlingAvailable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "assemblyAvailable" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "PricingVersion" (
  "id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "PricingVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "label" TEXT,
  "settings" JSONB NOT NULL,
  "vehicleClasses" JSONB NOT NULL,
  "createdById" TEXT,
  "activatedById" TEXT,
  "activatedAt" TIMESTAMP(3),
  "deactivatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PricingVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VehicleClassConfig" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "maxUsableVolumeM3" DOUBLE PRECISION,
  "maxPayloadKg" DOUBLE PRECISION,
  "minCrew" INTEGER NOT NULL DEFAULT 1,
  "maxCrew" INTEGER NOT NULL DEFAULT 2,
  "baseFeePence" INTEGER,
  "perMilePence" INTEGER,
  "perHourPence" INTEGER,
  "loadingEfficiencyFactor" DOUBLE PRECISION,
  "unloadingEfficiencyFactor" DOUBLE PRECISION,
  "fleetCount" INTEGER,
  "manualReviewThresholdM3" DOUBLE PRECISION,
  "manualReviewPayloadKg" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VehicleClassConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Quote" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
  "pricingVersionId" TEXT,
  "moveType" TEXT NOT NULL,
  "moveDate" TIMESTAMP(3),
  "arrivalWindow" TEXT,
  "flexibleDate" BOOLEAN NOT NULL DEFAULT false,
  "sameDay" BOOLEAN NOT NULL DEFAULT false,
  "urgent" BOOLEAN NOT NULL DEFAULT false,
  "customerName" TEXT,
  "customerEmail" TEXT,
  "customerPhone" TEXT,
  "companyName" TEXT,
  "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
  "bookingConsentAccepted" BOOLEAN NOT NULL DEFAULT false,
  "termsAccepted" BOOLEAN NOT NULL DEFAULT false,
  "normalisedInput" JSONB NOT NULL,
  "routeMetrics" JSONB,
  "inventorySnapshot" JSONB NOT NULL,
  "accessDetails" JSONB NOT NULL,
  "selectedServices" JSONB NOT NULL,
  "vehicleRecommendation" JSONB,
  "crewRecommendation" JSONB,
  "estimatedDurationMinutes" INTEGER,
  "customerBreakdown" JSONB NOT NULL,
  "internalBreakdown" JSONB NOT NULL,
  "finalTotalPence" INTEGER,
  "manualReviewReasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "serverInputHash" TEXT NOT NULL,
  "idempotencyKey" TEXT,
  "stripePaymentId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "consumedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PricingAuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "before" JSONB,
  "after" JSONB,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PricingAuditLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Booking" ADD COLUMN "quoteId" TEXT;

CREATE UNIQUE INDEX "PricingVersion_version_key" ON "PricingVersion"("version");
CREATE INDEX "PricingVersion_status_idx" ON "PricingVersion"("status");
CREATE INDEX "PricingVersion_activatedAt_idx" ON "PricingVersion"("activatedAt");
CREATE UNIQUE INDEX "VehicleClassConfig_name_key" ON "VehicleClassConfig"("name");
CREATE INDEX "VehicleClassConfig_isActive_idx" ON "VehicleClassConfig"("isActive");
CREATE UNIQUE INDEX "Quote_reference_key" ON "Quote"("reference");
CREATE UNIQUE INDEX "Quote_idempotencyKey_key" ON "Quote"("idempotencyKey");
CREATE INDEX "Quote_status_idx" ON "Quote"("status");
CREATE INDEX "Quote_customerEmail_idx" ON "Quote"("customerEmail");
CREATE INDEX "Quote_expiresAt_idx" ON "Quote"("expiresAt");
CREATE INDEX "PricingAuditLog_entityType_entityId_idx" ON "PricingAuditLog"("entityType", "entityId");
CREATE INDEX "PricingAuditLog_createdAt_idx" ON "PricingAuditLog"("createdAt");
CREATE UNIQUE INDEX "Booking_quoteId_key" ON "Booking"("quoteId");

ALTER TABLE "Quote"
  ADD CONSTRAINT "Quote_pricingVersionId_fkey"
  FOREIGN KEY ("pricingVersionId") REFERENCES "PricingVersion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_quoteId_fkey"
  FOREIGN KEY ("quoteId") REFERENCES "Quote"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
