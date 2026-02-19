/**
 * WA ZIP centroid lookup (starter set).
 * Add ZIPs as needed; unknown ZIPs fall back to ZIP3 heuristic in distance.ts.
 *
 * Source suggestion for later: USPS/ZCTA centroid datasets (public) or a WA-only extract.
 */
export const WA_ZIP_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  // Seattle
  "98116": { lat: 47.5776, lng: -122.3869 }, // West Seattle
  "98103": { lat: 47.6727, lng: -122.3418 },
  "98110": { lat: 47.6474, lng: -122.5340 }, // Bainbridge Island
  "98101": { lat: 47.6105, lng: -122.3343 },

  // Tacoma
  "98402": { lat: 47.2536, lng: -122.4443 },

  // Bremerton / Kitsap
  "98310": { lat: 47.5854, lng: -122.6237 },

  // Aberdeen / Grays Harbor
  "98520": { lat: 46.9754, lng: -123.8157 },
};
