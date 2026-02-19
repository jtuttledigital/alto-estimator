import { ChatSlots, HomeSizeKey } from "./slots";
import {
  COMPANY_RATE_FACTOR,
  LINEHAUL_BANDS,
  LOCAL_HOURLY_BANDS,
  PACKING_CONFIG,
} from "../config/rates";

type Range = readonly [number, number];

type EstimateResult = {
  billing: "hourly" | "weight+miles" | "unknown";
  hourlyFiledRate?: number;
  perLbPerMileFiledRate?: number;
  assumedCrew?: 2 | 3 | 4;
  assumedTrucks?: 1 | 2;
  weightAssumptionLbs?: number;
  hoursRange?: Range;
  baseCostRange: Range;
  packingAdded?: { hoursAdded: number; materialsRange?: Range };
  notes: string[];
};

const HOME_SIZE_TO_WEIGHT: Record<HomeSizeKey, number> = {
  studio: 1500,
  "1-bed": 3000,
  "2-bed": 5000,
  "3-bed": 8000,
  "4-bed": 11000,
};

const HOME_SIZE_TO_HOURS: Record<HomeSizeKey, Range> = {
  studio: [2, 4],
  "1-bed": [3, 5],
  "2-bed": [5, 7],
  "3-bed": [7, 10],
  "4-bed": [9, 13],
};

function toRange(value: unknown): Range | undefined {
  // Defensive: converts [number, number] or readonly [number, number] into our Range type
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  ) {
    return [value[0], value[1]] as const;
  }
  return undefined;
}

function filedRateFromBand(min: number, max: number, override?: number) {
  if (override && override >= min && override <= max) return override;
  const rate = min + COMPANY_RATE_FACTOR * (max - min);
  return Math.round(rate * 100) / 100;
}

function findHourlyRate(crew: 2 | 3 | 4) {
  const band = LOCAL_HOURLY_BANDS.find((b) => b.crew === crew);
  if (!band) return undefined;
  return filedRateFromBand(band.minHourly, band.maxHourly, band.overrideHourly);
}

function findPerLbPerMile(weight: number) {
  const band = LINEHAUL_BANDS.find((b) => weight >= b.weightMin && weight <= b.weightMax);
  if (!band) return undefined;
  return filedRateFromBand(
    band.perLbPerMileMin,
    band.perLbPerMileMax,
    band.overridePerLbPerMile
  );
}

function bumpHoursForAccess(base: Range, access: string[] = []): Range {
  let lo = base[0];
  let hi = base[1];

  if (access.includes("stairs")) {
    lo += 0.5;
    hi += 1;
  }
  if (access.includes("long-carry")) {
    lo += 0.5;
    hi += 1;
  }
  if (access.includes("elevator")) {
    lo += 0.25;
    hi += 0.5;
  }
  if (access.includes("parking")) {
    lo += 0.25;
    hi += 0.5;
  }

  return [Math.max(0, lo), Math.max(0, hi)] as const;
}

export function estimate(slots: ChatSlots): EstimateResult {
  const notes: string[] = [];
  const result: EstimateResult = { billing: "unknown", baseCostRange: [0, 0], notes };

  const { isLocal, homeSize, crewSize, trucks, packing, access, distanceMiles } = slots;

  const chosenCrew: 2 | 3 | 4 = crewSize ?? 3;
  const chosenTrucks: 1 | 2 = trucks ?? 1;

  if (isLocal === undefined) {
    notes.push("Need both ZIP codes to determine local vs. line-haul.");
    return result;
  }

  if (isLocal) {
    result.billing = "hourly";

    const hourly = findHourlyRate(chosenCrew);
    if (!hourly) {
      notes.push("No hourly rate configured for selected crew size.");
      return result;
    }

    result.hourlyFiledRate = hourly;
    result.assumedCrew = chosenCrew;
    result.assumedTrucks = chosenTrucks;

    if (!homeSize) {
      notes.push("Provide home size to estimate hours.");
      result.baseCostRange = [hourly, hourly * 2] as const; // small teaser
      return result;
    }

    let hours: Range = HOME_SIZE_TO_HOURS[homeSize];
    hours = bumpHoursForAccess(hours, access);

    let pack: { hoursAdded: number; materialsRange?: Range } | undefined;

    if (packing) {
      const hoursAdded = PACKING_CONFIG.hoursByHomeSize[homeSize] ?? 0;

      // Convert config tuple (readonly or not) into our Range type
      const materialsRange = toRange(PACKING_CONFIG.materialsRangeByHomeSize[homeSize]);

      hours = [hours[0] + hoursAdded, hours[1] + hoursAdded] as const;
      pack = { hoursAdded, materialsRange };
    }

    result.packingAdded = pack;
    result.hoursRange = hours;

    const lo = Math.round(hours[0] * hourly);
    const hi = Math.round(hours[1] * hourly);

    result.baseCostRange = [lo, hi] as const;
    if (distanceMiles !== undefined) notes.push(`Local move (~${Math.round(distanceMiles)} mi).`);
    return result;
  }

  // Line-haul
  result.billing = "weight+miles";

  if (!homeSize || distanceMiles === undefined) {
    notes.push("Provide home size and both ZIPs to estimate weight + miles.");
    return result;
  }

  const weight = HOME_SIZE_TO_WEIGHT[homeSize];
  result.weightAssumptionLbs = weight;

  const rate = findPerLbPerMile(weight);
  if (!rate) {
    notes.push("No line-haul band configured for this weight.");
    return result;
  }
  result.perLbPerMileFiledRate = rate;

  const base = weight * distanceMiles * rate;

  let bump = 1;
  if (access?.includes("stairs")) bump += 0.05;
  if (access?.includes("long-carry")) bump += 0.05;
  if (access?.includes("elevator")) bump += 0.03;
  if (access?.includes("parking")) bump += 0.03;

  let materialsRange: Range | undefined;

  if (packing) {
    materialsRange = toRange(PACKING_CONFIG.materialsRangeByHomeSize[homeSize]);
    bump += 0.08; // packing labor
  }

  const lo = Math.round(base * 0.9 * bump + (materialsRange ? materialsRange[0] : 0));
  const hi = Math.round(base * 1.1 * bump + (materialsRange ? materialsRange[1] : 0));

  result.baseCostRange = [lo, hi] as const;

  notes.push(`Line-haul estimate: ~${Math.round(distanceMiles)} miles.`);
  if (materialsRange) result.packingAdded = { hoursAdded: 0, materialsRange };

  return result;
}
