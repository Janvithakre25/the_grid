"""
DASHBOARD BACKEND — FastAPI — AI-Powered Smart Grid Energy Forecasting
========================================================================
Serves everything the multi-role dashboard needs:
  - Role-based Authentication (Administrator, Grid Operator, Utility Company)
  - State & Horizon Forecasts (using Genuinely Best Verified AI Model per State & Horizon)
  - SHAP & LIME Feature Explanations
  - Smart Grid Recommendation & Severity Engine
  - Continuous Model Drift Monitoring History
  - Actual vs Predicted Feedback Loop
  - Multi-Model Comparison & Metrics API
"""

import glob
import os
from datetime import datetime, timedelta, timezone
import joblib
import jwt
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Header, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from lime.lime_tabular import LimeTabularExplainer

# ---------------------------------------------------------------
# CONFIG & AUTH CONSTANTS
# ---------------------------------------------------------------
JWT_SECRET = "smart-grid-forecasting-secret-key-2026"
JWT_ALGO = "HS256"
TOKEN_EXPIRY_HOURS = 12

USERS = {
    "admin":     {"password": "admin123",    "role": "Administrator", "name": "System Administrator"},
    "operator":  {"password": "operator123", "role": "Grid Operator",  "name": "Central Grid Dispatcher"},
    "utility":   {"password": "utility123",  "role": "Utility Company", "name": "State Power Utility Planner"},
}

