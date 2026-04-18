import { useState, useEffect } from "react";
import { api } from "../api/client";
import type { DcSlot } from "../data/mockData";

// ─── Build SkuRows from live_inventory.json ────────────────────────────────────
type LiveDc = { stock_on_hand: number; incoming_stock: number; days_of_supply: number };

function dcSlot(dc: LiveDc, demand: number): DcSlot {
  return {
    onHand: dc.stock_on_hand,
    allocated: 0,
    available: dc.stock_on_hand,
    daysSupply: dc.days_of_supply,
    velocityPerDay: Math.round(demand * 10) / 10,
    isEstimated: false,
  };
}

// FIX: Added 'inactive' status for items with 0 demand
function liveStatus(sfDos: number, njDos: number, laDos: number, demand: number): "critical" | "warning" | "ok" | "inactive" {
  if (demand === 0) return "inactive";
  const worst = Math.min(sfDos, njDos, laDos);
  if (worst < 14) return "critical";
  if (worst < 30) return "warning";
  return "ok";
}

type RawInventory = {
  METADATA: { avg_penalty_cost: number; avg_transfer_cost: number };
  ITEMS: Record<string, { item_name: string; avg_daily_demand: number; inventory_by_dc: Record<string, LiveDc> }>;
};

function buildInventoryRows(raw: RawInventory) {
  return Object.entries(raw.ITEMS)
    .map(([sku, item]) => {
      const dcMap = item.inventory_by_dc;
      const sfRaw = dcMap["Site 1 - SF"] ?? { stock_on_hand: 0, incoming_stock: 0, days_of_supply: 9999 };
      const njRaw = dcMap["Site 2 - NJ"] ?? { stock_on_hand: 0, incoming_stock: 0, days_of_supply: 9999 };
      const laRaw = dcMap["Site 3 - LA"] ?? { stock_on_hand: 0, incoming_stock: 0, days_of_supply: 9999 };
      const demand = item.avg_daily_demand;

      const sfDos = sfRaw.days_of_supply;
      const njDos = njRaw.days_of_supply;
      const laDos = laRaw.days_of_supply;

      const totalStock = sfRaw.stock_on_hand + njRaw.stock_on_hand + laRaw.stock_on_hand;
      const companyDos = demand > 0 ? Math.round(totalStock / demand) : 9999;
      const status = liveStatus(sfDos, njDos, laDos, demand);
      const worstDos = Math.min(sfDos, njDos, laDos);
      const missingDays = Math.max(0, 14 - worstDos);
      const cbRisk = status === "critical" ? Math.round(demand * missingDays * 4.25) : 0;

      return {
        sku,
        product: item.item_name,
        category: sku.startsWith("T-") ? "OTC Analgesic" : sku.startsWith("F-") ? "Candy & Snacks" : sku.startsWith("AC-") || sku.startsWith("A-") ? "Am. Ginseng" : "General",
        unitCost: 0,
        dcSF: dcSlot(sfRaw, demand),
        dcNJ: dcSlot(njRaw, demand),
        dcLA: dcSlot(laRaw, demand),
        companyAvailable: totalStock,
        companyDaysSupply: companyDos,
        status,
        chargebackRisk: cbRisk,
        inboundPo: null,
        note: status === "inactive" ? "Dead stock. No recent demand across all regions." : (worstDos < 5 && status === "critical" ? `Lowest DC at ${worstDos}d · ${demand.toFixed(0)} units/day burn rate` : undefined),
      };
    })
    .filter((row) => row.status !== "ok")
    .sort((a, b) => {
      const order = { critical: 0, warning: 1, inactive: 2, ok: 3 };
      return order[a.status] - order[b.status];
    });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS = {
  critical: { label: "Critical", dot: "bg-red-500", text: "text-red-700", pill: "bg-red-50 text-red-700 border border-red-200" },
  warning:  { label: "Warning",  dot: "bg-amber-400", text: "text-amber-700", pill: "bg-amber-50 text-amber-700 border border-amber-200" },
  ok:       { label: "OK",       dot: "bg-emerald-500", text: "text-emerald-700", pill: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  inactive: { label: "Dead Stock", dot: "bg-slate-400", text: "text-slate-700", pill: "bg-slate-100 text-slate-700 border border-slate-200" },
};

function dosColor(days: number) {
  if (days === 9999) return { text: "text-gray-500", bg: "bg-gray-200" }; 
  if (days === 0) return { text: "text-red-600", bg: "bg-red-500" };
  if (days < 14)  return { text: "text-red-500",   bg: "bg-red-400" };
  if (days < 30)  return { text: "text-amber-600", bg: "bg-amber-400" };
  if (days < 60)  return { text: "text-amber-500", bg: "bg-amber-300" };
  return            { text: "text-emerald-600", bg: "bg-emerald-400" };
}

function DcCell({ slot, isHub }: { slot: DcSlot; isHub?: boolean }) {
  const col = dosColor(slot.daysSupply);
  const isNoDemand = slot.daysSupply === 9999;
  const pct = isNoDemand ? 0 : Math.min((slot.daysSupply / 300) * 100, 100);
  const isEmpty = slot.available === 0;

  return (
    <div className="text-right min-w-[90px]">
      {isHub && <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600 mb-0.5">Hub</p>}
      <p className={`mono text-base font-bold leading-none ${isEmpty ? "text-red-500" : "text-gray-900"}`}>
        {isEmpty ? "—" : slot.available.toLocaleString()}
      </p>
      <p className="text-[11px] text-gray-400 mt-0.5 mono">{isNoDemand ? "—" : `${slot.velocityPerDay}/day`}</p>
      <div className="flex items-center justify-end gap-1.5 mt-1.5">
        <div className="w-12 h-1 rounded-full bg-gray-100 overflow-hidden">
          <div className={`h-full rounded-full ${col.bg}`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`mono text-[11px] font-semibold ${col.text} whitespace-nowrap`}>
          {isNoDemand ? "No Demand" : slot.daysSupply === 0 ? "0d" : `${slot.daysSupply}d`}
        </span>
      </div>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({ row, onClose }: { row: any; onClose: () => void }) {
  const DC_KEYS = [
    { key: "dcSF" as const, label: "DC-SF · Livermore", role: "Hub", accent: "teal" },
    { key: "dcNJ" as const, label: "DC-NJ · New Jersey", role: "Primary", accent: "red" },
    { key: "dcLA" as const, label: "DC-LA · Los Angeles", role: "", accent: "slate" },
  ];

  const statusCfg = STATUS[row.status as keyof typeof STATUS];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>

        {/* Modal header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2.5">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 ${statusCfg.pill}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                {statusCfg.label}
              </span>
              <span className="mono text-xs text-gray-400 bg-gray-100 rounded px-2 py-0.5">{row.sku}</span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mt-1.5">{row.product}</h3>
            <p className="text-sm text-gray-400">{row.category}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 ml-4 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-xl">
            ×
          </button>
        </div>

        {/* DC cards */}
        <div className="grid grid-cols-3 gap-4 p-6 border-b border-gray-100">
          {DC_KEYS.map(({ key, label, role }) => {
            const slot = row[key];
            const col = dosColor(slot.daysSupply);
            const isNoDemand = slot.daysSupply === 9999;
            return (
              <div key={key} className="rounded-xl border border-gray-200 p-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500">{label}</p>
                  {role && <p className="text-[10px] text-gray-400">{role}</p>}
                </div>
                <p className={`mono text-2xl font-bold mt-2 ${slot.available === 0 ? "text-red-500" : "text-gray-900"}`}>
                  {slot.available.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400 mono">avail · {slot.onHand.toLocaleString()} on-hand</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className={`h-full rounded-full ${col.bg}`} style={{ width: `${isNoDemand ? 0 : Math.min(slot.daysSupply / 300 * 100, 100)}%` }} />
                  </div>
                  <span className={`mono text-xs font-bold ${col.text}`}>
                    {isNoDemand ? "No Demand" : `${slot.daysSupply}d`}
                  </span>
                </div>
                <p className="mono text-xs text-gray-400 mt-1">{isNoDemand ? "—" : `${slot.velocityPerDay} units/day`}</p>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 flex gap-2">
          {row.status === "critical" || row.status === "warning" ? (
            <button className="text-sm font-semibold text-white rounded-lg px-5 py-2.5 bg-[#A6192E] hover:bg-red-800 transition-colors">
              Initiate Transfer
            </button>
          ) : row.status === "inactive" ? (
            <button className="text-sm font-semibold text-white rounded-lg px-5 py-2.5 bg-slate-800 hover:bg-slate-900 transition-colors">
              Flag for Liquidation
            </button>
          ) : null}
          <button onClick={onClose} className="text-sm font-medium text-gray-400 border border-gray-200 rounded-lg px-4 py-2.5 hover:bg-gray-50 ml-auto">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Table ───────────────────────────────────────────────────────────────
type SortKey = "status" | "chargebackRisk" | "companyDaysSupply";
type FilterStatus = "all" | "critical" | "warning" | "inactive";

export function InventoryTable() {
  const [inventoryData, setInventoryData] = useState<ReturnType<typeof buildInventoryRows>>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<any | null>(null);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [sort, setSort] = useState<SortKey>("status");
  const statusOrder = { critical: 0, warning: 1, inactive: 2, ok: 3 };

  useEffect(() => {
    api.getInventory()
      .then((raw) => setInventoryData(buildInventoryRows(raw as RawInventory)))
      .catch(() => setLoadError("Could not load inventory. Is the backend running?"));
  }, []);

  const counts = {
    all: inventoryData.filter((r) => r.status === "critical" || r.status === "warning").length,
    critical: inventoryData.filter((r) => r.status === "critical").length,
    warning: inventoryData.filter((r) => r.status === "warning").length,
    inactive: inventoryData.filter((r) => r.status === "inactive").length,
  };

  const rows = inventoryData
    .filter((r) => filter === "all" ? r.status !== "inactive" : r.status === filter)
    .sort((a, b) => {
      if (sort === "status") return statusOrder[a.status as keyof typeof statusOrder] - statusOrder[b.status as keyof typeof statusOrder];
      if (sort === "chargebackRisk") return b.chargebackRisk - a.chargebackRisk;
      return a.companyDaysSupply - b.companyDaysSupply;
    });

  return (
    <>
      {loadError && (
        <div className="bg-red-50 rounded-xl border border-red-200 px-5 py-3.5 text-sm text-red-700 shadow-sm mb-4">
          {loadError}
        </div>
      )}
      <div className="flex items-start gap-3 bg-white border border-red-200 rounded-xl px-5 py-3.5 text-sm shadow-sm">
        <span className="font-bold text-[#A6192E] flex-shrink-0">ACTION REQUIRED</span>
        <p className="text-gray-500">
          Showing <strong className="text-gray-700">{inventoryData.length} SKUs</strong> currently facing shortages or marked as dead stock (No Demand). Healthy inventory is hidden.
        </p>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 mt-4 mb-4">
        <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl p-1.5 shadow-sm">
          {(["all", "critical", "warning", "inactive"] as FilterStatus[]).map((f) => {
            const active = filter === f;
            const dot = f === "critical" ? "bg-red-500" : f === "warning" ? "bg-amber-400" : f === "inactive" ? "bg-slate-400" : "";
            const label = f === "all" ? "All At Risk" : f === "inactive" ? "Dead Stock" : f.charAt(0).toUpperCase() + f.slice(1);
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  active ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                }`}
              >
                {f !== "all" && <span className={`w-1.5 h-1.5 rounded-full ${active ? "opacity-80" : ""} ${dot}`} />}
                {label}
                <span className={`mono text-[11px] ${active ? "opacity-70" : "text-gray-400"}`}>({counts[f]})</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span>Sort:</span>
          {([["status", "Risk Level"], ["chargebackRisk", "CB Exposure"], ["companyDaysSupply", "Days Supply"]] as [SortKey, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                sort === key
                  ? "border-gray-800 text-gray-900 font-semibold bg-white shadow-sm"
                  : "border-gray-200 text-gray-500 hover:border-gray-400 bg-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm relative">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-[#F9FAFB]">
                <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-widest text-gray-400 min-w-[220px]">Product</th>
                <th className="px-3 py-3.5 text-right text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  DC-SF <span className="font-normal text-teal-500">(Hub)</span>
                </th>
                <th className="px-3 py-3.5 text-right text-[11px] font-bold uppercase tracking-widest text-gray-400">DC-NJ</th>
                <th className="px-3 py-3.5 text-right text-[11px] font-bold uppercase tracking-widest text-gray-400">DC-LA</th>
                <th className="px-3 py-3.5 text-right text-[11px] font-bold uppercase tracking-widest text-gray-400">Company</th>
                <th className="px-3 py-3.5 text-center text-[11px] font-bold uppercase tracking-widest text-gray-400">Status</th>
                <th className="px-3 py-3.5 text-right text-[11px] font-bold uppercase tracking-widest text-gray-400">CB Risk</th>
                <th className="px-4 py-3.5 sticky right-0 bg-[#F9FAFB] z-10 shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.05)]" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const s = STATUS[row.status as keyof typeof STATUS];
                const bgClass = i % 2 === 1 ? "bg-gray-50/40" : "bg-white";
                
                return (
                  <tr
                    key={row.sku}
                    className={`border-b border-gray-100 hover:bg-blue-50/30 cursor-pointer transition-colors group ${bgClass}`}
                    onClick={() => setSelected(row)}
                  >
                    <td className="px-4 py-4">
                      <p className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">{row.product}</p>
                      <p className="mono text-[11px] text-gray-400 mt-0.5">{row.sku} · {row.category}</p>
                      {row.note && (
                        <p className={`text-[11px] mt-1 max-w-[200px] leading-tight line-clamp-1 ${row.status === 'inactive' ? 'text-slate-500' : 'text-amber-600'}`}>
                          {row.status === 'inactive' ? 'ℹ' : '⚠'} {row.note.slice(0, 55)}…
                        </p>
                      )}
                    </td>

                    <td className="px-3 py-4"><DcCell slot={row.dcSF} isHub /></td>
                    <td className="px-3 py-4"><DcCell slot={row.dcNJ} /></td>
                    <td className="px-3 py-4"><DcCell slot={row.dcLA} /></td>

                    <td className="px-3 py-4 text-right">
                      <p className="mono text-base font-bold text-gray-900">{row.companyDaysSupply === 9999 ? "No Demand" : `${row.companyDaysSupply}d`}</p>
                      <p className="mono text-[11px] text-gray-400 whitespace-nowrap">{row.companyAvailable.toLocaleString()} avail</p>
                    </td>

                    <td className="px-3 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 rounded-full text-xs font-semibold px-2.5 py-1 whitespace-nowrap ${s.pill}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
                    </td>

                    <td className="px-3 py-4 text-right">
                      {row.chargebackRisk > 0 ? (
                        <span className="mono text-sm font-bold text-red-600">${row.chargebackRisk.toLocaleString()}</span>
                      ) : (
                        <span className="mono text-sm text-gray-300">—</span>
                      )}
                    </td>

                    <td className={`px-4 py-4 sticky right-0 z-10 shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.05)] transition-colors ${bgClass} group-hover:bg-blue-50`}>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {row.status === "critical" || row.status === "warning" ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelected(row); }}
                            className="text-xs font-semibold text-white rounded-lg px-3 py-1.5 whitespace-nowrap bg-[#A6192E] hover:bg-red-800 transition-colors shadow-sm"
                          >
                            Transfer
                          </button>
                        ) : row.status === "inactive" ? (
                           <button
                            onClick={(e) => { e.stopPropagation(); setSelected(row); }}
                            className="text-xs font-semibold text-white rounded-lg px-3 py-1.5 whitespace-nowrap bg-slate-800 hover:bg-slate-900 transition-colors shadow-sm"
                          >
                            Liquidate
                          </button>
                        ) : null}
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelected(row); }}
                          className="text-xs font-medium text-gray-600 border border-gray-200 bg-white rounded-lg px-3 py-1.5 hover:bg-gray-50 whitespace-nowrap shadow-sm"
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <DetailModal row={selected} onClose={() => setSelected(null)} />}
    </>
  );
}