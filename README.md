<p align="center">
  <h1 align="center">Cards &amp; Print</h1>
  <p align="center">
    <strong>Design business cards, flyers and event cards — then print them.</strong>
    <br />
    The Cards &amp; Print module of <a href="https://ajiriwa.gidraf.dev">CVPAP</a>. Same login, same partner data, printed on your own printer.
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" />
  <img src="https://img.shields.io/badge/Backend-CVPAP%20(Flask%20%2B%20Postgres%20%2B%20MinIO)-3ecf8e" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript" />
  <img src="https://img.shields.io/badge/license-MIT-green" />
</p>

---

## What it does

- **Card types** — business cards (from Companies &amp; People), flyers, event invitations, **harambee / fundraising cards** (Paybill · Till · Send Money), birthday, baby shower and wedding cards. Each type has its own data fields; a card is *template + data*.
- **Drag &amp; drop designer** — text, images, shapes, icons, QR codes, 18 Google fonts, layers, undo/redo. Every template has a physical size in **mm** and an optional **back side** (e.g. *"If found, please return to …"*, bound to live company data).
- **Print Studio** — pick a paper size (A4, A3, A5, Letter, Legal), portrait/landscape, margins, gap and crop marks; the sheet is imposed N‑up (an A4 takes **10** standard business cards). Mix designs freely on one run — cards 1‑3 one design, 4‑6 another — each row has its own template and quantity. Backs are mirrored for a long‑edge duplex flip.
- **Print or save** — `Print` opens the browser print dialog at exact size; `Save as PDF` renders the same sheet with Chromium (Playwright) inside CVPAP and stores it in MinIO for download.
- **Shop pricing &amp; reports** — set what you charge per card type: a base price, a minimum quantity (e.g. business cards KES 3 each, minimum 10 = KES 30) and tiers by *cards per sheet* (flyers 2‑up = 15, 5‑up = 6…). The Print Studio quotes each run live; every `Print` / *Mark as printed* is logged, and **Reports** show cards created and printed per day, sheets used and revenue, by card type.
- **Smart logo builder** — the customer has no logo? Build one from their name in one click: 12 monogram/icon/wordmark styles, ~34 trade symbols (boda, kinyozi, fundi, duka, tailor, agrovet, church…), any colour, serif option, plus decorative **ornaments** for cards with no photo. Output is **SVG** — under 1 KB, sharp at any size, and the default "line" style is nearly free to print. Available on the company logo, on design image slots, and in the designer's asset library.
- **Ink saver** — big solid fills are what drain an inkjet. Before printing, the sheet is lightened automatically: dark panels become a pale tint of the same colour, the card background becomes paper white, full-bleed photos fade (or drop), soft shadows go, and thin accent rules stay solid. Text on a now-light panel is darkened so it stays readable. There is a **black-ink-only** option and an estimated coverage readout (typically **~70–80% less ink** on a dark design). Your saved design is never modified — only the print sheet. Several **"ink saver" built-in templates** are designed this way from the start.
- **Digital export** — self‑contained HTML + vCard per person (QR, save‑contact), as before.
- **CSV bulk import**, per‑company **custom fields** and an **asset library** (logos, backgrounds, icons) stored in MinIO.
- **CVPAP authentication** — sign in with your CVPAP partner account, or arrive from the CVPAP dashboard's *Cards &amp; Print* link with single sign‑on. All data is partner‑scoped; super‑admins can act on behalf of a partner.

## Architecture

```
material-kit-react (CVPAP dashboard) ──"Cards & Print" link──▶ /auth/sso?token=…
                                                                   │
                     this app (Next.js 16) ◀── cookies: cvpap_token, cvpap_session
                       │  server components + client components
                       ▼
        CVPAP Flask API  /api/v1/cards/<partner_id>/…   (JWT from /auth/login)
                       │            │
                  Postgres        MinIO bucket `cards-assets`
                (cards_* tables)  (logos, photos, assets, rendered PDFs)
                       │
                Playwright/Chromium  ← Print Studio POSTs the sheet HTML → PDF
```

| Layer | Where |
|-------|-------|
| API, models, storage, PDF | CVPAP repo: `app/views/cards/`, `app/model/cards.py`, `app/services/cards_store.py`, `app/services/cards_pdf.py`, built‑in templates in `app/services/cards_builtin_templates.py` |
| Card kinds &amp; fields | `lib/card-kinds.ts` (single source of truth for fields, sizes, sample data) |
| Imposition / sheet HTML | `lib/print-layout.ts`, `lib/render-html.ts` |
| API client | `lib/api.ts` (browser), `lib/api-server.ts` (server components) |
| Auth | `app/api/auth/*`, `app/auth/sso/route.ts`, `proxy.ts` |

## Quick start (development)

### Prerequisites

