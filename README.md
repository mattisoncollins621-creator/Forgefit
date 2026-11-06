# ForgeFit

A single-file workout PWA (plain HTML/CSS/JS, no frameworks). Netlify publishes this repository as-is.

## Files that get served
`index.html`, `sw.js`, `manifest.webmanifest`, `icon.svg`, `icon-180/192/512.png`, `reset.html`

## Editing
- Source lives in `src/` (`core.js`, `ui.js`, `extras.js`, `more.js`, `features.js`, `style.css`, `body.html`).
- `python3 build.py` stitches it into `index.html`. Commit both the source and the rebuilt `index.html`.
- **Bump the version** in `sw.js` (`forgefit-vN`) with every release. The app reads that number to know when to update itself.
- `tests/` holds the Playwright regression suites (`testA`–`testI`, helper `h.js`); they expect to be run from `/tmp/t` with the files served from `/tmp/t/www`.

## Updating phones
Push to `main` → Netlify deploys → the app updates itself on next open (More → Check for updates forces it).
`/reset.html` clears a stuck saved copy without touching workout data.

## Deploy check
Last pipeline test: 2026-11-06 01:44UTC (README-only change, app unchanged).
