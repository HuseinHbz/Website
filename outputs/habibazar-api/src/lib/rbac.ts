export const PERMISSIONS = {
  // Leads
  'lead:read': 'lead:read',
  'lead:write': 'lead:write',
  'lead:delete': 'lead:delete',
  // Consultations
  'consultation:read': 'consultation:read',
  'consultation:write': 'consultation:write',
  // Engagements
  'engagement:read': 'engagement:read',
  'engagement:write': 'engagement:write',
  // Content
  'content:read': 'content:read',
  'content:write': 'content:write',
  'content:delete': 'content:delete',
  // Testimonials (integrity lock - owner only)
  'testimonial:approve': 'testimonial:approve',
  // Certifications (integrity lock - owner only)
  'cert:verify': 'cert:verify',
  // Consent (integrity lock - owner only)
  'consent:write': 'consent:write',
  // Users
  'user:read': 'user:read',
  'user:write': 'user:write',
  // Roles
  'role:read': 'role:read',
  'role:write': 'role:write',
  // Settings
  'settings:read': 'settings:read',
  'settings:write': 'settings:write',
  // Audit
  'audit:read': 'audit:read',
  // AI
  'ai:read': 'ai:read',
  'ai:write': 'ai:write',
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];
