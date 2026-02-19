"use client";

import { useMemo, useState } from "react";
import EstimateSummary from "./EstimateSummary";

type Access = "stairs" | "elevator" | "long-carry" | "parking" | "none";
type HomeSize = "studio" | "1-bed" | "2-bed" | "3-bed" | "4-bed";

type EstimateResponse = {
  ok: boolean;
  distance?: number;
  isLocal?: boolean;
  result?: any;
  error?: string;
};

type AdvisorMessage = {
  role: "user" | "assistant";
  text: string;
};

type AdvisorIntent = "WORTH_IT" | "LOWER_COST" | "ASSUMPTIONS" | "UNKNOWN";

const SEEDED_QUESTIONS: { key: AdvisorIntent; label: string }[] = [
  { key: "WORTH_IT", label: "Should I hire movers for this move?" },
  { key: "LOWER_COST", label: "How can I lower this estimate?" },
  { key: "ASSUMPTIONS", label: "What assumptions is this estimate making?" },
];

function isFiveDigitZip(z: string) {
  return /^\d{5}$/.test(z.trim());
}

function formatMoveType(isLocal?: boolean) {
  if (isLocal === undefined) return "Unknown";
  return isLocal ? "Local (Hourly)" : "Line-haul (Weight + Miles)";
}

function classifyIntent(text: string): AdvisorIntent {
  const t = text.toLowerCase();

  if (
    t.includes("worth") ||
    t.includes("should i hire") ||
    t.includes("hire movers") ||
    t.includes("do i need") ||
    t.includes("dumb") ||
    t.includes("buy") ||
    t.includes("replace") ||
    t.includes("ship") ||
    t.includes("freight")
  ) {
    return "WORTH_IT";
  }

  if (
    t.includes("lower") ||
    t.includes("cheaper") ||
    t.includes("reduce") ||
    t.includes("save") ||
    t.includes("cut cost") ||
    t.includes("less expensive")
  ) {
    return "LOWER_COST";
  }

  if (
    t.includes("assumption") ||
    t.includes("calculate") ||
    t.includes("how") ||
    t.includes("why") ||
    t.includes("rate") ||
    t.includes("tariff") ||
    t.includes("filed")
  ) {
    return "ASSUMPTIONS";
  }

  return "UNKNOWN";
}

function bullet(lines: string[]) {
  return lines.map((l) => `• ${l}`).join("\n");
}

type RecalcOverrides = Partial<{
  pickupZip: string;
  dropoffZip: string;
  homeSize: HomeSize | undefined;
  packing: boolean;
  access: Access[];
  crewSize: 2 | 3 | 4;
  trucks: 1 | 2;
}>;

