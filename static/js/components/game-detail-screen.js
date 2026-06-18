// @ts-check
import './app-header.js';
import { getAuthUser } from '../auth.js';
import { showLanding } from '../router.js';

/**
 * <game-detail-screen> — post-game detail view at /games/<code>.
 * Light DOM: the host element *is* `#game-detail.screen`.
 * @typedef {{ show(code: string): Promise<void> }} GameDetailScreen
 */
export class GameDetailScreen extends HTMLElement {
  connectedCallback() {
    if (this.dataset.rendered) return;
    this.dataset.rendered = 'true';
    this.id = 'game-detail';
    this.className = 'screen game-detail-screen';
    this.setAttribute('aria-label', 'Game detail');
    this.innerHTML = `
      <app-header></app-header>
      <div class="screen-body">
        <p class="error-msg" id="game-detail-error" role="alert" aria-live="polite"></p>
        <div id="game-detail-content"></div>
      </div>`;

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
   * Fetch and display a game's post-game detail.
   * @param {string} code
   */
  async show(code) {
    const errorEl = document.getElementById('game-detail-error');
    const contentEl = document.getElementById('game-detail-content');
    if (!errorEl || !contentEl) return;

    errorEl.textContent = '';
    contentEl.innerHTML = '';

    try {
      const res = await fetch(`/api/game/${encodeURIComponent(code.toUpperCase())}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        errorEl.textContent = body.detail || 'Game not found';
        return;
      }
      const data = await res.json();
      contentEl.innerHTML = `<p class="game-detail-summary">Game ${data.game_code} — ${data.num_rounds} rounds, ${data.num_players} players</p>`;
    } catch {
      errorEl.textContent = 'Could not load game';
    }
  }
}

customElements.define('game-detail-screen', GameDetailScreen);
