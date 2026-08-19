/* =========================================================
   DEVELOPER MENTOR AI — PREMIUM FRONTEND CONTROLLER
   Compatible with the existing index.html structure.
   ========================================================= */

/* -----------------------------
   Browser-extension noise guard
----------------------------- */

window.addEventListener("error", (event) => {
  try {
    const filename = event?.filename || "";

    if (filename.startsWith("chrome-extension://")) {
      event.preventDefault();
      return true;
    }
  } catch (_) {}
});

window.addEventListener("unhandledrejection", (event) => {
  try {
    const message =
      event?.reason?.message || String(event?.reason || "");

    if (
      message.includes(
        "A listener indicated an asynchronous response by returning true"
      ) ||
      message.includes("chrome-extension://")
    ) {
      event.preventDefault();
      return true;
    }
  } catch (_) {}
});


/* =========================================================
   CONFIGURATION
   ========================================================= */

const API_URL = getApiUrl();
const SESSION_ID = getSessionId();

const state = {
  mode: "learn",
  level: "intermediate",
  teachingStyle: "direct",

  attachments: [],

  lastPrompt: "",
  lastAssistantMessage: null,

  abortController: null,
  isSending: false,

  modes: {},
};


/* =========================================================
   FALLBACK MODES
   ========================================================= */

const modeFallback = {
  learn: {
    label: "Learn",
    description: "Concepts, examples, exercises",
  },

  debug: {
    label: "Debug",
    description: "Errors, logs, hypotheses",
  },

  review: {
    label: "Code Review",
    description: "Severity-based feedback",
  },

  pair: {
    label: "Pair",
    description: "Build step by step",
  },

  project: {
    label: "Project",
    description: "Specs and milestones",
  },

  interview: {
    label: "Interview",
    description: "Practice with scoring",
  },

  systemDesign: {
    label: "System Design",
    description: "Architecture reasoning",
  },

  planner: {
    label: "Learning Path",
    description: "Personal roadmap",
  },
};


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", init);

async function init() {
  initTheme();
  bindEvents();

  state.modes = modeFallback;
  renderModes(state.modes);

  addWelcomeMessage();
  autoGrowInput();

  await Promise.allSettled([
    loadHealth(),
    loadModes(),
    loadProfile(),
    loadProjectSummary(),
    loadPlannerData(),
  ]);

  const input = document.getElementById("userInput");

  if (input) {
    input.focus();
  }
}


/* =========================================================
   EVENTS
   ========================================================= */

function bindEvents() {
  const chatForm = document.getElementById("chatForm");
  const stopBtn = document.getElementById("stopBtn");
  const newChatBtn = document.getElementById("newChatBtn");
  const themeToggle = document.getElementById("themeToggle");
  const levelSelect = document.getElementById("levelSelect");
  const teachingSelect = document.getElementById("teachingSelect");
  const fileInput = document.getElementById("fileInput");
  const profileForm = document.getElementById("profileForm");
  const userInput = document.getElementById("userInput");

  chatForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage();
  });

  stopBtn?.addEventListener("click", stopGeneration);

  newChatBtn?.addEventListener("click", resetChat);

  themeToggle?.addEventListener("click", toggleTheme);

  levelSelect?.addEventListener("change", (event) => {
    state.level = event.target.value;
  });

  teachingSelect?.addEventListener("change", (event) => {
    state.teachingStyle = event.target.value;
  });

  fileInput?.addEventListener("change", handleFiles);

  profileForm?.addEventListener("submit", saveProfile);

  document.querySelectorAll("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      const prompt = button.dataset.prompt || "";

      if (!prompt) return;

      if (userInput) {
        userInput.value = prompt;
        autoGrowInput();
        userInput.focus();
      }

      sendMessage(prompt);
    });
  });

  userInput?.addEventListener("input", autoGrowInput);

  userInput?.addEventListener("keydown", (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      event.preventDefault();
      sendMessage();
    }

    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      sendMessage();
    }

    if (event.key === "Escape" && state.isSending) {
      stopGeneration();
    }
  });
}


