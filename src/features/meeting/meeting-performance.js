import * as THREE from 'three';
import { box, character, characterHead, defaultLook, oval } from '../../shared/scene/character.js';
import { BOSS, PLAYER, glbActor, makeBat } from '../../shared/scene/glb-actor.js';

const impacts = [0.95, 2.05, 3.20];
const frame = 0x445469;
const skin = defaultLook.skin;
const up = new THREE.Vector3(0, 1, 0);

function capsule(parent, from, to, radius, color) {
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const direction = end.clone().sub(start);
  const centre = start.addScaledVector(direction, 0.5);
  const mesh = oval(parent, [radius, direction.length() / 2 + radius * 0.4, radius], centre.toArray(), color);
  mesh.quaternion.setFromUnitVectors(up, direction.normalize());
  return mesh;
}

function bentPlayer(scene) {
  const root = new THREE.Group();
  root.position.set(0.06, 0, 0.82);
  scene.add(root);
  const hips = [-0.38, 0.86, 0];
  const shoulders = [0.38, 0.47, 0];
  capsule(root, hips, shoulders, 0.17, 0x7299b3);
  oval(root, [0.16, 0.13, 0.16], hips, 0x34455e);
  for (const side of [-1, 1]) {
    const z = side * 0.15;
    capsule(root, [hips[0], hips[1], z * 0.65], [-0.96, 0.1, z], 0.082, 0x34455e);
    oval(root, [0.125, 0.052, 0.074], [-1.02, 0.055, z], 0x343437);
    capsule(root, [0.34, 0.49, z], [0.71, 0.07, z * 1.2], 0.065, 0x7299b3);
    oval(root, [0.094, 0.035, 0.058], [0.76, 0.043, z * 1.2], skin);
  }
  const head = characterHead({ hairId: 'crop', hairColor: 0x685043, expression: 'worried' });
  head.position.set(0.59, 0.43, 0);
  head.rotation.set(0.22, 0.58, -0.56);
  head.scale.multiplyScalar(0.88);
  root.add(head);
  return root;
}

export function furnishMeetingRoom(scene, front = 5) {
  const depth = front + 2.9;
  const centreZ = (front - 2.9) / 2;
  box(scene, [9, 0.1, depth], [0, -0.06, centreZ], 0x61768b);
  box(scene, [8.9, 3.5, 0.14], [0, 1.75, -2.9], 0xd6dee7);
  box(scene, [8.9, 0.13, 0.15], [0, 0.06, -2.81], frame);
  box(scene, [0.14, 3.5, depth], [-4.4, 1.75, centreZ], 0xc6d2dc);
  box(scene, [2.6, 2.45, 0.09], [-2.45, 1.63, -2.78], frame);
  for (const x of [-3.04, -1.86]) {
    box(scene, [1.13, 2.29, 0.04], [x, 1.63, -2.71], 0xa3bed0);
    box(scene, [1.13, 0.44, 0.05], [x, 1.56, -2.68], 0xcadce5);
  }
  box(scene, [2.66, 1.26, 0.08], [1.56, 2.04, -2.77], frame);
  box(scene, [2.51, 1.12, 0.03], [1.56, 2.04, -2.71], 0xf4f1e8);
  box(scene, [2.26, 0.035, 0.16], [1.56, 1.43, -2.62], 0x778aa0);
  for (const x of [-2.3, -1.2]) {
    box(scene, [0.10, 0.84, 0.49], [x, 0.42, -0.88], frame);
  }
  box(scene, [1.48, 0.10, 0.72], [-1.75, 0.88, -0.88], 0xc49c75);
  box(scene, [3.25, 0.018, 1.55], [0, 0.004, 0.77], 0xa1acbf);
}

