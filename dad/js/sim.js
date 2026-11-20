// Core simulation state, rates, locations, upgrades, activities, and headless balance bot.

import { createEvents, COLLEGE_COST } from './events.js';
import { sfx, setHeadless } from './audio.js';

export { COLLEGE_COST };

export const clamp = (v, a = 0, b = 100) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sat = t => clamp(t, 0, 1);
export const R = v => (typeof v === 'function' ? v() : v);
export const money = v =>
  (v < 0 ? '-' : '') +
  '$' +
  (Math.abs(v) >= 10000
    ? (Math.abs(v) / 1000).toFixed(Math.abs(v) >= 100000 ? 0 : 1) + 'k'
    : Math.round(Math.abs(v)).toLocaleString());

export const DAY_RATE = 16 / 65;   // game hours per real second awake (~65s per awake day)
export const FAST_RATE = 8 / 9;    // game hours per real second asleep
export const WORKDAY = 6;
export const XP_PER_LEVEL = 480;

export const LOCATIONS = {
  home: {
    id: 'home',
    name: 'Home',
    icon: '🏡',
    blurb: 'Your house, kitchen, kid’s room, garage gym, and backyard.',
  },
  park: {
    id: 'park',
    name: 'Maple Street Park',
    icon: '🌳',
    blurb: 'Playground, trail, picnic lawn & neighbor dads. Kid & spouse come along when free.',
  },
  work: {
    id: 'work',
    name: 'Workplace',
    icon: '🏢',
    blurb: 'Higher career impact, overtime & networking than working from home.',
  },
  town: {
    id: 'town',
    name: 'Main Street',
    icon: '☕',
    blurb: 'Bistro date nights, Corner Market groceries, Pub with friends & Clinic.',
  },
};

export const CAREERS = {
  blue: {
    name: 'Blue Collar',
    job: 'Union Electrician',
    workName: 'Job Site & Shop',
    salary: 74000,
    tax: 0.20,
    raise: 0.04,
    living: 49000,
    decay: 0.42,
    stress: 0.60,
    tire: 1.50,
    fit: 0.72,
    icon: '🔧',
    blurb: 'Hourly pay (7.5h full shift, 1.35x overtime). Keeps you fit, lower stress, and AI cannot pull wire.',
  },
  white: {
    name: 'White Collar',
    job: 'Account Manager',
    workName: 'Downtown Office',
    salary: 96000,
    tax: 0.24,
    raise: 0.065,
    living: 61000,
    decay: 0.46,
    stress: 0.95,
    tire: 1.05,
    fit: -0.25,
    icon: '💼',
    blurb: 'Steady salaried office track. Commuting to the office pays career dividends; vulnerable to mid-career AI layoff.',
  },
  tech: {
    name: 'Tech Bro',
    job: 'Software Engineer',
    workName: 'Startup Loft',
    salary: 148000,
    tax: 0.30,
    raise: 0.08,
    living: 92000,
    decay: 0.54,
    stress: 1.30,
    tire: 1.15,
    fit: -0.30,
    icon: '💻',
    blurb: 'High pay and stock promotions, high cost of living and stress, plus mid-career AI disruption.',
  },
};

export const UPGRADES = [
  { id: 'espresso', name: 'Espresso Machine', cost: 450, icon: '☕', desc: 'Adds a coffee station in the kitchen (+18 Energy, +4 Mind, 8h cooldown).' },
  { id: 'robovac', name: 'Robot Vacuum', cost: 650, icon: '🤖', desc: 'Glides around the living room and cuts household mess buildup by 42%.' },
  { id: 'hoop', name: 'Backyard Hoop & Playset', cost: 800, icon: '🏀', desc: 'Upgrades the backyard: +35% Bond, Motor & Fitness when playing outside.' },
  { id: 'deskpro', name: 'Pro Desk / Tool Chest', cost: 900, icon: '🖥️', desc: '+18% work efficiency and 20% less work stress at home.' },
  { id: 'gymrack', name: 'Garage Power Rack', cost: 1150, icon: '🏋️', desc: 'Upgrades home gym: +35% faster Fitness gain and less fatigue.' },
  { id: 'sitter', name: 'Trusted Sitter Network', cost: 500, icon: '🧸', desc: 'Cuts sitter fee for Town Date Nights & Friends Nights from $60 to $20.' },
];

export const PERKS = [
  ['swaddle', 'Swaddle Sensei', 'diapers, bedtime and soothing go 30% faster'],
  ['chef', 'One-Armed Chef', 'cooking and chores go 30% faster'],
  ['jokes', 'Dad Jokes', '+20% fatherhood bond from everything you do together'],
  ['nap', 'Power Napper', 'sleep restores 15% more energy'],
  ['cal', 'Calendar Tetris', '+12% work & job-hunt efficiency'],
  ['gym', 'Garage Gym Rat', '+25% fitness from workouts & jogs'],
  ['listen', 'Active Listener', '+25% marriage gain from time together'],
  ['zen', 'Zen Dad', 'stress hits your mind 20% less'],
  ['coach', 'Sideline Legend', 'outdoor & park play builds 1.6x the bond'],
  ['legend', '#1 Dad Mug', 'it is just a mug. You earned every ounce of it.'],
];

export const MILES = [
  [0.17, 'social', 'first real smile'],
  [0.33, 'motor', 'holds head steady'],
  [0.50, 'language', 'laughs and babbles'],
  [0.50, 'motor', 'rolls over'],
  [0.75, 'motor', 'sits without support'],
  [0.75, 'social', 'plays peek-a-boo'],
  [1.00, 'language', 'says "dada"'],
  [1.00, 'motor', 'pulls up to stand'],
  [1.25, 'motor', 'takes first steps', 'walks'],
  [1.50, 'language', 'says three or more words'],
  [2.00, 'motor', 'runs and kicks a ball'],
  [2.00, 'language', 'puts two words together'],
  [2.50, 'social', 'plays alongside other kids'],
  [3.00, 'cognitive', 'is potty trained', 'potty'],
  [3.00, 'language', 'holds a real conversation'],
  [4.00, 'motor', 'catches a ball'],
  [4.00, 'cognitive', 'tells you a whole story'],
  [5.00, 'cognitive', 'counts to ten and writes their name'],
  [6.00, 'motor', 'rides a bike'],
  [6.50, 'language', 'reads a book to YOU'],
  [8.00, 'cognitive', 'makes their own breakfast'],
  [9.00, 'social', 'has a best friend'],
  [10.5, 'cognitive', 'does homework without being asked'],
  [12.0, 'social', 'stays home alone'],
  [13.0, 'cognitive', 'cooks dinner for the family'],
  [14.5, 'social', 'gets a first job mowing lawns'],
  [16.0, 'motor', 'passes the driving test'],
  [17.0, 'cognitive', 'lands a part-time job', 'job'],
  [17.6, 'language', 'finishes the college essay'],
];

export const KIDACTS = new Set([
  'feed', 'feed_quick', 'play', 'outside', 'read', 'change', 'homework',
  'hangout', 'bedtime', 'bedtime_quick', 'soothe', 'movie',
  'park_play', 'park_picnic',
]);

export const HEAD = { on: false, log: null };
export const toastQ = [];

let S = null;
let N = {};
let travelHook = null;

export function getS() { return S; }
export function getN() { return N; }
export function setTravelHook(fn) { travelHook = fn; }

export function toast(msg, cls = '') {
  if (HEAD.on) {
    if (HEAD.log) HEAD.log.push((S.h / 24).toFixed(2) + ' ' + msg);
    return;
  }
  toastQ.push({ msg, cls });
}

export function clockStr(h = S ? S.h : 0) {
  const c = ((h % 24) + 6) % 24;
  const hh = Math.floor(c);
  const mm = Math.floor(((c - hh) * 60) / 5) * 5;
  return ((hh + 11) % 12 + 1) + ':' + String(mm).padStart(2, '0') + (hh < 12 ? ' AM' : ' PM');
}

export function seasonOf(h = S ? S.h : 0) {
  const idx = Math.floor(h / 24) % 4;
  return [
    { id: 'spring', name: 'Spring', icon: '🌸', leaf: 0x4ca64c, grass: 0x4e8036 },
    { id: 'summer', name: 'Summer', icon: '☀️', leaf: 0x2d6c2c, grass: 0x456e2d },
    { id: 'fall',   name: 'Autumn', icon: '🍂', leaf: 0xc96b2b, grass: 0x6c6e2f },
    { id: 'winter', name: 'Winter', icon: '❄️', leaf: 0x5c7975, grass: 0x6f7f73 },
  ][idx];
}

export const sleepNeed = a => (a < 1 ? 14 : a < 3 ? 12.5 : a < 6 ? 11.5 : a < 13 ? 10.5 : 9);
export function bedtime(a) {
  let b = a < 1 ? 19 : a < 6 ? 19.5 : a < 10 ? 20.5 : a < 13 ? 21.5 : 22.5;
  if (a >= 10 && S && S.flags.phone === 'free') b += 1.65;
  return b;
}
export const screenLimit = a => (a < 2 ? 0.15 : a < 6 ? 1 : a < 13 ? 2 : 3);
export const diaper = () => !(S && S.miles.potty);

