import * as THREE from 'three';
import { createMeetingPerformance, furnishMeetingRoom } from './meeting-performance.js';

export function mountMeetingScene(canvas, started = performance.now()) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb9c5d3);
  scene.add(new THREE.HemisphereLight(0xe1ecff, 0x8d7c83, 2.5));
  const key = new THREE.DirectionalLight(0xffead0, 2.35);
  key.position.set(-2.4, 4.2, 3.1);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.normalBias = 0.022;
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 4, bottom: -4, far: 16 });
  scene.add(key);

  furnishMeetingRoom(scene);
  const animate = createMeetingPerformance(scene);
  const camera = new THREE.PerspectiveCamera(39, 1, 0.05, 32);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width = 0;
  let height = 0;
  function draw() {
    const elapsed = (performance.now() - started) / 1000;
    const burst = animate(elapsed, reducedMotion);
    const shake = burst * Math.sin(elapsed * 68);
    camera.position.set(1.06 + shake * 0.036, 1.52 + burst * 0.02, 5.02);
    camera.lookAt(-0.16, 0.86, 0.06);
    renderer.render(scene, camera);
  }
  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h || (w === width && h === height)) return;
    width = w;
    height = h;
    camera.aspect = w / h;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(19.5)) * Math.max(1, 1 / camera.aspect)));
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    draw();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  renderer.setAnimationLoop(draw);
  return () => {
    observer.disconnect();
    renderer.setAnimationLoop(null);
    key.shadow.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  };
}
