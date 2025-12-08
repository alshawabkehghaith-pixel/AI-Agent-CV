// app.js
// ============================================================================
// 1) CONFIG & CONSTANTS
// ============================================================================

// Backend proxy (preferred) to avoid exposing API keys in the browser
const GEMINI_PROXY_URL =
  "https://backend-vercel-repo-git-main-jouds-projects-8f56041e.vercel.app/api/gemini-proxy";

// Unified helper - frontend calls backend proxy when available
async function callGeminiProxy(payload) {
  const response = await fetch(GEMINI_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini proxy error: ${error || response.statusText}`);
  }

  const data = await response.json();
  return data.text || "";
}

// LocalStorage keys
const CHAT_HISTORY_KEY = "skillMatchChatHistory";
const CERT_CATALOG_KEY = "skillMatchCertCatalog";
const USER_RULES_KEY = "skillMatchUserRules";
const LAST_RECOMMENDATIONS_KEY = "skillMatchLastRecommendations";

// Default (built-in) certificate catalog.
// This will be used the first time and then stored in localStorage.
// Later, if you build an "admin" UI, you can update it and re-save.
const FINAL_CERTIFICATE_CATALOG = [
  // --- 1. Cloud Infrastructure & Architecture ---
  {
    id: "aws_ccp",
    name: "AWS Certified Cloud Practitioner (CCP)",
    description:
      "Validates fundamental understanding of AWS cloud concepts, security, and pricing.",
    level: "Foundational",
    officialLink: "https://aws.amazon.com/certification/certified-cloud-practitioner/",
  },
  {
    id: "azure_fund",
    name: "Microsoft Certified: Azure Fundamentals (AZ-900)",
    description:
      "Demonstrates foundational knowledge of core Azure services, security, and pricing.",
    level: "Foundational",
    officialLink:
      "https://learn.microsoft.com/en-us/credentials/certifications/azure-fundamentals/",
  },
  {
    id: "gcp_cdl",
    name: "Google Cloud Certified Cloud Digital Leader (CDL)",
    description:
      "Understanding of basic cloud computing and how Google Cloud products enable business transformation.",
    level: "Foundational",
    officialLink: "https://cloud.google.com/learn/certification/cloud-digital-leader",
  },
  {
    id: "aws_saa",
    name: "AWS Certified Solutions Architect - Associate",
    description:
      "Designing and deploying secure, cost-effective, and scalable systems on AWS.",
    level: "Associate",
    officialLink: "https://aws.amazon.com/certification/certified-solutions-architect-associate/",
  },
  {
    id: "azure_admin",
    name: "Microsoft Certified: Azure Administrator Associate (AZ-104)",
    description:
      "Implementation, management, and monitoring of Azure identity, governance, compute, and networking.",
    level: "Associate",
    officialLink:
      "https://learn.microsoft.com/en-us/credentials/certifications/azure-administrator/",
  },
  {
    id: "gcp_pca",
    name: "Professional Cloud Architect (PCA)",
    description:
      "Designing, planning, and managing secure, highly available, and scalable cloud architecture on Google Cloud.",
    level: "Expert",
    officialLink: "https://cloud.google.com/learn/certification/cloud-architect",
  },

  // --- 2. Integration & Digital Workflow (ServiceNow, MuleSoft, Salesforce) ---
  {
    id: "sn_csa",
    name: "ServiceNow Certified System Administrator (CSA)",
    description:
      "Core knowledge of the ServiceNow platform configuration, management, and maintenance.",
    level: "Foundational",
    officialLink:
      "https://learning.servicenow.com/lxp/en/credentials/certified-system-administrator-mainline-exam-blueprint?id=kb_article_view&sysparm_article=KB0011554",
  },
  {
    id: "sn_cis_itsm",
    name: "ServiceNow CIS - IT Service Management (ITSM)",
    description:
      "Expertise in deploying and configuring the core IT Service Management suite (Incident, Problem, Change).",
    level: "Specialist",
    officialLink: "https://learning.servicenow.com/lxp/en/pages/now-learning-get-certified?id=amap_detail&achievement_id=6c8e1d77dbc27f40de3cdb85ca961970",
  },
  {
    id: "mulesoft_dev1",
    name: "MuleSoft Certified Developer - Level 1",
    description:
      "Building, testing, troubleshooting, and deploying basic APIs and integrations using Anypoint Platform (Mule 4).",
    level: "Associate",
    officialLink: "https://trailheadacademy.salesforce.com/certificate/exam-mule-dev---Mule-Dev-201",
  },
  {
    id: "sf_admin",
    name: "Salesforce Certified Platform Administrator",
    description:
      "Foundational knowledge of managing users, security, and standard functionality of a Salesforce organization.",
    level: "Associate",
    officialLink: "https://trailhead.salesforce.com/credentials/administrator",
  },
  {
    id: "sf_app_arch",
    name: "Salesforce Certified Application Architect",
    description:
      "Designing and building technical solutions that are secure, scalable, and tailored for enterprise data management and sharing.",
    level: "Expert",
    officialLink:
      "https://trailhead.salesforce.com/credentials/applicationarchitect",
  },

  // --- 3. Data, AI & Analytics ---
  {
    id: "snowflake_core",
    name: "SnowPro Core Certification",
    description:
      "Core features and implementation of the Snowflake Cloud Data Platform.",
    level: "Foundational",
    officialLink: "https://learn.snowflake.com/en/certifications/snowpro-core/",
  },
  {
    id: "databricks_associate",
    name: "Databricks Certified Data Engineer Associate",
    description:
      "Building and deploying ETL/ELT pipelines using Databricks (PySpark, SQL).",
    level: "Associate",
    officialLink: "https://www.databricks.com/learn/certification/data-engineer-associate",
  },
  {
    id: "power_bi_analyst",
    name: "Microsoft Power BI Data Analyst (PL-300)",
    description:
      "Designing and building scalable data models and reports for business insight using Power BI.",
    level: "Associate",
    officialLink:
      "https://learn.microsoft.com/en-us/credentials/certifications/data-analyst-associate/?practice-assessment-type=certification",
  },
  {
    id: "azure_ai_eng",
    name: "Microsoft Certified: Azure AI Engineer Associate (AI-102)",
    description:
      "Designing and implementing AI solutions using Azure services (Cognitive Services, Azure ML).",
    level: "Professional",
    officialLink:
      "https://learn.microsoft.com/en-us/credentials/certifications/azure-ai-engineer/",
  },

  // --- 4. Business, Process & Strategy (Digital Transformation) ---
  {
    id: "pmp",
    name: "Project Management Professional (PMP)",
    description:
      "Validates skills in leading and directing complex projects, using predictive, agile, and hybrid approaches.",
    level: "Expert",
    officialLink: "https://www.pmi.org/certifications/project-management-pmp",
  },
  {
    id: "itil_f",
    name: "ITIL 4 Foundation",
    description:
      "Core principles and practices for IT Service Management (ITSM) and the Service Value System.",
    level: "Foundational",
    officialLink:
      "https://www.peoplecert.org/browse-certifications/it-governance-and-service-management/ITIL-1/itil-4-foundation-2565",
  },
  {
    id: "csm",
    name: "Certified ScrumMaster (CSM)",
    description:
      "Understanding and application of the Scrum framework to facilitate teams and manage agile delivery.",
    level: "Specialist",
    officialLink:
      "https://www.scrumalliance.org/get-certified/scrum-master-track/certified-scrummaster",
  },
  {
    id: "cbap",
    name: "Certified Business Analysis Professional (CBAP)",
    description:
      "Expertise in defining requirements, driving strategic outcomes, and liaison between business and IT stakeholders.",
    level: "Expert",
    officialLink: "https://www.iiba.org/business-analysis-certifications/cbap/",
  },
  {
    id: "ccmp",
    name: "Certified Change Management Professional (CCMP)",
    description:
      "Structured methodologies for managing the human and organizational side of digital change.",
    level: "Specialist",
    officialLink: "https://www.acmpglobal.org/page/CCMP",
  },
  {
    id: "focp",
    name: "FinOps Certified Practitioner (FOCP)",
    description:
      "Principles for managing cloud financial operations, cost optimization, and financial accountability.",
    level: "Foundational",
    officialLink: "https://learn.finops.org/page/finops-certified-practitioner",
  },

  // --- 5. Cybersecurity, DevOps & Governance ---
  {
    id: "cissp",
    name: "Certified Information Systems Security Professional (CISSP)",
    description:
      "Executive-level knowledge in designing, implementing, and managing a security program.",
    level: "Expert",
    officialLink: "https://www.isc2.org/certifications/CISSP",
  },
  {
    id: "cism",
    name: "Certified Information Security Manager (CISM)",
    description:
      "Focuses on security governance, program development, risk management, and incident management.",
    level: "Expert",
    officialLink: "https://www.isaca.org/credentialing/cism",
  },
  {
    id: "cka",
    name: "Certified Kubernetes Administrator (CKA)",
    description:
      "Hands-on ability to deploy, configure, and manage Kubernetes clusters (Cloud Native App Development).",
    level: "Specialist",
    officialLink:
      "https://trainingportal.linuxfoundation.org/courses/certified-kubernetes-administrator-cka",
  },
  {
    id: "terraform",
    name: "HashiCorp Certified: Terraform Associate",
    description:
      "Foundational skills in Infrastructure as Code (IaC) using Terraform for multi-cloud automation.",
    level: "Associate",
    officialLink: "https://developer.hashicorp.com/certifications/infrastructure-automation",
  },
  {
    id: "github_as",
    name: "GitHub Advanced Security",
    description:
      "Expertise in implementing security tools and practices within GitHub repositories and workflows.",
    level: "Specialist",
    officialLink: "https://github.com/features/security",
  },
];

// This variable will hold the *active* catalog (loaded from localStorage or default)
let certificateCatalog = [];

// ============================================================================
// 2) SYSTEM PROMPTS & AGENT BEHAVIOR (EDIT HERE MOST OFTEN)
// ============================================================================
//
// This section controls how the AI "behaves". You can tweak wording, tone,
// and instructions without touching the rest of the code.
//
// - CHAT_SYSTEM_PROMPT: used for the chat assistant.
// - ANALYSIS_SYSTEM_PROMPT: used for CV → certification analysis.
// - RULES_SYSTEM_PROMPT: used to parse free-text rules.
//

// System / persona prompt for the chat assistant.
// This will be enhanced with certificate catalog context when used.
const CHAT_SYSTEM_PROMPT_BASE = `
You are "SkillMatch Pro", an AI-powered assistant that helps people:
- understand training and certification options,
- analyze their CV or experience at a high level,
- and discuss skill gaps in a clear, practical way.

Your style:
- conversational, natural, and friendly (like talking to a helpful colleague),
- clear and detailed in your explanations,
- professional but approachable,
- focused on actionable recommendations.

When discussing certifications:
- Always explain WHY a certification is relevant
- Highlight specific skills that align
- Mention years of experience requirements or recommendations
- Explain how it fits their role or career goals
- Be specific about what the certification validates
- Use examples from their background when available

You can have free-form conversations about:
- Certification recommendations and their relevance
- Career paths and skill development
- Training options and requirements
- Questions about specific certifications
- General career advice related to certifications
`;

// System prompt for the CV analysis engine.
// This is combined with the certification catalog, business rules, and CV text.
// You can adjust instructions, strictness of JSON, or the level of explanation here.
const ANALYSIS_SYSTEM_PROMPT = `
You are an expert career counselor and training analyst.
Your job is to:

1. Read CVs.
2. Identify key skills, experience levels, and roles.
3. Recommend the most relevant training and certifications from the provided catalog.
4. Respect the business rules when applicable.
5. Return a single strict JSON object in the specified structure.
`;

// System prompt for parsing natural-language business rules into normalized text.
const RULES_SYSTEM_PROMPT = `
You are a business rules parser.
You read natural-language rules from the user and convert them into a clean, structured list of rule sentences.
Each rule should be returned as a single string in an array.
Respond ONLY with a JSON array of strings, no extra text or formatting.
`;

// System prompt for structured CV parsing
const CV_PARSER_SYSTEM_PROMPT = `
You are a CV/Resume parser. Extract structured data from the CV text.
Return ONLY a valid JSON object with this exact structure:

{
  "experience": [
    {
      "jobTitle": "Job title/position",
      "company": "Company name",
      "period": "Start date - End date",
      "description": "Responsibilities and achievements in this role"
    }
  ],
  "education": [
    {
      "degree": "Degree type (e.g., Bachelor's, Master's, PhD)",
      "major": "Field of study/Major",
      "institution": "University/School name"
    }
  ],
  "certifications": [
    {
      "title": "Certification name",
      "issuer": "Issuing organization (if mentioned)"
    }
  ],
  "skills": ["skill1", "skill2", "skill3"],
  "other": {
    "achievements": ["achievement1", "achievement2"],
    "summary": "Professional summary if present",
    "interests": "Hobbies/interests if mentioned"
  }
}

Rules:
- Extract ONLY information explicitly stated in the CV
- If a field is not found, use empty string "" or empty array []
- For experience and education, extract ALL entries found
- Keep descriptions concise but complete
- Do not invent or assume information
`;


// ============================================================================
// 3) GLOBAL STATE
// ============================================================================
//
// All cross-section state lives here. This keeps the rest of the code simple.
// ----------------------------------------------------------------------------

// Default business rules (kept concise as a sensible starting point)
const DEFAULT_RULES = [
  "Start with foundational certifications before advanced options.",
  "Align recommendations to the candidate's current or target role.",
  "Avoid overlapping certifications unless the user explicitly asks."
];

let chatHistory = [];               // [{ text: string, isUser: boolean }]
let userRules = [...DEFAULT_RULES]; // [string]
let uploadedCvs = [];               // [{ name: string, text: string }]
let lastRecommendations = null;     // persisted recommendations for chat context

// ============================================================================
// 4) GENERIC HELPERS (UI, LocalStorage, Catalog)
// ============================================================================

// Append a message to the chat UI.
function addMessage(text, isUser = false) {
  const chatMessages = document.getElementById("chat-messages");
  if (!chatMessages) return;

  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${isUser ? "user-message" : "bot-message"}`;
  
  // Parse markdown for bot messages, plain text for user messages
  if (!isUser && typeof marked !== 'undefined') {
    // Use marked.js to parse markdown
    messageDiv.innerHTML = marked.parse(text);
  } else {
    // Convert newlines to <br> for simple formatting (user messages or fallback)
    messageDiv.innerHTML = text.replace(/\n/g, "<br>");
  }

  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Show typing indicator (animated dots)
function showTypingIndicator() {
  const chatMessages = document.getElementById("chat-messages");
  if (!chatMessages) return null;

  const typingDiv = document.createElement("div");
  typingDiv.className = "message bot-message typing-indicator";
  typingDiv.id = "typing-indicator";
  typingDiv.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
  
  chatMessages.appendChild(typingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  return typingDiv;
}

// Remove typing indicator
function hideTypingIndicator() {
  const typingIndicator = document.getElementById("typing-indicator");
  if (typingIndicator) {
    typingIndicator.remove();
  }
}

// Show status messages (success / error) in a given container element.
function updateStatus(element, message, isError = false) {
  if (!element) return;
  element.innerHTML = `
    <div class="status-message ${isError ? "status-error" : "status-success"}">
      ${message}
    </div>
  `;
  setTimeout(() => {
    element.innerHTML = "";
  }, 8000);
}

// Show a little loader spinner + text.
function showLoading(element, message) {
  if (!element) return;
  element.innerHTML = `<div class="loader"></div>${message}`;
}

// Hide any loader text.
function hideLoading(element) {
  if (!element) return;
  element.innerHTML = "";
}

// Save chat history to localStorage so it persists across refreshes.
function saveChatHistory() {
  try {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chatHistory));
  } catch (err) {
    console.error("Failed to save chat history:", err);
  }
}

// Load chat history from localStorage on startup.
function loadChatHistory() {
  const saved = localStorage.getItem(CHAT_HISTORY_KEY);
  if (!saved) return;

  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      chatHistory = parsed;
      chatHistory.forEach((msg) => addMessage(msg.text, msg.isUser));
    }
  } catch (err) {
    console.error("Failed to parse chat history:", err);
    chatHistory = [];
  }
}

