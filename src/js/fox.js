/**
 * BM Player — Three.js Fox Mascot
 *
 * Interactive states (all media-player-appropriate):
 *   idle        – gentle breathing, blinking, occasional tail wag
 *   wave        – arm raises and waves (on startup)
 *   excited     – bouncing, fast tail wag (media opened)
 *   watching    – leans toward screen, focused gaze (media playing)
 *   sleeping    – eyes closed, Zzz particles (long pause)
 *   confused    – head tilt, question-mark (error)
 *   coverEars   – paws over ears (volume goes very high!)
 *   dancing     – side-to-side groove (music playback)
 *   scared      – crouches, pupils wide (sudden loud start)
 *   happy       – quick spin + ear wiggle (end of great playback)
 *
 * Cursor tracking is always active (head follows mouse).
 */

const T = window.THREE;   // loaded as UMD <script> tag

export class Fox {
  constructor (canvas, opts = {}) {
    if (!T || !canvas) return;
    this.canvas  = canvas;
    this.size    = opts.size || 'large';  // 'large' | 'mini'
    this.state   = 'idle';
    this._mouse  = { x: 0, y: 0 };
    this._headTgt = { x: 0, y: 0 };
    this._ear    = { left: 0, right: 0 };
    this._tick   = 0;
    this._zzzMeshes = [];
    this._stateTimer = null;
    this._blinkTimer = null;
    this._animations = [];   // { prop, target, speed, obj }

    this._build();
    this._lights();
    this._startLoop();
    this._listenMouse();
    this._scheduleBlink();
  }

