# Git Helper AI 🤖

**Git Helper AI** is a powerful VS Code extension that supercharges your Git workflow. It combines **Google Gemini AI** to write intelligent commit messages with a visual dashboard for managing repositories, viewing history, and syncing with collaborators.

## ✨ Key Features

### 1. 🤖 AI Smart Commits
Stop struggling with commit messages. The extension analyzes your staged changes using Google Gemini and offers **3 distinct options** to choose from:
* **Conventional:** Professional and standard (e.g., `feat: add user login`).
* **Expressive:** Includes emojis for quick visual scanning (e.g., `🐛 Fix login bug`).
* **Short:** Concise and to the point.

### 2. 📊 Visual Dashboard
Access all your Git tools in one place.
* Run the command **"Git Helper: Open Dashboard"** to open a control panel.
* Drag the dashboard tab to the side to keep it open as a "floating" tool palette while you code.

### 3. 📜 Clean History Logs
View your project's history in a beautiful, easy-to-read table.
* See full author names, exact timestamps, and commit hashes.
* No complex graph lines—just a clean, readable timeline of who did what.

### 4. 🔔 Real-Time Collaborator Alerts
Never fall behind again.
* The extension works in the background, checking your remote repository every 30 seconds.
* If a teammate pushes code, you get an **instant notification** telling you *who* pushed and *how many* commits are incoming.
* Click **"Sync Changes"** directly from the popup to pull updates immediately.

### 5. 🚀 Easy Publish & Clone
* **Publish:** Initialize a local folder and push it to a new GitHub repo in seconds without touching the terminal.
* **Clone:** Paste a URL and let the extension handle the rest.

---

## ⚙️ Setup (Required)

To use the AI features, you need a free Google Gemini API Key.

1. **Get your Key:** Go to [Google AI Studio](https://aistudio.google.com/) and click **"Get API key"**.
2. **Copy the Key.**
3. **Open VS Code Settings:**
    * Press `Ctrl + ,` (Windows/Linux) or `Cmd + ,` (Mac).
    * Search for **`Gemini`**.
4. **Paste the Key:** Enter your key into the setting: **`Git Helper: Gemini Api Key`**.

> **Note:** Your API key is stored locally in your VS Code settings and is never shared with anyone else.

---

## 🎮 How to Use

You can use the **Dashboard** or the **Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`).

| Feature | Command Palette Name | Description |
| :--- | :--- | :--- |
| **Dashboard** | `Git Helper: Open Dashboard` | Opens the visual UI panel. |
| **Smart Commit** | `Git: AI Smart Commit` | Stages changes, generates AI messages, and commits/pushes. |
| **View History** | `Git: Show Network Graph` | Opens the clean commit log viewer. |
| **Publish** | `Git: Publish/Init Repo` | Turn a local folder into a remote Git repo. |
| **Clone** | `Git: Clone Repository` | Clone a repo from a URL. |

---

## 🔧 Extension Settings

This extension contributes the following settings:

* `gitHelper.geminiApiKey`: Your Google Gemini API Key. (Required for AI commits).

---

## 📋 Requirements

* **Git** must be installed on your machine and available in your system PATH.
* An active internet connection is required for AI generation and Remote Sync alerts.

---

**Enjoy a faster, smarter Git workflow!** 🚀