// Persist user rules to localStorage
function saveUserRules() {
  try {
    localStorage.setItem(USER_RULES_KEY, JSON.stringify(userRules));
  } catch (err) {
    console.error("Failed to save user rules:", err);
  }
}

// Persist last recommendations to localStorage
function saveLastRecommendations() {
  try {
    localStorage.setItem(
      LAST_RECOMMENDATIONS_KEY,
      JSON.stringify(lastRecommendations)
    );
  } catch (err) {
    console.error("Failed to save last recommendations:", err);
  }
}

// Load last recommendations from localStorage
function loadLastRecommendations() {
  const saved = localStorage.getItem(LAST_RECOMMENDATIONS_KEY);
  if (!saved) return;

  try {
    const parsed = JSON.parse(saved);
    if (parsed && typeof parsed === "object") {
      lastRecommendations = parsed;
    }
  } catch (err) {
    console.error("Failed to parse last recommendations:", err);
    lastRecommendations = null;
  }
}

// Load user rules from localStorage or fall back to defaults
function loadUserRules() {
  const saved = localStorage.getItem(USER_RULES_KEY);
  if (!saved) return;

  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed) && parsed.length > 0) {
      userRules = parsed;
    }
  } catch (err) {
    console.error("Failed to parse user rules:", err);
    userRules = [...DEFAULT_RULES];
  }
}

