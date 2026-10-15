/**
 * THE GRID: UTILITY COMPANY DASHBOARD
 * utility.js — "Planning, Demand & Business Insights"
 */

import { api, runWithConcurrency } from "../api.js";
import { store } from "../store.js";
import { getCurrentUser, clearSession } from "../auth.js";
import {
  escapeHTML,
  formatNumber,
  formatMU,
  formatPct,
  formatDate,
  toggleTheme,
  getTheme,
  showToast,
  exportToCSV,
  exportElementToPNG,
  renderCardSkeleton,
  renderTableSkeleton,
} from "../ui.js";
import { formatStateName } from "../labels.js";
import {
  renderUtilityOutlookChart,
  renderSeasonalityChart,
  renderDayTypeChart,
  renderWeatherScatterChart,
  destroyChart,
} from "../charts.js";

export async function renderUtilityApp(container, subview = "default") {
  const user = getCurrentUser();
  const theme = getTheme();
  let currentState = store.get("currentState") || "Maharashtra";
  let currentHorizon = store.get("currentHorizon") || "7d"; // Utility default is 7d
  let portfolioStates = store.get("portfolioStates") || ["Maharashtra", "Gujarat", "Tamil_Nadu", "UP", "Karnataka", "Rajasthan"];

  container.innerHTML = `
    <div class="dashboard-shell theme-utility animate-fade-in" data-role="Utility Company">
      
      <!-- Sticky Topbar -->
      <header class="dashboard-topbar">
        <div class="topbar-brand">
          <div class="brand-glyph" style="background: var(--utility-accent);">📈</div>
          <div>
            <div class="brand-text">THE GRID</div>
            <div class="brand-subtext">Utility Planning & Portfolio</div>
          </div>
        </div>

        <div class="topbar-controls">
          <!-- State Selector -->
          <div class="flex items-center gap-2">
            <label for="ut-state-select" class="form-label sr-only">State</label>
            <select id="ut-state-select" class="select" style="min-width: 170px;" aria-label="Select Focus State">
              <option value="${escapeHTML(currentState)}">${escapeHTML(formatStateName(currentState))}</option>
            </select>
          </div>

          <!-- Horizon Toggle (7d default) -->
          <div class="pill-group" role="radiogroup" aria-label="Planning Horizon">
            <button type="button" class="pill-btn ${currentHorizon === "7d" ? "active" : ""}" data-horizon="7d">7-Day</button>
            <button type="button" class="pill-btn ${currentHorizon === "1d" ? "active" : ""}" data-horizon="1d">1-Day</button>
          </div>

          <!-- Theme Toggle -->
          <button id="ut-theme-toggle" class="btn-icon" aria-label="Toggle Theme">
            ${theme === "dark" ? "☀️" : "🌙"}
          </button>

          <!-- User Profile Chip -->
          <div class="user-profile-chip">
            <div class="user-avatar" style="background: var(--utility-accent);">📊</div>
            <span>${escapeHTML(user ? user.name : "Utility Planner")}</span>
          </div>

          <button id="ut-logout-btn" class="btn btn-secondary btn-sm" aria-label="Log Out">Sign Out</button>
        </div>
      </header>

      <!-- Sub Navigation -->
      <nav class="dashboard-subnav" aria-label="Utility Navigation">
        <div class="subnav-tabs">
          <a href="#/utility/app" class="subnav-link ${subview === "default" || subview === "insights" ? "active" : ""}">
            Planning Outlook & KPIs
          </a>
          <a href="#/utility/app/patterns" class="subnav-link ${subview === "patterns" ? "active" : ""}">
            Historical Demand Patterns
          </a>
          <a href="#/utility/app/portfolio" class="subnav-link ${subview === "portfolio" ? "active" : ""}">
            State Demand Portfolio
          </a>
        </div>

        <div class="flex items-center gap-2">
          <button type="button" id="export-png-btn" class="btn btn-secondary btn-sm" title="Export Current View as PNG">
            📷 Export PNG
          </button>
          <button type="button" id="export-csv-btn" class="btn btn-secondary btn-sm" title="Export Forecasts as CSV">
            📥 Export CSV
          </button>
        </div>
      </nav>

      <!-- Main Utility Workspace -->
      <main class="main-container" id="ut-view-content">
        <!-- Rendered dynamically according to subview -->
      </main>

    </div>
  `;

  // Attach Topbar Listeners
  const themeBtn = container.querySelector("#ut-theme-toggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const next = toggleTheme();
      themeBtn.textContent = next === "dark" ? "☀️" : "🌙";
    });
  }

  const logoutBtn = container.querySelector("#ut-logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearSession();
      window.location.hash = "#/";
    });
  }

  const stateSelect = container.querySelector("#ut-state-select");
  const horizonBtns = container.querySelectorAll(".pill-btn[data-horizon]");

  horizonBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      horizonBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentHorizon = btn.dataset.horizon;
      store.set("currentHorizon", currentHorizon);
      loadPlanningData();
    });
  });

  // Load States list into dropdown
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
      console.warn("Failed to load states:", e);
    }
  }

  loadStatesList();

  stateSelect.addEventListener("change", (e) => {
    currentState = e.target.value;
    store.set("currentState", currentState);
    loadPlanningData();
  });

  const contentArea = container.querySelector("#ut-view-content");

  // Export handlers
  const exportPngBtn = container.querySelector("#export-png-btn");
  if (exportPngBtn) {
    exportPngBtn.addEventListener("click", () => {
      exportElementToPNG("ut-view-content", `utility-outlook-${currentState}`);
    });
  }

  const exportCsvBtn = container.querySelector("#export-csv-btn");
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener("click", handleExportCSV);
  }

  // =========================================================================
  // SUBVIEW 1: PLANNING OUTLOOK & KPIS
  // =========================================================================
  async function renderPlanningSubView() {
    contentArea.innerHTML = `
      <!-- KPI Cards Strip -->
      <div class="grid-cols-4" id="ut-kpi-grid" style="margin-bottom: var(--space-6);">
        ${renderCardSkeleton(4)}
      </div>

      <!-- Outlook Chart Card -->
      <div class="card" style="margin-bottom: var(--space-6);">
        <div class="card-header">
          <div>
            <h2 class="card-title">
              <span>Medium-Term Demand Outlook:</span>
              <span style="color: var(--utility-accent);">${escapeHTML(formatStateName(currentState))}</span>
            </h2>
            <div class="card-subtitle">
              Discrete 1-day and 7-day forward predictions with confidence intervals (discrete forecast points, no fabricated intermediate series)
            </div>
          </div>
          <span class="badge badge-info">POSOCO Baseline</span>
        </div>

        <div style="position: relative; height: 380px; width: 100%;">
          <canvas id="ut-outlook-chart"></canvas>
        </div>

        <div style="margin-top: var(--space-3); font-size: 11px; color: var(--text-muted); display: flex; justify-content: space-between;">
          <span>* Discrete forward markers at T+1d and T+7d derived from verified time-series models.</span>
          <span id="ut-model-provenance"></span>
        </div>
      </div>

      <!-- Planning Advisory & Threshold Breakdown -->
      <div class="grid-cols-2" style="margin-bottom: var(--space-6);">
        
        <!-- Recommendation Action Box -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Recommendation Engine Advisory</h3>
            <span id="ut-severity-badge" class="badge badge-normal">Status</span>
          </div>
          <div id="ut-advisory-content" class="flex flex-col gap-3">
            <div class="skeleton skeleton-text"></div>
          </div>
        </div>

        <!-- Reliability & Model Quality -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Forecast Reliability & Validation Error</h3>
            <span class="badge badge-info">20% Holdout</span>
          </div>
          <div id="ut-metrics-content" class="flex flex-col gap-3">
            <div class="skeleton skeleton-text"></div>
          </div>
        </div>

      </div>
    `;

    await loadPlanningData();
  }

  // =========================================================================
  // SUBVIEW 2: HISTORICAL DEMAND PATTERNS
  // =========================================================================
  async function renderPatternsSubView() {
    contentArea.innerHTML = `
      <div class="card" style="margin-bottom: var(--space-6);">
        <div class="card-header">
          <div>
            <h2 class="card-title">Historical Demand Analytics: ${escapeHTML(formatStateName(currentState))}</h2>
            <div class="card-subtitle">Browser-computed empirical statistics strictly derived from historical POSOCO and Open-Meteo records</div>
          </div>
          <span class="badge badge-info">computed from history</span>
        </div>
      </div>

      <!-- Pattern Charts Grid -->
      <div class="grid-cols-2" style="margin-bottom: var(--space-6);">
        
        <!-- Seasonality (Monthly Average) -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Monthly Seasonality Profile</h3>
            <span class="badge badge-info">computed from history</span>
          </div>
          <div style="position: relative; height: 280px; width: 100%;">
            <canvas id="ut-seasonality-chart"></canvas>
          </div>
          <div style="margin-top: 8px; font-size: 11px; color: var(--text-muted); text-align: center;">
            Arithmetic mean daily consumption (MU) grouped by calendar month.
          </div>
        </div>

        <!-- Day-of-Week vs Weekend vs Holiday -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Weekday vs Weekend vs Holiday Profile</h3>
            <span class="badge badge-info">computed from history</span>
          </div>
          <div style="position: relative; height: 280px; width: 100%;">
            <canvas id="ut-daytype-chart"></canvas>
          </div>
          <div style="margin-top: 8px; font-size: 11px; color: var(--text-muted); text-align: center;">
            Mean demand across standard working days, weekend days, and gazetted holidays.
          </div>
        </div>

      </div>

      <!-- Temperature vs Load Scatter -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Temperature vs Energy Demand Correlation</h3>
            <div class="card-subtitle">Scatter observation of daily temperature (°C) against daily load (MU) with linear regression trend</div>
          </div>
          <span class="badge badge-info">computed from history</span>
        </div>
        <div style="position: relative; height: 340px; width: 100%;">
          <canvas id="ut-scatter-chart"></canvas>
        </div>
      </div>
    `;

    await loadPatternsData();
  }

  // =========================================================================
  // SUBVIEW 3: STATE DEMAND PORTFOLIO
  // =========================================================================
  async function renderPortfolioSubView() {
    contentArea.innerHTML = `
      <div class="card" style="margin-bottom: var(--space-6);">
        <div class="card-header">
          <div>
            <h2 class="card-title">Multi-State Demand Portfolio</h2>
            <div class="card-subtitle">Manage, track, and compare key regional procurement territories</div>
          </div>
          <div class="flex items-center gap-2">
            <input
              type="text"
              id="portfolio-search"
              class="input btn-sm"
              placeholder="Search states..."
              style="width: 180px;"
            />
            <select id="portfolio-filter-severity" class="select btn-sm">
              <option value="ALL">All Severities</option>
              <option value="HIGH">High Alert Only</option>
              <option value="NORMAL">Normal Range Only</option>
              <option value="LOW">Low Demand Only</option>
            </select>
          </div>
        </div>

        <!-- State Selector Chips -->
        <div style="margin-bottom: var(--space-4);">
          <div class="form-label" style="margin-bottom: 6px;">Portfolio Nodes (Click to toggle tracking):</div>
          <div class="flex items-center gap-2 flex-wrap" id="portfolio-chips-container">
            <!-- Chips rendered dynamically -->
          </div>
        </div>

        <!-- Portfolio Table -->
        <div class="table-wrapper">
          <table class="data-table" id="portfolio-data-table">
            <thead>
              <tr>
                <th class="sortable" data-sort="state">State / Territory</th>
                <th class="sortable" data-sort="last_actual_mu">Last Actual</th>
                <th class="sortable" data-sort="forecast_1d">1D Forecast</th>
                <th class="sortable" data-sort="forecast_7d">7D Forecast</th>
                <th class="sortable" data-sort="change_pct">7D Change</th>
                <th class="sortable" data-sort="severity">Severity</th>
                <th class="sortable" data-sort="mape">MAPE %</th>
                <th class="sortable" data-sort="r2">R² Score</th>
                <th>Trend (60d)</th>
              </tr>
            </thead>
            <tbody id="portfolio-tbody">
              ${renderTableSkeleton(6, 9)}
            </tbody>
          </table>
        </div>
      </div>
    `;

    await loadPortfolioData();
  }

  // =========================================================================
  // DATA LOADERS FOR UTILITY
  // =========================================================================
  async function loadPlanningData() {
    const signal = store.createAbortSignal();

    try {
      const [forecast1d, forecast7d, historyData, recommendData] = await Promise.all([
        api.getForecast(currentState, "1d", "best", signal),
        api.getForecast(currentState, "7d", "best", signal),
        api.getHistory(currentState, 60, signal),
        api.getRecommend(currentState, currentHorizon, signal),
      ]);

      // KPI Grid
      const kpiGrid = document.getElementById("ut-kpi-grid");
      if (kpiGrid && forecast1d && forecast7d) {
        const change7d = forecast7d.last_actual_mu > 0
          ? ((forecast7d.predicted_mu - forecast7d.last_actual_mu) / forecast7d.last_actual_mu) * 100
          : 0;

        kpiGrid.innerHTML = `
          <div class="kpi-card">
            <div class="kpi-label">Last Recorded Demand</div>
            <div class="kpi-value">${formatNumber(forecast7d.last_actual_mu)} <span class="kpi-unit">MU</span></div>
            <div class="kpi-footer">As of ${formatDate(forecast7d.as_of)}</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-label">1-Day Ahead Forecast</div>
            <div class="kpi-value">${formatNumber(forecast1d.predicted_mu)} <span class="kpi-unit">MU</span></div>
            <div class="kpi-footer">Model: ${escapeHTML(forecast1d.model_used)}</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-label">7-Day Forward Planning Target</div>
            <div class="kpi-value">${formatNumber(forecast7d.predicted_mu)} <span class="kpi-unit">MU</span></div>
            <div class="kpi-footer">
              <span style="color: ${change7d >= 0 ? 'var(--color-high)' : 'var(--color-normal)'}; font-weight: 600;">
                ${change7d >= 0 ? '▲ +' : '▼ '}${change7d.toFixed(2)}%
              </span>
              <span>vs baseline</span>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-label">Operational Severity</div>
            <div class="kpi-value" style="font-size: var(--text-2xl);">
              <span class="badge ${recommendData.severity === 'HIGH' ? 'badge-high' : recommendData.severity === 'LOW' ? 'badge-low' : 'badge-normal'}">
                ${escapeHTML(recommendData.severity)}
              </span>
            </div>
            <div class="kpi-footer">P90 Thresh: ${formatMU(recommendData.high_threshold_mu)}</div>
          </div>
        `;
      }

      // Outlook Chart
      renderUtilityOutlookChart("ut-outlook-chart", historyData, forecast1d, forecast7d);

      // Advisory content
      const advisoryBox = document.getElementById("ut-advisory-content");
      const sevBadge = document.getElementById("ut-severity-badge");
      if (advisoryBox && recommendData) {
        if (sevBadge) {
          sevBadge.textContent = recommendData.severity;
          sevBadge.className = `badge ${recommendData.severity === 'HIGH' ? 'badge-high' : recommendData.severity === 'LOW' ? 'badge-low' : 'badge-normal'}`;
        }

        advisoryBox.innerHTML = `
          <div style="font-size: var(--text-md); font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">
            ${escapeHTML(recommendData.action)}
          </div>
          <div class="flex items-center justify-between" style="padding: 6px 0; border-top: 1px solid var(--border-subtle); margin-top: 8px;">
            <span style="color: var(--text-secondary);">High Demand Threshold (P90)</span>
            <span class="num">${formatMU(recommendData.high_threshold_mu)}</span>
          </div>
          <div class="flex items-center justify-between" style="padding: 6px 0; border-top: 1px solid var(--border-subtle);">
            <span style="color: var(--text-secondary);">Low Demand Threshold (P10)</span>
            <span class="num">${formatMU(recommendData.low_threshold_mu)}</span>
          </div>
          <div class="flex items-center justify-between" style="padding: 6px 0; border-top: 1px solid var(--border-subtle);">
            <span style="color: var(--text-secondary);">Ambient Weather Telemetry</span>
            <span class="num">${formatTemp(recommendData.temperature_c)}</span>
          </div>
        `;
      }

      // Reliability metrics content
      const metricsBox = document.getElementById("ut-metrics-content");
      if (metricsBox && forecast7d) {
        metricsBox.innerHTML = `
          <div class="flex items-center justify-between" style="padding: 6px 0;">
            <span style="color: var(--text-secondary);">Primary Medium-Term Model</span>
            <span class="badge badge-normal">${escapeHTML(forecast7d.model_used)}</span>
          </div>
          <div class="flex items-center justify-between" style="padding: 6px 0; border-top: 1px solid var(--border-subtle);">
            <span style="color: var(--text-secondary);">Validation MAPE</span>
            <span class="num">${forecast7d.mape_pct !== null ? formatPct(forecast7d.mape_pct) : 'N/A'}</span>
          </div>
          <div class="flex items-center justify-between" style="padding: 6px 0; border-top: 1px solid var(--border-subtle);">
            <span style="color: var(--text-secondary);">Validation RMSE</span>
            <span class="num">${forecast7d.rmse !== null ? formatMU(forecast7d.rmse) : 'N/A'}</span>
          </div>
          <div class="flex items-center justify-between" style="padding: 6px 0; border-top: 1px solid var(--border-subtle);">
            <span style="color: var(--text-secondary);">R² Determination Score</span>
            <span class="num">${forecast7d.r2 !== null ? forecast7d.r2.toFixed(4) : 'N/A'}</span>
          </div>
        `;
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        console.error("Planning load error:", e);
      }
    }
  }

  // Load Historical Demand Patterns (Seasonality, Day-Type, Weather Regression)
  async function loadPatternsData() {
    try {
      // Fetch full history (e.g. 5000 days gets all ~498 records)
      const data = await api.getHistory(currentState, 5000);
      if (!data || !data.dates || data.dates.length === 0) return;

      const dates = data.dates;
      const loads = data.consumption_mu;
      const temps = data.temperature_c;
      const holidays = data.is_holiday;

      // 1. Monthly Seasonality (Months 1 to 12)
      const monthBuckets = Array.from({ length: 12 }, () => []);
      dates.forEach((dStr, idx) => {
        const monthIndex = parseInt(dStr.split("-")[1], 10) - 1;
        monthBuckets[monthIndex].push(loads[idx]);
      });

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthAverages = monthBuckets.map((b) => (b.length ? b.reduce((a, c) => a + c, 0) / b.length : 0));

      renderSeasonalityChart("ut-seasonality-chart", monthNames, monthAverages);

      // 2. Weekday vs Weekend vs Holiday
      const weekdayVals = [];
      const weekendVals = [];
      const holidayVals = [];

      dates.forEach((dStr, idx) => {
        const parts = dStr.split("-");
        const dt = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
        const day = dt.getUTCDay(); // 0 is Sunday, 6 is Saturday
        const load = loads[idx];

        if (holidays[idx]) {
          holidayVals.push(load);
        } else if (day === 0 || day === 6) {
          weekendVals.push(load);
        } else {
          weekdayVals.push(load);
        }
      });

      const avg = (arr) => (arr.length ? arr.reduce((a, c) => a + c, 0) / arr.length : 0);
      renderDayTypeChart("ut-daytype-chart", [avg(weekdayVals), avg(weekendVals), avg(holidayVals)]);

      // 3. Temperature vs Load Scatter & Linear Regression
      const scatterPoints = [];
      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      const n = dates.length;

      for (let i = 0; i < n; i++) {
        const x = temps[i];
        const y = loads[i];
        scatterPoints.push({ x, y });
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumXX += x * x;
      }

      // Linear regression: y = m*x + c
      const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const c = (sumY - m * sumX) / n;

      const minX = Math.min(...temps);
      const maxX = Math.max(...temps);
      const regressionLine = [
        { x: minX, y: m * minX + c },
        { x: maxX, y: m * maxX + c },
      ];

      renderWeatherScatterChart("ut-scatter-chart", scatterPoints, regressionLine);
    } catch (e) {
      console.error("Patterns calculation error:", e);
    }
  }

  // Portfolio Multi-State Table
  async function loadPortfolioData() {
    const tbody = document.getElementById("portfolio-tbody");
    const chipsContainer = document.getElementById("portfolio-chips-container");
    const searchInput = document.getElementById("portfolio-search");
    const severitySelect = document.getElementById("portfolio-filter-severity");
    if (!tbody) return;

    let allStates = store.get("states");
    if (!allStates || allStates.length === 0) {
      const sData = await api.getStates();
      allStates = sData.states;
      store.set("states", allStates);
    }

    // Render chips
    function renderChips() {
      chipsContainer.innerHTML = allStates.map((s) => {
        const isSelected = portfolioStates.includes(s);
        return `
          <button type="button" class="pill-btn ${isSelected ? 'active' : ''}" data-state="${s}">
            ${escapeHTML(formatStateName(s))}
          </button>
        `;
      }).join("");

      chipsContainer.querySelectorAll(".pill-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const st = btn.dataset.state;
          if (portfolioStates.includes(st)) {
            if (portfolioStates.length > 1) {
              portfolioStates = portfolioStates.filter((x) => x !== st);
            }
          } else {
            portfolioStates.push(st);
          }
          store.set("portfolioStates", portfolioStates);
          renderChips();
          loadTableData();
        });
      });
    }

    renderChips();

    // Table dataset cache
    let portfolioRows = [];

    async function loadTableData() {
      tbody.innerHTML = renderTableSkeleton(portfolioStates.length, 9);

      const tasks = portfolioStates.map((st) => async () => {
        const [f1d, f7d, hist, rec] = await Promise.all([
          api.getForecast(st, "1d").catch(() => null),
          api.getForecast(st, "7d").catch(() => null),
          api.getHistory(st, 60).catch(() => null),
          api.getRecommend(st, "7d").catch(() => null),
        ]);

        const changePct = f7d && f7d.last_actual_mu > 0
          ? ((f7d.predicted_mu - f7d.last_actual_mu) / f7d.last_actual_mu) * 100
          : 0;

        return {
          state: st,
          last_actual_mu: f7d ? f7d.last_actual_mu : null,
          forecast_1d: f1d ? f1d.predicted_mu : null,
          forecast_7d: f7d ? f7d.predicted_mu : null,
          change_pct: changePct,
          severity: rec ? rec.severity : "NORMAL",
          mape: f7d ? f7d.mape_pct : null,
          r2: f7d ? f7d.r2 : null,
          history: hist ? hist.consumption_mu : [],
        };
      });

      portfolioRows = await runWithConcurrency(tasks, 4);
      renderTableRows();
    }

    function renderTableRows() {
      const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";
      const sevFilter = severitySelect ? severitySelect.value : "ALL";

      const filtered = portfolioRows.filter((r) => {
        const matchesName = formatStateName(r.state).toLowerCase().includes(searchTerm);
        const matchesSev = sevFilter === "ALL" || r.severity === sevFilter;
        return matchesName && matchesSev;
      });

      if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">
              No portfolio states match the current filter.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = filtered.map((row) => {
        const sparklineSvg = generateSparkline(row.history);
        return `
          <tr>
            <td style="font-weight: 600; color: var(--text-primary);">
              ${escapeHTML(formatStateName(row.state))}
            </td>
            <td class="num">${row.last_actual_mu !== null ? formatMU(row.last_actual_mu) : 'N/A'}</td>
            <td class="num">${row.forecast_1d !== null ? formatMU(row.forecast_1d) : 'N/A'}</td>
            <td class="num" style="font-weight: 600; color: var(--utility-accent);">
              ${row.forecast_7d !== null ? formatMU(row.forecast_7d) : 'N/A'}
            </td>
            <td class="num" style="color: ${row.change_pct >= 0 ? 'var(--color-high)' : 'var(--color-normal)'}; font-weight: 600;">
              ${row.change_pct >= 0 ? '+' : ''}${row.change_pct.toFixed(2)}%
            </td>
            <td>
              <span class="badge ${row.severity === 'HIGH' ? 'badge-high' : row.severity === 'LOW' ? 'badge-low' : 'badge-normal'}">
                ${escapeHTML(row.severity)}
              </span>
            </td>
            <td class="num">${row.mape !== null ? formatPct(row.mape) : 'N/A'}</td>
            <td class="num">${row.r2 !== null ? row.r2.toFixed(4) : 'N/A'}</td>
            <td>${sparklineSvg}</td>
          </tr>
        `;
      }).join("");
    }

    if (searchInput) searchInput.addEventListener("input", renderTableRows);
    if (severitySelect) severitySelect.addEventListener("change", renderTableRows);

    // Sorting
    container.querySelectorAll("#portfolio-data-table th.sortable").forEach((th) => {
      let asc = true;
      th.addEventListener("click", () => {
        const key = th.dataset.sort;
        portfolioRows.sort((a, b) => {
          let va = a[key];
          let vb = b[key];
          if (va === null) return 1;
          if (vb === null) return -1;
          if (typeof va === "string") return asc ? va.localeCompare(vb) : vb.localeCompare(va);
          return asc ? va - vb : vb - va;
        });
        asc = !asc;
        renderTableRows();
      });
    });

    await loadTableData();
  }

  // Generate SVG Sparkline string
  function generateSparkline(values) {
    if (!values || values.length < 2) return "";
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const w = 90;
    const h = 24;

    const points = values.map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

    return `
      <svg width="${w}" height="${h}" style="overflow: visible;">
        <polyline
          fill="none"
          stroke="var(--utility-accent)"
          stroke-width="1.5"
          points="${points}"
        />
      </svg>
    `;
  }

  // CSV Export
  async function handleExportCSV() {
    showToast("Generating portfolio forecast CSV...", "info");
    const statesToExport = store.get("portfolioStates") || [currentState];

    const tasks = statesToExport.map((st) => async () => {
      const [f1d, f7d, rec] = await Promise.all([
        api.getForecast(st, "1d").catch(() => null),
        api.getForecast(st, "7d").catch(() => null),
        api.getRecommend(st, "7d").catch(() => null),
      ]);
      return [
        formatStateName(st),
        f1d ? f1d.as_of : "",
        f1d ? f1d.last_actual_mu : "",
        f1d ? f1d.predicted_mu : "",
        f7d ? f7d.predicted_mu : "",
        rec ? rec.severity : "",
        f7d ? f7d.mape_pct : "",
        f7d ? f7d.r2 : "",
        f7d ? f7d.model_used : "",
      ];
    });

    const rows = await runWithConcurrency(tasks, 4);
    const headers = [
      "State",
      "As Of Date",
      "Last Actual (MU)",
      "1D Forecast (MU)",
      "7D Forecast (MU)",
      "Severity",
      "Validation MAPE (%)",
      "R2 Score",
      "Model Used",
    ];

    exportToCSV(`grid-portfolio-forecasts-${new Date().toISOString().split("T")[0]}`, headers, rows);
    showToast("CSV exported successfully", "success");
  }

  // Subview Dispatcher
  if (subview === "patterns") {
    await renderPatternsSubView();
  } else if (subview === "portfolio") {
    await renderPortfolioSubView();
  } else {
    await renderPlanningSubView();
  }

  // Cleanup handler
  return () => {
    destroyChart("ut-outlook-chart");
    destroyChart("ut-seasonality-chart");
    destroyChart("ut-daytype-chart");
    destroyChart("ut-scatter-chart");
  };
}
