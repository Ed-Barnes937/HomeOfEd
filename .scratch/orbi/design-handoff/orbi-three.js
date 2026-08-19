// orbi-three.js — live three.js mocks for orbi (orbit + surface views)
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
let threeP;
const loadThree = () => (threeP ??= import(THREE_URL));
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const sstep = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
function blobShape(x, px, py, r, rnd) { x.beginPath(); for (let a = 0; a <= 6.5; a += 0.4) { const rr = r * (0.7 + rnd() * 0.5); const X = px + Math.cos(a) * rr, Y = py + Math.sin(a) * rr * 0.7; a ? x.lineTo(X, Y) : x.moveTo(X, Y); } x.closePath(); x.fill(); }
function planetMaps(seed) {
  const rnd = mulberry32(seed);
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d');
  x.fillStyle = '#2fa985'; x.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(255,255,255,${rnd() * 0.05})`; blobShape(x, rnd() * 1024, rnd() * 512, 60 + rnd() * 120, rnd); }
  const land = [];
  for (let i = 0; i < 14; i++) { const px = rnd() * 1024, py = 80 + rnd() * 350, r = 40 + rnd() * 90; land.push([px, py, r]); x.fillStyle = i % 4 === 0 ? '#e8c97a' : '#1e8f6a'; blobShape(x, px, py, r, rnd); }
  x.fillStyle = 'rgba(255,255,255,.85)'; blobShape(x, 512, 20, 90, rnd); blobShape(x, 512, 492, 90, rnd);
  const e = document.createElement('canvas'); e.width = 1024; e.height = 512; const y = e.getContext('2d');
  y.fillStyle = '#000'; y.fillRect(0, 0, 1024, 512);
  land.forEach(([px, py, r], i) => { if (i % 2) return; for (let j = 0; j < 70; j++) { const a = rnd() * 6.283, d = rnd() * r * 0.55; y.fillStyle = `rgba(255,214,150,${0.5 + rnd() * 0.5})`; y.fillRect(px + Math.cos(a) * d, py + Math.sin(a) * d, 2.4, 2.4); } });
  return [c, e];
}
function addStars(T, scene, n, dist) {
  const g = new T.BufferGeometry(); const pos = [];
  for (let i = 0; i < n; i++) { const v = new T.Vector3().randomDirection().multiplyScalar(dist); pos.push(v.x, v.y, v.z); }
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  scene.add(new T.Points(g, new T.PointsMaterial({ color: 0xffffff, size: 0.07, transparent: true, opacity: 0.85 })));
}
function setupRenderer(T, host, w, h) {
  const renderer = new T.WebGLRenderer({ antialias: true });
  renderer.setSize(w, h); renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.domElement.style.display = 'block'; host.appendChild(renderer.domElement);
  return renderer;
}
class OrbiPlanet3D extends HTMLElement {
  async connectedCallback() {
    try {
      this.style.display = 'block'; this.style.cursor = 'grab';
      await new Promise(r => requestAnimationFrame(r));
      const w = this.clientWidth || 1150, h = this.clientHeight || 680;
      const T = await loadThree();
      const renderer = this._renderer = setupRenderer(T, this, w, h);
      const scene = new T.Scene(); scene.background = new T.Color('#04060c');
      const cam = new T.PerspectiveCamera(38, w / h, 0.1, 100); cam.position.set(0, 0.25, 4.3);
      addStars(T, scene, 900, 40);
      const [mapC, emiC] = planetMaps(7);
      const map = new T.CanvasTexture(mapC); map.colorSpace = T.SRGBColorSpace;
      const emi = new T.CanvasTexture(emiC);
      const pmat = new T.MeshStandardMaterial({ map, emissiveMap: emi, emissive: new T.Color(0xffd9a0), emissiveIntensity: 1.7, roughness: 0.95 });
      // gate city lights to the night side: fade emissive by world-space sun angle
      const uSun = { value: new (await loadThree()).Vector3(1, 0, 0) };
      pmat.onBeforeCompile = (sh) => {
        sh.uniforms.uSunDir = uSun;
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vWN;')
          .replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\nvWN = normalize(mat3(modelMatrix) * normal);');
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform vec3 uSunDir;varying vec3 vWN;')
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= smoothstep(0.12, -0.18, dot(normalize(vWN), normalize(uSunDir)));');
      };
      const planet = new T.Mesh(new T.SphereGeometry(1.15, 64, 64), pmat);
      scene.add(planet);
      const atm = new T.Mesh(new T.SphereGeometry(1.235, 64, 64), new T.ShaderMaterial({
        transparent: true, blending: T.AdditiveBlending, side: T.BackSide,
        vertexShader: 'varying vec3 vN;void main(){vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader: 'varying vec3 vN;void main(){float f=pow(0.74-dot(vN,vec3(0.,0.,1.)),3.0);gl_FragColor=vec4(0.45,0.8,0.9,1.0)*f;}'
      }));
      scene.add(atm);
      const moon = new T.Mesh(new T.SphereGeometry(0.12, 32, 32), new T.MeshStandardMaterial({ color: 0x9aa2b2, roughness: 1 }));
      scene.add(moon);
      // sun orbits the planet -> the terminator sweeps and city lights wink on as night arrives
      const sun = new T.DirectionalLight(0xfff2dd, 3.2); scene.add(sun);
      scene.add(new T.AmbientLight(0x334455, 0.18));
      // comet: icy head + tail, streaks in every ~14s and impacts
      const comet = new T.Group();
      const head = new T.Mesh(new T.SphereGeometry(0.05, 16, 16), new T.MeshBasicMaterial({ color: 0xcfeffb }));
      comet.add(head);
      const tail = new T.Mesh(new T.ConeGeometry(0.045, 0.7, 12), new T.MeshBasicMaterial({ color: 0x9fdcf0, transparent: true, opacity: 0.5, blending: T.AdditiveBlending }));
      tail.position.z = -0.4; tail.rotation.x = -Math.PI / 2; comet.add(tail);
      scene.add(comet); comet.visible = false;
      const flash = new T.Mesh(new T.SphereGeometry(0.1, 20, 20), new T.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0, blending: T.AdditiveBlending }));
      scene.add(flash);
      const flashLight = new T.PointLight(0xcfeffb, 0, 6); scene.add(flashLight);
      const cStart = new T.Vector3(3.4, 2.1, 0.6), cDir = new T.Vector3(-0.42, -0.52, 0.4).normalize();
      const cImpact = cDir.clone().multiplyScalar(1.15);
      let vel = 0, dragging = false, lastX = 0;
      this.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; this.setPointerCapture(e.pointerId); this.style.cursor = 'grabbing'; });
      this.addEventListener('pointermove', e => { if (!dragging) return; vel += (e.clientX - lastX) * 0.0004; lastX = e.clientX; });
      this.addEventListener('pointerup', () => { dragging = false; this.style.cursor = 'grab'; });
      let t = 0;
      const tick = () => {
        this._raf = requestAnimationFrame(tick); t += 0.016;
        planet.rotation.y += 0.0011 + vel; vel *= 0.94;
        const sa = t * 0.16; sun.position.set(Math.cos(sa) * 5, 1, Math.sin(sa) * 5);
        uSun.value.copy(sun.position).normalize();
        moon.position.set(Math.cos(t * 0.14) * 2.5, 0.45, Math.sin(t * 0.14) * 2.5);
        // comet cycle: 0-2.6s inbound, impact flash 2.6-3.6s, then quiet
        const ct = t % 14;
        if (ct < 2.6) {
          comet.visible = true;
          const p = ct / 2.6;
          comet.position.lerpVectors(cStart, cImpact, p * p);
          comet.lookAt(cImpact); flash.material.opacity = 0; flashLight.intensity = 0;
        } else if (ct < 3.6) {
          comet.visible = false;
          const p = (ct - 2.6) / 1;
          flash.position.copy(cImpact); flash.scale.setScalar(0.5 + p * 3.2);
          flash.material.opacity = 0.85 * (1 - p);
          flashLight.position.copy(cImpact).multiplyScalar(1.25); flashLight.intensity = 14 * (1 - p);
        } else { comet.visible = false; flash.material.opacity = 0; flashLight.intensity = 0; }
        cam.position.y = 0.25 + Math.sin(t * 0.25) * 0.03; cam.lookAt(0, 0, 0);
        renderer.render(scene, cam);
      };
      tick();
    } catch (err) { this.innerHTML = '<div style="color:#7fd8e8;font:12px monospace;padding:40px">3D failed to load: ' + err.message + '</div>'; }
  }
  disconnectedCallback() { cancelAnimationFrame(this._raf); this._renderer?.dispose(); }
}
customElements.define('orbi-planet-3d', OrbiPlanet3D);
function makeBlob(T, scale, tone) {
  const g = new T.Group();
  const body = new T.Mesh(new T.SphereGeometry(0.32, 24, 24), new T.MeshStandardMaterial({ color: tone, roughness: 0.6 }));
  body.scale.set(1, 0.82, 1); g.add(body);
  const eyeM = new T.MeshBasicMaterial({ color: 0xffffff }), pupM = new T.MeshBasicMaterial({ color: 0x22301a });
  [-0.11, 0.11].forEach(dx => {
    const e = new T.Mesh(new T.SphereGeometry(0.07, 12, 12), eyeM); e.position.set(dx, 0.07, 0.27); g.add(e);
    const p = new T.Mesh(new T.SphereGeometry(0.032, 10, 10), pupM); p.position.set(dx, 0.07, 0.33); g.add(p);
  });
  g.scale.setScalar(scale); return g;
}
// a plant that grows sprout -> fern -> small tree
function makePlant(T, rnd) {
  const g = new T.Group();
  const s0 = new T.Group(); // sprout
  const stem = new T.Mesh(new T.CylinderGeometry(0.015, 0.02, 0.16, 6), new T.MeshStandardMaterial({ color: 0x6fae4a })); stem.position.y = 0.08; s0.add(stem);
  const top = new T.Mesh(new T.SphereGeometry(0.045, 8, 8), new T.MeshStandardMaterial({ color: 0xb8e86a })); top.position.y = 0.18; s0.add(top);
  const s1 = new T.Group(); // fern: tilted fronds
  const frondM = new T.MeshStandardMaterial({ color: 0x7fbe58, roughness: 0.8 });
  for (let i = 0; i < 5; i++) {
    const f = new T.Mesh(new T.ConeGeometry(0.028, 0.34, 6), frondM);
    f.geometry.translate(0, 0.17, 0);
    f.rotation.z = 0.55 + rnd() * 0.2; f.rotation.y = (i / 5) * Math.PI * 2;
    f.scale.setScalar(0.8 + rnd() * 0.4); s1.add(f);
  }
  const s2 = new T.Group(); // small tree
  const trunk = new T.Mesh(new T.CylinderGeometry(0.03, 0.05, 0.34, 8), new T.MeshStandardMaterial({ color: 0x6b4a2e })); trunk.position.y = 0.17; s2.add(trunk);
  const can = new T.Mesh(new T.SphereGeometry(0.17, 12, 12), new T.MeshStandardMaterial({ color: 0x5da03e, roughness: 0.9 })); can.position.y = 0.42; can.scale.set(1, 0.85, 1); s2.add(can);
  const can2 = new T.Mesh(new T.SphereGeometry(0.1, 10, 10), new T.MeshStandardMaterial({ color: 0x77b850, roughness: 0.9 })); can2.position.set(0.1, 0.5, 0.05); s2.add(can2);
  g.add(s0, s1, s2);
  return { g, s0, s1, s2 };
}
class OrbiSurface3D extends HTMLElement {
  async connectedCallback() {
    try {
      this.style.display = 'block'; this.style.cursor = 'grab';
      await new Promise(r => requestAnimationFrame(r));
      const w = this.clientWidth || 1150, h = this.clientHeight || 680;
      const T = await loadThree();
      const renderer = this._renderer = setupRenderer(T, this, w, h);
      const scene = new T.Scene(); scene.background = new T.Color('#060910');
      scene.fog = new T.Fog(0x060910, 9, 22);
      const cam = new T.PerspectiveCamera(42, w / h, 0.1, 100);
      addStars(T, scene, 500, 35);
      const rnd = mulberry32(11);
      const gc = document.createElement('canvas'); gc.width = gc.height = 512; const gx = gc.getContext('2d');
      gx.fillStyle = '#7d5c3c'; gx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 500; i++) { gx.fillStyle = `rgba(0,0,0,${rnd() * 0.12})`; gx.fillRect(rnd() * 512, rnd() * 512, 3, 3); }
      const patches = [[160, 300, 70], [330, 200, 55], [390, 360, 65], [220, 130, 40]];
      patches.forEach(([px, py, r]) => { gx.fillStyle = 'rgba(110,180,100,.85)'; blobShape(gx, px, py, r, rnd); gx.fillStyle = 'rgba(140,210,120,.5)'; blobShape(gx, px, py, r * 0.6, rnd); });
      gx.fillStyle = '#3a7297'; gx.beginPath(); gx.ellipse(120, 170, 58, 40, 0.4, 0, 7); gx.fill();
      gx.fillStyle = '#4a8fb8'; gx.beginPath(); gx.ellipse(120, 170, 42, 28, 0.4, 0, 7); gx.fill();
      const gtex = new T.CanvasTexture(gc); gtex.colorSpace = T.SRGBColorSpace;
      const geo = new T.PlaneGeometry(20, 14, 90, 60);
      const pa = geo.attributes.position;
      for (let i = 0; i < pa.count; i++) { const X = pa.getX(i), Y = pa.getY(i); pa.setZ(i, Math.sin(X * 0.7) * Math.cos(Y * 0.9) * 0.14 + Math.sin(X * 2.3 + Y * 1.7) * 0.05); }
      geo.computeVertexNormals();
      const ground = new T.Mesh(geo, new T.MeshStandardMaterial({ map: gtex, roughness: 1 }));
      ground.rotation.x = -Math.PI / 2; scene.add(ground);
      const worldOf = (u, v) => [(u / 512 - 0.5) * 20, -(v / 512 - 0.5) * 14];
      // plants that grow through stages as time fast-forwards
      const plants = [];
      patches.forEach(([px, py, r]) => {
        for (let i = 0; i < 7; i++) {
          const a = rnd() * 6.283, d = rnd() * r * 0.7;
          const [X, Z] = worldOf(px + Math.cos(a) * d, py + Math.sin(a) * d);
          const p = makePlant(T, rnd);
          p.g.position.set(X, 0.04, Z); p.g.rotation.y = rnd() * 6.28;
          scene.add(p.g);
          plants.push({ ...p, offset: rnd() * 20, rate: 0.09 + rnd() * 0.05 });
        }
      });
      const blobs = [];
      const tones = [0x9fd66a, 0x8ed96a, 0xb8e86a, 0x9fd66a];
      patches.slice(0, 4).forEach(([px, py], i) => { const [X, Z] = worldOf(px, py); const b = makeBlob(T, 0.7 + rnd() * 0.5, tones[i]); b.position.set(X, 0.25, Z); scene.add(b); blobs.push({ g: b, phase: rnd() * 6, speed: 1.5 + rnd() * 1.5, cx: X, cz: Z, r: 0.6 + rnd() * 0.8, w: 0.15 + rnd() * 0.2 }); });
      const sun = new T.DirectionalLight(0xffd9b0, 2.2); sun.position.set(-6, 3, 4); scene.add(sun);
      scene.add(new T.AmbientLight(0x40506a, 0.5));
      const ff = []; for (let i = 0; i < 6; i++) { const f = new T.Mesh(new T.SphereGeometry(0.025, 6, 6), new T.MeshBasicMaterial({ color: 0xffe9a8, transparent: true })); f.position.set(2 + rnd() * 3, 0.4 + rnd() * 0.5, -1 + rnd() * 2); scene.add(f); ff.push({ m: f, p: rnd() * 6 }); }
      let az = 0, dragging = false, lastX = 0, azV = 0;
      this.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; this.setPointerCapture(e.pointerId); this.style.cursor = 'grabbing'; });
      this.addEventListener('pointermove', e => { if (!dragging) return; azV += (e.clientX - lastX) * 0.0006; lastX = e.clientX; });
      this.addEventListener('pointerup', () => { dragging = false; this.style.cursor = 'grab'; });
      let t = 0;
      const tick = () => {
        this._raf = requestAnimationFrame(tick); t += 0.016;
        az += azV; azV *= 0.92;
        cam.position.set(Math.sin(az) * 7.5, 2.4 + Math.sin(t * 0.3) * 0.06, Math.cos(az) * 7.5);
        cam.lookAt(0, 0.3, 0);
        blobs.forEach(b => { b.g.position.y = 0.22 + Math.abs(Math.sin(t * b.speed + b.phase)) * 0.13; const wa = t * b.w + b.phase; b.g.position.x = b.cx + Math.cos(wa) * b.r; b.g.position.z = b.cz + Math.sin(wa) * b.r; b.g.rotation.y = -wa + Math.PI / 2; });
        // growth: age climbs 0->3 (sprout, fern, tree), holds, then softly resets
        plants.forEach(p => {
          const cyc = (t * p.rate + p.offset) % 5.2;
          const age = Math.min(cyc, 3.4);
          const fade = cyc > 4.7 ? 1 - (cyc - 4.7) / 0.5 : 1;
          p.s0.scale.setScalar(Math.max(0.001, sstep(age) * (age > 1.6 ? Math.max(0.3, 1 - (age - 1.6)) : 1) * fade));
          p.s1.scale.setScalar(Math.max(0.001, sstep(age - 1) * fade));
          p.s2.scale.setScalar(Math.max(0.001, sstep((age - 2) / 1.2) * fade));
        });
        ff.forEach(f => { f.m.position.y = 0.45 + Math.sin(t * 1.3 + f.p) * 0.15; f.m.material.opacity = 0.5 + Math.sin(t * 2 + f.p) * 0.5; });
        renderer.render(scene, cam);
      };
      tick();
    } catch (err) { this.innerHTML = '<div style="color:#7fd8e8;font:12px monospace;padding:40px">3D failed to load: ' + err.message + '</div>'; }
  }
  disconnectedCallback() { cancelAnimationFrame(this._raf); this._renderer?.dispose(); }
}
customElements.define('orbi-surface-3d', OrbiSurface3D);
