"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { layout } from "@/lib/hero/journey";
import { ContactShadow, roundedBox, useKit } from "./kit";

/*
 * The people, as sculptural figures in matte plaster: a caped customer in
 * the chair and the barber behind them. They are deliberately not photoreal
 * (no suitably licensed animated people were available); what carries the
 * close-up is real geometry: the head, hair rendered as stacked shells that
 * thin into a fade, the clipper moving along it and the cut hair falling.
 *
 * The customer faces +x (the mirror). Their right side (+z) faces the aisle,
 * which is where the camera arrives for the close-up.
 */

const HEAD = new THREE.Vector3(...layout.head);
/** Head half-extents: depth (x), height (y), width (z). */
const HEAD_R = new THREE.Vector3(0.1, 0.118, 0.079);

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Hair coverage at a point on the unit head (face towards +x): full on top,
 * a skin fade down the sides and back, a forehead hairline, nothing at the ears.
 */
function hairMask(x: number, y: number, z: number) {
  const fade = smooth(-0.5, 0.12, y + 0.08 * x);
  const front = x < 0.42 ? 1 : smooth(0.48, 0.72, y);
  const ear = smooth(0.72, 0.9, Math.abs(z)) * (1 - smooth(0.75, 1.05, Math.hypot((x + 0.05) / 0.32, (y + 0.14) / 0.3)));
  return fade * front * (1 - ear);
}

function headGeometry(segments: number) {
  const geo = new THREE.SphereGeometry(1, segments, Math.round(segments * 0.75));
  const pos = geo.getAttribute("position");
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // A slightly flatter crown, fuller back of the skull, narrower jaw.
    const jaw = v.y < -0.2 ? 1 - (Math.min(0.8, -v.y - 0.2) * 0.35) : 1;
    const back = v.x < 0 ? 1.06 : 1;
    pos.setXYZ(i, v.x * HEAD_R.x * back * jaw, v.y * HEAD_R.y * (v.y > 0.7 ? 0.97 : 1), v.z * HEAD_R.z * jaw);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Scalp colours (skin to dense stubble) and hair-shell layers built from one head mesh. */
function useHairGeometry(shells: number, segments: number) {
  const g = useMemo(() => {
    const base = headGeometry(segments);
    const pos = base.getAttribute("position");
    const nrm = base.getAttribute("normal");
    const skin = new THREE.Color("#c9bfb1");
    const stubble = new THREE.Color("#4a3e33");
    const scalpColors = new Float32Array(pos.count * 3);
    const mask = new Float32Array(pos.count);
    const length = new Float32Array(pos.count);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / HEAD_R.x;
      const y = pos.getY(i) / HEAD_R.y;
      const z = pos.getZ(i) / HEAD_R.z;
      mask[i] = hairMask(x, y, z);
      length[i] = 0.3 + 0.7 * smooth(-0.05, 0.75, y);
      c.copy(skin).lerp(stubble, Math.pow(mask[i], 0.7) * 0.92);
      c.toArray(scalpColors, i * 3);
    }
    base.setAttribute("color", new THREE.BufferAttribute(scalpColors, 3));

    const layers = Array.from({ length: shells }, (_, s) => {
      const f = (s + 1) / shells;
      const geo = base.clone();
      geo.deleteAttribute("color");
      const p = geo.getAttribute("position");
      const rgba = new Float32Array(p.count * 4);
      for (let i = 0; i < p.count; i++) {
        const out = 0.0012 + f * 0.012 * length[i];
        p.setXYZ(i, p.getX(i) + nrm.getX(i) * out, p.getY(i) + nrm.getY(i) * out, p.getZ(i) + nrm.getZ(i) * out);
        rgba.set([1, 1, 1, Math.pow(mask[i], 1.3)], i * 4);
      }
      geo.setAttribute("color", new THREE.BufferAttribute(rgba, 4));
      return geo;
    });
    return { base, layers };
  }, [shells, segments]);
  useEffect(() => () => {
    g.base.dispose();
    g.layers.forEach((l) => l.dispose());
  }, [g]);
  return g;
}

