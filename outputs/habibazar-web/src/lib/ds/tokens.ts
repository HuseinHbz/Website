/**
 * HBZ Enterprise Design System — Design Tokens
 * Single source of truth for all visual values.
 * CSS custom properties are defined in globals.css.
 * Tailwind config references these via var(--token-*).
 */

// ── Color Primitives ─────────────────────────────────────────────────────────
export const colorPrimitives = {
  // Indigo scale (primary brand)
  indigo: {
    50:  '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
    950: '#1e1b4b',
  },
  // Cyan scale (secondary brand)
  cyan: {
    50:  '#ecfeff',
    100: '#cffafe',
    200: '#a5f3fc',
    300: '#67e8f9',
    400: '#22d3ee',
    500: '#06b6d4',
    600: '#0891b2',
    700: '#0e7490',
    800: '#155e75',
    900: '#164e63',
  },
  // Emerald (success)
  emerald: {
    400: '#34d399',
    500: '#10b981',
    600: '#059669',
  },
  // Amber (warning)
  amber: {
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
  },
  // Red (danger)
  red: {
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
  },
  // Slate (neutrals)
  slate: {
    50:  '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
  },
} as const

// ── Semantic Color Tokens ─────────────────────────────────────────────────────
// These map to CSS custom properties: var(--color-*)
export const semanticColors = {
  // Background layers
  bg: {
    base:     'var(--color-bg-base)',
    surface:  'var(--color-bg-surface)',
    elevated: 'var(--color-bg-elevated)',
    overlay:  'var(--color-bg-overlay)',
    glass:    'var(--color-bg-glass)',
    sunken:   'var(--color-bg-sunken)',
  },
  // Text
  text: {
    primary:   'var(--color-text-primary)',
    secondary: 'var(--color-text-secondary)',
    tertiary:  'var(--color-text-tertiary)',
    disabled:  'var(--color-text-disabled)',
    inverse:   'var(--color-text-inverse)',
    link:      'var(--color-text-link)',
  },
  // Border
  border: {
    default: 'var(--color-border-default)',
    subtle:  'var(--color-border-subtle)',
    strong:  'var(--color-border-strong)',
    focus:   'var(--color-border-focus)',
  },
  // Brand
  brand: {
    DEFAULT: 'var(--color-brand)',
    hover:   'var(--color-brand-hover)',
    active:  'var(--color-brand-active)',
    muted:   'var(--color-brand-muted)',
    subtle:  'var(--color-brand-subtle)',
  },
  // Accent (secondary brand — cyan)
  accent: {
    DEFAULT: 'var(--color-accent)',
    hover:   'var(--color-accent-hover)',
    muted:   'var(--color-accent-muted)',
  },
  // Semantic states
  success: {
    DEFAULT: 'var(--color-success)',
    muted:   'var(--color-success-muted)',
    text:    'var(--color-success-text)',
  },
  warning: {
    DEFAULT: 'var(--color-warning)',
    muted:   'var(--color-warning-muted)',
    text:    'var(--color-warning-text)',
  },
  danger: {
    DEFAULT: 'var(--color-danger)',
    muted:   'var(--color-danger-muted)',
    text:    'var(--color-danger-text)',
  },
  info: {
    DEFAULT: 'var(--color-info)',
    muted:   'var(--color-info-muted)',
    text:    'var(--color-info-text)',
  },
} as const

