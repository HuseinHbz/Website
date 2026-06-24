import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#07070d',
        surface: '#0d0d17',
        'surface-2': '#12121f',
        border: '#1a1a2e',
        'border-subtle': '#141428',
        accent: {
          DEFAULT: '#6366f1',
          hover: '#818cf8',
          muted: 'rgba(99,102,241,0.15)',
        },
        cyan: {
          DEFAULT: '#06b6d4',
          muted: 'rgba(6,182,212,0.15)',
        },
        emerald: {
          DEFAULT: '#10b981',
          muted: 'rgba(16,185,129,0.15)',
        },
        text: {
          primary: '#f1f5f9',
          secondary: '#94a3b8',
          muted: '#475569',
          faint: '#2d3748',
        },
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        persian: ['var(--font-vazirmatn)', 'Tahoma', 'Arial', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'Consolas', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
        'slide-up': 'slideUp 0.6s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out 2s infinite',
        'marquee': 'marquee 30s linear infinite',
        'marquee-reverse': 'marqueeReverse 30s linear infinite',
        'network-pulse': 'networkPulse 3s ease-in-out infinite',
        'draw-line': 'drawLine 2s ease-out forwards',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'slide-in-right': 'slideInRight 0.5s ease-out',
        'count-up': 'countUp 0.6s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(99, 102, 241, 0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(99, 102, 241, 0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        marqueeReverse: {
          '0%': { transform: 'translateX(-50%)' },
          '100%': { transform: 'translateX(0)' },
        },
        networkPulse: {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.15)' },
        },
        drawLine: {
          '0%': { strokeDashoffset: '1000' },
          '100%': { strokeDashoffset: '0' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(99,102,241,0.3)' },
          '50%': { boxShadow: '0 0 24px rgba(99,102,241,0.7), 0 0 48px rgba(99,102,241,0.3)' },
        },
        countUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'accent-gradient': 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
        'cyan-gradient': 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
        'dark-gradient': 'linear-gradient(180deg, #07070d 0%, #0d0d17 100%)',
        'hero-radial': 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(99,102,241,0.18) 0%, transparent 70%)',
        'grid-pattern': "linear-gradient(rgba(99,102,241,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.06) 1px, transparent 1px)",
      },
      borderColor: {
        DEFAULT: '#1a1a2e',
      },
      screens: {
        xs: '375px',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}

export default config