/* =========================================================
   INPUT
   ========================================================= */

function autoGrowInput() {
  const input = document.getElementById("userInput");

  if (!input) return;

  input.style.height = "auto";

  const height = Math.min(input.scrollHeight, 220);

  input.style.height = `${height}px`;
}


/* =========================================================
   API URL
   ========================================================= */

function getApiUrl() {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const port = window.location.port;

  if (protocol === "file:") {
    return "http://localhost:10000";
  }

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return port === "10000"
      ? window.location.origin
      : "http://localhost:10000";
  }

  if (
    hostname === "lavoro.umeshshah.in" ||
    hostname === "www.umeshshah.in"
  ) {
    return "https://api.lavoro.umeshshah.in";
  }

  return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
}


/* =========================================================
   SESSION
   ========================================================= */

function getSessionId() {
  const key = "developerMentorSessionId";

  const existing = localStorage.getItem(key);

  if (existing) {
    return existing;
  }

  const generated =
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `mentor-${Date.now()}-${Math.random()
          .toString(16)
          .slice(2)}`;

  localStorage.setItem(key, generated);

  return generated;
}


/* =========================================================
   HEALTH
   ========================================================= */

async function loadHealth() {
  const badge = document.getElementById("healthBadge");

  if (!badge) return;

  try {
    const data = await apiGet("/api/health");

    badge.innerHTML = `
      <span class="status-dot"></span>
      ${escapeHtml(data.status || "Online")}
      ${data.model ? ` · ${escapeHtml(data.model)}` : ""}
    `;

    badge.classList.add("online");
    badge.classList.remove("offline");
  } catch (_) {
    badge.innerHTML = `
      <span class="status-dot"></span>
      Backend offline
    `;

    badge.classList.add("offline");
    badge.classList.remove("online");
  }
}


/* =========================================================
   MODES
   ========================================================= */

async function loadModes() {
  try {
    const data = await apiGet("/api/ai/modes");

    state.modes =
      data?.modes && Object.keys(data.modes).length
        ? data.modes
        : modeFallback;

    renderModes(state.modes);
  } catch (_) {
    state.modes = modeFallback;
    renderModes(state.modes);
  }
}

function renderModes(modes) {
  const modeList = document.getElementById("modeList");

  if (!modeList) return;

  modeList.innerHTML = "";

  Object.entries(modes).forEach(([key, mode]) => {
    const button = document.createElement("button");

    button.type = "button";

    button.className =
      key === state.mode
        ? "mode-btn active"
        : "mode-btn";

    button.setAttribute(
      "aria-pressed",
      key === state.mode ? "true" : "false"
    );

    button.title =
      mode.description ||
      mode.label ||
      key;

    button.innerHTML = `
      <span>${escapeHtml(
        mode.label || key
      )}</span>
      <small>${escapeHtml(
        mode.description || ""
      )}</small>
    `;

    button.addEventListener("click", () => {
      state.mode = key;
      renderModes(state.modes);

      showToast(
        `${mode.label || key} mode selected`
      );
    });

    modeList.appendChild(button);
  });
}


/* =========================================================
   PROFILE
   ========================================================= */

async function loadProfile() {
  try {
    const data = await apiGet("/api/profile");

    const profile = data?.profile || {};

    setValue(
      "profileExperience",
      profile.experienceLevel || ""
    );

    setValue(
      "profileLanguages",
      Array.isArray(profile.languages)
        ? profile.languages.join(", ")
        : profile.languages || ""
    );

    setValue(
      "profileGoal",
      profile.goal || ""
    );

    setValue(
      "profileProject",
      profile.currentProject || ""
    );

    setValue(
      "levelSelect",
      profile.experienceLevel || "intermediate"
    );

    setValue(
      "teachingSelect",
      profile.preferredStyle || "direct"
    );

    state.level =
      document.getElementById("levelSelect")?.value ||
      "intermediate";

    state.teachingStyle =
      document.getElementById("teachingSelect")?.value ||
      "direct";
  } catch (_) {
    showToast("Using local profile defaults.");
  }
}


