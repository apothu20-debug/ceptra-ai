import type { NextApiRequest, NextApiResponse } from 'next';
import { aiChat } from '@/lib/ai-provider';

export const config = { api: { bodyParser: true, responseLimit: false } };

type ToolType = 'chat'|'code'|'image'|'pptx'|'docx'|'pdf'|'xlsx'|'test'|'search';

function detectTool(msg: string): ToolType {
  const m = msg.toLowerCase();
  if (/\b(image|logo|picture|photo|draw|illustration|icon|generate.*art|create.*art|design.*logo)\b/.test(m)) return 'image';
  if (/\b(powerpoint|pptx|presentation|slide|deck|pitch)\b/.test(m)) return 'pptx';
  if (/\b(word doc|docx|document|report|letter|memo|contract|resume|essay)\b/.test(m)) return 'docx';
  if (/\b(excel|xlsx|spreadsheet|csv|budget|tracker)\b/.test(m)) return 'xlsx';
  if (/\b(pdf|fill.*form|w-?9|invoice|certificate)\b/.test(m)) return 'pdf';
  if (/\b(test|playwright|jest|e2e|unit test|spec)\b/.test(m)) return 'test';
  if (/\b(search|research|find|look up|latest|current|news)\b/.test(m)) return 'search';
  if (/\b(code|function|component|script|api|build|create.*app|react|python|javascript|html|css|typescript)\b/.test(m)) return 'code';
  return 'chat';
}

const PROMPTS: Record<ToolType, string> = {
  chat: 'You are Ceptra AI, a helpful assistant. Be concise.',
  code: 'You are Ceptra AI. Write clean, complete, runnable code with markdown code blocks.',
  image: 'You are Ceptra AI image generator. Respond with a JSON block: ```json\n{"prompt":"detailed SD prompt","negative_prompt":"blurry","width":1024,"height":1024}\n``` Then describe the image.',
  pptx: 'You are Ceptra AI. Create presentations as JSON: ```json\n{"title":"Title","slides":[{"title":"Slide","content":["bullet"],"notes":"notes"}]}\n```',
  docx: 'You are Ceptra AI. Create documents as JSON: ```json\n{"title":"Title","sections":[{"heading":"Section","content":"Text...","type":"paragraph"}]}\n```',
  xlsx: 'You are Ceptra AI. Create spreadsheets as JSON: ```json\n{"title":"Title","sheets":[{"name":"Sheet1","headers":["A","B"],"rows":[["v1","v2"]],"formulas":{"C2":"=A2+B2"}}]}\n```',
  pdf: 'You are Ceptra AI. Create PDFs as JSON: ```json\n{"title":"Title","content":"Full text..."}\n```',
  test: 'You are Ceptra AI. Write complete test files using Playwright or Jest.',
  search: 'You are Ceptra AI. Research thoroughly with key facts and data.',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, model, history = [], system } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  const tool = system ? 'chat' : detectTool(message);
  const systemPrompt = system || PROMPTS[tool];
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history.slice(-10).map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: message },
  ];

  try {
    const result = await aiChat(messages, model);

    let files: any[] = [];
    if (['pptx','docx','xlsx','pdf'].includes(tool)) {
      try { files = await generateFiles(tool, result.content, message); } catch {}
    }

    return res.json({
      content: result.content,
      tool,
      provider: result.provider,
      files,
      tokens: result.tokens,
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'AI unavailable' });
  }
}

async function generateFiles(tool: string, response: string, userMessage: string) {
  let parsed: any = null;
  try {
    const m = response.match(/```json\n([\s\S]*?)```/);
    if (m) parsed = JSON.parse(m[1]);
    else { const r = response.match(/\{[\s\S]*\}/); if (r) parsed = JSON.parse(r[0]); }
  } catch { return []; }
  if (!parsed) return [];

  const { generatePPTX, generateDOCX, generateXLSX, generatePDF } = await import('@/lib/generators');
  switch (tool) {
    case 'pptx': return parsed.slides ? [await generatePPTX(parsed)] : [];
    case 'docx': return parsed.sections ? [await generateDOCX(parsed)] :
      [await generateDOCX({ title: userMessage.slice(0,60), sections: [{ content: response, type: 'paragraph' as const }] })];
    case 'xlsx': return parsed.sheets ? [await generateXLSX(parsed)] : [];
    case 'pdf': return [await generatePDF({ title: parsed.title || userMessage.slice(0,60), content: parsed.content || response })];
  }
  return [];
}
