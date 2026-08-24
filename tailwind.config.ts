import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        /** Azul eléctrico de marca. `brand.DEFAULT` === #0066FF */
        brand: {
          DEFAULT: '#0066FF',
          50: '#EBF3FF',
          100: '#D6E6FF',
          200: '#ADCCFF',
          300: '#84B3FF',
          400: '#3D8CFF',
          500: '#0066FF',
          600: '#0052CC',
          700: '#0043A8',
          800: '#003585',
          900: '#002561',
        },
        ink: {
          DEFAULT: '#111827',
          soft: '#4B5563',
          muted: '#9CA3AF',
        },
      },
      fontFamily: {
        sans: ['var(--font-jakarta)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(17 24 39 / 0.04), 0 12px 32px -12px rgb(17 24 39 / 0.12)',
        brand: '0 10px 30px -10px rgb(0 102 255 / 0.55)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 2.4s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