export function needList(a) {
  const l = ['food', 'rest'];
  if (diaper()) l.push('clean');
  l.push('fun', 'love');
  if (a >= 6) l.push('school');
  return l;
}

export function wellbeing(a) {
  const l = needList(a);
  let sum = 0;
  for (const k of l) sum += S.kid[k];
  return sum / l.length;
}

export const ratio = s => (S.kid.skills[s] + 1.5) / ((S.h / 24 / 18) * 100 + 1.5);

export function addXP(v) {
  S.xp += v;
  while (S.lvl < PERKS.length && S.xp >= (S.lvl + 1) * XP_PER_LEVEL) {
    const p = PERKS[S.lvl++];
    S.perks[p[0]] = 1;
    toast(`⭐ Dad Level ${S.lvl}: ${p[1]} — ${p[2]}.`, 'mile');
  }
}

export function style(axis, amt = 1) {
  if (S && S.style && axis in S.style) S.style[axis] += amt;
}

export function fx(o) {
  for (const k in o) {
    const v = o[k];
    if (k === 'bond' || k === 'marriage' || k === 'careerBar') S[k] = clamp(S[k] + v);
    else if (k === 'money') S.money += v;
    else if (k === 'xp') addXP(v);
    else if (k in S.dad) S.dad[k] = clamp(S.dad[k] + v);
    else if (k === 'load') S.mom.load = clamp(S.mom.load + v);
    else if (k === 'skills') {
      for (const s in v) S.kid.skills[s] = Math.max(0, S.kid.skills[s] + v[s]);
    } else if (k === 'flag') Object.assign(S.flags, v);
    else if (k in S.kid) S.kid[k] = clamp(S.kid[k] + v);
  }
}

export function layoff(need, mult, same) {
  S.employed = false;
  S.hunt = 0;
  S.huntNeed = need;
  S.rehire = mult;
  S.flags.sameField = same;
  S.dad.mind = clamp(S.dad.mind - 12);
}

const { EV, EVENTS, FOLLOW } = createEvents({
  getS, getN, fx, layoff, money, screenLimit, ratio, toast, style,
});
export { EV, EVENTS, FOLLOW };

export function newGame(cfg) {
  const C = CAREERS[cfg.career];
  const girl = cfg.sex === 'girl';
  N = {
    k: cfg.kid || 'Charlie',
    w: cfg.spouse || 'Alex',
    he: girl ? 'she' : 'he',
    him: girl ? 'her' : 'him',
    his: girl ? 'her' : 'his',
    He: girl ? 'She' : 'He',
    kid: girl ? 'daughter' : 'son',
  };
  S = {
    h: 0,
    loc: 'home',
    career: cfg.career,
    sex: cfg.sex,
    salary: C.salary,
    employed: true,
    hunt: 0,
    huntNeed: 0,
    rehire: 1,
    clevel: 1,
    decayMul: 1,
    dad: { energy: 88, fitness: 64, mind: 80, social: 64 },
    bond: 48,
    marriage: 82,
    careerBar: 52,
    money: 9500,
    fund: 0,
    contrib: 0,
    groceries: 2,          // fresh meal days stocked
    upgrades: {},
    style: { warmth: 0, structure: 0, presence: 0, provider: 0 },
    kid: {
      food: 76, rest: 84, clean: 86, fun: 74, love: 76, school: 76,
      skills: { motor: 0, language: 0, social: 0, cognitive: 0 },
      asleep: false, nap: false, sleepy: false, sleepyT: 0,
      crying: false, cryT: 0, wokeDad: false, away: false,
      busy: null, upset: null, spot: 'mat', arrived: true, arriveT: 0,
      screen: false, wakes: [], withDad: false,
    },
    mom: {
      load: 32, task: null, spot: 'couchM', arrived: true, arriveT: 0,
      atWork: false, asleep: false, gone: false, withDad: false,
    },
    mess: 16,
    tv: false,
    workToday: 0,
    screenToday: 0,
    screenAvg: 0,
    fitAvg: 64,
    flags: {},
    fired: {},
    queue: [],
    xp: 0,
    lvl: 0,
    perks: {},
    miles: {},
    mileLog: [],
    hyper: false,
    divorced: false,
    act: null,
    event: null,
    over: false,
    paused: false,
    dayIdx: 0,
    nightDay: -1,
    cool: {},
    stats: { work: 0, kid: 0, sleep: 0, couple: 0, screen: 0, good: 0, total: 0, promos: 0, parkTrips: 0, townTrips: 0, officeDays: 0 },
  };
  return S;
}

export function buyUpgrade(id) {
  const u = UPGRADES.find(x => x.id === id);
  if (!u || S.upgrades[id]) return false;
  if (S.money < u.cost) {
    toast(`Need ${money(u.cost)} in savings for ${u.name}.`, 'warn');
    return false;
  }
  S.money -= u.cost;
  S.upgrades[id] = true;
  sfx('cash');
  toast(`🏠 Installed ${u.name}!`, 'good');
  return true;
}

export function travelTo(dest, opts = {}) {
  if (!S || !LOCATIONS[dest]) return false;
  if (S.loc === dest) return false;
  if (S.act) stopAct();
  const age = S.h / 24;
  const K = S.kid, M = S.mom;

  // Can't leave a baby/young child alone without spouse home or daycare/sitter
  const kidNeedsSupervision = !K.away && !K.asleep && age < 11;
  const momHomeFree = !M.gone && !M.atWork && !M.asleep;

  let bringKid = false;
  let bringMom = false;

  if (dest === 'park') {
    if (!K.away && !K.asleep && !K.crying) bringKid = true;
    if (momHomeFree) bringMom = true;
    S.stats.parkTrips++;
  } else if (dest === 'town') {
    if (opts.dateMode && momHomeFree) {
      bringMom = true;
      bringKid = false;
      if (age < 12 && !K.away) {
        const fee = S.upgrades.sitter ? 20 : 60;
        S.money -= fee;
        toast(`🧸 Babysitter booked (${money(fee)}). Enjoy Main Street with ${N.w}!`, 'good');
      }
    } else {
      if (!K.away && !K.asleep && !K.crying && (!momHomeFree || age >= 1)) bringKid = true;
      if (momHomeFree && !bringKid) bringMom = false;
      else if (momHomeFree && opts.withMom) bringMom = true;
    }
    S.stats.townTrips++;
  } else if (dest === 'work') {
    if (kidNeedsSupervision && !momHomeFree && !S.flags.sitterHelp) {
      // Sitter / drop-in backup if spouse isn't home
      const fee = S.upgrades.sitter ? 20 : 50;
      S.money -= fee;
      toast(`🧸 Drop-in sitter covered ${N.k} while you head to work (${money(fee)}).`, 'dim');
    }
    S.stats.officeDays++;
  }

  S.loc = dest;
  K.withDad = bringKid;
  M.withDad = bringMom;
  if (K.busy === 'mom' && bringKid) { K.busy = null; M.task = null; }
  if (bringMom) M.task = null;

  // Small realistic drive time (12 in-game minutes)
  if (!HEAD.on) {
    step(0.2);
    sfx('travel');
    const who = bringKid && bringMom ? ` with ${N.w} & ${N.k}` : bringMom ? ` with ${N.w}` : bringKid ? ` with ${N.k}` : '';
    const locName = dest === 'work' ? CAREERS[S.career].workName : LOCATIONS[dest].name;
    toast(`${LOCATIONS[dest].icon} Arrived at ${locName}${who}.`, 'dim');
  }
  if (travelHook) travelHook(dest);
  return true;
}

