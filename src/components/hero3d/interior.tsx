"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { layout } from "@/lib/hero/journey";
import { archShape, ContactShadow, cushion, roundedBox, useKit } from "./kit";
import { Clipper, Comb } from "./figures";
import { Shrub } from "./storefront";
import { rng } from "./textures";

/*
 * The shop: a 6 × 9 m room behind the facade (x −3…3, z 0…−9, 3.2 m high).
 * Stations run along the right wall, each an arched mirror over a walnut
 * counter with a hydraulic chair facing it; the middle one is where the
 * haircut happens, and gets the full set of tools.
 */

const ROOM = { x0: -3, x1: 3, z1: -9, h: 3.2 };
export const stationZ = [-2.7, layout.chair[2], -7.5];

/* ----------------------------------------------------------- Chair */

function useChairGeometry() {
  const g = useMemo(() => {
    const tube = (points: [number, number, number][], radius: number) =>
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), 32, radius, 12, false);
    // Base: a shallow chrome dish with a rolled lip and a raised boss for the column.
    const base = new THREE.LatheGeometry(
      [
        [0, 0.045],
        [0.07, 0.045],
        [0.09, 0.03],
        [0.27, 0.018],
        [0.305, 0.012],
        [0.31, 0.004],
        [0.3, 0],
        [0, 0],
      ].map(([r, y]) => new THREE.Vector2(r, y)),
      64,
    );
    const piping = (w: number, d: number) =>
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(
          Array.from({ length: 48 }, (_, i) => {
            const a = (i / 48) * Math.PI * 2;
            // A rounded rectangle traced as a superellipse.
            const c = Math.cos(a);
            const s = Math.sin(a);
            return new THREE.Vector3((Math.sign(c) * Math.pow(Math.abs(c), 0.25) * w) / 2, 0, (Math.sign(s) * Math.pow(Math.abs(s), 0.25) * d) / 2);
          }),
          true,
        ),
        96,
        0.0045,
        8,
        true,
      );
    return {
      base,
      ring: new THREE.TorusGeometry(0.305, 0.008, 8, 64),
      seat: cushion(0.5, 0.11, 0.5, 0.45),
      seatPiping: piping(0.49, 0.49),
      back: cushion(0.085, 0.6, 0.48, 0.45),
      headrest: cushion(0.07, 0.13, 0.27, 0.5),
      arm: cushion(0.42, 0.05, 0.085, 0.55),
      footPlate: roundedBox(0.16, 0.36, 0.014, 0.012, 2),
      footRib: roundedBox(0.012, 0.34, 0.006, 0.002, 1),
      pedal: roundedBox(0.09, 0.05, 0.02, 0.008, 2),
      lever: roundedBox(0.012, 0.012, 0.12, 0.004, 1),
      backFrame: tube(
        [
          [0.02, 0.55, -0.26],
          [-0.18, 0.58, -0.27],
          [-0.27, 0.9, -0.26],
          [-0.33, 1.14, -0.2],
          [-0.335, 1.16, 0],
          [-0.33, 1.14, 0.2],
          [-0.27, 0.9, 0.26],
          [-0.18, 0.58, 0.27],
          [0.02, 0.55, 0.26],
        ],
        0.012,
      ),
      armTube: tube(
        [
          [-0.2, 0.56, 0],
          [-0.16, 0.66, 0],
          [0.0, 0.69, 0],
          [0.18, 0.69, 0],
          [0.24, 0.6, 0],
          [0.22, 0.55, 0],
        ],
        0.011,
      ),
      footTube: tube(
        [
          [0.2, 0.5, 0],
          [0.32, 0.4, 0],
          [0.4, 0.26, 0],
          [0.43, 0.17, 0],
        ],
        0.013,
      ),
      bolt: new THREE.CylinderGeometry(0.0055, 0.0055, 0.006, 12),
    };
  }, []);
  useEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  return g;
}

type ChairGeometry = ReturnType<typeof useChairGeometry>;

