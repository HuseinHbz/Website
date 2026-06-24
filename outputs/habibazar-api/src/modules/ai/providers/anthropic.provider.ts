import { env } from '../../../config/env';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function* streamAnthropic(
  systemPrompt: string,
  messages: ChatMessage[],
): AsyncGenerator<string> {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': env.ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: env.ANTHROPIC_MODEL,
        max_tokens: env.AI_MAX_TOKENS,
        system: systemPrompt,
        messages: messages.filter((m) => m.role !== 'system' as string),
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${error}`);
    }

    if (!response.body) {
      throw new Error('No response body from Anthropic');
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

        try {
          const parsed = JSON.parse(data) as {
            type?: string;
            delta?: { type?: string; text?: string };
          };

          if (
            parsed.type === 'content_block_delta' &&
            parsed.delta?.type === 'text_delta' &&
            parsed.delta.text
          ) {
            yield parsed.delta.text;
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
