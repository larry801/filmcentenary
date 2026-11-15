/** Rules 8.3 / 16.2: count imposed primary terms, then shift both primaries. */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {
  applyHarshTerms,
  applyTreaty,
  applyVictoryOutcome,
  classifyVictory,
  createWarState,
  settleLimitedWar,
  TreatyChoice,
} from "./engine/limitedWar";
import {declinePending, resolvePending, resolveWar} from "./moves";
import {logText} from "./components/logText";

const scripted = (dice: number[] = [], power: Power = "GE") => {
  let index = 0;
  const Die = jest.fn((_sides: number) => dice[index++] ?? 3);
  const ctx = {
    playerID: String(POWERS.indexOf(power)),
    random: {Die},
    events: {setPhase: jest.fn(), setActivePlayers: jest.fn(), endTurn: jest.fn(), endGame: jest.fn()},
    turn: 1,
    phase: "wartime",
  } as unknown as Ctx;
  return {ctx, Die};
};

const fresh = (victor: "attacker" | "defender" = "attacker"): ImperialElegyState => {
  const G = setupImperialElegy(scripted().ctx);
  G.phase = "wartime";
  G.activePower = victor === "attacker" ? "GE" : "FR";
  G.units = {};
  for (const state of Object.values(G.spaces)) {
    state.units = [];
    state.occupiedBy = null;
    state.ally = null;
  }
  for (const power of POWERS) G.powers[power].alliance = "neutral";
  G.powers.GE.alliance = "taAligned";
  G.powers.FR.alliance = "teAligned";
  G.war = createWarState(G, "GE", "FR", "conquest", ["burgundy"], 2);
  G.war.victor = victor;
  G.war.status = "victory";
  G.spaces.bavaria.ally = victor === "attacker" ? "FR" : "GE";
  G.spaces[victor === "attacker" ? "paris" : "berlin"].occupiedBy = G.activePower;
  return G;
};

const terms: TreatyChoice[] = [
  {option: "realignment", minor: "Bavaria"},
  {option: "warReparations"},
];

const shifts = (G: ImperialElegyState) => G.log.filter((entry) => entry.key === "harshTermsShift");
const boxes = (G: ImperialElegyState) => [G.powers.GE.alliance, G.powers.FR.alliance];

