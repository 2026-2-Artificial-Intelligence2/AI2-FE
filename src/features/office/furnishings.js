import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {box, oval} from '../../shared/scene/character.js';
import { makeWindowSky } from './window-sky.js';

export const DESK_DROP = 0.12;
export const OFFICE_HALF_DEPTH = 4.1;
const WEST_EDGE = -7;
const EAST_WALL = 8.12;
// The sun's path over the work day (0 = start of the round, 1 = quitting time), relative to the
// office centre: low in the east in the morning, high at midday, setting in the west. It is always
// on the +Z side, so it shines in through the windows there. office.js moves its light along this.
export const SUN_PATH = [
  [0, [5.5, 5, 8]],
  [0.3, [2, 7.5, 8]],
  [0.6, [-2.5, 6, 8]],
  [0.8, [-5, 4, 8]],
  [1, [-6.5, 2.8, 8]],
];
const SUN_SIDE = 1;   // sign of the sun's Z
export const OFFICE_LENGTH = EAST_WALL - WEST_EDGE;
export const OFFICE_CENTER_X = (EAST_WALL + WEST_EDGE) / 2;
const MONITOR_DEPTH_SCALE = 0.50;
const DESK_TOP = 0.8025 - DESK_DROP;
const propNames = ['desk', 'chair', 'monitor', 'keyboard-mouse', 'desk-props'];
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);   // the shelf is meshopt-compressed
let propsPromise;
const decorLoads = new Map();

function loadDecor(name) {
  if (!decorLoads.has(name)) {
    const url = `${import.meta.env.BASE_URL}models/office-decor/${name}.glb`;
    decorLoads.set(name, loader.loadAsync(url).then(({scene}) => {
      const bounds = new THREE.Box3().setFromObject(scene);
      const size = bounds.getSize(new THREE.Vector3());
      scene.position.copy(bounds.getCenter(new THREE.Vector3()).negate());
      scene.position.y = -bounds.min.y;
      scene.traverse(object => {
        if (object.isMesh) object.castShadow = object.receiveShadow = true;
      });
      return {scene,size};
    }).catch(error => {
      decorLoads.delete(name);
      console.warn(`Could not load office decor ${name}:`, error);
      return null;
    }));
  }
  return decorLoads.get(name);
}

function smoothDeskProp(mesh) {
  // The props are re-baked from the full-resolution originals onto the low-poly mesh, so their
  // normal maps match the geometry and stay at full strength.
  const { geometry } = mesh;

  // Average coincident normals lightly so UV seams remain smooth without blunting the keys.
  const { position, normal } = geometry.attributes;
  const sums = new Map(), groups = [];
  const vector = new THREE.Vector3();
  for (let i=0;i<position.count;i++) {
    const key = [position.getX(i), position.getY(i), position.getZ(i)].join(',');
    if (!sums.has(key)) sums.set(key, new THREE.Vector3());
    groups[i] = sums.get(key);
    groups[i].add(vector.fromBufferAttribute(normal,i));
  }
  for (const sum of sums.values()) sum.normalize();
  for (let i=0;i<normal.count;i++) {
    vector.fromBufferAttribute(normal,i);
    const average = groups[i];
    if (vector.dot(average) < 0.75) continue;
    vector.lerp(average, 0.45).normalize();
    normal.setXYZ(i,vector.x,vector.y,vector.z);
  }
}

function loadProps() {
  propsPromise ??= Promise.all(propNames.map(async name => {
    const { scene } = await loader.loadAsync(`${import.meta.env.BASE_URL}models/office-props/${name}.glb`);
    const bounds = new THREE.Box3().setFromObject(scene);
    if (name === 'chair') {
      // Stretch the backrest above the cushion, keeping its contact point and the wheels.
      const cushion = bounds.min.y + (bounds.max.y - bounds.min.y) * 0.46;
      scene.traverse(object => {
        if (!object.isMesh) return;
        const { position, normal } = object.geometry.attributes;
        const direction = new THREE.Vector3();
        for (let i = 0; i < position.count; i++) {
          const y = position.getY(i);
          if (y <= cushion) continue;
          position.setY(i, cushion + (y - cushion) * 1.22);
          direction.fromBufferAttribute(normal, i);
          direction.y /= 1.22;
          direction.normalize();
          normal.setXYZ(i, direction.x, direction.y, direction.z);
        }
        object.geometry.computeBoundingBox();
        object.geometry.computeBoundingSphere();
      });
    }
    const size = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3());
    if (name === 'monitor') {
      // Keep the stand's footprint when the monitor assembly is compressed front-to-back.
      const centerZ = (bounds.min.z + bounds.max.z) / 2;
      scene.traverse(object => {
        if (!object.isMesh) return;
        const { position } = object.geometry.attributes;
        for (let i = 0; i < position.count; i++) {
          const height = (position.getY(i) - bounds.min.y) / size.y;
          const factor = THREE.MathUtils.lerp(1 / MONITOR_DEPTH_SCALE, 1,
            THREE.MathUtils.smoothstep(height, 0.14, 0.31));
          position.setZ(i, centerZ + (position.getZ(i) - centerZ) * factor);
        }
        object.geometry.computeVertexNormals();
        object.geometry.computeBoundingBox();
        object.geometry.computeBoundingSphere();
      });
    }
    scene.position.copy(bounds.getCenter(new THREE.Vector3()).negate());
    scene.position.y = -bounds.min.y;
    scene.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = object.receiveShadow = true;
      if (name === 'keyboard-mouse' || name === 'desk-props') smoothDeskProp(object);
    });
    return [name, {scene, size}];
  })).then(Object.fromEntries).catch(error => {
    propsPromise = undefined;
    throw error;
  });
  return propsPromise;
}

