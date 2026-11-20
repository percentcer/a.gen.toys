// Main game bootstrap, input/camera controller, pointer-lock state machine, and loop.

import {
  DAY_RATE, FAST_RATE, CAREERS, EVENTS, FOLLOW, clamp,
  newGame, getS, getN, step, startAct, stopAct, travelTo, setTravelHook, toast, botRun,
} from './sim.js';
import { createWorld } from './world.js';
import { createUI } from './ui.js';
import { sfx, startAmbience, updateAmbience, toggleMute } from './audio.js';

const $ = s => document.querySelector(s);
const QS = new URLSearchParams(location.search);
const SPEED = +(QS.get('speed') || 1);

const canvas = $('#c');
const world = createWorld(canvas);

const keys = {};
const pos = { x: 6.6, z: 8.6 };
let yaw = 1.05;
let pitch = -0.06;
let eyeY = 1.66;
let bobPhase = 0;
let stepAccum = 0;
let playing = false;
let locked = false;
let dragging = false;
let moveLatch = false;
let focus = null;

// High-poll-rate safe mouselook state
let lookDX = 0;
let lookDY = 0;
let lockIgnoreUntil = 0;
let recentDelta = 12;
let lastDragX = null;
let lastDragY = null;
let sensMult = +(localStorage.getItem('dad_sens') || 1) || 1;
const BASE_SENS = 0.0021;

function setPaused(p) {
  const S = getS();
  if (!S) return;
  S.paused = p;
  $('#pause').hidden = !p;
}

async function lockPtr() {
  if (ui.isOverlayOpen() || !playing || !canvas.requestPointerLock) return;
  try {
    await canvas.requestPointerLock({ unadjustedMovement: true });
  } catch {
    try { await canvas.requestPointerLock(); } catch {}
  }
}

function begin(cfg) {
  newGame(cfg);
  const S = getS(), N = getN();
  world.setCareerIcon(CAREERS[cfg.career].icon);
  const sp = world.setLocation('home');
  pos.x = sp.x; pos.z = sp.z; yaw = sp.yaw; pitch = -0.06;
  $('#start').hidden = true;
  $('#end').hidden = true;
  $('#hud').hidden = false;
  playing = true;
  ui.resetHUD();
  startAmbience();
  toast(`🏡 Welcome home, ${N.k}! Walk up to glowing stations and press E.`, 'good');
  toast('🚗 Press T (or visit your Car) to drive to the Park, Workplace, or Main Street. Tab = Finances & Upgrades.', 'dim');
  lockPtr();
}

const ui = createUI({ onStart: begin });

// Smooth fade transition when driving between locations
setTravelHook(dest => {
  const sp = world.setLocation(dest);
  pos.x = sp.x;
  pos.z = sp.z;
  yaw = sp.yaw;
  pitch = -0.05;
  const lids = $('#lids');
  if (lids && playing) {
    lids.style.opacity = 0.85;
    lids.innerHTML = `<div>🚗 Driving…</div>`;
    setTimeout(() => {
      const S = getS();
      if (!(S && S.act && S.act.id === 'sleep')) lids.style.opacity = 0;
    }, 340);
  }
});

function doAct(a) {
  if (!a) return;
  if (a.block) {
    toast(a.block + '.', 'dim');
    return;
  }
  if (a.id === 'travel') {
    ui.toggleMap(true);
    sfx('click');
    return;
  }
  if (a.id === 'tv') {
    const S = getS();
    S.tv = !S.tv;
    sfx(S.tv ? 'tvOn' : 'tvOff');
    if (S.tv && S.h / 24 < 2) {
      toast('📺 Under two, pediatric guidance recommends avoiding solo screens.', 'dim');
    }
    return;
  }
  if (startAct(a.id)) {
    moveLatch = !!(keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD);
  }
}

