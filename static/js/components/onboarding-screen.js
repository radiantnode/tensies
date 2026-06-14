// @ts-check
import './app-header.js';
import { byId } from '../dom.js';
import { showLanding } from '../router.js';

/**
 * <onboarding-screen> — post-signup username confirmation + vanity URL reveal.
 * Light DOM: the host element *is* `#onboarding.screen`.
 */
export class OnboardingScreen extends HTMLElement {
  connectedCallback() {
    if (this.dataset.rendered) return;
    this.dataset.rendered = 'true';
    this.id = 'onboarding';
    this.className = 'screen onboarding-screen';
    this.setAttribute('aria-labelledby', 'onboarding-title');
    this.innerHTML = `
      <app-header></app-header>
      <div class="screen-body">
        <h1 id="onboarding-title" class="screen-title">You're All Set</h1>
        <p class="tagline" id="onboarding-tagline">Your account is ready</p>
        <div class="onboarding-card">
          <p class="onboarding-username" id="onboarding-username"></p>
          <p class="onboarding-vanity" id="onboarding-vanity"></p>
        </div>
        <div class="onboarding-stats" id="onboarding-stats"></div>
        <button id="onboarding-go-btn" type="button" class="btn btn-primary">Let's go</button>
      </div>`;

    byId('onboarding-go-btn').addEventListener('click', () => showLanding());
  }

  /**
   * Populate the screen with the confirmed username and any transferred stats.
   * @param {string} username
   * @param {object | null} stats
   */
  show(username, stats) {
    const nameEl = document.getElementById('onboarding-username');
    const vanityEl = document.getElementById('onboarding-vanity');
    if (nameEl) nameEl.textContent = `@${username}`;
    if (vanityEl) vanityEl.textContent = `tensies.app/@${username}`;

    const statsEl = document.getElementById('onboarding-stats');
    const tagline = document.getElementById('onboarding-tagline');
    if (!statsEl) return;

    if (!stats) {
      statsEl.innerHTML = '';
      if (tagline) tagline.textContent = 'Your account is ready';
      return;
    }

    if (tagline) tagline.textContent = 'Your history came with you';

    /** @type {Array<{ label: string, value: string }>} */
    const cards = [];

    if (stats.total_games) {
      cards.push({ label: 'Games', value: String(stats.total_games) });
    }
    if (stats.total_wins) {
      cards.push({ label: 'Wins', value: String(stats.total_wins) });
    }
    if (stats.total_rounds) {
      cards.push({ label: 'Rounds', value: String(stats.total_rounds) });
    }
    if (stats.total_rolls) {
      cards.push({ label: 'Rolls', value: String(stats.total_rolls) });
    }
    if (stats.fastest_win_ms) {
      const secs = (stats.fastest_win_ms / 1000).toFixed(1);
      cards.push({ label: 'Best Win', value: `${secs}s` });
    }
    if (stats.total_time_played_ms) {
      const mins = Math.round(stats.total_time_played_ms / 60000);
      cards.push({ label: 'Time Played', value: mins < 60 ? `${mins}m` : `${(mins / 60).toFixed(1)}h` });
    }

    if (cards.length === 0) {
      statsEl.innerHTML = '';
      return;
    }

    statsEl.innerHTML = cards.map((c) => `
      <div class="stat-card">
        <span class="stat-value">${c.value}</span>
        <span class="stat-label">${c.label}</span>
      </div>
    `).join('');
  }
}

customElements.define('onboarding-screen', OnboardingScreen);
