export interface User {
  id: string
  email: string
  name: string
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  role: Role
  twoFactorEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface Role {
  id: string
  name: string
  permissions: string[]
}

export interface Lead {
  id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  source: string
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'LOST'
  score: number
  notes: string | null
  marketingConsent: boolean
  createdAt: string
  updatedAt: string
}

export interface LeadEvent {
  id: string
  leadId: string
  type: string
  data: Record<string, unknown>
  createdAt: string
}

export interface ConsultationRequest {
  id: string
  name: string
  email: string
  phone: string | null
  kind: 'ASSESSMENT' | 'INTRO_CALL'
  message: string | null
  preferredDate: string | null
  status: 'PENDING' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'
  notes: string | null
  createdAt: string
}

export interface Engagement {
  id: string
  leadId: string
  stage: 'PROSPECT' | 'PROPOSAL' | 'NEGOTIATION' | 'CLOSED_WON' | 'CLOSED_LOST'
  notes: string | null
  value: string | null
  closedAt: string | null
  createdAt: string
}

export interface DashboardStats {
  leads: { total: number; byStatus: Record<string, number> }
  consultations: { total: number; byStatus: Record<string, number> }
  engagements: { pipelineValue: number }
  recentLeads: Lead[]
  recentConsultations: ConsultationRequest[]
  aiConversationsThisMonth: number
}

export interface Pagination {
  total: number
  page: number
  limit: number
  pages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: Pagination
}

export interface AuditLog {
  id: string
  userId: string | null
  action: string
  resource: string
  resourceId: string | null
  metadata: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
}

export interface Post {
  id: string
  slug: string
  titleFa: string
  titleEn: string
  summaryFa: string
  summaryEn: string
  bodyFa: string
  bodyEn: string
  coverImage: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Service {
  id: string
  slug: string
  titleFa: string
  titleEn: string
  descriptionFa: string
  descriptionEn: string
  icon: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  sortOrder: number
  createdAt: string
}

export interface Conversation {
  id: string
  name: string | null
  company: string | null
  phone: string | null
  category: string | null
  locale: string
  turnCount: number
  createdAt: string
  messages?: Message[]
}

export interface Message {
  id: string
  role: 'USER' | 'ASSISTANT'
  content: string
  createdAt: string
}

export interface Setting {
  id: string
  key: string
  value: string
  updatedAt: string
}

export interface CaseStudy {
  id: string
  slug: string
  titleFa: string
  titleEn: string
  summaryFa: string
  summaryEn: string
  bodyFa: string
  bodyEn: string
  coverImage: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  publishedAt: string | null
  createdAt: string
}

export interface Testimonial {
  id: string
  authorName: string
  authorTitle: string | null
  company: string | null
  contentFa: string
  contentEn: string
  rating: number | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
}

export interface Certification {
  id: string
  titleFa: string
  titleEn: string
  issuingBody: string
  issueDate: string | null
  expiryDate: string | null
  certificateUrl: string | null
  status: 'PENDING' | 'VERIFIED' | 'EXPIRED'
  createdAt: string
}

export const ALL_PERMISSIONS = [
  'lead:read',
  'lead:write',
  'lead:delete',
  'consultation:read',
  'consultation:write',
  'engagement:read',
  'engagement:write',
  'content:read',
  'content:write',
  'content:delete',
  'user:read',
  'user:write',
  'user:delete',
  'role:read',
  'role:write',
  'settings:read',
  'settings:write',
  'audit:read',
  'ai:read',
  'testimonial:approve',
  'cert:verify',
  'consent:write',
] as const

export type Permission = (typeof ALL_PERMISSIONS)[number]
