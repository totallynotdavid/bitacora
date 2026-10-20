import { describe, expect, it } from "vitest";
import tokens from "../src/web/styles/tokens.css?raw";

/** The WCAG contrast of two colors, computed from the token file itself. */

type Color = { l: number; c: number; h: number; alpha: number };
type Theme = "light" | "dark";

const HUE = 255;
const declarations = new Map<string, string>();
for (const match of tokens.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
  declarations.set(match[1]!, match[2]!.replace(/\s+/g, " ").trim());
}

/** Splits at commas that are not inside parentheses. */
function splitArguments(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of text) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current.trim());
  return parts;
}

/** A number inside oklch(): a literal, `var(--hue)` or `calc(var(--hue) + n)`. */
function number(text: string): number {
  if (text === "var(--hue)") return HUE;
  const calc = text.match(/^calc\(var\(--hue\) ([+-]) (\d+)\)$/);
  if (calc) return HUE + (calc[1] === "-" ? -1 : 1) * Number(calc[2]);
  return Number(text);
}

function resolve(value: string, theme: Theme): Color {
  const lightDark = value.match(/^light-dark\((.*)\)$/);
  if (lightDark) return resolve(splitArguments(lightDark[1]!)[theme === "light" ? 0 : 1]!, theme);

  const reference = value.match(/^var\((--[\w-]+)\)$/);
  if (reference) {
    const target = declarations.get(reference[1]!);
    if (!target) throw new Error(`${reference[1]} is not declared`);
    return resolve(target, theme);
  }

  const relative = value.match(/^oklch\(from (.+) l c h \/ ([\d.]+)\)$/);
  if (relative) return { ...resolve(relative[1]!, theme), alpha: Number(relative[2]) };

  const literal = value.match(/^oklch\((\S+) (\S+) (calc\(.*?\)|\S+)(?: \/ ([\d.]+))?\)$/);
  if (literal) {
    return {
      l: Number(literal[1]),
      c: Number(literal[2]),
      h: number(literal[3]!),
      alpha: literal[4] ? Number(literal[4]) : 1,
    };
  }
  throw new Error(`cannot read ${value}`);
}

const channel = (value: number) => Math.min(1, Math.max(0, value));

/** Relative luminance, from OKLCH through linear sRGB. */
function luminance({ l, c, h }: Color): number {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l3 = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m3 = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s3 = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = channel(4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3);
  const g = channel(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3);
  const blue = channel(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3);
  return 0.2126 * r + 0.7152 * g + 0.0722 * blue;
}

function contrast(foreground: string, background: string, theme: Theme): number {
  const front = resolve(`var(${foreground})`, theme);
  const back = resolve(`var(${background})`, theme);
  const frontLuminance = luminance(front) * front.alpha + luminance(back) * (1 - front.alpha);
  const [lighter, darker] = [frontLuminance, luminance(back)].toSorted((x, y) => y - x);
  return (lighter! + 0.05) / (darker! + 0.05);
}

/** Text needs 4.5:1. The edge of a control, a focus ring and a solid fill need 3:1. */
const TEXT = 4.5;
const GRAPHIC = 3;

const SURFACES = ["--list", "--card", "--card-hover", "--overlay", "--field-background"];
const LABELS = ["green", "yellow", "orange", "red", "purple", "blue"];

const pairs: [foreground: string, background: string, minimum: number][] = [];
for (const surface of ["--board", ...SURFACES]) {
  pairs.push(["--text", surface, TEXT], ["--text-muted", surface, TEXT]);
  pairs.push(["--border-control", surface, GRAPHIC], ["--focus", surface, GRAPHIC]);
}
for (const surface of SURFACES) {
  pairs.push(
    ["--text-accent", surface, TEXT],
    ["--text-danger", surface, TEXT],
    ["--text-success", surface, TEXT],
  );
}
for (const fill of ["--accent", "--accent-hover", "--danger", "--danger-hover"]) {
  pairs.push(["--text-on-solid", fill, TEXT]);
}
pairs.push(["--text-accent", "--accent-wash", TEXT], ["--text-danger", "--danger-wash", TEXT]);
pairs.push(["--inverse-text", "--inverse", TEXT]);
for (const surface of ["--list", "--card", "--overlay"]) {
  pairs.push(["--accent", surface, GRAPHIC], ["--success", surface, GRAPHIC]);
}
for (const color of LABELS) {
  pairs.push([`--label-${color}-text`, `--label-${color}-bg`, TEXT]);
  for (const surface of ["--list", "--card"]) pairs.push([`--label-${color}-bg`, surface, GRAPHIC]);
}

describe.each<Theme>(["light", "dark"])("contrast in the %s theme", (theme) => {
  it.each(pairs)("%s on %s is at least %d:1", (foreground, background, minimum) => {
    expect(contrast(foreground, background, theme)).toBeGreaterThanOrEqual(minimum);
  });
});
