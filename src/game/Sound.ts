let _ctx: AudioContext | null = null;

function ctx(): AudioContext {
  if (!_ctx) _ctx = new AudioContext();
  return _ctx;
}

export function getAudioContext(): AudioContext { return ctx(); }

// Call once on first user gesture — ensures AudioContext is running before any SFX
export async function unlockAudio(): Promise<void> {
  const c = ctx();
  if (c.state !== 'running') await c.resume();
}

function tone(
  freq: number,
  type: OscillatorType,
  peak: number,
  attackMs: number,
  decayMs: number,
  delayMs = 0,
): void {
  const c = ctx();
  const t = c.currentTime + delayMs / 1000;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(g);
  g.connect(c.destination);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attackMs / 1000);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (attackMs + decayMs) / 1000);
  osc.start(t);
  osc.stop(t + (attackMs + decayMs) / 1000 + 0.05);
}

function noise(peak: number, attackMs: number, decayMs: number, delayMs = 0): void {
  const c = ctx();
  const t = c.currentTime + delayMs / 1000;
  const dur = (attackMs + decayMs) / 1000 + 0.05;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  src.connect(g);
  g.connect(c.destination);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attackMs / 1000);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (attackMs + decayMs) / 1000);
  src.start(t);
  src.stop(t + dur);
}

// D minor pentatonic
const N = {
  D1: 36.71,  A1: 55.00,
  D2: 73.42,  F2: 87.31,  G2: 98.00,  A2: 110.00,
  C3: 130.81, D3: 146.83, F3: 174.61, G3: 196.00, A3: 220.00,
  C4: 261.63, D4: 293.66, F4: 349.23, A4: 440.00,
  D5: 587.33,
};

export const SFX = {
  // ── POSITIVE ──────────────────────────────────────────────────────────────
  playerFire() {
    tone(N.D4, 'triangle', 0.22, 4, 110);
  },
  enemyHit() {
    tone(N.A2, 'sine',     0.38, 4,  90);
    tone(N.D4, 'triangle', 0.18, 3,  50);
  },
  enemyDie() {
    tone(N.D4, 'triangle', 0.28, 4, 110);
    tone(N.A3, 'triangle', 0.28, 4, 110,  90);
    tone(N.D3, 'triangle', 0.28, 4, 160, 180);
  },
  shieldActivate() {
    tone(N.D3, 'sine', 0.18, 18, 130);
    tone(N.F3, 'sine', 0.18, 18, 130,  60);
    tone(N.A3, 'sine', 0.20, 18, 190, 120);
  },
  upgradeUnlock() {
    tone(N.D3, 'triangle', 0.28, 8, 260);
    tone(N.F3, 'triangle', 0.28, 8, 260, 100);
    tone(N.A3, 'triangle', 0.28, 8, 260, 200);
    tone(N.D4, 'triangle', 0.35, 8, 400, 300);
  },
  runSurvived() {
    [N.D3, N.F3, N.G3, N.A3, N.C4, N.D4].forEach((f, i) =>
      tone(f, 'triangle', 0.28, 8, 210, i * 85)
    );
  },

  // ── NEGATIVE ──────────────────────────────────────────────────────────────
  playerDamage() {
    tone(N.D1, 'sine', 0.55, 4, 240);
    noise(0.32, 3, 65);
  },
  enemyProjectileHits() {
    tone(N.A1, 'sine', 0.48, 4, 200);
    noise(0.24, 3, 55);
  },
  shieldAbsorb() {
    noise(0.38, 3, 95);
    tone(N.G2, 'sine', 0.28, 3, 85);
  },
  shieldDeactivate() {
    tone(N.A3, 'sine', 0.14, 18, 100);
    tone(N.F3, 'sine', 0.14, 18, 100,  60);
    tone(N.D3, 'sine', 0.14, 18, 150, 120);
  },
  playerDie() {
    [N.D3, N.A2, N.F2, N.D2].forEach((f, i) =>
      tone(f, 'sine', 0.38, 8, 380, i * 160)
    );
  },

  // ── COUNTDOWN ─────────────────────────────────────────────────────────────
  // Ascending tension: 5=D3 (calm) → 1=D4 (urgent)
  countdown(n: number) {
    const freqMap: Record<number, number> = { 5: N.D3, 4: N.F3, 3: N.G3, 2: N.A3, 1: N.D4 };
    const freq = freqMap[n] ?? N.D3;
    tone(freq, 'triangle', n === 1 ? 0.42 : 0.28, 6, n === 1 ? 500 : 280);
    if (n === 1) tone(freq * 2, 'triangle', 0.18, 6, 380);
  },

  // ── THREAT ────────────────────────────────────────────────────────────────
  enemyAlert() {
    tone(N.F3, 'sawtooth', 0.14, 4,  90);
    tone(N.A3, 'sawtooth', 0.18, 4, 110, 85);
  },
  rangedFire() {
    tone(N.G3, 'sawtooth', 0.11, 3, 55);
  },
};
