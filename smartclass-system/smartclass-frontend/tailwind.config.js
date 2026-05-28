/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'serif'],
        sans:  ['"Inter Tight"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
