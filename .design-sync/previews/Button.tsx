import { Button } from 'tensies-ui';

/** Dark app surface — Tensies is a dark-on-dark design language. */
const dark: React.CSSProperties = {
  background: 'var(--color-bg)',
  padding: '1.5rem',
  borderRadius: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.9rem',
  alignItems: 'center',
};

export const Primary = () => (
  <div style={dark}>
    <Button>Create Game</Button>
  </div>
);

export const Secondary = () => (
  <div style={dark}>
    <Button variant="secondary">Pick a different place</Button>
  </div>
);

export const BlockCTA = () => (
  <div style={{ ...dark, alignItems: 'stretch', minWidth: 320 }}>
    <Button block>Start Game</Button>
  </div>
);

export const Disabled = () => (
  <div style={dark}>
    <Button disabled>Start Game</Button>
    <Button variant="secondary" disabled>
      Check out
    </Button>
  </div>
);
