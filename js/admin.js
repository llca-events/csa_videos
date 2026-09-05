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

function isUnlocked() {
  try {
    return sessionStorage.getItem(CONFIG.adminSessionKey) === '1';
  } catch (e) {
    return false;
  }
}

function unlock() {
  try {
    sessionStorage.setItem(CONFIG.adminSessionKey, '1');
  } catch (e) {
    // sessionStorage unavailable — just re-prompt next load, harmless.
  }
}

function showGate() {
  els.gateScreen.hidden = false;
  els.cohortScreen.hidden = true;
}

function showCohort() {
  els.gateScreen.hidden = true;
  els.cohortScreen.hidden = false;
  loadAndRenderRoster();
}

function loadAndRenderRoster() {
  getRoster().then((roster) => {
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
  });
}

function init() {
  cacheEls();

  els.passcodeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (els.passcodeInput.value === CONFIG.adminPasscode) {
      els.passcodeError.hidden = true;
      unlock();
      showCohort();
    } else {
      els.passcodeError.hidden = false;
      els.passcodeInput.value = '';
      els.passcodeInput.focus();
    }
  });

  if (isUnlocked()) {
    showCohort();
  } else {
    showGate();
  }
}

document.addEventListener('DOMContentLoaded', init);
