const API_URL = "https://api.lavoro.umeshshah.in";

// Add message to UI
function addMessage(content, isUser = false) {
	const messagesDiv = document.getElementById("chatMessages");
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
	loadingDiv.textContent = "Thinking...";

	messagesDiv.appendChild(loadingDiv);
}

// Hide loading
function hideLoading() {
	const loading = document.getElementById("loadingIndicator");
	if (loading) loading.remove();
}

// Send message
async function sendMessage() {
	console.log("🔥 sendMessage triggered");

	const input = document.getElementById("userInput");
	const message = input.value.trim();

	if (!message) return;

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

		if (data.success) {
			addMessage(data.message, false);
		} else {
			addMessage(`Error: ${data.message || "AI failed"}`, false);
		}
	} catch (error) {
		hideLoading();
		console.error("❌ Error:", error);

		addMessage("Error: Unable to connect to server.", false);
	}
}

// Quick buttons
function quickAction(action) {
	document.getElementById("userInput").value = action;
	sendMessage();
}

// Reset chat
async function resetChat() {
	try {
		await fetch(`${API_URL}/api/reset`, { method: "POST" });

		document.getElementById("chatMessages").innerHTML = "";
		addMessage("Chat reset! How can I assist you today?", false);
	} catch (error) {
		console.error("Reset error:", error);
	}
}

// Enter key
function handleKeyPress(event) {
	if (event.key === "Enter") {
		sendMessage();
	}
}

// Welcome message
window.onload = () => {
	addMessage(
		"<b>👋 Welcome to Your Personal Assistant!</b><br><br>" +
			"I'm here to help you manage your daily tasks, schedule, emails, and more.",
		false
	);
};