/** A modern hydraulic barber chair facing +x; seat top at 0.53 m. */
export function BarberChair({ position, rotation = 0, g }: { position: readonly [number, number, number]; rotation?: number; g: ChairGeometry }) {
  const { m } = useKit();
  return (
    <group position={position as [number, number, number]} rotation-y={rotation}>
      {/* Base, rubber foot ring, hydraulic column with its collars, pump pedal. */}
      <mesh geometry={g.base} material={m.chrome} castShadow receiveShadow />
      <mesh position={[0, 0.003, 0]} rotation-x={Math.PI / 2} geometry={g.ring} material={m.rubber} />
      <mesh position={[0, 0.16, 0]} material={m.lacquer} castShadow>
        <cylinderGeometry args={[0.062, 0.07, 0.24, 32]} />
      </mesh>
      {[0.05, 0.28].map((y) => (
        <mesh key={y} position={[0, y, 0]} material={m.chrome}>
          <cylinderGeometry args={[0.074, 0.074, 0.014, 32]} />
        </mesh>
      ))}
      <mesh position={[0, 0.33, 0]} material={m.chrome} castShadow>
        <cylinderGeometry args={[0.042, 0.042, 0.1, 24]} />
      </mesh>
      <mesh position={[0, 0.39, 0]} material={m.brushed} castShadow>
        <cylinderGeometry args={[0.2, 0.17, 0.025, 40]} />
      </mesh>
      <group position={[0.06, 0.08, 0.1]} rotation-y={-0.6}>
        <mesh position={[0.08, 0, 0]} rotation-y={Math.PI / 2} geometry={g.lever} material={m.chrome} />
        <mesh position={[0.15, 0.005, 0]} geometry={g.pedal} material={m.rubber} castShadow />
      </group>
      {/* Seat with piping, under-seat pan. */}
      <mesh position={[0.02, 0.455, 0]} material={m.lacquer}>
        <boxGeometry args={[0.46, 0.05, 0.46]} />
      </mesh>
      <mesh position={[0.02, 0.475, 0]} geometry={g.seat} material={m.leather} castShadow receiveShadow />
      <mesh position={[0.02, 0.528, 0]} geometry={g.seatPiping} material={m.leatherCap} />
      {/* Back cushion with three stitched channels, on a chrome tube frame. */}
      <mesh geometry={g.backFrame} material={m.chrome} castShadow />
      <group position={[-0.235, 0.84, 0]} rotation-z={0.13}>
        <mesh geometry={g.back} material={m.leather} castShadow />
        {[-0.12, 0, 0.12].map((z) => (
          <mesh key={z} position={[0.044, 0, z]} material={m.rubber}>
            <boxGeometry args={[0.002, 0.5, 0.0035]} />
          </mesh>
        ))}
      </group>
      {/* Headrest on an adjustable chrome bar with a locking knob. */}
      <group rotation-z={0.13}>
        <mesh position={[-0.335, 1.21, 0]} material={m.chrome}>
          <boxGeometry args={[0.012, 0.16, 0.05]} />
        </mesh>
        <mesh position={[-0.35, 1.17, 0.035]} rotation-x={Math.PI / 2} material={m.plastic}>
          <cylinderGeometry args={[0.014, 0.014, 0.02, 18]} />
        </mesh>
        <mesh position={[-0.315, 1.32, 0]} geometry={g.headrest} material={m.leather} castShadow />
      </group>
      {/* Armrests: leather pads on curved chrome arms, bolted to the seat. */}
      {[-0.29, 0.29].map((z) => (
        <group key={z} position={[0, 0, z]}>
          <mesh geometry={g.armTube} material={m.chrome} castShadow />
          <mesh position={[0.02, 0.715, 0]} geometry={g.arm} material={m.leather} castShadow />
          {[-0.12, 0.14].map((x) => (
            <mesh key={x} position={[x, 0.69, Math.sign(z) * 0.045]} rotation-x={Math.PI / 2} geometry={g.bolt} material={m.chrome} />
          ))}
        </group>
      ))}
      {/* Footrest: chrome support and a ribbed plate. */}
      <mesh geometry={g.footTube} material={m.chrome} castShadow />
      <group position={[0.47, 0.165, 0]} rotation-z={-1.35}>
        <mesh rotation-x={Math.PI / 2} geometry={g.footPlate} material={m.brushed} castShadow />
        {[-0.05, -0.025, 0, 0.025, 0.05].map((x) => (
          <mesh key={x} position={[x, -0.01, 0]} rotation-x={Math.PI / 2} geometry={g.footRib} material={m.rubber} />
        ))}
      </group>
      <ContactShadow position={[0, 0.002, 0]} scale={[1.0, 0.95]} opacity={0.8} />
    </group>
  );
}

