/**
 * 33.2.2 India independence — treaty/event control guard.
 *
 * "India cannot be controlled by any player for the rest of the game."  The
 * move-layer markers (`placeInfluence`/`pacify`/`minorAlliance`) and the key
 * counters already ignore India; this suite covers the remaining treaty and
 * event paths that could write a control/influence/ally marker:
 *
 *  - treaty cession/realignment/liberation space lists never offer India;
 *  - a stale/forged `treatyChoice` naming India is rejected;
 *  - card/event `controlSpace`, `placeInfluence` and `minorAlliance` effects
 *    skip the write and log `indiaMarkerRejected`;
 *  - Bengal is a separate space and stays writable.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {applyIndiaIndependence, resolveEffects} from "./engine/effects";
import {classifyVictory, createWarState} from "./engine/limitedWar";
import {applyTreatyChoice, treatyOptionsFor, treatySpaceOptions} from "./engine/treatyChoice";
import {resolveWar} from "./moves";
import type {PendingDecision, WarState} from "./types";

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

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

/**
 * An independent India plus a legacy/forged UK control marker and a GE
 * occupation of the war objective.  Without the guard the treaty validator
 * would see the (illegal) control marker and consider a cession legal.
 */
const independentIndiaWar = (): {G: ImperialElegyState; war: WarState} => {
  const G = fresh();
  applyIndiaIndependence(G);
  G.spaces.india.control = "UK";
  G.spaces.india.occupiedBy = "GE";
  const war = createWarState(G, "GE", "UK", "conquest", ["india"], 2);
  G.war = war;
  return {G, war};
};

const logArgs = (G: ImperialElegyState, key: string) =>
  G.log.filter((entry) => entry.key === key).map((entry) => entry.args);

describe("33.2.2 independent India is never a treaty target", () => {
  test("treaty option generation skips India and its space list", () => {
    const {G, war} = independentIndiaWar();
    const victory = classifyVictory(G, war);
    expect(victory.victor).toBe("attacker");

    const entries = treatyOptionsFor(G, war, victory);
    expect(entries.some((entry) => entry.option === "territorialCession")).toBe(false);
    for (const entry of entries) expect(entry.spaces).not.toContain("india");
    expect(treatySpaceOptions(G, "territorialCession")).toEqual([]);
    // India is a printed colonial key, so the colonial-cession candidate list
    // would otherwise include it.
    expect(treatySpaceOptions(G, "colonialCession").map((option) => option.id)).not.toContain("india");
  });

  test("a direct resolveWar settlement skips an India cession and logs it", () => {
    const {G} = independentIndiaWar();
    const ctx = makeCtx([3], "0");
    expect(resolveWar(G, ctx, [{option: "territorialCession", spaces: ["india"], beneficiary: "GE"}])).toBeUndefined();

    expect(G.spaces.india.control).toBe("UK");
    expect(logArgs(G, "indiaMarkerRejected")).toEqual(
      expect.arrayContaining([expect.objectContaining({space: "india", marker: "control"})]),
    );
  });

  test("a stale/forged treaty cession into India is rejected without writing control", () => {
    const {G, war} = independentIndiaWar();
    const victory = classifyVictory(G, war);
    const pending = {
      id: "forged",
      kind: "treatyOption",
      power: "GE",
      prompt: "Choose a treaty option",
      options: [{
        id: "territorialCession",
        label: "Territorial Cession",
        data: {
          option: "territorialCession",
          choice: {option: "territorialCession", spaces: ["india"], beneficiary: "GE"},
        },
      }],
      context: {victory},
      createdAt: 1,
    } as unknown as PendingDecision;

    const result = applyTreatyChoice(G, pending, "territorialCession");
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(["independent-india"]);
    // The forged marker was not used and no GE control marker was written.
    expect(G.spaces.india.control).toBe("UK");
    expect(G.spaces.india.occupiedBy).toBe("GE");
  });
});

describe("33.2.2 event marker effects skip independent India", () => {
  test("controlSpace is skipped and logged", () => {
    const G = fresh();
    applyIndiaIndependence(G);
    G.spaces.india.control = "UK"; // simulate a legacy marker to prove it is not overwritten

    expect(resolveEffects(G, makeCtx(), "GE", [{type: "controlSpace"}], {targetSpace: "india"})).toBe(true);

    expect(G.spaces.india.control).toBe("UK");
    expect(logArgs(G, "indiaMarkerRejected")).toEqual(
      expect.arrayContaining([expect.objectContaining({space: "india", marker: "control"})]),
    );
  });

  test("placeInfluence and minorAlliance are skipped and logged", () => {
    const G = fresh();
    applyIndiaIndependence(G);
    G.spaces.india.influence = null;
    G.spaces.india.diplomacy = "GE";
    G.spaces.india.ally = null;

    resolveEffects(G, makeCtx(), "GE", [{type: "placeInfluence"}], {targetSpace: "india"});
    resolveEffects(G, makeCtx(), "GE", [{type: "minorAlliance"}], {targetSpace: "india"});

    expect(G.spaces.india.influence).toBeNull();
    expect(G.spaces.india.ally).toBeNull();
    const markers = logArgs(G, "indiaMarkerRejected").map((args) => args?.marker);
    expect(markers).toEqual(expect.arrayContaining(["influence", "ally"]));
  });

  test("Bengal is a separate space and is unaffected", () => {
    const G = fresh();
    applyIndiaIndependence(G);
    G.spaces.bengal.control = null;

    expect(resolveEffects(G, makeCtx(), "GE", [{type: "controlSpace"}], {targetSpace: "bengal"})).toBe(true);

    expect(G.spaces.bengal.control).toBe("GE");
    expect(logArgs(G, "indiaMarkerRejected")).toEqual([]);
  });
});
