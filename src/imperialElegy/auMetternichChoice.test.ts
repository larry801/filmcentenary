/**
 * 33.4 Metternich's Legacy: "at the end of the diplomacy phase of turn 1 AU
 * gains an alliance with two minor powers of their choice that do not contain
 * an opponent's diplomacy marker."
 *
 * The live choice is a `metternich` pending decision answered by the AU seat;
 * when the board offers zero or exactly two candidates there is nothing to
 * choose and the deterministic candidate list is applied.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {metternichAllies} from "./engine/characteristics";
import {SPACES} from "./constant/spaces";
import {chooseHomeCard, endDiplomacy, finishPrep, resolvePending} from "./moves";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {Die: (_sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 3},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  } as unknown as Ctx;
};

const seat = (power: Power): string => String(POWERS.indexOf(power));
const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

/** Run the printed turn-1 prep + diplomacy phases up to the diplomacy close. */
const runDiplomacy = (G: ImperialElegyState): void => {
  for (const power of POWERS) finishPrep(G, makeCtx([3], seat(power)));
  for (const power of POWERS) {
    expect(chooseHomeCard(G, makeCtx([3], seat(power)), G.powers[power].homeCards[0])).toBeUndefined();
  }
};

describe("33.4 Metternich's Legacy", () => {
  test("the AU player chooses each of the two minor allies", () => {
    const G = fresh();
    runDiplomacy(G);

    expect(G.phase).toBe("action");
    expect(G.pending?.kind).toBe("metternich");
    expect(G.pending?.power).toBe("AU");
    const candidates = metternichAllies(G).candidates;
    expect(G.pending!.options.map((option) => option.id)).toEqual(candidates);
    // The second pick is not the deterministic "first two": pick the last two.
    const firstPick = candidates[candidates.length - 1];
    const secondPick = candidates[candidates.length - 2];

    // Only the AU seat may answer.
    expect(resolvePending(G, makeCtx([3], seat("GE")), firstPick)).toBe(INVALID_MOVE);
    expect(resolvePending(G, makeCtx([3], seat("AU")), firstPick)).toBeUndefined();
    expect(G.spaces[firstPick].ally).toBe("AU");
    // The second decision offers only the remaining candidates.
    expect(G.pending?.kind).toBe("metternich");
    expect(G.pending!.options.map((option) => option.id)).not.toContain(firstPick);
    expect(resolvePending(G, makeCtx([3], seat("AU")), secondPick)).toBeUndefined();

    expect(G.pending).toBeNull();
    expect(G.spaces[firstPick].ally).toBe("AU");
    expect(G.spaces[secondPick].ally).toBe("AU");
    expect(G.persistent.metternich).toBe(true);

    // No other minor gained an alliance from the deterministic first two.
    const allied = Object.values(SPACES)
      .filter((def) => G.spaces[def.id].ally === "AU" && def.minorHome)
      .map((def) => def.id);
    expect(allied.sort()).toEqual([firstPick, secondPick].sort());
  });

  test("negative: an opponent's diplomacy marker removes a candidate", () => {
    const G = fresh();
    const candidates = metternichAllies(G).candidates;
    const blocked = candidates[0];
    G.spaces[blocked].diplomacy = "GE";
    expect(metternichAllies(G).candidates).not.toContain(blocked);
  });

  test("with exactly two candidates there is no decision (nothing to choose)", () => {
    const G = fresh();
    // Block every candidate except two with an opponent's diplomacy marker.
    const candidates = metternichAllies(G).candidates;
    expect(candidates.length).toBeGreaterThan(2);
    for (const space of candidates.slice(2)) G.spaces[space].diplomacy = "GE";
    const remaining = candidates.slice(0, 2);

    for (const power of POWERS) finishPrep(G, makeCtx([3], seat(power)));
    for (const power of POWERS) {
      expect(chooseHomeCard(G, makeCtx([3], seat(power)), G.powers[power].homeCards[0])).toBeUndefined();
    }
    expect(G.pending).toBeNull();
    expect(G.persistent.metternich).toBe(true);
    expect(remaining.map((space) => G.spaces[space].ally)).toEqual(["AU", "AU"]);
    expect(G.phase).toBe("action");
  });

  test("declining the decision takes the deterministic first candidate", () => {
    const G = fresh();
    runDiplomacy(G);
    const first = G.pending!.options[0].id;
    // 12.0-style decline path: `declinePending` picks the printed fallback.
    expect(require("./moves").declinePending(G, makeCtx([3], seat("AU")))).toBeUndefined();
    expect(G.spaces[first].ally).toBe("AU");
    expect(G.pending?.kind).toBe("metternich");
  });

  test("the trigger stays tied to the end of the turn-1 diplomacy phase", () => {
    const G = fresh();
    G.persistent.metternich = true;
    G.phase = "diplomacy";
    for (const power of POWERS) G.powers[power].flags.homeChosen = true;
    // Already resolved: endDiplomacy goes straight to the action phase.
    expect(endDiplomacy(G, makeCtx([3], seat("GE")))).toBeUndefined();
    expect(G.phase).toBe("action");
    expect(G.pending).toBeNull();
  });
});
