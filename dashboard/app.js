/**
 * ============================================================================
 * SMART GRID ENERGY CONSUMPTION FORECASTING — FRONTEND APPLICATION
 * Vanilla JavaScript (ES6+), zero build step, Chart.js 4.x integration.
 * Adheres strictly to the FastAPI backend contract in app.py.
 * ============================================================================
 */

// ============================================================================
// 1. CONFIGURATION & CONSTANTS
// ============================================================================

/** Backend API Base URL — defaults to port 8000 when served on port 5500, or current origin in production */
const API_BASE_URL = window.location.port === "5500"
  ? "http://localhost:8000"
  : (window.location.origin && window.location.origin.startsWith("http") ? window.location.origin : "http://localhost:8000");

/** Standard Indian States and Union Territories fallback list */
const FALLBACK_INDIAN_STATES = [
  "Andhra_Pradesh", "Arunachal_Pradesh", "Assam", "Bihar", "Chandigarh",
  "Chhattisgarh", "DNH", "Delhi", "Goa", "Gujarat", "HP", "Haryana",
  "JandK", "Jharkhand", "Karnataka", "Kerala", "MP", "Maharashtra",
  "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Pondy",
  "Punjab", "Rajasthan", "Sikkim", "Tamil_Nadu", "Telangana", "Tripura",
  "UP", "Uttarakhand", "West_Bengal"
];

/** Z-scores for standard confidence intervals */
const Z_SCORES = {
  "0.80": 1.28,
  "0.90": 1.645,
  "0.95": 1.96
};

/** Human-readable translations for feature names in SHAP explanations */
const FEATURE_LABEL_MAP = {
  "lag_1": "Prior Day Demand (lag 1)",
  "lag_2": "2-Day Prior Demand (lag 2)",
  "lag_3": "3-Day Prior Demand (lag 3)",
  "lag_7": "Prior Week Demand (lag 7)",
  "lag_14": "2-Week Prior Demand (lag 14)",
  "roll_7_mean": "7-Day Rolling Average",
  "roll_7_std": "7-Day Rolling Std Dev",
  "roll_14_mean": "14-Day Rolling Average",
  "temperature_c": "Temperature (°C)",
  "humidity": "Relative Humidity (%)",
  "is_holiday": "National/State Holiday",
  "is_weekend": "Weekend Indicator",
  "dow_sin": "Day of Week (Sine)",
  "dow_cos": "Day of Week (Cosine)",
  "month_sin": "Seasonal Month (Sine)",
  "month_cos": "Seasonal Month (Cosine)",
  "doy_sin": "Day of Year (Sine)",
  "doy_cos": "Day of Year (Cosine)"
};

// ============================================================================
// 2. APPLICATION STATE
// ============================================================================

const appState = {
  token: null,
  user: null,
  role: null,
  selectedState: "Maharashtra",
  selectedHorizon: "1d",
  confidenceLevel: "0.95",
  showConfidenceBand: true,
  theme: "dark",
  abortController: null,

  // Cached API payloads
  history: null,
  forecast: null,
  recommendation: null,
  explanation: null,
  monitoring: null,

  // Chart instances
  forecastChart: null,
  shapChart: null
};

// ============================================================================
// 3. UTILITY FUNCTIONS (Escaping, Formatting, Localization)
// ============================================================================

/**
 * Escapes backend strings to prevent XSS vulnerabilities when inserting into DOM.
 * @param {string|number|null|undefined} str
 * @returns {string} Safe HTML-escaped string
 */
function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Formats a numeric value using the Indian numbering system (en-IN).
 * Example: 123456.78 -> "1,23,456.78"
 * @param {number|string} val
 * @param {number} decimals
 * @returns {string} Formatted number string
 */
function formatNumberIN(val, decimals = 2) {
  const num = Number(val);
  if (isNaN(num)) return "—";
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Formats a state name from snake_case to Title Case with spaces.
 * Example: "Arunachal_Pradesh" -> "Arunachal Pradesh"
 * @param {string} stateName
 * @returns {string}
 */
function formatStateName(stateName) {
  if (!stateName) return "";
  return stateName.replace(/_/g, " ");
}

/**
 * Formats timestamps or dates with Indian Standard Time (IST) context.
 * @param {string|Date} dateInput
 * @returns {string}
 */
function formatISTDate(dateInput) {
  if (!dateInput) return "—";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric"
    }) + " (IST)";
  } catch (e) {
    return String(dateInput);
  }
}

/**
 * Live clock updater for header IST badge
 */
function updateISTClock() {
  const badge = document.getElementById("ist-time-badge");
  if (!badge) return;
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  badge.textContent = `IST ${timeStr}`;
}

// ============================================================================
// 4. API CLIENT & AUTHENTICATED FETCH
// ============================================================================

/**
 * Custom fetch wrapper with Authorization Bearer header, AbortSignal, and 401 handling.
 * @param {string} endpoint - Path relative to API_BASE_URL (e.g. "/states")
 * @param {RequestInit} [options={}]
 * @returns {Promise<any>}
 */
