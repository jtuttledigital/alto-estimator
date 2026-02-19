/**
 * Company-configurable rates inside Tariff 15-C bands.
 * Replace placeholder numbers with the bands you file.
 */

export type LocalHourlyBand = {
  crew: 2 | 3 | 4;
  minHourly: number;          // tariff min ($/hr)
  maxHourly: number;          // tariff max ($/hr)
  overrideHourly?: number;    // optional: your filed hourly rate
};

export type LinehaulBand = {
  weightMin: number;          // lbs
  weightMax: number;          // lbs
  perLbPerMileMin: number;    // tariff min ($/lb/mi)
  perLbPerMileMax: number;    // tariff max ($/lb/mi)
  overridePerLbPerMile?: number; // optional: your filed rate
};

export const COMPANY_RATE_FACTOR = 0.75; // 75% inside the band by default

export const LOCAL_HOURLY_BANDS: LocalHourlyBand[] = [
  // <<< replace with your real tariff bands >>>
  { crew: 2, minHourly: 120, maxHourly: 200 },
  { crew: 3, minHourly: 160, maxHourly: 260 },
  { crew: 4, minHourly: 200, maxHourly: 320 },
];

export const LINEHAUL_BANDS: LinehaulBand[] = [
  // <<< replace/add brackets as needed >>>
  { weightMin: 0,    weightMax: 3000,  perLbPerMileMin: 0.0040, perLbPerMileMax: 0.0080 },
  { weightMin: 3001, weightMax: 7000,  perLbPerMileMin: 0.0035, perLbPerMileMax: 0.0070 },
  { weightMin: 7001, weightMax: 12000, perLbPerMileMin: 0.0030, perLbPerMileMax: 0.0060 },
];

export const PACKING_CONFIG = {
  // hours added if packing is included
  hoursByHomeSize: {
    studio: 1,
    "1-bed": 2,
    "2-bed": 3,
    "3-bed": 4,
    "4-bed": 5,
  } as const,

  // blended materials budget ranges by size
  materialsRangeByHomeSize: {
    studio: [75, 125],
    "1-bed": [125, 200],
    "2-bed": [200, 325],
    "3-bed": [300, 450],
    "4-bed": [400, 600],
  } as const,
};
