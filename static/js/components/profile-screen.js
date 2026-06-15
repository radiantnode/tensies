// @ts-check
import './app-header.js';
import { showLanding } from '../router.js';

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
        <p class="profile-member-since" id="profile-member-since"></p>
      </div>
      <div class="screen-body">
        <div class="profile-stats" id="profile-stats"></div>
        <p class="profile-empty" id="profile-empty" hidden></p>
        <p class="error-msg" id="profile-error" role="alert" aria-live="polite"></p>
      </div>`;

    const title = this.querySelector('.game-title');
    if (title) {
      title.style.cursor = 'pointer';
      title.addEventListener('click', () => showLanding());
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
    const sinceEl = document.getElementById('profile-member-since');
    if (!card || !statsEl || !emptyEl || !errorEl || !nameEl || !sinceEl) return;

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
      if (data.member_since) {
        const d = new Date(data.member_since);
        sinceEl.textContent = `Member since ${d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
      } else {
        sinceEl.textContent = '';
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
      if (s.total_rounds) cards.push({ label: 'Rounds', value: String(s.total_rounds) });
      if (s.total_rolls) cards.push({ label: 'Rolls', value: String(s.total_rolls) });
      if (s.fastest_win_ms) {
        const secs = (s.fastest_win_ms / 1000).toFixed(1);
        cards.push({ label: 'Best Win', value: `${secs}s` });
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
    } catch {
      errorEl.textContent = 'Could not load profile';
    }
  }
}

customElements.define('profile-screen', ProfileScreen);