async function authFetch(endpoint, options = {}) {
  const headers = new Headers(options.headers || {});

  if (appState.token) {
    headers.set("Authorization", `Bearer ${appState.token}`);
  }

  const signal = options.signal || (appState.abortController ? appState.abortController.signal : undefined);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal
    });
  } catch (err) {
    if (err.name === "AbortError") {
      // Intentionally aborted due to state/horizon change; silently ignore
      throw err;
    }
    console.error(`Network fetch failed for ${endpoint}:`, err);
    throw new Error(`Failed to communicate with backend server at ${API_BASE_URL}. Ensure app.py is running.`);
  }

  // Handle Unauthorized / Token Expiry
  if (response.status === 401) {
    handleSessionExpired();
    throw new Error("Session expired or invalid credentials. Please log in again.");
  }

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson && errJson.detail) {
        errorDetail = errJson.detail;
      }
    } catch (_) {
      // Non-JSON error response
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

/**
 * Handles session expiry or 401 status by cleaning storage and redirecting to login.
 */
function handleSessionExpired() {
  appState.token = null;
  appState.user = null;
  appState.role = null;
  sessionStorage.removeItem("grid_token");
  sessionStorage.removeItem("grid_user");
  sessionStorage.removeItem("grid_role");

  const loginView = document.getElementById("login-view");
  const dashboardView = document.getElementById("dashboard-view");
  if (loginView && dashboardView) {
    dashboardView.style.display = "none";
    loginView.style.display = "flex";
  }

  showLoginError("Your session has expired. Please sign in again.");
}

// ============================================================================
// 5. STAGE 1: AUTHENTICATION (LOGIN & LOGOUT)
// ============================================================================

/**
 * Authenticates user credentials against the POST /login endpoint.
 * @param {Event} e
 */
async function handleLoginSubmit(e) {
  e.preventDefault();
  const usernameInput = document.getElementById("username-input");
  const passwordInput = document.getElementById("password-input");
  const errorAlert = document.getElementById("login-error-alert");
  const loginBtn = document.getElementById("login-btn");
  const btnText = document.getElementById("login-btn-text");
  const spinner = document.getElementById("login-spinner");

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    showLoginError("Please enter both username and password.");
    return;
  }

  // Set loading UI
  errorAlert.style.display = "none";
  loginBtn.disabled = true;
  btnText.textContent = "Verifying…";
  spinner.style.display = "inline-block";

  try {
    const res = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) {
      let msg = "Invalid username or password.";
      try {
        const errData = await res.json();
        if (errData && errData.detail) msg = errData.detail;
      } catch (_) {}
      throw new Error(msg);
    }

    const data = await res.json();
    // Successfully authenticated: store in memory and sessionStorage
    appState.token = data.access_token;
    appState.user = data.username;
    appState.role = data.role;

    sessionStorage.setItem("grid_token", data.access_token);
    sessionStorage.setItem("grid_user", data.username);
    sessionStorage.setItem("grid_role", data.role);

    // Switch view to dashboard
    transitionToDashboard();
  } catch (err) {
    showLoginError(err.message || "Failed to sign in. Verify backend status.");
  } finally {
    loginBtn.disabled = false;
    btnText.textContent = "Sign In to Dashboard";
    spinner.style.display = "none";
  }
}

/**
 * Displays an inline error message on the login card.
 * @param {string} message
 */
function showLoginError(message) {
  const alertEl = document.getElementById("login-error-alert");
  if (alertEl) {
    alertEl.textContent = message;
    alertEl.style.display = "block";
  }
}

/**
 * Transitions the view from login to main dashboard.
 */
async function transitionToDashboard() {
  const loginView = document.getElementById("login-view");
  const dashboardView = document.getElementById("dashboard-view");
  loginView.style.display = "none";
  dashboardView.style.display = "block";

  // Update User Header Info
  const userDisplay = document.getElementById("user-name-display");
  const roleDisplay = document.getElementById("user-role-pill");
  if (userDisplay) userDisplay.textContent = appState.user || "User";
  if (roleDisplay) roleDisplay.textContent = appState.role || "Operator";

  // Populate States and Load initial dataset
  await populateStateDropdown();
  await loadDashboardData();
}

/**
 * Logs the current user out and returns to login screen.
 */
function handleLogout() {
  if (appState.abortController) {
    appState.abortController.abort();
  }

  appState.token = null;
  appState.user = null;
  appState.role = null;
  sessionStorage.removeItem("grid_token");
  sessionStorage.removeItem("grid_user");
  sessionStorage.removeItem("grid_role");

  // Destroy charts
  if (appState.forecastChart) {
    appState.forecastChart.destroy();
    appState.forecastChart = null;
  }
  if (appState.shapChart) {
    appState.shapChart.destroy();
    appState.shapChart = null;
  }

  const loginView = document.getElementById("login-view");
  const dashboardView = document.getElementById("dashboard-view");
  dashboardView.style.display = "none";
  loginView.style.display = "flex";

  const passwordInput = document.getElementById("password-input");
  if (passwordInput) passwordInput.value = "";
  showLoginError("");
  const alertEl = document.getElementById("login-error-alert");
  if (alertEl) alertEl.style.display = "none";
}

// ============================================================================
// 6. STAGE 2: STATE SELECTION & CONTROLS
// ============================================================================

/**
 * Populates the state select element dynamically from GET /states.
 * Falls back to constant list of Indian states if endpoint is unavailable.
 */
