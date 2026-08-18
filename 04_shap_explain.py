"""
STEP 4 — EXPLAINABLE AI LAYER (SHAP)
======================================
Loads the best model for node H1 / short-term horizon and explains
individual predictions. Saves a summary plot + a per-prediction
"top contributing factors" table (this is your demo centerpiece —
show this live to the panel).
"""
import joblib
import pandas as pd
import shap
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

NODE, TARGET, MODEL_NAME = "UCI_H1", "target_next_1h", "XGBoost"

df = pd.read_csv(f"data/processed_{NODE}.csv", parse_dates=["timestamp"])
FEATS = [c for c in df.columns if c.startswith("lag_") or c.startswith("roll_")] + \
        ["temperature_c", "humidity", "is_holiday", "hour_sin", "hour_cos",
         "month_sin", "month_cos", "is_weekend"]

model = joblib.load(f"models/{NODE}_{TARGET}_{MODEL_NAME}.pkl")
X_test = df[FEATS].iloc[-500:]          # last 500 hours as a sample

explainer = shap.TreeExplainer(model)
shap_values = explainer(X_test)

# --- global summary plot: which features matter most overall ---
plt.figure()
shap.summary_plot(shap_values, X_test, show=False)
plt.tight_layout()
plt.savefig("outputs/shap_summary.png", dpi=120)
plt.close()
print("Saved outputs/shap_summary.png")

# --- per-prediction explanation: pick one interesting hour (e.g. hottest day) ---
hot_idx = X_test["temperature_c"].idxmax()
row_pos = X_test.index.get_loc(hot_idx)
row_shap = shap_values[row_pos]

contributions = pd.DataFrame({
    "feature": FEATS,
    "value": X_test.iloc[row_pos].values,
    "shap_impact": row_shap.values,
}).sort_values("shap_impact", key=abs, ascending=False)

print(f"\nExplaining forecast for timestamp: {df.loc[hot_idx, 'timestamp']}")
print(f"Predicted next-hour consumption: {model.predict(X_test.iloc[[row_pos]])[0]:.3f} kWh")
print("\nTop contributing factors:")
print(contributions.head(6).to_string(index=False))

contributions.to_csv("outputs/shap_example_explanation.csv", index=False)
