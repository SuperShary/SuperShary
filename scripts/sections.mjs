// Generates the profile sections as SVG tiles (assets/v5/*-{dark,light}.svg).
// Tiles are drawn on a 600-unit canvas and shown 400 px wide: two side by side
// on a desktop, one per row on a phone, where 22-unit text is still ~11 px.
// Every string comes from data/*.json; text that does not fit fails the build.
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { THEMES, SANS, MONO, esc, wrap, fits, textWidth, dataUri } from "./design.mjs";

const live = JSON.parse(await readFile("data/live.json", "utf8"));
const projects = JSON.parse(await readFile("data/projects.json", "utf8"));
const now = JSON.parse(await readFile("data/now.json", "utf8"));
const gh = live.github;

const TW = 600, PAD = 36, IMG = 375;
const fmt = (n) => (n == null ? "n/a" : n.toLocaleString("en-US"));
const compact = (v) => (v == null ? "n/a" : v >= 1e6 ? (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : v >= 1e4 ? Math.round(v / 1e3) + "K" : v.toLocaleString("en-US"));
const day = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const css = `<style>.s{font-family:${SANS}}.m{font-family:${MONO}}
.pulse{animation:p 2.4s ease-in-out infinite}@keyframes p{50%{opacity:.35}}
.edge{stroke-dasharray:140 2400;animation:e 9s linear infinite}@keyframes e{to{stroke-dashoffset:-2540}}
.walk{animation:w 7s cubic-bezier(.6,0,.4,1) infinite}</style>`;

function frame(theme, H, label, body, { clip = false } = {}) {
  const t = THEMES[theme];
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TW} ${H}" width="${TW}" height="${H}" role="img" aria-label="${esc(label)}">${css}`,
    `<defs><clipPath id="c"><rect width="${TW}" height="${H}" rx="22"/></clipPath></defs>`,
    `<rect width="${TW}" height="${H}" rx="22" fill="${t.panel}"/>`,
    clip ? `<g clip-path="url(#c)">${body.clip}</g>` : "",
    body.main,
    `<rect x=".5" y=".5" width="${TW - 1}" height="${H - 1}" rx="22" fill="none" stroke="${t.line}"/>`,
    `<rect class="edge" x=".5" y=".5" width="${TW - 1}" height="${H - 1}" rx="22" fill="none" stroke="${t.accent}" stroke-opacity=".7" stroke-width="1.5"/>`,
    `</svg>`,
  ].join("\n");
}
const kicker = (t, x, y, s) => `<text class="m" x="${x}" y="${y}" font-size="17" letter-spacing="3" fill="${t.accent}">${esc(s.toUpperCase())}</text>`;
const status = (t, x, y, s, where) => `<circle class="pulse" cx="${x + 6}" cy="${y - 7}" r="6" fill="${t.accent}"/><text class="s" x="${x + 22}" y="${y}" font-size="21" font-weight="600" fill="${t.accent}">${esc(fits(s, 21, TW - x - PAD - 22, where))}</text>`;

// ---------- picture tiles: products and open source ----------
const PIC_H = IMG + 150 + 4 * 32;
function pictureTile(theme, p, statusText) {
  const t = THEMES[theme];
  const lines = wrap(p.line, 23, TW - PAD * 2, 4, p.name);
  let y = IMG + 50;
  const main = [
    status(t, PAD, y, statusText, p.name),
    `<text class="s" x="${PAD}" y="${y + 50}" font-size="38" font-weight="700" letter-spacing="-0.5" fill="${t.text}">${esc(fits(p.name, 38, TW - PAD * 2, p.name))}</text>`,
    ...lines.map((l, i) => `<text class="s" x="${PAD}" y="${y + 92 + i * 32}" font-size="23" fill="${t.muted}">${esc(l)}</text>`),
  ].join("\n");
  const clip = `<image href="${dataUri(`assets/shots/${p.shot}`)}" width="${TW}" height="${IMG}" preserveAspectRatio="xMidYMid slice"/><rect y="${IMG}" width="${TW}" height="1" fill="${t.line}"/>`;
  return frame(theme, PIC_H, `${p.name}. ${statusText}. ${p.line}`, { main, clip }, { clip: true });
}