function Customer() {
  const { m, hairShells, quality } = useKit();
  const hair = useHairGeometry(hairShells.length, quality === "high" ? 96 : 56);
  const [cx, , cz] = layout.chair;
  const cape = useMemo(() => {
    const profile = [
      [0.045, 1.13],
      [0.07, 1.1],
      [0.18, 1.045],
      [0.25, 0.97],
      [0.285, 0.82],
      [0.3, 0.62],
      [0.33, 0.46],
      [0.355, 0.36],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    return new THREE.LatheGeometry(profile, 64);
  }, []);
  useEffect(() => () => cape.dispose(), [cape]);

  return (
    <group>
      {/* Cape over shoulders, arms and knees. */}
      <mesh position={[cx + 0.05, 0, cz]} scale={[0.82, 1, 1]} geometry={cape} material={m.cape} castShadow receiveShadow />
      {/* Shins and shoes on the footrest. */}
      {[-0.09, 0.09].map((z) => (
        <group key={z}>
          <mesh position={[cx + 0.4, 0.3, cz + z]} rotation-z={0.18} material={m.cloth} castShadow>
            <capsuleGeometry args={[0.055, 0.22, 6, 16]} />
          </mesh>
          <mesh position={[cx + 0.5, 0.21, cz + z]} material={m.shoe} castShadow>
            <boxGeometry args={[0.22, 0.07, 0.09]} />
          </mesh>
        </group>
      ))}
      {/* Neck and head. */}
      <mesh position={[HEAD.x - 0.015, HEAD.y - 0.15, HEAD.z]} material={m.clay} castShadow>
        <cylinderGeometry args={[0.048, 0.055, 0.12, 24]} />
      </mesh>
      <group position={HEAD.toArray()}>
        <mesh geometry={hair.base} material={m.scalp} castShadow receiveShadow />
        {hair.layers.map((geo, i) => (
          <mesh key={i} geometry={geo} material={hairShells[i]} renderOrder={4} />
        ))}
        {/* Face: nose and chin give the profile its read without breaking the skull's silhouette. */}
        <mesh position={[0.094, -0.016, 0]} rotation-z={0.35} scale={[0.9, 1.6, 0.62]} material={m.clay}>
          <sphereGeometry args={[0.02, 20, 14]} />
        </mesh>
        <mesh position={[0.06, -0.1, 0]} scale={[0.75, 0.55, 0.8]} material={m.clay}>
          <sphereGeometry args={[0.055, 24, 16]} />
        </mesh>
        {/* Ears: a rolled rim around a shallow bowl, set close to the skull. */}
        {[-1, 1].map((side) => (
          <group key={side} position={[-0.014, -0.016, side * 0.074]} rotation-y={side * 0.3} scale={[0.8, 1.25, 1]}>
            <mesh material={m.clayShade} castShadow>
              <torusGeometry args={[0.019, 0.0065, 12, 28]} />
            </mesh>
            <mesh position={[0, 0, side * -0.004]} scale={[1, 1, 0.35]} material={m.clayShade}>
              <sphereGeometry args={[0.018, 18, 12]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ Barber */

const tmp = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), q: new THREE.Quaternion(), up: new THREE.Vector3(0, 1, 0) };

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

const clipperEuler = new THREE.Euler(0, 0, 0, "XYZ");

/** Where the clipper is at time `t`: short upward passes along the fade, flicking out at the top. */
function clipperPose(t: number, position: THREE.Vector3, quaternion: THREE.Quaternion) {
  const cycle = (t * 0.55) % 1;
  const stroke = cycle < 0.7 ? smooth(0, 0.7, cycle) : 1 - smooth(0.7, 1, cycle);
  const flick = smooth(0.55, 0.75, cycle) * (1 - smooth(0.8, 1, cycle));
  // On the head's right side (+z), behind the ear, riding up the fade.
  position.set(HEAD.x - 0.055 - 0.01 * stroke, HEAD.y - 0.065 + 0.06 * stroke, HEAD.z + HEAD_R.z + 0.004 + 0.018 * flick);
  // Blade against the hair, body angled down and away from the head.
  quaternion.setFromEuler(clipperEuler.set(-0.5 - 0.35 * flick, 0.35, 0.15));
}

function Clipper({ groupRef }: { groupRef: React.RefObject<THREE.Group | null> }) {
  const { m } = useKit();
  const body = useMemo(() => roundedBox(0.042, 0.14, 0.032, 0.016), []);
  useEffect(() => () => body.dispose(), [body]);
  return (
    <group ref={groupRef}>
      {/* The group's origin is the cutting edge; the body hangs below it. */}
      <mesh position={[0, -0.078, 0]} geometry={body} material={m.clipperBody} castShadow />
      <mesh position={[0, -0.006, 0]} material={m.chrome} castShadow>
        <boxGeometry args={[0.046, 0.012, 0.012]} />
      </mesh>
      {Array.from({ length: 11 }, (_, i) => (
        <mesh key={i} position={[-0.021 + i * 0.0042, 0.002, 0.003]} material={m.chrome}>
          <boxGeometry args={[0.0018, 0.008, 0.004]} />
        </mesh>
      ))}
      <mesh position={[0, -0.15, 0]} material={m.steel}>
        <cylinderGeometry args={[0.004, 0.004, 0.02, 8]} />
      </mesh>
    </group>
  );
}

/** Clippings drifting down from the blade while the clipper works. */
function HairFall({ clipper }: { clipper: React.RefObject<THREE.Group | null> }) {
  const { m, quality } = useKit();
  const count = quality === "high" ? 220 : 90;
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) positions[i * 3 + 1] = -10;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [count]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const ref = useRef<THREE.Points>(null);
  // Simulation state lives in refs: it changes every frame and never renders.
  const velocityRef = useRef<Float32Array | null>(null);
  const nextRef = useRef(0);

  useFrame((_, delta) => {
    const c = clipper.current;
    const points = ref.current;
    if (!c || !points?.visible) return;
    const attr = points.geometry.getAttribute("position") as THREE.BufferAttribute;
    const positions = attr.array as Float32Array;
    if (velocityRef.current?.length !== positions.length) velocityRef.current = new Float32Array(positions.length);
    const velocity = velocityRef.current;
    const dt = Math.min(delta, 1 / 30);
    // A few new clippings per frame at the blade.
    for (let k = 0; k < 2; k++) {
      const i = nextRef.current;
      nextRef.current = (i + 1) % count;
      positions[i * 3] = c.position.x + (Math.random() - 0.5) * 0.02;
      positions[i * 3 + 1] = c.position.y + Math.random() * 0.01;
      positions[i * 3 + 2] = c.position.z + Math.random() * 0.01;
      velocity[i * 3] = (Math.random() - 0.6) * 0.05;
      velocity[i * 3 + 1] = Math.random() * 0.04;
      velocity[i * 3 + 2] = 0.02 + Math.random() * 0.05;
    }
    for (let i = 0; i < count; i++) {
      if (positions[i * 3 + 1] < 0.4) continue;
      velocity[i * 3 + 1] -= 0.9 * dt; // light flakes: slowed by air
      velocity[i * 3] *= 0.98;
      velocity[i * 3 + 2] *= 0.98;
      positions[i * 3] += velocity[i * 3] * dt;
      positions[i * 3 + 1] += Math.max(velocity[i * 3 + 1], -0.35) * dt;
      positions[i * 3 + 2] += velocity[i * 3 + 2] * dt;
    }
    attr.needsUpdate = true;
  });

  return <points ref={ref} geometry={geometry} material={m.hairFall} frustumCulled={false} />;
}

/** One arm segment: a tapered unit cylinder that `span` stretches between two joints. */
function Limb({ meshRef }: { meshRef: React.RefObject<THREE.Mesh | null> }) {
  const { m } = useKit();
  return (
    <mesh ref={meshRef} material={m.cloth} castShadow>
      <cylinderGeometry args={[1, 0.85, 1, 16]} />
    </mesh>
  );
}

/** A rounded joint (shoulder, elbow) that hides the seam between two arm segments. */
function Joint({ meshRef, radius }: { meshRef: React.RefObject<THREE.Mesh | null>; radius: number }) {
  const { m } = useKit();
  return (
    <mesh ref={meshRef} material={m.cloth} castShadow>
      <sphereGeometry args={[radius, 20, 14]} />
    </mesh>
  );
}

function Barber({ clipper }: { clipper: React.RefObject<THREE.Group | null> }) {
  const { m } = useKit();
  const root = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const rUpper = useRef<THREE.Mesh>(null);
  const rLower = useRef<THREE.Mesh>(null);
  const lUpper = useRef<THREE.Mesh>(null);
  const lLower = useRef<THREE.Mesh>(null);
  const rShoulder = useRef<THREE.Mesh>(null);
  const rElbow = useRef<THREE.Mesh>(null);
  const lShoulder = useRef<THREE.Mesh>(null);
  const lElbow = useRef<THREE.Mesh>(null);
  const rHand = useRef<THREE.Mesh>(null);
  const lHand = useRef<THREE.Mesh>(null);
  const torsoGeo = useMemo(() => {
    const profile = [
      [0.0, 0.9],
      [0.14, 0.92],
      [0.15, 1.02],
      [0.17, 1.18],
      [0.19, 1.32],
      [0.2, 1.42],
      [0.12, 1.48],
      [0.05, 1.5],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const g = new THREE.LatheGeometry(profile, 40);
    g.scale(1, 1, 0.62);
    return g;
  }, []);
  useEffect(() => () => torsoGeo.dispose(), [torsoGeo]);

  // Behind the chair, facing the mirror, turned a little towards the customer's right side.
  const stand = new THREE.Vector3(layout.chair[0] - 0.5, 0, layout.chair[2] - 0.04);
  const yaw = Math.atan2(HEAD.x - stand.x, HEAD.z - stand.z) - 0.18;

  const v = useMemo(() => ({ s: new THREE.Vector3(), e: new THREE.Vector3(), h: new THREE.Vector3(), pole: new THREE.Vector3(), q: new THREE.Quaternion(), p: new THREE.Vector3() }), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const c = clipper.current;
    if (!c || !root.current || !torso.current || !head.current) return;
    clipperPose(t, c.position, c.quaternion);
    // A slight weight shift and the head following the work.
    torso.current.rotation.z = Math.sin(t * 0.55 * Math.PI * 2) * 0.012;
    head.current.rotation.x = 0.42 + Math.sin(t * 0.55 * Math.PI * 2) * 0.03;
    root.current.updateMatrixWorld();

    // Right arm (the figure faces local +z, so its right is local -x): hand on the clipper body.
    torso.current.localToWorld(v.s.set(-0.2, 1.4, 0.02));
    v.h.set(0, -0.085, -0.005).applyQuaternion(c.quaternion).add(c.position);
    torso.current.localToWorld(v.pole.set(-0.7, 0.9, -0.35));
    elbowFor(v.s, v.h, v.pole, 0.3, 0.28, v.e);
    span(rUpper.current, v.s, v.e, 0.046);
    span(rLower.current, v.e, v.h, 0.038);
    rShoulder.current?.position.copy(v.s);
    rElbow.current?.position.copy(v.e);
    if (rHand.current) {
      rHand.current.position.copy(v.h);
      rHand.current.quaternion.copy(c.quaternion);
    }

    // Left hand steadies the head from above.
    torso.current.localToWorld(v.s.set(0.2, 1.4, 0.02));
    v.h.set(HEAD.x - 0.02, HEAD.y + HEAD_R.y + 0.012, HEAD.z - 0.035);
    torso.current.localToWorld(v.pole.set(0.7, 1.0, -0.3));
    elbowFor(v.s, v.h, v.pole, 0.3, 0.28, v.e);
    span(lUpper.current, v.s, v.e, 0.046);
    span(lLower.current, v.e, v.h, 0.038);
    lShoulder.current?.position.copy(v.s);
    lElbow.current?.position.copy(v.e);
    if (lHand.current) {
      lHand.current.position.copy(v.h);
      lHand.current.quaternion.setFromUnitVectors(tmp.up, v.p.subVectors(v.h, v.e).normalize());
    }
  });

  return (
    <>
      <group ref={root} position={stand.toArray()} rotation-y={yaw}>
        {/* Legs and shoes. */}
        {[-0.1, 0.1].map((x) => (
          <group key={x}>
            <mesh position={[x, 0.46, 0]} material={m.cloth} castShadow>
              <capsuleGeometry args={[0.068, 0.76, 6, 16]} />
            </mesh>
            <mesh position={[x, 0.035, 0.05]} material={m.shoe} castShadow>
              <boxGeometry args={[0.1, 0.07, 0.27]} />
            </mesh>
          </group>
        ))}
        <group ref={torso} rotation-x={0.16}>
          <mesh geometry={torsoGeo} material={m.cloth} castShadow />
          {/* Apron over the front, from chest to knee. */}
          <mesh position={[0, 1.0, 0.105]} rotation-x={-0.04} material={m.apron} castShadow>
            <boxGeometry args={[0.34, 0.66, 0.02]} />
          </mesh>
          {/* Short neck under a dark collar, so the head sits on the shoulders. */}
          <mesh position={[0, 1.535, 0.005]} material={m.clay} castShadow>
            <cylinderGeometry args={[0.046, 0.05, 0.07, 20]} />
          </mesh>
          <mesh position={[0, 1.5, 0]} scale={[1, 1, 0.8]} material={m.apron} castShadow>
            <cylinderGeometry args={[0.062, 0.085, 0.05, 24]} />
          </mesh>
          <group ref={head} position={[0, 1.625, 0.012]}>
            <mesh scale={[0.78, 1.1, 0.95]} material={m.clay} castShadow>
              <sphereGeometry args={[0.1, 32, 24]} />
            </mesh>
            {/* Short dark hair as a cap. */}
            <mesh position={[0, 0.018, -0.008]} scale={[0.82, 1.08, 0.98]} material={m.apron}>
              <sphereGeometry args={[0.1, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
            </mesh>
            <mesh position={[0, -0.005, 0.088]} rotation-x={Math.PI / 2 - 0.2} material={m.clay}>
              <coneGeometry args={[0.014, 0.04, 14]} />
            </mesh>
          </group>
        </group>
        <ContactShadow position={[0, 0.003, 0.02]} scale={[0.75, 0.6]} />
      </group>
      {/* Arms live in world space; their pose is solved every frame. */}
      <Limb meshRef={rUpper} />
      <Limb meshRef={rLower} />
      <Limb meshRef={lUpper} />
      <Limb meshRef={lLower} />
      <Joint meshRef={rShoulder} radius={0.058} />
      <Joint meshRef={lShoulder} radius={0.058} />
      <Joint meshRef={rElbow} radius={0.044} />
      <Joint meshRef={lElbow} radius={0.044} />
      <mesh ref={rHand} scale={[1, 1, 0.62]} material={m.clay} castShadow>
        <capsuleGeometry args={[0.028, 0.05, 6, 14]} />
      </mesh>
      <mesh ref={lHand} scale={[1.15, 1, 0.5]} material={m.clay} castShadow>
        <capsuleGeometry args={[0.03, 0.055, 6, 14]} />
      </mesh>
    </>
  );
}

export function Figures() {
  const clipper = useRef<THREE.Group>(null);
  return (
    <group>
      <Customer />
      <Barber clipper={clipper} />
      <Clipper groupRef={clipper} />
      <HairFall clipper={clipper} />
    </group>
  );
}
