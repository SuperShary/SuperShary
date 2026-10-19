// Pulls every number the profile shows into data/live.json.
// GitHub: GraphQL contribution calendar + public repos. YouTube: Data API when
// YOUTUBE_API_KEY is set, otherwise the channel's public About page.
import { readFile, writeFile } from "node:fs/promises";

const USER = process.env.PROFILE_USER || "SuperShary";
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (!TOKEN) throw new Error("GITHUB_TOKEN is required");

async function gql(query, variables) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { authorization: `bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data;
}

async function rest(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { authorization: `bearer ${TOKEN}`, accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

const LEVEL = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

async function github() {
  const data = await gql(
    `query($login: String!) {
      user(login: $login) {
        createdAt
        followers { totalCount }
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks { contributionDays { date contributionCount contributionLevel } }
          }
        }
      }
    }`,
    { login: USER },
  );
  const cal = data.user.contributionsCollection.contributionCalendar;
  const days = cal.weeks
    .flatMap((w) => w.contributionDays)
    .map((d) => ({ date: d.date, count: d.contributionCount, level: LEVEL[d.contributionLevel] ?? 0 }));

  // Streaks. Today with no contributions yet does not break the current streak.
  let longest = 0, run = 0;
  for (const d of days) { run = d.count > 0 ? run + 1 : 0; longest = Math.max(longest, run); }
  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) current++;
    else if (i === days.length - 1) continue;
    else break;
  }
  const busiest = days.reduce((a, b) => (b.count > a.count ? b : a), days[0]);
  const weekday = [0, 0, 0, 0, 0, 0, 0];
  for (const d of days) weekday[new Date(d.date + "T00:00:00Z").getUTCDay()] += d.count;
  const months = {};
  for (const d of days) months[d.date.slice(0, 7)] = (months[d.date.slice(0, 7)] || 0) + d.count;

  // Public repositories only: this is what a visitor can open.
  const repos = (await rest(`/users/${USER}/repos?per_page=100&type=owner`)).filter((r) => !r.fork && !r.private);
  const languages = {};
  for (const r of repos) {
    if (r.name === USER) continue;
    // Each repo counts once, split by its own language mix, so one repo with a
    // committed virtualenv cannot outweigh the rest.
    const langs = await rest(`/repos/${USER}/${r.name}/languages`);
    const sum = Object.values(langs).reduce((a, b) => a + b, 0);
    for (const [k, v] of Object.entries(langs)) languages[k] = (languages[k] || 0) + v / sum;
  }
  return {
    total: cal.totalContributions,
    days,
    streak: { current, longest },
    busiest,
    weekday,
    months: Object.entries(months).map(([month, count]) => ({ month, count })),
    followers: data.user.followers.totalCount,
    memberSince: data.user.createdAt.slice(0, 10),
    publicRepos: repos.length,
    stars: repos.reduce((s, r) => s + r.stargazers_count, 0),
    languages: Object.entries(languages).sort((a, b) => b[1] - a[1]).map(([name, repos]) => ({ name, repos: +repos.toFixed(2) })),
    repos: Object.fromEntries(repos.map((r) => [r.name, {
      stars: r.stargazers_count, language: r.language, pushedAt: r.pushed_at.slice(0, 10),
      description: r.description, homepage: r.homepage, topics: r.topics || [],
    }])),
  };
}

function parseCount(text) {
  const m = String(text).replace(/,/g, "").match(/([\d.]+)\s*([KMB])?/i);
  if (!m) return null;
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] || "").toUpperCase()] || 1;
  return Math.round(parseFloat(m[1]) * mult);
}

async function youtubeChannel(handle) {
  const key = process.env.YOUTUBE_API_KEY;
  if (key) {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&forHandle=${handle}&key=${key}`;
    const item = (await (await fetch(url)).json()).items?.[0];
    if (item) {
      return {
        handle, title: item.snippet.title, source: "api",
        subscribers: +item.statistics.subscriberCount, videos: +item.statistics.videoCount, views: +item.statistics.viewCount,
      };
    }
  }
  const html = await (await fetch(`https://www.youtube.com/@${handle}/about`, {
    headers: { "user-agent": "Mozilla/5.0", "accept-language": "en" },
  })).text();
  const pick = (k) => html.match(new RegExp(`"${k}":"([^"]*)"`))?.[1];
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1]?.replace(/ - YouTube$/, "");
  return {
    handle, title, source: "public-page",
    subscribers: parseCount(pick("subscriberCountText")),
    videos: parseCount(pick("videoCountText")),
    views: parseCount(pick("viewCountText")),
  };
}

const projects = JSON.parse(await readFile("data/projects.json", "utf8"));
const previous = JSON.parse(await readFile("data/live.json", "utf8").catch(() => "{}"));
const youtube = [];
for (const ch of projects.channels) {
  try {
    const c = await youtubeChannel(ch.handle);
    // A failed scrape keeps yesterday's pulled numbers instead of writing blanks.
    const old = previous.youtube?.find((o) => o.handle === ch.handle);
    youtube.push(c.subscribers == null && old ? old : c);
  } catch (e) {
    console.warn(`youtube ${ch.handle}: ${e.message}`);
    const old = previous.youtube?.find((o) => o.handle === ch.handle);
    if (old) youtube.push(old);
  }
}

const live = { generatedAt: new Date().toISOString(), user: USER, github: await github(), youtube };
await writeFile("data/live.json", JSON.stringify(live, null, 1) + "\n");
console.log(`live.json: ${live.github.total} contributions, ${live.github.days.length} days, ${youtube.length} channels`);
