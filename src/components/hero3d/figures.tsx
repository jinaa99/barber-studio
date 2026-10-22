"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { layout } from "@/lib/hero/journey";
import { ContactShadow, cushion, roundedBox, useKit } from "./kit";
import { rng } from "./textures";

/*
 * The people. Both heads use a real 3D head scan ("Infinite, 3D Head Scan" by
 * Lee Perry-Smith, CC BY 3.0, see docs/MEDIA.md), trimmed below the neck,
 * scaled to a 23 cm head and lit with its own colour and normal maps. Hair is
 * real geometry grown on the scan's surface: tens of thousands of short
 * tapered strands whose density and length follow a skin-fade mask, over a
 * soft stubble gradient. Bodies, clothing and hands are built here.
 *
 * The customer faces +x (the mirror). Their right side (+z) faces the aisle,
 * where the camera arrives for the close-up.
 */

const HEAD = new THREE.Vector3(...layout.head);
/** Scan units → metres (crown to chin ≈ 5.7 scan units ≈ 23 cm). */
const SCAN_SCALE = 0.0405;
/** The scan point that sits at `layout.head` (roughly the middle of the skull). */
const SCAN_ANCHOR = new THREE.Vector3(0, 0.55, -0.35);
/** Everything below this (scan units) is shoulders: cut away, the cape and collars cover the join. */
const NECK_CUT = -2.55;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/* ------------------------------------------------------------ Head scan */

/** The scan with the shoulders removed (triangles entirely below the cut). */
function trimmedHead(source: THREE.BufferGeometry, cut = NECK_CUT, napeLift = 0) {
  const g = source.index ? source.toNonIndexed() : source.clone();
  const pos = g.getAttribute("position");
  const keep: number[] = [];
  for (let i = 0; i < pos.count; i += 3) {
    // The cut can rise towards the back of the neck (napeLift), where a collar has to hide it.
    const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const local = cut + napeLift * smooth(0.5, -1.5, z);
    if (Math.max(pos.getY(i), pos.getY(i + 1), pos.getY(i + 2)) > local) keep.push(i);
  }
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(g.attributes)) {
    const src = g.getAttribute(name);
    const arr = new Float32Array(keep.length * 3 * src.itemSize);
    keep.forEach((tri, k) => {
      for (let j = 0; j < 3; j++) for (let c = 0; c < src.itemSize; c++) arr[(k * 3 + j) * src.itemSize + c] = src.getComponent(tri + j, c);
    });
    out.setAttribute(name, new THREE.BufferAttribute(arr, src.itemSize));
  }
  g.dispose();
  out.computeBoundingSphere();
  return out;
}

type Mask = (x: number, y: number, z: number) => { density: number; length: number };

/**
 * Skin fade in scan space (x across, y up, z towards the face): dense on top,
 * thinning through the fade down the sides and back, a forehead hairline,
 * a short sideburn, nothing on the face, ears or neck.
 */
const fadeMask: Mask = (x, y, z) => {
  const side = Math.abs(x);
  // Fade line rises from the nape at the back to the temple at the sides.
  const bottom = THREE.MathUtils.lerp(-1.0, 0.15, smooth(-1.8, 0.6, z));
  const top = bottom + 1.4;
  let density = smooth(bottom, top, y);
  // Forehead hairline and the face.
  if (z > 0.9) density *= smooth(2.35, 2.75, y + (side > 1.6 ? 0.55 : 0));
  // Ears (and just around them).
  if (side > 2.15 && y > -1.0 && y < 1.4 && z > -0.9 && z < 1.1) density = 0;
  // Sideburn: a short strip in front of the ear.
  if (side > 2.0 && z > 0.9 && z < 1.45 && y > 0.35 && y < 1.3) density = Math.max(density, 0.5);
  if (y < -1.4) density = 0;
  const length = 0.001 + 0.0125 * smooth(0.8, 3.3, y) * (z > -0.6 ? 1 : 0.85);
  return { density, length };
};

/** Short, slightly shaped hair on the barber, plus a close beard. */
const barberMask: Mask = (x, y, z) => {
  const side = Math.abs(x);
  let density = smooth(0.2, 1.4, y);
  if (z > 0.9) density *= smooth(2.3, 2.7, y + (side > 1.6 ? 0.5 : 0));
  if (side > 2.15 && y > -1.0 && y < 1.4 && z > -0.9 && z < 1.1) density = 0;
  // Beard over the jaw, chin and upper lip; not over the mouth.
  const beard = z > 0.2 && y < 0.1 && y > -2.4 && !(z > 2.0 && y > -0.9 && y < -0.2 && side < 0.9);
  if (beard) density = Math.max(density, 0.85 * smooth(-0.2, 0.6, z));
  if (y < -2.4) density = 0;
  const length = beard ? 0.004 : 0.002 + 0.007 * smooth(1.0, 3.3, y);
  return { density, length };
};

/**
 * Hair strands grown on a mesh: area-weighted sample points accepted by the
 * mask, each a thin tapered triangle leaning along the surface (combed back
 * and down), shaded with the scalp normal so the coat lights like hair.
 * Built in scan units; mask lengths are in metres.
 */
