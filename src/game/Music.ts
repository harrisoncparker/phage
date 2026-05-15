import { getAudioContext } from './Sound';

// D minor jazz: Dm7 – Bbmaj7 – Fmaj7 – Am7
const CHORDS_HZ: number[][] = [
  [146.83, 174.61, 220.00, 261.63],
  [116.54, 146.83, 174.61, 220.00],
  [ 87.31, 110.00, 130.81, 164.81],
  [110.00, 130.81, 164.81, 196.00],
];
const BASS_HZ = [73.42, 58.27, 87.31, 110.00];

const PHRASES_HZ: (number | null)[][] = [
  [293.66, null,   261.63, 220.00],
  [293.66, 349.23, null,   293.66],
  [261.63, null,   220.00, 261.63],
  [329.63, 261.63, null,   220.00],
];

// 2-bar drum loop — beat = quarter-note position (0–7.75)
const DRUMS: { beat: number; t: 'kick' | 'snare' | 'hat'; v: number }[] = [
  { beat: 0,    t: 'kick',  v: 1.0  },
  { beat: 0.5,  t: 'hat',   v: 0.60 },
  { beat: 1.0,  t: 'hat',   v: 0.50 },
  { beat: 1.5,  t: 'kick',  v: 0.70 },
  { beat: 1.5,  t: 'hat',   v: 0.55 },
  { beat: 2.0,  t: 'snare', v: 1.0  },
  { beat: 2.0,  t: 'hat',   v: 0.50 },
  { beat: 2.5,  t: 'hat',   v: 0.55 },
  { beat: 3.0,  t: 'kick',  v: 0.65 },
  { beat: 3.0,  t: 'hat',   v: 0.50 },
  { beat: 3.25, t: 'snare', v: 0.25 },
  { beat: 3.5,  t: 'hat',   v: 0.55 },
  { beat: 3.75, t: 'snare', v: 0.20 },
  { beat: 4.0,  t: 'kick',  v: 1.0  },
  { beat: 4.5,  t: 'hat',   v: 0.60 },
  { beat: 5.0,  t: 'hat',   v: 0.50 },
  { beat: 5.5,  t: 'hat',   v: 0.55 },
  { beat: 5.75, t: 'kick',  v: 0.60 },
  { beat: 6.0,  t: 'snare', v: 1.0  },
  { beat: 6.0,  t: 'hat',   v: 0.50 },
  { beat: 6.5,  t: 'hat',   v: 0.55 },
  { beat: 6.75, t: 'kick',  v: 0.55 },
  { beat: 7.0,  t: 'hat',   v: 0.50 },
  { beat: 7.25, t: 'snare', v: 0.28 },
  { beat: 7.5,  t: 'hat',   v: 0.55 },
  { beat: 7.75, t: 'kick',  v: 0.50 },
];

