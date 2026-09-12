"""
Run this on YOUR machine (Open-Meteo isn't reachable from this sandbox).
Pulls REAL historical daily weather for each of the 33 Indian states,
using each state's lat/long already present in energy_data_india.csv
(one representative point per state — its capital/major-city
coordinate, as scraped in the original POSOCO dataset).

Takes ~1-2 minutes for 33 states (one API call each), no API key needed.
"""
import time
import requests
import pandas as pd

energy = pd.read_csv("data/energy_data_india.csv", parse_dates=["timestamp"])

START_DATE = energy["timestamp"].min().strftime("%Y-%m-%d")
END_DATE = energy["timestamp"].max().strftime("%Y-%m-%d")

# one lat/long per state (they're constant per node_id in this dataset)
state_coords = energy.groupby("node_id")[["latitude", "longitude"]].first()

url = "https://archive-api.open-meteo.com/v1/archive"
weather_frames = []

print(f"Fetching real historical daily weather for {len(state_coords)} states, "
      f"{START_DATE} to {END_DATE}...")

for node_id, row in state_coords.iterrows():
    params = {
        "latitude": row["latitude"],
        "longitude": row["longitude"],
        "start_date": START_DATE,
        "end_date": END_DATE,
        "daily": "temperature_2m_mean,relative_humidity_2m_mean",
        "timezone": "Asia/Kolkata",
    }
    resp = requests.get(url, params=params)
    resp.raise_for_status()
    data = resp.json()["daily"]

    w = pd.DataFrame({
        "timestamp": pd.to_datetime(data["time"]),
        "node_id": node_id,
        "temperature_c": data["temperature_2m_mean"],
        "humidity": data["relative_humidity_2m_mean"],
    })
    weather_frames.append(w)
    print(f"  {node_id:20s} done ({len(w)} days)")
    time.sleep(0.3)  # be polite to the free API

weather = pd.concat(weather_frames, ignore_index=True)
weather.to_csv("data/weather_india_real.csv", index=False)
print(f"\nSaved {len(weather):,} rows -> data/weather_india_real.csv")

# ---- merge with energy data ----
merged = energy.merge(weather, on=["timestamp", "node_id"], how="left")
merged["temperature_c"] = merged.groupby("node_id")["temperature_c"].transform(
    lambda s: s.interpolate(limit_direction="both")
)
merged["humidity"] = merged.groupby("node_id")["humidity"].transform(
    lambda s: s.interpolate(limit_direction="both")
)

merged.to_csv("data/energy_data_india_final.csv", index=False)
print(f"Final merged file saved -> data/energy_data_india_final.csv")
print(f"Columns: {list(merged.columns)}")
print(merged.head())
