import math

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

def make_recommendation(
    sku,
    item_name,
    source_dc,
    destination_dc,
    transfer_units,
    transfer_cost,
    expected_penalty_without_transfer,
    expected_penalty_with_transfer=0,
    risk_inputs=None,
):
    avoided_penalty = calculate_avoided_penalty(expected_penalty_without_transfer, expected_penalty_with_transfer)
    transfer_value = calculate_transfer_value(transfer_cost, avoided_penalty)

    recommendation = ""
    if should_recommend_transfer(transfer_value):
        recommendation = "TRANSFER"
    else:
        recommendation = "WAIT"

    reason = get_reason(transfer_value)

    recommendation_payload = {
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

    if risk_inputs:
        recommendation_payload.update(risk_inputs)

    return recommendation_payload

def parse_inventory_json(data, mode=None):
    recommendations = []

    metadata = data["METADATA"]
    items = data["ITEMS"]
    calculation_mode = "legacy"

    avg_penalty_cost = metadata["avg_penalty_cost"]
    default_eta_reliability = float(metadata.get("default_po_eta_reliability", 1.0) or 1.0)
    default_delay_probability = float(metadata.get("default_po_delay_probability", 0.0) or 0.0)
    transfer_cost_by_lane = metadata["transfer_cost_by_lane"]

    site_abbrev = {
        "Site 1 - SF": "SF",
        "Site 2 - NJ": "NJ",
        "Site 3 - LA": "LA"
    }

    for sku, sku_data in items.items():
        item_name = sku_data["item_name"]
        avg_daily_demand = sku_data["avg_daily_demand"]
        cases_per_pallet = sku_data["cases_per_pallet"]
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
        destination_incoming = destination_data["incoming_stock"]
        incoming_stock_for_transfer = destination_incoming
        risk_inputs = None
        if calculation_mode == "new":
            destination_eta_reliability = float(
                destination_data.get("incoming_eta_reliability", default_eta_reliability)
                or default_eta_reliability
            )
            destination_delay_probability = float(
                destination_data.get("incoming_delay_probability", default_delay_probability)
                or default_delay_probability
            )
            destination_eta_reliability = max(0.0, min(1.0, destination_eta_reliability))
            destination_delay_probability = max(0.0, min(1.0, destination_delay_probability))

            risk_inputs = {"calculation_mode": calculation_mode}
        
            incoming_weight = 0.5 + (0.5 * destination_eta_reliability)
            incoming_stock_for_transfer = destination_incoming * incoming_weight
            risk_inputs.update(
                {
                    "eta_reliability": round(destination_eta_reliability, 4),
                    "delay_probability": round(destination_delay_probability, 4),
                    "risk_adjusted_incoming_stock": round(incoming_stock_for_transfer, 2),
                    "incoming_weight": round(incoming_weight, 4),
                }
            )

        target_days = 7
        target_stock = avg_daily_demand * target_days
        transfer_units = max(0, target_stock - destination_stock - incoming_stock_for_transfer)

        if transfer_units == 0:
            continue

        source_data = inventory_by_dc[source_dc]
        source_stock = source_data["stock_on_hand"]

        source_remaining_stock = source_stock - transfer_units
        source_remaining_days = source_remaining_stock / avg_daily_demand
        if calculation_mode == "legacy" and source_remaining_days < 14:
            continue

        source_abbrev = site_abbrev[source_dc]
        destination_abbrev = site_abbrev[destination_dc]
        lane_key = f"{source_abbrev}->{destination_abbrev}"

        pallets = math.ceil(transfer_units / cases_per_pallet)
        lane_cost = transfer_cost_by_lane.get(lane_key, 0)
        transfer_cost = pallets * lane_cost

        expected_penalty_without_transfer = avg_penalty_cost
        if calculation_mode == "new":
            # Apply modest risk lift so reliability signals inform decisions without overwhelming costs.
            reliability_risk = 1 - destination_eta_reliability
            blended_risk = 0.5 * destination_delay_probability + 0.5 * reliability_risk
            risk_multiplier = 1 + (0.2 * blended_risk)
            if lowest_days <= 3:
                risk_multiplier += 0.05
            expected_penalty_without_transfer = avg_penalty_cost * max(1.0, risk_multiplier)
        expected_penalty_with_transfer = 0
        
        if calculation_mode == "new":
            risk_inputs["source_remaining_days_after_transfer"] = round(source_remaining_days, 2)
            recommendation = make_recommendation(
                sku,
                item_name,
                source_dc,
                destination_dc,
                transfer_units,
                transfer_cost,
                expected_penalty_without_transfer,
                expected_penalty_with_transfer,
                risk_inputs,
            )
        else:
            recommendation = make_recommendation(
                sku,
                item_name,
                source_dc,
                destination_dc,
                transfer_units,
                transfer_cost,
                expected_penalty_without_transfer,
                expected_penalty_with_transfer,
            )

        recommendations.append(recommendation)

    return recommendations