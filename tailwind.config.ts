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
        // Cool Dark Finance Palette
        warmBg: {
          primary: '#0B0D11',
          secondary: '#12151A',
          tertiary: '#1A1E26',
          hover: '#232830',
        },
        warmText: {
          primary: '#F0F2F5',
          secondary: '#8B95A5',
          tertiary: '#5A6474',
          disabled: '#3D4654',
          muted: '#2A3040',
        },
        warmAccent: {
          primary: '#3B82F6',
          hover: '#2563EB',
          pressed: '#1D4ED8',
        },
        warmData: {
          expense: '#F87171',
          income: '#34D399',
          investment: '#A78BFA',
          savings: '#38BDF8',
          recurring: '#3B82F6',
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
        sheetSlideUp: {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        fadeSlideIn: {
          from: { opacity: '0', transform: 'translateX(8px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        slideInRight: 'slideInRight 250ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
        slideInLeft: 'slideInLeft 250ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
        cardEnter: 'cardEnter 200ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        barFill: 'barFill 600ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        slideInUp: 'slideInUp 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
        sheetSlideUp: 'sheetSlideUp 300ms cubic-bezier(0.32, 0.72, 0, 1) forwards',
        fadeSlideIn: 'fadeSlideIn 300ms ease-out forwards',
      },
    },
  },
  plugins: [],
}
export default config
