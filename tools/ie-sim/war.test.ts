import {runSeededGame} from "./harness";

jest.setTimeout(1800000);

const seeds = (process.env.IE_SEEDS ?? "W-1,W-2,W-3").split(",");

test("limited-war sweep", () => {
  const results = seeds.map((seed) => runSeededGame({seed, maxSteps: 20000, war: true}));
  for (const r of results) {
    console.log(`${r.seed}: steps=${r.steps} turn=${r.turn} phase=${r.phase} finished=${r.finished} reason=${r.result?.reason ?? null}`);
    for (const issue of r.issues.slice(0, 8)) {
      console.log(`   ${issue.kind} step=${issue.step} t${issue.turn} ${issue.phase} ${issue.power ?? "-"} ${issue.move ?? ""} ${JSON.stringify(issue.args ?? [])}: ${issue.detail.slice(0, 400)}`);
    }
  }
  const issues = results.flatMap((r) => r.issues);
  expect(issues).toEqual([]);
});
