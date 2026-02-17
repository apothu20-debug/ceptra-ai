import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

let authToken: string | null = null;
let userEmail: string | null = null;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Ceptra AI');
  authToken = context.globalState.get('ceptra.token') || null;
  userEmail = context.globalState.get('ceptra.email') || null;

  const chatProvider = new CeptraChatProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('ceptra.chat', chatProvider),
    vscode.commands.registerCommand('ceptra.ask', () => quickAsk(chatProvider)),
    vscode.commands.registerCommand('ceptra.explain', () => codeAction('explain', chatProvider)),
    vscode.commands.registerCommand('ceptra.refactor', () => codeAction('refactor', chatProvider)),
    vscode.commands.registerCommand('ceptra.test', () => codeAction('test', chatProvider)),
    vscode.commands.registerCommand('ceptra.fix', () => codeAction('fix', chatProvider)),
    vscode.commands.registerCommand('ceptra.docs', () => codeAction('docs', chatProvider)),
    vscode.commands.registerCommand('ceptra.run', () => runCurrentFile()),
    vscode.commands.registerCommand('ceptra.image', () => quickTool('image', chatProvider)),
    vscode.commands.registerCommand('ceptra.pptx', () => quickTool('pptx', chatProvider)),
    vscode.commands.registerCommand('ceptra.xlsx', () => quickTool('xlsx', chatProvider)),
    vscode.commands.registerCommand('ceptra.signout', () => signOut(context, chatProvider)),
  );
}

export function deactivate() {}

