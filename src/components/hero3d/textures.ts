import * as THREE from "three";

/*
 * Textures the scene draws itself on 2D canvases: lettering (the studio's own
 * name and dictionary strings), product labels, contact shadows and a cloth
 * weave normal map. Surfaces such as paving, timber, plaster and leather use
 * downloaded PBR sets instead (see assets.ts). Seeded randomness keeps every
 * visit, and the poster render, identical.
 */

/** Small seeded PRNG (mulberry32). */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(width: number, height = width) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return [c, c.getContext("2d")!] as const;
}

function finish(c: HTMLCanvasElement, { color = true, clamp = false, anisotropy = 8 } = {}) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.anisotropy = anisotropy;
  return tex;
}

/**
 * Fascia lettering: the studio name and a spaced line under it. With `blur`,
 * the same artwork softened, used behind the letters as their halo on the
 * fascia (halo-lit letters).
 */
export function signTexture(primary: string, secondary: string, line: string, font: string, blur = 0) {
  const [c, ctx] = canvas(2048, 384);
  ctx.clearRect(0, 0, 2048, 384);
  ctx.fillStyle = "#fff3df";
  ctx.textBaseline = "middle";
  if (blur) ctx.filter = `blur(${blur}px)`;
  ctx.font = `600 170px ${font}`;
  const main = secondary ? `${primary} / ${secondary}` : primary;
  const w = ctx.measureText(main).width;
  ctx.fillText(main, (2048 - w) / 2, 150);
  ctx.font = `500 64px ${font}`;
  const sub = line.toUpperCase().split("").join(" ");
  const sw = ctx.measureText(sub).width;
  ctx.globalAlpha = 0.8;
  ctx.fillText(sub, (2048 - sw) / 2, 300);
  return finish(c, { clamp: true });
}

/** White vinyl lettering on the glass. */
export function decalTexture(lines: string[], font: string, align: "left" | "center" = "left") {
  const [c, ctx] = canvas(1024, 512);
  ctx.clearRect(0, 0, 1024, 512);
  ctx.fillStyle = "rgba(244,244,241,0.92)";
  ctx.textBaseline = "top";
  lines.forEach((text, i) => {
    ctx.font = i === 0 ? `600 76px ${font}` : `500 40px ${font}`;
    const w = ctx.measureText(text).width;
    ctx.fillText(text, align === "center" ? (1024 - w) / 2 : 40, 40 + (i === 0 ? 0 : 110 + (i - 1) * 60));
  });
  return finish(c, { clamp: true });
}

/** An understated product label wrapped round a jar or bottle (u runs round the body). */
export function labelTexture(brand: string, product: string, ground: string, ink: string, font: string) {
  const [c, ctx] = canvas(512, 256);
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = ink;
  ctx.textBaseline = "middle";
  // A lathe's u = 0.25 faces +x; the front of each label is set there.
  ctx.font = `600 34px ${font}`;
  const bw = ctx.measureText(brand).width;
  ctx.fillText(brand, 128 - bw / 2, 104);
  ctx.font = `500 26px ${font}`;
  const pw = ctx.measureText(product).width;
  ctx.globalAlpha = 0.75;
  ctx.fillText(product, 128 - pw / 2, 150);
  ctx.globalAlpha = 0.35;
  ctx.fillRect(128 - 40, 180, 80, 2);
  return finish(c);
}

/** Radial falloff used as cheap contact shadows under objects. */
export function contactShadowTexture() {
  const [c, ctx] = canvas(256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(0,0,0,0.85)");
  g.addColorStop(0.45, "rgba(0,0,0,0.45)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return finish(c, { clamp: true });
}

/**
 * A plain-weave cloth normal map: over-under warp and weft threads with a
 * little irregularity, converted from a height field to tangent-space normals.
 */
export function fabricNormalTexture() {
  const size = 256;
  const threads = 32;
  const random = rng(97);
  const height = new Float32Array(size * size);
  const jitter = Array.from({ length: threads }, () => 0.85 + random() * 0.3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * threads;
      const v = (y / size) * threads;
      const iu = Math.floor(u);
      const iv = Math.floor(v);
      const over = (iu + iv) % 2 === 0;
      const warp = Math.sin((u - iu) * Math.PI) * jitter[iv % threads];
      const weft = Math.sin((v - iv) * Math.PI) * jitter[iu % threads];
      height[y * size + x] = over ? 0.6 * warp + 0.2 * weft : 0.6 * weft + 0.2 * warp;
    }
  }
  const [c, ctx] = canvas(size);
  const img = ctx.createImageData(size, size);
  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];
  const n = new THREE.Vector3();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      n.set(-(at(x + 1, y) - at(x - 1, y)) * 1.6, -(at(x, y + 1) - at(x, y - 1)) * 1.6, 1).normalize();
      const i = (y * size + x) * 4;
      img.data[i] = (n.x * 0.5 + 0.5) * 255;
      img.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      img.data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, { color: false, anisotropy: 4 });
}
