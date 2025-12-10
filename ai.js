// ai.js
// API wrapper, prompts application, parsing, recommendation engine, and chat rendering helpers.

import {
  GEMINI_PROXY_URL,
  getFinalCertificateCatalog,
} from "./constants.js";

import {
  certificateCatalog,
  getCatalogAsPromptString,
  summarizeRecommendationsForChat,
  calculateYearsFromPeriod,
  calculateTotalExperience,
} from "./storage-catalog.js";

import {
  CHAT_SYSTEM_PROMPT_BASE,
  ANALYSIS_SYSTEM_PROMPT,
  RULES_SYSTEM_PROMPT,
  CV_PARSER_SYSTEM_PROMPT,
} from "./prompts.js";

// ---------------------------------------------------------------------------
// Proxy + Gemini call - INTEGRATED: Your proxy function
// ---------------------------------------------------------------------------
export async function callGeminiProxy(payload) {
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

export async function callGeminiAPI(userPrompt, history = [], systemPrompt = "") {
  const formattedHistory = history.map((msg) => ({
    role: msg.isUser ? "user" : "model",
    parts: [{ text: msg.text }],
  }));

  const combinedPrompt = systemPrompt
    ? `${systemPrompt.trim()}\n\nUser message:\n${userPrompt}`
    : userPrompt;

  const contents = [
    ...formattedHistory,
    { role: "user", parts: [{ text: combinedPrompt }] },
  ];

  const proxyPayload = { prompt: combinedPrompt, history: contents };
  return await callGeminiProxy(proxyPayload);
}

// ---------------------------------------------------------------------------
// Chat UI helpers (markdown + typing indicator)
// ---------------------------------------------------------------------------
export function addMessage(text, isUser = false) {
  const chatMessages = document.getElementById("chat-messages");
  if (!chatMessages) return;

  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${isUser ? "user-message" : "bot-message"}`;

  if (!isUser && typeof marked !== "undefined") {
    messageDiv.innerHTML = marked.parse(text);
  } else {
    messageDiv.innerHTML = text.replace(/\n/g, "<br>");
  }

  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

export function showTypingIndicator() {
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

export function hideTypingIndicator() {
  const typingIndicator = document.getElementById("typing-indicator");
  if (typingIndicator) {
    typingIndicator.remove();
  }
}

// ---------------------------------------------------------------------------
// Chat context builders
// ---------------------------------------------------------------------------
export function buildChatSystemPrompt(uploadedCvs) {
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

export function buildChatContextMessage(userMessage, userRules, lastRecommendations) {
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

// ---------------------------------------------------------------------------
// CV parsing helpers (PDF, DOCX, TXT)
// ---------------------------------------------------------------------------

// Configure PDF.js worker
if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

async function extractTextFromPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const strings = content.items.map((item) => item.str);
    fullText += strings.join(" ") + "\n\n";
  }
  return fullText;
}

async function extractTextFromDocx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer });
  return result.value || "";
}

export async function extractTextFromFile(file) {
  const name = file.name.toLowerCase();
  const type = file.type;

  if (type === "application/pdf" || name.endsWith(".pdf")) {
    return await extractTextFromPdf(file);
  }
  if (
    type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    return await extractTextFromDocx(file);
  }
  if (type === "text/plain" || name.endsWith(".txt")) {
    return await file.text();
  }

  console.warn(
    `Unknown file type (${type}, ${name}); attempting file.text() anyway.`
  );
  return await file.text();
}

export async function parseCvIntoStructuredSections(rawText) {
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

// ---------------------------------------------------------------------------
// Rule parsing
// ---------------------------------------------------------------------------
export async function parseAndApplyRules(rulesText) {
  const prompt = `
${RULES_SYSTEM_PROMPT.trim()}

User's rules:
${rulesText}

Remember:
- Respond with ONLY a JSON array of strings.
- No extra commentary or formatting.
`;

  const rawResponse = await callGeminiAPI(prompt, [], "");
  const cleaned = rawResponse.replace(/```json\s*|\s*```/g, "").trim();

  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) {
    throw new Error("Parsed rules are not an array.");
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Recommendation engine
// ---------------------------------------------------------------------------
export function buildAnalysisPromptForCvs(cvArray, rulesArray, language = 'en') {
  const catalogString = getCatalogAsPromptString();
  // Add Arabic instruction if needed
  const langInstruction = language === 'ar' 
    ? "Output the 'reason' field strictly in Arabic. Keep 'candidateName' and 'certName' in their original text."
    : "Output the 'reason' field in English.";
  return `
${ANALYSIS_SYSTEM_PROMPT.trim()}

**Catalog of Certifications:**
${catalogString}
${langInstruction}
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

**CRITICAL INSTRUCTIONS:**
- You MUST respond with ONLY a valid JSON object. Nothing else.
- Do NOT include any introductory text, explanations, comments, or markdown formatting.
- Do NOT wrap the JSON in code blocks like \`\`\`json or \`\`\`.
- Do NOT add any text before or after the JSON object.
- Start your response with { and end with }.
- The entire response must be parseable as JSON without any modifications.
- If no recommendations can be made for a candidate, provide an empty array [] for their "recommendations" field.

**Example of correct response format:**
{"candidates":[{"candidateName":"John Doe","recommendations":[]}]}

Begin your response now with the JSON object only:
`;
}

export async function analyzeCvsWithAI(cvArray, rulesArray, language = 'en') {
  const analysisPrompt = buildAnalysisPromptForCvs(cvArray, rulesArray || [], language);
  const rawResponse = await callGeminiAPI(analysisPrompt, [], "");
  
  // Log raw response for debugging
  console.log("Raw AI Response:", rawResponse);
  
  // Try multiple cleaning strategies
  let cleaned = rawResponse.trim();
  
  // Remove markdown code blocks
  cleaned = cleaned.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  
  // Try to extract JSON object if there's text before/after
  // Look for the first { and last } to extract the JSON object
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  
  // Remove any leading/trailing non-JSON text
  cleaned = cleaned.trim();

  let recommendations;
  try {
    recommendations = JSON.parse(cleaned);
  } catch (err) {
    console.error("JSON Parsing Error:", err);
    console.error("Cleaned response that failed to parse:", cleaned);
    console.error("First 500 chars of cleaned response:", cleaned.substring(0, 500));
    throw new Error(
      "The AI returned an invalid JSON format. Check the console for the raw response."
    );
  }
  return recommendations;
}

export function displayRecommendations(recommendations, containerEl, resultsSectionEl, language = 'en') {
  if (!containerEl || !resultsSectionEl) return;
  const catalog = getFinalCertificateCatalog(); // Load catalog
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

      // CV name (if available)
      if (candidate.cvName) {
        const cvNameDiv = document.createElement("div");
        cvNameDiv.className = "candidate-cv-name";
        cvNameDiv.textContent = candidate.cvName;
        candidateDiv.appendChild(cvNameDiv);
      }

      const nameDiv = document.createElement("h3");
      nameDiv.className = "candidate-name";
      const rawName = candidate.candidateName || "Candidate";
      // Avoid duplicate filename/title: if same as cvName, show a generic label
      if (
        candidate.cvName &&
        rawName.toLowerCase().trim() === candidate.cvName.toLowerCase().trim()
      ) {
        nameDiv.textContent = "Candidate";
      } else {
        nameDiv.textContent = rawName;
      }
      candidateDiv.appendChild(nameDiv);

      if (candidate.recommendations && candidate.recommendations.length > 0) {
        candidate.recommendations.forEach((rec) => {
          let displayName = rec.certName;
          if (language === 'ar') {
            const found = catalog.find(c => c.name === rec.certName || c.Certificate_Name_EN === rec.certName);
            if (found && found.nameAr) displayName = found.nameAr;
          }
          const card = document.createElement("div");
          card.className = "recommendation-card";
          card.innerHTML = `
            <div class="recommendation-title">${displayName}</div>
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

// Re-export utility used in UI for CV summary
export { calculateTotalExperience };
