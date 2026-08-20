import * as fs from "node:fs/promises";
import * as path from "node:path";

interface ManifestEntry {
  Category: string;
  FileName: string;
}

export interface FallbackApiItem {
  id: string;
  name: string;
  slug: string;
  imagePath: string;
  weight: string;
  size: string;
  sortOrder: number;
}

export interface FallbackApiCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
  type: string;
  sortOrder: number;
  items: FallbackApiItem[];
}

const CATEGORY_CONFIG: Record<
  string,
  { name: string; icon: string; type: string; weight: string; size: string; sortOrder: number }
> = {
  Living_room_Furniture:     { name: "Living Room",               icon: "FiHome",          type: "residential", weight: "heavy", size: "large",  sortOrder: 1  },
  Bedroom:                   { name: "Bedroom",                   icon: "FiMoon",          type: "residential", weight: "heavy", size: "large",  sortOrder: 2  },
  Kitchen_appliances:        { name: "Kitchen & Appliances",      icon: "FiCoffee",        type: "residential", weight: "heavy", size: "medium", sortOrder: 3  },
  Bathroom_Furniture:        { name: "Bathroom",                  icon: "FiDroplet",       type: "residential", weight: "medium", size: "medium", sortOrder: 4  },
  Dining_Room_Furniture:     { name: "Dining Room",               icon: "FiGrid",          type: "residential", weight: "medium", size: "medium", sortOrder: 5  },
  Wardrobes_closet:          { name: "Wardrobes & Closets",       icon: "FiArchive",       type: "residential", weight: "heavy", size: "large",  sortOrder: 6  },
  Children_Baby_Items:       { name: "Children & Baby",           icon: "FiSmile",         type: "residential", weight: "light", size: "small",  sortOrder: 7  },
  Carpets_Rugs:              { name: "Carpets & Rugs",            icon: "FiSquare",        type: "residential", weight: "light", size: "small",  sortOrder: 8  },
  Garden_Outdoor:            { name: "Garden & Outdoor",          icon: "FiSun",           type: "residential", weight: "medium", size: "large",  sortOrder: 9  },
  Electrical_Electronic:     { name: "Electrical & Electronics",  icon: "FiZap",           type: "residential", weight: "medium", size: "medium", sortOrder: 10 },
  Gym_Fitness_Equipment:     { name: "Gym & Fitness",             icon: "FiActivity",      type: "residential", weight: "heavy", size: "large",  sortOrder: 11 },
  Musical_instruments:       { name: "Musical Instruments",       icon: "FiMusic",         type: "both",        weight: "heavy", size: "medium", sortOrder: 12 },
  Office_furniture:          { name: "Office Furniture",          icon: "FiBriefcase",     type: "business",    weight: "medium", size: "medium", sortOrder: 13 },
  Antiques_Collectibles:     { name: "Antiques & Collectibles",   icon: "FiAward",         type: "both",        weight: "heavy", size: "medium", sortOrder: 14 },
  Special_Awkward_items:     { name: "Special & Awkward Items",   icon: "FiAlertTriangle", type: "both",        weight: "heavy", size: "large",  sortOrder: 15 },
  Pet_items:                 { name: "Pet Items",                 icon: "FiHeart",         type: "residential", weight: "light", size: "small",  sortOrder: 16 },
  Bag_luggage_box:           { name: "Bags, Luggage & Boxes",     icon: "FiShoppingBag",   type: "both",        weight: "light", size: "small",  sortOrder: 17 },
  Miscellaneous_household:   { name: "Miscellaneous",             icon: "FiMoreHorizontal", type: "both",       weight: "light", size: "small",  sortOrder: 18 },
};

let fallbackCatalogPromise: Promise<FallbackApiCategory[]> | null = null;

function toSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function deriveItemName(fileName: string) {
  return fileName
    .replace(/\.[^/.]+$/, "")
    .replace(/_jpg_\d+kg$/, "")
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

async function loadFallbackCatalog() {
  const manifestPath = path.join(process.cwd(), "item-manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf-8")) as ManifestEntry[];
  const grouped = new Map<string, string[]>();

  for (const entry of manifest) {
    if (!entry.Category || !entry.FileName) continue;
    const files = grouped.get(entry.Category) ?? [];
    files.push(entry.FileName);
    grouped.set(entry.Category, files);
  }

  return Object.entries(CATEGORY_CONFIG)
    .map(([folderName, config]) => {
      const categorySlug = toSlug(folderName);
      const usedSlugs = new Set<string>();
      const items = (grouped.get(folderName) ?? []).map((fileName, index) => {
        const name = deriveItemName(fileName);
        let slug = toSlug(name);
        if (usedSlugs.has(slug)) slug = `${categorySlug}-${slug}-${index}`;
        usedSlugs.add(slug);

        return {
          id: slug,
          name,
          slug,
          imagePath: `/images/items/${folderName}/${fileName}`,
          weight: config.weight,
          size: config.size,
          sortOrder: index,
        };
      });

      return {
        id: categorySlug,
        name: config.name,
        slug: categorySlug,
        icon: config.icon,
        type: config.type,
        sortOrder: config.sortOrder,
        items,
      };
    })
    .filter((category) => category.items.length > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getFallbackItemCategories(type: string | null): Promise<FallbackApiCategory[]> {
  fallbackCatalogPromise ??= loadFallbackCatalog();
  const catalog = await fallbackCatalogPromise;
  const typeFilter =
    type === "residential" ? ["residential", "both"] :
    type === "business" ? ["business", "both"] :
    ["residential", "business", "both"];

  return catalog.filter((category) => typeFilter.includes(category.type));
}
