from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
from utils.gemini_agent import DailyAssistantAgent

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Initialize agent
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("⚠️  WARNING: GEMINI_API_KEY not found in .env file!")
    print("Please add your API key to backend/.env")
else:
    print("✅ API Key loaded successfully!")

agent = DailyAssistantAgent(api_key)


@app.route("/api/chat", methods=["POST"])
def chat():
    """Handle chat requests"""
    data = request.json
    user_message = data.get("message", "")

    if not user_message:
        return jsonify({"error": "No message provided"}), 400

    response = agent.send_message(user_message)
    return jsonify(response)


@app.route("/api/reset", methods=["POST"])
def reset():
    """Reset conversation"""
    agent.reset_conversation()
    return jsonify({"success": True, "message": "Conversation reset"})


@app.route("/api/health", methods=["GET"])
def health():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "model": "Google Gemini Pro"})


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    print(f"🚀 Server running on http://localhost:{port}")
    print(f"🤖 Using Google Gemini Pro (FREE!)")
    app.run(debug=True, port=port)
