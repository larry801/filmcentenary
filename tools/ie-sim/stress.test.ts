/**
 * Long, mixed sweep: campaign + limited-war + Great War, several seeds each,
 * with the random pending-choice mode on half of them so decisions the bot
 * always answers the same way also get explored.
 */
import {runSeededGame, SimResult} from "./harness";

jest.setTimeout(1800000);

const seeds = (process.env.IE_SEEDS ?? "X-1,X-2,X-3,X-4").split(",");

const mulberry = (seed: number) => () => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

test("mixed stress sweep", () => {
  const results: SimResult[] = [];
  let i = 0;
  for (const seed of seeds) {
    i += 1;
    const chaos = i % 2 === 0;
    const configs = [
      {name: `${seed}`, opts: {war: true}},
      {name: `${seed}-gw`, opts: {greatWar: true, aggressive: true, war: false}},
    ];
    for (const config of configs) {
      results.push(runSeededGame({
        seed: config.name,
        maxSteps: 20000,
        ...config.opts,
        ...(chaos ? {chaos: 0.5, rng: mulberry(i * 7919 + seed.length)} : {}),
      }));
    }
  }
  for (const r of results) {
    console.log(`${r.seed}: steps=${r.steps} turn=${r.turn} phase=${r.phase} finished=${r.finished} reason=${r.result?.reason ?? null}`);
    for (const issue of r.issues.slice(0, 6)) {
      console.log(`   ${issue.kind} step=${issue.step} t${issue.turn} ${issue.phase} ${issue.power ?? "-"} ${issue.move ?? ""} ${JSON.stringify(issue.args ?? [])}: ${issue.detail.slice(0, 350)}`);
    }
  }
  const issues = results.flatMap((r) => r.issues);
  expect(issues).toEqual([]);
  expect(results.filter((r) => !r.finished).map((r) => r.seed)).toEqual([]);
});