export interface MusicState {
  enemyCount:  number;
  hearts:      number;
  maxHearts:   number;
  inCountdown: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const BPM         = 170;
const BEAT        = 60 / BPM;
const BAR2        = BEAT * 8;    // 2 bars = one chord slot
const LOOKAHEAD_S = 0.3;
const TICK_MS     = 25;

// ── Module state ──────────────────────────────────────────────────────────────
let built    = false;
let running  = false;
let isPaused = false;
let startAC  = 0;   // audioCtx.currentTime at (re)start
let elapsed  = 0;   // transport seconds accumulated before current run

let timer: ReturnType<typeof setTimeout> | null = null;

let nextChordT  = 0;
let nextChordI  = 0;
let nextMelT    = 0;
let melStep     = 0;
let drumCursors: number[] = [];

let padGain:  GainNode;
let bassGain: GainNode;
let drumGain: GainNode;
let melGain:  GainNode;
let tensGain: GainNode;

let snareBuffer: AudioBuffer;
let hatBuffer:   AudioBuffer;
let tensOscs:    OscillatorNode[] = [];

let lastEnemies = -1;
let lastHearts  = -1;
let lastCdwn    = false;

// ── Build (once) ──────────────────────────────────────────────────────────────
function build(): void {
  if (built) return;
  built = true;

  const c = getAudioContext();

  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value      = 8;
  comp.ratio.value     = 4;
  comp.attack.value    = 0.005;
  comp.release.value   = 0.2;
  const master = c.createGain();
  master.gain.value = 0.28;
  master.connect(c.destination);
  comp.connect(master);

  padGain  = c.createGain(); padGain.gain.value  = 0.42; padGain.connect(comp);
  bassGain = c.createGain(); bassGain.gain.value = 0;    bassGain.connect(comp);
  drumGain = c.createGain(); drumGain.gain.value = 0;    drumGain.connect(comp);
  melGain  = c.createGain(); melGain.gain.value  = 0;    melGain.connect(comp);
  tensGain = c.createGain(); tensGain.gain.value = 0;    tensGain.connect(comp);

  // Pre-bake noise buffers — avoids allocations on every drum hit
  const sLen = Math.ceil(c.sampleRate * 0.25);
  snareBuffer = c.createBuffer(1, sLen, c.sampleRate);
  const sData = snareBuffer.getChannelData(0);
  for (let i = 0; i < sLen; i++) sData[i] = Math.random() * 2 - 1;

  const hLen = Math.ceil(c.sampleRate * 0.08);
  hatBuffer = c.createBuffer(1, hLen, c.sampleRate);
  const hData = hatBuffer.getChannelData(0);
  for (let i = 0; i < hLen; i++) hData[i] = Math.random() * 2 - 1;

  // Tension oscillators run permanently; volume via tensGain
  [164.81, 207.65, 246.94].forEach(freq => {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(tensGain);
    osc.start();
    tensOscs.push(osc);
  });
}

// ── Synthesis ─────────────────────────────────────────────────────────────────

function scheduleKick(at: number, v: number): void {
  const c = getAudioContext();
  const osc = c.createOscillator();
  const g   = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, at);
  osc.frequency.exponentialRampToValueAtTime(0.01, at + 0.4);
  g.gain.setValueAtTime(v * 0.9, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);
  osc.connect(g); g.connect(drumGain);
  osc.start(at); osc.stop(at + 0.5);
}

