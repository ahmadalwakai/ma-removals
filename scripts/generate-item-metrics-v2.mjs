import fs from "node:fs";
import path from "node:path";

const DATASET_VERSION = "item-metrics-v2.0.0";

const CATEGORY_CONFIG = {
  Living_room_Furniture: { name: "Living Room", type: "residential", defaultWeight: "heavy", defaultSize: "large" },
  Bedroom: { name: "Bedroom", type: "residential", defaultWeight: "heavy", defaultSize: "large" },
  Kitchen_appliances: { name: "Kitchen & Appliances", type: "residential", defaultWeight: "heavy", defaultSize: "medium" },
  Bathroom_Furniture: { name: "Bathroom", type: "residential", defaultWeight: "medium", defaultSize: "medium" },
  Dining_Room_Furniture: { name: "Dining Room", type: "residential", defaultWeight: "medium", defaultSize: "medium" },
  Wardrobes_closet: { name: "Wardrobes & Closets", type: "residential", defaultWeight: "heavy", defaultSize: "large" },
  Children_Baby_Items: { name: "Children & Baby", type: "residential", defaultWeight: "light", defaultSize: "small" },
  Carpets_Rugs: { name: "Carpets & Rugs", type: "residential", defaultWeight: "light", defaultSize: "small" },
  Garden_Outdoor: { name: "Garden & Outdoor", type: "residential", defaultWeight: "medium", defaultSize: "large" },
  Electrical_Electronic: { name: "Electrical & Electronics", type: "residential", defaultWeight: "medium", defaultSize: "medium" },
  Gym_Fitness_Equipment: { name: "Gym & Fitness", type: "residential", defaultWeight: "heavy", defaultSize: "large" },
  Musical_instruments: { name: "Musical Instruments", type: "both", defaultWeight: "heavy", defaultSize: "medium" },
  Office_furniture: { name: "Office Furniture", type: "business", defaultWeight: "medium", defaultSize: "medium" },
  Antiques_Collectibles: { name: "Antiques & Collectibles", type: "both", defaultWeight: "heavy", defaultSize: "medium" },
  Special_Awkward_items: { name: "Special & Awkward Items", type: "both", defaultWeight: "heavy", defaultSize: "large" },
  Pet_items: { name: "Pet Items", type: "residential", defaultWeight: "light", defaultSize: "small" },
  Bag_luggage_box: { name: "Bags, Luggage & Boxes", type: "both", defaultWeight: "light", defaultSize: "small" },
  Miscellaneous_household: { name: "Miscellaneous", type: "both", defaultWeight: "light", defaultSize: "small" },
};

