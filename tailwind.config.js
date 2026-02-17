/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./templates/**/*.html", "./static/js/**/*.js"],
  darkMode: 'class', // Enable class-based dark mode (we'll default to dark mostly)
  theme: {
    extend: {
      colors: {
        // Brand Colors
        'taux-bg': '#030305',      // Deepest Void
        'taux-card': '#0A0A12',    // Dark Panel
        'taux-border': '#1F1F2E',  // Subtle Border
        
        // Tech Accents
        'tech-cyan': '#00F0FF',    // Primary Neon
        'tech-purple': '#7000FF',  // Secondary Neon
        'tech-pink': '#FF003C',    // Accent
        'tech-blue': '#4285F4',    // Google Blue (Legacy/Trust)
        
        // Semantic
        'success': '#00FF94',
        'warning': '#FFCC00',
        'error': '#FF003C',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'], // Tech feel
        display: ['Outfit', 'Space Grotesk', 'sans-serif'], // Headlines
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-glow': 'conic-gradient(from 180deg at 50% 50%, #00F0FF33 0deg, #7000FF33 180deg, #00F0FF33 360deg)',
      },
      animation: {
        'spin-slow': 'spin 8s linear infinite',
        'pulse-glow': 'pulse-glow 3s infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '0.6', filter: 'brightness(1)' },
          '50%': { opacity: '1', filter: 'brightness(1.5)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      }
    },
  },
  plugins: [],
}
