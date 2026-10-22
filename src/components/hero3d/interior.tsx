"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { layout } from "@/lib/hero/journey";
import { archShape, ContactShadow, roundedBox, useKit } from "./kit";
import { rng } from "./textures";
import { Shrub } from "./storefront";

/*
 * The shop: a 6 × 9 m room behind the facade (x −3…3, z 0…−9, 3.2 m high).
 * Stations run along the right wall, each an arched mirror over a counter
 * with a chair facing it; the middle one is where the haircut happens.
 */

const ROOM = { x0: -3, x1: 3, z1: -9, h: 3.2 };
export const stationZ = [-2.7, layout.chair[2], -7.5];

/** Custom geometries for this file, built once and disposed with the scene. */
function useGeometries() {
  const g = useMemo(
    () => ({
      seat: roundedBox(0.5, 0.12, 0.5, 0.05),
      back: roundedBox(0.09, 0.62, 0.48, 0.045),
      headrest: roundedBox(0.07, 0.13, 0.26, 0.03),
      arm: roundedBox(0.44, 0.055, 0.085, 0.025),
      mirror: new THREE.ShapeGeometry(archShape(0.84, 1.42), 48),
      mirrorFrame: new THREE.ExtrudeGeometry(archShape(0.92, 1.5), { depth: 0.03, bevelEnabled: false, curveSegments: 48 }),
    }),
    [],
  );
  useEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  return g;
}

type Geometries = ReturnType<typeof useGeometries>;

/** A hydraulic barber chair facing +x; seat top at 0.53 m. */
export function BarberChair({ position, rotation = 0, g }: { position: readonly [number, number, number]; rotation?: number; g: Geometries }) {
  const { m } = useKit();
  return (
    <group position={position as [number, number, number]} rotation-y={rotation}>
      <mesh position={[0, 0.015, 0]} material={m.chrome} castShadow receiveShadow>
        <cylinderGeometry args={[0.3, 0.31, 0.03, 48]} />
      </mesh>
      <mesh position={[0, 0.2, 0]} material={m.chrome} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.34, 24]} />
      </mesh>
      <mesh position={[0, 0.37, 0]} material={m.lacquer} castShadow>
        <cylinderGeometry args={[0.1, 0.085, 0.12, 24]} />
      </mesh>
      <mesh position={[0.02, 0.47, 0]} geometry={g.seat} material={m.leather} castShadow receiveShadow />
      <mesh position={[-0.23, 0.84, 0]} rotation-z={0.13} geometry={g.back} material={m.leather} castShadow />
      <mesh position={[-0.33, 1.29, 0]} rotation-z={0.13} material={m.chrome}>
        <cylinderGeometry args={[0.01, 0.01, 0.2, 10]} />
      </mesh>
      <mesh position={[-0.35, 1.36, 0]} rotation-z={0.13} geometry={g.headrest} material={m.leather} castShadow />
      {[-0.29, 0.29].map((z) => (
        <group key={z}>
          <mesh position={[0.05, 0.71, z]} geometry={g.arm} material={m.leather} castShadow />
          <mesh position={[0.17, 0.6, z]} material={m.chrome}>
            <cylinderGeometry args={[0.012, 0.012, 0.2, 10]} />
          </mesh>
          <mesh position={[-0.15, 0.6, z]} material={m.chrome}>
            <cylinderGeometry args={[0.012, 0.012, 0.2, 10]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0.36, 0.3, 0]} rotation-z={-0.7} material={m.chrome}>
        <cylinderGeometry args={[0.014, 0.014, 0.32, 10]} />
      </mesh>
      <mesh position={[0.46, 0.17, 0]} material={m.chrome} castShadow>
        <boxGeometry args={[0.14, 0.015, 0.36]} />
      </mesh>
      <ContactShadow position={[0, 0.003, 0]} scale={[1.0, 0.95]} />
    </group>
  );
}

