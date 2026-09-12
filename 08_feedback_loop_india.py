"""
STEP 8 — FEEDBACK LOOP — diagram box 9b
=============================================
Collects "actual vs predicted" once real values become available, and
appends them to a running feedback log. In production this would be
triggered automatically as new smart-meter readings arrive; here it's
a script you run manually to append the next available day(s) of
actual data — simulating an operator confirming what really happened.

This log is what 07_monitor_retrain_india.py's drift detection reads
from in a fuller implementation, and it's also useful evidence on its
own: a table of "here's how right we were" is something a panel can
look at directly.
"""
import os
import joblib
import pandas as pd

NODE, TARGET, MODEL_NAME = "Maharashtra", "target_next_1d", "XGBoost"
N_RECENT_DAYS = 10   # how many of the most recent rows to log this run

df = pd.read_csv(f"data/processed_{NODE}.csv", parse_dates=["timestamp"])
FEATS = [c for c in df.columns if c.startswith("lag_") or c.startswith("roll_")] + \
        ["temperature_c", "humidity", "is_holiday",
         "dow_sin", "dow_cos", "month_sin", "month_cos",
         "doy_sin", "doy_cos", "is_weekend"]

model = joblib.load(f"models/{NODE}_{TARGET}_{MODEL_NAME}.pkl")

recent = df.iloc[-N_RECENT_DAYS:].copy()
recent["predicted_mu"] = model.predict(recent[FEATS])
recent["actual_mu"] = recent[TARGET]
recent["abs_error"] = (recent["predicted_mu"] - recent["actual_mu"]).abs()
recent["pct_error"] = (recent["abs_error"] / recent["actual_mu"].clip(lower=0.01)) * 100
recent["node"] = NODE
recent["model_used"] = MODEL_NAME

feedback_row = recent[["timestamp", "node", "model_used", "predicted_mu",
                        "actual_mu", "abs_error", "pct_error"]]

os.makedirs("outputs", exist_ok=True)
log_path = "outputs/feedback_log_india.csv"
if os.path.exists(log_path):
    existing = pd.read_csv(log_path, parse_dates=["timestamp"])
    combined = pd.concat([existing, feedback_row], ignore_index=True)
    combined = combined.drop_duplicates(subset=["timestamp", "node", "model_used"], keep="last")
else:
    combined = feedback_row
combined = combined.sort_values("timestamp")
combined.to_csv(log_path, index=False)

print(f"Logged {len(feedback_row)} feedback rows for {NODE} -> {log_path}")
print(f"\nRunning accuracy summary (all logged rows, {NODE}):")
print(f"  Mean absolute error: {combined['abs_error'].mean():.3f} MU")
print(f"  Mean % error:        {combined['pct_error'].mean():.2f}%")
print("\nMost recent entries:")
print(feedback_row.to_string(index=False))
