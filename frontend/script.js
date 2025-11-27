const API_URL = "http://127.0.0.1:5000";

function addMessage(content, isUser = false) {
	const messagesDiv = document.getElementById("chatMessages");
	const messageDiv = document.createElement("div");
	messageDiv.className = `message ${
		isUser ? "user-message" : "assistant-message"
	}`;

	// Allow HTML formatting:
	messageDiv.innerHTML = content;

	messagesDiv.appendChild(messageDiv);
	messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function showLoading() {
	const messagesDiv = document.getElementById("chatMessages");
	const loadingDiv = document.createElement("div");
	loadingDiv.className = "loading";
	loadingDiv.id = "loadingIndicator";
	loadingDiv.textContent = "Thinking";
	messagesDiv.appendChild(loadingDiv);
	messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function hideLoading() {
	const loading = document.getElementById("loadingIndicator");
	if (loading) {
		loading.remove();
	}
}

async function sendMessage() {
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

		const data = await response.json();
		hideLoading();

		if (data.success) {
			addMessage(data.message, false);
		} else {
			addMessage(`Error: ${data.error}`, false);
		}
	} catch (error) {
		hideLoading();
		addMessage(
			"Error: Unable to connect to server. Make sure the backend is running.",
			false
		);
		console.error("Error:", error);
	}
}

function quickAction(action) {
	document.getElementById("userInput").value = action;
	sendMessage();
}

async function resetChat() {
	try {
		await fetch(`${API_URL}/api/reset`, { method: "POST" });
		document.getElementById("chatMessages").innerHTML = "";
		addMessage("Chat reset! How can I assist you today?", false);
	} catch (error) {
		console.error("Reset error:", error);
	}
}

function handleKeyPress(event) {
	if (event.key === "Enter") {
		sendMessage();
	}
}

// Welcome message on load
window.onload = () => {
	addMessage(
	  "<div style='line-height:1.5;'>" +
		"<span style='font-size:22px; font-weight:600;'>👋 Welcome to Your Personal Assistant!</span><br><br>" +
		"<span style='font-size:16px;'>I'm here to help you manage your daily tasks, schedule, emails, and more. " +
		"Get started by clicking one of the quick actions above or simply type your question below.</span>" +
	  "</div>",
	  false
	);
  };
  
