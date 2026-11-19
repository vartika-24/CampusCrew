import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8',
          500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81', 950: '#1e1b4b',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      boxShadow: { card: '0 1px 2px rgba(15,23,42,.06), 0 4px 16px rgba(15,23,42,.06)' },
      keyframes: {
        sos: { '0%,100%': { boxShadow: '0 0 0 0 rgba(220,38,38,.55)' }, '50%': { boxShadow: '0 0 0 14px rgba(220,38,38,0)' } },
        slideup: { from: { transform: 'translateY(12px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
      },
      animation: { sos: 'sos 1.4s infinite', slideup: 'slideup .25s ease-out' },
    },
  },
  plugins: [],
};
export default config;
