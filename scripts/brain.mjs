// Generates assets/brain-{dark,light}.svg: a rotating brain of 365 neurons,
// one per day of the last year, from data/live.json.
//
// Why it stays small: under a rotation about the vertical axis every projected
// coordinate is C + A*cos(theta - phi). A sinusoid is a 3-keyframe SMIL
// <animate> with sine easing plus a phase offset (negative begin), so nothing is
// baked frame by frame and the motion is smooth at any frame rate.
import { readFile, writeFile } from "node:fs/promises";

const live = JSON.parse(await readFile("data/live.json", "utf8"));
const gh = live.github;

const W = 1200, H = 560;
const CX = 820, CY = 268, S = 400;   // brain centre and scale on screen
const T = 40;                        // seconds per full turn
const TILT = (17 * Math.PI) / 180;   // we look at it slightly from above
const EASE = ".37 0 .63 1";          // easeInOutSine = half a cosine

// Deterministic randomness: the brain keeps its shape from day to day.
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(1903);
const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
const unit = () => { const v = [gauss(), gauss(), gauss()]; const l = Math.hypot(...v); return v.map((c) => c / l); };

// ---------- anatomy (x: left-right, y: up, z: back-to-front) ----------
function cerebrumPoint() {
  for (;;) {
    const h = rand() < 0.5 ? -1 : 1;
    const [ux, uy, uz] = unit();
    if (h * ux < -0.35 && rand() < 0.85) continue;              // keep the fissure open
    const gyri = 1 + 0.045 * Math.sin(9 * ux + 13 * uy) * Math.sin(11 * uz - 7 * uy);
    let x = h * 0.205 + 0.215 * ux * gyri;
    let y = 0.36 * uy * gyri;
    let z = 0.52 * uz * gyri;
    if (uz > 0.2) y -= 0.07 * (uz - 0.2);                       // frontal lobe sits lower
    if (uy < -0.1 && uz > -0.3 && uz < 0.45) x *= 1.07;         // temporal bulge
    if (y < -0.13) y = -0.13 + (y + 0.13) * 0.5;                // flat underside
    return [x, y + 0.04, z];
  }
}
function cerebellumPoint() {
  for (;;) {
    const [ux, uy, uz] = unit();
    if (uy > 0.35) continue;
    return [0.25 * ux, -0.19 + 0.1 * uy, -0.36 + 0.14 * uz];
  }
}
function stemPoint() {
  const t = rand(), a = rand() * 2 * Math.PI;
  return [0.045 * Math.cos(a), -0.2 - 0.26 * t, -0.16 + 0.05 * t + 0.045 * Math.sin(a)];
}

// Best-candidate sampling spreads neurons evenly over the surface.
function spread(n, gen, k = 14) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    let best = null, bestD = -1;
    for (let c = 0; c < k; c++) {
      const p = gen();
      let d = Infinity;
      for (const q of pts) d = Math.min(d, (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2);
      if (d > bestD) { bestD = d; best = p; }
    }
    pts.push(best);
  }
  return pts;
}

const days = gh.days.slice(-365);
const dayPts = spread(days.length, cerebrumPoint).sort((a, b) => a[2] - b[2]); // back = oldest
const nodes = [
  ...dayPts.map((p, i) => ({ p, day: days[i] })),
  ...spread(44, cerebellumPoint).map((p) => ({ p })),
  ...spread(14, stemPoint).map((p) => ({ p })),
];

// Synapses: each neuron to its 2 nearest, plus a few long callosal fibres.
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const edgeSet = new Set(), edges = [];
const addEdge = (i, j) => { const k = i < j ? `${i}-${j}` : `${j}-${i}`; if (i !== j && !edgeSet.has(k)) { edgeSet.add(k); edges.push([i, j]); } };
nodes.forEach((n, i) => {
  nodes.map((m, j) => [dist2(n.p, m.p), j]).sort((a, b) => a[0] - b[0]).slice(1, 3).forEach(([, j]) => addEdge(i, j));
});
for (let c = 0; c < 16; c++) {
  const left = nodes.findIndex((n, i) => i < dayPts.length && n.p[0] < -0.08 && n.p[1] > 0.1 && rand() < 0.04);
  const right = nodes.findIndex((n, i) => i < dayPts.length && n.p[0] > 0.08 && n.p[1] > 0.1 && rand() < 0.04);
  if (left >= 0 && right >= 0) addEdge(left, right);
}

