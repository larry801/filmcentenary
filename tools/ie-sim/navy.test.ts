/**
 * Naval sweep: builds fleets, sails them, and fights 19.0 contact battles, so
 * the 19.1–19.9 path (avoid, interception, DRMs, dreadnought losses, retreat,
 * port forts) is exercised through the engine.
 */
import {runSeededGame, SimResult} from "./harness";

jest.setTimeout(1800000);

const seeds = (process.env.IE_SEEDS ?? "N-1,N-2,N-3").split(",");

test("naval sweep", () => {
  const results: SimResult[] = seeds.map((seed) =>
    runSeededGame({seed, maxSteps: 20000, navy: true, war: true}));
  for (const r of results) {
    console.log(`${r.seed}: steps=${r.steps} turn=${r.turn} phase=${r.phase} finished=${r.finished} reason=${r.result?.reason ?? null}`);
    for (const issue of r.issues.slice(0, 8)) {
      console.log(`   ${issue.kind} step=${issue.step} t${issue.turn} ${issue.phase} ${issue.power ?? "-"} ${issue.move ?? ""} ${JSON.stringify(issue.args ?? [])}: ${issue.detail.slice(0, 400)}`);
    }
  }
  const issues = results.flatMap((r) => r.issues);
  expect(issues).toEqual([]);
});
