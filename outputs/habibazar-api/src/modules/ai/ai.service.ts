import { MessageRole } from '../../lib/enums';
import { createHash } from 'crypto';
import prisma from '../../db/prisma';
import { env } from '../../config/env';
import { AppError } from '../../lib/errors';
import { getSystemPrompt } from './ai.prompts';
import { streamOpenAI } from './providers/openai.provider';
import { streamAnthropic } from './providers/anthropic.provider';
import { streamDeepSeek } from './providers/deepseek.provider';
import { streamOllama } from './providers/ollama.provider';
import { IntakeInput } from './ai.schemas';
import logger from '../../lib/logger';
import { LeadSource } from '../../lib/enums';

function hashSessionRef(sessionRef: string): string {
  return createHash('sha256').update(sessionRef).digest('hex');
}

export async function startConversation(intake: IntakeInput) {
  const sessionRefHash = hashSessionRef(intake.sessionRef);

  // Check for existing conversation with same session ref
  const existing = await prisma.conversation.findFirst({
    where: { sessionRefHash },
  });

  if (existing) {
    return existing;
  }

  // Create a lead if we have phone (indicates meaningful engagement)
  if (intake.name && intake.phone) {
    const existingLead = intake.phone
      ? await prisma.lead.findFirst({ where: { phone: intake.phone, deletedAt: null } })
      : null;

    if (!existingLead) {
      await prisma.lead.create({
        data: {
          name: intake.name ?? 'AI Visitor',
          phone: intake.phone ?? null,
          company: intake.company ?? null,
          source: LeadSource.AI_ASSISTANT,
          score: intake.company ? 15 : 5, // Base score for AI leads
          marketingConsent: false,
          metadata: { aiSessionRef: sessionRefHash.slice(0, 8) },
        },
      }).catch((err: unknown) => logger.error({ err }, 'Failed to create lead from AI intake'));
    }
  }

  const conversation = await prisma.conversation.create({
    data: {
      sessionRefHash,
      name: intake.name ?? null,
      company: intake.company ?? null,
      phone: intake.phone ?? null,
      category: intake.category ?? null,
      locale: intake.locale,
    },
  });

  return conversation;
}

interface ChatHistoryMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function* chat(
  conversationId: string,
  message: string,
  locale: 'FA' | 'EN',
): AsyncGenerator<string> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId },
  });

  if (!conversation) {
    throw new AppError('Conversation not found', 404, 'NOT_FOUND');
  }

  if (conversation.turnCount >= env.AI_MAX_TURNS) {
    throw new AppError(
      `Maximum conversation turns (${env.AI_MAX_TURNS}) reached. Please start a new conversation.`,
      429,
      'TURN_LIMIT_EXCEEDED',
    );
  }

  // Save user message
  await prisma.message.create({
    data: {
      conversationId,
      role: MessageRole.USER,
      content: message,
    },
  });

  // Build message history
  const history = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    take: env.AI_HISTORY_LIMIT,
  });

  const systemPrompt = getSystemPrompt(locale);
  const chatMessages: ChatHistoryMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.map((m: { role: string; content: string }) => ({
      role: m.role === MessageRole.USER ? 'user' as const : 'assistant' as const,
      content: m.content,
    })),
  ];

  // Stream from selected provider
  let fullResponse = '';
  const provider = env.AI_PROVIDER;

  let stream: AsyncGenerator<string>;

  if (provider === 'anthropic') {
    stream = streamAnthropic(
      systemPrompt,
      chatMessages.filter(m => m.role !== 'system') as Array<{ role: 'user' | 'assistant'; content: string }>,
    );
  } else if (provider === 'deepseek') {
    stream = streamDeepSeek(chatMessages);
  } else if (provider === 'ollama') {
    stream = streamOllama(chatMessages);
  } else {
    stream = streamOpenAI(chatMessages);
  }

  for await (const chunk of stream) {
    fullResponse += chunk;
    yield chunk;
  }

  // Save assistant response and increment turn count
  await Promise.all([
    prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.ASSISTANT,
        content: fullResponse,
      },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { turnCount: { increment: 1 } },
    }),
  ]);

  // Auto-extract lead information from conversation
  await extractAndUpdateLeadInfo(conversationId, conversation, history, fullResponse);
}

async function extractAndUpdateLeadInfo(
  conversationId: string,
  conversation: { id: string; name: string | null; phone: string | null; company: string | null },
  _history: Array<{ role: MessageRole; content: string }>,
  _latestResponse: string,
): Promise<void> {
  // If we now have name + phone from conversation, ensure a lead exists
  if (conversation.name && conversation.phone) {
    try {
      const existingLead = await prisma.lead.findFirst({
        where: { phone: conversation.phone, deletedAt: null },
      });

      if (!existingLead) {
        await prisma.lead.create({
          data: {
            name: conversation.name,
            phone: conversation.phone,
            company: conversation.company ?? null,
            source: LeadSource.AI_ASSISTANT,
            score: conversation.company ? 15 : 5,
            marketingConsent: false,
          },
        });
        logger.info({ conversationId }, 'Lead created from AI conversation');
      }
    } catch (err) {
      logger.error({ err, conversationId }, 'Failed to extract lead from conversation');
    }
  }
}

export async function updateConversationProfile(
  conversationId: string,
  profile: { name?: string; company?: string; phone?: string; category?: string },
): Promise<void> {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      ...(profile.name && { name: profile.name }),
      ...(profile.company && { company: profile.company }),
      ...(profile.phone && { phone: profile.phone }),
      ...(profile.category && { category: profile.category as Parameters<typeof prisma.conversation.update>[0]['data']['category'] }),
    },
  });
}
