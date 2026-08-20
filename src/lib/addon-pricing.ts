import { parseItemWeightKg, type PriceableItem } from "@/lib/item-pricing";

type AddonKind = "packing" | "assembly";

interface AddonPricingInput {
  config: Record<string, number>;
  items?: PriceableItem[];
  serviceType?: string;
  serviceVariant?: string | null;
}

export interface AddonChargeResult {
  total: number;
  totalUnits: number;
  totalKg: number;
  minimumApplied: number;
}

const DEFAULTS: Record<
  AddonKind,
  {
    legacyFlatFee: number;
    baseFee: number;
    perItem: number;
    perKg: number;
    minimumFee: number;
  }
> = {
  packing: {
    legacyFlatFee: 31.12,
    baseFee: 31.12,
    perItem: 8.38,
    perKg: 0.27,
    minimumFee: 44.89,
  },
  assembly: {
    legacyFlatFee: 26.33,
    baseFee: 26.33,
    perItem: 13.17,
    perKg: 0.33,
    minimumFee: 50.87,
  },
};

function cfg(config: Record<string, number>, key: string, fallback: number): number {
  return config[key] ?? fallback;
}

export function calculateServiceAddonCharge(
  kind: AddonKind,
  { config, items }: AddonPricingInput
): AddonChargeResult {
  const defaults = DEFAULTS[kind];
  const legacyFlatFee = cfg(config, `${kind}_addon_fee`, defaults.legacyFlatFee);
  const baseFee = cfg(config, `${kind}_base_fee`, Math.max(defaults.baseFee, legacyFlatFee));
  const perItem = cfg(config, `${kind}_price_per_item`, defaults.perItem);
  const perKg = cfg(config, `${kind}_price_per_kg`, defaults.perKg);

  const minimumFee = cfg(config, `${kind}_minimum_fee`, defaults.minimumFee);

  let totalUnits = 0;
  let totalKg = 0;
  for (const item of items ?? []) {
    const qty = Math.max(0, Math.floor(item.quantity ?? 0));
    if (qty === 0) continue;
    const weightKg = item.weightKg ?? parseItemWeightKg(item.imagePath);
    totalUnits += qty;
    totalKg += weightKg * qty;
  }

  const inventoryCharge =
    totalUnits > 0
      ? baseFee + totalUnits * perItem + totalKg * perKg
      : baseFee;

  const total = Math.max(inventoryCharge, minimumFee);

  return {
    total: Math.round(total * 100) / 100,
    totalUnits,
    totalKg: Math.round(totalKg * 10) / 10,
    minimumApplied: minimumFee,
  };
}

export function formatAddonChargeLabel(label: string, charge: AddonChargeResult): string {
  if (charge.totalUnits <= 0) return label;
  const itemText = `${charge.totalUnits} item${charge.totalUnits === 1 ? "" : "s"}`;
  const weightText = charge.totalKg > 0 ? ` · ${charge.totalKg} kg` : "";
  return `${label} (${itemText}${weightText})`;
}
