/**
 * Lavoro — Personal AI Assistant & Productivity Workspace
 * Frontend Logic, State Management, API Communication, and UI Interactions
 */

const API_URL = getApiUrl();
const SESSION_ID = getSessionId();

// Application State
const state = {
	view: "assistant",
	mode: "assistant",
	theme: localStorage.getItem("lavoro-theme") || "light",
	isSending: false,
	abortController: null,
	attachments: [],
	hasStartedChat: false,
	taskFilter: "all",
	voiceActive: false,
	recognition: null,
	profile: {
		name: "Umesh Kumar",
		role: "Professional",
		goal: "Execute daily priorities efficiently and maintain focus",
		workingHours: "09:00 - 18:00",
		timezone: "Asia/Kolkata",
	},
	health: {
		status: "healthy",
		model: "gemini-3-flash-preview",
	},
};

// Data Store
const assistantData = {
	weather: {
		status: "ready",
		summary:
			"It's a pleasant 22°C and partly cloudy. Clear skies are expected throughout the day!",
	},
	calendar: {
		status: "ready",
		events: [
			{ time: "09:00 AM", title: "Team Standup", duration: "30 min" },
			{ time: "11:00 AM", title: "Project Review", duration: "1 hour" },
			{
				time: "02:00 PM",
				title: "Client Call",
				duration: "45 min",
				important: true,
			},
			{ time: "04:00 PM", title: "Code Review", duration: "30 min" },
		],
	},
	emails: {
		status: "ready",
		items: [
			{
				from: "manager@company.com",
				subject: "Q4 Goals Discussion",
				preview:
					"Please review the proposed goals before our afternoon sync.",
				date: "Today, 8:15 AM",
				priority: "high",
				unread: true,
			},
			{
				from: "design@company.com",
				subject: "Dashboard refresh notes",
				preview: "A few interface polish ideas are ready for review.",
				date: "Yesterday",
				priority: "medium",
				unread: true,
			},
		],
	},
	tasks: { status: "loading", items: [] },
	reminders: { status: "loading", items: [] },
	plans: { status: "loading", items: [] },
	conversations: { status: "loading", items: [] },
	dashboard: { status: "loading", metrics: null },
	knowledgeDocs: { status: "ready", items: [] },
	modes: {
		assistant: {
			label: "Daily Assistant",
			description:
				"Executive concierge for scheduling, drafting, and daily priorities.",
		},
		briefing: {
			label: "Morning Briefing",
			description:
				"Start-of-day briefing: weather, calendar, urgent emails, and tasks.",
		},
		planner: {
			label: "Day Planner",
			description:
				"Time-blocked daily schedule and dedicated focus intervals.",
		},
		tasks: {
			label: "Task Prioritization",
			description:
				"Eisenhower Matrix task breakdown and sequencing next actions.",
		},
		email: {
			label: "Email Triage",
			description:
				"Summarize inbox messages and draft concise responses.",
		},
		summary: {
			label: "Executive Summary",
			description:
				"End-of-day retrospective and productivity accomplishments.",
		},
	},
};

// Initialize Application
document.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
	applyTheme(state.theme);
	bindGlobalEvents();
	autoGrowTextarea();
	updateGreetingHeading();

	// Load dynamic data in parallel
	await Promise.allSettled([
		loadHealth(),
		loadProfile(),
		loadPlannerData(),
		loadModes(),
		loadDashboardMetrics(),
		loadConversations(),
	]);

	renderCurrentView();
	document.getElementById("userInput")?.focus();
}

/* ==========================================================================
   Event Bindings & Navigation
   ========================================================================== */

function bindGlobalEvents() {
	// Sidebar Navigation Items
	document.querySelectorAll(".nav-item").forEach((btn) => {
		btn.addEventListener("click", () => {
			const view = btn.dataset.view;
			if (view) setView(view);
		});
	});

	// Mobile Navigation Items
	document.querySelectorAll(".mobile-nav-btn").forEach((btn) => {
		btn.addEventListener("click", () => {
			const view = btn.dataset.view;
			if (view) setView(view);
		});
	});

	// Brand Logo Button -> Home/Assistant
	document.getElementById("brandLogoBtn")?.addEventListener("click", () => {
		setView("assistant");
	});

	// Theme Toggle Button
	document
		.getElementById("themeToggleBtn")
		?.addEventListener("click", toggleTheme);

	// Settings & Profile Modal Triggers
	document
		.getElementById("openSettingsBtn")
		?.addEventListener("click", () => openModal("settingsModal"));
	document
		.getElementById("userAvatarBtn")
		?.addEventListener("click", () => openModal("settingsModal"));
	document
		.getElementById("closeSettingsBtn")
		?.addEventListener("click", () => closeModal("settingsModal"));

	// Add Document Modal
	document
		.getElementById("addDocBtn")
		?.addEventListener("click", () => openModal("docModal"));
	document
		.getElementById("closeDocBtn")
		?.addEventListener("click", () => closeModal("docModal"));

	// Backdrop click to close modals
	document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
		backdrop.addEventListener("click", (e) => {
			if (e.target === backdrop) closeModal(backdrop.id);
		});
	});

	// Close modals on Escape key
	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape") {
			document
				.querySelectorAll(".modal-backdrop:not([hidden])")
				.forEach((el) => {
					closeModal(el.id);
				});
			closeModeMenu();
		}
	});

	// Mode Selector Dropdown in Header
	const modeBtn = document.getElementById("modeSelectorBtn");
	modeBtn?.addEventListener("click", (e) => {
		e.stopPropagation();
		toggleModeMenu();
	});

	document.addEventListener("click", (e) => {
		const menu = document.getElementById("modeMenu");
		if (
			menu &&
			!menu.hidden &&
			!menu.contains(e.target) &&
			!modeBtn?.contains(e.target)
		) {
			closeModeMenu();
		}
	});

	// Chat Form & Input Handling
	const chatForm = document.getElementById("chatForm");
	chatForm?.addEventListener("submit", (e) => {
		e.preventDefault();
		sendMessage();
	});

	const userInput = document.getElementById("userInput");
	userInput?.addEventListener("input", autoGrowTextarea);
	userInput?.addEventListener("keydown", (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	});

	// File Attachment Input
	document
		.getElementById("fileInput")
		?.addEventListener("change", handleFileUpload);

	// Voice Input Button
	document
		.getElementById("voiceBtn")
		?.addEventListener("click", toggleVoiceInput);

	// Stop Streaming Button
	document
		.getElementById("stopBtn")
		?.addEventListener("click", stopStreaming);

	// New Chat / Reset Header Button
	document
		.getElementById("newChatHeaderBtn")
		?.addEventListener("click", resetChatSession);

	// Quick Action Pills
	document.querySelectorAll(".action-pill").forEach((pill) => {
		pill.addEventListener("click", () => {
			const prompt = pill.dataset.prompt;
			if (prompt) {
				const input = document.getElementById("userInput");
				if (input) input.value = prompt;
				setView("assistant");
				sendMessage(prompt);
			}
		});
	});

	// Composer Quick Mode Chips
	document.querySelectorAll(".composer-chip-btn").forEach((chip) => {
		chip.addEventListener("click", () => {
			const targetMode = chip.dataset.quickMode;
			if (targetMode) {
				setMode(targetMode);
				showToast(`AI mode set to: ${assistantData.modes[targetMode]?.label || targetMode}`);
			}
		});
	});

	// Inline Task Form
	document
		.getElementById("inlineTaskForm")
		?.addEventListener("submit", handleCreateTask);

	// Task Filter Tabs
	document.querySelectorAll("[data-task-filter]").forEach((tab) => {
		tab.addEventListener("click", () => {
			state.taskFilter = tab.dataset.taskFilter;
			document.querySelectorAll("[data-task-filter]").forEach((t) => {
				t.classList.toggle("active", t === tab);
				t.setAttribute(
					"aria-selected",
					t === tab ? "true" : "false",
				);
			});
			renderTasksView();
		});
	});

	// Inline Reminder Form
	document
		.getElementById("inlineReminderForm")
		?.addEventListener("submit", handleCreateReminder);

	// Planner "Let Lavoro plan my day" Button
	document
		.getElementById("aiPlanDayBtn")
		?.addEventListener("click", handleAiPlanDay);

	// Briefing Buttons
	document
		.getElementById("refreshBriefingBtn")
		?.addEventListener("click", async () => {
			await loadPlannerData();
			renderBriefingView();
			showToast("Briefing refreshed.");
		});
	document
		.getElementById("askAiBriefingBtn")
		?.addEventListener("click", () => {
			setView("assistant");
			setMode("briefing");
			sendMessage("Deliver my morning briefing.");
		});

	// Knowledge Search Form
	document
		.getElementById("knowledgeSearchForm")
		?.addEventListener("submit", handleKnowledgeSearch);
	document
		.getElementById("clearKnowledgeSearchBtn")
		?.addEventListener("click", clearKnowledgeSearch);

	// Add Document Form in Modal
	document
		.getElementById("addDocForm")
		?.addEventListener("submit", handleAddDocument);

	// Profile Form
	document
		.getElementById("profileForm")
		?.addEventListener("submit", handleSaveProfile);

	// Demo Auth Actions
	document
		.getElementById("demoLoginBtn")
		?.addEventListener("click", handleDemoLogin);
	document
		.getElementById("logoutBtn")
		?.addEventListener("click", handleResetSession);

	// Refresh Dashboard Button
	document
		.getElementById("refreshDashboardBtn")
		?.addEventListener("click", async () => {
			await loadDashboardMetrics();
			renderDashboardView();
			showToast("Productivity metrics updated.");
		});

	// Reset Chat from Conversation History
	document
		.getElementById("resetChatFromHistoryBtn")
		?.addEventListener("click", resetChatSession);

	// Keyboard Shortcut: Cmd/Ctrl + K to switch mode or focus
	document.addEventListener("keydown", (e) => {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
			e.preventDefault();
			toggleModeMenu();
		}
	});
}

