/**
 * THE GRID: GRID OPERATOR DASHBOARD
 * operator.js — "Live Operations & Decision Support"
 */

import { api, runWithConcurrency } from "../api.js";
import { store, Z_SCORES } from "../store.js";
import { getCurrentUser, clearSession } from "../auth.js";
import {
  escapeHTML,
  formatMU,
  formatPct,
  formatTemp,
  formatDate,
  toggleTheme,
  getTheme,
  showToast,
  renderCardSkeleton,
} from "../ui.js";
import { formatStateName, getStateCode } from "../labels.js";
import {
  renderForecastChart,
  renderSHAPChart,
  renderCompareChart,
  destroyChart,
  resetChartZoom,
} from "../charts.js";

// Layout for the Indian States 8x8 Tile-Grid Cartogram
const CARTOGRAM_LAYOUT = [
  // Row 1
  [null, null, "JandK", null, null, null, null, null],
  // Row 2
  [null, "Punjab", "HP", "Uttarakhand", null, null, null, "Arunachal_Pradesh"],
  // Row 3
  [null, "Chandigarh", "Haryana", "Delhi", null, "Sikkim", "Assam", "Nagaland"],
  // Row 4
  [null, "Rajasthan", null, "UP", "Bihar", null, "Meghalaya", "Manipur"],
  // Row 5
  ["Gujarat", null, "MP", "Chhattisgarh", "Jharkhand", "West_Bengal", "Tripura", "Mizoram"],
  // Row 6
  ["DNH", "Maharashtra", "Telangana", null, "Odisha", null, null, null],
  // Row 7
  ["Goa", "Karnataka", null, "Andhra_Pradesh", null, null, null, null],
  // Row 8
  [null, "Kerala", "Tamil_Nadu", "Pondy", null, null, null, null],
];

