import { AudioButton, EqIcon } from 'tensies-ui';

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

/**
 * EqIcon is only meaningful inside a `.btn-audio` — AudioButton composes it
 * automatically; this shows it dancing inside a playing audio button.
 */
export const InsideAudioButton = () => (
  <div style={dark}>
    <AudioButton state="playing">
      <span>Play</span>
    </AudioButton>
  </div>
);

/** Standalone at rest (amber) on a dark chip — outside a button, just the bars. */
export const StandaloneOnChip = () => (
  <div style={dark}>
    <div
      className="btn-audio"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.75rem 1rem',
        borderRadius: 10,
        background: 'rgba(255, 255, 255, 0.06)',
      }}
    >
      <EqIcon />
    </div>
  </div>
);
