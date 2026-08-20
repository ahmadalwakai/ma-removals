export type ScopedPricePreview = {
  pricingScopeKey?: string | null;
};

export function attachPricePreviewScope<T extends object>(
  previews: T[],
  pricingScopeKey: string
): Array<T & { pricingScopeKey: string }> {
  return previews.map((preview) => ({ ...preview, pricingScopeKey }));
}

export function filterPricePreviewsByScope<T extends ScopedPricePreview>(
  previews: Record<string, T>,
  pricingScopeKey: string
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(previews).filter(([, preview]) => preview.pricingScopeKey === pricingScopeKey)
  );
}

export function shouldAcceptPricePreviewResponse({
  responseRequestId,
  activeRequestId,
  responsePricingScopeKey,
  activePricingScopeKey,
}: {
  responseRequestId: number;
  activeRequestId: number;
  responsePricingScopeKey: string;
  activePricingScopeKey: string;
}) {
  return responseRequestId === activeRequestId && responsePricingScopeKey === activePricingScopeKey;
}
