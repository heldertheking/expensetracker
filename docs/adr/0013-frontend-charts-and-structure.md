# 0013. Web client: Recharts, a small router, schema-checked fetch hooks and CSS tokens

- Status: accepted
- Date: 2026-11-03

## Context

The web client (`apps/web`) needs a dashboard with charts (balances over time, monthly income vs. expenses, spending per project, budget usage) plus pages for transactions, projects and the activity feed. It talks to the API described in [architecture.md](../architecture.md) and must treat the shared schema as the contract ([0003](0003-shared-zod-schema-package.md)). The backend is built in parallel, so the client is developed and tested against the contract with MSW. Testing is the focus of the project, so every choice should be easy to test in jsdom, and dependencies should stay few.

## Decision

- **Charts: Recharts 3.10.1** (exact pin, peer `react-is` 19.3.1). It supports React 19, renders SVG with React components, and has no install scripts. The stat tiles and budget meters are plain HTML, not chart components.
  - Forms: balances as three 2px lines (total with a light area wash, main, savings); monthly flows as grouped columns (income, expenses, at most 24px wide, rounded data end) with net as a line on the same axis; spending per project as ranked horizontal bars in one color, the untagged "No project" row in neutral gray, the tail beyond seven rows folded into "Other projects"; budget usage as bullet meters where over budget fills in the critical color and carries an icon and a label, never color alone.
  - Colors are CSS custom properties: the first three slots of a validated categorical palette, stepped separately for light and dark. One y-axis per chart; hairline grid; legend for every multi-series chart; custom tooltips (value first, series second).
  - Accessibility: each plot is a `role="img"` named by the card title and described by a generated one-sentence summary; every chart has a "Show table" toggle with the full data, so no value is only reachable by hovering.
- **Routing: a small router over the History API** (`src/router.tsx`, about 70 lines): five routes, no nested layouts, no loaders. `useSyncExternalStore` follows `popstate` and an app event; `Link` keeps modified clicks native. `matchRoute` is a pure function with unit tests.
- **Data fetching: typed endpoint functions plus a `useApi` hook.** `src/api/client.ts` parses every success body with the schema (`.parse`) and throws `ContractError` when it does not match; error bodies are parsed with `ApiErrorSchema` into `ApiRequestError` (status, code, issues, `fieldErrors()` for forms). `useApi` aborts stale requests and keeps the previous data while reloading, so views dim instead of flashing. Forms validate with the same request schemas (`CreateTransactionRequest`, `validateTransactionUpdate`, ...) before sending and show server issues per field.
- **Styling: one global stylesheet with CSS custom properties** (`src/styles.css`), dark mode via `prefers-color-scheme`, responsive grids down to phone width (the transaction table becomes a card list). No CSS framework, no CSS-in-JS.
- **Money** stays integer cents: formatting (`CHF 1'234.50`) and parsing francs to cents work on strings and integers, never on floats.

## Options considered

- **Charts:** Chart.js (canvas: nothing for Testing Library to query, needs a React wrapper); Nivo (heavier, many packages); visx or plain d3 (more code to own for axes, tooltips and resizing); hand-written SVG (full control, but axes and tooltips would be ours to maintain). Recharts gives SVG that jsdom can render with a `ResizeObserver` stub and a measured size (see `test/setup.ts`).
- **Routing:** `react-router` 7 is the standard choice, but the app has five flat routes; the library would add a dependency and an API larger than the problem. Revisit if nested routes, loaders or URL-synced filters are needed.
- **Data fetching:** TanStack Query brings caching, retries and deduplication, which this single-user app does not need yet, and one more dependency. Revisit if pages start sharing and invalidating a lot of data.
- **Styling:** Tailwind or a component library would speed up layout but adds build config and dependencies; a few hundred lines of CSS with tokens cover this app and make light and dark mode one place to change.

## Consequences

- New dependencies: `recharts`, `react-is` (runtime) and `@testing-library/user-event` (dev). None run install scripts, so `allowScripts` is unchanged.
- A response that drifts from the contract fails loudly as a `ContractError` instead of producing a wrong chart. Test fixtures are validated against the schema (`test/fixtures.test.ts`), so the mocks cannot drift either.
- The router and fetch hook are ours to maintain; both are small and covered by tests.
- Tests render the real app with MSW handlers; a coverage threshold in `apps/web/vitest.config.ts` keeps it that way.
