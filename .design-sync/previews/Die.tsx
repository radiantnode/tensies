import { Die } from 'tensies-ui';

const dark: React.CSSProperties = {
  background: 'var(--color-bg)',
  padding: '1.5rem',
  borderRadius: 12,
  display: 'flex',
  gap: '1rem',
  justifyContent: 'center',
  alignItems: 'center',
};

export const Plain = () => (
  <div style={dark}>
    <Die value={4} />
  </div>
);

export const Matched = () => (
  <div style={dark}>
    <Die value={6} matched />
  </div>
);

export const AllFaces = () => (
  <div style={dark}>
    <Die value={1} />
    <Die value={2} />
    <Die value={3} />
    <Die value={4} />
    <Die value={5} />
    <Die value={6} />
  </div>
);

export const Tumbling = () => (
  <div style={dark}>
    <Die value={3} tumbling="a" />
  </div>
);
