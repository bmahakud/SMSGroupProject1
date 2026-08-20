import pandas as pd
import numpy as np


# ==========================================================
# FIND A ROW ANYWHERE IN THE SHEET
# ==========================================================

def find_row(sheet, keywords):

    keywords = [k.upper().strip() for k in keywords]

    for r in range(sheet.shape[0]):

        row_text = " ".join(
            str(x).upper().strip()
            for x in sheet.iloc[r].values
        )

        for key in keywords:

            if key in row_text:
                return r

    return None


# ==========================================================
# EXTRACT 12 MONTH VALUES FROM A ROW
# ==========================================================

def find_section(sheet, keyword):
    keyword = keyword.upper().strip()

    for r in range(sheet.shape[0]):
        row_text = " ".join(str(x).upper().strip() for x in sheet.iloc[r].values)

        if keyword in row_text:
            return r

    return None


def find_label_after(sheet, start_row, label, max_search=15):

    if start_row is None:
        return None

    label = label.upper().strip()

    end_row = min(start_row + max_search, sheet.shape[0])

    for r in range(start_row, end_row):

        row_text = " ".join(str(x).upper().strip() for x in sheet.iloc[r].values)

        if label in row_text:
            return r

    return None


def extract_values(sheet, row_index):

    if row_index is None:
        return [0] * 12

    row = sheet.iloc[row_index]

    values = []

    for value in row[1:]:
        num = pd.to_numeric(value, errors="coerce")

        if pd.notna(num):
            values.append(float(num))

    if len(values) < 12:
        values.extend([0] * (12 - len(values)))

    return values[:12]
# ==========================================================
# MAIN PREPROCESS
# ==========================================================

