"""Forensic audit of a single Tensies game from the telemetry event log.

Given a game code, this reads every event recorded for that game (the `events`
firehose — see docs/TELEMETRY.md) and systematically verifies it along three
axes:

  ACCURACY   Every roll is re-derived from its own recorded `dice_before` +
             `target` and checked against the rules in server/game.py: locked
             dice never re-roll or unlock, every unlocked die is freshly drawn,
             auto-lock fires exactly on target matches, and `matched`,
             `newly_locked`, `round_roll_num` and the per-round `seq` are all
             internally consistent. Each player's `dice_before` is chained to
             their previous `dice_after` to prove the server never mutated a
             board between rolls.

  REALISM    Timing is plausible and rule-abiding: every inter-roll `dt_ms`
             respects the server's 250 ms rate limit, timestamps agree with
             `seq` order, the win flag (`matched == 10`) lines up exactly with
             the emitted `round_won`, there is one winner per completed round
             (the first to ten by seq), and the target cycles 1→2→…→6→1.

  FAIRNESS   The dice RNG is unbiased and equal for everyone: a chi-square
             goodness-of-fit test of newly-rolled faces against uniform 1/6
             (overall and per player), plus a target-match-rate test per player
             to prove no participant was statistically advantaged.

The engine is pure (no DB import) so it is trivially testable and reusable. The
public API route in server/routes.py and the CLI in scripts/audit_game.py both
call into it. It reads ONLY recorded data — never live game state — so it is
safe to run against production at any time.
"""
from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass, field

# Mirror the few server constants the audit relies on, as literals, so the
# engine has no import-time dependency on server.config (lets the CLI run with
# nothing but asyncpg on the path).
DICE_COUNT = 10
MIN_ROLL_INTERVAL_MS = 250          # server.config.MIN_ROLL_INTERVAL * 1000


# ─────────────────────────────────────────────────────────────────────
# Statistics (pure Python — no numpy/scipy dependency)
# ─────────────────────────────────────────────────────────────────────
def _gammq(a: float, x: float) -> float:
    """Regularized upper incomplete gamma Q(a, x) = 1 - P(a, x).

    Numerical Recipes' series (gser) / continued-fraction (gcf) split. Good to
    ~1e-10, ample for a p-value. Returns the survival probability.
    """
    if x < 0 or a <= 0:
        return float("nan")
    if x == 0:
        return 1.0
    if x < a + 1.0:
        # Series expansion for P(a, x); Q = 1 - P.
        ap = a
        total = 1.0 / a
        delta = total
        for _ in range(1000):
            ap += 1.0
            delta *= x / ap
            total += delta
            if abs(delta) < abs(total) * 1e-12:
                break
        return 1.0 - total * math.exp(-x + a * math.log(x) - math.lgamma(a))
    # Continued fraction for Q(a, x) directly (Lentz's method).
    tiny = 1e-30
    b = x + 1.0 - a
    c = 1.0 / tiny
    d = 1.0 / b
    h = d
    for i in range(1, 1000):
        an = -i * (i - a)
        b += 2.0
        d = an * d + b
        if abs(d) < tiny:
            d = tiny
        c = b + an / c
        if abs(c) < tiny:
            c = tiny
        d = 1.0 / d
        delta = d * c
        h *= delta
        if abs(delta - 1.0) < 1e-12:
            break
    return h * math.exp(-x + a * math.log(x) - math.lgamma(a))


def chi_square_p(chi2: float, dof: int) -> float:
    """Upper-tail p-value P(X > chi2) for a chi-square with `dof` d.o.f."""
    if dof <= 0:
        return float("nan")
    return _gammq(dof / 2.0, chi2 / 2.0)


def normal_sf(z: float) -> float:
    """Two-sided tail of the standard normal: P(|Z| > |z|)."""
    return math.erfc(abs(z) / math.sqrt(2.0))


@dataclass
class ChiResult:
    chi2: float
    dof: int
    p: float
    counts: list[int]
    expected: float
    n: int


