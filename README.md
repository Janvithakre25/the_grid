# Energy Consumption Forecasting in Smart Grids — Execution Guide

## 1. Setup

```bash
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

pip install pandas numpy scikit-learn xgboost shap matplotlib
# For LSTM/GRU (run on Colab if your machine is low on space/no GPU):
pip install torch --index-url https://download.pytorch.org/whl/cpu
```

## 2. Run the pipeline, in order

```bash
python3 01_generate_data.py          # creates data/energy_data.csv
python3 02_preprocess.py             # creates data/processed_<node>.csv
python3 03_train_models.py           # trains RF + XGBoost, saves outputs/model_comparison.csv
python3 03b_train_deep_models.py     # trains LSTM + GRU (run on Colab — needs torch)
python3 04_shap_explain.py           # creates outputs/shap_summary.png + explanation table
python3 05_recommendation_engine.py  # prints forecast -> alert demo
```

Each script reads the previous script's output — run them in order the first time.

## 3. Switching to a real dataset (do this before final submission)

Script `01_generate_data.py` currently makes synthetic-but-realistic data
so the whole pipeline runs today. Replace it with real data:

| Option | Best for | Link |
|---|---|---|
| UCI Household Power Consumption | Household-level, very well-known in literature | archive.ics.uci.edu/dataset/235 |
| Kaggle Smart Meters in London | Multiple households + weather, matches your "household level" objective | kaggle.com/datasets/jeanmidev/smart-meters-in-london |
| Kaggle PJM Hourly Energy Consumption | Feeder/substation-scale, clean, minimal prep | kaggle.com/datasets/robikscube/hourly-energy-consumption |

Steps:
1. Download the CSV(s).
2. Reshape/rename columns to match this schema:
   `timestamp, node_id, node_type, consumption_kwh, temperature_c, humidity, is_holiday, hour, dayofweek, month`
3. Save as `data/energy_data.csv`.
4. Re-run scripts 02 onward unchanged — nothing else needs to change.
5. Merge in weather via a free API if your dataset lacks it: Open-Meteo
   (open-meteo.com) needs no API key — good for the "external data sources" objective.

## 4. Dashboard (Step 6 — not included here)

Once models + SHAP + recommendations work (steps 1–5 above), wrap them in:
- **FastAPI backend**: one `/forecast/{node_id}` endpoint that loads the
  saved `.pkl`/`.pt` model, runs `04`/`05` logic, returns JSON.
- **React frontend**: polls that endpoint, renders a chart (recharts) +
  the SHAP top-factors list + the recommendation banner.
- Simulate "real-time" by replaying historical rows on a timer — this is
  a normal, acceptable simplification to state explicitly in your report.

## 5. What to show the panel

1. Run `03_train_models.py` live — show the per-node/per-horizon
   "best model" table (`outputs/best_models.csv`) and explain *why*
   different models win in different situations.
2. Show `outputs/shap_summary.png`, then walk through the single
   example in `04_shap_explain.py`'s printed output — "on this hot
   afternoon, the model raised its forecast mainly because of X, Y, Z."
3. Run `05_recommendation_engine.py` live to show forecast → alert.
4. If dashboard is built: click through it live rather than showing slides.
