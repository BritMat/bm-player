const T = window.THREE;
const PAL = {
  dark:    {orange:0xe86a33,cream:0xfff0d0,eye:0x111111,blush:0xff7777},
  light:   {orange:0xff7f3f,cream:0xffffff,eye:0x222222,blush:0xff8888},
  glass:   {orange:0x9b8cff,cream:0xeaf6ff,eye:0x141425,blush:0x7fe8ff},
  dracula: {orange:0xb33a52,cream:0xf3d9e6,eye:0x1a0a10,blush:0xff3355},
  northern:{orange:0xbfe9ff,cream:0xeefcff,eye:0x0e2630,blush:0x66ffd0},
};
export class Fox {
  constructor(canvas){
    if(!T||!canvas)return;
    this.canvas=canvas;this.rMouse=new T.Vector2(0,0);
    this.tRot=new T.Vector2(0,0);this.cRot=new T.Vector2(0,0);
    this.clock=new T.Clock();this.lastBlink=0;
    this.isSleeping=false;this.isBooped=false;this.currentTheme='dark';
    this.raycaster=new T.Raycaster();
    this._build();this._listen();
  }
  sleep(){this.isSleeping=true;this.eyes.forEach(e=>e.scale.y=0.05);this.tRot.x=0.55;this.tRot.y=0;}
  wake(){this.isSleeping=false;this.eyes.forEach(e=>e.scale.y=1);}
  _build(){
    this.scene=new T.Scene();
    const w=this.canvas.clientWidth||300,h=this.canvas.clientHeight||300;
    this.camera=new T.PerspectiveCamera(45,w/h,0.1,100);this.camera.position.set(0,0,4.5);
    this.renderer=new T.WebGLRenderer({canvas:this.canvas,alpha:true,antialias:true});
    this.renderer.setSize(w,h);this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.foxGroup=new T.Group();this.scene.add(this.foxGroup);
    this._buildBody();this._buildVampire();this._lights();this._loop();
  }
  _buildBody(){
    const m=s=>new T.MeshLambertMaterial({color:s,flatShading:true});
    this.mats={orange:m(0xe86a33),cream:m(0xfff0d0),blush:m(0xff7777),
      sclera:m(0xfaf4f0),iris:m(0x0a0a12),glint:new T.MeshLambertMaterial({color:0xffffff,emissive:new T.Color(0xffffff),emissiveIntensity:.7})};
    this.headGroup=new T.Group();this.foxGroup.add(this.headGroup);
    const head=new T.Mesh(new T.IcosahedronGeometry(.65,1),this.mats.orange);
    head.scale.set(1,.85,.9);this.headGroup.add(head);
    const sn=new T.Mesh(new T.CylinderGeometry(.1,.35,.5,5),this.mats.orange);
    sn.rotation.x=Math.PI/2;sn.position.set(0,-.1,.6);this.headGroup.add(sn);
    const jaw=new T.Mesh(new T.CylinderGeometry(.08,.32,.45,5),this.mats.cream);
    jaw.rotation.x=Math.PI/2;jaw.position.set(0,-.25,.58);this.headGroup.add(jaw);
    this.nose=new T.Mesh(new T.IcosahedronGeometry(.08,0),this.mats.orange);
    this.nose.position.set(0,-.1,.88);this.headGroup.add(this.nose);
    this.ears=[];
    [-.35,.35].forEach(x=>{
      const g=new T.Group();g.position.set(x,.45,0);
      const ou=new T.Mesh(new T.ConeGeometry(.2,.5,4),this.mats.orange);ou.rotation.y=Math.PI/4;
      const in_=new T.Mesh(new T.ConeGeometry(.12,.4,3),this.mats.cream);in_.position.set(0,-.02,.08);in_.rotation.y=Math.PI/4;
      g.add(ou,in_);this.headGroup.add(g);this.ears.push(g);
    });
    // Eyes — sclera + iris disc + glint
    this.eyes=[];this.eyeGlows=[];
    [-.23,.23].forEach(x=>{
      const s=x>0?1:-1;
      const sc=new T.Mesh(new T.SphereGeometry(.082,10,10),this.mats.sclera);
      sc.scale.set(1,.72,.55);sc.position.set(x,.155,.578);sc.rotation.y=s*.22;
      this.headGroup.add(sc);
      const eye=new T.Mesh(new T.CylinderGeometry(.054,.054,.018,14),this.mats.iris);
      eye.rotation.x=Math.PI/2;eye.rotation.z=s*.12;eye.position.set(x,.155,.614);eye.rotation.y=s*.20;
      this.headGroup.add(eye);this.eyes.push(eye);
      const gl=new T.Mesh(new T.SphereGeometry(.014,6,6),this.mats.glint);
      gl.position.set(x+s*.022,.172,.626);this.headGroup.add(gl);
      const glow=new T.PointLight(0xff1030,0,1.2);glow.position.set(x,.155,.62);
      this.headGroup.add(glow);this.eyeGlows.push(glow);
    });
  }
  _buildVampire(){
    const fM=new T.MeshLambertMaterial({color:0xfff4e8,flatShading:true});
    this.bM=new T.MeshLambertMaterial({color:0xcc0e20,flatShading:true,transparent:true,opacity:1,emissive:new T.Color(0x4a0008),emissiveIntensity:.5});
    this.fangs=[-.13,.13].map(x=>{
      const f=new T.Mesh(new T.ConeGeometry(.045,.18,7),fM);
      f.rotation.x=Math.PI;f.position.set(x,-.28,.92);f.visible=false;
      this.headGroup.add(f);return f;
    });
    this.bloodDrop=new T.Mesh(new T.ConeGeometry(.024,.07,7),this.bM);
    this.bloodDrop.rotation.x=Math.PI;this._bY=-.46;
    this.bloodDrop.position.set(.13,this._bY,.92);this.bloodDrop.visible=false;
    this.headGroup.add(this.bloodDrop);
    this.draculaLight=new T.PointLight(0xff1030,0,3.5);this.draculaLight.position.set(0,-.1,1.2);
    this.scene.add(this.draculaLight);
  }
  _lights(){
    this.scene.add(new T.AmbientLight(0xffffff,.7));
    const k=new T.DirectionalLight(0xffffff,1.5);k.position.set(3,4,3);this.scene.add(k);
    const r=new T.DirectionalLight(0xffa500,.6);r.position.set(-3,-1,-2);this.scene.add(r);
  }
  _listen(){
    document.addEventListener('mousemove',e=>{
      this.rMouse.x=(e.clientX/window.innerWidth)*2-1;
      this.rMouse.y=-(e.clientY/window.innerHeight)*2+1;
    });
    document.addEventListener('mousedown',()=>{
      this.raycaster.setFromCamera(this.rMouse,this.camera);
      if(this.raycaster.intersectObject(this.headGroup,true).length)this._boop();
    });
  }
  _boop(){
    if(this.isBooped)return;this.isBooped=true;
    this.nose.material=this.mats.blush;this.headGroup.scale.set(1.1,1.1,1.1);
    setTimeout(()=>{this.isBooped=false;this.nose.material=this.mats.orange;this.headGroup.scale.set(1,1,1);},380);
  }
  _loop(){
    requestAnimationFrame(()=>this._loop());
    const t=this.clock.getElapsedTime();
    this.foxGroup.position.y=Math.sin(t*2)*.05;
    if(!this.isSleeping&&!this.isBooped){this.tRot.x=-this.rMouse.y*.3;this.tRot.y=this.rMouse.x*.5;}
    this.cRot.x+=(this.tRot.x-this.cRot.x)*.05;this.cRot.y+=(this.tRot.y-this.cRot.y)*.05;
    this.headGroup.rotation.x=this.cRot.x;this.headGroup.rotation.y=this.cRot.y;
    if(!this.isSleeping&&t-this.lastBlink>Math.random()*3+2){
      this.lastBlink=t;this.eyes.forEach(e=>e.scale.y=.1);
      setTimeout(()=>{if(!this.isSleeping)this.eyes.forEach(e=>e.scale.y=1);},150);
    }
    if(!this.isSleeping&&Math.random()>.997){
      const i=Math.random()>.5?0:1;this.ears[i].rotation.z=(Math.random()-.5)*.5;
      setTimeout(()=>{this.ears[i].rotation.z=0;},120);
    }
    if(this.currentTheme==='dracula'&&this.bloodDrop?.visible){
      const cy=(t%2.6)/2.6;
      this.bloodDrop.scale.y=1+cy*2.4;this.bloodDrop.position.y=this._bY-cy*.11;
      this.bM.opacity=cy>.82?1-(cy-.82)/.18:1;
    }
    this.renderer.render(this.scene,this.camera);
  }
  setTheme(name){
    this.currentTheme=name;
    const p=PAL[name]||PAL.dark;
    this.mats.orange.color.setHex(p.orange);this.mats.cream.color.setHex(p.cream);
    this.mats.blush.color.setHex(p.blush);this.mats.iris.color.setHex(p.eye);
    const isDr=name==='dracula',isNo=name==='northern';
    this.fangs?.forEach(f=>f.visible=isDr);
    if(this.bloodDrop)this.bloodDrop.visible=isDr;
    if(this.draculaLight)this.draculaLight.intensity=isDr?1.8:0;
    this.eyeGlows?.forEach(g=>{g.intensity=isDr?.8:0;g.color.setHex(isDr?0xff1030:0xffffff);});
    this.mats.iris.emissive=isDr?new T.Color(0xff0820):new T.Color(0x000000);
    this.mats.iris.emissiveIntensity=isDr?.6:0;
    this.foxGroup.visible=!isNo;
  }
}