/* --------------------------------------------------------- Products */

/** A lathe-turned container (jar, bottle) with an optional label band and cap. */
function Container({
  position,
  profile,
  body,
  cap,
  capHeight = 0.02,
  label,
  labelBand,
}: {
  position: [number, number, number];
  profile: [number, number][];
  body: THREE.Material;
  cap?: THREE.Material;
  capHeight?: number;
  label?: THREE.Material;
  /** [y, height, radius] of the label band. */
  labelBand?: [number, number, number];
}) {
  const g = useMemo(() => {
    const lathe = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 32);
    const top = profile.at(-1)!;
    return {
      lathe,
      capGeo: new THREE.CylinderGeometry(top[0] * 1.15, top[0] * 1.15, capHeight, 24),
      band: labelBand ? new THREE.CylinderGeometry(labelBand[2], labelBand[2], labelBand[1], 32, 1, true) : null,
      top,
    };
    // Profiles are literals per call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => [g.lathe, g.capGeo, g.band].forEach((x) => x?.dispose()), [g]);
  return (
    <group position={position}>
      <mesh geometry={g.lathe} material={body} />
      {cap && <mesh position={[0, g.top[1] + capHeight / 2, 0]} geometry={g.capGeo} material={cap} />}
      {g.band && label && labelBand && <mesh position={[0, labelBand[0], 0]} geometry={g.band} material={label} />}
    </group>
  );
}

/** A trigger spray bottle: bottle, collar, trigger head with nozzle and trigger. */
function SprayBottle({ position }: { position: [number, number, number] }) {
  const { m } = useKit();
  return (
    <group position={position}>
      <Container position={[0, 0, 0]} profile={[[0, 0], [0.032, 0.002], [0.034, 0.02], [0.034, 0.13], [0.026, 0.16], [0.014, 0.175], [0.014, 0.185]]} body={m.glassClear} />
      <Container position={[0, 0, 0]} profile={[[0, 0.004], [0.031, 0.006], [0.031, 0.07], [0, 0.07]]} body={m.liquid} />
      <mesh position={[0, 0.195, 0]} material={m.plasticGrip}>
        <cylinderGeometry args={[0.017, 0.017, 0.02, 20]} />
      </mesh>
      <mesh position={[0.012, 0.222, 0]} material={m.plastic} castShadow>
        <boxGeometry args={[0.055, 0.032, 0.026]} />
      </mesh>
      <mesh position={[0.043, 0.224, 0]} rotation-z={Math.PI / 2} material={m.plastic}>
        <cylinderGeometry args={[0.006, 0.007, 0.012, 12]} />
      </mesh>
      <mesh position={[0.026, 0.19, 0]} rotation-z={-0.35} material={m.plastic} castShadow>
        <boxGeometry args={[0.01, 0.045, 0.018]} />
      </mesh>
    </group>
  );
}

/** Scissors lying flat: two blades, finger rings, a pivot screw. */
function Scissors({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  const { m } = useKit();
  const blade = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(0.1, 0.004);
    s.quadraticCurveTo(0.11, 0.0, 0.1, -0.002);
    s.lineTo(0, -0.007);
    s.lineTo(0, 0);
    return new THREE.ExtrudeGeometry(s, { depth: 0.002, bevelEnabled: true, bevelThickness: 0.0005, bevelSize: 0.0005, bevelSegments: 1 });
  }, []);
  useEffect(() => () => blade.dispose(), [blade]);
  return (
    <group position={position} rotation={[-Math.PI / 2, 0, rotation]}>
      <mesh geometry={blade} material={m.chrome} rotation-z={0.05} />
      <mesh geometry={blade} material={m.chrome} position={[0, 0, 0.0025]} rotation={[Math.PI, 0, -0.05]} />
      {[0.012, -0.012].map((y) => (
        <mesh key={y} position={[-0.035, y, 0.001]} material={m.chrome} castShadow>
          <torusGeometry args={[0.012, 0.0022, 8, 24]} />
        </mesh>
      ))}
      <mesh position={[0, 0, 0.003]} rotation-x={Math.PI / 2} material={m.brushed}>
        <cylinderGeometry args={[0.003, 0.003, 0.006, 12]} />
      </mesh>
    </group>
  );
}

