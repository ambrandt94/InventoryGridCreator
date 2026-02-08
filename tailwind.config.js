/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    'bg-emerald-500/50',
    'border-emerald-400',
    'bg-red-500/50',
    'border-red-400',
  ],
  theme: {
    extend: {
      colors: {
        primary: { // Replaces indigo for primary actions
          DEFAULT: '#d97706', // amber-700
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        accent: '#22c55e', // Emerald for subtle accents/success (can be adjusted)
        background: '#1c1917', // Stone-900
        surface: '#292524',    // Stone-800
        'on-background': '#f5f5f4', // Stone-100 for text on dark background
        'on-surface': '#d6d3d1',   // Stone-200 for text on dark surface
      },
      fontFamily: {
        heading: ['"Cinzel Decorative"', 'serif'],
        body: ['Lora', 'serif'],
      },
    },
  },
  plugins: [],
}