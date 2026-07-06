# Gameplay Dynamics

All numbers below were computed exactly (or simulated at 100k trials) from the actual mechanics in `apply_roll()` — not estimated.

## The math of a round

Each unlocked die locks with p = 1/6 per roll, dice are independent, so a single die's lock-roll is Geometric(1/6) and a player's completion roll R is the **max of 10 iid geometrics**:

```
P(R ≤ r) = (1 − (5/6)^r)^10
E[R]     = Σ_{r≥0} [1 − (1 − (5/6)^r)^10]  =  16.56 rolls
```

| statistic | value |
|---|---|
| mean | **16.56 rolls** (σ = 6.83) |
| p10 / p25 / median | 9 / 12 / 15 |
| p75 / p90 / p95 / p99 | 20 / 26 / 29 / 38 |
| E[dice locked on roll 1] | 10/6 ≈ 1.67 |
| P(≥3 locks on roll 1) | 22.5% |
| E[unlocked] after roll r | 10·(5/6)^r → 4.0 after 5 rolls, 1.9 after 9 |

**The tension curve.** A round is exponential-decay progress with a long coin-flip tail: the first ~5 rolls lock over half the board (feels fast and generous), then progress decelerates hard. **91.5% of rounds pass through a lone-last-die phase, and that phase averages 6.0 rolls** — roughly a third of the expected round is spent whiffing on one die. For a party game that's a genuinely good structure: the leader visibly stalls at 9/10, trailing players stay in it, and the last-die grind is where the screaming happens. Solo or two-player, the p90+ tail (26–38 rolls) can read as punishment rather than tension.

**Round length.** The effective roll cadence is set by the client animation, not the server: gather 200 ms + shake 300–700 ms + scatter 320 ms (+500 ms pop on locks), button re-enabled only in `tryReveal`'s completion callback → **~1.2–1.8 s per roll cycle**. Typical rounds run ~15–30 s, plus `ROUND_WIN_DELAY = 3.0 s` of dead time (a healthy ~12%).

## Skill vs luck — and two real fairness gaps

The only player inputs are *when* to tap and *how promptly* you re-tap after the reveal. `touch.js` deliberately converts a rapid second tap on a ready roll button into a click, but since `roll.js` disables the button through the whole shake→reveal cycle, the skill is really **re-tap promptness**, worth maybe 100–300 ms per cycle. Simulated head-to-head, two players:

| cadence advantage | P(win round) |
|---|---|
| equal | 50% |
| 10% faster | 57% |
| 20% faster | 65% |
| 2× faster | 90% |

For casual mobile play this is close to the right mix: mostly luck (σ/μ = 0.41 swamps small speed edges), with just enough agency that attentive players feel rewarded. Two caveats found in the code:

1. **`prefers-reduced-motion` is a speed hack.** `startShake` sets `rollShakeEnd = Date.now()` immediately under reduced motion, skipping 500–900 ms per roll → ~40% faster cadence → **roughly a 70% round-win rate against a default-animation opponent.** An accessibility setting shouldn't double your win rate.
2. **The real rate limiter is client-side.** `MIN_ROLL_INTERVAL = 0.25 s` (server) is ~5–6× looser than the honest-client animation floor. A stripped client rolling at 0.25 s cadence beats a normal one 90%+ of the time. Roll Trust proves the *dice* were fair, but not the *pacing*. Fine for friends at a bar; worth tightening if strangers ever share a lobby.

Slow devices lose on both animation frame budget and network RTT (a roll is a full round-trip before the reveal can resolve). There's no compensation mechanism.

## `delayed_broadcast` as a game-feel decision

The roller gets their result immediately; everyone else waits for the roller's `roll_done` ack (capped at 2.0 s). This is one of the best design decisions in the game, and I don't think it's framed that way anywhere in the docs:

- **Narrative coherence over truth.** Opponents never see your dice change before "your dice landed" — the mini-cards update as a coherent beat rather than teleporting. Humans read rhythm, not timestamps.
- **Everyone races a ~1–2 s stale view — and that's good.** Near the end of a round, an opponent at 9/10 on your screen may already have won on the server. The atomic `try_finish_round` CAS keeps the outcome honest, and the loser path (`pendingWinIsLoser` in `tryReveal`) means "they beat me mid-roll" lands as a dramatic gut-punch rather than a desync. The staleness *creates* photo-finish moments.
- The 2 s cap bounds staleness to about one roll cycle, and each roller has an independent ack event, so a slow client degrades only its own broadcast latency, never others' ability to roll.

