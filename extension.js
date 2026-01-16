const vscode = require('vscode');
const simpleGit = require('simple-git');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

let statusBarItem;
let checkInterval;

function activate(context) {
    console.log('Git Helper Extension is now active!');

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    context.subscriptions.push(statusBarItem);
    startBackgroundCheck(); 

    // ---------------------------------------------------------
    // COMMAND 1: Smart Publish (Deep Scan)
    // ---------------------------------------------------------
    let publishCommand = vscode.commands.registerCommand('git-helper.publishRepo', async function () {
        const targetFolder = await pickFolderToPublish();
        if (!targetFolder) return;

        const git = simpleGit(targetFolder);

        try {
            const isRepo = fs.existsSync(path.join(targetFolder, '.git'));
            if (!isRepo) await git.init();

            const remoteUrl = await vscode.window.showInputBox({ 
                placeHolder: 'Enter GitHub Remote URL', 
                prompt: `Paste empty repo URL for '${path.basename(targetFolder)}'` 
            });

            if (remoteUrl) {
                try { await git.addRemote('origin', remoteUrl); } catch(e) {}
                await git.add('.');
                await git.commit('Initial commit');
                await git.branch(['-M', 'main']);
                await git.push(['-u', 'origin', 'main']);
                vscode.window.showInformationMessage(`Successfully published ${path.basename(targetFolder)}!`);
            }
        } catch (err) {
            vscode.window.showErrorMessage('Publish failed: ' + err.message);
        }
    });

    // ---------------------------------------------------------
    // COMMAND 2: Ignore Files (Deep Recursive Scan)
    // ---------------------------------------------------------
    let ignoreCommand = vscode.commands.registerCommand('git-helper.ignoreFiles', async function () {
        const folder = await getRepoOrPickOne();
        if (!folder) return;

        vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "Scanning files..." }, async () => {
            try {
                // Get ALL files recursively
                const files = getAllFilesRecursively(folder, folder);
                
                if (files.length === 0) {
                    vscode.window.showInformationMessage('No files found to ignore.');
                    return;
                }

                const selected = await vscode.window.showQuickPick(files, {
                    canPickMany: true,
                    placeHolder: `Select files/folders in '${path.basename(folder)}' to ignore`
                });

                if (selected && selected.length > 0) {
                    const gitignorePath = path.join(folder, '.gitignore');
                    // We map back to the relative path string
                    const linesToAdd = selected.map(item => item.label);
                    const content = '\n' + linesToAdd.join('\n') + '\n';
                    
                    fs.appendFileSync(gitignorePath, content);
                    vscode.window.showInformationMessage(`Added ${selected.length} items to .gitignore`);
                }
            } catch (e) {
                vscode.window.showErrorMessage('Error reading folder: ' + e.message);
            }
        });
    });

    // ---------------------------------------------------------
    // COMMAND 3: Clone
    // ---------------------------------------------------------
    let cloneCommand = vscode.commands.registerCommand('git-helper.cloneRepo', async function () {
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

    // ---------------------------------------------------------
    // COMMAND 4: AI Smart Commit
    // ---------------------------------------------------------
    let aiCommitCommand = vscode.commands.registerCommand('git-helper.aiCommit', async function () {
        const folder = await getRepoOrPickOne();
        if (!folder) return; 

        const git = simpleGit(folder);
        const config = vscode.workspace.getConfiguration('gitHelper');
        const apiKey = config.get('geminiApiKey');

        if (!apiKey) return vscode.window.showErrorMessage('Gemini API Key missing in Settings');

        try {
            const status = await git.status();
            if (status.files.length === 0) return vscode.window.showInformationMessage('No changes in ' + path.basename(folder));
            
            await git.add('.'); 
            const diff = await git.diff(['--staged']);
            if (!diff) return;

            vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "AI generating options..." }, async () => {
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
                
                const prompt = `Generate 3 distinct git commit messages for this diff in JSON format ["style1", "style2", "style3"]: \n${diff.substring(0, 3000)}`;
                const result = await model.generateContent(prompt);
                
                let options = [];
                try {
                    const text = result.response.text();
                    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
                    options = JSON.parse(jsonStr);
                } catch (e) { options = [result.response.text()]; }

                const selected = await vscode.window.showQuickPick(options, { placeHolder: `Commit message for ${path.basename(folder)}` });
                if (selected) {
                    await git.commit(selected);
                    await git.push();
                    vscode.window.showInformationMessage(`Pushed to ${path.basename(folder)}`);
                }
            });
        } catch (err) { vscode.window.showErrorMessage('Error: ' + err.message); }
    });

    // ---------------------------------------------------------
    // COMMAND 5: Show Graph
    // ---------------------------------------------------------
    let graphCommand = vscode.commands.registerCommand('git-helper.showGraph', async function () {
        const folder = await getRepoOrPickOne();
        if (!folder) return;

        const panel = vscode.window.createWebviewPanel('gitGraph', `Graph: ${path.basename(folder)}`, vscode.ViewColumn.One, {});
        try {
            const git = simpleGit(folder);
            const log = await git.log(['--all']);
            panel.webview.html = getGraphHtml(log.all, path.basename(folder));
        } catch (err) { vscode.window.showErrorMessage(err.message); }
    });

    // ---------------------------------------------------------
    // COMMAND 6: Dashboard
    // ---------------------------------------------------------
    let dashboardCommand = vscode.commands.registerCommand('git-helper.openDashboard', () => {
        const panel = vscode.window.createWebviewPanel('gitDashboard', 'Git AI Dashboard', vscode.ViewColumn.One, { enableScripts: true });
        panel.webview.html = getDashboardHtml();
        panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'publish': vscode.commands.executeCommand('git-helper.publishRepo'); break;
                case 'clone': vscode.commands.executeCommand('git-helper.cloneRepo'); break;
                case 'commit': vscode.commands.executeCommand('git-helper.aiCommit'); break;
                case 'ignore': vscode.commands.executeCommand('git-helper.ignoreFiles'); break;
                case 'graph': vscode.commands.executeCommand('git-helper.showGraph'); break;
            }
        });
    });

    context.subscriptions.push(dashboardCommand, publishCommand, cloneCommand, aiCommitCommand, graphCommand, ignoreCommand);
}

