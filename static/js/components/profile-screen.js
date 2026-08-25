// @ts-check
import './app-header.js';
import { attachAvatarFallback, avatarSrc, DEFAULT_AVATAR } from '../avatars.js';
import { getAuthUser } from '../auth.js';
import { syncUsernamePill } from '../account-sync.js';
import { esc } from '../dom.js';
import { showLanding, showGameDetail } from '../router.js';

/**
 * <profile-screen> — public player profile at /@username.
 * Light DOM: the host element *is* `#profile.screen`.
 */
export class ProfileScreen extends HTMLElement {
  connectedCallback() {
    if (this.dataset.rendered) return;
    this.dataset.rendered = 'true';
    this.id = 'profile';
    this.className = 'screen profile-screen';
    this.setAttribute('aria-label', 'Player profile');
    this.innerHTML = `
      <app-header></app-header>
      <div class="profile-card" id="profile-card">
        <div class="profile-avatar-row">
          <div class="founding-flank founding-flank--left" hidden>
            <span class="founding-stars" aria-hidden="true">
              <span class="founding-star">★</span>
              <span class="founding-star">★</span>
              <span class="founding-star">★</span>
            </span>
            <span class="founding-word">Founding</span>
          </div>
          <div class="profile-avatar-ring"><img class="profile-avatar" src="${DEFAULT_AVATAR}" alt="" aria-hidden="true"></div>
          <div class="founding-flank founding-flank--right" hidden>
            <span class="founding-word founding-word--roller">Roller</span>
            <span class="founding-stars" aria-hidden="true">
              <span class="founding-star">★</span>
              <span class="founding-star">★</span>
              <span class="founding-star">★</span>
            </span>
          </div>
        </div>
        <p class="profile-username" id="profile-username"></p>
      </div>
      <div class="screen-body">
        <p class="profile-bio" id="profile-bio"></p>
        <div class="profile-pills" id="profile-pills" hidden></div>
        <div class="profile-stats" id="profile-stats"></div>
        <div class="profile-recent" id="profile-recent" hidden></div>
        <p class="profile-empty" id="profile-empty" hidden></p>
        <p class="error-msg" id="profile-error" role="alert" aria-live="polite"></p>
      </div>`;

    const title = /** @type {HTMLElement | null} */ (this.querySelector('.game-title'));
    if (title) {
      title.style.cursor = 'pointer';
      title.addEventListener('click', () => showLanding());
    }

    // Sync signed-in username pill
    const header = this.querySelector('app-header');
    if (header) syncUsernamePill(header, getAuthUser());
  }

