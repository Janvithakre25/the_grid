/**
 * THE GRID: AUTHENTICATION & SESSION MANAGEMENT
 * auth.js
 */

export const ROLES = {
  ADMIN: "Administrator",
  OPERATOR: "Grid Operator",
  UTILITY: "Utility Company",
};

export const DEMO_CREDENTIALS = {
  [ROLES.ADMIN]: { username: "admin", password: "admin123", name: "System Administrator" },
  [ROLES.OPERATOR]: { username: "operator", password: "operator123", name: "Central Grid Dispatcher" },
  [ROLES.UTILITY]: { username: "utility", password: "utility123", name: "State Power Utility Planner" },
};

// In-memory token storage (backed by sessionStorage)
let inMemoryToken = null;
let inMemoryUser = null;

const STORAGE_KEY_TOKEN = "thegrid_access_token";
const STORAGE_KEY_USER = "thegrid_user_data";

export function initAuth() {
  const token = sessionStorage.getItem(STORAGE_KEY_TOKEN);
  const rawUser = sessionStorage.getItem(STORAGE_KEY_USER);

  if (token && rawUser) {
    try {
      inMemoryToken = token;
      inMemoryUser = JSON.parse(rawUser);
    } catch (e) {
      clearSession();
    }
  }
}

export function getToken() {
  return inMemoryToken || sessionStorage.getItem(STORAGE_KEY_TOKEN);
}

export function getCurrentUser() {
  if (inMemoryUser) return inMemoryUser;
  const raw = sessionStorage.getItem(STORAGE_KEY_USER);
  if (raw) {
    try {
      inMemoryUser = JSON.parse(raw);
      return inMemoryUser;
    } catch (e) {
      return null;
    }
  }
  return null;
}

export function isAuthenticated() {
  return !!getToken();
}

export function hasRole(role) {
  const user = getCurrentUser();
  return !!user && user.role === role;
}

/**
 * Saves auth session upon successful login
 */
export function setSession(token, user) {
  inMemoryToken = token;
  inMemoryUser = user;
  sessionStorage.setItem(STORAGE_KEY_TOKEN, token);
  sessionStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
}

/**
 * Completely clears auth session
 */
export function clearSession() {
  inMemoryToken = null;
  inMemoryUser = null;
  sessionStorage.removeItem(STORAGE_KEY_TOKEN);
  sessionStorage.removeItem(STORAGE_KEY_USER);
}

/**
 * Maps a role string to its dashboard root route
 */
export function getDashboardRouteForRole(role) {
  switch (role) {
    case ROLES.ADMIN:
      return "#/admin/app";
    case ROLES.OPERATOR:
      return "#/operator/app";
    case ROLES.UTILITY:
      return "#/utility/app";
    default:
      return "#/";
  }
}

/**
 * Maps a role string to its portal login route
 */
export function getPortalRouteForRole(role) {
  switch (role) {
    case ROLES.ADMIN:
      return "#/admin";
    case ROLES.OPERATOR:
      return "#/operator";
    case ROLES.UTILITY:
      return "#/utility";
    default:
      return "#/";
  }
}