// ── Typography Scale ──────────────────────────────────────────────────────────
export const typography = {
  // Font families
  fontFamily: {
    sans:    'var(--font-sans)',
    persian: 'var(--font-persian)',
    mono:    'var(--font-mono)',
  },
  // Type scale — (size, lineHeight, letterSpacing, weight)
  scale: {
    display2xl: { size: '4.5rem',   lh: '1.1',  ls: '-0.03em', weight: 700 },
    displayXl:  { size: '3.75rem',  lh: '1.1',  ls: '-0.03em', weight: 700 },
    displayLg:  { size: '3rem',     lh: '1.15', ls: '-0.025em', weight: 700 },
    displayMd:  { size: '2.25rem',  lh: '1.2',  ls: '-0.02em', weight: 700 },
    displaySm:  { size: '1.875rem', lh: '1.25', ls: '-0.02em', weight: 600 },
    headingXl:  { size: '1.5rem',   lh: '1.3',  ls: '-0.015em', weight: 600 },
    headingLg:  { size: '1.25rem',  lh: '1.4',  ls: '-0.01em', weight: 600 },
    headingMd:  { size: '1.125rem', lh: '1.4',  ls: '-0.01em', weight: 600 },
    headingSm:  { size: '1rem',     lh: '1.5',  ls: '0',       weight: 600 },
    bodyLg:     { size: '1.125rem', lh: '1.7',  ls: '0',       weight: 400 },
    bodyMd:     { size: '1rem',     lh: '1.65', ls: '0',       weight: 400 },
    bodySm:     { size: '0.9375rem',lh: '1.6',  ls: '0',       weight: 400 },
    bodyXs:     { size: '0.875rem', lh: '1.55', ls: '0',       weight: 400 },
    caption:    { size: '0.8125rem',lh: '1.4',  ls: '0.01em',  weight: 400 },
    label:      { size: '0.75rem',  lh: '1.3',  ls: '0.08em',  weight: 600 },
    code:       { size: '0.875rem', lh: '1.7',  ls: '0',       weight: 400 },
    nav:        { size: '0.9375rem',lh: '1',    ls: '0',       weight: 500 },
    btn:        { size: '0.9375rem',lh: '1',    ls: '0.01em',  weight: 600 },
    btnSm:      { size: '0.8125rem',lh: '1',    ls: '0.01em',  weight: 600 },
    overline:   { size: '0.6875rem',lh: '1',    ls: '0.14em',  weight: 700 },
  },
} as const

// ── Spacing ──────────────────────────────────────────────────────────────────
// Base unit: 4px
export const spacing = {
  px:  '1px',
  0:   '0px',
  0.5: '2px',
  1:   '4px',
  1.5: '6px',
  2:   '8px',
  2.5: '10px',
  3:   '12px',
  3.5: '14px',
  4:   '16px',
  5:   '20px',
  6:   '24px',
  7:   '28px',
  8:   '32px',
  9:   '36px',
  10:  '40px',
  12:  '48px',
  14:  '56px',
  16:  '64px',
  18:  '72px',
  20:  '80px',
  24:  '96px',
  28:  '112px',
  32:  '128px',
  36:  '144px',
  40:  '160px',
  48:  '192px',
  56:  '224px',
  64:  '256px',
} as const

// ── Border Radius ────────────────────────────────────────────────────────────
export const radius = {
  none:  '0px',
  xs:    '4px',
  sm:    '6px',
  md:    '8px',
  lg:    '12px',
  xl:    '16px',
  '2xl': '20px',
  '3xl': '24px',
  full:  '9999px',
} as const

// ── Shadows / Elevation ──────────────────────────────────────────────────────
export const shadows = {
  xs:      '0 1px 2px rgba(0,0,0,0.3)',
  sm:      '0 2px 8px rgba(0,0,0,0.35)',
  md:      '0 4px 16px rgba(0,0,0,0.4)',
  lg:      '0 8px 32px rgba(0,0,0,0.45)',
  xl:      '0 16px 48px rgba(0,0,0,0.5)',
  '2xl':   '0 32px 80px rgba(0,0,0,0.55)',
  inner:   'inset 0 1px 2px rgba(0,0,0,0.4)',
  brand:   '0 8px 32px rgba(99,102,241,0.35)',
  brandLg: '0 16px 48px rgba(99,102,241,0.45)',
  glow:    '0 0 24px rgba(99,102,241,0.4), 0 0 48px rgba(99,102,241,0.15)',
  cyan:    '0 8px 32px rgba(6,182,212,0.3)',
  success: '0 4px 16px rgba(16,185,129,0.25)',
  danger:  '0 4px 16px rgba(239,68,68,0.25)',
} as const

