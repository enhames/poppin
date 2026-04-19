import { useState, useEffect, useMemo } from "react";
import { api, type Recommendation } from "../api/client";
import ScatterPlot from "./ScatterPlot";
import { useLanguage } from "../i18n/LanguageContext";
import { fmtMoney } from "../utils/format";

type PoRiskMetrics = {
  etaByLocation?: Record<string, number>;
  delayByLocation?: Record<string, number>;
  avgDelayByLocation?: Record<string, number>;
};

function CostBar({ freight, chargeback }: { freight: number; chargeback: number }) {
  const { t } = useLanguage();
  const max = Math.max(freight, chargeback, 1);
  const freightPct = (freight / max) * 100;
  const cbPct = (chargeback / max) * 100;
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <div className="flex justify-between text-xs mb-0.5" style={{ color: "#6B6560" }}>
          <span>{t.transferPanel.freight}</span>
          <span className="mono font-semibold" style={{ color: "#403A34" }}>${fmtMoney(freight)}</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#E8E2DA" }}>
          <div className="h-full rounded-full" style={{ width: `${freightPct}%`, backgroundColor: "#403A34" }} />
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs mb-0.5" style={{ color: "#6B6560" }}>
          <span>{t.transferPanel.penalty}</span>
          <span className="mono font-semibold" style={{ color: "#7A0F1D" }}>${fmtMoney(chargeback)}</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#E8E2DA" }}>
          <div className="h-full rounded-full" style={{ width: `${cbPct}%`, backgroundColor: "#A6192E" }} />
        </div>
      </div>
    </div>
  );
}