async function populateStateDropdown() {
  const selectEl = document.getElementById("state-select");
  if (!selectEl) return;

  let stateList = [];
  try {
    const data = await authFetch("/states");
    if (data && Array.isArray(data.states) && data.states.length > 0) {
      stateList = data.states;
    } else {
      stateList = FALLBACK_INDIAN_STATES;
    }
  } catch (err) {
    console.warn("Could not retrieve states from /states, using fallback Indian states:", err);
    stateList = FALLBACK_INDIAN_STATES;
  }

  selectEl.innerHTML = "";

  // Retrieve last remembered selection from localStorage, fallback to "Maharashtra"
  const savedState = localStorage.getItem("grid_last_state") || "Maharashtra";
  let stateToSelect = stateList.includes(savedState) ? savedState : stateList[0];

  stateList.forEach(stateKey => {
    const option = document.createElement("option");
    option.value = stateKey;
    option.textContent = formatStateName(stateKey);
    if (stateKey === stateToSelect) {
      option.selected = true;
    }
    selectEl.appendChild(option);
  });

  appState.selectedState = stateToSelect;
  localStorage.setItem("grid_last_state", stateToSelect);
}

// ============================================================================
// 7. DATA LOADING & ORCHESTRATION (With AbortController for Race Conditions)
// ============================================================================

/**
 * Main coordinator function to fetch and render all dashboard sections concurrently.
 * Aborts any previous pending requests to avoid race conditions.
 */
async function loadDashboardData() {
  // Cancel any stale inflight requests
  if (appState.abortController) {
    appState.abortController.abort();
  }
  appState.abortController = new AbortController();

  const stateKey = appState.selectedState;
  const horizonKey = appState.selectedHorizon;

  // Toggle Skeletons
  setLoadingState(true);
  hideGlobalError();

  try {
    // Concurrently fetch all independent backend endpoints
    const [forecastRes, historyRes, recommendRes, explainRes, monitoringRes] = await Promise.allSettled([
      authFetch(`/forecast/${encodeURIComponent(stateKey)}?horizon=${encodeURIComponent(horizonKey)}`),
      authFetch(`/history/${encodeURIComponent(stateKey)}?days=60`),
      authFetch(`/recommend/${encodeURIComponent(stateKey)}?horizon=${encodeURIComponent(horizonKey)}`),
      authFetch(`/explain/${encodeURIComponent(stateKey)}?horizon=${encodeURIComponent(horizonKey)}`),
      authFetch("/monitoring")
    ]);

    // Handle Forecast Data
    if (forecastRes.status === "fulfilled") {
      appState.forecast = forecastRes.value;
      renderKPIForecast(forecastRes.value);
    } else {
      console.error("Forecast load error:", forecastRes.reason);
      renderKPIForecastError(forecastRes.reason.message);
    }

    // Handle Recommendation Data
    if (recommendRes.status === "fulfilled") {
      appState.recommendation = recommendRes.value;
      renderRecommendationBanner(recommendRes.value);
    } else {
      console.error("Recommendation load error:", recommendRes.reason);
      renderRecommendationError(recommendRes.reason.message);
    }

    // Handle Monitoring Data (needed also for baseline MAE KPI and CI sigma refinement)
    let monitoringLog = [];
    if (monitoringRes.status === "fulfilled") {
      appState.monitoring = monitoringRes.value;
      monitoringLog = monitoringRes.value.log || [];
      renderMonitoringTable(monitoringLog);
      renderKPIMAE(monitoringLog);
    } else {
      console.warn("Monitoring log load warning:", monitoringRes.reason);
      renderMonitoringTable([]);
      renderKPIMAE([]);
    }

    // Handle History & Forecast Chart
    if (historyRes.status === "fulfilled" && forecastRes.status === "fulfilled") {
      appState.history = historyRes.value;
      renderForecastChart(historyRes.value, forecastRes.value, monitoringLog);
    } else {
      const err = historyRes.reason || forecastRes.reason;
      renderChartError("forecast-chart-container", err ? err.message : "Failed to load historical consumption series.");
    }

    // Handle SHAP Explanations
    if (explainRes.status === "fulfilled") {
      appState.explanation = explainRes.value;
      renderShapChart(explainRes.value);
    } else {
      console.error("SHAP explain load error:", explainRes.reason);
      renderChartError("shap-chart-container", explainRes.reason ? explainRes.reason.message : "Feature explanation unavailable for this state/model.");
    }

  } catch (err) {
    if (err.name === "AbortError") {
      // Ignored: new selection was initiated
      return;
    }
    console.error("Global dashboard load error:", err);
    showGlobalError(err.message || "Failed to load dashboard data. Please check server connection.");
  } finally {
    setLoadingState(false);
  }
}

/**
 * Toggles skeleton UI placeholders while data fetches.
 * @param {boolean} isLoading
 */
function setLoadingState(isLoading) {
  const forecastSkeleton = document.getElementById("forecast-chart-skeleton");
  const shapSkeleton = document.getElementById("shap-chart-skeleton");
  const forecastCanvas = document.getElementById("forecast-chart");
  const shapCanvas = document.getElementById("shap-chart");

  if (forecastSkeleton && forecastCanvas) {
    forecastSkeleton.style.display = isLoading ? "block" : "none";
    forecastCanvas.style.display = isLoading ? "none" : "block";
  }

  if (shapSkeleton && shapCanvas) {
    shapSkeleton.style.display = isLoading ? "block" : "none";
    shapCanvas.style.display = isLoading ? "none" : "block";
  }
}

