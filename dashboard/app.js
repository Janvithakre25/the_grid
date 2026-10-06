/**
 * SMART GRID AI FORECASTING & OPTIMIZATION PLATFORM - FRONTEND APPLICATION
 * Vanilla JavaScript (ES6+), Chart.js 4.x integration.
 * Connects to FastAPI backend (app.py) supporting JWT Authentication & 3 User Roles:
 * 1. Administrator
 * 2. Grid Operator
 * 3. Utility Company
 */

const API_BASE_URL = (window.location.origin && window.location.origin.startsWith("http") && !window.location.origin.includes("file://"))
  ? window.location.origin
  : "http://127.0.0.1:8000";

const Z_SCORES = {
  "0.80": 1.28,
  "0.90": 1.645,
  "0.95": 1.96
};

// Global State
let authToken = sessionStorage.getItem("jwt_token") || null;
let userRole = sessionStorage.getItem("user_role") || null;
let userName = sessionStorage.getItem("user_name") || null;

let forecastChart = null;
let shapChart = null;
let utilityWeatherChart = null;

let currentHistoryData = null;
let currentForecastData = null;

// DOM Element Selectors
const loginView = document.getElementById("login-view");
const dashboardView = document.getElementById("dashboard-view");
const loginForm = document.getElementById("login-form");
const usernameInput = document.getElementById("username-input");
const passwordInput = document.getElementById("password-input");
const loginErrorAlert = document.getElementById("login-error-alert");

const userRolePill = document.getElementById("user-role-pill");
const userNameDisplay = document.getElementById("user-name-display");
const roleViewBadge = document.getElementById("role-view-badge");

const stateSelect = document.getElementById("state-select");
const horizonSelect = document.getElementById("horizon-select");
const explainTypeSelect = document.getElementById("explain-type-select");

const ciToggle = document.getElementById("ci-toggle");
const ciLevelSelect = document.getElementById("ci-level-select");
const resetZoomBtn = document.getElementById("reset-zoom-btn");

const logoutBtn = document.getElementById("logout-btn");
const themeToggleBtn = document.getElementById("theme-toggle-btn");

// Role Tabs
const tabOperator = document.getElementById("tab-operator");
const tabUtility = document.getElementById("tab-utility");
const tabAdmin = document.getElementById("tab-admin");

const viewOperatorSection = document.getElementById("view-operator-section");
const viewUtilitySection = document.getElementById("view-utility-section");
const viewAdminSection = document.getElementById("view-admin-section");
const commonControlsBar = document.getElementById("common-controls-bar");

// Initialize Application
document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  setupEventListeners();

  if (authToken) {
    try {
      const me = await apiFetch("/me");
      userRole = me.role;
      userName = me.name;
      sessionStorage.setItem("user_role", userRole);
      sessionStorage.setItem("user_name", userName);
      showDashboardView();
    } catch (err) {
      console.warn("Stored session invalid or expired:", err);
      handleLogout();
    }
  } else {
    showLoginView();
  }
});

function initTheme() {
  const savedTheme = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  const icon = document.getElementById("theme-icon");
  if (icon) icon.textContent = savedTheme === "dark" ? "☀️" : "🌙";
}

function setupEventListeners() {
  if (loginForm) loginForm.addEventListener("submit", handleLogin);
  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);
  if (themeToggleBtn) themeToggleBtn.addEventListener("click", toggleTheme);

  if (stateSelect) stateSelect.addEventListener("change", refreshDashboard);
  if (horizonSelect) horizonSelect.addEventListener("change", refreshDashboard);
  if (explainTypeSelect) explainTypeSelect.addEventListener("change", loadExplainabilityData);

  if (ciToggle) ciToggle.addEventListener("change", renderForecastChart);
  if (ciLevelSelect) ciLevelSelect.addEventListener("change", renderForecastChart);
  if (resetZoomBtn) resetZoomBtn.addEventListener("click", () => {
    if (forecastChart && forecastChart.resetZoom) forecastChart.resetZoom();
  });

  // Role Tab Switching
  document.querySelectorAll("[data-role-tab]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const targetRole = e.target.getAttribute("data-role-tab");
      switchRoleView(targetRole);
    });
  });

  const refreshAdminBtn = document.getElementById("refresh-admin-models-btn");
  if (refreshAdminBtn) refreshAdminBtn.addEventListener("click", loadAdminData);

  const refreshMonBtn = document.getElementById("refresh-monitoring-btn");
  if (refreshMonBtn) refreshMonBtn.addEventListener("click", loadMonitoringData);
}

