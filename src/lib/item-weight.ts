export function parseItemWeightKg(imagePath: string | null | undefined): number {
  const match = imagePath?.match(/_(\d+)kg(?:\.|$)/i);
  return match ? Number(match[1]) : 20;
}
