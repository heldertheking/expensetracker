# 0015. Selectable Light, Dark, and WCAG AAA High-Contrast themes

- Status: accepted
- Date: 2026-11-03

## Context

[ADR 0013](0013-frontend-charts-and-structure.md) introduced Material UI and MUI X Charts with a single `buildTheme(spec)` factory and a light theme specification (`lightSpec`). Issue #14 adds dark and high-contrast themes plus an in-app switcher that remembers the user's choice while defaulting to the operating system's color-scheme and contrast preferences. Charts, budget meters, status chips, and focus indicators must adapt automatically without scattering theme conditionals across page components.

## Decision

- **Three `ThemeSpec` definitions in `apps/web/src/theme.ts`**:
  - `lightSpec`: warm neutral surfaces (`#f6f6f3` / `#fcfcfb`), dark text (`#0b0b0b`), and categorical chart series validated against the paper background.
  - `darkSpec`: dark slate surfaces (`#111315` / `#181b1f`), light text (`#f3f4f6`), and brightened chart series (`#66a8ff`, `#ff8b57`, `#3dd69d`) that each meet >= 4.5:1 contrast against the dark surface.
  - `highContrastSpec`: pure black surfaces (`#000000`), pure white primary text (`21:1`), and high-luminance cyan/amber/mint accents and chart series (`#5ce1ff`, `#ffb340`, `#5cff8d`) that all exceed the WCAG AAA 7:1 contrast threshold.
- **High-contrast affordances in `buildTheme(spec)`**: when `spec.highContrast` is enabled, cards, buttons, inputs, chips, alerts, menus, and dialogs receive explicit 2px borders; links are underlined (`underline: 'always'`); focus-visible elements show a 3px high-contrast outline (`#ffe64d`); and `BalanceChart` adds distinct stroke dash patterns (`none`, `8 4`, `2 4`) and point markers (`showMarks: true`) so series are never distinguished by color alone.
- **System default and guarded persistence**: `resolveTheme(preference, media)` is a pure function. When `preference` is `'system'` (the default), `prefers-contrast: more` or `forced-colors: active` selects `'high-contrast'`, otherwise `prefers-color-scheme: dark` selects `'dark'` or `'light'`. Explicit choices are stored under `localStorage['expensetracker.theme']` with `try / catch` guards so private browsing or disabled storage falls back cleanly.
- **Accessible AppBar switcher (`ThemeSwitcher`)**: an `IconButton` labeled `"Theme"` opens a menu of `menuitemradio` options (`System`, `Light`, `Dark`, `High contrast`) with `aria-checked` state and sets `data-theme` and `color-scheme` on `document.documentElement`.

## Options considered

- **MUI CSS variables mode (`cssVariables: true`)**: convenient for light/dark toggling, but high-contrast requires structural component overrides (2px borders, always-underlined links, dash patterns, and chart markers) that are cleaner when built from `ThemeSpec` in `buildTheme`.
- **OS media queries only (no in-app switcher)**: simpler, but prevents users from testing or choosing high-contrast or dark mode independently of their OS settings.

## Consequences

- Components remain agnostic to the active theme and read only semantic palette and `theme.chart` tokens.
- WCAG AA (>= 4.5:1) for light/dark text and WCAG AAA (>= 7:1) for high-contrast text, status colors, and chart series are enforced by unit tests in CI (`apps/web/test/theme.test.ts`).