/* ---------- Activities & Stances ---------- */
export function offered(id) {
  const K = S.kid, M = S.mom, a = S.h / 24, dayH = S.h % 24;
  switch (id) {
    // Home
    case 'sleep': return 'Sleep';
    case 'work': return S.employed ? (S.career === 'blue' ? 'Side estimates & paperwork' : 'Work from home') : 'Job hunt';
    case 'work_crunch_home': return S.employed ? 'Push hard / overtime (WFH)' : 'Intense interview prep';
    case 'exercise': return S.upgrades.gymrack ? 'Lift on power rack' : 'Work out';
    case 'relax': return M.gone ? 'Sit & unwind' : `Unwind (${N.w} may join)`;
    case 'movie': return (!K.away && !K.asleep && a >= 2) ? `Family movie together` : null;
    case 'chores': return 'Dishes & laundry';
    case 'coffee': return S.upgrades.espresso ? 'Pull an espresso' : null;
    case 'feed': return a < 0.5 ? `Give ${N.k} a bottle` : a < 3 ? `Feed ${N.k}` : (dayH >= 10.5 && dayH < 14.5 ? (S.groceries > 0 ? 'Cook family dinner (fresh)' : 'Cook family dinner') : (S.groceries > 0 ? `Cook fresh meal for ${N.k}` : `Make ${N.k} a meal`));
    case 'feed_quick': return a >= 1 ? 'Quick microwave / takeout ($22)' : null;
    case 'play': return a < 0.6 ? 'Tummy time' : a < 10 ? `Play with ${N.k}` : 'Play a board game';
    case 'outside': return a < 1 ? null : a < 6 ? 'Play in the yard' : a < 12 ? (S.upgrades.hoop ? 'Shoot hoops & play' : 'Play catch') : 'Shoot hoops';
    case 'read': return a < 10 ? `Read aloud to ${N.k}` : `Real talk about ${N.his} day`;
    case 'change': return diaper() ? 'Change diaper' : null;
    case 'homework': return a >= 6 ? 'Help with homework' : null;
    case 'soothe': return K.crying ? `Soothe ${N.k}` : null;
    case 'bedtime': {
      if (K.crying || K.asleep || a >= 13) return null;
      const bt = bedtime(a) - 6;
      if (K.sleepy || dayH >= bt - 1.2) return a < 9 ? 'Full bedtime routine (bath, book, tuck-in)' : 'Goodnight talk';
      if (a < 4 && K.rest < 52) return 'Put down for a nap';
      return null;
    }
    case 'bedtime_quick': {
      if (K.crying || K.asleep || a >= 13) return null;
      const bt = bedtime(a) - 6;
      if (K.sleepy || dayH >= bt - 1.2) return 'Quick lights-out (fast)';
      return null;
    }
    case 'hangout': return a < 2 ? `Cuddle ${N.k}` : `Hang out with ${N.k}`;
    case 'couple': return M.gone ? null : `Talk with ${N.w}`;

    // Park
    case 'park_play': return K.withDad ? (a < 6 ? `Playground & swings with ${N.k}` : `Ball & hoops with ${N.k}`) : 'Watch the park';
    case 'park_run': return 'Jog the park trail';
    case 'park_bench': return M.withDad ? `Bench chat with ${N.w}` : 'Chat with neighbor dads';
    case 'park_picnic': return (K.withDad || M.withDad) ? 'Family picnic ($18)' : 'Quiet lunch on the grass ($12)';

    // Workplace
    case 'work_office': return S.employed ? (S.career === 'blue' ? 'Pull full site shift' : 'Focused office shift') : 'Apply & meet recruiters';
    case 'work_crunch': return S.employed ? (S.career === 'blue' ? 'Take overtime shift (1.45x pay)' : 'Crunch for promotion (+50% career)') : 'Mock interviews & portfolio';
    case 'work_network': return S.employed ? 'Breakroom coffee & networking' : 'Coffee chat with industry contacts';

    // Town
    case 'town_date': return M.gone ? null : (M.withDad ? `Bistro date with ${N.w} ($65)` : `Call ${N.w} to meet for date ($65)`);
    case 'town_espresso': return 'Solo café espresso ($6)';
    case 'town_groceries': return 'Buy 3 days of fresh groceries ($110)';
    case 'town_gift_w': return M.gone ? null : `Buy flowers / treat for ${N.w} ($45)`;
    case 'town_gift_k': return `Pick up book / toy for ${N.k} ($50)`;
    case 'town_pub': return 'Grab a quick round with friends ($32)';
    case 'town_pub_late': return 'Stay for a long night with friends ($55)';
    case 'town_clinic': return S.hyper ? 'Blood pressure check & coaching ($40)' : 'Wellness check / parenting workshop ($40)';
  }
  return null;
}

export function actBlock(id) {
  const K = S.kid, M = S.mom, a = S.h / 24;
  if (KIDACTS.has(id)) {
    if (S.loc === 'home') {
      if (K.away) return `${N.k} is at ${a >= 5 ? 'school' : 'daycare'}`;
      if (id === 'soothe') return K.crying ? '' : 'Nothing to soothe';
      if (K.crying) return `${N.k} is crying — go to the crib/bed`;
      if (K.asleep) return `${N.k} is asleep`;
    } else if (S.loc === 'park') {
      if (id === 'park_play' && !K.withDad) return `${N.k} is not at the park with you`;
    }
  }
  if (id === 'couple') {
    if (M.atWork) return `${N.w} is at work`;
    if (M.asleep) return `${N.w} is asleep`;
    if (M.task && M.task.kid) return `${N.w} is busy with ${N.k}`;
  }
  if (id === 'town_date') {
    if (M.gone) return 'Not available';
    if (M.atWork) return `${N.w} is at work`;
    if (M.asleep) return `${N.w} is asleep`;
  }
  if (id === 'coffee' && S.cool.coffee > S.h) {
    return `Coffee cooldown (${Math.ceil(S.cool.coffee - S.h)}h)`;
  }
  if (id === 'town_gift_w' && S.cool.giftW > S.h) return 'Already brought flowers today';
  if (id === 'town_gift_k' && S.cool.giftK > S.h) return 'Already picked up a gift today';
  if (id === 'town_clinic' && S.cool.clinic > S.h) return 'Already checked in this year';
  return '';
}

export function startAct(id) {
  if (!offered(id)) return false;
  const b = actBlock(id);
  if (b) {
    toast(b + '.', 'dim');
    return false;
  }
  if (S.act) stopAct();

  // Instant actions (purchases / espresso / clinic)
  if (id === 'coffee') {
    S.dad.energy = clamp(S.dad.energy + 18);
    S.dad.mind = clamp(S.dad.mind + 4);
    S.cool.coffee = S.h + 8;
    sfx('coffee');
    toast('☕ Fresh espresso! +18 Energy, +4 Mind.', 'good');
    return true;
  }
  if (id === 'town_groceries') {
    S.money -= 110;
    S.groceries = Math.min(5, S.groceries + 3);
    sfx('cash');
    toast(`🛒 Stocked fresh groceries (${S.groceries} days in the fridge). Home meals now boost Bond & Health!`, 'good');
    style('structure', 1);
    return true;
  }
  if (id === 'town_gift_w') {
    S.money -= 45;
    S.cool.giftW = S.h + 20;
    fx({ marriage: 10, load: -6 });
    sfx('cash');
    toast(`💐 Picked up flowers for ${N.w}. +10 Marriage!`, 'good');
    style('warmth', 1);
    return true;
  }
  if (id === 'town_gift_k') {
    S.money -= 50;
    S.cool.giftK = S.h + 20;
    fx({ fun: 12, love: 8, bond: 3, skills: { language: 0.4, motor: 0.3 } });
    sfx('cash');
    toast(`🎁 Picked up a great book & toy for ${N.k}!`, 'good');
    style('warmth', 1);
    return true;
  }
  if (id === 'town_espresso') {
    S.money -= 6;
    fx({ energy: 12, mind: 6 });
    sfx('coffee');
    toast('☕ Quiet café espresso on Main Street. +12 Energy, +6 Mind.', 'good');
    return true;
  }
  if (id === 'town_clinic') {
    S.money -= 40;
    S.cool.clinic = S.h + 22;
    fx({ mind: 8, fitness: 5, bond: 3 });
    sfx('good');
    toast(S.hyper ? '🩺 BP check & coaching at the clinic. +5 Fitness, +8 Mind.' : '🩺 Great parenting workshop at the clinic. +8 Mind, +3 Fatherhood.', 'good');
    return true;
  }

  // Upfront fees for continuous town/park/quick acts
  if (id === 'feed_quick') S.money -= 22;
  if (id === 'park_picnic') S.money -= (S.kid.withDad || S.mom.withDad) ? 18 : 12;
  if (id === 'town_date') {
    S.money -= 65;
    if (!S.mom.withDad) {
      S.mom.withDad = true;
      const age = S.h / 24;
      if (age < 12 && !S.kid.away && !S.kid.withDad) {
        const fee = S.upgrades.sitter ? 20 : 60;
        S.money -= fee;
        toast(`🧸 Sitter watching ${N.k} (${money(fee)}). ${N.w} joins you at the Bistro!`, 'good');
      }
    }
  }
  if (id === 'town_pub') S.money -= 32;
  if (id === 'town_pub_late') S.money -= 55;

  S.act = { id, t: 0, p: 0 };
  if (KIDACTS.has(id)) {
    S.kid.busy = 'dad';
    if (S.mom.task && S.mom.task.kid) S.mom.task = null;
  }
  sfx('start');
  return true;
}

export function stopAct() {
  if (!S || !S.act) return;
  if (KIDACTS.has(S.act.id) && S.kid.busy === 'dad') S.kid.busy = null;
  S.act = null;
}

function putDown(nap) {
  const K = S.kid;
  K.asleep = true;
  K.nap = !!nap;
  K.sleepy = false;
  K.sleepyT = 0;
  K.busy = null;
  K.crying = false;
  if (S.mom.task && S.mom.task.kid) S.mom.task = null;
}

