import matplotlib.pyplot as plt
import numpy as np
import matplotlib.patches as patches
from matplotlib.lines import Line2D


def plot_dashboard(df):

    # ==========================================
    # Dashboard Canvas (Spacious & Clean Layout)
    # ==========================================
    fig = plt.figure(figsize=(16, 10.5), facecolor="white")

    # Main chart area
    ax = fig.add_axes([
        0.06,   # left
        0.25,   # bottom
        0.73,   # width
        0.55    # height
    ])

    # ==========================================
    # Basic Data
    # ==========================================

    months = df["Month"]
    capacity = df["Capacity"]

    # ==========================================
    # COLORS
    # ==========================================

    colors = {
        "Welding": "#103B5C",
        "Machining": "#1C7893",
        "Assembly": "#36A8C7",
        "Roll Refurbishment": "#7FD6EA",
        "Plating": "#CFEFFA",
    }

    stack_order = [
        "Welding",
        "Machining",
        "Assembly",
        "Roll Refurbishment",
        "Plating",
    ]

    bottom = np.zeros(len(df))

    if "NPK Capacity" in df.columns:
        npk_capacity = df["NPK Capacity"].values
    else:
        npk_capacity = capacity.values

    planned_hours = (
        df["Welding"]
        + df["Machining"]
        + df["Assembly"]
        + df["Roll Refurbishment"]
        + df["Plating"]
    ).values

    if "Planned Hours" in df.columns and df["Planned Hours"].sum() > 0:
        planned_hours = df["Planned Hours"].values

    utilization = np.zeros(len(months))
    for idx_u in range(len(months)):
        if "Utilization" in df.columns and float(df["Utilization"].iloc[idx_u]) > 0:
            u_raw = float(df["Utilization"].iloc[idx_u])
            utilization[idx_u] = u_raw * 100.0 if u_raw <= 1.0 else u_raw
        elif npk_capacity[idx_u] > 0:
            utilization[idx_u] = (planned_hours[idx_u] / npk_capacity[idx_u]) * 100.0
        else:
            utilization[idx_u] = 0.0

    # ==========================================
    # Title & Header Text
    # ==========================================

    fig.text(
        0.06,
        0.965,
        "Production Bhubaneswar",
        fontsize=18,
        fontweight="bold",
        ha="left",
        va="top",
    )

    fig.text(
        0.36,
        0.965,
        " - Capacity Utilization",
        fontsize=18,
        color="#1D6FB8",
        fontweight="bold",
        va="top",
    )

    first_m = str(months.iloc[0]).strip() if hasattr(months, 'iloc') else str(months[0])
    last_m = str(months.iloc[-1]).strip() if hasattr(months, 'iloc') else str(months[-1])
    fig.text(
        0.78,
        0.965,
        f"Planned Hours {first_m.upper()}-{last_m.upper()}",
        fontsize=9,
        fontweight="bold",
        ha="right",
        va="top",
        color="#333333",
    )

    # ==========================================================
    # TOP UTILIZATION & CAPACITY HEADER BANNER (TABLE STYLE)
    # ==========================================================

    table_ax = fig.add_axes([0.01, 0.825, 0.77, 0.115])
    table_ax.axis("off")
    table_ax.set_xlim(-1.8, len(months) - 0.4)
    table_ax.set_ylim(0, 3)

    # Row 2 Header Box (% Of Utilization)
    rect_u_hdr = patches.Rectangle((-1.75, 2.04), 1.20, 0.88, facecolor="#6B9E43", edgecolor="none", zorder=5)
    table_ax.add_patch(rect_u_hdr)
    table_ax.text(-1.15, 2.48, "% Of Utilization", ha="center", va="center", fontsize=8, fontweight="bold", color="white", zorder=10)

    # Row 1 Header Box (Total NPK)
    rect_n_hdr = patches.Rectangle((-1.75, 1.04), 1.20, 0.88, facecolor="#555555", edgecolor="none", zorder=5)
    table_ax.add_patch(rect_n_hdr)
    table_ax.text(-1.15, 1.48, "Total NPK", ha="center", va="center", fontsize=8, fontweight="bold", color="white", zorder=10)

    # Row 0 Header Box (Planned Hours)
    rect_p_hdr = patches.Rectangle((-1.75, 0.04), 1.20, 0.88, facecolor="#777777", edgecolor="none", zorder=5)
    table_ax.add_patch(rect_p_hdr)
    table_ax.text(-1.15, 0.48, "Planned Hours", ha="center", va="center", fontsize=8, fontweight="bold", color="white", zorder=10)

    # Detect if data values are in raw hours (>100) or thousands (<=100) for uniform table formatting
    max_raw = max(max(npk_capacity if len(npk_capacity) else [0]), max(planned_hours if len(planned_hours) else [0]))
    is_raw_scale = max_raw > 100

    # Fill 12 Month Column Data Cells
    for i in range(len(months)):
        u_val = utilization[i]
        if u_val >= 75.0:
            bg_col = "#9CD968"  # Green (>75%)
            border_col = "#558B2F"
        elif u_val >= 50.0:
            bg_col = "#FFD54F"  # Yellow (50-75%)
            border_col = "#F57F17"
        else:
            bg_col = "#EF5350"  # Red (<50%)
            border_col = "#D32F2F"

        # Row 2: Utilization % Box
        cell_u = patches.Rectangle((i - 0.44, 2.04), 0.88, 0.88, facecolor=bg_col, edgecolor=border_col, linewidth=0.6, zorder=5)
        table_ax.add_patch(cell_u)
        table_ax.text(i, 2.48, f"{int(round(u_val))}%", ha="center", va="center", fontsize=8.5, fontweight="bold", color="black", zorder=10)

        # Row 1: Total NPK Box (Formatted cleanly in 1000s)
        npk_raw = float(npk_capacity[i])
        npk_k = (npk_raw / 1000.0) if is_raw_scale else npk_raw
        if npk_k >= 10:
            npk_str = f"{int(round(npk_k))}"
        elif npk_k > 0:
            npk_str = f"{npk_k:.1f}"
        else:
            npk_str = "0"
        cell_n = patches.Rectangle((i - 0.44, 1.04), 0.88, 0.88, facecolor="#F4F4F4", edgecolor="#D0D0D0", linewidth=0.6, zorder=5)
        table_ax.add_patch(cell_n)
        table_ax.text(i, 1.48, npk_str, ha="center", va="center", fontsize=8.5, fontweight="bold", color="black", zorder=10)

        # Row 0: Planned Hours Box (Formatted cleanly in 1000s)
        pln_raw = float(planned_hours[i])
        pln_k = (pln_raw / 1000.0) if is_raw_scale else pln_raw
        if pln_k >= 10:
            pln_str = f"{int(round(pln_k))}"
        elif pln_k > 0:
            pln_str = f"{pln_k:.1f}"
        else:
            pln_str = "0"
        cell_p = patches.Rectangle((i - 0.44, 0.04), 0.88, 0.88, facecolor="#F4F4F4", edgecolor="#D0D0D0", linewidth=0.6, zorder=5)
        table_ax.add_patch(cell_p)
        table_ax.text(i, 0.48, pln_str, ha="center", va="center", fontsize=8.5, fontweight="bold", color="black", zorder=10)

    # ==========================================
    # Axis (Smart Dynamic Y-Axis Scaling)
    # ==========================================

    planned_totals = df["Planned Hours"].values if "Planned Hours" in df.columns else bottom
    peak_val = max(max(capacity), max(planned_totals))

    if peak_val <= 14000:
        ymax = 15000
        step = 3000
    elif peak_val <= 20000:
        ymax = 20000
        step = 5000
    elif peak_val <= 30000:
        ymax = 40000
        step = 10000
    elif peak_val <= 50000:
        ymax = 60000
        step = 10000
    elif peak_val <= 75000:
        ymax = 80000
        step = 10000
    else:
        ymax = int(np.ceil((peak_val * 1.25) / 10000.0)) * 10000
        step = 10000

    ax.set_ylim(0, ymax)
    ax.set_xlim(-0.6, len(months) - 0.4)

    x = np.arange(len(months))

    ax.set_xticks(x)
    ax.set_xticklabels([])

    ticks = np.arange(0, ymax + 1, step)
    ax.set_yticks(ticks)
    ax.set_yticklabels(
        [f"{int(t/1000)}" for t in ticks],
        fontsize=9,
    )

    ax.set_ylabel(
        "1000 Hours",
        fontsize=10,
        fontweight="bold",
    )

    # ==========================================
    # Grid
    # ==========================================

    ax.grid(
        axis="y",
        color="#D9D9D9",
        linestyle="--",
        linewidth=0.8,
    )
    ax.set_axisbelow(True)

    # ==========================================
    # Spines
    # ==========================================

    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color("#999999")
    ax.spines["bottom"].set_color("#999999")

    # ==========================================
    # GREY NPK CAPACITY BACKGROUND
    # ==========================================

    ax.bar(
        x,
        npk_capacity,
        width=0.72,
        color="#ECECEC",
        alpha=0.65,
        edgecolor="#8A8A8A",
        linewidth=0.8,
        hatch="//",
        zorder=1,
        label="NPK Capacity",
    )

    # ==========================================
    # STACKED PLANNED HOURS
    # ==========================================

    for column in stack_order:
        bars = ax.bar(
            x,
            df[column],
            bottom=bottom,
            width=0.58,
            color=colors[column],
            edgecolor="white",
            linewidth=0.7,
            zorder=5,
            label=column,
        )

        for bar, value in zip(bars, df[column]):
            # Hide labels for tiny segments (< 300 hrs or < 0.3k) to avoid segment crowding
            val_in_k = (value / 1000.0) if is_raw_scale else value
            if val_in_k < 0.3:
                continue

            x_text = bar.get_x() + bar.get_width() / 2
            y_text = bar.get_y() + bar.get_height() / 2

            txt_color = "white" if column in ["Welding", "Machining", "Assembly"] else "black"

            ax.text(
                x_text,
                y_text,
                f"{val_in_k:.1f}",
                ha="center",
                va="center",
                fontsize=7,
                fontweight="bold",
                color=txt_color,
                zorder=10,
            )

        bottom += df[column].values

    # ==========================================================
    # TOTAL PLANNED HOURS ABOVE EACH STACK
    # ==========================================================

    offset = ymax * 0.025

    for i, total in enumerate(bottom):
        if total > 0:
            tot_in_k = (total / 1000.0) if is_raw_scale else total
            ax.text(
                i,
                total + offset,
                f"{tot_in_k:.1f}",
                ha="center",
                va="bottom",
                fontsize=8.5,
                fontweight="bold",
                color="black",
                zorder=15,
            )

    # ==========================================================
    # AVAILABLE CAPACITY LINE
    # ==========================================================

    ax.plot(
        x,
        capacity,
        color="black",
        linewidth=2.4,
        marker="o",
        markersize=6,
        markerfacecolor="white",
        markeredgecolor="black",
        markeredgewidth=1.5,
        zorder=20,
        label="Available Capacity",
    )

    # ==========================================================
    # GROUP COMPANY LINE (Conditionally plot if data exists)
    # ==========================================================
    has_group = "Group Company" in df.columns and df["Group Company"].sum() > 0
    if has_group:
        group_company = df["Group Company"]
        if group_company.max() < 100 and is_raw_scale:
            group_company = group_company * 1000

        ax.plot(
            months,
            group_company,
            color="#2F80ED",
            marker="o",
            linewidth=2.5,
            markersize=6,
            label="Group Company",
            zorder=21
        )

        for xpos, value in zip(x, group_company):
            if value > 0:
                val_k = (value / 1000.0) if is_raw_scale else value
                ax.text(
                    xpos,
                    value + offset,
                    f"{val_k:.1f}",
                    fontsize=7,
                    ha="center",
                    color="#1E88E5",
                    va="bottom",
                    zorder=30,
                    fontweight="bold",
                )

    # ==========================================================
    # CONTRACT MFG (Conditionally plot if data exists)
    # ==========================================================
    has_contract = "Contract MFG" in df.columns and df["Contract MFG"].sum() > 0
    if has_contract:
        contract = df["Contract MFG"]
        if contract.max() < 100 and is_raw_scale:
            contract = contract * 1000

        ax.plot(
            x,
            contract,
            color="#F28C28",
            linewidth=2,
            marker="o",
            markersize=5,
            markerfacecolor="white",
            markeredgecolor="#F28C28",
            zorder=22,
            label="Contract MFG",
        )

        for xpos, value in zip(x, contract):
            if value > 0:
                val_k = (value / 1000.0) if is_raw_scale else value
                ax.text(
                    xpos,
                    value + offset,
                    f"{val_k:.1f}",
                    fontsize=7,
                    ha="center",
                    color="#F28C28",
                    zorder=30,
                )    

    # ==========================================================
    # CAPACITY VALUES ABOVE CAPACITY LINE
    # ==========================================================

    for xpos, value in zip(x, capacity):
        if value > 0:
            val_k = (value / 1000.0) if is_raw_scale else value
            ax.text(
                xpos,
                value + offset,
                f"{val_k:.1f}",
                ha="center",
                va="bottom",
                fontsize=8,
                fontweight="bold",
                color="black",
                zorder=25,
            )

    # ==========================================================
    # BOTTOM MONTH STRIP
    # ==========================================================

    month_ax = fig.add_axes([0.06, 0.17, 0.73, 0.05])

    month_ax.set_xlim(-0.5, len(months) - 0.5)
    month_ax.set_ylim(0, 1)
    month_ax.set_facecolor("#EFEFEF")
    month_ax.set_xticks([])
    month_ax.set_yticks([])

    for spine in month_ax.spines.values():
        spine.set_color("#B0B0B0")
        spine.set_linewidth(0.8)

    for i, month in enumerate(months):
        month_ax.text(
            i,
            0.5,
            month,
            ha="center",
            va="center",
            fontsize=9,
            fontweight="bold",
            color="#404040",
        )

    for i in range(len(months) + 1):
        month_ax.plot(
            [i - 0.5, i - 0.5],
            [0, 1],
            color="#C8C8C8",
            linewidth=0.6,
        )

    # ==========================================================
    # DEPARTMENT & LINE LEGEND (DEDICATED UNCLUTTERED AXES)
    # ==========================================================

    legend_ax = fig.add_axes([0.06, 0.09, 0.73, 0.055])
    legend_ax.axis("off")

    legend_handles = [
        patches.Patch(facecolor="#103B5C", edgecolor="white", label="Welding"),
        patches.Patch(facecolor="#1C7893", edgecolor="white", label="Machining"),
        patches.Patch(facecolor="#36A8C7", edgecolor="white", label="Assembly"),
        patches.Patch(facecolor="#7FD6EA", edgecolor="white", label="Roll Refurbishment"),
        patches.Patch(facecolor="#CFEFFA", edgecolor="white", label="Plating"),
        patches.Patch(facecolor="#ECECEC", edgecolor="#808080", hatch="//", label="NPK Capacity"),
        Line2D([0], [0], color="black", marker="o", linewidth=2.5, markersize=6, label="Available Capacity"),
    ]

    if has_group:
        legend_handles.append(Line2D([0], [0], color="#2F80ED", marker="o", linewidth=2.5, markersize=6, label="Group Company"))

    if has_contract:
        legend_handles.append(Line2D([0], [0], color="#F28E2B", marker="o", linewidth=2.5, markersize=6, label="Contract MFG"))

    legend_ax.legend(
        handles=legend_handles,
        loc="center",
        ncol=4 if not (has_group or has_contract) else 5,
        fontsize=9,
        frameon=False,
    )

    # ==========================================================
    # UTILIZATION LEGEND PILLS (BOTTOM LEFT SEPARATE AXES)
    # ==========================================================

    util_ax = fig.add_axes([0.06, 0.035, 0.45, 0.04])
    util_ax.axis("off")

    # Green Pill (>75%)
    p1 = patches.FancyBboxPatch((0.02, 0.2), 0.08, 0.6, boxstyle="round,pad=0.05", facecolor="#9CD968", edgecolor="none")
    util_ax.add_patch(p1)
    util_ax.text(0.12, 0.5, "more than 75% utilized", va="center", fontsize=8, fontweight="bold", color="#333333")

    # Yellow Pill (50-75%)
    p2 = patches.FancyBboxPatch((0.42, 0.2), 0.08, 0.6, boxstyle="round,pad=0.05", facecolor="#FFD54F", edgecolor="none")
    util_ax.add_patch(p2)
    util_ax.text(0.52, 0.5, "50%-75% utilized", va="center", fontsize=8, fontweight="bold", color="#333333")

    # Red Pill (<50%)
    p3 = patches.FancyBboxPatch((0.75, 0.2), 0.08, 0.6, boxstyle="round,pad=0.05", facecolor="#EF5350", edgecolor="none")
    util_ax.add_patch(p3)
    util_ax.text(0.85, 0.5, "Less than 50% utilized", va="center", fontsize=8, fontweight="bold", color="#333333")

    # ==========================================================
    # RIGHT SIDE SUMMARY PANEL
    # ==========================================================

    summary_ax = fig.add_axes([0.805, 0.25, 0.175, 0.55])
    summary_ax.axis("off")

    summary_ax.add_patch(
        patches.FancyBboxPatch(
            (0, 0),
            1,
            1,
            boxstyle="round,pad=0.02",
            facecolor="#EAF5E3",
            edgecolor="#A0A0A0",
        )
    )

    planned = df["Planned Hours"].mean() / 1000.0 if is_raw_scale else df["Planned Hours"].mean()
    capacity_total = df["Capacity"].mean() / 1000.0 if is_raw_scale else df["Capacity"].mean()
    util_avg = df["Utilization"].mean()

    summary_ax.text(
        0.5,
        0.92,
        "SUMMARY",
        ha="center",
        fontsize=13,
        fontweight="bold",
    )

    rows = [
        ("Planned Hours", planned),
        ("Available Capacity", capacity_total),
        ("Avg Utilization", util_avg),
    ]

    if has_group:
        grp_val = df["Group Company"].mean()
        if grp_val > 100 and is_raw_scale:
            grp_val /= 1000.0
        rows.append(("Group Company", grp_val))

    if has_contract:
        cnt_val = df["Contract MFG"].mean()
        if cnt_val > 100 and is_raw_scale:
            cnt_val /= 1000.0
        rows.append(("Contract MFG", cnt_val))

    y = 0.78

    for label, value in rows:
        if "Utilization" in label:
            txt = f"{value:.1f}%"
        else:
            txt = f"{value:.1f}"

        summary_ax.text(
            0.08,
            y,
            label,
            fontsize=10,
            fontweight="bold",
        )

        summary_ax.text(
            0.92,
            y,
            txt,
            ha="right",
            fontsize=10,
        )

        y -= 0.16

    # ==========================================================
    # FOOTER BRANDING
    # ==========================================================

    fig.text(0.96, 0.035, "SMS group", fontsize=14, fontweight="bold", color="#003366", ha="right")
    fig.text(0.68, 0.015, "© SMS group GmbH", fontsize=7.5, color="#666666")
    fig.text(0.96, 0.015, "August 19, 2026", fontsize=7.5, color="#666666", ha="right")

    # ==========================================================
    # OUTER BORDER
    # ==========================================================

    fig.add_artist(
        patches.Rectangle(
            (0.01, 0.01),
            0.98,
            0.98,
            transform=fig.transFigure,
            fill=False,
            edgecolor="#A8A8A8",
            linewidth=1.2,
        )
    )

    return fig


