import { MathUtils, Quaternion, Vector3 } from 'three';
import { DESK_DROP } from './furnishings.js';

// Metres in the worker's local scene, measured from each GLB's desk pose.
const seating = {
  young_worker:      { soleY: 0.047, seatTop: 0.320, backZ: -0.256, wristY: 0.866 },
  male_1_glasses:    { soleY: 0.039, seatTop: 0.302, backZ: -0.233, wristY: 0.875 },
  female_1_bob:      { soleY: 0.036, seatTop: 0.309, backZ: -0.199, wristY: 0.861 },
  male_2_hoodie:     { soleY: 0.036, seatTop: 0.297, backZ: -0.233, wristY: 0.900 },
  female_2_ponytail: { soleY: 0.036, seatTop: 0.332, backZ: -0.193, wristY: 0.861 },
  male_3_cardigan:   { soleY: 0.039, seatTop: 0.326, backZ: -0.230, wristY: 0.900 },
  female_3_jacket:   { soleY: 0.027, seatTop: 0.367, backZ: -0.230, wristY: 0.911 },
  male_4_plaid:      { soleY: 0.037, seatTop: 0.319, backZ: -0.221, wristY: 0.906 },
};

const position = object => object.getWorldPosition(new Vector3());
const rotation = object => object.getWorldQuaternion(new Quaternion());

function aimJoint(joint, child, target) {
  const pivot = position(joint);
  const from = position(child).sub(pivot).normalize();
  const to = target.clone().sub(pivot).normalize();
  const change = new Quaternion().setFromUnitVectors(from, to);
  const parent = rotation(joint.parent);
  joint.quaternion.premultiply(parent.clone().invert().multiply(change).multiply(parent));
  joint.updateWorldMatrix(false, true);
}

export function fitArm(upperArm, forearm, hand, target, forward, elbowHint) {
  const shoulder = position(upperArm);
  const elbow = position(forearm);
  const wrist = position(hand);
  const handRotation = rotation(hand);
  const upperLength = shoulder.distanceTo(elbow);
  const lowerLength = elbow.distanceTo(wrist);
  const direction = target.clone().sub(shoulder);
  const length = MathUtils.clamp(direction.length(),
    Math.abs(upperLength - lowerLength) + 0.001, upperLength + lowerLength - 0.001);
  direction.normalize();
  const along = (upperLength ** 2 - lowerLength ** 2 + length ** 2) / (2 * length);
  const bend = elbowHint.sub(shoulder);
  bend.addScaledVector(direction, -bend.dot(direction)).normalize();
  const elbowTarget = shoulder.clone().addScaledVector(direction, along)
    .addScaledVector(bend, Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2)));
  aimJoint(upperArm, forearm, elbowTarget);
  aimJoint(forearm, hand, shoulder.clone().addScaledVector(direction, length));

  const fingers = new Vector3(0, 1, 0).applyQuaternion(handRotation);
  handRotation.premultiply(new Quaternion().setFromUnitVectors(fingers, forward));
  hand.quaternion.copy(rotation(forearm).invert().multiply(handRotation));
}

export function fitDeskWorker(person, name) {
  const measurements = seating[name];
  if (!measurements) return [];
  const arms = ['L', 'R'].map(side => [
    person.bone('upper_arm.' + side),
    person.bone('forearm.' + side),
    person.bone('hand.' + side),
  ]);
  if (arms.some(arm => arm.some(joint => !joint))) return [];

  const { soleY, seatTop, backZ, wristY } = measurements;
  person.model.position.y -= soleY;
  person.root.updateMatrixWorld(true);
  person.fitChair(seatTop, backZ);

  const forward = new Vector3(0, -0.19, 1).normalize().applyQuaternion(rotation(person.root));
  return arms.flatMap((joints, index) => {
    const side = index === 0 ? 1 : -1;
    const height = MathUtils.clamp(wristY - DESK_DROP, 0.703, 0.722);
    const target = person.root.localToWorld(new Vector3(side * 0.114, height, 0.276));
    const elbowHint = person.root.localToWorld(new Vector3(side * 0.29, height - 0.016, 0.11));
    fitArm(...joints, target, forward, elbowHint);
    const resting = joints.map(joint => joint.quaternion.clone());
    const raised = person.root.localToWorld(new Vector3(side * 0.114, height + 0.008, 0.278));
    fitArm(...joints, raised, forward, elbowHint);
    const tapping = joints.map(joint => joint.quaternion.clone());
    return joints.map((joint, i) => {
      joint.quaternion.copy(resting[i]);
      return [joint, resting[i], tapping[i], index];
    });
  });
}
