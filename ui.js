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
  if (generateBtn) {
    generateBtn.disabled = uploadedCvs.length === 0;
  }
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
  let submittedCvData = [];
  let lastProcessedFileNames = [];

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
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        submittedCvData = submittedCvData.filter((_, i) => i !== idx);
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
      const enhancedSystemPrompt = buildChatSystemPrompt(uploadedCvs, currentLang);

      let enhancedMessage = message;
      if (
        uploadedCvs.length > 0 &&
        (message.toLowerCase().includes("my") ||
          message.toLowerCase().includes("i have") ||
          message.toLowerCase().includes("i am") ||
          message.toLowerCase().includes("experience") ||
          message.toLowerCase().includes("skill") ||
          message.toLowerCase().includes("certification") ||
          message.toLowerCase().includes("recommend"))
      ) {
        const cvSummary = uploadedCvs
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
          uploadedCvs.length
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
      const files = Array.from(fileInput.files || []);
      if (files.length > 0) {
        const newFileNames = files.map(f => f.name).sort().join(',');
        if (newFileNames !== lastProcessedFileNames.sort().join(',')) {
          lastProcessedFileNames = [];
        }
        updateStatus(
          uploadStatus,
          `Selected ${files.length} file(s): ${files.map((f) => f.name).join(", ")}`
        );
        
        // ENABLE BUTTON IMMEDIATELY ON FILE UPLOAD
        const generateBtn = document.getElementById("generate-recommendations-btn");
        if (generateBtn) {
          generateBtn.disabled = false;
        }
      } else {
        if (uploadStatus) {
          uploadStatus.innerHTML = "";
        }
        lastProcessedFileNames = [];
        uploadedCvs = [];
        
        // DISABLE BUTTON WHEN FILES CLEARED
        const generateBtn = document.getElementById("generate-recommendations-btn");
        if (generateBtn) {
          generateBtn.disabled = true;
        }
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

  // Generate Recommendations button (SINGLE BUTTON - RUNS EVERYTHING)
  if (generateBtn) {
    generateBtn.addEventListener("click", async () => {
      // Step 1: Check if files are selected
      if (!fileInput || !fileInput.files || fileInput.files.length === 0 || !fileInput.value) {
        updateStatus(uploadStatus, "selectFile", true);
        generateBtn.disabled = true;
        return;
      }
      
      const files = Array.from(fileInput.files);
      
      generateBtn.disabled = true;
      
      try {
        // Step 2: Analyze CVs if not already analyzed
        if (uploadedCvs.length === 0) {
          showLoading(uploadStatus, "extracting");
          uploadedCvs = [];

          for (const file of files) {
            const rawText = await extractTextFromFile(file);
            console.log(`--- DEBUG: Extracted text from ${file.name} ---`);
            console.log(rawText);

            showLoading(uploadStatus, null, `${getStatusText('parsing')} (${file.name})`);
            const structuredSections = await parseCvIntoStructuredSections(rawText);
            
            console.log(`--- DEBUG: Parsed sections for ${file.name} ---`);
            console.log(structuredSections);

            uploadedCvs.push({
              name: file.name,
              text: rawText,
              structured: structuredSections,
            });
          }

          console.log("--- All parsed CVs ready for frontend ---");
          console.log(uploadedCvs);

          // Transform for modal
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
          
          openCvModal(cvResultsForModal, 0);
          updateStatus(uploadStatus, "success");
          hideLoading(uploadStatus);
          
          // Keep button enabled after opening modal
          generateBtn.disabled = false;
          return; // Stop here - wait for user to submit modal
        }

        // Step 3: If uploadedCvs already has data, generate recommendations
        console.log("📊 CVs already analyzed, generating recommendations...");
        showLoading(rulesStatus, "generating");
        
        // Get rules from UI
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

        // Generate recommendations
        const recommendations = await analyzeCvsWithAI(uploadedCvs, userRules, currentLang);

        lastRecommendations = recommendations;
        saveLastRecommendations(recommendations);

        displayRecommendations(
          recommendations,
          recommendationsContainer,
          resultsSection,
          currentLang
        );

        updateStatus(rulesStatus, "genSuccess");
        
        // Scroll to results
        setTimeout(() => {
          if (resultsSection) {
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            console.log('✅ Scrolled to recommendations section');
          }
        }, 300);

      } catch (err) {
        console.error("Generation Error:", err);
        updateStatus(
          rulesStatus,
          `Failed to generate. Error: ${err.message}`,
          true
        );
      } finally {
        hideLoading(uploadStatus);
        hideLoading(rulesStatus);
        // Keep button enabled if files are still in input
        if (fileInput && fileInput.files && fileInput.files.length > 0) {
          generateBtn.disabled = false;
        } else {
          generateBtn.disabled = true;
        }
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

  // Submit CV review - NOW GENERATES RECOMMENDATIONS TOO
  const submitCvReview = document.getElementById("submitCvReview");
  if (submitCvReview) {
    submitCvReview.addEventListener("click", async () => {
      console.log("🔵 Submit button clicked");
      
      syncActiveCvFromDom();
      const allResults = deepClone(modalCvData);

      console.log("FINAL SUBMITTED CV DATA →", allResults);
      console.log("uploadedCvs length:", uploadedCvs.length);
      console.log("uploadedCvs data:", uploadedCvs);
      
      submittedCvData = upsertByName(submittedCvData, allResults);
      renderSubmittedCvBubbles(submittedCvData);

      // Close modal first
      const modal = document.getElementById("cvModal");
      if (modal) {
        modal.style.display = "none";
        console.log('✅ Modal closed');
      }

      // Clear old recommendations
      if (recommendationsContainer) {
        recommendationsContainer.innerHTML = "";
      }
      if (resultsSection) {
        resultsSection.classList.add("hidden");
        resultsSection.style.display = "none";
      }

      // NOW GENERATE RECOMMENDATIONS AUTOMATICALLY
      try {
        console.log("📊 Starting recommendation generation...");
        console.log("Current language:", currentLang);
        console.log("uploadedCvs before generation:", uploadedCvs);
        
        showLoading(rulesStatus, "generating");
        
        // Get rules from UI
        const rules = getRulesFromUI();
        console.log("Rules from UI:", rules);
        
        if (rules.length > 0) {
          const rulesText = rules.join("\n");
          console.log("Parsing rules:", rulesText);
          userRules = await parseAndApplyRules(rulesText);
          saveUserRules(userRules);
          console.log("Parsed rules:", userRules);
        } else {
          userRules = [];
          saveUserRules(userRules);
          console.log("📝 No rules provided - AI will use its own reasoning");
        }

        console.log("Calling analyzeCvsWithAI...");
        console.log("Parameters:", { 
          cvCount: uploadedCvs.length, 
          rulesCount: userRules.length, 
          language: currentLang 
        });
        
        // Generate recommendations
        const recommendations = await analyzeCvsWithAI(uploadedCvs, userRules, currentLang);
        
        console.log("Recommendations received:", recommendations);
        
        lastRecommendations = recommendations;
        saveLastRecommendations(recommendations);

        console.log("Displaying recommendations...");
        displayRecommendations(
          recommendations,
          recommendationsContainer,
          resultsSection,
          currentLang
        );

        updateStatus(rulesStatus, "genSuccess");
        console.log("✅ Status updated");
        
        // Scroll to results
        setTimeout(() => {
          if (resultsSection) {
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            console.log('✅ Scrolled to recommendations section');
          }
        }, 300);
        
      } catch (err) {
        console.error("❌ Recommendation Error:", err);
        console.error("Error stack:", err.stack);
        updateStatus(
          rulesStatus,
          `Failed to generate recommendations. Error: ${err.message}`,
          true
        );
      } finally {
        hideLoading(rulesStatus);
        console.log("🔵 Submit handler completed");
      }

      // Keep button enabled for regeneration
      const generateBtn = document.getElementById("generate-recommendations-btn");
      if (generateBtn) {
        generateBtn.disabled = false;
      }
    });
  }
});
