const API_URL = getApiUrl();
const SESSION_ID = getSessionId();

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
};

const state = {
	view: "briefing",
	attachments: [],
	lastPrompt: "",
	abortController: null,
	isSending: false,
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
	bindEvents();
	addWelcomeMessage();
	autoGrowInput();
	renderCurrentView();
	await Promise.allSettled([loadHealth(), loadPlannerData()]);
	document.getElementById("userInput")?.focus();
}

function bindEvents() {
	document.querySelectorAll(".quick-action").forEach((button) => {
		button.addEventListener("click", () =>
			setView(button.dataset.view || "briefing"),
		);
	});

	document.getElementById("chatForm")?.addEventListener("submit", (event) => {
		event.preventDefault();
		sendMessage();
	});

	document
		.getElementById("resetChatBtn")
		?.addEventListener("click", resetChat);
	document
		.getElementById("fileInput")
		?.addEventListener("change", handleFiles);

	const input = document.getElementById("userInput");
	input?.addEventListener("input", autoGrowInput);
	input?.addEventListener("keydown", (event) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
	});
}

function setView(view) {
	state.view = view;
	document.querySelectorAll(".quick-action").forEach((button) => {
		const isActive = button.dataset.view === view;
		button.classList.toggle("active", isActive);
		button.setAttribute("aria-pressed", isActive ? "true" : "false");
	});
	renderCurrentView();
}

function renderCurrentView() {
	const content = document.getElementById("contentArea");
	if (!content) return;

	const views = {
		briefing: renderMorningBriefing,
		email: renderEmailSummary,
		tasks: renderTaskPriority,
		planner: renderDailyPlanner,
	};

	content.innerHTML = views[state.view]?.() || renderMorningBriefing();
	bindTaskActionButtons();
}

async function loadHealth() {
	const badge = document.getElementById("healthBadge");
	if (!badge) return;

	try {
		const data = await apiGet("/api/health");
		badge.innerHTML = `<span class="status-dot"></span>${escapeHtml(data.status || "Online")}${data.model ? ` · ${escapeHtml(data.model)}` : ""}`;
		badge.classList.remove("offline");
	} catch (_) {
		badge.innerHTML = '<span class="status-dot"></span>Backend offline';
		badge.classList.add("offline");
	}
}

async function loadPlannerData() {
	setDataStatus("tasks", "loading");
	setDataStatus("reminders", "loading");
	setDataStatus("plans", "loading");

	try {
		const [taskData, reminderData, planData] = await Promise.all([
			apiGet("/api/tasks"),
			apiGet("/api/reminders"),
			apiGet("/api/plans"),
		]);

		assistantData.tasks = { status: "ready", items: taskData?.tasks || [] };
		assistantData.reminders = {
			status: "ready",
			items: reminderData?.reminders || [],
		};
		assistantData.plans = { status: "ready", items: planData?.plans || [] };
	} catch (_) {
		assistantData.tasks = { status: "error", items: [] };
		assistantData.reminders = { status: "error", items: [] };
		assistantData.plans = { status: "error", items: [] };
	}

	renderCurrentView();
}

function setDataStatus(key, status) {
	assistantData[key] = { ...assistantData[key], status };
}

function renderMorningBriefing() {
	const { weather, calendar, emails, tasks } = assistantData;
	const highEmails = emails.items.filter(
		(email) => email.priority === "high" && email.unread,
	);
	const highTasks = tasks.items.filter(
		(task) =>
			normalizePriority(task.priority) === "high" &&
			task.status !== "done",
	);

	return `
		<section class="assistant-card">
			${renderCardHeader("Morning Briefing", "A concise look at weather, meetings, messages, and urgent work.", todayPill())}
			<div class="summary-grid">
				${renderInfoPanel("🌤️ Weather", weather.status === "ready" ? `<p class="description">${escapeHtml(weather.summary)}</p>` : renderState(weather.status, "Weather is unavailable."))}
				${renderInfoPanel(
					"📅 Calendar",
					`
					<p class="description">You have ${calendar.events.length} events today.</p>
					${renderEventList(calendar.events)}
				`,
				)}
				${renderInfoPanel(
					"📧 Important Emails",
					`
					<p class="description">You have ${highEmails.length} unread high-priority email${highEmails.length === 1 ? "" : "s"}.</p>
					${highEmails.length ? renderEmailList(highEmails.slice(0, 2)) : renderEmpty("No high-priority unread email.")}
				`,
					true,
				)}
				${renderInfoPanel(
					"⭐ High Priority Tasks",
					`
					<p class="description">You have ${highTasks.length} pending high-priority task${highTasks.length === 1 ? "" : "s"} due today.</p>
					${tasks.status === "ready" ? renderTaskList(highTasks.slice(0, 3)) : renderState(tasks.status, "Tasks are unavailable.")}
				`,
					true,
				)}
			</div>
		</section>
	`;
}

