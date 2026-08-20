import os
import pandas as pd


def load_scb_actual(file_path=None, data_dict=None):
    if data_dict is not None:
        return data_dict

    if not file_path or not os.path.exists(file_path):
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        file_path = os.path.join(base_dir, "data", "SCB Capacity Planning (1).xlsx")
        if not os.path.exists(file_path):
            file_path = os.path.join(base_dir, "data", "PD-Bhubaneswar-(India).xlsx")

    if not os.path.exists(file_path):
        return {}

    xl = pd.ExcelFile(file_path)
    sheet_name = "SCB ACTUAL" if "SCB ACTUAL" in xl.sheet_names else xl.sheet_names[0]

    df = pd.read_excel(
        file_path,
        sheet_name=sheet_name,
        header=None
    )

    return df