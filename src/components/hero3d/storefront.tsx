"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { layout } from "@/lib/hero/journey";
import { ContactShadow, roundedBox, useKit } from "./kit";
import { rng } from "./textures";

/*
 * The street side: a dark fluted-concrete facade, a steel shopfront set into
 * the wall's depth (glass line z = 0.12, wall face z = 0.3), a glass door on
 * real hinges, halo-lit lettering, wall sconces, a projecting sign, planted
 * troughs, paving, kerb and road, the neighbouring buildings and a distant
 * city panorama.
 */

const OPEN_W = 2.7; // half-width of the shopfront opening
const OPEN_H = 3.1;
const GLASS_Z = 0.12;
const WALL = 0.3;

/**
 * A copy of a PBR material whose maps repeat once per `tile` metres on a
 * surface of the given size, so texture scale stays physical on any mesh.
 */
export function useScaledMaterial(base: THREE.MeshStandardMaterial, width: number, height: number, tile: number) {
  const material = useMemo(() => {
    const mat = base.clone();
    const maps = ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap"] as const;
    const copies = new Map<THREE.Texture, THREE.Texture>();
    for (const key of maps) {
      const t = base[key];
      if (!t) continue;
      if (!copies.has(t)) {
        const c = t.clone();
        c.repeat.set(width / tile, height / tile);
        c.needsUpdate = true;
        copies.set(t, c);
      }
      mat[key] = copies.get(t)!;
    }
    return mat;
  }, [base, width, height, tile]);
  useEffect(
    () => () => {
      new Set([material.map, material.normalMap, material.roughnessMap, material.metalnessMap, material.aoMap]).forEach((t) => t?.dispose());
      material.dispose();
    },
    [material],
  );
  return material;
}

function Slab({
  size,
  position,
  base,
  tile,
}: {
  size: [number, number, number];
  position: [number, number, number];
  base: THREE.MeshStandardMaterial;
  tile: number;
}) {
  const material = useScaledMaterial(base, size[0], size[1], tile);
  return (
    <mesh position={position} material={material} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  );
}

function Bar({ size, position, material, rotation }: { size: [number, number, number]; position: [number, number, number]; material?: THREE.Material; rotation?: [number, number, number] }) {
  const { m } = useKit();
  return (
    <mesh position={position} rotation={rotation} material={material ?? m.steel} receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  );
}

/**
 * A glazed pane: the glass, a green-edged 10 mm thickness where it meets the
 * frame, glazing beads on the outside and black rubber gaskets.
 */
function Pane({ x0, x1, y0, y1, z = GLASS_Z }: { x0: number; x1: number; y0: number; y1: number; z?: number }) {
  const { m } = useKit();
  const w = x1 - x0;
  const h = y1 - y0;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return (
    <group>
      <mesh position={[cx, cy, z]} material={m.glass} renderOrder={2}>
        <planeGeometry args={[w, h]} />
      </mesh>
      {/* Gaskets and beads, top/bottom then sides. */}
      {[y0 + 0.006, y1 - 0.006].map((y) => (
        <group key={y}>
          <Bar size={[w, 0.012, 0.014]} position={[cx, y, z + 0.008]} material={m.rubber} />
          <Bar size={[w, 0.02, 0.016]} position={[cx, y + (y < cy ? 0.004 : -0.004), z + 0.02]} material={m.steelEdge} />
        </group>
      ))}
      {[x0 + 0.006, x1 - 0.006].map((x) => (
        <group key={x}>
          <Bar size={[0.012, h, 0.014]} position={[x, cy, z + 0.008]} material={m.rubber} />
          <Bar size={[0.02, h, 0.016]} position={[x + (x < cx ? 0.004 : -0.004), cy, z + 0.02]} material={m.steelEdge} />
        </group>
      ))}
    </group>
  );
}

/** A storefront mullion: a deep steel section with a slim face cap. */
function Mullion({ x, y, h }: { x: number; y: number; h: number }) {
  const { m } = useKit();
  return (
    <group position={[x, y, GLASS_Z]}>
      <Bar size={[0.05, h, 0.12]} position={[0, 0, -0.02]} />
      <Bar size={[0.07, h, 0.018]} position={[0, 0, 0.045]} material={m.steelEdge} />
    </group>
  );
}

