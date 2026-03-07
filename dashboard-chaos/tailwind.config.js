/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        noc: {
          bg: '#0a0e27',
          surface: '#111638',
          border: '#1e2650',
          text: '#e2e8f0',
          muted: '#8892b0',
        },
        cyan: {
          400: '#00d4ff',
          500: '#00b8d9',
        },
        emerald: {
          400: '#00ff88',
        },
        red: {
          400: '#ff4444',
          500: '#ff2222',
        },
        amber: {
          400: '#ffaa00',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backdropBlur: {
        glass: '20px',
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'scan-line': 'scanLine 3s linear infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(255, 68, 68, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(255, 68, 68, 0.6)' },
        },
        scanLine: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
    },
  },
  plugins: [],
};
