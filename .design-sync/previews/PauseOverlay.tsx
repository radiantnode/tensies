import { PauseOverlay } from 'tensies-ui';

/* Fixed-position full-viewport <dialog> — contained by a transformed phone
   frame so it has real layout height for capture (see WinnerOverlay.tsx). */
const frame: React.CSSProperties = {
  position: 'relative',
  width: 390,
  height: 700,
  transform: 'translateZ(0)',
  overflow: 'hidden',
  borderRadius: 12,
  background: 'var(--color-bg)',
};

export const Waiting = () => (
  <div style={frame}>
    <PauseOverlay hostName="Dapper Badger" />
  </div>
);