/* ==========================================================================
   View Routing & Navigation
   ========================================================================== */

function setView(viewName) {
	state.view = viewName;

	// Update Sidebar Nav
	document.querySelectorAll(".nav-item").forEach((btn) => {
		const isActive = btn.dataset.view === viewName;
		btn.classList.toggle("active", isActive);
		if (isActive) btn.setAttribute("aria-current", "page");
		else btn.removeAttribute("aria-current");
	});

	// Update Mobile Nav
	document.querySelectorAll(".mobile-nav-btn").forEach((btn) => {
		const isActive = btn.dataset.view === viewName;
		btn.classList.toggle("active", isActive);
	});

	// Hide all view panes, show the active one
	const views = [
		"assistant",
		"tasks",
		"planner",
		"reminders",
		"briefing",
		"knowledge",
		"conversations",
		"dashboard",
	];

	views.forEach((v) => {
		const el = document.getElementById(
			`view${v.charAt(0).toUpperCase() + v.slice(1)}`,
		);
		if (el) {
			if (v === viewName) {
				el.hidden = false;
				el.classList.add("active");
			} else {
				el.hidden = true;
				el.classList.remove("active");
			}
		}
	});

	// Update Breadcrumb Label
	const viewNamesMap = {
		assistant: "Assistant",
		tasks: "Tasks & Priorities",
		planner: "Day Planner",
		reminders: "Reminders",
		briefing: "Daily Briefing",
		knowledge: "Knowledge Base",
		conversations: "Conversations",
		dashboard: "Dashboard",
	};

	const currentLabel = document.getElementById("currentViewLabel");
	if (currentLabel) {
		currentLabel.textContent = viewNamesMap[viewName] || "Workspace";
	}

	renderCurrentView();
}

function renderCurrentView() {
	switch (state.view) {
		case "assistant":
			renderAssistantView();
			break;
		case "tasks":
			renderTasksView();
			break;
		case "planner":
			renderPlannerView();
			break;
		case "reminders":
			renderRemindersView();
			break;
		case "briefing":
			renderBriefingView();
			break;
		case "knowledge":
			renderKnowledgeView();
			break;
		case "conversations":
			renderConversationsView();
			break;
		case "dashboard":
			renderDashboardView();
			break;
	}
}

/* ==========================================================================
   AI Productivity Modes
   ========================================================================== */

function setMode(modeKey) {
	state.mode = modeKey;
	const modeObj = assistantData.modes[modeKey] || {
		label: modeKey,
		description: "",
	};

	const labelEl = document.getElementById("currentModeLabel");
	if (labelEl) labelEl.textContent = modeObj.label;

	renderModeMenu();
	closeModeMenu();
}

function toggleModeMenu() {
	const menu = document.getElementById("modeMenu");
	const btn = document.getElementById("modeSelectorBtn");
	if (!menu) return;

	const isOpen = !menu.hidden;
	menu.hidden = isOpen;
	btn?.setAttribute("aria-expanded", isOpen ? "false" : "true");
	if (!isOpen) renderModeMenu();
}

function closeModeMenu() {
	const menu = document.getElementById("modeMenu");
	const btn = document.getElementById("modeSelectorBtn");
	if (menu) menu.hidden = true;
	btn?.setAttribute("aria-expanded", "false");
}

function renderModeMenu() {
	const container = document.getElementById("modeMenuOptions");
	if (!container) return;

	container.innerHTML = Object.entries(assistantData.modes)
		.map(([key, mode]) => {
			const isSelected = key === state.mode;
			return `
				<button class="mode-menu-option ${isSelected ? "selected" : ""}" type="button" data-mode-key="${escapeHtml(key)}">
					<div class="mode-opt-title">
						<span>${escapeHtml(mode.label)}</span>
						${isSelected ? '<span class="pill-sparkle">✓</span>' : ""}
					</div>
					<div class="mode-opt-desc">${escapeHtml(mode.description)}</div>
				</button>
			`;
		})
		.join("");

	container.querySelectorAll("[data-mode-key]").forEach((btn) => {
		btn.addEventListener("click", () => {
			setMode(btn.dataset.modeKey);
		});
	});
}

async function loadModes() {
	try {
		const res = await apiGet("/api/ai/modes");
		if (res.success && res.modes) {
			assistantData.modes = res.modes;
			const modeObj = res.modes[state.mode];
			if (modeObj) {
				const labelEl = document.getElementById("currentModeLabel");
				if (labelEl) labelEl.textContent = modeObj.label;
			}
		}
	} catch (_) {}
}

