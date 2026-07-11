import { BackButton } from 'tensies-ui';

/**
 * Dark app surface — `.btn-back` is absolutely positioned (top-left of its
 * screen), so cells either neutralise that (Alone) or give it a relative,
 * app-shaped header row to seat into (BesideScreenTitle).
 */
const dark: React.CSSProperties = {
  background: 'var(--color-bg)',
  padding: '1.5rem',
  borderRadius: 12,
};

export const Alone = () => (
  <div style={{ ...dark, display: 'flex', justifyContent: 'center' }}>
    <BackButton style={{ position: 'static' }} />
  </div>
);

/** Its real seat — absolute chip beside a `.screen-title.has-back` heading (the app's own pattern). */
export const BesideScreenTitle = () => (
  <div style={{ ...dark, position: 'relative', padding: '1.45rem 2rem', minHeight: '5.4rem' }}>
    <BackButton />
    <h1 className="screen-title has-back" style={{ marginBlock: '0.35rem 0' }}>
      Join a Game
    </h1>
  </div>
);
