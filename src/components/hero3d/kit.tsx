"use client";

import { createContext, use } from "react";
import * as THREE from "three";
import {
  claddingTexture,
  contactShadowTexture,
  decalTexture,
  hairShellTexture,
  pavementTexture,
  plasterTexture,
  signTexture,
  skyTexture,
  terrazzoTexture,
  woodTexture,
} from "./textures";

/*
 * Everything the scene shares: materials, textures and the few custom
 * geometries, created once per mount and disposed together. Components read
 * it from context, so the scene tree stays declarative and nothing is rebuilt
 * on re-render.
 */

export type Quality = "high" | "low";

/** Material name the mirror probe looks for. */
export const MIRROR = "studio-mirror";

export interface SceneLabels {
  wordmark: { primary: string; secondary: string };
  signLine: string;
  windowLines: string[];
}

function standard(params: THREE.MeshStandardMaterialParameters) {
  return new THREE.MeshStandardMaterial(params);
}

/** A box with rounded vertical edges and bevelled faces, centred on the origin. */
export function roundedBox(width: number, height: number, depth: number, radius: number, segments = 4) {
  const r = Math.min(radius, width / 2, height / 2);
  const shape = new THREE.Shape();
  const w = width / 2 - r;
  const h = height / 2 - r;
  shape.moveTo(-w, -height / 2);
  shape.lineTo(w, -height / 2);
  shape.quadraticCurveTo(width / 2, -height / 2, width / 2, -h);
  shape.lineTo(width / 2, h);
  shape.quadraticCurveTo(width / 2, height / 2, w, height / 2);
  shape.lineTo(-w, height / 2);
  shape.quadraticCurveTo(-width / 2, height / 2, -width / 2, h);
  shape.lineTo(-width / 2, -h);
  shape.quadraticCurveTo(-width / 2, -height / 2, -w, -height / 2);
  const bevel = Math.min(r * 0.6, depth / 3);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: segments,
    curveSegments: segments * 2,
  });
  geometry.translate(0, 0, -(depth - bevel * 2) / 2);
  geometry.computeVertexNormals();
  return geometry;
}

/** An arch-topped panel (for the mirrors), facing +z. */
export function archShape(width: number, height: number) {
  const shape = new THREE.Shape();
  const r = width / 2;
  shape.moveTo(-r, 0);
  shape.lineTo(r, 0);
  shape.lineTo(r, height - r);
  shape.absarc(0, height - r, r, 0, Math.PI, false);
  shape.lineTo(-r, 0);
  return shape;
}