/* =========================================================
   PROJECT
   ========================================================= */

async function loadProjectSummary() {
  const target =
    document.getElementById("projectSummary");

  if (!target) return;

  try {
    const data =
      await apiGet("/api/project/structure");

    const summary =
      data?.project?.summary;

    if (!summary) {
      throw new Error("No project summary");
    }

    target.innerHTML = `
      <strong>${escapeHtml(
        summary.totalFiles ?? 0
      )}</strong> indexed files
      <br>
      ${escapeHtml(
        summary.frontendFiles ?? 0
      )} frontend
      ·
      ${escapeHtml(
        summary.backendFiles ?? 0
      )} backend
      ·
      ${escapeHtml(
        summary.testFiles ?? 0
      )} tests
    `;
  } catch (_) {
    target.textContent =
      "Project context unavailable.";
  }
}


/* =========================================================
   PLANNER
   ========================================================= */

async function loadPlannerData() {
  try {
    const [
      taskData,
      reminderData,
      planData,
    ] = await Promise.all([
      apiGet("/api/tasks"),
      apiGet("/api/reminders"),
      apiGet("/api/plans"),
    ]);

    renderTasks(taskData?.tasks || []);
    renderReminders(reminderData?.reminders || []);
    renderPlans(planData?.plans || []);
  } catch (_) {
    renderTasks([]);
    renderReminders([]);

    const dailyPlan =
      document.getElementById("dailyPlan");

    if (dailyPlan) {
      dailyPlan.textContent =
        "Planner data is unavailable right now.";
    }
  }
}

function renderTasks(tasks) {
  const list =
    document.getElementById("taskList");

  if (!list) return;

  list.innerHTML = "";

  if (!tasks.length) {
    list.innerHTML = `
      <li class="stack-item">
        <div>
          <strong>No active tasks</strong>
          <small>
            Ask the assistant to create one.
          </small>
        </div>
      </li>
    `;

    return;
  }

  tasks.slice(0, 5).forEach((task) => {
    const item =
      document.createElement("li");

    item.className = "stack-item";

    item.innerHTML = `
      <div>
        <strong>${escapeHtml(
          task.title || "Untitled task"
        )}</strong>
        <small>
          ${escapeHtml(
            task.due || "Later"
          )}
          ·
          ${escapeHtml(
            task.category || "General"
          )}
        </small>
      </div>

      <span class="stack-badge">
        ${escapeHtml(
          task.priority || "Medium"
        )}
      </span>
    `;

    list.appendChild(item);
  });
}

function renderReminders(reminders) {
  const list =
    document.getElementById("reminderList");

  if (!list) return;

  list.innerHTML = "";

  if (!reminders.length) {
    list.innerHTML = `
      <li class="stack-item">
        <div>
          <strong>No reminders</strong>
          <small>
            Ask the assistant to set one.
          </small>
        </div>
      </li>
    `;

    return;
  }

  reminders.slice(0, 5).forEach((reminder) => {
    const item =
      document.createElement("li");

    item.className = "stack-item";

    item.innerHTML = `
      <div>
        <strong>${escapeHtml(
          reminder.title || "Reminder"
        )}</strong>
        <small>
          ${escapeHtml(
            reminder.when || "Later"
          )}
        </small>
      </div>

      <span class="stack-badge">
        ${
          reminder.done
            ? "Done"
            : "Soon"
        }
      </span>
    `;

    list.appendChild(item);
  });
}

function renderPlans(plans) {
  const target =
    document.getElementById("dailyPlan");

  if (!target) return;

  if (!plans.length) {
    target.textContent =
      "No plan generated yet.";
    return;
  }

  const latest = plans[0];

  const taskNames =
    Array.isArray(latest.tasks)
      ? latest.tasks
          .map((task) => task.title)
          .filter(Boolean)
          .join(" • ")
      : "";

  target.innerHTML = `
    ${escapeHtml(
      latest.summary ||
        "Your daily plan is ready."
    )}
    ${
      taskNames
        ? `<br><small>${escapeHtml(
            taskNames
          )}</small>`
        : ""
    }
  `;
}


