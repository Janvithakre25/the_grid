/**
 * THE GRID: UI UTILITIES & FORMATTERS
 * ui.js
 */

/**
 * Escapes any raw string to prevent HTML injection (XSS protection)
 */
export function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Format numbers according to Indian numbering system (en-IN)
 */
const inFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inIntFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});

export function formatNumber(val, decimals = 2) {
  if (val === null || val === undefined || isNaN(val)) return "N/A";
  if (decimals === 0) return inIntFormatter.format(val);
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
}

export function formatMU(val, decimals = 2) {
  if (val === null || val === undefined || isNaN(val)) return "N/A";
  return `${formatNumber(val, decimals)} MU`;
}

export function formatPct(val, decimals = 2) {
  if (val === null || val === undefined || isNaN(val)) return "N/A";
  return `${formatNumber(val, decimals)}%`;
}

export function formatTemp(val) {
  if (val === null || val === undefined || isNaN(val)) return "N/A";
  return `${Number(val).toFixed(1)}°C`;
}

/**
 * Formats ISO YYYY-MM-DD or datetime to "DD MMM YYYY"
 */
export function formatDate(dateStr) {
  if (!dateStr) return "N/A";
  try {
    const parts = String(dateStr).split("T")[0].split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(Date.UTC(year, month, day));
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? String(dateStr) : d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch (e) {
    return String(dateStr);
  }
}

/**
 * Toast Notification System
 */
let toastContainer = null;

function ensureToastContainer() {
  if (!toastContainer) {
    toastContainer = document.getElementById("toast-container");
    if (!toastContainer) {
      toastContainer = document.createElement("div");
      toastContainer.id = "toast-container";
      toastContainer.setAttribute("aria-live", "polite");
      document.body.appendChild(toastContainer);
    }
  }
  return toastContainer;
}

export function showToast(message, type = "info", duration = 4000) {
  const container = ensureToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.setAttribute("role", "status");

  let icon = "ℹ️";
  if (type === "success") icon = "✅";
  if (type === "error") icon = "⚠️";
  if (type === "warning") icon = "🔔";

  toast.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${icon}</span>
    <span class="toast-text">${escapeHTML(message)}</span>
    <button type="button" class="btn-ghost btn-sm" style="margin-left:auto;padding:2px 6px;" aria-label="Close">✕</button>
  `;

  const closeBtn = toast.querySelector("button");
  closeBtn.addEventListener("click", () => {
    toast.remove();
  });

  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => {
      if (toast.isConnected) {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(8px)";
        toast.style.transition = "all 0.25s ease-out";
        setTimeout(() => toast.remove(), 250);
      }
    }, duration);
  }
}

/**
 * Theme Manager
 */
export function initTheme() {
  const saved = localStorage.getItem("thegrid_theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  return saved;
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("thegrid_theme", next);
  window.dispatchEvent(new CustomEvent("theme-changed", { detail: { theme: next } }));
  return next;
}

export function getTheme() {
  return document.documentElement.getAttribute("data-theme") || "dark";
}

/**
 * CSV Export Utility
 */
export function exportToCSV(filename, headers, rows) {
  const headerRow = headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(",");
  const bodyRows = rows.map(row =>
    row.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
  );
  const csvContent = "data:text/csv;charset=utf-8," + [headerRow, ...bodyRows].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * PNG Export Utility: captures a DOM container or canvas
 */
export async function exportElementToPNG(elementId, filename = "dashboard-view") {
  const elem = document.getElementById(elementId);
  if (!elem) {
    showToast("Export target not found", "error");
    return;
  }

  // If the element has a Chart.js canvas inside, we can export the canvas image
  const canvas = elem.querySelector("canvas");
  if (canvas) {
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${filename}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast("Chart exported successfully as PNG", "success");
      return;
    } catch (e) {
      console.warn("Direct canvas export failed, attempting svg/print fallback", e);
    }
  }

  // Fallback: print view
  window.print();
}

/**
 * Skeleton Loader Generators
 */
export function renderCardSkeleton(count = 4) {
  return Array.from({ length: count })
    .map(() => `
      <div class="kpi-card">
        <div class="skeleton skeleton-text" style="width: 40%; height: 12px;"></div>
        <div class="skeleton skeleton-text" style="width: 75%; height: 32px; margin-top: 8px;"></div>
        <div class="skeleton skeleton-text" style="width: 50%; height: 10px; margin-top: 8px;"></div>
      </div>
    `)
    .join("");
}

export function renderTableSkeleton(rows = 5, cols = 4) {
  return Array.from({ length: rows })
    .map(() => `
      <tr>
        ${Array.from({ length: cols }).map(() => `
          <td><div class="skeleton skeleton-text" style="width: 80%; height: 14px;"></div></td>
        `).join("")}
      </tr>
    `)
    .join("");
}
