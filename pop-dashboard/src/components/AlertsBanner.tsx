import { alertsData } from "../data/mockData";

const SEV = {
  critical: {
    bar: "bg-red-500",
    bg: "bg-white",
    border: "border-red-200",
    badge: "bg-red-50 text-red-700 border border-red-200",
    label: "Critical",
    dot: "bg-red-500",
    days: "text-red-600 bg-red-50",
    btn: { bg: "#C8381C", text: "white" },
  },
  warning: {
    bar: "bg-amber-400",
    bg: "bg-white",
    border: "border-amber-200",
    badge: "bg-amber-50 text-amber-700 border border-amber-200",
    label: "Warning",
    dot: "bg-amber-400",
    days: "text-amber-700 bg-amber-50",
    btn: { bg: "#B45309", text: "white" },
  },
  ok: {
    bar: "bg-emerald-500",
    bg: "bg-white",
    border: "border-emerald-200",
    badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    label: "OK",
    dot: "bg-emerald-500",
    days: "text-emerald-700 bg-emerald-50",
    btn: { bg: "#0A7B4B", text: "white" },
  },
};

export function AlertsBanner() {
  return (
    <div className="space-y-3">
      {alertsData.map((alert, i) => {
        const s = SEV[alert.severity];
        return (
          <div key={alert.id} className={`bg-white rounded-xl border ${s.border} overflow-hidden shadow-sm flex`}>
            {/* Priority number + colored bar */}
            <div className={`w-1 flex-shrink-0 ${s.bar}`} />
            <div className="flex items-start gap-4 px-5 py-4 flex-1">
              {/* Priority */}
              <div className="flex-shrink-0 mt-0.5">
                <span className="mono text-xs font-bold text-gray-300">#{i + 1}</span>
              </div>

              {/* Severity badge + product */}
              <div className="flex-shrink-0 mt-0.5 space-y-1.5">
                <span className={`inline-flex items-center gap-1.5 rounded-full text-xs font-semibold px-2.5 py-1 ${s.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                  {s.label}
                </span>
                {alert.urgentRequestCount !== undefined && alert.urgentRequestCount > 0 && (
                  <div className="text-[11px] font-semibold text-red-500">
                    ✕{alert.urgentRequestCount} in URGENT sheet
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap mb-1">
                  <span className="text-sm font-bold text-gray-900">{alert.product}</span>
                  <span className="mono text-xs text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">{alert.sku}</span>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs text-gray-500">{alert.dc}</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{alert.message}</p>
              </div>

              {/* Days supply pill + actions */}
              <div className="flex-shrink-0 flex flex-col items-end gap-2 ml-2">
                <span className={`mono text-xs font-bold rounded-full px-2.5 py-1 ${s.days}`}>
                  {alert.daysLeft}d supply
                </span>
                <div className="flex gap-2">
                  <button
                    className="text-xs font-semibold rounded-lg px-3 py-1.5 text-white"
                    style={{ backgroundColor: s.btn.bg }}
                  >
                    Transfer →
                  </button>
                  <button className="text-xs font-medium rounded-lg px-3 py-1.5 text-gray-500 border border-gray-200 hover:bg-gray-50">
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
