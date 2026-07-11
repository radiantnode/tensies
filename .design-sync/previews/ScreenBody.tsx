import { ScreenBody, ScreenTitle } from 'tensies-ui';

/* Shown as the layout primitive: a full-height flex column carrying the
   screen's side padding. */
/* --color-panel-screen is translucent — layer it over --color-bg so the cell
   shows the real in-app dark, not a grey wash over the white sheet. */
const dark: React.CSSProperties = {
  background: 'var(--color-bg)',
  borderRadius: 12,
  maxWidth: 390,
  height: 300,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const screen: React.CSSProperties = {
  background: 'var(--color-panel-screen)',
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
};

export const Layout = () => (
  <div style={dark}>
    <div style={screen}>
      <ScreenBody>
      <ScreenTitle>Waiting for Players</ScreenTitle>
      <p style={{ color: 'var(--color-text-warm)' }}>
        Share the code with your table and start when everyone's in.
      </p>
      </ScreenBody>
    </div>
  </div>
);
