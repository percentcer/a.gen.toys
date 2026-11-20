// HUD, Modals (Dilemmas, Finances & Upgrades, Town Map, Pause, Start, Ending).

import {
  CAREERS, LOCATIONS, UPGRADES, PERKS, XP_PER_LEVEL, COLLEGE_COST, KIDACTS,
  clamp, sat, R, money, clockStr, seasonOf, needList, screenLimit, ratio,
  getS, getN, toastQ, choose, buyUpgrade, travelTo, outcome,
} from './sim.js';
import { sfx } from './audio.js';

const $ = s => document.querySelector(s);
const CONTRIBS = [0, 100, 250, 500, 1000];

export function createUI(callbacks) {
  function mkBars(el, defs) {
    const o = {};
    for (const [k, ic, lb] of defs) {
      const d = document.createElement('div');
      d.className = 'bar';
      d.innerHTML = `<span class="ic">${ic}</span><span class="lb">${lb}</span><div class="tr"><i></i></div><b class="ar"></b>`;
      el.appendChild(d);
      o[k] = { d, fill: d.querySelector('i'), ar: d.querySelector('.ar'), lb: d.querySelector('.lb'), prev: null };
    }
    return o;
  }

  const B = {
    ...mkBars($('#dadBars'), [['energy', '⚡', 'Energy'], ['fitness', '💪', 'Fitness'], ['mind', '🧠', 'Mind'], ['social', '🍻', 'Social']]),
    ...mkBars($('#life'), [['bond', '❤️', 'Fatherhood'], ['marriage', '💍', 'Marriage'], ['careerBar', '📈', 'Career']]),
    ...mkBars($('#kidBars'), [['food', '🍼', 'Food'], ['rest', '😴', 'Sleep'], ['clean', '🧷', 'Diaper'], ['fun', '🧸', 'Fun'], ['love', '🫶', 'Love'], ['school', '✏️', 'School']]),
  };

  const SKB = {};
  for (const [k, l] of [['motor', 'Motor'], ['language', 'Language'], ['social', 'Social'], ['cognitive', 'Thinking']]) {
    const d = document.createElement('div');
    d.className = 'sk';
    d.innerHTML = `<span>${l}</span><div class="tr"><i></i></div>`;
    $('#kidSk').appendChild(d);
    SKB[k] = d.querySelector('i');
  }

  function setBar(k, v, dh) {
    const b = B[k];
    const rate = b.prev == null || dh <= 0 ? 0 : (v - b.prev) / dh;
    b.prev = v;
    b.fill.style.width = clamp(v) + '%';
    b.fill.style.background = v > 60 ? 'var(--g)' : v > 30 ? 'var(--y)' : 'var(--r)';
    b.d.classList.toggle('crit', v < 20);
    b.ar.textContent = rate > 12 ? '▲▲' : rate > 0.7 ? '▲' : rate < -9 ? '▼▼' : '';
    b.ar.style.color = rate > 0 ? 'var(--g)' : 'var(--r)';
  }

  let hudH = 0;
  let promptStr = '';
  let shownEv = '';
  let finOpen = false;
  let finTab = 'budget';
  let mapOpen = false;

  function resetHUD() {
    hudH = 0;
    promptStr = '';
    shownEv = '';
    for (const k in B) B[k].prev = null;
  }

  function isOverlayOpen() {
    const S = getS();
    return finOpen || mapOpen || !!(S && (S.event || S.paused || S.over));
  }

  function releasePointer() {
    if (document.pointerLockElement) {
      try { document.exitPointerLock(); } catch {}
    }
  }

  /* ---------- HUD Tick ---------- */
  function updateHUD() {
    const S = getS(), N = getN();
    if (!S) return;
    const K = S.kid, D = S.dad, M = S.mom, age = S.h / 24, dh = S.h - hudH;
    hudH = S.h;

    for (const k in D) setBar(k, D[k], dh);
    setBar('bond', S.bond, dh);
    setBar('marriage', S.divorced ? 0 : S.marriage, dh);
    setBar('careerBar', S.employed ? S.careerBar : (S.hunt / Math.max(0.1, S.huntNeed)) * 100, dh);
    B.marriage.lb.textContent = S.divorced ? 'Divorced' : 'Marriage';
    B.careerBar.lb.textContent = S.employed ? 'Career' : 'Job hunt';

    const nl = needList(age);
    for (const k of ['food', 'rest', 'clean', 'fun', 'love', 'school']) {
      B[k].d.hidden = !nl.includes(k);
      if (!B[k].d.hidden) setBar(k, K[k], dh);
    }
    for (const s in SKB) {
      SKB[s].style.width = clamp((ratio(s) / 1.2) * 100) + '%';
      SKB[s].style.background = ratio(s) >= 0.9 ? 'var(--acc)' : ratio(s) >= 0.75 ? 'var(--y)' : 'var(--r)';
    }

    const locDef = LOCATIONS[S.loc];
    const locTitle = S.loc === 'work' ? CAREERS[S.career].workName : locDef.name;
    const sea = seasonOf(S.h);
    $('#locPill').textContent = `${locDef.icon} ${locTitle}`;
    $('#seasonTag').textContent = `${sea.icon} ${sea.name}`;

    $('#dadJob').textContent = S.employed ? `${CAREERS[S.career].icon} ${money(S.salary)}/yr` : 'unemployed';
    $('#kidN').textContent = N.k;
    $('#kidSt').textContent = K.withDad
      ? 'with you'
      : K.away
      ? (age >= 5 ? 'at school' : 'at daycare')
      : K.crying
      ? 'crying'
      : K.asleep
      ? (K.nap ? 'napping' : 'asleep')
      : K.busy === 'mom'
      ? `with ${N.w}`
      : K.busy === 'dad'
      ? 'with you'
      : K.screen
      ? 'on screen'
      : K.sleepy
      ? 'sleepy'
      : '';

    const y = Math.floor(age), mo = Math.floor((age - y) * 12);
    $('#yrL').textContent = `Year ${Math.min(18, y + 1)} of 18`;
    $('#clk').textContent = clockStr();
    $('#ageL').textContent = `${N.k}: ${y ? y + 'y ' : ''}${mo}m`;
    $('#yr i').style.width = (age / 18) * 100 + '%';

    $('#money').innerHTML =
      `<span>Savings <b class="${S.money < 0 ? 'neg' : ''}">${money(S.money)}</b>${S.money < 0 ? ' <u style="color:var(--r)">(18% APR)</u>' : ''}</span>` +
      `<span>529 <b>${money(S.fund)}</b> <u>${S.contrib ? '+' + money(S.contrib) + '/mo' : 'paused'}</u></span>`;

    // Status chips under Dad panel
    const chips = [];
    if (S.groceries > 0) chips.push(`<span class="chip good">🥗 Fresh food (${S.groceries}d)</span>`);
    else chips.push(`<span class="chip">🛒 Pantry empty</span>`);
    if (S.mess > 60) chips.push(`<span class="chip warn">🧹 Mess ${Math.round(S.mess)}%</span>`);
    if (S.hyper) chips.push(`<span class="chip warn">🩺 High BP</span>`);
    if (!S.divorced && M.load > 70) chips.push(`<span class="chip warn">😮‍💨 ${N.w} overloaded</span>`);
    $('#dadStatus').innerHTML = chips.join('');

    const sc = Math.max(S.screenAvg, S.screenToday), lim = screenLimit(age);
    $('#scrL').innerHTML = `Screens <span style="float:right;text-transform:none;letter-spacing:0;color:${sc > lim + 0.15 ? 'var(--r)' : 'var(--dim)'}">${sc.toFixed(1)} h/d · guide ${lim < 0.5 ? 'none' : '≤' + lim + 'h'}</span>`;

    const nx = PERKS[S.lvl];
    $('#xp').innerHTML = `Dad Lv.<b>${S.lvl}</b> · ${Math.floor(S.xp)} XP · life balance ${Math.round((S.sat || 0) * 100)}%${nx ? ` · next: ${nx[1]}` : ''}<div class="tr"><i style="width:${nx ? ((S.xp - S.lvl * XP_PER_LEVEL) / XP_PER_LEVEL) * 100 : 100}%"></i></div>`;

    // Urgent alert banner
    const al = $('#alert');
    let msg = '';
    const up = K.upset;
    if (up && (S.loc === 'home' || K.withDad)) {
      msg = up === 'cry' ? `${N.k} is crying` : up === 'food' ? `${N.k} is hungry` : up === 'clean' ? `${N.k} needs a diaper change` : up === 'fun' ? `${N.k} is really bored` : up === 'love' ? `${N.k} misses you` : `${N.k} is overtired`;
    } else if (D.energy < 14 && !(S.act && S.act.id === 'sleep')) {
      msg = 'Exhausted — get home to bed soon';
    } else if (!S.employed && !(S.act && (S.act.id === 'work' || S.act.id === 'work_office' || S.act.id === 'work_crunch' || S.act.id === 'work_network'))) {
      msg = 'Unemployed — job hunt at Desk or Workplace';
    }
    al.hidden = !msg;
    al.textContent = msg;

    // Activity banner
    const ab = $('#actB'), A = S.act;
    if (A && A.id !== 'sleep') {
      const names = {
        work: S.employed ? 'Working from home' : 'Job hunting',
        work_crunch_home: S.employed ? 'Pushing overtime (WFH)' : 'Intense interview prep',
        work_office: S.employed ? 'Focused shift at work' : 'Meeting recruiters',
        work_crunch: S.employed ? 'Overtime crunch shift' : 'Portfolio & mock interviews',
        work_network: 'Breakroom networking',
        exercise: S.upgrades.gymrack ? 'Lifting on power rack' : 'Working out',
        relax: M.task && M.task.type === 'talk' && M.arrived ? `Talking with ${N.w}` : 'Unwinding on the couch',
        movie: 'Family movie night',
        couple: `Talking with ${N.w}`,
        chores: 'Cleaning dishes & laundry',
        feed: M.task && M.task.type === 'dinner' && M.arrived ? 'Family dinner' : `Cooking for ${N.k}`,
        feed_quick: `Quick meal for ${N.k}`,
        play: `Playing with ${N.k}`,
        outside: 'Playing in the backyard',
        read: age < 10 ? `Reading to ${N.k}` : `Heart-to-heart with ${N.k}`,
        change: 'Changing diaper',
        homework: 'Helping with homework',
        hangout: age < 2 ? `Cuddling ${N.k}` : `Hanging out with ${N.k}`,
        bedtime: age < 9 ? 'Bath, book, bedtime routine' : 'Saying goodnight',
        bedtime_quick: 'Quick lights-out',
        soothe: `Soothing ${N.k}`,
        park_play: `Playing at Maple Street Park`,
        park_run: 'Jogging the park trail',
        park_bench: M.withDad ? `Park bench talk with ${N.w}` : 'Chatting with neighbor dads',
        park_picnic: 'Enjoying a park picnic',
        town_date: `🍷 Bistro Date Night with ${N.w}`,
        town_pub: '🍻 Quick round with friends',
        town_pub_late: '🍻 Late night with friends',
      };
      const wait = KIDACTS.has(A.id) && !K.arrived;
      const pg =
        A.id === 'bedtime' || A.id === 'bedtime_quick' || A.id === 'soothe'
          ? A.p / 0.42
          : A.id === 'town_date'
          ? A.t / 1.6
          : A.id === 'town_pub'
          ? A.t / 1.2
          : A.id === 'town_pub_late'
          ? A.t / 2.2
          : A.id === 'park_picnic'
          ? A.t / 0.9
          : !S.employed && (A.id === 'work' || A.id === 'work_office' || A.id === 'work_crunch' || A.id === 'work_network')
          ? S.hunt / Math.max(0.1, S.huntNeed)
          : -1;
      ab.hidden = false;
      ab.innerHTML = `${wait ? `Waiting for ${N.k}…` : names[A.id] || A.id}<small><kbd>E</kbd> or walk away to stop</small>${pg >= 0 ? `<div class="pg"><i style="width:${sat(pg) * 100}%"></i></div>` : ''}`;
    } else {
      ab.hidden = true;
    }

    // Sleep eyelids (ONLY for sleeping, never for date/friends!)
    const lids = $('#lids');
    if (A && A.id === 'sleep') {
      lids.style.opacity = 0.92;
      lids.innerHTML = `<div>💤 ${clockStr()}</div><small>Energy ${Math.round(D.energy)}% · Press E to get up</small>`;
    } else {
      lids.style.opacity = 0;
    }

    // Toasts
    while (toastQ.length) {
      const t = toastQ.shift();
      const el = document.createElement('div');
      el.className = 'toast ' + t.cls;
      el.textContent = t.msg;
      const box = $('#toasts');
      box.appendChild(el);
      while (box.children.length > 5) box.firstChild.remove();
      sfx(t.cls === 'warn' ? 'warn' : t.cls === 'mile' ? 'mile' : t.cls === 'good' ? 'good' : 'click');
      setTimeout(() => el.classList.add('out'), 6000);
      setTimeout(() => el.remove(), 6600);
    }

    renderEvent();
  }

  function updatePrompt(focus) {
    $('#cross').classList.toggle('hot', !!focus);
    let s = '';
    if (focus) {
      const rows = focus.acts
        .map((a, i) => {
          const key = i === 0 ? 'E' : String(i);
          if (a.block) return `<div class="pRow"><span class="no">${a.label}: ${a.block}</span></div>`;
          return `<div class="pRow"><kbd>${key}</kbd><span>${a.label}</span></div>`;
        })
        .join('');
      s = `<div class="pBox"><div class="pTitle">${focus.title}</div>${rows}</div>`;
    }
    if (s !== promptStr) {
      promptStr = s;
      $('#prompt').innerHTML = s;
    }
  }

  /* ---------- Dilemma Modal (cleanly exits pointer lock!) ---------- */
  function renderEvent() {
    const S = getS(), N = getN();
    const ev = S ? S.event : null;
    const m = $('#modal');
    if (!ev) {
      if (shownEv) { shownEv = ''; m.hidden = true; }
      return;
    }
    const key = ev.def.id + '_' + ev.stage;
    if (shownEv === key) return;
    shownEv = key;
    releasePointer();
    if (finOpen) toggleFin(false);
    if (mapOpen) toggleMap(false);
    m.hidden = false;

    const d = ev.def, age = S.h / 24;
    const mo = Math.round(age * 12);
    const tag = R(d.tag) || `${N.k} · ${age < 2 ? `${mo} ${mo === 1 ? 'month' : 'months'}` : 'age ' + Math.floor(age)}`;
    let h = `<div class="tag">${tag}</div><h2>${R(d.title)}</h2>`;
    if (ev.stage === 0) {
      const cs = R(d.choices).filter(x => !x.cond || x.cond());
      h += `<p>${R(d.text)}</p>`;
      cs.forEach((c, i) => {
        h += `<button class="ch" data-i="${i}"><span class="k">${i + 1}</span><span class="chMain">${R(c.t)}${c.sub ? `<span class="chSub">${R(c.sub)}</span>` : ''}</span></button>`;
      });
    } else {
      h += `<p style="color:var(--dim)">You chose: ${R(ev.pick.t)}</p>`;
      if (ev.graded) {
        h += `<div class="verdict" style="color:${ev.pick.g ? 'var(--g)' : 'var(--r)'}">${ev.pick.g ? '✓ Aligns with pediatric guidance · +40 XP' : '✗ Against pediatric guidance'}</div>`;
      } else {
        h += `<div class="verdict" style="color:var(--acc)">⚖️ Parenting tradeoff recorded · +20 XP</div>`;
      }
      if (ev.res) h += `<p>${ev.res}</p>`;
      if (d.lit) h += `<p class="lit"><b>What the research says</b>${d.lit}</p>`;
      h += `<button class="ch" data-c="1" style="justify-content:center"><span class="k">E</span>Continue</button>`;
    }
    $('#mcard').innerHTML = h;
  }

  function pickEventChoice(i) {
    choose(i);
    sfx('click');
    renderEvent();
  }
  function closeEvent() {
    const S = getS();
    if (S && S.event && S.event.stage === 1) {
      S.event = null;
      renderEvent();
      sfx('click');
    }
  }
  $('#mcard').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.c) closeEvent();
    else pickEventChoice(+b.dataset.i);
  });

  /* ---------- Finances & Home Upgrades Modal (Tab) ---------- */
  function toggleFin(force) {
    const S = getS();
    if (!S || S.event || S.over) return;
    finOpen = force != null ? force : !finOpen;
    if (finOpen) {
      releasePointer();
      if (mapOpen) toggleMap(false);
      renderFin();
    }
    $('#fin').hidden = !finOpen;
  }

  function renderFin() {
    const S = getS(), N = getN();
    const age = S.h / 24, yrs = 18 - age, r = 0.06;
    const C = CAREERS[S.career];
    const inc = S.employed ? S.salary * (1 - C.tax) : 0, exp = S.expense || 0;
    const proj = S.fund * Math.pow(1 + r, yrs) + S.contrib * 12 * ((Math.pow(1 + r, yrs) - 1) / r);

    let h = `<div class="tag">Household & 529</div><h2>Finances & Home Upgrades</h2>
      <div class="tabs">
        <button data-tab="budget" class="${finTab === 'budget' ? 'on' : ''}">📊 Budget & 529</button>
        <button data-tab="shop" class="${finTab === 'shop' ? 'on' : ''}">🏠 Home Upgrades (${Object.keys(S.upgrades).length}/${UPGRADES.length})</button>
      </div>`;

    if (finTab === 'budget') {
      h += `<table class="fin">
        <tr><td>Take-home pay (${money(S.employed ? S.salary : 0)} gross, ${Math.round(C.tax * 100)}% tax)</td><td>${money(inc)}/yr</td></tr>
        <tr><td>Net household costs ${S.flags.spousePromo && !S.divorced ? '(with spouse raise!)' : ''}</td><td>${money(-exp)}/yr</td></tr>
        <tr><td>529 college contributions</td><td>${money(-S.contrib * 12)}/yr</td></tr>
        <tr><td><b>Checking / Savings</b> ${S.money < 0 ? '<span style="color:var(--r)">(18% APR interest!)</span>' : ''}</td><td><b style="color:${S.money < 0 ? 'var(--r)' : 'var(--ink)'}">${money(S.money)}</b></td></tr>
        <tr><td><b>529 College Fund</b> (6% annual growth)</td><td><b>${money(S.fund)}</b></td></tr>
        <tr><td>Projected at age 18</td><td style="color:${proj >= COLLEGE_COST ? 'var(--g)' : 'var(--y)'}">${money(proj)} / ${money(COLLEGE_COST)}</td></tr>
      </table>
      <p style="font-size:12.5px;color:var(--dim)">Monthly 529 contribution (press 1–5): early dollars roughly triple by age 18.</p>`;
      CONTRIBS.forEach((c, i) => {
        h += `<button class="ch ${S.contrib === c ? 'on' : ''}" data-cidx="${i}"><span class="k">${i + 1}</span><span>${c ? money(c) + ' / month' : 'Pause contributions ($0)'}</span></button>`;
      });
    } else {
      h += `<p style="font-size:12.5px;color:var(--dim);margin-top:0">Upgrades physically appear in your house and permanently improve daily routines. Savings: <b>${money(S.money)}</b></p><div class="shopGrid">`;
      for (const u of UPGRADES) {
        const owned = !!S.upgrades[u.id];
        h += `<div class="shopItem ${owned ? 'owned' : ''}">
          <div><b>${u.icon} ${u.name}</b><br><small>${u.desc}</small></div>
          <button data-buy="${u.id}" ${owned || S.money < u.cost ? 'disabled' : ''}>${owned ? '✓ Installed' : 'Buy · ' + money(u.cost)}</button>
        </div>`;
      }
      h += `</div>`;
    }
    h += `<button class="ch" data-close="1" style="justify-content:center;margin-top:12px"><span class="k">Tab</span>Close</button>`;
    $('#fcard').innerHTML = h;
  }

  $('#fcard').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.close) { toggleFin(false); return; }
    if (b.dataset.tab) { finTab = b.dataset.tab; sfx('click'); renderFin(); return; }
    if (b.dataset.cidx != null) { getS().contrib = CONTRIBS[+b.dataset.cidx]; sfx('click'); renderFin(); return; }
    if (b.dataset.buy) { if (buyUpgrade(b.dataset.buy)) renderFin(); }
  });

  /* ---------- Town Travel Map Modal (T or Car) ---------- */
  function toggleMap(force) {
    const S = getS();
    if (!S || S.event || S.over) return;
    mapOpen = force != null ? force : !mapOpen;
    if (mapOpen) {
      releasePointer();
      if (finOpen) toggleFin(false);
      renderMap();
    }
    $('#tmap').hidden = !mapOpen;
  }

  function renderMap() {
    const S = getS(), N = getN(), M = S.mom, K = S.kid;
    const momFree = !M.gone && !M.atWork && !M.asleep;
    const kidAwakeHome = !K.away && !K.asleep && !K.crying;

    let h = `<div class="tag">Drive around town · ~12 min travel</div><h2>Where to, Dad?</h2>
      <p style="font-size:13px;color:var(--dim);margin-top:4px">
        ${kidAwakeHome ? `${N.k} is awake and ready to come along to the Park or Main Street.` : `${N.k} is ${K.away ? 'at school/daycare' : 'asleep'}.`}
        ${momFree ? ` ${N.w} is free to join you!` : M.atWork ? ` ${N.w} is at work.` : ''}
      </p>
      <div class="locGrid">`;

    const entries = [
      { id: 'home', title: '🏡 Home', sub: 'Kitchen, crib/desk, garage gym, living room & backyard.' },
      { id: 'park', title: '🌳 Maple Street Park', sub: 'Playground, hoops, jogging trail & picnic lawn. Best for Motor, Fitness & Bond.' },
      { id: 'work', title: `🏢 ${CAREERS[S.career].workName}`, sub: 'Higher career impact (+16%), overtime pay & breakroom networking.' },
      { id: 'town', title: '☕ Main Street Plaza', sub: 'Bistro Café, Corner Market fresh groceries, Neighborhood Pub & Clinic.' },
    ];
    entries.forEach((it, idx) => {
      const here = S.loc === it.id;
      h += `<button class="locCard ${here ? 'here' : ''}" data-dest="${it.id}" ${here ? 'disabled' : ''}>
        <b><span><span class="k">${idx + 1}</span> ${it.title}</span>${here ? '<span class="badge">You are here</span>' : ''}</b>
        <p>${it.sub}</p>
      </button>`;
    });
    h += `</div>`;

    if (momFree && S.loc !== 'town') {
      const sitterFee = S.h / 24 < 12 && !K.away ? (S.upgrades.sitter ? 20 : 60) : 0;
      h += `<button class="ch on" data-dest="town" data-date="1">
        <span class="k">5</span>
        <span class="chMain">🍷 Date Night Drive to Main Street Bistro with ${N.w}
          <span class="chSub">${sitterFee ? `Books babysitter (${money(sitterFee)}) and brings ${N.w} straight to the candlelit patio.` : `Just the two of you at the Bistro patio!`}</span>
        </span>
      </button>`;
    }

    h += `<button class="ch" data-close="1" style="justify-content:center"><span class="k">T</span>Stay here</button>`;
    $('#tcard').innerHTML = h;
  }

  $('#tcard').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.close) { toggleMap(false); return; }
    if (b.dataset.dest) {
      travelTo(b.dataset.dest, { dateMode: !!b.dataset.date });
      toggleMap(false);
    }
  });

  /* ---------- Ending Screen ---------- */
  function showEnding() {
    const S = getS(), N = getN();
    releasePointer();
    $('#hud').hidden = true;
    $('#modal').hidden = true;
    $('#fin').hidden = true;
    $('#tmap').hidden = true;
    $('#lids').style.opacity = 0;

    const o = outcome(), D = S.dad;
    const kidLine =
      o.avg >= 88 ? `${N.k} steps onto campus confident, curious, and ready for the world.`
      : o.avg >= 76 ? `${N.k} is ready — a few rough edges, like every good human.`
      : o.avg >= 62 ? `${N.k} made it with a little catching up ahead, and a whole lot of grit.`
      : `${N.k} is taking a gap year to find steady footing, starting further back than planned.`;
    const bondLine =
      S.bond >= 75 ? `At the dorm ${N.he} hugs you for a long time and whispers, "Thanks, Dad. For all of it."`
      : S.bond >= 50 ? `At the dorm ${N.he} gives you a warm hug and a "love you, call you Sunday," eyes already bright on the future.`
      : S.bond >= 28 ? `At the dorm ${N.he} waves from the hall. You realize you are not sure who their favorite band is anymore.`
      : `${N.He} thanks you for the boxes like a helpful mover.`;
    const loanLine =
      o.loans < 500
        ? `Your 529${o.fromSav > 500 ? ' and ' + money(o.fromSav) + ' from savings' : ''} cover all four years. ${N.k} walks in debt-free!`
        : `Your 529 covers ${money(Math.min(S.fund, o.effectiveCost))}${o.fromSav > 500 ? ', savings add ' + money(o.fromSav) : ''}. ${N.k} signs for <b style="color:var(--r)">${money(o.loans)}</b> in student loans.`;
    const marLine =
      S.divorced ? `You and ${N.w} drive to drop-off in separate cars, still proud of who you raised.`
      : S.marriage >= 68 ? `You and ${N.w} drive home holding hands, secretly excited to rediscover the quiet house.`
      : S.marriage >= 38 ? `You and ${N.w} drive home in a comfortable, slightly weary silence.`
      : `You and ${N.w} drive home realizing it is time to learn how to talk to each other again.`;
    const hLine = S.hyper
      ? 'Your blood pressure is still high — time to reclaim the park trail.'
      : D.fitness >= 55
      ? 'You haul the mini-fridge up three flights without breaking a sweat.'
      : 'The third flight of dorm stairs reminds you to use that garage gym.';

    const title = { A: 'Dad of the Year', B: 'A Really Great Dad', C: "World's Okayest Dad", D: 'Present, Technically', F: "Cat's in the Cradle" }[o.grade];
    const pct = s => Math.round(clamp(ratio(s) * 100, 0, 115)) + '%';

    $('#ecard').innerHTML = `
      <div class="tag">Eighteen years later · ${o.archetype}</div>
      <div style="display:flex;gap:18px;align-items:center;margin-top:4px">
        <div class="grade">${o.grade}</div>
        <div>
          <h2>${title}</h2>
          <div style="color:var(--dim)">${Math.floor(S.xp)} XP · Dad Lv.${S.lvl} · ${S.stats.good}/${S.stats.total} pediatric safety calls · Score ${Math.round(o.score)}</div>
        </div>
      </div>
      <p>${kidLine} ${bondLine}</p>
      <p>${loanLine}</p>
      <p>${marLine} ${hLine}</p>
      <div class="styleBars">
        <div class="stBox"><small>Presence</small><b>${S.style.presence}</b></div>
        <div class="stBox"><small>Warmth</small><b>${S.style.warmth}</b></div>
        <div class="stBox"><small>Structure</small><b>${S.style.structure}</b></div>
        <div class="stBox"><small>Provider</small><b>${S.style.provider}</b></div>
      </div>
      <div class="grid2">
        <div><span>Fatherhood</span><b>${Math.round(S.bond)}</b></div>
        <div><span>Marriage</span><b>${S.divorced ? 'divorced' : Math.round(S.marriage)}</b></div>
        <div><span>Motor / Language</span><b>${pct('motor')} / ${pct('language')}</b></div>
        <div><span>Social / Thinking</span><b>${pct('social')} / ${pct('cognitive')}</b></div>
        <div><span>Career</span><b>${S.employed ? money(S.salary) + '/yr' : 'unemployed'}</b></div>
        <div><span>Savings / 529</span><b>${money(S.money)} / ${money(S.fund)}</b></div>
        <div><span>Time with ${N.k} / Work</span><b>${(S.stats.kid / 18).toFixed(1)}h / ${(S.stats.work / 18).toFixed(1)}h</b></div>
        <div><span>Trips (Park / Town / Work)</span><b>${S.stats.parkTrips} / ${S.stats.townTrips} / ${S.stats.officeDays}</b></div>
      </div>
      <p class="lit"><b>Milestones (${S.mileLog.length})</b>${S.mileLog.slice(-5).map(m => m[1]).join(' · ')}.</p>
      <button class="go" onclick="location.reload()">Raise another one</button>`;
    $('#end').hidden = false;
  }

  /* ---------- Start Screen Setup ---------- */
  let pickCareer = 'white', pickSex = 'boy';
  $('#careers').innerHTML = Object.entries(CAREERS)
    .map(([k, c]) => `<div class="car${k === pickCareer ? ' on' : ''}" data-k="${k}"><b>${c.icon} ${c.name}</b><i>${c.job} · ${money(c.salary)}/yr</i><span>${c.blurb}</span></div>`)
    .join('');
  $('#careers').addEventListener('click', e => {
    const c = e.target.closest('.car');
    if (!c) return;
    pickCareer = c.dataset.k;
    document.querySelectorAll('.car').forEach(x => x.classList.toggle('on', x === c));
  });
  $('#segSex').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    pickSex = b.dataset.v;
    document.querySelectorAll('#segSex button').forEach(x => x.classList.toggle('on', x === b));
  });
  $('#go').addEventListener('click', () => {
    callbacks.onStart({
      career: pickCareer,
      sex: pickSex,
      kid: $('#inKid').value.trim(),
      spouse: $('#inSp').value.trim(),
    });
  });

  return {
    resetHUD, updateHUD, updatePrompt, renderEvent, showEnding,
    toggleFin, toggleMap, pickEventChoice, closeEvent, isOverlayOpen, releasePointer,
    isFinOpen: () => finOpen,
    isMapOpen: () => mapOpen,
    handleFinKey(n) {
      if (finTab === 'budget' && n >= 1 && n <= CONTRIBS.length) {
        getS().contrib = CONTRIBS[n - 1];
        sfx('click');
        renderFin();
      }
    },
    handleMapKey(n) {
      const dests = ['home', 'park', 'work', 'town'];
      if (n >= 1 && n <= 4) {
        const dest = dests[n - 1];
        if (getS().loc !== dest) { travelTo(dest); toggleMap(false); }
      } else if (n === 5) {
        const M = getS().mom;
        if (!M.gone && !M.atWork && !M.asleep && getS().loc !== 'town') {
          travelTo('town', { dateMode: true });
          toggleMap(false);
        }
      }
    },
  };
}
