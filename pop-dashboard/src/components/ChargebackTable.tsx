import { chargebackData, customerPenalties, yearlyPenalties } from "../data/mockData";

const GRAND_TOTAL = chargebackData.reduce((s, r) => s + r.amount, 0);
const CUSTOMER_TOTAL = customerPenalties.reduce((s, r) => s + r.amount, 0);

// Peak month (2024)
const peakYr = yearlyPenalties.find((y) => y.peakMonth);
const peakMonthLabel = peakYr?.peakMonth ?? "";
const peakMonthAmt = peakYr?.peakMonthAmount ?? 0;

// YoY change (2023 → 2024 op+pa)
const yr2023 = yearlyPenalties.find((y) => y.year === "2023");
const yr2024 = yearlyPenalties.find((y) => y.year === "2024");
const total2023 = (yr2023?.operational ?? 0) + (yr2023?.postAudit ?? 0);
const total2024 = (yr2024?.operational ?? 0) + (yr2024?.postAudit ?? 0);
const yoyPct = total2023 > 0 ? Math.round(((total2024 - total2023) / total2023) * 100) : 0;
const avgMonthly2024 = total2024 / 12;
const peakMultiplier = avgMonthly2024 > 0 ? (peakMonthAmt / avgMonthly2024).toFixed(1) : "—";

const TYPE_CONFIG = {
  operational:   { label: "Operational",  pill: "bg-red-50 text-red-700 border border-red-200" },
  "post-audit":  { label: "Post-Audit",   pill: "bg-orange-50 text-orange-700 border border-orange-200" },
  damage:        { label: "Damage",       pill: "bg-gray-100 text-gray-600 border border-gray-200" },
  promotional:   { label: "Promo TPR",    pill: "bg-yellow-50 text-yellow-700 border border-yellow-200" },
};

