/**
 * The zh_CN board must never print an English sentence the engine built.
 *
 * Two channels carry engine-owned English into the board:
 *
 *   1. a pending decision's `prompt`.  The board prints `promptZh` when the
 *      engine supplied one, else looks the prompt up in `PROMPT_ZH`, else
 *      prints the English.  A fixed prompt therefore has to be in that table.
 *   2. a decision's `reasons` list (and the refusal lines the log stores).
 *      `engineReasonText` translates them on the display side.
 *
 * Both tables are keyed by hand, so a new prompt or refusal can silently
 * reintroduce English.  This suite reads the engine sources and fails on any
 * fixed prompt that is in neither place and on any English refusal sentence
 * that `engineReasonText` leaves as it is.
 */
import fs from "fs";
import path from "path";
import * as ts from "typescript";
import {PROMPT_ZH} from "./boardHelpers";
import {engineReasonText} from "./reasonText";

const ROOT = path.join(__dirname, "..");

/** Every engine source that builds a decision or a log line. */
const engineSources = (): string[] => {
  const engineDir = path.join(ROOT, "engine");
  const files = fs.readdirSync(engineDir)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .map((file) => path.join(engineDir, file));
  files.push(path.join(ROOT, "moves.ts"));
  return files;
};

const parse = (file: string): ts.SourceFile =>
  ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

const walk = (node: ts.Node, visit: (node: ts.Node) => void): void => {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
};

const undefinedLike = (node: ts.Expression | undefined): boolean =>
  node === undefined || (ts.isIdentifier(node) && node.text === "undefined") ||
  node.kind === ts.SyntaxKind.NullKeyword;

/** A full sentence a player could read, as opposed to an internal reason code. */
const isSentence = (text: string): boolean => /^[A-Z0-9]/.test(text) && /\s/.test(text);

describe("engine-built English cannot reach the zh_CN board", () => {
  test("every fixed decision prompt has a Chinese rendering", () => {
    const fixed: Array<{file: string; line: number; prompt: string}> = [];
    const missing: string[] = [];
    for (const file of engineSources()) {
      const source = parse(file);
      walk(source, (node) => {
        if (!ts.isCallExpression(node)) return;
        if (!/(^|\.)decision$/.test(node.expression.getText())) return;
        const promptArg = node.arguments[2];
        if (promptArg === undefined || !ts.isStringLiteral(promptArg)) return;
        const prompt = promptArg.text;
        fixed.push({file: path.basename(file), line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, prompt});
        // The seventh argument is `promptZh`; `undefined` means the board falls
        // back to PROMPT_ZH.
        const hasZh = node.arguments.length >= 7 && !undefinedLike(node.arguments[6]);
        if (hasZh) return;
        if (PROMPT_ZH[prompt] === undefined) {
          missing.push(`${path.basename(file)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1} ${prompt}`);
        }
      });
    }
    expect(fixed.length).toBeGreaterThan(60);
    expect(missing).toEqual([]);
  });

  test("every English refusal sentence has a Chinese rendering", () => {
    const sentences: Array<{where: string; text: string}> = [];
    for (const file of engineSources()) {
      const source = parse(file);
      const where = path.basename(file);
      const lineOf = (node: ts.Node): number => source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      walk(source, (node) => {
        // {reasons: "…"} / {reason: "…"}
        if (ts.isPropertyAssignment(node) && ["reasons", "reason"].includes(node.name.getText())) {
          if (ts.isStringLiteral(node.initializer) && isSentence(node.initializer.text)) {
            sentences.push({where: `${where}:${lineOf(node)}`, text: node.initializer.text});
          }
        }
        // reasons.push("…")
        if (ts.isCallExpression(node) && /(^|\.)reasons\.push$/.test(node.expression.getText())) {
          const arg = node.arguments[0];
          if (arg !== undefined && ts.isStringLiteral(arg) && isSentence(arg.text)) {
            sentences.push({where: `${where}:${lineOf(node)}`, text: arg.text});
          }
        }
      });
    }
    expect(sentences.length).toBeGreaterThan(80);
    const untranslated = sentences
      .filter(({text}) => engineReasonText("zh_CN", text) === text)
      .map(({where, text}) => `${where} ${text}`);
    expect(untranslated).toEqual([]);
  });
});
