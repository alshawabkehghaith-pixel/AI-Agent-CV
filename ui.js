// ui.js
// Entry point: wires DOM events and coordinates modules.

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

function updateRecommendationsStatus(message, isError = false) {
  const statusEl = document.getElementById("recommendation-status");
  if (!statusEl) return;
  statusEl.innerHTML = `
    <div class="status-message ${isError ? "status-error" : "status-success"}">
      ${message}
    </div>
  `;
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

function openCvModal(allCvResults, currentIndex = 0) {
  const modal = document.getElementById("cvModal");
  const tabs = document.getElementById("cvTabsContainer");
  const content = document.getElementById("cvResultsContainer");
  const submitBtn = document.getElementById("cvSubmitAll");
  if (!modal || !tabs || !content) return;

  // Center the modal using flex; matches CSS that expects flex display
  modal.style.display = "flex";
  tabs.innerHTML = "";
  content.innerHTML = "";

  if (submitBtn) {
    submitBtn.textContent = allCvResults.length > 1 ? "Submit all CVs" : "Submit CV";
  }

  allCvResults.forEach((cv, index) => {
    const tab = document.createElement("div");
    tab.className = "cv-tab";
    tab.textContent = cv.name;
    tab.dataset.index = index;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", index === currentIndex ? "true" : "false");
    if (index === currentIndex) tab.classList.add("active");

    tab.addEventListener("click", () => {
      // Save any edits from the currently visible CV before switching
      const updated = collectCvResultsFromForm();
      if (updated.length === allCvResults.length) {
        cvResultsForModal = updated;
        allCvResults = updated;
      }

      currentCvIndex = index;
      document.querySelectorAll(".cv-tab").forEach((t) => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      renderCvDetails(allCvResults[index]);
    });

    tabs.appendChild(tab);
  });

  renderCvDetails(allCvResults[currentIndex]);
}

function activateCvTab(index, allCvResults) {
  const tabs = document.querySelectorAll(".cv-tab");
  tabs.forEach((t) => t.classList.remove("active"));
  const tab = tabs[index];
  if (tab) tab.classList.add("active");
  renderCvDetails(allCvResults[index]);
}

function collectCvResultsFromForm() {
  const tabs = document.querySelectorAll(".cv-tab");
  const allResults = [];

  tabs.forEach((tab) => {
    const name = tab.textContent;
    const result = {
      name,
      experience: [],
      education: [],
      certifications: [],
      skills: [],
    };

    ["experience", "education", "certifications", "skills"].forEach((sec) => {
      const list = document.getElementById(`${name}_${sec}_list`);
      if (!list) return;

      if (sec === "skills") {
        list.querySelectorAll(".skill-bubble").forEach((bubble) => {
          const input = bubble.querySelector("input");
          if (input) {
            result.skills.push({ title: input.value });
          }
        });
      } else {
        list.querySelectorAll(".item-row").forEach((row) => {
          const entry = {};
          row.querySelectorAll("input, textarea").forEach((input) => {
            const key = input.dataset.field || input.placeholder.toLowerCase();
            entry[key] = input.value;
          });
          result[sec].push(entry);
        });
      }
    });

    allResults.push(result);
  });

  return allResults;
}

function buildCvTextFromResult(result) {
  const expText = (result.experience || [])
    .map((exp) => {
      const lines = [];
      if (exp.jobTitle || exp.company) {
        lines.push(`${exp.jobTitle || "Role"} at ${exp.company || ""}`.trim());
      }
      if (exp.years) lines.push(`${exp.years}`);
      if (exp.description) lines.push(exp.description);
      return lines.filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n\n");

  const eduText = (result.education || [])
    .map((edu) => {
      const lines = [];
      if (edu.degreeField) lines.push(edu.degreeField);
      if (edu.school) lines.push(edu.school);
      return lines.filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n\n");

  const certText = (result.certifications || [])
    .map((c) => c.title)
    .filter(Boolean)
    .join("\n");

  const skillsText = (result.skills || [])
    .map((s) => (typeof s === "string" ? s : s.title))
    .filter(Boolean)
    .join(", ");

  const parts = [];
  if (expText) parts.push(`Experience:\n${expText}`);
  if (eduText) parts.push(`Education:\n${eduText}`);
  if (certText) parts.push(`Certifications:\n${certText}`);
  if (skillsText) parts.push(`Skills:\n${skillsText}`);

  return parts.join("\n\n");
}

async function submitRecommendationsFromResults(results, userRules) {
  const recommendationsContainer = document.getElementById("recommendations-container");
  const resultsSection = document.getElementById("results-section");
  if (!recommendationsContainer || !resultsSection) return;

  updateRecommendationsStatus("Generating recommendations...", false);

  const cvPayload = results.map((cv) => ({
    name: cv.name,
    text: buildCvTextFromResult(cv),
    structured: cv,
  }));

  const recommendations = await analyzeCvsWithAI(cvPayload, userRules);

  displayRecommendations(recommendations, recommendationsContainer, resultsSection);
  updateRecommendationsStatus("Recommendations generated.", false);
  return { recommendations, cvPayload };
}

// ---------------------------------------------------------------------------
// Main bootstrap
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  let chatHistory = [];
  let userRules = loadUserRules();
  let uploadedCvs = [];
  let cvResultsForModal = [];
  let savedCvDrafts = [];
  let currentCvIndex = 0;
  let lastRecommendations = loadLastRecommendations();

  // Load catalog (async - loads from JSON file)
  await loadCertificateCatalog();

  // DOM
  const userInput = document.getElementById("user-input");
  const sendButton = document.getElementById("send-button");

  const fileInput = document.getElementById("file-input");
  const analyzeButton = document.getElementById("analyze-button");
  const cvUploadArea = document.getElementById("cv-upload-area");
  const submittedCvList = document.getElementById("submitted-cv-list");

  const rulesInput = document.getElementById("rules-input");
  const updateRulesButton = document.getElementById("update-rules");

  const uploadStatus = document.getElementById("upload-status");
  const rulesStatus = document.getElementById("rules-status");

  const resultsSection = document.getElementById("results-section");
  const recommendationsContainer = document.getElementById("recommendations-container");
  const cvSubmitAll = document.getElementById("cvSubmitAll");

  const renderSubmittedCvList = (list) => {
    if (!submittedCvList) return;
    submittedCvList.innerHTML = "";
    if (!list || list.length === 0) {
      submittedCvList.classList.add("hidden");
      return;
    }
    submittedCvList.classList.remove("hidden");
    list.forEach((cv, idx) => {
      const chip = document.createElement("div");
      chip.className = "submitted-cv-chip";
      chip.textContent = cv.name || `CV ${idx + 1}`;
      chip.addEventListener("click", () => {
        if (!savedCvDrafts.length) return;
        cvResultsForModal = [...savedCvDrafts];
        currentCvIndex = idx;
        openCvModal(cvResultsForModal, idx);
      });
      submittedCvList.appendChild(chip);
    });
  };

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
        updateStatus(
          uploadStatus,
          `Selected ${files.length} file(s): ${files.map((f) => f.name).join(", ")}`
        );
      } else if (uploadStatus) {
        uploadStatus.innerHTML = "";
      }
    });
  }

  // Analyze CVs
  if (analyzeButton) {
    analyzeButton.addEventListener("click", async () => {
      const files = Array.from(fileInput?.files || []);
      if (files.length === 0) {
        updateStatus(uploadStatus, "Please select at least one CV file.", true);
        return;
      }

      showLoading(uploadStatus, "Extracting text from CVs...");
      analyzeButton.disabled = true;
      uploadedCvs = [];
      cvResultsForModal = [];
      currentCvIndex = 0;

      try {
        // Extract and parse
        for (const file of files) {
          const rawText = await extractTextFromFile(file);
          const structuredSections = await parseCvIntoStructuredSections(rawText);
          uploadedCvs.push({
            name: file.name,
            text: rawText,
            structured: structuredSections,
          });
        }

        // Transform uploadedCvs to the format expected by the modal (rich view)
        cvResultsForModal = uploadedCvs.map((cv) => {
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

        openCvModal(cvResultsForModal);
        updateStatus(
          uploadStatus,
          `Loaded ${files.length} CV(s). Review and submit to save them.`
        );
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
  }

  // Rules update
  if (updateRulesButton) {
    updateRulesButton.addEventListener("click", async () => {
      const rulesText = (rulesInput?.value || "").trim();
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
        updateRulesButton.disabled = false;
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

  const modalEl = document.getElementById("cvModal");

  async function handleSubmit(targetResults) {
    try {
      // Preserve latest edits before saving
      savedCvDrafts = targetResults;
      cvResultsForModal = targetResults;

      // Store for chat context; no recommendations generation here
      uploadedCvs = targetResults.map((cv) => ({
        name: cv.name,
        text: buildCvTextFromResult(cv),
        structured: cv,
      }));

      renderSubmittedCvList(savedCvDrafts);
      updateStatus(uploadStatus, `Saved ${targetResults.length} CV(s).`, false);

      if (modalEl) modalEl.style.display = "none";
    } catch (err) {
      console.error("Submission Error:", err);
      updateStatus(uploadStatus, `Failed to save CVs: ${err.message}`, true);
    }
  }

  if (cvSubmitAll) {
    cvSubmitAll.addEventListener("click", async () => {
      const allResults = collectCvResultsFromForm();
      if (!allResults.length) return;
      await handleSubmit(allResults);
    });
  }
});

