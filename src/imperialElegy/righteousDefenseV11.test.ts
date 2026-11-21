/** Living Rules v1.1, 16.2.4: acquisition / home return / minority liberation. */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {
  applyTreaty, canApplyTreaty, classifyVictory, createWarState, hasPeacetimeTreatyLoc,
  isIndependentMinor, minorWarInfo, nonPlayerHome, TreatyChoice,
} from "./engine/limitedWar";
import {liberationNationalities} from "./engine/nationality";
import {hasLoc, minorController, minorHasLoc, minorSupplySource, setSpaceControl} from "./engine/rules";
import {treatyOptionsFor} from "./engine/treatyChoice";
import {redactForView} from "./engine/privacy";
import {logText} from "./components/logText";
import {resolvePending, resolveWar} from "./moves";

const ctxFor = (power: Power = "FR"): Ctx => ({
  playerID: String(POWERS.indexOf(power)), random: {Die: () => 3},
  events: {setPhase: jest.fn(), setActivePlayers: jest.fn(), endTurn: jest.fn(), endGame: jest.fn()},
}) as unknown as Ctx;

const fresh = (attacker: Power = "AU", defender: Power = "FR"): ImperialElegyState => {
  const G = setupImperialElegy(ctxFor());
  G.units = {};
  for (const state of Object.values(G.spaces)) {
    state.units = []; state.occupiedBy = null; state.ally = null;
  }
  G.phase = "wartime";
  G.activePower = defender;
  for (const power of POWERS) G.powers[power].alliance = "neutral";
  G.war = createWarState(G, attacker, defender, "conquest", ["provence"], 2);
  G.war.victor = "defender";
  return G;
};

const liberate = (space = "bohemia", nationality = "Czechs"): TreatyChoice =>
  ({option: "righteousDefense", righteousMode: "liberate", space, nationality});

