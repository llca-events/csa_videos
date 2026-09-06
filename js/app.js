// app.js — page behaviour and DOM updates only. All data comes from
// api.js; this file never touches localStorage or mock arrays directly.

// ---------------------------------------------------------------------
// State
// ---------------------------------------------------------------------
let allVideos = [];
let progress = {};
let badgeDefs = [];
let memberToken = '';
let currentVideoId = null;

// YouTube IFrame Player state (Build Notes #5 — real API, not a timer)
let ytApiReady = false;
let ytPlayer = null;
let pendingYoutubeId = null;
let pollTimer = null;

const els = {};

function cacheEls() {
  els.screenHome = document.getElementById('screen-home');
  els.screenPlayer = document.getElementById('screen-player');
  els.screenBadges = document.getElementById('screen-badges');
  [
    'greeting', 'cheer', 'pctLabel', 'doneLabel', 'timeLeftLabel',
    'rainbowFill', 'pointsValue', 'badgeValue', 'videoGroups', 'statsRow',
    'backBtn', 'currentYear', 'youtubePlayer', 'localBarFill', 'currentTitle',
    'currentLang', 'localLabel', 'thresholdNote', 'upNextCard', 'upNextTitle',
    'upNextMeta', 'upNextLang', 'playerHint',
    'completionModal', 'modalIconRing', 'modalIcon', 'modalHead', 'modalSub',
    'modalPoints', 'modalBadge', 'modalBadgeIcon', 'modalBadgeName', 'modalBadgeLine',
    'modalFoot', 'modalPrimaryBtn', 'modalSecondaryBtn', 'modalCloseBtn',
    'badgesBackBtn', 'badgesPoints', 'badgesRainbowFill', 'badgesPctLabel',
    'badgesCountLabel', 'badgesGrid'
  ].forEach((id) => { els[id] = document.getElementById(id); });
}

// ---------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------
function init() {
  cacheEls();
  memberToken = getMemberToken();

  Promise.all([
    getVideos(),
    getMemberProgress(memberToken),
    getMemberName(memberToken)
  ]).then(([videos, progressMap, name]) => {
    allVideos = videos;
    progress = progressMap;
    badgeDefs = getBadgeDefinitions(allVideos);
    els.greeting.textContent = `Hi ${name} 👋`;
    renderHome();
    showScreen('home');
  });

  els.backBtn.addEventListener('click', goHome);

  els.modalSecondaryBtn.addEventListener('click', () => {
    hideModal();
    goHome();
  });

  // Dismiss-only — just closes the card, no navigation, video stays as-is.
  els.modalCloseBtn.addEventListener('click', hideModal);

  els.statsRow.addEventListener('click', goBadges);
  els.badgesBackBtn.addEventListener('click', goHome);
}

function showScreen(name) {
  els.screenHome.hidden = name !== 'home';
  els.screenPlayer.hidden = name !== 'player';
  els.screenBadges.hidden = name !== 'badges';
}

function goHome() {
  stopPolling();
  renderHome();
  showScreen('home');
}

function goBadges() {
  stopPolling();
  renderBadges();
  showScreen('badges');
}

// ---------------------------------------------------------------------
// Derived values (mirrors the mockup's renderVals, but against real data)
// ---------------------------------------------------------------------
function watchedCount() {
  return allVideos.filter((v) => progress[v.id] && progress[v.id].status === 'done').length;
}

function earnedBadgeIds(progressMap) {
  return badgeDefs.filter((b) => b.isEarned(progressMap)).map((b) => b.id);
}

function nextUnwatched(fromId) {
  const idx = allVideos.findIndex((v) => v.id === fromId);
  const after = allVideos.slice(idx + 1).find((v) => progress[v.id].status !== 'done');
  if (after) return after;
  return allVideos.find((v) => progress[v.id].status !== 'done') || null;
}

function langStyle(lang) {
  return lang === 'EN'
    ? { bg: '#EDE9FF', fg: '#332FB5', border: '#C9C2FF' }
    : { bg: '#FFE7DA', fg: '#9A3412', border: '#FFC7A8' };
}

// Solid color tiers below 90%, rainbow gradient at/above — shared by the
// Screen 4 badge bars (and later the Screen 5 admin roster bars).
function progressBarColor(pct) {
  if (pct === 0) return '#D8D4CA';
  if (pct < 30) return '#FF4D3D';
  if (pct < 70) return '#FF9F1C';
  return '#2ECC71'; // 70-89%; 90%+ is handled by the rainbow class instead
}

