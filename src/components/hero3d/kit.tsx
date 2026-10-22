"use client";

import { createContext, use } from "react";
import * as THREE from "three";
import { disposePbr, pbrMaterial, type WorldAssets } from "./assets";
import { contactShadowTexture, decalTexture, fabricNormalTexture, labelTexture, signTexture } from "./textures";

/*
 * Everything the scene shares: materials and the few drawn textures, created
 * once per mount from the downloaded assets and disposed together.
 * Components read it from context, so the scene tree stays declarative and
 * nothing is rebuilt on re-render.
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

function physical(params: THREE.MeshPhysicalMaterialParameters) {
  return new THREE.MeshPhysicalMaterial(params);
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

/**
 * An upholstered cushion: a subdivided box pushed out towards a superellipsoid,
 * so the faces dome slightly and every edge rolls over like stuffed leather.
 */
export function cushion(width: number, height: number, depth: number, puff = 0.35, segments = 18) {
  const g = new THREE.BoxGeometry(width, height, depth, segments, Math.max(4, Math.round(segments * (height / width))), segments);
  const p = g.getAttribute("position");
  const v = new THREE.Vector3();
  const e = 6; // superellipse exponent: lower is rounder
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const nx = v.x / (width / 2);
    const ny = v.y / (height / 2);
    const nz = v.z / (depth / 2);
    const r = Math.pow(Math.pow(Math.abs(nx), e) + Math.pow(Math.abs(ny), e) + Math.pow(Math.abs(nz), e), 1 / e);
    const k = 1 / Math.max(r, 1e-6);
    // Blend between the box and its superellipsoid, then dome the large faces.
    const bx = THREE.MathUtils.lerp(nx, nx * k, puff);
    const by = THREE.MathUtils.lerp(ny, ny * k, puff);
    const bz = THREE.MathUtils.lerp(nz, nz * k, puff);
    const dome = (1 - nx * nx) * (1 - nz * nz) * 0.18 * puff;
    p.setXYZ(i, (bx * width) / 2, (by * height) / 2 + Math.sign(ny) * dome * height, (bz * depth) / 2);
  }
  g.computeVertexNormals();
  return g;
}

/** An arch-topped outline (for the mirrors), in the xy plane. */
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