// Soft contact shadow under props that stand on the floor or a desk. The sun's shadow map covers
// the whole office, so small props get almost nothing from it and look pasted on; this grounds them.
// The texture, geometry and material are shared and live for the page, so they are never disposed.
let contactMaterial, contactGeometry;
const contactMaterials = new Map();
function contactShadow(parent, width, depth, position, rotation = 0, opacity = 0.34) {
  if (!contactMaterial) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const c = canvas.getContext('2d');
    const gradient = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(0,0,0,1)');
    gradient.addColorStop(0.55, 'rgba(0,0,0,0.55)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gradient;
    c.fillRect(0, 0, 64, 64);
    contactMaterial = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    contactGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  }
  if (!contactMaterials.has(opacity)) {
    const material = contactMaterial.clone();
    material.opacity = opacity;
    contactMaterials.set(opacity, material);
  }
  const shadow = new THREE.Mesh(contactGeometry, contactMaterials.get(opacity));
  shadow.position.set(position[0], position[1] + 0.003, position[2]);
  shadow.rotation.y = rotation;
  shadow.scale.set(width * 1.3, 1, depth * 1.3);
  shadow.renderOrder = -1;
  parent.add(shadow);
  return shadow;
}

// A soft rectangular shadow on the wall behind a board or a shelf. The sun comes from the room
// side, so nothing darkens the wall behind them and they look stuck on; this sets them off the wall.
// Bottom-centred like the props; the props' backs (local -Z) face the wall. Materials are shared
// per size like the contact shadow above.
const WALL_BOARD_SHADOW = 0.45;   // opacity behind everything hung on a wall
let wallShadowGeometry;
const wallShadowMaterials = new Map();
const WALL_SHADOW_MARGIN = 0.14;   // how far the shadow reaches past the prop's outline, in metres
function wallShadowMaterial(width, height, opacity) {
  // The fade starts a little inside the outline so the rim right at the edge is darkest.
  const fadeX = +((WALL_SHADOW_MARGIN + 0.06) / width).toFixed(2);
  const fadeY = +((WALL_SHADOW_MARGIN + 0.06) / height).toFixed(2);
  const key = `${fadeX}|${fadeY}|${opacity}`;
  if (!wallShadowMaterials.has(key)) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const c = canvas.getContext('2d');
    const image = c.createImageData(128, 128);
    const edge = (t, fade) => {
      const d = Math.min(t, 1 - t) / fade;
      return d >= 1 ? 1 : d * d * (3 - 2 * d);
    };
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      image.data[(y * 128 + x) * 4 + 3] = 255 * edge((x + 0.5) / 128, fadeX) * edge((y + 0.5) / 128, fadeY);
    }
    c.putImageData(image, 0, 0);
    wallShadowMaterials.set(key, new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(canvas), transparent: true, opacity, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
  }
  return wallShadowMaterials.get(key);
}
function wallShadow(parent, width, height, depth, position, rotation = 0, opacity = 0.3) {
  wallShadowGeometry ??= new THREE.PlaneGeometry(1, 1);
  const holder = new THREE.Group();
  holder.position.set(...position);
  holder.rotation.y = rotation;
  const w = width + WALL_SHADOW_MARGIN * 2, h = height + WALL_SHADOW_MARGIN * 2;
  const shadow = new THREE.Mesh(wallShadowGeometry, wallShadowMaterial(w, h, opacity));
  // The ceiling lights are above the room, so the shadow drops a little below the prop.
  shadow.position.set(0, height / 2 - 0.05, -depth / 2 + 0.006);
  shadow.scale.set(w, h, 1);
  shadow.renderOrder = -1;
  holder.add(shadow);
  parent.add(holder);
  return holder;
}

