const SEV = {
  critical: {
    barColor: "#A6192E",
    borderColor: "#F4D5D8",
    badgeStyle: { backgroundColor: "#FBEEEF", color: "#7A0F1D", border: "1px solid #F4D5D8" },
    dotColor: "#A6192E",
    daysStyle: { color: "#7A0F1D", backgroundColor: "#FBEEEF" },
    label: "Critical",
  },
  warning: {
    barColor: "#B97A15",
    borderColor: "#E5B664",
    badgeStyle: { backgroundColor: "#FEF7E8", color: "#8C5A0F", border: "1px solid #E5B664" },
    dotColor: "#B97A15",
    daysStyle: { color: "#8C5A0F", backgroundColor: "#FEF7E8" },
    label: "Warning",
  },
  ok: {
    barColor: "#1E8574",
    borderColor: "#7AC4B8",
    badgeStyle: { backgroundColor: "#EEF7F5", color: "#125F54", border: "1px solid #7AC4B8" },
    dotColor: "#1E8574",
    daysStyle: { color: "#125F54", backgroundColor: "#EEF7F5" },
    label: "OK",
  },
};

export function AlertsBanner({ alerts, onDismiss }: { alerts: any[]; onDismiss: (id: string) => void }) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-xl px-6 py-8 text-center text-sm" style={{ backgroundColor: "#EEF7F5", border: "1px solid #7AC4B8", color: "#125F54" }}>
        All alerts reviewed. No active warnings.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert, i) => {
        const s = SEV[alert.severity as keyof typeof SEV];
        return (
          <div key={alert.id} className="rounded-xl overflow-hidden flex" style={{ backgroundColor: "#FFFFFF", border: `1px solid ${s.borderColor}`, boxShadow: "0 1px 2px rgba(20,17,15,0.05)" }}>
            <div className="w-1 flex-shrink-0" style={{ backgroundColor: s.barColor }} />
            <div className="flex items-start gap-4 px-5 py-4 flex-1">
              <div className="flex-shrink-0 mt-0.5">
                <span className="mono text-xs font-bold" style={{ color: "#D6CFC7" }}>#{i + 1}</span>
              </div>

              <div className="flex-shrink-0 mt-0.5 space-y-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full text-xs font-semibold px-2.5 py-1" style={s.badgeStyle}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.dotColor }} />
                  {s.label}
                </span>
                {alert.urgentRequestCount > 0 && (
                  <div className="text-[11px] font-semibold" style={{ color: "#A6192E" }}>
                    ✕{alert.urgentRequestCount} in URGENT sheet
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap mb-1">
                  <span className="text-sm font-bold" style={{ color: "#14110F" }}>{alert.product}</span>
                  <span className="mono text-xs rounded px-1.5 py-0.5" style={{ color: "#8E8680", backgroundColor: "#FAF7F1" }}>{alert.sku}</span>
                  <span className="text-xs" style={{ color: "#D6CFC7" }}>·</span>
                  <span className="text-xs" style={{ color: "#6B6560" }}>{alert.dc}</span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "#6B6560" }}>{alert.message}</p>
              </div>

              <div className="flex-shrink-0 flex flex-col items-end gap-2 ml-2">
                <span className="mono text-xs font-bold rounded-full px-2.5 py-1" style={s.daysStyle}>
                  {alert.daysLeft}d supply
                </span>
                <button
                  onClick={() => onDismiss(alert.id)}
                  className="text-xs font-medium rounded-lg px-3 py-1.5 transition-colors"
                  style={{ color: "#6B6560", border: "1px solid #D6CFC7", backgroundColor: "#FFFFFF" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#F2EDE5")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#FFFFFF")}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
