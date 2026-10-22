"use client";

import { Suspense, use, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { cameraKeys, createCameraPath, doorAngle, layout, portraitCameraKeys } from "@/lib/hero/journey";
import { createKit, KitProvider, MIRROR, type Quality, type SceneLabels } from "./kit";
import { worldAssets, type WorldAssets } from "./assets";
import { Storefront } from "./storefront";
import { Interior } from "./interior";
import { Figures } from "./figures";

/*
 * The hero's WebGL scene. Scroll progress arrives through a mutable ref that
 * GSAP updates; `Rig` reads it every frame and moves the camera and the door
 * directly, so scrolling never re-renders React.
 */

export interface Progress {
  current: number;
}

/** From here on the barber, clipper and falling hair move, so frames run continuously. */
const ANIMATED_FROM = 0.4;

const paths = { landscape: createCameraPath(cameraKeys), portrait: createCameraPath(portraitCameraKeys) };
/** Key frames are composed for 16:9; narrower screens widen the lens a little, not fully. */
const COMPOSED_ASPECT = 16 / 9;

function Rig({ progress, doorRef }: { progress: Progress; doorRef: React.RefObject<THREE.Group | null> }) {
  const last = useRef({ p: -1, aspect: 0 });

  useFrame((state) => {
    const camera = state.camera as THREE.PerspectiveCamera;
    const { size } = state;
    const p = progress.current;
    const aspect = size.width / Math.max(1, size.height);
    if (p === last.current.p && aspect === last.current.aspect) return;
    last.current = { p, aspect };
    const s = (aspect < 0.9 ? paths.portrait : paths.landscape).sample(p);
    camera.position.set(...s.position);
    camera.lookAt(...s.target);
    const widen = aspect < COMPOSED_ASPECT ? Math.pow(COMPOSED_ASPECT / aspect, 0.55) : 1;
    camera.fov = (2 * Math.atan(Math.tan((s.fov * Math.PI) / 360) * widen) * 180) / Math.PI;
    camera.updateProjectionMatrix();
    if (doorRef.current) doorRef.current.rotation.y = doorAngle(p);
  });
  return null;
}

/** Where the camera is inside: from here on, reflections come from the room, not the street. */
const INSIDE_FROM = 0.33;

/**
 * Reflections. Outside: the night-street HDRI (high tier) or a procedural
 * studio environment (low tier). Inside: the shop itself, captured once into
 * a cube map from the middle of the room and prefiltered, so chrome and glass
 * reflect this interior rather than the street. Swapped as the camera
 * crosses the threshold, both ways.
 */
function Environment({ assets, progress }: { assets: WorldAssets; progress: Progress }) {
  const get = useThree((s) => s.get);
  // Recreated with every mount (including an <Activity> coming back), so the room is captured again.
  const envs = useRef<{
    outside: THREE.WebGLRenderTarget;
    inside: THREE.WebGLRenderTarget | null;
    pmrem: THREE.PMREMGenerator;
    frames: number;
  } | null>(null);

  useEffect(() => {
    const { gl, scene } = get();
    const pmrem = new THREE.PMREMGenerator(gl);
    let outside: THREE.WebGLRenderTarget;
    let room: RoomEnvironment | null = null;
    if (assets.envHdr) {
      outside = pmrem.fromEquirectangular(assets.envHdr);
    } else {
      room = new RoomEnvironment();
      outside = pmrem.fromScene(room, 0.04);
    }
    envs.current = { outside, inside: null, pmrem, frames: 0 };
    scene.environment = outside.texture;
    scene.environmentIntensity = assets.envHdr ? 0.75 : 0.32;
    return () => {
      scene.environment = null;
      outside.dispose();
      envs.current?.inside?.dispose();
      room?.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      pmrem.dispose();
      envs.current = null;
    };
  }, [get, assets]);

  useFrame(() => {
    const e = envs.current;
    if (!e) return;
    const { gl, scene } = get();
    // Capture the room on frame 3, once lights, textures and the models are on the GPU.
    if (!e.inside && ++e.frames === 3) {
      const target = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
      const camera = new THREE.CubeCamera(0.05, 30, target);
      camera.position.set(0.6, 1.6, -4.6);
      const previous = scene.environment;
      scene.environment = e.outside.texture;
      camera.update(gl, scene);
      e.inside = e.pmrem.fromCubemap(target.texture);
      target.texture.dispose();
      target.dispose();
      scene.environment = previous;
    }
    const inside = progress.current >= INSIDE_FROM && e.inside;
    const want = inside ? e.inside!.texture : e.outside.texture;
    if (want && scene.environment !== want) {
      scene.environment = want;
      scene.environmentIntensity = inside ? 0.9 : assets.envHdr ? 0.75 : 0.32;
    }
  });
  return null;
}

function SpillLight({ x }: { x: number }) {
  const ref = useRef<THREE.SpotLight>(null);
  useEffect(() => {
    const light = ref.current;
    if (!light) return;
    light.target.position.set(x, 0, 2.6);
    light.target.updateMatrixWorld();
  }, [x]);
  return <spotLight ref={ref} position={[x, 2.6, -0.8]} color="#ffb877" intensity={9} distance={8} angle={0.75} penumbra={1} decay={2} />;
}

/**
 * Mirror reflections: the room rendered once into a small cube map from the
 * working station, so the mirrors show this shop without per-frame cost.
 */
function MirrorProbe() {
  const get = useThree((s) => s.get);
  // Per mount: a hidden <Activity> disposes the capture, and coming back captures again.
  const probe = useRef<{ frames: number; result: THREE.WebGLRenderTarget | null } | null>(null);
  useEffect(() => {
    probe.current = { frames: 0, result: null };
    return () => {
      const result = probe.current?.result;
      // Unhook the mirrors before freeing what they reflect.
      get().scene.traverse((o) => {
        if (o instanceof THREE.Mesh && (o.material as THREE.Material).name === MIRROR) {
          const material = o.material as THREE.MeshStandardMaterial;
          if (result && material.envMap === result.texture) {
            material.envMap = null;
            material.needsUpdate = true;
          }
        }
      });
      result?.dispose();
      probe.current = null;
    };
  }, [get]);
  useFrame(() => {
    const p = probe.current;
    // Frame 2: after lights and textures are uploaded. Mirrors are hidden for the capture.
    if (!p || p.frames > 2 || ++p.frames !== 2) return;
    const { gl, scene } = get();
    let mirror: THREE.MeshStandardMaterial | null = null;
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh && (o.material as THREE.Material).name === MIRROR) mirror = o.material as THREE.MeshStandardMaterial;
    });
    const material = mirror as THREE.MeshStandardMaterial | null;
    if (!material) return;
    const cube = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
    const camera = new THREE.CubeCamera(0.05, 20, cube);
    camera.position.set(layout.mirrorX - 0.6, 1.45, layout.head[2]);
    material.visible = false;
    camera.update(gl, scene);
    material.visible = true;
    // Prefilter it ourselves (rather than letting three convert the cube map on first use), so
    // this mount owns every target it creates and can free them all.
    const pmrem = new THREE.PMREMGenerator(gl);
    p.result = pmrem.fromCubemap(cube.texture);
    pmrem.dispose();
    cube.dispose();
    material.envMap = p.result.texture;
    material.envMapIntensity = 1;
    material.needsUpdate = true;
  });
  return null;
}

