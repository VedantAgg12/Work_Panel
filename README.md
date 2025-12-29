# Work Panel

A modular, highly customizable productivity dashboard built with **FastAPI** and **Vanilla JavaScript**. Designed to consolidate your workflow into a single, elegant interface.

## 🚀 Modules

The application is structured into two types of modules: **General** (System) and **Application** (Productivity Tools).

### 🖥️ General Modules
Core system components that manage the environment.
1.  **Dashboard**: The central hub with draggable widgets, real-time analytics, and persistent layout.
2.  **Manager**: Internal tool to toggle capabilities and manage active modules.
3.  **Settings**: Global configuration for themes, notifications, and quick actions.

### 🧩 Plugin Application Modules
Dedicated tools to supercharge your productivity.
1.  **📋 Task Manager**: Comprehensive task tracking with Kanban views, filtering, recurrence, and deep analytics.
2.  **📚 Story Studio**: A dedicated space for creative writing and storytelling.
3.  **🎓 Study Tracker**: Track study sessions and focus time.
4.  **💡 Idea Vault**: Capture and organize your thoughts and brainstorming sessions.
5.  **📅 Event Manager**: Keep track of upcoming events and deadlines.
6.  **📝 Notes**: Quick sticky notes for transient thoughts.

## 🛠️ Setup & Run

Follow these steps to set up the project locally.

### Prerequisites
- **Python 3.7+** installed.

### Installation

1.  **Clone the repository** (or download source):
    ```bash
    git clone https://github.com/VedantAgg12/Work_Panel.git
    cd Work_Panel
    ```

2.  **Create a Virtual Environment**:
    ```bash
    # Windows
    python -m venv venv
    
    # macOS/Linux
    python3 -m venv venv
    ```

3.  **Activate the Virtual Environment**:
    ```bash
    # Windows
    .\venv\Scripts\activate
    
    # macOS/Linux
    source venv/bin/activate
    ```

4.  **Install Dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

5.  **Run the Server**:
    ```bash
    uvicorn main:app --reload --port 8001
    ```

6.  **Access the App**:
    Open [http://localhost:8001](http://localhost:8001) in your browser.

## 📝 License
This project is for personal productivity use.
