# LLCA Cybersecurity Video Tracker — Project State

Gamified video-training tracker for ~30-50 LLCA members. Static HTML/CSS/JS,
hosted on Netlify, one Netlify Function will hold the Google service-account
key and read/write a Google Sheet. No other backend.

Reference docs in this folder — read before touching anything:
- `LLCA-Video-Tracker.html` — approved Claude Design mockup (visual/interaction
  reference; it's a bundled/escaped Design Canvas export, not plain HTML — the
  real source is a JSON-escaped blob inside it, has to be extracted/decoded to
  read).
- `LLCA_Video_Tracker_Design_Spec.md` — original 5-screen spec.
- `LLCA_Tracker_Build_Notes.md` — 6 things the mockup fakes that needed real
  logic in the build. **All 6 are done** (see below).
- `LLCA_Tracker_GoogleSheet_Template.xlsx` — Google Sheet template. **Contains
  real PII now** (user's own name/email in Roster) — gitignored, never upload
  to Netlify, never publish anywhere.

## Stack / file layout

```
index.html          Screen 1 (playlist) + Screen 2 (player) SPA
admin/index.html     Screen 5 (admin), served at /admin/ on Netlify —
                     NOT linked from index.html, deliberately unreachable
                     from the member flow. Root-absolute asset paths
                     (/css/..., /js/...) because it's one level deep.
css/styles.css       All visual system, transcribed from the mockup
js/config.js         Connection setup only (game rules, badge %, admin
                     passcode placeholder, member-token param)
js/api.js            All data access — mock catalog/progress/roster today,
                     same function signatures will hit the real Netlify
                     Function once wired
js/app.js            Screen 1/2/3/4 page behaviour (member SPA)
js/admin.js          Screen 5 page behaviour (separate script, own page)
```

## What's built (all 5 screens, verified live in browser each time)

- **Screen 1** — playlist, rainbow bar, "time left to finish" (overall +
  per-year, added on request — counts only remaining/unwatched portion).
- **Screen 2** — real YouTube IFrame Player API (not the mockup's fake
  timer) driving watch %.
- **Screen 3** — real completion modal (points-only / badge-unlock / 100%
  finale states), replaced an earlier toast stand-in.
- **Screen 4** — badges as **rows of progress bars**, not cards (changed on
  request): solid color tiers below 90% (red <30, orange 30-69, green
  70-89), rainbow gradient at ≥90%. Hat Trick and year badges get real
  partial credit, not just locked/unlocked.
- **Screen 5** — admin cohort table, passcode-gated (client-side only, see
  Security note below), sorted lowest-progress-first, same color-tier bars
  as Screen 4.

### Build Notes gaps — all resolved
1. Real 65-video catalog transcribed from the Sheet's `Videos` tab (real
   titles, YouTube links parsed to embed IDs, real EN/中文 tags) — replaced
   the mockup's 16-video placeholder.
2. Badge thresholds computed as % of `videos.length` at runtime, not
   hardcoded counts.
3. Hat Trick checks real `completedAt` timestamps for a 3-in-7-days window
   (`longestClusterWithinWindow` in api.js), not a lifetime count.
4. One "Videos for [Year]" badge per real year, sized to that year's real
   video count (renamed from "Class of [Year]" per user request).
5. Real YouTube IFrame API tracking, not a fake `setInterval`.
6. **Backend wiring — the only unfinished item.** Still mock/localStorage.
   This is where to pick up. See below.