// ---------- Proxsoft + now building (one row, same height) ----------
function proxsoftTile(theme, H) {
  const t = THEMES[theme];
  const o = [kicker(t, PAD, 62, "At Proxsoft"),
    `<text class="s" x="${PAD}" y="110" font-size="32" font-weight="700" letter-spacing="-0.5" fill="${t.text}">${esc(fits("Founder's Office, AI & GTM", 32, TW - PAD * 2, "proxsoft"))}</text>`];
  wrap("AI agents for construction finance, on top of the ERP a company already runs.", 22, TW - PAD * 2, 2, "proxsoft sub")
    .forEach((l, i) => o.push(`<text class="s" x="${PAD}" y="${148 + i * 30}" font-size="22" fill="${t.muted}">${esc(l)}</text>`));
  let y = 248;
  for (const p of projects.proxsoft) {
    const nameW = textWidth(p.name, 30);
    o.push(`<text class="s" x="${PAD}" y="${y}" font-size="30" font-weight="700" fill="${t.text}">${esc(p.name)}</text>`);
    o.push(status(t, PAD + nameW + 22, y - 2, p.status, p.name));
    const lines = wrap(p.line, 22, TW - PAD * 2, 4, p.name);
    lines.forEach((l, i) => o.push(`<text class="s" x="${PAD}" y="${y + 36 + i * 30}" font-size="22" fill="${t.muted}">${esc(l)}</text>`));
    y += 36 + lines.length * 30 + 40;
  }
  // The flow: everything moves on its own except the step a person owns.
  const fy = H - 74, x0 = PAD + 14, x1 = TW - PAD - 14, n = projects.flow.length, gap = (x1 - x0) / (n - 1);
  const hold = projects.flow.indexOf("approved");
  o.push(`<line x1="${x0}" x2="${x1}" y1="${fy}" y2="${fy}" stroke="${t.line}" stroke-width="2"/>`);
  projects.flow.forEach((label, i) => {
    const x = x0 + i * gap, mine = i === hold;
    o.push(`<circle cx="${x}" cy="${fy}" r="${mine ? 9 : 6}" fill="${mine ? t.accent : t.faint}"/>`);
    o.push(`<text class="s" x="${x}" y="${fy + 40}" font-size="20" text-anchor="middle" font-weight="${mine ? 700 : 400}" fill="${mine ? t.accent : t.muted}">${esc(label)}</text>`);
    if (mine) o.push(`<text class="s" x="${x}" y="${fy - 24}" font-size="20" text-anchor="middle" font-weight="700" fill="${t.accent}">a person decides</text>`);
  });
  const hx = x0 + hold * gap;
  o.push(`<style>@keyframes w{0%{transform:translateX(0)}35%{transform:translateX(${hx - x0}px)}65%{transform:translateX(${hx - x0}px)}100%{transform:translateX(${x1 - x0}px)}}</style>`);
  o.push(`<circle class="walk" cx="${x0}" cy="${fy}" r="5" fill="${t.text}"/>`);
  if (y - 40 > fy - 74) throw new Error(`proxsoft tile: content (${y}) runs into the flow (${fy})`);
  return frame(theme, H, `At Proxsoft, Founder's Office, AI and GTM. ${projects.proxsoft.map((p) => `${p.name}: ${p.status}. ${p.line}`).join(" ")}`, { main: o.join("\n") });
}

function nowTile(theme, H) {
  const t = THEMES[theme];
  const o = [kicker(t, PAD, 62, "Now building")];
  let y = 120;
  now.items.forEach((item, i) => {
    const [name, ...rest] = item.split(": ");
    o.push(`<text class="m" x="${PAD}" y="${y}" font-size="22" font-weight="700" fill="${t.accent}">0${i + 1}</text>`);
    o.push(`<text class="s" x="${PAD + 52}" y="${y}" font-size="30" font-weight="700" fill="${t.text}">${esc(fits(name, 30, TW - PAD * 2 - 52, "now"))}</text>`);
    const text = rest.join(": ");
    const lines = wrap(text.charAt(0).toUpperCase() + text.slice(1), 22, TW - PAD * 2 - 52, 3, `now ${name}`);
    lines.forEach((l, k) => o.push(`<text class="s" x="${PAD + 52}" y="${y + 36 + k * 30}" font-size="22" fill="${t.muted}">${esc(l)}</text>`));
    y += 36 + lines.length * 30 + 44;
  });
  if (y > H) throw new Error(`now tile: content (${y}) taller than ${H}`);
  return frame(theme, H, `Now building. ${now.items.join(" ")}`, { main: o.join("\n") });
}

