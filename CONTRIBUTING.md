# Contributing to CardGen

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

### Prerequisites

- Node.js 18+
- Yarn
- A running [CVPAP](../CVPAP) backend (Flask + Postgres + MinIO)

### Local Setup

1. **Fork and clone**
   ```bash
   git clone https://github.com/kevinwielander/digital-business-cards.git
   cd digital-business-cards
   ```

2. **Install dependencies**
   ```bash
   yarn install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env.local
   ```
   Point `NEXT_PUBLIC_CVPAP_API_URL` at your CVPAP API.

4. **Start the CVPAP backend** (in the CVPAP repo: `python run.py` or `docker compose up -d web`) — it creates the `cards_*` tables and seeds the built-in templates on boot.

5. **Run dev server**
   ```bash
   yarn dev
   ```
   Open [http://localhost:7500](http://localhost:7500).

## Making Changes

### Branch Naming

- `feat/description` — new features
- `fix/description` — bug fixes
- `docs/description` — documentation
- `refactor/description` — code improvements

### Commit Messages

Use clear, descriptive commit messages:
```
feat: add dark mode support
fix: resolve template preview scaling on mobile
docs: update self-hosting guide
```

### Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Ensure `yarn build` passes
4. Ensure `yarn lint` passes
5. Open a PR with a clear description of what changed and why
6. Wait for review

## Code Style

- **TypeScript** — strict mode, no `any` unless necessary
- **Tailwind CSS** — use utility classes, avoid custom CSS
- **Components** — client components use `"use client"`, server components are default
- **Translations** — all user-facing strings should use `useTranslation()` hook

## Project Structure

```
app/
  api/          — API routes (generate cards, proxy images)
  auth/         — Auth callback and migration
  companies/    — Company & people pages (business-card data)
  designs/      — Event / harambee / birthday / baby-shower / wedding / flyer designs
  print/        — Print runs + Print Studio (imposition, PDF)
  templates/    — Template gallery + designer
  components/   — All React components
    designer/   — Card designer components (canvas, layers, properties)
    print/      — Print Studio
  api/auth/, auth/sso/ — CVPAP session handling
  login/        — Login page
lib/
  api.ts, api-server.ts — CVPAP API client
  card-kinds.ts — Card types, fields, sizes, sample data
  print-layout.ts, render-html.ts — Imposition + static rendering
  i18n/         — Translation strings
  fonts.ts      — Google Fonts configuration
  types.ts      — TypeScript types
```

## Questions?

Open an issue in this repository.