export function kidSpot() {
  const K = S.kid, A = S.act, M = S.mom, a = S.h / 24, dayH = S.h % 24;
  if (S.loc !== 'home') {
    if (!K.withDad) return 'gone';
    if (S.loc === 'park') {
      if (A && A.id === 'park_picnic') return 'park_picnicK';
      if (A && A.id === 'park_play') return 'park_playK';
      return 'park_playK';
    }
    if (S.loc === 'town') return 'town_strollK';
    return 'gone';
  }
  if (K.away) return 'gone';
  if (K.asleep || K.crying) return 'bedK';
  const st = t => ({
    feed: a < 3.5 ? 'highchair' : 'chairK',
    feed_quick: a < 3.5 ? 'highchair' : 'chairK',
    dinner: 'chairK',
    play: 'mat',
    outside: 'yardK',
    read: 'armchair',
    love: 'armchair',
    change: 'changeK',
    homework: 'deskK',
    bedtime: 'bedK',
    bedtime_quick: 'bedK',
    soothe: 'bedK',
    movie: 'couchK2',
  })[t];
  const here = () => (K.spot === 'arms' || K.spot === 'gone' || K.spot === 'couchK' || K.spot.startsWith('park_') || K.spot.startsWith('town_')) ? 'mat' : K.spot;
  if (K.busy === 'dad' && A) {
    if (a < 1 && (A.id === 'feed' || A.id === 'read' || A.id === 'hangout')) return 'arms';
    return st(A.id) || here();
  }
  if (K.busy === 'mom' && M.task) {
    if (M.task.type === 'feed' && a < 0.5) return 'couchK';
    return st(M.task.type) || here();
  }
  if (S.tv) return 'tvK';
  return a < 1.2 ? 'mat' : a < 5 ? 'wander' : a < 12 ? (dayH >= 9.5 && dayH < 12 ? 'yardK' : 'rugK') : 'teen';
}

export function momSpot() {
  const M = S.mom, T = M.task, a = S.h / 24;
  if (S.loc !== 'home') {
    if (!M.withDad || M.gone || M.atWork || M.asleep) return 'gone';
    if (S.loc === 'park') return (S.act && S.act.id === 'park_picnic') ? 'park_picnicM' : 'park_benchM';
    if (S.loc === 'town') return 'town_bistroM';
    return 'gone';
  }
  const stay = () => (M.spot === 'gone' || M.spot === 'bedM' || M.spot.startsWith('park_') || M.spot.startsWith('town_')) ? 'couchM' : M.spot;
  if (M.gone || M.atWork) return 'gone';
  if (M.asleep) return 'bedM';
  if (!T) return stay();
  switch (T.type) {
    case 'feed': return a < 0.5 ? 'couchM' : 'tableM';
    case 'dinner': return 'chairM';
    case 'change': return 'changeM';
    case 'play': return 'matM';
    case 'love': return 'armM';
    case 'homework': return 'deskM';
    case 'bedtime': return 'bedKM';
    case 'chores': return 'sinkM';
    case 'talk': return S.act && S.act.id === 'couple' ? stay() : 'couchM';
    default: return 'couchM';
  }
}