function showGlobalError(message) {
  const banner = document.getElementById("global-error-banner");
  const text = document.getElementById("global-error-text");
  if (banner && text) {
    text.textContent = escapeHTML(message);
    banner.style.display = "block";
  }
}

function hideGlobalError() {
  const banner = document.getElementById("global-error-banner");
  if (banner) banner.style.display = "none";
}

function renderChartError(containerId, message) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `
    <div class="state-message-box error">
      <div class="state-icon">⚠️</div>
      <div class="state-title">Visualization Error</div>
      <p class="state-desc">${escapeHTML(message)}</p>
      <button class="btn-outline btn-small" onclick="loadDashboardData()">Retry</button>
    </div>
  `;
}

// ============================================================================
// 8. STAGE 3: FORECAST CHART & CONFIDENCE INTERVALS
// ============================================================================

/**
 * Computes the residual standard deviation (sigma) from historical consumption.
 * Method: Calculates sample standard deviation of 1-step differences (delta y_t = y_t - y_{t-1}).
 * Blends with monitoring MAE if available (sigma ≈ 1.2533 * MAE for normal residuals).
 *
 * @param {number[]} consumptionHistory - Array of consumption_mu values
 * @param {object[]} [monitoringLog=[]] - Log entries from /monitoring
 * @returns {number} Estimated sigma in MU
 */
function computeResidualSigma(consumptionHistory, monitoringLog = []) {
  if (!consumptionHistory || consumptionHistory.length < 2) {
    return 10.0; // Fallback baseline if insufficient history
  }

  // 1. Calculate successive first-differences: d_i = y_i - y_{i-1}
  const diffs = [];
  for (let i = 1; i < consumptionHistory.length; i++) {
    const diff = consumptionHistory[i] - consumptionHistory[i - 1];
    if (!isNaN(diff)) {
      diffs.push(diff);
    }
  }

  if (diffs.length === 0) return 10.0;

  // Mean difference
  const meanDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;

  // Sample variance and standard deviation
  const variance = diffs.reduce((acc, d) => acc + Math.pow(d - meanDiff, 2), 0) / (diffs.length - 1);
  let sigma = Math.sqrt(variance);

  // 2. Cross-reference with monitoring MAE if present
  if (monitoringLog && monitoringLog.length > 0) {
    const latestLog = monitoringLog[monitoringLog.length - 1];
    const mae = Number(latestLog.window_MAE) || Number(latestLog.baseline_MAE);
    if (mae && !isNaN(mae) && mae > 0) {
      // Normal distribution relationship: sigma ≈ MAE * sqrt(pi / 2) ≈ 1.2533 * MAE
      const maeSigma = mae * 1.2533;
      // Average both signals for robust stability
      sigma = (sigma + maeSigma) / 2;
    }
  }

  // Return bounded positive value
  return Math.max(0.5, sigma);
}

/**
 * Renders or updates the main line chart showing historical actuals, forecast,
 * and the confidence interval band.
 *
 * @param {object} historyData - Response from /history/{state}
 * @param {object} forecastData - Response from /forecast/{state}
 * @param {object[]} monitoringLog - Records from /monitoring
 */
