# Soundboard Field Test Analysis

**Data collected:** June 13-20, 2026
**Device:** iPhone (iOS 18.7, Safari 26.5 Mobile, 430x932 @3x)
**Mic:** iPhone Microphone, echo cancellation OFF, 48 kHz sample rate
**Total tests:** 888 (7 sessions, 24 voices standard + gameboy deep-dive)

> **S7 update (June 20).** A seventh session was added at the hub/bar — the same
> venue as S5/S6 — with the speaker at a **known 60% of the iPhone volume bar**
> (reported by the tester; the first session with a hard volume number rather
> than a qualitative label). It anchors the volume curve with a real percentage,
> confirms the 1800 Hz "safe" tier (60/60 again), and walks back the strongest
> claim from the S5 writeup — that high volume *redeems* the low-frequency
> voices. See "[The 60% anchor and what it does to the S5 story](#the-60-anchor-and-what-it-does-to-the-s5-story)".

---

## Test conditions

| Session | Date | Location | Setting | Ambient noise | Volume | GPS accuracy |
|---------|------|----------|---------|---------------|--------|--------------|
| S1 | Jun 13 20:02 | indoors | quiet room | -83.6 dB | **low** | n/a |
| S2 | Jun 13 21:47 | dog park, walking, near fountain | outdoor/noisy | -46.6 dB | normal | 24 m |
| S3 | Jun 14 20:42 | dog park, by gate | outdoor/quiet | -81.6 dB | normal | 9 m |
| S4 | Jun 14 21:33 | home office, music playing | indoor/music | -66.4 dB | **half** | 11 m |
| S5 | Jun 15 02:37 | hub/bar, sports + conversation | indoor/loud | -58.5 dB | **high** | 10 m |
| S6 | Jun 15 03:00 | hub/bar, loud Mario game | indoor/loud | -59.6 dB | **max** | 20 m |
| S7 | Jun 20 05:20 | hub/bar, past closing, AGT on phone + fan | indoor/loud | -63.3 dB | **60% (measured)** | 82 m |

S2, S3, S4 share GPS coordinates (~33.14, -96.70). S5, S6, and S7 are at the
same hub/bar (~33.13, -96.70). S1 was indoors, no GPS recorded.

S5 and S6 introduced the loudest environments tested at that point (-58 to -60 dB
ambient from sports TV, conversation, and a video game) combined with the
highest speaker volumes. S6 is a targeted deep-dive: four consecutive runs of
gameboy only, at max volume, to stress-test the worst-performing voice under
the best possible output conditions.

S7 returns to the same bar after closing (doors shut, a TV talent show playing
loud off a nearby phone, a fan running). Its value isn't the environment — it's
the **measured 60% volume setting**. Every prior session's volume is a
qualitative label inferred from field notes; S7 is the first with a real number
off the iPhone volume bar, which lets us calibrate the volume curve in
percentage terms instead of "low/half/normal/high/max."

---

## Overall results

```
Session    Pass   Fail   Rate     Conditions
──────────────────────────────────────────────────────────────────
S1          16    128    11.1%    quiet room, LOW volume
S4          73     71    50.7%    home office + music, HALF volume
S3          97     47    67.4%    dog park (quiet), normal volume
S7         119     25    82.6%    hub/bar (loud), 60% volume (measured)
S2         122     22    84.7%    dog park (noisy), normal volume
S5         127     17    88.2%    hub/bar (loud), HIGH volume
S6          13     11    54.2%    hub/bar (loud), MAX vol, gameboy only
──────────────────────────────────────────────────────────────────
Total      567    321    63.9%
```

S5 is still the highest-scoring full session despite being one of the noisiest
environments. "Much louder" volume overwhelmed the sports TV and conversation
noise. This cements the finding from S1-S4: speaker output is everything,
ambient noise barely registers. S7 lands at 82.6% — between S4 (half) and
S2/S5 — which is exactly where its measured 60% volume predicts (see the
calibration below).

