/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Roboto', 'system-ui', 'sans-serif'],
        sans:  ['Roboto', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
