/**
 * Ceptra AI — Ollama Provider
 * 
 * Communicates with locally running Ollama instance.
 * Supports both streaming and non-streaming chat.
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ── Non-streaming chat ──
export async function ollamaChat(
  messages: ChatMessage[],
  model: string = 'qwen2.5:14b',
  options?: { temperature?: number; num_predict?: number; format?: string }
): Promise<{ content: string; tokens: { input: number; output: number } }> {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      format: options?.format,
      options: {
        temperature: options?.temperature ?? 0.7,
        num_predict: options?.num_predict ?? 4096,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return {
    content: data.message?.content || '',
    tokens: {
      input: data.prompt_eval_count || 0,
      output: data.eval_count || 0,
    },
  };
}

// ── Streaming chat (returns async generator) ──
export async function* ollamaChatStream(
  messages: ChatMessage[],
  model: string = 'qwen2.5:14b',
  systemPrompt?: string
): AsyncGenerator<string> {
  const allMessages: ChatMessage[] = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages;

  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: allMessages,
      stream: true,
      options: { num_predict: 4096 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama stream error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.message?.content) yield parsed.message.content;
        if (parsed.done) return;
      } catch { /* skip */ }
    }
  }
}

// ── List available models ──
export async function ollamaListModels(): Promise<string[]> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map((m: any) => m.name);
  } catch {
    return [];
  }
}

// ── Health check ──
export async function ollamaHealthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