function growHair(head: THREE.BufferGeometry, mask: Mask, count: number, seed: number, tone: [THREE.Color, THREE.Color]) {
  const random = rng(seed);
  const pos = head.getAttribute("position");
  const nrm = head.getAttribute("normal");
  const tris = pos.count / 3;
  const weights = new Float32Array(tris);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  let total = 0;
  for (let t = 0; t < tris; t++) {
    a.fromBufferAttribute(pos, t * 3);
    b.fromBufferAttribute(pos, t * 3 + 1);
    c.fromBufferAttribute(pos, t * 3 + 2);
    const area = e1.subVectors(b, a).cross(e2.subVectors(c, a)).length() / 2;
    const cx = (a.x + b.x + c.x) / 3;
    const cy = (a.y + b.y + c.y) / 3;
    const cz = (a.z + b.z + c.z) / 3;
    total += area * Math.min(1, mask(cx, cy, cz).density + 0.02);
    weights[t] = total;
  }
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();
  const comb = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const root = new THREE.Vector3();
  const tip = new THREE.Vector3();
  const col = new THREE.Color();
  const unit = 1 / SCAN_SCALE;
  for (let k = 0; k < count; k++) {
    // Pick a triangle by area × density, then a point in it.
    const r = random() * total;
    let lo = 0;
    let hi = tris - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (weights[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    let u = random();
    let v = random();
    if (u + v > 1) [u, v] = [1 - u, 1 - v];
    const w = 1 - u - v;
    a.fromBufferAttribute(pos, lo * 3);
    b.fromBufferAttribute(pos, lo * 3 + 1);
    c.fromBufferAttribute(pos, lo * 3 + 2);
    p.set(0, 0, 0).addScaledVector(a, w).addScaledVector(b, u).addScaledVector(c, v);
    const m = mask(p.x, p.y, p.z);
    // Thin out stochastically through the fade (the weights only roughed it in).
    if (random() > Math.pow(m.density, 1.4)) continue;
    n.set(0, 0, 0)
      .addScaledVector(a.fromBufferAttribute(nrm, lo * 3), w)
      .addScaledVector(b.fromBufferAttribute(nrm, lo * 3 + 1), u)
      .addScaledVector(c.fromBufferAttribute(nrm, lo * 3 + 2), v)
      .normalize();
    // Combed back and slightly down the sides; the top stands up a little more.
    comb.set((random() - 0.5) * 0.6, -0.35, -1).normalize();
    tangent.copy(comb).addScaledVector(n, -comb.dot(n)).normalize();
    const lift = 0.18 + 0.3 * smooth(2.2, 3.7, p.y) + random() * 0.15;
    const length = m.length * (0.75 + random() * 0.5) * unit;
    dir.copy(tangent).multiplyScalar(1 - lift).addScaledVector(n, lift).normalize();
    side.crossVectors(dir, n).normalize();
    const width = (0.00028 + random() * 0.00012) * unit;
    root.copy(p).addScaledVector(n, -0.00015 * unit);
    tip.copy(p).addScaledVector(dir, length);
    positions.push(
      root.x - side.x * width, root.y - side.y * width, root.z - side.z * width,
      root.x + side.x * width, root.y + side.y * width, root.z + side.z * width,
      tip.x, tip.y, tip.z,
    );
    for (let j = 0; j < 3; j++) normals.push(n.x, n.y, n.z);
    col.copy(tone[0]).lerp(tone[1], random() * 0.6);
    const shade = 0.75 + random() * 0.35;
    // Roots darker than tips: reads as depth in the coat.
    colors.push(col.r * 0.55, col.g * 0.55, col.b * 0.55, col.r * 0.55, col.g * 0.55, col.b * 0.55, col.r * shade, col.g * shade, col.b * shade);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.computeBoundingSphere();
  return g;
}

/** A darker, partly transparent copy of the scalp that carries the fade gradient on the skin. */
function stubble(head: THREE.BufferGeometry, mask: Mask) {
  const g = head.clone();
  const pos = g.getAttribute("position");
  const nrm = g.getAttribute("normal");
  const rgba = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    const d = mask(pos.getX(i), pos.getY(i), pos.getZ(i)).density;
    rgba.set([1, 1, 1, Math.min(0.92, Math.pow(d, 0.7) * 0.95)], i * 4);
    // A hair's breadth above the skin.
    pos.setXYZ(i, pos.getX(i) + nrm.getX(i) * 0.012, pos.getY(i) + nrm.getY(i) * 0.012, pos.getZ(i) + nrm.getZ(i) * 0.012);
  }
  g.setAttribute("color", new THREE.BufferAttribute(rgba, 4));
  g.deleteAttribute("uv");
  return g;
}

function useHeadGeometry(mask: Mask, strands: number, seed: number, tone: [string, string], cut: number, napeLift: number) {
  const { assets } = useKit();
  const [toneA, toneB] = tone;
  const g = useMemo(() => {
    const head = trimmedHead(assets.head.geometry, cut, napeLift);
    return {
      head,
      stubble: stubble(head, mask),
      hair: growHair(head, mask, strands, seed, [new THREE.Color(toneA), new THREE.Color(toneB)]),
    };
  }, [assets, mask, strands, seed, toneA, toneB, cut, napeLift]);
  useEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  return g;
}

/** A scanned head with its hair, placed so the scan anchor sits at `position`, facing local +x. */
function ScannedHead({
  position,
  rotation = [0, 0, 0],
  mask,
  strands,
  seed,
  tone,
  skin,
  headRef,
  cut = NECK_CUT,
  napeLift = 0,
}: {
  cut?: number;
  napeLift?: number;
  position: [number, number, number];
  rotation?: [number, number, number];
  mask: Mask;
  strands: number;
  seed: number;
  tone: [string, string];
  skin: THREE.Material;
  headRef?: React.RefObject<THREE.Group | null>;
}) {
  const { m } = useKit();
  const g = useHeadGeometry(mask, strands, seed, tone, cut, napeLift);
  return (
    <group ref={headRef} position={position} rotation={rotation}>
      {/* The scan faces +z; a quarter turn makes the face look along +x. */}
      <group rotation-y={Math.PI / 2} scale={SCAN_SCALE}>
        <group position={[-SCAN_ANCHOR.x, -SCAN_ANCHOR.y, -SCAN_ANCHOR.z]}>
          <mesh geometry={g.head} material={skin} castShadow receiveShadow />
          <mesh geometry={g.stubble} material={m.stubble} renderOrder={3} />
          <mesh geometry={g.hair} material={m.hair} castShadow />
        </group>
      </group>
    </group>
  );
}

/* --------------------------------------------------------------- Hands */

/**
 * A hand: palm, four three-segment fingers and a two-segment thumb. `curl`
 * bends each finger (radians per joint) and `spread` fans them, so the same
 * hand can wrap a clipper or hold a comb. Built along local -y (wrist at the
 * origin, fingers pointing down -y, palm facing +z).
 */
function Hand({ curl, thumb, spread = 0.06, material }: { curl: number[]; thumb: [number, number]; spread?: number; material: THREE.Material }) {
  const g = useMemo(
    () => ({
      palm: cushion(0.078, 0.088, 0.026, 0.6, 10),
      seg: new THREE.CapsuleGeometry(0.0085, 0.022, 4, 10),
      tip: new THREE.CapsuleGeometry(0.008, 0.014, 4, 10),
      knuckle: new THREE.SphereGeometry(0.0095, 10, 8),
    }),
    [],
  );
  useEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  const fingers = [-0.029, -0.0095, 0.0095, 0.028];
  const lengths = [0.92, 1, 0.97, 0.8];
  return (
    <group>
      {/* Palm narrowing towards the wrist. */}
      <mesh position={[0, -0.046, 0]} scale={[1, 1, 1]} geometry={g.palm} material={material} castShadow />
      <mesh position={[0, -0.004, -0.002]} scale={[0.62, 0.35, 0.8]} geometry={g.palm} material={material} />
      {fingers.map((x, i) => (
        <group key={x} position={[x, -0.088, 0.002]} rotation={[-(curl[i] ?? 0), 0, (i - 1.5) * spread]}>
          <mesh geometry={g.knuckle} material={material} />
          <group scale={lengths[i]}>
            <mesh position={[0, -0.018, 0]} geometry={g.seg} material={material} castShadow />
            <group position={[0, -0.036, 0]} rotation-x={-(curl[i] ?? 0) * 1.1}>
              <mesh position={[0, -0.014, 0]} geometry={g.seg} material={material} scale={[0.95, 0.75, 0.95]} castShadow />
              <group position={[0, -0.028, 0]} rotation-x={-(curl[i] ?? 0) * 0.8}>
                <mesh position={[0, -0.01, 0]} geometry={g.tip} material={material} castShadow />
              </group>
            </group>
          </group>
        </group>
      ))}
      {/* Thumb from the side of the palm (-x), opposing the fingers. */}
      <group position={[-0.04, -0.03, 0.012]} rotation={[-thumb[0], 0.4, 0.9]}>
        <mesh position={[0, -0.016, 0]} geometry={g.seg} material={material} scale={[1.15, 1, 1.15]} castShadow />
        <group position={[0, -0.032, 0]} rotation-x={-thumb[1]}>
          <mesh position={[0, -0.012, 0]} geometry={g.tip} material={material} scale={1.1} castShadow />
        </group>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------- Clipper */

/**
 * A professional corded clipper: extruded two-tone housing, rubber grip
 * ribs, the blade set (stationary blade with individual teeth, the moving
 * cutter behind it, screws), a taper lever, a slide switch and a cord with
 * strain relief. Local frame: cutting edge at the origin, body hanging down
 * -y, teeth pointing +y, width along x, thickness along z.
 */
export function Clipper({ cord = true }: { cord?: boolean }) {
  const { m } = useKit();
  const g = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.023, 0);
    s.lineTo(0.023, 0);
    s.bezierCurveTo(0.024, -0.03, 0.021, -0.06, 0.0185, -0.09);
    s.bezierCurveTo(0.017, -0.12, 0.019, -0.14, 0.013, -0.158);
    s.quadraticCurveTo(0, -0.166, -0.013, -0.158);
    s.bezierCurveTo(-0.019, -0.14, -0.017, -0.12, -0.0185, -0.09);
    s.bezierCurveTo(-0.021, -0.06, -0.024, -0.03, -0.023, 0);
    const body = new THREE.ExtrudeGeometry(s, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.0075, bevelSize: 0.0055, bevelSegments: 6, curveSegments: 24 });
    body.translate(0, 0, -0.009);
    body.computeVertexNormals();
    const cs = new THREE.Shape();
    cs.moveTo(-0.019, -0.004);
    cs.lineTo(0.019, -0.004);
    cs.bezierCurveTo(0.0195, -0.04, 0.0175, -0.07, 0.0155, -0.098);
    cs.quadraticCurveTo(0, -0.106, -0.0155, -0.098);
    cs.bezierCurveTo(-0.0175, -0.07, -0.0195, -0.04, -0.019, -0.004);
    const cover = new THREE.ExtrudeGeometry(cs, { depth: 0.002, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.001, bevelSegments: 3, curveSegments: 18 });
    cover.computeVertexNormals();
    const tooth = new THREE.BoxGeometry(0.0011, 0.0055, 0.0011);
    tooth.translate(0, 0.00275, 0);
    const cutterTooth = new THREE.BoxGeometry(0.0012, 0.0032, 0.0008);
    cutterTooth.translate(0, 0.0016, 0);
    const screw = new THREE.CylinderGeometry(0.0022, 0.0022, 0.0012, 16);
    screw.rotateX(Math.PI / 2);
    const knob = new THREE.CylinderGeometry(0.0045, 0.0045, 0.006, 18);
    knob.rotateZ(Math.PI / 2);
    return {
      body,
      cover,
      rib: roundedBox(0.0035, 0.034, 0.016, 0.0015, 2),
      tooth,
      cutterTooth,
      bladePlate: roundedBox(0.047, 0.012, 0.0018, 0.002, 2),
      housing: roundedBox(0.045, 0.012, 0.03, 0.004, 3),
      screw,
      lever: roundedBox(0.004, 0.026, 0.006, 0.0015, 2),
      knob,
      slide: roundedBox(0.012, 0.018, 0.004, 0.0018, 2),
      relief: new THREE.CylinderGeometry(0.0045, 0.0032, 0.022, 16),
      cord: cord
        ? new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3([
              new THREE.Vector3(0, -0.18, 0),
              new THREE.Vector3(0.01, -0.26, 0.03),
              new THREE.Vector3(0.05, -0.36, 0.02),
              new THREE.Vector3(0.08, -0.5, -0.05),
              new THREE.Vector3(0.06, -0.7, -0.12),
            ]),
            48,
            0.0028,
            8,
            false,
          )
        : null,
    };
  }, [cord]);
  useEffect(() => () => Object.values(g).forEach((x) => x?.dispose()), [g]);

  const teeth = useRef<THREE.InstancedMesh>(null);
  const cutter = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const o = new THREE.Object3D();
    const place = (mesh: THREE.InstancedMesh | null, n: number, x0: number, step: number, y: number, z: number) => {
      if (!mesh) return;
      for (let i = 0; i < n; i++) {
        o.position.set(x0 + i * step, y, z);
        o.updateMatrix();
        mesh.setMatrixAt(i, o.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    place(teeth.current, 26, -0.0219, 0.00175, 0.006, 0.0011);
    place(cutter.current, 22, -0.0185, 0.00176, 0.004, -0.0008);
  }, []);

  return (
    <group>
      <mesh position={[0, -0.012, 0]} geometry={g.body} material={m.plastic} castShadow receiveShadow />
      <mesh position={[0, -0.012, 0.0164]} geometry={g.cover} material={m.brushed} />
      {[-1, 1].map((sx) =>
        [0, 1, 2, 3, 4, 5].map((i) => (
          <mesh
            key={`${sx}-${i}`}
            position={[sx * (0.0195 - i * 0.00045), -0.105 - i * 0.0062, 0]}
            rotation-z={sx * -0.06}
            geometry={g.rib}
            material={m.plasticGrip}
            scale={[1, 0.18, 1]}
          />
        )),
      )}
      <mesh position={[0, -0.006, -0.002]} geometry={g.housing} material={m.plastic} />
      <mesh position={[0, 0, 0.0011]} geometry={g.bladePlate} material={m.brushed} />
      <instancedMesh ref={teeth} args={[g.tooth, m.brushed, 26]} />
      <mesh position={[0, -0.0015, -0.0009]} geometry={g.bladePlate} material={m.chrome} scale={[0.86, 0.75, 0.8]} />
      <instancedMesh ref={cutter} args={[g.cutterTooth, m.chrome, 22]} />
      {[-0.014, 0.014].map((x) => (
        <mesh key={x} position={[x, -0.0035, 0.0023]} geometry={g.screw} material={m.chrome} />
      ))}
      <group position={[0.0255, -0.03, 0.004]} rotation-z={-0.25}>
        <mesh position={[0, -0.01, 0]} geometry={g.lever} material={m.chrome} />
        <mesh position={[0.003, -0.022, 0]} geometry={g.knob} material={m.plastic} />
      </group>
      <mesh position={[0, -0.072, 0.0195]} geometry={g.slide} material={m.plasticGrip} />
      <mesh position={[0, -0.062, 0.0205]} material={m.glow}>
        <circleGeometry args={[0.0012, 12]} />
      </mesh>
      <mesh position={[0, -0.172, 0]} geometry={g.relief} material={m.rubber} />
      {g.cord && <mesh geometry={g.cord} material={m.rubber} />}
    </group>
  );
}

