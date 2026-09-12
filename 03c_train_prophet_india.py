"""
STEP 3c — PROPHET MODEL — India version
============================================
Same as before, retargeted to daily state consumption. Prophet's
built-in weekly/yearly seasonality is a natural fit for daily state
load data (it needs at least ~2 full cycles of data to fit yearly
seasonality reliably; with ~14 months here it's usable but flag this
as a limitation in your report if a panelist asks).

Run AFTER 03_train_models_india.py.
"""
import glob
import os
import numpy as np
import pandas as pd
from prophet import Prophet
from sklearn.metrics import mean_absolute_error, mean_squared_error
import logging
logging.getLogger("prophet").setLevel(logging.WARNING)
logging.getLogger("cmdstanpy").setLevel(logging.WARNING)

HORIZONS = {"target_next_1d": "short-term (1 day)", "target_next_7d": "medium-term (7 day)"}

node_files = sorted(glob.glob("data/processed_*.csv"))
results = []

for path in node_files:
    node_id = os.path.basename(path).replace("processed_", "").replace(".csv", "")
    df = pd.read_csv(path, parse_dates=["timestamp"])
    if len(df) < 60:
        continue

    split_idx = int(len(df) * 0.8)
    train, test = df.iloc[:split_idx], df.iloc[split_idx:]

    for target_col, horizon_name in HORIZONS.items():
        prophet_train = train[["timestamp", "consumption_mu"]].rename(
            columns={"timestamp": "ds", "consumption_mu": "y"}
        )

        model = Prophet(
            daily_seasonality=False,   # no intra-day resolution in daily data
            weekly_seasonality=True,
            yearly_seasonality=True,
            changepoint_prior_scale=0.05,
        )
        model.add_regressor("is_holiday")
        prophet_train["is_holiday"] = train["is_holiday"].values
        model.fit(prophet_train)

        future = test[["timestamp", "is_holiday"]].rename(columns={"timestamp": "ds"})
        forecast = model.predict(future)

        y_true = test[target_col].values
        y_pred = forecast["yhat"].values[: len(y_true)]

        mae = mean_absolute_error(y_true, y_pred)
        rmse = np.sqrt(mean_squared_error(y_true, y_pred))
        mape = np.mean(np.abs((y_true - y_pred) / np.clip(y_true, 0.01, None))) * 100

        results.append({
            "node": node_id, "horizon": horizon_name, "model": "Prophet",
            "MAE": round(mae, 4), "RMSE": round(rmse, 4), "MAPE_%": round(mape, 2),
        })
        print(f"{node_id} | {horizon_name} | Prophet -> MAE={mae:.4f} RMSE={rmse:.4f}")

prophet_results = pd.DataFrame(results)

existing_path = "outputs/model_comparison_india.csv"
existing = pd.read_csv(existing_path)
combined = pd.concat([existing, prophet_results], ignore_index=True)
combined.to_csv(existing_path, index=False)

best = combined.loc[combined.groupby(["node", "horizon"])["MAE"].idxmin()]
best.to_csv("outputs/best_models_india.csv", index=False)

print("\nUpdated best model per node/horizon:")
print(best.to_string(index=False))
