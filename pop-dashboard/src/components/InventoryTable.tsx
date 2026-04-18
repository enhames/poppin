import { useState, useEffect } from "react";
import { api } from "../api/client";
import type { SkuRow, DcSlot } from "../data/mockData";

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
  critical: { label: "Critical",  dot: "bg-[#7A0F1D]", text: "text-[#7A0F1D]", pill: "bg-[#FBEEEF] text-[#7A0F1D] border border-[#F4D5D8]" },
  warning:  { label: "Warning",   dot: "bg-[#B97A15]", text: "text-[#8C5A0F]", pill: "bg-[#FEF7E8] text-[#8C5A0F] border border-[#E5B664]" },
  ok:       { label: "OK",        dot: "bg-[#1E8574]", text: "text-[#125F54]", pill: "bg-[#EEF7F5] text-[#125F54] border border-[#7AC4B8]" },
  inactive: { label: "Dead Stock", dot: "bg-[#8E8680]", text: "text-[#403A34]", pill: "bg-[#FAF7F1] text-[#403A34] border border-[#D6CFC7]" },
};

function dosColor(days: number) {
  if (days === 9999) return { text: "text-[#8E8680]", bg: "bg-[#B8B1AA]" };
  if (days === 0)    return { text: "text-[#7A0F1D]", bg: "bg-[#7A0F1D]" };
  if (days < 14)     return { text: "text-[#7A0F1D]", bg: "bg-[#A6192E]" };
  if (days < 30)     return { text: "text-[#8C5A0F]", bg: "bg-[#B97A15]" };
  if (days < 60)     return { text: "text-[#8C5A0F]", bg: "bg-[#E5B664]" };
  return               { text: "text-[#125F54]", bg: "bg-[#1E8574]" };
}

