# 0015. Light, dark and high-contrast themes with a persisted switcher

- Status: accepted
- Date: 2026-11-03

## Context

[0013](0013-frontend-charts-and-structure.md) built the web client on one `buildTheme(spec)` factory with only a light spec. Ticket EXTR-14 asks for dark and high-contrast themes, a switcher in the app bar, a remembered choice that defaults to the OS preference, WCAG AAA text contrast in high contrast, no reliance on color alone, and validated chart palettes.

## Decision

- **Three specs, one factory.** `lightSpec`, `darkSpec` and `highContrastSpec` in `src/theme.ts` are passed to `buildTheme`. Components read roles (`palette`, `theme.chart`) only and have no theme-specific code paths.
- **High contrast is light-on-dark** (pure black surfaces, white text). It is the common choice for OS high-contrast modes and gives the most headroom for saturated accents and focus rings. Measured contrast on black: text 21:1 (primary), 14.9:1 (secondary), 13.7:1 (muted), primary accent 13.7:1, status colors 8.7:1 or more, all at least 7:1 (AAA). Chart series are at least 5.4:1. A tested contrast helper enforces this in CI.
- **Not color alone.** High contrast adds 2px borders on cards, buttons, inputs, chips, alerts, menus and dialogs, always-underlined links, a 3px focus ring, line series with different dash patterns (solid, `8 4`, `2 4`) and point markers, outlined bars, and bordered meters. Legend keys mirror the dashes, and every chart still has a table view. Over-budget meters keep their icon and label.
- **Chart palettes** follow the dataviz method and were run through its validator (all-pairs, against each theme's surface). Light uses `#256abf`, `#c44b19`, `#117c54` (all checks pass; CVD in the warn band, covered by the legend, table and dash marks). Dark and high contrast use the reference dark steps `#3987e5`, `#d95926`, `#199e70` (all checks pass on `#181b1f` and on `#000000`). Light series changed from the ADR 0013 set because the green was under 3:1 on the light surface.
- **Preference.** `ThemePreference` is `system | light | dark | high-contrast`. `resolveTheme(preference, media)` is a pure function: `prefers-contrast: more` or `forced-colors: active` give high contrast, then `prefers-color-scheme`. The `AppThemeProvider` / `useThemePreference` in `src/theme-context.tsx` reads the stored value in the initial state (so the first render already has the right theme), listens to the media queries, and sets `data-theme` and `color-scheme` on `<html>`.
- **Storage.** One localStorage key, `expensetracker.theme`; every read and write is in try/catch and falls back to System.
- **Switcher.** An IconButton "Theme" in the app bar opens a Menu of `menuitemradio` items (System, Light, Dark, High contrast) with `aria-checked`. It sits before the space reserved for the user menu.
- **Motion.** With `prefers-reduced-motion: reduce`, MUI transitions and ripples are off.

## Options considered

- **MUI CSS variables mode** (`colorSchemes`, `data-mui-color-scheme`): no re-render on switching and no flash, but it supports light and dark natively, while high contrast would still need a third scheme plus custom handling, and MUI X Charts read resolved values more simply from a normal theme object. Rejected for now; the factory can move to it later.
- **OS only, no switcher:** least code, but users cannot override the OS and the issue requires a switcher.
- **Separate hand-written stylesheets:** duplicates every component style and breaks the single-factory rule.
- **Storage:** cookies would be sent to the API for no reason; sessionStorage forgets the choice. localStorage is client-only and persistent. A stored value is validated against the known set.
- **Inline pre-hydration script in `index.html`** to avoid any flash: unnecessary, because the provider reads storage before the first render of the client-rendered app.

## Consequences

- Adding a theme is a new spec. Contrast and palette checks must be repeated for it.
- Theme preference is per browser, not per account. If accounts (EXTR-16) should sync it, add a server field later.
- Switching rebuilds the MUI theme; memoization keeps this to one rebuild per change.