/** A folded towel: a soft slab with its fold edge rolled over. */
function Towel({ position, material, rotation = 0 }: { position: [number, number, number]; material: THREE.Material; rotation?: number }) {
  const geometry = useMemo(() => cushion(0.22, 0.03, 0.15, 0.7, 10), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh position={position} rotation-y={rotation} geometry={geometry} material={material} castShadow receiveShadow />;
}

/** The working tools on the hero station: an organised set on a rubber mat. */
function ToolSet({ x, z }: { x: number; z: number }) {
  const { m } = useKit();
  const top = 0.9;
  return (
    <group>
      <mesh position={[x, top + 0.003, z + 0.05]} material={m.mat} receiveShadow>
        <boxGeometry args={[0.34, 0.006, 0.42]} />
      </mesh>
      {/* Spare clipper lying on the mat, a trimmer on its charging stand. */}
      <group position={[x - 0.05, top + 0.022, z + 0.16]} rotation={[-Math.PI / 2, 0, 0.3]}>
        <Clipper cord={false} />
      </group>
      <mesh position={[x - 0.04, top + 0.018, z - 0.08]} material={m.plastic} castShadow>
        <boxGeometry args={[0.07, 0.024, 0.06]} />
      </mesh>
      <group position={[x - 0.04, top + 0.12, z - 0.08]} rotation={[0, Math.PI / 2, -0.15]} scale={0.72}>
        <Clipper cord={false} />
      </group>
      <Scissors position={[x + 0.07, top + 0.008, z + 0.1]} rotation={-0.4} />
      <group position={[x + 0.05, top + 0.008, z - 0.02]} rotation={[-Math.PI / 2, 0, 0.1]}>
        <Comb length={0.17} />
      </group>
      {/* Neck brush: turned walnut handle with a dense bristle head. */}
      <group position={[x + 0.12, top + 0.02, z + 0.2]} rotation={[0, 0.5, Math.PI / 2]}>
        <mesh material={m.walnut} castShadow>
          <cylinderGeometry args={[0.012, 0.016, 0.12, 20]} />
        </mesh>
        <mesh position={[0, -0.085, 0]} material={m.bristle} castShadow>
          <cylinderGeometry args={[0.022, 0.026, 0.05, 20]} />
        </mesh>
      </group>
      {/* Disinfectant jar with combs standing in it. */}
      <group position={[x + 0.13, top, z - 0.27]}>
        <Container position={[0, 0, 0]} profile={[[0, 0], [0.045, 0.002], [0.046, 0.2], [0.048, 0.205]]} body={m.glassClear} />
        <Container position={[0, 0, 0]} profile={[[0, 0.004], [0.043, 0.006], [0.043, 0.14], [0, 0.14]]} body={m.liquid} />
        {[-0.012, 0.012].map((dz, i) => (
          <group key={dz} position={[0, 0.17, dz]} rotation={[0, i * 0.6, 0.06]}>
            <group rotation-z={Math.PI / 2}>
              <Comb length={0.16} />
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}

/* ----------------------------------------------------------- Station */

function useStationGeometry() {
  const g = useMemo(
    () => ({
      mirror: new THREE.ShapeGeometry(archShape(0.84, 1.42), 48),
      // Polished glass edge (6 mm) and a slim steel frame behind it.
      mirrorEdge: new THREE.ExtrudeGeometry(archShape(0.846, 1.426), { depth: 0.006, bevelEnabled: false, curveSegments: 48 }),
      mirrorFrame: new THREE.ExtrudeGeometry(archShape(0.88, 1.46), { depth: 0.02, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 48 }),
      top: roundedBox(0.52, 0.035, 1.18, 0.006, 2),
      drawer: roundedBox(0.012, 0.18, 0.52, 0.003, 1),
      handle: roundedBox(0.012, 0.012, 0.16, 0.004, 2),
      standoff: new THREE.CylinderGeometry(0.011, 0.011, 0.03, 16),
    }),
    [],
  );
  useEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  return g;
}

type StationGeometry = ReturnType<typeof useStationGeometry>;

function Station({ z, hero, g, chair }: { z: number; hero?: boolean; g: StationGeometry; chair: ChairGeometry }) {
  const { m } = useKit();
  const x = layout.mirrorX;
  const front = x - 0.47; // counter front face
  return (
    <group>
      {/* Arched mirror: steel frame, polished edge, mirror face, four stand-off mounts. */}
      <group position={[x - 0.03, 0.98, z]} rotation-y={-Math.PI / 2}>
        <mesh position={[0, -0.02, -0.03]} geometry={g.mirrorFrame} material={m.steel} />
        <mesh position={[0, -0.003, -0.006]} geometry={g.mirrorEdge} material={m.glassEdge} />
        <mesh position={[0, 0, 0.001]} geometry={g.mirror} material={m.mirror} />
        {[
          [-0.36, 0.12],
          [0.36, 0.12],
          [-0.36, 1.0],
          [0.36, 1.0],
        ].map(([sx, sy]) => (
          <mesh key={`${sx}${sy}`} position={[sx, sy, 0.004]} rotation-x={Math.PI / 2} material={m.chrome} scale={[0.7, 0.15, 0.7]} geometry={g.standoff} />
        ))}
      </group>
      {/* A slim light line above the mirror. */}
      <mesh position={[x - 0.03, 2.58, z]} material={m.steel}>
        <boxGeometry args={[0.05, 0.035, 0.74]} />
      </mesh>
      <mesh position={[x - 0.056, 2.564, z]} material={m.glow}>
        <boxGeometry args={[0.004, 0.012, 0.7]} />
      </mesh>
      {/* Counter: walnut carcass, two drawers and a towel cubby with 3 mm gaps, steel pulls, a recessed plinth. */}
      <mesh position={[x - 0.24, 0.865, z]} geometry={g.top} material={m.walnut} castShadow receiveShadow />
      {/* Drawer block (left half) and an open towel cubby (right half): back, sides, shelf. */}
      <mesh position={[x - 0.23, 0.46, z - 0.28]} material={m.walnut} castShadow receiveShadow>
        <boxGeometry args={[0.46, 0.74, 0.56]} />
      </mesh>
      <mesh position={[x - 0.02, 0.46, z + 0.28]} material={m.lacquer}>
        <boxGeometry args={[0.04, 0.74, 0.56]} />
      </mesh>
      {[0.01, 0.55].map((dz) => (
        <mesh key={dz} position={[x - 0.23, 0.46, z + dz]} material={m.walnut} castShadow receiveShadow>
          <boxGeometry args={[0.46, 0.74, 0.02]} />
        </mesh>
      ))}
      {[0.1, 0.46, 0.82].map((y) => (
        <mesh key={y} position={[x - 0.23, y, z + 0.28]} material={m.walnut} receiveShadow>
          <boxGeometry args={[0.46, 0.02, 0.54]} />
        </mesh>
      ))}
      <mesh position={[x - 0.21, 0.045, z]} material={m.lacquer}>
        <boxGeometry args={[0.42, 0.09, 1.08]} />
      </mesh>
      {[0.73, 0.54].map((y) => (
        <group key={y}>
          <mesh position={[front + 0.006, y, z - 0.27]} geometry={g.drawer} material={m.walnut} castShadow />
          <mesh position={[front - 0.004, y + 0.04, z - 0.27]} geometry={g.handle} material={m.brushed} castShadow />
        </group>
      ))}
      {/* Rolled towels in the cubby, two rows. */}
      {[0.17, 0.53].map((y, row) =>
        [0.14, 0.28, 0.42].map((dz, i) => (
          <mesh key={`${y}${dz}`} position={[front + 0.24, y, z + dz]} rotation-z={Math.PI / 2} material={(i + row) % 3 === 1 ? m.towelOlive : m.towel} castShadow receiveShadow>
            <cylinderGeometry args={[0.062, 0.062, 0.4, 24]} />
          </mesh>
        )),
      )}

      {/* Products: jars and bottles with understated labels, towels, a neck-strip roll. */}
      <Container
        position={[x - 0.14, 0.883, z - 0.47]}
        profile={[[0, 0], [0.034, 0.002], [0.035, 0.055], [0.033, 0.06]]}
        body={m.product[2]}
        cap={m.brushed}
        label={m.label[0]}
        labelBand={[0.03, 0.035, 0.0352]}
      />
      <Container
        position={[x - 0.13, 0.883, z - 0.39]}
        profile={[[0, 0], [0.026, 0.002], [0.027, 0.13], [0.018, 0.155], [0.009, 0.165]]}
        body={m.amber}
        cap={m.plastic}
        label={m.label[2]}
        labelBand={[0.07, 0.06, 0.0272]}
      />
      <Container
        position={[x - 0.2, 0.883, z - 0.43]}
        profile={[[0, 0], [0.03, 0.002], [0.031, 0.17], [0.02, 0.19], [0.01, 0.2]]}
        body={m.product[1]}
        cap={m.plastic}
        label={m.label[1]}
        labelBand={[0.09, 0.08, 0.0312]}
      />
      {hero && (
        <>
          <ToolSet x={x - 0.24} z={z + 0.1} />
          <SprayBottle position={[x - 0.33, 0.883, z - 0.4]} />
          <Towel position={[x - 0.2, 0.9, z + 0.47]} material={m.towel} />
          <Towel position={[x - 0.2, 0.93, z + 0.47]} material={m.towel} rotation={0.05} />
          <Towel position={[x - 0.2, 0.96, z + 0.47]} material={m.towelOlive} rotation={-0.04} />
          <mesh position={[x - 0.4, 0.92, z + 0.47]} rotation-x={Math.PI / 2} material={m.paper} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.06, 28]} />
          </mesh>
        </>
      )}
      <BarberChair position={[layout.chair[0], 0, z]} rotation={hero ? 0 : z < -6 ? 0.25 : -0.3} g={chair} />
    </group>
  );
}

function Pendant({ x, z }: { x: number; z: number }) {
  const { quality, assets } = useKit();
  const lamp = useMemo(() => assets.models.lamp.clone(), [assets]);
  // The model hangs from y ≈ 1.17 to 0.22 (metres); hang it from the ceiling.
  return (
    <group position={[x, ROOM.h - 1.17, z]}>
      <primitive object={lamp} />
      <pointLight position={[0, 0.17, 0]} color="#ffb36b" intensity={quality === "high" ? 4.2 : 5} distance={7} decay={2} />
    </group>
  );
}

/** Vertical walnut slats on the back wall behind the shelves. */
function SlatWall() {
  const { m } = useKit();
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 34;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      o.position.set(-2.1 + i * 0.075, 1.45, ROOM.z1 + 0.03);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, m.walnutSlat, count]} castShadow receiveShadow>
      <boxGeometry args={[0.045, 2.5, 0.04]} />
    </instancedMesh>
  );
}