/* =========================================================
   CHAT
   ========================================================= */

async function sendMessage(promptOverride) {
  if (state.isSending) {
    return;
  }

  const input =
    document.getElementById("userInput");

  const prompt = String(
    promptOverride ??
      input?.value ??
      ""
  ).trim();

  if (!prompt) {
    input?.focus();
    return;
  }

  state.lastPrompt = prompt;

  if (input) {
    input.value = "";
    autoGrowInput();
  }

  addMessage(prompt, "user");

  const assistantMessage =
    addMessage("", "assistant", {
      streaming: true,
      model: "thinking",
    });

  state.lastAssistantMessage =
    assistantMessage;

  setSending(true);

  state.abortController =
    new AbortController();

  try {
    const response = await fetch(
      `${API_URL}/api/ai/stream`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "X-Session-Id":
            SESSION_ID,
        },

        body: JSON.stringify({
          message: prompt,
          mode: state.mode,
          level: state.level,
          teachingStyle:
            state.teachingStyle,
          attachments:
            state.attachments,
          includeProject:
            document.getElementById(
              "includeProject"
            )?.checked || false,
        }),

        signal:
          state.abortController.signal,
      }
    );

    if (!response.ok) {
      let message =
        "The mentor could not start a response.";

      try {
        const data =
          await response.json();

        message =
          data?.message ||
          data?.error ||
          message;
      } catch (_) {}

      throw new Error(message);
    }

    if (!response.body) {
      throw new Error(
        "Streaming is not available."
      );
    }

    await readStream(
      response.body,
      assistantMessage
    );

    state.attachments = [];

    renderAttachments();
  } catch (error) {
    if (error?.name === "AbortError") {
      updateMessage(
        assistantMessage,
        "Generation stopped."
      );
    } else {
      updateMessage(
        assistantMessage,
        `I couldn't complete that request.\n\n**Error:** ${
          error?.message || "Unknown error"
        }`
      );

      showToast(
        "The assistant could not complete the request."
      );
    }
  } finally {
    assistantMessage?.classList.remove(
      "streaming"
    );

    setSending(false);

    state.abortController = null;
  }
}


/* =========================================================
   STREAMING
   ========================================================= */

async function readStream(
  body,
  messageElement
) {
  const reader =
    body.getReader();

  const decoder =
    new TextDecoder();

  let buffer = "";
  let fullText = "";

  while (true) {
    const {
      value,
      done,
    } = await reader.read();

    if (done) break;

    buffer += decoder.decode(
      value,
      { stream: true }
    );

    const events =
      buffer.split("\n\n");

    buffer =
      events.pop() || "";

    for (const event of events) {
      const lines =
        event.split("\n");

      const dataLine =
        lines.find((line) =>
          line.startsWith("data:")
        );

      if (!dataLine) continue;

      const raw =
        dataLine
          .replace(/^data:\s?/, "")
          .trim();

      if (!raw) continue;

      let payload;

      try {
        payload =
          JSON.parse(raw);
      } catch (_) {
        continue;
      }

      if (payload.type === "chunk") {
        fullText +=
          payload.text || "";

        updateMessage(
          messageElement,
          fullText,
          payload.model
        );
      }

      if (payload.type === "error") {
        updateMessage(
          messageElement,
          payload.message ||
            "The assistant returned an error."
        );
      }

      if (payload.type === "done") {
        messageElement.classList.remove(
          "streaming"
        );

        messageElement.dataset.model =
          payload.model || "";

        addMessageActions(
          messageElement,
          fullText
        );
      }
    }
  }

  if (!fullText.trim()) {
    updateMessage(
      messageElement,
      "I didn't receive a response. Please try again."
    );
  }
}


/* =========================================================
   WELCOME
   ========================================================= */

