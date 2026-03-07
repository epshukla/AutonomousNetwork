/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        noc: {
          bg: '#0a0e27',
          surface: '#111638',
          card: '#161b4a',
          border: '#1e2560',
          cyan: '#00d4ff',
          green: '#00ff88',
          red: '#ff4444',
          amber: '#ffaa00',
          purple: '#a855f7',
          text: '#e2e8f0',
          muted: '#94a3b8',
        },
      },
      fontFamily: {
        inter: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'data-flow': 'dataFlow 1.5s linear infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'scan-line': 'scanLine 3s linear infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '50%': { opacity: '0.7', filter: 'brightness(1.3)' },
        },
        dataFlow: {
          '0%': { strokeDashoffset: '20' },
          '100%': { strokeDashoffset: '0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scanLine: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'noc-glow': '0 0 20px rgba(0, 212, 255, 0.15)',
        'noc-glow-lg': '0 0 40px rgba(0, 212, 255, 0.2)',
        'green-glow': '0 0 20px rgba(0, 255, 136, 0.2)',
        'red-glow': '0 0 20px rgba(255, 68, 68, 0.2)',
        'amber-glow': '0 0 20px rgba(255, 170, 0, 0.2)',
      },
    },
  },
  plugins: [],
};
