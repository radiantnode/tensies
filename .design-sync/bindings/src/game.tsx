import type { ReactNode } from 'react';
import { FACE_ROTATIONS, PIP_POSITIONS } from './pips';

function Face({ value }: { value: number }) {
  const on = new Set(PIP_POSITIONS[value] ?? []);
  return (
    <div className={`face face-${value}`}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={on.has(i) ? 'dot active' : 'dot'} />
      ))}
    </div>
  );
}

export interface DieProps {
  /** Face value shown (1–6). */
  value: number;
  /** Mark as locked on the round target (the app's `match` class). Note: the
   *  shipped CSS styles matched and unmatched dice with the same ivory
   *  material — matched-ness reads positionally (the matched zone), and the
   *  pink accent belongs to the round-target die, not to matched dice. */
  matched?: boolean;
  /** Run one of the three unsynchronised tumble animations. */
  tumbling?: 'a' | 'b' | 'c';
}

/**
 * One 3-D bone-ivory die (`.die-scene` → `.die-3d` cube with six pip faces,
 * dice.css). The cube is rotated so `value` faces front; `matched` marks it
 * as locked on the round target; `tumbling` runs the roll-shake animation.
 */
export function Die({ value, matched, tumbling }: DieProps) {
  const cls = ['die-3d', matched ? 'match' : '', tumbling ? `tumbling-${tumbling}` : ''].filter(Boolean).join(' ');
  return (
    <div className="die-scene">
      <div className={cls} style={{ transform: FACE_ROTATIONS[value] ?? 'rotateY(0deg)' }}>
        {[1, 2, 3, 4, 5, 6].map((f) => (
          <Face key={f} value={f} />
        ))}
      </div>
    </div>
  );
}

/**
 * The flat pink target die from the round header (`.round-target-die`,
 * game.css) — a tilted 3×3 pip grid showing the value every player is
 * rolling for this round.
 */
export function RoundTarget({ value }: { value: number }) {
  const on = new Set(PIP_POSITIONS[value] ?? []);
  return (
    <div className="round-target-die">
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={on.has(i) ? 'dot active' : 'dot'} />
      ))}
    </div>
  );
}

/**
 * The round header (`.round-status`): the gold-rimmed "Round N" pill
 * (`.round-label`) above the target die.
 */
export function RoundStatus({ round, target }: { round: number; target: number }) {
  return (
    <div className="round-status">
      <div className="round-label">Round {round}</div>
      <RoundTarget value={target} />
    </div>
  );
}

export interface RollButtonProps {
  /** Freezes the button with the "Paused" label, as when the host pauses the game. */
  paused?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

/**
 * The big Roll bar (`.roll-area` + `.btn-roll`, game.css) pinned under the
 * dice zones. Shows "Paused" and disables while the game is paused.
 */
export function RollButton({ paused, disabled, onClick }: RollButtonProps) {
  return (
    <div className="roll-area">
      <button type="button" className="btn-roll" disabled={paused || disabled} onClick={onClick}>
        {paused ? 'Paused' : 'Roll'}
      </button>
    </div>
  );
}

/* Deterministic stand-in for the app's placeGrid scatter (static/js/dice.js):
   same grid-plus-jitter idea, seeded so a given dice count always renders the
   same casual arrangement. The app computes pixel positions from the live zone
   rect; here percentages keep the binding layout-independent. */
function scatter(count: number): Array<{ x: number; y: number; rot: number }> {
  let seed = 42 + count;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const cols = Math.max(2, Math.round(Math.sqrt(count * 1.4)));
  const rows = Math.max(1, Math.ceil(count / cols));
  const out: Array<{ x: number; y: number; rot: number }> = [];
  for (let i = 0; i < count; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    out.push({
      x: ((c + 0.5) / cols) * 78 + (rand() - 0.5) * 10,
      y: ((r + 0.5) / rows) * 72 + (rand() - 0.5) * 10,
      rot: (rand() - 0.5) * 24,
    });
  }
  return out;
}

export interface DiceZonesProps {
  /** Values of the not-yet-matched dice, scattered loose in the play zone. */
  unmatched: number[];
  /** Values of the locked, matched dice stacked in the right-hand column. */
  matched?: number[];
  /** The round target — dice in the matched column carry the app's `match` class. */
  target: number;
}

/**
 * The player's dice board (`.dice-zones`, game.css): unmatched dice scattered
 * across the left zone, matched dice collected in the right column with their
 * casual alternating tilts. Give the parent a height — the zones flex-fill it.
 */
export function DiceZones({ unmatched, matched = [], target }: DiceZonesProps) {
  const spots = scatter(unmatched.length);
  return (
    <div className="dice-zones">
      <div className="zone-unmatched">
        {unmatched.map((v, i) => (
          <div
            key={i}
            className="die-wrapper"
            style={{
              left: `${spots[i].x}%`,
              top: `${spots[i].y}%`,
              transform: `rotate(${spots[i].rot}deg)`,
            }}
          >
            <Die value={v} matched={false} />
          </div>
        ))}
      </div>
      <div className="zone-matched">
        {matched.map((v, i) => (
          <Die key={i} value={v} matched={v === target} />
        ))}
      </div>
    </div>
  );
}

export interface PlayerCardProps {
  name: string;
  /** Round wins so far — shown as "3W". */
  wins?: number;
  /** Dice matching the current target (fills the progress bar). */
  matched?: number;
  /** Total dice (defaults to 10). */
  total?: number;
  /** This card is the local player — "you" badge + accent fill. */
  isMe?: boolean;
  /** Highlight the wins chip (tied for the lead). */
  leading?: boolean;
  /** Opponent closing in (7+ matched) — red fill + count. */
  hot?: boolean;
  /** Dim the card while the player is offline. */
  disconnected?: boolean;
}

/**
 * A players-bar mini card (`.player-mini`, players-bar.css): name, "you"
 * badge, wins chip, and the dice-progress bar. Mirrors the app's
 * `<player-card>` element exactly.
 */
export function PlayerCard({
  name,
  wins = 0,
  matched = 0,
  total = 10,
  isMe,
  leading,
  hot,
  disconnected,
}: PlayerCardProps) {
  const fillVariant = isMe ? ' me' : hot ? ' hot' : '';
  return (
    <div className={disconnected ? 'player-mini disconnected' : 'player-mini'}>
      <div className="player-mini-top">
        <div className="player-mini-name">{name}</div>
        {isMe ? <span className="player-mini-you">you</span> : null}
        <div className={leading ? 'player-mini-wins leading' : 'player-mini-wins'}>{wins}W</div>
      </div>
      <div className="player-mini-progress">
        <div className={`player-mini-fill${fillVariant}`} style={{ width: `${(matched / total) * 100}%` }} />
      </div>
      <div className={hot ? 'player-mini-count hot' : 'player-mini-count'}>
        {matched}/{total}
      </div>
    </div>
  );
}

/**
 * The horizontal scroll row of player minis under the game title
 * (`.players-bar`). Children are `<PlayerCard>`s, local player first.
 */
export function PlayersBar({ children }: { children: ReactNode }) {
  return (
    <div className="players-bar" role="list" aria-label="Players">
      {children}
    </div>
  );
}
