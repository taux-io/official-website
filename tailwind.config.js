/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./templates/**/*.html", "./static/js/**/*.js"],
  theme: {
    extend: {
      colors: {
        // Jules Google-style Canvas Palette
        'jules-canvas': '#fbfbfe',         // Sterile Canvas White background
        'jules-card': '#fbfbfe',           // Card surface
        'jules-violet': '#735ce5',         // Signal Violet
        'jules-violet-deep': '#715cd7',    // Signal Violet Deep
        'jules-ink': '#141316',            // Primary Ink text
        'jules-body': '#676573',           // Body text
        'jules-muted': '#9792af',          // Muted Gray
        'jules-soft': '#fbfbfe',           // Background UI inputs

        // Surface & border aliases for compatibility
        'taux-bg': '#fbfbfe',
        'taux-border': 'rgba(113, 92, 215, 0.15)',
        'tech-cyan': '#735ce5',
        'tech-purple': '#715cd7',

        // Semantic
        'success': '#10B981',
        'warning': '#F59E0B',
        'error': '#EF4444',
      },
      fontFamily: {
        sans: ['"Google Sans"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Google Sans"', 'Inter', 'system-ui', 'sans-serif'],
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