/* ---------- Input & Clean Pointer-Lock State Machine ---------- */
window.addEventListener('keydown', e => {
  if (e.code === 'Tab') {
    e.preventDefault();
    if (playing && !getS()?.event) ui.toggleFin();
    return;
  }
  if (e.target && e.target.tagName === 'INPUT') return;
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if (!playing) return;

  const S = getS();
  const n = e.code.startsWith('Digit') ? +e.code[5] : e.code.startsWith('Numpad') ? +e.code[6] : 0;

  if (S.event) {
    if (S.event.stage === 0) {
      if (n) ui.pickEventChoice(n - 1);
    } else if (['KeyE', 'Enter', 'Space'].includes(e.code)) {
      ui.closeEvent();
    }
    return;
  }
  if (ui.isFinOpen()) {
    if (n) ui.handleFinKey(n);
    if (e.code === 'Escape' || e.code === 'KeyE') ui.toggleFin(false);
    return;
  }
  if (ui.isMapOpen()) {
    if (n) ui.handleMapKey(n);
    if (e.code === 'Escape' || e.code === 'KeyT' || e.code === 'KeyE') ui.toggleMap(false);
    return;
  }
  if (e.code === 'KeyT') { ui.toggleMap(true); sfx('click'); return; }
  if (e.code === 'KeyP') { setPaused(!S.paused); if (S.paused) ui.releasePointer(); return; }
  if (e.code === 'KeyM') {
    const m = toggleMute();
    toast(m ? '🔇 Sound muted' : '🔊 Sound on', 'dim');
    return;
  }
  if (S.paused) return;

  if (e.code === 'KeyE') {
    if (S.act) { stopAct(); sfx('stop'); }
    else if (focus) doAct(focus.acts[0]);
  } else if (n && focus && focus.acts[n]) {
    doAct(focus.acts[n]);
  }
});

window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => {
  for (const k in keys) keys[k] = false;
  dragging = false;
  lastDragX = lastDragY = null;
  lookDX = lookDY = 0;
});

function acceptDelta(dx, dy, spikeFloor = 150) {
  if (!dx && !dy) return;
  const mag = Math.hypot(dx, dy);
  // Drop Chromium high-poll-rate pointer-lock recenter warp spikes
  if (locked && mag > spikeFloor && mag > Math.max(32, recentDelta * 7.5)) return;
  recentDelta = recentDelta * 0.8 + Math.min(mag, 90) * 0.2;
  lookDX += dx;
  lookDY += dy;
}

canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  dragging = true;
  lastDragX = e.clientX;
  lastDragY = e.clientY;
  if (playing && !locked && !ui.isOverlayOpen()) lockPtr();
});
window.addEventListener('pointerup', () => {
  dragging = false;
  lastDragX = lastDragY = null;
});

window.addEventListener('pointermove', e => {
  if (!playing || (!locked && !dragging) || ui.isOverlayOpen()) return;
  if (locked) {
    if (performance.now() < lockIgnoreUntil) return;
    const samples = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
    let usedCoalesced = false;
    if (samples.length) {
      for (const s of samples) {
        if (s.movementX || s.movementY) { usedCoalesced = true; break; }
      }
      if (usedCoalesced) {
        for (const s of samples) acceptDelta(s.movementX || 0, s.movementY || 0, 150);
      }
    }
    if (!usedCoalesced) {
      acceptDelta(e.movementX || 0, e.movementY || 0, 280);
    }
  } else if (dragging) {
    const dx = lastDragX != null ? e.clientX - lastDragX : (e.movementX || 0);
    const dy = lastDragY != null ? e.clientY - lastDragY : (e.movementY || 0);
    lastDragX = e.clientX;
    lastDragY = e.clientY;
    acceptDelta(dx, dy, 280);
  }
});

document.addEventListener('pointerlockchange', () => {
  const was = locked;
  locked = document.pointerLockElement === canvas;
  lookDX = lookDY = 0;
  recentDelta = 12;
  if (locked) {
    // Discard the first ~65ms of stale warp packets right after lock engages
    lockIgnoreUntil = performance.now() + 65;
    setPaused(false);
  } else if (was && playing && !ui.isOverlayOpen()) {
    setPaused(true);
  }
});

const sensSlider = $('#sensSlider');
const sensVal = $('#sensVal');
if (sensSlider && sensVal) {
  sensSlider.value = String(clamp(sensMult, 0.25, 2.5));
  sensVal.textContent = `${(+sensSlider.value).toFixed(2).replace(/\.00$/, '.0')}x`;
  sensSlider.addEventListener('input', () => {
    sensMult = +sensSlider.value;
    sensVal.textContent = `${sensMult.toFixed(2).replace(/\.00$/, '.0')}x`;
    try { localStorage.setItem('dad_sens', String(sensMult)); } catch {}
  });
}
$('#resumeBtn').addEventListener('click', () => {
  setPaused(false);
  lockPtr();
});

window.addEventListener('resize', () => world.resize());

