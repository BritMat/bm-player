/**
 * BM Player — High-Fidelity MetaMask-Style Fox
 * Features: True low-poly geometry, spring physics mouse tracking, blinking, and ear twitching.
 */
const T = window.THREE;

export class Fox {
  constructor(canvas) {
    if (!T || !canvas) return;
    this.canvas = canvas;
    this.mouse = new T.Vector2(0, 0);
    
    // Physics targets for smooth lerping
    this.targetRotation = new T.Vector2(0, 0);
    this.currentRotation = new T.Vector2(0, 0);
    
    // Timers
    this.clock = new T.Clock();
    this.lastBlink = 0;
    
    this._build();
    this._listenMouse();
  }

  _build() {
    this.scene = new T.Scene();
    
    // Camera
    const w = this.canvas.clientWidth || 300;
    const h = this.canvas.clientHeight || 300;
    this.camera = new T.PerspectiveCamera(45, w / h, 0.1, 100);
    this.camera.position.set(0, 0, 4.5); // Pulled back slightly so the whole fox is visible

    // Renderer
    this.renderer = new T.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.foxGroup = new T.Group();
    this.scene.add(this.foxGroup);

    this._buildPolygons();
    this._lights();
    this._startLoop();
  }

  _buildPolygons() {
    // Premium MetaMask Materials (Flat shading is critical for the low-poly look)
    this.mats = {
      orange: new T.MeshLambertMaterial({ color: 0xe86a33, flatShading: true }),
      cream:  new T.MeshLambertMaterial({ color: 0xfff0d0, flatShading: true }),
      dark:   new T.MeshLambertMaterial({ color: 0x111111, flatShading: true })
    };

    this.headGroup = new T.Group();
    this.foxGroup.add(this.headGroup);

    // 1. Main Head (Icosahedron base for geometric look)
    const headGeo = new T.IcosahedronGeometry(0.65, 1);
    this.head = new T.Mesh(headGeo, this.mats.orange);
    this.head.scale.set(1, 0.85, 0.9);
    this.headGroup.add(this.head);

    // 2. Snout Top (Orange)
    const snoutTop = new T.Mesh(new T.CylinderGeometry(0.1, 0.35, 0.5, 5), this.mats.orange);
    snoutTop.rotation.x = Math.PI / 2;
    snoutTop.position.set(0, -0.1, 0.6);
    this.headGroup.add(snoutTop);

    // 3. Snout Bottom / Jaw (Cream)
    const jaw = new T.Mesh(new T.CylinderGeometry(0.08, 0.32, 0.45, 5), this.mats.cream);
    jaw.rotation.x = Math.PI / 2;
    jaw.position.set(0, -0.25, 0.58);
    this.headGroup.add(jaw);

    // 4. Nose (Dark)
    const nose = new T.Mesh(new T.IcosahedronGeometry(0.08, 0), this.mats.dark);
    nose.position.set(0, -0.1, 0.88);
    this.headGroup.add(nose);

    // 5. Ears
    this.ears = [];
    [-0.35, 0.35].forEach((xOffset) => {
      const earGroup = new T.Group();
      earGroup.position.set(xOffset, 0.45, 0);
      // Tilt outwards
      earGroup.rotation.z = xOffset > 0 ? -0.25 : 0.25;
      
      const outer = new T.Mesh(new T.ConeGeometry(0.2, 0.5, 4), this.mats.orange);
      outer.rotation.y = Math.PI / 4;
      
      const inner = new T.Mesh(new T.ConeGeometry(0.12, 0.4, 3), this.mats.cream);
      inner.position.set(0, -0.02, 0.08);
      inner.rotation.y = Math.PI / 4;
      
      earGroup.add(outer, inner);
      this.headGroup.add(earGroup);
      this.ears.push(earGroup);
    });

    // 6. Eyes (Dark slits, scale Y to blink)
    this.eyes = [];
    [-0.22, 0.22].forEach((xOffset) => {
      const eye = new T.Mesh(new T.BoxGeometry(0.1, 0.04, 0.1), this.mats.dark);
      eye.position.set(xOffset, 0.15, 0.55);
      // Angle them slightly
      eye.rotation.y = xOffset > 0 ? 0.2 : -0.2;
      eye.rotation.z = xOffset > 0 ? 0.1 : -0.1;
      this.headGroup.add(eye);
      this.eyes.push(eye);
    });
  }

  _lights() {
    this.scene.add(new T.AmbientLight(0xffffff, 0.7)); // Base fill
    
    // Key Light (sharp shadows for faceted look)
    const key = new T.DirectionalLight(0xffffff, 1.5);
    key.position.set(3, 4, 3);
    this.scene.add(key);

    // Rim Light (warm orange bounce)
    const rim = new T.DirectionalLight(0xffa500, 0.6);
    rim.position.set(-3, -1, -2);
    this.scene.add(rim);
  }

  _listenMouse() {
    document.addEventListener('mousemove', (e) => {
      // Normalize -1 to 1
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
  }

  _startLoop() {
    const loop = () => {
      requestAnimationFrame(loop);
      const time = this.clock.getElapsedTime();

      // 1. Spring Physics for Head Tracking
      this.targetRotation.x = this.mouse.y * 0.4;
      this.targetRotation.y = this.mouse.x * 0.6;

      this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * 0.08;
      this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * 0.08;

      this.headGroup.rotation.x = this.currentRotation.x;
      this.headGroup.rotation.y = this.currentRotation.y;

      // 2. Idle Floating (Breathing)
      this.foxGroup.position.y = Math.sin(time * 2) * 0.04;

      // 3. Random Blinking
      if (time - this.lastBlink > Math.random() * 4 + 2) {
        this.lastBlink = time;
        this._doBlink();
      }

      // 4. Ear Twitching (occasional)
      if (Math.random() > 0.99) {
        this.ears[0].rotation.z = 0.25 + Math.random() * 0.2;
        setTimeout(() => this.ears[0].rotation.z = 0.25, 100);
      }

      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  _doBlink() {
    this.eyes.forEach(eye => eye.scale.y = 0.1); // Squish eyes flat
    setTimeout(() => {
      this.eyes.forEach(eye => eye.scale.y = 1); // Open eyes
    }, 150);
  }
}