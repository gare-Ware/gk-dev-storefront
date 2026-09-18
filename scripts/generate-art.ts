/**
 * Procedural product art for the filler catalogue.
 *
 * Each image is an SVG composed from the motif named in catalogue.json and
 * rasterised with resvg to a portrait 4:5 PNG. Deterministic: the seed is the
 * product handle plus the image index, so re-seeding the store attaches
 * byte-identical images. No text is drawn, so no fonts are needed.
 *
 *   pnpm art                     writes every product's images to scripts/art-out/
 *   pnpm art witness-tee ...     only those handles
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { readCatalogue, type CatalogueProduct } from "./catalogue.ts";

export const WIDTH = 1200;
export const HEIGHT = 1500; // 4:5 portrait, the catalogue's image aspect

export type ArtSpec = Pick<CatalogueProduct, "handle" | "title"> & { motif: string };

type Palette = { ground: string; ink: string; accent: string; light: boolean };

// Deliberately not one brand palette: the storefront's colours are undecided,
// and product photography would vary anyway.
const PALETTES: Palette[] = [
  { ground: "#101114", ink: "#e6e1d6", accent: "#c9a24a", light: false },
  { ground: "#e7e1d5", ink: "#161616", accent: "#8a2b2b", light: true },
  { ground: "#2e2f33", ink: "#d3ccbe", accent: "#d9a441", light: false },
  { ground: "#1a2230", ink: "#dfe3e8", accent: "#a7b4c4", light: false },
  { ground: "#0f0f11", ink: "#cfc7b8", accent: "#b6412f", light: false },
];

const FORCED: Record<string, Palette> = {
  "red-field": { ground: "#5a1013", ink: "#f0e7d8", accent: "#ff6a4d", light: false },
  "noise-band": PALETTES[1],
  prism: PALETTES[2],
  hemispheres: { ground: "#e3ddd2", ink: "#1d1d1f", accent: "#c8362b", light: true },
};

const ALT: Record<string, string> = {
  "serpent-small": "the Omen serpent mark, small, on a plain ground",
  "serpent-nine": "the nine-serpent Omen mark filling the frame",
  "record-line": "rows of redacted record lines with one small ring beside them",
  "noise-band": "a band of static across a ribbed ground",
  "starfield-anomaly": "a field of stars with one ringed object among them",
  "red-field": "an unbroken red field with a ruled line along the bottom",
  "five-symbols": "the five Zener symbols: circle, cross, waves, square, star",
  hemispheres: "two translucent half-spheres lit by a red circle",
  "ruled-columns": "a ruled page with columns and a few marks in the cells",
  prism: "a black rectangular prism casting a long shadow",
};

export const MOTIFS = Object.keys(ALT);

// --- deterministic randomness -------------------------------------------

type Rng = () => number;

function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- svg helpers ----------------------------------------------------------

const n = (v: number) => (Math.round(v * 10) / 10).toString();

type Ctx = { w: number; h: number; pal: Palette; rng: Rng; index: number; mark: string };

function placeMark(mark: string, cx: number, cy: number, size: number, fill: string, opacity = 1): string {
  const s = size / 1254; // the mark's viewBox is 1254 square
  return `<g fill="${fill}" fill-opacity="${n(opacity)}" transform="translate(${n(cx - size / 2)} ${n(cy - size / 2)}) scale(${s.toFixed(5)})">${mark}</g>`;
}

function ring(cx: number, cy: number, r: number, stroke: string, opacity: number, width: number): string {
  return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="none" stroke="${stroke}" stroke-opacity="${n(opacity)}" stroke-width="${n(width)}"/>`;
}

function line(x1: number, y1: number, x2: number, y2: number, stroke: string, opacity: number, width: number): string {
  return `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${stroke}" stroke-opacity="${n(opacity)}" stroke-width="${n(width)}" stroke-linecap="round"/>`;
}

function zener(kind: number, cx: number, cy: number, size: number, stroke: string, width: number): string {
  const r = size / 2;
  const attrs = `fill="none" stroke="${stroke}" stroke-width="${n(width)}" stroke-linecap="round" stroke-linejoin="round"`;
  switch (kind % 5) {
    case 0:
      return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" ${attrs}/>`;
    case 1:
      return `<path d="M${n(cx - r)} ${n(cy)}H${n(cx + r)}M${n(cx)} ${n(cy - r)}V${n(cy + r)}" ${attrs}/>`;
    case 2: {
      const rows = [-0.3, 0, 0.3].map((k) => {
        const y = cy + k * size;
        const pts: string[] = [];
        for (let i = 0; i <= 24; i++) {
          const t = i / 24;
          pts.push(`${n(cx - r + t * size)} ${n(y + Math.sin(t * Math.PI * 3) * size * 0.07)}`);
        }
        return `M${pts.join("L")}`;
      });
      return `<path d="${rows.join("")}" ${attrs}/>`;
    }
    case 3:
      return `<rect x="${n(cx - r)}" y="${n(cy - r)}" width="${n(size)}" height="${n(size)}" ${attrs}/>`;
    default: {
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rad = i % 2 === 0 ? r : r * 0.42;
        pts.push(`${n(cx + Math.cos(a) * rad)},${n(cy + Math.sin(a) * rad)}`);
      }
      return `<polygon points="${pts.join(" ")}" ${attrs}/>`;
    }
  }
}

// --- motifs -----------------------------------------------------------------

const MOTIF_RENDERERS: Record<string, (c: Ctx) => string> = {
  "serpent-small": ({ w, h, pal, mark, index, rng }) => {
    const size = w * (0.18 + 0.05 * index);
    const cx = w / 2 + (index ? (rng() - 0.5) * w * 0.3 : 0);
    const cy = h * 0.42 + (index ? (rng() - 0.5) * h * 0.2 : 0);
    return ring(cx, cy, w * 0.36, pal.ink, 0.1, 2) + placeMark(mark, cx, cy, size, pal.ink);
  },

  "serpent-nine": ({ w, h, pal, mark, index }) => {
    if (index === 1) return placeMark(mark, w * 0.62, h * 0.58, w * 1.6, pal.ink); // cropped detail
    return placeMark(mark, w / 2, h / 2, w * 0.72, index === 2 ? pal.accent : pal.ink);
  },

  "record-line": ({ w, h, pal, rng, index }) => {
    const rows = 14 + index * 3;
    const top = h * 0.2;
    const gap = (h * 0.6) / rows;
    let s = "";
    for (let i = 0; i < rows; i++) {
      const y = top + i * gap;
      let x = w * 0.14;
      const segments = 2 + Math.floor(rng() * 4);
      for (let k = 0; k < segments; k++) {
        const len = w * (0.04 + rng() * 0.16);
        if (x + len > w * 0.86) break;
        s += `<rect x="${n(x)}" y="${n(y)}" width="${n(len)}" height="${n(gap * 0.28)}" fill="${pal.ink}" fill-opacity="${n(0.5 + rng() * 0.5)}"/>`;
        x += len + w * (0.02 + rng() * 0.05);
      }
    }
    return s + ring(w * 0.78, top - gap * 1.6, w * 0.016, pal.accent, 1, 3);
  },

  "noise-band": ({ w, h, pal, index, rng }) => {
    const bandH = h * (0.14 + index * 0.05);
    const bandY = h * 0.42 + (index ? (rng() - 0.5) * h * 0.2 : 0);
    let s = "";
    for (let y = h * 0.1; y < h * 0.9; y += 18) {
      if (y > bandY - 12 && y < bandY + bandH + 12) continue;
      s += line(w * 0.12, y, w * 0.88, y, pal.ink, 0.16, 2);
    }
    return s + `<rect x="0" y="${n(bandY)}" width="${w}" height="${n(bandH)}" filter="url(#static)"/>`;
  },

  "starfield-anomaly": ({ w, h, pal, rng, index }) => {
    const stars: [number, number][] = [];
    let s = "";
    const count = 220 + index * 80;
    for (let i = 0; i < count; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const r = 0.9 + rng() * 2.4;
      stars.push([x, y]);
      s += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${pal.ink}" fill-opacity="${n(0.5 + rng() * 0.5)}"/>`;
    }
    const picked = Array.from({ length: 6 }, () => stars[Math.floor(rng() * stars.length)]);
    s += `<polyline points="${picked.map(([x, y]) => `${n(x)},${n(y)}`).join(" ")}" fill="none" stroke="${pal.ink}" stroke-opacity="0.3" stroke-width="1.5"/>`;
    const ax = w * (0.58 + index * 0.1);
    const ay = h * (0.36 + index * 0.12);
    s += `<ellipse cx="${n(ax)}" cy="${n(ay)}" rx="${n(w * 0.034)}" ry="${n(w * 0.011)}" fill="none" stroke="${pal.accent}" stroke-width="3" transform="rotate(-18 ${n(ax)} ${n(ay)})"/>`;
    return s;
  },

  "red-field": ({ w, h, pal, index }) => {
    let s = `<rect width="${w}" height="${h}" fill="url(#glow)"/>`;
    if (index === 2) s += ring(w / 2, h * 0.45, w * 0.2, pal.ink, 0.35, 2);
    const y = h * 0.9;
    s += line(w * 0.1, y, w * 0.9, y, pal.ink, 0.55, 2);
    for (let i = 0; i <= 16; i++) {
      const x = w * 0.1 + (i * w * 0.8) / 16;
      s += line(x, y, x, y - (i % 4 === 0 ? 14 : 7), pal.ink, 0.55, 2);
    }
    return s;
  },

  "five-symbols": ({ w, h, pal, index, rng }) => {
    const stroke = pal.ink;
    if (index === 2) return zener(Math.floor(rng() * 5), w / 2, h / 2, w * 0.42, stroke, 10);
    if (index === 1) {
      let s = "";
      for (let k = 0; k < 5; k++) {
        const cx = w * (k % 2 === 0 ? 0.32 : 0.68);
        const cy = h * (0.18 + k * 0.16);
        s += zener(k, cx, cy, w * 0.2, stroke, 7);
      }
      return s;
    }
    let s = "";
    for (let k = 0; k < 5; k++) s += zener(k, w / 2, h * (0.14 + k * 0.18), w * 0.17, stroke, 7);
    return s;
  },

  hemispheres: ({ w, h, pal, index }) => {
    const r = w * (index === 1 ? 0.32 : 0.19);
    const y = h * 0.56;
    const dome = (cx: number) =>
      `<path d="M${n(cx - r)} ${n(y)}A${n(r)} ${n(r)} 0 0 1 ${n(cx + r)} ${n(y)}Z" fill="url(#shade)" stroke="${pal.ink}" stroke-opacity="0.5" stroke-width="2"/>`;
    let s = `<circle cx="${n(w / 2)}" cy="${n(h * 0.3)}" r="${n(w * 0.14)}" fill="${pal.accent}" fill-opacity="${index === 2 ? 0.95 : 0.8}"/>`;
    if (index === 1) s += dome(w / 2);
    else s += dome(w * 0.32) + dome(w * 0.68) + line(w * 0.32 - r, y, w * 0.68 + r, y, pal.ink, 0.5, 3);
    return s;
  },

  "ruled-columns": ({ w, h, pal, rng, index }) => {
    const rowGap = h * (0.045 - index * 0.008);
    const left = w * 0.1;
    const right = w * 0.9;
    const top = h * 0.14;
    const bottom = h * 0.9;
    let s = line(left, top, right, top, pal.ink, 0.7, 3);
    for (let y = top + rowGap; y < bottom; y += rowGap) s += line(left, y, right, y, pal.ink, 0.28, 1.5);
    const columns = [0.1, 0.24, 0.38, 0.52, 0.66, 0.8, 0.9];
    for (const c of columns) s += line(w * c, top, w * c, bottom, pal.ink, 0.28, 1.5);
    const rows = Math.floor((bottom - top) / rowGap);
    for (let i = 0; i < rows; i++) {
      for (let k = 0; k < columns.length - 1; k++) {
        if (rng() > 0.3) continue;
        const x0 = w * columns[k] + 14;
        const x1 = Math.min(w * columns[k + 1] - 14, x0 + w * (0.02 + rng() * 0.08));
        const y = top + rowGap * (i + 0.6);
        s += line(x0, y, x1, y, pal.ink, 0.7, 3);
      }
    }
    s += ring(w * (columns[5] + 0.05), top + rowGap * (3.5 + index * 2), rowGap * 0.28, pal.accent, 1, 3);
    return s;
  },

  prism: ({ w, h, pal, index }) => {
    // A 1:4:9 block in oblique projection: front face 4 wide, 9 tall, 1 deep.
    const scale = index === 2 ? 1.5 : 1;
    const fw = w * 0.3 * scale;
    const fh = (fw * 9) / 4;
    const depth = fw / 4;
    const dx = depth * 0.9;
    const dy = -depth * 0.55;
    const x = w / 2 - fw / 2 - (index === 1 ? w * 0.12 : 0);
    const y = h * 0.62 - fh / 2 + (index === 2 ? h * 0.1 : 0);
    const shadow = `<ellipse cx="${n(x + fw * 0.8)}" cy="${n(y + fh + 10)}" rx="${n(fw * 1.1)}" ry="${n(depth * 0.6)}" fill="#000" fill-opacity="0.35"/>`;
    const front = `<rect x="${n(x)}" y="${n(y)}" width="${n(fw)}" height="${n(fh)}" fill="#0d0d0f"/>`;
    const side = `<polygon points="${n(x + fw)},${n(y)} ${n(x + fw + dx)},${n(y + dy)} ${n(x + fw + dx)},${n(y + fh + dy)} ${n(x + fw)},${n(y + fh)}" fill="#1c1c1f"/>`;
    const top = `<polygon points="${n(x)},${n(y)} ${n(x + dx)},${n(y + dy)} ${n(x + fw + dx)},${n(y + dy)} ${n(x + fw)},${n(y)}" fill="#2a2a2e"/>`;
    return shadow + front + side + top + line(x, y, x, y + fh, pal.ink, 0.15, 1);
  },
};

// --- composition --------------------------------------------------------------

let cachedMark: string | undefined;

/** The flattened Omen mark from the brand kit, as bare paths that inherit fill. */
export function loadMark(): string {
  if (cachedMark) return cachedMark;
  const svg = readFileSync(new URL("./art/omen-mark.svg", import.meta.url), "utf8");
  const paths = Array.from(svg.matchAll(/<path\b[^>]*>/g), (m) => m[0].replace(/\sfill="#[0-9a-fA-F]{6}"/, ""));
  if (!paths.length) throw new Error("scripts/art/omen-mark.svg contains no <path> elements");
  cachedMark = paths.join("");
  return cachedMark;
}

