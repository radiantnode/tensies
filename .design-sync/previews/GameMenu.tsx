import { GameMenu } from 'tensies-ui';

/* GameMenu fills its nearest positioned ancestor — wrap each cell in a
   phone-proportioned dark positioning context. Closed state renders nothing
   visible, so only open states are shown. */
const phone: React.CSSProperties = {
  position: 'relative',
  height: 480,
  maxWidth: 390,
  background: 'var(--color-bg)',
  borderRadius: 12,
  overflow: 'hidden',
};

export const OpenUnpaused = () => (
  <div style={phone}>
    <GameMenu open />
  </div>
);

export const OpenPaused = () => (
  <div style={phone}>
    <GameMenu open paused remaining="54:07" waitingOn="Waiting on Salty Walrus…" />
  </div>
);

export const ConfirmingEnd = () => (
  <div style={phone}>
    <GameMenu open confirmingEnd />
  </div>
);
