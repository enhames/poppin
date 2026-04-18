import { chargebackData } from "../data/mockData";

const totalOperational = chargebackData
  .filter((r) => r.type === "operational")
  .reduce((s, r) => s + r.amount, 0);

const totalPromotional = chargebackData
  .filter((r) => r.type === "promotional")
  .reduce((s, r) => s + r.amount, 0);

const grandTotal = totalOperational + totalPromotional;

export function ChargebackTable() {
  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Total Exposure</div>
          <div className="font-mono text-2xl font-bold text-gray-900">${grandTotal.toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-1">Jan 2023 – Dec 2025</div>
        </div>
        <div className="bg-white rounded-xl border border-[oklch(0.55_0.22_25)] p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[oklch(0.55_0.22_25)] mb-1">Operational Penalties</div>
          <div className="font-mono text-2xl font-bold text-[oklch(0.45_0.22_25)]">${totalOperational.toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-1">Short ship · Late delivery · Damage</div>
        </div>
        <div className="bg-white rounded-xl border border-[oklch(0.72_0.17_65)] p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[oklch(0.62_0.17_65)] mb-1">Planned Deductions (TPR)</div>
          <div className="font-mono text-2xl font-bold text-[oklch(0.62_0.17_65)]">${totalPromotional.toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-1">Promotional — expected, not actionable</div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-[oklch(0.55_0.22_25)]" />
          Operational penalty — preventable
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-[oklch(0.82_0.10_65)]" />
          Promotional deduction (TPR) — planned
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">Cause Code</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">Channel</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">DC</th>
              <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">Incidents</th>
              <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">Total Amount</th>
              <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">Avg / Incident</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Share of Total</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {chargebackData
              .sort((a, b) => b.amount - a.amount)
              .map((row, i) => {
                const share = (row.amount / grandTotal) * 100;
                const isOperational = row.type === "operational";
                return (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-900">{row.causeCode}</td>
                    <td className="px-4 py-3 text-gray-600">{row.channel}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-gray-100 text-gray-700 rounded px-1.5 py-0.5">{row.dc}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-gray-700">{row.incidents}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-mono text-sm font-semibold ${isOperational ? "text-[oklch(0.45_0.22_25)]" : "text-[oklch(0.60_0.17_65)]"}`}>
                        ${row.amount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-gray-500">
                      ${Math.round(row.amount / row.incidents).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isOperational ? "bg-[oklch(0.55_0.22_25)]" : "bg-[oklch(0.82_0.10_65)]"}`}
                            style={{ width: `${share}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs text-gray-400">{share.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isOperational ? (
                        <span className="inline-block rounded px-2 py-0.5 text-[10px] font-bold tracking-wide bg-[oklch(0.55_0.22_25)] text-white">
                          OPERATIONAL
                        </span>
                      ) : (
                        <span className="inline-block rounded px-2 py-0.5 text-[10px] font-bold tracking-wide bg-[oklch(0.82_0.10_65)] text-white">
                          PROMO TPR
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 border-t-2 border-gray-300">
              <td colSpan={3} className="px-4 py-3 font-bold text-gray-700 text-sm">Total</td>
              <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">
                {chargebackData.reduce((s, r) => s + r.incidents, 0)}
              </td>
              <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">
                ${grandTotal.toLocaleString()}
              </td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        TPR (Temporary Price Reduction) deductions are planned promotional activity — identifiable by cause code and excluded from operational penalty reduction targets.
      </p>
    </div>
  );
}
