import * as THREE from 'three';

// Painted-plaster finish for the office walls, a tiled floor, and soft shading where walls meet the floor,
// the ceiling and each other, so flat boxes read as real painted walls.

// Wall boxes are recognised by their paint colours (window walls, east wall, west wall).
const WALL_COLORS = new Set([0xeadccb, 0xe7d8c6, 0xd2d9d2]);
const TILE = 1.6;   // metres of wall covered by one repeat of the plaster texture

// Tileable value noise summed over [cells, amount, seed] layers, as a size x size height field.
function noiseField(size, layers) {
  const height = new Float32Array(size * size);
  for (const [cells, amount, seed] of layers) {
    const grid = [];
    for (let i = 0; i < cells * cells; i++) grid.push(Math.abs(Math.sin((i + 1) * 12.9898 * seed) * 43758.5453 % 1));
    const at = (x, y) => grid[((y % cells) * cells) + (x % cells)];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const fx = x / size * cells, fy = y / size * cells;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const sx = fx - x0, sy = fy - y0;
      const ex = sx * sx * (3 - 2 * sx), ey = sy * sy * (3 - 2 * sy);
      const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * ex;
      const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * ex;
      height[y * size + x] += (top + (bottom - top) * ey) * amount;
    }
  }
  return height;
}

// Colour (grey, tinted by the material colour) and normal map textures from per-pixel callbacks.
function surfaceTextures(size, shadeAt, heightAt, strength) {
  const color = document.createElement('canvas');
  const normal = document.createElement('canvas');
  color.width = color.height = normal.width = normal.height = size;
  const colorData = color.getContext('2d').createImageData(size, size);
  const normalData = normal.getContext('2d').createImageData(size, size);
  const h = (x, y) => heightAt((x + size) % size, (y + size) % size);
  const n = new THREE.Vector3();
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    const shade = shadeAt(x, y);
    colorData.data.set([shade, shade, shade, 255], i);
    n.set(-(h(x + 1, y) - h(x - 1, y)) * strength, -(h(x, y + 1) - h(x, y - 1)) * strength, 1).normalize();
    normalData.data.set([(n.x * 0.5 + 0.5) * 255, (n.y * 0.5 + 0.5) * 255, (n.z * 0.5 + 0.5) * 255, 255], i);
  }
  color.getContext('2d').putImageData(colorData, 0, 0);
  normal.getContext('2d').putImageData(normalData, 0, 0);
  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = new THREE.CanvasTexture(normal);
  for (const texture of [map, normalMap]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
  }
  return { map, normalMap };
}

function plasterTextures() {
  // Broad trowel mottling plus fine grain.
  const size = 256;
  const height = noiseField(size, [[4, 0.5, 1.7], [16, 0.3, 2.3], [64, 0.2, 3.1]]);
  const at = (x, y) => height[y * size + x];
  return surfaceTextures(size, (x, y) => 240 + at(x, y) * 15, at, 2.2);   // near white; the paint colour tints it
}

// Matte stone-look floor tiles: each tile a slightly different tone, cloudy mottling, fine grit
// and recessed grout lines.
const FLOOR_TILE = 0.6;      // metres per tile
const FLOOR_TILES = 4;       // tiles across one texture repeat
function floorTextures() {
  const size = 512, tile = size / FLOOR_TILES, grout = 2;
  const cloud = noiseField(size, [[6, 0.6, 4.1], [24, 0.4, 5.3]]);
  const grit = noiseField(size, [[128, 1, 6.7]]);
  const toneOf = (tx, ty) => Math.abs(Math.sin((tx * 7 + ty * 13 + 1) * 91.7) * 1e4 % 1) - 0.5;
  const isGrout = (x, y) => x % tile < grout || y % tile < grout;
  const shadeAt = (x, y) => {
    if (isGrout(x, y)) return 214;
    const i = y * size + x;
    return 236 + toneOf(Math.floor(x / tile), Math.floor(y / tile)) * 12 + (cloud[i] - 0.5) * 16 + (grit[i] - 0.5) * 7;
  };
  const heightAt = (x, y) => (isGrout(x, y) ? -0.45 : 0) + grit[y * size + x] * 0.25 + cloud[y * size + x] * 0.15;
  return surfaceTextures(size, shadeAt, heightAt, 1.6);
}

// Replaces a floor box's flat paint with the tiled floor, tiled to its size; returns a cleanup.
export function finishFloor(floor) {
  const { map, normalMap } = floorTextures();
  const span = FLOOR_TILE * FLOOR_TILES;
  for (const texture of [map, normalMap]) texture.repeat.set(floor.scale.x / span, floor.scale.z / span);
  const material = new THREE.MeshStandardMaterial({
    color: floor.material.color, map, normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.78,
  });
  floor.material = material;
  return () => { map.dispose(); normalMap.dispose(); material.dispose(); };
}

