export const SITE = {
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://habibazar.ir',
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'https://api.habibazar.ir',
  name: 'HBZ',
  nameFull: 'Husein Habibazar',
  nameFa: 'حسین حبیب‌آذر',
  owner: 'Husein Habibazar',
  ownerFa: 'حسین حبیب‌آذر',
  brandInitials: 'HBZ',
  tagline: 'Infrastructure Architect | Network & Security Consultant',
  mission: 'Designing, Securing and Automating Modern Infrastructure',
  title: {
    fa: 'حسین حبیب‌آذر — معمار زیرساخت و مشاور امنیت شبکه',
    en: 'Husein Habibazar (HBZ) — Infrastructure Architect & Network Security Consultant',
  },
  description: {
    fa: 'معمار زیرساخت ارشد و مشاور امنیت شبکه برای سازمان‌های بزرگ، رستوران‌ها، هلدینگ‌ها و شرکت‌های صنعتی',
    en: 'Infrastructure Architect & Network Security Consultant — Designing, Securing and Automating Modern Enterprise Infrastructure',
  },
  locale: {
    default: 'fa' as const,
    supported: ['fa', 'en'] as const,
  },
  social: {
    linkedin: 'https://linkedin.com/in/habibazar',
  },
  contact: {
    email: 'info@habibazar.ir',
  },
} as const
