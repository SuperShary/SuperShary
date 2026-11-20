// Generates the data profile card (assets/data-{dark,light}.svg) from pulled data only.
import { readFile, writeFile } from "node:fs/promises";

const live = JSON.parse(await readFile("data/live.json", "utf8"));
const projects = JSON.parse(await readFile("data/projects.json", "utf8"));
const gh = live.github;

const THEMES = {
  dark: { bg: "#0b0f14", panel: "#0f161d", line: "#1c2a33", text: "#E6FDFF", muted: "#8aa3ad", accent: "#22D3EE", dim: "#0e7490", soft: "#123842" },
  light: { bg: "#f5fafc", panel: "#ffffff", line: "#d5e6eb", text: "#0b2a33", muted: "#4f6b75", accent: "#0891b2", dim: "#67c3d6", soft: "#dff3f8" },
};
const LANG_COLORS = { TypeScript: "#3178c6", JavaScript: "#f1e05a", Python: "#3572A5", HTML: "#e34c26", CSS: "#8a6bd1", Shell: "#89e051", PowerShell: "#5391FE", Swift: "#F05138", "Jupyter Notebook": "#DA5B0B", QML: "#44a51c" };
const SANS = `-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;
const MONO = `ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace`;
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const n = (v) => (v == null ? "n/a" : v.toLocaleString("en-US"));
const compact = (v) => (v == null ? "n/a" : v >= 1e6 ? (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : v >= 1e4 ? Math.round(v / 1e3) + "K" : v.toLocaleString("en-US"));
const day = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const style = (t) => `<style>
  .s{font-family:${SANS}} .m{font-family:${MONO}}
  .grow{transform-box:fill-box;transform-origin:bottom;animation:grow 1.1s cubic-bezier(.2,.8,.2,1) both}
  @keyframes grow{from{transform:scaleY(0)}}
  .wide{transform-box:fill-box;transform-origin:left;animation:wide 1.2s cubic-bezier(.2,.8,.2,1) both}
  @keyframes wide{from{transform:scaleX(0)}}
  .in{animation:in .9s ease-out both} @keyframes in{from{opacity:0;transform:translateY(6px)}}
  .edge{stroke-dasharray:120 1400;animation:edge 6s linear infinite} @keyframes edge{to{stroke-dashoffset:-1520}}
  .live{animation:pulse 2s ease-in-out infinite} @keyframes pulse{50%{opacity:.25}}