function breakable(scene, position, build, colors, spread) {
  const intact = new THREE.Group();
  intact.position.set(...position);
  scene.add(intact);
  build(intact);
  const fragments = Array.from({ length: 9 }, (_, index) => {
    const angle = index * 2.4;
    const size = (0.055 + (index % 3) * 0.025) * spread;
    const mesh = box(scene, [size, size * 0.58, size * 0.44], position, colors[index % colors.length]);
    mesh.visible = false;
    return { mesh, angle, size, lift: 1.4 + (index % 4) * 0.6, speed: spread * (0.42 + (index % 3) * 0.43) };
  });
  return elapsed => {
    intact.visible = elapsed < 0;
    for (const fragment of fragments) {
      const { mesh, angle, size, lift, speed } = fragment;
      mesh.visible = !intact.visible;
      if (!mesh.visible) continue;
      const floor = size * 0.32;
      const landing = (lift + Math.sqrt(lift * lift + 13 * (position[1] - floor))) / 6.5;
      const time = Math.min(elapsed, landing);
      mesh.position.set(position[0] + Math.cos(angle) * speed * time,
        position[1] + lift * time - 3.25 * time * time,
        position[2] + Math.sin(angle) * speed * time);
      mesh.rotation.set(time * (4 + angle), time * angle, time * 8);
    }
  };
}

function breakables(scene) {
  const cup = breakable(scene, [-2.05, 1.09, -0.65], group => {
    oval(group, [0.145, 0.165, 0.145], [0, 0, 0], 0xf4e3be);
    oval(group, [0.118, 0.022, 0.118], [0, 0.15, 0], 0x7b563e);
    box(group, [0.095, 0.105, 0.045], [-0.145, 0.025, 0], 0xf4e3be);
  }, [0xf4e3be, 0xead29d], 0.9);
  const clipboard = breakable(scene, [-1.44, 1.22, -0.55], group => {
    box(group, [0.49, 0.58, 0.045], [0, 0, 0], 0xbd8559);
    box(group, [0.39, 0.46, 0.025], [0, 0, 0.034], 0xf4eee2);
    box(group, [0.20, 0.065, 0.042], [0, 0.22, 0.044], frame);
    for (const y of [-0.09, 0.02, 0.13]) box(group, [0.25, 0.025, 0.014], [0, y, 0.053], 0xb7c3d0);
    group.rotation.z = -0.1;
  }, [0xf4eee2, 0xc49c75, frame], 1.25);
  const chair = breakable(scene, [1.92, 0.49, -0.07], group => {
    box(group, [0.53, 0.11, 0.48], [0, -0.02, 0], 0x7189ac);
    box(group, [0.55, 0.52, 0.11], [0, 0.24, -0.21], 0x7189ac);
    for (const x of [-0.20, 0.20]) {
      for (const z of [-0.18, 0.18]) box(group, [0.075, 0.42, 0.075], [x, -0.27, z], frame);
    }
    group.rotation.y = -0.2;
  }, [0x7189ac, frame], 1.65);
  return [cup, clipboard, chair];
}

// Bat swing clip timing (30 fps): the bat lands on frame 23.
const STRIKE_AT = 23 / 30;
const SWING_BLEND = 0.12;

// Drive the boss's bat swing from the meeting clock: each impact plays the swing so its
// strike frame lands on the impact, cross-fading from the previous swing (or the hold pose).
function swingBoss(actor, elapsed, reducedMotion) {
  if (!actor.swingPair) {
    const clip = actor.clips.get('Bat swing');
    actor.swingPair = [actor.mixer.clipAction(clip), actor.mixer.clipAction(clip.clone())];
    actor.hold = actor.actions.get('Bat hold (idle)');
    for (const action of [...actor.swingPair, actor.hold]) action.setLoop(THREE.LoopOnce, 1).play();
    actor.swingPair.forEach(action => { action.clampWhenFinished = true; });
    actor.hold.setLoop(THREE.LoopRepeat, Infinity);
  }
  const [a, b] = actor.swingPair;
  const duration = a.getClip().duration;
  const starts = impacts.map(impact => impact - STRIKE_AT);
  let k = -1;
  if (!reducedMotion) starts.forEach((start, index) => { if (elapsed >= start) k = index; });
  const weights = new Map([[a, 0], [b, 0], [actor.hold, 0]]);
  if (k < 0) {
    weights.set(actor.hold, 1);
  } else {
    const current = k % 2 ? b : a;
    current.time = Math.min(elapsed - starts[k], duration);
    const blend = THREE.MathUtils.clamp((elapsed - starts[k]) / SWING_BLEND, 0, 1);
    weights.set(current, blend);
    if (k > 0) {
      const previous = k % 2 ? a : b;
      previous.time = Math.min(elapsed - starts[k - 1], duration);
      weights.set(previous, 1 - blend);
    } else {
      weights.set(actor.hold, 1 - blend);
    }
  }
  for (const [action, weight] of weights) {
    action.enabled = true;
    action.setEffectiveWeight(weight);
  }
  actor.mixer.update(0);
}

