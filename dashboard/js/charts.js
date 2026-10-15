/**
 * THE GRID: CHART.JS DATA VISUALIZATION ENGINE
 * charts.js
 */

import { formatMU, getTheme } from "./ui.js";
import { getFeatureLabel } from "./labels.js";

// Chart instance cache: canvasId -> ChartInstance
const chartInstances = new Map();

export function destroyChart(canvasId) {
  if (chartInstances.has(canvasId)) {
    try {
      chartInstances.get(canvasId).destroy();
    } catch (e) {
      console.warn(`Failed to destroy chart ${canvasId}:`, e);
    }
    chartInstances.delete(canvasId);
  }
}

export function resetChartZoom(canvasId) {
  if (chartInstances.has(canvasId)) {
    const chart = chartInstances.get(canvasId);
    if (typeof chart.resetZoom === "function") {
      chart.resetZoom();
    }
  }
}

function getThemePalette() {
  const isDark = getTheme() === "dark";
  return {
    gridColor: isDark ? "rgba(148, 163, 184, 0.08)" : "rgba(15, 23, 42, 0.06)",
    textColor: isDark ? "#94a3b8" : "#64748b",
    historyLine: isDark ? "#38bdf8" : "#0284c7",
    forecastPoint: "#f43f5e",
    bandFill: isDark ? "rgba(244, 63, 94, 0.15)" : "rgba(244, 63, 94, 0.12)",
    highThreshold: "rgba(239, 68, 68, 0.75)",
    lowThreshold: "rgba(59, 130, 246, 0.75)",
  };
}

/**
 * 1. FORECAST CHART (Grid Operator)
 */
export function renderForecastChart(canvasId, historyData, forecastData, options = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  destroyChart(canvasId);

  const theme = getThemePalette();
  const {
    ciEnabled = true,
    ciZ = 1.96,
    highThreshold = null,
    lowThreshold = null,
  } = options;

  // Build labels: historical dates + forecast date
  const labels = [...(historyData.dates || [])];
  const histValues = [...(historyData.consumption_mu || [])];

  // Calculate target forecast date label
  let forecastDateLabel = "Forecast (T+1d)";
  if (forecastData && forecastData.as_of) {
    const asOfParts = forecastData.as_of.split("-");
    const d = new Date(Date.UTC(parseInt(asOfParts[0]), parseInt(asOfParts[1]) - 1, parseInt(asOfParts[2])));
    const daysToAdd = forecastData.horizon === "7d" ? 7 : 1;
    d.setUTCDate(d.getUTCDate() + daysToAdd);
    forecastDateLabel = d.toISOString().split("T")[0];
  }
  labels.push(forecastDateLabel);

  // Pad history data with null for the forecast point
  const historySeries = [...histValues, null];

  // Forecast point series (null everywhere except last label)
  const forecastSeries = new Array(labels.length).fill(null);
  forecastSeries[labels.length - 1] = forecastData ? forecastData.predicted_mu : null;

  const datasets = [
    {
      label: "Historical Load (MU)",
      data: historySeries,
      borderColor: theme.historyLine,
      backgroundColor: "transparent",
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.15,
    },
    {
      label: `Forecast (${forecastData?.horizon || "1d"})`,
      data: forecastSeries,
      borderColor: theme.forecastPoint,
      backgroundColor: theme.forecastPoint,
      pointRadius: 7,
      pointHoverRadius: 9,
      pointStyle: "rectRot",
      showLine: false,
    },
  ];

  // Confidence Interval band
  if (ciEnabled && forecastData && forecastData.rmse !== null && forecastData.predicted_mu !== null) {
    const margin = ciZ * forecastData.rmse;
    const lowerVal = Math.max(0, forecastData.predicted_mu - margin);
    const upperVal = forecastData.predicted_mu + margin;

    const lowerSeries = new Array(labels.length).fill(null);
    const upperSeries = new Array(labels.length).fill(null);
    lowerSeries[labels.length - 1] = lowerVal;
    upperSeries[labels.length - 1] = upperVal;

    datasets.push({
      label: "CI Upper Bound",
      data: upperSeries,
      borderColor: "transparent",
      backgroundColor: "transparent",
      pointRadius: 4,
      pointHoverRadius: 4,
      pointStyle: "dash",
    });

    datasets.push({
      label: "CI Lower Bound",
      data: lowerSeries,
      borderColor: "transparent",
      backgroundColor: theme.bandFill,
      pointRadius: 4,
      pointHoverRadius: 4,
      pointStyle: "dash",
      fill: "-1",
    });
  }

  // Threshold lines as datasets spanning the entire series
  if (highThreshold !== null) {
    datasets.push({
      label: `P90 High Threshold (${formatMU(highThreshold)})`,
      data: new Array(labels.length).fill(highThreshold),
      borderColor: theme.highThreshold,
      borderDash: [5, 5],
      borderWidth: 1.5,
      pointRadius: 0,
      fill: false,
    });
  }

  if (lowThreshold !== null) {
    datasets.push({
      label: `P10 Low Threshold (${formatMU(lowThreshold)})`,
      data: new Array(labels.length).fill(lowThreshold),
      borderColor: theme.lowThreshold,
      borderDash: [5, 5],
      borderWidth: 1.5,
      pointRadius: 0,
      fill: false,
    });
  }

  const chart = new Chart(canvas, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: {
            boxWidth: 12,
            boxHeight: 12,
            color: theme.textColor,
            font: { family: "Inter", size: 11 },
          },
        },
        tooltip: {
          backgroundColor: "rgba(15, 22, 41, 0.95)",
          titleColor: "#f8fafc",
          bodyColor: "#94a3b8",
          borderColor: "rgba(148, 163, 184, 0.2)",
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx) => {
              if (ctx.parsed.y === null || ctx.parsed.y === undefined) return null;
              return `${ctx.dataset.label}: ${formatMU(ctx.parsed.y)}`;
            },
          },
        },
        zoom: {
          pan: { enabled: true, mode: "x" },
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: "x" },
        },
      },
      scales: {
        x: {
          grid: { color: theme.gridColor },
          ticks: {
            color: theme.textColor,
            maxTicksLimit: 10,
            font: { family: "IBM Plex Mono", size: 10 },
          },
        },
        y: {
          grid: { color: theme.gridColor },
          ticks: {
            color: theme.textColor,
            font: { family: "IBM Plex Mono", size: 11 },
            callback: (v) => `${v} MU`,
          },
        },
      },
    },
  });

  chartInstances.set(canvasId, chart);
  return chart;
}

