"""
Run this on YOUR machine (not restricted like my sandbox) to pull REAL
historical weather for Sceaux, France, matching the UCI dataset's exact
date range. Takes ~10 seconds, no API key needed.
"""
import requests
import pandas as pd

url = "https://archive-api.open-meteo.com/v1/archive"
params = {
    "latitude": 48.778,
    "longitude": 2.29,
    "start_date": "2006-12-16",
    "end_date": "2010-11-26",
    "hourly": "temperature_2m,relative_humidity_2m",
    "timezone": "Europe/Berlin",   # UCI timestamps are local French time (CET/CEST)
}

print("Fetching real historical weather from Open-Meteo...")
resp = requests.get(url, params=params)
resp.raise_for_status()
data = resp.json()["hourly"]

weather = pd.DataFrame({
    "timestamp": pd.to_datetime(data["time"]),
    "temperature_c": data["temperature_2m"],
    "humidity": data["relative_humidity_2m"],
})
weather.to_csv("data/weather_sceaux_real.csv", index=False)
print(f"Saved {len(weather):,} rows -> data/weather_sceaux_real.csv")
print(weather.head())

# ---- Now merge with your energy data ----

energy = pd.read_csv("data/energy_data_complete.csv", parse_dates=["timestamp"])
energy = energy.drop(columns=["temperature_c", "humidity"])  # drop the placeholders
merged = energy.merge(weather, on="timestamp", how="left")
merged["temperature_c"] = merged["temperature_c"].interpolate(limit_direction="both")
merged["humidity"] = merged["humidity"].interpolate(limit_direction="both")

# French public holidays (main ones, 2006-2010) — add/adjust as needed
french_holidays = {
    "01-01", "05-01", "05-08", "07-14", "08-15", "11-01", "11-11", "12-25"
}
merged["is_holiday"] = merged["timestamp"].dt.strftime("%m-%d").isin(french_holidays).astype(int)

merged.to_csv("data/energy_data_final.csv", index=False)
print(f"\nFinal merged file saved -> data/energy_data_complete.csv")
print(f"Columns: {list(merged.columns)}")
print(merged.head())
