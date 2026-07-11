import { ActionButton, EqIcon } from 'tensies-ui';

/** Dark app surface — Tensies is a dark-on-dark design language. */
const dark: React.CSSProperties = {
  background: 'var(--color-bg)',
  padding: '1.5rem',
  borderRadius: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.9rem',
  alignItems: 'center',
};

const LinkIcon = () => (
  <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const ShareIcon = () => (
  <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <polyline points="16 6 12 2 8 6" />
    <line x1="12" y1="2" x2="12" y2="15" />
  </svg>
);

const PinIcon = () => (
  <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

/** The full lobby action row: Copy Link / Share / Play / checked-in Check Out. */
export const LobbyRow = () => (
  <div style={dark}>
    <div className="lobby-actions">
      <ActionButton label="Copy Link">
        <LinkIcon />
      </ActionButton>
      <ActionButton label="Share">
        <ShareIcon />
      </ActionButton>
      <ActionButton label="Play" audio>
        <EqIcon />
      </ActionButton>
      <ActionButton label="Check Out" on>
        <PinIcon />
      </ActionButton>
    </div>
  </div>
);

/** The Check In toggle, off beside on. */
export const CheckInToggle = () => (
  <div style={dark}>
    <div className="lobby-actions">
      <ActionButton label="Check In">
        <PinIcon />
      </ActionButton>
      <ActionButton label="Check Out" on>
        <PinIcon />
      </ActionButton>
    </div>
  </div>
);
