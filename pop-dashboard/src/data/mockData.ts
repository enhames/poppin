export type Status = "critical" | "warning" | "ok";
export type Urgency = "critical" | "warning";

// ─── DC identities ─────────────────────────────────────────────────────────────
// DC-1 = SF/Livermore (HQ, redistribution hub)
// DC-2 = New Jersey (dominant: 54.3% of 2025 revenue)
// DC-3 = Los Angeles (18.1% of 2025 revenue)

export interface DcSlot {
  onHand: number;
  allocated: number;
  available: number;
  daysSupply: number;
  velocityPerDay: number;
  isEstimated: boolean;
}

export interface SkuRow {
  sku: string;
  product: string;
  category: string;
  unitCost: number;
  dcSF: DcSlot;
  dcNJ: DcSlot;
  dcLA: DcSlot;
  companyAvailable: number;
  companyDaysSupply: number;
  status: Status;
  chargebackRisk: number;
  inboundPo: { eta: string; qty: number; dc: string } | null;
  note?: string;
}

export interface ChargebackRow {
  causeCode: string;
  channel: string;
  amount: number;
  incidents: number;
  dc: string;
  type: "operational" | "post-audit" | "damage" | "promotional";
}

export interface CustomerPenalty {
  customerId: string;
  customerName: string;
  amount: number;
  incidents: number;
}

export interface YearlyPenalty {
  year: string;
  operational: number;    // CRED11-F + CRED11-O
  postAudit: number;      // CRED12
  damage: number;         // CRED08
  peakMonth?: string;
  peakMonthAmount?: number;
}

export interface AlertItem {
  id: number;
  severity: Status;
  sku: string;
  product: string;
  dc: string;
  daysLeft: number;
  message: string;
  urgentRequestCount?: number;
}

export interface TransferRec {
  id: number;
  sku: string;
  product: string;
  from: string;
  to: string;
  qty: number;
  freightRatePerUnit: number;
  freightCost: number;
  chargebackRisk: number;
  netSaving: number;
  recommendation: "TRANSFER" | "WAIT";
  urgency: Urgency;
  inboundEta: string | null;
  poLeadTimeNote: string;
  reasoning: string;
}

export interface UrgentRequest {
  id: string;
  sku: string;
  product: string;
  qty: string;
  note: string;
  date: string;
}

// ─── Chargebacks — real data (Data - Deductions & Cause Code sheet) ────────────
// Source: POP_ChargeBack_Deductions_Penalties_Freight.xlsx
// CRED11-F + CRED11-O = operational penalties (preventable via inventory positioning)
// CRED12 = post-audit claims (arrive 8–12 months after incident, cannot be disputed)
// CRED08 = damage allowances (warehouse handling, NJ rate 2.5× SF)

export const yearlyPenalties: YearlyPenalty[] = [
  { year: "2023", operational: 32255, postAudit: 32528, damage: 85036 },
  {
    year: "2024",
    operational: 252025,
    postAudit: 356425,
    damage: 466141,
    peakMonth: "Aug 2024",
    peakMonthAmount: 110583,
  },
  { year: "2025", operational: 155354, postAudit: 253597, damage: 576864 },
];

// Penalty-addressable cause codes (operational + post-audit + damage) — 3yr totals
export const chargebackData: ChargebackRow[] = [
  { causeCode: "CRED11-F", channel: "Various Channels", amount: 250230, incidents: 295, dc: "DC-NJ", type: "operational" },
  { causeCode: "CRED11-O", channel: "Various Channels", amount: 189404, incidents: 480, dc: "DC-NJ", type: "operational" },
  { causeCode: "CRED12",   channel: "Various Channels", amount: 642550, incidents: 451, dc: "Various", type: "post-audit" },
  { causeCode: "CRED08",   channel: "All Channels",     amount: 1128041, incidents: 4286, dc: "DC-NJ (×2.5 SF)", type: "damage" },
];

// Top 5 by CRED11+CRED12 (penalties the system can directly reduce)
export const customerPenalties: CustomerPenalty[] = [
  { customerId: "WAO556A", customerName: "KeHE Distributors, LLC",              amount: 400297, incidents: 323 },
  { customerId: "MDO100A", customerName: "Dollar General Corp",                  amount: 152575, incidents: 116 },
  { customerId: "MAM803A", customerName: "Amazon.com Services, Inc.",            amount: 81974,  incidents: 106 },
  { customerId: "EUNI12A", customerName: "United Natural Foods, Inc. — East",   amount: 76206,  incidents: 68  },
  { customerId: "MRE800A", customerName: "CVS Distribution Inc.",                amount: 58655,  incidents: 113 },
];

