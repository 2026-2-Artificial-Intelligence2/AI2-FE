import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

// Rigged Meshy characters (3d-assets/models/optimized-test). All share one 20-bone skeleton;
// the boss (senior_worker) also has finger bones and grip.L/R sockets for the bat.
export const STAFF = [
  'young_worker', 'male_1_glasses', 'female_1_bob', 'male_2_hoodie',
  'female_2_ponytail', 'male_3_cardigan', 'female_3_jacket', 'male_4_plaid',
];
export const BOSS = 'senior_worker';
export const PLAYER = 'young_worker';

// The models are 1.9 m tall; the procedural cast they replace is about 1.7 m.
export const CHARACTER_SCALE = 0.9;

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();

function load(name) {
  if (!cache.has(name)) {
    const url = `${import.meta.env.BASE_URL}models/characters/${name}.glb`;
    cache.set(name, loader.loadAsync(url).then(gltf => ({
      scene: gltf.scene,
      clips: new Map(gltf.animations.map(clip => [clip.name.split(' | ').pop(), clip])),
    })));
  }
  return cache.get(name);
}

// A character that shows `fallback` (the procedural figure) until its GLB arrives, so the
// scene never waits on the network and still works if a model fails to load.
export function glbActor(name, fallback) {
  const root = new THREE.Group();
  root.add(fallback.root);
  const actor = { root, fallback, ready: false, mixer: null, actions: new Map(), current: null, model: null, onReady: [] };

  load(name).then(({ scene, clips }) => {
    if (actor.disposed) return;
    const model = SkeletonUtils.clone(scene);   // own skeleton, shared geometry and textures
    model.scale.setScalar(CHARACTER_SCALE);
    model.traverse(object => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        object.frustumCulled = false;            // skinned bounds do not follow the pose
      }
    });
    root.remove(fallback.root);
    root.add(model);
    actor.model = model;
    actor.mixer = new THREE.AnimationMixer(model);
    for (const [clipName, clip] of clips) actor.actions.set(clipName, actor.mixer.clipAction(clip));
    actor.clips = clips;
    actor.ready = true;
    actor.onReady.splice(0).forEach(callback => callback(actor));
  }).catch(error => console.warn(`character ${name} kept its fallback:`, error));

  actor.bone = boneName => actor.model?.getObjectByName(boneName.replace('.', '')) ?? null;

  // Cross-fade to a clip (looping) unless it is already playing.
  actor.play = (clipName, { fade = 0.25, timeScale = 1 } = {}) => {
    const next = actor.actions.get(clipName);
    if (!next) return null;
    next.timeScale = timeScale;
    if (actor.current === next) return next;
    next.reset().setEffectiveWeight(1).play();
    if (actor.current) actor.current.crossFadeTo(next, fade, false);
    actor.current = next;
    return next;
  };

  actor.whenReady = callback => (actor.ready ? callback(actor) : actor.onReady.push(callback));
  actor.dispose = () => {
    actor.disposed = true;
    actor.mixer?.stopAllAction();
  };
  return actor;
}

// A bat matching the one the swing was collision-checked with in Blender:
// 0.75 m, handle through the fist, barrel toward the grip socket's +Y.
export function makeBat() {
  const geometry = new THREE.CylinderGeometry(0.048, 0.02, 0.75, 16).translate(0, 0.3, 0);
  const bat = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xd6a164, roughness: 0.6 }));
  bat.castShadow = true;
  return bat;
}
