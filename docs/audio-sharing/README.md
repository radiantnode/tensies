# Tensies Audio Sharing

Share a game code by playing it out loud. One phone chirps a melody, the other one listens and fills in the code.

---

## Why

Tensies is a bar game. You're holding a drink, the music is loud, somebody just won a round and the table is yelling. Nobody wants to spell out a five-letter code while someone else fat-fingers it into a tiny input field.

The host taps **Play** in the lobby. Their phone plays a short melody. The person joining taps **Listen**, holds their phone vaguely in the right direction, and the code fills itself in. Two seconds in a quiet room, maybe four in a noisy one.

---

## How it works

The code goes over the air as a sequence of tones using [FSK (frequency shift keying)](https://en.wikipedia.org/wiki/Frequency-shift_keying). Same idea modems used, except here the modem is a phone speaker and the line is the air between two barstools.

Each of the 26 letters maps to a frequency: A = 1860 Hz, B = 1920 Hz, on up through Z = 3360 Hz, spaced 60 Hz apart. A separator tone (3420 Hz) goes between each letter so the decoder can tell repeated letters apart ("AABCD" would look like one long A without it). Start and end tones frame the whole thing, plus a checksum letter to catch garbled decodes.

One frame:

```
START · H · sep · E · sep · L · sep · L · sep · O · sep · CHK · END
```

The full transmission plays that frame four times over about seven seconds, giving the decoder multiple chances to lock on.

On the receiving end, the mic feeds a 2048-point FFT (~23 Hz per bin at 48 kHz). The decoder watches for the start tone, then segments on frequency changes. It never relies on silence, because over the air, room reverb fills every gap. A letter is confirmed after three consecutive polls agree. The whole decode pipeline is a state machine running at 60 Hz in the browser.

Everything happens client-side with the Web Audio API. The server never touches audio. An `OscillatorNode` handles playback; `getUserMedia` plus an `AnalyserNode` handles listening.

---

## The voice system

The default transmission sounds like a robotic chirp. It decodes perfectly, but it's not something you want to hear six times a night. The voice system lets you restyle the tones (different waveforms, envelopes, harmonics, effects) while keeping the same underlying FSK encoding.

A voice is a bag of parameters:

| Parameter | What it controls |
|-----------|-----------------|
| `wave` | Oscillator shape: sine, triangle, square, or a custom periodic wave |
| `envelope` | How the tone fades: linear, exponential, bell-shaped, percussive |
| `toneGain` | How loud the letter tones are (0.0 to 1.0) |
| `toneMs` | How long each letter tone plays |
| `overtones` | Harmonic series layered on top of the fundamental |
| `tremolo` | Amplitude vibrato (rate and depth) |
| `harmony` | Chord tones at fixed semitone offsets |
| `portamento` | Glide time between consecutive notes |
| `reverb` | Delay-based room effect |
| `startFreq` | Base frequency band (default 1800 Hz; lower is warmer but harder to decode) |

There are twenty-four voices so far, ranging from a clean sine wave to a steel drum to something called "portamento dream" that sounds like a synthesizer falling asleep. Not all of them decode reliably (see Testing below), but the ones that do give the transmission actual personality.

The live production voice is `current` (Pure Sine). Plain sine wave at full gain, linear envelope. No effects, no harmonics. It decoded at 100% across every tested condition, including low volume in a quiet room and high volume in a loud bar. Boring, but bulletproof.

---

## Testing

### The soundboard

The voice iteration tool lives at [`tools/soundboard/index.html`](https://radiantnode.github.io/tensies/tools/soundboard/). Standalone page, no build step, no server dependency. You can audition any voice through the speaker, test it with a real speaker-to-mic round trip (play the code, record through the mic, try to decode what it heard), batch-run all twenty-four voices, and export results as JSON with device metadata, ambient noise measurement, GPS, and per-test decode traces.

Each test runs six codes: whatever you typed in, plus AABCD (repeated letter), ZZZZY (heavily repeated), ABCDE (sequential), and two random codes. The mix stresses different decoder edge cases.

### Field testing

Lab conditions don't tell you much about a bar. The `fieldtests/` directory has raw JSON exports from six real-world sessions: a quiet room, a dog park near a fountain, a home office with music playing, and a loud bar with sports on TV and people talking over each other. 744 tests total, all from one iPhone. The full breakdown is in [ANALYSIS.md](ANALYSIS.md).

The short version: volume is everything. Pass rate scales from 11% at low volume to 88% at high. Ambient noise barely registers. The loudest environment scored the highest because the speaker was cranked.

Voices at the default 1000 Hz frequency band decode at 97%+ from half volume up. Drop to 800 Hz and you need full volume. Drop to 600 Hz and it's a coin flip.

Nine voices are shippable today: current, triangle, soft-sine, bell, chime, kalimba, organ, vibes, and portamento-dream. All went 6/6 in every session at half volume or above. Three are dead: gameboy got a dedicated 24-test deep-dive at max volume and still only hit 54%. Steel-drum and marimba-low are worse.

Effects eat signal margin. Reverb costs about 9 dB. Tremolo is worse. A clean waveform at 1000 Hz survives almost anything. A reverb-heavy voice at 750 Hz survives almost nothing.

All testing has been on one iPhone. Android is an open question.

---

## Layout

```
static/js/
  audio-share.js             FSK encoder + decoder (the whole protocol)
  eq-icon.js                 animated equalizer bars for the buttons
  components/
    lobby-screen.js          "Play" button (host broadcasts code)
    join-screen.js           "Listen" button (guest receives code)

tools/soundboard/
  index.html                 voice iteration + field test harness

docs/audio-sharing/
  README.md                  this file
  ANALYSIS.md                field test analysis (tiers, charts, recommendations)
  fieldtests/*.json          raw test exports
```

---

## Platform notes

iOS Safari requires the AudioContext to be created inside a user tap handler, or it won't produce sound. The silent switch also mutes Web Audio entirely, with no workaround and no way to detect it. If someone says "it plays but nothing comes out," that's probably it.

Echo cancellation, noise suppression, and auto gain control are all turned off for listening. Mobile voice processing is built to clean up speech, which means it destroys pure tones. The raw mic signal decodes better.

`getUserMedia` requires HTTPS (localhost is the exception). The play side works anywhere since it doesn't need mic access.