/* ==========================================================================
   AI Chat & Streaming Engine
   ========================================================================== */

async function sendMessage(promptOverride) {
	if (state.isSending) return;

	const input = document.getElementById("userInput");
	const prompt = String(promptOverride ?? input?.value ?? "").trim();
	if (!prompt) {
		input?.focus();
		return;
	}

	if (input) {
		input.value = "";
		autoGrowTextarea();
	}

	// Switch to assistant view and reveal conversation container
	if (state.view !== "assistant") {
		setView("assistant");
	}

	state.hasStartedChat = true;
	const hero = document.getElementById("assistantHero");
	const chatThread = document.getElementById("chatThreadContainer");
	if (hero) hero.classList.add("minimized");
	if (chatThread) chatThread.hidden = false;

	// Render user message bubble
	addMessage(prompt, "user");

	// Create assistant placeholder message
	const assistantMessage = addMessage("", "assistant", {
		streaming: true,
		model: state.health.model || "gemini-3-flash-preview",
	});

	setSendingState(true);
	state.abortController = new AbortController();

	try {
		const response = await fetch(`${API_URL}/api/ai/stream`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Session-Id": SESSION_ID,
			},
			body: JSON.stringify({
				message: prompt,
				mode: state.mode,
				attachments: state.attachments,
				includeProject:
					document.getElementById("includeProject")?.checked || false,
				assistantContext: buildAssistantContext(),
			}),
			signal: state.abortController.signal,
		});

		if (!response.ok || !response.body) {
			throw new Error("Unable to establish streaming response.");
		}

		await readServerStream(response.body, assistantMessage);
		state.attachments = [];
		renderAttachmentTray();

		// Refresh data after agent tool calls (e.g. task/reminder creation)
		await Promise.allSettled([
			loadPlannerData(),
			loadDashboardMetrics(),
			loadConversations(),
		]);
	} catch (error) {
		const isAborted = error?.name === "AbortError";
		updateMessage(
			assistantMessage,
			isAborted
				? "Response generation stopped."
				: "I encountered an issue processing that request. Please try again in a moment.",
		);
	} finally {
		assistantMessage?.classList.remove("streaming");
		setSendingState(false);
		state.abortController = null;
	}
}

async function readServerStream(body, messageElement) {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let fullText = "";
	let toolPillsHtml = "";

	while (true) {
		const { value, done } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });
		const events = buffer.split("\n\n");
		buffer = events.pop() || "";

		for (const event of events) {
			const raw = event
				.split("\n")
				.find((line) => line.startsWith("data:"))
				?.replace(/^data:\s?/, "")
				.trim();
			if (!raw) continue;

			let payload;
			try {
				payload = JSON.parse(raw);
			} catch (_) {
				continue;
			}

			// Clean, humane tool execution activity indicators
			if (payload.type === "tool" && payload.message) {
				const humanToolMsg = formatToolExecutionMessage(
					payload.tool,
					payload.message,
				);
				toolPillsHtml += `<div class="tool-activity-pill completed"><span class="tool-icon">✓</span><span>${escapeHtml(humanToolMsg)}</span></div>`;
				updateMessageWithTools(
					messageElement,
					toolPillsHtml,
					fullText,
					payload.tool,
				);
			}

			if (payload.type === "chunk") {
				fullText += payload.text || "";
				updateMessageWithTools(
					messageElement,
					toolPillsHtml,
					fullText,
					payload.model,
				);
			}

			if (payload.type === "error") {
				updateMessage(
					messageElement,
					payload.message || "An error occurred with this request.",
				);
			}

			if (payload.type === "done") {
				messageElement.classList.remove("streaming");
			}
		}
	}

	if (!fullText.trim() && !toolPillsHtml) {
		updateMessage(
			messageElement,
			"I didn't receive a response. Please try again.",
		);
	}
}

function formatToolExecutionMessage(toolName, rawMessage) {
	const map = {
		createTask: "Task created in your workspace",
		addReminder: "Reminder scheduled",
		createDailyPlan: "Daily time-block plan created",
		searchProject: "Workspace search completed",
		queryDocuments: "Knowledge base indexed documents retrieved",
	};
	return map[toolName] || rawMessage || "Action completed";
}

function addMessage(content, role, options = {}) {
	const messages = document.getElementById("chatMessages");
	if (!messages) return null;

	const article = document.createElement("article");
	article.className = `message ${role}`;
	article.dataset.raw = content || "";

	if (role === "user") {
		article.innerHTML = `
			<div class="message-bubble">
				<div class="message-content">${escapeHtml(content)}</div>
			</div>
		`;
	} else {
		article.innerHTML = `
			<div class="message-bubble">
				<div class="message-meta">
					<span class="assistant-mark-small"></span>
					<strong>Lavoro</strong>
					<span class="model-tag">${escapeHtml(options.model || "assistant")}</span>
				</div>
				<div class="tool-activity-tray"></div>
				<div class="message-content">${options.streaming ? renderThinking() : renderMarkdown(content)}</div>
			</div>
		`;
	}

	messages.appendChild(article);
	scrollChatToBottom();
	return article;
}

function updateMessage(message, content, model) {
	if (!message) return;
	message.dataset.raw = content || "";

	const meta = message.querySelector(".message-meta .model-tag");
	const contentElement = message.querySelector(".message-content");
	if (meta && model) meta.textContent = model;
	if (contentElement) {
		contentElement.innerHTML = content
			? renderMarkdown(content)
			: renderThinking();
		attachCodeCopyButtons(contentElement);
	}
	scrollChatToBottom();
}

function updateMessageWithTools(message, toolPillsHtml, content, model) {
	if (!message) return;
	message.dataset.raw = content || "";

	const meta = message.querySelector(".message-meta .model-tag");
	const tray = message.querySelector(".tool-activity-tray");
	const contentElement = message.querySelector(".message-content");

	if (meta && model) meta.textContent = model;
	if (tray) tray.innerHTML = toolPillsHtml;
	if (contentElement) {
		contentElement.innerHTML = content
			? renderMarkdown(content)
			: renderThinking();
		attachCodeCopyButtons(contentElement);
	}
	scrollChatToBottom();
}

function renderThinking() {
	return `
		<div class="ai-thinking">
			<div class="thinking-dots">
				<span></span><span></span><span></span>
			</div>
			<em>Lavoro is thinking...</em>
		</div>
	`;
}

function setSendingState(isSending) {
	state.isSending = isSending;
	const sendBtn = document.getElementById("sendBtn");
	const stopBtn = document.getElementById("stopBtn");
	const input = document.getElementById("userInput");

	if (sendBtn) sendBtn.disabled = isSending;
	if (stopBtn) stopBtn.hidden = !isSending;
	input?.setAttribute("aria-busy", isSending ? "true" : "false");
}

function stopStreaming() {
	if (state.abortController) {
		state.abortController.abort();
		state.abortController = null;
		setSendingState(false);
		showToast("Generation stopped.");
	}
}

