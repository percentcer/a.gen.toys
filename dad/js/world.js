// 3D world engine: Home + Neighborhood, Maple Street Park, Career-Adaptive Workplace, and Main Street Town.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clamp, lerp, sat, diaper, offered, actBlock, seasonOf } from './sim.js';

const PI = Math.PI;
const WH = 2.75;
const WT = 0.14;

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.72;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x9ec0e6, 0.009);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.06, 3000);
  camera.rotation.order = 'YXZ';

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // Sky shader with sun disc, horizon glow & subtle stars at night
  const SU = {
    top: { value: new THREE.Color() },
    bot: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0, 1, 0) },
    sunCol: { value: new THREE.Color() },
    nightK: { value: 0 },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1200, 32, 18),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      toneMapped: false,
      uniforms: SU,
      vertexShader: 'varying vec3 d; void main(){ d = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform vec3 top, bot, sunDir, sunCol;
        uniform float nightK;
        varying vec3 d;
        float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        void main(){
          vec3 n = normalize(d);
          float h = clamp(n.y, 0.0, 1.0);
          vec3 c = mix(bot, top, pow(h, 0.45));
          float s = max(dot(n, sunDir), 0.0);
          c += sunCol * (pow(s, 700.0) * 4.5 + pow(s, 24.0) * 0.25);
          if(nightK > 0.05 && n.y > 0.06){
            vec3 cell = floor(n * 170.0);
            float r = hash(cell);
            if(r > 0.9965) c += vec3(0.9, 0.95, 1.0) * nightK * smoothstep(0.06, 0.35, n.y);
          }
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    })
  );
  scene.add(sky);

  const SKY = {
    dayT: new THREE.Color(0x2d74d6), dayB: new THREE.Color(0xb6d6f6),
    duskT: new THREE.Color(0x374175), duskB: new THREE.Color(0xf49a5d),
    nightT: new THREE.Color(0x050814), nightB: new THREE.Color(0x101930),
  };

  const sun = new THREE.DirectionalLight(0xffffff, 3.8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  {
    const sc = sun.shadow.camera;
    sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 110;
    sun.shadow.bias = -0.00045;
    sun.shadow.normalBias = 0.035;
  }
  sun.target.position.set(7, 0, 8);
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(0xd6e8ff, 0x776652, 0.58);
  scene.add(hemi);

  // ---------- Deterministic PRNG & Procedural PBR Textures ----------
  let seed = 17;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  function makeTex(w, h, draw, repeat = true) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    t.anisotropy = 8;
    return t;
  }

  const woodT = makeTex(512, 512, (x, w, h) => {
    x.fillStyle = '#8b633c'; x.fillRect(0, 0, w, h);
    for (let r = 0; r < 8; r++) {
      let px = -rnd() * 180;
      while (px < w) {
        const len = 175 + rnd() * 160;
        x.fillStyle = `hsl(${28 + rnd() * 7},${38 + rnd() * 12}%,${40 + rnd() * 12}%)`;
        x.fillRect(px, r * 64, len - 1, 63);
        for (let i = 0; i < 24; i++) {
          x.strokeStyle = `rgba(${rnd() < 0.5 ? 32 : 255},${rnd() < 0.5 ? 18 : 230},12,${0.03 + rnd() * 0.055})`;
          x.beginPath();
          const y = r * 64 + rnd() * 62;
          x.moveTo(px, y);
          x.bezierCurveTo(px + len * 0.3, y + rnd() * 4 - 2, px + len * 0.65, y + rnd() * 4 - 2, px + len, y);
          x.stroke();
        }
        x.fillStyle = 'rgba(20,10,4,.45)'; x.fillRect(px + len - 1, r * 64, 1.5, 64);
        px += len;
      }
      x.fillStyle = 'rgba(20,10,4,.4)'; x.fillRect(0, r * 64 + 63, w, 1.5);
    }
  });

  const tileT = makeTex(256, 256, (x, w, h) => {
    x.fillStyle = '#bdb7ab'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      x.fillStyle = `hsl(38,11%,${82 + rnd() * 5}%)`;
      x.fillRect(i * 128 + 2, j * 128 + 2, 124, 124);
    }
    for (let i = 0; i < 800; i++) {
      x.fillStyle = `rgba(90,80,60,${rnd() * 0.055})`;
      x.fillRect(rnd() * w, rnd() * h, 2, 2);
    }
  });

  const brickT = makeTex(256, 256, (x, w, h) => {
    x.fillStyle = '#cfc7bc'; x.fillRect(0, 0, w, h);
    const rows = 8, cols = 4, rh = h / rows, cw = w / cols;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (cw / 2);
      for (let c = -1; c <= cols; c++) {
        x.fillStyle = `hsl(${12 + rnd() * 10},${42 + rnd() * 12}%,${38 + rnd() * 12}%)`;
        x.fillRect(c * cw + off + 2, r * rh + 2, cw - 4, rh - 4);
      }
    }
  });

  const grassT = makeTex(256, 256, (x, w, h) => {
    x.fillStyle = '#588240'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 4800; i++) {
      x.fillStyle = `hsl(${86 + rnd() * 28},${34 + rnd() * 22}%,${26 + rnd() * 22}%)`;
      x.fillRect(rnd() * w, rnd() * h, 1.5, 2 + rnd() * 4);
    }
  });

  const asphaltT = makeTex(256, 256, (x, w, h) => {
    x.fillStyle = '#34383f'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 3200; i++) {
      const v = 40 + rnd() * 45;
      x.fillStyle = `rgba(${v},${v},${v + 4},0.22)`;
      x.fillRect(rnd() * w, rnd() * h, 2, 2);
    }
  });

  const paverT = makeTex(256, 256, (x, w, h) => {
    x.fillStyle = '#8b8378'; x.fillRect(0, 0, w, h);
    for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) {
      const off = (r % 2) * 32;
      x.fillStyle = `hsl(${28 + rnd() * 12},${10 + rnd() * 8}%,${56 + rnd() * 10}%)`;
      x.fillRect((c * 64 + off) % w + 2, r * 42 + 2, 60, 38);
    }
  });

  const rugT = makeTex(256, 256, (x, w, h) => {
    x.fillStyle = '#8b413c'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#e7d8b8'; x.lineWidth = 10; x.strokeRect(14, 14, w - 28, h - 28);
    x.lineWidth = 3; x.strokeRect(34, 34, w - 68, h - 68);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
      x.fillStyle = (i + j) % 2 ? '#2e4d63' : '#cf9f4c';
      x.save(); x.translate(58 + i * 28, 58 + j * 28); x.rotate(PI / 4);
      x.fillRect(-7, -7, 14, 14); x.restore();
    }
  });

  const matT = makeTex(256, 256, (x, w, h) => {
    const pal = ['#f3c24f', '#63b8b0', '#ef6e4e', '#7aa7d4', '#b9d86c', '#ca8cd9'];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      x.fillStyle = pal[(i * 3 + j * 2) % 6]; x.fillRect(i * 64, j * 64, 63, 63);
    }
  });

  const stoneT = makeTex(256, 256, (x, w, h) => {
    x.fillStyle = '#2d3036'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 2400; i++) {
      const v = rnd();
      x.fillStyle = `rgba(${195 * v + 45},${195 * v + 45},${205 * v + 45},${0.08 + rnd() * 0.2})`;
      x.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
    }
  });

  const carpetT = makeTex(256, 256, (x, w, h) => {
    x.fillStyle = '#4a5565'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 3600; i++) {
      x.fillStyle = `rgba(${rnd() < 0.5 ? 30 : 120},${rnd() < 0.5 ? 40 : 130},150,0.12)`;
      x.fillRect(rnd() * w, rnd() * h, 2, 2);
    }
  });

  // Animated TV canvas texture
  const tvCan = document.createElement('canvas'); tvCan.width = 256; tvCan.height = 144;
  const tvCtx = tvCan.getContext('2d');
  const tvTex = new THREE.CanvasTexture(tvCan); tvTex.colorSpace = THREE.SRGBColorSpace;

  // Dynamic evolving family photo canvas
  const famCan = document.createElement('canvas'); famCan.width = 256; famCan.height = 192;
  const famCtx = famCan.getContext('2d');
  const famTex = new THREE.CanvasTexture(famCan); famTex.colorSpace = THREE.SRGBColorSpace;
  let lastPhotoStage = -1;
  function drawFamilyPhoto(age, girl) {
    const st = age < 1.5 ? 0 : age < 5 ? 1 : age < 12 ? 2 : 3;
    if (st === lastPhotoStage) return;
    lastPhotoStage = st;
    const x = famCtx;
    const skyCols = ['#a8d6f5', '#ffd699', '#8fd1b8', '#f0b695'];
    x.fillStyle = skyCols[st]; x.fillRect(0, 0, 256, 192);
    x.fillStyle = '#5a8f49'; x.fillRect(0, 126, 256, 66);
    // Sun
    x.fillStyle = '#fff0a8'; x.beginPath(); x.arc(212, 38, 18, 0, PI * 2); x.fill();
    // Dad & Mom silhouettes
    const fig = (cx, h, col) => {
      x.fillStyle = col; x.fillRect(cx - 14, 155 - h, 28, h);
      x.fillStyle = '#e0aa84'; x.beginPath(); x.arc(cx, 142 - h, 13, 0, PI * 2); x.fill();
      x.fillStyle = '#3b281c'; x.beginPath(); x.arc(cx, 137 - h, 13, PI, PI * 2); x.fill();
    };
    fig(82, 58, '#3d6fb0');
    fig(174, 54, '#9a638b');
    // Kid growing in center!
    const kh = [20, 30, 42, 52][st];
    const kcol = girl ? '#e07a9a' : '#e6a83a';
    fig(128, kh, kcol);
    x.fillStyle = 'rgba(20,25,35,0.65)';
    x.font = 'bold 14px sans-serif'; x.textAlign = 'center';
    x.fillText(['Year 1 · Home', 'Toddler Years', 'Park Days', 'Almost Grown'][st], 128, 182);
    famTex.needsUpdate = true;
  }
  drawFamilyPhoto(0, false);

  const std = (color, rough = 0.8, metal = 0, ex = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...ex });

  const MAT = {
    wall: std(0xefe9dd, 0.92),
    extWall: std(0xd8d0c0, 0.88),
    brick: std(0xffffff, 0.88, 0, { map: brickT }),
    trim: std(0xf8f6f0, 0.48),
    ceil: std(0xf5f2ec, 0.95),
    wood: std(0xffffff, 0.48, 0, { map: woodT }),
    tile: std(0xffffff, 0.34, 0, { map: tileT }),
    carpet: std(0xffffff, 0.92, 0, { map: carpetT }),
    grass: std(0xffffff, 0.98, 0, { map: grassT }),
    asphalt: std(0xffffff, 0.92, 0, { map: asphaltT }),
    paver: std(0xffffff, 0.86, 0, { map: paverT }),
    rug: std(0xffffff, 0.96, 0, { map: rugT }),
    mat: std(0xffffff, 0.88, 0, { map: matT }),
    stone: std(0xffffff, 0.22, 0.05, { map: stoneT }),
    oak: std(0xb98a58, 0.52),
    walnut: std(0x5e402b, 0.48),
    white: std(0xf4f2ed, 0.45),
    cab: std(0x4b6875, 0.48),
    dark: std(0x252830, 0.52),
    steel: std(0xcfd4da, 0.28, 0.9),
    black: std(0x13151a, 0.3, 0.3),
    sofa: std(0x586b7a, 0.95),
    cushion: std(0x788d9c, 0.95),
    linen: std(0xeee8dd, 0.96),
    duvet: std(0x7c97ad, 0.96),
    kduvet: std(0xf2ba4e, 0.94),
    pillow: std(0xf8f6f0, 0.94),
    leaf: std(0x367834, 0.88),
    bark: std(0x523d2b, 0.94),
    terra: std(0xbd6742, 0.78),
    fence: std(0xa37e56, 0.85),
    concrete: std(0xa4a29c, 0.9),
    roof: std(0x3b4048, 0.88),
    red: std(0xcf473e, 0.52),
    blue: std(0x3b71b8, 0.52),
    teal: std(0x2c6e78, 0.42, 0.25),
    yellow: std(0xecbf3c, 0.52),
    green: std(0x428246, 0.75),
    orange: std(0xe07b38, 0.55),
    rubber: std(0x1c1d20, 0.9),
    door: std(0x2d6067, 0.48),
    brass: std(0xd1ab5e, 0.28, 0.9),
    water: new THREE.MeshPhysicalMaterial({ color: 0x3b86b8, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.88 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xe6f4ff, transparent: true, opacity: 0.18, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide }),
    shade: std(0xfff4df, 0.88, 0, { emissive: 0xffc882, emissiveIntensity: 0 }),
    bulb: std(0xfff6d8, 0.4, 0, { emissive: 0xffcf7a, emissiveIntensity: 1.5 }),
    screen: std(0x0c0e14, 0.2, 0, { map: tvTex, emissiveMap: tvTex, emissive: 0xffffff, emissiveIntensity: 0 }),
    monitor: std(0x0e1420, 0.2, 0, { emissive: 0x89b7e8, emissiveIntensity: 0.72 }),
    famPhoto: std(0xffffff, 0.55, 0, { map: famTex }),
  };

  // ---------- Location Containers ----------
  const LOCS = {};
  function makeLoc(id, spawn) {
    const group = new THREE.Group();
    group.visible = false;
    scene.add(group);
    const L = { id, group, spawn, colliders: [], walls: [], lamps: [], stations: {}, npcs: [] };
    LOCS[id] = L;
    return L;
  }

  let curBuild = null;
  const col = (x0, z0, x1, z1) => curBuild.colliders.push({ x0, z0, x1, z1 });
  const addWallSeg = (x0, z0, x1, z1) => { col(x0, z0, x1, z1); curBuild.walls.push({ x0, z0, x1, z1 }); };
  function grp(x, z, ry = 0, parent = curBuild.group) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    parent.add(g);
    return g;
  }
  function bx(g, w, h, d, mat, x = 0, y = 0, z = 0, r = 0) {
    const m = new THREE.Mesh(r ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  }
  function cy(g, rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 16) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  }
  function ball(g, r, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  }
  function floor(x0, z0, x1, z1, mat, size, y = 0, parent = curBuild.group) {
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / size, uv.getY(i) * (z1 - z0) / size);
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -PI / 2;
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function wall(ax, c, a, b, ops = [], mat = MAT.wall, hMax = WH) {
    const X = ax === 'x';
    const seg = (s, e, y0, y1) => {
      if (e - s < 0.01 || y1 - y0 < 0.01) return;
      const m = new THREE.Mesh(new THREE.BoxGeometry(X ? e - s : WT, y1 - y0, X ? WT : e - s), mat);
      m.position.set(X ? (s + e) / 2 : c, (y0 + y1) / 2, X ? c : (s + e) / 2);
      m.castShadow = m.receiveShadow = true;
      curBuild.group.add(m);
      if (y0 < 1.5) {
        if (X) addWallSeg(s, c - WT / 2, e, c + WT / 2);
        else addWallSeg(c - WT / 2, s, c + WT / 2, e);
      }
    };
    const pane = o => {
      const len = o.b - o.a, h = o.h - o.s, y = o.s + h / 2, mid = (o.a + o.b) / 2;
      const g = new THREE.Mesh(new THREE.PlaneGeometry(len, h), MAT.glass);
      g.position.set(X ? mid : c, y, X ? c : mid);
      if (!X) g.rotation.y = PI / 2;
      curBuild.group.add(g);
      const fr = (w, hh, dx, dy) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(X ? w : WT + 0.06, hh, X ? WT + 0.06 : w), MAT.trim);
        m.position.set(X ? mid + dx : c, y + dy, X ? c : mid + dx);
        m.castShadow = true;
        curBuild.group.add(m);
      };
      fr(len + 0.12, 0.07, 0, h / 2);
      fr(len + 0.16, 0.08, 0, -h / 2);
      fr(0.07, h, -len / 2, 0);
      fr(0.07, h, len / 2, 0);
      fr(0.04, h, 0, 0);
    };
    let p = a;
    for (const o of [...ops].sort((m, n) => m.a - n.a)) {
      o.h = o.h ?? 2.15;
      o.s = o.s || 0;
      seg(p, o.a, 0, hMax);
      seg(o.a, o.b, o.h, hMax);
      if (o.s) { seg(o.a, o.b, 0, o.s); pane(o); }
      else {
        // Doorway frame trim!
        const fr = (posA, hh, yMid, thick) => {
          const m = new THREE.Mesh(new THREE.BoxGeometry(X ? thick : WT + 0.05, hh, X ? WT + 0.05 : thick), MAT.trim);
          m.position.set(X ? posA : c, yMid, X ? c : posA);
          curBuild.group.add(m);
        };
        fr(o.a, o.h, o.h / 2, 0.06);
        fr(o.b, o.h, o.h / 2, 0.06);
      }
      p = o.b;
    }
    seg(p, b, 0, hMax);
  }
  function addLamp(x, y, z, power, fixture = true, colHex = 0xffd7a3) {
    const l = new THREE.PointLight(colHex, 0, 12, 1.65);
    l.position.set(x, y, z);
    l.userData.p = power;
    curBuild.group.add(l);
    curBuild.lamps.push(l);
    if (fixture) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.07, 18), MAT.shade);
      m.position.set(x, WH - 0.04, z);
      curBuild.group.add(m);
    }
    return l;
  }
  function tableLamp(g, x, y, z) {
    cy(g, 0.045, 0.068, 0.25, MAT.brass, x, y + 0.125, z);
    const s = cy(g, 0.1, 0.15, 0.2, MAT.shade, x, y + 0.35, z);
    s.castShadow = false;
  }
  function tree(x, z, scale = 1, collide = true) {
    const g = grp(x, z);
    cy(g, 0.18 * scale, 0.28 * scale, 2.3 * scale, MAT.bark, 0, 1.15 * scale, 0, 10);
    for (const [ox, oy, oz, r] of [
      [0, 3.1, 0, 1.35], [0.85, 2.7, 0.35, 1.0], [-0.85, 2.75, -0.3, 1.05], [0.15, 2.8, -0.85, 0.95], [-0.2, 3.7, 0.3, 0.95],
    ]) {
      const l = new THREE.Mesh(new THREE.IcosahedronGeometry(r * scale, 1), MAT.leaf);
      l.position.set(ox * scale, oy * scale, oz * scale);
      l.castShadow = true;
      g.add(l);
    }
    if (collide) col(x - 0.35 * scale, z - 0.35 * scale, x + 0.35 * scale, z + 0.35 * scale);
    return g;
  }
  function buildCar(x, z, ry, bodyMat = MAT.teal) {
    const g = grp(x, z, ry);
    // Body & cabin
    bx(g, 1.85, 0.65, 4.1, bodyMat, 0, 0.62, 0, 0.12);
    bx(g, 1.62, 0.58, 2.15, bodyMat, 0, 1.15, -0.22, 0.12);
    // Windshield & side windows
    bx(g, 1.5, 0.44, 0.06, MAT.dark, 0, 1.14, 0.85);
    bx(g, 1.5, 0.42, 0.06, MAT.dark, 0, 1.14, -1.3);
    bx(g, 1.66, 0.38, 1.75, MAT.dark, 0, 1.14, -0.22);
    // Headlights & taillights
    for (const sx of [-0.62, 0.62]) {
      bx(g, 0.32, 0.14, 0.06, MAT.bulb, sx, 0.68, 2.05);
      bx(g, 0.32, 0.14, 0.06, MAT.red, sx, 0.68, -2.05);
    }
    // Wheels
    for (const [wx, wz] of [[-0.9, 1.25], [0.9, 1.25], [-0.9, -1.25], [0.9, -1.25]]) {
      const w = cy(g, 0.32, 0.32, 0.22, MAT.rubber, wx, 0.32, wz, 16);
      w.rotation.z = PI / 2;
      const hub = cy(g, 0.16, 0.16, 0.24, MAT.steel, wx, 0.32, wz, 12);
      hub.rotation.z = PI / 2;
    }
    // Collider rotated cleanly
    const hw = Math.abs(Math.cos(ry)) * 1.05 + Math.abs(Math.sin(ry)) * 2.15;
    const hd = Math.abs(Math.sin(ry)) * 1.05 + Math.abs(Math.cos(ry)) * 2.15;
    col(x - hw, z - hd, x + hw, z + hd);
    return g;
  }

  // Sprite icons for stations
  const emoT = {};
  function emojiTex(e, ring = 'rgba(255,255,255,0.55)') {
    const key = e + ring;
    if (emoT[key]) return emoT[key];
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(15,20,28,.82)';
    x.beginPath(); x.arc(64, 64, 56, 0, PI * 2); x.fill();
    x.strokeStyle = ring; x.lineWidth = 5; x.stroke();
    x.font = '62px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(e, 64, 69);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return (emoT[key] = t);
  }

  function addStation(loc, id, cfg) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: emojiTex(cfg.ic), transparent: true, toneMapped: false, depthWrite: false, opacity: 0.9,
    }));
    sp.position.set(cfg.mx, cfg.my || 1.58, cfg.mz);
    sp.scale.setScalar(0.28);
    sp.visible = false;
    loc.group.add(sp);
    loc.stations[id] = { ...cfg, id, sp };
  }

  const W = { mess: [], upgrades: {} };

  /* =====================================================================
     LOCATION 1: HOME + NEIGHBORHOOD
     ===================================================================== */
  {
    const L = makeLoc('home', { x: 6.6, z: 8.6, yaw: 1.05 });
    curBuild = L;

    // Ground & Street
    floor(-42, -32, 62, 52, MAT.grass, 3.2, -0.02);
    // Paved street out front (east side x = 23..30) + sidewalk (x = 21.5..23)
    floor(23, -32, 30, 52, MAT.asphalt, 4, -0.005);
    floor(21.4, -32, 23, 52, MAT.concrete, 2, 0.005);
    const g0 = grp(0, 0);
    for (let z = -26; z < 46; z += 4.5) bx(g0, 0.14, 0.01, 2.1, MAT.yellow, 26.5, 0.002, z);
    // Driveway from front yard to street (x = 14..23, z = 4..10)
    floor(14.1, 4.5, 23, 10.2, MAT.concrete, 2.2, 0.008);
    // Walk boundary fences around whole property so player stays in playable neighborhood yard
    col(-2.2, -3.5, 22.8, -3.1);
    col(-2.2, 19.3, 22.8, 19.7);
    col(-2.2, -3.5, -1.8, 19.7);
    col(22.4, -3.5, 22.8, 19.7);

    // Interior floors
    floor(0, 0, 14, 4.2, MAT.wood, 2.4, 0.01);
    floor(0, 4.2, 8, 10, MAT.wood, 2.4, 0.01);
    floor(8, 4.2, 14, 10, MAT.tile, 1.2, 0.01);

    // Ceiling & Pitched Gabled Roof + Chimney + Front Porch
    bx(g0, 14.4, 0.14, 10.4, MAT.ceil, 7, WH + 0.07, 5);
    // Pitched roof slopes
    const roofL = bx(g0, 15.2, 0.18, 6.2, MAT.roof, 7, WH + 1.25, 2.4); roofL.rotation.x = -0.34;
    const roofR = bx(g0, 15.2, 0.18, 6.2, MAT.roof, 7, WH + 1.25, 7.6); roofR.rotation.x = 0.34;
    // Brick Chimney
    bx(g0, 0.9, 2.4, 0.9, MAT.brick, 2.2, WH + 1.7, 3.2);
    // Foundation & Backyard stone patio
    bx(g0, 14.3, 0.25, 10.3, MAT.concrete, 7, -0.12, 5);
    floor(1.4, 10.05, 6.4, 13.4, MAT.paver, 1.4, 0.012);
    // Front porch & columns
    bx(g0, 2.1, 0.08, 3.2, MAT.concrete, 15.05, 0.03, 7.8);
    bx(g0, 2.2, 0.1, 3.4, MAT.roof, 15.05, 2.55, 7.8);
    for (const pz of [6.3, 9.3]) bx(g0, 0.12, 2.5, 0.12, MAT.trim, 15.95, 1.28, pz);
    addLamp(15.2, 2.35, 7.8, 6, false, 0xffd28c);

    // Exterior & Interior Walls (with real open Front Door & Backyard Door!)
    wall('x', 0, 0, 14, [{ a: 1.2, b: 3.2, s: 0.9, h: 2.15 }, { a: 5.9, b: 7.9, s: 0.9, h: 2.15 }, { a: 10.6, b: 12.6, s: 0.9, h: 2.15 }]);
    wall('x', 10, 0, 14, [{ a: 2.4, b: 4.4, h: 2.2 }, { a: 5.6, b: 7.8, s: 0.55, h: 2.2 }, { a: 9.6, b: 12.4, s: 0.9, h: 2.15 }]);
    wall('z', 0, 0, 10, [{ a: 1.2, b: 3.0, s: 0.9, h: 2.15 }, { a: 5.6, b: 8.4, s: 0.65, h: 2.2 }]);
    wall('z', 14, 0, 10, [{ a: 1.2, b: 3.0, s: 0.9, h: 2.15 }, { a: 7.2, b: 8.4, h: 2.18 }]);
    wall('x', 4.2, 0, 14, [{ a: 3.0, b: 3.9 }, { a: 6.4, b: 7.3 }, { a: 10.2, b: 11.1 }]);
    wall('z', 4.6, 0, 4.2);
    wall('z', 9.2, 0, 4.2);

    // Interior lamps
    addLamp(2.3, 2.35, 2.1, 7.5);
    addLamp(6.9, 2.35, 2.1, 7.5);
    addLamp(11.6, 2.35, 2.1, 8.5);
    addLamp(4.6, 2.35, 7.0, 13.5);
    addLamp(11.0, 2.35, 6.2, 11.5);
    addLamp(10.4, 1.85, 8.3, 6.5, false);

    // ---- Master Bedroom
    let g = grp(1.2, 2.1);
    bx(g, 2.15, 0.3, 1.85, MAT.walnut, 0, 0.15, 0);
    bx(g, 2.05, 0.26, 1.75, MAT.linen, 0, 0.43, 0, 0.06);
    bx(g, 1.48, 0.15, 1.8, MAT.duvet, 0.3, 0.58, 0, 0.06);
    bx(g, 0.5, 0.14, 0.68, MAT.pillow, -0.72, 0.6, -0.42, 0.06);
    bx(g, 0.5, 0.14, 0.68, MAT.pillow, -0.72, 0.6, 0.42, 0.06);
    bx(g, 0.08, 1.08, 1.92, MAT.walnut, -1.08, 0.54, 0);
    col(0.08, 1.15, 2.32, 3.06);
    for (const z of [0.72, 3.48]) {
      bx(g0, 0.45, 0.5, 0.45, MAT.walnut, 0.34, 0.25, z);
      tableLamp(g0, 0.34, 0.5, z);
      col(0.1, z - 0.24, 0.58, z + 0.24);
    }
    bx(g0, 0.5, 0.95, 1.4, MAT.oak, 4.25, 0.475, 1.3); col(3.98, 0.58, 4.53, 2.02);
    bx(g0, 0.05, 0.72, 0.92, MAT.steel, 4.5, 1.6, 1.3);
    floor(1.8, 0.9, 3.9, 3.4, std(0xd2c4ad, 1), 1, 0.014);

    // ---- Kid's Room (evolves with age!)
    W.crib = grp(8.72, 1.02);
    bx(W.crib, 0.78, 0.1, 1.38, MAT.linen, 0, 0.47, 0, 0.03);
    for (const [x, z] of [[-0.39, -0.69], [0.39, -0.69], [-0.39, 0.69], [0.39, 0.69]]) bx(W.crib, 0.05, 0.95, 0.05, MAT.white, x, 0.475, z);
    for (const x of [-0.39, 0.39]) {
      bx(W.crib, 0.04, 0.05, 1.38, MAT.white, x, 0.92, 0);
      bx(W.crib, 0.04, 0.05, 1.38, MAT.white, x, 0.36, 0);
      for (let i = 0; i < 9; i++) bx(W.crib, 0.022, 0.56, 0.022, MAT.white, x, 0.64, -0.6 + i * 0.15);
    }
    for (const z of [-0.69, 0.69]) bx(W.crib, 0.78, 0.6, 0.03, MAT.white, 0, 0.64, z);

    W.kbed = grp(8.68, 1.12);
    bx(W.kbed, 0.98, 0.28, 1.98, MAT.oak, 0, 0.14, 0);
    bx(W.kbed, 0.92, 0.2, 1.9, MAT.linen, 0, 0.38, 0, 0.05);
    bx(W.kbed, 0.96, 0.12, 1.3, MAT.kduvet, 0, 0.5, 0.3, 0.05);
    bx(W.kbed, 0.6, 0.12, 0.4, MAT.pillow, 0, 0.52, -0.7, 0.05);
    bx(W.kbed, 1.0, 0.82, 0.06, MAT.oak, 0, 0.41, -1.0);
    col(8.18, 0.1, 9.14, 2.14);

    W.changeT = grp(4.97, 1.25);
    bx(W.changeT, 0.56, 0.88, 1.0, MAT.white, 0, 0.44, 0);
    bx(W.changeT, 0.5, 0.06, 0.8, MAT.kduvet, 0, 0.91, 0, 0.025);
    bx(W.changeT, 0.5, 0.03, 0.94, MAT.oak, 0, 0.6, 0);

    W.kdesk = grp(4.97, 1.25);
    bx(W.kdesk, 0.6, 0.04, 1.32, MAT.oak, 0, 0.7, 0);
    for (const z of [-0.6, 0.6]) bx(W.kdesk, 0.56, 0.7, 0.04, MAT.white, 0, 0.35, z);
    tableLamp(W.kdesk, -0.1, 0.72, -0.45);
    bx(W.kdesk, 0.24, 0.02, 0.32, MAT.white, 0.05, 0.73, 0.1);
    bx(W.kdesk, 0.4, 0.04, 0.4, MAT.blue, 0.53, 0.44, 0);
    bx(W.kdesk, 0.04, 0.45, 0.4, MAT.blue, 0.73, 0.66, 0);
    col(4.68, 0.58, 5.4, 1.92);

    // Teen decor (guitar & posters, visible age >= 12)
    W.teenDecor = grp(4.72, 2.65);
    bx(W.teenDecor, 0.03, 0.7, 0.55, MAT.blue, 0, 1.65, 0);
    bx(W.teenDecor, 0.03, 0.55, 0.45, MAT.orange, 0, 1.55, 0.7);
    cy(W.teenDecor, 0.14, 0.17, 0.06, MAT.oak, 0.14, 0.32, -0.4); // guitar body
    bx(W.teenDecor, 0.04, 0.6, 0.04, MAT.walnut, 0.14, 0.72, -0.4);

    // Bookcase & Reading Chair
    g = grp(7.78, 4.0);
    bx(g, 0.75, 1.32, 0.28, MAT.white, 0, 0.66, 0);
    const bc = [0xc8443a, 0x3d6fb0, 0xe9bd3a, 0x4f9d69, 0xe08a3c, 0x7e57a8, 0x2d8a99];
    for (let s = 0; s < 3; s++) {
      let x = -0.32;
      while (x < 0.3) {
        const w = 0.03 + rnd() * 0.035, h = 0.2 + rnd() * 0.1;
        bx(g, w, h, 0.17, std(bc[Math.floor(rnd() * 7)], 0.7), x + w / 2, 0.12 + s * 0.4 + h / 2, -0.06);
        x += w + 0.004;
      }
      bx(g, 0.7, 0.02, 0.24, MAT.oak, 0, 0.1 + s * 0.4, -0.03);
    }
    col(7.38, 3.84, 8.18, 4.14);

    g = grp(8.62, 3.45, -PI / 2);
    bx(g, 0.82, 0.4, 0.76, MAT.cushion, 0, 0.22, 0, 0.08);
    bx(g, 0.82, 0.56, 0.2, MAT.cushion, 0, 0.62, -0.3, 0.08);
    bx(g, 0.16, 0.3, 0.76, MAT.cushion, -0.36, 0.52, 0, 0.06);
    bx(g, 0.16, 0.3, 0.76, MAT.cushion, 0.36, 0.52, 0, 0.06);
    col(8.22, 3.04, 9.14, 3.86);

    const kRug = new THREE.Mesh(new THREE.CircleGeometry(1.05, 36), std(0x9bc4d8, 1));
    kRug.rotation.x = -PI / 2; kRug.position.set(6.7, 0.015, 2.2); kRug.receiveShadow = true; L.group.add(kRug);
    bx(g0, 0.5, 0.4, 0.8, MAT.red, 5.0, 0.2, 3.4, 0.04); col(4.68, 2.98, 5.28, 3.82);

    // ---- Office / Garage Gym
    W.office = grp(9.62, 1.6);
    bx(W.office, 0.74, 0.04, 1.75, MAT.oak, 0, 0.74, 0);
    for (const z of [-0.82, 0.82]) bx(W.office, 0.68, 0.74, 0.04, MAT.dark, 0, 0.37, z);
    for (const z of [-0.36, 0.36]) {
      bx(W.office, 0.03, 0.36, 0.62, MAT.black, -0.2, 1.06, z);
      const sc = bx(W.office, 0.005, 0.32, 0.58, MAT.monitor, -0.182, 1.06, z); sc.castShadow = false;
      cy(W.office, 0.02, 0.02, 0.14, MAT.black, -0.22, 0.83, z);
      bx(W.office, 0.16, 0.015, 0.22, MAT.black, -0.2, 0.765, z);
    }
    bx(W.office, 0.14, 0.02, 0.42, MAT.dark, 0.12, 0.77, 0);
    tableLamp(W.office, -0.2, 0.76, -0.74);

    W.bench = grp(9.62, 1.6);
    bx(W.bench, 0.74, 0.07, 1.8, MAT.oak, 0, 0.9, 0);
    for (const [x, z] of [[-0.3, -0.84], [0.3, -0.84], [-0.3, 0.84], [0.3, 0.84]]) bx(W.bench, 0.08, 0.9, 0.08, MAT.oak, x, 0.45, z);
    bx(W.bench, 0.02, 0.85, 1.55, std(0xb99b6b, 0.9), -0.33, 1.55, 0);
    for (let i = 0; i < 6; i++) bx(W.bench, 0.03, 0.22 + rnd() * 0.2, 0.05, i % 2 ? MAT.steel : MAT.red, -0.31, 1.55 + rnd() * 0.2, -0.6 + i * 0.24);
    bx(W.bench, 0.3, 0.2, 0.45, MAT.red, 0.05, 1.04, 0.5, 0.02);
    col(9.26, 0.7, 10.02, 2.52);

    // Upgrade visual: Pro Desk / Tool Chest extra monitor & LED strip
    W.upgrades.deskpro = grp(9.62, 1.6);
    bx(W.upgrades.deskpro, 0.04, 0.34, 0.5, MAT.black, -0.18, 1.44, 0);
    bx(W.upgrades.deskpro, 0.01, 0.3, 0.46, MAT.monitor, -0.155, 1.44, 0);
    bx(W.upgrades.deskpro, 0.36, 0.48, 0.46, MAT.red, 0.02, 0.24, -1.12, 0.02);
    W.upgrades.deskpro.visible = false;

    const chair = grp(10.28, 1.6, -PI / 2);
    bx(chair, 0.48, 0.08, 0.46, MAT.dark, 0, 0.48, 0, 0.03);
    bx(chair, 0.46, 0.5, 0.07, MAT.dark, 0, 0.8, -0.21, 0.03);
    cy(chair, 0.03, 0.03, 0.4, MAT.steel, 0, 0.24, 0);
    cy(chair, 0.26, 0.26, 0.04, MAT.black, 0, 0.03, 0);
    W.chair = chair;

    // Home Gym
    g = grp(12.95, 2.6);
    bx(g, 1.0, 0.02, 2.1, MAT.rubber, -0.25, 0.015, 0);
    bx(g, 0.32, 0.08, 1.2, MAT.black, -0.25, 0.46, 0, 0.03);
    for (const z of [-0.45, 0.45]) bx(g, 0.26, 0.42, 0.06, MAT.steel, -0.25, 0.21, z);
    for (const x of [-0.75, 0.25]) bx(g, 0.05, 1.15, 0.05, MAT.steel, x, 0.57, -0.75);
    cy(g, 0.016, 0.016, 1.7, MAT.steel, -0.25, 1.1, -0.75).rotation.z = PI / 2;
    for (const x of [-1, 1]) cy(g, 0.2, 0.2, 0.05, MAT.black, -0.25 + x * 0.72, 1.1, -0.75).rotation.z = PI / 2;
    bx(g, 0.4, 0.5, 1.5, MAT.dark, 0.68, 0.25, 0.2);
    col(12.2, 1.7, 13.9, 3.6);

    // Upgrade visual: Garage Power Rack cage
    W.upgrades.gymrack = grp(12.7, 2.6);
    for (const [px, pz] of [[-0.55, -0.8], [0.55, -0.8], [-0.55, 0.5], [0.55, 0.5]]) bx(W.upgrades.gymrack, 0.06, 2.15, 0.06, MAT.red, px, 1.07, pz);
    bx(W.upgrades.gymrack, 1.16, 0.06, 0.06, MAT.black, 0, 2.14, -0.8);
    bx(W.upgrades.gymrack, 1.16, 0.06, 0.06, MAT.black, 0, 2.14, 0.5);
    W.upgrades.gymrack.visible = false;

    // ---- Living Room
    g = grp(5.1, 4.52);
    bx(g, 1.75, 0.44, 0.44, MAT.walnut, 0, 0.24, 0);
    bx(g, 1.4, 0.82, 0.05, MAT.black, 0, 1.3, -0.18);
    W.tv = bx(g, 1.32, 0.74, 0.01, MAT.screen, 0, 1.3, -0.15); W.tv.castShadow = false;
    W.tvLight = new THREE.PointLight(0x7fa8ff, 0, 5.5, 2); W.tvLight.position.set(5.1, 1.25, 5.0); L.group.add(W.tvLight);
    col(4.2, 4.28, 6.0, 4.78);

    g = grp(5.1, 7.55);
    bx(g, 2.35, 0.4, 0.96, MAT.sofa, 0, 0.24, 0, 0.08);
    bx(g, 2.35, 0.56, 0.24, MAT.sofa, 0, 0.62, 0.36, 0.08);
    for (const x of [-1.06, 1.06]) bx(g, 0.22, 0.32, 0.96, MAT.sofa, x, 0.55, 0, 0.07);
    for (const x of [-0.52, 0.52]) bx(g, 0.94, 0.14, 0.66, MAT.cushion, x, 0.48, -0.1, 0.05);
    bx(g, 0.4, 0.4, 0.12, MAT.kduvet, -0.75, 0.68, 0.18, 0.05).rotation.x = 0.25;
    col(3.9, 7.05, 6.3, 8.08);

    bx(g0, 1.05, 0.04, 0.56, MAT.walnut, 5.1, 0.4, 6.0);
    for (const [x, z] of [[4.62, 5.76], [5.58, 5.76], [4.62, 6.24], [5.58, 6.24]]) bx(g0, 0.04, 0.4, 0.04, MAT.dark, x, 0.2, z);
    col(4.56, 5.7, 5.64, 6.3);

    floor(3.5, 5.2, 6.7, 7.2, MAT.rug, 3.2, 0.015);
    W.mat = bx(g0, 1.9, 0.03, 1.9, MAT.mat, 1.7, 0.02, 6.5);
    W.toys = grp(1.7, 6.5);
    for (const [x, z, c] of [[0.6, 0.5, MAT.red], [0.72, 0.38, MAT.blue], [0.5, 0.62, MAT.yellow], [-0.6, 0.6, MAT.green]]) bx(W.toys, 0.1, 0.1, 0.1, c, x, 0.08, z);
    ball(W.toys, 0.11, MAT.red, -0.65, 0.14, -0.5);

    // Evolving Family Photo Gallery on Living Room wall!
    bx(g0, 0.86, 0.66, 0.03, MAT.walnut, 2.0, 1.62, 4.3);
    const pMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.56), MAT.famPhoto);
    pMesh.position.set(2.0, 1.62, 4.32);
    L.group.add(pMesh);

    // Potted houseplant & floor lamp & living bookshelf
    g = grp(0.4, 9.4);
    cy(g, 0.2, 0.15, 0.36, MAT.terra, 0, 0.18, 0);
    for (let i = 0; i < 6; i++) {
      const l = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2 + rnd() * 0.1, 0), MAT.leaf);
      l.position.set(rnd() * 0.38 - 0.19, 0.58 + rnd() * 0.65, rnd() * 0.38 - 0.19);
      l.castShadow = true; g.add(l);
    }
    col(0.1, 9.1, 0.7, 9.7);

    g = grp(7.4, 9.45);
    cy(g, 0.16, 0.16, 0.03, MAT.dark, 0, 0.015, 0);
    cy(g, 0.016, 0.016, 1.5, MAT.dark, 0, 0.75, 0);
    cy(g, 0.14, 0.21, 0.26, MAT.shade, 0, 1.58, 0).castShadow = false;
    addLamp(7.4, 1.5, 9.3, 5.5, false);

    g = grp(0.25, 4.95);
    bx(g, 0.3, 1.8, 1.1, MAT.walnut, 0, 0.9, 0);
    for (let s = 0; s < 4; s++) {
      let z = -0.48;
      while (z < 0.45) {
        const w = 0.03 + rnd() * 0.04, h = 0.2 + rnd() * 0.12;
        bx(g, 0.2, h, w, std(bc[Math.floor(rnd() * 7)], 0.75), 0.04, 0.12 + s * 0.43 + h / 2, z + w / 2);
        z += w + 0.004;
      }
    }
    col(0.06, 4.36, 0.45, 5.54);

    // Upgrade visual: Roaming Robot Vacuum
    W.upgrades.robovac = grp(3.5, 8.8);
    cy(W.upgrades.robovac, 0.18, 0.18, 0.07, MAT.black, 0, 0.045, 0);
    cy(W.upgrades.robovac, 0.06, 0.06, 0.08, MAT.teal, 0, 0.05, 0);
    W.upgrades.robovac.visible = false;

    // ---- Kitchen & Dining
    g = grp(12.3, 4.6);
    bx(g, 2.0, 0.88, 0.62, MAT.cab, 0, 0.44, 0);
    bx(g, 2.04, 0.04, 0.66, MAT.stone, 0, 0.9, 0);
    bx(g, 2.0, 0.7, 0.34, MAT.cab, 0, 1.85, -0.14);
    bx(g, 0.56, 0.02, 0.4, MAT.steel, -0.1, 0.915, 0.02);
    cy(g, 0.014, 0.014, 0.26, MAT.steel, -0.1, 1.04, -0.2);
    bx(g, 0.02, 0.02, 0.14, MAT.steel, -0.1, 1.16, -0.14);
    col(11.28, 4.26, 13.32, 4.94);

    // Upgrade visual: Espresso Machine on kitchen counter!
    W.upgrades.espresso = grp(11.65, 4.62);
    bx(W.upgrades.espresso, 0.28, 0.34, 0.28, MAT.steel, 0, 1.09, -0.06, 0.02);
    bx(W.upgrades.espresso, 0.24, 0.05, 0.2, MAT.black, 0, 0.94, 0.06);
    cy(W.upgrades.espresso, 0.035, 0.03, 0.07, MAT.white, 0, 0.99, 0.08);
    W.upgrades.espresso.visible = false;

    // Fridge & Stove
    bx(g0, 0.7, 1.85, 0.7, MAT.steel, 13.58, 0.925, 4.65); col(13.2, 4.26, 13.94, 5.04);
    g = grp(13.62, 5.95);
    bx(g, 0.6, 0.88, 1.8, MAT.cab, 0, 0.44, 0);
    bx(g, 0.64, 0.04, 1.84, MAT.stone, 0, 0.9, 0);
    bx(g, 0.56, 0.012, 0.72, MAT.black, 0, 0.925, 0.1);
    for (const [x, z] of [[-0.13, -0.08], [0.13, -0.08], [-0.13, 0.28], [0.13, 0.28]]) cy(g, 0.085, 0.085, 0.006, MAT.dark, x, 0.934, z);
    bx(g, 0.5, 0.14, 0.74, MAT.steel, 0.03, 1.85, 0.1);
    col(13.28, 5.02, 13.94, 6.88);

    // Fresh groceries fruit bowl on table (visible when S.groceries > 0!)
    W.groceriesMesh = grp(10.4, 8.3);
    cy(W.groceriesMesh, 0.16, 0.1, 0.08, MAT.oak, 0.35, 0.8, 0.1);
    ball(W.groceriesMesh, 0.055, MAT.red, 0.32, 0.86, 0.08);
    ball(W.groceriesMesh, 0.055, MAT.orange, 0.4, 0.86, 0.12);
    ball(W.groceriesMesh, 0.05, MAT.green, 0.35, 0.87, 0.15);

    // Dining Table & Chairs
    g = grp(10.4, 8.3);
    bx(g, 1.75, 0.05, 0.95, MAT.oak, 0, 0.75, 0);
    for (const [x, z] of [[-0.78, -0.38], [0.78, -0.38], [-0.78, 0.38], [0.78, 0.38]]) bx(g, 0.06, 0.73, 0.06, MAT.oak, x, 0.365, z);
    for (const [x, z, r] of [[-0.4, -0.72, 0], [0.4, -0.72, 0], [-0.4, 0.72, PI], [0.4, 0.72, PI]]) {
      const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = r; g.add(c);
      bx(c, 0.42, 0.04, 0.42, MAT.walnut, 0, 0.46, 0);
      bx(c, 0.42, 0.46, 0.04, MAT.walnut, 0, 0.72, -0.2);
      for (const [a, b] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) bx(c, 0.035, 0.45, 0.035, MAT.walnut, a, 0.225, b);
    }
    cy(g, 0.01, 0.01, 0.75, MAT.dark, 0, 2.35, 0);
    cy(g, 0.1, 0.24, 0.2, MAT.shade, 0, 1.9, 0).castShadow = false;
    col(9.45, 7.65, 11.35, 8.95);

    W.hchair = grp(9.12, 8.3, PI / 2);
    bx(W.hchair, 0.36, 0.04, 0.34, MAT.white, 0, 0.6, 0);
    bx(W.hchair, 0.36, 0.36, 0.03, MAT.white, 0, 0.8, -0.16);
    bx(W.hchair, 0.44, 0.025, 0.26, MAT.white, 0, 0.78, 0.24);
    for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) {
      const lg = bx(W.hchair, 0.03, 0.62, 0.03, MAT.oak, x, 0.3, z); lg.rotation.z = x < 0 ? 0.12 : -0.12;
    }
    col(8.88, 8.05, 9.38, 8.55);

    // ---- Dynamic Physical Mess Props (appear progressively as S.mess climbs!)
    const messSpecs = [
      [3.1, 0.06, 6.9, 0.24, 0.12, 0.24, MAT.red],      // stray toy box
      [5.1, 0.44, 6.0, 0.28, 0.07, 0.22, MAT.white],    // pizza/takeout box on coffee table
      [12.2, 0.96, 4.65, 0.26, 0.1, 0.26, MAT.white],   // stacked dirty plates by sink
      [6.4, 0.1, 8.2, 0.42, 0.2, 0.35, MAT.cushion],    // laundry pile near couch
      [10.2, 0.79, 8.2, 0.18, 0.08, 0.18, MAT.yellow],  // dishes on dining table
      [2.8, 0.08, 5.2, 0.3, 0.03, 0.24, MAT.white],     // scattered papers
      [8.2, 0.12, 6.6, 0.36, 0.22, 0.32, MAT.blue],     // kid backpack on floor
      [12.8, 0.96, 4.6, 0.12, 0.16, 0.12, MAT.red],     // mugs by sink
      [4.2, 0.08, 6.2, 0.14, 0.14, 0.14, MAT.yellow],   // blocks in living room
      [7.1, 0.1, 2.7, 0.36, 0.18, 0.32, MAT.kduvet],    // clothes pile in kid room
    ];
    for (const [mx, my, mz, mw, mh, md, mat] of messSpecs) {
      const m = bx(g0, mw, mh, md, mat, mx, my, mz, 0.02);
      m.visible = false;
      W.mess.push(m);
    }

    // ---- Backyard + Patio + Pergola + Hoop Upgrade
    for (const [x0, z0, x1, z1] of [
      [-1.6, 10, -1.5, 19.2], [15.5, 10, 15.6, 19.2], [-1.6, 19.1, 15.6, 19.2],
      [-1.6, 10, 0, 10.08], [14, 10, 15.6, 10.08],
    ]) {
      bx(g0, x1 - x0, 1.75, z1 - z0, MAT.fence, (x0 + x1) / 2, 0.875, (z0 + z1) / 2);
      col(x0 - 0.1, z0 - 0.1, x1 + 0.1, z1 + 0.1);
    }
    // Patio pergola & warm evening string lights
    for (const [px, pz] of [[1.6, 10.4], [6.2, 10.4], [1.6, 13.2], [6.2, 13.2]]) bx(g0, 0.14, 2.45, 0.14, MAT.walnut, px, 1.22, pz);
    for (let z = 10.6; z <= 13.1; z += 0.6) bx(g0, 4.8, 0.08, 0.1, MAT.walnut, 3.9, 2.46, z);
    for (let x = 2.0; x <= 5.8; x += 0.95) ball(g0, 0.045, MAT.bulb, x, 2.34, 13.2);
    addLamp(3.9, 2.2, 12.2, 8, false, 0xffd088);

    tree(11.8, 16.0, 1.05, true);
    tree(-3.5, 6.0, 1.2, false);
    tree(17.5, 1.5, 0.95, true);
    tree(18.5, 13.5, 1.1, true);

    // Swing set
    g = grp(3.0, 16.3);
    for (const x of [-1.2, 1.2]) for (const z of [-0.6, 0.6]) {
      const p = cy(g, 0.035, 0.035, 2.3, MAT.steel, x, 1.1, z * 0.9); p.rotation.x = z < 0 ? 0.26 : -0.26;
    }
    cy(g, 0.035, 0.035, 2.5, MAT.steel, 0, 2.18, 0).rotation.z = PI / 2;
    for (const x of [-0.5, 0.5]) {
      for (const s of [-0.18, 0.18]) cy(g, 0.008, 0.008, 1.6, MAT.dark, x + s, 1.38, 0);
      bx(g, 0.44, 0.03, 0.18, MAT.red, x, 0.58, 0);
    }
    col(1.55, 15.65, 1.98, 16.95); col(4.02, 15.65, 4.45, 16.95);

    W.ball = ball(g0, 0.12, MAT.orange, 8.4, 0.12, 14.9);
    g = grp(8.0, 17.9);
    for (const x of [-1, 1]) cy(g, 0.03, 0.03, 1.2, MAT.white, x, 0.6, 0);
    cy(g, 0.03, 0.03, 2.06, MAT.white, 0, 1.2, 0).rotation.z = PI / 2;

    // Upgrade visual: Backyard Basketball Hoop!
    W.upgrades.hoop = grp(8.0, 17.6);
    cy(W.upgrades.hoop, 0.06, 0.07, 3.0, MAT.dark, 0, 1.5, 0);
    bx(W.upgrades.hoop, 1.15, 0.78, 0.06, MAT.white, 0, 2.85, -0.12);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 8, 20), MAT.orange);
    rim.rotation.x = PI / 2; rim.position.set(0, 2.6, -0.36); W.upgrades.hoop.add(rim);
    W.upgrades.hoop.visible = false;

    // Backyard Grill
    g = grp(11.0, 11.2);
    bx(g, 1.0, 0.05, 0.6, MAT.dark, 0, 0.5, 0);
    cy(g, 0.3, 0.26, 0.4, MAT.black, 0, 0.78, 0);
    cy(g, 0.03, 0.03, 0.5, MAT.steel, 0, 0.25, 0);
    col(10.45, 10.85, 11.55, 11.55);

    // ---- Family Car in Driveway (walk up to drive anywhere!)
    buildCar(18.6, 7.2, PI / 2, MAT.teal);
    // Mailbox by curb
    cy(g0, 0.05, 0.05, 1.1, MAT.walnut, 20.9, 0.55, 3.8);
    bx(g0, 0.45, 0.22, 0.22, MAT.black, 20.9, 1.18, 3.8, 0.04);

    // ---- Stylized Neighbor Houses across the street & next door (kills empty void!)
    const neighborHouse = (x, z, wallCol, roofCol, ry = 0) => {
      const ng = grp(x, z, ry);
      bx(ng, 11, 3.4, 8.5, std(wallCol, 0.88), 0, 1.7, 0);
      const r1 = bx(ng, 11.6, 0.2, 5.2, std(roofCol, 0.9), 0, 4.2, -2.1); r1.rotation.x = -0.35;
      const r2 = bx(ng, 11.6, 0.2, 5.2, std(roofCol, 0.9), 0, 4.2, 2.1); r2.rotation.x = 0.35;
      for (const wx of [-3.2, 0, 3.2]) bx(ng, 1.3, 1.2, 0.1, MAT.bulb, wx, 1.8, -4.28);
      bx(ng, 1.1, 2.1, 0.12, MAT.door, 0, 1.05, -4.28);
      tree(x + 6.8, z - 2.5, 1.15, false);
    };
    neighborHouse(36.5, 4.0, 0xe4dccf, 0x4b443e, PI / 2);
    neighborHouse(36.5, 20.0, 0xcbd5dc, 0x363d46, PI / 2);
    neighborHouse(36.5, -12.0, 0xdfd0be, 0x4f3e34, PI / 2);
    neighborHouse(6.0, -14.5, 0xd8dfd4, 0x3b4440, 0);
    neighborHouse(6.0, 27.5, 0xe6d6cc, 0x453b3a, PI);

    // Streetlamps
    for (const sz of [-6, 10, 24]) {
      cy(g0, 0.06, 0.08, 4.2, MAT.dark, 22.2, 2.1, sz);
      ball(g0, 0.18, MAT.bulb, 22.2, 4.28, sz);
    }

    // Home Stations
    addStation(L, 'bed', { x: 2.65, z: 2.1, mx: 1.4, mz: 2.1, ic: '🛏️', title: 'Master Bed', acts: ['sleep'] });
    addStation(L, 'desk', { x: 10.5, z: 1.6, mx: 9.7, mz: 1.6, ic: '💼', title: 'Home Desk', acts: ['work', 'work_crunch_home'] });
    addStation(L, 'gym', { x: 11.9, z: 2.6, mx: 12.7, mz: 2.6, ic: '🏋️', title: 'Garage Gym', acts: ['exercise'] });
    addStation(L, 'couch', { x: 5.1, z: 6.65, mx: 5.1, mz: 7.55, ic: '🛋️', title: 'Living Room', acts: ['relax', 'movie'] });
    addStation(L, 'tv', { x: 5.1, z: 5.25, mx: 5.1, mz: 4.5, my: 1.92, ic: '📺', title: 'Television', acts: ['tv'] });
    addStation(L, 'play', { x: 2.75, z: 6.5, mx: 1.7, mz: 6.5, my: 1.05, ic: '🧸', title: 'Play Mat', acts: ['play'] });
    addStation(L, 'table', { x: 10.4, z: 7.25, mx: 10.4, mz: 8.3, ic: '🍽️', title: 'Kitchen Table', acts: ['feed', 'feed_quick'] });
    addStation(L, 'sink', { x: 12.2, z: 5.45, mx: 12.2, mz: 4.6, ic: '🧽', title: 'Kitchen Counter', acts: ['chores', 'coffee'] });
    addStation(L, 'car_home', { x: 16.5, z: 7.6, mx: 18.6, mz: 7.2, my: 1.8, ic: '🚗', title: 'Family Car', acts: ['travel'] });
    addStation(L, 'yard', { x: 6.6, z: 13.6, mx: 7.8, mz: 14.9, my: 1.25, ic: '⚽', title: 'Backyard', acts: ['outside'] });
    addStation(L, 'read', { x: 7.75, z: 3.15, mx: 8.5, mz: 3.45, ic: '📖', title: 'Reading Chair', acts: ['read'] });
    addStation(L, 'change', { x: 5.9, z: 1.4, mx: 5.0, mz: 1.25, ic: '🧷', title: 'Kid Station', acts: ['change', 'homework'] });
    addStation(L, 'crib', { x: 7.95, z: 1.0, mx: 8.7, mz: 1.0, ic: '🌙', title: 'Kid Bed', acts: ['soothe', 'bedtime', 'bedtime_quick'] });
  }

  /* =====================================================================
     LOCATION 2: MAPLE STREET PARK
     ===================================================================== */
  {
    const L = makeLoc('park', { x: 0, z: 11.8, yaw: 0 });
    curBuild = L;
    const g0 = grp(0, 0);

    floor(-36, -34, 36, 36, MAT.grass, 3.2, -0.02);
    // Paved park walking loop + entrance path
    floor(-1.5, 4, 1.5, 16, MAT.paver, 1.6, 0.005);
    floor(-11, -2, 11, 1.2, MAT.paver, 1.6, 0.005);
    floor(-11, -11, -8.5, 7, MAT.paver, 1.6, 0.005);
    floor(8.5, -11, 11, 7, MAT.paver, 1.6, 0.005);
    floor(-11, -12, 11, -9.8, MAT.paver, 1.6, 0.005);
    // Parking strip at south edge
    floor(-16, 13.8, 16, 20, MAT.asphalt, 4, 0.0);

    // Park border rail fences & colliders
    col(-15.5, -15, 15.5, -14.6);
    col(-15.5, 14.2, 15.5, 14.6);
    col(-15.5, -15, -15.1, 14.6);
    col(15.1, -15, 15.5, 14.6);
    for (let x = -14; x <= 14; x += 4) bx(g0, 3.8, 0.9, 0.1, MAT.fence, x, 0.45, -14.8);

    // Scenic Pond with Ducks!
    const pond = new THREE.Mesh(new THREE.CircleGeometry(4.2, 32), MAT.water);
    pond.rotation.x = -PI / 2; pond.position.set(0, 0.02, -6.2); L.group.add(pond);
    col(-3.9, -9.8, 3.9, -2.5);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * PI * 2;
      ball(g0, 0.32 + (i % 3) * 0.1, MAT.concrete, Math.cos(a) * 4.2, 0.12, -6.2 + Math.sin(a) * 4.2);
    }
    // Cute ducks on pond
    W.ducks = grp(0, -6.2);
    for (const [dx, dz] of [[1.1, 0.6], [-0.9, -0.4], [0.2, 1.4]]) {
      ball(W.ducks, 0.16, MAT.white, dx, 0.1, dz);
      ball(W.ducks, 0.09, MAT.yellow, dx + 0.13, 0.22, dz);
    }

    // Wooden Playground Tower + Slide + Swings (West side)
    let g = grp(-6.2, 3.8);
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bx(g, 0.14, 2.8, 0.14, MAT.oak, px, 1.4, pz);
    bx(g, 2.2, 0.14, 2.2, MAT.oak, 0, 1.45, 0);
    bx(g, 2.4, 0.16, 1.5, MAT.red, 0, 3.05, -0.5).rotation.x = -0.45;
    bx(g, 2.4, 0.16, 1.5, MAT.red, 0, 3.05, 0.5).rotation.x = 0.45;
    const slide = bx(g, 0.65, 0.08, 2.4, MAT.yellow, 1.7, 0.78, 0); slide.rotation.z = -0.58;
    col(-7.5, 2.5, -4.0, 5.1);

    // Sandbox
    bx(g0, 2.6, 0.22, 2.6, MAT.oak, -6.0, 0.11, 7.6);
    bx(g0, 2.35, 0.14, 2.35, std(0xe5d09b, 0.96), -6.0, 0.14, 7.6);

    // Half-Court Basketball (East side)
    floor(4.5, 1.5, 11.5, 8.5, MAT.asphalt, 3, 0.01);
    bx(g0, 0.08, 0.015, 7.0, MAT.white, 4.55, 0.014, 5.0);
    bx(g0, 7.0, 0.015, 0.08, MAT.white, 8.0, 0.014, 1.55);
    const hoop = grp(11.1, 5.0, -PI / 2);
    cy(hoop, 0.07, 0.08, 3.1, MAT.dark, 0, 1.55, 0);
    bx(hoop, 1.25, 0.85, 0.06, MAT.white, 0, 2.95, 0.15);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.022, 8, 20), MAT.orange);
    rim.rotation.x = PI / 2; rim.position.set(0, 2.68, 0.42); hoop.add(rim);
    col(10.8, 4.6, 11.4, 5.4);
    ball(g0, 0.13, MAT.orange, 8.2, 0.13, 5.2);

    // Picnic Table (NW lawn)
    g = grp(-6.5, -5.5);
    bx(g, 1.8, 0.07, 0.85, MAT.oak, 0, 0.74, 0);
    bx(g, 1.8, 0.05, 0.34, MAT.oak, 0, 0.44, -0.75);
    bx(g, 1.8, 0.05, 0.34, MAT.oak, 0, 0.44, 0.75);
    bx(g, 1.2, 0.02, 0.87, MAT.red, 0, 0.78, 0); // picnic runner
    col(-7.5, -6.5, -5.5, -4.5);

    // Park Benches & Lamp Posts
    const parkBench = (x, z, ry) => {
      const b = grp(x, z, ry);
      bx(b, 1.6, 0.08, 0.5, MAT.walnut, 0, 0.46, 0);
      bx(b, 1.6, 0.45, 0.07, MAT.walnut, 0, 0.74, -0.22);
      for (const lx of [-0.68, 0.68]) bx(b, 0.08, 0.45, 0.46, MAT.dark, lx, 0.23, 0);
      col(x - 0.85, z - 0.38, x + 0.85, z + 0.38);
    };
    parkBench(-2.8, 6.2, 0);
    parkBench(3.2, -1.8, PI);

    for (const [lx, lz] of [[-2.5, 9], [2.5, 9], [-8.5, -1], [8.5, -1], [0, -11.5]]) {
      cy(g0, 0.06, 0.08, 3.4, MAT.dark, lx, 1.7, lz);
      ball(g0, 0.18, MAT.bulb, lx, 3.48, lz);
      addLamp(lx, 3.3, lz, 9, false, 0xffd596);
    }

    // Trailhead jogging sign
    bx(g0, 0.08, 1.4, 0.08, MAT.walnut, 7.6, 0.7, -7.2);
    bx(g0, 0.9, 0.45, 0.06, MAT.green, 7.6, 1.28, -7.2);

    // Lush Trees surrounding the park
    for (const [tx, tz, sc] of [
      [-13, 10, 1.2], [-13, 0, 1.35], [-12.5, -10, 1.15], [13.2, 10, 1.25], [13.5, 0, 1.3], [12.5, -10, 1.2],
      [-6, -13.5, 1.4], [6, -13.5, 1.3], [0, -14.2, 1.5], [-18, 5, 1.6], [18, -5, 1.5],
    ]) tree(tx, tz, sc, Math.abs(tx) < 15 && Math.abs(tz) < 14);

    // Your Car parked at entrance
    buildCar(3.2, 15.6, PI / 2, MAT.teal);

    // Park Stations
    addStation(L, 'park_play', { x: -3.4, z: 4.5, mx: -5.4, mz: 4.2, my: 1.9, ic: '🛝', title: 'Playground & Court', acts: ['park_play'] });
    addStation(L, 'park_run', { x: 7.4, z: -5.8, mx: 7.6, mz: -7.2, my: 1.85, ic: '🏃', title: 'Park Trail', acts: ['park_run'] });
    addStation(L, 'park_bench', { x: -2.8, z: 7.2, mx: -2.8, mz: 6.2, my: 1.45, ic: '💬', title: 'Park Bench', acts: ['park_bench'] });
    addStation(L, 'park_picnic', { x: -6.5, z: -3.8, mx: -6.5, mz: -5.5, my: 1.5, ic: '🧺', title: 'Picnic Lawn', acts: ['park_picnic'] });
    addStation(L, 'car_park', { x: 2.2, z: 13.2, mx: 3.2, mz: 15.6, my: 1.75, ic: '🚗', title: 'Family Car', acts: ['travel'] });
  }

  /* =====================================================================
     LOCATION 3: CAREER-ADAPTIVE WORKPLACE
     ===================================================================== */
  {
    const L = makeLoc('work', { x: 6.5, z: 8.6, yaw: 0 });
    curBuild = L;
    const g0 = grp(0, 0);

    floor(-15, -12, 28, 25, MAT.asphalt, 4, -0.02);
    floor(0, 0, 13, 10, MAT.carpet, 2.2, 0.01);
    bx(g0, 13.4, 0.16, 10.4, MAT.ceil, 6.5, WH + 0.55, 5);

    // Exterior walls with huge office windows + entrance door
    wall('x', 0, 0, 13, [{ a: 1.5, b: 5.5, s: 0.7, h: 2.6 }, { a: 7.5, b: 11.5, s: 0.7, h: 2.6 }], MAT.wall, WH + 0.5);
    wall('x', 10, 0, 13, [{ a: 5.6, b: 7.4, h: 2.25 }], MAT.wall, WH + 0.5);
    wall('z', 0, 0, 10, [{ a: 2.0, b: 7.5, s: 0.8, h: 2.6 }], MAT.wall, WH + 0.5);
    wall('z', 13, 0, 10, [{ a: 2.0, b: 7.5, s: 0.8, h: 2.6 }], MAT.wall, WH + 0.5);

    addLamp(3.5, 2.9, 3.0, 14, true, 0xf2f6ff);
    addLamp(9.5, 2.9, 3.0, 14, true, 0xf2f6ff);
    addLamp(6.5, 2.9, 7.2, 13, true, 0xfff0d8);

    // Career-specific decor groups
    W.workBlue = grp(0, 0);
    W.workWhite = grp(0, 0);
    W.workTech = grp(0, 0);

    // Shared Main Workstation area (North-West x: 1.5..5.5, z: 1.5..4)
    bx(g0, 2.4, 0.06, 1.0, MAT.oak, 3.5, 0.76, 2.2);
    for (const x of [2.4, 4.6]) bx(g0, 0.08, 0.75, 0.9, MAT.dark, x, 0.37, 2.2);
    col(2.2, 1.65, 4.8, 2.78);

    // White Collar: Dual monitors, conference table with legs, cleanly framed whiteboard
    bx(W.workWhite, 0.75, 0.44, 0.04, MAT.black, 3.1, 1.12, 1.9);
    bx(W.workWhite, 0.69, 0.38, 0.01, MAT.monitor, 3.1, 1.12, 1.93);
    bx(W.workWhite, 0.75, 0.44, 0.04, MAT.black, 3.95, 1.12, 1.9);
    bx(W.workWhite, 0.69, 0.38, 0.01, MAT.monitor, 3.95, 1.12, 1.93);
    bx(W.workWhite, 2.6, 0.06, 1.3, MAT.walnut, 9.2, 0.74, 2.6); // conference table
    for (const [lx, lz] of [[8.05, 2.05], [10.35, 2.05], [8.05, 3.15], [10.35, 3.15]]) {
      bx(W.workWhite, 0.07, 0.74, 0.07, MAT.dark, lx, 0.37, lz);
    }
    bx(W.workWhite, 1.65, 1.05, 0.04, MAT.white, 6.5, 1.65, 0.14); // whiteboard fits between windows
    bx(W.workWhite, 0.42, 0.36, 0.05, MAT.green, 6.08, 1.54, 0.16);
    bx(W.workWhite, 0.42, 0.58, 0.05, MAT.blue, 6.62, 1.65, 0.16);

    // Tech Startup Loft: Standing desk ultrawide, glowing server rack, sprint sticky notes
    bx(W.workTech, 1.4, 0.48, 0.05, MAT.black, 3.5, 1.18, 1.9);
    bx(W.workTech, 1.32, 0.42, 0.01, MAT.monitor, 3.5, 1.18, 1.93);
    bx(W.workTech, 0.9, 2.1, 0.85, MAT.black, 11.4, 1.05, 1.4); // server rack
    for (let i = 0; i < 6; i++) bx(W.workTech, 0.6, 0.05, 0.04, i % 2 ? MAT.green : MAT.blue, 11.4, 0.4 + i * 0.28, 1.84);
    bx(W.workTech, 1.68, 1.05, 0.05, MAT.dark, 6.5, 1.65, 0.14);
    for (let i = 0; i < 8; i++) bx(W.workTech, 0.16, 0.16, 0.02, [MAT.yellow, MAT.orange, MAT.teal, MAT.red][i % 4], 5.95 + (i % 4) * 0.36, 1.86 - Math.floor(i / 4) * 0.36, 0.18);
    // Tech loft sprint table with legs
    bx(W.workTech, 2.2, 0.06, 1.1, MAT.oak, 9.2, 0.74, 2.6);
    for (const [lx, lz] of [[8.2, 2.15], [10.2, 2.15], [8.2, 3.05], [10.2, 3.05]]) {
      bx(W.workTech, 0.07, 0.74, 0.07, MAT.dark, lx, 0.37, lz);
    }

    // Blue Collar: Electrical conduit panels, orange cones, tool chests, blueprint table with legs
    bx(W.workBlue, 1.6, 1.2, 0.2, MAT.steel, 3.5, 1.6, 0.25); // breaker panel
    for (let i = 0; i < 4; i++) cy(W.workBlue, 0.025, 0.025, 1.4, MAT.steel, 2.9 + i * 0.4, 2.4, 0.25);
    bx(W.workBlue, 1.1, 0.9, 0.55, MAT.red, 1.4, 0.45, 2.2, 0.02); // giant rolling tool chest
    for (const [cx, cz] of [[8.2, 2.0], [10.4, 2.4]]) cy(W.workBlue, 0.04, 0.22, 0.55, MAT.orange, cx, 0.27, cz); // cones
    bx(W.workBlue, 1.8, 0.08, 1.1, MAT.oak, 9.2, 0.88, 2.6); // blueprint table
    for (const [lx, lz] of [[8.4, 2.15], [10.0, 2.15], [8.4, 3.05], [10.0, 3.05]]) {
      bx(W.workBlue, 0.08, 0.88, 0.08, MAT.walnut, lx, 0.44, lz);
    }
    bx(W.workBlue, 1.4, 0.02, 0.85, MAT.blue, 9.2, 0.93, 2.6);

    col(7.8, 1.9, 10.6, 3.3);

    // Breakroom / Networking Lounge (East-South x: 9..12.5, z: 5.5..8.5)
    bx(g0, 0.65, 0.88, 2.2, MAT.cab, 12.4, 0.44, 6.6);
    bx(g0, 0.68, 0.05, 2.24, MAT.stone, 12.4, 0.9, 6.6);
    bx(g0, 0.34, 0.42, 0.34, MAT.steel, 12.35, 1.12, 6.2); // espresso / coffee bar
    cy(g0, 0.55, 0.55, 0.05, MAT.oak, 10.2, 0.75, 6.8);
    cy(g0, 0.06, 0.06, 0.74, MAT.dark, 10.2, 0.37, 6.8);
    col(9.6, 6.2, 12.9, 7.8);

    // Commute car outside entrance
    buildCar(6.5, 13.4, PI / 2, MAT.teal);
    col(-1, 10.1, 14, 10.3); // keep inside workplace (exit via door/car station)

    // Workplace Stations
    addStation(L, 'work_main', { x: 3.5, z: 3.4, mx: 3.5, mz: 2.2, my: 1.6, ic: '💼', title: 'Workstation', acts: ['work_office', 'work_crunch'] });
    addStation(L, 'work_break', { x: 9.2, z: 6.8, mx: 10.8, mz: 6.8, my: 1.55, ic: '☕', title: 'Breakroom & Crew', acts: ['work_network'] });
    addStation(L, 'car_work', { x: 6.5, z: 9.1, mx: 6.5, mz: 9.85, my: 1.65, ic: '🚗', title: 'Commute Car', acts: ['travel'] });
  }

  /* =====================================================================
     LOCATION 4: MAIN STREET TOWN PLAZA
     ===================================================================== */
  {
    const L = makeLoc('town', { x: 0, z: 9.8, yaw: 0 });
    curBuild = L;
    const g0 = grp(0, 0);

    floor(-30, -24, 30, 26, MAT.paver, 1.8, 0.0);
    floor(-30, 11.2, 30, 18.5, MAT.asphalt, 4, 0.005);
    for (let x = -24; x < 24; x += 4.5) bx(g0, 2.1, 0.012, 0.14, MAT.yellow, x, 0.01, 14.8);

    // Playable plaza bounds
    col(-14.5, -10.5, 14.5, -10.1);
    col(-14.5, 11.4, 14.5, 11.8);
    col(-14.5, -10.5, -14.1, 11.8);
    col(14.1, -10.5, 14.5, 11.8);

    // Central Town Fountain
    cy(g0, 1.75, 1.9, 0.55, MAT.concrete, 0, 0.275, 1.5, 24);
    cy(g0, 1.5, 1.5, 0.45, MAT.water, 0, 0.34, 1.5, 24);
    cy(g0, 0.28, 0.35, 1.2, MAT.concrete, 0, 0.8, 1.5, 16);
    cy(g0, 0.72, 0.4, 0.16, MAT.concrete, 0, 1.38, 1.5, 16);
    col(-1.95, -0.45, 1.95, 3.45);

    // Storefront signboard helper
    const makeSign = (label, bg, fg = '#f8f5ee') => {
      const t = makeTex(512, 96, (x, w, h) => {
        x.fillStyle = bg; x.fillRect(0, 0, w, h);
        x.strokeStyle = 'rgba(255,255,255,0.45)'; x.lineWidth = 6; x.strokeRect(8, 8, w - 16, h - 16);
        x.fillStyle = fg; x.font = 'bold 42px ui-sans-serif,system-ui,sans-serif';
        x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(label, w / 2, h / 2 + 2);
      }, false);
      return std(0xffffff, 0.5, 0, { map: t });
    };

    // Storefront builder with signage & window mullions
    const shop = (x, z, w, d, wallMat, awnMat, signLabel, signBg, ry = 0) => {
      const s = grp(x, z, ry);
      bx(s, w, 4.5, d, wallMat, 0, 2.25, 0);
      bx(s, w + 0.3, 0.28, d + 0.3, MAT.roof, 0, 4.6, 0);
      // Framed lit shop windows with mullions
      for (const wx of [-w * 0.28, w * 0.28]) {
        const ww = w * 0.28;
        bx(s, ww + 0.14, 1.84, 0.12, MAT.trim, wx, 1.45, d / 2 + 0.02);
        bx(s, ww, 1.7, 0.14, MAT.bulb, wx, 1.45, d / 2 + 0.04);
        bx(s, 0.05, 1.72, 0.16, MAT.trim, wx, 1.45, d / 2 + 0.05);
        bx(s, ww + 0.04, 0.05, 0.16, MAT.trim, wx, 1.45, d / 2 + 0.05);
      }
      bx(s, 1.25, 2.3, 0.12, MAT.door, 0, 1.15, d / 2 + 0.05);
      ball(s, 0.045, MAT.brass, 0.45, 1.05, d / 2 + 0.12);
      // Striped awning
      const aw = bx(s, w * 0.92, 0.12, 1.35, awnMat, 0, 2.75, d / 2 + 0.65); aw.rotation.x = 0.22;
      // Painted Signboard above awning!
      bx(s, w * 0.72, 0.68, 0.1, makeSign(signLabel, signBg), 0, 3.65, d / 2 + 0.08);
      const hw = Math.abs(Math.cos(ry)) * (w / 2) + Math.abs(Math.sin(ry)) * (d / 2);
      const hd = Math.abs(Math.sin(ry)) * (w / 2) + Math.abs(Math.cos(ry)) * (d / 2);
      col(x - hw, z - hd, x + hw, z + hd);
    };

    // 1. Main Street Bistro (NW)
    shop(-7.8, -8.0, 6.8, 4.6, MAT.brick, MAT.red, 'MAIN ST. BISTRO', '#6d2323', 0);
    // Candlelit Bistro Patio Table (Date Night spot!)
    let g = grp(-7.6, -3.4);
    cy(g, 0.62, 0.62, 0.05, MAT.white, 0, 0.76, 0);
    cy(g, 0.06, 0.06, 0.75, MAT.dark, 0, 0.37, 0);
    cy(g, 0.04, 0.04, 0.12, MAT.bulb, 0, 0.84, 0); // candle!
    for (const cx of [-0.85, 0.85]) bx(g, 0.42, 0.48, 0.42, MAT.walnut, cx, 0.24, 0);
    col(-8.4, -4.1, -6.8, -2.7);
    addLamp(-7.6, 2.5, -3.4, 10, false, 0xffca7a);

    // 2. Corner Market & Books (North Center)
    shop(0, -8.5, 6.8, 4.4, MAT.extWall, MAT.green, 'CORNER MARKET', '#2b5932', 0);
    // Outdoor produce crates
    for (const [ox, c] of [[-1.6, MAT.red], [-0.8, MAT.orange], [1.2, MAT.green]]) {
      bx(g0, 0.65, 0.55, 0.55, MAT.oak, ox, 0.28, -5.6);
      ball(g0, 0.16, c, ox, 0.62, -5.6);
    }
    col(-2.1, -6.0, 1.8, -5.2);
    addLamp(0, 2.6, -4.8, 9, false, 0xffe4b8);

    // 3. O'Malley's Neighborhood Pub (NE)
    shop(7.8, -8.0, 6.8, 4.6, MAT.brick, MAT.teal, "O'MALLEY'S PUB", '#1d4a52', 0);
    g = grp(7.6, -3.4);
    bx(g, 1.8, 0.07, 0.85, MAT.walnut, 0, 0.76, 0);
    for (const lx of [-0.74, 0.74]) bx(g, 0.08, 0.75, 0.75, MAT.dark, lx, 0.37, 0);
    // Solid wooden pub benches on both sides so patrons sit cleanly!
    bx(g, 1.75, 0.06, 0.38, MAT.walnut, 0, 0.44, -0.78);
    bx(g, 1.75, 0.06, 0.38, MAT.walnut, 0, 0.44, 0.78);
    for (const lx of [-0.72, 0.72]) for (const lz of [-0.78, 0.78]) bx(g, 0.07, 0.44, 0.32, MAT.dark, lx, 0.22, lz);
    cy(g, 0.045, 0.04, 0.14, MAT.yellow, -0.3, 0.86, 0.1);
    cy(g, 0.045, 0.04, 0.14, MAT.yellow, 0.32, 0.86, -0.1);
    col(6.5, -4.5, 8.7, -2.3);
    addLamp(7.6, 2.5, -3.4, 10, false, 0xffc876);

    // 4. Maple Family Clinic (West side)
    shop(-12.2, 3.2, 6.2, 4.4, MAT.white, MAT.blue, 'MAPLE CLINIC', '#26538d', PI / 2);
    addLamp(-8.6, 2.8, 3.2, 8, false, 0xd8ecff);

    // Enclosing trees, hedges & brick garden walls between buildings (no bare horizon gaps!)
    bx(g0, 3.2, 1.6, 0.35, MAT.brick, -12.6, 0.8, -5.2);
    bx(g0, 3.2, 1.6, 0.35, MAT.brick, 12.6, 0.8, -5.2);
    tree(-13.2, -3.5, 1.25, false);
    tree(-13.2, -8.5, 1.15, false);
    tree(13.2, -3.5, 1.25, false);
    tree(13.2, -8.5, 1.15, false);
    tree(-4.1, -11.5, 1.2, false);
    tree(4.1, -11.5, 1.2, false);

    // Overhead warm plaza string lights & trees
    for (const [lx, lz] of [[-5, 2], [5, 2], [-5, 7.5], [5, 7.5]]) {
      cy(g0, 0.06, 0.08, 3.6, MAT.dark, lx, 1.8, lz);
      ball(g0, 0.17, MAT.bulb, lx, 3.68, lz);
      addLamp(lx, 3.5, lz, 8, false, 0xffd28c);
    }
    tree(-11, 9.2, 0.9, true);
    tree(11, 8.8, 0.95, true);
    tree(12.2, 2.2, 0.95, true);

    // Your Car parked on Main Street
    buildCar(2.6, 13.0, PI / 2, MAT.teal);

    // Town Stations
    addStation(L, 'bistro', { x: -6.2, z: -2.6, mx: -7.6, mz: -3.4, my: 1.6, ic: '🍷', title: 'Main Street Bistro', acts: ['town_date', 'town_espresso'] });
    addStation(L, 'market', { x: 0, z: -4.4, mx: 0, mz: -5.6, my: 1.65, ic: '🛒', title: 'Corner Market', acts: ['town_groceries', 'town_gift_w', 'town_gift_k'] });
    addStation(L, 'pub', { x: 6.2, z: -2.6, mx: 7.6, mz: -3.4, my: 1.6, ic: '🍻', title: 'Neighborhood Pub', acts: ['town_pub', 'town_pub_late'] });
    addStation(L, 'clinic', { x: -8.6, z: 3.2, mx: -9.8, mz: 3.2, my: 1.7, ic: '🩺', title: 'Family Clinic', acts: ['town_clinic'] });
    addStation(L, 'car_town', { x: 1.8, z: 10.6, mx: 2.6, mz: 13.0, my: 1.75, ic: '🚗', title: 'Family Car', acts: ['travel'] });
  }

  /* =====================================================================
     EXPRESSIVE CHARACTERS (Mom, Kid, + Ambient Town/Park/Work NPCs)
     ===================================================================== */
  function person(o, parent = scene) {
    const root = new THREE.Group(), body = new THREE.Group();
    root.add(body); parent.add(root);
    const skin = std(o.skin, 0.62), shirt = std(o.shirt, 0.85), pants = std(o.pants, 0.9), hair = std(o.hair, 0.75), shoe = std(0x28292e, 0.7);
    const shoes = [];
    const mk = (geo, mat, x, y, z, par = body) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; par.add(m); return m;
    };
    mk(new THREE.CapsuleGeometry(0.155, 0.3, 6, 14), shirt, 0, 1.13, 0).scale.set(1, 1, 0.72);
    mk(new THREE.CapsuleGeometry(0.15, 0.06, 6, 14), pants, 0, 0.9, 0).scale.set(1, 1, 0.75);
    mk(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 10), skin, 0, 1.42, 0);
    const head = new THREE.Group(); head.position.set(0, 1.5, 0); body.add(head);
    mk(new THREE.SphereGeometry(0.116, 20, 16), skin, 0, 0.08, 0, head);
    mk(new THREE.SphereGeometry(0.124, 20, 14, 0, PI * 2, 0, PI * 0.54), hair, 0, 0.088, -0.01, head);
    const longHair = mk(new THREE.CapsuleGeometry(0.1, 0.2, 4, 10), hair, 0, -0.02, -0.065, head);
    longHair.scale.set(1.05, 1, 0.6);
    longHair.visible = !!o.long;
    for (const x of [-0.042, 0.042]) mk(new THREE.SphereGeometry(0.013, 8, 8), shoe, x, 0.092, 0.107, head);
    // Warm smile arc
    const smile = mk(new THREE.BoxGeometry(0.045, 0.008, 0.01), std(0x7c3e32, 0.8), 0, 0.036, 0.112, head);
    mk(new THREE.SphereGeometry(0.015, 8, 8), skin, 0, 0.062, 0.116, head);
    const limb = (x, y, r, len, mat, end) => {
      const g = new THREE.Group(); g.position.set(x, y, 0); body.add(g);
      mk(new THREE.CapsuleGeometry(r, len, 4, 10), mat, 0, -len / 2 - r * 0.4, 0, g);
      if (end === 'hand') mk(new THREE.SphereGeometry(r * 1.05, 10, 8), skin, 0, -len - r * 1.4, 0, g);
      else shoes.push(mk(new THREE.BoxGeometry(r * 1.9, 0.07, 0.22), shoe, 0, -len - r * 1.2, 0.05, g));
      return g;
    };
    const P = {
      root, body, head, long: longHair, smile, shoes, shirt, pants, hair,
      legL: limb(-0.085, 0.86, 0.068, 0.68, pants),
      legR: limb(0.085, 0.86, 0.068, 0.68, pants),
      armL: limb(-0.225, 1.34, 0.048, 0.5, shirt, 'hand'),
      armR: limb(0.225, 1.34, 0.048, 0.5, shirt, 'hand'),
      pose: '', cur: '', path: [], phase: 0, wt: 0,
    };
    const sm = new THREE.SpriteMaterial({ transparent: true, toneMapped: false, depthWrite: false });
    P.bub = new THREE.Sprite(sm); P.bub.scale.setScalar(0.3); P.bub.visible = false; parent.add(P.bub); P.bubE = '';
    setPose(P, 'stand');
    return P;
  }

  function setPose(P, pose) {
    if (P.pose === pose) return;
    P.pose = pose;
    const b = P.body;
    b.rotation.x = 0; b.position.set(0, 0, 0);
    P.legL.rotation.x = P.legR.rotation.x = P.armL.rotation.x = P.armR.rotation.x = 0;
    if (pose === 'sit') {
      b.position.y = -0.78;
      P.legL.rotation.x = P.legR.rotation.x = -PI / 2;
      P.armL.rotation.x = P.armR.rotation.x = -0.5;
    } else if (pose === 'lie') {
      b.rotation.x = -PI / 2;
      b.position.set(0, 0.11, 0.85);
    }
  }

  function bubble(P, e, h) {
    if (!e || !P.root.visible) { P.bub.visible = false; return; }
    if (P.bubE !== e) { P.bubE = e; P.bub.material.map = emojiTex(e); P.bub.material.needsUpdate = true; }
    P.bub.visible = true;
    P.bub.position.set(P.root.position.x, P.root.position.y + h, P.root.position.z);
  }

  const mom = person({ skin: 0xd9a27e, shirt: 0x9b688d, pants: 0x303c52, hair: 0x3a2618, long: true });
  const kid = person({ skin: 0xe3af88, shirt: 0xf2f0ea, pants: 0xf2f0ea, hair: 0x4b3120 });
  mom.root.visible = kid.root.visible = false;

  // Ambient Location NPCs!
  const ambientNPCs = [];
  const addAmbient = (locId, cfg, x, y, z, ry, pose = 'stand') => {
    const p = person(cfg, LOCS[locId].group);
    p.root.position.set(x, y, z);
    p.root.rotation.y = ry;
    setPose(p, pose);
    ambientNPCs.push(p);
    return p;
  };
  // Park neighbor dad & kid
  addAmbient('park', { skin: 0xc98f68, shirt: 0x3b6e52, pants: 0x444c59, hair: 0x261a12 }, -2.3, 0.44, 6.2, 0.2, 'sit');
  const parkKid = addAmbient('park', { skin: 0xcf946e, shirt: 0xe07b38, pants: 0x3d5472, hair: 0x261a12 }, -5.4, 0, 7.6, -0.5, 'stand');
  parkKid.root.scale.setScalar(0.62);
  // Workplace coworkers (cleanly positioned outside tables)
  addAmbient('work', { skin: 0xe0ad8a, shirt: 0x3c6294, pants: 0x2a2d36, hair: 0x553b26, long: true }, 9.2, 0, 3.85, PI, 'stand');
  addAmbient('work', { skin: 0x9b6a4b, shirt: 0xc95e3a, pants: 0x2e3440, hair: 0x1a1715 }, 11.2, 0, 6.8, -PI / 2, 'stand');
  // Town friends seated cleanly on Pub north bench (z = -4.18) + Market grocer
  addAmbient('town', { skin: 0xd69f7a, shirt: 0x4b7756, pants: 0x2f343e, hair: 0x3a2a1e }, 7.2, 0.47, -4.18, 0.1, 'sit');
  addAmbient('town', { skin: 0x8e5d40, shirt: 0x624d86, pants: 0x2c323c, hair: 0x181515, long: true }, 8.05, 0.47, -4.18, -0.1, 'sit');
  addAmbient('town', { skin: 0xdeb08c, shirt: 0x4a7b52, pants: 0x3b3a36, hair: 0x5d422c }, 0.3, 0, -5.9, 0, 'stand');

  // Seasonal Outdoor Particles (sun motes / fall leaves / winter snow)
  const pCount = 160;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    pPos[i * 3] = (rnd() - 0.5) * 42;
    pPos[i * 3 + 1] = rnd() * 11 + 0.5;
    pPos[i * 3 + 2] = (rnd() - 0.5) * 42;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({ color: 0xfff5d6, size: 0.14, transparent: true, opacity: 0.65 });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  // ---------- NPC Waypoints & Routing ----------
  const SPOTS = {
    // Home
    mat: { x: 1.7, z: 6.5, pose: 'floor', face: PI / 2 },
    matM: { x: 2.0, z: 7.6, pose: 'sit', face: PI },
    highchair: { x: 9.12, z: 8.3, pose: 'sit', y: 0.64, face: PI / 2 },
    chairK: { x: 10.0, z: 9.02, pose: 'sit', y: 0.5, face: PI },
    chairM: { x: 10.8, z: 9.02, pose: 'sit', y: 0.5, face: PI },
    tableM: { x: 9.2, z: 7.5, face: 0 },
    yardK: { x: 7.8, z: 14.6, face: PI },
    armchair: { x: 8.6, z: 3.45, pose: 'sit', y: 0.44, face: -PI / 2 },
    armM: { x: 7.8, z: 3.0, face: PI / 2 },
    changeK: { x: 4.97, z: 1.25, pose: 'lie', y: 0.94, face: 0 },
    changeM: { x: 5.6, z: 1.25, face: -PI / 2 },
    deskK: { x: 5.5, z: 1.25, pose: 'sit', y: 0.48, face: -PI / 2 },
    deskM: { x: 5.9, z: 2.0, face: -PI / 2 },
    bedK: { x: 8.7, z: 1.02, pose: 'lie', y: 0.52, face: 0 },
    bedKM: { x: 7.95, z: 1.0, face: PI / 2 },
    tvK: { x: 5.1, z: 5.32, pose: 'sit', face: PI },
    couchK2: { x: 4.45, z: 7.42, pose: 'sit', y: 0.5, face: PI },
    rugK: { x: 6.7, z: 2.3, pose: 'sit', face: 0 },
    teen: { x: 8.25, z: 1.5, pose: 'sit', y: 0.5, face: -PI / 2 },
    couchK: { x: 5.7, z: 7.3, pose: 'lie', y: 0.72, face: PI / 2 },
    couchM: { x: 5.6, z: 7.42, pose: 'sit', y: 0.5, face: PI },
    bedM: { x: 1.3, z: 2.55, pose: 'lie', y: 0.64, face: PI / 2 },
    sinkM: { x: 12.7, z: 5.35, face: PI },
    door: { x: 13.1, z: 7.8 },
    // Park
    park_playK: { x: -4.2, z: 4.4, pose: 'stand', face: PI / 2 },
    park_picnicK: { x: -6.1, z: -4.75, pose: 'sit', y: 0.46, face: PI },
    park_picnicM: { x: -7.0, z: -6.25, pose: 'sit', y: 0.46, face: 0 },
    park_benchM: { x: -3.2, z: 6.2, pose: 'sit', y: 0.46, face: 0 },
    // Town
    town_bistroM: { x: -8.45, z: -3.4, pose: 'sit', y: 0.48, face: PI / 2 },
    town_strollK: { x: -1.4, z: -4.2, pose: 'stand', face: 0 },
  };

  const DOORS = {
    bed: { in: { x: 3.45, z: 3.55 }, out: { x: 3.45, z: 4.9 } },
    kid: { in: { x: 6.85, z: 3.55 }, out: { x: 6.85, z: 4.9 } },
    office: { in: { x: 10.65, z: 3.55 }, out: { x: 10.65, z: 4.9 } },
    yard: { in: { x: 3.4, z: 10.9 }, out: { x: 3.4, z: 9.2 } },
  };
  const WANDER = [[2.6, 5.3], [3.2, 8.9], [7.2, 5.6], [7.4, 8.8], [9.0, 6.0], [11.6, 6.4], [12.2, 9.1], [1.7, 6.5]];
  const roomOf = (x, z) => (z < 4.2 ? (x < 4.6 ? 'bed' : x < 9.2 ? 'kid' : 'office') : z > 10 ? 'yard' : 'main');
  function route(from, sp, loc) {
    if (loc !== 'home') return [sp];
    const ra = roomOf(from.x, from.z), rb = roomOf(sp.x, sp.z), p = [];
    if (ra !== rb) {
      if (ra !== 'main' && DOORS[ra]) p.push(DOORS[ra].in, DOORS[ra].out);
      if (rb !== 'main' && DOORS[rb]) p.push(DOORS[rb].out, DOORS[rb].in);
    }
    p.push(sp);
    return p;
  }

  function updNPC(P, st, dt, speed, snap, age, playerPos, playerYaw, loc) {
    const name = st.spot;
    if (name === 'gone') { P.root.visible = false; P.cur = 'gone'; return; }
    if (name === 'arms') {
      P.cur = 'arms'; P.root.visible = true; setPose(P, 'lie'); P.path.length = 0;
      const fx = -Math.sin(playerYaw), fz = -Math.cos(playerYaw);
      const rx = Math.cos(playerYaw), rz = -Math.sin(playerYaw);
      // Cradled gently down-left instead of floating in front of your face!
      P.root.position.set(playerPos.x + fx * 0.42 - rx * 0.16, 0.98 + Math.sin(tAnim * 2.5) * 0.02, playerPos.z + fz * 0.42 - rz * 0.16);
      P.root.rotation.y = playerYaw + PI / 2;
      return;
    }
    const sp = SPOTS[name];
    if (P.cur === 'gone' || !P.root.visible) {
      P.root.visible = true;
      if (sp) P.root.position.set(sp.x, sp.y || 0, sp.z);
      else P.root.position.set(SPOTS.door.x, 0, SPOTS.door.z);
    }
    if (name === 'wander') {
      if (P.cur !== 'wander') { P.cur = 'wander'; P.wt = 0; setPose(P, 'stand'); P.root.position.y = 0; }
      st.arrived = true;
      if (st.busy) P.path.length = 0;
      else if (!P.path.length) {
        P.wt -= dt;
        if (P.wt <= 0) {
          const w = WANDER[Math.floor(Math.random() * WANDER.length)];
          P.path = [{ x: w[0], z: w[1] }];
          P.wt = 1.6 + Math.random() * 3.8;
        }
      }
    } else if (P.cur !== name && sp) {
      P.cur = name;
      P.path = route(P.root.position, sp, loc);
      setPose(P, 'stand');
      P.root.position.y = 0;
      if (snap || loc !== 'home') { P.root.position.set(sp.x, 0, sp.z); P.path.length = 0; }
    }
    if (P.path.length) {
      const t = P.path[0], dx = t.x - P.root.position.x, dz = t.z - P.root.position.z;
      const d = Math.hypot(dx, dz), sl = Math.max(speed, 2.6) * dt;
      if (d <= sl) { P.root.position.x = t.x; P.root.position.z = t.z; P.path.shift(); }
      else {
        P.root.position.x += (dx / d) * sl;
        P.root.position.z += (dz / d) * sl;
        P.root.rotation.y = Math.atan2(dx, dz);
        P.phase += dt * 9;
        const sw = Math.sin(P.phase) * 0.55;
        P.legL.rotation.x = sw; P.legR.rotation.x = -sw;
        P.armL.rotation.x = -sw * 0.7; P.armR.rotation.x = sw * 0.7;
      }
      if (!P.path.length) P.legL.rotation.x = P.legR.rotation.x = P.armL.rotation.x = P.armR.rotation.x = 0;
    }
    if (!P.path.length && name !== 'wander' && sp) {
      st.arrived = true;
      let pose = sp.pose || 'stand';
      if (pose === 'floor') pose = age < 0.55 ? 'lie' : age < 1.3 ? 'sit' : 'stand';
      if (P.pose !== pose || P.root.position.y !== (sp.y || 0)) {
        setPose(P, pose);
        P.root.position.y = sp.y || 0;
        if (sp.face != null) P.root.rotation.y = sp.face;
      }
      // Subtle living breathing sway
      if (pose === 'stand') {
        P.armL.rotation.z = 0.04 + Math.sin(tAnim * 2.1) * 0.02;
        P.armR.rotation.z = -0.04 - Math.sin(tAnim * 2.1) * 0.02;
      }
    }
  }

  // ---------- Line-of-Sight Wall Occlusion Check (2D segment vs AABB) ----------
  function segIntersectsBox(x1, z1, x2, z2, b) {
    let t0 = 0, t1 = 1;
    const dx = x2 - x1, dz = z2 - z1;
    const clip = (p, q) => {
      if (Math.abs(p) < 1e-8) return q >= 0;
      const r = q / p;
      if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
      else { if (r < t0) return false; if (r < t1) t1 = r; }
      return true;
    };
    return clip(-dx, x1 - b.x0) && clip(dx, b.x1 - x1) && clip(-dz, z1 - b.z0) && clip(dz, b.z1 - z1);
  }
  function hasLOS(loc, x1, z1, x2, z2) {
    for (const w of loc.walls) {
      if (segIntersectsBox(x1, z1, x2, z2, w)) return false;
    }
    return true;
  }

  // ---------- Station Queries ----------
  function stActs(S, N, st) {
    const out = [], K = S.kid;
    for (const a of st.acts) {
      if (a === 'travel') {
        out.push({ id: 'travel', label: 'Drive somewhere… (Town Map)', block: '' });
        continue;
      }
      if (a === 'tv') {
        if (S.h / 24 < 0.3) continue;
        out.push({
          id: 'tv',
          label: S.tv ? 'Turn off the TV' : `Put on a solo show for ${N.k}`,
          block: S.tv ? '' : (K.away ? `${N.k} is not home` : K.asleep ? `${N.k} is asleep` : ''),
        });
        continue;
      }
      const l = offered(a);
      if (l) out.push({ id: a, label: l, block: actBlock(a) });
    }
    return out;
  }

  function urgent(S, id) {
    const K = S.kid, D = S.dad, home = !K.away && !K.asleep;
    switch (id) {
      case 'table': return home && K.food < 40;
      case 'change': return home && (diaper() ? K.clean < 40 : (S.h / 24 >= 6 && K.school < 40));
      case 'play': return home && K.fun < 35;
      case 'read': return home && K.love < 40;
      case 'crib': return K.crying || (K.sleepy && !K.asleep && S.h / 24 < 9);
      case 'bed': return D.energy < 25;
      case 'gym': return D.fitness < 34;
      case 'couch': return D.mind < 32 || (!S.divorced && S.marriage < 38);
      case 'desk': case 'work_main': return S.employed ? S.careerBar < 28 : true;
      case 'sink': return S.mess > 62;
      case 'bistro': return !S.divorced && S.marriage < 50;
      case 'pub': return D.social < 32;
      case 'market': return S.groceries === 0;
    }
    return false;
  }

  // ---------- Active Location Management ----------
  let activeLoc = 'home';
  function setLocation(id) {
    activeLoc = id;
    for (const k in LOCS) LOCS[k].group.visible = (k === id);
    mom.cur = '';
    kid.cur = '';
    return LOCS[id].spawn;
  }
  setLocation('home');

  function collide(pos) {
    const r = 0.28;
    const cols = LOCS[activeLoc].colliders;
    for (let it = 0; it < 2; it++) {
      for (const c of cols) {
        const cx = clamp(pos.x, c.x0, c.x1), cz = clamp(pos.z, c.z0, c.z1);
        const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (d2 > 1e-9) { const d = Math.sqrt(d2); pos.x = cx + (dx / d) * r; pos.z = cz + (dz / d) * r; }
          else {
            const l = pos.x - c.x0, rr = c.x1 - pos.x, t = pos.z - c.z0, b = c.z1 - pos.z;
            const m = Math.min(l, rr, t, b);
            if (m === l) pos.x = c.x0 - r;
            else if (m === rr) pos.x = c.x1 + r;
            else if (m === t) pos.z = c.z0 - r;
            else pos.z = c.z1 + r;
          }
        }
      }
    }
  }

  function findFocus(S, N, pos, yaw) {
    if (!S || S.act || S.event) return null;
    const loc = LOCS[activeLoc];
    let best = null, bs = 1e9;
    const fxx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const consider = (id, title, ax, az, mx, mz, acts) => {
      if (!acts.length) return;
      const dm = Math.hypot(mx - pos.x, mz - pos.z);
      const dd = Math.min(Math.hypot(ax - pos.x, az - pos.z), dm);
      if (dd > 2.65) return;
      // Wall occlusion check!
      if (!hasLOS(loc, pos.x, pos.z, ax, az) && !hasLOS(loc, pos.x, pos.z, mx, mz)) return;
      const dot = dm > 0.05 ? ((mx - pos.x) * fxx + (mz - pos.z) * fz) / dm : 1;
      if (dot < 0.42 && dd > 0.85) return;
      const sc = dd - dot * 1.4;
      if (sc < bs) { bs = sc; best = { id, title, acts }; }
    };
    for (const id in loc.stations) {
      const s = loc.stations[id];
      consider(id, s.title, s.x, s.z, s.mx, s.mz, stActs(S, N, s));
    }
    const K = S.kid;
    if (kid.root.visible && kid.cur !== 'arms' && !K.asleep && !K.crying) {
      const p = kid.root.position;
      const l = offered('hangout');
      consider('kid', N.k, p.x, p.z, p.x, p.z, [{ id: 'hangout', label: l, block: actBlock('hangout') }]);
    }
    if (mom.root.visible && !S.mom.asleep && activeLoc === 'home') {
      const p = mom.root.position;
      const l = offered('couple');
      if (l) consider('mom', N.w, p.x, p.z, p.x, p.z, [{ id: 'couple', label: l, block: actBlock('couple') }]);
    }
    return best;
  }

  // ---------- Per-frame Lighting, Animation & World Updates ----------
  const HT = [[0, 0.5], [1, 0.76], [2, 0.88], [4, 1.03], [6, 1.16], [8, 1.28], [10, 1.39], [12, 1.5], [14, 1.63], [16, 1.71], [18, 1.75]];
  function kidHeight(S, a) {
    for (let i = 1; i < HT.length; i++) {
      if (a <= HT[i][0]) {
        const [a0, h0] = HT[i - 1], [a1, h1] = HT[i];
        const h = lerp(h0, h1, (a - a0) / (a1 - a0));
        return S.sex === 'girl' && a > 12 ? lerp(h, 1.63, sat((a - 12) / 3)) : h;
      }
    }
    return 1.75;
  }
  const SHIRTS = [[0, 0xf2f0ea], [1, 0xf0b84a], [3, 0x4f9d69], [6, 0xc8443a], [9, 0x3d6fb0], [13, 0x2b2d33], [16, 0x7b8d99]];
  const sunDir = new THREE.Vector3(), cWarm = new THREE.Color(0xffa45b), cNoon = new THREE.Color(0xfff4e4), cMoon = new THREE.Color(0x8ea8ff);
  let lampK = 0, tAnim = 0;

  function drawTV(t) {
    const x = tvCtx;
    x.fillStyle = '#182438'; x.fillRect(0, 0, 256, 144);
    for (let i = 0; i < 6; i++) {
      const cx = (Math.sin(t * (0.9 + i * 0.25) + i * 2) * 0.4 + 0.5) * 256;
      const cyy = (Math.cos(t * (0.7 + i * 0.2) + i) * 0.35 + 0.5) * 144;
      x.fillStyle = ['#f2c14e', '#63b7af', '#ef6e4e', '#7aa7d4', '#b8d86b', '#d98be0'][i];
      x.beginPath(); x.arc(cx, cyy, 18 + Math.sin(t * 2 + i) * 6, 0, PI * 2); x.fill();
    }
    tvTex.needsUpdate = true;
  }

  function updateLight(S, dt) {
    const dayH = S ? S.h % 24 : 4.2;
    const clock = (dayH + 6) % 24;
    const a = ((clock - 6) / 12) * PI;
    const el = Math.sin(a);
    sunDir.set(Math.cos(a) * 0.85, el * 0.9, 0.5).normalize();
    SU.sunDir.value.copy(sunDir);

    const d = sat(el * 4 + 0.12);
    const k = sat(1 - Math.abs(el) * 4.5) * 0.85;
    SU.top.value.copy(SKY.nightT).lerp(SKY.dayT, d).lerp(SKY.duskT, k * 0.6);
    SU.bot.value.copy(SKY.nightB).lerp(SKY.dayB, d).lerp(SKY.duskB, k);
    SU.sunCol.value.copy(cWarm).lerp(cNoon, sat(el * 2)).multiplyScalar(sat(el * 6 + 0.3));
    SU.nightK.value = sat(1 - d * 2.2);
    scene.fog.color.copy(SU.bot.value);

    const day = sat(el * 5 + 0.16);
    if (el > 0.01) {
      sun.position.copy(sunDir).multiplyScalar(48).add(sun.target.position);
      sun.intensity = 4.1 * sat(el * 3.5);
      sun.color.copy(cWarm).lerp(cNoon, sat(el * 1.7));
    } else {
      sun.position.set(-14, 34, 16).add(sun.target.position);
      sun.intensity = 0.25;
      sun.color.copy(cMoon);
    }
    hemi.intensity = lerp(0.10, 0.66, day);
    scene.environmentIntensity = lerp(0.10, 0.45, day);

    const indoorWork = activeLoc === 'work';
    const want = indoorWork ? 0.95 : ((clock >= 17.0 || clock < 7.2) ? ((S && S.act && S.act.id === 'sleep') ? 0.05 : 1) : 0);
    lampK += (want - lampK) * Math.min(1, dt * 3);
    for (const l of LOCS[activeLoc].lamps) l.intensity = l.userData.p * lampK;
    MAT.shade.emissiveIntensity = lampK * 2.4;
  }

  function updateWorld(S, N, dt, pos, yaw, playing) {
    tAnim += dt;
    updateLight(S, dt);

    // Ambient NPC gentle idle
    for (let i = 0; i < ambientNPCs.length; i++) {
      const p = ambientNPCs[i];
      p.head.rotation.y = Math.sin(tAnim * 0.8 + i * 2.1) * 0.22;
    }
    if (W.ducks) W.ducks.rotation.y = tAnim * 0.18;

    // Seasonal foliage & particles
    const sea = seasonOf(S ? S.h : 0);
    MAT.leaf.color.lerp(new THREE.Color(sea.leaf), Math.min(1, dt * 2));
    MAT.grass.color.lerp(new THREE.Color(sea.grass), Math.min(1, dt * 2));
    particles.visible = activeLoc !== 'work';
    if (particles.visible) {
      pMat.color.setHex(sea.id === 'winter' ? 0xffffff : sea.id === 'fall' ? 0xe58a38 : 0xfff4c2);
      const arr = pGeo.attributes.position.array;
      const fallSpd = sea.id === 'winter' ? 1.2 : sea.id === 'fall' ? 0.9 : 0.22;
      for (let i = 0; i < pCount; i++) {
        arr[i * 3 + 1] -= fallSpd * dt;
        arr[i * 3] += Math.sin(tAnim + i) * 0.2 * dt;
        if (arr[i * 3 + 1] < 0.2) arr[i * 3 + 1] = 11;
      }
      pGeo.attributes.position.needsUpdate = true;
    }

    if (!S) return;
    const age = S.h / 24, K = S.kid, M = S.mom;

    // Home dynamic props, upgrades & clutter!
    W.crib.visible = age < 2.5;
    W.kbed.visible = !W.crib.visible;
    W.changeT.visible = diaper();
    W.kdesk.visible = age >= 5;
    W.teenDecor.visible = age >= 12;
    W.hchair.visible = age >= 0.4 && age < 3.6;
    W.toys.visible = age < 9;
    W.mat.visible = age < 6;
    W.groceriesMesh.visible = S.groceries > 0;
    drawFamilyPhoto(age, S.sex === 'girl');

    // Career-specific home office & workplace theme
    W.office.visible = W.chair.visible = S.career !== 'blue';
    W.bench.visible = S.career === 'blue';
    W.workBlue.visible = S.career === 'blue';
    W.workWhite.visible = S.career === 'white';
    W.workTech.visible = S.career === 'tech';

    // Purchased Upgrades visually appear!
    for (const id in W.upgrades) W.upgrades[id].visible = !!S.upgrades[id];
    if (S.upgrades.robovac && activeLoc === 'home') {
      W.upgrades.robovac.position.x = 3.2 + Math.sin(tAnim * 0.45) * 2.2;
      W.upgrades.robovac.position.z = 8.7 + Math.cos(tAnim * 0.62) * 0.7;
    }

    // Dynamic physical mess clutter!
    const messCount = Math.floor(sat((S.mess - 20) / 72) * W.mess.length);
    for (let i = 0; i < W.mess.length; i++) W.mess[i].visible = i < messCount;

    // Animated TV screen
    const tvOn = S.tv || (S.act && S.act.id === 'movie');
    MAT.screen.emissiveIntensity = tvOn ? 1.45 : 0;
    W.tvLight.intensity = tvOn ? 2.1 + Math.sin(tAnim * 6) * 0.5 : 0;
    if (tvOn) drawTV(tAnim);

    // Kid physical growth & appearance
    const h = kidHeight(S, age);
    kid.root.scale.setScalar(h / 1.7);
    { const k = lerp(1.42, 1, sat(age / 7)); kid.root.scale.x *= k; kid.root.scale.z *= k; }
    kid.head.scale.setScalar(lerp(1.72, 1, Math.pow(sat(age / 12), 0.7)));
    kid.long.visible = S.sex === 'girl' && age > 2;
    kid.shoes[0].visible = kid.shoes[1].visible = age > 1.2;
    let sc = SHIRTS[0][1];
    for (const s of SHIRTS) if (age >= s[0]) sc = s[1];
    kid.shirt.color.setHex(sc);
    kid.pants.color.setHex(age < 1 ? sc : age < 13 ? 0x44546b : 0x2d3340);

    updNPC(kid, K, dt, age < 1.25 ? 0 : age < 4 ? 2.5 : 3.4, age < 1.25, age, pos, yaw, activeLoc);
    updNPC(mom, M, dt, 3.2, false, 30, pos, yaw, activeLoc);

    if (K.busy === 'dad' && kid.pose === 'stand' && !kid.path.length && kid.cur !== 'arms') {
      kid.root.rotation.y = Math.atan2(pos.x - kid.root.position.x, pos.z - kid.root.position.z);
    }
    if (S.act && (S.act.id === 'couple' || S.act.id === 'town_date') && !mom.path.length && mom.pose === 'stand') {
      mom.root.rotation.y = Math.atan2(pos.x - mom.root.position.x, pos.z - mom.root.position.z);
    }

    const up = K.upset;
    bubble(
      kid,
      kid.cur === 'arms' ? '' : K.asleep ? '💤' : up === 'cry' ? '😭' : up === 'food' ? (age < 1 ? '🍼' : '🍽️') : up === 'clean' ? '💩' : up === 'fun' ? '😫' : up === 'love' ? '💔' : up === 'rest' ? '🥱' : K.screen ? (age < 10 ? '📺' : '📱') : K.sleepy ? '🥱' : '',
      kid.pose === 'lie' ? 0.36 : kid.pose === 'sit' ? h * 0.62 + 0.32 : h + 0.28
    );
    bubble(
      mom,
      M.asleep ? '💤' : M.load > 70 ? '😮‍💨' : (M.task && M.task.type === 'talk' && M.arrived) || (S.act && S.act.id === 'town_date') ? '❤️' : '',
      mom.pose === 'lie' ? 0.5 : mom.pose === 'sit' ? 1.25 : 1.98
    );

    // Floating station sprites (hidden behind walls, gently bobbing, urgent pulse!)
    const loc = LOCS[activeLoc];
    for (const id in loc.stations) {
      const st = loc.stations[id];
      const acts = stActs(S, N, st);
      const d = Math.hypot(st.mx - pos.x, st.mz - pos.z);
      const vis = acts.length > 0 && d < 13 && playing && !S.act && hasLOS(loc, pos.x, pos.z, st.mx, st.mz);
      st.sp.visible = vis;
      if (vis) {
        const u = urgent(S, id);
        const baseY = st.my || 1.58;
        st.sp.position.y = baseY + Math.sin(tAnim * (u ? 5 : 2.2) + st.mx) * (u ? 0.06 : 0.03);
        st.sp.scale.setScalar(u ? 0.35 + Math.sin(tAnim * 6) * 0.045 : 0.25);
        st.sp.material.opacity = u ? 1 : 0.68;
      }
    }
  }

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  resize();

  function surfaceAt(pos) {
    if (activeLoc === 'home') return (pos.z > 10 || pos.x > 14) ? (pos.x > 14 && pos.z > 4.5 && pos.z < 10.2 ? 'stepStone' : 'stepGrass') : 'stepWood';
    if (activeLoc === 'park') return 'stepGrass';
    return 'stepStone';
  }

  return {
    renderer, scene, camera, LOCS,
    setLocation, collide, findFocus, updateWorld, resize, surfaceAt,
    setCareerIcon(careerIcon) {
      LOCS.home.stations.desk.sp.material.map = emojiTex(careerIcon);
      LOCS.work.stations.work_main.sp.material.map = emojiTex(careerIcon);
    },
  };
}