/** A barber's cutting comb: a tapered spine with fine and coarse teeth, one extruded outline. */
export function Comb({ length = 0.18 }: { length?: number }) {
  const { m } = useKit();
  const geometry = useMemo(() => {
    const s = new THREE.Shape();
    const teeth = Math.round(length / 0.0026);
    s.moveTo(0, 0);
    s.lineTo(length, 0);
    s.lineTo(length, -0.006);
    for (let i = teeth - 1; i >= 0; i--) {
      const x = (i / teeth) * length;
      const deep = x > length * 0.55 ? 0.018 : 0.014;
      s.lineTo(x + 0.0016, -0.006);
      s.lineTo(x + 0.0013, -0.006 - deep);
      s.lineTo(x + 0.0004, -0.006 - deep);
      s.lineTo(x + 0.0002, -0.006);
    }
    s.lineTo(0, -0.006);
    s.lineTo(0, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.0016, bevelEnabled: false });
    g.translate(-length / 2, 0.012, -0.0008);
    return g;
  }, [length]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={m.plastic} castShadow />;
}

/* ------------------------------------------------------------ Customer */

function Customer() {
  const { m, quality } = useKit();
  const [cx, , cz] = layout.chair;
  const cape = useMemo(() => {
    // A bell from the neck strip to below the knees, with soft folds that deepen towards the hem.
    const profile = [
      [0.065, 1.14],
      [0.09, 1.11],
      [0.17, 1.065],
      [0.235, 1.0],
      [0.27, 0.9],
      [0.285, 0.75],
      [0.3, 0.6],
      [0.33, 0.47],
      [0.36, 0.37],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const g = new THREE.LatheGeometry(profile, 96);
    const p = g.getAttribute("position");
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const angle = Math.atan2(v.z, v.x);
      const drop = smooth(1.05, 0.4, v.y);
      const fold = (Math.sin(angle * 9) * 0.6 + Math.sin(angle * 17 + 1.3) * 0.4) * 0.014 * drop;
      const r = Math.hypot(v.x, v.z);
      const k = (r + fold) / Math.max(r, 1e-6);
      p.setXYZ(i, v.x * k, v.y, v.z * k);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(() => () => cape.dispose(), [cape]);

  return (
    <group>
      <mesh position={[cx + 0.05, 0, cz]} scale={[0.84, 1, 1]} geometry={cape} material={m.cape} castShadow receiveShadow />
      {/* Paper neck strip where the cape meets the neck. */}
      <mesh position={[HEAD.x - 0.01, 1.155, HEAD.z]} scale={[1.05, 1, 0.92]} material={m.paper} castShadow>
        <cylinderGeometry args={[0.057, 0.068, 0.05, 40, 1, true]} />
      </mesh>
      <mesh position={[HEAD.x - 0.01, 1.18, HEAD.z]} rotation-x={Math.PI / 2} scale={[1.05, 0.92, 1]} material={m.paper}>
        <torusGeometry args={[0.057, 0.004, 6, 40]} />
      </mesh>
      {[-0.09, 0.09].map((z) => (
        <group key={z}>
          <mesh position={[cx + 0.4, 0.3, cz + z]} rotation-z={0.18} material={m.trousers} castShadow>
            <capsuleGeometry args={[0.052, 0.22, 6, 16]} />
          </mesh>
          <mesh position={[cx + 0.5, 0.215, cz + z]} rotation-z={Math.PI / 2} scale={[1, 1, 0.9]} material={m.shoe} castShadow>
            <capsuleGeometry args={[0.042, 0.15, 6, 14]} />
          </mesh>
        </group>
      ))}
      <ScannedHead
        position={HEAD.toArray()}
        rotation={[0, 0, -0.04]}
        mask={fadeMask}
        strands={quality === "high" ? 64000 : 18000}
        seed={11}
        tone={["#2b1f16", "#4a3626"]}
        skin={m.skin}
        cut={-2.2}
      />
    </group>
  );
}

/* --------------------------------------------------------------- Barber */

const tmp = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) };

/** Place a unit-length Y-aligned mesh (capsule/cylinder) between two points. */
function span(mesh: THREE.Object3D | null, from: THREE.Vector3, to: THREE.Vector3, radius: number) {
  if (!mesh) return;
  const dir = tmp.a.subVectors(to, from);
  const len = dir.length();
  mesh.position.copy(from).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(tmp.up, dir.normalize());
  mesh.scale.set(radius, len, radius);
}

/** Analytic two-bone IK: the elbow for a shoulder, a hand target and a pole hint. */
function elbowFor(shoulder: THREE.Vector3, hand: THREE.Vector3, pole: THREE.Vector3, upper: number, lower: number, out: THREE.Vector3) {
  const toHand = tmp.b.subVectors(hand, shoulder);
  const d = Math.min(toHand.length(), upper + lower - 1e-3);
  const dir = toHand.normalize();
  const a = (upper * upper - lower * lower + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, upper * upper - a * a));
  const bend = tmp.c.subVectors(pole, shoulder);
  bend.addScaledVector(dir, -bend.dot(dir)).normalize();
  return out.copy(shoulder).addScaledVector(dir, a).addScaledVector(bend, h);
}

