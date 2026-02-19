import { NextRequest, NextResponse } from "next/server";
import { EstimateInputSchema, EstimateInput } from "./types";
import { distanceMilesFromZips } from "@/lib/utils/distance";
import { estimate } from "@/lib/logic/estimator";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = EstimateInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const input: EstimateInput = parsed.data;

    // Future-friendly: allow a labor-only mode later without splitting endpoints.
    // For now, your UI can omit `mode` and this will behave exactly as today.
    const mode = (body?.mode as string | undefined) ?? "move"; // "move" | "labor-only"

    const access = (input.access ?? []).filter((a) => a !== "none");

    // Only compute distance/isLocal when we have both ZIPs and we're in "move" mode.
    const hasBothZips = !!input.pickupZip && !!input.dropoffZip;
    const distance =
      mode === "move" && hasBothZips
        ? distanceMilesFromZips(input.pickupZip, input.dropoffZip)
        : undefined;

    const isLocal = distance !== undefined ? distance <= 55 : undefined;

    const result = estimate({
      pickupZip: input.pickupZip,
      dropoffZip: input.dropoffZip,
      distanceMiles: distance,
      isLocal,
      homeSize: input.homeSize,
      crewSize: input.crewSize,
      trucks: input.trucks,
      packing: input.packing,
      access,
      // If/when you add labor-only in estimator logic, you can pass `mode` through too:
      // mode,
    });

    return NextResponse.json({ ok: true, distance, isLocal, result });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
