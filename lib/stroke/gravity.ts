/**
 * Gravity correction helpers.
 *
 * The WitMotion BWT901 reports its on-device fused Euler angles (`roll`,
 * `pitch`, `yaw`) alongside every accelerometer frame. Those angles let us
 * subtract gravity in a stable frame instead of leaning on a slow EMA "rest"
 * estimate that gets pulled around by every long stroke.
 *
 * Conventions
 * -----------
 *   - Angles are in **degrees** (WitMotion native).
 *   - Rotation order is **ZYX intrinsic** (yaw → pitch → roll), which is the
 *     standard aerospace / WitMotion convention. The body frame is the
 *     sensor's right-handed frame: +X out the front face of the case, +Y out
 *     the left, +Z out the top.
 *   - Gravity is reported as the **perceived acceleration vector** the
 *     accelerometer would read at rest in that orientation: when the sensor
 *     is flat (roll = pitch = yaw = 0) the accelerometer reports `+g` on
 *     the Z axis (reaction force pushing the case up off the table), so
 *     `gravityFromAngle({ roll: 0, pitch: 0, yaw: 0 }) = (0, 0, +g)`.
 *   - Yaw drops out: rotation around the world's vertical axis cannot
 *     change the gravity vector in the body frame. Only roll and pitch
 *     matter, but we accept the full Euler triplet so callers can pass the
 *     decoder output verbatim.
 *
 * Math
 * ----
 * For ZYX intrinsic rotation `R = Rz(yaw) · Ry(pitch) · Rx(roll)`, the
 * gravity vector in the body frame is `R^T · g_world`. With
 * `g_world = (0, 0, +g)`, that simplifies to `g · (third column of R)`,
 * which works out to:
 *
 *     g_x =  g · ( cos(yaw)·sin(pitch)·cos(roll) + sin(yaw)·sin(roll) )
 *     g_y =  g · ( sin(yaw)·sin(pitch)·cos(roll) − cos(yaw)·sin(roll) )
 *     g_z =  g ·   cos(pitch)·cos(roll)
 *
 * Sanity-checked against three orientations in the unit tests (flat /
 * pitched 90° / rolled 90°).
 *
 * Cross-check
 * -----------
 * The same convention is used by an `eulerRotationMatrix(roll, pitch, yaw)`
 * helper from the Dart side of the project, whose third column matches our
 * (g_x, g_y, g_z) above term-for-term. That gives us two independent
 * derivations of the same formula.
 */

import { GRAVITY_MPS2 } from "@/lib/units/constants";

import type { Angle, Vec3Sample } from "./types";

const DEG_TO_RAD = Math.PI / 180;

/**
 * Compute the gravity vector in the sensor (body) frame for a given
 * Euler-angle attitude. Returns the perceived-acceleration form, i.e. the
 * vector an accelerometer would read at rest in that orientation.
 */
export function gravityFromAngle(angle: Angle): Vec3Sample {
  const r = angle.roll * DEG_TO_RAD;
  const p = angle.pitch * DEG_TO_RAD;
  const y = angle.yaw * DEG_TO_RAD;
  const sr = Math.sin(r);
  const cr = Math.cos(r);
  const sp = Math.sin(p);
  const cp = Math.cos(p);
  const sy = Math.sin(y);
  const cy = Math.cos(y);

  return {
    x: GRAVITY_MPS2 * (cy * sp * cr + sy * sr),
    y: GRAVITY_MPS2 * (sy * sp * cr - cy * sr),
    z: GRAVITY_MPS2 * (cp * cr),
  };
}

/**
 * Subtract `gravity` from `accel` element-wise. The result is the linear
 * acceleration of the sensor (i.e. the part the user actually generates).
 */
export function subtractGravity(
  accel: Vec3Sample,
  gravity: Vec3Sample,
): Vec3Sample {
  return {
    x: accel.x - gravity.x,
    y: accel.y - gravity.y,
    z: accel.z - gravity.z,
  };
}