```
Pass rate vs. volume setting (full 24-voice sessions only)

 100% |
  90% |                                      * S5 (high, loud bar)
      |                                  * S2 (normal, noisy outdoors)
  80% |                              * S7 (60%, loud bar)
  70% |                          * S3 (normal, quiet outdoors)
  60% |
  50% |              * S4 (half + music)
  40% |
  30% |
  20% |
  10% |  * S1 (low)
   0% |
      +--------------------------------------------------
         low      half   60%  normal      high
                  Speaker volume -->
```

---

## Voice performance ranking

Pass rate across all standard tests per voice (6 sessions x 6 tests = 36
attempts, except gameboy which adds 24 from S6 for 60 total), sorted best to
worst. S6 ran gameboy only, so the other voices show `--` for that column.

```
Voice                  Pass rate            S1   S2   S3   S4   S5   S6    S7   Med. margin
──────────────────────────────────────────────────────────────────────────────────────────
current (Pure Sine)    ██████████ 36/36     6/6  6/6  6/6  6/6  6/6   --   6/6   35.0 dB
triangle               ██████████ 36/36     6/6  6/6  6/6  6/6  6/6   --   6/6   35.0 dB
soft-sine              █████████░ 34/36     4/6  6/6  6/6  6/6  6/6   --   6/6   34.0 dB
bell                   ████████░░ 30/36     0/6  6/6  6/6  6/6  6/6   --   6/6   34.0 dB
chime                  ████████░░ 30/36     0/6  6/6  6/6  6/6  6/6   --   6/6   34.0 dB
kalimba                ████████░░ 30/36     0/6  6/6  6/6  6/6  6/6   --   6/6   34.0 dB
organ                  ████████░░ 30/36     0/6  6/6  6/6  6/6  6/6   --   6/6   32.0 dB
vibes                  ████████░░ 30/36     0/6  6/6  6/6  6/6  6/6   --   6/6   32.0 dB
portamento-dream       ████████░░ 30/36     0/6  6/6  6/6  6/6  6/6   --   6/6   22.0 dB ⚠
flute                  ████████░░ 29/36     0/6  6/6  6/6  6/6  5/6   --   6/6   37.0 dB
marimba                ███████░░░ 27/36     0/6  6/6  5/6  4/6  6/6   --   6/6   33.0 dB
doorbell               ███████░░░ 25/36     0/6  6/6  6/6  1/6  6/6   --   6/6   35.0 dB
harp                   ███████░░░ 25/36     0/6  6/6  5/6  2/6  6/6   --   6/6   20.0 dB ⚠
fm-bell                ██████░░░░ 24/36     0/6  6/6  4/6  3/6  6/6   --   5/6   32.0 dB
music-box              ██████░░░░ 22/36     0/6  6/6  6/6  1/6  6/6   --   3/6   32.0 dB
echo-kalimba           █████░░░░░ 19/36     0/6  6/6  5/6  0/6  5/6   --   3/6   28.0 dB
major-bells            █████░░░░░ 17/36     0/6  5/6  4/6  0/6  6/6   --   2/6   31.0 dB
xylophone-low          ████░░░░░░ 16/36     0/6  6/6  0/6  0/6  4/6   --   6/6   28.0 dB
power-chime            ████░░░░░░ 16/36     0/6  5/6  1/6  0/6  6/6   --   4/6   32.0 dB
wide-marimba           ████░░░░░░ 14/36     0/6  5/6  0/6  2/6  5/6   --   2/6   29.0 dB
kalimba-low            ████░░░░░░ 13/36     0/6  2/6  1/6  0/6  5/6   --   5/6   32.0 dB
marimba-low            ███░░░░░░░ 11/36     0/6  0/6  0/6  0/6  5/6   --   6/6   30.0 dB
gameboy                ███░░░░░░░ 15/60     0/6  1/6  0/6  0/6  0/6  13/24 1/6   29.0 dB
steel-drum             ██░░░░░░░░  8/36     0/6  2/6  0/6  0/6  2/6   --   4/6   30.0 dB
```

