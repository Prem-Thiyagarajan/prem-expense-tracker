/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Theme-aware tokens: values live as CSS custom properties (src/index.css),
      // swapped by the [data-theme="dark"] attribute on <html>. Values transcribed
      // 1:1 from PFT-Mobile/src/theme/tokens.ts (design source of truth for the
      // web redesign too — see handoff/README.md).
      colors: {
        bg: "var(--color-bg)",
        card: "var(--color-card)",
        ink: "var(--color-ink)",
        line: "var(--color-line)",
        shadow: "var(--color-shadow)",
        muted: "var(--color-muted)",
        faint: "var(--color-faint)",
        hair: "var(--color-hair)",
        link: "var(--color-link)",
        nav: "var(--color-nav)",
        semantic: {
          green: "var(--color-green)",
          red: "var(--color-red)",
        },
        // Candy accents: identical in both themes, always paired with ink text.
        candy: {
          yellow: "#FFD43B",
          mint: "#C7F0DB",
          pink: "#FFD6E8",
          coral: "#FF8787",
          blue: "#5C7CFA",
          lilac: "#D0BFFF",
        },
        // Chart-only pastel quadrant zones + heatmap ramp (handoff/README.md §Candy accents).
        chart: {
          peach: "#FFE9C7",
          blush: "#FFDCDC",
          sage: "#DFF3E6",
          sky: "#DCE8FF",
          heat1: "#FFF3C4",
          heat2: "#FFE28A",
          heat3: "#FFC93C",
        },
        // Category colours (handoff/README.md §Category colours + icons).
        category: {
          food: "#FF8787",
          bills: "#5C7CFA",
          travel: "#FFD43B",
          shopping: "#C7F0DB",
          transfers: "#C7F0DB",
          health: "#C7F0DB",
          personalCare: "#FFD6E8",
          education: "#D0BFFF",
          entertainment: "#D0BFFF",
          houseWork: "#E8E2D4",
          misc: "#E8E2D4",
          rent: "#5C7CFA",
        },
        // Fixed (non-theme-swapping) ink, for borders/rings drawn on top of a
        // candy fill. Candy backgrounds stay the same light pastel in both
        // themes, so a border that swaps to cream in dark mode (border-line)
        // nearly disappears against them -- candy shapes always need the
        // light-mode ink value specifically, never the theme-aware one.
        candyLine: "#1E1B16",
        // Brand mark colours — icon/wordmark only, never in-app chrome (Part 4).
        brand: {
          lime: "#D8FF3E",
          fieldTop: "#20240A",
          fieldBottom: "#0A0B03",
          field: "#151806",
        },
      },
      fontFamily: {
        heading: ["'Bricolage Grotesque'", "system-ui", "sans-serif"],
        body: ["Archivo", "system-ui", "sans-serif"],
        money: ["'Archivo Black'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      borderRadius: {
        chip: "14px",
        card: "16px",
        cardLg: "20px",
        sheet: "26px",
        pickerSheet: "24px",
      },
      borderWidth: {
        DEFAULT: "1.5px",
        // Explicit `1.5` key so the literal class `border-1.5` (used
        // throughout this redesign for rows/chips/inputs, interchangeably
        // with the bare `border` DEFAULT above) actually generates CSS --
        // Tailwind only emits border-width utilities for keys defined here,
        // it doesn't infer arbitrary numeric suffixes the way spacing does.
        1.5: "1.5px",
        2: "2px",
      },
      maxWidth: {
        content: "1320px",
      },
      boxShadow: {
        // Hard offset shadows — solid, no blur. `shadow` colour swaps with theme.
        chip: "2px 2px 0 var(--color-shadow)",
        card: "3px 3px 0 var(--color-shadow)",
        overlay: "5px 5px 0 var(--color-shadow)",
        sheet: "6px 6px 0 var(--color-shadow)",
        press: "1px 1px 0 var(--color-shadow)",
      },
      transitionDuration: {
        press: "90ms",
        chip: "200ms",
        bar: "400ms",
        row: "180ms",
        panel: "220ms",
      },
    },
  },
  plugins: [],
};