async function resetChatSession() {
	if (state.abortController) state.abortController.abort();

	try {
		await apiPost("/api/reset", { sessionId: SESSION_ID });
	} catch (_) {}

	const messages = document.getElementById("chatMessages");
	if (messages) messages.innerHTML = "";
	state.attachments = [];
	renderAttachmentTray();

	state.hasStartedChat = false;
	const hero = document.getElementById("assistantHero");
	const chatThread = document.getElementById("chatThreadContainer");
	if (hero) hero.classList.remove("minimized");
	if (chatThread) chatThread.hidden = true;

	showToast("Fresh conversation started.");
	document.getElementById("userInput")?.focus();
}

/* ==========================================================================
   Voice Input (SpeechRecognition)
   ========================================================================== */

function toggleVoiceInput() {
	const voiceBtn = document.getElementById("voiceBtn");
	const input = document.getElementById("userInput");

	const SpeechRecognition =
		window.SpeechRecognition || window.webkitSpeechRecognition;

	if (!SpeechRecognition) {
		showToast("Speech recognition is not supported in this browser.");
		return;
	}

	if (state.voiceActive && state.recognition) {
		state.recognition.stop();
		state.voiceActive = false;
		voiceBtn?.classList.remove("recording");
		showToast("Voice listening stopped.");
		return;
	}

	try {
		const recognition = new SpeechRecognition();
		recognition.continuous = false;
		recognition.interimResults = false;
		recognition.lang = "en-US";

		recognition.onstart = () => {
			state.voiceActive = true;
			voiceBtn?.classList.add("recording");
			showToast("Listening... speak your request.");
		};

		recognition.onresult = (event) => {
			const transcript = event.results[0][0].transcript;
			if (input && transcript) {
				input.value = input.value
					? `${input.value} ${transcript}`
					: transcript;
				autoGrowTextarea();
			}
		};

		recognition.onerror = () => {
			state.voiceActive = false;
			voiceBtn?.classList.remove("recording");
		};

		recognition.onend = () => {
			state.voiceActive = false;
			voiceBtn?.classList.remove("recording");
		};

		state.recognition = recognition;
		recognition.start();
	} catch (err) {
		showToast("Could not access microphone.");
	}
}

/* ==========================================================================
   File Attachments
   ========================================================================== */

async function handleFileUpload(event) {
	const files = Array.from(event.target.files || []).slice(0, 4);
	if (!files.length) return;

	const parsed = await Promise.all(
		files.map(async (file) => ({
			name: file.name,
			language: inferLanguage(file.name),
			content: (await file.text()).slice(0, 12000),
		})),
	);

	state.attachments.push(...parsed);
	state.attachments = state.attachments.slice(0, 4);
	renderAttachmentTray();
	showToast(`${parsed.length} document${parsed.length > 1 ? "s" : ""} attached.`);
	event.target.value = "";
}

function renderAttachmentTray() {
	const tray = document.getElementById("attachmentTray");
	if (!tray) return;

	tray.innerHTML = "";
	tray.hidden = state.attachments.length === 0;

	state.attachments.forEach((attachment, idx) => {
		const chip = document.createElement("div");
		chip.className = "attachment-chip";
		chip.innerHTML = `
			<span>📄 ${escapeHtml(attachment.name)}</span>
			<span class="attachment-chip-remove" data-idx="${idx}" title="Remove file">✕</span>
		`;
		chip.querySelector(".attachment-chip-remove")?.addEventListener(
			"click",
			() => {
				state.attachments.splice(idx, 1);
				renderAttachmentTray();
			},
		);
		tray.appendChild(chip);
	});
}

/* ==========================================================================
   VIEW RENDERERS
   ========================================================================== */

function renderAssistantView() {
	updateGreetingHeading();
}

function renderTasksView() {
	const container = document.getElementById("tasksListContainer");
	if (!container) return;

	const tasks = assistantData.tasks.items || [];
	let filtered = tasks;

	if (state.taskFilter === "high") {
		filtered = tasks.filter((t) => normalizePriority(t.priority) === "high");
	} else if (state.taskFilter === "medium") {
		filtered = tasks.filter(
			(t) => normalizePriority(t.priority) === "medium",
		);
	} else if (state.taskFilter === "completed") {
		filtered = tasks.filter((t) => t.status === "done");
	}

	if (!filtered.length) {
		container.innerHTML = `
			<div class="empty-state-box">
				<p>No tasks match this filter. Tell Lavoro what you want to accomplish and I'll help you organize it.</p>
				<button class="btn-secondary" type="button" onclick="document.getElementById('taskTitleInput')?.focus()">Create a task</button>
			</div>
		`;
		return;
	}

	container.innerHTML = filtered
		.map((task) => {
			const isDone = task.status === "done";
			const priority = normalizePriority(task.priority);
			return `
				<div class="task-item-card ${isDone ? "completed" : ""}" data-task-id="${escapeHtml(task.id)}">
					<div class="task-item-left">
						<button class="task-checkbox-btn" type="button" data-action="toggle-complete" data-task-id="${escapeHtml(task.id)}" title="${isDone ? "Mark active" : "Mark complete"}">
							<svg class="task-checkbox-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
								<polyline points="20 6 9 17 4 12"></polyline>
							</svg>
						</button>
						<div class="task-content-block">
							<div class="task-text-title">${escapeHtml(task.title || "Untitled task")}</div>
							<div class="task-meta-row">
								<span class="priority-pill priority-${priority}">${escapeHtml(priority)}</span>
								<span>· Due ${escapeHtml(task.due || "today")}</span>
								${task.category ? `<span>· ${escapeHtml(task.category)}</span>` : ""}
							</div>
						</div>
					</div>
					<div class="task-item-actions">
						<button class="task-action-btn task-ai-breakdown-btn" type="button" data-action="ai-breakdown" data-task-id="${escapeHtml(task.id)}" title="AI Action Breakdown">✦ Break down</button>
						<button class="task-action-btn" type="button" data-action="priority" data-task-id="${escapeHtml(task.id)}">Priority</button>
						<button class="task-action-btn" type="button" data-action="delete" data-task-id="${escapeHtml(task.id)}" title="Delete">✕</button>
					</div>
				</div>
			`;
		})
		.join("");

	// Bind task card actions
	container.querySelectorAll("[data-action]").forEach((btn) => {
		btn.addEventListener("click", () => {
			const taskId = btn.dataset.taskId;
			const action = btn.dataset.action;
			const task = assistantData.tasks.items.find((t) => t.id === taskId);
			if (!task) return;

			if (action === "toggle-complete") {
				task.status = task.status === "done" ? "todo" : "done";
				showToast(
					task.status === "done"
						? "Task marked complete."
						: "Task marked active.",
				);
				renderTasksView();
				loadDashboardMetrics();
			} else if (action === "priority") {
				const nextPriority = {
					high: "medium",
					medium: "low",
					low: "high",
				};
				task.priority = nextPriority[normalizePriority(task.priority)];
				showToast(`Priority changed to ${task.priority}.`);
				renderTasksView();
			} else if (action === "delete") {
				assistantData.tasks.items = assistantData.tasks.items.filter(
					(t) => t.id !== taskId,
				);
				showToast("Task removed.");
				renderTasksView();
				loadDashboardMetrics();
			} else if (action === "ai-breakdown") {
				setView("assistant");
				sendMessage(
					`Break down this task into 3-4 concrete actionable next steps: "${task.title}"`,
				);
			}
		});
	});
}

