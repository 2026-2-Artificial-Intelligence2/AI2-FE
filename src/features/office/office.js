import * as THREE from 'three';
import {box} from '../../shared/scene/character.js';
import {BOSS, glbActor} from '../../shared/scene/glb-actor.js';
import {BOSS_DESK, OFFICE_SEATS as seats, STAFF} from '../../shared/scene/office-seats.js';
import {DESK_DROP, OFFICE_CENTER_X, OFFICE_HALF_DEPTH, OFFICE_LENGTH, SUN_PATH, furnish} from './furnishings.js';
import {fitDeskWorker} from './office-seating.js';
import {alongPath, bossPath, holdPhone, makePhone, makeSpeech, pathLength} from './office-boss.js';
import {turnListener} from '../../shared/audio/spatial-audio.js';
import {addMeetingWindow} from './office-meeting-window.js';
import {finishFloor, finishWalls} from './office-walls.js';
import {dayCurve} from './window-sky.js';

// The sun sets before quitting time, so its light and shadows are gone by night.
const SUN_INTENSITY = [[0, 2.0], [0.3, 2.35], [0.6, 2.1], [0.8, 1.3], [0.92, 0], [1, 0]];
const SUN_COLOR = [[0, [1, 0.9, 0.78]], [0.3, [1, 0.92, 0.8]], [0.6, [1, 0.86, 0.68]], [0.8, [1, 0.66, 0.42]], [1, [0.72, 0.68, 0.85]]];
const SKY_INTENSITY = [[0, 2.65], [0.3, 2.8], [0.7, 2.6], [1, 2.0]];
import {makeVoiceTextures, voiceArcCount} from './office-voice.js';

let scene, camera, renderer, boss, bossPhone, bossSpeech, phoneAmount = 0, latest, canvas, meetingWindow, updateSky, sun, sky;
let timeOfDay;
let yaw=0, pitch=0, self=-1;
let focus = false;
let monitorFrameDrawn = false;
let transition = { from: 0, to: 0, started: 0 };
const focusDuration = 820;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function focusProgress(now) {
  const progress = reduceMotion ? 1 : THREE.MathUtils.clamp((now - transition.started) / focusDuration, 0, 1);
  return THREE.MathUtils.lerp(transition.from, transition.to, progress * progress * (3 - 2 * progress));
}
const workers=[];
let participants=[];
let micLevels, voiceTextures;
let width=0, height=0;
export function setOfficePlayers(players) { participants = players; }
export function setOfficeMicLevels(levels) { micLevels = levels; }

function init() {
  renderer = new THREE.WebGLRenderer({canvas,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.18;   // a bright, airy office
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9e5da);
  camera = new THREE.PerspectiveCamera(68,1,0.06,45);
  camera.rotation.order='YXZ';
  // Brighter sky light makes up for the sun now reaching the room only through the windows.
  sky=new THREE.HemisphereLight(0xffe6cc,0xbeb2a7,2.65);
  scene.add(sky);
  sun=new THREE.DirectionalLight(0xffdfb4,2.15);
  sun.target.position.set(OFFICE_CENTER_X, 0, 0);
  scene.add(sun.target);
  sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);
  // Wide enough to hold the whole office from any point on the sun's path.
  Object.assign(sun.shadow.camera,{left:-12,right:12,top:10,bottom:-10,far:40});
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.intensity=0.82;
  sun.shadow.normalBias=0.022;
  scene.add(sun);
  const unfinishFloor = finishFloor(box(scene,[OFFICE_LENGTH,0.1,OFFICE_HALF_DEPTH*2+0.2],[OFFICE_CENTER_X,-0.05,0],0xb8a58e));
  const furniture = furnish(scene, () => { monitorFrameDrawn = false; });
  const { dressDesk } = furniture;
  furniture.addBossDesk(BOSS_DESK.x, BOSS_DESK.z);
  updateSky = furniture.updateSky;
  meetingWindow=addMeetingWindow(scene);
  // Inner faces of the walls; the west wall is solid only south of the meeting-room glass.
  const unfinishWalls = finishWalls(scene, {
    west: -6.83, east: 8.05, north: -OFFICE_HALF_DEPTH + 0.075, south: OFFICE_HALF_DEPTH - 0.075, westSolid: [0.3, OFFICE_HALF_DEPTH - 0.075],
  });
  voiceTextures=makeVoiceTextures();
  for (const [i,[x,z]] of seats.entries()) {
    const forward=-Math.sign(z);
    const fitChair = dressDesk(x,z,i);
    const person=glbActor(STAFF[i]);
    person.fitChair = fitChair;
    person.root.position.set(x,0,z);
    person.root.rotation.y=forward===1?0:Math.PI;
    const voice = new THREE.Sprite(new THREE.SpriteMaterial({
      map: voiceTextures[0], depthWrite: false, toneMapped: false,
    }));
    voice.position.set(0, 1.68, 0.035);
    voice.scale.set(0.49, 0.33, 1);
    voice.center.set(0.5, 0);
    voice.visible = false;
    person.root.add(voice);
    person.voice = voice;
    workers.push(person);
    scene.add(person.root);
  }
  boss=glbActor(BOSS);
  bossPhone=makePhone(boss.root);
  bossSpeech=makeSpeech(boss.root);
  scene.add(boss.root);
  return { ...furniture, dispose() { furniture.dispose(); unfinishWalls(); unfinishFloor(); } };
}