// ---------------------------------------------------------
// RECURSIVE FILE SCANNER (The Fix)
// ---------------------------------------------------------

function getAllFilesRecursively(dir, rootDir) {
    let results = [];
    try {
        const list = fs.readdirSync(dir);
        
        list.forEach(file => {
            const fullPath = path.join(dir, file);
            const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/'); // Force forward slashes
            const stat = fs.statSync(fullPath);

            // Ignore common junk folders to prevent freezing
            if (file === '.git' || file === 'node_modules' || file === 'dist' || file === 'build' || file === '.vscode') return;

            if (stat && stat.isDirectory()) {
                // Add the folder itself as an ignore option
                results.push({ label: relativePath + '/', description: 'Folder' });
                // Recurse into it
                results = results.concat(getAllFilesRecursively(fullPath, rootDir));
            } else {
                // It's a file
                results.push({ label: relativePath, description: 'File' });
            }
        });
    } catch (e) {}
    return results;
}

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------

// Deep scan for Publish Candidates
async function pickFolderToPublish() {
    if (!vscode.workspace.workspaceFolders) return undefined;
    const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    let candidates = [];

    // Check root
    if (!fs.existsSync(path.join(rootPath, '.git'))) {
        candidates.push({ label: `$(file-directory) Root`, description: 'Current Workspace', path: rootPath });
    }

    // Helper to scan depth
    function scanDir(dir, depth) {
        if (depth > 4) return; // Stop if too deep
        try {
            const files = fs.readdirSync(dir, { withFileTypes: true });
            for (const file of files) {
                if (file.isDirectory() && !['node_modules', '.git', 'dist', 'build'].includes(file.name)) {
                    const subPath = path.join(dir, file.name);
                    const hasGit = fs.existsSync(path.join(subPath, '.git'));
                    
                    if (!hasGit) {
                        // It's a potential new repo
                        candidates.push({ label: `$(file-directory) ${file.name}`, description: path.relative(rootPath, subPath), path: subPath });
                    }
                    // Keep digging
                    scanDir(subPath, depth + 1);
                }
            }
        } catch(e) {}
    }

    scanDir(rootPath, 0);

    if (candidates.length === 0) return rootPath;

    const selected = await vscode.window.showQuickPick(candidates, { placeHolder: 'Select folder to Publish (Recursive Scan)' });
    return selected ? selected.path : undefined;
}

async function getRepoOrPickOne() {
    if (!vscode.workspace.workspaceFolders) {
        vscode.window.showErrorMessage('No workspace open');
        return undefined;
    }
    const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    
    // Use the same recursive logic to FIND existing repos
    let repos = [];
    if (fs.existsSync(path.join(rootPath, '.git'))) repos.push({ label: 'Root', path: rootPath });

    function findRepos(dir, depth) {
        if (depth > 4) return;
        try {
            const files = fs.readdirSync(dir, { withFileTypes: true });
            for (const file of files) {
                if (file.isDirectory() && !['node_modules', 'dist'].includes(file.name)) {
                    const subPath = path.join(dir, file.name);
                    if (fs.existsSync(path.join(subPath, '.git'))) {
                        repos.push({ label: file.name, path: subPath });
                    } else {
                        // Only recurse if this folder ISN'T a repo itself (nested repos are rare/complex)
                        findRepos(subPath, depth + 1);
                    }
                }
            }
        } catch(e){}
    }
    findRepos(rootPath, 0);

    if (repos.length === 0) {
        vscode.window.showErrorMessage('No Git repositories found.');
        return undefined;
    } else if (repos.length === 1) {
        return repos[0].path;
    } else {
        const picked = await vscode.window.showQuickPick(repos.map(r => r.label), { placeHolder: 'Select repository' });
        return picked ? repos.find(r => r.label === picked).path : undefined;
    }
}

