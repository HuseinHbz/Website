import { env } from '../../../config/env';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function* streamOllama(
  messages: ChatMessage[],
): AsyncGenerator<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);

  try {
    const response = await fetch(`${env.OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.OLLAMA_MODEL,
        messages,
        stream: true,
        options: {
          num_predict: env.AI_MAX_TOKENS,
          temperature: env.AI_TEMPERATURE,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error ${response.status}: ${error}`);
    }

    if (!response.body) {
      throw new Error('No response body from Ollama');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const parsed = JSON.parse(trimmed) as {
            message?: { content?: string };
            done?: boolean;
          };

          if (parsed.message?.content) {
            yield parsed.message.content;
          }

          if (parsed.done) return;
        } catch {
          // Ignore parse errors
        }
      }
    }
  } finally {
    clearTimeout(timeoutId);
  }
}
