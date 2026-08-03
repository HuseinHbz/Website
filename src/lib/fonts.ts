/**
 * 26.33 بند ۲ — the Persian type system, split into heading and body roles.
 *
 * The target was IRANYekan for headings and IRANSans for body. Neither ships on
 * Google Fonts, neither file is in the repository, and both need a commercial
 * licence — a decision for the maintainer, not something to substitute quietly
 * (the no-fake rule). The maintainer's call was to proceed on Vazirmatn for now.
 *
 * So this is deliberately structured as TWO ROLES rather than one family:
 * `--font-persian-heading` and `--font-persian-body` are separate variables that
 * happen to resolve to the same family today. When the licensed files arrive,
 * dropping them into `public/fonts/` and swapping the two `next/font/local`
 * declarations here is the entire change — no call site moves, because the call
 * sites already talk in roles.
 *
 * `--font-persian` is kept as an alias so nothing that already uses it breaks.
 */
import { Vazirmatn } from 'next/font/google'

/**
 * Headings. Heavier weights only — a display face is never asked for body text,
 * so shipping 400 here would be dead weight in the payload.
 */
export const persianHeading = Vazirmatn({
  subsets: ['arabic', 'latin'],
  weight: ['500', '700', '800'],
  variable: '--font-persian-heading',
  display: 'swap',
  // The heading font is above the fold on every page, so it is worth preloading;
  // the body face is not, and preloading both doubles the blocking cost.
  preload: true,
})

/** Body copy, tables, forms, buttons, labels. Text weights only. */
export const persianBody = Vazirmatn({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '700'],
  variable: '--font-persian-body',
  display: 'swap',
  preload: false,
})

/**
 * Back-compat alias for `--font-persian`, which the existing `font-persian`
 * Tailwind utility and a number of components still reference. It maps to the
 * body face, which is what the majority of those call sites are.
 */
export const persianLegacy = Vazirmatn({
  subsets: ['arabic', 'latin'],
  variable: '--font-persian',
  display: 'swap',
  preload: false,
})

/** Every Persian font variable, for the root element's className. */
export const persianFontVars = [
  persianHeading.variable,
  persianBody.variable,
  persianLegacy.variable,
].join(' ')