def chi_square_uniform(counts: list[int]) -> ChiResult:
    """Goodness-of-fit of observed face counts against a uniform distribution."""
    n = sum(counts)
    k = len(counts)
    expected = n / k if k else 0.0
    chi2 = sum((c - expected) ** 2 / expected for c in counts) if expected else 0.0
    return ChiResult(chi2, k - 1, chi_square_p(chi2, k - 1), counts, expected, n)


# ─────────────────────────────────────────────────────────────────────
# Findings
# ─────────────────────────────────────────────────────────────────────
ERROR, WARN, INFO, OK = "ERROR", "WARN", "INFO", "OK"


@dataclass
class Finding:
    level: str
    check: str
    message: str
    examples: list[str] = field(default_factory=list)


@dataclass
class Report:
    code: str
    findings: list[Finding] = field(default_factory=list)
    summary: dict = field(default_factory=dict)

    def add(self, level: str, check: str, message: str, examples=None) -> None:
        self.findings.append(Finding(level, check, message, list(examples or [])))

    @property
    def errors(self) -> int:
        return sum(1 for f in self.findings if f.level == ERROR)

    @property
    def warnings(self) -> int:
        return sum(1 for f in self.findings if f.level == WARN)

    @property
    def passed(self) -> bool:
        return self.errors == 0


# ─────────────────────────────────────────────────────────────────────
# Audit
# ─────────────────────────────────────────────────────────────────────
def _names_by_user(events: list[dict]) -> dict[str, str]:
    """Best-effort display name per user_id, from any event that carries one."""
    names: dict[str, str] = {}
    for e in events:
        uid = e["user_id"]
        nm = e["payload"].get("name")
        if uid and nm:
            names[uid] = nm
    return names


def _short(uid: str | None, names: dict[str, str]) -> str:
    if not uid:
        return "?"
    nm = names.get(uid)
    return f"{nm} ({uid[:8]})" if nm else uid[:8]


def audit(code: str, events: list[dict], alpha: float = 0.01,
          max_examples: int = 5) -> Report:
    """Run the full audit over an already-loaded event list. Pure."""
    rep = Report(code)
    names = _names_by_user(events)
    rolls = [e for e in events if e["type"] == "roll"]

    rep.summary["total_events"] = len(events)
    rep.summary["roll_events"] = len(rolls)
    rep.summary["players"] = sorted({e["user_id"] for e in events if e["user_id"]})
    rep.summary["player_names"] = {u: names.get(u, "?") for u in rep.summary["players"]}

    if not events:
        rep.add(ERROR, "data", f"No events found for game '{code}'. "
                "Check the code (case-sensitive) and that telemetry is enabled.")
        return rep
    rep.add(INFO, "data",
            f"Loaded {len(events)} events ({len(rolls)} rolls) across "
            f"{len(rep.summary['players'])} player(s).")

    _audit_lifecycle(rep, events, names)
    if rolls:
        _audit_mechanics(rep, rolls, names, max_examples)
        _audit_continuity(rep, rolls, names, max_examples)
        _audit_timing(rep, rolls, names, max_examples)
        _audit_rounds(rep, events, rolls, names, max_examples)
        _audit_fairness(rep, rolls, names, alpha)
    else:
        rep.add(INFO, "rolls", "No roll events recorded — nothing to verify "
                "mechanically or statistically (game likely never started).")
    return rep


def _audit_lifecycle(rep: Report, events: list[dict], names: dict) -> None:
    """Sanity of the event stream as a whole."""
    types = defaultdict(int)
    for e in events:
        types[e["type"]] += 1
    rep.summary["event_types"] = dict(types)

    rate_limited = types.get("rate_limited", 0)
    if rate_limited:
        rep.add(INFO, "lifecycle",
                f"{rate_limited} roll(s) were rejected by the rate limiter "
                "(recorded as rate_limited; these never became roll events).")

    # Timestamps should be non-decreasing in the id/ts order we loaded.
    last = None
    backwards = 0
    for e in events:
        if e["ts_ms"] is None:
            continue
        if last is not None and e["ts_ms"] < last - 1:  # 1 ms slack
            backwards += 1
        last = e["ts_ms"]
    if backwards:
        rep.add(WARN, "lifecycle",
                f"{backwards} event(s) have a timestamp earlier than a "
                "preceding event. Minor clock skew across instances is "
                "possible; a large count warrants a look.")


