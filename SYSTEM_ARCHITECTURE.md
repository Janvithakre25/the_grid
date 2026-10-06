# System Architecture & Technical Documentation

## Executive Summary
This document provides complete system architecture documentation for the AI-Powered Smart Grid Energy Consumption Forecasting Platform built for 33 Indian States and Union Territories.

---

## 1. End-to-End System Architecture Overview

```
 ┌─────────────────────────────────────────────────────────┐
 │             User Registration & Authentication          │
 │   - Administrator (admin)  - Grid Operator (operator)   │
 │               - Utility Company (utility)               │
 └────────────────────────────┬────────────────────────────┘
                              │ JWT Bearer Auth Token & Profile (/me)
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
                              │ Predictions & Metrics (330 Evaluations)
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
 └────────────────────────────┴────────────────────────────┘
```

---

## 2. Component Specifications

### A. Data Ingestion & Storage Architecture
- **Raw Data Ingestion:** POSOCO daily electricity consumption data (`long_data_.csv`).
- **Weather Ingestion:** Open-Meteo historical daily temperature and relative humidity (`weather_india_real.csv`).
- **Processed Storage:** Per-state clean CSV datasets stored under `data/processed_<State>.csv`. Raw files remain un-overwritten.

### B. Backend Architecture (FastAPI)
- **Framework:** FastAPI with Uvicorn ASGI web server.
- **Authentication & Security:** JWT (JSON Web Token) bearer tokens with role claims. Admin routes enforce `verify_admin_token` returning `403 Forbidden` for non-admins.
- **Key API Endpoints:**
  - `POST /login`: User authentication & JWT issuance.
  - `GET /me`: Authenticated profile validation & role check.
  - `GET /states`: List 33 available Indian states/UTs.
  - `GET /forecast/{state}`: Predictions and evaluation metrics for verified best model.
  - `GET /history/{state}`: Historical daily load, temperature, humidity, and holiday flags.
  - `GET /explain/{state}` & `GET /explain_lime/{state}`: SHAP and LIME factor attributions.
  - `GET /recommend/{state}`: Operational decision recommendations & severity.
  - `GET /monitoring`, `GET /best_models`, `GET /model_comparison`, `GET /feedback`: Admin monitoring and metrics log endpoints.

### C. Frontend Architecture (Vanilla ES6+ & Chart.js 4.x)
- **Zero Heavy Build Step:** Native browser ES6 JavaScript, HTML5, and CSS3 design system.
- **Visualizations:** Chart.js line charts with confidence bands (80%, 90%, 95%), zoom plugin support, dual-axis weather interaction charts, and SHAP/LIME horizontal bar charts.
- **Role Dashboard Views:** Grid Operator, Utility Planning, and System Admin views driven by authenticated user role.

---

## 3. Feedback Loop & Automated Retraining
- **Feedback Collection (`08_feedback_loop_india.py`):** Logs actual vs. predicted demand as smart-meter readings arrive into `outputs/feedback_log_india.csv`.
- **Drift Monitoring & Retraining (`07_monitor_retrain_india.py`):** Computes rolling MAE in 14-day evaluation windows. Flags data drift when window MAE exceeds 1.25× baseline MAE, auto-retraining models and updating `outputs/monitoring_log_india.csv`.
