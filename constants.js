// constants.js
// Central place for keys, defaults, proxy config, and catalog data.

export const CHAT_HISTORY_KEY = "skillMatchChatHistory";
export const CERT_CATALOG_KEY = "skillMatchCertCatalog";
export const USER_RULES_KEY = "skillMatchUserRules";
export const LAST_RECOMMENDATIONS_KEY = "skillMatchLastRecommendations";

// === INTEGRATED: Your Proxy URL ===
export const GEMINI_PROXY_URL = 
  "https://backend-vercel-repo-git-main-jouds-projects-8f56041e.vercel.app/api/gemini-proxy";

// Import the certificates loader
import { loadCertificates, getCertificatesDatabase } from "./certificates-data.js";

// Use ONLY the new certificate database (will be loaded async)
// This will be populated after loadCertificates() is called
export let FINAL_CERTIFICATE_CATALOG = [];

// Initialize certificates (call this early in app startup)
export async function initializeCertificates() {
  FINAL_CERTIFICATE_CATALOG = await loadCertificates();
  return FINAL_CERTIFICATE_CATALOG;
}

// Getter for synchronous access (returns empty array if not loaded yet)
export function getFinalCertificateCatalog() {
  return getCertificatesDatabase();
}

// Default business rules (kept concise as a sensible starting point)
// constants.js (Bottom of file)

// Default business rules (English)
export const DEFAULT_RULES_EN = [
  "Start with foundational certifications before advanced options.",
  "Align recommendations to the candidate's current or target role.",
  "Avoid overlapping certifications unless the user explicitly asks."
];

// Default business rules (Arabic)
export const DEFAULT_RULES_AR = [
  "ابدأ بالشهادات التأسيسية قبل الخيارات المتقدمة.",
  "قم بمحاذاة التوصيات مع الدور الحالي أو المستهدف للمرشح.",
  "تجنب الشهادات المتداخلة ما لم يطلب المستخدم ذلك صراحة."
];

// Export a helper to get the right ones
export function getDefaultRules(lang = 'en') {
  return lang === 'ar' ? DEFAULT_RULES_AR : DEFAULT_RULES_EN;
}

// Keep this for backward compatibility if needed, but we will use the function above
export const DEFAULT_RULES = DEFAULT_RULES_EN;
