import { createNavigation } from 'next-intl/navigation'

export const locales = ['fa', 'en'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'fa'

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation({
    locales,
    defaultLocale,
    localePrefix: 'always',
  })