⚠ = passes but with thin signal margins

S7 (60% volume, loud bar) reshuffled the bottom half but left the top
untouched. The eleven 1800 Hz voices all went 6/6 again — including `flute`,
which recovered the 6/6 it dropped in S5, restoring its "perfect outside of
S1" record. Below the safe tier, S7 scattered: `xylophone-low` and
`marimba-low` posted their best non-S5 scores (6/6 each), while `music-box`,
`major-bells`, `wide-marimba`, and `echo-kalimba` fell well below their S5
showing. That scatter is the subject of the next section.

### Tiers

**Tier 1 -- Bulletproof (100%):** `current`, `triangle`
30/30 across every condition including low volume, half volume with music,
and a loud bar. Margins stay above 29 dB in every session. The only voices
that survived S1's low-volume gauntlet at 6/6.

**Tier 2 -- Near-perfect (93%):** `soft-sine`
28/30. Two failures were in S1's low-volume test. At half volume or above,
never missed. The exponential envelope and 0.85 gain cost it just enough
signal to stumble at the lowest output.

**Tier 3 -- Reliable (80%):** `bell`, `chime`, `kalimba`, `organ`, `vibes`,
`portamento-dream`
All 24/30 with the same pattern: 0/6 at low volume, 6/6 everywhere else
including S4's half-volume-plus-music and S5's noisy bar. Six voices, all safe
to ship.

Note: `portamento-dream` belongs here by pass rate but operates at 21-23 dB
margins -- about 10 dB thinner than the rest of the tier. It's one bad
condition away from dropping.

**Tier 3 (rejoined) -- Reliable (81%):** `flute`
29/36. Was a locked Tier 3 member through S1-S4, dipped to 5/6 in S5 (its
first non-low-volume miss), then went 6/6 again in S7. With the S5 wobble
bracketed by perfect sessions on either side, it reads as a one-off fluke
rather than a trend -- flute is back to "perfect outside of S1."

**Tier 4 -- Volume-dependent (63%):** `marimba`, `music-box`, `doorbell`,
`harp`, `fm-bell`
These work at normal-or-above volume but fall apart when volume drops.
`music-box` and `doorbell` are the biggest swing voices: 6/6 at normal+ but
1/6 each in S4. S5 redeemed them (both 6/6 at the hub), confirming volume is
the variable, not environment.

`harp` has the thinnest margins of any passing voice (18-21 dB) and is the
most likely to fail even at normal volume.

**Tier 5 -- Needs high volume (40-53%):** `echo-kalimba`, `major-bells`,
`power-chime`, `wide-marimba`
Inconsistent at normal volume, dead at half or below. S5 was a revelation:
`power-chime` and `major-bells` both went 6/6 at the loud hub after going
0-1/6 in S3 and S4. These voices are viable but only when the speaker is
cranked.

**Tier 6 -- Marginal (27-33%):** `xylophone-low`, `kalimba-low`
`xylophone-low` remains the volatility champion: 6/6 in S2, 4/6 in S5, 0/6
everywhere else. `kalimba-low` was 0-2/6 across S1-S4 but jumped to 5/6 in
S5, proving it *can* work at high volume. Neither is reliable enough to ship
without a warning.

**Tier 7 -- Broken (8-26%):** `gameboy`, `marimba-low`, `steel-drum`
`marimba-low` went from 0/24 across four sessions to 5/6 in S5 -- high volume
rescued it from the dead, but one good session doesn't make it shippable.
`steel-drum` has managed only 4/30 across five full sessions. `gameboy` got a
dedicated 24-test deep-dive at max volume (S6) and only hit 54% -- still
unreliable even under the best possible conditions (see "The gameboy problem"
below).

---

## The 60% anchor and what it does to the S5 story

Every session before S7 carried a *qualitative* volume label. S7 is the first
with a number: the tester read it off the iPhone volume bar at **~60% full**.
That single fact lets us do two things — place 60% on the volume curve
objectively, and re-examine the boldest claim from the S5 writeup.

