import { useState, useEffect, useMemo } from "react";
import { api, type Recommendation } from "../api/client";
import ScatterPlot from "./ScatterPlot";

function CostBar({ freight, chargeback }: { freight: number; chargeback: number }) {
  const max = Math.max(freight, chargeback, 1);
  const freightPct = (freight / max) * 100;
  const cbPct = (chargeback / max) * 100;
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <div className="flex justify-between text-xs mb-0.5" style={{ color: "#6B6560" }}>
          <span>Freight cost</span>
          <span className="mono font-semibold" style={{ color: "#403A34" }}>${freight.toLocaleString()}</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#E8E2DA" }}>
          <div className="h-full rounded-full" style={{ width: `${freightPct}%`, backgroundColor: "#403A34" }} />
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs mb-0.5" style={{ color: "#6B6560" }}>
          <span>Penalty exposure (without transfer)</span>
          <span className="mono font-semibold" style={{ color: "#7A0F1D" }}>${chargeback.toLocaleString()}</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#E8E2DA" }}>
          <div className="h-full rounded-full" style={{ width: `${cbPct}%`, backgroundColor: "#A6192E" }} />
        </div>
      </div>
    </div>
  );
}

function RecCard({ rec }: { rec: Recommendation }) {
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTransfer = rec.recommendation === "TRANSFER";
  const netPositive = rec.transfer_value > 0;

  async function handleApprove() {
    setApproving(true);
    setError(null);
    try {
      await api.approveTransfer({
        sku: rec.sku,
        item_name: rec.item_name,
        source_dc: rec.source_dc,
        destination_dc: rec.destination_dc,
        units: rec.transfer_units,
      });
      setApproved(true);
    } catch (e) {
      setError("Failed to submit transfer. Check backend connection.");
    } finally {
      setApproving(false);
    }
  }

  const headerBg = isTransfer ? "#FDF6F6" : "#FDF9EC";
  const headerBorder = isTransfer ? "#F4D5D8" : "#E5B664";
  const topBorderColor = isTransfer ? "#7A0F1D" : "#B97A15";

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "#FFFFFF", border: `1px solid ${headerBorder}`, borderTopWidth: "3px", borderTopColor: topBorderColor, boxShadow: "0 1px 2px rgba(20,17,15,0.05)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5" style={{ backgroundColor: headerBg, borderBottom: `1px solid ${headerBorder}` }}>
        <div className="flex items-center gap-2.5">
          <h3 className="text-sm font-bold" style={{ color: "#14110F", fontFamily: "Fraunces, serif", fontVariationSettings: "'opsz' 48" }}>{rec.item_name}</h3>
          <span className="mono text-[11px] rounded px-1.5 py-0.5" style={{ color: "#8E8680", backgroundColor: "rgba(255,255,255,0.7)" }}>{rec.sku}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm font-bold rounded-lg px-3.5 py-1.5" style={
          isTransfer
            ? { backgroundColor: "#14110F", color: "#FFFFFF" }
            : { border: "1px solid #E5B664", color: "#8C5A0F", backgroundColor: "#FFFFFF" }
        }>
          {isTransfer ? "↗ Transfer" : "⏳ Wait"}
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        {/* Route */}
        <div className="flex items-center gap-2 mb-5">
          <span className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "#8E8680" }}>Route</span>
          <span className="inline-flex items-center text-xs font-semibold rounded-full px-3 py-1" style={{ color: "#125F54", backgroundColor: "#EEF7F5", border: "1px solid #7AC4B8" }}>
            {rec.source_dc}
          </span>
          <span className="text-sm" style={{ color: "#B8B1AA" }}>→</span>
          <span className="inline-flex items-center text-xs font-semibold rounded-full px-3 py-1" style={{ color: "#403A34", backgroundColor: "#FAF7F1", border: "1px solid #D6CFC7" }}>
            {rec.destination_dc}
          </span>
          <span className="text-sm mono" style={{ color: "#6B6560" }}>· {rec.transfer_units.toLocaleString()} units</span>
        </div>

        {/* Cost visual */}
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] mb-3" style={{ color: "#8E8680" }}>Cost Comparison</p>
          <CostBar freight={rec.transfer_cost} chargeback={rec.avoided_penalty} />
          <div className="mt-3 p-3 rounded-lg" style={{
            backgroundColor: netPositive ? "#EEF7F5" : "#FAF7F1",
            border: `1px solid ${netPositive ? "#7AC4B8" : "#D6CFC7"}`,
          }}>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] mb-0.5" style={{ color: netPositive ? "#125F54" : "#6B6560" }}>
              Net value
            </p>
            <p className="mono text-xl font-bold" style={{ color: netPositive ? "#125F54" : "#6B6560" }}>
              {netPositive ? `+$${rec.transfer_value.toLocaleString()}` : `−$${Math.abs(rec.transfer_value).toLocaleString()}`}
            </p>
            {!netPositive && (
              <p className="text-[11px] mt-0.5" style={{ color: "#8E8680" }}>Freight exceeds penalty avoided — wait for PO</p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-4 items-center" style={{ borderTop: "1px solid #F2EDE5" }}>
          {approved ? (
            <span className="text-sm font-semibold rounded-lg px-5 py-2.5" style={{ color: "#125F54", backgroundColor: "#EEF7F5", border: "1px solid #7AC4B8" }}>
              ✓ Transfer logged
            </span>
          ) : isTransfer ? (
            <>
              <button
                onClick={handleApprove}
                disabled={approving}
                className="text-sm font-bold text-white rounded-lg px-5 py-2.5 disabled:opacity-60 transition-opacity"
                style={{ backgroundColor: "#7A0F1D" }}
              >
                {approving ? "Submitting…" : "Approve Transfer"}
              </button>
              <button className="text-sm font-semibold rounded-lg px-5 py-2.5 transition-colors" style={{ color: "#403A34", border: "1px solid #D6CFC7", backgroundColor: "#FFFFFF" }}>
                Override — Wait for PO
              </button>
            </>
          ) : (
            <>
              <button className="text-sm font-semibold rounded-lg px-5 py-2.5 transition-colors" style={{ color: "#8C5A0F", border: "1px solid #E5B664", backgroundColor: "#FEF7E8" }}>
                Set PO Watch Alert
              </button>
              <button
                onClick={handleApprove}
                disabled={approving}
                className="text-sm font-semibold rounded-lg px-5 py-2.5 disabled:opacity-60 transition-colors"
                style={{ color: "#403A34", border: "1px solid #D6CFC7", backgroundColor: "#FFFFFF" }}
              >
                {approving ? "Submitting…" : "Override — Transfer Now"}
              </button>
            </>
          )}
          {error && <p className="text-xs ml-2" style={{ color: "#7A0F1D" }}>{error}</p>}
        </div>
      </div>
    </div>
  );
}