describe("16.2.4(3) minority liberation", () => {
  test("the live treaty panel offers a bilingual nationality choice and creates a supplied allied minor", () => {
    let G = fresh();
    G.spaces.bohemia.occupiedBy = "FR";
    const friendly = placeUnit(G, "FR", "army", "bohemia", 2);
    const enemy = placeUnit(G, "AU", "army", "bohemia", 2);
    expect(resolveWar(G, ctxFor())).toBeUndefined();
    const entry = G.pending!.options.find((option) => option.id === "righteousDefense:liberate:bohemia:Czechs")!;
    expect(entry).toBeDefined();
    expect(entry.label).toContain("liberate Czechs in Bohemia");
    expect(entry.labelZh).toBe("正义防御：解放波希米亚的捷克民族");
    // Saving the choice cannot lose the nationality or the treaty target.
    G = JSON.parse(JSON.stringify(G));
    expect(resolvePending(G, ctxFor(), entry.id)).toBeUndefined();
    expect(G.spaces.bohemia).toMatchObject({
      control: "Bohemia", ally: "FR", occupiedBy: null,
      independentHome: {power: "Bohemia", nationality: "Czechs"},
    });
    // 5.6: a supply source is a controlled **home key**, and Bohemia is a
    // minor's home key, not a French one.  Once the war ends the French army
    // there is out of supply, so 5.6.3 displaces it immediately.  The new
    // allied minor is still supplied for its own units (5.6.1).
    expect(G.units[friendly.id].space).not.toBe("bohemia");
    expect(G.units[enemy.id]?.space).not.toBe("bohemia");
    expect(isIndependentMinor(G, "Bohemia")).toBe(true);
    expect(minorController(G, "Bohemia")).toBe("FR");
    expect(minorSupplySource(G, "Bohemia", "bohemia")).toBe(true);
    expect(minorHasLoc(G, "Bohemia", "bohemia")).toBe(true);
    expect(nonPlayerHome("Bohemia", G)).toBe("bohemia");
    expect((G.war ?? G.wars.at(-1))?.treaties).toEqual(["righteousDefense"]);
    expect((G.pending?.options ?? []).some((option) => option.id.startsWith("righteousDefense"))).toBe(false);
    const entryLog = G.log.find((entry) => entry.key === "treatyApplied")!;
    expect(logText(entryLog, "en")).toContain("liberated");
    expect(logText(entryLog, "zh_CN")).toContain("立即与其结盟");
  });

  test("each eligible flag in a multi-nationality space is selectable", () => {
    const G = fresh();
    G.spaces.galicia.occupiedBy = "FR";
    const entries = treatyOptionsFor(G, G.war!, classifyVictory(G, G.war!));
    const options = entries.filter((entry) => entry.choice.righteousMode === "liberate" && entry.choice.space === "galicia");
    expect(options.map((entry) => entry.choice.nationality).sort()).toEqual(["Poles", "Ukrainians"]);
    const result = applyTreaty(G, G.war!, classifyVictory(G, G.war!), liberate("galicia", "Ukrainians"));
    expect(result.applied).toBe(true);
    expect(G.spaces.galicia.control).toBe("Ukrainians");
    expect(G.spaces.galicia.ally).toBe("FR");
  });

  test("the explicit settlement also liberates and displaces the losing army", () => {
    const G = fresh();
    G.spaces.bohemia.occupiedBy = "FR";
    const enemy = placeUnit(G, "AU", "army", "bohemia", 2);
    expect(resolveWar(G, ctxFor(), [liberate()])).toBeUndefined();
    expect(G.war).toBeNull();
    expect(G.spaces.bohemia).toMatchObject({control: "Bohemia", ally: "FR"});
    expect(G.units[enemy.id]?.space).not.toBe("bohemia");
    expect(G.wars[0].treaties).toEqual(["righteousDefense"]);
  });

  test("a major victory does not waive occupation for liberation", () => {
    const G = fresh();
    const before = JSON.stringify(G);
    const result = applyTreaty(G, G.war!, classifyVictory(G, G.war!), liberate());
    expect(result.applied).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("liberation-not-occupied");
    expect(JSON.stringify(G)).toBe(before);
  });

  test("liberation needs neither a rebellion marker nor a peacetime LoC", () => {
    const G = fresh();
    G.spaces.bohemia.occupiedBy = "FR";
    expect(G.spaces.bohemia.rebellion).toBeNull();
    expect(hasPeacetimeTreatyLoc(G, "FR", "bohemia")).toBe(false);
    const victory = classifyVictory(G, G.war!, {negotiatedPeace: "attacker"});
    expect(canApplyTreaty(G, G.war!, victory, liberate()).ok).toBe(true);
  });

  test("unprinted, core and citizenship-protected nationalities are refused", () => {
    const G = fresh();
    G.spaces.bohemia.occupiedBy = "FR";
    const victory = classifyVictory(G, G.war!);
    expect(canApplyTreaty(G, G.war!, victory, liberate("bohemia", "Poles")).ok).toBe(false);
    G.powers.AU.citizenship = ["Czechs"];
    expect(canApplyTreaty(G, G.war!, victory, liberate()).ok).toBe(false);
    expect(liberationNationalities(G, "hungary", "AU")).toEqual([]);
  });

  test("a permanently eliminated minor cannot be resurrected", () => {
    const G = fresh("GE", "FR");
    G.spaces.saxony.control = "GE";
    G.spaces.saxony.occupiedBy = "FR";
    G.eliminatedMinors = ["Saxony"];
    expect(canApplyTreaty(G, G.war!, classifyVictory(G, G.war!), liberate("saxony", "Germans")).ok).toBe(false);
  });

  test("the five-minor-ally cap is checked before liberation writes anything", () => {
    const G = fresh();
    G.spaces.bohemia.occupiedBy = "FR";
    for (const id of ["belgium", "netherlands", "hanover", "saxony", "bavaria"]) G.spaces[id].ally = "FR";
    const before = JSON.stringify(G);
    const result = applyTreaty(G, G.war!, classifyVictory(G, G.war!), liberate());
    expect(result.issues.map((issue) => issue.code)).toContain("minor-ally-limit");
    expect(JSON.stringify(G)).toBe(before);
  });

  test("liberating another space of an existing minor ally consumes no extra alliance slot", () => {
    const G = fresh();
    G.spaces.galicia.occupiedBy = "FR";
    G.spaces.poland.control = "Poland";
    G.spaces.poland.ally = "FR";
    for (const id of ["belgium", "netherlands", "hanover", "saxony"]) G.spaces[id].ally = "FR";
    expect(applyTreaty(G, G.war!, classifyVictory(G, G.war!), liberate("galicia", "Poles")).applied).toBe(true);
    expect(G.spaces.galicia.control).toBe("Poland");
    expect(G.nonPlayerBuildBox?.minors).toContain("Poland");
    expect(G.nonPlayerBuildBox?.poland?.reserveArmies).toEqual([]);
  });

  test("liberated Poland can start in Galicia without owning the Poland map space", () => {
    const G = fresh();
    G.spaces.galicia.occupiedBy = "FR";
    applyTreaty(G, G.war!, classifyVictory(G, G.war!), liberate("galicia", "Poles"));
    expect(isIndependentMinor(G, "Poland")).toBe(true);
    expect(minorSupplySource(G, "Poland", "galicia")).toBe(true);
    expect(nonPlayerHome("Poland", G)).toBe("galicia");
    expect(minorWarInfo(G, "UK", "Poland")).toMatchObject({ok: true, home: "galicia", ally: "FR"});
  });

  test("the liberated home survives reconquest and can be targeted by realignment in another war", () => {
    const G = fresh();
    G.spaces.bohemia.occupiedBy = "FR";
    applyTreaty(G, G.war!, classifyVictory(G, G.war!), liberate());
    const next = createWarState(G, "GE", "FR", "conquest", ["alsace-lorraine"], 2);
    G.war = next;
    next.victor = "attacker";
    const victory = classifyVictory(G, next);
    expect(canApplyTreaty(G, next, victory, {option: "realignment", minor: "Bohemia"}).ok).toBe(true);
    expect(treatyOptionsFor(G, next, victory).find((entry) => entry.option === "realignment")?.minors).toContain("Bohemia");
    setSpaceControl(G, "bohemia", "GE");
    expect(G.spaces.bohemia.independentHome?.power).toBe("Bohemia");
  });

  test("knockout liberation can only affect the named target, and the attacker cannot use it", () => {
    const G = fresh("GE", "FR");
    G.war!.attackerAllies = ["AU"];
    G.spaces.vienna.occupiedBy = "FR";
    G.spaces.bohemia.occupiedBy = "FR";
    const victory = classifyVictory(G, G.war!);
    expect(canApplyTreaty(G, G.war!, victory, liberate()).ok).toBe(false);
    expect(canApplyTreaty(G, G.war!, victory, {...liberate(), target: "AU"}).ok).toBe(true);
    G.war!.victor = "attacker";
    const attackVictory = classifyVictory(G, G.war!);
    expect(canApplyTreaty(G, G.war!, attackVictory, liberate()).ok).toBe(false);
  });

  test("stale nationality options and answers from another seat are rejected atomically", () => {
    const G = fresh();
    G.spaces.bohemia.occupiedBy = "FR";
    resolveWar(G, ctxFor());
    const id = "righteousDefense:liberate:bohemia:Czechs";
    const before = JSON.stringify(G);
    expect(resolvePending(G, ctxFor("GE"), id)).toBe(INVALID_MOVE);
    expect(JSON.stringify(G)).toBe(before);
    G.powers.AU.citizenship = ["Czechs"];
    const stale = JSON.stringify(G);
    expect(resolvePending(G, ctxFor(), id)).toBe(INVALID_MOVE);
    expect(JSON.stringify(G)).toBe(stale);
    expect(redactForView(G, "0", ctxFor()).pending?.options).toEqual([]);
    expect(redactForView(G, "2", ctxFor()).pending?.options.some((option) => option.id === id)).toBe(true);
  });
});