// ---------------------------------------------------------------
// AUTHENTICATION HANDLERS
// ---------------------------------------------------------------
async function handleLogin(e) {
  e.preventDefault();
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (!username || !password) {
    showLoginError("Please enter both username and password.");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.detail || "Authentication failed.");
    }

    const data = await response.json();
    authToken = data.access_token;
    userRole = data.role;
    userName = data.name || username;

    sessionStorage.setItem("jwt_token", authToken);
    sessionStorage.setItem("user_role", userRole);
    sessionStorage.setItem("user_name", userName);

    if (loginErrorAlert) loginErrorAlert.style.display = "none";

    showDashboardView();
  } catch (err) {
    const errorMsg = (err.message && err.message.includes("Failed to fetch"))
      ? "Cannot connect to backend server. Make sure Python server is running via 'python -m uvicorn app:app --reload --port 8000'."
      : err.message;
    showLoginError(errorMsg);
  }
}

function handleLogout() {
  authToken = null;
  userRole = null;
  userName = null;
  sessionStorage.clear();
  if (loginErrorAlert) loginErrorAlert.style.display = "none";
  showLoginView();
}

function showLoginView() {
  loginView.style.display = "flex";
  dashboardView.style.display = "none";
}

function showDashboardView() {
  loginView.style.display = "none";
  dashboardView.style.display = "block";

  if (userNameDisplay) userNameDisplay.textContent = userName || "User";
  if (userRolePill) userRolePill.textContent = userRole || "User";

  // Role Tab Visibility based on authenticated user's role
  const adminTab = document.getElementById("tab-admin");
  const utilityTab = document.getElementById("tab-utility");
  const operatorTab = document.getElementById("tab-operator");

  if (userRole === "Grid Operator") {
    if (adminTab) adminTab.style.display = "none";
    if (utilityTab) utilityTab.style.display = "none";
    if (operatorTab) operatorTab.style.display = "inline-flex";
    switchRoleView("operator");
  } else if (userRole === "Utility Company") {
    if (adminTab) adminTab.style.display = "none";
    if (utilityTab) utilityTab.style.display = "inline-flex";
    if (operatorTab) operatorTab.style.display = "none";
    switchRoleView("utility");
  } else {
    // Administrator has access to all role tabs
    if (adminTab) adminTab.style.display = "inline-flex";
    if (utilityTab) utilityTab.style.display = "inline-flex";
    if (operatorTab) operatorTab.style.display = "inline-flex";
    switchRoleView("admin");
  }

  loadStatesList();
}

function showLoginError(msg) {
  if (loginErrorAlert) {
    loginErrorAlert.textContent = msg;
    loginErrorAlert.style.display = "block";
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  const icon = document.getElementById("theme-icon");
  if (icon) icon.textContent = next === "dark" ? "☀️" : "🌙";
}

// ---------------------------------------------------------------
// ROLE DASHBOARD VIEW SWITCHING
// ---------------------------------------------------------------
function switchRoleView(roleTab) {
  // Prevent unauthorized role tab switching
  if (roleTab === "admin" && userRole !== "Administrator") {
    return;
  }

  document.querySelectorAll(".role-nav-btn").forEach(btn => btn.classList.remove("active"));
  const activeBtn = document.querySelector(`[data-role-tab="${roleTab}"]`);
  if (activeBtn) activeBtn.classList.add("active");

  viewOperatorSection.style.display = roleTab === "operator" ? "block" : "none";
  viewUtilitySection.style.display = roleTab === "utility" ? "block" : "none";
  viewAdminSection.style.display = roleTab === "admin" ? "block" : "none";

  commonControlsBar.style.display = roleTab === "admin" ? "none" : "grid";

  if (roleViewBadge) {
    if (roleTab === "operator") roleViewBadge.textContent = "Grid Operator View";
    else if (roleTab === "utility") roleViewBadge.textContent = "Utility Planning View";
    else roleViewBadge.textContent = "System Admin View";
  }

  if (roleTab === "admin") {
    loadAdminData();
    loadMonitoringData();
  } else {
    refreshDashboard();
  }
}

// ---------------------------------------------------------------
// DATA FETCHING & DASHBOARD REFRESH
// ---------------------------------------------------------------
async function apiFetch(endpoint) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (response.status === 401) {
    handleLogout();
    throw new Error("Session expired. Please log in again.");
  }
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || "API request failed.");
  }
  return await response.json();
}

