/**
 * Scratch full-campaign audit (untracked QA probe).
 *
 * Runs the real boardgame.io reducer with the Rule 34 bot for every seat over a
 * whole campaign, and after every dispatched move checks a list of printed-rule
 * invariants, so a violation is reported together with the move that produced it.
 */
import {Ctx} from "boardgame.io";
import {CreateGameReducer, InitializeGame, ProcessGameConfig} from "boardgame.io/internal";
import {ImperialElegyGameDef} from "../../src/imperialElegy/game";
import {redactForView} from "../../src/imperialElegy/engine/privacy";
import {botDecision} from "../../src/imperialElegy/engine/bot";
import {actingSeatFor} from "./harness";
import {ImperialElegyState, POWERS, Power} from "../../src/imperialElegy/types";
import {ensureStateDefaults} from "../../src/imperialElegy/engine/migrations";
import {SPACES, isNavalBox} from "../../src/imperialElegy/constant/spaces";
import {landStackingLimit, landUnitsIn, navalUnitsIn} from "../../src/imperialElegy/engine/rules";
import {cardById} from "../../src/imperialElegy/engine/deck";

type Finding = {rule: string; detail: string; step: number; move: string; args: unknown[]; power: Power | null; turn: number};

const findings: Finding[] = [];
const seen = new Set<string>();

const record = (f: Finding) => {
  const key = `${f.rule}|${f.detail}`;
  if (seen.has(key)) return;
  seen.add(key);
  findings.push(f);
};

const audit = (
  G: ImperialElegyState,
  step: number,
  move: string,
  args: unknown[],
  power: Power | null,
): void => {
  const turn = G.turn;
  // 12.1 fort construction: a fort belongs where its owner controls the space.
  for (const [space, s] of Object.entries(G.spaces)) {
    const fort = s.fort;
    if (!fort) continue;
    const ownUnits = Object.values(G.units).some((u) => u.space === space && u.owner === fort.power);
    if (s.control !== fort.power && !ownUnits) {
      record({rule: "12.1 fort placement", detail: `${fort.power} fort in ${space} (control ${s.control ?? "none"}, no ${fort.power} unit)`, step, move, args, power, turn});
    }
  }
  // 5.5 stacking
  for (const [space, s] of Object.entries(G.spaces)) {
    if (isNavalBox(space)) {
      continue;
    }
    const armies = landUnitsIn(G, space).filter((u) => u.kind === "army" || u.kind === "reserveArmy" || u.kind === "minorArmy" || u.kind === "italianArmy" || u.kind === "usArmy" || u.kind === "rebelArmy");
    const owners = new Set(armies.map((u) => u.owner));
    for (const owner of owners) {
      const mine = armies.filter((u) => u.owner === owner).length;
      const limit = landStackingLimit(space);
      if (mine > limit) {
        record({rule: "5.5 stacking", detail: `${owner} has ${mine} armies in ${space} (limit ${limit})`, step, move, args, power, turn});
      }
    }
    void s;
  }
  // 5.5.4 port capacity
  for (const [space, s] of Object.entries(G.spaces)) {
    if (!s.port) continue;
    const ships = navalUnitsIn(G, space).length;
    if (ships > 4) record({rule: "5.5.4 port capacity", detail: `${space} holds ${ships} naval units`, step, move, args, power, turn});
  }
  // 12.5.1 influence needs an uncontrolled land space
  for (const [space, s] of Object.entries(G.spaces)) {
    if (isNavalBox(space)) continue;
    if (typeof s.influence !== "string") continue;
    const control = s.control;
    if (control === "GE" || control === "UK" || control === "FR" || control === "AU" || control === "RU" || control === "OT") {
      record({rule: "12.5.1 influence", detail: `${s.influence} influence marker in player-controlled ${space} (control ${control})`, step, move, args, power, turn});
    }
  }
  // 8.4 three-player alliance maximum
  const columns = new Map<string, Set<Power>>();
  for (const p of POWERS) {
    const alliance = G.powers[p].alliance;
    if (!alliance || alliance === "neutral") continue;
    const set = columns.get(alliance) ?? new Set<Power>();
    set.add(p);
    columns.set(alliance, set);
  }
  for (const [alliance, members] of columns) {
    if (members.size > 3) record({rule: "8.4 alliance cap", detail: `${alliance} holds ${[...members].join(",")}`, step, move, args, power, turn});
  }
  // 4.2 fort limit
  for (const p of POWERS) {
    const forts = Object.values(G.spaces).filter((s) => s.fort?.power === p).length;
    if (forts > 3) record({rule: "4.2/12.1 fort limit", detail: `${p} owns ${forts} forts`, step, move, args, power, turn});
  }
  // 19.5/12.x: a declared war must respect world tension
  if (G.wtt > 6) record({rule: "wtt range", detail: `WTT ${G.wtt}`, step, move, args, power, turn});
  // 12.0: the impulse's CP must not exceed the played card's printed CP
  if (G.cpRemaining > 0 && G.impulseCard) {
    const card = cardById(G.impulseCard);
    if (G.cpRemaining > card.cp) {
      record({rule: "12.0 CP budget", detail: `${G.cpRemaining} CP left from ${G.impulseCard} (printed ${card.cp})`, step, move, args, power, turn});
    }
  }
};