function renderForecastChart(historyData, forecastData, monitoringLog) {
  const container = document.getElementById("forecast-chart-container");
  if (!container) return;

  // Ensure canvas exists
  let canvas = document.getElementById("forecast-chart");
  if (!canvas) {
    container.innerHTML = '<canvas id="forecast-chart" aria-label="Historical load versus forecast line chart" role="img"></canvas>';
    canvas = document.getElementById("forecast-chart");
  }

  const ctx = canvas.getContext("2d");

  // Destroy previous instance
  if (appState.forecastChart) {
    appState.forecastChart.destroy();
    appState.forecastChart = null;
  }

  const histDates = historyData.dates || [];
  const histValues = historyData.consumption_mu || [];
  const predValue = Number(forecastData.predicted_mu);
  const horizon = forecastData.horizon || appState.selectedHorizon;

  // Compute horizon step count (h = 1 for 1d, h = 7 for 7d)
  const hSteps = horizon === "7d" ? 7 : 1;

  // Determine forecast target date
  let lastDateStr = histDates.length > 0 ? histDates[histDates.length - 1] : forecastData.as_of;
  const lastDate = new Date(lastDateStr);
  const forecastDate = new Date(lastDate);
  forecastDate.setDate(forecastDate.getDate() + hSteps);
  const forecastDateStr = forecastDate.toISOString().split("T")[0];

  // Combined X-axis timeline labels
  const allLabels = [...histDates, forecastDateStr];
  const lastIndex = histDates.length - 1;
  const forecastIndex = allLabels.length - 1;

  // 1. Actual Demand Dataset: valid points up to lastIndex, null at forecastIndex
  const actualDatasetValues = [...histValues, null];

  // 2. Forecast Dataset: starts at last historical point and bridges to predicted_mu
  const forecastDatasetValues = new Array(allLabels.length).fill(null);
  if (lastIndex >= 0) {
    forecastDatasetValues[lastIndex] = histValues[lastIndex]; // Anchor point
  }
  forecastDatasetValues[forecastIndex] = predValue;

  // 3. Confidence Interval computation: forecast ± z * sigma * sqrt(h)
  const sigma = computeResidualSigma(histValues, monitoringLog);
  const zScore = Z_SCORES[appState.confidenceLevel] || 1.96;
  const marginOfError = zScore * sigma * Math.sqrt(hSteps);

  const upperVal = Math.round((predValue + marginOfError) * 100) / 100;
  const lowerVal = Math.max(0, Math.round((predValue - marginOfError) * 100) / 100);

  const ciUpperValues = new Array(allLabels.length).fill(null);
  const ciLowerValues = new Array(allLabels.length).fill(null);

  if (lastIndex >= 0) {
    ciUpperValues[lastIndex] = histValues[lastIndex];
    ciLowerValues[lastIndex] = histValues[lastIndex];
  }
  ciUpperValues[forecastIndex] = upperVal;
  ciLowerValues[forecastIndex] = lowerVal;

  // Update caption explaining sigma and calculation
  const captionEl = document.getElementById("ci-methodology-caption");
  if (captionEl) {
    const ciPercent = Math.round(Number(appState.confidenceLevel) * 100);
    captionEl.innerHTML = `
      <strong>${ciPercent}% Confidence Interval:</strong> Forecast (${formatNumberIN(predValue)} MU) ± ${zScore} × σ (${formatNumberIN(sigma, 1)} MU) × √${hSteps} = [${formatNumberIN(lowerVal)} – ${formatNumberIN(upperVal)} MU] <em>(approximate residual dispersion)</em>. Drag to pan, scroll/pinch to zoom.
    `;
  }

  // Theme-aware colors
  const isDark = appState.theme === "dark";
  const actualColor = isDark ? "#38bdf8" : "#0284c7";
  const forecastColor = isDark ? "#f59e0b" : "#d97706";
  const ciBorderColor = isDark ? "rgba(245, 158, 11, 0.4)" : "rgba(217, 119, 6, 0.4)";
  const ciFillColor = isDark ? "rgba(245, 158, 11, 0.14)" : "rgba(217, 119, 6, 0.12)";
  const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)";
  const textColor = isDark ? "#94a3b8" : "#475569";

  // Build Chart.js Datasets
  const datasets = [
    {
      label: "Actual Consumption",
      data: actualDatasetValues,
      borderColor: actualColor,
      backgroundColor: actualColor,
      borderWidth: 2,
      pointRadius: 2,
      pointHoverRadius: 5,
      tension: 0.15,
      fill: false,
      order: 1
    },
    {
      label: `AI Forecast (${horizon.toUpperCase()})`,
      data: forecastDatasetValues,
      borderColor: forecastColor,
      backgroundColor: forecastColor,
      borderWidth: 2.5,
      borderDash: [6, 4],
      pointRadius: (ctx) => (ctx.dataIndex === forecastIndex ? 6 : 2),
      pointHoverRadius: 8,
      tension: 0,
      fill: false,
      order: 2
    },
    // Upper CI dataset
    {
      label: `Upper CI (${Math.round(Number(appState.confidenceLevel) * 100)}%)`,
      data: ciUpperValues,
      borderColor: ciBorderColor,
      borderWidth: 1,
      borderDash: [3, 3],
      pointRadius: 0,
      fill: false,
      hidden: !appState.showConfidenceBand,
      order: 3
    },
    // Lower CI dataset with fill: '-1' targeting Upper CI
    {
      label: `Lower CI (${Math.round(Number(appState.confidenceLevel) * 100)}%)`,
      data: ciLowerValues,
      borderColor: ciBorderColor,
      borderWidth: 1,
      borderDash: [3, 3],
      pointRadius: 0,
      fill: "-1",
      backgroundColor: ciFillColor,
      hidden: !appState.showConfidenceBand,
      order: 4
    }
  ];

  // Configure Chart with Zoom Plugin
  appState.forecastChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: allLabels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: {
            color: textColor,
            font: { family: "Inter", size: 11 },
            boxWidth: 14,
            filter: (item) => {
              // Hide Lower CI legend item to avoid duplicate CI label
              return !item.text.includes("Lower CI");
            }
          }
        },
        tooltip: {
          backgroundColor: isDark ? "rgba(14, 23, 38, 0.95)" : "rgba(255, 255, 255, 0.95)",
          titleColor: isDark ? "#f1f5f9" : "#0f172a",
          bodyColor: isDark ? "#cbd5e1" : "#334155",
          borderColor: isDark ? "#21324d" : "#cbd5e1",
          borderWidth: 1,
          padding: 10,
          titleFont: { family: "Inter", size: 12, weight: "bold" },
          bodyFont: { family: "IBM Plex Mono", size: 11 },
          callbacks: {
            title: (items) => {
              if (!items.length) return "";
              const dateStr = items[0].label;
              return `${formatISTDate(dateStr)}`;
            },
            label: (context) => {
              const val = context.parsed.y;
              if (val === null || val === undefined || isNaN(val)) return null;

              const dsLabel = context.dataset.label || "";
              if (dsLabel.includes("Upper CI")) {
                return `Upper Bound (${Math.round(Number(appState.confidenceLevel) * 100)}%): ${formatNumberIN(val)} MU`;
              }
              if (dsLabel.includes("Lower CI")) {
                return `Lower Bound (${Math.round(Number(appState.confidenceLevel) * 100)}%): ${formatNumberIN(val)} MU`;
              }
              if (dsLabel.includes("Forecast")) {
                return `Projected Demand: ${formatNumberIN(val)} MU`;
              }
              return `Actual Demand: ${formatNumberIN(val)} MU`;
            }
          }
        },
        zoom: {
          pan: {
            enabled: true,
            mode: "x",
            modifierKey: null
          },
          zoom: {
            wheel: {
              enabled: true
            },
            pinch: {
              enabled: true
            },
            mode: "x"
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: textColor,
            maxTicksLimit: 10,
            font: { family: "IBM Plex Mono", size: 10 }
          },
          grid: { color: gridColor }
        },
        y: {
          title: {
            display: true,
            text: "Energy Demand (MU)",
            color: textColor,
            font: { family: "Inter", size: 11, weight: "500" }
          },
          ticks: {
            color: textColor,
            font: { family: "IBM Plex Mono", size: 10 },
            callback: (v) => formatNumberIN(v, 0)
          },
          grid: { color: gridColor }
        }
      }
    }
  });
}

