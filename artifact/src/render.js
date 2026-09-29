/* Kestrel Nine: vector renderer.
 * A 2D "phosphor" scene canvas (world units 1000 x 625) run through a WebGL CRT pass:
 * separable bloom, barrel curvature, chromatic fringe, scanlines, vignette.
 * Falls back to the plain 2D canvas when WebGL is unavailable or CRT is switched off.
 */
(function (root) {
  'use strict';
  const WW = 1000, WH = 625;

  const COL = {
    bg: '#0b0d15',
    you: '#b0a6ff',     // pilot (periwinkle, from the Slate accent)
    nav: '#e8b576',     // NAV-7 (amber)
    cen: '#a8dd8e',     // centaur (sage, brightened)
    best: '#e7e8f0',    // charted best
    inq: '#f0877f',     // Inquisition / threat (coral)
    text: '#dfe2f2',
    muted: '#8a90aa',
    dim: '#3a4060',
    faint: '#1d2133',
    iron: '#aab0c6',
    cobalt: '#7faee8',
    lumen: '#ffd98a',
  };

  // ------------------------------------------------------------------
  // Vector stroke font: 4 x 6 grid, y down. Strokes separated by |.
  // ------------------------------------------------------------------
  const GLYPH_SRC = {
    A: '0,6 0,2 2,0 4,2 4,6|0,3.5 4,3.5', B: '0,0 0,6 3,6 4,5 4,4 3,3 0,3|0,0 3,0 4,1 4,2 3,3',
    C: '4,1 3,0 1,0 0,1 0,5 1,6 3,6 4,5', D: '0,0 0,6 2,6 4,4 4,2 2,0 0,0',
    E: '4,0 0,0 0,6 4,6|0,3 3,3', F: '4,0 0,0 0,6|0,3 3,3',
    G: '4,1 3,0 1,0 0,1 0,5 1,6 3,6 4,5 4,3.5 2,3.5', H: '0,0 0,6|4,0 4,6|0,3 4,3',
    I: '1,0 3,0|2,0 2,6|1,6 3,6', J: '4,0 4,5 3,6 1,6 0,5', K: '0,0 0,6|4,0 0,3.5|1.3,2.7 4,6',
    L: '0,0 0,6 4,6', M: '0,6 0,0 2,3 4,0 4,6', N: '0,6 0,0 4,6 4,0',
    O: '1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0', P: '0,6 0,0 3,0 4,1 4,2 3,3 0,3',
    Q: '1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0|2.4,4.4 4,6.2', R: '0,6 0,0 3,0 4,1 4,2 3,3 0,3|2,3 4,6',
    S: '4,1 3,0 1,0 0,1 0,2 1,3 3,3 4,4 4,5 3,6 1,6 0,5', T: '0,0 4,0|2,0 2,6',
    U: '0,0 0,5 1,6 3,6 4,5 4,0', V: '0,0 2,6 4,0', W: '0,0 1,6 2,3 3,6 4,0',
    X: '0,0 4,6|4,0 0,6', Y: '0,0 2,3 4,0|2,3 2,6', Z: '0,0 4,0 0,6 4,6',
    0: '1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0|3.6,1.2 0.4,4.8', 1: '1,1 2,0 2,6|1,6 3,6',
    2: '0,1 1,0 3,0 4,1 4,2 0,6 4,6', 3: '0,0 4,0 2,2.3 3,2.3 4,3.3 4,5 3,6 1,6 0,5',
    4: '3,6 3,0 0,4 4,4', 5: '4,0 0,0 0,3 3,3 4,4 4,5 3,6 0,6',
    6: '3.5,0 2,0 0,2 0,5 1,6 3,6 4,5 4,4 3,3 0,3', 7: '0,0 4,0 1.2,6',
    8: '1,0 3,0 4,1 4,2 3,3 1,3 0,4 0,5 1,6 3,6 4,5 4,4 3,3|1,3 0,2 0,1 1,0',
    9: '4,3 1,3 0,2 0,1 1,0 3,0 4,1 4,4 2.5,6 0.5,6',
    '.': '1.8,5.4 2.2,5.4 2.2,6 1.8,6 1.8,5.4', ',': '2.2,5.2 1.4,7', ':': '2,1.4 2,2|2,4.4 2,5',
    '-': '1,3 3,3', '+': '0.5,3 3.5,3|2,1.5 2,4.5', '/': '0,6 4,0', "'": '2,0 2,1.6', '’': '2,0 1.6,1.6',
    '%': '0,6 4,0|0,0 1,0 1,1 0,1 0,0|3,5 4,5 4,6 3,6 3,5', '>': '1,1 3.4,3 1,5', '<': '3,1 0.6,3 3,5',
    '!': '2,0 2,4|2,5.4 2,6', '?': '0,1 1,0 3,0 4,1 4,2 2,3.4 2,4.2|2,5.4 2,6',
    '(': '3,0 1.5,1.5 1.5,4.5 3,6', ')': '1,0 2.5,1.5 2.5,4.5 1,6', '·': '1.8,2.8 2.2,3.2',
    '=': '0.5,2 3.5,2|0.5,4 3.5,4', '#': '1,0 1,6|3,0 3,6|0,2 4,2|0,4 4,4', '_': '0,6 4,6',
    '⚠': '2,0 4,6 0,6 2,0|2,2 2,4|2,5 2,5.4', '*': '2,1 2,5|0.5,2 3.5,4|3.5,2 0.5,4',
    '&': '4,6 1,2 1,1 2,0 3,1 3,2 0,4 0,5 1,6 2,6 4,4',
  };
  const GLYPHS = {};
  for (const k in GLYPH_SRC) {
    GLYPHS[k] = GLYPH_SRC[k].split('|').map((s) => s.trim().split(/\s+/).map((pt) => pt.split(',').map(Number)));
  }

  function textWidth(str, sizeIn) { const size = sizeIn < 20 ? sizeIn * TEXT_BOOST : sizeIn; return String(str).length * size * 1.0 - size * 0.34; }

  // Draw vector text. size = cap height in world units. align: left|center|right
  // small screens get larger vector type so labels stay legible
  let TEXT_BOOST = 1;
  function setTextBoost(b) { TEXT_BOOST = b; }
  function vtext(ctx, str, x, y, sizeIn, color, align, alpha) {
    const size = sizeIn < 20 ? sizeIn * TEXT_BOOST : sizeIn;
    const s = String(str).toUpperCase();
    const u = size / 6, adv = size * 1.0;
    let ox = x;
    const w = textWidth(s, size);
    if (align === 'center') ox = x - w / 2;
    else if (align === 'right') ox = x - w;
    ctx.save();
    ctx.globalAlpha *= alpha == null ? 1 : alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, size * 0.11);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < s.length; i++) {
      const g = GLYPHS[s[i]];
      if (g) {
        for (const stroke of g) {
          stroke.forEach(([gx, gy], k) => {
            const px = ox + i * adv + gx * u * 0.85, py = y + gy * u;
            if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          });
        }
      }
    }
    ctx.stroke();
    ctx.restore();
    return w;
  }

  // ------------------------------------------------------------------
  // Primitives
  // ------------------------------------------------------------------
  function line(ctx, x1, y1, x2, y2, color, w, alpha) {
    ctx.save(); ctx.globalAlpha *= alpha == null ? 1 : alpha;
    ctx.strokeStyle = color; ctx.lineWidth = w || 1.5;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
  }
  function circle(ctx, x, y, r, color, w, alpha, dash) {
    ctx.save(); ctx.globalAlpha *= alpha == null ? 1 : alpha;
    ctx.strokeStyle = color; ctx.lineWidth = w || 1.5;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  function poly(ctx, x, y, r, sides, rot, color, w, alpha) {
    ctx.save(); ctx.globalAlpha *= alpha == null ? 1 : alpha;
    ctx.strokeStyle = color; ctx.lineWidth = w || 1.5;
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const a = rot + (i / sides) * Math.PI * 2;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke(); ctx.restore();
  }
  function dot(ctx, x, y, r, color, alpha) {
    ctx.save(); ctx.globalAlpha *= alpha == null ? 1 : alpha;
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  // starfield: three parallax layers, seeded once
  const STARS = [];
  (function () {
    let s = 1234567;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 260; i++) STARS.push({ x: r() * WW, y: r() * WH, z: 0.2 + r() * 0.8, tw: r() * 6.28 });
  })();
  function stars(ctx, t, speed, warp) {
    const sp = speed == null ? 4 : speed;
    for (const st of STARS) {
      const x = (st.x - t * sp * st.z * 3) % WW;
      const xx = x < 0 ? x + WW : x;
      const a = (0.25 + 0.5 * st.z) * (0.7 + 0.3 * Math.sin(t * 2 + st.tw));
      if (warp) {
        const cx = WW / 2, cy = WH / 2;
        const dx = xx - cx, dy = st.y - cy;
        const k = warp * st.z * 0.35;
        line(ctx, xx, st.y, xx + dx * k, st.y + dy * k, COL.text, 1, a);
      } else {
        dot(ctx, xx, st.y, st.z * 1.3, COL.text, a);
      }
    }
  }

  // wireframe ringed planet with depth-aware hidden lines
  function planet(ctx, cx, cy, R, t, opt) {
    const o = opt || {};
    const tilt = o.tilt == null ? 0.42 : o.tilt;
    const spin = t * (o.spin == null ? 0.12 : o.spin);
    const color = o.color || COL.muted;
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const proj = (x, y, z) => {
      // tilt around X axis
      const y2 = y * ct - z * st, z2 = y * st + z * ct;
      return [cx + x * R, cy + y2 * R, z2];
    };
    ctx.save();
    ctx.lineWidth = o.lw || 1.2;
    ctx.strokeStyle = color;
    const seg = (a, b, alphaFront) => {
      const z = (a[2] + b[2]) / 2;
      ctx.globalAlpha = z >= 0 ? alphaFront : alphaFront * 0.18;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    };
    const af = o.alpha == null ? 0.8 : o.alpha;
    // latitudes
    for (let lat = -75; lat <= 75; lat += 15) {
      const phi = (lat * Math.PI) / 180, rr = Math.cos(phi), yy = Math.sin(phi);
      let prev = null;
      for (let k = 0; k <= 48; k++) {
        const th = (k / 48) * Math.PI * 2;
        const p = proj(rr * Math.cos(th), yy, rr * Math.sin(th));
        if (prev) seg(prev, p, af * 0.7);
        prev = p;
      }
    }
    // longitudes
    for (let lon = 0; lon < 180; lon += 20) {
      const th0 = (lon * Math.PI) / 180 + spin;
      let prev = null;
      for (let k = 0; k <= 48; k++) {
        const phi = (k / 48) * Math.PI * 2;
        const p = proj(Math.cos(phi) * Math.cos(th0), Math.sin(phi), Math.cos(phi) * Math.sin(th0));
        if (prev) seg(prev, p, af);
        prev = p;
      }
    }
    // rings
    if (o.rings !== false) {
      for (const rk of [1.45, 1.62, 1.78, 2.05]) {
        let prev = null;
        for (let k = 0; k <= 96; k++) {
          const th = (k / 96) * Math.PI * 2;
          const p = proj(Math.cos(th) * rk, 0, Math.sin(th) * rk);
          if (prev) {
            // hidden behind the disc?
            const mx = (p[0] + prev[0]) / 2 - cx, my = (p[1] + prev[1]) / 2 - cy;
            const behind = p[2] < 0 && mx * mx + my * my < R * R;
            ctx.globalAlpha = behind ? 0.06 : (rk === 2.05 ? 0.35 : 0.6) * af;
            ctx.strokeStyle = o.ringColor || color;
            ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
          }
          prev = p;
        }
      }
    }
    ctx.restore();
  }

  function station(ctx, x, y, t, color, opt) {
    const o = opt || {};
    const r = o.r || 9;
    poly(ctx, x, y, r, 6, t * 0.4 + (o.phase || 0), color, o.lw || 1.6, o.alpha);
    if (o.home) { circle(ctx, x, y, r + 6, color, 1.2, 0.7); circle(ctx, x, y, r + 10 + Math.sin(t * 3) * 1.5, color, 0.8, 0.35); }
    dot(ctx, x, y, 1.8, color, o.alpha);
  }

  function ship(ctx, x, y, ang, color, thrust, scale) {
    const s = scale || 1;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
    ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-7, -7); ctx.lineTo(-3, 0); ctx.lineTo(-7, 7); ctx.closePath(); ctx.stroke();
    if (thrust) {
      ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.moveTo(-5, -3); ctx.lineTo(-10 - Math.random() * 8, 0); ctx.lineTo(-5, 3); ctx.stroke();
    }
    ctx.restore();
  }

  // irregular rotating asteroid
  const ROCKS = {};
  function rock(ctx, x, y, r, key, t, color, alpha) {
    let shape = ROCKS[key];
    if (!shape) {
      let s = 0; for (const ch of String(key)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
      const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
      shape = []; const k = 9;
      for (let i = 0; i < k; i++) shape.push(0.72 + rnd() * 0.4);
      shape.rot = rnd() * 6.28; shape.spin = (rnd() - 0.5) * 0.4;
      ROCKS[key] = shape;
    }
    ctx.save(); ctx.globalAlpha *= alpha == null ? 1 : alpha;
    ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.beginPath();
    const n = shape.length, rot = shape.rot + t * shape.spin;
    for (let i = 0; i <= n; i++) {
      const a = rot + (i / n) * Math.PI * 2, rr = r * shape[i % n];
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke(); ctx.restore();
  }

  // jagged static along a lane
  function staticLine(ctx, a, b, t, color, alpha) {
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
    const nx = -dy / L, ny = dx / L;
    const steps = Math.max(4, Math.floor(L / 9));
    ctx.save(); ctx.globalAlpha = alpha == null ? 0.8 : alpha; ctx.strokeStyle = color; ctx.lineWidth = 1.1;
    ctx.beginPath();
    const ph = Math.floor(t * 14);
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const j = (i === 0 || i === steps) ? 0 : (((i * 7919 + ph * 104729) % 13) / 13 - 0.5) * 9;
      const px = a.x + dx * f + nx * j, py = a.y + dy * f + ny * j;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke(); ctx.restore();
  }

  // ------------------------------------------------------------------
  // WebGL CRT pipeline
  // ------------------------------------------------------------------
  const VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  const FS_BLUR = [
    'precision mediump float;varying vec2 v;uniform sampler2D t;uniform vec2 d;',
    'void main(){vec4 c=texture2D(t,v)*.227;',
    'c+=texture2D(t,v+d*1.38)*.316;c+=texture2D(t,v-d*1.38)*.316;',
    'c+=texture2D(t,v+d*3.23)*.070;c+=texture2D(t,v-d*3.23)*.070;',
    'gl_FragColor=c;}',
  ].join('');
  const FS_CRT = [
    'precision mediump float;varying vec2 v;uniform sampler2D s;uniform sampler2D b;uniform vec2 res;uniform float time;uniform float curve;uniform float fx;',
    'vec2 bend(vec2 uv){uv=uv*2.-1.;vec2 o=abs(uv.yx)/vec2(curve*1.25,curve);uv=uv+uv*o*o;return uv*.5+.5;}',
    'void main(){',
    ' vec2 uv=bend(v);',
    ' if(uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.){gl_FragColor=vec4(0.012,0.014,0.024,1.);return;}',
    ' vec2 fu=uv;',
    ' float ca=.0012*fx;',
    ' vec3 col;',
    ' col.r=texture2D(s,fu+vec2(ca,0.)).r;col.g=texture2D(s,fu).g;col.b=texture2D(s,fu-vec2(ca,0.)).b;',
    ' vec3 bl=texture2D(b,fu).rgb;',
    ' col+=bl*1.35+bl*bl*0.6;',
    ' float sl=.86+.14*sin((uv.y*res.y)*3.14159);',
    ' col*=mix(1.,sl,fx);',
    ' float mask=.94+.06*sin(uv.x*res.x*2.094);',
    ' col*=mix(1.,mask,fx);',
    ' vec2 vg=uv*(1.-uv.yx);float vig=pow(vg.x*vg.y*18.,.28);',
    ' col*=mix(1.,vig,fx*.9+.1);',
    ' col*=1.+fx*.018*sin(time*60.);',
    ' col+=vec3(0.010,0.012,0.022);',
    ' gl_FragColor=vec4(col,1.);',
    '}',
  ].join('');

  function Screen(glCanvas) {
    this.out = glCanvas;
    this.scene = document.createElement('canvas');
    this.ctx = this.scene.getContext('2d');
    this.fx = true;
    this.reduced = false;
    this.curve = 7.0;
    this.gl = null;
    this.flat = null;
    try { this._initGL(); } catch (e) { this.gl = null; }
    if (!this.gl) {
      // fallback: show the scene canvas itself
      this.flat = this.scene;
      this.scene.className = glCanvas.className;
      this.scene.setAttribute('aria-hidden', 'true');
      glCanvas.replaceWith(this.scene);
      this.out = this.scene;
    }
  }
  Screen.prototype._initGL = function () {
    const gl = this.out.getContext('webgl', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
    if (!gl) return;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = (fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link'); return p; };
    this.pBlur = prog(FS_BLUR); this.pCrt = prog(FS_CRT);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const tex = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
    this.tScene = tex();
    this.fb = [0, 1].map(() => { const t = tex(); const f = gl.createFramebuffer(); return { t, f, w: 0, h: 0 }; });
    this.gl = gl;
  };
  Screen.prototype.resize = function () {
    const r = this.out.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = Math.max(320, Math.round(r.width * dpr));
    if (w > 1800) w = 1800;
    const h = Math.round(w * WH / WW);
    if (this.scene.width !== w) { this.scene.width = w; this.scene.height = h; }
    if (this.gl && (this.out.width !== w || this.out.height !== h)) { this.out.width = w; this.out.height = h; }
    if (this.gl) {
      const gl = this.gl, bw = Math.max(1, w >> 2), bh = Math.max(1, h >> 2);
      for (const f of this.fb) {
        if (f.w === bw && f.h === bh) continue;
        gl.bindTexture(gl.TEXTURE_2D, f.t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, bw, bh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, f.f);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, f.t, 0);
        f.w = bw; f.h = bh;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    this.scale = w / WW;
  };
  // begin a frame: fade previous (phosphor persistence) and set world transform
  // persist: share of the previous frame that survives (0..1); phosphor afterglow
  Screen.prototype.begin = function (persist) {
    const c = this.ctx, s = this.scale;
    c.setTransform(1, 0, 0, 1, 0, 0);
    const keep = this.fx && !this.reduced && persist ? 1 - persist : 1;
    c.globalAlpha = keep; c.fillStyle = COL.bg; c.fillRect(0, 0, this.scene.width, this.scene.height);
    c.globalAlpha = 1;
    c.setTransform(s, 0, 0, s, 0, 0);
    c.lineCap = 'round'; c.lineJoin = 'round';
    return c;
  };
  Screen.prototype.present = function (time) {
    if (!this.gl) return;
    const gl = this.gl;
    const w = this.scene.width, h = this.scene.height;
    gl.bindTexture(gl.TEXTURE_2D, this.tScene);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.scene);
    const [A, B] = this.fb;
    // blur H: scene -> A
    gl.useProgram(this.pBlur);
    const uT = gl.getUniformLocation(this.pBlur, 't'), uD = gl.getUniformLocation(this.pBlur, 'd');
    gl.uniform1i(uT, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, A.f); gl.viewport(0, 0, A.w, A.h);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tScene);
    gl.uniform2f(uD, 1.6 / A.w, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // blur V: A -> B
    gl.bindFramebuffer(gl.FRAMEBUFFER, B.f); gl.viewport(0, 0, B.w, B.h);
    gl.bindTexture(gl.TEXTURE_2D, A.t);
    gl.uniform2f(uD, 0, 1.6 / B.h); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // second, wider pass for soft halo: B -> A -> B
    gl.bindFramebuffer(gl.FRAMEBUFFER, A.f); gl.viewport(0, 0, A.w, A.h);
    gl.bindTexture(gl.TEXTURE_2D, B.t); gl.uniform2f(uD, 3.2 / A.w, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, B.f); gl.viewport(0, 0, B.w, B.h);
    gl.bindTexture(gl.TEXTURE_2D, A.t); gl.uniform2f(uD, 0, 3.2 / B.h); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // composite
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w, h);
    gl.useProgram(this.pCrt);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tScene);
    gl.uniform1i(gl.getUniformLocation(this.pCrt, 's'), 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, B.t);
    gl.uniform1i(gl.getUniformLocation(this.pCrt, 'b'), 1);
    gl.uniform2f(gl.getUniformLocation(this.pCrt, 'res'), w, h);
    gl.uniform1f(gl.getUniformLocation(this.pCrt, 'time'), this.reduced ? 0 : time);
    gl.uniform1f(gl.getUniformLocation(this.pCrt, 'curve'), this.fx ? this.curve : 1e6);
    gl.uniform1f(gl.getUniformLocation(this.pCrt, 'fx'), this.fx ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.activeTexture(gl.TEXTURE0);
  };
  // map a pointer event to world coordinates, through the same curvature as the shader
  Screen.prototype.toWorld = function (ev) {
    const r = this.out.getBoundingClientRect();
    let u = (ev.clientX - r.left) / r.width, v = (ev.clientY - r.top) / r.height;
    if (this.gl && this.fx) {
      let x = u * 2 - 1, y = v * 2 - 1;
      const ox = Math.abs(y) / (this.curve * 1.25), oy = Math.abs(x) / this.curve;
      x = x + x * ox * ox; y = y + y * oy * oy;
      u = x * 0.5 + 0.5; v = y * 0.5 + 0.5;
    }
    return { x: u * WW, y: v * WH };
  };

  const api = { WW, WH, COL, setTextBoost, vtext, textWidth, line, circle, poly, dot, stars, planet, station, ship, rock, staticLine, Screen };
  root.K9Render = api;
})(typeof window !== 'undefined' ? window : globalThis);
