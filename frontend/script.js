const API_URL = "http://localhost:10000";

// Theme management
function initTheme() {
	const savedTheme = localStorage.getItem("theme") || "light";

	// Remove existing theme classes
	document.body.classList.remove("light-theme", "dark-theme");
	// Add the current theme class
	document.body.classList.add(savedTheme + "-theme");

	updateThemeIcon(savedTheme);
}

function toggleTheme() {
	const isDark = document.body.classList.contains("dark-theme");
	const newTheme = isDark ? "light" : "dark";

	// Remove existing theme classes
	document.body.classList.remove("light-theme", "dark-theme");
	// Add the new theme class
	document.body.classList.add(newTheme + "-theme");

	localStorage.setItem("theme", newTheme);
	updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
	const themeToggle = document.getElementById("themeToggle");
	if (themeToggle) {
		const sunIcon = themeToggle.querySelector(".fa-sun");
		const moonIcon = themeToggle.querySelector(".fa-moon");

		if (theme === "dark") {
			if (sunIcon) sunIcon.style.opacity = "0";
			if (moonIcon) moonIcon.style.opacity = "1";
		} else {
			if (sunIcon) sunIcon.style.opacity = "1";
			if (moonIcon) moonIcon.style.opacity = "0";
		}
	}
}

// Add message to UI
function addMessage(content, isUser = false) {
	const messagesDiv = document.getElementById("chatMessages");

	// Remove welcome message if it exists
	const welcomeMessage = messagesDiv.querySelector(".welcome-message");
	if (welcomeMessage) {
		welcomeMessage.remove();
	}

	const messageDiv = document.createElement("div");
	messageDiv.className = isUser
		? "message user-message"
		: "message assistant-message";
	messageDiv.innerHTML = content;

	messagesDiv.appendChild(messageDiv);
	messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Show loading
function showLoading() {
	const messagesDiv = document.getElementById("chatMessages");
	const loadingDiv = document.createElement("div");

	loadingDiv.className = "loading";
	loadingDiv.id = "loadingIndicator";

	messagesDiv.appendChild(loadingDiv);
	messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Hide loading
function hideLoading() {
	const loading = document.getElementById("loadingIndicator");
	if (loading) loading.remove();
}

// Reset chat
async function resetChat() {
	try {
		await fetch(`${API_URL}/api/reset`, { method: "POST" });

		// Clear all messages
		document.getElementById("chatMessages").innerHTML = "";

		// Add back the welcome message
		const messagesDiv = document.getElementById("chatMessages");
		const welcomeDiv = document.createElement("div");
		welcomeDiv.className = "welcome-message";
		welcomeDiv.innerHTML = `
			<div class="welcome-icon">
				<i class="fas fa-wave"></i>
			</div>
			<div class="welcome-text">
				<h3>Hello! I'm Lavoro</h3>
				<p>How can I streamline your workflow today?</p>
			</div>
		`;
		messagesDiv.appendChild(welcomeDiv);

		// Clear input
		document.getElementById("userInput").value = "";
	} catch (error) {
		console.error("Reset error:", error);
		showError("Failed to reset chat session");
	}
}

// Show error message
function showError(message) {
	const messagesDiv = document.getElementById("chatMessages");
	const errorDiv = document.createElement("div");
	errorDiv.className = "message assistant-message error-message";
	errorDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${message}`;

	messagesDiv.appendChild(errorDiv);
	messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Enhanced send message with better error handling
async function sendMessage() {
	console.log("🚀 sendMessage triggered");

	const input = document.getElementById("userInput");
	const sendBtn = document.getElementById("sendBtn");
	const message = input.value.trim();

	if (!message) return;

	// Disable input and button during sending
	input.disabled = true;
	sendBtn.disabled = true;
	sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

	addMessage(message, true);
	input.value = "";
	showLoading();

	try {
		const response = await fetch(`${API_URL}/api/chat`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ message }),
		});

		console.log("📡 Status:", response.status);

		const data = await response.json();
		console.log("📦 Data:", data);

		hideLoading();

		if (!response.ok) {
			// Handle HTTP errors
			if (response.status === 401 || response.status === 403) {
				showError("⚠️ API Authentication Error: Please check your API key configuration.");
			} else if (response.status === 429) {
				showError("⏳ Too many requests. Please wait a moment and try again.");
			} else if (response.status === 500) {
				showError(`Server Error: ${data.message || "Please try again later."}`);
			} else {
				showError(`Error (${response.status}): ${data.message || response.statusText}`);
			}
			return;
		}

		if (data.success) {
			addMessage(data.message, false);
		} else {
			showError(data.message || "AI failed to respond");
		}
	} catch (error) {
		hideLoading();
		console.error("❌ Error:", error);

		if (error.message.includes("Failed to fetch") || error.message.includes("fetch")) {
			showError(
				"❌ Connection Error: Unable to reach the server. Please check your connection.",
			);
		} else {
			showError(`Error: ${error.message}`);
		}
	} finally {
		// Re-enable input and button
		input.disabled = false;
		sendBtn.disabled = false;
		sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
	}
}

// Quick buttons with enhanced UX
function quickAction(action) {
	document.getElementById("userInput").value = action;

	// Add a subtle animation to the input
	const input = document.getElementById("userInput");
	input.style.transform = "scale(1.02)";
	input.style.boxShadow = "0 0 20px rgba(99, 102, 241, 0.3)";

	setTimeout(() => {
		input.style.transform = "scale(1)";
		input.style.boxShadow = "none";
		sendMessage();
	}, 300);
}

// Enter key with better UX
function handleKeyPress(event) {
	if (event.key === "Enter" && !event.shiftKey) {
		event.preventDefault();
		sendMessage();
	}
}

// Initialize app
document.addEventListener("DOMContentLoaded", function () {
	// Initialize theme
	initTheme();

	// Add event listener for theme toggle
	const themeToggleBtn = document.getElementById("themeToggle");
	if (themeToggleBtn) {
		themeToggleBtn.addEventListener("click", toggleTheme);
	}

	// Add subtle animations on load
	const appLayout = document.querySelector(".app-layout");
	appLayout.style.opacity = "0";
	appLayout.style.transform = "translateY(20px)";

	setTimeout(() => {
		appLayout.style.transition = "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)";
		appLayout.style.opacity = "1";
		appLayout.style.transform = "translateY(0)";
	}, 100);

	// Focus on input when page loads
	document.getElementById("userInput").focus();
});

// Welcome message
window.onload = () => {
	addMessage(
		"<b>👋 Welcome to Your Personal Assistant!</b><br><br>" +
			"I'm here to help you manage your daily tasks, schedule, emails, and more.",
		false,
	);
};
