// app.js (patched for real-time streaming via your Vercel WS proxy)
// ============================================================================
/*
  NOTE: This file is your original app.js with streaming additions.
  It attempts a WebSocket connection to:
  wss://backend-vercel-repo-git-main-jouds-projects-8f56041e.vercel.app/api/gemini-proxy
  If WS fails, it falls back to the existing HTTP proxy call.
*/

// ----------------------------- CONFIG & CONSTANTS --------------------------
const GEMINI_PROXY_HTTP = "https://backend-vercel-repo-git-main-jouds-projects-8f56041e.vercel.app/api/gemini-proxy";
const GEMINI_PROXY_WS = GEMINI_PROXY_HTTP.replace(/^https?:\/\//, "wss://");

// Unified helper - frontend calls backend proxy when available (HTTP fallback)
async function callGeminiProxy(payload) {
  const response = await fetch(GEMINI_PROXY_HTTP, {
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

// ---------- Safe JSON parse helper (prevents crashes on partial/invalid frames)
function safeParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

// ----------------------------- (existing constants) ------------------------
// (keep all your existing constants and arrays here unchanged)
const CHAT_HISTORY_KEY = "skillMatchChatHistory";
const CERT_CATALOG_KEY = "skillMatchCertCatalog";
const USER_RULES_KEY = "skillMatchUserRules";
const LAST_RECOMMENDATIONS_KEY = "skillMatchLastRecommendations";

// ... (the entire FINAL_CERTIFICATE_CATALOG array and all constants remain unchanged)
// For brevity I assume you pasted that whole block from your original file here.
// ----------------------------- (existing prompts) --------------------------

// (Keep all system prompts unchanged)
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

// (other prompts here: ANALYSIS_SYSTEM_PROMPT, RULES_SYSTEM_PROMPT, CV_PARSER_SYSTEM_PROMPT)
// ... keep unchanged ...

// ----------------------------- GLOBAL STATE --------------------------------
let certificateCatalog = []; // populated later
let chatHistory = [];               // [{ text: string, isUser: boolean }]
let userRules = [];                 // defaulted later
let uploadedCvs = [];               // [{ name: string, text: string, structured }]
let lastRecommendations = null;     // persisted recommendations for chat context

// ----------------------------- UI HELPERS ---------------------------------
function addMessage(text, isUser = false) {
  const chatMessages = document.getElementById("chat-messages");
  if (!chatMessages) return;

  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${isUser ? "user-message" : "bot-message"}`;
  
  if (!isUser && typeof marked !== 'undefined') {
    messageDiv.innerHTML = marked.parse(text);
  } else {
    messageDiv.innerHTML = text.replace(/\n/g, "<br>");
  }

  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

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

function hideTypingIndicator() {
  const typingIndicator = document.getElementById("typing-indicator");
  if (typingIndicator) {
    typingIndicator.remove();
  }
}

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

function showLoading(element, message) {
  if (!element) return;
  element.innerHTML = `<div class="loader"></div>${message}`;
}

function hideLoading(element) {
  if (!element) return;
  element.innerHTML = "";
}

// localStorage helpers (unchanged)
function saveChatHistory() {
  try {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chatHistory));
  } catch (err) {
    console.error("Failed to save chat history:", err);
  }
}

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

// (other storage helpers unchanged: saveUserRules, saveLastRecommendations, loadLastRecommendations, loadUserRules, clearChatHistory, catalog helpers...)

// ----------------------------- STREAMING HELPERS ---------------------------

/**
 * Create an empty bot message container where tokens will be appended as they arrive.
 * Returns the element to update live.
 */
function addStreamingMessageContainer() {
  const chatMessages = document.getElementById("chat-messages");
  if (!chatMessages) return null;

  // Remove typing indicator (if any) and create a streaming bubble
  hideTypingIndicator();

  const div = document.createElement("div");
  div.className = "message bot-message streaming-message";
  div.setAttribute("data-streaming", "true");
  div.innerHTML = "";   // starts empty
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

/**
 * Try streaming via your backend WebSocket proxy.
 * - wsUrl: the wss://... endpoint on your backend
 * - startPayload: an object the backend expects to begin the stream (we send prompt+history)
 * - onToken: callback(token) called each time a new token/text chunk arrives
 *
 * Returns a Promise that resolves with the full assembled text when stream ends.
 */
function streamGeminiResponseViaProxy(wsUrl, startPayload, onToken, opts = {}) {
  const timeoutMs = opts.timeoutMs || 60_000; // fallback timeout

  return new Promise((resolve, reject) => {
    let resolved = false;
    let fullText = "";
    let ws;

    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      return reject(err);
    }

    const clearAndResolve = (val) => {
      if (resolved) return;
      resolved = true;
      try { ws.close(); } catch(e){}
      resolve(val);
    };

    const clearAndReject = (err) => {
      if (resolved) return;
      resolved = true;
      try { ws.close(); } catch(e){}
      reject(err);
    };

    // Safety timeout
    const timer = setTimeout(() => {
      if (!resolved) {
        // try graceful close then reject
        try { ws.close(); } catch(e){}
        clearAndReject(new Error("Streaming timeout"));
      }
    }, timeoutMs);

    ws.onopen = () => {
      // Send a start event — backend should forward to Gemini and begin streaming
      ws.send(JSON.stringify({ type: "start", payload: startPayload }));
    };

    ws.onerror = (err) => {
      clearTimeout(timer);
      clearAndReject(new Error("WebSocket error"));
    };

    ws.onmessage = (evt) => {
      if (!evt || !evt.data) return;
      const raw = evt.data;

      // Some proxies forward JSON; some forward newline-delimited JSON; be permissive.
      // Try parse; fallback to raw text append.
      const maybe = safeParseJSON(raw);

      // Common Gemini streaming shapes:
      // 1) { choices: [{ delta: { content: "..." } }] }
      // 2) { event: "token", token: "..." }
      // 3) { text: "partial text" }
      if (maybe) {
        // case 1
        if (maybe.choices && Array.isArray(maybe.choices)) {
          const delta = maybe.choices[0].delta || {};
          const token = delta.content || delta.text || "";
          if (token) {
            fullText += token;
            try { onToken(token); } catch (e) { console.error(e); }
          }

          // Some proxies send a final "finish_reason" when done
          if (maybe.choices[0].finish_reason) {
            clearTimeout(timer);
            clearAndResolve(fullText);
          }
          return;
        }

        // case 2
        if (maybe.event === "token" && typeof maybe.token === "string") {
          fullText += maybe.token;
          try { onToken(maybe.token); } catch (e) { console.error(e); }
          return;
        }

        // case 3
        if (typeof maybe.text === "string") {
          fullText += maybe.text;
          try { onToken(maybe.text); } catch (e) { console.error(e); }
          return;
        }

        // final "end" event
        if (maybe.event === "end") {
          clearTimeout(timer);
          clearAndResolve(fullText);
          return;
        }
      }

      // If not JSON, treat as raw token text
      if (typeof raw === "string") {
        // Filter control frames like "[DONE]"
        if (raw.trim() === "[DONE]" || raw.trim() === "") {
          clearTimeout(timer);
          clearAndResolve(fullText);
          return;
        }

        // Otherwise append raw chunk
        fullText += raw;
        try { onToken(raw); } catch (e) { console.error(e); }
      }
    };

    ws.onclose = () => {
      clearTimeout(timer);
      if (!resolved) {
        // resolve with what we have (partial) rather than reject,
        // allow caller to decide what to do.
        clearAndResolve(fullText);
      }
    };
  });
}

// ----------------------------- AI HTTP WRAPPER (unchanged) -----------------
async function callGeminiAPI(userPrompt, history = [], systemPrompt = "") {
  // Format history for Gemini
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

// ----------------------------- CV parsing (unchanged) ----------------------
// include your extractTextFromFile, parseCvIntoStructuredSections, calculateYearsFromPeriod, extractYear, calculateTotalExperience, etc.
// (these functions are unchanged - copy them in here as-is from your original file)

// ----------------------------- RULE ENGINE (unchanged) ---------------------
// parseAndApplyRules(...) - unchanged

// ----------------------------- RECOMMENDATION ENGINE ----------------------
// buildAnalysisPromptForCvs(...) and analyzeCvsWithAI(...) unchanged

// ----------------------------- DISPLAY HELPERS (unchanged) ---------------
// displayRecommendations(...) unchanged

// ----------------------------- DOM & EVENTS --------------------------------
document.addEventListener("DOMContentLoaded", () => {
  // Load data
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
  const recommendationsContainer = document.getElementById("recommendations-container");

  // Clear chat history on page refresh (start fresh)
  clearChatHistory();

  // --- Chat send flow (UPDATED for streaming) ---
  async function handleSendMessage() {
    const message = (userInput.value || "").trim();
    if (!message) return;

    addMessage(message, true);
    chatHistory.push({ text: message, isUser: true });
    saveChatHistory();

    userInput.value = "";
    sendButton.disabled = true;

    // Show typing indicator while we attempt WS connection
    showTypingIndicator();

    try {
      // Build enhanced system prompt with certificate catalog and CV context
      const enhancedSystemPrompt = buildChatSystemPrompt();

      // Attach CV summary to the message if applicable (unchanged logic)
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

      enhancedMessage = buildChatContextMessage(enhancedMessage);

      // Attempt streaming via WS proxy
      const streamingContainer = addStreamingMessageContainer();
      let gotAnyToken = false;

      try {
        const startPayload = {
          prompt: enhancedMessage,
          // include history minimal representation; backend can translate if needed
          history: chatHistory.map((m) => ({ role: m.isUser ? "user" : "model", text: m.text })),
          model: "gemini-2.0-flash", // hint to backend
          stream: true,
        };

        await streamGeminiResponseViaProxy(GEMINI_PROXY_WS, startPayload, (token) => {
          gotAnyToken = true;
          // Append token into the streaming container (preserve markdown rendering later)
          // We append as plain text; after stream ends we optionally parse markdown
          streamingContainer.innerHTML += token;
          streamingContainer.scrollIntoView({ behavior: "auto", block: "end" });
        }, { timeoutMs: 120_000 });

        // streaming finished successfully
        const finalText = streamingContainer.textContent || streamingContainer.innerText || "";
        // replace streaming container innerHTML with marked-parsed version if available
        if (typeof marked !== 'undefined') {
          streamingContainer.innerHTML = marked.parse(finalText);
        }

        // Save message
        chatHistory.push({ text: finalText, isUser: false });
        saveChatHistory();
      } catch (streamErr) {
        console.warn("Streaming failed, falling back to HTTP:", streamErr);

        // remove streaming container (it may contain partial content)
        if (streamingContainer && streamingContainer.parentNode) {
          streamingContainer.remove();
        }

        // Show typing indicator while fallback runs
        showTypingIndicator();

        // Fallback: call existing HTTP proxy
        const reply = await callGeminiAPI(enhancedMessage, chatHistory, enhancedSystemPrompt);
        hideTypingIndicator();
        addMessage(reply, false);
        chatHistory.push({ text: reply, isUser: false });
        saveChatHistory();
      }

      // Ensure typing indicator is hidden (if still present)
      hideTypingIndicator();
    } catch (err) {
      console.error("Chat API Error:", err);
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

  // --- File upload & analyze flows (unchanged) ---
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

  // (the rest of the file: analyzeButton click handler, openCvModal, renderCvDetails, submitCvReview, updateRulesButton handler)
  // Please keep these blocks identical to your original file; no changes required for streaming integration.

}); // end DOMContentLoaded
