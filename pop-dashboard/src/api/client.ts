export interface Recommendation {
  sku: string;
  item_name: string;
  source_dc: string;
  destination_dc: string;
  recommendation: "TRANSFER" | "WAIT";
  transfer_units: number;
  transfer_cost: number;
  avoided_penalty: number;
  transfer_value: number;
  reason: string;
}

export interface TransferApproval {
  sku: string;
  item_name: string;
  source_dc: string;
  destination_dc: string;
  units: number;
  approved_by?: string;
}

export interface DashboardSummary {
  urgentRequestTotal: number;
  penaltyExposure: number;
  transferRecommendedCount: number;
  estimatedNetSavings: number;
  pendingInboundPos: number;
  dcDistribution: Array<{
    site: string;
    name: string;
    role: string;
    sharePct: number;
    stockOnHand: number;
  }>;
}

export interface UrgentRequest {
  id: string;
  sku: string;
  product: string;
  qty: string;
  note: string;
  date: string;
}

export interface DashboardScenario {
  sku: string;
  product: string;
  sourceDc: string;
  destinationDc: string;
  transferUnits: number;
  transferCost: number;
  penaltyExposure: number;
  netSaving: number;
}

export interface DirectorLogEntry {
  event_id: string;
  approved_at: string;
  approved_by: string;
  action_type: string;
  summary?: string;
  sku?: string;
  source_dc?: string;
  destination_dc?: string;
  units?: number;
}

const DEBUG_RECOMMENDATION_MODE: "legacy" | "new" = "new";

function withRecommendationMode(path: string): string {
  const glue = path.includes("?") ? "&" : "?";
  return `${path}${glue}mode=${DEBUG_RECOMMENDATION_MODE}`;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

export const api = {
  getRecommendations: () => get<Recommendation[]>(withRecommendationMode("/api/recommendations")),

  getInventory: () => get<unknown>("/api/inventory"),

  getAlerts: () => get<unknown[]>("/api/alerts"),

  getChargebacks: () => get<unknown>("/api/chargebacks"),

  getDashboardSummary: () => get<DashboardSummary>(withRecommendationMode("/api/dashboard/summary")),

  getUrgentRequests: () => get<UrgentRequest[]>("/api/urgent-requests"),

  getDashboardScenario: async () => {
    const raw = await get<{ scenario: DashboardScenario | null }>(withRecommendationMode("/api/dashboard/scenario"));
    return raw.scenario;
  },

  approveTransfer: async (payload: TransferApproval) => {
    const res = await fetch("/api/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`POST /api/transfers failed: ${res.status}`);
    return res.json();
  },

  refreshInventory: async () => {
    const res = await fetch("/api/refresh-inventory", { method: "POST" });
    if (!res.ok) throw new Error(`POST /api/refresh-inventory failed: ${res.status}`);
    return res.json();
  },

  getDirectorLog: () => get<DirectorLogEntry[]>("/api/director-log"),
};
