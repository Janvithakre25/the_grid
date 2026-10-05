# Data Cleaning, Transformation & Feature Engineering Report

## Executive Summary
This report documents the rigorous data cleaning, alignment, quality audit, and time-series feature engineering performed on the Indian Smart Grid historical electricity dataset (covering **33 States and Union Territories**).

All original raw datasets were preserved untouched as immutable sources of truth, adhering strictly to non-destructive data processing requirements.

---

## 1. Raw Dataset Specifications & Source Audit

| Dataset File | File Size | Record Count | Number of Nodes | Date Range Covered | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `data/long_data_.csv` | 0.94 MB | 16,599 | 33 | 02/01/2019 to 05/12/2020 | Original POSOCO daily electricity consumption records (MU/GWh) |
| `data/energy_data_india.csv` | 1.07 MB | 16,434 | 33 | 2019-01-02 to 2020-12-05 | Deduplicated intermediate state dataset with holiday encodings |
| `data/weather_india_real.csv` | 0.63 MB | 16,434 | 33 | 2019-01-02 to 2020-12-05 | Open-Meteo historical daily temperature (°C) & humidity (%) |
| `data/energy_data_india_final.csv` | 1.20 MB | 16,434 | 33 | 2019-01-02 to 2020-12-05 | Merged target dataset aligning electricity, weather, & calendar |

---

## 2. Comprehensive Data Quality Audit Findings

### A. Duplicate Analysis & Deduplication Strategy
- **Raw Duplicates Found:** 12 exact duplicate rows and **165 duplicate `(State, Date)` combinations** across all 33 states in `long_data_.csv`.
- **Root Cause:** POSOCO scraping overlaps from consecutive weekly reports where preliminary demand figures were revised in subsequent reporting cycles (e.g., Andhra Pradesh on 2019-07-08 appeared as both 168.7 MU and 170.6 MU).
- **Technical Justification & Treatment:** Merged by taking the exact mathematical arithmetic mean per `(node_id, timestamp)` pair. Unresolved duplicates shift rolling window calculations. Deduplication reduced records from 16,599 to **16,434 clean daily records** (exactly 498 unique daily observations per state).

### B. Coordinate Audit & Fix for Jammu & Kashmir (J&K)
- **Issue Discovered:** The original POSOCO coordinate assigned to J&K (33.45°N, 76.24°E) fell in high-altitude uninhabited Himalayan mountains, resulting in extreme unrepresentative temperatures (-11°C mean, -29°C extreme).
- **Correction Applied:** Replaced with Srinagar city coordinates (**34.0837°N, 74.7973°E**), the summer capital and primary population/load center.

### C. Missing Values & Time-Series Gap Analysis
- **Missing Values:** 0 missing values in raw load data. Minor missing weather data points filled using forward/backward linear interpolation (`limit_direction='both'`).
- **Time-Series Gaps:** 498 unique observations across a 704-calendar-day range due to historical POSOCO publication gaps. Time-series order was strictly maintained per state series without shuffling.

### D. Outlier Detection & Treatment
- **Methodology:** Applied robust interquantile range clipping at **[1st percentile, 99th percentile]** per state series to remove non-physical telemetry spikes while maintaining true seasonal peaks.

---

## 3. Feature Engineering & Target Leakage Prevention

All features were computed strictly using past historical information available at prediction time ($t$).

### A. Engineered Feature Set

1. **Demand Lags:**
   - `lag_1d`: $y_{t-1}$ (Demand 1 day prior)
   - `lag_7d`: $y_{t-7}$ (Demand 7 days prior / same day last week)
   - `lag_30d`: $y_{t-30}$ (Demand 30 days prior / same day last month)

2. **Rolling Window Statistics:**
   - `roll_mean_7d`: 7-day moving average demand
   - `roll_std_7d`: 7-day moving standard deviation of demand
   - `roll_mean_30d`: 30-day moving average demand

3. **Weather & Environmental Features:**
   - `temperature_c`: Daily mean ambient temperature (°C)
   - `humidity`: Relative humidity (%)

4. **Temporal Cyclical Encodings & Calendar Features:**
   - `dow_sin`, `dow_cos`: Sine/Cosine cyclical transformation of Day of Week
   - `month_sin`, `month_cos`: Sine/Cosine transformation of Month of Year
   - `doy_sin`, `doy_cos`: Sine/Cosine transformation of Day of Year (captures annual seasonality)
   - `is_weekend`: Binary indicator ($1$ for Saturday/Sunday, $0$ otherwise)
   - `is_holiday`: Indian national and state public holiday indicator via Python `holidays` package

5. **Target Variables (Future Demand):**
   - `target_next_1d`: $y_{t+1}$ (1-day ahead short-term forecast target)
   - `target_next_7d`: $y_{t+7}$ (7-day ahead medium-term forecast target)

### B. Target Leakage Verification
- All lag features use strictly positive shift offsets (`shift(1)`, `shift(7)`, `shift(30)`).
- Targets use backward negative shifts (`shift(-1)`, `shift(-7)`).
- Zero future values or test partition targets leak into feature calculation matrices.

---

## 4. Processing Pipeline Flow Diagram

```
[Raw long_data_.csv] (16,599 rows, 33 states)
       │
       ▼ (01_build_india_dataset.py)
[Deduplicated & Holiday-Enriched energy_data_india.csv] (16,434 rows)
       │
       ▼ (06_fetch_real_weather_india.py)
[Merged Weather Dataset energy_data_india_final.csv] (16,434 rows, Temp & Humidity)
       │
       ▼ (02_preprocess_india.py)
[33 State Model-Ready CSVs: data/processed_<State>.csv]
```