async function loadStatesList() {
  try {
    const data = await apiFetch("/states");
    stateSelect.innerHTML = "";
    data.states.forEach(state => {
      const opt = document.createElement("option");
      opt.value = state;
      opt.textContent = state.replace(/_/g, " ");
      if (state === "Maharashtra") opt.selected = true;
      stateSelect.appendChild(opt);
    });
    refreshDashboard();
  } catch (err) {
    console.error("Failed to load states list:", err);
  }
}

async function refreshDashboard() {
  const state = stateSelect.value || "Maharashtra";
  const horizon = horizonSelect.value || "1d";

  try {
    const [fcData, histData, recData] = await Promise.all([
      apiFetch(`/forecast/${state}?horizon=${horizon}`),
      apiFetch(`/history/${state}?days=60`),
      apiFetch(`/recommend/${state}?horizon=${horizon}`),
    ]);

    currentForecastData = fcData;
    currentHistoryData = histData;

    updateKPIs(fcData);
    updateRecommendationBanner(recData);
    renderForecastChart();
    loadExplainabilityData();
    renderUtilityView(fcData, histData, recData);
  } catch (err) {
    console.error("Error refreshing dashboard:", err);
  }
}

function updateKPIs(fc) {
  document.getElementById("kpi-val-actual").textContent = fc.last_actual_mu ? fc.last_actual_mu.toFixed(2) : "—";
  document.getElementById("kpi-sub-actual").textContent = `As of: ${fc.as_of || "—"}`;

  document.getElementById("kpi-val-forecast").textContent = fc.predicted_mu ? fc.predicted_mu.toFixed(2) : "—";
  document.getElementById("kpi-sub-forecast").textContent = `Horizon: ${fc.horizon === "1d" ? "1 Day Ahead" : "7 Days Ahead"}`;

  document.getElementById("kpi-val-model").textContent = fc.model_used || "XGBoost";
  document.getElementById("kpi-sub-model").textContent = "Genuinely Best Verified Model";

  document.getElementById("kpi-val-mae").textContent = fc.mae !== null ? fc.mae.toFixed(2) : "—";
  document.getElementById("kpi-sub-mae").textContent = fc.r2 !== null ? `R² Score: ${fc.r2.toFixed(3)}` : "Test evaluation metric";
}

function updateRecommendationBanner(rec) {
  const banner = document.getElementById("recommendation-banner");
  const icon = document.getElementById("banner-icon");
  const tag = document.getElementById("banner-severity-tag");
  const actionText = document.getElementById("banner-action-text");
  const meta = document.getElementById("banner-meta-info");

  banner.className = `recommendation-banner ${rec.severity}`;
  tag.textContent = rec.severity;
  actionText.textContent = rec.action;
  meta.textContent = `Forecast: ${rec.predicted_mu} MU | Temp: ${rec.temperature_c}°C | High Limit: ${rec.high_threshold_mu} MU`;

  if (rec.severity === "HIGH") icon.textContent = "🚨";
  else if (rec.severity === "LOW") icon.textContent = "⚙️";
  else icon.textContent = "💡";
}