/**
 * Toggles the visibility of upper/lower confidence bands in the forecast chart.
 */
function updateConfidenceBandVisibility() {
  if (!appState.forecastChart) return;
  const show = appState.showConfidenceBand;

  // Upper CI is dataset index 2, Lower CI is dataset index 3
  if (appState.forecastChart.data.datasets.length >= 4) {
    appState.forecastChart.data.datasets[2].hidden = !show;
    appState.forecastChart.data.datasets[3].hidden = !show;
    appState.forecastChart.update();
  }
}

/**
 * Resets pan/zoom on the forecast chart instance.
 */
function resetForecastZoom() {
  if (appState.forecastChart && typeof appState.forecastChart.resetZoom === "function") {
    appState.forecastChart.resetZoom();
  }
}

// ============================================================================
// 9. STAGE 4: SHAP FACTORS & RECOMMENDATION BANNER
// ============================================================================

/**
 * Renders the horizontal bar chart showing top SHAP feature impacts.
 * Colors: Colorblind-safe coral (positive impact, increases load) and teal (negative impact, decreases load).
 *
 * @param {object} explanationData - Response from /explain/{state}
 */
function renderShapChart(explanationData) {
  const container = document.getElementById("shap-chart-container");
  if (!container) return;

  let canvas = document.getElementById("shap-chart");
  if (!canvas) {
    container.innerHTML = '<canvas id="shap-chart" aria-label="SHAP feature contribution horizontal bar chart" role="img"></canvas>';
    canvas = document.getElementById("shap-chart");
  }

  const ctx = canvas.getContext("2d");

  if (appState.shapChart) {
    appState.shapChart.destroy();
    appState.shapChart = null;
  }

  const topFactors = explanationData.top_factors || [];
  if (topFactors.length === 0) {
    container.innerHTML = `
      <div class="state-message-box">
        <div class="state-icon">📊</div>
        <div class="state-title">No SHAP Factors Returned</div>
        <p class="state-desc">No feature importance data was returned by /explain for this node.</p>
      </div>
    `;
    return;
  }

  // Sort factors by magnitude ascending so largest appears at the top of horizontal chart
  const sortedFactors = [...topFactors].sort((a, b) => Math.abs(a.shap_impact) - Math.abs(b.shap_impact));

  const labels = sortedFactors.map(f => {
    const friendlyName = FEATURE_LABEL_MAP[f.feature] || f.feature;
    const valStr = typeof f.value === "number" ? ` = ${formatNumberIN(f.value, 1)}` : "";
    return `${friendlyName}${valStr}`;
  });

  const impacts = sortedFactors.map(f => Number(f.shap_impact));

  // Colorblind-safe palette:
  // Positive contribution (raises demand): Vermilion/Coral
  // Negative contribution (lowers demand): Teal
  const isDark = appState.theme === "dark";
  const posColor = isDark ? "#e11d48" : "#f43f5e";
  const negColor = isDark ? "#0d9488" : "#0f766e";
  const barColors = impacts.map(v => (v >= 0 ? posColor : negColor));
  const textColor = isDark ? "#94a3b8" : "#475569";
  const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)";

  appState.shapChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "SHAP Impact (MU)",
          data: impacts,
          backgroundColor: barColors,
          borderRadius: 4,
          borderSkipped: false
        }
      ]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? "rgba(14, 23, 38, 0.95)" : "rgba(255, 255, 255, 0.95)",
          titleColor: isDark ? "#f1f5f9" : "#0f172a",
          bodyColor: isDark ? "#cbd5e1" : "#334155",
          borderColor: isDark ? "#21324d" : "#cbd5e1",
          borderWidth: 1,
          padding: 8,
          titleFont: { family: "Inter", size: 11, weight: "bold" },
          bodyFont: { family: "IBM Plex Mono", size: 11 },
          callbacks: {
            label: (context) => {
              const val = context.parsed.x;
              const sign = val > 0 ? "+" : "";
              return `Contribution: ${sign}${formatNumberIN(val, 3)} MU`;
            }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "Contribution to Predicted Load (MU)",
            color: textColor,
            font: { family: "Inter", size: 11 }
          },
          ticks: {
            color: textColor,
            font: { family: "IBM Plex Mono", size: 10 }
          },
          grid: { color: gridColor }
        },
        y: {
          ticks: {
            color: textColor,
            font: { family: "Inter", size: 10 }
          },
          grid: { display: false }
        }
      }
    }
  });
}

