/**
 * Ceptra AI — Tool Engine
 * 
 * This is the core routing layer. When a user sends a message, the LLM
 * analyzes intent and decides which tool(s) to invoke. Each tool generates
 * real files (docx, pptx, xlsx, pdf, images, code) on the server.
 *
 * Architecture:
 *   User message → LLM analyzes intent → Tool executor → File output
 */

export type ToolType = 'chat' | 'code' | 'image' | 'pptx' | 'docx' | 'pdf' | 'xlsx' | 'test' | 'search';

export interface ToolResult {
  type: ToolType;
  content: string;          // AI text response
  files?: GeneratedFile[];  // Any files created
  code?: CodeResult;        // Code execution result
  images?: ImageResult[];   // Generated images
}

export interface GeneratedFile {
  name: string;
  path: string;
  size: number;
  mimeType: string;
  downloadUrl: string;
}

export interface CodeResult {
  language: string;
  code: string;
  output: string;
  exitCode: number;
  duration: number;
}

export interface ImageResult {
  url: string;
  prompt: string;
  width: number;
  height: number;
}

// ── Intent Detection ──
// The LLM determines which tool to use based on the user's message.
// We give the LLM a system prompt that tells it to output a JSON action plan.

export const TOOL_DETECTION_PROMPT = `You are Ceptra AI's task router. Analyze the user's request and determine which tool(s) to use.

Available tools:
- chat: General conversation, Q&A, explanations
- code: Write, run, or debug code (any language)
- image: Generate images, logos, art, diagrams
- pptx: Create PowerPoint presentations
- docx: Create Word documents, reports, letters
- pdf: Create or fill PDF forms
- xlsx: Create Excel spreadsheets with formulas/charts
- test: Write and run automated tests (Playwright, Jest)
- search: Web search and research

Respond with JSON only:
{
  "primary_tool": "tool_name",
  "secondary_tools": [],
  "reasoning": "brief explanation",
  "file_output": true/false,
  "file_name": "suggested_filename.ext"
}

Examples:
- "Build a login form" → {"primary_tool": "code", "file_output": true, "file_name": "LoginForm.tsx"}
- "Create a pitch deck" → {"primary_tool": "pptx", "file_output": true, "file_name": "pitch_deck.pptx"}
- "What is recursion?" → {"primary_tool": "chat", "file_output": false}
- "Generate a logo" → {"primary_tool": "image", "file_output": true, "file_name": "logo.png"}
- "Write tests for my API" → {"primary_tool": "test", "secondary_tools": ["code"], "file_output": true}
`;

export interface ToolPlan {
  primary_tool: ToolType;
  secondary_tools: ToolType[];
  reasoning: string;
  file_output: boolean;
  file_name?: string;
}

// ── Detect Intent via LLM ──
export async function detectIntent(
  message: string,
  ollamaUrl: string,
  model: string
): Promise<ToolPlan> {
  // Use fast keyword matching — instant, no LLM call needed
  // This keeps response times fast. LLM detection can be added later for ambiguous cases.
  return detectIntentFallback(message);
}

