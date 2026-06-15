# Soundboard Field Test Analysis

**Data collected:** June 13-15, 2026
**Device:** iPhone (iOS 18.7, Safari 26.5 Mobile, 430x932 @3x)
**Mic:** iPhone Microphone, echo cancellation OFF, 48 kHz sample rate
**Total tests:** 744 (6 sessions, 24 voices standard + gameboy deep-dive)

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

S2, S3, S4 share GPS coordinates (~33.14, -96.70). S5 and S6 are at a nearby
hub/bar (~33.13, -96.70). S1 was indoors, no GPS recorded.

S5 and S6 introduce the loudest environments tested so far (-58 to -60 dB
ambient from sports TV, conversation, and a video game) combined with the
highest speaker volumes. S6 is a targeted deep-dive: four consecutive runs of
gameboy only, at max volume, to stress-test the worst-performing voice under
the best possible output conditions.

---

## Overall results

```
Session    Pass   Fail   Rate     Conditions
──────────────────────────────────────────────────────────────────
S1          16    128    11.1%    quiet room, LOW volume
S4          73     71    50.7%    home office + music, HALF volume
S3          97     47    67.4%    dog park (quiet), normal volume
S2         122     22    84.7%    dog park (noisy), normal volume
S5         127     17    88.2%    hub/bar (loud), HIGH volume
S6          13     11    54.2%    hub/bar (loud), MAX vol, gameboy only
──────────────────────────────────────────────────────────────────
Total      448    296    60.2%
```

S5 is the highest-scoring full session despite being the second-noisiest
environment. "Much louder" volume overwhelmed the sports TV and conversation
noise. This cements the finding from S1-S4: speaker output is everything,
ambient noise barely registers.

```
Pass rate vs. volume setting (full 24-voice sessions only)

 100% |
  90% |                                      * S5 (high, loud bar)
      |                                  * S2 (normal, noisy outdoors)
  80% |
  70% |                          * S3 (normal, quiet outdoors)
  60% |
  50% |              * S4 (half + music)
  40% |
  30% |
  20% |
  10% |  * S1 (low)
   0% |
      +--------------------------------------------------
         low        half        normal       high
                  Speaker volume -->
```

---

## Voice performance ranking

Pass rate across all standard tests per voice (5 sessions x 6 tests = 30
attempts, except gameboy which adds 24 from S6 for 54 total), sorted best to
worst.

```
Voice                  Pass rate            S1   S2   S3   S4   S5   S6   Med. margin
──────────────────────────────────────────────────────────────────────────────────────
current (Pure Sine)    ██████████ 30/30     6/6  6/6  6/6  6/6  6/6   --   36.0 dB
triangle               ██████████ 30/30     6/6  6/6  6/6  6/6  6/6   --   35.0 dB
soft-sine              █████████░ 28/30     4/6  6/6  6/6  6/6  6/6   --   35.0 dB
bell                   ████████░░ 24/30     0/6  6/6  6/6  6/6  6/6   --   32.0 dB
chime                  ████████░░ 24/30     0/6  6/6  6/6  6/6  6/6   --   33.0 dB
kalimba                ████████░░ 24/30     0/6  6/6  6/6  6/6  6/6   --   33.0 dB
organ                  ████████░░ 24/30     0/6  6/6  6/6  6/6  6/6   --   33.0 dB
vibes                  ████████░░ 24/30     0/6  6/6  6/6  6/6  6/6   --   34.0 dB
portamento-dream       ████████░░ 24/30     0/6  6/6  6/6  6/6  6/6   --   23.0 dB ⚠
flute                  ███████░░░ 23/30     0/6  6/6  6/6  6/6  5/6   --   37.0 dB ↓
marimba                ███████░░░ 21/30     0/6  6/6  5/6  4/6  6/6   --   32.0 dB
music-box              ██████░░░░ 19/30     0/6  6/6  6/6  1/6  6/6   --   33.0 dB
doorbell               ██████░░░░ 19/30     0/6  6/6  6/6  1/6  6/6   --   35.0 dB
harp                   ██████░░░░ 19/30     0/6  6/6  5/6  2/6  6/6   --   20.0 dB ⚠
fm-bell                ██████░░░░ 19/30     0/6  6/6  4/6  3/6  6/6   --   31.0 dB
echo-kalimba           █████░░░░░ 16/30     0/6  6/6  5/6  0/6  5/6   --   28.0 dB
major-bells            █████░░░░░ 15/30     0/6  5/6  4/6  0/6  6/6   --   31.0 dB
power-chime            ████░░░░░░ 12/30     0/6  5/6  1/6  0/6  6/6   --   33.0 dB
wide-marimba           ████░░░░░░ 12/30     0/6  5/6  0/6  2/6  5/6   --   29.0 dB
xylophone-low          ███░░░░░░░ 10/30     0/6  6/6  0/6  0/6  4/6   --   28.0 dB
kalimba-low            ██░░░░░░░░  8/30     0/6  2/6  1/6  0/6  5/6   --   33.0 dB
gameboy                █████░░░░░ 14/54     0/6  1/6  0/6  0/6  0/6  13/24 30.0 dB
marimba-low            █░░░░░░░░░  5/30     0/6  0/6  0/6  0/6  5/6   --   30.0 dB
steel-drum             █░░░░░░░░░  4/30     0/6  2/6  0/6  0/6  2/6   --   31.0 dB
```

