# Tensies Sonic Brand — Research & Recommendations

The audio-sharing feature is the one moment where **Tensies makes a sound in
the world**. Right now that sound is, by the README's own admission, a
"robotic chirp" — purely functional FSK. This document researches what makes a
sound *memorable* (the PlayStation startup, Netflix's "ta-dum," the Intel bong)
and turns it into recommendations that fit inside what the decoder will actually
tolerate, as measured across seven field-test sessions (see `ANALYSIS.md`).

The headline: **don't try to make the data tones catchy — they can't be both
high-capacity and musical in a phone-decodable band, and a sound that changes
every time can't be a brand anyway. Spend the entire memory budget on a *fixed*
mnemonic that bookends the chirps and replays at every touchpoint.**

---

## 1. What the research says makes a sonic logo stick

Synthesizing sonic-branding literature and the canonical examples:

| Principle | What it means | Evidence |
|-----------|---------------|----------|
| **Brevity** | The hook is 2-5 notes, ~0.4-3 seconds. | Netflix "ta-dum" = 2 notes, <1s. NBC chimes = 3 notes (G-E-C). McDonald's / Intel = 5 notes. |
| **Familiar shape + one surprise** | Enough predictability to feel comfortable, one unexpected interval to lodge in memory. | A repeatedly cited design formula for memorable logos. |
| **Consistency / repetition** | Recall is *cumulative* — the same motif, unchanged, across every touchpoint. Variable sounds don't build memory. | The PlayStation and THX sounds are identical every single time. |
| **Emotional congruence** | Timbre and mood must match the brand. | THX = awe; Netflix = anticipation. Tensies = a loud, social, celebratory bar game → bright, major, playful. |
| **Doubles as function** | The best startup sounds *confirm a state* as well as brand. | The PlayStation chime only plays on a clean boot — it's literally a success signal. THX/Deep Note signals "the system works." |
| **Multi-sensory pairing** | Sound + a synchronized visual flourish reinforce each other. | Tensies already animates equalizer bars (`eq-icon.js`) on the Play/Listen buttons. |

The through-line: **a sonic logo is short, fixed, emotionally on-brand, and
reused relentlessly.** The PlayStation startup is iconic because it is *always
the same* and it *means "it worked."*

---

## 2. The technical envelope (what the decoder tolerates)

From `static/js/audio-share.js` and the field tests:

- **Production band:** START 1800 Hz, letters **1860-3360 Hz** (26 symbols, 60 Hz
  apart), separator 3420, end 3480. FFT bins ≈ 23 Hz, so symbols sit ~2.6 bins
  apart. Tones are 150 ms; the frame repeats 4× (~7 s).
- **The reliable design space** (60/60 in every non-low-volume session): keep the
  **1800 Hz band**, a clean **sine/triangle** wave, short tones, **no reverb**,
  **no square wave**, gain ≥ 0.8. Warm-but-clean voices that tested at ~100%:
  `triangle`, `kalimba`, `marimba`, `current` (pure sine).
- **What breaks decode:** lowering the band below ~900 Hz, long ringing/bell
  envelopes, reverb tails, square-wave harmonics — all cause letter-boundary
  smearing (the failure mode is *segmentation*, not loudness; see ANALYSIS).

### The key consequence: 26 musical tones don't fit

To sound *musical*, notes need ≥ ~1 semitone (~6%) spacing. 26 letters at a
semitone each spans **>2 octaves** (1860 → ~7600 Hz) — far above the phone
speaker/mic's decodable ceiling (the field tests show even 2880 Hz hurts). In
the reliable <1-octave band (1860-3360 Hz), 26 symbols are forced to **sub-
semitone, microtonal** spacing. That microtonality *is* the "robotic chirp."

**So the per-letter data stream cannot be made genuinely musical without either
shrinking the alphabet or pushing frequencies past the decode ceiling.** That's
fine — because the data stream is *variable*, it could never be the brand hook
anyway. The brand lives in the **fixed** parts.

---

## 3. Recommendations (ranked by feasibility × payoff)

### A. Ship a fixed "ta-dum" success sting — the single highest-ROI change
When a code successfully decodes on the receiving phone, play a short, resolving
**3-note major flourish** (~0.6-0.8 s). This is pure UI audio on the *receiver*
after decode — **zero decoder constraints, a few lines of `OscillatorNode`
scheduling**, and it's the Tensies analog of the PlayStation "it worked!" chime:
it confirms success *and* brands the moment. This is the sound people will
associate with "I joined the game."

### B. Add a fixed pre-roll mnemonic before the chirps
Prepend a short **2-note rising motif** (~250-350 ms) to every transmission,
*before* the 1800 Hz START tone. It (1) signals "a code is coming, start
listening," (2) gives the receiver's AGC/decoder a beat to settle, and (3) is
the recognizable "open" of the brand gesture. The decoder arms only on 6
consecutive polls of 1800 Hz (`START_RUN`), so a warm mid-band motif (e.g.
~390 → ~590 Hz) won't false-trigger it. The intro (rise) + sting (resolve)
turn the ~7 s of chirps into a *sentence with a satisfying period*.

### C. Reuse the motif everywhere — that's what makes it a brand
The same hook (or fragments of it) should play on: the host's **Play** tap, the
guest's **successful Listen**, and ideally a **round-win** in the game itself.
Recall is cumulative; one consistent motif across touchpoints is worth more than
several clever one-offs. Sync each to the existing `eq-icon.js` bar animation
for the multi-sensory reinforcement.

### D. Make the data chirps *warm*, not grating (keep them decodable)
The data tones can't be a melody, but they don't have to sound robotic. Switch
the default transmission timbre from pure sine to a **warm, clean pluck**
(`triangle`/`kalimba`/`marimba` profiles — all ~100% on the 1800 Hz band). Same
FSK, same reliability, friendlier texture. No reverb, no bell tails (those break
decode). This is a one-line voice swap with field-test backing.

### E. (Bolder, optional) Make the *codes themselves* hummable
If the product can restrict join codes to a **smaller, scale-friendly alphabet**,
the data stream itself becomes musical. ~8 symbols mapped to a scale across
1860-3360 Hz land ~1.3 semitones apart — pleasant and decodable — and still give
8⁵ ≈ 33,000 codes. (Pentatonic mapping is the standard trick for making random
data sound consonant.) Trade-off: it changes code generation and the manual /
SMS join path (fewer, curated characters), so it's a product decision, not a
drop-in. A 5-symbol pentatonic would be purely musical but only 3,125 codes —
too few. **Recommended only if shrinking the alphabet is acceptable elsewhere.**

### F. A failure sound that doesn't punish
On timeout/no-decode, a soft **2-note descending** cue (not a harsh buzzer).
Keep the emotional register friendly — the bar is loud and missed decodes are
common; don't make the user feel scolded.

---

## 4. A concrete starter motif (all technically feasible today)

A bright, major, "familiar shape + one surprise," in a warm human register
distinct from the high data band so people hear *branding*, not *data*:

```
Intro (pre-roll, on Play / before chirps):   G4 → D5        (rise, a perfect 5th up)
                                              392 → 587 Hz   ~300 ms, triangle/marimba

Success sting (on decode):                    D5 → G5 → B5   (resolve up to a major 3rd)
                                              587 → 784 → 988 Hz  ~700 ms, triangle/marimba

Failure cue (on timeout):                     G4 → D4        (gentle fall)
                                              392 → 294 Hz   ~350 ms, soft sine
```

The "surprise" is the success sting overshooting past the octave to the bright
major third (B5) instead of resolving plainly home — hopeful and celebratory,
which fits a dice game. The intro's rising 5th is the same interval that opens
countless fanfares, so it reads instantly as "something's starting." Tune to
taste; the structure (rise → period of chirps → bright resolve) is the asset.

All three are `OscillatorNode` + `GainNode` envelopes — the exact primitive
`audio-share.js` already uses to schedule its tones. No new dependencies, no
decoder changes, no build step.

---

## 5. Feasibility & effort

| Idea | Decoder risk | Effort | Payoff |
|------|--------------|--------|--------|
| A. Success sting | none (post-decode UI) | ~1 hr | **highest** — the "it worked" brand moment |
| B. Pre-roll mnemonic | none (below arming freq) | ~1-2 hr | high — frames the transmission |
| C. Reuse across touchpoints | none | ~half day | high — cumulative recall |
| D. Warm data timbre | none (field-tested) | ~15 min (voice swap) | medium — kills the "robotic" feel |
| F. Friendly failure cue | none | ~30 min | medium — tone/polish |
| E. Musical codes (8-sym alphabet) | low if band kept | days (touches code gen + join) | high but invasive |

---

## 6. What to validate

- **A/B the motif for recognition**, not just "do people like it" — play it cold
  a day later and see if they place it. That's the only real test of a mnemonic.
- **Confirm the pre-roll doesn't arm the decoder** (it shouldn't: different band,
  `START_RUN` = 6 consecutive 1800 Hz polls) with a quick two-client harness run.