/*
 * The cutting pass, in the head's frame so it follows the skull: start just
 * under the fade, sweep up along the surface, flick out at the top of the
 * fade, lift away and come back. A pure function of time, so pausing and
 * resuming never drifts.
 */
const PASS_SECONDS = 2.2;
/**
 * The resting hand's orientation, from an explicit basis: its fingers (local
 * -y) point forward over the crown (+x), its palm (local +z) faces down onto
 * the head (-y), so local x points along +z.
 */
const RESTING_HAND = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, -1, 0)),
);
const HEAD_TOP = HEAD.y + 0.139;
const clipperEuler = new THREE.Euler(0, 0, 0, "XYZ");

function clipperPose(t: number, position: THREE.Vector3, quaternion: THREE.Quaternion) {
  const cycle = (t / PASS_SECONDS) % 1;
  const up = smooth(0.08, 0.62, cycle);
  const flick = smooth(0.5, 0.68, cycle) * (1 - smooth(0.72, 0.9, cycle));
  const away = smooth(0.62, 0.78, cycle) * (1 - smooth(0.86, 1, cycle));
  // Behind the right ear (+z side of the head), along the back of the skull.
  const along = THREE.MathUtils.lerp(-0.07, -0.005, up);
  position.set(HEAD.x - 0.062 + 0.012 * up, HEAD.y + along, HEAD.z + 0.082 + 0.004 * up + 0.012 * flick + 0.02 * away);
  // Blade flat to the hair, body angled down and out; the wrist rolls out on the flick.
  quaternion.setFromEuler(clipperEuler.set(-0.32 - 0.5 * flick - 0.2 * away, 0.45, 0.12 + 0.1 * up));
}

