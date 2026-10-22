import * as THREE from "three";

/*
 * Procedural textures for the hero scene, drawn once on 2D canvases. Seeded
 * randomness keeps every visit (and the poster render) identical; nothing is
 * downloaded, so there is no third-party asset or licence behind them.
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

function canvas(size: number, height = size) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = height;
  return [c, c.getContext("2d")!] as const;
}

function finish(c: HTMLCanvasElement, { color = true, repeat = [1, 1] as [number, number], anisotropy = 4 } = {}) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(...repeat);
  tex.anisotropy = anisotropy;
  return tex;
}

/** Fine noise over a base colour; `amount` is the luminance swing. */
function grain(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, random: () => number, size = 1) {
  const img = ctx.getImageData(0, 0, w, h);
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      const n = (random() - 0.5) * amount;
      for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) {
          const i = ((y + dy) * w + (x + dx)) * 4;
          img.data[i] += n;
          img.data[i + 1] += n;
          img.data[i + 2] += n;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Soft blotches for plaster and concrete. */
function mottle(ctx: CanvasRenderingContext2D, w: number, h: number, random: () => number, count: number, alpha: number, light = false) {
  for (let i = 0; i < count; i++) {
    const x = random() * w;
    const y = random() * h;
    const r = 20 + random() * w * 0.18;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const tone = light ? "255,255,255" : "0,0,0";
    g.addColorStop(0, `rgba(${tone},${alpha * random()})`);
    g.addColorStop(1, `rgba(${tone},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/** 60 cm concrete paving slabs; one texture repeat covers 2.4 m. */
export function pavementTexture(size = 1024) {
  const random = rng(11);
  const [c, ctx] = canvas(size);
  ctx.fillStyle = "#5b5a56";
  ctx.fillRect(0, 0, size, size);
  mottle(ctx, size, size, random, 60, 0.12);
  mottle(ctx, size, size, random, 40, 0.06, true);
  grain(ctx, size, size, 26, random, 2);
  const slab = size / 4;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      // Each slab sits at a slightly different tone.
      ctx.fillStyle = `rgba(${random() > 0.5 ? "255,255,255" : "0,0,0"},${random() * 0.05})`;
      ctx.fillRect(i * slab, j * slab, slab, slab);
    }
  }
  ctx.strokeStyle = "rgba(20,20,18,0.75)";
  ctx.lineWidth = Math.max(2, size / 340);
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(i * slab, 0);
    ctx.lineTo(i * slab, size);
    ctx.moveTo(0, i * slab);
    ctx.lineTo(size, i * slab);
    ctx.stroke();
  }
  return finish(c);
}

/** Warm grey terrazzo with stone chips. */
export function terrazzoTexture(size = 1024) {
  const random = rng(23);
  const k = size / 1024;
  const [c, ctx] = canvas(size);
  ctx.fillStyle = "#a59d92";
  ctx.fillRect(0, 0, size, size);
  mottle(ctx, size, size, random, 30, 0.06);
  const chips = ["#7d756b", "#c9c1b5", "#5f5a53", "#b7ab9a", "#8f8778", "#d9d2c7"];
  for (let i = 0; i < 5200 * k * k; i++) {
    const x = random() * size;
    const y = random() * size;
    const r = (1 + random() * random() * 7) * k;
    ctx.fillStyle = chips[Math.floor(random() * chips.length)];
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.5 + random() * 0.5), random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  grain(ctx, size, size, 14, random);
  return finish(c);
}

/** Limewash plaster for the interior walls. */
export function plasterTexture(base = "#c9bfae") {
  const random = rng(37);
  const size = 512;
  const [c, ctx] = canvas(size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  mottle(ctx, size, size, random, 90, 0.07);
  mottle(ctx, size, size, random, 60, 0.06, true);
  grain(ctx, size, size, 10, random);
  return finish(c);
}

/** Straight-grained oak. Grain runs along the texture's x axis. */
export function woodTexture(base = "#7a5636") {
  const random = rng(51);
  const [c, ctx] = canvas(1024, 256);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 1024, 256);
  for (let i = 0; i < 180; i++) {
    const y = random() * 256;
    ctx.strokeStyle = `rgba(${random() > 0.5 ? "40,24,12" : "255,230,200"},${0.05 + random() * 0.12})`;
    ctx.lineWidth = 0.5 + random() * 2.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= 1024; x += 64) ctx.lineTo(x, y + Math.sin(x * 0.01 + i) * (1 + random() * 3));
    ctx.stroke();
  }
  grain(ctx, 1024, 256, 12, random);
  return finish(c);
}

/** Dark fluted facade cladding: vertical ribs. */
export function claddingTexture() {
  const random = rng(67);
  const [c, ctx] = canvas(512, 512);
  ctx.fillStyle = "#26282a";
  ctx.fillRect(0, 0, 512, 512);
  const rib = 32;
  for (let x = 0; x < 512; x += rib) {
    const g = ctx.createLinearGradient(x, 0, x + rib, 0);
    g.addColorStop(0, "rgba(0,0,0,0.35)");
    g.addColorStop(0.35, "rgba(255,255,255,0.05)");
    g.addColorStop(0.65, "rgba(255,255,255,0.08)");
    g.addColorStop(1, "rgba(0,0,0,0.3)");
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, rib, 512);
  }
  grain(ctx, 512, 512, 8, random);
  return finish(c);
}

/** Backlit fascia lettering: the studio name, a rule, and a smaller line. */
export function signTexture(primary: string, secondary: string, line: string, font: string) {
  const [c, ctx] = canvas(2048, 384);
  ctx.clearRect(0, 0, 2048, 384);
  ctx.fillStyle = "#fff3df";
  ctx.textBaseline = "middle";
  ctx.font = `600 170px ${font}`;
  const main = secondary ? `${primary} / ${secondary}` : primary;
  const w = ctx.measureText(main).width;
  ctx.fillText(main, (2048 - w) / 2, 150);
  ctx.font = `500 64px ${font}`;
  const sub = line.toUpperCase().split("").join(" ");
  const sw = ctx.measureText(sub).width;
  ctx.globalAlpha = 0.8;
  ctx.fillText(sub, (2048 - sw) / 2, 300);
  const tex = finish(c, { anisotropy: 8 });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
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
  const tex = finish(c, { anisotropy: 8 });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** Strand density for the hair shells: dense specks thinning at the fade. */
export function hairShellTexture() {
  const random = rng(89);
  const size = 512;
  const [c, ctx] = canvas(size);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 52000; i++) {
    const v = Math.floor(120 + random() * 135);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(random() * size, random() * size, 1.2, 1.2 + random() * 1.6);
  }
  return finish(c, { color: false, repeat: [6, 3] });
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
  const tex = finish(c);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** Evening sky: deep blue-grey overhead, a warmer haze at the street's horizon. */
export function skyTexture() {
  const [c, ctx] = canvas(16, 512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "#0d1117");
  g.addColorStop(0.55, "#1c242d");
  g.addColorStop(0.8, "#3a3a3a");
  g.addColorStop(1, "#4a4038");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 512);
  const tex = finish(c);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}
