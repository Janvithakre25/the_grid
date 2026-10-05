# AI-Powered Energy Consumption Forecasting in Smart Grids (India Dataset)

## Executive Summary
This repository contains a production-grade, end-to-end **AI-Powered Energy Consumption Forecasting & Smart Grid Optimization Platform** built for **33 Indian States and Union Territories** using historical daily load, weather, and public holiday datasets.

The system supports:
- Multi-model evaluation across **Random Forest, XGBoost, PyTorch LSTM, PyTorch GRU, and Facebook Prophet**.
- Both **1-Day Ahead (24-Hour)** and **7-Day Ahead (Weekly)** forecasting horizons.
- Dual Explainable AI (XAI) layers: **SHAP (global & local factor attributions)** and **LIME (local linear rule approximations)**.
- Automated Smart Grid Decision Support Recommendation Engine.
- Secure JWT-based Role-Based Access Control (**Administrator, Grid Operator, Utility Company**).
- Dedicated interactive frontend dashboards for each role.
- Continuous model performance monitoring, data drift detection, and feedback loop.

---

## 1. Environment Setup

```bash
# 1. Clone repository
git clone https://github.com/Janvithakre25/the_grid.git
cd energy_forecast_india

# 2. Install Dependencies
pip install -r requirements.txt
pip install torch prophet lime matplotlib holidays
```

---

## 2. Pipeline Execution Steps

Run the pipeline scripts in sequential order:

```bash
# Step 1: Build deduplicated dataset with Indian public holidays
python 01_build_india_dataset.py

# Step 2: Fetch real Open-Meteo weather data (temperature & humidity) for 33 states
python 06_fetch_real_weather_india.py

# Step 3: Preprocess data & engineer time-series features (lags, rolling stats, cyclical encodings)
python 02_preprocess_india.py

# Step 4: Multi-model training & evaluation across 33 states x 2 horizons x 5 model types
python 03_train_models_india.py

# Step 5: Explainable AI attributions (SHAP & LIME)
python 04_shap_explain_india.py
python 04b_lime_explain_india.py

# Step 6: Smart Grid Recommendation Engine
python 05_recommendation_engine_india.py

# Step 7: Continuous Monitoring & Retraining
python 07_monitor_retrain_india.py

# Step 8: Actual vs Predicted Feedback Loop
python 08_feedback_loop_india.py
```

---

## 3. Running the Dashboard Web Application

Start the FastAPI application server:

```bash
uvicorn app:app --reload --port 8000
```

Open `http://127.0.0.1:8000` in your web browser.

### Role Credentials for Testing:
- **Administrator:** `admin / admin123`
- **Grid Operator:** `operator / operator123`
- **Utility Company:** `utility / utility123`

---

## 4. Evaluated Forecasting Models & Selection

Total Model Evaluations: **330 evaluations** across 33 states/UTs × 2 horizons × 5 models.

### Best Model Breakdown Across 66 State-Horizon Pairs:
- **Random Forest:** 36 best selections
- **XGBoost:** 16 best selections
- **PyTorch LSTM:** 6 best selections
- **Facebook Prophet:** 4 best selections
- **PyTorch GRU:** 4 best selections

The API server dynamically loads the verified best model algorithm from `outputs/best_models_india.csv` for each requested state and horizon.

---

## 5. Documentation & Reports Directory

Detailed project documentation files:
- `DATA_PROCESSING_REPORT.md` — Data quality audit, cleaning, alignment, & feature engineering.
- `MODEL_EVALUATION_REPORT.md` — Complete 5-model evaluation metrics (MAE, RMSE, MAPE %, R²).
- `EXPLAINABILITY_REPORT.md` — Theoretical & empirical SHAP / LIME report.
- `RECOMMENDATION_REPORT.md` — Severity classification & action recommendation rules.
- `SYSTEM_ARCHITECTURE.md` — Full data flow, backend/frontend, auth, & drift architecture.
- `TESTING_REPORT.md` — Verification test suite results & bug fixes.
