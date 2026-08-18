"""
STEP 3 — MODEL TRAINING & COMPARISON (Random Forest, XGBoost)
================================================================
LSTM/GRU training lives in 03b_train_deep_models.py (needs PyTorch,
run that one on Colab/your own machine if this sandbox lacks space).

Trains one model per node, per horizon (next 1h, next 24h), and saves
a comparison table + trained models.
"""
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
from xgboost import XGBRegressor

NODES = ["UCI_H1", "F1_derived", "S1_derived"]
HORIZONS = {"target_next_1h": "short-term (1h)", "target_next_24h": "medium-term (24h)"}

results = []

for node_id in NODES:
    df = pd.read_csv(f"data/processed_{node_id}.csv", parse_dates=["timestamp"])

    FEATS = [c for c in df.columns if c.startswith("lag_") or c.startswith("roll_")] + \
            ["temperature_c", "humidity", "is_holiday", "hour_sin", "hour_cos",
             "month_sin", "month_cos", "is_weekend"]

    # ---- TIME-BASED SPLIT (never shuffle time series!) ----
    # Why: random shuffling lets the model "see the future" via nearby rows
    # in train set, leaking information and giving falsely high accuracy.
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

results_df = pd.DataFrame(results)
results_df.to_csv("outputs/model_comparison.csv", index=False)
print(results_df.to_string(index=False))

# pick + record best model per (node, horizon) by MAE
best = results_df.loc[results_df.groupby(["node", "horizon"])["MAE"].idxmin()]
best.to_csv("outputs/best_models.csv", index=False)
print("\nBest model per node/horizon:")
print(best.to_string(index=False))