export function TransferPanel() {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getRecommendations()
      .then(setRecs)
      .catch(() => setError("Could not load recommendations. Is the backend running?"))
      .finally(() => setLoading(false));
  }, []);

  const sortedRecs = useMemo(
    () => [...recs].sort((a, b) => b.transfer_value - a.transfer_value),
    [recs]
  );

  const transferCount = recs.filter((r) => r.recommendation === "TRANSFER").length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl px-5 py-4" style={{ backgroundColor: "#FFFFFF", border: "1px solid #7AC4B8", boxShadow: "0 1px 2px rgba(20,17,15,0.05)" }}>
          <p className="text-xs font-bold uppercase tracking-[0.14em] mb-2" style={{ color: "#125F54" }}>Hub Logic</p>
          <p className="text-sm leading-relaxed" style={{ color: "#6B6560" }}>
            <strong style={{ color: "#14110F" }}>DC-SF is the redistribution hub</strong>, not a peer DC.
            2023–2025: exported 3.29M units, received only 248K.
            Always check SF first for any NJ or LA shortage.
          </p>
          <div className="flex gap-4 mt-3 pt-3" style={{ borderTop: "1px solid #DCEFEB" }}>
            {[["SF→NJ", "$0.51/unit", false], ["SF→LA", "$0.17/unit", false], ["Reverse", "$1.55/unit ⚠", true]].map(([route, cost, warn]) => (
              <div key={route as string}>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "#8E8680" }}>{route}</p>
                <p className="mono text-xs font-semibold" style={{ color: warn ? "#7A0F1D" : "#403A34" }}>{cost}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl px-5 py-4" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5B664", boxShadow: "0 1px 2px rgba(20,17,15,0.05)" }}>
          <p className="text-xs font-bold uppercase tracking-[0.14em] mb-2" style={{ color: "#8C5A0F" }}>PO Reliability Risk</p>
          <p className="text-sm leading-relaxed" style={{ color: "#6B6560" }}>
            <strong style={{ color: "#14110F" }}>81.5% of inbound POs arrive late</strong> by an average of 28 days.
            NJ has the worst delay at 24.6 days avg. Never treat an expected PO arrival as certain.
          </p>
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid #FBEACB" }}>
            <p className="text-xs font-medium" style={{ color: "#8C5A0F" }}>
              Rule: DC below 14d supply + PO more than 2 weeks out → initiate transfer
            </p>
          </div>
        </div>
      </div>

      {/* Scatter plot visualization */}
      {!loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Transfer Cost vs. Net Savings</h3>
          <ScatterPlot data={sortedRecs} />
        </div>
      )}

      {/* State: loading / error / empty */}
      {loading && (
        <div className="rounded-xl px-6 py-8 text-center text-sm" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8E2DA", color: "#8E8680" }}>
          Loading recommendations…
        </div>
      )}
      {error && (
        <div className="rounded-xl px-6 py-4 text-sm" style={{ backgroundColor: "#FBEEEF", border: "1px solid #F4D5D8", color: "#7A0F1D" }}>
          {error}
        </div>
      )}
      {!loading && !error && recs.length === 0 && (
        <div className="rounded-xl px-6 py-8 text-center text-sm" style={{ backgroundColor: "#EEF7F5", border: "1px solid #7AC4B8", color: "#125F54" }}>
          No imbalances detected. All DCs are within healthy supply thresholds.
        </div>
      )}

      {!loading && recs.length > 0 && (
        <div className="flex items-center gap-2 text-sm" style={{ color: "#6B6560" }}>
          <span className="font-semibold" style={{ color: "#14110F" }}>{recs.length} recommendations</span>
          · {transferCount > 0 ? (
            <span className="font-semibold" style={{ color: "#7A0F1D" }}>{transferCount} require immediate transfer</span>
          ) : (
            <span>none require immediate action</span>
          )}
        </div>
      )}

      {/* Recommendation cards */}
      {sortedRecs.map((rec) => (
        <RecCard key={`${rec.sku}-${rec.source_dc}-${rec.destination_dc}`} rec={rec} />
      ))}
    </div>
  );
}
