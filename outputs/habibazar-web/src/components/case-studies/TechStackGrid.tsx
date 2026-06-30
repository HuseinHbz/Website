'use client'

import { motion } from 'framer-motion'
import { staggerFast, springUp } from '@/lib/motion'

interface TechItem {
  name: string
  icon?: string
  category: string
  url?: string
}

const CATEGORY_COLORS: Record<string, string> = {
  Networking: '#6366f1',
  Security: '#ef4444',
  Virtualization: '#06b6d4',
  Monitoring: '#f59e0b',
  Automation: '#10b981',
  Storage: '#8b5cf6',
  Cloud: '#0ea5e9',
  Linux: '#f97316',
  Windows: '#00adef',
  VoIP: '#818cf8',
  Backup: '#14b8a6',
  'High Availability': '#a855f7',
  Default: '#6366f1',
}

const TECH_ICONS: Record<string, string> = {
  Cisco: '🔵', MikroTik: '🔴', Fortigate: '🟠', Ubiquiti: '⚫',
  VMware: '🟢', Proxmox: '🟤', 'Hyper-V': '🔷', Zabbix: '📊',
  Grafana: '🟠', Ansible: '🔴', Docker: '🐳', Kubernetes: '☸️',
  Nginx: '🟢', Linux: '🐧', Windows: '🪟', TrueNAS: '🔵',
  Veeam: '🟢', Sophos: '🔵', Asterisk: '⭐', FreePBX: '📞',
  Default: '⚙️',
}

interface Props {
  techStackJson?: string | null
  technologies?: string[]
  isRTL?: boolean
}

export function TechStackGrid({ techStackJson, technologies, isRTL }: Props) {
  let items: TechItem[] = []

  if (techStackJson) {
    try { items = JSON.parse(techStackJson) } catch { /* ignore */ }
  }

  if (!items.length && technologies?.length) {
    items = technologies.map(t => ({ name: t, category: 'Default' }))
  }

  if (!items.length) return null

  const grouped = items.reduce<Record<string, TechItem[]>>((acc, t) => {
    const cat = t.category || 'Default'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(t)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([cat, techs]) => (
        <div key={cat}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: CATEGORY_COLORS[cat] || CATEGORY_COLORS.Default }}>
            {cat}
          </p>
          <motion.div
            variants={staggerFast}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="flex flex-wrap gap-2"
          >
            {techs.map((tech) => (
              <motion.div
                key={tech.name}
                variants={springUp}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 cursor-default"
                style={{
                  background: `${CATEGORY_COLORS[cat] || CATEGORY_COLORS.Default}12`,
                  border: `1px solid ${CATEGORY_COLORS[cat] || CATEGORY_COLORS.Default}25`,
                  color: CATEGORY_COLORS[cat] || CATEGORY_COLORS.Default,
                }}
              >
                <span className="text-base">{TECH_ICONS[tech.name] || tech.icon || TECH_ICONS.Default}</span>
                {tech.name}
              </motion.div>
            ))}
          </motion.div>
        </div>
      ))}
    </div>
  )
}
