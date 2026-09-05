// api.js — all data access lives here. Nothing in app.js should read
// mock data, localStorage, or (later) the Netlify Function directly.
//
// TEMPORARY: while CONFIG.useMockData is true, "persistence" is a
// localStorage layer on top of seeded mock data, so progress survives
// navigating between screens/reloads during frontend-only development.
// When the backend is wired (Build Notes #6), the functions below keep
// their same signatures/return shapes but call CONFIG.sheetsApiEndpoint
// instead — app.js does not need to change.

// ---------------------------------------------------------------------
// Video catalog — real data, transcribed from the `Videos` tab of
// LLCA_Tracker_GoogleSheet_Template.xlsx (Build Notes #1). Member
// progress below is still mock/localStorage; this catalog is real.
// Columns: [Video ID, Year, Name of Video, Lang, Link, Duration (sec)]
// Row order matches the sheet (already sorted by year, then Video ID).
const RAW_VIDEO_ROWS = [
  [1, 2021, 'Happy Go Lucky 2 | Episode 1: Set strong passwords and enable 2FA', '中文', 'https://youtu.be/R3vmGAStt2U', 15000],
  [2, 2021, 'Happy Go Lucky 2 | Episode 2: Spot signs of phishing', '中文', 'https://youtu.be/IsPwTKCYw_Y', 12000],
  [3, 2021, 'Happy Go Lucky 2 | Episode 3: Use an anti-virus software', '中文', 'https://youtu.be/U0IfiOl-8nI', 11340],
  [4, 2021, 'Digital Defence: How To Be Cybersafe?', 'EN', 'https://youtu.be/kQzLiygnSWY', 59640],
  [5, 2021, 'CyberPunk’d By Channel NewsAsia', 'EN', 'https://youtu.be/fXAasv-I77U', 172560],
  [6, 2021, "Let's Talk Cyber: Are we really safe online?", 'EN', 'https://youtu.be/8d8HG1X8m60', 23580],
  [7, 2021, "Let's Talk Cyber: How Cyber Savvy Are You?", 'EN', 'https://youtu.be/jBbESe2-QpQ', 19260],
  [8, 2021, 'Part 1: The Digital Threat to Nations', 'EN', 'https://youtu.be/1oj91oe3API', 163680],
  [9, 2021, 'Part 2: Law and Order in Cyberspace', 'EN', 'https://youtu.be/sPLTLx-p53I', 169980],
  [10, 2022, 'What can you do in 39s?', 'EN', 'https://youtu.be/MH7FP0AIHuY', 3600],
  [11, 2022, 'How to Create Strong Passwords and Enable 2FA (English)  1/2', 'EN', 'https://youtu.be/cKUeW7Laqis', 14220],
  [12, 2022, 'How to Create Strong Passwords and Enable 2FA (English)  1/2', 'EN', 'https://youtu.be/0DKAKC-MYY0', 13740],
  [13, 2022, 'How to Create Strong Passwords and Enable 2FA (Chinese)', '中文', 'https://youtu.be/EYmWIEYlFvM', 15600],
  [14, 2022, 'Hossan Leong’s Personal Recount of WhatsApp Hijacking', 'EN', 'https://youtu.be/IgyklXzshaI', 5400],
  [15, 2022, 'Michelle Teaches Papa Chong To Be Cautious Of Phishing Scams!', 'EN', 'https://youtu.be/s2duZQpDqyk', 16680],
  [16, 2022, 'Get Safe Cyber Series - Episode 1: The hacked game account', 'EN', 'https://youtu.be/Z7POJ8_w-ak', 25080],
  [17, 2022, 'Get Safe Cyber Series - Episode 2: The "movie" malware', 'EN', 'https://youtu.be/qRLDCA2Yvlc', 29700],
  [18, 2022, 'Get Safe Cyber Series - Episode 3: The friendly "phishy" email', 'EN', 'https://youtu.be/s2Mep2cWpKk', 23580],
  [19, 2022, 'Get Safe Cyber Series - Episode 4: The "phishy" delivery message', 'EN', 'https://youtu.be/uQ2giJoi4pU', 22440],
  [20, 2022, 'Get Safe Cyber Series - Episode 5: The hacked home camera and the viral video', 'EN', 'https://youtu.be/XocOQmHLbLw', 27720],
  [21, 2022, 'Get Safe Cyber Series - Episode 6: The botnet attacks', 'EN', 'https://youtu.be/kOtXaXTm_ys', 19740],
  [22, 2023, "CSA's corporate video: The Cyber Gambit", 'EN', 'https://youtu.be/ahMvpqhqSbk', 8820],
  [23, 2023, 'Cyber Sandra - Episode 1: Strong Passwords', 'EN', 'https://youtu.be/7ya1t51lIcQ', 6000],
  [24, 2023, 'Cyber Sandra - Episode 2: Social Media Impersonation', 'EN', 'https://youtu.be/Ta6qq7wnpcA', 5760],
  [25, 2023, 'Cyber Sandra - Episode 3: WhatsApp Hijacking', 'EN', 'https://youtu.be/IUJi6sKA3aM', 6480],
  [26, 2023, 'Cyber Sandra - Episode 4: Enabling Two-Factor Aunthentication', 'EN', 'https://youtu.be/Rz-l8MsTFxo', 6240],
  [27, 2023, 'Cyber Sandra - Episode 5: Anti-Virus Software', 'EN', 'https://youtu.be/7KM-cvKHKWE', 5820],
  [28, 2023, 'Basics of Staying Safe Online', 'EN', 'https://youtu.be/KqMwoG1X__A', 145380],
  [29, 2023, 'Let’s Go Cyber Safe Ep 1: Protect Yourself From Phishing', 'EN', 'https://youtu.be/7ar_NfsXQAo', 7680],
  [30, 2023, 'Let’s Go Cyber Safe Ep 2: Set Strong Passphrases', 'EN', 'https://youtu.be/kux5EZmnidQ', 8700],
  [31, 2023, 'Let’s Go Cyber Safe Ep 3: Protect Your Devices', 'EN', 'https://youtu.be/WLYAx_WcwtY', 13080],
  [32, 2023, 'Let’s Go Cyber Safe Ep 4: Report Cyber Incidents', 'EN', 'https://youtu.be/PNfe7jkCK6I', 8040],
  [33, 2024, 'Spot the Deepfakes', 'EN', 'https://youtu.be/6VGUD0KWvTc', 10800],
  [34, 2024, 'Cyber Sara - Episode 1: Mobile Is The New Target', 'EN', 'https://youtu.be/idcUoYjyrF4', 12360],
  [35, 2024, 'Cyber Sara - Episode 2: Staying Safe Online (Kids Edition)', 'EN', 'https://youtu.be/M4Tm8q4bwVw', 12960],
  [36, 2024, 'Cyber Sara - Episode 3: Social Engineering', 'EN', 'https://youtu.be/hdN2yd09dmc', 14040],
  [37, 2024, 'Cyber Sara - Episode 4: Protect Your Smart Home From Hackers', 'EN', 'https://youtu.be/ubxB53og_gM', 13500],
  [38, 2024, 'Cyber Sara - Episode 5: How To Play It Safe Online', 'EN', 'https://youtu.be/zPLLyGgNhM0', 5400],
  [39, 2024, 'Cyber Sara - Episode 6: Cyber Safety For Seniors - Online Banking Edition', 'EN', 'https://youtu.be/yWboaBqvCMw', 8940],
  [40, 2024, 'Cyber Sara - Episode 7: Top 3 Cyber Horror-Ween Crimes', 'EN', 'https://youtu.be/jVj_l6mrIuI', 5460],
  [41, 2024, "Cyber Sara - Episode 8: Cyber Sara's Top Tips For Shopping Safely Online", 'EN', 'https://youtu.be/P8hdSN2NqvU', 6120],
  [42, 2024, "Cyber Sara - Episode 9: Cyber Sara's 2022 Cyber Safe Wrap List", 'EN', 'https://youtu.be/4lmpHPRLVdU', 7560],
  [43, 2024, 'Cyber Sara - Episode 10: Social Media Safety - WhatsApp Edition', 'EN', 'https://youtu.be/eEsIlphCUHo', 4080],
  [44, 2024, "Cyber Sara - Episode 11: CSA's Cybersecurity Self-Help Tools", 'EN', 'https://youtu.be/HEXE-hH7ksA', 7620],
  [45, 2024, 'Talking Point: How Do Scammers Take Over Your Phone And Steal Your Money?', 'EN', 'https://youtu.be/LsNNGxnXON8', 84000],
  [46, 2024, 'Kids meet Cyber Chief - Part 1', 'EN', 'https://youtu.be/LPIJyeBZ2Ew', 10260],
  [47, 2024, 'Kids meet Cyber Chief - Part 2', 'EN', 'https://youtu.be/9_UQ2I-M1uA', 10200],
  [48, 2024, "The Unseen Enemy | CSA's Fifth National Cybersecurity Campaign", 'EN', 'https://youtu.be/mI1s8W6Q0gg', 3600],
  [49, 2024, 'Be Cyber Safe #1: Impersonation Scams', 'EN', 'https://youtu.be/9oZzB7Ei-RU', 15300],
  [50, 2024, 'Be Cyber Safe #2: Malware & E-commerce Scams', 'EN', 'https://youtu.be/gUbjj_izcdg', 12000],
  [60, 2024, 'Be Cyber Safe #3: Spot Phishing Scams', 'EN', 'https://youtu.be/pUkwGebOw6g', 8940],
  [61, 2024, 'Be Cyber Safe #4: Phishing Tips for Grandpa', 'EN', 'https://youtu.be/Gmncsgxw_0E', 14280],
  [62, 2024, 'Be Cyber Safe Gameshow #1: Spot Impersonation Scams', '中文', 'https://youtu.be/slLfA9c--TU', 16440],
  [63, 2024, 'Be Cyber Safe Gameshow #2: Spot Government Official Impersonation Scams', '中文', 'https://youtu.be/G9WY5gOXRrQ', 8160],
  [64, 2024, 'Be Cyber Safe Gameshow #3: Staying safe from Malware', '中文', 'https://youtu.be/6_TvuVs6YRA', 14460],
  [65, 2024, 'Be Cyber Safe Gameshow #4: Generative AI', '中文', 'https://youtu.be/4TNQtNz9qB0', 8280],
  [66, 2024, 'Ask the Cyber Experts - Episode 1', 'EN', 'https://youtu.be/Y1jOGS2LRIQ', 6180],
  [67, 2024, 'Ask the Cyber Experts - Episode 2', 'EN', 'https://youtu.be/YD6vg1HJFEk', 9720],
  [68, 2024, 'CSA in 60 Seconds: Xavier', 'EN', 'https://youtu.be/kL2IGeuRB3g', 3600],
  [69, 2024, 'CSA in 60 Seconds: Ke Jing', 'EN', 'https://youtu.be/ANBoTbZ53SI', 3600],
  [70, 2024, 'SA in 60 Seconds: Kelvin', 'EN', 'https://youtu.be/GGUnCFlgCWg', 3600],
  [71, 2024, 'CSA in 60 Seconds: Paul', 'EN', 'https://youtube.com/shorts/JYJv1IUDQRY', 3600],
  [72, 2025, 'Cyber Sandy Episode 1: Deepfake Dangers', 'EN', 'https://youtu.be/MJIpZF050Ks', 17520],
  [73, 2025, 'Cyber Sandy Episode 2: The BOTNET Menace', 'EN', 'https://youtu.be/DpwkqXZXBpc', 12840],
  [78, 2025, 'Cyber Sandy: Episode 3: What is Operational Technology (OT)?', 'EN', 'https://youtu.be/l9yJIjeYJdE', 23040]
];