function renderEmailSummary() {
	const emails = assistantData.emails.items;
	const unread = emails.filter((email) => email.unread).length;
	const high = emails.filter((email) => email.priority === "high").length;

	return `
		<section class="assistant-card">
			${renderCardHeader("Email Summary", `${unread} unread emails · ${high} high-priority messages`, '<span class="meta-pill">Inbox scan</span>')}
			${emails.length ? renderEmailList(emails) : renderEmpty("No email integration data is available yet.")}
		</section>
	`;
}

function renderTaskPriority() {
	if (assistantData.tasks.status !== "ready") {
		return `<section class="assistant-card">${renderCardHeader("Prioritize Tasks", "Tasks grouped by priority.", "")}${renderState(assistantData.tasks.status, "Tasks are unavailable.")}</section>`;
	}

	const groups = ["high", "medium", "low"].map((priority) => ({
		priority,
		tasks: assistantData.tasks.items.filter(
			(task) => normalizePriority(task.priority) === priority,
		),
	}));

	return `
		<section class="assistant-card">
			${renderCardHeader("Prioritize Tasks", "Group, scan, and act on the work that matters first.", '<span class="meta-pill">Priority board</span>')}
			<div class="task-board">
				${groups.map(renderPriorityColumn).join("")}
			</div>
		</section>
	`;
}

function renderDailyPlanner() {
	const events = assistantData.calendar.events;
	const tasks = assistantData.tasks.items.filter(
		(task) => task.status !== "done",
	);
	const timeline = buildTimeline(events, tasks);
	const focusTasks = tasks.slice(0, 4);

	return `
		<section class="assistant-card">
			${renderCardHeader("Plan My Day", "A practical timeline built from your events and priorities.", todayPill())}
			<div class="planner-layout">
				<div class="timeline-panel">
					<h3 class="panel-title">🗓️ Suggested Schedule</h3>
					${renderTimeline(timeline)}
				</div>
				<div class="timeline-panel">
					<h3 class="panel-title">⭐ Focus Priorities</h3>
					<div class="focus-grid">
						${focusTasks.length ? focusTasks.map((task) => `<div class="focus-card">${escapeHtml(task.title)}<br><small>${escapeHtml(task.due || "later")} · ${escapeHtml(task.priority || "medium")}</small></div>`).join("") : renderEmpty("No active tasks to schedule.")}
					</div>
				</div>
			</div>
		</section>
	`;
}

function renderCardHeader(title, description, meta) {
	return `
		<div class="card-header">
			<div>
				<p class="section-label">Personal Daily Assistant</p>
				<h2>${escapeHtml(title)}</h2>
				<p>${escapeHtml(description)}</p>
			</div>
			${meta || ""}
		</div>
	`;
}

function renderInfoPanel(title, body, wide = false) {
	return `<section class="info-panel${wide ? " wide" : ""}"><h3 class="panel-title">${title}</h3>${body}</section>`;
}

function renderEventList(events) {
	if (!events.length) return renderEmpty("No calendar events today.");
	return `
		<ul class="event-list">
			${events
				.map(
					(event) => `
				<li class="event-item">
					<span class="event-time">${escapeHtml(event.time)}</span>
					<div>
						<p class="item-title">${escapeHtml(event.title)}</p>
						<p class="item-meta">${escapeHtml(event.duration)}${event.important ? " · Important!" : ""}</p>
					</div>
				</li>
			`,
				)
				.join("")}
		</ul>
	`;
}

function renderEmailList(emails) {
	if (!emails.length) return renderEmpty("No emails to show.");
	return `
		<ul class="email-list">
			${emails
				.map(
					(email) => `
				<li class="email-item">
					<div class="email-main">
						<p class="item-title">${escapeHtml(email.subject)}</p>
						<p class="item-meta">From: ${escapeHtml(email.from)}</p>
						<p class="item-meta">${escapeHtml(email.preview)}</p>
						<div class="badge-row">
							<span class="priority-badge priority-${normalizePriority(email.priority)}">${escapeHtml(email.priority)}</span>
							${email.unread ? '<span class="status-badge">Unread</span>' : '<span class="status-badge">Read</span>'}
						</div>
					</div>
					<span class="email-date">${escapeHtml(email.date)}</span>
				</li>
			`,
				)
				.join("")}
		</ul>
	`;
}

