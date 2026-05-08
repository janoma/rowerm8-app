import { gravityFromAngle, subtractGravity } from "@/lib/stroke/gravity";
import { GRAVITY_MPS2 } from "@/lib/units";

const G = GRAVITY_MPS2;
const EPS = 1e-9;

describe("gravityFromAngle", () => {
  it("flat (roll=pitch=yaw=0) → +g on Z, zero on X/Y", () => {
    const g = gravityFromAngle({ roll: 0, pitch: 0, yaw: 0 });
    expect(g.x).toBeCloseTo(0, 9);
    expect(g.y).toBeCloseTo(0, 9);
    expect(g.z).toBeCloseTo(G, 9);
  });

  it("pitched +90° → +g on X (nose up exposes +x to the sky)", () => {
    const g = gravityFromAngle({ roll: 0, pitch: 90, yaw: 0 });
    expect(g.x).toBeCloseTo(G, 9);
    expect(g.y).toBeCloseTo(0, 9);
    expect(Math.abs(g.z)).toBeLessThan(EPS);
  });

  it("rolled +90° → −g on Y (right-side roll buries +y)", () => {
    const g = gravityFromAngle({ roll: 90, pitch: 0, yaw: 0 });
    expect(Math.abs(g.x)).toBeLessThan(EPS);
    expect(g.y).toBeCloseTo(-G, 9);
    expect(Math.abs(g.z)).toBeLessThan(EPS);
  });

  it("yaw alone does not change the gravity vector", () => {
    const flat = gravityFromAngle({ roll: 0, pitch: 0, yaw: 0 });
    const yawed90 = gravityFromAngle({ roll: 0, pitch: 0, yaw: 90 });
    const yawed180 = gravityFromAngle({ roll: 0, pitch: 0, yaw: 180 });
    expect(yawed90.x).toBeCloseTo(flat.x, 9);
    expect(yawed90.y).toBeCloseTo(flat.y, 9);
    expect(yawed90.z).toBeCloseTo(flat.z, 9);
    expect(yawed180.x).toBeCloseTo(flat.x, 9);
    expect(yawed180.y).toBeCloseTo(flat.y, 9);
    expect(yawed180.z).toBeCloseTo(flat.z, 9);
  });

  it("magnitude is always exactly g for any orientation", () => {
    const orientations = [
      { roll: 0, pitch: 0, yaw: 0 },
      { roll: 30, pitch: -45, yaw: 17 },
      { roll: -120, pitch: 20, yaw: 200 },
      { roll: 89, pitch: 89, yaw: -179 },
    ];
    for (const a of orientations) {
      const g = gravityFromAngle(a);
      const mag = Math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z);
      expect(mag).toBeCloseTo(G, 9);
    }
  });
});

describe("subtractGravity", () => {
  it("returns the per-axis difference of accel and gravity", () => {
    const accel = { x: 1, y: 2, z: 3 };
    const gravity = { x: 0.5, y: 1, z: 2 };
    const lin = subtractGravity(accel, gravity);
    expect(lin.x).toBe(0.5);
    expect(lin.y).toBe(1);
    expect(lin.z).toBe(1);
  });

  it("zeros out a stationary sensor (accel ≈ gravity at rest)", () => {
    const angle = { roll: 12, pitch: -7, yaw: 130 };
    const gravity = gravityFromAngle(angle);
    // At rest, the accelerometer reads exactly gravity in the body frame.
    const accel = { ...gravity };
    const lin = subtractGravity(accel, gravity);
    expect(Math.abs(lin.x)).toBeLessThan(EPS);
    expect(Math.abs(lin.y)).toBeLessThan(EPS);
    expect(Math.abs(lin.z)).toBeLessThan(EPS);
  });
});