function DcCell({ slot, isHub }: { slot: DcSlot; isHub?: boolean }) {
  const col = dosColor(slot.daysSupply);
  const isNoDemand = slot.daysSupply === 9999;
  const pct = isNoDemand ? 0 : Math.min((slot.daysSupply / 300) * 100, 100);
  const isEmpty = slot.available === 0;

  return (
    <div className="text-right min-w-[90px]">
      {isHub && <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#125F54" }}>Hub</p>}
      <p className={`mono text-base font-bold leading-none`} style={{ color: isEmpty ? "#7A0F1D" : "#14110F" }}>
        {isEmpty ? "—" : slot.available.toLocaleString()}
      </p>
      <p className="text-[11px] mt-0.5 mono" style={{ color: "#8E8680" }}>{isNoDemand ? "—" : `${slot.velocityPerDay}/day`}</p>
      <div className="flex items-center justify-end gap-1.5 mt-1.5">
        <div className="w-12 h-1 rounded-full overflow-hidden" style={{ backgroundColor: "#E8E2DA" }}>
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
      <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden" style={{ boxShadow: "0 12px 32px -8px rgba(20,17,15,0.2)" }} onClick={(e) => e.stopPropagation()}>

        {/* Modal header */}
        <div className="flex items-start justify-between px-6 py-5" style={{ borderBottom: "1px solid #E8E2DA" }}>
          <div>
            <div className="flex items-center gap-2.5">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 ${statusCfg.pill}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                {statusCfg.label}
              </span>
              <span className="mono text-xs rounded px-2 py-0.5" style={{ color: "#8E8680", backgroundColor: "#FAF7F1" }}>{row.sku}</span>
            </div>
            <h3 className="text-lg font-bold mt-1.5" style={{ color: "#14110F", fontFamily: "Fraunces, serif", fontVariationSettings: "'opsz' 48" }}>{row.product}</h3>
            <p className="text-sm" style={{ color: "#8E8680" }}>{row.category}</p>
          </div>
          <button onClick={onClose} className="ml-4 w-8 h-8 flex items-center justify-center rounded-lg text-xl transition-colors" style={{ color: "#B8B1AA" }}>
            ×
          </button>
        </div>

        {/* DC cards */}
        <div className="grid grid-cols-3 gap-4 p-6" style={{ borderBottom: "1px solid #F2EDE5" }}>
          {DC_KEYS.map(({ key, label, role }) => {
            const slot = row[key];
            const col = dosColor(slot.daysSupply);
            const isNoDemand = slot.daysSupply === 9999;
            return (
              <div key={key} className="rounded-xl p-4" style={{ border: "1px solid #E8E2DA" }}>
                <div>
                  <p className="text-xs font-semibold" style={{ color: "#6B6560" }}>{label}</p>
                  {role && <p className="text-[10px]" style={{ color: "#8E8680" }}>{role}</p>}
                </div>
                <p className="mono text-2xl font-bold mt-2" style={{ color: slot.available === 0 ? "#7A0F1D" : "#14110F" }}>
                  {slot.available.toLocaleString()}
                </p>
                <p className="text-xs mono" style={{ color: "#8E8680" }}>avail · {slot.onHand.toLocaleString()} on-hand</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#E8E2DA" }}>
                    <div className={`h-full rounded-full ${col.bg}`} style={{ width: `${isNoDemand ? 0 : Math.min(slot.daysSupply / 300 * 100, 100)}%` }} />
                  </div>
                  <span className={`mono text-xs font-bold ${col.text}`}>
                    {isNoDemand ? "No Demand" : `${slot.daysSupply}d`}
                  </span>
                </div>
                <p className="mono text-xs mt-1" style={{ color: "#8E8680" }}>{isNoDemand ? "—" : `${slot.velocityPerDay} units/day`}</p>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 flex gap-2">
          {row.status === "critical" || row.status === "warning" ? (
            <button className="text-sm font-bold text-white rounded-lg px-5 py-2.5 transition-colors" style={{ backgroundColor: "#7A0F1D" }}>
              Initiate Transfer
            </button>
          ) : row.status === "inactive" ? (
            <button className="text-sm font-bold text-white rounded-lg px-5 py-2.5 transition-colors" style={{ backgroundColor: "#14110F" }}>
              Flag for Liquidation
            </button>
          ) : null}
          <button onClick={onClose} className="text-sm font-medium rounded-lg px-4 py-2.5 ml-auto transition-colors" style={{ color: "#6B6560", border: "1px solid #D6CFC7" }}>
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
      <div className="rounded-xl px-5 py-3.5 text-sm flex items-start gap-3" style={{ backgroundColor: "#FBEEEF", border: "1px solid #F4D5D8" }}>
        <span className="font-bold flex-shrink-0" style={{ color: "#7A0F1D" }}>ACTION REQUIRED</span>
        <p style={{ color: "#6B6560" }}>
          Showing <strong style={{ color: "#14110F" }}>{inventoryData.length} SKUs</strong> currently facing shortages or marked as dead stock (No Demand). Healthy inventory is hidden.
        </p>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 mt-4 mb-4">
        <div className="flex items-center gap-1.5 rounded-xl p-1.5" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8E2DA" }}>
          {(["all", "critical", "warning", "inactive"] as FilterStatus[]).map((f) => {
            const active = filter === f;
            const dotColor = f === "critical" ? "#7A0F1D" : f === "warning" ? "#B97A15" : f === "inactive" ? "#8E8680" : "";
            const label = f === "all" ? "All At Risk" : f === "inactive" ? "Dead Stock" : f.charAt(0).toUpperCase() + f.slice(1);
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  backgroundColor: active ? "#14110F" : "transparent",
                  color: active ? "#FFFFFF" : "#6B6560",
                }}
              >
                {f !== "all" && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: active ? "rgba(255,255,255,0.6)" : dotColor }} />}
                {label}
                <span className="mono text-[11px]" style={{ opacity: 0.6 }}>({counts[f]})</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-sm" style={{ color: "#8E8680" }}>
          <span>Sort:</span>
          {([["status", "Risk Level"], ["chargebackRisk", "CB Exposure"], ["companyDaysSupply", "Days Supply"]] as [SortKey, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className="px-3 py-1.5 rounded-lg text-sm transition-all"
              style={{
                border: `1px solid ${sort === key ? "#14110F" : "#D6CFC7"}`,
                color: sort === key ? "#14110F" : "#6B6560",
                fontWeight: sort === key ? 700 : 400,
                backgroundColor: "#FFFFFF",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl overflow-hidden relative" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8E2DA", boxShadow: "0 1px 2px rgba(20,17,15,0.05)" }}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ borderBottom: "1px solid #E8E2DA", backgroundColor: "#FAF7F1" }}>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.14em] min-w-[220px]" style={{ color: "#6B6560" }}>Product</th>
                <th className="px-3 py-3.5 text-right text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "#6B6560" }}>
                  DC-SF <span className="font-normal" style={{ color: "#1E8574" }}>(Hub)</span>
                </th>
                <th className="px-3 py-3.5 text-right text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "#6B6560" }}>DC-NJ</th>
                <th className="px-3 py-3.5 text-right text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "#6B6560" }}>DC-LA</th>
                <th className="px-3 py-3.5 text-right text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "#6B6560" }}>Company</th>
                <th className="px-3 py-3.5 text-center text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "#6B6560" }}>Status</th>
                <th className="px-3 py-3.5 text-right text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "#6B6560" }}>CB Risk</th>
                <th className="px-4 py-3.5 sticky right-0 z-10" style={{ backgroundColor: "#FAF7F1", boxShadow: "-5px 0 10px -5px rgba(20,17,15,0.06)" }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const s = STATUS[row.status as keyof typeof STATUS];

                return (
                  <tr
                    key={row.sku}
                    className="cursor-pointer transition-colors group"
                    style={{ borderBottom: "1px solid #F2EDE5", backgroundColor: i % 2 === 1 ? "#FAF7F1" : "#FFFFFF" }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#FDF9EC")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 1 ? "#FAF7F1" : "#FFFFFF")}
                    onClick={() => setSelected(row)}
                  >
                    <td className="px-4 py-4">
                      <p className="font-semibold text-sm leading-tight line-clamp-2" style={{ color: "#14110F" }}>{row.product}</p>
                      <p className="mono text-[11px] mt-0.5" style={{ color: "#8E8680" }}>{row.sku} · {row.category}</p>
                      {row.note && (
                        <p className="text-[11px] mt-1 max-w-[200px] leading-tight line-clamp-1" style={{ color: row.status === 'inactive' ? "#8E8680" : "#8C5A0F" }}>
                          {row.status === 'inactive' ? 'ℹ' : '⚠'} {row.note.slice(0, 55)}…
                        </p>
                      )}
                    </td>

                    <td className="px-3 py-4"><DcCell slot={row.dcSF} isHub /></td>
                    <td className="px-3 py-4"><DcCell slot={row.dcNJ} /></td>
                    <td className="px-3 py-4"><DcCell slot={row.dcLA} /></td>

                    <td className="px-3 py-4 text-right">
                      <p className="mono text-base font-bold" style={{ color: "#14110F" }}>{row.companyDaysSupply === 9999 ? "No Demand" : `${row.companyDaysSupply}d`}</p>
                      <p className="mono text-[11px] whitespace-nowrap" style={{ color: "#8E8680" }}>{row.companyAvailable.toLocaleString()} avail</p>
                    </td>

                    <td className="px-3 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 rounded-full text-xs font-semibold px-2.5 py-1 whitespace-nowrap ${s.pill}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
                    </td>

                    <td className="px-3 py-4 text-right">
                      {row.chargebackRisk > 0 ? (
                        <span className="mono text-sm font-bold" style={{ color: "#7A0F1D" }}>${row.chargebackRisk.toLocaleString()}</span>
                      ) : (
                        <span className="mono text-sm" style={{ color: "#D6CFC7" }}>—</span>
                      )}
                    </td>

                    <td className="px-4 py-4 sticky right-0 z-10 transition-colors" style={{ backgroundColor: i % 2 === 1 ? "#FAF7F1" : "#FFFFFF", boxShadow: "-5px 0 10px -5px rgba(20,17,15,0.06)" }}>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {row.status === "critical" || row.status === "warning" ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelected(row); }}
                            className="text-xs font-bold text-white rounded-lg px-3 py-1.5 whitespace-nowrap transition-colors"
                            style={{ backgroundColor: "#7A0F1D" }}
                          >
                            Transfer
                          </button>
                        ) : row.status === "inactive" ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelected(row); }}
                            className="text-xs font-bold text-white rounded-lg px-3 py-1.5 whitespace-nowrap transition-colors"
                            style={{ backgroundColor: "#14110F" }}
                          >
                            Liquidate
                          </button>
                        ) : null}
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelected(row); }}
                          className="text-xs font-semibold rounded-lg px-3 py-1.5 whitespace-nowrap transition-colors"
                          style={{ color: "#403A34", border: "1px solid #D6CFC7", backgroundColor: "#FFFFFF" }}
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