export function createKit(labels: SceneLabels, font: string, quality: Quality) {
  // The low tier (phones) draws the two large surfaces at half resolution: a quarter of the memory.
  const surface = quality === "high" ? 1024 : 512;
  const t = {
    pavement: pavementTexture(surface),
    terrazzo: terrazzoTexture(surface),
    plaster: plasterTexture(),
    plasterOlive: plasterTexture("#5d6142"),
    wood: woodTexture(),
    cladding: claddingTexture(),
    sign: signTexture(labels.wordmark.primary, labels.wordmark.secondary, labels.signLine, font),
    decal: decalTexture(labels.windowLines, font),
    blade: decalTexture([labels.wordmark.secondary || labels.wordmark.primary], font, "center"),
    hair: hairShellTexture(),
    shadow: contactShadowTexture(),
    sky: skyTexture(),
  };
  t.pavement.repeat.set(9, 9);
  t.terrazzo.repeat.set(3, 4.5);
  t.plaster.repeat.set(2, 1);
  t.plasterOlive.repeat.set(2, 1);
  t.cladding.repeat.set(10, 4);

  const m = {
    pavement: standard({ map: t.pavement, roughness: 0.88, metalness: 0 }),
    kerb: standard({ color: "#77746d", roughness: 0.9 }),
    road: standard({ color: "#1e1f20", roughness: 0.95 }),
    cladding: standard({ map: t.cladding, roughness: 0.55, metalness: 0.25 }),
    fascia: standard({ color: "#151617", roughness: 0.4, metalness: 0.4 }),
    steel: standard({ color: "#141516", roughness: 0.32, metalness: 0.85 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: "#b7c6c8",
      roughness: 0.04,
      metalness: 0,
      transparent: true,
      opacity: 0.14,
      envMapIntensity: 2.2,
      reflectivity: 0.6,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    sign: new THREE.MeshBasicMaterial({ map: t.sign, transparent: true, color: "#ffe3bf", toneMapped: false }),
    decal: new THREE.MeshBasicMaterial({ map: t.decal, transparent: true, opacity: 0.85, depthWrite: false }),
    blade: new THREE.MeshBasicMaterial({ map: t.blade, transparent: true, color: "#f4f4f1" }),
    glow: new THREE.MeshBasicMaterial({ color: "#ffd8a8", toneMapped: false }),
    glowSoft: new THREE.MeshBasicMaterial({ color: "#7d5f43" }),
    concrete: standard({ color: "#8b8780", roughness: 0.92 }),
    soil: standard({ color: "#1d1814", roughness: 1 }),
    leaf: standard({ color: "#3d4a2c", roughness: 0.7, side: THREE.DoubleSide }),
    leafLight: standard({ color: "#56633a", roughness: 0.7, side: THREE.DoubleSide }),
    terrazzo: standard({ map: t.terrazzo, roughness: 0.36, metalness: 0, envMapIntensity: 0.6 }),
    plaster: standard({ map: t.plaster, roughness: 0.95 }),
    plasterOlive: standard({ map: t.plasterOlive, roughness: 0.9 }),
    ceiling: standard({ color: "#1a1917", roughness: 0.9 }),
    wood: standard({ map: t.wood, roughness: 0.52 }),
    lacquer: standard({ color: "#1c1b19", roughness: 0.4, metalness: 0.1 }),
    mirror: standard({ name: MIRROR, color: "#c2cbcb", roughness: 0.04, metalness: 1, envMapIntensity: 1.1 }),
    chrome: standard({ color: "#d4d7d8", roughness: 0.16, metalness: 1 }),
    leather: standard({ color: "#1a1817", roughness: 0.46, metalness: 0 }),
    shade: standard({ color: "#121212", roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide }),
    product: [
      standard({ color: "#2f3326", roughness: 0.35 }),
      standard({ color: "#c9c1b2", roughness: 0.4 }),
      standard({ color: "#5c3b26", roughness: 0.25, metalness: 0.1 }),
      standard({ color: "#121212", roughness: 0.3 }),
    ],
    print: standard({ color: "#2b2a27", roughness: 0.8 }),
    // Sculptural figures: matte plaster, not an attempt at photoreal people.
    clay: standard({ color: "#c9bfb1", roughness: 0.78 }),
    clayShade: standard({ color: "#b3a898", roughness: 0.82 }),
    cloth: standard({ color: "#2e3127", roughness: 0.92 }),
    apron: standard({ color: "#171816", roughness: 0.8 }),
    cape: new THREE.MeshPhysicalMaterial({ color: "#121212", roughness: 0.38, sheen: 0.6, sheenColor: "#555", sheenRoughness: 0.4 }),
    shoe: standard({ color: "#0f0f0f", roughness: 0.4 }),
    scalp: standard({ vertexColors: true, roughness: 0.75 }),
    clipperBody: standard({ color: "#1b1c1d", roughness: 0.35, metalness: 0.2 }),
    sky: new THREE.MeshBasicMaterial({ map: t.sky, side: THREE.BackSide, fog: false, depthWrite: false }),
    shadow: new THREE.MeshBasicMaterial({ color: "#000", alphaMap: t.shadow, transparent: true, depthWrite: false, opacity: 0.7 }),
    hairFall: new THREE.PointsMaterial({ color: "#191512", size: 0.0028, sizeAttenuation: true }),
  };

  // Hair as stacked shells: each shell keeps fewer strands (higher alpha test), so the
  // surface reads as short, dense hair with real depth; per-vertex alpha thins it at the fade.
  const shellCount = quality === "high" ? 18 : 9;
  const hairShells = Array.from({ length: shellCount }, (_, i) => {
    const f = i / (shellCount - 1);
    return standard({
      color: new THREE.Color("#2a2119").lerp(new THREE.Color("#4a3a2c"), f * 0.6),
      alphaMap: t.hair,
      alphaTest: 0.32 + f * 0.6,
      vertexColors: true,
      roughness: 0.62,
      side: THREE.DoubleSide,
    });
  });

  return {
    t,
    m,
    hairShells,
    quality,
    dispose() {
      Object.values(t).forEach((tex) => tex.dispose());
      Object.values(m).forEach((mat) => (Array.isArray(mat) ? mat.forEach((x) => x.dispose()) : mat.dispose()));
      hairShells.forEach((mat) => mat.dispose());
    },
  };
}

export type Kit = ReturnType<typeof createKit>;

const KitContext = createContext<Kit | null>(null);
export const KitProvider = KitContext;

export function useKit(): Kit {
  const kit = use(KitContext);
  if (!kit) throw new Error("Hero scene kit missing");
  return kit;
}

/** A soft dark ellipse on the floor under an object: cheap, stable contact shadow. */
export function ContactShadow({
  position,
  scale,
  opacity = 0.7,
}: {
  position: [number, number, number];
  scale: [number, number];
  opacity?: number;
}) {
  const { m } = useKit();
  return (
    <mesh position={position} rotation-x={-Math.PI / 2} scale={[scale[0], scale[1], 1]} material={m.shadow} renderOrder={1}>
      <planeGeometry args={[1, 1]} />
      {opacity !== 0.7 && <meshBasicMaterial color="#000" alphaMap={m.shadow.alphaMap} transparent depthWrite={false} opacity={opacity} />}
    </mesh>
  );
}
