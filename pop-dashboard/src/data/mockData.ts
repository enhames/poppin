export type Status = "critical" | "warning" | "ok";
export type Urgency = "critical" | "warning";

// ─── DC identities (real mapping from data dictionary) ────────────────────────
// DC-1 = SF/Livermore (HQ, redistribution hub — net −3.04M units exported 2023-2025)
// DC-2 = New Jersey (dominant: 54.3% of 2025 revenue, $42.3M)
// DC-3 = Los Angeles (18.1% of 2025 revenue, $14.1M)
// NOTE: Per-DC inventory snapshots do NOT exist in source data.
// Values below are ESTIMATED via demand-share reconstruction:
//   est_DC_inventory = carryover + PO receipts at DC − sales from DC + transfers in − transfers out

export interface DcSlot {
  onHand: number;       // estimated
  allocated: number;
  available: number;
  daysSupply: number;
  velocityPerDay: number;
  isEstimated: true;
}

export interface SkuRow {
  sku: string;
  product: string;
  category: string;
  unitCost: number;
  dcSF: DcSlot;   // DC-1 Livermore (hub)
  dcNJ: DcSlot;   // DC-2 New Jersey
  dcLA: DcSlot;   // DC-3 Los Angeles
  companyAvailable: number;   // from real snapshot
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
  customerName: string;     // real names visible in penalty sheet
  amount: number;
  incidents: number;
}

