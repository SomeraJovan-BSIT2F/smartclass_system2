/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Both aliases map to Roboto so `font-serif` (used for headings
        // across the app) and `font-sans` render the same clean face.
        serif: ['Roboto', 'system-ui', 'sans-serif'],
        sans:  ['Roboto', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
