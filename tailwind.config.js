/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./templates/**/*.html", "./static/js/**/*.js"],
  theme: {
    extend: {
      colors: {
        // Anthropic Glasswing Dark Palette
        'anthro-cream': '#191915',        // Primary background (near-black warm)
        'anthro-sand': '#232320',          // Elevated surface
        'anthro-warm-gray': '#2E2E2A',    // Tertiary surface
        'anthro-dark': '#FFFFFF',          // Primary text (white)
        'anthro-charcoal': '#E8E8E3',     // Hover / emphasis text
        'anthro-muted': 'rgba(255,255,255,0.40)', // Muted text
        'anthro-body': 'rgba(255,255,255,0.75)',   // Body text
        'anthro-light': '#0F0F0D',        // Deepest bg (footer)

        // Surface & border aliases
        'deep-bg': '#191915',
        'deep-surface': 'rgba(255,255,255,0.04)',
        'deep-surface-hover': 'rgba(255,255,255,0.07)',
        'deep-border': 'rgba(255,255,255,0.06)',

        'accent': '#FFFFFF',
        'accent-dim': 'rgba(255,255,255,0.60)',

        'text-primary': '#FFFFFF',
        'text-secondary': 'rgba(255,255,255,0.75)',
        'text-muted': 'rgba(255,255,255,0.40)',

        // Semantic (slightly brighter for dark bg)
        'success': '#4ADE80',
        'warning': '#FBBF24',
        'error': '#F87171',
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
        'card': '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.4)',
        'elevated': '0 8px 30px rgba(0,0,0,0.5)',
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