function Lights({ quality, progress }: { quality: Quality; progress: Progress }) {
  const high = quality === "high";
  const key = useRef<THREE.SpotLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const shadowFrames = useRef(0);
  useEffect(() => {
    // Light targets must be in the scene graph to update their matrices.
    if (key.current) key.current.target.position.set(layout.head[0], 0.8, layout.head[2]);
    if (sun.current) sun.current.target.position.set(0, 1, 0);
    key.current?.target.updateMatrixWorld();
    sun.current?.target.updateMatrixWorld();
  }, []);
  // Shadow maps cost a full extra render each. The street is static, so its map is drawn a few
  // times while assets settle and then kept; the chair's key light only redraws while the camera
  // is inside, where the barber moves. (Toggling autoUpdate, not castShadow, avoids recompiling.)
  useFrame(({ scene }) => {
    const s = scene.getObjectByName("studio-sun") as THREE.DirectionalLight | undefined;
    const k = scene.getObjectByName("studio-key") as THREE.SpotLight | undefined;
    if (!s || !k) return;
    const settling = shadowFrames.current++ < 6;
    s.shadow.autoUpdate = settling;
    k.shadow.autoUpdate = settling || progress.current >= 0.3;
  });
  return (
    <>
      {/* Exterior: blue-hour sky and a cool, low street-side light. */}
      <hemisphereLight args={["#5d6f86", "#2c241c", 0.4]} />
      <directionalLight
        ref={sun}
        name="studio-sun"
        position={[-6, 8, 11]}
        color="#a9bad0"
        intensity={0.9}
        castShadow={high}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-2}
        shadow-bias={-0.0005}
      />
      {/* Interior: warm low fill plus a key from the pendant over the working chair. */}
      <ambientLight color="#ffd9b0" intensity={0.12} />
      <spotLight
        ref={key}
        name="studio-key"
        position={[layout.head[0] - 0.35, 2.55, layout.head[2] + 0.25]}
        color="#ffc58c"
        intensity={high ? 22 : 18}
        distance={6}
        angle={0.62}
        penumbra={0.85}
        decay={2}
        castShadow={high}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      {/* Shop light spilling out through the windows onto the pavement. */}
      {[-1.65, 1.65].map((x) => (
        <SpillLight key={x} x={x} />
      ))}
      {/* A cool rim from the mirror side separates the head from the room in the close-up. */}
      {/* Placed low and behind the head so the mirror doesn't show it as a hard glint. */}
      <pointLight position={[layout.head[0] + 0.35, 1.05, layout.head[2] - 0.55]} color="#c9d6e0" intensity={high ? 0.8 : 0.55} distance={2} decay={2} />
    </>
  );
}

