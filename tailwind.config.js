/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}'],
  theme: {
    extend: {
      colors: {
        tower: {
          bg: '#0f172a',
          surface: '#1e293b',
          card: '#243044',
          border: '#334155',
          accent: '#3b82f6',
          'accent-hover': '#2563eb'
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif']
      }
    }
  },
  plugins: []
}
