"use client";
import { useState } from "react";
import { currency } from "@/lib/utils/helpers";

type Props = {
  loading?: boolean;
  isLocal?: boolean;
  distance?: number;
  result?: any;
};

export default function EstimateSummary({ loading, isLocal, distance, result }: Props) {
  const [open, setOpen] = useState(false);

  const billing = result?.billing ?? "unknown";
  const range = result?.baseCostRange as [number, number] | undefined;

  const distanceLabel = typeof distance === "number" ? `~${Math.round(distance)} miles` : "—";

  return (
    <aside className="w-full lg:w-96 flex-shrink-0 rounded-2xl border p-4 lg:p-6 bg-white/70 backdrop-blur shadow-sm text-gray-800">
      <h3 className="text-lg font-semibold">Estimate Summary</h3>

      <div className="mt-2 text-sm text-gray-800">
        {loading && <div>Calculating…</div>}
        {!loading && billing === "unknown" && <div>Add ZIPs to get started.</div>}
      </div>

      {!loading && billing !== "unknown" && (
        <div className="mt-4 space-y-2 text-sm">
          <div>
            <span className="font-medium">Billing:</span>{" "}
            {billing === "hourly" ? "Hourly (Local)" : "Weight + Miles (Line-haul)"}
          </div>

          <div>
            <span className="font-medium">Distance:</span> {distanceLabel}
          </div>

          {billing === "hourly" && result?.hourlyFiledRate && (
            <div>
              <span className="font-medium">Filed Hourly:</span> {currency(result.hourlyFiledRate)}/hr
            </div>
          )}

          {billing === "weight+miles" && result?.perLbPerMileFiledRate && (
            <div>
              <span className="font-medium">Filed Rate:</span> ${result.perLbPerMileFiledRate.toFixed(4)}/lb/mi
            </div>
          )}

          {range && (
            <div className="mt-2">
              <div className="font-medium">Estimated Range</div>
              <div className="text-2xl font-semibold">
                {currency(range[0])} – {currency(range[1])}
              </div>
              <div className="text-xs text-gray-700 mt-1">
                Nonbinding; final depends on actual conditions.
              </div>
            </div>
          )}

          {result?.notes?.length ? (
            <ul className="mt-2 text-xs text-gray-700 list-disc pl-4">
              {result.notes.map((n: string, i: number) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          ) : null}

          <div className="mt-4">
            <button
              className="w-full rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Hide calculation details" : "How this is calculated"}
            </button>

            {open && (
              <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs text-gray-800 space-y-2">
                {billing === "hourly" ? (
                  <>
                    <div className="font-medium">Local (Hourly)</div>
                    <div>
                      Uses filed hourly rate by crew size. Hours are inferred from home size + access factors.
                    </div>
                    {result?.hoursRange ? (
                      <div>
                        Hours range: <span className="font-medium">{result.hoursRange[0]}–{result.hoursRange[1]}</span>
                      </div>
                    ) : null}
                    {result?.packingAdded?.hoursAdded ? (
                      <div>
                        Packing adds: <span className="font-medium">{result.packingAdded.hoursAdded}</span> hours
                        {result?.packingAdded?.materialsRange ? (
                          <>
                            {" "}and materials{" "}
                            <span className="font-medium">
                              {currency(result.packingAdded.materialsRange[0])}–{currency(result.packingAdded.materialsRange[1])}
                            </span>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div className="font-medium">Line-haul (Weight + Miles)</div>
                    <div>
                      Uses assumed weight from home size × distance (ZIP-based) × filed $/lb/mi within tariff bands.
                    </div>
                    {result?.weightAssumptionLbs ? (
                      <div>
                        Assumed weight: <span className="font-medium">{result.weightAssumptionLbs.toLocaleString()} lbs</span>
                      </div>
                    ) : null}
                    {result?.packingAdded?.materialsRange ? (
                      <div>
                        Packing materials:{" "}
                        <span className="font-medium">
                          {currency(result.packingAdded.materialsRange[0])}–{currency(result.packingAdded.materialsRange[1])}
                        </span>
                      </div>
                    ) : null}
                  </>
                )}

                <div className="pt-2 text-gray-700">
                  Based on WA Tariff 15-C concepts; outputs are nonbinding and depend on actual conditions.
                </div>
              </div>
            )}

            <p className="mt-2 text-xs text-gray-700">
              Based on WA Tariff 15-C; filed rates within configured bands apply.
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