/** One arm segment: a tapered unit cylinder that `span` stretches between two joints. */
function Limb({ meshRef, material }: { meshRef: React.RefObject<THREE.Mesh | null>; material: THREE.Material }) {
  return (
    <mesh ref={meshRef} material={material} castShadow>
      <cylinderGeometry args={[1, 0.82, 1, 18]} />
    </mesh>
  );
}

/** A rounded joint (shoulder, elbow) that hides the seam between two arm segments. */
function Joint({ meshRef, radius, material }: { meshRef: React.RefObject<THREE.Mesh | null>; radius: number; material: THREE.Material }) {
  return (
    <mesh ref={meshRef} material={material} castShadow>
      <sphereGeometry args={[radius, 20, 14]} />
    </mesh>
  );
}

/** The rolled-up sleeve just below the elbow. */
function Cuff({ meshRef }: { meshRef: React.RefObject<THREE.Mesh | null> }) {
  const { m } = useKit();
  return (
    <mesh ref={meshRef} material={m.shirt} castShadow>
      <cylinderGeometry args={[0.052, 0.05, 0.05, 20]} />
    </mesh>
  );
}

function Barber({ clipper, comb }: { clipper: React.RefObject<THREE.Group | null>; comb: React.RefObject<THREE.Group | null> }) {
  const { m, quality } = useKit();
  const root = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const rUpper = useRef<THREE.Mesh>(null);
  const rLower = useRef<THREE.Mesh>(null);
  const lUpper = useRef<THREE.Mesh>(null);
  const lLower = useRef<THREE.Mesh>(null);
  const rShoulder = useRef<THREE.Mesh>(null);
  const lShoulder = useRef<THREE.Mesh>(null);
  const rElbow = useRef<THREE.Mesh>(null);
  const lElbow = useRef<THREE.Mesh>(null);
  const rCuff = useRef<THREE.Mesh>(null);
  const lCuff = useRef<THREE.Mesh>(null);

  const g = useMemo(() => {
    // Shirt: chest, shoulders and a slight taper to the waist; flattened front to back.
    const shirt = new THREE.LatheGeometry(
      [
        [0.0, 0.9],
        [0.15, 0.92],
        [0.155, 1.0],
        [0.165, 1.12],
        [0.185, 1.26],
        [0.2, 1.36],
        [0.19, 1.43],
        [0.13, 1.48],
        [0.06, 1.5],
      ].map(([r, y]) => new THREE.Vector2(r, y)),
      48,
    );
    shirt.scale(1, 1, 0.6);
    const leg = new THREE.LatheGeometry(
      [
        [0.0, 0.0],
        [0.06, 0.08],
        [0.058, 0.3],
        [0.064, 0.52],
        [0.078, 0.78],
        [0.085, 0.92],
        [0.0, 0.93],
      ].map(([r, y]) => new THREE.Vector2(r, y)),
      24,
    );
    leg.scale(1, 1, 0.85);
    return {
      shirt,
      leg,
      // Apron: a curved panel over the front of the body.
      apron: new THREE.CylinderGeometry(0.165, 0.18, 0.72, 32, 1, true, -1.0, 2.0),
      shoe: roundedBox(0.1, 0.07, 0.28, 0.03, 3),
      collar: new THREE.TorusGeometry(0.058, 0.014, 10, 28),
      hips: roundedBox(0.33, 0.16, 0.21, 0.07, 4),
    };
  }, []);
  useEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);

  // Behind the chair, slightly to the customer's right, turned towards the head.
  const stand = new THREE.Vector3(layout.chair[0] - 0.5, 0, layout.chair[2] + 0.06);
  const yaw = Math.atan2(HEAD.x - stand.x, HEAD.z - stand.z) - 0.12;

  const v = useMemo(
    () => ({ s: new THREE.Vector3(), e: new THREE.Vector3(), h: new THREE.Vector3(), pole: new THREE.Vector3(), q: new THREE.Quaternion() }),
    [],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const c = clipper.current;
    const k = comb.current;
    if (!c || !k || !root.current || !torso.current || !head.current) return;
    clipperPose(t, c.position, c.quaternion);
    const cycle = (t / PASS_SECONDS) % 1;
    // The comb hand rests above the fade, lifting the longer hair out of the way.
    // Resting on the crown, fingers forward over the top: steadies and tilts the head.
    k.position.set(HEAD.x - 0.085, HEAD_TOP + 0.012 + 0.002 * Math.sin(cycle * Math.PI * 2), HEAD.z - 0.012);
    k.quaternion.copy(RESTING_HAND);
    torso.current.rotation.z = Math.sin(cycle * Math.PI * 2) * 0.008;
    head.current.rotation.x = 0.27 + Math.sin(cycle * Math.PI * 2) * 0.02;
    root.current.updateMatrixWorld();
    c.updateMatrixWorld();
    k.updateMatrixWorld();

    // Right arm (the figure faces local +z, so its right is local -x) to the clipper hand's wrist.
    torso.current.localToWorld(v.s.set(-0.19, 1.39, 0.01));
    c.localToWorld(v.h.set(-0.06, -0.1, -0.03));
    torso.current.localToWorld(v.pole.set(-0.75, 0.9, -0.35));
    elbowFor(v.s, v.h, v.pole, 0.29, 0.27, v.e);
    span(rUpper.current, v.s, v.e, 0.047);
    span(rLower.current, v.e, v.h, 0.036);
    rShoulder.current?.position.copy(v.s);
    rElbow.current?.position.copy(v.e);
    rCuff.current?.position.lerpVectors(v.e, v.h, 0.12);
    if (rCuff.current && rLower.current) rCuff.current.quaternion.copy(rLower.current.quaternion);

    // Left arm to the comb hand's wrist.
    torso.current.localToWorld(v.s.set(0.19, 1.39, 0.01));
    k.localToWorld(v.h.set(0, 0, 0));
    torso.current.localToWorld(v.pole.set(0.8, 1.0, -0.3));
    elbowFor(v.s, v.h, v.pole, 0.29, 0.27, v.e);
    span(lUpper.current, v.s, v.e, 0.047);
    span(lLower.current, v.e, v.h, 0.036);
    lShoulder.current?.position.copy(v.s);
    lElbow.current?.position.copy(v.e);
    lCuff.current?.position.lerpVectors(v.e, v.h, 0.12);
    if (lCuff.current && lLower.current) lCuff.current.quaternion.copy(lLower.current.quaternion);
  });

  return (
    <>
      <group ref={root} position={stand.toArray()} rotation-y={yaw}>
        {[-0.09, 0.09].map((x) => (
          <group key={x}>
            <mesh position={[x, 0.05, 0]} geometry={g.leg} material={m.trousers} castShadow />
            <mesh position={[x, 0.035, 0.05]} geometry={g.shoe} material={m.shoe} castShadow />
          </group>
        ))}
        <mesh position={[0, 0.93, 0]} geometry={g.hips} material={m.trousers} castShadow />
        <group ref={torso} rotation-x={0.14}>
          <mesh geometry={g.shirt} material={m.shirt} castShadow receiveShadow />
          {[-0.17, 0.17].map((x) => (
            <mesh key={x} position={[x, 1.39, 0]} scale={[0.88, 0.72, 0.82]} material={m.shirt} castShadow>
              <sphereGeometry args={[0.07, 20, 14]} />
            </mesh>
          ))}
          <mesh position={[0, 1.07, 0.02]} geometry={g.apron} material={m.apron} castShadow />
          <mesh position={[0, 1.45, 0.045]} rotation-x={-0.25} material={m.apron}>
            <torusGeometry args={[0.085, 0.006, 6, 24, Math.PI]} />
          </mesh>
          {/* Collar standing round the neck, hiding where the scan is trimmed. */}
          <mesh position={[0, 1.53, -0.008]} rotation-x={0.12} scale={[1, 0.86, 1.1]} material={m.shirt} castShadow>
            <cylinderGeometry args={[0.06, 0.071, 0.1, 28, 1, false]} />
          </mesh>
          <mesh position={[0, 1.485, 0]} rotation-x={Math.PI / 2} scale={[1.15, 0.9, 1]} geometry={g.collar} material={m.shirt} />
          <ScannedHead
            position={[0, 1.62, 0.012]}
            rotation={[0, -Math.PI / 2, 0]}
            mask={barberMask}
            strands={quality === "high" ? 26000 : 9000}
            seed={23}
            tone={["#1a1410", "#2e241b"]}
            skin={m.skinBarber}
            headRef={head}
            cut={-1.35}
            napeLift={0.9}
          />
        </group>
        <ContactShadow position={[0, 0.003, 0.02]} scale={[0.75, 0.6]} />
      </group>
      {/* Arms live in world space; their pose is solved every frame. Sleeves rolled to the elbow. */}
      <Limb meshRef={rUpper} material={m.shirt} />
      <Limb meshRef={lUpper} material={m.shirt} />
      <Limb meshRef={rLower} material={m.skinPlainBarber} />
      <Limb meshRef={lLower} material={m.skinPlainBarber} />
      <Joint meshRef={rShoulder} radius={0.055} material={m.shirt} />
      <Joint meshRef={lShoulder} radius={0.055} material={m.shirt} />
      <Joint meshRef={rElbow} radius={0.05} material={m.shirt} />
      <Joint meshRef={lElbow} radius={0.05} material={m.shirt} />
      <Cuff meshRef={rCuff} />
      <Cuff meshRef={lCuff} />
    </>
  );
}

