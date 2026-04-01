from datetime import datetime, timedelta


def get_mock_calendar():
    """Generate mock calendar events"""
    today = datetime.now()
    return [
        {
            "time": "09:00 AM",
            "title": "Team Standup",
            "duration": "30 min",
            "type": "meeting",
        },
        {
            "time": "11:00 AM",
            "title": "Project Review",
            "duration": "1 hour",
            "type": "meeting",
        },
        {
            "time": "02:00 PM",
            "title": "Client Call",
            "duration": "45 min",
            "type": "important",
        },
        {
            "time": "04:00 PM",
            "title": "Code Review",
            "duration": "30 min",
            "type": "task",
        },
    ]


def get_mock_emails():
    """Generate mock emails"""
    return [
        {
            "from": "manager@company.com",
            "subject": "Q4 Goals Discussion",
            "preview": "Hi, I'd like to schedule time to discuss your Q4 objectives...",
            "priority": "high",
            "time": "2 hours ago",
        },
        {
            "from": "team@company.com",
            "subject": "Sprint Planning Notes",
            "preview": "Attached are the notes from yesterday's sprint planning...",
            "priority": "medium",
            "time": "5 hours ago",
        },
        {
            "from": "newsletter@tech.com",
            "subject": "Weekly Tech Digest",
            "preview": "Top 5 AI developments this week...",
            "priority": "low",
            "time": "1 day ago",
        },
    ]


def get_mock_tasks():
    """Generate mock tasks"""
    return [
        {
            "task": "Complete project documentation",
            "priority": "high",
            "deadline": "Today",
            "status": "pending",
        },
        {
            "task": "Review pull requests",
            "priority": "medium",
            "deadline": "Tomorrow",
            "status": "pending",
        },
        {
            "task": "Update team wiki",
            "priority": "low",
            "deadline": "This week",
            "status": "pending",
        },
    ]


def get_mock_weather():
    """Generate mock weather data"""
    return {
        "temperature": "22°C",
        "condition": "Partly Cloudy",
        "forecast": "Clear skies expected throughout the day",
    }