def preprocess_summary(df):
    # Direct dictionary or pre-structured DataFrame payload from Django DB
    if isinstance(df, dict) or (isinstance(df, pd.DataFrame) and "Month" in df.columns):
        if isinstance(df, dict):
            dashboard_df = pd.DataFrame(df)
        else:
            dashboard_df = df.copy()

        for col in ["Welding", "Machining", "Assembly", "Roll Refurbishment", "Plating"]:
            if col not in dashboard_df.columns:
                dashboard_df[col] = 0.0

        dashboard_df["Planned Hours"] = (
            dashboard_df["Welding"] +
            dashboard_df["Machining"] +
            dashboard_df["Assembly"] +
            dashboard_df["Roll Refurbishment"] +
            dashboard_df["Plating"]
        )

        if "Capacity" in dashboard_df.columns:
            dashboard_df["NPK Capacity"] = dashboard_df["Capacity"]
        elif "NPK Capacity" in dashboard_df.columns:
            dashboard_df["Capacity"] = dashboard_df["NPK Capacity"]
        else:
            dashboard_df["NPK Capacity"] = dashboard_df["Planned Hours"]
            dashboard_df["Capacity"] = dashboard_df["Planned Hours"]

        if "Utilization" not in dashboard_df.columns or dashboard_df["Utilization"].sum() == 0:
            cap_series = dashboard_df["Capacity"].replace(0, np.nan)
            dashboard_df["Utilization"] = ((dashboard_df["Planned Hours"] / cap_series) * 100).fillna(0.0).round(1)

        for col in ["Group Company", "Contract MFG"]:
            if col not in dashboard_df.columns:
                dashboard_df[col] = 0.0

        dashboard_df = dashboard_df.round(1)
        return dashboard_df

    months = [
        "Jan-26",
        "Feb-26",
        "Mar-26",
        "Apr-26",
        "May-26",
        "Jun-26",
        "Jul-26",
        "Aug-26",
        "Sep-26",
        "Oct-26",
        "Nov-26",
        "Dec-26",
    ]

    # ------------------------------------------------------
    # Detect rows automatically
    # ------------------------------------------------------

    welding_row = find_row(df, ["WELDING"])

    machining_row = find_row(df, ["MACHINING"])

    assembly_row = find_row(df, ["ASSEMBLY"])

    roll_row = find_row(df, ["ROLL REFURBISHMENT"])

    plating_row = find_row(df, ["PLATING"])

    npk_row = find_row(df, [
        "TOTAL NPK",
        "NPK CAPACITY",
        "NPK"
    ])

    utilization_row = find_row(df, [
        "UTILIZATION (%)",
        "% UTILIZATION",
        "CAPACITY UTILIZATION"
    ])

    group_row = find_row(df, [
        "GROUP COMPANY"
    ])

    contract_row = find_row(df, [
        "CONTRACT MFG",
        "CONTRACT MFG.",
        "CONTRACT MANUFACTURING"
    ])

    print("\n========== ROW DETECTION ==========\n")

    print("Welding :", welding_row)
    print("Machining :", machining_row)
    print("Assembly :", assembly_row)
    print("Roll :", roll_row)
    print("Plating :", plating_row)
    print("NPK :", npk_row)
    print("Utilization :", utilization_row)
    print("Group :", group_row)
    print("Contract :", contract_row)

    # ------------------------------------------------------
    # Build dataframe
    # ------------------------------------------------------

    dashboard_df = pd.DataFrame({

        "Month": months,

        "Welding": extract_values(df, welding_row),

        "Machining": extract_values(df, machining_row),

        "Assembly": extract_values(df, assembly_row),

        "Roll Refurbishment": extract_values(df, roll_row),

        "Plating": extract_values(df, plating_row),

    })

    # ------------------------------------------------------
    # Planned Hours
    # ------------------------------------------------------

    dashboard_df["Planned Hours"] = (

        dashboard_df["Welding"]

        + dashboard_df["Machining"]

        + dashboard_df["Assembly"]

        + dashboard_df["Roll Refurbishment"]

        + dashboard_df["Plating"]

    )

    # ------------------------------------------------------
    # NPK
    # ------------------------------------------------------

   
    if npk_row is None:

        npk_row = find_label_after(
            df,
            find_section(df, "NPK CAPACITY"),
            "TOTAL"
        )

    npk = extract_values(df, npk_row)

    print("\nNPK ROW RAW")
    print(df.iloc[npk_row])

    print("\nExtracted NPK")
    print(npk)

    if sum(npk) == 0:

        print("NPK not found -> using Planned Hours")

        npk = dashboard_df["Planned Hours"].tolist()

    dashboard_df["NPK Capacity"] = npk
    dashboard_df["Capacity"] = npk
    # ------------------------------------------------------
    # Utilization
    # ------------------------------------------------------

    if utilization_row is None:

        utilization_row = find_label_after(
            df,
            find_section(df, "UTILIZATION"),
            "UTILIZATION"
        )


    util = [u * 100 for u in extract_values(df, utilization_row)]

    print("\nUTIL ROW RAW")
    print(df.iloc[utilization_row])

    print("\nExtracted Util")
    print(util)

    if sum(util) == 0:

        util = (
            dashboard_df["Planned Hours"]
            / dashboard_df["NPK Capacity"]
            * 100
        ).round(1)

    dashboard_df["Utilization"] = util
    # ------------------------------------------------------
    # Group Company
    # ------------------------------------------------------

    if group_row is None:

        group_row = find_label_after(
        df,
        find_section(df, "GROUP COMPANY"),
        "GROUP COMPANY"
    )

    dashboard_df["Group Company"] = extract_values(df, group_row)

    # ------------------------------------------------------
    # Contract Manufacturing
    # ------------------------------------------------------

    if contract_row is None:

        contract_row = find_label_after(
            df,
            find_section(df, "CONTRACT"),
            "CONTRACT"
        )

    dashboard_df["Contract MFG"] = extract_values(df, contract_row)
    dashboard_df = dashboard_df.round(1)

    print("\n=========== FINAL DASHBOARD DATA ==========\n")

    print(dashboard_df)

    print("\nDashboard Columns:")
    print(dashboard_df.columns.tolist())

    return dashboard_df