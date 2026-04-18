import { useState, useEffect } from "react";
import { api, type Recommendation } from "../api/client";
import type { DcSlot } from "../data/mockData";
import { useLanguage } from "../i18n/LanguageContext";

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

function liveStatus(sfDos: number, njDos: number, laDos: number, demand: number): "critical" | "warning" | "ok" | "inactive" {
  if (demand === 0) return "inactive";
  const worst = Math.min(sfDos, njDos, laDos);
  if (worst < 14) return "critical";
  if (worst < 30) return "warning";
  return "ok";
}

type RawInventory = {
  METADATA: { avg_penalty_cost: number; transfer_cost_by_lane?: Record<string, number> };
  ITEMS: Record<string, { item_name: string; avg_daily_demand: number; inventory_by_dc: Record<string, LiveDc> }>;
};

function buildInventoryRows(raw: RawInventory) {
  const avgPenaltyCost = raw.METADATA?.avg_penalty_cost ?? 680;
  const penaltyRatePerUnitDay = avgPenaltyCost / 160;

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
      const cbRisk = status === "critical" ? Math.round(demand * missingDays * penaltyRatePerUnitDay) : 0;

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
        demand,
        note: status === "inactive" ? "Dead stock. No recent demand across all regions." : (worstDos < 5 && status === "critical" ? `Lowest DC at ${worstDos}d · ${demand.toFixed(0)} units/day burn rate` : undefined),
      };
    })
    .filter((row) => row.status !== "ok")
    .sort((a, b) => {
      const order = { critical: 0, warning: 1, inactive: 2, ok: 3 };
      return order[a.status] - order[b.status];
    });
}

type RowType = ReturnType<typeof buildInventoryRows>[0];

