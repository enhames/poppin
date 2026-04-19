import pandas as pd
import json
import os

# Paths
sales_csv = "data/POP_SalesTransactionHistory.csv"
inv_excel = "data/POP_InventorySnapshot.xlsx"
po_excel = "data/POP_PurchaseOrderHistory.XLSX"
cost_excel = "data/POP_ChargeBack_Deductions_Penalties_Freight.xlsx"
item_spec_csv = "data/POP_ItemSpecMaster.xlsx - Item Spec Master.csv"

# Hardcoded defaults for SKUs missing from ItemSpecMaster.
# Values are guesses rn
default_cases_per_pallet_by_sku = {
    "AC-B3SLJ": 16,
    "AC-B6SLJ": 16,
    "AC-B9SL": 16,
    "A-61012": 24,
    "A-61280": 24,
    "AC-B9SLE": 16,
    "F-00491": 126,
    "F-04220": 70,
    "F-04221": 70,
    "F-50139": 60,
    "F-50140": 36,
    "F-76010": 42,
    "F-97000": 84,
    "T-31510R": 72,
    "T-32224": 56,
    "T-47010": 120,
}


def parse_cases_per_pallet(value):
    text = str(value).strip()
    if not text or text.lower() in {"nan", "none", "n/a"}:
        return None
    numeric = "".join(ch for ch in text if ch.isdigit() or ch == ".")
    if not numeric:
        return None
    parsed = float(numeric)
    return int(parsed) if parsed.is_integer() else parsed

# 1. CALCULATE DEMAND
sales_df = pd.read_csv(sales_csv, low_memory=False)
demand_df = sales_df.groupby('ITEMNMBR')['QUANTITY_adj'].sum().reset_index()
demand_df['Daily_Demand'] = (demand_df['QUANTITY_adj'] / 1095).round(2)
demand_dict = dict(zip(demand_df['ITEMNMBR'], demand_df['Daily_Demand']))

# 2. CALCULATE INCOMING POs
po_df = pd.read_excel(po_excel)
po_df['Location Code'] = po_df['Location Code'].astype(str).str.strip()
po_df['Item Number'] = po_df['Item Number'].astype(str).str.strip()
incoming_df = po_df.groupby(['Item Number', 'Location Code'])['QTY Shipped'].sum().reset_index()
po_dict = dict(zip(zip(incoming_df['Item Number'], incoming_df['Location Code']), incoming_df['QTY Shipped']))

# PO ETA reliability and delay probability by location and SKU/location.
po_df['Required Date'] = pd.to_datetime(po_df['Required Date'], errors='coerce')
po_df['Receipt Date'] = pd.to_datetime(po_df['Receipt Date'], errors='coerce')
po_history_df = po_df.dropna(subset=['Required Date', 'Receipt Date']).copy()

default_eta_reliability = 1.0
default_delay_probability = 0.0
default_avg_delay_days = 0.0
po_eta_reliability_by_location = {}
po_delay_probability_by_location = {}
po_avg_delay_days_by_location = {}
po_eta_reliability_by_item_location = {}
po_delay_probability_by_item_location = {}
po_avg_delay_days_by_item_location = {}

if not po_history_df.empty:
    po_history_df['delay_days'] = (
        po_history_df['Receipt Date'] - po_history_df['Required Date']
    ).dt.days
    po_history_df['is_delayed'] = po_history_df['delay_days'] > 0
    po_history_df['delay_days_positive'] = po_history_df['delay_days'].clip(lower=0)
    po_history_df['is_on_time'] = ~po_history_df['is_delayed']

    location_stats_df = (
        po_history_df
        .groupby('Location Code')
        .agg(
            completed_pos=('PO Number', 'count'),
            on_time_rate=('is_on_time', 'mean'),
            delay_probability=('is_delayed', 'mean'),
            avg_delay_days=('delay_days_positive', 'mean'),
        )
        .reset_index()
    )

    po_eta_reliability_by_location = {
        row['Location Code']: float(row['on_time_rate'])
        for _, row in location_stats_df.iterrows()
    }
    po_delay_probability_by_location = {
        row['Location Code']: float(row['delay_probability'])
        for _, row in location_stats_df.iterrows()
    }
    po_avg_delay_days_by_location = {
        row['Location Code']: float(row['avg_delay_days'])
        for _, row in location_stats_df.iterrows()
    }

    item_location_stats_df = (
        po_history_df
        .groupby(['Item Number', 'Location Code'])
        .agg(
            completed_pos=('PO Number', 'count'),
            on_time_rate=('is_on_time', 'mean'),
            delay_probability=('is_delayed', 'mean'),
            avg_delay_days=('delay_days_positive', 'mean'),
        )
        .reset_index()
    )

    po_eta_reliability_by_item_location = {
        (row['Item Number'], row['Location Code']): float(row['on_time_rate'])
        for _, row in item_location_stats_df.iterrows()
    }
    po_delay_probability_by_item_location = {
        (row['Item Number'], row['Location Code']): float(row['delay_probability'])
        for _, row in item_location_stats_df.iterrows()
    }
    po_avg_delay_days_by_item_location = {
        (row['Item Number'], row['Location Code']): float(row['avg_delay_days'])
        for _, row in item_location_stats_df.iterrows()
    }

    default_eta_reliability = float(po_history_df['is_on_time'].mean())
    default_delay_probability = float(po_history_df['is_delayed'].mean())
    default_avg_delay_days = float(po_history_df['delay_days_positive'].mean())

