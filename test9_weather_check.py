import pandas as pd

# --- corrected J&K check (actual column value is "J&K", not "JandK") ---
df = pd.read_csv("data/energy_data_india_final.csv")
jk = df[df["node_id"] == "J&K"]
print("J&K rows found:", len(jk))
print("J&K temperature range:", jk["temperature_c"].min(), "to", jk["temperature_c"].max())
print("J&K humidity range:", jk["humidity"].min(), "to", jk["humidity"].max())
print("J&K temperature std (seasonal variation):", jk["temperature_c"].std())
print()

# --- trace duplicates back through the pipeline ---
print("=" * 60)
print("DUPLICATE TRACE")
print("=" * 60)

raw = pd.read_csv("data/long_data_.csv")
raw_dupes = raw.duplicated(subset=["States", "Dates"]).sum()
print(f"1. long_data_.csv (raw source) duplicate (State,Date) pairs: {raw_dupes}")

built = pd.read_csv("data/energy_data_india.csv")
built_dupes = built.duplicated(subset=["timestamp", "node_id"]).sum()
print(f"2. energy_data_india.csv (post-build) duplicate (timestamp,node_id) pairs: {built_dupes}")

weather = pd.read_csv("data/weather_india_real.csv")
weather_dupes = weather.duplicated(subset=["timestamp", "node_id"]).sum()
print(f"3. weather_india_real.csv duplicate (timestamp,node_id) pairs: {weather_dupes}")

final_dupes = df.duplicated(subset=["timestamp", "node_id"]).sum()
print(f"4. energy_data_india_final.csv (post-merge) duplicate (timestamp,node_id) pairs: {final_dupes}")

print()
print("Which states are affected? (top 10)")
dupe_rows = df[df.duplicated(subset=["timestamp", "node_id"], keep=False)]
print(dupe_rows["node_id"].value_counts().head(10))

print()
print("Sample of actual duplicate rows (first 6):")
print(dupe_rows.sort_values(["node_id", "timestamp"]).head(6).to_string(index=False))
