'use client'

import { motion } from 'framer-motion'
import { staggerContainer, slideUp, fadeIn } from '@/lib/motion'

const CLIENTS = [
  { name: 'Kenzo Restaurant', icon: '🍽️', type: 'Hospitality' },
  { name: 'Popcorn Holding', icon: '🏢', type: 'Holding' },
  { name: 'Senso Group', icon: '🍷', type: 'F&B' },
  { name: 'Industrial Co.', icon: '🏭', type: 'Industrial' },
  { name: 'Retail Chain', icon: '🛒', type: 'Retail' },
  { name: 'Tech Startup', icon: '💡', type: 'Technology' },
  { name: 'Medical Center', icon: '🏥', type: 'Healthcare' },
  { name: 'Logistics Firm', icon: '🚛', type: 'Logistics' },
  { name: 'Finance Group', icon: '💳', type: 'Finance' },
  { name: 'Education Institute', icon: '🎓', type: 'Education' },
]

const TECH_PARTNERS = [
  { name: 'MikroTik', icon: '🌐', color: '#c03030' },
  { name: 'Cisco', icon: '🔷', color: '#1ba0d7' },
  { name: 'Fortigate', icon: '🛡️', color: '#ee3124' },
  { name: 'VMware', icon: '☁️', color: '#60b6e0' },
  { name: 'Ubiquiti', icon: '📡', color: '#0559c9' },
  { name: 'Zabbix', icon: '📊', color: '#d40000' },
  { name: 'Proxmox', icon: '🖥️', color: '#e57000' },
  { name: 'Sophos', icon: '🔒', color: '#003057' },
  { name: 'Veeam', icon: '💾', color: '#00b336' },
  { name: 'Grafana', icon: '📈', color: '#f46800' },
  { name: 'Linux', icon: '🐧', color: '#f59e0b' },
  { name: 'Ansible', icon: '⚙️', color: '#e00' },
]

function MarqueeRow({ items, reverse = false, speed = 30 }: {
  items: typeof CLIENTS | typeof TECH_PARTNERS
  reverse?: boolean
  speed?: number
}) {
  const doubled = [...items, ...items]

  return (
    <div className="flex overflow-hidden relative">
      <div
        className="flex gap-4 items-center"
        style={{
          animation: `${reverse ? 'marqueeReverse' : 'marquee'} ${speed}s linear infinite`,
          willChange: 'transform',
        }}
      >
        {doubled.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-5 py-3 rounded-xl flex-shrink-0 hover:border-accent/40 transition-colors duration-200 cursor-default"
            style={{
              background: 'rgba(13,13,23,0.8)',
              border: '1px solid rgba(26,26,46,0.8)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <span className="text-xl">{item.icon}</span>
            <div>
              <div className="text-sm font-semibold text-text-primary whitespace-nowrap">{item.name}</div>
              <div className="text-xs text-text-muted">{'type' in item ? item.type : 'Partner'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CompanyPortfolio() {
  return (
    <section className="section-padding relative overflow-hidden" id="clients">
      {/* Background */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(180deg, #07070d 0%, #0d0d17 50%, #07070d 100%)',
      }} />
      <div className="absolute inset-0 grid-bg opacity-60" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />

      <div className="container-site relative z-10 mb-16">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center"
        >
          <motion.p variants={fadeIn} className="section-label mb-3">Portfolio</motion.p>
          <motion.h2 variants={slideUp} className="section-title mb-4">
            Trusted By{' '}
            <span className="gradient-text">Enterprises</span>
          </motion.h2>
          <motion.p variants={slideUp} className="section-subtitle max-w-xl mx-auto">
            Organizations across industries have trusted HBZ to design,
            secure, and automate their critical infrastructure.
          </motion.p>
        </motion.div>
      </div>

      {/* Marquee rows */}
      <div className="space-y-4 relative">
        {/* Fade edges */}
        <div className="absolute inset-y-0 left-0 w-24 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(90deg, #07070d, transparent)' }} />
        <div className="absolute inset-y-0 right-0 w-24 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(270deg, #07070d, transparent)' }} />

        <MarqueeRow items={CLIENTS} speed={35} />
        <MarqueeRow items={TECH_PARTNERS} reverse speed={28} />
      </div>

      {/* Stats row */}
      <div className="container-site relative z-10 mt-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {[
            { value: '50+', label: 'Projects Delivered', icon: '🏗️' },
            { value: '10+', label: 'Industries Served', icon: '🌍' },
            { value: '1000+', label: 'Endpoints Managed', icon: '🖧' },
            { value: '99.9%', label: 'Average Uptime SLA', icon: '⏱️' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center glass-card p-6"
            >
              <div className="text-2xl mb-2">{stat.icon}</div>
              <div className="text-3xl font-bold gradient-text mb-1">{stat.value}</div>
              <div className="text-xs text-text-muted">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
