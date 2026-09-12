"""
STEP 1 — BUILD INDIA DATASET (replaces build_complete_dataset_now.py)
========================================================================
Loads the real POSOCO-sourced state-wise power consumption dataset
(33 Indian states/UTs, daily, real data — no synthetic aggregation
needed this time, unlike the old F1_derived/S1_derived hack).

Source: long_data_.csv
  columns: States, Regions, latitude, longitude, Dates, Usage (MU)

Output: data/energy_data_india.csv
  columns: timestamp, node_id, region, latitude, longitude,
           consumption_mu, year, month, dayofweek, dayofyear,
           is_weekend, is_holiday

NOTE ON GRANULARITY: this data is DAILY, not hourly like the old UCI
household data. This actually matches your synopsis wording better —
it defines short-term as "hourly/daily" and medium-term as
"weekly/monthly". So daily state-level data fits short-term daily +
medium-term weekly/monthly directly, no reframing needed.

NOTE ON NODES: the 33 states ARE your real multi-node structure now.
No more synthetic F1_derived/S1_derived jitter — every node here is
real POSOCO-reported data. Mention this upgrade explicitly in your
report; it's a genuine strength vs. the old single-household base.
"""
import pandas as pd
import holidays

SRC = "data/long_data_.csv"
OUT = "data/energy_data_india.csv"

df = pd.read_csv(SRC, parse_dates=["Dates"], dayfirst=True)

df = df.rename(columns={
    "States": "node_id",
    "Regions": "region",
    "Dates": "timestamp",
    "Usage": "consumption_mu",
})

# --- KNOWN COORDINATE FIX (found during audit) ---
# The original POSOCO scrape assigned J&K a coordinate (33.45, 76.24) that
# lands in the high-altitude Zanskar/Kishtwar Himalayan range, not a
# populated area. This produced physically implausible weather (-11C
# average, -29C extremes) once merged with Open-Meteo. Replaced with
# Srinagar's coordinate (J&K's summer capital, major population/grid
# demand center) as a representative point for the state.
COORDINATE_FIXES = {
    "J&K": {"latitude": 34.0837, "longitude": 74.7973},  # Srinagar
}
for state, coords in COORDINATE_FIXES.items():
    df.loc[df["node_id"] == state, "latitude"] = coords["latitude"]
    df.loc[df["node_id"] == state, "longitude"] = coords["longitude"]
    print(f"Applied coordinate fix for {state}: {coords}")

# --- KNOWN DUPLICATE-DATE FIX (found during audit) ---
# The raw POSOCO-scraped source contains 165 duplicate (state, date) pairs
# (5 per state, across all 33 states) — almost certainly from overlapping
# weekly reports where a date's preliminary figure was slightly revised in
# the following week's report (e.g. Andhra Pradesh 2019-07-08 appeared as
# both 168.7 and 170.6 MU). Left unresolved, this silently shifts every
# lag/rolling feature by one row for the rest of that state's series.
# Resolved by averaging duplicate readings per (state, date) — a neutral
# choice since we have no reliable way to know which figure was "correct."
before_rows = len(df)
df = df.groupby(["node_id", "timestamp"], as_index=False).agg({
    "region": "first",
    "latitude": "first",
    "longitude": "first",
    "consumption_mu": "mean",
})
removed = before_rows - len(df)
print(f"Deduplicated {removed} rows (averaged duplicate state-date readings)")

df = df.sort_values(["node_id", "timestamp"]).reset_index(drop=True)

# --- calendar features ---
df["year"] = df["timestamp"].dt.year
df["month"] = df["timestamp"].dt.month
df["dayofweek"] = df["timestamp"].dt.dayofweek
df["dayofyear"] = df["timestamp"].dt.dayofyear
df["is_weekend"] = (df["dayofweek"] >= 5).astype(int)

# --- Indian public holidays (real calendar, via `holidays` package) ---
years = df["year"].unique().tolist()
in_holidays = holidays.India(years=years)
df["is_holiday"] = df["timestamp"].dt.date.astype(str).isin(
    {str(d) for d in in_holidays.keys()}
).astype(int)

df = df[["timestamp", "node_id", "region", "latitude", "longitude",
         "consumption_mu", "year", "month", "dayofweek", "dayofyear",
         "is_weekend", "is_holiday"]]

df.to_csv(OUT, index=False)
print(f"Saved {len(df):,} rows -> {OUT}")
print(f"Nodes ({df['node_id'].nunique()}): {sorted(df['node_id'].unique().tolist())}")
print(f"Date range: {df['timestamp'].min().date()} to {df['timestamp'].max().date()}")
print(df.head())
