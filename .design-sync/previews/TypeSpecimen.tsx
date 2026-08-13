import { TypeSpecimen } from 'tensies-ui';

const dark: React.CSSProperties = {
  background: 'var(--color-bg)',
  padding: '1.5rem',
  borderRadius: 12,
  maxWidth: 420,
};

export const Specimen = () => (
  <div style={dark}>
    <TypeSpecimen />
  </div>
);
