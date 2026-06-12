// @ts-check
/**
 * Audio share — transmit the 5-letter game code phone-to-phone as a short
 * melody of sine tones (simple FSK). Experimental; pure Web Audio, no deps.
 *
 * Scheme: one frequency per symbol, 60 Hz apart, in the 1.8–3.5 kHz phone
 * speaker/mic sweet spot. A frame is
 *   START · L1 · sep · L2 · sep · L3 · sep · L4 · sep · L5 · sep · CHK · END
 * where CHK is the letter at (sum of letter indices) mod 26. Tones are
 * back-to-back; the decoder segments on *frequency change*, never on
 * silence — over the air, speaker/room ringing fills any gap, so silence is
 * undetectable (measured: the previous tone stays the strongest bin right
 * through an 80 ms gap). The dedicated separator tone is what makes repeated
 * letters ("AAB…") decodable. The frame is sent 3× (~4.4 s total); the
 * decoder accepts the first frame whose checksum validates.
 *
 * Platform notes:
 * - iOS Safari: the AudioContext must be created/resumed inside the user tap,
 *   and the hardware silent switch mutes Web Audio entirely.
 * - getUserMedia requires HTTPS or localhost.
 */

const START_FREQ = 1800;
const LETTER_BASE_FREQ = 1860; // A=1860 … Z=3360
const FREQ_STEP = 60;
const SEP_FREQ = 3420; // inter-letter separator — delimits repeated letters
const END_FREQ = 3480;
const TONE_MS = 150;
const SEP_MS = 70;
const START_TONE_MS = 200;
const END_TONE_MS = 100;
const FRAME_GAP_MS = 250;
const REPEATS = 3;
const RAMP_S = 0.005; // 5 ms gain ramps — no clicks, cleaner spectrum
const TONE_GAIN = 0.6;
// Measured over-air: at equal level (0.6) the separator rings louder and
// longer than the letters and steals their polls; at 0.15 it loses the
// frequency race entirely and repeated letters merge. 0.4 (~3.5 dB down)
// leaves the letters dominant while the separator still wins its own slot.
const SEP_GAIN = 0.4;

const BAND_LOW_HZ = 1700;
const BAND_HIGH_HZ = 3600;
// 2048 samples ≈ 43 ms at 48 kHz — short enough to fit inside one tone,
// wide enough (~23 Hz bins) to separate symbols.
const FFT_SIZE = 2048;
const SIGNAL_MIN_DB = -70; // absolute floor for "there is a tone"
// Measured over-air: real tones sit 40+ dB over the band median; ambient
// peaks only ~15 dB over. 18 dB cleanly splits them.
const SIGNAL_MARGIN_DB = 18;
const POLL_MS = 16;
const START_RUN = 6; // consecutive polls of START to arm a frame
const SYMBOL_RUN = 3; // consecutive polls to confirm a letter/end segment
// The separator only delimits — a false positive can't corrupt a frame the
// way a false letter can — so it confirms faster. Over-air it often wins
// only ~2 polls of its 70 ms slot (the neighbouring letters ring over it).
const SEP_RUN = 2;
const LISTEN_TIMEOUT_MS = 15000;

const CODE_LEN = 5;
const CODE_RE = /^[A-Z]{5}$/;

/** Typed failure from {@link playCode} / {@link listenForCode}. */
export class AudioShareError extends Error {
  /**
   * @param {'permission' | 'timeout' | 'aborted' | 'unsupported'} reason
   * @param {string} message
   */
  constructor(reason, message) {
    super(message);
    this.name = 'AudioShareError';
    this.reason = reason;
  }
}

/** @param {string} letter */
const letterIndex = (letter) => letter.charCodeAt(0) - 65;

/** @param {string} code */
const checksumLetter = (code) => {
  const sum = [...code].reduce((total, letter) => total + letterIndex(letter), 0);
  return String.fromCharCode(65 + (sum % 26));
};