function toSlug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function deriveItemName(fileName) {
  return fileName
    .replace(/\.[^/.]+$/, "")
    .replace(/_jpg_\d+kg$/i, "")
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function deriveItemWeightKg(fileName) {
  const match = fileName.match(/_(\d+)kg(?:\.[a-z0-9]+)?$/i);
  return match?.[1] ? Number(match[1]) : 20;
}

function includesAny(text, values) {
  return values.some((value) => text.includes(value));
}

function hasAll(text, values) {
  return values.every((value) => text.includes(value));
}

function dims(lengthM, widthM, heightM, note) {
  return { lengthM, widthM, heightM, note };
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function metricFor(entry) {
  const category = CATEGORY_CONFIG[entry.Category];
  const fileName = entry.FileName;
  const name = deriveItemName(fileName);
  const slug = toSlug(name);
  const text = `${slug} ${entry.Category.toLowerCase()}`;
  const parsedWeightKg = deriveItemWeightKg(fileName);
  let d = dims(0.6, 0.45, 0.45, "medium household item");
  let handlingMinutes = 6;
  let confidence = "MEDIUM";
  let rationale = "Category and item name imply a normal household item; filename weight is used as the transported weight.";
  let specialist = false;

  if (includesAny(text, ["vault", "safe", "hot-tub", "pool-table", "grand-piano", "upright-piano", "home-vault", "server-cabinet", "commercial", "oversized"])) {
    d = dims(2.0, 1.0, 1.2, "specialist oversized/heavy item");
    handlingMinutes = 90;
    confidence = "LOW";
    specialist = true;
    rationale = "Specialist item with access, equipment, risk, or disassembly requirements that should be reviewed before pricing.";
  } else if (includesAny(text, ["piano"])) {
    d = dims(1.55, 0.7, 1.25, "piano body");
    handlingMinutes = 80;
    confidence = "LOW";
    specialist = true;
    rationale = "Piano-related work is specialist and access dependent.";
  } else if (includesAny(text, ["aquarium"])) {
    d = dims(1.8, 0.65, 0.8, "empty aquarium tank");
    handlingMinutes = 65;
    confidence = "LOW";
    specialist = true;
    rationale = "Large glass aquarium is fragile and normally requires manual review.";
  } else if (hasAll(text, ["super", "king", "bed"])) {
    d = dims(2.0, 1.8, 0.28, "disassembled super-king bed frame");
    handlingMinutes = 26;
    confidence = "HIGH";
    rationale = "Super-king bed frames are normally transported disassembled as long rails/headboard pieces.";
  } else if (hasAll(text, ["king", "bed"])) {
    d = dims(2.0, 1.5, 0.25, "disassembled king bed frame");
    handlingMinutes = 22;
    confidence = "HIGH";
    rationale = "King bed frames are normally transported disassembled as rails/headboard pieces.";
  } else if (hasAll(text, ["queen", "bed"]) || hasAll(text, ["double", "bed"])) {
    d = dims(1.9, 1.35, 0.25, "disassembled double/queen bed frame");
    handlingMinutes = 20;
    confidence = "HIGH";
    rationale = "Double/queen bed frames are normally transported disassembled.";
  } else if (hasAll(text, ["single", "bed"]) || includesAny(text, ["toddler-bed"])) {
    d = dims(1.9, 0.9, 0.22, "disassembled single/toddler bed frame");
    handlingMinutes = 16;
    confidence = "HIGH";
    rationale = "Single bed frames are typically light enough for one mover when disassembled.";
  } else if (includesAny(text, ["bunk-bed"])) {
    d = dims(2.0, 0.95, 0.45, "disassembled bunk bed sections");
    handlingMinutes = 34;
    confidence = "HIGH";
    rationale = "Bunk beds are bulky and normally split into rails, ladders, and panels.";
  } else if (includesAny(text, ["wardrobe", "armoire", "walk-in-closet", "built-in-wardrobe", "sliding-door-wardrobe", "mirrored-wardrobe"])) {
    d = dims(1.2, 0.6, 1.8, "wardrobe carcass or panelled sections");
    handlingMinutes = includesAny(text, ["single-door", "portable"]) ? 18 : 34;
    confidence = includesAny(text, ["built-in", "walk-in", "custom"]) ? "LOW" : "HIGH";
    rationale = confidence === "LOW"
      ? "Built-in or custom wardrobe work is access and dismantling dependent."
      : "Wardrobes are bulky and usually moved as carcasses or large panels.";
  } else if (includesAny(text, ["sectional", "corner-sofa"])) {
    d = dims(2.4, 1.0, 0.85, "sectional sofa modules");
    handlingMinutes = 38;
    confidence = "HIGH";
    rationale = "Sectional sofas are bulky but usually split into modules.";
  } else if (includesAny(text, ["sleeper-sofa", "sofa-bed"])) {
    d = dims(2.0, 0.95, 0.85, "sofa bed");
    handlingMinutes = 34;
    confidence = "HIGH";
    rationale = "Sofa beds are compact but heavy and normally require two movers.";
  } else if (includesAny(text, ["4-seat", "5-seat", "6-seat", "large-sofa", "chesterfield-sofa-4"])) {
    d = dims(2.4, 0.95, 0.85, "large sofa");
    handlingMinutes = 30;
    confidence = "HIGH";
    rationale = "Large multi-seat sofas are volume-led and normally need two movers.";
  } else if (includesAny(text, ["3-seat", "recliner-sofa", "sofa-3"])) {
    d = dims(2.05, 0.9, 0.85, "three-seat sofa");
    handlingMinutes = 26;
    confidence = "HIGH";
    rationale = "Three-seat sofas are bulky and stair/access sensitive.";
  } else if (includesAny(text, ["2-seat", "loveseat", "chesterfield-sofa-2"])) {
    d = dims(1.55, 0.85, 0.85, "two-seat sofa");
    handlingMinutes = 20;
    confidence = "HIGH";
    rationale = "Two-seat sofas are bulky but smaller than three-seat variants.";
  } else if (includesAny(text, ["armchair", "accent-chair", "single-sofa-chair", "recliner", "rocking-chair"])) {
    d = dims(0.85, 0.85, 0.9, "single upholstered chair");
    handlingMinutes = 14;
    confidence = "HIGH";
    rationale = "Single upholstered chairs are moderate volume with simple handling.";
  } else if (includesAny(text, ["dining-table-set"])) {
    d = dims(1.6, 0.95, 0.75, "table plus chairs grouped as set");
    handlingMinutes = 30;
    confidence = "MEDIUM";
    rationale = "A dining set combines table and chairs; exact split depends on assembly.";
  } else if (includesAny(text, ["conference-table"])) {
    d = dims(2.4, 1.1, 0.25, "conference table top and legs");
    handlingMinutes = 30;
    confidence = "HIGH";
    rationale = "Conference tables are large but often transported with legs removed.";
  } else if (includesAny(text, ["dining-table", "kitchen-table", "outdoor-dining", "outdoor-table"])) {
    d = dims(1.5, 0.9, 0.2, "table top with legs removed where possible");
    handlingMinutes = 18;
    confidence = "HIGH";
    rationale = "Tables are normally transported with legs removed or protected as one piece.";
  } else if (includesAny(text, ["coffee-table", "side-table", "end-table", "console-table", "bedside-table", "nesting-table"])) {
    d = dims(0.95, 0.55, 0.45, "small table");
    handlingMinutes = 8;
    confidence = "HIGH";
    rationale = "Small tables are low handling difficulty unless unusually heavy.";
  } else if (includesAny(text, ["desk", "secretary-desk"])) {
    d = dims(1.35, 0.7, 0.75, "desk body or separated top");
    handlingMinutes = includesAny(text, ["executive", "u-shaped", "secretary"]) ? 28 : 16;
    confidence = includesAny(text, ["secretary", "u-shaped", "executive"]) ? "MEDIUM" : "HIGH";
    rationale = "Desks vary by construction; large executive/secretary desks are handled conservatively.";
  } else if (includesAny(text, ["dining-chairs", "chairs-set", "set-2", "set4", "set6", "kids-table-4chairs"])) {
    d = dims(1.0, 0.55, 0.9, "stacked chair set");
    handlingMinutes = 14;
    confidence = "MEDIUM";
    rationale = "Chair set counts in the name imply grouped handling rather than a single chair.";
  } else if (includesAny(text, ["chair", "stool", "bench", "ottoman", "footstool"])) {
    d = dims(0.75, 0.55, 0.55, "single chair/seat");
    handlingMinutes = 8;
    confidence = "HIGH";
    rationale = "Small seating items have modest volume and simple handling.";
  } else if (includesAny(text, ["chest-drawers", "dresser", "sideboard", "buffet", "filing-cabinet", "storage-cabinet", "display-cabinet", "china-cabinet", "hutch", "bookcase", "bookshelf", "linen-cabinet", "vanity-unit"])) {
    d = dims(1.05, 0.5, 1.2, "cabinet or shelving unit");
    handlingMinutes = includesAny(text, ["display-cabinet", "china-cabinet", "glass", "hutch"]) ? 30 : 20;
    confidence = includesAny(text, ["glass", "display", "china", "antique", "secretary"]) ? "MEDIUM" : "HIGH";
    rationale = "Cabinets and shelving are volume-led; glass/antique variants are handled conservatively.";
  } else if (includesAny(text, ["fridge", "freezer", "washing-machine", "dishwasher", "tumble-dryer", "dryer", "cooker", "oven"])) {
    d = dims(0.7, 0.65, 1.45, "domestic appliance upright");
    handlingMinutes = includesAny(text, ["american-fridge", "commercial", "large-capacity"]) ? 36 : 24;
    confidence = "HIGH";
    rationale = "Domestic appliances are weight-led and require careful upright transport.";
  } else if (includesAny(text, ["microwave", "mini-fridge", "portable-air-conditioner", "robot-vacuum", "vacuum-cleaner", "printer", "projector", "soundbar", "speaker", "gaming-console", "desktop-computer", "computer-monitor", "laptop", "tablet", "router", "kettle", "coffee-maker"])) {
    d = dims(0.55, 0.4, 0.35, "boxed small appliance/electronic");
    handlingMinutes = includesAny(text, ["printer", "desktop-computer", "projector", "monitor"]) ? 8 : 5;
    confidence = "HIGH";
    rationale = "Small electronics are normally boxed or carried as compact items.";
  } else if (includesAny(text, ["television"])) {
    if (includesAny(text, ["85inch"])) d = dims(1.9, 0.18, 1.1, "85 inch television packed upright");
    else if (includesAny(text, ["75inch"])) d = dims(1.7, 0.16, 1.0, "75 inch television packed upright");
    else if (includesAny(text, ["65inch"])) d = dims(1.45, 0.14, 0.85, "65 inch television packed upright");
    else if (includesAny(text, ["55inch"])) d = dims(1.25, 0.13, 0.75, "55 inch television packed upright");
    else if (includesAny(text, ["50inch"])) d = dims(1.15, 0.13, 0.68, "50 inch television packed upright");
    else d = dims(0.95, 0.12, 0.58, "small television packed upright");
    handlingMinutes = d.lengthM >= 1.45 ? 16 : 10;
    confidence = "HIGH";
    rationale = "Televisions are fragile and transported upright with padding/box volume.";
  } else if (includesAny(text, ["moving-box", "storage-boxes", "storage-containers", "storage-bins"])) {
    d = dims(0.45, 0.35, 0.35, "filled moving box or stacked storage container");
    handlingMinutes = 5;
    confidence = "HIGH";
    rationale = "Moving boxes are treated as filled operational boxes, not empty cardboard.";
  } else if (includesAny(text, ["suitcase", "travel-bag", "garment-bag", "backpack", "luggage"])) {
    d = dims(0.75, 0.35, 0.35, "packed bag or suitcase");
    handlingMinutes = 4;
    confidence = "HIGH";
    rationale = "Bags and suitcases are compact, usually one-person items.";
  } else if (includesAny(text, ["rug", "runner", "carpet", "curtain"])) {
    d = dims(1.8, 0.25, 0.25, "rolled textile");
    handlingMinutes = 5;
    confidence = "HIGH";
    rationale = "Rugs and curtains are moved rolled or folded.";
  } else if (includesAny(text, ["mirror", "picture-frame", "wall-art", "glass"])) {
    d = dims(1.0, 0.12, 0.8, "flat fragile item with padding");
    handlingMinutes = 10;
    confidence = "MEDIUM";
    rationale = "Flat fragile items require padding and careful handling; dimensions vary by item.";
  } else if (includesAny(text, ["lamp", "lighting", "fan", "ceiling-fan"])) {
    d = dims(0.45, 0.45, 0.9, "lamp or fan boxed/protected");
    handlingMinutes = 6;
    confidence = "MEDIUM";
    rationale = "Lighting items are light but fragile/awkward.";
  } else if (includesAny(text, ["lawnmower", "garden-shed", "gazebo", "outdoor-kitchen"])) {
    d = dims(1.4, 0.8, 0.9, "garden equipment or dismantled outdoor unit");
    handlingMinutes = 32;
    confidence = includesAny(text, ["outdoor-kitchen", "gazebo", "riding"]) ? "LOW" : "MEDIUM";
    specialist = includesAny(text, ["outdoor-kitchen", "riding"]);
    rationale = specialist
      ? "Large garden equipment/outdoor kitchens need manual access and equipment review."
      : "Garden equipment is bulky and often dirty/awkward.";
  } else if (includesAny(text, ["bbq", "grill", "parasol", "umbrella", "planter", "fountain", "garden-bench", "outdoor-storage"])) {
    d = dims(1.0, 0.6, 0.7, "garden/outdoor item");
    handlingMinutes = 14;
    confidence = "MEDIUM";
    rationale = "Outdoor items vary by construction and may need conservative handling.";
  } else if (includesAny(text, ["exercise-bike", "treadmill", "elliptical", "rowing-machine", "weight-bench", "punching-bag", "home-gym"])) {
    d = dims(1.5, 0.75, 1.2, "fitness equipment");
    handlingMinutes = includesAny(text, ["treadmill", "home-gym"]) ? 45 : 24;
    confidence = includesAny(text, ["treadmill", "home-gym"]) ? "LOW" : "MEDIUM";
    specialist = includesAny(text, ["treadmill", "home-gym"]);
    rationale = "Fitness equipment can be heavy, awkward, and sometimes needs dismantling.";
  } else if (includesAny(text, ["guitar", "violin", "keyboard", "digital-piano", "drum-kit"])) {
    d = dims(1.1, 0.45, 0.35, "instrument in case or boxed");
    handlingMinutes = includesAny(text, ["digital-piano", "drum-kit"]) ? 18 : 6;
    confidence = "MEDIUM";
    rationale = "Non-piano instruments are fragile but usually boxed/cased.";
  } else if (includesAny(text, ["baby", "stroller", "crib", "playpen", "high-chair", "nursery", "toy", "kids"])) {
    d = dims(0.9, 0.55, 0.75, "baby/children item");
    handlingMinutes = includesAny(text, ["nursery-set", "bunk-bed"]) ? 24 : 9;
    confidence = "MEDIUM";
    rationale = "Children and nursery items vary but are usually light-to-medium and compact.";
  } else if (includesAny(text, ["pet", "dog-crate", "cat-tree", "bird-cage", "wheelchair", "mobility-scooter"])) {
    d = dims(0.9, 0.65, 0.85, "pet/accessibility item");
    handlingMinutes = includesAny(text, ["mobility-scooter", "wheelchair"]) ? 20 : 10;
    confidence = includesAny(text, ["mobility-scooter", "wheelchair"]) ? "MEDIUM" : "HIGH";
    rationale = "Pet/accessibility items are generally single pieces; powered equipment is heavier.";
  } else if (entry.Category === "Bathroom_Furniture" || entry.Category === "Miscellaneous_household") {
    d = dims(0.55, 0.35, 0.65, "small household/bathroom item");
    handlingMinutes = 5;
    confidence = "MEDIUM";
    rationale = "Small household item with limited exact dimensions in the catalogue name.";
  }

  const volumeM3 = Math.max(0.01, round(d.lengthM * d.widthM * d.heightM, 3));
  const weightKg = Math.max(1, parsedWeightKg);
  const bulky = volumeM3 >= 0.85 || d.lengthM >= 1.8 || d.heightM >= 1.6;
  const heavy = weightKg >= 55 || includesAny(text, ["fridge", "freezer", "washing-machine", "safe", "piano", "hot-tub", "pool-table", "wardrobe", "vault"]);
  const requiresTwoPeople = specialist || heavy || bulky || weightKg >= 45 || includesAny(text, ["sofa", "wardrobe", "appliance", "bed-frame", "conference-table"]);
  const minimumCrew = requiresTwoPeople ? 2 : 1;

  return {
    slug,
    name,
    category: entry.Category,
    categoryName: category?.name ?? entry.Category,
    imagePath: `/images/items/${entry.Category}/${entry.FileName}`,
    transportedLengthM: d.lengthM,
    transportedWidthM: d.widthM,
    transportedHeightM: d.heightM,
    estimatedVolumeM3: volumeM3,
    estimatedWeightKg: weightKg,
    handlingMinutes,
    bulky,
    requiresTwoPeople,
    heavy,
    specialist,
    minimumCrew,
    confidence,
    rationale: `${rationale} Transport assumption: ${d.note}.`,
  };
}

function validateMetric(metric) {
  const numericChecks = [
    ["transportedLengthM", 0.01, 5],
    ["transportedWidthM", 0.01, 3],
    ["transportedHeightM", 0.01, 3],
    ["estimatedVolumeM3", 0.005, 20],
    ["estimatedWeightKg", 0.1, 2000],
    ["handlingMinutes", 1, 480],
    ["minimumCrew", 1, 6],
  ];
  for (const [key, min, max] of numericChecks) {
    const value = metric[key];
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new Error(`${metric.slug} has invalid ${key}: ${value}`);
    }
  }
  const expectedVolume = round(metric.transportedLengthM * metric.transportedWidthM * metric.transportedHeightM, 3);
  if (Math.abs(expectedVolume - metric.estimatedVolumeM3) > 0.001) {
    throw new Error(`${metric.slug} volume ${metric.estimatedVolumeM3} does not match dimensions ${expectedVolume}`);
  }
  if (!["HIGH", "MEDIUM", "LOW"].includes(metric.confidence)) {
    throw new Error(`${metric.slug} has invalid confidence ${metric.confidence}`);
  }
}

const manifestPath = path.join(process.cwd(), "item-manifest.json");
const dataDir = path.join(process.cwd(), "src", "lib", "items");
const docsDir = path.join(process.cwd(), "docs");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const seen = new Set();
const metrics = manifest.map(metricFor).map((metric, index) => {
  let slug = metric.slug;
  if (seen.has(slug)) slug = `${toSlug(metric.category)}-${slug}-${index}`;
  seen.add(slug);
  return { ...metric, slug };
});

for (const metric of metrics) validateMetric(metric);

const confidenceCounts = metrics.reduce((counts, metric) => {
  counts[metric.confidence] = (counts[metric.confidence] ?? 0) + 1;
  return counts;
}, {});

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(docsDir, { recursive: true });

fs.writeFileSync(
  path.join(dataDir, "item-metrics-v2.json"),
  `${JSON.stringify({
    datasetVersion: DATASET_VERSION,
    generatedFrom: "item-manifest.json",
    itemCount: metrics.length,
    confidenceCounts,
    notes: [
      "Operational moving estimates for pricing demand, not exact customer product measurements.",
      "Runtime pricing reads this versioned file and does not infer metrics from item names.",
      "LOW-confidence and specialist items are intentionally routed to manual review.",
    ],
    items: metrics,
  }, null, 2)}\n`
);

const rows = [
  "| Slug | Item | Category | LxWxH m | Volume m3 | Weight kg | Handling min | Bulky | Two people | Heavy | Specialist | Min crew | Confidence | Rationale |",
  "| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | ---: | --- | --- |",
  ...metrics.map((metric) => (
    `| ${metric.slug} | ${metric.name.replaceAll("|", "\\|")} | ${metric.categoryName} | ${metric.transportedLengthM} x ${metric.transportedWidthM} x ${metric.transportedHeightM} | ${metric.estimatedVolumeM3} | ${metric.estimatedWeightKg} | ${metric.handlingMinutes} | ${metric.bulky ? "yes" : "no"} | ${metric.requiresTwoPeople ? "yes" : "no"} | ${metric.heavy ? "yes" : "no"} | ${metric.specialist ? "yes" : "no"} | ${metric.minimumCrew} | ${metric.confidence} | ${metric.rationale.replaceAll("|", "\\|")} |`
  )),
];

const lowConfidence = metrics.filter((metric) => metric.confidence === "LOW");
fs.writeFileSync(
  path.join(docsDir, "item-metrics-v2-review.md"),
  [
    "# Item Metrics v2 Review",
    "",
    `Dataset version: ${DATASET_VERSION}`,
    `Items analysed: ${metrics.length}`,
    `Confidence counts: HIGH ${confidenceCounts.HIGH ?? 0}, MEDIUM ${confidenceCounts.MEDIUM ?? 0}, LOW ${confidenceCounts.LOW ?? 0}`,
    "",
    "LOW-confidence and specialist items are not automatically priced by dynamic inventory pricing v2.",
    "",
    "## LOW-Confidence Items",
    "",
    lowConfidence.length
      ? lowConfidence.map((metric) => `- ${metric.slug}: ${metric.name}`).join("\n")
      : "None.",
    "",
    "## Full Catalogue Review Table",
    "",
    rows.join("\n"),
    "",
  ].join("\n")
);

console.log(`Generated ${metrics.length} item metrics (${DATASET_VERSION}).`);
console.log(`Confidence: HIGH ${confidenceCounts.HIGH ?? 0}, MEDIUM ${confidenceCounts.MEDIUM ?? 0}, LOW ${confidenceCounts.LOW ?? 0}.`);