// Clear chat history and reset chat on page refresh
function clearChatHistory() {
  // Clear the chat history array
  chatHistory = [];
  
  // Clear localStorage
  try {
    localStorage.removeItem(CHAT_HISTORY_KEY);
  } catch (err) {
    console.error("Failed to clear chat history from localStorage:", err);
  }
  
  // Clear the chat messages container (keep only the initial bot message)
  const chatMessages = document.getElementById("chat-messages");
  if (chatMessages) {
    // Remove all messages except the first one (initial bot message)
    const initialMessage = chatMessages.querySelector(".bot-message");
    chatMessages.innerHTML = "";
    if (initialMessage) {
      chatMessages.appendChild(initialMessage);
    }
  }
}

// Load certificate catalog from localStorage OR fallback to the default.
// This is where you can later plug in an "editor" UI that modifies the catalog.
function loadCertificateCatalog() {
  const stored = localStorage.getItem(CERT_CATALOG_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (err) {
      console.warn("Failed to parse stored certificate catalog, using default.", err);
    }
  }
  // If nothing valid stored → use default, and persist it once.
  saveCertificateCatalog(FINAL_CERTIFICATE_CATALOG);
  return FINAL_CERTIFICATE_CATALOG;
}

// Build a short, readable summary of the last recommendations for chat grounding
function summarizeRecommendationsForChat(recs) {
  if (!recs || !Array.isArray(recs.candidates) || recs.candidates.length === 0) {
    return "No recommendations generated yet.";
  }

  const lines = [];
  recs.candidates.forEach((candidate) => {
    lines.push(`Candidate: ${candidate.candidateName || "Candidate"}`);
    (candidate.recommendations || []).forEach((rec) => {
      lines.push(
        `- ${rec.certName || "Certification"}${rec.certId ? ` [${rec.certId}]` : ""}: ${rec.reason || "Reason not provided"}`
      );
    });
    lines.push(""); // spacing between candidates
  });

  return lines.join("\n").trim();
}

