/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'map-bg': '#F7F5EF',
        charcoal: {
          DEFAULT: '#17191B',
          light: '#2D3135'
        },
        cobalt: {
          DEFAULT: '#2457D6',
          hover: '#1D46B0',
          light: '#EBF0FC'
        },
        green: {
          fresh: '#48A868'
        },
        vermillion: {
          DEFAULT: '#EF6245',
          light: '#FDECE8'
        },
        muted: {
          DEFAULT: '#72767A',
          border: '#D8D8D2'
        }
      },
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
        heading: ['Manrope', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace']
      },
      borderRadius: {
        'sm': '4px',
        'DEFAULT': '6px',
        'md': '8px',
        'lg': '10px'
      }
    },
  },
  plugins: [],
}
