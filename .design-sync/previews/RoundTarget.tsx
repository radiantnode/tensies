import { RoundTarget } from 'tensies-ui';

const dark: React.CSSProperties = {
  background: 'var(--color-bg)',
  padding: '1.5rem',
  borderRadius: 12,
  display: 'flex',
  gap: '1.5rem',
  justifyContent: 'center',
  alignItems: 'center',
};

export const Targets = () => (
  <div style={dark}>
    <RoundTarget value={6} />
    <RoundTarget value={3} />
  </div>
);
