export interface RouteMetrics {
  distanceMiles: number;
  durationMinutes: number;
  routeHash: string;
  provider?: string;
  geometry?: string | null;
  polyline?: string | null;
  calculatedAt?: string;
}
