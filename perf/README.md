# Performance harness

Benchmarks and equivalence checks used while optimising the board for large
(late game) states. They are kept out of the normal `yarn test` run
(`jest.config.js` ignores `perf/`) and have their own config.

## Running

```shell
npx jest --config perf/jest.config.js                 # everything
npx jest --config perf/jest.config.js perf/count.test.tsx
NODE_ENV=production npx jest --config perf/jest.config.js perf/client-render.test.tsx
```

The DOM benchmarks (`client-render`, `html-dump`) need jsdom, which is not a
project dependency:

```shell
npm i --no-save jsdom@24.1.3
```

Without it `html-dump` skips itself; `client-render` fails to import.

## What each file does

| file | what it measures |
| --- | --- |
| `bench.test.ts` | plays a seeded 400 move game through the real engine and prints a SHA1 of the final state (use it to prove a change does not alter game logic) |
| `player-view.test.ts` | `playerView` and the hot helper functions vs. reference implementations of the previous code, plus timings |
| `count.test.tsx` | how many times each helper is called per board render (server render) |
| `render.test.tsx` | server render cost of the board for early/late states |
| `client-render.test.tsx` | jsdom client benchmark: mount + state update time and DOM churn per update |
| `html-dump.test.tsx` | writes board/dialog HTML to `perf/out/` so two revisions can be diffed byte for byte |
| `late-state.ts` | builds a plausible era-3 "late game" state from a real fresh state |
| `profile-summary.js` | summarises a V8 `--cpu-prof` profile |

## Comparing two revisions

```shell
HTML_OUT=/tmp/before.html npx jest --config perf/jest.config.js perf/html-dump.test.tsx
git stash push -- src/
HTML_OUT=/tmp/after.html  npx jest --config perf/jest.config.js perf/html-dump.test.tsx
git stash pop
cmp /tmp/before.html /tmp/after.html
```

```shell
NODE_OPTIONS="--cpu-prof --cpu-prof-dir=/tmp/prof" NODE_ENV=production \
  npx jest --config perf/jest.config.js perf/client-render.test.tsx --runInBand
node perf/profile-summary.js /tmp/prof/*.cpuprofile src/
```

Debug logging (off by default, see `src/game/logger.ts`) is enabled with
`FILM_DEBUG=1` for the node side and `localStorage.filmDebug = '1'` in the browser.
