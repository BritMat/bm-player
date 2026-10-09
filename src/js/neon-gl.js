/**
 * neon-gl: Neon's light, drawn by the graphics card (v3.38.0).
 *
 * Neon drew its lines with the 2D canvas, three strokes each. On the laptop
 * that came to 27 frames a second, where every other style drew 55 to 57
 * (the screen's 60). A 2D stroke is cut into triangles on the processor,
 * every stroke, every frame, and that is what the time went on. Here each
 * line is one strip of triangles along its points, made once a frame, and
 * the whole picture is one draw: the glow, the coloured tube and the light
 * middle are worked out for each pixel from its distance to the line
 * (the fragment shader). It also fades along its length point by point,
 * where the 2D lines faded in four steps.
 *
 * Light adds up (blending ONE, ONE), as 'lighter' did in 2D, so strands
 * that run together glow more. A strip follows its line without
 * overlapping itself, so a line does not light up at its own joints.
 *
 * WebGL 2, or WebGL 1 (nothing it needs is missing there). Without either,
 * make() gives null and Neon draws in 2D as before. A lost context is
 * reported (lost) and the visualiser makes a new canvas.
 */

const VS = `
attribute vec2 aPos;
attribute vec2 aUv;
attribute vec4 aCol;
attribute vec3 aSize;
attribute vec2 aStr;
uniform vec2 uView;
varying vec2 vUv;
varying vec4 vCol;
varying vec3 vSize;
varying vec2 vStr;
void main () {
  vUv = aUv; vCol = aCol; vSize = aSize; vStr = aStr;
  vec2 p = aPos / uView * 2.0 - 1.0;
  gl_Position = vec4(p.x, -p.y, 0.0, 1.0);
}`;

// vUv: across the line (y, -1 to 1) or out from a dot's middle (x and y).
// vSize: the glow's reach, the tube's width and the middle's width, in pixels.
// vCol: the colour and the glow's strength. vStr: the tube's and the middle's.
const FS = `
precision mediump float;
varying vec2 vUv;
varying vec4 vCol;
varying vec3 vSize;
varying vec2 vStr;
void main () {
  float d = length(vUv) * vSize.x;
  float s = vSize.x * 0.36;
  float glow = exp(-d * d / (2.0 * s * s)) * vCol.a;
  float tube = (1.0 - smoothstep(vSize.y * 0.5, vSize.y * 0.5 + 1.2, d)) * vStr.x;
  float core = (1.0 - smoothstep(vSize.z * 0.5, vSize.z * 0.5 + 1.0, d)) * vStr.y;
  vec3 c = vCol.rgb * (glow + tube) + mix(vCol.rgb, vec3(1.0), 0.72) * core;
  gl_FragColor = vec4(c, min(1.0, max(c.r, max(c.g, c.b))));
}`;

const F = 13;   // numbers a corner: x y, u v, r g b glow, reach tube middle, tube middle

export class NeonGL {
  static make (canvas) {
    try { return new NeonGL(canvas); } catch (e) { console.warn('[BM Player] Neon on the graphics card unavailable, drawing in 2D:', e?.message || e); return null; }
  }

  constructor (canvas) {
    const opts = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' };
    const gl = canvas.getContext('webgl2', opts) || canvas.getContext('webgl', opts);
    if (!gl) throw new Error('no WebGL');
    this.canvas = canvas; this.gl = gl; this.lost = false;
    this._onLost = e => { e.preventDefault(); this.lost = true; };
    canvas.addEventListener('webglcontextlost', this._onLost, false);
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
    this.prog = p;
    this.at = ['aPos', 'aUv', 'aCol', 'aSize', 'aStr'].map(n => gl.getAttribLocation(p, n));
    this.uView = gl.getUniformLocation(p, 'uView');
    this.vb = gl.createBuffer(); this.ib = gl.createBuffer();
    this.v = new Float32Array(F * 4096); this.i = new Uint16Array(6 * 2048);
    this.nv = 0; this.ni = 0; this.W = 0; this.H = 0;
  }

