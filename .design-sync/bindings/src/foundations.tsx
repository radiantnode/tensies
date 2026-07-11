import type { ReactNode } from 'react';
import { PIP_POSITIONS } from './pips';

/** One 3×3 pip-grid die for the loader (`.die` in critical.css — flat, 2-D). */
function LoaderDie({ variant, value }: { variant: 'pink' | 'ivory'; value: number }) {
  const on = new Set(PIP_POSITIONS[value] ?? []);
  return (
    <div className={`die die--${variant}`}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={on.has(i) ? 'pip on' : 'pip'} />
      ))}
    </div>
  );
}

/**
 * The Tensies brand loader: a pink 6 and an ivory 4 hopping with
 * squash-and-stretch over a pulsing ground shadow, resting in the logo pose.
 * Pure CSS animation (critical.css `.stage`); used on the loading screen and
 * the pause overlay. Follow it with a `.loading-msg` line when used as a
 * loading screen.
 */
export function DiceLoader() {
  return (
    <div className="stage" aria-hidden="true">
      <div className="die die--shadow" />
      <LoaderDie variant="pink" value={6} />
      <LoaderDie variant="ivory" value={4} />
    </div>
  );
}

const COLOR_TOKENS = [
  '--color-accent',
  '--color-success',
  '--color-bg',
  '--color-panel',
  '--color-panel-screen',
  '--color-field',
  '--color-raised',
  '--color-raised-hover',
  '--color-border',
  '--color-border-strong',
  '--color-text',
  '--color-text-warm',
  '--color-text-muted',
  '--color-text-label',
  '--color-amber',
];

/**
 * Documentation specimen — the Tensies color tokens (`--color-*` custom
 * properties from critical.css) rendered as labeled swatches. Use the tokens
 * via `var(--color-…)` in your own styles; don't hard-code hex values.
 */
export function ColorTokens() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', padding: '1rem' }}>
      {COLOR_TOKENS.map((t) => (
        <div key={t} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <div
            style={{
              blockSize: '44px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-strong)',
              background: `var(${t})`,
            }}
          />
          <code style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)' }}>{t}</code>
        </div>
      ))}
    </div>
  );
}

/**
 * Documentation specimen — the Tensies type system: EB Garamond for headings
 * (`--font-family-heading`), Inter for body/UI (`--font-family-base`), plus
 * the two vintage-stamp display faces (Rye and Yellowtail, lobby stamp only).
 */
export function TypeSpecimen() {
  const row: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.15rem' };
  const label: React.CSSProperties = {
    fontSize: '0.62rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--color-text-muted)',
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', padding: '1.25rem' }}>
      <div style={row}>
        <span style={label}>Heading · EB Garamond</span>
        <span style={{ fontFamily: 'var(--font-family-heading)', fontSize: '1.9rem', fontWeight: 600 }}>
          Waiting for Players
        </span>
      </div>
      <div style={row}>
        <span style={label}>Body · Inter</span>
        <span style={{ fontFamily: 'var(--font-family-base)', fontSize: '1rem', color: 'var(--color-text-warm)' }}>
          First player to lock all ten dice wins the round.
        </span>
      </div>
      <div style={row}>
        <span style={label}>Label · Inter 700</span>
        <span style={{ fontWeight: 700, letterSpacing: '0.05em', fontSize: '0.9rem' }}>Create Game</span>
      </div>
      <div style={row}>
        <span style={label}>Stamp serial · Rye</span>
        <span style={{ fontFamily: "'Rye', serif", fontSize: '1.5rem', color: 'var(--color-amber)' }}>KQZXV</span>
      </div>
      <div style={row}>
        <span style={label}>Stamp script · Yellowtail</span>
        <span style={{ fontFamily: "'Yellowtail', cursive", fontSize: '1.7rem', color: 'var(--color-text-warm)' }}>
          Tensies
        </span>
      </div>
    </div>
  );
}

/** Shared children-only prop shape used across the simple wrappers. */
export interface ChildrenProps {
  children?: ReactNode;
}
