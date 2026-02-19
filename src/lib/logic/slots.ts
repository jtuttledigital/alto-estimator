export type HomeSizeKey = "studio" | "1-bed" | "2-bed" | "3-bed" | "4-bed";
export type AccessFactor = "stairs" | "elevator" | "long-carry" | "parking" | "none";

export type ChatSlots = {
  pickupZip?: string;
  dropoffZip?: string;
  distanceMiles?: number; // derived
  isLocal?: boolean;      // derived (<= 55)
  homeSize?: HomeSizeKey;
  crewSize?: 2 | 3 | 4;
  trucks?: 1 | 2;
  packing?: boolean;
  access?: AccessFactor[];
};