// Save a given catalog array to localStorage.
function saveCertificateCatalog(catalogArray) {
  try {
    localStorage.setItem(CERT_CATALOG_KEY, JSON.stringify(catalogArray));
  } catch (err) {
    console.error("Failed to save certificate catalog:", err);
  }
}

// Create a string representation of the catalog to embed in prompts.
function getCatalogAsPromptString() {
  return certificateCatalog
    .map(
      (c) =>
        `- **${c.name}** (${c.level || "N/A"}): ${c.description}${c.officialLink ? ` | Link: ${c.officialLink}` : ""}`
    )
    .join("\n");
}

// Build chat context string so the model knows the current rules and last recommendations
function buildChatContextMessage(userMessage) {
  const rulesText =
    userRules && userRules.length > 0
      ? userRules.map((r, i) => `${i + 1}. ${r}`).join("\n")
      : "No explicit business rules provided.";

  const recSummary = summarizeRecommendationsForChat(lastRecommendations);

  return `${userMessage}

[Context]
Business rules:
${rulesText}

Latest recommendations:
${recSummary}`;
}

// ============================================================================
// 4.5) CHAT CONTEXT BUILDER
// ============================================================================
//
// Builds an enhanced system prompt for chat that includes certificate catalog
// and any uploaded CV context for better recommendations.
// ----------------------------------------------------------------------------

function buildChatSystemPrompt() {
  const catalogString = getCatalogAsPromptString();
  const hasCvContext = uploadedCvs.length > 0;
  const cvContext = hasCvContext
    ? `\n\n**Available CV Context:**\nThe user has uploaded ${uploadedCvs.length} CV(s). You can reference their experience, skills, and background when making recommendations.`
    : `\n\n**Note:** The user has not uploaded a CV yet. You can still answer general questions about certifications, but for personalized recommendations, encourage them to upload their CV.`;

  return `${CHAT_SYSTEM_PROMPT_BASE.trim()}

**Available Certifications Catalog:**
${catalogString}
${cvContext}

When recommending certifications, always:
1. Reference specific certifications from the catalog above by their exact name
2. Explain the match clearly and conversationally:
   - **Skills Alignment**: Mention specific skills from their background that match the certification requirements (e.g., "Your experience with AWS services like EC2 and S3 aligns perfectly with...")
   - **Experience Level**: Reference their years of experience if relevant (e.g., "With your 5+ years in cloud architecture, you're well-positioned for...")
   - **Role Relevance**: Explain how the certification fits their current role or career goals (e.g., "As a Solutions Architect, this certification would validate your expertise in...")
   - **Career Impact**: Describe what the certification enables or validates (e.g., "This would demonstrate your ability to design scalable systems and could open doors to senior architect roles")
3. Be conversational and natural - respond as if having a friendly, helpful discussion
4. If the user asks about certifications not in the catalog, acknowledge it and suggest similar ones from the catalog
5. When users ask casual questions like "what certifications should I get?" or "what matches my experience?", provide personalized recommendations with clear explanations

**IMPORTANT - CV Upload Encouragement:**
${hasCvContext 
  ? "The user has uploaded their CV, so you can provide personalized recommendations based on their actual experience, skills, and background."
  : `When answering questions about certifications or courses:
- Always provide a helpful, informative answer first
- After your answer, naturally suggest: "If you'd like me to give you a more detailed review and personalized recommendations based on your specific experience, skills, and career goals, please upload your CV. I can then analyze your background and provide tailored certification suggestions that align perfectly with your profile."
- Be friendly and encouraging, not pushy
- Only mention CV upload once per conversation unless they ask about it again`}

Example of a good response (when no CV is uploaded):
"The AWS Certified Solutions Architect - Associate is an excellent certification for cloud professionals. It validates your ability to design and deploy scalable, highly available systems on AWS. The exam covers topics like EC2, S3, VPC, IAM, and cost optimization strategies.

If you'd like me to give you a more detailed review and personalized recommendations based on your specific experience, skills, and career goals, please upload your CV. I can then analyze your background and provide tailored certification suggestions that align perfectly with your profile."
`;
}

