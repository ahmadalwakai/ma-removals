export type PackingMode = "none" | "materials" | "full";

export function packingChargePenceForMove(
  mode: PackingMode,
  _moveSize: string | null | undefined,
  selectedUnits: number
): number {
  if (mode === "none") return 0;
  if (mode === "materials") return Math.max(0, selectedUnits) * 300;
  return Math.max(0, selectedUnits) * 1000;
}