// Pulls the YouTube video ID out of a youtu.be / youtube.com/shorts link
// (whatever form the sheet's Link column happens to use).
function extractYoutubeId(url) {
  const short = url.match(/youtu\.be\/([\w-]+)/);
  if (short) return short[1];
  const shorts = url.match(/youtube\.com\/shorts\/([\w-]+)/);
  if (shorts) return shorts[1];
  const watch = url.match(/[?&]v=([\w-]+)/);
  if (watch) return watch[1];
  return url;
}

function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// The sheet's "Duration (sec)" column is off by a factor of 60 at the
// source — e.g. "CSA in 60 Seconds: Xavier" is stored as 3600, which is
// 3600/60 = 60 real seconds (1:00), not 3600 real seconds (1:00:00).
// Confirmed against several titled-by-length videos in the catalog.
// Divide by 60 to get the real duration until the sheet itself is fixed.
const DURATION_CORRECTION_FACTOR = 60;

const CATALOG = RAW_VIDEO_ROWS.map(([id, year, title, lang, link, seconds]) => {
  const durationSeconds = Math.round(seconds / DURATION_CORRECTION_FACTOR);
  return {
    id,
    year,
    title,
    lang,
    dur: formatDuration(durationSeconds),
    durationSeconds, // kept alongside `dur` so app.js can sum remaining watch time
    youtubeId: extractYoutubeId(link)
  };
});

