import * as THREE from 'three';
import {BOSS_DESK} from '../../shared/scene/office-seats.js';
import {fitArm} from './office-seating.js';

// 부장님 자리 드나들기, 걸으며 휴대폰 보기, 머리 위 혼잣말 말풍선.

// 의자에서 통로로 곧장 가면 동쪽 책상(x -5.02~-4.28, z ±0.92)을 뚫는다. 책상 남쪽으로 돌아 나간다.
const DESK_DETOUR = [{x: BOSS_DESK.x, z: 1.25}, {x: -4.0, z: 1.25}];
const atDesk = point => Math.abs(point.x - BOSS_DESK.x) < 0.01 && Math.abs(point.z - BOSS_DESK.z) < 0.01;

/** 이번 걸음의 경로(꺾이는 점 목록). 자리에서 나가거나 들어올 때만 책상을 돌아간다. */
export function bossPath(from, to) {
  if (atDesk(from) && !atDesk(to)) return [from, ...DESK_DETOUR, to];
  if (atDesk(to) && !atDesk(from)) return [from, ...[...DESK_DETOUR].reverse(), to];
  return [from, to];
}

export function pathLength(path) {
  let length = 0;
  for (let i = 1; i < path.length; i++) length += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
  return length;
}

/** 경로의 t(0~1) 지점과 그때 향하는 방향. */
export function alongPath(path, t) {
  const total = pathLength(path);
  let left = THREE.MathUtils.clamp(t, 0, 1) * total;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (left <= length || i === path.length - 1) {
      const k = length ? Math.min(1, left / length) : 1;
      return {x: THREE.MathUtils.lerp(a.x, b.x, k), z: THREE.MathUtils.lerp(a.z, b.z, k),
        heading: length ? Math.atan2(b.x - a.x, b.z - a.z) : null};
    }
    left -= length;
  }
  return {x: path[0].x, z: path[0].z, heading: null};
}

/** 오른손에 든 휴대폰. 걸으면서 매매하고 중얼거릴 때만 꺼내 든다. */
export function makePhone(root) {
  const phone = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.17, 0.012),
    new THREE.MeshStandardMaterial({color: 0x1f2430, roughness: 0.4, metalness: 0.3}));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.155),
    new THREE.MeshBasicMaterial({color: 0x9fd3ff, toneMapped: false}));
  screen.position.z = 0.0065;
  body.castShadow = true;
  phone.add(body, screen);
  phone.visible = false;
  root.add(phone);
  return {
    phone,
    dispose() { body.geometry.dispose(); body.material.dispose(); screen.geometry.dispose(); screen.material.dispose(); },
  };
}

const HOLD = new THREE.Vector3(-0.13, 1.13, 0.3);       // 가슴 앞, 오른쪽(부장님 기준 x가 -면 오른쪽)
const ELBOW = new THREE.Vector3(-0.26, 0.98, 0.02);
const EYES = new THREE.Vector3(0, 1.45, 0.15);
/** 주먹 한가운데에서 휴대폰 가운데까지(눈 쪽, 안쪽, 위로). */
export const PHONE_INSET = {toward: 0.05, side: 0.015, up: 0.025};

/**
 * 걷는 동작 위에 휴대폰 보는 팔과 고개를 얹는다. amount 0이면 그대로 걷고 1이면 화면을 들여다본다.
 * mixer.update 뒤에 매 프레임 부른다(동작이 관절을 다시 쓰므로 누적되지 않는다).
 */
const restored = new Map();   // 관절 → {base, set}: 동작이 이 관절을 키로 갖지 않으면 지난 프레임 결과가 남는다.
function restore(joint) {
  const last = restored.get(joint);
  if (last && joint.quaternion.equals(last.set)) joint.quaternion.copy(last.base);
  return joint.quaternion.clone();
}
function remember(joint, base) {
  restored.set(joint, {base, set: joint.quaternion.clone()});
}

