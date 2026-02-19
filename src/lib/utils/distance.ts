import { WA_ZIP_CENTROIDS } from "@/lib/data/waZipCentroids";

/**
 * Haversine distance in miles between two lat/lng points.
 */
function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 3958.7613; // Earth radius in miles

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Fallback heuristic (your original ZIP3 stub).
 * This is only used if we don't have centroid data for one or both ZIPs.
 */
function zip3FallbackMiles(z1: string, z2: string): number {
  const n1 = parseInt(z1.slice(0, 3), 10);
  const n2 = parseInt(z2.slice(0, 3), 10);
  return Math.abs(n1 - n2) * 6 + 9;
}

/**
 * “Realistically reasonable” distance estimate (road miles), WA-focused.
 * - If both ZIPs exist in WA_ZIP_CENTROIDS: haversine * ROAD_FACTOR
 * - Else: ZIP3 fallback (low confidence)
 *
 * Note: routing can vary with traffic and ferries; this is for ballpark estimates.
 */
export function distanceMilesFromZips(pickupZip?: string, dropoffZip?: string): number | undefined {
  if (!pickupZip || !dropoffZip) return undefined;

  const z1 = pickupZip.trim();
  const z2 = dropoffZip.trim();

  if (!/^\d{5}$/.test(z1) || !/^\d{5}$/.test(z2)) return undefined;

  const p1 = WA_ZIP_CENTROIDS[z1];
  const p2 = WA_ZIP_CENTROIDS[z2];

  // Tunable: adjust until it “feels right” for WA road networks.
  // 1.20–1.35 is a typical range for centroid→road conversion.
  const ROAD_FACTOR = 1.25;

  if (p1 && p2) {
    const straight = haversineMiles(p1.lat, p1.lng, p2.lat, p2.lng);
    return Math.max(1, Math.round(straight * ROAD_FACTOR));
  }

  // If we don't have centroid data, return a deterministic placeholder rather than lying.
  // This keeps the app functional while you expand the WA centroid map.
  return zip3FallbackMiles(z1, z2);
}