/* ---------- First-Person Player Controller ---------- */
const SIT_ACTS = new Set([
  'relax', 'movie', 'work', 'work_crunch_home', 'work_office', 'work_crunch',
  'read', 'homework', 'feed', 'feed_quick', 'park_bench', 'park_picnic',
  'town_date', 'town_pub', 'town_pub_late',
]);

function updatePlayer(dt) {
  const S = getS();
  if (!playing) {
    yaw += dt * 0.045;
    world.camera.position.set(pos.x, 1.66, pos.z);
    world.camera.rotation.set(pitch, yaw, 0);
    return;
  }

  // Apply accumulated high-poll-rate mouselook deltas cleanly once per frame
  if (lookDX || lookDY) {
    const sens = BASE_SENS * sensMult;
    yaw -= lookDX * sens;
    pitch = clamp(pitch - lookDY * sens, -1.32, 1.32);
    lookDX = 0;
    lookDY = 0;
  }

  yaw += ((keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0)) * 2.3 * dt;
  pitch = clamp(pitch + ((keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0)) * 1.3 * dt, -1.32, 1.32);

  const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const r = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  if (!f && !r) moveLatch = false;

  let moving = false;
  if ((f || r) && !moveLatch && !ui.isOverlayOpen()) {
    if (S.act) { stopAct(); sfx('stop'); }
    const sp = (4.5 * dt) / Math.hypot(f, r);
    const sx = -Math.sin(yaw), sz = -Math.cos(yaw);
    pos.x += (sx * f + Math.cos(yaw) * r) * sp;
    pos.z += (sz * f - Math.sin(yaw) * r) * sp;
    world.collide(pos);
    moving = true;
    bobPhase += dt * 10.5;
    stepAccum += dt;
    if (stepAccum >= 0.36) {
      stepAccum = 0;
      sfx(world.surfaceAt(pos));
    }
  } else {
    stepAccum = 0.25;
  }

  // Smooth seated / standing eye height + subtle walking head bob!
  const seated = S && S.act && SIT_ACTS.has(S.act.id);
  const targetY = seated ? 1.24 : 1.66;
  eyeY += (targetY - eyeY) * Math.min(1, dt * 8);
  const bob = moving ? Math.sin(bobPhase) * 0.032 : (S && S.act && S.act.id === 'park_run' ? Math.sin(performance.now() * 0.012) * 0.05 : 0);

  world.camera.position.set(pos.x, eyeY + bob, pos.z);
  world.camera.rotation.set(pitch, yaw, 0);
}

/* ---------- Main Loop ---------- */
let last = performance.now();
let hudT = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  const S = getS(), N = getN();
  if (playing && S && !ui.isOverlayOpen()) {
    const rate = S.act && S.act.id === 'sleep' ? FAST_RATE : DAY_RATE;
    let dh = dt * rate * SPEED;
    while (dh > 1e-6 && !S.event && !S.over) {
      const d = Math.min(dh, 0.03);
      step(d);
      dh -= d;
    }
    if (S.over) {
      playing = false;
      ui.showEnding();
    }
  }

  updatePlayer(dt);
  world.updateWorld(S, N, dt, pos, yaw, playing);
  world.renderer.render(world.scene, world.camera);

  if (playing && S) {
    const clock = ((S.h % 24) + 6) % 24;
    updateAmbience(S.loc, clock >= 19 || clock < 6, ui.isOverlayOpen());
    hudT += dt;
    if (hudT > 0.11) {
      hudT = 0;
      ui.updateHUD();
    }
    focus = world.findFocus(S, N, pos, yaw);
    ui.updatePrompt(focus);
  }
}
requestAnimationFrame(frame);

/* ---------- Debug / Balance Console API ---------- */
window.__dad = {
  run: botRun,
  state: getS,
  begin,
  travel: (dest, opts) => travelTo(dest, opts),
  goto: (x, z, y = yaw, p = pitch) => { pos.x = x; pos.z = z; yaw = y; pitch = p; },
  setH: h => { const S = getS(); if (S) S.h = h; },
  act: id => startAct(id),
  step: (n = 1) => { for (let i = 0; i < n; i++) step(0.03); },
  skipEvents: () => {
    const S = getS();
    if (!S) return;
    for (const e of EVENTS) S.fired[e.id] = 1;
    for (const f of FOLLOW) S.fired[f.id] = 1;
    S.event = null; S.queue.length = 0;
  },
};

if (QS.get('auto')) {
  begin({ career: QS.get('auto'), sex: 'boy', kid: 'Charlie', spouse: 'Alex' });
}
