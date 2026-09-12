"""
STEP 3 — MODEL TRAINING & COMPARISON (India, Random Forest, XGBoost)
========================================================================
Same logic as the original 03_train_models.py, but:
  - NODES is now built dynamically from the 33 real state files
    (glob data/processed_*.csv) instead of a hardcoded 3-node list
  - FEATS uses the daily feature set (lag_*d / roll_*_*d, dow/month/doy
    cyclical encodings) instead of hourly
  - HORIZONS renamed to target_next_1d (short-term daily) and
    target_next_7d (medium-term weekly), matching your synopsis wording
"""
import glob
import os
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
from xgboost import XGBRegressor

HORIZONS = {
    "target_next_1d": "short-term (1 day)",
    "target_next_7d": "medium-term (7 day)",
}

node_files = sorted(glob.glob("data/processed_*.csv"))
os.makedirs("models", exist_ok=True)
os.makedirs("outputs", exist_ok=True)

results = []

for path in node_files:
    node_id = os.path.basename(path).replace("processed_", "").replace(".csv", "")
    df = pd.read_csv(path, parse_dates=["timestamp"])

    FEATS = [c for c in df.columns if c.startswith("lag_") or c.startswith("roll_")] + \
            ["temperature_c", "humidity", "is_holiday",
             "dow_sin", "dow_cos", "month_sin", "month_cos",
             "doy_sin", "doy_cos", "is_weekend"]

    # skip nodes with too little data after feature engineering (30d
    # rolling window eats the first month) to avoid degenerate splits
    if len(df) < 60:
        print(f"Skipping {node_id}: only {len(df)} rows after feature engineering")
        continue

    split_idx = int(len(df) * 0.8)
    train, test = df.iloc[:split_idx], df.iloc[split_idx:]

    for target_col, horizon_name in HORIZONS.items():
        X_train, y_train = train[FEATS], train[target_col]
        X_test, y_test = test[FEATS], test[target_col]

        models = {
            "RandomForest": RandomForestRegressor(
                n_estimators=200, max_depth=12, n_jobs=-1, random_state=42
            ),
            "XGBoost": XGBRegressor(
                n_estimators=300, max_depth=6, learning_rate=0.05,
                subsample=0.8, colsample_bytree=0.8, random_state=42, n_jobs=-1
            ),
        }

        for model_name, model in models.items():
            model.fit(X_train, y_train)
            preds = model.predict(X_test)

            mae = mean_absolute_error(y_test, preds)
            rmse = np.sqrt(mean_squared_error(y_test, preds))
            mape = np.mean(np.abs((y_test - preds) / y_test.clip(lower=0.01))) * 100

            results.append({
                "node": node_id, "horizon": horizon_name, "model": model_name,
                "MAE": round(mae, 4), "RMSE": round(rmse, 4), "MAPE_%": round(mape, 2),
            })

            joblib.dump(model, f"models/{node_id}_{target_col}_{model_name}.pkl")

    print(f"{node_id}: done")

results_df = pd.DataFrame(results)
results_df.to_csv("outputs/model_comparison_india.csv", index=False)
print(results_df.to_string(index=False))

best = results_df.loc[results_df.groupby(["node", "horizon"])["MAE"].idxmin()]
best.to_csv("outputs/best_models_india.csv", index=False)
print("\nBest model per node/horizon:")
print(best.to_string(index=False))
