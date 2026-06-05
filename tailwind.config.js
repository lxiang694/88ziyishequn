/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#2d7a3a',
          light: '#e8f5e9',
          dark: '#1a4a24',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans TC"', '"Microsoft JhengHei"', '"PingFang TC"', 'sans-serif'],
      },
      screens: {
        'xs': '380px',
      },
    },
  },
  plugins: [],
}
