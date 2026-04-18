import { alertsData } from "../data/mockData";

const severityConfig = {
  critical: {
    bar: "bg-[oklch(0.55_0.22_25)]",
    bg: "bg-[oklch(0.96_0.04_25)]",
    badge: "bg-[oklch(0.55_0.22_25)] text-white",
    border: "border-[oklch(0.55_0.22_25)]",
    label: "CRITICAL",
  },
  warning: {
    bar: "bg-[oklch(0.72_0.17_65)]",
    bg: "bg-[oklch(0.97_0.04_65)]",
    badge: "bg-[oklch(0.72_0.17_65)] text-white",
    border: "border-[oklch(0.72_0.17_65)]",
    label: "WARNING",
  },
  ok: {
    bar: "bg-[oklch(0.60_0.15_145)]",
    bg: "bg-[oklch(0.96_0.04_145)]",
    badge: "bg-[oklch(0.60_0.15_145)] text-white",
    border: "border-[oklch(0.60_0.15_145)]",
    label: "OK",
  },
};

export function AlertsBanner() {
  return (
    <div className="space-y-2">
      {alertsData.map((alert) => {
        const cfg = severityConfig[alert.severity];
        return (
          <div
            key={alert.id}
            className={`flex items-start gap-3 rounded-lg border ${cfg.border} ${cfg.bg} p-3 border-l-4`}
          >
            <div className="flex-shrink-0 mt-0.5">
              <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-widest ${cfg.badge}`}>
                {cfg.label}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-gray-900">{alert.product}</span>
                <span className="font-mono text-xs text-gray-500">{alert.sku}</span>
                <span className="text-xs text-gray-500">→ {alert.dc}</span>
                {alert.daysLeft === 0 ? (
                  <span className="font-mono text-xs font-bold text-[oklch(0.55_0.22_25)]">STOCKOUT NOW</span>
                ) : (
                  <span className="font-mono text-xs text-[oklch(0.72_0.17_65)]">{alert.daysLeft}d remaining</span>
                )}
              </div>
              <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{alert.message}</p>
            </div>
            <button className="flex-shrink-0 text-xs font-medium text-gray-500 hover:text-gray-800 underline underline-offset-2 whitespace-nowrap">
              View SKU →
            </button>
          </div>
        );
      })}
    </div>
  );
}
