// @ts-check
import './app-header.js';
import { getAuthUser } from '../auth.js';
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
        <div class="profile-avatar-ring"><img class="profile-avatar" src="/static/images/avatar-default.svg" alt="" aria-hidden="true"></div>
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

    const title = this.querySelector('.game-title');
    if (title) {
      title.style.cursor = 'pointer';
      title.addEventListener('click', () => showLanding());
    }

    // Sync signed-in username pill
    const header = this.querySelector('app-header');
    if (header) {
      const user = getAuthUser();
      if (user) {
        const tag = document.createElement('a');
        tag.className = 'header-username';
        tag.textContent = `@${user.username}`;
        tag.href = `/@${user.username}`;
        const btn = header.querySelector('.game-menu-btn');
        btn?.parentElement?.insertBefore(tag, btn);
      }
    }
  }

  /**
   * Fetch and display a player's public profile.
   * @param {string} username
   */
  async show(username) {
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

    try {
      const res = await fetch(`/api/profile/${encodeURIComponent(username)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        errorEl.textContent = body.detail || 'Player not found';
        return;
      }
      const data = await res.json();

      nameEl.textContent = data.username;
      if (data.profile_photo_url) {
        const avatar = document.querySelector('.profile-avatar');
        if (avatar) avatar.src = data.profile_photo_url;
      }
      bioEl.textContent = data.bio || '';
      // Pills (location, etc.)
      const pillsEl = document.getElementById('profile-pills');
      if (pillsEl) {
        const pills = [];
        if (data.admin) pills.push(`<span class="profile-pill profile-pill-admin"><svg class="profile-pill-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18l7 3.12v4.7c0 4.83-3.4 9.36-7 10.5-3.6-1.14-7-5.67-7-10.5V6.3l7-3.12z"/></svg>Barkeep</span>`);
        if (data.member_since) {
          const d = new Date(data.member_since);
          const since = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          pills.push(`<span class="profile-pill"><svg class="profile-pill-icon" viewBox="0 0 24 24" aria-hidden="true"><g transform="translate(7 8) rotate(-12)"><rect x="-6" y="-6" width="12" height="12" rx="2.5" fill="currentColor"/><circle cx="-2.5" cy="-2.5" r="1" fill="var(--color-bg, #1a1a1a)"/><circle cx="2.5" cy="-2.5" r="1" fill="var(--color-bg, #1a1a1a)"/><circle cx="-2.5" cy="2.5" r="1" fill="var(--color-bg, #1a1a1a)"/><circle cx="2.5" cy="2.5" r="1" fill="var(--color-bg, #1a1a1a)"/></g><g transform="translate(16 15) rotate(10)"><rect x="-6" y="-6" width="12" height="12" rx="2.5" fill="currentColor" opacity="0.6"/><circle cx="-2.5" cy="-2.5" r="1" fill="var(--color-bg, #1a1a1a)"/><circle cx="2.5" cy="2.5" r="1" fill="var(--color-bg, #1a1a1a)"/></g></svg>${since}</span>`);
        }
        if (data.location) pills.push(`<span class="profile-pill"><svg class="profile-pill-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>${data.location}</span>`);
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
              const opps = r.opponents || [];
              const unknownCount = Math.max(0, (r.player_count || 1) - 1 - opps.length);
              const userPhoto = data.profile_photo_url || '/static/images/avatar-default.svg';
              const mkAvatar = (/** @type {string} */ src, /** @type {string} */ name, /** @type {boolean} */ winner) =>
                `<span class="recent-avatar-ring${winner ? ' recent-avatar-winner' : ''}"><img class="recent-avatar" src="${src}" alt="${name}"></span>`;
              const userAv = mkAvatar(userPhoto, data.username, !!r.won_game);
              const oppAvs = opps.map((/** @type {any} */ o) =>
                mkAvatar(o.photo || '/static/images/avatar-default.svg', o.name, false)
              );
              // Add placeholder avatars for opponents who never rolled
              for (let i = 0; i < unknownCount; i++) {
                oppAvs.push(mkAvatar('/static/images/avatar-default.svg', 'opponent', false));
              }
              // Winner first; give glow only to the first avatar
              const allAvatars = r.won_game
                ? [userAv, ...oppAvs]
                : [...oppAvs, userAv];
              if (!r.won_game && allAvatars.length > 0) {
                allAvatars[0] = allAvatars[0].replace('recent-avatar-ring', 'recent-avatar-ring recent-avatar-winner');
              }
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
              <div class="recent-game" data-game-code="${r.game_code || ''}"
                <span class="recent-score ${r.won_game ? '' : 'recent-score-loss'}">${r.wins}/${r.rounds}</span>
                <div class="recent-game-body">
                  <div class="recent-avatars">${allAvatars.join('')}</div>
                  <div class="recent-row">
                    <span class="recent-vs">${vs}</span>
                  </div>
                  ${details ? `<div class="recent-details">${details}</div>` : ''}
                </div>
                <span class="recent-time">${duration}</span>
              </div>`;
            }).join('')}
          </div>`;
        recentEl.hidden = false;
        recentEl.addEventListener('click', (e) => {
          const row = /** @type {HTMLElement} */ (e.target).closest('.recent-game[data-game-code]');
          if (row?.dataset.gameCode) showGameDetail(row.dataset.gameCode);
        });
      }

      // Trigger shimmer animation once
      const body = this.querySelector('.screen-body');
      if (body) {
        body.classList.add('profile-shimmer');
        setTimeout(() => body.classList.remove('profile-shimmer'), 1500);
      }

    } catch {
      errorEl.textContent = 'Could not load profile';
    }
  }
}

customElements.define('profile-screen', ProfileScreen);