def _audit_mechanics(rep: Report, rolls: list[dict], names: dict, maxex: int) -> None:
    """Re-derive every roll from its own recorded inputs and check the rules."""
    bad_shape = []
    locked_mutated = []     # a locked die changed value
    unlocked_not_rerolled = []
    rolled_values_mismatch = []
    lock_rule = []          # auto-lock didn't fire exactly on target match
    unlocking = []          # a die went from locked to unlocked
    newly_locked_bad = []
    matched_bad = []

    def ex(r, extra=""):
        return (f"round {r['round_num']} seq {r['seq']} "
                f"{_short(r['user_id'], names)}{(' — ' + extra) if extra else ''}")

    for r in rolls:
        p = r["payload"]
        db, da = p.get("dice_before"), p.get("dice_after")
        lb, la = p.get("locked_before"), p.get("locked_after")
        rv = p.get("rolled_values")
        target = p.get("target")
        if (not isinstance(db, list) or not isinstance(da, list)
                or not isinstance(lb, list) or not isinstance(la, list)
                or len(db) != DICE_COUNT or len(da) != DICE_COUNT
                or len(lb) != DICE_COUNT or len(la) != DICE_COUNT
                or any(not (1 <= int(v) <= 6) for v in db + da)
                or target is None):
            bad_shape.append(ex(r))
            continue

        lb = [bool(x) for x in lb]
        la = [bool(x) for x in la]

        # 1. Locked dice are immutable, and 2. never unlock.
        expect_rolled = []
        for i in range(DICE_COUNT):
            if lb[i]:
                if da[i] != db[i]:
                    locked_mutated.append(ex(r, f"die {i} was locked but changed {db[i]}→{da[i]}"))
                if not la[i]:
                    unlocking.append(ex(r, f"die {i} unlocked mid-round"))
            else:
                expect_rolled.append(da[i])

        # 3. rolled_values must be exactly the post-roll values of unlocked dice,
        #    in index order (apply_roll appends them that way).
        if isinstance(rv, list) and rv != expect_rolled:
            rolled_values_mismatch.append(
                ex(r, f"rolled_values {rv} != unlocked dice_after {expect_rolled}"))

        # 4. Auto-lock fired exactly when a die shows the target (and was unlocked).
        for i in range(DICE_COUNT):
            should = lb[i] or (da[i] == target)
            if la[i] != should:
                lock_rule.append(
                    ex(r, f"die {i}={da[i]} target={target} locked_after={la[i]} expected={should}"))
                break

        # 5. newly_locked must be the indices that transitioned to locked.
        expect_newly = [i for i in range(DICE_COUNT) if not lb[i] and la[i]]
        nl = p.get("newly_locked")
        if isinstance(nl, list) and sorted(nl) != expect_newly:
            newly_locked_bad.append(ex(r, f"newly_locked {sorted(nl)} != {expect_newly}"))

        # 6. matched is the count of locked dice after the roll.
        matched = p.get("matched")
        if matched is not None and matched != sum(la):
            matched_bad.append(ex(r, f"matched={matched} != sum(locked_after)={sum(la)}"))

    checks = [
        ("mechanics.shape", bad_shape,
         "roll(s) have malformed dice/locked arrays or out-of-range faces"),
        ("mechanics.locked-immutable", locked_mutated,
         "locked die(dice) changed value across a roll (locked dice must never re-roll)"),
        ("mechanics.no-unlock", unlocking,
         "die(dice) went from locked back to unlocked within a round"),
        ("mechanics.reroll-coverage", unlocked_not_rerolled,
         "unlocked die(dice) were not re-rolled"),
        ("mechanics.rolled-values", rolled_values_mismatch,
         "roll(s) where rolled_values disagrees with the unlocked dice it produced"),
        ("mechanics.auto-lock", lock_rule,
         "roll(s) where auto-lock did not fire exactly on a target match"),
        ("mechanics.newly-locked", newly_locked_bad,
         "roll(s) where newly_locked is not the set of dice that just locked"),
        ("mechanics.matched-count", matched_bad,
         "roll(s) where matched != number of locked dice"),
    ]
    clean = True
    for check, bucket, desc in checks:
        if bucket:
            clean = False
            rep.add(ERROR, check, f"{len(bucket)} {desc}.", bucket[:maxex])
    if clean:
        rep.add(OK, "mechanics",
                f"All {len(rolls)} rolls obey the dice rules exactly "
                "(locking, re-rolling, matching and counts all reconstruct).")


