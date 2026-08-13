import { RollButton } from 'tensies-ui';

/* The roll bar spans edge-to-edge by design: .roll-area has margin-inline
   -1rem to break out of the board's 1rem padding, and the circular button +
   its notch rise ~3rem above the bar. Give the wrapper matching 1rem inline
   padding and 3.5rem top padding so the translucent bar and raised button
   stay over the dark surface instead of bleeding onto the white sheet. */
const dark: React.CSSProperties = {
  background: 'var(--color-bg)',
  padding: '3.5rem 1rem 1.5rem',
  borderRadius: 12,
  maxWidth: 390,
  overflow: 'hidden',
};

export const Default = () => (
  <div style={dark}>
    <RollButton />
  </div>
);

export const Paused = () => (
  <div style={dark}>
    <RollButton paused />
  </div>
);
