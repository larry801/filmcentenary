/**
 * Fixes from the printed-rule audit round 4 (2026-11-27):
 *
 * - Printed map retypes: the four Balkan spaces are keys (squares on the
 *   printed board), Erzurum/Van/Kayseri/Arabia/Cyprus are territories, the
 *   Ottoman Arab keys are Syria/Mecca/Baghdad/Mosul/Palestine, and Kuwait is
 *   an uncontrolled key.  Cross-validated against the printed scan's icon
 *   shapes, the campaign display markers, the 1870/1880 setups and the Ottoman
 *   manpower table.
 * - 3.2.1: the printed keys that carry no track type are classified by their
 *   owner — RU/AU/OT territorial, UK/FR/GE by the land path to their capital —
 *   and only for key/capital/subcapital spaces.
 * - 22.1.3: the Sardinia-Piedmont / Two Sicilies shortcut rolls for Italian
 *   Unification instead of unifying outright, once per turn, and the check
 *   runs when an action impulse ends.
 * - 15.2.4/15.2.5: enemy rebels stop a march or rail path passing through;
 *   entering such a space is allowed, and liberation-war rebels are not enemy
 *   rebels.
 * - H-FR-6 Aux Armes: the printed OR is a mode decision (war half vs the
 *   retrieval half), the war half grants 2 reserve army steps (1-step
 *   counters), and with nothing retrievable only the war half remains.
 * - A046 French Intervention: "an eligible uncontrolled space" includes
 *   Europe; the EF is placed or moved and the pacification roll follows.
 * - Scenarios: "Italy Status: Unified" applies the unified-Italy setup half,
 *   and the 1870/1880 control overrides carry the A71-style home/key-type
 *   halves for the Egyptian spaces.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {ARAB_KEY_SPACES, effectiveKeyType, keyTypeForPower} from "./engine/rules";
import {checkItalianUnification} from "./engine/greatWar";
import {planMarch, planRail, planWartimeLandMove} from "./engine/wartimeMovement";
import {SPACES} from "./constant/spaces";
import {playCard, resolvePending} from "./moves";
import {pass} from "./moves";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {
      Die: (sides: number) => Math.min(sides, dice[Math.min(index++, dice.length - 1)] ?? 3),
      Shuffle: (items: unknown[]) => items,
    },
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

const scenario = (id: string): ImperialElegyState =>
  setupImperialElegy(makeCtx([], "0"), {scenario: id} as never);

const makeWar = (
  attacker: Power,
  defender: Power,
  overrides: Partial<WarState> = {},
): WarState => ({
  attacker,
  defender,
  attackerAllies: [],
  defenderAllies: [],
  attackerMinors: [],
  defenderMinors: [],
  warAim: "conquest",
  objectives: [],
  status: "maneuver",
  budgets: {},
  initiative: [],
  treaties: [],
  victor: "defender",
  truceTurns: 0,
  passed: [],
  startedTurn: 1,
  ...overrides,
});

const beginAction = (G: ImperialElegyState, power: Power): void => {
  G.phase = "action";
  G.activePower = power;
  G.pending = null;
  G.battle = null;
};

const lastLog = (G: ImperialElegyState, key: string) =>
  [...(G.log ?? [])].reverse().find((entry: {key?: string}) => entry.key === key);

// ---------------------------------------------------------------------------
// Printed map retypes
// ---------------------------------------------------------------------------

describe("printed map retypes", () => {
  test("the Balkan four are keys and the Anatolian/Arabian spaces are territories", () => {
    for (const id of ["bosnia-herzegovina", "serbia", "bulgaria", "macedonia"]) {
      expect(SPACES[id as keyof typeof SPACES]).toMatchObject({type: "key", keyType: "territorial"});
    }
    for (const id of ["erzurum", "van", "kayseri", "arabia", "cyprus"]) {
      expect(SPACES[id as keyof typeof SPACES]).toMatchObject({type: "territory"});
      expect(SPACES[id as keyof typeof SPACES].keyType).toBeUndefined();
    }
    expect(SPACES.palestine).toMatchObject({type: "key", keyType: "territorial"});
    expect(SPACES.kuwait).toMatchObject({type: "key", control: null});
    expect(SPACES.kuwait.home ?? null).toBeNull();
    expect(SPACES.kuwait.keyType).toBeUndefined();
  });

  test("the Ottoman Arab keys are the printed five and setup lands the 8/5 tracks", () => {
    expect([...ARAB_KEY_SPACES].sort()).toEqual(["baghdad", "mecca", "mosul", "palestine", "syria"]);
    const G = fresh();
    expect(G.powers.OT.arabKeys).toBe(5);
    expect(G.powers.OT.territorialKeys).toBe(8);
    // The printed Ottoman manpower table: 8 keys read 3.
    expect(G.powers.OT.manpower).toBe(3);
  });

  test("3.2.1 classifies the untyped keys by their owner", () => {
    const G = fresh();
    // RU counts every key it controls as territorial.
    G.spaces.shanghai.control = "RU";
    expect(keyTypeForPower(G, "shanghai", "RU")).toBe("territorial");
    // UK holds Shanghai with no land path home: a colonial key.
    G.spaces.shanghai.control = "UK";
    expect(keyTypeForPower(G, "shanghai", "UK")).toBe("colonial");
    // Belgium sits on GE's contiguous controlled land network once the Dutch
    // and Hanoverian links are GE-controlled too: territorial.
    G.spaces.belgium.control = "GE";
    G.spaces.netherlands.control = "GE";
    G.spaces.hanover.control = "GE";
    expect(keyTypeForPower(G, "belgium", "GE")).toBe("territorial");
    // Territories never count as keys, whatever the owner.
    G.spaces.arabia.control = "RU";
    expect(keyTypeForPower(G, "arabia", "RU")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 22.1.3 Italian unification
// ---------------------------------------------------------------------------

describe("22.1.3 Italian unification", () => {
  /** Campaign setup holds Piedmont (SP) and Naples (Two Sicilies): add Tuscany and Rome to SP for 3. */
  const threeItalianKeys = (G: ImperialElegyState): void => {
    G.spaces.tuscany.control = "Sardinia-Piedmont";
    G.spaces.rome.control = "Sardinia-Piedmont";
  };

  test("three Italian keys under Sardinia-Piedmont roll for unification", () => {
    const G = fresh();
    threeItalianKeys(G);
    // AU holds Lombardy, so the no-player-control bonus does not apply, and
    // the roll bonus counts SP's own three keys: roll = 4 + 3 = 7.
    expect(checkItalianUnification(G, makeCtx([4]), "GE")).toBe(true);
    expect(G.persistent.italyUnified).toBe(true);
    expect(G.persistent.italyUnifiedAt).toBe(G.turn);
    expect(G.italyMpit).toEqual({te: 0, ta: 0, neutral: 1});
  });

  test("a failed roll is not retried in the same turn", () => {
    const G = fresh();
    threeItalianKeys(G);
    // roll = 1 + 3 SP keys = 4: below the 7 needed.
    expect(checkItalianUnification(G, makeCtx([1]), "GE")).toBe(false);
    expect(G.flags.italianUnificationRolledTurn).toBe(G.turn);
    // Even a made roll is refused once the turn's roll has been spent.
    expect(checkItalianUnification(G, makeCtx([6]), "GE")).toBe(false);
    expect(G.persistent.italyUnified).toBeUndefined();
  });

  test("ending an action impulse runs the check", () => {
    const G = fresh();
    threeItalianKeys(G);
    beginAction(G, "GE");
    // Banked CP mark the impulse as used, so the hand-limited pass rules do
    // not apply and the impulse hands straight over.
    G.cpRemaining = 1;
    expect(pass(G, makeCtx([4], seat("GE")))).toBeUndefined();
    expect(G.persistent.italyUnified).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 15.2.4 / 15.2.5 rebel stops
// ---------------------------------------------------------------------------

describe("rebel march and rail stops", () => {
  /** A GE army in Westphalia; Belgium sits between it and Picardy. */
  const geArmyInWestphalia = (G: ImperialElegyState): string => {
    const unit = placeUnit(G, "GE", "army", "westphalia", 2);
    // The Belgian garrison is bystander set-dressing for this corridor.
    for (const id of [...G.spaces.belgium.units]) removeUnit(G, id);
    return unit.id;
  };

  const placeRebels = (G: ImperialElegyState, space: "belgium"): void => {
    const rebel = placeUnit(G, "REBEL:Belgium", "rebelArmy", space, 2);
    G.spaces[space].rebellion = {minor: "Belgium", step: 0, rebels: [rebel.id]};
  };

  test("hostile rebels stop a march passing through but not one entering", () => {
    const G = fresh();
    const unit = geArmyInWestphalia(G);
    G.spaces.belgium.control = "FR";
    G.war = makeWar("GE", "FR");
    // Baseline: an empty enemy space may be passed through.
    expect(planWartimeLandMove(G, "GE", unit, "picardy")).toMatchObject({
      ok: true,
      path: ["westphalia", "belgium", "picardy"],
    });
    placeRebels(G, "belgium");
    expect(planWartimeLandMove(G, "GE", unit, "picardy")).toMatchObject({ok: false, reason: "rebel-stop"});
    // The unit may still end its march in the rebel-held space (it stops there).
    expect(planMarch(G, "GE", unit, "belgium")).toMatchObject({ok: true, path: ["westphalia", "belgium"]});
  });

  test("liberation-war rebels are not enemy rebels", () => {
    const G = fresh();
    const unit = geArmyInWestphalia(G);
    G.spaces.belgium.control = "FR";
    G.spaces.picardy.control = "FR";
    G.war = makeWar("GE", "FR", {warAim: "liberation", objectives: ["belgium"]});
    placeRebels(G, "belgium");
    expect(planWartimeLandMove(G, "GE", unit, "picardy")).toMatchObject({
      ok: true,
      path: ["westphalia", "belgium", "picardy"],
    });
  });

  test("a rebel-held friendly space can only end a rail path", () => {
    const G = fresh();
    const unit = geArmyInWestphalia(G);
    G.spaces.belgium.control = "GE";
    G.spaces.picardy.control = "GE";
    placeRebels(G, "belgium");
    // Railing into the rebel-held space is allowed.
    expect(planRail(G, "GE", unit, "belgium")).toMatchObject({ok: true, path: ["westphalia", "belgium"]});
    // Belgium is the only friendly route to Picardy, and it cannot be a hop.
    expect(planRail(G, "GE", unit, "picardy")).toMatchObject({ok: false, reason: "no-rail-path"});
    // A march into the rebel space still works; through it does not.
    expect(planWartimeLandMove(G, "GE", unit, "picardy")).toMatchObject({ok: false, reason: "rebel-stop"});
  });
});

// ---------------------------------------------------------------------------
// H-FR-6 Aux Armes
// ---------------------------------------------------------------------------

describe("H-FR-6 Aux Armes", () => {
  const begin = (discard: string[] = []): {G: ImperialElegyState; ctx: Ctx} => {
    const G = fresh();
    beginAction(G, "FR");
    G.powers.FR.flags.homeChosen = true;
    G.powers.FR.hand = ["IE-H-FR-6"];
    G.discard = [...discard];
    return {G, ctx: makeCtx([], seat("FR"))};
  };

  test("with nothing retrievable the war half resolves outright", () => {
    const {G, ctx} = begin();
    expect(playCard(G, ctx, "IE-H-FR-6", "event")).toBeUndefined();
    expect(G.pending).toBeNull();
    // The card grants 2 reserve army steps: two 1-step counters, not armies.
    const reserves = G.powers.FR.reserves.map((id: string) => G.units[id]);
    expect(reserves).toHaveLength(2);
    for (const unit of reserves) expect(unit.steps).toBe(1);
    expect(G.powers.FR.flags.warDeclaration).toBe(true);
    expect(G.powers.FR.flags.warDeclarationCard).toBe("IE-H-FR-6");
  });

  test("with a retrievable card the printed OR is a mode decision", () => {
    const {G, ctx} = begin(["IE-A046"]);
    expect(playCard(G, ctx, "IE-H-FR-6", "event")).toBeUndefined();
    expect(G.pending?.kind).toBe("eventChoice");
    expect(G.pending!.options.map((option: {id: string}) => option.id).sort()).toEqual(["retrieve", "war"]);
    // The war half is still reachable through the decision.
    expect(resolvePending(G, ctx, "war")).toBeUndefined();
    const reserves = G.powers.FR.reserves.map((id: string) => G.units[id]);
    expect(reserves).toHaveLength(2);
    for (const unit of reserves) expect(unit.steps).toBe(1);
    expect(G.powers.FR.flags.warDeclaration).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// A046 French Intervention
// ---------------------------------------------------------------------------

describe("A046 French Intervention", () => {
  test("an uncontrolled European space is a legal target and the EF lands there", () => {
    const G = fresh();
    beginAction(G, "FR");
    G.powers.FR.hand = ["IE-A046"];
    // An EF already on the map opens the printed place-or-move choice.
    placeUnit(G, "FR", "expeditionary", "indochina", 2);
    const ctx = makeCtx([], seat("FR"));
    expect(playCard(G, ctx, "IE-A046", "event")).toBeUndefined();
    expect(G.pending?.kind).toBe("eventTargetSpace");
    const options = G.pending!.options.map((option: {id: string}) => option.id);
    // Kuwait is the campaign's one uncontrolled European space: eligible.
    expect(options).toContain("kuwait");
    expect(resolvePending(G, ctx, "kuwait")).toBeUndefined();

    // The EF choice follows: place a new EF or move the Indochina one.
    expect(G.pending?.kind).toBe("eventChoice");
    const modeOptions = G.pending!.options.map((option: {id: string}) => option.id);
    expect(modeOptions[0]).toBe("place");
    expect(modeOptions).toHaveLength(2);
    expect(G.spaces.kuwait.influence).toBe("FR");
    expect(resolvePending(G, ctx, "place")).toBeUndefined();

    const inKuwait = G.spaces.kuwait.units.map((id: string) => G.units[id])
      .filter((unit: {owner: string; kind: string}) => unit.owner === "FR" && unit.kind === "expeditionary");
    expect(inKuwait).toHaveLength(1);
    // "They then immediately make a pacification roll in the chosen space."
    const entry = lastLog(G, "pacificationFailed") ?? lastLog(G, "pacified");
    expect(entry?.args).toMatchObject({space: "kuwait", cost: 0});
    expect(G.spaces.kuwait.pacification).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Scenario setup halves
// ---------------------------------------------------------------------------

describe("scenario setup", () => {
  test("the 1870 setup prints a unified Italy and the IMP-held Egyptian spaces", () => {
    const G = scenario("s1870");
    expect(G.flags.italyUnified).toBe(true);
    expect(G.persistent.italyUnified).toBe(true);
    expect(G.italyMpit).toEqual({te: 0, ta: 0, neutral: 1});
    for (const def of Object.values(SPACES)) {
      if (def.flashpoints?.includes("italy")) expect(G.spaces[def.id].control).toBe("IT");
    }
    for (const id of ["egypt", "sinai", "great-sand-sea"]) {
      expect(G.spaces[id as keyof typeof G.spaces].control).toBe("Egypt");
    }
  });

  test("the 1880 setup hands Egypt to the UK as a colonial home space", () => {
    const G = scenario("s1880");
    expect(G.spaces.egypt.control).toBe("UK");
    expect(G.spaces.egypt.homeOverride).toBe("UK");
    expect(G.spaces.egypt.keyTypeOverride).toBe("colonial");
    expect(effectiveKeyType(G, "egypt")).toBe("colonial");
    for (const id of ["sinai", "great-sand-sea"]) {
      expect(G.spaces[id as keyof typeof G.spaces]).toMatchObject({control: "UK", homeOverride: "UK"});
    }
  });
});
