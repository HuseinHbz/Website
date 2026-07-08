/**
 * Enterprise Hero Platform — shared types (Phase 23).
 *
 * A Hero is a versioned, template-driven, per-language configurable landing
 * experience. These types are the contract shared by the pure engines
 * (templates/rules/experiment/personalize/analytics), the admin builder, the
 * APIs and the public renderer. No runtime code here → import-cheap everywhere.
 */

export type Locale = 'en' | 'fa'
export type HeroStatus = 'draft' | 'review' | 'approved' | 'published' | 'archived'

/** A CTA button inside a hero. */
export interface HeroCta {
  label: string
  href: string
  /** Visual role — maps to the design-system button styles. */
  variant?: 'primary' | 'secondary' | 'ghost'
  icon?: string
}

/** A single statistic pill. */
export interface HeroStat { label: string; value: string }

/** Per-language content of a hero (independent EN / FA). */
export interface HeroContentL {
  badge?: string
  headline?: string
  headlineHighlight?: string
  subheadline?: string
  ctas?: HeroCta[]
  stats?: HeroStat[]
  /** Foreground media (image/video/lottie url). */
  mediaUrl?: string
  mediaAlt?: string
}

export type BackgroundKind = 'solid' | 'gradient' | 'image' | 'video' | 'animation' | 'canvas'

/** Configurable style layer (typography / spacing / buttons / images / background). */
export interface HeroStyle {
  // Typography
  fontFamily?: string
  titleSize?: number        // px
  subtitleSize?: number     // px
  fontWeight?: number
  lineHeight?: number
  letterSpacing?: number    // px
  textColor?: string        // hex
  // Spacing / layout
  paddingY?: number         // px
  containerWidth?: number   // px (max)
  minHeightVh?: number      // svh
  // Buttons
  buttonRadius?: number     // px
  buttonSize?: 'sm' | 'md' | 'lg'
  buttonShadow?: boolean
  // Image treatment
  overlay?: number          // 0..1 dark overlay
  blur?: number             // px
  brightness?: number       // 0..2
  imageOpacity?: number     // 0..1
  // Background
  background?: { kind: BackgroundKind; value?: string; animation?: string; color?: string }
}

/** A builder block (drag-and-drop). Config-driven, order-preserving. */
export type HeroBlockType =
  | 'text' | 'button' | 'image' | 'video' | 'background' | 'particles' | 'card'
  | 'stats' | 'logos' | 'timeline' | 'pricing' | 'testimonials' | 'features'
  | 'technologies' | 'icon' | 'custom'
export interface HeroBlock {
  id: string
  type: HeroBlockType
  props?: Record<string, unknown>
}

/** The full editable hero configuration (persisted as JSON on `heroes.config`). */
export interface HeroConfig {
  template: string
  content: { en: HeroContentL; fa: HeroContentL }
  style: HeroStyle
  blocks?: HeroBlock[]
  /** SEO overrides. */
  seo?: { title?: string; description?: string; ogImage?: string }
  /** Reduce/disable animation for motion-sensitive users. */
  reduceMotion?: boolean
}

/** A hero record (header row; content lives in `config`). */
export interface HeroRecord {
  id: number
  slug: string
  name: string
  template: string
  category: string | null
  tags: string[]
  status: HeroStatus
  config: HeroConfig
  version: number
  targetPath: string | null   // which page it drives ('/' for home)
  updatedAt: string
}
