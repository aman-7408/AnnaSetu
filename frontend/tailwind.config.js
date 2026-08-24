/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          light: '#4ade80',
          DEFAULT: '#16a34a',
          dark: '#15803d',
        }
      }
    },
  },
  plugins: [],
}
