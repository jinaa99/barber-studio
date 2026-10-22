"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { layout } from "@/lib/hero/journey";
import { ContactShadow, useKit } from "./kit";
import { rng } from "./textures";

/*
 * The street side: a dark fluted facade with a backlit fascia, a steel
 * shopfront set into the wall's depth, a glass door on a real hinge, wall
 * sconces, a projecting blade sign, planters, paving and the neighbours.
 * The glass line is z = 0.12; the wall's outer face is z = 0.3.
 */

const OPEN_W = 2.7; // half-width of the shopfront opening
const OPEN_H = 3.1;
const GLASS_Z = 0.12;

/** Cladding with the ribs at a constant real-world pitch on boxes of any size. */
function useCladding(width: number, height: number) {
  const { m } = useKit();
  const material = useMemo(() => {
    const mat = m.cladding.clone();
    const map = m.cladding.map!.clone();
    map.repeat.set(width / 1.9, height / 1.9);
    map.needsUpdate = true;
    mat.map = map;
    return mat;
  }, [m.cladding, width, height]);
  useEffect(() => () => {
    material.map?.dispose();
    material.dispose();
  }, [material]);
  return material;
}

function CladBox({ size, position }: { size: [number, number, number]; position: [number, number, number] }) {
  const material = useCladding(size[0], size[1]);
  return (
    <mesh position={position} material={material} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  );
}

function Bar({ size, position, material }: { size: [number, number, number]; position: [number, number, number]; material?: THREE.Material }) {
  const { m } = useKit();
  return (
    <mesh position={position} material={material ?? m.steel} castShadow>
      <boxGeometry args={size} />
    </mesh>
  );
}

function Pane({ x0, x1, y0, y1, z = GLASS_Z }: { x0: number; x1: number; y0: number; y1: number; z?: number }) {
  const { m } = useKit();
  return (
    <mesh position={[(x0 + x1) / 2, (y0 + y1) / 2, z]} material={m.glass} renderOrder={2}>
      <planeGeometry args={[x1 - x0, y1 - y0]} />
    </mesh>
  );
}

