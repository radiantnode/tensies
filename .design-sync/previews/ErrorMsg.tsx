import { ErrorMsg, TextInput } from 'tensies-ui';

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

export const GameNotFound = () => (
  <div style={dark}>
    <ErrorMsg>Game not found</ErrorMsg>
  </div>
);

/** The error line in its real seat — under a game-code field. */
export const UnderCodeField = () => (
  <div style={dark}>
    <TextInput code maxLength={5} defaultValue="QQQQQ" />
    <ErrorMsg>That game already started</ErrorMsg>
  </div>
);
