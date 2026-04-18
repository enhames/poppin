import json
import os
import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS
from transfer_logic import parse_inventory_json

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(__file__)
TRANSFERS_LOG = os.path.join(BASE_DIR, "transfers_log.json")
INVENTORY_JSON = os.path.join(BASE_DIR, "live_inventory.json")

DC_SITE_TO_LABEL = {
    "Site 1 - SF": "DC-SF · Livermore",
    "Site 2 - NJ": "DC-NJ · New Jersey",
    "Site 3 - LA": "DC-LA · Los Angeles",
}
DC_SITE_TO_ROLE = {
    "Site 1 - SF": "Hub",
    "Site 2 - NJ": "Primary",
    "Site 3 - LA": "Regional",
}


@app.before_request
def log_api_request():
    if request.path.startswith("/api"):
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[API REQUEST] {now} | {request.method} {request.path}")


@app.after_request
def log_api_response(response):
    if request.path.startswith("/api"):
        print(f"[API RESPONSE] {request.method} {request.path} -> {response.status_code}")
    return response


def load_inventory():
    with open(INVENTORY_JSON, encoding="utf-8") as f:
        return json.load(f)


def save_inventory(data):
    with open(INVENTORY_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)


def load_transfers_log():
    if not os.path.exists(TRANSFERS_LOG):
        return []
    with open(TRANSFERS_LOG, encoding="utf-8") as f:
        return json.load(f)


def resolve_sku_key(items, sku):
    if sku in items:
        return sku
    stripped = sku.strip()
    matches = [k for k in items.keys() if k.strip() == stripped]
    return matches[0] if len(matches) == 1 else None


def generate_alerts(inventory, max_items=12):
    alerts = []
    items = inventory.get("ITEMS", {})

    for sku, item in items.items():
        demand = float(item.get("avg_daily_demand", 0) or 0)
        if demand <= 0:
            continue
        inv_by_dc = item.get("inventory_by_dc", {})
        for dc_name, dc_data in inv_by_dc.items():
            days = int(dc_data.get("days_of_supply", 9999) or 9999)
            if days >= 14:
                continue
            stock = int(dc_data.get("stock_on_hand", 0) or 0)
            incoming = int(dc_data.get("incoming_stock", 0) or 0)
            severity = "critical" if days < 7 else "warning"
            alerts.append(
                {
                    "severity": severity,
                    "sku": sku.strip(),
                    "product": item.get("item_name", sku),
                    "dc": DC_SITE_TO_LABEL.get(dc_name, dc_name),
                    "daysLeft": days,
                    "message": (
                        f"{DC_SITE_TO_LABEL.get(dc_name, dc_name)} has {stock:,} on hand, "
                        f"{incoming:,} incoming, and ~{demand:.2f}/day demand."
                    ),
                }
            )

    alerts.sort(key=lambda a: (0 if a["severity"] == "critical" else 1, a["daysLeft"]))
    top_alerts = alerts[:max_items]
    for i, alert in enumerate(top_alerts, start=1):
        alert["id"] = i
    return top_alerts


def build_dashboard_summary(inventory, recommendations):
    items = inventory.get("ITEMS", {})
    transfers_log = load_transfers_log()

    dc_stock = {"Site 1 - SF": 0, "Site 2 - NJ": 0, "Site 3 - LA": 0}
    pending_inbound_pos = 0
    for item in items.values():
        for dc_name, dc in item.get("inventory_by_dc", {}).items():
            stock = int(dc.get("stock_on_hand", 0) or 0)
            incoming = int(dc.get("incoming_stock", 0) or 0)
            dc_stock[dc_name] = dc_stock.get(dc_name, 0) + stock
            if incoming > 0:
                pending_inbound_pos += 1

    total_stock = sum(dc_stock.values()) or 1
    dc_distribution = []
    for dc_name in ["Site 1 - SF", "Site 2 - NJ", "Site 3 - LA"]:
        share_pct = round((dc_stock.get(dc_name, 0) / total_stock) * 100, 1)
        dc_distribution.append(
            {
                "site": dc_name,
                "name": DC_SITE_TO_LABEL[dc_name],
                "role": DC_SITE_TO_ROLE[dc_name],
                "sharePct": share_pct,
                "stockOnHand": dc_stock.get(dc_name, 0),
            }
        )

    transfer_recs = [r for r in recommendations if r.get("recommendation") == "TRANSFER"]
    penalty_exposure = round(sum(float(r.get("avoided_penalty", 0) or 0) for r in transfer_recs), 2)
    estimated_net_savings = round(sum(float(r.get("transfer_value", 0) or 0) for r in transfer_recs), 2)

    return {
        "urgentRequestTotal": len(transfers_log),
        "penaltyExposure": penalty_exposure,
        "transferRecommendedCount": len(transfer_recs),
        "estimatedNetSavings": estimated_net_savings,
        "pendingInboundPos": pending_inbound_pos,
        "dcDistribution": dc_distribution,
    }


