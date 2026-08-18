"""
STEP 3c — PROPHET MODEL (matches your synopsis diagram exactly)
===================================================================
Adds Prophet to your model comparison. Prophet is built specifically
for time series with strong seasonal patterns and holiday effects --
a natural fit alongside RF/XGBoost.

Run this AFTER 03_train_models.py (uses the same processed data files).
Appends Prophet's results into outputs/model_comparison.csv and
recomputes outputs/best_models.csv.
"""
import numpy as np
import pandas as pd
from prophet import Prophet
from sklearn.metrics import mean_absolute_error, mean_squared_error
import logging
logging.getLogger("prophet").setLevel(logging.WARNING)
logging.getLogger("cmdstanpy").setLevel(logging.WARNING)

NODES = ["UCI_H1", "F1_derived", "S1_derived"]   # match 03_train_models.py
HORIZONS = {"target_next_1h": ("short-term (1h)", 1), "target_next_24h": ("medium-term (24h)", 24)}

results = []

for node_id in NODES:
    df = pd.read_csv(f"data/processed_{node_id}.csv", parse_dates=["timestamp"])
    split_idx = int(len(df) * 0.8)
    train, test = df.iloc[:split_idx], df.iloc[split_idx:]

    for target_col, (horizon_name, shift) in HORIZONS.items():
        # Prophet needs columns named exactly 'ds' (date) and 'y' (value)
        prophet_train = train[["timestamp", "consumption_kwh"]].rename(
            columns={"timestamp": "ds", "consumption_kwh": "y"}
        )

        model = Prophet(
            daily_seasonality=True,
            weekly_seasonality=True,
            yearly_seasonality=True,
            changepoint_prior_scale=0.05,
        )
        # add holiday effect as an extra regressor (matches your synopsis's
        # "holiday effects" objective)
        model.add_regressor("is_holiday")
        prophet_train["is_holiday"] = train["is_holiday"].values
        model.fit(prophet_train)

        # forecast over the test period, shifted by the horizon
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

# merge with existing RF/XGBoost results
existing = pd.read_csv("outputs/model_comparison.csv")
combined = pd.concat([existing, prophet_results], ignore_index=True)
combined.to_csv("outputs/model_comparison.csv", index=False)

best = combined.loc[combined.groupby(["node", "horizon"])["MAE"].idxmin()]
best.to_csv("outputs/best_models.csv", index=False)

print("\nUpdated full comparison:")
print(combined.to_string(index=False))
print("\nUpdated best model per node/horizon:")
print(best.to_string(index=False))