### Calibrating with received level

Speaker volume shows up at the mic as **received peak dB** (handset-to-mic
distance is roughly fixed). Restricting to the ten constant-design 1800 Hz
voices — same tone design every session, so only the volume knob moves the
received level — gives a clean ladder:

```
Session         Volume        Median received peak (1800 Hz voices)
─────────────────────────────────────────────────────────────────
S1              low                 -77 dB
S4              half (~50%)         -63 dB
S3              normal              -59 dB
S2              normal              -58 dB
S7              60% (measured)      -55 dB   ← anchor
S6              max                 -46 dB
S5              high                -45 dB
```

60% lands at -55 dB: ~8 dB above "half," a hair above "normal," and a full
~10 dB below the S5/S6 "high/max" runs. So despite a loud, past-closing bar,
the tester did **not** crank it — 60% is normal-plus, not cranked. (Caveat:
received peak conflates volume with handset distance/orientation, but across
60 samples the median is stable.)

### The pass-rate curve, by frequency band

Splitting each session into the 1800 Hz "safe" voices vs the sub-1800 Hz
voices, against volume:

```
Volume          1800 Hz safe voices      sub-1800 Hz voices
──────────────────────────────────────────────────────────
50%  (S4)              97%                      18%
60%  (S7)             100%                      70%
high (S5)              98%                      81%
```

Two clean reads:

1. **The safe voices plateau at or below 60%.** 97% at half, 100% at 60%,
   98% at high — they gain nothing from extra volume because they're already
   flat. If the shippable menu is just the 1800 Hz voices, 60% is past the
   point of diminishing returns; even 50% covers them.

2. **The sub-1800 Hz voices ride the steep part of the curve through 60% and
   never reach the top.** They leap 18% → 70% from half to 60%, then only
   crawl to 81% at full-bar-high. The last ~20% doesn't close at any realistic
   volume.

### Walking back the "S5 redemption"

The S5 writeup argued that high volume *redeems* the low-frequency voices —
`power-chime` and `major-bells` going 6/6 at the loud hub after 0-1/6 in S3/S4
read as proof. S7, at the **same venue**, did not reproduce it:

```
voice           S5 (high)   S7 (60%)
──────────────────────────────────────
power-chime       6/6         4/6   ↓
major-bells       6/6         2/6   ↓
wide-marimba      5/6         2/6   ↓
echo-kalimba      5/6         3/6   ↓
music-box         6/6         3/6   ↓
─ but the other direction too ─
xylophone-low     4/6         6/6   ↑
marimba-low       5/6         6/6   ↑
steel-drum        2/6         4/6   ↑
```

Most of the downward swing is explained by the calibration above: S7 was ~10 dB
quieter than S5 at the mic, and these voices sit on the steep 60%→high part of
their curve, so a real volume drop knocks them back. That actually *supports*
the volume thesis. What it does **not** support is the stronger version — that
cranking volume makes these voices *reliable*. Some moved the opposite way
(`xylophone-low`, `marimba-low`, `steel-drum` all improved at lower volume),
which only happens if per-session variance, not volume, is dominating their
outcome. These voices live at the decoder's threshold: volume sets the odds,
but the result is still a coin flip session to session.

The corrected statement: **high volume raises the floor for the low-frequency
voices but does not make them dependable. S5 was a lucky high-volume session
for them; S7 is the regression to the mean.** The safe-voice recommendation is
unaffected and, if anything, reinforced.

### Why the failures aren't a loudness problem

One more nuance the 60% data exposes. In S7, passing decodes had a median
peak-to-floor margin of **32 dB** and failures **27 dB** — overlapping ranges
(failures ran as high as 34 dB, passes as low as 18 dB), and **all 25 failures
ended in `TIMEOUT` — the decoder never locked**, not "too quiet to hear." So
margin alone doesn't separate pass from fail. Volume helps the safe voices by
handing the decoder clean tone onsets to segment on; for the ringing /
harmonic-rich voices the failure is lost letter boundaries (reverb tails, long
bell decays, square-wave harmonics smearing across FFT bins), which more
volume doesn't fully cure. "Volume is everything" holds for *why the 1800 Hz
band is robust*; for the bad voices the binding constraint is decode
segmentation, not SNR.

