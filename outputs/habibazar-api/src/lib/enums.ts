// Re-export enum const objects from @prisma/client so all modules use the same
// types as the generated Prisma client — no divergence between local definitions
// and what the schema actually contains.
export {
  UserStatus,
  ContentStatus,
  Locale,
  LeadSource,
  LeadStatus,
  ConsultationKind,
  ConsultationStatus,
  EngagementStage,
  SubscriberStatus,
  AssistantCategory,
  MessageRole,
} from '@prisma/client';
