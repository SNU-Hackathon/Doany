
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  darkMode: 'class', // 다크 모드를 class 기반으로 설정
  theme: {
    extend: {
      colors: {
        navy: '#1E3A8A',
        sunny: '#FEF3C7',
        lavender: '#8B5CF6',
      }
    },
  },
  plugins: [],
};
