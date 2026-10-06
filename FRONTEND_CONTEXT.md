# Frontend Architecture & Developer Context Document

## 1. Overview & Technology Stack

The **Smart Grid AI Forecasting & Optimization Platform** frontend is a high-performance, responsive single-page web application. It provides interactive dashboards tailored for three distinct user roles: **Grid Operator**, **Utility Company**, and **System Administrator**.

### Core Technologies:
- **Structure:** Semantic HTML5 (`dashboard/index.html`)
- **Logic:** Vanilla JavaScript ES6+ (`dashboard/app.js`)
- **Styling:** Custom CSS3 with Design System Tokens (`dashboard/styles.css`)
- **Visualizations:** Chart.js 4.4.4 (Line charts, dual-axis charts, horizontal bar charts) with `chartjs-plugin-zoom` and `hammer.js` for zoom/pan interactivity
- **Typography:** Google Fonts (`Inter` for UI body, `IBM Plex Mono` for numerical values & metrics)

---

## 2. Directory Layout & Mirrors

```
dashboard/
├── index.html   # Main application HTML structure & view templates
├── app.js       # Core application state, auth, API client, & Chart.js logic
└── styles.css   # Modern dark/light theme CSS variables, layouts, & components

frontend/        # Exact production mirror directory
├── index.html
├── app.js
└── styles.css
```

---

## 3. User Authentication & Role Views

The frontend manages session tokens and role permissions using browser `sessionStorage`:

### Role Access Breakdown:
1. **Grid Operator (`operator / operator123`)**:
   - **View:** `view-operator-section`
   - **Features:** 60-day operational load forecast vs actual consumption chart with 80%/90%/95% confidence intervals, zoom controls, SHAP/LIME factor breakdown toggle, and Smart Grid Decision Support Banner.
2. **Utility Company (`utility / utility123`)**:
   - **View:** `view-utility-section`
   - **Features:** Utility load management overview, daily temperature-demand dual-axis interaction chart, and demand-response (DR) opportunity directives.
3. **Administrator (`admin / admin123`)**:
   - **View:** `view-admin-section` (plus full navigation access to Grid Operator and Utility Planning tabs)
   - **Features:** System stats overview, verified model selection table (MAE, RMSE, MAPE %, R² across 33 states), and continuous data drift monitoring log.

---

## 4. Key Functions in `app.js`

- **`DOMContentLoaded` Listener:** Checks `sessionStorage.getItem("jwt_token")`. Calls `GET /me` to validate session token on reload. If valid, renders `showDashboardView()`; if invalid/expired, invokes `handleLogout()`.
- **`handleLogin(e)`:** Submits credentials to `POST /login`, stores token and role in `sessionStorage`, and transitions to the dashboard.
- **`switchRoleView(roleTab)`:** Activates target view section, enforces role navigation access (prevents non-admins from switching to admin view), and triggers chart re-rendering/resizing.
- **`loadStatesList()`:** Fetches state list from `GET /states` and populates the 33 Indian States/UTs dropdown (`state-select`).
- **`refreshDashboard()`:** Parallel-fetches `GET /forecast/{state}`, `GET /history/{state}`, and `GET /recommend/{state}` to update KPI metrics, recommendation banners, load charts, and explainability plots.
- **`renderForecastChart()`:** Constructs Chart.js line plot with historical actuals, projected forecast point/trend, and toggleable confidence band ($z \times \sigma \times \sqrt{h}$).
- **`loadExplainabilityData()`:** Fetches SHAP (`GET /explain/{state}`) or LIME (`GET /explain_lime/{state}`) attributions and renders a horizontal bar chart (`shapChart`).
- **`renderUtilityView()`:** Renders dual-axis temperature (°C) vs load (MU) line chart (`utilityWeatherChart`).
- **`loadAdminData()` & `loadMonitoringData()`:** Populates model accuracy comparison table (`/best_models`) and drift monitoring log table (`/monitoring`).

---

## 5. CSS Design System & Theme Tokens

`styles.css` defines root CSS variables for dynamic dark and light mode switching (`data-theme="dark" | "light"`):

```css
:root[data-theme="dark"] {
  --bg-main: #0b1329;
  --bg-card: #131f37;
  --text-main: #f1f5f9;
  --text-muted: #94a3b8;
  --accent-cyan: #38bdf8;
  --accent-amber: #fbbf24;
  --accent-rose: #fb7185;
  --accent-teal: #2dd4bf;
  --border-color: #21324d;
}
```

---

## 6. How to Run & Develop Frontend

1. Ensure backend FastAPI server is running (`python -m uvicorn app:app --reload --port 8000`).
2. Open `http://127.0.0.1:8000` in any modern web browser (Chrome, Firefox, Edge, Safari).
3. Test sign-in using demo credentials (`admin/admin123`, `operator/operator123`, `utility/utility123`).
