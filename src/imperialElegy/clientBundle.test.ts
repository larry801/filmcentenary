/**
 * The hotseat (`/localIE`) and solo shells run the engine **in the browser**:
 * `Local()` creates the match client-side, so `setup`, every move and every
 * hook execute as the bundled ES module.  A CommonJS `require(...)` there is
 * not defined at runtime, and it fails at the moment the code runs — after the
 * bundle was built and the tests passed, because Jest runs CommonJS where
 * `require` exists.
 *
 * Two live cases were found this way:
 *
 *  - `engine/setup.ts` loaded `beginScenarioGw` through `require`, so *every*
 *    Great War scenario (the historical tutorial and Alternate GW 1-3) died on
 *    "connecting" in a hotseat or solo match while the campaign worked.
 *  - `virginQueen/moves.ts` re-required `MINOR_REGULAR_LIMITS`, which it had
 *    already imported, so recruiting a regular in an allied minor's home threw.
 *
 * This guard is deliberately mechanical: it reads the source of every module
 * the browser can reach and refuses a bare `require(` call.  `x.require(` is
 * allowed (the accessor forms in `src/game/*Storage` are server-only helpers).
 */
import {readdirSync, readFileSync, statSync} from "node:fs";
import {join, relative} from "node:path";

const SRC = join(__dirname, "..");

/** Directories and files whose code never runs in a browser. */
const SERVER_ONLY = new Set([
    // The Node match store reaches node-persist/Postgres through accessors.
    "game/matchStorage.ts",
    "game/serverStatsStorage.ts",
    "game/ieBotDriver.ts",
]);

// A CommonJS load always names a module string; prose such as "require (rule
// 4.2)" in a scenario note must not trip the guard.
const bareRequire = /(^|[^.\w$])require\(\s*['"`]/;

const walk = (dir: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(dir).sort()) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path, out);
        else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) out.push(path);
    }
    return out;
};

const offenders: string[] = [];

for (const path of walk(SRC)) {
    const rel = relative(SRC, path).replaceAll("\\", "/");
    if (rel.endsWith(".test.ts") || rel.endsWith(".test.tsx")) continue;
    if (SERVER_ONLY.has(rel)) continue;
    const source = readFileSync(path, "utf8");
    for (const [index, line] of source.split("\n").entries()) {
        // Comments may name the call (this guard's own explanation does), and a
        // line whose code was already stripped is not a call site.
        const code = line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
        if (code.trimStart().startsWith("*")) continue;
        if (!bareRequire.test(code)) continue;
        offenders.push(`${rel}:${index + 1}: ${line.trim()}`);
    }
}

test("no browser-reachable module calls CommonJS require", () => {
    expect(offenders).toEqual([]);
});