export function createKit(labels: SceneLabels, font: string, quality: Quality, assets: WorldAssets) {
  const fabric = fabricNormalTexture();
  const fabricFine = fabric.clone();
  fabricFine.repeat.set(14, 14);
  fabric.repeat.set(5, 5);
  const t = {
    sign: signTexture(labels.wordmark.primary, labels.wordmark.secondary, labels.signLine, font),
    signHalo: signTexture(labels.wordmark.primary, labels.wordmark.secondary, labels.signLine, font, 28),
    decal: decalTexture(labels.windowLines, font),
    blade: decalTexture([labels.wordmark.secondary || labels.wordmark.primary], font, "center"),
    labels: [
      labelTexture(labels.wordmark.primary, "Pomade", "#202019", "#d9d3c6", font),
      labelTexture(labels.wordmark.primary, "Tonic", "#e8e2d6", "#2a2b22", font),
      labelTexture(labels.wordmark.primary, "Beard oil", "#3a3e2a", "#e6e2d4", font),
    ],
    shadow: contactShadowTexture(),
    fabric,
    fabricFine,
  };
  const { pbr } = assets;

  const m = {
    pavement: pbrMaterial(pbr.pavement, [5, 3.5], { color: "#77746f", envMapIntensity: 0.45 }),
    road: pbrMaterial(pbr.asphalt, [10, 4], { color: "#8d8d8d" }),
    render: pbrMaterial(pbr.render, [3, 3], { color: "#a7a39b" }),
    renderDark: pbrMaterial(pbr.render, [3, 3], { color: "#55524d" }),
    floor: pbrMaterial(pbr["oak-floor"], [2.2, 3.3], { color: "#c9b59a", envMapIntensity: 0.6 }),
    plaster: pbrMaterial(pbr.plaster, [3, 1.6], { color: "#c4b9a7" }),
    plasterOlive: pbrMaterial(pbr.plaster, [2, 1.2], { color: "#7f8460" }),
    walnut: pbrMaterial(pbr.walnut, [1, 1], { color: "#d7c4ad" }),
    walnutSlat: pbrMaterial(pbr.walnut, [0.25, 2], { color: "#b8a189" }),
    leather: pbrMaterial(pbr.leather, [2.5, 2.5], { color: "#5a4a40", metalness: 0, envMapIntensity: 0.7 }),
    leatherCap: pbrMaterial(pbr.leather, [1, 1], { color: "#5a4a40", metalness: 0, envMapIntensity: 0.7 }),
    // Metals: polished chrome, satin (anisotropic) brushed steel, black anodised profiles.
    chrome: physical({ color: "#e3e6e8", roughness: 0.1, metalness: 1 }),
    brushed: physical({ color: "#c6c9cb", roughness: 0.32, metalness: 1, anisotropy: 0.7 }),
    steel: standard({ color: "#18191a", roughness: 0.38, metalness: 0.8 }),
    steelEdge: standard({ color: "#2a2c2e", roughness: 0.28, metalness: 0.9 }),
    fascia: standard({ color: "#141516", roughness: 0.45, metalness: 0.35 }),
    rubber: standard({ color: "#101010", roughness: 0.92, metalness: 0 }),
    plastic: physical({ color: "#1a1b1c", roughness: 0.42, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.4 }),
    plasticGrip: standard({ color: "#111212", roughness: 0.85, metalness: 0 }),
    plasticLight: physical({ color: "#cfcac0", roughness: 0.45, clearcoat: 0.3 }),
    glass: physical({
      color: "#c6d1d1",
      roughness: 0.02,
      metalness: 0,
      transparent: true,
      opacity: 0.08,
      envMapIntensity: 1.1,
      reflectivity: 0.55,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    /** The green-tinted edge of float glass, visible where the camera sees a pane edge-on. */
    glassEdge: standard({ color: "#6f8f88", roughness: 0.05, transparent: true, opacity: 0.55, depthWrite: false }),
    glassClear: physical({ color: "#e9efef", roughness: 0.05, transparent: true, opacity: 0.25, depthWrite: false }),
    liquid: physical({ color: "#9fb7b2", roughness: 0.05, transparent: true, opacity: 0.45, depthWrite: false }),
    amber: physical({ color: "#5a2e12", roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0.92 }),
    mirror: standard({ name: MIRROR, color: "#c5cccc", roughness: 0.035, metalness: 1, envMapIntensity: 1.1 }),
    sign: new THREE.MeshBasicMaterial({ map: t.sign, transparent: true, color: "#ffe6c6", toneMapped: false }),
    signHalo: new THREE.MeshBasicMaterial({ map: t.signHalo, transparent: true, color: "#c98f4f", opacity: 0.55, depthWrite: false }),
    decal: new THREE.MeshBasicMaterial({ map: t.decal, transparent: true, opacity: 0.85, depthWrite: false }),
    blade: new THREE.MeshBasicMaterial({ map: t.blade, transparent: true, color: "#f4f4f1" }),
    glow: new THREE.MeshBasicMaterial({ color: "#ffd8a8", toneMapped: false }),
    glowSoft: new THREE.MeshBasicMaterial({ color: "#7d5f43" }),
    windowWarm: new THREE.MeshBasicMaterial({ color: "#6e5136" }),
    windowDark: standard({ color: "#0d0f11", roughness: 0.15, metalness: 0.5 }),
    concrete: standard({ color: "#8d8a83", roughness: 0.9, normalMap: t.fabric, normalScale: new THREE.Vector2(0.15, 0.15) }),
    granite: standard({ color: "#2b2b2b", roughness: 0.55 }),
    soil: standard({ color: "#1d1814", roughness: 1 }),
    leaf: standard({ color: "#3d4a2c", roughness: 0.7, side: THREE.DoubleSide }),
    leafLight: standard({ color: "#56633a", roughness: 0.7, side: THREE.DoubleSide }),
    ceiling: standard({ color: "#22201d", roughness: 0.92 }),
    lacquer: standard({ color: "#1d1c1a", roughness: 0.42, metalness: 0.05 }),
    shade: standard({ color: "#121212", roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide }),
    product: [
      standard({ color: "#2f3326", roughness: 0.35 }),
      standard({ color: "#d6cfc2", roughness: 0.4 }),
      standard({ color: "#121212", roughness: 0.3 }),
      standard({ color: "#6a6e4f", roughness: 0.45 }),
    ],
    label: t.labels.map((map) => standard({ map, roughness: 0.6 })),
    print: standard({ color: "#2b2a27", roughness: 0.8 }),
    mat: standard({ color: "#151615", roughness: 0.95, normalMap: t.fabricFine, normalScale: new THREE.Vector2(0.3, 0.3) }),
    towel: standard({ color: "#e9e5dc", roughness: 1, normalMap: t.fabric, normalScale: new THREE.Vector2(0.9, 0.9) }),
    towelOlive: standard({ color: "#6a6f4c", roughness: 1, normalMap: t.fabric, normalScale: new THREE.Vector2(0.9, 0.9) }),
    paper: standard({ color: "#f2f0ea", roughness: 0.85 }),
    bristle: standard({ color: "#2a211a", roughness: 0.9 }),
    // People: the customer's head is a CC BY 3.0 scan; the barber reuses it with a different tone.
    skin: physical({ map: assets.head.color, normalMap: assets.head.normal, roughness: 0.52, sheen: 0.25, sheenColor: "#ffd9c4", sheenRoughness: 0.6 }),
    skinBarber: physical({ map: assets.head.color, normalMap: assets.head.normal, color: "#b48c72", roughness: 0.55, sheen: 0.25, sheenColor: "#ffd9c4", sheenRoughness: 0.6 }),
    skinPlain: physical({ color: "#c79f86", roughness: 0.55, sheen: 0.3, sheenColor: "#ffd9c4", sheenRoughness: 0.6 }),
    skinPlainBarber: physical({ color: "#a07a61", roughness: 0.55, sheen: 0.3, sheenColor: "#ffd9c4", sheenRoughness: 0.6 }),
    shirt: standard({ color: "#34372d", roughness: 0.95, normalMap: t.fabricFine, normalScale: new THREE.Vector2(0.5, 0.5) }),
    trousers: standard({ color: "#1f2022", roughness: 0.92, normalMap: t.fabricFine, normalScale: new THREE.Vector2(0.4, 0.4) }),
    apron: standard({ color: "#1d1c1a", roughness: 0.8, normalMap: t.fabric, normalScale: new THREE.Vector2(0.35, 0.35) }),
    cape: physical({
      color: "#171717",
      roughness: 0.5,
      sheen: 0.7,
      sheenColor: "#6a6a6a",
      sheenRoughness: 0.45,
      normalMap: t.fabricFine,
      normalScale: new THREE.Vector2(0.25, 0.25),
    }),
    shoe: standard({ color: "#0f0f0f", roughness: 0.35, metalness: 0.05 }),
    stubble: standard({ color: "#3a2f26", roughness: 0.8, transparent: true, depthWrite: false, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2 }),
    hair: standard({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide }),
    shadow: new THREE.MeshBasicMaterial({ color: "#000", alphaMap: t.shadow, transparent: true, depthWrite: false, opacity: 0.7 }),
    hairFall: new THREE.PointsMaterial({ color: "#191512", size: 0.0022, sizeAttenuation: true }),
  };

  return {
    t,
    m,
    assets,
    quality,
    dispose() {
      [t.sign, t.signHalo, t.decal, t.blade, t.shadow, t.fabric, t.fabricFine, ...t.labels].forEach((tex) => tex.dispose());
      Object.values(m).forEach((mat) => {
        const list = Array.isArray(mat) ? mat : [mat];
        list.forEach((x) => {
          // PBR materials own cloned textures; the rest share kit textures disposed above.
          if (x instanceof THREE.MeshStandardMaterial && x.aoMap) disposePbr(x);
          else x.dispose();
        });
      });
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
