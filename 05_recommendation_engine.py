"""
STEP 5 — RECOMMENDATION ENGINE
=================================
Converts forecast + SHAP explanation into a concrete action.
Rule-based to start (transparent, easy to defend to a panel) —
mention in your report this can later be upgraded to a learned
policy (e.g. RL) as future work.
"""
import joblib
import pandas as pd

NODE, TARGET, MODEL_NAME = "UCI_H1", "target_next_1h", "XGBoost"

df = pd.read_csv(f"data/processed_{NODE}.csv", parse_dates=["timestamp"])
FEATS = [c for c in df.columns if c.startswith("lag_") or c.startswith("roll_")] + \
        ["temperature_c", "humidity", "is_holiday", "hour_sin", "hour_cos",
         "month_sin", "month_cos", "is_weekend"]
model = joblib.load(f"models/{NODE}_{TARGET}_{MODEL_NAME}.pkl")

# thresholds — in a real system, calibrate these from historical percentiles
HIGH_LOAD_PCT = 0.90     # top 10% of historical load = "high"
LOW_LOAD_PCT = 0.10

hist = df["consumption_kwh"]
high_thresh = hist.quantile(HIGH_LOAD_PCT)
low_thresh = hist.quantile(LOW_LOAD_PCT)


def recommend(predicted_load: float, temp: float, is_weekend: bool, is_holiday: bool) -> dict:
    if predicted_load >= high_thresh:
        if temp >= 32:
            action = "Peak-shaving: pre-cool via HVAC scheduling; send demand-response alert to flexible loads (EV chargers, water heaters)."
        else:
            action = "Trigger demand-response alert; suggest shifting flexible loads to off-peak hours."
        severity = "HIGH"
    elif predicted_load <= low_thresh:
        action = "Low-demand window: good opportunity for battery charging / scheduled maintenance."
        severity = "LOW"
    else:
        action = "Normal range — no action needed."
        severity = "NORMAL"
    return {"predicted_load_kwh": round(predicted_load, 3), "severity": severity, "action": action}


# demo: run on last 10 hours of test data
sample = df[FEATS].iloc[-10:]
preds = model.predict(sample)
meta = df.iloc[-10:][["timestamp", "temperature_c", "is_weekend", "is_holiday"]].reset_index(drop=True)

print(f"{'timestamp':20s} {'pred_kWh':>9s}  {'severity':8s}  action")
for i in range(len(sample)):
    rec = recommend(preds[i], meta.loc[i, "temperature_c"], meta.loc[i, "is_weekend"], meta.loc[i, "is_holiday"])
    print(f"{str(meta.loc[i,'timestamp']):20s} {rec['predicted_load_kwh']:9.3f}  {rec['severity']:8s}  {rec['action']}")