async function handleCreateTask(e) {
	e.preventDefault();
	const titleInput = document.getElementById("taskTitleInput");
	const priorityInput = document.getElementById("taskPriorityInput");
	const dueInput = document.getElementById("taskDueInput");

	const title = titleInput?.value?.trim();
	if (!title) return;

	const priority = priorityInput?.value || "medium";
	const due = dueInput?.value?.trim() || "Today";

	try {
		const res = await apiPost("/api/tasks", {
			title,
			priority,
			due,
			category: "workspace",
		});
		if (res.success && res.tasks) {
			assistantData.tasks.items = res.tasks;
		} else {
			assistantData.tasks.items.unshift({
				id: `task-${Date.now()}`,
				title,
				priority,
				due,
				status: "todo",
			});
		}
		titleInput.value = "";
		renderTasksView();
		loadDashboardMetrics();
		showToast("Task added.");
	} catch (err) {
		showToast("Could not save task to backend.");
	}
}

function renderPlannerView() {
	const timelineEl = document.getElementById("plannerTimelineList");
	const focusListEl = document.getElementById("plannerFocusList");
	const dateSub = document.getElementById("plannerDateSubtitle");

	if (dateSub) {
		dateSub.textContent = `Time-blocked schedule for ${new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(new Date())}`;
	}

	const events = assistantData.calendar.events || [];
	const tasks = (assistantData.tasks.items || []).filter(
		(t) => t.status !== "done",
	);
	const timeline = buildTimeline(events, tasks);

	if (timelineEl) {
		timelineEl.innerHTML = timeline
			.map(
				(item) => `
			<div class="timeline-block ${item.type.toLowerCase().includes("deep work") || item.type.toLowerCase().includes("focus") ? "focus-block" : ""}">
				<div class="timeline-time">${escapeHtml(item.time)}</div>
				<div class="timeline-details">
					<div class="timeline-title">${escapeHtml(item.title)}</div>
					<div class="timeline-subtitle">${escapeHtml(item.type)}</div>
				</div>
			</div>
		`,
			)
			.join("");
	}

	if (focusListEl) {
		const topFocus = tasks.slice(0, 4);
		if (topFocus.length) {
			focusListEl.innerHTML = topFocus
				.map(
					(t) => `
				<div class="focus-mini-card">
					<strong>${escapeHtml(t.title)}</strong>
					<div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 2px;">
						${escapeHtml(t.priority || "medium")} priority · Due ${escapeHtml(t.due || "today")}
					</div>
				</div>
			`,
				)
				.join("");
		} else {
			focusListEl.innerHTML =
				'<p style="font-size: 0.84rem; color: var(--text-muted);">No pending tasks scheduled.</p>';
		}
	}
}

async function handleAiPlanDay() {
	setView("assistant");
	setMode("planner");
	sendMessage("Plan my day with deep work blocks and realistic schedule.");
}

function renderRemindersView() {
	const container = document.getElementById("remindersListContainer");
	if (!container) return;

	const reminders = assistantData.reminders.items || [];
	if (!reminders.length) {
		container.innerHTML = `
			<div class="empty-state-box">
				<p>No reminders scheduled. Set a quick alert above to stay on track.</p>
			</div>
		`;
		return;
	}

	container.innerHTML = reminders
		.map((rem) => {
			const isDone = rem.done;
			return `
			<div class="reminder-item-card ${isDone ? "completed" : ""}" data-reminder-id="${escapeHtml(rem.id)}">
				<div style="display: flex; align-items: center; gap: 12px;">
					<span class="reminder-time-badge">${escapeHtml(rem.when || "Alert")}</span>
					<span style="${isDone ? "text-decoration: line-through; color: var(--text-muted);" : "font-weight: 500;"}">${escapeHtml(rem.title)}</span>
				</div>
				<div>
					<button class="task-action-btn" type="button" data-action="toggle-reminder" data-reminder-id="${escapeHtml(rem.id)}">${isDone ? "Undone" : "Done"}</button>
					<button class="task-action-btn" type="button" data-action="delete-reminder" data-reminder-id="${escapeHtml(rem.id)}">✕</button>
				</div>
			</div>
		`;
		})
		.join("");

	container.querySelectorAll("[data-action]").forEach((btn) => {
		btn.addEventListener("click", () => {
			const remId = btn.dataset.reminderId;
			const action = btn.dataset.action;
			const reminder = assistantData.reminders.items.find(
				(r) => r.id === remId,
			);
			if (!reminder) return;

			if (action === "toggle-reminder") {
				reminder.done = !reminder.done;
				renderRemindersView();
				loadDashboardMetrics();
			} else if (action === "delete-reminder") {
				assistantData.reminders.items =
					assistantData.reminders.items.filter((r) => r.id !== remId);
				renderRemindersView();
				loadDashboardMetrics();
				showToast("Reminder deleted.");
			}
		});
	});
}

async function handleCreateReminder(e) {
	e.preventDefault();
	const titleInput = document.getElementById("reminderTitleInput");
	const whenInput = document.getElementById("reminderWhenInput");

	const title = titleInput?.value?.trim();
	const when = whenInput?.value?.trim();
	if (!title || !when) return;

	try {
		const res = await apiPost("/api/reminders", { title, when });
		if (res.success && res.reminders) {
			assistantData.reminders.items = res.reminders;
		} else {
			assistantData.reminders.items.unshift({
				id: `rem-${Date.now()}`,
				title,
				when,
				done: false,
			});
		}
		titleInput.value = "";
		whenInput.value = "";
		renderRemindersView();
		loadDashboardMetrics();
		showToast("Reminder scheduled.");
	} catch (err) {
		showToast("Could not schedule reminder.");
	}
}

function renderBriefingView() {
	const weatherBox = document.getElementById("briefingWeatherContent");
	const emailBox = document.getElementById("briefingEmailContent");
	const tasksBox = document.getElementById("briefingTasksContent");
	const scheduleBox = document.getElementById("briefingScheduleContent");
	const dateSub = document.getElementById("briefingDateSubtitle");

	if (dateSub) {
		dateSub.textContent = `Start-of-day executive overview for ${new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date())}`;
	}

	if (weatherBox) {
		weatherBox.innerHTML = `
			<p style="font-size: 0.95rem; line-height: 1.5; color: var(--text-primary);">🌤️ ${escapeHtml(assistantData.weather.summary)}</p>
		`;
	}

	if (emailBox) {
		const emails = assistantData.emails.items.filter((e) => e.unread);
		if (emails.length) {
			emailBox.innerHTML = emails
				.map(
					(e) => `
				<div style="margin-bottom: 8px; font-size: 0.88rem;">
					<strong>${escapeHtml(e.subject)}</strong>
					<div style="font-size: 0.76rem; color: var(--text-muted);">From: ${escapeHtml(e.from)} · ${escapeHtml(e.date)}</div>
				</div>
			`,
				)
				.join("");
		} else {
			emailBox.innerHTML =
				'<p style="color: var(--text-muted); font-size: 0.88rem;">No unread urgent messages.</p>';
		}
	}

	if (tasksBox) {
		const highTasks = (assistantData.tasks.items || [])
			.filter(
				(t) =>
					normalizePriority(t.priority) === "high" &&
					t.status !== "done",
			)
			.slice(0, 3);

		if (highTasks.length) {
			tasksBox.innerHTML = highTasks
				.map(
					(t) => `
				<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; font-size: 0.88rem;">
					<span>○ ${escapeHtml(t.title)}</span>
					<span class="priority-pill priority-high">High</span>
				</div>
			`,
				)
				.join("");
		} else {
			tasksBox.innerHTML =
				'<p style="color: var(--text-muted); font-size: 0.88rem;">All urgent tasks cleared for today.</p>';
		}
	}

	if (scheduleBox) {
		const events = (assistantData.calendar.events || []).slice(0, 3);
		scheduleBox.innerHTML = events
			.map(
				(ev) => `
			<div style="display: flex; gap: 10px; margin-bottom: 6px; font-size: 0.86rem;">
				<span style="color: var(--accent); font-weight: 600; min-width: 65px;">${escapeHtml(ev.time)}</span>
				<span>${escapeHtml(ev.title)} (${escapeHtml(ev.duration)})</span>
			</div>
		`,
			)
			.join("");
	}
}

