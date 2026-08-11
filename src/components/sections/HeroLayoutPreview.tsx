'use client'

/**
 * HeroLayoutPreview — a genuine live-rendered preview of a Hero.tsx layout
 * variant, used by the admin "چیدمان" (Layout) picker. Renders the SAME
 * `Hero` component the public site uses (real code path, not a screenshot
 * or a static mock), scaled down and clipped to fit a small card — the
 * standard technique for admin theme/template pickers.
 */
import { Hero } from './Hero'

const PREVIEW_WIDTH = 1440
const PREVIEW_HEIGHT = 620

export function HeroLayoutPreview({ variant, locale = 'en', scale = 0.19 }: { variant: string; locale?: string; scale?: number }) {
  return (
    <div className="relative w-full h-full overflow-hidden pointer-events-none select-none" aria-hidden="true">
      <div
        style={{
          width: PREVIEW_WIDTH,
          height: PREVIEW_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        <Hero locale={locale} variant={variant} />
      </div>
    </div>
  )
}