function renderTaskList(tasks) {
	if (!tasks.length) return renderEmpty("No matching tasks.");
	return `
		<ul class="task-list">
			${tasks.map(renderTaskItem).join("")}
		</ul>
	`;
}

function renderTaskItem(task) {
	const priority = normalizePriority(task.priority);
	return `
		<li class="task-item">
			<p class="item-title">${escapeHtml(task.title || "Untitled task")}</p>
			<p class="item-meta">Due: ${escapeHtml(task.due || "later")}</p>
			<div class="badge-row">
				<span class="priority-badge priority-${priority}">${escapeHtml(priority)}</span>
				<span class="status-badge">${escapeHtml(task.status || "queued")}</span>
			</div>
			<div class="task-actions" aria-label="Task actions">
				<button class="mini-btn" type="button" data-task-action="complete" data-task-id="${escapeHtml(task.id)}">Mark complete</button>
				<button class="mini-btn" type="button" data-task-action="priority" data-task-id="${escapeHtml(task.id)}">Change priority</button>
				<button class="mini-btn" type="button" data-task-action="edit" data-task-id="${escapeHtml(task.id)}">Edit</button>
				<button class="mini-btn" type="button" data-task-action="delete" data-task-id="${escapeHtml(task.id)}">Delete</button>
			</div>
		</li>
	`;
}

function renderPriorityColumn(group) {
	const labels = {
		high: "🔴 High Priority",
		medium: "🟡 Medium Priority",
		low: "🟢 Low Priority",
	};
	return `
		<section class="priority-column">
			<h3>${labels[group.priority]}</h3>
			${group.tasks.length ? renderTaskList(group.tasks) : renderEmpty("No tasks in this group.")}
		</section>
	`;
}

function renderTimeline(items) {
	return `
		<ul class="timeline-list">
			${items
				.map(
					(item) => `
				<li class="timeline-item">
					<span class="timeline-time">${escapeHtml(item.time)}</span>
					<div>
						<p class="item-title">${escapeHtml(item.title)}</p>
						<p class="item-meta">${escapeHtml(item.type)}</p>
					</div>
				</li>
			`,
				)
				.join("")}
		</ul>
	`;
}

function renderState(status, fallback) {
	if (status === "loading")
		return '<div class="loading-card">Loading...</div>';
	if (status === "error")
		return `<div class="error-card">${escapeHtml(fallback)}</div>`;
	return renderEmpty(fallback);
}

function renderEmpty(message) {
	return `<div class="empty-card">${escapeHtml(message)}</div>`;
}

function bindTaskActionButtons() {
	document.querySelectorAll("[data-task-action]").forEach((button) => {
		button.addEventListener("click", () => {
			const taskIndex = assistantData.tasks.items.findIndex(
				(item) => item.id === button.dataset.taskId,
			);
			const task = assistantData.tasks.items[taskIndex];
			if (!task) return;

			const action = button.dataset.taskAction;
			if (action === "complete") {
				task.status = "done";
				showToast("Task marked complete locally.");
			}

			if (action === "priority") {
				const next = { high: "medium", medium: "low", low: "high" };
				task.priority = next[normalizePriority(task.priority)];
				showToast(`Priority changed to ${task.priority}.`);
			}

			if (action === "edit") {
				const nextTitle = window.prompt(
					"Edit task title",
					task.title || "",
				);
				if (nextTitle?.trim()) {
					task.title = nextTitle.trim();
					showToast("Task updated locally.");
				}
			}

			if (
				action === "delete" &&
				window.confirm(`Delete "${task.title}" from this view?`)
			) {
				assistantData.tasks.items.splice(taskIndex, 1);
				showToast("Task deleted locally.");
			}

			renderCurrentView();
		});
	});
}

