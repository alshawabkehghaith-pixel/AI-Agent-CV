// constants.js
export const CHAT_HISTORY_KEY = "skillMatchChatHistory";
export const CERT_CATALOG_KEY = "skillMatchCertCatalog";
export const USER_RULES_KEY = "skillMatchUserRules";
export const LAST_RECOMMENDATIONS_KEY = "skillMatchLastRecommendations";

// Proxy URL
export const GEMINI_PROXY_URL = 
  "https://backend-vercel-repo-git-main-jouds-projects-8f56041e.vercel.app/api/gemini-proxy";

import { loadCertificates, getCertificatesDatabase } from "./certificates-data.js";

export let FINAL_CERTIFICATE_CATALOG = [];

export async function initializeCertificates() {
  FINAL_CERTIFICATE_CATALOG = await loadCertificates();
  return FINAL_CERTIFICATE_CATALOG;
}

export function getFinalCertificateCatalog() {
  return getCertificatesDatabase();
}

// === RULES CONFIG ===

// Export these arrays directly so UI can compare them
export const DEFAULT_RULES_EN = [
  "Start with foundational certifications before advanced options.",
  "Align recommendations to the candidate's current or target role.",
  "Avoid overlapping certifications unless the user explicitly asks."
];

export const DEFAULT_RULES_AR = [
  "ابدأ بالشهادات التأسيسية قبل الخيارات المتقدمة.",
  "قم بمحاذاة التوصيات مع الدور الحالي أو المستهدف للمرشح.",
  "تجنب الشهادات المتداخلة ما لم يطلب المستخدم ذلك صراحة."
];

// Helper to get the correct rules based on language
export function getDefaultRules(lang = 'en') {
  return lang === 'ar' ? DEFAULT_RULES_AR : DEFAULT_RULES_EN;
}

// Keep this for backward compatibility
export const DEFAULT_RULES = DEFAULT_RULES_EN;
