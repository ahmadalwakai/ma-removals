import "dotenv/config";
import { Prisma } from "@prisma/client";
import { db } from "../src/lib/db";
import {
  ITEM_METRICS_DATASET,
  ITEM_METRICS_DATASET_VERSION,
  type ItemMetricV2,
  validateItemMetricsDataset,
} from "../src/lib/items/item-metrics";

interface ExistingItem {
  id: string;
  slug: string;
  name: string;
  estimatedVolumeM3: number | null;
  estimatedWeightKg: number | null;
  handlingMinutes: number | null;
  requiresTwoPeople: boolean;
  heavy: boolean;
  specialist: boolean;
  minimumCrew: number | null;
}

interface PlannedChange {
  item: ExistingItem;
  metric: ItemMetricV2;
  data: Prisma.ItemUpdateInput;
}

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const allowProduction = args.has("--allow-production");
const dryRun = !apply || args.has("--dry-run");

function numberMatches(a: number | null, b: number): boolean {
  return a !== null && Math.abs(a - b) < 0.0001;
}

function plannedMetricUpdate(item: ExistingItem, metric: ItemMetricV2): {
  change: PlannedChange | null;
  conflicts: string[];
} {
  const data: Prisma.ItemUpdateInput = {};
  const conflicts: string[] = [];
  const numericFields = [
    ["estimatedVolumeM3", metric.estimatedVolumeM3],
    ["estimatedWeightKg", metric.estimatedWeightKg],
    ["handlingMinutes", metric.handlingMinutes],
    ["minimumCrew", metric.minimumCrew],
  ] as const;

  for (const [field, value] of numericFields) {
    const existing = item[field];
    if (existing === null) {
      data[field] = value;
    } else if (!numberMatches(existing, value)) {
      conflicts.push(`${field}: existing ${existing}, v2 ${value}`);
    }
  }

  const booleanFields = [
    ["requiresTwoPeople", metric.requiresTwoPeople],
    ["heavy", metric.heavy],
    ["specialist", metric.specialist],
  ] as const;
  for (const [field, value] of booleanFields) {
    if (item[field] !== value) {
      if (conflicts.length > 0 || Object.keys(data).length === 0) {
        conflicts.push(`${field}: existing ${item[field]}, v2 ${value}`);
      } else {
        data[field] = value;
      }
    }
  }

  return {
    change: conflicts.length === 0 && Object.keys(data).length > 0 ? { item, metric, data } : null,
    conflicts,
  };
}

async function main() {
  validateItemMetricsDataset();
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required for item metric backfill.");
  }
  if (apply && process.env.NODE_ENV === "production" && !allowProduction) {
    throw new Error("Refusing production item metric write without --allow-production.");
  }

  try {
    const items = await db.item.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        estimatedVolumeM3: true,
        estimatedWeightKg: true,
        handlingMinutes: true,
        requiresTwoPeople: true,
        heavy: true,
        specialist: true,
        minimumCrew: true,
      },
      orderBy: { slug: "asc" },
    });
    const bySlug = new Map(items.map((item) => [item.slug, item]));
    const missing: ItemMetricV2[] = [];
    const changes: PlannedChange[] = [];
    const conflicts: Array<{ item: ExistingItem; metric: ItemMetricV2; conflicts: string[] }> = [];

    for (const metric of ITEM_METRICS_DATASET.items) {
      const item = bySlug.get(metric.slug);
      if (!item) {
        missing.push(metric);
        continue;
      }
      const plan = plannedMetricUpdate(item, metric);
      if (plan.conflicts.length > 0) {
        conflicts.push({ item, metric, conflicts: plan.conflicts });
      } else if (plan.change) {
        changes.push(plan.change);
      }
    }

    if (!dryRun) {
      for (const change of changes) {
        await db.item.update({
          where: { id: change.item.id },
          data: change.data,
        });
      }
    }

    console.log(`Item metric dataset: ${ITEM_METRICS_DATASET_VERSION}`);
    console.log(`Mode: ${dryRun ? "dry-run" : "apply"}`);
    console.log(`Catalogue records: ${items.length}`);
    console.log(`Dataset records: ${ITEM_METRICS_DATASET.itemCount}`);
    console.log(`Changed: ${changes.length}`);
    console.log(`Missing item rows: ${missing.length}`);
    console.log(`Conflicting existing metrics: ${conflicts.length}`);
    if (missing.length > 0) {
      console.log(`Missing slugs: ${missing.slice(0, 25).map((metric) => metric.slug).join(", ")}${missing.length > 25 ? ", ..." : ""}`);
    }
    if (conflicts.length > 0) {
      console.log("Conflicts:");
      for (const conflict of conflicts.slice(0, 50)) {
        console.log(`- ${conflict.item.slug}: ${conflict.conflicts.join("; ")}`);
      }
      if (conflicts.length > 50) console.log(`... ${conflicts.length - 50} more conflicts`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