describe("8.3 actual primary terms", () => {
  test.each(["attacker", "defender"] as const)("interactive %s victory shifts both primaries after the second option", (victor) => {
    const G = fresh(victor);
    const {ctx, Die} = scripted([], G.activePower);
    expect(resolveWar(G, ctx)).toBeUndefined();
    expect(G.pending?.kind).toBe("treatyOption");
    expect(resolvePending(G, ctx, "realignment")).toBeUndefined();
    expect(boxes(G)).toEqual(["taAligned", "teAligned"]);
    expect(shifts(G)).toEqual([]);
    expect(resolvePending(G, ctx, "warReparations")).toBeUndefined();
    expect(boxes(G)).toEqual(["taCommitted", "teCommitted"]);
    expect(G.wars[0].harshTermsApplied).toBe(true);
    expect(G.wars[0].treaties).toEqual(["realignment", "warReparations"]);
    expect(shifts(G).map((entry) => entry.power)).toEqual(["GE", "FR"]);
    expect(Die).not.toHaveBeenCalled();
  });

  test("the explicit move and helper settlement both apply harsh terms", () => {
    const G = fresh();
    const {ctx} = scripted();
    expect(resolveWar(G, ctx, terms)).toBeUndefined();
    expect(boxes(G)).toEqual(["taCommitted", "teCommitted"]);
    expect(G.wars[0].harshTermsApplied).toBe(true);

    const direct = fresh();
    const outcome = settleLimitedWar(direct, classifyVictory(direct, direct.war!), terms, ctx);
    expect(outcome.ok).toBe(true);
    expect(outcome.outcome?.harshTerms).toBe(true);
    expect(boxes(direct)).toEqual(boxes(G));
  });

  test.each([{choices: []}, {choices: [terms[0]]}])("unused major-victory options do not count: $choices", ({choices}) => {
    const G = fresh();
    const {ctx} = scripted();
    const result = settleLimitedWar(G, classifyVictory(G, G.war!), choices, ctx);
    expect(result.ok).toBe(true);
    expect(result.outcome?.harshTerms).toBe(false);
    expect(boxes(G)).toEqual(["taAligned", "teAligned"]);
    expect(shifts(G)).toEqual([]);
  });

  test.each(["done", "decline"])("finishing after one interactive term via %s does not shift", (finish) => {
    const G = fresh();
    const {ctx} = scripted();
    resolveWar(G, ctx);
    expect(resolvePending(G, ctx, "realignment")).toBeUndefined();
    expect(finish === "done" ? resolvePending(G, ctx, "done") : declinePending(G, ctx)).toBeUndefined();
    expect(G.war).toBeNull();
    expect(G.wars[0].treaties).toEqual(["realignment"]);
    expect(boxes(G)).toEqual(["taAligned", "teAligned"]);
  });

  test("negotiated peace concedes one term and is not harsh", () => {
    const G = fresh();
    const {ctx} = scripted();
    const victory = classifyVictory(G, G.war!, {negotiatedPeace: "defender"});
    const outcome = applyVictoryOutcome(G, G.war!, victory, ctx);
    expect(outcome.harshTerms).toBe(false);
    const result = settleLimitedWar(G, victory, [terms[0]], ctx);
    expect(result.outcome?.harshTerms).toBe(false);
    expect(boxes(G)).toEqual(["taAligned", "teAligned"]);
  });

  test("one cession of two spaces is one treaty option", () => {
    const G = fresh();
    G.war!.objectives = ["burgundy", "champagne"];
    const result = settleLimitedWar(G, classifyVictory(G, G.war!), [{option: "territorialCession"}], scripted().ctx);
    expect(result.ok).toBe(true);
    expect(result.treaties[0].affectedSpaces).toHaveLength(2);
    expect(result.outcome?.harshTerms).toBe(false);
    expect(shifts(G)).toEqual([]);
  });

  test("invalid and duplicate options do not make one valid term harsh", () => {
    for (const choices of [[terms[0], terms[0]], [terms[0], {option: "colonialCession", space: "berlin"} as TreatyChoice]]) {
      const G = fresh();
      const result = settleLimitedWar(G, classifyVictory(G, G.war!), choices, scripted().ctx);
      expect(result.ok).toBe(false);
      expect(result.treaties.filter((entry) => entry.applied)).toHaveLength(1);
      expect(result.outcome?.harshTerms).toBe(false);
      expect(shifts(G)).toEqual([]);
    }
  });

  test("awarding both primary concessions to a victorious ally still counts", () => {
    const G = fresh();
    G.war!.attackerAllies = ["RU"];
    const result = settleLimitedWar(G, classifyVictory(G, G.war!), [
      {option: "territorialCession", beneficiary: "RU"},
      {option: "warReparations", beneficiary: "RU"},
    ], scripted().ctx);
    expect(result.ok).toBe(true);
    expect(result.outcome?.harshTerms).toBe(true);
    expect(G.spaces.burgundy.control).toBe("RU");
    expect(G.powers.RU.alliance).toBe("neutral");
    expect(boxes(G)).toEqual(["taCommitted", "teCommitted"]);
  });

  test("a primary term plus an ally-knockout term is not harsh", () => {
    const G = fresh();
    G.war!.victor = null;
    G.war!.defenderAllies = ["AU"];
    G.spaces.paris.occupiedBy = null;
    G.spaces.burgundy.occupiedBy = "GE";
    G.spaces.vienna.occupiedBy = "GE";
    G.spaces.bavaria.ally = "AU";
    const victory = classifyVictory(G, G.war!);
    expect(victory.primary).toBe("normal");
    expect(victory.totalTreatyOptions).toBe(2);
    const result = settleLimitedWar(G, victory, [
      {option: "territorialCession"},
      {option: "realignment", minor: "Bavaria", target: "AU"},
    ], scripted().ctx);
    expect(result.ok).toBe(true);
    expect(result.outcome?.harshTerms).toBe(false);
    expect(G.wars[0].treaties).toHaveLength(2);
    expect(shifts(G)).toEqual([]);
    expect(G.powers.AU.alliance).toBe("neutral");
  });

  test("two knockout terms against allies do not shift the primaries", () => {
    const G = fresh();
    G.war!.victor = null;
    G.war!.defenderAllies = ["AU", "OT"];
    G.spaces.paris.occupiedBy = null;
    G.spaces.vienna.occupiedBy = "GE";
    G.spaces.istanbul.occupiedBy = "GE";
    G.spaces.bavaria.ally = "AU";
    const result = settleLimitedWar(G, classifyVictory(G, G.war!), [
      {option: "realignment", minor: "Bavaria", target: "AU"},
      {option: "warReparations", target: "OT"},
    ], scripted().ctx);
    expect(result.ok).toBe(true);
    expect(result.outcome?.harshTerms).toBe(false);
    expect(G.wars[0].treaties).toHaveLength(2);
    expect(shifts(G)).toEqual([]);
  });

  test("two primary terms survive the later losing-side knockout decision", () => {
    const G = fresh();
    const {ctx} = scripted();
    G.war!.attackerAllies = ["RU"];
    G.spaces["st-petersburg"].occupiedBy = "FR";
    // GE takes its two primary options; FR later takes RU-controlled Rhodes.
    G.spaces.rhodes.control = "RU";
    expect(resolveWar(G, ctx)).toBeUndefined();
    expect(resolvePending(G, ctx, "realignment")).toBeUndefined();
    expect(resolvePending(G, ctx, "warReparations")).toBeUndefined();
    expect(G.pending?.power).toBe("FR");
    expect(G.pending?.context?.applied).toHaveLength(2);
    expect(shifts(G)).toEqual([]);
    const choice = G.pending!.options.find((entry) => entry.id.startsWith("colonialCession") && entry.id.endsWith("#RU"));
    expect(choice).toBeDefined();
    expect(resolvePending(G, {...ctx, playerID: "2"}, choice!.id)).toBeUndefined();
    if (G.pending?.kind === "treatySpace") {
      expect(resolvePending(G, {...ctx, playerID: "2"}, G.pending.options[0].id)).toBeUndefined();
    }
    expect(G.war).toBeNull();
    expect(G.wars[0].treaties).toHaveLength(3);
    expect(boxes(G)).toEqual(["taCommitted", "teCommitted"]);
    expect(shifts(G)).toHaveLength(2);
  });
});

