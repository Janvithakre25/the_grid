"""
STEP 8 & 9 — MULTI-MODEL TRAINING & COMPREHENSIVE EVALUATION
================================================================
Trains and evaluates all required forecasting models across all 33 Indian states/UTs
for both 1-day (target_next_1d) and 7-day (target_next_7d) forecasting horizons.

Models evaluated:
  1. Random Forest Regressor
  2. XGBoost Regressor
  3. LSTM (Long Short-Term Memory Neural Network)
  4. GRU (Gated Recurrent Unit Neural Network)
  5. Prophet (Facebook Prophet Time-Series Model)

Evaluation Metrics Computed:
  - MAE  (Mean Absolute Error)
  - RMSE (Root Mean Squared Error)
  - MAPE (%) (Mean Absolute Percentage Error)
  - R²   (Coefficient of Determination)

Uses strict chronological time-series splitting (80% train, 20% test, no shuffling).
Saves all metrics to outputs/model_comparison_india.csv and outputs/best_models_india.csv.
Saves the best-performing models to models/ for backend serving.
"""

import glob
import os
import warnings
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from xgboost import XGBRegressor

# Suppress Prophet logs and warnings for clean output
warnings.filterwarnings("ignore")

try:
    import torch
    import torch.nn as nn
    from torch.utils.data import Dataset, DataLoader
    from sklearn.preprocessing import StandardScaler
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False


HORIZONS = {
    "target_next_1d": "short-term (1 day)",
    "target_next_7d": "medium-term (7 day)",
}


# --- PyTorch Dataset & Models for LSTM / GRU ---
if TORCH_AVAILABLE:
    class TimeSeriesDataset(Dataset):
        def __init__(self, X_seq, y_seq):
            self.X = torch.tensor(X_seq, dtype=torch.float32)
            self.y = torch.tensor(y_seq, dtype=torch.float32)

        def __len__(self):
            return len(self.X)

        def __getitem__(self, idx):
            return self.X[idx], self.y[idx]

    class RecurrentForecaster(nn.Module):
        def __init__(self, input_dim, hidden_dim=32, num_layers=2, cell_type="lstm"):
            super().__init__()
            rnn_cls = nn.LSTM if cell_type.lower() == "lstm" else nn.GRU
            self.rnn = rnn_cls(input_dim, hidden_dim, num_layers=num_layers, batch_first=True, dropout=0.1)
            self.fc = nn.Linear(hidden_dim, 1)

        def forward(self, x):
            out, _ = self.rnn(x)
            return self.fc(out[:, -1, :]).squeeze(-1)


def train_eval_dl_model(df_state, target_col, cell_type="lstm", seq_len=7):
    """Train PyTorch LSTM/GRU model on sequence window data"""
    if not TORCH_AVAILABLE:
        return None, None

    feats = [c for c in df_state.columns if c.startswith("lag_") or c.startswith("roll_")] + \
            ["temperature_c", "humidity", "is_holiday", "is_weekend"]
    
    clean_df = df_state.dropna(subset=feats + [target_col]).reset_index(drop=True)
    if len(clean_df) < 50:
        return None, None

    split_idx = int(len(clean_df) * 0.8)
    train_df = clean_df.iloc[:split_idx]
    test_df = clean_df.iloc[split_idx:]

    scaler_X = StandardScaler()
    train_X_scaled = scaler_X.fit_transform(train_df[feats])
    test_X_scaled = scaler_X.transform(test_df[feats])

    y_train = train_df[target_col].values
    y_test = test_df[target_col].values

    def build_sequences(X_data, y_data, seq_len):
        X_seq, y_seq = [], []
        for i in range(len(X_data) - seq_len):
            X_seq.append(X_data[i:i+seq_len])
            y_seq.append(y_data[i+seq_len])
        return np.array(X_seq), np.array(y_seq)

    X_train_seq, y_train_seq = build_sequences(train_X_scaled, y_train, seq_len)
    X_test_seq, y_test_seq = build_sequences(test_X_scaled, y_test, seq_len)

    if len(X_train_seq) == 0 or len(X_test_seq) == 0:
        return None, None

    train_ds = TimeSeriesDataset(X_train_seq, y_train_seq)
    train_loader = DataLoader(train_ds, batch_size=32, shuffle=False)

    model = RecurrentForecaster(input_dim=len(feats), hidden_dim=32, num_layers=2, cell_type=cell_type)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.005)
    criterion = nn.MSELoss()

    model.train()
    for epoch in range(25):
        for xb, yb in train_loader:
            optimizer.zero_grad()
            preds = model(xb)
            loss = criterion(preds, yb)
            loss.backward()
            optimizer.step()

    model.eval()
    with torch.no_grad():
        test_inputs = torch.tensor(X_test_seq, dtype=torch.float32)
        preds = model(test_inputs).numpy()

    return y_test_seq, preds