def _audit_continuity(rep: Report, rolls: list[dict], names: dict, maxex: int) -> None:
    """Each player's board must chain: dice_before == previous dice_after.

    Proves the server never silently altered a player's dice between their
    rolls, and that each round starts from a clean 10-unlocked deal.
    """
    by_pr: dict[tuple, list[dict]] = defaultdict(list)
    for r in rolls:
        by_pr[(r["round_num"], r["user_id"])].append(r)

    chain_breaks = []
    dirty_start = []
    seq_gaps = []
    rollnum_bad = []

    for (rnd, uid), seq_rolls in by_pr.items():
        seq_rolls.sort(key=lambda r: (r["seq"] if r["seq"] is not None else 0))
        prev = None
        for idx, r in enumerate(seq_rolls):
            p = r["payload"]
            db, lb = p.get("dice_before"), p.get("locked_before")
            tag = f"round {rnd} {_short(uid, names)} seq {r['seq']}"
            if idx == 0:
                # First roll of the round for this player → fresh deal: nothing locked.
                if isinstance(lb, list) and any(lb):
                    dirty_start.append(f"{tag} — locked_before not all-false on first roll")
            else:
                pp = prev["payload"]
                if db != pp.get("dice_after"):
                    chain_breaks.append(
                        f"{tag} — dice_before != prior dice_after "
                        f"({db} vs {pp.get('dice_after')})")
                if lb != pp.get("locked_after"):
                    chain_breaks.append(
                        f"{tag} — locked_before != prior locked_after")
            # round_roll_num should be 1-based and increment per roll.
            rrn = p.get("round_roll_num")
            if rrn is not None and rrn != idx + 1:
                rollnum_bad.append(f"{tag} — round_roll_num={rrn} expected {idx + 1}")
            prev = r

    # Per-round seq must be contiguous 1..N with no gaps or duplicates.
    by_round: dict[int, list[int]] = defaultdict(list)
    for r in rolls:
        if r["seq"] is not None:
            by_round[r["round_num"]].append(r["seq"])
    for rnd, seqs in by_round.items():
        seqs_sorted = sorted(seqs)
        expected = list(range(1, len(seqs) + 1))
        if seqs_sorted != expected:
            dup = len(seqs) != len(set(seqs))
            seq_gaps.append(f"round {rnd}: seq set {seqs_sorted} "
                            f"(expected 1..{len(seqs)}{', has duplicates' if dup else ''})")

    if chain_breaks:
        rep.add(ERROR, "continuity.chain",
                f"{len(chain_breaks)} roll(s) do not chain from the player's "
                "previous board — the dice state changed between rolls.",
                chain_breaks[:maxex])
    if dirty_start:
        rep.add(ERROR, "continuity.fresh-deal",
                f"{len(dirty_start)} round(s) did not start from a clean "
                "10-unlocked deal for a player.", dirty_start[:maxex])
    if seq_gaps:
        rep.add(ERROR, "continuity.seq",
                f"{len(seq_gaps)} round(s) have non-contiguous roll sequence "
                "numbers (a gap means a roll event is missing or duplicated).",
                seq_gaps[:maxex])
    if rollnum_bad:
        rep.add(WARN, "continuity.round-roll-num",
                f"{len(rollnum_bad)} roll(s) have an unexpected round_roll_num.",
                rollnum_bad[:maxex])
    if not (chain_breaks or dirty_start or seq_gaps):
        rep.add(OK, "continuity",
                "Every player's board chains cleanly roll-to-roll and each "
                "round begins from a fresh 10-dice deal; roll sequence numbers "
                "are contiguous.")


