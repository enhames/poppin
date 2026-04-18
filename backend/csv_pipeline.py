import pandas as pd
import json

# Paths
sales_csv = "data/POP_SalesTransactionHistory.csv"
inv_excel = "data/POP_InventorySnapshot.xlsx"
po_excel = "data/POP_PurchaseOrderHistory.XLSX"
cost_excel = "data/POP_ChargeBack_Deductions_Penalties_Freight.xlsx"

# 1. CALCULATE DEMAND
sales_df = pd.read_csv(sales_csv, low_memory=False)
demand_df = sales_df.groupby('ITEMNMBR')['QUANTITY_adj'].sum().reset_index()
demand_df['Daily_Demand'] = (demand_df['QUANTITY_adj'] / 1095).round(2)
demand_dict = dict(zip(demand_df['ITEMNMBR'], demand_df['Daily_Demand']))

# 2. CALCULATE INCOMING POs
po_df = pd.read_excel(po_excel)
po_df['Location Code'] = po_df['Location Code'].astype(str)
incoming_df = po_df.groupby(['Item Number', 'Location Code'])['QTY Shipped'].sum().reset_index()
po_dict = dict(zip(zip(incoming_df['Item Number'], incoming_df['Location Code']), incoming_df['QTY Shipped']))

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
lane_avg_df = (
    transfer_df.dropna(subset=['From', 'To', 'Amount'])
    .groupby(['From', 'To'])['Amount']
    .mean()
    .round(2)
    .reset_index()
)
transfer_cost_by_lane_by_pallet = {
    f"{row['From']}->{row['To']}": float(row['Amount'])
    for _, row in lane_avg_df.iterrows()
    if row['From'] and row['To'] and row['From'] != 'NAN' and row['To'] != 'NAN'
}

# 4. PROCESS INVENTORY
inv_file = pd.ExcelFile(inv_excel)
sites = ['Site 1 - SF', 'Site 2 - NJ', 'Site 3 - LA']
site_code_map = {'Site 1 - SF': '1', 'Site 2 - NJ': '2', 'Site 3 - LA': '3'}

master_inventory = {
    "METADATA": {
        "avg_penalty_cost": round(avg_penalty, 2),
        "transfer_cost_by_lane": transfer_cost_by_lane
    },
    "ITEMS": {}
}

for site in sites:
    site_df = pd.read_excel(inv_file, sheet_name=site)
    site_df['Available'] = site_df['Available'].fillna(0)
    loc_code = site_code_map[site]
    
    for _, row in site_df.iterrows():
        sku = str(row['Item Number'])
        available = float(row['Available'])
        
        if sku not in master_inventory["ITEMS"]:
            master_inventory["ITEMS"][sku] = {
                "item_name": str(row['Description']),
                "avg_daily_demand": demand_dict.get(sku, 0),
                "inventory_by_dc": {}
            }
        
        # Math for Days of Supply
        daily_demand = master_inventory["ITEMS"][sku]["avg_daily_demand"]
        dos = (available / daily_demand) if daily_demand > 0 else 9999
        
        # Inject data
        master_inventory["ITEMS"][sku]["inventory_by_dc"][site] = {
            "stock_on_hand": int(available),
            "incoming_stock": int(po_dict.get((sku, loc_code), 0)),
            "days_of_supply": int(dos)
        }

# 5. SAVE
with open("live_inventory.json", "w") as f:
    json.dump(master_inventory, f, indent=4)
