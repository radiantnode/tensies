import { SectionLabel } from 'tensies-ui';

const dark: React.CSSProperties = {
  background: 'var(--color-bg)',
  padding: '1.5rem',
  borderRadius: 12,
  maxWidth: 390,
};

export const Label = () => (
  <div style={dark}>
    <SectionLabel>Fellow Bar Rats</SectionLabel>
  </div>
);
