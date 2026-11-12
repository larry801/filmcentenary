import {BattleState, GreatWarState, ImperialElegyState, Power, SpaceId, Unit} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {cardsToDraw, changeStability} from "./engine/rules";
import {supportCandidates, unitFp, beginLandBattle} from "./engine/combat";
import {discardHandAtEndOfTurn} from "./engine/deck";

const makeCtx = (die = 3) => ({
  playerID: "0",
  random: {Die: (_sides: number) => die},
  events: {setPhase: () => {}, setActivePlayers: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "action",
}) as any;

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const activateGw = (G: ImperialElegyState): void => {
  const gw: GreatWarState = {
    active: true,
    turn: 1,
    order: [],
    belligerents: [],
    neutrals: [],
    te: [],
    ta: [],
    usIn: false,
    italyIn: false,
    usStability: 3,
    usManpower: 3,
    usBudget: 4,
    italyStability: 3,
    italyManpower: 3,
    italyBudget: 2,
    trenches: {},
    lastColonialWar: null,
    victor: null,
    outbreakDone: true,
    nationalWillDone: true,
    bonusImpulses: [],
  };
  G.gw = gw;
};

const findUnit = (G: ImperialElegyState, predicate: (u: Unit) => boolean): Unit => {
  const unit = Object.values(G.units).find(predicate);
  if (!unit) throw new Error("test setup is missing the expected unit");
  return unit;
};

const moveUnit = (G: ImperialElegyState, unit: Unit, to: SpaceId): void => {
  if (unit.space) G.spaces[unit.space].units = G.spaces[unit.space].units.filter((id) => id !== unit.id);
  G.spaces[to].units.push(unit.id);
  unit.space = to;
};

const makeBattle = (
  attacker: Power,
  defender: Power,
  from: SpaceId,
  to: SpaceId,
  mainAttack: string[] = [],
  mainDefense: string[] = [],
): BattleState => ({
  kind: "land",
  attacker,
  defender,
  from,
  to,
  mainAttack,
  mainDefense,
  supportAttack: [],
  supportDefense: [],
  stage: "roll",
  supportSide: "attacker",
  attackerDrm: 0,
  defenderDrm: 0,
  attackerLosses: 0,
  defenderLosses: 0,
  decisive: false,
  notes: [],
});

// ---------------------------------------------------------------------------
// cardsToDraw -> cardDrawModifier
// ---------------------------------------------------------------------------

describe("cardsToDraw national characteristics", () => {
  test("UK India stable contributes one more card than unstable", () => {
    const G = fresh();
    G.spaces.india.control = "UK";
    G.powers.UK.indiaStable = true;
    const stable = cardsToDraw(G, "UK");

    G.powers.UK.indiaStable = false;
    const unstable = cardsToDraw(G, "UK");

    expect(stable - unstable).toBe(1);
  });

  test("FR City of Light contributes a card at 4 points but not at 3", () => {
    const G = fresh();
    G.powers.FR.cityOfLight = 3;
    const atThree = cardsToDraw(G, "FR");

    G.powers.FR.cityOfLight = 4;
    const atFour = cardsToDraw(G, "FR");

    expect(atFour - atThree).toBe(1);
  });

  test("RU completed TSRR contributes a card", () => {
    const G = fresh();
    const before = cardsToDraw(G, "RU");
    G.powers.RU.tsrr = true;
    expect(cardsToDraw(G, "RU") - before).toBe(1);
  });

  test("negative: characteristics belonging to other powers add nothing", () => {
    const G = fresh();
    const baseline = cardsToDraw(G, "GE");
    G.powers.GE.cityOfLight = 5;
    G.powers.GE.tsrr = true;
    G.powers.GE.indiaStable = true;
    expect(cardsToDraw(G, "GE")).toBe(baseline);
  });
});

// ---------------------------------------------------------------------------
// changeStability -> stabilityLoss
// ---------------------------------------------------------------------------

describe("changeStability national characteristics", () => {
  test("AU Unstable Situation rolls 6+ with rights DRMs and logs a failure", () => {
    const G = fresh();
    G.powers.AU.stability = 3;
    G.powers.AU.rights = ["Hungarians", "Czechs"];

    const applied = changeStability(G, "AU", -1, makeCtx(3));

    expect(applied).toBe(-1);
    expect(G.powers.AU.stability).toBe(2);
    const entry = G.log.find((e) => e.key === "auUnstable" && e.power === "AU");
    expect(entry).toBeDefined();
    expect(entry!.args).toMatchObject({roll: 3, rights: 2});
  });

  test("AU Unstable Situation passes on 6+ and does not log", () => {
    const G = fresh();
    G.powers.AU.stability = 3;
    G.powers.AU.rights = ["Hungarians", "Czechs"];

    changeStability(G, "AU", -1, makeCtx(4));

    expect(G.powers.AU.stability).toBe(2);
    expect(G.log.some((e) => e.key === "auUnstable")).toBe(false);
  });

  test("AU Unstable Situation is inert during the Great War and rolls no die", () => {
    const G = fresh();
    activateGw(G);
    G.powers.AU.stability = 3;
    G.powers.AU.rights = ["Hungarians", "Czechs"];
    let rolls = 0;
    const ctx = {...makeCtx(), random: {Die: () => { rolls += 1; return 1; }}};

    changeStability(G, "AU", -1, ctx);

    expect(G.powers.AU.stability).toBe(2);
    expect(G.log.some((e) => e.key === "auUnstable")).toBe(false);
    expect(rolls).toBe(0);
  });

  test("FR Second Empire becomes Third Republic at stability 1 outside the GW", () => {
    const G = fresh();
    G.powers.FR.stability = 1;

    changeStability(G, "FR", -1, makeCtx());

    expect(G.powers.FR.stability).toBe(0);
    expect(G.powers.FR.government).toBe("thirdRepublic");
    expect(G.log.some((e) => e.key === "frThirdRepublic" && e.power === "FR")).toBe(true);
  });

  test("FR does not switch to the Republic during the Great War", () => {
    const G = fresh();
    activateGw(G);
    G.powers.FR.stability = 2;

    changeStability(G, "FR", -1, makeCtx());

    expect(G.powers.FR.stability).toBe(1);
    expect(G.powers.FR.government).toBe("secondEmpire");
    expect(G.log.some((e) => e.key === "frThirdRepublic")).toBe(false);
  });

  test("FR lost-war option switches at any stability", () => {
    const G = fresh();
    G.powers.FR.stability = 5;

    changeStability(G, "FR", 0, makeCtx(), {lostWar: true});

    expect(G.powers.FR.stability).toBe(5);
    expect(G.powers.FR.government).toBe("thirdRepublic");
  });

  test("RU Scorched Earth absorbs the first GW key loss and is consumed", () => {
    const G = fresh();
    activateGw(G);
    G.powers.RU.stability = 4;
    G.powers.RU.scorchedEarth = true;

    const first = changeStability(G, "RU", -1, makeCtx(), {cause: "keyLoss"});
    expect(first).toBe(0);
    expect(G.powers.RU.stability).toBe(4);
    expect(G.powers.RU.scorchedEarth).toBe(false);

    const second = changeStability(G, "RU", -1, makeCtx(), {cause: "keyLoss"});
    expect(second).toBe(-1);
    expect(G.powers.RU.stability).toBe(3);
  });

  test("negative: Scorched Earth does not absorb a non-key loss", () => {
    const G = fresh();
    activateGw(G);
    G.powers.RU.stability = 4;
    G.powers.RU.scorchedEarth = true;

    expect(changeStability(G, "RU", -1, makeCtx(), {cause: "card"})).toBe(-1);
    expect(G.powers.RU.stability).toBe(3);
    expect(G.powers.RU.scorchedEarth).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// beginLandBattle -> landBattleModifier
// ---------------------------------------------------------------------------

describe("beginLandBattle characteristic DRMs", () => {
  test("UK 1st Army adds +1 to the attacker DRM", () => {
    const G = fresh();
    G.phase = "wartime";
    const firstArmy = findUnit(G, (u) => u.owner === "UK" && Boolean(u.flags?.firstArmy));
    moveUnit(G, firstArmy, "hanover");

    const battle = beginLandBattle(G, makeCtx(), "UK", "hanover", "saxony");

    expect(battle).not.toBeNull();
    expect(battle!.attackerDrm).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// supportCandidates -> endlessSpaceSupport
// ---------------------------------------------------------------------------

describe("supportCandidates Russian support halving", () => {
  test("halves support when the battle is fought from a Russian home space", () => {
    const G = fresh();
    const russianArmy = findUnit(G, (u) => u.owner === "RU" && u.kind === "army" && u.space === "riga");
    // Silesia is adjacent to both Poland (a Russian home space) and Galicia.
    moveUnit(G, russianArmy, "silesia");

    const battle = makeBattle("RU", "AU", "poland", "galicia");
    const support = supportCandidates(G, "RU", battle, "attacker");
    const fromSilesia = support.find((s) => s.space === "silesia");

    expect(fromSilesia).toBeDefined();
    expect(unitFp(russianArmy)).toBe(2);
    expect(fromSilesia!.fp).toBe(1);
    expect(fromSilesia!.fp).toBe(Math.ceil(unitFp(russianArmy) / 2));
  });

  test("negative: no halving when neither battle space is a Russian home space", () => {
    const G = fresh();
    const russianArmy = findUnit(G, (u) => u.owner === "RU" && u.kind === "army" && u.space === "riga");
    // Pomerania is adjacent to Berlin only, so a single Russian army supports.
    moveUnit(G, russianArmy, "pomerania");

    const battle = makeBattle("RU", "GE", "berlin", "saxony");
    const support = supportCandidates(G, "RU", battle, "attacker");
    const fromPomerania = support.find((s) => s.space === "pomerania");

    expect(fromPomerania).toBeDefined();
    expect(fromPomerania!.fp).toBe(unitFp(russianArmy));
  });
});

// ---------------------------------------------------------------------------
// discardHandAtEndOfTurn -> banking.saveLimit
// ---------------------------------------------------------------------------

describe("discardHandAtEndOfTurn save limit", () => {
  const hand = ["IE-A018", "IE-A019", "IE-A020"];

  test("UK British Banking saves two cards", () => {
    const G = fresh();
    G.powers.UK.hand = [...hand];
    G.powers.UK.flags.savedCards = hand.join(",");

    discardHandAtEndOfTurn(G, "UK");

    expect([...G.powers.UK.hand].sort()).toEqual(["IE-A018", "IE-A019"]);
    expect(G.powers.UK.hand).not.toContain("IE-A020");
  });

  test("negative: other powers save only one card", () => {
    const G = fresh();
    G.powers.GE.hand = [...hand];
    G.powers.GE.flags.savedCards = hand.join(",");

    discardHandAtEndOfTurn(G, "GE");

    expect(G.powers.GE.hand).toEqual(["IE-A018"]);
    expect(G.discard).toEqual(expect.arrayContaining(["IE-A019", "IE-A020"]));
  });
});
