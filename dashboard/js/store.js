/**
 * THE GRID: CENTRAL STATE STORE & EVENT DISPATCHER
 * store.js
 */

export const Z_SCORES = {
  "0.80": 1.28,
  "0.90": 1.645,
  "0.95": 1.96,
};

const DEFAULT_PORTFOLIO_STATES = [
  "Maharashtra",
  "Gujarat",
  "Tamil_Nadu",
  "UP",
  "Karnataka",
  "Rajasthan",
];

const state = {
  states: [],
  currentState: "Maharashtra",
  currentHorizon: "1d",
  ciEnabled: true,
  ciLevel: "0.95",
  historyDays: 60,
  portfolioStates: JSON.parse(localStorage.getItem("thegrid_portfolio_states") || JSON.stringify(DEFAULT_PORTFOLIO_STATES)),
  stateOverviews: new Map(), // state -> overview object
  limeCache: new Map(),      // `${state}_${horizon}` -> lime factors
};

const listeners = new Map();

export const store = {
  get: (key) => state[key],

  set: (key, value) => {
    state[key] = value;
    if (key === "portfolioStates") {
      localStorage.setItem("thegrid_portfolio_states", JSON.stringify(value));
    }
    store.emit(key, value);
  },

  getAll: () => ({ ...state }),

  subscribe: (key, callback) => {
    if (!listeners.has(key)) {
      listeners.set(key, new Set());
    }
    listeners.get(key).add(callback);
    return () => listeners.get(key).delete(callback);
  },

  emit: (key, value) => {
    if (listeners.has(key)) {
      listeners.get(key).forEach((cb) => {
        try {
          cb(value);
        } catch (e) {
          console.error(`Error in store subscriber for '${key}':`, e);
        }
      });
    }
  },

  // Active AbortController for cancelable async operations
  activeAbortController: null,

  createAbortSignal: () => {
    if (store.activeAbortController) {
      store.activeAbortController.abort();
    }
    store.activeAbortController = new AbortController();
    return store.activeAbortController.signal;
  },

  cancelActiveRequests: () => {
    if (store.activeAbortController) {
      store.activeAbortController.abort();
      store.activeAbortController = null;
    }
  },
};
