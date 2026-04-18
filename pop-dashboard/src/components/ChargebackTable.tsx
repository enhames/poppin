import { useState, useEffect } from "react";
import { api } from "../api/client";
import type { ChargebackRow, CustomerPenalty, YearlyPenalty } from "../data/mockData";

const TYPE_CONFIG = {
  operational:   { label: "Operational",  pill: "bg-[#FBEEEF] text-[#7A0F1D] border border-[#F4D5D8]" },
  "post-audit":  { label: "Post-Audit",   pill: "bg-[#FEF7E8] text-[#8C5A0F] border border-[#E5B664]" },
  damage:        { label: "Damage",       pill: "bg-[#FAF7F1] text-[#403A34] border border-[#D6CFC7]" },
  promotional:   { label: "Promo TPR",    pill: "bg-[#FDF9EC] text-[#6B4F0F] border border-[#F4D35E]" },
};

export function ChargebackTable() {
  const [chargebackData, setChargebackData] = useState<ChargebackRow[]>([]);
  const [customerPenalties, setCustomerPenalties] = useState<CustomerPenalty[]>([]);
  const [yearlyPenalties, setYearlyPenalties] = useState<YearlyPenalty[]>([]);

  useEffect(() => {
    api.getChargebacks().then((raw: any) => {
      setChargebackData(raw.causeCodeRows ?? []);
      setCustomerPenalties(raw.customerPenalties ?? []);
      setYearlyPenalties(raw.yearlyPenalties ?? []);
    });
  }, []);

  const GRAND_TOTAL = chargebackData.reduce((s, r) => s + r.amount, 0);
  const CUSTOMER_TOTAL = customerPenalties.reduce((s, r) => s + r.amount, 0);

  const peakYr = yearlyPenalties.find((y) => y.peakMonth);
  const peakMonthLabel = peakYr?.peakMonth ?? "";
  const peakMonthAmt = peakYr?.peakMonthAmount ?? 0;

  const yr2023 = yearlyPenalties.find((y) => y.year === "2023");
  const yr2024 = yearlyPenalties.find((y) => y.year === "2024");
  const total2023 = (yr2023?.operational ?? 0) + (yr2023?.postAudit ?? 0);
  const total2024 = (yr2024?.operational ?? 0) + (yr2024?.postAudit ?? 0);
  const yoyPct = total2023 > 0 ? Math.round(((total2024 - total2023) / total2023) * 100) : 0;
  const avgMonthly2024 = total2024 / 12;
  const peakMultiplier = avgMonthly2024 > 0 ? (peakMonthAmt / avgMonthly2024).toFixed(1) : "—";

  const maxPenalty = yearlyPenalties.length > 0 ? Math.max(...yearlyPenalties.map((y) => y.operational + y.postAudit)) : 1;

  return (
    <div className="space-y-6">

      {/* Year-over-year trend */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8E2DA", boxShadow: "0 1px 2px rgba(20,17,15,0.05)" }}>
        <div className="px-6 py-5" style={{ borderBottom: "1px solid #E8E2DA" }}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-bold" style={{ color: "#14110F", fontFamily: "Fraunces, serif", fontVariationSettings: "'opsz' 48" }}>Penalty Trend · 2023 – 2025</h3>
              <p className="text-sm mt-0.5" style={{ color: "#8E8680" }}>Operational (CRED11-F/O) + Post-Audit claims (CRED12)</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "#8E8680" }}>Peak Month</p>
              <p className="text-lg font-bold mono" style={{ color: "#7A0F1D" }}>${peakMonthAmt.toLocaleString()}</p>
              <p className="text-xs" style={{ color: "#8E8680" }}>{peakMonthLabel} — {peakMultiplier}× typical</p>
            </div>
          </div>
        </div>

        <div className="p-6 grid grid-cols-3 gap-5">
          {yearlyPenalties.map((yr, i) => {
            const total = yr.operational + yr.postAudit;
            const prev = i > 0 ? yearlyPenalties[i - 1].operational + yearlyPenalties[i - 1].postAudit : null;
            const pct = prev !== null ? Math.round(((total - prev) / prev) * 100) : null;
            const isWorst = i === 1;

            return (
              <div key={yr.year} className="rounded-xl p-5" style={{
                border: `1px solid ${isWorst ? "#F4D5D8" : "#E8E2DA"}`,
                backgroundColor: isWorst ? "#FDF6F6" : "#FAF7F1",
              }}>
                <div className="flex items-start justify-between mb-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: isWorst ? "#7A0F1D" : "#8E8680" }}>
                    {yr.year}
                  </p>
                  {pct !== null && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold rounded-full px-2 py-0.5" style={
                      pct > 0
                        ? { backgroundColor: "#FBEEEF", color: "#7A0F1D", border: "1px solid #F4D5D8" }
                        : { backgroundColor: "#EEF7F5", color: "#125F54", border: "1px solid #7AC4B8" }
                    }>
                      {pct > 0 ? "▲" : "▼"} {Math.abs(pct)}%
                    </span>
                  )}
                </div>

                <p className="mono text-3xl font-bold leading-none mb-1" style={{ color: isWorst ? "#7A0F1D" : "#14110F" }}>
                  ${(total / 1000).toFixed(0)}K
                </p>
                <p className="text-xs mb-4" style={{ color: "#8E8680" }}>total penalties</p>

                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-[11px] mb-0.5" style={{ color: "#6B6560" }}>
                      <span>Operational</span>
                      <span className="mono">${yr.operational.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#E8E2DA" }}>
                      <div className="h-full rounded-full" style={{ width: `${(yr.operational / maxPenalty) * 100}%`, backgroundColor: "#A6192E" }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] mb-0.5" style={{ color: "#6B6560" }}>
                      <span>Post-Audit</span>
                      <span className="mono">${yr.postAudit.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#E8E2DA" }}>
                      <div className="h-full rounded-full" style={{ width: `${(yr.postAudit / maxPenalty) * 100}%`, backgroundColor: "#B97A15" }} />
                    </div>
                  </div>
                  <div className="text-[10px] pt-1" style={{ color: "#8E8680" }}>
                    Damage: ${yr.damage.toLocaleString()}
                  </div>
                </div>

                {yr.peakMonth && (
                  <div className="mt-3 rounded-lg px-3 py-2" style={{ backgroundColor: "#FFFFFF", border: "1px solid #F4D5D8" }}>
                    <p className="text-[11px] font-bold" style={{ color: "#7A0F1D" }}>{yr.peakMonth}: ${yr.peakMonthAmount?.toLocaleString()}</p>
                    <p className="text-[10px]" style={{ color: "#8E8680" }}>10× a typical month</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-6 pb-5">
          <div className="rounded-xl px-5 py-4 text-sm leading-relaxed" style={{ backgroundColor: "#FBEEEF", border: "1px solid #F4D5D8", color: "#403A34" }}>
            <strong style={{ color: "#7A0F1D" }}>+{yoyPct}% increase from 2023 to 2024</strong>{" "}
            in operational + post-audit penalties (2023 covers Sep–Dec only — system tracking started mid-year).
            Post-audit claims (CRED12) arrive 8–12 months after the incident — by the time they land,{" "}
            <em>there is no practical way to dispute them.</em> Early detection is the only lever.
          </div>
        </div>
      </div>

      {/* Two-col: customers + breakdown */}
      <div className="grid grid-cols-2 gap-5">

        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8E2DA", boxShadow: "0 1px 2px rgba(20,17,15,0.05)" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid #E8E2DA" }}>
            <h3 className="text-sm font-bold" style={{ color: "#14110F" }}>Top Penalty Customers</h3>
            <p className="text-xs mt-0.5" style={{ color: "#8E8680" }}>Real names from penalty sheet · 2023–2025</p>
          </div>
          <div className="divide-y" style={{ borderColor: "#F2EDE5" }}>
            {customerPenalties.map((c, i) => {
              const share = (c.amount / CUSTOMER_TOTAL) * 100;
              return (
                <div key={c.customerId} className="flex items-center gap-4 px-5 py-3.5 transition-colors" style={{ borderBottom: "1px solid #F2EDE5" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#FAF7F1")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "")}>
                  <span className="mono text-xs w-4 flex-shrink-0" style={{ color: "#D6CFC7" }}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight" style={{ color: "#14110F" }}>{c.customerName}</p>
                    <p className="mono text-[11px]" style={{ color: "#8E8680" }}>{c.customerId} · {c.incidents} incidents</p>
                    <div className="mt-1.5 h-1 rounded-full overflow-hidden w-full" style={{ backgroundColor: "#E8E2DA" }}>
                      <div className="h-full rounded-full" style={{ width: `${share}%`, backgroundColor: "#A6192E" }} />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="mono text-sm font-bold" style={{ color: "#7A0F1D" }}>${c.amount.toLocaleString()}</p>
                    <p className="mono text-[11px]" style={{ color: "#8E8680" }}>{share.toFixed(0)}%</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-5 py-3" style={{ backgroundColor: "#FAF7F1", borderTop: "1px solid #E8E2DA" }}>
            <p className="text-[11px] leading-relaxed" style={{ color: "#6B6560" }}>
              Dollar General, CVS, Walmart, Walgreens use automated compliance systems.
              Their OTIF windows are hard constraints, not targets.
            </p>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8E2DA", boxShadow: "0 1px 2px rgba(20,17,15,0.05)" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid #E8E2DA" }}>
            <h3 className="text-sm font-bold" style={{ color: "#14110F" }}>2025 Addressability</h3>
            <p className="text-xs mt-0.5" style={{ color: "#8E8680" }}>What this system can and cannot prevent</p>
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
                    <span className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: item.addressable ? "#1E8574" : "#B8B1AA" }} />
                    <p className="text-sm font-semibold" style={{ color: "#14110F" }}>{item.label}</p>
                  </div>
                  <p className="mono text-sm font-bold flex-shrink-0 ml-2" style={{ color: "#14110F" }}>${(item.amount / 1000).toFixed(0)}K</p>
                </div>
                <div className="ml-4 h-1.5 rounded-full overflow-hidden mb-1.5" style={{ backgroundColor: "#E8E2DA" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(item.amount / 869000) * 100}%`, backgroundColor: item.addressable ? "#1E8574" : "#B8B1AA" }}
                  />
                </div>
                <p className="ml-4 text-[11px] leading-relaxed" style={{ color: "#6B6560" }}>{item.note}</p>
              </div>
            ))}
          </div>
          <div className="px-5 py-4" style={{ backgroundColor: "#EEF7F5", borderTop: "1px solid #7AC4B8" }}>
            <p className="text-xs leading-relaxed font-medium" style={{ color: "#125F54" }}>
              Target: prevent 30–50% of the $189K operational penalties ($57K–$95K/yr)
              against ~$50–80K in targeted transfer freight.{" "}
              <strong>Net benefit: $0–$45K/yr + OTIF score preservation.</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Cause code breakdown */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8E2DA", boxShadow: "0 1px 2px rgba(20,17,15,0.05)" }}>
        <div className="px-6 py-4" style={{ borderBottom: "1px solid #E8E2DA" }}>
          <h3 className="text-sm font-bold" style={{ color: "#14110F" }}>Cause Code Breakdown · 2023–2025</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ backgroundColor: "#FAF7F1", borderBottom: "1px solid #E8E2DA" }}>
                {["Cause Code", "Channel", "Primary DC", "Incidents", "3yr Total", "Share of Total", "Type"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "#6B6560" }}>
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
                  <tr key={i} className="transition-colors" style={{ borderBottom: "1px solid #F2EDE5", backgroundColor: i % 2 === 1 ? "#FAF7F1" : "#FFFFFF" }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#FDF9EC")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 1 ? "#FAF7F1" : "#FFFFFF")}>
                    <td className="px-5 py-3.5 font-semibold text-xs" style={{ color: "#14110F" }}>{row.causeCode}</td>
                    <td className="px-5 py-3.5 text-xs" style={{ color: "#6B6560" }}>{row.channel}</td>
                    <td className="px-5 py-3.5">
                      <span className="mono text-[11px] rounded px-1.5 py-0.5" style={{ backgroundColor: "#FAF7F1", color: "#403A34", border: "1px solid #D6CFC7" }}>
                        {row.dc}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 mono text-xs" style={{ color: "#6B6560" }}>{row.incidents > 0 ? row.incidents : "—"}</td>
                    <td className="px-5 py-3.5 mono text-sm font-bold" style={{ color: "#7A0F1D" }}>${row.amount.toLocaleString()}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#E8E2DA" }}>
                          <div className="h-full rounded-full" style={{ width: `${share}%`, backgroundColor: "#A6192E" }} />
                        </div>
                        <span className="mono text-[11px]" style={{ color: "#8E8680" }}>{share.toFixed(1)}%</span>
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
