import { transferRecs } from "../data/mockData";

export function TransferPanel() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 leading-relaxed max-w-2xl">
        Each recommendation weighs inter-DC freight cost against expected chargeback exposure. "Wait" is only recommended when an inbound PO arrives before the stockout window.
      </p>

      <div className="space-y-4">
        {transferRecs.map((rec) => {
          const isTransfer = rec.recommendation === "TRANSFER";
          const isCritical = rec.urgency === "critical";

          return (
            <div
              key={rec.id}
              className={`rounded-xl border-2 bg-white overflow-hidden ${
                isCritical ? "border-[oklch(0.55_0.22_25)]" : "border-[oklch(0.72_0.17_65)]"
              }`}
            >
              {/* Header */}
              <div
                className={`flex items-center justify-between px-5 py-3 ${
                  isCritical ? "bg-[oklch(0.96_0.04_25)]" : "bg-[oklch(0.97_0.04_65)]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold tracking-widest ${
                      isCritical ? "bg-[oklch(0.55_0.22_25)] text-white" : "bg-[oklch(0.72_0.17_65)] text-white"
                    }`}
                  >
                    {rec.urgency.toUpperCase()}
                  </span>
                  <div>
                    <span className="font-semibold text-gray-900 text-sm">{rec.product}</span>
                    <span className="font-mono text-xs text-gray-400 ml-2">{rec.sku}</span>
                  </div>
                </div>
                <div
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold ${
                    isTransfer
                      ? "bg-[oklch(0.13_0.03_240)] text-white"
                      : "bg-white border border-[oklch(0.72_0.17_65)] text-[oklch(0.52_0.17_65)]"
                  }`}
                >
                  {isTransfer ? "↗ TRANSFER" : "⏳ WAIT"}
                </div>
              </div>

              {/* Body */}
              <div className="p-5">
                {/* Route + cost breakdown */}
                <div className="grid grid-cols-2 gap-6 mb-4">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Transfer Route</div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                      <span className="bg-gray-100 rounded px-2 py-1 font-mono">{rec.from}</span>
                      <span className="text-gray-400">→</span>
                      <span className="bg-gray-100 rounded px-2 py-1 font-mono">{rec.to}</span>
                      <span className="text-gray-500">· {rec.qty.toLocaleString()} units</span>
                    </div>
                  </div>
                  {rec.inboundEta && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Inbound PO ETA</div>
                      <div className="font-mono text-sm text-gray-700">{rec.inboundEta}</div>
                    </div>
                  )}
                </div>

                {/* Cost comparison */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Freight Cost</div>
                    <div className="font-mono text-lg font-bold text-gray-900">${rec.freightCost.toLocaleString()}</div>
                    <div className="text-[10px] text-gray-400">if we transfer</div>
                  </div>
                  <div className="bg-[oklch(0.96_0.04_25)] rounded-lg p-3 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[oklch(0.55_0.22_25)] mb-1">CB Exposure</div>
                    <div className="font-mono text-lg font-bold text-[oklch(0.45_0.22_25)]">${rec.chargebackRisk.toLocaleString()}</div>
                    <div className="text-[10px] text-gray-400">if we don't</div>
                  </div>
                  <div
                    className={`rounded-lg p-3 text-center ${
                      isTransfer ? "bg-[oklch(0.96_0.04_145)]" : "bg-gray-50"
                    }`}
                  >
                    <div
                      className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${
                        isTransfer ? "text-[oklch(0.45_0.15_145)]" : "text-gray-400"
                      }`}
                    >
                      Net Saving
                    </div>
                    <div
                      className={`font-mono text-lg font-bold ${
                        isTransfer ? "text-[oklch(0.45_0.15_145)]" : "text-gray-500"
                      }`}
                    >
                      ${rec.netSaving.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-gray-400">vs. doing nothing</div>
                  </div>
                </div>

                {/* Reasoning */}
                <div className="bg-[oklch(0.97_0.005_240)] rounded-lg px-4 py-3 text-sm text-gray-600 leading-relaxed border-l-4 border-gray-300 mb-4">
                  {rec.reasoning}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {isTransfer ? (
                    <>
                      <button className="rounded-lg bg-[oklch(0.13_0.03_240)] hover:bg-[oklch(0.22_0.04_240)] text-white text-sm font-semibold px-4 py-2 transition-colors">
                        Approve Transfer
                      </button>
                      <button className="rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm font-medium px-4 py-2 transition-colors">
                        Override — Wait Instead
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="rounded-lg border border-[oklch(0.72_0.17_65)] text-[oklch(0.52_0.17_65)] hover:bg-[oklch(0.97_0.04_65)] text-sm font-semibold px-4 py-2 transition-colors">
                        Monitor PO Status
                      </button>
                      <button className="rounded-lg bg-[oklch(0.13_0.03_240)] hover:bg-[oklch(0.22_0.04_240)] text-white text-sm font-medium px-4 py-2 transition-colors">
                        Override — Transfer Now
                      </button>
                    </>
                  )}
                  <button className="rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-400 text-sm px-3 py-2 transition-colors">
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
