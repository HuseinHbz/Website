export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum ContentStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum Locale {
  FA = 'FA',
  EN = 'EN',
}

export enum LeadSource {
  WEBSITE = 'WEBSITE',
  REFERRAL = 'REFERRAL',
  LINKEDIN = 'LINKEDIN',
  DIRECT = 'DIRECT',
  AI_ASSISTANT = 'AI_ASSISTANT',
  OTHER = 'OTHER',
}

export enum LeadStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  QUALIFIED = 'QUALIFIED',
  CONVERTED = 'CONVERTED',
  LOST = 'LOST',
}

export enum ConsultationKind {
  ASSESSMENT = 'ASSESSMENT',
  INTRO_CALL = 'INTRO_CALL',
}

export enum ConsultationStatus {
  PENDING = 'PENDING',
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum EngagementStage {
  PROSPECT = 'PROSPECT',
  PROPOSAL = 'PROPOSAL',
  NEGOTIATION = 'NEGOTIATION',
  CLOSED_WON = 'CLOSED_WON',
  CLOSED_LOST = 'CLOSED_LOST',
}

export enum SubscriberStatus {
  ACTIVE = 'ACTIVE',
  UNSUBSCRIBED = 'UNSUBSCRIBED',
  BOUNCED = 'BOUNCED',
}

export enum AssistantCategory {
  INFRASTRUCTURE = 'INFRASTRUCTURE',
  CLOUD = 'CLOUD',
  SECURITY = 'SECURITY',
  NETWORKING = 'NETWORKING',
  CONSULTING = 'CONSULTING',
  GENERAL = 'GENERAL',
}

export enum MessageRole {
  USER = 'USER',
  ASSISTANT = 'ASSISTANT',
}
