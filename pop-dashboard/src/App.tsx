import { useState } from "react";
import { alertsData, transferRecs, urgentRequestSample } from "./data/mockData";
import { AlertsBanner } from "./components/AlertsBanner";
import { InventoryTable } from "./components/InventoryTable";
import { ChargebackTable } from "./components/ChargebackTable";
import { TransferPanel } from "./components/TransferPanel";
import { InventoryCharts } from "./components/InventoryCharts";

type Tab = "imbalances" | "chargebacks" | "transfers" | "alerts" | "charts";

// ─── Real numbers ─────────────────────────────────────────────────────────────
const URGENT_REQUESTS_TOTAL = 2029;
const PENALTY_2024 = 1074591;   // op + pa + dmg 2024 (real from deductions sheet)
const PENALTY_2023 = 149819;    // op + pa + dmg 2023 (partial year, Sep–Dec only)
const PCT_CHANGE = Math.round(((PENALTY_2024 - PENALTY_2023) / PENALTY_2023) * 100);
const NJ_2025_DEFICIT = 131198;
const criticalCount = alertsData.filter((a) => a.severity === "critical").length;
const transferCount = transferRecs.filter((r) => r.recommendation === "TRANSFER").length;

// ─── Icons ────────────────────────────────────────────────────────────────────
function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const NAV_ICONS: Record<Tab, string> = {
  imbalances: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z",
  chargebacks: "M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185zM9.75 9h.008v.008H9.75V9zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 4.5h.008v.008h-.008V13.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z",
  transfers: "M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5",
  alerts: "M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0",
  charts: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
};

const NAV_LABELS: Record<Tab, string> = {
  imbalances: "Inventory Imbalances",
  chargebacks: "Chargeback Analysis",
  transfers: "Transfer Decisions",
  alerts: "Early Warnings",
  charts: "Live Inventory Charts",
};