  /**
   * Fetch a player's public profile. Returns a result that the synchronous
   * {@link render} paints — the fetch is kept off the view-transition path so
   * the swap captures a fully-populated screen (matches the game-start flow,
   * where the loading screen stays up until the snapshot is in hand).
   * @param {string} username
   * @returns {Promise<{ data?: any, error?: string }>}
   */
  async load(username) {
    try {
      const res = await fetch(`/api/profile/${encodeURIComponent(username)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { error: body.detail || 'Player not found' };
      }
      return { data: await res.json() };
    } catch {
      return { error: 'Could not load profile' };
    }
  }

  /**
   * Paint the profile from a {@link load} result. Synchronous so it can run
   * inside the view transition's update phase — the screen is captured already
   * populated instead of animating to an empty card and popping in later.
   * @param {string} username
   * @param {{ data?: any, error?: string }} result
   */
  render(username, result) {
    const card = document.getElementById('profile-card');
    const statsEl = document.getElementById('profile-stats');
    const emptyEl = document.getElementById('profile-empty');
    const errorEl = document.getElementById('profile-error');
    const nameEl = document.getElementById('profile-username');
    const bioEl = document.getElementById('profile-bio');
    if (!card || !statsEl || !emptyEl || !errorEl || !nameEl || !bioEl) return;

    // Reset
    errorEl.textContent = '';
    statsEl.innerHTML = '';
    emptyEl.hidden = true;
    card.hidden = true;
    nameEl.textContent = username;

    if (result.error) {
      errorEl.textContent = result.error;
      return;
    }
    const data = result.data;

    nameEl.textContent = data.username;
    // Scope to THIS screen: the sign-in screen also has a `.profile-avatar`
    // and precedes us in the DOM, so an unscoped querySelector would write the
    // photo onto the sign-in avatar (and miss ours). Reset to the default when
    // there's no photo so a previous profile's photo can't linger.
    const avatar = /** @type {HTMLImageElement | null} */ (
      this.querySelector('.profile-avatar')
    );
    if (avatar) {
      avatar.src = avatarSrc(data.profile_photo_url);
      attachAvatarFallback(avatar);
    }
    // "Founding Roller" designation flanks the avatar for pre-cutoff accounts.
    const founding = data.founding_member === true;
    this.querySelectorAll('.founding-flank').forEach((el) => {
      /** @type {HTMLElement} */ (el).hidden = !founding;
    });
    bioEl.textContent = data.bio || '';
    // Pills (location, etc.)
    const pillsEl = document.getElementById('profile-pills');
    if (pillsEl) {
      // Drawn 1.7-stroke icons (shield / dice / pin) — never filled, no emoji.
      const pills = [];
      if (data.admin) pills.push(`<span class="profile-pill profile-pill-admin"><svg class="profile-pill-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.6 4.6 5.7v5.1c0 4.6 3.2 8.9 7.4 10 4.2-1.1 7.4-5.4 7.4-10V5.7z"/></svg>Barkeep</span>`);
      if (data.member_since) {
        const d = new Date(data.member_since);
        const since = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        pills.push(`<span class="profile-pill"><svg class="profile-pill-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><rect x="2.6" y="8.4" width="12" height="12" rx="2.6"/><circle cx="6.2" cy="12" r=".9" fill="currentColor" stroke="none"/><circle cx="11" cy="16.8" r=".9" fill="currentColor" stroke="none"/><path d="M9.4 6.6 15.4 3.2a2.6 2.6 0 0 1 3.6 1l2.4 4.2a2.6 2.6 0 0 1-1 3.5l-2.8 1.6"/><circle cx="16.4" cy="7.4" r=".9" fill="currentColor" stroke="none"/></svg>Rolling since ${since}</span>`);
      }
      if (data.location) pills.push(`<span class="profile-pill"><svg class="profile-pill-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21.2s6.6-6.1 6.6-10.5a6.6 6.6 0 1 0-13.2 0c0 4.4 6.6 10.5 6.6 10.5z"/><circle cx="12" cy="10.4" r="2.3"/></svg>${esc(data.location)}</span>`);
      if (pills.length) {
        pillsEl.innerHTML = pills.join('');
        pillsEl.hidden = false;
      }
    }

    card.hidden = false;

    if (!data.stats) {
      emptyEl.textContent = 'No games played yet';
      emptyEl.hidden = false;
      return;
    }

    /** @type {Array<{ label: string, value: string }>} */
    const cards = [];
    const s = data.stats;

    if (s.total_games) cards.push({ label: 'Games', value: String(s.total_games) });
    if (s.total_wins) cards.push({ label: 'Wins', value: String(s.total_wins) });
    if (s.total_rounds && s.total_wins) {
      const pct = Math.round((s.total_wins / s.total_rounds) * 100);
      cards.push({ label: 'Win Rate', value: `${pct}%` });
    }
    if (s.total_rounds) cards.push({ label: 'Rounds', value: String(s.total_rounds) });
    if (s.total_rolls) cards.push({ label: 'Rolls', value: String(s.total_rolls) });
    if (s.fastest_win_ms) {
      const secs = (s.fastest_win_ms / 1000).toFixed(1);
      cards.push({ label: 'Best Time', value: `${secs}s` });
    }
    if (s.fastest_win_rolls) {
      cards.push({ label: 'Best Rolls', value: String(s.fastest_win_rolls) });
    }
    if (s.total_time_played_ms) {
      const mins = Math.round(s.total_time_played_ms / 60000);
      cards.push({ label: 'Time Played', value: mins < 60 ? `${mins}m` : `${(mins / 60).toFixed(1)}h` });
    }

    if (cards.length === 0) {
      emptyEl.textContent = 'No games played yet';
      emptyEl.hidden = false;
      return;
    }

    statsEl.innerHTML = cards.map((c) => `
      <div class="stat-card">
        <span class="stat-value">${c.value}</span>
        <span class="stat-label">${c.label}</span>
      </div>
    `).join('');

    // Recent games
    const recentEl = document.getElementById('profile-recent');
    if (recentEl && data.recent && data.recent.length > 0) {
      recentEl.innerHTML = `
        <p class="recent-label">Recent Games</p>
        <div class="recent-rows">
          ${data.recent.map((/** @type {any} */ r) => {
            /** @type {string} */
            let duration = '';
            if (r.duration_ms) {
              const totalSecs = Math.round(r.duration_ms / 1000);
              duration = totalSecs < 60 ? `${totalSecs}s` : `${Math.round(totalSecs / 60)}m`;
            }
            const opps = (r.opponents || []).slice().sort(
              (/** @type {any} */ a, /** @type {any} */ b) => (b.wins || 0) - (a.wins || 0)
            );
            const unknownCount = Math.max(0, (r.player_count || 1) - 1 - opps.length);
            // A photo seats in the ring; no photo is a struck MONOGRAM — the
            // seat stays about a person, never a silhouette.
            const mkAvatar = (/** @type {string | null} */ src, /** @type {string} */ name, /** @type {boolean} */ winner) =>
              `<span class="recent-avatar-ring avatar-seat${winner ? ' recent-avatar-winner' : ''}">${
                src ? `<img class="recent-avatar" src="${esc(src)}" alt="${esc(name)}">`
                    : `<span class="avatar-mono">${esc((name.trim()[0] || '?').toUpperCase())}</span>`
              }</span>`;
            // Top opponent is the one with the most wins
            const topOppWins = opps.length > 0 ? (opps[0].wins || 0) : 0;
            const userWins = r.wins || 0;
            const userAv = mkAvatar(data.profile_photo_url || null, data.username, userWins >= topOppWins);
            const oppAvs = opps.map((/** @type {any} */ o, /** @type {number} */ i) =>
              mkAvatar(o.photo || null, o.name, i === 0 && (o.wins || 0) >= userWins)
            );
            // Add placeholder seats for opponents who never rolled
            for (let i = 0; i < unknownCount; i++) {
              oppAvs.push(mkAvatar(null, '?', false));
            }
            // Most wins first
            const allAvatars = userWins >= topOppWins
              ? [userAv, ...oppAvs]
              : [...oppAvs, userAv];
            let vs;
            if (opps.length) {
              vs = 'vs ' + opps.map((/** @type {any} */ o) => o.name).join(', ');
              if (unknownCount) vs += ` + ${unknownCount} other${unknownCount > 1 ? 's' : ''}`;
            } else if (unknownCount) {
              vs = `vs ${unknownCount} other${unknownCount > 1 ? 's' : ''}`;
            } else {
              vs = 'solo';
            }
            const fastest = r.fastest_win_ms ? (r.fastest_win_ms / 1000).toFixed(1) + 's' : '';
            const speed = r.avg_roll_speed_ms ? (r.avg_roll_speed_ms / 1000).toFixed(1) + 's' : '';
            const details = [fastest ? `best ${fastest}` : '', speed ? `${speed}/roll` : ''].filter(Boolean).join(' · ');
            return `
            <div class="recent-game" data-game-code="${esc(r.game_code || '')}">
              <span class="recent-score ${r.won_game ? '' : 'recent-score-loss'}">${r.wins}/${r.rounds}</span>
              <div class="recent-game-body">
                <div class="recent-avatars">${allAvatars.join('')}</div>
                <div class="recent-row">
                  <span class="recent-vs">${esc(vs)}</span>
                </div>
                ${details ? `<div class="recent-details">${details}</div>` : ''}
              </div>
              <span class="recent-time">${duration}</span>
            </div>`;
          }).join('')}
        </div>`;
      recentEl.hidden = false;
      recentEl.addEventListener('click', (e) => {
        const row = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('.recent-game[data-game-code]'));
        if (row?.dataset.gameCode) showGameDetail(row.dataset.gameCode);
      });
    }

    // Trigger shimmer animation once
    const body = this.querySelector('.screen-body');
    if (body) {
      body.classList.add('profile-shimmer');
      setTimeout(() => body.classList.remove('profile-shimmer'), 1500);
    }
  }
}

customElements.define('profile-screen', ProfileScreen);