// ---------- projection as sinusoids ----------
// f(theta) = C + A cos(theta - phi). Complex form lets us average two of them.
const sinus = (C, a, b) => ({ C, A: Math.hypot(a, b), phi: Math.atan2(b, a) }); // a cos + b sin
function project([x, y, z]) {
  // x' = x cos + z sin ; z1 = z cos - x sin
  const sx = sinus(0, x, z);
  const z1 = sinus(0, z, -x);
  return {
    X: { C: CX, A: S * sx.A, phi: sx.phi },
    Y: { C: CY - S * y * Math.cos(TILT), A: -S * z1.A * Math.sin(TILT), phi: z1.phi },
    D: { C: -y * Math.sin(TILT), A: z1.A * Math.cos(TILT), phi: z1.phi },
  };
}
const avg = (f, g) => {
  const re = (f.A * Math.cos(f.phi) + g.A * Math.cos(g.phi)) / 2;
  const im = (f.A * Math.sin(f.phi) + g.A * Math.sin(g.phi)) / 2;
  return { C: (f.C + g.C) / 2, A: Math.hypot(re, im), phi: Math.atan2(im, re) };
};
const lin = (f, p, q) => ({ C: p + q * f.C, A: q * f.A, phi: f.phi }); // p + q*f
const r1 = (v) => { const s = (Math.round(v * 10) / 10).toString(); return s === "-0" ? "0" : s; };
const r2 = (v) => (Math.round(v * 100) / 100).toString();
const fmt = (v, digits) => (digits === 2 ? r2(v) : r1(v));
function anim(attr, f, digits = 1) {
  const begin = ((((f.phi / (2 * Math.PI)) % 1) + 1) % 1) * T - T;
  return `<animate attributeName="${attr}" values="${fmt(f.C + f.A, digits)};${fmt(f.C - f.A, digits)};${fmt(f.C + f.A, digits)}" dur="${T}s" begin="${r2(begin)}s" repeatCount="indefinite" calcMode="spline" keyTimes="0;.5;1" keySplines="${EASE};${EASE}"/>`;
}
const at0 = (f) => f.C + f.A * Math.cos(-f.phi); // value at theta = 0, for static attributes

const DEPTH = 0.62; // depth range is roughly [-DEPTH, DEPTH]
const depthTo = (lo, hi) => (f) => lin(f, lo + (hi - lo) / 2, (hi - lo) / (2 * DEPTH));

const proj = nodes.map((n) => project(n.p));

// ---------- themes ----------
const THEMES = {
  dark: {
    bg: "#0b0f14", grid: "#12202a", text: "#E6FDFF", muted: "#8aa3ad", accent: "#22D3EE", faint: "#36515c",
    levels: ["#1d4150", "#0e7490", "#06b6d4", "#22D3EE", "#cffafe"], edge: "#22D3EE", pulse: "#e6fdff", glow: "#22D3EE",
  },
  light: {
    bg: "#f5fafc", grid: "#e1eef2", text: "#0b2a33", muted: "#4f6b75", accent: "#0891b2", faint: "#a9c6cf",
    levels: ["#b9dbe3", "#67c3d6", "#0ea5c6", "#0e7490", "#083c4a"], edge: "#0e7490", pulse: "#0891b2", glow: "#22D3EE",
  },
};