// Remaining watch time for one video: full duration if untouched, only
// the unwatched portion if partial, zero once done. Feeds the "time
// left" estimates on Screen 1 (overall + per year) so members can gauge
// how much to set aside — not the same as the per-row duration display.
function remainingSeconds(v) {
  const rec = progress[v.id];
  if (!rec || rec.status === 'done') return 0;
  const watchedFraction = (rec.pct || 0) / 100;
  return Math.round(v.durationSeconds * (1 - watchedFraction));
}

function formatTimeLeft(totalSeconds) {
  if (totalSeconds <= 0) return null;
  const mins = Math.max(1, Math.round(totalSeconds / 60));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

// ---------------------------------------------------------------------
// Screen 1 — Personal Playlist
// ---------------------------------------------------------------------
function renderHome() {
  const total = allVideos.length;
  const n = watchedCount();
  const pct = total ? Math.round((n / total) * 100) : 0;
  const earned = earnedBadgeIds(progress);
  const nextBadge = badgeDefs.find((b) => earned.indexOf(b.id) === -1);

  let cheer;
  if (n === 0) cheer = 'Fresh start — your first badge is one video away.';
  else if (n === total) cheer = `All ${total} done. Officially unphishable. 🎉`;
  else cheer = `Nice! ${n} video${n === 1 ? '' : 's'} down.` + (nextBadge ? ` Keep going for “${nextBadge.name}”.` : '');

  els.cheer.textContent = cheer;
  els.pctLabel.textContent = `${pct}% complete`;
  els.doneLabel.textContent = `${n} of ${total} videos`;
  els.rainbowFill.style.width = `${pct}%`;
  els.pointsValue.textContent = String(n * CONFIG.pointsPerVideo);
  els.badgeValue.textContent = `${earned.length} / ${badgeDefs.length}`;

  const timeLeft = formatTimeLeft(allVideos.reduce((sum, v) => sum + remainingSeconds(v), 0));
  els.timeLeftLabel.textContent = timeLeft ? `⏱ About ${timeLeft} left to finish` : '🎉 All caught up — nothing left to watch';

  renderVideoGroups();
}

function renderVideoGroups() {
  const years = Array.from(new Set(allVideos.map((v) => v.year))).sort();
  els.videoGroups.innerHTML = '';

  years.forEach((year) => {
    const list = allVideos.filter((v) => v.year === year);
    const doneInYear = list.filter((v) => progress[v.id].status === 'done').length;
    const yearTimeLeft = formatTimeLeft(list.reduce((sum, v) => sum + remainingSeconds(v), 0));

    const group = document.createElement('div');
    group.className = 'video-group';

    const heading = document.createElement('div');
    heading.className = 'video-group-heading';
    heading.innerHTML = `
      <span class="video-group-year">${year}</span>
      <span class="video-group-rule"></span>
      <span class="video-group-tally">${doneInYear}/${list.length}${yearTimeLeft ? ` · ${yearTimeLeft} left` : ''}</span>
    `;
    group.appendChild(heading);

    const card = document.createElement('div');
    card.className = 'video-card';

    list.forEach((v) => {
      const rec = progress[v.id];
      const lang = langStyle(v.lang);
      const row = document.createElement('div');
      row.className = 'video-row';
      row.dataset.videoId = String(v.id);

      const dotClass = rec.status === 'done' ? 'done' : rec.status === 'partial' ? 'partial' : 'todo';
      const dotIcon = rec.status === 'done' ? '✓' : rec.status === 'partial' ? '◔' : '';
      const meta = rec.status === 'partial'
        ? `${v.dur} · ${rec.pct}% watched`
        : rec.status === 'done'
          ? `${v.dur} · watched`
          : v.dur;

      row.innerHTML = `
        <div class="video-dot video-dot--${dotClass}">${dotIcon}</div>
        <div class="video-info">
          <div class="video-title ${rec.status === 'done' ? 'video-title--done' : ''}">${v.title}</div>
          <div class="video-meta">${meta}</div>
        </div>
        <div class="lang-badge" style="background:${lang.bg};color:${lang.fg};box-shadow:inset 0 0 0 1.5px ${lang.border}">${v.lang}</div>
        <div class="chevron">›</div>
      `;
      row.addEventListener('click', () => openVideo(v.id));
      card.appendChild(row);
    });

    group.appendChild(card);
    els.videoGroups.appendChild(group);
  });
}

// ---------------------------------------------------------------------
// Screen 4 — Badges & Progress
// ---------------------------------------------------------------------
function renderBadges() {
  const total = allVideos.length;
  const n = watchedCount();
  const pct = total ? Math.round((n / total) * 100) : 0;
  const earned = earnedBadgeIds(progress);

  els.badgesPoints.textContent = String(n * CONFIG.pointsPerVideo);
  els.badgesRainbowFill.style.width = `${pct}%`;
  els.badgesPctLabel.textContent = `${pct}% complete`;
  els.badgesCountLabel.textContent = `${earned.length} / ${badgeDefs.length} badges`;

  els.badgesGrid.innerHTML = '';
  badgeDefs.forEach((b) => {
    const badgePct = Math.max(0, Math.min(100, b.progressPct(progress)));
    const rainbow = badgePct >= 90;
    const row = document.createElement('div');
    row.className = 'badge-row';
    row.innerHTML = `
      <div class="badge-row-icon">${b.icon}</div>
      <div class="badge-row-body">
        <div class="badge-row-top">
          <span class="badge-row-name">${b.name}</span>
          <span class="badge-row-pct">${badgePct}%</span>
        </div>
        <div class="badge-row-bar-track">
          <div class="badge-row-bar-fill${rainbow ? ' badge-row-bar-fill--rainbow' : ''}"
               style="width:${Math.max(badgePct, badgePct > 0 ? 2 : 0)}%${rainbow ? '' : `;background:${progressBarColor(badgePct)}`}"></div>
        </div>
        <div class="badge-row-hint">${b.hint}</div>
      </div>
    `;
    els.badgesGrid.appendChild(row);
  });
}

// ---------------------------------------------------------------------
// Screen 2 — Video Player
// ---------------------------------------------------------------------
function openVideo(id) {
  stopPolling();
  currentVideoId = id;
  renderPlayerMeta();
  showScreen('player');
  loadYouTubePlayer(allVideos.find((v) => v.id === id).youtubeId);
}

function renderPlayerMeta() {
  const v = allVideos.find((x) => x.id === currentVideoId);
  const rec = progress[v.id];
  const lang = langStyle(v.lang);

  els.currentYear.textContent = String(v.year);
  els.currentTitle.textContent = v.title;
  els.currentLang.textContent = v.lang;
  els.currentLang.style.background = lang.bg;
  els.currentLang.style.color = lang.fg;
  els.currentLang.style.boxShadow = `inset 0 0 0 1.5px ${lang.border}`;

  const pct = rec.status === 'done' ? 100 : rec.pct;
  els.localBarFill.style.width = `${pct}%`;
  els.localLabel.textContent = pct >= 100 ? 'Watched' : `${pct}% of this video`;
  els.thresholdNote.textContent = `counts as complete at ${CONFIG.completionThreshold}%`;
  els.playerHint.textContent = rec.status === 'done'
    ? 'Watched — replay anytime.'
    : 'Play the video below — your progress here drives the rainbow bar.';

  const nx = nextUnwatched(v.id);
  if (nx) {
    const nxLang = langStyle(nx.lang);
    els.upNextCard.hidden = false;
    els.upNextTitle.textContent = nx.title;
    els.upNextMeta.textContent = `${nx.year} · ${nx.dur}`;
    els.upNextLang.textContent = nx.lang;
    els.upNextLang.style.background = nxLang.bg;
    els.upNextLang.style.color = nxLang.fg;
    els.upNextLang.style.boxShadow = `inset 0 0 0 1.5px ${nxLang.border}`;
    els.upNextCard.onclick = () => openVideo(nx.id);
  } else {
    els.upNextCard.hidden = true;
  }
}

// --- Real YouTube IFrame API tracking (Build Notes #5) ----------------
// Global callback the YouTube API script invokes once it has loaded.
window.onYouTubeIframeAPIReady = function () {
  ytApiReady = true;
  if (pendingYoutubeId) {
    const id = pendingYoutubeId;
    pendingYoutubeId = null;
    createOrLoadPlayer(id);
  }
};

// Defensive fallback: index.html loads this script before the YouTube
// one specifically so the callback above exists in time, but if some
// caching/ordering quirk still lets YT finish first, don't wait forever
// for a ready signal that already fired into a void — check directly.
if (typeof YT !== 'undefined' && YT.Player) {
  window.onYouTubeIframeAPIReady();
}

function loadYouTubePlayer(youtubeId) {
  if (!ytApiReady || typeof YT === 'undefined' || !YT.Player) {
    pendingYoutubeId = youtubeId;
    return;
  }
  createOrLoadPlayer(youtubeId);
}

function createOrLoadPlayer(youtubeId) {
  if (ytPlayer) {
    ytPlayer.loadVideoById(youtubeId);
    return;
  }
  ytPlayer = new YT.Player('youtubePlayer', {
    videoId: youtubeId,
    playerVars: { rel: 0, modestbranding: 1 },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange
    }
  });
}

