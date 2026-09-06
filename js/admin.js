// admin.js — page behaviour for Screen 5 (admin.html) only. Mirrors
// app.js's split (data lives in api.js/config.js, this file is DOM/events).

const els = {};

function cacheEls() {
  els.gateScreen = document.getElementById('gate-screen');
  els.passcodeForm = document.getElementById('passcodeForm');
  els.passcodeInput = document.getElementById('passcodeInput');
  els.passcodeError = document.getElementById('passcodeError');
  els.cohortScreen = document.getElementById('cohort-screen');
  els.cohortMeta = document.getElementById('cohortMeta');
  els.cohortAverageValue = document.getElementById('cohortAverageValue');
  els.rosterRows = document.getElementById('rosterRows');
}

// Mirrors app.js's progressBarColor — solid tiers below 90%, rainbow at
// and above. Duplicated rather than shared across the two independent
// pages (member SPA vs. admin) to keep each page's script set self-contained.
function progressBarColor(pct) {
  if (pct === 0) return '#D8D4CA';
  if (pct < 30) return '#FF4D3D';
  if (pct < 70) return '#FF9F1C';
  return '#2ECC71';
}

// The stored value is the passcode itself, not just an unlocked flag —
// every roster fetch has to carry it since the real check now happens
// server-side (netlify/functions/sheets.js) on every request, not once.
// sessionStorage is per-tab and cleared on tab close, which is an
// acceptable trust level for this low-sensitivity admin view.
function getStoredPasscode() {
  try {
    return sessionStorage.getItem(CONFIG.adminSessionKey) || '';
  } catch (e) {
    return '';
  }
}

function storePasscode(passcode) {
  try {
    sessionStorage.setItem(CONFIG.adminSessionKey, passcode);
  } catch (e) {
    // sessionStorage unavailable — just re-prompt next load, harmless.
  }
}

function clearStoredPasscode() {
  try {
    sessionStorage.removeItem(CONFIG.adminSessionKey);
  } catch (e) {
    // ignore
  }
}

function showGate() {
  els.gateScreen.hidden = false;
  els.cohortScreen.hidden = true;
}

function renderRoster(roster) {
  const sorted = roster.slice().sort((a, b) => a.pct - b.pct);
  const average = roster.length
    ? Math.round(roster.reduce((sum, r) => sum + r.pct, 0) / roster.length)
    : 0;
  const today = new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });

  els.cohortMeta.textContent = `${roster.length} members · sorted lowest progress first · updated ${today}`;
  els.cohortAverageValue.textContent = `${average}%`;

  els.rosterRows.innerHTML = '';
  sorted.forEach((r) => {
    const rainbow = r.pct >= 90;
    const nameColor = r.pct < 30 ? '#1B1A17' : '#3D3A34';
    const pctColor = r.pct === 0 ? '#A9A49A' : '#1B1A17';
    const barWidth = Math.max(r.pct, r.pct > 0 ? 1.5 : 0);

    const row = document.createElement('div');
    row.className = 'roster-row';
    row.innerHTML = `
      <div class="roster-col-member" style="color:${nameColor}">${r.name}</div>
      <div class="roster-col-progress">
        <div class="roster-bar-track">
          <div class="roster-bar-fill${rainbow ? ' roster-bar-fill--rainbow' : ''}"
               style="width:${barWidth}%${rainbow ? '' : `;background:${progressBarColor(r.pct)}`}"></div>
        </div>
      </div>
      <div class="roster-col-videos">${r.doneCount} / ${r.totalCount}</div>
      <div class="roster-col-pct" style="color:${pctColor}">${r.pct}%</div>
    `;
    els.rosterRows.appendChild(row);
  });
}

// Tries a passcode against the real backend check. `silent` suppresses
// the error UI — used for the auto-unlock-on-load attempt with a stored
// passcode, where a failure should just fall back to the gate quietly.
//
// getRoster() throws 'wrong passcode' specifically on a 401 — anything
// else (500, network drop) is the same cold-start/transient-blip class
// hit elsewhere in this app (see CLAUDE.md), not an actual bad passcode.
// Treating every failure as "wrong passcode" was misleading — a real
// admin typing their real, unchanged passcode during a blip saw the same
// message as an actual typo. Retry once on a non-401 failure before
// giving up, and show a distinct message for "couldn't reach the
// server" vs. "that passcode is wrong."
function tryUnlock(passcode, { silent } = {}) {
  const attempt = () => getRoster(passcode);
  return attempt()
    .catch((err) => (err.message === 'wrong passcode' ? Promise.reject(err) : attempt()))
    .then((roster) => {
      els.passcodeError.hidden = true;
      storePasscode(passcode);
      els.gateScreen.hidden = true;
      els.cohortScreen.hidden = false;
      renderRoster(roster);
    })
    .catch((err) => {
      clearStoredPasscode();
      showGate();
      if (!silent) {
        els.passcodeError.textContent = err.message === 'wrong passcode'
          ? 'Wrong passcode — try again.'
          : "Couldn't reach the server — try again in a moment.";
        els.passcodeError.hidden = false;
        els.passcodeInput.value = '';
        els.passcodeInput.focus();
      }
    });
}

function init() {
  cacheEls();

  els.passcodeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    tryUnlock(els.passcodeInput.value);
  });

  const stored = getStoredPasscode();
  if (stored) {
    tryUnlock(stored, { silent: true });
  } else {
    showGate();
  }
}

document.addEventListener('DOMContentLoaded', init);