function getVideos() {
  if (CONFIG.useMockData) return Promise.resolve(CATALOG);
  return fetch(`${CONFIG.sheetsApiEndpoint}?resource=videos`).then((res) => {
    if (!res.ok) throw new Error('failed to load videos');
    return res.json();
  });
}

// ---------------------------------------------------------------------
// Mock member progress
// ---------------------------------------------------------------------
// Progress record shape (matches the future `Progress` sheet tab):
//   { videoId, status: 'todo' | 'partial' | 'done', pct, completedAt }
// `completedAt` is an ISO timestamp, only set once status is 'done' —
// it's what Hat Trick's date-window check reads (Build Notes #3).

function daysAgoIso(days, hours = 0) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(d.getHours() - hours);
  return d.toISOString();
}

function seedProgressFor(token) {
  const map = {};
  CATALOG.forEach((v) => { map[v.id] = { videoId: v.id, status: 'todo', pct: 0, completedAt: null }; });

  if (token === 'demo-fresh') {
    return map; // everything todo
  }

  if (token === 'demo-done') {
    CATALOG.forEach((v) => {
      map[v.id] = { videoId: v.id, status: 'done', pct: 100, completedAt: daysAgoIso(30) };
    });
    return map;
  }

  // demo-mid (default): first 9 videos (all of 2021) done long ago so
  // "Class of 2021" is earned, three more done within the last 4 days
  // (within the 7-day Hat Trick window) plus one done 20 days ago so the
  // seed data actually exercises the date-window logic — not just a
  // lifetime count of 3 — and one video partway through.
  const done2021 = CATALOG.filter((v) => v.year === 2021);
  done2021.forEach((v, idx) => {
    map[v.id] = { videoId: v.id, status: 'done', pct: 100, completedAt: daysAgoIso(60 - idx) };
  });

  const nextThree = CATALOG.filter((v) => v.year === 2022).slice(0, 3);
  nextThree.forEach((v, idx) => {
    map[v.id] = { videoId: v.id, status: 'done', pct: 100, completedAt: daysAgoIso(3 - idx) };
  });

  const oldOne = CATALOG.filter((v) => v.year === 2022)[3];
  if (oldOne) {
    map[oldOne.id] = { videoId: oldOne.id, status: 'done', pct: 100, completedAt: daysAgoIso(20) };
  }

  const partial = CATALOG.filter((v) => v.year === 2022)[4];
  if (partial) {
    map[partial.id] = { videoId: partial.id, status: 'partial', pct: 35, completedAt: null };
  }

  return map;
}

