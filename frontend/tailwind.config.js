export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Inter', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#eef0ff',
          100: '#e0e4ff',
          200: '#c7ceff',
          300: '#a5aefc',
          400: '#8189f8',
          500: '#5b6af0',
          600: '#4a59e0',
          700: '#3b46c8',
          800: '#323ba3',
          900: '#2d3582',
        },
      },
      borderRadius: { '2xl': '1rem', '3xl': '1.5rem' },
    },
  },
  plugins: [],
}
