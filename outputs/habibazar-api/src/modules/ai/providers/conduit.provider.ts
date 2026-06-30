import { env } from '../../../config/env';
import logger from '../../../lib/logger';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function* streamConduit(
  messages: ChatMessage[],
): AsyncGenerator<string> {
  if (!env.CONDUIT_API_KEY) {
    throw new Error('CONDUIT_API_KEY is not configured');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);

  try {
    const response = await fetch(`${env.CONDUIT_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.CONDUIT_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.CONDUIT_MODEL,
        messages,
        max_tokens: env.AI_MAX_TOKENS,
        temperature: env.AI_TEMPERATURE,
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Conduit API error ${response.status}: ${error}`);
    }

    if (!response.body) {
      throw new Error('No response body from Conduit');
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
          // Ignore parse errors for malformed chunks
        }
      }
    }
  } finally {
    clearTimeout(timeoutId);
    logger.debug({ model: env.CONDUIT_MODEL }, 'Conduit stream complete');
  }
}