function storageKey(token) {
  return `llca-progress-${token}`;
}

function loadOverrides(token) {
  try {
    const raw = window.localStorage.getItem(storageKey(token));
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveOverrides(token, overrides) {
  try {
    window.localStorage.setItem(storageKey(token), JSON.stringify(overrides));
  } catch (e) {
    // localStorage unavailable (private mode, etc.) — progress just
    // won't persist across reloads until the real backend is wired.
  }
}

function getMemberProgress(token) {
  if (CONFIG.useMockData) {
    const seed = seedProgressFor(token);
    const overrides = loadOverrides(token);
    return Promise.resolve(Object.assign({}, seed, overrides));
  }
  return fetch(`${CONFIG.sheetsApiEndpoint}?resource=progress&token=${encodeURIComponent(token)}`).then((res) => {
    if (!res.ok) throw new Error('failed to load progress');
    return res.json();
  });
}

function getMemberName(token) {
  if (CONFIG.useMockData) {
    const names = { 'demo-fresh': 'Alex', 'demo-mid': 'Jane', 'demo-done': 'Priya' };
    return Promise.resolve(names[token] || 'Member');
  }
  return fetch(`${CONFIG.sheetsApiEndpoint}?resource=member&token=${encodeURIComponent(token)}`).then((res) => {
    if (!res.ok) throw new Error('failed to load member');
    return res.json();
  }).then((data) => data.name || 'Member');
}

function markVideoStatus(token, videoId, status, pct) {
  if (CONFIG.useMockData) {
    const overrides = loadOverrides(token);
    overrides[videoId] = {
      videoId,
      status,
      pct,
      completedAt: status === 'done' ? new Date().toISOString() : null
    };
    saveOverrides(token, overrides);
    return Promise.resolve(overrides[videoId]);
  }
  const points = status === 'done' ? CONFIG.pointsPerVideo : 0;
  return fetch(`${CONFIG.sheetsApiEndpoint}?resource=progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, videoId, status, pct, points })
  }).then((res) => {
    if (!res.ok) throw new Error('failed to save progress');
    return res.json();
  });
}

// ---------------------------------------------------------------------
// Mock cohort roster — Screen 5 (admin only)
// ---------------------------------------------------------------------
// Build Notes #6: the real roster + each member's completion count pulls
// live from the Sheet via the Netlify Function once that's wired. Until
// then this is a placeholder list sized within the spec's 30-50 member
// range, expressed against the real 65-video catalog (not the mockup's
// 14-person / 16-video demo numbers).
const MOCK_ROSTER = [
  ['Marcus Oyelaran', 0], ['Dee Whitfield', 4], ['Priya Sankaran', 8], ['Tom Beckett', 12],
  ['Alina Márquez', 16], ['Joyce Adeyemi', 20], ['Ravi Chandra', 29], ['Ken Ishida', 33],
  ['Sofia Brennan', 36], ['Nadia Haddad', 45], ['Gus Lindqvist', 49], ['Bea Okonkwo', 57],
  ['Jane Ferreira', 61], ['Amos Kelly', 65],
  ['Wei Lin Tan', 2], ['Farid Rahman', 6], ['Camille Dubois', 10], ['Hassan Ali', 14],
  ['Ingrid Solberg', 18], ['Kwame Boateng', 22], ['Yuki Nakamura', 25], ['Elena Popescu', 27],
  ['Diego Fernandes', 31], ['Aisha Bello', 35], ['Lucas Meyer', 38], ['Noor Al-Sayed', 41],
  ['Petra Novak', 43], ['Sanjay Kapoor', 46], ['Freya Nilsson', 50], ['Chidi Okafor', 52],
  ['Mei Ling Goh', 54], ['Omar Siddiqui', 56], ['Bianca Rossi', 58], ['Kofi Mensah', 60],
  ['Anjali Rao', 62], ['Liam O’Sullivan', 63], ['Zara Ahmed', 65],
  ['Henrik Larsen', 64], ['Grace Mutua', 65], ['Pavel Horak', 65], ['Isabel Cruz', 65]
];

// Real access control lives server-side in the Netlify Function — this
// passcode is only checked client-side in mock mode, for demo purposes.
function getRoster(passcode) {
  if (CONFIG.useMockData) {
    if (passcode !== CONFIG.adminPasscode) return Promise.reject(new Error('wrong passcode'));
    const total = CATALOG.length;
    const roster = MOCK_ROSTER.map(([name, doneCount]) => ({
      name,
      doneCount,
      totalCount: total,
      pct: Math.round((doneCount / total) * 100)
    }));
    return Promise.resolve(roster);
  }
  return fetch(`${CONFIG.sheetsApiEndpoint}?resource=roster&passcode=${encodeURIComponent(passcode)}`).then((res) => {
    if (res.status === 401) throw new Error('wrong passcode');
    if (!res.ok) throw new Error('failed to load roster');
    return res.json();
  });
}

// ---------------------------------------------------------------------
// Badges — thresholds computed from real data, not fixed demo numbers.
// ---------------------------------------------------------------------

function pctThreshold(total, pct) {
  return Math.max(1, Math.round((pct / 100) * total));
}

// Longest run of 'done' completions (by completedAt) that fits inside a
// CONFIG.hatTrick.windowDays rolling window. Shared by Hat Trick's
// isEarned check and its progress-bar percentage.
function longestClusterWithinWindow(videos, progressMap) {
  const done = videos
    .map((v) => progressMap[v.id])
    .filter((p) => p && p.status === 'done' && p.completedAt)
    .map((p) => new Date(p.completedAt).getTime())
    .sort((a, b) => a - b);
  const windowMs = CONFIG.hatTrick.windowDays * 24 * 60 * 60 * 1000;
  let best = 0;
  for (let i = 0; i < done.length; i++) {
    let count = 1;
    for (let j = i + 1; j < done.length && done[j] - done[i] <= windowMs; j++) count++;
    if (count > best) best = count;
  }
  return best;
}

// Returns badge definitions with an `isEarned(progressMap)` check and a
// `progressPct(progressMap)` (0-100, for the Screen 4 progress bars)
// baked in, resolved against the real video catalog passed in.
function getBadgeDefinitions(videos) {
  const total = videos.length;
  const years = Array.from(new Set(videos.map((v) => v.year))).sort();

  const countDone = (progressMap) =>
    videos.filter((v) => progressMap[v.id] && progressMap[v.id].status === 'done').length;

  const badges = [
    {
      id: 'first',
      icon: '🐣',
      name: 'First Steps',
      hint: 'Watch your first video',
      line: 'Watched your first video',
      isEarned: (progressMap) => countDone(progressMap) >= 1,
      progressPct: (progressMap) => (countDone(progressMap) >= 1 ? 100 : 0)
    },
    {
      id: 'hat',
      icon: '⚡',
      name: 'Hat Trick',
      hint: `${CONFIG.hatTrick.count} videos in one week`,
      line: `${CONFIG.hatTrick.count} videos in one week`,
      // Build Notes #3: real date-window check, not a lifetime count.
      // Longest run of completions that fits inside the rolling window —
      // earned once that run reaches `count`; also doubles as partial
      // credit for the Screen 4 progress bar (e.g. 2 of 3 → 67%).
      isEarned: (progressMap) => longestClusterWithinWindow(videos, progressMap) >= CONFIG.hatTrick.count,
      progressPct: (progressMap) => Math.min(100, Math.round((longestClusterWithinWindow(videos, progressMap) / CONFIG.hatTrick.count) * 100))
    },
    // Build Notes #4: one "Videos for [Year]" badge per real year in the
    // catalog, each requiring every video in that year to be done —
    // sized dynamically per year, not a hardcoded count.
    ...years.map((year) => {
      const yearVideos = videos.filter((v) => v.year === year);
      return {
        id: `class-${year}`,
        icon: '📅',
        name: `Videos for ${year}`,
        hint: `Finish every ${year} video`,
        line: `Cleared the whole ${year} set`,
        isEarned: (progressMap) =>
          yearVideos.every((v) => progressMap[v.id] && progressMap[v.id].status === 'done'),
        progressPct: (progressMap) => Math.round(
          (yearVideos.filter((v) => progressMap[v.id] && progressMap[v.id].status === 'done').length / yearVideos.length) * 100
        )
      };
    }),
    // Build Notes #2: percentage-based thresholds resolved against the
    // real catalog size, not fixed counts from the 16-video mockup.
    {
      id: 'quarter',
      icon: '🌤️',
      name: 'Warm Up',
      hint: `Reach ${CONFIG.badgeThresholdPct.warmUp}% complete`,
      line: 'A quarter of the way there',
      isEarned: (progressMap) => countDone(progressMap) >= pctThreshold(total, CONFIG.badgeThresholdPct.warmUp),
      progressPct: (progressMap) => Math.min(100, Math.round((countDone(progressMap) / pctThreshold(total, CONFIG.badgeThresholdPct.warmUp)) * 100))
    },
    {
      id: 'half',
      icon: '⛰️',
      name: 'Halfway There',
      hint: `Reach ${CONFIG.badgeThresholdPct.halfway}% complete`,
      line: 'Half the program done',
      isEarned: (progressMap) => countDone(progressMap) >= pctThreshold(total, CONFIG.badgeThresholdPct.halfway),
      progressPct: (progressMap) => Math.min(100, Math.round((countDone(progressMap) / pctThreshold(total, CONFIG.badgeThresholdPct.halfway)) * 100))
    },
    {
      id: 'sweep',
      icon: '🏆',
      name: 'Clean Sweep',
      hint: `Finish all ${total} videos`,
      line: `Finished all ${total} videos`,
      isEarned: (progressMap) => countDone(progressMap) >= pctThreshold(total, CONFIG.badgeThresholdPct.sweep),
      progressPct: (progressMap) => Math.min(100, Math.round((countDone(progressMap) / pctThreshold(total, CONFIG.badgeThresholdPct.sweep)) * 100))
    }
  ];

  return badges;
}