const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const playFullGame = (seed: string) => {
  const game = ProcessGameConfig({...ImperialElegyGameDef, seed} as any);
  const reducer = CreateGameReducer({game, isClient: false});
  let state: any = InitializeGame({game, numPlayers: 6});
  const rng = mulberry32(0x51ed);
  const views = new Map<string, ImperialElegyState>();
  let steps = 0;
  let lastPhase = "";
  const phases = new Set<string>();
  while (!state.ctx.gameover && steps < 30000) {
    const G = state.G as ImperialElegyState;
    phases.add(`${G.phase}|t${G.turn}`);
    lastPhase = `${G.phase} t${G.turn}`;
    const seat = actingSeatFor(G, state.ctx, views);
    if (seat === null) break;
    const power = POWERS[Number(seat)] ?? null;
    const view = G;
    void views;
    let decision: {move: string; args: unknown[]};
    if (G.pending) {
      const opts = view.pending?.options ?? G.pending.options;
      const pick = opts.length > 1 && rng() < 0.3 ? opts[Math.floor(rng() * opts.length)] : opts[0];
      decision = pick ? {move: "resolvePending", args: [pick.id]} : {move: "declinePending", args: []};
    } else if (power) {
      const botMove = botDecision(view, state.ctx, power);
      decision = {move: botMove.move, args: botMove.args};
    } else {
      decision = {move: "pass", args: []};
    }
    audit(G, steps, decision.move, decision.args, power);
    const next = reducer(state, {type: "MAKE_MOVE", payload: {type: decision.move, args: decision.args, playerID: seat}});
    if (next.transients?.error) {
      audit(G, steps, `REFUSED:${decision.move}`, decision.args, power);
      const fallback = G.pending ? {move: "declinePending", args: []} : {move: G.phase === "action" ? "pass" : "endPhaseTurn", args: []};
      const retry = reducer(state, {type: "MAKE_MOVE", payload: {type: fallback.move, args: fallback.args, playerID: seat}});
      if (retry.transients?.error) break;
      state = retry;
      views.clear();
    } else {
      state = next;
      views.clear();
    }
    steps += 1;
  }
  return {steps, turn: (state.G as ImperialElegyState).turn, phase: (state.G as ImperialElegyState).phase, gameover: state.ctx.gameover, phases};
};

test("full campaign audit", () => {
  const runs = [];
  for (const seed of ["QA-A"]) {
    const r = playFullGame(seed);
    runs.push({seed, steps: r.steps, turn: r.turn, phase: r.phase, over: Boolean(r.gameover), phases: r.phases.size});
    console.log(seed, JSON.stringify({steps: r.steps, turn: r.turn, phase: r.phase, over: Boolean(r.gameover), phases: r.phases.size}));
  }
  console.log("RUNS", JSON.stringify(runs));
  console.log("FINDINGS", findings.length);
  console.log(JSON.stringify(findings.slice(0, 25), null, 1));
}, 1800000);
