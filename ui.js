// ui.js
// Entry point: wires DOM events, dynamic rules UI, and coordinates modules.

import {
  DEFAULT_RULES,
  DEFAULT_RULES_EN,
  DEFAULT_RULES_AR,
  getDefaultRules,
} from "./constants.js";

import {
  saveChatHistory,
  loadChatHistory,
  saveUserRules,
  loadUserRules,
  saveLastRecommendations,
  loadLastRecommendations,
  loadCertificateCatalog,
  calculateTotalExperience,
  calculateYearsFromPeriod,
} from "./storage-catalog.js";

import {
  addMessage,
  showTypingIndicator,
  hideTypingIndicator,
  buildChatSystemPrompt,
  buildChatContextMessage,
  extractTextFromFile,
  parseCvIntoStructuredSections,
  parseAndApplyRules,
  analyzeCvsWithAI,
  displayRecommendations,
  callGeminiAPI,
} from "./ai.js";

// --- TRANSLATIONS FOR DYNAMIC UI ---
const UI_TEXT = {
  en: {
    experience: "Experience",
    education: "Education",
    certifications: "Certifications",
    skills: "Skills",
    jobTitle: "Job Title",
    company: "Company Name",
    description: "Description",
    years: "Years",
    degree: "Degree and Field of study",
    school: "School",
    certification: "Certification",
    skill: "Skill",
    add: "+ Add",
    submitSingle: "Submit CV",
    submitAll: "Submit all CVs"
  },
  ar: {
    experience: "الخبرة المهنية",
    education: "التعليم",
    certifications: "الشهادات",
    skills: "المهارات",
    jobTitle: "المسمى الوظيفي",
    company: "اسم الشركة",
    description: "الوصف",
    years: "السنوات",
    degree: "الدرجة ومجال الدراسة",
    school: "الجامعة / المدرسة",
    certification: "اسم الشهادة",
    skill: "المهارة",
    add: "+ إضافة",
    submitSingle: "إرسال السيرة الذاتية",
    submitAll: "إرسال جميع السير الذاتية"
  }
};

// --- TRANSLATIONS FOR STATUS MESSAGES ---
const STATUS_MESSAGES = {
  en: {
    analyzing: "Analyzing CVs with AI...",
    extracting: "Extracting text from CVs...",
    parsing: "Parsing CV into sections...",
    success: "Analysis complete! Review and submit.",
    error: "Failed to analyze CVs.",
    selectFile: "Please select at least one CV file.",
    generating: "Generating recommendations...",
    genSuccess: "Recommendations generated successfully!",
    rulesSaved: "Rules saved successfully.",
    rulesCleared: "Rules cleared."
  },
  ar: {
    analyzing: "جاري تحليل السير الذاتية بالذكاء الاصطناعي...",
    extracting: "جاري استخراج النص من الملفات...",
    parsing: "جاري تقسيم السيرة الذاتية إلى أقسام...",
    success: "اكتمل التحليل! يرجى المراجعة والإرسال.",
    error: "فشل في تحليل السير الذاتية.",
    selectFile: "يرجى اختيار ملف سيرة ذاتية واحد على الأقل.",
    generating: "جاري إصدار التوصيات...",
    genSuccess: "تم إصدار التوصيات بنجاح!",
    rulesSaved: "تم حفظ القواعد بنجاح.",
    rulesCleared: "تم مسح القواعد."
  }
};

function getStatusText(key) {
  const lang = document.documentElement.lang === 'ar' ? 'ar' : 'en';
  return STATUS_MESSAGES[lang][key] || STATUS_MESSAGES['en'][key];
}

function getUiText(key) {
  const lang = document.documentElement.lang === 'ar' ? 'ar' : 'en';
  return UI_TEXT[lang][key] || UI_TEXT['en'][key];
}

// ===========================================================================
// Dynamic Business Rules UI Functions
// ===========================================================================

function createRuleInput(ruleText = "") {
  const wrapper = document.createElement("div");
  wrapper.className = "rule-input-wrapper";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Enter a business rule...";
  input.value = ruleText;
  input.className = "rule-input";

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "delete-rule-btn";
  deleteBtn.innerHTML = "×";
  deleteBtn.title = "Delete this rule";
  
  deleteBtn.addEventListener("click", (e) => {
    e.preventDefault();
    wrapper.remove();
  });

  wrapper.appendChild(input);
  wrapper.appendChild(deleteBtn);
  return wrapper;
}

function initializeRulesUI(rules) {
  const container = document.getElementById("rules-container");
  if (!container) return;

  const statusOverlay = container.querySelector("#rules-status");
  container.innerHTML = "";
  if (statusOverlay) {
    container.appendChild(statusOverlay);
  }

  if (rules && rules.length > 0) {
    rules.forEach((rule) => {
      container.appendChild(createRuleInput(rule));
    });
  } else {
    container.appendChild(createRuleInput());
  }
}

