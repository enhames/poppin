export type Status = "critical" | "warning" | "ok";
export type Urgency = "critical" | "warning";

export interface DcSlot {
  onHand: number;
  allocated: number;
  available: number;
  daysSupply: number;
}

export interface SkuRow {
  sku: string;
  product: string;
  category: string;
  unitCost: number;
  dcWest: DcSlot;
  dcEast: DcSlot;
  dcCentral: DcSlot;
  totalDaysSupply: number;
  status: Status;
  chargebackRisk: number;
  inboundPo: { eta: string; qty: number; dc: string } | null;
}

export interface ChargebackRow {
  causeCode: string;
  channel: string;
  amount: number;
  incidents: number;
  dc: string;
  type: "operational" | "promotional";
}

export interface AlertItem {
  id: number;
  severity: Status;
  sku: string;
  product: string;
  dc: string;
  daysLeft: number;
  message: string;
}

export interface TransferRec {
  id: number;
  sku: string;
  product: string;
  from: string;
  to: string;
  qty: number;
  freightCost: number;
  chargebackRisk: number;
  netSaving: number;
  recommendation: "TRANSFER" | "WAIT";
  urgency: Urgency;
  inboundEta: string | null;
  reasoning: string;
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export const inventoryData: SkuRow[] = [
  {
    sku: "TB-170",
    product: "Tiger Balm Red 1.7oz",
    category: "OTC Analgesic",
    unitCost: 4.2,
    dcWest: { onHand: 450, allocated: 180, available: 270, daysSupply: 28 },
    dcEast: { onHand: 12, allocated: 12, available: 0, daysSupply: 0 },
    dcCentral: { onHand: 0, allocated: 0, available: 0, daysSupply: 0 },
    totalDaysSupply: 14,
    status: "critical",
    chargebackRisk: 2400,
    inboundPo: null,
  },
  {
    sku: "AG-4OZ",
    product: "American Ginseng Tea 4oz",
    category: "Herbal Tea",
    unitCost: 8.6,
    dcWest: { onHand: 0, allocated: 0, available: 0, daysSupply: 0 },
    dcEast: { onHand: 0, allocated: 0, available: 0, daysSupply: 0 },
    dcCentral: { onHand: 892, allocated: 200, available: 692, daysSupply: 44 },
    totalDaysSupply: 44,
    status: "critical",
    chargebackRisk: 5100,
    inboundPo: { eta: "2026-05-12", qty: 1200, dc: "DC-East" },
  },
  {
    sku: "GHC-10",
    product: "Ginger Honey Crystals 10-ct",
    category: "Beverage Mix",
    unitCost: 2.4,
    dcWest: { onHand: 180, allocated: 80, available: 100, daysSupply: 12 },
    dcEast: { onHand: 55, allocated: 50, available: 5, daysSupply: 3 },
    dcCentral: { onHand: 10, allocated: 10, available: 0, daysSupply: 0 },
    totalDaysSupply: 8,
    status: "critical",
    chargebackRisk: 1800,
    inboundPo: { eta: "2026-04-22", qty: 600, dc: "DC-West" },
  },
  {
    sku: "TB-30G",
    product: "Tiger Balm White 30g",
    category: "OTC Analgesic",
    unitCost: 6.8,
    dcWest: { onHand: 320, allocated: 100, available: 220, daysSupply: 34 },
    dcEast: { onHand: 28, allocated: 28, available: 0, daysSupply: 0 },
    dcCentral: { onHand: 145, allocated: 60, available: 85, daysSupply: 15 },
    totalDaysSupply: 26,
    status: "warning",
    chargebackRisk: 920,
    inboundPo: { eta: "2026-05-03", qty: 960, dc: "DC-East" },
  },
  {
    sku: "GC-1LB",
    product: "Ginger Chews Original 1lb",
    category: "Candy & Snacks",
    unitCost: 3.85,
    dcWest: { onHand: 200, allocated: 40, available: 160, daysSupply: 18 },
    dcEast: { onHand: 1800, allocated: 320, available: 1480, daysSupply: 82 },
    dcCentral: { onHand: 350, allocated: 90, available: 260, daysSupply: 31 },
    totalDaysSupply: 55,
    status: "warning",
    chargebackRisk: 480,
    inboundPo: { eta: "2026-04-28", qty: 2400, dc: "DC-West" },
  },
  {
    sku: "RC-45",
    product: "Ricola Herb Drops 45ct",
    category: "OTC Cough",
    unitCost: 5.1,
    dcWest: { onHand: 600, allocated: 120, available: 480, daysSupply: 52 },
    dcEast: { onHand: 580, allocated: 140, available: 440, daysSupply: 48 },
    dcCentral: { onHand: 610, allocated: 110, available: 500, daysSupply: 55 },
    totalDaysSupply: 52,
    status: "ok",
    chargebackRisk: 0,
    inboundPo: null,
  },
  {
    sku: "NUT-400",
    product: "Nutella 400g",
    category: "Spreads",
    unitCost: 4.95,
    dcWest: { onHand: 1200, allocated: 300, available: 900, daysSupply: 61 },
    dcEast: { onHand: 840, allocated: 210, available: 630, daysSupply: 42 },
    dcCentral: { onHand: 960, allocated: 240, available: 720, daysSupply: 48 },
    totalDaysSupply: 50,
    status: "ok",
    chargebackRisk: 0,
    inboundPo: null,
  },
];

// ─── Chargebacks ─────────────────────────────────────────────────────────────

export const chargebackData: ChargebackRow[] = [
  { causeCode: "Short Ship", channel: "Mass Retail", amount: 42800, incidents: 38, dc: "DC-East", type: "operational" },
  { causeCode: "Late Delivery", channel: "Drug Chain", amount: 31500, incidents: 27, dc: "DC-West", type: "operational" },
  { causeCode: "Missed Window", channel: "Mass Retail", amount: 28200, incidents: 22, dc: "DC-Central", type: "operational" },
  { causeCode: "TPR Deduction", channel: "Health Food", amount: 19600, incidents: 14, dc: "Various", type: "promotional" },
  { causeCode: "Short Ship", channel: "Club", amount: 15400, incidents: 11, dc: "DC-East", type: "operational" },
  { causeCode: "TPR Deduction", channel: "Mass Retail", amount: 12300, incidents: 9, dc: "Various", type: "promotional" },
  { causeCode: "Damage", channel: "Ethnic Chain", amount: 8900, incidents: 19, dc: "DC-West", type: "operational" },
  { causeCode: "Late Delivery", channel: "eCom", amount: 5200, incidents: 8, dc: "DC-Central", type: "operational" },
];

// ─── Alerts ──────────────────────────────────────────────────────────────────

export const alertsData: AlertItem[] = [
  {
    id: 1,
    severity: "critical",
    sku: "TB-170",
    product: "Tiger Balm Red 1.7oz",
    dc: "DC-East & DC-Central",
    daysLeft: 0,
    message: "Stockout at DC-East and DC-Central. 3 open Walmart orders cannot be fulfilled. Split-ship risk: $2,400.",
  },
  {
    id: 2,
    severity: "critical",
    sku: "AG-4OZ",
    product: "American Ginseng Tea 4oz",
    dc: "DC-West & DC-East",
    daysLeft: 0,
    message: "Zero stock at DC-West and DC-East. All 892 units isolated at DC-Central. Inbound PO not until May 12.",
  },
  {
    id: 3,
    severity: "critical",
    sku: "GHC-10",
    product: "Ginger Honey Crystals 10-ct",
    dc: "DC-East",
    daysLeft: 3,
    message: "DC-East has 3 days of supply remaining. Nearest inbound PO arrives DC-West on Apr 22.",
  },
  {
    id: 4,
    severity: "warning",
    sku: "TB-30G",
    product: "Tiger Balm White 30g",
    dc: "DC-East",
    daysLeft: 0,
    message: "DC-East available inventory: 0 units (all 28 allocated). Inbound PO to DC-East arrives May 3.",
  },
];

// ─── Transfer Recommendations ─────────────────────────────────────────────────

export const transferRecs: TransferRec[] = [
  {
    id: 1,
    sku: "TB-170",
    product: "Tiger Balm Red 1.7oz",
    from: "DC-West",
    to: "DC-East",
    qty: 200,
    freightCost: 840,
    chargebackRisk: 2400,
    netSaving: 1560,
    recommendation: "TRANSFER",
    urgency: "critical",
    inboundEta: null,
    reasoning: "No inbound PO on record. Freight cost ($840) is well below chargeback exposure ($2,400). Transfer 200 units immediately to cover Walmart orders.",
  },
  {
    id: 2,
    sku: "AG-4OZ",
    product: "American Ginseng Tea 4oz",
    from: "DC-Central",
    to: "DC-East",
    qty: 300,
    freightCost: 1260,
    chargebackRisk: 5100,
    netSaving: 3840,
    recommendation: "TRANSFER",
    urgency: "critical",
    inboundEta: "2026-05-12",
    reasoning: "Inbound PO arrives May 12 — 22 days too late for Walmart delivery window (Apr 20). Transfer 300 units from DC-Central now.",
  },
  {
    id: 3,
    sku: "GHC-10",
    product: "Ginger Honey Crystals 10-ct",
    from: "DC-West",
    to: "DC-East",
    qty: 80,
    freightCost: 340,
    chargebackRisk: 1800,
    netSaving: 1460,
    recommendation: "WAIT",
    urgency: "warning",
    inboundEta: "2026-04-22",
    reasoning: "Inbound PO (600 units) arriving DC-West Apr 22 — 5 days away. DC-East has 3 days of supply. Monitor closely; transfer only if PO is delayed.",
  },
  {
    id: 4,
    sku: "TB-30G",
    product: "Tiger Balm White 30g",
    from: "DC-West",
    to: "DC-East",
    qty: 120,
    freightCost: 504,
    chargebackRisk: 920,
    netSaving: 416,
    recommendation: "WAIT",
    urgency: "warning",
    inboundEta: "2026-05-03",
    reasoning: "Inbound PO arrives DC-East May 3. Margin is thin ($416 net saving). Recommend waiting unless a high-priority order arrives at DC-East before then.",
  },
];