function onPlayerReady() {
  const rec = progress[currentVideoId];
  if (rec.status === 'partial' && rec.pct > 0) {
    const duration = ytPlayer.getDuration();
    if (duration) ytPlayer.seekTo((rec.pct / 100) * duration, true);
  }
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    startPolling();
  } else if (event.data === YT.PlayerState.PAUSED) {
    stopPolling();
  } else if (event.data === YT.PlayerState.ENDED) {
    stopPolling();
    handleWatchProgress(100);
  }
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => {
    if (!ytPlayer || typeof ytPlayer.getDuration !== 'function') return;
    const duration = ytPlayer.getDuration();
    const current = ytPlayer.getCurrentTime();
    if (!duration) return;
    const pct = Math.min(100, Math.round((current / duration) * 100));
    handleWatchProgress(pct);
  }, 1000);
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

function handleWatchProgress(pct) {
  const rec = progress[currentVideoId];
  if (!rec || rec.status === 'done') return;

  els.localBarFill.style.width = `${pct}%`;
  els.localLabel.textContent = pct >= 100 ? 'Watched' : `${pct}% of this video`;

  if (pct >= CONFIG.completionThreshold) {
    stopPolling();
    completeVideo(pct);
  } else {
    markVideoStatus(memberToken, currentVideoId, 'partial', pct).then((updated) => {
      progress[currentVideoId] = updated;
    });
  }
}

