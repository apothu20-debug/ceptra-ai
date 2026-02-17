/**
 * Ceptra AI — Unified AI Provider
 * 
 * Routes to either local Ollama or cloud APIs based on config.
 * Local = free, private. Cloud = for mobile users / paying customers.
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponse {
  content: string;
  provider: 'ollama' | 'anthropic' | 'openrouter';
  tokens: { input: number; output: number };
}

// ── Main chat function — picks best available provider ──
export async function aiChat(
  messages: ChatMessage[],
  model?: string
): Promise<AIResponse> {
  const errors: string[] = [];

  // Try Ollama first — but ONLY if OLLAMA_URL is explicitly set
  // (skip on Vercel/cloud where there's no local Ollama)
  if (process.env.OLLAMA_URL) {
    const ollamaModel = model || process.env.DEFAULT_MODEL || 'qwen2.5:7b';
    try {
      const result = await ollamaChat(messages, ollamaModel);
      if (result) return { ...result, provider: 'ollama' };
    } catch (e: any) {
      errors.push(`Ollama: ${e.message}`);
    }
  }

  // Try OpenRouter
  if (process.env.OPENROUTER_API_KEY) {
    try {
      return await openrouterChat(messages);
    } catch (e: any) {
      errors.push(`OpenRouter: ${e.message}`);
    }
  }

  // Try Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await anthropicChat(messages);
    } catch (e: any) {
      errors.push(`Anthropic: ${e.message}`);
    }
  }

  const detail = errors.length > 0 ? ` Errors: ${errors.join('; ')}` : '';
  throw new Error(`No AI provider available.${detail}`);
}

// ── Ollama (Local) ──
async function ollamaChat(messages: ChatMessage[], model: string): Promise<AIResponse | null> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) return null;
  const data = await res.json();

  return {
    content: data.message?.content || '',
    provider: 'ollama',
    tokens: { input: data.prompt_eval_count || 0, output: data.eval_count || 0 },
  };
}

// ── Anthropic (Claude) ──
async function anthropicChat(messages: ChatMessage[]): Promise<AIResponse> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('No Anthropic key');

  // Separate system message
  const systemMsg = messages.find(m => m.role === 'system');
  const chatMsgs = messages.filter(m => m.role !== 'system');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemMsg?.content || 'You are Ceptra AI, a helpful assistant.',
      messages: chatMsgs.map(m => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res.ok) throw new Error(`Anthropic: ${res.status}`);
  const data = await res.json();

  return {
    content: data.content?.[0]?.text || '',
    provider: 'anthropic',
    tokens: { input: data.usage?.input_tokens || 0, output: data.usage?.output_tokens || 0 },
  };
}

// ── OpenRouter (Multiple models) ──
async function openrouterChat(messages: ChatMessage[]): Promise<AIResponse> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('No OpenRouter key');

  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet'; // Smart like Claude ($3/M tokens)

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://ceptra.ai',
      'X-Title': 'Ceptra AI',
    },
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenRouter ${res.status}: ${errText}`);
  }
  const data = await res.json();

  return {
    content: data.choices?.[0]?.message?.content || '',
    provider: 'openrouter',
    tokens: { input: data.usage?.prompt_tokens || 0, output: data.usage?.completion_tokens || 0 },
  };
}

// ── Health check ──
export async function checkProviders(): Promise<{ ollama: boolean; anthropic: boolean; openrouter: boolean; models: string[] }> {
  let ollama = false;
  let models: string[] = [];

  // Only check Ollama if explicitly configured
  if (process.env.OLLAMA_URL) {
    try {
      const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2000) });
      if (r.ok) {
        ollama = true;
        const d = await r.json();
        models = (d.models || []).map((m: any) => m.name);
      }
    } catch {}
  }

  return {
    ollama,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    openrouter: !!process.env.OPENROUTER_API_KEY,
    models,
  };
}
