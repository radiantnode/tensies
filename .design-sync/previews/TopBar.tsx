import { TopBar, PlayersBar, PlayerCard } from 'tensies-ui';

/* The bar spans a phone edge to edge — no padding on the wrapper. */
const dark: React.CSSProperties = {
  background: 'var(--color-bg)',
  borderRadius: 12,
  overflow: 'hidden',
  maxWidth: 390,
};

export const Plain = () => (
  <div style={dark}>
    <TopBar />
  </div>
);

export const SignedIn = () => (
  <div style={dark}>
    <TopBar username="michael" />
  </div>
);

export const InGame = () => (
  <div style={dark}>
    <TopBar>
      <PlayersBar>
        <PlayerCard name="Dapper Badger" isMe wins={2} matched={4} leading />
        <PlayerCard name="Salty Walrus" wins={1} matched={3} />
        <PlayerCard name="Fancy Mongoose" wins={2} matched={8} hot />
      </PlayersBar>
    </TopBar>
  </div>
);
