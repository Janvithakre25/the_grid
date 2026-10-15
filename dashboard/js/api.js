/**
 * THE GRID: JWT-AWARE API LAYER & CONCURRENCY CONTROLLER
 * api.js
 */

import { getToken, clearSession, getCurrentUser, getPortalRouteForRole } from "./auth.js";
import { showToast } from "./ui.js";

// In-memory request cache: url -> { data, timestamp }
const apiCache = new Map();
const CACHE_TTL_MS = 30000; // 30 seconds

/**
 * Base fetch wrapper with JWT injection, caching, and error handling
 */
export async function apiFetch(endpoint, options = {}) {
  const {
    method = "GET",
    body = null,
    signal = null,
    noCache = false,
    headers = {},
  } = options;

  const url = endpoint.startsWith("http") ? endpoint : endpoint;
  const isGet = method.toUpperCase() === "GET";

  // Check cache for GET requests
  if (isGet && !noCache && apiCache.has(url)) {
    const cached = apiCache.get(url);
    if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
    apiCache.delete(url);
  }

  const reqHeaders = {
    "Accept": "application/json",
    ...headers,
  };

  const token = getToken();
  if (token && !endpoint.includes("/login")) {
    reqHeaders["Authorization"] = `Bearer ${token}`;
  }

  if (body && typeof body === "object" && !(body instanceof FormData)) {
    reqHeaders["Content-Type"] = "application/json";
  }

  try {
    const res = await fetch(url, {
      method,
      headers: reqHeaders,
      body: body && typeof body === "object" && !(body instanceof FormData) ? JSON.stringify(body) : body,
      signal,
    });

    if (res.status === 401) {
      clearSession();
      const currentUser = getCurrentUser();
      const portalRoute = currentUser ? getPortalRouteForRole(currentUser.role) : "#/";
      showToast("Session expired, please log in again", "error");
      window.location.hash = portalRoute;
      throw new Error("Unauthorized (401)");
    }

    if (res.status === 403) {
      showToast("Not permitted for your role", "error");
      throw new Error("Forbidden (403): Administrator role required");
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ detail: res.statusText }));
      const msg = errData.detail || `Request failed with status ${res.status}`;
      throw new Error(msg);
    }

    const data = await res.json();

    if (isGet && !noCache) {
      apiCache.set(url, { data, timestamp: Date.now() });
    }

    return data;
  } catch (err) {
    if (err.name === "AbortError") {
      throw err; // Propagate abort cleanly
    }
    throw err;
  }
}

/**
 * Concurrency-limited execution pool
 * Runs an array of task functions with a max concurrency of `limit` (default: 4)
 */
export async function runWithConcurrency(tasks, limit = 4, onProgress = null) {
  const results = new Array(tasks.length);
  let currentIndex = 0;
  let completed = 0;

  async function worker() {
    while (currentIndex < tasks.length) {
      const index = currentIndex++;
      try {
        results[index] = await tasks[index]();
      } catch (err) {
        results[index] = { error: err.message };
      }
      completed++;
      if (typeof onProgress === "function") {
        onProgress(completed, tasks.length);
      }
    }
  }

  const pool = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(pool);
  return results;
}

/**
 * Specialized API calls adhering to Backend Contract
 */
export const api = {
  // Auth
  login: async (username, password) => {
    return apiFetch("/login", {
      method: "POST",
      body: { username, password },
      noCache: true,
    });
  },

  getMe: async () => {
    return apiFetch("/me", { noCache: true });
  },

  // State list
  getStates: async () => {
    return apiFetch("/states");
  },

  // Forecast & History
  getForecast: async (state, horizon = "1d", modelName = "best", signal = null) => {
    const query = new URLSearchParams({ horizon, model_name: modelName });
    return apiFetch(`/forecast/${encodeURIComponent(state)}?${query.toString()}`, { signal });
  },

  getHistory: async (state, days = 60, signal = null) => {
    return apiFetch(`/history/${encodeURIComponent(state)}?days=${days}`, { signal });
  },

  // Explainability (XAI)
  getExplainSHAP: async (state, horizon = "1d", signal = null) => {
    return apiFetch(`/explain/${encodeURIComponent(state)}?horizon=${horizon}`, { signal });
  },

  getExplainLIME: async (state, horizon = "1d", signal = null) => {
    return apiFetch(`/explain_lime/${encodeURIComponent(state)}?horizon=${horizon}`, { signal });
  },

  // Recommendations & Severity
  getRecommend: async (state, horizon = "1d", signal = null) => {
    return apiFetch(`/recommend/${encodeURIComponent(state)}?horizon=${horizon}`, { signal });
  },

  // Optional All-States Overview Endpoint (falls back gracefully)
  getOverview: async (signal = null) => {
    return apiFetch("/overview", { signal });
  },

  // Administrator Endpoints (RBAC Protected: HTTP 403 for non-admins)
  getMonitoring: async () => {
    return apiFetch("/monitoring", { noCache: true });
  },

  getFeedback: async () => {
    return apiFetch("/feedback", { noCache: true });
  },

  getModelComparison: async () => {
    return apiFetch("/model_comparison");
  },

  getBestModels: async () => {
    return apiFetch("/best_models");
  },
};