// ============================================================================
// 5) AI CLIENT (Gemini HTTP Wrapper)
// ============================================================================
//
// This is the only place that talks to Gemini. Everywhere else just calls
// callGeminiAPI(prompt, history?) and doesn't care about HTTP details.
// ----------------------------------------------------------------------------

async function callGeminiAPI(userPrompt, history = [], systemPrompt = "") {
  // Format history for Gemini
  const formattedHistory = history.map((msg) => ({
    role: msg.isUser ? "user" : "model",
    parts: [{ text: msg.text }],
  }));

  // We simulate a "system" message by prefixing userPrompt with instructions,
  // since this API does not have a separate system role.
  const combinedPrompt = systemPrompt
    ? `${systemPrompt.trim()}\n\nUser message:\n${userPrompt}`
    : userPrompt;

  // Build contents including the current user turn for context
  const contents = [
    ...formattedHistory,
    { role: "user", parts: [{ text: combinedPrompt }] },
  ];

  // Use backend proxy (preferred for deployment to avoid exposing keys)
  const proxyPayload = { prompt: combinedPrompt, history: contents };
  return await callGeminiProxy(proxyPayload);
}

// ============================================================================
// 6) CV PARSING (PDF, DOCX, TXT)
// ============================================================================
//
// Uses pdf.js and mammoth.js which are loaded via CDN in index.html.
// ----------------------------------------------------------------------------

// Configure PDF.js worker (global pdfjsLib is provided by CDN)
if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

/**
 * Extract text from a single file.
 * Supports: PDF, DOCX, TXT.
 */
async function extractTextFromFile(file) {
  if (file.type === "application/pdf") {
    const dataBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: dataBuffer }).promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(" ");
      fullText += pageText + "\n";
    }

    return fullText;
  }

  if (
    file.type ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await window.mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  if (file.type === "text/plain") {
    return await file.text();
  }

  throw new Error(`Unsupported file type: ${file.type}`);
}

/**
 * Parse raw CV text into structured sections using AI.
 * Returns: { experience: [], education: [], certifications: [], skills: [], other: {} }
 */
async function parseCvIntoStructuredSections(rawText) {
  const prompt = `
${CV_PARSER_SYSTEM_PROMPT.trim()}

CV Text to parse:
---
${rawText}
---

Return the JSON object only, no other text.
`;

  const rawResponse = await callGeminiAPI(prompt, [], "");
  const cleaned = rawResponse.replace(/```json\s*|\s*```/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned);

    // Normalize and ensure all expected fields exist
    return {
      experience: Array.isArray(parsed.experience) ? parsed.experience : [],
      education: Array.isArray(parsed.education) ? parsed.education : [],
      certifications: Array.isArray(parsed.certifications) ? parsed.certifications : [],
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      other: {
        achievements: parsed.other?.achievements || [],
        languages: parsed.other?.languages || [],
        summary: parsed.other?.summary || "",
        interests: parsed.other?.interests || ""
      }
    };
  } catch (err) {
    console.error("Failed to parse CV sections:", err);
    console.error("Raw AI response:", rawResponse);
    return null;
  }
}

/**
 * Calculate years from a period string like "2020 - 2023" or "Jan 2018 - Present"
 * Returns the number of years (decimal)
 */
function calculateYearsFromPeriod(period) {
  if (!period || typeof period !== "string") return 0;

  // Common patterns: "2020 - 2023", "Jan 2020 - Dec 2023", "2020 - Present"
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Try to extract start and end years/dates
  const parts = period.split(/\s*[-–—to]+\s*/i); // Split on various dash types or "to"
  
  if (parts.length < 2) return 0;

  const startPart = parts[0].trim();
  const endPart = parts[1].trim();

  // Extract year from each part
  const startYear = extractYear(startPart);
  const endYear = endPart.toLowerCase().includes("present") || endPart.toLowerCase().includes("current")
    ? currentYear
    : extractYear(endPart);

  if (!startYear || !endYear) return 0;

  return Math.max(0, endYear - startYear);
}

/**
 * Extract a 4-digit year from a string
 */
function extractYear(str) {
  const match = str.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : null;
}

/**
 * Calculate total years of experience from an array of experience objects
 */
function calculateTotalExperience(experienceArray) {
  if (!Array.isArray(experienceArray)) return 0;

  let totalYears = 0;
  experienceArray.forEach(exp => {
    const period = exp.period || exp.years || "";
    totalYears += calculateYearsFromPeriod(period);
  });

  return Math.round(totalYears * 10) / 10; // Round to 1 decimal
}

// ============================================================================
// 7) RULE ENGINE (Parse + Store Business Rules)
// ============================================================================
//
// userRules is kept in memory. This section only worries about converting
// natural-language rules into a normalized list of strings.
// ----------------------------------------------------------------------------

async function parseAndApplyRules(rulesText) {
  const prompt = `
${RULES_SYSTEM_PROMPT.trim()}

User's rules:
${rulesText}

Remember:
- Respond with ONLY a JSON array of strings.
- No extra commentary or formatting.
`;

  const rawResponse = await callGeminiAPI(prompt, [], ""); // systemPrompt already embedded above
  const cleaned = rawResponse.replace(/```json\s*|\s*```/g, "").trim();

  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) {
    throw new Error("Parsed rules are not an array.");
  }

  userRules = parsed;
  saveUserRules();
  return userRules;
}

