/**
 * Catalog of the 19 pre-rendered hero background video loops. Pure data —
 * no DB dependency — shared by the public Hero renderer and the admin
 * "Video Background" picker tab (`/admin/hero`, HeroCenter).
 *
 * Files live at `public/videos/hero-bg/<id>.mp4` — a plain static Next.js
 * asset (NOT under public/uploads/, which is gitignored/runtime-only), so
 * these 19 built-in loops ship with the repo/build and survive every deploy.
 */
export interface HeroBgVideo {
  id: string
  file: string
  labelEn: string
  labelFa: string
}

export const HERO_BG_VIDEOS: HeroBgVideo[] = [
  { id: 'hero-topology-3d', file: 'hero-topology-3d.mp4', labelEn: '3D Network Topology', labelFa: 'توپولوژی شبکه سه‌بعدی' },
  { id: 'hero-firewall-block', file: 'hero-firewall-block.mp4', labelEn: 'Firewall Blocking Threats', labelFa: 'مسدودسازی تهدید توسط فایروال' },
  { id: 'hero-ansible-deploy', file: 'hero-ansible-deploy.mp4', labelEn: 'Automated Server Deployment', labelFa: 'استقرار خودکار سرور' },
  { id: 'hero-vpn-tunnel', file: 'hero-vpn-tunnel.mp4', labelEn: 'VPN Tunnel Between Data Centers', labelFa: 'تونل VPN بین دیتاسنترها' },
  { id: 'hero-cyber-script-fix', file: 'hero-cyber-script-fix.mp4', labelEn: 'Security Script Auto-Remediation', labelFa: 'رفع خودکار مشکل امنیتی' },
  { id: 'hero-server-failover', file: 'hero-server-failover.mp4', labelEn: 'Server Failover', labelFa: 'جابجایی خودکار سرور (Failover)' },
  { id: 'hero-ui-glow', file: 'hero-ui-glow.mp4', labelEn: 'Futuristic Interface Glow', labelFa: 'رابط کاربری آینده‌نگر' },
  { id: 'hero-cloud-migration', file: 'hero-cloud-migration.mp4', labelEn: 'Server Files Migrating to Cloud', labelFa: 'انتقال فایل‌ها به ابر' },
  { id: 'hero-monitoring-console', file: 'hero-monitoring-console.mp4', labelEn: 'Live Monitoring Console', labelFa: 'کنسول مانیتورینگ زنده' },
  { id: 'hero-network-routing', file: 'hero-network-routing.mp4', labelEn: 'Network Architecture Routing', labelFa: 'مسیریابی معماری شبکه' },
  { id: 'hero-data-packets-flow', file: 'hero-data-packets-flow.mp4', labelEn: 'Data Packets Flowing', labelFa: 'جریان بسته‌های داده' },
  { id: 'hero-db-failover-stream', file: 'hero-db-failover-stream.mp4', labelEn: 'Database Failover Stream', labelFa: 'جابجایی پایگاه‌داده' },
  { id: 'hero-global-connections', file: 'hero-global-connections.mp4', labelEn: 'Global Corporate Connections', labelFa: 'اتصالات جهانی سازمانی' },
  { id: 'hero-server-replication', file: 'hero-server-replication.mp4', labelEn: 'Servers Replicating Data', labelFa: 'همانندسازی داده بین سرورها' },
  { id: 'hero-ping-wave', file: 'hero-ping-wave.mp4', labelEn: 'Network Ping Wave', labelFa: 'موج پینگ شبکه' },
  { id: 'hero-cyber-shield', file: 'hero-cyber-shield.mp4', labelEn: 'Cybersecurity Shield', labelFa: 'سپر امنیت سایبری' },
  { id: 'hero-hex-grid-scale', file: 'hero-hex-grid-scale.mp4', labelEn: 'Hexagonal Grid Scaling', labelFa: 'مقیاس‌پذیری شبکه شش‌ضلعی' },
  { id: 'hero-network-graph-glow', file: 'hero-network-graph-glow.mp4', labelEn: 'Glowing Network Graph', labelFa: 'گراف درخشان شبکه' },
  { id: 'hero-neural-network', file: 'hero-neural-network.mp4', labelEn: 'Neural Network Processing', labelFa: 'پردازش شبکه عصبی' },
]

export function heroBgVideoById(id: string | null | undefined): HeroBgVideo | null {
  if (!id) return null
  return HERO_BG_VIDEOS.find(v => v.id === id) ?? null
}