function World({ progress, labels, font, quality, onReady }: SceneProps) {
  const anisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  // Suspends until every model, texture and the HDRI are loaded; the poster stays up meanwhile.
  const assets = use(worldAssets(quality, Math.min(8, anisotropy)));
  const kit = useMemo(() => createKit(labels, font, quality, assets), [labels, font, quality, assets]);
  useEffect(() => () => kit.dispose(), [kit]);
  const doorRef = useRef<THREE.Group>(null);
  const frames = useRef(0);
  useFrame(({ invalidate }) => {
    // Report readiness after the first frames have actually been drawn.
    if (frames.current < 4 && ++frames.current === 4) onReady();
    // Outside, nothing moves unless the visitor scrolls; inside, keep the work going.
    if (frames.current < 4 || progress.current >= ANIMATED_FROM) invalidate();
  });
  return (
    <KitProvider value={kit}>
      <Environment assets={assets} progress={progress} />
      <Lights quality={quality} progress={progress} />
      <fog attach="fog" args={["#171b21", 18, 80]} />
      <Storefront doorRef={doorRef} />
      <Interior />
      <Figures />
      <MirrorProbe />
      <Rig progress={progress} doorRef={doorRef} />
    </KitProvider>
  );
}

interface SceneProps {
  progress: Progress;
  labels: SceneLabels;
  /** CSS font-family for the in-world signage. */
  font: string;
  quality: Quality;
  onReady: () => void;
}

export default function HeroScene({
  active,
  onContextLost,
  onFrameRequester,
  ...props
}: SceneProps & {
  active: boolean;
  onContextLost: () => void;
  /** Receives the function that requests a frame (on-demand rendering), for scroll updates. */
  onFrameRequester: (invalidate: () => void) => void;
}) {
  const high = props.quality === "high";
  return (
    <Canvas
      // On demand: a frame per scroll update, continuous only while something moves.
      // Rendering stops entirely while the hero is off screen; R3F also pauses with the tab.
      frameloop={active ? "demand" : "never"}
      dpr={high ? [1, 1.75] : [1, 1.25]}
      shadows={high ? "percentage" : false}
      gl={{ antialias: high, powerPreference: high ? "high-performance" : "low-power", alpha: false, stencil: false }}
      camera={{ fov: 36, near: 0.02, far: 140, position: [0.55, 1.62, 11.5] }}
      onCreated={({ gl, invalidate }) => {
        onFrameRequester(invalidate);
        // Development only: expose render statistics for profiling the beats.
        if (process.env.NODE_ENV !== "production") (window as Window & { __heroRenderer?: THREE.WebGLRenderer }).__heroRenderer = gl;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.setClearColor("#1a1f25");
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          onContextLost();
        });
      }}
      aria-hidden
      tabIndex={-1}
    >
      <Suspense fallback={null}>
        <World {...props} />
      </Suspense>
    </Canvas>
  );
}
