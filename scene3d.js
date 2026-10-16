/* =========================================================================
   RESET — Sitio final · objetos 3D
   Motor 3D mínimo y propio, sobre <canvas>, sin librerías externas: caras
   planas con luz, borde de neón, orden por profundidad y perspectiva.
   Escenas (se piden con data-scene en el HTML):
     joystick  → portada. Se inclina hacia el puntero y se arrastra para girarlo
     controller → encuesta. Gira con el scroll; sus LEDs muestran la batería
     hourglass → problemática. El reloj de arena se vacía, se da vuelta (clic para darlo vuelta ya)
     console   → llamado final. Consola retro con un cartucho flotando
   El CSS le pasa a cada objeto --rot (giro) y --shift (desplazamiento) con el
   scroll, igual que en el wireframe.
   ========================================================================= */
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TAU = Math.PI * 2;

  /* ------------------------- matemática básica ------------------------- */
  function rgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function norm(a) { var l = Math.sqrt(dot(a, a)) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }

  // Rotación Rz·Rx·Ry aplicada a un punto: primero Y, después X, después Z.
  function rot(p, rx, ry, rz) {
    var x = p[0], y = p[1], z = p[2], c, s, t;
    if (ry) { c = Math.cos(ry); s = Math.sin(ry); t = x * c + z * s; z = -x * s + z * c; x = t; }
    if (rx) { c = Math.cos(rx); s = Math.sin(rx); t = y * c - z * s; z = y * s + z * c; y = t; }
    if (rz) { c = Math.cos(rz); s = Math.sin(rz); t = x * c - y * s; y = x * s + y * c; x = t; }
    return [x, y, z];
  }

  /* ------------------------------ geometría ----------------------------- */
  // Una cara: { v: [[x,y,z]…], col: [r,g,b], emit, alpha, edge }
  function face(v, col, o) {
    var f = { v: v, col: col, emit: false, alpha: 1, edge: null, two: false };
    if (o) for (var k in o) f[k] = o[k];
    return f;
  }
  function box(w, h, d, col, o) {
    var x = w / 2, y = h / 2, z = d / 2;
    var P = [[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z], [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]];
    var I = [[4, 5, 6, 7], [1, 0, 3, 2], [5, 1, 2, 6], [0, 4, 7, 3], [3, 7, 6, 2], [0, 1, 5, 4]];
    return I.map(function (q, i) {
      var oo = {}; if (o) for (var k in o) oo[k] = o[k];
      if (o && o.topEmit !== undefined) { oo.emit = i === 4 ? o.topEmit : false; }
      return face(q.map(function (j) { return P[j]; }), col, oo);
    });
  }
  // Revolución de un perfil [[radio, y], …] alrededor del eje Y.
  function lathe(profile, n, col, o, capTop, capBottom) {
    var out = [], i, j;
    function ring(r, y, k) { var a = TAU * k / n; return [r * Math.cos(a), y, r * Math.sin(a)]; }
    for (i = 0; i < profile.length - 1; i++) {
      for (j = 0; j < n; j++) {
        out.push(face([ring(profile[i][0], profile[i][1], j), ring(profile[i][0], profile[i][1], j + 1),
          ring(profile[i + 1][0], profile[i + 1][1], j + 1), ring(profile[i + 1][0], profile[i + 1][1], j)], col, o));
      }
    }
    function cap(r, y) {
      var p = []; for (j = 0; j < n; j++) p.push(ring(r, y, j));
      return face(p, col, o);
    }
    if (capTop) out.push(cap(profile[profile.length - 1][0], profile[profile.length - 1][1]));
    if (capBottom) out.push(cap(profile[0][0], profile[0][1]));
    return out;
  }
  // Prisma o tronco de cono, centrado en el origen: radio inferior r0, superior r1.
  function prism(n, r0, r1, h, col, o) {
    var f = lathe([[r0, -h / 2], [r1, h / 2]], n, col, o, true, true);
    if (o && o.topEmit) f[f.length - 2].emit = true;
    return f;
  }
  function sphere(r, lat, lon, col, o) {
    var prof = [], i;
    for (i = 0; i <= lat; i++) { var a = -Math.PI / 2 + Math.PI * i / lat; prof.push([Math.max(0.001, r * Math.cos(a)), r * Math.sin(a)]); }
    return lathe(prof, lon, col, o, false, false);
  }

  // Una pieza: caras + posición + giro + (opcional) inclinación sobre un pivote.
  function part(faces, pos, o) {
    var p = { faces: faces, pos: pos || [0, 0, 0], rot: [0, 0, 0], pivot: null, tilt: null, update: null };
    if (o) for (var k in o) p[k] = o[k];
    return p;
  }

  /* -------------------------------- paleta ------------------------------- */
  var C = {
    violet: rgb('#8B30FF'), cyan: rgb('#00CFFF'), green: rgb('#39FF14'), fg: rgb('#EEEEF8'),
    danger: rgb('#FF3B5C'), body: rgb('#1a1a36'), body2: rgb('#252552'), dark: rgb('#0e0e1e'), mid: rgb('#2c2c5a')
  };
  var EDGE = 'rgba(0,207,255,0.34)';

  /* -------------------------------- escenas ------------------------------ */
  var SCENES = {};

  // Joystick de arcade
  SCENES.joystick = function () {
    var S = { bounds: [2.35, 2.05], pitch: 0.46, yaw: -0.5, ground: -0.9, interactive: true, parts: [], tilt: [0, 0] };
    S.parts.push(part(box(3.5, 0.78, 2.7, C.body, { edge: 'rgba(139,48,255,0.7)' }), [0, -0.55, 0]));
    S.parts.push(part(box(3.3, 0.1, 2.5, C.body2, { edge: EDGE }), [0, -0.11, 0]));
    S.parts.push(part(box(3.5, 0.06, 0.06, C.violet, { emit: true }), [0, -0.3, 1.36]));
    S.parts.push(part(box(0.06, 0.06, 2.7, C.cyan, { emit: true }), [1.76, -0.3, 0]));
    S.parts.push(part(prism(22, 0.66, 0.54, 0.12, C.mid, { edge: EDGE }), [-0.55, 0.0, 0]));
    S.parts.push(part(prism(22, 0.5, 0.5, 0.05, C.cyan, { emit: true }), [-0.55, 0.06, 0]));
    var pivot = [-0.55, 0.05, 0];
    var stick = part(prism(12, 0.1, 0.1, 1.5, C.fg, { edge: 'rgba(238,238,248,0.35)' }), [-0.55, 0.8, 0], { pivot: pivot });
    var ball = part(sphere(0.56, 9, 16, C.violet, { edge: 'rgba(238,238,248,0.22)' }), [-0.55, 1.78, 0], { pivot: pivot });
    S.parts.push(stick, ball);
    S.tiltParts = [stick, ball];
    [[0.85, 0.05, 0.6, C.cyan], [0.85, 0.05, -0.2, C.violet], [1.4, 0.05, 0.35, C.green], [1.4, 0.05, -0.45, C.fg]].forEach(function (b) {
      S.parts.push(part(prism(18, 0.3, 0.27, 0.14, b[3], { edge: 'rgba(5,5,8,0.5)', topEmit: true }), [b[0], b[1], b[2]]));
    });
    S.update = function (t, st) {
      var wob = reduce ? 0 : 0.1 * Math.sin(t * 0.9);
      var tx = st.pointer ? st.pointer[1] * 0.42 : wob;
      var tz = st.pointer ? -st.pointer[0] * 0.42 : wob * 0.8;
      st.tilt[0] += (tx - st.tilt[0]) * 0.18;
      st.tilt[1] += (tz - st.tilt[1]) * 0.18;
      S.tiltParts.forEach(function (p) { p.tilt = [st.tilt[0], st.tilt[1]]; });
    };
    return S;
  };

  // Control (gamepad): los LEDs de enfrente son la batería
  SCENES.controller = function () {
    var S = { bounds: [3.0, 1.75], pitch: 0.78, yaw: 0, ground: -1.3, parts: [], level: 1 };
    S.parts.push(part(box(3.1, 0.56, 1.6, C.body, { edge: 'rgba(139,48,255,0.7)' }), [0, 0, 0]));
    S.parts.push(part(box(2.8, 0.12, 1.36, C.body2, { edge: EDGE }), [0, 0.3, 0]));
    [-1, 1].forEach(function (s) {
      S.parts.push(part(prism(6, 0.5, 0.66, 1.25, C.body, { edge: 'rgba(139,48,255,0.55)' }), [s * 1.38, -0.5, 0.12], { rot: [0.12, 0, -s * 0.22], zb: -1.6 }));
    });
    // Palanca izquierda y derecha
    [[-0.98, -0.28], [0.52, 0.42]].forEach(function (p) {
      S.parts.push(part(prism(14, 0.3, 0.3, 0.1, C.dark, { edge: EDGE }), [p[0], 0.4, p[1]]));
      S.parts.push(part(prism(14, 0.22, 0.2, 0.16, C.mid, { edge: 'rgba(238,238,248,0.25)' }), [p[0], 0.5, p[1]]));
    });
    // Cruceta
    var dc = [0, 160, 215];
    S.parts.push(part(box(0.76, 0.1, 0.24, dc, { emit: true, edge: 'rgba(5,5,8,0.5)' }), [-0.5, 0.42, 0.42]));
    S.parts.push(part(box(0.24, 0.1, 0.76, dc, { emit: true, edge: 'rgba(5,5,8,0.5)' }), [-0.5, 0.42, 0.42]));
    // Botones
    [[0.98, -0.5, C.green], [1.26, -0.22, C.cyan], [0.7, -0.22, C.violet], [0.98, 0.06, C.fg]].forEach(function (b) {
      S.parts.push(part(prism(16, 0.19, 0.17, 0.11, b[2], { edge: 'rgba(5,5,8,0.5)', topEmit: true }), [b[0], 0.41, b[1]]));
    });
    // Logo (triángulo de la marca)
    S.parts.push(part(prism(3, 0.17, 0.17, 0.05, C.green, { emit: true }), [0, 0.38, -0.3]));
    // LEDs de batería (frente del control)
    S.leds = [];
    [-0.42, -0.14, 0.14, 0.42].forEach(function (x) {
      var led = part(box(0.22, 0.1, 0.1, C.dark, { edge: 'rgba(0,207,255,0.35)' }), [x, 0.1, 0.82]);
      S.leds.push(led); S.parts.push(led);
    });
    S.update = function (t) {
      var l = S.level, lit = l <= 0.001 ? 0 : Math.max(1, Math.ceil(l * 4 - 0.001));
      var col = l > 0.6 ? C.green : l > 0.3 ? C.cyan : C.danger;
      var blink = l <= 0.1 && !reduce && Math.floor(t * 2.5) % 2 === 0;
      S.leds.forEach(function (led, i) {
        var on = i < lit && !(blink);
        led.faces.forEach(function (f) { f.col = on ? col : C.dark; f.emit = on; });
      });
    };
    return S;
  };

  // Reloj de arena
  SCENES.hourglass = function () {
    var S = { bounds: [1.45, 2.4], pitch: 0.2, yaw: 0, ground: -2.25, parts: [], cycle: 7, t0: 0 };
    var glassTop = [[0.08, 0], [0.34, 0.3], [0.7, 0.75], [0.92, 1.25], [0.9, 1.65], [0.62, 1.88]];
    var glassBot = glassTop.map(function (p) { return [p[0], -p[1]]; }).reverse();
    var G = { edge: 'rgba(0,207,255,0.5)', alpha: 0.16, two: true };
    var cap = function (y) {
      S.parts.push(part(prism(8, 1.22, 1.22, 0.22, C.body2, { edge: 'rgba(139,48,255,0.8)' }), [0, y, 0]));
      S.parts.push(part(prism(8, 1.0, 1.0, 0.05, C.violet, { emit: true }), [0, y > 0 ? y - 0.12 : y + 0.12, 0]));
    };
    cap(2.0); cap(-2.0);
    for (var k = 0; k < 3; k++) {
      var a = TAU * k / 3 + 0.5;
      S.parts.push(part(prism(6, 0.05, 0.05, 3.9, C.cyan, { emit: true }), [1.12 * Math.cos(a), 0, 1.12 * Math.sin(a)]));
    }
    S.parts.push(part(lathe(glassTop, 14, C.cyan, G, false, false), [0, 0, 0]));
    S.parts.push(part(lathe(glassBot, 14, C.cyan, G, false, false), [0, 0, 0]));
    var sandTop = part([], [0, 0, 0]), sandBot = part([], [0, 0, 0]), stream = part([], [0, 0, 0]);
    S.parts.push(sandBot, sandTop, stream);
    var SAND = { emit: true, alpha: 0.92 };
    S.update = function (t, st) {
      var tt = t - S.t0, ph = (tt % S.cycle) / S.cycle;
      var drain = reduce ? 0.45 : ease(ph / 0.84);
      var flip = reduce ? 0 : ease((ph - 0.86) / 0.14);
      st.modelRot = [0, 0, Math.PI * flip];
      // Arena arriba: sube un nivel que baja
      var top = 1 - drain, bot = drain;
      var h = 1.78 * top;
      var prof = [[0.02, 0]];
      glassTop.forEach(function (p) { if (p[1] < h) prof.push([p[0] * 0.9, p[1]]); });
      if (h > 0.05) prof.push([0.9 * (h < 1.2 ? interp(glassTop, h) : 0.88), h]);
      sandTop.faces = h > 0.05 ? lathe(prof, 14, C.green, SAND, true, false) : [];
      // Montículo abajo
      var mh = 1.55 * bot;
      var mp = [[0.0, -1.85], [0.78 * Math.min(1, 0.35 + bot), -1.85]];
      if (mh > 0.03) { mp = [[0.78 * Math.min(1, 0.35 + bot), -1.85], [0.55 * Math.min(1, 0.4 + bot * 0.6), -1.85 + mh * 0.55], [0.02, -1.85 + mh]]; }
      sandBot.faces = mh > 0.03 ? lathe(mp, 14, C.green, SAND, false, true) : [];
      // Hilo de arena
      var on = drain > 0.01 && drain < 0.985 && flip === 0;
      var top2 = -1.85 + mh;
      stream.faces = on ? prism(6, 0.035, 0.035, 0 - top2 + 0.1, C.green, { emit: true }) : [];
      stream.pos = [0, (top2 - 0.1) / 2 + 0.05, 0];
    };
    function interp(poly, y) {
      for (var i = 0; i < poly.length - 1; i++) if (y >= poly[i][1] && y <= poly[i + 1][1]) {
        var u = (y - poly[i][1]) / (poly[i + 1][1] - poly[i][1]); return poly[i][0] + u * (poly[i + 1][0] - poly[i][0]);
      }
      return 0.5;
    }
    S.click = function (t) {
      var tt = t - S.t0, ph = (tt % S.cycle) / S.cycle;
      if (ph < 0.84) S.t0 = t - S.cycle * 0.84;
    };
    return S;
  };

  // Consola retro con cartucho
  SCENES.console = function () {
    var S = { bounds: [2.05, 1.75], pitch: 0.52, yaw: -0.5, ground: -0.5, parts: [] };
    S.parts.push(part(box(3.6, 0.72, 2.3, C.body, { edge: 'rgba(139,48,255,0.7)' }), [0, 0, 0]));
    S.parts.push(part(box(3.2, 0.08, 1.9, C.body2, { edge: EDGE }), [0, 0.4, 0]));
    S.parts.push(part(box(1.5, 0.1, 0.5, C.dark, { edge: 'rgba(0,207,255,0.5)' }), [0, 0.46, -0.3]));
    [[-1.0, C.violet], [0, C.cyan], [1.0, C.green]].forEach(function (s) {
      S.parts.push(part(box(0.95, 0.07, 0.06, s[1], { emit: true }), [s[0], 0.0, 1.17]));
    });
    S.parts.push(part(box(0.14, 0.07, 0.14, C.cyan, { emit: true }), [1.4, 0.46, 0.7]));
    S.parts.push(part(prism(3, 0.28, 0.28, 0.05, C.green, { emit: true }), [-1.2, 0.46, 0.65], { rot: [0, 0.5, 0] }));
    var cart = part(box(1.15, 0.75, 0.16, C.body2, { edge: 'rgba(139,48,255,0.9)' }), [0, 1.3, -0.3]);
    var label = part(box(0.9, 0.3, 0.02, C.violet, { emit: true }), [0, 1.35, -0.2]);
    S.parts.push(cart, label);
    S.update = function (t) {
      var y = reduce ? 1.3 : 1.3 + Math.sin(t * 1.7) * 0.12;
      var r = reduce ? 0 : Math.sin(t * 0.8) * 0.35;
      cart.pos = [0, y, -0.3]; cart.rot = [0, r, 0];
      label.pos = [0.0 + Math.sin(r) * 0.1, y + 0.05, -0.3 + Math.cos(r) * 0.1]; label.rot = [0, r, 0];
    };
    return S;
  };

  /* ------------------------------ renderizado ---------------------------- */
  var L1 = norm([-0.5, 0.85, 0.6]), L2 = norm([0.9, 0.15, 0.4]);
  var D = 9;

  function Scene(el, name) {
    this.el = el; this.name = name;
    this.def = SCENES[name]();
    this.st = { pointer: null, tilt: [0, 0], modelRot: [0, 0, 0], yaw: this.def.yaw, pitch: this.def.pitch, drag: 0 };
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    el.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.visible = false;
    this.w = 0; this.h = 0; this.dpr = 1;
    this.bind();
  }
  Scene.prototype.bind = function () {
    var self = this, el = this.el, st = this.st, def = this.def;
    if (def.interactive) {
      el.style.touchAction = 'pan-y';
      el.style.cursor = 'grab';
      var last = null;
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        st.pointer = [clamp((e.clientX - r.left) / r.width * 2 - 1, -1.4, 1.4), clamp((e.clientY - r.top) / r.height * 2 - 1, -1.4, 1.4)];
        if (last !== null && e.buttons) {
          st.drag += (e.clientX - last) * 0.012; st.dragging = true;
        }
        last = e.clientX;
      });
      el.addEventListener('pointerdown', function (e) { last = e.clientX; el.style.cursor = 'grabbing'; try { el.setPointerCapture(e.pointerId); } catch (x) { /* ok */ } });
      el.addEventListener('pointerup', function () { last = null; el.style.cursor = 'grab'; });
      el.addEventListener('pointerleave', function () { st.pointer = null; last = null; });
    }
    if (def.click) el.addEventListener('click', function () { def.click(self.time); });
  };
  Scene.prototype.resize = function () {
    var w = this.el.clientWidth, h = this.el.clientHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!w || !h) return false;
    if (w !== this.w || h !== this.h || dpr !== this.dpr) {
      this.w = w; this.h = h; this.dpr = dpr;
      this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    }
    return true;
  };
  Scene.prototype.draw = function (t) {
    if (!this.resize()) return;
    this.time = t;
    var def = this.def, st = this.st, ctx = this.ctx, dpr = this.dpr, w = this.w, h = this.h;

    // Giro: automático + scroll (--rot) + arrastre
    var cssRot = parseFloat(this.el.style.getPropertyValue('--rot')) || 0;
    var targetYaw = def.yaw + cssRot * Math.PI / 180 + st.drag + (reduce ? 0 : Math.sin(t * 0.45) * 0.28);
    st.yaw += (targetYaw - st.yaw) * (reduce ? 1 : 0.12);
    var pitch = def.pitch + (reduce || !def.interactive ? 0 : Math.sin(t * 0.7) * 0.03);
    st.drag *= 0.995;
    if (def.update) def.update(t, st);

    var S = Math.min(w / (2 * def.bounds[0]), h / (2 * def.bounds[1])) * 0.94;
    var cx = w / 2, cy = h / 2;
    var faces = [];
    var mr = st.modelRot;

    def.parts.forEach(function (p) {
      if (!p.faces.length) return;
      var pr = p.rot;
      var cen = [0, 0, 0], cnt = 0;
      var tv = function (v) {
        var q = rot(v, pr[0], pr[1], pr[2]);
        q = [q[0] + p.pos[0], q[1] + p.pos[1], q[2] + p.pos[2]];
        if (p.tilt) {
          var d = sub(q, p.pivot);
          d = rot(d, p.tilt[0], 0, p.tilt[1]);
          q = [d[0] + p.pivot[0], d[1] + p.pivot[1], d[2] + p.pivot[2]];
        }
        q = rot(q, mr[0], mr[1], mr[2]);
        q = rot(q, pitch, st.yaw, 0);                  // cámara: gira (Y) y se inclina (X)
        return q;
      };
      var world = p.faces.map(function (f) { return f.v.map(tv); });
      world.forEach(function (vs) { vs.forEach(function (v) { cen[0] += v[0]; cen[1] += v[1]; cen[2] += v[2]; cnt++; }); });
      cen = [cen[0] / cnt, cen[1] / cnt, cen[2] / cnt];
      p.faces.forEach(function (f, i) {
        var vs = world[i];
        var n = norm(cross(sub(vs[1], vs[0]), sub(vs[2], vs[1])));
        var fc = [0, 0, 0];
        vs.forEach(function (v) { fc[0] += v[0]; fc[1] += v[1]; fc[2] += v[2]; });
        fc = [fc[0] / vs.length, fc[1] / vs.length, fc[2] / vs.length];
        if (dot(n, sub(fc, cen)) < 0) n = [-n[0], -n[1], -n[2]];   // normal siempre hacia afuera
        var toCam = norm([-fc[0], -fc[1], D - fc[2]]);
        var facing = dot(n, toCam);
        if (facing <= 0 && !f.two) return;
        faces.push({ f: f, vs: vs, n: n, z: fc[2] + (p.zb || 0), facing: facing });
      });
    });

    faces.sort(function (a, b) { return a.z - b.z; });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Piso con brillo violeta
    var gp = proj([0, def.ground, 0]);
    var gr = def.bounds[0] * S * 0.95;
    ctx.save();
    ctx.translate(gp[0], gp[1] + 4);
    ctx.scale(1, 0.22);
    var gg = ctx.createRadialGradient(0, 0, 0, 0, 0, gr);
    gg.addColorStop(0, 'rgba(139,48,255,0.55)'); gg.addColorStop(0.6, 'rgba(139,48,255,0.16)'); gg.addColorStop(1, 'rgba(139,48,255,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, 0, gr, 0, TAU); ctx.fill();
    ctx.restore();

    function proj(v) {
      var k = D / (D - v[2]);
      return [cx + v[0] * S * k, cy - v[1] * S * k];
    }

    faces.forEach(function (it) {
      var f = it.f, pts = it.vs.map(proj), c = f.col, r, g, b;
      if (f.emit) { r = c[0]; g = c[1]; b = c[2]; }
      else {
        var d1 = Math.max(0, dot(it.n, L1)), d2 = Math.max(0, dot(it.n, L2));
        var k = 0.3 + 0.7 * d1;
        r = c[0] * k + 26 * (1 - d1) + 6 * d2; g = c[1] * k + 6 * (1 - d1) + 70 * d2; b = c[2] * k + 44 * (1 - d1) + 110 * d2;
        var sp = Math.pow(d1, 10) * 70; r += sp; g += sp; b += sp;
      }
      r = clamp(r, 0, 255) | 0; g = clamp(g, 0, 255) | 0; b = clamp(b, 0, 255) | 0;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.globalAlpha = f.alpha;
      if (f.emit) { ctx.shadowColor = 'rgb(' + r + ',' + g + ',' + b + ')'; ctx.shadowBlur = 14; }
      ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
      ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
      if (f.edge) { ctx.strokeStyle = f.edge; ctx.lineWidth = 1; ctx.stroke(); }
      ctx.globalAlpha = 1;
    });
  };

  /* ------------------------------ arranque ------------------------------- */
  var scenes = [];
  var els = Array.prototype.slice.call(document.querySelectorAll('[data-scene]'));
  var canvasOk = !!document.createElement('canvas').getContext;

  if (canvasOk) {
    els.forEach(function (el) {
      var name = el.getAttribute('data-scene');
      if (!SCENES[name]) return;
      var sc = new Scene(el, name);
      el._scene = sc;
      scenes.push(sc);
    });

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { en.target._scene.visible = en.isIntersecting; if (en.isIntersecting) en.target._scene.dirty = true; });
      }, { rootMargin: '120px' });
      scenes.forEach(function (s) { io.observe(s.el); });
    } else {
      scenes.forEach(function (s) { s.visible = true; });
    }

    var start = performance.now();
    var frame = function (now) {
      var t = (now - start) / 1000;
      scenes.forEach(function (s) {
        if (!s.visible) return;
        if (reduce && !s.dirty && s.w) return;      // movimiento reducido: una sola pose, se redibuja si cambia algo
        s.draw(t); s.dirty = false;
      });
      window.requestAnimationFrame(frame);
    };
    window.requestAnimationFrame(frame);
    window.addEventListener('resize', function () { scenes.forEach(function (s) { s.dirty = true; }); });
  }

  // Lo que necesita app.js: la batería del control y un redibujo puntual.
  window.RESET3D = {
    level: function (el, v) {
      if (el && el._scene && el._scene.def.level !== undefined) { el._scene.def.level = clamp(v, 0, 1); el._scene.dirty = true; }
    },
    refresh: function () { scenes.forEach(function (s) { s.dirty = true; }); }
  };
})();