function Shelves() {
  const { m } = useKit();
  const items = useMemo(() => {
    const list: { x: number; y: number; r: number; h: number; mat: number }[] = [];
    const random = rng(41);
    for (const y of [1.25, 1.75]) {
      for (let x = -0.95; x < 0.95; x += 0.11 + random() * 0.08) {
        if (random() < 0.25) continue;
        list.push({ x, y, r: 0.025 + random() * 0.015, h: 0.1 + random() * 0.12, mat: Math.floor(random() * 4) });
      }
    }
    return list;
  }, []);
  return (
    <group position={[-0.8, 0, ROOM.z1 + 0.2]}>
      {[1.25, 1.75].map((y) => (
        <group key={y}>
          <mesh position={[0, y - 0.02, 0]} material={m.walnut} castShadow receiveShadow>
            <boxGeometry args={[2.2, 0.035, 0.24]} />
          </mesh>
          {[-1.0, 1.0].map((x) => (
            <mesh key={x} position={[x, y - 0.06, -0.06]} material={m.steel}>
              <boxGeometry args={[0.02, 0.05, 0.2]} />
            </mesh>
          ))}
        </group>
      ))}
      {items.map((it, i) => (
        <mesh key={i} position={[it.x, it.y + it.h / 2, 0]} material={m.product[it.mat]}>
          <cylinderGeometry args={[it.r, it.r, it.h, 16]} />
        </mesh>
      ))}
    </group>
  );
}

