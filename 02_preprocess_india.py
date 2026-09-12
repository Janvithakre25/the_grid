"""
STEP 2 — PREPROCESSING & FEATURE ENGINEERING (India, daily, multi-state)
============================================================================
Adapted from the original 02_preprocess.py. Key differences from the
UCI/hourly version:
  - lag_1h/24h/168h  ->  lag_1d/7d/30d   (daily grain: prev day, prev
    week same weekday, prev month)
  - roll_*_24h/7d    ->  roll_*_7d/30d
  - hour_sin/cos     ->  dropped (no intra-day resolution in this data)
  - added dayofyear_sin/cos to capture yearly seasonality, which
    matters more at daily grain than month alone
  - target_next_1h/24h  ->  target_next_1d/7d  (short-term daily,
    medium-term weekly — matches your synopsis's own definition)

Reads: data/energy_data_india_final.csv (after weather is merged by
06_fetch_real_weather_india.py). If that file doesn't exist yet, falls
back to data/energy_data_india.csv with NaN weather (fill in later).

Output: data/processed_<node_id>.csv, one per state (33 files)
"""
import os
import numpy as np
import pandas as pd

SRC_WITH_WEATHER = "data/energy_data_india_final.csv"
SRC_NO_WEATHER = "data/energy_data_india.csv"

src = SRC_WITH_WEATHER if os.path.exists(SRC_WITH_WEATHER) else SRC_NO_WEATHER
print(f"Reading {src}")
df = pd.read_csv(src, parse_dates=["timestamp"])

if "temperature_c" not in df.columns:
    print("WARNING: no weather merged yet — run 06_fetch_real_weather_india.py first "
          "for real temperature/humidity. Proceeding with placeholders for now.")
    df["temperature_c"] = np.nan
    df["humidity"] = np.nan


def add_features(g: pd.DataFrame) -> pd.DataFrame:
    g = g.sort_values("timestamp").reset_index(drop=True)

    # --- drop stray out-of-range dates per node (keep the dense core range) ---
    # source data has a few scraping artifacts beyond the documented
    # Jan-2019 to May-2020 window; guard against sparse tail data
    # skewing rolling stats
    g = g[(g["timestamp"] >= "2019-01-01") & (g["timestamp"] <= "2020-06-30")].reset_index(drop=True)

    # --- missing value handling ---
    g["consumption_mu"] = g["consumption_mu"].interpolate(limit_direction="both")
    g["temperature_c"] = g["temperature_c"].interpolate(limit_direction="both")
    g["humidity"] = g["humidity"].interpolate(limit_direction="both")

    # --- outlier handling (IQR-style clip, same principle as before) ---
    q1, q3 = g["consumption_mu"].quantile([0.01, 0.99])
    g["consumption_mu"] = g["consumption_mu"].clip(q1, q3)

    # --- lag features: prev day, prev week (same weekday), prev month ---
    for lag in (1, 7, 30):
        g[f"lag_{lag}d"] = g["consumption_mu"].shift(lag)

    # --- rolling window stats ---
    g["roll_mean_7d"] = g["consumption_mu"].rolling(7).mean()
    g["roll_std_7d"] = g["consumption_mu"].rolling(7).std()
    g["roll_mean_30d"] = g["consumption_mu"].rolling(30).mean()

    # --- cyclical time encoding ---
    g["dow_sin"] = np.sin(2 * np.pi * g["dayofweek"] / 7)
    g["dow_cos"] = np.cos(2 * np.pi * g["dayofweek"] / 7)
    g["month_sin"] = np.sin(2 * np.pi * g["month"] / 12)
    g["month_cos"] = np.cos(2 * np.pi * g["month"] / 12)
    g["doy_sin"] = np.sin(2 * np.pi * g["dayofyear"] / 365)
    g["doy_cos"] = np.cos(2 * np.pi * g["dayofyear"] / 365)

    # --- forecast targets ---
    g["target_next_1d"] = g["consumption_mu"].shift(-1)
    g["target_next_7d"] = g["consumption_mu"].shift(-7)

    g = g.dropna().reset_index(drop=True)
    return g


os.makedirs("data", exist_ok=True)
summary = []
for node_id, g in df.groupby("node_id"):
    processed = add_features(g)
    safe_name = node_id.replace(" ", "_").replace("&", "and")
    out_path = f"data/processed_{safe_name}.csv"
    processed.to_csv(out_path, index=False)
    summary.append((node_id, len(processed), out_path))

for node_id, n, path in summary:
    print(f"{node_id:20s} {n:4d} rows -> {path}")
