import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { Quality } from "./kit";

/*
 * Downloaded assets for the hero scene: CC0 Poly Haven textures, models and
 * an HDRI, plus the CC BY 3.0 head scan (sources, licences and processing in
 * docs/MEDIA.md). Files live in public/hero3d and are fetched only when the
 * 3D scene starts. The low tier loads 512 px textures and skips the HDRI and
 * the heavy potted plant.
 */

const BASE = "/hero3d";

/** PBR sets: colour (sRGB), OpenGL normal, and ARM (R: occlusion, G: roughness, B: metalness). */
export type PbrSet = "pavement" | "asphalt" | "oak-floor" | "plaster" | "walnut" | "leather" | "render";
const pbrSets: PbrSet[] = ["pavement", "asphalt", "oak-floor", "plaster", "walnut", "leather", "render"];
/** Seen only at a distance (or only for roughness): 512 px on every tier. */
const smallOnly = new Set<PbrSet>(["asphalt", "render"]);

export interface PbrMaps {
  color: THREE.Texture;
  normal: THREE.Texture;
  arm: THREE.Texture;
}

export interface WorldAssets {
  pbr: Record<PbrSet, PbrMaps>;
  head: { color: THREE.Texture; normal: THREE.Texture; geometry: THREE.BufferGeometry };
  models: {
    lamp: THREE.Object3D;
    succulent: THREE.Object3D;
    /** The planters' plants and the potted plant: null on the low tier (procedural shrubs instead). */
    anthurium: THREE.Object3D | null;
    pottedPlant: THREE.Object3D | null;
  };
  /** Equirectangular HDR for exterior reflections; null on the low tier. */
  envHdr: THREE.DataTexture | null;
  /** Tonemapped night street panorama for the distant background. */
  backdrop: THREE.Texture;
  dispose(): void;
}

function textureUrl(set: string, map: string, size: number) {
  return `${BASE}/textures/${set}-${map}-${size}.webp`;
}

async function loadWorld(quality: Quality, anisotropy: number): Promise<WorldAssets> {
  const textures = new THREE.TextureLoader();
  const gltf = new GLTFLoader();
  gltf.setMeshoptDecoder(MeshoptDecoder);
  const owned: { dispose(): void }[] = [];

  const tex = async (url: string, color: boolean) => {
    const t = await textures.loadAsync(url);
    t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = anisotropy;
    owned.push(t);
    return t;
  };
  const model = async (name: string) => {
    const g: GLTF = await gltf.loadAsync(`${BASE}/models/${name}.glb`);
    g.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        owned.push(o.geometry);
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((mat: THREE.MeshStandardMaterial) => {
          owned.push(mat);
          [mat.map, mat.normalMap, mat.roughnessMap, mat.metalnessMap, mat.aoMap].forEach((t) => t && owned.push(t));
        });
      }
    });
    return g;
  };

  const high = quality === "high";
  const size = (set: PbrSet) => (high && !smallOnly.has(set) ? 1024 : 512);
  const pbrPromise = Promise.all(
    pbrSets.map(async (set) => {
      const [color, normal, arm] = await Promise.all([
        tex(textureUrl(set, "color", size(set)), true),
        tex(textureUrl(set, "normal", size(set)), false),
        // ARM maps are noisy and compress badly; 512 px is enough for roughness everywhere.
        tex(textureUrl(set, "arm", 512), false),
      ]);
      return [set, { color, normal, arm }] as const;
    }),
  );
  const headSize = high ? 1024 : 512;
  const [pbrEntries, headColor, headNormal, headModel, lamp, succulent, anthurium, potted, envHdr, backdrop] = await Promise.all([
    pbrPromise,
    tex(textureUrl("head", "color", headSize), true),
    tex(textureUrl("head", "normal", headSize), false),
    model("head-scan"),
    model("ceiling-lamp"),
    model("succulent"),
    high ? model("anthurium") : Promise.resolve(null),
    high ? model("potted-plant") : Promise.resolve(null),
    high
      ? new HDRLoader().loadAsync(`${BASE}/env/street-night-1k.hdr`).then((t) => {
          t.mapping = THREE.EquirectangularReflectionMapping;
          owned.push(t);
          return t;
        })
      : Promise.resolve(null),
    tex(`${BASE}/env/street-night-backdrop.webp`, true),
  ]);
  backdrop.wrapS = backdrop.wrapT = THREE.ClampToEdgeWrapping;

  let headGeometry: THREE.BufferGeometry | null = null;
  headModel.scene.updateMatrixWorld(true);
  headModel.scene.traverse((o) => {
    if (!headGeometry && o instanceof THREE.Mesh) headGeometry = bakedFloatGeometry(o);
  });
  if (!headGeometry) throw new Error("head scan has no mesh");
  owned.push(headGeometry);

  return {
    pbr: Object.fromEntries(pbrEntries) as Record<PbrSet, PbrMaps>,
    head: { color: headColor, normal: headNormal, geometry: headGeometry },
    models: { lamp: lamp.scene, succulent: succulent.scene, anthurium: anthurium?.scene ?? null, pottedPlant: potted?.scene ?? null },
    envHdr,
    backdrop,
    dispose() {
      owned.forEach((o) => o.dispose());
    },
  };
}

