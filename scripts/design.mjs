// Shared look for the generated profile sections: the same identity as the
// portfolio (off-white on near-black, one amber accent), plus a light variant.
import { readFileSync } from "node:fs";

export const THEMES = {
  dark: { bg: "#07070a", panel: "#0e0e12", line: "#24232a", text: "#f5f2ea", muted: "#a8a49b", faint: "#6f6c66", accent: "#e9b44c", accentInk: "#1a1306", glow: "#e9b44c" },
  light: { bg: "#f5f2ea", panel: "#fffdf8", line: "#e0dacb", text: "#0b0a09", muted: "#5b5750", faint: "#8d887e", accent: "#9a6408", accentInk: "#fffdf8", glow: "#e9b44c" },
};
export const SANS = `-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',system-ui,Roboto,'Helvetica Neue',Arial,sans-serif`;
export const MONO = `ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace`;
export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Rough advance width of sans text: wide enough that real fonts fit inside it.
const W = (ch) => (/[mwMW@]/.test(ch) ? 0.86 : /[A-Z0-9]/.test(ch) ? 0.66 : /[il.,:;'|!]/.test(ch) ? 0.3 : ch === " " ? 0.3 : 0.55);
export const textWidth = (s, size) => [...s].reduce((a, c) => a + W(c), 0) * size;

// Wraps to a width and FAILS (never truncates) when the text needs more lines.
export function wrap(text, size, width, maxLines, where) {
  const lines = [""];
  for (const word of text.split(" ")) {
    const next = (lines.at(-1) + " " + word).trim();
    if (textWidth(next, size) > width && lines.at(-1)) lines.push(word);
    else lines[lines.length - 1] = next;
  }
  if (lines.length > maxLines) throw new Error(`${where}: "${text}" needs ${lines.length} lines at ${size}px, room for ${maxLines}`);
  return lines;
}
export function fits(text, size, width, where) {
  if (textWidth(text, size) > width) throw new Error(`${where}: "${text}" is wider than ${width}`);
  return text;
}

export const dataUri = (path) => {
  const ext = path.split(".").pop();
  const mime = { webp: "image/webp", jpg: "image/jpeg", png: "image/png" }[ext];
  return `data:${mime};base64,${readFileSync(path).toString("base64")}`;
};
