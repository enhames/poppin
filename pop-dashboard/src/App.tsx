import { useState, useEffect } from "react";
import { api, type DashboardScenario, type DashboardSummary, type UrgentRequest } from "./api/client";
import { AlertsBanner } from "./components/AlertsBanner";
import { InventoryTable } from "./components/InventoryTable";
import { ChargebackTable } from "./components/ChargebackTable";
import { TransferPanel } from "./components/TransferPanel";
import { InventoryCharts } from "./components/InventoryCharts";
import { LanguageProvider, useLanguage } from "./i18n/LanguageContext";

type Tab = "imbalances" | "chargebacks" | "transfers" | "alerts" | "charts";

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

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, context, trend, accent = "default" }: {
  label: string; value: string; context: string;
  trend?: { label: string; isNegative?: boolean };
  accent?: "critical" | "warning" | "ok" | "neutral" | "default";
}) {
  const borderColor = { critical: "#7A0F1D", warning: "#B97A15", ok: "#1E8574", neutral: "#B8B1AA", default: "#D6CFC7" }[accent];
  const valueColor  = { critical: "#7A0F1D", warning: "#8C5A0F", ok: "#125F54", neutral: "#403A34", default: "#14110F" }[accent];
  const trendColors = trend?.isNegative
    ? { bg: "#FBEEEF", text: "#7A0F1D", border: "#F4D5D8" }
    : { bg: "#EEF7F5", text: "#125F54", border: "#7AC4B8" };

  return (
    <div className="bg-white rounded-xl border border-[#E8E2DA] overflow-hidden" style={{ boxShadow: "0 1px 0 rgba(20,17,15,0.04), 0 1px 2px rgba(20,17,15,0.05)", borderTopWidth: "3px", borderTopColor: borderColor }}>
      <div className="p-5">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] mb-3" style={{ color: "#6B6560" }}>{label}</p>
        <p className="font-display text-[30px] font-bold leading-none mb-2 mono" style={{ color: valueColor, fontFamily: "Fraunces, serif", fontVariationSettings: "'opsz' 96" }}>{value}</p>
        {trend && (
          <div className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2.5 py-0.5 mb-2 border" style={{ backgroundColor: trendColors.bg, color: trendColors.text, borderColor: trendColors.border }}>
            <span>{trend.isNegative ? "▲" : "▼"}</span>
            {trend.label}
          </div>
        )}
        <p className="text-[11.5px] leading-relaxed" style={{ color: "#6B6560" }}>{context}</p>
      </div>
    </div>
  );
}

