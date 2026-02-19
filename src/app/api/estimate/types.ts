import { z } from "zod";

export const EstimateInputSchema = z.object({
  pickupZip: z.string().optional(),
  dropoffZip: z.string().optional(),
  homeSize: z.enum(["studio","1-bed","2-bed","3-bed","4-bed"]).optional(),
  crewSize: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
  trucks: z.union([z.literal(1), z.literal(2)]).optional(),
  packing: z.boolean().optional(),
  access: z.array(z.enum(["stairs","elevator","long-carry","parking","none"])).optional()
});

export type EstimateInput = z.infer<typeof EstimateInputSchema>;
