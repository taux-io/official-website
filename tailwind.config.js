/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./templates/**/*.html", "./static/js/**/*.js"],
  theme: {
    extend: {
      colors: {
        // Fintech Brand Colors
        'brand-blue': '#1d4ed8', // blue-700 equivalent
        'brand-blue-light': '#2563eb', // blue-600 equivalent
        'brand-blue-dark': '#1e40af', // blue-800 equivalent
        
        // Fintech Backgrounds
        'fintech-bg': '#f8fafc', // slate-50
        'fintech-dark': '#0f172a', // slate-900
        
        // Semantic
        'success': '#10b981', // emerald-500
        'warning': '#f59e0b', // amber-500
        'error': '#ef4444',   // red-500
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'], // Elegant headings
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
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      }
    },
  },
  plugins: [],
}
