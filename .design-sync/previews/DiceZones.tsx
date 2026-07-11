import { DiceZones } from 'tensies-ui';

/* DiceZones needs a sized parent (flex column with a height) or it renders
   blank — this wrapper mirrors the real board column on a phone. */
const board: React.CSSProperties = {
  background: 'var(--color-bg)',
  borderRadius: 12,
  padding: '1rem',
  width: 370,
  height: 420,
  display: 'flex',
  flexDirection: 'column',
};

export const MidRound = () => (
  <div style={board}>
    <DiceZones unmatched={[2, 5, 1, 3, 4]} matched={[6, 6, 6]} target={6} />
  </div>
);

export const FreshRoll = () => (
  <div style={board}>
    <DiceZones unmatched={[2, 5, 1, 3, 6, 4, 2, 5, 3, 1]} target={4} />
  </div>
);

export const NearWin = () => (
  <div style={board}>
    <DiceZones unmatched={[2]} matched={[6, 6, 6, 6, 6, 6, 6, 6, 6]} target={6} />
  </div>
);
