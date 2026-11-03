# 0013. Web client: Material UI, MUI X Charts, a small router and schema-checked fetch hooks

- Status: accepted
- Date: 2026-11-03

## Context

The web client (`apps/web`) needs a dashboard with charts (balances over time, monthly income vs. expenses, spending per project, budget usage) plus pages for transactions, projects and the activity feed. It talks to the API described in [architecture.md](../architecture.md) and must treat the shared schema as the contract ([0003](0003-shared-zod-schema-package.md)). The client was developed against the contract with MSW while the backend was built in parallel. Testing is the focus of the project, so every choice should be easy to test in jsdom.

A first version used Recharts for the charts and hand-written CSS for everything else. The user then asked for one consistent component framework for the whole client, so components, layout and charts now share one library and one theme.

## Decision

- **Components: Material UI** (`@mui/material` 9.5.0 with `@emotion/react` 11.14.0 and `@emotion/styled` 11.14.1, icons from `@mui/icons-material` 9.5.0). AppBar with inline links on wide screens and a Drawer on phones, Cards, Tables (rows become labelled cards on phones), TextFields (native selects, so they work well on phones and in tests), ToggleButtonGroups for account, type and range, Dialogs, Alerts, Skeletons, Chips and LinearProgress budget meters. The hand-written component CSS is gone.
- **Theme: one `createTheme` in `src/theme.ts`**, built by `buildTheme(spec)` from a `ThemeSpec` (mode, primary, surfaces, text, status colors and chart colors). Only the light theme exists; dark mode, high contrast and a switcher are a separate change that adds specs, not component code. The theme also extends MUI with `theme.chart` (series, neutral, grid, axis and meter-track colors) and makes the app's `RouterLink` MUI's link component, so `<Link href>` and `<Button href>` navigate in-app.
- **Charts: MUI X Charts** (`@mui/x-charts` 9.17.0, the MIT community package), so charts follow the theme. The chart forms and the palette stay as designed:
  - balances as three 2px lines (total with a light area wash, main, savings);
  - monthly income and expenses as grouped columns with net as a line on the same y-axis (composed with `ChartsContainer`, `BarPlot` and `LinePlot`);
  - spending per project as ranked horizontal bars in one color, the untagged "No project" row in neutral gray, the tail beyond seven rows folded into "Other projects", compact value labels at the bar ends;
  - budget usage as LinearProgress meters; over budget fills in the error color and carries an icon and an "Over budget" chip, never color alone.
  - Series colors are the first three slots of a validated categorical palette (`#2a78d6`, `#eb6834`, `#1baf7a`). One y-axis per chart, hairline grid, axis tooltips with formatted CHF values. The server fills gaps with 0, so every month has a value.
  - Accessibility: each plot is a `role="img"` named by the card title and described by a generated one-sentence summary; every chart has a legend whose keys mirror the marks (line or square) and a "Show table" toggle with the full data, so no value is only reachable by hovering.
- **Routing: a small router over the History API** (`src/router.tsx`): five flat routes, `useSyncExternalStore` on `popstate` and an app event, and a `RouterLink` that keeps modified clicks and non-app links native. `matchRoute` is a pure function with unit tests.
- **Data fetching: typed endpoint functions plus a `useApi` hook.** Every request goes through `src/api/client.ts`, which parses success bodies with the schema (`ContractError` when they do not match) and error bodies with `ApiErrorSchema` into `ApiRequestError` (status, code, issues, `fieldErrors()` for forms). This single place is where a later 401 can be handled. `useApi` is keyed, aborts stale requests and keeps the previous data while reloading, so views dim instead of flashing; changing the key resets it. Forms validate with the same request schemas before sending and show server issues per field.
- **Money** stays integer cents: formatting (`CHF 1'234.50`) and parsing francs to cents work on strings and integers, never on floats.

## Options considered

- **Recharts plus hand-written CSS** (the first version): small, SVG-based and easy to test, but it left the app without a component framework and with two visual systems. Replaced because the user asked for one consistent framework.
- **Chart.js**: canvas, so nothing for Testing Library to query, and it does not follow the MUI theme.
- **Nivo, visx or plain d3**: more packages or more chart code to own, and none of them reads the MUI theme.
- **MUI X Charts Pro**: commercial license, not needed for these chart forms.
- **Other component libraries** (Chakra, Mantine, Ant Design): comparable, but MUI has the matching chart package and the widest documentation.
- **Routing:** `react-router` 7 would add a dependency for five flat routes. Revisit if nested routes, loaders or URL-synced filters are needed (for example for the login flow).
- **Data fetching:** TanStack Query brings caching and retries this single-user app did not need yet. Revisit once several users and pages share data.

## Consequences

- MUI X Charts does what the design needs. Two points differ from the Recharts version: bar thickness comes from the band's gap ratios instead of a fixed pixel cap, and outside bar labels need headroom on the value axis (the spending chart sets its maximum to 1.8 times the largest value).
- In jsdom, MUI X Charts measures its container with `getComputedStyle`, which reports `100%`; `test/setup.ts` stubs `ResizeObserver` and gives chart surfaces a fixed width so the marks render and can be asserted.
- Tests query by role and label as before; MUI changed a few roles (toggle buttons instead of radios, `progressbar` instead of `meter`).
- The bundle is larger (about 1 MB minified, mostly MUI X Charts); code-splitting the dashboard is a possible follow-up.
- None of the new dependencies run install scripts, so `allowScripts` is unchanged.
