import * as THREE from 'three';
import { box } from '../../shared/scene/character.js';
import { createMeetingPerformance, furnishMeetingRoom } from '../meeting/meeting-performance.js';

export function addMeetingWindow(office) {
  const room = new THREE.Group();
  const centreZ = -2.6;
  room.position.set(-8.5, 0, centreZ);
  room.rotation.y = Math.PI / 2;
  office.add(room);
  furnishMeetingRoom(room, 1.6);

  const actors = new THREE.Group();
  actors.visible = false;
  room.add(actors);
  const animate = createMeetingPerformance(actors);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const wallX = -6.9;
  box(office, [0.14, 3.65, 5.2], [wallX, 1.82, 2.9], 0xd2d9d2).castShadow = false;
  box(office, [0.14, 0.06, 5.8], [wallX, 0.03, centreZ], 0xb8c8cf);
  box(office, [0.14, 1.06, 5.8], [wallX, 3.12, centreZ], 0xd2d9d2).castShadow = false;
  for (const offset of [-2.86, 2.86]) {
    box(office, [0.17, 2.55, 0.10], [wallX, 1.32, centreZ + offset], 0x4e6572);
  }
  for (const y of [0.06, 2.59]) {
    box(office, [0.17, 0.09, 5.8], [wallX, y, centreZ], 0x4e6572);
  }

  const glass = new THREE.Mesh(new THREE.PlaneGeometry(5.68, 2.46), new THREE.MeshBasicMaterial({
    color: 0x9ed2e8, transparent: true, opacity: 0.16, depthWrite: false,
  }));
  glass.rotation.y = Math.PI / 2;
  glass.position.set(wallX + 0.09, 1.32, centreZ);
  glass.userData.disposeWithOffice = true;
  office.add(glass);
  const sheen = glass.clone();
  sheen.geometry = glass.geometry.clone();
  sheen.material = glass.material.clone();
  sheen.material.opacity = 0.08;
  sheen.scale.y = 0.08;
  sheen.position.y = 1.84;
  sheen.position.x += 0.004;
  office.add(sheen);

  return {
    update(meetingStarted, now) {
      actors.visible = meetingStarted !== undefined;
      if (actors.visible) animate(Math.max(0, (now - meetingStarted) / 1000), reducedMotion);
    },
  };
}
