/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Outfit"', 'sans-serif'],
      },
      colors: {
        glass: {
          100: 'rgba(255, 255, 255, 0.1)',
          200: 'rgba(255, 255, 255, 0.2)',
          300: 'rgba(255, 255, 255, 0.3)',
          900: 'rgba(0, 0, 0, 0.8)',
        }
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'slow-spin': 'spin 3s linear infinite',
      }
    },
  },
  plugins: [],
}
