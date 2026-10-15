/**
 * THE GRID: CLIENT-SIDE HASH ROUTER & ROLE GUARDS
 * router.js
 */

import { isAuthenticated, getCurrentUser, ROLES, getDashboardRouteForRole, getPortalRouteForRole } from "./auth.js";
import { store } from "./store.js";

// Registered route handlers: routePattern -> renderFunction
const routes = new Map();
let currentViewCleanup = null;

export function registerRoute(pattern, handler) {
  routes.set(pattern, handler);
}

export function parseHash() {
  const hash = window.location.hash || "#/";
  const clean = hash.startsWith("#") ? hash.substring(1) : hash;
  const parts = clean.split("/").filter(Boolean);
  return {
    raw: hash,
    path: "/" + parts.join("/"),
    parts,
  };
}

export function navigateTo(hash) {
  if (window.location.hash === hash) {
    handleRouteChange();
  } else {
    window.location.hash = hash;
  }
}

/**
 * Role Route Guard: validates authentication and permissions
 */
function guardRoute(parsed) {
  const { parts } = parsed;
  const authed = isAuthenticated();
  const user = getCurrentUser();

  // 1. Dashboard routes: /<roleKey>/app...
  if (parts.length >= 2 && parts[1] === "app") {
    const roleKey = parts[0]; // "admin" | "operator" | "utility"
    let expectedRole = null;
    if (roleKey === "admin") expectedRole = ROLES.ADMIN;
    else if (roleKey === "operator") expectedRole = ROLES.OPERATOR;
    else if (roleKey === "utility") expectedRole = ROLES.UTILITY;

    if (!authed) {
      // Redirect to the portal login for that role
      const portalRoute = roleKey ? `#/${roleKey}` : "#/";
      window.location.hash = portalRoute;
      return false;
    }

    if (user && expectedRole && user.role !== expectedRole) {
      // Redirect logged-in user to their own dashboard
      const ownDashboard = getDashboardRouteForRole(user.role);
      window.location.hash = ownDashboard;
      return false;
    }
  }

  return true;
}

/**
 * Core Route Change Dispatcher
 */
export async function handleRouteChange() {
  const parsed = parseHash();

  if (!guardRoute(parsed)) {
    return;
  }

  // Abort any ongoing network requests from previous view
  store.cancelActiveRequests();

  // Execute view cleanup if registered
  if (typeof currentViewCleanup === "function") {
    try {
      currentViewCleanup();
    } catch (e) {
      console.warn("Error running view cleanup:", e);
    }
    currentViewCleanup = null;
  }

  const appContainer = document.getElementById("app");
  if (!appContainer) return;

  const { parts } = parsed;

  // Route matching
  if (parts.length === 0 || (parts.length === 1 && parts[0] === "")) {
    // #/ Landing Page
    const handler = routes.get("/");
    if (handler) currentViewCleanup = await handler(appContainer, parsed);
  } else if (parts.length === 1 && ["admin", "operator", "utility"].includes(parts[0])) {
    // #/admin, #/operator, #/utility Login Portals
    const handler = routes.get("/portal");
    if (handler) currentViewCleanup = await handler(appContainer, parts[0], parsed);
  } else if (parts.length >= 2 && parts[1] === "app") {
    // #/admin/app, #/operator/app, #/utility/app
    const roleKey = parts[0];
    const subview = parts[2] || "default";
    const handler = routes.get(`/${roleKey}/app`);
    if (handler) currentViewCleanup = await handler(appContainer, subview, parsed);
  } else {
    // 404 / Fallback -> redirect to #/
    window.location.hash = "#/";
  }
}

export function initRouter() {
  window.addEventListener("hashchange", handleRouteChange);
  // Initial route handle
  handleRouteChange();
}
