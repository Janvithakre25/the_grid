"""
STEP 4b — EXPLAINABLE AI LAYER (LIME) — completes diagram box 6
====================================================================
Your architecture diagram asks for SHAP *and* LIME. 04_shap_explain_india.py
covers SHAP (global + per-prediction). This script adds LIME, which
explains ONE prediction at a time by locally approximating the model
with a simple linear model around that specific input — a different
(and complementary) way of answering "why did the model predict this."

Good talking point for the panel: SHAP gives globally consistent
attributions; LIME gives a locally faithful, human-readable approximation.
Showing both demonstrates you understand the trade-off, not just that
you ran two libraries.
"""
import joblib
import pandas as pd
from lime.lime_tabular import LimeTabularExplainer

NODE, TARGET, MODEL_NAME = "Maharashtra", "target_next_1d", "XGBoost"

df = pd.read_csv(f"data/processed_{NODE}.csv", parse_dates=["timestamp"])
FEATS = [c for c in df.columns if c.startswith("lag_") or c.startswith("roll_")] + \
        ["temperature_c", "humidity", "is_holiday",
         "dow_sin", "dow_cos", "month_sin", "month_cos",
         "doy_sin", "doy_cos", "is_weekend"]

model = joblib.load(f"models/{NODE}_{TARGET}_{MODEL_NAME}.pkl")

X_train = df[FEATS].iloc[:-90]   # training-like background for LIME's sampling
X_test = df[FEATS].iloc[-90:]

explainer = LimeTabularExplainer(
    training_data=X_train.values,
    feature_names=FEATS,
    mode="regression",
    verbose=False,
)

# explain the same "hottest day" example used in the SHAP script, for
# a direct side-by-side comparison in your report/demo
hot_idx = X_test["temperature_c"].idxmax()
row_pos = X_test.index.get_loc(hot_idx)
row = X_test.iloc[row_pos]

explanation = explainer.explain_instance(
    data_row=row.values,
    predict_fn=model.predict,
    num_features=6,
)

print(f"Explaining forecast for: {df.loc[hot_idx, 'timestamp']} ({NODE})")
print(f"Predicted next-day consumption: {model.predict(X_test.iloc[[row_pos]])[0]:.2f} MU")
print("\nLIME top contributing factors (local linear approximation):")
lime_table = pd.DataFrame(explanation.as_list(), columns=["condition", "weight"])
print(lime_table.to_string(index=False))

lime_table.to_csv("outputs/lime_example_explanation_india.csv", index=False)
explanation.save_to_file("outputs/lime_explanation_india.html")
print("\nSaved outputs/lime_example_explanation_india.csv")
print("Saved outputs/lime_explanation_india.html (open in browser for the visual version)")
