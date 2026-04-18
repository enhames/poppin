import { useState } from "react";
import { inventoryData, alertsData, chargebackData, transferRecs } from "./data/mockData";
import { AlertsBanner } from "./components/AlertsBanner";
import { InventoryTable } from "./components/InventoryTable";
import { ChargebackTable } from "./components/ChargebackTable";
import { TransferPanel } from "./components/TransferPanel";

type Tab = "imbalances" | "chargebacks" | "transfers" | "alerts";

const tabs: { id: Tab; label: string }[] = [
  { id: "imbalances", label: "Inventory Imbalances" },
  { id: "chargebacks", label: "Chargeback Analysis" },
  { id: "transfers", label: "Transfer Decisions" },
  { id: "alerts", label: "Early Warnings" },
];

const criticalCount = alertsData.filter((a) => a.severity === "critical").length;
const totalChargebackRisk = inventoryData.reduce((s, r) => s + r.chargebackRisk, 0);
const transferCount = transferRecs.filter((r) => r.recommendation === "TRANSFER").length;
const operationalCB = chargebackData.filter((r) => r.type === "operational").reduce((s, r) => s + r.amount, 0);

function KpiCard({
  label,
  value,
  sub,
  variant = "default",
}: {
  label: string;
  value: string;
  sub: string;
  variant?: "default" | "critical" | "warning" | "accent";
}) {
  const styles = {
    default: "border-gray-200 text-gray-900",
    critical: "border-[oklch(0.55_0.22_25)] text-[oklch(0.45_0.22_25)]",
    warning: "border-[oklch(0.72_0.17_65)] text-[oklch(0.52_0.17_65)]",
    accent: "border-[oklch(0.65_0.18_200)] text-[oklch(0.40_0.18_200)]",
  };
  return (
    <div className={`bg-white rounded-xl border-2 p-5 ${styles[variant]}`}>
      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</div>
      <div className={`font-mono text-2xl font-bold ${styles[variant].split(" ")[1]}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-1">{sub}</div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("imbalances");

  const tabBadge: Partial<Record<Tab, number>> = {
    alerts: criticalCount,
    transfers: transferCount,
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
      {/* Sidebar */}
      <aside
        className="w-56 flex-shrink-0 flex flex-col"
        style={{ backgroundColor: "oklch(0.13 0.03 240)", minHeight: "100vh" }}
      >
        {/* Logo */}
        <div className="px-5 pt-6 pb-5 border-b" style={{ borderColor: "oklch(0.22 0.03 240)" }}>
          <div className="text-white font-bold text-base leading-tight">Prince of Peace</div>
          <div className="text-[10px] font-semibold uppercase tracking-widest mt-0.5" style={{ color: "oklch(0.65 0.18 200)" }}>
            Inventory Command
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="w-full text-left flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all"
                style={{
                  backgroundColor: active ? "oklch(0.65 0.18 200 / 0.18)" : "transparent",
                  color: active ? "oklch(0.85 0.10 200)" : "oklch(0.65 0.02 240)",
                }}
              >
                <span>{tab.label}</span>
                {tabBadge[tab.id] !== undefined && (
                  <span
                    className="text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center"
                    style={{
                      backgroundColor: tab.id === "alerts" ? "oklch(0.55 0.22 25)" : "oklch(0.65 0.18 200 / 0.3)",
                      color: "white",
                    }}
                  >
                    {tabBadge[tab.id]}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t" style={{ borderColor: "oklch(0.22 0.03 240)" }}>
          <div className="text-[10px] text-gray-600">Snapshot: Apr 17, 2026</div>
          <div className="text-[10px] text-gray-600">3 DCs · 9 Channels · ~800 SKUs</div>
          <div
            className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-semibold rounded-full px-2.5 py-1"
            style={{ backgroundColor: "oklch(0.55 0.22 25 / 0.15)", color: "oklch(0.75 0.14 25)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.75_0.14_25)] animate-pulse inline-block" />
            {criticalCount} Critical Alerts
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto" style={{ backgroundColor: "oklch(0.97 0.005 240)" }}>
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              {tabs.find((t) => t.id === activeTab)?.label}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {activeTab === "imbalances" && "Site-level inventory vs. company-level — flagging hidden imbalances"}
              {activeTab === "chargebacks" && "Historical penalty patterns by cause code, channel, and DC"}
              {activeTab === "transfers" && "Transfer vs. wait decision support with cost tradeoff analysis"}
              {activeTab === "alerts" && "Proactive stockout warnings before customer orders expose the problem"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="text-xs font-medium text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors">
              Export CSV
            </button>
            <button
              className="text-xs font-semibold text-white rounded-lg px-4 py-1.5 transition-colors"
              style={{ backgroundColor: "oklch(0.13 0.03 240)" }}
            >
              Refresh Data
            </button>
          </div>
        </header>

        <div className="px-8 py-6 space-y-6">
          {/* KPI Strip — always visible */}
          <div className="grid grid-cols-4 gap-4">
            <KpiCard
              label="Active Critical Alerts"
              value={String(criticalCount)}
              sub="SKUs at immediate risk"
              variant="critical"
            />
            <KpiCard
              label="Live CB Exposure"
              value={`$${totalChargebackRisk.toLocaleString()}`}
              sub="From current imbalances"
              variant="critical"
            />
            <KpiCard
              label="Transfers Recommended"
              value={String(transferCount)}
              sub={`of ${transferRecs.length} flagged SKUs`}
              variant="warning"
            />
            <KpiCard
              label="Operational CB (3yr)"
              value={`$${operationalCB.toLocaleString()}`}
              sub="Excluding promo deductions"
              variant="default"
            />
          </div>

          {/* Tab content */}
          {activeTab === "imbalances" && <InventoryTable />}
          {activeTab === "chargebacks" && <ChargebackTable />}
          {activeTab === "transfers" && <TransferPanel />}
          {activeTab === "alerts" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  {alertsData.length} active alerts · sorted by severity · updated at snapshot time
                </p>
                <button className="text-xs font-medium border border-gray-200 rounded-lg px-3 py-1.5 text-gray-500 hover:text-gray-800 transition-colors">
                  Mark All Reviewed
                </button>
              </div>
              <AlertsBanner />

              {/* Before/After comparison */}
              <div className="mt-6 rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                <div className="border-b border-gray-200 px-5 py-3">
                  <h3 className="text-sm font-bold text-gray-900">Before vs. After: System-Assisted vs. Manual Process</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Example scenario: Tiger Balm Red 1.7oz — DC-East stockout</p>
                </div>
                <div className="grid grid-cols-2 divide-x divide-gray-200">
                  <div className="p-5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Manual (Current Process)</div>
                    <ol className="space-y-2 text-sm text-gray-600">
                      <li className="flex gap-2"><span className="font-mono text-gray-300 flex-shrink-0">1.</span> Walmart order arrives at DC-East. System shows 0 available.</li>
                      <li className="flex gap-2"><span className="font-mono text-gray-300 flex-shrink-0">2.</span> CS team flags buyer. Buyer manually checks DC-West spreadsheet.</li>
                      <li className="flex gap-2"><span className="font-mono text-gray-300 flex-shrink-0">3.</span> POP splits order: partial from DC-West, remainder to follow.</li>
                      <li className="flex gap-2"><span className="font-mono text-gray-300 flex-shrink-0">4.</span> Walmart receives partial. Short-ship chargeback issued: <span className="font-mono font-semibold text-[oklch(0.55_0.22_25)]">$1,200</span></li>
                      <li className="flex gap-2"><span className="font-mono text-gray-300 flex-shrink-0">5.</span> Second shipment arrives late. Late-delivery penalty: <span className="font-mono font-semibold text-[oklch(0.55_0.22_25)]">$1,200</span></li>
                      <li className="flex gap-2 font-semibold text-[oklch(0.45_0.22_25)]"><span className="font-mono flex-shrink-0">→</span> Total cost: $2,400 on a $420 order</li>
                    </ol>
                  </div>
                  <div className="p-5" style={{ backgroundColor: "oklch(0.97 0.005 145)" }}>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[oklch(0.45_0.15_145)] mb-3">System-Assisted (This Dashboard)</div>
                    <ol className="space-y-2 text-sm text-gray-600">
                      <li className="flex gap-2"><span className="font-mono text-gray-300 flex-shrink-0">1.</span> Dashboard flags DC-East imbalance <span className="font-semibold">14 days before</span> next Walmart order.</li>
                      <li className="flex gap-2"><span className="font-mono text-gray-300 flex-shrink-0">2.</span> System recommends: transfer 200 units from DC-West. Freight: <span className="font-mono font-semibold text-gray-800">$840</span></li>
                      <li className="flex gap-2"><span className="font-mono text-gray-300 flex-shrink-0">3.</span> Ops manager approves transfer in one click.</li>
                      <li className="flex gap-2"><span className="font-mono text-gray-300 flex-shrink-0">4.</span> DC-East fulfills Walmart order on time, in full.</li>
                      <li className="flex gap-2"><span className="font-mono text-gray-300 flex-shrink-0">5.</span> No chargeback. OTIF score maintained.</li>
                      <li className="flex gap-2 font-semibold text-[oklch(0.40_0.15_145)]"><span className="font-mono flex-shrink-0">→</span> Net saving: $1,560 vs. doing nothing</li>
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
