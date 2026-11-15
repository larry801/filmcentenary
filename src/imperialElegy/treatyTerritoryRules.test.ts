/** Printed 3.2.1 / 16.2.4–16.2.5: target eligibility shared by rules and UI. */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {ImperialElegyState, Power, POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {
  applyTreaty,
  canApplyTreaty,
  classifyVictory,
  createWarState,
  isColonialTreatyKey,
} from "./engine/limitedWar";
import {treatyOptionsFor, treatySpaceOptions} from "./engine/treatyChoice";
import {resolvePending, resolveWar} from "./moves";

const ctxFor = (power: Power = "AU"): Ctx => ({
  playerID: String(POWERS.indexOf(power)),
  random: {Die: () => 3},
  events: {setPhase: jest.fn(), setActivePlayers: jest.fn(), endTurn: jest.fn(), endGame: jest.fn()},
  turn: 1,
  phase: "wartime",
}) as unknown as Ctx;

const fresh = (): ImperialElegyState => {
  const G = setupImperialElegy(ctxFor());
  G.phase = "wartime";
  G.activePower = "AU";
  G.units = {};
  for (const state of Object.values(G.spaces)) {
    state.units = [];
    state.occupiedBy = null;
    state.ally = null;
  }
  for (const power of POWERS) G.powers[power].alliance = "neutral";
  G.powers.GE.alliance = "taAligned";
  G.powers.AU.alliance = "teAligned";
  G.war = createWarState(G, "GE", "AU", "conquest", ["bohemia"], 2);
  return G;
};

const defense = (G: ImperialElegyState, major = true) => {
  if (major) G.war!.victor = "defender";
  return classifyVictory(G, G.war!, major ? {} : {defenderBlockading: true});
};

describe("16.2.4 righteous defense", () => {
  test("a major defending victor can take an unoccupied enemy key with a LoC", () => {
    const G = fresh();
    const victory = defense(G);
    const entry = treatyOptionsFor(G, G.war!, victory).find((option) => option.id === "righteousDefense")!;
    expect(G.spaces.silesia.occupiedBy).toBeNull();
    expect(entry.spaces).toContain("silesia");
    expect(treatySpaceOptions(G, "righteousDefense", victory).map((o) => o.id)).toContain("silesia");
    expect(treatySpaceOptions(G, entry, victory).map((o) => o.id)).toContain("silesia");
    expect(treatySpaceOptions(G, "righteousDefense").map((o) => o.id)).toContain("silesia");
    expect(applyTreaty(G, G.war!, victory, {option: "righteousDefense", space: "silesia"}).applied).toBe(true);
    expect(G.spaces.silesia.control).toBe("AU");
  });

  test("an ordinary defensive victory still needs occupation of a foreign key", () => {
    const G = fresh();
    const victory = defense(G, false);
    expect(victory.primary).toBe("defensive");
    const choice = {option: "righteousDefense" as const, space: "silesia"};
    expect(canApplyTreaty(G, G.war!, victory, choice).ok).toBe(false);
    G.spaces.silesia.occupiedBy = "AU";
    expect(canApplyTreaty(G, G.war!, victory, choice).ok).toBe(true);
  });

  test("a negotiated defender victory does not get the major-victory exception", () => {
    const G = fresh();
    const victory = classifyVictory(G, G.war!, {negotiatedPeace: "attacker"});
    expect(canApplyTreaty(G, G.war!, victory, {option: "righteousDefense", space: "silesia"}).ok).toBe(false);
  });

  test("bare space options preserve an already-recorded ordinary victory", () => {
    const G = fresh();
    G.war!.victor = "defender";
    G.war!.victoryPrimary = "defensive";
    expect(treatySpaceOptions(G, "righteousDefense").map((option) => option.id)).not.toContain("silesia");
    G.spaces.silesia.occupiedBy = "AU";
    expect(treatySpaceOptions(G, "righteousDefense").map((option) => option.id)).toContain("silesia");
  });

  test("a lost defender home may be recovered without occupation", () => {
    const G = fresh();
    G.spaces.bohemia.control = "GE";
    const victory = classifyVictory(G, G.war!, {negotiatedPeace: "attacker"});
    expect(canApplyTreaty(G, G.war!, victory, {option: "righteousDefense", space: "bohemia"}).ok).toBe(true);
  });

  test("event-granted home spaces retain the home-return exception", () => {
    const G = fresh();
    G.spaces.saxony.control = "GE";
    G.spaces.saxony.homeOverride = "AU";
    expect(canApplyTreaty(G, G.war!, defense(G, false), {option: "righteousDefense", space: "saxony"}).ok).toBe(true);
  });

  test("a key without a printed track type is still offered", () => {
    const G = fresh();
    G.spaces.saxony.control = "GE";
    const victory = defense(G);
    const entry = treatyOptionsFor(G, G.war!, victory).find((option) => option.id === "righteousDefense");
    expect(entry?.spaces).toContain("saxony");
    expect(canApplyTreaty(G, G.war!, victory, {option: "righteousDefense", space: "saxony"}).ok).toBe(true);
  });

  test("an allied player's own lost home is returned to that ally", () => {
    const G = fresh();
    G.war!.defenderAllies = ["RU"];
    G.powers.RU.alliance = "teAligned";
    G.spaces.poland.control = "GE";
    const victory = defense(G, false);
    const entry = treatyOptionsFor(G, G.war!, victory).find((option) => option.id === "righteousDefense@RU");
    expect(entry?.spaces).toContain("poland");
    expect(applyTreaty(G, G.war!, victory, {option: "righteousDefense", space: "poland", beneficiary: "RU"}).applied).toBe(true);
    expect(G.spaces.poland.control).toBe("RU");
  });

  test("the live home-return chooser retains the allied beneficiary", () => {
    const G = fresh();
    G.war!.defenderAllies = ["RU"];
    G.powers.RU.alliance = "teAligned";
    G.spaces.poland.control = "GE";
    G.flags.defenderBlockading = true;
    expect(resolveWar(G, ctxFor())).toBeUndefined();
    expect(resolvePending(G, ctxFor(), "righteousDefense@RU")).toBeUndefined();
    expect(G.pending?.kind).toBe("treatySpace");
    expect(resolvePending(G, ctxFor(), "poland")).toBeUndefined();
    expect(G.spaces.poland.control).toBe("RU");
  });

  test("an ally cannot receive the primary defender's home as its own home return", () => {
    const G = fresh();
    G.war!.defenderAllies = ["RU"];
    G.powers.RU.alliance = "teAligned";
    G.spaces.bohemia.control = "GE";
    const check = canApplyTreaty(G, G.war!, defense(G), {option: "righteousDefense", space: "bohemia", beneficiary: "RU"});
    expect(check.issues.map((issue) => issue.code)).toContain("not-beneficiary-home");
  });

  test("returning an independent minor ally's occupied home preserves its alliance", () => {
    const G = fresh();
    G.spaces.saxony.ally = "AU";
    G.spaces.saxony.occupiedBy = "GE";
    const victory = defense(G, false);
    const entry = treatyOptionsFor(G, G.war!, victory).find((option) => option.id === "righteousDefense@Saxony");
    expect(entry?.spaces).toContain("saxony");
    const result = applyTreaty(G, G.war!, victory, {option: "righteousDefense", space: "saxony", beneficiary: "Saxony"});
    expect(result.applied).toBe(true);
    expect(G.spaces.saxony).toMatchObject({control: "Saxony", ally: "AU", occupiedBy: null});
  });

  test("even a major victory needs a LoC to a valid supply source", () => {
    const G = fresh();
    for (const state of Object.values(G.spaces)) if (state.control === "AU") state.control = null;
    // One isolated controlled home is not a supply source (5.6).
    G.spaces.bohemia.control = "AU";
    const check = canApplyTreaty(G, G.war!, defense(G), {option: "righteousDefense", space: "silesia"});
    expect(check.ok).toBe(false);
    expect(check.issues.map((issue) => issue.code)).toContain("no-loc");
  });

  test("neutral territory and a non-home naval base are not righteous-defense targets", () => {
    const G = fresh();
    const victory = defense(G);
    expect(canApplyTreaty(G, G.war!, victory, {option: "righteousDefense", space: "poland"}).ok).toBe(false);
    G.spaces.rhodes.control = "GE";
    G.spaces.rhodes.occupiedBy = "AU";
    expect(canApplyTreaty(G, G.war!, victory, {option: "righteousDefense", space: "rhodes"}).ok).toBe(false);
  });

  test("a winning attacker cannot choose righteous defense", () => {
    const G = fresh();
    G.war!.victor = "attacker";
    const check = canApplyTreaty(G, G.war!, classifyVictory(G, G.war!), {option: "righteousDefense", space: "bohemia"});
    expect(check.issues.map((issue) => issue.code)).toContain("defender-only");
  });

  test("an ally-knockout option is restricted to its target and has no primary-major exemption", () => {
    const G = fresh();
    G.war!.attackerAllies = ["FR"];
    G.powers.FR.alliance = "taAligned";
    G.spaces.paris.occupiedBy = "AU";
    const victory = defense(G);
    const choice = {option: "righteousDefense" as const, space: "silesia", target: "FR" as const};
    expect(canApplyTreaty(G, G.war!, victory, choice).ok).toBe(false);
    expect(canApplyTreaty(G, G.war!, victory, {...choice, space: "provence"}).ok).toBe(false);
    G.spaces.provence.occupiedBy = "AU";
    expect(canApplyTreaty(G, G.war!, victory, {...choice, space: "provence"}).ok).toBe(true);
    const entry = treatyOptionsFor(G, G.war!, victory).find((option) => option.id === "righteousDefense#FR")!;
    expect(entry.spaces).toContain("provence");
    // Follow-up validation must retain #FR instead of reverting to primary GE.
    expect(treatySpaceOptions(G, entry, victory).map((option) => option.id)).toContain("provence");
    expect(treatySpaceOptions(G, entry, victory).map((option) => option.id)).not.toContain("silesia");
  });

  test("the live chooser applies an unoccupied major-victory target after a save round-trip", () => {
    let G = fresh();
    G.war!.victor = "defender";
    expect(resolveWar(G, ctxFor())).toBeUndefined();
    expect(resolvePending(G, ctxFor(), "righteousDefense")).toBeUndefined();
    expect(G.pending?.kind).toBe("treatySpace");
    expect(G.pending?.options.map((option) => option.id)).toContain("silesia");
    G = JSON.parse(JSON.stringify(G));
    expect(resolvePending(G, ctxFor(), "silesia")).toBeUndefined();
    expect(G.spaces.silesia.control).toBe("AU");
    expect(G.war!.treaties).toContain("righteousDefense");
  });

  test("a stale righteous-defense space choice is revalidated without mutations", () => {
    const G = fresh();
    G.war!.victor = "defender";
    resolveWar(G, ctxFor());
    resolvePending(G, ctxFor(), "righteousDefense");
    G.spaces.silesia.control = "UK";
    const before = JSON.stringify(G);
    expect(resolvePending(G, ctxFor(), "silesia")).toBe(INVALID_MOVE);
    expect(JSON.stringify(G)).toBe(before);
  });
});

describe("16.2.5 colonial cession", () => {
  const colonialWar = (loser: Power): ImperialElegyState => {
    const G = fresh();
    G.activePower = "GE";
    G.war = createWarState(G, "GE", loser, "conquest", ["japan"], 2);
    G.war.victor = "attacker";
    G.spaces.japan.control = loser;
    return G;
  };

  test.each(["AU", "RU", "OT"] as const)("%s's overseas keys are cession targets even without a colonial track", (loser) => {
    const G = colonialWar(loser);
    const victory = classifyVictory(G, G.war!);
    expect(isColonialTreatyKey(G, "japan", loser)).toBe(true);
    expect(canApplyTreaty(G, G.war!, victory, {option: "colonialCession", space: "japan"}).ok).toBe(true);
    const entry = treatyOptionsFor(G, G.war!, victory).find((option) => option.id === "colonialCession")!;
    expect(entry.spaces).toContain("japan");
    expect(treatySpaceOptions(G, "colonialCession", victory).map((option) => option.id)).toContain("japan");
    expect(treatySpaceOptions(G, entry, victory).map((option) => option.id)).toContain("japan");
    expect(applyTreaty(G, G.war!, victory, {option: "colonialCession", space: "japan"}).applied).toBe(true);
    expect(G.spaces.japan.control).toBe("GE");
  });

  test("a port-to-port sea edge is not a contiguous land connection", () => {
    const G = colonialWar("OT");
    expect(isColonialTreatyKey(G, "cyprus", "OT")).toBe(true);
    expect(isColonialTreatyKey(G, "antalya", "OT")).toBe(false);
  });

  test("reaching another controlled home key does not replace reaching the capital", () => {
    const G = colonialWar("OT");
    expect(isColonialTreatyKey(G, "tripoli", "OT")).toBe(true);
    expect(isColonialTreatyKey(G, "tunisia", "OT")).toBe(true);
    // An uninterrupted own-controlled route through Egypt links this pair to Istanbul.
    for (const id of ["great-sand-sea", "egypt", "sinai"]) G.spaces[id].control = "OT";
    expect(isColonialTreatyKey(G, "tunisia", "OT")).toBe(false);
  });

  test("allied and influenced land cannot bridge the key-to-capital connection", () => {
    const G = colonialWar("OT");
    for (const id of ["great-sand-sea", "egypt", "sinai"]) G.spaces[id].control = "OT";
    for (const id of ["egypt", "sinai"]) G.spaces[id].control = "AU";
    G.powers.OT.alliance = "teAligned";
    G.powers.AU.alliance = "teAligned";
    expect(isColonialTreatyKey(G, "tunisia", "OT")).toBe(true);
    for (const id of ["egypt", "sinai"]) {
      G.spaces[id].control = null;
      G.spaces[id].influence = "OT";
    }
    expect(isColonialTreatyKey(G, "tunisia", "OT")).toBe(true);
  });

  test("formal control, not a wartime occupation, determines the territorial connection", () => {
    const G = colonialWar("OT");
    G.spaces.ankara.occupiedBy = "GE";
    expect(isColonialTreatyKey(G, "antalya", "OT")).toBe(false);
    expect(isColonialTreatyKey(G, "istanbul", "OT")).toBe(false);
  });

  test("the overland trace uses the Ottoman capital's permanent move to Ankara", () => {
    const G = colonialWar("OT");
    G.spaces.istanbul.control = "RU";
    expect(isColonialTreatyKey(G, "antalya", "OT")).toBe(true);
    G.persistent.otCapital = "ankara";
    expect(isColonialTreatyKey(G, "antalya", "OT")).toBe(false);
  });

  test("a fixed colonial key label does not override a newly connected owned land route", () => {
    const G = colonialWar("OT");
    G.spaces.egypt.control = "OT";
    G.spaces.egypt.keyTypeOverride = "colonial";
    G.spaces.sinai.control = "OT";
    expect(isColonialTreatyKey(G, "egypt", "OT")).toBe(false);
  });

  test("colonial home keys require winning-side occupation, including event-granted Egypt", () => {
    const G = colonialWar("UK");
    G.spaces.egypt.control = "UK";
    G.spaces.egypt.homeOverride = "UK";
    G.war!.attackerAllies = ["FR"];
    const victory = classifyVictory(G, G.war!);
    for (const space of ["canada", "egypt"]) {
      const choice = {option: "colonialCession" as const, space};
      const check = canApplyTreaty(G, G.war!, victory, choice);
      expect(check.issues.map((issue) => issue.code)).toContain("colonial-home-not-occupied");
      G.spaces[space].occupiedBy = "FR";
      expect(canApplyTreaty(G, G.war!, victory, choice).ok).toBe(true);
    }
  });

  test("the treaty target's control is required and ordinary overseas territories are excluded", () => {
    const G = colonialWar("AU");
    const victory = classifyVictory(G, G.war!);
    G.spaces.aden.control = "AU";
    expect(canApplyTreaty(G, G.war!, victory, {option: "colonialCession", space: "aden"}).ok).toBe(false);
    expect(canApplyTreaty(G, G.war!, victory, {option: "colonialCession", space: "canada"}).ok).toBe(false);
    expect(canApplyTreaty(G, G.war!, victory, {option: "colonialCession", space: "vienna"}).ok).toBe(false);
  });

  test("a naval base is eligible separately from the key classification", () => {
    const G = colonialWar("RU");
    G.spaces.rhodes.control = "RU";
    expect(isColonialTreatyKey(G, "rhodes", "RU")).toBe(false);
    expect(canApplyTreaty(G, G.war!, classifyVictory(G, G.war!), {option: "colonialCession", space: "rhodes"}).ok).toBe(true);
  });

  test("the live colonial chooser can award a newly eligible key to an ally", () => {
    const G = colonialWar("RU");
    G.war!.attackerAllies = ["FR"];
    expect(resolveWar(G, ctxFor("GE"))).toBeUndefined();
    expect(resolvePending(G, ctxFor("GE"), "colonialCession@FR")).toBeUndefined();
    // A sole legal space applies directly; multiple spaces prompt explicitly.
    if (G.pending?.kind === "treatySpace") {
      expect(G.pending.options.map((option) => option.id)).toContain("japan");
      expect(resolvePending(G, ctxFor("GE"), "japan")).toBeUndefined();
    }
    expect(G.spaces.japan.control).toBe("FR");
    expect((G.war ?? G.wars.at(-1))?.treaties).toContain("colonialCession");
  });

  test("a stale colonial choice is rejected when the owned land route changes", () => {
    const G = colonialWar("OT");
    G.spaces.tunisia.occupiedBy = "GE";
    expect(resolveWar(G, ctxFor("GE"))).toBeUndefined();
    expect(resolvePending(G, ctxFor("GE"), "colonialCession")).toBeUndefined();
    expect(G.pending?.kind).toBe("treatySpace");
    expect(G.pending?.options.map((option) => option.id)).toContain("tunisia");
    for (const id of ["great-sand-sea", "egypt", "sinai"]) G.spaces[id].control = "OT";
    const before = JSON.stringify(G);
    expect(resolvePending(G, ctxFor("GE"), "tunisia")).toBe(INVALID_MOVE);
    expect(JSON.stringify(G)).toBe(before);
  });
});
