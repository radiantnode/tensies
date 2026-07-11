import { PlayerList, PlayerListItem } from 'tensies-ui';

const dark: React.CSSProperties = {
  background: 'var(--color-bg)',
  padding: '1.5rem',
  borderRadius: 12,
  maxWidth: 390,
};

export const HostRow = () => (
  <div style={dark}>
    <PlayerList>
      <PlayerListItem name="Dapper Badger" isHost />
    </PlayerList>
  </div>
);

export const NormalRow = () => (
  <div style={dark}>
    <PlayerList>
      <PlayerListItem name="Salty Walrus" />
    </PlayerList>
  </div>
);
