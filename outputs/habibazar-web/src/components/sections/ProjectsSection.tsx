'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { slideUp, staggerContainer, fadeIn } from '@/lib/motion'

interface Project {
  id: string
  name: string
  client: string
  industry: string
  year: string
  color: string
  icon: string
  challenge: string
  solution: string
  technologies: string[]
  results: string[]
  tags: string[]
}

const PROJECTS: Project[] = [
  {
    id: 'kenzo',
    name: 'Kenzo Restaurant',
    client: 'Kenzo Group',
    industry: 'Hospitality',
    year: '2023',
    color: '#f59e0b',
    icon: '🍽️',
    challenge: 'Multi-branch restaurant chain with outdated network infrastructure causing POS system outages, poor WiFi coverage, and zero centralized management across 5 locations.',
    solution: 'Designed and deployed a unified MikroTik-based network infrastructure with centralized management, VLAN segmentation (POS, Staff, Guest WiFi), site-to-site VPN between branches, and real-time monitoring via Zabbix.',
    technologies: ['MikroTik', 'Ubiquiti APs', 'Zabbix', 'VPN/IPSEC', 'VLAN', 'QoS'],
    results: [
      '99.9% uptime across all 5 branches',
      'Zero POS system outages post-deployment',
      'Centralized management from single pane of glass',
      '60% reduction in IT support tickets',
      'Guest WiFi with captive portal & bandwidth control',
    ],
    tags: ['Networking', 'WiFi', 'VPN', 'Monitoring'],
  },
  {
    id: 'popcorn',
    name: 'Popcorn Holding',
    client: 'Popcorn Holding Co.',
    industry: 'Holding Company',
    year: '2024',
    color: '#10b981',
    icon: '🏢',
    challenge: 'Holding company managing 8 subsidiaries with completely isolated IT systems, no centralized security policy, mixed infrastructure (Windows/Linux), and no disaster recovery plan.',
    solution: 'Architected a unified enterprise infrastructure: centralized Active Directory with subsidiary OUs, site-to-site VPN mesh, Fortigate-based security perimeter, VMware vSphere virtualization layer, and Veeam backup solution with offsite DR.',
    technologies: ['Fortigate', 'VMware vSphere', 'Active Directory', 'Veeam', 'Cisco', 'MPLS VPN'],
    results: [
      'Unified identity management across 8 subsidiaries',
      'RTO reduced from days to 4 hours',
      'Security incidents reduced by 80%',
      'Infrastructure cost reduced by 35% via consolidation',
      'Full DR capability with tested failover procedures',
    ],
    tags: ['Enterprise', 'Security', 'Virtualization', 'DR'],
  },
  {
    id: 'senso',
    name: 'Senso Restaurant Group',
    client: 'Senso Group',
    industry: 'Food & Beverage',
    year: '2024',
    color: '#818cf8',
    icon: '🍷',
    challenge: 'Upscale restaurant chain requiring premium WiFi experience for guests, CCTV integration, VoIP system for reservations, and compliance with data privacy requirements.',
    solution: 'End-to-end infrastructure: Ubiquiti enterprise WiFi with guest portal, Asterisk VoIP PBX with extension routing, IP CCTV over dedicated VLAN, Sophos XG firewall with web filtering, and automated backup for POS data.',
    technologies: ['Ubiquiti', 'Sophos XG', 'Asterisk PBX', 'IP CCTV', 'TrueNAS', 'Zabbix'],
    results: [
      'Guest WiFi satisfaction score: 4.8/5',
      'VoIP system handling 200+ daily calls',
      'CCTV retention: 30 days across all cameras',
      'POS backup: 15-minute RPO',
      'Fully compliant data handling procedures',
    ],
    tags: ['VoIP', 'WiFi', 'Security', 'CCTV'],
  },
  {
    id: 'enterprise',
    name: 'Industrial Enterprise',
    client: 'Confidential Client',
    industry: 'Industrial',
    year: '2023',
    color: '#06b6d4',
    icon: '🏭',
    challenge: 'Large industrial facility requiring OT/IT network convergence, 24/7 monitoring of critical production equipment, zero-downtime network migration, and multi-shift VoIP communication system.',
    solution: 'Designed OT/IT segmented network with industrial-grade switches, SCADA-compatible network architecture, Grafana-based production monitoring dashboard, and redundant Cisco core infrastructure with sub-second failover.',
    technologies: ['Cisco', 'Grafana', 'Prometheus', 'Industrial Switches', 'SCADA', 'VoIP'],
    results: [
      'Zero production downtime during migration',
      'Real-time visibility into 150+ production nodes',
      'Sub-second network failover achieved',
      'OT/IT convergence without security compromise',
      '40% reduction in network-related production stoppages',
    ],
    tags: ['Industrial', 'OT/IT', 'Monitoring', 'Cisco'],
  },
]

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  return (
    <motion.div
      layout
      className="service-card cursor-pointer group"
      onClick={onClick}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
        style={{ background: `linear-gradient(90deg, ${project.color}, transparent)` }}
      />

      <div className="flex items-start gap-4 mb-4">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
          style={{ background: `${project.color}15`, border: `1px solid ${project.color}30` }}
        >
          {project.icon}
        </div>
        <div>
          <h3 className="text-lg font-bold text-text-primary group-hover:text-accent transition-colors">
            {project.name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-text-muted">{project.industry}</span>
            <span className="text-text-muted/40">•</span>
            <span className="text-xs font-mono" style={{ color: project.color }}>{project.year}</span>
          </div>
        </div>
      </div>

      <p className="text-sm text-text-secondary leading-relaxed mb-4 line-clamp-3">
        {project.challenge}
      </p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {project.tags.map(tag => (
          <span
            key={tag}
            className="px-2 py-0.5 text-xs rounded-md"
            style={{ background: `${project.color}15`, color: project.color, border: `1px solid ${project.color}25` }}
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border/50">
        <div className="flex -space-x-1">
          {project.technologies.slice(0, 4).map(tech => (
            <span
              key={tech}
              className="px-2 py-0.5 text-xs bg-surface border border-border rounded-md font-mono"
            >
              {tech}
            </span>
          ))}
          {project.technologies.length > 4 && (
            <span className="px-2 py-0.5 text-xs bg-surface border border-border rounded-md text-text-muted">
              +{project.technologies.length - 4}
            </span>
          )}
        </div>
        <span className="text-xs text-accent font-medium group-hover:text-accent-hover transition-colors">
          View Case Study →
        </span>
      </div>
    </motion.div>
  )
}

function ProjectModal({ project, onClose }: { project: Project; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-background/90 backdrop-blur-md" />
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="relative z-10 w-full max-w-2xl max-h-[85vh] overflow-y-auto glass-card p-8 rounded-2xl"
        style={{ border: `1px solid ${project.color}30` }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
        >
          ✕
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl"
            style={{ background: `${project.color}15`, border: `1px solid ${project.color}30` }}
          >
            {project.icon}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-text-primary">{project.name}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-text-muted">{project.client}</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: `${project.color}20`, color: project.color }}>
                {project.year}
              </span>
              <span className="text-xs text-text-muted">{project.industry}</span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-text-muted uppercase tracking-widest mb-2">Challenge</h4>
            <p className="text-text-secondary leading-relaxed">{project.challenge}</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-text-muted uppercase tracking-widest mb-2">Solution</h4>
            <p className="text-text-secondary leading-relaxed">{project.solution}</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-text-muted uppercase tracking-widest mb-3">Technologies Used</h4>
            <div className="flex flex-wrap gap-2">
              {project.technologies.map(tech => (
                <span
                  key={tech}
                  className="px-3 py-1 text-sm rounded-lg font-medium"
                  style={{ background: `${project.color}15`, color: project.color, border: `1px solid ${project.color}25` }}
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-text-muted uppercase tracking-widest mb-3">Results & Outcomes</h4>
            <ul className="space-y-2">
              {project.results.map(result => (
                <li key={result} className="flex items-start gap-2 text-sm text-text-secondary">
                  <span className="mt-1 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${project.color}20` }}>
                    <span style={{ color: project.color, fontSize: '10px' }}>✓</span>
                  </span>
                  {result}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border">
          <a
            href="/consultation"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105"
            style={{ background: `linear-gradient(135deg, ${project.color}, ${project.color}cc)`, boxShadow: `0 8px 24px ${project.color}30` }}
          >
            Discuss a Similar Project
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>
      </motion.div>
    </motion.div>
  )
}

export function ProjectsSection() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  return (
    <section className="section-padding relative overflow-hidden" id="projects">
      <div className="absolute inset-0 grid-bg" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-DEFAULT/30 to-transparent" />

      <div className="container-site relative z-10">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.p variants={fadeIn} className="section-label mb-3">Case Studies</motion.p>
          <motion.h2 variants={slideUp} className="section-title mb-4">
            Real Projects.{' '}
            <span className="gradient-text">Real Results.</span>
          </motion.h2>
          <motion.p variants={slideUp} className="section-subtitle max-w-2xl mx-auto">
            A selection of infrastructure transformations across hospitality, holding companies,
            food & beverage, and industrial sectors.
          </motion.p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {PROJECTS.map((project, i) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              <ProjectCard project={project} onClick={() => setSelectedProject(project)} />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Project Modal */}
      <AnimatePresence>
        {selectedProject && (
          <ProjectModal
            project={selectedProject}
            onClose={() => setSelectedProject(null)}
          />
        )}
      </AnimatePresence>
    </section>
  )
}