export async function renderOperatorApp(container, subview = "default") {
  const user = getCurrentUser();
  const theme = getTheme();
  let currentState = store.get("currentState") || "Maharashtra";
  let currentHorizon = store.get("currentHorizon") || "1d";
  let historyDays = store.get("historyDays") || 60;
  let ciEnabled = store.get("ciEnabled");
  let ciLevel = store.get("ciLevel") || "0.95";

  container.innerHTML = `
    <div class="dashboard-shell theme-operator animate-fade-in" data-role="Grid Operator">
      
      <!-- Sticky Topbar -->
      <header class="dashboard-topbar">
        <div class="topbar-brand">
          <div class="brand-glyph" style="background: var(--operator-accent);">⚡</div>
          <div>
            <div class="brand-text">THE GRID</div>
            <div class="brand-subtext">Live Operations & Dispatch</div>
          </div>
        </div>

        <div class="topbar-controls">
          <!-- State Selector -->
          <div class="flex items-center gap-2">
            <label for="op-state-select" class="form-label sr-only">State</label>
            <select id="op-state-select" class="select" style="min-width: 170px;" aria-label="Select Grid Node State">
              <option value="${escapeHTML(currentState)}">${escapeHTML(formatStateName(currentState))}</option>
            </select>
          </div>

          <!-- Horizon Toggle -->
          <div class="pill-group" role="radiogroup" aria-label="Forecast Horizon">
            <button type="button" class="pill-btn ${currentHorizon === "1d" ? "active" : ""}" data-horizon="1d">1-Day</button>
            <button type="button" class="pill-btn ${currentHorizon === "7d" ? "active" : ""}" data-horizon="7d">7-Day</button>
          </div>

          <!-- Theme Toggle -->
          <button id="op-theme-toggle" class="btn-icon" aria-label="Toggle Theme">
            ${theme === "dark" ? "☀️" : "🌙"}
          </button>

          <!-- User Profile Chip -->
          <div class="user-profile-chip">
            <div class="user-avatar">⚡</div>
            <span>${escapeHTML(user ? user.name : "Grid Operator")}</span>
          </div>

          <button id="op-logout-btn" class="btn btn-secondary btn-sm" aria-label="Log Out">Sign Out</button>
        </div>
      </header>

      <!-- Sub Navigation -->
      <nav class="dashboard-subnav" aria-label="Operations Navigation">
        <div class="subnav-tabs">
          <a href="#/operator/app" class="subnav-link ${subview === "default" || subview === "operations" ? "active" : ""}">
            Live Operations & Forecast
          </a>
          <a href="#/operator/app/map" class="subnav-link ${subview === "map" ? "active" : ""}">
            India Stress Cartogram
          </a>
          <a href="#/operator/app/alerts" class="subnav-link ${subview === "alerts" ? "active" : ""}">
            National Alert Feed
          </a>
          <a href="#/operator/app/compare" class="subnav-link ${subview === "compare" ? "active" : ""}">
            Multi-Node Overlay
          </a>
        </div>
        <div class="flex items-center gap-2">
          <span class="badge badge-normal">
            <span class="badge-dot"></span> Telemetry Active
          </span>
        </div>
      </nav>

      <!-- Main Operational Workspace -->
      <main class="main-container" id="op-view-content">
        <!-- Rendered dynamically according to subview -->
      </main>

    </div>
  `;

  // Attach Topbar Listeners
  const themeBtn = container.querySelector("#op-theme-toggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const next = toggleTheme();
      themeBtn.textContent = next === "dark" ? "☀️" : "🌙";
    });
  }

  const logoutBtn = container.querySelector("#op-logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearSession();
      window.location.hash = "#/";
    });
  }

  const stateSelect = container.querySelector("#op-state-select");
  const horizonBtns = container.querySelectorAll(".pill-btn[data-horizon]");

  horizonBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      horizonBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentHorizon = btn.dataset.horizon;
      store.set("currentHorizon", currentHorizon);
      loadCurrentStateData();
    });
  });

  // Populate States Dropdown
  async function loadStatesList() {
    try {
      const data = await api.getStates();
      if (data && data.states) {
        store.set("states", data.states);
        stateSelect.innerHTML = data.states
          .map((s) => `<option value="${escapeHTML(s)}" ${s === currentState ? "selected" : ""}>${escapeHTML(formatStateName(s))}</option>`)
          .join("");
      }
    } catch (e) {
      console.warn("Failed to load states list:", e);
    }
  }

  loadStatesList();

  stateSelect.addEventListener("change", (e) => {
    currentState = e.target.value;
    store.set("currentState", currentState);
    loadCurrentStateData();
  });

  const contentArea = container.querySelector("#op-view-content");

  // =========================================================================
  // SUBVIEW 1: LIVE OPERATIONS (Default)
  // =========================================================================
  async function renderOperationsSubView() {
    contentArea.innerHTML = `
      <!-- Top Alert Banner Container -->
      <div id="op-alert-banner-container"></div>

      <!-- Quick Metrics Strip -->
      <div class="grid-cols-4" id="op-kpi-strip" style="margin-bottom: var(--space-6);">
        ${renderCardSkeleton(4)}
      </div>

      <!-- Main Forecast Chart & Controls -->
      <div class="card" style="margin-bottom: var(--space-6);">
        <div class="card-header">
          <div>
            <h2 class="card-title">
              <span>Dynamic Demand Forecast:</span>
              <span style="color: var(--operator-accent);">${escapeHTML(formatStateName(currentState))}</span>
            </h2>
            <div class="card-subtitle" id="forecast-asof-caption">Historical baseline and forward prediction</div>
          </div>

          <!-- Controls: Days Range, CI Toggle & Level, Zoom Reset -->
          <div class="flex items-center gap-3 flex-wrap">
            <div class="pill-group" role="radiogroup" aria-label="History Window">
              <button type="button" class="pill-btn ${historyDays === 30 ? "active" : ""}" data-days="30">30d</button>
              <button type="button" class="pill-btn ${historyDays === 60 ? "active" : ""}" data-days="60">60d</button>
              <button type="button" class="pill-btn ${historyDays === 90 ? "active" : ""}" data-days="90">90d</button>
              <button type="button" class="pill-btn ${historyDays === 180 ? "active" : ""}" data-days="180">180d</button>
            </div>

            <!-- CI Toggle & Level -->
            <label class="toggle-wrapper" title="Toggle Approximate Confidence Interval">
              <input type="checkbox" id="op-ci-toggle" class="toggle-input sr-only" ${ciEnabled ? "checked" : ""} />
              <div class="toggle-switch"></div>
              <span style="font-size: var(--text-xs); color: var(--text-secondary);">CI Band</span>
            </label>

            <select id="op-ci-level" class="select btn-sm" aria-label="Select Confidence Level">
              <option value="0.80" ${ciLevel === "0.80" ? "selected" : ""}>80% (z=1.28)</option>
              <option value="0.90" ${ciLevel === "0.90" ? "selected" : ""}>90% (z=1.65)</option>
              <option value="0.95" ${ciLevel === "0.95" ? "selected" : ""}>95% (z=1.96)</option>
            </select>

            <button type="button" id="op-zoom-reset" class="btn btn-secondary btn-sm" title="Reset Zoom">Reset Zoom</button>
          </div>
        </div>

        <!-- Canvas -->
        <div style="position: relative; height: 380px; width: 100%;">
          <canvas id="op-forecast-chart"></canvas>
        </div>

        <!-- Verification note for approximate confidence band -->
        <div style="margin-top: var(--space-3); font-size: 11px; color: var(--text-muted); display: flex; justify-content: space-between;">
          <span>* Approximate interval derived from empirical validation RMSE (assumes roughly normal errors).</span>
          <span id="model-provenance-note"></span>
        </div>
      </div>

      <!-- Two-Column Section: Weather Context Strip + XAI Diagnostics -->
      <div class="grid-cols-2" style="margin-bottom: var(--space-6);">
        
        <!-- Weather & Calendar Context -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Meteorological Context Strip</h3>
            <span class="badge badge-info">Observed POSOCO & Open-Meteo</span>
          </div>
          <div id="op-weather-context" class="flex flex-col gap-3">
            <div class="skeleton skeleton-text"></div>
          </div>
        </div>

        <!-- Model Info & Best Verification Stats -->
        <div class="card" id="op-model-card">
          <div class="card-header">
            <h3 class="card-title">Active AI Model Telemetry</h3>
            <span class="badge badge-normal" id="op-model-badge">Best Verified</span>
          </div>
          <div id="op-model-metrics" class="flex flex-col gap-3">
            <div class="skeleton skeleton-text"></div>
          </div>
        </div>

      </div>

      <!-- "Why this forecast?": SHAP and On-Demand LIME Side-by-Side -->
      <div class="card" style="margin-bottom: var(--space-6);">
        <div class="card-header">
          <div>
            <h3 class="card-title">Why this forecast? (Explainable AI Layer)</h3>
            <div class="card-subtitle">Game-Theoretic SHAP Attributions & Local Linear LIME Conditions</div>
          </div>
          <button id="op-load-lime-btn" class="btn btn-secondary btn-sm">
            <span>Analyze LIME Factors</span>
          </button>
        </div>

        <div class="grid-cols-2">
          <!-- SHAP Bars -->
          <div>
            <h4 style="font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; margin-bottom: var(--space-2);">
              Top 8 SHAP Decision Drivers (Relative Marginal Contribution)
            </h4>
            <div style="position: relative; height: 280px; width: 100%;">
              <canvas id="op-shap-chart"></canvas>
            </div>
          </div>

          <!-- LIME Factors List -->
          <div>
            <h4 style="font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; margin-bottom: var(--space-2);">
              LIME Local Linear Rules & Weights
            </h4>
            <div id="op-lime-container" style="min-height: 280px; display: flex; flex-direction: column; justify-content: center;">
              <div class="empty-state">
                <span class="empty-state-icon">🔍</span>
                <div class="empty-state-title">LIME Analysis Ready</div>
                <p class="empty-state-desc">Click 'Analyze LIME Factors' to compute local surrogate boundary weights (calculated on demand).</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Attach local controls
    const daysBtns = contentArea.querySelectorAll(".pill-btn[data-days]");
    daysBtns.forEach((b) => {
      b.addEventListener("click", () => {
        daysBtns.forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        historyDays = parseInt(b.dataset.days, 10);
        store.set("historyDays", historyDays);
        loadCurrentStateData();
      });
    });

    const ciCheckbox = contentArea.querySelector("#op-ci-toggle");
    if (ciCheckbox) {
      ciCheckbox.addEventListener("change", (e) => {
        ciEnabled = e.target.checked;
        store.set("ciEnabled", ciEnabled);
        loadCurrentStateData();
      });
    }

    const ciSelect = contentArea.querySelector("#op-ci-level");
    if (ciSelect) {
      ciSelect.addEventListener("change", (e) => {
        ciLevel = e.target.value;
        store.set("ciLevel", ciLevel);
        loadCurrentStateData();
      });
    }

    const zoomReset = contentArea.querySelector("#op-zoom-reset");
    if (zoomReset) {
      zoomReset.addEventListener("click", () => {
        resetChartZoom("op-forecast-chart");
      });
    }

    const limeBtn = contentArea.querySelector("#op-load-lime-btn");
    if (limeBtn) {
      limeBtn.addEventListener("click", loadLimeExplanation);
    }

    await loadCurrentStateData();
  }

  // =========================================================================
  // SUBVIEW 2: INDIA STRESS CARTOGRAM
  // =========================================================================
  async function renderMapSubView() {
    contentArea.innerHTML = `
      <div class="card" style="margin-bottom: var(--space-6);">
        <div class="card-header">
          <div>
            <h2 class="card-title">National Smart Grid Stress Cartogram</h2>
            <div class="card-subtitle">Empirical P90 Peak Load & Thermal Stress Classification for 33 States/UTs</div>
          </div>
          <div class="flex items-center gap-3">
            <span id="cartogram-progress-badge" class="badge badge-info">Loading telemetry...</span>
            <div class="flex items-center gap-2">
              <span class="badge badge-high"><span class="badge-dot"></span> HIGH</span>
              <span class="badge badge-normal"><span class="badge-dot"></span> NORMAL</span>
              <span class="badge badge-low"><span class="badge-dot"></span> LOW</span>
            </div>
          </div>
        </div>

        <!-- Progress bar during progressive loading -->
        <div id="cartogram-progress-bar" style="height: 3px; width: 0%; background: var(--operator-accent); transition: width 0.3s; margin-bottom: var(--space-4);"></div>

        <div class="cartogram-container">
          <div class="cartogram-grid" id="cartogram-grid-element">
            <!-- Tiles populated dynamically -->
          </div>
        </div>

        <div style="margin-top: var(--space-4); text-align: center; font-size: var(--text-xs); color: var(--text-muted);">
          Click any state tile to focus and load detailed demand forecasts, weather history, and XAI diagnostics.
        </div>
      </div>
    `;

    await loadCartogramTelemetry();
  }

  // =========================================================================
  // SUBVIEW 3: NATIONAL ALERT FEED
  // =========================================================================
  async function renderAlertsSubView() {
    contentArea.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">National Grid Decision Support & Alert Center</h2>
            <div class="card-subtitle">Chronological, severity-prioritized operational recommendations</div>
          </div>
          <span id="alerts-count-badge" class="badge badge-high">Loading alerts...</span>
        </div>

        <div id="alerts-feed-container" class="flex flex-col gap-4">
          <div class="skeleton skeleton-card"></div>
        </div>
      </div>
    `;

    await loadAlertsFeed();
  }

  // =========================================================================
  // SUBVIEW 4: MULTI-NODE OVERLAY
  // =========================================================================
  async function renderCompareSubView() {
    contentArea.innerHTML = `
      <div class="card" style="margin-bottom: var(--space-6);">
        <div class="card-header">
          <div>
            <h2 class="card-title">Multi-Node Regional Load Comparison</h2>
            <div class="card-subtitle">Overlay historical demand curves of 2 to 4 state electrical grids</div>
          </div>
          <div class="flex items-center gap-3">
            <label class="toggle-wrapper" title="Normalize values by percentage">
              <input type="checkbox" id="compare-norm-toggle" class="toggle-input sr-only" />
              <div class="toggle-switch"></div>
              <span style="font-size: var(--text-xs);">Normalize (Index 100)</span>
            </label>
          </div>
        </div>

        <!-- Node Selector Checkboxes -->
        <div class="flex items-center gap-3 flex-wrap" id="compare-state-pills" style="margin-bottom: var(--space-4);">
          <!-- State check pills -->
        </div>

        <div style="position: relative; height: 420px; width: 100%;">
          <canvas id="op-compare-chart"></canvas>
        </div>
      </div>
    `;

    await setupMultiStateCompare();
  }

  // =========================================================================
  // DATA LOADING LOGIC FOR OPERATOR
  // =========================================================================
  async function loadCurrentStateData() {
    const signal = store.createAbortSignal();

    try {
      // 1. Concurrently fetch Forecast, History, Recommend, and SHAP
      const [forecastRes, historyRes, recommendRes, shapRes] = await Promise.all([
        api.getForecast(currentState, currentHorizon, "best", signal),
        api.getHistory(currentState, historyDays, signal),
        api.getRecommend(currentState, currentHorizon, signal),
        api.getExplainSHAP(currentState, currentHorizon, signal).catch(() => null),
      ]);

      // Cache recommendation in memory
      const overviews = store.get("stateOverviews");
      overviews.set(currentState, { forecast: forecastRes, recommend: recommendRes });

      // Update Alert Banner
      const bannerContainer = document.getElementById("op-alert-banner-container");
      if (bannerContainer && recommendRes) {
        const isCriticalHeat = recommendRes.severity === "HIGH" && recommendRes.temperature_c >= 35;
        let alertClass = "normal";
        let icon = "💡";
        if (recommendRes.severity === "HIGH") {
          alertClass = isCriticalHeat ? "critical" : "high";
          icon = "🚨";
        } else if (recommendRes.severity === "LOW") {
          alertClass = "low";
          icon = "⚙️";
        }

        bannerContainer.innerHTML = `
          <div class="alert-banner ${alertClass}">
            <div class="alert-icon">${icon}</div>
            <div class="alert-content">
              <div class="alert-title">
                ${escapeHTML(recommendRes.severity)} SEVERITY DISPATCH ADVISORY: ${escapeHTML(formatStateName(currentState))}
              </div>
              <div class="alert-desc">${escapeHTML(recommendRes.action)}</div>
            </div>
            <div class="flex flex-col items-end">
              <span class="badge ${alertClass === 'critical' ? 'badge-high' : 'badge-' + alertClass.toLowerCase()}">
                ${escapeHTML(recommendRes.severity)}
              </span>
              <span style="font-size: 11px; margin-top: 4px; color: var(--text-secondary);">
                P90 High: ${formatMU(recommendRes.high_threshold_mu)}
              </span>
            </div>
          </div>
        `;
      }

      // Update KPI Strip
      const kpiStrip = document.getElementById("op-kpi-strip");
      if (kpiStrip && forecastRes) {
        const changePct = forecastRes.last_actual_mu > 0
          ? ((forecastRes.predicted_mu - forecastRes.last_actual_mu) / forecastRes.last_actual_mu) * 100
          : 0;

        kpiStrip.innerHTML = `
          <div class="kpi-card">
            <div class="kpi-label">Forecast Demand (${currentHorizon})</div>
            <div class="kpi-value">${formatNumber(forecastRes.predicted_mu)} <span class="kpi-unit">MU</span></div>
            <div class="kpi-footer">
              <span style="color: ${changePct >= 0 ? 'var(--color-high)' : 'var(--color-normal)'}; font-weight: 600;">
                ${changePct >= 0 ? '▲ +' : '▼ '}${changePct.toFixed(2)}%
              </span>
              <span>vs last actual</span>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-label">Last Recorded Demand</div>
            <div class="kpi-value">${formatNumber(forecastRes.last_actual_mu)} <span class="kpi-unit">MU</span></div>
            <div class="kpi-footer">Recorded: ${formatDate(forecastRes.as_of)}</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-label">Model Test Accuracy (MAPE)</div>
            <div class="kpi-value">${forecastRes.mape_pct !== null ? formatPct(forecastRes.mape_pct) : 'N/A'}</div>
            <div class="kpi-footer">Verified on 20% holdout test set</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-label">Telemetry Ambient Temp</div>
            <div class="kpi-value">${recommendRes ? formatTemp(recommendRes.temperature_c) : '28.0°C'}</div>
            <div class="kpi-footer">Open-Meteo synchronous telemetry</div>
          </div>
        `;
      }

      // Update Forecast Chart
      const asOfCaption = document.getElementById("forecast-asof-caption");
      if (asOfCaption) {
        asOfCaption.textContent = `As of ${formatDate(forecastRes.as_of)} • Horizon: ${currentHorizon === "1d" ? "Next 24 Hours" : "Next 7 Days"}`;
      }

      const zVal = Z_SCORES[ciLevel] || 1.96;
      renderForecastChart("op-forecast-chart", historyRes, forecastRes, {
        ciEnabled,
        ciZ: zVal,
        highThreshold: recommendRes ? recommendRes.high_threshold_mu : null,
        lowThreshold: recommendRes ? recommendRes.low_threshold_mu : null,
      });

      // Update Model Provenance
      const provenanceNote = document.getElementById("model-provenance-note");
      if (provenanceNote) {
        if (forecastRes.is_fallback || (forecastRes.intended_model && forecastRes.model_used !== forecastRes.intended_model)) {
          provenanceNote.textContent = `Served by fallback model (${forecastRes.model_used}); verified optimal model: ${forecastRes.intended_model}`;
        } else {
          provenanceNote.textContent = `Model: ${forecastRes.model_used}`;
        }
      }

      // Update Weather Context Strip
      const weatherBox = document.getElementById("op-weather-context");
      if (weatherBox && historyRes.dates) {
        const lastIndex = historyRes.dates.length - 1;
        const curTemp = historyRes.temperature_c[lastIndex];
        const curHum = historyRes.humidity[lastIndex];
        const isHol = historyRes.is_holiday[lastIndex];

        weatherBox.innerHTML = `
          <div class="flex items-center justify-between" style="padding: 0.5rem 0; border-bottom: 1px solid var(--border-subtle);">
            <span style="color: var(--text-secondary);">Current Ambient Temperature</span>
            <span class="num" style="font-weight: 600;">${curTemp.toFixed(1)} °C</span>
          </div>
          <div class="flex items-center justify-between" style="padding: 0.5rem 0; border-bottom: 1px solid var(--border-subtle);">
            <span style="color: var(--text-secondary);">Relative Air Humidity</span>
            <span class="num" style="font-weight: 600;">${curHum.toFixed(1)} %</span>
          </div>
          <div class="flex items-center justify-between" style="padding: 0.5rem 0; border-bottom: 1px solid var(--border-subtle);">
            <span style="color: var(--text-secondary);">Holiday Calendar Status</span>
            <span class="badge ${isHol ? 'badge-warning' : 'badge-info'}">${isHol ? 'Public Holiday' : 'Regular Working Day'}</span>
          </div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
            Historical weather observations over past ${historyDays} days aligned per POSOCO timestamp.
          </div>
        `;
      }

      // Update Model Metrics Card
      const modelMetrics = document.getElementById("op-model-metrics");
      if (modelMetrics && forecastRes) {
        modelMetrics.innerHTML = `
          <div class="flex items-center justify-between" style="padding: 0.5rem 0; border-bottom: 1px solid var(--border-subtle);">
            <span style="color: var(--text-secondary);">Algorithm Architecture</span>
            <span class="badge badge-normal">${escapeHTML(forecastRes.model_used)}</span>
          </div>
          <div class="flex items-center justify-between" style="padding: 0.5rem 0; border-bottom: 1px solid var(--border-subtle);">
            <span style="color: var(--text-secondary);">Mean Absolute Error (MAE)</span>
            <span class="num">${forecastRes.mae !== null ? formatMU(forecastRes.mae) : 'N/A'}</span>
          </div>
          <div class="flex items-center justify-between" style="padding: 0.5rem 0; border-bottom: 1px solid var(--border-subtle);">
            <span style="color: var(--text-secondary);">Root Mean Squared Error (RMSE)</span>
            <span class="num">${forecastRes.rmse !== null ? formatMU(forecastRes.rmse) : 'N/A'}</span>
          </div>
          <div class="flex items-center justify-between" style="padding: 0.5rem 0; border-bottom: 1px solid var(--border-subtle);">
            <span style="color: var(--text-secondary);">R² Determination Score</span>
            <span class="num">${forecastRes.r2 !== null ? forecastRes.r2.toFixed(4) : 'N/A'}</span>
          </div>
        `;
      }

      // Update SHAP Chart
      if (shapRes && shapRes.top_factors) {
        renderSHAPChart("op-shap-chart", shapRes.top_factors);
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        console.error("Failed to load operational state data:", e);
        showToast("Error loading operational state data: " + e.message, "error");
      }
    }
  }

  // Load LIME On-Demand with Cache
  async function loadLimeExplanation() {
    const limeContainer = document.getElementById("op-lime-container");
    const limeBtn = document.getElementById("op-load-lime-btn");
    if (!limeContainer) return;

    const cacheKey = `${currentState}_${currentHorizon}`;
    const limeCache = store.get("limeCache");

    if (limeCache.has(cacheKey)) {
      renderLimeFactors(limeCache.get(cacheKey));
      return;
    }

    if (limeBtn) {
      limeBtn.disabled = true;
      limeBtn.innerHTML = `<span class="spinner"></span> <span>Perturbing local space...</span>`;
    }

    limeContainer.innerHTML = `
      <div class="empty-state">
        <span class="spinner" style="width: 24px; height: 24px; margin-bottom: 12px;"></span>
        <div class="empty-state-title">Computing LIME Local Surrogates</div>
        <p class="empty-state-desc">Running local tabular perturbations and kernel ridge regressions across feature space. This takes a few seconds...</p>
      </div>
    `;

    try {
      const res = await api.getExplainLIME(currentState, currentHorizon);
      if (res && res.lime_factors) {
        limeCache.set(cacheKey, res.lime_factors);
        renderLimeFactors(res.lime_factors);
      }
    } catch (e) {
      limeContainer.innerHTML = `
        <div class="empty-state">
          <span class="empty-state-icon">⚠️</span>
          <div class="empty-state-title">LIME Generation Failed</div>
          <p class="empty-state-desc">${escapeHTML(e.message)}</p>
        </div>
      `;
    } finally {
      if (limeBtn) {
        limeBtn.disabled = false;
        limeBtn.innerHTML = `<span>Refresh LIME Factors</span>`;
      }
    }
  }

  function renderLimeFactors(factors) {
    const limeContainer = document.getElementById("op-lime-container");
    if (!limeContainer) return;

    limeContainer.innerHTML = `
      <div class="flex flex-col gap-2" style="max-height: 280px; overflow-y: auto;">
        ${factors
          .map((item) => {
            const isPos = item.weight >= 0;
            return `
              <div class="flex items-center justify-between" style="padding: 8px 12px; border-radius: var(--radius-md); background: var(--bg-surface); border: 1px solid var(--border-subtle);">
                <span style="font-family: var(--font-mono); font-size: 11px; color: var(--text-primary);">${escapeHTML(item.condition)}</span>
                <span class="badge ${isPos ? 'badge-high' : 'badge-normal'}" style="font-family: var(--font-mono);">
                  ${isPos ? '+' : ''}${item.weight.toFixed(4)}
                </span>
              </div>
            `;
          })
          .join("")}
      </div>
      <div style="font-size: 11px; color: var(--text-muted); margin-top: 8px;">
        Linear surrogate weights represent local feature decision boundaries for the prediction.
      </div>
    `;
  }

  // Cartogram Progressive Loading
  async function loadCartogramTelemetry() {
    const gridElem = document.getElementById("cartogram-grid-element");
    const progressBadge = document.getElementById("cartogram-progress-badge");
    const progressBar = document.getElementById("cartogram-progress-bar");
    if (!gridElem) return;

    // Try optional /overview endpoint first!
    try {
      const overviewRes = await api.getOverview();
      if (overviewRes && overviewRes.states) {
        const overviews = store.get("stateOverviews");
        overviewRes.states.forEach((s) => {
          overviews.set(s.state, {
            forecast: s.forecast_1d,
            recommend: {
              severity: s.forecast_1d.severity,
              predicted_mu: s.forecast_1d.predicted_mu,
              action: s.forecast_1d.action,
              temperature_c: s.temperature_c,
              high_threshold_mu: s.forecast_1d.high_threshold_mu,
              low_threshold_mu: s.forecast_1d.low_threshold_mu,
            },
          });
        });
        if (progressBadge) progressBadge.textContent = "33 of 33 Nodes Synchronized";
        if (progressBar) progressBar.style.width = "100%";
        renderCartogramTiles(gridElem);
        return;
      }
    } catch (e) {
      // Graceful fallback to per-state calls
    }

    // Fallback: Fetch per state with concurrency limit of 4
    let statesList = store.get("states");
    if (!statesList || statesList.length === 0) {
      const sData = await api.getStates();
      statesList = sData.states;
      store.set("states", statesList);
    }

    const tasks = statesList.map((state) => async () => {
      const [f, r] = await Promise.all([
        api.getForecast(state, "1d").catch(() => null),
        api.getRecommend(state, "1d").catch(() => null),
      ]);
      const overviews = store.get("stateOverviews");
      overviews.set(state, { forecast: f, recommend: r });
      return { state, forecast: f, recommend: r };
    });

    renderCartogramTiles(gridElem); // initial render with pending tiles

    await runWithConcurrency(tasks, 4, (done, total) => {
      if (progressBar) progressBar.style.width = `${(done / total) * 100}%`;
      if (progressBadge) progressBadge.textContent = `${done} of ${total} nodes loaded`;
      renderCartogramTiles(gridElem);
    });

    if (progressBadge) progressBadge.textContent = "All 33 Nodes Active";
  }

  function renderCartogramTiles(gridElem) {
    const overviews = store.get("stateOverviews");
    const allKnown = new Set();

    let html = "";
    CARTOGRAM_LAYOUT.forEach((row) => {
      row.forEach((cell) => {
        if (!cell) {
          html += `<div class="cartogram-tile cartogram-empty"></div>`;
          return;
        }

        allKnown.add(cell);
        const data = overviews.get(cell);
        const severity = data?.recommend?.severity || "NORMAL";
        const val = data?.forecast?.predicted_mu;
        const code = getStateCode(cell);
        const isSelected = cell === currentState;

        html += `
          <div class="cartogram-tile ${severity.toLowerCase()} ${isSelected ? 'selected' : ''}" data-state="${cell}" role="button" tabindex="0" title="${formatStateName(cell)}: ${severity} (${val ? formatMU(val) : 'Loading...'})">
            <span class="tile-code">${code}</span>
            <span class="tile-name">${formatStateName(cell).split(' ')[0]}</span>
            <span class="tile-val">${val ? Math.round(val) + ' MU' : '—'}</span>
          </div>
        `;
      });
    });

    // Check for any states not in the standard cartogram layout
    const statesList = store.get("states") || [];
    const extraStates = statesList.filter((s) => !allKnown.has(s));
    if (extraStates.length > 0) {
      extraStates.forEach((cell) => {
        const data = overviews.get(cell);
        const severity = data?.recommend?.severity || "NORMAL";
        const val = data?.forecast?.predicted_mu;
        const code = getStateCode(cell);
        const isSelected = cell === currentState;

        html += `
          <div class="cartogram-tile ${severity.toLowerCase()} ${isSelected ? 'selected' : ''}" data-state="${cell}" role="button" tabindex="0" title="${formatStateName(cell)}: ${severity}">
            <span class="tile-code">${code}</span>
            <span class="tile-name">${formatStateName(cell)}</span>
            <span class="tile-val">${val ? Math.round(val) + ' MU' : '—'}</span>
          </div>
        `;
      });
    }

    gridElem.innerHTML = html;

    // Attach tile click handlers
    gridElem.querySelectorAll(".cartogram-tile[data-state]").forEach((tile) => {
      const handleSelect = () => {
        const targetState = tile.dataset.state;
        currentState = targetState;
        store.set("currentState", currentState);
        stateSelect.value = currentState;
        window.location.hash = "#/operator/app";
      };

      tile.addEventListener("click", handleSelect);
      tile.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleSelect();
        }
      });
    });
  }

  // National Alert Feed
  async function loadAlertsFeed() {
    const feedContainer = document.getElementById("alerts-feed-container");
    const countBadge = document.getElementById("alerts-count-badge");
    if (!feedContainer) return;

    let statesList = store.get("states");
    if (!statesList || statesList.length === 0) {
      const sData = await api.getStates();
      statesList = sData.states;
      store.set("states", statesList);
    }

    // Ensure all state recommendations are cached
    const overviews = store.get("stateOverviews");
    const missing = statesList.filter((s) => !overviews.has(s));

    if (missing.length > 0) {
      const tasks = missing.map((s) => async () => {
        const r = await api.getRecommend(s, "1d").catch(() => null);
        const f = await api.getForecast(s, "1d").catch(() => null);
        overviews.set(s, { recommend: r, forecast: f });
      });
      await runWithConcurrency(tasks, 4);
    }

    const items = [];
    statesList.forEach((s) => {
      const data = overviews.get(s);
      if (data && data.recommend) {
        items.push({ state: s, ...data.recommend });
      }
    });

    // Sort: HIGH first, then NORMAL, then LOW
    const severityWeight = { HIGH: 3, NORMAL: 2, LOW: 1 };
    items.sort((a, b) => (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0));

    const highCount = items.filter((x) => x.severity === "HIGH").length;
    if (countBadge) countBadge.textContent = `${highCount} High Priority Alerts`;

    feedContainer.innerHTML = items
      .map((item) => {
        const isCritical = item.severity === "HIGH" && item.temperature_c >= 35;
        let alertClass = "normal";
        let icon = "💡";
        if (item.severity === "HIGH") {
          alertClass = isCritical ? "critical" : "high";
          icon = "🚨";
        } else if (item.severity === "LOW") {
          alertClass = "low";
          icon = "⚙️";
        }

        return `
          <div class="alert-banner ${alertClass}" style="margin-bottom: 0;">
            <div class="alert-icon">${icon}</div>
            <div class="alert-content">
              <div class="flex items-center gap-3">
                <span style="font-weight: 700; color: var(--text-primary); font-size: var(--text-md);">
                  ${escapeHTML(formatStateName(item.state))}
                </span>
                <span class="badge ${alertClass === 'critical' ? 'badge-high' : 'badge-' + alertClass.toLowerCase()}">
                  ${escapeHTML(item.severity)}
                </span>
                <span class="badge badge-info">
                  Temp: ${item.temperature_c.toFixed(1)}°C
                </span>
              </div>
              <div class="alert-desc" style="margin-top: 6px;">
                ${escapeHTML(item.action)}
              </div>
            </div>
            <div class="flex flex-col items-end">
              <span class="num" style="font-size: var(--text-md); font-weight: 700; color: var(--text-primary);">
                ${formatMU(item.predicted_mu)}
              </span>
              <button class="btn btn-secondary btn-sm" style="margin-top: 8px;" data-jump="${item.state}">
                Inspect Node →
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    feedContainer.querySelectorAll("button[data-jump]").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentState = btn.dataset.jump;
        store.set("currentState", currentState);
        stateSelect.value = currentState;
        window.location.hash = "#/operator/app";
      });
    });
  }

  // Setup Multi-State Comparative Overlay
  async function setupMultiStateCompare() {
    const pillsContainer = document.getElementById("compare-state-pills");
    const normToggle = document.getElementById("compare-norm-toggle");
    if (!pillsContainer) return;

    let selectedCompare = ["Maharashtra", "Gujarat", "Tamil_Nadu"];
    let isNormalized = false;

    let statesList = store.get("states");
    if (!statesList || statesList.length === 0) {
      const sData = await api.getStates();
      statesList = sData.states;
      store.set("states", statesList);
    }

    function renderPills() {
      pillsContainer.innerHTML = statesList.slice(0, 12).map((s) => {
        const isSel = selectedCompare.includes(s);
        return `
          <button type="button" class="pill-btn ${isSel ? 'active' : ''}" data-state="${s}">
            ${escapeHTML(formatStateName(s))}
          </button>
        `;
      }).join("");

      pillsContainer.querySelectorAll(".pill-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const st = btn.dataset.state;
          if (selectedCompare.includes(st)) {
            if (selectedCompare.length > 1) {
              selectedCompare = selectedCompare.filter((x) => x !== st);
            }
          } else {
            if (selectedCompare.length < 4) {
              selectedCompare.push(st);
            } else {
              showToast("Select up to 4 states for comparison", "warning");
              return;
            }
          }
          renderPills();
          loadCompareData();
        });
      });
    }

    renderPills();

    if (normToggle) {
      normToggle.addEventListener("change", (e) => {
        isNormalized = e.target.checked;
        loadCompareData();
      });
    }

    async function loadCompareData() {
      try {
        const histories = await Promise.all(
          selectedCompare.map((s) => api.getHistory(s, 60))
        );

        if (histories.length > 0 && histories[0].dates) {
          const dates = histories[0].dates;
          const seriesList = histories.map((h) => ({
            label: formatStateName(h.state),
            values: h.consumption_mu,
          }));

          renderCompareChart("op-compare-chart", dates, seriesList, isNormalized);
        }
      } catch (e) {
        console.error("Comparison load failed:", e);
      }
    }

    await loadCompareData();
  }

  // Subview Dispatcher
  if (subview === "map") {
    await renderMapSubView();
  } else if (subview === "alerts") {
    await renderAlertsSubView();
  } else if (subview === "compare") {
    await renderCompareSubView();
  } else {
    await renderOperationsSubView();
  }

  // Cleanup handler
  return () => {
    destroyChart("op-forecast-chart");
    destroyChart("op-shap-chart");
    destroyChart("op-compare-chart");
  };
}
