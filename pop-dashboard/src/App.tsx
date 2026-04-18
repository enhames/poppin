import { useState, useEffect } from "react";
import { urgentRequestSample } from "./data/mockData";
import { api } from "./api/client";
import { AlertsBanner } from "./components/AlertsBanner";
import { InventoryTable } from "./components/InventoryTable";
import { ChargebackTable } from "./components/ChargebackTable";
import { TransferPanel } from "./components/TransferPanel";
import { InventoryCharts } from "./components/InventoryCharts";

type Tab = "imbalances" | "chargebacks" | "transfers" | "alerts" | "charts";

const URGENT_REQUESTS_TOTAL = 2029;
const PENALTY_EXPOSURE = 745000;

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
  imbalances: "Real-time visibility across all 3 Distribution Centers.",
  chargebacks: "Current exposure from short-ship and late-delivery penalties.",
  transfers: "Cost-tradeoff analysis for cross-country inventory movement.",
  alerts: "Proactive detection 14+ days before orders expose the imbalance.",
  charts: "Live per-DC inventory and days-of-supply. Showing SKUs with active demand.",
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
    critical: "bg-[#A6192E]", // PoP Crimson
    warning: "bg-[#D4AF37]",  // PoP Gold
    ok: "bg-emerald-500",
    neutral: "bg-slate-400",
    default: "bg-slate-300",
  }[accent];

  const valueColor = {
    critical: "text-[#A6192E]",
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
  const [criticalCount, setCriticalCount] = useState(0);
  const [transferCount, setTransferCount] = useState(0);
  const [alertsData, setAlertsData] = useState<any[]>([]);

  useEffect(() => {
    api.getAlerts().then((alerts: any[]) => {
      setAlertsData(alerts);
      setCriticalCount(alerts.filter((a) => a.severity === "critical").length);
    });
    api.getRecommendations().then((recs) => {
      setTransferCount(recs.filter((r) => r.recommendation === "TRANSFER").length);
    });
  }, []);

  return (
    <div className="min-h-screen flex font-sans bg-gray-50">

      {/* ── Sidebar (PoP Brand Theme) ── */}
      <aside className="w-64 flex-shrink-0 flex flex-col bg-[#1A0B0C] border-r border-[#D4AF37]/20 min-h-screen">

        {/* Logo */}
        <div className="px-6 pt-7 pb-5 border-b border-white/10">
          <div className="flex items-center gap-2.5 mb-0.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black bg-[#A6192E] shadow-[0_0_10px_rgba(166,25,46,0.5)]">
              PoP
            </div>
            <span className="text-white font-bold text-sm tracking-wide">Prince of Peace</span>
          </div>
          <p className="text-[11px] font-medium mt-1 text-[#D4AF37]/80">
            Inventory Command Center
          </p>
        </div>

        {/* DC Status */}
        <div className="px-4 py-4 border-b border-white/10">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3 text-gray-500">
            Distribution Centers
          </p>
          {[
            { name: "DC-SF · Livermore", role: "Hub · 27.6% volume", dot: "#D4AF37" }, // Gold
            { name: "DC-NJ · New Jersey", role: "Primary · 54.3% volume", dot: "#A6192E" }, // Crimson
            { name: "DC-LA · Los Angeles", role: "18.1% volume", dot: "#475569" }, // Slate
          ].map((dc) => (
            <div key={dc.name} className="flex items-start gap-2 mb-2.5">
              <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: dc.dot }} />
              <div>
                <p className="text-xs font-semibold leading-tight text-gray-200">{dc.name}</p>
                <p className="text-[11px] text-gray-500">{dc.role}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-1">
          {(Object.keys(NAV_LABELS) as Tab[]).map((tab) => {
            const active = activeTab === tab;
            const badge = tab === "alerts" ? criticalCount : tab === "transfers" ? transferCount : null;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-all relative group ${
                  active 
                    ? "bg-white/10 text-white border-l-2 border-[#D4AF37]" 
                    : "text-gray-400 border-l-2 border-transparent hover:bg-white/5 hover:text-gray-200"
                }`}
              >
                <span className={active ? "text-[#D4AF37]" : "text-gray-500 group-hover:text-gray-400"}>
                  <Icon d={NAV_ICONS[tab]} size={15} />
                </span>
                <span className="flex-1">{NAV_LABELS[tab]}</span>
                {badge !== null && badge! > 0 && (
                  <span className={`text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 ${
                    tab === "alerts" ? "bg-[#A6192E] text-white" : "bg-[#D4AF37]/20 text-[#D4AF37]"
                  }`}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer Status */}
        <div className="px-4 py-4 space-y-2 border-t border-white/10">
          <p className="text-[11px] text-gray-500">
            Snapshot: Live Data · ~800 SKUs
          </p>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#A6192E]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#A6192E] animate-pulse" />
            {criticalCount} critical alerts active
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col min-h-screen overflow-auto">

        {/* Page header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-20 px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{NAV_LABELS[activeTab]}</h1>
              <p className="text-xs text-gray-500 mt-0.5 max-w-2xl">{NAV_DESC[activeTab]}</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="text-sm font-medium text-gray-600 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 hover:border-gray-300 transition-colors">
                Export Report
              </button>
              <button className="text-sm font-semibold text-white rounded-lg px-4 py-2 bg-[#A6192E] hover:bg-[#851425] transition-colors shadow-sm">
                Refresh Data
              </button>
            </div>
          </div>
        </header>

        <div className="px-8 py-7 space-y-7 flex-1">

          {/* KPI Strip - ONLY visible on the imbalances tab */}
          {activeTab === "imbalances" && (
            <div className="grid grid-cols-4 gap-5">
              <KpiCard
                label="Total Chargeback Exposure"
                value={`$${(PENALTY_EXPOSURE/1000).toFixed(0)}K`}
                trend={{ label: "Active Risk", isNegative: true }}
                context="Projected penalty exposure from current site-level imbalances."
                accent="critical"
              />
              <KpiCard
                label="Critical Imbalances"
                value={`${criticalCount} SKUs`}
                context="SKUs projected to stock out at 1+ DC within 14 days."
                accent="critical"
              />
              <KpiCard
                label="Transfers Recommended"
                value={String(transferCount)}
                context="Estimated Net Savings: $42,100 if all approved today."
                accent="warning"
              />
              <KpiCard
                label="Pending Inbound POs"
                value="24"
                context="Shipments en route. Evaluate 'Wait vs. Transfer' tradeoffs."
                accent="neutral"
              />
            </div>
          )}

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
                <button className="text-sm font-medium border border-gray-200 rounded-lg px-4 py-2 text-gray-600 hover:bg-gray-50">
                  Mark all reviewed
                </button>
              </div>

              <AlertsBanner />

              {/* URGENT Spreadsheet - "before" story */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#A6192E] bg-red-50 border border-red-200 rounded-full px-3 py-1">
                        Manual Process
                      </span>
                      <h3 className="text-base font-bold text-gray-900">Current fulfillment workflow</h3>
                    </div>
                    <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                      Without centralized visibility, operations managers must manually detect stockouts and log urgent transfer requests. 
                      This results in blind transfers with no cost-tradeoff analysis.
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-6">
                    <p className="mono text-4xl font-bold text-[#A6192E]">{URGENT_REQUESTS_TOTAL}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Manual Requests Logged</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        {["Request #", "SKU", "Product", "Qty", "Note", "Date"].map((h) => (
                          <th key={h} className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-gray-500 border-b border-gray-200">
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
                              <span className={`font-semibold ${isUrgent ? "text-[#A6192E]" : "text-gray-700"}`}>{r.note}</span>
                            </td>
                            <td className="px-5 py-3 mono text-gray-400 text-xs">{r.date}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Before / After */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-6 py-5 border-b border-gray-200">
                  <h3 className="text-base font-bold text-gray-900">Cost Tradeoff Analysis: Wait vs. Transfer</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Scenario: F-04130 · Ginger Chews Plus+ 3oz — DC-NJ stockout on Dollar General order.
                  </p>
                </div>
                <div className="grid grid-cols-2 divide-x divide-gray-200">
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xs font-bold uppercase tracking-widest text-[#A6192E] bg-red-50 border border-red-200 rounded-full px-3 py-1">
                        Without System Intervention
                      </span>
                    </div>
                    <ol className="space-y-3 text-sm text-gray-600">
                      {[
                        "Order hits DC-NJ. System shows 0 available units.",
                        <>Ops manager logs request: <span className="font-semibold text-[#A6192E]">"URGENT! F-04130, 4 pallets"</span>.</>,
                        "Manual stock check causes 3–5 day processing delay.",
                        <>Order is split. Short-ship penalty issued: <span className="mono font-bold text-[#A6192E]">$851</span></>,
                        <>Second shipment late. Late-delivery penalty: <span className="mono font-bold text-[#A6192E]">$851</span></>,
                      ].map((step, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="mono text-gray-300 flex-shrink-0 font-medium">{i + 1}.</span>
                          <span>{step}</span>
                        </li>
                      ))}
                      <li className="flex gap-3 pt-2 border-t border-gray-100 mt-1">
                        <span className="mono font-bold text-[#A6192E] flex-shrink-0">→</span>
                        <span className="font-semibold text-[#A6192E]">$1,702 total penalty exposure.</span>
                      </li>
                    </ol>
                  </div>
                  <div className="p-6 bg-[#F0FDF4]">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xs font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                        With StockShift Intelligence
                      </span>
                    </div>
                    <ol className="space-y-3 text-sm text-gray-600">
                      {[
                        <>System flags DC-NJ at <strong>8 days estimated supply</strong>, 14 days prior to order window.</>,
                        <>Alert generated: NJ demand outpaces supply. SF has 126d supply. Recommend transfer.</>,
                        <>Cost Model: Transfer SF→NJ · <span className="mono font-bold text-gray-900">$1,043 freight</span> · Risk avoided: $1,702</>,
                        "Ops manager approves transfer in dashboard. Initiated same day.",
                        "DC-NJ ships order on time, in full. Zero penalties incurred.",
                      ].map((step, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="mono text-gray-300 flex-shrink-0 font-medium">{i + 1}.</span>
                          <span>{step}</span>
                        </li>
                      ))}
                      <li className="flex gap-3 pt-2 border-t border-emerald-100 mt-1">
                        <span className="mono font-bold text-emerald-700 flex-shrink-0">→</span>
                        <span className="font-semibold text-emerald-700">Net saving: $659. Imbalance resolved proactively.</span>
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