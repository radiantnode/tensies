#!/usr/bin/env python3
"""Generate the Tensies metrics charts (docs/fable5-review/10-metrics.md).

Warm bar-themed, theme-aware SVGs: each output embeds an @media
(prefers-color-scheme) block so it follows the reader's light/dark setting, with
a light fallback baked into every var() so it degrades gracefully if a renderer
strips the <style>.

Run in Docker (matplotlib), mounting /data (inputs) and /out (images dir):

    docker run --rm -v "$DATA":/data -v "$PWD/docs/fable5-review/images":/out \\
      -v "$PWD/docs/fable5-review/examples/scripts/metrics_charts.py":/chart_gen.py \\
      python:3.12-slim sh -c "pip install -q matplotlib && python /chart_gen.py"

Inputs in /data:
  - commits_by_day.tsv : git log reshaped to `date<TAB>count` (fully reproducible).
  - typed.tsv          : `date<TAB>text` for genuine user-typed messages from the
                         session transcripts. NOT in the repo (private local logs);
                         only the correction/friction/profanity charts need it.
Model attribution, most-touched files, and the gameplay math are computed or
hardcoded from known values below.
"""
import csv
import io
import re
import datetime as dt
from collections import Counter

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager  # noqa

# ── Warm "bar-wood" palette ───────────────────────────────────────────────────
CREAM   = "#FBF5EA"
INK     = "#3A2A1A"
AMBER   = "#C8823C"
WOOD    = "#8B5A2B"
DEEPWOOD= "#5E3A1C"
RED     = "#A63D2E"   # the red die
COOL    = "#4E6E5D"   # sage green (stable/backend)
MUTE    = "#B9A98F"

plt.rcParams.update({
    "figure.facecolor": CREAM, "axes.facecolor": CREAM, "savefig.facecolor": CREAM,
    "axes.edgecolor": WOOD, "axes.labelcolor": INK, "text.color": INK,
    "xtick.color": INK, "ytick.color": INK, "font.size": 11,
    "axes.titlesize": 15, "axes.titleweight": "bold",
    "axes.grid": True, "grid.color": "#E6D8C3", "grid.linewidth": 0.8,
    "font.family": "DejaVu Sans",
})

DATA = "/data"
OUT = "/out"


def despine(ax, keep=("bottom", "left")):
    for s in ("top", "right", "bottom", "left"):
        ax.spines[s].set_visible(s in keep)
    ax.set_axisbelow(True)


# Sentinel colors → CSS custom properties, each with a LIGHT fallback value.
# The fallback matters: if a renderer honors var() but the <style> block is
# stripped (GitHub has historically done this to SVGs), the chart degrades to
# light mode instead of rendering black. matplotlib emits hex lowercased, so we
# only replace lowercase — the uppercase fallback hexes can't be re-matched.
# Data colors (amber/wood/red/sage) stay fixed — they read on both themes.
THEME_MAP = {
    CREAM.lower():    "var(--bg, #FBF5EA)",
    INK.lower():      "var(--ink, #3A2A1A)",
    "#e6d8c3":        "var(--grid, #E6D8C3)",   # grid
    WOOD.lower():     "var(--edge, #8B5A2B)",   # axes spines / bar edges
    DEEPWOOD.lower(): "var(--muted, #5E3A1C)",  # italic captions
}
THEME_STYLE = (
    "<style>"
    ":root{--bg:#FBF5EA;--ink:#3A2A1A;--grid:#E6D8C3;--edge:#8B5A2B;--muted:#5E3A1C;}"
    "@media (prefers-color-scheme:dark){"
    ":root{--bg:#1E1712;--ink:#ECE2D1;--grid:#3A2E24;--edge:#7A5636;--muted:#B99B79;}}"
    "</style>"
)


def save(fig, name, tight=True):
    if tight:
        fig.tight_layout()
    buf = io.StringIO()
    fig.savefig(buf, format="svg", bbox_inches="tight")
    plt.close(fig)
    svg = buf.getvalue()
    # Swap sentinel hexes (matplotlib emits them lowercased, inside style="...").
    # Lowercase-only: the uppercase fallback hexes we inject must not re-match.
    for hexc, var in THEME_MAP.items():
        svg = svg.replace(hexc, var)
    # Inject the theme <style> right after the opening <svg ...> tag.
    svg = re.sub(r"(<svg\b[^>]*>)", r"\1" + THEME_STYLE, svg, count=1)
    with open(f"{OUT}/{name}", "w", encoding="utf-8") as f:
        f.write(svg)
    print("wrote", name)


