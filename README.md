# Bench Scientist Tool

Created: 2026-07-08

## Purpose

A phone-first, local-first Progressive Web App for common biology bench workflows. It can be hosted as a static site and added to an iPhone Home Screen from Safari without an Apple Developer account.

## Structure

- `inputs/` - source materials, requirements, examples, and references
- `working/` - drafts, prototypes, scripts, and intermediate files
- `outputs/` - deliverables ready to share or use
- `notes/` - research notes, decisions, and meeting notes
- `archive/` - superseded drafts or inactive material

## App Features

- Dilution, molarity, serial dilution, mass-to-molarity, and mass-needed calculators with changeable units
- Master mix builder with reaction count, overage, changeable volume units, and low-volume warnings
- Sample tracker with freezer/box/position, freeze-thaw count, search, CSV export, and camera QR/barcode scanning
- Buffer/media scaler with editable buffer names, target-volume units, and component units
- qPCR delta-delta Ct helper with efficiency and fold-change readout
- Cell culture counter, viability, and seeding-volume calculator
- Experiment log with text notes, photo-library uploads, camera-app photo attachments, and timestamps
- Reagent inventory with low-stock and expiration flags
- Gel/blot image upload or camera capture with lane annotations
- Unit conversion for mass, volume, concentration, temperature, RPM, and RCF
- Safety quick reference with PPE, waste, SDS links, and notes
- Local JSON backup export/import

## Run Locally

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:5173/
```

If an old local service worker ever caches a stale dev build, use:

```text
http://127.0.0.1:5173/
```

## Verify

```bash
npm run test
npm run build
npm audit --omit=optional
```

## Put It on iPhone

Deploy the built static app from `dist/` to GitHub Pages, Netlify, Vercel, or Cloudflare Pages. Then open the deployed HTTPS URL in Safari on the iPhone and use Share -> Add to Home Screen.

The app stores data in browser storage on the device. Use the backup export/import buttons before clearing browser data or changing phones.
