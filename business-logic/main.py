import json
from transfer_logic import parse_inventory_json

with open("live_inventory.json", "r") as f:
    data = json.load(f)

recommendations = parse_inventory_json(data)

for rec in recommendations[:10]:
    print(
        f"{rec['sku']} | {rec['source_dc']} -> {rec['destination_dc']} | "
        f"{rec['recommendation']} | units: {rec['transfer_units']} | "
        f"cost: {rec['transfer_cost']} | value: {rec['transfer_value']}"
    )