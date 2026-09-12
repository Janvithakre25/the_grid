"""
STEP 7 — CONTINUOUS MONITORING & RETRAINING — diagram box 9a
==================================================================
Simulates what a production system would do: periodically check if
the model's real-world accuracy has degraded (data drift), and
retrain if so. Since we don't have a live smart-meter feed, this
script "replays" the process on your existing test-set data —
document this simplification explicitly in your report.

What it actually does:
  1. Loads a trained model + its held-out test data
  2. Computes rolling MAE over the test period in windows (simulating
     "time passing" and new data arriving)
  3. Flags drift if a window's MAE exceeds a threshold relative to the
     model's original training-time MAE
  4. If drift is flagged, retrains the model on all available data
     (train+test) and overwrites the saved .pkl
  5. Logs every check to outputs/monitoring_log_india.csv, so you can
     show a "monitoring history" table to your panel

Run this any time you want to demonstrate/re-demonstrate the
monitoring story — it's safe to re-run repeatedly.
"""
import glob
import os
from datetime import datetime
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error
from xgboost import XGBRegressor

NODE, TARGET, MODEL_NAME = "Maharashtra", "target_next_1d", "XGBoost"
DRIFT_THRESHOLD_RATIO = 1.25   # flag drift if window MAE > 1.25x baseline MAE
WINDOW_SIZE = 14               # "simulate" checking every 14 days

df = pd.read_csv(f"data/processed_{NODE}.csv", parse_dates=["timestamp"])
FEATS = [c for c in df.columns if c.startswith("lag_") or c.startswith("roll_")] + \
        ["temperature_c", "humidity", "is_holiday",
         "dow_sin", "dow_cos", "month_sin", "month_cos",
         "doy_sin", "doy_cos", "is_weekend"]

model_path = f"models/{NODE}_{TARGET}_{MODEL_NAME}.pkl"
model = joblib.load(model_path)

split_idx = int(len(df) * 0.8)
train, test = df.iloc[:split_idx], df.iloc[split_idx:]
baseline_mae = mean_absolute_error(test[TARGET], model.predict(test[FEATS]))
print(f"Baseline (original) test MAE: {baseline_mae:.3f} MU")

log_rows = []
retrained = False

for start in range(0, len(test) - WINDOW_SIZE, WINDOW_SIZE):
    window = test.iloc[start:start + WINDOW_SIZE]
    preds = model.predict(window[FEATS])
    window_mae = mean_absolute_error(window[TARGET], preds)
    drift = window_mae > baseline_mae * DRIFT_THRESHOLD_RATIO

    log_rows.append({
        "checked_at": datetime.now().isoformat(timespec="seconds"),
        "window_start": str(window["timestamp"].iloc[0].date()),
        "window_end": str(window["timestamp"].iloc[-1].date()),
        "window_MAE": round(window_mae, 3),
        "baseline_MAE": round(baseline_mae, 3),
        "drift_flagged": drift,
    })

    if drift and not retrained:
        print(f"DRIFT DETECTED in window {window['timestamp'].iloc[0].date()} "
              f"(MAE {window_mae:.3f} > {baseline_mae*DRIFT_THRESHOLD_RATIO:.3f}) -> retraining...")
        full_train = pd.concat([train, test.iloc[:start + WINDOW_SIZE]])
        if MODEL_NAME == "XGBoost":
            new_model = XGBRegressor(n_estimators=300, max_depth=6, learning_rate=0.05,
                                      subsample=0.8, colsample_bytree=0.8, random_state=42, n_jobs=-1)
        else:
            new_model = RandomForestRegressor(n_estimators=200, max_depth=12, n_jobs=-1, random_state=42)
        new_model.fit(full_train[FEATS], full_train[TARGET])
        joblib.dump(new_model, model_path)
        model = new_model
        retrained = True
        print(f"Retrained and saved -> {model_path}")

log_df = pd.DataFrame(log_rows)
os.makedirs("outputs", exist_ok=True)
log_path = "outputs/monitoring_log_india.csv"
if os.path.exists(log_path):
    old = pd.read_csv(log_path)
    log_df = pd.concat([old, log_df], ignore_index=True)
log_df.to_csv(log_path, index=False)

print(f"\nLogged {len(log_rows)} monitoring checks -> {log_path}")
print(f"Retraining triggered this run: {retrained}")
print(log_df.tail(10).to_string(index=False))
