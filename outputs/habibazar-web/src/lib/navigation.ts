export interface NavItem {
  key: string
  labelFa: string
  labelEn: string
  href: string
  external?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  {
    key: 'home',
    labelFa: 'خانه',
    labelEn: 'Home',
    href: '/',
  },
  {
    key: 'consultation',
    labelFa: 'مشاوره',
    labelEn: 'Consultation',
    href: '/consultation',
  },
  {
    key: 'introCall',
    labelFa: 'تماس معرفی',
    labelEn: 'Intro Call',
    href: '/consultation/intro-call',
  },
]
