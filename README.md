# Energy Consumption Forecasting in Smart Grids — Execution Guide (India dataset)

> Updated from the original UCI/France-based README. The pipeline logic
> is unchanged in spirit (build → preprocess → train → explain →
> recommend); only step 1 (data source) and the daily-vs-hourly grain
> changed. See "What changed" at the bottom.

## 1. Setup

```bash
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

pip install pandas numpy scikit-learn xgboost shap matplotlib holidays requests prophet
# For LSTM/GRU (run on Colab if your machine is low on space/no GPU):
pip install torch --index-url https://download.pytorch.org/whl/cpu
```

## 2. Run the pipeline, in order

```bash
python3 01_build_india_dataset.py       # creates data/energy_data_india.csv (33 states, real POSOCO data)
python3 06_fetch_real_weather_india.py  # MUST run on your machine, not a sandboxed one — hits Open-Meteo
                                         # per state (~1-2 min), creates data/energy_data_india_final.csv
python3 02_preprocess_india.py          # creates data/processed_<state>.csv (33 files)
python3 03_train_models_india.py        # trains RF + XGBoost across all 33 states x 2 horizons
                                         # saves outputs/model_comparison_india.csv
python3 03b_train_deep_models_india.py  # trains LSTM + GRU for one state (change NODE var) — run on Colab
python3 03c_train_prophet_india.py      # adds Prophet results into the same comparison table
python3 04_shap_explain_india.py        # creates outputs/shap_summary_india.png + explanation table
python3 05_recommendation_engine_india.py  # prints forecast -> alert demo
```

Each script reads the previous script's output — run them in order the
first time. `06_fetch_real_weather_india.py` is the one step that
cannot run in a restricted/offline sandbox — do this one locally
before `02_preprocess_india.py`, or `02` will proceed with blank
weather columns and print a warning.

## 3. Dataset

Source: POSOCO (Power System Operation Corporation, Govt. of India)
weekly energy reports, scraped state-wise, Jan 2019 – May 2020, daily
granularity. 33 real states/UTs — no synthetic node aggregation.

Schema (`data/energy_data_india.csv`):
`timestamp, node_id, region, latitude, longitude, consumption_mu, year, month, dayofweek, dayofyear, is_weekend, is_holiday`

After weather merge (`data/energy_data_india_final.csv`):
adds `temperature_c, humidity`.

## 4. Dashboard 

Once models + SHAP + recommendations work (steps 1–7 above), wrap them in:
- **FastAPI backend**: one `/forecast/{state}` endpoint that loads the
  saved `.pkl`/`.pt` model for that state, runs `04`/`05` logic, returns JSON.
- **React frontend**: dropdown to pick a state, chart (recharts) of
  forecast vs actual, SHAP top-factors list, recommendation banner.
- Simulate "real-time" by replaying historical rows on a timer — state
  this explicitly as a simplification in your report, since the
  underlying data itself is daily, not streaming.

## 5. What to show the panel

1. Run `03_train_models_india.py` live (or show pre-run output) — the
   per-state/per-horizon "best model" table (`outputs/best_models_india.csv`).
   Point out that different states favor different models (e.g.
   industrial states with volatile load may favor XGBoost; smaller
   states with stable patterns may favor RandomForest).
2. Show `outputs/shap_summary_india.png`, then walk through the single
   example in `04_shap_explain_india.py`'s printed output — "on this
   hot day in Maharashtra, the model raised its forecast mainly
   because of lag_1d, temperature, and day-of-week."
3. Run `05_recommendation_engine_india.py` live to show forecast → alert.
4. Be ready to answer: *"Is this really real-time?"* — Honest answer:
   the underlying POSOCO data is daily-reported, not streaming. Frame
   the dashboard as replaying historical data on a timer to simulate
   real-time behavior, and note that a production version would need a
   live SCADA/smart-meter feed (mentioned in your synopsis's tech stack
   as MQTT ingestion) to be genuinely real-time.

## 6. What changed from the original (UCI/France) version

| | Old | New |
|---|---|---|
| Data source | Synthetic-then-real UCI household (Sceaux, France) | Real POSOCO state-wise data (India) |
| Grain | Hourly | Daily |
| Nodes | 1 real household + 2 **synthetic** derived nodes (F1, S1) | 33 **real** states/UTs |
| Horizons | `target_next_1h`, `target_next_24h` | `target_next_1d`, `target_next_7d` |
| Lag features | `lag_1h`, `lag_24h`, `lag_168h` | `lag_1d`, `lag_7d`, `lag_30d` |
| Time encoding | hour_sin/cos, month_sin/cos | dow_sin/cos, month_sin/cos, doy_sin/cos |
| Holidays | Hardcoded French dates | `holidays` package, real Indian calendar |
| Weather | Open-Meteo, Sceaux coordinates | Open-Meteo, per-state coordinates (33 calls) |

Why this is a stronger submission: the multi-node structure is now
genuinely real data instead of one household jittered into fake
feeder/substation nodes — a panel is far more likely to probe "is this
data real?" than any other single question, and now the honest answer
is yes across all 33 nodes.
