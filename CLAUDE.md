# LLCA Cybersecurity Video Tracker — Project State

Gamified video-training tracker for ~30-50 LLCA members. Static HTML/CSS/JS,
hosted on Netlify, one Netlify Function holds the Google service-account key
and reads/writes a Google Sheet. No other backend.

**Live and working:** `https://csa-videos.netlify.app/` — backend is fully
wired to the real Google Sheet, not mock data. Repo:
`github.com/llca-events/csa_videos` (pushed via SSH alias `github-llca`,
see Git/Netlify section below).

Reference docs in this folder — read before touching anything:
- `LLCA-Video-Tracker.html` — approved Claude Design mockup (visual/interaction
  reference; it's a bundled/escaped Design Canvas export, not plain HTML — the
  real source is a JSON-escaped blob inside it, has to be extracted/decoded to
  read).
- `LLCA_Video_Tracker_Design_Spec.md` — original 5-screen spec.
- `LLCA_Tracker_Build_Notes.md` — 6 things the mockup fakes that needed real
  logic in the build. **All 6 are done** (see below).
- `LLCA_Tracker_GoogleSheet_Template.xlsx` — local staging copy used to
  generate/hold Roster tokens before copy-pasting into the live Sheet.
  **Contains real PII** (user's own name/email) — gitignored, never upload
  to Netlify, never publish anywhere.

## Stack / file layout

```
index.html              Screen 1 (playlist) + Screen 2 (player) SPA
admin/index.html         Screen 5 (admin), served at /admin/ on Netlify —
                         NOT linked from index.html, deliberately unreachable
                         from the member flow. Root-absolute asset paths
                         (/css/..., /js/...) because it's one level deep.
css/styles.css           All visual system, transcribed from the mockup
js/config.js             Connection setup only (game rules, badge %,
                         member-token param, sheetsApiEndpoint,
                         useMockData — currently false, i.e. LIVE)
js/api.js                All data access. Every function branches on
                         CONFIG.useMockData: real fetch()/POST to the
                         Netlify Function when false, mock/localStorage
                         when true (mock mode kept for local dev only)
js/app.js                Screen 1/2/3/4 page behaviour (member SPA)
js/admin.js              Screen 5 page behaviour (separate script, own page)
netlify.toml              publish=".", functions="netlify/functions"
package.json              one dependency: googleapis
netlify/functions/sheets.js   the one serverless function — see below
```

## What's built (all 5 screens, verified live in browser each time)

- **Screen 1** — playlist, rainbow bar, "time left to finish" (overall +
  per-year — counts only remaining/unwatched portion).
- **Screen 2** — real YouTube IFrame Player API driving watch %. **Verified
  actually playing on the live production domain**, not just localhost.
- **Screen 3** — real completion modal (points-only / badge-unlock / 100%
  finale states). `CONFIG.completionThreshold` is **98%** (was 100 —
  changed because the YT IFrame API's progress polling doesn't always land
  exactly on 100 near the tail end, which could leave a fully-watched
  video never triggering the completion screen; 98 still requires
  watching essentially the whole thing). Has a dismiss-only **X** close button
  (top-right of the card) that just hides the modal, no navigation —
  distinct from the primary/secondary buttons which do navigate.
- **Screen 4** — badges as rows of progress bars: solid color tiers below
  90% (red <30, orange 30-69, green 70-89), rainbow gradient at ≥90%. Hat
  Trick and year badges get real partial credit, not just locked/unlocked.
- **Screen 5** — admin cohort table, sorted lowest-progress-first, same
  color-tier bars as Screen 4. **Passcode is genuinely checked server-side**
  now (see Backend section) — the client-side gate is UX only.

### Build Notes gaps — all resolved, including #6
1. Real 65-video catalog — now read live from the Sheet's `Videos` tab via
   the Function (was: transcribed into `js/api.js` as a frontend-stage step;
   that transcribed copy is still there as the mock-mode fallback).
2. Badge thresholds computed as % of `videos.length` at runtime.
3. Hat Trick checks real `completedAt` timestamps for a 3-in-7-days window
   (`longestClusterWithinWindow`), not a lifetime count.
4. One "Videos for [Year]" badge per real year, sized to that year's real
   video count.
5. Real YouTube IFrame API tracking.
6. **Backend wiring — done.** Real Sheet reads/writes confirmed live
   (see Backend section for exactly what's been tested vs. not).

### Known data-quality issue (flagged to user, not silently fixed)
The Sheet's `Duration (sec)` column is off by ×60 at the source. Corrected
in **two places** now that the backend is live — `js/api.js`'s mock catalog
AND `netlify/functions/sheets.js`'s real reader both divide by
`DURATION_CORRECTION_FACTOR = 60`. Keep both in sync if this ever changes;
don't remove either without fixing the raw Sheet data first.

### Bugs hit and fixed during the build (for context, don't reintroduce)
- `.screen[hidden]` and `.admin-gate[hidden]` needed explicit
  `display:none` overrides — author CSS with an unconditional `display:flex`
  beats the browser's default `[hidden]{display:none}` in the cascade.
- Screen 3's finale modal used to show two identical "Back to playlist"
  buttons — fixed by hiding the secondary button when the primary already
  covers the same destination.
- `admin.html` at Netlify's root wasn't resolving — moved to
  `admin/index.html` (Netlify's standard multi-page convention).
- **`google.auth.JWT(email, null, key, scopes)` (positional args) silently
  drops the key** on the `googleapis` version this project pins — newer
  versions need `new google.auth.JWT({ email, key, scopes })` (options
  object). This was the root cause of a confusing
  `invalid_grant: Invalid grant: account not found` error that looked like
  a bad service-account key but wasn't. If a future googleapis upgrade
  reintroduces auth failures, check this first.
- **Google Sheets API rejects a raw uploaded `.xlsx`** even though Drive
  previews it at a `docs.google.com/spreadsheets/d/...` URL —
  `"This operation is not supported for this document. The document must
  not be an Office file."` The file must actually be converted (Drive →
  Open with Google Sheets → File → Save as Google Sheets), which creates a
  **new file with a different ID**. The original xlsx's sharing settings
  don't carry over either — re-share the new converted file.
- **Converting xlsx→Sheets shifted every tab's rows by one** vs. the
  original file's assumed layout, which leaked the header row through as
  a phantom entry when the Function used exact row-offset ranges
  (`Videos!A3:F` etc.). Fixed by widening every range to the whole tab and
  filtering by **content shape** instead (numeric Video ID / token regex)
  — robust to future row shifts, don't go back to offset-based ranges.
- **YouTube IFrame API script-order race condition**: `index.html` used to
  load `https://www.youtube.com/iframe_api` *before* `js/app.js` defined
  `window.onYouTubeIframeAPIReady`. When that script loads fast (esp.
  cached), YouTube calls the ready callback before it exists — it fires
  into a void, `ytApiReady` never becomes true, and the player silently
  never renders (solid black box, no play button, no console error). Fixed
  by loading the YouTube script **last**, after `js/app.js`; also added a
  defensive check in `app.js` itself (`if (YT.Player) onYouTubeIframeAPIReady()`)
  in case some other caching quirk still lets YT finish first.
- **Write-path row-index bug**: the phantom-header-row fix (above) made
  `getProgressRows()` filter out non-data rows for read callers, but the
  `POST` write handler still computed `sheetRow = 3 + rowIndex` against
  that *filtered* array — indices no longer matched real sheet rows once
  filtering could skip rows. Fixed by having the write path read
  `PROGRESS_RANGE` **raw** (unfiltered) and compute `sheetRow = rowIndex + 1`
  directly from that A1-based range. This was silently causing updates to
  land as duplicate appended rows instead of overwriting the right one.
- **`buildProgressMap` let a later duplicate row mask a real completion**:
  if a video had more than one Progress row (a duplicate/stray from the
  bug above, or a retried write), whichever row came *last* in sheet order
  won — so a real "done" row followed by a stray leftover "partial" row
  would display as still-in-progress. Fixed: a completed row always wins
  regardless of row order; among multiple non-done rows, highest % wins.
- **Overview tab timestamps never showed, even with correct Progress
  data**: the sheet's own pre-existing formulas compare the Completed
  column to `TRUE()` with strict equality —
  `IF(INDEX(Progress!$D:$D, MATCH(...))=TRUE(), ...)`. The Function was
  writing the **number** `1`/`0` for that column, which looks equivalent
  but does not satisfy that comparison — Google Sheets needs an actual
  JSON **boolean** in the write payload to store a real boolean cell.
  Fixed by writing `completed` (a real JS boolean) instead of `1`/`0`.
  Confirmed live: a fresh completion's timestamp now shows correctly in
  Overview. Rows written *before* this fix keep their numeric value and
  won't retroactively appear — harmless, since it was only test data
  under the admin's own token, not real members.
- **Completion modal unreachable in mobile landscape**: `.modal-overlay`
  used `display:flex; align-items:center` with no overflow handling — a
  card taller than a short landscape viewport got clipped above the fold
  with no way to scroll up to the close button. Fixed by switching the
  overlay to block layout with its own `overflow-y:auto` and centering
  the card via `margin:auto` instead of flexbox, so it's always reachable
  regardless of viewport height.
- **Green completed-tick never showed after the boolean-write fix**:
  `readRange()` called `spreadsheets.values.get` with no
  `valueRenderOption`, so the default `FORMATTED_VALUE` returned every
  cell as a display string — a real boolean `Completed` cell came back as
  the string `"TRUE"`/`"FALSE"`, not JS `true`/`false`. `buildProgressMap`'s
  `completed` check (`r[3] === '1' || r[3] === 1 || r[3] === true`) never
  matched, so every fresh completion read back as `partial` at 100%
  (orange dot, "100% watched") instead of `done` (green ✓). Only surfaced
  once the earlier boolean-vs-number fix (see above) started writing real
  booleans instead of `1`/`0` — rows written as numbers still happened to
  round-trip through `FORMATTED_VALUE` as `"1"`/`"0"`, masking this until
  then. Fixed by adding `valueRenderOption: 'UNFORMATTED_VALUE'` to
  `readRange()`, which returns raw JS booleans/numbers — same
  `completed` check now matches both old numeric rows and new boolean
  ones. Affects every read path that goes through `getProgressRows`
  (member progress, admin cohort table).
- **`completionThreshold: 100` sometimes never triggered completion**:
  the YT IFrame API's progress polling samples on an interval and doesn't
  always report exactly 100% right as a video ends (buffering, timer
  granularity), so a member could genuinely finish watching and the
  completion screen would just never fire. Lowered to 98 — a deliberate
  tradeoff of "must watch essentially the whole video" over the strict
  "must watch literally every reported frame."
- **Completion screen sometimes just never appeared (separate cause)**:
  `completeVideo()` called `markVideoStatus()` (the write to the Sheet)
  with no `.catch()`. That write can reject — Netlify function cold
  start, a brief network drop, a Sheets API rate-limit — and a rejected
  promise never reaches `.then()`, so `showCompletionModal()` silently
  never ran. No console error, nothing — looked exactly like "the video
  didn't count." Fixed by retrying the write once, then falling back to
  an optimistic local "done" state so the modal always shows even if the
  persist never succeeds (logged to console in that last case so a
  genuinely-unsaved completion is still debuggable).
- **Admin passcode gate showed "wrong passcode" on a real, unchanged,
  correct passcode**: `tryUnlock()` in `admin.js` caught every
  `getRoster()` failure identically — a genuine 401 (actually wrong
  passcode) and a transient 500/network blip (same cold-start flakiness
  as the other fixes above) both landed on the same generic "wrong
  passcode" message. Confirmed live: the real passcode is
  `llca-admin-2026`, and a `resource=roster` request failed with a bare
  500 once, then succeeded immediately on retry with no code change.
  Fixed by having `tryUnlock()` retry once on any failure that isn't
  specifically the 401 `'wrong passcode'` error, and by showing a
  distinct "couldn't reach the server" message for that case instead of
  implying the passcode itself was wrong.

## Backend — Build Notes #6, now live

**Google Sheets side:**
- Real Sheet ID (converted, working): saved in Claude's memory
  (`llca-sheet-id.md`) — **recall it, don't ask the user to repeat it, and
  don't reuse the deprecated ID also noted in that file** (that one was the
  raw xlsx blob, rejected by the API).
- Service account: `cybersec-videos@llca-cybersecurity-videos.iam.gserviceaccount.com`,
  shared as Editor on the (correct, converted) Sheet. Auth confirmed working
  end-to-end.
- Netlify env vars set and confirmed correct: `GOOGLE_SERVICE_ACCOUNT_EMAIL`,
  `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `GOOGLE_SHEET_ID`, `ADMIN_PASSCODE`.
- Roster: real tokens generated earlier (50, 6-char, ambiguous chars
  excluded) are in the local xlsx staging copy; only the user's own
  row (real name/email) has been copied into the live Sheet so far. Rest
  of the roster is pending real names from LLCA — when those arrive, they
  get pasted into the live Sheet's Roster tab directly (no code change
  needed, the Function reads it live).
- Sheet tab structures (unchanged from earlier, still accurate):
  `Videos` (Video ID/Year/Name of Video/Lang/Link/Duration (sec)),
  `Roster` (Token/Name/Email/Date Added),
  `Progress` (Token/Video ID/Watched %/Completed/Last Updated/Points/Key,
  Key = `Token|VID<id>` for upsert), `Overview` (read-only, formula-driven
  off Roster/Progress, nothing writes to it directly).

**`netlify/functions/sheets.js` — confirmed working live:**
- `GET ?resource=videos` — real 65-video catalog, no phantom rows ✅
- `GET ?resource=member&token=...` — real Roster name lookup ✅
- `GET ?resource=progress&token=...` — real Progress read, correct
  empty-map shape for an untouched member ✅
- `GET ?resource=roster&passcode=...` — real server-side passcode
  enforcement, confirmed 401 on a wrong passcode ✅
- `POST ?resource=progress` (the write path — marking a video watched) —
  **confirmed working live**, including the Overview tab's completion
  timestamp displaying correctly (see the boolean-vs-number bug above —
  that's what made it look broken initially; it's fixed now).

**Git/Netlify — done:**
- Repo: `git@github-llca:llca-events/csa_videos.git`, pushed, `main`
  tracked. Local (repo-scoped) git identity: `llca-events` /
  `events@llca-sg.org`. SSH key `~/.ssh/id_ed25519_llca_events` +
  `~/.ssh/config` alias `github-llca` — auth confirmed working.
- Netlify site connected to that repo, auto-deploys on push, confirmed
  working end-to-end across ~10 iterative pushes while debugging the
  backend.
- `.gitignore` excludes `*.xlsx`, `.DS_Store`, `node_modules/`, `.netlify/`.

## What's actually left
1. **Fill in the real roster** — as LLCA sends member names, paste them
   into the live Sheet's Roster tab against the pre-generated tokens.
2. **Optional cleanup**: the admin's own test token (`2q747z`) has some
   duplicate/stray Progress rows and a few early completions stored with
   the old numeric `1` (pre-boolean-fix) that won't show in Overview.
   Harmless (not real member data), but can be manually deleted from the
   Progress tab if it's distracting.
3. Nothing else is outstanding from Build Notes — backend wiring, all 5
   screens, and every bug found during live testing are resolved.
4. **Known accepted gap**: the completion-write retry fix (see bug log)
   shows the completion screen locally even if both save attempts fail,
   but doesn't retry again after that — a completion can silently never
   reach the Sheet, so a member's own screen can show a higher % than
   admin's cohort view until they rewatch the affected video(s). Caught
   live once already (member showed 69%, admin/Sheet truth was 66%, a
   ~2-video gap). User's call: leave as is for now rather than add
   background-retry/queueing.

## Testing conventions used throughout this build
- Local preview (mock mode only — set `CONFIG.useMockData = true` first):
  `python3 -m http.server 8934 --directory "<project path>"` then open
  `http://localhost:8934/index.html?m=demo-mid` (also `demo-fresh`,
  `demo-done`). **Never open via `file://`** — YouTube's IFrame API needs a
  real http(s) origin.
- Live testing (real mode, `CONFIG.useMockData = false`, the current
  state): use the real deployed site and a real token, e.g.
  `https://csa-videos.netlify.app/?m=2q747z`. Mock demo tokens don't work
  in this mode.
- `localStorage` key `llca-progress-<token>` — only relevant in mock mode.
- Browser hard-reload (`cmd+shift+r`) needed after editing JS during a
  *local* test session — `python3 -m http.server` can serve a stale
  cached script otherwise. Not an issue against the live Netlify site.
- To debug the Function without dashboard access: temporarily add a
  `debug` object to its error response (non-secret env var presence/
  length/value where safe — e.g. the service-account email, the Sheet ID,
  a PEM-shape check on the key — never the raw key), redeploy, curl it,
  then **revert the debug block once fixed**. This is how the JWT-
  constructor bug, the wrong-Sheet-ID bug, and the truncated-email bug
  were all found this session — don't leave debug output live in
  production once an issue is resolved.
