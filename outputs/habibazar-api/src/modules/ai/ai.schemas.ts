import { z } from 'zod';
import { AssistantCategory } from '../../lib/enums';

export const intakeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  company: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  locale: z.enum(['FA', 'EN']).default('FA'),
  sessionRef: z.string().min(1).max(255),
  category: z.nativeEnum(AssistantCategory).optional(),
});

export const chatMessageSchema = z.object({
  message: z.string().min(1).max(4000),
  locale: z.enum(['FA', 'EN']).default('FA'),
});

export const updateConversationSchema = z.object({
  name: z.string().max(255).optional(),
  company: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  category: z.nativeEnum(AssistantCategory).optional(),
});

export type IntakeInput = z.infer<typeof intakeSchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
