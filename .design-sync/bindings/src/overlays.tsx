import type { ReactNode } from 'react';
import { DiceLoader } from './foundations';
import { LOGO_WINNER_SVG_URI } from './assets.generated';

export interface WinnerOverlayProps {
  /** Round number shown in the gold pill. */
  round: number;
  /** The winner's player name. */
  winnerName: string;
  /** Banner suffix — "Winner" (default), or e.g. "Loser" for the last-place variant. */
  suffix?: string;
  /** Countdown seconds label under the timer bar, e.g. "3". */
  seconds?: string;
  /** 0–1 fill of the next-round timer bar. */
  progress?: number;
  open?: boolean;
}

/**
 * The round-winner celebration (`.winner-overlay`, overlays.css): a dimmed
 * full-screen `<dialog>` with the "─ Round N Winner ─" banner, the winner
 * logo, the name in lights, and the next-round countdown bar at the bottom.
 */
export function WinnerOverlay({ round, winnerName, suffix = 'Winner', seconds, progress = 0.6, open = true }: WinnerOverlayProps) {
  return (
    <dialog className="overlay-dialog winner-overlay" open={open} aria-label="Round winner">
      <div className="winner-box">
        <div className="winner-banner">
          <span className="winner-banner-label">
            Round <span className="winner-round-pill">{round}</span> <span>{suffix}</span>
          </span>
        </div>
        <img src={LOGO_WINNER_SVG_URI} className="winner-logo" alt="" aria-hidden="true" />
        <p className="winner-name">{winnerName}</p>
      </div>
      <div className="winner-timer" aria-hidden="true">
        <div className="winner-timer-bar">
          <div className="winner-timer-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="winner-timer-secs">{seconds}</p>
      </div>
    </dialog>
  );
}

export interface PauseOverlayProps {
  /** Host name woven into the wait message. */
  hostName?: string;
  /** Override the message entirely. */
  message?: string;
  open?: boolean;
}

/**
 * The non-host pause wait screen (`.pause-overlay`, overlays.css): TENSIES
 * wordmark, the hopping-dice brand loader, and "Waiting for <host> to resume
 * the game" over a near-opaque dim. A `<dialog>` so the board stays live
 * underneath.
 */
export function PauseOverlay({ hostName = 'the host', message, open = true }: PauseOverlayProps) {
  return (
    <dialog className="overlay-dialog pause-overlay" open={open} aria-label="Game paused">
      <h1 className="logo">TENSIES</h1>
      <DiceLoader />
      <p className="pause-overlay-msg">{message ?? `Waiting for ${hostName} to resume the game`}</p>
    </dialog>
  );
}

export interface SheetProps {
  /** Heading in the sheet head (`.sheet-title`). */
  title: string;
  children?: ReactNode;
  open?: boolean;
  onClose?: () => void;
}

/**
 * The bottom sheet (`.sheet`, sheet.css): a blurred dark panel that slides up
 * from the screen bottom with a glowing top edge — used for the join form and
 * the check-in place picker. Head row carries the title and the X close chip.
 */
export function Sheet({ title, children, open = true, onClose }: SheetProps) {
  return (
    <dialog className="sheet" open={open} aria-label={title}>
      <div className="sheet-head">
        <h2 className="sheet-title">{title}</h2>
        <button type="button" className="sheet-close" aria-label="Close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      {children}
    </dialog>
  );
}

export interface ConfirmDialogProps {
  /** Question line (`.confirm-title`). */
  title: ReactNode;
  /** Supporting copy (`.confirm-body`). */
  body?: ReactNode;
  /** Action buttons — use `<Button>`; stacked vertically. */
  children: ReactNode;
  open?: boolean;
}

/**
 * A centered confirm dialog (`.confirm-dialog`, lobby.css) with a stacked
 * action column (`.confirm-actions.confirm-actions-stack`) — e.g. the
 * check-out confirmation.
 */
export function ConfirmDialog({ title, body, children, open = true }: ConfirmDialogProps) {
  return (
    <dialog className="confirm-dialog" open={open}>
      <h2 className="confirm-title">{title}</h2>
      {body ? <p className="confirm-body">{body}</p> : null}
      <div className="confirm-actions confirm-actions-stack">{children}</div>
    </dialog>
  );
}

export interface GameMenuProps {
  /** Render the menu open (`.game-menu.open`). */
  open?: boolean;
  /** Paused state — toggle slid on, status block visible. */
  paused?: boolean;
  /** Countdown shown while paused, e.g. "58:12". */
  remaining?: string;
  /** Who we're waiting on, e.g. "Waiting on Dapper Badger…". */
  waitingOn?: string;
  /** The End Game item is mid tap-to-confirm. */
  confirmingEnd?: boolean;
}

/**
 * The in-game host menu (`.game-menu` + `.menu-panel`, menu.css): the
 * Pause/Resume toggle with its sliding switch, the live pause status
 * (countdown + who's missing), and the danger End Game item. Position the
 * parent relative — the menu backdrop fills it.
 */
export function GameMenu({ open = true, paused, remaining = '60:00', waitingOn, confirmingEnd }: GameMenuProps) {
  return (
    <div className={open ? 'game-menu open' : 'game-menu'} aria-hidden={!open}>
      <nav className="menu-panel" aria-label="Game menu">
        <button
          type="button"
          className={paused ? 'menu-item menu-toggle active' : 'menu-item menu-toggle'}
          aria-pressed={paused ? 'true' : 'false'}
        >
          <span className="menu-item-label">{paused ? 'Resume Game' : 'Pause Game'}</span>
          <span className="menu-switch" aria-hidden="true" />
        </button>
        {paused ? (
          <div className="menu-status" aria-live="polite">
            <div className="menu-status-row">
              <span className="menu-status-label">Time remaining</span>
              <span className="menu-status-value">{remaining}</span>
            </div>
            <p className="menu-status-players">{waitingOn ?? "Everyone is here! Let's go!"}</p>
          </div>
        ) : null}
        <button type="button" className={confirmingEnd ? 'menu-item menu-item--danger confirming' : 'menu-item menu-item--danger'}>
          <span className="menu-item-label">{confirmingEnd ? 'Tap to confirm' : 'End Game'}</span>
        </button>
      </nav>
    </div>
  );
}