function renderKnowledgeView() {
	const docsGrid = document.getElementById("knowledgeDocumentsList");
	if (!docsGrid) return;

	const docs = assistantData.knowledgeDocs.items || [];
	if (!docs.length) {
		docsGrid.innerHTML = `
			<div class="empty-state-box" style="grid-column: 1 / -1;">
				<p>Lavoro remembers your notes, project docs, and key facts. Add a note or query with natural language.</p>
				<button class="btn-secondary" type="button" onclick="document.getElementById('addDocBtn')?.click()">Add your first note</button>
			</div>
		`;
		return;
	}

	docsGrid.innerHTML = docs
		.map(
			(d) => `
		<div class="doc-summary-card">
			<h4>${escapeHtml(d.metadata?.title || "Knowledge Note")}</h4>
			<p>${escapeHtml(d.content || "")}</p>
			<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">
				${d.metadata?.tags ? `Tag: ${escapeHtml(d.metadata.tags)}` : "Indexed Context"}
			</div>
		</div>
	`,
		)
		.join("");
}

async function handleKnowledgeSearch(e) {
	e.preventDefault();
	const input = document.getElementById("knowledgeQueryInput");
	const query = input?.value?.trim();
	if (!query) return;

	const resultsStack = document.getElementById("knowledgeSearchResults");
	const resultsList = document.getElementById("knowledgeResultsList");
	if (!resultsStack || !resultsList) return;

	resultsStack.hidden = false;
	resultsList.innerHTML = '<div style="padding: 12px; color: var(--text-muted); font-size: 0.85rem;">Searching knowledge memory...</div>';

	try {
		const res = await apiPost("/api/rag/query", { query, limit: 5 });
		const results = res.results || [];
		if (!results.length) {
			resultsList.innerHTML = '<div style="padding: 12px; color: var(--text-muted); font-size: 0.85rem;">No direct matches found in knowledge memory.</div>';
			return;
		}

		resultsList.innerHTML = results
			.map(
				(item) => `
			<div class="rag-result-card">
				<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
					<strong style="font-size: 0.92rem;">${escapeHtml(item.metadata?.title || item.metadata?.parentDocId || "Document")}</strong>
					<span class="rag-score-badge">${Math.round((item.score || 0) * 100)}% match</span>
				</div>
				<p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.45;">${escapeHtml(item.content)}</p>
			</div>
		`,
			)
			.join("");
	} catch (err) {
		resultsList.innerHTML = '<div style="padding: 12px; color: var(--text-muted); font-size: 0.85rem;">Search service is temporarily unavailable.</div>';
	}
}

function clearKnowledgeSearch() {
	const resultsStack = document.getElementById("knowledgeSearchResults");
	const input = document.getElementById("knowledgeQueryInput");
	if (resultsStack) resultsStack.hidden = true;
	if (input) input.value = "";
}

async function handleAddDocument(e) {
	e.preventDefault();
	const titleInput = document.getElementById("docTitle");
	const categoryInput = document.getElementById("docCategory");
	const contentInput = document.getElementById("docContent");

	const title = titleInput?.value?.trim();
	const category = categoryInput?.value?.trim() || "general";
	const content = contentInput?.value?.trim();

	if (!title || !content) return;

	try {
		await apiPost("/api/rag/index", {
			documents: [
				{
					id: `doc-${Date.now()}`,
					content,
					metadata: { title, tags: category },
				},
			],
		});

		assistantData.knowledgeDocs.items.unshift({
			content,
			metadata: { title, tags: category },
		});

		closeModal("docModal");
		titleInput.value = "";
		contentInput.value = "";
		renderKnowledgeView();
		showToast("Document indexed into knowledge base.");
	} catch (err) {
		showToast("Could not index document.");
	}
}

function renderConversationsView() {
	const container = document.getElementById("conversationsListContainer");
	if (!container) return;

	const messages = assistantData.conversations.items || [];
	if (!messages.length) {
		container.innerHTML = `
			<div class="empty-state-box">
				<p>No recorded conversations yet. Ask Lavoro anything from the Assistant view to get started.</p>
				<button class="btn-secondary" type="button" onclick="setView('assistant')">Open Assistant</button>
			</div>
		`;
		return;
	}

	container.innerHTML = messages
		.map(
			(msg) => `
		<div class="conversation-card">
			<div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.78rem; color: var(--text-muted);">
				<strong>${msg.role === "user" ? "You" : "Lavoro AI"}</strong>
				<span>Mode: ${escapeHtml(msg.mode || "assistant")}</span>
			</div>
			<div style="font-size: 0.92rem; color: var(--text-primary); margin-top: 4px;">
				${escapeHtml(msg.content)}
			</div>
		</div>
	`,
		)
		.join("");
}

