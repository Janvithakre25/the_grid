"""
STEP 5 — RECOMMENDATION ENGINE — India version
==================================================
Same rule-based logic as the original, retargeted to daily MU forecasts
per state instead of hourly kWh per household.
"""
import joblib
import pandas as pd

NODE, TARGET, MODEL_NAME = "Maharashtra", "target_next_1d", "XGBoost"

df = pd.read_csv(f"data/processed_{NODE}.csv", parse_dates=["timestamp"])
FEATS = [c for c in df.columns if c.startswith("lag_") or c.startswith("roll_")] + \
        ["temperature_c", "humidity", "is_holiday",
         "dow_sin", "dow_cos", "month_sin", "month_cos",
         "doy_sin", "doy_cos", "is_weekend"]
model = joblib.load(f"models/{NODE}_{TARGET}_{MODEL_NAME}.pkl")

HIGH_LOAD_PCT = 0.90
LOW_LOAD_PCT = 0.10

hist = df["consumption_mu"]
high_thresh = hist.quantile(HIGH_LOAD_PCT)
low_thresh = hist.quantile(LOW_LOAD_PCT)


def recommend(predicted_load: float, temp: float, is_weekend: bool, is_holiday: bool) -> dict:
    if predicted_load >= high_thresh:
        if temp >= 35:
            action = ("Peak-shaving: pre-cool via HVAC scheduling; issue demand-response "
                       "alert for industrial/agricultural flexible loads.")
        else:
            action = "Trigger demand-response alert; suggest shifting flexible loads to off-peak hours."
        severity = "HIGH"
    elif predicted_load <= low_thresh:
        action = "Low-demand window: good opportunity for grid maintenance / renewable curtailment absorption."
        severity = "LOW"
    else:
        action = "Normal range — no action needed."
        severity = "NORMAL"
    return {"predicted_load_mu": round(predicted_load, 2), "severity": severity, "action": action}


sample = df[FEATS].iloc[-10:]
preds = model.predict(sample)
meta = df.iloc[-10:][["timestamp", "temperature_c", "is_weekend", "is_holiday"]].reset_index(drop=True)

print(f"State: {NODE}")
print(f"{'timestamp':20s} {'pred_MU':>9s}  {'severity':8s}  action")
for i in range(len(sample)):
    rec = recommend(preds[i], meta.loc[i, "temperature_c"], meta.loc[i, "is_weekend"], meta.loc[i, "is_holiday"])
    print(f"{str(meta.loc[i,'timestamp']):20s} {rec['predicted_load_mu']:9.2f}  {rec['severity']:8s}  {rec['action']}")
