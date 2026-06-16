"""Invariants for the game-audit engine (server/audit.py).

Builds synthetic event logs — one perfectly rule-abiding game and several with a
single deliberate tampering — and asserts the audit PASSes the clean game and
raises the right ERROR on each tamper. DB-free: exercises the pure engine only
(the HTTP route and CLI just load events and call into it).

Run:  python tests/audit_test.py
"""
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from server import audit as A  # noqa: E402

_passed = 0
_failed = 0


def check(cond, label):
    global _passed, _failed
    if cond:
        _passed += 1
        print(f"  ✓ {label}")
    else:
        _failed += 1
        print(f"  ✗ {label}")


def gen_game(seed, tamper=None, players=("alice", "bob"), rounds=3):
    """Generate a rule-correct event log; `tamper(seq, uid, payload)` may mutate
    a roll's payload in place to inject a single defect."""
    rng = random.Random(seed)
    events = []
    ts = [1_000_000.0]

    def now():
        ts[0] += 300 + rng.random() * 200
        return ts[0]

    target = 1
    for rnd in range(1, rounds + 1):
        dice = {u: [rng.randint(1, 6) for _ in range(10)] for u in players}
        locked = {u: [False] * 10 for u in players}
        seq = 0
        rollnum = {u: 0 for u in players}
        last = {u: None for u in players}
        winner = None
        while winner is None:
            for u in players:
                if sum(locked[u]) == 10:
                    continue
                db = list(dice[u])
                lb = list(locked[u])
                rolled = []
                for i in range(10):
                    if not lb[i]:
                        dice[u][i] = rng.randint(1, 6)
                        rolled.append(dice[u][i])
                newly = [i for i in range(10) if dice[u][i] == target and not locked[u][i]]
                for i in newly:
                    locked[u][i] = True
                seq += 1
                rollnum[u] += 1
                t = now()
                dt = (t - last[u]) if last[u] else None
                last[u] = t
                matched = sum(locked[u])
                pay = {
                    "target": target, "matched": matched, "dt_ms": dt,
                    "round_roll_num": rollnum[u], "newly_locked": newly,
                    "rolled_values": rolled, "dice_before": db,
                    "dice_after": list(dice[u]), "locked_before": lb,
                    "locked_after": list(locked[u]), "name": u.title(),
                }
                if tamper:
                    tamper(seq, u, pay)
                events.append({
                    "ts_ms": t, "round_num": rnd, "user_id": "uid-" + u,
                    "session_id": u, "type": "roll", "seq": seq, "payload": pay,
                })
                if matched == 10:
                    winner = u
                    events.append({
                        "ts_ms": now(), "round_num": rnd, "user_id": "uid-" + u,
                        "session_id": u, "type": "round_won", "seq": None,
                        "payload": {"target": target, "roll_count": rollnum[u],
                                    "duration_ms": 5000, "name": u.title()},
                    })
                    break
        target = target % 6 + 1
    return events


def has_error(rep, check_name):
    return any(f.level == A.ERROR and f.check == check_name for f in rep.findings)


# ── Stats sanity: p-values exact against textbook critical values ──────────
print("statistics")
check(abs(A.chi_square_p(11.0705, 5) - 0.05) < 1e-3, "chi-square p(11.07, dof5) ≈ 0.05")
check(abs(A.chi_square_p(15.0863, 5) - 0.01) < 1e-3, "chi-square p(15.09, dof5) ≈ 0.01")
check(abs(A.normal_sf(1.96) - 0.05) < 1e-3, "normal two-sided sf(1.96) ≈ 0.05")
check(A.chi_square_uniform([100] * 6).p > 0.999, "uniform sample → p ≈ 1")
check(A.chi_square_uniform([200, 80, 80, 80, 80, 80]).p < 1e-6, "skewed sample → tiny p")

# ── A clean game passes cleanly ────────────────────────────────────────────
print("clean game")
clean = A.audit("CLEAN", gen_game(42))
check(clean.passed, "clean game PASSes")
check(clean.errors == 0 and clean.warnings == 0, "clean game has no errors/warnings")
check("fairness" in clean.summary, "fairness stats present in summary")
check(clean.summary["rounds_won"] == 3, "3 rounds recorded as won")

# ── Tamper: a locked die secretly changes value ────────────────────────────
print("tamper: locked-die mutation")


def t_lockmut(seq, u, pay):
    if u == "alice" and any(pay["locked_before"]):
        i = pay["locked_before"].index(True)
        pay["dice_after"][i] = pay["dice_after"][i] % 6 + 1


rep = A.audit("T", gen_game(42, t_lockmut))
check(not rep.passed, "locked-die mutation FAILs")
check(has_error(rep, "mechanics.locked-immutable"), "→ flags mechanics.locked-immutable")

# ── Tamper: a roll faster than the 250 ms rate limit ───────────────────────
print("tamper: superhuman timing")


def t_fast(seq, u, pay):
    if pay["dt_ms"] is not None and seq % 6 == 0:
        pay["dt_ms"] = 30.0


rep = A.audit("T", gen_game(42, t_fast))
check(not rep.passed, "sub-250ms roll FAILs")
check(has_error(rep, "timing.rate-limit"), "→ flags timing.rate-limit")

# ── Tamper: dice biased toward the target (favouring one player) ───────────
print("tamper: target-biased dice")


def t_bias(seq, u, pay):
    if u == "bob":
        for i in range(10):
            if not pay["locked_before"][i] and random.Random(seq * 9 + i).random() < 0.45:
                pay["dice_after"][i] = pay["target"]
        pay["rolled_values"] = [pay["dice_after"][i] for i in range(10)
                                if not pay["locked_before"][i]]
        la = list(pay["locked_before"])
        newly = [i for i in range(10) if pay["dice_after"][i] == pay["target"] and not la[i]]
        for i in newly:
            la[i] = True
        pay["locked_after"] = la
        pay["newly_locked"] = newly
        pay["matched"] = sum(la)


rep = A.audit("T", gen_game(42, t_bias))
# Biasing dice_after without re-deriving the next roll's dice_before breaks the
# per-player chain — and skews the fairness test.
check(not rep.passed, "target-biased dice FAILs")
check(has_error(rep, "continuity.chain"), "→ flags continuity.chain")
check(any(f.level == A.WARN and f.check.startswith("fairness") for f in rep.findings),
      "→ raises a fairness WARN")

# ── Tamper: matched count doesn't match the locked dice ────────────────────
print("tamper: inflated matched count")


def t_matched(seq, u, pay):
    if seq == 2:
        pay["matched"] = 10  # claim a win that the dice don't support


rep = A.audit("T", gen_game(42, t_matched))
check(has_error(rep, "mechanics.matched-count"), "inflated matched flags mechanics.matched-count")

# ── Redaction: report_to_dict trims raw player IDs ─────────────────────────
print("redaction")
d = A.report_to_dict(clean, redact_ids=True)
check(all(len(p) <= 8 for p in d["summary"]["players"]), "report_to_dict redacts player IDs to ≤8 chars")
A.redact_report(clean)
check(all(len(p) <= 8 for p in clean.summary["players"]), "redact_report trims summary IDs in place")

# ── Empty game ─────────────────────────────────────────────────────────────
print("empty game")
empty = A.audit("NONE", [])
check(not empty.passed and has_error(empty, "data"), "no events → ERROR data, FAIL")

print(f"\n{_passed} passed, {_failed} failed")
sys.exit(1 if _failed else 0)
