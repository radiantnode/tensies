import { PlayerCard } from 'tensies-ui';

/* The mini card lives in the players bar at ~1/4 of a phone width — give each
   cell that real proportion instead of a full-width strip. */
const dark: React.CSSProperties = {
  background: 'var(--color-bg)',
  padding: '1.25rem',
  borderRadius: 12,
  display: 'flex',
  gap: '0.45rem',
  justifyContent: 'center',
  width: 200,
};

export const Me = () => (
  <div style={dark}>
    <PlayerCard name="Dapper Badger" isMe wins={2} matched={4} leading />
  </div>
);

export const Opponent = () => (
  <div style={dark}>
    <PlayerCard name="Salty Walrus" wins={1} matched={3} />
  </div>
);

export const HotOpponent = () => (
  <div style={dark}>
    <PlayerCard name="Fancy Mongoose" wins={2} matched={8} hot />
  </div>
);

export const Disconnected = () => (
  <div style={dark}>
    <PlayerCard name="Sleepy Otter" wins={0} matched={2} disconnected />
  </div>
);
