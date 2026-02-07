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
    extend: {},
  },
  plugins: [],
}