// config.js — connection setup only. No API calls, no DOM work here.
// This is the single place that changes when we wire up the real backend.

const CONFIG = {
  // Game rules (from design spec / mockup props panel)
  pointsPerVideo: 10,
  completionThreshold: 98, // % of a video that counts as "watched". Was
  // 100, but the YT IFrame API's progress polling doesn't always land
  // exactly on 100 (buffering/timer granularity near the tail end), so a
  // real member's video could finish playing without ever triggering the
  // completion screen. 98 covers that gap while still requiring the tail
  // end to be watched.

  // Badge thresholds are PERCENTAGES of the total catalog size, not fixed
  // counts — see LLCA_Tracker_Build_Notes.md #2. Resolved against the real
  // video count at runtime in api.js (getBadgeDefinitions).
  badgeThresholdPct: {
    warmUp: 25,   // "Warm Up"
    halfway: 50,  // "Halfway There"
    sweep: 100    // "Clean Sweep"
  },

  // Hat Trick badge: N completions within a rolling window of days.
  // See Build Notes #3 — this replaces the mockup's lifetime count of 3.
  hatTrick: {
    count: 3,
    windowDays: 7
  },

  // Backend wiring (Build Notes #6) — LIVE. api.js now fetches from this
  // endpoint instead of using the mock data in api.js. Flip useMockData
  // back to true for local frontend-only testing (demo-fresh/mid/done
  // tokens only work in mock mode).
  sheetsApiEndpoint: '/.netlify/functions/sheets',
  useMockData: false,

  // Member is identified by a URL token (?m=<token>), never a name prop.
  // Falls back to a demo token so the app is viewable with no query string
  // while we're still on mock data.
  memberTokenParam: 'm',
  demoMemberToken: 'demo-mid',

  // Screen 5 (admin/) gate. Real enforcement now lives server-side in
  // netlify/functions/sheets.js (checks against the ADMIN_PASSCODE env
  // var) — the roster endpoint returns 401 for a wrong passcode
  // regardless of anything on this page. This constant is only used as
  // the mock-mode fallback (CONFIG.useMockData: true) for local demo
  // testing without a deployed function; it has no effect in production.
  adminPasscode: 'llca-admin-2026',
  adminSessionKey: 'llca-admin-unlocked'
};

function getMemberToken() {
  const params = new URLSearchParams(window.location.search);
  return params.get(CONFIG.memberTokenParam) || CONFIG.demoMemberToken;
}
