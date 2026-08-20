ALTER TABLE "Quote"
  ADD COLUMN "competitorBenchmarkId" TEXT,
  ADD COLUMN "beatCompetitorCampaignId" TEXT,
  ADD COLUMN "competitorSnapshot" JSONB;

CREATE TABLE "CompetitorBenchmark" (
  "id" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "moveType" TEXT NOT NULL,
  "propertySize" TEXT NOT NULL,
  "serviceLevel" TEXT NOT NULL,
  "packingIncluded" BOOLEAN NOT NULL DEFAULT false,
  "distanceBandMinMiles" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "distanceBandMaxMiles" DOUBLE PRECISION,
  "benchmarkPricePence" INTEGER NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "sourceNote" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompetitorBenchmark_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BeatCompetitorCampaign" (
  "id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "internalName" TEXT NOT NULL,
  "competitorLabel" TEXT NOT NULL,
  "applicableRegions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "applicableMoveTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "applicablePropertySizes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "beatPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "beatFixedAmountPence" INTEGER,
  "minimumPricePence" INTEGER,
  "minimumContributionPence" INTEGER,
  "minimumMarginPercent" DOUBLE PRECISION,
  "maximumDiscountPence" INTEGER,
  "allowZeroMargin" BOOLEAN NOT NULL DEFAULT false,
  "allowNegativeMargin" BOOLEAN NOT NULL DEFAULT false,
  "maximumPermittedLossPence" INTEGER,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "dailyBookingLimit" INTEGER,
  "totalCampaignBookingLimit" INTEGER,
  "dailyBookingCount" INTEGER NOT NULL DEFAULT 0,
  "bookingCount" INTEGER NOT NULL DEFAULT 0,
  "dailyBookingDate" TIMESTAMP(3),
  "autoPause" BOOLEAN NOT NULL DEFAULT true,
  "pausedAt" TIMESTAMP(3),
  "pauseReason" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BeatCompetitorCampaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Quote_competitorBenchmarkId_idx" ON "Quote"("competitorBenchmarkId");
CREATE INDEX "Quote_beatCompetitorCampaignId_idx" ON "Quote"("beatCompetitorCampaignId");

CREATE INDEX "CompetitorBenchmark_active_idx" ON "CompetitorBenchmark"("active");
CREATE INDEX "CompetitorBenchmark_region_idx" ON "CompetitorBenchmark"("region");
CREATE INDEX "CompetitorBenchmark_moveType_idx" ON "CompetitorBenchmark"("moveType");
CREATE INDEX "CompetitorBenchmark_propertySize_idx" ON "CompetitorBenchmark"("propertySize");
CREATE INDEX "CompetitorBenchmark_serviceLevel_idx" ON "CompetitorBenchmark"("serviceLevel");
CREATE INDEX "CompetitorBenchmark_effectiveFrom_effectiveTo_idx" ON "CompetitorBenchmark"("effectiveFrom", "effectiveTo");

CREATE INDEX "BeatCompetitorCampaign_enabled_idx" ON "BeatCompetitorCampaign"("enabled");
CREATE INDEX "BeatCompetitorCampaign_startsAt_endsAt_idx" ON "BeatCompetitorCampaign"("startsAt", "endsAt");
CREATE INDEX "BeatCompetitorCampaign_pausedAt_idx" ON "BeatCompetitorCampaign"("pausedAt");

ALTER TABLE "Quote"
  ADD CONSTRAINT "Quote_competitorBenchmarkId_fkey"
  FOREIGN KEY ("competitorBenchmarkId") REFERENCES "CompetitorBenchmark"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Quote"
  ADD CONSTRAINT "Quote_beatCompetitorCampaignId_fkey"
  FOREIGN KEY ("beatCompetitorCampaignId") REFERENCES "BeatCompetitorCampaign"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