async function sendMessage(promptOverride) {
	if (state.isSending) return;

	const input = document.getElementById("userInput");
	const prompt = String(promptOverride ?? input?.value ?? "").trim();
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
	const assistantMessage = addMessage("", "assistant", {
		streaming: true,
		model: "thinking",
	});
	setSending(true);
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
				mode: "planner",
				level: "intermediate",
				teachingStyle: "direct",
				attachments: state.attachments,
				includeProject:
					document.getElementById("includeProject")?.checked || false,
				assistantContext: buildAssistantContext(),
			}),
			signal: state.abortController.signal,
		});

		if (!response.ok || !response.body)
			throw new Error("The assistant could not start a response.");
		await readStream(response.body, assistantMessage);
		state.attachments = [];
		renderAttachments();
		await loadPlannerData();
	} catch (error) {
		updateMessage(
			assistantMessage,
			error?.name === "AbortError"
				? "Generation stopped."
				: `I couldn't complete that request.\n\n**Error:** ${error?.message || "Unknown error"}`,
		);
	} finally {
		assistantMessage?.classList.remove("streaming");
		setSending(false);
		state.abortController = null;
	}
}

async function readStream(body, messageElement) {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let fullText = "";

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

			if (payload.type === "tool" && payload.message) {
				fullText += `${payload.message}\n\n`;
				updateMessage(messageElement, fullText, payload.tool);
			}

			if (payload.type === "chunk") {
				fullText += payload.text || "";
				updateMessage(messageElement, fullText, payload.model);
			}

			if (payload.type === "error") {
				updateMessage(
					messageElement,
					payload.message || "The assistant returned an error.",
				);
			}

			if (payload.type === "done") {
				messageElement.classList.remove("streaming");
			}
		}
	}

	if (!fullText.trim()) {
		updateMessage(
			messageElement,
			"I didn't receive a response. Please try again.",
		);
	}
}

function addWelcomeMessage() {
	addMessage(
		"Good morning. I can summarize your meetings, scan priorities, help plan focus blocks, or answer anything about your day.",
		"assistant",
		{ model: "lavoro" },
	);
}

function addMessage(content, role, options = {}) {
	const messages = document.getElementById("chatMessages");
	if (!messages) return null;

	const article = document.createElement("article");
	article.className = `message ${role}`;
	article.dataset.raw = content || "";
	article.innerHTML = `
		<div class="message-bubble">
			<div class="message-meta">
				<strong>${role === "user" ? "You" : "Lavoro"}</strong>
				<span>${escapeHtml(options.model || "assistant")}</span>
			</div>
			<div class="message-content">${options.streaming ? renderThinking() : renderMarkdown(content)}</div>
		</div>
	`;

	messages.appendChild(article);
	scrollChatToBottom();
	return article;
}

function updateMessage(message, content, model) {
	if (!message) return;
	message.dataset.raw = content || "";

	const meta = message.querySelector(".message-meta span");
	const contentElement = message.querySelector(".message-content");
	if (meta && model) meta.textContent = model;
	if (contentElement)
		contentElement.innerHTML = content
			? renderMarkdown(content)
			: renderThinking();
	scrollChatToBottom();
}

function renderThinking() {
	return '<div class="ai-thinking"><span></span><span></span><span></span><em>Thinking...</em></div>';
}

async function resetChat() {
	if (state.abortController) state.abortController.abort();

	try {
		await apiPost("/api/reset", { sessionId: SESSION_ID });
	} catch (_) {}

	const messages = document.getElementById("chatMessages");
	if (messages) messages.innerHTML = "";
	state.attachments = [];
	state.lastPrompt = "";
	renderAttachments();
	addWelcomeMessage();
	await loadPlannerData();
	showToast("Conversation reset.");
	document.getElementById("userInput")?.focus();
}

function setSending(isSending) {
	state.isSending = isSending;
	const sendBtn = document.getElementById("sendBtn");
	const input = document.getElementById("userInput");

	if (sendBtn) {
		sendBtn.disabled = isSending;
		sendBtn.innerHTML = isSending
			? '<span class="spinner"></span>Sending'
			: '<i class="fas fa-paper-plane" aria-hidden="true"></i>Send';
	}

	input?.setAttribute("aria-busy", isSending ? "true" : "false");
}

async function handleFiles(event) {
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
	renderAttachments();
	showToast(`${parsed.length} file${parsed.length > 1 ? "s" : ""} attached.`);
	event.target.value = "";
}

