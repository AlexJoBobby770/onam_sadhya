/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        onam: {
          emerald: '#064E3B',
          green: '#047857',
          gold: '#F59E0B',
          amber: '#D97706',
          cream: '#FEF3C7',
          maroon: '#991B1B',
          kasavu: '#FFFBEB'
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