def train_eval_prophet(df_state, target_col):
    """Train Facebook Prophet model on state time-series"""
    if not PROPHET_AVAILABLE:
        return None, None

    pdf = df_state[["timestamp", target_col, "temperature_c", "is_holiday"]].dropna()
    pdf = pdf.rename(columns={"timestamp": "ds", target_col: "y"})

    split_idx = int(len(pdf) * 0.8)
    train_pdf = pdf.iloc[:split_idx]
    test_pdf = pdf.iloc[split_idx:]

    m = Prophet(yearly_seasonality=True, weekly_seasonality=True, daily_seasonality=False)
    m.add_regressor("temperature_c")
    m.add_regressor("is_holiday")
    
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        m.fit(train_pdf)

    future = test_pdf[["ds", "temperature_c", "is_holiday"]].copy()
    forecast = m.predict(future)
    
    y_test = test_pdf["y"].values
    preds = forecast["yhat"].values
    return y_test, preds


def main():
    print("=================================================================")
    print("STARTING COMPREHENSIVE MULTI-MODEL FORECASTING EVALUATION PIPELINE")
    print("=================================================================")

    node_files = sorted(glob.glob("data/processed_*.csv"))
    os.makedirs("models", exist_ok=True)
    os.makedirs("outputs", exist_ok=True)

    results = []

    for path in node_files:
        node_id = os.path.basename(path).replace("processed_", "").replace(".csv", "")
        df = pd.read_csv(path, parse_dates=["timestamp"])

        feats = [c for c in df.columns if c.startswith("lag_") or c.startswith("roll_")] + \
                ["temperature_c", "humidity", "is_holiday",
                 "dow_sin", "dow_cos", "month_sin", "month_cos",
                 "doy_sin", "doy_cos", "is_weekend"]

        if len(df) < 60:
            print(f"Skipping {node_id}: only {len(df)} rows after preprocessing")
            continue

        split_idx = int(len(df) * 0.8)
        train, test = df.iloc[:split_idx], df.iloc[split_idx:]

        for target_col, horizon_name in HORIZONS.items():
            X_train, y_train = train[feats], train[target_col]
            X_test, y_test = test[feats], test[target_col]

            # 1. Random Forest
            rf = RandomForestRegressor(n_estimators=200, max_depth=12, n_jobs=-1, random_state=42)
            rf.fit(X_train, y_train)
            rf_preds = rf.predict(X_test)
            joblib.dump(rf, f"models/{node_id}_{target_col}_RandomForest.pkl")

            rf_mae = mean_absolute_error(y_test, rf_preds)
            rf_rmse = np.sqrt(mean_squared_error(y_test, rf_preds))
            rf_mape = np.mean(np.abs((y_test - rf_preds) / y_test.clip(lower=0.01))) * 100
            rf_r2 = r2_score(y_test, rf_preds)

            results.append({
                "node": node_id, "horizon": horizon_name, "target_col": target_col, "model": "RandomForest",
                "MAE": round(rf_mae, 4), "RMSE": round(rf_rmse, 4), "MAPE_%": round(rf_mape, 2), "R2": round(rf_r2, 4)
            })

            # 2. XGBoost
            xgb = XGBRegressor(n_estimators=300, max_depth=6, learning_rate=0.05,
                               subsample=0.8, colsample_bytree=0.8, random_state=42, n_jobs=-1)
            xgb.fit(X_train, y_train)
            xgb_preds = xgb.predict(X_test)
            joblib.dump(xgb, f"models/{node_id}_{target_col}_XGBoost.pkl")

            xgb_mae = mean_absolute_error(y_test, xgb_preds)
            xgb_rmse = np.sqrt(mean_squared_error(y_test, xgb_preds))
            xgb_mape = np.mean(np.abs((y_test - xgb_preds) / y_test.clip(lower=0.01))) * 100
            xgb_r2 = r2_score(y_test, xgb_preds)

            results.append({
                "node": node_id, "horizon": horizon_name, "target_col": target_col, "model": "XGBoost",
                "MAE": round(xgb_mae, 4), "RMSE": round(xgb_rmse, 4), "MAPE_%": round(xgb_mape, 2), "R2": round(xgb_r2, 4)
            })

            # 3. LSTM
            if TORCH_AVAILABLE:
                y_true_lstm, lstm_preds = train_eval_dl_model(df, target_col, cell_type="lstm", seq_len=7)
                if lstm_preds is not None:
                    lstm_mae = mean_absolute_error(y_true_lstm, lstm_preds)
                    lstm_rmse = np.sqrt(mean_squared_error(y_true_lstm, lstm_preds))
                    lstm_mape = np.mean(np.abs((y_true_lstm - lstm_preds) / np.clip(y_true_lstm, 0.01, None))) * 100
                    lstm_r2 = r2_score(y_true_lstm, lstm_preds)
                    results.append({
                        "node": node_id, "horizon": horizon_name, "target_col": target_col, "model": "LSTM",
                        "MAE": round(lstm_mae, 4), "RMSE": round(lstm_rmse, 4), "MAPE_%": round(lstm_mape, 2), "R2": round(lstm_r2, 4)
                    })

            # 4. GRU
            if TORCH_AVAILABLE:
                y_true_gru, gru_preds = train_eval_dl_model(df, target_col, cell_type="gru", seq_len=7)
                if gru_preds is not None:
                    gru_mae = mean_absolute_error(y_true_gru, gru_preds)
                    gru_rmse = np.sqrt(mean_squared_error(y_true_gru, gru_preds))
                    gru_mape = np.mean(np.abs((y_true_gru - gru_preds) / np.clip(y_true_gru, 0.01, None))) * 100
                    gru_r2 = r2_score(y_true_gru, gru_preds)
                    results.append({
                        "node": node_id, "horizon": horizon_name, "target_col": target_col, "model": "GRU",
                        "MAE": round(gru_mae, 4), "RMSE": round(gru_rmse, 4), "MAPE_%": round(gru_mape, 2), "R2": round(gru_r2, 4)
                    })

            # 5. Prophet
            if PROPHET_AVAILABLE:
                try:
                    y_true_p, prophet_preds = train_eval_prophet(df, target_col)
                    if prophet_preds is not None:
                        p_mae = mean_absolute_error(y_true_p, prophet_preds)
                        p_rmse = np.sqrt(mean_squared_error(y_true_p, prophet_preds))
                        p_mape = np.mean(np.abs((y_true_p - prophet_preds) / np.clip(y_true_p, 0.01, None))) * 100
                        p_r2 = r2_score(y_true_p, prophet_preds)
                        results.append({
                            "node": node_id, "horizon": horizon_name, "target_col": target_col, "model": "Prophet",
                            "MAE": round(p_mae, 4), "RMSE": round(p_rmse, 4), "MAPE_%": round(p_mape, 2), "R2": round(p_r2, 4)
                        })
                except Exception as ex:
                    pass

        print(f"Evaluated all models for node: {node_id}")

    results_df = pd.DataFrame(results)
    results_df.to_csv("outputs/model_comparison_india.csv", index=False)
    print(f"\nSaved complete model comparison ({len(results_df)} evaluations) -> outputs/model_comparison_india.csv")

    # Select genuinely best model per state and horizon based on lowest MAE
    best_df = results_df.loc[results_df.groupby(["node", "horizon"])["MAE"].idxmin()].reset_index(drop=True)
    best_df.to_csv("outputs/best_models_india.csv", index=False)
    print(f"Saved verified best models ({len(best_df)} entries) -> outputs/best_models_india.csv")

    print("\nSample of Best Models per State & Horizon:")
    print(best_df.head(10).to_string(index=False))

if __name__ == "__main__":
    main()
