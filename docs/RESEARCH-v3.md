# Profile README v3: research notes (19 Oct 2026)

Goal: a profile that does not look like the standard badge + stats-card template.

## What GitHub actually renders

- README images go through GitHub's image proxy (camo). No JavaScript runs, ever.
- An SVG loaded through `<img>` keeps its own animation: CSS `@keyframes` inside a `<style>` block, and SMIL (`<animate>`, `<animateTransform>`). The image plays from the moment it loads.
- Filters (`feGaussianBlur` glow), gradients, masks and `pathLength` work inside the image.
- Web fonts do not load inside an image SVG. Use a system font stack.
- `<picture>` with `prefers-color-scheme` sources gives a dark/light pair.
- An image cannot link per region. One `<a>` wraps one image, so a clickable grid = one image per card.
- GitHub Actions can regenerate images on a schedule and commit them back. That is how every "live" profile works.

## Ten reference points (most-starred or most-shared)

| # | Project | Stars (topic page, 19 Oct) | Technique |
|---|---|---|---|
| 1 | abhisheknaiidu/awesome-github-profile-readme | 31.4k | Curated gallery; the source most profiles copy from, hence the sameness. |
| 2 | Platane/snk | 6.1k | Action reads the contribution calendar and writes an SVG where the snake path is CSS keyframes. |
| 3 | ryo-ma/github-profile-trophy | 6.7k | Server-rendered static SVG trophies. |
| 4 | vn7n24fzkq/github-profile-summary-cards | 3.7k | Action writes static SVG summary cards. |
| 5 | yoshi389111/github-profile-3d-contrib | 1.8k | Action draws the calendar as an isometric 3D city, SVG with CSS animation. |
| 6 | czl9707/gh-space-shooter | 927 | Contribution graph rendered as a game, animated SVG/GIF. |
| 7 | x0rzavi/github-readme-terminal | 767 | Pre-rendered retro terminal GIF. |
| 8 | DenverCoder1/readme-typing-svg | (service) | Server returns an SVG with CSS keyframes that fake typing. |
| 9 | kyechan99/capsule-render | (service) | Waving header and footer SVGs. |
| 10 | lowlighter/metrics | (Action) | 30+ plugins, writes one large SVG of stats. |

Also seen in 2025-26 posts: GitWorld (contributions as an animated city), YourTomo (a pixel pet driven by activity), galaxy banners, pac-man graphs.

## What makes them all look alike

Everyone uses the same five services (typing SVG, capsule header, readme-stats, streak, skill icons) with the same defaults. The ones people remember have one custom generated visual that is about the person.

## Decision for v3

1. **Hero: our own generator.** A brain made of 365 neurons, one per day of the last year. Brightness = that day's contributions; back of the brain = a year ago, front = today. It rotates in 3D and signals travel along the synapses.
   - Technique: every projected coordinate under a rotation about the vertical axis is a sinusoid, so each one is a 3-keyframe SMIL `<animate>` with sine easing and a phase offset. The SVG stays small (no per-frame flipbook), and motion is smooth at any frame rate.
   - Pulses: `stroke-dashoffset` on lines with `pathLength="100"`, so a pulse travels the edge whatever its projected length.
2. **Data profile: our own card**, generated from pulled numbers only (GitHub GraphQL, public repo API, public YouTube pages or the Data API when a key is set as an Actions secret).
3. **Projects grid: our own cards**, one image per project wrapped in its link, with live stars and language.
4. Keep the cyan snake and the 3D calendar (already in the repo's Actions).
5. One Action regenerates everything daily and on demand.
