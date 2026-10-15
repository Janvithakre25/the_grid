/**
 * THE GRID: PARAMETRIZED ROLE-BRANDED LOGIN PORTAL
 * portal.js
 */

import { ROLES, DEMO_CREDENTIALS, setSession, getDashboardRouteForRole } from "../auth.js";
import { api } from "../api.js";
import { escapeHTML, toggleTheme, getTheme, showToast } from "../ui.js";

const PORTAL_CONFIG = {
  admin: {
    expectedRole: ROLES.ADMIN,
    themeClass: "theme-admin",
    badgeText: "System Governance",
    headline: "System Control & Governance",
    subtitle: "Enterprise model validation, drift detection & security oversight.",
    demoUser: DEMO_CREDENTIALS[ROLES.ADMIN],
    canvasMode: "matrix",
    accentColor: "#a855f7",
  },
  operator: {
    expectedRole: ROLES.OPERATOR,
    themeClass: "theme-operator",
    badgeText: "Grid Dispatch",
    headline: "Live Operations & Decision Support",
    subtitle: "Real-time dispatch guidance, India stress cartogram & XAI diagnostics.",
    demoUser: DEMO_CREDENTIALS[ROLES.OPERATOR],
    canvasMode: "waveform",
    accentColor: "#06b6d4",
  },
  utility: {
    expectedRole: ROLES.UTILITY,
    themeClass: "theme-utility",
    badgeText: "Utility Planning",
    headline: "Planning, Demand & Business Insights",
    subtitle: "Multi-horizon demand analytics, seasonal profiling & portfolio tracking.",
    demoUser: DEMO_CREDENTIALS[ROLES.UTILITY],
    canvasMode: "curves",
    accentColor: "#10b981",
  },
};

