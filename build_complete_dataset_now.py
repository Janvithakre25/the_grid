"""
Builds a COMPLETE dataset with every column your project needs, using
the REAL UCI consumption data + climatologically realistic (not measured)
weather for Paris, so you have a full file to work with today.
Swap in data/weather_sceaux_real.csv (from 06_fetch_real_weather.py) later
for genuine measured weather.
"""
import numpy as np
import pandas as pd

df = pd.read_csv("data/energy_data_real_uci.csv", parse_dates=["timestamp"])

# Realistic Paris seasonal temperature curve + daily cycle + noise
doy = df["timestamp"].dt.dayofyear
hour = df["timestamp"].dt.hour
seasonal = 11 + 9 * np.sin(2 * np.pi * (doy - 105) / 365)   # ~2C Jan, ~20C Jul avg
daily_cycle = 3 * np.sin(2 * np.pi * (hour - 9) / 24)
np.random.seed(1)
noise = np.random.normal(0, 1.8, len(df))
df["temperature_c"] = (seasonal + daily_cycle + noise).round(1)

humidity_base = 75 - 0.6 * (df["temperature_c"] - 10)
df["humidity"] = (humidity_base + np.random.normal(0, 6, len(df))).clip(30, 100).round(1)

french_holidays = {"01-01", "05-01", "05-08", "07-14", "08-15", "11-01", "11-11", "12-25"}
df["is_holiday"] = df["timestamp"].dt.strftime("%m-%d").isin(french_holidays).astype(int)

# --- derive feeder & substation nodes by aggregating scaled/jittered
#     versions of the real household signal (transparent, documented
#     synthetic aggregation, standard practice given no public
#     feeder/substation smart-meter data exists) ---
def make_node(base, node_id, node_type, scale, n_agg):
    g = df.copy()
    agg = np.zeros(len(df))
    rng = np.random.default_rng(hash(node_id) % (2**32))
    for i in range(n_agg):
        jitter = rng.normal(1.0, 0.12, len(df))
        agg += base["consumption_kwh"].values * jitter
    g["consumption_kwh"] = (agg / n_agg) * scale
    g["node_id"] = node_id
    g["node_type"] = node_type
    return g

feeder = make_node(df, "F1_derived", "feeder", scale=25, n_agg=25)
substation = make_node(df, "S1_derived", "substation", scale=400, n_agg=400)

full = pd.concat([df, feeder, substation], ignore_index=True)
full = full[["timestamp", "node_id", "node_type", "consumption_kwh",
             "temperature_c", "humidity", "is_holiday", "hour", "dayofweek", "month"]]

full.to_csv("data/energy_data_complete.csv", index=False)
print(f"Saved {len(full):,} rows -> data/energy_data_complete.csv")
print(f"Columns: {list(full.columns)}")
print(f"Nodes: {full['node_id'].unique().tolist()}")
print(full.head())
