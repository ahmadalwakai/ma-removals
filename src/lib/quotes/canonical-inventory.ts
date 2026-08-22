export interface CanonicalInventoryInputLine {
  itemId: string;
  quantity: number;
  room?: string | null;
}

export interface NormalizedCanonicalInventoryLine {
  itemId: string;
  quantity: number;
  room: string | null;
  itemMetricVersion: string;
}

export interface NormalizeCanonicalInventoryOptions {
  itemMetricVersion: string;
  maxQuantity?: number;
}

export function normalizeCanonicalInventory(
  inventory: readonly CanonicalInventoryInputLine[],
  options: NormalizeCanonicalInventoryOptions
): { lines: NormalizedCanonicalInventoryLine[]; invalidQuantity: boolean } {
  const maxQuantity = options.maxQuantity ?? 99;
  const quantities = new Map<string, { itemId: string; room: string | null; quantity: number }>();
  let invalidQuantity = false;

  for (const item of inventory) {
    const itemId = item.itemId.trim();
    if (!itemId) continue;
    const room = typeof item.room === "string" && item.room.trim() ? item.room.trim() : null;
    const key = `${itemId}\u0000${room ?? ""}`;
    if (item.quantity === 0) continue;
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 0 || item.quantity > maxQuantity) {
      invalidQuantity = true;
      continue;
    }
    const existing = quantities.get(key);
    quantities.set(key, {
      itemId,
      room,
      quantity: (existing?.quantity ?? 0) + item.quantity,
    });
  }

  const lines = Array.from(quantities.values())
    .map(({ itemId, room, quantity }) => {
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > maxQuantity) {
        invalidQuantity = true;
      }
      return {
        itemId,
        quantity,
        room,
        itemMetricVersion: options.itemMetricVersion,
      };
    })
    .sort((a, b) => (
      a.itemId.localeCompare(b.itemId) ||
      (a.room ?? "").localeCompare(b.room ?? "")
    ));

  return { lines, invalidQuantity };
}

export function canonicalInventorySignature(
  inventory: readonly CanonicalInventoryInputLine[],
  options: NormalizeCanonicalInventoryOptions
): string {
  return normalizeCanonicalInventory(inventory, options)
    .lines
    .map((item) => `${item.itemId}:${item.room ?? ""}:${item.quantity}:${item.itemMetricVersion}`)
    .join("|");
}
