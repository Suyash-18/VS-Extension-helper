const vscode = require('vscode');
const simpleGit = require('simple-git');
const { GoogleGenerativeAI } = require('@google/generative-ai');

let statusBarItem;
let checkInterval;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    // 1. Initialize Status Bar
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    context.subscriptions.push(statusBarItem);
    startBackgroundCheck(); 

    // 2. Register Dashboard Command
    let dashboardCommand = vscode.commands.registerCommand('git-helper.openDashboard', () => {
        const panel = vscode.window.createWebviewPanel(
            'gitDashboard', 
            'Git AI Dashboard', 
            vscode.ViewColumn.One, 
            { enableScripts: true }
        );

        panel.webview.html = getDashboardHtml();

        // Handle clicks from the HTML Dashboard
        panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'publish': vscode.commands.executeCommand('git-helper.publishRepo'); break;
                case 'clone': vscode.commands.executeCommand('git-helper.cloneRepo'); break;
                case 'commit': vscode.commands.executeCommand('git-helper.aiCommit'); break;
                case 'graph': vscode.commands.executeCommand('git-helper.showGraph'); break;
            }
        });
    });

    // --- EXISTING COMMANDS (Logic) ---

    let publishCommand = vscode.commands.registerCommand('git-helper.publishRepo', async () => {
        const folder = await getRootPath();
        if (!folder) return;
        const git = simpleGit(folder);
        try {
            await git.init();
            const remoteUrl = await vscode.window.showInputBox({ 
                placeHolder: 'Enter GitHub Remote URL', 
                prompt: 'Paste the link to your empty GitHub repo' 
            });
            if (remoteUrl) {
                await git.addRemote('origin', remoteUrl);
                await git.add('.');
                await git.commit('Initial commit');
                await git.branch(['-M', 'main']);
                await git.push(['-u', 'origin', 'main']);
                vscode.window.showInformationMessage('Repo published!');
            }
        } catch (err) { vscode.window.showErrorMessage(err.message); }
    });

    let cloneCommand = vscode.commands.registerCommand('git-helper.cloneRepo', async () => {
        const repoUrl = await vscode.window.showInputBox({ placeHolder: 'Git Repo URL' });
        if (!repoUrl) return;
        const folderUri = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, openLabel: 'Select Destination' });
        if (folderUri && folderUri[0]) {
            vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "Cloning..." }, async () => {
                try {
                    await simpleGit().clone(repoUrl, folderUri[0].fsPath);
                    const open = await vscode.window.showInformationMessage('Cloned. Open?', 'Yes', 'No');
                    if (open === 'Yes') vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(folderUri[0].fsPath));
                } catch (err) { vscode.window.showErrorMessage(err.message); }
            });
        }
    });

    let aiCommitCommand = vscode.commands.registerCommand('git-helper.aiCommit', async () => {
        const folder = await getRootPath();
        if (!folder) return;
        const git = simpleGit(folder);
        const config = vscode.workspace.getConfiguration('gitHelper');
        const apiKey = config.get('geminiApiKey');

        if (!apiKey) return vscode.window.showErrorMessage('Gemini API Key missing in Settings');

        try {
            const status = await git.status();
            if (status.files.length === 0) return vscode.window.showInformationMessage('No changes to commit.');
            
            await git.add('.'); 
            const diff = await git.diff(['--staged']);
            if (!diff) return;

            vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "AI generating options..." }, async () => {
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: "gemini-pro" });
                
                const prompt = `Generate 3 distinct git commit messages for this diff in JSON format ["style1", "style2", "style3"]: \n${diff.substring(0, 3000)}`;
                const result = await model.generateContent(prompt);
                
                let options = [];
                try {
                    options = JSON.parse(result.response.text().replace(/```json/g, '').replace(/```/g, '').trim());
                } catch (e) { options = [result.response.text()]; }

                const selected = await vscode.window.showQuickPick(options, { placeHolder: 'Select commit message' });
                if (selected) {
                    await git.commit(selected);
                    await git.push();
                    vscode.window.showInformationMessage('Committed & Pushed: ' + selected);
                }
            });
        } catch (err) { vscode.window.showErrorMessage('AI Error: ' + err.message); }
    });

    let graphCommand = vscode.commands.registerCommand('git-helper.showGraph', async () => {
        const folder = await getRootPath();
        if (!folder) return;
        const panel = vscode.window.createWebviewPanel('gitGraph', 'Git Graph', vscode.ViewColumn.One, {});
        try {
            const log = await simpleGit(folder).log(['--all']);
            panel.webview.html = getGraphHtml(log.all);
        } catch (err) { vscode.window.showErrorMessage(err.message); }
    });

    context.subscriptions.push(dashboardCommand, publishCommand, cloneCommand, aiCommitCommand, graphCommand);
}

// --- HTML HELPERS ---