def build_scenario(recommendations):
    transfer_recs = [r for r in recommendations if r.get("recommendation") == "TRANSFER"]
    if not transfer_recs:
        return None
    top = max(transfer_recs, key=lambda r: float(r.get("transfer_value", 0) or 0))
    return {
        "sku": top.get("sku"),
        "product": top.get("item_name"),
        "sourceDc": top.get("source_dc"),
        "destinationDc": top.get("destination_dc"),
        "transferUnits": float(top.get("transfer_units", 0) or 0),
        "transferCost": float(top.get("transfer_cost", 0) or 0),
        "penaltyExposure": float(top.get("avoided_penalty", 0) or 0),
        "netSaving": float(top.get("transfer_value", 0) or 0),
    }


def apply_transfer_to_inventory(payload):
    inventory = load_inventory()
    items = inventory.get("ITEMS", {})
    sku_key = resolve_sku_key(items, payload["sku"])
    if sku_key is None:
        return None, f"SKU not found in inventory: {payload['sku']}"

    item = items[sku_key]
    source_dc = payload["source_dc"]
    destination_dc = payload["destination_dc"]

    if source_dc not in item["inventory_by_dc"] or destination_dc not in item["inventory_by_dc"]:
        return None, "Source or destination DC not found for SKU."

    units = int(float(payload["units"]))
    if units <= 0:
        return None, "Transfer units must be positive."

    source_slot = item["inventory_by_dc"][source_dc]
    dest_slot = item["inventory_by_dc"][destination_dc]

    source_stock = int(source_slot.get("stock_on_hand", 0) or 0)
    if units > source_stock:
        return None, (
            f"Insufficient stock at source ({source_dc}). Requested {units}, available {source_stock}."
        )

    source_slot["stock_on_hand"] = source_stock - units
    dest_slot["stock_on_hand"] = int(dest_slot.get("stock_on_hand", 0) or 0) + units

    demand = float(item.get("avg_daily_demand", 0) or 0)
    for slot in (source_slot, dest_slot):
        stock = int(slot.get("stock_on_hand", 0) or 0)
        slot["days_of_supply"] = int(stock / demand) if demand > 0 else 9999

    save_inventory(inventory)
    return inventory, None


# ── Static data (derived from historical chargeback analysis) ─────────────────

ALERTS_DATA = [
    {
        "id": 1, "severity": "critical", "sku": "F-04211",
        "product": "POP Ginger Chews Original 2 oz", "dc": "All DCs", "daysLeft": 1,
        "urgentRequestCount": 6,
        "message": "All three DCs are at 0–1 day of supply. Demand is 3,212 units/day. Large incoming POs are in transit to all DCs (SF: 10K, NJ: 53K, LA: 14K). Monitor inbound arrival closely; any delay creates an immediate stockout.",
    },
    {
        "id": 2, "severity": "critical", "sku": "F-04117",
        "product": "POP Ginger Chews Blood Orange 4 oz", "dc": "DC-NJ", "daysLeft": 4,
        "urgentRequestCount": 3,
        "message": "DC-NJ at 4 days of supply with 234 units/day demand. DC-SF has 104 days on-hand (24,393 units). NJ has 82,852 incoming units in transit — but transit timing is uncertain. Transfer 6,084 units from SF to NJ now to bridge the gap. Freight cost $0.51/unit = $3,103.",
    },
    {
        "id": 3, "severity": "critical", "sku": "J-72402",
        "product": "Totole Chicken Bouillon 2.2 lbs", "dc": "DC-NJ", "daysLeft": 1,
        "message": "DC-NJ has only 48 units on hand with 26.95 units/day demand — less than 2 days of supply. No incoming stock on file for NJ. DC-SF has 6,094 units (226 days). Transfer 783 units SF→NJ immediately ($399 freight vs. ~$680 chargeback exposure).",
    },
    {
        "id": 4, "severity": "warning", "sku": "T-31520",
        "product": "Tiger Balm Ultra 10g", "dc": "DC-SF / DC-LA", "daysLeft": 4,
        "message": "DC-SF at 2 days, DC-LA at 6 days. Both have large inbound POs (SF: 77K units, LA: 70K units). DC-NJ is at 15 days with 135K incoming. Watch inbound arrival — if POs are delayed (avg 81.5% arrive late), SF and LA will stockout before replenishment.",
    },
]

