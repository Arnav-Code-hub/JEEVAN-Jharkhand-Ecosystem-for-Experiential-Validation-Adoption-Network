/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        jeevan: {
          primary: '#0b6623',
          'primary-hover': '#084d1a',
          secondary: '#e67e22',
          success: '#2ecc71',
          warning: '#f1c40f',
          danger: '#e74c3c',
          info: '#3498db',
          surface: '#ffffff',
          background: '#f4f6f9',
          border: '#dcdde1',
          text: '#2c3e50',
          muted: '#7f8c8d'
        }
      }
    },
  },
  plugins: [],
}