function renderDashboardView() {
	const grid = document.getElementById("dashboardMetricsGrid");
	const bars = document.getElementById("dashboardPriorityBars");
	const metrics = assistantData.dashboard.metrics;

	const tasks = assistantData.tasks.items || [];
	const completed = tasks.filter((t) => t.status === "done").length;
	const total = tasks.length;
	const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
	const reminders = (assistantData.reminders.items || []).filter(
		(r) => !r.done,
	).length;

	if (grid) {
		grid.innerHTML = `
			<div class="metric-card">
				<span class="metric-label">Completed Tasks</span>
				<div class="metric-value">${completed} <span style="font-size: 1rem; font-weight: 500; color: var(--text-muted);">/ ${total}</span></div>
				<span class="metric-sub">${rate}% completion rate</span>
			</div>
			<div class="metric-card">
				<span class="metric-label">Focus Blocks</span>
				<div class="metric-value">3</div>
				<span class="metric-sub">Deep work intervals</span>
			</div>
			<div class="metric-card">
				<span class="metric-label">Active Reminders</span>
				<div class="metric-value">${reminders}</div>
				<span class="metric-sub">Scheduled alerts</span>
			</div>
			<div class="metric-card">
				<span class="metric-label">AI Interactions</span>
				<div class="metric-value">${metrics?.totalMessages || assistantData.conversations.items.length || 0}</div>
				<span class="metric-sub">Conversations & queries</span>
			</div>
		`;
	}

	if (bars) {
		const high = tasks.filter(
			(t) => normalizePriority(t.priority) === "high",
		).length;
		const med = tasks.filter(
			(t) => normalizePriority(t.priority) === "medium",
		).length;
		const low = tasks.filter(
			(t) => normalizePriority(t.priority) === "low",
		).length;

		const maxCount = Math.max(high, med, low, 1);

		bars.innerHTML = `
			<div class="priority-bar-row">
				<span class="priority-bar-label">High Priority</span>
				<div class="priority-bar-track">
					<div class="priority-bar-fill fill-high" style="width: ${(high / maxCount) * 100}%;"></div>
				</div>
				<span class="priority-bar-count">${high}</span>
			</div>
			<div class="priority-bar-row">
				<span class="priority-bar-label">Medium</span>
				<div class="priority-bar-track">
					<div class="priority-bar-fill fill-med" style="width: ${(med / maxCount) * 100}%;"></div>
				</div>
				<span class="priority-bar-count">${med}</span>
			</div>
			<div class="priority-bar-row">
				<span class="priority-bar-label">Low</span>
				<div class="priority-bar-track">
					<div class="priority-bar-fill fill-low" style="width: ${(low / maxCount) * 100}%;"></div>
				</div>
				<span class="priority-bar-count">${low}</span>
			</div>
		`;
	}
}

/* ==========================================================================
   User Profile, Greetings, and Settings
   ========================================================================== */

function updateGreetingHeading() {
	const hour = new Date().getHours();
	let period = "evening";
	if (hour >= 5 && hour < 12) period = "morning";
	else if (hour >= 12 && hour < 17) period = "afternoon";

	const firstName = (state.profile?.name || "Umesh").split(" ")[0];
	const heading = document.getElementById("greetingHeading");
	const sub = document.getElementById("greetingSubheading");

	if (heading) heading.textContent = `Good ${period}, ${firstName}.`;
	if (sub) sub.textContent = "What would you like to accomplish today?";

	// Avatar initials
	const initials = (state.profile?.name || "UK")
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
	const avatarEl = document.getElementById("avatarInitials");
	if (avatarEl) avatarEl.textContent = initials;
}

async function loadProfile() {
	try {
		const res = await apiGet("/api/profile");
		if (res.success && res.profile) {
			state.profile = res.profile;
			updateGreetingHeading();
			populateProfileForm();
		}
	} catch (_) {}
}

function populateProfileForm() {
	const nameInput = document.getElementById("profileName");
	const roleInput = document.getElementById("profileRole");
	const goalInput = document.getElementById("profileGoal");
	const hoursInput = document.getElementById("profileWorkingHours");

	if (nameInput) nameInput.value = state.profile.name || "";
	if (roleInput) roleInput.value = state.profile.role || "";
	if (goalInput) goalInput.value = state.profile.goal || "";
	if (hoursInput) hoursInput.value = state.profile.workingHours || "";

	const sessionCode = document.getElementById("activeSessionCode");
	if (sessionCode) sessionCode.textContent = SESSION_ID;

	const goalHeadline = document.getElementById("briefingGoalHeadline");
	if (goalHeadline && state.profile.goal) {
		goalHeadline.textContent = state.profile.goal;
	}

	const plannerGoal = document.getElementById("plannerCurrentGoal");
	if (plannerGoal && state.profile.goal) {
		plannerGoal.textContent = state.profile.goal;
	}
}

async function handleSaveProfile(e) {
	e.preventDefault();
	const name = document.getElementById("profileName")?.value?.trim();
	const role = document.getElementById("profileRole")?.value?.trim();
	const goal = document.getElementById("profileGoal")?.value?.trim();
	const workingHours = document.getElementById("profileWorkingHours")?.value?.trim();

	try {
		const res = await apiPost("/api/profile", {
			name,
			role,
			goal,
			workingHours,
		});
		if (res.success && res.profile) {
			state.profile = res.profile;
			updateGreetingHeading();
			populateProfileForm();
			closeModal("settingsModal");
			showToast("Profile settings updated.");
		}
	} catch (err) {
		showToast("Could not update profile.");
	}
}

async function handleDemoLogin() {
	try {
		const res = await apiPost("/api/auth/login", {
			email: "admin@example.com",
			password: "dev-seed-password-do-not-use-in-prod",
		});
		if (res.success && res.token) {
			localStorage.setItem("lavoro-auth-token", res.token);
			showToast("Authenticated as System Admin.");
			closeModal("settingsModal");
		}
	} catch (err) {
		showToast("Demo login failed.");
	}
}

function handleResetSession() {
	localStorage.removeItem("lavoroSessionId");
	localStorage.removeItem("lavoro-auth-token");
	location.reload();
}

/* ==========================================================================
   Health, Data Loading & Utilities
   ========================================================================== */

async function loadHealth() {
	const label = document.getElementById("healthLabel");
	const badge = document.getElementById("healthBadge");
	const statusDot = document.getElementById("sidebarStatusDot");
	const diagModel = document.getElementById("diagModel");

	try {
		const data = await apiGet("/api/health");
		state.health = data;
		if (label)
			label.textContent = `${data.status || "Online"} · ${data.model || "Gemini"}`;
		if (badge) badge.classList.remove("offline");
		if (statusDot) statusDot.classList.remove("offline");
		if (diagModel) diagModel.textContent = data.model || "Gemini 3 Flash";
	} catch (_) {
		if (label) label.textContent = "Offline";
		if (badge) badge.classList.add("offline");
		if (statusDot) statusDot.classList.add("offline");
	}
}

async function loadPlannerData() {
	try {
		const [tasksRes, remindersRes, plansRes] = await Promise.all([
			apiGet("/api/tasks"),
			apiGet("/api/reminders"),
			apiGet("/api/plans"),
		]);

		assistantData.tasks = {
			status: "ready",
			items: tasksRes?.tasks || [],
		};
		assistantData.reminders = {
			status: "ready",
			items: remindersRes?.reminders || [],
		};
		assistantData.plans = {
			status: "ready",
			items: plansRes?.plans || [],
		};
	} catch (_) {
		assistantData.tasks = { status: "error", items: [] };
		assistantData.reminders = { status: "error", items: [] };
		assistantData.plans = { status: "error", items: [] };
	}
}

async function loadDashboardMetrics() {
	try {
		const res = await apiGet("/api/dashboard/summary");
		if (res.success && res.metrics) {
			assistantData.dashboard.metrics = res.metrics;
		}
	} catch (_) {}
}

async function loadConversations() {
	try {
		const res = await apiGet("/api/conversations");
		if (res.success && res.messages) {
			assistantData.conversations.items = res.messages;
		}
	} catch (_) {}
}

function buildAssistantContext() {
	return {
		weather: assistantData.weather.summary,
		calendarEvents: assistantData.calendar.events,
		importantEmails: assistantData.emails.items.filter(
			(e) => e.priority === "high",
		),
		tasks: assistantData.tasks.items,
		reminders: assistantData.reminders.items,
		profile: state.profile,
	};
}