export function createMeetingPerformance(scene) {
  const props = breakables(scene);
  const bent = bentPlayer(scene);
  scene.remove(bent);
  const player = glbActor(PLAYER, { root: bent });
  scene.add(player.root);
  const boss = glbActor(BOSS, character({ topId: 'jacket', topColor: 0x34464d, accessoryId: 'glasses' }, false));
  boss.root.position.set(-0.65, 0, -0.38);
  boss.root.rotation.y = 0.22;
  scene.add(boss.root);
  const bat = new THREE.Group();
  oval(bat, [0.042, 0.23, 0.042], [0, 0.17, 0], 0x855a39);
  oval(bat, [0.083, 0.48, 0.083], [0, 0.63, 0], 0xd6a164);
  oval(bat, [0.066, 0.023, 0.066], [0, 0.03, 0], 0x855a39);
  scene.add(bat);
  const hit = new THREE.Group();
  hit.position.set(-0.28, 0.96, 0.76);
  for (let index = 0; index < 7; index++) {
    const angle = index * Math.PI * 2 / 7;
    const ray = box(hit, [0.19, 0.037, 0.034], [Math.cos(angle) * 0.25, Math.sin(angle) * 0.25, 0], 0xffca54);
    ray.rotation.z = angle;
    ray.castShadow = false;
  }
  scene.add(hit);
  const windup = new THREE.Vector3(-0.48, 0.83, -0.29).normalize();
  const strike = new THREE.Vector3();
  const direction = new THREE.Vector3();

  // Once both rigged models are in: give the boss a real bat in his fist, lay the player in
  // the plank, and put the player's backside (and the hit burst) where the bat actually lands.
  let staged = false;
  function stage() {
    if (staged || !boss.ready || !player.ready) return;
    staged = true;
    bat.visible = false;
    const grip = boss.bone('grip.R');
    const realBat = makeBat();
    grip.add(realBat);
    player.model.rotation.y = Math.PI / 2;          // head toward +X, like the procedural pose
    player.play('Plank hips up (엎드려뻗쳐)', { fade: 0 });
    player.mixer.update(0);
    swingBoss(boss, impacts[0], false);              // strike frame of the first swing
    scene.updateMatrixWorld(true);
    const landing = scene.worldToLocal(grip.localToWorld(new THREE.Vector3(0, 0.5, 0)));
    const hips = scene.worldToLocal(player.bone('hips').getWorldPosition(new THREE.Vector3()));
    player.root.position.x += landing.x - hips.x;
    player.root.position.z += landing.z - hips.z;
    hit.position.set(landing.x, landing.y, landing.z);
  }

  return (elapsed, reducedMotion) => {
    stage();
    let swing = 0;
    let burst = 0;
    impacts.forEach((impact, index) => {
      const offset = elapsed - impact;
      props[index](reducedMotion && offset >= 0 ? Infinity : offset);
      if (offset >= -0.32 && offset < 0.33) {
        swing = offset < 0 ? Math.pow(1 + offset / 0.32, 2.4) : Math.max(0, 1 - offset / 0.33);
      }
      if (offset >= 0 && offset < 0.19) burst = 1 - offset / 0.19;
    });
    if (reducedMotion) swing = 0;
    if (staged) {
      swingBoss(boss, elapsed, reducedMotion);
      player.mixer.update(0);
    } else {
      boss.fallback.poseMeeting(swing);
      boss.fallback.grip.getWorldPosition(bat.position);
      scene.worldToLocal(bat.position);
      strike.copy(hit.position).sub(bat.position).normalize();
      direction.lerpVectors(windup, strike, swing).normalize();
      bat.quaternion.setFromUnitVectors(up, direction);
    }
    player.root.scale.y = reducedMotion ? 1 : 1 - 0.11 * burst;
    hit.visible = !reducedMotion && burst > 0;
    hit.scale.setScalar(1.45 - burst * 0.42);
    return reducedMotion ? 0 : burst;
  };
}
