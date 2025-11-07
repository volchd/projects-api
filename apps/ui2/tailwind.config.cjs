const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        brand: {
          DEFAULT: '#6366f1',
          foreground: '#1c1f3b',
          soft: '#eef2ff',
        },
        dark: {
          DEFAULT: '#0f172a',
          accent: '#1e293b',
          softer: '#111a2e',
        },
      },
      boxShadow: {
        card: '0 10px 25px rgba(15, 23, 42, 0.35)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.08)',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
