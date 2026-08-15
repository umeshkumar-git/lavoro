# Lavoro - AI-Powered Personal Daily Assistant

An intelligent AI agent that automates daily tasks and improves individual workflows. This project was developed as a capstone project for the **Google AI Agents Intensive Course**.

![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)  
![Express](https://img.shields.io/badge/Express-5-black.svg)  
![Google Gemini](https://img.shields.io/badge/Google%20Gemini-Pro-orange.svg)  
![License](https://img.shields.io/badge/License-MIT-yellow.svg)  

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Demo](#demo)
- [Future Enhancements](#future-enhancements)
- [Contributing](#contributing)
- [License](#license)

## Overview

**Lavoro** (Italian for "work") is an AI-powered personal assistant that helps users manage their daily tasks, schedule, emails, and priorities through natural language conversations. The agent uses Google's Gemini AI to provide intelligent, context-aware responses that improve productivity and workflow.

This project came together during the **5-day AI Agents Intensive Course by Google**. It demonstrates how AI agents can automate routine tasks and boost personal productivity.

### Course Project Details
- **Course**: Google AI Agents Intensive
- **Duration**: 5 Days
- **Topic**: Concierge Agents - Automate Daily Tasks and Improve Individual Workflows
- **Objective**: Create a mini AI agents project that showcases key skills learned during the course

## Features

### Core Capabilities
- **Morning Briefings** - Overview of daily schedule and priorities
- **Email Summarization** - Smart filtering and prioritization of emails
- **Task Prioritization** - AI-powered suggestions for managing tasks
- **Daily Planning** - Organized daily schedules based on commitments
- **Natural Language Interface** - Conversational interaction enabled by Gemini AI

### User Experience
- **Modern UI** - Clean design with smooth gradients and animations
- **Quick Action Buttons** - Easy access to common tasks
- **Responsive Design** - Seamless use on desktop and mobile
- **Real-time Responses** - Immediate AI-generated insights
- **Context Awareness** - Remembers conversation history for better understanding

### AI Agent Features
- **Context Management** - Keeps track of the user's calendar, emails, and tasks
- **Conversational Memory** - Recalls previous interactions within the session
- **Intelligent Responses** - Creates actionable, personalized suggestions
- **Natural Language Understanding** - Responds to queries in everyday language

## Tech Stack

### Backend
- **Node.js 18+** - Backend runtime
- **Express 5** - Web framework for REST API and static frontend hosting
- **Google Generative AI (Gemini Pro)** - Large language model for smart responses
- **CORS** - Support for cross-origin resource sharing
- **Dotenv** - Management of environment variables

### Frontend
- **HTML5** - Semantic markup and structure
- **CSS3** - Modern styling with responsive design
- **Vanilla JavaScript** - Dynamic interactions and API communication
- **Fetch API** - Asynchronous HTTP requests

### AI/ML
- **Google Gemini Pro API** - Natural language processing
- **Conversation History Management** - Context-aware responses
- **Structured Data Processing** - Handling of JSON data

## Project Structure

```
lavoro/
│
├── backend/
│   ├── server.js              # Express API and frontend host
│   ├── package.json           # Node scripts and dependencies
│   ├── package-lock.json      # Locked dependency tree
│   ├── .env.example           # Environment variable template
│   └── utils/                 # Legacy Python utilities kept for reference
│
├── frontend/
│   ├── index.html             # Main HTML structure
│   ├── style.css              # Professional styling and animations
│   └── script.js              # Frontend logic and API integration
│
├── README.md                  # Project documentation
└── .gitignore                 # Git ignore rules
```

## Installation

### Prerequisites
- **Node.js 18+** installed on your system
- **Google Gemini API Key** (free tier is available at [Google AI Studio](https://aistudio.google.com/app/apikey))
- A modern web browser (Chrome, Firefox, Safari, or Edge)

### Step-by-Step Setup

#### 1. Clone the Repository
```bash
git clone https://github.com/umeshkumar-git/lavoro.git
cd lavoro
```

#### 2. Backend Setup
```bash
cd backend

# Install Node dependencies
npm install
```

#### 3. Configure Environment Variables
Create a `.env` file in the `backend` directory. You can start by copying `.env.example`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3-flash-preview
PORT=10000
```

The app can run without `GEMINI_API_KEY`; in that case, Lavoro uses demo responses backed by mock calendar, email, task, and weather data.

**To get your FREE Gemini API key:**
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key (starts with `AIzaSy...`)
5. Paste it in the `.env` file

#### 4. Run the Application

**Start Backend and Frontend Together:**
```bash
npm start
```

You should see:
```
Lavoro is running at http://localhost:10000
Health check: http://localhost:10000/api/health
```

Open [http://localhost:10000](http://localhost:10000) in your browser. The Express backend serves the frontend and handles `/api/*` requests from the same origin.

## Usage

### Quick Actions
The interface provides four pre-configured actions:

1. **Morning Briefing**
   ```
   Get an overview of your day including:
   - Weather conditions
   - Calendar events
   - Important emails
   - Priority tasks
   ```

2. **Email Summary**
   ```
   Receive a summarized list of your emails:
   - High priority messages first
   - Sender and subject details
   - Preview of email content
   ```

3. **Prioritize Tasks**
   ```
   Get AI-powered recommendations on:
   - Which tasks to focus on first
   - Urgency and importance analysis
   - Suggested time allocations
   ```

4. **Plan My Day**
   ```
   Receive a structured plan for your day:
   - Time-blocked schedule
   - Meeting preparations
   - Break recommendations
   ```

### Custom Queries
You can type your own questions in natural language:
- "What meetings do I have this afternoon?"
- "Which emails are most urgent?"
- "Help me organize my tasks by priority."
- "What should I prepare for my 2 PM client call?"
- "Give me a summary of today's schedule."

### Conversation Flow
1. User sends a message through a quick action or text input.
2. Frontend sends a POST request to `/api/chat` endpoint.
3. Backend processes the request using context data (calendar, emails, tasks).
4. Google Gemini AI generates an intelligent response.
5. Response is displayed in the chat interface with smooth animations.
6. Conversation history is maintained for context.

## API Endpoints

### `POST /api/chat`
Send a message to the AI agent and receive an intelligent response.

**Request:**
```json
{
  "message": "Give me my morning briefing"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Good morning! Here's your briefing for today...",
  "context": {
    "calendar": [
      {
        "time": "09:00 AM",
        "title": "Team Standup",
        "duration": "30 min"
      }
    ],
    "emails": [...],
    "tasks": [...],
    "weather": {...}
  }
}
```

### `POST /api/reset`
Reset the conversation history to start fresh.

**Response:**
```json
{
  "success": true,
  "message": "Conversation reset"
}
```

### `GET /api/health`
Check if the backend server is running properly.

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "service": "Lavoro Backend",
  "model": "gemini-3-flash-preview"
}
```

## Demo

### Screenshots

**Main Interface**
- Clean and modern design with a purple gradient theme
- Quick action buttons for common tasks
- Chat interface with smooth animations

**Morning Briefing Example**
```
User: "Give me my morning briefing"

Lavoro: "Good morning! Here's your briefing for today:

Weather: 22°C, Partly Cloudy - Clear skies expected

You have 4 events scheduled:
• 09:00 AM - Team Standup (30 min)
• 11:00 AM - Project Review (1 hour)
• 02:00 PM - Client Call (45 min) 
• 04:00 PM - Code Review (30 min)

Important Emails: 1 high-priority message from manager@company.com

Priority Tasks: Complete project documentation (Due: Today)

Have a productive day!"
```

### Live Demo
*Coming soon - Deploy to Heroku/Vercel*

## Future Enhancements

### Planned Features
- [ ] **Real Calendar Integration** - Sync with Google Calendar, Outlook
- [ ] **Email API Integration** - Access Gmail, Outlook emails
- [ ] **Task Management APIs** - Integrate with Todoist, Asana, Trello
- [ ] **Voice Commands** - Enable speech-to-text input
- [ ] **Voice Responses** - Add text-to-speech output
- [ ] **Mobile Application** - Build a React Native app for iOS/Android
- [ ] **User Authentication** - Support for multiple users with login
- [ ] **Data Persistence** - Store user preferences and history in a database
- [ ] **Smart Notifications** - Provide proactive reminders and alerts
- [ ] **Analytics Dashboard** - Offer productivity insights and metrics

### Advanced AI Features
- [ ] **Learning User Patterns** - Personalization over time
- [ ] **Proactive Suggestions** - AI-generated recommendations
- [ ] **Multi-modal AI** - Understand images and documents
- [ ] **Custom Agent Training** - Fine-tune based on personal data
- [ ] **Advanced Context** - Remember conversations over multiple days
- [ ] **Meeting Summaries** - Automatically generate recaps
- [ ] **Smart Scheduling** - Use AI to arrange meetings

### Technical Improvements
- [ ] **WebSocket Support** - Real-time streaming responses
- [ ] **Docker Containerization** - Simplify deployment
- [ ] **Unit Tests** - Ensure comprehensive test coverage
- [ ] **CI/CD Pipeline** - Automate testing and deployment
- [ ] **Rate Limiting** - Control API request rates
- [ ] **Error Handling** - Provide clearer error messages and recovery options

## Contributing

Contributions, issues, and feature requests are welcome! You can check the [issues page](https://github.com/umeshkumar-git/lavoro/issues).

### How to Contribute

1. **Fork the Project**
   ```bash
   # Click the 'Fork' button on GitHub
   ```

2. **Create your Feature Branch**
   ```bash
   git checkout -b feature/AmazingFeature
   ```

3. **Commit your Changes**
   ```bash
   git commit -m 'Add some AmazingFeature'
   ```

4. **Push to the Branch**
   ```bash
   git push origin feature/AmazingFeature
   ```

5. **Open a Pull Request**
   - Go to your fork on GitHub
   - Click "Pull Request"
   - Describe your changes

### Development Guidelines
- Follow **PEP 8** style guide for Python code
- Use **meaningful variable names**
- Add **comments** for complex logic
- Write **clear commit messages**
- Test thoroughly before submitting a PR

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Google AI Agents Intensive Course** - For offering great training on AI agents
- **Google Gemini AI** - For providing powerful, free API access
- **Flask Community** - For maintaining an excellent lightweight framework
- **Open Source Community** - For ongoing inspiration and resources

## Author

**Umesh Kumar**  
- GitHub: [@umeshkumar-git](https://github.com/umeshkumar-git)  
- Project: [Lavoro](https://github.com/umeshkumar-git/lavoro)  

## Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/umeshkumar-git/lavoro/issues) page
2. Create a new issue with a detailed description
3. Include error messages and screenshots if applicable

## Show Your Support

If you found this project helpful or interesting, please consider:
- Starring the repository
- Forking for your own experiments
- Sharing with others

---

**Project Status**: Active Development

**Course**: Google AI Agents Intensive (5-Day Course)  
**Topic**: Concierge Agents - Automate Daily Tasks & Improve Workflows  
**Completion Date**: November 2024