---

## What makes a voice decodable?

### Frequency range

```
Start freq (Hz)   Voices              Pass rate (all sessions)
──────────────────────────────────────────────────────────────
1800 (default)    current, soft-sine,  77% median (range 4-100%)
                  triangle, bell,
                  marimba, flute,
                  kalimba, organ,
                  vibes
900               doorbell             63%
800               music-box, gameboy   26-63%
750               steel-drum,          13-63%
                  portamento-dream,
                  harp, wide-marimba
700               xylophone-low,       33-63%
                  power-chime,
                  major-bells,
                  fm-bell
650               marimba-low,         17-53%
                  echo-kalimba
600               kalimba-low          27%
```

The 1800 Hz default band has the highest ceiling but also wide variance because
envelope and gain matter too (`marimba` at 1800 Hz only hits 70%). Below 800 Hz
the ceiling drops fast -- only `portamento-dream` (750 Hz, 80%) bucks the trend,
and it does so with paper-thin margins.

### The volume x frequency interaction

S5 dramatically expanded the picture. At high volume, even the lowest-frequency
voices become viable:

```
                              S1 (low)  S4 (half)  S2+S3 (normal)   S5 (high)
                              ────────  ─────────  ──────────────   ─────────
1800 Hz default voices        27%       97%        99%              98%
800-900 Hz voices             0%        11%        69%              67%
<=750 Hz voices               0%        20%        57%              85% ← jump
```

At normal volume, the sub-750 Hz voices sit around 57%. Crank it to high and
they jump to 85% -- higher than normal volume achieves for the 800-900 Hz band.
The 1800 Hz voices plateau at normal (97-99%) and gain nothing from more volume.

This means the volume boost disproportionately helps the voices that need it
most. The frequency gap that looked fatal at normal volume is survivable at high.

### Gain and envelope

| Parameter | Reliable voices | Broken voices |
|-----------|----------------|---------------|
| toneGain | 0.75 - 1.0 | 0.45 (gameboy) |
| envelope | sustained / gradual decay | sharp percussive + fast decay |
| tremolo | absent or mild (vibes: depth 0.15) | strong (steel-drum: depth 0.1 + low freq) |

`vibes` has a mild tremolo (rate 5, depth 0.15) and still hits 24/30. But `vibes`
runs at 1800 Hz with 0.9 gain -- the tremolo is survivable because everything
else is in its favor. `steel-drum` has a similar tremolo (rate 6, depth 0.1) but
at 750 Hz with 0.85 gain, and it's broken (4/30). Tremolo is only fatal when
combined with other disadvantages.

### Effects degrade margins

```
Effect           Med. margin    Pass rate (S2-S5 avg)
────────────────────────────────────────────────────────
None             33.0 dB        5.3/6
Reverb           24.0 dB        4.2/6
FM overtones     31.0 dB        4.7/6
Tremolo (sole)   31.0 dB        1.5/6
```

Reverb is the worst single effect -- it smears tone energy across time, making
peaks harder for the FFT to lock onto. FM overtones spread energy into
non-fundamental partials the decoder ignores. Both are survivable at high
frequencies and high volume, but they eat into the margin budget that would
otherwise protect against degradation.

---

## The gameboy problem

S6 was designed to answer one question: can gameboy work if you throw max volume
at it? The answer is "sometimes."

```
S6: Gameboy at max volume, 4 consecutive runs
──────────────────────────────────────────────
Run 1:  2/6    (ZZZZY, MQPRP passed)
Run 2:  6/6    (all codes, all frame-1 decodes)
Run 3:  3/6    (HELLO, AABCD, ZZZZY passed)
Run 4:  2/6    (HELLO, WBTHS passed)
──────────────────────────────────────────────
Total: 13/24   (54%)
```

