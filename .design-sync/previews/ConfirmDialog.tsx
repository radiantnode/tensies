import { Button, ConfirmDialog } from 'tensies-ui';

/* ConfirmDialog is a native <dialog> designed for showModal() (UA-centered,
   ::backdrop dim). The bindings render it inline non-modal, so there's no
   backdrop and it sits at its static position — give it a phone-sized dark
   wrapper as positioning context; the flex centering sets the dialog's static
   position, and the UA's left/right:0 + margin:auto centers it horizontally. */
const phone: React.CSSProperties = {
  position: 'relative',
  height: 620,
  maxWidth: 390,
  background: 'var(--color-bg)',
  borderRadius: 12,
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export const CheckOut = () => (
  <div style={phone}>
    <ConfirmDialog
      title="Checked in at The Celt"
      body="Check out to remove your game from Nearby."
    >
      <Button variant="secondary">Pick a different place</Button>
      <Button>Check out</Button>
      <Button variant="secondary">Cancel</Button>
    </ConfirmDialog>
  </div>
);