</style>`;

// ---------------- data profile card ----------------
function dataCard(theme) {
  const t = THEMES[theme];
  const W = 1200, H = 470;
  const o = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Data profile: ${n(gh.total)} contributions in the last year, ${gh.streak.longest} day longest streak, YouTube and repository numbers.">`);
  o.push(style(t));
  o.push(`<rect width="${W}" height="${H}" rx="18" fill="${t.bg}"/><rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="18" fill="none" stroke="${t.line}"/>`);
  o.push(`<rect class="edge" x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="18" fill="none" stroke="${t.accent}" stroke-width="1.5"/>`);
  o.push(`<text class="m" x="40" y="48" font-size="13" letter-spacing="3" fill="${t.accent}">DATA PROFILE</text>`);
  o.push(`<circle class="live" cx="${W - 196}" cy="44" r="4" fill="${t.accent}"/><text class="m" x="${W - 40}" y="48" font-size="12" text-anchor="end" fill="${t.muted}">pulled ${live.generatedAt.slice(0, 10)}</text>`);

  // panel 1: contributions by month
  const px = 40, py = 76, pw = 540, ph = 176;
  o.push(`<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="12" fill="${t.panel}" stroke="${t.line}"/>`);
  o.push(`<text class="m" x="${px + 20}" y="${py + 30}" font-size="12" fill="${t.muted}">CONTRIBUTIONS BY MONTH</text>`);
  o.push(`<text class="s" x="${px + pw - 20}" y="${py + 32}" font-size="22" font-weight="700" text-anchor="end" fill="${t.text}">${n(gh.total)}</text>`);
  const months = gh.months.slice(-13);
  const maxM = Math.max(...months.map((m) => m.count), 1);
  const bw = (pw - 40) / months.length;
  months.forEach((m, i) => {
    const h = Math.max(2, (m.count / maxM) * 92);
    const x = px + 20 + i * bw;
    const y = py + 140 - h;
    const top = m.count === maxM;
    o.push(`<rect class="grow" style="animation-delay:${(i * 0.05).toFixed(2)}s" x="${(x + 4).toFixed(1)}" y="${y.toFixed(1)}" width="${(bw - 8).toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${top ? t.accent : t.dim}"/>`);
    if (top) o.push(`<text class="m in" x="${(x + bw / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" font-size="11" text-anchor="middle" fill="${t.text}">${m.count}</text>`);
    const label = new Date(m.month + "-01T00:00:00Z").toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
    o.push(`<text class="m" x="${(x + bw / 2).toFixed(1)}" y="${py + 160}" font-size="10" text-anchor="middle" fill="${t.muted}">${label}</text>`);
  });

  // panel 2: rhythm (weekday) + streaks
  const qx = 600, qw = 560;
  o.push(`<rect x="${qx}" y="${py}" width="${qw}" height="${ph}" rx="12" fill="${t.panel}" stroke="${t.line}"/>`);
  o.push(`<text class="m" x="${qx + 20}" y="${py + 30}" font-size="12" fill="${t.muted}">WEEKLY RHYTHM</text>`);
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const maxW = Math.max(...gh.weekday, 1);
  gh.weekday.forEach((v, i) => {
    const x = qx + 20 + i * 38, h = Math.max(2, (v / maxW) * 92), y = py + 140 - h;
    o.push(`<rect class="grow" style="animation-delay:${(0.3 + i * 0.05).toFixed(2)}s" x="${x}" y="${y.toFixed(1)}" width="26" height="${h.toFixed(1)}" rx="3" fill="${v === maxW ? t.accent : t.dim}"/>`);
    o.push(`<text class="m" x="${x + 13}" y="${py + 160}" font-size="10" text-anchor="middle" fill="${t.muted}">${names[i]}</text>`);
  });
  const stat = (x, y, v, l) => `<g class="in"><text class="s" x="${x}" y="${y}" font-size="30" font-weight="700" fill="${t.accent}">${esc(v)}</text><text class="m" x="${x}" y="${y + 20}" font-size="11" fill="${t.muted}">${esc(l)}</text></g>`;
  o.push(stat(qx + 300, py + 72, gh.streak.longest, "longest streak"));
  o.push(stat(qx + 430, py + 72, gh.streak.current, "current streak"));
  o.push(stat(qx + 300, py + 136, gh.busiest.count, `best day ${day(gh.busiest.date).slice(0, -5)}`));
  o.push(stat(qx + 430, py + 136, (gh.total / gh.days.length).toFixed(1), "average a day"));

  // panel 3: languages (each public repo counts once)
  const ry = 268, rh = 170;
  o.push(`<rect x="${px}" y="${ry}" width="${pw}" height="${rh}" rx="12" fill="${t.panel}" stroke="${t.line}"/>`);
  o.push(`<text class="m" x="${px + 20}" y="${ry + 30}" font-size="12" fill="${t.muted}">LANGUAGES ACROSS ${gh.publicRepos} PUBLIC REPOS</text>`);
  const langs = gh.languages.slice(0, 6);
  const total = gh.languages.reduce((s, l) => s + l.repos, 0);
  let lx = px + 20;
  const barW = pw - 40;
  o.push(`<g class="wide">`);
  langs.forEach((l) => {
    const w = (l.repos / total) * barW;
    o.push(`<rect x="${lx.toFixed(1)}" y="${ry + 48}" width="${Math.max(w - 2, 1).toFixed(1)}" height="12" rx="3" fill="${LANG_COLORS[l.name] || t.dim}"/>`);
    lx += w;
  });
  o.push(`</g>`);
  langs.forEach((l, i) => {
    const x = px + 20 + (i % 3) * 172, y = ry + 92 + Math.floor(i / 3) * 34;
    o.push(`<circle cx="${x + 5}" cy="${y - 4}" r="5" fill="${LANG_COLORS[l.name] || t.dim}"/><text class="s" x="${x + 16}" y="${y}" font-size="14" fill="${t.text}">${esc(l.name)}</text><text class="m" x="${x + 16}" y="${y + 15}" font-size="10" fill="${t.muted}">${((l.repos / total) * 100).toFixed(0)}%</text>`);
  });

  // panel 4: reach (YouTube + GitHub)
  o.push(`<rect x="${qx}" y="${ry}" width="${qw}" height="${rh}" rx="12" fill="${t.panel}" stroke="${t.line}"/>`);
  o.push(`<text class="m" x="${qx + 20}" y="${ry + 30}" font-size="12" fill="${t.muted}">REACH</text>`);
  live.youtube.forEach((c, i) => {
    const y = ry + 66 + i * 46;
    const name = projects.channels.find((p) => p.handle === c.handle)?.name || c.title;
    o.push(`<g class="in" style="animation-delay:${0.3 + i * 0.15}s"><text class="s" x="${qx + 20}" y="${y}" font-size="15" font-weight="600" fill="${t.text}">${esc(name)}</text><text class="m" x="${qx + 20}" y="${y + 17}" font-size="10" fill="${t.muted}">youtube.com/@${esc(c.handle)}</text>`);
    [[compact(c.subscribers), "subs"], [compact(c.videos), "videos"], [compact(c.views), "views"]].forEach(([v, l], k) => {
      o.push(`<text class="s" x="${qx + 290 + k * 92}" y="${y + 4}" font-size="20" font-weight="700" fill="${t.accent}">${v}</text><text class="m" x="${qx + 290 + k * 92}" y="${y + 18}" font-size="10" fill="${t.muted}">${l}</text>`);
    });
    o.push(`</g>`);
  });
  const gy = ry + 150;
  o.push(`<text class="m" x="${qx + 20}" y="${gy}" font-size="11" fill="${t.muted}">GitHub · <tspan fill="${t.text}">${gh.publicRepos}</tspan> public repos · <tspan fill="${t.text}">${gh.stars}</tspan> stars · <tspan fill="${t.text}">${gh.followers}</tspan> followers · since ${gh.memberSince.slice(0, 4)}</text>`);
  o.push(`</svg>`);
  return o.join("\n");
}

for (const theme of ["dark", "light"]) await writeFile(`assets/data-${theme}.svg`, dataCard(theme) + "\n");
console.log("data card: dark + light");