function getDashboardHtml() {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: sans-serif; padding: 20px; color: var(--vscode-editor-foreground); display: flex; flex-direction: column; align-items: center; }
            h1 { margin-bottom: 30px; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; max-width: 600px; width: 100%; }
            .card {
                background: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
                padding: 20px;
                border-radius: 8px;
                cursor: pointer;
                text-align: center;
                transition: transform 0.2s;
                border: 1px solid var(--vscode-widget-border);
            }
            .card:hover { transform: translateY(-5px); background: var(--vscode-button-secondaryHoverBackground); }
            .card h3 { margin: 0 0 10px 0; }
            .card p { font-size: 0.9em; opacity: 0.8; }
            .icon { font-size: 2em; margin-bottom: 10px; display: block; }
        </style>
    </head>
    <body>
        <h1>Git Helper Dashboard</h1>
        <div class="grid">
            <div class="card" onclick="trigger('publish')">
                <span class="icon">🚀</span>
                <h3>Publish Repo</h3>
                <p>Initialize & Push to GitHub</p>
            </div>
            <div class="card" onclick="trigger('clone')">
                <span class="icon">📥</span>
                <h3>Clone Repo</h3>
                <p>Download from URL</p>
            </div>
            <div class="card" onclick="trigger('commit')">
                <span class="icon">🤖</span>
                <h3>AI Smart Commit</h3>
                <p>Generate Messages & Push</p>
            </div>
            <div class="card" onclick="trigger('graph')">
                <span class="icon">📊</span>
                <h3>Show Graph</h3>
                <p>View Commit History</p>
            </div>
        </div>

        <script>
            const vscode = acquireVsCodeApi();
            function trigger(command) {
                vscode.postMessage({ command: command });
            }
        </script>
    </body>
    </html>`;
}

function getGraphHtml(commits) {
    // Generate the HTML list of rows
    const rows = commits.map(c => {
        const date = new Date(c.date).toLocaleDateString() + ' ' + new Date(c.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `
            <tr class="commit-row">
                <td class="hash-col">
                    <span class="hash">${c.hash.substring(0, 7)}</span>
                </td>
                <td class="msg-col">
                    <div class="marker"></div>
                    <span class="message">${c.message}</span>
                </td>
                <td class="meta-col">
                    <div class="author">${c.author_name}</div>
                    <div class="date">${date}</div>
                </td>
            </tr>
        `;
    }).join('');

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>
            body { 
                font-family: var(--vscode-font-family), monospace; 
                background-color: var(--vscode-editor-background); 
                color: var(--vscode-editor-foreground); 
                padding: 20px; 
            }
            h2 { 
                border-bottom: 1px solid var(--vscode-widget-border); 
                padding-bottom: 10px; 
                margin-bottom: 20px;
            }
            table { 
                width: 100%; 
                border-collapse: collapse; 
            }
            th, td { 
                text-align: left; 
                padding: 8px 12px; 
            }
            .commit-row {
                border-left: 2px solid var(--vscode-widget-border);
                transition: background 0.1s;
            }
            .commit-row:hover {
                background-color: var(--vscode-list-hoverBackground);
                border-left: 2px solid #007acc; /* Highlight Blue */
            }
            .hash { 
                font-family: monospace; 
                color: var(--vscode-textPreformat-foreground); 
                background: var(--vscode-textBlockQuote-background); 
                padding: 2px 6px; 
                border-radius: 4px;
            }
            .marker {
                display: inline-block;
                width: 8px;
                height: 8px;
                background-color: #007acc;
                border-radius: 50%;
                margin-right: 10px;
            }
            .message { 
                font-weight: 600; 
                font-size: 1.1em;
            }
            .author { 
                font-weight: bold; 
                color: var(--vscode-gitDecoration-modifiedResourceForeground); 
            }
            .date { 
                font-size: 0.85em; 
                opacity: 0.7; 
            }
            
            /* Column Widths */
            .hash-col { width: 80px; vertical-align: top; padding-top: 12px; }
            .meta-col { width: 180px; text-align: right; vertical-align: top; padding-top: 12px; }
            .msg-col { vertical-align: middle; }

        </style>
    </head>
    <body>
        <h2>Commit Logs</h2>
        <table>
            ${rows}
        </table>
    </body>
    </html>`;
}
async function getRootPath() {
    if (!vscode.workspace.workspaceFolders) { vscode.window.showErrorMessage('No folder open'); return undefined; }
    return vscode.workspace.workspaceFolders[0].uri.fsPath;
}

function startBackgroundCheck() {
    // Poll every 30 seconds (reduced from 2 mins for easier testing)
    checkInterval = setInterval(async () => {
        if (!vscode.workspace.workspaceFolders) return;
        const folder = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const git = simpleGit(folder);

        try {
            // 1. Fetch silently to update remote references
            await git.fetch();

            // 2. Check how many commits we are behind
            const status = await git.status();
            
            if (status.behind > 0) {
                // 3. Get the Author Name of the latest incoming commit
                // 'HEAD..@{u}' means "Compare my current spot with the Upstream branch"
                // '--pretty=format:%an' extracts just the Author Name
                const authorName = await git.raw(['log', 'HEAD..@{u}', '-n', '1', '--pretty=format:%an']);
                
                // 4. Update Status Bar
                statusBarItem.text = `$(cloud-download) ${status.behind} Incoming`;
                statusBarItem.tooltip = `Last change by ${authorName}`;
                statusBarItem.show();

                // 5. Show Interactive Popup
                // We await the user's choice
                const msg = `Remote Update: ${authorName.trim()} pushed ${status.behind} new commit(s).`;
                const selection = await vscode.window.showInformationMessage(msg, 'Sync Changes');

                // 6. Handle "Sync Changes" Click
                if (selection === 'Sync Changes') {
                    vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "Syncing..." }, async () => {
                        await git.pull();
                        vscode.window.showInformationMessage(`Successfully synced updates from ${authorName.trim()}`);
                        statusBarItem.hide(); // Hide icon after sync
                    });
                }
            } else {
                statusBarItem.hide();
            }
        } catch (e) {
            // Fails silently if no remote is set up or network is down
            // console.log("Background check error:", e);
        }
    }, 30000); // Runs every 30 seconds
}
function deactivate() { if(checkInterval) clearInterval(checkInterval); }

module.exports = { activate, deactivate };