// Synthesized Web Audio sound effects and gentle location ambience.

let ctx = null;
let muted = false;
let ambGain = null;
let ambFilter = null;
let ambReady = false;
let headMode = false;

export function setHeadless(on) { headMode = !!on; }
export function isMuted() { return muted; }
export function toggleMute() {
  muted = !muted;
  if (ambGain && ctx) {
    ambGain.gain.setTargetAtTime(muted ? 0 : 0.018, ctx.currentTime, 0.12);
  }
  return muted;
}

function ensureCtx() {
  if (muted || headMode) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, dur = 0.12, vol = 0.04, type = 'sine', delay = 0, freqEnd = null) {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (freqEnd != null) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.015, dur * 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noiseBurst(dur = 0.06, vol = 0.025, cutoff = 900, delay = 0) {
  const c = ensureCtx();
  if (!c) return;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(c.destination);
  src.start(c.currentTime + delay);
}

export function startAmbience() {
  const c = ensureCtx();
  if (!c || ambReady) return;
  ambReady = true;
  const len = c.sampleRate * 3;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.04 * w) / 1.04;
    data[i] = last * 2.5;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  ambFilter = c.createBiquadFilter();
  ambFilter.type = 'bandpass';
  ambFilter.frequency.value = 320;
  ambFilter.Q.value = 0.7;
  ambGain = c.createGain();
  ambGain.gain.value = muted ? 0 : 0.015;
  src.connect(ambFilter).connect(ambGain).connect(c.destination);
  src.start();
}

export function updateAmbience(loc, isNight, paused) {
  if (!ambGain || !ambFilter || !ctx) return;
  const targetGain = (muted || paused || headMode) ? 0 : (loc === 'park' ? 0.022 : loc === 'town' ? 0.018 : loc === 'work' ? 0.014 : 0.010);
  const freq = loc === 'park' ? (isNight ? 700 : 480) : loc === 'town' ? 420 : loc === 'work' ? 240 : 190;
  ambGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.3);
  ambFilter.frequency.setTargetAtTime(freq, ctx.currentTime, 0.3);
}

export function sfx(name) {
  if (muted || headMode) return;
  switch (name) {
    case 'stepWood':
      noiseBurst(0.045, 0.022, 420);
      tone(115 + Math.random() * 22, 0.04, 0.014, 'triangle');
      break;
    case 'stepGrass':
      noiseBurst(0.06, 0.024, 1400);
      break;
    case 'stepStone':
      noiseBurst(0.035, 0.026, 950);
      tone(220 + Math.random() * 40, 0.03, 0.01, 'sine');
      break;
    case 'start':
      tone(520, 0.08, 0.035, 'sine', 0, 680);
      break;
    case 'stop':
      tone(440, 0.08, 0.03, 'sine', 0, 320);
      break;
    case 'click':
      tone(620, 0.05, 0.025, 'sine');
      break;
    case 'cash':
      tone(880, 0.08, 0.03, 'triangle', 0);
      tone(1320, 0.14, 0.03, 'triangle', 0.06);
      break;
    case 'travel':
      tone(140, 0.24, 0.035, 'sawtooth', 0, 210);
      noiseBurst(0.18, 0.025, 600, 0.04);
      break;
    case 'tvOn':
      tone(420, 0.09, 0.03, 'sine', 0, 620);
      break;
    case 'tvOff':
      tone(520, 0.09, 0.025, 'sine', 0, 240);
      break;
    case 'good':
      tone(523.25, 0.11, 0.032, 'sine', 0);
      tone(659.25, 0.15, 0.032, 'sine', 0.08);
      break;
    case 'warn':
      tone(240, 0.16, 0.038, 'triangle', 0, 195);
      tone(195, 0.18, 0.035, 'triangle', 0.12, 165);
      break;
    case 'mile':
      tone(523.25, 0.14, 0.035, 'sine', 0);
      tone(659.25, 0.14, 0.035, 'sine', 0.09);
      tone(783.99, 0.22, 0.038, 'sine', 0.18);
      tone(1046.5, 0.28, 0.032, 'sine', 0.27);
      break;
    case 'cry':
      tone(540, 0.18, 0.03, 'triangle', 0, 690);
      tone(660, 0.22, 0.028, 'triangle', 0.2, 490);
      break;
    case 'event':
      tone(440, 0.14, 0.03, 'sine', 0);
      tone(554.37, 0.18, 0.028, 'sine', 0.1);
      break;
    case 'coffee':
      noiseBurst(0.2, 0.02, 2200);
      tone(680, 0.1, 0.025, 'sine', 0.12, 820);
      break;
  }
}
