/** Built-in media backgrounds exposed by the Hero Builder. */
export interface HeroBackgroundPreset {
  id: string
  nameEn: string
  nameFa: string
  kind: 'video' | 'animation'
  src?: string
  animation?: HeroBackgroundAnimationId
}

export type HeroBackgroundAnimationId =
  | 'topology-mesh'
  | 'ansible-deployment'
  | 'global-remediation'
  | 'firewall-filter'
  | 'interface-core'
  | 'monitoring-console'
  | 'routing-fabric'
  | 'server-failover'
  | 'cloud-migration'
  | 'vpn-tunnel'

const MEDIA_ROOT = '/media/hero-backgrounds'

/** Ten supplied MP4 backgrounds plus ten lightweight code-rendered scenes. */
export const HERO_BACKGROUND_PRESETS: HeroBackgroundPreset[] = [
  { id: 'cobalt-data-stream', kind: 'video', nameEn: 'Cobalt data stream', nameFa: 'جریان داده کبالت', src: `${MEDIA_ROOT}/cobalt-data-stream.mp4` },
  { id: 'database-failover', kind: 'video', nameEn: 'Database failover', nameFa: 'جابجایی پایگاه داده', src: `${MEDIA_ROOT}/database-failover.mp4` },
  { id: 'global-connectivity', kind: 'video', nameEn: 'Global connectivity', nameFa: 'اتصال جهانی سازمانی', src: `${MEDIA_ROOT}/global-connectivity.mp4` },
  { id: 'server-replication', kind: 'video', nameEn: 'Server replication', nameFa: 'همگام‌سازی سرورها', src: `${MEDIA_ROOT}/server-replication.mp4` },
  { id: 'network-ping-wave', kind: 'video', nameEn: 'Network ping wave', nameFa: 'موج پینگ شبکه', src: `${MEDIA_ROOT}/network-ping-wave.mp4` },
  { id: 'cybersecurity-shield', kind: 'video', nameEn: 'Cybersecurity shield', nameFa: 'سپر امنیت سایبری', src: `${MEDIA_ROOT}/cybersecurity-shield.mp4` },
  { id: 'hexagonal-grid', kind: 'video', nameEn: 'Hexagonal grid', nameFa: 'شبکه سلولی شش‌ضلعی', src: `${MEDIA_ROOT}/hexagonal-grid.mp4` },
  { id: 'network-graph', kind: 'video', nameEn: 'Live network graph', nameFa: 'گراف زنده شبکه', src: `${MEDIA_ROOT}/network-graph.mp4` },
  { id: 'neural-network', kind: 'video', nameEn: 'Neural network', nameFa: 'پردازش شبکه عصبی', src: `${MEDIA_ROOT}/neural-network.mp4` },
  { id: 'futuristic-interface', kind: 'video', nameEn: 'Futuristic infrastructure', nameFa: 'زیرساخت آینده‌نگر', src: `${MEDIA_ROOT}/futuristic-interface.mp4` },
  { id: 'topology-mesh', kind: 'animation', animation: 'topology-mesh', nameEn: '3D network topology', nameFa: 'توپولوژی سه‌بعدی شبکه' },
  { id: 'ansible-deployment', kind: 'animation', animation: 'ansible-deployment', nameEn: 'Ansible deployment', nameFa: 'استقرار خودکار Ansible' },
  { id: 'global-remediation', kind: 'animation', animation: 'global-remediation', nameEn: 'Global threat remediation', nameFa: 'رفع تهدید جهانی' },
  { id: 'firewall-filter', kind: 'animation', animation: 'firewall-filter', nameEn: 'Firewall packet filter', nameFa: 'پالایش بسته‌های فایروال' },
  { id: 'interface-core', kind: 'animation', animation: 'interface-core', nameEn: 'HBZ Core interface', nameFa: 'رابط هسته HBZ' },
  { id: 'monitoring-console', kind: 'animation', animation: 'monitoring-console', nameEn: 'Monitoring console', nameFa: 'کنسول زنده مانیتورینگ' },
  { id: 'routing-fabric', kind: 'animation', animation: 'routing-fabric', nameEn: 'Network routing fabric', nameFa: 'مسیریابی معماری شبکه' },
  { id: 'server-failover', kind: 'animation', animation: 'server-failover', nameEn: 'Server failover', nameFa: 'جابجایی خودکار سرور' },
  { id: 'cloud-migration', kind: 'animation', animation: 'cloud-migration', nameEn: 'Cloud file migration', nameFa: 'مهاجرت فایل‌ها به ابر' },
  { id: 'vpn-tunnel', kind: 'animation', animation: 'vpn-tunnel', nameEn: 'VPN data-center tunnel', nameFa: 'تونل VPN مراکز داده' },
]
