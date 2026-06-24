export const SITE = {
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://habibazar.ir',
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'https://api.habibazar.ir',
  name: 'Habibazar',
  nameFa: 'حبیب‌آذر',
  owner: 'Hossein Habibazar',
  ownerFa: 'حسین حبیب‌آذر',
  title: {
    fa: 'حسین حبیب‌آذر — مشاور زیرساخت سازمانی',
    en: 'Hossein Habibazar — Enterprise Infrastructure Consultant',
  },
  description: {
    fa: 'مشاور ارشد زیرساخت سازمانی، ابر، امنیت و شبکه برای کسب‌وکارهای بزرگ',
    en: 'Senior enterprise infrastructure consultant for cloud, security, and networking at scale',
  },
  locale: {
    default: 'fa' as const,
    supported: ['fa', 'en'] as const,
  },
  social: {
    linkedin: 'https://linkedin.com/in/habibazar',
  },
} as const