# 3. CALCULATE COSTS (The "Brain" Constants)
penalty_df = pd.read_excel(cost_excel, sheet_name='Data-Penalty')
transfer_df = pd.read_excel(cost_excel, sheet_name='Data-Transfer Cost')


#ADDED THIS SO IT CAN RUN
penalty_df['Extended Price'] = pd.to_numeric(
    penalty_df['Extended Price'].astype(str).str.replace("$", "", regex=False).str.replace(",", "", regex=False),
    errors='coerce',
)
transfer_df['Amount'] = pd.to_numeric(
    transfer_df['Amount'].astype(str).str.replace("$", "", regex=False).str.replace(",", "", regex=False),
    errors='coerce',
)

# transfer stuff
avg_penalty = float(penalty_df['Extended Price'].mean())
transfer_df['From'] = transfer_df['From'].astype(str).str.strip().str.upper()
transfer_df['To'] = transfer_df['To'].astype(str).str.strip().str.upper()
transfer_df['Carrier'] = transfer_df['Carrier'].astype(str).str.strip().str.upper()
valid_transfer_df = transfer_df.dropna(subset=['From', 'To', 'Amount'])
jk_transfer_df = valid_transfer_df[valid_transfer_df['Carrier'] == 'JK']
jk_lane_avg_df = (
    jk_transfer_df
    .groupby(['From', 'To'])['Amount']
    .mean()
    .round(2)
    .reset_index()
)
priority1_transfer_df = valid_transfer_df[
    (valid_transfer_df['Carrier'] == 'PRIORITY 1')
    & ((valid_transfer_df['From'] == 'NJ') | (valid_transfer_df['To'] == 'NJ'))
]
priority1_lane_avg_df = (
    priority1_transfer_df
    .groupby(['From', 'To'])['Amount']
    .mean()
    .round(2)
    .reset_index()
)
jk_transfer_cost_by_lane = {
    f"{row['From']}->{row['To']}": float(row['Amount'])
    for _, row in jk_lane_avg_df.iterrows()
    if row['From'] and row['To'] and row['From'] != 'NAN' and row['To'] != 'NAN'
}
priority1_nj_transfer_cost_by_lane = {
    f"{row['From']}->{row['To']}": float(row['Amount'])
    for _, row in priority1_lane_avg_df.iterrows()
    if row['From'] and row['To'] and row['From'] != 'NAN' and row['To'] != 'NAN'
}
transfer_cost_by_lane_by_pallet = {
    **jk_transfer_cost_by_lane,
    **{
        lane: cost
        for lane, cost in priority1_nj_transfer_cost_by_lane.items()
        if lane not in jk_transfer_cost_by_lane
    },
}

# item spec master (cases per pallet by SKU)
item_spec_df = pd.read_csv(item_spec_csv, low_memory=False)
item_spec_df['Item Number'] = item_spec_df['Item Number'].astype(str).str.strip()
item_spec_df['cases_per_pallet_parsed'] = item_spec_df['Case/ Pallet'].apply(parse_cases_per_pallet)
cases_per_pallet_by_sku = {
    row['Item Number']: row['cases_per_pallet_parsed']
    for _, row in item_spec_df.iterrows()
    if row['Item Number'] and row['Item Number'] != 'nan' and pd.notna(row['cases_per_pallet_parsed'])
}

transfer_cost_by_lane_by_pallet = {
    f"{row['From']}->{row['To']}": float(row['Amount'])
    for row in sorted(
        [{"From": k.split("->")[0], "To": k.split("->")[1], "Amount": v} for k, v in transfer_cost_by_lane_by_pallet.items()],
        key=lambda x: (x['From'], x['To'])
    )
}

# 4. PROCESS INVENTORY
inv_file = pd.ExcelFile(inv_excel)
sites = ['Site 1 - SF', 'Site 2 - NJ', 'Site 3 - LA']
site_code_map = {'Site 1 - SF': '1', 'Site 2 - NJ': '2', 'Site 3 - LA': '3'}