export function renderPortal(container, roleKey) {
  const config = PORTAL_CONFIG[roleKey] || PORTAL_CONFIG.operator;
  const theme = getTheme();

  container.innerHTML = `
    <div class="portal-container ${config.themeClass} animate-fade-in" data-role="${config.expectedRole}">
      <canvas id="portal-bg-canvas" class="portal-canvas-bg"></canvas>

      <!-- Back to chooser & theme toggle -->
      <div style="position: absolute; top: 1.5rem; left: 2rem; right: 2rem; display: flex; justify-content: space-between; align-items: center; z-index: 10;">
        <a href="#/" class="btn btn-secondary btn-sm" aria-label="Return to Role Chooser">
          ← Back to Role Chooser
        </a>
        <button id="portal-theme-toggle" class="btn-icon" aria-label="Toggle Theme">
          ${theme === "dark" ? "☀️" : "🌙"}
        </button>
      </div>

      <!-- Portal Card -->
      <div class="portal-card animate-slide-up">
        <div class="portal-badge">
          <span class="badge-dot" style="background: currentColor;"></span>
          ${escapeHTML(config.badgeText)}
        </div>

        <h1 class="portal-title">${escapeHTML(config.headline)}</h1>
        <p class="portal-subtitle">${escapeHTML(config.subtitle)}</p>

        <!-- Demo Account Chip -->
        <div class="demo-chip" id="demo-chip-btn" role="button" tabindex="0" title="Click to fill test credentials">
          <span aria-hidden="true">🔑</span>
          <span>Fill Demo: <strong>${escapeHTML(config.demoUser.username)}</strong></span>
        </div>

        <!-- Error Notification Area -->
        <div id="portal-error-box" style="display: none; padding: 0.75rem; border-radius: var(--radius-md); background: rgba(244, 63, 94, 0.15); border: 1px solid var(--color-high); color: var(--color-high); font-size: var(--text-sm); margin-bottom: var(--space-4);" role="alert"></div>

        <form id="portal-login-form" novalidate>
          <div class="form-group">
            <label class="form-label" for="portal-username">Username</label>
            <input
              type="text"
              id="portal-username"
              class="input"
              placeholder="Enter username"
              autocomplete="username"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="portal-password">Password</label>
            <div class="password-wrapper">
              <input
                type="password"
                id="portal-password"
                class="input"
                placeholder="Enter password"
                autocomplete="current-password"
                required
              />
              <button type="button" id="toggle-pw-visibility" class="toggle-password-btn" aria-label="Show password">
                👁️
              </button>
            </div>
          </div>

          <button type="submit" id="portal-submit-btn" class="btn btn-primary" style="width: 100%; margin-top: var(--space-3); padding: 0.75rem;">
            <span>Sign In to ${escapeHTML(config.expectedRole)}</span>
          </button>
        </form>

        <div style="margin-top: var(--space-6); text-align: center; font-size: var(--text-xs); color: var(--text-muted);">
          Protected under POSOCO Central RBAC Security Layer • JWT 256-bit
        </div>
      </div>
    </div>
  `;

  // Attach DOM Listeners
  const themeBtn = container.querySelector("#portal-theme-toggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const next = toggleTheme();
      themeBtn.textContent = next === "dark" ? "☀️" : "🌙";
    });
  }

  const usernameInput = container.querySelector("#portal-username");
  const passwordInput = container.querySelector("#portal-password");
  const demoChip = container.querySelector("#demo-chip-btn");
  const pwToggleBtn = container.querySelector("#toggle-pw-visibility");
  const form = container.querySelector("#portal-login-form");
  const submitBtn = container.querySelector("#portal-submit-btn");
  const errorBox = container.querySelector("#portal-error-box");

  // Prefill via Demo chip
  if (demoChip) {
    const handleDemoClick = () => {
      usernameInput.value = config.demoUser.username;
      passwordInput.value = config.demoUser.password;
      errorBox.style.display = "none";
      usernameInput.focus();
    };
    demoChip.addEventListener("click", handleDemoClick);
    demoChip.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleDemoClick();
      }
    });
  }

  // Toggle password visibility
  if (pwToggleBtn) {
    pwToggleBtn.addEventListener("click", () => {
      const isPassword = passwordInput.type === "password";
      passwordInput.type = isPassword ? "text" : "password";
      pwToggleBtn.textContent = isPassword ? "🙈" : "👁️";
    });
  }

  // Form Submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.style.display = "none";

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      errorBox.textContent = "Please enter both username and password.";
      errorBox.style.display = "block";
      return;
    }

    // Set Loading State
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner"></span> <span>Verifying credentials...</span>`;

    try {
      const res = await api.login(username, password);

      // Core Security & Persona Rule: Compare returned role with expected portal role!
      if (res.role !== config.expectedRole) {
        // Discard token, stay on portal, show specific message
        errorBox.textContent = `This account doesn't have access to the ${config.expectedRole} portal.`;
        errorBox.style.display = "block";
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Sign In to ${escapeHTML(config.expectedRole)}</span>`;
        return;
      }

      // Success! Set session and navigate to respective role dashboard
      setSession(res.access_token, {
        username: res.username,
        name: res.name,
        role: res.role,
      });

      showToast(`Welcome, ${res.name}`, "success");
      const targetRoute = getDashboardRouteForRole(res.role);
      window.location.hash = targetRoute;
    } catch (err) {
      errorBox.textContent = err.message || "Invalid username or password";
      errorBox.style.display = "block";
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Sign In to ${escapeHTML(config.expectedRole)}</span>`;
    }
  });

  // Background Canvas Animation (Variant according to portal)
  const canvas = container.querySelector("#portal-bg-canvas");
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

    let step = 0;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      step += 0.02;

      if (config.canvasMode === "waveform") {
        // Cyan Power Grid Waveform
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        for (let x = 0; x < width; x += 6) {
          const y = height / 2 + Math.sin(x * 0.008 + step) * 50 + Math.sin(x * 0.02 + step * 1.5) * 20;
          ctx.lineTo(x, y);
        }
        ctx.strokeStyle = "rgba(6, 182, 212, 0.2)";
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, height / 2 + 30);
        for (let x = 0; x < width; x += 6) {
          const y = height / 2 + 30 + Math.sin(x * 0.006 - step) * 40;
          ctx.lineTo(x, y);
        }
        ctx.strokeStyle = "rgba(14, 165, 233, 0.15)";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (config.canvasMode === "matrix") {
        // Violet Governance Particle Matrix
        ctx.fillStyle = "rgba(168, 85, 247, 0.12)";
        for (let x = 30; x < width; x += 60) {
          for (let y = 30; y < height; y += 60) {
            const size = Math.sin((x + y) * 0.02 + step) * 2 + 2;
            ctx.beginPath();
            ctx.arc(x, y, Math.max(0.5, size), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else {
        // Emerald / Amber Demand Analytics Curves
        ctx.beginPath();
        ctx.moveTo(0, height * 0.7);
        for (let x = 0; x < width; x += 8) {
          const y = height * 0.7 - (x / width) * 120 + Math.sin(x * 0.005 + step) * 35;
          ctx.lineTo(x, y);
        }
        ctx.strokeStyle = "rgba(16, 185, 129, 0.22)";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", onResize);
      if (animId) cancelAnimationFrame(animId);
    };
  }

  return () => {};
}
