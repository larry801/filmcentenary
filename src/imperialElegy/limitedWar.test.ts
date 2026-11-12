import {setupImperialElegy} from "./engine/setup";
import {declareWar} from "./moves";
import {
  allyCallEligibility,
  allyRefusalPenalty,
  applyTreaty,
  applyVictoryOutcome,
  canApplyTreaty,
  classifyVictory,
  conquestDeclarationPenalty,
  createWarState,
  demobilizeWar,
  initiativeOrder,
  joinWarAsAlly,
  joinWarAsMinor,
  settleLimitedWar,
  validateWarAim,
  warBudgetCardId,
} from "./engine/limitedWar";
import {cardById} from "./engine/deck";
import {POWERS, type Power, type WarState} from "./types";

const makeCtx = (playerID: string | null = "0") => ({
  playerID,
  random: {Die: () => 3},
  events: {setPhase: jest.fn(), setActivePlayers: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "action",
}) as any;

const fresh = () => setupImperialElegy(makeCtx());

const newWar = (
  G: ReturnType<typeof fresh>,
  attacker: Power = "GE",
  defender: Power = "AU",
  aim: "liberation" | "unification" | "conquest" = "conquest",
  objectives: string[] = ["bohemia"],
): WarState => {
  const war = createWarState(G, attacker, defender, aim, objectives, 2);
  G.war = war;
  return war;
};

// ---------------------------------------------------------------------------
// War aim validation
// ---------------------------------------------------------------------------

test("war aim validation: liberation requires a home space or rebellion", () => {
  const G = fresh();
  G.spaces.berlin.control = "AU";
  const home = validateWarAim(G, "GE", "AU", "liberation", ["berlin"]);
  expect(home.ok).toBe(true);

  G.spaces.berlin.rebellion = {minor: "Prussians", step: 0, rebels: ["r1"]};
  const both = validateWarAim(G, "GE", "AU", "liberation", ["berlin"]);
  expect(both.ok).toBe(false);
  expect(both.issues.map((issue) => issue.code)).toContain("liberation-home-and-rebellion");

  G.spaces.berlin.rebellion = null;
  G.spaces.bohemia.rebellion = {minor: "Czechs", step: 1, rebels: ["r2"]};
  const rebellion = validateWarAim(G, "GE", "AU", "liberation", ["bohemia"]);
  expect(rebellion.ok).toBe(true);

  G.spaces.bohemia.rebellion = null;
  const invalid = validateWarAim(G, "GE", "AU", "liberation", ["bohemia"]);
  expect(invalid.ok).toBe(false);
  expect(invalid.issues.some((issue) => issue.code === "liberation-not-home-or-rebellion")).toBe(true);
});

test("war aim validation: objective counts, control and duplicates", () => {
  const G = fresh();
  expect(validateWarAim(G, "GE", "AU", "conquest", []).issues.map((issue) => issue.code)).toContain("no-objectives");
  expect(
    validateWarAim(G, "GE", "AU", "conquest", ["bohemia", "tyrol", "galicia"]).issues.map((issue) => issue.code),
  ).toContain("too-many-objectives");

  const duplicate = validateWarAim(G, "GE", "AU", "conquest", ["bohemia", "bohemia"]);
  expect(duplicate.issues.some((issue) => issue.code === "duplicate-objective")).toBe(true);

  const notControlled = validateWarAim(G, "GE", "AU", "conquest", ["berlin"]);
  expect(notControlled.issues.some((issue) => issue.code === "objective-not-controlled")).toBe(true);

  const unknown = validateWarAim(G, "GE", "AU", "conquest", ["not-a-space"]);
  expect(unknown.issues.some((issue) => issue.code === "unknown-space")).toBe(true);
});

test("war aim validation: unification nationality and conquest key limits", () => {
  const G = fresh();
  G.spaces.bavaria.control = "AU";
  expect(validateWarAim(G, "GE", "AU", "unification", ["bavaria"]).ok).toBe(true);

  const notGerman = validateWarAim(G, "GE", "AU", "unification", ["bohemia"]);
  expect(notGerman.issues.some((issue) => issue.code === "unification-not-german")).toBe(true);

  const wrongPower = validateWarAim(G, "FR", "AU", "unification", ["bavaria"]);
  expect(wrongPower.issues.some((issue) => issue.code === "unification-wrong-power")).toBe(true);

  G.powers.AU.citizenship = ["Czechs"];
  G.spaces.bohemia.control = "GE";
  expect(validateWarAim(G, "AU", "GE", "unification", ["bohemia"]).ok).toBe(true);
  G.powers.AU.citizenship = [];
  const noCitizenship = validateWarAim(G, "AU", "GE", "unification", ["bohemia"]);
  expect(noCitizenship.issues.some((issue) => issue.code === "unification-not-citizenship")).toBe(true);

  G.spaces.bohemia.control = "AU";
  G.spaces.tyrol.control = "AU";
  expect(validateWarAim(G, "GE", "AU", "conquest", ["bohemia"]).ok).toBe(true);
  const twoKeys = validateWarAim(G, "GE", "AU", "conquest", ["bohemia", "tyrol"]);
  expect(twoKeys.issues.some((issue) => issue.code === "conquest-too-many-keys")).toBe(true);

  const capital = validateWarAim(G, "GE", "AU", "conquest", ["vienna"]);
  expect(capital.issues.some((issue) => issue.code === "conquest-capital")).toBe(true);

  G.spaces.dardanelles.control = "AU";
  expect(validateWarAim(G, "GE", "AU", "conquest", ["bohemia", "dardanelles"]).ok).toBe(true);
});

test("war declaration helpers expose the conquest penalty and base budget", () => {
  const G = fresh();
  G.wtt = 1;
  expect(conquestDeclarationPenalty(G)).toEqual({wttDelta: 1, stabilityDelta: -2});
  expect(conquestDeclarationPenalty(G, 1)).toEqual({wttDelta: 1, stabilityDelta: -1});

  const war = createWarState(G, "GE", "AU", "conquest", ["bohemia"], 3);
  expect(war.budgets.GE).toBe(3 + G.powers.GE.industry);
  expect(war.budgets.AU).toBe(0);
  expect(war.startedTurn).toBe(G.turn);
});

// ---------------------------------------------------------------------------
// Alliance calls
// ---------------------------------------------------------------------------

test("call-ally eligibility grants the joining side and a card + industry budget", () => {
  const G = fresh();
  const war = newWar(G);
  G.powers.GE.alliance = "taCommitted";
  G.powers.RU.alliance = "taCommitted";

  const cardId = warBudgetCardId(G, "RU");
  expect(cardId).not.toBeNull();
  const call = allyCallEligibility(G, war, "GE", "RU");
  expect(call.ok).toBe(true);
  expect(call.side).toBe("attacker");
  expect(call.cardId).toBe(cardId);
  expect(call.budget).toBe(cardById(cardId!).cp + G.powers.RU.industry);

  const joined = joinWarAsAlly(G, war, "GE", "RU");
  expect(joined.applied).toBe(true);
  expect(war.attackerAllies).toContain("RU");
  expect(war.budgets.RU).toBe(joined.budget);
  expect(G.powers.RU.hand).not.toContain(joined.cardId);
  expect(G.discard).toContain(joined.cardId);
  expect(allyCallEligibility(G, war, "GE", "RU").reason).toBe("already-belligerent");

  G.powers.UK.alliance = "teCommitted";
  expect(allyCallEligibility(G, war, "GE", "UK").reason).toBe("not-allied");

  G.powers.FR.alliance = "taCommitted";
  G.powers.FR.hand = [];
  expect(allyCallEligibility(G, war, "GE", "FR").reason).toBe("no-valid-card");
});

test("ally refusal penalties and truce exemption", () => {
  const G = fresh();
  G.powers.RU.alliance = "taCommitted";
  expect(allyRefusalPenalty(G, "RU")).toEqual({stability: -1, neutralInfluence: 10, exemptForTruce: false});
  G.powers.RU.alliance = "taAligned";
  expect(allyRefusalPenalty(G, "RU")).toEqual({stability: 0, neutralInfluence: 5, exemptForTruce: false});

  G.powers.GE.alliance = "taCommitted";
  G.powers.RU.alliance = "taCommitted";
  const war = newWar(G);
  const truce = allyCallEligibility(G, war, "GE", "RU", {truceWith: ["AU"]});
  expect(truce.reason).toBe("truce");
  expect(truce.refusal).toEqual({stability: 0, neutralInfluence: 0, exemptForTruce: true});
});

test("minor allies join their caller's side for free", () => {
  const G = fresh();
  const war = newWar(G);
  G.spaces.bavaria.ally = "GE";
  const joined = joinWarAsMinor(G, war, "GE", "Bavaria");
  expect(joined).toMatchObject({ok: true, side: "attacker", applied: true});
  expect(war.attackerMinors).toContain("Bavaria");
  expect(war.budgets.Bavaria).toBeUndefined();
  expect(joinWarAsMinor(G, war, "GE", "Bavaria").reason).toBe("already-belligerent");
});

// ---------------------------------------------------------------------------
// Initiative
// ---------------------------------------------------------------------------

test("initiative order uses card CP, Bewegungskrieg ties and industry", () => {
  const G = fresh();
  const war = newWar(G);
  G.powers.GE.industry = 1;
  G.powers.AU.industry = 1;

  war.budgets = {GE: 6, AU: 9};
  expect(initiativeOrder(G, war)).toEqual(["AU", "GE"]);

  war.budgets = {GE: 5, AU: 5};
  expect(initiativeOrder(G, war)).toEqual(["GE", "AU"]);

  // GE wins the card-CP tie before industry is compared.
  war.budgets = {GE: 4, AU: 6};
  G.powers.GE.industry = 1;
  G.powers.AU.industry = 3;
  expect(initiativeOrder(G, war)).toEqual(["GE", "AU"]);
  expect(initiativeOrder(G, war, {bewegungskrieg: false})).toEqual(["AU", "GE"]);

  const G2 = fresh();
  const war2 = createWarState(G2, "AU", "FR", "conquest", ["alsace-lorraine"], 2);
  G2.war = war2;
  G2.powers.AU.industry = 1;
  G2.powers.FR.industry = 2;
  expect(initiativeOrder(G2, war2, {cardCp: {AU: 4, FR: 4}})).toEqual(["FR", "AU"]);

  G2.powers.FR.industry = 1;
  // Final ties fall back to seat order (FR = 2, AU = 3) deterministically.
  expect(initiativeOrder(G2, war2, {cardCp: {AU: 4, FR: 4}})).toEqual(["FR", "AU"]);
});

// ---------------------------------------------------------------------------
// Victory classification
// ---------------------------------------------------------------------------

test("victory classification: major, normal, defensive, negotiated and white peace", () => {
  const G = fresh();
  const war = newWar(G);
  G.spaces.vienna.occupiedBy = "GE";
  const major = classifyVictory(G, war);
  expect(major).toMatchObject({
    kind: "major",
    primary: "major",
    victor: "attacker",
    winner: "GE",
    loser: "AU",
    treatyOptions: 2,
    truceTurns: 2,
  });
  expect(major.stability).toEqual({winner: 1, loser: -1});

  const G2 = fresh();
  const war2 = newWar(G2);
  G2.spaces.bohemia.control = "GE";
  expect(classifyVictory(G2, war2)).toMatchObject({
    kind: "normal",
    victor: "attacker",
    winner: "GE",
    treatyOptions: 1,
    truceTurns: 2,
  });

  const G3 = fresh();
  const war3 = newWar(G3);
  G3.spaces.silesia.occupiedBy = "AU";
  expect(classifyVictory(G3, war3, {attackerControlledAtStart: ["silesia"]})).toMatchObject({
    kind: "defensive",
    victor: "defender",
    winner: "AU",
    treatyOptions: 1,
  });

  const G4 = fresh();
  const war4 = newWar(G4);
  expect(classifyVictory(G4, war4, {negotiatedPeace: "attacker"})).toMatchObject({
    kind: "negotiated",
    victor: "defender",
    winner: "AU",
    treatyOptions: 1,
  });
  expect(classifyVictory(G4, war4)).toMatchObject({
    kind: "whitePeace",
    victor: null,
    winner: null,
    treatyOptions: 0,
    truceTurns: 1,
  });
});

test("victory classification: ally knockout is separate from the primary result", () => {
  const G = fresh();
  const war = newWar(G);
  war.attackerAllies = ["RU"];
  war.defenderAllies = ["OT"];
  G.spaces["st-petersburg"].occupiedBy = "OT";

  const victory = classifyVictory(G, war);
  expect(victory.kind).toBe("allyKnockout");
  expect(victory.primary).toBe("whitePeace");
  expect(victory.victor).toBe("defender");
  expect(victory.winner).toBe("AU");
  expect(victory.loser).toBe("RU");
  expect(victory.allyKnockoutTreatyOptions).toBe(1);
  expect(victory.totalTreatyOptions).toBe(1);
  expect(victory.truceTurns).toBe(1);
  expect(victory.allyKnockouts[0]).toMatchObject({
    power: "RU",
    by: "defender",
    occupier: "AU",
    capital: "st-petersburg",
  });
});

test("victory outcome applies major stability and truce hooks", () => {
  const G = fresh();
  const war = newWar(G);
  G.spaces.vienna.occupiedBy = "GE";
  const victory = classifyVictory(G, war);
  const outcome = applyVictoryOutcome(G, war, victory);
  expect(outcome.stability).toEqual([
    {power: "GE", delta: 1},
    {power: "AU", delta: -1},
  ]);
  expect(G.powers.GE.stability).toBe(4);
  expect(G.powers.AU.stability).toBe(2);
  expect(war.victor).toBe("attacker");
  expect(war.truceTurns).toBe(2);
  expect(war.status).toBe("victory");

  const G2 = fresh();
  const war2 = newWar(G2);
  const white = classifyVictory(G2, war2);
  applyVictoryOutcome(G2, war2, white);
  expect(war2.victor).toBeNull();
  expect(war2.truceTurns).toBe(1);
});

// ---------------------------------------------------------------------------
// Treaty options
// ---------------------------------------------------------------------------

test("treaty: territorial cession moves objectives and is once-per-option", () => {
  const G = fresh();
  const war = newWar(G);
  G.spaces.bohemia.occupiedBy = "GE";
  const victory = classifyVictory(G, war);
  expect(victory.kind).toBe("normal");

  const choice = {option: "territorialCession" as const};
  expect(canApplyTreaty(G, war, victory, choice).ok).toBe(true);
  const applied = applyTreaty(G, war, victory, choice);
  expect(applied.applied).toBe(true);
  expect(G.spaces.bohemia.control).toBe("GE");
  expect(G.spaces.bohemia.occupiedBy).toBeNull();
  expect(war.treaties).toContain("territorialCession");
  expect(canApplyTreaty(G, war, victory, choice).ok).toBe(false);
});

test("treaty: liberation cession returns a home space and liberates a minor", () => {
  const G = fresh();
  G.spaces["alsace-lorraine"].control = "GE";
  const war = createWarState(G, "FR", "GE", "liberation", ["alsace-lorraine"], 2);
  G.war = war;
  G.spaces["alsace-lorraine"].occupiedBy = "FR";
  const victory = classifyVictory(G, war);
  expect(victory.kind).toBe("normal");
  expect(applyTreaty(G, war, victory, {option: "territorialCession"}).applied).toBe(true);
  expect(G.spaces["alsace-lorraine"].control).toBe("FR");

  const G2 = fresh();
  G2.spaces.hanover.control = "AU";
  G2.spaces.hanover.rebellion = {minor: "Hanover", step: 0, rebels: ["r1"]};
  const war2 = createWarState(G2, "GE", "AU", "liberation", ["hanover"], 2);
  G2.war = war2;
  G2.spaces.hanover.occupiedBy = "GE";
  const victory2 = classifyVictory(G2, war2);
  expect(applyTreaty(G2, war2, victory2, {option: "territorialCession"}).applied).toBe(true);
  expect(G2.spaces.hanover.control).toBe("Hanover");
  expect(G2.spaces.hanover.ally).toBe("GE");
});

test("treaty: realignment and war reparations", () => {
  const G = fresh();
  const war = newWar(G);
  G.spaces.hanover.ally = "AU";
  G.spaces.bohemia.occupiedBy = "GE";
  G.spaces.tyrol.occupiedBy = "GE";
  const victory = classifyVictory(G, war);
  expect(victory.kind).toBe("normal");

  const realignment = applyTreaty(G, war, victory, {option: "realignment", minor: "Hanover"});
  expect(realignment.applied).toBe(true);
  expect(G.spaces.hanover.ally).toBe("GE");

  const reparations = applyTreaty(G, war, victory, {option: "warReparations"});
  expect(reparations.applied).toBe(true);
  expect(G.powers.GE.cardMarkers).toBe(1);
  expect(G.powers.AU.cardMarkers).toBe(-1);
});

test("treaty: righteous defense and colonial cession", () => {
  const G = fresh();
  const war = newWar(G);
  G.spaces.silesia.occupiedBy = "AU";
  const victory = classifyVictory(G, war, {attackerControlledAtStart: ["silesia"]});
  expect(victory.kind).toBe("defensive");
  const righteous = applyTreaty(G, war, victory, {option: "righteousDefense", space: "silesia"});
  expect(righteous.applied).toBe(true);
  expect(G.spaces.silesia.control).toBe("AU");
  expect(G.spaces.silesia.occupiedBy).toBeNull();

  const G2 = fresh();
  const war2 = createWarState(G2, "GE", "UK", "conquest", ["malta"], 2);
  G2.war = war2;
  G2.spaces.malta.occupiedBy = "GE";
  const victory2 = classifyVictory(G2, war2);
  expect(victory2.kind).toBe("normal");
  const colonial = applyTreaty(G2, war2, victory2, {option: "colonialCession", space: "malta"});
  expect(colonial.applied).toBe(true);
  expect(G2.spaces.malta.control).toBe("GE");

  const G3 = fresh();
  const war3 = createWarState(G3, "GE", "UK", "conquest", ["malta"], 2);
  G3.war = war3;
  G3.spaces.malta.occupiedBy = "GE";
  const victory3 = classifyVictory(G3, war3);
  const canada = canApplyTreaty(G3, war3, victory3, {option: "colonialCession", space: "canada"});
  expect(canada.ok).toBe(false);
  expect(canada.issues.some((issue) => issue.code === "colonial-home-not-occupied")).toBe(true);
});

// ---------------------------------------------------------------------------
// Demobilization and the full sequence
// ---------------------------------------------------------------------------

test("demobilization returns reserves, clears the war and hands back the action phase", () => {
  const G = fresh();
  const war = newWar(G);
  G.phase = "wartime";

  const reserveId = G.powers.GE.reserves[0];
  expect(reserveId).toBeDefined();
  const reserve = G.units[reserveId];
  reserve.space = "berlin";
  G.powers.GE.reserves = G.powers.GE.reserves.filter((id) => id !== reserveId);
  G.spaces.berlin.units.push(reserveId);

  const ctx = makeCtx("0");
  const result = demobilizeWar(G, war, ctx);
  expect(result.ok).toBe(true);
  expect(result.reservesReturned.find((entry) => entry.power === "GE")?.unitIds).toContain(reserveId);
  expect(reserve.space).toBeNull();
  expect(G.powers.GE.reserves).toContain(reserveId);
  expect(G.spaces.berlin.units).not.toContain(reserveId);
  expect(G.war).toBeNull();
  expect(G.wars).toContain(war);
  expect(war.status).toBe("done");
  expect(G.phase).toBe("action");
  expect(G.activePower).toBe("GE");
  expect(G.passed).toEqual([]);
  expect(ctx.events.setPhase).toHaveBeenCalledWith("action");
  expect(result.freeActions[0]).toMatchObject({power: "GE", side: "attacker", order: 1});

  expect(demobilizeWar(G, war).ok).toBe(false);
  expect(G.wars).toHaveLength(1);
});

test("full limited war: declaration, major victory, treaty and demobilization", () => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 2;
  G.spaces.bavaria.control = "AU";

  expect(validateWarAim(G, "GE", "AU", "unification", ["bavaria"]).ok).toBe(true);
  const ctx = makeCtx("0");
  expect(declareWar(G, ctx, "AU", "unification", ["bavaria"], 2)).toBeUndefined();
  expect(G.war).not.toBeNull();
  expect(G.phase).toBe("wartime");
  expect(G.war!.status).toBe("warAim");
  expect(G.war!.budgets.GE).toBe(3);

  const reserveId = G.powers.GE.reserves[0];
  G.units[reserveId].space = "berlin";
  G.powers.GE.reserves = G.powers.GE.reserves.filter((id) => id !== reserveId);
  G.spaces.berlin.units.push(reserveId);

  G.spaces.vienna.occupiedBy = "GE";
  const victory = classifyVictory(G, G.war!);
  expect(victory.kind).toBe("major");

  const settlement = settleLimitedWar(
    G,
    victory,
    [{option: "territorialCession", spaces: ["bavaria"]}],
    ctx,
  );
  expect(settlement.ok).toBe(true);
  expect(G.war).toBeNull();
  expect(G.wars).toHaveLength(1);
  expect(G.wars[0].victor).toBe("attacker");
  expect(G.wars[0].truceTurns).toBe(2);
  expect(G.spaces.bavaria.control).toBe("GE");
  expect(G.spaces.bavaria.occupiedBy).toBeNull();
  expect(G.powers.GE.stability).toBe(4);
  expect(G.powers.AU.stability).toBe(2);
  expect(G.phase).toBe("action");
  expect(G.activePower).toBe("GE");
  expect(G.units[reserveId].space).toBeNull();
  expect(G.powers.GE.reserves).toContain(reserveId);
  expect(POWERS).toContain(G.wars[0].attacker);
});