Run 2 was a perfect 6/6 -- then runs 3 and 4 fell back to 2-3/6 under
identical conditions. The variance isn't environmental (same bar, same minute);
it's the voice itself. With 0.45 toneGain, a percussive envelope, and 800 Hz
startFreq, gameboy operates right at the decoder's threshold even at max volume.
Small fluctuations in mic pickup or background noise push individual codes above
or below the line.

The margins tell the story: gameboy's passing tests average 28 dB margin (vs. 35+
for Tier 1 voices). That's enough to decode but not enough to be consistent.

One interesting pattern from S6: HELLO decoded in 3/4 runs. It has a repeated
letter (LL), which gives the decoder extra FFT windows on that frequency. But
AABCD (also repeated) only decoded in 2/4, and ZZZZY (heavily repeated) went
2/4 too. At this margin level, repeated letters help but don't save.

---

## Decode speed

```
Decode path     Typical latency    Occurrences    % of passes
──────────────────────────────────────────────────────────────
Frame 1         1458-6543 ms       525            93%
Frame 2         3037-6186 ms       38             7%
Frame 3         5506-6496 ms       4              1%
```
(across all 7 sessions, 567 passing decodes)

S5 contributed mostly frame-1 decodes, consistent with high volume giving the
decoder clean signal on the first pass. S6's gameboy runs showed more latency
variance: some frame-1 decodes at ~1475 ms, others needed 3000+ ms even on
frame 1 (run 2's first few tests needed ~3 seconds for frame-1 lock, suggesting
the decoder needed more integration time despite ultimately succeeding).

Frame 1 latency scales with `toneMs`:
- toneMs ~150 (current, triangle, kalimba): ~1660 ms
- toneMs ~170 (bell, vibes, flute): ~1780 ms
- toneMs ~185 (portamento-dream, fm-bell): ~1960-1980 ms
- toneMs ~200 (doorbell): ~2020 ms

The first test in each session runs 40-60 ms slower than subsequent tests
(AudioContext cold-start).

---

## Environmental findings

### Volume is everything (confirmed with more data)

Seven data points now form a clear curve:

```
Volume      Ambient      Pass rate     Condition
──────────────────────────────────────────────────────
low         -83.6 dB      11.1%        S1: quiet room
half        -66.4 dB      50.7%        S4: music playing
normal      -81.6 dB      67.4%        S3: quiet outdoors
60% (meas)  -63.3 dB      82.6%        S7: loud bar, measured 60%
normal      -46.6 dB      84.7%        S2: noisy outdoors
high        -58.5 dB      88.2%        S5: loud bar
```

S5 is the noisiest-but-one indoor environment and the highest-scoring full
session. Volume explains the ranking. Ambient noise remains a second-order
effect: S7 had the quietest ambient of any bar session (-63.3 dB) yet scored
below S5, because S7 ran ~10 dB quieter at the speaker (see "The 60% anchor").

### Loud environments don't hurt (and might help)

S5 (-58.5 dB ambient) outperformed the quiet outdoor S3 (-81.6 dB ambient).
The bar had sports on TV, multiple conversations, and general crowd noise.
None of it mattered because the speaker was turned up high enough.

The slight edge S2 and S5 have over S3 despite noisier environments may be
coincidence, or it may reflect that people instinctively turn the volume up in
noisy places -- which is the right move for decode success.

### Music as interference (S4 vs S5)

S4 (half volume + background music) hurt the 800-900 Hz voices badly: music-box
and doorbell went 1/6 each. S5 (high volume + background sports/conversation)
saw both recover to 6/6. This confirms the S4 collapse was primarily about
volume, not the music. Music might mask some frequencies, but cranking the speaker
overpowers it.

```
                        S4 (half + music)    S5 (high + loud bar)
                        ─────────────────    ────────────────────
1800 Hz voices (10)     avg 5.8/6            avg 5.9/6
music-box (800 Hz)      1/6                  6/6
doorbell (900 Hz)       1/6                  6/6
```

