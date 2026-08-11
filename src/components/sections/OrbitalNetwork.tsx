'use client'

/**
 * OrbitalNetwork — the "HBZ Orbit" hero network animation.
 *
 * Built to match the reference clip (uploaded 2026-08-11): a central hub
 * connected to a ring of technology nodes, animated light packets
 * traveling the connections, slow-rotating orbit rings, comet-tail accents
 * and small HUD readouts — but recreated entirely in SVG/CSS/HTML (no
 * <video> in the DOM here) so text stays crisp, the layout stays
 * responsive, and the browser never decodes a second video stream behind
 * the hero content.
 *
 * Per the maintainer's instruction, the reference clip's center node
 * (mislabeled "VMware" in the AI-generated footage) is renamed to **HBZ**
 * and every outer node connects into that HBZ hub — the brand is the
 * center of the network, not one vendor among the others.
 *
 * This is its own catalogued piece (src/lib/heroOrbitStyles.ts), selectable
 * from the admin "Templates" tab (`/admin/hero` → HeroCenter) exactly like
 * a background-video pick — independent of the text content and the video
 * background layer, per the maintainer's three-part breakdown (text / orbit
 * animation / background).
 */
import { useId } from 'react'

export interface OrbitNode {
  label: string
  color: string
  angle: number   // degrees, 0 = top, clockwise
}

const NODES: OrbitNode[] = [
  { label: 'Cisco',      color: '#22d3ee', angle: 0 },
  { label: 'MikroTik',   color: '#f0576b', angle: 51.4 },
  { label: 'Linux',      color: '#f5b84b', angle: 102.8 },
  { label: 'Cloud',      color: '#7477ff', angle: 154.2 },
  { label: 'Monitoring', color: '#f5b84b', angle: 205.7 },
  { label: 'Security',   color: '#22c997', angle: 257.1 },
  { label: 'VMware',     color: '#38bdf8', angle: 308.5 },
]

// A few cross-links between outer nodes (mesh), matching the reference clip's
// denser web rather than a bare spokes-only wheel.
const MESH: [number, number][] = [[0, 2], [1, 3], [3, 5], [4, 6], [6, 0]]

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

interface Props {
  /** Compact = small preview tile (admin picker) — same animation, fewer HUD extras. */
  compact?: boolean
  className?: string
}

export function OrbitalNetwork({ compact = false, className = '' }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const CX = 100, CY = 100, R_OUT = 78, R_HUB = compact ? 15 : 17

  const outer = NODES.map(n => ({ ...n, ...polar(CX, CY, R_OUT, n.angle) }))

  return (
    <div className={`orbit-network relative w-full h-full ${className}`} aria-hidden="true">
      {/* Slow-rotating faint orbit rings, behind everything */}
      <div className="absolute inset-0 rounded-full orbit-ring-a border border-[color:var(--color-border-default)]" style={{ opacity: 0.35 }} />
      <div className="absolute inset-[6%] rounded-full orbit-ring-b border border-[color:var(--color-brand)]/20" />

      <svg viewBox="0 0 200 200" className="relative w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id={`hub-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f7f9ff" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#7477ff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`spoke-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7477ff" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id={`mesh-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.12" />
          </linearGradient>
          <filter id={`glow-${uid}`}>
            <feGaussianBlur stdDeviation="1.4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* mesh cross-links (behind spokes) */}
        {MESH.map(([a, b], i) => {
          const p1 = outer[a], p2 = outer[b]
          return (
            <path key={`m${i}`} d={`M${p1.x},${p1.y} Q${CX},${CY} ${p2.x},${p2.y}`}
              fill="none" stroke={`url(#mesh-${uid})`} strokeWidth="0.6" opacity="0.55" />
          )
        })}

        {/* spokes: every outer node -> HBZ hub */}
        {outer.map((n, i) => (
          <line key={`s${i}`} x1={n.x} y1={n.y} x2={CX} y2={CY}
            stroke={`url(#spoke-${uid})`} strokeWidth="0.9"
            strokeDasharray="2.4 1.6" opacity="0.85"
            style={{ animation: `dashFlow ${2.4 + i * 0.2}s linear infinite` }} />
        ))}

        {/* traveling light packets along each spoke */}
        {outer.map((n, i) => (
          <circle key={`p${i}`} r="1.6" fill={n.color} filter={`url(#glow-${uid})`}>
            <animateMotion dur={`${2.6 + (i % 3) * 0.5}s`} repeatCount="indefinite" begin={`${i * 0.45}s`}
              path={`M${n.x},${n.y} L${CX},${CY}`} />
          </circle>
        ))}

        {/* HBZ hub */}
        <circle cx={CX} cy={CY} r={R_HUB + 9} fill={`url(#hub-${uid})`} className="hub-pulse" />
        <circle cx={CX} cy={CY} r={R_HUB} fill="rgba(8,11,24,0.85)" stroke="#f7f9ff" strokeWidth="1.1" />
        <text x={CX} y={CY + (compact ? 4.5 : 5)} textAnchor="middle" fontWeight="900"
          fontSize={compact ? 11 : 12.5} fill="#f7f9ff" letterSpacing="0.5"
          style={{ fontFamily: 'inherit' }}>HBZ</text>

        {/* outer nodes */}
        {outer.map((n, i) => (
          <g key={n.label} className="glow-breathe-svg"
            style={{ '--glow-color': `${n.color}90`, animationDelay: `${i * 0.32}s`, animationDuration: `${3 + (i % 3)}s` } as React.CSSProperties}>
            <circle cx={n.x} cy={n.y} r={compact ? 9 : 10.5} fill={`${n.color}22`} stroke={n.color} strokeWidth="1" />
            {!compact && (
              <text x={n.x} y={n.y + (n.y > CY ? 17 : -13)} textAnchor="middle" fill={n.color}
                fontSize="6.2" fontWeight="700" opacity="0.95">{n.label}</text>
            )}
          </g>
        ))}
      </svg>

      {/* HUD mini-panels — decorative only, live mode only */}
      {!compact && (
        <>
          <div className="hud-panel absolute -left-2 top-[18%] hidden xl:flex" aria-hidden="true">
            <HudBars color="#22d3ee" />
          </div>
          <div className="hud-panel absolute -right-2 bottom-[16%] hidden xl:flex" aria-hidden="true">
            <HudBars color="#8b5cf6" />
          </div>
        </>
      )}
    </div>
  )
}

function HudBars({ color }: { color: string }) {
  const bars = [40, 70, 55, 90, 65, 45]
  return (
    <div className="flex items-end gap-0.5 h-8 px-2 py-1.5 rounded-md"
      style={{ background: 'rgba(8,11,24,0.7)', border: `1px solid ${color}33`, backdropFilter: 'blur(4px)' }}>
      {bars.map((h, i) => (
        <span key={i} className="hud-bar w-0.5 rounded-full" style={{ background: color, height: `${h}%`, animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  )
}
