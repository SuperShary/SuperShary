// Generates the v5 profile sections as SVG tiles (assets/v5/*-{dark,light}.svg).
// Tiles are drawn on a 600-unit canvas and shown 400 px wide: two side by side
// on a desktop, one per row on a phone, where 22-unit text is still ~11 px.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { THEMES, SANS, MONO, esc, wrap, fits, dataUri } from "./design.mjs";

const projects = JSON.parse(await readFile("data/projects.json", "utf8"));
const style = `<style>.s{font-family:${SANS}}.m{font-family:${MONO}}.pulse{animation:p 2.4s ease-in-out infinite}@keyframes p{50%{opacity:.35}}</style>`;

export function productTile(theme, p) {
  const t = THEMES[theme];
  const W = 600, IMG = 375, pad = 32;
  const lines = wrap(p.line, 23, W - pad * 2, 4, p.name);
  const H = IMG + 150 + lines.length * 32;
  const o = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(`${p.name}. ${p.status}. ${p.line}`)}">${style}`);
  o.push(`<defs><clipPath id="c"><rect width="${W}" height="${H}" rx="22"/></clipPath></defs>`);
  o.push(`<g clip-path="url(#c)"><rect width="${W}" height="${H}" fill="${t.panel}"/>`);
  o.push(`<image href="${dataUri(`assets/shots/${p.shot}`)}" x="0" y="0" width="${W}" height="${IMG}" preserveAspectRatio="xMidYMid slice"/>`);
  o.push(`<rect y="${IMG}" width="${W}" height="1" fill="${t.line}"/></g>`);
  o.push(`<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="22" fill="none" stroke="${t.line}"/>`);
  let y = IMG + 50;
  o.push(`<circle class="pulse" cx="${pad + 6}" cy="${y - 7}" r="6" fill="${t.accent}"/><text class="s" x="${pad + 22}" y="${y}" font-size="21" font-weight="600" fill="${t.accent}">${esc(fits(p.status, 21, W - pad * 2 - 22, p.name))}</text>`);
  y += 50;
  o.push(`<text class="s" x="${pad}" y="${y}" font-size="38" font-weight="700" letter-spacing="-0.5" fill="${t.text}">${esc(fits(p.name, 38, W - pad * 2, p.name))}</text>`);
  lines.forEach((l, i) => o.push(`<text class="s" x="${pad}" y="${y + 42 + i * 32}" font-size="23" fill="${t.muted}">${esc(l)}</text>`));
  o.push(`</svg>`);
  return o.join("\n");
}

await mkdir("assets/v5", { recursive: true });
const spike = { ...projects.products[0], shot: "orbital.webp" };
for (const theme of ["dark", "light"]) await writeFile(`assets/v5/spike-${theme}.svg`, productTile(theme, spike) + "\n");
console.log("spike written");