### The fountain still doesn't matter

S2's mid-session fountain proximity shows no degradation. Broadband water noise
doesn't overlap the tone encoding frequencies.

### Repeated-letter codes still decode more easily

S6 reinforces the pattern, though less dramatically than S3-S4:
- HELLO (one repeat) decoded in 3/4 gameboy runs
- ZZZZY (heavy repeat) decoded in 2/4 gameboy runs
- ABCDE (no repeat) decoded in 1/4 gameboy runs

The repeated frequency gives the decoder extra FFT windows. For borderline voices
it tips the balance, but it's not a guarantee -- gameboy's margins are too thin
for any code to be reliable.

---

## Session-over-session stability

Nine voices maintained a perfect 6/6 across every non-low-volume session
(S2, S3, S4, S5, S7):

```
Voice               S2    S3    S4    S5    S7    Consistency
────────────────────────────────────────────────────────────
current              6/6   6/6   6/6   6/6   6/6   █████
triangle             6/6   6/6   6/6   6/6   6/6   █████
soft-sine            6/6   6/6   6/6   6/6   6/6   █████
bell                 6/6   6/6   6/6   6/6   6/6   █████
chime                6/6   6/6   6/6   6/6   6/6   █████
kalimba              6/6   6/6   6/6   6/6   6/6   █████
organ                6/6   6/6   6/6   6/6   6/6   █████
vibes                6/6   6/6   6/6   6/6   6/6   █████
portamento-dream     6/6   6/6   6/6   6/6   6/6   █████
```

`flute` broke its streak once (5/6 in S5) but went 6/6 in S7, putting the S5
miss between two perfect sessions — almost certainly a fluke. It's effectively
back in the "perfect across every condition" club with one asterisk.

The "S5 redemption arc" — voices that looked like they came alive at high
volume in S5 — does **not** survive S7. Adding the S7 column (60%, same bar)
shows the S5 highs were a lucky session, not a stable gain:

```
Voice               S2    S3    S4    S5    S7    Verdict
──────────────────────────────────────────────────────────────
marimba-low          0/6   0/6   0/6   5/6   6/6   genuinely up, but on 2 good of 6
power-chime          5/6   1/6   0/6   6/6   4/6   S5 was the outlier
major-bells          5/6   4/6   0/6   6/6   2/6   S5 was the outlier
kalimba-low          2/6   1/6   0/6   5/6   5/6   inconsistent, never reliable
wide-marimba         5/6   0/6   2/6   5/6   2/6   all-over-the-map
xylophone-low        6/6   0/6   0/6   4/6   6/6   all-or-nothing, still
```

The diagnostic tell: at the *same venue*, quieter (S7) vs louder (S5), some of
these went up and some went down. If volume were the controlling variable they
would all move the same direction. They don't — so per-session luck dominates
their outcome. These are threshold voices, full stop.

The most volatile voices across S2-S7:

```
Voice               S2    S3    S4    S5    S7    Pattern
──────────────────────────────────────────────────────────────
xylophone-low        6/6   0/6   0/6   4/6   6/6   all-or-nothing
echo-kalimba         6/6   5/6   0/6   5/6   3/6   unpredictable
power-chime          5/6   1/6   0/6   6/6   4/6   unpredictable
music-box            6/6   6/6   1/6   6/6   3/6   was "dies at half," now wobbles loud too
doorbell             6/6   6/6   1/6   6/6   6/6   only true "dies at half" survivor
```

`doorbell` is the one borderline voice that still behaves like a clean
volume-gated voice (1/6 at half, 6/6 everywhere at normal+, including S7). The
others have now failed at good volume too.

---

## Recommendations

1. **Ship these 9 voices.** Current, triangle, soft-sine, bell, chime, kalimba,
   organ, vibes, and portamento-dream went 6/6 in every session at half volume
   or above across 6 sessions (S2-S5, S7). That's a proven, reliable menu.

