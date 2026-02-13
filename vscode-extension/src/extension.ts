import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const chatProvider = new CeptraChatProvider(context.extensionUri);
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
  );
}

export function deactivate() {}

// ── API Client ──
async function callCeptra(message: string, stream = false): Promise<string> {
  const config = vscode.workspace.getConfiguration('ceptra');
  const url = config.get<string>('serverUrl') || 'http://localhost:3000';

  const res = await fetch(`${url}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, stream: false }),
  });

  if (!res.ok) throw new Error(`Ceptra error: ${res.status}`);
  const data = await res.json();
  return data.content;
}

async function runCode(code: string, language: string): Promise<any> {
  const config = vscode.workspace.getConfiguration('ceptra');
  const url = config.get<string>('serverUrl') || 'http://localhost:3000';

  const res = await fetch(`${url}/api/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, language }),
  });

  return res.json();
}

// ── Commands ──
async function quickAsk(provider: CeptraChatProvider) {
  const input = await vscode.window.showInputBox({ prompt: 'Ask Ceptra AI...' });
  if (input) provider.sendMessage(input);
}

async function codeAction(action: string, provider: CeptraChatProvider) {
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
  const prompts: Record<string, string> = {
    image: 'Generate an image: ',
    pptx: 'Create a presentation: ',
    xlsx: 'Create a spreadsheet: ',
  };
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

  try {
    const result = await runCode(code, lang);
    if (result.code) {
      terminal.sendText(`echo "Exit code: ${result.code.exitCode}"`);
      if (result.code.output) terminal.sendText(`echo "${result.code.output.replace(/"/g, '\\"')}"`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Run failed';
    vscode.window.showErrorMessage(`Ceptra: ${msg}`);
  }
}

// ── Sidebar Chat Webview ──
class CeptraChatProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  constructor(private uri: vscode.Uri) {}

  resolveWebviewView(view: vscode.WebviewView) {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this.getHtml();

    view.webview.onDidReceiveMessage(async (data) => {
      if (data.type === 'send') {
        try {
          const response = await callCeptra(data.message);
          view.webview.postMessage({ type: 'response', content: response });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Error';
          view.webview.postMessage({ type: 'error', content: msg });
        }
      }
      if (data.type === 'insert') {
        const editor = vscode.window.activeTextEditor;
        if (editor) editor.edit(b => b.insert(editor.selection.active, data.code));
      }
      if (data.type === 'run') {
        runCurrentFile();
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
    return `<!DOCTYPE html><html><head><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-sideBar-background);height:100vh;display:flex;flex-direction:column}
      #msgs{flex:1;overflow-y:auto;padding:10px}
      .m{margin:8px 0;padding:8px 10px;border-radius:8px;font-size:12px;line-height:1.6;word-wrap:break-word}
      .m.u{background:var(--vscode-input-background)}
      .m.a{background:var(--vscode-editor-background);border:1px solid var(--vscode-panel-border)}
      .m pre{background:var(--vscode-textCodeBlock-background);padding:6px;border-radius:4px;overflow-x:auto;margin:4px 0;font-size:11px}
      .lb{font-size:10px;opacity:.6;margin-bottom:3px;text-transform:uppercase;letter-spacing:.5px;font-weight:600}
      #inp{padding:6px;border-top:1px solid var(--vscode-panel-border);display:flex;gap:4px}
      #inp textarea{flex:1;padding:6px 8px;border:1px solid var(--vscode-input-border);border-radius:6px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);font:inherit;font-size:12px;resize:none;outline:none;min-height:32px;max-height:100px}
      #inp button{padding:6px 12px;border:none;border-radius:6px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);cursor:pointer;font-size:11px;font-weight:500}
      .ibtn{display:inline-block;margin-top:3px;padding:2px 6px;font-size:10px;background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);border:none;border-radius:3px;cursor:pointer}
    </style></head><body>
    <div id="msgs"><div class="m a"><div class="lb">Ceptra AI</div>Hi! I can write code, generate tests, create docs, images, presentations & more. Try Cmd+Shift+A or right-click on code.</div></div>
    <div id="inp"><textarea id="ti" rows="1" placeholder="Ask anything..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();send()}"></textarea><button onclick="send()">Send</button></div>
    <script>
      const vscode=acquireVsCodeApi();const msgs=document.getElementById('msgs');const ti=document.getElementById('ti');
      function send(){const t=ti.value.trim();if(!t)return;add('u',t);ti.value='';add('a','Thinking...',true);vscode.postMessage({type:'send',message:t})}
      function add(r,c,ld){const d=document.createElement('div');d.className='m '+r+(ld?' loading':'');d.id=ld?'ld':'';d.innerHTML='<div class="lb">'+(r==='u'?'You':'Ceptra AI')+'</div>'+fmt(c);msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight}
      function fmt(t){return t.replace(/\`\`\`(\\w+)?\\n([\\s\\S]*?)\`\`\`/g,'<pre><code>$2</code></pre><button class="ibtn" onclick="ins(this)">Insert</button>').replace(/\`([^\`]+)\`/g,'<code>$1</code>').replace(/\\*\\*([^*]+)\\*\\*/g,'<strong>$1</strong>').replace(/\\n/g,'<br>')}
      function ins(b){vscode.postMessage({type:'insert',code:b.previousElementSibling.textContent})}
      window.addEventListener('message',e=>{const d=e.data;const l=document.getElementById('ld');if(l)l.remove();if(d.type==='response')add('a',d.content);if(d.type==='error')add('a','⚠️ '+d.content);if(d.type==='userMessage'){ti.value=d.content;send()}});
    </script></body></html>`;
  }
}