// ─── Alerts — derived from live_inventory.json critical DC positions ───────────

export const alertsData: AlertItem[] = [
  {
    id: 1,
    severity: "critical",
    sku: "F-04211",
    product: "POP Ginger Chews Original 2 oz",
    dc: "All DCs",
    daysLeft: 1,
    urgentRequestCount: 6,
    message:
      "All three DCs are at 0–1 day of supply. Demand is 3,212 units/day — the highest-velocity SKU in the catalog. Large incoming POs are in transit to all DCs (SF: 10K, NJ: 53K, LA: 14K). Monitor inbound arrival closely; any delay creates an immediate stockout.",
  },
  {
    id: 2,
    severity: "critical",
    sku: "F-04117",
    product: "POP Ginger Chews Blood Orange 4 oz",
    dc: "DC-NJ",
    daysLeft: 4,
    urgentRequestCount: 3,
    message:
      "DC-NJ at 4 days of supply with 234 units/day demand. DC-SF has 104 days on-hand (24,393 units). NJ has 82,852 incoming units in transit — but transit timing is uncertain. Transfer 6,084 units from SF to NJ now to bridge the gap. Freight cost $0.51/unit = $3,103.",
  },
  {
    id: 3,
    severity: "critical",
    sku: "J-72402",
    product: "Totole Chicken Bouillon 2.2 lbs",
    dc: "DC-NJ",
    daysLeft: 1,
    message:
      "DC-NJ has only 48 units on hand with 26.95 units/day demand — less than 2 days of supply. No incoming stock on file for NJ. DC-SF has 6,094 units (226 days). Transfer 783 units SF→NJ immediately ($399 freight vs. ~$680 chargeback exposure).",
  },
  {
    id: 4,
    severity: "warning",
    sku: "T-31520",
    product: "Tiger Balm Ultra 10g",
    dc: "DC-SF / DC-LA",
    daysLeft: 4,
    message:
      "DC-SF at 2 days, DC-LA at 6 days. Both have large inbound POs (SF: 77K units, LA: 70K units). DC-NJ is at 15 days with 135K incoming. Watch inbound arrival — if POs are delayed (avg 81.5% arrive late), SF and LA will stockout before replenishment.",
  },
];

// ─── Transfer Recommendations — from live_inventory critical positions ─────────
// Freight rates: SF→NJ $0.51/unit · SF→LA $0.17/unit · avoid reverse routes

