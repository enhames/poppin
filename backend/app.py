import json
import os
import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(__file__)
TRANSFERS_LOG = os.path.join(BASE_DIR, "transfers_log.json")

FREIGHT_RATES = {
    ("Site 1 - SF", "Site 2 - NJ"): 0.51,
    ("Site 1 - SF", "Site 3 - LA"): 0.17,
    ("Site 2 - NJ", "Site 3 - LA"): 1.55,
    ("Site 3 - LA", "Site 2 - NJ"): 1.55,
    ("Site 2 - NJ", "Site 1 - SF"): 1.55,
    ("Site 3 - LA", "Site 1 - SF"): 1.55,
}

SITES = ["Site 1 - SF", "Site 2 - NJ", "Site 3 - LA"]
TARGET_DOS = 30
CRITICAL_THRESHOLD = 14


def load_inventory():
    with open(os.path.join(BASE_DIR, "live_inventory.json")) as f:
        return json.load(f)


def make_recommendation(sku, item_name, source_dc, destination_dc,
                         transfer_units, transfer_cost,
                         expected_penalty_without_transfer,
                         expected_penalty_with_transfer):
    net_value = round(expected_penalty_without_transfer - expected_penalty_with_transfer - transfer_cost, 2)
    return {
        "sku": sku,
        "item_name": item_name,
        "source_dc": source_dc,
        "destination_dc": destination_dc,
        "recommendation": "TRANSFER" if net_value > 0 else "WAIT",
        "transfer_units": round(transfer_units, 2),
        "transfer_cost": round(transfer_cost, 2),
        "net_value": net_value,
        "expected_penalty_without_transfer": round(expected_penalty_without_transfer, 2),
        "expected_penalty_with_transfer": round(expected_penalty_with_transfer, 2),
    }


def generate_recommendations(inventory):
    metadata = inventory["METADATA"]
    avg_penalty = metadata["avg_penalty_cost"]
    recs = []
    seen = set()

    for sku, item in inventory["ITEMS"].items():
        demand = item["avg_daily_demand"]
        if demand == 0:
            continue

        dc_data = item["inventory_by_dc"]

        for low_dc in SITES:
            if low_dc not in dc_data:
                continue
            low_info = dc_data[low_dc]
            if low_info["days_of_supply"] >= CRITICAL_THRESHOLD:
                continue

            for high_dc in SITES:
                if high_dc == low_dc:
                    continue
                if high_dc not in dc_data:
                    continue
                high_info = dc_data[high_dc]
                if high_info["stock_on_hand"] <= 0:
                    continue

                rate = FREIGHT_RATES.get((high_dc, low_dc))
                if rate is None:
                    continue

                key = (sku, high_dc, low_dc)
                if key in seen:
                    continue
                seen.add(key)

                units_needed = max(0, (TARGET_DOS - low_info["days_of_supply"]) * demand)
                units_to_transfer = min(units_needed, high_info["stock_on_hand"] * 0.5)
                if units_to_transfer <= 0:
                    continue

                transfer_cost = units_to_transfer * rate
                missing_days = max(0, CRITICAL_THRESHOLD - low_info["days_of_supply"])
                expected_penalty_without = missing_days * demand * avg_penalty
                expected_penalty_with = 0.0

                rec = make_recommendation(
                    sku,
                    item["item_name"],
                    high_dc,
                    low_dc,
                    units_to_transfer,
                    transfer_cost,
                    expected_penalty_without,
                    expected_penalty_with,
                )
                recs.append(rec)
                break

    return recs


# ── Static data (previously in mockData.ts) ──────────────────────────────────

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

@app.route("/api/recommendations")
def get_recommendations():
    inventory = load_inventory()
    recs = generate_recommendations(inventory)
    return jsonify(recs)


@app.route("/api/inventory")
def get_inventory():
    return jsonify(load_inventory())


@app.route("/api/alerts")
def get_alerts():
    return jsonify(ALERTS_DATA)


@app.route("/api/chargebacks")
def get_chargebacks():
    return jsonify(CHARGEBACK_DATA)


@app.route("/api/transfers", methods=["POST"])
def approve_transfer():
    payload = request.get_json(force=True)
    required = {"sku", "item_name", "source_dc", "destination_dc", "units"}
    if not required.issubset(payload.keys()):
        return jsonify({"error": f"Missing fields: {required - payload.keys()}"}), 400

    entry = {
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "sku": payload["sku"],
        "item_name": payload["item_name"],
        "source_dc": payload["source_dc"],
        "destination_dc": payload["destination_dc"],
        "units": payload["units"],
    }

    log = []
    if os.path.exists(TRANSFERS_LOG):
        with open(TRANSFERS_LOG) as f:
            log = json.load(f)
    log.append(entry)
    with open(TRANSFERS_LOG, "w") as f:
        json.dump(log, f, indent=2)

    print(f"[TRANSFER APPROVED] {entry['sku']} | {entry['source_dc']} → {entry['destination_dc']} | {entry['units']} units | {entry['timestamp']}")
    return jsonify({"status": "logged", "entry": entry}), 201


if __name__ == "__main__":
    app.run(port=5001, debug=True)
