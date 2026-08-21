export interface CanonicalInventoryInputLine {
  itemId: string;
  quantity: number;
}

export interface NormalizedCanonicalInventoryLine {
  itemId: string;
  quantity: number;
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
  const quantities = new Map<string, number>();
  let invalidQuantity = false;

  for (const item of inventory) {
    const itemId = item.itemId.trim();
    if (!itemId) continue;
    if (item.quantity === 0) continue;
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 0 || item.quantity > maxQuantity) {
      invalidQuantity = true;
      continue;
    }
    quantities.set(itemId, (quantities.get(itemId) ?? 0) + item.quantity);
  }

  const lines = Array.from(quantities.entries())
    .map(([itemId, quantity]) => {
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > maxQuantity) {
        invalidQuantity = true;
      }
      return {
        itemId,
        quantity,
        itemMetricVersion: options.itemMetricVersion,
      };
    })
    .sort((a, b) => a.itemId.localeCompare(b.itemId));

  return { lines, invalidQuantity };
}

export function canonicalInventorySignature(
  inventory: readonly CanonicalInventoryInputLine[],
  options: NormalizeCanonicalInventoryOptions
): string {
  return normalizeCanonicalInventory(inventory, options)
    .lines
    .map((item) => `${item.itemId}:${item.quantity}:${item.itemMetricVersion}`)
    .join("|");
}
