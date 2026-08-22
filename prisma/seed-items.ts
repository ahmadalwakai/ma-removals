/**
 * Seed script: populate ItemCategory and Item tables from the images manifest.
 * Run with: npm run seed:items
 */
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getItemMetricBySlug } from "../src/lib/items/item-metrics";

// ─── Prisma client (same pattern as src/lib/db.ts) ────────────────────────────
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const db = new PrismaClient({ adapter });

// ─── Category config ──────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<
  string,
  { name: string; icon: string; type: string; weight: string; size: string; sortOrder: number }
> = {
  Living_room_Furniture:     { name: "Living Room",               icon: "FiHome",          type: "residential", weight: "heavy", size: "large",  sortOrder: 1  },
  Bedroom:                   { name: "Bedroom",                   icon: "FiMoon",          type: "residential", weight: "heavy", size: "large",  sortOrder: 2  },
  Kitchen_appliances:        { name: "Kitchen & Appliances",      icon: "FiCoffee",        type: "residential", weight: "heavy", size: "medium", sortOrder: 3  },
  Bathroom_Furniture:        { name: "Bathroom",                  icon: "FiDroplet",       type: "residential", weight: "medium",size: "medium", sortOrder: 4  },
  Dining_Room_Furniture:     { name: "Dining Room",               icon: "FiGrid",          type: "residential", weight: "medium",size: "medium", sortOrder: 5  },
  Wardrobes_closet:          { name: "Wardrobes & Closets",       icon: "FiArchive",       type: "residential", weight: "heavy", size: "large",  sortOrder: 6  },
  Children_Baby_Items:       { name: "Children & Baby",           icon: "FiSmile",         type: "residential", weight: "light", size: "small",  sortOrder: 7  },
  Carpets_Rugs:              { name: "Carpets & Rugs",            icon: "FiSquare",        type: "residential", weight: "light", size: "small",  sortOrder: 8  },
  Garden_Outdoor:            { name: "Garden & Outdoor",          icon: "FiSun",           type: "residential", weight: "medium",size: "large",  sortOrder: 9  },
  Electrical_Electronic:     { name: "Electrical & Electronics",  icon: "FiZap",           type: "residential", weight: "medium",size: "medium", sortOrder: 10 },
  Gym_Fitness_Equipment:     { name: "Gym & Fitness",             icon: "FiActivity",      type: "residential", weight: "heavy", size: "large",  sortOrder: 11 },
  Musical_instruments:       { name: "Musical Instruments",       icon: "FiMusic",         type: "both",        weight: "heavy", size: "medium", sortOrder: 12 },
  Office_furniture:          { name: "Office Furniture",          icon: "FiBriefcase",     type: "business",    weight: "medium",size: "medium", sortOrder: 13 },
  Antiques_Collectibles:     { name: "Antiques & Collectibles",   icon: "FiAward",         type: "both",        weight: "heavy", size: "medium", sortOrder: 14 },
  Special_Awkward_items:     { name: "Special & Awkward Items",   icon: "FiAlertTriangle", type: "both",        weight: "heavy", size: "large",  sortOrder: 15 },
  Pet_items:                 { name: "Pet Items",                 icon: "FiHeart",         type: "residential", weight: "light", size: "small",  sortOrder: 16 },
  Bag_luggage_box:           { name: "Bags, Luggage & Boxes",     icon: "FiShoppingBag",   type: "both",        weight: "light", size: "small",  sortOrder: 17 },
  Miscellaneous_household:   { name: "Miscellaneous",             icon: "FiMoreHorizontal",type: "both",        weight: "light", size: "small",  sortOrder: 18 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toSlug(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function deriveItemName(fileName: string): string {
  // Strip extension
  const noExt = fileName.replace(/\.[^/.]+$/, "");
  // Strip trailing _jpg_NNkg weight suffix (e.g. _jpg_18kg or _jpg_145kg)
  const noWeight = noExt.replace(/_jpg_\d+kg$/, "");
  // Replace underscores with spaces and title-case each word
  return noWeight
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function deriveItemWeightKg(fileName: string): number | null {
  const match = fileName.match(/_(\d+)kg(?:\.[a-z0-9]+)?$/i);
  if (!match?.[1]) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const manifestPath = path.join(process.cwd(), "item-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found at ${manifestPath}. Run PowerShell manifest generation first.`);
  }

  const manifest: Array<{ Category: string; FileName: string }> = JSON.parse(
    fs.readFileSync(manifestPath, "utf-8")
  );

  console.log(`Found ${manifest.length} items in manifest.`);

  // Group by category
  const grouped = new Map<string, string[]>();
  for (const { Category, FileName } of manifest) {
    if (!grouped.has(Category)) grouped.set(Category, []);
    grouped.get(Category)!.push(FileName);
  }

  // ─── Clear existing data (FK-safe order) ──────────────────────────────────
  console.log("Clearing existing item data...");
  await db.bookingItem.deleteMany();
  await db.item.deleteMany();
  await db.itemCategory.deleteMany();

  // ─── Seed categories and items ────────────────────────────────────────────
  let totalItems = 0;
  for (const [folderName, config] of Object.entries(CATEGORY_CONFIG)) {
    const fileNames = grouped.get(folderName) ?? [];
    if (fileNames.length === 0) {
      console.warn(`  No files found for category folder: ${folderName}`);
    }

    const categorySlug = toSlug(folderName);

    const category = await db.itemCategory.create({
      data: {
        id: categorySlug,
        name: config.name,
        slug: categorySlug,
        icon: config.icon,
        type: config.type,
        sortOrder: config.sortOrder,
      },
    });

    // Create items, deduplicate slugs by appending index
    const seenSlugs = new Set<string>();
    for (let i = 0; i < fileNames.length; i++) {
      const fileName = fileNames[i]!;
      const rawName = deriveItemName(fileName);
      let slug = toSlug(rawName);

      // Ensure unique slug
      if (seenSlugs.has(slug)) {
        slug = `${categorySlug}-${slug}-${i}`;
      }
      // Global uniqueness guard
      let uniqueSlug = slug;
      let attempt = 0;
      while (seenSlugs.has(uniqueSlug)) {
        uniqueSlug = `${slug}-${++attempt}`;
      }
      seenSlugs.add(uniqueSlug);

      const imagePath = `/images/items/${folderName}/${fileName}`;
      const estimatedWeightKg = deriveItemWeightKg(fileName);
      const itemMetric = getItemMetricBySlug(uniqueSlug);

      await db.item.create({
        data: {
          id: uniqueSlug,
          name: rawName,
          slug: uniqueSlug,
          categoryId: category.id,
          imagePath,
          weight: config.weight,
          size: config.size,
          estimatedVolumeM3: itemMetric?.estimatedVolumeM3 ?? null,
          estimatedWeightKg: itemMetric?.estimatedWeightKg ?? estimatedWeightKg,
          handlingMinutes: itemMetric?.handlingMinutes ?? null,
          requiresTwoPeople: itemMetric?.requiresTwoPeople ?? false,
          heavy: itemMetric?.heavy ?? false,
          specialist: itemMetric?.specialist ?? false,
          minimumCrew: itemMetric?.minimumCrew ?? null,
          sortOrder: i,
          isActive: true,
        },
      });
      totalItems++;
    }

    console.log(`  ✓ ${config.name}: ${fileNames.length} items`);
  }

  console.log(`\nSeeded ${totalItems} items across ${Object.keys(CATEGORY_CONFIG).length} categories.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
