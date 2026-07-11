import { LobbyStamp } from 'tensies-ui';

const dark: React.CSSProperties = {
  background: 'var(--color-bg)',
  padding: '1.5rem 1.25rem',
  borderRadius: 12,
};

export const Invite = () => (
  <div style={{ ...dark, maxWidth: 390 }}>
    <LobbyStamp code="KQZXV" hint={false} />
  </div>
);

export const CheckedIn = () => (
  <div style={{ ...dark, maxWidth: 390 }}>
    <LobbyStamp code="BWNRG" placeName="The Celt Irish Pub" hint={false} />
  </div>
);
