// ui.js
// Entry point: wires DOM events, dynamic rules UI, and coordinates modules.

import {
  DEFAULT_RULES,
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

// ===========================================================================
// INTEGRATED: Dynamic Business Rules UI Functions (from your code)
// ===========================================================================

/**
 * Create a single rule input field with delete button
 */
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
    // Allow deleting all rules (no minimum check)
    wrapper.remove();
  });

  wrapper.appendChild(input);
  wrapper.appendChild(deleteBtn);
  return wrapper;
}

/**
 * Initialize the rules container with default or saved rules
 */
function initializeRulesUI(rules) {
  const container = document.getElementById("rules-container");
  if (!container) return;

  // Clear existing content except status overlay
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
    // Start with one empty input
    container.appendChild(createRuleInput());
  }
}

/**
 * Get all rules from the UI inputs
 */
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

/**
 * Enable/disable Start Recommending button based on CV upload status
 */
function updateStartRecommendingButton(uploadedCvs) {
  const startBtn = document.getElementById("start-recommending-btn");
  if (startBtn) {
    startBtn.disabled = uploadedCvs.length === 0;
  }
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
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

  // Normalize line breaks and insert breaks after periods to isolate sentences
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

  const sections = [
    {
      key: "experience",
      label: "Experience",
      fields: [
        {
          name: "jobTitle",
          placeholder: "Job Title",
          className: "cv-field-job-title",
          isBold: true,
        },
        {
          name: "company",
          placeholder: "Company Name",
          className: "cv-field-company",
        },
        {
          name: "description",
          placeholder: "Description",
          className: "cv-description-textarea",
          multiline: true,
        },
        { name: "years", placeholder: "Years" },
      ],
    },
    {
      key: "education",
      label: "Education",
      fields: [
        {
          name: "degreeField",
          placeholder: "Degree and Field of study",
          className: "education-degree-input",
          isBold: true,
        },
        { name: "school", placeholder: "School" },
      ],
    },
    {
      key: "certifications",
      label: "Certifications",
      fields: [{ name: "title", placeholder: "Certification" }],
    },
    {
      key: "skills",
      label: "Skills",
      fields: [{ name: "title", placeholder: "Skill" }],
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
    addBtn.textContent = `+ Add ${sec.label}`;
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

  // Center the modal using flex; matches CSS that expects flex display
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
      // Before switching, save current tab edits
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

  // Dynamic submit label
  if (submitBtn) {
    submitBtn.textContent = modalCvData.length > 1 ? "Submit all CVs" : "Submit CV";
  }
}

// ---------------------------------------------------------------------------
// Main bootstrap
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  let chatHistory = [];
  let userRules = loadUserRules();
  let uploadedCvs = [];
  let lastRecommendations = loadLastRecommendations();
  let submittedCvData = [];
  let lastProcessedFileNames = []; // Track last processed file names

  // Load catalog (async - loads from JSON file)
  await loadCertificateCatalog();

  // DOM elements
  const userInput = document.getElementById("user-input");
  const sendButton = document.getElementById("send-button");

  const fileInput = document.getElementById("file-input");
  const analyzeButton = document.getElementById("analyze-button");
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

      // Clicking the bubble re-opens the modal with that CV's extracted data
      bubble.addEventListener("click", () => {
        // Re-open modal with all submitted CVs and focus this one
        openCvModal(submittedCvData, idx);
      });

      container.appendChild(bubble);
    });
  };

  // INTEGRATED: Dynamic Rules UI elements
  const addRuleBtn = document.getElementById("add-rule-btn");
  const admitRulesBtn = document.getElementById("admit-rules-btn");
  const startRecommendingBtn = document.getElementById("start-recommending-btn");

  // INTEGRATED: Initialize rules UI with default rules
  initializeRulesUI(DEFAULT_RULES);
  userRules = [...DEFAULT_RULES];

  // Clear chat history in UI but keep stored messages if desired
  clearChatHistoryDom();
  // Clear stored chat so each page load starts fresh
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
      const enhancedSystemPrompt = buildChatSystemPrompt(uploadedCvs);

      // CV context snippet
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

      // Add rules + last recommendations context
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
      } else if (uploadStatus) {
        uploadStatus.innerHTML = "";
        // File input cleared - clear last processed names
        lastProcessedFileNames = [];
      }
    });
  }

  // Analyze CVs
  if (analyzeButton) {
    analyzeButton.addEventListener("click", async () => {
      // Check if file input has any files selected (check both value and files)
      if (!fileInput || !fileInput.files || fileInput.files.length === 0 || !fileInput.value) {
        // No new files selected – do not reuse previous uploads
        uploadedCvs = [];
        updateStartRecommendingButton(uploadedCvs);
        // Ensure file input is cleared
        if (fileInput) fileInput.value = "";
        updateStatus(uploadStatus, "Please upload a CV file first.", true);
        return;
      }
      
      const files = Array.from(fileInput.files);
      const currentFileNames = files.map(f => f.name).sort().join(',');
      
      // Check if these are the same files we just processed and submitted
      if (lastProcessedFileNames.length > 0 && 
          currentFileNames === lastProcessedFileNames.sort().join(',')) {
        // Same files as before - user needs to select new files
        uploadedCvs = [];
        updateStartRecommendingButton(uploadedCvs);
        updateStatus(uploadStatus, "Please upload a CV file first.", true);
        return;
      }

      showLoading(uploadStatus, "Extracting text from CVs...");
      analyzeButton.disabled = true;
      uploadedCvs = [];

      try {
        // Extract and parse
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
            text: rawText,
            structured: structuredSections,
          });
        }

        console.log("--- All parsed CVs ready for frontend ---");
        console.log(uploadedCvs);

        // INTEGRATED: Enable Start Recommending button
        updateStartRecommendingButton(uploadedCvs);

        // Transform uploadedCvs to the format expected by the modal (rich view)
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

        // Save processed file names to prevent reprocessing
        lastProcessedFileNames = files.map(f => f.name);
        
        openCvModal(cvResultsForModal, 0);
        updateStatus(uploadStatus, `Parsed ${files.length} CV(s). Review and submit.`);
        
        // Don't clear file input here - keep it until submission
        // It will be cleared in the submit handler
      } catch (err) {
        console.error("Analysis Error:", err);
        updateStatus(
          uploadStatus,
          `Failed to analyze CVs. Error: ${err.message}`,
          true
        );
        // Clear file input on error so user must select again
        if (fileInput) fileInput.value = "";
        uploadedCvs = [];
        updateStartRecommendingButton(uploadedCvs);
      } finally {
        hideLoading(uploadStatus);
        analyzeButton.disabled = false;
      }
    });
  }

  // ===========================================================================
  // INTEGRATED: Dynamic Business Rules UI Event Handlers
  // ===========================================================================

  // Add Rule button - Creates new empty input field
  if (addRuleBtn) {
    addRuleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const container = document.getElementById("rules-container");
      if (container) {
        const newInput = createRuleInput();
        // Insert before status overlay if it exists
        const statusOverlay = container.querySelector("#rules-status");
        if (statusOverlay) {
          container.insertBefore(newInput, statusOverlay);
        } else {
          container.appendChild(newInput);
        }
        // Focus on the new input
        const input = newInput.querySelector('input');
        if (input) input.focus();
      }
    });
  }

  // Admit Rules button - Saves and parses rules
  if (admitRulesBtn) {
    admitRulesBtn.addEventListener("click", async () => {
      const rules = getRulesFromUI();
      
      // Allow empty rules (user deleted all)
      if (rules.length === 0) {
        userRules = [];
        saveUserRules(userRules);
        updateStatus(
          rulesStatus,
          "All rules cleared. AI will use its own reasoning for recommendations."
        );
        addMessage(
          "I've cleared all business rules. I'll now use my own judgment when making recommendations.",
          false
        );
        return;
      }

      showLoading(rulesStatus, "Parsing rules with AI...");
      admitRulesBtn.disabled = true;

      try {
        // Convert rules array to text for AI parsing
        const rulesText = rules.join("\n");
        const parsedRules = await parseAndApplyRules(rulesText);
        userRules = parsedRules;
        saveUserRules(userRules);
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
        admitRulesBtn.disabled = false;
      }
    });
  }

  // Start Recommending button - Generates recommendations
  if (startRecommendingBtn) {
    startRecommendingBtn.addEventListener("click", async () => {
      // Check if CVs are uploaded
      if (uploadedCvs.length === 0) {
        updateStatus(
          rulesStatus,
          "Please upload and analyze CVs first.",
          true
        );
        return;
      }

      // Get current rules from UI (always use fresh UI state)
      const rules = getRulesFromUI();

      showLoading(rulesStatus, "Generating recommendations...");
      startRecommendingBtn.disabled = true;

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

        // Generate recommendations with current rules (empty array if no rules)
        const recommendations = await analyzeCvsWithAI(uploadedCvs, userRules);

        // Persist recommendations for chat grounding
        lastRecommendations = recommendations;
        saveLastRecommendations(recommendations);

        // Display recommendations
        displayRecommendations(
          recommendations,
          recommendationsContainer,
          resultsSection
        );

        updateStatus(rulesStatus, "Recommendations generated successfully!");
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
        hideLoading(rulesStatus);
        startRecommendingBtn.disabled = uploadedCvs.length === 0;
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
    submitCvReview.addEventListener("click", () => {
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
      updateStartRecommendingButton(uploadedCvs);

      // INTEGRATED: Close modal
      const modal = document.getElementById("cvModal");
      if (modal) {
        modal.style.display = "none";
        console.log('✅ Modal closed');
      }

      // Submit now only saves data; keep recommendations section hidden/reset
      if (recommendationsContainer) {
        recommendationsContainer.innerHTML = "";
      }
      if (resultsSection) {
        resultsSection.classList.add("hidden");
        resultsSection.style.display = "none";
      }
    });
  }
});