function renderAttachments() {
	const tray = document.getElementById("attachmentTray");
	if (!tray) return;

	tray.innerHTML = "";
	tray.hidden = state.attachments.length === 0;
	state.attachments.forEach((attachment, index) => {
		const chip = document.createElement("button");
		chip.type = "button";
		chip.className = "attachment-chip";
		chip.innerHTML = `<i class="fas fa-file-lines" aria-hidden="true"></i><span>${escapeHtml(attachment.name)}</span><i class="fas fa-xmark" aria-hidden="true"></i>`;
		chip.addEventListener("click", () => {
			state.attachments.splice(index, 1);
			renderAttachments();
		});
		tray.appendChild(chip);
	});
}

function autoGrowInput() {
	const input = document.getElementById("userInput");
	if (!input) return;
	input.style.height = "auto";
	input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
}

function buildTimeline(events, tasks) {
	const timeline = [];
	events.forEach((event) => {
		timeline.push({
			time: event.time.replace(" AM", "").replace(" PM", ""),
			title: event.title,
			type: event.duration,
		});
		if (event.title === "Team Standup")
			timeline.push({
				time: "09:30",
				title: "Focus Work",
				type: "Deep work block",
			});
		if (event.title === "Project Review")
			timeline.push({
				time: "12:00",
				title: "Focus Work",
				type: "Follow-up and execution",
			});
		if (event.title === "Client Call")
			timeline.push({
				time: "03:00",
				title: tasks[0]?.title || "Project Documentation",
				type: "Priority task",
			});
	});
	return timeline;
}

function buildAssistantContext() {
	return {
		weather: assistantData.weather.summary,
		calendarEvents: assistantData.calendar.events,
		importantEmails: assistantData.emails.items.filter(
			(email) => email.priority === "high",
		),
		tasks: assistantData.tasks.items,
		reminders: assistantData.reminders.items,
	};
}

function todayPill() {
	return `<span class="meta-pill">${new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(new Date())}</span>`;
}

function normalizePriority(priority) {
	const value = String(priority || "medium").toLowerCase();
	if (value.includes("high")) return "high";
	if (value.includes("low")) return "low";
	return "medium";
}

function renderMarkdown(markdown) {
	const lines = escapeHtml(markdown || "")
		.split(/\n{2,}/)
		.map((block) => {
			if (/^[-*]\s/m.test(block)) {
				const items = block
					.split("\n")
					.filter(Boolean)
					.map((line) => `<li>${line.replace(/^[-*]\s/, "")}</li>`)
					.join("");
				return `<ul>${items}</ul>`;
			}
			return `<p>${block
				.replace(/\n/g, "<br>")
				.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
				.replace(/`([^`\n]+)`/g, "<code>$1</code>")}</p>`;
		});
	return lines.join("");
}

async function apiGet(path) {
	const response = await fetch(`${API_URL}${path}`, {
		headers: { "X-Session-Id": SESSION_ID, Accept: "application/json" },
	});
	if (!response.ok) throw new Error(`Request failed: ${response.status}`);
	return response.json();
}

async function apiPost(path, body) {
	const response = await fetch(`${API_URL}${path}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Session-Id": SESSION_ID,
			Accept: "application/json",
		},
		body: JSON.stringify(body),
	});
	if (!response.ok) throw new Error(`Request failed: ${response.status}`);
	return response.json();
}

function getApiUrl() {
	const { hostname, protocol, port } = window.location;
	if (protocol === "file:") return "http://localhost:10000";
	if (hostname === "localhost" || hostname === "127.0.0.1")
		return port === "10000"
			? window.location.origin
			: "http://localhost:10000";
	if (hostname === "lavoro.umeshshah.in" || hostname === "www.umeshshah.in")
		return "https://api.lavoro.umeshshah.in";
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

function inferLanguage(fileName) {
	const extension = fileName.split(".").pop().toLowerCase();
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
		}[extension] || "text"
	);
}

function showToast(message) {
	document.querySelector(".toast")?.remove();
	const toast = document.createElement("div");
	toast.className = "toast";
	toast.setAttribute("role", "status");
	toast.textContent = message;
	document.body.appendChild(toast);
	requestAnimationFrame(() => toast.classList.add("show"));
	setTimeout(() => {
		toast.classList.remove("show");
		setTimeout(() => {
			if (toast?.parentNode) toast.remove();
		}, 220);
	}, 2400);
}

function escapeHtml(value) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function scrollChatToBottom() {
	const container = document.getElementById("chatMessages");
	if (!container) return;
	requestAnimationFrame(() => {
		container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
	});
}