/* ---------- Core Simulation Tick ---------- */
export function step(dh) {
  const K = S.kid, D = S.dad, M = S.mom, C = CAREERS[S.career], P = S.perks;
  const age = S.h / 24, dayH = S.h % 24, day = Math.floor(S.h / 24);
  let A = S.act;
  if (day !== S.dayIdx) {
    S.dayIdx = day;
    newDay(day);
    A = S.act;
  }

  // Schedules
  const wasAway = K.away;
  K.away = dayH >= 2 && dayH < 9 && (age >= 5 || (S.flags.care === 'daycare' && age >= 0.25));
  if (K.away && !wasAway) {
    K.withDad = false;
    if (A && KIDACTS.has(A.id)) {
      stopAct();
      A = null;
      toast(`🎒 ${N.k} is off to ${age >= 5 ? 'school' : 'daycare'}.`, 'dim');
    }
    K.busy = null;
    if (M.task && M.task.kid) M.task = null;
    if (K.asleep && !K.nap) K.asleep = false;
  }
  M.gone = S.divorced;
  M.atWork = !M.gone && dayH >= 2 && dayH < 10 && age >= 0.25 && !(S.flags.care === 'home' && age < 5);
  M.asleep = !M.gone && !M.atWork && (dayH >= 16.75 || dayH < 0.25);
  if (M.atWork || M.asleep || M.gone) M.withDad = false;

  const dadHome = S.loc === 'home';
  const dadAwake = !(A && A.id === 'sleep');
  const momFreeHome = dadHome && !M.gone && !M.atWork && !M.asleep;
  const need = sleepNeed(age), bt = bedtime(age) - 6;

  // Kid sleep logic
  if (K.asleep) {
    if (K.nap) {
      if (age < 1 ? (K.rest > 90 || K.food < 22 || dayH > 11.5) : dayH >= 8.5) {
        K.asleep = false;
        K.nap = false;
      }
    } else if (dayH >= 0.5 && dayH < 2) {
      K.asleep = false;
    }
  } else if (!K.crying) {
    if (dadHome) {
      if (age < 1 && K.rest < 40 && dayH > 1.5 && dayH < 10.5 && K.busy !== 'dad') putDown(1);
      else if (age >= 1 && age < 4 && dayH >= 6.5 && dayH < 7.5 && K.busy !== 'dad') putDown(1);
    }
    if (!K.asleep && dayH >= bt && !K.away) {
      K.sleepy = true;
      K.sleepyT += dh;
      if (K.withDad && dayH >= bt + 1.5) {
        toast(`🌙 It is late — ${N.k} is nodding off. Head home for bedtime!`, 'warn');
        K.sleepyT = 0;
      } else if (dadHome && age >= 9 && K.busy !== 'dad') {
        putDown();
      } else if (dadHome && K.sleepyT > (age < 3 ? 1.6 : 2.6) && K.busy !== 'dad') {
        putDown();
        K.love = clamp(K.love - 6);
      }
    }
  }

  // Night wakings (first 4 years)
  if (dayH >= 16 && S.nightDay !== day) {
    S.nightDay = day;
    K.wakes = [];
    const r = Math.random;
    const n = age < 0.5 ? 2 : age < 1 ? 1 : age < 2 ? (r() < 0.45 ? 1 : 0) : age < 5 ? (r() < 0.12 ? 1 : 0) : 0;
    for (let i = 0; i < n; i++) K.wakes.push({ t: 17.5 + (i + r()) * (5 / n), mom: n === 2 && i === 0 && !M.gone });
  }
  if (K.wakes.length && dayH > 16 && dayH >= K.wakes[0].t) {
    const w = K.wakes.shift();
    if (K.asleep && !K.nap) {
      if (w.mom) {
        M.load = clamp(M.load + 5);
        toast(`${N.w} handled the ${clockStr()} night feed.`, 'dim');
      } else {
        K.asleep = false;
        K.crying = true;
        K.cryT = 0;
        K.wokeDad = false;
      }
    }
  }
  if (K.crying) {
    K.cryT += dh;
    if (!K.wokeDad) {
      K.wokeDad = true;
      if (dadHome) {
        if (A && A.id === 'sleep') { stopAct(); A = null; }
        sfx('cry');
        toast(`😢 ${clockStr()}. ${N.k} is crying in the bedroom.`, 'warn');
      }
    }
    if (!(A && A.id === 'soothe')) {
      const ignoring = !dadHome || (A && A.id === 'sleep');
      if (!M.gone && !M.withDad && (K.cryT > 1.35 || (ignoring && K.cryT > 0.25))) {
        putDown();
        M.load = clamp(M.load + 8);
        if (dadHome) S.marriage = clamp(S.marriage - 2.2);
        toast(`${N.w} got up to soothe ${N.k}.`, 'dim');
      } else if (K.cryT > 2.3) {
        putDown();
        K.love = clamp(K.love - 9);
      }
    }
  }

  // ----- Dad baseline drains (rebalanced so Blue Collar isn't doomed to faint!)
  const awake = dadAwake;
  const hyperPen = S.hyper ? (S.flags.bpMeds ? 1.08 : 1.18) : 1;
  if (awake) D.energy -= 4.25 * hyperPen * dh;
  D.fitness -= 0.58 * dh;
  D.social -= 0.85 * dh;
  let mind = awake ? -0.45 : 0;
  if (awake && D.energy < 28) mind -= 0.45 + 1.8 * (1 - D.energy / 28);
  if (D.social < 24) mind -= 0.85;
  if (S.mess > 72) mind -= 0.3;
  if (S.money < 0) mind -= 0.65;
  if (!S.employed) mind -= 0.7;

  const eff =
    (D.mind > 30 ? 1 : 0.65) *
    (D.energy > 18 ? 1 : 0.65) *
    (K.upset && !K.away && dadHome ? 0.65 : 1) *
    (P.cal ? 1.12 : 1);
  const teen = age >= 12;
  const bondUp = r => { S.bond += r * dh * (P.jokes ? 1.2 : 1) * (teen ? 0.88 : 1); };
  const loveUp = r => { K.love += r * dh * (teen ? 0.8 : 1); };
  const couple = (multC = 1) => {
    S.marriage += 7.5 * multC * (P.listen ? 1.25 : 1) * (S.flags.counsel ? 1.18 : 1) * dh;
    mind += 4.5 * multC;
    D.social += 8.5 * multC * dh;
    M.load -= 6.5 * multC * dh;
    S.stats.couple += dh;
  };
  const mult = { motor: 1, language: 1, social: 1, cognitive: 1 };
  const quick = P.swaddle ? 1.3 : 1;

  // Timeout fallback so NPCs NEVER stall an activity
  if (!K.arrived) { K.arriveT += dh; if (K.arriveT > 0.35) K.arrived = true; } else K.arriveT = 0;
  if (!M.arrived) { M.arriveT += dh; if (M.arriveT > 0.35) M.arrived = true; } else M.arriveT = 0;

  // ----- Active Dad Activity
  if (A) {
    A.t += dh;
    const withKid = KIDACTS.has(A.id);
    const ready = !withKid || K.arrived;
    if (withKid && ready) {
      S.stats.kid += dh;
      if (momFreeHome || M.withDad) M.load -= 2 * dh;
    }

    const doWork = (locBonus, crunch) => {
      const deskBonus = S.loc === 'home' && S.upgrades.deskpro ? 1.18 : 1;
      const stressMul = (S.loc === 'home' && S.upgrades.deskpro ? 0.8 : 1) * (crunch ? 1.55 : 1);
      const totalEff = eff * locBonus * deskBonus * (crunch ? 1.42 : 1);
      const takeHome = S.salary * (1 - C.tax);
      const levelScale = 1 / (1 + (S.clevel - 1) * 0.42);
      if (S.employed) {
        S.careerBar += 2.0 * totalEff * levelScale * dh;
        if (S.career === 'blue') {
          if (S.workToday < 7.5) {
            S.money += (takeHome / 7.5) * dh;
          } else if (S.workToday < 8.5) {
            S.money += (takeHome / 7.5) * 1.3 * dh;
          }
        } else {
          if (S.workToday < WORKDAY) S.money += (takeHome / WORKDAY) * dh;
          else if (crunch && S.workToday < 8.5) S.money += (takeHome / 34) * dh;
        }
        S.workToday += dh;
      } else {
        S.hunt += totalEff * dh;
        if (S.hunt >= S.huntNeed) {
          S.employed = true;
          S.salary *= S.rehire;
          S.careerBar = 48;
          stopAct();
          toast(`🤝 Offer accepted: ${money(S.salary)}/yr! Back in business.`, 'good');
          addXP(35);
        }
      }
      D.energy -= C.tire * (crunch ? 1.4 : 1) * dh;
      mind -= C.stress * stressMul;
      D.social += (S.loc === 'work' ? 1.1 : 0.3) * dh;
      D.fitness += C.fit * (S.loc === 'work' ? 1.15 : 0.4) * dh;
      S.stats.work += dh;
    };

    switch (A.id) {
      case 'sleep':
        D.energy += 13.2 * (P.nap ? 1.15 : 1) * dh;
        mind += 1.8;
        S.stats.sleep += dh;
        // Auto wake cleanly once rested during morning hours
        if (dayH >= 0 && dayH < 4 && D.energy >= 92 && A.t >= 2.5) {
          stopAct();
          toast(`☀️ Woke up rested at ${clockStr()}.`, 'dim');
        }
        break;
      case 'work': doWork(S.career === 'blue' ? 0.78 : 0.92, false); break;
      case 'work_crunch_home': doWork(S.career === 'blue' ? 0.82 : 0.95, true); break;
      case 'work_office': doWork(1.16, false); break;
      case 'work_crunch': doWork(1.22, true); break;
      case 'work_network':
        D.social += 14 * dh;
        mind += 4.5;
        if (S.employed) S.careerBar += 1.15 * eff * dh;
        else { S.hunt += 1.15 * eff * dh; if (S.hunt >= S.huntNeed) { S.employed = true; S.salary *= S.rehire; S.careerBar = 48; stopAct(); toast(`🤝 A breakroom referral landed an offer: ${money(S.salary)}/yr!`, 'good'); addXP(35); } }
        D.energy -= 0.7 * dh;
        S.stats.work += dh * 0.5;
        break;
      case 'exercise': {
        const rack = S.upgrades.gymrack ? 1.35 : 1;
        D.fitness += 34 * rack * (P.gym ? 1.25 : 1) * dh;
        mind += 5.5;
        D.energy -= (S.upgrades.gymrack ? 3.8 : 4.8) * dh;
        if (D.fitness >= 100) stopAct();
        break;
      }
      case 'relax':
        if (M.task && M.task.type === 'talk' && M.arrived) couple(1);
        else mind += 7.5;
        D.energy += 1.4 * dh;
        break;
      case 'movie':
        if (ready) {
          K.fun += 28 * dh;
          loveUp(14);
          bondUp(5.5);
          mind += 5.5;
          D.energy += 0.6 * dh;
          if (momFreeHome) couple(0.55);
          // Co-viewed family movie counts at only 35% of solo screen time!
          S.screenToday += 0.35 * dh;
        }
        break;
      case 'couple':
        if (M.arrived) couple(1.05);
        if (!momFreeHome) stopAct();
        break;
      case 'chores':
        S.mess -= 44 * (P.chef ? 1.3 : 1) * dh;
        mind -= 0.25;
        if (momFreeHome) { S.marriage += 1.5 * dh; M.load -= 3.5 * dh; }
        if (S.mess <= 0) stopAct();
        break;
      case 'feed':
        if (ready) {
          const fresh = S.groceries > 0;
          K.food += (fresh ? 68 : 56) * (P.chef ? 1.3 : 1) * dh;
          bondUp(fresh ? 4.5 : 3);
          if (fresh) { D.fitness += 2 * dh; loveUp(6); }
          const dinner = M.task && M.task.type === 'dinner' && M.arrived;
          if (dinner) { loveUp(12); S.marriage += 3 * dh; D.social += 4.5 * dh; mult.language += 2.2; mult.social += 2.2; }
          if (K.food >= 100 && (!dinner || A.t > 1.0)) stopAct();
        }
        break;
      case 'feed_quick':
        if (ready) {
          K.food += 125 * dh;
          bondUp(1.2);
          S.mess += 1.5 * dh;
          if (K.food >= 100) stopAct();
        }
        break;
      case 'play':
        if (ready) { K.fun += 40 * dh; loveUp(15); bondUp(7.5); mind += 3.5; D.energy -= 0.9 * dh; mult.social += 4.2; mult.motor += 2.2; mult.cognitive += 1.2; }
        break;
      case 'outside':
        if (ready) {
          const hB = S.upgrades.hoop ? 1.35 : 1;
          K.fun += 36 * hB * dh;
          loveUp(13 * hB);
          bondUp((P.coach ? 12 : 7.5) * hB);
          D.fitness += 10 * hB * dh;
          mind += 4.8;
          D.energy -= 1.8 * dh;
          mult.motor += 6.2 * hB;
          mult.social += 2.2;
        }
        break;
      case 'read':
        if (ready) {
          loveUp(28); K.fun += 11 * dh; bondUp(7.5); mind += 1.6;
          if (age < 10) { mult.language += 5.4; mult.cognitive += 2.2; }
          else { mult.language += 2.4; mult.social += 3.5; }
        }
        break;
      case 'hangout':
        if (ready) { loveUp(25); K.fun += 10 * dh; bondUp(6.5); mind += 2.2; mult.social += 3.2; mult.language += 2.2; }
        break;
      case 'change':
        if (ready) { K.clean += 160 * quick * dh; bondUp(2); if (K.clean >= 100) stopAct(); }
        break;
      case 'homework':
        if (ready) { K.school += 38 * dh; bondUp(5.5); mind -= 0.35; mult.cognitive += 5.4; if (K.school >= 100) stopAct(); }
        break;
      case 'bedtime':
        if (ready) {
          A.p += dh * quick;
          loveUp(22);
          bondUp(5);
          mult.language += 2.5;
          if (A.p >= 0.42) {
            const nap = dayH < bt - 1.5;
            putDown(nap);
            K.rest = clamp(K.rest + 8);
            S.bond += 4;
            if (momFreeHome) S.marriage = clamp(S.marriage + 1.5);
            S.act = null;
            sfx('good');
            toast(nap ? `😴 ${N.k} is down for a cozy nap.` : `🌙 Bath, book, tuck-in. ${N.k} is fast asleep.`, 'good');
          }
        }
        break;
      case 'bedtime_quick':
        if (ready) {
          A.p += dh * quick * 2.2;
          if (A.p >= 0.42) {
            putDown(false);
            S.bond += 1;
            S.act = null;
            toast(`🌙 Quick lights-out. ${N.k} is in bed.`, 'dim');
          }
        }
        break;
      case 'soothe':
        if (ready) {
          A.p += dh * quick;
          if (A.p >= 0.38) {
            putDown();
            S.bond += 3;
            if (!M.gone) S.marriage = clamp(S.marriage + 1.8);
            S.act = null;
            sfx('good');
            toast(`🌟 ${N.k} settled back to sleep. Heroic work.`, 'good');
          }
        }
        break;

      // Park activities
      case 'park_play':
        if (ready) {
          K.fun += 48 * dh;
          loveUp(16);
          bondUp(P.coach ? 15 : 10);
          D.fitness += 12 * dh;
          D.social += 6 * dh;
          mind += 6;
          D.energy -= 1.8 * dh;
          mult.motor += 7.5;
          mult.social += 4.5;
        }
        break;
      case 'park_run':
        D.fitness += 38 * (P.gym ? 1.25 : 1) * dh;
        mind += 8.5;
        D.energy -= 4.2 * dh;
        if (D.fitness >= 100 && D.mind >= 95) stopAct();
        break;
      case 'park_bench':
        if (M.withDad) {
          couple(1.15);
          if (K.withDad) { K.fun += 15 * dh; loveUp(6); }
        } else {
          D.social += 20 * dh;
          mind += 6.5;
          D.energy += 0.8 * dh;
        }
        break;
      case 'park_picnic':
        if (K.withDad) { K.food += 65 * dh; loveUp(16); bondUp(7); }
        if (M.withDad) couple(0.9);
        mind += 5;
        D.energy += 2 * dh;
        if (A.t >= 0.9 && (!K.withDad || K.food >= 96)) { stopAct(); toast('🧺 Lovely park picnic!', 'good'); }
        break;

      // Town activities (in-world, no black screen!)
      case 'town_date':
        couple(1.55);
        mind += 3;
        if (A.t >= 1.6) {
          stopAct();
          sfx('good');
          toast(`🍷 Incredible date at the Main Street Bistro with ${N.w}!`, 'good');
        }
        break;
      case 'town_pub':
        D.social += 26 * dh;
        mind += 9;
        if (A.t >= 1.2) {
          stopAct();
          toast('🍻 Great catching up with friends — still home at a reasonable hour.', 'good');
        }
        break;
      case 'town_pub_late':
        D.social += 36 * dh;
        mind += 13;
        D.energy -= 3.5 * dh;
        if (!M.gone) S.marriage -= 1.2 * dh;
        if (A.t >= 2.2) {
          stopAct();
          toast('🍻 Legendary late night with the crew! Tomorrow morning might hurt.', 'good');
        }
        break;
    }
    A = S.act;
  }

  // ----- Spouse autonomous AI at home
  if (momFreeHome) {
    let T = M.task;
    if (T && T.kid && (K.away || K.asleep || K.busy === 'dad' || K.crying || K.withDad)) T = M.task = null;
    if (T && T.type === 'talk' && !(A && (A.id === 'relax' || A.id === 'couple'))) T = M.task = null;
    if (T && T.type === 'dinner' && !(A && A.id === 'feed')) T = M.task = null;
    if (!T || T.type === 'idle' || T.type === 'chores') {
      const kidOK = !K.away && !K.asleep && !K.crying && K.busy !== 'dad' && !K.withDad;
      let pick = null;
      if (kidOK) {
        if (K.sleepy && age < 9 && K.sleepyT > 0.5) pick = { type: 'bedtime', kid: 1, p: 0 };
        else {
          let lo = 42;
          const c = [['food', 'feed'], ['love', 'love']];
          if (diaper()) c.push(['clean', 'change']);
          if (age < 10) c.push(['fun', 'play']);
          if (age >= 6) c.push(['school', 'homework']);
          for (const [k, t] of c) if (K[k] < lo) { lo = K[k]; pick = { type: t, need: k, kid: 1 }; }
        }
      }
      if (!pick && A && (A.id === 'relax' || A.id === 'couple')) pick = { type: 'talk' };
      if (!pick && A && A.id === 'feed' && age >= 3 && dayH >= 10.5 && dayH < 14.5) pick = { type: 'dinner' };
      if (!pick && S.mess > 55) pick = { type: 'chores' };
      if (pick && !(T && T.type === pick.type)) {
        M.task = T = pick;
        if (pick.kid) K.busy = 'mom';
      }
      if (!T) M.task = T = { type: 'idle' };
    }
    const me = 0.85 * (M.load > 70 ? 0.65 : 1);
    const lg = (S.flags.mload ? 0.78 : 1) * dh;
    const done = () => { M.task = null; if (K.busy === 'mom') K.busy = null; };
    if (M.arrived && (!T.kid || K.arrived)) {
      switch (T.type) {
        case 'feed': K.food += 60 * me * dh; M.load += 4.8 * lg; if (K.food >= 92) done(); break;
        case 'change': K.clean += 150 * me * dh; M.load += 4.8 * lg; if (K.clean >= 95) done(); break;
        case 'play': K.fun += 38 * me * dh; K.love += 10 * me * dh; M.load += 4.8 * lg; mult.social += 3; mult.motor += 1.5; if (K.fun >= 88) done(); break;
        case 'love': K.love += 26 * me * dh; K.fun += 8 * dh; M.load += 3.8 * lg; mult.language += 4; mult.cognitive += 1.5; if (K.love >= 85) done(); break;
        case 'homework': K.school += 35 * me * dh; M.load += 4.8 * lg; mult.cognitive += 4; if (K.school >= 88) done(); break;
        case 'bedtime': T.p += dh; M.load += 4.8 * lg; if (T.p >= 0.4) putDown(); break;
        case 'chores': S.mess -= 36 * me * dh; M.load += 3.6 * lg; if (S.mess < 12) done(); break;
        case 'idle': M.load -= 4.2 * dh; break;
      }
    }
  } else {
    M.task = null;
    if (K.busy === 'mom') K.busy = null;
    if (M.asleep) M.load -= 2.8 * dh;
    else if (M.atWork) M.load += 0.75 * dh;
  }

  // ----- Kid needs
  const kAwake = !K.asleep;
  const kidSupervisedAway = K.away || (!dadHome && !K.withDad);
  if (kidSupervisedAway) {
    K.food += (74 - K.food) * 0.45 * dh;
    K.fun += (70 - K.fun) * 0.4 * dh;
    if (diaper()) K.clean += (82 - K.clean) * 0.45 * dh;
    K.love -= 1.0 * dh;
    if (K.away) { mult.cognitive += 0.65; mult.social += 0.65; mult.language += 0.35; mult.motor += 0.25; }
  } else {
    K.food -= (age < 1 ? 6.6 : 5.2) * (kAwake ? 1 : 0.3) * dh;
    if (diaper()) K.clean -= (kAwake ? 4.8 : 1.8) * dh;
    if (kAwake) {
      K.fun -= 5.6 * dh;
      if (!K.busy) K.fun += (age < 1 ? 0 : age < 3 ? 2.2 : age < 6 ? 4.2 : age < 10 ? 6 : 6.5) * dh;
      K.love -= (teen ? 2.3 : 3.2) * dh;
      if (age >= 10 && !K.busy && K.food < (age >= 14 ? 60 : 40)) K.food += 30 * dh;
    }
  }
  if (K.asleep) K.rest += (100 / need) * 1.1 * dh;
  else K.rest -= (100 / (24 - need)) * dh;
  if (age >= 6 && dayH >= 9 && dayH < 16.5 && kAwake) {
    K.school -= 2.4 * dh;
    if (!(A && A.id === 'homework')) K.school += (K.skills.cognitive / 100) * 4.2 * (K.rest > 40 ? 1 : 0.5) * dh;
  }

  // Screens
  K.screen = false;
  if (!kidSupervisedAway && kAwake && !K.busy && dadHome) {
    if (S.tv) {
      K.screen = true;
      K.fun += 40 * dh;
      K.love -= 0.9 * dh;
      S.screenToday += dh;
    } else if (age >= 10 && dayH >= 9) {
      const f = ({ none: 0.9, limits: 1.9, free: 4.5 }[S.flags.phone] || 1.5) / 7;
      S.screenToday += f * dh;
      K.fun += f * 18 * dh;
      K.screen = f > 0.4;
    } else if (S.flags.habit && age < 7 && dayH >= 9 && dayH < 13) {
      S.screenToday += 0.2 * dh;
    }
  }
  if (S.tv && (K.asleep || K.away || !dadHome)) S.tv = false;

  K.upset = null;
  if (K.crying) K.upset = 'cry';
  else if (!kidSupervisedAway && kAwake) {
    let lo = 25;
    for (const k of ['food', 'clean', 'fun', 'love']) {
      if ((k !== 'clean' || diaper()) && K[k] < lo) { lo = K[k]; K.upset = k; }
    }
    if (!K.upset && K.rest < 15) K.upset = 'rest';
  }
  if (K.upset) { S.bond -= 0.9 * dh; if (dadHome && awake) mind -= 0.9; }

  // ----- Slow bars, mess, expenses & debt interest
  S.bond -= 0.31 * dh;
  if (!S.divorced) {
    let m = -0.28;
    if (M.load > 70) m -= 0.32;
    if (S.mess > 70) m -= 0.2;
    if (S.money < 0) m -= 0.28;
    S.marriage += m * dh;
  }
  if (S.employed) S.careerBar -= C.decay * S.decayMul * dh;

  let messRate = (2.1 + (age < 12 ? 0.95 : 0));
  if (S.flags.chores && age >= 7) messRate *= 0.72;
  if (S.upgrades.robovac) messRate *= 0.58;
  if (S.flags.cleaner) messRate *= 0.65;
  S.mess += messRate * dh;

  const daycare = S.flags.care === 'daycare' && age >= 0.25 && age < 5;
  let exp =
    C.living * (S.employed ? 1 : 0.78) +
    (age < 12 ? 14500 : 17000) +
    (daycare ? 13000 : 0) +
    (S.flags.care === 'home' && age >= 0.25 && age < 5 ? 24000 : 0) +
    (S.divorced ? 15000 : 0) +
    (S.flags.travel && age < 16 ? 5500 : 0) +
    (S.flags.cleaner ? 3600 : 0) +
    (S.flags.sitterHelp && age < 13 ? 4500 : 0) -
    (S.flags.spousePromo && !S.divorced ? 12000 : 0);
  if (S.flags.austerity > age) exp *= 0.9;
  exp = Math.max(26000, exp);
  S.expense = exp;
  S.money -= (exp / 24) * dh;

  // Real credit card debt interest if negative!
  if (S.money < 0) {
    S.money += S.money * (0.18 / 24) * dh;
  }

  if (S.contrib > 0) {
    if (S.money > 0) {
      const c = (S.contrib * 12 / 24) * dh;
      S.money -= c;
      S.fund += c;
    } else {
      S.contrib = 0;
      toast('⚠️ 529 contributions paused — checking hit $0.', 'warn');
    }
  }
  S.fund *= Math.pow(1.06, dh / 24);
  if (mind < 0 && P.zen) mind *= 0.8;
  D.mind += mind * dh;
  S.fitAvg += (D.fitness - S.fitAvg) * (dh / 36);

  // ----- Kid Development
  const well = wellbeing(age);
  const q = (0.5 + 0.62 * (well / 100)) * (0.85 + 0.3 * (S.bond / 100)) * 0.88;
  const pen = clamp((Math.max(S.screenAvg, S.screenToday) - screenLimit(age)) * 0.22, 0, 0.58);
  S.screenPen = pen;
  const cap = Math.min(100, (age / 18) * 115 + 2);
  for (const s in mult) {
    let g = 0.232 * q * mult[s];
    if (s !== 'motor') g *= 1 - pen * (s === 'cognitive' ? 0.6 : 1);
    if (s === 'language' && S.flags.catchup > age) g *= 1.6;
    if (K.rest < 30) g *= 0.8;
    K.skills[s] = Math.min(cap, K.skills[s] + g * dh);
  }

  // ----- Clamps & Satisfaction XP
  const hc = S.hyper ? (S.flags.bpMeds ? 92 : 86) : 100;
  D.energy = clamp(D.energy, 0, hc);
  D.fitness = clamp(D.fitness);
  D.mind = clamp(D.mind);
  D.social = clamp(D.social);
  for (const k of ['food', 'rest', 'clean', 'fun', 'love', 'school']) K[k] = clamp(K[k]);
  S.bond = clamp(S.bond);
  S.marriage = clamp(S.marriage);
  S.careerBar = clamp(S.careerBar, 0, 101);
  S.mess = clamp(S.mess);
  M.load = clamp(M.load);

  const parts = [
    (D.energy + D.fitness + D.mind + D.social) / 4,
    S.bond,
    S.divorced ? 28 : S.marriage,
    S.employed ? S.careerBar : 18,
    well,
  ];
  S.sat = (parts.reduce((a, b) => a + b) / 5 / 100) * (0.5 + 0.5 * sat(Math.min(...parts) / 50));
  addXP(S.sat * 10 * dh);

  // ----- Thresholds
  if (S.employed) {
    if (S.careerBar >= 100) {
      if (S.clevel < 5) {
        S.clevel++;
        S.salary *= 1 + C.raise;
        S.careerBar = 52;
        S.stats.promos++;
        addXP(35);
        toast(`📈 Promoted! New salary: ${money(S.salary)}/yr.`, 'good');
      } else {
        const bonus = Math.round(S.salary * 0.06);
        S.money += bonus;
        S.careerBar = 60;
        addXP(25);
        toast(`🏆 Top-band performance bonus: +${money(bonus)}!`, 'good');
      }
    } else if (S.careerBar <= 0) {
      layoff(6.5, 0.85, S.flags.sameField);
      S.queue.push(EV.fired);
    } else if (S.careerBar < 18 && !(S.cool.cw > age)) {
      S.cool.cw = age + 1.2;
      toast('📉 Your boss asks for "a quick sync on priorities." Put in hours at the Workplace or Desk.', 'warn');
    }
  }
  if (!S.divorced) {
    if (S.marriage <= 0) { S.divorced = true; S.queue.push(EV.divorce); }
    else if (S.marriage < 25 && !(S.cool.counsel > age)) { S.cool.counsel = age + 4; S.queue.push(EV.counsel); }
  }
  if (D.mind <= 3 && !(S.cool.burn > age)) { S.cool.burn = age + 1.5; S.queue.push(EV.burnout); }
  if (S.money < -2500 && !(S.cool.debt > age)) { S.cool.debt = age + 3.5; S.queue.push(EV.debt); }

  // Exhaustion collapse (fixed: recovers cleanly at home without infinite 6 AM loop!)
  if (D.energy <= 1 && awake) {
    if (S.act) stopAct();
    if (S.loc !== 'home') {
      S.loc = 'home';
      K.withDad = false;
      M.withDad = false;
      if (travelHook) travelHook('home');
    }
    D.energy = 24;
    D.mind = clamp(D.mind - 6);
    S.act = { id: 'sleep', t: 0, p: 0 };
    toast('😴 You completely ran out of gas and collapsed into bed.', 'warn');
  }

  S.h += dh;

  // Milestones
  const a2 = S.h / 24;
  for (const m of MILES) {
    const id = m[3] || m[2];
    if (S.miles[id]) continue;
    const at = id === 'potty' ? (S.flags.pottyAge || 3.05) : m[0];
    if (a2 < at) continue;
    const late = a2 > at * 1.35 + 0.3;
    if (ratio(m[1]) >= 0.78 || late) {
      S.miles[id] = 1;
      S.mileLog.push([a2, m[2]]);
      addXP(40);
      toast(`🌟 ${N.k} ${m[2]}${a2 > at * 1.15 + 0.2 ? ' (on their own timeline)' : ''}!`, 'mile');
      if (id === 'job') S.fund += 4500;
    }
  }
  if (a2 >= 18) { S.over = true; return; }
  checkEvents();

  const ks = kidSpot();
  if (ks !== K.spot) { K.spot = ks; K.arrived = HEAD.on || ks === 'arms' || ks === 'gone' || S.loc !== 'home'; K.arriveT = 0; }
  const ms = momSpot();
  if (ms !== M.spot) { M.spot = ms; M.arrived = HEAD.on || ms === 'gone' || S.loc !== 'home'; M.arriveT = 0; }
}

