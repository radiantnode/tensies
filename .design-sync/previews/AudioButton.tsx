import { AudioButton } from 'tensies-ui';

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

export const Idle = () => (
  <div style={dark}>
    <AudioButton>
      <span>Play</span>
    </AudioButton>
  </div>
);

export const Playing = () => (
  <div style={dark}>
    <AudioButton state="playing">
      <span>Play</span>
    </AudioButton>
  </div>
);

export const Listening = () => (
  <div style={dark}>
    <AudioButton state="listening">
      <span>Listen</span>
    </AudioButton>
  </div>
);
