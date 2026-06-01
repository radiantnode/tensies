// Shared top-bar title row (logo + wordmark + hamburger). Used by <app-header>
// (landing/join/lobby) and the game header — one source of truth so the
// hamburger/title aren't copied per screen. Each host wires the hamburger to
// whichever menu it owns (nav menu vs game menu).
export const titleRowHTML = `
  <div class="topbar-title-row">
    <div class="game-title">
      <img src="/static/logo.svg" class="game-title-mark" alt="">
      <span>Tensies</span>
    </div>
    <button class="game-menu-btn" type="button" aria-label="Open menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
  </div>`;