export interface YearlyPenalty {
  year: string;
  operational: number;    // CRED11-F + CRED11-O
  postAudit: number;      // CRED12
  damage: number;
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

// ─── Inventory (ESTIMATED per-DC, real company totals) ────────────────────────
// Methodology: reconstruct using 2025 PO receipts by DC + sales by DC + transfer history

export const inventoryData: SkuRow[] = [
  {
    // PRIMARY DEMO SKU — explosive NJ demand growth, multiple URGENT spreadsheet hits
    sku: "F-04130",
    product: "Ginger Chews Plus+ Orig 3oz",
    category: "Candy & Snacks",
    unitCost: 2.85,
    dcSF: { onHand: 4200, allocated: 420, available: 3780, daysSupply: 126, velocityPerDay: 30, isEstimated: true },
    dcNJ: { onHand: 2460, allocated: 980, available: 1480, daysSupply: 8, velocityPerDay: 184, isEstimated: true },
    dcLA: { onHand: 1640, allocated: 310, available: 1330, daysSupply: 19, velocityPerDay: 71, isEstimated: true },
    companyAvailable: 6590,
    companyDaysSupply: 23,
    status: "critical",
    chargebackRisk: 1702,
    inboundPo: { eta: "2026-05-08", qty: 4800, dc: "DC-SF" },
    note: "NJ demand +286% since 2023 (47→184 units/day). PO allocation hasn't kept pace. Appears 4× in URGENT transfer requests.",
  },
  {
    // HIGHEST VELOCITY SKU — NJ 2025 supply deficit: sold 282,625, received only 151,427
    sku: "T-31510",
    product: "Tiger Balm 18g Ultra",
    category: "OTC Analgesic",
    unitCost: 3.40,
    dcSF: { onHand: 180000, allocated: 18000, available: 162000, daysSupply: 723, velocityPerDay: 224, isEstimated: true },
    dcNJ: { onHand: 98000, allocated: 22000, available: 76000, daysSupply: 98, velocityPerDay: 774, isEstimated: true },
    dcLA: { onHand: 40941, allocated: 8000, available: 32941, daysSupply: 190, velocityPerDay: 173, isEstimated: true },
    companyAvailable: 270941,  // from real snapshot (318,941 on-hand − allocated)
    companyDaysSupply: 272,
    status: "warning",
    chargebackRisk: 4180,
    inboundPo: null,
    note: "Aggregate looks fine (272d). NJ 2025 deficit: sold 282,625 but received only 151,427 from suppliers — drew down 131,198 units (169d of NJ demand) from safety stock.",
  },
  {
    sku: "T-22010",
    product: "Tiger Balm 18g Red",
    category: "OTC Analgesic",
    unitCost: 3.20,
    dcSF: { onHand: 95000, allocated: 9500, available: 85500, daysSupply: 431, velocityPerDay: 198, isEstimated: true },
    dcNJ: { onHand: 120000, allocated: 21000, available: 99000, daysSupply: 145, velocityPerDay: 681, isEstimated: true },
    dcLA: { onHand: 30000, allocated: 5800, available: 24200, daysSupply: 141, velocityPerDay: 172, isEstimated: true },
    companyAvailable: 208700,
    companyDaysSupply: 198,
    status: "ok",
    chargebackRisk: 0,
    inboundPo: null,
  },
  {
    sku: "T-32206",
    product: "Tiger Balm Patch Warm",
    category: "OTC Analgesic",
    unitCost: 5.80,
    dcSF: { onHand: 35000, allocated: 3500, available: 31500, daysSupply: 246, velocityPerDay: 128, isEstimated: true },
    dcNJ: { onHand: 48000, allocated: 11000, available: 37000, daysSupply: 88, velocityPerDay: 420, isEstimated: true },
    dcLA: { onHand: 12000, allocated: 2400, available: 9600, daysSupply: 98, velocityPerDay: 98, isEstimated: true },
    companyAvailable: 78100,
    companyDaysSupply: 122,
    status: "warning",
    chargebackRisk: 860,
    inboundPo: { eta: "2026-05-15", qty: 24000, dc: "DC-NJ" },
    note: "NJ at 88d, SF at 246d. Typical hub surplus pattern. Watch NJ if PO is delayed (avg delay 28d).",
  },
  {
    sku: "T-31541",
    product: "Tiger Balm 50g",
    category: "OTC Analgesic",
    unitCost: 7.10,
    dcSF: { onHand: 18000, allocated: 1800, available: 16200, daysSupply: 438, velocityPerDay: 37, isEstimated: true },
    dcNJ: { onHand: 14000, allocated: 3200, available: 10800, daysSupply: 100, velocityPerDay: 108, isEstimated: true },
    dcLA: { onHand: 8200, allocated: 1600, available: 6600, daysSupply: 189, velocityPerDay: 35, isEstimated: true },
    companyAvailable: 33600,
    companyDaysSupply: 188,
    status: "ok",
    chargebackRisk: 0,
    inboundPo: null,
  },
  {
    sku: "F-04111",
    product: "Ginger Chews Orig 4oz",
    category: "Candy & Snacks",
    unitCost: 2.60,
    dcSF: { onHand: 12000, allocated: 1200, available: 10800, daysSupply: 212, velocityPerDay: 51, isEstimated: true },
    dcNJ: { onHand: 14000, allocated: 2800, available: 11200, daysSupply: 156, velocityPerDay: 72, isEstimated: true },
    dcLA: { onHand: 6000, allocated: 1200, available: 4800, daysSupply: 89, velocityPerDay: 54, isEstimated: true },
    companyAvailable: 26800,
    companyDaysSupply: 151,
    status: "ok",
    chargebackRisk: 0,
    inboundPo: { eta: "2026-04-29", qty: 12000, dc: "DC-SF" },
  },
];

// ─── Chargebacks — real data ──────────────────────────────────────────────────
// Operational penalties (CRED11-F + CRED11-O): $439,634 over 3yr, 775 incidents
// Post-audit claims (CRED12): $642,550 over 3yr — arrives 8-12mo after incident
// Damage allowances: $2,535,000 over 3yr (NJ warehouse = 2.5× SF damage rate)

export const yearlyPenalties: YearlyPenalty[] = [
  { year: "2023", operational: 126000, postAudit: 32000, damage: 785000 },
  { year: "2024", operational: 306000, postAudit: 356000, damage: 881000, peakMonth: "Aug 2024", peakMonthAmount: 101045 },
  { year: "2025", operational: 189000, postAudit: 254000, damage: 869000 },
];

export const chargebackData: ChargebackRow[] = [
  // Operational — directly addressable by inventory balancing
  { causeCode: "Short Ship (CRED11-F)", channel: "Mass Retail", amount: 189400, incidents: 168, dc: "DC-NJ", type: "operational" },
  { causeCode: "Late / Missed Window (CRED11-O)", channel: "Drug Chain", amount: 143600, incidents: 142, dc: "DC-NJ", type: "operational" },
  { causeCode: "Short Ship (CRED11-F)", channel: "Club", amount: 61800, incidents: 52, dc: "DC-NJ", type: "operational" },
  { causeCode: "Late / Missed Window (CRED11-O)", channel: "Mass Retail", amount: 44834, incidents: 413, dc: "DC-SF", type: "operational" },
  // Post-audit — arrive 8–12mo after incident, hard to dispute
  { causeCode: "Post-Audit Claim (CRED12)", channel: "Mass Retail", amount: 356000, incidents: 89, dc: "Various", type: "post-audit" },
  { causeCode: "Post-Audit Claim (CRED12)", channel: "Drug Chain", amount: 254000, incidents: 67, dc: "Various", type: "post-audit" },
  // Damage — warehouse handling, NJ 2.5× SF rate
  { causeCode: "Damage Allowance", channel: "All Channels", amount: 869000, incidents: 0, dc: "DC-NJ (×2.5 SF)", type: "damage" },
];

export const customerPenalties: CustomerPenalty[] = [
  { customerId: "MDO100A", customerName: "Dollar General Corp", amount: 126000, incidents: 112 },
  { customerId: "MVS200A", customerName: "Vitamin Shoppe", amount: 107000, incidents: 89 },
  { customerId: "MCV300A", customerName: "CVS Pharmacy", amount: 47000, incidents: 41 },
  { customerId: "MWM400A", customerName: "Walmart", amount: 47000, incidents: 38 },
  { customerId: "MWG500A", customerName: "Walgreens", amount: 46000, incidents: 37 },
];

// ─── Alerts ──────────────────────────────────────────────────────────────────

export const alertsData: AlertItem[] = [
  {
    id: 1,
    severity: "critical",
    sku: "F-04130",
    product: "Ginger Chews Plus+ Orig 3oz",
    dc: "DC-NJ",
    daysLeft: 8,
    urgentRequestCount: 4,
    message: "DC-NJ estimated at 8 days of supply at current 184 units/day burn rate. NJ demand has grown 286% since 2023 — purchasing still on old pattern. Transfer 2,571 units from DC-SF now to prevent split-ship on next Mass channel order.",
  },
  {
    id: 2,
    severity: "critical",
    sku: "T-31510",
    product: "Tiger Balm 18g Ultra",
    dc: "DC-NJ",
    daysLeft: 98,
    urgentRequestCount: 0,
    message: "Aggregate view: 272 days of supply company-wide. Hidden risk: NJ sold 282,625 units in 2025 but received only 151,427 from suppliers. Safety stock has absorbed a 131,198-unit deficit (169 days of NJ demand). Trajectory is not sustainable without PO course-correction to NJ.",
  },
  {
    id: 3,
    severity: "warning",
    sku: "T-32206",
    product: "Tiger Balm Patch Warm",
    dc: "DC-NJ",
    daysLeft: 88,
    message: "DC-NJ at 88 days vs. DC-SF at 246 days. Inbound PO due May 15 to NJ. 81.5% of POs arrive late by avg 28 days — if delayed, NJ drops to ~60d with no immediate relief.",
  },
];

// ─── Transfer Recommendations ─────────────────────────────────────────────────
// Freight rates from actual ledger: SF→NJ $0.51/unit, SF→LA $0.17/unit
// Reverse routes (back to SF) $1.55/unit — avoid except in extreme cases
// 3-yr inter-DC freight baseline: $1.49M across 827 transfers (~$497K/yr)
// SF is the hub — check SF first for any NJ or LA shortage

export const transferRecs: TransferRec[] = [
  {
    // PRIMARY DEMO — real numbers
    id: 1,
    sku: "F-04130",
    product: "Ginger Chews Plus+ Orig 3oz",
    from: "DC-SF (Hub)",
    to: "DC-NJ",
    qty: 2571,
    freightRatePerUnit: 0.51,
    freightCost: 1043,
    chargebackRisk: 1702,
    netSaving: 659,
    recommendation: "TRANSFER",
    urgency: "critical",
    inboundEta: "2026-05-08",
    poLeadTimeNote: "PO arrives May 8 — 21 days away. DC-NJ has 8 days. PO lead time risk: 81.5% of POs arrive late by avg 28d. May 8 ETA is not reliable.",
    reasoning: "SF has 126 days of supply vs. NJ's 8. NJ demand has tripled since 2023 — PO allocation is based on outdated volumes. Freight to NJ at $0.51/unit = $1,043 for 2,571 units. Chargeback exposure if NJ stockouts on next Mass Retail order: $1,702. Net savings: $659. Transfer immediately; don't wait for the May 8 PO.",
  },
  {
    id: 2,
    sku: "T-31510",
    product: "Tiger Balm 18g Ultra",
    from: "DC-SF (Hub)",
    to: "DC-NJ",
    qty: 60000,
    freightRatePerUnit: 0.51,
    freightCost: 30600,
    chargebackRisk: 4180,
    netSaving: -26420, // freight exceeds CB risk for this single order
    recommendation: "WAIT",
    urgency: "critical",
    inboundEta: null,
    poLeadTimeNote: "No open PO on file for NJ. Recommend routing next inbound container to NJ rather than SF.",
    reasoning: "NJ has 98 days of estimated supply — not an immediate stockout. The risk is trajectory: 2025 proved supply can't sustain NJ's burn rate. Transferring 60K units from SF costs $30,600 in freight — more than the near-term CB exposure. Instead, flag next inbound PO for NJ routing. This is a procurement correction, not a transfer case.",
  },
  {
    id: 3,
    sku: "T-32206",
    product: "Tiger Balm Patch Warm",
    from: "DC-SF (Hub)",
    to: "DC-NJ",
    qty: 8000,
    freightRatePerUnit: 0.51,
    freightCost: 4080,
    chargebackRisk: 860,
    netSaving: -3220,
    recommendation: "WAIT",
    urgency: "warning",
    inboundEta: "2026-05-15",
    poLeadTimeNote: "PO due May 15 to NJ. If late by avg 28d = June 12. NJ at 88d would reach 0 around July 14. Transfer not yet justified.",
    reasoning: "NJ has 88 days — enough buffer to wait for the May 15 inbound PO before acting. If PO is flagged delayed (as 81.5% of POs are), set a 30-day countdown trigger: if NJ falls below 30d supply with no confirmed PO, initiate SF→NJ transfer at $0.51/unit.",
  },
];

// ─── Urgent requests — sample from the 889 URGENT rows in the real spreadsheet ─

export const urgentRequestSample: UrgentRequest[] = [
  { id: "5701", sku: "A-61011", product: "Am. Ginseng (bulk)", qty: "50 cases", note: "URGENT! OUT OF STOCK", date: "2024-03-14" },
  { id: "5712", sku: "F-04130", product: "Ginger Chews Plus+ Orig 3oz", qty: "4 pallets", note: "Urgent", date: "2024-06-02" },
  { id: "5718", sku: "F-04130", product: "Ginger Chews Plus+ Orig 3oz", qty: "2 pallets", note: "URGENT ASAP please", date: "2024-08-19" },
  { id: "5734", sku: "T-31510", product: "Tiger Balm 18g Ultra", qty: "3 pallets", note: "OUT OF STOCK at NJ - urgent!", date: "2024-09-05" },
  { id: "5751", sku: "F-04130", product: "Ginger Chews Plus+ Orig 3oz", qty: "6 pallets", note: "URGENT - Dollar General order", date: "2024-11-12" },
  { id: "5769", sku: "T-32206", product: "Tiger Balm Patch Warm", qty: "2 pallets", note: "Urgent transfer needed NJ", date: "2025-01-08" },
  { id: "5782", sku: "F-04130", product: "Ginger Chews Plus+ Orig 3oz", qty: "3 pallets", note: "ASAP!! NJ needs stock", date: "2025-02-21" },
  { id: "5803", sku: "A-61011", product: "Am. Ginseng (bulk)", qty: "30 cases", note: "OUT OF STOCK", date: "2025-03-10" },
];
