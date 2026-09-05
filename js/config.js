// config.js — connection setup only. No API calls, no DOM work here.
// This is the single place that changes when we wire up the real backend.

const CONFIG = {
  // Game rules (from design spec / mockup props panel)
  pointsPerVideo: 10,
  completionThreshold: 90, // % of a video that counts as "watched"

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

  // Backend wiring (Build Notes #6). Not live yet — frontend-only stage.
  // Once the Netlify Function + Google Sheet are ready, api.js will fetch
  // from this endpoint instead of using the mock data in api.js.
  sheetsApiEndpoint: '/.netlify/functions/sheets',
  useMockData: true,

  // Member is identified by a URL token (?m=<token>), never a name prop.
  // Falls back to a demo token so the app is viewable with no query string
  // while we're still on mock data.
  memberTokenParam: 'm',
  demoMemberToken: 'demo-mid',

  // Screen 5 (admin.html) gate — Design Spec: "sits behind a simple
  // passcode, separate from the personal-link system members use."
  // IMPORTANT: this is a plaintext client-side check, not real security —
  // anyone can read this file and see the passcode. It's a deterrent
  // against a member stumbling onto the URL, nothing more. Real access
  // control has to happen server-side once the Netlify Function is wired
  // (Build Notes #6): the function should require this passcode — or a
  // proper admin token — before it will return roster/progress rows,
  // so the real data is protected even if this client-side gate is
  // bypassed entirely.
  adminPasscode: 'llca-admin-2026',
  adminSessionKey: 'llca-admin-unlocked'
};

function getMemberToken() {
  const params = new URLSearchParams(window.location.search);
  return params.get(CONFIG.memberTokenParam) || CONFIG.demoMemberToken;
}
