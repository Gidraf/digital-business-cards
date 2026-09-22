# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Cards & Print (CVPAP module) — context for agents

- **No database or storage in this repo.** Everything lives in the CVPAP Flask backend
  (`../CVPAP`, `app/views/cards/`, `app/model/cards.py`). The app talks to it through
  `lib/api.ts` (browser) / `lib/api-server.ts` (server components). Auth is the CVPAP JWT
  kept in the `cvpap_token` + `cvpap_session` cookies (`lib/auth.ts`, `proxy.ts`).
- **Card kinds** are defined once in `lib/card-kinds.ts` (fields, image slots, mm sizes,
  sample data). Built-in templates in CVPAP (`app/services/cards_builtin_templates.py`)
  must only bind to keys that exist there. Add a kind → add it in both places + `CARD_KINDS`
  in `app/model/cards.py`.
- **Rendering is shared**: `CardPreviewRenderer` (React, screen) and `lib/render-html.ts`
  (static HTML for print/export) must stay visually equivalent. `textWraps()` decides
  single- vs multi-line text boxes for both.
- **Print pipeline**: items → `printMaterials` → `expandItems` (inline images as data URIs,
  QR) → `buildSheetHtml` (mm-accurate, `@page` sized) → preview iframe / `window.print()` /
  `POST …/render` (Playwright PDF in CVPAP). Back pages are column-mirrored for duplex.
- **Pricing/reports**: rules live in CVPAP `cards_settings.pricing` (per kind: unit_price,
  min_quantity, tiers[{per_sheet, price}]); `lib/pricing.ts` mirrors `settings_view.py`
  (tier with largest per_sheet <= actual wins). The Print Studio computes the quote
  client-side and saves it on the job; `POST …/print-jobs/<id>/printed` logs a
  `cards_print_events` row (browser print auto-logs; "Mark as printed" for reprints/PDF).
  `GET …/reports?from&to` aggregates per day.
- Units: template `config` is in px (designer canvas); `width_mm`/`height_mm` is the
  physical size. `MM_PX = 96/25.4` converts for print.
- Run locally: CVPAP API on :5000 (`python run.py` in ../CVPAP), `yarn dev` here. The
  `.claude/launch.json` config `cards-web` starts the dev server on :7500.
