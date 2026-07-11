import type { ReactNode } from 'react';
import { LOGO_SVG_URI } from './assets.generated';

/**
 * The branded top bar (`.game-topbar`): dice logo mark + "Tensies" wordmark +
 * the three-line hamburger. Pre-game screens use it alone (`.app-header`
 * variant); the game screen passes a `<PlayersBar>` as children below the
 * title row. `username` shows the signed-in pill (`.header-username`).
 */
export function TopBar({ username, children }: { username?: string; children?: ReactNode }) {
  const cls = children ? 'game-topbar' : 'game-topbar app-header';
  return (
    <header className={cls}>
      <div className="topbar-title-row">
        <div className="game-title">
          <img src={LOGO_SVG_URI} className="game-title-mark" alt="" />
          <span>Tensies</span>
        </div>
        {username ? (
          <a className="header-username" href={`/@${username}`}>
            @{username}
          </a>
        ) : null}
        <button className="game-menu-btn" type="button" aria-label="Open menu" aria-expanded="false">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
      {children}
    </header>
  );
}

/**
 * Screen heading (`.screen-title`) — EB Garamond serif, e.g. "Waiting for
 * Players". `hasBack` reserves room for the round back chip beside it.
 */
export function ScreenTitle({ hasBack, children }: { hasBack?: boolean; children: ReactNode }) {
  return <h1 className={hasBack ? 'screen-title has-back' : 'screen-title'}>{children}</h1>;
}

/** Small uppercase section heading (`.section-label`), e.g. "Fellow Bar Rats". */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="section-label">{children}</h2>;
}

/**
 * The scrolling content column of a screen (`.screen-body`) — sits under the
 * `TopBar` inside a full-height flex screen and carries the side padding.
 */
export function ScreenBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className ? `screen-body ${className}` : 'screen-body'}>{children}</div>;
}