/**
 * 2. SHAP EXPLAINABILITY BAR CHART
 */
export function renderSHAPChart(canvasId, topFactors) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  destroyChart(canvasId);

  const theme = getThemePalette();
  const sorted = [...(topFactors || [])].reverse(); // Smallest to largest for horizontal display

  const labels = sorted.map((f) => getFeatureLabel(f.feature));
  const values = sorted.map((f) => f.shap_impact);
  const colors = values.map((v) =>
    v >= 0 ? "rgba(244, 63, 94, 0.85)" : "rgba(16, 185, 129, 0.85)"
  );

  const chart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "SHAP Impact (MU)",
          data: values,
          backgroundColor: colors,
          borderRadius: 4,
          borderWidth: 0,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(15, 22, 41, 0.95)",
          callbacks: {
            label: (ctx) => {
              const item = sorted[ctx.dataIndex];
              const direction = ctx.parsed.x >= 0 ? "Increased forecast by" : "Reduced forecast by";
              return `${direction} ${Math.abs(ctx.parsed.x).toFixed(2)} MU (Feature Value: ${item.value})`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: theme.gridColor },
          ticks: {
            color: theme.textColor,
            font: { family: "IBM Plex Mono", size: 10 },
            callback: (v) => `${v > 0 ? "+" : ""}${v} MU`,
          },
        },
        y: {
          grid: { display: false },
          ticks: {
            color: theme.textColor,
            font: { family: "Inter", size: 11 },
          },
        },
      },
    },
  });

  chartInstances.set(canvasId, chart);
  return chart;
}

/**
 * 3. UTILITY OUTLOOK CHART (1d & 7d forward markers)
 */