function addProp(parent, prop, dimensions, position, rotation = 0) {
  const group = new THREE.Group();
  group.position.set(...position);
  group.rotation.y = rotation;
  const { scene, size } = prop;
  group.scale.set(dimensions[0] / size.x, dimensions[1] / size.y, dimensions[2] / size.z);
  group.add(scene.clone());
  parent.add(group);
  return group;
}

function painted(width,height,paint) {
  const canvas=document.createElement('canvas');
  canvas.width=width; canvas.height=height;
  paint(canvas.getContext('2d'),width,height);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=4;
  return new THREE.MeshBasicMaterial({map:texture});
}

function panel(parent,x,y,z,w,h,material,face=1) {
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);
  mesh.position.set(x,y,z);
  mesh.rotation.y=face===1?0:Math.PI;
  mesh.userData.disposeWithOffice = true;
  parent.add(mesh);
  return mesh;
}

function officeScreen(chart) {
  return painted(512,288,(c,w,h)=>{
    c.fillStyle='#eff2f1';c.fillRect(0,0,w,h);
    c.fillStyle=chart?'#35425b':'#27675d';c.fillRect(0,0,w,34);
    c.fillStyle='#ffffff';c.font='bold 16px sans-serif';
    c.fillText(chart?'분기 실적 보고':'매출 집계표',15,23);
    c.fillStyle='#cbd7d3';c.fillRect(0,34,w,21);
    if(chart){
      for(let i=0;i<9;i++){const n=[42,52,41,68,73,61,86,101,112][i];c.fillStyle=i%2?'#789ea5':'#456876';c.fillRect(46+i*48,228-n,25,n);}
    }else{
      for(let i=0;i<8;i++)for(let j=0;j<5;j++){
        const x=15+j*100,y=64+i*26;
        c.fillStyle=i%2?'#e1eae6':'#f7f9f8';c.fillRect(x,y,96,23);
        c.fillStyle='#667e79';c.font='12px sans-serif';c.fillText(j===0?'영업 '+(i+1)+'팀':String((i+2)*(j+3)*1750),x+4,y+16);
      }
    }
  });
}

function addAgencyWall(scene, x, face) {
  const wall = new THREE.Group();
  wall.position.x = x;
  wall.rotation.y = face * Math.PI / 2;
  scene.add(wall);

  for (const [offset, graphic] of [[-1.25, true], [0, false]]) {
    box(wall,[0.92,1.24,0.05],[offset,2.18,0],0x2c2823).castShadow = false;
    // Same soft wall shadow as the decor boards. The group sits 6 mm off the wall, so a
    // 12 mm "depth" puts the shadow at the group's own plane, just in front of the wall.
    wallShadow(wall, 0.92, 1.24, 0.012, [offset, 2.18 - 0.62, 0], 0, WALL_BOARD_SHADOW);
    panel(wall,offset,2.18,0.027,0.85,1.17,painted(256,352,(c,w,h) => {
      c.fillStyle = '#f3e8d6'; c.fillRect(0,0,w,h);
      c.fillStyle = '#ce622e';
      if (graphic) {
        c.beginPath(); c.arc(128,125,72,0,Math.PI*2); c.fill();
        c.strokeStyle = '#242923'; c.lineWidth = 4;
        for (let i=0;i<7;i++) {
          c.beginPath(); c.arc(45,300,55+i*13,Math.PI*1.5,Math.PI*2); c.stroke();
        }
      } else {
        c.fillRect(29,277,71,6);
        c.fillStyle = '#282622'; c.font='bold 31px sans-serif';
        ['Ideas','Move','People'].forEach((line,i) => c.fillText(line,30,116+i*43));
      }
    }));
  }

  const sign=panel(wall,1.75,2.45,0.035,1.39,0.65,painted(400,188,(c,w,h) => {
    c.fillStyle='#b77952'; c.fillRect(0,0,w,h);
    c.fillStyle='#ffebc5'; c.font='bold 44px sans-serif';
    c.fillText('BRIGHTER',40,80); c.fillText('TOMORROW',40,134);
  }));
  sign.material.toneMapped=false;
  wallShadow(wall, 1.39, 0.65, 0.012, [1.75, 2.45 - 0.325, 0], 0, WALL_BOARD_SHADOW);
}

