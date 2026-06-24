'use client'

import { motion } from 'framer-motion'
import { slideUp, staggerContainer, fadeIn } from '@/lib/motion'

const TIMELINE = [
  {
    year: '2013',
    title: 'Technical Technician',
    desc: 'Started career in IT support, hardware maintenance and basic network administration.',
    color: '#6366f1',
  },
  {
    year: '2017',
    title: 'IT Specialist',
    desc: 'Expanded into system administration, server management, and enterprise networking.',
    color: '#818cf8',
  },
  {
    year: '2021',
    title: 'Network Operations Engineer',
    desc: 'Designed and implemented complex LAN/WAN infrastructures, VPN solutions and security systems.',
    color: '#06b6d4',
  },
  {
    year: '2024',
    title: 'Senior Infrastructure Engineer',
    desc: 'Led enterprise-scale virtualization, cloud integration, and infrastructure automation projects.',
    color: '#10b981',
  },
  {
    year: '2025',
    title: 'Network Operations Supervisor',
    desc: 'Overseeing multi-site infrastructure operations, mentoring teams and driving digital transformation.',
    color: '#f59e0b',
  },
]

const SKILLS = [
  { name: 'Network Architecture', level: 95, category: 'Networking' },
  { name: 'MikroTik RouterOS', level: 92, category: 'Networking' },
  { name: 'Cisco IOS/IOS-XE', level: 88, category: 'Networking' },
  { name: 'Fortigate / Sophos', level: 90, category: 'Security' },
  { name: 'Network Security', level: 88, category: 'Security' },
  { name: 'VMware vSphere', level: 85, category: 'Virtualization' },
  { name: 'Proxmox VE', level: 82, category: 'Virtualization' },
  { name: 'Linux Server Admin', level: 90, category: 'Systems' },
  { name: 'Zabbix / Grafana', level: 85, category: 'Monitoring' },
  { name: 'Infrastructure Automation', level: 78, category: 'DevOps' },
  { name: 'Veeam Backup & DR', level: 85, category: 'Operations' },
  { name: 'VoIP Solutions', level: 80, category: 'Communications' },
]

const CERTS = [
  { name: 'MikroTik MTCNA', icon: '🏅', color: '#c03030' },
  { name: 'MikroTik MTCRE', icon: '🏅', color: '#c03030' },
  { name: 'Fortinet NSE', icon: '🛡️', color: '#ee3124' },
  { name: 'VMware VCP', icon: '☁️', color: '#60b6e0' },
  { name: 'Linux LPIC', icon: '🐧', color: '#f59e0b' },
  { name: 'Cisco CCNA', icon: '🔷', color: '#1ba0d7' },
]

const SKILL_CATEGORIES = ['All', 'Networking', 'Security', 'Virtualization', 'Systems', 'Monitoring', 'DevOps', 'Operations']

function SkillBar({ skill, index }: { skill: typeof SKILLS[0]; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.06, duration: 0.5 }}
      className="group"
    >
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-text-primary">{skill.name}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted px-2 py-0.5 rounded-full bg-surface border border-border">
            {skill.category}
          </span>
          <span className="text-xs font-mono text-accent">{skill.level}%</span>
        </div>
      </div>
      <div className="h-1.5 bg-surface rounded-full overflow-hidden border border-border">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${skill.level}%` }}
          viewport={{ once: true }}
          transition={{ delay: index * 0.06 + 0.3, duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(90deg, #6366f1, #818cf8)`,
            boxShadow: '0 0 8px rgba(99,102,241,0.4)',
          }}
        />
      </div>
    </motion.div>
  )
}

export function AboutSection() {
  return (
    <section className="section-padding relative overflow-hidden" id="about">
      {/* Background */}
      <div className="absolute inset-0 grid-bg opacity-100" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />

      <div className="container-site relative z-10">
        {/* Header */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <motion.p variants={fadeIn} className="section-label mb-3">About</motion.p>
          <motion.h2 variants={slideUp} className="section-title mb-4">
            The Architect Behind{' '}
            <span className="gradient-text">The Infrastructure</span>
          </motion.h2>
          <motion.p variants={slideUp} className="section-subtitle max-w-2xl mx-auto">
            Over a decade of hands-on experience designing, securing, and automating enterprise-grade infrastructure
            across industries — from restaurants to holding companies.
          </motion.p>
        </motion.div>

        {/* Bio + Timeline */}
        <div className="grid md:grid-cols-2 gap-12 md:gap-20 mb-24">
          {/* Bio */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <div className="glass-card p-8 h-full">
              <h3 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-accent/20 flex items-center justify-center text-accent text-sm">👤</span>
                Professional Story
              </h3>
              <div className="space-y-4 text-text-secondary leading-relaxed">
                <p>
                  Husein Habibazar (HBZ) is a Senior Infrastructure Architect and Network & Security Consultant
                  with over 10 years of enterprise IT experience across diverse industries in Iran.
                </p>
                <p>
                  He specializes in designing resilient network architectures, implementing multi-layer security
                  frameworks, and building automated infrastructure pipelines that reduce operational overhead
                  while improving reliability.
                </p>
                <p>
                  His clientele includes restaurant chains, retail businesses, holding companies, and
                  industrial organizations — enterprises that demand enterprise-grade reliability
                  without enterprise-level complexity.
                </p>
                <p>
                  Husein's methodology combines deep technical expertise with a business-first approach,
                  ensuring every infrastructure decision translates to measurable business value.
                </p>
              </div>

              {/* Cert badges */}
              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-xs text-text-muted mb-3 uppercase tracking-widest font-semibold">Certifications</p>
                <div className="flex flex-wrap gap-2">
                  {CERTS.map((cert) => (
                    <span
                      key={cert.name}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{
                        background: `${cert.color}15`,
                        border: `1px solid ${cert.color}30`,
                        color: cert.color,
                      }}
                    >
                      {cert.icon} {cert.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Timeline */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <h3 className="text-xl font-bold text-text-primary mb-8 flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-accent/20 flex items-center justify-center text-accent text-sm">📈</span>
              Career Timeline
            </h3>
            <div className="space-y-8">
              {TIMELINE.map((item, i) => (
                <motion.div
                  key={item.year}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="timeline-item"
                >
                  <div className="timeline-dot" style={{ background: `linear-gradient(135deg, ${item.color}, ${item.color}99)`, boxShadow: `0 0 12px ${item.color}50` }} />
                  <div className="glass-card p-4 hover:border-accent/30 transition-colors">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                        style={{ background: `${item.color}20`, color: item.color, border: `1px solid ${item.color}30` }}
                      >
                        {item.year}
                      </span>
                      <h4 className="font-semibold text-text-primary text-sm">{item.title}</h4>
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Skills Matrix */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <div className="text-center mb-10">
            <p className="section-label mb-2">Technical Proficiency</p>
            <h3 className="text-2xl font-bold text-text-primary">Skills Matrix</h3>
          </div>
          <div className="glass-card p-8">
            <div className="grid md:grid-cols-2 gap-6">
              {SKILLS.map((skill, i) => (
                <SkillBar key={skill.name} skill={skill} index={i} />
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
