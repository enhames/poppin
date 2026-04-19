import os
import re
import pandas as pd

BASE_DIR = os.path.dirname(__file__)
CHARGEBACK_XLSX = os.path.join(BASE_DIR, "all_data", "POP_ChargeBack_Deductions_Penalties_Freight.xlsx")

CAUSE_CODE_TYPE: dict[str, str] = {
    "CRED11-F": "operational",
    "CRED11-O": "operational",
    "CRED12":   "post-audit",
    "CRED08":   "damage",
}

DC_LOCATION_MAP: dict[int, str] = {1: "DC-SF", 2: "DC-NJ", 3: "DC-LA"}

_VENDOR_SUFFIX_RE = re.compile(r"\s+(V#\S+|#\S+)$", re.IGNORECASE)

_cache: dict | None = None


def _clean_name(name: str) -> str:
    if not isinstance(name, str):
        return str(name)
    return _VENDOR_SUFFIX_RE.sub("", name.strip())


def _primary_dc(group: pd.DataFrame) -> str:
    loc_totals = group.groupby("Location Code")["Extended Price"].sum()
    if loc_totals.empty:
        return "Various"
    top_loc = loc_totals.idxmax()
    if pd.isna(top_loc):
        return "Various"
    return DC_LOCATION_MAP.get(int(top_loc), "Various")


def _parse() -> dict:
    # ── Deductions sheet ──────────────────────────────────────────────────────
    ded = pd.read_excel(CHARGEBACK_XLSX, sheet_name="Data - Deductions & Cause Code")
    ded["Extended Price"] = pd.to_numeric(
        ded["Extended Price"].astype(str)
            .str.replace("$", "", regex=False)
            .str.replace(",", "", regex=False),
        errors="coerce",
    ).fillna(0.0)
    ded["Cause Code"] = ded["Cause Code"].astype(str).str.strip()
    ded["Location Code"] = pd.to_numeric(ded["Location Code"], errors="coerce")
    ded["Document Date"] = pd.to_datetime(ded["Document Date"], errors="coerce")
    ded["Year"] = ded["Document Date"].dt.year
    ded["Month"] = ded["Document Date"].dt.to_period("M")
    ded["type"] = ded["Cause Code"].map(lambda c: CAUSE_CODE_TYPE.get(c, "promotional"))

    # ── Customer name lookup from Penalty sheet ────────────────────────────────
    pen = pd.read_excel(CHARGEBACK_XLSX, sheet_name="Data-Penalty")
    pen["Customer Name"] = pen["Customer Name"].astype(str).apply(_clean_name)
    name_lookup: dict[str, str] = (
        pen.drop_duplicates("Customer Number")
           .set_index("Customer Number")["Customer Name"]
           .to_dict()
    )

    # ── Cause code rows ────────────────────────────────────────────────────────
    cause_groups = (
        ded.groupby("Cause Code")
           .agg(amount=("Extended Price", "sum"), incidents=("Extended Price", "count"))
           .reset_index()
    )
    dc_by_cc = {cc: _primary_dc(grp) for cc, grp in ded.groupby("Cause Code")}

    cause_code_rows = []
    for _, row in cause_groups.sort_values("amount", ascending=False).iterrows():
        cc = str(row["Cause Code"])
        cause_code_rows.append({
            "causeCode": cc,
            "channel": "Various Channels",
            "amount": round(float(row["amount"]), 2),
            "incidents": int(row["incidents"]),
            "dc": dc_by_cc.get(cc, "Various"),
            "type": CAUSE_CODE_TYPE.get(cc, "promotional"),
        })

    # ── Customer penalties (CRED11-F/O + CRED12 only) ─────────────────────────
    op_codes = ["CRED11-F", "CRED11-O", "CRED12"]
    op_ded = ded[ded["Cause Code"].isin(op_codes)]
    cust_groups = (
        op_ded.groupby("Customer Number")
              .agg(amount=("Extended Price", "sum"), incidents=("Extended Price", "count"))
              .sort_values("amount", ascending=False)
              .head(5)
    )
    customer_penalties = []
    for cid, row in cust_groups.iterrows():
        customer_penalties.append({
            "customerId": str(cid),
            "customerName": name_lookup.get(str(cid), str(cid)),
            "amount": round(float(row["amount"]), 2),
            "incidents": int(row["incidents"]),
        })

    # ── Yearly penalties ───────────────────────────────────────────────────────
    yearly_map: dict[int, dict[str, float]] = {}
    for _, row in ded.iterrows():
        year = row["Year"]
        if pd.isna(year):
            continue
        y = int(year)
        if y not in yearly_map:
            yearly_map[y] = {"operational": 0.0, "postAudit": 0.0, "damage": 0.0}
        t = row["type"]
        amt = float(row["Extended Price"])
        if t == "operational":
            yearly_map[y]["operational"] += amt
        elif t == "post-audit":
            yearly_map[y]["postAudit"] += amt
        elif t == "damage":
            yearly_map[y]["damage"] += amt

    # Peak month (operational + post-audit + damage only)
    non_promo = ded[ded["type"] != "promotional"]
    monthly_totals = non_promo.groupby("Month")["Extended Price"].sum()
    peak_period = monthly_totals.idxmax() if not monthly_totals.empty else None
    peak_amount = round(float(monthly_totals.max()), 2) if not monthly_totals.empty else 0.0

    yearly_penalties = []
    for year in sorted(yearly_map.keys()):
        if year < 2023:
            continue
        entry: dict = {
            "year": str(year),
            "operational": round(yearly_map[year]["operational"], 2),
            "postAudit":   round(yearly_map[year]["postAudit"],   2),
            "damage":      round(yearly_map[year]["damage"],       2),
        }
        if peak_period is not None and peak_period.year == year:
            entry["peakMonth"] = peak_period.strftime("%b %Y")
            entry["peakMonthAmount"] = peak_amount
        yearly_penalties.append(entry)

    return {
        "causeCodeRows": cause_code_rows,
        "customerPenalties": customer_penalties,
        "yearlyPenalties": yearly_penalties,
    }


def load_chargeback_data() -> dict:
    """Parse and cache chargeback data from the Excel source file."""
    global _cache
    if _cache is None:
        _cache = _parse()
    return _cache