function addManagerWallDecor(scene, decorate) {
  // Use the solid wall next to the meeting-room glass.
  const wall = new THREE.Group();
  wall.position.x = -6.825;
  wall.rotation.y = Math.PI / 2;
  scene.add(wall);
  const notice = new THREE.Group();
  wall.add(notice);
  notice.position.y = 0.31;
  const board = box(notice,[1.36,0.73,0.057],[-2.65,1.72,0],0xaa825d);
  board.castShadow = false;
  const notes = [0xe5be74,0xe7d1a6,0xc5c4a1,0xd9ad9b];
  for (const [i, color] of notes.entries()) {
    const note = box(notice,[0.18,0.22,0.008],[-3.12 + i*0.28,1.77+(i%2)*0.12,0.034],color);
    note.castShadow = false;
    note.rotation.z = i%2 ? 0.12 : -0.09;
  }

  decorate('sticky-note-board', wall, [1.34,0.91,0.15], [-2.65,1.60,0.09], 0, notice);

  const shelves = new THREE.Group();
  wall.add(shelves);
  shelves.position.x = -4.41;
  const wood = 0x9d6b44;
  for (const y of [0.08,0.48,0.88,1.28]) box(shelves,[1.46,0.045,0.38],[1.76,y,0.24],wood);
  for (const x of [1.05,2.47]) box(shelves,[0.045,1.23,0.38],[x,0.68,0.24],wood);
  const bookColors = [0x495e53,0xa47753,0x3b444b,0xd2ba99,0x92705f];
  for (let i=0;i<11;i++) {
    const h=0.19+0.025*(i%5), y=i<6 ? 0.51 : 0.91;
    box(shelves,[0.055,h,0.135],[1.2+(i%6)*0.062,y+h/2,0.30],bookColors[i%5]);
  }
  box(shelves,[0.27,0.28,0.045],[2.12,1.03,0.27],0xce9863).rotation.z=0.09;
  decorate('agency-storage-shelf', wall, [1.90,1.28,0.44], [-2.74,0,0.25], 0, shelves, 0, true);
}

function addOfficeRugs(scene) {
  const material = painted(256,512,(c,w,h) => {
    c.fillStyle = '#66645d'; c.fillRect(0,0,w,h);
    c.strokeStyle = '#9a8b72'; c.lineWidth = 4; c.strokeRect(8,8,w-16,h-16);
    c.lineWidth = 1;
    for (let y=18;y<h-17;y+=3) {
      c.strokeStyle = y%5 ? '#766e61' : '#8a806d';
      c.beginPath(); c.moveTo(15,y); c.lineTo(w-15,y); c.stroke();
    }
  });
  for (const z of [-2.85,2.85]) {
    const rug = panel(scene,2,0.002,z,1.46,9.5,material);
    rug.rotation.set(-Math.PI/2,0,Math.PI/2);
  }
}

function addWindows(scene, skyline) {
  const windows = [[-4,3.22],[0,3.22],[4,3.22],[7.18,1.60]];
  const openings = windows.map(([x,width]) => [x-width/2, x+width/2]);
  const posts = openings.map(([start],i) => [i===0 ? WEST_EDGE : openings[i-1][1], start]);
  posts.push([openings.at(-1)[1], EAST_WALL]);
  const wood = 0xc79d73;
  const frame = 0x393733;
  const wall = 0xeadccb;
  const reflection = painted(128,128,(c,w,h) => {
    const streak = c.createLinearGradient(0,0,w,h);
    streak.addColorStop(0,'rgba(220,236,255,0.25)');
    streak.addColorStop(0.48,'rgba(237,245,255,0.025)');
    streak.addColorStop(0.57,'rgba(237,245,255,0.14)');
    streak.addColorStop(0.66,'rgba(237,245,255,0.025)');
    streak.addColorStop(1,'rgba(220,236,255,0.08)');
    c.fillStyle=streak; c.fillRect(0,0,w,h);
  });
  reflection.transparent=true;
  reflection.depthWrite=false;
  reflection.toneMapped=false;
  for (const z of [-OFFICE_HALF_DEPTH,OFFICE_HALF_DEPTH]) {
    const f = -Math.sign(z);
    // The wall on the sun's side blocks the sun so it only falls through the window openings.
    const sunSide = Math.sign(z) === SUN_SIDE;
    box(scene,[OFFICE_LENGTH,1.22,0.15],[OFFICE_CENTER_X,0.61,z],wall).castShadow=sunSide;
    box(scene,[OFFICE_LENGTH,0.72,0.15],[OFFICE_CENTER_X,3.29,z],wall).castShadow=sunSide;
    for (const [start,end] of posts) {
      box(scene,[end-start,1.84,0.15],[(start+end)/2,2.07,z],wall).castShadow=sunSide;
    }
    for (const [i,[x,width]] of windows.entries()) {
      const view=panel(scene,x,2.06,z-f*0.083,width,1.72,skyline.material,f);
      const segment=f===1?i:3-i;
      const uv=view.geometry.attributes.uv;
      for(let v=0;v<uv.count;v++) {
        uv.setXY(v,segment*0.237 + uv.getX(v)*0.289*width/3.22,0.18 + uv.getY(v)*0.49);
      }
      panel(scene,x,2.06,z+f*0.024,width,1.72,reflection,f);
      // Only the blind slats shade the floor; a shadow of the frame grid reads as a cross on the floor.
      for(const dx of [-width/2,0,width/2]) box(scene,[0.062,1.82,0.145],[x+dx,2.06,z+f*0.055],frame).castShadow=false;
      for(const y of [1.17,2.95]) box(scene,[width+0.10,0.063,0.145],[x,y,z+f*0.055],frame).castShadow=false;
      box(scene,[width+0.30,0.075,0.29],[x,1.14,z+f*0.1],0xd7b896).castShadow=false;
      const latch=box(scene,[0.018,0.11,0.041],[x+f*0.064,1.94,z+f*0.147],0x9c9a91);
      latch.castShadow=false;
      latch.rotation.z=f*0.16;
      for (const dx of [-width*0.35,width*0.35]) box(scene,[0.012,0.58,0.02],[x+dx,2.68,z+f*0.14],0x9c8064).castShadow=false;
      for(let j=0;j<6;j++) {
        const slat=box(scene,[width+0.03,0.036,0.086],[x,2.91-j*0.081,z+f*0.14],wood);
        slat.rotation.x=f*0.20;
      }
    }
    box(scene,[OFFICE_LENGTH,0.11,0.14],[OFFICE_CENTER_X,0.06,z+f*0.1],0x829492).castShadow=false;
  }
}

