/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./templates/**/*.html", "./static/js/**/*.js"],
  theme: {
    extend: {
      colors: {
        // Anthropic-inspired Warm Palette
        'anthro-cream': '#F5F2ED',
        'anthro-sand': '#EBE7E0',
        'anthro-warm-gray': '#D4CFC7',
        'anthro-dark': '#191918',
        'anthro-charcoal': '#2A2A29',
        'anthro-muted': '#6B6B6B',
        'anthro-body': '#3D3D3C',
        'anthro-light': '#FAF9F7',

        // Legacy aliases for backward compatibility during migration
        'deep-bg': '#F5F2ED',
        'deep-surface': '#FFFFFF',
        'deep-surface-hover': '#FAF9F7',
        'deep-border': 'rgba(0,0,0,0.08)',

        'accent': '#191918',
        'accent-dim': '#2A2A29',

        'text-primary': '#191918',
        'text-secondary': '#3D3D3C',
        'text-muted': '#6B6B6B',

        // Semantic
        'success': '#2D6A4F',
        'warning': '#B8860B',
        'error': '#C1292E',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Libre Baskerville"', 'Georgia', 'Times New Roman', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08)',
        'elevated': '0 8px 30px rgba(0,0,0,0.08)',
      },
      fontSize: {
        'display-lg': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-md': ['2.75rem', { lineHeight: '1.15', letterSpacing: '-0.01em' }],
        'display-sm': ['2rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
      },
      maxWidth: {
        'prose': '42rem',
        'content': '64rem',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
    },
  },
  plugins: [],
}