function scheduleSnare(at: number, v: number): void {
  const c   = getAudioContext();
  const src = c.createBufferSource();
  const f   = c.createBiquadFilter();
  const g   = c.createGain();
  src.buffer = snareBuffer;
  f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7;
  g.gain.setValueAtTime(v * 0.55, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
  src.connect(f); f.connect(g); g.connect(drumGain);
  src.start(at); src.stop(at + 0.25);
}

function scheduleHat(at: number, v: number): void {
  const c   = getAudioContext();
  const src = c.createBufferSource();
  const f   = c.createBiquadFilter();
  const g   = c.createGain();
  src.buffer = hatBuffer;
  f.type = 'highpass'; f.frequency.value = 8000;
  g.gain.setValueAtTime(v * 0.22, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
  src.connect(f); f.connect(g); g.connect(drumGain);
  src.start(at); src.stop(at + 0.1);
}

function scheduleChord(ci: number, at: number): void {
  const c = getAudioContext();
  CHORDS_HZ[ci].forEach((freq, i) => {
    const osc = c.createOscillator();
    const g   = c.createGain();
    osc.type = 'sine';
    osc.detune.value    = i % 2 === 0 ? -8 : 8;
    osc.frequency.value = freq;
    const dur = BAR2 + 3.5;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(0.16, at + 1.8);
    g.gain.linearRampToValueAtTime(0, at + dur);
    osc.connect(g); g.connect(padGain);
    osc.start(at); osc.stop(at + dur + 0.1);
  });
}

function scheduleBass(ci: number, at: number): void {
  const c   = getAudioContext();
  const osc = c.createOscillator();
  const g   = c.createGain();
  osc.type = 'triangle';
  osc.frequency.value = BASS_HZ[ci];
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(0.75, at + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, at + BAR2 + 0.5);
  osc.connect(g); g.connect(bassGain);
  osc.start(at); osc.stop(at + BAR2 + 0.6);
}

function scheduleMelody(hz: number, at: number): void {
  const c   = getAudioContext();
  const osc = c.createOscillator();
  const g   = c.createGain();
  osc.type = 'triangle';
  osc.frequency.value = hz;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(0.55, at + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
  osc.connect(g); g.connect(melGain);
  osc.start(at); osc.stop(at + 0.55);
}

// ── Scheduler (Chris Wilson lookahead pattern) ────────────────────────────────

function tp(): number {
  return isPaused ? elapsed : elapsed + (getAudioContext().currentTime - startAC);
}

function toAC(t: number): number {
  return startAC + (t - elapsed);
}

function scheduleNext(): void {
  const c       = getAudioContext();
  const horizon = tp() + LOOKAHEAD_S;

  // Chords + bass — one event per BAR2
  while (nextChordT <= horizon) {
    const at = toAC(nextChordT);
    if (at >= c.currentTime - 0.01) {
      scheduleChord(nextChordI, at);
      scheduleBass(nextChordI, at);
    }
    nextChordI = (nextChordI + 1) % 4;
    nextChordT += BAR2;
  }

  // Melody — quarter-note grid; chord derived from melStep count
  while (nextMelT <= horizon) {
    const at   = toAC(nextMelT);
    const ci   = Math.floor(melStep / 8) % 4;
    const note = PHRASES_HZ[ci][melStep % 4];
    if (at >= c.currentTime - 0.01 && note !== null) scheduleMelody(note, at);
    melStep++;
    nextMelT += BEAT;
  }

  // Drums — each event has independent cursor, loops every BAR2
  for (let i = 0; i < DRUMS.length; i++) {
    while (drumCursors[i] <= horizon) {
      const at = toAC(drumCursors[i]);
      if (at >= c.currentTime - 0.01) {
        const ev = DRUMS[i];
        if (ev.t === 'kick')  scheduleKick(at, ev.v);
        if (ev.t === 'snare') scheduleSnare(at, ev.v);
        if (ev.t === 'hat')   scheduleHat(at, ev.v);
      }
      drumCursors[i] += BAR2;
    }
  }
}

function tick(): void {
  if (!running || isPaused) return;
  scheduleNext();
  timer = setTimeout(tick, TICK_MS);
}

function ramp(g: GainNode, target: number): void {
  const now = getAudioContext().currentTime;
  g.gain.cancelScheduledValues(now);
  g.gain.setValueAtTime(g.gain.value, now);
  g.gain.linearRampToValueAtTime(target, now + 1.5);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function startMusic(): Promise<void> {
  build();
  const c = getAudioContext();
  if (c.state !== 'running') await c.resume();

  running  = true;
  isPaused = false;
  elapsed  = 0;
  startAC  = c.currentTime;

  nextChordT  = 0;
  nextChordI  = 0;
  nextMelT    = 0;
  melStep     = 0;
  drumCursors = DRUMS.map(ev => ev.beat * BEAT);

  lastEnemies = -1;
  lastHearts  = -1;
  lastCdwn    = false;

  bassGain.gain.value = 0;
  drumGain.gain.value = 0;
  melGain.gain.value  = 0;
  tensGain.gain.value = 0;

  tick();
}

export function pauseMusic(): void {
  if (!running || isPaused) return;
  isPaused = true;
  elapsed += getAudioContext().currentTime - startAC;
  if (timer !== null) { clearTimeout(timer); timer = null; }
}

export function resumeMusic(): void {
  if (!running || !isPaused) return;
  isPaused = false;
  startAC  = getAudioContext().currentTime;
  tick();
}

export function stopMusic(): void {
  running  = false;
  isPaused = false;
  if (timer !== null) { clearTimeout(timer); timer = null; }
}

export function updateMusic(state: MusicState): void {
  if (!built || !running) return;
  const { enemyCount, hearts, inCountdown } = state;
  if (enemyCount === lastEnemies && hearts === lastHearts && inCountdown === lastCdwn) return;
  lastEnemies = enemyCount;
  lastHearts  = hearts;
  lastCdwn    = inCountdown;

  ramp(bassGain, enemyCount > 0 ? 0.60 : 0);
  ramp(drumGain, enemyCount > 2 ? Math.min(0.80, (enemyCount - 2) * 0.13) : 0);
  ramp(melGain,  enemyCount > 5 ? 0.38 : 0);

  const danger = hearts <= 1;
  ramp(tensGain, danger ? 0.32 : 0);
}
