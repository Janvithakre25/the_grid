import pandas as pd
import joblib
import shap

states_to_check = ["Maharashtra", "JandK"]

for state in states_to_check:
    print("=" * 60)
    print(state)

    df = pd.read_csv(f"data/processed_{state}.csv", parse_dates=["timestamp"])
    feats = [c for c in df.columns if c.startswith("lag_") or c.startswith("roll_")] + \
            ["temperature_c", "humidity", "is_holiday", "dow_sin", "dow_cos",
             "month_sin", "month_cos", "doy_sin", "doy_cos", "is_weekend"]

    model = joblib.load(f"models/{state}_target_next_1d_XGBoost.pkl")
    X = df[feats].iloc[[-1]]

    explainer = shap.TreeExplainer(model)
    shap_values = explainer(X)

    pred = model.predict(X)[0]
    base_value = shap_values.base_values[0]
    total_shap = shap_values.values[0].sum()
    reconstructed = base_value + total_shap

    print(f"Model prediction:          {pred:.4f}")
    print(f"SHAP base_value:           {base_value:.4f}")
    print(f"SHAP values sum:           {total_shap:.4f}")
    print(f"base_value + shap sum:     {reconstructed:.4f}")
    print(f"Match prediction? (should be ~equal): {abs(pred - reconstructed) < 0.01}")

    contributions = pd.DataFrame({
        "feature": feats,
        "shap_impact": shap_values.values[0],
    }).sort_values("shap_impact", key=abs, ascending=False)
    print("\nTop 5 factors:")
    print(contributions.head(5).to_string(index=False))
    print()