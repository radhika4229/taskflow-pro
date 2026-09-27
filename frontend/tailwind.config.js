/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FDFBF7',
          100: '#FAF7F2',
          200: '#F4EFEA',
          300: '#EBE4DC',
          400: '#DDD4C8',
        },
        ink: {
          900: '#1A1A1A',
          800: '#2A2A2A',
          700: '#3D3A37',
          600: '#54504C',
          500: '#716C66',
          400: '#948E87',
        },
        terracotta: {
          DEFAULT: '#D97748',
          hover: '#C46436',
          active: '#B25429',
          light: '#FDF3EE',
          border: '#F4D3C2',
        },
        warmgray: {
          border: '#E5DFD7',
          surface: '#FDFBF9',
          muted: '#8C857B',
        },
        dark: {
          bg: '#0B0D13',
          surface: '#121620',
          card: '#181E2B',
          cardHover: '#1F2738',
          border: '#252F42',
          muted: '#8E9BAE',
        },
        neon: {
          teal: '#14B8A6',
          cyan: '#06B6D4',
          orange: '#F97316',
          red: '#EF4444',
          green: '#10B981',
        },
        badge: {
          blocked: '#9B2C2C',
          blockedBg: '#FEE8E8',
          blockedBorder: '#F8C8C8',
          ready: '#226743',
          readyBg: '#E3F5E9',
          readyBorder: '#C5E9CE',
          done: '#5F5B56',
          doneBg: '#EFEBE4',
          doneBorder: '#E0D9CF',
        }
      },
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
        md: '8px',
        lg: '10px',
        xl: '12px',
      },
      boxShadow: {
        subtle: '0 1px 3px rgba(26, 26, 26, 0.05)',
        card: '0 1px 4px rgba(26, 26, 26, 0.06), 0 2px 8px rgba(26, 26, 26, 0.03)',
        drawer: '-4px 0 24px rgba(26, 26, 26, 0.08)',
        'neon-red': '0 0 16px rgba(239, 68, 68, 0.45), inset 0 0 8px rgba(239, 68, 68, 0.15)',
        'neon-green': '0 0 16px rgba(16, 185, 129, 0.45), inset 0 0 8px rgba(16, 185, 129, 0.15)',
        'neon-teal': '0 0 16px rgba(20, 184, 166, 0.4), inset 0 0 8px rgba(20, 184, 166, 0.15)',
        'neon-orange': '0 0 16px rgba(249, 115, 22, 0.4), inset 0 0 8px rgba(249, 115, 22, 0.15)',
      }
    },
  },
  plugins: [],
}
