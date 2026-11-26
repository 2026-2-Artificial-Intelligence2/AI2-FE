import * as THREE from 'three';

export const defaultLook = Object.freeze({
  hairId: 'short', topId: 'shirt', topColor: 0x608398, accessoryId: 'none',
  skin: 0xdba580, hairColor: 0x362f32
});

const cube = new THREE.BoxGeometry();
const sphere = new THREE.SphereGeometry(1, 16, 12);
const glasses = new THREE.TorusGeometry(0.043,0.007,5,18);
const smile = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(
  new THREE.Vector3(-0.027,-0.060,0.151),
  new THREE.Vector3(0,-0.082,0.155),
  new THREE.Vector3(0.027,-0.060,0.151)
),8,0.0045,5,false);
const frown = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(
  new THREE.Vector3(-0.030,-0.076,0.151),
  new THREE.Vector3(0,-0.042,0.155),
  new THREE.Vector3(0.030,-0.076,0.151)
),8,0.0045,5,false);
const materials = new Map();

function part(parent, geometry, scale, position, color) {
  if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({color, roughness: 0.82}));
  const mesh = new THREE.Mesh(geometry, materials.get(color));
  mesh.scale.set(...scale);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export const box = (parent, size, position, color) => part(parent, cube, size, position, color);
export const oval = (parent, radii, position, color) => part(parent, sphere, radii, position, color);

function joint(parent, x, y, z) {
  const group = new THREE.Group();
  group.position.set(x,y,z);
  parent.add(group);
  return group;
}

export function character(look = {}, seated = true) {
  const style = {...defaultLook, ...look};
  const root = new THREE.Group();
  const torso = joint(root, 0, seated ? 0.79 : 1.02, 0);
  const shirt = style.topColor, skin = style.skin;
  oval(torso,[0.213,0.295,0.166],[0,0.035,0],shirt);
  oval(torso,[0.078,0.11,0.075],[0,0.34,0.01],skin);
  for (const side of [-1,1]) {
    const collar = box(torso,[0.083,0.1,0.027],[side*0.05,0.29,0.087],0xf4eee1);
    collar.rotation.z = side * -0.5;
  }
  if (style.topId === 'jacket') {
    box(torso,[0.048,0.23,0.024],[0,0.15,0.143],0xa84f43);
  } else {
    box(torso,[0.078,0.085,0.015],[0.104,0.13,0.139],0xe6e4d9);
    box(torso,[0.058,0.014,0.018],[0.104,0.15,0.143],0x577781);
  }
  const head = characterHead(style);
  head.position.set(0,0.55,0.035);
  torso.add(head);
  const arms=[], legs=[], hands=[];
  for (const side of [-1,1]) {
    const arm=joint(torso,side*0.205,0.22,0);
    oval(arm,[0.085,0.155,0.087],[side*0.023,-0.105,0],shirt);
    const elbow=joint(arm,side*0.02,-0.225,0);
    elbow.rotation.x=seated?-1.12:-0.12;
    oval(elbow,[0.06,0.13,0.065],[0,-0.095,0],shirt);
    const hand = joint(elbow,0,-0.228,0.012);
    oval(hand,[0.057,0.077,0.046],[0,0,0],skin);
    hands.push(hand);
    arms.push(arm);
    const leg=joint(root,side*0.105,seated?0.51:0.78,0);
    const kneeZ=seated?0.23:0;
    oval(leg,[0.101,seated?0.095:0.22,seated?0.21:0.1],[0,seated?0:-0.15,kneeZ/2],0x364657);
    oval(leg,[0.078,0.22,0.081],[0,seated?-0.22:-0.52,kneeZ],0x364657);
    oval(leg,[0.087,0.057,0.135],[0,seated?-0.45:-0.72,kneeZ+0.034],0x343437);
    legs.push(leg);
  }
  return {root,grip:hands[1],poseMeeting(swing) {
    head.rotation.y = 0.12;
    head.rotation.z = -0.05 - 0.1 * swing;
    torso.rotation.z = -0.12 * swing;
    arms[1].rotation.x = -0.72 - 0.6 * swing;
    arms[1].rotation.z = 0.52 - 0.35 * swing;
    arms[0].rotation.x = -0.16;
  },pose(time,moving) {
    head.rotation.z=seated?0.042*Math.sin(time*0.73):0;
    head.rotation.y=seated?0.085*Math.sin(time*0.55):0;
    arms.forEach((arm,i)=>{
      const cycle=Math.sin(time*(seated?4:6)+i*Math.PI);
      arm.rotation.x=seated?-0.12+0.085*cycle:moving?0.34*cycle:0;
      if (!seated) legs[i].rotation.x=-arm.rotation.x;
    });
  }};
}

export function characterHead(look = {}) {
  const style = {...defaultLook, ...look};
  const { hairColor: hair, skin } = style;
  const head = new THREE.Group();
  head.scale.set(1.58,1.22,1.40);
  oval(head,[0.17,0.21,0.158],[0,0,0],skin);
  oval(head,[0.177,0.152,0.163],[0,0.097,-0.028],hair);
  const fringe = oval(head,[0.15,0.071,0.084],[-0.025,0.129,0.087],hair);
  fringe.rotation.z = -0.23;
  if (style.hairId === 'bun') {
    for(const side of [-1,1]) oval(head,[0.065,0.065,0.061],[side*0.127,0.157,-0.077],hair);
  }
  if (style.hairId === 'bun') oval(head,[0.102,0.105,0.1],[0,0.09,-0.171],hair);
  if (style.hairId === 'short') oval(head,[0.054,0.104,0.087],[-0.136,0.055,0.015],hair);
  oval(head,[0.02,0.018,0.021],[0,-0.023,0.155],skin);
  part(head,style.expression === 'worried' ? frown : smile,[1,1,1],[0,0,0],0x8a5051);
  for (const side of [-1,1]) {
    oval(head,[0.036,0.049,0.029],[side*0.162,-0.015,0],skin);
    oval(head,[0.021,0.029,0.014],[side*0.068,0.018,0.145],0x342a35);
    oval(head,[0.006,0.008,0.004],[side*0.068-0.005,0.029,0.157],0xfff5e9);
    const cheek=oval(head,[0.032,0.015,0.008],[side*0.109,-0.035,0.12],0xe79a92);
    cheek.rotation.y=side*0.65;
    oval(head,[0.037,0.009,0.011],[side*0.066,0.063,0.139],hair);
    if (style.accessoryId === 'glasses') {
      part(head,glasses,[1.16,0.85,1],[side*0.066,0.023,0.159],0x413c3d);
    }
  }
  if (style.accessoryId === 'glasses') box(head,[0.04,0.009,0.013],[0,0.026,0.16],0x413c3d);
  return head;
}
