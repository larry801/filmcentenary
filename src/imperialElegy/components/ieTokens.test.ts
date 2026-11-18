import {readFileSync, readdirSync} from "node:fs";
import {join} from "node:path";
import tokens from "../design/tokens.json";
import {IE_COLORS, IE_THEME_TOKENS} from "./ie-theme";

const stylesDir = join(__dirname, "styles");
const readStyle = (file: string) => readFileSync(join(stylesDir, file), "utf8");
const layerFiles = readdirSync(stylesDir)
  .filter((file) => file.endsWith(".css") && !file.startsWith("00-"))
  .sort();

/** The names and values the generator must have emitted, from tokens.json. */
function expectedTokens(): [string, string][] {
  const out: [string, string][] = [];
  const add = (name: string, value: string) => out.push([`--ie-${name}`, value]);

  for (const [key, value] of Object.entries(tokens.color)) add(key, value);

  for (const [power, values] of Object.entries(tokens.power)) {
    const v = values as Record<string, string | undefined>;
    add(`power-${power}`, v.fill as string);
    add(`power-${power}-on-dark`, v.onDark as string);
    add(`power-${power}-on-paper`, v.onPaper as string);
    if (v.onFill) add(`power-${power}-on-fill`, v.onFill);
    if (v.edge) add(`power-${power}-edge`, v.edge);
  }

  add("font-display", tokens.font.family.display);
  add("font-ui", tokens.font.family.ui);
  add("font-data", "var(--ie-font-ui)");
  for (const [key, value] of Object.entries(tokens.font.size)) {
    add(`font-${key}`, value.size);
    add(`font-${key}-line`, value.line);
    add(`font-${key}-weight`, String(value.weight));
  }
  for (const [key, value] of Object.entries(tokens.space)) add(`space-${key}`, value);
  for (const [key, value] of Object.entries(tokens.radius)) add(`radius-${key}`, value);
  for (const [key, value] of Object.entries(tokens.shadow)) add(`shadow-${key}`, value);
  add("motion-press", tokens.motion.press);
  add("motion-pop", tokens.motion.pop);
  add("motion-sheet", tokens.motion.sheet);
  add("motion-easing-pop", tokens.motion["easing-pop"]);
  add("motion-easing-sheet", tokens.motion["easing-sheet"]);
  return out;
}

describe("Imperial Elegy tokens", () => {
  it("generates every token from tokens.json with the authored value", () => {
    const css = readStyle("00-tokens.generated.css");
    const root = css.slice(css.indexOf(":root {"), css.indexOf('[data-locale="zh_CN"]'));
    const emitted = [...root.matchAll(/(--ie-[a-z0-9-]+):\s*([^;]+);/g)].map(
      (match) => [match[1], match[2].trim()] as [string, string],
    );
    expect(emitted).toEqual(expectedTokens());
  });

  it("keeps IE_THEME_TOKENS in exact step with the generated properties", () => {
    const css = readStyle("00-tokens.generated.css");
    const root = css.slice(css.indexOf(":root {"), css.indexOf('[data-locale="zh_CN"]'));
    const emitted = [...root.matchAll(/(--ie-[a-z0-9-]+):/g)].map((m) => m[1]);
    expect(IE_THEME_TOKENS).toEqual(emitted);
  });

  it("keeps the MUI palette equal to the token source", () => {
    expect(IE_COLORS.table).toBe(tokens.color.table);
    expect(IE_COLORS.panel).toBe(tokens.color.panel);
    expect(IE_COLORS.panel2).toBe(tokens.color["panel-2"]);
    expect(IE_COLORS.paper).toBe(tokens.color.paper);
    expect(IE_COLORS.ink).toBe(tokens.color.ink);
    expect(IE_COLORS.brass).toBe(tokens.color.brass);
    expect(IE_COLORS.brassSoft).toBe(tokens.color["brass-soft"]);
    expect(IE_COLORS.overprint).toBe(tokens.color.overprint);
    expect(IE_COLORS.focusDark).toBe(tokens.color["focus-dark"]);
  });

  it("has no raw hex colours in component stylesheets", () => {
    for (const file of layerFiles) {
      const hits = readStyle(file).match(/#[0-9a-f]{3,8}\b/gi) ?? [];
      expect({file, hits}).toEqual({file, hits: []});
    }
  });

  it("keeps every font size at the 12 px floor, except the rule reference", () => {
    for (const file of layerFiles) {
      const css = readStyle(file);
      const stack: string[] = [];
      for (const rawLine of css.split("\n")) {
        const line = rawLine.trim();
        if (line.endsWith("{")) {
          stack.push(line.slice(0, -1).trim());
          continue;
        }
        if (line === "}") {
          stack.pop();
          continue;
        }
        const match = /font-size:\s*(\d+)px/.exec(line);
        if (!match) continue;
        const isRuleRef = line.includes("ie-rule-ref") || stack.some((selector) => selector.includes("ie-rule-ref"));
        const minimum = isRuleRef ? 10 : 12;
        expect(Number(match[1])).toBeGreaterThanOrEqual(minimum);
      }
    }
  });

  it("uses no !important outside reduced-motion and forced-colours blocks", () => {
    for (const file of layerFiles) {
      const css = readStyle(file);
      const allowed: boolean[] = [];
      const stack: boolean[] = [];
      for (const rawLine of css.split("\n")) {
        const line = rawLine.trim();
        if (line.endsWith("{")) {
          const exempt =
            line.includes("prefers-reduced-motion") || line.includes("forced-colors");
          stack.push(exempt || stack[stack.length - 1] === true);
          continue;
        }
        if (line === "}") {
          stack.pop();
          continue;
        }
        if (line.includes("!important")) allowed.push(stack[stack.length - 1] === true);
      }
      expect({file, allowed}).toEqual({file, allowed: allowed.map(() => true)});
    }
  });

  it("removes pill radii from everything but pips and counters", () => {
    for (const file of layerFiles) {
      const css = readStyle(file);
      expect({file, pills: css.match(/border-radius:\s*999px/g) ?? []}).toEqual({
        file,
        pills: [],
      });
      const stack: string[] = [];
      for (const rawLine of css.split("\n")) {
        const line = rawLine.trim();
        if (line.endsWith("{")) {
          stack.push(line.slice(0, -1).trim());
          continue;
        }
        if (line === "}") {
          stack.pop();
          continue;
        }
        if (!/border-radius:\s*50%/.test(line)) continue;
        const selector = `${stack.join(" ")} ${line}`;
        expect({file, selector}).toEqual({
          file,
          selector: expect.stringMatching(/pip|counter|unit-token|key::before|glyph|roundel/),
        });
      }
    }
  });
});
