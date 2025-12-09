// storage-catalog.js
// Persistence helpers, catalog utilities, and shared calculation helpers.

import {
  CHAT_HISTORY_KEY,
  CERT_CATALOG_KEY,
  USER_RULES_KEY,
  LAST_RECOMMENDATIONS_KEY,
  DEFAULT_RULES,
  initializeCertificates,
  getFinalCertificateCatalog,
} from "./constants.js";

// Certificate catalog (loaded on init)
export let certificateCatalog = [];

// Save chat history
export function saveChatHistory(chatHistory) {
  try {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chatHistory));
  } catch (err) {
    console.error("Failed to save chat history:", err);
  }
}

// Load chat history (returns array)
export function loadChatHistory() {
  const saved = localStorage.getItem(CHAT_HISTORY_KEY);
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Failed to parse chat history:", err);
    return [];
  }
}

// Save user rules
export function saveUserRules(userRules) {
  try {
    localStorage.setItem(USER_RULES_KEY, JSON.stringify(userRules));
  } catch (err) {
    console.error("Failed to save user rules:", err);
  }
}

// Load user rules (returns array, falls back to defaults)
export function loadUserRules() {
  const saved = localStorage.getItem(USER_RULES_KEY);
  if (!saved) return [...DEFAULT_RULES];
  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.error("Failed to parse user rules:", err);
  }
  return [...DEFAULT_RULES];
}

// Save last recommendations
export function saveLastRecommendations(lastRecommendations) {
  try {
    localStorage.setItem(
      LAST_RECOMMENDATIONS_KEY,
      JSON.stringify(lastRecommendations)
    );
  } catch (err) {
    console.error("Failed to save last recommendations:", err);
  }
}

// Load last recommendations (returns object or null)
export function loadLastRecommendations() {
  const saved = localStorage.getItem(LAST_RECOMMENDATIONS_KEY);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (err) {
    console.error("Failed to parse last recommendations:", err);
    return null;
  }
}

// Load certificate catalog (async - loads from JSON file)
export async function loadCertificateCatalog() {
  // Initialize certificates if not already loaded
  await initializeCertificates();
  
  // Get the loaded certificates
  certificateCatalog = getFinalCertificateCatalog();
  
  // Persist to localStorage for faster future loads
  if (certificateCatalog && certificateCatalog.length > 0) {
    saveCertificateCatalog(certificateCatalog);
  }
  
  return certificateCatalog;
}

// Save catalog to storage
export function saveCertificateCatalog(catalogArray) {
  try {
    localStorage.setItem(CERT_CATALOG_KEY, JSON.stringify(catalogArray));
  } catch (err) {
    console.error("Failed to save certificate catalog:", err);
  }
}

// Catalog as prompt string
export function getCatalogAsPromptString() {
  const catalog =
    certificateCatalog && certificateCatalog.length > 0
      ? certificateCatalog
      : getFinalCertificateCatalog();

  return catalog
    .map(
      (c) =>
        `- **${c.name || c.Certificate_Name_EN || "Unknown Certificate"}** (${
          c.level || c.Level || "N/A"
        }): ${c.description || c.Description || ""}${
          c.fieldEn || c.Certificate_Field_EN
            ? ` | Field: ${c.fieldEn || c.Certificate_Field_EN}`
            : ""
        }${
          c.entity || c.Certificate_Entity
            ? ` | Entity: ${c.entity || c.Certificate_Entity}`
            : ""
        }${c.officialLink ? ` | Link: ${c.officialLink}` : ""}`
    )
    .join("\n");
}

// Basic in-memory search (case-insensitive) across common fields
export function searchCertificates(query) {
  if (!query) return certificateCatalog;
  const q = query.toLowerCase();
  return certificateCatalog.filter((c) => {
    const haystack = [
      c.name,
      c.nameAr,
      c.entity,
      c.fieldEn,
      c.fieldAr,
      c.description,
      c.level,
      c.Certificate_Name_EN,
      c.Certificate_Name_AR,
      c.Certificate_Entity,
      c.Certificate_Field_EN,
      c.Certificate_Field_AR,
      c.Description,
      c.Level,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

// Index by field for quick lookups
let fieldIndex = null;
export function buildFieldIndex() {
  if (fieldIndex) return fieldIndex;
  fieldIndex = new Map();
  certificateCatalog.forEach((c) => {
    const field = (c.fieldEn || c.Certificate_Field_EN || "").toLowerCase();
    if (!field) return;
    if (!fieldIndex.has(field)) fieldIndex.set(field, []);
    fieldIndex.get(field).push(c);
  });
  return fieldIndex;
}

export function searchByField(fieldName) {
  if (!fieldName) return [];
  const idx = buildFieldIndex();
  return idx.get(fieldName.toLowerCase()) || [];
}

// Recommendation summary for chat grounding
export function summarizeRecommendationsForChat(recs) {
  if (!recs || !Array.isArray(recs.candidates) || recs.candidates.length === 0) {
    return "No recommendations generated yet.";
  }

  const lines = [];
  recs.candidates.forEach((candidate) => {
    lines.push(`Candidate: ${candidate.candidateName || "Candidate"}`);
    (candidate.recommendations || []).forEach((rec) => {
      lines.push(
        `- ${rec.certName || "Certification"}${
          rec.certId ? ` [${rec.certId}]` : ""
        }: ${rec.reason || "Reason not provided"}`
      );
    });
    lines.push("");
  });

  return lines.join("\n").trim();
}

// Year extraction helpers
export function extractYear(str) {
  const match = str.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : null;
}

export function calculateYearsFromPeriod(period) {
  if (!period || typeof period !== "string") return 0;
  const currentYear = new Date().getFullYear();
  const parts = period.split(/\s*[-–—to]+\s*/i);
  if (parts.length < 2) return 0;
  const startYear = extractYear(parts[0].trim());
  const endYear =
    parts[1].toLowerCase().includes("present") ||
    parts[1].toLowerCase().includes("current")
      ? currentYear
      : extractYear(parts[1].trim());
  if (!startYear || !endYear) return 0;
  return Math.max(0, endYear - startYear);
}

export function calculateTotalExperience(experienceArray) {
  if (!Array.isArray(experienceArray)) return 0;
  let totalYears = 0;
  experienceArray.forEach((exp) => {
    const period = exp.period || exp.years || "";
    totalYears += calculateYearsFromPeriod(period);
  });
  return Math.round(totalYears * 10) / 10;
}
