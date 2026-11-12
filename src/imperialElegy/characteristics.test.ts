import {BattleState, GreatWarState, ImperialElegyState, Power, SpaceId} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {
  AU_NATIONALITIES,
  canGrantCitizenship,
  canRecruitIn,
  cardDrawModifier,
  dualMonarchy,
  governmentBenefits,
  industryRoll,
  landBattleModifier,
  metternichAllies,
  recruitmentLimits,
  stabilityLoss,
} from "./engine/characteristics";

const makeCtx = () => ({
  playerID: "0",
  random: {Die: (_sides: number) => 3},
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

const findUnit = (G: ImperialElegyState, predicate: (u: ImperialElegyState["units"][string]) => boolean) => {
  const unit = Object.values(G.units).find(predicate);
  if (!unit) throw new Error("test setup is missing the expected unit");
  return unit;
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
// stabilityLoss
// ---------------------------------------------------------------------------

describe("stabilityLoss", () => {
  test("RU Scorched Earth absorbs the first GW key loss once", () => {
    const G = fresh();
    activateGw(G);
    G.powers.RU.stability = 4;
    G.powers.RU.scorchedEarth = true;

    const first = stabilityLoss(G, "RU", -1, {cause: "keyLoss"});
    expect(first.scorchedEarth).toMatchObject({available: true, applies: true, consumes: true, keyLoss: true});
    expect(first.delta).toBe(0);
    expect(first.stabilityAfter).toBe(4);
    expect(first.prevented).toBe(true);
    expect(first.reasons).toContain("scorchedEarth");

    // Caller consumes the flag; the next key loss is real.
    G.powers.RU.scorchedEarth = false;
    const second = stabilityLoss(G, "RU", -1, {cause: "keyLoss"});
    expect(second.scorchedEarth.applies).toBe(false);
    expect(second.delta).toBe(-1);
    expect(second.stabilityAfter).toBe(3);
  });

  test("RU Scorched Earth does not apply outside the GW or to non-key losses", () => {
    const G = fresh();
    G.powers.RU.stability = 4;
    G.powers.RU.scorchedEarth = true;
    expect(stabilityLoss(G, "RU", -1, {cause: "keyLoss"}).delta).toBe(-1);
    activateGw(G);
    expect(stabilityLoss(G, "RU", -1, {cause: "card"}).delta).toBe(-1);
  });

  test("AU Unstable Situation rolls 6+ with rights DRMs and is inert during the GW", () => {
    const G = fresh();
    G.powers.AU.stability = 3;
    G.powers.AU.rights = ["Hungarians", "Czechs"];

    const fail = stabilityLoss(G, "AU", -1, {dieRoll: 3});
    expect(fail.unstableSituation).toMatchObject({
      applies: true,
      rights: 2,
      dieRoll: 3,
      total: 5,
      passes: false,
      effect: "discardCardOrMinusOneMarker",
    });

    const pass = stabilityLoss(G, "AU", -1, {dieRoll: 4});
    expect(pass.unstableSituation).toMatchObject({total: 6, passes: true, effect: "none"});

    const pending = stabilityLoss(G, "AU", -1);
    expect(pending.unstableSituation.effect).toBe("pending");
    expect(pending.unstableSituation.passes).toBeNull();

    activateGw(G);
    const duringGw = stabilityLoss(G, "AU", -1, {dieRoll: 1});
    expect(duringGw.unstableSituation.applies).toBe(false);
    expect(duringGw.unstableSituation.effect).toBe("none");
  });

  test("AU Unstable Situation does not trigger on a gain or a clamped non-loss", () => {
    const G = fresh();
    G.powers.AU.stability = 3;
    expect(stabilityLoss(G, "AU", 1, {dieRoll: 1}).unstableSituation.applies).toBe(false);
    G.powers.AU.stability = 0;
    expect(stabilityLoss(G, "AU", -1, {dieRoll: 1}).unstableSituation.applies).toBe(false);
  });

  test("FR Second Empire becomes Third Republic at stability 1, but not during the GW", () => {
    const G = fresh();
    expect(G.powers.FR.government).toBe("secondEmpire");
    G.powers.FR.stability = 1;

    const result = stabilityLoss(G, "FR", -1);
    expect(result.government).toMatchObject({
      from: "secondEmpire",
      to: "thirdRepublic",
      changed: true,
      reason: "stability",
    });
    expect(result.reasons).toContain("frThirdRepublic");

    const duringGw = fresh();
    activateGw(duringGw);
    duringGw.powers.FR.stability = 1;
    expect(stabilityLoss(duringGw, "FR", -1).government.changed).toBe(false);

    // A gain that happens to land on 1 does not create the Republic.
    const gain = fresh();
    gain.powers.FR.stability = 0;
    expect(stabilityLoss(gain, "FR", 1).government.changed).toBe(false);
  });

  test("FR switches on a lost war and does not re-switch once republican", () => {
    const G = fresh();
    G.powers.FR.stability = 5;
    expect(stabilityLoss(G, "FR", 0, {lostWar: true}).government).toMatchObject({
      changed: true,
      reason: "lostWar",
      to: "thirdRepublic",
    });

    G.powers.FR.government = "thirdRepublic";
    expect(stabilityLoss(G, "FR", -1, {lostWar: true}).government.changed).toBe(false);
  });

  test("other powers take the plain delta (all six powers covered)", () => {
    const G = fresh();
    for (const power of ["GE", "UK", "FR", "AU", "RU", "OT"] as Power[]) {
      G.powers[power].stability = 3;
      const result = stabilityLoss(G, power, -1);
      expect(result.delta).toBe(-1);
      expect(result.stabilityAfter).toBe(2);
    }
  });
});

// ---------------------------------------------------------------------------
// cardDrawModifier
// ---------------------------------------------------------------------------

describe("cardDrawModifier", () => {
  test("UK India stable adds one card and British Banking raises both limits", () => {
    const G = fresh();
    G.spaces.india.control = "UK";
    G.powers.UK.indiaStable = true;
    const result = cardDrawModifier(G, "UK");
    expect(result.delta).toBe(1);
    expect(result.india).toMatchObject({controlled: true, stable: true, delta: 1, relativeToStable: 0});
    expect(result.banking).toMatchObject({saveLimit: 2, passLimit: 2, minimumDraw: 3});
    expect(result.sources.some((s) => s.id === "indiaStable")).toBe(true);
    expect(result.sources.some((s) => s.id === "britishBanking")).toBe(true);
  });

  test("negative: UK India unstable removes the +1 and the banking limits stay British-only", () => {
    const G = fresh();
    G.powers.UK.indiaStable = false;
    const result = cardDrawModifier(G, "UK");
    expect(result.delta).toBe(0);
    expect(result.india).toMatchObject({stable: false, delta: 0, relativeToStable: -1});

    expect(cardDrawModifier(G, "GE").banking).toMatchObject({saveLimit: 1, passLimit: 1});
  });

  test("FR City of Light threshold is 4", () => {
    const G = fresh();
    G.powers.FR.cityOfLight = 4;
    expect(cardDrawModifier(G, "FR").delta).toBe(1);
    expect(cardDrawModifier(G, "FR").cityOfLight).toMatchObject({points: 4, threshold: 4, delta: 1});

    G.powers.FR.cityOfLight = 3;
    expect(cardDrawModifier(G, "FR").delta).toBe(0);
  });

  test("RU TSRR adds a card and Tsarist Repression is reported but non-cumulative", () => {
    const G = fresh();
    G.powers.RU.tsrr = true;
    G.powers.RU.stability = 5;
    const result = cardDrawModifier(G, "RU");
    expect(result.delta).toBe(1);
    expect(result.tsrr).toMatchObject({completed: true, delta: 1});
    expect(result.tsaristRepression).toMatchObject({
      activeAtStability5: true,
      atStability6: false,
      printedBonus: 1,
      netAdditional: 0,
      nonCumulative: true,
    });
    expect(result.sources.some((s) => s.id === "tsaristRepression")).toBe(true);

    G.powers.RU.stability = 6;
    const atSix = cardDrawModifier(G, "RU");
    expect(atSix.tsaristRepression.activeAtStability5).toBe(false);
    expect(atSix.tsaristRepression.atStability6).toBe(true);
    expect(atSix.tsaristRepression.netAdditional).toBe(0);
  });

  test("negative: RU Tsarist Repression is inactive below stability 5, and other powers have no bonus", () => {
    const G = fresh();
    G.powers.RU.stability = 4;
    expect(cardDrawModifier(G, "RU").tsaristRepression.activeAtStability5).toBe(false);

    for (const power of ["GE", "AU", "OT"] as Power[]) {
      expect(cardDrawModifier(G, power).delta).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// landBattleModifier
// ---------------------------------------------------------------------------

describe("landBattleModifier", () => {
  test("UK 1st Army gives +1 and Indian armies give -1 while India is unstable", () => {
    const G = fresh();
    const firstArmy = findUnit(G, (u) => u.owner === "UK" && Boolean(u.flags?.firstArmy));
    const indian = findUnit(G, (u) => u.owner === "UK" && Boolean(u.flags?.indian));

    const first = landBattleModifier(
      G,
      "UK",
      makeBattle("UK", "GE", "london", "north-atlantic", [firstArmy.id]),
    );
    expect(first).toMatchObject({side: "attacker", drm: 1});
    expect(first.sources.some((s) => s.id === "britishFirstArmy" && s.drm === 1)).toBe(true);

    G.powers.UK.indiaStable = false;
    const unstable = landBattleModifier(
      G,
      "UK",
      makeBattle("UK", "GE", "india", "bengal", [indian.id]),
    );
    expect(unstable.drm).toBe(-1);
    expect(unstable.sources.some((s) => s.id === "indianArmy" && s.drm === -1)).toBe(true);

    G.powers.UK.indiaStable = true;
    const stable = landBattleModifier(
      G,
      "UK",
      makeBattle("UK", "GE", "india", "bengal", [indian.id]),
    );
    expect(stable.drm).toBe(0);
  });

  test("FR Zouaves give +1, and a FR army without Zouaves gets nothing", () => {
    const G = fresh();
    const zouave = findUnit(G, (u) => u.kind === "zouave");
    const frenchArmy = findUnit(G, (u) => u.owner === "FR" && u.kind === "army");

    const withZouave = landBattleModifier(
      G,
      "FR",
      makeBattle("FR", "GE", "algeria", "tunisia", [zouave.id]),
    );
    expect(withZouave.drm).toBe(1);
    expect(withZouave.sources.some((s) => s.id === "zouaves" && s.drm === 1)).toBe(true);

    const without = landBattleModifier(
      G,
      "FR",
      makeBattle("FR", "GE", "paris", "saxony", [frenchArmy.id]),
    );
    expect(without.drm).toBe(0);
  });

  test("GE has no intrinsic land DRM, exposes Bewegungskrieg, and honours the event flag", () => {
    const G = fresh();
    const germanArmy = findUnit(G, (u) => u.owner === "GE" && u.kind === "army");
    const battle = makeBattle("GE", "AU", "berlin", "saxony", [germanArmy.id]);

    const plain = landBattleModifier(G, "GE", battle);
    expect(plain.drm).toBe(0);
    expect(plain.initiativeTieBreak).toBe(true);
    expect(plain.sources.some((s) => s.id === "bewegungskrieg")).toBe(true);

    G.powers.GE.flags.landDrm = 1;
    expect(landBattleModifier(G, "GE", battle).drm).toBe(1);

    activateGw(G);
    expect(landBattleModifier(G, "GE", battle).drm).toBe(0);
  });

  test("RU Endless Space halves support into/from a Russian home space", () => {
    const G = fresh();
    const russianHome = landBattleModifier(G, "RU", makeBattle("RU", "GE", "poland", "prussia"));
    expect(russianHome.endlessSpace.halvesSupport).toBe(true);
    expect(russianHome.endlessSpace.russianHomeSpaces).toEqual(expect.arrayContaining(["poland"]));

    const elsewhere = landBattleModifier(G, "RU", makeBattle("RU", "GE", "berlin", "saxony"));
    expect(elsewhere.endlessSpace.halvesSupport).toBe(false);
  });

  test("OT Jihad offers the opponent -1 only in a qualifying space and only with a marker", () => {
    const G = fresh();
    G.powers.OT.jihad = 3;
    const qualifying = landBattleModifier(
      G,
      "OT",
      makeBattle("OT", "RU", "istanbul", "ankara"),
    );
    expect(qualifying.jihad).toMatchObject({available: true, opponentDrm: -1, consume: true, markers: 3});
    expect(qualifying.jihad.qualifyingSpaces).toEqual(expect.arrayContaining(["istanbul", "ankara"]));
    expect(qualifying.drm).toBe(0);

    G.powers.OT.jihad = 0;
    expect(landBattleModifier(G, "OT", makeBattle("OT", "RU", "istanbul", "ankara")).jihad.available).toBe(false);

    G.powers.OT.jihad = 3;
    const nonQualifying = landBattleModifier(
      G,
      "OT",
      makeBattle("OT", "RU", "berlin", "saxony"),
    );
    expect(nonQualifying.jihad.available).toBe(false);
    expect(nonQualifying.jihad.opponentDrm).toBe(0);
  });

  test("AU has no land-battle DRM (sixth power covered)", () => {
    const G = fresh();
    const result = landBattleModifier(G, "AU", makeBattle("AU", "GE", "vienna", "bohemia"));
    expect(result).toMatchObject({side: "attacker", drm: 0});
    expect(result.sources).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// recruitmentLimits / canRecruitIn
// ---------------------------------------------------------------------------

describe("recruitmentLimits", () => {
  test("UK Professional Army: no reserves, one British army before the GW", () => {
    const G = fresh();
    const limits = recruitmentLimits(G, "UK");
    expect(limits).toMatchObject({reserveAllowed: false, reserveLimit: 0, reserveFormula: "none"});
    expect(limits.british).toMatchObject({preGw: true, britishArmyLimit: 1, canBuildAnotherBritishArmy: false});
    expect(canRecruitIn(G, "UK", null, "reserveArmy").allowed).toBe(false);
    // The setup already has the 1st British Army, so no second British army.
    expect(canRecruitIn(G, "UK", "london", "army").allowed).toBe(false);
  });

  test("UK may build more British armies after the GW (negative of the pre-GW limit)", () => {
    const G = fresh();
    activateGw(G);
    const limits = recruitmentLimits(G, "UK");
    expect(limits.british?.preGw).toBe(false);
    expect(limits.british?.britishArmyLimit).toBeNull();
    expect(limits.british?.canBuildAnotherBritishArmy).toBe(true);
  });

  test("RU Russian Steamroller adds one to the lower of manpower and industry", () => {
    const G = fresh();
    G.powers.RU.manpower = 4;
    G.powers.RU.industry = 2;
    const limits = recruitmentLimits(G, "RU");
    expect(limits.reserveAllowed).toBe(true);
    expect(limits.reserveLimit).toBe(3);
    expect(limits.reserveFormula).toBe("manpowerPlusOne");
    expect(limits.currentReserves).toBe(G.powers.RU.reserves.length);
  });

  test("base reserve limit is the lower of manpower and industry; UK is the exception", () => {
    const G = fresh();
    G.powers.GE.manpower = 5;
    G.powers.GE.industry = 2;
    expect(recruitmentLimits(G, "GE").reserveLimit).toBe(2);
    G.powers.AU.manpower = 1;
    G.powers.AU.industry = 3;
    expect(recruitmentLimits(G, "AU").reserveLimit).toBe(1);
    G.powers.FR.manpower = 3;
    G.powers.FR.industry = 1;
    expect(recruitmentLimits(G, "FR").reserveLimit).toBe(1);
  });

  test("OT tracks Turkish/Arab manpower and enforces Local Autonomy spaces", () => {
    const G = fresh();
    G.powers.OT.manpower = 5;
    G.powers.OT.secondaryManpower = 2;
    const limits = recruitmentLimits(G, "OT");
    expect(limits.ottoman).toMatchObject({
      separateManpower: true,
      turkishManpower: 5,
      arabManpower: 2,
      turkishRule: "keysWithoutMinorityNationality",
      arabRule: "arabNationalityKeysOnly",
    });
    expect(limits.ottoman?.arabKeySpaces).toEqual(expect.arrayContaining(["arabia", "egypt"]));

    // Turkish armies may not be built in an Arab key.
    expect(canRecruitIn(G, "OT", "arabia", "army", {ottoman: "turkish"}).allowed).toBe(false);
    // Arab armies may not be built in a Turkish key.
    expect(canRecruitIn(G, "OT", "ankara", "army", {ottoman: "arab"}).allowed).toBe(false);
    // Both are legal in their own kind of key.
    expect(canRecruitIn(G, "OT", "ankara", "army", {ottoman: "turkish"}).allowed).toBe(true);
    expect(canRecruitIn(G, "OT", "arabia", "army", {ottoman: "arab"}).allowed).toBe(true);
  });

  test("negative: OT Arab recruitment is refused without Arab manpower", () => {
    const G = fresh();
    G.powers.OT.secondaryManpower = 0;
    const decision = canRecruitIn(G, "OT", "arabia", "army", {ottoman: "arab"});
    expect(decision.allowed).toBe(false);
    expect(decision.reasons.join(" ")).toMatch(/Arab manpower/);
  });
});

// ---------------------------------------------------------------------------
// industryRoll
// ---------------------------------------------------------------------------

describe("industryRoll", () => {
  test("RU Agrarian needs a 6 after CP and DRMs", () => {
    const G = fresh();
    const plain = industryRoll(G, "RU", 2);
    expect(plain).toMatchObject({target: 6, source: "agrarian", allowed: true, allowsOwnCard: true});
    expect(plain.rollNeeded).toBe(4);

    G.powers.RU.flags.industryDrm = 2;
    expect(industryRoll(G, "RU", 2).rollNeeded).toBe(2);

    expect(industryRoll(G, "RU", 5).guaranteed).toBe(true);
  });

  test("OT Europeanization needs a 6 and cannot use an own card", () => {
    const G = fresh();
    const noCard = industryRoll(G, "OT", 2);
    expect(noCard).toMatchObject({target: 6, source: "europeanization", allowed: true, allowsOwnCard: false});

    const ownCard = industryRoll(G, "OT", 2, {cardOwner: "OT", cardId: "IE-A099"});
    expect(ownCard.allowed).toBe(false);
    expect(ownCard.reasons.join(" ")).toMatch(/own card/);
  });

  test("negative: other powers need only a 5", () => {
    const G = fresh();
    for (const power of ["GE", "UK", "FR", "AU"] as Power[]) {
      const result = industryRoll(G, power, 2);
      expect(result.target).toBe(5);
      expect(result.source).toBe("standard");
    }
  });
});

// ---------------------------------------------------------------------------
// canGrantCitizenship
// ---------------------------------------------------------------------------

describe("canGrantCitizenship", () => {
  test("AU needs rights first and gains +1 difficulty per existing citizen", () => {
    const G = fresh();
    G.powers.AU.rights = ["Hungarians"];
    G.powers.AU.citizenship = [];
    const base = canGrantCitizenship(G, "AU", "Hungarians");
    expect(base).toMatchObject({
      allowed: true,
      hasRights: true,
      alreadyCitizen: false,
      difficulty: 3,
      rollNeeded: 3,
      stabilityDrm: 0,
    });

    G.powers.AU.citizenship = ["Italians", "Czechs"];
    const harder = canGrantCitizenship(G, "AU", "Hungarians");
    expect(harder.difficulty).toBe(5);
    expect(harder.rollNeeded).toBe(5);
    const sacrificed = canGrantCitizenship(G, "AU", "Hungarians", {sacrificeStability: true});
    expect(sacrificed).toMatchObject({difficulty: 5, stabilityDrm: 2, rollNeeded: 3, requiresStabilityLoss: true});
  });

  test("negative: no rights, already a citizen, wrong power, or blocked by card", () => {
    const G = fresh();
    G.powers.AU.rights = ["Hungarians"];
    expect(canGrantCitizenship(G, "AU", "Poles").allowed).toBe(false);

    G.powers.AU.citizenship = ["Hungarians"];
    expect(canGrantCitizenship(G, "AU", "Hungarians").allowed).toBe(false);

    expect(canGrantCitizenship(G, "GE", "Hungarians").allowed).toBe(false);

    G.powers.AU.citizenship = [];
    G.flags.auNoCitizenship = true;
    expect(canGrantCitizenship(G, "AU", "Hungarians").allowed).toBe(false);
  });

  test("all eight printed nationalities are accepted", () => {
    const G = fresh();
    const rights = [...AU_NATIONALITIES];
    G.powers.AU.rights = rights;
    for (const nationality of AU_NATIONALITIES) {
      expect(canGrantCitizenship(G, "AU", nationality).allowed).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// metternichAllies / dualMonarchy / governmentBenefits
// ---------------------------------------------------------------------------

describe("metternichAllies", () => {
  test("turn-1 diplomacy offers two minor allies and excludes an opponent's diplomacy marker", () => {
    const G = fresh();
    G.turn = 1;
    G.phase = "diplomacy";
    G.persistent.metternich = false;

    const decision = metternichAllies(G);
    expect(decision.applies).toBe(true);
    expect(decision.candidates.length).toBeGreaterThanOrEqual(2);
    expect(decision.chosen).toHaveLength(2);
    expect(decision.remaining.length).toBe(decision.candidates.length - 2);

    const blocked = decision.candidates[0];
    G.spaces[blocked].diplomacy = "GE";
    expect(metternichAllies(G).candidates).not.toContain(blocked);
  });

  test("negative: not turn 1, not diplomacy, or already resolved", () => {
    const G = fresh();
    G.phase = "diplomacy";
    G.turn = 2;
    expect(metternichAllies(G).applies).toBe(false);
    G.turn = 1;
    G.phase = "action";
    expect(metternichAllies(G).applies).toBe(false);
    G.phase = "diplomacy";
    G.persistent.metternich = true;
    expect(metternichAllies(G).applies).toBe(false);
  });
});

describe("dualMonarchy", () => {
  test("turn-2 prep adds The Dual Monarchy when it was not played on turn 1", () => {
    const G = fresh();
    G.turn = 2;
    G.phase = "prep";
    G.powers.AU.hand = [];
    const decision = dualMonarchy(G);
    expect(decision.shouldAddToHand).toBe(true);
    expect(decision.windowOpen).toBe(true);
    expect(decision.event).toMatchObject({
      card: "IE-A047",
      stability: 1,
      citizenship: "Hungarians",
      persistentFlag: "dualMonarchy",
    });
  });

  test("negative: no add on turn 3, after playing it, or when already in hand", () => {
    const G = fresh();
    G.turn = 3;
    G.phase = "prep";
    expect(dualMonarchy(G).shouldAddToHand).toBe(false);

    G.turn = 2;
    G.persistent.dualMonarchyPlayed = true;
    expect(dualMonarchy(G).shouldAddToHand).toBe(false);

    G.persistent.dualMonarchyPlayed = false;
    G.powers.AU.hand = ["IE-A047"];
    expect(dualMonarchy(G).shouldAddToHand).toBe(false);
  });
});

describe("governmentBenefits", () => {
  test("Second Empire gets the war-budget CP; Third Republic gets the alliance CP", () => {
    const G = fresh();
    const empire = governmentBenefits(G, "FR");
    expect(empire).toMatchObject({government: "secondEmpire", warBudgetBonus: 1, allianceTrackCp: 0, canSwitchToRepublic: true});

    G.powers.FR.government = "thirdRepublic";
    const republic = governmentBenefits(G, "FR");
    expect(republic).toMatchObject({government: "thirdRepublic", warBudgetBonus: 0, allianceTrackCp: 2, canSwitchToRepublic: false});
  });

  test("negative: the switch is blocked during the GW and other powers have no government bonus", () => {
    const G = fresh();
    activateGw(G);
    expect(governmentBenefits(G, "FR").canSwitchToRepublic).toBe(false);
    expect(governmentBenefits(G, "GE")).toMatchObject({government: null, warBudgetBonus: 0, allianceTrackCp: 0});
  });
});