// Warm light thrown by the ceiling fixtures: a glow on the ceiling around each one and a soft pool
// on the floor below. Additive decals stand in for real lights, which cost too much on phones.
function lampGlow(scene, fixtures) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const c = canvas.getContext('2d');
  const gradient = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.45)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gradient;
  c.fillRect(0, 0, 64, 64);
  const map = new THREE.CanvasTexture(canvas);
  const glow = opacity => new THREE.MeshBasicMaterial({
    map, color: 0xffc98f, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const ceiling = glow(0.5), floor = glow(0.16);
  const geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  for (const [x, z] of fixtures) {
    const up = new THREE.Mesh(geometry, ceiling);
    up.rotation.x = Math.PI;                  // face down from the ceiling
    up.position.set(x, 3.598, z);
    up.scale.set(3.2, 1, 1.5);
    const down = new THREE.Mesh(geometry, floor);
    down.position.set(x, 0.004, z);
    down.scale.set(3.4, 1, 2.2);
    for (const mesh of [up, down]) {
      mesh.renderOrder = 1;
      scene.add(mesh);
    }
  }
  return {
    // brighter as the windows go dark
    update(night) {
      ceiling.opacity = 0.38 + 0.42 * night;
      floor.opacity = 0.1 + 0.18 * night;
    },
    dispose() { map.dispose(); ceiling.dispose(); floor.dispose(); geometry.dispose(); },
  };
}

function addDeskDetails(scene, x, deskZ, f, seat, decorate) {
  const sideX = x-f*0.58;
  if (seat % 4 === 0) {
    for (let i=0;i<3;i++) {
      const folder = box(scene,[0.235,0.017,0.172],[sideX,DESK_TOP+0.01+i*0.015,deskZ-f*0.14],
        [0x46615c,0xc99869,0xd9cbbb][i]);
      folder.rotation.y=f*(0.10+i*0.07);
    }
  } else if (seat % 4 === 1) {
    const book = box(scene,[0.225,0.021,0.16],[sideX,DESK_TOP+0.011,deskZ-f*0.13],0xe2d0b1);
    book.rotation.y=f*0.16;
    box(scene,[0.012,0.01,0.125],[sideX,DESK_TOP+0.027,deskZ-f*0.13],0x3e4b4b).rotation.y=f*-0.28;
  } else if (seat % 4 === 2) {
    const accessory = new THREE.Group();
    scene.add(accessory);
    const phone = box(accessory,[0.077,0.017,0.145],[sideX,DESK_TOP+0.009,deskZ-f*0.17],0x3a3d3e);
    phone.rotation.y=f*-0.22;
    box(phone,[0.88,0.02,0.91],[0,0.51,0],0x64737b);
    box(scene,[0.18,0.012,0.11],[sideX-f*0.12,DESK_TOP+0.007,deskZ+f*0.045],0x87765f).rotation.y=f*0.15;
    decorate('rose-gold-tablet', scene, [0.16,0.23,0.019], [sideX,DESK_TOP+0.011,deskZ+f*0.03],
      f === 1 ? Math.PI+0.15 : 0.15, accessory, -Math.PI/2);
  } else {
    const smallPlant = new THREE.Group();
    scene.add(smallPlant);
    const pot = box(smallPlant,[0.105,0.10,0.109],[sideX,DESK_TOP+0.05,deskZ+f*0.11],0xa47255);
    pot.rotation.y=f*0.19;
    for (let i=0;i<5;i++) {
      const angle=i*2.4;
      const leaf=oval(smallPlant,[0.019,0.058,0.012],[sideX+Math.cos(angle)*0.025,DESK_TOP+0.127,
        deskZ+f*0.11+Math.sin(angle)*0.025],i%2?0x567747:0x72915a);
      leaf.rotation.set(Math.sin(angle)*0.45,angle,Math.cos(angle)*0.45);
    }
    decorate('potted-greenery', scene, [0.113,0.18,0.11], [sideX,DESK_TOP,deskZ+f*0.11], f*0.4, smallPlant);
  }
}

export function furnish(scene, onPropsReady = () => {}) {
  const screens=[officeScreen(false),officeScreen(true)];
  const skyline = makeWindowSky();
  const props = loadProps().catch(error => {
    console.warn('Could not load office props:', error);
    return null;
  });
  let disposed = false;
  function decorate(name, parent, size, position, yaw = 0, fallback, tilt = 0, againstWall = false) {
    // Load decorative models after the desks and chairs have been requested and decoded.
    props.then(() => disposed ? null : loadDecor(name)).then(model => {
      if (!model || disposed) return;
      const decor = addProp(parent, model, size, position, yaw);
      decor.rotateX(tilt);
      // Ground props that stand on the floor, a desk or a sill; wall-mounted boards (thin and
      // large, not lying flat) keep only the sun's shadow.
      const wallMounted = !tilt && size[2] < size[1] * 0.2 && size[1] > 0.4;
      if (!wallMounted) {
        const [width, depth] = tilt ? [size[0], size[1]] : [size[0], size[2]];
        contactShadow(parent, width, depth, position, yaw, position[1] > 0.1 ? 0.3 : 0.45);
      }
      if (wallMounted || againstWall) wallShadow(parent, size[0], size[1], size[2], position, yaw,
        wallMounted ? WALL_BOARD_SHADOW : 0.4);
      fallback?.removeFromParent();
      onPropsReady();
    });
  }
  const stripMaterial = painted(2,2,c => {
    c.fillStyle = '#ffe6bb'; c.fillRect(0,0,2,2);
  });
  stripMaterial.toneMapped = false;
  const bezelMaterial = new THREE.MeshStandardMaterial({color: 0x20282e, roughness: 0.64});
  const bezelGeometry = new THREE.BoxGeometry(0.648, 0.374, 0.054).translate(0, 0, -0.027);
  addWindows(scene, skyline);
  // The west side is built by addMeetingWindow and must remain open behind its glass.
  box(scene,[0.14,3.65,OFFICE_HALF_DEPTH*2],[EAST_WALL,1.82,0],0xe7d8c6);   // blocks the morning sun
  addAgencyWall(scene, EAST_WALL - 0.076, -1);
  addManagerWallDecor(scene, decorate);
  decorate('magnetic-whiteboard', scene, [1.25,0.83,0.082], [-6.78,1.21,1.08], Math.PI/2);
  decorate('pinned-plans-board', scene, [0.67,0.51,0.064],
    [EAST_WALL-0.112,1.69,-2.67], -Math.PI/2);
  decorate('potted-greenery', scene, [0.10,0.153,0.10], [4.97,1.178,-3.96], 0.27);
  decorate('potted-greenery', scene, [0.115,0.175,0.115], [0.76,1.178,3.96], Math.PI);
  // The ceiling casts so the low sun cannot reach the back of the room over the window wall.
  box(scene,[OFFICE_LENGTH,0.12,OFFICE_HALF_DEPTH*2],[OFFICE_CENTER_X,3.66,0],0xe8e4d9);
  const fixtures = [];
  for(const x of [-3,0.3,3.6,6.75])for(const z of [-1.65,1.65]){
    fixtures.push([x,z]);
    box(scene,[0.019,0.31,0.019],[x-0.82,3.45,z],0x282621);
    box(scene,[0.019,0.31,0.019],[x+0.82,3.45,z],0x282621);
    box(scene,[2.1,0.11,0.10],[x,3.29,z],0x252624);
    const strip = panel(scene,x,3.232,z,1.96,0.073,stripMaterial);
    strip.rotation.x = Math.PI / 2;
  }
  const lampLights = [];
  for (const x of [1,5]) {
    const fill = new THREE.SpotLight(0xffd4a3, 17, 6.2, 1.02, 0.68, 2);
    fill.position.set(x, 3.18, x === 1 ? -1.65 : 1.65);
    fill.target.position.set(x, 0.68, x === 1 ? -0.28 : 0.28);
    scene.add(fill, fill.target);
    lampLights.push(fill);
  }
  const lamps = lampGlow(scene, fixtures);
  function updateLight(timeOfDay) {
    skyline.update(timeOfDay);
    const night = THREE.MathUtils.smoothstep(timeOfDay, 0.6, 1);   // lamps take over after sunset
    lamps.update(night);
    for (const light of lampLights) light.intensity = 17 + 13 * night;
  }
  updateLight(0);
  addOfficeRugs(scene);
  const plants = [
    ['rubber-plant-stand', -4, 3.51, [0.68,1.30,0.64], Math.PI],
    ['faceted-foliage', -4, -3.52, [0.83,1.13,0.72], 0.15],
    ['faceted-foliage', 5.76, 3.51, [0.71,0.96,0.61], Math.PI+0.35],
    ['rubber-plant-stand', 5.76, -3.51, [0.58,1.09,0.56], 0.1],
    ['emerald-fan-plant', 7.38, 3.25, [0.90,1.73,0.91], -Math.PI/2],
    ['faceted-foliage', 7.38, -3.18, [0.80,1.13,0.69], Math.PI/2],
  ];
  for(const [name,x,z,size,yaw] of plants){
    const pot = new THREE.Group();
    pot.position.set(x,0,z);
    if (x > 7) pot.scale.setScalar(1.38);
    scene.add(pot);
    const planter = box(pot,[0.43,0.39,0.43],[0,0.195,0],0xb09375);
    planter.rotation.y = 0.12;
    box(pot,[0.395,0.032,0.395],[0,0.402,0],0x645040);
    box(pot,[0.035,0.84,0.035],[0,0.71,0],0x70664b);
    for(let i=0;i<9;i++){
      const angle=i*2.4,leaf=oval(pot,[0.102,0.31,0.045],[0.21*Math.cos(angle),0.85+i*0.045,0.21*Math.sin(angle)],i%2?0x456c42:0x668044);
      leaf.rotation.set(Math.sin(angle)*0.65,angle,Math.cos(angle)*0.65);
    }
    decorate(name, scene, size, [x,0,z], yaw, pot);
  }
  function dressDesk(x,z,i){
    const f=-Math.sign(z),dz=z+0.65*f;
    const fallback = new THREE.Group();
    scene.add(fallback);
    box(fallback,[1.84,0.085,0.74],[x,0.76-DESK_DROP,dz],0xe1bd9e);
    const legHeight = 0.74 - DESK_DROP;
    for(const dx of [-0.79,0.79]) box(fallback,[0.09,legHeight,0.7],[x+dx,legHeight/2,dz],0x789192);
    box(fallback,[0.08,0.21,0.1],[x,0.88-DESK_DROP,dz],0x474b4c);
    box(fallback,[0.65,0.37,0.05],[x,1.1-DESK_DROP,dz],0x647781);
    box(fallback,[0.6,0.32,0.02],[x,1.1-DESK_DROP,dz-f*0.035],0x9bbec1);
    box(fallback,[0.43,0.025,0.15],[x,0.815-DESK_DROP,dz-f*0.28],0x596566);
    const deskProps = new THREE.Group();
    deskProps.position.y = -DESK_DROP;
    fallback.add(deskProps);
    const screen = panel(deskProps,x,1.1,dz-f*0.048,0.596,0.315,screens[i%2],-f);
    for(let j=0;j<4;j++)box(deskProps,[0.385,0.006,0.014],[x,0.8305,dz-f*(0.225+j*0.026)],0x8a9798);
    oval(deskProps,[0.034,0.018,0.053],[x+0.31,0.825,dz-f*0.28],0x58666b);
    if (i%2===0) {
      // A bear-shaped memo clip sits beside the keyboard, facing the seat.
      const clip=new THREE.Group();
      clip.position.set(x-0.44,0.89,dz-f*0.19);
      clip.rotation.y=f===1?Math.PI:0;
      deskProps.add(clip);
      oval(clip,[0.076,0.067,0.04],[0,0,0],0xd9a576);
      for (const side of [-1,1]) {
        oval(clip,[0.028,0.028,0.023],[side*0.052,0.047,0],0xd9a576);
        oval(clip,[0.005,0.006,0.004],[side*0.027,0.006,0.038],0x594138);
      }
      oval(clip,[0.024,0.017,0.012],[0,-0.012,0.038],0xf0cfab);
      oval(clip,[0.008,0.006,0.005],[0,-0.008,0.05],0x594138);
    }
    box(deskProps,[0.37,0.015,0.28],[x-0.56,0.816,dz],0xf1eddd).rotation.y=0.13;
    oval(deskProps,[0.053,0.069,0.053],[x+0.56,0.864,dz],i%2?0xb6876a:0x688c91);
    oval(deskProps,[0.044,0.007,0.044],[x+0.56,0.929,dz],0x52423a);
    const seat = box(fallback,[0.52,0.09,0.30],[x,0.43,z-f*0.04],0x89a3a2);
    const back = box(fallback,[0.49,0.36,0.067],[x,0.73,z-f*0.2],0x83a4a3);
    const post = box(fallback,[0.09,0.32,0.09],[x,0.24,z],0x647479);
    for(const angle of [0,Math.PI/2]){
      box(fallback,[0.53,0.046,0.063],[x,0.072,z],0x454f53).rotation.y=angle;
    }
    let chair, fittedSeat = 0.32, fittedBack = -0.23;
    const fitChair = (seatTop, backZ) => {
      fittedSeat = seatTop;
      fittedBack = backZ;
      if (chair) {
        chair.position.z = z + f * (backZ + 0.093);
        chair.scale.y = seatTop / (chair.userData.originalHeight * 0.46);
      }
      seat.position.y = seatTop - 0.045;
      back.position.set(x, seatTop + 0.22, z + f * backZ);
      const seatBottom = seatTop - 0.09;
      post.position.y = (seatBottom + 0.08) / 2;
      post.scale.y = (seatBottom - 0.08) / 0.32;
    };
    props.then(models => {
      if (!models || disposed) return;
      const facing = f === 1 ? 0 : Math.PI;
      addProp(scene,models.desk,[1.84,DESK_TOP,0.74],[x,0,dz]);
      chair = addProp(scene,models.chair,[0.68,0.86,0.64],[x,0,z],facing);
      chair.userData.originalHeight = models.chair.size.y / (0.46 + 0.54 * 1.22);
      fitChair(fittedSeat, fittedBack);
      const monitor = new THREE.Group();
      monitor.position.set(x,DESK_TOP,dz + f * 0.05);
      monitor.rotation.y = facing + Math.PI;
      monitor.scale.z = MONITOR_DEPTH_SCALE;
      scene.add(monitor);
      addProp(monitor,models.monitor,[0.65,0.51,0.22],[0,0,0]);
      const face = new THREE.Group();
      face.position.set(0,0.327,0.072);
      face.rotation.x = -0.21;
      monitor.add(face);
      const bezel = new THREE.Mesh(bezelGeometry, bezelMaterial);
      face.add(bezel,screen);
      screen.position.set(0,0,0.001);
      screen.rotation.set(0,0,0);
      screen.scale.set(1.01,1.08,1);
      addProp(scene,models['keyboard-mouse'],[0.63,0.026,0.172],[x-f*0.084,DESK_TOP,z+f*0.345],facing + Math.PI);
      const deskSet = addProp(scene,models['desk-props'],[0.28,0.19,0.15],
        [x+f*0.63,DESK_TOP,dz+f*0.04],facing + Math.PI);
      contactShadow(scene, 0.28, 0.15, [x+f*0.63,DESK_TOP,dz+f*0.04], facing, 0.3);
      contactShadow(scene, 0.26, 0.17, [x,DESK_TOP,dz+f*0.05], facing, 0.26);   // monitor stand
      if (i%2 === 0) {
        const takeaway = i%4 === 0;
        decorate(takeaway ? 'takeaway-cup' : 'travel-tumbler', scene,
          takeaway ? [0.091,0.129,0.091] : [0.107,0.224,0.076],
          [x+f*0.57,DESK_TOP,dz+f*0.111], facing+Math.PI+0.25, deskSet);
      }
      addDeskDetails(scene, x, dz, f, i, decorate);
      fallback.removeFromParent();
      onPropsReady();
    });
    return fitChair;
  }
  return { dressDesk, updateSky: updateLight, dispose() {
    disposed = true;
    skyline.dispose();
    lamps.dispose();
    bezelGeometry.dispose();
    bezelMaterial.dispose();
  }};
}
