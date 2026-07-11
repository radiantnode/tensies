import { Button, OrDivider } from 'tensies-ui';

/** Dark app surface — Tensies is a dark-on-dark design language. */
const dark: React.CSSProperties = {
  background: 'var(--color-bg)',
  padding: '1.5rem',
  borderRadius: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.9rem',
  alignItems: 'stretch',
  maxWidth: 340,
  margin: '0 auto',
};

export const Alone = () => (
  <div style={dark}>
    <OrDivider />
  </div>
);

/** In its real seat — between the two landing CTAs. */
export const BetweenActions = () => (
  <div style={dark}>
    <Button block>Create Game</Button>
    <OrDivider />
    <Button block variant="secondary">
      Join Game
    </Button>
  </div>
);
