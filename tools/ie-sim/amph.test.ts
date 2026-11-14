/**
 * Amphibious sweep (19.10).
 *
 * Each action phase stages two armies plus an escort in a naval box next to an
 * enemy port, then plays the real landing: an unopposed occupation, or a land
 * battle with the printed -1 amphibious DRM when the port is held.
 *
 * The assertion is deliberately about *deadlocks*: the harness may name a naval
 * move whose port stopped being friendly between choosing it and dispatching
 * it (a legal engine refusal, recorded once and never retried), but it must
 * never spin, never break an invariant, and always finish the game.
 */
import {runSeededGame, SimResult} from "./harness";

jest.setTimeout(1800000);

const seeds = (process.env.IE_SEEDS ?? "A-1,A-2,A-3").split(",");

const STALL_KINDS = new Set(["stall", "invariant", "exception", "unfinished"]);

test("amphibious sweep", () => {
  const results: SimResult[] = seeds.map((seed) =>
    runSeededGame({seed, maxSteps: 20000, navy: true, war: true, amphibious: true}));
  for (const r of results) {
    console.log(`${r.seed}: steps=${r.steps} turn=${r.turn} phase=${r.phase} finished=${r.finished} reason=${r.result?.reason ?? null}`);
    for (const issue of r.issues.slice(0, 8)) {
      console.log(`   ${issue.kind} step=${issue.step} t${issue.turn} ${issue.phase} ${issue.power ?? "-"} ${issue.move ?? ""}: ${issue.detail.slice(0, 300)}`);
    }
  }
  const fatal = results.flatMap((r) => r.issues.filter((issue) => STALL_KINDS.has(issue.kind)));
  expect(fatal).toEqual([]);
  expect(results.filter((r) => !r.finished).map((r) => r.seed)).toEqual([]);
  // The landing itself must happen, or this suite proves nothing.
  const landings = results.reduce(
    (n, r) => n + r.events.filter((e) => e.move === "amphibiousAssault" && e.status === "ok").length,
    0,
  );
  expect(landings).toBeGreaterThan(0);
});
