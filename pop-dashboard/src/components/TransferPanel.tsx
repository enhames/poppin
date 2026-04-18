import { transferRecs } from "../data/mockData";

function CostBar({ freight, chargeback }: { freight: number; chargeback: number }) {
  const max = Math.max(freight, chargeback);
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
          <span>Chargeback exposure</span>
          <span className="mono font-semibold text-red-600">${chargeback.toLocaleString()}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-red-400" style={{ width: `${cbPct}%` }} />
        </div>
      </div>
    </div>
  );
}

export function TransferPanel() {
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
            NJ has the worst delay at 24.6 days avg.
            Never treat an expected PO arrival as certain.
          </p>
          <div className="mt-3 pt-3 border-t border-amber-100">
            <p className="text-xs text-amber-700 font-medium">
              Rule: DC below 14d supply + PO more than 2 weeks out → initiate transfer
            </p>
          </div>
        </div>
      </div>

      {/* Transfer cards */}
      {transferRecs.map((rec) => {
        const isTransfer = rec.recommendation === "TRANSFER";
        const isCritical = rec.urgency === "critical";
        const isDemo = rec.sku === "F-04130";

        return (
          <div key={rec.id} className={`bg-white rounded-xl border-2 overflow-hidden shadow-sm ${
            isCritical ? "border-red-200" : "border-amber-200"
          }`}>
            {/* Card header */}
            <div className={`flex items-center justify-between px-5 py-3.5 ${isCritical ? "bg-red-50" : "bg-amber-50"}`}>
              <div className="flex items-center gap-2.5">
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 border ${
                  isCritical ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isCritical ? "bg-red-500" : "bg-amber-400"}`} />
                  {rec.urgency.charAt(0).toUpperCase() + rec.urgency.slice(1)}
                </span>
                <h3 className="text-sm font-bold text-gray-900">{rec.product}</h3>
                <span className="mono text-[11px] text-gray-400 bg-white/70 rounded px-1.5 py-0.5">{rec.sku}</span>
                {isDemo && (
                  <span className="text-[11px] font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-2 py-0.5">
                    Demo SKU
                  </span>
                )}
              </div>
              <div className={`flex items-center gap-1.5 text-sm font-bold rounded-lg px-3.5 py-1.5 ${
                isTransfer
                  ? "text-white"
                  : "border border-amber-300 text-amber-700 bg-white"
              }`} style={isTransfer ? { backgroundColor: "#0E1B2E" } : {}}>
                {isTransfer ? "↗ Transfer" : "⏳ Wait"}
              </div>
            </div>

            {/* Card body */}
            <div className="p-5">
              {/* Route chips */}
              <div className="flex items-center gap-2 mb-5">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Route</span>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-3 py-1">
                    {rec.from}
                  </span>
                  <span className="text-gray-400 text-sm">→</span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded-full px-3 py-1">
                    {rec.to}
                  </span>
                  <span className="text-sm text-gray-500 mono">· {rec.qty.toLocaleString()} units · ${rec.freightRatePerUnit}/unit</span>
                </div>
              </div>

              {/* Two-column: cost visual + details */}
              <div className="grid grid-cols-2 gap-6 mb-5">
                {/* Cost comparison bar */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Cost Comparison</p>
                  <CostBar freight={rec.freightCost} chargeback={rec.chargebackRisk} />
                  <div className={`mt-3 p-3 rounded-lg ${rec.netSaving > 0 ? "bg-emerald-50 border border-emerald-200" : "bg-gray-50 border border-gray-200"}`}>
                    <p className="text-[11px] font-bold uppercase tracking-widest mb-0.5" style={{ color: rec.netSaving > 0 ? "#0A7B4B" : "#6B7280" }}>
                      Net saving
                    </p>
                    <p className={`mono text-xl font-bold ${rec.netSaving > 0 ? "text-emerald-700" : "text-gray-500"}`}>
                      {rec.netSaving > 0 ? `$${rec.netSaving.toLocaleString()}` : `−$${Math.abs(rec.netSaving).toLocaleString()}`}
                    </p>
                    {rec.netSaving <= 0 && (
                      <p className="text-[11px] text-gray-400 mt-0.5">Freight exceeds CB risk — see reasoning</p>
                    )}
                  </div>
                </div>

                {/* PO + reasoning */}
                <div className="space-y-3">
                  {rec.inboundEta && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Inbound PO</p>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                        <p className="text-xs text-gray-600 leading-relaxed">{rec.poLeadTimeNote}</p>
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Reasoning</p>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                      <p className="text-xs text-gray-600 leading-relaxed">{rec.reasoning}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-4 border-t border-gray-100">
                {isTransfer ? (
                  <>
                    <button className="text-sm font-bold text-white rounded-lg px-5 py-2.5" style={{ backgroundColor: "#0E1B2E" }}>
                      Approve Transfer
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
                    <button className="text-sm font-medium text-gray-700 border border-gray-200 rounded-lg px-5 py-2.5 hover:bg-gray-50">
                      Override — Transfer Now
                    </button>
                  </>
                )}
                <button className="text-sm text-gray-400 border border-gray-100 rounded-lg px-4 py-2.5 hover:bg-gray-50 ml-auto">
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
