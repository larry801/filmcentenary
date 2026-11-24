import {readdirSync, readFileSync} from "node:fs";
import {join} from "node:path";

/**
 * The seeded self-play layer only works if the reducer is a pure function of
 * (state, move, RNG stream).  `Math.random()` inside engine code silently
 * breaks that contract: the same seed produces different games, a failure
 * found in CI cannot be reproduced locally, and `shrinkFailure` cannot replay
 * the failing prefix.  That is exactly how `VQ-SIM-3-c4` passed locally and
 * crashed remotely.
 *
 * Rule 14's "roll randomly to see who suffers any odd loss" is a *game* roll,
 * so it belongs on `ctx.random` (boardgame.io's replayable stream), not on the
 * process RNG.  This guard keeps the invariant cheap and mechanical.
 */
const ENGINE_DIR = join(__dirname);

/** Files allowed to touch the process RNG, with the reason they may. */
const ALLOWED = new Set([
    // The documented fallback when a move is invoked with no boardgame.io `Ctx`
    // (unit tests and setup helpers).  Every real move path passes ctx.
    "util.ts",
]);

const offenders: string[] = [];

for (const entry of readdirSync(ENGINE_DIR)) {
    if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) continue;
    if (ALLOWED.has(entry)) continue;
    const source = readFileSync(join(ENGINE_DIR, entry), "utf8");
    if (/Math\.random\s*\(/.test(source)) offenders.push(entry);
}

test("engine code never draws from the process RNG", () => {
    expect(offenders).toEqual([]);
});

test("util.ts only uses Math.random as the no-Ctx fallback", () => {
    const source = readFileSync(join(ENGINE_DIR, "util.ts"), "utf8");
    // Count only real code: comment lines mention `Math.random()` by name, and
    // the guard is about calls, not prose.
    const lines = source.split("\n")
        .filter((line) => !line.trimStart().startsWith("//") && !line.trimStart().startsWith("*"))
        .filter((line) => /Math\.random\s*\(\s*\)/.test(line));
    // Exactly one use, inside `die`, behind the `ctx.random?.Die` fallback.
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("ctx.random?.Die");
});
