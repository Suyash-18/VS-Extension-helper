# Git Helper AI 🤖

**Git Helper AI** is a powerful VS Code extension that supercharges your Git workflow. It combines **Google Gemini AI** to write intelligent commit messages with a visual dashboard for managing repositories, viewing history, and syncing with collaborators.

## ✨ Key Features

### 1. 🤖 AI Smart Commits
Stop struggling with commit messages. The extension analyzes your staged changes using Google Gemini and generates **3 structured options** for every commit:
* **Subject Line:** A punchy, concise summary (under 50 chars).
* **Detailed Body:** A full explanation of *why* and *what* changed, perfect for keeping your team in the loop.
* **Smart UI:** View the subject and details clearly before selecting.

### 2. 🔑 Flexible API Key (BYOK)
* **Instant Start:** Works immediately out of the box using a shared starter key.
* **Bring Your Own Key (Pro):** Add your own personal Gemini API Key for higher rate limits and privacy. Your key is stored securely in your OS Keychain (not in settings files).

### 3. 📊 Visual Dashboard
Access all your Git tools in one place.
* Run the command **"Git Helper: Open Dashboard"** to open a control panel.
* Use the **"⚙️ Configure Key"** card to manage your API settings.
* Drag the dashboard tab to the side to keep it open as a "floating" tool palette while you code.

### 4. 📜 Clean History Logs
View your project's history in a beautiful, easy-to-read table.
* See full author names, exact timestamps, and commit hashes.
* No complex graph lines—just a clean, readable timeline of who did what.

### 5. 🔔 Real-Time Collaborator Alerts
Never fall behind again.
* The extension works in the background, checking your remote repository every 30 seconds.
* If a teammate pushes code, you get an **instant notification** telling you *who* pushed and *how many* commits are incoming.
* Click **"Sync Changes"** directly from the popup to pull updates immediately.

### 6. 🚀 Easy Publish & Clone
* **Publish:** Initialize a local folder and push it to a new GitHub repo in seconds without touching the terminal.
* **Clone:** Paste a URL and let the extension handle the rest.

---

## ⚙️ Setup & Configuration

This extension is designed to work immediately. However, for the best experience, we recommend adding your own free Google Gemini API Key.

### How to Add Your Own Key (Recommended)
1. **Get your Key:** Go to [Google AI Studio](https://aistudio.google.com/) and click **"Get API key"** (It's free).
2. **Copy the Key.**
3. **Open VS Code Command Palette:**
    * Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac).
4. **Run the Command:**
    * Type **`Git Helper: Set Custom API Key`**.
5. **Paste your Key.**

> **🔒 Security Note:** Your custom API key is stored in **VS Code Secret Storage** (your operating system's secure keychain). It is never saved in plain text files and is safe to use in shared/recorded environments.

---

## 🎮 How to Use

You can use the **Visual Dashboard** or the **Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`).

| Feature | Command Palette Name | Description |
| :--- | :--- | :--- |
| **Dashboard** | `Git Helper: Open Dashboard` | Opens the visual UI panel. |
| **Smart Commit** | `Git Helper: AI Smart Commit` | Stages changes, generates AI messages, and commits/pushes. |
| **Set API Key** | `Git Helper: Set Custom API Key` | Securely save your personal Gemini Key. |
| **View History** | `Git Helper: Show Graph` | Opens the clean commit log viewer. |
| **Publish** | `Git Helper: Publish Repo` | Turn a local folder into a remote Git repo. |
| **Ignore Files** | `Git Helper: Ignore Files` | Select files from a list to add to .gitignore. |

---

## 📋 Requirements

* **Git** must be installed on your machine and available in your system PATH.
* An active internet connection is required for AI generation and Remote Sync alerts.

---

**Enjoy a faster, smarter Git workflow!** 🚀