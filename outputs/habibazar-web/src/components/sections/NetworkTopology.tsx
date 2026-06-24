'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

interface Node {
  id: string
  label: string
  x: number
  y: number
  icon: string
  color: string
  size: number
  delay: number
}

interface Edge {
  from: string
  to: string
  animated?: boolean
}

const NODES: Node[] = [
  { id: 'cisco',      label: 'Cisco',      x: 50,  y: 18,  icon: '🔷', color: '#1ba0d7', size: 40, delay: 0 },
  { id: 'mikrotik',  label: 'MikroTik',   x: 20,  y: 42,  icon: '🌐', color: '#c03030', size: 36, delay: 0.15 },
  { id: 'linux',     label: 'Linux',      x: 75,  y: 40,  icon: '🐧', color: '#f59e0b', size: 36, delay: 0.3 },
  { id: 'vmware',    label: 'VMware',     x: 38,  y: 68,  icon: '🖥️', color: '#60b6e0', size: 34, delay: 0.45 },
  { id: 'security',  label: 'Security',   x: 12,  y: 72,  icon: '🛡️', color: '#10b981', size: 34, delay: 0.6 },
  { id: 'cloud',     label: 'Cloud',      x: 85,  y: 65,  icon: '☁️', color: '#6366f1', size: 38, delay: 0.75 },
  { id: 'monitoring',label: 'Monitor',    x: 62,  y: 82,  icon: '📊', color: '#f59e0b', size: 32, delay: 0.9 },
  { id: 'automation',label: 'Automation', x: 30,  y: 88,  icon: '⚙️', color: '#818cf8', size: 32, delay: 1.05 },
]

const EDGES: Edge[] = [
  { from: 'cisco', to: 'mikrotik', animated: true },
  { from: 'cisco', to: 'linux', animated: true },
  { from: 'cisco', to: 'cloud' },
  { from: 'mikrotik', to: 'security', animated: true },
  { from: 'mikrotik', to: 'vmware' },
  { from: 'linux', to: 'vmware', animated: true },
  { from: 'linux', to: 'monitoring' },
  { from: 'vmware', to: 'monitoring', animated: true },
  { from: 'vmware', to: 'automation' },
  { from: 'security', to: 'automation' },
  { from: 'cloud', to: 'monitoring', animated: true },
  { from: 'monitoring', to: 'automation' },
]

function getNode(id: string) {
  return NODES.find(n => n.id === id)!
}

export function NetworkTopology() {
  const [mounted, setMounted] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* SVG Network Graph */}
      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full opacity-60"
      >
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="lineGradActive" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="1" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Edges */}
        {EDGES.map((edge, i) => {
          const fromNode = getNode(edge.from)
          const toNode = getNode(edge.to)
          const length = Math.sqrt(
            Math.pow(toNode.x - fromNode.x, 2) + Math.pow(toNode.y - fromNode.y, 2)
          )
          return (
            <g key={i}>
              <line
                x1={fromNode.x}
                y1={fromNode.y}
                x2={toNode.x}
                y2={toNode.y}
                stroke={edge.animated ? 'url(#lineGradActive)' : 'url(#lineGrad)'}
                strokeWidth={edge.animated ? '0.25' : '0.18'}
                strokeDasharray={edge.animated ? '2 1.5' : undefined}
                opacity={edge.animated ? 0.8 : 0.35}
                style={edge.animated ? {
                  strokeDasharray: '2 1.5',
                  animation: `dashFlow ${1.5 + i * 0.3}s linear infinite`,
                  animationDelay: `${i * 0.15}s`
                } : undefined}
              />
              {/* Data packet animation on active edges */}
              {edge.animated && (
                <circle r="0.5" fill="#818cf8" opacity="0.9">
                  <animateMotion
                    dur={`${2 + i * 0.4}s`}
                    repeatCount="indefinite"
                    begin={`${i * 0.5}s`}
                  >
                    <mpath href={`#path-${i}`} />
                  </animateMotion>
                </circle>
              )}
            </g>
          )
        })}

        {/* Nodes */}
        {NODES.map((node) => (
          <g key={node.id} filter="url(#glow)">
            {/* Outer ring pulse */}
            <circle
              cx={node.x}
              cy={node.y}
              r={node.size / 9}
              fill="none"
              stroke={node.color}
              strokeWidth="0.2"
              opacity="0.3"
            >
              <animate
                attributeName="r"
                values={`${node.size / 9};${node.size / 7};${node.size / 9}`}
                dur={`${3 + NODES.indexOf(node) * 0.4}s`}
                repeatCount="indefinite"
                begin={`${node.delay}s`}
              />
              <animate
                attributeName="opacity"
                values="0.3;0.05;0.3"
                dur={`${3 + NODES.indexOf(node) * 0.4}s`}
                repeatCount="indefinite"
                begin={`${node.delay}s`}
              />
            </circle>

            {/* Node circle */}
            <circle
              cx={node.x}
              cy={node.y}
              r={node.size / 14}
              fill={node.color}
              fillOpacity="0.15"
              stroke={node.color}
              strokeWidth="0.3"
            />

            {/* Label */}
            <text
              x={node.x}
              y={node.y + node.size / 8}
              textAnchor="middle"
              fill={node.color}
              fontSize="2.2"
              fontWeight="600"
              opacity="0.85"
            >
              {node.label}
            </text>
          </g>
        ))}
      </svg>

      {/* Floating Node Cards - positioned absolutely */}
      {NODES.slice(0, 4).map((node, i) => (
        <motion.div
          key={node.id}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: node.delay + 0.5, duration: 0.6, ease: 'easeOut' }}
          className="absolute hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{
            background: `rgba(13,13,23,0.85)`,
            border: `1px solid ${node.color}33`,
            backdropFilter: 'blur(8px)',
            left: `${node.x}%`,
            top: `${node.y}%`,
            transform: 'translate(-50%, -50%)',
            boxShadow: `0 0 16px ${node.color}22`,
          }}
        >
          <span className="text-sm">{node.icon}</span>
          <span className="text-xs font-semibold" style={{ color: node.color }}>
            {node.label}
          </span>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: node.color }} />
        </motion.div>
      ))}
    </div>
  )
}