// ---------------------------------------------------------------
// FORECAST CHART RENDERING
// ---------------------------------------------------------------
function renderForecastChart() {
  if (!currentHistoryData || !currentForecastData) return;

  const ctx = document.getElementById("forecast-chart").getContext("2d");
  const dates = [...currentHistoryData.dates];
  const actuals = [...currentHistoryData.consumption_mu];

  // Append forecast point
  const lastDate = new Date(dates[dates.length - 1]);
  const horizonDays = currentForecastData.horizon === "1d" ? 1 : 7;
  lastDate.setDate(lastDate.getDate() + horizonDays);
  const forecastDateStr = lastDate.toISOString().split("T")[0];

  dates.push(forecastDateStr);

  const forecastSeries = new Array(actuals.length - 1).fill(null);
  forecastSeries.push(actuals[actuals.length - 1]); // Connect with last actual
  forecastSeries.push(currentForecastData.predicted_mu);

  // Confidence Interval Calculation
  const showCI = ciToggle.checked;
  const confidenceLevel = ciLevelSelect.value;
  const zScore = Z_SCORES[confidenceLevel] || 1.96;

  // Residual std estimate from recent history
  const diffs = [];
  for (let i = 1; i < actuals.length; i++) diffs.push(Math.abs(actuals[i] - actuals[i - 1]));
  const std = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const margin = zScore * std * Math.sqrt(horizonDays);

  const ciUpper = new Array(actuals.length - 1).fill(null);
  const ciLower = new Array(actuals.length - 1).fill(null);

  ciUpper.push(actuals[actuals.length - 1]);
  ciLower.push(actuals[actuals.length - 1]);
  ciUpper.push(currentForecastData.predicted_mu + margin);
  ciLower.push(Math.max(0, currentForecastData.predicted_mu - margin));

  if (forecastChart) forecastChart.destroy();

  const datasets = [
    {
      label: "Historical Consumption (MU)",
      data: actuals,
      borderColor: "#38bdf8",
      backgroundColor: "rgba(56, 189, 248, 0.1)",
      borderWidth: 2,
      fill: true,
      tension: 0.2,
      pointRadius: 2,
    },
    {
      label: `AI Forecast (${currentForecastData.model_used})`,
      data: forecastSeries,
      borderColor: "#fbbf24",
      borderDash: [6, 4],
      borderWidth: 3,
      pointRadius: 5,
      pointBackgroundColor: "#fbbf24",
    },
  ];

  if (showCI) {
    datasets.push({
      label: `Upper Bound (${Math.round(confidenceLevel * 100)}% CI)`,
      data: ciUpper,
      borderColor: "transparent",
      backgroundColor: "rgba(251, 191, 36, 0.2)",
      fill: "+1", // Fill down to Lower Bound
      pointRadius: 0,
    });
    datasets.push({
      label: `Lower Bound (${Math.round(confidenceLevel * 100)}% CI)`,
      data: ciLower,
      borderColor: "transparent",
      pointRadius: 0,
    });
  }

  forecastChart = new Chart(ctx, {
    type: "line",
    data: { labels: dates, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#f1f5f9", font: { family: "Inter" } } },
        tooltip: { mode: "index", intersect: false },
      },
      scales: {
        x: { ticks: { color: "#94a3b8" }, grid: { color: "#21324d" } },
        y: {
          ticks: { color: "#94a3b8" },
          grid: { color: "#21324d" },
          title: { display: true, text: "Energy Consumption (MU)", color: "#94a3b8" },
        },
      },
    },
  });
}

// ---------------------------------------------------------------
// EXPLAINABILITY CHART (SHAP / LIME)
// ---------------------------------------------------------------
async function loadExplainabilityData() {
  const state = stateSelect.value || "Maharashtra";
  const horizon = horizonSelect.value || "1d";
  const explainType = explainTypeSelect.value || "shap";

  const title = document.getElementById("explain-chart-title");
  const caption = document.getElementById("explain-chart-caption");

  try {
    if (explainType === "lime") {
      if (title) title.textContent = "Top Feature Drivers (LIME Explanation)";
      if (caption) caption.textContent = "Local linear approximation showing factor weights for this prediction.";
      const data = await apiFetch(`/explain_lime/${state}?horizon=${horizon}`);
      renderLimeChart(data.lime_factors);
    } else {
      if (title) title.textContent = "Top Feature Drivers (SHAP Explanation)";
      if (caption) caption.textContent = "Coral bars (+): Raising energy demand. Teal bars (−): Lowering energy demand.";
      const data = await apiFetch(`/explain/${state}?horizon=${horizon}`);
      renderShapChart(data.top_factors);
    }
  } catch (err) {
    console.error("Explainability fetch failed:", err);
  }
}

function renderShapChart(factors) {
  const ctx = document.getElementById("shap-chart").getContext("2d");
  if (shapChart) shapChart.destroy();

  const labels = factors.map(f => f.feature);
  const impacts = factors.map(f => f.shap_impact);
  const bgColors = impacts.map(v => v >= 0 ? "#fb7185" : "#2dd4bf");

  shapChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "SHAP Impact",
        data: impacts,
        backgroundColor: bgColors,
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#94a3b8" }, grid: { color: "#21324d" } },
        y: { ticks: { color: "#f1f5f9" }, grid: { display: false } },
      },
    },
  });
}