// ============================================================================
// 8) RECOMMENDATION ENGINE (CV → Certs)
// ============================================================================
//
// Builds the large prompt for CV analysis + uses Gemini to return a JSON object.
// Then, renders the recommendations in the UI.
// ----------------------------------------------------------------------------

function buildAnalysisPromptForCvs(cvArray, rulesArray) {
  const catalogString = getCatalogAsPromptString();

  return `
${ANALYSIS_SYSTEM_PROMPT.trim()}

**Catalog of Certifications:**
${catalogString}

**Business Rules:**
${rulesArray && rulesArray.length > 0
      ? rulesArray.map((r) => `- ${r}`).join("\n")
      : "No specific business rules provided."
    }

**CVs to Analyze:**
${cvArray
      .map((cv) => `--- CV for: ${cv.name} ---\n${cv.text}`)
      .join("\n\n")}

**Task:**
For each CV, provide recommendations in a structured JSON format. The JSON must be an object with a "candidates" field, where each candidate is an object.

**JSON Structure:**
{
  "candidates": [
    {
      "candidateName": "Full Name of Candidate",
      "recommendations": [
        {
          "certId": "pmp",
          "certName": "Project Management Professional (PMP)",
          "reason": "Clear explanation of why this certification is relevant.",
          "rulesApplied": ["List of rules that influenced this recommendation"]
        }
      ]
    }
  ]
}

Important:
- Respond with ONLY the JSON object. Do not include any introductory text, explanations, or markdown formatting like \`\`\`json.
- The entire response must be a single, valid JSON object that can be parsed.
- If no recommendations can be made for a candidate, provide an empty array for their "recommendations".
`;
}

// Call Gemini to analyze the CVs and parse the recommendations JSON.
async function analyzeCvsWithAI(cvArray, rulesArray) {
  const analysisPrompt = buildAnalysisPromptForCvs(cvArray, rulesArray || []);
  const rawResponse = await callGeminiAPI(analysisPrompt, [], ""); // systemPrompt already baked in
  const cleaned = rawResponse.replace(/```json\s*|\s*```/g, "").trim();

  let recommendations;
  try {
    recommendations = JSON.parse(cleaned);
  } catch (err) {
    console.error("JSON Parsing Error:", err);
    throw new Error(
      "The AI returned an invalid JSON format. Check the console for the raw response."
    );
  }

  return recommendations;
}

// Render the recommendations object into the HTML.
function displayRecommendations(recommendations, containerEl, resultsSectionEl) {
  if (!containerEl || !resultsSectionEl) return;

  containerEl.innerHTML = "";

  if (
    !recommendations ||
    !recommendations.candidates ||
    recommendations.candidates.length === 0
  ) {
    containerEl.innerHTML =
      "<p>No recommendations could be generated. Please check the CVs, rules, and the console for errors.</p>";
  } else {
    recommendations.candidates.forEach((candidate) => {
      const candidateDiv = document.createElement("div");
      candidateDiv.className = "candidate-result";

      const nameDiv = document.createElement("h3");
      nameDiv.className = "candidate-name";
      nameDiv.textContent = candidate.candidateName || "Candidate";
      candidateDiv.appendChild(nameDiv);

      if (candidate.recommendations && candidate.recommendations.length > 0) {
        candidate.recommendations.forEach((rec) => {
          const card = document.createElement("div");
          card.className = "recommendation-card";
          card.innerHTML = `
            <div class="recommendation-title">${rec.certName}</div>
            <div class="recommendation-reason">
              <i class="fas fa-lightbulb"></i> ${rec.reason}
            </div>
            ${
              rec.rulesApplied && rec.rulesApplied.length > 0
                ? `<div class="recommendation-rule">
                     <i class="fas fa-gavel"></i> Rules Applied: ${rec.rulesApplied.join(
                       ", "
                     )}
                   </div>`
                : ""
            }
          `;
          candidateDiv.appendChild(card);
        });
      } else {
        const noRecP = document.createElement("p");
        noRecP.textContent =
          "No specific recommendations found for this candidate based on the current rules and catalog.";
        candidateDiv.appendChild(noRecP);
      }

      containerEl.appendChild(candidateDiv);
    });
  }

  resultsSectionEl.classList.remove("hidden");
}

