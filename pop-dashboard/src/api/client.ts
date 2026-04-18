export interface Recommendation {
  sku: string;
  item_name: string;
  source_dc: string;
  destination_dc: string;
  recommendation: "TRANSFER" | "WAIT";
  transfer_units: number;
  transfer_cost: number;
  net_value: number;
  expected_penalty_without_transfer: number;
  expected_penalty_with_transfer: number;
}

export interface TransferApproval {
  sku: string;
  item_name: string;
  source_dc: string;
  destination_dc: string;
  units: number;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

export const api = {
  getRecommendations: () => get<Recommendation[]>("/api/recommendations"),

  getInventory: () => get<unknown>("/api/inventory"),

  getAlerts: () => get<unknown[]>("/api/alerts"),

  getChargebacks: () => get<unknown>("/api/chargebacks"),

  approveTransfer: async (payload: TransferApproval) => {
    const res = await fetch("/api/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`POST /api/transfers failed: ${res.status}`);
    return res.json();
  },
};