function Pendant({ x, z, drop = 0.85 }: { x: number; z: number; drop?: number }) {
  const { m, quality } = useKit();
  const y = ROOM.h - drop;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, y + drop / 2, 0]} material={m.steel}>
        <cylinderGeometry args={[0.004, 0.004, drop, 6]} />
      </mesh>
      <mesh position={[0, y, 0]} material={m.shade} castShadow>
        <cylinderGeometry args={[0.05, 0.2, 0.22, 40, 1, true]} />
      </mesh>
      <mesh position={[0, y - 0.09, 0]} material={m.glow}>
        <sphereGeometry args={[0.045, 20, 12]} />
      </mesh>
      <pointLight position={[0, y - 0.15, 0]} color="#ffb36b" intensity={quality === "high" ? 4.2 : 5} distance={7} decay={2} />
    </group>
  );
}

function Station({ z, hero, g }: { z: number; hero?: boolean; g: Geometries }) {
  const { m } = useKit();
  const x = layout.mirrorX;
  return (
    <group>
      {/* Arched mirror on a dark frame, light bar above. */}
      <group position={[x, 0.98, z]} rotation-y={-Math.PI / 2}>
        <mesh position={[0, -0.04, -0.045]} geometry={g.mirrorFrame} material={m.steel} />
        <mesh position={[0, 0, -0.012]} geometry={g.mirror} material={m.mirror} />
      </group>
      <mesh position={[x - 0.04, 2.6, z]} material={m.glow}>
        <boxGeometry args={[0.02, 0.025, 0.7]} />
      </mesh>
      {/* Counter: oak top on a dark cabinet. */}
      <mesh position={[x - 0.24, 0.86, z]} material={m.wood} castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.04, 1.15]} />
      </mesh>
      <mesh position={[x - 0.22, 0.42, z]} material={m.lacquer} castShadow receiveShadow>
        <boxGeometry args={[0.42, 0.84, 1.05]} />
      </mesh>
      {/* Tools and products on the counter. */}
      <mesh position={[x - 0.2, 0.96, z - 0.42]} material={m.product[0]} castShadow>
        <cylinderGeometry args={[0.032, 0.032, 0.16, 20]} />
      </mesh>
      <mesh position={[x - 0.14, 0.94, z - 0.34]} material={m.product[1]} castShadow>
        <cylinderGeometry args={[0.028, 0.03, 0.12, 20]} />
      </mesh>
      <mesh position={[x - 0.28, 0.9, z + 0.3]} material={m.product[3]} castShadow>
        <boxGeometry args={[0.18, 0.04, 0.12]} />
      </mesh>
      {hero && (
        <>
          <mesh position={[x - 0.32, 0.885, z + 0.05]} rotation-y={0.4} material={m.product[3]}>
            <boxGeometry args={[0.19, 0.006, 0.03]} />
          </mesh>
          <mesh position={[x - 0.16, 0.975, z - 0.22]} material={m.product[2]} castShadow>
            <cylinderGeometry args={[0.035, 0.04, 0.19, 20]} />
          </mesh>
        </>
      )}
      <BarberChair position={[layout.chair[0], 0, z]} rotation={hero ? 0 : z < -6 ? 0.25 : -0.3} g={g} />
    </group>
  );
}

function Shelves() {
  const { m } = useKit();
  const items = useMemo(() => {
    const list: { x: number; y: number; r: number; h: number; mat: number }[] = [];
    const random = rng(41);
    for (const y of [1.25, 1.75]) {
      for (let x = -1.0; x < 1.0; x += 0.11 + random() * 0.08) {
        if (random() < 0.2) continue;
        list.push({ x, y, r: 0.025 + random() * 0.015, h: 0.1 + random() * 0.12, mat: Math.floor(random() * 4) });
      }
    }
    return list;
  }, []);
  return (
    <group position={[-0.6, 0, ROOM.z1 + 0.16]}>
      {[1.25, 1.75].map((y) => (
        <mesh key={y} position={[0, y - 0.02, 0]} material={m.wood} castShadow receiveShadow>
          <boxGeometry args={[2.3, 0.04, 0.26]} />
        </mesh>
      ))}
      {items.map((it, i) => (
        <mesh key={i} position={[it.x, it.y + it.h / 2, 0]} material={m.product[it.mat]} castShadow>
          <cylinderGeometry args={[it.r, it.r, it.h, 16]} />
        </mesh>
      ))}
    </group>
  );
}