// ============================================================================
// 9) DOM BINDING & EVENT HANDLERS
// ============================================================================
//
// This section wires everything together once the DOM is ready.
// - Chat send button & Enter key
// - CV upload, drag & drop, analyze button
// - Rules textarea + Update Rules button
// ----------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  // Load the certificate catalog from localStorage or defaults
  certificateCatalog = loadCertificateCatalog();
  loadUserRules();
  loadLastRecommendations();

  // DOM elements
  const userInput = document.getElementById("user-input");
  const sendButton = document.getElementById("send-button");

  const fileInput = document.getElementById("file-input");
  const analyzeButton = document.getElementById("analyze-button");
  const cvUploadArea = document.getElementById("cv-upload-area");

  const rulesInput = document.getElementById("rules-input");
  const updateRulesButton = document.getElementById("update-rules");

  const uploadStatus = document.getElementById("upload-status");
  const rulesStatus = document.getElementById("rules-status");

  const resultsSection = document.getElementById("results-section");
  const recommendationsContainer = document.getElementById(
    "recommendations-container"
  );

  // Clear chat history on page refresh (start fresh)
  clearChatHistory();

  // --- Chat events ---
  async function handleSendMessage() {
    const message = (userInput.value || "").trim();
    if (!message) return;

    addMessage(message, true);
    chatHistory.push({ text: message, isUser: true });
    saveChatHistory();

    userInput.value = "";
    sendButton.disabled = true;

    // Show typing indicator
    showTypingIndicator();

    try {
      // Build enhanced system prompt with certificate catalog and CV context
      const enhancedSystemPrompt = buildChatSystemPrompt();
      
      // If user mentions their experience/skills, include CV context in the message
      let enhancedMessage = message;
      if (uploadedCvs.length > 0 && (
        message.toLowerCase().includes('my') || 
        message.toLowerCase().includes('i have') ||
        message.toLowerCase().includes('i am') ||
        message.toLowerCase().includes('experience') ||
        message.toLowerCase().includes('skill') ||
        message.toLowerCase().includes('certification') ||
        message.toLowerCase().includes('recommend')
      )) {
        // Add brief CV context to help the AI provide personalized recommendations
        const cvSummary = uploadedCvs.map(cv => {
          const structured = cv.structured || {};
          const skills = (structured.skills || []).slice(0, 10).join(", ");
          const experience = structured.experience || [];
          const totalYears = calculateTotalExperience(experience);
          const recentRoles = experience.slice(0, 3).map(exp => exp.jobTitle || "").filter(Boolean).join(", ");
          
          return `${cv.name}: ${totalYears} years experience, recent roles: ${recentRoles || "N/A"}, skills: ${skills || "N/A"}`;
        }).join("\n");
        
        enhancedMessage = `${message}\n\n[Context: ${uploadedCvs.length} CV(s) available. Summary: ${cvSummary}]`;
      }

      // Add business rules + last recommendations context for grounding
      enhancedMessage = buildChatContextMessage(enhancedMessage);
      
      const reply = await callGeminiAPI(enhancedMessage, chatHistory, enhancedSystemPrompt);
      
      // Hide typing indicator before adding the actual response
      hideTypingIndicator();
      
      addMessage(reply, false);
      chatHistory.push({ text: reply, isUser: false });
      saveChatHistory();
    } catch (err) {
      console.error("Chat API Error:", err);
      
      // Hide typing indicator on error too
      hideTypingIndicator();
      
      addMessage(
        "Sorry, I'm having trouble connecting. Please verify the API key and network.",
        false
      );
    } finally {
      sendButton.disabled = false;
    }
  }

  sendButton.addEventListener("click", handleSendMessage);
  userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  });

  // --- File upload events ---
  cvUploadArea.addEventListener("click", () => fileInput.click());

  cvUploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    cvUploadArea.style.borderColor = "var(--primary)";
  });

  cvUploadArea.addEventListener("dragleave", () => {
    cvUploadArea.style.borderColor = "var(--border-color)";
  });

  cvUploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    cvUploadArea.style.borderColor = "var(--border-color)";
    fileInput.files = e.dataTransfer.files;
    handleFileSelect();
  });

  fileInput.addEventListener("change", handleFileSelect);

  function handleFileSelect() {
    uploadedCvs = [];
    const files = Array.from(fileInput.files || []);
    if (files.length > 0) {
      updateStatus(
        uploadStatus,
        `Selected ${files.length} file(s): ${files.map((f) => f.name).join(", ")}`
      );
    } else {
      uploadStatus.innerHTML = "";
    }
  }

  // --- Analyze CV ---