## Catch-up mechanics: there are none

- `advance_round` → `deal_round` gives everyone 10 fresh dice; the previous winner gets nothing but a `wins` increment. **No snowball** — every round is memoryless, the classic party-game virtue.
- But also **no arc**: there's no win condition at all — `wins` accrues until the host taps End Game (added in 1.14.0). The game has round-level tension and zero match-level tension. Nothing changes when someone is at 5 wins vs 0.
- **Target cycling 1→2→…→6 is strategically inert.** Every face has identical odds, so `next_target` is pure theming — a nice readability rotation on the pips, no decisions.

## Player-count dynamics

Winner's roll count = E[min of N copies of R]:

| players | E[winner rolls] | approx round @1.4 s/roll |
|---|---|---|
| 1 | 16.6 | ~23 s |
| 2 | 12.9 | ~18 s |
| 3 | 11.4 | ~16 s |
| 5 | 10.0 | ~14 s |
| 8 | 8.9 | ~12 s |
| 20 (max) | 7.4 | ~10 s |

More players = shorter, sharper rounds (order statistics compress the finish), but win share is 1/N: at 20 players you win ~5% of rounds — a median drought of ~13 rounds between personal wins, with no consolation mechanic. The sweet spot is clearly 3–6. Big lobbies also make "I was at 7/10 when it ended" the norm — most players never reach the fun last-die grind.

**drand has zero pacing impact** — `generate_dice` reads the cached beacon synchronously; multiple rolls in one beacon window still get independent values because `roll_count` is in the HMAC message. Odds impact is a negligible ~0.006% per-die bias from two-byte mod 6. One subtlety worth remembering: dice are *predetermined* the moment the beacon caches — irrelevant today because auto-lock leaves no decision to exploit, but if any future feature adds player choice (e.g. target picking), choose-then-roll ordering must be enforced server-side.

## Five concrete ideas

1. **Close the pacing-fairness gap** *(small — `server/config.py`, `static/js/animations.js`)*. Raise `MIN_ROLL_INTERVAL` to ~1.0 s so the server, not the animation, is the effective rate limiter; give the reduced-motion path a matching minimum cycle (a plain `setTimeout` floor in `startShake`). Kills both the reduced-motion exploit and most of the stripped-client advantage, barely touches honest-client feel.

2. **First-to-N match structure** *(small/medium — `server/ws.py` win path, `overlays.js`; reuses the existing `game_ended` frame)*. After `incr_wins`, if `wins == WINS_TO_WIN` (host-configurable, default 5) broadcast the existing end-game stats frame instead of advancing. Adds the match arc the game lacks; the final-scoreboard UI already exists.

3. **"Last-die mercy" — the lone die also locks on target±1** *(small — `apply_roll`, one client line)*. 91.5% of rounds end in a lone-die phase averaging 6 rolls; tripling the lone die's hit rate to 1/2 cuts that to ~2 and trims ~25% off the round's dullest stretch while keeping the coin-flip finish. The verify endpoint is unaffected — dice values are unchanged, only the lock rule branches on `unlocked == 1`.

4. **Deficit handicap for the next round** *(medium — `advance_round` Lua, `state_msg`, `renderMyArea`)*. Players start the next round with `floor((10 − locked_at_round_end)/3)` dice pre-locked (winner always 0, cap 2). A player buried at 3/10 starts ~2–3 rolls ahead next round — a gentle rubber band with no snowball risk since it keys off the previous round only.

5. **Streak beat: 3+ locks in one roll grants an instant re-roll** *(small — client-side; server already returns `newly_locked`)*. Fires on 22.5% of full-board rolls, so it's frequent early and rare late — amplifying the existing "fast start, grinding finish" curve with a celebration beat. Implement as skipping the shake, so it stays pace-neutral against idea 1's server floor.

One deliberate non-suggestion: letting the round winner pick the next target adds a decision with zero strategic content (all faces are equal odds). If you want agency there, it needs asymmetric odds — a "wild" face — to be a real choice rather than theater.