/**
 * A mesh's geometry in plain float attributes with its node transform baked
 * in. Optimised GLBs store quantised (integer) positions and normals and move
 * the scale into the node, so the raw attributes alone are the wrong size.
 */
function bakedFloatGeometry(mesh: THREE.Mesh): THREE.BufferGeometry {
  const source = mesh.geometry as THREE.BufferGeometry;
  const out = new THREE.BufferGeometry();
  for (const name of ["position", "normal", "uv"]) {
    const attr = source.getAttribute(name);
    if (!attr) continue;
    const floats = new Float32Array(attr.count * attr.itemSize);
    for (let i = 0; i < attr.count; i++) for (let c = 0; c < attr.itemSize; c++) floats[i * attr.itemSize + c] = attr.getComponent(i, c);
    out.setAttribute(name, new THREE.BufferAttribute(floats, attr.itemSize));
  }
  if (source.index) out.setIndex(source.index.clone());
  out.applyMatrix4(mesh.matrixWorld);
  return out;
}

/*
 * One load per quality tier for the lifetime of the page. React's `use()`
 * needs a stable promise across renders. The assets are deliberately not
 * disposed when the scene hides: Next keeps the home page alive in a hidden
 * <Activity> whose effects clean up without re-rendering, so freeing here
 * would leave the returning scene on disposed objects. GPU memory goes with
 * the renderer when the canvas itself unmounts, and coming back to the page
 * reuses the downloads instantly.
 */
const cache = new Map<Quality, Promise<WorldAssets>>();

export function worldAssets(quality: Quality, anisotropy: number): Promise<WorldAssets> {
  let promise = cache.get(quality);
  if (!promise) {
    promise = loadWorld(quality, anisotropy);
    // A failed load (offline, blocked) may be retried by the next mount.
    promise.catch(() => cache.delete(quality));
    cache.set(quality, promise);
  }
  return promise;
}

/** A PBR material from a set, with its maps repeated `repeat` times (cloned, so each surface has its own scale). */
export function pbrMaterial(
  maps: PbrMaps,
  repeat: [number, number],
  params: THREE.MeshStandardMaterialParameters = {},
): THREE.MeshStandardMaterial {
  const clone = (t: THREE.Texture) => {
    const c = t.clone();
    c.repeat.set(...repeat);
    c.needsUpdate = true;
    return c;
  };
  const arm = clone(maps.arm);
  return new THREE.MeshStandardMaterial({
    map: clone(maps.color),
    normalMap: clone(maps.normal),
    roughnessMap: arm,
    metalnessMap: arm,
    aoMap: arm,
    aoMapIntensity: 0.8,
    metalness: 1,
    roughness: 1,
    ...params,
  });
}

/** Dispose a material made by `pbrMaterial` together with its cloned textures. */
export function disposePbr(material: THREE.MeshStandardMaterial) {
  new Set([material.map, material.normalMap, material.roughnessMap, material.metalnessMap, material.aoMap]).forEach((t) => t?.dispose());
  material.dispose();
}
