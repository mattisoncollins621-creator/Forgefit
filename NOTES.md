# ForgeFit: notes for whoever works on this next

Read this first, whether you're a person or an AI assistant. The owner is not a developer: he describes what he wants, and changes reach his phone automatically. Your job is to keep that loop safe.

## How a change reaches the phone
1. Edit the source in `src/`. Never edit `index.html` by hand; it is generated.
2. Run `python3 build.py`. It stitches `src/` into `index.html` and writes `/tmp/all.js`. Then run `node --check /tmp/all.js` to catch syntax errors.
3. **Bump the version** in `sw.js` (`const V = 'forgefit-vN'` → `N+1`). The app compares this number with its own to decide whether to update itself. If you forget it, phones never get the change.
4. Run the tests (see below).
5. Commit the source **and** the rebuilt `index.html` and `sw.js` to `main`, then push. Netlify publishes the repository as-is (`netlify.toml`: publish `.`; `sw.js` is never cached).
6. Phones update the next time the app opens or comes back to the front. If a workout is in progress, the app shows an "Update" button instead of reloading. Settings → App version & advanced → Check for updates forces it.

The Netlify site must stay **public**. Netlify "access protection" makes `sw.js` return 401 and silently breaks updates. `/reset.html` clears a stuck saved copy of the app without touching workout data.

## Source layout (`src/`, concatenated in this order by `build.py`)
| File | What's in it |
|---|---|
| `core.js` | State, storage (localStorage + IndexedDB, per-person keys), exercise library `BASE_EX`, muscle shares `MUSCLE_FIX`, recovery model (`REC_BASE`, `recRate`, `learnPace`), e1RM maths, timers, sound, haptics |
| `ui.js` | Workout tab: generator (`generateWorkout`: day rules `DAY_ALLOW`/`fitsDay`, Smart day `smartDay`, main lifts `anchorsFor`, weekly set targets), exercise cards, picker, swap |
| `extras.js` | Swipe gestures, banners, people/profiles, exercise info sheet, stalls, heatmap data, weekly sets |
| `more.js` | Exercise history sheet, onboarding pieces, misc tools |
| `session.js` | Plan rows, live session (start/pause/end/edit), calorie estimate, achievements, finish summary |
| `anim.js` | Exercise animations. Each movement in `MOVES` is two poses (`a`, `b`: hip, torso angle, ankles, wrists; knees/elbows solved by IK), with optional `mid` (curved path), `seq` (joints that lead/lag), `con` (`'ba'` when the lift runs b→a), `prone`, `alt` (switch legs each rep), `vb` (wider frame). `EX_MOVE` maps exercise id → movement. Drawn as a filled body (`torsoPath`, `legPath`, `armPath`, `headPath`; `part()` adds the outline layer). `animK` gives real rep timing: hold, slow lowering, short pause, drive. One shared loop animates what's on screen; small tiles zoom to the figure (`fitBox`) |
| `video.js` | How-to videos: `VIDEOS` (from `videos.json`), `thumbBtn(ex,size)` animated tile with play badge, `A.exVideo` in-app player (youtube-nocookie embed, offline fallback, per-person override `state.vidOver`) |
| `recovery.js` | Recovery tab: readiness ring, flip-card body map (`bodySvg`, also reused elsewhere), single-track sliders |
| `focus.js` | Focus view (one exercise at a time) and auto-advance |
| `calib.js` | "Find your working weight" calibration |
| `charts.js` | Touch-and-drag readout for every trend chart |
| `sharecard.js` | "Share as image" canvas card |
| `datasafe.js` | Backup reminder frequency, one-tap backup, storage-protection status |
| `platform.js` | iPhone/Safari fixes (audio unlock) |
| `features.js` | Progress / Body / Settings tabs, charts (`lineChart`), backup/import, update engine, event binding and boot. **Must stay last.** |
| `style.css` | All styles. Later blocks override earlier ones; the newest design system starts at the `v11`/`v12` blocks. |
| `body.html` | Static page shell (header, tab bar, sheet, overlays) |
| `videos.json` | One YouTube tutorial per exercise: `{"exId": ["videoId", "title"]}`. Injected by `build.py` as `__VIDEOS__`. Picked by title; swap any that turn out poor. |
| `fonts/` | Big Shoulders Display (OFL, `OFL.txt`), used for headings and numbers via `--fd`. `build.py` embeds it into `index.html` as base64 (`__FONT_BSD__`), so it works offline with no extra file to cache. |
| `icons.json` | Inline SVG icons, used as `ic('name')` in JS or `{{ic:name}}` in `body.html` |

Conventions:
- Clicks are delegated. `data-a="name"` calls `A.name(el)`, and `data-f="name"` calls `F.name(el)` on input/change. Add `data-live` to a range input to get live input events.
- Each tab has a renderer registered as `R.<tab>`. `openSheet(title, html)` opens the bottom sheet.
- `normalize()` in `core.js` upgrades old saved data. New state fields need a default there, or spreading the defaults has to cover them.
- No emoji in the UI. Use icons from `icons.json`.

## Design system (dark default, light supported)
- Canvas `#0A0C10`. Cards `#141721` with a 1px `rgba(255,255,255,.06)` border and a top rim light.
- Text `#F8FAFC` / `#94A3B8` / `#64748B`; labels use `#8593A8` for readability.
- Orange `#F97316` is for the brand, hero actions and selected states only.
- Green / amber / red (muted: `--gr #3BA57A`, `--am #D39A3A`, `--rd #D2605A`, with `--*-rgb` triplets and lighter `--*-t` text tones; light theme has its own set) are **only** for status. Never hard-code them; use the tokens. Fresh above 85%, Recovering 50–84%, Fatigued below 50% (`recCol`), plus deltas and danger.
- Header and tab bar are frosted glass (`rgba(10,12,16,.85)` + `blur(16px)`). Numbers use tabular figures.
- Every animation sits behind `prefers-reduced-motion: no-preference`.
- Headings and big numbers use `var(--fd)` (Big Shoulders Display); body text stays in the system font. The header shows the tab's title (`#htitle`, set in `go()`).
- One orange action per screen. Buttons inside tips (`.banner`) are deliberately quiet.

## Tests
`tests/` holds Playwright suites `testA`–`testU` plus the helper `h.js`. Chromium and Playwright must be installed. They currently assume this layout, so adjust the paths in `h.js` if yours differs:
- the app source at `/home/claude/forgefit`
- tests run from `/tmp/t`, with files served from `/tmp/t/www` and screenshots written to `/tmp/t/out`
- `/tmp/t/index_v_prev.html` holds an older build, used by the update tests

Run each with `node testX.js`; each prints `N passed, M failed`. `testC`, `testH` and `testJ` contain hard-coded version numbers: raise them by one with each release. `testH` can very occasionally hit a reload race; re-run it before assuming a real failure.

## The owner's setup
- Android Pixel 10 Pro XL. His wife uses an iPhone. US units (lb), America/Chicago.
- Data lives only on the phone. Backups are JSON files shared to Drive, Files or email. Import offers "Add as a new person" or "Replace".
- Several people can share one phone (Settings → People). Each person has separate storage.