function RecCard({ rec }: { rec: Recommendation }) {
  const { t } = useLanguage();
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [overridden, setOverridden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTransfer = rec.recommendation === "TRANSFER";
  const netPositive = rec.transfer_value > 0;

  async function handleApprove() {
    setApproving(true);
    setError(null);
    try {
      await api.approveTransfer({
        sku: rec.sku,
        item_name: rec.item_name,
        source_dc: rec.source_dc,
        destination_dc: rec.destination_dc,
        units: rec.transfer_units,
      });
      setApproved(true);
    } catch (e) {
      setError(t.transferPanel.failError);
    } finally {
      setApproving(false);
    }
  }

  const headerBg = isTransfer ? "#FDF6F6" : "#FDF9EC";
  const headerBorder = isTransfer ? "#F4D5D8" : "#E5B664";
  const topBorderColor = isTransfer ? "#7A0F1D" : "#B97A15";

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "#FFFFFF", border: `1px solid ${headerBorder}`, borderTopWidth: "3px", borderTopColor: topBorderColor, boxShadow: "0 1px 2px rgba(20,17,15,0.05)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5" style={{ backgroundColor: headerBg, borderBottom: `1px solid ${headerBorder}` }}>
        <div className="flex items-center gap-2.5">
          <h3 className="text-sm font-bold" style={{ color: "#14110F", fontFamily: "Fraunces, serif", fontVariationSettings: "'opsz' 48" }}>{rec.item_name}</h3>
          <span className="mono text-[11px] rounded px-1.5 py-0.5" style={{ color: "#8E8680", backgroundColor: "rgba(255,255,255,0.7)" }}>{rec.sku}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm font-bold rounded-lg px-3.5 py-1.5" style={
          isTransfer
            ? { backgroundColor: "#14110F", color: "#FFFFFF" }
            : { border: "1px solid #E5B664", color: "#8C5A0F", backgroundColor: "#FFFFFF" }
        }>
          {isTransfer ? "↗ Transfer" : (
            <span className="flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 22h14" /><path d="M5 2h14" />
                <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
                <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
              </svg>
              Wait
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        {/* Route */}
        <div className="flex items-center gap-2 mb-5">
          <span className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "#8E8680" }}>{t.transferPanel.route}</span>
          <span className="inline-flex items-center text-xs font-semibold rounded-full px-3 py-1" style={{ color: "#125F54", backgroundColor: "#EEF7F5", border: "1px solid #7AC4B8" }}>
            {rec.source_dc}
          </span>
          <span className="text-sm" style={{ color: "#B8B1AA" }}>→</span>
          <span className="inline-flex items-center text-xs font-semibold rounded-full px-3 py-1" style={{ color: "#403A34", backgroundColor: "#FAF7F1", border: "1px solid #D6CFC7" }}>
            {rec.destination_dc}
          </span>
          <span className="text-sm mono" style={{ color: "#6B6560" }}>· {rec.transfer_units.toLocaleString()} {t.transferPanel.units}</span>
        </div>

        {/* Cost visual */}
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] mb-3" style={{ color: "#8E8680" }}>{t.transferPanel.costComparison}</p>
          <CostBar freight={rec.transfer_cost} chargeback={rec.avoided_penalty} />
          <div className="mt-3 p-3 rounded-lg" style={{
            backgroundColor: netPositive ? "#EEF7F5" : "#FAF7F1",
            border: `1px solid ${netPositive ? "#7AC4B8" : "#D6CFC7"}`,
          }}>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] mb-0.5" style={{ color: netPositive ? "#125F54" : "#6B6560" }}>
              {t.transferPanel.netValue}
            </p>
            <p className="mono text-xl font-bold" style={{ color: netPositive ? "#125F54" : "#6B6560" }}>
              {netPositive ? `+$${fmtMoney(rec.transfer_value)}` : `−$${fmtMoney(Math.abs(rec.transfer_value))}`}
            </p>
            {!netPositive && (
              <p className="text-[11px] mt-0.5" style={{ color: "#8E8680" }}>{t.transferPanel.waitForPo}</p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-4 items-center" style={{ borderTop: "1px solid #F2EDE5" }}>
          {approved ? (
            <span className="text-sm font-semibold rounded-lg px-5 py-2.5" style={{ color: "#125F54", backgroundColor: "#EEF7F5", border: "1px solid #7AC4B8" }}>
              {t.transferPanel.transferLogged}
            </span>
          ) : overridden ? (
            <span className="flex items-center gap-2 text-sm font-semibold rounded-lg px-5 py-2.5" style={{ color: "#8C5A0F", backgroundColor: "#FEF7E8", border: "1px solid #E5B664" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 22h14" /><path d="M5 2h14" />
                <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
                <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
              </svg>
              {t.transferPanel.waitingForPo}
            </span>
          ) : isTransfer ? (
            <>
              <button
                onClick={handleApprove}
                disabled={approving}
                className="text-sm font-bold text-white rounded-lg px-5 py-2.5 disabled:opacity-60 transition-opacity"
                style={{ backgroundColor: "#7A0F1D" }}
                onMouseEnter={e => { if (!approving) e.currentTarget.style.backgroundColor = "#5E0B15"; }}
                onMouseLeave={e => { if (!approving) e.currentTarget.style.backgroundColor = "#7A0F1D"; }}
              >
                {approving ? t.transferPanel.submitting : t.transferPanel.approve}
              </button>
              <button
                onClick={() => setOverridden(true)}
                className="text-sm font-semibold rounded-lg px-5 py-2.5 transition-colors"
                style={{ color: "#403A34", border: "1px solid #D6CFC7", backgroundColor: "#FFFFFF" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#F2EDE5")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#FFFFFF")}
              >
                {t.transferPanel.overrideWait}
              </button>
            </>
          ) : (
            <button
              onClick={handleApprove}
              disabled={approving}
              className="text-sm font-semibold rounded-lg px-5 py-2.5 disabled:opacity-60 transition-colors"
              style={{ color: "#403A34", border: "1px solid #D6CFC7", backgroundColor: "#FFFFFF" }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#F2EDE5")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#FFFFFF")}
            >
              {approving ? t.transferPanel.submitting : t.transferPanel.overrideTransfer}
            </button>
          )}
          {error && <p className="text-xs ml-2" style={{ color: "#7A0F1D" }}>{error}</p>}
        </div>
      </div>
    </div>
  );
}

export function TransferPanel() {
  const { t } = useLanguage();
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [poRiskMetrics, setPoRiskMetrics] = useState<PoRiskMetrics | null>(null);

  useEffect(() => {
    api.getRecommendations()
      .then(setRecs)
      .catch(() => setError(t.transferPanel.error))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api.getInventory()
      .then((inventory: any) => {
        const metadata = inventory?.METADATA;
        if (!metadata) return;
        setPoRiskMetrics({
          etaByLocation: metadata.po_eta_reliability_by_location,
          delayByLocation: metadata.po_delay_probability_by_location,
          avgDelayByLocation: metadata.po_avg_delay_days_by_location,
        });
      })
      .catch(() => {
        setPoRiskMetrics(null);
      });
  }, []);

  const sortedRecs = useMemo(
    () => [...recs].sort((a, b) => b.transfer_value - a.transfer_value),
    [recs]
  );

  const transferCount = recs.filter((r) => r.recommendation === "TRANSFER").length;
  const hubRouteCosts: [string, string, boolean][] = [
    [t.transferPanel.sfToNj, "$270.42", true],
    [t.transferPanel.sfToLa, "$54.70", false],
    [t.transferPanel.njToSf, "$269.16", false],
    [t.transferPanel.njToLa, "$272.40", false],
    [t.transferPanel.laToSf, "$97.18", false],
    [t.transferPanel.laToNj, "$308.83", true],
  ];
  const toPct = (value?: number) => (value === undefined ? "—" : `${(value * 100).toFixed(1)}%`);
  const toDays = (value?: number) => (value === undefined ? "—" : `${value.toFixed(1)}d`);
  const poMetricCards = [
    {
      key: "sf",
      label: t.transferPanel.poSf,
      onTime: toPct(poRiskMetrics?.etaByLocation?.["1"]),
      delay: toPct(poRiskMetrics?.delayByLocation?.["1"]),
      avg: toDays(poRiskMetrics?.avgDelayByLocation?.["1"]),
    },
    {
      key: "nj",
      label: t.transferPanel.poNj,
      onTime: toPct(poRiskMetrics?.etaByLocation?.["2"]),
      delay: toPct(poRiskMetrics?.delayByLocation?.["2"]),
      avg: toDays(poRiskMetrics?.avgDelayByLocation?.["2"]),
    },
    {
      key: "la",
      label: t.transferPanel.poLa,
      onTime: toPct(poRiskMetrics?.etaByLocation?.["3"]),
      delay: toPct(poRiskMetrics?.delayByLocation?.["3"]),
      avg: toDays(poRiskMetrics?.avgDelayByLocation?.["3"]),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Scatter plot visualization */}
      {!loading && !error && recs.length > 0 && (
        <div className="rounded-xl p-5" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8E2DA", boxShadow: "0 1px 2px rgba(20,17,15,0.05)" }}>
          <h3 className="text-sm font-bold mb-4" style={{ color: "#14110F", fontFamily: "Fraunces, serif", fontVariationSettings: "'opsz' 48" }}>{t.transferPanel.costChart}</h3>
          <ScatterPlot data={sortedRecs} />
        </div>
      )}

      {/* State: loading / error / empty */}
      {loading && (
        <div className="rounded-xl px-6 py-8 text-center text-sm" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8E2DA", color: "#8E8680" }}>
          {t.transferPanel.loading}
        </div>
      )}
      {error && (
        <div className="rounded-xl px-6 py-4 text-sm" style={{ backgroundColor: "#FBEEEF", border: "1px solid #F4D5D8", color: "#7A0F1D" }}>
          {error}
        </div>
      )}
      {!loading && !error && recs.length === 0 && (
        <div className="rounded-xl px-6 py-8 text-center text-sm" style={{ backgroundColor: "#EEF7F5", border: "1px solid #7AC4B8", color: "#125F54" }}>
          {t.transferPanel.noImbalances}
        </div>
      )}

      {!loading && recs.length > 0 && (
        <div className="flex items-center gap-2 text-sm" style={{ color: "#6B6560" }}>
          <span className="font-semibold" style={{ color: "#14110F" }}>{t.transferPanel.recommendations(recs.length)}</span>
          · {transferCount > 0 ? (
            <span className="font-semibold" style={{ color: "#7A0F1D" }}>{t.transferPanel.requireImmediate(transferCount)}</span>
          ) : (
            <span>{t.transferPanel.noneRequired}</span>
          )}
        </div>
      )}

      {/* Recommendation cards */}
      {sortedRecs.map((rec) => (
        <RecCard key={`${rec.sku}-${rec.source_dc}-${rec.destination_dc}`} rec={rec} />
      ))}

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl px-5 py-4" style={{ backgroundColor: "#FFFFFF", border: "1px solid #7AC4B8", boxShadow: "0 1px 2px rgba(20,17,15,0.05)" }}>
          <p className="text-xs font-bold uppercase tracking-[0.14em] mb-2" style={{ color: "#125F54" }}>{t.transferPanel.hubLogicTitle}</p>
          <p className="text-sm leading-relaxed" style={{ color: "#6B6560" }}>{t.transferPanel.hubLogicBody}</p>
          <div className="mt-3 pt-3 space-y-3" style={{ borderTop: "1px solid #DCEFEB" }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "#8E8680" }}>
              {t.transferPanel.hubRoutesTitle}
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {hubRouteCosts.map(([route, cost, emphasized]) => (
                <div
                  key={route}
                  className="rounded-lg px-3 py-2"
                  style={{
                    backgroundColor: emphasized ? "#FBEEEF" : "#FAF7F1",
                    border: `1px solid ${emphasized ? "#F4D5D8" : "#E8E2DA"}`,
                  }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "#8E8680" }}>{route}</p>
                  <p className="mono text-xs font-semibold" style={{ color: emphasized ? "#7A0F1D" : "#403A34" }}>
                    {cost}
                    <span className="font-medium" style={{ color: emphasized ? "#A6192E" : "#6B6560" }}>{t.transferPanel.perPallet}</span>
                  </p>
                </div>
              ))}
            </div>
            <div className="rounded-lg px-3 py-2.5" style={{ backgroundColor: "#FEF7E8", border: "1px solid #E5B664" }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-0.5" style={{ color: "#8C5A0F" }}>
                {t.transferPanel.priorityNoteTitle}
              </p>
              <p className="text-xs font-semibold leading-relaxed" style={{ color: "#8C5A0F" }}>
                {t.transferPanel.priorityNoteBody}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl px-5 py-4" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5B664", boxShadow: "0 1px 2px rgba(20,17,15,0.05)" }}>
          <p className="text-xs font-bold uppercase tracking-[0.14em] mb-2" style={{ color: "#8C5A0F" }}>{t.transferPanel.poRiskTitle}</p>
          <p className="text-sm leading-relaxed" style={{ color: "#6B6560" }}>{t.transferPanel.poRiskBody}</p>
          <div className="mt-3 pt-3 space-y-2.5" style={{ borderTop: "1px solid #FBEACB" }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "#8C5A0F" }}>{t.transferPanel.poStatsTitle}</p>
            <div className="grid grid-cols-3 gap-2">
              {poMetricCards.map((card) => (
                <div key={card.key} className="rounded-lg px-2.5 py-2" style={{ backgroundColor: "#FEF7E8", border: "1px solid #FBEACB" }}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "#8C5A0F" }}>{card.label}</p>
                  <p className="text-[11px] mt-1" style={{ color: "#6B6560" }}>
                    {t.transferPanel.poOnTime}: <span className="mono font-semibold" style={{ color: "#403A34" }}>{card.onTime}</span>
                  </p>
                  <p className="text-[11px]" style={{ color: "#6B6560" }}>
                    {t.transferPanel.poDelayed}: <span className="mono font-semibold" style={{ color: "#7A0F1D" }}>{card.delay}</span>
                  </p>
                  <p className="text-[11px]" style={{ color: "#6B6560" }}>
                    {t.transferPanel.poAvgDelay}: <span className="mono font-semibold" style={{ color: "#403A34" }}>{card.avg}</span>
                  </p>
                </div>
              ))}
            </div>
            <p className="text-xs font-medium" style={{ color: "#8C5A0F" }}>{t.transferPanel.poRule}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
