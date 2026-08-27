/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'map-bg': '#F4F6FF',
        charcoal: {
          DEFAULT: '#172044',
          light: '#2A3560'
        },
        cobalt: {
          DEFAULT: '#6258ED',
          hover: '#5147DB',
          light: '#EEEDFF'
        },
        green: {
          fresh: '#55DFBD'
        },
        vermillion: {
          DEFAULT: '#FF7397',
          light: '#FFF0F4'
        },
        muted: {
          DEFAULT: '#64709A',
          border: '#DBE1F5'
        }
      },
      fontFamily: {
        sans: ['Space Grotesk', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['Space Grotesk', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'ui-monospace', 'SFMono-Regular', 'monospace']
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
