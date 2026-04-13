import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        vida: {
          bg: '#F5F0E8',
          cream: '#F0EAD6',
          warm: '#FDFBF7',
          text: '#2D2A26',
          secondary: '#7A756D',
          muted: '#B5AFA5',
        },
        sage: { light: '#E8F0D4', DEFAULT: '#C5D4A0', dark: '#6B7F3F' },
        lavender: { light: '#EDE6F5', DEFAULT: '#D4C5E8', dark: '#6B4F8A' },
        pink: { light: '#FBE8EE', DEFAULT: '#F2C4D0', dark: '#9E4F6A' },
        peach: { light: '#FDF0E3', DEFAULT: '#F5D5B8', dark: '#9E6B3A' },
        sky: { light: '#E3F1F8', DEFAULT: '#B8D8E8', dark: '#3A6F8A' },
        mint: { light: '#E0F5EC', DEFAULT: '#B8E8D4', dark: '#3A8A5F' },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        display: ['Playfair Display', 'serif'],
      },
      borderRadius: {
        'xl': '18px',
        '2xl': '24px',
        '3xl': '32px',
      },
    },
  },
  plugins: [],
};

export default config;