export function renderUtilityOutlookChart(canvasId, historyData, forecast1d, forecast7d, options = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  destroyChart(canvasId);

  const theme = getThemePalette();
  const labels = [...(historyData.dates || [])];
  const histValues = [...(historyData.consumption_mu || [])];

  // Compute 1d and 7d target date labels
  const asOfStr = forecast1d?.as_of || forecast7d?.as_of || historyData.dates[historyData.dates.length - 1];
  const asOfParts = asOfStr.split("-");
  const d1 = new Date(Date.UTC(parseInt(asOfParts[0]), parseInt(asOfParts[1]) - 1, parseInt(asOfParts[2])));
  d1.setUTCDate(d1.getUTCDate() + 1);
  const label1d = d1.toISOString().split("T")[0];

  const d7 = new Date(Date.UTC(parseInt(asOfParts[0]), parseInt(asOfParts[1]) - 1, parseInt(asOfParts[2])));
  d7.setUTCDate(d7.getUTCDate() + 7);
  const label7d = d7.toISOString().split("T")[0];

  labels.push(label1d, label7d);

  const histSeries = [...histValues, null, null];
  const series1d = new Array(labels.length).fill(null);
  const series7d = new Array(labels.length).fill(null);

  series1d[labels.length - 2] = forecast1d ? forecast1d.predicted_mu : null;
  series7d[labels.length - 1] = forecast7d ? forecast7d.predicted_mu : null;

  const chart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Historical Consumption",
          data: histSeries,
          borderColor: theme.historyLine,
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.15,
        },
        {
          label: "1-Day Ahead Forecast",
          data: series1d,
          borderColor: "#06b6d4",
          backgroundColor: "#06b6d4",
          pointRadius: 8,
          pointStyle: "rectRot",
          showLine: false,
        },
        {
          label: "7-Day Ahead Forecast",
          data: series7d,
          borderColor: "#10b981",
          backgroundColor: "#10b981",
          pointRadius: 8,
          pointStyle: "triangle",
          showLine: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: { color: theme.textColor, font: { family: "Inter", size: 11 } },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ctx.parsed.y !== null ? `${ctx.dataset.label}: ${formatMU(ctx.parsed.y)}` : null,
          },
        },
      },
      scales: {
        x: {
          grid: { color: theme.gridColor },
          ticks: { color: theme.textColor, maxTicksLimit: 10, font: { family: "IBM Plex Mono", size: 10 } },
        },
        y: {
          grid: { color: theme.gridColor },
          ticks: { color: theme.textColor, font: { family: "IBM Plex Mono", size: 11 }, callback: (v) => `${v} MU` },
        },
      },
    },
  });

  chartInstances.set(canvasId, chart);
  return chart;
}

/**
 * 4. SEASONALITY BAR CHART
 */
export function renderSeasonalityChart(canvasId, monthLabels, monthValues) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  destroyChart(canvasId);

  const theme = getThemePalette();

  const chart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: monthLabels,
      datasets: [
        {
          label: "Average Load (MU)",
          data: monthValues,
          backgroundColor: "rgba(16, 185, 129, 0.75)",
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${formatMU(ctx.parsed.y)} avg` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: theme.textColor, font: { family: "Inter", size: 11 } } },
        y: { grid: { color: theme.gridColor }, ticks: { color: theme.textColor, callback: (v) => `${v} MU` } },
      },
    },
  });

  chartInstances.set(canvasId, chart);
  return chart;
}

/**
 * 5. WEEKDAY VS WEEKEND VS HOLIDAY CHART
 */
export function renderDayTypeChart(canvasId, values) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  destroyChart(canvasId);

  const theme = getThemePalette();

  const chart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: ["Weekday", "Weekend", "Holiday"],
      datasets: [
        {
          label: "Average Consumption",
          data: values,
          backgroundColor: [
            "rgba(56, 189, 248, 0.8)",
            "rgba(168, 85, 247, 0.8)",
            "rgba(245, 158, 11, 0.8)",
          ],
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${formatMU(ctx.parsed.y)} avg` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: theme.textColor } },
        y: { grid: { color: theme.gridColor }, ticks: { color: theme.textColor, callback: (v) => `${v} MU` } },
      },
    },
  });

  chartInstances.set(canvasId, chart);
  return chart;
}

/**
 * 6. TEMPERATURE VS LOAD SCATTER WITH TREND LINE
 */
export function renderWeatherScatterChart(canvasId, scatterPoints, regressionLine) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  destroyChart(canvasId);

  const theme = getThemePalette();

  const datasets = [
    {
      type: "scatter",
      label: "Historical Days",
      data: scatterPoints,
      backgroundColor: "rgba(6, 182, 212, 0.5)",
      pointRadius: 3,
    },
  ];

  if (regressionLine && regressionLine.length >= 2) {
    datasets.push({
      type: "line",
      label: "Trendline",
      data: regressionLine,
      borderColor: "#f43f5e",
      borderWidth: 2,
      pointRadius: 0,
      fill: false,
    });
  }

  const chart = new Chart(canvas, {
    type: "scatter",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: theme.textColor } },
        tooltip: {
          callbacks: {
            label: (ctx) => `Temp: ${ctx.parsed.x.toFixed(1)}°C, Load: ${formatMU(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          type: "linear",
          grid: { color: theme.gridColor },
          ticks: { color: theme.textColor, callback: (v) => `${v}°C` },
        },
        y: {
          grid: { color: theme.gridColor },
          ticks: { color: theme.textColor, callback: (v) => `${v} MU` },
        },
      },
    },
  });

  chartInstances.set(canvasId, chart);
  return chart;
}

/**
 * 7. BEST MODEL DISTRIBUTION CHART (Admin)
 */
export function renderModelDistributionChart(canvasId, counts) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  destroyChart(canvasId);

  const labels = Object.keys(counts);
  const data = Object.values(counts);

  const chart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: [
            "#10b981", // RF
            "#06b6d4", // XGB
            "#a855f7", // LSTM
            "#f59e0b", // Prophet
            "#ec4899", // GRU
          ],
          borderWidth: 2,
          borderColor: "#0f1629",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: { color: getThemePalette().textColor, font: { family: "Inter", size: 11 } },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${ctx.parsed} selections (${((ctx.parsed / data.reduce((a, b) => a + b, 0)) * 100).toFixed(1)}%)`,
          },
        },
      },
    },
  });

  chartInstances.set(canvasId, chart);
  return chart;
}