function newDay(y) {
  const K = S.kid, D = S.dad;
  S.screenAvg = lerp(S.screenAvg, S.screenToday, 0.5);
  S.stats.screen += S.screenToday;
  S.screenToday = 0;
  S.workToday = 0;
  K.sleepy = false;
  K.sleepyT = 0;
  if (S.groceries > 0) S.groceries = Math.max(0, S.groceries - 1);

  // Fixed morning wakeup: only wake at 6 AM if reasonably rested!
  if (S.act && S.act.id === 'sleep' && (D.energy >= 68 || S.act.t >= 5.5)) {
    stopAct();
    toast(`⏰ 6:00 AM · ${seasonOf(S.h).icon} ${seasonOf(S.h).name}`, 'dim');
  }
  toast(`🎂 ${N.k} turns ${y}!`, 'mile');
  addXP(20);
  if (y >= 3 && !S.hyper && S.fitAvg < 36) {
    S.hyper = true;
    S.queue.push(EV.hyper);
  } else if (S.hyper && S.fitAvg > 56) {
    S.hyper = false;
    toast('🩺 Checkup: blood pressure is back to normal! Great work.', 'good');
  } else if (y % 4 === 0 && !S.hyper) {
    toast(
      S.fitAvg > 56
        ? '🩺 Annual physical: BP 118/76. Keep moving!'
        : '🩺 Annual physical: BP creeping up. Hit the gym or park trail.',
      S.fitAvg > 56 ? 'good' : 'warn'
    );
  }
}