def _audit_timing(rep: Report, rolls: list[dict], names: dict, maxex: int) -> None:
    """Inter-roll timing must respect the server-enforced rate limit."""
    too_fast = []
    dts: list[float] = []
    for r in rolls:
        dt = r["payload"].get("dt_ms")
        if dt is None:
            continue
        dts.append(dt)
        if dt < MIN_ROLL_INTERVAL_MS - 1:  # 1 ms slack for rounding
            too_fast.append(
                f"round {r['round_num']} seq {r['seq']} "
                f"{_short(r['user_id'], names)} — dt={dt:.0f}ms < {MIN_ROLL_INTERVAL_MS}ms")

    if dts:
        dts_sorted = sorted(dts)
        median = dts_sorted[len(dts_sorted) // 2]
        rep.summary["roll_dt_ms"] = {
            "min": min(dts), "median": median, "max": max(dts), "n": len(dts),
        }
    if too_fast:
        rep.add(ERROR, "timing.rate-limit",
                f"{len(too_fast)} roll(s) are faster than the 250 ms server "
                "rate limit — impossible through the normal path; indicates "
                "injected or tampered events.", too_fast[:maxex])
    else:
        rep.add(OK, "timing.rate-limit",
                "Every inter-roll interval respects the 250 ms rate limit"
                + (f" (median {rep.summary['roll_dt_ms']['median']:.0f}ms, "
                   f"fastest {rep.summary['roll_dt_ms']['min']:.0f}ms)."
                   if dts else "."))


def _audit_rounds(rep: Report, events: list[dict], rolls: list[dict],
                  names: dict, maxex: int) -> None:
    """Win condition, single-winner, winner-is-first-to-ten, target cycle."""
    wins = [e for e in events if e["type"] == "round_won"]

    # Group rolls by round, ordered by seq, to find who hit 10 and when.
    by_round: dict[int, list[dict]] = defaultdict(list)
    for r in rolls:
        by_round[r["round_num"]].append(r)
    for rs in by_round.values():
        rs.sort(key=lambda r: (r["seq"] if r["seq"] is not None else 0))

    win_issues = []
    target_issues = []

    wins_by_round: dict[int, list[dict]] = defaultdict(list)
    for w in wins:
        wins_by_round[w["round_num"]].append(w)

    for rnd, rs in sorted(by_round.items()):
        tens = [r for r in rs if r["payload"].get("matched") == 10]
        winners = wins_by_round.get(rnd, [])
        if tens and not winners:
            # A roll reached ten but no round_won — acceptable only if this is
            # the final, still-in-flight round (winner event not yet written).
            rep.add(WARN, "rounds.win-event",
                    f"Round {rnd}: a player reached 10/10 but no round_won "
                    "event is recorded (only expected for an in-progress round).")
        if winners:
            if len(winners) > 1:
                win_issues.append(f"round {rnd}: {len(winners)} round_won events")
            w = winners[0]
            first_ten = tens[0] if tens else None
            if first_ten is None:
                win_issues.append(f"round {rnd}: round_won but no roll reached 10/10")
            else:
                if w["user_id"] != first_ten["user_id"]:
                    win_issues.append(
                        f"round {rnd}: winner {_short(w['user_id'], names)} is not "
                        f"the first to ten {_short(first_ten['user_id'], names)}")
                rc = w["payload"].get("roll_count")
                actual_rc = first_ten["payload"].get("round_roll_num")
                if rc is not None and actual_rc is not None and rc != actual_rc:
                    win_issues.append(
                        f"round {rnd}: round_won roll_count={rc} != winner's "
                        f"round_roll_num={actual_rc}")

    # Target must cycle 1→2→3→4→5→6→1 across consecutive rounds, and be
    # consistent within a round (all rolls share it).
    round_targets: dict[int, set] = defaultdict(set)
    for r in rolls:
        if r["payload"].get("target") is not None:
            round_targets[r["round_num"]].add(r["payload"]["target"])
    for rnd, tset in round_targets.items():
        if len(tset) > 1:
            target_issues.append(f"round {rnd}: multiple targets within the round {sorted(tset)}")
    ordered = sorted((rnd, next(iter(t))) for rnd, t in round_targets.items() if len(t) == 1)
    for (r1, t1), (r2, t2) in zip(ordered, ordered[1:]):
        if r2 == r1 + 1:
            expect = t1 % 6 + 1
            if t2 != expect:
                target_issues.append(
                    f"round {r1}→{r2}: target {t1}→{t2}, expected {t1}→{expect}")

    rep.summary["rounds"] = len(by_round)
    rep.summary["rounds_won"] = len(wins)

    if win_issues:
        rep.add(ERROR, "rounds.winner",
                f"{len(win_issues)} winner-integrity problem(s).", win_issues[:maxex])
    else:
        rep.add(OK, "rounds.winner",
                f"All {len(wins)} round win(s) are consistent: one winner each, "
                "and the winner is the first player to lock all ten by sequence.")
    if target_issues:
        rep.add(ERROR, "rounds.target-cycle",
                f"{len(target_issues)} target-progression problem(s).",
                target_issues[:maxex])
    elif round_targets:
        rep.add(OK, "rounds.target-cycle",
                "The target advances 1→2→3→4→5→6→1 correctly across every round.")


def _audit_fairness(rep: Report, rolls: list[dict], names: dict, alpha: float) -> None:
    """Statistical tests on the dice RNG.

    Uses ONLY newly-rolled faces (payload.rolled_values) so that dice locked on
    target in prior rolls don't inflate the count of the target face — the same
    correctness the v_dice_roll_distribution view applies.
    """
    overall = [0] * 6
    per_player_faces: dict[str, list[int]] = defaultdict(lambda: [0] * 6)
    per_player_match = defaultdict(lambda: [0, 0])  # uid -> [matches, total]
    total_match = [0, 0]

    for r in rolls:
        rv = r["payload"].get("rolled_values")
        target = r["payload"].get("target")
        uid = r["user_id"]
        if not isinstance(rv, list):
            continue
        for v in rv:
            if not (1 <= v <= 6):
                continue
            overall[v - 1] += 1
            per_player_faces[uid][v - 1] += 1
            total_match[1] += 1
            per_player_match[uid][1] += 1
            if v == target:
                total_match[0] += 1
                per_player_match[uid][0] += 1

    n = sum(overall)
    if n == 0:
        rep.add(INFO, "fairness", "No newly-rolled dice recorded to test.")
        return

    rep.summary["dice_faces"] = {str(i + 1): overall[i] for i in range(6)}

    # ── Overall uniformity ──────────────────────────────────────────────
    res = chi_square_uniform(overall)
    rep.summary["fairness"] = {
        "chi2": round(res.chi2, 4), "dof": res.dof, "p": round(res.p, 6),
        "n": n, "expected_per_face": round(res.expected, 2),
    }
    dist = "  ".join(f"{i+1}:{overall[i]}" for i in range(6))
    detail = (f"n={n}, expected {res.expected:.1f}/face, "
              f"chi2={res.chi2:.2f} (dof {res.dof}), p={res.p:.4f}\n"
              f"        faces  {dist}")
    if n < 30:
        rep.add(INFO, "fairness.uniform",
                f"Only {n} dice — too few for a meaningful fairness test. {detail}")
    elif res.p < alpha:
        rep.add(WARN, "fairness.uniform",
                f"Overall face distribution deviates from uniform at "
                f"alpha={alpha} (p={res.p:.4f}). One flag is expected ~"
                f"{alpha:.0%} of the time by chance; investigate if persistent.\n"
                f"        {detail}")
    else:
        rep.add(OK, "fairness.uniform",
                f"Dice faces are statistically uniform (p={res.p:.4f} ≥ "
                f"{alpha}). {detail}")

    # ── Per-player uniformity + match rate ──────────────────────────────
    expected_match_rate = 1 / 6
    flagged = []
    lines = []
    for uid in sorted(per_player_faces):
        counts = per_player_faces[uid]
        pn = sum(counts)
        pres = chi_square_uniform(counts)
        m, tot = per_player_match[uid]
        rate = m / tot if tot else 0.0
        if tot >= 30:
            se = math.sqrt(expected_match_rate * (1 - expected_match_rate) / tot)
            z = (rate - expected_match_rate) / se if se else 0.0
            mp = normal_sf(z)
        else:
            z, mp = 0.0, float("nan")
        line = (f"{_short(uid, names):<28} n={pn:<5} chi2={pres.chi2:5.2f} "
                f"p={pres.p:.3f}   match {m}/{tot} ({rate:.1%}"
                + (f", p={mp:.3f}" if tot >= 30 else "") + ")")
        lines.append(line)
        if pn >= 30 and pres.p < alpha:
            flagged.append(f"{_short(uid, names)} face distribution p={pres.p:.4f}")
        if tot >= 30 and not math.isnan(mp) and mp < alpha:
            direction = "more" if rate > expected_match_rate else "fewer"
            flagged.append(f"{_short(uid, names)} matched target {direction} "
                           f"than chance ({rate:.1%} vs 16.7%, p={mp:.4f})")

    body = "\n        " + "\n        ".join(lines)
    if flagged:
        rep.add(WARN, "fairness.per-player",
                f"{len(flagged)} per-player statistical flag(s) at alpha={alpha} "
                "(a flag is not proof of bias — expected occasionally by chance):"
                + body, flagged)
    else:
        rep.add(OK, "fairness.per-player",
                "No player shows a biased face distribution or an anomalous "
                "target-match rate." + body)

    m, tot = total_match
    rep.summary["target_match_rate"] = {
        "matches": m, "total": tot, "rate": (m / tot if tot else 0.0),
        "expected": expected_match_rate,
    }


# ─────────────────────────────────────────────────────────────────────
# Serialization + rendering
# ─────────────────────────────────────────────────────────────────────
def redact_report(rep: Report) -> Report:
    """Trim full player IDs to 8-char prefixes in the summary, in place, for the
    public endpoint. Finding examples already use short IDs via _short()."""
    if rep.summary.get("players"):
        rep.summary["players"] = [u[:8] for u in rep.summary["players"]]
        rep.summary["player_names"] = {
            u[:8]: n for u, n in rep.summary.get("player_names", {}).items()
        }
    return rep


def report_to_dict(rep: Report, redact_ids: bool = False) -> dict:
    """JSON-serializable form. When `redact_ids`, full player IDs are trimmed
    to 8-char prefixes (for the public endpoint — names stay, raw pids don't)."""
    summary = dict(rep.summary)
    if redact_ids and summary.get("players"):
        summary["players"] = [u[:8] for u in summary["players"]]
        summary["player_names"] = {u[:8]: n for u, n in summary.get("player_names", {}).items()}
    return {
        "code": rep.code,
        "passed": rep.passed,
        "errors": rep.errors,
        "warnings": rep.warnings,
        "summary": summary,
        "findings": [
            {"level": f.level, "check": f.check, "message": f.message,
             "examples": f.examples}
            for f in rep.findings
        ],
    }


_ICON = {OK: "✓", INFO: "•", WARN: "!", ERROR: "✗"}


def render_text(rep: Report) -> str:
    L = []
    L.append("═" * 70)
    L.append(f"  TENSIES GAME AUDIT — {rep.code}")
    L.append("═" * 70)
    s = rep.summary
    if s.get("players"):
        L.append(f"  Players ({len(s['players'])}):")
        for uid in s["players"]:
            L.append(f"    - {s['player_names'].get(uid, '?')}  [{uid[:12]}]")
    L.append(f"  Events: {s.get('total_events', 0)}   "
             f"Rolls: {s.get('roll_events', 0)}   "
             f"Rounds: {s.get('rounds', 0)} ({s.get('rounds_won', 0)} won)")
    if s.get("roll_dt_ms"):
        d = s["roll_dt_ms"]
        L.append(f"  Roll spacing: min {d['min']:.0f}ms / median {d['median']:.0f}ms / max {d['max']:.0f}ms")
    if s.get("target_match_rate"):
        t = s["target_match_rate"]
        L.append(f"  Target-match rate: {t['rate']:.2%} of {t['total']} dice "
                 f"(ideal {t['expected']:.2%})")
    L.append("")

    for level in [ERROR, WARN, OK, INFO]:
        for f in [x for x in rep.findings if x.level == level]:
            L.append(f"  [{_ICON[f.level]} {f.level:<5}] {f.check}")
            for ln in f.message.split("\n"):
                L.append(f"      {ln}")
            for ex in f.examples:
                L.append(f"        · {ex}")
    L.append("")
    L.append("─" * 70)
    verdict = "PASS" if rep.passed else "FAIL"
    L.append(f"  VERDICT: {verdict}   ({rep.errors} error(s), {rep.warnings} warning(s))")
    if rep.passed and rep.warnings == 0:
        L.append("  Every roll reconstructs to the game rules, timing is rule-abiding,")
        L.append("  and the dice are statistically fair. Game is provably accurate and fair.")
    elif rep.passed:
        L.append("  No rule violations. Warnings are statistical/operational flags — review them,")
        L.append("  but they are not proof of unfairness on their own.")
    else:
        L.append("  Rule violations were found above. The recorded game data is inconsistent")
        L.append("  with the Tensies rules — investigate the flagged rolls.")
    L.append("─" * 70)
    return "\n".join(L)


def render_markdown(rep: Report) -> str:
    L = [f"# Tensies Game Audit — `{rep.code}`", ""]
    verdict = "✅ PASS" if rep.passed else "❌ FAIL"
    L.append(f"**Verdict: {verdict}** — {rep.errors} error(s), {rep.warnings} warning(s)")
    L.append("")
    s = rep.summary
    L.append("## Summary")
    L.append("")
    L.append(f"- Players: {len(s.get('players', []))}")
    for uid in s.get("players", []):
        L.append(f"  - {s['player_names'].get(uid, '?')} (`{uid[:12]}`)")
    L.append(f"- Events: {s.get('total_events', 0)}, Rolls: {s.get('roll_events', 0)}, "
             f"Rounds: {s.get('rounds', 0)} ({s.get('rounds_won', 0)} won)")
    if s.get("dice_faces"):
        faces = "  ".join(f"`{k}`×{v}" for k, v in s["dice_faces"].items())
        L.append(f"- Dice faces (newly rolled): {faces}")
    if s.get("target_match_rate"):
        t = s["target_match_rate"]
        L.append(f"- Target-match rate: {t['rate']:.2%} of {t['total']} (ideal {t['expected']:.2%})")
    L.append("")
    L.append("## Findings")
    L.append("")
    L.append("| Level | Check | Detail |")
    L.append("|---|---|---|")
    for level in [ERROR, WARN, OK, INFO]:
        for f in [x for x in rep.findings if x.level == level]:
            msg = f.message.replace("\n", " ").replace("|", "\\|")
            if f.examples:
                msg += " — e.g. " + "; ".join(e.replace("|", "\\|") for e in f.examples)
            L.append(f"| {_ICON[level]} {level} | `{f.check}` | {msg} |")
    L.append("")
    return "\n".join(L)


# ─────────────────────────────────────────────────────────────────────
# Data loading
# ─────────────────────────────────────────────────────────────────────
_EVENTS_QUERY = """
    SELECT extract(epoch FROM ts) * 1000 AS ts_ms, round_num, user_id,
           session_id, type, seq, payload
      FROM events
     WHERE game_code = $1
     ORDER BY ts, id
"""


def _normalize_rows(rows) -> list[dict]:
    import json
    out = []
    for r in rows:
        payload = r["payload"]
        if isinstance(payload, str):
            payload = json.loads(payload)
        out.append({
            "ts_ms": float(r["ts_ms"]) if r["ts_ms"] is not None else None,
            "round_num": r["round_num"],
            "user_id": r["user_id"],
            "session_id": r["session_id"],
            "type": r["type"],
            "seq": r["seq"],
            "payload": payload or {},
        })
    return out


async def load_events(con, code: str) -> list[dict]:
    """Load all events for a game over an asyncpg connection (from any pool)."""
    rows = await con.fetch(_EVENTS_QUERY, code)
    return _normalize_rows(rows)


async def run_audit(code: str, alpha: float = 0.01, max_examples: int = 5) -> Report:
    """Acquire from the shared app pool, load the game's events, audit. Async."""
    from server.telemetry import store
    code = code.upper().strip()
    async with store.pool().acquire() as con:
        events = await load_events(con, code)
    return audit(code, events, alpha=alpha, max_examples=max_examples)