export function Interior() {
  const { m } = useKit();
  const g = useGeometries();
  const depth = -ROOM.z1;
  return (
    <group>
      {/* Shell. */}
      <mesh position={[0, 0.002, ROOM.z1 / 2 + 0.06]} rotation-x={-Math.PI / 2} material={m.terrazzo} receiveShadow>
        <planeGeometry args={[6, depth + 0.12]} />
      </mesh>
      <mesh position={[0, ROOM.h, ROOM.z1 / 2]} rotation-x={Math.PI / 2} material={m.ceiling}>
        <planeGeometry args={[6, depth]} />
      </mesh>
      <mesh position={[ROOM.x0, ROOM.h / 2, ROOM.z1 / 2]} rotation-y={Math.PI / 2} material={m.plaster} receiveShadow>
        <planeGeometry args={[depth, ROOM.h]} />
      </mesh>
      <mesh position={[ROOM.x1, ROOM.h / 2, ROOM.z1 / 2]} rotation-y={-Math.PI / 2} material={m.plaster} receiveShadow>
        <planeGeometry args={[depth, ROOM.h]} />
      </mesh>
      <mesh position={[0, ROOM.h / 2, ROOM.z1]} material={m.plasterOlive} receiveShadow>
        <planeGeometry args={[6, ROOM.h]} />
      </mesh>
      {/* Skirting. */}
      {[ROOM.x0 + 0.01, ROOM.x1 - 0.01].map((x) => (
        <mesh key={x} position={[x, 0.05, ROOM.z1 / 2]} material={m.lacquer}>
          <boxGeometry args={[0.02, 0.1, depth]} />
        </mesh>
      ))}

      {stationZ.map((z, i) => (
        <Station key={z} z={z} hero={i === 1} g={g} />
      ))}
      <Pendant x={1.25} z={stationZ[0]} />
      <Pendant x={1.25} z={stationZ[1]} drop={0.8} />
      <Pendant x={1.25} z={stationZ[2]} />
      <Pendant x={-1.3} z={-4.2} drop={0.7} />

      {/* Reception near the door. */}
      <mesh position={[-2.25, 0.5, -1.55]} material={m.lacquer} castShadow receiveShadow>
        <boxGeometry args={[0.6, 1.0, 1.5]} />
      </mesh>
      <mesh position={[-2.25, 1.02, -1.55]} material={m.wood} castShadow receiveShadow>
        <boxGeometry args={[0.66, 0.04, 1.58]} />
      </mesh>
      <ContactShadow position={[-2.25, 0.003, -1.55]} scale={[1.1, 2.0]} />

      {/* Waiting bench and two framed prints on the left wall. */}
      <mesh position={[-2.72, 0.43, -4.6]} material={m.wood} castShadow receiveShadow>
        <boxGeometry args={[0.46, 0.06, 2.2]} />
      </mesh>
      {[-3.6, -5.6].map((z) => (
        <mesh key={z} position={[-2.72, 0.2, z]} material={m.lacquer} castShadow>
          <boxGeometry args={[0.4, 0.4, 0.06]} />
        </mesh>
      ))}
      <ContactShadow position={[-2.72, 0.003, -4.6]} scale={[0.8, 2.6]} />
      {[-4.0, -5.25].map((z) => (
        <group key={z} position={[ROOM.x0 + 0.02, 1.65, z]} rotation-y={Math.PI / 2}>
          <mesh material={m.steel}>
            <boxGeometry args={[0.62, 0.82, 0.02]} />
          </mesh>
          <mesh position={[0, 0, 0.012]} material={m.print}>
            <planeGeometry args={[0.5, 0.7]} />
          </mesh>
        </group>
      ))}

      <Shelves />
      <mesh position={[-2.45, 0.28, -8.4]} material={m.concrete} castShadow>
        <cylinderGeometry args={[0.24, 0.2, 0.56, 32]} />
      </mesh>
      <Shrub position={[-2.45, 1.25, -8.4]} radius={[0.5, 0.75, 0.5]} count={260} seed={7} />
      <ContactShadow position={[-2.45, 0.003, -8.4]} scale={[0.9, 0.9]} />
    </group>
  );
}