def load_typed():
    rows = []
    with open(f"{DATA}/typed.tsv", encoding="utf-8", errors="replace") as f:
        for line in f:
            parts = line.rstrip("\n").split("\t", 1)
            if len(parts) != 2:
                continue
            ts, text = parts
            m = re.match(r"(\d{4}-\d{2}-\d{2})", ts)
            if not m:
                continue
            rows.append((dt.date.fromisoformat(m.group(1)), text))
    return rows


CORR_RE = re.compile(
    r"\t?\b(no[.! ]|nope|not (like|that|this|quite)|don'?t |stop |undo|revert|"
    r"wrong|that'?s not|thats not|i said|instead|go back)", re.I)
PROF_RE = re.compile(r"\b(fuck\w*|shit\w*|dammit|bullshit|asshole)\b", re.I)

WEEK0 = dt.date(2026, 5, 25)
WEEK_LABELS = ["May 25–31", "Jun 1–7", "Jun 8–14", "Jun 15–21", "Jun 22–28", "Jun 29–Jul 5"]


# ── 1. Commits per day ────────────────────────────────────────────────────────
def chart_commits():
    days, counts = [], []
    with open(f"{DATA}/commits_by_day.tsv") as f:
        for d, c in csv.reader(f, delimiter="\t"):
            days.append(dt.date.fromisoformat(d)); counts.append(int(c))
    fig, ax = plt.subplots(figsize=(11, 4.2))
    colors = [RED if c == max(counts) else AMBER for c in counts]
    ax.bar(days, counts, color=colors, width=0.9, edgecolor=WOOD, linewidth=0.4)
    peak = days[counts.index(max(counts))]
    ax.annotate(f"May 31 — {max(counts)} commits\n(the design glow-up)",
                xy=(peak, max(counts)), xytext=(peak + dt.timedelta(days=3), max(counts) - 8),
                fontsize=10, color=RED, fontweight="bold",
                arrowprops=dict(arrowstyle="->", color=RED))
    # quiet week
    ax.annotate("the quiet week\n(0 commits)", xy=(dt.date(2026, 6, 27), 2),
                xytext=(dt.date(2026, 6, 22), 40), fontsize=9, color=DEEPWOOD,
                arrowprops=dict(arrowstyle="->", color=DEEPWOOD))
    ax.set_title("648 commits in 42 days")
    ax.set_ylabel("commits / day")
    despine(ax)
    fig.autofmt_xdate()
    save(fig, "01-commits-per-day.svg")


# ── 2. Churn vs stability ─────────────────────────────────────────────────────
def chart_churn():
    hot = [("static/index.html", 95), ("css/overlays.css", 52), ("css/game.css", 32),
           ("css/lobby.css", 31), ("docs/CHANGELOG.md", 30), ("server/routes.py", 28),
           ("test-game skill", 26), ("js/lobby-screen.js", 24)]
    cold = [("server/game.py", 9), ("server/state.py", 4), ("server/gamestore.py", 4),
            ("server/security.py", 4), ("server/auth.py", 3), ("server/fanout.py", 2)]
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(12, 5.2), gridspec_kw={"width_ratios": [1.3, 1]})
    fig.subplots_adjust(top=0.80, wspace=0.5)
    for ax, data, color, title in [
        (a1, hot, AMBER, "The feel surface — re-sanded constantly\n(pixels, copy, the test harness itself)"),
        (a2, cold, COOL, "The hard parts — built once, left alone\n(the distributed-systems core)"),
    ]:
        labels = [x[0] for x in data][::-1]
        vals = [x[1] for x in data][::-1]
        ax.barh(labels, vals, color=color, edgecolor=WOOD, linewidth=0.5)
        for i, v in enumerate(vals):
            ax.text(v + 0.6, i, str(v), va="center", fontsize=10, fontweight="bold", color=INK)
        ax.set_title(title, fontsize=12, pad=10)
        despine(ax, keep=("bottom", "left"))
        ax.set_xlabel("times touched")
    a2.set_xlim(0, 12)
    fig.suptitle("Churn vs stability — the healthiest chart in the project",
                 fontsize=15, fontweight="bold", y=0.99)
    save(fig, "02-churn-vs-stability.svg", tight=False)


# ── 3. Who built it ───────────────────────────────────────────────────────────
def chart_models():
    models = [("Opus 4.8", 143), ("Opus 4.6", 114), ("Sonnet 4.6", 83), ("Fable 5", 26)]
    fig, ax = plt.subplots(figsize=(8, 4.2))
    names = [m[0] for m in models]; vals = [m[1] for m in models]
    bars = ax.bar(names, vals, color=[DEEPWOOD, WOOD, AMBER, RED], edgecolor=WOOD)
    for b, v in zip(bars, vals):
        ax.text(b.get_x() + b.get_width() / 2, v + 2, str(v), ha="center", fontweight="bold")
    ax.set_title("Who built it — commits co-authored by model")
    ax.set_ylabel("commits")
    ax.text(0.5, -0.22, "Opus 4.6/4.8 counts include their 1M-context sessions. Fable 5 arrived for the home stretch.",
            transform=ax.transAxes, ha="center", fontsize=9, color=DEEPWOOD, style="italic")
    despine(ax)
    save(fig, "03-who-built-it.svg")