// ---------- numbers (one row, same height) ----------
const NUM_H = 560;
function yearTile(theme) {
  const t = THEMES[theme];
  const o = [kicker(t, PAD, 62, "Last 365 days"),
    `<text class="s" x="${PAD}" y="146" font-size="76" font-weight="700" letter-spacing="-2" fill="${t.text}">${fmt(gh.total)}</text>`,
    `<text class="s" x="${PAD}" y="186" font-size="22" fill="${t.muted}">contributions on GitHub, private work included</text>`];
  [[gh.streak.longest, "day streak"], [gh.busiest.count, `on ${day(gh.busiest.date)}`], [(gh.total / gh.days.length).toFixed(1), "a day"]].forEach(([v, l], i) => {
    const x = PAD + i * 176;
    o.push(`<text class="s" x="${x}" y="262" font-size="42" font-weight="700" fill="${t.accent}">${esc(v)}</text><text class="s" x="${x}" y="294" font-size="20" fill="${t.muted}">${esc(l)}</text>`);
  });
  const months = gh.months.slice(-12), max = Math.max(...months.map((m) => m.count), 1);
  const bw = (TW - PAD * 2) / months.length, base = NUM_H - 70;
  months.forEach((m, i) => {
    const h = Math.max(3, (m.count / max) * 170), x = PAD + i * bw;
    o.push(`<rect x="${(x + 5).toFixed(1)}" y="${(base - h).toFixed(1)}" width="${(bw - 10).toFixed(1)}" height="${h.toFixed(1)}" rx="4" fill="${m.count === max ? t.accent : t.faint}"/>`);
    const label = new Date(m.month + "-01T00:00:00Z").toLocaleDateString("en-GB", { month: "narrow", timeZone: "UTC" });
    o.push(`<text class="s" x="${(x + bw / 2).toFixed(1)}" y="${base + 30}" font-size="17" text-anchor="middle" fill="${t.muted}">${label}</text>`);
  });
  return frame(theme, NUM_H, `${fmt(gh.total)} contributions on GitHub in the last 365 days, ${gh.streak.longest} day longest streak.`, { main: o.join("\n") });
}
function reachTile(theme) {
  const t = THEMES[theme];
  const o = [kicker(t, PAD, 62, "Reach")];
  let y = 120;
  for (const c of projects.channels) {
    const yt = live.youtube.find((v) => v.handle === c.handle) || {};
    o.push(`<text class="s" x="${PAD}" y="${y}" font-size="28" font-weight="700" fill="${t.text}">${esc(c.name)}</text><text class="s" x="${PAD}" y="${y + 28}" font-size="18" fill="${t.muted}">youtube.com/@${esc(c.handle)}</text>`);
    [[compact(yt.subscribers), "subscribers"], [compact(yt.videos), "videos"], [compact(yt.views), "views"]].forEach(([v, l], i) => {
      const x = PAD + i * 176;
      o.push(`<text class="s" x="${x}" y="${y + 84}" font-size="40" font-weight="700" fill="${t.accent}">${v}</text><text class="s" x="${x}" y="${y + 112}" font-size="19" fill="${t.muted}">${l}</text>`);
    });
    y += 170;
  }
  o.push(`<text class="s" x="${PAD}" y="${NUM_H - 50}" font-size="21" fill="${t.muted}">GitHub: <tspan fill="${t.text}" font-weight="700">${gh.publicRepos}</tspan> public repos · <tspan fill="${t.text}" font-weight="700">${gh.stars}</tspan> stars</text>`);
  return frame(theme, NUM_H, `YouTube reach: ${live.youtube.map((y) => `${y.title}, ${y.subscribers} subscribers`).join("; ")}.`, { main: o.join("\n") });
}

// ---------- pills ----------
function pill(theme, label, filled) {
  const t = THEMES[theme];
  const H = 56, w = Math.ceil(textWidth(label, 22) + 64);
  const bg = filled ? t.text : "none", fg = filled ? t.bg : t.text;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${H}" width="${w}" height="${H}" role="img" aria-label="${esc(label)}"><style>.s{font-family:${SANS}}</style><rect x="1" y="1" width="${w - 2}" height="${H - 2}" rx="${H / 2 - 1}" fill="${bg}" stroke="${filled ? t.text : t.line}" stroke-width="2"/><circle cx="26" cy="${H / 2}" r="5" fill="${t.accent}"/><text class="s" x="40" y="${H / 2 + 8}" font-size="22" font-weight="600" fill="${fg}">${esc(label)}</text></svg>`;
}

// ---------- write ----------
await rm("assets/v5", { recursive: true, force: true });
await mkdir("assets/v5", { recursive: true });
const pills = [...(projects.portfolio.live && projects.portfolio.url ? [{ key: "portfolio", label: "Portfolio", url: projects.portfolio.url }] : []), ...projects.pills];
for (const theme of ["dark", "light"]) {
  const out = (name, svg) => writeFile(`assets/v5/${name}-${theme}.svg`, svg + "\n");
  for (const p of projects.products) await out(`product-${p.shot.split(".")[0]}`, pictureTile(theme, p, p.status));
  for (const p of projects.openSource) {
    const r = gh.repos[p.repo];
    await out(`oss-${p.repo}`, pictureTile(theme, p, `Open source${r?.stars ? ` · ★ ${r.stars}` : ""}`));
  }
  const ROW = 720;
  await out("proxsoft", proxsoftTile(theme, ROW));
  await out("now", nowTile(theme, ROW));
  await out("year", yearTile(theme));
  await out("reach", reachTile(theme));
  for (const [i, p] of pills.entries()) await out(`pill-${p.key}`, pill(theme, p.label, i === 0));
}
console.log(`sections: ${projects.products.length} products, ${projects.openSource.length} open source, proxsoft, now, year, reach, ${pills.length} pills`);
