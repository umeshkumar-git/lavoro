// Suppress noisy errors caused by browser extensions (chrome-extension://)
// and avoid uncaught promise messages coming from extensions.
window.addEventListener("error", (e) => {
	try {
		const fname = e?.filename || "";
		if (typeof fname === "string" && fname.startsWith("chrome-extension://")) {
			e.preventDefault();
			return true;
		}
	} catch (err) {
		// noop
	}
});

window.addEventListener("unhandledrejection", (e) => {
	try {
		const reason = e?.reason;
		const msg = (reason && reason.message) || String(reason || "");
		if (msg.includes("A listener indicated an asynchronous response by returning true")) {
			// Prevent the browser from logging this as an uncaught promise error
			e.preventDefault();
			return true;
		}
		// Also ignore extension-origin rejections
		if (String(msg).includes("chrome-extension://")) {
			e.preventDefault();
			return true;
		}
	} catch (err) {
		// noop
	}
});

const API_URL = getApiUrl();
const SESSION_ID = getSessionId();

const state = {
	mode: "learn",
	level: "intermediate",
	teachingStyle: "direct",
	attachments: [],
	lastPrompt: "",
	abortController: null,
};

const modeFallback = {
	learn: { label: "Learn", description: "Concepts, examples, exercises" },
	debug: { label: "Debug", description: "Errors, logs, hypotheses" },
	review: { label: "Code Review", description: "Severity-based feedback" },
	pair: { label: "Pair", description: "Build step by step" },
	project: { label: "Project", description: "Specs and milestones" },
	interview: { label: "Interview", description: "Practice with scoring" },
	systemDesign: { label: "System Design", description: "Architecture reasoning" },
	planner: { label: "Learning Path", description: "Personal roadmap" },
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
	initTheme();
	bindEvents();
	renderModes(modeFallback);
	addWelcomeMessage();

	await Promise.all([
		loadHealth(),
		loadModes(),
		loadProfile(),
		loadProjectSummary(),
		loadPlannerData(),
	]);
	document.getElementById("userInput").focus();
}

function bindEvents() {
	document.getElementById("chatForm").addEventListener("submit", (event) => {
		event.preventDefault();
		sendMessage();
	});
	document.getElementById("stopBtn").addEventListener("click", stopGeneration);
	document.getElementById("newChatBtn").addEventListener("click", resetChat);
	document.getElementById("themeToggle").addEventListener("click", toggleTheme);
	document.getElementById("levelSelect").addEventListener("change", (event) => {
		state.level = event.target.value;
	});
	document.getElementById("teachingSelect").addEventListener("change", (event) => {
		state.teachingStyle = event.target.value;
	});
	document.getElementById("fileInput").addEventListener("change", handleFiles);
	document.getElementById("profileForm").addEventListener("submit", saveProfile);
	document.querySelectorAll("[data-prompt]").forEach((button) => {
		button.addEventListener("click", () => {
			document.getElementById("userInput").value = button.dataset.prompt;
			autoGrowInput();
			sendMessage();
		});
	});

	const userInputEl = document.getElementById("userInput");
	if (userInputEl) {
		userInputEl.addEventListener("input", autoGrowInput);
		userInputEl.addEventListener("keydown", (e) => {
			if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
				e.preventDefault();
				sendMessage();
			}
		});
	}
}

function autoGrowInput() {
	const input = document.getElementById("userInput");
	if (!input) return;
	input.style.height = "auto";
	input.style.height = `${Math.min(input.scrollHeight, 220)}px`;
}

function getApiUrl() {
	const hostname = window.location.hostname;
	const protocol = window.location.protocol;

	if (hostname === "localhost" || hostname === "127.0.0.1") {
		return window.location.port === "10000"
			? window.location.origin
			: "http://localhost:10000";
	}

	if (protocol === "file:") return "http://localhost:10000";
	if (hostname === "lavoro.umeshshah.in" || hostname === "www.umeshshah.in") {
		return "https://api.lavoro.umeshshah.in";
	}

	return `${protocol}//${hostname}${window.location.port ? `:${window.location.port}` : ""}`;
}

