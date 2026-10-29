/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ops: {
          bg: '#0D1F23',
          card: '#132E35',
          border: '#2D4A53',
          muted: '#69818D',
          silver: '#AFB3B7',
          steel: '#5A636A',
          dark: '#081417',
          hover: '#193A43'
        }
      },
      borderRadius: {
        none: '0px',
        sm: '2px',
        md: '4px'
      }
    },
  },
  plugins: [],
}