/**
 * 8. DRIFT TREND CHART (Admin)
 */
export function renderDriftChart(canvasId, labels, windowMAEs, baselineMAEs, driftFlags) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  destroyChart(canvasId);

  const theme = getThemePalette();

  const pointColors = driftFlags.map((flag) => (flag ? "#f43f5e" : "#06b6d4"));
  const pointRadii = driftFlags.map((flag) => (flag ? 7 : 3));

  const chart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Window MAE (MU)",
          data: windowMAEs,
          borderColor: "#06b6d4",
          backgroundColor: "transparent",
          pointBackgroundColor: pointColors,
          pointBorderColor: pointColors,
          pointRadius: pointRadii,
          borderWidth: 2,
          tension: 0.1,
        },
        {
          label: "Baseline MAE Threshold",
          data: baselineMAEs,
          borderColor: "rgba(244, 63, 94, 0.8)",
          borderDash: [6, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: theme.textColor } },
        tooltip: {
          callbacks: {
            afterLabel: (ctx) => (driftFlags[ctx.dataIndex] ? "⚠️ DRIFT TRIGGERED & RETRAINED" : "Within Tolerances"),
          },
        },
      },
      scales: {
        x: { grid: { color: theme.gridColor }, ticks: { color: theme.textColor, maxTicksLimit: 8 } },
        y: { grid: { color: theme.gridColor }, ticks: { color: theme.textColor, callback: (v) => `${v} MU` } },
      },
    },
  });

  chartInstances.set(canvasId, chart);
  return chart;
}

/**
 * 9. FEEDBACK LOOP ACCURACY CHART (Admin)
 */
export function renderFeedbackChart(canvasId, labels, actuals, predicted) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  destroyChart(canvasId);

  const theme = getThemePalette();

  const chart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Actual Consumption",
          data: actuals,
          borderColor: "#10b981",
          borderWidth: 2,
          pointRadius: 4,
          tension: 0.1,
        },
        {
          label: "Predicted Demand",
          data: predicted,
          borderColor: "#a855f7",
          borderDash: [4, 4],
          borderWidth: 2,
          pointRadius: 4,
          tension: 0.1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: theme.textColor } },
      },
      scales: {
        x: { grid: { color: theme.gridColor }, ticks: { color: theme.textColor } },
        y: { grid: { color: theme.gridColor }, ticks: { color: theme.textColor, callback: (v) => `${v} MU` } },
      },
    },
  });

  chartInstances.set(canvasId, chart);
  return chart;
}

/**
 * 10. MULTI-STATE COMPARISON OVERLAY
 */
export function renderCompareChart(canvasId, dates, seriesList, isNormalized = false) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  destroyChart(canvasId);

  const theme = getThemePalette();
  const palette = ["#06b6d4", "#a855f7", "#10b981", "#f59e0b", "#ec4899"];

  const datasets = seriesList.map((item, idx) => {
    let data = item.values;
    if (isNormalized && data.length > 0 && data[0] > 0) {
      const base = data[0];
      data = data.map((v) => (v / base) * 100);
    }
    return {
      label: item.label,
      data,
      borderColor: palette[idx % palette.length],
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1,
    };
  });

  const chart = new Chart(canvas, {
    type: "line",
    data: { labels: dates, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: theme.textColor } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${isNormalized ? ctx.parsed.y.toFixed(1) + "%" : formatMU(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: { grid: { color: theme.gridColor }, ticks: { color: theme.textColor, maxTicksLimit: 10 } },
        y: {
          grid: { color: theme.gridColor },
          ticks: {
            color: theme.textColor,
            callback: (v) => (isNormalized ? `${v}%` : `${v} MU`),
          },
        },
      },
    },
  });

  chartInstances.set(canvasId, chart);
  return chart;
}
