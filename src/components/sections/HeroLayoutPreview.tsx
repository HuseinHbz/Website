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

export function HeroLayoutPreview({ variant, scale = 0.26 }: { variant: string; scale?: number }) {
  return (
    <div className="relative w-full h-full overflow-hidden pointer-events-none select-none" aria-hidden="true">
      {/* hbz-marketing re-scopes the public-site color tokens (--color-brand,
          --color-text-primary, etc.) that Hero.tsx's variants rely on for
          their gradient/glow text — without it, this renders inside the
          admin panel's own (different) indigo/cyan token scope instead,
          which is what made every layout except the ones using literal
          hardcoded colors look blank/invisible in the picker. */}
      <div className="hbz-marketing absolute inset-0" dir="ltr">
        <div
          style={{
            width: PREVIEW_WIDTH,
            height: PREVIEW_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          {/* Always English/LTR regardless of the admin's own UI language:
              the crop below only ever shows the top-left corner of the full
              1440px-wide layout, and several variants right-align/flip their
              content under RTL (dir="rtl" + flex-row-reverse) — previewing in
              Persian from a Farsi-locale admin session showed nothing but
              empty background for exactly that reason. The card's own label
              underneath is already shown in the admin's language; this is
              just the visual thumbnail. */}
          <Hero locale="en" variant={variant} />
        </div>
      </div>
    </div>
  )
}
