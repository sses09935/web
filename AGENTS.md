# AGENTS.md

## Project
Maintain the NTUH North Branch long-term care resource coordination PoC.
The platform supports case managers, social workers, long-term care staff, and family caregivers with a static resource dispatch and lookup workspace.

## Core Priorities
Apply these priorities in order when requirements conflict:

1. Accessibility
2. Data integrity
3. Rendering stability
4. Static export compatibility
5. Performance
6. Visual polish

## Required Stack
- Next.js 16.2.6 with App Router
- React 19
- TypeScript
- Tailwind CSS v4 with `@tailwindcss/postcss`
- Maplibre GL JS

Do not replace Maplibre with Leaflet. Do not add Redux, Zustand, MobX, or another global state library. Use React-native state and memoization primitives.

## Static Export Rules
- Keep `output: 'export'`.
- Do not add `getServerSideProps`, dynamic API routes, or Node.js runtime dependencies.
- Map components must stay client-only through `next/dynamic(..., { ssr: false })`.
- Preserve the `isMounted` gate in `src/app/page.tsx` unless a replacement is explicitly verified against hydration mismatch.
- Keep the initial page state empty; do not render cards or map markers before filters/search/url state intentionally selects resources.

## Accessibility Rules
- All interactive elements must support visible keyboard focus and keyboard activation.
- Use semantic roles, `aria-label`, `aria-current`, `aria-expanded`, `aria-live="polite"`, and `tabIndex` where appropriate.
- Do not break Tab navigation.
- Preserve high-contrast support.
- Avoid `h-screen`; prefer `min-h-[100dvh]` or other fluid viewport-safe layout.

## Data Rules
- Public repo must not track raw, cleaned, or private operational resource data.
- `src/data/resources.public.json` is synthetic sample data for public builds.
- `src/data/resources.build.json` and `src/data/resource-manifest.json` are generated ignored build inputs.
- `src/data/resources.json` remains an ignored private ETL output. Do not edit it manually.
- Dataset updates must go through ETL scripts, then `npm run prepare:data`.
- Preserve phone numbers, email addresses, URLs, LINE IDs, and `@` handles.
- Normalize whitespace at ETL or rendering boundaries.
- Null-check optional fields before rendering.
- Filter invalid coordinates before rendering map markers.
- Do not hardcode institution names in generic logic unless a documented product exception requires it.

## Documentation Rules
- README and public docs must describe the private data loading strategy without hardcoding private dataset metrics.
- Historical documents are append-only unless the user explicitly approves rewriting them.
- If data loading behavior changes, update the documentation drift check before considering the change complete.
- Security descriptions must describe browser-side controls as friction, traceability, and deterrence only. Do not claim that a static frontend prevents leakage, screenshots, copying, scraping, or unauthorized access.

## Change Safety
- Prefer localized, reviewable diffs.
- Do not perform destructive git operations unless the user explicitly asks.
- Keep generated output, caches, reports, and local artifacts out of commits unless the user explicitly asks to ship them.
- For substantial changes, verify in this order when applicable:
  1. `npm run lint`
  2. `npm run check:docs`
  3. `npm run build`
  4. `npm run test:unit`
  5. `npm run test:e2e`
  6. `npm run test:memory`

## Failure Conditions
Treat these as critical failures:
- Breaking static export.
- Introducing hydration mismatch.
- Removing accessibility behavior.
- Rendering invalid map data.
- Replacing Maplibre with Leaflet.
- Breaking keyboard navigation or high-contrast support.
- Manually editing canonical processed data.
- Overwriting historical documentation without explicit approval.
