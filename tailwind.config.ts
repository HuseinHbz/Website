import type { Config } from 'tailwindcss'

/**
 * HBZ Enterprise Design System — Tailwind Configuration
 * All values reference CSS custom properties from globals.css.
 * Never hardcode colors here — always use var(--token-name).
 */

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],

  // Theme switching via data-theme attribute
  darkMode: ['class', '[data-theme="dark"]'],

  theme: {
    // ── Breakpoints ──────────────────────────────────────────
    screens: {
      xs:    '375px',
      sm:    '640px',
      md:    '768px',
      lg:    '1024px',
      xl:    '1280px',
      '2xl': '1536px',
      '3xl': '1920px',
    },

    extend: {
      // ── Colors (all from CSS custom properties) ───────────
      colors: {
        // Background
        background:  'var(--color-bg-base)',
        surface:     'var(--color-bg-surface)',
        'surface-2': 'var(--color-bg-elevated)',
        sunken:      'var(--color-bg-sunken)',
        overlay:     'var(--color-bg-overlay)',
        glass:       'var(--color-bg-glass)',

        // Text
        text: {
          primary:   'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary:  'var(--color-text-tertiary)',
          disabled:  'var(--color-text-disabled)',
          inverse:   'var(--color-text-inverse)',
          link:      'var(--color-text-link)',
        },

        // Border
        border: {
          DEFAULT: 'var(--color-border-default)',
          subtle:  'var(--color-border-subtle)',
          strong:  'var(--color-border-strong)',
          focus:   'var(--color-border-focus)',
        },

        // Brand (Indigo)
        brand: {
          DEFAULT: 'var(--color-brand)',
          hover:   'var(--color-brand-hover)',
          active:  'var(--color-brand-active)',
          muted:   'var(--color-brand-muted)',
          subtle:  'var(--color-brand-subtle)',
        },

        // Accent (Cyan)
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover:   'var(--color-accent-hover)',
          muted:   'var(--color-accent-muted)',
        },

        // Semantic
        success: {
          DEFAULT: 'var(--color-success)',
          muted:   'var(--color-success-muted)',
          text:    'var(--color-success-text)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          muted:   'var(--color-warning-muted)',
          text:    'var(--color-warning-text)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          muted:   'var(--color-danger-muted)',
          text:    'var(--color-danger-text)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          muted:   'var(--color-info-muted)',
          text:    'var(--color-info-text)',
        },

        // Charts
        chart: {
          1: 'var(--color-chart-1)',
          2: 'var(--color-chart-2)',
          3: 'var(--color-chart-3)',
          4: 'var(--color-chart-4)',
          5: 'var(--color-chart-5)',
          6: 'var(--color-chart-6)',
          7: 'var(--color-chart-7)',
          8: 'var(--color-chart-8)',
        },
      },

      // ── Typography ────────────────────────────────────────
      fontFamily: {
        sans:    ['var(--font-sans)',    'system-ui', 'sans-serif'],
        // 26.33 بند۲ — two roles, not one family: headings and body are separate
        // tokens so the licensed IRANYekan/IRANSans can be swapped in per role
        // without touching a single call site. `persian` stays as the alias.
        persian:         ['var(--font-persian)',         'Tahoma', 'Arial', 'sans-serif'],
        'persian-head':  ['var(--font-persian-heading)', 'var(--font-persian)', 'Tahoma', 'Arial', 'sans-serif'],
        'persian-body':  ['var(--font-persian-body)',    'var(--font-persian)', 'Tahoma', 'Arial', 'sans-serif'],
        mono:    ['var(--font-mono)',    'Consolas', 'monospace'],
      },

      fontSize: {
        '4xs':    ['0.5625rem', { lineHeight: '0.75rem' }],
        '3xs':    ['0.625rem',  { lineHeight: '0.875rem' }],
        '2xs':    ['0.6875rem', { lineHeight: '1rem' }],
        xs:       ['0.75rem',   { lineHeight: '1.125rem' }],
        sm:       ['0.8125rem', { lineHeight: '1.25rem' }],
        base:     ['0.9375rem', { lineHeight: '1.55rem' }],
        md:       ['1rem',      { lineHeight: '1.65rem' }],
        lg:       ['1.125rem',  { lineHeight: '1.75rem' }],
        xl:       ['1.25rem',   { lineHeight: '1.75rem' }],
        '2xl':    ['1.5rem',    { lineHeight: '2rem' }],
        '3xl':    ['1.875rem',  { lineHeight: '2.25rem' }],
        '4xl':    ['2.25rem',   { lineHeight: '2.5rem' }],
        '5xl':    ['3rem',      { lineHeight: '1.15' }],
        '6xl':    ['3.75rem',   { lineHeight: '1.1' }],
        '7xl':    ['4.5rem',    { lineHeight: '1.08' }],
        '8xl':    ['6rem',      { lineHeight: '1.05' }],
        '9xl':    ['8rem',      { lineHeight: '1' }],
        display:  ['clamp(2.5rem,6vw,4.5rem)', { lineHeight: '1.08', letterSpacing: '-0.03em' }],
      },

      // ── Border Radius ──────────────────────────────────────
      borderRadius: {
        none:  'var(--radius-xs, 0px)',
        xs:    'var(--radius-xs)',
        sm:    'var(--radius-sm)',
        DEFAULT:'var(--radius-md)',
        md:    'var(--radius-md)',
        lg:    'var(--radius-lg)',
        xl:    'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
        full:  'var(--radius-full)',
      },

      // ── Shadows ────────────────────────────────────────────
      boxShadow: {
        xs:       'var(--shadow-xs)',
        sm:       'var(--shadow-sm)',
        DEFAULT:  'var(--shadow-md)',
        md:       'var(--shadow-md)',
        lg:       'var(--shadow-lg)',
        xl:       'var(--shadow-xl)',
        '2xl':    'var(--shadow-2xl)',
        brand:    'var(--shadow-brand)',
        'brand-lg':'var(--shadow-brand-lg)',
        glow:     'var(--shadow-glow)',
        cyan:     'var(--shadow-cyan)',
        inner:    'inset 0 1px 2px rgba(0,0,0,0.4)',
        none:     'none',
      },

      // ── Z-Index ────────────────────────────────────────────
      zIndex: {
        dropdown: '100',
        sticky:   '200',
        overlay:  '300',
        modal:    '400',
        popover:  '500',
        toast:    '600',
        tooltip:  '700',
        command:  '800',
      },

      // ── Backdrop Blur ──────────────────────────────────────
      backdropBlur: {
        xs:    'var(--blur-xs)',
        sm:    'var(--blur-sm)',
        md:    'var(--blur-md)',
        lg:    'var(--blur-lg)',
        xl:    'var(--blur-xl)',
        '2xl': 'var(--blur-2xl)',
        glass: 'var(--blur-glass)',
      },

      // ── Transition Timing ─────────────────────────────────
      transitionDuration: {
        fast:     'var(--motion-fast)',
        normal:   'var(--motion-normal)',
        moderate: 'var(--motion-moderate)',
        slow:     'var(--motion-slow)',
        reveal:   'var(--motion-reveal)',
      },

      transitionTimingFunction: {
        spring:     'var(--motion-spring)',
        'ease-out': 'var(--motion-ease-out)',
        'ease-in':  'var(--motion-ease-in)',
        linear:     'linear',
      },

      // ── Animations ─────────────────────────────────────────
      animation: {
        'fade-in':        'fadeIn 0.4s var(--motion-spring) both',
        'slide-up':       'slideUp 0.5s var(--motion-spring) both',
        'slide-down':     'slideDown 0.3s var(--motion-spring) both',
        'slide-in-right': 'slideInRight 0.4s var(--motion-spring) both',
        'slide-in-left':  'slideInLeft 0.4s var(--motion-spring) both',
        'scale-in':       'scaleIn 0.3s var(--motion-spring) both',
        'pulse-glow':     'pulse-glow 2s ease-in-out infinite',
        'spin-slow':      'spin-slow 3s linear infinite',
        'float':          'float 6s ease-in-out infinite',
        'float-delayed':  'float 6s ease-in-out 2s infinite',
        'marquee':        'marquee 30s linear infinite',
        'marquee-reverse':'marqueeReverse 30s linear infinite',
        'network-pulse':  'networkPulse 3s ease-in-out infinite',
        'draw-line':      'drawLine 2s ease-out forwards',
        'count-up':       'countUp 0.6s var(--motion-spring) both',
        'shimmer':        'shimmer 2s linear infinite',
        'skeleton':       'shimmer-bg 1.5s ease-in-out infinite',
        'ripple':         'ripple 0.6s var(--motion-ease-out) forwards',
      },

      keyframes: {
        fadeIn:       { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp:      { from: { opacity: '0', transform: 'translateY(24px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideDown:    { from: { opacity: '0', transform: 'translateY(-12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideInRight: { from: { opacity: '0', transform: 'translateX(24px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        slideInLeft:  { from: { opacity: '0', transform: 'translateX(-24px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        scaleIn:      { from: { opacity: '0', transform: 'scale(0.95)' }, to: { opacity: '1', transform: 'scale(1)' } },
        float:        { '0%,100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-12px)' } },
        'spin-slow':  { to: { transform: 'rotate(360deg)' } },
        marquee:      { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
        marqueeReverse: { '0%': { transform: 'translateX(-50%)' }, '100%': { transform: 'translateX(0)' } },
        networkPulse: { '0%,100%': { opacity: '0.4', transform: 'scale(1)' }, '50%': { opacity: '1', transform: 'scale(1.15)' } },
        drawLine:     { from: { strokeDashoffset: '1000' }, to: { strokeDashoffset: '0' } },
        countUp:      { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'pulse-glow': { '0%,100%': { boxShadow: '0 0 8px rgba(99,102,241,0.4)' }, '50%': { boxShadow: '0 0 20px rgba(99,102,241,0.7)' } },
        shimmer:      { '0%': { backgroundPosition: '200% center' }, '100%': { backgroundPosition: '-200% center' } },
        'shimmer-bg': { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        ripple:       { '0%': { transform: 'scale(0)', opacity: '1' }, '100%': { transform: 'scale(4)', opacity: '0' } },
      },

      // ── Background Images ──────────────────────────────────
      backgroundImage: {
        'gradient-radial':   'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':    'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'brand-gradient':    'linear-gradient(135deg, var(--color-brand), var(--color-brand-hover))',
        'accent-gradient':   'linear-gradient(135deg, var(--color-accent), var(--color-brand))',
        'dark-gradient':     'linear-gradient(180deg, var(--color-bg-base) 0%, var(--color-bg-surface) 100%)',
        'hero-radial':       'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(99,102,241,0.18) 0%, transparent 70%)',
        'grid-pattern':      'linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)',
      },

      // ── Container sizes ────────────────────────────────────
      maxWidth: {
        prose:  '65ch',
        narrow: '48rem',
        site:   '80rem',
        wide:   '90rem',
      },

      // ── Spacing extras ─────────────────────────────────────
      spacing: {
        '4.5': '1.125rem',
        '5.5': '1.375rem',
        '13':  '3.25rem',
        '15':  '3.75rem',
        '17':  '4.25rem',
        '18':  '4.5rem',
        '22':  '5.5rem',
        '26':  '6.5rem',
        '30':  '7.5rem',
      },
    },
  },

  plugins: [],
}

export default config
