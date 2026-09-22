# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2026-09-22

### Changed
- **Backend moved from Supabase to CVPAP** (Flask + Postgres + MinIO). All data is
  partner-scoped and shared with the CVPAP dashboard; sign in with a CVPAP account or
  arrive via the dashboard's *Cards & Print* link (single sign-on).
- Templates now carry a physical size in mm and an optional **back side**.
- Text boxes taller than ~2 lines wrap (multi-line messages) in designer, preview and print.

### Added
- **Card kinds**: flyers, event invitations, harambee (fundraising) cards, birthday,
  baby-shower and wedding cards — each with its own fields, sizes and starter templates.
- **Designs**: fill in a kind's fields + images against a template, customize the
  template inline, save and print.
- **Print Studio**: N-up imposition on A4/A3/A5/Letter/Legal, portrait/landscape,
  margins, gap, crop marks, scale; mix designs and quantities on one run; back pages
  mirrored for duplex. `Print` (browser dialog) and `Save as PDF` (Chromium render in
  CVPAP, stored in MinIO).
- Built-in business-card back sides ("If found, please return to…", QR back).
- **Ink saver** for printing: pale panels instead of solid fills, white card background,
  faded/dropped background photos, no shadows, automatic text darkening for legibility,
  black-ink-only option and an estimated coverage readout. Six ink-light built-in templates
  (2 business cards, harambee, invitation, birthday, flyer).
- **Shop pricing** (per kind: base price, minimum quantity, tiers by cards-per-sheet), a live
  quote in the Print Studio, print logging and a **Reports** page (created/printed per day,
  sheets, revenue, by card type).

### Removed
- Supabase auth/storage, Google OAuth and magic links, guest mode, the `/create` quick
  flow and sample-data seeding (built-in templates are seeded by CVPAP instead).

## [1.0.0] - 2026-04-18

### Added
- Drag-and-drop business card designer with snap-to-grid alignment
- 11 starter templates (4 portrait, 7 landscape)
- Company and team management with people and custom fields
- CSV bulk import with auto column mapping
- Google OAuth authentication
- Guest mode with localStorage (no account required)
- Quick card creation flow (`/create`) for individuals
- QR code generation with vCard data
- Save Contact button with embedded vCard download
- Company asset library for logos, backgrounds, icons
- Social media and contact icon picker with color customization
- Image upload with crop tool and drag-and-drop
- Template layers panel with drag reorder, visibility, lock, grouping
- Undo/redo with keyboard shortcuts (Ctrl+Z / Ctrl+Y)
- Live preview in person edit modal
- Card generation as self-contained HTML with embedded assets
- Responsive card scaling for mobile viewing
- 18 Google Fonts with full weight support
- Gradient backgrounds and presets for shapes
- Element grouping (move grouped elements together)
- Page background color customization
- 10 language translations (EN, DE, FR, ES, PT, IT, NL, JA, ZH, KO)
- Mobile responsive design with hamburger menu
- Loading skeletons for all pages
- Toast notifications
- Supabase Row Level Security for all tables
- Sample data with real photos and logos
- Auto-save drafts in template designer