// ─── App Content ──────────────────────────────────────────────────────────────
function AppContent() {
  const { language, setLanguage, t } = useLanguage();

  const [activeTab, setActiveTab] = useState<Tab>("imbalances");
  const [transferCount, setTransferCount] = useState(0);
  const [alertsData, setAlertsData] = useState<any[]>([]);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [scenario, setScenario] = useState<DashboardScenario | null>(null);
  const [urgentRequests, setUrgentRequests] = useState<UrgentRequest[]>([]);

  const visibleAlerts = alertsData.filter((a: any) => !dismissedAlertIds.has(a.id));
  const criticalCount = visibleAlerts.filter((a: any) => a.severity === "critical").length;

  function dismissAlert(id: string) {
    setDismissedAlertIds((prev) => new Set([...prev, id]));
  }
  function dismissAllAlerts() {
    setDismissedAlertIds(new Set(alertsData.map((a: any) => a.id)));
  }

  useEffect(() => {
    api.getAlerts().then((alerts: any[]) => setAlertsData(alerts));
    api.getDashboardSummary().then((s) => { setSummary(s); setTransferCount(s.transferRecommendedCount); });
    api.getDashboardScenario().then(setScenario);
    api.getUrgentRequests().then(setUrgentRequests);
  }, []);

  const NAV_LABELS: Record<Tab, string> = t.nav;
  const NAV_DESC: Record<Tab, string>   = t.navDesc;

  return (
    <div className="min-h-screen flex font-sans" style={{ backgroundColor: "#F2EDE5" }}>

      {/* ── Sidebar ── */}
      <aside className="w-64 flex-shrink-0 flex flex-col min-h-screen" style={{ backgroundColor: "#14110F", borderRight: "1px solid rgba(212,175,55,0.15)" }}>

        {/* Logo */}
        <div className="px-6 pt-7 pb-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[10px] font-black" style={{ backgroundColor: "#7A0F1D", boxShadow: "0 0 10px rgba(122,15,29,0.5)" }}>
                PoP
              </div>
              <span className="text-white font-bold text-sm tracking-wide" style={{ fontFamily: "Fraunces, serif", fontVariationSettings: "'opsz' 48" }}>Prince of Peace</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            {(["en", "zh"] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className="text-xs font-bold rounded-md px-3 py-1 transition-all"
                style={{
                  backgroundColor: language === lang ? "#D4AF37" : "rgba(255,255,255,0.06)",
                  color: language === lang ? "#14110F" : "#6B6560",
                }}
              >
                {lang === "en" ? "EN" : "中文"}
              </button>
            ))}
          </div>
          <p className="text-[10.5px] font-semibold tracking-[0.16em] uppercase mt-0.5" style={{ color: "#F4D35E" }}>
            {t.sidebar.subtitle}
          </p>
        </div>

        {/* DC Status */}
        <div className="px-4 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "#6B6560" }}>
            {t.sidebar.distributionCenters}
          </p>
          {(summary?.dcDistribution ?? []).map((dc) => (
            <div key={dc.name} className="flex items-start gap-2 mb-2.5">
              <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{
                backgroundColor: dc.site === "Site 1 - SF" ? "#D4AF37" : dc.site === "Site 2 - NJ" ? "#A6192E" : "#475569",
              }} />
              <div>
                <p className="text-xs font-semibold leading-tight" style={{ color: "#D6CFC7" }}>{dc.name}</p>
                <p className="text-[11px]" style={{ color: "#6B6560" }}>{dc.role}</p>
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
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-all relative group"
                style={{ backgroundColor: active ? "rgba(255,255,255,0.08)" : "transparent", color: active ? "#FFFFFF" : "#8E8680", borderLeft: `2px solid ${active ? "#D4AF37" : "transparent"}` }}>
                <span style={{ color: active ? "#D4AF37" : "#6B6560" }}>
                  <Icon d={NAV_ICONS[tab]} size={15} />
                </span>
                <span className="flex-1">{NAV_LABELS[tab]}</span>
                {badge !== null && badge! > 0 && (
                  <span className="text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0" style={
                    tab === "alerts" ? { backgroundColor: "#7A0F1D", color: "#fff" } : { backgroundColor: "rgba(212,175,55,0.2)", color: "#D4AF37" }
                  }>{badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 space-y-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="text-[11px]" style={{ color: "#6B6560" }}>{t.sidebar.snapshot}</p>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: "#A6192E" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#7A0F1D" }} />
            {criticalCount} {t.sidebar.criticalAlertsActive}
          </div>

        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col min-h-screen overflow-auto">

        {/* Page header */}
        <header className="sticky top-0 z-20 px-8 py-4" style={{ backgroundColor: "#FFFFFF", borderBottom: "1px solid #E8E2DA" }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-bold" style={{ fontSize: "20px", color: "#14110F", fontFamily: "Fraunces, serif", fontVariationSettings: "'opsz' 48", letterSpacing: "-0.01em" }}>
                {NAV_LABELS[activeTab]}
              </h1>
              <p className="text-xs mt-0.5 max-w-2xl" style={{ color: "#6B6560" }}>{NAV_DESC[activeTab]}</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="text-sm font-bold text-white rounded-lg px-4 py-2 transition-colors" style={{ backgroundColor: "#7A0F1D" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#5E0B15")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#7A0F1D")}>
                {t.header.refreshData}
              </button>
            </div>
          </div>
        </header>

        <div className="px-8 py-7 space-y-7 flex-1">

          {activeTab === "imbalances" && (
            <div className="grid grid-cols-4 gap-5">
              <KpiCard
                label={t.kpi.chargebackExposure}
                value={`$${((summary?.penaltyExposure ?? 0) / 1000).toFixed(0)}K`}
                trend={{ label: t.kpi.chargebackTrend, isNegative: true }}
                context={t.kpi.chargebackContext}
                accent="critical"
              />
              <KpiCard
                label={t.kpi.criticalImbalances}
                value={`${criticalCount} SKUs`}
                context={t.kpi.criticalContext}
                accent="critical"
              />
              <KpiCard
                label={t.kpi.transfersRecommended}
                value={String(transferCount)}
                context={t.kpi.transfersContext(`$${Math.round(summary?.estimatedNetSavings ?? 0).toLocaleString()}`)}
                accent="warning"
              />
              <KpiCard
                label={t.kpi.pendingPos}
                value={String(summary?.pendingInboundPos ?? 0)}
                context={t.kpi.pendingContext}
                accent="neutral"
              />
            </div>
          )}

          {activeTab === "imbalances" && <InventoryTable />}
          {activeTab === "chargebacks" && <ChargebackTable />}
          {activeTab === "transfers" && <TransferPanel />}
          {activeTab === "charts" && <InventoryCharts />}

          {activeTab === "alerts" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-sm" style={{ color: "#6B6560" }}>
                  <span className="font-semibold" style={{ color: "#14110F" }}>{t.alerts.activeAlerts(visibleAlerts.length)}</span>
                  {" "}· {t.alerts.sortedBy}
                </p>
                <button
                  onClick={dismissAllAlerts}
                  className="text-sm font-semibold rounded-lg px-4 py-2 transition-colors"
                  style={{ border: "1px solid #D6CFC7", color: "#403A34", backgroundColor: "#FFFFFF" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#F2EDE5")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#FFFFFF")}
                >
                  {t.alerts.markAllReviewed}
                </button>
              </div>

              <AlertsBanner alerts={visibleAlerts} onDismiss={dismissAlert} />

              {/* URGENT Spreadsheet */}
              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8E2DA", boxShadow: "0 1px 2px rgba(20,17,15,0.05)" }}>
                <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "1px solid #E8E2DA" }}>
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest rounded-full px-3 py-1" style={{ color: "#7A0F1D", backgroundColor: "#FBEEEF", border: "1px solid #F4D5D8" }}>
                        {t.alerts.manualProcess}
                      </span>
                      <h3 className="text-base font-bold" style={{ color: "#14110F" }}>{t.alerts.currentWorkflow}</h3>
                    </div>
                    <p className="text-sm mt-1 max-w-2xl" style={{ color: "#6B6560" }}>{t.alerts.workflowDesc}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-6">
                    <p className="mono text-4xl font-bold text-[#A6192E]">{summary?.urgentRequestTotal ?? 0}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t.alerts.transferActionsLogged}</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr style={{ backgroundColor: "#FAF7F1" }}>
                        {t.alerts.tableHeaders.map((h) => (
                          <th key={h} className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "#6B6560", borderBottom: "1px solid #E8E2DA" }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {urgentRequests.map((r, i) => {
                        const isUrgent = /urgent|out of stock|asap/i.test(r.note);
                        return (
                          <tr key={r.id} style={{ borderBottom: "1px solid #F2EDE5", backgroundColor: i % 2 === 0 ? "#FFFFFF" : "#FAF7F1" }}>
                            <td className="px-5 py-3 mono text-xs" style={{ color: "#B8B1AA" }}>{r.id}</td>
                            <td className="px-5 py-3 mono font-semibold" style={{ color: "#403A34" }}>{r.sku}</td>
                            <td className="px-5 py-3" style={{ color: "#403A34" }}>{r.product}</td>
                            <td className="px-5 py-3 mono" style={{ color: "#6B6560" }}>{r.qty}</td>
                            <td className="px-5 py-3">
                              <span className="font-semibold" style={{ color: isUrgent ? "#7A0F1D" : "#403A34" }}>{r.note}</span>
                            </td>
                            <td className="px-5 py-3 mono text-xs" style={{ color: "#B8B1AA" }}>{r.date}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Before / After */}
              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8E2DA", boxShadow: "0 1px 2px rgba(20,17,15,0.05)" }}>
                <div className="px-6 py-5" style={{ borderBottom: "1px solid #E8E2DA" }}>
                  <h3 className="text-base font-bold" style={{ color: "#14110F", fontFamily: "Fraunces, serif", fontVariationSettings: "'opsz' 48" }}>{t.alerts.costAnalysis}</h3>
                  <p className="text-sm mt-0.5" style={{ color: "#6B6560" }}>
                    {scenario
                      ? t.alerts.costAnalysisDesc(scenario.sku, scenario.product, scenario.destinationDc)
                      : t.alerts.costAnalysisNoData}
                  </p>
                </div>
                <div className="grid grid-cols-2">
                  <div className="p-6" style={{ borderRight: "1px solid #E8E2DA" }}>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xs font-bold uppercase tracking-widest rounded-full px-3 py-1" style={{ color: "#7A0F1D", backgroundColor: "#FBEEEF", border: "1px solid #F4D5D8" }}>
                        {t.alerts.withoutSystem}
                      </span>
                    </div>
                    <ol className="space-y-3 text-sm" style={{ color: "#6B6560" }}>
                      {[
                        "Order hits DC-NJ. System shows 0 available units.",
                        <span key="2">Ops manager logs request: <span className="font-semibold" style={{ color: "#7A0F1D" }}>"URGENT! F-04130, 4 pallets"</span>.</span>,
                        "Manual stock check causes 3–5 day processing delay.",
                        <>Order is split. Short-ship penalty issued: <span className="mono font-bold" style={{ color: "#A6192E" }}>${Math.round((scenario?.penaltyExposure ?? 0) / 2).toLocaleString()}</span></>,
                        <>Second shipment late. Late-delivery penalty: <span className="mono font-bold" style={{ color: "#A6192E" }}>${Math.round((scenario?.penaltyExposure ?? 0) / 2).toLocaleString()}</span></>,
                      ].map((step, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="mono flex-shrink-0 font-medium" style={{ color: "#D6CFC7" }}>{i + 1}.</span>
                          <span>{step}</span>
                        </li>
                      ))}
                      <li className="flex gap-3 pt-2 mt-1" style={{ borderTop: "1px solid #F2EDE5" }}>
                        <span className="mono font-bold flex-shrink-0" style={{ color: "#A6192E" }}>→</span>
                        <span className="font-semibold" style={{ color: "#A6192E" }}>
                          ${Math.round(scenario?.penaltyExposure ?? 0).toLocaleString()} total penalty exposure.
                        </span>
                      </li>
                    </ol>
                  </div>
                  <div className="p-6" style={{ backgroundColor: "#EEF7F5" }}>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xs font-bold uppercase tracking-widest rounded-full px-3 py-1" style={{ color: "#125F54", backgroundColor: "#DCEFEB", border: "1px solid #7AC4B8" }}>
                        {t.alerts.withSystem}
                      </span>
                    </div>
                    <ol className="space-y-3 text-sm" style={{ color: "#403A34" }}>
                      {[
                        <>System flags DC-NJ at <strong>8 days estimated supply</strong>, 14 days prior to order window.</>,
                        <>Alert generated: NJ demand outpaces supply. SF has 126d supply. Recommend transfer.</>,
                        <>Cost Model: Transfer {scenario?.sourceDc ?? "—"}→{scenario?.destinationDc ?? "—"} · <span className="mono font-bold" style={{ color: "#14110F" }}>${Math.round(scenario?.transferCost ?? 0).toLocaleString()} freight</span> · Risk avoided: ${Math.round(scenario?.penaltyExposure ?? 0).toLocaleString()}</>,
                        "Ops manager approves transfer in dashboard. Initiated same day.",
                        "DC-NJ ships order on time, in full. Zero penalties incurred.",
                      ].map((step, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="mono flex-shrink-0 font-medium" style={{ color: "#7AC4B8" }}>{i + 1}.</span>
                          <span>{step}</span>
                        </li>
                      ))}
                      <li className="flex gap-3 pt-2 mt-1" style={{ borderTop: "1px solid #DCEFEB" }}>
                        <span className="mono font-bold flex-shrink-0" style={{ color: "#125F54" }}>→</span>
                        <span className="font-semibold" style={{ color: "#125F54" }}>
                          Net saving: ${Math.round(scenario?.netSaving ?? 0).toLocaleString()}. Imbalance resolved proactively.
                        </span>
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

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}
