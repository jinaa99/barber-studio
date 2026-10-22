import { test as nodeTest } from "node:test";
import assert from "node:assert/strict";
import { beats, cameraKeys, createCameraPath, doorAngle, layout, overlayOpacity, portraitCameraKeys, washOpacity, type CameraKey } from "./journey";

const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(...a.map((v, i) => v - b[i]));

for (const [name, keys] of [
  ["landscape", cameraKeys],
  ["portrait", portraitCameraKeys],
] as [string, CameraKey[]][]) {
  const path = createCameraPath(keys);
  const steps = 2000;
  const samples = Array.from({ length: steps + 1 }, (_, i) => ({ p: i / steps, ...path.sample(i / steps) }));
  const test = (title: string, fn: () => void) => nodeTest(`${name}: ${title}`, fn);

  test("keys are ordered and span the whole scroll", () => {
    assert.equal(keys[0].at, 0);
    assert.equal(keys.at(-1)!.at, 1);
    for (let i = 1; i < keys.length; i++) assert.ok(keys[i].at > keys[i - 1].at);
  });

  test("the path passes through every key", () => {
    for (const key of keys) {
      const s = path.sample(key.at);
      assert.ok(dist(s.position, key.position) < 1e-9, `position at ${key.at}`);
      assert.ok(dist(s.target, key.target) < 1e-9, `target at ${key.at}`);
    }
  });

  test("no jumps: position, aim and lens change gradually in both directions", () => {
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1];
      const b = samples[i];
      // At most 5 cm of travel per 1/2000 of the scroll (the longest walk is ~10 m).
      assert.ok(dist(a.position, b.position) < 0.05, `position jump at ${b.p}`);
      assert.ok(Math.abs(a.fov - b.fov) < 0.1, `fov jump at ${b.p}`);
      const dirA = a.target.map((v, d) => v - a.position[d]);
      const dirB = b.target.map((v, d) => v - b.position[d]);
      const cos = dirA.reduce((s, v, d) => s + v * dirB[d], 0) / (Math.hypot(...dirA) * Math.hypot(...dirB));
      assert.ok(cos > Math.cos((1.5 * Math.PI) / 180), `aim swings more than 1.5° at ${b.p}`);
    }
    // Sampling is a pure function of progress, so scrolling back retraces the same frames.
    assert.deepEqual(path.sample(0.4321), path.sample(0.4321));
  });

  test("starts outside at eye level and ends inside at the haircut", () => {
    const start = path.sample(0);
    assert.ok(start.position[2] > 8, "starts across the pavement");
    assert.ok(start.position[1] > 1.5 && start.position[1] < 1.75, "human eye level");
    const end = path.sample(1);
    assert.ok(end.position[2] < -3, "ends inside the shop");
    assert.ok(dist(end.position, layout.head) < 1, "ends close to the haircut");
  });

  test("the camera fits through the doorway and never enters the walls or the customer", () => {
    const half = layout.doorWidth / 2;
    for (const s of samples) {
      const [x, y, z] = s.position;
      if (z < 0.35 && z > -0.35) {
        assert.ok(Math.abs(x) < half - 0.2, `clears the jambs at ${s.p}`);
        assert.ok(y > 0.4 && y < layout.doorHeight - 0.2, `clears the head of the frame at ${s.p}`);
        assert.ok(Math.abs(doorAngle(s.p)) > 1.5, `door is open at ${s.p}`);
      }
      if (z < -0.35) {
        assert.ok(x > -2.7 && x < layout.mirrorX - 0.3 && z > -8.7 && y < 3, `inside the room at ${s.p}`);
        assert.ok(dist(s.position, layout.head) > 0.3, `outside the customer's head at ${s.p}`);
      }
    }
  });
}

nodeTest("door, overlays and wash follow the beats", () => {
  assert.equal(Math.abs(doorAngle(0)), 0);
  assert.equal(Math.abs(doorAngle(beats.doorOpens)), 0);
  assert.ok(doorAngle(beats.threshold) < -1.7);
  assert.equal(overlayOpacity(0).intro, 1);
  assert.equal(overlayOpacity(0.2).intro, 0);
  assert.equal(overlayOpacity(0.5).finale, 0);
  assert.equal(overlayOpacity(1).finale, 1);
  assert.equal(washOpacity(0.9), 0);
  assert.equal(washOpacity(1), 1);
});
