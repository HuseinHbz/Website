'use client'

/**
 * HbzWordmark — the "HBZ" hero logotype with the reference clip's reveal
 * effects (uploaded 2026-08-11), reconstructed in CSS/SVG, not video:
 * a bright comet streak races diagonally through the letters once on
 * mount, a burst of light sparkles fires around it, and the glyphs settle
 * into a persistent rim glow + a slow ambient light-sweep (the pre-existing
 * `.hbz-shine`). The text itself ("HBZ") is untouched — every element here
 * is a decorative overlay, never a change to the wordmark's content.
 */
import { useReducedMotion } from 'framer-motion'

// Fixed positions (relative %, tuned for the "HBZ" glyph shapes) so sparks
// land near letter strokes/corners rather than scattered randomly.
const SPARKS = [
  { x: 8,  y: 30, d: 0.00 }, { x: 18, y: 70, d: 0.06 }, { x: 30, y: 15, d: 0.12 },
  { x: 42, y: 55, d: 0.05 }, { x: 52, y: 25, d: 0.16 }, { x: 63, y: 68, d: 0.09 },
  { x: 74, y: 20, d: 0.20 }, { x: 84, y: 50, d: 0.14 }, { x: 92, y: 30, d: 0.24 },
  { x: 97, y: 65, d: 0.18 },
]

export function HbzWordmark() {
  const reduceMotion = useReducedMotion()

  return (
    <div className="relative inline-block">
      <h1 className="hbz-shine hbz-glow text-7xl sm:text-8xl lg:text-9xl font-black tracking-tight leading-[1.05]"
        style={{ background:'linear-gradient(100deg,#7477ff 0%,#a5aec4 25%,#ffffff 42%,#f7f9ff 50%,#a5aec4 58%,#7477ff 75%,#9698ff 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
        HBZ
      </h1>
      {!reduceMotion && (
        <>
          {/* Comet streak — one diagonal pass of light through the letters on mount. */}
          <span className="hbz-comet" aria-hidden="true" />
          {/* Sparkle burst, timed to the comet passing each spark's position. */}
          {SPARKS.map((s, i) => (
            <span key={i} className="hbz-spark" aria-hidden="true"
              style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${0.15 + s.d}s` }} />
          ))}
        </>
      )}
    </div>
  )
}