### Known data-quality issue (flagged to user, not silently fixed)
The Sheet's `Duration (sec)` column is off by ×60 at the source — e.g. "CSA
in 60 Seconds: Xavier" is stored as `3600` (which is 3600 real seconds =
1hr, but the video is 60 seconds). `js/api.js`'s `DURATION_CORRECTION_FACTOR
= 60` divides it back down. **This correction should stay in the code even
after backend wiring**, unless the user fixes the raw Sheet data directly —
check which before removing it.

### Bugs hit and fixed during build (for context, don't reintroduce)
- `.screen[hidden]` and `.admin-gate[hidden]` both needed explicit
  `display:none` overrides — author CSS with an unconditional `display:flex`
  beats the browser's default `[hidden]{display:none}` in the cascade.
- Screen 3's finale modal used to show two identical "Back to playlist"
  buttons — fixed by hiding the secondary button when the primary already
  covers the same destination.
- `admin.html` at Netlify's root wasn't resolving (likely an SPA catch-all
  redirect) — moved to `admin/index.html` (Netlify's standard multi-page
  convention), fixed.

## Backend wiring — where we stopped (Build Notes #6)

**Google Sheets side (user's progress, confirmed done):**
- Real Google Sheet created from the xlsx template, **Sheet ID saved in
  Claude's memory** (`llca-sheet-id.md` in this project's memory dir) —
  recall it, don't ask the user to repeat it.
- Google Cloud service account created, sheet shared with it as Editor
  (per user, not independently verified).
- Roster tab: 50 generated tokens (6-char, ambiguous chars excluded) written
  into the **local xlsx template's** Roster tab (Name/Email blank, user
  fills in as members are confirmed). User has copied their own row (with
  real name/email) into the **live** Sheet already, using one of the
  tokens, to test with. Rest of the roster is pending real names from LLCA.

**Sheet tab structures (confirmed by parsing the xlsx directly):**
- `Videos`: Video ID | Year | Name of Video | Lang | Link | Duration (sec)
- `Roster`: Token | Name | Email | Date Added
- `Progress`: Token | Video ID | Watched % | Completed | Last Updated |
  Points | Key (Key = `Token|VID<id>`, used for upsert lookup)
- `Overview`: read-only, **formula-driven off Roster/Progress**
  (`=IFERROR(Roster!$A$4,"")` etc.) — confirmed via openpyxl. Nothing our
  code needs to write to directly.

**Git/Netlify side (in progress, this is the actual next step):**
- Local repo initialized on `main`, all files `git add`-ed but
  **not yet committed** (only commit/push when explicitly asked).
- `.gitignore` excludes `*.xlsx` (has real PII now), `.DS_Store`,
  `node_modules/`, `.netlify/`.
- Local (repo-scoped, not global) git identity set: user.name
  `llca-events`, user.email `events@llca-sg.org` — deliberately different
  from the machine's global git identity (Fiona Li), per user request to
  push under a separate GitHub account.
- Dedicated SSH keypair generated: `~/.ssh/id_ed25519_llca_events` (+
  `.pub`), no passphrase. `~/.ssh/config` has a `Host github-llca` alias
  pointing at that key (`IdentitiesOnly yes`), so a remote like
  `git@github-llca:llca-events/<repo>.git` will auth as that account
  without touching the user's default GitHub SSH key.
- **Waiting on the user** to: (1) add the public key to the `llca-events`
  GitHub account (Settings → SSH and GPG keys — the `.pub` file's content
  is safe to read/paste, it's not a secret), (2) create an empty repo on
  github.com under `llca-events`, (3) give the repo URL.
- Once we have the repo URL: `git remote add origin
  git@github-llca:llca-events/<repo>.git`, commit, push, then connect that
  repo in Netlify (or continue with manual/CLI deploy — user hadn't
  finalized which before this session ended either way, confirm).

**Still to build once git/Netlify is sorted:**
- `netlify/functions/sheets.js` — reads Videos/Roster, reads+writes
  Progress via `googleapis` + service account auth (env vars:
  `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`,
  `GOOGLE_SHEET_ID`, `ADMIN_PASSCODE`) — user sets these directly in the
  Netlify dashboard, never pastes secrets into chat.
- Swap `js/api.js`'s mock functions for real `fetch()` calls when
  `CONFIG.useMockData` flips to `false` — same return shapes, `app.js`/
  `admin.js` shouldn't need changes.
- Move the Screen 5 passcode check server-side into that function (current
  `CONFIG.adminPasscode` in `config.js` is a documented, deliberate
  placeholder — plaintext client-side, not real security).
- `getRoster()`/admin aggregation needs to compute each member's done-count
  from real Progress rows instead of the current mock array.
- Test against a Netlify **branch/preview deploy** before pointing real
  members at production.

## Testing conventions used throughout this build
- Local preview: `python3 -m http.server 8934 --directory "<project path>"`
  then open `http://localhost:8934/index.html?m=demo-mid` (also
  `demo-fresh`, `demo-done`). **Never open via `file://`** — YouTube's
  IFrame API needs a real http(s) origin, this was confirmed as a hard
  failure mode, not a preference.
- Mock member tokens: `demo-fresh` (0%), `demo-mid` (20%, staged to also
  exercise Hat Trick's date-window logic — not just a lifetime-3 count),
  `demo-done` (100%).
- `localStorage` key `llca-progress-<token>` holds progress overrides on
  top of seed data — clear it (`localStorage.removeItem(...)`) when a demo
  token's state has drifted from earlier manual testing.
- Browser hard-reload (`cmd+shift+r`) needed after editing `config.js`/
  any JS during a test session — plain reload can serve a stale cached
  script from `python3 -m http.server`, which has bitten this build once
  already (looked like a real bug, wasn't).
