/**
 * BM Player — Three.js Fox Mascot  (v1.4)
 *
 * Dracula theme: vampire fangs + animated blood-drip geometry.
 * Northern theme:  fox is hidden (ThemeFX aurora takes over the stage).
 * Other themes:    colour-tinted via THEME_PALETTES.
 */
const T = window.THREE;

const THEME_PALETTES = {
  dark:     { orange: 0xe86a33, cream: 0xfff0d0, dark: 0x111111, blush: 0xff7777 },
  light:    { orange: 0xff7f3f, cream: 0xffffff, dark: 0x2a2a2a, blush: 0xff8888 },
  glass:    { orange: 0x9b8cff, cream: 0xeaf6ff, dark: 0x141425, blush: 0x7fe8ff },
  dracula:  { orange: 0xb33a52, cream: 0xf3d9e6, dark: 0x1a0a10, blush: 0xff3355 },
  northern: { orange: 0xbfe9ff, cream: 0xeefcff, dark: 0x0e2630, blush: 0x66ffd0 },
};

export class Fox {
  constructor(canvas) {
    if (!T || !canvas) return;
    this.canvas = canvas;
    this.raycastMouse   = new T.Vector2(0, 0);
    this.targetRotation = new T.Vector2(0, 0);
    this.currentRotation= new T.Vector2(0, 0);
    this.clock       = new T.Clock();
    this.lastBlink   = 0;
    this.isSleeping  = false;
    this.isBooped    = false;
    this.raycaster   = new T.Raycaster();
    this.currentTheme= 'dark';
    this._build();
    this._listenMouse();
  }

  sleep() { this.isSleeping = true; this.eyes.forEach(e => e.scale.y = 0.1); this.targetRotation.x = 0.5; this.targetRotation.y = 0; }
  wake()  { this.isSleeping = false; this.eyes.forEach(e => e.scale.y = 1); }

  _build() {
    this.scene = new T.Scene();
    const w = this.canvas.clientWidth || 300, h = this.canvas.clientHeight || 300;
    this.camera = new T.PerspectiveCamera(45, w / h, 0.1, 100);
    this.camera.position.set(0, 0, 4.5);
    this.renderer = new T.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.foxGroup = new T.Group();
    this.scene.add(this.foxGroup);
    this._buildPolygons();
    this._buildVampireBits();
    this._lights();
    this._startLoop();
  }

  _buildPolygons() {
    this.mats = {
      orange: new T.MeshLambertMaterial({ color: 0xe86a33, flatShading: true }),
      cream:  new T.MeshLambertMaterial({ color: 0xfff0d0, flatShading: true }),
      dark:   new T.MeshLambertMaterial({ color: 0x111111, flatShading: true }),
      blush:  new T.MeshLambertMaterial({ color: 0xff7777, flatShading: true }),
    };

    this.headGroup = new T.Group();
    this.foxGroup.add(this.headGroup);

    this.head = new T.Mesh(new T.IcosahedronGeometry(0.65, 1), this.mats.orange);
    this.head.scale.set(1, 0.85, 0.9);
    this.headGroup.add(this.head);

    const snoutTop = new T.Mesh(new T.CylinderGeometry(0.1, 0.35, 0.5, 5), this.mats.orange);
    snoutTop.rotation.x = Math.PI / 2; snoutTop.position.set(0, -0.1, 0.6);
    this.headGroup.add(snoutTop);

    const jaw = new T.Mesh(new T.CylinderGeometry(0.08, 0.32, 0.45, 5), this.mats.cream);
    jaw.rotation.x = Math.PI / 2; jaw.position.set(0, -0.25, 0.58);
    this.headGroup.add(jaw);

    this.nose = new T.Mesh(new T.IcosahedronGeometry(0.08, 0), this.mats.dark);
    this.nose.position.set(0, -0.1, 0.88);
    this.headGroup.add(this.nose);

    this.ears = [];
    [-0.35, 0.35].forEach(x => {
      const g = new T.Group();
      g.position.set(x, 0.45, 0);
      const outer = new T.Mesh(new T.ConeGeometry(0.2, 0.5, 4), this.mats.orange); outer.rotation.y = Math.PI / 4;
      const inner = new T.Mesh(new T.ConeGeometry(0.12, 0.4, 3), this.mats.cream); inner.position.set(0, -0.02, 0.08); inner.rotation.y = Math.PI / 4;
      g.add(outer, inner); this.headGroup.add(g); this.ears.push(g);
    });

    this.eyes = [];
    [-0.22, 0.22].forEach(x => {
      const eye = new T.Mesh(new T.BoxGeometry(0.1, 0.04, 0.1), this.mats.dark);
      eye.position.set(x, 0.15, 0.55);
      this.headGroup.add(eye); this.eyes.push(eye);
    });
  }