function getRulesFromUI() {
  const container = document.getElementById("rules-container");
  if (!container) return [];

  const inputs = container.querySelectorAll(".rule-input");
  const rules = [];
  inputs.forEach((input) => {
    const value = input.value.trim();
    if (value) {
      rules.push(value);
    }
  });
  return rules;
}

function updateGenerateButton(uploadedCvs) {
  const generateBtn = document.getElementById("generate-recommendations-btn");
  const fileInput = document.getElementById("file-input");
  if (generateBtn) {
    // Enable if files are selected OR if there are uploaded CVs
    const hasFiles = fileInput && fileInput.files && fileInput.files.length > 0;
    const hasCvs = uploadedCvs.length > 0;
    generateBtn.disabled = !hasFiles && !hasCvs;
  }
}

// Alias for consistency with test folder naming
function updateStartRecommendingButton(uploadedCvs, submittedCvDataParam) {
  updateGenerateButton(uploadedCvs, submittedCvDataParam);
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
function updateStatus(element, messageKey, isError = false, rawText = null) {
  if (!element) return;
  const text = rawText || getStatusText(messageKey) || messageKey;
  
  element.innerHTML = `
    <div class="status-message ${isError ? "status-error" : "status-success"}">
      ${text}
    </div>
  `;
  setTimeout(() => { element.innerHTML = ""; }, 8000);
}

function showLoading(element, messageKey, rawText = null) {
  if (!element) return;
  const text = rawText || getStatusText(messageKey) || messageKey;
  element.innerHTML = `<div class="loader"></div>${text}`;
}

function hideLoading(element) {
  if (!element) return;
  element.innerHTML = "";
}

function clearChatHistoryDom() {
  const chatMessages = document.getElementById("chat-messages");
  if (chatMessages) {
    const initialMessage = chatMessages.querySelector(".bot-message");
    chatMessages.innerHTML = "";
    if (initialMessage) {
      chatMessages.appendChild(initialMessage);
    }
  }
}

// ---------------------------------------------------------------------------
// Modal helpers (CV review)
// ---------------------------------------------------------------------------
function formatDescriptionAsBullets(text) {
  if (!text) return "";

  const withBreaks = text.replace(/\r/g, "").replace(/\.\s+/g, ".\n");

  const sentences = [];
  withBreaks.split(/\n+/).forEach((part) => {
    const cleaned = part.replace(/^[\s•\-]+/, "").trim();
    if (!cleaned) return;
    cleaned
      .split(".")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => sentences.push(s));
  });

  if (sentences.length === 0) return text.trim();
  return sentences.map((s) => `• ${s}`).join("\n");
}

function createItemRow(item, fields) {
  const row = document.createElement("div");
  row.className = "item-row";

  const deleteBtn = document.createElement("span");
  deleteBtn.className = "delete-item-btn";
  deleteBtn.textContent = "×";
  deleteBtn.addEventListener("click", () => row.remove());
  row.appendChild(deleteBtn);

  fields.forEach((f) => {
    const field = typeof f === "string" ? { name: f } : f;
    const isTextarea = field.type === "textarea" || field.multiline;
    const isDescriptionField = field.name === "description";
    const input = document.createElement(isTextarea ? "textarea" : "input");
    if (!isTextarea) input.type = "text";
    let autoResizeFn = null;
    if (isTextarea) {
      input.rows = field.rows || 1;
      input.wrap = "soft";
      input.style.resize = "none";
      autoResizeFn = (el) => {
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      };
      autoResizeFn(input);
      input.addEventListener("input", () => autoResizeFn(input));
    }
    const placeholderText =
      field.placeholder ||
      (field.name
        ? field.name.charAt(0).toUpperCase() + field.name.slice(1)
        : "");
    input.placeholder = placeholderText;
    input.value = item[field.name] || "";
    if (isDescriptionField) {
      const applyFormattedBullets = () => {
        input.value = formatDescriptionAsBullets(input.value);
        if (autoResizeFn) autoResizeFn(input);
      };

      applyFormattedBullets();

      input.addEventListener("blur", () => {
        applyFormattedBullets();
      });

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const { selectionStart, selectionEnd, value } = input;
          const insertText = "\n• ";
          const newValue =
            value.slice(0, selectionStart) +
            insertText +
            value.slice(selectionEnd);
          input.value = newValue;
          const newPos = selectionStart + insertText.length;
          input.setSelectionRange(newPos, newPos);
          if (autoResizeFn) autoResizeFn(input);
        }
      });
    }
    input.dataset.field = field.name || "";
    if (field.className) input.classList.add(field.className);
    if (field.isBold) input.style.fontWeight = "700";
    if (autoResizeFn) {
      requestAnimationFrame(() => autoResizeFn(input));
    }
    row.appendChild(input);
  });

  return row;
}