// ── Fallback Intent Detection (No LLM needed) ──
function detectIntentFallback(message: string): ToolPlan {
  const msg = message.toLowerCase();

  if (/\b(powerpoint|pptx|presentation|slide|deck|pitch)\b/.test(msg)) {
    return { primary_tool: 'pptx', secondary_tools: [], reasoning: 'keyword: presentation', file_output: true, file_name: 'presentation.pptx' };
  }
  if (/\b(word doc|docx|document|report|letter|memo|contract|resume)\b/.test(msg)) {
    return { primary_tool: 'docx', secondary_tools: [], reasoning: 'keyword: document', file_output: true, file_name: 'document.docx' };
  }
  if (/\b(excel|xlsx|spreadsheet|csv|budget|tracker)\b/.test(msg)) {
    return { primary_tool: 'xlsx', secondary_tools: [], reasoning: 'keyword: spreadsheet', file_output: true, file_name: 'spreadsheet.xlsx' };
  }
  if (/\b(pdf|fill.*form|w-?9|invoice|certificate)\b/.test(msg)) {
    return { primary_tool: 'pdf', secondary_tools: [], reasoning: 'keyword: pdf', file_output: true, file_name: 'document.pdf' };
  }
  if (/\b(image|logo|art|draw|generate.*pic|illustration|diagram|icon)\b/.test(msg)) {
    return { primary_tool: 'image', secondary_tools: [], reasoning: 'keyword: image', file_output: true, file_name: 'image.png' };
  }
  if (/\b(test|playwright|jest|e2e|unit test|spec|assert)\b/.test(msg)) {
    return { primary_tool: 'test', secondary_tools: ['code'], reasoning: 'keyword: testing', file_output: true, file_name: 'test.spec.ts' };
  }
  if (/\b(search|research|find|look up|latest|current|news)\b/.test(msg)) {
    return { primary_tool: 'search', secondary_tools: [], reasoning: 'keyword: search', file_output: false };
  }
  if (/\b(code|function|component|script|api|build|create.*app|react|python|javascript|html|css)\b/.test(msg)) {
    return { primary_tool: 'code', secondary_tools: [], reasoning: 'keyword: code', file_output: true, file_name: 'output.tsx' };
  }

  return { primary_tool: 'chat', secondary_tools: [], reasoning: 'default: conversation', file_output: false };
}

// ── Tool-Specific System Prompts ──
export const TOOL_PROMPTS: Record<ToolType, string> = {
  chat: `You are Ceptra AI, a helpful assistant. Respond naturally and helpfully.`,

  code: `You are Ceptra AI's Code Engine. You write clean, production-ready code.
Rules:
- Always include the programming language in code blocks
- Write complete, runnable files (not snippets)
- Include comments explaining key logic
- Handle errors properly
- Use modern best practices (TypeScript, hooks, etc.)
After the code, briefly explain what it does.`,

  image: `You are Ceptra AI's Image Engine. When asked to generate images:
1. Create a detailed Stable Diffusion prompt
2. Specify dimensions, style, and quality settings
3. Output the prompt in this JSON format:
{"prompt": "detailed description", "negative_prompt": "what to avoid", "width": 1024, "height": 1024, "steps": 30}`,

  pptx: `You are Ceptra AI's Presentation Engine. Create professional slide decks.
Output your slides in this JSON format:
{"title": "Deck Title", "slides": [{"title": "Slide Title", "content": ["bullet 1", "bullet 2"], "notes": "speaker notes", "layout": "title|content|two_column|image"}]}
Make content compelling, concise, and visually organized. Use 5-7 words per bullet. Include speaker notes.`,

  docx: `You are Ceptra AI's Document Engine. Create professional documents.
Output in this JSON format:
{"title": "Doc Title", "sections": [{"heading": "Section Title", "content": "Full paragraph text...", "type": "heading|paragraph|list|table"}]}
Write formal, clear, professional prose. Include proper structure with headings.`,

  pdf: `You are Ceptra AI's PDF Engine. You can create new PDFs or fill existing PDF forms.
For form filling, output field mappings as JSON:
{"fields": {"field_name": "value", ...}}
For new PDFs, output content structure similar to the document engine.`,

  xlsx: `You are Ceptra AI's Spreadsheet Engine. Create Excel files with formulas and formatting.
Output in JSON format:
{"title": "Sheet Title", "sheets": [{"name": "Sheet1", "headers": ["Col A", "Col B"], "rows": [["val1", "val2"]], "formulas": {"C2": "=SUM(A2:B2)"}, "chart": {"type": "bar", "data_range": "A1:C10"}}]}
Include real formulas, conditional formatting rules, and chart specifications.`,

  test: `You are Ceptra AI's Test Engine. Write comprehensive automated tests.
- Use Playwright for E2E tests
- Use Jest for unit tests
- Include descriptive test names
- Test happy path AND edge cases
- Use data-testid selectors for UI tests
Write the complete test file, ready to run.`,

  search: `You are Ceptra AI's Research Engine. When asked to research a topic:
1. Identify key questions to answer
2. Structure findings with clear sections
3. Include data points, statistics, and sources
4. Provide actionable insights
5. Note any information that may be outdated
Present research in a well-organized format.`,
};
