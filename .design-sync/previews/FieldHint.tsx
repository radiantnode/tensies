import { FieldHint } from 'tensies-ui';

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

/** The landing hint, with its inline `.field-hint-link` anchor. */
export const LandingHint = () => (
  <div style={dark}>
    <FieldHint>
      Play with any name, or{' '}
      <a className="field-hint-link" href="/signin">
        sign up
      </a>{' '}
      to keep your stats.
    </FieldHint>
  </div>
);

export const PlainHint = () => (
  <div style={dark}>
    <FieldHint>Ask the host for the 5-letter game code.</FieldHint>
  </div>
);
