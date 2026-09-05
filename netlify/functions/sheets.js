// netlify/functions/sheets.js — the one serverless function. Holds the
// Google service-account key (via env vars, never in this repo) and is
// the only thing that talks to the Google Sheet. js/api.js calls this
// over fetch() once CONFIG.useMockData is false; nothing else in the
// frontend touches Google APIs directly.
//
// Required Netlify environment variables (set in the dashboard, never
// committed): GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
// GOOGLE_SHEET_ID, ADMIN_PASSCODE.
//
// Sheet tab layout this expects (see CLAUDE.md for how it was confirmed):
//   Videos:   title row, header row, data from row 3 — A:F =
//             Video ID | Year | Name of Video | Lang | Link | Duration (sec)
//   Roster:   title row, blank row, header row, data from row 4 — A:D =
//             Token | Name | Email | Date Added
//   Progress: title row, header row, data from row 3 — A:G =
//             Token | Video ID | Watched % | Completed | Last Updated | Points | Key
//             (Watched % is a fraction, 1 = 100%, matching the sheet's own
//             example row — not a 0-100 integer.)

const { google } = require('googleapis');

// Ranges are deliberately wide (whole tab) rather than pinned to an
// assumed data-start row — converting the xlsx template to native
// Google Sheets shifted rows by one vs. the original file, which leaked
// the header row through as a phantom entry when ranges were exact.
// Real rows are picked out by content shape below instead.
const VIDEOS_RANGE = 'Videos!A1:F';
const ROSTER_RANGE = 'Roster!A1:D';
const PROGRESS_RANGE = 'Progress!A1:G';

// Same fix as js/api.js — the sheet's Duration (sec) column is off by
// ×60 at the source. Kept here too since this is a separate runtime.
const DURATION_CORRECTION_FACTOR = 60;

function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function extractYoutubeId(url) {
  const short = String(url || '').match(/youtu\.be\/([\w-]+)/);
  if (short) return short[1];
  const shorts = String(url || '').match(/youtube\.com\/shorts\/([\w-]+)/);
  if (shorts) return shorts[1];
  const watch = String(url || '').match(/[?&]v=([\w-]+)/);
  if (watch) return watch[1];
  return url;
}

let sheetsClientPromise = null;
function getSheetsClient() {
  if (!sheetsClientPromise) {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '';
    // Netlify env vars store literal "\n" as two characters — unescape them
    // back into real newlines, which the PEM key needs to parse.
    const key = rawKey.replace(/\\n/g, '\n');
    const auth = new google.auth.JWT({ email, key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    sheetsClientPromise = auth.authorize().then(() => google.sheets({ version: 'v4', auth }));
  }
  return sheetsClientPromise;
}

async function readRange(sheets, range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range,
    // Default FORMATTED_VALUE renders every cell as a display string —
    // a real boolean cell (the Completed column) comes back as "TRUE"/
    // "FALSE" text, not JS true/false, which silently broke the
    // r[3] === true check below. UNFORMATTED_VALUE returns actual JS
    // booleans and numbers instead.
    valueRenderOption: 'UNFORMATTED_VALUE'
  });
  return res.data.values || [];
}

async function getVideos(sheets) {
  const rows = await readRange(sheets, VIDEOS_RANGE);
  return rows
    // Real data rows only — Video ID must actually be numeric, which
    // discards the title row, the header row, and any blank rows
    // regardless of exactly which row number they land on.
    .filter((r) => r[0] && /^\d+$/.test(String(r[0]).trim()))
    .map((r) => {
      const [id, year, title, lang, link, seconds] = r;
      const durationSeconds = Math.round(Number(seconds || 0) / DURATION_CORRECTION_FACTOR);
      return {
        id: Number(id),
        year: Number(year),
        title,
        lang,
        dur: formatDuration(durationSeconds),
        durationSeconds,
        youtubeId: extractYoutubeId(link)
      };
    });
}

async function getRosterRows(sheets) {
  const rows = await readRange(sheets, ROSTER_RANGE);
  // Real data rows only: token must look like one of our generated
  // tokens (lowercase alnum) and a name must be assigned — this discards
  // the title row, blank spacer row, header row ("Token"/"Name" would
  // otherwise pass a bare "both columns non-empty" check), and unused
  // pre-generated tokens with no member assigned yet.
  return rows
    .filter((r) => r[0] && r[1] && /^[a-z0-9]{4,10}$/.test(String(r[0]).trim()))
    .map((r) => ({ token: r[0], name: r[1], email: r[2] || '', dateAdded: r[3] || '' }));
}

async function getProgressRows(sheets) {
  const rows = await readRange(sheets, PROGRESS_RANGE);
  // Real data rows only — Video ID (column B) must be numeric, which
  // discards the title/header rows the same way getVideos does.
  return rows.filter((r) => r[1] && /^\d+$/.test(String(r[1]).trim()));
}

function progressRowsForToken(progressRows, token) {
  return progressRows.filter((r) => r[0] === token);
}

