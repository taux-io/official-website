/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,js}"],
  theme: {
    extend: {
      colors: {
        'google-blue': '#4285F4',
        'google-red': '#EA4335',
        'google-yellow': '#FBBC04',
        'google-green': '#34A853',
        'taux-bg-light': '#F8F9FA',
        'taux-bg-dark': '#05050A', // Deep Void
        'taux-card-light': '#FFFFFF',
        'taux-card-dark': '#0A0A0F', // Slightly lighter void
        'tech-blue': '#00F0FF', // Cyan Neon
        'tech-purple': '#7000FF', // Electric Purple
        'tech-pink': '#FF00AA', // Deep Pink
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