function createSkillBubble(item, fields) {
  const bubble = document.createElement("div");
  bubble.className = "skill-bubble";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "skill-input";
  const primaryField =
    typeof fields[0] === "string" ? fields[0] : fields[0].name;
  input.placeholder =
    typeof fields[0] === "object" && fields[0].placeholder
      ? fields[0].placeholder
      : primaryField.charAt(0).toUpperCase() + primaryField.slice(1);
  const skillValue = item[primaryField] || item.title || "";
  input.value = skillValue;
  input.dataset.field = primaryField;
  const minWidth = 10;
  input.style.minWidth = `${minWidth}ch`;
  input.style.maxWidth = "20ch";
  const textLength = skillValue.length;
  const calculatedWidth = Math.max(minWidth, textLength + 1);
  input.style.width = `${calculatedWidth}ch`;
  input.addEventListener("input", (e) => {
    const newLength = e.target.value.length;
    const newWidth = Math.max(minWidth, newLength + 1);
    input.style.width = `${newWidth}ch`;
  });
  bubble.appendChild(input);
  const deleteBtn = document.createElement("span");
  deleteBtn.className = "delete-item-btn";
  deleteBtn.textContent = "×";
  deleteBtn.title = "Delete skill";
  deleteBtn.setAttribute("role", "button");
  deleteBtn.setAttribute("aria-label", "Delete skill");
  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    bubble.remove();
  });
  bubble.appendChild(deleteBtn);
  return bubble;
}

function renderCvDetails(cv) {
  const container = document.getElementById("cvResultsContainer");
  if (!container) return;
  container.innerHTML = "";

  const t = (k) => getUiText(k);

  const sections = [
    {
      key: "experience",
      label: t("experience"),
      fields: [
        {
          name: "jobTitle",
          placeholder: t("jobTitle"),
          className: "cv-field-job-title",
          isBold: true,
        },
        {
          name: "company",
          placeholder: t("company"),
          className: "cv-field-company",
        },
        {
          name: "description",
          placeholder: t("description"),
          className: "cv-description-textarea",
          multiline: true,
        },
        { name: "years", placeholder: t("years") },
      ],
    },
    {
      key: "education",
      label: t("education"),
      fields: [
        {
          name: "degreeField",
          placeholder: t("degree"),
          className: "education-degree-input",
          isBold: true,
        },
        { name: "school", placeholder: t("school") },
      ],
    },
    {
      key: "certifications",
      label: t("certifications"),
      fields: [{ name: "title", placeholder: t("certification") }],
    },
    {
      key: "skills",
      label: t("skills"),
      fields: [{ name: "title", placeholder: t("skill") }],
    },
  ];

  sections.forEach((sec) => {
    const secDiv = document.createElement("div");
    secDiv.className = "cv-section";
    secDiv.classList.add(`cv-section-${sec.key}`);
    secDiv.innerHTML = `<h3>${sec.label}</h3>`;

    let listDiv;
    if (sec.key === "skills") {
      listDiv = document.createElement("div");
      listDiv.className = "skills-bubble-list";
      listDiv.id = `${cv.name}_${sec.key}_list`;
      (cv[sec.key] || []).forEach((item) => {
        listDiv.appendChild(createSkillBubble(item, sec.fields));
      });
    } else {
      listDiv = document.createElement("div");
      listDiv.id = `${cv.name}_${sec.key}_list`;
      (cv[sec.key] || []).forEach((item) => {
        listDiv.appendChild(createItemRow(item, sec.fields));
      });
    }

    const addBtn = document.createElement("button");
    addBtn.className = "add-btn";
    addBtn.textContent = `${t("add")} ${sec.label}`;
    addBtn.addEventListener("click", () => {
      const emptyItem = {};
      sec.fields.forEach((f) => {
        const field = typeof f === "string" ? { name: f } : f;
        if (field.name) emptyItem[field.name] = "";
      });
      if (sec.key === "skills") {
        listDiv.appendChild(createSkillBubble(emptyItem, sec.fields));
      } else {
        listDiv.appendChild(createItemRow(emptyItem, sec.fields));
      }
    });
    secDiv.appendChild(listDiv);
    secDiv.appendChild(addBtn);
    container.appendChild(secDiv);
  });
}

// Modal state for CV review
let modalCvData = [];
let activeCvIndex = 0;

function upsertByName(existing, incoming) {
  const map = new Map();
  existing.forEach((cv) => {
    map.set(cv.name, cv);
  });
  incoming.forEach((cv) => {
    map.set(cv.name, cv);
  });
  return Array.from(map.values());
}