/** Every transmissible symbol with its tone frequency. */
const SYMBOLS = [
  { symbol: 'start', freq: START_FREQ },
  ...Array.from({ length: 26 }, (_, index) => ({
    symbol: String.fromCharCode(65 + index),
    freq: LETTER_BASE_FREQ + index * FREQ_STEP,
  })),
  { symbol: 'sep', freq: SEP_FREQ },
  { symbol: 'end', freq: END_FREQ },
];

/**
 * Schedule the full 3-frame transmission of `code` on a fresh oscillator
 * wired to `destination`. Exported as a seam so a loopback test can route the
 * encoder into {@link decodeFromNode} without a speaker or mic.
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} destination
 * @param {string} code 5 uppercase letters
 * @returns {OscillatorNode} the scheduled oscillator (listen on `onended`)
 */
export function scheduleCode(ctx, destination, code, startAt = ctx.currentTime + 0.05) {
  if (!CODE_RE.test(code)) throw new Error(`not a game code: ${code}`);

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  gain.gain.setValueAtTime(0, startAt);
  osc.connect(gain);
  gain.connect(destination);

  /** @type {{ freq: number, ms: number, level: number }[]} */
  const tones = [{ freq: START_FREQ, ms: START_TONE_MS, level: TONE_GAIN }];
  [...code, checksumLetter(code)].forEach((letter, index) => {
    if (index > 0) tones.push({ freq: SEP_FREQ, ms: SEP_MS, level: SEP_GAIN });
    tones.push({
      freq: LETTER_BASE_FREQ + letterIndex(letter) * FREQ_STEP,
      ms: TONE_MS,
      level: TONE_GAIN,
    });
  });
  tones.push({ freq: END_FREQ, ms: END_TONE_MS, level: TONE_GAIN });

  let t = startAt;
  for (let repeat = 0; repeat < REPEATS; repeat++) {
    for (const { freq, ms, level } of tones) {
      const end = t + ms / 1000;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(level, t + RAMP_S);
      gain.gain.setValueAtTime(level, end - RAMP_S);
      gain.gain.linearRampToValueAtTime(0, end);
      t = end;
    }
    t += FRAME_GAP_MS / 1000;
  }

  osc.start(startAt);
  osc.stop(t);
  return osc;
}

/**
 * Play the game code through the speaker. Must be called from a user
 * gesture (iOS). Resolves when playback finishes.
 * @param {string} code 5 uppercase letters
 */
export async function playCode(code) {
  if (typeof AudioContext === 'undefined') {
    throw new AudioShareError('unsupported', 'Web Audio is not supported here');
  }
  const ctx = new AudioContext();
  try {
    await ctx.resume();
    await new Promise((resolve) => {
      scheduleCode(ctx, ctx.destination, code).onended = () => resolve(undefined);
    });
  } finally {
    await ctx.close().catch(() => {});
  }
}

/**
 * Decode a code from any audio source node (mic, or a loopback from
 * {@link scheduleCode} for testing). Resolves with the 5-letter code on the
 * first checksum-valid frame.
 * @param {AudioNode} source
 * @param {{ signal?: AbortSignal, timeoutMs?: number }} [options]
 * @returns {Promise<string>}
 */
