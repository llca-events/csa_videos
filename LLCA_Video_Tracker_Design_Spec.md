# LLCA Cybersecurity Video Tracker — Design Spec

## Project Overview
A gamified video-training tracker for a group of 30–50 members. Each member accesses their own personal playlist via a unique link (no login/password screen). They watch a series of cybersecurity training videos, earn points and badges as they go, and see their own progress on a rainbow progress bar. The admin (one person) tracks everyone's completion from a separate, private screen.

## Design Principles
- **Mobile-first.** Most members will open this on a phone. Design at ~375px width first, scale up.
- **Fun over corporate.** This is compliance training in disguise — it should feel like a game, not a checklist.
- **Zero friction.** No login, no signup, no forms. Members land straight on their content.
- **Legible over decorative** on the one admin screen — that one just needs to be screenshot-clean.

## Global Design Elements

**Rainbow progress bar** (appears on Screens 1 and 2)
- Horizontal bar, rounded ends.
- Fill is a left-to-right gradient across the full rainbow (red → orange → yellow → green → blue → indigo → violet), but only the portion up to current % completion is visible/filled — the remaining track is a light neutral grey.
- Example: at 40% complete, the bar shows red→orange→yellow gradient filled to 40% of the bar's width, grey for the remaining 60%.
- Include the % as a number near the bar (e.g. "42% complete").

**Color palette:** bright, saturated accent colors (supports the rainbow theme) against a clean white/light-neutral background. Avoid heavy dark themes — keep it light and energetic.

**Typography:** rounded, friendly sans-serif for headings; clean readable sans-serif for body/list text.

**Tone:** encouraging, game-like microcopy ("Nice! 3 videos down." / "1 more for your next badge") rather than clinical ("Video marked complete").

---

## Screen 1 — Personal Playlist (Home)

**Purpose:** The member's landing screen. Opens directly from their personal link — this is the first thing they ever see, no login step before it.

**Elements:**
- Greeting with their name (e.g. "Hi Jane 👋")
- Rainbow progress bar showing overall % complete across all videos
- Points total and badge count, shown prominently near the top
- Video list grouped by year (2021–2025), each row showing:
  - Video title
  - Duration
  - Status indicator: not started / in progress / watched ✓ (use icon or color, not just text)
- Tapping any video opens Screen 2 (Video Player)

**States:** empty/fresh (0% complete, no badges yet) vs. mid-progress vs. fully complete (100%, all badges earned — should feel celebratory, not just a maxed-out bar).

---

## Screen 2 — Video Player

**Purpose:** Where the member actually watches a video. Progress here is what drives the rainbow bar and completion status.

**Elements:**
- Embedded video player, full-width
- Thin progress ring or bar overlaid or below the player, showing real-time watch % of *this specific video* (distinct from the overall rainbow bar on Screen 1)
- "Up Next" section below the player — shows the next unwatched video in sequence, with a thumbnail/title, so members can continue straight into it
- Back button to return to Screen 1

**States:** just started (0% of this video) / partway through / just crossed completion threshold (~90%) — this last state should transition into Screen 3.

---

## Screen 3 — Completion Moment

**Purpose:** A short celebratory moment that fires the instant a video is marked complete (~90% watched). This is the "game" payoff — without it, the app is just a video list.

**Elements:**
- Modal or full-screen overlay (designer's choice) appearing over Screen 2
- Confirms the video is complete
- If a new badge was just unlocked, show it here (badge icon + name, e.g. "🏅 First Steps — watched your first video")
- Shows points just earned (e.g. "+10 points")
- Dismiss/continue button, returns to Screen 1 or advances to next video in "Up Next"

**States:** completion with no new badge (just points) vs. completion that also unlocks a badge (bigger celebration) vs. completion of the very last video (100% overall — biggest celebration state).

---

## Screen 4 — Badges & Progress

**Purpose:** The payoff screen where members can review everything they've earned. Reachable from Screen 1 (e.g. tapping the points/badge summary).

**Elements:**
- Grid of badges, each shown either unlocked (full color, icon visible) or locked (greyed out/silhouette, maybe with a hint of what unlocks it)
- Suggested badge set: "First Video", "25% Complete", "50% Complete", "100% Complete", "3 in One Week" (streak badge) — designer can propose others that fit the visual grid better
- Points total, prominently displayed
- Overall rainbow progress bar repeated here for consistency with Screen 1

**States:** no badges yet vs. some unlocked/some locked vs. all badges unlocked.

---

## Screen 5 — Cohort Overview (Admin Only)

**Purpose:** Private screen for the admin only. Never seen by members. Used to check progress across the whole group and screenshot for manual updates to the group.

**Elements:**
- One row per member, showing name and % complete
- Sorted lowest-progress-first (surfaces who needs a nudge, more useful than alphabetical)
- Simple bar or numeric % per row — no rainbow theme needed here, this screen prioritizes legibility over fun
- Clean enough to screenshot directly and share

**Access note (not a design concern, flagging for build):** this screen sits behind a simple passcode, separate from the personal-link system members use — it's not part of the member-facing flow at all.

**States:** small group (~10 rows) vs. full group (~50 rows) — check that the list stays scannable at the larger count, may need to scroll rather than fit on one screen.

---

## Out of Scope for This Design Pass
- No public leaderboard (member progress is private to each individual)
- No login/password screens for members
- No admin controls beyond viewing (no editing member data from this UI — that happens in the underlying Google Sheet)
