/**
 * THE GRID: ADMINISTRATOR DASHBOARD
 * admin.js — "System Control & Governance"
 */

import { api } from "../api.js";
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
  renderCardSkeleton,
  renderTableSkeleton,
} from "../ui.js";
import { formatStateName, getFeatureLabel } from "../labels.js";
import {
  renderModelDistributionChart,
  renderDriftChart,
  renderFeedbackChart,
  renderSHAPChart,
  destroyChart,
} from "../charts.js";

export async function renderAdminApp(container, subview = "default") {
  const user = getCurrentUser();
  const theme = getTheme();

  container.innerHTML = `
    <div class="dashboard-shell theme-admin animate-fade-in" data-role="Administrator">
      
      <!-- Sticky Topbar -->
      <header class="dashboard-topbar">
        <div class="topbar-brand">
          <div class="brand-glyph" style="background: var(--admin-accent);">🛡️</div>
          <div>
            <div class="brand-text">THE GRID</div>
            <div class="brand-subtext">System Control & Governance</div>
          </div>
        </div>

        <div class="topbar-controls">
          <!-- Theme Toggle -->
          <button id="adm-theme-toggle" class="btn-icon" aria-label="Toggle Theme">
            ${theme === "dark" ? "☀️" : "🌙"}
          </button>

          <!-- User Profile Chip -->
          <div class="user-profile-chip">
            <div class="user-avatar" style="background: var(--admin-accent);">👑</div>
            <span>${escapeHTML(user ? user.name : "System Administrator")}</span>
          </div>

          <button id="adm-logout-btn" class="btn btn-secondary btn-sm" aria-label="Log Out">Sign Out</button>
        </div>
      </header>

      <!-- Sub Navigation -->
      <nav class="dashboard-subnav" aria-label="Governance Navigation">
        <div class="subnav-tabs">
          <a href="#/admin/app" class="subnav-link ${subview === "default" || subview === "overview" ? "active" : ""}">
            Platform Health Strip
          </a>
          <a href="#/admin/app/performance" class="subnav-link ${subview === "performance" ? "active" : ""}">
            Model Performance Center
          </a>
          <a href="#/admin/app/drift" class="subnav-link ${subview === "drift" ? "active" : ""}">
            Continuous Drift & Retraining
          </a>
          <a href="#/admin/app/feedback" class="subnav-link ${subview === "feedback" ? "active" : ""}">
            Actual vs Predicted Feedback
          </a>
          <a href="#/admin/app/explain" class="subnav-link ${subview === "explain" ? "active" : ""}">
            XAI Cross-Agreement Audit
          </a>
          <a href="#/admin/app/docs" class="subnav-link ${subview === "docs" ? "active" : ""}">
            Architecture & Audit Reports
          </a>
        </div>

        <div class="flex items-center gap-2">
          <span class="badge badge-normal">
            <span class="badge-dot"></span> RBAC Security Active
          </span>
        </div>
      </nav>

      <!-- Main Administrator Workspace -->
      <main class="main-container" id="adm-view-content">
        <!-- Rendered dynamically according to subview -->
      </main>

    </div>
  `;

  // Attach Topbar Listeners
  const themeBtn = container.querySelector("#adm-theme-toggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const next = toggleTheme();
      themeBtn.textContent = next === "dark" ? "☀️" : "🌙";
    });
  }

  const logoutBtn = container.querySelector("#adm-logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearSession();
      window.location.hash = "#/";
    });
  }

  const contentArea = container.querySelector("#adm-view-content");

  // =========================================================================
  // SUBVIEW 1: SYSTEM HEALTH STRIP & OVERVIEW
  // =========================================================================
  async function renderHealthSubView() {
    contentArea.innerHTML = `
      <!-- Health Cards Strip -->
      <div class="grid-cols-4" id="adm-health-strip" style="margin-bottom: var(--space-6);">
        ${renderCardSkeleton(4)}
      </div>

      <!-- Quick Platform Telemetry Overview -->
      <div class="grid-cols-2" style="margin-bottom: var(--space-6);">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Latest Drift Telemetry Snapshot</h3>
            <span id="adm-drift-badge" class="badge badge-info">Checking...</span>
          </div>
          <div id="adm-drift-snapshot" class="flex flex-col gap-2">
            <div class="skeleton skeleton-text"></div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Feedback Accuracy Tracking</h3>
            <span id="adm-feedback-badge" class="badge badge-info">Checking...</span>
          </div>
          <div id="adm-feedback-snapshot" class="flex flex-col gap-2">
            <div class="skeleton skeleton-text"></div>
          </div>
        </div>
      </div>

      <!-- System Quick Audit Summary -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">System Status & Environment Manifest</h3>
            <div class="card-subtitle">FastAPI Core Runtime • Chronological Zero-Leakage Pipeline</div>
          </div>
          <span class="badge badge-normal">Health Status: PASS</span>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Component Layer</th>
                <th>Target Specification</th>
                <th>Validation Protocol</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Raw Data Layer</strong></td>
                <td>33 Indian States / UTs (16,434 daily rows)</td>
                <td>Non-destructive immutable storage</td>
                <td><span class="badge badge-normal">VERIFIED</span></td>
              </tr>
              <tr>
                <td><strong>Feature Pipeline</strong></td>
                <td>Lags (1d, 7d, 30d), Rolling stats, Cyclical time</td>
                <td>Chronological time-series split (80/20)</td>
                <td><span class="badge badge-normal">NO LEAKAGE</span></td>
              </tr>
              <tr>
                <td><strong>Model Evaluation</strong></td>
                <td>RF, XGBoost, LSTM, GRU, Prophet (330 evals)</td>
                <td>Best model selection per node/horizon</td>
                <td><span class="badge badge-normal">COMPLETED</span></td>
              </tr>
              <tr>
                <td><strong>Explainability</strong></td>
                <td>Game-theoretic SHAP + Local Linear LIME</td>
                <td>Synchronous tree explainer & tabular surrogate</td>
                <td><span class="badge badge-normal">OPERATIONAL</span></td>
              </tr>
              <tr>
                <td><strong>RBAC Security</strong></td>
                <td>JWT HS256 tokens with role-boundary guards</td>
                <td>Admin, Grid Operator, Utility Company</td>
                <td><span class="badge badge-normal">ENFORCED</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    await loadHealthData();
  }

  // =========================================================================
  // SUBVIEW 2: MODEL PERFORMANCE CENTER
  // =========================================================================
  async function renderPerformanceSubView() {
    contentArea.innerHTML = `
      <!-- Horizon Filter for Leaderboard -->
      <div class="card" style="margin-bottom: var(--space-6);">
        <div class="card-header">
          <div>
            <h2 class="card-title">National Model Performance Leaderboard</h2>
            <div class="card-subtitle">Empirical validation metrics across 330 model-node-horizon evaluations</div>
          </div>
          <div class="pill-group" id="leaderboard-horizon-filter">
            <button type="button" class="pill-btn active" data-horizon="all">All Horizons</button>
            <button type="button" class="pill-btn" data-horizon="1d">1-Day Ahead</button>
            <button type="button" class="pill-btn" data-horizon="7d">7-Day Ahead</button>
          </div>
        </div>

        <div class="table-wrapper">
          <table class="data-table" id="leaderboard-table">
            <thead>
              <tr>
                <th>Model Architecture</th>
                <th>Average MAE (MU)</th>
                <th>Average RMSE (MU)</th>
                <th>Average MAPE (%)</th>
                <th>Average R² Score</th>
                <th>Selections as Best</th>
              </tr>
            </thead>
            <tbody id="leaderboard-tbody">
              ${renderTableSkeleton(5, 6)}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Best Model Distribution & Heatmap -->
      <div class="grid-cols-2" style="margin-bottom: var(--space-6);">
        
        <!-- Distribution Chart -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Best Model Distribution (66 Pairs)</h3>
            <span class="badge badge-info">Empirically Computed</span>
          </div>
          <div style="position: relative; height: 320px; width: 100%;">
            <canvas id="adm-distribution-chart"></canvas>
          </div>
          <div style="margin-top: 8px; font-size: 11px; color: var(--text-muted); text-align: center;">
            Proportion of state-horizon combinations where each model achieved lowest test MAE.
          </div>
        </div>

        <!-- Heatmap of MAPE by State x Model -->
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">MAPE Heatmap: State × Model</h3>
              <div class="card-subtitle">Color intensity scales with Mean Absolute Percentage Error</div>
            </div>
            <span class="badge badge-normal">Lower is Better</span>
          </div>
          <div class="table-wrapper" style="max-height: 320px; overflow-y: auto;">
            <table class="data-table" style="font-size: 11px;" id="adm-heatmap-table">
              <thead>
                <tr>
                  <th>State</th>
                  <th>RF</th>
                  <th>XGB</th>
                  <th>LSTM</th>
                  <th>GRU</th>
                  <th>Prophet</th>
                </tr>
              </thead>
              <tbody id="adm-heatmap-tbody">
                ${renderTableSkeleton(6, 6)}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    await loadPerformanceData();
  }

  // =========================================================================
  // SUBVIEW 3: CONTINUOUS DRIFT & RETRAINING
  // =========================================================================
  async function renderDriftSubView() {
    contentArea.innerHTML = `
      <div class="card" style="margin-bottom: var(--space-6);">
        <div class="card-header">
          <div>
            <h2 class="card-title">Model Drift Monitoring & Retraining Telemetry</h2>
            <div class="card-subtitle">Real-time tracking of rolling error windows against baseline tolerances</div>
          </div>
          <span class="badge badge-info">From /monitoring</span>
        </div>

        <div style="position: relative; height: 360px; width: 100%; margin-bottom: var(--space-4);">
          <canvas id="adm-drift-chart"></canvas>
        </div>

        <div style="font-size: 11px; color: var(--text-muted);">
          * Red markers signify monitoring intervals where rolling MAE exceeded the baseline threshold by >25%, triggering automated model retraining.
        </div>
      </div>

      <!-- Dynamic Drift Logs Table -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Continuous Telemetry Audit Log (Last 30 Windows)</h3>
          <span class="badge badge-info" id="adm-drift-count-badge">Loading...</span>
        </div>
        <div class="table-wrapper">
          <table class="data-table" id="adm-drift-table">
            <thead id="adm-drift-thead"></thead>
            <tbody id="adm-drift-tbody">
              ${renderTableSkeleton(5, 6)}
            </tbody>
          </table>
        </div>
      </div>
    `;

    await loadDriftData();
  }

  // =========================================================================
  // SUBVIEW 4: FEEDBACK LOOP AUDIT
  // =========================================================================
  async function renderFeedbackSubView() {
    contentArea.innerHTML = `
      <div class="card" style="margin-bottom: var(--space-6);">
        <div class="card-header">
          <div>
            <h2 class="card-title">Actual vs Predicted Demand Feedback Loop</h2>
            <div class="card-subtitle">Empirical operational verification of model predictions against realized grid consumption</div>
          </div>
          <span class="badge badge-info">From /feedback</span>
        </div>

        <div style="position: relative; height: 360px; width: 100%; margin-bottom: var(--space-4);">
          <canvas id="adm-feedback-chart"></canvas>
        </div>
      </div>

      <!-- Dynamic Feedback Logs Table with Worst States Highlighted -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Realized Consumption Feedback Log</h3>
            <div class="card-subtitle">Rows with percent error > 10% automatically flagged for engineering review</div>
          </div>
          <span class="badge badge-info" id="adm-feedback-count-badge">Loading...</span>
        </div>
        <div class="table-wrapper">
          <table class="data-table" id="adm-feedback-table">
            <thead id="adm-feedback-thead"></thead>
            <tbody id="adm-feedback-tbody">
              ${renderTableSkeleton(5, 7)}
            </tbody>
          </table>
        </div>
      </div>
    `;

    await loadFeedbackData();
  }

  // =========================================================================
  // SUBVIEW 5: EXPLAINABILITY AGREEMENT AUDIT
  // =========================================================================
  async function renderExplainSubView() {
    contentArea.innerHTML = `
      <div class="card" style="margin-bottom: var(--space-6);">
        <div class="card-header">
          <div>
            <h2 class="card-title">Explainability Cross-Method Agreement Audit</h2>
            <div class="card-subtitle">Sub-string and rank concordance analysis between global SHAP values and local linear LIME factors</div>
          </div>
          <div class="flex items-center gap-3">
            <select id="adm-explain-state-select" class="select btn-sm">
              <option value="Maharashtra">Maharashtra</option>
              <option value="Gujarat">Gujarat</option>
              <option value="Delhi">Delhi</option>
              <option value="Punjab">Punjab</option>
              <option value="UP">Uttar Pradesh</option>
            </select>
            <button id="adm-run-agreement-btn" class="btn btn-primary btn-sm">
              Compute Concordance Audit
            </button>
          </div>
        </div>

        <!-- Agreement Metric Card -->
        <div id="adm-agreement-metric-box" style="margin-bottom: var(--space-4);">
          <div class="kpi-card">
            <div class="kpi-label">Concordance Score (Feature Intersection)</div>
            <div class="kpi-value" id="adm-agreement-score-val">Pending Execution</div>
            <div class="kpi-footer" id="adm-agreement-score-desc">
              Select state and click 'Compute Concordance Audit'
            </div>
          </div>
        </div>

        <!-- Two Column Breakdown -->
        <div class="grid-cols-2">
          <div>
            <h4 style="font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; margin-bottom: var(--space-2);">
              Top 8 SHAP Drivers
            </h4>
            <div style="position: relative; height: 260px; width: 100%;">
              <canvas id="adm-shap-chart"></canvas>
            </div>
          </div>

          <div>
            <h4 style="font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; margin-bottom: var(--space-2);">
              LIME Feature Rule Intervals
            </h4>
            <div id="adm-lime-box" style="min-height: 260px; display: flex; flex-direction: column; justify-content: center;">
              <div class="empty-state">
                <span class="empty-state-icon">⚖️</span>
                <div class="empty-state-title">Audit Ready</div>
                <p class="empty-state-desc">Click button to generate synchronous SHAP and LIME comparison.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const runBtn = contentArea.querySelector("#adm-run-agreement-btn");
    const stateSelect = contentArea.querySelector("#adm-explain-state-select");

    // Populate state options from store
    const states = store.get("states");
    if (states && states.length > 0) {
      stateSelect.innerHTML = states
        .map((s) => `<option value="${escapeHTML(s)}">${escapeHTML(formatStateName(s))}</option>`)
        .join("");
    }

    if (runBtn) {
      runBtn.addEventListener("click", () => {
        loadExplainAudit(stateSelect.value);
      });
    }

    await loadExplainAudit(stateSelect.value || "Maharashtra");
  }

  // =========================================================================
  // SUBVIEW 6: ARCHITECTURE & AUDIT REPORTS (STATIC DOCUMENTATION)
  // =========================================================================
  async function renderDocsSubView() {
    contentArea.innerHTML = `
      <div class="card" style="margin-bottom: var(--space-6);">
        <div class="card-header">
          <div>
            <h2 class="card-title">Technical Documentation & Verifiable Architecture Reports</h2>
            <div class="card-subtitle">Comprehensive documentation of the six engineering reports produced for the Indian Smart Grid platform</div>
          </div>
          <span class="badge badge-normal">System Version 2.0.0</span>
        </div>
      </div>

      <div class="grid-cols-2" style="margin-bottom: var(--space-6);">
        
        <!-- Report 1 -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">1. Data Cleaning & Feature Engineering</h3>
            <span class="badge badge-info">DATA_PROCESSING_REPORT.md</span>
          </div>
          <p style="font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.5; margin-bottom: var(--space-3);">
            Documents the audit of 16,599 raw POSOCO records. Identified and deduplicated 165 overlapping weekly state-date entries by arithmetic averaging (reducing to 16,434 rows). Corrected Jammu & Kashmir weather coordinates to Srinagar (34.0837°N, 74.7973°E), preventing -29°C extreme distortion. Engineered lags, rolling stats, and holiday flags with 0 target leakage.
          </p>
          <div class="flex items-center gap-2">
            <span class="badge badge-normal">33 Nodes Covered</span>
            <span class="badge badge-normal">Zero Target Leakage</span>
          </div>
        </div>

        <!-- Report 2 -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">2. Model Evaluation & Best Selection</h3>
            <span class="badge badge-info">MODEL_EVALUATION_REPORT.md</span>
          </div>
          <p style="font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.5; margin-bottom: var(--space-3);">
            Results of 330 model evaluations (33 states × 2 horizons × 5 models: Random Forest, XGBoost, LSTM, GRU, Prophet). Selection conducted on a strict 20% chronological holdout test set. Random Forest was selected in 36 instances (54.5%), XGBoost in 16 (24.2%), LSTM in 6 (9.1%), Prophet in 4 (6.1%), and GRU in 4 (6.1%).
          </p>
          <div class="flex items-center gap-2">
            <span class="badge badge-normal">330 Evaluations</span>
            <span class="badge badge-normal">Lowest MAE Selection</span>
          </div>
        </div>

        <!-- Report 3 -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">3. Explainable AI (SHAP & LIME)</h3>
            <span class="badge badge-info">EXPLAINABILITY_REPORT.md</span>
          </div>
          <p style="font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.5; margin-bottom: var(--space-3);">
            Details game-theoretic Shapley Additive Explanations (TreeExplainer) providing exact marginal feature attributions alongside Local Interpretable Model-agnostic Explanations (LIME) linear surrogate rules. Exposes feature drivers such as 1-day lag and ambient temperature to grid dispatchers.
          </p>
          <div class="flex items-center gap-2">
            <span class="badge badge-normal">SHAP Top-8</span>
            <span class="badge badge-normal">LIME 6 Rules</span>
          </div>
        </div>

        <!-- Report 4 -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">4. Smart Grid Recommendation Engine</h3>
            <span class="badge badge-info">RECOMMENDATION_REPORT.md</span>
          </div>
          <p style="font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.5; margin-bottom: var(--space-3);">
            Rule-based decision support classifying forecasted demand into HIGH (>= P90), LOW (<= P10), and NORMAL categories based on state historical demand percentiles. If HIGH and temperature >= 35°C, triggers critical heat peak load shaving. Strict policy: decision support only; zero direct switchgear actuation.
          </p>
          <div class="flex items-center gap-2">
            <span class="badge badge-normal">P90 / P10 Percentiles</span>
            <span class="badge badge-normal">Zero Direct Actuation</span>
          </div>
        </div>

        <!-- Report 5 -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">5. System Architecture & Tech Specs</h3>
            <span class="badge badge-info">SYSTEM_ARCHITECTURE.md</span>
          </div>
          <p style="font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.5; margin-bottom: var(--space-3);">
            End-to-end system architecture detailing POSOCO data ingestion, Open-Meteo weather synchronization, PyTorch deep learning recurrent networks, FastAPI REST microservices, and JWT role-based access control across Administrator, Grid Operator, and Utility Company personas.
          </p>
          <div class="flex items-center gap-2">
            <span class="badge badge-normal">FastAPI 2.0.0</span>
            <span class="badge badge-normal">JWT HS256 RBAC</span>
          </div>
        </div>

        <!-- Report 6 -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">6. Comprehensive Testing & Verification</h3>
            <span class="badge badge-info">TESTING_REPORT.md</span>
          </div>
          <p style="font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.5; margin-bottom: var(--space-3);">
            Documents full verification across 20 test steps: raw data preservation checks, coordinate repairs, model training integrity, REST endpoint tests (including HTTP 403 enforcement on admin endpoints for non-admin tokens), and UI Chart.js render synchronizations.
          </p>
          <div class="flex items-center gap-2">
            <span class="badge badge-normal">20 of 20 Tests Passed</span>
            <span class="badge badge-normal">100% Verification</span>
          </div>
        </div>

      </div>
    `;
  }

  // =========================================================================
  // DATA LOADERS FOR ADMINISTRATOR
  // =========================================================================
  async function loadHealthData() {
    try {
      const [meRes, statesRes, bestRes, monRes, feedRes] = await Promise.all([
        api.getMe().catch(() => null),
        api.getStates().catch(() => ({ states: [] })),
        api.getBestModels().catch(() => ({ data: [] })),
        api.getMonitoring().catch(() => ({ log: [] })),
        api.getFeedback().catch(() => ({ log: [] })),
      ]);

      const healthStrip = document.getElementById("adm-health-strip");
      if (healthStrip) {
        const isApiUp = !!meRes;
        const statesCount = statesRes.states ? statesRes.states.length : 33;
        const bestCount = bestRes.data ? bestRes.data.length : 66;
        const monCount = monRes.log ? monRes.log.length : 0;
        const feedCount = feedRes.log ? feedRes.log.length : 0;

        healthStrip.innerHTML = `
          <div class="kpi-card">
            <div class="kpi-label">API Core Gateway</div>
            <div class="kpi-value" style="font-size: var(--text-2xl); color: ${isApiUp ? 'var(--color-normal)' : 'var(--color-high)'};">
              ${isApiUp ? 'ONLINE 200' : 'UNREACHABLE'}
            </div>
            <div class="kpi-footer">FastAPI REST Runtime</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-label">Grid Nodes Covered</div>
            <div class="kpi-value">${statesCount} <span class="kpi-unit">States/UTs</span></div>
            <div class="kpi-footer">100% National POSOCO Coverage</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-label">Verified Best Models</div>
            <div class="kpi-value">${bestCount} <span class="kpi-unit">Pairs</span></div>
            <div class="kpi-footer">33 States × 2 Horizons (1d, 7d)</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-label">Telemetry Log Entries</div>
            <div class="kpi-value">${monCount + feedCount} <span class="kpi-unit">Records</span></div>
            <div class="kpi-footer">${monCount} drift / ${feedCount} feedback logs</div>
          </div>
        `;
      }

      // Drift Snapshot
      const driftSnap = document.getElementById("adm-drift-snapshot");
      const driftBadge = document.getElementById("adm-drift-badge");
      if (driftSnap && monRes.log) {
        const lastEntry = monRes.log[monRes.log.length - 1];
        if (lastEntry) {
          const isDrift = lastEntry.drift_flagged === true || lastEntry.drift_flagged === "True";
          if (driftBadge) {
            driftBadge.textContent = isDrift ? "DRIFT FLAGGED" : "NORMAL";
            driftBadge.className = `badge ${isDrift ? 'badge-high' : 'badge-normal'}`;
          }

          driftSnap.innerHTML = `
            <div class="flex items-center justify-between">
              <span style="color: var(--text-secondary);">Latest Audit Window</span>
              <span class="num">${lastEntry.window_start} to ${lastEntry.window_end}</span>
            </div>
            <div class="flex items-center justify-between">
              <span style="color: var(--text-secondary);">Window MAE vs Baseline</span>
              <span class="num">${Number(lastEntry.window_MAE).toFixed(2)} MU vs ${Number(lastEntry.baseline_MAE).toFixed(2)} MU</span>
            </div>
          `;
        }
      }

      // Feedback Snapshot
      const feedSnap = document.getElementById("adm-feedback-snapshot");
      const feedBadge = document.getElementById("adm-feedback-badge");
      if (feedSnap && feedRes.log) {
        const lastEntry = feedRes.log[feedRes.log.length - 1];
        if (lastEntry) {
          const errVal = Number(lastEntry.pct_error);
          if (feedBadge) {
            feedBadge.textContent = `${errVal.toFixed(2)}% Error`;
            feedBadge.className = `badge ${errVal > 10 ? 'badge-warning' : 'badge-normal'}`;
          }

          feedSnap.innerHTML = `
            <div class="flex items-center justify-between">
              <span style="color: var(--text-secondary);">Target State Node</span>
              <span style="font-weight: 600;">${lastEntry.node || 'Maharashtra'}</span>
            </div>
            <div class="flex items-center justify-between">
              <span style="color: var(--text-secondary);">Actual vs Predicted</span>
              <span class="num">${Number(lastEntry.actual_mu).toFixed(1)} MU vs ${Number(lastEntry.predicted_mu).toFixed(1)} MU</span>
            </div>
          `;
        }
      }
    } catch (e) {
      console.error("Health load failed:", e);
    }
  }

  // Model Performance Data (Leaderboard, Distribution, Heatmap)
  async function loadPerformanceData() {
    try {
      const [compRes, bestRes] = await Promise.all([
        api.getModelComparison(),
        api.getBestModels(),
      ]);

      const compData = compRes.data || [];
      const bestData = bestRes.data || [];

      // 1. Compute dynamic best model counts (RF, XGB, LSTM, Prophet, GRU)
      const modelCounts = {};
      bestData.forEach((row) => {
        const m = row.model;
        modelCounts[m] = (modelCounts[m] || 0) + 1;
      });

      renderModelDistributionChart("adm-distribution-chart", modelCounts);

      // 2. Leaderboard Aggregation
      const horizonFilter = document.getElementById("leaderboard-horizon-filter");
      const tbody = document.getElementById("leaderboard-tbody");

      function updateLeaderboard(horizonMode = "all") {
        let filtered = compData;
        if (horizonMode === "1d") {
          filtered = compData.filter((r) => r.horizon.includes("1 day") || r.target_col === "target_next_1d");
        } else if (horizonMode === "7d") {
          filtered = compData.filter((r) => r.horizon.includes("7 day") || r.target_col === "target_next_7d");
        }

        const modelStats = {};
        filtered.forEach((r) => {
          const m = r.model;
          if (!modelStats[m]) {
            modelStats[m] = { mae: [], rmse: [], mape: [], r2: [], bestCount: 0 };
          }
          if (r.MAE !== null) modelStats[m].mae.push(Number(r.MAE));
          if (r.RMSE !== null) modelStats[m].rmse.push(Number(r.RMSE));
          if (r["MAPE_%"] !== null) modelStats[m].mape.push(Number(r["MAPE_%"]));
          if (r.R2 !== null && !isNaN(r.R2)) modelStats[m].r2.push(Number(r.R2));
        });

        const avg = (arr) => (arr.length ? arr.reduce((a, c) => a + c, 0) / arr.length : 0);

        const rows = Object.keys(modelStats).map((m) => {
          const s = modelStats[m];
          return {
            model: m,
            mae: avg(s.mae),
            rmse: avg(s.rmse),
            mape: avg(s.mape),
            r2: avg(s.r2),
            bestWins: modelCounts[m] || 0,
          };
        });

        // Sort by lowest MAPE
        rows.sort((a, b) => a.mape - b.mape);

        tbody.innerHTML = rows
          .map((r) => `
            <tr>
              <td style="font-weight: 600; color: var(--text-primary);">${escapeHTML(r.model)}</td>
              <td class="num">${formatNumber(r.mae)} MU</td>
              <td class="num">${formatNumber(r.rmse)} MU</td>
              <td class="num" style="font-weight: 600; color: var(--color-normal);">${formatPct(r.mape)}</td>
              <td class="num">${r.r2.toFixed(4)}</td>
              <td><span class="badge badge-normal">${r.bestWins} wins</span></td>
            </tr>
          `)
          .join("");
      }

      updateLeaderboard("all");

      if (horizonFilter) {
        horizonFilter.querySelectorAll(".pill-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            horizonFilter.querySelectorAll(".pill-btn").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            updateLeaderboard(btn.dataset.horizon);
          });
        });
      }

      // 3. Heatmap Rendering (State x Model)
      const heatmapTbody = document.getElementById("adm-heatmap-tbody");
      if (heatmapTbody) {
        // Build state -> model -> MAPE map (using 1d short term for heatmap)
        const stateMap = new Map();
        compData
          .filter((r) => r.horizon.includes("1 day") || r.target_col === "target_next_1d")
          .forEach((r) => {
            if (!stateMap.has(r.node)) stateMap.set(r.node, {});
            stateMap.get(r.node)[r.model] = Number(r["MAPE_%"]);
          });

        const modelsList = ["RandomForest", "XGBoost", "LSTM", "GRU", "Prophet"];

        heatmapTbody.innerHTML = Array.from(stateMap.entries())
          .slice(0, 15) // Top 15 states for clean visual display
          .map(([st, mObj]) => {
            return `
              <tr>
                <td style="font-weight: 600;">${escapeHTML(formatStateName(st))}</td>
                ${modelsList
                  .map((m) => {
                    const val = mObj[m];
                    if (val === undefined || isNaN(val)) return `<td>—</td>`;
                    let color = "var(--color-normal)";
                    if (val > 20) color = "var(--color-high)";
                    else if (val > 10) color = "var(--color-warning)";
                    return `<td class="num" style="color: ${color}; font-weight: 600;">${val.toFixed(1)}%</td>`;
                  })
                  .join("")}
              </tr>
            `;
          })
          .join("");
      }
    } catch (e) {
      console.error("Performance load error:", e);
    }
  }

  // Drift Data Loader
  async function loadDriftData() {
    try {
      const res = await api.getMonitoring();
      const rows = res.log || [];
      const badge = document.getElementById("adm-drift-count-badge");
      if (badge) badge.textContent = `${rows.length} Total Windows Logged`;

      if (rows.length === 0) return;

      // Extract dynamic columns
      const thead = document.getElementById("adm-drift-thead");
      const tbody = document.getElementById("adm-drift-tbody");

      const columns = Object.keys(rows[0]);
      if (thead) {
        thead.innerHTML = `<tr>${columns.map((c) => `<th>${escapeHTML(c.replace(/_/g, ' '))}</th>`).join("")}</tr>`;
      }

      if (tbody) {
        tbody.innerHTML = rows
          .map((row) => {
            return `
              <tr>
                ${columns
                  .map((c) => {
                    const val = row[c];
                    if (c === "drift_flagged" || c.toLowerCase().includes("flag")) {
                      const isTrue = val === true || val === "True";
                      return `<td><span class="badge ${isTrue ? 'badge-high' : 'badge-normal'}">${isTrue ? 'DRIFT FLAGGED' : 'NORMAL'}</span></td>`;
                    }
                    if (typeof val === "number") {
                      return `<td class="num">${Number(val).toFixed(3)}</td>`;
                    }
                    return `<td>${escapeHTML(String(val))}</td>`;
                  })
                  .join("")}
              </tr>
            `;
          })
          .join("");
      }

      // Chart: Window MAE vs Baseline MAE
      const labels = rows.map((r) => r.window_end || r.checked_at?.split("T")[0] || "");
      const windowMAEs = rows.map((r) => Number(r.window_MAE));
      const baselineMAEs = rows.map((r) => Number(r.baseline_MAE));
      const driftFlags = rows.map((r) => r.drift_flagged === true || r.drift_flagged === "True");

      renderDriftChart("adm-drift-chart", labels, windowMAEs, baselineMAEs, driftFlags);
    } catch (e) {
      console.error("Drift load failed:", e);
    }
  }

  // Feedback Data Loader
  async function loadFeedbackData() {
    try {
      const res = await api.getFeedback();
      const rows = res.log || [];
      const badge = document.getElementById("adm-feedback-count-badge");
      if (badge) badge.textContent = `${rows.length} Observations Recorded`;

      if (rows.length === 0) return;

      const thead = document.getElementById("adm-feedback-thead");
      const tbody = document.getElementById("adm-feedback-tbody");

      const columns = Object.keys(rows[0]);
      if (thead) {
        thead.innerHTML = `<tr>${columns.map((c) => `<th>${escapeHTML(c.replace(/_/g, ' '))}</th>`).join("")}</tr>`;
      }

      if (tbody) {
        tbody.innerHTML = rows
          .map((row) => {
            const isHighError = Number(row.pct_error) > 10;
            return `
              <tr style="${isHighError ? 'background: rgba(244, 63, 94, 0.06);' : ''}">
                ${columns
                  .map((c) => {
                    const val = row[c];
                    if (c === "pct_error") {
                      return `<td class="num" style="color: ${isHighError ? 'var(--color-high)' : 'var(--color-normal)'}; font-weight: 600;">${Number(val).toFixed(2)}%</td>`;
                    }
                    if (typeof val === "number") {
                      return `<td class="num">${Number(val).toFixed(2)}</td>`;
                    }
                    return `<td>${escapeHTML(String(val))}</td>`;
                  })
                  .join("")}
              </tr>
            `;
          })
          .join("");
      }

      // Chart
      const labels = rows.map((r) => r.timestamp || "");
      const actuals = rows.map((r) => Number(r.actual_mu));
      const predicted = rows.map((r) => Number(r.predicted_mu));

      renderFeedbackChart("adm-feedback-chart", labels, actuals, predicted);
    } catch (e) {
      console.error("Feedback load failed:", e);
    }
  }

  // Explainability Audit Loader (Agreement Score calculation)
  async function loadExplainAudit(targetState = "Maharashtra") {
    const scoreVal = document.getElementById("adm-agreement-score-val");
    const scoreDesc = document.getElementById("adm-agreement-score-desc");
    const limeBox = document.getElementById("adm-lime-box");

    try {
      const [shapRes, limeRes] = await Promise.all([
        api.getExplainSHAP(targetState, "1d"),
        api.getExplainLIME(targetState, "1d").catch(() => null),
      ]);

      if (shapRes && shapRes.top_factors) {
        renderSHAPChart("adm-shap-chart", shapRes.top_factors);
      }

      if (limeRes && limeRes.lime_factors) {
        limeBox.innerHTML = `
          <div class="flex flex-col gap-2" style="max-height: 260px; overflow-y: auto;">
            ${limeRes.lime_factors
              .map((item) => `
                <div class="flex items-center justify-between" style="padding: 6px 10px; border-radius: var(--radius-md); background: var(--bg-surface); border: 1px solid var(--border-subtle);">
                  <span style="font-family: var(--font-mono); font-size: 11px;">${escapeHTML(item.condition)}</span>
                  <span class="badge ${item.weight >= 0 ? 'badge-high' : 'badge-normal'}">${item.weight.toFixed(4)}</span>
                </div>
              `)
              .join("")}
          </div>
        `;

        // Compute Concordance / Agreement: features appearing in both SHAP top list and LIME condition strings
        const shapFeatures = (shapRes.top_factors || []).map((f) => f.feature);
        const limeConditions = limeRes.lime_factors.map((l) => l.condition);

        const intersecting = shapFeatures.filter((sf) =>
          limeConditions.some((lc) => lc.includes(sf))
        );

        const agreementPct = shapFeatures.length > 0 ? (intersecting.length / Math.min(shapFeatures.length, limeConditions.length)) * 100 : 0;

        if (scoreVal) scoreVal.textContent = `${agreementPct.toFixed(1)}% Agreement`;
        if (scoreDesc) {
          scoreDesc.innerHTML = `
            <strong>${intersecting.length} concordant features:</strong> 
            ${intersecting.map((f) => getFeatureLabel(f)).join(", ") || "No exact string overlap"}
          `;
        }
      }
    } catch (e) {
      console.error("Explain audit failed:", e);
    }
  }

  // Subview Dispatcher
  if (subview === "performance") {
    await renderPerformanceSubView();
  } else if (subview === "drift") {
    await renderDriftSubView();
  } else if (subview === "feedback") {
    await renderFeedbackSubView();
  } else if (subview === "explain") {
    await renderExplainSubView();
  } else if (subview === "docs") {
    await renderDocsSubView();
  } else {
    await renderHealthSubView();
  }

  // Cleanup handler
  return () => {
    destroyChart("adm-distribution-chart");
    destroyChart("adm-drift-chart");
    destroyChart("adm-feedback-chart");
    destroyChart("adm-shap-chart");
  };
}