// ─── DC constants ─────────────────────────────────────────────────────────────
const DC_SITES = [
  { key: "dcSF" as const, site: "Site 1 - SF", label: "DC-SF · Livermore", role: "Hub" },
  { key: "dcNJ" as const, site: "Site 2 - NJ", label: "DC-NJ · New Jersey", role: "Primary" },
  { key: "dcLA" as const, site: "Site 3 - LA", label: "DC-LA · Los Angeles", role: "" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_STYLE = {
  critical: { dot: "bg-[#7A0F1D]", text: "text-[#7A0F1D]", pill: "bg-[#FBEEEF] text-[#7A0F1D] border border-[#F4D5D8]" },
  warning:  { dot: "bg-[#B97A15]", text: "text-[#8C5A0F]", pill: "bg-[#FEF7E8] text-[#8C5A0F] border border-[#E5B664]" },
  ok:       { dot: "bg-[#1E8574]", text: "text-[#125F54]", pill: "bg-[#EEF7F5] text-[#125F54] border border-[#7AC4B8]" },
  inactive: { dot: "bg-[#8E8680]", text: "text-[#403A34]", pill: "bg-[#FAF7F1] text-[#403A34] border border-[#D6CFC7]" },
};

function dosColor(days: number) {
  if (days === 9999) return { text: "text-[#8E8680]", bg: "bg-[#B8B1AA]" };
  if (days === 0)    return { text: "text-[#7A0F1D]", bg: "bg-[#7A0F1D]" };
  if (days < 14)     return { text: "text-[#7A0F1D]", bg: "bg-[#A6192E]" };
  if (days < 30)     return { text: "text-[#8C5A0F]", bg: "bg-[#B97A15]" };
  if (days < 60)     return { text: "text-[#8C5A0F]", bg: "bg-[#E5B664]" };
  return               { text: "text-[#125F54]", bg: "bg-[#1E8574]" };
}

function DcCell({ slot }: { slot: DcSlot }) {
  const { t } = useLanguage();
  const col = dosColor(slot.daysSupply);
  const isNoDemand = slot.daysSupply === 9999;
  const pct = isNoDemand ? 0 : Math.min((slot.daysSupply / 300) * 100, 100);
  const isEmpty = slot.available === 0;

  return (
    <div className="text-right min-w-[90px]">
      <p className="mono text-base font-bold leading-none" style={{ color: isEmpty ? "#7A0F1D" : "#14110F" }}>
        {isEmpty ? "—" : slot.available.toLocaleString()}
      </p>
      <p className="text-[11px] mt-0.5 mono" style={{ color: "#8E8680" }}>{isNoDemand ? "—" : `${slot.velocityPerDay}/day`}</p>
      <div className="flex items-center justify-end gap-1.5 mt-1.5">
        <div className="w-12 h-1 rounded-full overflow-hidden" style={{ backgroundColor: "#E8E2DA" }}>
          <div className={`h-full rounded-full ${col.bg}`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`mono text-[11px] font-semibold ${col.text} whitespace-nowrap`}>
          {isNoDemand ? t.table.noDemand : slot.daysSupply === 0 ? "0d" : `${slot.daysSupply}d`}
        </span>
      </div>
    </div>
  );
}

// ─── Transfer Modal ───────────────────────────────────────────────────────────
function TransferModal({ row, rec, onClose, onSuccess }: {
  row: RowType;
  rec: Recommendation | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useLanguage();
  const dcOptions = DC_SITES.map((d) => ({
    ...d,
    dos: row[d.key].daysSupply,
    stock: row[d.key].available,
  }));

  const autoSource = dcOptions.reduce((best, dc) => dc.dos > best.dos ? dc : best).site;
  const autoDest   = dcOptions.reduce((worst, dc) => dc.dos < worst.dos ? dc : worst).site;

  const [sourceDc, setSourceDc] = useState(rec?.source_dc ?? autoSource);
  const [destDc,   setDestDc]   = useState(rec?.destination_dc ?? autoDest);

  const destDcData = dcOptions.find(d => d.site === destDc);
  const demand = row.demand;
  const defaultUnits = rec
    ? Math.round(rec.transfer_units)
    : Math.max(0, Math.round(Math.max(0, 14 - (destDcData?.dos ?? 0)) * demand));

  const [units, setUnits] = useState(String(defaultUnits));
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unitCount = parseInt(units, 10) || 0;
  const sourceStock = dcOptions.find(d => d.site === sourceDc)?.stock ?? 0;
  const sourceValid = unitCount > 0 && unitCount <= sourceStock && sourceDc !== destDc;

  async function handleSubmit() {
    if (!sourceValid) {
      setError(sourceDc === destDc ? t.transferModal.sameDcError : t.transferModal.overCapError(sourceStock));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.approveTransfer({
        sku: row.sku.trim(),
        item_name: row.product,
        source_dc: sourceDc,
        destination_dc: destDc,
        units: unitCount,
      });
      setDone(true);
      setTimeout(onSuccess, 1400);
    } catch (e: any) {
      setError(e?.message ?? t.transferModal.failError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden" style={{ boxShadow: "0 12px 32px -8px rgba(20,17,15,0.25)", borderTop: "3px solid #7A0F1D" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5" style={{ borderBottom: "1px solid #E8E2DA" }}>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] mb-1" style={{ color: "#7A0F1D" }}>{t.transferModal.title}</p>
            <h3 className="text-lg font-bold leading-tight" style={{ color: "#14110F", fontFamily: "Fraunces, serif", fontVariationSettings: "'opsz' 48" }}>{row.product}</h3>
            <p className="mono text-xs mt-0.5" style={{ color: "#8E8680" }}>{row.sku.trim()}</p>
          </div>
          <button onClick={onClose} className="ml-4 w-8 h-8 flex items-center justify-center rounded-lg text-xl transition-colors hover:bg-[#F2EDE5] hover:text-[#403A34]" style={{ color: "#B8B1AA" }}>×</button>
        </div>

        {done ? (
          <div className="px-6 py-10 text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "#EEF7F5" }}>
              <span className="text-2xl" style={{ color: "#125F54" }}>✓</span>
            </div>
            <p className="font-bold text-base" style={{ color: "#125F54" }}>{t.transferModal.done}</p>
            <p className="text-sm mt-1" style={{ color: "#6B6560" }}>
              {t.transferModal.sourceDest(sourceDc, destDc, unitCount)}
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-5">

            {rec && (
              <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: "#FBEEEF", border: "1px solid #F4D5D8" }}>
                <p className="font-semibold" style={{ color: "#7A0F1D" }}>{t.transferModal.systemRec}</p>
                <p className="text-xs mt-0.5" style={{ color: "#6B6560" }}>{rec.reason}</p>
              </div>
            )}

            {/* Source → Dest */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] mb-1.5" style={{ color: "#6B6560" }}>{t.transferModal.sourceDc}</p>
                <div className="space-y-1.5">
                  {dcOptions.map(dc => (
                    <button
                      key={dc.site}
                      onClick={() => {
                        setSourceDc(dc.site);
                        const newStock = dc.stock;
                        setUnits(u => String(Math.min(parseInt(u, 10) || 0, newStock)));
                      }}
                      className="w-full text-left rounded-lg px-3 py-2.5 text-sm transition-all"
                      style={{
                        border: `1px solid ${sourceDc === dc.site ? "#7A0F1D" : "#D6CFC7"}`,
                        backgroundColor: sourceDc === dc.site ? "#FBEEEF" : "#FFFFFF",
                        color: "#14110F",
                      }}
                      onMouseEnter={e => { if (sourceDc !== dc.site) e.currentTarget.style.backgroundColor = "#FAF7F1"; }}
                      onMouseLeave={e => { if (sourceDc !== dc.site) e.currentTarget.style.backgroundColor = "#FFFFFF"; }}
                    >
                      <p className="font-semibold text-xs">{dc.label}</p>
                      <p className="mono text-[11px] mt-0.5" style={{ color: dc.dos < 14 ? "#A6192E" : "#6B6560" }}>
                        {dc.stock.toLocaleString()} · {dc.dos === 9999 ? t.table.noDemand : `${dc.dos}d`}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] mb-1.5" style={{ color: "#6B6560" }}>{t.transferModal.destDc}</p>
                <div className="space-y-1.5">
                  {dcOptions.map(dc => (
                    <button
                      key={dc.site}
                      onClick={() => setDestDc(dc.site)}
                      className="w-full text-left rounded-lg px-3 py-2.5 text-sm transition-all"
                      style={{
                        border: `1px solid ${destDc === dc.site ? "#1E8574" : "#D6CFC7"}`,
                        backgroundColor: destDc === dc.site ? "#EEF7F5" : "#FFFFFF",
                        color: "#14110F",
                      }}
                      onMouseEnter={e => { if (destDc !== dc.site) e.currentTarget.style.backgroundColor = "#FAF7F1"; }}
                      onMouseLeave={e => { if (destDc !== dc.site) e.currentTarget.style.backgroundColor = "#FFFFFF"; }}
                    >
                      <p className="font-semibold text-xs">{dc.label}</p>
                      <p className="mono text-[11px] mt-0.5" style={{ color: dc.dos < 14 ? "#A6192E" : "#6B6560" }}>
                        {dc.stock.toLocaleString()} · {dc.dos === 9999 ? t.table.noDemand : `${dc.dos}d`}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Units */}
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] mb-1.5" style={{ color: "#6B6560" }}>{t.transferModal.units}</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={sourceStock}
                  value={units}
                  onChange={e => {
                    const v = parseInt(e.target.value, 10);
                    setUnits(isNaN(v) ? "" : String(Math.min(v, sourceStock)));
                  }}
                  className="flex-1 rounded-lg px-4 py-2.5 mono text-sm font-semibold outline-none transition-all"
                  style={{ border: "1px solid #D6CFC7", color: "#14110F", backgroundColor: "#FFFFFF" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#7A0F1D")}
                  onBlur={e => (e.currentTarget.style.borderColor = "#D6CFC7")}
                />
                <button
                  onClick={() => setUnits(String(sourceStock))}
                  className="px-3 py-2.5 rounded-lg text-xs font-bold transition-colors"
                  style={{ border: "1px solid #D6CFC7", color: "#403A34", backgroundColor: "#FAF7F1" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#F2EDE5")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#FAF7F1")}
                >
                  {t.transferModal.max}
                </button>
              </div>
              <p className="text-[11px] mt-1" style={{ color: "#8E8680" }}>
                {t.transferModal.available(sourceStock)}
                {demand > 0 && ` · ${t.transferModal.demand(demand)}`}
              </p>
            </div>

            {/* Cost summary (from recommendation) */}
            {rec && (
              <div className="rounded-lg p-4 space-y-2" style={{ backgroundColor: "#FAF7F1", border: "1px solid #E8E2DA" }}>
                <div className="flex justify-between text-sm">
                  <span style={{ color: "#6B6560" }}>{t.transferModal.freightCost}</span>
                  <span className="mono font-semibold" style={{ color: "#403A34" }}>${rec.transfer_cost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: "#6B6560" }}>{t.transferModal.penaltyAvoided}</span>
                  <span className="mono font-semibold" style={{ color: "#1E8574" }}>${rec.avoided_penalty.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm pt-2" style={{ borderTop: "1px solid #E8E2DA" }}>
                  <span className="font-bold" style={{ color: "#14110F" }}>{t.transferModal.netValue}</span>
                  <span className="mono font-bold" style={{ color: rec.transfer_value > 0 ? "#125F54" : "#8C5A0F" }}>
                    {rec.transfer_value > 0 ? "+" : ""}${rec.transfer_value.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm rounded-lg px-4 py-2.5" style={{ backgroundColor: "#FBEEEF", color: "#7A0F1D", border: "1px solid #F4D5D8" }}>{error}</p>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSubmit}
                disabled={submitting || unitCount <= 0}
                className="flex-1 text-sm font-bold text-white rounded-lg px-5 py-2.5 disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: "#7A0F1D" }}
                onMouseEnter={e => { if (!submitting && unitCount > 0) e.currentTarget.style.backgroundColor = "#5E0B15"; }}
                onMouseLeave={e => { if (!submitting && unitCount > 0) e.currentTarget.style.backgroundColor = "#7A0F1D"; }}
              >
                {submitting ? t.transferModal.submitting : t.transferModal.approve}
              </button>
              <button
                onClick={onClose}
                className="text-sm font-medium rounded-lg px-5 py-2.5 transition-colors"
                style={{ color: "#6B6560", border: "1px solid #D6CFC7", backgroundColor: "#FFFFFF" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#F2EDE5")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#FFFFFF")}
              >
                {t.transferModal.cancel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({ row, onClose, onTransfer }: {
  row: RowType;
  onClose: () => void;
  onTransfer: () => void;
}) {
  const { t } = useLanguage();
  const statusCfg = STATUS_STYLE[row.status as keyof typeof STATUS_STYLE];
  const statusLabel = t.status[row.status as keyof typeof t.status];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden" style={{ boxShadow: "0 12px 32px -8px rgba(20,17,15,0.2)" }} onClick={e => e.stopPropagation()}>

        {/* Modal header */}
        <div className="flex items-start justify-between px-6 py-5" style={{ borderBottom: "1px solid #E8E2DA" }}>
          <div>
            <div className="flex items-center gap-2.5">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 ${statusCfg.pill}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                {statusLabel}
              </span>
              <span className="mono text-xs rounded px-2 py-0.5" style={{ color: "#8E8680", backgroundColor: "#FAF7F1" }}>{row.sku.trim()}</span>
            </div>
            <h3 className="text-lg font-bold mt-1.5" style={{ color: "#14110F", fontFamily: "Fraunces, serif", fontVariationSettings: "'opsz' 48" }}>{row.product}</h3>
            <p className="text-sm" style={{ color: "#8E8680" }}>{row.category}</p>
          </div>
          <button onClick={onClose} className="ml-4 w-8 h-8 flex items-center justify-center rounded-lg text-xl transition-colors hover:bg-[#F2EDE5] hover:text-[#403A34]" style={{ color: "#B8B1AA" }}>×</button>
        </div>

        {/* DC cards */}
        <div className="grid grid-cols-3 gap-4 p-6" style={{ borderBottom: "1px solid #F2EDE5" }}>
          {DC_SITES.map(({ key, label, role }) => {
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
                <p className="text-xs mono" style={{ color: "#8E8680" }}>{t.detailModal.availOnHand(slot.available, slot.onHand)}</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#E8E2DA" }}>
                    <div className={`h-full rounded-full ${col.bg}`} style={{ width: `${isNoDemand ? 0 : Math.min(slot.daysSupply / 300 * 100, 100)}%` }} />
                  </div>
                  <span className={`mono text-xs font-bold ${col.text}`}>
                    {isNoDemand ? t.table.noDemand : `${slot.daysSupply}d`}
                  </span>
                </div>
                <p className="mono text-xs mt-1" style={{ color: "#8E8680" }}>{isNoDemand ? "—" : `${slot.velocityPerDay} ${t.detailModal.unitsPerDay}`}</p>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 flex gap-2">
          {(row.status === "critical" || row.status === "warning") && (
            <button
              onClick={() => { onClose(); onTransfer(); }}
              className="text-sm font-bold text-white rounded-lg px-5 py-2.5 transition-colors"
              style={{ backgroundColor: "#7A0F1D" }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#5E0B15")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#7A0F1D")}
            >
              {t.detailModal.initiateTransfer}
            </button>
          )}
          <button onClick={onClose} className="text-sm font-medium rounded-lg px-4 py-2.5 ml-auto transition-colors" style={{ color: "#6B6560", border: "1px solid #D6CFC7", backgroundColor: "#FFFFFF" }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#F2EDE5")}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#FFFFFF")}>
            {t.detailModal.close}
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
  const { t } = useLanguage();
  const [inventoryData, setInventoryData] = useState<RowType[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RowType | null>(null);
  const [transferTarget, setTransferTarget] = useState<RowType | null>(null);
  const [transferredSkus, setTransferredSkus] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [sort, setSort] = useState<SortKey>("chargebackRisk");
  const statusOrder = { critical: 0, warning: 1, inactive: 2, ok: 3 };

  function loadData() {
    api.getInventory()
      .then((raw) => setInventoryData(buildInventoryRows(raw as RawInventory)))
      .catch(() => setLoadError("Could not load inventory. Is the backend running?"));
    api.getRecommendations()
      .then(setRecommendations)
      .catch(() => {});
  }

  useEffect(() => { loadData(); }, []);

  function openTransfer(row: RowType) {
    setSelected(null);
    setTransferTarget(row);
  }

  const getRecForRow = (row: RowType) =>
    recommendations.find(r => r.sku.trim() === row.sku.trim() && r.recommendation === "TRANSFER") ?? null;

  const counts = {
    all:      inventoryData.filter(r => r.status === "critical" || r.status === "warning").length,
    critical: inventoryData.filter(r => r.status === "critical").length,
    warning:  inventoryData.filter(r => r.status === "warning").length,
    inactive: inventoryData.filter(r => r.status === "inactive").length,
  };

  const rows = inventoryData
    .filter(r => filter === "all" ? r.status !== "inactive" : r.status === filter)
    .sort((a, b) => {
      const aT = transferredSkus.has(a.sku.trim());
      const bT = transferredSkus.has(b.sku.trim());
      if (aT !== bT) return aT ? 1 : -1;
      if (sort === "status") return statusOrder[a.status as keyof typeof statusOrder] - statusOrder[b.status as keyof typeof statusOrder];
      if (sort === "chargebackRisk") return b.chargebackRisk - a.chargebackRisk;
      return a.companyDaysSupply - b.companyDaysSupply;
    });

  return (
    <>
      {loadError && (
        <div className="rounded-xl px-5 py-3.5 text-sm mb-4" style={{ backgroundColor: "#FBEEEF", border: "1px solid #F4D5D8", color: "#7A0F1D" }}>
          {loadError}
        </div>
      )}
      <div className="rounded-xl px-5 py-3.5 text-sm flex items-start gap-3" style={{ backgroundColor: "#FBEEEF", border: "1px solid #F4D5D8" }}>
        <span className="font-bold flex-shrink-0" style={{ color: "#7A0F1D" }}>{t.table.actionRequired}</span>
        <p style={{ color: "#6B6560" }}>
          <strong style={{ color: "#14110F" }}>{t.table.showingSkus(inventoryData.length)}</strong> {t.table.facingShortages}
        </p>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 mt-4 mb-4">
        <div className="flex items-center gap-1.5 rounded-xl p-1.5" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8E2DA" }}>
          {(["all", "critical", "warning", "inactive"] as FilterStatus[]).map(f => {
            const active = filter === f;
            const dotColor = f === "critical" ? "#7A0F1D" : f === "warning" ? "#B97A15" : f === "inactive" ? "#8E8680" : "";
            const label = t.table.filters[f as keyof typeof t.table.filters];
            return (
              <button key={f} onClick={() => setFilter(f)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{ backgroundColor: active ? "#14110F" : "transparent", color: active ? "#FFFFFF" : "#6B6560" }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = "#F2EDE5"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}>
                {f !== "all" && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: active ? "rgba(255,255,255,0.6)" : dotColor }} />}
                {label}
                <span className="mono text-[11px]" style={{ opacity: 0.6 }}>({counts[f]})</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-sm" style={{ color: "#8E8680" }}>
          <span>{t.table.sort}</span>
          {(["status", "chargebackRisk", "companyDaysSupply"] as SortKey[]).map((key) => (
            <button key={key} onClick={() => setSort(key)}
              className="px-3 py-1.5 rounded-lg text-sm transition-all"
              style={{
                border: `1px solid ${sort === key ? "#14110F" : "#D6CFC7"}`,
                color: sort === key ? "#14110F" : "#6B6560",
                fontWeight: sort === key ? 700 : 400,
                backgroundColor: "#FFFFFF",
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#F2EDE5")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#FFFFFF")}>
              {t.table.sortKeys[key]}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl overflow-hidden relative" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8E2DA", boxShadow: "0 1px 2px rgba(20,17,15,0.05)" }}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ borderBottom: "1px solid #E8E2DA", backgroundColor: "#FAF7F1" }}>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.14em] min-w-[220px]" style={{ color: "#6B6560" }}>{t.table.headers.product}</th>
                <th className="px-3 py-3.5 text-right text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "#6B6560" }}>
                  {t.table.headers.dcSF} <span className="font-normal" style={{ color: "#1E8574" }}>({t.table.headers.hub})</span>
                </th>
                <th className="px-3 py-3.5 text-right text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "#6B6560" }}>{t.table.headers.dcNJ}</th>
                <th className="px-3 py-3.5 text-right text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "#6B6560" }}>{t.table.headers.dcLA}</th>
                <th className="px-3 py-3.5 text-right text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "#6B6560" }}>{t.table.headers.company}</th>
                <th className="px-3 py-3.5 text-center text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "#6B6560" }}>{t.table.headers.status}</th>
                <th className="px-3 py-3.5 text-right text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "#6B6560" }}>{t.table.headers.cbRisk}</th>
                <th className="px-4 py-3.5 sticky right-0 z-10" style={{ backgroundColor: "#FAF7F1", boxShadow: "-5px 0 10px -5px rgba(20,17,15,0.06)" }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const s = STATUS_STYLE[row.status as keyof typeof STATUS_STYLE];
                const bgBase = i % 2 === 1 ? "#FAF7F1" : "#FFFFFF";
                return (
                  <tr
                    key={row.sku}
                    className="cursor-pointer transition-colors"
                    style={{ borderBottom: "1px solid #F2EDE5", backgroundColor: bgBase }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#FDF9EC")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = bgBase)}
                    onClick={() => setSelected(row)}
                  >
                    <td className="px-4 py-4">
                      <p className="font-semibold text-sm leading-tight line-clamp-2" style={{ color: "#14110F" }}>{row.product}</p>
                      <p className="mono text-[11px] mt-0.5" style={{ color: "#8E8680" }}>{row.sku.trim()} · {row.category}</p>
                      {row.note && (
                        <p className="text-[11px] mt-1 max-w-[200px] leading-tight line-clamp-1" style={{ color: row.status === "inactive" ? "#8E8680" : "#8C5A0F" }}>
                          {row.status === "inactive" ? "ℹ" : "⚠"} {row.note.slice(0, 55)}…
                        </p>
                      )}
                    </td>

                    <td className="px-3 py-4"><DcCell slot={row.dcSF} /></td>
                    <td className="px-3 py-4"><DcCell slot={row.dcNJ} /></td>
                    <td className="px-3 py-4"><DcCell slot={row.dcLA} /></td>

                    <td className="px-3 py-4 text-right">
                      <p className="mono text-base font-bold" style={{ color: "#14110F" }}>{row.companyDaysSupply === 9999 ? t.table.noDemand : `${row.companyDaysSupply}d`}</p>
                      <p className="mono text-[11px] whitespace-nowrap" style={{ color: "#8E8680" }}>{row.companyAvailable.toLocaleString()} avail</p>
                    </td>

                    <td className="px-3 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 rounded-full text-xs font-semibold px-2.5 py-1 whitespace-nowrap ${s.pill}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                        {t.status[row.status as keyof typeof t.status]}
                      </span>
                    </td>

                    <td className="px-3 py-4 text-right">
                      {row.chargebackRisk > 0 ? (
                        <span className="mono text-sm font-bold" style={{ color: "#7A0F1D" }}>${row.chargebackRisk.toLocaleString()}</span>
                      ) : (
                        <span className="mono text-sm" style={{ color: "#D6CFC7" }}>—</span>
                      )}
                    </td>

                    <td
                      className="px-4 py-4 sticky right-0 z-10 transition-colors"
                      style={{ backgroundColor: bgBase, boxShadow: "-5px 0 10px -5px rgba(20,17,15,0.06)" }}
                    >
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        {transferredSkus.has(row.sku.trim()) ? (
                          <span className="text-xs font-semibold rounded-lg px-3 py-1.5 whitespace-nowrap" style={{ color: "#125F54", backgroundColor: "#EEF7F5", border: "1px solid #7AC4B8" }}>
                            {t.table.transferred}
                          </span>
                        ) : (row.status === "critical" || row.status === "warning") ? (
                          <button
                            onClick={() => openTransfer(row)}
                            className="text-xs font-bold text-white rounded-lg px-3 py-1.5 whitespace-nowrap transition-colors"
                            style={{ backgroundColor: "#7A0F1D" }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#5E0B15")}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#7A0F1D")}
                          >
                            {t.table.transfer}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <DetailModal
          row={selected}
          onClose={() => setSelected(null)}
          onTransfer={() => openTransfer(selected)}
        />
      )}

      {transferTarget && (
        <TransferModal
          row={transferTarget}
          rec={getRecForRow(transferTarget)}
          onClose={() => setTransferTarget(null)}
          onSuccess={() => {
            setTransferredSkus(prev => new Set([...prev, transferTarget.sku.trim()]));
            setTransferTarget(null);
            loadData();
          }}
        />
      )}
    </>
  );
}