export function decodeFromNode(source, { signal, timeoutMs = LISTEN_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const ctx = source.context;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    // Default smoothing (0.8) smears adjacent symbols together.
    analyser.smoothingTimeConstant = 0;
    source.connect(analyser);

    const bins = new Float32Array(analyser.frequencyBinCount);
    const hzPerBin = ctx.sampleRate / analyser.fftSize;
    const lowBin = Math.floor(BAND_LOW_HZ / hzPerBin);
    const highBin = Math.min(Math.ceil(BAND_HIGH_HZ / hzPerBin), bins.length - 1);
    // Each symbol's frequency, mapped once to its nearest FFT bin.
    const symbolBins = SYMBOLS.map(({ symbol, freq }) => ({
      symbol,
      bin: Math.round(freq / hzPerBin),
    }));

    /** @type {string | null} current raw run ('silence' for null detections) */
    let runSymbol = null;
    let runLength = 0;
    /** @type {string | null} last *confirmed* segment — dedupes flicker re-confirms */
    let lastSegment = null;
    let collecting = false;
    let letters = '';

    /** @param {() => void} settle */
    const cleanup = (settle) => {
      clearInterval(poller);
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      try {
        source.disconnect(analyser);
      } catch {
        // Source may already be gone (mic track stopped) — nothing to undo.
      }
      settle();
    };

    const onAbort = () =>
      cleanup(() => reject(new AudioShareError('aborted', 'listening cancelled')));

    const timer = setTimeout(
      () => cleanup(() => reject(new AudioShareError('timeout', 'no code heard'))),
      timeoutMs,
    );

    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener('abort', onAbort);

    /**
     * Strongest symbol this poll, or 'silence'. Scores each symbol by the
     * energy at its own bin (±1 for leakage) rather than peak-picking — bin
     * quantization can land a raw peak between two symbol frequencies.
     */
    const detect = () => {
      analyser.getFloatFrequencyData(bins);
      let best = 'silence';
      let bestDb = -Infinity;
      for (const { symbol, bin } of symbolBins) {
        const db = Math.max(bins[bin - 1], bins[bin], bins[bin + 1]);
        if (db > bestDb) {
          bestDb = db;
          best = symbol;
        }
      }
      // Noise floor: median of the whole band this poll.
      const band = [...bins.subarray(lowBin, highBin + 1)].sort((a, b) => a - b);
      const floor = band[band.length >> 1];
      if (bestDb < SIGNAL_MIN_DB || bestDb < floor + SIGNAL_MARGIN_DB) return 'silence';
      return best;
    };

    /**
     * A segment held long enough to be real. Segments are delimited by
     * frequency *change* — never silence (see module docs).
     * @param {string} segment
     */
    const confirmSegment = (segment) => {
      if (segment === lastSegment) return; // flicker rejoined the same segment
      lastSegment = segment;
      if (segment === 'silence' || segment === 'sep') return; // delimiters only
      if (segment === 'start') {
        collecting = true;
        letters = '';
        return;
      }
      if (!collecting) return;
      if (segment === 'end') {
        const code = letters.slice(0, CODE_LEN);
        if (letters.length === CODE_LEN + 1 && letters[CODE_LEN] === checksumLetter(code)) {
          cleanup(() => resolve(code));
        } else {
          collecting = false; // bad frame — wait for the next repetition
          letters = '';
        }
        return;
      }
      letters += segment;
      if (letters.length > CODE_LEN + 1) {
        collecting = false;
        letters = '';
      }
    };

    const poller = setInterval(() => {
      const symbol = detect();
      if (symbol === runSymbol) {
        runLength++;
      } else {
        runSymbol = symbol;
        runLength = 1;
      }
      let needed = SYMBOL_RUN;
      if (symbol === 'start') needed = START_RUN;
      if (symbol === 'sep') needed = SEP_RUN;
      if (runLength === needed) confirmSegment(symbol);
    }, POLL_MS);
  });
}

/**
 * Ask for the microphone and listen for a transmitted game code.
 * Rejects with {@link AudioShareError} (`reason`: 'permission' | 'timeout' |
 * 'aborted' | 'unsupported').
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<string>}
 */
export async function listenForCode({ signal } = {}) {
  if (typeof AudioContext === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new AudioShareError('unsupported', 'Microphone capture is not supported here');
  }
  /** @type {MediaStream} */
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      // Mobile voice processing eats pure tones — turn it all off.
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (err) {
    if (signal?.aborted) throw new AudioShareError('aborted', 'listening cancelled');
    throw new AudioShareError('permission', `microphone unavailable: ${err}`);
  }

  const ctx = new AudioContext();
  try {
    await ctx.resume();
    return await decodeFromNode(ctx.createMediaStreamSource(stream), { signal });
  } finally {
    for (const track of stream.getTracks()) track.stop();
    await ctx.close().catch(() => {});
  }
}
