/*
 * The home hero's scroll journey, as plain data and pure functions so it can
 * be tested without WebGL. World units are metres. The storefront's glass
 * line is the plane z = 0; the street is z > 0 and the shop runs back to
 * z = -9. The camera follows a cubic Hermite path through timed keys, with
 * tangents from neighbouring keys (non-uniform Catmull-Rom), so its speed is
 * continuous across keys: it never stops at a key unless a key is repeated.
 */

export type Vec3 = readonly [number, number, number];

export interface CameraKey {
  /** Scroll progress, 0–1. */
  at: number;
  position: Vec3;
  /** Point the camera looks at. */
  target: Vec3;
  /** Vertical field of view in degrees. */
  fov: number;
}

/** Scene markers (scroll progress), named after the six beats of the story. */
export const beats = {
  storefront: 0,
  approach: 0.08,
  doorOpens: 0.25,
  threshold: 0.38,
  barberAtWork: 0.5,
  closeUp: 0.72,
  release: 0.9,
} as const;

/** Where the scene's main objects stand, shared by the scene and the path. */
export const layout = {
  doorWidth: 1.2,
  doorHeight: 2.45,
  /** Hinge on the left jamb; the door swings inward (towards -z). */
  doorHinge: [-0.6, 0, 0] as Vec3,
  /** The working chair faces the mirror on the right wall (+x). */
  chair: [1.55, 0, -5.1] as Vec3,
  /** The customer's head, the close-up's subject. */
  head: [1.6, 1.27, -5.1] as Vec3,
  mirrorX: 2.93,
};

const [hx, hy, hz] = layout.head;

export const cameraKeys: CameraKey[] = [
  // 01 Storefront: eye level, across the pavement; the shop sits right of centre, the copy left.
  { at: 0, position: [1.25, 1.62, 11.8], target: [-1.55, 1.85, 0], fov: 36 },
  { at: beats.approach, position: [1.05, 1.62, 10.6], target: [-1.15, 1.78, 0], fov: 36 },
  // 02 Approach: walk up to the door; the facade fills the frame.
  { at: 0.19, position: [0.25, 1.62, 5.0], target: [0, 1.55, 0], fov: 40 },
  // 03 At the door: the camera all but stops while the door swings in…
  { at: 0.26, position: [0.08, 1.61, 2.85], target: [0, 1.5, -1], fov: 44 },
  { at: 0.32, position: [0.04, 1.6, 2.2], target: [0, 1.45, -3], fov: 46 },
  // 03 Through the open door: the jambs pass either side.
  { at: beats.threshold, position: [0, 1.6, -0.4], target: [0.4, 1.4, -6], fov: 50 },
  // 04 Inside: the room opens up, then the working station comes round.
  { at: 0.46, position: [-0.45, 1.62, -2.4], target: [1.6, 1.25, -5.4], fov: 46 },
  { at: 0.58, position: [-0.2, 1.5, -3.45], target: [hx, 1.2, hz], fov: 40 },
  // 05 Close-up: the fade and the clipper, side on.
  { at: beats.closeUp, position: [hx - 0.45, hy + 0.08, hz + 1.25], target: [hx - 0.08, hy - 0.02, hz], fov: 32 },
  // The climax: the back of the fade, the ear and the clipper, slightly from behind.
  { at: 0.84, position: [hx - 0.24, hy + 0.04, hz + 0.74], target: [hx - 0.04, hy - 0.03, hz], fov: 30 },
  // 06 Release: settle, ease back a touch, and hand over to the page.
  { at: 0.93, position: [hx - 0.25, hy + 0.07, hz + 0.82], target: [hx - 0.04, hy - 0.02, hz], fov: 30 },
  { at: 1, position: [hx - 0.26, hy + 0.08, hz + 0.85], target: [hx - 0.04, hy - 0.02, hz], fov: 30 },
];

/**
 * Portrait screens frame the opening differently: the shop centred and set
 * high, above the copy. From the door onwards both paths are the same.
 */
export const portraitCameraKeys: CameraKey[] = [
  { at: 0, position: [0.15, 1.62, 10.2], target: [0, 0.8, 0], fov: 33 },
  { at: beats.approach, position: [0.15, 1.62, 9.2], target: [0, 0.9, 0], fov: 33 },
  { at: 0.19, position: [0.12, 1.62, 5.2], target: [0, 1.45, 0], fov: 38 },
  ...cameraKeys.slice(3, 6),
  // Inside, the narrow frame needs the camera further right to keep the station in view.
  { at: 0.46, position: [0.2, 1.6, -2.35], target: [1.45, 1.3, -5.3], fov: 46 },
  ...cameraKeys.slice(7),
];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** 0 below `from`, 1 above `to`, smooth (C1) in between. */
export function smoothRange(x: number, from: number, to: number): number {
  const t = clamp01((x - from) / (to - from));
  return t * t * (3 - 2 * t);
}

function tangents(keys: CameraKey[], pick: (k: CameraKey) => readonly number[]): number[][] {
  return keys.map((k, i) => {
    const dims = pick(k).length;
    // Zero velocity at both ends: the journey starts and finishes at rest.
    if (i === 0 || i === keys.length - 1) return Array(dims).fill(0);
    const prev = keys[i - 1];
    const next = keys[i + 1];
    const dt = next.at - prev.at;
    return pick(next).map((v, d) => (v - pick(prev)[d]) / dt);
  });
}

function hermite(p0: number, m0: number, p1: number, m1: number, t: number, h: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * h * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * h * m1;
}

export interface CameraPath {
  sample(progress: number): { position: Vec3; target: Vec3; fov: number };
}

export function createCameraPath(keys: CameraKey[] = cameraKeys): CameraPath {
  const pos = tangents(keys, (k) => k.position);
  const tgt = tangents(keys, (k) => k.target);
  const fov = tangents(keys, (k) => [k.fov]);
  return {
    sample(progress) {
      const p = clamp01(progress);
      let i = 0;
      while (i < keys.length - 2 && p > keys[i + 1].at) i++;
      const a = keys[i];
      const b = keys[i + 1];
      const h = b.at - a.at;
      const t = h > 0 ? (p - a.at) / h : 0;
      const lerp = (from: readonly number[], to: readonly number[], m: number[][]) =>
        from.map((v, d) => hermite(v, m[i][d], to[d], m[i + 1][d], t, h));
      return {
        position: lerp(a.position, b.position, pos) as unknown as Vec3,
        target: lerp(a.target, b.target, tgt) as unknown as Vec3,
        fov: lerp([a.fov], [b.fov], fov)[0],
      };
    },
  };
}

/** Door angle in radians (negative swings it inward), fully open before the camera reaches the glass. */
export function doorAngle(progress: number): number {
  return -smoothRange(progress, beats.doorOpens, 0.335) * (Math.PI * 0.56);
}

/** Opacity of the hand-over wash to the page canvas. */
export function washOpacity(progress: number): number {
  return smoothRange(progress, 0.955, 1);
}

/** Opacity of the opening copy and of the closing call to action. */
export function overlayOpacity(progress: number): { intro: number; finale: number } {
  return {
    intro: 1 - smoothRange(progress, 0.025, 0.1),
    finale: smoothRange(progress, beats.release, 0.95),
  };
}
