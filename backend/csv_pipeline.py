import pandas as pd
import json

print("🚀 Building the Master Inventory & Inbound JSON Pipeline...")

# 1. CALCULATE DEMAND FROM SALES
print("1/4: Calculating Daily Demand from Sales...")
sales_df = pd.read_csv("data/POP_SalesTransactionHistory.csv", low_memory=False)
demand_df = sales_df.groupby('ITEMNMBR')['QUANTITY_adj'].sum().reset_index()
demand_df['Daily_Demand'] = (demand_df['QUANTITY_adj'] / 1095).round(2)
demand_dict = dict(zip(demand_df['ITEMNMBR'], demand_df['Daily_Demand']))

# 2. CALCULATE INCOMING TRUCKS (POs)
print("2/4: Processing Incoming Purchase Orders...")
po_df = pd.read_excel("data/POP_PurchaseOrderHistory.XLSX")
# Ensure the Location Code is a string so it matches our sites ('1', '2', '3')
po_df['Location Code'] = po_df['Location Code'].astype(str)
# Group by SKU and Location to get the total amount of stock on the way
incoming_df = po_df.groupby(['Item Number', 'Location Code'])['QTY Shipped'].sum().reset_index()
# Create a super-fast dictionary to look up incoming stock: {(SKU, Location): Quantity}
po_dict = dict(zip(zip(incoming_df['Item Number'], incoming_df['Location Code']), incoming_df['QTY Shipped']))

# 3. LOAD INVENTORY TABS
print("3/4: Extracting Inventory across all 3 Sites...")
inv_file = pd.ExcelFile("data/POP_InventorySnapshot.xlsx")
sites = ['Site 1 - SF', 'Site 2 - NJ', 'Site 3 - LA']

# Map the long site names to the simple location codes from the PO file
site_code_map = {'Site 1 - SF': '1', 'Site 2 - NJ': '2', 'Site 3 - LA': '3'}

master_inventory = {}

for site in sites:
    site_df = pd.read_excel(inv_file, sheet_name=site)
    site_df['Available'] = site_df['Available'].fillna(0)
    loc_code = site_code_map[site] # Gets '1', '2', or '3'
    
    for index, row in site_df.iterrows():
        sku = str(row['Item Number'])
        desc = str(row['Description'])
        available = float(row['Available']) 
        
        if sku not in master_inventory:
            daily_demand = demand_dict.get(sku, 0)
            if pd.isna(daily_demand): daily_demand = 0

            master_inventory[sku] = {
                "item_name": desc,
                "avg_daily_demand": daily_demand,
                "inventory_by_dc": {
                    "Site 1 - SF": {"stock_on_hand": 0, "incoming_stock": 0, "days_of_supply": 0},
                    "Site 2 - NJ": {"stock_on_hand": 0, "incoming_stock": 0, "days_of_supply": 0},
                    "Site 3 - LA": {"stock_on_hand": 0, "incoming_stock": 0, "days_of_supply": 0}
                }
            }
            
        # CALCULATE SITE-LEVEL MATH
        daily_demand = master_inventory[sku]["avg_daily_demand"]
        if daily_demand > 0:
            dos = available / daily_demand
        else:
            dos = 9999 
            
        # Lookup incoming stock from our PO dictionary! Defaults to 0 if no trucks are coming.
        incoming_qty = po_dict.get((sku, loc_code), 0)
            
        # Inject everything into the JSON
        master_inventory[sku]["inventory_by_dc"][site]["stock_on_hand"] = int(available)
        master_inventory[sku]["inventory_by_dc"][site]["incoming_stock"] = int(incoming_qty) # NEW!
        master_inventory[sku]["inventory_by_dc"][site]["days_of_supply"] = int(round(dos))

# 4. EXPORT TO JSON
print("4/4: Saving to live_inventory.json...")
with open("live_inventory.json", "w") as f:
    json.dump(master_inventory, f, indent=4)
