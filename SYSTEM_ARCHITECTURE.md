# System Architecture & Technical Documentation

## Executive Summary
This document provides complete system architecture documentation for the AI-Powered Smart Grid Energy Consumption Forecasting Platform.

---

## 1. System Architecture Overview

```
 ┌─────────────────────────────────────────────────────────┐
 │             User Registration & Authentication          │
 │   - Administrator (admin)  - Grid Operator (operator)   │
 │               - Utility Company (utility)               │
 └────────────────────────────┬────────────────────────────┘
                              │ JWT Bearer Auth Token
                              ▼
 ┌─────────────────────────────────────────────────────────┐
 │               Data Ingestion Architecture               │
 │   - Electricity Load (POSOCO 33 Indian States/UTs)      │
 │   - Weather (Open-Meteo Temperature & Humidity)         │
 │   - Indian Public Holidays (holidays package)           │
 └────────────────────────────┬────────────────────────────┘
                              │ Clean Time-Series Streams
                              ▼
 ┌─────────────────────────────────────────────────────────┐
 │           Data Preprocessing & Feature Engineering      │
 │   - Interpolation & Outlier Clipping [1%, 99%]          │
 │   - Demand Lags (1d, 7d, 30d) & Rolling Stats (7d, 30d) │
 │   - Cyclical Temporal Encodings (dow, month, doy)       │
 └────────────────────────────┬────────────────────────────┘
                              │ Clean Features (Zero Leakage)
                              ▼
 ┌─────────────────────────────────────────────────────────┐
 │               Multi-Model Forecasting Core              │
 │  Random Forest  |  XGBoost  |  LSTM  |  GRU  | Prophet  │
 └────────────────────────────┬────────────────────────────┘
                              │ Predictions & Metrics
                              ▼
 ┌─────────────────────────────────────────────────────────┐
 │             Empirical Best Model Selection              │
 │     Dynamically Selects Lowest MAE Model per Node/Horizon│
 └────────────────────────────┬────────────────────────────┘
                              │ Best Model Artifacts (.pkl/.pt)
                              ▼
 ┌─────────────────────────────────────────────────────────┐
 │           Explainable AI (SHAP & LIME Layer)            │
 │     Additive SHAP Drivers & LIME Local Rules            │
 └────────────────────────────┬────────────────────────────┘
                              │ Feature Attribution Matrices
                              ▼
 ┌─────────────────────────────────────────────────────────┐
 │            Smart Grid Recommendation Engine             │
 │   - Peak-Shaving Alerts  - Load Shifting Suggestions    │
 │   - Maintenance Windows  - Severity Classification  │
 └────────────────────────────┬────────────────────────────┘
                              │ Operational Directives
                              ▼
 ┌─────────────────────────────────────────────────────────┐
 │         Role-Based Interactive Web Dashboards           │
 │  [Grid Operator View] | [Utility View] | [Admin View]   │
 └────────────────────────────┬────────────────────────────┘
                              │ Feedback & Actuals
                              ▼
 ┌─────────────────────────────────────────────────────────┐
 │          Continuous Monitoring & Retraining Loop        │
 │   - Rolling Window MAE Checks  - Data Drift Flagging    │
 │   - Automatic Re-training & Versioning                │
 └─────────────────────────────────────────────────────────┘
```

---

## 2. Component Specifications

### A. Data Ingestion & Storage Architecture
- **Raw Data Ingestion:** POSOCO reported daily state electricity consumption (`long_data_.csv`).
- **Weather Ingestion:** Open-Meteo historical daily temperature and relative humidity fetched via latitude/longitude (`weather_india_real.csv`).
- **Processed Storage:** Per-state clean CSV datasets stored under `data/processed_<State>.csv`. Raw files remain un-overwritten.

### B. Backend Architecture (FastAPI)
- **Framework:** FastAPI with Uvicorn ASGI web server.
- **Authentication:** JWT (JSON Web Token) bearer tokens with role claims.
- **Key API Endpoints:**
  - `POST /login`: User authentication & role dispatch.
  - `GET /states`: List 33 available Indian states/UTs.
  - `GET /forecast/{state}`: Serves predictions from the genuinely best verified model for that state & horizon.
  - `GET /explain/{state}` & `GET /explain_lime/{state}`: Serves SHAP & LIME factor attributions.
  - `GET /recommend/{state}`: Serves operational decision recommendations.
  - `GET /monitoring` & `GET /feedback`: Serves drift log & accuracy history.

### C. Frontend Architecture (Vanilla ES6+ & Chart.js 4.x)
- **Zero Heavy Build Step:** Native browser ES6 JavaScript, HTML5, and CSS3 design system.
- **Visualizations:** Chart.js line charts with confidence bands (80%, 90%, 95%), zoom plugin support, and SHAP/LIME horizontal bar charts.

---

## 3. Feedback Loop & Automated Retraining
- **Feedback Collection (`08_feedback_loop_india.py`):** Appends verified actual demand as smart meter readings arrive, logging absolute error and percentage error into `outputs/feedback_log_india.csv`.
- **Drift Monitoring & Retraining (`07_monitor_retrain_india.py`):** Computes rolling MAE in 14-day evaluation windows. If window MAE exceeds baseline MAE by **1.25×**, data drift is flagged, triggering automated model retraining and logging to `outputs/monitoring_log_india.csv`.