/** The door leaf, built around its hinge so rotating the group swings it. */
function Door({ doorRef }: { doorRef: RefObject<THREE.Group | null> }) {
  const { m } = useKit();
  const w = layout.doorWidth;
  const h = layout.doorHeight;
  const stile = 0.095;
  const depth = 0.055;
  const g = useMemo(
    () => ({
      knuckle: new THREE.CylinderGeometry(0.014, 0.014, 0.11, 18),
      plate: roundedBox(0.05, 0.1, 0.004, 0.006, 2),
      screw: new THREE.CylinderGeometry(0.0035, 0.0035, 0.003, 10),
    }),
    [],
  );
  useEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  return (
    <group ref={doorRef} position={[layout.doorHinge[0], 0, GLASS_Z]}>
      {/* Frame: stiles, top rail and a deep bottom rail with a brushed kick plate. */}
      <Bar size={[stile, h, depth]} position={[stile / 2, h / 2, 0]} />
      <Bar size={[stile, h, depth]} position={[w - stile / 2, h / 2, 0]} />
      <Bar size={[w, 0.085, depth]} position={[w / 2, h - 0.0425, 0]} />
      <Bar size={[w, 0.22, depth]} position={[w / 2, 0.11, 0]} />
      <Bar size={[w - 0.02, 0.19, 0.003]} position={[w / 2, 0.11, depth / 2 + 0.002]} material={m.brushed} />
      <Bar size={[w - 0.02, 0.19, 0.003]} position={[w / 2, 0.11, -depth / 2 - 0.002]} material={m.brushed} />
      {/* Rubber seals along both vertical edges. */}
      <Bar size={[0.008, h - 0.02, 0.03]} position={[-0.002, h / 2, 0]} material={m.rubber} />
      <Bar size={[0.008, h - 0.02, 0.03]} position={[w + 0.002, h / 2, 0]} material={m.rubber} />
      {/* The pane, with a visible 10 mm green edge. */}
      <mesh position={[w / 2, h / 2 + 0.07, 0]} material={m.glass} renderOrder={2}>
        <planeGeometry args={[w - stile * 2, h - 0.305]} />
      </mesh>
      <Bar size={[0.01, h - 0.305, 0.01]} position={[w - stile - 0.002, h / 2 + 0.07, 0]} material={m.glassEdge} />
      {/* Barrel hinges on the hinge stile: knuckles and screwed leaves. */}
      {[0.3, 1.25, 2.15].map((y) => (
        <group key={y} position={[-0.006, y, depth / 2 + 0.006]}>
          <mesh geometry={g.knuckle} material={m.brushed} castShadow />
          <mesh position={[0.03, 0, -0.004]} geometry={g.plate} material={m.brushed} />
          {[-0.032, 0.032].map((sy) => (
            <mesh key={sy} position={[0.032, sy, -0.0015]} rotation-x={Math.PI / 2} geometry={g.screw} material={m.steelEdge} />
          ))}
        </group>
      ))}
      {/* Lock cylinder on the closing stile. */}
      <mesh position={[w - stile / 2, 1.0, depth / 2 + 0.004]} rotation-x={Math.PI / 2} material={m.brushed}>
        <cylinderGeometry args={[0.014, 0.014, 0.008, 20]} />
      </mesh>
      {/* Pull bars on both faces, on stand-offs with fixing caps. */}
      {[1, -1].map((side) => (
        <group key={side} position={[w - 0.17, 1.05, side * 0.085]}>
          <mesh material={m.brushed} castShadow>
            <cylinderGeometry args={[0.015, 0.015, 0.95, 20]} />
          </mesh>
          {[-0.42, 0.42].map((y) => (
            <group key={y} position={[0, y, -side * 0.03]}>
              <mesh rotation-x={Math.PI / 2} material={m.brushed}>
                <cylinderGeometry args={[0.01, 0.01, 0.06, 14]} />
              </mesh>
              <mesh position={[0, 0, -side * 0.031]} rotation-x={Math.PI / 2} material={m.steelEdge}>
                <cylinderGeometry args={[0.017, 0.017, 0.004, 18]} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

function Sconce({ x }: { x: number }) {
  const { m, quality } = useKit();
  return (
    <group position={[x, 2.55, WALL]}>
      <Bar size={[0.1, 0.14, 0.012]} position={[0, 0, 0.006]} material={m.steelEdge} />
      <mesh position={[0, 0, 0.08]} material={m.steel} castShadow>
        <cylinderGeometry args={[0.065, 0.065, 0.32, 28]} />
      </mesh>
      <mesh position={[0, -0.161, 0.08]} rotation-x={Math.PI / 2} material={m.glow}>
        <circleGeometry args={[0.052, 24]} />
      </mesh>
      <mesh position={[0, 0.161, 0.08]} rotation-x={-Math.PI / 2} material={m.glow}>
        <circleGeometry args={[0.052, 24]} />
      </mesh>
      <pointLight position={[0, -0.3, 0.2]} color="#ffbe7a" intensity={quality === "high" ? 2.2 : 1.6} distance={5} decay={2} />
      <pointLight position={[0, 0.35, 0.12]} color="#ffbe7a" intensity={0.6} distance={2.2} decay={2} />
    </group>
  );
}

/** Leaves scattered over an ellipsoid: one instanced mesh per shrub (the low tier's plants). */
export function Shrub({ position, radius = [0.45, 0.5, 0.3], count = 160, seed = 1 }: {
  position: [number, number, number];
  radius?: [number, number, number];
  count?: number;
  seed?: number;
}) {
  const { m, quality } = useKit();
  const ref = useRef<THREE.InstancedMesh>(null);
  const n = quality === "high" ? count : Math.round(count * 0.55);
  const [rx, ry, rz] = radius;
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
      o.position.set(Math.sin(v) * Math.cos(u) * rx * r, Math.cos(v) * ry * r, Math.sin(v) * Math.sin(u) * rz * r);
      o.rotation.set(random() * Math.PI, random() * Math.PI * 2, random() * Math.PI);
      o.scale.setScalar(0.7 + random() * 0.7);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [n, rx, ry, rz, seed]);
  return (
    <group position={position}>
      <instancedMesh ref={ref} args={[geometry, seed % 2 ? m.leaf : m.leafLight, n]} castShadow />
    </group>
  );
}

/** A cast-concrete trough planted with anthurium (scanned CC0 plants) or, on the low tier, a leaf shrub. */
function Planter({ x }: { x: number }) {
  const { m, assets, quality } = useKit();
  const plants = useMemo(() => {
    const model = assets.models.anthurium;
    if (quality !== "high" || !model) return null;
    // The model holds several plants side by side; use the first two.
    return model.children.slice(0, 2).map((c) => c.clone());
  }, [assets, quality]);
  const g = useMemo(() => roundedBox(1.1, 0.46, 0.48, 0.03, 3), []);
  useEffect(() => () => g.dispose(), [g]);
  return (
    <group position={[x, 0, 0.78]}>
      <mesh position={[0, 0.23, 0]} rotation-x={Math.PI / 2} geometry={g} material={m.concrete} castShadow receiveShadow />
      <mesh position={[0, 0.44, 0]} material={m.soil}>
        <boxGeometry args={[1.02, 0.02, 0.4]} />
      </mesh>
      {plants ? (
        plants.map((p, i) => <primitive key={i} object={p} position={[i === 0 ? -0.22 : 0.24, 0.44, 0]} rotation-y={i * 2.1 + x} scale={1.15} />)
      ) : (
        <>
          <Shrub position={[-0.22, 0.85, 0]} radius={[0.38, 0.45, 0.22]} seed={x > 0 ? 3 : 5} />
          <Shrub position={[0.25, 0.75, 0.02]} radius={[0.32, 0.36, 0.2]} count={120} seed={x > 0 ? 4 : 6} />
        </>
      )}
      <ContactShadow position={[0, 0.004, 0.02]} scale={[1.6, 0.9]} />
    </group>
  );
}

function BladeSign() {
  const { m } = useKit();
  return (
    <group position={[OPEN_W + 0.55, 3.35, WALL]}>
      <Bar size={[0.14, 0.14, 0.012]} position={[0, 0.34, 0.006]} material={m.steelEdge} />
      <Bar size={[0.03, 0.03, 0.75]} position={[0, 0.34, 0.37]} />
      {[0.2, 0.55].map((z) => (
        <mesh key={z} position={[0, 0.3, z]} material={m.steel}>
          <cylinderGeometry args={[0.006, 0.006, 0.08, 8]} />
        </mesh>
      ))}
      <group position={[0, 0, 0.55]} rotation-y={Math.PI / 2}>
        <mesh rotation-x={Math.PI / 2} material={m.fascia} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 0.05, 48]} />
        </mesh>
        <mesh rotation-x={Math.PI / 2} material={m.brushed}>
          <torusGeometry args={[0.3, 0.006, 8, 64]} />
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

/** A window on a wall face: dark or dimly lit room behind glass, frame, transom bar and sill. */
function Window({ position, size = [1.5, 1.7], lit }: { position: [number, number, number]; size?: [number, number]; lit?: boolean }) {
  const { m } = useKit();
  const [w, h] = size;
  return (
    // Sits on the wall face: room and glass just proud of it, frame and sill in front.
    <group position={position}>
      <mesh position={[0, 0, 0.003]} material={lit ? m.windowWarm : m.windowDark}>
        <planeGeometry args={[w, h]} />
      </mesh>
      <mesh position={[0, 0, 0.008]} material={m.glass}>
        <planeGeometry args={[w, h]} />
      </mesh>
      {[-w / 2, w / 2].map((dx) => (
        <Bar key={dx} size={[0.06, h + 0.12, 0.06]} position={[dx, 0, 0.03]} />
      ))}
      <Bar size={[w + 0.12, 0.06, 0.06]} position={[0, h / 2, 0.03]} />
      <Bar size={[0.035, h, 0.03]} position={[0, 0, 0.02]} />
      <Bar size={[w + 0.2, 0.05, 0.14]} position={[0, -h / 2 - 0.04, 0.07]} material={m.granite} />
    </group>
  );
}

/** A neighbouring building: rendered facade, ground-floor glazing, upper windows, cornice. */
function Neighbour({ x, width, height, material, seed }: { x: number; width: number; height: number; material: THREE.MeshStandardMaterial; seed: number }) {
  const { m } = useKit();
  const random = rng(seed);
  const cols = Math.floor(width / 1.9);
  const lit = Array.from({ length: cols * 2 }, () => random() < 0.35);
  return (
    <group position={[x, 0, -0.15]}>
      <Slab size={[width, height, 0.4]} position={[0, height / 2, 0]} base={material} tile={2.2} />
      <Bar size={[width + 0.1, 0.25, 0.55]} position={[0, height + 0.05, 0.05]} material={m.granite} />
      {/* Ground floor: a dark shopfront with a door. */}
      <Window position={[0, 1.55, 0.2]} size={[width * 0.7, 2.4]} lit={seed % 2 === 1} />
      {[0, 1].map((row) =>
        Array.from({ length: cols }, (_, c) => (
          <Window
            key={`${row}-${c}`}
            position={[-width / 2 + (c + 0.5) * (width / cols), 4.3 + row * 2.3, 0.2]}
            size={[1.1, 1.5]}
            lit={lit[row * cols + c]}
          />
        )),
      )}
    </group>
  );
}

/** A slim modern street light with a downward LED head near the kerb. */
function StreetLight({ x, z }: { x: number; z: number }) {
  const { m, quality } = useKit();
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 2.6, 0]} material={m.steel} castShadow>
        <cylinderGeometry args={[0.045, 0.07, 5.2, 16]} />
      </mesh>
      <mesh position={[0.35, 5.15, 0]} rotation-z={Math.PI / 2} material={m.steel}>
        <cylinderGeometry args={[0.03, 0.03, 0.7, 12]} />
      </mesh>
      <mesh position={[0.72, 5.12, 0]} material={m.steel} castShadow>
        <boxGeometry args={[0.5, 0.07, 0.2]} />
      </mesh>
      <mesh position={[0.72, 5.08, 0]} rotation-x={Math.PI / 2} material={m.glow}>
        <planeGeometry args={[0.42, 0.14]} />
      </mesh>
      {quality === "high" && <pointLight position={[0.72, 4.9, 0]} color="#ffd6a6" intensity={18} distance={12} decay={2} />}
    </group>
  );
}

/** Halo-lit fascia lettering: letters on pins in front of the fascia, their glow washing it behind. */
function Fascia() {
  const { m } = useKit();
  return (
    <group position={[0, 3.62, WALL]}>
      <Bar size={[5.9, 0.72, 0.16]} position={[0, 0, 0.08]} material={m.fascia} />
      {[-2.8, 2.8].map((x) => (
        <Bar key={x} size={[0.06, 0.6, 0.12]} position={[x, 0, -0.02]} material={m.steelEdge} />
      ))}
      <mesh position={[0, 0, 0.163]} material={m.signHalo}>
        <planeGeometry args={[5.0, 0.94]} />
      </mesh>
      <mesh position={[0, 0, 0.195]} material={m.sign}>
        <planeGeometry args={[4.8, 0.9]} />
      </mesh>
      {[-1.8, -0.9, 0, 0.9, 1.8].map((x) => (
        <mesh key={x} position={[x, 0.08, 0.18]} rotation-x={Math.PI / 2} material={m.steelEdge}>
          <cylinderGeometry args={[0.004, 0.004, 0.03, 6]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Vertical steel battens over the dark render: real fins (40 × 60 mm at a
 * 110 mm pitch) that catch the light and throw shadow, on the piers and over
 * the header, stopping short of windows and the fascia.
 */
function Battens() {
  const { m } = useKit();
  const ref = useRef<THREE.InstancedMesh>(null);
  const fins = useMemo(() => {
    const list: { x: number; y: number; h: number }[] = [];
    const pitch = 0.11;
    for (let x = -6.94; x <= 6.94; x += pitch) {
      const inOpening = Math.abs(x) < OPEN_W + 0.04;
      // Leave clear bays for the upper windows.
      const inWindow = [-3.4, 0, 3.4].some((wx) => Math.abs(x - wx) < 0.82);
      if (inOpening) {
        // Over the header, above the fascia only.
        if (!inWindow) list.push({ x, y: 5.6, h: 2.8 });
        list.push({ x, y: 4.15, h: 0.06 }); // a continuous drip line under the windows
      } else if (inWindow) {
        list.push({ x, y: 2.05, h: 4.1 });
        list.push({ x, y: 6.55, h: 0.9 });
      } else {
        list.push({ x, y: 3.5 + 0.17, h: 7 - 0.34 });
      }
    }
    return list.filter((f) => f.h > 0.1);
  }, []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new THREE.Object3D();
    fins.forEach((f, i) => {
      o.position.set(f.x, f.y, WALL + 0.03);
      o.scale.set(1, f.h, 1);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [fins]);
  return (
    <instancedMesh ref={ref} args={[undefined, m.steelEdge, fins.length]} castShadow receiveShadow>
      <boxGeometry args={[0.04, 1, 0.06]} />
    </instancedMesh>
  );
}

/** Kerb-side drainage grate: a frame with instanced bars. */
function Grate({ x }: { x: number }) {
  const { m } = useKit();
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new THREE.Object3D();
    for (let i = 0; i < 14; i++) {
      o.position.set(-0.3 + i * 0.046, 0.002, 0);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <group position={[x, 0.001, 13.95]}>
      <mesh rotation-x={-Math.PI / 2} material={m.windowDark}>
        <planeGeometry args={[0.68, 0.34]} />
      </mesh>
      <instancedMesh ref={ref} args={[undefined, m.steel, 14]}>
        <boxGeometry args={[0.02, 0.012, 0.3]} />
      </instancedMesh>
    </group>
  );
}

export function Storefront({ doorRef }: { doorRef: RefObject<THREE.Group | null> }) {
  const { m, assets } = useKit();
  const pier = 7 - OPEN_W;
  const pavement = useScaledMaterial(m.pavement, 40, 14, 2.4);
  const road = useScaledMaterial(m.road, 60, 23, 4);
  return (
    <group>
      {/* Facade: two piers and the header over the opening, a granite plinth and a cornice. */}
      <Slab size={[pier, 7, WALL]} position={[-OPEN_W - pier / 2, 3.5, WALL / 2]} base={m.renderDark} tile={2.4} />
      <Slab size={[pier, 7, WALL]} position={[OPEN_W + pier / 2, 3.5, WALL / 2]} base={m.renderDark} tile={2.4} />
      <Slab size={[OPEN_W * 2, 7 - OPEN_H, WALL]} position={[0, OPEN_H + (7 - OPEN_H) / 2, WALL / 2]} base={m.renderDark} tile={2.4} />
      <Battens />
      {[-1, 1].map((s) => (
        <Bar key={s} size={[pier, 0.34, 0.02]} position={[s * (OPEN_W + pier / 2), 0.17, WALL + 0.01]} material={m.granite} />
      ))}
      <Bar size={[14.3, 0.2, 0.52]} position={[0, 7.06, 0.26]} material={m.fascia} />
      {/* Steel angle trim on the reveal edges of the opening. */}
      {[-OPEN_W, OPEN_W].map((x) => (
        <Bar key={x} size={[0.02, OPEN_H, 0.02]} position={[x, OPEN_H / 2, WALL]} material={m.steelEdge} />
      ))}
      <Bar size={[OPEN_W * 2 + 0.02, 0.02, 0.02]} position={[0, OPEN_H, WALL]} material={m.steelEdge} />
      <Window position={[-3.4, 5.1, WALL]} />
      <Window position={[0, 5.1, WALL]} lit />
      <Window position={[3.4, 5.1, WALL]} />

      <Fascia />

      {/* Shopfront: mullions, transom, stall risers, sills and glazing. */}
      {[-OPEN_W + 0.035, -0.66, 0.66, OPEN_W - 0.035].map((x) => (
        <Mullion key={x} x={x} y={OPEN_H / 2} h={OPEN_H} />
      ))}
      <Bar size={[OPEN_W * 2, 0.06, 0.12]} position={[0, 2.52, GLASS_Z - 0.02]} />
      <Bar size={[OPEN_W * 2, 0.06, 0.12]} position={[0, OPEN_H - 0.03, GLASS_Z - 0.02]} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Bar size={[2.0, 0.42, 0.08]} position={[side * 1.68, 0.21, GLASS_Z]} material={m.fascia} />
          <Bar size={[2.0, 0.035, 0.18]} position={[side * 1.68, 0.44, GLASS_Z + 0.03]} rotation={[0.08, 0, 0]} material={m.brushed} />
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
      {/* Granite threshold step. */}
      <mesh position={[0, 0.02, 0.33]} material={m.granite} receiveShadow castShadow>
        <boxGeometry args={[1.5, 0.04, 0.44]} />
      </mesh>

      <Sconce x={-OPEN_W - 0.55} />
      <Sconce x={OPEN_W + 0.55} />
      <BladeSign />
      <Planter x={-OPEN_W - 1.25} />
      <Planter x={OPEN_W + 1.6} />

      <Neighbour x={-10.6} width={7.2} height={9} material={m.render} seed={3} />
      <Neighbour x={10.6} width={7.2} height={7.6} material={m.renderDark} seed={8} />

      {/* Pavement, granite kerb with a gutter, road, a drain and a street light. */}
      <mesh position={[0, 0, 7.15]} rotation-x={-Math.PI / 2} material={pavement} receiveShadow>
        <planeGeometry args={[40, 14]} />
      </mesh>
      <mesh position={[0, 0.0, 14.27]} material={m.granite} receiveShadow castShadow>
        <boxGeometry args={[40, 0.14, 0.25]} />
      </mesh>
      <mesh position={[0, -0.05, 14.55]} rotation-x={-Math.PI / 2} material={m.concrete} receiveShadow>
        <planeGeometry args={[40, 0.32]} />
      </mesh>
      <mesh position={[0, -0.06, 26]} rotation-x={-Math.PI / 2} material={road} receiveShadow>
        <planeGeometry args={[60, 23]} />
      </mesh>
      <Grate x={-3.2} />
      <Grate x={5.8} />
      <StreetLight x={-6.8} z={13.6} />

      {/* Distant city: a night-street panorama far behind everything (no parallax at this range). */}
      <mesh rotation-y={-Math.PI / 2}>
        <sphereGeometry args={[60, 48, 24]} />
        <meshBasicMaterial map={assets.backdrop} side={THREE.BackSide} fog={false} depthWrite={false} color="#8a8f96" />
      </mesh>
    </group>
  );
}
