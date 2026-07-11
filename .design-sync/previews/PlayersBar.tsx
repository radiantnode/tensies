import { PlayersBar, PlayerCard } from 'tensies-ui';

const dark: React.CSSProperties = {
  background: 'var(--color-bg)',
  padding: '1rem 0.75rem',
  borderRadius: 12,
  maxWidth: 390,
};

export const FourPlayers = () => (
  <div style={dark}>
    <PlayersBar>
      <PlayerCard name="Dapper Badger" isMe wins={2} matched={4} leading />
      <PlayerCard name="Salty Walrus" wins={1} matched={8} hot />
      <PlayerCard name="Fancy Mongoose" wins={2} matched={3} />
      <PlayerCard name="Sleepy Otter" wins={0} matched={2} disconnected />
    </PlayersBar>
  </div>
);

export const TwoPlayers = () => (
  <div style={dark}>
    <PlayersBar>
      <PlayerCard name="Dapper Badger" isMe wins={1} matched={6} leading />
      <PlayerCard name="Salty Walrus" wins={1} matched={5} />
    </PlayersBar>
  </div>
);