const NAV_DESC: Record<Tab, string> = {
  imbalances: "Per-DC positions estimated via demand-share reconstruction · no per-DC snapshot in source data",
  chargebacks: "CRED11-F/O operational + CRED12 post-audit claims · 2023–2025 · real customer names",
  transfers: "SF hub first · $0.51/unit to NJ · $0.17/unit to LA · avoid reverse routes",
  alerts: "Proactive detection 14+ days before orders expose the imbalance",
  charts: "Live data from live_inventory.json · health heatmap, days of supply, demand velocity",
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, context, trend, accent = "default",
}: {
  label: string; value: string; context: string;
  trend?: { label: string; isNegative?: boolean };
  accent?: "critical" | "warning" | "ok" | "neutral" | "default";
}) {
  const accentBar = {
    critical: "bg-red-500",
    warning: "bg-amber-500",
    ok: "bg-emerald-500",
    neutral: "bg-slate-400",
    default: "bg-slate-300",
  }[accent];

  const valueColor = {
    critical: "text-red-700",
    warning: "text-amber-700",
    ok: "text-emerald-700",
    neutral: "text-slate-700",
    default: "text-gray-900",
  }[accent];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className={`h-1 w-full ${accentBar}`} />
      <div className="p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">{label}</p>
        <p className={`mono text-3xl font-bold leading-none mb-2 ${valueColor}`}>{value}</p>
        {trend && (
          <div className={`inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5 mb-2 ${
            trend.isNegative ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"
          }`}>
            <span>{trend.isNegative ? "▲" : "▼"}</span>
            {trend.label}
          </div>
        )}
        <p className="text-xs text-gray-400 leading-relaxed">{context}</p>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("imbalances");

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "Space Grotesk, sans-serif" }}>

      {/* ── Sidebar ── */}
      <aside className="w-64 flex-shrink-0 flex flex-col" style={{ backgroundColor: "var(--sidebar-bg)", minHeight: "100vh" }}>

        {/* Logo */}
        <div className="px-6 pt-7 pb-5" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
          <div className="flex items-center gap-2.5 mb-0.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black" style={{ backgroundColor: "var(--accent)" }}>
              PoP
            </div>
            <span className="text-white font-bold text-sm">Prince of Peace</span>
          </div>
          <p className="text-[11px] font-medium mt-1" style={{ color: "var(--sidebar-text)" }}>
            Inventory Command Center
          </p>
        </div>

        {/* DC Status */}
        <div className="px-4 py-4" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--sidebar-text)" }}>
            Distribution Centers
          </p>
          {[
            { name: "DC-SF · Livermore", role: "Hub · 27.6% revenue", dot: "#0E8A8A" },
            { name: "DC-NJ · New Jersey", role: "Primary · 54.3% revenue", dot: "#E05235" },
            { name: "DC-LA · Los Angeles", role: "18.1% revenue", dot: "#7C90A8" },
          ].map((dc) => (
            <div key={dc.name} className="flex items-start gap-2 mb-2.5">
              <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: dc.dot }} />
              <div>
                <p className="text-xs font-semibold leading-tight" style={{ color: "var(--sidebar-text-active)" }}>{dc.name}</p>
                <p className="text-[11px]" style={{ color: "var(--sidebar-text)" }}>{dc.role}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {(Object.keys(NAV_LABELS) as Tab[]).map((tab) => {
            const active = activeTab === tab;
            const badge = tab === "alerts" ? criticalCount : tab === "transfers" ? transferCount : null;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left relative group"
                style={{
                  backgroundColor: active ? "var(--sidebar-active-bg)" : "transparent",
                  color: active ? "var(--sidebar-text-active)" : "var(--sidebar-text)",
                  borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
                }}
              >
                <span className={active ? "text-teal-400" : "text-slate-500 group-hover:text-slate-300"}>
                  <Icon d={NAV_ICONS[tab]} size={15} />
                </span>
                <span className="flex-1">{NAV_LABELS[tab]}</span>
                {badge !== null && badge! > 0 && (
                  <span className="text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: tab === "alerts" ? "var(--critical)" : "rgba(14,138,138,0.35)", color: "white" }}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer Status */}
        <div className="px-4 py-4 space-y-2" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
          <p className="text-[11px]" style={{ color: "var(--sidebar-text)" }}>
            Snapshot: Apr 17, 2026 · ~800 SKUs · 5 buyers
          </p>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold"
            style={{ color: "#F87171" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            {criticalCount} critical alerts active
          </div>
          <div className="text-[11px]" style={{ color: "var(--sidebar-text)" }}>
            {URGENT_REQUESTS_TOTAL} URGENT rows in spreadsheet
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col min-h-screen overflow-auto" style={{ backgroundColor: "var(--bg)" }}>

        {/* Page header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-20 px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{NAV_LABELS[activeTab]}</h1>
              <p className="text-xs text-gray-400 mt-0.5 max-w-2xl">{NAV_DESC[activeTab]}</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="text-sm font-medium text-gray-500 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 hover:border-gray-300">
                Export CSV
              </button>
              <button className="text-sm font-semibold text-white rounded-lg px-4 py-2"
                style={{ backgroundColor: "var(--sidebar-bg)" }}>
                Refresh Data
              </button>
            </div>
          </div>
        </header>

        <div className="px-8 py-7 space-y-7 flex-1">

          {/* KPI Strip */}
          <div className="grid grid-cols-4 gap-5">
            <KpiCard
              label="Penalty Spike"
              value={`+${PCT_CHANGE}%`}
              trend={{ label: "2023 → 2024", isNegative: true }}
              context={`$${(PENALTY_2023/1000).toFixed(0)}K grew to $${(PENALTY_2024/1000).toFixed(0)}K. Aug 2024 alone: $110K.`}
              accent="critical"
            />
            <KpiCard
              label="NJ Safety Stock Gap"
              value={`${(NJ_2025_DEFICIT / 1000).toFixed(0)}K units`}
              context="Tiger Balm Ultra · sold 282K in 2025, received only 151K from suppliers"
              accent="critical"
            />
            <KpiCard
              label="Transfers Recommended"
              value={String(transferCount)}
              context={`of ${transferRecs.length} flagged SKUs require immediate action`}
              accent="warning"
            />
            <KpiCard
              label="Manual URGENT Requests"
              value={URGENT_REQUESTS_TOTAL.toLocaleString()}
              context="Spreadsheet rows — the current process. No alert system, no cost model."
              accent="neutral"
            />
          </div>

          {/* Tab Content */}
          {activeTab === "imbalances" && <InventoryTable />}
          {activeTab === "chargebacks" && <ChargebackTable />}
          {activeTab === "transfers" && <TransferPanel />}
          {activeTab === "charts" && <InventoryCharts />}

          {activeTab === "alerts" && (
            <div className="space-y-6">
              {/* Alert header row */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  <span className="font-semibold text-gray-900">{alertsData.length} active alerts</span>
                  {" "}· sorted by severity · based on estimated DC positions
                </p>
                <button className="text-sm font-medium border border-gray-200 rounded-lg px-4 py-2 text-gray-500 hover:bg-gray-50">
                  Mark all reviewed
                </button>
              </div>

              <AlertsBanner />

              {/* URGENT Spreadsheet - "before" story */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-red-600 bg-red-50 border border-red-200 rounded-full px-3 py-1">
                        Before
                      </span>
                      <h3 className="text-base font-bold text-gray-900">This is how it works today</h3>
                    </div>
                    <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                      POP_InternalTransferRequests.xlsx — ops manager types <strong>"URGENT! OUT OF STOCK"</strong> into a spreadsheet cell
                      and emails a buyer. No alerts. No cost comparison. No decision support.
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-6">
                    <p className="mono text-4xl font-bold text-red-600">{URGENT_REQUESTS_TOTAL}</p>
                    <p className="text-xs text-gray-400 mt-0.5">URGENT rows</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr style={{ backgroundColor: "#F9FAFB" }}>
                        {["Request #", "SKU", "Product", "Qty", "Note (verbatim)", "Date"].map((h) => (
                          <th key={h} className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-200">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {urgentRequestSample.map((r, i) => {
                        const isUrgent = /urgent|out of stock|asap/i.test(r.note);
                        return (
                          <tr key={r.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i % 2 === 0 ? "" : "bg-gray-50/50"}`}>
                            <td className="px-5 py-3 mono text-gray-400 text-xs">{r.id}</td>
                            <td className="px-5 py-3 mono font-semibold text-gray-800">{r.sku}</td>
                            <td className="px-5 py-3 text-gray-700">{r.product}</td>
                            <td className="px-5 py-3 mono text-gray-600">{r.qty}</td>
                            <td className="px-5 py-3">
                              <span className={`font-semibold ${isUrgent ? "text-red-600" : "text-gray-700"}`}>{r.note}</span>
                            </td>
                            <td className="px-5 py-3 mono text-gray-400 text-xs">{r.date}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-200">
                        <td colSpan={6} className="px-5 py-3 text-center text-xs text-gray-400">
                          + {URGENT_REQUESTS_TOTAL - urgentRequestSample.length} more rows · · ·
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Before / After */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-6 py-5 border-b border-gray-200">
                  <h3 className="text-base font-bold text-gray-900">Before vs. After</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    F-04130 · Ginger Chews Plus+ 3oz — NJ stockout on Dollar General order · real freight $0.51/unit
                  </p>
                </div>
                <div className="grid grid-cols-2 divide-x divide-gray-200">
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xs font-bold uppercase tracking-widest text-red-600 bg-red-50 border border-red-200 rounded-full px-3 py-1">
                        Manual Process
                      </span>
                    </div>
                    <ol className="space-y-3 text-sm text-gray-600">
                      {[
                        "Dollar General order hits DC-NJ. System shows 0 available units.",
                        <>Ops manager opens spreadsheet. Types <span className="font-semibold text-red-600">"URGENT! F-04130, 4 pallets"</span> and emails buyer.</>,
                        "Buyer checks SF stock manually. 3–5 day process delay.",
                        <>POP splits order. Short-ship CRED11-F issued: <span className="mono font-bold text-red-600">$851</span></>,
                        <>Second shipment late. Late-delivery CRED11-O: <span className="mono font-bold text-red-600">$851</span></>,
                      ].map((step, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="mono text-gray-300 flex-shrink-0 font-medium">{i + 1}.</span>
                          <span>{step}</span>
                        </li>
                      ))}
                      <li className="flex gap-3 pt-2 border-t border-gray-100 mt-1">
                        <span className="mono font-bold text-red-600 flex-shrink-0">→</span>
                        <span className="font-semibold text-red-600">$1,702 total penalty. Post-audit claim may arrive 12 months later.</span>
                      </li>
                    </ol>
                  </div>
                  <div className="p-6" style={{ backgroundColor: "#F0FDF4" }}>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xs font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                        System-Assisted
                      </span>
                    </div>
                    <ol className="space-y-3 text-sm text-gray-600">
                      {[
                        <>System flags DC-NJ at <strong>8 days estimated supply</strong>, 14 days before the order window.</>,
                        <>Alert: NJ demand tripled since 2023. SF has 126d supply. Recommend transfer.</>,
                        <>Transfer card: SF→NJ · 2,571 units · <span className="mono font-bold text-gray-900">$1,043 freight</span> ($0.51/unit) · CB risk if skipped: $1,702</>,
                        "Ops manager approves in one click. Transfer initiated same day.",
                        "DC-NJ ships Dollar General on time, in full. No CRED11 penalty.",
                      ].map((step, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="mono text-gray-300 flex-shrink-0 font-medium">{i + 1}.</span>
                          <span>{step}</span>
                        </li>
                      ))}
                      <li className="flex gap-3 pt-2 border-t border-emerald-100 mt-1">
                        <span className="mono font-bold text-emerald-700 flex-shrink-0">→</span>
                        <span className="font-semibold text-emerald-700">Net saving: $659 on this single intervention. Multiply across 12+ flagged SKUs per quarter.</span>
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
