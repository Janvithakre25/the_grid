"""
DASHBOARD BACKEND — FastAPI — completes diagram boxes 1 and 8
==================================================================
Serves everything the dashboard needs: login (box 1), forecasts,
SHAP/LIME explanations, recommendations, and monitoring history
(box 8). Run this, then open dashboard/index.html in a browser.

IMPORTANT — HONESTY NOTE FOR YOUR REPORT:
Login here is a SIMPLE DEMO auth (hardcoded users, JWT tokens) to
satisfy the diagram's "Secure Authentication" box for demonstration
purposes. It is NOT production-grade (no password hashing salt
rotation, no DB-backed user store, no HTTPS enforcement). State this
explicitly if a panelist asks — real deployment would need a proper
auth provider (e.g. OAuth2 + a users database).

Run:
    pip install fastapi uvicorn pyjwt python-multipart shap
    uvicorn app:app --reload
Then open http://127.0.0.1:8000/docs to see/try every endpoint, or
open dashboard/index.html directly for the actual UI.
"""
import glob
import os
from datetime import datetime, timedelta, timezone

import joblib
import jwt
import pandas as pd
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# ---------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------
JWT_SECRET = "change-this-before-any-real-deployment"   # demo only
JWT_ALGO = "HS256"
TOKEN_EXPIRY_HOURS = 8

# demo user store — box 1 asks for 3 roles: Utility Company, Grid
# Operator, Administrator. Passwords in plaintext here ONLY because
# this is a local academic demo — never do this in a real system.
USERS = {
    "admin":     {"password": "admin123",    "role": "Administrator"},
    "operator":  {"password": "operator123", "role": "Grid Operator"},
    "utility":   {"password": "utility123",  "role": "Utility Company"},
}

FEATS = None  # set dynamically per-node below


# ---------------------------------------------------------------
# APP SETUP
# ---------------------------------------------------------------
app = FastAPI(title="Smart Grid Forecasting API")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


# ---------------------------------------------------------------
# AUTH
# ---------------------------------------------------------------
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
    return {"access_token": token, "role": user["role"], "username": req.username}


# ---------------------------------------------------------------
# DATA / MODEL HELPERS
# ---------------------------------------------------------------
def get_available_states():
    files = glob.glob("data/processed_*.csv")
    return sorted(os.path.basename(f).replace("processed_", "").replace(".csv", "") for f in files)


def load_state_df(state: str) -> pd.DataFrame:
    path = f"data/processed_{state}.csv"
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"No processed data for '{state}'. "
                             f"Available: {get_available_states()}")
    return pd.read_csv(path, parse_dates=["timestamp"])


def get_feats(df: pd.DataFrame):
    return [c for c in df.columns if c.startswith("lag_") or c.startswith("roll_")] + \
           ["temperature_c", "humidity", "is_holiday",
            "dow_sin", "dow_cos", "month_sin", "month_cos",
            "doy_sin", "doy_cos", "is_weekend"]


def load_model(state: str, target_col: str, model_name: str = "XGBoost"):
    path = f"models/{state}_{target_col}_{model_name}.pkl"
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"No trained model at {path}. Run 03_train_models_india.py first.")
    return joblib.load(path)


HORIZON_MAP = {"1d": "target_next_1d", "7d": "target_next_7d"}


# ---------------------------------------------------------------
# ENDPOINTS
# ---------------------------------------------------------------
@app.get("/states")
def states(payload: dict = Depends(verify_token)):
    return {"states": get_available_states()}


@app.get("/forecast/{state}")
def forecast(state: str, horizon: str = "1d", payload: dict = Depends(verify_token)):
    if horizon not in HORIZON_MAP:
        raise HTTPException(status_code=400, detail="horizon must be '1d' or '7d'")
    target_col = HORIZON_MAP[horizon]
    df = load_state_df(state)
    feats = get_feats(df)
    model = load_model(state, target_col)

    latest = df.iloc[[-1]]
    pred = float(model.predict(latest[feats])[0])

    return {
        "state": state,
        "horizon": horizon,
        "as_of": str(latest["timestamp"].iloc[0].date()),
        "predicted_mu": round(pred, 2),
        "last_actual_mu": float(latest["consumption_mu"].iloc[0]),
    }


@app.get("/history/{state}")
def history(state: str, days: int = 60, payload: dict = Depends(verify_token)):
    df = load_state_df(state)
    recent = df.iloc[-days:][["timestamp", "consumption_mu"]]
    return {
        "state": state,
        "dates": recent["timestamp"].dt.strftime("%Y-%m-%d").tolist(),
        "consumption_mu": recent["consumption_mu"].round(2).tolist(),
    }


@app.get("/explain/{state}")
def explain(state: str, horizon: str = "1d", payload: dict = Depends(verify_token)):
    import shap
    target_col = HORIZON_MAP.get(horizon, "target_next_1d")
    df = load_state_df(state)
    feats = get_feats(df)
    model = load_model(state, target_col)

    X = df[feats].iloc[[-1]]
    explainer = shap.TreeExplainer(model)
    shap_values = explainer(X)

    contributions = pd.DataFrame({
        "feature": feats,
        "value": X.iloc[0].values,
        "shap_impact": shap_values[0].values,
    }).sort_values("shap_impact", key=abs, ascending=False).head(6)

    return {
        "state": state,
        "as_of": str(df["timestamp"].iloc[-1].date()),
        "top_factors": contributions.to_dict(orient="records"),
    }


@app.get("/recommend/{state}")
def recommend_endpoint(state: str, horizon: str = "1d", payload: dict = Depends(verify_token)):
    target_col = HORIZON_MAP.get(horizon, "target_next_1d")
    df = load_state_df(state)
    feats = get_feats(df)
    model = load_model(state, target_col)

    hist = df["consumption_mu"]
    high_thresh = hist.quantile(0.90)
    low_thresh = hist.quantile(0.10)

    latest = df.iloc[[-1]]
    pred = float(model.predict(latest[feats])[0])
    temp = float(latest["temperature_c"].iloc[0])

    if pred >= high_thresh:
        severity = "HIGH"
        action = ("Peak-shaving: pre-cool via HVAC scheduling; issue demand-response alert."
                   if temp >= 35 else
                   "Trigger demand-response alert; suggest shifting flexible loads to off-peak hours.")
    elif pred <= low_thresh:
        severity = "LOW"
        action = "Low-demand window: good opportunity for grid maintenance / renewable curtailment absorption."
    else:
        severity = "NORMAL"
        action = "Normal range — no action needed."

    return {"state": state, "predicted_mu": round(pred, 2), "severity": severity, "action": action}


@app.get("/monitoring")
def monitoring(payload: dict = Depends(verify_token)):
    path = "outputs/monitoring_log_india.csv"
    if not os.path.exists(path):
        return {"log": [], "note": "No monitoring log yet — run 07_monitor_retrain_india.py first."}
    df = pd.read_csv(path)
    return {"log": df.tail(30).to_dict(orient="records")}


@app.get("/feedback")
def feedback(payload: dict = Depends(verify_token)):
    path = "outputs/feedback_log_india.csv"
    if not os.path.exists(path):
        return {"log": [], "note": "No feedback log yet — run 08_feedback_loop_india.py first."}
    df = pd.read_csv(path)
    return {"log": df.tail(30).to_dict(orient="records")}


# serve the dashboard's static files (HTML/JS/CSS) at the root
if os.path.isdir("dashboard"):
    app.mount("/", StaticFiles(directory="dashboard", html=True), name="dashboard")
