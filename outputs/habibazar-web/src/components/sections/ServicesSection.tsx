'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { slideUp, staggerContainer, fadeIn } from '@/lib/motion'

interface Service {
  id: string
  icon: string
  title: string
  category: string
  color: string
  shortDesc: string
  features: string[]
  technologies: string[]
}

const SERVICES: Service[] = [
  {
    id: 'network-design',
    icon: '🌐',
    title: 'Network Design & Architecture',
    category: 'Infrastructure',
    color: '#6366f1',
    shortDesc: 'Enterprise LAN/WAN design with high availability, redundancy, and performance optimization.',
    features: ['LAN / WAN Architecture', 'VPN & SD-WAN Solutions', 'Wireless Infrastructure', 'Network Segmentation', 'QoS & Traffic Management'],
    technologies: ['Cisco', 'MikroTik', 'Ubiquiti', 'Fortigate', 'SD-WAN'],
  },
  {
    id: 'network-security',
    icon: '🛡️',
    title: 'Network Security',
    category: 'Security',
    color: '#ef4444',
    shortDesc: 'Multi-layer security architecture protecting your business against modern cyber threats.',
    features: ['Firewall Design & Management', 'IDS/IPS Implementation', 'Security Hardening', 'Zero-Trust Architecture', 'Penetration Testing Support'],
    technologies: ['Fortigate', 'Sophos', 'MikroTik', 'Snort/Suricata', 'Fail2Ban'],
  },
  {
    id: 'virtualization',
    icon: '🖥️',
    title: 'Virtualization & Cloud',
    category: 'Infrastructure',
    color: '#60b6e0',
    shortDesc: 'Design and deploy virtualized environments that maximize hardware utilization and flexibility.',
    features: ['VMware vSphere/ESXi', 'Hyper-V Environments', 'Proxmox VE Clusters', 'Storage Architecture (SAN/NAS)', 'High Availability Clustering'],
    technologies: ['VMware', 'Proxmox', 'Hyper-V', 'TrueNAS', 'Ceph'],
  },
  {
    id: 'monitoring',
    icon: '📊',
    title: 'Monitoring & Observability',
    category: 'Operations',
    color: '#f59e0b',
    shortDesc: 'End-to-end visibility into your infrastructure with real-time alerting and performance dashboards.',
    features: ['Infrastructure Monitoring', 'Real-Time Alerting', 'Custom Dashboards', 'Capacity Planning', 'Log Management'],
    technologies: ['Zabbix', 'Grafana', 'Prometheus', 'SolarWinds', 'PRTG'],
  },
  {
    id: 'backup-dr',
    icon: '💾',
    title: 'Backup & Disaster Recovery',
    category: 'Operations',
    color: '#10b981',
    shortDesc: 'Comprehensive backup strategies and DR plans ensuring business continuity.',
    features: ['Backup Strategy Design', 'Veeam Implementation', 'RTO/RPO Planning', 'DR Testing & Validation', 'Offsite Replication'],
    technologies: ['Veeam', 'Acronis', 'TrueNAS', 'Rsync', 'AWS S3'],
  },
  {
    id: 'linux',
    icon: '🐧',
    title: 'Linux Infrastructure',
    category: 'Systems',
    color: '#f59e0b',
    shortDesc: 'Expert Linux server administration, automation, and open-source infrastructure solutions.',
    features: ['RHEL / Ubuntu / Debian', 'Web Server Stacks (Nginx, Apache)', 'Database Administration', 'Shell Scripting & Automation', 'Container Orchestration'],
    technologies: ['Ubuntu', 'RHEL', 'Nginx', 'Docker', 'Ansible'],
  },
  {
    id: 'microsoft',
    icon: '🪟',
    title: 'Microsoft Services',
    category: 'Systems',
    color: '#00adef',
    shortDesc: 'Windows Server environments, Active Directory, and Microsoft ecosystem management.',
    features: ['Active Directory Design', 'Windows Server 2022', 'Exchange / Mail Services', 'Group Policy Management', 'Azure AD Integration'],
    technologies: ['Windows Server', 'Active Directory', 'Exchange', 'Azure', 'SCCM'],
  },
  {
    id: 'voip',
    icon: '📞',
    title: 'VoIP Solutions',
    category: 'Communications',
    color: '#818cf8',
    shortDesc: 'Modern IP telephony systems and unified communications for businesses.',
    features: ['Asterisk / FreePBX', 'IP Phone Configuration', 'Call Center Solutions', 'SIP Trunk Integration', 'IVR & Auto-Attendant'],
    technologies: ['Asterisk', 'FreePBX', 'Yealink', '3CX', 'SIP Protocol'],
  },
  {
    id: 'automation',
    icon: '⚙️',
    title: 'Infrastructure Automation',
    category: 'DevOps',
    color: '#06b6d4',
    shortDesc: 'Automate repetitive tasks and provisioning to reduce human error and speed up operations.',
    features: ['Ansible Playbooks', 'Configuration Management', 'CI/CD for Infrastructure', 'Network Automation', 'Monitoring Automation'],
    technologies: ['Ansible', 'Terraform', 'Python', 'Bash', 'GitLab CI'],
  },
]

