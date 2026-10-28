const c = (v) => `rgb(var(--${v}) / <alpha-value>)`;
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { bg: c('bg'), surface: c('surface'), raised: c('raised'), line: c('line'), ink: c('text'), muted: c('muted'), brass: c('brass'), orchid: c('orchid'), danger: c('danger'), ok: c('ok') },
      fontFamily: { display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'], sans: ['"Instrument Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      borderRadius: { xl2: '1.25rem' },
    },
  },
  plugins: [],
};
