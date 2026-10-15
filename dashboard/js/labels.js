/**
 * THE GRID: LABELS & FORMATTING DICTIONARY
 * labels.js
 */

export const FEATURE_LABELS = {
  // Lags
  "lag_1d": "Load 1 day ago",
  "lag_7d": "Load 7 days ago",
  "lag_30d": "Load 30 days ago",

  // Rolling statistics
  "roll_mean_7d": "7-day average load",
  "roll_std_7d": "7-day load volatility (std dev)",
  "roll_mean_30d": "30-day average load",
  "roll_std_30d": "30-day load volatility (std dev)",

  // Weather & Calendar
  "temperature_c": "Ambient Temperature",
  "humidity": "Relative Humidity",
  "is_holiday": "Public Holiday",
  "is_weekend": "Weekend Indicator",

  // Cyclical time encodings
  "dow_sin": "Day of week (sine component)",
  "dow_cos": "Day of week (cosine component)",
  "month_sin": "Month of year (sine component)",
  "month_cos": "Month of year (cosine component)",
  "doy_sin": "Day of year (sine component)",
  "doy_cos": "Day of year (cosine component)",
};

/**
 * Returns a human-friendly feature label with fallback.
 */
export function getFeatureLabel(rawFeature) {
  if (!rawFeature) return "";
  if (FEATURE_LABELS[rawFeature]) return FEATURE_LABELS[rawFeature];

  // Dynamic patterns: lag_Xd -> Load X days ago
  const lagMatch = rawFeature.match(/^lag_(\d+)d$/);
  if (lagMatch) return `Load ${lagMatch[1]} days ago`;

  // Dynamic patterns: roll_mean_Xd -> X-day average load
  const meanMatch = rawFeature.match(/^roll_mean_(\d+)d$/);
  if (meanMatch) return `${meanMatch[1]}-day average load`;

  // Dynamic patterns: roll_std_Xd -> X-day load volatility
  const stdMatch = rawFeature.match(/^roll_std_(\d+)d$/);
  if (stdMatch) return `${stdMatch[1]}-day load volatility`;

  // Graceful fallback: replace underscores with spaces and title case
  return rawFeature
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * State code dictionary for cartogram representation
 */
export const STATE_CODES = {
  "Andhra_Pradesh": "AP",
  "Arunachal_Pradesh": "AR",
  "Assam": "AS",
  "Bihar": "BR",
  "Chandigarh": "CH",
  "Chhattisgarh": "CT",
  "DNH": "DNH",
  "Delhi": "DL",
  "Goa": "GA",
  "Gujarat": "GJ",
  "HP": "HP",
  "Haryana": "HR",
  "JandK": "JK",
  "Jharkhand": "JH",
  "Karnataka": "KA",
  "Kerala": "KL",
  "MP": "MP",
  "Maharashtra": "MH",
  "Manipur": "MN",
  "Meghalaya": "ML",
  "Mizoram": "MZ",
  "Nagaland": "NL",
  "Odisha": "OD",
  "Pondy": "PY",
  "Punjab": "PB",
  "Rajasthan": "RJ",
  "Sikkim": "SK",
  "Tamil_Nadu": "TN",
  "Telangana": "TG",
  "Tripura": "TR",
  "UP": "UP",
  "Uttarakhand": "UK",
  "West_Bengal": "WB"
};

/**
 * Friendly display names for state acronyms and underscored names
 */
export const STATE_NAMES = {
  "Andhra_Pradesh": "Andhra Pradesh",
  "Arunachal_Pradesh": "Arunachal Pradesh",
  "Assam": "Assam",
  "Bihar": "Bihar",
  "Chandigarh": "Chandigarh",
  "Chhattisgarh": "Chhattisgarh",
  "DNH": "Dadra & Nagar Haveli",
  "Delhi": "Delhi (NCT)",
  "Goa": "Goa",
  "Gujarat": "Gujarat",
  "HP": "Himachal Pradesh",
  "Haryana": "Haryana",
  "JandK": "Jammu & Kashmir",
  "Jharkhand": "Jharkhand",
  "Karnataka": "Karnataka",
  "Kerala": "Kerala",
  "MP": "Madhya Pradesh",
  "Maharashtra": "Maharashtra",
  "Manipur": "Manipur",
  "Meghalaya": "Meghalaya",
  "Mizoram": "Mizoram",
  "Nagaland": "Nagaland",
  "Odisha": "Odisha",
  "Pondy": "Puducherry",
  "Punjab": "Punjab",
  "Rajasthan": "Rajasthan",
  "Sikkim": "Sikkim",
  "Tamil_Nadu": "Tamil Nadu",
  "Telangana": "Telangana",
  "Tripura": "Tripura",
  "UP": "Uttar Pradesh",
  "Uttarakhand": "Uttarakhand",
  "West_Bengal": "West Bengal"
};

/**
 * Converts state code/id into user-friendly display name
 */
export function formatStateName(stateId) {
  if (!stateId) return "";
  if (STATE_NAMES[stateId]) return STATE_NAMES[stateId];
  return stateId.replace(/_/g, " ");
}

/**
 * Returns short 2/3-letter code for state
 */
export function getStateCode(stateId) {
  if (STATE_CODES[stateId]) return STATE_CODES[stateId];
  return stateId.substring(0, 2).toUpperCase();
}
