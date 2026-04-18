import { useState, useMemo, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type DcData = { stock_on_hand: number; incoming_stock: number; days_of_supply: number };
type ItemData = {
  item_name: string;
  avg_daily_demand: number;
  cases_per_pallet: number;
  inventory_by_dc: Record<string, DcData>;
};
type LiveInventory = { METADATA: { avg_penalty_cost: number; transfer_cost_by_lane?: Record<string, number> }; ITEMS: Record<string, ItemData> };
type Status = "stockout" | "critical" | "warning" | "watch" | "ok" | "inactive";
type NavFilter = "all" | "action" | "ok" | "inactive";

interface ProcessedItem {
  sku: string; name: string; demand: number;
  casesPerPallet: number;
  sf: DcData; nj: DcData; la: DcData;
  sfStatus: Status; njStatus: Status; laStatus: Status;
  worstStatus: Status; worstRank: number;
}

const DC_SF = "Site 1 - SF";
const DC_NJ = "Site 2 - NJ";
const DC_LA = "Site 3 - LA";

const STATUS_CFG: Record<Status, { label: string; shortLabel: string; dot: string; badge: string; barBg: string; rank: number }> = {
  stockout: { label: "Out of Stock",  shortLabel: "Out",      dot: "bg-red-600",     badge: "bg-red-600 text-white",                              barBg: "#EF4444", rank: 0 },
  critical: { label: "Critical",      shortLabel: "Critical", dot: "bg-red-500",     badge: "bg-red-100 text-red-700 border border-red-200",       barBg: "#F87171", rank: 1 },
  warning:  { label: "Running Low",   shortLabel: "Low",      dot: "bg-amber-400",   badge: "bg-amber-100 text-amber-700 border border-amber-200", barBg: "#FBBF24", rank: 2 },
  watch:    { label: "Monitoring",    shortLabel: "Watch",    dot: "bg-yellow-400",  badge: "bg-yellow-50 text-yellow-700 border border-yellow-200",barBg: "#FDE68A", rank: 3 },
  ok:       { label: "Well Stocked",  shortLabel: "Good",     dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 border border-emerald-200", barBg: "#34D399", rank: 4 },
  inactive: { label: "No Activity",   shortLabel: "—",        dot: "bg-gray-300",    badge: "bg-gray-100 text-gray-400",                          barBg: "#E5E7EB", rank: 5 },
};

function getStatus(days: number, demand: number): Status {
  if (demand === 0) return "inactive";
  if (days === 0) return "stockout";
  if (days < 14) return "critical";
  if (days < 30) return "warning";
  if (days < 60) return "watch";
  if (days >= 9999) return "inactive";
  return "ok";
}

function processInventory(raw: LiveInventory): ProcessedItem[] {
  return Object.entries(raw.ITEMS)
    .map(([rawSku, data]) => {
      const sku = rawSku.trim();
      const sf = data.inventory_by_dc[DC_SF];
      const nj = data.inventory_by_dc[DC_NJ];
      const la = data.inventory_by_dc[DC_LA];
      const demand = data.avg_daily_demand;
      const sfStatus = getStatus(sf.days_of_supply, demand);
      const njStatus = getStatus(nj.days_of_supply, demand);
      const laStatus = getStatus(la.days_of_supply, demand);
      const worstRank = Math.min(STATUS_CFG[sfStatus].rank, STATUS_CFG[njStatus].rank, STATUS_CFG[laStatus].rank);
      const worstStatus = (Object.keys(STATUS_CFG) as Status[]).find(k => STATUS_CFG[k].rank === worstRank) ?? "inactive";
      return {
        sku,
        name: data.item_name,
        demand,
        casesPerPallet: Number(data.cases_per_pallet || 1),
        sf,
        nj,
        la,
        sfStatus,
        njStatus,
        laStatus,
        worstStatus,
        worstRank,
      };
    })
    .sort((a, b) => a.worstRank - b.worstRank);
}

// ─── Recommendation helper ────────────────────────────────────────────────────
interface Rec { text: string; units: number; cost: number; route: string }

function getRecommendations(item: ProcessedItem, laneCosts: Record<string, number>): Rec[] {
  if (item.demand === 0) return [];
  const recs: Rec[] = [];
  const sfGood = item.sfStatus !== "stockout" && item.sfStatus !== "critical";
  const casesPerPallet = Math.max(1, Number(item.casesPerPallet || 1));
  if ((item.njStatus === "stockout" || item.njStatus === "critical") && sfGood) {
    const units = Math.max(0, Math.round((30 - item.nj.days_of_supply) * item.demand));
    const pallets = Math.ceil(units / casesPerPallet);
    const laneCost = Number(laneCosts["SF->NJ"] || 0);
    const cost = Math.round(pallets * laneCost);
    recs.push({ route: "SF → NJ", units, cost, text: `Transfer ${units.toLocaleString()} units from SF to NJ` });
  }
  if ((item.laStatus === "stockout" || item.laStatus === "critical") && sfGood) {
    const units = Math.max(0, Math.round((30 - item.la.days_of_supply) * item.demand));
    const pallets = Math.ceil(units / casesPerPallet);
    const laneCost = Number(laneCosts["SF->LA"] || 0);
    const cost = Math.round(pallets * laneCost);
    recs.push({ route: "SF → LA", units, cost, text: `Transfer ${units.toLocaleString()} units from SF to LA` });
  }
  return recs;
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Status }) {
  const s = STATUS_CFG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ─── DoS mini-bar (for heatmap) ───────────────────────────────────────────────
function DosMiniBar({ days, status }: { days: number; status: Status }) {
  if (status === "inactive") {
    return <span className="text-[11px] text-gray-300" style={{ fontFamily: "DM Mono, monospace" }}>—</span>;
  }
  const cappedDays = Math.min(days, 90);
  const pct = (cappedDays / 90) * 100;
  const color = STATUS_CFG[status].barBg;
  const label = days === 0 ? "0d" : days > 365 ? "365+d" : `${days}d`;
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden relative">
        <div className="h-full rounded transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
        {/* 30d safety line */}
        <div className="absolute top-0 bottom-0 w-px bg-gray-400 opacity-50" style={{ left: "33.3%" }} />
      </div>
      <span className="text-[11px] font-semibold w-10 text-right flex-shrink-0"
        style={{ fontFamily: "DM Mono, monospace", color: status === "stockout" || status === "critical" ? "#EF4444" : "#374151" }}>
        {label}
      </span>
    </div>
  );
}

// ─── DC Health Heatmap ────────────────────────────────────────────────────────
function Heatmap({ allItems, onSelect }: { allItems: ProcessedItem[]; onSelect: (sku: string) => void }) {
  const activeItems = allItems.filter(i => i.demand > 0).slice(0, 40);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Inventory Health by Product × Warehouse</h3>
          <p className="text-xs text-gray-400 mt-0.5">Each bar = days of stock left · dotted line = 30-day safety threshold · click any row to inspect</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#EF4444" }} />Critical</div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#FBBF24" }} />Low</div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#34D399" }} />Good</div>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid px-4 py-2 border-b border-gray-100 bg-gray-50 text-[11px] font-bold uppercase tracking-widest text-gray-400"
        style={{ gridTemplateColumns: "200px 1fr 1fr 1fr" }}>
        <span>Product</span>
        <span className="pl-1">SF · Hub</span>
        <span className="pl-1">NJ · Primary</span>
        <span className="pl-1">LA</span>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
        {activeItems.map(item => (
          <button
            key={item.sku}
            onClick={() => onSelect(item.sku)}
            className="w-full grid px-4 py-2.5 border-b border-gray-50 hover:bg-blue-50/40 text-left group transition-colors"
            style={{ gridTemplateColumns: "200px 1fr 1fr 1fr" }}
          >
            <div className="pr-3 min-w-0">
              <p className="text-xs font-semibold text-gray-800 leading-tight truncate group-hover:text-teal-700">
                {item.name}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5" style={{ fontFamily: "DM Mono, monospace" }}>{item.sku}</p>
            </div>
            <div className="px-1 flex items-center"><DosMiniBar days={item.sf.days_of_supply} status={item.sfStatus} /></div>
            <div className="px-1 flex items-center"><DosMiniBar days={item.nj.days_of_supply} status={item.njStatus} /></div>
            <div className="px-1 flex items-center"><DosMiniBar days={item.la.days_of_supply} status={item.laStatus} /></div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Overview Panel ───────────────────────────────────────────────────────────
function Overview({ allItems, onSelect }: { allItems: ProcessedItem[]; onSelect: (sku: string) => void }) {
  const topSellers = [...allItems].filter(i => i.demand > 0).sort((a, b) => b.demand - a.demand).slice(0, 10);
  const maxDemand = topSellers[0]?.demand ?? 1;
  const totalActive = allItems.filter(i => i.demand > 0).length;
  const critCount = allItems.filter(i => i.worstRank <= 1 && i.demand > 0).length;
  const warnCount = allItems.filter(i => i.worstRank === 2 && i.demand > 0).length;
  const okCount = allItems.filter(i => i.worstRank >= 3 && i.demand > 0).length;

  return (
    <div className="space-y-5">
      {/* Summary chips */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { n: totalActive, label: "Active Products",  sub: "with daily sales",        color: "text-gray-900",    bg: "bg-white border-gray-200" },
          { n: critCount,   label: "Need Action Now",  sub: "critical or out of stock", color: "text-red-600",     bg: "bg-red-50 border-red-200" },
          { n: warnCount,   label: "Running Low",      sub: "below 30-day threshold",   color: "text-amber-600",   bg: "bg-amber-50 border-amber-200" },
          { n: okCount,     label: "Well Stocked",     sub: "60+ days at all DCs",      color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
        ].map(c => (
          <div key={c.label} className={`rounded-xl border px-4 py-3 ${c.bg}`}>
            <p className={`text-3xl font-bold ${c.color}`} style={{ fontFamily: "DM Mono, monospace" }}>{c.n}</p>
            <p className="text-xs font-semibold text-gray-700 mt-0.5">{c.label}</p>
            <p className="text-[11px] text-gray-400">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Heatmap */}
      <Heatmap allItems={allItems} onSelect={onSelect} />

      {/* Top sellers velocity */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className="text-sm font-bold text-gray-900">Fastest-Selling Products</h3>
          <p className="text-xs text-gray-400 mt-0.5">Average daily units · bar color = stock risk level · click to inspect</p>
        </div>
        <div className="p-4 space-y-2.5">
          {topSellers.map(item => {
            const pct = (item.demand / maxDemand) * 100;
            const barColor = item.worstRank <= 1 ? "#EF4444" : item.worstRank === 2 ? "#FBBF24" : "#14B8A6";
            return (
              <button key={item.sku} onClick={() => onSelect(item.sku)} className="w-full group text-left">
                <div className="flex items-center gap-3">
                  <p className="text-xs font-semibold text-gray-700 w-44 flex-shrink-0 truncate group-hover:text-teal-700 leading-tight">
                    {item.name}
                  </p>
                  <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                    <div className="h-full rounded transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                  </div>
                  <span className="text-xs font-bold text-gray-600 w-20 text-right flex-shrink-0"
                    style={{ fontFamily: "DM Mono, monospace" }}>
                    {item.demand.toFixed(0)}/day
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex gap-4 text-[11px] text-gray-500">
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#EF4444" }} />Stock risk</div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#FBBF24" }} />Running low</div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#14B8A6" }} />Well stocked</div>
        </div>
      </div>
    </div>
  );
}

// ─── Stock vs Incoming bar chart ──────────────────────────────────────────────
function StockChart({ item }: { item: ProcessedItem }) {
  const dcs = [
    { label: "SF · Hub", data: item.sf, status: item.sfStatus, tag: "Redistribution hub" },
    { label: "NJ · Primary", data: item.nj, status: item.njStatus, tag: "54% of revenue" },
    { label: "LA", data: item.la, status: item.laStatus, tag: "" },
  ];

  const maxVal = Math.max(...dcs.flatMap(d => [d.data.stock_on_hand, d.data.incoming_stock]), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-gray-900">Current Stock vs. Incoming</h4>
          <p className="text-xs text-gray-400 mt-0.5">See at a glance whether each warehouse has enough or is waiting on shipments</p>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-gray-500">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#6B7280" }} />On Hand
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#5EEAD4", opacity: 0.7 }} />Incoming
          </div>
        </div>
      </div>
      <div className="p-5 space-y-5">
        {dcs.map(({ label, data, status, tag }) => {
          const stockPct = (data.stock_on_hand / maxVal) * 100;
          const incomingPct = (data.incoming_stock / maxVal) * 100;
          const stockColor = STATUS_CFG[status].barBg;
          const isEmpty = data.stock_on_hand === 0;

          return (
            <div key={label}>
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <span className="text-xs font-bold text-gray-700">{label}</span>
                  {tag && <span className="text-[11px] text-gray-400 ml-1.5">{tag}</span>}
                </div>
                <StatusBadge status={status} />
              </div>

              {/* On-hand bar */}
              <div className="mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400 w-16 text-right flex-shrink-0">On Hand</span>
                  <div className="flex-1 h-7 bg-gray-100 rounded overflow-hidden relative">
                    {isEmpty ? (
                      <div className="h-full flex items-center pl-3">
                        <span className="text-xs font-bold text-red-500">EMPTY</span>
                      </div>
                    ) : (
                      <div className="h-full rounded flex items-center pl-2 transition-all"
                        style={{ width: `${Math.max(stockPct, 2)}%`, backgroundColor: stockColor }}>
                        {stockPct > 12 && (
                          <span className="text-[11px] font-semibold text-white whitespace-nowrap"
                            style={{ fontFamily: "DM Mono, monospace" }}>
                            {data.stock_on_hand.toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}
                    {!isEmpty && stockPct <= 12 && (
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-gray-700 ml-1"
                        style={{ fontFamily: "DM Mono, monospace", left: `${Math.max(stockPct, 2) + 1}%` }}>
                        {data.stock_on_hand.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Incoming bar */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400 w-16 text-right flex-shrink-0">Incoming</span>
                  <div className="flex-1 h-7 bg-gray-100 rounded overflow-hidden relative">
                    {data.incoming_stock === 0 ? (
                      <div className="h-full flex items-center pl-3">
                        <span className="text-[11px] text-gray-400">None arriving</span>
                      </div>
                    ) : (
                      <div className="h-full rounded flex items-center pl-2 transition-all"
                        style={{ width: `${Math.max(incomingPct, 2)}%`, backgroundColor: "#5EEAD4", opacity: 0.85 }}>
                        {incomingPct > 12 && (
                          <span className="text-[11px] font-semibold text-teal-900 whitespace-nowrap"
                            style={{ fontFamily: "DM Mono, monospace" }}>
                            +{data.incoming_stock.toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}
                    {data.incoming_stock > 0 && incomingPct <= 12 && (
                      <span className="absolute top-1/2 -translate-y-1/2 text-[11px] font-semibold text-teal-800"
                        style={{ fontFamily: "DM Mono, monospace", left: `${Math.max(incomingPct, 2) + 1}%` }}>
                        +{data.incoming_stock.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Days of Supply chart ─────────────────────────────────────────────────────
function DosChart({ item }: { item: ProcessedItem }) {
  const dcs = [
    { label: "SF · Hub", days: item.sf.days_of_supply, status: item.sfStatus },
    { label: "NJ · Primary", days: item.nj.days_of_supply, status: item.njStatus },
    { label: "LA", days: item.la.days_of_supply, status: item.laStatus },
  ];

  const maxDisplay = 90;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100">
        <h4 className="text-sm font-bold text-gray-900">Days of Stock Remaining</h4>
        <p className="text-xs text-gray-400 mt-0.5">
          Dashed line = 30-day safety threshold · bars capped at 90d for scale
        </p>
      </div>
      <div className="p-5 space-y-4">
        {dcs.map(({ label, days, status }) => {
          const cappedDays = Math.min(days === 9999 ? 0 : days, maxDisplay);
          const pct = (cappedDays / maxDisplay) * 100;
          const color = STATUS_CFG[status].barBg;
          const isInactive = status === "inactive";
          const displayDays = days === 0 ? "0 days" : days >= 9999 ? "No demand" : days > 365 ? "365+ days" : `${days} day${days === 1 ? "" : "s"}`;

          return (
            <div key={label}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-700">{label}</span>
                <span className="text-xs font-bold"
                  style={{
                    fontFamily: "DM Mono, monospace",
                    color: status === "stockout" || status === "critical" ? "#EF4444" : "#111827"
                  }}>
                  {displayDays}
                </span>
              </div>
              <div className="h-8 bg-gray-100 rounded overflow-hidden relative">
                {/* 30d safety marker */}
                <div className="absolute top-0 bottom-0 w-0.5 bg-gray-500 z-10 opacity-40"
                  style={{ left: `${(30 / maxDisplay) * 100}%` }} />
                <div className="absolute top-1 bottom-1 flex items-end"
                  style={{ left: `${(30 / maxDisplay) * 100}%` }}>
                  <span className="text-[9px] text-gray-400 ml-1 leading-none">30d</span>
                </div>

                {isInactive ? (
                  <div className="h-full flex items-center pl-3">
                    <span className="text-[11px] text-gray-400">No demand recorded</span>
                  </div>
                ) : (
                  <div className="h-full rounded flex items-center px-2 transition-all"
                    style={{ width: `${Math.max(pct, days === 0 ? 0 : 1.5)}%`, backgroundColor: color }}>
                    {pct > 20 && (
                      <span className="text-[11px] font-bold text-white whitespace-nowrap"
                        style={{ fontFamily: "DM Mono, monospace" }}>
                        {cappedDays === maxDisplay && days > maxDisplay ? `${days}d` : `${cappedDays}d`}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div className="flex justify-between text-[10px] text-gray-300 mt-1 px-0.5">
          <span>0</span>
          <span className="text-gray-400">▲ 30d threshold</span>
          <span>90+</span>
        </div>
      </div>
    </div>
  );
}

// ─── Item Detail Panel ────────────────────────────────────────────────────────
function ItemDetail({ item, avgPenalty, laneCosts }: { item: ProcessedItem; avgPenalty: number; laneCosts: Record<string, number> }) {
  const recs = getRecommendations(item, laneCosts);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 leading-tight">{item.name}</h2>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-gray-400 bg-gray-100 rounded px-2 py-0.5"
              style={{ fontFamily: "DM Mono, monospace" }}>{item.sku}</span>
            <StatusBadge status={item.worstStatus} />
          </div>
        </div>
        {item.demand > 0 && (
          <div className="text-right flex-shrink-0 ml-4">
            <p className="text-[11px] text-gray-400 uppercase tracking-widest font-semibold">Daily Sales</p>
            <p className="text-2xl font-bold text-gray-900" style={{ fontFamily: "DM Mono, monospace" }}>
              {item.demand.toFixed(0)}
            </p>
            <p className="text-[11px] text-gray-400">units/day (~{Math.round(item.demand * 30).toLocaleString()}/mo)</p>
          </div>
        )}
      </div>

      {/* Recommendation */}
      {recs.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">Recommended Action</p>
          {recs.map(r => (
            <div key={r.route} className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">{r.text}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Freight: <span className="font-semibold text-gray-800" style={{ fontFamily: "DM Mono, monospace" }}>${r.cost.toLocaleString()}</span>
                  {" · "}Avg chargeback if ignored: <span className="font-semibold text-red-600" style={{ fontFamily: "DM Mono, monospace" }}>${avgPenalty.toFixed(0)}</span>
                </p>
              </div>
              <span className="text-xs font-bold text-amber-700 bg-amber-100 border border-amber-200 rounded-lg px-3 py-1.5 flex-shrink-0"
                style={{ fontFamily: "DM Mono, monospace" }}>
                {r.route}
              </span>
            </div>
          ))}
        </div>
      )}

      {item.demand === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500">No recorded daily sales. Stock is held but this item isn't currently moving.</p>
        </div>
      )}

      {/* Visual charts */}
      <div className="grid grid-cols-2 gap-4">
        <StockChart item={item} />
        <DosChart item={item} />
      </div>

      {/* Footer note */}
      <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
        <p className="text-[11px] text-gray-400 leading-relaxed">
          SF is the redistribution hub — transfers to NJ cost ~$0.51/unit · to LA ~$0.17/unit.
          The <span className="text-amber-500 font-semibold">30-day mark</span> is the minimum safe threshold before chargeback risk begins.
        </p>
      </div>
    </div>
  );
}

// ─── Left Nav ─────────────────────────────────────────────────────────────────
function ItemNav({ allItems, selected, onSelect }: { allItems: ProcessedItem[]; selected: string | null; onSelect: (sku: string | null) => void }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<NavFilter>("all");

  const filtered = useMemo(() => {
    let items = allItems;
    if (filter === "action") items = items.filter(i => i.worstRank <= 2);
    else if (filter === "ok") items = items.filter(i => i.worstRank >= 3 && i.demand > 0);
    else if (filter === "inactive") items = items.filter(i => i.demand === 0);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q));
    }
    return items;
  }, [allItems, search, filter]);

  const filterBtns: { key: NavFilter; label: string; count: number }[] = [
    { key: "all",      label: "All",    count: allItems.length },
    { key: "action",   label: "Urgent", count: allItems.filter(i => i.worstRank <= 2).length },
    { key: "ok",       label: "OK",     count: allItems.filter(i => i.worstRank >= 3 && i.demand > 0).length },
    { key: "inactive", label: "Idle",   count: allItems.filter(i => i.demand === 0).length },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…"
            className="w-full pl-8 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400 focus:bg-white" />
        </div>
      </div>

      <div className="px-3 pt-2.5 pb-2 border-b border-gray-200 flex flex-wrap gap-1">
        {filterBtns.map(btn => (
          <button key={btn.key} onClick={() => setFilter(btn.key)}
            className={`flex items-center gap-1 text-[11px] font-semibold rounded-md px-2 py-1 ${filter === btn.key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
            {btn.label}
            <span className={`text-[10px] ${filter === btn.key ? "text-gray-300" : "text-gray-400"}`}
              style={{ fontFamily: "DM Mono, monospace" }}>{btn.count}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <button onClick={() => onSelect(null)}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left border-b border-gray-100 ${selected === null ? "bg-teal-50 border-l-2 border-l-teal-500" : "hover:bg-gray-50"}`}>
          <svg className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          <span className={`text-xs font-semibold ${selected === null ? "text-teal-700" : "text-gray-600"}`}>Overview</span>
        </button>

        {filtered.length === 0 && <p className="px-3 py-6 text-xs text-gray-400 text-center">No products match.</p>}

        {filtered.map(item => {
          const isSelected = selected === item.sku;
          const s = STATUS_CFG[item.worstStatus];
          return (
            <button key={item.sku} onClick={() => onSelect(item.sku)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left border-b border-gray-100 ${isSelected ? "bg-teal-50 border-l-2 border-l-teal-500" : "hover:bg-gray-50"}`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold leading-tight truncate ${isSelected ? "text-teal-700" : "text-gray-800"}`}>{item.name}</p>
                <p className="text-[10px] text-gray-400" style={{ fontFamily: "DM Mono, monospace" }}>{item.sku}</p>
              </div>
              <div className="flex gap-0.5 flex-shrink-0">
                {[item.sfStatus, item.njStatus, item.laStatus].map((st, i) => (
                  <span key={i} className={`w-1.5 h-5 rounded-sm ${STATUS_CFG[st].dot}`} title={STATUS_CFG[st].shortLabel} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export function InventoryCharts() {
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [inventory, setInventory] = useState<LiveInventory | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/inventory")
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setInventory)
      .catch(() => setLoadError("Could not load inventory. Is the backend running?"));
  }, []);

  const allItems = useMemo(() => inventory ? processInventory(inventory) : [], [inventory]);
  const selectedItem = selectedSku ? allItems.find(i => i.sku === selectedSku) ?? null : null;
  const avgPenalty = inventory?.METADATA.avg_penalty_cost ?? 680;
  const laneCosts = inventory?.METADATA.transfer_cost_by_lane ?? {};

  if (loadError) {
    return (
      <div className="bg-red-50 rounded-xl border border-red-200 px-6 py-8 text-center text-sm text-red-700">
        {loadError}
      </div>
    );
  }

  if (!inventory) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 px-6 py-8 text-center text-sm text-gray-400">
        Loading inventory…
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm flex" style={{ height: 720 }}>
      <div className="w-64 flex-shrink-0 border-r border-gray-200 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Product Navigator</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{allItems.length} products · 3 warehouses</p>
        </div>
        <ItemNav allItems={allItems} selected={selectedSku} onSelect={setSelectedSku} />
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {selectedItem
          ? <ItemDetail item={selectedItem} avgPenalty={avgPenalty} laneCosts={laneCosts} />
          : <Overview allItems={allItems} onSelect={setSelectedSku} />
        }
      </div>
    </div>
  );
}