function checkEvents() {
  if (S.event) return;
  if (S.queue.length) { S.event = { def: S.queue.shift(), stage: 0 }; sfx('event'); return; }
  const age = S.h / 24;
  for (const f of FOLLOW) {
    if (S.fired[f.id] || age < f.age) continue;
    S.fired[f.id] = 1;
    if (!f.cond || f.cond()) f.run();
  }
  if (S.queue.length) { S.event = { def: S.queue.shift(), stage: 0 }; sfx('event'); return; }
  for (const e of EVENTS) {
    if (S.fired[e.id]) continue;
    if (age < e.age) break;
    S.fired[e.id] = 1;
    if (e.cond && !e.cond()) continue;
    S.event = { def: e, stage: 0 };
    sfx('event');
    return;
  }
}

export function choose(i) {
  const ev = S.event;
  if (!ev || ev.stage) return;
  const cs = R(ev.def.choices).filter(x => !x.cond || x.cond());
  const c = cs[i];
  if (!c) return;
  ev.pick = c;
  ev.graded = cs.some(x => x.g);
  if (ev.graded) {
    S.stats.total++;
    if (c.g) { S.stats.good++; addXP(40); }
  } else {
    addXP(20); // reward engaging with tradeoff decisions
  }
  if (c.fx) c.fx();
  ev.res = R(c.r) || '';
  ev.stage = 1;
  if (!ev.res && !ev.def.lit) S.event = null;
}