function deepClone(obj) {
  try {
    return structuredClone(obj);
  } catch (_) {
    return JSON.parse(JSON.stringify(obj));
  }
}

function readCvFromDom(cv) {
  if (!cv) return cv;
  const updated = deepClone(cv);
  ["experience", "education", "certifications", "skills"].forEach((sec) => {
    const list = document.getElementById(`${cv.name}_${sec}_list`);
    if (!list) return;
    if (sec === "skills") {
      updated.skills = [];
      list.querySelectorAll(".skill-bubble").forEach((bubble) => {
        const input = bubble.querySelector("input");
        if (input) updated.skills.push({ title: input.value });
      });
    } else {
      updated[sec] = [];
      list.querySelectorAll(".item-row").forEach((row) => {
        const entry = {};
        row.querySelectorAll("input, textarea").forEach((input) => {
          const key = input.dataset.field || input.placeholder.toLowerCase();
          entry[key] = input.value;
        });
        updated[sec].push(entry);
      });
    }
  });
  return updated;
}

function syncActiveCvFromDom() {
  if (!modalCvData.length) return;
  const current = modalCvData[activeCvIndex];
  const updated = readCvFromDom(current);
  modalCvData[activeCvIndex] = updated;
}

function openCvModal(allCvResults, initialIndex = 0) {
  const modal = document.getElementById("cvModal");
  const tabs = document.getElementById("cvTabsContainer");
  const content = document.getElementById("cvResultsContainer");
  const submitBtn = document.getElementById("submitCvReview");
  if (!modal || !tabs || !content) return;

  modalCvData = deepClone(allCvResults || []);
  activeCvIndex = initialIndex;

  modal.style.display = "flex";
  modal.removeAttribute("hidden");
  tabs.innerHTML = "";
  content.innerHTML = "";

  modalCvData.forEach((cv, index) => {
    const tab = document.createElement("div");
    tab.className = "cv-tab";
    tab.textContent = cv.name;
    tab.dataset.index = index;
    if (index === initialIndex) tab.classList.add("active");

    tab.addEventListener("click", () => {
      syncActiveCvFromDom();
      document
        .querySelectorAll(".cv-tab")
        .forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      activeCvIndex = index;
      renderCvDetails(modalCvData[index]);
    });

    tabs.appendChild(tab);
  });

  renderCvDetails(modalCvData[initialIndex] || modalCvData[0]);

  if (submitBtn) {
    submitBtn.textContent = modalCvData.length > 1 ? getUiText("submitAll") : getUiText("submitSingle");
  }
}