function addWelcomeMessage() {
  addMessage(
    "Welcome. I'm your personal developer mentor. Ask me to explain concepts, debug code, review a project, plan your day, prepare for interviews, or help you build something step by step.",
    "assistant",
    {
      model: "mentor",
    }
  );
}


/* =========================================================
   ADD MESSAGE
   ========================================================= */

function addMessage(
  content,
  role,
  options = {}
) {
  const messages =
    document.getElementById(
      "chatMessages"
    );

  if (!messages) return null;

  const article =
    document.createElement("article");

  const roleClass =
    role === "user"
      ? "user"
      : "assistant";

  article.className =
    `message ${roleClass} ${roleClass}-message${
      options.streaming
        ? " streaming"
        : ""
    }`;

  article.dataset.raw =
    content || "";

  article.dataset.model =
    options.model || "";

  article.innerHTML = `
    <div class="message-meta">
      <strong>
        ${
          role === "user"
            ? "You"
            : "Developer Mentor AI"
        }
      </strong>

      <span>
        ${escapeHtml(
          options.model ||
            state.mode
        )}
      </span>
    </div>

    <div class="message-content">
      ${
        options.streaming
          ? renderThinking()
          : renderMarkdown(
              content
            )
      }
    </div>
  `;

  messages.appendChild(article);

  scrollChatToBottom();

  if (
    role === "assistant" &&
    content &&
    !options.streaming
  ) {
    addMessageActions(
      article,
      content
    );
  }

  return article;
}


/* =========================================================
   UPDATE MESSAGE
   ========================================================= */

function updateMessage(
  message,
  content,
  model
) {
  if (!message) return;

  message.dataset.raw =
    content || "";

  if (model) {
    message.dataset.model =
      model;
  }

  const meta =
    message.querySelector(
      ".message-meta span"
    );

  const contentElement =
    message.querySelector(
      ".message-content"
    );

  if (meta) {
    meta.textContent =
      model ||
      message.dataset.model ||
      state.mode;
  }

  if (contentElement) {
    contentElement.innerHTML =
      content
        ? renderMarkdown(content)
        : renderThinking();
  }

  scrollChatToBottom();

  bindCodeCopyButtons(message);
}


/* =========================================================
   THINKING INDICATOR
   ========================================================= */

function renderThinking() {
  return `
    <div class="ai-thinking">
      <span></span>
      <span></span>
      <span></span>
      <em>Thinking...</em>
    </div>
  `;
}


/* =========================================================
   MESSAGE ACTIONS
   ========================================================= */

function addMessageActions(
  message,
  content
) {
  if (!message) return;

  if (
    message.querySelector(
      ".message-actions"
    )
  ) {
    return;
  }

  const actions =
    document.createElement("div");

  actions.className =
    "message-actions";

  actions.innerHTML = `
    <button
      type="button"
      data-action="copy"
      title="Copy response"
    >
      <i class="fas fa-copy"></i>
      Copy
    </button>

    <button
      type="button"
      data-action="regenerate"
      title="Regenerate response"
    >
      <i class="fas fa-rotate"></i>
      Regenerate
    </button>
  `;

  const copyButton =
    actions.querySelector(
      '[data-action="copy"]'
    );

  copyButton?.addEventListener(
    "click",
    async () => {
      try {
        await copyText(
          content ||
            message.dataset.raw ||
            ""
        );

        const original =
          copyButton.innerHTML;

        copyButton.innerHTML =
          '<i class="fas fa-check"></i> Copied';

        setTimeout(() => {
          copyButton.innerHTML =
            original;
        }, 1200);
      } catch (_) {
        showToast(
          "Could not copy response."
        );
      }
    }
  );

  const regenerateButton =
    actions.querySelector(
      '[data-action="regenerate"]'
    );

  regenerateButton?.addEventListener(
    "click",
    () => {
      if (!state.lastPrompt) {
        showToast(
          "There is nothing to regenerate."
        );
        return;
      }

      sendMessage(
        state.lastPrompt
      );
    }
  );

  message.appendChild(actions);

  bindCodeCopyButtons(message);
}