  _buildVampireBits() {
    const fangMat = new T.MeshLambertMaterial({ color: 0xfff8ee, flatShading: true });
    const bloodMat = new T.MeshLambertMaterial({
      color: 0xcc0e20, flatShading: true,
      emissive: new T.Color(0x440008), emissiveIntensity: 0.4,
      transparent: true, opacity: 1,
    });

    this.fangs = [-0.095, 0.095].map(x => {
      const fang = new T.Mesh(new T.ConeGeometry(0.032, 0.12, 6), fangMat);
      fang.rotation.x = Math.PI;       
      fang.position.set(x, -0.32, 0.64);
      fang.visible = false;
      this.headGroup.add(fang);
      return fang;
    });

    this.bloodDrop = new T.Mesh(new T.ConeGeometry(0.020, 0.055, 6), bloodMat);
    this.bloodDrop.rotation.x = Math.PI;
    this._bloodBaseY = -0.44;
    this.bloodDrop.position.set(0.095, this._bloodBaseY, 0.64);
    this.bloodDrop.visible = false;
    this.headGroup.add(this.bloodDrop);
  }

  _lights() {
    this.scene.add(new T.AmbientLight(0xffffff, 0.7));
    const key = new T.DirectionalLight(0xffffff, 1.5); key.position.set(3, 4, 3); this.scene.add(key);
    const rim = new T.DirectionalLight(0xffa500, 0.6); rim.position.set(-3, -1, -2); this.scene.add(rim);
    this.draculaLight = new T.PointLight(0xff1030, 1.8, 3.5);
    this.draculaLight.position.set(0.2, -0.3, 1.4);
    this.draculaLight.visible = false;
    this.scene.add(this.draculaLight);
  }

  _listenMouse() {
    document.addEventListener('mousemove', e => {
      this.raycastMouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
      this.raycastMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
    
    // Upgraded: Accurate canvas-only click detection
    document.addEventListener('mousedown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
        const rcX = (x / rect.width) * 2 - 1;
        const rcY = -(y / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(new T.Vector2(rcX, rcY), this.camera);
        if (this.raycaster.intersectObject(this.headGroup, true).length > 0) {
          this._doBoop();
        }
      }
    });
  }

  _doBoop() {
    if (this.isBooped) return;
    this.isBooped = true;
    this.nose.material = this.mats.blush;
    this.headGroup.scale.set(1.1, 1.1, 1.1);
    setTimeout(() => { this.isBooped = false; this.nose.material = this.mats.dark; this.headGroup.scale.set(1, 1, 1); }, 380);
  }

  _startLoop() {
    const loop = () => {
      requestAnimationFrame(loop);
      const time = this.clock.getElapsedTime();

      this.foxGroup.position.y = Math.sin(time * 2) * 0.05;

      if (!this.isSleeping && !this.isBooped) {
        this.targetRotation.x = -this.raycastMouse.y * 0.3;
        this.targetRotation.y =  this.raycastMouse.x * 0.5;
      }
      this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * 0.05;
      this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * 0.05;
      this.headGroup.rotation.x = this.currentRotation.x;
      this.headGroup.rotation.y = this.currentRotation.y;

      if (!this.isSleeping && time - this.lastBlink > Math.random() * 3 + 2) {
        this.lastBlink = time;
        this.eyes.forEach(e => e.scale.y = 0.1);
        setTimeout(() => { if (!this.isSleeping) this.eyes.forEach(e => e.scale.y = 1); }, 150);
      }

      if (this.currentTheme === 'dracula' && this.bloodDrop?.visible) {
        const cycle = (time % 2.6) / 2.6;          
        this.bloodDrop.scale.y = 1 + cycle * 2.4;
        this.bloodDrop.position.y = this._bloodBaseY - cycle * 0.11;
        this.bloodDrop.material.opacity = cycle > 0.82 ? 1 - (cycle - 0.82) / 0.18 : 1;
      }

      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  setTheme(name) {
    this.currentTheme = name;
    const p = THEME_PALETTES[name] || THEME_PALETTES.dark;
    this.mats.orange.color.setHex(p.orange);
    this.mats.cream.color.setHex(p.cream);
    this.mats.dark.color.setHex(p.dark);
    this.mats.blush.color.setHex(p.blush);

    const isDracula  = name === 'dracula';
    const isNorthern = name === 'northern';

    this.fangs?.forEach(f => f.visible = isDracula);
    if (this.bloodDrop) this.bloodDrop.visible = isDracula;
    if (this.draculaLight) this.draculaLight.visible = isDracula;

    this.foxGroup.visible = !isNorthern;
  }
}