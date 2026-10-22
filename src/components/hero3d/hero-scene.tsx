"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { cameraKeys, createCameraPath, doorAngle, layout, portraitCameraKeys } from "@/lib/hero/journey";
import { createKit, KitProvider, MIRROR, type Quality, type SceneLabels } from "./kit";
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

/** Reflections from a procedural studio environment: no HDR download, cheap to prefilter once. */
function Environment() {
  const get = useThree((s) => s.get);
  useEffect(() => {
    const { gl, scene } = get();
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.32;
    return () => {
      scene.environment = null;
      env.dispose();
      room.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      pmrem.dispose();
    };
  }, [get]);
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
  const done = useRef(0);
  const probe = useMemo(() => {
    const target = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
    const camera = new THREE.CubeCamera(0.05, 20, target);
    camera.position.set(layout.mirrorX - 0.6, 1.45, layout.head[2]);
    return { target, camera };
  }, []);
  useEffect(() => () => probe.target.dispose(), [probe]);
  useFrame(() => {
    // Frame 2: after lights and textures are uploaded. Mirrors are hidden for the capture.
    if (done.current > 2) return;
    if (++done.current !== 2) return;
    const { gl, scene } = get();
    let mirror: THREE.MeshStandardMaterial | null = null;
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh && (o.material as THREE.Material).name === MIRROR) mirror = o.material as THREE.MeshStandardMaterial;
    });
    const material = mirror as THREE.MeshStandardMaterial | null;
    if (!material) return;
    material.visible = false;
    probe.camera.update(gl, scene);
    material.visible = true;
    material.envMap = probe.target.texture;
    material.envMapIntensity = 1;
    material.needsUpdate = true;
  });
  return null;
}

function Lights({ quality }: { quality: Quality }) {
  const high = quality === "high";
  const key = useRef<THREE.SpotLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    // Light targets must be in the scene graph to update their matrices.
    if (key.current) key.current.target.position.set(layout.head[0], 0.8, layout.head[2]);
    if (sun.current) sun.current.target.position.set(0, 1, 0);
    key.current?.target.updateMatrixWorld();
    sun.current?.target.updateMatrixWorld();
  }, []);
  return (
    <>
      {/* Exterior: blue-hour sky and a cool, low street-side light. */}
      <hemisphereLight args={["#5d6f86", "#2c241c", 0.5]} />
      <directionalLight
        ref={sun}
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
  const kit = useMemo(() => createKit(labels, font, quality), [labels, font, quality]);
  useEffect(() => () => kit.dispose(), [kit]);
  const doorRef = useRef<THREE.Group>(null);
  const frames = useRef(0);
  useFrame(({ invalidate }) => {
    // Report readiness after the first frames have actually been drawn.
    if (frames.current < 3 && ++frames.current === 3) onReady();
    // Outside, nothing moves unless the visitor scrolls; inside, keep the work going.
    if (frames.current < 3 || progress.current >= ANIMATED_FROM) invalidate();
  });
  return (
    <KitProvider value={kit}>
      <Environment />
      <Lights quality={quality} />
      <fog attach="fog" args={["#1a1f25", 14, 46]} />
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
      camera={{ fov: 36, near: 0.03, far: 80, position: [0.55, 1.62, 11.5] }}
      onCreated={({ gl, invalidate }) => {
        onFrameRequester(invalidate);
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
      <World {...props} />
    </Canvas>
  );
}
