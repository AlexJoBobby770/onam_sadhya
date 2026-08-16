/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        onam: {
          // app shell — banana leaf greens shading to near-black
          black: '#0A0F0B',
          deep: '#111A13',
          card: '#16211A',
          raised: '#1A251E',
          line: '#24332A',

          // pookalam accents
          leaf: '#66B032',
          gold: '#FFDB49',
          'gold-deep': '#C9962B',
          orange: '#FF8C00',
          red: '#B31B1B',

          // kasavu cream — used for the pass and light text
          kasavu: '#F7F2E4',
          'kasavu-dim': '#E4DAC2',
          ink: '#16120A',
          'ink-soft': '#5C5443',

          // muted text on the dark shell
          muted: '#8DA294',
          'muted-dim': '#6C8073',
          'muted-faint': '#56675C',
        }
      },
      fontFamily: {
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'Georgia', 'serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'monospace'],
        malayalam: ['"Noto Sans Malayalam"', '"DM Sans"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