// Rigged staff sit at their desks; a slow head sway keeps them from looking frozen.
function poseWorker(person, name, time, dt) {
  if (!person.ready) return;
  const seated = person.play('Sit (desk)', { fade: 0 });
  person.mixer.update(dt);
  if (seated) {
    person.seatedArms ??= fitDeskWorker(person, name);
    const gesture = person.deskGesture ??= {start: time + 4 + Math.random() * 5, hand: 0};
    const duration = 0.42;
    if (time > gesture.start + duration) {
      gesture.start = time + 4 + Math.random() * 5;
      gesture.hand = Math.random() < 0.5 ? 0 : 1;
    }
    const elapsed = (time - gesture.start) / duration;
    const amount = reduceMotion || elapsed <= 0 ? 0 : Math.sin(elapsed * Math.PI) ** 2 * 0.55;
    for (const [joint, resting, tapping, hand] of person.seatedArms) {
      joint.quaternion.copy(resting).slerp(tapping, hand === gesture.hand ? amount : 0);
    }
  }
  const head = person.bone('head');
  if (head) {
    // Sway from the seated head pose captured once; the clip may not key the head every frame,
    // so rotating the live quaternion would accumulate and spin the head.
    head.userData.seated ??= head.quaternion.clone();
    head.quaternion.copy(head.userData.seated);
    head.rotateY(0.085 * Math.sin(time * 0.55));
    head.rotateZ(0.042 * Math.sin(time * 0.73));
  }
}

// The boss's walk cycle covers about 0.48 m/s at normal speed; match it to the step length
// so the feet do not slide, and alternate a plain walk with a look-around walk.
const BOSS_WALK_SPEED = 0.48;
let bossBeat = 0, bossBeatStarted;
function poseBoss(walking, path, beatStarted, dt, seated, phone) {
  if (!boss.ready) return;
  if (seated) {
    boss.play('Sit (desk)', { fade: 0.35 });
    boss.mixer.update(dt);
    phoneAmount = 0;
    holdPhone(boss, bossPhone.phone, 0);
    return;
  }
  if (beatStarted !== bossBeatStarted) {
    bossBeatStarted = beatStarted;
    bossBeat += 1;
  }
  if (walking) {
    const timeScale = THREE.MathUtils.clamp(pathLength(path) / 2 / BOSS_WALK_SPEED, 0.6, 1.8);
    // 휴대폰을 볼 때는 두리번거리지 않는다.
    boss.play(!phone && bossBeat % 3 === 2 ? 'Walk look around (loop)' : 'Walk (loop)', { fade: 0.3, timeScale });
  } else {
    boss.play('Stand (idle)', { fade: 0.35 });
  }
  boss.mixer.update(dt);
  // 걸으면서 매매할 때는 휴대폰을 꺼내 보며 중얼거린다(서버가 혼잣말을 보내는 동안).
  phoneAmount = reduceMotion ? Number(phone) : THREE.MathUtils.damp(phoneAmount, phone ? 1 : 0, 6, dt);
  holdPhone(boss, bossPhone.phone, phoneAmount);
}

export function updateOffice(context) {
  latest=context;
}