/* =========================================================
   CODE COPY
   ========================================================= */

function bindCodeCopyButtons(
  scope = document
) {
  scope
    .querySelectorAll(".copy-code")
    .forEach((button) => {
      if (button.dataset.bound) {
        return;
      }

      button.dataset.bound =
        "true";

      button.addEventListener(
        "click",
        async () => {
          const block =
            button.closest(
              ".code-block"
            );

          const code =
            block?.querySelector(
              "code"
            )?.textContent || "";

          try {
            await copyText(code);

            const old =
              button.textContent;

            button.textContent =
              "Copied";

            setTimeout(() => {
              button.textContent =
                old;
            }, 1200);
          } catch (_) {
            showToast(
              "Could not copy code."
            );
          }
        }
      );
    });
}


/* =========================================================
   MARKDOWN RENDERER
   ========================================================= */

function renderMarkdown(markdown) {
  if (!markdown) {
    return "";
  }

  const codeBlocks = [];

  let text = String(markdown);

  text = text.replace(
    /```([a-zA-Z0-9_+#.-]*)\s*\n?([\s\S]*?)```/g,
    (_, language, code) => {
      const id =
        `__CODE_BLOCK_${codeBlocks.length}__`;

      codeBlocks.push({
        language:
          language || "code",

        code:
          code
            .replace(/\n$/, "")
            .trim(),
      });

      return id;
    }
  );

  text = escapeHtml(text);

  text = text.replace(
    /`([^`\n]+)`/g,
    "<code>$1</code>"
  );

  text = text.replace(
    /\*\*(.+?)\*\*/g,
    "<strong>$1</strong>"
  );

  text = text.replace(
    /^###\s(.+)$/gm,
    "<h3>$1</h3>"
  );

  text = text.replace(
    /^##\s(.+)$/gm,
    "<h2>$1</h2>"
  );

  text = text.replace(
    /^#\s(.+)$/gm,
    "<h2>$1</h2>"
  );

  text = text.replace(
    /^(?:[-*])\s(.+)$/gm,
    "<li>$1</li>"
  );

  text = text.replace(
    /(<li>.*<\/li>)(?:\n<li>.*<\/li>)*/gs,
    (match) => {
      return `<ul>${match}</ul>`;
    }
  );

  text = text.replace(
    /^\d+\.\s(.+)$/gm,
    "<li>$1</li>"
  );

  text = text.replace(
    /\n/g,
    "<br>"
  );

  codeBlocks.forEach(
    ({ language, code }, index) => {
      const safeCode =
        escapeHtml(code);

      const html = `
        <div class="code-block">
          <div>
            <span>
              ${escapeHtml(
                language
              )}
            </span>

            <button
              type="button"
              class="copy-code"
            >
              Copy
            </button>
          </div>

          <pre><code>${safeCode}</code></pre>
        </div>
      `;

      text = text.replace(
        `__CODE_BLOCK_${index}__`,
        html
      );
    }
  );

  return text;
}


/* =========================================================
   FILE ATTACHMENTS
   ========================================================= */

async function handleFiles(event) {
  const files =
    Array.from(
      event.target.files || []
    ).slice(0, 4);

  if (!files.length) {
    return;
  }

  const parsed =
    await Promise.all(
      files.map(
        async (file) => ({
          name: file.name,

          language:
            inferLanguage(
              file.name
            ),

          content:
            (await file.text())
              .slice(0, 12000),
        })
      )
    );

  state.attachments.push(
    ...parsed
  );

  state.attachments =
    state.attachments.slice(
      0,
      4
    );

  renderAttachments();

  showToast(
    `${parsed.length} file${
      parsed.length > 1
        ? "s"
        : ""
    } attached`
  );

  event.target.value = "";
}

function renderAttachments() {
  const tray =
    document.getElementById(
      "attachmentTray"
    );

  if (!tray) return;

  tray.innerHTML = "";

  tray.hidden =
    state.attachments.length === 0;

  state.attachments.forEach(
    (attachment, index) => {
      const chip =
        document.createElement(
          "button"
        );

      chip.type = "button";

      chip.className =
        "attachment-chip";

      chip.title =
        "Remove attachment";

      chip.innerHTML = `
        <i class="fas fa-file-code"></i>

        <span>
          ${escapeHtml(
            attachment.name
          )}
        </span>

        <i class="fas fa-xmark"></i>
      `;

      chip.addEventListener(
        "click",
        () => {
          state.attachments.splice(
            index,
            1
          );

          renderAttachments();
        }
      );

      tray.appendChild(chip);
    }
  );
}


/* =========================================================
   PROFILE SAVE
   ========================================================= */

async function saveProfile(event) {
  event.preventDefault();

  const profile = {
    experienceLevel:
      getValue(
        "profileExperience"
      ),

    languages:
      csv(
        getValue(
          "profileLanguages"
        )
      ),

    goal:
      getValue(
        "profileGoal"
      ),

    currentProject:
      getValue(
        "profileProject"
      ),

    preferredStyle:
      state.teachingStyle,
  };

  try {
    await apiPost(
      "/api/profile",
      profile
    );

    showToast(
      "Profile saved successfully."
    );
  } catch (_) {
    showToast(
      "Could not save profile."
    );
  }
}


/* =========================================================
   RESET CHAT
   ========================================================= */

async function resetChat() {
  if (state.isSending) {
    stopGeneration();
  }

  try {
    await apiPost(
      "/api/reset",
      {
        sessionId:
          SESSION_ID,
      }
    );
  } catch (_) {}

  const messages =
    document.getElementById(
      "chatMessages"
    );

  if (messages) {
    messages.innerHTML = "";
  }

  state.lastPrompt = "";
  state.lastAssistantMessage =
    null;

  state.attachments = [];

  renderAttachments();

  addWelcomeMessage();

  showToast(
    "New conversation started."
  );

  document
    .getElementById(
      "userInput"
    )
    ?.focus();
}


/* =========================================================
   STOP GENERATION
   ========================================================= */

function stopGeneration() {
  if (
    state.abortController
  ) {
    state.abortController.abort();
  }

  setSending(false);
}


/* =========================================================
   SENDING STATE
   ========================================================= */

function setSending(
  isSending
) {
  state.isSending =
    isSending;

  const sendBtn =
    document.getElementById(
      "sendBtn"
    );

  const stopBtn =
    document.getElementById(
      "stopBtn"
    );

  const input =
    document.getElementById(
      "userInput"
    );

  if (sendBtn) {
    sendBtn.disabled =
      isSending;

    sendBtn.classList.toggle(
      "loading",
      isSending
    );

    sendBtn.innerHTML =
      isSending
        ? `
          <span class="spinner"></span>
          Sending
        `
        : `
          <i class="fas fa-paper-plane"></i>
          Send
        `;
  }

  if (stopBtn) {
    stopBtn.disabled =
      !isSending;
  }

  if (input) {
    input.setAttribute(
      "aria-busy",
      isSending
        ? "true"
        : "false"
    );
  }
}


/* =========================================================
   THEME
   ========================================================= */

function initTheme() {
  const saved =
    localStorage.getItem(
      "developerMentorTheme"
    );

  const theme =
    saved || "dark";

  applyTheme(theme);
}

function toggleTheme() {
  const current =
    document.body.dataset.theme ||
    "dark";

  const next =
    current === "dark"
      ? "light"
      : "dark";

  applyTheme(next);

  showToast(
    `${capitalize(next)} theme enabled`
  );
}

function applyTheme(theme) {
  document.body.dataset.theme =
    theme;

  localStorage.setItem(
    "developerMentorTheme",
    theme
  );

  const button =
    document.getElementById(
      "themeToggle"
    );

  const icon =
    button?.querySelector("i");

  if (icon) {
    icon.className =
      theme === "dark"
        ? "fas fa-moon"
        : "fas fa-sun";
  }

  if (button) {
    button.setAttribute(
      "aria-label",
      theme === "dark"
        ? "Switch to light theme"
        : "Switch to dark theme"
    );
  }
}


/* =========================================================
   API HELPERS
   ========================================================= */

async function apiGet(path) {
  const response =
    await fetch(
      `${API_URL}${path}`,
      {
        method: "GET",

        headers: {
          "X-Session-Id":
            SESSION_ID,

          Accept:
            "application/json",
        },
      }
    );

  if (!response.ok) {
    throw new Error(
      `Request failed: ${response.status}`
    );
  }

  return response.json();
}

async function apiPost(
  path,
  body
) {
  const response =
    await fetch(
      `${API_URL}${path}`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "X-Session-Id":
            SESSION_ID,

          Accept:
            "application/json",
        },

        body:
          JSON.stringify(body),
      }
    );

  if (!response.ok) {
    throw new Error(
      `Request failed: ${response.status}`
    );
  }

  return response.json();
}


/* =========================================================
   TOAST
   ========================================================= */

function showToast(message) {
  const existing =
    document.querySelector(
      ".toast"
    );

  if (existing) {
    existing.remove();
  }

  const toast =
    document.createElement(
      "div"
    );

  toast.className =
    "toast";

  toast.setAttribute(
    "role",
    "status"
  );

  toast.innerHTML = `
    <span class="toast-icon">
      <i class="fas fa-check"></i>
    </span>

    <span>
      ${escapeHtml(message)}
    </span>
  `;

  document.body.appendChild(
    toast
  );

  requestAnimationFrame(() => {
    toast.classList.add(
      "show"
    );
  });

  setTimeout(() => {
    toast.classList.remove(
      "show"
    );

    setTimeout(
      () => toast.remove(),
      220
    );
  }, 2400);
}


/* =========================================================
   UTILITIES
   ========================================================= */

function setValue(
  id,
  value
) {
  const element =
    document.getElementById(id);

  if (element) {
    element.value = value;
  }
}

function getValue(id) {
  return (
    document.getElementById(id)
      ?.value || ""
  );
}

function csv(value) {
  return String(value || "")
    .split(",")
    .map(
      (item) =>
        item.trim()
    )
    .filter(Boolean);
}

function capitalize(value) {
  return (
    String(value)
      .charAt(0)
      .toUpperCase() +
    String(value).slice(1)
  );
}

function inferLanguage(
  fileName
) {
  const extension =
    fileName
      .split(".")
      .pop()
      .toLowerCase();

  const languages = {
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",

    ts: "typescript",
    tsx: "typescript",

    py: "python",

    java: "java",

    c: "c",
    h: "c",

    cpp: "cpp",
    hpp: "cpp",

    cs: "csharp",

    go: "go",

    rs: "rust",

    php: "php",

    rb: "ruby",

    swift: "swift",

    kt: "kotlin",

    sql: "sql",

    html: "html",
    htm: "html",

    css: "css",
    scss: "scss",

    json: "json",

    yml: "yaml",
    yaml: "yaml",

    md: "markdown",

    sh: "bash",
    bash: "bash",

    env: "dotenv",
  };

  return (
    languages[extension] ||
    "text"
  );
}

function escapeHtml(value) {
  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}

async function copyText(text) {
  if (
    navigator.clipboard &&
    window.isSecureContext
  ) {
    await navigator.clipboard.writeText(
      text
    );

    return;
  }

  const textarea =
    document.createElement(
      "textarea"
    );

  textarea.value = text;

  textarea.style.position =
    "fixed";

  textarea.style.opacity =
    "0";

  document.body.appendChild(
    textarea
  );

  textarea.select();

  document.execCommand(
    "copy"
  );

  textarea.remove();
}

function scrollChatToBottom() {
  const container =
    document.getElementById(
      "chatMessages"
    );

  if (!container) return;

  requestAnimationFrame(() => {
    container.scrollTo({
      top:
        container.scrollHeight,
      behavior: "smooth",
    });
  });
}