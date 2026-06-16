const T = window.THREE;
const PALETTES = {
  dark:     { orange:0xe86a33, cream:0xfff0d0, dark:0x111111, blush:0xff7777 },
  light:    { orange:0xff7f3f, cream:0xffffff, dark:0x2a2a2a, blush:0xff8888 },
  glass:    { orange:0x9b8cff, cream:0xeaf6ff, dark:0x141425, blush:0x7fe8ff },
  dracula:  { orange:0xb33a52, cream:0xf3d9e6, dark:0x1a0a10, blush:0xff3355 },
  northern: { orange:0xbfe9ff, cream:0xeefcff, dark:0x0e2630, blush:0x66ffd0 },
};

export class Fox {
  constructor(canvas) {
    if (!T || !canvas) return;
    this.canvas = canvas;
    this.lookTarget = new T.Vector2(0, 0);
    this.raycastMouse = new T.Vector2(0, 0);
    this.targetRotation = new T.Vector2(0, 0);
    this.currentRotation = new T.Vector2(0, 0);
    this.clock = new T.Clock();
    this.lastBlink = 0;
    this.isSleeping = false;
    this.isBooped = false;
    this.raycaster = new T.Raycaster();
    this._build();
    this._listenMouse();
  }
  _build() {
    this.scene = new T.Scene();
    const w = this.canvas.clientWidth || 300, h = this.canvas.clientHeight || 300;
    this.camera = new T.PerspectiveCamera(45, w/h, 0.1, 100);
    this.camera.position.set(0, 0, 4.5);
    this.renderer = new T.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.foxGroup = new T.Group(); this.scene.add(this.foxGroup);
    this._buildPolygons(); this._lights(); this._startLoop();
  }
  _buildPolygons() {
    this.mats = {
      orange: new T.MeshLambertMaterial({ color: 0xe86a33, flatShading: true }),
      cream:  new T.MeshLambertMaterial({ color: 0xfff0d0, flatShading: true }),
      dark:   new T.MeshLambertMaterial({ color: 0x111111, flatShading: true }),
      blush:  new T.MeshLambertMaterial({ color: 0xff7777, flatShading: true })
    };
    this.headGroup = new T.Group(); this.foxGroup.add(this.headGroup);
    this.head = new T.Mesh(new T.IcosahedronGeometry(0.65, 1), this.mats.orange);
    this.head.scale.set(1, 0.85, 0.9); this.headGroup.add(this.head);
    const snoutTop = new T.Mesh(new T.CylinderGeometry(0.1, 0.35, 0.5, 5), this.mats.orange);
    snoutTop.rotation.x = Math.PI/2; snoutTop.position.set(0, -0.1, 0.6); this.headGroup.add(snoutTop);
    const jaw = new T.Mesh(new T.CylinderGeometry(0.08, 0.32, 0.45, 5), this.mats.cream);
    jaw.rotation.x = Math.PI/2; jaw.position.set(0, -0.25, 0.58); this.headGroup.add(jaw);
    this.nose = new T.Mesh(new T.IcosahedronGeometry(0.08, 0), this.mats.dark);
    this.nose.position.set(0, -0.1, 0.88); this.headGroup.add(this.nose);
    this.ears = [];
    [-0.35, 0.35].forEach((xOffset) => {
      const earGroup = new T.Group(); earGroup.position.set(xOffset, 0.45, 0); earGroup.rotation.z = xOffset > 0 ? -0.25 : 0.25;
      const outer = new T.Mesh(new T.ConeGeometry(0.2, 0.5, 4), this.mats.orange); outer.rotation.y = Math.PI/4;
      const inner = new T.Mesh(new T.ConeGeometry(0.12, 0.4, 3), this.mats.cream); inner.position.set(0, -0.02, 0.08); inner.rotation.y = Math.PI/4;
      earGroup.add(outer, inner); this.headGroup.add(earGroup); this.ears.push(earGroup);
    });
    this.eyes = [];
    [-0.22, 0.22].forEach((xOffset) => {
      const eye = new T.Mesh(new T.BoxGeometry(0.1, 0.04, 0.1), this.mats.dark); eye.position.set(xOffset, 0.15, 0.55);
      eye.rotation.y = xOffset > 0 ? 0.2 : -0.2; eye.rotation.z = xOffset > 0 ? 0.1 : -0.1;
      this.headGroup.add(eye); this.eyes.push(eye);
    });
  }
  _lights() {
    this.scene.add(new T.AmbientLight(0xffffff, 0.7));
    const key = new T.DirectionalLight(0xffffff, 1.5); key.position.set(3, 4, 3); this.scene.add(key);
    const rim = new T.DirectionalLight(0xffa500, 0.6); rim.position.set(-3, -1, -2); this.scene.add(rim);
  }
  _listenMouse() {
    document.addEventListener('mousemove', (e) => {
      if (this.isSleeping) return;
      this.raycastMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.raycastMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
    document.addEventListener('mouseleave', () => this.isSleeping = true);
    document.addEventListener('mouseenter', () => { this.isSleeping = false; this.ears.forEach(e => e.position.y = 0.55); setTimeout(() => this.ears.forEach(e => e.position.y = 0.45), 200); });
    document.addEventListener('mousedown', () => {
      if (this.isSleeping || this.isBooped) return;
      this.raycaster.setFromCamera(this.raycastMouse, this.camera);
      if (this.raycaster.intersectObject(this.headGroup, true).length > 0) this._doBoop();
    });
  }
  _doBoop() {
    this.isBooped = true; this.currentRotation.x -= 0.4; this.nose.scale.set(1.6, 1.6, 1.6); this.nose.material = this.mats.blush;
    this.ears[0].rotation.z = -0.5; this.ears[1].rotation.z = 0.5; this.eyes.forEach(eye => eye.scale.y = 0.05);
    setTimeout(() => { this.isBooped = false; this.nose.scale.set(1, 1, 1); this.nose.material = this.mats.dark; this.ears[0].rotation.z = 0.25; this.ears[1].rotation.z = -0.25; this.eyes.forEach(eye => eye.scale.y = 1); }, 300);
  }
  _doBlink() {
    if (this.isSleeping || this.isBooped) return; this.eyes.forEach(eye => eye.scale.y = 0.1);
    setTimeout(() => { if (!this.isSleeping && !this.isBooped) this.eyes.forEach(eye => eye.scale.y = 1); }, 150);
  }
  _startLoop() {
    const loop = () => {
      requestAnimationFrame(loop); const time = this.clock.getElapsedTime();
      if (this.isSleeping) {
        this.targetRotation.x = 0.6; this.targetRotation.y = 0; this.eyes.forEach(eye => eye.scale.y = 0.1); this.foxGroup.position.y = Math.sin(time * 1.5) * 0.08 - 0.1;
      } else {
        if (!this.isBooped) { this.targetRotation.x = -this.raycastMouse.y * 0.4; this.targetRotation.y = this.raycastMouse.x * 0.6; }
        this.foxGroup.position.y = Math.sin(time * 2.5) * 0.04;
        if (time - this.lastBlink > Math.random() * 4 + 2) { this.lastBlink = time; this._doBlink(); }
      }
      this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * 0.08; this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * 0.08;
      this.headGroup.rotation.x = this.currentRotation.x; this.headGroup.rotation.y = this.currentRotation.y;
      if (!this.isSleeping && !this.isBooped && Math.random() > 0.995) { this.ears[0].rotation.z = 0.25 + Math.random() * 0.3; setTimeout(() => { if (!this.isBooped) this.ears[0].rotation.z = 0.25; }, 100); }
      this.renderer.render(this.scene, this.camera);
    }; loop();
  }
  setTheme(name) {
    if (!this.mats) return;
    const p = PALETTES[name] || PALETTES.dark;
    this.mats.orange.color.setHex(p.orange);
    this.mats.cream.color.setHex(p.cream);
    this.mats.dark.color.setHex(p.dark);
    this.mats.blush.color.setHex(p.blush);
  }
}