/** The door leaf, built around its hinge so rotating the group swings it. */
function Door({ doorRef }: { doorRef: RefObject<THREE.Group | null> }) {
  const { m } = useKit();
  const w = layout.doorWidth;
  const h = layout.doorHeight;
  const stile = 0.095;
  return (
    <group ref={doorRef} position={[layout.doorHinge[0], 0, GLASS_Z]}>
      <Bar size={[stile, h, 0.05]} position={[stile / 2, h / 2, 0]} />
      <Bar size={[stile, h, 0.05]} position={[w - stile / 2, h / 2, 0]} />
      <Bar size={[w, 0.08, 0.05]} position={[w / 2, h - 0.04, 0]} />
      <Bar size={[w, 0.2, 0.05]} position={[w / 2, 0.1, 0]} />
      <mesh position={[w / 2, h / 2 + 0.06, 0]} material={m.glass} renderOrder={2}>
        <planeGeometry args={[w - stile * 2, h - 0.28]} />
      </mesh>
      {/* Pull bars on both faces, with stand-offs. */}
      {[0.075, -0.075].map((z) => (
        <group key={z} position={[w - 0.17, 1.05, z]}>
          <mesh material={m.chrome} castShadow>
            <cylinderGeometry args={[0.014, 0.014, 0.95, 16]} />
          </mesh>
          {[-0.4, 0.4].map((y) => (
            <mesh key={y} position={[0, y, -Math.sign(z) * 0.035]} rotation-x={Math.PI / 2} material={m.chrome}>
              <cylinderGeometry args={[0.009, 0.009, 0.07, 10]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Sconce({ x }: { x: number }) {
  const { m, quality } = useKit();
  return (
    <group position={[x, 2.55, 0.3]}>
      <mesh position={[0, 0, 0.09]} material={m.steel} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 0.34, 24]} />
      </mesh>
      <mesh position={[0, -0.175, 0.09]} rotation-x={Math.PI / 2} material={m.glow}>
        <circleGeometry args={[0.06, 24]} />
      </mesh>
      <mesh position={[0, 0.175, 0.09]} rotation-x={-Math.PI / 2} material={m.glow}>
        <circleGeometry args={[0.06, 24]} />
      </mesh>
      <pointLight position={[0, -0.3, 0.2]} color="#ffbe7a" intensity={quality === "high" ? 2.4 : 1.6} distance={5} decay={2} />
    </group>
  );
}

/** Leaves scattered over an ellipsoid: one instanced mesh per shrub. */
export function Shrub({ position, radius = [0.45, 0.5, 0.3], count = 160, seed = 1 }: {
  position: [number, number, number];
  radius?: [number, number, number];
  count?: number;
  seed?: number;
}) {
  const { m, quality } = useKit();
  const ref = useRef<THREE.InstancedMesh>(null);
  const n = quality === "high" ? count : Math.round(count * 0.55);
  const geometry = useMemo(() => {
    const leaf = new THREE.Shape();
    leaf.moveTo(0, 0);
    leaf.quadraticCurveTo(0.035, 0.07, 0, 0.16);
    leaf.quadraticCurveTo(-0.035, 0.07, 0, 0);
    return new THREE.ShapeGeometry(leaf, 4);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const random = rng(seed * 9973);
    const o = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const u = random() * Math.PI * 2;
      const v = Math.acos(2 * random() - 1);
      const r = 0.55 + random() * 0.45;
      o.position.set(Math.sin(v) * Math.cos(u) * radius[0] * r, Math.cos(v) * radius[1] * r, Math.sin(v) * Math.sin(u) * radius[2] * r);
      o.rotation.set(random() * Math.PI, random() * Math.PI * 2, random() * Math.PI);
      o.scale.setScalar(0.7 + random() * 0.7);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [n, radius, seed]);
  return (
    <group position={position}>
      <instancedMesh ref={ref} args={[geometry, seed % 2 ? m.leaf : m.leafLight, n]} castShadow />
    </group>
  );
}

function Planter({ x }: { x: number }) {
  const { m } = useKit();
  return (
    <group position={[x, 0, 0.75]}>
      <mesh position={[0, 0.22, 0]} material={m.concrete} castShadow receiveShadow>
        <boxGeometry args={[1.1, 0.44, 0.46]} />
      </mesh>
      <mesh position={[0, 0.43, 0]} material={m.soil}>
        <boxGeometry args={[1.02, 0.02, 0.38]} />
      </mesh>
      <Shrub position={[-0.22, 0.85, 0]} radius={[0.38, 0.45, 0.22]} seed={x > 0 ? 3 : 5} />
      <Shrub position={[0.25, 0.75, 0.02]} radius={[0.32, 0.36, 0.2]} count={120} seed={x > 0 ? 4 : 6} />
      <ContactShadow position={[0, 0.004, 0.02]} scale={[1.6, 0.9]} />
    </group>
  );
}

function BladeSign() {
  const { m } = useKit();
  return (
    <group position={[OPEN_W + 0.55, 3.35, 0.3]}>
      <Bar size={[0.03, 0.03, 0.75]} position={[0, 0.34, 0.37]} />
      <Bar size={[0.12, 0.12, 0.02]} position={[0, 0.34, 0.01]} />
      <group position={[0, 0, 0.55]} rotation-y={Math.PI / 2}>
        <mesh rotation-x={Math.PI / 2} material={m.fascia} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 0.05, 48]} />
        </mesh>
        <mesh position={[0, 0, 0.027]} material={m.blade}>
          <planeGeometry args={[0.52, 0.26]} />
        </mesh>
        <mesh position={[0, 0, -0.027]} rotation-y={Math.PI} material={m.blade}>
          <planeGeometry args={[0.52, 0.26]} />
        </mesh>
      </group>
    </group>
  );
}

function UpperWindow({ x, lit }: { x: number; lit?: boolean }) {
  const { m } = useKit();
  return (
    // On the wall's face: a dark (or dimly lit) pane, glass over it, a frame and a sill.
    <group position={[x, 5.1, 0.302]}>
      <mesh material={lit ? m.glowSoft : m.road}>
        <planeGeometry args={[1.5, 1.7]} />
      </mesh>
      <mesh position={[0, 0, 0.004]} material={m.glass}>
        <planeGeometry args={[1.5, 1.7]} />
      </mesh>
      {[-0.77, 0.77].map((dx) => (
        <Bar key={dx} size={[0.05, 1.8, 0.05]} position={[dx, 0, 0.025]} />
      ))}
      <Bar size={[1.6, 0.05, 0.05]} position={[0, 0.875, 0.025]} />
      <Bar size={[0.035, 1.7, 0.03]} position={[0, 0, 0.015]} />
      <Bar size={[1.7, 0.06, 0.14]} position={[0, -0.88, 0.07]} />
    </group>
  );
}

export function Storefront({ doorRef }: { doorRef: RefObject<THREE.Group | null> }) {
  const { m } = useKit();
  const pier = 7 - OPEN_W;
  return (
    <group>
      {/* Facade: two piers and the header over the opening, plus a cornice. */}
      <CladBox size={[pier, 7, 0.3]} position={[-OPEN_W - pier / 2, 3.5, 0.15]} />
      <CladBox size={[pier, 7, 0.3]} position={[OPEN_W + pier / 2, 3.5, 0.15]} />
      <CladBox size={[OPEN_W * 2, 7 - OPEN_H, 0.3]} position={[0, OPEN_H + (7 - OPEN_H) / 2, 0.15]} />
      <Bar size={[14.2, 0.18, 0.5]} position={[0, 7.05, 0.25]} material={m.fascia} />
      <UpperWindow x={-3.4} />
      <UpperWindow x={0} lit />
      <UpperWindow x={3.4} />

      {/* Fascia with the backlit name. */}
      <Bar size={[5.9, 0.72, 0.16]} position={[0, 3.62, 0.38]} material={m.fascia} />
      <mesh position={[0, 3.62, 0.465]} material={m.sign}>
        <planeGeometry args={[4.8, 0.9]} />
      </mesh>

      {/* Shopfront: jambs, transom, stall risers and glass. */}
      {[-OPEN_W + 0.03, -0.66, 0.66, OPEN_W - 0.03].map((x) => (
        <Bar key={x} size={[0.06, OPEN_H, 0.1]} position={[x, OPEN_H / 2, GLASS_Z]} />
      ))}
      <Bar size={[OPEN_W * 2, 0.06, 0.1]} position={[0, 2.52, GLASS_Z]} />
      <Bar size={[OPEN_W * 2, 0.06, 0.1]} position={[0, OPEN_H - 0.03, GLASS_Z]} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Bar size={[2.0, 0.42, 0.08]} position={[side * 1.68, 0.21, GLASS_Z]} material={m.fascia} />
          <Bar size={[2.0, 0.05, 0.12]} position={[side * 1.68, 0.44, GLASS_Z]} />
          <Pane x0={side > 0 ? 0.69 : -2.67} x1={side > 0 ? 2.67 : -0.69} y0={0.46} y1={2.49} />
          <Pane x0={side > 0 ? 0.69 : -2.67} x1={side > 0 ? 2.67 : -0.69} y0={2.55} y1={3.07} />
        </group>
      ))}
      <Pane x0={-0.63} x1={0.63} y0={2.55} y1={3.07} />
      {/* Window lettering, on the inside of the left pane. */}
      <mesh position={[-1.68, 1.55, GLASS_Z - 0.005]} material={m.decal} renderOrder={3}>
        <planeGeometry args={[1.6, 0.8]} />
      </mesh>
      <Door doorRef={doorRef} />
      {/* Threshold. */}
      <mesh position={[0, 0.015, 0.33]} material={m.concrete} receiveShadow>
        <boxGeometry args={[1.5, 0.03, 0.42]} />
      </mesh>

      <Sconce x={-OPEN_W - 0.55} />
      <Sconce x={OPEN_W + 0.55} />
      <BladeSign />
      <Planter x={-OPEN_W - 1.25} />
      <Planter x={OPEN_W + 1.6} />

      {/* Neighbours: plainer facades either side, stepped slightly. */}
      <mesh position={[-10.5, 4.5, -0.2]} material={m.kerb} receiveShadow>
        <boxGeometry args={[7, 9, 0.4]} />
      </mesh>
      <mesh position={[10.5, 3.8, 0.05]} material={m.lacquer} receiveShadow>
        <boxGeometry args={[7, 7.6, 0.4]} />
      </mesh>

      {/* Pavement, kerb and road. */}
      <mesh position={[0, 0, 7.3]} rotation-x={-Math.PI / 2} material={m.pavement} receiveShadow>
        <planeGeometry args={[40, 14]} />
      </mesh>
      <mesh position={[0, 0.06, 14.35]} material={m.kerb} receiveShadow>
        <boxGeometry args={[40, 0.12, 0.3]} />
      </mesh>
      <mesh position={[0, -0.06, 26]} rotation-x={-Math.PI / 2} material={m.road}>
        <planeGeometry args={[60, 23]} />
      </mesh>
      <mesh material={m.sky}>
        <sphereGeometry args={[48, 32, 16]} />
      </mesh>
    </group>
  );
}