// ---------------------------------------------------------------------------
// Main bootstrap
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  const currentLang = document.documentElement.lang || 'en';
  let chatHistory = [];
  let userRules = loadUserRules();
  let uploadedCvs = [];
  let lastRecommendations = loadLastRecommendations();
  // Store recommendations per CV name
  let allRecommendationsMap = {};
  
  // Initialize map from saved recommendations if they exist
  if (lastRecommendations && lastRecommendations.candidates) {
    lastRecommendations.candidates.forEach((candidate) => {
      if (candidate.candidateName) {
        allRecommendationsMap[candidate.candidateName] = {
          candidateName: candidate.candidateName,
          cvName: candidate.cvName || candidate.candidateName,
          recommendations: candidate.recommendations || []
        };
      }
    });
  }

  let submittedCvData = [];
  let lastProcessedFileNames = [];

  // Helper: merge recommendations into map and display
  function applyRecommendationsToUi(recommendations, cvArray = uploadedCvs) {
    // Only show recommendations for the current uploaded CVs
    const currentCvNames = new Set((cvArray || []).map(cv => cv.name));
    allRecommendationsMap = {};

    if (recommendations && recommendations.candidates) {
      recommendations.candidates.forEach((candidate, index) => {
        // Prefer matching by index; fallback to name matching
        const cvFromIndex = cvArray && cvArray[index] ? cvArray[index] : null;
        const matchedByName = cvArray?.find(cv =>
          cv.name === candidate.candidateName ||
          candidate.candidateName === cv.name
        );
        const matchedCv = cvFromIndex || matchedByName;
        const cvName = matchedCv?.name || candidate.candidateName;

        if (!currentCvNames.has(cvName)) return; // skip stale CVs

        // Derive career title from structured data if available
        const structured = matchedCv?.structured || matchedCv;
        const inferredTitle =
          (structured?.experience && structured.experience[0]?.jobTitle) ||
          structured?.title ||
          "Candidate";

        allRecommendationsMap[cvName] = {
          candidateName: inferredTitle,
          cvName,
          recommendations: candidate.recommendations || []
        };
      });
    }

    const allRecommendations = {
      candidates: Object.values(allRecommendationsMap)
    };

    lastRecommendations = allRecommendations;
    saveLastRecommendations(allRecommendations);

    displayRecommendations(
      allRecommendations,
      recommendationsContainer,
      resultsSection,
      currentLang
    );
  }

  // Helper: rebuild a text blob from structured CV (fallback when raw text not present)
  function buildTextFromStructured(cv) {
    const parts = [];
    (cv.experience || []).forEach(exp => {
      parts.push(`Experience: ${exp.jobTitle || ""} at ${exp.company || ""} (${exp.years || exp.duration || ""}) - ${exp.description || ""}`);
    });
    (cv.education || []).forEach(edu => {
      parts.push(`Education: ${edu.degreeField || edu.degree || ""} at ${edu.school || ""}`);
    });
    (cv.certifications || []).forEach(cert => {
      parts.push(`Certification: ${cert.title || ""}`);
    });
    (cv.skills || []).forEach(skill => {
      parts.push(`Skill: ${skill.title || skill}`);
    });
    return parts.join("\n");
  }

  // Helper: ensure CV objects include text and structured fields
  function normalizeCvArray(cvArray) {
    return (cvArray || []).map((cv) => ({
      name: cv.name,
      text: cv.text || buildTextFromStructured(cv),
      structured: cv.structured || cv,
    }));
  }

  await loadCertificateCatalog();

  const userInput = document.getElementById("user-input");
  const sendButton = document.getElementById("send-button");

  const fileInput = document.getElementById("file-input");
  const cvUploadArea = document.getElementById("cv-upload-area");

  const uploadStatus = document.getElementById("upload-status");
  const rulesStatus = document.getElementById("rules-status");

  const resultsSection = document.getElementById("results-section");
  const recommendationsContainer = document.getElementById("recommendations-container");

  const renderSubmittedCvBubbles = (allResults) => {
    const container = document.getElementById("submitted-cv-bubbles");
    if (!container) return;
    container.innerHTML = "";

    allResults.forEach((cv, idx) => {
      const bubble = document.createElement("div");
      bubble.className = "cv-summary-bubble";
      bubble.title = "Click to re-open CV review";

      const nameEl = document.createElement("span");
      nameEl.className = "bubble-name";
      nameEl.textContent = cv.name || "CV";

      const metaEl = document.createElement("span");
      metaEl.className = "bubble-meta";
      const expCount = (cv.experience || []).length;
      const eduCount = (cv.education || []).length;
      const skillCount = (cv.skills || []).length;
      metaEl.textContent = `Exp: ${expCount} | Edu: ${eduCount} | Skills: ${skillCount}`;

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "delete-bubble-btn";
      deleteBtn.textContent = "×";
      deleteBtn.title = "Remove this CV";
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const cvToRemove = submittedCvData[idx];
        submittedCvData = submittedCvData.filter((_, i) => i !== idx);
        // Remove recommendations for deleted CV
        if (cvToRemove && cvToRemove.name && allRecommendationsMap[cvToRemove.name]) {
          delete allRecommendationsMap[cvToRemove.name];
          // Refresh recommendations display
          const allRecommendations = {
            candidates: Object.values(allRecommendationsMap)
          };
          if (recommendationsContainer && resultsSection) {
            displayRecommendations(
              allRecommendations,
              recommendationsContainer,
              resultsSection,
              currentLang
            );
          }
        }
        renderSubmittedCvBubbles(submittedCvData);
      });

      bubble.appendChild(nameEl);
      bubble.appendChild(metaEl);
      bubble.appendChild(deleteBtn);

      bubble.addEventListener("click", () => {
        openCvModal(submittedCvData, idx);
      });

      container.appendChild(bubble);
    });
  };

  const addRuleBtn = document.getElementById("add-rule-btn");
  const generateBtn = document.getElementById("generate-recommendations-btn");

  // ALWAYS use default rules on page load/refresh
  const defaultRulesForLang = getDefaultRules(currentLang);
  
  // Initialize UI with default rules (ignore localStorage)
  initializeRulesUI(defaultRulesForLang);
  userRules = [...defaultRulesForLang];
  
  // Save default rules to localStorage
  saveUserRules(userRules);

  clearChatHistoryDom();
  saveChatHistory([]);

  // Chat handler
  async function handleSendMessage() {
    const message = (userInput.value || "").trim();
    if (!message) return;

    addMessage(message, true);
    chatHistory.push({ text: message, isUser: true });
    saveChatHistory(chatHistory);

    userInput.value = "";
    sendButton.disabled = true;

    showTypingIndicator();

    try {
      // Use submittedCvData if available, otherwise use uploadedCvs
      const cvArrayForChat = submittedCvData.length > 0 ? submittedCvData : uploadedCvs;
      const normalizedCvsForChat = normalizeCvArray(cvArrayForChat);
      
      const enhancedSystemPrompt = buildChatSystemPrompt(normalizedCvsForChat, currentLang);

      let enhancedMessage = message;
      if (
        normalizedCvsForChat.length > 0 &&
        (message.toLowerCase().includes("my") ||
          message.toLowerCase().includes("i have") ||
          message.toLowerCase().includes("i am") ||
          message.toLowerCase().includes("experience") ||
          message.toLowerCase().includes("skill") ||
          message.toLowerCase().includes("certification") ||
          message.toLowerCase().includes("recommend"))
      ) {
        const cvSummary = normalizedCvsForChat
          .map((cv) => {
            const structured = cv.structured || {};
            const skills = (structured.skills || []).slice(0, 10).join(", ");
            const experience = structured.experience || [];
            const totalYears = calculateTotalExperience(experience);
            const recentRoles = experience
              .slice(0, 3)
              .map((exp) => exp.jobTitle || "")
              .filter(Boolean)
              .join(", ");
            return `${cv.name}: ${totalYears} years experience, recent roles: ${
              recentRoles || "N/A"
            }, skills: ${skills || "N/A"}`;
          })
          .join("\n");

        enhancedMessage = `${message}\n\n[Context: ${
          normalizedCvsForChat.length
        } CV(s) available. Summary: ${cvSummary}]`;
      }

      enhancedMessage = buildChatContextMessage(
        enhancedMessage,
        userRules,
        lastRecommendations
      );

      const reply = await callGeminiAPI(enhancedMessage, chatHistory, enhancedSystemPrompt);

      hideTypingIndicator();
      addMessage(reply, false);
      chatHistory.push({ text: reply, isUser: false });
      saveChatHistory(chatHistory);
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

  if (sendButton) sendButton.addEventListener("click", handleSendMessage);
  if (userInput) {
    userInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        handleSendMessage();
      }
    });
  }

  // File upload events
  if (cvUploadArea) {
    cvUploadArea.addEventListener("click", () => fileInput && fileInput.click());
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
      if (!fileInput) return;
      fileInput.files = e.dataTransfer.files;
      const files = Array.from(e.dataTransfer.files || []);
      if (files.length) {
        updateStatus(
          uploadStatus,
          `Selected ${files.length} file(s): ${files.map((f) => f.name).join(", ")}`
        );
        
        // ENABLE BUTTON IMMEDIATELY ON DRAG & DROP
        const generateBtn = document.getElementById("generate-recommendations-btn");
        if (generateBtn) {
          generateBtn.disabled = false;
        }
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", () => {
      uploadedCvs = [];
      const files = Array.from(fileInput.files || []);
      if (files.length > 0) {
        // New files selected - clear last processed names to allow processing
        const newFileNames = files.map(f => f.name).sort().join(',');
        if (newFileNames !== lastProcessedFileNames.sort().join(',')) {
          lastProcessedFileNames = [];
        }
        updateStatus(
          uploadStatus,
          `Selected ${files.length} file(s): ${files.map((f) => f.name).join(", ")}`
        );
        // Enable button when files are selected (button will analyze on click)
        const generateBtn = document.getElementById("generate-recommendations-btn");
        if (generateBtn) {
          generateBtn.disabled = false;
        }
      } else if (uploadStatus) {
        uploadStatus.innerHTML = "";
        // File input cleared - clear last processed names
        lastProcessedFileNames = [];
        // Disable button if no files and no submitted CVs
        updateGenerateButton(uploadedCvs);
      }
    });
  }

  // Add Rule button
  if (addRuleBtn) {
    addRuleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const container = document.getElementById("rules-container");
      if (container) {
        const newInput = createRuleInput();
        const statusOverlay = container.querySelector("#rules-status");
        if (statusOverlay) {
          container.insertBefore(newInput, statusOverlay);
        } else {
          container.appendChild(newInput);
        }
        const input = newInput.querySelector('input');
        if (input) input.focus();
      }
    });
  }

  // Shared CV rendering helper
  const upsertAndRenderSubmittedCvs = (cvResultsForModal) => {
    if (!cvResultsForModal || !cvResultsForModal.length) return;
    submittedCvData = upsertByName(submittedCvData, cvResultsForModal);
    renderSubmittedCvBubbles(submittedCvData);
  };

  // Helper to show/hide loading on button
  function setButtonLoading(button, isLoading) {
    if (!button) return;
    if (isLoading) {
      button.disabled = true;
      button.classList.add('loading');
      const originalHTML = button.innerHTML;
      button.dataset.originalHTML = originalHTML;
      // Replace content with spinner only
      button.innerHTML = '<span class="loader"></span>';
    } else {
      button.disabled = false;
      button.classList.remove('loading');
      if (button.dataset.originalHTML) {
        button.innerHTML = button.dataset.originalHTML;
        delete button.dataset.originalHTML;
      }
    }
  }

  // Extract+parse helper reused by Generate button
  async function runCvAnalysis({ statusElement = uploadStatus, openModal = true, suppressStatus = false } = {}) {
    if (!fileInput || !fileInput.files || fileInput.files.length === 0 || !fileInput.value) {
      uploadedCvs = [];
      updateGenerateButton(uploadedCvs);
      if (fileInput) fileInput.value = "";
      if (!suppressStatus && statusElement) {
        updateStatus(statusElement, "selectFile", true);
      }
      throw new Error("No files selected");
    }

    const files = Array.from(fileInput.files);

    if (!suppressStatus && statusElement) {
      showLoading(statusElement, "extracting");
    }
    uploadedCvs = [];

    try {
      for (const file of files) {
        const rawText = await extractTextFromFile(file);
        if (!suppressStatus && statusElement) {
          showLoading(statusElement, null, `${getStatusText('parsing')} (${file.name})`);
        }
        const structuredSections = await parseCvIntoStructuredSections(rawText);

        uploadedCvs.push({
          name: file.name,
          text: rawText,
          structured: structuredSections,
        });
      }

      updateGenerateButton(uploadedCvs);

      const cvResultsForModal = uploadedCvs.map((cv) => {
        const s = cv.structured || {};
        const totalYearsExperience = calculateTotalExperience(s.experience || []);
        return {
          name: cv.name,
          totalYearsExperience,
          experience: (s.experience || []).map((exp) => {
            const period = exp.period || exp.years || "";
            return {
              jobTitle: exp.jobTitle || exp.title || "",
              company: exp.company || exp.companyName || "",
              description: exp.description || "",
              years: period,
              duration: calculateYearsFromPeriod(period),
            };
          }),
          education: (s.education || []).map((edu) => ({
            degreeField:
              (edu.degree || edu.title || "")
                ? `${edu.degree || edu.title || ""}${
                    edu.major ? " in " + edu.major : ""
                  }`.trim()
                : edu.major || "",
            school: edu.school || edu.institution || "",
          })),
          certifications: (s.certifications || []).map((cert) => ({
            title: `${cert.title || ""}${
              cert.issuer ? " - " + cert.issuer : ""
            }${cert.year ? " (" + cert.year + ")" : ""}`,
          })),
          skills: (s.skills || []).map((skill) => ({
            title: typeof skill === "string" ? skill : skill.title || "",
          })),
        };
      });

      lastProcessedFileNames = files.map(f => f.name);

      upsertAndRenderSubmittedCvs(cvResultsForModal);

      if (openModal) {
        openCvModal(cvResultsForModal, 0);
      }

      if (!suppressStatus && statusElement) {
        updateStatus(statusElement, "success");
      }
      return { uploadedCvs, cvResultsForModal };
    } catch (err) {
      console.error("Analysis Error:", err);
      if (!suppressStatus && statusElement) {
        updateStatus(statusElement, "error", true);
      }
      if (fileInput) fileInput.value = "";
      uploadedCvs = [];
      updateGenerateButton(uploadedCvs);
      throw err;
    } finally {
      if (!suppressStatus && statusElement) {
        hideLoading(statusElement);
      }
    }
  }

  // Generate Recommendations button - Generates recommendations
  if (generateBtn) {
    generateBtn.addEventListener("click", async () => {
      // Start loading animation immediately
      setButtonLoading(generateBtn, true);

      // Analyze current selected CVs before generating (only if files are selected)
      let analysisResult = null;
      const hasNewFiles = fileInput && fileInput.files && fileInput.files.length > 0;
      if (hasNewFiles) {
        try {
          analysisResult = await runCvAnalysis({
            statusElement: rulesStatus,
            openModal: false,
            suppressStatus: true
          });
          if (analysisResult && analysisResult.cvResultsForModal) {
            submittedCvData = upsertByName(submittedCvData, analysisResult.cvResultsForModal);
            renderSubmittedCvBubbles(submittedCvData);
          }
        } catch (err) {
          setButtonLoading(generateBtn, false);
          return;
        }
      }

      // Get current rules from UI (always use fresh UI state)
      const rules = getRulesFromUI();

      try {
        // ALWAYS update userRules based on current UI state
        if (rules.length > 0) {
          // If there are rules, parse them
          const rulesText = rules.join("\n");
          userRules = await parseAndApplyRules(rulesText);
          saveUserRules(userRules);
        } else {
          // If user deleted all rules, use empty array (AI will use its own reasoning)
          userRules = [];
          saveUserRules(userRules);
          console.log("📝 No rules provided - AI will use its own reasoning");
        }

        // Decide which CVs to generate for: prefer submitted data; else newly analyzed; else current uploadedCvs
        const rawCvArrayForRec =
          submittedCvData.length > 0
            ? submittedCvData
            : analysisResult?.uploadedCvs || uploadedCvs;

        const cvArrayForRec = normalizeCvArray(rawCvArrayForRec);

        if (!cvArrayForRec || cvArrayForRec.length === 0) {
          throw new Error("No CVs available. Please upload or select CV files.");
        }

        // Generate recommendations with current rules (empty array if no rules)
        const recommendations = await analyzeCvsWithAI(cvArrayForRec, userRules, currentLang);

        // Merge and display recommendations (matching by CV index)
        applyRecommendationsToUi(recommendations, cvArrayForRec);

        setTimeout(() => {
          if (resultsSection) {
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            console.log('✅ Scrolled to recommendations section');
          }
        }, 300);
      } catch (err) {
        console.error("Recommendation Error:", err);
        updateStatus(
          rulesStatus,
          `Failed to generate recommendations. Error: ${err.message}`,
          true
        );
      } finally {
        setButtonLoading(generateBtn, false);
      }
    });
  }

  // Modal close behavior
  const closeBtn = document.querySelector(".cv-close-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      const modal = document.getElementById("cvModal");
      if (modal) modal.style.display = "none";
    });
  }
  window.addEventListener("click", (e) => {
    const modal = document.getElementById("cvModal");
    if (modal && e.target === modal) modal.style.display = "none";
  });

  // ===========================================================================
  // INTEGRATED: Submit CV review (with modal close and scroll)
  // ===========================================================================
  const submitCvReview = document.getElementById("submitCvReview");
  if (submitCvReview) {
    submitCvReview.addEventListener("click", async () => {
      // Save current tab edits back into modal state
      syncActiveCvFromDom();
      const allResults = deepClone(modalCvData);

      console.log("FINAL SUBMITTED CV DATA →", allResults);
      // Upsert by CV name so previously submitted CVs keep their content
      submittedCvData = upsertByName(submittedCvData, allResults);
      renderSubmittedCvBubbles(submittedCvData);

      // Clear file input so user must select new files for next analysis
      if (fileInput) {
        fileInput.value = "";
      }
      // Clear uploadedCvs so it doesn't process old data
      uploadedCvs = [];
      // Keep lastProcessedFileNames to prevent reprocessing same files
      // They will be cleared when new files are selected
      // Button should stay enabled since we have submitted CVs
      const generateBtn = document.getElementById("generate-recommendations-btn");
      if (generateBtn && submittedCvData.length > 0) {
        generateBtn.disabled = false;
      } else {
        updateGenerateButton(uploadedCvs);
      }

      // INTEGRATED: Close modal
      const modal = document.getElementById("cvModal");
      if (modal) {
        modal.style.display = "none";
        console.log('✅ Modal closed');
      }

      // Regenerate recommendations with updated CV data
      if (submittedCvData.length > 0) {
        // Use the Generate Recommendations button loading animation
        const generateBtn = document.getElementById("generate-recommendations-btn");
        if (generateBtn) {
          setButtonLoading(generateBtn, true);
        }
        
        try {
          // Get current rules from UI
          const rules = getRulesFromUI();
          
          if (rules.length > 0) {
            const rulesText = rules.join("\n");
            userRules = await parseAndApplyRules(rulesText);
            saveUserRules(userRules);
          } else {
            userRules = [];
            saveUserRules(userRules);
            console.log("📝 No rules provided - AI will use its own reasoning");
          }

          // Normalize submitted CV data for recommendations
          const cvArrayForRec = normalizeCvArray(submittedCvData);

          if (cvArrayForRec && cvArrayForRec.length > 0) {
            // Generate recommendations with updated CV data
            const recommendations = await analyzeCvsWithAI(cvArrayForRec, userRules, currentLang);

            // Merge and display recommendations (matching by CV index)
            applyRecommendationsToUi(recommendations, cvArrayForRec);

            updateStatus(rulesStatus, "genSuccess");
            
            // Scroll to results
            setTimeout(() => {
              if (resultsSection) {
                resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                console.log('✅ Scrolled to recommendations section');
              }
            }, 300);
          }
        } catch (err) {
          console.error("Regeneration Error:", err);
          updateStatus(
            rulesStatus,
            `Failed to regenerate recommendations. Error: ${err.message}`,
            true
          );
        } finally {
          if (generateBtn) {
            setButtonLoading(generateBtn, false);
          }
        }
      }
    });
  }
});
