import { useState } from "react";
import { inventoryData, type SkuRow, type DcSlot } from "../data/mockData";

const statusConfig = {
  critical: {
    badge: "bg-[oklch(0.55_0.22_25)] text-white",
    label: "CRITICAL",
    row: "bg-[oklch(0.99_0.01_25)]",
  },
  warning: {
    badge: "bg-[oklch(0.72_0.17_65)] text-white",
    label: "WARNING",
    row: "bg-[oklch(0.99_0.01_65)]",
  },
  ok: {
    badge: "bg-[oklch(0.60_0.15_145)] text-white",
    label: "OK",
    row: "",
  },
};

function DosBar({ days }: { days: number }) {
  const max = 90;
  const pct = Math.min((days / max) * 100, 100);
  const color =
    days === 0
      ? "bg-[oklch(0.55_0.22_25)]"
      : days < 7
      ? "bg-[oklch(0.72_0.17_65)]"
      : days < 21
      ? "bg-[oklch(0.80_0.14_65)]"
      : "bg-[oklch(0.60_0.15_145)]";

  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span
        className={`font-mono text-xs font-medium ${
          days === 0 ? "text-[oklch(0.55_0.22_25)]" : days < 7 ? "text-[oklch(0.62_0.17_65)]" : "text-gray-700"
        }`}
      >
        {days === 0 ? "—" : `${days}d`}
      </span>
    </div>
  );
}

function DcCell({ slot }: { slot: DcSlot }) {
  const isEmpty = slot.onHand === 0;
  const isFullyAllocated = slot.available === 0 && slot.onHand > 0;

  return (
    <div className="text-right">
      <div
        className={`font-mono text-sm font-medium ${
          isEmpty
            ? "text-[oklch(0.55_0.22_25)]"
            : isFullyAllocated
            ? "text-[oklch(0.72_0.17_65)]"
            : "text-gray-900"
        }`}
      >
        {isEmpty ? "0" : slot.onHand.toLocaleString()}
      </div>
      {!isEmpty && (
        <div className="text-[10px] text-gray-400 font-mono">
          {slot.available} avail
        </div>
      )}
      <DosBar days={slot.daysSupply} />
    </div>
  );
}

interface TransferModalProps {
  row: SkuRow;
  onClose: () => void;
}