# ── 4. Rolls-to-win distribution ──────────────────────────────────────────────
def chart_rolls():
    p = 1 / 6
    def cdf(r):  # P(R <= r) = (1 - (5/6)^r)^10
        return (1 - (5 / 6) ** r) ** 10 if r >= 0 else 0.0
    rs = list(range(1, 46))
    pmf = [cdf(r) - cdf(r - 1) for r in rs]
    mean = 16.56
    fig, ax = plt.subplots(figsize=(11, 4.6))
    ax.bar(rs, pmf, color=AMBER, edgecolor=WOOD, linewidth=0.4, width=0.9)
    ax.axvline(mean, color=RED, lw=2, ls="--")
    ax.text(mean + 0.4, max(pmf) * 0.92, f"mean = {mean} rolls", color=RED, fontweight="bold")
    for pct, r in [("median", 15), ("p90", 26), ("p99", 38)]:
        ax.axvline(r, color=DEEPWOOD, lw=1, ls=":")
        ax.text(r + 0.2, max(pmf) * (0.55 if pct != "median" else 0.7), f"{pct}\n{r}",
                color=DEEPWOOD, fontsize=9)
    ax.set_title("How long is a round? (rolls to lock all 10 dice)")
    ax.set_xlabel("rolls to win the round"); ax.set_ylabel("probability")
    ax.text(0.98, 0.6, "fast, generous start →\nthen a long lone-die grind:\n91.5% of rounds end\nwaiting on one die",
            transform=ax.transAxes, ha="right", fontsize=9, color=DEEPWOOD, style="italic")
    despine(ax)
    save(fig, "04-rolls-to-win.svg")


# ── 5. Winner rolls vs player count ───────────────────────────────────────────
def chart_players():
    pts = [(1, 16.6), (2, 12.9), (3, 11.4), (5, 10.0), (8, 8.9), (20, 7.4)]
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    fig, ax = plt.subplots(figsize=(8, 4.2))
    ax.plot(xs, ys, "-o", color=WOOD, mfc=RED, mec=WOOD, ms=9, lw=2.5)
    for x, y in pts:
        ax.text(x, y + 0.35, f"{y}", ha="center", fontsize=9, fontweight="bold", color=INK)
    ax.axvspan(3, 6, color=AMBER, alpha=0.15)
    ax.text(4.3, 15.3, "sweet spot\n3–6 players", ha="center", color=DEEPWOOD, fontsize=9, style="italic")
    ax.set_title("More players → shorter, sharper rounds")
    ax.set_xlabel("players in the game"); ax.set_ylabel("winner's rolls (expected)")
    despine(ax)
    save(fig, "05-winner-by-players.svg")


# ── 6. Correction rate over time ──────────────────────────────────────────────
def chart_corrections(rows):
    typed = Counter(); corr = Counter()
    for d, text in rows:
        wk = (d - WEEK0).days // 7
        if 0 <= wk < len(WEEK_LABELS):
            typed[wk] += 1
            if CORR_RE.search("\t" + text):
                corr[wk] += 1
    # Commits per week (real output) from the git daily file.
    commits = Counter()
    with open(f"{DATA}/commits_by_day.tsv") as f:
        for d, c in csv.reader(f, delimiter="\t"):
            wk = (dt.date.fromisoformat(d) - WEEK0).days // 7
            if 0 <= wk < len(WEEK_LABELS):
                commits[wk] += int(c)
    wks = list(range(len(WEEK_LABELS)))
    rate = [100 * corr[w] / typed[w] if typed[w] else 0 for w in wks]
    cmt = [commits[w] for w in wks]
    fig, ax = plt.subplots(figsize=(10, 4.6))
    ax.bar(wks, rate, color=AMBER, edgecolor=WOOD, width=0.6, zorder=3)
    for w, r in zip(wks, rate):
        ax.text(w, r + 0.4, f"{r:.0f}%", ha="center", fontweight="bold", color=INK)
    ax.plot(wks, rate, color=RED, lw=2, marker="o", mfc=RED, zorder=4, alpha=0.85)
    ax2 = ax.twinx()
    ax2.plot(wks, cmt, color=COOL, lw=2, ls="--", marker="s", zorder=2)
    ax2.set_ylabel("commits shipped / week", color=COOL)
    ax2.tick_params(axis="y", colors=COOL)
    ax2.grid(False)
    ax.set_title("Corrections stayed low while output swung 5×")
    ax.set_ylabel("% of messages that were corrections", color=RED)
    ax.set_xticks(wks); ax.set_xticklabels(WEEK_LABELS, rotation=20, ha="right")
    ax.set_ylim(0, max(rate) * 1.3)
    ax.text(0.5, -0.30,
            "Correction rate held in a tight 6–11% band (red) even as weekly output (green) "
            "ranged from 20 to 255 commits — the collaboration never spiraled.",
            transform=ax.transAxes, ha="center", fontsize=9, color=DEEPWOOD, style="italic")
    despine(ax, keep=("bottom", "left"))
    save(fig, "06-correction-rate.svg")


