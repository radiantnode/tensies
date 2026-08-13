import { PlayerList, PlayerListItem } from 'tensies-ui';

const dark: React.CSSProperties = {
  background: 'var(--color-bg)',
  padding: '1.5rem',
  borderRadius: 12,
  maxWidth: 390,
};

export const Roster = () => (
  <div style={dark}>
    <PlayerList>
      <PlayerListItem name="Dapper Badger" isHost />
      <PlayerListItem name="Salty Walrus" />
      <PlayerListItem name="Fancy Mongoose" />
    </PlayerList>
  </div>
);
