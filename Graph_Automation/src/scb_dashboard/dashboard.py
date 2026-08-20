import os
from .load import load_scb_actual
from .preprocess import preprocess_summary
from .plot import plot_dashboard


def create_dashboard(file_path=None, data_dict=None, output_path=None):

    # Load data from dict payload or Excel sheet
    raw_df = load_scb_actual(file_path=file_path, data_dict=data_dict)

    # Create the master dataframe
    dashboard_df = preprocess_summary(raw_df)

    print("\n========== MASTER DATAFRAME ==========\n")
    print(dashboard_df)

    # -------------------------------------------------
    # Plot the stacked bar chart
    # -------------------------------------------------

    fig = plot_dashboard(dashboard_df)

    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    output_dir = os.path.join(base_dir, "output")
    os.makedirs(output_dir, exist_ok=True)

    if not output_path:
        output_path = os.path.join(output_dir, "scb_dashboard.png")

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    fig.savefig(output_path, dpi=300)

    # -------------------------------------------------
    # Plot individual department charts dynamically
    # -------------------------------------------------
    from .plot import plot_department_dashboard
    months = dashboard_df["Month"].tolist()
    total_cap = dashboard_df["Capacity"].tolist() if "Capacity" in dashboard_df.columns else [10000.0] * 12

    dept_configs = [
        ("welding", "Welding Department", "Welding", "#0A3A60", 50000.0 / 140000.0),
        ("machining", "Machining Department", "Machining", "#1C7893", 30000.0 / 140000.0),
        ("assembly", "Assembly Department", "Assembly", "#36A8C7", 20000.0 / 140000.0),
        ("rr", "Roll Repair (R&R) Department", "Roll Refurbishment", "#7FD6EA", 25000.0 / 140000.0),
        ("plating", "Plating Department", "Plating", "#CFEFFA", 15000.0 / 140000.0),
    ]

    for key, title, col_name, color, cap_ratio in dept_configs:
        planned = dashboard_df[col_name].tolist() if col_name in dashboard_df.columns else [0.0] * 12
        cap = [c * cap_ratio for c in total_cap]
        dept_fig = plot_department_dashboard(title, months, planned, cap, dept_color=color)
        dept_out = os.path.join(output_dir, "charts", f"{key}_dashboard.png")
        os.makedirs(os.path.dirname(dept_out), exist_ok=True)
        dept_fig.savefig(dept_out, dpi=300)

    print(f"\nDashboard and department charts saved successfully to {output_dir}.")
    return output_path