function startBackgroundCheck() {
    checkInterval = setInterval(async () => {
        if (!vscode.workspace.workspaceFolders) return;
        const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        
        // Find all repos (quick scan)
        let repoPaths = [];
        if (fs.existsSync(path.join(rootPath, '.git'))) repoPaths.push(rootPath);
        
        // Simple 1-level scan for background check to save performance
        try {
            const files = fs.readdirSync(rootPath, { withFileTypes: true });
            for (const file of files) {
                if (file.isDirectory()) {
                    const subPath = path.join(rootPath, file.name);
                    if (fs.existsSync(path.join(subPath, '.git'))) repoPaths.push(subPath);
                }
            }
        } catch(e) {}

        for (const repoPath of repoPaths) {
            const git = simpleGit(repoPath);
            const repoName = path.basename(repoPath);
            try {
                await git.fetch();
                const status = await git.status();
                if (status.behind > 0) {
                    const authorName = await git.raw(['log', 'HEAD..@{u}', '-n', '1', '--pretty=format:%an']);
                    statusBarItem.text = `$(cloud-download) ${repoName}: ${status.behind}↓`;
                    statusBarItem.show();
                    
                    vscode.window.showInformationMessage(`Update in [${repoName}]: ${authorName.trim()} pushed ${status.behind} commits.`, 'Sync Now').then(sel => {
                        if (sel === 'Sync Now') {
                            vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Syncing ${repoName}...` }, async () => {
                                await git.pull();
                                statusBarItem.hide();
                            });
                        }
                    });
                    break;
                }
            } catch (e) { }
        }
    }, 30000); 
}

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
            .icon { font-size: 2em; margin-bottom: 10px; display: block; }
        </style>
    </head>
    <body>
        <h1>Git Helper Dashboard</h1>
        <div class="grid">
            <div class="card" onclick="trigger('publish')"><span class="icon">🚀</span><h3>Publish Repo</h3><p>Deep Scan & Init</p></div>
            <div class="card" onclick="trigger('clone')"><span class="icon">📥</span><h3>Clone Repo</h3><p>Download URL</p></div>
            <div class="card" onclick="trigger('ignore')"><span class="icon">🙈</span><h3>Ignore Files</h3><p>Select ANY file</p></div>
            <div class="card" onclick="trigger('commit')"><span class="icon">🤖</span><h3>AI Smart Commit</h3><p>Auto-Message</p></div>
            <div class="card" onclick="trigger('graph')"><span class="icon">📊</span><h3>Show Graph</h3><p>History Log</p></div>
        </div>
        <script>
            const vscode = acquireVsCodeApi();
            function trigger(command) { vscode.postMessage({ command: command }); }
        </script>
    </body>
    </html>`;
}

function getGraphHtml(commits, repoName) {
    const rows = commits.map(c => {
        const date = new Date(c.date).toLocaleDateString() + ' ' + new Date(c.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `<tr class="commit-row"><td class="hash-col"><span class="hash">${c.hash.substring(0, 7)}</span></td><td class="msg-col"><div class="marker"></div><span class="message">${c.message}</span></td><td class="meta-col"><div class="author">${c.author_name}</div><div class="date">${date}</div></td></tr>`;
    }).join('');
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><style>body{font-family:var(--vscode-font-family),monospace;background-color:var(--vscode-editor-background);color:var(--vscode-editor-foreground);padding:20px}h2{border-bottom:1px solid var(--vscode-widget-border);padding-bottom:10px;margin-bottom:20px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:8px 12px}.commit-row{border-left:2px solid var(--vscode-widget-border)}.commit-row:hover{background-color:var(--vscode-list-hoverBackground);border-left:2px solid #007acc}.hash{font-family:monospace;color:var(--vscode-textPreformat-foreground);background:var(--vscode-textBlockQuote-background);padding:2px 6px;border-radius:4px}.marker{display:inline-block;width:8px;height:8px;background-color:#007acc;border-radius:50%;margin-right:10px}.message{font-weight:600}.author{font-weight:bold;color:var(--vscode-gitDecoration-modifiedResourceForeground)}.date{font-size:.85em;opacity:.7}</style></head><body><h2>Log: ${repoName}</h2><table>${rows}</table></body></html>`;
}

function deactivate() { if (checkInterval) clearInterval(checkInterval); }
module.exports = { activate, deactivate };