function buildTimeline(events, tasks) {
	const timeline = [];
	events.forEach((event) => {
		timeline.push({
			time: event.time,
			title: event.title,
			type: event.duration,
		});
		if (event.title === "Team Standup") {
			timeline.push({
				time: "09:30 AM",
				title: "Deep Work Interval",
				type: "Focus Work",
			});
		}
		if (event.title === "Project Review") {
			timeline.push({
				time: "12:00 PM",
				title: "Execution & Follow-up",
				type: "Focus Work",
			});
		}
		if (event.title === "Client Call") {
			timeline.push({
				time: "03:00 PM",
				title: tasks[0]?.title || "Deliverable Completion",
				type: "Priority Task",
			});
		}
	});
	return timeline;
}

function normalizePriority(p) {
	const val = String(p || "medium").toLowerCase();
	if (val.includes("high")) return "high";
	if (val.includes("low")) return "low";
	return "medium";
}

function autoGrowTextarea() {
	const input = document.getElementById("userInput");
	if (!input) return;
	input.style.height = "auto";
	input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
}

function scrollChatToBottom() {
	const main = document.getElementById("workspaceMain");
	if (!main) return;
	requestAnimationFrame(() => {
		main.scrollTo({ top: main.scrollHeight, behavior: "smooth" });
	});
}

function applyTheme(theme) {
	state.theme = theme;
	document.documentElement.setAttribute("data-theme", theme);
	localStorage.setItem("lavoro-theme", theme);
}

function toggleTheme() {
	const next = state.theme === "dark" ? "light" : "dark";
	applyTheme(next);
	showToast(`Switched to ${next} theme.`);
}

function openModal(id) {
	const modal = document.getElementById(id);
	if (modal) {
		modal.hidden = false;
		modal.querySelector("input, select, textarea")?.focus();
	}
}

function closeModal(id) {
	const modal = document.getElementById(id);
	if (modal) modal.hidden = true;
}

function showToast(message) {
	const container = document.getElementById("toastContainer");
	if (!container) return;

	const toast = document.createElement("div");
	toast.className = "toast";
	toast.textContent = message;
	container.appendChild(toast);

	requestAnimationFrame(() => toast.classList.add("show"));
	setTimeout(() => {
		toast.classList.remove("show");
		setTimeout(() => toast.remove(), 200);
	}, 2600);
}

function inferLanguage(fileName) {
	const ext = fileName.split(".").pop().toLowerCase();
	return (
		{
			js: "javascript",
			jsx: "javascript",
			ts: "typescript",
			tsx: "typescript",
			py: "python",
			html: "html",
			css: "css",
			json: "json",
			md: "markdown",
		}[ext] || "text"
	);
}

function attachCodeCopyButtons(container) {
	container.querySelectorAll("pre").forEach((pre) => {
		if (pre.querySelector(".copy-code-btn")) return;
		const btn = document.createElement("button");
		btn.type = "button";
		btn.className = "copy-code-btn";
		btn.textContent = "Copy";
		btn.style.cssText =
			"position: absolute; top: 8px; right: 8px; font-size: 0.72rem; padding: 3px 8px; border-radius: 4px; background: var(--surface); border: 1px solid var(--border-subtle); color: var(--text-secondary); cursor: pointer;";
		btn.addEventListener("click", () => {
			const code = pre.querySelector("code")?.innerText || pre.innerText;
			navigator.clipboard?.writeText(code).then(() => {
				btn.textContent = "Copied!";
				setTimeout(() => (btn.textContent = "Copy"), 2000);
			});
		});
		pre.appendChild(btn);
	});
}

function renderMarkdown(markdown) {
	const escaped = escapeHtml(markdown || "");
	const codeBlockRegex = /```([a-z0-9_-]*)\n([\s\S]*?)```/g;
	const blocks = [];
	let lastIndex = 0;
	let match;

	while ((match = codeBlockRegex.exec(escaped)) !== null) {
		if (match.index > lastIndex) {
			blocks.push({
				type: "text",
				content: escaped.slice(lastIndex, match.index),
			});
		}
		blocks.push({
			type: "code",
			lang: match[1] || "",
			content: match[2],
		});
		lastIndex = match.index + match[0].length;
	}
	if (lastIndex < escaped.length) {
		blocks.push({ type: "text", content: escaped.slice(lastIndex) });
	}

	return blocks
		.map((b) => {
			if (b.type === "code") {
				return `<pre><code class="language-${escapeHtml(b.lang)}">${b.content}</code></pre>`;
			}
			return b.content
				.split(/\n{2,}/)
				.map((paragraph) => {
					if (/^[-*]\s/m.test(paragraph)) {
						const items = paragraph
							.split("\n")
							.filter(Boolean)
							.map(
								(line) =>
									`<li>${formatInlineMarkdown(line.replace(/^[-*]\s/, ""))}</li>`,
							)
							.join("");
						return `<ul>${items}</ul>`;
					}
					if (/^\d+\.\s/m.test(paragraph)) {
						const items = paragraph
							.split("\n")
							.filter(Boolean)
							.map(
								(line) =>
									`<li>${formatInlineMarkdown(line.replace(/^\d+\.\s/, ""))}</li>`,
							)
							.join("");
						return `<ol>${items}</ol>`;
					}
					return `<p>${formatInlineMarkdown(paragraph.replace(/\n/g, "<br>"))}</p>`;
				})
				.join("");
		})
		.join("");
}

function formatInlineMarkdown(text) {
	return text
		.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
		.replace(/\*(.+?)\*/g, "<em>$1</em>")
		.replace(/`([^`\n]+)`/g, "<code>$1</code>");
}

function escapeHtml(val) {
	return String(val ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function getApiUrl() {
	const { hostname, protocol, port } = window.location;
	if (protocol === "file:") return "http://localhost:10000";
	if (hostname === "localhost" || hostname === "127.0.0.1") {
		return port === "10000"
			? window.location.origin
			: "http://localhost:10000";
	}
	if (hostname === "lavoro.umeshshah.in" || hostname === "www.umeshshah.in") {
		return "https://api.lavoro.umeshshah.in";
	}
	return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
}

function getSessionId() {
	const key = "lavoroSessionId";
	const existing = localStorage.getItem(key);
	if (existing) return existing;
	const generated =
		crypto?.randomUUID?.() ||
		`lavoro-${Date.now()}-${Math.random().toString(16).slice(2)}`;
	localStorage.setItem(key, generated);
	return generated;
}

async function apiGet(path) {
	const token = localStorage.getItem("lavoro-auth-token");
	const headers = {
		"X-Session-Id": SESSION_ID,
		Accept: "application/json",
	};
	if (token) headers.Authorization = `Bearer ${token}`;

	const res = await fetch(`${API_URL}${path}`, { headers });
	if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
	return res.json();
}

async function apiPost(path, body) {
	const token = localStorage.getItem("lavoro-auth-token");
	const headers = {
		"Content-Type": "application/json",
		"X-Session-Id": SESSION_ID,
		Accept: "application/json",
	};
	if (token) headers.Authorization = `Bearer ${token}`;

	const res = await fetch(`${API_URL}${path}`, {
		method: "POST",
		headers,
		body: JSON.stringify(body),
	});
	if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
	return res.json();
}
