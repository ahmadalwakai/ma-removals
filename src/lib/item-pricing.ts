// Item-based pricing. The real per-item weight (kg) is encoded in the image
// filename suffix, e.g. ".../armoire_oak_tudor_jpg_145kg.jpg".

export interface PriceableItem {
  name?: string;
  quantity: number;
  /** Optional explicit weight; if absent it's parsed from imagePath. */
  weightKg?: number;
  imagePath?: string;
}

/** Extract the weight in kg from an image path/filename (e.g. "_jpg_145kg.jpg" -> 145). */
export function parseItemWeightKg(imagePath?: string | null): number {
  if (!imagePath) return 0;
  const m = imagePath.match(/_(\d+)kg(?:\.[a-z0-9]+)?$/i);
  return m ? parseInt(m[1]!, 10) : 0;
}

export interface ItemsChargeConfig {
  perKg: number;
  minPerItem: number;
}

export interface ItemsChargeResult {
  total: number;
  totalUnits: number;
  totalKg: number;
}

/**
 * Compute the handling charge for the selected items.
 * Each item line is charged max(weightKg * perKg, minPerItem) per unit, so even
 * light/unknown-weight items still contribute a minimum handling fee.
 */
export function calculateItemsCharge(
  items: PriceableItem[] | undefined,
  cfg: ItemsChargeConfig
): ItemsChargeResult {
  if (!items || items.length === 0) {
    return { total: 0, totalUnits: 0, totalKg: 0 };
  }

  let total = 0;
  let totalUnits = 0;
  let totalKg = 0;

  for (const it of items) {
    const qty = Math.max(0, Math.floor(it.quantity ?? 0));
    if (qty === 0) continue;
    const weightKg = it.weightKg ?? parseItemWeightKg(it.imagePath);
    const perUnit = Math.max(weightKg * cfg.perKg, cfg.minPerItem);
    total += perUnit * qty;
    totalUnits += qty;
    totalKg += weightKg * qty;
  }

  return {
    total: Math.round(total * 100) / 100,
    totalUnits,
    totalKg: Math.round(totalKg * 10) / 10,
  };
}