function renderLimeChart(factors) {
  const ctx = document.getElementById("shap-chart").getContext("2d");
  if (shapChart) shapChart.destroy();

  const labels = factors.map(f => f.condition);
  const weights = factors.map(f => f.weight);
  const bgColors = weights.map(v => v >= 0 ? "#fb7185" : "#2dd4bf");

  shapChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "LIME Weight",
        data: weights,
        backgroundColor: bgColors,
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#94a3b8" }, grid: { color: "#21324d" } },
        y: { ticks: { color: "#f1f5f9", font: { size: 10 } }, grid: { display: false } },
      },
    },
  });
}

// ---------------------------------------------------------------
// UTILITY PLANNING VIEW
// ---------------------------------------------------------------
function renderUtilityView(fc, hist, rec) {
  const textElem = document.getElementById("utility-overview-text");
  if (textElem) {
    textElem.textContent = `State: ${fc.state.replace(/_/g, " ")} | 1-Day Forecast: ${fc.predicted_mu} MU | Last Actual: ${fc.last_actual_mu} MU. Verified Model: ${fc.model_used}.`;
  }

  const weatherElem = document.getElementById("utility-weather-info");
  if (weatherElem) {
    weatherElem.innerHTML = `
      <div><strong>Current Temperature:</strong> ${rec.temperature_c}°C</div>
      <div><strong>Demand Severity Level:</strong> <span class="banner-tag ${rec.severity}">${rec.severity}</span></div>
    `;
  }

  const drElem = document.getElementById("utility-dr-recommendation");
  if (drElem) {
    drElem.textContent = rec.action;
  }

  // Render Utility Weather & Demand Profile Chart
  const ctx = document.getElementById("utility-weather-chart").getContext("2d");
  if (utilityWeatherChart) utilityWeatherChart.destroy();

  utilityWeatherChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: hist.dates,
      datasets: [
        {
          label: "Energy Demand (MU)",
          data: hist.consumption_mu,
          borderColor: "#38bdf8",
          yAxisID: "y",
          tension: 0.2,
        },
        {
          label: "Temperature (°C)",
          data: hist.temperature_c,
          borderColor: "#fb1185",
          borderDash: [4, 4],
          yAxisID: "y1",
          tension: 0.2,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { position: "left", title: { display: true, text: "Energy (MU)", color: "#38bdf8" }, ticks: { color: "#94a3b8" } },
        y1: { position: "right", title: { display: true, text: "Temperature (°C)", color: "#fb1185" }, ticks: { color: "#94a3b8" }, grid: { display: false } }
      }
    }
  });
}

// ---------------------------------------------------------------
// ADMIN DASHBOARD & MONITORING LOGS
// ---------------------------------------------------------------
async function loadAdminData() {
  try {
    const data = await apiFetch("/best_models");
    const body = document.getElementById("admin-best-models-body");
    if (!body) return;

    if (!data.data || data.data.length === 0) {
      body.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No trained models logged. Run 03_train_models_india.py.</td></tr>';
      return;
    }

    body.innerHTML = "";
    data.data.forEach(row => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${row.node.replace(/_/g, " ")}</strong></td>
        <td>${row.horizon}</td>
        <td><span class="user-role-pill">${row.model}</span></td>
        <td>${row.MAE.toFixed(3)}</td>
        <td>${row.RMSE.toFixed(3)}</td>
        <td>${row.MAPE_%.toFixed(2)}%</td>
        <td>${row.R2 ? row.R2.toFixed(3) : "—"}</td>
      `;
      body.appendChild(tr);
    });
  } catch (err) {
    console.error("Failed to load admin models data:", err);
  }
}

async function loadMonitoringData() {
  try {
    const data = await apiFetch("/monitoring");
    const body = document.getElementById("monitoring-table-body");
    if (!body) return;

    if (!data.log || data.log.length === 0) {
      body.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No monitoring logs recorded yet.</td></tr>';
      return;
    }

    body.innerHTML = "";
    data.log.reverse().forEach(row => {
      const tr = document.createElement("tr");
      const isDrift = row.drift_flagged;
      tr.innerHTML = `
        <td>${row.checked_at || "—"}</td>
        <td>${row.window_start || "—"}</td>
        <td>${row.window_end || "—"}</td>
        <td>${row.window_MAE}</td>
        <td>${row.baseline_MAE}</td>
        <td><span class="banner-tag ${isDrift ? 'HIGH' : 'NORMAL'}">${isDrift ? 'DRIFT DETECTED & RETRAINED' : 'OK (STABLE)'}</span></td>
      `;
      body.appendChild(tr);
    });
  } catch (err) {
    console.error("Failed to load monitoring data:", err);
  }
}
