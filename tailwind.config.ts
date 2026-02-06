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
        // Warm Finance Palette
        warmBg: {
          primary: '#1A1714',
          secondary: '#231D19',
          tertiary: '#2A2420',
          hover: '#332C27',
        },
        warmText: {
          primary: '#FAFAF8',
          secondary: '#B8A394',
          tertiary: '#8A7E76',
          disabled: '#6B5E54',
          muted: '#4A3F38',
        },
        warmAccent: {
          primary: '#D4845A',
          hover: '#E09568',
          pressed: '#B8704C',
        },
        warmData: {
          expense: '#EF6C4D',
          income: '#66BB6A',
          investment: '#FFB74D',
          savings: '#4DB6AC',
          recurring: '#D4845A',
        },
      },
      keyframes: {
        slideInRight: {
          from: { transform: 'translateX(20px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        slideInLeft: {
          from: { transform: 'translateX(-20px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        cardEnter: {
          from: {
            transform: 'translateY(-8px) scale(0.98)',
            opacity: '0',
          },
          to: {
            transform: 'translateY(0) scale(1)',
            opacity: '1',
          },
        },
        barFill: {
          from: { width: '0' },
          to: { width: '100%' },
        },
        slideInUp: {
          from: { transform: 'translateY(12px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        slideInRight: 'slideInRight 250ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
        slideInLeft: 'slideInLeft 250ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
        cardEnter: 'cardEnter 200ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        barFill: 'barFill 600ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        slideInUp: 'slideInUp 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
      },
    },
  },
  plugins: [],
}
export default config