function TransferModal({ row, onClose }: TransferModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">{row.product}</h3>
            <span className="font-mono text-xs text-gray-400">{row.sku}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          {(["dcWest", "dcEast", "dcCentral"] as const).map((key) => {
            const labels = { dcWest: "DC-West", dcEast: "DC-East", dcCentral: "DC-Central" };
            const slot = row[key];
            return (
              <div key={key} className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">{labels[key]}</div>
                <div className={`font-mono text-xl font-bold ${slot.onHand === 0 ? "text-[oklch(0.55_0.22_25)]" : "text-gray-900"}`}>
                  {slot.onHand.toLocaleString()}
                </div>
                <div className="text-[10px] text-gray-400">{slot.daysSupply}d supply</div>
              </div>
            );
          })}
        </div>

        <div className="bg-[oklch(0.97_0.01_240)] rounded-lg p-4 mb-4 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500">Chargeback exposure</span>
            <span className="font-mono font-semibold text-[oklch(0.55_0.22_25)]">${row.chargebackRisk.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Unit cost</span>
            <span className="font-mono">${row.unitCost.toFixed(2)}</span>
          </div>
          {row.inboundPo && (
            <div className="flex justify-between">
              <span className="text-gray-500">Inbound PO → {row.inboundPo.dc}</span>
              <span className="font-mono">{row.inboundPo.qty.toLocaleString()} units · ETA {row.inboundPo.eta}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button className="flex-1 rounded-lg bg-[oklch(0.13_0.03_240)] hover:bg-[oklch(0.20_0.04_240)] text-white text-sm font-semibold py-2.5 transition-colors">
            Initiate Transfer
          </button>
          <button className="flex-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium py-2.5 transition-colors">
            Wait for Inbound
          </button>
          <button onClick={onClose} className="px-4 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 text-sm py-2.5 transition-colors">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

type SortKey = "status" | "totalDaysSupply" | "chargebackRisk";

export function InventoryTable() {
  const [selected, setSelected] = useState<SkuRow | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "critical" | "warning" | "ok">("all");
  const [sortBy, setSortBy] = useState<SortKey>("status");

  const statusOrder = { critical: 0, warning: 1, ok: 2 };

  const rows = inventoryData
    .filter((r) => filterStatus === "all" || r.status === filterStatus)
    .sort((a, b) => {
      if (sortBy === "status") return statusOrder[a.status] - statusOrder[b.status];
      if (sortBy === "chargebackRisk") return b.chargebackRisk - a.chargebackRisk;
      return a.totalDaysSupply - b.totalDaysSupply;
    });

  const critCount = inventoryData.filter((r) => r.status === "critical").length;
  const warnCount = inventoryData.filter((r) => r.status === "warning").length;

  return (
    <>
      {/* Filter + Sort bar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1">
          {(["all", "critical", "warning", "ok"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all capitalize ${
                filterStatus === f
                  ? "bg-[oklch(0.13_0.03_240)] text-white"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {f === "all" ? `All (${inventoryData.length})` : f === "critical" ? `Critical (${critCount})` : f === "warning" ? `Warning (${warnCount})` : "OK"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Sort by:</span>
          {(["status", "chargebackRisk", "totalDaysSupply"] as SortKey[]).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-2.5 py-1 rounded border text-xs transition-all ${
                sortBy === s ? "border-gray-800 text-gray-900 font-semibold" : "border-gray-200 hover:border-gray-400"
              }`}
            >
              {s === "chargebackRisk" ? "Chargeback $" : s === "totalDaysSupply" ? "Days Supply" : "Risk Level"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">SKU / Product</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">DC-West (CA)</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">DC-East (NJ)</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">DC-Central (TX)</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">Total DoS</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">CB Risk</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center">Status</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Inbound PO</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => {
              const cfg = statusConfig[row.status];
              return (
                <tr key={row.sku} className={`hover:bg-gray-50 transition-colors ${cfg.row}`}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900 leading-tight">{row.product}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-[10px] text-gray-400">{row.sku}</span>
                      <span className="text-[10px] text-gray-400">· {row.category}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><DcCell slot={row.dcWest} /></td>
                  <td className="px-4 py-3"><DcCell slot={row.dcEast} /></td>
                  <td className="px-4 py-3"><DcCell slot={row.dcCentral} /></td>
                  <td className="px-4 py-3 text-right">
                    <DosBar days={row.totalDaysSupply} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.chargebackRisk > 0 ? (
                      <span className="font-mono text-sm font-semibold text-[oklch(0.55_0.22_25)]">
                        ${row.chargebackRisk.toLocaleString()}
                      </span>
                    ) : (
                      <span className="font-mono text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold tracking-widest ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {row.inboundPo ? (
                      <div>
                        <div className="text-[10px] font-semibold text-gray-600">{row.inboundPo.dc}</div>
                        <div className="font-mono text-[10px] text-gray-400">{row.inboundPo.qty.toLocaleString()} units</div>
                        <div className="font-mono text-[10px] text-gray-400">ETA {row.inboundPo.eta}</div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-300">None on file</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {row.status !== "ok" && (
                        <button
                          onClick={() => setSelected(row)}
                          className="rounded-md bg-[oklch(0.13_0.03_240)] hover:bg-[oklch(0.22_0.04_240)] text-white text-xs font-semibold px-3 py-1.5 transition-colors whitespace-nowrap"
                        >
                          Transfer →
                        </button>
                      )}
                      <button
                        onClick={() => setSelected(row)}
                        className="rounded-md border border-gray-200 hover:border-gray-400 text-gray-600 text-xs font-medium px-2.5 py-1.5 transition-colors whitespace-nowrap"
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

      {/* Footer note */}
      <p className="text-xs text-gray-400 mt-3">
        DoS = Days of Supply. Avail = on-hand minus allocated. CB Risk = estimated chargeback exposure if imbalance is not corrected.
      </p>

      {selected && <TransferModal row={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