- Node.js 20+ and Yarn
- A running **CVPAP** backend (Flask) with Postgres and MinIO. In the CVPAP repo:
  ```bash
  docker compose up -d --build web
  ```
  or locally `python run.py`. On boot CVPAP self‑heals the `cards_*` tables and seeds the built‑in templates.
- For **Save as PDF**, CVPAP needs Playwright's Chromium (`python -m playwright install chromium` — the production Dockerfile already has it).

### Setup

```bash
git clone <this repo>
cd digital-business-cards
yarn install
cp .env.example .env.local   # point NEXT_PUBLIC_CVPAP_API_URL at your CVPAP API
yarn dev
```

Open http://localhost:7500 and sign in with a CVPAP partner account (the same email/password as the CVPAP dashboard).

### Environment

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_CVPAP_API_URL` | CVPAP API base, e.g. `https://api.ajiriwa.gidraf.dev` |
| `CVPAP_API_URL` | Optional internal URL for server‑side calls (docker network) |
| `NEXT_PUBLIC_CVPAP_DASHBOARD_URL` | CVPAP dashboard (forgot‑password link etc.) |
| `IMAGE_PROXY_ALLOWED_HOSTS` | Extra hosts the `/api/proxy-image` CORS fallback may fetch (presigned MinIO URLs are always allowed) |

On the CVPAP side the storage settings are the usual `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_USE_SSL`, optional `STORAGE_PUBLIC_ENDPOINT`; plus `CARDS_BUCKET` (default `cards-assets`) and `CARDS_PDF_TIMEOUT` (seconds, default 120).

In the CVPAP dashboard (`material-kit-react`) set `NEXT_PUBLIC_CARDS_APP_URL` to where this app is served so the sidebar link can hand the session over.

## Deployment

```bash
docker compose up -d --build
```

The image bakes `NEXT_PUBLIC_*` values at build time (see `docker-compose.yml`) and listens on **7500**. Put it behind nginx next to the CVPAP API; the app only needs to reach the API (and browsers need to reach MinIO's public endpoint for images and PDF downloads).

### nginx + TLS (cards.gidraf.dev)

`deploy/nginx/cards.gidraf.dev.conf` proxies the site to `127.0.0.1:7500`. It is HTTP-only —
Certbot adds the 443 block and the redirect:

```bash
sudo cp deploy/nginx/cards.gidraf.dev.conf /etc/nginx/sites-available/cards.gidraf.dev
sudo ln -s /etc/nginx/sites-available/cards.gidraf.dev /etc/nginx/sites-enabled/cards.gidraf.dev
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d cards.gidraf.dev
```

Point the A record for `cards.gidraf.dev` at the server first, build the image with
`NEXT_PUBLIC_CVPAP_API_URL=https://api.ajiriwa.gidraf.dev`, and set
`NEXT_PUBLIC_CARDS_APP_URL=https://cards.gidraf.dev` in the CVPAP dashboard.

## Printing tips

- In the print dialog choose **Actual size / 100 %**, no scaling, margins **None**. The sheet already carries its own margins and crop marks.
- For two‑sided cards print the PDF **duplex, flip on long edge** (the back pages are pre‑mirrored). If your printer flips on the short edge, choose *All fronts, then all backs* and feed the sheets manually.
- Ink: leave **Ink saver** on (default) and let the ivory stock supply the background — on an EcoTank a pale sheet costs a fraction of a full-bleed dark one, dries faster and doesn't band. Pick an *"ink saver"* template for the cheapest result. **Black ink only** is cheaper still for text-heavy cards.
- A4 fits 2 × 5 standard business cards (89 × 51 mm) in portrait; A6 event cards fit 2 per A4 in landscape, or 4 with a *Borderless* layout on a printer that supports it.

## Project structure

```
app/
  api/auth/            login / logout route handlers (CVPAP JWT → cookies)
  auth/sso/            single sign-on entry from the CVPAP dashboard
  companies/           companies & people (business-card data)
  designs/             event / harambee / birthday / baby-shower / wedding / flyer designs
  templates/           template gallery + designer (front & back, mm sizes)
  print/               print runs & Print Studio (live quote, print log)
  reports/, settings/pricing/   shop reports and pricing rules
  components/          UI (designer/, print/, modals, lists)
lib/
  api.ts, api-server.ts, auth.ts, session-server.ts
  card-kinds.ts        card types, fields, sizes, sample data
  card-data.ts         person/design → render data, vCard, QR payload
  render-html.ts       card face → static HTML
  print-layout.ts      imposition engine + sheet HTML
  ink.ts               ink-saving transform + coverage estimate
  logo-builder.ts      procedural SVG logos, trade icons and ornaments
  pricing.ts           quote calculation (tiers by cards-per-sheet, minimum quantity)
  digital-export.ts    HTML + vCard zip
```

## License

MIT — originally based on [OwnCardly](https://github.com/kevinwielander/digital-business-cards) by Kevin Wielander.