- **Re-run the field harness** on the warm-timbre default to confirm it holds the
  1800 Hz band's ~100% (expected — `triangle`/`marimba` already did).
- Keep the motif **fixed forever** once chosen. The entire value is consistency;
  resist the urge to "freshen" it.

---

## Sources

- [Cognitive Principles for the Design of Successful Sonic Logos — Expert Journal of Marketing](https://marketing.expertjournals.com/23446773-1108/)
- [Sonic Mnemonics: Amplifying Brand Recall — MusikVergnuegen](https://www.musikvergnuegen.com/branding/mnemonics)
- [Sonic Branding Frameworks — A-MNEMONIC](https://a-mnemonic.com/sonic-branding-frameworks/)
- [How the PlayStation startup sounds were created — SVG](https://www.svg.com/1166714/how-takafumi-fujisawa-and-his-teams-created-the-classic-startup-sounds-for-playstation/)
- [Deep Note (THX) — Wikipedia](https://en.wikipedia.org/wiki/Deep_Note)
- [NBC chimes — Wikipedia](https://en.wikipedia.org/wiki/NBC_chimes)
- [The story behind Netflix's "Ta-Dum" — IndieWire](https://www.indiewire.com/features/general/what-netflix-ta-dum-sound-logo-comes-from-1234578100/)
- [McDonald's "I'm Lovin' It" and the sonic-branding revolution — Salon / 20K Hz](https://www.salon.com/2021/02/26/mcdonalds-im-lovin-it-origin-story-20k-hertz/)
- [The best audio logos and why they work — Creative Bloq](https://www.creativebloq.com/features/audio-logos)
- [Sonification 101: converting data into music (pentatonic mapping) — Matt Russo](https://medium.com/@astromattrusso/sonification-101-how-to-convert-data-into-music-with-python-71a6dd67751c)
