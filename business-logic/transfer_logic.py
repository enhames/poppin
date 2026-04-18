def calculate_avoided_penalty(penalty_without_transfer, penalty_with_transfer=0):
    return penalty_without_transfer - penalty_with_transfer

def calculate_transfer_value(transfer_cost, avoided_penalty):
    return avoided_penalty - transfer_cost

def get_reason(transfer_value):
    if transfer_value > 0:
        return "It's cheaper to transfer than tank penalty cost"
    elif transfer_value == 0:
        return "transfer is the same as tanking the penalty cost"
    return "It's cheaper to tank the penalty cost than transfer"

def should_recommend_transfer(transfer_value):
    return transfer_value > 0

def make_recommendation(sku, item_name, source_dc, destination_dc, transfer_units, transfer_cost, expected_penalty_without_transfer, expected_penalty_with_transfer = 0):
    avoided_penalty = calculate_avoided_penalty(expected_penalty_without_transfer, expected_penalty_with_transfer)
    transfer_value = calculate_transfer_value(transfer_cost, avoided_penalty)

    recommendation = ""
    if should_recommend_transfer(transfer_value):
        recommendation = "TRANSFER"
    else:
        recommendation = "WAIT"

    reason = get_reason(transfer_value)

    return {
        "sku" : sku,
        "item_name": item_name,
        "source_dc": source_dc, 
        "destination_dc": destination_dc,
        "transfer_units": round(transfer_units, 2),
        "transfer_cost": round(transfer_cost, 2),
        "avoided_penalty": round(avoided_penalty, 2),
        "transfer_value": round(transfer_value, 2),
        "recommendation": recommendation,
        "reason": reason    
    }

def parse_inventory_json(data):
    recommendations = []
    for sku, sku_data in data.items():
        item_name = sku_data["item_name"]
        avg_daily_demand = sku_data["avg_daily_demand"]
        inventory_by_dc = sku_data["inventory_by_dc"]

        destination_dc = None
        source_dc = None
        lowest_days = float("inf")
        highest_days = -1

        for dc_name, dc_data in inventory_by_dc.items():
            days = dc_data["days_of_supply"]

            if days < lowest_days:
                lowest_days = days
                destination_dc = dc_name

            if days > highest_days:
                highest_days = days
                source_dc = dc_name

        if destination_dc is None or source_dc is None or destination_dc == source_dc:
            continue

        if lowest_days > 7:
            continue

        if highest_days < 14:
            continue

        if avg_daily_demand <= 0:
            continue

        destination_data = inventory_by_dc[destination_dc]
        destination_stock = destination_data["stock_on_hand"]

        target_days = 7
        transfer_units = max(0, (avg_daily_demand * target_days) - destination_stock)

        if transfer_units == 0:
            continue

        source_data = inventory_by_dc[source_dc]
        source_stock = source_data["stock_on_hand"]

        source_remaining_stock = source_stock - transfer_units
        source_remaining_days = source_remaining_stock / avg_daily_demand

        if source_remaining_days < 14:
            continue

        # placeholder values
        transfer_cost = transfer_units * 0.50
        expected_penalty_without_transfer = 300
        expected_penalty_with_transfer = 0

        recommendation = make_recommendation(
            sku,
            item_name,
            source_dc,
            destination_dc,
            transfer_units,
            transfer_cost,
            expected_penalty_without_transfer,
            expected_penalty_with_transfer
        )

        recommendations.append(recommendation)

    return recommendations