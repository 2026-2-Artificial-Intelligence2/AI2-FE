import { BufferAttribute, MathUtils, ShaderChunk, TangentSpaceNormalMap, Vector2, Vector3 } from 'three';

const SKIN_NORMAL_STRENGTH = 0.25;
const SKIN_WEIGHT_ATTRIBUTE = 'skinNormalWeight';
const skinNormalMaps = ShaderChunk.normal_fragment_maps.replace(
  'mapN.xy *= normalScale;',
  `mapN.xy *= normalScale * mix(1.0, ${SKIN_NORMAL_STRENGTH}, vSkinNormalWeight);`
);

function readColorMap(map) {
  const { image } = map;
  if (!image?.width || !image.height) return null;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  try {
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  } catch {
    return null;
  }
}

function skinColorWeight(red, green, blue) {
  return MathUtils.smoothstep(red, 130, 175) *
    MathUtils.smoothstep(red - blue, 13, 32) *
    MathUtils.smoothstep(green - blue, 6, 16) *
    MathUtils.smoothstep(red - green, 2, 9);
}

function skinBoneInfluence(name) {
  if (/^(head|neck|(?:hand|fingers[12]|grip)[.]?[LR])$/.test(name)) return 1;
  // The forearm shares influence with the hand near the wrist.
  return /^forearm[.]?[LR]$/.test(name) ? 0.4 : 0;
}

function applySkinNormals(mesh) {
  const { geometry, material, skeleton } = mesh;
  if (geometry.hasAttribute(SKIN_WEIGHT_ATTRIBUTE) || !geometry.index || !material?.map ||
      !material.normalMap || material.normalMapType !== TangentSpaceNormalMap) return;

  const { position, normal, skinIndex, skinWeight } = geometry.attributes;
  const uv = geometry.getAttribute(material.map.channel === 0 ? 'uv' : `uv${material.map.channel}`);
  if (!position || !normal || !skinIndex || !skinWeight || !uv) return;
  const boneInfluences = skeleton.bones.map(bone => skinBoneInfluence(bone.name));
  if (!boneInfluences.some(Boolean)) return;
  const color = readColorMap(material.map);
  if (!color) return;
  if (material.map.matrixAutoUpdate) material.map.updateMatrix();

  const groups = new Map();
  const vertexGroups = [];
  const regionWeights = new Float32Array(position.count);
  for (let i = 0; i < position.count; i++) {
    const key = `${position.getX(i)}:${position.getY(i)}:${position.getZ(i)}`;
    if (!groups.has(key)) groups.set(key, { normal: new Vector3(), area: 0, skinArea: 0 });
    vertexGroups[i] = groups.get(key);
    for (let channel = 0; channel < 4; channel++) {
      const influence = boneInfluences[skinIndex.getComponent(i, channel)] ?? 0;
      regionWeights[i] += influence * skinWeight.getComponent(i, channel);
    }
  }

  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  const texel = new Vector2();
  const { index } = geometry;
  for (let i = 0; i < index.count; i += 3) {
    const first = index.getX(i), second = index.getX(i + 1), third = index.getX(i + 2);
    const regionWeight = MathUtils.smoothstep(
      (regionWeights[first] + regionWeights[second] + regionWeights[third]) / 3, 0.45, 0.82
    );
    a.fromBufferAttribute(position, first);
    b.fromBufferAttribute(position, second).sub(a);
    c.fromBufferAttribute(position, third).sub(a);
    const triangleNormal = b.cross(c);
    const area = triangleNormal.length();
    let skin = 0;
    if (regionWeight > 0) {
      texel.set(
        (uv.getX(first) + uv.getX(second) + uv.getX(third)) / 3,
        (uv.getY(first) + uv.getY(second) + uv.getY(third)) / 3
      );
      material.map.transformUv(texel);
      const x = MathUtils.clamp(Math.floor(texel.x * color.width), 0, color.width - 1);
      const y = MathUtils.clamp(Math.floor(texel.y * color.height), 0, color.height - 1);
      const offset = (y * color.width + x) * 4;
      skin = skinColorWeight(color.data[offset], color.data[offset + 1], color.data[offset + 2]) *
        regionWeight;
    }
    for (const vertex of [first, second, third]) {
      const group = vertexGroups[vertex];
      group.normal.add(triangleNormal);
      group.area += area;
      group.skinArea += skin * area;
    }
  }

  const weights = new Float32Array(position.count);
  const normals = new Float32Array(position.count * 3);
  for (const group of groups.values()) group.normal.normalize();
  let hasSkin = false;
  for (let i = 0; i < position.count; i++) {
    const group = vertexGroups[i];
    const weight = group.area && group.normal.lengthSq() > 0
      ? MathUtils.smoothstep(group.skinArea / group.area, 0.18, 0.82) : 0;
    weights[i] = weight;
    hasSkin ||= weight > 0;
    a.fromBufferAttribute(normal, i);
    if (weight > 0) a.normalize().lerp(group.normal, weight).normalize();
    a.toArray(normals, i * 3);
  }
  if (!hasSkin) return;

  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  geometry.setAttribute(SKIN_WEIGHT_ATTRIBUTE, new BufferAttribute(weights, 1));
  mesh.material = material.clone();
  mesh.material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float skinNormalWeight;\nvarying float vSkinNormalWeight;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSkinNormalWeight = skinNormalWeight;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vSkinNormalWeight;')
      .replace('#include <normal_fragment_maps>', skinNormalMaps);
  };
}

export function smoothCharacterSkin(scene) {
  scene.traverse(object => {
    if (object.isSkinnedMesh) applySkinNormals(object);
  });
}
