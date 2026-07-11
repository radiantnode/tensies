import { RoundStatus } from 'tensies-ui';

const dark: React.CSSProperties = {
  background: 'var(--color-bg)',
  padding: '1.5rem',
  borderRadius: 12,
  display: 'flex',
  justifyContent: 'center',
};

export const RoundThree = () => (
  <div style={dark}>
    <RoundStatus round={3} target={6} />
  </div>
);