  // ══════════════════════════════════════
  //  SCENE SETUP
  // ══════════════════════════════════════
  _build () {
    const w = this.canvas.clientWidth  || 340;
    const h = this.canvas.clientHeight || 300;

    this.scene    = new T.Scene();
    this.camera   = new T.PerspectiveCamera(45, w / h, 0.1, 100);
    this.camera.position.set(0, 0.5, 5.5);
    this.camera.lookAt(0, 0.2, 0);

    this.renderer = new T.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    // Materials palette
    this.M = {
      body:     new T.MeshStandardMaterial({ color: 0xFF7A30, roughness: 0.75, metalness: 0 }),
      cream:    new T.MeshStandardMaterial({ color: 0xFFF0D0, roughness: 0.8,  metalness: 0 }),
      pink:     new T.MeshStandardMaterial({ color: 0xFFB0BA, roughness: 0.8,  metalness: 0 }),
      dark:     new T.MeshStandardMaterial({ color: 0x2A1200, roughness: 0.9,  metalness: 0 }),
      eyeWhite: new T.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.3,  metalness: 0 }),
      iris:     new T.MeshStandardMaterial({ color: 0x20CC70, roughness: 0.2,  metalness: 0.1, emissive: 0x0A5030, emissiveIntensity: 0.4 }),
      pupil:    new T.MeshStandardMaterial({ color: 0x050505, roughness: 0.5,  metalness: 0 }),
      glass:    new T.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0,    metalness: 0, transparent: true, opacity: 0.15 }),
      platform: new T.MeshStandardMaterial({ color: 0x5B6FF8, roughness: 0.3,  metalness: 0.5, transparent: true, opacity: 0.4 }),
    };

    this.foxGroup = new T.Group();
    this.scene.add(this.foxGroup);

    this._buildBody();
    this._buildHead();
    this._buildTail();
    this._buildArms();
    this._buildLegs();
    this._buildPlatform();

    this.foxGroup.position.y = -0.4;
  }

  _lights () {
    this.scene.add(new T.AmbientLight(0x8090C0, 0.7));

    const key = new T.DirectionalLight(0xFFFFEE, 1.1);
    key.position.set(4, 8, 5);
    key.castShadow = true;
    this.scene.add(key);

    const fill = new T.DirectionalLight(0x6080FF, 0.4);
    fill.position.set(-5, 3, 2);
    this.scene.add(fill);

    const rim = new T.DirectionalLight(0xFF8040, 0.35);
    rim.position.set(0, 2, -5);
    this.scene.add(rim);

    // Eye glow
    this._eyeLight = new T.PointLight(0x00FF80, 0.6, 1.0);
    this.scene.add(this._eyeLight);
  }

  // ══════════════════════════════════════
  //  GEOMETRY
  // ══════════════════════════════════════
  _buildBody () {
    // Torso
    const torsoGeo = new T.CylinderGeometry(0.38, 0.48, 0.85, 8);
    this.torso = new T.Mesh(torsoGeo, this.M.body);
    this.torso.castShadow = true;
    this.foxGroup.add(this.torso);

    // Belly
    const bellyGeo = new T.SphereGeometry(0.34, 12, 10);
    const belly    = new T.Mesh(bellyGeo, this.M.cream);
    belly.scale.set(1, 0.8, 0.75);
    belly.position.set(0, 0.05, 0.22);
    this.foxGroup.add(belly);
  }

  _buildHead () {
    this.headGroup = new T.Group();
    this.headGroup.position.set(0, 0.82, 0);
    this.foxGroup.add(this.headGroup);

    // Head sphere
    const headGeo = new T.SphereGeometry(0.44, 14, 12);
    const headMesh = new T.Mesh(headGeo, this.M.body);
    headMesh.scale.set(1.1, 1.0, 1.0);
    headMesh.castShadow = true;
    this.headGroup.add(headMesh);

    // Cheek puffs
    [-0.3, 0.3].forEach(sx => {
      const cg   = new T.SphereGeometry(0.18, 8, 8);
      const cheek = new T.Mesh(cg, this.M.body);
      cheek.position.set(sx, -0.06, 0.34);
      cheek.scale.set(1, 0.8, 0.7);
      this.headGroup.add(cheek);
    });

    // Snout
    const snoutGeo  = new T.BoxGeometry(0.32, 0.19, 0.28);
    this._snout     = new T.Mesh(snoutGeo, this.M.cream);
    this._snout.position.set(0, -0.1, 0.42);
    this._snout.geometry.deleteAttribute('uv');
    const sg2 = new T.SphereGeometry(0.18, 8, 8);
    const sfr = new T.Mesh(sg2, this.M.cream);
    sfr.scale.set(1.1, 0.75, 0.85);
    sfr.position.set(0, -0.1, 0.52);
    this.headGroup.add(this._snout, sfr);

    // Nose
    const noseGeo = new T.SphereGeometry(0.065, 8, 8);
    const nose    = new T.Mesh(noseGeo, this.M.dark);
    nose.scale.set(1.2, 0.85, 1.0);
    nose.position.set(0, 0.0, 0.68);
    this.headGroup.add(nose);

    // Ears
    this._leftEar  = this._makeEar(-1);
    this._rightEar = this._makeEar(1);

    // Eyes
    this._leftEye  = this._makeEye(-1);
    this._rightEye = this._makeEye(1);

    // Eyebrows (thin boxes for expression)
    this._leftBrow  = this._makeBrow(-1);
    this._rightBrow = this._makeBrow(1);
  }

  _makeEar (side) {
    const g = new T.Group();
    g.position.set(side * 0.30, 0.38, -0.04);
    g.rotation.z = side * 0.18;
    this.headGroup.add(g);

    const outer = new T.Mesh(new T.ConeGeometry(0.17, 0.38, 4), this.M.body);
    outer.rotation.z = Math.PI;
    g.add(outer);

    const inner = new T.Mesh(new T.ConeGeometry(0.1, 0.28, 4), this.M.pink);
    inner.rotation.z = Math.PI;
    inner.position.z = 0.06;
    g.add(inner);

    return g;
  }

  _makeEye (side) {
    const g = new T.Group();
    g.position.set(side * 0.21, 0.1, 0.38);
    this.headGroup.add(g);

    const white = new T.Mesh(new T.SphereGeometry(0.115, 10, 10), this.M.eyeWhite);
    g.add(white);

    const iris  = new T.Mesh(new T.SphereGeometry(0.082, 10, 10), this.M.iris);
    iris.position.z = 0.055;
    g.add(iris);

    const pupil = new T.Mesh(new T.SphereGeometry(0.048, 8, 8), this.M.pupil);
    pupil.position.z = 0.094;
    g.add(pupil);

    // Catch light
    const cl   = new T.Mesh(new T.SphereGeometry(0.018, 6, 6), new T.MeshBasicMaterial({ color: 0xFFFFFF }));
    cl.position.set(0.025, 0.03, 0.115);
    g.add(cl);

    // Upper eyelid (squish for blink / expression)
    const lid = new T.Mesh(
      new T.SphereGeometry(0.118, 10, 10),
      new T.MeshStandardMaterial({ color: 0xFF7A30, roughness: 0.75 })
    );
    lid.position.z = -0.005;
    lid.scale.y = 0;
    g.add(lid);

    g._lid    = lid;
    g._iris   = iris;
    g._pupil  = pupil;
    g._white  = white;

    return g;
  }

  _makeBrow (side) {
    const geo  = new T.BoxGeometry(0.14, 0.025, 0.025);
    const brow = new T.Mesh(geo, this.M.dark);
    brow.position.set(side * 0.21, 0.245, 0.41);
    brow.rotation.z = side * 0.12;
    this.headGroup.add(brow);
    return brow;
  }

  _buildTail () {
    this.tailGroup = new T.Group();
    this.tailGroup.position.set(0, -0.15, -0.44);
    this.foxGroup.add(this.tailGroup);

    const pts = [
      { p:[0,0,0],       r:0.28, m: this.M.body  },
      { p:[-0.08,-0.2,-0.36], r:0.27, m: this.M.body  },
      { p:[-0.18,-0.2,-0.7],  r:0.25, m: this.M.body  },
      { p:[-0.22, 0.0,-0.98], r:0.22, m: this.M.body  },
      { p:[-0.16, 0.28,-1.12],r:0.20, m: this.M.body  },
      { p:[-0.06, 0.45,-1.1], r:0.23, m: this.M.cream },
      { p:[ 0.04, 0.52,-1.02],r:0.20, m: this.M.cream },
    ];
    pts.forEach(({ p, r, m }) => {
      const s = new T.Mesh(new T.SphereGeometry(r, 9, 9), m);
      s.position.set(...p);
      this.tailGroup.add(s);
    });
  }

  _buildArms () {
    this._leftArm  = this._makeArm(-1);
    this._rightArm = this._makeArm(1);
  }

  _makeArm (side) {
    const g = new T.Group();
    // shoulder pivot
    g.position.set(side * 0.46, 0.28, 0.05);
    this.foxGroup.add(g);

    const upper = new T.Mesh(new T.CylinderGeometry(0.095, 0.085, 0.44, 7), this.M.body);
    upper.position.y = -0.22;
    g.add(upper);

    // Elbow pivot
    const elbow = new T.Group();
    elbow.position.y = -0.44;
    g.add(elbow);

    const lower = new T.Mesh(new T.CylinderGeometry(0.082, 0.075, 0.38, 7), this.M.body);
    lower.position.y = -0.19;
    elbow.add(lower);

    const paw = new T.Mesh(new T.SphereGeometry(0.1, 8, 8), this.M.cream);
    paw.scale.set(1.1, 0.75, 1.0);
    paw.position.y = -0.38;
    elbow.add(paw);

    return { group: g, elbow, paw };
  }

  _buildLegs () {
    [[-0.22,-0.5, 0.22],[0.22,-0.5, 0.22],
     [-0.18,-0.5,-0.18],[0.18,-0.5,-0.18]].forEach(pos => {
      const leg = new T.Mesh(new T.CylinderGeometry(0.11, 0.13, 0.38, 7), this.M.body);
      leg.position.set(...pos);
      this.foxGroup.add(leg);
      const foot = new T.Mesh(new T.SphereGeometry(0.1, 8, 7), this.M.cream);
      foot.scale.set(1.2, 0.65, 1.3);
      foot.position.set(pos[0], pos[1] - 0.22, pos[2] + 0.04);
      this.foxGroup.add(foot);
    });
  }

  _buildPlatform () {
    const plat = new T.Mesh(new T.CylinderGeometry(0.9, 0.9, 0.04, 40), this.M.platform);
    plat.position.y = -0.98;
    this.scene.add(plat);

    for (let i = 0; i < 3; i++) {
      const ring = new T.Mesh(
        new T.RingGeometry(0.65 + i * 0.18, 0.68 + i * 0.18, 48),
        new T.MeshBasicMaterial({ color: 0x5B6FF8, transparent: true, opacity: 0.22 - i * 0.06, side: T.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -0.96;
      this.scene.add(ring);
    }
  }

  // ══════════════════════════════════════
  //  ANIMATION STATES
  // ══════════════════════════════════════
  setState (name) {
    if (this.state === name) return;
    this._cancelState();
    this.state = name;
    this._applyState(name);
  }

  _applyState (name) {
    switch (name) {
      case 'idle':     this._stateIdle();     break;
      case 'excited':  this._stateExcited();  break;
      case 'watching': this._stateWatching(); break;
      case 'sleeping': this._stateSleeping(); break;
      case 'confused': this._stateConfused(); break;
      case 'coverEars':this._stateCoverEars();break;
      case 'dancing':  this._stateDancing();  break;
      case 'scared':   this._stateScared();   break;
      case 'happy':    this._stateHappy();    break;
    }
  }

  _cancelState () {
    clearTimeout(this._stateTimer);
    this._stateTimer = null;
    this._removeZzz();
    // Reset arm positions smoothly
    this._tweenArm(this._leftArm,  { groupZ:  0.25, groupX: 0, elbowZ: 0 }, 0.06);
    this._tweenArm(this._rightArm, { groupZ: -0.25, groupX: 0, elbowZ: 0 }, 0.06);
  }

  /* ---- idle ---- */
  _stateIdle () {
    this._setEarTilt(0.18, -0.18);
    this._setBrows(0.12, -0.12);
    this._openEyes();
  }

  /* ---- wave ---- */
  wave () {
    this.state = 'wave';
    this._openEyes();
    // Raise right arm and wave
    const arm = this._rightArm;
    let phase = 0;
    const waveAnim = () => {
      if (this.state !== 'wave') return;
      phase += 0.12;
      arm.group.rotation.z = -1.5 + Math.sin(phase * 2.5) * 0.5;
      arm.group.rotation.x = -0.6;
      arm.elbow.rotation.z = 1.0;
      if (phase < 4 * Math.PI) requestAnimationFrame(waveAnim);
    };
    requestAnimationFrame(waveAnim);
  }

  /* ---- excited ---- */
  _stateExcited () {
    this._openEyes();
    this._setEarTilt(0.0, 0.0);    // ears upright
    this._setBrows(-0.2, 0.2);      // raised brows
    this._dilate(1.1);              // wide pupils
    let phase = 0;
    const bounce = () => {
      if (this.state !== 'excited') return;
      phase += 0.2;
      this.foxGroup.position.y = -0.4 + Math.abs(Math.sin(phase)) * 0.18;
      this.tailGroup.rotation.z = Math.sin(phase * 3) * 0.5;
      requestAnimationFrame(bounce);
    };
    requestAnimationFrame(bounce);
  }

  /* ---- watching ---- */
  _stateWatching () {
    this._openEyes();
    this._setEarTilt(0.1, -0.1);
    this._setBrows(0.05, -0.05);
    // Slight forward lean
    this._tweenFox({ y: -0.45 }, 0.05);
    // Head tracking stays active
  }

  /* ---- sleeping ---- */
  _stateSleeping () {
    this._squintEyes(0.9);
    this._setEarTilt(0.3, -0.3);
    this._setBrows(0.08, -0.08);
    this.headGroup.rotation.x = 0.22;    // head drooped

    // Zzz particles
    this._spawnZzz();
    const breathe = () => {
      if (this.state !== 'sleeping') return;
      const t = performance.now() * 0.0007;
      this.foxGroup.position.y = -0.4 + Math.sin(t) * 0.018;
      this.torso.scale.y       = 1.0 + Math.sin(t) * 0.03;
      requestAnimationFrame(breathe);
    };
    requestAnimationFrame(breathe);
  }

  /* ---- confused (error) ---- */
  _stateConfused () {
    this._openEyes();
    this._setEarTilt(0.35, -0.06);   // one ear up, one drooped
    this._setBrows(-0.25, 0.05);
    let phase = 0;
    const tilt = () => {
      if (this.state !== 'confused') return;
      phase += 0.04;
      this.headGroup.rotation.z = Math.sin(phase) * 0.22;
      requestAnimationFrame(tilt);
    };
    requestAnimationFrame(tilt);
  }

  /* ---- coverEars (HIGH VOLUME) ---- */
  _stateCoverEars () {
    this._openEyes();
    this._setEarTilt(0.05, -0.05);
    // Paws slide up to cover ears
    this._tweenArm(this._leftArm,  { groupZ: -1.6, groupX: -0.4, elbowZ:  0.8 }, 0.09);
    this._tweenArm(this._rightArm, { groupZ:  1.6, groupX: -0.4, elbowZ: -0.8 }, 0.09);
    this._squintEyes(0.4);   // squinting from the noise
  }

  /* ---- dancing (music mode) ---- */
  _stateDancing () {
    this._openEyes();
    this._setEarTilt(0.15, -0.15);
    this._setBrows(-0.15, 0.15);
    let phase = 0;
    const dance = () => {
      if (this.state !== 'dancing') return;
      phase += 0.08;
      const bob = Math.sin(phase * 2) * 0.1;
      this.foxGroup.position.y  = -0.4 + Math.abs(bob);
      this.foxGroup.rotation.z  = Math.sin(phase)     * 0.08;
      this.tailGroup.rotation.z = Math.cos(phase * 2) * 0.4;
      this._leftArm.group.rotation.z  =  0.3 + Math.sin(phase)     * 0.5;
      this._rightArm.group.rotation.z = -0.3 + Math.sin(phase + 1) * 0.5;
      requestAnimationFrame(dance);
    };
    requestAnimationFrame(dance);
  }

  /* ---- scared (sudden loud start) ---- */
  _stateScared () {
    this._openEyes();
    this._dilate(1.25);
    this._setEarTilt(-0.3, 0.3);  // ears flattened/back
    // Crouching
    this._tweenFox({ y: -0.55 }, 0.08);
    this._stateTimer = setTimeout(() => {
      if (this.state === 'scared') this.setState('idle');
    }, 2500);
  }

  /* ---- happy ---- */
  _stateHappy () {
    this._openEyes();
    this._setEarTilt(0, 0);
    this._setBrows(-0.28, 0.28);
    let phase = 0;
    const spin = () => {
      if (this.state !== 'happy') return;
      phase += 0.1;
      this.foxGroup.rotation.y = phase;
      if (phase < Math.PI * 2) requestAnimationFrame(spin);
      else this.foxGroup.rotation.y = 0;
    };
    requestAnimationFrame(spin);
    // Wiggle ears
    let ep = 0;
    const wiggle = () => {
      if (this.state !== 'happy' || ep > Math.PI * 4) return;
      ep += 0.15;
      this._leftEar.rotation.z  =  0.18 + Math.sin(ep) * 0.25;
      this._rightEar.rotation.z = -0.18 + Math.sin(ep + 0.5) * 0.25;
      requestAnimationFrame(wiggle);
    };
    requestAnimationFrame(wiggle);
  }

  // ══════════════════════════════════════
  //  EXPRESSION HELPERS
  // ══════════════════════════════════════
  _openEyes () {
    [this._leftEye, this._rightEye].forEach(e => {
      if (e) { e._lid.scale.y = 0; e._white.scale.y = 1; }
    });
    this.headGroup.rotation.x = 0;
  }

  _squintEyes (amount) {   // 0 = open, 1 = shut
    [this._leftEye, this._rightEye].forEach(e => {
      if (e) { e._lid.scale.y = amount; }
    });
  }

  _dilate (factor) {
    [this._leftEye, this._rightEye].forEach(e => {
      if (e) { e._pupil.scale.setScalar(factor); }
    });
  }

  _setEarTilt (left, right) {
    this._tweenTo(this._leftEar.rotation, 'z',  left,  0.06);
    this._tweenTo(this._rightEar.rotation,'z',  right, 0.06);
  }

  _setBrows (left, right) {
    if (this._leftBrow)  this._tweenTo(this._leftBrow.rotation,  'z', left,  0.06);
    if (this._rightBrow) this._tweenTo(this._rightBrow.rotation, 'z', right, 0.06);
  }

  _tweenArm (arm, targets, speed) {
    if (!arm) return;
    this._tweenTo(arm.group.rotation, 'z', targets.groupZ, speed);
    this._tweenTo(arm.group.rotation, 'x', targets.groupX, speed);
    this._tweenTo(arm.elbow.rotation, 'z', targets.elbowZ, speed);
  }

  _tweenFox (targets, speed) {
    if (targets.y !== undefined)
      this._tweenTo(this.foxGroup.position, 'y', targets.y, speed);
  }

  _tweenTo (obj, prop, target, speed) {
    this._animations.push({ obj, prop, target, speed });
  }

  // ══════════════════════════════════════
  //  Zzz PARTICLES  (sleep state)
  // ══════════════════════════════════════
  _spawnZzz () {
    this._removeZzz();
    const letters = ['Z','z','Z'];
    letters.forEach((l, i) => {
      const canvas = document.createElement('canvas');
      canvas.width = 64; canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.font = `bold ${28 - i * 6}px Arial`;
      ctx.fillStyle = '#A0C0FF';
      ctx.textAlign = 'center';
      ctx.fillText(l, 32, 44);
      const tex  = new T.CanvasTexture(canvas);
      const mat  = new T.SpriteMaterial({ map: tex, transparent: true });
      const sprite = new T.Sprite(mat);
      sprite.scale.setScalar(0.25 - i * 0.05);
      sprite.position.set(0.35 + i * 0.12, 1.2 + i * 0.2, 0.4);
      sprite._phase = i * 0.7;
      this.scene.add(sprite);
      this._zzzMeshes.push(sprite);
    });
  }

  _removeZzz () {
    this._zzzMeshes.forEach(z => this.scene.remove(z));
    this._zzzMeshes = [];
  }

  _tickZzz () {
    const t = this._tick * 0.02;
    this._zzzMeshes.forEach((z, i) => {
      z.position.y = 1.2 + i * 0.22 + Math.sin(t + z._phase) * 0.08;
      z.material.opacity = 0.5 + 0.5 * Math.sin(t * 0.7 + z._phase);
    });
  }

  // ══════════════════════════════════════
  //  BLINKING
  // ══════════════════════════════════════
  _scheduleBlink () {
    const delay = 2500 + Math.random() * 4000;
    this._blinkTimer = setTimeout(() => {
      if (this.state !== 'sleeping' && this.state !== 'coverEars') this._doBlink();
      this._scheduleBlink();
    }, delay);
  }

  _doBlink () {
    this._squintEyes(1);
    setTimeout(() => this._squintEyes(0), 130);
  }

  // ══════════════════════════════════════
  //  MOUSE TRACKING
  // ══════════════════════════════════════
  _listenMouse () {
    document.addEventListener('mousemove', e => {
      const cx = window.innerWidth  / 2;
      const cy = window.innerHeight / 2;
      this._mouse.x =  (e.clientX - cx) / cx;
      this._mouse.y = -(e.clientY - cy) / cy;
    });
  }

  // ══════════════════════════════════════
  //  ANIMATION LOOP
  // ══════════════════════════════════════
  _startLoop () {
    const loop = () => {
      this._frame = requestAnimationFrame(loop);
      this._tick++;
      const t = this._tick;

      // Process tweens
      this._animations = this._animations.filter(a => {
        a.obj[a.prop] += (a.target - a.obj[a.prop]) * a.speed;
        return Math.abs(a.target - a.obj[a.prop]) > 0.001;
      });

      // Head tracks mouse (always)
      if (this.state !== 'sleeping') {
        this._headTgt.x += (this._mouse.y * 0.28 - this._headTgt.x) * 0.055;
        this._headTgt.y += (this._mouse.x * 0.45 - this._headTgt.y) * 0.055;
        this.headGroup.rotation.x = this._headTgt.x;
        this.headGroup.rotation.y = this._headTgt.y;
      }

      // Eye light follows head
      if (this._eyeLight && this.headGroup) {
        this._eyeLight.position.copy(this.headGroup.position).add(new T.Vector3(0, 0.1, 1.0));
      }

      // Idle breathing
      if (this.state === 'idle' || this.state === 'watching') {
        const s = 1 + Math.sin(t * 0.022) * 0.025;
        if (this.torso) this.torso.scale.y = s;
      }

      // Idle tail sway
      if (this.state === 'idle') {
        this.tailGroup.rotation.z = Math.sin(t * 0.05) * 0.22;
      }

      // Zzz tick
      if (this.state === 'sleeping') this._tickZzz();

      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  // ── Public: react to media events ─────────────────
  onPlay   () { this.setState('watching'); }
  onPause  () {
    this._pauseStart = Date.now();
    this.setState('idle');
    // After 35s idle → sleep
    this._stateTimer = setTimeout(() => {
      if (this.state === 'idle') this.setState('sleeping');
    }, 35000);
  }
  onVolume (vol) {
    if      (vol > 115) this.setState('coverEars');
    else if (vol > 90 && this.state === 'coverEars') this.setState('idle');
  }
  onAudioMode ()  { this.setState('dancing'); }
  onError  ()     { this.setState('confused'); }
  onEnd    ()     { this.setState('happy'); }
  onSeek   ()     { if (this.state !== 'watching') this.setState('excited'); }
}