  destroy () {
    try { this.canvas.removeEventListener('webglcontextlost', this._onLost); } catch (_) {}
    try { this.gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch (_) {}
  }

  _room (verts, idx) {
    // Up to 65,535 corners in a draw (16-bit indices): past that, the rest waits for the next frame.
    if (this.nv + verts > 65535) return false;
    if ((this.nv + verts) * F > this.v.length) { const n = new Float32Array(Math.max(this.v.length * 2, (this.nv + verts) * F)); n.set(this.v); this.v = n; }
    if (this.ni + idx > this.i.length) { const n = new Uint16Array(Math.max(this.i.length * 2, this.ni + idx)); n.set(this.i); this.i = n; }
    return true;
  }

  _vert (x, y, u, w, rgb, glow, reach, tube, mid, tubeS, midS) {
    const v = this.v, o = this.nv * F;
    v[o] = x; v[o + 1] = y; v[o + 2] = u; v[o + 3] = w;
    v[o + 4] = rgb[0]; v[o + 5] = rgb[1]; v[o + 6] = rgb[2]; v[o + 7] = glow;
    v[o + 8] = reach; v[o + 9] = tube; v[o + 10] = mid; v[o + 11] = tubeS; v[o + 12] = midS;
    return this.nv++;
  }

  begin (W, H) {
    if (this.canvas.width !== W) this.canvas.width = W;
    if (this.canvas.height !== H) this.canvas.height = H;
    this.W = W; this.H = H; this.nv = 0; this.ni = 0;
  }

  /**
   * A line through n points: xs, ys, and for each a look (fn(k) gives
   * [glow, reach, tube, middle, tube strength, middle strength]) in one colour.
   */
  strip (xs, ys, n, rgb, look) {
    if (n < 2 || !this._room(n * 2, (n - 1) * 6)) return;
    const first = this.nv;
    for (let k = 0; k < n; k++) {
      const a = k > 0 ? k - 1 : k, b = k < n - 1 ? k + 1 : k;
      let tx = xs[b] - xs[a], ty = ys[b] - ys[a]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const [glow, reach, tube, mid, ts, ms] = look(k);
      const nx = -ty * reach, ny = tx * reach;
      this._vert(xs[k] + nx, ys[k] + ny, 0, 1, rgb, glow, reach, tube, mid, ts, ms);
      this._vert(xs[k] - nx, ys[k] - ny, 0, -1, rgb, glow, reach, tube, mid, ts, ms);
    }
    const I = this.i;
    for (let k = 0; k < n - 1; k++) {
      const q = first + k * 2;
      I[this.ni++] = q; I[this.ni++] = q + 1; I[this.ni++] = q + 2;
      I[this.ni++] = q + 1; I[this.ni++] = q + 3; I[this.ni++] = q + 2;
    }
  }

  /** A round light: its glow, a disc of colour and a light middle, all in one. */
  dot (x, y, rgb, glow, reach, tube, mid, ts, ms) {
    if (!this._room(4, 6)) return;
    const q = this.nv;
    for (const [u, w] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) this._vert(x + u * reach, y + w * reach, u, w, rgb, glow, reach, tube, mid, ts, ms);
    const I = this.i;
    I[this.ni++] = q; I[this.ni++] = q + 1; I[this.ni++] = q + 2;
    I[this.ni++] = q; I[this.ni++] = q + 2; I[this.ni++] = q + 3;
  }

  end () {
    const gl = this.gl;
    if (this.lost || gl.isContextLost()) { this.lost = true; return false; }
    gl.viewport(0, 0, this.W, this.H);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    if (!this.ni) return true;
    gl.useProgram(this.prog);
    gl.uniform2f(this.uView, this.W, this.H);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vb);
    gl.bufferData(gl.ARRAY_BUFFER, this.v.subarray(0, this.nv * F), gl.STREAM_DRAW);
    const B = 4 * F, parts = [[0, 2], [2, 2], [4, 4], [8, 3], [11, 2]];
    parts.forEach(([off, size], j) => {
      const loc = this.at[j]; if (loc < 0) return;
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, B, off * 4);
    });
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.i.subarray(0, this.ni), gl.STREAM_DRAW);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawElements(gl.TRIANGLES, this.ni, gl.UNSIGNED_SHORT, 0);
    return true;
  }
}