def plot_department_dashboard(dept_title, months, planned_hours, capacity_hours, dept_color="#0A3A60"):
    import matplotlib.pyplot as plt
    import matplotlib.patches as patches
    from matplotlib.lines import Line2D
    import numpy as np

    fig, ax = plt.subplots(figsize=(15, 8.5), dpi=300)
    fig.patch.set_facecolor("white")
    ax.set_facecolor("white")
    plt.subplots_adjust(left=0.08, right=0.76, top=0.88, bottom=0.15)

    ax.text(
        -0.05, 1.12,
        f"{dept_title} — Capacity Utilization & Workload",
        transform=ax.transAxes,
        fontsize=18,
        fontweight="bold",
        color="#0A3A60",
        va="top",
    )

    planned_hours = [float(x) for x in planned_hours]
    capacity_hours = [float(x) for x in capacity_hours]

    peak_val = max(max(capacity_hours if capacity_hours else [0]), max(planned_hours if planned_hours else [0]))

    if peak_val <= 6000:
        ymax = 8000
        step = 2000
    elif peak_val <= 14000:
        ymax = 15000
        step = 3000
    elif peak_val <= 20000:
        ymax = 20000
        step = 5000
    elif peak_val <= 40000:
        ymax = 50000
        step = 10000
    else:
        ymax = int(np.ceil((peak_val * 1.25) / 10000.0)) * 10000
        step = 10000

    ax.set_ylim(0, ymax)
    ax.set_xlim(-0.6, len(months) - 0.4)
    x = np.arange(len(months))

    ax.set_xticks(x)
    ax.set_xticklabels([])
    ticks = np.arange(0, ymax + 1, step)
    ax.set_yticks(ticks)
    ax.set_yticklabels([f"{int(t/1000)}" for t in ticks], fontsize=9)
    ax.set_ylabel("1000 Hours", fontsize=10, fontweight="bold")
    ax.grid(axis="y", color="#D9D9D9", linestyle="--", linewidth=0.8)
    ax.set_axisbelow(True)

    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color("#999999")
    ax.spines["bottom"].set_color("#999999")

    # Background Hatched NPK Capacity
    ax.bar(
        x,
        capacity_hours,
        width=0.72,
        color="#ECECEC",
        alpha=0.65,
        edgecolor="#8A8A8A",
        linewidth=0.8,
        hatch="//",
        zorder=1,
        label="NPK Capacity",
    )

    # Department Planned Workload Bars
    bars = ax.bar(
        x,
        planned_hours,
        width=0.58,
        color=dept_color,
        edgecolor="white",
        linewidth=0.7,
        zorder=5,
        label="Planned Workload",
    )

    offset = ymax * 0.02

    for bar, val in zip(bars, planned_hours):
        if val >= 300:
            x_text = bar.get_x() + bar.get_width() / 2
            y_text = bar.get_y() + bar.get_height() / 2
            ax.text(
                x_text,
                y_text,
                f"{val/1000:.1f}",
                ha="center",
                va="center",
                fontsize=8,
                fontweight="bold",
                color="white" if dept_color not in ["#CFEFFA", "#7FD6EA"] else "black",
                zorder=10,
            )
        if val > 0:
            ax.text(
                bar.get_x() + bar.get_width() / 2,
                val + offset,
                f"{val/1000:.1f}",
                ha="center",
                va="bottom",
                fontsize=9,
                fontweight="bold",
                color="black",
                zorder=15,
            )

    # NPK Capacity Line
    ax.plot(
        x,
        capacity_hours,
        color="black",
        linewidth=2.4,
        marker="o",
        markersize=6,
        markerfacecolor="white",
        markeredgecolor="black",
        markeredgewidth=1.5,
        zorder=20,
        label="Available Capacity",
    )

    for xpos, val in zip(x, capacity_hours):
        if val > 0:
            ax.text(
                xpos,
                val + offset,
                f"{val/1000:.1f}",
                ha="center",
                va="bottom",
                fontsize=8,
                fontweight="bold",
                color="black",
                zorder=25,
            )

    # Bottom Month Strip
    strip_y = -ymax * 0.16
    strip_height = ymax * 0.08
    for i, month in enumerate(months):
        rect = patches.Rectangle(
            (i - 0.5, strip_y),
            1.0,
            strip_height,
            linewidth=0.8,
            edgecolor="#C4C4C4",
            facecolor="#EFEFEF",
            clip_on=False,
            zorder=3,
        )
        ax.add_patch(rect)
        ax.text(
            i,
            strip_y + strip_height / 2,
            month,
            ha="center",
            va="center",
            fontsize=9,
            fontweight="bold",
            color="#333333",
            clip_on=False,
            zorder=4,
        )

    # Right Summary Panel
    rect_summary = patches.Rectangle(
        (1.03, 0.20),
        0.26,
        0.65,
        transform=ax.transAxes,
        facecolor="#ECF4E8",
        edgecolor="none",
        clip_on=False,
    )
    ax.add_patch(rect_summary)

    ax.text(1.16, 0.77, "SUMMARY", transform=ax.transAxes, fontsize=13, fontweight="bold", ha="center")
    ax.text(1.05, 0.67, "Planned Hours", transform=ax.transAxes, fontsize=10, fontweight="bold")
    ax.text(1.05, 0.54, "Available Capacity", transform=ax.transAxes, fontsize=10, fontweight="bold")
    ax.text(1.05, 0.41, "Avg Utilization", transform=ax.transAxes, fontsize=10, fontweight="bold")

    mean_planned = np.mean(planned_hours) / 1000.0 if planned_hours else 0.0
    mean_cap = np.mean(capacity_hours) / 1000.0 if capacity_hours else 0.0
    util = (mean_planned / mean_cap * 100.0) if mean_cap > 0 else 0.0

    ax.text(1.26, 0.67, f"{mean_planned:.1f}", transform=ax.transAxes, fontsize=10, ha="right")
    ax.text(1.26, 0.54, f"{mean_cap:.1f}", transform=ax.transAxes, fontsize=10, ha="right")
    ax.text(1.26, 0.41, f"{util:.1f}%", transform=ax.transAxes, fontsize=10, ha="right")

    legend_handles = [
        patches.Patch(facecolor=dept_color, edgecolor="white", label="Planned Workload"),
        patches.Patch(facecolor="#ECECEC", edgecolor="#808080", hatch="//", label="NPK Capacity"),
        Line2D([0], [0], color="black", marker="o", linewidth=2.5, markersize=6, label="Available Capacity"),
    ]

    ax.legend(
        handles=legend_handles,
        loc="upper center",
        bbox_to_anchor=(0.5, -0.13),
        ncol=3,
        fontsize=9,
        frameon=False,
    )

    fig.add_artist(
        patches.Rectangle(
            (0.01, 0.01),
            0.98,
            0.98,
            transform=fig.transFigure,
            fill=False,
            edgecolor="#A8A8A8",
            linewidth=1.2,
        )
    )

    return fig