// --- 1. Open Modal and Render Results ---
function openCvModal(allCvResults) {
  const modal = document.getElementById("cvModal");
  const tabs = document.getElementById("cvTabsContainer");
  const content = document.getElementById("cvResultsContainer");

  modal.style.display = "block";
  tabs.innerHTML = "";
  content.innerHTML = "";

  allCvResults.forEach((cv, index) => {
    const tab = document.createElement("div");
    tab.className = "cv-tab";
    tab.textContent = cv.name;
    tab.dataset.index = index;

    if (index === 0) tab.classList.add("active");

    tab.addEventListener("click", () => {
      document.querySelectorAll(".cv-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      renderCvDetails(allCvResults[index]);
    });

    tabs.appendChild(tab);
  });

  renderCvDetails(allCvResults[0]);
}


// --- 2. Render One CV Output ---
function renderCvDetails(cv) {
  const container = document.getElementById("cvResultsContainer");
  container.innerHTML = "";

  const sections = [
    { key: "experience", label: "Experience", fields: ["title", "description", "years"] },
    { key: "education", label: "Education", fields: ["title", "description"] },
    { key: "certifications", label: "Certifications", fields: ["title"] },
    { key: "skills", label: "Skills", fields: ["title"] }
  ];

  sections.forEach(sec => {
    const secDiv = document.createElement("div");
    secDiv.className = "cv-section";
    secDiv.innerHTML = `<h3>${sec.label}</h3>`;

    const listDiv = document.createElement("div");
    listDiv.id = `${cv.name}_${sec.key}_list`;

    (cv[sec.key] || []).forEach(item => {
      listDiv.appendChild(createItemRow(item, sec.fields));
    });

    const addBtn = document.createElement("button");
    addBtn.className = "add-btn";
    addBtn.textContent = `+ Add ${sec.label}`;

    addBtn.addEventListener("click", () => {
      const emptyItem = {};
      sec.fields.forEach(f => emptyItem[f] = "");
      listDiv.appendChild(createItemRow(emptyItem, sec.fields));
    });

    secDiv.appendChild(listDiv);
    secDiv.appendChild(addBtn);
    container.appendChild(secDiv);
  });
}

// --- 3. Create Editable Row ---
  // Create row with delete button
  function createItemRow(item, fields) {
    const row = document.createElement("div");
    row.className = "item-row";

    const deleteBtn = document.createElement("span");
    deleteBtn.className = "delete-item-btn";
    deleteBtn.textContent = "×";
    deleteBtn.addEventListener("click", () => row.remove());

    row.appendChild(deleteBtn);

    fields.forEach(f => {
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = f.charAt(0).toUpperCase() + f.slice(1);
      input.value = item[f] || "";
      row.appendChild(input);
    });

    return row;
  }

  // Close modal
  document.querySelector(".cv-close-btn").addEventListener("click", () => {
    document.getElementById("cvModal").style.display = "none";
  });

  // Close when clicking outside
  window.addEventListener("click", (e) => {
    const modal = document.getElementById("cvModal");
    if (e.target === modal) modal.style.display = "none";
  });



// --- 4. Collect All Manual + Backend Data ---
document.getElementById("submitCvReview").addEventListener("click", () => {
  const tabs = document.querySelectorAll(".cv-tab");
  let allResults = [];

  tabs.forEach(tab => {
    const name = tab.textContent;

    const result = {
      name,
      experience: [],
      education: [],
      certifications: [],
      skills: []
    };

    ["experience", "education", "certifications", "skills"].forEach(sec => {
      const list = document.getElementById(`${name}_${sec}_list`);
      if (!list) return;

      list.querySelectorAll(".item-row").forEach(row => {
        const entry = {};
        row.querySelectorAll("input").forEach(input => {
          entry[input.placeholder.toLowerCase()] = input.value;
        });
        result[sec].push(entry);
      });
    });

    allResults.push(result);
  });

  console.log("FINAL SUBMITTED CV DATA →", allResults);

  alert("Submitted! Check console for full JSON output.");
});


  analyzeButton.addEventListener("click", async () => {
    const files = Array.from(fileInput.files || []);
    if (files.length === 0) {
      updateStatus(uploadStatus, "Please select at least one CV file.", true);
      return;
    }

    showLoading(uploadStatus, "Extracting text from CVs...");
    analyzeButton.disabled = true;
    uploadedCvs = [];

    try {
      // 1) Extract text and parse into structured sections
      for (const file of files) {
        const rawText = await extractTextFromFile(file);
        console.log(`--- DEBUG: Extracted text from ${file.name} ---`);
        console.log(rawText);

        showLoading(uploadStatus, `Parsing ${file.name} into sections...`);
        const structuredSections = await parseCvIntoStructuredSections(rawText);
        
        console.log(`--- DEBUG: Parsed sections for ${file.name} ---`);
        console.log(structuredSections);

        uploadedCvs.push({
          name: file.name,
          text: rawText,                    // Keep raw text for analysis
          structured: structuredSections    // Add structured sections
        });
      }

      // At this point, uploadedCvs contains both raw text and structured data
      // Example: uploadedCvs[0].structured.experience, uploadedCvs[0].structured.skills, etc.
      
      // TODO: Send structured data to frontend display here
      // For now, log it:
      console.log("--- All parsed CVs ready for frontend ---");
      console.log(uploadedCvs);

      showLoading(uploadStatus, "Analyzing CVs with AI...");

      // 2) Continue with existing analysis
      const recommendations = await analyzeCvsWithAI(uploadedCvs, userRules);

      // 2a) Persist recommendations for chat grounding
      lastRecommendations = recommendations;
      saveLastRecommendations();

      // 3) Render
      displayRecommendations(
        recommendations,
        recommendationsContainer,
        resultsSection
      );

      // Transform uploadedCvs to the format expected by the modal
      const cvResultsForModal = uploadedCvs.map(cv => {
        const s = cv.structured || {};
        
        // Calculate total years of experience
        const totalYearsExperience = calculateTotalExperience(s.experience || []);
        console.log(`Total experience for ${cv.name}: ${totalYearsExperience} years`);

        return {
          name: cv.name,
          totalYearsExperience: totalYearsExperience,  // Add this field
          experience: (s.experience || []).map(exp => ({
            title: exp.jobTitle || "",
            description: `${exp.company || ""} - ${exp.description || ""}`,
            years: exp.period || "",
            duration: calculateYearsFromPeriod(exp.period)  // Years for this specific job
          })),
          education: (s.education || []).map(edu => ({
            title: `${edu.degree || ""} in ${edu.major || ""}`,
            description: `${edu.institution || ""}${edu.year ? " (" + edu.year + ")" : ""}`
          })),
          certifications: (s.certifications || []).map(cert => ({
            title: `${cert.title || ""}${cert.issuer ? " - " + cert.issuer : ""}${cert.year ? " (" + cert.year + ")" : ""}`
          })),
          skills: (s.skills || []).map(skill => ({
            title: typeof skill === "string" ? skill : skill.title || ""
          }))
        };
      });

      // Open modal with transformed results
      openCvModal(cvResultsForModal);

      updateStatus(uploadStatus, `Analysis complete for ${files.length} CV(s).`);
    } catch (err) {
      console.error("Analysis Error:", err);
      updateStatus(
        uploadStatus,
        `Failed to analyze CVs. Error: ${err.message}`,
        true
      );
    } finally {
      hideLoading(uploadStatus);
      analyzeButton.disabled = false;
    }
  });

  // --- Rules events ---
  updateRulesButton.addEventListener("click", async () => {
    const rulesText = (rulesInput.value || "").trim();
    if (!rulesText) {
      updateStatus(
        rulesStatus,
        "Please enter some rules before updating.",
        true
      );
      return;
    }

    showLoading(rulesStatus, "Parsing rules with AI...");
    updateRulesButton.disabled = true;

    try {
      const parsedRules = await parseAndApplyRules(rulesText);
      updateStatus(
        rulesStatus,
        `Successfully parsed and applied ${parsedRules.length} rules.`
      );
      addMessage(
        "I've updated my recommendation logic based on your new rules.",
        false
      );
    } catch (err) {
      console.error("Rule Parsing Error:", err);
      updateStatus(
        rulesStatus,
        `Failed to parse rules. Error: ${err.message}`,
        true
      );
    } finally {
      hideLoading(rulesStatus);
      updateRulesButton.disabled = false;
    }
  });
});
