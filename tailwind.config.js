/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./templates/**/*.html", "./static/js/**/*.js"],
  theme: {
    extend: {
      colors: {
        // Deep Tech Brand Colors
        'deep-bg': '#0a0a0f',
        'deep-surface': '#12121a',
        'deep-surface-hover': '#1a1a25',
        'deep-border': 'rgba(255,255,255,0.06)',

        // Accent
        'accent': '#00d4ff',
        'accent-dim': '#00a5c7',
        'accent-glow': 'rgba(0,212,255,0.15)',

        // Text
        'text-primary': '#e8e8ed',
        'text-secondary': '#8b8b9e',
        'text-muted': '#555568',

        // Semantic
        'success': '#34d399',
        'warning': '#fbbf24',
        'error': '#f87171',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
        'float': 'float 6s ease-in-out infinite',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
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
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(0,212,255,0.15)' },
          '50%': { boxShadow: '0 0 40px rgba(0,212,255,0.3)' },
        },
      },
      boxShadow: {
        'glow': '0 0 20px rgba(0,212,255,0.15)',
        'glow-lg': '0 0 40px rgba(0,212,255,0.25)',
        'glow-xl': '0 0 60px rgba(0,212,255,0.3)',
        'card': '0 4px 30px rgba(0,0,0,0.3)',
      },
    },
  },
  plugins: [],
}
