import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),

  // JWT
  ACCESS_TOKEN_SECRET: z.string().min(32),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().length(64), // 32 bytes hex
  ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL: z.coerce.number().int().positive().default(2592000),

  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // Optional Redis
  REDIS_URL: z.string().url().optional(),

  // Owner
  OWNER_EMAIL: z.string().email(),

  // Lead scoring
  SCORE_HOT: z.coerce.number().int().min(0).max(100).default(70),
  SCORE_QUALIFIED: z.coerce.number().int().min(0).max(100).default(45),
  SCORE_NURTURE_BELOW: z.coerce.number().int().min(0).max(100).default(20),

  // AI
  AI_PROVIDER: z.enum(['openai', 'anthropic', 'deepseek', 'ollama']).default('openai'),
  AI_MAX_TOKENS: z.coerce.number().int().positive().default(800),
  AI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.4),
  AI_RATE_PER_MIN: z.coerce.number().int().positive().default(10),
  AI_HISTORY_LIMIT: z.coerce.number().int().positive().default(12),
  AI_MAX_TURNS: z.coerce.number().int().positive().default(25),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  AI_RETENTION_DAYS: z.coerce.number().int().positive().default(180),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-3-5-sonnet-latest'),
  ANTHROPIC_VERSION: z.string().default('2023-06-01'),

  // DeepSeek
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_MODEL: z.string().default('deepseek-chat'),

  // Ollama
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('llama3.1'),

  // SMTP (optional — if not configured, email sending is skipped gracefully)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().email().optional(),
  MAIL_NOTIFY_TO: z.string().email().optional(),

  // R2 / Backup
  R2_BUCKET: z.string().optional(),
  R2_ENDPOINT: z.string().url().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  BACKUP_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.format();
    console.error('❌ Invalid environment variables:', JSON.stringify(formatted, null, 2));
    process.exit(1);
  }
  return result.data;
}

export const env = parseEnv();
export type Env = typeof env;
