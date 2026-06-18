# Contributing

Thank you for your interest in improving this NTUH North Branch long-term care resource coordination PoC.

## Project priorities

When requirements conflict, use this order:

1. Accessibility
2. Data integrity
3. Rendering stability
4. Static export compatibility
5. Performance
6. Visual polish

## Local development

```bash
git clone https://github.com/sses09935/web.git
cd web
npm install
npm run dev
```

Before opening a pull request, run the checks that match your change:

```bash
npm run lint
npm run check:docs
npm run build
npm run test:unit
```

For interaction, accessibility, or static-export routing changes, also run:

```bash
npm run test:e2e
npm run test:memory
```

## Contribution rules

- Keep `output: 'export'` and static export compatibility.
- Keep Maplibre GL JS; do not replace it with Leaflet.
- Do not add Redux, Zustand, MobX, or another global state library.
- Keep map components client-only through `next/dynamic(..., { ssr: false })`.
- Preserve the `isMounted` gate in `src/app/page.tsx` unless the replacement has been verified against hydration mismatch.
- Keep the initial page state empty; do not render cards or map markers before filters, search, or URL state intentionally selects resources.
- Preserve keyboard navigation, visible focus styles, semantic labels, high-contrast support, and `aria-live` announcements.

## Data changes

Public contributions must not add raw, cleaned, or private operational resource data. The public repo uses `src/data/resources.public.json` as synthetic sample data, while local/private builds generate `src/data/resources.build.json` from an ignored private source.

Dataset updates should go through the ETL workflow from source files in `_raw_data/`, then regenerate ignored outputs such as `_cleaned_data/` and `src/data/resources.json`. Do not manually edit private or generated resource JSON.

Preserve phone numbers, email addresses, URLs, LINE IDs, and `@` handles. Filter invalid coordinates before rendering map markers.

## Documentation changes

README and public docs must describe the private data loading strategy instead of hardcoding private dataset metrics. If data loading behavior changes, update the documentation drift check and run:

```bash
npm run check:docs
```

Historical documents are append-only unless maintainers explicitly approve rewriting them.

## Security wording

Browser-side controls in this static PoC must be described as friction, traceability, and deterrence only. Do not claim that the static frontend prevents leakage, screenshots, copying, scraping, or unauthorized access.

## Pull requests

Use small, reviewable diffs. Include:

- What changed.
- Why it changed.
- Which checks were run.
- Any known limitations or follow-up work.
