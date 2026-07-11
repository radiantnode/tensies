import { createElement, type ReactNode } from 'react';
import { AVATAR_DEFAULT_URI, QR_PLACEHOLDER_URI } from './assets.generated';

export interface LobbyStampProps {
  /** The 5-letter game code, engraved as the stamp serial. */
  code: string;
  /** Venue name — mounts the "Checked In" cachet over the stamp when set. */
  placeName?: string;
  /** QR image source (the app serves `/api/qr/<code>.svg`); defaults to a placeholder pattern. */
  qrSrc?: string;
  /** Postmark date, `MM · DD · YY`. */
  date?: string;
  /** Show the "tap to enlarge" hint line under the stamp. */
  hint?: boolean;
}

/**
 * The vintage postage-stamp game invite (stamp.css) — perforated vermilion
 * frame, guilloche engraving, Rye serial, Yellowtail watermark, dice seal,
 * and the QR to join. The lobby's centerpiece. Scales as one fixed-ratio
 * unit to its container width.
 */
export function LobbyStamp({ code, placeName, qrSrc, date = '07 · 11 · 26', hint = true }: LobbyStampProps) {
  // The container selector in stamp.css is the <lobby-stamp> tag itself
  // (container-type sizing), so the binding renders the same tag.
  return createElement(
    'lobby-stamp',
    null,
    <>
      <div className="stamp">
        <div className="frame">
          <div className="paper-tex" />
          <div className="panel panel-l">
            <span className="stamp-date">{date}</span>
          </div>
          <div className="panel panel-r">
            <span>1 Game</span>
          </div>
          <div className="corner corner-tl" />
          <div className="corner corner-tr" />
          <div className="corner corner-bl" />
          <div className="corner corner-br" />
          <div className="main">
            <div className="guilloche" />
            <div className="watermark">Tensies</div>
            <div className="banner">✦&nbsp;&nbsp;Official Game Stamp · McKinney, Texas&nbsp;&nbsp;✦</div>
            <div className="seal">
              <svg className="dice" viewBox="0 0 100 100" aria-hidden="true">
                <g transform="rotate(-14 40 42)">
                  <rect x="18" y="20" width="44" height="44" rx="9" fill="var(--ink)" />
                  <circle cx="29" cy="30" r="3.2" fill="var(--paper)" />
                  <circle cx="29" cy="42" r="3.2" fill="var(--paper)" />
                  <circle cx="29" cy="54" r="3.2" fill="var(--paper)" />
                  <circle cx="51" cy="30" r="3.2" fill="var(--paper)" />
                  <circle cx="51" cy="42" r="3.2" fill="var(--paper)" />
                  <circle cx="51" cy="54" r="3.2" fill="var(--paper)" />
                </g>
                <g transform="rotate(10 62 60)">
                  <rect x="41" y="39" width="42" height="42" rx="8" fill="var(--paper)" stroke="var(--ink)" strokeWidth="2.2" />
                  <circle cx="52" cy="50" r="3" fill="var(--ink)" />
                  <circle cx="72" cy="50" r="3" fill="var(--ink)" />
                  <circle cx="52" cy="70" r="3" fill="var(--ink)" />
                  <circle cx="72" cy="70" r="3" fill="var(--ink)" />
                </g>
              </svg>
            </div>
            {placeName ? (
              <div className="checkin">
                <div className="checkin-top">Checked In</div>
                <div className="checkin-name">{placeName}</div>
              </div>
            ) : null}
            <div className="row1">
              <div className="idblock">
                <div className="serial">{code}</div>
              </div>
              <div className="qr-box">
                <img className="qr" alt="Scan to join" src={qrSrc ?? QR_PLACEHOLDER_URI} />
              </div>
            </div>
          </div>
        </div>
      </div>
      {hint ? <p className="enlarge-hint">Have your friends join via the code or tap to show them the QR code.</p> : null}
    </>,
  );
}

/** The lobby roster list (`.player-list`) — scrollable, edge-fading. Children are `<PlayerListItem>`s. */
export function PlayerList({ children }: { children: ReactNode }) {
  return (
    <ul className="player-list" aria-label="Players">
      {children}
    </ul>
  );
}

export interface PlayerListItemProps {
  name: string;
  /** Appends the gold HOST badge. */
  isHost?: boolean;
  /** Avatar image; defaults to the app's default avatar. */
  avatarSrc?: string;
}

/**
 * One lobby roster row (`.player-list-item`, lobby.css): gradient-ringed
 * avatar, player name, and the HOST badge on the game's host.
 */
export function PlayerListItem({ name, isHost, avatarSrc }: PlayerListItemProps) {
  return (
    <li className="player-list-item">
      <span className="lobby-avatar-ring">
        <img className="lobby-avatar" alt="" src={avatarSrc ?? AVATAR_DEFAULT_URI} />
      </span>
      <span className="lobby-player-name">{name}</span>
      {isHost ? <span className="host-badge">HOST</span> : null}
    </li>
  );
}