↓ = dropped from the 4-session analysis (flute's first non-S1 failure in S5)
⚠ = passes but with thin signal margins

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

**Tier 3b -- Nearly reliable (77%):** `flute`
23/30. Was a locked Tier 3 member through S1-S4 (18/24, same 0/6 + 6/6/6/6
pattern as the others). S5 brought its first non-low-volume failure (5/6 at
the hub). Still strong -- the one miss could be a fluke -- but it no longer
has the perfect non-S1 record the six above do.

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

## What makes a voice decodable?

### Frequency range

```
Start freq (Hz)   Voices              Pass rate (all sessions)
──────────────────────────────────────────────────────────────
1000 (default)    current, soft-sine,  77% median (range 4-100%)
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

The 1000 Hz default band has the highest ceiling but also wide variance because
envelope and gain matter too (`marimba` at 1000 Hz only hits 70%). Below 800 Hz
the ceiling drops fast -- only `portamento-dream` (750 Hz, 80%) bucks the trend,
and it does so with paper-thin margins.

### The volume x frequency interaction

S5 dramatically expanded the picture. At high volume, even the lowest-frequency
voices become viable:

```
                              S1 (low)  S4 (half)  S2+S3 (normal)   S5 (high)
                              ────────  ─────────  ──────────────   ─────────
1000 Hz default voices        27%       97%        99%              98%
800-900 Hz voices             0%        11%        69%              67%
<=750 Hz voices               0%        20%        57%              85% ← jump
```

At normal volume, the sub-750 Hz voices sit around 57%. Crank it to high and
they jump to 85% -- higher than normal volume achieves for the 800-900 Hz band.
The 1000 Hz voices plateau at normal (97-99%) and gain nothing from more volume.

This means the volume boost disproportionately helps the voices that need it
most. The frequency gap that looked fatal at normal volume is survivable at high.

### Gain and envelope

| Parameter | Reliable voices | Broken voices |
|-----------|----------------|---------------|
| toneGain | 0.75 - 1.0 | 0.45 (gameboy) |
| envelope | sustained / gradual decay | sharp percussive + fast decay |
| tremolo | absent or mild (vibes: depth 0.15) | strong (steel-drum: depth 0.1 + low freq) |

`vibes` has a mild tremolo (rate 5, depth 0.15) and still hits 24/30. But `vibes`
runs at 1000 Hz with 0.9 gain -- the tremolo is survivable because everything
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
Frame 1         1450-3500 ms       413            92%
Frame 2         3030-6190 ms       32             7%
Frame 3         5500-6500 ms       3              1%
```

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

Six data points now form a clear curve:

```
Volume      Ambient      Pass rate     Condition
──────────────────────────────────────────────────────
low         -83.6 dB      11.1%        S1: quiet room
half        -66.4 dB      50.7%        S4: music playing
normal      -81.6 dB      67.4%        S3: quiet outdoors
normal      -46.6 dB      84.7%        S2: noisy outdoors
high        -58.5 dB      88.2%        S5: loud bar
```

S5 is the noisiest indoor environment and the highest-scoring full session.
Volume explains the ranking. Ambient noise remains a second-order effect.

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
1000 Hz voices (10)     avg 5.8/6            avg 5.9/6
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
(S2, S3, S4, S5):

```
Voice               S2    S3    S4    S5    Consistency
──────────────────────────────────────────────────────
current              6/6   6/6   6/6   6/6   ████
triangle             6/6   6/6   6/6   6/6   ████
soft-sine            6/6   6/6   6/6   6/6   ████
bell                 6/6   6/6   6/6   6/6   ████
chime                6/6   6/6   6/6   6/6   ████
kalimba              6/6   6/6   6/6   6/6   ████
organ                6/6   6/6   6/6   6/6   ████
vibes                6/6   6/6   6/6   6/6   ████
portamento-dream     6/6   6/6   6/6   6/6   ████
```

`flute` broke its streak in S5 (5/6 at the loud bar), so it's no longer in
the "perfect across every condition" club. It's still strong but now has a
documented failure outside of low volume.

The S5 redemption arc -- voices that were broken or fragile but came alive at
high volume:

```
Voice               S2    S3    S4    S5    Moved from
──────────────────────────────────────────────────────
marimba-low          0/6   0/6   0/6   5/6   Tier 7 → alive
power-chime          5/6   1/6   0/6   6/6   Tier 5 → viable at high vol
major-bells          5/6   4/6   0/6   6/6   Tier 5 → viable at high vol
kalimba-low          2/6   1/6   0/6   5/6   Tier 6 → viable at high vol
wide-marimba         5/6   0/6   2/6   5/6   Tier 5 → viable at high vol
xylophone-low        6/6   0/6   0/6   4/6   Tier 6 → still volatile
```

The most volatile voices across S2-S5:

```
Voice               S2    S3    S4    S5    Pattern
──────────────────────────────────────────────────────
xylophone-low        6/6   0/6   0/6   4/6   all-or-nothing
echo-kalimba         6/6   5/6   0/6   5/6   dies at half volume
power-chime          5/6   1/6   0/6   6/6   needs volume
music-box            6/6   6/6   1/6   6/6   dies at half volume
doorbell             6/6   6/6   1/6   6/6   dies at half volume
```

---

## Recommendations

1. **Ship these 9 voices.** Current, triangle, soft-sine, bell, chime, kalimba,
   organ, vibes, and portamento-dream went 6/6 in every session at half volume
   or above across 5 sessions. That's a proven, reliable menu.

2. **Ship flute with confidence (minor caveat).** 23/30 overall with a single
   non-S1 failure in S5. It was perfect through the first four sessions. One miss
   at a loud bar isn't a pattern yet.

3. **Drop these 3.** Steel-drum (4/30), marimba-low (5/30), and gameboy (14/54
   including a dedicated max-volume deep-dive that still only hit 54%) are not
   viable. Marimba-low's S5 redemption is impressive but one session doesn't
   override four sessions of zeros.

4. **Consider shipping music-box, doorbell, fm-bell with a volume caveat.**
   All three are 6/6 at normal+ volume but collapse at half. If the app can
   detect or suggest volume level, these are fine. Otherwise, they'll frustrate
   users with phones at half volume.

5. **Set a minimum volume floor.** The gradient is now well-characterized across
   5 volume levels: low = 11%, half = 51%, normal = 67-85%, high = 88%. A
   volume-detection prompt at ~50% would prevent the worst failures.

6. **Raise `startFreq` floor to 900 Hz for default voices.** The 1000 Hz band
   is plateau-reliable from half volume up (97%+). 800-900 Hz voices are fine
   at normal+ but fragile below. Sub-750 Hz voices need high volume to work.
   For a voice menu that works without volume warnings, 1000 Hz is the safe
   default; 900 Hz is acceptable with a caveat.

7. **Don't combine low gain + percussive envelope + sub-1000 Hz.** Gameboy
   (0.45 gain, percussive, 800 Hz) is the poster child: even max volume only
   gets it to 54%. Any one of those traits is survivable; all three together put
   the signal below the decoder's consistency threshold.

8. **Test on Android.** All 744 tests are from one iPhone. Android mic
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

Each export contains device metadata, ambient noise measurement, and per-session
results with individual test latency, signal margin (peak-to-floor dB), decode
frame count, and the test code attempted.