export function Interior() {
  const { m, assets } = useKit();
  const station = useStationGeometry();
  const chair = useChairGeometry();
  const depth = -ROOM.z1;
  const plant = useMemo(() => assets.models.pottedPlant?.clone() ?? null, [assets]);
  const succulent = useMemo(() => assets.models.succulent.clone(), [assets]);
  return (
    <group>
      {/* Shell: oak floor, plaster walls, a dark ceiling with a soffit over the stations. */}
      <mesh position={[0, 0.002, ROOM.z1 / 2 + 0.06]} rotation-x={-Math.PI / 2} material={m.floor} receiveShadow>
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
      <mesh position={[ROOM.x1 - 0.25, ROOM.h - 0.11, ROOM.z1 / 2]} material={m.plaster} castShadow>
        <boxGeometry args={[0.5, 0.22, depth]} />
      </mesh>
      <mesh position={[ROOM.x1 - 0.5, ROOM.h - 0.215, ROOM.z1 / 2]} material={m.glow}>
        <boxGeometry args={[0.01, 0.006, depth - 0.4]} />
      </mesh>
      {/* Recessed downlights along the aisle. */}
      {[-1.6, -3.8, -6.2, -8.2].map((z) => (
        <group key={z} position={[-0.6, ROOM.h - 0.002, z]}>
          <mesh rotation-x={Math.PI / 2} material={m.steel}>
            <ringGeometry args={[0.05, 0.065, 28]} />
          </mesh>
          <mesh rotation-x={Math.PI / 2} material={m.glow}>
            <circleGeometry args={[0.05, 28]} />
          </mesh>
        </group>
      ))}
      {/* Skirting on every wall, and a brushed threshold strip with a mat inside the door. */}
      {[ROOM.x0 + 0.008, ROOM.x1 - 0.008].map((x) => (
        <mesh key={x} position={[x, 0.045, ROOM.z1 / 2]} material={m.lacquer}>
          <boxGeometry args={[0.016, 0.09, depth]} />
        </mesh>
      ))}
      <mesh position={[0, 0.045, ROOM.z1 + 0.008]} material={m.lacquer}>
        <boxGeometry args={[6, 0.09, 0.016]} />
      </mesh>
      <mesh position={[0, 0.004, 0.03]} material={m.brushed} receiveShadow>
        <boxGeometry args={[1.3, 0.008, 0.12]} />
      </mesh>
      <mesh position={[0, 0.006, -0.55]} material={m.mat} receiveShadow>
        <boxGeometry args={[1.1, 0.012, 0.75]} />
      </mesh>

      {stationZ.map((z, i) => (
        <Station key={z} z={z} hero={i === 1} g={station} chair={chair} />
      ))}
      <Pendant x={1.25} z={stationZ[0]} />
      <Pendant x={1.25} z={stationZ[1]} />
      <Pendant x={1.25} z={stationZ[2]} />

      {/* Reception near the door: walnut desk with a plaster front and a succulent. */}
      <mesh position={[-2.25, 0.5, -1.55]} material={m.plaster} castShadow receiveShadow>
        <boxGeometry args={[0.6, 1.0, 1.5]} />
      </mesh>
      <mesh position={[-2.25, 1.02, -1.55]} geometry={station.top} scale={[1.2, 1, 1.32]} material={m.walnut} castShadow receiveShadow />
      <primitive object={succulent} position={[-2.2, 1.04, -1.1]} scale={1.1} />
      <ContactShadow position={[-2.25, 0.003, -1.55]} scale={[1.1, 2.0]} />

      {/* Waiting bench (walnut on steel legs, a leather cushion) and two framed prints. */}
      <mesh position={[-2.72, 0.42, -4.6]} material={m.walnut} castShadow receiveShadow>
        <boxGeometry args={[0.46, 0.05, 2.2]} />
      </mesh>
      <mesh position={[-2.74, 0.48, -4.6]} geometry={chair.seat} scale={[0.8, 0.6, 3.9]} material={m.leather} castShadow />
      {[-3.6, -5.6].map((z) => (
        <mesh key={z} position={[-2.72, 0.2, z]} material={m.steel} castShadow>
          <boxGeometry args={[0.4, 0.4, 0.03]} />
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

      <SlatWall />
      <Shelves />
      {plant ? (
        <primitive object={plant} position={[-2.45, 0, -8.35]} scale={1.6} />
      ) : (
        <>
          <mesh position={[-2.45, 0.28, -8.4]} material={m.concrete} castShadow>
            <cylinderGeometry args={[0.24, 0.2, 0.56, 32]} />
          </mesh>
          <Shrub position={[-2.45, 1.25, -8.4]} radius={[0.5, 0.75, 0.5]} count={260} seed={7} />
        </>
      )}
      <ContactShadow position={[-2.45, 0.003, -8.4]} scale={[0.9, 0.9]} />
    </group>
  );
}
