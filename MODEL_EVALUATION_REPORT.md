# Model Evaluation & Best Model Selection Report

## Executive Summary
This report presents the empirical validation results of **5 forecasting model architectures** evaluated across **33 Indian States and Union Territories** for both **1-day ahead (24-Hour)** and **7-day ahead (Weekly)** forecasting horizons.

Model selection was conducted strictly based on empirical test metrics obtained via chronological time-series splitting (80% training set, 20% hold-out test set, zero shuffling).

---

## 1. Evaluated Model Architectures

1. **Random Forest Regressor:** Ensemble tree model (200 trees, max depth 12).
2. **XGBoost Regressor:** Gradient boosted decision trees (300 estimators, learning rate 0.05).
3. **LSTM (Long Short-Term Memory):** 2-layer PyTorch Recurrent Neural Network (32 hidden units, 7-day lookback window).
4. **GRU (Gated Recurrent Unit):** 2-layer PyTorch Recurrent Neural Network (32 hidden units, 7-day lookback window).
5. **Prophet (Facebook Prophet):** Additive time-series model with weekly seasonality and weather regressors.

---

## 2. Overall Model Performance & Selection Summary

Total model evaluations performed: **330 evaluations** (33 states × 2 horizons × 5 models).

### Best Model Selection Breakdown Across 66 State-Horizon Pairs:

| Model Architecture | Times Selected as Best Model | Percentage of Total Pairs | Key Strengths |
| :--- | :--- | :--- | :--- |
| **Random Forest** | **36** | **54.5%** | Robust against noise, excellent for non-linear load volatility |
| **XGBoost** | **16** | **24.2%** | High precision on sharp demand shifts & industrial load centers |
| **LSTM** | **6** | **9.1%** | Captures complex sequential temporal dependencies in major states |
| **Prophet** | **4** | **6.1%** | Strong macro-seasonality performance for regional weekly forecasts |
| **GRU** | **4** | **6.1%** | Efficient temporal sequential modeling with lower variance |

---

## 3. Sample State Performance Metrics

### Short-Term (1-Day Ahead) Best Verified Models

| State / UT | Selected Best Model | MAE (MU) | RMSE (MU) | MAPE (%) | R² Score |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Andhra Pradesh** | **XGBoost** | 8.52 | 11.96 | 5.05% | 0.2875 |
| **Arunachal Pradesh** | **LSTM** | 0.18 | 0.24 | 9.82% | 0.1410 |
| **Assam** | **XGBoost** | 2.07 | 2.73 | 8.82% | 0.2225 |
| **Bihar** | **Random Forest** | 9.12 | 12.58 | 11.65% | -0.0894 |
| **Chandigarh** | **XGBoost** | 0.45 | 0.63 | 11.97% | 0.6599 |
| **Chhattisgarh** | **Random Forest** | 6.41 | 7.86 | 8.05% | 0.2474 |
| **Delhi** | **Random Forest** | 10.05 | 14.81 | 12.92% | 0.6573 |
| **Gujarat** | **Random Forest** | 21.37 | 30.66 | 7.01% | 0.3778 |
| **Maharashtra** | **Random Forest** | 18.88 | 24.93 | 4.51% | 0.5788 |
| **Punjab** | **XGBoost** | 5.91 | 8.42 | 4.88% | 0.7812 |

---

### Medium-Term (7-Day Ahead) Best Verified Models

| State / UT | Selected Best Model | MAE (MU) | RMSE (MU) | MAPE (%) | R² Score |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Andhra Pradesh** | **Random Forest** | 10.99 | 13.01 | 6.45% | 0.1877 |
| **Arunachal Pradesh** | **Prophet** | 0.17 | 0.25 | 9.34% | 0.0731 |
| **Assam** | **Prophet** | 2.49 | 3.43 | 9.81% | -0.2196 |
| **Chandigarh** | **XGBoost** | 0.53 | 0.70 | 14.54% | 0.5831 |
| **DNH** | **GRU** | 3.24 | 5.36 | 83.17% | -0.0372 |
| **Delhi** | **XGBoost** | 18.69 | 25.77 | 22.90% | -0.0167 |
| **Goa** | **Random Forest** | 1.28 | 1.73 | 13.65% | -0.1185 |
| **Maharashtra** | **Random Forest** | 24.12 | 31.45 | 5.82% | 0.3214 |

---

## 4. Empirical Model Justification
- **No Single Best Model:** Performance varies significantly across states due to differing industrial vs agricultural load shares.
- **Dynamic Serving:** The FastAPI backend dynamically inspects `outputs/best_models_india.csv` to load the genuinely top-performing algorithm for each requested state and horizon.