function buildProgressMap(videos, progressRowsForThisToken) {
  const map = {};
  videos.forEach((v) => { map[v.id] = { videoId: v.id, status: 'todo', pct: 0, completedAt: null }; });
  // If duplicate rows exist for the same video (a stray re-append, a
  // retried write, etc.), a completed row must always win over a later
  // partial one — never let "done" get masked just because a partial
  // row happens to sit lower in the sheet. Among multiple non-done rows,
  // the highest watched % wins.
  progressRowsForThisToken.forEach((r) => {
    const videoId = Number(r[1]);
    const watchedFraction = Number(r[2] || 0);
    const completed = r[3] === '1' || r[3] === 1 || r[3] === true;
    const pct = Math.round(watchedFraction * 100);
    const existing = map[videoId];
    if (existing && existing.status === 'done' && !completed) return; // done already wins
    if (existing && existing.status === 'partial' && !completed && pct <= existing.pct) return;
    map[videoId] = {
      videoId,
      status: completed ? 'done' : (pct > 0 ? 'partial' : 'todo'),
      pct: completed ? 100 : pct,
      completedAt: completed ? (r[4] || null) : null
    };
  });
  return map;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  try {
    const sheets = await getSheetsClient();
    const params = event.queryStringParameters || {};
    const resource = params.resource;

    if (event.httpMethod === 'GET' && resource === 'videos') {
      const videos = await getVideos(sheets);
      return json(200, videos);
    }

    if (event.httpMethod === 'GET' && resource === 'member') {
      const roster = await getRosterRows(sheets);
      const member = roster.find((r) => r.token === params.token);
      return json(200, { name: member ? member.name : null });
    }

    if (event.httpMethod === 'GET' && resource === 'progress') {
      if (!params.token) return json(400, { error: 'token required' });
      const [videos, progressRows] = await Promise.all([getVideos(sheets), getProgressRows(sheets)]);
      const mine = progressRowsForToken(progressRows, params.token);
      return json(200, buildProgressMap(videos, mine));
    }

    if (event.httpMethod === 'GET' && resource === 'roster') {
      // Real access control — the client-side gate in admin.js is only
      // UX; this check is what actually protects the data.
      if (params.passcode !== process.env.ADMIN_PASSCODE) {
        return json(401, { error: 'wrong passcode' });
      }
      const [videos, roster, progressRows] = await Promise.all([
        getVideos(sheets), getRosterRows(sheets), getProgressRows(sheets)
      ]);
      const total = videos.length;
      const doneCountByToken = {};
      progressRows.forEach((r) => {
        const completed = r[3] === '1' || r[3] === 1 || r[3] === true;
        if (completed) doneCountByToken[r[0]] = (doneCountByToken[r[0]] || 0) + 1;
      });
      const result = roster.map((m) => {
        const doneCount = doneCountByToken[m.token] || 0;
        return { name: m.name, doneCount, totalCount: total, pct: total ? Math.round((doneCount / total) * 100) : 0 };
      });
      return json(200, result);
    }

    if (event.httpMethod === 'POST' && resource === 'progress') {
      const body = JSON.parse(event.body || '{}');
      const { token, videoId, status, pct, points } = body;
      if (!token || !videoId) return json(400, { error: 'token and videoId required' });

      // Raw, unfiltered read here — getProgressRows() drops the header/title
      // rows for callers that just need clean data, which shifts array
      // indices away from real sheet row numbers. The write path needs the
      // actual row number, so it reads PROGRESS_RANGE directly and computes
      // sheetRow from that raw index (range starts at A1, so index+1 = row).
      const rawProgressRows = await readRange(sheets, PROGRESS_RANGE);
      const key = `${token}|VID${videoId}`;
      const rowIndex = rawProgressRows.findIndex((r) => r[6] === key);
      const completed = status === 'done';
      const watchedFraction = completed ? 1 : Math.max(0, Math.min(1, Number(pct || 0) / 100));
      const now = new Date().toISOString();
      const values = [[
        token,
        String(videoId),
        watchedFraction,
        completed, // real boolean — Overview's formulas compare this to TRUE(), a
        // number 1 doesn't satisfy that strict equality even though it looks equivalent
        completed ? now : '',
        completed ? Number(points || 0) : 0,
        key
      ]];

      if (rowIndex === -1) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: process.env.GOOGLE_SHEET_ID,
          range: 'Progress!A:G',
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values }
        });
      } else {
        const sheetRow = rowIndex + 1; // PROGRESS_RANGE starts at A1, so index 0 = row 1
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SHEET_ID,
          range: `Progress!A${sheetRow}:G${sheetRow}`,
          valueInputOption: 'RAW',
          requestBody: { values }
        });
      }

      return json(200, { videoId: Number(videoId), status, pct: completed ? 100 : pct, completedAt: completed ? now : null });
    }

    return json(404, { error: 'unknown resource/method' });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'internal error' });
  }
};
