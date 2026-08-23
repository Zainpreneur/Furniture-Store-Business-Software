/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fbf7f2',
          100: '#f4ebe0',
          200: '#e6d2b8',
          300: '#d6b48b',
          400: '#c4935e',
          500: '#a8763f',
          600: '#8a5e32',
          700: '#6c492a',
          800: '#553a25',
          900: '#473121',
        },
      },
    },
  },
  plugins: [],
};