export function ChargebackTable() {
  const maxPenalty = Math.max(...yearlyPenalties.map((y) => y.operational + y.postAudit));

  return (
    <div className="space-y-6">

      {/* Year-over-year trend — lead section */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900">Penalty Trend · 2023 – 2025</h3>
              <p className="text-sm text-gray-400 mt-0.5">Operational (CRED11-F/O) + Post-Audit claims (CRED12)</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Peak Month</p>
              <p className="text-lg font-bold text-red-600 mono">${peakMonthAmt.toLocaleString()}</p>
              <p className="text-xs text-gray-400">{peakMonthLabel} — {peakMultiplier}× typical</p>
            </div>
          </div>
        </div>

        {/* Year cards with inline bar charts */}
        <div className="p-6 grid grid-cols-3 gap-5">
          {yearlyPenalties.map((yr, i) => {
            const total = yr.operational + yr.postAudit;
            const prev = i > 0 ? yearlyPenalties[i - 1].operational + yearlyPenalties[i - 1].postAudit : null;
            const pct = prev !== null ? Math.round(((total - prev) / prev) * 100) : null;
            const isWorst = i === 1;

            return (
              <div key={yr.year} className={`rounded-xl p-5 border ${isWorst ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50"}`}>
                <div className="flex items-start justify-between mb-3">
                  <p className={`text-xs font-bold uppercase tracking-widest ${isWorst ? "text-red-500" : "text-gray-400"}`}>
                    {yr.year}
                  </p>
                  {pct !== null && (
                    <span className={`inline-flex items-center gap-1 text-xs font-bold rounded-full px-2 py-0.5 ${
                      pct > 0 ? "bg-red-50 text-red-600 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    }`}>
                      {pct > 0 ? "▲" : "▼"} {Math.abs(pct)}%
                    </span>
                  )}
                </div>

                <p className={`mono text-3xl font-bold leading-none mb-1 ${isWorst ? "text-red-700" : "text-gray-900"}`}>
                  ${(total / 1000).toFixed(0)}K
                </p>
                <p className="text-xs text-gray-400 mb-4">total penalties</p>

                {/* Mini stacked bar */}
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-[11px] text-gray-500 mb-0.5">
                      <span>Operational</span>
                      <span className="mono">${yr.operational.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full" style={{ width: `${(yr.operational / maxPenalty) * 100}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-gray-500 mb-0.5">
                      <span>Post-Audit</span>
                      <span className="mono">${yr.postAudit.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-400 rounded-full" style={{ width: `${(yr.postAudit / maxPenalty) * 100}%` }} />
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-400 pt-1">
                    Damage: ${yr.damage.toLocaleString()}
                  </div>
                </div>

                {yr.peakMonth && (
                  <div className="mt-3 bg-white border border-red-200 rounded-lg px-3 py-2">
                    <p className="text-[11px] font-bold text-red-600">{yr.peakMonth}: ${yr.peakMonthAmount?.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-400">10× a typical month</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-6 pb-5">
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-gray-700 leading-relaxed">
            <strong className="text-red-700">+{yoyPct}% increase from 2023 to 2024</strong>{" "}
            in operational + post-audit penalties (2023 covers Sep–Dec only — system tracking started mid-year).
            Post-audit claims (CRED12) arrive 8–12 months after the incident — by the time they land,{" "}
            <em>there is no practical way to dispute them.</em> Early detection is the only lever.
          </div>
        </div>
      </div>

      {/* Two-col: customers + breakdown */}
      <div className="grid grid-cols-2 gap-5">

        {/* Top customers */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-200">
            <h3 className="text-sm font-bold text-gray-900">Top Penalty Customers</h3>
            <p className="text-xs text-gray-400 mt-0.5">Real names from penalty sheet · 2023–2025</p>
          </div>
          <div className="divide-y divide-gray-100">
            {customerPenalties.map((c, i) => {
              const share = (c.amount / CUSTOMER_TOTAL) * 100;
              return (
                <div key={c.customerId} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50">
                  <span className="mono text-xs text-gray-300 w-4 flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 leading-tight">{c.customerName}</p>
                    <p className="mono text-[11px] text-gray-400">{c.customerId} · {c.incidents} incidents</p>
                    <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden w-full">
                      <div className="h-full rounded-full bg-red-400" style={{ width: `${share}%` }} />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="mono text-sm font-bold text-red-600">${c.amount.toLocaleString()}</p>
                    <p className="mono text-[11px] text-gray-400">{share.toFixed(0)}%</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-200">
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Dollar General, CVS, Walmart, Walgreens use automated compliance systems.
              Their OTIF windows are hard constraints, not targets.
            </p>
          </div>
        </div>

        {/* 2025 addressability */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-200">
            <h3 className="text-sm font-bold text-gray-900">2025 Addressability</h3>
            <p className="text-xs text-gray-400 mt-0.5">What this system can and cannot prevent</p>
          </div>
          <div className="p-5 space-y-4">
            {[
              { label: "Operational penalties (CRED11)", amount: yearlyPenalties.find((y) => y.year === "2025")?.operational ?? 155354, addressable: true, note: "Short ship, late delivery — preventable with proactive inventory positioning" },
              { label: "Post-audit claims (CRED12)", amount: yearlyPenalties.find((y) => y.year === "2025")?.postAudit ?? 253597, addressable: false, note: "Reflects 2023–24 events. Arrive 8–12 months later — cannot be prevented retroactively" },
              { label: "Damage allowances (CRED08)", amount: yearlyPenalties.find((y) => y.year === "2025")?.damage ?? 576864, addressable: false, note: "Warehouse handling — NJ rate 2.5× SF. Separate initiative required." },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-start justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-0.5 ${item.addressable ? "bg-emerald-500" : "bg-gray-300"}`} />
                    <p className="text-sm font-semibold text-gray-800">{item.label}</p>
                  </div>
                  <p className="mono text-sm font-bold text-gray-900 flex-shrink-0 ml-2">${(item.amount / 1000).toFixed(0)}K</p>
                </div>
                <div className="ml-4 h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1.5">
                  <div
                    className={`h-full rounded-full ${item.addressable ? "bg-emerald-400" : "bg-gray-300"}`}
                    style={{ width: `${(item.amount / 869000) * 100}%` }}
                  />
                </div>
                <p className="ml-4 text-[11px] text-gray-400 leading-relaxed">{item.note}</p>
              </div>
            ))}
          </div>
          <div className="px-5 py-4 bg-emerald-50 border-t border-emerald-200">
            <p className="text-xs text-emerald-800 leading-relaxed font-medium">
              Target: prevent 30–50% of the $189K operational penalties ($57K–$95K/yr)
              against ~$50–80K in targeted transfer freight.{" "}
              <strong>Net benefit: $0–$45K/yr + OTIF score preservation.</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Cause code breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-sm font-bold text-gray-900">Cause Code Breakdown · 2023–2025</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ backgroundColor: "#F9FAFB" }} className="border-b border-gray-200">
                {["Cause Code", "Channel", "Primary DC", "Incidents", "3yr Total", "Share of Total", "Type"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-gray-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chargebackData.sort((a, b) => b.amount - a.amount).map((row, i) => {
                const share = (row.amount / GRAND_TOTAL) * 100;
                const cfg = TYPE_CONFIG[row.type];
                return (
                  <tr key={i} className={`border-b border-gray-100 hover:bg-gray-50 ${i % 2 === 1 ? "bg-gray-50/40" : ""}`}>
                    <td className="px-5 py-3.5 font-semibold text-gray-900 text-xs">{row.causeCode}</td>
                    <td className="px-5 py-3.5 text-xs text-gray-600">{row.channel}</td>
                    <td className="px-5 py-3.5">
                      <span className="mono text-[11px] bg-gray-100 text-gray-600 border border-gray-200 rounded px-1.5 py-0.5">
                        {row.dc}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 mono text-xs text-gray-600">{row.incidents > 0 ? row.incidents : "—"}</td>
                    <td className="px-5 py-3.5 mono text-sm font-bold text-red-600">${row.amount.toLocaleString()}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-red-400" style={{ width: `${share}%` }} />
                        </div>
                        <span className="mono text-[11px] text-gray-400">{share.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex text-[11px] font-semibold rounded-full px-2.5 py-0.5 ${cfg.pill}`}>
                        {cfg.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
