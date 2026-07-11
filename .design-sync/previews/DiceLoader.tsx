import { DiceLoader } from 'tensies-ui';

/* The .stage is 200px scaled 0.55 with negative margins — give it breathing
   room so the hop never clips against the cell edge. */
const dark: React.CSSProperties = {
  background: 'var(--color-bg)',
  padding: '3rem',
  borderRadius: 12,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
};

export const Loader = () => (
  <div style={dark}>
    <DiceLoader />
  </div>
);

/* --color-panel-screen is translucent — it must sit over --color-bg, never
   over the white sheet, or it reads as washed-out grey. */
export const LoadingScreen = () => (
  <div style={{ background: 'var(--color-bg)', borderRadius: 12, overflow: 'hidden' }}>
    <div style={{ ...dark, background: 'var(--color-panel-screen)', borderRadius: 0, gap: '0.75rem' }}>
      <DiceLoader />
      <p className="loading-msg">Finding your table…</p>
    </div>
  </div>
);