// Black fading to clear along +V: the soft shadow in a corner.
function cornerTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 64;
  const c = canvas.getContext('2d');
  const gradient = c.createLinearGradient(0, 64, 0, 0);
  gradient.addColorStop(0, 'rgba(0,0,0,1)');
  gradient.addColorStop(0.35, 'rgba(0,0,0,0.4)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = gradient;
  c.fillRect(0, 0, 4, 64);
  return new THREE.CanvasTexture(canvas);
}

// Bounds are the inner faces of the walls; westSolid is the z range of the west wall that is wall
// rather than meeting-room glass.
export function finishWalls(scene, { west, east, north, south, westSolid = [north, south], floor = 0, ceiling = 3.6 }) {
  const { map, normalMap } = plasterTextures();
  const owned = [map, normalMap];
  const materials = new Map();

  // Swap each wall box's flat paint for plaster, tiled to the box's size.
  const walls = [];
  scene.traverse(object => {
    if (object.isMesh && object.material?.color && WALL_COLORS.has(object.material.color.getHex())) walls.push(object);
  });
  for (const wall of walls) {
    const { x, y, z } = wall.scale;
    const across = Math.max(x, z);
    const key = `${wall.material.color.getHex()}|${(across / TILE).toFixed(1)}|${(y / TILE).toFixed(1)}`;
    if (!materials.has(key)) {
      const tiled = [map.clone(), normalMap.clone()];
      for (const texture of tiled) texture.repeat.set(across / TILE, y / TILE);
      owned.push(...tiled);
      materials.set(key, new THREE.MeshStandardMaterial({
        color: wall.material.color, map: tiled[0], normalMap: tiled[1],
        normalScale: new THREE.Vector2(0.45, 0.45), roughness: 0.93,
      }));
    }
    wall.material = materials.get(key);
  }

  // Corner shading: a strip on each wall along the ceiling and the floor, a strip on the floor
  // along each wall, and a strip down each vertical room corner.
  const shade = cornerTexture();
  owned.push(shade);
  const shadeMaterial = opacity => {
    const material = new THREE.MeshBasicMaterial({
      map: shade, color: 0x3a2c20, transparent: true, opacity, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    materials.set(`shade${opacity}`, material);
    return material;
  };
  const wallShade = shadeMaterial(0.13), floorShade = shadeMaterial(0.16), cornerShade = shadeMaterial(0.1);
  const plane = new THREE.PlaneGeometry(1, 1);
  const strips = new THREE.Group();
  scene.add(strips);
  // Each wall as [centre along it, length, inward normal angle, position of its face].
  const sides = [
    { length: east - west, along: (east + west) / 2, face: north, rotation: 0 },             // faces +Z
    { length: east - west, along: (east + west) / 2, face: south, rotation: Math.PI },       // faces -Z
    { length: south - north, along: (north + south) / 2, face: west, rotation: Math.PI / 2 },  // faces +X
    { length: south - north, along: (north + south) / 2, face: east, rotation: -Math.PI / 2 }, // faces -X
  ];
  const place = (material, width, height, local, rotation, tilt = 0, roll = 0) => {
    const mesh = new THREE.Mesh(plane, material);
    mesh.scale.set(width, height, 1);
    mesh.position.copy(local);
    mesh.rotation.set(tilt, rotation, roll, 'YXZ');
    mesh.renderOrder = -1;
    strips.add(mesh);
  };
  for (const { length, along, face, rotation } of sides) {
    const alongZ = rotation === Math.PI / 2 || rotation === -Math.PI / 2;
    const point = (y, inward = 0, at = along) => {
      const normal = new THREE.Vector3(Math.sin(rotation), 0, Math.cos(rotation));
      const base = alongZ ? new THREE.Vector3(face, y, at) : new THREE.Vector3(at, y, face);
      return base.addScaledVector(normal, 0.004 + inward);
    };
    // Below the glass on the west side there is no wall to shade.
    const glassy = face === west;
    const [lowFrom, lowTo] = glassy ? westSolid : [along - length / 2, along + length / 2];
    // The dark edge of the gradient (texture bottom) goes toward the corner.
    place(wallShade, length, 0.55, point(ceiling - 0.275), rotation, 0, Math.PI);              // under the ceiling
    place(wallShade, lowTo - lowFrom, 0.32, point(floor + 0.16, 0, (lowFrom + lowTo) / 2), rotation); // above the floor
    place(floorShade, length, 0.5, point(floor + 0.002, 0.25), rotation, -Math.PI / 2, Math.PI); // on the floor
    for (const end of [-1, 1]) {                                                               // room corners
      if (glassy && end === 1) continue;     // the west wall's north end is glass
      const corner = point((floor + ceiling) / 2);
      const shift = new THREE.Vector3(Math.cos(rotation), 0, -Math.sin(rotation)).multiplyScalar(end * (length / 2 - 0.2));
      place(cornerShade, ceiling - floor, 0.4, corner.add(shift), rotation, 0, end * Math.PI / 2);
    }
  }

  return () => {
    scene.remove(strips);
    plane.dispose();
    owned.forEach(texture => texture.dispose());
    materials.forEach(material => material.dispose());
  };
}