export function paletteFor(spec: ArtSpec): Palette {
  return FORCED[spec.motif] ?? PALETTES[fnv1a(spec.handle) % PALETTES.length];
}

export function altText(spec: ArtSpec, index: number): string {
  const what = ALT[spec.motif] ?? spec.motif;
  return `${spec.title}: ${what}${index ? `, view ${index + 1}` : ""}`;
}

/** The complete SVG document for one image. Pure given the mark file. */
export function artSvg(spec: ArtSpec, index: number): string {
  const render = MOTIF_RENDERERS[spec.motif];
  if (!render) throw new Error(`unknown motif "${spec.motif}" for ${spec.handle}`);
  const seed = fnv1a(`${spec.handle}#${index}`);
  const pal = paletteFor(spec);
  const ctx: Ctx = { w: WIDTH, h: HEIGHT, pal, rng: mulberry32(seed), index, mark: loadMark() };
  const grainTone = pal.light ? 0 : 1;
  const vignette = pal.light ? 0.14 : 0.6;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">`,
    `<defs>`,
    `<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">`,
    `<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${seed % 1000}" stitchTiles="stitch"/>`,
    `<feColorMatrix type="matrix" values="0 0 0 0 ${grainTone}  0 0 0 0 ${grainTone}  0 0 0 0 ${grainTone}  0.45 0 0 0 0"/>`,
    `</filter>`,
    `<filter id="static" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">`,
    `<feTurbulence type="fractalNoise" baseFrequency="0.9 0.06" numOctaves="1" seed="${(seed >> 4) % 1000}"/>`,
    `<feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 0 1"/>`,
    `</filter>`,
    `<radialGradient id="vignette" cx="50%" cy="45%" r="72%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="${vignette}"/></radialGradient>`,
    `<radialGradient id="glow" cx="${50 + (index - 1) * 12}%" cy="${44 + index * 6}%" r="70%"><stop offset="0%" stop-color="${pal.accent}" stop-opacity="0.45"/><stop offset="100%" stop-color="${pal.accent}" stop-opacity="0"/></radialGradient>`,
    `<linearGradient id="shade" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${pal.ink}" stop-opacity="0.05"/><stop offset="100%" stop-color="${pal.ink}" stop-opacity="0.4"/></linearGradient>`,
    `</defs>`,
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="${pal.ground}"/>`,
    render(ctx),
    `<rect width="${WIDTH}" height="${HEIGHT}" filter="url(#grain)" opacity="0.5"/>`,
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#vignette)"/>`,
    `</svg>`,
  ].join("\n");
}

