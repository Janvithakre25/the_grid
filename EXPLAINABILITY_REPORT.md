# Explainable AI (SHAP & LIME) Report

## Executive Summary
This report details the Explainable AI (XAI) layer implemented for the energy consumption forecasting system. Both **SHAP (Shapley Additive Explanations)** and **LIME (Local Interpretable Model-agnostic Explanations)** are integrated into the pipeline and exposed via REST APIs.

---

## 1. Methodology & Theoretical Comparison

| Property | SHAP (Shapley Additive Explanations) | LIME (Local Interpretable Model-agnostic Explanations) |
| :--- | :--- | :--- |
| **Mathematical Basis** | Game-theoretic Shapley values computing marginal contributions | Local linear surrogate model approximating non-linear model decision boundary |
| **Scope** | Globally consistent & locally exact additive feature attributions | Locally faithful, human-readable linear approximation |
| **Primary Use Case** | Quantifying global feature rankings & exact single-prediction feature impact | Explaining individual operational forecasts to grid dispatchers |

---

## 2. Top Feature Drivers Analysis (Maharashtra Example)

### SHAP Feature Contributions for Sample Peak Day Forecast (2020-04-20)

| Feature | Feature Value | SHAP Impact (MU) | Impact Direction |
| :--- | :--- | :--- | :--- |
| `lag_1d` | 408.30 MU | -11.02 MU | Lowered demand prediction relative to base |
| `roll_mean_30d` | 401.49 MU | +9.42 MU | Raised demand prediction due to higher monthly baseline |
| `lag_7d` | 443.00 MU | -5.37 MU | Lowered demand prediction |
| `roll_std_7d` | 13.20 MU | -5.25 MU | Lowered demand prediction |
| `roll_mean_7d` | 432.23 MU | +4.62 MU | Raised demand prediction |
| `temperature_c` | 33.0 °C | +3.24 MU | Raised demand prediction due to elevated cooling load |

---

## 3. LIME Local Linear Explanation (Maharashtra Example)

### LIME Feature Rule Weights for Sample Forecast

| Feature Condition / Interval | Weight | Interpretation |
| :--- | :--- | :--- |
| `433.70 < lag_7d <= 464.00` | -7.12 | Previous week high load indicates upcoming cyclical drop |
| `403.70 < lag_1d <= 432.00` | -6.83 | Previous day moderate consumption bounds current forecast |
| `roll_mean_30d <= 425.32` | +4.26 | 30-day baseline supports stable upward demand |
| `414.46 < roll_mean_7d <= 436.17` | +3.77 | 7-day trend supports steady baseline demand |

---

## 4. UI & API Integration
- **Endpoints:** `/explain/{state}?horizon=1d` (SHAP) and `/explain_lime/{state}?horizon=1d` (LIME).
- **Interactive UI:** Dynamic horizontal bar chart in the Grid Operator Dashboard toggles seamlessly between SHAP and LIME modes.