let lastDraw;
function draw(now) {
  if (!latest) return;
  const dt = lastDraw === undefined ? 0 : Math.min(0.1, (now - lastDraw) / 1000);
  lastDraw = now;
  const {packet, beatStarted, meetingStarts, seatLabels, youLabel, roundSeconds} = latest;
  const {step,walking} = packet;
  const meeting = meetingStarts.values().next().value;
  const meetingCharacters = new Set([...meetingStarts.values()].map(entry => entry.character));
  meetingWindow.update(meeting, now);
  const {position,forwardZ}=step.listener;
  self=seats.findIndex(([x,z])=>position.x===x && position.z===z);
  const w=canvas.clientWidth,h=canvas.clientHeight;
  const zoom = focusProgress(now);
  if (zoom === 1 && monitorFrameDrawn && w === width && h === height) return;
  monitorFrameDrawn = zoom === 1;
  const elapsed = roundSeconds > 0 ? 1 - packet.remainingSeconds / roundSeconds : 0;
  const daylight = THREE.MathUtils.clamp(elapsed, 0, 1);
  timeOfDay = timeOfDay === undefined || Math.abs(daylight - timeOfDay) < 0.001
    ? daylight : THREE.MathUtils.lerp(timeOfDay, daylight, 0.08);
  updateSky(timeOfDay);
  // Sun and sky follow the window view: bright midday, golden sunset, dusk at quitting time,
  // when the ceiling lamps take over.
  const [sx, sy, sz] = dayCurve(timeOfDay, SUN_PATH);
  sun.position.set(OFFICE_CENTER_X + sx, sy, sz);   // the light and shadows travel across the room
  sun.intensity = dayCurve(timeOfDay, SUN_INTENSITY);
  sun.color.setRGB(...dayCurve(timeOfDay, SUN_COLOR));
  sky.intensity = dayCurve(timeOfDay, SKY_INTENSITY);
  if (w && h && (w!==width || h!==height)) {
    width=w; height=h;
    renderer.setSize(w,h,false);
    camera.aspect=w/h;camera.updateProjectionMatrix();
  }
  camera.position.set(position.x, 1.4 - (0.24 + DESK_DROP) * zoom, position.z + forwardZ * 0.45 * zoom);
  camera.rotation.set(pitch * (1 - zoom) - 0.27 * zoom, (forwardZ === 1 ? Math.PI : 0) + yaw * (1 - zoom), 0, 'YXZ');
  // 세로 화면(휴대폰)에서는 같은 세로 시야로는 옆이 거의 안 보인다. 가로 시야가 약 50°가 되도록 세로 시야를 넓힌다(최대 90°).
  const baseFov = camera.aspect >= 1 ? 68
    : Math.min(90, Math.max(68, 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(25)) / camera.aspect))));
  const fov = baseFov - zoom * (baseFov - 28);
  if (fov !== camera.fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  // Room membership can shrink after the match begins. Use the original seat order.
  const knowSeats = self >= 0 && youLabel && seatLabels[self] === youLabel;
  workers.forEach((person,i)=>{
    const label = knowSeats ? seatLabels[i] : undefined;
    person.root.visible = person.ready && i !== self &&
      !meetingStarts.has(label) && !meetingCharacters.has(STAFF[i]);
    const count = zoom < 1 && person.root.visible && label ? voiceArcCount(micLevels?.[label] ?? 0) : 0;
    person.voice.visible = count > 0;
    if (count) person.voice.material.map = voiceTextures[count - 1];
    poseWorker(person, STAFF[i], now/1000+i*1.23+(i<participants.length?0:2), dt);
  });
  const t=walking?Math.min(1,(now-beatStarted)/2000):1;
  // 자리에 앉아 있으면(순찰 사이) 책상에서 직원들 쪽을 보고 앉는다. 서버가 atDesk를 보내지 않으면 예전처럼 선다.
  const seated = Boolean(packet.boss?.atDesk) && !walking;
  if (seated) {
    boss.root.position.set(BOSS_DESK.x, 0, BOSS_DESK.z);
    boss.root.rotation.y = BOSS_DESK.facing;
  }
  const path = bossPath(step.from, step.to);
  if (!seated) {
    const spot = alongPath(path, t);
    boss.root.position.set(spot.x, 0, spot.z);
    if (walking && spot.heading !== null) boss.root.rotation.y = spot.heading;
  }
  // Until the server publishes actual boss presence, avoid showing a stationary boss during lunch.
  boss.root.visible=boss.ready && meeting === undefined &&
    (walking || !(packet.lunchStartsInSeconds<=0 && packet.lunchEndsInSeconds>0));
  const line = packet.boss?.line;
  poseBoss(walking && t<1, path, beatStarted, dt, seated, Boolean(line) && !seated);
  bossSpeech.update(boss.root.visible && zoom < 1 ? line : null, seated ? 1.62 : 1.95);
  renderer.render(scene,camera);
}

export function mountOffice(element) {
  canvas = element;
  width = height = 0;
  timeOfDay = undefined;
  yaw = pitch = 0;
  focus = false;
  monitorFrameDrawn = false;
  lastDraw = undefined;
  transition = { from: 0, to: 0, started: performance.now() };
  const furniture = init();
  renderer.setAnimationLoop(draw);
  return () => {
    renderer.setAnimationLoop(null);
    furniture.dispose();
    scene.traverse(object => {
      if (object.isDirectionalLight) object.shadow.dispose();
      if (object.userData.disposeWithOffice) {
        object.geometry.dispose();
        object.material.map?.dispose();
        object.material.dispose();
      }
    });
    workers.forEach(person => { person.voice.material.dispose(); person.dispose(); });
    boss.dispose();
    bossPhone.dispose();
    bossSpeech.dispose();
    meetingWindow.dispose();
    voiceTextures.forEach(texture => texture.dispose());
    renderer.dispose();
    renderer.forceContextLoss();
    renderer = latest = null;
    workers.length = 0;
    turnListener(0);
  };
}

export function setOfficeFocus(next) {
  if (next === focus) return;
  const now = performance.now();
  const from = focusProgress(now);
  if (!next && from > 0.95) {
    yaw = 0.27;
    pitch = 0.07;
  }
  focus = next;
  transition = { from, to: next ? 1 : 0, started: now };
  turnListener(next ? 0 : yaw);
}

export function turnOffice(dx, dy) {
  if (focus) return;
  yaw = THREE.MathUtils.clamp(yaw - dx * 0.007, -2.35, 2.35);
  pitch = THREE.MathUtils.clamp(pitch - dy * 0.006, -0.7, 0.65);
  turnListener(yaw);
}
