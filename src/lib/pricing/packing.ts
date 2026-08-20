export type PackingMode = "none" | "materials" | "full";

type PackingBand = "small" | "two_bed" | "three_bed" | "four_bed" | "five_plus";

const PACKING_PRICE_PENCE: Record<PackingBand, { materials: number; full: number }> = {
  small: { materials: 4500, full: 14500 },
  two_bed: { materials: 6500, full: 19500 },
  three_bed: { materials: 8500, full: 24500 },
  four_bed: { materials: 11000, full: 32500 },
  five_plus: { materials: 13500, full: 39500 },
};

function packingBandForMove(moveSize: string | null | undefined, itemUnits: number): PackingBand {
  if (moveSize === "2-bedrooms") return "two_bed";
  if (moveSize === "3-bedrooms" || moveSize === "office") return "three_bed";
  if (moveSize === "4-bedrooms") return "four_bed";
  if (moveSize === "5-plus-bedrooms") return "five_plus";

  if (itemUnits > 93) return "five_plus";
  if (itemUnits > 68) return "four_bed";
  if (itemUnits > 50) return "three_bed";
  if (itemUnits > 35) return "two_bed";
  return "small";
}

export function packingChargePenceForMove(
  mode: PackingMode,
  moveSize: string | null | undefined,
  itemUnits: number
) {
  if (mode === "none") return 0;
  const band = packingBandForMove(moveSize, itemUnits);
  return PACKING_PRICE_PENCE[band][mode];
}