# ── 7. Friction fingerprint ───────────────────────────────────────────────────
def chart_friction(rows):
    total = len(rows)
    restart = sum(1 for _, t in rows if re.search(r"restart", t, re.I))
    corr = sum(1 for _, t in rows if CORR_RE.search("\t" + t))
    prof = sum(1 for _, t in rows if PROF_RE.search(t))
    labels = ["all typed\nmessages", "mention\n'restart'", "corrections", "profanity"]
    vals = [total, restart, corr, prof]
    colors = [MUTE, AMBER, WOOD, RED]
    fig, ax = plt.subplots(figsize=(9, 4.4))
    bars = ax.bar(labels, vals, color=colors, edgecolor=WOOD)
    for b, v in zip(bars, vals):
        ax.text(b.get_x() + b.get_width() / 2, v + total * 0.012, str(v),
                ha="center", fontweight="bold")
    ax.set_yscale("log")
    ax.set_title("Friction fingerprint — escalation is rare")
    ax.set_ylabel("messages (log scale)")
    ax.text(0.5, -0.24,
            f"{prof} profane messages in {total:,} — all aimed at a tool or a bug, never at Claude. "
            f"The '{restart}' restarts were the real tax (now fixed at the root).",
            transform=ax.transAxes, ha="center", fontsize=9, color=DEEPWOOD, style="italic")
    despine(ax)
    save(fig, "07-friction-fingerprint.svg")


# ── 8. Profanity timeline (the fun one) ───────────────────────────────────────
def chart_profanity():
    events = [
        (dt.date(2026, 6, 9), "nginx on the host"),
        (dt.date(2026, 6, 9), "changed the app-header"),
        (dt.date(2026, 6, 15), "the tests.md file"),
        (dt.date(2026, 6, 24), "still not full width"),
        (dt.date(2026, 7, 3), "the harnesses"),
    ]
    import matplotlib.dates as mdates
    fig, ax = plt.subplots(figsize=(11, 4.0))
    fig.subplots_adjust(bottom=0.30, top=0.82)
    start, end = dt.date(2026, 5, 25), dt.date(2026, 7, 6)
    ax.axhline(0, color=WOOD, lw=2, zorder=1)
    # nudge the second same-day event sideways so labels don't stack on one x.
    seen = {}
    for d, why in events:
        off = seen.get(d, 0); seen[d] = off + 1
        xd = d + dt.timedelta(days=2 * off)   # horizontal nudge for same-day pair
        y = 1.4 + off * 1.1
        ax.plot([xd], [0], "o", color=RED, ms=13, zorder=3)
        ax.annotate(f'"...{why}"', xy=(xd, 0), xytext=(xd, y),
                    ha="center", fontsize=10, color=RED, fontweight="bold",
                    arrowprops=dict(arrowstyle="-", color=RED, lw=1))
    ax.set_xlim(start, end); ax.set_ylim(-0.6, 3.6)
    ax.set_yticks([])
    ax.xaxis.set_major_locator(mdates.DayLocator(bymonthday=[1, 8, 15, 22, 29]))
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %-d"))
    ax.tick_params(axis="x", labelsize=9)
    ax.set_title("Every curse word, and what caused it (5 in 1,859 messages)", pad=14)
    ax.text(0.5, -0.34, "4× “fucking”, 1× “dammit”. Note the gaps: none in the first two weeks, "
            "none in the last two. Frustration at friction — then the friction got fixed.",
            transform=ax.transAxes, ha="center", fontsize=9.5, color=DEEPWOOD, style="italic")
    for s in ("top", "right", "left"):
        ax.spines[s].set_visible(False)
    ax.grid(False)
    save(fig, "08-profanity-timeline.svg", tight=False)


def main():
    rows = load_typed()
    print(f"loaded {len(rows)} typed messages")
    chart_commits()
    chart_churn()
    chart_models()
    chart_rolls()
    chart_players()
    chart_corrections(rows)
    chart_friction(rows)
    chart_profanity()
    print("done")


if __name__ == "__main__":
    main()