/** Clippings drifting down from the blade during the upward pass. Sparse and short-lived. */
function HairFall({ clipper }: { clipper: React.RefObject<THREE.Group | null> }) {
  const { m, quality } = useKit();
  const count = quality === "high" ? 90 : 40;
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) positions[i * 3 + 1] = -10;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [count]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const ref = useRef<THREE.Points>(null);
  const velocityRef = useRef<Float32Array | null>(null);
  const nextRef = useRef(0);
  const blade = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }, delta) => {
    const c = clipper.current;
    const points = ref.current;
    if (!c || !points?.visible) return;
    const attr = points.geometry.getAttribute("position") as THREE.BufferAttribute;
    const positions = attr.array as Float32Array;
    if (velocityRef.current?.length !== positions.length) velocityRef.current = new Float32Array(positions.length);
    const velocity = velocityRef.current;
    const dt = Math.min(delta, 1 / 30);
    const cycle = (clock.elapsedTime / PASS_SECONDS) % 1;
    if (cycle > 0.2 && cycle < 0.62 && Math.random() < 0.5) {
      c.localToWorld(blade.set((Math.random() - 0.5) * 0.04, 0.004, 0.006));
      const i = nextRef.current;
      nextRef.current = (i + 1) % count;
      positions.set([blade.x, blade.y, blade.z], i * 3);
      velocity.set([(Math.random() - 0.6) * 0.03, 0.01 + Math.random() * 0.02, 0.02 + Math.random() * 0.03], i * 3);
    }
    for (let i = 0; i < count; i++) {
      if (positions[i * 3 + 1] < 0.45) continue;
      velocity[i * 3 + 1] -= 0.8 * dt;
      positions[i * 3] += velocity[i * 3] * dt;
      positions[i * 3 + 1] += Math.max(velocity[i * 3 + 1], -0.3) * dt;
      positions[i * 3 + 2] += velocity[i * 3 + 2] * dt;
    }
    attr.needsUpdate = true;
  });

  return <points ref={ref} geometry={geometry} material={m.hairFall} frustumCulled={false} />;
}

export function Figures() {
  const { m } = useKit();
  const clipper = useRef<THREE.Group>(null);
  const comb = useRef<THREE.Group>(null);
  return (
    <group>
      <Customer />
      <Barber clipper={clipper} comb={comb} />
      {/* The clipper with the barber's right hand wrapped round it, so the grip is always exact. */}
      <group ref={clipper}>
        <Clipper />
        {/* Palm on the back of the body, fingers across it and round the far side, thumb along the near side. */}
        <group position={[-0.06, -0.1, -0.03]} rotation={[0, 0, Math.PI / 2]}>
          <Hand curl={[0.95, 1.0, 1.0, 0.9]} thumb={[0.3, 0.3]} material={m.skinPlainBarber} />
        </group>
      </group>
      {/* The left hand rests on the crown, fingers following the curve of the head. */}
      <group ref={comb}>
        <Hand curl={[0.35, 0.4, 0.4, 0.35]} thumb={[0.4, 0.3]} spread={0.07} material={m.skinPlainBarber} />
      </group>
      <HairFall clipper={clipper} />
    </group>
  );
}
