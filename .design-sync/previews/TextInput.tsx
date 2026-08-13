import { TextInput } from 'tensies-ui';

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

export const NameField = () => (
  <div style={dark}>
    <TextInput placeholder="Your name" maxLength={20} />
  </div>
);

export const CodeField = () => (
  <div style={dark}>
    <TextInput code placeholder="ABCDE" maxLength={5} />
  </div>
);

export const CodeFilled = () => (
  <div style={dark}>
    <TextInput code maxLength={5} defaultValue="KQZXV" />
  </div>
);
