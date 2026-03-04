import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}', './public/**/*.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        verbatim: {
          50: 'hsl(217, 68%, 95%)',
          100: 'hsl(217, 68%, 90%)',
          200: 'hsl(217, 68%, 80%)',
          300: 'hsl(217, 68%, 70%)',
          400: 'hsl(217, 68%, 62%)',
          500: 'hsl(217, 68%, 54%)',
          600: 'hsl(217, 68%, 46%)',
          700: 'hsl(217, 68%, 38%)',
          800: 'hsl(217, 68%, 30%)',
          900: 'hsl(217, 68%, 22%)',
        },
      },
      borderRadius: {
        DEFAULT: '0.5rem',
      },
    },
  },
  plugins: [],
} satisfies Config;
