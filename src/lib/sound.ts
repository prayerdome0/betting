/**
 * Xacheus Betting — synthesized sound engine.
 *
 * All sound effects are generated with the Web Audio API (no audio files
 * needed). The AudioContext is lazily created on the first user gesture
 * (browser autoplay policy), so every sfx call is safe anywhere.
 */

const MUTE_KEY = "xacheus-sound-muted";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

try {
  muted = typeof localStorage !== "undefined" && localStorage.getItem(MUTE_KEY) === "1";
} catch {
  muted = false;
}

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => undefined);
  }
  return ctx;
}

type ToneOpts = {
  f: number; // start frequency (Hz)
  slide?: number; // glide to frequency (Hz)
  t?: number; // start offset (s)
  dur?: number; // duration (s)
  type?: OscillatorType;
  vol?: number;
};

function tone({ f, slide, t = 0, dur = 0.18, type = "sine", vol = 0.2 }: ToneOpts) {
  const c = ensure();
  if (!c || !master) return;
  const start = c.currentTime + t;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, f), start);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slide), start + dur);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(vol, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain);
  gain.connect(master);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function noise(dur = 0.3, vol = 0.3, t = 0, filterFreq = 900) {
  const c = ensure();
  if (!c || !master) return;
  const start = c.currentTime + t;
  const length = Math.max(1, Math.floor(c.sampleRate * dur));
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = filterFreq;
  const gain = c.createGain();
  gain.gain.setValueAtTime(vol, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start(start);
}

export const sfx = {
  /** Call from a click handler once to unlock audio on mobile/desktop. */
  unlock() {
    ensure();
  },

  isMuted() {
    return muted;
  },

  setMuted(value: boolean) {
    muted = value;
    try {
      localStorage.setItem(MUTE_KEY, value ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (master && ctx) master.gain.value = value ? 0 : 0.5;
  },

  toggleMuted() {
    const next = !muted;
    sfx.setMuted(next);
    return next;
  },

  /** Generic UI click. */
  click() {
    tone({ f: 640, dur: 0.05, type: "triangle", vol: 0.1 });
  },

  /** Chip placed on the table / bet slip accepted. */
  chip() {
    tone({ f: 880, dur: 0.07, type: "triangle", vol: 0.2 });
    tone({ f: 1318, dur: 0.1, t: 0.05, type: "sine", vol: 0.16 });
  },

  /** Cards being dealt / new page. */
  deal() {
    tone({ f: 520, dur: 0.08, type: "triangle", vol: 0.16 });
    tone({ f: 780, dur: 0.12, t: 0.07, type: "triangle", vol: 0.16 });
  },

  /** Coin tumbling through the air. */
  coinFlip() {
    for (let i = 0; i < 7; i++) {
      tone({ f: 620 + i * 130, slide: 480, dur: 0.09, t: i * 0.09, type: "sawtooth", vol: 0.05 });
    }
  },

  /** Coin/ball lands on the table. */
  thud() {
    tone({ f: 210, slide: 90, dur: 0.16, type: "sine", vol: 0.35 });
    noise(0.08, 0.12, 0, 500);
  },

  /** Roulette wheel clicking as it spins. */
  wheelSpin() {
    for (let i = 0; i < 16; i++) {
      tone({ f: 900 + (i % 3) * 90, dur: 0.035, t: 0.06 + i * 0.11, type: "square", vol: 0.035 });
    }
    tone({ f: 150, slide: 60, dur: 1.6, type: "sine", vol: 0.08 });
  },

  /** Dice rattling in the cup. */
  diceRoll() {
    for (let i = 0; i < 9; i++) {
      noise(0.045, 0.16, i * 0.085, 2400);
      tone({ f: 380 + i * 55, dur: 0.05, t: i * 0.085, type: "square", vol: 0.05 });
    }
    sfx.thud();
  },

  /** Plinko ball pinging off pegs. */
  plinkoDrop() {
    for (let i = 0; i < 14; i++) {
      const f = 1050 - i * 46;
      tone({ f, dur: 0.045, t: i * 0.105, type: "triangle", vol: 0.12 });
    }
  },

  /** Slot reels spinning. */
  reelSpin() {
    for (let i = 0; i < 24; i++) {
      tone({ f: 240 + Math.random() * 380, dur: 0.05, t: i * 0.055, type: "sawtooth", vol: 0.028 });
    }
  },

  /** Reel stop "clunk". */
  reelStop() {
    tone({ f: 180, slide: 70, dur: 0.13, type: "square", vol: 0.22 });
  },

  /** Mine grid scanning / digging. */
  dig() {
    noise(0.16, 0.1, 0, 1400);
    tone({ f: 500, slide: 220, dur: 0.2, type: "triangle", vol: 0.12 });
  },

  /** Gem chime. */
  gem() {
    tone({ f: 1174, dur: 0.12, type: "sine", vol: 0.18 });
    tone({ f: 1760, dur: 0.2, t: 0.07, type: "sine", vol: 0.16 });
  },

  /** Explosion (crash / mine). */
  boom() {
    noise(0.55, 0.5, 0, 700);
    tone({ f: 130, slide: 38, dur: 0.55, type: "sine", vol: 0.55 });
    tone({ f: 60, slide: 30, dur: 0.7, t: 0.02, type: "sine", vol: 0.4 });
  },

  /** Rocket whoosh during crash. */
  whoosh() {
    noise(1.2, 0.16, 0, 2600);
    tone({ f: 300, slide: 1400, dur: 1.1, type: "sawtooth", vol: 0.045 });
  },

  /** Steady ticker while crash climbs. */
  tick() {
    tone({ f: 1180, dur: 0.03, type: "square", vol: 0.05 });
  },

  /** Tower floor climbed. */
  step() {
    tone({ f: 660, dur: 0.07, type: "triangle", vol: 0.16 });
    tone({ f: 990, dur: 0.09, t: 0.05, type: "triangle", vol: 0.13 });
  },

  /** Cashout / coins dropping. */
  cashout() {
    tone({ f: 1568, dur: 0.09, type: "sine", vol: 0.22 });
    tone({ f: 2093, dur: 0.22, t: 0.08, type: "sine", vol: 0.22 });
    noise(0.12, 0.08, 0.1, 6000);
  },

  /** Modest win jingle. */
  win() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone({ f, dur: 0.16, t: i * 0.09, type: "triangle", vol: 0.2 })
    );
    tone({ f: 1318.5, dur: 0.3, t: 0.36, type: "sine", vol: 0.16 });
  },

  /** Big win fanfare. */
  bigWin() {
    [392, 523.25, 659.25, 783.99].forEach((f, i) =>
      tone({ f, dur: 0.22, t: i * 0.11, type: "triangle", vol: 0.2 })
    );
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone({ f, dur: 0.24, t: 0.44 + i * 0.11, type: "triangle", vol: 0.2 })
    );
    tone({ f: 1568, dur: 0.6, t: 0.9, type: "sine", vol: 0.14 });
  },

  /** Jackpot — the big one. */
  jackpot() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568, 2093].forEach((f, i) =>
      tone({ f, dur: 0.2, t: i * 0.09, type: "square", vol: 0.11 })
    );
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) =>
      tone({ f, dur: 0.3, t: 0.7 + i * 0.12, type: "triangle", vol: 0.2 })
    );
    noise(0.7, 0.12, 0.7, 8000);
    tone({ f: 261.6, dur: 1.1, t: 0.7, type: "sine", vol: 0.16 });
  },

  /** Loss tone. */
  loss() {
    tone({ f: 330, slide: 150, dur: 0.34, type: "sawtooth", vol: 0.16 });
    tone({ f: 200, slide: 85, dur: 0.42, t: 0.1, type: "square", vol: 0.09 });
  },

  /** Invalid action / not enough balance. */
  error() {
    tone({ f: 190, dur: 0.14, type: "square", vol: 0.14 });
    tone({ f: 150, dur: 0.2, t: 0.14, type: "square", vol: 0.14 });
  },

  /** Countdown tick (results refresh / pending). */
  countTick() {
    tone({ f: 980, dur: 0.04, type: "square", vol: 0.06 });
  },

  /** Deposit / money added. */
  deposit() {
    [659.25, 880, 1318.5, 1760].forEach((f, i) =>
      tone({ f, dur: 0.14, t: i * 0.08, type: "sine", vol: 0.18 })
    );
    noise(0.2, 0.06, 0.24, 7000);
  },
};

export default sfx;
