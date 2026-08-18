"""
STEP 2 — PREPROCESSING & FEATURE ENGINEERING
==============================================
Reads data/energy_data.csv, adds lag features, rolling stats, and
cyclical time encodings, handles missing values/outliers, and writes
a model-ready file per node.

Output: data/processed_<node_id>.csv
"""
import numpy as np
import pandas as pd

df = pd.read_csv("data/energy_data_final.csv", parse_dates=["timestamp"])

def add_features(g: pd.DataFrame) -> pd.DataFrame:
    g = g.sort_values("timestamp").reset_index(drop=True)

    # --- missing value handling ---
    g["consumption_kwh"] = g["consumption_kwh"].interpolate(limit_direction="both")

    # --- outlier handling (IQR clip, common for smart-meter noise spikes) ---
    q1, q3 = g["consumption_kwh"].quantile([0.01, 0.99])
    g["consumption_kwh"] = g["consumption_kwh"].clip(q1, q3)

    # --- lag features (previous hour, previous day, previous week) ---
    for lag in (1, 24, 24 * 7):
        g[f"lag_{lag}h"] = g["consumption_kwh"].shift(lag)

    # --- rolling window stats ---
    g["roll_mean_24h"] = g["consumption_kwh"].rolling(24).mean()
    g["roll_std_24h"] = g["consumption_kwh"].rolling(24).std()
    g["roll_mean_7d"] = g["consumption_kwh"].rolling(24 * 7).mean()

    # --- cyclical time encoding (better than raw integers for hour/month) ---
    g["hour_sin"] = np.sin(2 * np.pi * g["hour"] / 24)
    g["hour_cos"] = np.cos(2 * np.pi * g["hour"] / 24)
    g["month_sin"] = np.sin(2 * np.pi * g["month"] / 12)
    g["month_cos"] = np.cos(2 * np.pi * g["month"] / 12)
    g["is_weekend"] = (g["dayofweek"] >= 5).astype(int)

    # --- forecast target: next hour's consumption ---
    g["target_next_1h"] = g["consumption_kwh"].shift(-1)
    g["target_next_24h"] = g["consumption_kwh"].shift(-24)   # next-day same hour

    g = g.dropna().reset_index(drop=True)
    return g

for node_id, g in df.groupby("node_id"):
    processed = add_features(g)
    out_path = f"data/processed_{node_id}.csv"
    processed.to_csv(out_path, index=False)
    print(f"{node_id}: {len(processed):,} rows -> {out_path}")
