/**
 * THE GRID: APPLICATION ENTRYPOINT & INITIALIZER
 * main.js
 */

import { initAuth } from "./auth.js";
import { initTheme } from "./ui.js";
import { registerRoute, initRouter, handleRouteChange } from "./router.js";
import { renderLanding } from "./views/landing.js";
import { renderPortal } from "./views/portal.js";
import { renderOperatorApp } from "./views/operator.js";
import { renderUtilityApp } from "./views/utility.js";
import { renderAdminApp } from "./views/admin.js";

// Bootstrap application on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize Theme (Dark default)
  initTheme();

  // 2. Initialize Session
  initAuth();

  // 3. Register Hash Routes
  registerRoute("/", (container, parsed) => {
    return renderLanding(container, parsed);
  });

  registerRoute("/portal", (container, roleKey, parsed) => {
    return renderPortal(container, roleKey, parsed);
  });

  registerRoute("/operator/app", (container, subview, parsed) => {
    return renderOperatorApp(container, subview, parsed);
  });

  registerRoute("/utility/app", (container, subview, parsed) => {
    return renderUtilityApp(container, subview, parsed);
  });

  registerRoute("/admin/app", (container, subview, parsed) => {
    return renderAdminApp(container, subview, parsed);
  });

  // 4. Initialize Hash Router & Route Guards
  initRouter();

  // 5. Global Theme change listener
  window.addEventListener("theme-changed", () => {
    // Re-render active view smoothly to update chart theme palettes
    handleRouteChange();
  });
});
