# Build Notes — Mockup to Production Gaps

Reference alongside `LLCA-Video-Tracker.html` (the approved Claude Design mockup) and `LLCA_Video_Tracker_Design_Spec.md` (the original screen spec). These are the specific places where the mockup fakes something for demo purposes that must become real logic in the actual build.

## 1. Real video catalog, not the 16-video placeholder
The mockup's `VIDEOS` array has 16 sample videos for demo purposes. The real catalog has **65 videos**, distributed:
- 2021: 9
- 2022: 12
- 2023: 11
- 2024: 30
- 2025: 3

Source the real list from `Videos` tab in the Google Sheet (see `LLCA_Tracker_GoogleSheet_Template.xlsx`), not from the mockup's hardcoded array.

## 2. Badge thresholds must be percentage-based, not fixed counts
The mockup hardcodes badge unlock counts (`need: 4`, `need: 8`, `need: 16`) against its 16-video demo set. With 65 real videos, these must be computed as a percentage of the total:
- "Warm Up" → 25% of total (≈16 videos)
- "Halfway There" → 50% of total (≈33 videos)
- "Clean Sweep" → 100% of total (65 videos)

Do not port the fixed numbers directly — recompute against `videos.length` at build time.

## 3. "Hat Trick" badge needs real date logic
The mockup awards this badge purely on a running count (`n >= 3`), with no actual time window. The real requirement is **3 videos watched within a 7-day span**. This needs to check `Last Updated` timestamps in the `Progress` sheet/table for any 3 completions falling within 7 days of each other — not just a lifetime count of 3.

## 4. "Class of [Year]" badge must use real per-year counts
The mockup checks 2021 completion against a hardcoded count of 3. Each year has a different real count (9 / 12 / 11 / 30 / 3) — the check must be "all videos in this year marked done," dynamically sized per year, not a fixed number.

## 5. Real YouTube tracking, not the simulated timer
The mockup's "watching" is a `setInterval` that fakes progress by +3% every 90ms when Play is tapped. Production must use the actual **YouTube IFrame Player API** (`onStateChange`, `getCurrentTime()` vs `getDuration()`) to drive real watch percentage. The completion threshold logic (default 90%, configurable) carries over unchanged — only the data source driving `localPct` changes.

## 6. Wiring to the real backend
The mockup has no persistence — refreshing resets everything. Production needs:
- Member identified by URL token (`?m=<token>`), not the `memberName` prop
- Progress reads/writes go through the Netlify Function → Google Sheets `Progress` tab (see prior architecture)
- Admin overview (`roster` array) pulls live from the sheet, not the mockup's hardcoded 14-person list

## Everything else in the mockup is approved as-is
Layout, rainbow bar behavior, status dot logic, modal states, and the admin table's visual design do not need to change — only the data sources and the three logic gaps above.