/**
 * Updates the prominent recommendation banner based on /recommend response.
 * @param {object} recData - { state, predicted_mu, severity, action }
 */
function renderRecommendationBanner(recData) {
  const banner = document.getElementById("recommendation-banner");
  const icon = document.getElementById("banner-icon");
  const tag = document.getElementById("banner-severity-tag");
  const actionText = document.getElementById("banner-action-text");
  const metaInfo = document.getElementById("banner-meta-info");

  if (!banner || !tag || !actionText) return;

  const severity = (recData.severity || "NORMAL").toUpperCase();
  banner.className = `recommendation-banner ${severity}`;

  // Severity-dependent icon and tags
  let iconEmoji = "💡";
  if (severity === "HIGH") {
    iconEmoji = "🚨";
  } else if (severity === "LOW") {
    iconEmoji = "🌿";
  }

  if (icon) icon.textContent = iconEmoji;
  tag.textContent = escapeHTML(severity);
  actionText.textContent = escapeHTML(recData.action || "No action required.");

  if (metaInfo) {
    metaInfo.textContent = `Forecast: ${formatNumberIN(recData.predicted_mu)} MU`;
  }
}

function renderRecommendationError(errMsg) {
  const banner = document.getElementById("recommendation-banner");
  const tag = document.getElementById("banner-severity-tag");
  const actionText = document.getElementById("banner-action-text");

  if (!banner || !tag || !actionText) return;

  banner.className = "recommendation-banner NORMAL";
  tag.textContent = "INFO";
  actionText.textContent = `Unable to fetch automated recommendation: ${escapeHTML(errMsg)}`;
}

// ============================================================================
// 10. COMPACT KPI CARDS & MONITORING TABLE
// ============================================================================

/**
 * Renders the actual and forecast demand KPI cards.
 * @param {object} fc - Response from /forecast/{state}
 */
function renderKPIForecast(fc) {
  const actualVal = document.getElementById("kpi-val-actual");
  const actualSub = document.getElementById("kpi-sub-actual");
  const forecastVal = document.getElementById("kpi-val-forecast");
  const forecastSub = document.getElementById("kpi-sub-forecast");

  if (actualVal) actualVal.textContent = formatNumberIN(fc.last_actual_mu);
  if (actualSub) actualSub.textContent = `Observed: ${formatISTDate(fc.as_of)}`;

  if (forecastVal) forecastVal.textContent = formatNumberIN(fc.predicted_mu);
  if (forecastSub) {
    const hText = fc.horizon === "7d" ? "Medium-Term (7 Days)" : "Short-Term (1 Day)";
    forecastSub.textContent = `Horizon: ${hText}`;
  }
}

function renderKPIForecastError(errorMsg) {
  const actualVal = document.getElementById("kpi-val-actual");
  const forecastVal = document.getElementById("kpi-val-forecast");
  if (actualVal) actualVal.textContent = "—";
  if (forecastVal) forecastVal.textContent = "—";
}

/**
 * Renders the accuracy / MAE KPI card from continuous monitoring logs.
 * @param {object[]} logRecords
 */
function renderKPIMAE(logRecords) {
  const maeVal = document.getElementById("kpi-val-mae");
  const maeSub = document.getElementById("kpi-sub-mae");
  const unitEl = document.getElementById("kpi-unit-mae");

  if (!maeVal || !maeSub) return;

  if (logRecords && logRecords.length > 0) {
    const latest = logRecords[logRecords.length - 1];
    const val = latest.window_MAE || latest.baseline_MAE;
    if (val !== undefined && val !== null) {
      maeVal.textContent = formatNumberIN(val, 2);
      if (unitEl) unitEl.textContent = "MU";
      maeSub.textContent = `Window: ${latest.window_start || "Recent"} → ${latest.window_end || "Latest"}`;
      return;
    }
  }

  // TODO: Backend /forecast endpoint does not currently return in-sample or cross-validation MAE/MAPE.
  // When backend adds metrics to /forecast, update this card to consume fc.mae / fc.mape.
  maeVal.textContent = "N/A";
  if (unitEl) unitEl.textContent = "";
  maeSub.textContent = "Run 07_monitor_retrain_india.py";
}

/**
 * Renders the continuous model monitoring records table.
 * @param {object[]} logRecords - Array from /monitoring log
 */