function getSessionId() {
	const existing = localStorage.getItem("developerMentorSessionId");
	if (existing) return existing;

	const sessionId =
		crypto.randomUUID?.() ||
		`mentor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
	localStorage.setItem("developerMentorSessionId", sessionId);
	return sessionId;
}

async function loadHealth() {
	try {
		const data = await apiGet("/api/health");
		const badge = document.getElementById("healthBadge");
		badge.textContent = `${data.status} · ${data.model}`;
		badge.classList.add("online");
	} catch {
		const badge = document.getElementById("healthBadge");
		badge.textContent = "Backend offline";
		badge.classList.add("offline");
	}
}

async function loadModes() {
	try {
		const data = await apiGet("/api/ai/modes");
		renderModes(data.modes);
	} catch {
		renderModes(modeFallback);
	}
}

async function loadProfile() {
	try {
		const data = await apiGet("/api/profile");
		const profile = data.profile;
		document.getElementById("profileExperience").value =
			profile.experienceLevel || "";
		document.getElementById("profileLanguages").value = (
			profile.languages || []
		).join(", ");
		document.getElementById("profileGoal").value = profile.goal || "";
		document.getElementById("profileProject").value =
			profile.currentProject || "";
		document.getElementById("levelSelect").value =
			profile.experienceLevel || "intermediate";
		document.getElementById("teachingSelect").value =
			profile.preferredStyle || "direct";
		state.level = document.getElementById("levelSelect").value;
		state.teachingStyle = document.getElementById("teachingSelect").value;
	} catch {
		showToast("Profile will use local defaults until the backend is reachable.");
	}
}

async function loadProjectSummary() {
	try {
		const data = await apiGet("/api/project/structure");
		const summary = data.project.summary;
		document.getElementById("projectSummary").innerHTML = `
			<strong>${summary.totalFiles}</strong> indexed files<br>
			${summary.frontendFiles} frontend · ${summary.backendFiles} backend · ${summary.testFiles} tests
		`;
	} catch {
		document.getElementById("projectSummary").textContent =
			"Project context unavailable.";
	}
}

async function loadPlannerData() {
	try {
		const [taskData, reminderData, planData] = await Promise.all([
			apiGet("/api/tasks"),
			apiGet("/api/reminders"),
			apiGet("/api/plans"),
		]);
		renderTasks(taskData.tasks || []);
		renderReminders(reminderData.reminders || []);
		renderPlans(planData.plans || []);
	} catch {
		renderTasks([]);
		renderReminders([]);
		document.getElementById("dailyPlan").textContent =
			"Planner data is unavailable right now.";
	}
}

function renderTasks(tasks) {
	const list = document.getElementById("taskList");
	if (!list) return;
	list.innerHTML = "";

	if (!tasks.length) {
		list.innerHTML = '<li class="stack-item"><div><strong>No active tasks</strong><small>Add one from the chat or your plan.</small></div></li>';
		return;
	}

	tasks.slice(0, 5).forEach((task) => {
		const item = document.createElement("li");
		item.className = "stack-item";
		item.innerHTML = `
			<div>
				<strong>${escapeHtml(task.title)}</strong>
				<small>${escapeHtml(task.due || "later")} · ${escapeHtml(task.category || "general")}</small>
			</div>
			<span class="stack-badge">${escapeHtml(task.priority || "medium")}</span>
		`;
		list.appendChild(item);
	});
}

function renderReminders(reminders) {
	const list = document.getElementById("reminderList");
	if (!list) return;
	list.innerHTML = "";

	if (!reminders.length) {
		list.innerHTML = '<li class="stack-item"><div><strong>No reminders</strong><small>Ask the assistant to set one.</small></div></li>';
		return;
	}

	reminders.slice(0, 5).forEach((reminder) => {
		const item = document.createElement("li");
		item.className = "stack-item";
		item.innerHTML = `
			<div>
				<strong>${escapeHtml(reminder.title)}</strong>
				<small>${escapeHtml(reminder.when || "later")}</small>
			</div>
			<span class="stack-badge">${reminder.done ? "Done" : "Soon"}</span>
		`;
		list.appendChild(item);
	});
}

function renderPlans(plans) {
	const target = document.getElementById("dailyPlan");
	if (!target) return;

	if (!plans.length) {
		target.textContent = "No plan generated yet.";
		return;
	}

	const latest = plans[0];
	target.innerHTML = `${escapeHtml(latest.summary || "Plan ready.")}<br><small>${escapeHtml(latest.tasks?.map((task) => task.title).join(" • ") || "Focus on your top priorities.")}</small>`;
}

function renderModes(modes) {
	const modeList = document.getElementById("modeList");
	modeList.innerHTML = "";

	Object.entries(modes).forEach(([key, mode]) => {
		const button = document.createElement("button");
		button.type = "button";
		button.className = key === state.mode ? "mode-btn active" : "mode-btn";
		button.innerHTML = `
			<span>${escapeHtml(mode.label)}</span>
			<small>${escapeHtml(mode.description || "")}</small>
		`;
		button.addEventListener("click", () => {
			state.mode = key;
			renderModes(modes);
		});
		modeList.appendChild(button);
	});
}

async function sendMessage(promptOverride) {
	const input = document.getElementById("userInput");
	const prompt = String(promptOverride || input.value).trim();
	if (!prompt) return;

	state.lastPrompt = prompt;
	input.value = "";
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
				mode: state.mode,
				level: state.level,
				teachingStyle: state.teachingStyle,
				attachments: state.attachments,
				includeProject: document.getElementById("includeProject").checked,
			}),
			signal: state.abortController.signal,
		});

		if (!response.ok || !response.body) {
			throw new Error("The mentor could not start a response.");
		}

		await readStream(response.body, assistantMessage);
		state.attachments = [];
		renderAttachments();
	} catch (error) {
		if (error.name !== "AbortError") {
			updateMessage(assistantMessage, `Error: ${error.message}`);
		}
	} finally {
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
			const line = event
				.split("\n")
				.find((entry) => entry.startsWith("data: "));
			if (!line) continue;

			const payload = JSON.parse(line.slice(6));
			if (payload.type === "chunk") {
				fullText += payload.text;
				updateMessage(messageElement, fullText, payload.model);
			}
			if (payload.type === "error") {
				updateMessage(messageElement, `Error: ${payload.message}`);
			}
			if (payload.type === "done") {
				messageElement.classList.remove("streaming");
				messageElement.dataset.model = payload.model;
				addMessageActions(messageElement, fullText);
			}
		}
	}
}

function addWelcomeMessage() {
	addMessage(
		"Welcome. Choose a mode, paste code or a question, and I’ll help you reason through it like a senior engineer: concepts, tradeoffs, fixes, tests, and next practice steps.",
		"assistant",
		{ model: "system" },
	);
}

function addMessage(content, role, options = {}) {
	const messages = document.getElementById("chatMessages");
	const message = document.createElement("article");
	message.className = `message ${role}-message${options.streaming ? " streaming" : ""}`;
	message.dataset.raw = content;
	message.dataset.model = options.model || "";
	message.innerHTML = `
		<div class="message-meta">
			<strong>${role === "user" ? "You" : "Developer Mentor AI"}</strong>
			<span>${escapeHtml(options.model || state.mode)}</span>
		</div>
		<div class="message-content">${renderMarkdown(content)}</div>
	`;
	messages.appendChild(message);
	messages.scrollTop = messages.scrollHeight;

	if (role === "assistant" && content) addMessageActions(message, content);
	return message;
}

function updateMessage(message, content, model) {
	message.dataset.raw = content;
	if (model) message.dataset.model = model;
	message.querySelector(".message-meta span").textContent =
		model || message.dataset.model || state.mode;
	message.querySelector(".message-content").innerHTML = renderMarkdown(content);
	document.getElementById("chatMessages").scrollTop =
		document.getElementById("chatMessages").scrollHeight;
}

function addMessageActions(message, content) {
	if (message.querySelector(".message-actions")) return;

	const actions = document.createElement("div");
	actions.className = "message-actions";
	actions.innerHTML = `
		<button type="button" data-action="copy"><i class="fas fa-copy"></i> Copy</button>
		<button type="button" data-action="regenerate"><i class="fas fa-rotate"></i> Regenerate</button>
	`;
	actions.querySelector('[data-action="copy"]').addEventListener("click", () => {
		navigator.clipboard.writeText(content || message.dataset.raw || "");
	});
	actions
		.querySelector('[data-action="regenerate"]')
		.addEventListener("click", () => sendMessage(state.lastPrompt));
	message.appendChild(actions);
	bindCodeCopyButtons(message);
}

function bindCodeCopyButtons(scope = document) {
	scope.querySelectorAll(".copy-code").forEach((button) => {
		if (button.dataset.bound) return;
		button.dataset.bound = "true";
		button.addEventListener("click", () => {
			const code = button.closest(".code-block").querySelector("code").textContent;
			navigator.clipboard.writeText(code);
			button.textContent = "Copied";
			setTimeout(() => {
				button.textContent = "Copy";
			}, 1200);
		});
	});
}

function renderMarkdown(markdown) {
	const escaped = escapeHtml(markdown || "");
	const withCode = escaped.replace(
		/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g,
		(_, language, code) => `<div class="code-block"><div><span>${language || "code"}</span><button class="copy-code" type="button">Copy</button></div><pre><code>${code.trim()}</code></pre></div>`,
	);

	return withCode
		.replace(/^###\s(.+)$/gm, "<h3>$1</h3>")
		.replace(/^##\s(.+)$/gm, "<h2>$1</h2>")
		.replace(/^#\s(.+)$/gm, "<h2>$1</h2>")
		.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
		.replace(/`([^`]+)`/g, "<code>$1</code>")
		.replace(/\n/g, "<br>");
}

async function handleFiles(event) {
	const files = Array.from(event.target.files || []).slice(0, 4);
	const attachments = await Promise.all(
		files.map(async (file) => ({
			name: file.name,
			language: inferLanguage(file.name),
			content: (await file.text()).slice(0, 12_000),
		})),
	);

	state.attachments.push(...attachments);
	state.attachments = state.attachments.slice(0, 4);
	renderAttachments();
	event.target.value = "";
}

function renderAttachments() {
	const tray = document.getElementById("attachmentTray");
	tray.innerHTML = "";
	tray.hidden = state.attachments.length === 0;

	state.attachments.forEach((attachment, index) => {
		const chip = document.createElement("button");
		chip.type = "button";
		chip.className = "attachment-chip";
		chip.innerHTML = `<i class="fas fa-file-code"></i> ${escapeHtml(attachment.name)} <span>remove</span>`;
		chip.addEventListener("click", () => {
			state.attachments.splice(index, 1);
			renderAttachments();
		});
		tray.appendChild(chip);
	});
}

async function saveProfile(event) {
	event.preventDefault();
	const profile = {
		experienceLevel: document.getElementById("profileExperience").value,
		languages: csv(document.getElementById("profileLanguages").value),
		goal: document.getElementById("profileGoal").value,
		currentProject: document.getElementById("profileProject").value,
		preferredStyle: state.teachingStyle,
	};

	try {
		await apiPost("/api/profile", profile);
		showToast("Profile saved.");
	} catch {
		showToast("Could not save profile.");
	}
}

async function resetChat() {
	await apiPost("/api/reset", { sessionId: SESSION_ID });
	document.getElementById("chatMessages").innerHTML = "";
	addWelcomeMessage();
}

function stopGeneration() {
	state.abortController?.abort();
}

function setSending(isSending) {
	const sendBtn = document.getElementById("sendBtn");
	const stopBtn = document.getElementById("stopBtn");
	const input = document.getElementById("userInput");

	if (sendBtn) {
		sendBtn.disabled = isSending;
		sendBtn.classList.toggle("loading", isSending);
		sendBtn.innerHTML = isSending
			? '<span class="spinner"></span> Sending'
			: '<i class="fas fa-paper-plane"></i> Send';
	}
	if (stopBtn) stopBtn.disabled = !isSending;
	if (input) input.disabled = isSending;
}

function initTheme() {
	document.body.classList.toggle(
		"dark-theme",
		localStorage.getItem("theme") === "dark",
	);
	const themeToggle = document.getElementById("themeToggle");
	if (themeToggle) {
		const icon = themeToggle.querySelector("i");
		if (icon) {
			icon.className = document.body.classList.contains("dark-theme")
				? "fas fa-sun"
				: "fas fa-moon";
		}
	}
}

function toggleTheme() {
	const isDark = document.body.classList.toggle("dark-theme");
	localStorage.setItem("theme", isDark ? "dark" : "light");
	const themeToggle = document.getElementById("themeToggle");
	if (themeToggle) {
		const icon = themeToggle.querySelector("i");
		if (icon) {
			icon.className = isDark ? "fas fa-sun" : "fas fa-moon";
		}
	}
}

async function apiGet(path) {
	const response = await fetch(`${API_URL}${path}`, {
		headers: { "X-Session-Id": SESSION_ID },
	});
	if (!response.ok) throw new Error("Request failed");
	return response.json();
}

async function apiPost(path, body) {
	const response = await fetch(`${API_URL}${path}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Session-Id": SESSION_ID,
		},
		body: JSON.stringify(body),
	});
	if (!response.ok) throw new Error("Request failed");
	return response.json();
}

function showToast(message) {
	const toast = document.createElement("div");
	toast.className = "toast";
	toast.textContent = message;
	document.body.appendChild(toast);
	setTimeout(() => toast.remove(), 2400);
}

function inferLanguage(fileName) {
	const extension = fileName.split(".").pop().toLowerCase();
	const map = {
		js: "javascript",
		jsx: "javascript",
		ts: "typescript",
		tsx: "typescript",
		py: "python",
		java: "java",
		c: "c",
		cpp: "cpp",
		go: "go",
		rs: "rust",
		sql: "sql",
		html: "html",
		css: "css",
		json: "json",
		yml: "yaml",
		yaml: "yaml",
		sh: "bash",
	};
	return map[extension] || "text";
}

function csv(value) {
	return String(value || "")
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

function escapeHtml(value) {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}