describe("16.2.4(1–2) peacetime supply and home returns", () => {
  test("a wartime allied corridor cannot justify taking an enemy key", () => {
    const G = fresh("RU", "FR");
    G.war!.defenderAllies = ["AU"];
    G.spaces.bohemia.occupiedBy = "FR";
    G.spaces.silesia.control = "RU";
    G.spaces.silesia.occupiedBy = "FR";
    // Wartime route: Silesia -> Bohemia(occupied FR) -> Bavaria(ally AU)
    // -> Alsace(FR); no own-controlled route remains in peace.
    G.spaces.bavaria.control = "AU";
    expect(hasLoc(G, "FR", "silesia")).toBe(true);
    expect(hasPeacetimeTreatyLoc(G, "FR", "silesia")).toBe(false);
    const choice: TreatyChoice = {option: "righteousDefense", space: "silesia", righteousMode: "take"};
    expect(canApplyTreaty(G, G.war!, classifyVictory(G, G.war!), choice).issues.map((issue) => issue.code)).toContain("no-loc");
  });

  test("a chain of own control makes the acquisition legal, with no state mutations during validation", () => {
    const G = fresh("RU", "FR");
    G.spaces.silesia.control = "RU";
    G.spaces.saxony.control = G.spaces.bavaria.control = "FR";
    const before = JSON.stringify(G);
    expect(hasPeacetimeTreatyLoc(G, "FR", "silesia")).toBe(true);
    expect(canApplyTreaty(G, G.war!, classifyVictory(G, G.war!), {option: "righteousDefense", space: "silesia"}).ok).toBe(true);
    expect(JSON.stringify(G)).toBe(before);
  });

  test("the separate home-return option requires neither occupation nor a supply line", () => {
    const G = fresh("GE", "FR");
    G.spaces.canada.control = "GE";
    const victory = classifyVictory(G, G.war!, {negotiatedPeace: "attacker"});
    const choice: TreatyChoice = {option: "righteousDefense", righteousMode: "returnHome", space: "canada", beneficiary: "UK"};
    expect(canApplyTreaty(G, G.war!, victory, choice).ok).toBe(true);
    expect(G.war!.defenderAllies).not.toContain("UK");
    expect(treatyOptionsFor(G, G.war!, victory).find((entry) => entry.id === "righteousDefense@UK")?.spaces).toContain("canada");
    expect(applyTreaty(G, G.war!, victory, choice).applied).toBe(true);
    expect(G.spaces.canada.control).toBe("UK");
  });

  test("home returns may restore a neutral minor, but cannot donate unrelated territory to it", () => {
    const G = fresh("GE", "FR");
    G.spaces.bavaria.control = "GE";
    const victory = classifyVictory(G, G.war!);
    const choice: TreatyChoice = {option: "righteousDefense", righteousMode: "returnHome", space: "bavaria", beneficiary: "Bavaria"};
    expect(canApplyTreaty(G, G.war!, victory, choice).ok).toBe(true);
    expect(canApplyTreaty(G, G.war!, victory, {...choice, space: "berlin"}).ok).toBe(false);
    expect(applyTreaty(G, G.war!, victory, choice).applied).toBe(true);
    expect(G.spaces.bavaria).toMatchObject({control: "Bavaria", ally: null});
  });
});