function renderMonitoringTable(logRecords) {
  const tbody = document.getElementById("monitoring-table-body");
  if (!tbody) return;

  if (!logRecords || logRecords.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">
          No monitoring checks logged yet. Execute <code>07_monitor_retrain_india.py</code> to log drift tests.
        </td>
      </tr>
    `;
    return;
  }

  // Display the last 10 records descending
  const recentRecords = logRecords.slice(-10).reverse();

  tbody.innerHTML = recentRecords.map(r => {
    const driftFlag = Boolean(r.drift_flagged);
    const badgeClass = driftFlag ? "yes" : "no";
    const statusText = driftFlag ? "DRIFT DETECTED" : "STABLE";

    return `
      <tr>
        <td>${escapeHTML(r.window_start || "—")}</td>
        <td>${escapeHTML(r.window_end || "—")}</td>
        <td>${formatNumberIN(r.window_MAE, 3)}</td>
        <td>${formatNumberIN(r.baseline_MAE, 3)}</td>
        <td>
          <span class="badge-drift ${badgeClass}">${statusText}</span>
        </td>
      </tr>
    `;
  }).join("");
}

// ============================================================================
// 11. THEME TOGGLE & INITIALIZATION
// ============================================================================

/**
 * Sets the active theme (dark or light) and updates styles and charts.
 * @param {string} themeName - "dark" | "light"
 */
function setTheme(themeName) {
  appState.theme = themeName;
  document.documentElement.setAttribute("data-theme", themeName);
  localStorage.setItem("grid_theme", themeName);

  const themeIcon = document.getElementById("theme-icon");
  if (themeIcon) {
    themeIcon.textContent = themeName === "dark" ? "☀️" : "🌙";
  }

  // Refresh charts to pick up color palette adjustments
  if (appState.history && appState.forecast) {
    renderForecastChart(appState.history, appState.forecast, appState.monitoring ? appState.monitoring.log : []);
  }
  if (appState.explanation) {
    renderShapChart(appState.explanation);
  }
}

/**
 * Toggles between dark and light themes.
 */
function toggleTheme() {
  const newTheme = appState.theme === "dark" ? "light" : "dark";
  setTheme(newTheme);
}

/**
 * Attaches all event listeners for interactive controls.
 */
function setupEventListeners() {
  // Login Form
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", handleLoginSubmit);
  }

  // Logout Button
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }

  // Theme Toggle Button
  const themeBtn = document.getElementById("theme-toggle-btn");
  if (themeBtn) {
    themeBtn.addEventListener("click", toggleTheme);
  }

  // State Dropdown
  const stateSelect = document.getElementById("state-select");
  if (stateSelect) {
    stateSelect.addEventListener("change", (e) => {
      appState.selectedState = e.target.value;
      localStorage.setItem("grid_last_state", appState.selectedState);
      loadDashboardData();
    });
  }

  // Horizon Dropdown
  const horizonSelect = document.getElementById("horizon-select");
  if (horizonSelect) {
    horizonSelect.addEventListener("change", (e) => {
      appState.selectedHorizon = e.target.value;
      loadDashboardData();
    });
  }

  // Confidence Interval Toggle Checkbox
  const ciToggle = document.getElementById("ci-toggle");
  if (ciToggle) {
    ciToggle.addEventListener("change", (e) => {
      appState.showConfidenceBand = e.target.checked;
      updateConfidenceBandVisibility();
    });
  }

  // Confidence Level Selector Dropdown (80%, 90%, 95%)
  const ciLevelSelect = document.getElementById("ci-level-select");
  if (ciLevelSelect) {
    ciLevelSelect.addEventListener("change", (e) => {
      appState.confidenceLevel = e.target.value;
      if (appState.history && appState.forecast) {
        renderForecastChart(appState.history, appState.forecast, appState.monitoring ? appState.monitoring.log : []);
      }
    });
  }

  // Reset Zoom Button
  const resetZoomBtn = document.getElementById("reset-zoom-btn");
  if (resetZoomBtn) {
    resetZoomBtn.addEventListener("click", resetForecastZoom);
  }

  // Global Retry Button
  const retryBtn = document.getElementById("global-retry-btn");
  if (retryBtn) {
    retryBtn.addEventListener("click", loadDashboardData);
  }

  // Refresh Monitoring Button
  const refreshMonitoringBtn = document.getElementById("refresh-monitoring-btn");
  if (refreshMonitoringBtn) {
    refreshMonitoringBtn.addEventListener("click", async () => {
      try {
        const monData = await authFetch("/monitoring");
        appState.monitoring = monData;
        renderMonitoringTable(monData.log || []);
      } catch (err) {
        console.warn("Failed to refresh monitoring:", err);
      }
    });
  }
}

/**
 * Initializes the application on DOM ready.
 */
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();

  // Restore Theme Preference
  const savedTheme = localStorage.getItem("grid_theme") || "dark";
  setTheme(savedTheme);

  // Start IST live clock
  updateISTClock();
  setInterval(updateISTClock, 1000);

  // Check for existing session in sessionStorage
  const storedToken = sessionStorage.getItem("grid_token");
  const storedUser = sessionStorage.getItem("grid_user");
  const storedRole = sessionStorage.getItem("grid_role");

  if (storedToken) {
    appState.token = storedToken;
    appState.user = storedUser || "Operator";
    appState.role = storedRole || "Grid Operator";
    transitionToDashboard().catch((err) => {
      console.warn("Auto-login token validation failed:", err);
      handleSessionExpired();
    });
  }
});