function completeVideo(pct) {
  const before = earnedBadgeIds(progress);
  const videoId = currentVideoId;
  // The write to the Sheet can blip (cold start, brief network drop,
  // Sheets API rate-limit) — markVideoStatus rejects on that, and with
  // no .catch() the completion screen would just silently never appear
  // even though the member genuinely finished the video. Retry once,
  // then fall back to an optimistic local "done" so the celebration
  // always shows; the retry-failure case still gets logged so a
  // never-actually-saved completion is debuggable.
  markVideoStatus(memberToken, videoId, 'done', 100)
    .catch(() => markVideoStatus(memberToken, videoId, 'done', 100))
    .catch((err) => {
      console.error('Failed to save completion after retry — showing it locally only', err);
      return { videoId, status: 'done', pct: 100, completedAt: new Date().toISOString() };
    })
    .then((updated) => {
      progress[videoId] = updated;
      const after = earnedBadgeIds(progress);
      const newBadge = badgeDefs.filter((b) => after.indexOf(b.id) > -1 && before.indexOf(b.id) === -1).pop();
      const finale = allVideos.every((v) => progress[v.id].status === 'done');
      const v = allVideos.find((x) => x.id === videoId);
      const n = watchedCount();
      const total = allVideos.length;

      showCompletionModal({ video: v, newBadge, finale, n, total });
      renderPlayerMeta();
    });
}

// ---------------------------------------------------------------------
// Screen 3 — Completion Moment. Fires the instant a video crosses the
// completion threshold; overlays Screen 2. Escalates points-only →
// badge unlock → 100%-finale, per the design spec.
// ---------------------------------------------------------------------
function showCompletionModal({ video, newBadge, finale, n, total }) {
  els.modalIcon.textContent = finale ? '🏆' : (newBadge ? newBadge.icon : '✓');
  els.modalIconRing.style.background = finale ? '#FFF0C2' : (newBadge ? '#EDE9FF' : '#DFF6E7');
  els.modalHead.textContent = finale ? '100% complete!' : (newBadge ? 'Badge unlocked!' : 'Video complete!');
  els.modalSub.textContent = `${video.title} · ${video.year}`;
  els.modalPoints.textContent = `+${CONFIG.pointsPerVideo} points`;

  if (newBadge) {
    els.modalBadge.hidden = false;
    els.modalBadgeIcon.textContent = newBadge.icon;
    els.modalBadgeName.textContent = newBadge.name;
    els.modalBadgeLine.textContent = newBadge.line;
  } else {
    els.modalBadge.hidden = true;
  }

  els.modalFoot.textContent = finale
    ? 'Every video, every year. Nothing left to phish you with.'
    : newBadge
      ? `${n} down, ${total - n} to go.`
      : `Nice! ${n} video${n === 1 ? '' : 's'} down.`;

  // Finale routes to the badges screen (the big payoff); otherwise the
  // next unwatched video, or back to the playlist once nothing's left.
  // Hide the secondary button when it would just duplicate the primary.
  const next = nextUnwatched(video.id);
  els.modalPrimaryBtn.textContent = finale ? 'See my badges' : (next ? 'Play next video' : 'Back to playlist');
  els.modalSecondaryBtn.hidden = finale || !next;
  els.modalPrimaryBtn.onclick = () => {
    hideModal();
    if (finale) {
      goBadges();
    } else if (next) {
      openVideo(next.id);
    } else {
      goHome();
    }
  };

  els.completionModal.hidden = false;
}

function hideModal() {
  els.completionModal.hidden = true;
}

document.addEventListener('DOMContentLoaded', init);