const CATEGORIES = ['All', 'Infrastructure', 'Security', 'Operations', 'Systems', 'Communications', 'DevOps']

export function ServicesSection() {
  const [activeCategory, setActiveCategory] = useState('All')
  const [expandedService, setExpandedService] = useState<string | null>(null)

  const filtered = activeCategory === 'All'
    ? SERVICES
    : SERVICES.filter(s => s.category === activeCategory)

  return (
    <section className="section-padding relative overflow-hidden" id="services">
      <div className="absolute inset-0 grid-bg" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-DEFAULT/30 to-transparent" />

      <div className="container-site relative z-10">
        {/* Header */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.p variants={fadeIn} className="section-label mb-3">Enterprise Services</motion.p>
          <motion.h2 variants={slideUp} className="section-title mb-4">
            What{' '}
            <span className="gradient-text-cyan">HBZ</span>
            {' '}Delivers
          </motion.h2>
          <motion.p variants={slideUp} className="section-subtitle max-w-2xl mx-auto">
            End-to-end infrastructure consulting from design to deployment,
            monitoring to automation — built for enterprise reliability.
          </motion.p>
        </motion.div>

        {/* Category Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-wrap justify-center gap-2 mb-12"
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeCategory === cat
                  ? 'bg-accent text-white shadow-lg shadow-accent/30'
                  : 'bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-accent/30'
              }`}
            >
              {cat}
            </button>
          ))}
        </motion.div>

        {/* Services Grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filtered.map((service, i) => (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.4 }}
                className="service-card cursor-pointer"
                onClick={() => setExpandedService(
                  expandedService === service.id ? null : service.id
                )}
              >
                {/* Top bar accent */}
                <div
                  className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl opacity-60"
                  style={{ background: `linear-gradient(90deg, ${service.color}, transparent)` }}
                />

                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{ background: `${service.color}15`, border: `1px solid ${service.color}30` }}
                  >
                    {service.icon}
                  </div>
                  <span
                    className="text-xs font-semibold px-2 py-1 rounded-md"
                    style={{ background: `${service.color}15`, color: service.color }}
                  >
                    {service.category}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-text-primary mb-2">{service.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed mb-4">{service.shortDesc}</p>

                {/* Expanded content */}
                <AnimatePresence>
                  {expandedService === service.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-4 border-t border-border mt-2 space-y-4">
                        <div>
                          <p className="text-xs text-text-muted uppercase tracking-widest mb-2 font-semibold">Services Include</p>
                          <ul className="space-y-1">
                            {service.features.map(f => (
                              <li key={f} className="flex items-center gap-2 text-sm text-text-secondary">
                                <span style={{ color: service.color }}>▸</span>
                                {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs text-text-muted uppercase tracking-widest mb-2 font-semibold">Technologies</p>
                          <div className="flex flex-wrap gap-1.5">
                            {service.technologies.map(t => (
                              <span
                                key={t}
                                className="px-2 py-0.5 text-xs rounded-md font-medium"
                                style={{ background: `${service.color}15`, color: service.color, border: `1px solid ${service.color}25` }}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* CTA */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
                  <span className="text-xs text-text-muted">
                    {expandedService === service.id ? 'Click to collapse' : 'Click to expand'}
                  </span>
                  <motion.div
                    animate={{ rotate: expandedService === service.id ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </motion.div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* CTA Banner */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mt-16 relative rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(6,182,212,0.1) 100%)',
            border: '1px solid rgba(99,102,241,0.25)',
          }}
        >
          <div className="absolute inset-0 grid-bg opacity-50" />
          <div className="relative z-10 p-8 md:p-12 text-center">
            <h3 className="text-2xl md:text-3xl font-bold text-text-primary mb-3">
              Not sure which service fits your needs?
            </h3>
            <p className="text-text-secondary mb-6 max-w-xl mx-auto">
              Book a free 30-minute discovery call and get a personalized infrastructure assessment.
            </p>
            <a
              href="/consultation"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all duration-200 hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)', boxShadow: '0 8px 30px rgba(99,102,241,0.3)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Book Free Consultation
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
