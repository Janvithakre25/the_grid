# Backend Architecture & API Context Document

## 1. Overview & Technology Stack

The **Smart Grid AI Forecasting API** (`app.py`) is a high-performance REST API built with **FastAPI** and **Uvicorn**. It provides role-based authentication, model inference, Explainable AI attributions (SHAP & LIME), smart grid decision support recommendations, and continuous model performance monitoring.

### Core Stack:
- **Framework:** FastAPI 0.115+ (Python 3.14)
- **ASGI Server:** Uvicorn
- **Security:** PyJWT (`HS256` token signing), Passlib
- **Machine Learning & Stats:** Scikit-Learn (`RandomForestRegressor`), XGBoost (`XGBRegressor`), PyTorch (`nn.LSTM`, `nn.GRU`), Facebook Prophet, Joblib
- **Explainability:** SHAP (`TreeExplainer`), LIME (`LimeTabularExplainer`)
- **Data Processing:** Pandas, NumPy

---

## 2. Directory Layout & Artifact Locations

```
app.py                              # Main FastAPI application backend
data/
├── energy_data_india_final.csv     # Merged load + weather dataset
├── processed_<State>.csv           # 33 clean state time-series datasets
models/                             # 264 trained model artifacts (.pkl & .pt)
outputs/
├── best_models_india.csv           # Genuinely best model selection per state & horizon
├── model_comparison_india.csv      # Complete 330 model evaluation metrics
├── monitoring_log_india.csv        # Rolling window data drift check log
└── feedback_log_india.csv          # Actual vs predicted demand feedback log
```

---

## 3. Authentication & Role Permissions Architecture

JWT secret key: `smart-grid-forecasting-secret-key-2026`, Expiry: `12 hours`.

### Accounts & User Roles (`USERS` dict):
| Username | Password | Role | System Name | Access Permissions |
| :--- | :--- | :--- | :--- | :--- |
| `admin` | `admin123` | Administrator | System Administrator | Full access to all endpoints, model tables, & monitoring logs |
| `operator` | `operator123` | Grid Operator | Central Grid Dispatcher | Forecasts, history, SHAP/LIME explainability, recommendations |
| `utility` | `utility123` | Utility Company | State Power Utility Planner | Forecasts, history, weather interaction, demand-response |

### Token Middleware Helpers:
- `verify_token(authorization: Header)`: Validates JWT token, decodes payload, handles expiration (`401 Unauthorized`).
- `verify_admin_token(payload: Depends(verify_token))`: Enforces `Administrator` role claim (`403 Forbidden` for non-admins).

---

## 4. API Endpoints Specification

### Authentication Routes
- `POST /login`
  - **Request Body:** `{ "username": "<user>", "password": "<pass>" }`
  - **Response:** `{ "access_token": "<jwt>", "role": "<role>", "username": "<user>", "name": "<name>" }`
- `GET /me` (Headers: `Authorization: Bearer <token>`)
  - **Response:** `{ "username": "<user>", "role": "<role>", "name": "<name>" }`

### Forecasting & History Routes
- `GET /states`
  - **Response:** `{ "states": ["Andhra_Pradesh", "Arunachal_Pradesh", ...] }`
- `GET /forecast/{state}?horizon=1d|7d`
  - **Description:** Performs prediction using held-out state feature matrix, returning forecast value (MU) and verified model metrics (`MAE`, `RMSE`, `MAPE_%`, `R2`) from `best_models_india.csv`.
  - **Response Schema:** `{ "state": "...", "horizon": "1d", "as_of": "YYYY-MM-DD", "predicted_mu": 427.72, "last_actual_mu": 431.5, "model_used": "RandomForest", "mae": 19.3, "rmse": 25.1, "mape_pct": 4.62, "r2": 0.572 }`
- `GET /history/{state}?days=60`
  - **Response Schema:** `{ "state": "...", "dates": [...], "consumption_mu": [...], "temperature_c": [...], "humidity": [...], "is_holiday": [...] }`

### Explainable AI (XAI) Routes
- `GET /explain/{state}?horizon=1d|7d`
  - **Description:** Computes SHAP attributions for the most recent observation window.
  - **Response Schema:** `{ "state": "...", "as_of": "...", "model_used": "...", "top_factors": [{"feature": "lag_1d", "value": 408.3, "shap_impact": -8.27}, ...] }`
- `GET /explain_lime/{state}?horizon=1d|7d`
  - **Description:** Computes LIME local tabular linear approximation rule weights.
  - **Response Schema:** `{ "state": "...", "as_of": "...", "model_used": "...", "lime_factors": [{"condition": "433.70 < lag_7d <= 464.00", "weight": -5.4281}, ...] }`

### Decision Support Recommendation Route
- `GET /recommend/{state}?horizon=1d|7d`
  - **Description:** Evaluates forecast against state 90th percentile (high) and 10th percentile (low) demand thresholds and temperature.
  - **Response Schema:** `{ "state": "...", "predicted_mu": 427.72, "severity": "NORMAL"|"HIGH"|"LOW", "action": "...", "high_threshold_mu": 450.2, "low_threshold_mu": 310.1, "temperature_c": 33.0 }`

### Admin Operations Routes (Requires `Administrator` Role)
- `GET /monitoring` -> Serves tail of `outputs/monitoring_log_india.csv` (data drift log).
- `GET /feedback` -> Serves tail of `outputs/feedback_log_india.csv` (actual vs predicted accuracy).
- `GET /model_comparison` -> Serves complete 330 model evaluation matrix.
- `GET /best_models` -> Serves 66 best state-horizon model selections.

---

## 5. How to Run Backend & Test Suite

```bash
# 1. Run Uvicorn development server
python -m uvicorn app:app --reload --port 8000

# 2. Interactive Swagger UI Documentation
Open http://127.0.0.1:8000/docs in your browser

# 3. Test API Endpoints programmatically
python -c "
from fastapi.testclient import TestClient
from app import app
client = TestClient(app)
print(client.get('/states').status_code)
"
```
