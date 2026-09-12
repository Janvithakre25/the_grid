"""
STEP 4 — EXPLAINABLE AI LAYER (SHAP) — India version
========================================================
Same as 04_shap_explain.py, retargeted to a state node + the daily
feature set. Change NODE below to demo a different state for the panel
(e.g. "Maharashtra" for a large/industrial state, "Kerala" for a
weather-sensitive one).
"""
import joblib
import pandas as pd
import shap
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

NODE, TARGET, MODEL_NAME = "Maharashtra", "target_next_1d", "XGBoost"

df = pd.read_csv(f"data/processed_{NODE}.csv", parse_dates=["timestamp"])
FEATS = [c for c in df.columns if c.startswith("lag_") or c.startswith("roll_")] + \
        ["temperature_c", "humidity", "is_holiday",
         "dow_sin", "dow_cos", "month_sin", "month_cos",
         "doy_sin", "doy_cos", "is_weekend"]

model = joblib.load(f"models/{NODE}_{TARGET}_{MODEL_NAME}.pkl")
X_test = df[FEATS].iloc[-90:]   # last 90 days as a sample

explainer = shap.TreeExplainer(model)
shap_values = explainer(X_test)

plt.figure()
shap.summary_plot(shap_values, X_test, show=False)
plt.tight_layout()
plt.savefig("outputs/shap_summary_india.png", dpi=120)
plt.close()
print("Saved outputs/shap_summary_india.png")

# pick the hottest day in the sample window as the demo explanation
hot_idx = X_test["temperature_c"].idxmax()
row_pos = X_test.index.get_loc(hot_idx)
row_shap = shap_values[row_pos]

contributions = pd.DataFrame({
    "feature": FEATS,
    "value": X_test.iloc[row_pos].values,
    "shap_impact": row_shap.values,
}).sort_values("shap_impact", key=abs, ascending=False)

print(f"\nExplaining forecast for: {df.loc[hot_idx, 'timestamp']} ({NODE})")
print(f"Predicted next-day consumption: {model.predict(X_test.iloc[[row_pos]])[0]:.2f} MU")
print("\nTop contributing factors:")
print(contributions.head(6).to_string(index=False))

contributions.to_csv("outputs/shap_example_explanation_india.csv", index=False)