export function outcome() {
  const K = S.kid, sk = K.skills;
  const avg = (sk.motor + sk.language + sk.social + sk.cognitive) / 4;
  const D = S.dad;
  const effectiveCost = S.flags.smartCollege ? COLLEGE_COST - 22000 : COLLEGE_COST;
  const gap = Math.max(0, effectiveCost - S.fund);
  const fromSav = Math.min(gap, Math.max(0, S.money - 5000));
  const loans = gap - fromSav;
  const score =
    0.30 * avg +
    0.25 * S.bond +
    0.13 * (S.divorced ? 18 : S.marriage) +
    0.10 * ((D.energy + D.fitness + D.mind + D.social) / 4) +
    0.10 * (S.employed ? Math.min(100, 42 + S.careerBar * 0.3 + S.stats.promos * 10) : 18) +
    0.12 * (1 - loans / COLLEGE_COST) * 100;
  const grade = score >= 84 ? 'A' : score >= 74 ? 'B' : score >= 62 ? 'C' : score >= 50 ? 'D' : 'F';

  // Parenting Archetype
  const st = S.style;
  const topStyle = Object.entries(st).sort((a, b) => b[1] - a[1])[0]?.[0] || 'presence';
  const archetype = {
    presence: 'The Present Anchor',
    warmth: 'The Warm Heart',
    structure: 'The Steady Compass',
    provider: 'The Tireless Builder',
  }[topStyle];

  return { avg, loans, fromSav, score, grade, effectiveCost, archetype };
}

/* ---------- Headless Balance Bot (__dad.run) ---------- */
function botPick(mode) {
  const K = S.kid, D = S.dad, M = S.mom, dayH = S.h % 24, A = S.act ? S.act.id : null;
  const ok = id => offered(id) && !actBlock(id);
  const night = dayH >= 16.5;

  if (mode === 'work') {
    if (night || D.energy < 14) { if (S.loc !== 'home') travelTo('home'); return 'sleep'; }
    if (S.loc !== 'work' && dayH >= 1 && dayH < 11) travelTo('work');
    return S.loc === 'work' ? 'work_office' : 'work';
  }
  if (mode === 'lazy') {
    if (S.loc !== 'home') travelTo('home');
    return (night || D.energy < 20) ? 'sleep' : D.mind < 70 ? 'relax' : 'work';
  }

  // 'good' balanced dad uses Home, Park, Work, and Town!
  if (K.crying) { if (S.loc !== 'home') travelTo('home'); if (ok('soothe')) return 'soothe'; }
  if (A === 'bedtime' || A === 'soothe') return A;
  if (night || D.energy < 14) { if (S.loc !== 'home') travelTo('home'); return 'sleep'; }
  if (A === 'sleep' && D.energy < 65 && dayH > 16) return 'sleep';

  const keep = (id, cond) => A === id && cond;
  if (S.loc !== 'home' && !K.withDad && !K.away && !K.asleep && (K.food < 38 || K.love < 38 || (diaper() && K.clean < 38))) {
    travelTo('home');
  }

  // Buy helpful upgrades when affordable
  if (S.money > 15000 && !S.upgrades.robovac) buyUpgrade('robovac');
  if (S.money > 18000 && !S.upgrades.deskpro) buyUpgrade('deskpro');
  if (S.money > 22000 && !S.upgrades.hoop) buyUpgrade('hoop');

  if (S.loc === 'home' && !K.away && !K.asleep) {
    if (ok('bedtime') && K.sleepy) return 'bedtime';
    if ((K.food < 48 || keep('feed', K.food < 96)) && ok('feed')) return 'feed';
    if (diaper() && (K.clean < 48 || keep('change', K.clean < 96)) && ok('change')) return 'change';
    if ((K.love < 58 || keep('read', K.love < 92)) && ok('read')) return 'read';
    if ((K.fun < 52 || keep('play', K.fun < 90) || keep('outside', K.fun < 90))) {
      if (dayH > 8 && dayH < 13 && S.h / 24 >= 1.5 && D.fitness < 75) {
        travelTo('park');
        return 'park_play';
      }
      if (ok('outside') && D.fitness < 72) return 'outside';
      if (ok('play')) return 'play';
    }
    if (offered('homework') && (K.school < 58 || keep('homework', K.school < 92)) && ok('homework')) return 'homework';
    if (S.bond < 65 && dayH > 9.5 && K.love < 88 && ok('hangout')) return 'hangout';
  }

  if (S.loc === 'park') {
    if (K.withDad && K.fun < 92 && dayH < 13.5) return 'park_play';
    if (D.fitness < 78) return 'park_run';
    travelTo('home');
  }
  if (S.loc === 'town') {
    if (A === 'town_date' || A === 'town_pub') return A;
    travelTo('home');
  }

  if (!S.divorced && (S.marriage < 52 || (S.marriage < 76 && dayH > 12.5) || keep('couple', S.marriage < 90))) {
    if (S.marriage < 48 && !M.atWork && !M.asleep && S.money > 2500) {
      travelTo('town', { dateMode: true });
      return 'town_date';
    }
    if (S.loc !== 'home') travelTo('home');
    if (ok('couple')) return 'couple';
  }
  if (D.social < 32 && dayH > 10 && dayH < 14.5 && S.money > 1500) {
    travelTo('town');
    return 'town_pub';
  }
  if (!S.employed && D.mind > 15) return S.loc === 'work' ? 'work_office' : 'work';
  if (D.fitness < 54 || keep('exercise', D.fitness < 76)) {
    if (S.loc !== 'home') travelTo('home');
    return 'exercise';
  }
  if (D.mind < 38 || keep('relax', D.mind < 60)) {
    if (S.loc !== 'home') travelTo('home');
    return 'relax';
  }
  if (S.mess > 62 || keep('chores', S.mess > 12)) {
    if (S.loc !== 'home') travelTo('home');
    return 'chores';
  }
  // Commute to workplace during workday if kid is at daycare/school or spouse is home
  if (dayH >= 2 && dayH < 8.5 && (K.away || (!M.gone && !M.atWork && !M.asleep))) {
    if (S.loc !== 'work') travelTo('work');
    return 'work_office';
  }
  if (S.loc !== 'home') travelTo('home');
  return 'work';
}

export function botRun(mode = 'good', career = 'white', opts = {}) {
  HEAD.on = true;
  setHeadless(true);
  HEAD.log = [];
  newGame({ career, sex: 'boy', kid: 'Charlie', spouse: 'Alex' });
  if (opts.contrib != null) S.contrib = opts.contrib;
  let guard = 0;
  while (!S.over && guard++ < 2e6) {
    if (S.event) {
      const cs = R(S.event.def.choices).filter(x => !x.cond || x.cond());
      let i = cs.findIndex(c => c.g);
      if (mode !== 'good' || i < 0) i = mode === 'good' ? 0 : cs.length - 1;
      choose(Math.max(0, i));
      S.event = null;
      continue;
    }
    let want = botPick(mode);
    if (opts.walk && S.act && S.act.t < 0.6 && want !== 'soothe' && !actBlock(S.act.id)) want = S.act.id;
    if (want !== (S.act ? S.act.id : null)) {
      if (opts.walk) {
        stopAct();
        for (let i = 0; i < opts.walk / 0.03 && !S.event && !S.over; i++) step(0.03);
        if (S.event || S.over) continue;
      }
      if (want) startAct(want);
      else stopAct();
    }
    for (let i = 0; i < 5 && !S.event && !S.over; i++) step(0.03);
  }
  const o = outcome();
  const r = {
    mode, career, grade: o.grade, score: Math.round(o.score), archetype: o.archetype,
    xp: Math.round(S.xp), lvl: S.lvl, bond: Math.round(S.bond),
    marriage: S.divorced ? 'divorced' : Math.round(S.marriage),
    salary: Math.round(S.salary), employed: S.employed,
    money: Math.round(S.money), fund: Math.round(S.fund), loans: Math.round(o.loans),
    skills: Object.fromEntries(Object.keys(S.kid.skills).map(s => [s, +ratio(s).toFixed(2)])),
    hyper: S.hyper,
    perDay: {
      work: +(S.stats.work / 18).toFixed(1),
      kid: +(S.stats.kid / 18).toFixed(1),
      sleep: +(S.stats.sleep / 18).toFixed(1),
      couple: +(S.stats.couple / 18).toFixed(1),
      screen: +(S.stats.screen / 18).toFixed(1),
    },
    trips: { park: S.stats.parkTrips, town: S.stats.townTrips, work: S.stats.officeDays },
    miles: S.mileLog.length,
  };
  HEAD.on = false;
  setHeadless(false);
  S = null;
  return r;
}