// ── Auth ──
async function signIn(email: string, password: string, context: vscode.ExtensionContext): Promise<{ success: boolean; error?: string }> {
  const config = vscode.workspace.getConfiguration('ceptra');
  const serverUrl = config.get<string>('serverUrl') || 'https://ceptra-ai.vercel.app';
  try {
    const res = await fetch(`${serverUrl}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data: any = await res.json();
    if (data.token) {
      authToken = data.token;
      userEmail = email;
      await context.globalState.update('ceptra.token', authToken);
      await context.globalState.update('ceptra.email', userEmail);
      return { success: true };
    }
    return { success: false, error: data.error || 'Login failed' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Connection failed' };
  }
}

async function signOut(context: vscode.ExtensionContext, provider: CeptraChatProvider) {
  authToken = null;
  userEmail = null;
  await context.globalState.update('ceptra.token', null);
  await context.globalState.update('ceptra.email', null);
  provider.refresh();
  vscode.window.showInformationMessage('Signed out of Ceptra AI');
}

// ── Workspace Context ──
function getWorkspaceContext(): string {
  const ws = vscode.workspace.workspaceFolders;
  if (!ws?.length) return 'No workspace open.';

  const root = ws[0].uri.fsPath;
  const parts: string[] = [];

  // Project type detection
  const hasPackageJson = fs.existsSync(path.join(root, 'package.json'));
  const hasSfdxProject = fs.existsSync(path.join(root, 'sfdx-project.json'));
  const hasPyProject = fs.existsSync(path.join(root, 'pyproject.toml')) || fs.existsSync(path.join(root, 'requirements.txt'));

  parts.push(`Workspace: ${path.basename(root)}`);
  parts.push(`Root path: ${root}`);

  if (hasSfdxProject) {
    parts.push('Project type: Salesforce DX (SFDX)');
    try {
      const sfdx = JSON.parse(fs.readFileSync(path.join(root, 'sfdx-project.json'), 'utf8'));
      if (sfdx.packageDirectories) parts.push(`Package dirs: ${sfdx.packageDirectories.map((d: any) => d.path).join(', ')}`);
    } catch {}
    // List Salesforce classes and components
    try {
      const classDir = path.join(root, 'force-app', 'main', 'default', 'classes');
      if (fs.existsSync(classDir)) {
        const classes = fs.readdirSync(classDir).filter(f => f.endsWith('.cls')).slice(0, 30);
        if (classes.length) parts.push(`Apex classes: ${classes.join(', ')}`);
      }
      const lwcDir = path.join(root, 'force-app', 'main', 'default', 'lwc');
      if (fs.existsSync(lwcDir)) {
        const lwcs = fs.readdirSync(lwcDir).filter(f => !f.startsWith('.')).slice(0, 20);
        if (lwcs.length) parts.push(`LWC components: ${lwcs.join(', ')}`);
      }
      const triggerDir = path.join(root, 'force-app', 'main', 'default', 'triggers');
      if (fs.existsSync(triggerDir)) {
        const triggers = fs.readdirSync(triggerDir).filter(f => f.endsWith('.trigger')).slice(0, 20);
        if (triggers.length) parts.push(`Triggers: ${triggers.join(', ')}`);
      }
    } catch {}
  }

  if (hasPackageJson) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
      parts.push(`Node project: ${pkg.name || 'unnamed'}`);
      if (pkg.scripts) parts.push(`Scripts: ${Object.keys(pkg.scripts).join(', ')}`);
      if (pkg.dependencies) parts.push(`Dependencies: ${Object.keys(pkg.dependencies).slice(0, 15).join(', ')}`);
    } catch {}
  }

  if (hasPyProject) parts.push('Project type: Python');

  // List top-level files and folders
  try {
    const items = fs.readdirSync(root).filter(f => !f.startsWith('.') && f !== 'node_modules');
    const dirs = items.filter(f => fs.statSync(path.join(root, f)).isDirectory());
    const files = items.filter(f => !fs.statSync(path.join(root, f)).isDirectory());
    if (dirs.length) parts.push(`Folders: ${dirs.slice(0, 20).join(', ')}`);
    if (files.length) parts.push(`Files: ${files.slice(0, 20).join(', ')}`);
  } catch {}

  // Current open file
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const rel = path.relative(root, editor.document.uri.fsPath);
    const lineCount = editor.document.lineCount;
    parts.push(`Open file: ${rel} (${editor.document.languageId}, ${lineCount} lines)`);
    // Include first 50 lines of current file for context
    const preview = editor.document.getText().split('\n').slice(0, 50).join('\n');
    if (preview) parts.push(`Current file preview:\n${preview}`);
  }

  return parts.join('\n');
}

// ── Execute Terminal Command ──
function executeCommand(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const ws = vscode.workspace.workspaceFolders;
  const cwd = ws?.[0]?.uri.fsPath || process.cwd();

  return new Promise((resolve) => {
    exec(command, { cwd, timeout: 120000, maxBuffer: 1024 * 1024 * 5 }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout?.toString() || '',
        stderr: stderr?.toString() || '',
        exitCode: error?.code || 0,
      });
    });
  });
}

// ── Read File ──
function readFileContent(filePath: string): string {
  const ws = vscode.workspace.workspaceFolders;
  const root = ws?.[0]?.uri.fsPath || '';
  const full = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
  try {
    return fs.readFileSync(full, 'utf8');
  } catch {
    return `[Error: cannot read ${filePath}]`;
  }
}

// ── Write File ──
function writeFileContent(filePath: string, content: string): string {
  const ws = vscode.workspace.workspaceFolders;
  const root = ws?.[0]?.uri.fsPath || '';
  const full = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
  try {
    const dir = path.dirname(full);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
    return `File written: ${filePath}`;
  } catch (e: any) {
    return `[Error writing ${filePath}: ${e.message}]`;
  }
}

// ── API Client ──
async function callCeptra(message: string, context?: string, history?: Array<{role: string, content: string}>): Promise<string> {
  const config = vscode.workspace.getConfiguration('ceptra');
  const url = config.get<string>('serverUrl') || 'https://ceptra-ai.vercel.app';

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const systemPrompt = `You are Ceptra AI, an agentic coding assistant inside VS Code.

YOU CAN EXECUTE ACTIONS using these exact formats:

To run a terminal command (user must approve first):
\`\`\`run
exact command here
\`\`\`

To read a file:
\`\`\`read
filepath here
\`\`\`

To write/create a file:
\`\`\`write:filepath
file content here
\`\`\`

RULES:
- ALWAYS use the \`\`\`run format for terminal commands
- Explain what each command does BEFORE the run block
- One command at a time — wait for results before suggesting next
- NEVER invent commands — only suggest real, valid commands
- FOCUS on what the user asked. If they say "check code" or "understand repo", READ the actual source files (Apex classes, LWC components, triggers etc) and analyze them. Do NOT suggest installing packages or npm commands unless the user specifically asks.

IMPORTANT: When the user asks to "check code", "understand repo", "review code", or similar:
1. First read the key source files using \`\`\`read blocks
2. Then analyze the code structure, patterns, and logic
3. Summarize what each file does
4. Point out any issues or improvements
Do NOT suggest running npm install, npm login, or package installations unless explicitly asked.

SALESFORCE PROJECT COMMANDS (sf CLI):
- Auth: sf org login web --set-default-org --alias myOrg
- Retrieve: sf project retrieve start
- Deploy: sf project deploy start
- Push source: sf project deploy start --source-dir force-app
- List orgs: sf org list
- Run tests: sf apex run test --test-level RunLocalTests
- Open org: sf org open
- Run anonymous apex: sf apex run --file script.apex

NODE.JS COMMANDS:
- Install: npm install
- Dev: npm run dev
- Build: npm run build
- Test: npm test

GIT COMMANDS:
- Status: git status
- Commit: git add -A && git commit -m "message"
- Push: git push
- Pull: git pull

${context ? `\nCurrent workspace:\n${context}` : ''}`;

  const res = await fetch(`${url}/api/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message,
      stream: false,
      system: systemPrompt,
      history: history || [],
    }),
  });

  if (!res.ok) throw new Error(`Ceptra error: ${res.status}`);
  const data: any = await res.json();
  return data.content;
}

// ── Read Project Files for Code Review ──
function readProjectFiles(): string {
  const ws = vscode.workspace.workspaceFolders;
  if (!ws?.length) return '';
  const root = ws[0].uri.fsPath;
  const contents: string[] = [];
  let totalSize = 0;
  const maxSize = 15000; // Keep under token limits

  // Read Apex classes
  const classDir = path.join(root, 'force-app', 'main', 'default', 'classes');
  if (fs.existsSync(classDir)) {
    const files = fs.readdirSync(classDir).filter(f => f.endsWith('.cls'));
    for (const f of files) {
      if (totalSize > maxSize) break;
      try {
        const content = fs.readFileSync(path.join(classDir, f), 'utf8');
        const truncated = content.slice(0, 4000);
        contents.push(`=== ${f} ===\n${truncated}${content.length > 4000 ? '\n...(truncated)' : ''}`);
        totalSize += truncated.length;
      } catch {}
    }
  }

  // Read LWC components
  const lwcDir = path.join(root, 'force-app', 'main', 'default', 'lwc');
  if (fs.existsSync(lwcDir)) {
    const components = fs.readdirSync(lwcDir).filter(f => !f.startsWith('.'));
    for (const comp of components) {
      if (totalSize > maxSize) break;
      const compDir = path.join(lwcDir, comp);
      if (!fs.statSync(compDir).isDirectory()) continue;
      const jsFile = path.join(compDir, `${comp}.js`);
      const htmlFile = path.join(compDir, `${comp}.html`);
      if (fs.existsSync(jsFile)) {
        try {
          const content = fs.readFileSync(jsFile, 'utf8');
          contents.push(`=== lwc/${comp}/${comp}.js ===\n${content.slice(0, 3000)}`);
          totalSize += Math.min(content.length, 3000);
        } catch {}
      }
      if (fs.existsSync(htmlFile)) {
        try {
          const content = fs.readFileSync(htmlFile, 'utf8');
          contents.push(`=== lwc/${comp}/${comp}.html ===\n${content.slice(0, 2000)}`);
          totalSize += Math.min(content.length, 2000);
        } catch {}
      }
    }
  }

  // Read Aura components (just controllers)
  const auraDir = path.join(root, 'force-app', 'main', 'default', 'aura');
  if (fs.existsSync(auraDir) && totalSize < maxSize) {
    const components = fs.readdirSync(auraDir).filter(f => !f.startsWith('.')).slice(0, 5);
    for (const comp of components) {
      if (totalSize > maxSize) break;
      const compDir = path.join(auraDir, comp);
      if (!fs.statSync(compDir).isDirectory()) continue;
      // Read controller
      const ctrlFile = fs.readdirSync(compDir).find(f => f.endsWith('Controller.js'));
      if (ctrlFile) {
        try {
          const content = fs.readFileSync(path.join(compDir, ctrlFile), 'utf8');
          contents.push(`=== aura/${comp}/${ctrlFile} ===\n${content.slice(0, 2000)}`);
          totalSize += Math.min(content.length, 2000);
        } catch {}
      }
    }
  }

  // Read triggers
  const triggerDir = path.join(root, 'force-app', 'main', 'default', 'triggers');
  if (fs.existsSync(triggerDir) && totalSize < maxSize) {
    const files = fs.readdirSync(triggerDir).filter(f => f.endsWith('.trigger'));
    for (const f of files) {
      if (totalSize > maxSize) break;
      try {
        const content = fs.readFileSync(path.join(triggerDir, f), 'utf8');
        contents.push(`=== triggers/${f} ===\n${content.slice(0, 3000)}`);
        totalSize += Math.min(content.length, 3000);
      } catch {}
    }
  }

  return contents.join('\n\n');
}

// ── Detect if user wants code review ──
function isCodeReviewRequest(message: string): boolean {
  const m = message.toLowerCase();
  return /\b(check code|review code|explain code|understand|analyze|what does|how does|code review|look at code|check repo|check folder|explain class|explain this)\b/.test(m);
}

// ── Parse AI Response for Actions ──
interface AIAction {
  type: 'run' | 'read' | 'write' | 'text';
  content: string;
  file?: string;
}

function parseActions(response: string): AIAction[] {
  const actions: AIAction[] = [];
  
  // Only match our specific action blocks, not regular code blocks
  const runRegex = /```run\n([\s\S]*?)```/g;
  const readRegex = /```read\n([\s\S]*?)```/g;
  const writeRegex = /```write:([^\n]*)\n([\s\S]*?)```/g;
  
  let hasActions = false;
  
  let match;
  while ((match = runRegex.exec(response)) !== null) {
    actions.push({ type: 'run', content: match[1].trim() });
    hasActions = true;
  }
  while ((match = readRegex.exec(response)) !== null) {
    actions.push({ type: 'read', content: match[1].trim() });
    hasActions = true;
  }
  while ((match = writeRegex.exec(response)) !== null) {
    actions.push({ type: 'write', file: match[1].trim(), content: match[2] });
    hasActions = true;
  }
  
  // Strip action blocks from text to get the explanation parts
  let text = response
    .replace(/```run\n[\s\S]*?```/g, '')
    .replace(/```read\n[\s\S]*?```/g, '')
    .replace(/```write:[^\n]*\n[\s\S]*?```/g, '')
    .trim();
  
  if (text) {
    actions.unshift({ type: 'text', content: text });
  }
  
  // If no actions found at all, return the full response as text
  if (actions.length === 0) {
    actions.push({ type: 'text', content: response });
  }
  
  return actions;
}

// ── Commands ──
async function quickAsk(provider: CeptraChatProvider) {
  if (!authToken) { vscode.window.showWarningMessage('Please sign in to Ceptra AI first'); return; }
  const input = await vscode.window.showInputBox({ prompt: 'Ask Ceptra AI...' });
  if (input) provider.sendMessage(input);
}

async function codeAction(action: string, provider: CeptraChatProvider) {
  if (!authToken) { vscode.window.showWarningMessage('Please sign in to Ceptra AI first'); return; }
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const code = editor.document.getText(editor.selection) || editor.document.getText();
  const lang = editor.document.languageId;
  const prompts: Record<string, string> = {
    explain: `Explain this ${lang} code:\n\`\`\`${lang}\n${code}\n\`\`\``,
    refactor: `Refactor this ${lang} code for readability and performance:\n\`\`\`${lang}\n${code}\n\`\`\``,
    test: `Write comprehensive tests for this ${lang} code:\n\`\`\`${lang}\n${code}\n\`\`\``,
    fix: `Fix bugs in this ${lang} code:\n\`\`\`${lang}\n${code}\n\`\`\``,
    docs: `Generate documentation for this ${lang} code:\n\`\`\`${lang}\n${code}\n\`\`\``,
  };
  provider.sendMessage(prompts[action] || prompts.explain);
}

async function quickTool(tool: string, provider: CeptraChatProvider) {
  if (!authToken) { vscode.window.showWarningMessage('Please sign in to Ceptra AI first'); return; }
  const prompts: Record<string, string> = { image: 'Generate an image: ', pptx: 'Create a presentation: ', xlsx: 'Create a spreadsheet: ' };
  const input = await vscode.window.showInputBox({ prompt: prompts[tool] });
  if (input) provider.sendMessage(`${prompts[tool]}${input}`);
}

async function runCurrentFile() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const code = editor.document.getText();
  const lang = editor.document.languageId;
  const terminal = vscode.window.createTerminal('Ceptra Run');
  terminal.show();
  const cmds: Record<string, string> = {
    python: `python3 -c "${code.replace(/"/g, '\\"')}"`,
    javascript: `node -e "${code.replace(/"/g, '\\"')}"`,
    typescript: `npx ts-node -e "${code.replace(/"/g, '\\"')}"`,
  };
  if (cmds[lang]) terminal.sendText(cmds[lang]);
  else vscode.window.showWarningMessage(`No runner for ${lang}`);
}

// ── Sidebar Chat Webview ──
class CeptraChatProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private context: vscode.ExtensionContext;
  private chatHistory: Array<{role: string, content: string}> = [];

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.chatHistory = context.globalState.get('ceptra.chatHistory') || [];
  }

  refresh() { if (this.view) this.view.webview.html = this.getHtml(); }

  private saveHistory() {
    // Keep last 50 messages
    if (this.chatHistory.length > 50) this.chatHistory = this.chatHistory.slice(-50);
    this.context.globalState.update('ceptra.chatHistory', this.chatHistory);
  }

  private addToHistory(role: string, content: string) {
    this.chatHistory.push({ role, content });
    this.saveHistory();
  }

  clearHistory() {
    this.chatHistory = [];
    this.saveHistory();
    if (this.view) this.view.webview.html = this.getHtml();
  }

  resolveWebviewView(view: vscode.WebviewView) {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this.getHtml();

    // Restore chat history after webview loads
    if (this.chatHistory.length > 0) {
      setTimeout(() => {
        view.webview.postMessage({ type: 'restoreHistory', messages: this.chatHistory });
      }, 500);
    }

    // Keep webview content when hidden
    view.onDidChangeVisibility(() => {
      if (view.visible && this.chatHistory.length > 0) {
        setTimeout(() => {
          view.webview.postMessage({ type: 'restoreHistory', messages: this.chatHistory });
        }, 300);
      }
    });

    view.webview.onDidReceiveMessage(async (data) => {
      // Login
      if (data.type === 'login') {
        const result = await signIn(data.email, data.password, this.context);
        if (result.success) {
          view.webview.html = this.getHtml();
        } else {
          view.webview.postMessage({ type: 'loginError', content: result.error });
        }
      }

      // Chat message
      if (data.type === 'send') {
        this.addToHistory('user', data.message);
        try {
          view.webview.postMessage({ type: 'thinking', content: 'Reading workspace...' });
          const wsContext = getWorkspaceContext();
          const history = this.chatHistory.slice(-10).map(m => ({ role: m.role, content: m.content.slice(0, 1000) }));

          let message = data.message;
          
          outputChannel.appendLine(`\n--- User: ${data.message} ---`);
          outputChannel.appendLine(`Is code review: ${isCodeReviewRequest(data.message)}`);

          // For code review requests, read all source files and include them
          if (isCodeReviewRequest(data.message)) {
            view.webview.postMessage({ type: 'status', content: 'Reading source files...' });
            const sourceCode = readProjectFiles();
            outputChannel.appendLine(`Source code length: ${sourceCode.length}`);
            if (sourceCode) {
              message = `The user asked: "${data.message}"\n\nHere is ALL the source code from the project. Analyze it thoroughly:\n\n${sourceCode}\n\nProvide a detailed analysis: what each class/component does, how they relate, patterns used, and any issues.`;
            }
          }

          // Check if user is asking about a specific file
          const fileMatch = data.message.match(/(?:explain|check|review|look at|open)\s+(\S+\.(?:cls|js|html|css|trigger|cmp))/i);
          if (fileMatch) {
            view.webview.postMessage({ type: 'status', content: `Reading ${fileMatch[1]}...` });
            // Try multiple paths
            let content = readFileContent(`force-app/main/default/classes/${fileMatch[1]}`);
            if (content.startsWith('[Error')) content = readFileContent(`force-app/main/default/lwc/${fileMatch[1]}`);
            if (content.startsWith('[Error')) content = readFileContent(fileMatch[1]);
            outputChannel.appendLine(`File match: ${fileMatch[1]}, content length: ${content.length}`);
            if (!content.startsWith('[Error')) {
              message = `The user asked: "${data.message}"\n\nHere is the complete file content:\n\n${content}\n\nExplain this code in detail - its purpose, how it works, key methods, and any issues.`;
            }
          }

          view.webview.postMessage({ type: 'status', content: 'Asking AI...' });
          outputChannel.appendLine(`Message length being sent: ${message.length}`);
          
          const response = await callCeptra(message, wsContext, history);
          outputChannel.appendLine(`Response length: ${response.length}`);
          outputChannel.appendLine(`Response preview: ${response.slice(0, 200)}`);
          
          const actions = parseActions(response);
          outputChannel.appendLine(`Actions found: ${actions.map(a => a.type).join(', ')}`);

          // Send text parts
          const textParts = actions.filter(a => a.type === 'text').map(a => a.content).join('\n\n');
          if (textParts) {
            this.addToHistory('assistant', textParts);
            view.webview.postMessage({ type: 'response', content: textParts });
          }

          // Handle actions
          for (const action of actions) {
            if (action.type === 'run') {
              view.webview.postMessage({ type: 'action', actionType: 'run', command: action.content });
            }
            if (action.type === 'read') {
              view.webview.postMessage({ type: 'status', content: `Reading ${action.content}...` });
              const content = readFileContent(action.content);
              const truncated = content.slice(0, 3000);
              this.addToHistory('assistant', `📄 ${action.content}:\n${truncated}`);
              view.webview.postMessage({
                type: 'response',
                content: `📄 **${action.content}:**\n\`\`\`\n${truncated}\n\`\`\``,
              });
            }
            if (action.type === 'write') {
              view.webview.postMessage({ type: 'action', actionType: 'write', file: action.file, content: action.content });
            }
          }

          // If only text (no special actions), ensure response is shown
          if (actions.length === 0) {
            this.addToHistory('assistant', response);
            view.webview.postMessage({ type: 'response', content: response });
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Error';
          view.webview.postMessage({ type: 'error', content: msg });
        }
      }

      // User approved a command
      if (data.type === 'approve_run') {
        this.addToHistory('assistant', `Running: ${data.command}`);
        view.webview.postMessage({ type: 'thinking', content: `Running: ${data.command}` });
        const result = await executeCommand(data.command);
        const output = (result.stdout + result.stderr).trim().slice(0, 5000);
        const cmdResult = `**Command:** \`${data.command}\`\n**Exit code:** ${result.exitCode}\n\`\`\`\n${output || '(no output)'}\n\`\`\``;
        this.addToHistory('assistant', cmdResult);
        view.webview.postMessage({ type: 'response', content: cmdResult });

        // Always analyze output and continue
        try {
          view.webview.postMessage({ type: 'thinking', content: 'Analyzing and planning next steps...' });
          const wsContext = getWorkspaceContext();

          const history = this.chatHistory.slice(-8).map(m => ({ role: m.role, content: m.content.slice(0, 500) }));

          const analysis = await callCeptra(
            `The command \`${data.command}\` just finished with exit code ${result.exitCode}.\nOutput:\n\`\`\`\n${output.slice(0, 3000)}\n\`\`\`\n\nProvide a clear analysis. If the task is complete, summarize. If more steps are needed, suggest next action.`,
            wsContext,
            history
          );
          const actions = parseActions(analysis);
          const textParts = actions.filter(a => a.type === 'text').map(a => a.content).join('\n\n');
          if (textParts) {
            this.addToHistory('assistant', textParts);
            view.webview.postMessage({ type: 'response', content: textParts });
          }
          for (const action of actions) {
            if (action.type === 'run') {
              view.webview.postMessage({ type: 'action', actionType: 'run', command: action.content });
            }
            if (action.type === 'read') {
              view.webview.postMessage({ type: 'thinking', content: `Reading ${action.content}...` });
              const content = readFileContent(action.content);
              const truncated = content.slice(0, 3000);
              this.addToHistory('assistant', `📄 ${action.content}:\n${truncated}`);
              view.webview.postMessage({
                type: 'response',
                content: `📄 **${action.content}:**\n\`\`\`\n${truncated}\n\`\`\``,
              });
            }
          }
        } catch (err: any) {
          // Silently handle analysis errors
        }
      }

      // User approved file write
      if (data.type === 'approve_write') {
        const result = writeFileContent(data.file, data.content);
        view.webview.postMessage({ type: 'response', content: `✅ ${result}` });
      }

      // Insert code
      if (data.type === 'insert') {
        const editor = vscode.window.activeTextEditor;
        if (editor) editor.edit(b => b.insert(editor.selection.active, data.code));
      }

      // Sign out
      if (data.type === 'signout') {
        await signOut(this.context, this);
      }

      // Clear chat history
      if (data.type === 'clearHistory') {
        this.clearHistory();
      }

      // Open URL
      if (data.type === 'openUrl') {
        vscode.env.openExternal(vscode.Uri.parse(data.url));
      }
    });
  }

  sendMessage(msg: string) {
    if (this.view) {
      this.view.show(true);
      this.view.webview.postMessage({ type: 'userMessage', content: msg });
    }
  }

  private getHtml(): string {
    if (!authToken) return this.getLoginHtml();
    return this.getChatHtml();
  }

  private getLoginHtml(): string {
    return `<!DOCTYPE html><html><head><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-sideBar-background);height:100vh;display:flex;align-items:center;justify-content:center}
      .login{width:100%;padding:20px;text-align:center}
      .logo{width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;color:#fff;margin-bottom:10px}
      h2{font-size:15px;margin-bottom:4px}
      .sub{font-size:11px;opacity:.6;margin-bottom:16px}
      input{width:100%;padding:8px 10px;margin-bottom:8px;border:1px solid var(--vscode-input-border);border-radius:6px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);font:inherit;font-size:12px;outline:none}
      .btn{width:100%;padding:9px;border:none;border-radius:6px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);cursor:pointer;font-size:12px;font-weight:600;margin-top:4px}
      .err{color:#f87171;font-size:11px;margin-top:8px;display:none}
      .link{color:var(--vscode-textLink-foreground);font-size:11px;margin-top:12px;cursor:pointer;text-decoration:underline}
    </style></head><body>
    <div class="login">
      <div class="logo">C</div>
      <h2>Ceptra AI</h2>
      <div class="sub">Sign in to your account</div>
      <input id="email" type="email" placeholder="Email address" />
      <input id="pass" type="password" placeholder="Password" onkeydown="if(event.key==='Enter')login()" />
      <button class="btn" onclick="login()">Sign In</button>
      <div class="err" id="err"></div>
      <div class="link" onclick="vscode.postMessage({type:'openUrl',url:'https://ceptra-ai.vercel.app/login'})">Don't have an account? Sign up</div>
    </div>
    <script>
      const vscode=acquireVsCodeApi();
      function login(){
        const e=document.getElementById('email').value.trim();
        const p=document.getElementById('pass').value;
        if(!e||!p){show('Enter email and password');return}
        document.querySelector('.btn').textContent='Signing in...';
        vscode.postMessage({type:'login',email:e,password:p});
      }
      function show(m){const el=document.getElementById('err');el.textContent=m;el.style.display='block'}
      window.addEventListener('message',e=>{
        if(e.data.type==='loginError'){show(e.data.content);document.querySelector('.btn').textContent='Sign In'}
      });
    </script></body></html>`;
  }

  private getChatHtml(): string {
    const email = userEmail || '';
    return `<!DOCTYPE html><html><head><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-sideBar-background);height:100vh;display:flex;flex-direction:column}
      .hdr{padding:8px 10px;border-bottom:1px solid var(--vscode-panel-border);display:flex;align-items:center;justify-content:space-between;font-size:11px}
      .hdr .user{display:flex;align-items:center;gap:6px;opacity:.7;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
      .hdr .out{background:none;border:none;color:var(--vscode-textLink-foreground);cursor:pointer;font-size:10px;font-family:inherit;flex-shrink:0}
      #msgs{flex:1;overflow-y:auto;padding:10px}
      .m{margin:8px 0;padding:8px 10px;border-radius:8px;font-size:12px;line-height:1.6;word-wrap:break-word}
      .m.u{background:var(--vscode-input-background)}
      .m.a{background:var(--vscode-editor-background);border:1px solid var(--vscode-panel-border)}
      .m pre{background:var(--vscode-textCodeBlock-background);padding:6px;border-radius:4px;overflow-x:auto;margin:4px 0;font-size:11px}
      .m code{background:var(--vscode-textCodeBlock-background);padding:1px 4px;border-radius:3px;font-size:11px}
      .lb{font-size:10px;opacity:.6;margin-bottom:3px;text-transform:uppercase;letter-spacing:.5px;font-weight:600}
      .action{margin:8px 0;padding:10px;border-radius:8px;border:1px solid var(--vscode-panel-border);background:var(--vscode-editor-background)}
      .action .cmd{font-family:var(--vscode-editor-font-family);font-size:11px;background:var(--vscode-textCodeBlock-background);padding:6px 8px;border-radius:4px;margin:6px 0;overflow-x:auto;white-space:pre}
      .action .btns{display:flex;gap:6px;margin-top:8px}
      .action .btns button{padding:5px 12px;border:none;border-radius:4px;font-size:11px;font-weight:500;cursor:pointer}
      .run-btn{background:#34d399;color:#000}
      .skip-btn{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}
      .write-btn{background:#6366f1;color:#fff}
      .ibtn{display:inline-block;margin-top:3px;padding:2px 6px;font-size:10px;background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);border:none;border-radius:3px;cursor:pointer}
      @keyframes dots{0%{content:''}33%{content:'.'}66%{content:'..'}100%{content:'...'}}
      @keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}
      .thinking{display:flex;align-items:center;gap:8px;font-size:12px;opacity:.7}
      .thinking .dot{display:flex;gap:3px}
      .thinking .dot span{width:5px;height:5px;border-radius:50%;background:var(--vscode-foreground);animation:pulse 1.2s infinite}
      .thinking .dot span:nth-child(2){animation-delay:.2s}
      .thinking .dot span:nth-child(3){animation-delay:.4s}
      .status-text{font-size:11px;opacity:.6;margin-top:2px}
      #inp{padding:6px;border-top:1px solid var(--vscode-panel-border);display:flex;gap:4px}
      #inp textarea{flex:1;padding:6px 8px;border:1px solid var(--vscode-input-border);border-radius:6px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);font:inherit;font-size:12px;resize:none;outline:none;min-height:32px;max-height:100px}
      #inp button{padding:6px 12px;border:none;border-radius:6px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);cursor:pointer;font-size:11px;font-weight:500}
    </style></head><body>
    <div class="hdr">
      <div class="user"><span style="width:18px;height:18px;border-radius:5px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:8px;font-weight:700">${(email[0] || 'U').toUpperCase()}</span>${email}</div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="out" onclick="clearChat()" title="New chat">🗑️</button>
        <button class="out" onclick="vscode.postMessage({type:'signout'})">Sign out</button>
      </div>
    </div>
    <div id="msgs"><div class="m a"><div class="lb">Ceptra AI</div>Hi! I can run commands, edit files, and help with your project. Try:<br>• <b>"authorize sfdx org"</b><br>• <b>"retrieve all metadata"</b><br>• <b>"fix the error in my code"</b><br>• <b>"deploy changes to org"</b><br>• Select code → right-click for AI actions</div></div>
    <div id="inp"><textarea id="ti" rows="1" placeholder="Ask anything... (e.g. authorize sfdx org)" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();send()}"></textarea><button onclick="send()">Send</button></div>
    <script>
      const vscode=acquireVsCodeApi();
      const msgs=document.getElementById('msgs');
      const ti=document.getElementById('ti');

      function send(){
        const t=ti.value.trim();if(!t)return;
        add('u',t);ti.value='';
        showThinking('Thinking...');
        vscode.postMessage({type:'send',message:t});
      }

      function showThinking(text){
        const l=document.getElementById('ld');if(l)l.remove();
        const d=document.createElement('div');
        d.className='m a';d.id='ld';
        d.innerHTML='<div class="lb">Ceptra AI</div><div class="thinking"><div class="dot"><span></span><span></span><span></span></div><span id="ld-text">'+text+'</span></div>';
        msgs.appendChild(d);
        msgs.scrollTop=msgs.scrollHeight;
      }

      function updateThinking(text){
        const el=document.getElementById('ld-text');
        if(el)el.textContent=text;
      }

      function add(r,c,ld){
        const d=document.createElement('div');
        d.className='m '+r+(ld?' loading':'');
        if(ld) d.id='ld';
        d.innerHTML='<div class="lb">'+(r==='u'?'You':'Ceptra AI')+'</div>'+fmt(c);
        msgs.appendChild(d);
        msgs.scrollTop=msgs.scrollHeight;
      }

      function addAction(type, data){
        const l=document.getElementById('ld');if(l)l.remove();
        const d=document.createElement('div');
        d.className='action';

        if(type==='run'){
          const id='cmd_'+Date.now();
          d.innerHTML='<div class="lb">⚡ Command to run</div><div class="cmd">'+esc(data.command)+'</div><div class="btns"><button class="run-btn" onclick="approve(\\''+id+'\\',\\''+esc(data.command)+'\\')">▶ Run</button><button class="skip-btn" onclick="this.closest(\\'.action\\').remove()">Skip</button></div>';
          d.id=id;
        }

        if(type==='write'){
          const id='wrt_'+Date.now();
          d.innerHTML='<div class="lb">📝 Write file: '+esc(data.file)+'</div><div class="cmd">'+esc(data.content.slice(0,500))+(data.content.length>500?'\\n...':'')+'</div><div class="btns"><button class="write-btn" onclick="approveWrite(\\''+id+'\\',\\''+esc(data.file)+'\\')">✅ Write</button><button class="skip-btn" onclick="this.closest(\\'.action\\').remove()">Skip</button></div>';
          d.id=id;
          d.dataset.content=data.content;
        }

        msgs.appendChild(d);
        msgs.scrollTop=msgs.scrollHeight;
      }

      function approve(id,cmd){
        const el=document.getElementById(id);
        if(el){el.querySelector('.btns').innerHTML='<span style="opacity:.5;font-size:11px">Running...</span>';}
        vscode.postMessage({type:'approve_run',command:cmd});
      }

      function approveWrite(id,file){
        const el=document.getElementById(id);
        const content=el?.dataset?.content||'';
        if(el){el.querySelector('.btns').innerHTML='<span style="opacity:.5;font-size:11px">Writing...</span>';}
        vscode.postMessage({type:'approve_write',file:file,content:content});
      }

      function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,"\\\\'")}

      function fmt(t){
        return t
          .replace(/\`\`\`(\\w*)?\\n?([\\s\\S]*?)\`\`\`/g,'<pre><code>$2</code></pre><button class="ibtn" onclick="ins(this)">Insert</button>')
          .replace(/\`([^\`]+)\`/g,'<code>$1</code>')
          .replace(/\\*\\*([^*]+)\\*\\*/g,'<strong>$1</strong>')
          .replace(/\\n/g,'<br>');
      }

      function ins(b){vscode.postMessage({type:'insert',code:b.previousElementSibling.textContent})}

      function clearChat(){
        msgs.innerHTML='<div class="m a"><div class="lb">Ceptra AI</div>Chat cleared. How can I help?</div>';
        vscode.postMessage({type:'clearHistory'});
      }

      window.addEventListener('message',e=>{
        const d=e.data;
        const l=document.getElementById('ld');

        if(d.type==='response'){if(l)l.remove();add('a',d.content);}
        if(d.type==='error'){if(l)l.remove();add('a','⚠️ '+d.content);}
        if(d.type==='thinking'){showThinking(d.content||'Thinking...');}
        if(d.type==='status'){updateThinking(d.content);}
        if(d.type==='action'){if(l)l.remove();addAction(d.actionType, d);}
        if(d.type==='userMessage'){ti.value=d.content;send();}
        if(d.type==='restoreHistory'){
          msgs.innerHTML='';
          d.messages.forEach(function(m){add(m.role==='user'?'u':'a',m.content);});
        }
      });
    </script></body></html>`;
  }
}
