import { useState } from "react";
import { inventoryData, type SkuRow, type DcSlot } from "../data/mockData";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS = {
  critical: { label: "Critical", dot: "bg-red-500", text: "text-red-700", pill: "bg-red-50 text-red-700 border border-red-200" },
  warning:  { label: "Warning",  dot: "bg-amber-400", text: "text-amber-700", pill: "bg-amber-50 text-amber-700 border border-amber-200" },
  ok:       { label: "OK",       dot: "bg-emerald-500", text: "text-emerald-700", pill: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
};

function dosColor(days: number) {
  if (days === 0) return { text: "text-red-600", bg: "bg-red-500" };
  if (days < 14)  return { text: "text-red-500",   bg: "bg-red-400" };
  if (days < 30)  return { text: "text-amber-600", bg: "bg-amber-400" };
  if (days < 60)  return { text: "text-amber-500", bg: "bg-amber-300" };
  return            { text: "text-emerald-600", bg: "bg-emerald-400" };
}

function DcCell({ slot, isHub }: { slot: DcSlot; isHub?: boolean }) {
  const col = dosColor(slot.daysSupply);
  const pct = Math.min((slot.daysSupply / 300) * 100, 100);
  const isEmpty = slot.available === 0;

  return (
    <div className="text-right min-w-[100px]">
      {isHub && <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600 mb-0.5">Hub</p>}
      <p className={`mono text-base font-bold leading-none ${isEmpty ? "text-red-500" : "text-gray-900"}`}>
        {isEmpty ? "—" : slot.available.toLocaleString()}
      </p>
      <p className="text-[11px] text-gray-400 mt-0.5 mono">{slot.velocityPerDay}/day</p>
      <div className="flex items-center justify-end gap-1.5 mt-1.5">
        <div className="w-12 h-1 rounded-full bg-gray-100 overflow-hidden">
          <div className={`h-full rounded-full ${col.bg}`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`mono text-[11px] font-semibold ${col.text}`}>
          {slot.daysSupply === 0 ? "0d" : `${slot.daysSupply}d`}
        </span>
      </div>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({ row, onClose }: { row: SkuRow; onClose: () => void }) {
  const DC_KEYS = [
    { key: "dcSF" as const, label: "DC-SF · Livermore", role: "Hub", accent: "teal" },
    { key: "dcNJ" as const, label: "DC-NJ · New Jersey", role: "Primary", accent: "red" },
    { key: "dcLA" as const, label: "DC-LA · Los Angeles", role: "", accent: "slate" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>

        {/* Modal header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2.5">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 ${STATUS[row.status].pill}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS[row.status].dot}`} />
                {STATUS[row.status].label}
              </span>
              <span className="mono text-xs text-gray-400 bg-gray-100 rounded px-2 py-0.5">{row.sku}</span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mt-1.5">{row.product}</h3>
            <p className="text-sm text-gray-400">{row.category} · ${row.unitCost.toFixed(2)}/unit</p>
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
                    <div className={`h-full rounded-full ${col.bg}`} style={{ width: `${Math.min(slot.daysSupply / 300 * 100, 100)}%` }} />
                  </div>
                  <span className={`mono text-xs font-bold ${col.text}`}>{slot.daysSupply}d</span>
                </div>
                <p className="mono text-xs text-gray-400 mt-1">{slot.velocityPerDay} units/day</p>
              </div>
            );
          })}
        </div>

        {/* Company totals + note */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex gap-8 text-sm mb-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Company Available</p>
              <p className="mono text-xl font-bold text-gray-900">{row.companyAvailable.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Company Days Supply</p>
              <p className="mono text-xl font-bold text-gray-900">{row.companyDaysSupply}d</p>
            </div>
            {row.chargebackRisk > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">CB Exposure</p>
                <p className="mono text-xl font-bold text-red-600">${row.chargebackRisk.toLocaleString()}</p>
              </div>
            )}
          </div>
          {row.note && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 leading-relaxed">
              {row.note}
            </div>
          )}
        </div>

        {/* Inbound PO */}
        {row.inboundPo && (
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
            <p className="text-xs text-gray-500">
              <span className="font-semibold">Inbound PO →</span> {row.inboundPo.dc} ·{" "}
              <span className="mono">{row.inboundPo.qty.toLocaleString()} units</span> · ETA {row.inboundPo.eta}
              <span className="text-amber-600 ml-2">· 81.5% of POs arrive late by avg 28d</span>
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="px-6 py-4 flex gap-2">
          {row.status !== "ok" && (
            <button className="text-sm font-semibold text-white rounded-lg px-5 py-2.5" style={{ backgroundColor: "#0E1B2E" }}>
              Initiate Transfer
            </button>
          )}
          {row.inboundPo && (
            <button className="text-sm font-medium text-gray-700 border border-gray-200 rounded-lg px-5 py-2.5 hover:bg-gray-50">
              Track Inbound PO
            </button>
          )}
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
type FilterStatus = "all" | "critical" | "warning" | "ok";

export function InventoryTable() {
  const [selected, setSelected] = useState<SkuRow | null>(null);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [sort, setSort] = useState<SortKey>("status");
  const statusOrder = { critical: 0, warning: 1, ok: 2 };

  const counts = {
    all: inventoryData.length,
    critical: inventoryData.filter((r) => r.status === "critical").length,
    warning: inventoryData.filter((r) => r.status === "warning").length,
    ok: inventoryData.filter((r) => r.status === "ok").length,
  };

  const rows = inventoryData
    .filter((r) => filter === "all" || r.status === filter)
    .sort((a, b) => {
      if (sort === "status")           return statusOrder[a.status] - statusOrder[b.status];
      if (sort === "chargebackRisk")   return b.chargebackRisk - a.chargebackRisk;
      return a.companyDaysSupply - b.companyDaysSupply;
    });

  return (
    <>
      {/* Reconstruction note */}
      <div className="flex items-start gap-3 bg-white border border-gray-200 rounded-xl px-5 py-3.5 text-sm shadow-sm">
        <span className="font-bold text-teal-600 flex-shrink-0">NOTE</span>
        <p className="text-gray-500">
          Source data has <strong className="text-gray-700">company-wide totals only</strong> — no per-DC snapshot exists.
          Per-DC values are <strong className="text-gray-700">estimated</strong> via reconstruction: PO receipts per DC − sales per DC ± transfer history.
          Company-wide available units are real.
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Filter pills */}
        <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl p-1.5 shadow-sm">
          {(["all", "critical", "warning", "ok"] as FilterStatus[]).map((f) => {
            const active = filter === f;
            const dot = f === "critical" ? "bg-red-500" : f === "warning" ? "bg-amber-400" : f === "ok" ? "bg-emerald-500" : "";
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${
                  active ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                }`}
              >
                {f !== "all" && <span className={`w-1.5 h-1.5 rounded-full ${active ? "opacity-80" : ""} ${dot}`} />}
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                <span className={`mono text-[11px] ${active ? "opacity-70" : "text-gray-400"}`}>({counts[f]})</span>
              </button>
            );
          })}
        </div>

        {/* Sort */}
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

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200" style={{ backgroundColor: "#F9FAFB" }}>
                <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-widest text-gray-400">Product</th>
                <th className="px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  DC-SF <span className="font-normal text-teal-500">(Hub)</span>
                </th>
                <th className="px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-widest text-gray-400">DC-NJ</th>
                <th className="px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-widest text-gray-400">DC-LA</th>
                <th className="px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-widest text-gray-400">Company</th>
                <th className="px-5 py-3.5 text-center text-[11px] font-bold uppercase tracking-widest text-gray-400">Status</th>
                <th className="px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-widest text-gray-400">CB Risk</th>
                <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-widest text-gray-400">Inbound PO</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const s = STATUS[row.status];
                return (
                  <tr
                    key={row.sku}
                    className={`border-b border-gray-100 hover:bg-blue-50/30 cursor-pointer transition-colors ${i % 2 === 1 ? "bg-gray-50/40" : ""}`}
                    onClick={() => setSelected(row)}
                  >
                    {/* Product */}
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900 text-sm leading-tight">{row.product}</p>
                      <p className="mono text-[11px] text-gray-400 mt-0.5">{row.sku} · {row.category}</p>
                      {row.note && (
                        <p className="text-[11px] text-amber-600 mt-1 max-w-[200px] leading-tight line-clamp-1">
                          ⚠ {row.note.slice(0, 55)}…
                        </p>
                      )}
                    </td>

                    {/* DC cells */}
                    <td className="px-5 py-4"><DcCell slot={row.dcSF} isHub /></td>
                    <td className="px-5 py-4"><DcCell slot={row.dcNJ} /></td>
                    <td className="px-5 py-4"><DcCell slot={row.dcLA} /></td>

                    {/* Company DoS */}
                    <td className="px-5 py-4 text-right">
                      <p className="mono text-base font-bold text-gray-900">{row.companyDaysSupply}d</p>
                      <p className="mono text-[11px] text-gray-400">{row.companyAvailable.toLocaleString()} avail</p>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 rounded-full text-xs font-semibold px-2.5 py-1 ${s.pill}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
                    </td>

                    {/* CB Risk */}
                    <td className="px-5 py-4 text-right">
                      {row.chargebackRisk > 0 ? (
                        <span className="mono text-sm font-bold text-red-600">${row.chargebackRisk.toLocaleString()}</span>
                      ) : (
                        <span className="mono text-sm text-gray-300">—</span>
                      )}
                    </td>

                    {/* Inbound PO */}
                    <td className="px-5 py-4">
                      {row.inboundPo ? (
                        <div>
                          <p className="text-xs font-semibold text-gray-700">{row.inboundPo.dc}</p>
                          <p className="mono text-[11px] text-gray-400">{row.inboundPo.qty.toLocaleString()} · {row.inboundPo.eta}</p>
                          <p className="text-[10px] text-amber-500 mt-0.5">Late risk: 81.5%</p>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">None on file</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {row.status !== "ok" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelected(row); }}
                            className="text-xs font-semibold text-white rounded-lg px-3 py-1.5 whitespace-nowrap"
                            style={{ backgroundColor: "#0E1B2E" }}
                          >
                            Transfer
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelected(row); }}
                          className="text-xs font-medium text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 whitespace-nowrap"
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

        {/* Table footer note */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
          <p className="text-[11px] text-gray-400">
            Available = on-hand minus allocated · DoS = Days of Supply (est.) · Freight: SF→NJ $0.51/unit · SF→LA $0.17/unit · Reverse to SF $1.55/unit (avoid)
          </p>
        </div>
      </div>

      {selected && <DetailModal row={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
