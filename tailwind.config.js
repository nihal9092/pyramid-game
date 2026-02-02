/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        rank: {
          s: '#FFD700',
          a: '#00FFFF',
          b: '#7B68EE',
          c: '#32CD32',
          d: '#FFA500',
          f: '#FF0000',
        },
        neon: {
          pink: '#FF10F0',
          blue: '#00F0FF',
          green: '#10FF00',
          red: '#FF003C',
          purple: '#BF00FF',
        }
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite alternate',
        'bounce-slow': 'bounce 3s infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        glow: {
          'from': {
            textShadow: '0 0 10px #fff, 0 0 20px #fff, 0 0 30px #e60073, 0 0 40px #e60073',
          },
          'to': {
            textShadow: '0 0 20px #fff, 0 0 30px #ff4da6, 0 0 40px #ff4da6, 0 0 50px #ff4da6',
          }
        }
      }
    },
  },
  plugins: [],
}
