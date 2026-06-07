// Shared top-bar title row (logo + wordmark + hamburger). Used by <app-header>
// (landing/join/lobby) and the game header — one source of truth so the
// hamburger/title aren't copied per screen. Each host wires the hamburger to
// whichever menu it owns (nav menu vs game menu).

export const backButtonHTML = `<svg class="back-chevron" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18 9 12l6-6"/></svg><span>Back</span>`;

export const titleRowHTML = `
  <div class="topbar-title-row">
    <div class="game-title">
      <img src="/static/images/logo.svg" class="game-title-mark" alt="">
      <span>Tensies</span>
    </div>
    <button class="game-menu-btn" type="button" aria-label="Open menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
  </div>`;
