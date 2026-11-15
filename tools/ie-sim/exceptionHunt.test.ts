/**
 * Hunt for engine exceptions across a wide seed sweep.
 *
 * The batch report deduplicates by message; this keeps the *first stack frame
 * inside src/imperialElegy* so a failure points at the exact line.  Everything
 * that is not an exception (refused moves, stalls) is ignored here — those have
 * their own suites.
 */
import {runSeededGame, SimResult} from "./harness";

jest.setTimeout(3600000);

const COUNT = Number(process.env.IE_HUNT ?? 3);

const MODES: {name: string; opts: Parameters<typeof runSeededGame>[0]}[] = [
  {name: "campaign", opts: {maxSteps: 20000} as never},
  {name: "war", opts: {maxSteps: 20000, war: true} as never},
  {name: "navy", opts: {maxSteps: 20000, navy: true, war: true} as never},
  {name: "amphibious", opts: {maxSteps: 20000, navy: true, war: true, amphibious: true} as never},
  {name: "greatWar", opts: {maxSteps: 20000, greatWar: true, aggressive: true} as never},
  {name: "chaos", opts: {maxSteps: 20000, war: true, chaos: 0.5, rng: () => Math.random()} as never},
];

/** First stack frame that lives in the engine, so the report names a real line. */
const engineFrame = (detail: string): string => {
  const lines = detail.split("\n");
  const frame = lines.find((line) => line.includes("src/imperialElegy"));
  return (frame ?? lines[0] ?? "").trim();
};

test("no engine exception across a wide sweep", () => {
  const crashes = new Map<string, {seeds: Set<string>; first: {seed: string; step: number; move?: string}}>();
  let games = 0;

  for (let i = 0; i < COUNT; i += 1) {
    for (const mode of MODES) {
      games += 1;
      const seed = `HUNT-${i}-${mode.name}`;
      const result: SimResult = runSeededGame({seed, ...mode.opts});
      for (const issue of result.issues) {
        if (issue.kind !== "exception") continue;
        const key = `${issue.move ?? "-"} | ${engineFrame(issue.detail)}`;
        const entry = crashes.get(key) ?? {seeds: new Set(), first: {seed, step: issue.step, move: issue.move}};
        entry.seeds.add(seed);
        crashes.set(key, entry);
      }
    }
  }

  console.log(`ran ${games} games`);
  if (crashes.size === 0) {
    console.log("no engine exception");
  } else {
    for (const [key, entry] of crashes) {
      console.log(`\n  [${entry.seeds.size} seed(s)] ${key}`);
      console.log(`    first: ${entry.first.seed} step=${entry.first.step}`);
    }
  }
  expect([...crashes.keys()]).toEqual([]);
});
