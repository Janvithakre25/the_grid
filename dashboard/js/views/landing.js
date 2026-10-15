/**
 * THE GRID: LANDING PAGE & ROLE CHOOSER VIEW
 * landing.js
 */

import { isAuthenticated, getCurrentUser, clearSession, getDashboardRouteForRole } from "../auth.js";
import { escapeHTML, toggleTheme, getTheme } from "../ui.js";

export function renderLanding(container) {
  const authed = isAuthenticated();
  const user = getCurrentUser();
  const theme = getTheme();

  container.innerHTML = `
    <div class="landing-view animate-fade-in">
      <canvas id="landing-canvas" class="portal-canvas-bg"></canvas>

      <!-- Top Header Bar -->
      <header style="position: absolute; top: 0; left: 0; right: 0; padding: 1.25rem 2rem; display: flex; justify-content: space-between; align-items: center; z-index: 10;">
        <div class="flex items-center gap-3">
          <div class="brand-glyph" style="background: linear-gradient(135deg, #06b6d4, #a855f7);">⚡</div>
          <span style="font-weight: 700; font-size: 1.1rem; letter-spacing: -0.02em;">THE GRID</span>
        </div>

        <div class="flex items-center gap-3">
          <button id="theme-toggle-btn" class="btn-icon" aria-label="Toggle theme">
            ${theme === "dark" ? "☀️" : "🌙"}
          </button>
          ${authed && user ? `
            <a href="${getDashboardRouteForRole(user.role)}" class="btn btn-primary btn-sm">
              Dashboard (${escapeHTML(user.role)}) →
            </a>
            <button id="landing-logout-btn" class="btn btn-secondary btn-sm">Sign Out</button>
          ` : ""}
        </div>
      </header>

      <!-- Hero Section -->
      <div class="landing-hero animate-slide-up">
        <div class="landing-badge">
          <span class="badge-dot" style="background: #10b981;"></span>
          33 Indian States & UTs • 5 Machine Learning Architectures • Real-Time XAI
        </div>
        <h1 class="landing-title">
          AI Energy Consumption Forecasting & Smart Grid Optimization
        </h1>
        <p class="landing-subtitle">
          Empowering grid operators, utility planners, and system administrators with precision load predictions, game-theoretic SHAP/LIME explainability, and automated decision-support protocols.
        </p>
      </div>

      <!-- Role Selection Cards -->
      <div class="role-cards-grid animate-slide-up" style="animation-delay: 100ms;">
        
        <!-- Administrator Card -->
        <a href="#/admin" class="role-card admin" role="button" aria-label="Access Administrator Portal">
          <div class="role-icon-box">🛡️</div>
          <h2 class="role-card-title">Administrator</h2>
          <p class="role-card-desc">
            System Control & Governance. Model leaderboard across 330 evaluations, continuous drift telemetry, feedback loop tracking, and verifiable architectural documentation.
          </p>
          <div class="role-card-cta">
            Enter Admin Portal <span>→</span>
          </div>
        </a>

        <!-- Grid Operator Card -->
        <a href="#/operator" class="role-card operator" role="button" aria-label="Access Grid Operator Portal">
          <div class="role-icon-box">⚡</div>
          <h2 class="role-card-title">Grid Operator</h2>
          <p class="role-card-desc">
            Live Operations & Decision Support. 33-state stress cartogram, real-time load dispatch alerts, empirical confidence bounds, and side-by-side SHAP/LIME diagnostics.
          </p>
          <div class="role-card-cta">
            Enter Operations Portal <span>→</span>
          </div>
        </a>

        <!-- Utility Company Card -->
        <a href="#/utility" class="role-card utility" role="button" aria-label="Access Utility Company Portal">
          <div class="role-icon-box">📈</div>
          <h2 class="role-card-title">Utility Company</h2>
          <p class="role-card-desc">
            Planning, Demand & Business Insights. 7-day medium-term forward outlooks, client-side demand seasonality, weather-load regressions, and multi-state portfolio management.
          </p>
          <div class="role-card-cta">
            Enter Utility Portal <span>→</span>
          </div>
        </a>

      </div>

      <footer style="margin-top: var(--space-10); z-index: 2; font-size: var(--text-xs); color: var(--text-muted); text-align: center;">
        Platform powered by Central Electricity Authority & POSOCO Open Data Pipeline • Open-Meteo Weather Model
      </footer>
    </div>
  `;

  // Attach event handlers
  const themeBtn = container.querySelector("#theme-toggle-btn");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const next = toggleTheme();
      themeBtn.textContent = next === "dark" ? "☀️" : "🌙";
    });
  }

  const logoutBtn = container.querySelector("#landing-logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearSession();
      renderLanding(container);
    });
  }

  // Animated background canvas (subtle power nodes)
  const canvas = container.querySelector("#landing-canvas");
  let animId = null;

  if (canvas) {
    const ctx = canvas.getContext("2d");
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    const nodes = Array.from({ length: 45 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      radius: Math.random() * 2 + 1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw connection lines
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 140) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(148, 163, 184, ${0.12 * (1 - dist / 140)})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // Draw and update nodes
      for (const node of nodes) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(148, 163, 184, 0.4)";
        ctx.fill();

        node.x += node.vx;
        node.y += node.vy;

        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    // Return cleanup callback
    return () => {
      window.removeEventListener("resize", onResize);
      if (animId) cancelAnimationFrame(animId);
    };
  }

  return () => {};
}
