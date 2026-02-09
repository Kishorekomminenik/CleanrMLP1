export const FONT_OPTIONS = ["Inter", "Roboto", "Arial", "Monospace"];
export const SIZE_OPTIONS = [10, 12, 14, 16, 18, 24, 32];
export const WEIGHT_OPTIONS = ["Regular", "Medium", "Bold"];
export const COLOR_OPTIONS = ["#FF0000", "#2563EB", "#F59E0B", "#111827", "#FFFFFF"];
export const OPACITY_OPTIONS = [1, 0.7];

export const DEFAULT_ANNOTATION_STYLE = {
  fontFamily: "Inter",
  fontSize: 14,
  fontWeight: "Regular",
  color: "#FF0000",
  opacity: 1,
};

const FONT_FAMILY_MAP = {
  Inter: "Inter, system-ui, Arial",
  Roboto: "Roboto, system-ui, Arial",
  Arial: "Arial, Helvetica",
  Monospace: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

const LEGACY_COLOR_MAP = {
  Red: "#FF0000",
  Blue: "#2563EB",
  Yellow: "#F59E0B",
  Black: "#111827",
  White: "#FFFFFF",
};

export function resolveFontFamily(fontFamily) {
  return FONT_FAMILY_MAP[fontFamily] || FONT_FAMILY_MAP[DEFAULT_ANNOTATION_STYLE.fontFamily];
}

export function resolveFontWeight(fontWeight) {
  if (fontWeight === "Bold") {
    return "700";
  }
  if (fontWeight === "Medium") {
    return "500";
  }
  return "400";
}

function normalizeFontFamily(value) {
  if (FONT_OPTIONS.includes(value)) {
    return value;
  }
  if (!value) {
    return DEFAULT_ANNOTATION_STYLE.fontFamily;
  }
  const lower = String(value).toLowerCase();
  if (lower.includes("roboto")) {
    return "Roboto";
  }
  if (lower.includes("mono")) {
    return "Monospace";
  }
  if (lower.includes("arial")) {
    return "Arial";
  }
  if (lower.includes("inter")) {
    return "Inter";
  }
  return DEFAULT_ANNOTATION_STYLE.fontFamily;
}

function normalizeFontWeight(value) {
  if (WEIGHT_OPTIONS.includes(value)) {
    return value;
  }
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    if (numeric >= 600) {
      return "Bold";
    }
    if (numeric >= 500) {
      return "Medium";
    }
    return "Regular";
  }
  const lower = String(value || "").toLowerCase();
  if (lower.includes("bold")) {
    return "Bold";
  }
  if (lower.includes("medium")) {
    return "Medium";
  }
  return DEFAULT_ANNOTATION_STYLE.fontWeight;
}

function normalizeFontSize(value) {
  const numeric = Number(value);
  if (SIZE_OPTIONS.includes(numeric)) {
    return numeric;
  }
  return DEFAULT_ANNOTATION_STYLE.fontSize;
}

function normalizeColor(value) {
  if (!value) {
    return DEFAULT_ANNOTATION_STYLE.color;
  }
  const legacy = LEGACY_COLOR_MAP[value];
  const normalized = (legacy || value).toUpperCase();
  if (COLOR_OPTIONS.includes(normalized)) {
    return normalized;
  }
  return DEFAULT_ANNOTATION_STYLE.color;
}

function normalizeOpacity(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_ANNOTATION_STYLE.opacity;
  }
  const clamped = Math.min(Math.max(numeric, 0), 1);
  if (OPACITY_OPTIONS.includes(clamped)) {
    return clamped;
  }
  return DEFAULT_ANNOTATION_STYLE.opacity;
}

export function normalizeAnnotationStyle(style = {}) {
  return {
    fontFamily: normalizeFontFamily(style.fontFamily),
    fontSize: normalizeFontSize(
      typeof style.fontSize !== "undefined" ? style.fontSize : style.size
    ),
    fontWeight: normalizeFontWeight(
      typeof style.fontWeight !== "undefined" ? style.fontWeight : style.weight
    ),
    color: normalizeColor(style.color),
    opacity: normalizeOpacity(style.opacity),
  };
}