app = FastAPI(title="Smart Grid Energy Consumption Forecasting API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoginRequest(BaseModel):
    username: str
    password: str

def create_token(username: str, role: str) -> str:
    payload = {
        "sub": username,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRY_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

def verify_token(authorization: str = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired, please log in again")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload

@app.post("/login")
def login(req: LoginRequest):
    user = USERS.get(req.username)
    if not user or user["password"] != req.password:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_token(req.username, user["role"])
    return {
        "access_token": token,
        "role": user["role"],
        "username": req.username,
        "name": user["name"]
    }

# ---------------------------------------------------------------
# DATA & MODEL HELPERS
# ---------------------------------------------------------------
HORIZON_MAP = {"1d": "target_next_1d", "7d": "target_next_7d"}
HORIZON_LABEL_MAP = {"1d": "short-term (1 day)", "7d": "medium-term (7 day)"}

def get_available_states():
    files = glob.glob("data/processed_*.csv")
    return sorted(os.path.basename(f).replace("processed_", "").replace(".csv", "") for f in files)

def load_state_df(state: str) -> pd.DataFrame:
    path = f"data/processed_{state}.csv"
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"No processed dataset found for '{state}'")
    return pd.read_csv(path, parse_dates=["timestamp"])

def get_feats(df: pd.DataFrame):
    return [c for c in df.columns if c.startswith("lag_") or c.startswith("roll_")] + \
           ["temperature_c", "humidity", "is_holiday",
            "dow_sin", "dow_cos", "month_sin", "month_cos",
            "doy_sin", "doy_cos", "is_weekend"]

def get_best_model_name(state: str, horizon: str) -> str:
    """Lookup the genuinely best model algorithm for this state and horizon from best_models_india.csv"""
    best_csv = "outputs/best_models_india.csv"
    if os.path.exists(best_csv):
        bdf = pd.read_csv(best_csv)
        hlabel = HORIZON_LABEL_MAP.get(horizon, "short-term (1 day)")
        match = bdf[(bdf["node"] == state) & (bdf["horizon"] == hlabel)]
        if not match.empty:
            return match["model"].iloc[0]
    return "XGBoost"

def load_model(state: str, target_col: str, model_name: str = "best"):
    if model_name == "best" or not model_name:
        horizon_key = "1d" if "1d" in target_col else "7d"
        model_name = get_best_model_name(state, horizon_key)
    
    # Try exact pickle first
    path = f"models/{state}_{target_col}_{model_name}.pkl"
    if os.path.exists(path):
        return joblib.load(path), model_name

    # Fallback options if pickle name varies
    fallback_xgb = f"models/{state}_{target_col}_XGBoost.pkl"
    if os.path.exists(fallback_xgb):
        return joblib.load(fallback_xgb), "XGBoost"
    
    fallback_rf = f"models/{state}_{target_col}_RandomForest.pkl"
    if os.path.exists(fallback_rf):
        return joblib.load(fallback_rf), "RandomForest"

    raise HTTPException(status_code=404, detail=f"No trained model found for {state} - {target_col}")

# ---------------------------------------------------------------
# API ENDPOINTS
# ---------------------------------------------------------------
@app.get("/states")
def states(payload: dict = Depends(verify_token)):
    return {"states": get_available_states()}

@app.get("/forecast/{state}")
def forecast(state: str, horizon: str = "1d", model_name: str = "best", payload: dict = Depends(verify_token)):
    if horizon not in HORIZON_MAP:
        raise HTTPException(status_code=400, detail="horizon must be '1d' or '7d'")
    target_col = HORIZON_MAP[horizon]
    df = load_state_df(state)
    feats = get_feats(df)
    model, actual_model_name = load_model(state, target_col, model_name)

    latest = df.iloc[[-1]]
    pred = float(model.predict(latest[feats])[0])

    # Get accuracy metrics for this best model
    mae, rmse, mape, r2 = None, None, None, None
    comp_csv = "outputs/model_comparison_india.csv"
    if os.path.exists(comp_csv):
        cdf = pd.read_csv(comp_csv)
        hlabel = HORIZON_LABEL_MAP.get(horizon, "short-term (1 day)")
        m = cdf[(cdf["node"] == state) & (cdf["horizon"] == hlabel) & (cdf["model"] == actual_model_name)]
        if not m.empty:
            mae = float(m["MAE"].iloc[0])
            rmse = float(m["RMSE"].iloc[0])
            mape = float(m["MAPE_%"].iloc[0])
            if "R2" in m.columns:
                r2 = float(m["R2"].iloc[0])

    return {
        "state": state,
        "horizon": horizon,
        "as_of": str(latest["timestamp"].iloc[0].date()),
        "predicted_mu": round(pred, 2),
        "last_actual_mu": float(latest["consumption_mu"].iloc[0]),
        "model_used": actual_model_name,
        "mae": mae,
        "rmse": rmse,
        "mape_pct": mape,
        "r2": r2,
    }

@app.get("/history/{state}")
def history(state: str, days: int = 60, payload: dict = Depends(verify_token)):
    df = load_state_df(state)
    recent = df.iloc[-days:][["timestamp", "consumption_mu", "temperature_c", "humidity", "is_holiday"]]
    return {
        "state": state,
        "dates": recent["timestamp"].dt.strftime("%Y-%m-%d").tolist(),
        "consumption_mu": recent["consumption_mu"].round(2).tolist(),
        "temperature_c": recent["temperature_c"].round(1).fillna(25.0).tolist(),
        "humidity": recent["humidity"].round(1).fillna(50.0).tolist(),
        "is_holiday": recent["is_holiday"].tolist(),
    }

@app.get("/explain/{state}")
def explain(state: str, horizon: str = "1d", payload: dict = Depends(verify_token)):
    import shap
    target_col = HORIZON_MAP.get(horizon, "target_next_1d")
    df = load_state_df(state)
    feats = get_feats(df)
    model, model_used = load_model(state, target_col, "best")

    X = df[feats].iloc[[-1]]
    try:
        explainer = shap.TreeExplainer(model)
        shap_values = explainer(X)
        impacts = shap_values.values[0] if hasattr(shap_values, "values") else shap_values[0]
    except Exception:
        # Fallback to feature importances if SHAP TreeExplainer fails
        impacts = getattr(model, "feature_importances_", np.zeros(len(feats)))

    contributions = pd.DataFrame({
        "feature": feats,
        "value": X.iloc[0].values,
        "shap_impact": impacts,
    }).sort_values("shap_impact", key=abs, ascending=False).head(8)

    return {
        "state": state,
        "as_of": str(df["timestamp"].iloc[-1].date()),
        "model_used": model_used,
        "top_factors": contributions.to_dict(orient="records"),
    }

@app.get("/explain_lime/{state}")
def explain_lime(state: str, horizon: str = "1d", payload: dict = Depends(verify_token)):
    target_col = HORIZON_MAP.get(horizon, "target_next_1d")
    df = load_state_df(state)
    feats = get_feats(df)
    model, model_used = load_model(state, target_col, "best")

    X_train = df[feats].iloc[:-30]
    X_test = df[feats].iloc[[-1]]

    explainer = LimeTabularExplainer(
        training_data=X_train.values,
        feature_names=feats,
        mode="regression",
        verbose=False,
    )
    explanation = explainer.explain_instance(
        data_row=X_test.iloc[0].values,
        predict_fn=model.predict,
        num_features=6
    )
    
    lime_factors = [{"condition": cond, "weight": round(weight, 4)} for cond, weight in explanation.as_list()]

    return {
        "state": state,
        "as_of": str(df["timestamp"].iloc[-1].date()),
        "model_used": model_used,
        "lime_factors": lime_factors,
    }

@app.get("/recommend/{state}")
def recommend_endpoint(state: str, horizon: str = "1d", payload: dict = Depends(verify_token)):
    target_col = HORIZON_MAP.get(horizon, "target_next_1d")
    df = load_state_df(state)
    feats = get_feats(df)
    model, _ = load_model(state, target_col, "best")

    hist = df["consumption_mu"]
    high_thresh = float(hist.quantile(0.90))
    low_thresh = float(hist.quantile(0.10))

    latest = df.iloc[[-1]]
    pred = float(model.predict(latest[feats])[0])
    temp = float(latest["temperature_c"].iloc[0]) if "temperature_c" in latest and not pd.isna(latest["temperature_c"].iloc[0]) else 28.0

    if pred >= high_thresh:
        severity = "HIGH"
        if temp >= 35:
            action = "CRITICAL PEAK LOAD WARNING: High heat index anticipated. Initiate pre-cooling & trigger industrial demand-response load shaving."
        else:
            action = "PEAK DEMAND ALERT: Trigger peak load shifting; suggest shifting flexible agricultural & commercial pumping loads to off-peak."
    elif pred <= low_thresh:
        severity = "LOW"
        action = "OFF-PEAK WINDOW: Excellent window for scheduled thermal generator maintenance and maximum absorption of renewable power."
    else:
        severity = "NORMAL"
        action = "NORMAL OPERATING RANGE: Standard grid balance. Maintain automatic generation control (AGC) & spinning reserve margins."

    return {
        "state": state,
        "predicted_mu": round(pred, 2),
        "severity": severity,
        "action": action,
        "high_threshold_mu": round(high_thresh, 2),
        "low_threshold_mu": round(low_thresh, 2),
        "temperature_c": round(temp, 1),
    }

@app.get("/monitoring")
def monitoring(payload: dict = Depends(verify_token)):
    path = "outputs/monitoring_log_india.csv"
    if not os.path.exists(path):
        return {"log": [], "note": "No monitoring log recorded yet."}
    df = pd.read_csv(path)
    return {"log": df.tail(30).to_dict(orient="records")}

@app.get("/feedback")
def feedback(payload: dict = Depends(verify_token)):
    path = "outputs/feedback_log_india.csv"
    if not os.path.exists(path):
        return {"log": [], "note": "No feedback log recorded yet."}
    df = pd.read_csv(path)
    return {"log": df.tail(30).to_dict(orient="records")}

@app.get("/model_comparison")
def model_comparison(payload: dict = Depends(verify_token)):
    path = "outputs/model_comparison_india.csv"
    if not os.path.exists(path):
        return {"data": []}
    df = pd.read_csv(path)
    return {"data": df.to_dict(orient="records")}

@app.get("/best_models")
def best_models(payload: dict = Depends(verify_token)):
    path = "outputs/best_models_india.csv"
    if not os.path.exists(path):
        return {"data": []}
    df = pd.read_csv(path)
    return {"data": df.to_dict(orient="records")}

# Serve dashboard static files at root
if os.path.isdir("dashboard"):
    app.mount("/", StaticFiles(directory="dashboard", html=True), name="dashboard")
