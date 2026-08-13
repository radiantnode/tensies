import { WinnerOverlay } from 'tensies-ui';

/* The overlay is a fixed-position full-viewport <dialog>. A transformed
   ancestor becomes its containing block, so this phone frame contains the
   overlay and gives it real layout height for capture. Export names keep
   `Winner` alphabetically first — it's the story the single card shows. */
const frame: React.CSSProperties = {
  position: 'relative',
  width: 390,
  height: 700,
  transform: 'translateZ(0)',
  overflow: 'hidden',
  borderRadius: 12,
  background: 'var(--color-bg)',
};

export const Winner = () => (
  <div style={frame}>
    <WinnerOverlay round={3} winnerName="Dapper Badger" seconds="3" progress={0.65} />
  </div>
);

export const WinnerLoser = () => (
  <div style={frame}>
    <WinnerOverlay round={3} winnerName="Salty Walrus" suffix="Loser" seconds="3" progress={0.3} />
  </div>
);