master_inventory = {
    "METADATA": {
        "avg_penalty_cost": round(avg_penalty, 2),
        "transfer_cost_by_lane": transfer_cost_by_lane_by_pallet,
        "default_po_eta_reliability": round(default_eta_reliability, 4),
        "default_po_delay_probability": round(default_delay_probability, 4),
        "default_po_avg_delay_days": round(default_avg_delay_days, 2),
        "po_eta_reliability_by_location": {
            k: round(v, 4) for k, v in po_eta_reliability_by_location.items()
        },
        "po_delay_probability_by_location": {
            k: round(v, 4) for k, v in po_delay_probability_by_location.items()
        },
        "po_avg_delay_days_by_location": {
            k: round(v, 2) for k, v in po_avg_delay_days_by_location.items()
        },
        "recommendation_calc_mode": "new",
        "recommendation_calc_modes_available": ["legacy", "new"],
        "data_coverage": {
            "po_eta_reliability": True,
            "po_delay_probability": True,
            "fda_hold_flags": False,
            "customer_delivery_windows": False,
        },
    },
    "ITEMS": {}
}

requested_calc_mode = os.getenv("RECOMMENDATION_CALC_MODE", "new").strip().lower()
if requested_calc_mode not in {"legacy", "new"}:
    requested_calc_mode = "new"
master_inventory["METADATA"]["recommendation_calc_mode"] = requested_calc_mode

missing_cases_per_pallet_skus = set()

for site in sites:
    site_df = pd.read_excel(inv_file, sheet_name=site)
    site_df['Available'] = site_df['Available'].fillna(0)
    loc_code = site_code_map[site]
    
    for _, row in site_df.iterrows():
        sku = str(row['Item Number'])
        sku_lookup = sku.strip()
        available = float(row['Available'])
        item_loc_key = (sku_lookup, loc_code)
        eta_reliability = po_eta_reliability_by_item_location.get(
            item_loc_key,
            po_eta_reliability_by_location.get(loc_code, default_eta_reliability),
        )
        delay_probability = po_delay_probability_by_item_location.get(
            item_loc_key,
            po_delay_probability_by_location.get(loc_code, default_delay_probability),
        )
        avg_delay_days = po_avg_delay_days_by_item_location.get(
            item_loc_key,
            po_avg_delay_days_by_location.get(loc_code, default_avg_delay_days),
        )
        
        if sku not in master_inventory["ITEMS"]:
            cases_per_pallet = cases_per_pallet_by_sku.get(
                sku_lookup,
                default_cases_per_pallet_by_sku.get(sku_lookup),
            )
            if pd.isna(cases_per_pallet):
                cases_per_pallet = default_cases_per_pallet_by_sku.get(sku_lookup)
            if cases_per_pallet is None:
                missing_cases_per_pallet_skus.add(sku_lookup)
                continue
            master_inventory["ITEMS"][sku] = {
                "item_name": str(row['Description']),
                "avg_daily_demand": demand_dict.get(sku, 0),
                "cases_per_pallet": cases_per_pallet,
                "inventory_by_dc": {}
            }
        
        # Math for Days of Supply
        daily_demand = master_inventory["ITEMS"][sku]["avg_daily_demand"]
        dos = (available / daily_demand) if daily_demand > 0 else 9999
        
        # Inject data
        master_inventory["ITEMS"][sku]["inventory_by_dc"][site] = {
            "stock_on_hand": int(available),
            "incoming_stock": int(po_dict.get((sku, loc_code), 0)),
            "days_of_supply": int(dos),
            "incoming_eta_reliability": round(float(eta_reliability), 4),
            "incoming_delay_probability": round(float(delay_probability), 4),
            "incoming_avg_delay_days": round(float(avg_delay_days), 2),
        }

for sku_data in master_inventory["ITEMS"].values():
    inventory_by_dc = sku_data.get("inventory_by_dc", {})
    total_stock_on_hand = sum(
        int(slot.get("stock_on_hand", 0) or 0) for slot in inventory_by_dc.values()
    )
    total_incoming_stock = sum(
        int(slot.get("incoming_stock", 0) or 0) for slot in inventory_by_dc.values()
    )
    daily_demand = float(sku_data.get("avg_daily_demand", 0) or 0)
    aggregate_days_on_hand = (total_stock_on_hand / daily_demand) if daily_demand > 0 else 9999
    aggregate_days_with_incoming = (
        (total_stock_on_hand + total_incoming_stock) / daily_demand
    ) if daily_demand > 0 else 9999
    sku_data["aggregate_stock_on_hand"] = int(total_stock_on_hand)
    sku_data["aggregate_incoming_stock"] = int(total_incoming_stock)
    sku_data["aggregate_days_of_supply_on_hand"] = int(aggregate_days_on_hand)
    sku_data["aggregate_days_of_supply_with_incoming"] = int(aggregate_days_with_incoming)

# 5. SAVE
#debugging stuff
if missing_cases_per_pallet_skus:
    raise ValueError(
        "Missing cases_per_pallet in ItemSpecMaster or defaults for SKUs: "
        + ", ".join(sorted(missing_cases_per_pallet_skus))
    )

with open("live_inventory.json", "w") as f:
    json.dump(master_inventory, f, indent=4)
