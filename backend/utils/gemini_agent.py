import google.generativeai as genai
import os
from .mock_data import (
    get_mock_calendar,
    get_mock_emails,
    get_mock_tasks,
    get_mock_weather,
)


class DailyAssistantAgent:
    def __init__(self, api_key):
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(
            "gemini-2.5-flash"
        )  # <--- UPDATED MODEL NAME
        self.chat = self.model.start_chat(history=[])

    def get_context_data(self):
        """Gather all context data"""
        return {
            "calendar": get_mock_calendar(),
            "emails": get_mock_emails(),
            "tasks": get_mock_tasks(),
            "weather": get_mock_weather(),
        }

    def create_system_prompt(self, context_data):
        """Create system prompt with context"""
        return f"""You are a helpful personal daily assistant agent. You help users manage their daily tasks and schedule.

Current Context:
- Weather: {context_data['weather']['temperature']}, {context_data['weather']['condition']}
- Calendar Events Today: {len(context_data['calendar'])} events
- Unread Important Emails: {sum(1 for e in context_data['emails'] if e['priority'] == 'high')}
- Pending High Priority Tasks: {sum(1 for t in context_data['tasks'] if t['priority'] == 'high')}

Your capabilities:
1. Provide morning briefings
2. Summarize emails by priority
3. Help prioritize tasks
4. Suggest daily schedules
5. Give reminders and productivity tips

Be concise, friendly, and actionable. Format responses clearly with bullet points when appropriate.

Current Data Available:
Calendar Events: {context_data['calendar']}
Emails: {context_data['emails']}
Tasks: {context_data['tasks']}
Weather: {context_data['weather']}"""

    def send_message(self, user_message):
        """Main chat function"""
        context_data = self.get_context_data()
        system_prompt = self.create_system_prompt(context_data)

        # Combine system prompt with user message
        full_prompt = f"{system_prompt}\n\nUser Request: {user_message}\n\nAssistant:"

        try:
            response = self.chat.send_message(full_prompt)

            return {"success": True, "message": response.text, "context": context_data}

        except Exception as e:
            return {"success": False, "error": str(e)}

    def reset_conversation(self):
        """Reset conversation history"""
        self.chat = self.model.start_chat(history=[])
