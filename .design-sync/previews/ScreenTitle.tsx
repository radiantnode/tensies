import { ScreenTitle, BackButton } from 'tensies-ui';

const dark: React.CSSProperties = {
  background: 'var(--color-bg)',
  padding: '1.5rem',
  borderRadius: 12,
  maxWidth: 390,
};

export const Title = () => (
  <div style={dark}>
    <ScreenTitle>Waiting for Players</ScreenTitle>
  </div>
);

export const WithBack = () => (
  <div style={dark}>
    <BackButton />
    <ScreenTitle hasBack>Join a Game</ScreenTitle>
  </div>
);
