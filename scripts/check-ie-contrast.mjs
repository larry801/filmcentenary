#!/usr/bin/env node
/**
 * WCAG 2.1 contrast gate for the Imperial Elegy visual system.
 *
 *   node scripts/check-ie-contrast.mjs          # pass/fail
 *   node scripts/check-ie-contrast.mjs --table  # also print the computed matrix
 *
 * Values are computed from src/imperialElegy/design/tokens.json — never typed
 * by hand.  Contract: docs/imperial-elegy/VISUAL_SYSTEM.md §4.5, §14.1.
 */
import {readFileSync, readdirSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tokens = JSON.parse(
  readFileSync(resolve(root, "src/imperialElegy/design/tokens.json"), "utf8"),
);

const hex = (value) => {
  const m = /^#([0-9a-f]{6})$/i.exec(value);
  if (!m) throw new Error(`Not a six-digit hex colour: ${value}`);
  return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
};

const channel = (v) =>
  v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;

const luminance = (value) => {
  const [r, g, b] = hex(value).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const c = tokens.color;
const failures = [];
const rows = [];

const check = (label, fg, bg, min) => {
  const value = ratio(fg, bg);
  rows.push(`${label}: ${value.toFixed(2)} (min ${min})`);
  if (value < min) failures.push(`${label} = ${value.toFixed(2)} < ${min}`);
};

const note = (label, fg, bg) => {
  rows.push(`${label}: ${ratio(fg, bg).toFixed(2)} (recorded, not used as text)`);
};

// Text on the three dark surfaces.
for (const surface of ["table", "panel", "panel-2", "panel-3"]) {
  for (const text of [
    "on-dark",
    "on-dark-2",
    "on-dark-muted",
    "brass-soft",
    "overprint-text-dark",
    "ok-text-dark",
    "warn-text-dark",
    "danger-text-dark",
  ]) {
    check(`${text} on ${surface}`, c[text], c[surface], 4.5);
  }
}

// Text on paper.  The pairs the document forbids as text are not checked here;
// they are listed in FORBIDDEN below with their measured value.
check("ink on paper", c.ink, c.paper, 4.5);
check("ink-2 on paper", c["ink-2"], c.paper, 4.5);
check("ink-2 on paper-2", c["ink-2"], c["paper-2"], 4.5);
check("ink-muted on paper", c["ink-muted"], c.paper, 4.5);
check("brass-ink on paper", c["brass-ink"], c.paper, 4.5);
check("brass-ink on paper-2", c["brass-ink"], c["paper-2"], 4.5);
check("focus-paper on paper", c["focus-paper"], c.paper, 4.5);
check("overprint text on paper", c.overprint, c.paper, 4.5);
check("overprint text on paper-2", c.overprint, c["paper-2"], 4.5);
check("ok-text-paper on paper", c["ok-text-paper"], c.paper, 4.5);
check("warn-text-paper on paper", c["warn-text-paper"], c.paper, 4.5);
check("danger-text-paper on paper", c["danger-text-paper"], c.paper, 4.5);

// Non-text boundaries, focus indicators and large text: 3:1.
check("rule-strong on table", c["rule-strong"], c.table, 3);
check("rule-strong on panel", c["rule-strong"], c.panel, 3);
check("rule-strong on panel-2", c["rule-strong"], c["panel-2"], 3);
check("brass-deep on panel", c["brass-deep"], c.panel, 3);
check("brass on table (fill)", c.brass, c.table, 3);
check("overprint-border-dark on panel", c["overprint-border-dark"], c.panel, 3);
check("overprint-border-dark on table", c["overprint-border-dark"], c.table, 3);
check("focus-dark on table", c["focus-dark"], c.table, 3);
check("focus-paper on paper (ring)", c["focus-paper"], c.paper, 3);
check("paper-rule on paper", c["paper-rule"], c.paper, 3);
check("move-ink on paper", c["move-ink"], c.paper, 3);
check("move-ink-on-dark on panel", c["move-ink-on-dark"], c.panel, 4.5);
check("move-ink-on-dark on panel-2", c["move-ink-on-dark"], c["panel-2"], 4.5);
check("paper on overprint (danger label)", c.paper, c.overprint, 4.5);

// Power colours: fills are data; labels and text variants must pass.
for (const [power, values] of Object.entries(tokens.power)) {
  const name = power.toUpperCase();
  check(`${name} on-dark text on panel`, values.onDark, c.panel, 4.5);
  check(`${name} on-paper text on paper`, values.onPaper, c.paper, 4.5);
  if (values.onFill) {
    check(`${name} label on fill`, values.onFill, values.fill, 4.5);
  }
}

// Documented prohibited pairs.  They must stay distinguishable as *states*
// (the rule is "do not use as text"), and the numbers are printed for review.
note("brass text on paper (prohibited)", c.brass, c.paper);
note("on-dark on brass (prohibited)", c["on-dark"], c.brass);
note("ink-muted on paper-3 (not text)", c["ink-muted"], c["paper-3"]);
note("overprint text on paper-3 (not text)", c.overprint, c["paper-3"]);

// Declared prohibited *usages*, checked against the component CSS: brass as
// text (it is a fill/keyline) and status fills as text (use -text-dark/paper).
const stylesDir = resolve(root, "src/imperialElegy/components/styles");
const textViolations = [];
for (const file of readdirSync(stylesDir).filter((name) => name.endsWith(".css"))) {
  const css = readFileSync(join(stylesDir, file), "utf8");
  const pattern = /(^|[;{\s])color:\s*var\(--ie-(brass|ok|warn|danger)\)/g;
  for (const match of css.matchAll(pattern)) {
    const line = css.slice(0, match.index).split("\n").length;
    textViolations.push(`${file}:${line} uses --ie-${match[2]} as text`);
  }
}
if (textViolations.length) {
  console.error("Forbidden Imperial Elegy text colours:");
  for (const violation of textViolations) console.error(`  - ${violation}`);
  process.exit(1);
}

if (process.argv.includes("--table")) {
  console.log(rows.join("\n"));
}

if (failures.length) {
  console.error("Imperial Elegy contrast failures:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`Imperial Elegy contrast: ${rows.length} pairs checked, all pass.`);
