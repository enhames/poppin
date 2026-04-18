def calculate_net_benefit(freight_cost, penalty_cost):
    return penalty_cost - freight_cost

def is_transfer_worth_it(freight_cost, penalty_cost):
    return penalty_cost > freight_cost

def get_reason(freight_cost, penalty_cost):
    if penalty_cost > freight_cost:
        return "It's cheaper to to transfer than tank penalty cost"
    return "cheaper to tank the penalty cost than transfer"

def make_recommendation(sku, item_name, source_dc, destination_dc, transfer_units, transfer_cost, expected_penalty_without_transfer, expected_penalty_with_transfer = 0):
    
def parse_inventory_json(data):