export function holdPhone(boss, phone, amount) {
  const joints = ['upper_arm.R', 'forearm.R', 'hand.R', 'head'].map(name => boss.bone(name));
  const bases = joints.map(joint => joint && restore(joint));
  joints.forEach((joint, i) => joint && remember(joint, bases[i]));
  phone.visible = amount > 0.05;
  if (!phone.visible || joints.some(joint => !joint)) { phone.visible = false; return; }
  const head = joints.pop();
  boss.root.updateMatrixWorld(true);
  const walking = joints.map(joint => joint.quaternion.clone());
  const target = boss.root.localToWorld(HOLD.clone());
  const toward = new THREE.Vector3(0, 0.25, 1).normalize().transformDirection(boss.root.matrixWorld);
  fitArm(...joints, target, toward, boss.root.localToWorld(ELBOW.clone()));
  const holding = joints.map(joint => joint.quaternion.clone());
  joints.forEach((joint, i) => joint.quaternion.slerpQuaternions(walking[i], holding[i], amount));
  head.rotateX(0.32 * amount);    // 고개를 숙여 화면을 본다
  [...joints, head].forEach((joint, i) => remember(joint, bases[i]));
  boss.root.updateMatrixWorld(true);

  // 주먹 안쪽(눈 쪽)에 세워 쥔다: 아랫부분은 손가락이 감싸고, 화면은 똑바로 서서 눈을 향한다.
  // grip은 방망이를 쥐는 자리(주먹 한가운데)다.
  const grip = boss.bone('grip.R') ?? joints[2];
  const fist = boss.root.worldToLocal(grip.getWorldPosition(new THREE.Vector3()));
  const facing = EYES.clone().sub(fist).normalize();
  phone.position.copy(fist).addScaledVector(facing, PHONE_INSET.toward).add(new THREE.Vector3(PHONE_INSET.side, PHONE_INSET.up, 0));
  const screenOut = EYES.clone().sub(phone.position).normalize();
  const sideways = new THREE.Vector3(0, 1, 0).cross(screenOut).normalize();
  const upright = screenOut.clone().cross(sideways);
  phone.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(sideways, upright, screenOut));
  phone.scale.setScalar(Math.min(1, amount * 1.5));
}

/** 머리 위 혼잣말 말풍선(캔버스 글자). 글이 바뀔 때만 다시 그린다. */
export function makeSpeech(root) {
  const canvas = document.createElement('canvas');
  let texture = null;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({depthTest: false, depthWrite: false, toneMapped: false}));
  sprite.center.set(0.5, 0);
  sprite.renderOrder = 10;
  sprite.visible = false;
  root.add(sprite);
  let shown = null;

  function paint(text) {
    const scale = 2, font = `700 ${15 * scale}px system-ui, -apple-system, "Apple SD Gothic Neo", sans-serif`;
    const context = canvas.getContext('2d');
    context.font = font;
    // 한 줄 최대 14자 남짓, 두 줄까지.
    const words = [...text];
    const lines = [];
    let current = '';
    for (const char of words) {
      if (context.measureText(current + char).width > 200 * scale && current) { lines.push(current); current = ''; }
      current += char;
    }
    lines.push(current);
    if (lines.length > 2) lines.splice(2, lines.length, lines[1].slice(0, -1) + '…');
    const padX = 14 * scale, padY = 9 * scale, lineHeight = 21 * scale, tail = 9 * scale;
    const textWidth = Math.max(...lines.map(line => context.measureText(line).width));
    canvas.width = Math.ceil(textWidth + padX * 2);
    canvas.height = Math.ceil(lines.length * lineHeight + padY * 2 + tail);
    const w = canvas.width, h = canvas.height - tail, r = 12 * scale;
    context.font = font;
    // 심플하게: 흰 말풍선, 옅은 회색 테두리, 진한 글자.
    context.fillStyle = '#ffffff';
    context.strokeStyle = 'rgba(15,23,42,0.18)';
    context.lineWidth = 1.5 * scale;
    context.beginPath();
    context.roundRect(scale, scale, w - 2 * scale, h - 2 * scale, r);
    context.moveTo(w / 2 - tail, h - scale);
    context.lineTo(w / 2, h + tail - scale);
    context.lineTo(w / 2 + tail, h - scale);
    context.fill();
    context.stroke();
    context.fillStyle = '#ffffff';
    context.fillRect(w / 2 - tail + scale, h - 3 * scale, tail * 2 - 2 * scale, 3 * scale);
    context.fillStyle = '#111827';
    context.textBaseline = 'middle';
    lines.forEach((line, i) => context.fillText(line, padX, padY + lineHeight * (i + 0.5)));
    // 캔버스 크기가 바뀌면 GPU 텍스처도 새로 만들어야 예전 글자가 남지 않는다.
    texture?.dispose();
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    sprite.material.map = texture;
    sprite.material.needsUpdate = true;
    // 월드 크기: 한 줄 높이 약 0.15 m(멀리 있어도 읽히게).
    const metres = 0.15 / lineHeight;
    sprite.scale.set(canvas.width * metres, canvas.height * metres, 1);
  }

  return {
    update(text, height) {
      sprite.visible = Boolean(text);
      if (!text) return;
      if (text !== shown) { paint(text); shown = text; }
      sprite.position.set(0, height, 0);
    },
    dispose() { texture?.dispose(); sprite.material.dispose(); },
  };
}