CHARGEBACK_DATA = {
    "causeCodeRows": [
        {"causeCode": "CRED11-F", "channel": "Various Channels", "amount": 250230, "incidents": 295, "dc": "DC-NJ", "type": "operational"},
        {"causeCode": "CRED11-O", "channel": "Various Channels", "amount": 189404, "incidents": 480, "dc": "DC-NJ", "type": "operational"},
        {"causeCode": "CRED12",   "channel": "Various Channels", "amount": 642550, "incidents": 451, "dc": "Various", "type": "post-audit"},
        {"causeCode": "CRED08",   "channel": "All Channels",     "amount": 1128041, "incidents": 4286, "dc": "DC-NJ (×2.5 SF)", "type": "damage"},
    ],
    "customerPenalties": [
        {"customerId": "WAO556A", "customerName": "KeHE Distributors, LLC",            "amount": 400297, "incidents": 323},
        {"customerId": "MDO100A", "customerName": "Dollar General Corp",                "amount": 152575, "incidents": 116},
        {"customerId": "MAM803A", "customerName": "Amazon.com Services, Inc.",          "amount": 81974,  "incidents": 106},
        {"customerId": "EUNI12A", "customerName": "United Natural Foods, Inc. — East", "amount": 76206,  "incidents": 68},
        {"customerId": "MRE800A", "customerName": "CVS Distribution Inc.",              "amount": 58655,  "incidents": 113},
    ],
    "yearlyPenalties": [
        {"year": "2023", "operational": 32255,  "postAudit": 32528,  "damage": 85036},
        {"year": "2024", "operational": 252025, "postAudit": 356425, "damage": 466141, "peakMonth": "Aug 2024", "peakMonthAmount": 110583},
        {"year": "2025", "operational": 155354, "postAudit": 253597, "damage": 576864},
    ],
}


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "yuh"})


@app.route("/recommendations", methods=["GET"])
def get_recommendations_legacy():
    # Legacy path kept for compatibility; frontend uses /api/recommendations.
    inventory = load_inventory()
    recs = parse_inventory_json(inventory)
    return jsonify(recs)


@app.route("/api/recommendations")
def get_recommendations():
    inventory = load_inventory()
    recs = parse_inventory_json(inventory)
    return jsonify(recs)


@app.route("/api/inventory")
def get_inventory():
    return jsonify(load_inventory())


@app.route("/api/alerts")
def get_alerts():
    inventory = load_inventory()
    return jsonify(generate_alerts(inventory))


@app.route("/api/chargebacks")
def get_chargebacks():
    return jsonify(CHARGEBACK_DATA)


@app.route("/api/transfers", methods=["POST"])
def approve_transfer():
    payload = request.get_json(force=True)
    required = {"sku", "item_name", "source_dc", "destination_dc", "units"}
    if not required.issubset(payload.keys()):
        return jsonify({"error": f"Missing fields: {required - payload.keys()}"}), 400

    inventory, apply_error = apply_transfer_to_inventory(payload)
    if apply_error:
        return jsonify({"error": apply_error}), 400

    entry = {
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "sku": payload["sku"],
        "item_name": payload["item_name"],
        "source_dc": payload["source_dc"],
        "destination_dc": payload["destination_dc"],
        "units": payload["units"],
    }

    log = load_transfers_log()
    log.append(entry)
    with open(TRANSFERS_LOG, "w", encoding="utf-8") as f:
        json.dump(log, f, indent=2)

    print(f"[TRANSFER APPROVED] {entry['sku']} | {entry['source_dc']} → {entry['destination_dc']} | {entry['units']} units | {entry['timestamp']}")
    return jsonify({"status": "logged", "entry": entry, "inventory_updated": True}), 201


@app.route("/api/dashboard/summary")
def get_dashboard_summary():
    inventory = load_inventory()
    recs = parse_inventory_json(inventory)
    return jsonify(build_dashboard_summary(inventory, recs))


@app.route("/api/dashboard/scenario")
def get_dashboard_scenario():
    inventory = load_inventory()
    recs = parse_inventory_json(inventory)
    scenario = build_scenario(recs)
    return jsonify({"scenario": scenario})


if __name__ == "__main__":
    app.run(port=5002, debug=True)