2. **Ship flute with confidence.** 29/36 overall; its only non-S1 miss was a
   5/6 in S5, bracketed by 6/6 in S4 and 6/6 in S7. Reads as a fluke, not a
   pattern.

3. **Drop these voices.** Steel-drum (8/36), gameboy (15/60, including a
   dedicated max-volume deep-dive that still only hit 54%), and the rest of the
   sub-1800 Hz set are not viable. S7 confirmed it: at the same loud bar as S5
   but ~10 dB quieter, marimba-low/xylophone-low rose while power-chime/major-
   bells/wide-marimba/echo-kalimba fell — threshold voices whose outcome is
   luck, not a property you can ship around. (marimba-low's lone 6/6 in S7 and
   5/6 in S5 don't override four sessions of zeros.)

4. **Reconsider the volume-caveat voices in light of S7.** `doorbell` held 6/6
   in S7 (60%) and stays a reasonable "caveat" candidate. But `music-box`
   (3/6) and `fm-bell` (5/6) slipped at 60% despite the loud bar, and the
   broader sub-1800 Hz group only reached 70% at 60% and 81% even at full-bar-
   high. The S5 "6/6 at high volume" numbers for these voices were a lucky
   session, not a reliable property (see "The 60% anchor"). Treat the whole
   sub-1800 Hz set as not-dependable rather than volume-gated.

5. **Set a minimum volume floor — now in real percentages.** S7 anchors the
   curve: low ≈ 11%, half/50% = 51%, 60% = 83%, high ≈ 88%. For the shippable
   1800 Hz voices specifically, the band-split shows 97% at 50% and 100% at
   60% — they plateau by 60%, so a **50% floor covers the safe menu and 60% is
   bulletproof**. There's no benefit to demanding more. The sub-1800 Hz voices
   never clear ~80% at any floor, so a volume prompt can't rescue them.

6. **Keep default voices on the 1800 Hz production band; don't lower `startFreq`.**
   The shipped encoder uses START 1800 Hz / letters 1860-3360 Hz, and that band
   is plateau-reliable from half volume up (97%+). The field-test failures were
   all *lowered-band* experiments: 800-900 Hz voices are fine at normal+ but
   fragile below, and ≤750 Hz voices need high volume to work at all. A custom
   voice can restyle timbre freely but should not drop the band below ~900 Hz.

7. **Don't combine low gain + percussive envelope + a lowered band.** Gameboy
   (0.45 gain, percussive, 800 Hz) is the poster child: even max volume only
   gets it to 54%. Any one of those traits is survivable; all three together put
   the signal below the decoder's consistency threshold.

8. **Test on Android.** All 888 tests are from one iPhone. Android mic
   characteristics, speaker output curves, and WebAudio implementations differ
   enough that tier boundaries could shift.

---

## Raw data

Source files in `docs/audio-sharing/fieldtests/`:

| File | Session | Tests | Voices |
|------|---------|-------|--------|
| `soundboard-tests-2026-06-13T20-02-30.json` | S1 | 144 | 24 (all) |
| `soundboard-tests-2026-06-13T21-47-26.json` | S2 | 144 | 24 (all) |
| `soundboard-tests-2026-06-14T20-42-02.json` | S3 | 144 | 24 (all) |
| `soundboard-tests-2026-06-14T21-33-45.json` | S4 | 144 | 24 (all) |
| `soundboard-tests-2026-06-15T02-37-09.json` | S5 | 144 | 24 (all) |
| `soundboard-tests-2026-06-15T03-00-27.json` | S6 | 24 | gameboy x4 |
| `soundboard-tests-2026-06-20T05-20-37.json` | S7 | 144 | 24 (all), measured 60% volume |

Each export contains device metadata, ambient noise measurement, GPS, and
per-session results with individual test latency, signal margin (peak-to-floor
dB), decode frame count, and the test code attempted. S7 is the first session
with a tester-reported speaker volume (60% of the iPhone volume bar); all prior
volume levels are qualitative labels inferred from field notes.