describe("8.3 directions, cap and saved decisions", () => {
  test("directions are derived before either chit moves", () => {
    const G = fresh();
    G.powers.GE.alliance = "neutral";
    const {ctx, Die} = scripted();
    resolveWar(G, ctx, terms);
    expect(boxes(G)).toEqual(["taAligned", "teCommitted"]);
    expect(Die).not.toHaveBeenCalled();
  });

  test.each([[1, 6], [3, 4], [2, 3]])("both-neutral primaries roll independently: %j", (...dice) => {
    const G = fresh();
    G.powers.GE.alliance = "neutral";
    G.powers.FR.alliance = "neutral";
    const {ctx, Die} = scripted(dice);
    resolveWar(G, ctx, terms);
    expect(boxes(G)).toEqual(dice.map((roll) => roll <= 3 ? "teAligned" : "taAligned"));
    expect(Die).toHaveBeenCalledTimes(2);
    expect(shifts(G).map((entry) => entry.args?.roll)).toEqual(dice);
  });

  test("a harsh-terms shift has no declaration exception to the three-player cap", () => {
    const G = fresh();
    G.powers.GE.alliance = "neutral";
    for (const power of ["UK", "AU", "RU"] as const) G.powers[power].alliance = "taAligned";
    resolveWar(G, scripted().ctx, terms);
    expect(boxes(G)).toEqual(["neutral", "teCommitted"]);
    expect(shifts(G)[0].args).toMatchObject({blocked: true, steps: 0});
    expect(G.wars[0].harshTermsApplied).toBe(true);
  });

  test("already-committed primaries remain at the track ends", () => {
    const G = fresh();
    G.powers.GE.alliance = "taCommitted";
    G.powers.FR.alliance = "teCommitted";
    resolveWar(G, scripted().ctx, terms);
    expect(boxes(G)).toEqual(["taCommitted", "teCommitted"]);
    expect(shifts(G).every((entry) => entry.args?.steps === 0)).toBe(true);
  });

  test("a saved treaty decision preserves its first imposed term", () => {
    let G = fresh();
    const {ctx} = scripted();
    resolveWar(G, ctx);
    resolvePending(G, ctx, "realignment");
    expect(G.pending?.context?.applied).toHaveLength(1);
    G = JSON.parse(JSON.stringify(G)) as ImperialElegyState;
    expect(G.war!.harshTermsApplied).toBeUndefined();
    expect(resolvePending(G, ctx, "warReparations")).toBeUndefined();
    expect(G.wars[0].harshTermsApplied).toBe(true);
    expect(boxes(G)).toEqual(["taCommitted", "teCommitted"]);
  });

  test("repeated settlement and archive reads cannot shift or reroll again", () => {
    const G = fresh();
    const war = G.war!;
    G.powers.GE.alliance = "neutral";
    G.powers.FR.alliance = "neutral";
    const {ctx, Die} = scripted([1, 6, 6, 1]);
    const victory = classifyVictory(G, war);
    applyVictoryOutcome(G, war, victory, ctx);
    for (const choice of terms) expect(applyTreaty(G, war, victory, choice).applied).toBe(true);
    expect(applyHarshTerms(G, war, terms, ctx)).toBe(true);
    expect(applyHarshTerms(G, war, terms, ctx)).toBe(true);
    const saved = JSON.parse(JSON.stringify(war)) as WarState;
    expect(applyHarshTerms(G, saved, terms, ctx)).toBe(true);
    expect(Die).toHaveBeenCalledTimes(2);
    expect(shifts(G)).toHaveLength(2);
    expect(boxes(G)).toEqual(["teAligned", "taAligned"]);
  });

  test("a lone non-player war has no second player chit to shift", () => {
    const G = fresh();
    G.war!.defender = "Bavaria" as Power;
    G.war!.minorTarget = {minor: "Bavaria", ally: null};
    G.war!.treaties = ["realignment", "territorialCession"];
    expect(applyHarshTerms(G, G.war!, [{option: "realignment"}, {option: "territorialCession"}], scripted().ctx)).toBe(false);
    expect(shifts(G)).toEqual([]);
  });

  test("an invalid pending choice is rejected before any shift", () => {
    const G = fresh();
    const {ctx} = scripted();
    resolveWar(G, ctx);
    const before = JSON.stringify(G);
    expect(resolvePending(G, ctx, "not-a-treaty")).toBe(INVALID_MOVE);
    expect(JSON.stringify(G)).toBe(before);
  });

  test("players can read the random shift and cap in both log languages", () => {
    const entry = {key: "harshTermsShift", power: "GE" as const, args: {from: "neutral", to: "neutral", opponent: "FR", roll: 1, steps: 0, blocked: true}};
    expect(logText(entry, "en")).toContain("harsh terms");
    expect(logText(entry, "en")).toContain("die 1");
    expect(logText(entry, "zh_CN")).toContain("苛刻条款");
    expect(logText(entry, "zh_CN")).toContain("三名玩家上限");
  });
});