// ── Motion ───────────────────────────────────────────────────────────────────
export const motion = {
  duration: {
    instant:  '0ms',
    fast:     '120ms',
    normal:   '200ms',
    moderate: '300ms',
    slow:     '400ms',
    slower:   '600ms',
    reveal:   '800ms',
  },
  easing: {
    linear:      'linear',
    easeIn:      'cubic-bezier(0.4, 0, 1, 1)',
    easeOut:     'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut:   'cubic-bezier(0.4, 0, 0.2, 1)',
    spring:      'cubic-bezier(0.22, 1, 0.36, 1)',      // Premium spring
    overshoot:   'cubic-bezier(0.34, 1.56, 0.64, 1)',   // Slight overshoot
    decelerate:  'cubic-bezier(0.05, 0.7, 0.1, 1)',     // Decelerate into rest
    accelerate:  'cubic-bezier(0.3, 0, 0.8, 0.15)',     // Accelerate away
  },
} as const

// ── Z-Index ──────────────────────────────────────────────────────────────────
export const zIndex = {
  hide:    -1,
  base:    0,
  raised:  1,
  dropdown: 100,
  sticky:  200,
  overlay: 300,
  modal:   400,
  popover: 500,
  toast:   600,
  tooltip: 700,
  command: 800,
} as const

// ── Breakpoints ──────────────────────────────────────────────────────────────
export const breakpoints = {
  xs:   '375px',
  sm:   '640px',
  md:   '768px',
  lg:   '1024px',
  xl:   '1280px',
  '2xl':'1536px',
  '3xl':'1920px',
} as const

// ── Blur ─────────────────────────────────────────────────────────────────────
export const blur = {
  xs:   '2px',
  sm:   '4px',
  md:   '8px',
  lg:   '16px',
  xl:   '24px',
  '2xl':'40px',
  '3xl':'64px',
} as const

// ── Opacity ──────────────────────────────────────────────────────────────────
export const opacity = {
  0:   '0',
  5:   '0.05',
  10:  '0.1',
  15:  '0.15',
  20:  '0.2',
  30:  '0.3',
  40:  '0.4',
  50:  '0.5',
  60:  '0.6',
  70:  '0.7',
  80:  '0.8',
  90:  '0.9',
  100: '1',
} as const

// ── Icon Sizes ───────────────────────────────────────────────────────────────
export const iconSizes = {
  xs:  12,
  sm:  14,
  md:  16,
  lg:  20,
  xl:  24,
  '2xl': 32,
  '3xl': 40,
} as const

// ── Container Widths ─────────────────────────────────────────────────────────
export const containers = {
  prose:  '65ch',
  narrow: '48rem',
  md:     '64rem',
  lg:     '80rem',
  xl:     '90rem',
  full:   '100%',
} as const

// ── Framer Motion Variants (reusable) ────────────────────────────────────────
export const motionVariants = {
  fadeIn: {
    hidden:  { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
  },
  slideUp: {
    hidden:  { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  },
  slideDown: {
    hidden:  { opacity: 0, y: -12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
  },
  slideInLeft: {
    hidden:  { opacity: 0, x: -24 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
  },
  slideInRight: {
    hidden:  { opacity: 0, x: 24 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
  },
  scale: {
    hidden:  { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
  },
  stagger: {
    hidden:  {},
    visible: { transition: { staggerChildren: 0.08 } },
  },
  staggerFast: {
    hidden:  {},
    visible: { transition: { staggerChildren: 0.05 } },
  },
  staggerSlow: {
    hidden:  {},
    visible: { transition: { staggerChildren: 0.15 } },
  },
} as const
