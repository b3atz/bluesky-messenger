/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // Specific paths for your project structure
    "./frontend/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./frontend/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./frontend/contexts/**/*.{js,ts,jsx,tsx,mdx}",
    "./frontend/utils/**/*.{js,ts,jsx,tsx,mdx}",
    "./frontend/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./frontend/**/*.{js,ts,jsx,tsx,mdx}",

    // Exclude node_modules explicitly
    "!**/node_modules/**",
    "!**/.next/**"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}