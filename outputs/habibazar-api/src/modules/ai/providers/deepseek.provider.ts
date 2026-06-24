import { env } from '../../../config/env';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// DeepSeek uses OpenAI-compatible API
export async function* streamDeepSeek(
  messages: ChatMessage[],
): AsyncGenerator<string> {
  if (!env.DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY is not configured');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.DEEPSEEK_MODEL,
        messages,
        max_tokens: env.AI_MAX_TOKENS,
        temperature: env.AI_TEMPERATURE,
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API error ${response.status}: ${error}`);
    }

    if (!response.body) {
      throw new Error('No response body from DeepSeek');
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
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  } finally {
    clearTimeout(timeoutId);
  }
}