export const transferRecs: TransferRec[] = [
  {
    id: 1,
    sku: "F-04117",
    product: "POP Ginger Chews Blood Orange 4 oz",
    from: "DC-SF (Hub)",
    to: "DC-NJ",
    qty: 6084,
    freightRatePerUnit: 0.51,
    freightCost: 3103,
    chargebackRisk: 4800,
    netSaving: 1697,
    recommendation: "TRANSFER",
    urgency: "critical",
    inboundEta: null,
    poLeadTimeNote: "NJ has 82,852 units incoming but transit timing is uncertain. SF can bridge immediately.",
    reasoning:
      "DC-NJ at 4 days, DC-SF at 104 days. Transfer 6,084 units (covers 26 days at 234/day burn rate) for $3,103 in freight. Chargeback exposure if NJ stockouts on next order: ~$4,800. Net savings: $1,697. Act now — don't rely on the incoming PO timing.",
  },
  {
    id: 2,
    sku: "J-72402",
    product: "Totole Chicken Bouillon 2.2 lbs",
    from: "DC-SF (Hub)",
    to: "DC-NJ",
    qty: 783,
    freightRatePerUnit: 0.51,
    freightCost: 399,
    chargebackRisk: 680,
    netSaving: 281,
    recommendation: "TRANSFER",
    urgency: "critical",
    inboundEta: null,
    poLeadTimeNote: "No open PO on file for NJ. SF has 226 days of supply — hub can absorb this transfer easily.",
    reasoning:
      "NJ has 48 units on-hand, 1 day of supply. No inbound PO. SF has 6,094 units (226 days). Transfer 783 units (bridges to 30 days) for $399 freight. Average penalty per incident is $680 — net saving $281. This is the lowest-cost urgent transfer in the queue.",
  },
  {
    id: 3,
    sku: "AC-B4BK",
    product: "AM GSG Root (Mixed) 4 oz Bag",
    from: "DC-SF (Hub)",
    to: "DC-NJ",
    qty: 3780,
    freightRatePerUnit: 0.51,
    freightCost: 1928,
    chargebackRisk: 2500,
    netSaving: 572,
    recommendation: "TRANSFER",
    urgency: "critical",
    inboundEta: null,
    poLeadTimeNote: "No incoming PO on file for either SF or NJ. SF has 45 days remaining — transfer will draw SF down to ~24 days.",
    reasoning:
      "NJ at 9 days (180 units/day), SF at 45 days. Neither DC has an inbound PO. Transfer 3,780 units to bring NJ to 30 days. Freight $1,928. Chargeback exposure estimated $2,500. Net saving $572 with no PO safety net to fall back on.",
  },
  {
    id: 4,
    sku: "T-31520",
    product: "Tiger Balm Ultra 10g",
    from: "DC-NJ",
    to: "DC-LA",
    qty: 0,
    freightRatePerUnit: 0.51,
    freightCost: 0,
    chargebackRisk: 1800,
    netSaving: -999,
    recommendation: "WAIT",
    urgency: "warning",
    inboundEta: "2026-04-25",
    poLeadTimeNote: "All three DCs have large inbound POs: SF 77K, NJ 135K, LA 70K. Monitor arrival; do not initiate costly transfer before PO lands.",
    reasoning:
      "SF at 2 days and LA at 6 days look alarming, but each DC has a large PO in transit. NJ at 15 days with 135K incoming. A cross-DC transfer at $1,075/day burn rate would cost thousands before the PO arrives. Watch the inbound; initiate transfer only if PO is confirmed delayed beyond 5 days.",
  },
];

// ─── Urgent requests — real rows from POP_InternalTransferRequests.xlsx ─────────
// 2,029 rows with URGENT/ASAP/OUT OF STOCK across 6 transfer routes (Sep 2022–2025)

export const urgentRequestSample: UrgentRequest[] = [
  { id: "5701", sku: "A-61011",  product: "AM GSG Root (bulk)",             qty: "50 cases",           note: "URGENT! OUT OF STOCK",                    date: "2022-09-12" },
  { id: "5706", sku: "D-60013",  product: "Dragon Well Green Tea",          qty: "20 cases",           note: "ASAP",                                    date: "2022-09-12" },
  { id: "5712", sku: "F-04130",  product: "POP Ginger Chews Original 3 oz", qty: "2 pallets",          note: "Urgent",                                  date: "2022-09-19" },
  { id: "5718", sku: "C-70121",  product: "Chicken Congee",                 qty: "1 pallet",           note: "URGENT! OUT OF STOCK",                    date: "2022-10-03" },
  { id: "5734", sku: "F-04211",  product: "POP Ginger Chews Original 2 oz", qty: "4 pallets",          note: "URGENT! OUT OF STOCK",                    date: "2023-02-20" },
  { id: "5748", sku: "T-31520",  product: "Tiger Balm Ultra 10g",           qty: "3 pallets",          note: "OUT OF STOCK at NJ — urgent!",            date: "2023-07-11" },
  { id: "5769", sku: "F-04117",  product: "POP Ginger Chews Blood Orange 4 oz", qty: "2 pallets",     note: "Urgent transfer needed NJ",               date: "2024-03-05" },
  { id: "5782", sku: "J-72402",  product: "Totole Chicken Bouillon 2.2 lbs", qty: "30 cases",          note: "URGENT! OUT OF STOCK NJ",                 date: "2024-08-19" },
  { id: "5801", sku: "AC-B4BK",  product: "AM GSG Root (Mixed) 4 oz Bag",  qty: "2 pallets",          note: "ASAP!! NJ needs stock",                   date: "2025-01-14" },
  { id: "5818", sku: "F-04211",  product: "POP Ginger Chews Original 2 oz", qty: "6 pallets",          note: "URGENT — Dollar General order at risk",   date: "2025-03-28" },
];
