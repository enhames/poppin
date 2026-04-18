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
        <div className="flex justify-between text-xs text-gray-500 mb-0.5">
          <span>Freight cost</span>
          <span className="mono font-semibold text-gray-700">${freight.toLocaleString()}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-slate-500" style={{ width: `${freightPct}%` }} />
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-500 mb-0.5">
          <span>Penalty exposure (without transfer)</span>
          <span className="mono font-semibold text-red-600">${chargeback.toLocaleString()}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-red-400" style={{ width: `${cbPct}%` }} />
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

  return (
    <div className={`bg-white rounded-xl border-2 overflow-hidden shadow-sm ${
      isTransfer ? "border-red-200" : "border-amber-200"
    }`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-5 py-3.5 ${isTransfer ? "bg-red-50" : "bg-amber-50"}`}>
        <div className="flex items-center gap-2.5">
          <h3 className="text-sm font-bold text-gray-900">{rec.item_name}</h3>
          <span className="mono text-[11px] text-gray-400 bg-white/70 rounded px-1.5 py-0.5">{rec.sku}</span>
        </div>
        <div className={`flex items-center gap-1.5 text-sm font-bold rounded-lg px-3.5 py-1.5 ${
          isTransfer ? "text-white" : "border border-amber-300 text-amber-700 bg-white"
        }`} style={isTransfer ? { backgroundColor: "#0E1B2E" } : {}}>
          {isTransfer ? "↗ Transfer" : "⏳ Wait"}
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        {/* Route */}
        <div className="flex items-center gap-2 mb-5">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Route</span>
          <span className="inline-flex items-center text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-3 py-1">
            {rec.source_dc}
          </span>
          <span className="text-gray-400 text-sm">→</span>
          <span className="inline-flex items-center text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded-full px-3 py-1">
            {rec.destination_dc}
          </span>
          <span className="text-sm text-gray-500 mono">· {rec.transfer_units.toLocaleString()} units</span>
        </div>

        {/* Cost visual */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Cost Comparison</p>
          <CostBar freight={rec.transfer_cost} chargeback={rec.avoided_penalty} />
          <div className={`mt-3 p-3 rounded-lg ${netPositive ? "bg-emerald-50 border border-emerald-200" : "bg-gray-50 border border-gray-200"}`}>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-0.5" style={{ color: netPositive ? "#0A7B4B" : "#6B7280" }}>
              Net value
            </p>
            <p className={`mono text-xl font-bold ${netPositive ? "text-emerald-700" : "text-gray-500"}`}>
              {netPositive ? `+$${rec.transfer_value.toLocaleString()}` : `−$${Math.abs(rec.transfer_value).toLocaleString()}`}
            </p>
            {!netPositive && (
              <p className="text-[11px] text-gray-400 mt-0.5">Freight exceeds penalty avoided — wait for PO</p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-4 border-t border-gray-100 items-center">
          {approved ? (
            <span className="text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-5 py-2.5">
              ✓ Transfer logged
            </span>
          ) : isTransfer ? (
            <>
              <button
                onClick={handleApprove}
                disabled={approving}
                className="text-sm font-bold text-white rounded-lg px-5 py-2.5 disabled:opacity-60 transition-opacity"
                style={{ backgroundColor: "#0E1B2E" }}
              >
                {approving ? "Submitting…" : "Approve Transfer"}
              </button>
              <button className="text-sm font-medium text-gray-600 border border-gray-200 rounded-lg px-5 py-2.5 hover:bg-gray-50">
                Override — Wait for PO
              </button>
            </>
          ) : (
            <>
              <button className="text-sm font-semibold text-amber-700 border border-amber-300 bg-amber-50 rounded-lg px-5 py-2.5 hover:bg-amber-100">
                Set PO Watch Alert
              </button>
              <button
                onClick={handleApprove}
                disabled={approving}
                className="text-sm font-medium text-gray-700 border border-gray-200 rounded-lg px-5 py-2.5 hover:bg-gray-50 disabled:opacity-60"
              >
                {approving ? "Submitting…" : "Override — Transfer Now"}
              </button>
            </>
          )}
          {error && <p className="text-xs text-red-600 ml-2">{error}</p>}
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
      {/* Info banners */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-teal-200 rounded-xl px-5 py-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-teal-600 mb-2">Hub Logic</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            <strong className="text-gray-900">DC-SF is the redistribution hub</strong>, not a peer DC.
            2023–2025: exported 3.29M units, received only 248K.
            Always check SF first for any NJ or LA shortage.
          </p>
          <div className="flex gap-4 mt-3 pt-3 border-t border-teal-100">
            {[["SF→NJ", "$0.51/unit"], ["SF→LA", "$0.17/unit"], ["Reverse", "$1.55/unit ⚠"]].map(([route, cost]) => (
              <div key={route}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{route}</p>
                <p className={`mono text-xs font-semibold ${route === "Reverse" ? "text-red-500" : "text-gray-700"}`}>{cost}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white border border-amber-200 rounded-xl px-5 py-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-2">PO Reliability Risk</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            <strong className="text-gray-900">81.5% of inbound POs arrive late</strong> by an average of 28 days.
            NJ has the worst delay at 24.6 days avg. Never treat an expected PO arrival as certain.
          </p>
          <div className="mt-3 pt-3 border-t border-amber-100">
            <p className="text-xs text-amber-700 font-medium">
              Rule: DC below 14d supply + PO more than 2 weeks out → initiate transfer
            </p>
          </div>
        </div>
      </div>

      {/* Scatter plot visualization */}
      {!loading && !error && recs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Transfer Cost vs. Net Savings</h3>
          <ScatterPlot data={sortedRecs} />
        </div>
      )}

      {/* State: loading / error / empty */}
      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-8 text-center text-sm text-gray-400 shadow-sm">
          Loading recommendations…
        </div>
      )}
      {error && (
        <div className="bg-red-50 rounded-xl border border-red-200 px-6 py-4 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      )}
      {!loading && !error && recs.length === 0 && (
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 px-6 py-8 text-center text-sm text-emerald-700 shadow-sm">
          No imbalances detected. All DCs are within healthy supply thresholds.
        </div>
      )}

      {/* Summary pill */}
      {!loading && recs.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="font-semibold text-gray-900">{recs.length} recommendations</span>
          · {transferCount > 0 ? (
            <span className="font-semibold text-red-600">{transferCount} require immediate transfer</span>
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
