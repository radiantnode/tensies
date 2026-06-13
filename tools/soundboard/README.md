# Audio Share Soundboard

Tensies has an experimental audio share feature: instead of typing a 5-letter game code, the host's phone chirps it as a short melody (FSK-encoded tones) and a joining player's phone decodes it through the microphone. It works, but it sounds like a modem. This soundboard exists to iterate on making it sound musical, catchy, and pleasant — the kind of sound that makes someone nearby ask "hey, what's that?" instead of wincing.

## What it does

Open `index.html` directly in a browser (no server needed). You get:

- **24 voice presets** across four categories: the current production sound, same-pitch alternatives, lower-pitched variations, and experimental voices that push the envelope (harmony layers, portamento, reverb).
- **Play** any preset with a configurable 5-letter code to hear what it sounds like.
- **Test** any preset through real speaker-to-microphone decoding — plays the code out loud, listens through the mic, and reports frame-by-frame detection results with signal levels, recovery method, and pass/fail.

## Mirrored constants from production

The soundboard duplicates a handful of constants and utilities from `static/js/audio-share.js` (the production encoder/decoder). If you change the production FSK scheme, update these in `index.html` to match:

| Soundboard constant | Production source | Value |
|---|---|---|
| `START_FREQ` | `audio-share.js:23` | 1800 |
| `LETTER_BASE_FREQ` | `audio-share.js:24` | 1860 |
| `FREQ_STEP` | `audio-share.js:25` | 60 |
| `SEP_FREQ` | `audio-share.js:26` | 3420 |
| `END_FREQ` | `audio-share.js:27` | 3480 |
| `letterIndex()` | `audio-share.js:84` | `ch.charCodeAt(0) - 65` |
| `checksumLetter()` | `audio-share.js:87-89` | `sum of indices mod 26` |

The decoder thresholds (FFT size 2048, -80 dB floor, 15 dB margin, run lengths 6/3/2) also mirror production. These are hardcoded in the soundboard's `decodeMic()` rather than imported — the soundboard extends both the encoder and decoder with per-voice frequency bands, envelope shaping, and verbose logging that the production code doesn't need.

## How to use it

1. Open `index.html` in Chrome or Safari (needs Web Audio + getUserMedia).
2. Type a code in the input field or leave the default.
3. Hit **Play** on any voice to hear it.
4. Hit **Test** to run a real speaker-to-mic decode suite (your code + tricky patterns like AABCD, ZZZZY + random codes). Grant mic permission when prompted.
5. Compare pass rates, signal margins, and how each voice *feels*.

When you find a voice worth shipping, the next step is porting its parameters back into `static/js/audio-share.js` and updating the production decoder if the frequency band changed.