const fmtN = (n) => n.toLocaleString("en-US");
const fmtDay = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function render(theme) {
  const t = THEMES[theme];
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="A rotating brain of ${days.length} neurons, one per day of Shagun Choudhary's last year on GitHub. Brighter neurons are days with more contributions.">`);
  out.push(`<title>Shagun Choudhary: ${fmtN(gh.total)} contributions in the last year, drawn as a brain</title>`);
  out.push(`<style>
    .sans{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
    .mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace}
    .caret{animation:blink 1s steps(1) infinite}
    @keyframes blink{50%{opacity:0}}
    .type{animation:type 2.6s steps(44) .4s both}
    @keyframes type{from{width:0}to{width:560px}}
    .orbit{transform-origin:${CX}px ${CY + 196}px;animation:spin 24s linear infinite}
    .orbit2{transform-origin:${CX}px ${CY + 196}px;animation:spin 36s linear infinite reverse}
    @keyframes spin{to{transform:rotate(360deg)}}
    .scan{animation:scan 7s ease-in-out infinite}
    @keyframes scan{0%{transform:translateY(-40px);opacity:0}15%{opacity:.5}85%{opacity:.5}100%{transform:translateY(${H - 40}px);opacity:0}}
    .fade{animation:fade 1.4s ease-out both}
    @keyframes fade{from{opacity:0;transform:translateY(8px)}}
  </style>`);
  out.push(`<defs>
    <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="${t.grid}"/></pattern>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${t.glow}" stop-opacity="${theme === "dark" ? 0.16 : 0.12}"/><stop offset="1" stop-color="${t.glow}" stop-opacity="0"/></radialGradient>
    <radialGradient id="scanG" cx="50%" cy="100%" r="50%" gradientTransform="translate(0 .5) scale(1 .5) translate(0 -.5)"><stop offset="0" stop-color="${t.accent}" stop-opacity=".28"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></radialGradient>
    <linearGradient id="scanL"><stop offset="0" stop-color="${t.accent}" stop-opacity="0"/><stop offset=".5" stop-color="${t.accent}" stop-opacity=".7"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <clipPath id="typeClip"><rect class="type" x="56" y="150" width="560" height="30"/></clipPath>
  </defs>`);
  out.push(`<rect width="${W}" height="${H}" rx="18" fill="${t.bg}"/><rect width="${W}" height="${H}" rx="18" fill="url(#dots)"/>`);
  out.push(`<ellipse cx="${CX}" cy="${CY}" rx="330" ry="250" fill="url(#halo)"/>`);
  // floor rings
  out.push(`<g fill="none" stroke="${t.accent}"><ellipse class="orbit" cx="${CX}" cy="${CY + 196}" rx="250" ry="34" stroke-opacity=".35" stroke-dasharray="2 10"/><ellipse class="orbit2" cx="${CX}" cy="${CY + 196}" rx="300" ry="44" stroke-opacity=".18" stroke-dasharray="40 14 4 14"/></g>`);

  // synapses
  out.push(`<g stroke="${t.edge}" stroke-width=".8" stroke-opacity="${theme === "dark" ? 0.22 : 0.28}" fill="none">`);
  for (const [i, j] of edges) {
    const a = proj[i], b = proj[j];
    out.push(`<line x1="${r1(at0(a.X))}" y1="${r1(at0(a.Y))}" x2="${r1(at0(b.X))}" y2="${r1(at0(b.Y))}">${anim("x1", a.X)}${anim("y1", a.Y)}${anim("x2", b.X)}${anim("y2", b.Y)}</line>`);
  }
  out.push(`</g>`);

  // neurons
  out.push(`<g>`);
  nodes.forEach((n, i) => {
    const P = proj[i];
    const level = n.day ? n.day.level : 0;
    const base = n.day ? 1.5 + level * 0.85 : 1.3;
    const color = n.day ? t.levels[level] : t.faint;
    const op = depthTo(0.18, 1)(P.D);
    out.push(`<circle cx="${r1(at0(P.X))}" cy="${r1(at0(P.Y))}" r="${r1(base)}" fill="${color}">${anim("cx", P.X)}${anim("cy", P.Y)}${anim("opacity", op, 2)}</circle>`);
  });
  out.push(`</g>`);

  // signals: random walks along synapses, a dash running down each hop in turn
  const adj = nodes.map(() => []);
  edges.forEach(([i, j]) => { adj[i].push(j); adj[j].push(i); });
  const walk = rng(77);
  out.push(`<g stroke="${t.pulse}" stroke-width="2.2" stroke-linecap="round" fill="none" filter="url(#glow)">`);
  const HOP = 0.32, CHAIN = 7, PERIOD = 6.4;
  for (let c = 0; c < 18; c++) {
    let cur = Math.floor(walk() * dayPts.length), prev = -1;
    const start = walk() * PERIOD;
    for (let h = 0; h < CHAIN; h++) {
      const opts = adj[cur].filter((j) => j !== prev);
      if (!opts.length) break;
      const nxt = opts[Math.floor(walk() * opts.length)];
      const a = proj[cur], b = proj[nxt];
      const t0 = (h * HOP) / PERIOD, t1 = ((h + 1) * HOP) / PERIOD;
      out.push(`<line x1="${r1(at0(a.X))}" y1="${r1(at0(a.Y))}" x2="${r1(at0(b.X))}" y2="${r1(at0(b.Y))}" pathLength="100" stroke-dasharray="16 400" stroke-dashoffset="16">${anim("x1", a.X)}${anim("y1", a.Y)}${anim("x2", b.X)}${anim("y2", b.Y)}<animate attributeName="stroke-dashoffset" values="16;16;-100;-100" keyTimes="0;${r2(t0)};${r2(t1)};1" dur="${PERIOD}s" begin="${r2(-start)}s" repeatCount="indefinite"/></line>`);
      prev = cur; cur = nxt;
    }
  }
  out.push(`</g>`);

  // today + busiest day markers ride along with their neurons
  const marker = (idx, label, delay) => {
    const P = proj[idx];
    const op = depthTo(0.25, 1)(P.D);
    const lx = lin(P.X, 14, 1), ly = lin(P.Y, -12, 1);
    return `<g>${anim("opacity", op, 2)}<circle r="4" fill="none" stroke="${t.accent}" stroke-width="1.5" cx="${r1(at0(P.X))}" cy="${r1(at0(P.Y))}">${anim("cx", P.X)}${anim("cy", P.Y)}<animate attributeName="r" values="4;16" dur="2.4s" begin="${delay}s" repeatCount="indefinite"/><animate attributeName="stroke-opacity" values="1;0" dur="2.4s" begin="${delay}s" repeatCount="indefinite"/></circle><text class="mono" font-size="12" fill="${t.text}" x="${r1(at0(lx))}" y="${r1(at0(ly))}">${anim("x", lx)}${anim("y", ly)}${esc(label)}</text></g>`;
  };
  const busiestIdx = days.findIndex((d) => d.date === gh.busiest.date);
  out.push(marker(days.length - 1, "today", 0));
  if (busiestIdx >= 0 && busiestIdx !== days.length - 1) out.push(marker(busiestIdx, `${fmtDay(gh.busiest.date)} · ${gh.busiest.count}`, -1.2));

  // scan line
  out.push(`<g class="scan"><rect x="${CX - 300}" y="0" width="600" height="40" fill="url(#scanG)"/><line x1="${CX - 260}" x2="${CX + 260}" y1="40" y2="40" stroke="url(#scanL)" stroke-width="1"/></g>`);

  // HUD: left column
  out.push(`<g class="fade">
    <text class="mono" x="56" y="64" font-size="13" letter-spacing="3" fill="${t.accent}">NEURAL MAP · LAST ${days.length} DAYS</text>
    <text class="sans" x="54" y="116" font-size="46" font-weight="800" letter-spacing="1" fill="${t.text}">Shagun Choudhary</text>
    <g clip-path="url(#typeClip)"><text class="mono" x="56" y="172" font-size="19" fill="${t.muted}">Founder · Proxsoft &amp; Shary Holdings</text></g>
    <text class="sans" x="56" y="208" font-size="19" fill="${t.text}">I build agent systems that run real work.</text>
  </g>`);
  const stats = [
    [fmtN(gh.total), "contributions in the last year"],
    [String(gh.streak.longest), "day longest streak"],
    [String(gh.streak.current), "day current streak"],
    [String(gh.busiest.count), `on my busiest day, ${fmtDay(gh.busiest.date)}`],
  ];
  stats.forEach(([v, l], i) => {
    const y = 270 + i * 46;
    out.push(`<g class="fade" style="animation-delay:${0.5 + i * 0.18}s"><text class="mono" x="56" y="${y}" font-size="30" font-weight="700" fill="${t.accent}">${esc(v)}</text><text class="mono" x="${56 + 18.2 * v.length + 14}" y="${y}" font-size="15" fill="${t.muted}">${esc(l)}</text></g>`);
  });
  // legend
  const ly = 486;
  out.push(`<g class="mono" font-size="12" fill="${t.muted}"><text x="56" y="${ly}">1 neuron = 1 day</text>`);
  t.levels.forEach((c, i) => out.push(`<circle cx="${190 + i * 22}" cy="${ly - 4}" r="${1.5 + i * 0.85}" fill="${c}"/>`));
  out.push(`<text x="${190 + 5 * 22}" y="${ly}">more commits</text>`);
  out.push(`<text x="56" y="${ly + 22}">back of the brain = a year ago · front = today</text></g>`);
  out.push(`<text class="mono" x="${W - 28}" y="${H - 22}" font-size="11" text-anchor="end" fill="${t.muted}">regenerated daily from GitHub · ${live.generatedAt.slice(0, 10)}</text>`);
  out.push(`</svg>`);
  return out.join("\n");
}

for (const theme of ["dark", "light"]) {
  const svg = render(theme);
  await writeFile(`assets/brain-${theme}.svg`, svg + "\n");
  console.log(`brain-${theme}.svg ${(svg.length / 1024).toFixed(0)} KB, ${nodes.length} neurons, ${edges.length} synapses`);
}