export default function ChatWidget() {
  // Estimator inputs
  const [pickupZip, setPickupZip] = useState("");
  const [dropoffZip, setDropoffZip] = useState("");
  const [homeSize, setHomeSize] = useState<HomeSize | undefined>();
  const [packing, setPacking] = useState<boolean>(false);
  const [access, setAccess] = useState<Access[]>([]);
  const [crewSize, setCrewSize] = useState<2 | 3 | 4>(3);
  const [trucks, setTrucks] = useState<1 | 2>(1);

  // Optional lead capture
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Estimate response
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<EstimateResponse | null>(null);

  // Advisor chat
  const [advisorInput, setAdvisorInput] = useState("");
  const [messages, setMessages] = useState<AdvisorMessage[]>([
    {
      role: "assistant",
      text:
        "Ask me about your estimate. I can explain assumptions, suggest cost reducers, or help decide if movers make sense.",
    },
  ]);

  const estimateReady = useMemo(() => {
    const z1 = pickupZip.trim();
    const z2 = dropoffZip.trim();
    return isFiveDigitZip(z1) && isFiveDigitZip(z2) && !!resp?.ok && !!resp?.result;
  }, [pickupZip, dropoffZip, resp]);

  async function recalc(overrides: RecalcOverrides = {}) {
    setLoading(true);
    try {
      const r = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupZip: overrides.pickupZip ?? pickupZip,
          dropoffZip: overrides.dropoffZip ?? dropoffZip,
          homeSize: overrides.homeSize ?? homeSize,
          packing: overrides.packing ?? packing,
          access: overrides.access ?? access,
          crewSize: overrides.crewSize ?? crewSize,
          trucks: overrides.trucks ?? trucks,
        }),
      });
      const json = await r.json();
      setResp(json);
    } catch (e) {
      console.error(e);
      setResp({ ok: false, error: "Network error" });
    } finally {
      setLoading(false);
    }
  }

  function toggleAccess(a: Access) {
    setAccess((prev) => {
      const next = prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a];
      // Important: call recalc with the computed next value to avoid stale-state payloads
      recalc({ access: next });
      return next;
    });
  }

  function buildAdvisorAnswer(intent: AdvisorIntent, questionText: string) {
    // If we don't have core context, keep the assistant honest and push to the form
    if (!isFiveDigitZip(pickupZip) || !isFiveDigitZip(dropoffZip)) {
      return (
        "Start with your pickup and drop-off ZIP codes, and I’ll answer using your estimate context.\n\n" +
        bullet(["Enter both ZIPs", "Tap Update estimate", "Then ask again"])
      );
    }

    const isLocal = resp?.isLocal;
    const result = resp?.result;
    const distance = typeof resp?.distance === "number" ? Math.round(resp.distance) : undefined;

    const moveType = formatMoveType(isLocal);

    // Provide context line for all answers
    const contextLine = `Context: ${moveType}${distance ? ` • ~${distance} mi` : ""}${
      homeSize ? ` • ${homeSize}` : ""
    }${packing ? " • packing" : ""}${access?.length ? ` • access: ${access.join(", ")}` : ""}.`;

    // Pull what we can, but never invent new pricing
    const range =
      result?.baseCostRange && Array.isArray(result.baseCostRange)
        ? `$${result.baseCostRange[0]} – $${result.baseCostRange[1]}`
        : undefined;

    const disclaimer =
      "Nonbinding guidance. Final charges depend on actual conditions on move day and filed rate applicability.";

    if (intent === "WORTH_IT") {
      const smallMoveHeuristic =
        homeSize === "studio" || homeSize === undefined || homeSize === ("1-bed" as any);

      const longDistanceHeuristic = isLocal === false;

      const recommendation =
        longDistanceHeuristic && smallMoveHeuristic
          ? "For a small, long-distance move, hiring movers is often not cost-effective unless you’re moving multiple high-value items."
          : "For most moves with real volume, movers make sense—especially when access constraints or time pressure are present.";

      const betterOptions = longDistanceHeuristic && smallMoveHeuristic
        ? [
            "Ship a few items (freight/parcel) and buy bulky items locally",
            "Sell/replace low-value furniture instead of paying long-distance labor/truck time",
            "Combine items into one larger shipment (or wait until you have more volume)",
          ]
        : [
            "Lower cost by packing yourself and improving access/parking where possible",
            "If flexible, choose off-peak days and a tight parking plan to reduce time",
          ];

      const whatChanges = [
        "More items / heavier furniture (value of moving increases)",
        "Stairs/long-carry/parking issues (time increases)",
        "Packing included vs self-pack (labor + materials)",
      ];

      return (
        `${recommendation}\n\n` +
        `${contextLine}\n\n` +
        (range ? `Your current estimate range: **${range}**.\n\n` : "") +
        `What would change the decision:\n${bullet(whatChanges)}\n\n` +
        `Alternatives / optimizations:\n${bullet(betterOptions)}\n\n` +
        `${disclaimer}`
      );
    }

    if (intent === "LOWER_COST") {
      const tips: string[] = [
        "Pack non-fragile items yourself (packing adds labor + materials).",
        "Declutter before the move — fewer items reduces time (local) or weight (line-haul).",
        "Improve access: reserve parking, shorten carry distance, pre-stage boxes near the door.",
        "Disassemble beds/tables ahead of time (or keep hardware labeled).",
      ];

      if (access.includes("stairs") || access.includes("long-carry")) {
        tips.unshift("Access is a cost driver here — stairs/long-carry typically add time.");
      }
      if (packing) {
        tips.unshift("Packing is enabled — turning it off can reduce the estimate (labor + materials).");
      }

      const nextBest =
        "If you want, tell me roughly how many rooms/items you’re moving and whether you’re self-packing, and I’ll suggest the best tradeoffs.";

      return (
        `Here are the highest-impact ways to lower cost:\n${bullet(tips)}\n\n` +
        `${contextLine}\n\n` +
        (range ? `Current estimate range: **${range}**.\n\n` : "") +
        `${nextBest}\n\n` +
        `${disclaimer}`
      );
    }

    if (intent === "ASSUMPTIONS") {
      const assumptionLines: string[] = [];

      if (isLocal) {
        assumptionLines.push("Billing is hourly (local).");
        if (result?.hoursRange) {
          assumptionLines.push(
            `Estimated hours range: ${result.hoursRange[0]}–${result.hoursRange[1]} hours.`
          );
        } else {
          assumptionLines.push("Hours are inferred from home size and access factors.");
        }
        if (result?.hourlyFiledRate) {
          assumptionLines.push(
            `Uses a filed hourly rate for your selected crew size: $${result.hourlyFiledRate}/hr.`
          );
        } else {
          assumptionLines.push("Uses filed hourly rates within configured tariff bands.");
        }
      } else {
        assumptionLines.push("Billing is weight + miles (line-haul).");
        if (result?.weightAssumptionLbs) {
          assumptionLines.push(
            `Assumed weight from home size: ~${result.weightAssumptionLbs.toLocaleString()} lbs.`
          );
        } else {
          assumptionLines.push("Weight is inferred from home size (MVP heuristic).");
        }
        if (typeof distance === "number") {
          assumptionLines.push(`Distance used: ~${distance} miles (ZIP-based).`);
        }
        if (result?.perLbPerMileFiledRate) {
          assumptionLines.push(
            `Uses a filed rate within the tariff band: $${result.perLbPerMileFiledRate.toFixed(
              4
            )}/lb/mi.`
          );
        }
      }

      if (packing) {
        assumptionLines.push("Packing is included (adds labor; may add materials).");
      } else {
        assumptionLines.push("Packing is not included.");
      }

      if (access.length) {
        assumptionLines.push(`Access factors applied: ${access.join(", ")}.`);
      } else {
        assumptionLines.push("No access factors selected.");
      }

      assumptionLines.push("All outputs are nonbinding and depend on actual conditions.");

      return (
        `Here’s what this estimate is assuming:\n${bullet(assumptionLines)}\n\n` +
        `${contextLine}\n\n` +
        (range ? `Estimate range: **${range}**.\n\n` : "") +
        `${disclaimer}`
      );
    }

    // Unknown intent
    return (
      `I can help with:\n` +
      bullet([
        "Should I hire movers? (worth-it / alternatives)",
        "How to lower cost (prep / packing / access)",
        "Assumptions (how the estimate is derived)",
      ]) +
      `\n\nTry one of the suggested questions, or rephrase your question around those topics.`
    );
  }

  function askAdvisor(question: string, forcedIntent?: AdvisorIntent) {
    const intent = forcedIntent ?? classifyIntent(question);
    setMessages((prev) => [...prev, { role: "user", text: question }]);

    const answer = buildAdvisorAnswer(intent, question);
    setMessages((prev) => [...prev, { role: "assistant", text: answer }]);
  }

  async function openEstimateSheet() {
    const customer =
      contactName.trim() || contactEmail.trim() || contactPhone.trim()
        ? {
            name: contactName.trim() || undefined,
            email: contactEmail.trim() || undefined,
            phone: contactPhone.trim() || undefined,
          }
        : undefined;

    const payload = {
      customer,
      move: {
        pickupZip: pickupZip.trim(),
        dropoffZip: dropoffZip.trim(),
        distance: resp?.distance,
        type: resp?.isLocal ? "Local (Hourly)" : "Line-haul (Weight+Miles)",
        homeSize,
        crew: crewSize,
        trucks,
        packing,
        access,
      },
      pricing: {
        billing: resp?.result?.billing,
        filedRate: resp?.result?.hourlyFiledRate ?? resp?.result?.perLbPerMileFiledRate,
        range: resp?.result?.baseCostRange
          ? `$${resp.result.baseCostRange[0]} – $${resp.result.baseCostRange[1]}`
          : "",
      },
      notes: resp?.result?.notes ?? [],
      meta: {
        generatedAt: new Date().toISOString(),
      },
    };

    const res = await fetch("/api/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const html = await res.text();
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  return (
    <div className="w-full flex flex-col lg:flex-row gap-6">
      {/* Estimator + Advisor Panel */}
      <div className="flex-1 rounded-2xl border border-gray-200 bg-white/70 backdrop-blur p-4 lg:p-6 shadow-sm">
        <div className="text-sm text-gray-700 mb-4">
          Minimal input → usable answer → next best question. Start with ZIPs — I’ll do the rest.
        </div>

        {/* ZIPs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="text-xs text-gray-700">Pickup ZIP</label>
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 placeholder:text-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
              placeholder="e.g., 98116"
              inputMode="numeric"
              value={pickupZip}
              onChange={(e) => setPickupZip(e.target.value)}
              onBlur={(e) => recalc({ pickupZip: e.target.value })}
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="text-xs text-gray-700">Drop-off ZIP</label>
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 placeholder:text-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
              placeholder="e.g., 98103"
              inputMode="numeric"
              value={dropoffZip}
              onChange={(e) => setDropoffZip(e.target.value)}
              onBlur={(e) => recalc({ dropoffZip: e.target.value })}
            />
          </div>
        </div>

        {/* Home size */}
        <div className="mt-4">
          <div className="text-xs text-gray-700 mb-1">Home size</div>
          <div className="flex flex-wrap gap-2">
            {(["studio", "1-bed", "2-bed", "3-bed", "4-bed"] as HomeSize[]).map((h) => (
              <button
                key={h}
                onClick={() => {
                  setHomeSize(h);
                  recalc({ homeSize: h });
                }}
                className={`px-3 py-1.5 rounded-full border border-gray-200 text-sm ${
                  homeSize === h ? "bg-black text-white" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {h}
              </button>
            ))}
          </div>
        </div>

        {/* Packing */}
        <div className="mt-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={packing}
              onChange={(e) => {
                const next = e.target.checked;
                setPacking(next);
                recalc({ packing: next });
              }}
            />
            Include packing (materials + labor)
          </label>
        </div>

        {/* Access */}
        <div className="mt-4">
          <div className="text-xs text-gray-700 mb-1">Access factors (optional)</div>
          <div className="flex flex-wrap gap-2">
            {(["stairs", "elevator", "long-carry", "parking"] as Access[]).map((a) => (
              <button
                key={a}
                onClick={() => toggleAccess(a)}
                className={`px-3 py-1.5 rounded-full border border-gray-200 text-sm ${
                  access.includes(a) ? "bg-black text-white" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {a}
              </button>
            ))}
            <button
              onClick={() => {
                setAccess([]);
                recalc({ access: [] });
              }}
              className="px-3 py-1.5 rounded-full border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
            >
              none
            </button>
          </div>
        </div>

        {/* Crew + Trucks */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-gray-700 mb-1">Crew size</div>
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
              value={crewSize}
              onChange={(e) => {
                const next = Number(e.target.value) as 2 | 3 | 4;
                setCrewSize(next);
                recalc({ crewSize: next });
              }}
            >
              <option value={2}>2 movers</option>
              <option value={3}>3 movers (recommended)</option>
              <option value={4}>4 movers</option>
            </select>
          </div>
          <div>
            <div className="text-xs text-gray-700 mb-1">Trucks</div>
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
              value={trucks}
              onChange={(e) => {
                const next = Number(e.target.value) as 1 | 2;
                setTrucks(next);
                recalc({ trucks: next });
              }}
            >
              <option value={1}>1 truck</option>
              <option value={2}>2 trucks</option>
            </select>
          </div>
        </div>

        {/* Optional contact */}
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-900">Contact (optional)</div>
            <div className="text-xs text-gray-600">Included on the estimate sheet</div>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-700">Name</label>
              <input
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
                placeholder="Optional"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-700">Email</label>
              <input
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
                placeholder="Optional"
                inputMode="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-700">Phone</label>
              <input
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
                placeholder="Optional"
                inputMode="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="rounded-lg bg-black text-white px-4 py-2 text-sm" onClick={() => recalc()}>
            Update estimate
          </button>

          <button
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            onClick={openEstimateSheet}
            disabled={!resp?.ok}
            title={!resp?.ok ? "Enter ZIPs and generate an estimate first" : "Open print/PDF sheet"}
          >
            Open estimate sheet (print/PDF)
          </button>
        </div>

        {/* Advisor */}
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-gray-900">Advisor</div>
              <div className="text-xs text-gray-600 mt-1">
                Guided answers based on your estimate context (not open-ended chat).
              </div>
            </div>
            <div className="text-xs text-gray-500">
              {estimateReady ? "Context ready" : "Add ZIPs for best answers"}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {SEEDED_QUESTIONS.map((q) => (
              <button
                key={q.key}
                className="px-3 py-1.5 rounded-full border border-gray-200 text-xs text-gray-700 hover:bg-gray-50"
                onClick={() => askAdvisor(q.label, q.key)}
              >
                {q.label}
              </button>
            ))}
          </div>

          <div className="mt-4 h-48 overflow-auto rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-800 whitespace-pre-wrap">
            {messages.map((m, idx) => (
              <div key={idx} className={m.role === "user" ? "mb-3" : "mb-4"}>
                <div className="text-[11px] font-medium text-gray-500">
                  {m.role === "user" ? "You" : "Advisor"}
                </div>
                <div className="mt-1">{m.text}</div>
              </div>
            ))}
          </div>

          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const q = advisorInput.trim();
              if (!q) return;
              askAdvisor(q);
              setAdvisorInput("");
            }}
          >
            <input
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
              placeholder='Ask: "Is it worth hiring movers?" or "How do I lower cost?"'
              value={advisorInput}
              onChange={(e) => setAdvisorInput(e.target.value)}
            />
            <button className="rounded-lg bg-black text-white px-3 py-2 text-sm">Ask</button>
          </form>
        </div>
      </div>

      {/* Summary Card */}
      <EstimateSummary loading={loading} isLocal={resp?.isLocal} distance={resp?.distance} result={resp?.result} />
    </div>
  );
}