export function artPng(spec: ArtSpec, index: number): Buffer {
  const svg = artSvg(spec, index);
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: WIDTH },
    font: { loadSystemFonts: false },
    logLevel: "off",
  });
  return resvg.render().asPng();
}

export function artFilename(spec: ArtSpec, index: number): string {
  return `${spec.handle}-${index + 1}.png`;
}

// --- cli ----------------------------------------------------------------------

function main(argv: string[]) {
  const outFlag = argv.indexOf("--out");
  const outDir = outFlag >= 0 ? argv[outFlag + 1] : fileURLToPath(new URL("./art-out/", import.meta.url));
  const handles = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--out");
  const { catalogue } = readCatalogue();
  const products = handles.length
    ? catalogue.products.filter((p) => handles.includes(p.handle))
    : catalogue.products;
  mkdirSync(outDir, { recursive: true });
  let files = 0;
  for (const p of products) {
    const spec = { handle: p.handle, title: p.title, motif: p.images.motif };
    for (let i = 0; i < p.images.count; i++) {
      const path = join(outDir, artFilename(spec, i));
      writeFileSync(path, artPng(spec, i));
      files++;
    }
    console.log(`${p.handle}: ${p.images.count} image(s), ${p.images.motif}`);
  }
  console.log(`wrote ${files} file(s) to ${outDir}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
