/**
 * 4.8 / 12.5.1 / 12.5.2 / 12.5.3 / 12.8 / 12.9 / 12.6 foreign-affairs markers.
 *
 * The reported bug: the board offered "place diplomacy" on a *player* power's
 * own home space (Berlin, London, Paris …) and the engine then refused it.  The
 * panel tested only `control === null`, so it treated every player-controlled
 * space as a minor power's.
 *
 * These suites pin three things:
 *
 *  1. **The printed restriction**, rule by rule, on the engine's own moves.
 *  2. **No drift:** for every power × every space × every marker action, the
 *     Orders panel's `enabled` flag equals what the move actually does.  Before
 *     the shared gate this scan found 392 rows that were offered and refused.
 *  3. **The wording exists:** every refusal code has an English and Chinese
 *     sentence, so a new code cannot reach the board untranslated.
 */
import {Ctx} from "boardgame.io";
import {Power, POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {SPACES} from "./constant/spaces";
import * as moves from "./moves";
import {placeUnit} from "./engine/effects";
import {
  diplomacyPlacementProblem,
  influencePlacementProblem,
  minorAllianceProblem,
  minorNamesakeSpace,
  removeMarkerProblem,
  removeMinorAllianceProblem,
} from "./engine/foreignAffairs";
import type {ImperialElegyState} from "./types";

/** A ctx seated for `power`, so `requireActive` sees the acting seat. */
const makeCtx = (power: Power): Ctx => ({
  random: {Die: () => 1, Number: () => 1, Shuffle: (a: unknown[]) => a},
  events: {setActivePlayers: () => undefined, setPhase: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 1,
  phase: "action",
  currentPlayer: String(POWERS.indexOf(power)),
  playerID: String(POWERS.indexOf(power)),
  activePlayers: null,
} as unknown as Ctx);

const game = (power: Power, cp = 20): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx(power));
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = cp;
  G.pending = null;
  G.battle = null;
  G.war = null;
  return G;
};

const diplomacyAccepted = (power: Power, space: string): boolean =>
  moves.placeDiplomacy(game(power), makeCtx(power), space) === undefined;

const allianceAccepted = (power: Power, space: string, arrange?: (G: ImperialElegyState) => void): boolean => {
  const G = game(power);
  arrange?.(G);
  return moves.minorAlliance(G, makeCtx(power), space) === undefined;
};

describe("12.5.3 diplomacy markers go only in minor power spaces", () => {
  test("player home spaces are refused — the reported bug", () => {
    // Before the fix these all returned "accepted" to the board while the
    // engine refused the click.
    expect(diplomacyAccepted("GE", "berlin")).toBe(false);
    expect(diplomacyAccepted("UK", "london")).toBe(false);
    expect(diplomacyAccepted("FR", "paris")).toBe(false);
    expect(diplomacyAccepted("AU", "bohemia")).toBe(false);
    expect(diplomacyAccepted("RU", "poland")).toBe(false);
    expect(diplomacyAccepted("OT", "istanbul")).toBe(false);
  });

  test("the gate names the reason the panel shows", () => {
    expect(diplomacyPlacementProblem(game("GE"), "berlin")).toBe("not-minor-power");
    expect(diplomacyPlacementProblem(game("GE"), "netherlands")).toBeNull();
  });

  test("minor power spaces are allowed", () => {
    for (const space of ["netherlands", "bavaria", "saxony", "hanover", "denmark", "greece", "mexico"]) {
      expect(diplomacyAccepted("GE", space)).toBe(true);
    }
  });

  test("one marker per space, whoever owns it", () => {
    const G = game("GE");
    G.spaces.greece.diplomacy = "UK";
    expect(diplomacyPlacementProblem(G, "greece")).toBe("already-marked");
  });

  test("12.5.3: a minor's own home space takes the marker while it holds it", () => {
    // Egypt controls Egypt; a marker belongs on `egypt`, not on its sisters.
    expect(diplomacyPlacementProblem(game("GE"), "sinai")).toBe("minor-home-space");
    expect(diplomacyPlacementProblem(game("GE"), "great-sand-sea")).toBe("minor-home-space");
    // Once Egypt loses its namesake, the player chooses.
    const G = game("GE");
    G.spaces.egypt.control = "OT";
    expect(diplomacyPlacementProblem(G, "sinai")).toBeNull();
  });

  test("a minor that gains independence in play carries the same rule", () => {
    // Poland has no `MINOR_POWER_HOMES` row; its namesake is the liberated
    // space, recorded by the `independentHome` stamp (22.5).
    const G = game("GE");
    G.spaces.poland.control = "Poland";
    G.spaces.poland.independentHome = {power: "Poland", nationality: "Poles"};
    expect(minorNamesakeSpace(G, "Poland")).toBe("poland");
    // A second Polish-held space defers to it.
    G.spaces.galicia.control = "Poland";
    expect(diplomacyPlacementProblem(G, "galicia")).toBe("minor-home-space");
    expect(diplomacyPlacementProblem(G, "poland")).toBeNull();
  });
});

describe("4.6.2 the US and a unified Italy are major powers, not minor powers", () => {
  test("the South takes no marker without the American Civil War", () => {
    expect(diplomacyPlacementProblem(game("GE"), "the-south")).toBe("the-south");
    // 12.5.3: the ACW makes it legal.
    const G = game("GE");
    G.persistent.acw = true;
    expect(diplomacyPlacementProblem(G, "the-south")).toBeNull();
  });

  test("the US cannot be allied as a minor power", () => {
    expect(allianceAccepted("GE", "the-south", (G) => { G.spaces["the-south"].diplomacy = "GE"; })).toBe(false);
    const G = game("GE");
    G.spaces["the-south"].diplomacy = "GE";
    expect(minorAllianceProblem(G, "GE", "the-south")).toBe("not-minor-power");
  });

  test("a unified Italy's spaces take no marker", () => {
    const G = game("GE");
    G.spaces.tuscany.control = "IT";
    expect(diplomacyPlacementProblem(G, "tuscany")).toBe("not-minor-power");
    expect(moves.placeDiplomacy(G, makeCtx("GE"), "tuscany")).toBe("INVALID_MOVE");
  });

  test("Italy's four minor powers may be marked before unification", () => {
    // Piedmont carries a FR setup marker (so "already-marked"); the other three
    // are free and must accept one.
    expect(diplomacyPlacementProblem(game("FR"), "piedmont")).toBe("already-marked");
    for (const space of ["naples", "tuscany", "rome"]) {
      expect(diplomacyPlacementProblem(game("FR"), space)).toBeNull();
    }
  });

  test("Egypt is still a minor power even though OT holds its spaces", () => {
    // The campaign overrides Egypt/Sinai/Great Sand Sea to Egyptian control.
    const G = game("UK");
    expect(G.spaces.egypt.control).toBe("Egypt");
    expect(diplomacyPlacementProblem(G, "egypt")).toBeNull();
  });
});

describe("12.5.3 special cases", () => {
  test("Qing China's spaces are barred outright", () => {
    for (const space of ["shanghai", "manchuria", "shandong-peninsula", "guangzhou"]) {
      expect(diplomacyPlacementProblem(game("GE"), space)).toBe("qing-china");
      expect(diplomacyAccepted("GE", space)).toBe(false);
    }
  });

  test("Japan takes no marker before Meiji Restoration, and does after", () => {
    expect(diplomacyPlacementProblem(game("GE"), "japan")).toBe("japan-not-in-play");
    expect(diplomacyAccepted("GE", "japan")).toBe(false);
    const G = game("GE");
    G.persistent.meiji = true;
    expect(diplomacyPlacementProblem(G, "japan")).toBeNull();
  });

  test("an independent India takes no marker", () => {
    const G = game("GE");
    G.powers.UK.indiaIndependent = true;
    expect(diplomacyPlacementProblem(G, "india")).toBe("independent-india");
    expect(diplomacyAccepted("GE", "india")).toBe(false);
  });
});

describe("5.6 diplomacy needs no LoC, influence does", () => {
  test("a minor space off the supply line still takes a diplomacy marker", () => {
    // 5.6 requires a LoC for placing *influence* only; 12.5.3 prints none for
    // diplomacy, which the engine used to demand anyway.
    const G = game("GE");
    // Morocco is far from a German supply source.  (The German home spaces that
    // are off the line are player spaces anyway, so this uses the LoC test on
    // the influence gate below and only asserts diplomacy is not refused for
    // want of a LoC.)
    expect(diplomacyPlacementProblem(G, "morocco")).toBeNull();
    expect(moves.placeDiplomacy(G, makeCtx("GE"), "morocco")).toBeUndefined();
  });

  test("influence keeps its LoC requirement", () => {
    // Morocco starts controlled by its minor power, so this needs a genuinely
    // uncontrolled space off the German line: Sudan.
    const G = game("GE");
    expect(influencePlacementProblem(G, "GE", "sudan")).toBe("no-loc");
    expect(moves.placeInfluence(G, makeCtx("GE"), "sudan")).toBe("INVALID_MOVE");
  });
});

describe("12.5.1 influence needs an uncontrolled land space", () => {
  test("a naval box takes no influence marker", () => {
    const G = game("GE");
    expect(influencePlacementProblem(G, "GE", "north-atlantic")).toBe("naval-box");
    expect(moves.placeInfluence(G, makeCtx("GE"), "north-atlantic")).toBe("INVALID_MOVE");
  });

  test("an uncontrolled space on the line still takes one", () => {
    const G = game("GE");
    expect(influencePlacementProblem(G, "GE", "oman")).toBeNull();
    expect(moves.placeInfluence(G, makeCtx("GE"), "oman")).toBeUndefined();
  });
});

describe("12.8 minor power alliance", () => {
  test("requires this player's own diplomacy marker", () => {
    expect(minorAllianceProblem(game("GE"), "GE", "greece")).toBe("needs-diplomacy");
    const G = game("GE");
    G.spaces.greece.diplomacy = "UK";
    expect(minorAllianceProblem(G, "GE", "greece")).toBe("needs-diplomacy");
  });

  test("one alliance per minor power", () => {
    const G = game("GE");
    G.spaces.greece.diplomacy = "GE";
    G.spaces.greece.ally = "UK";
    expect(minorAllianceProblem(G, "GE", "greece")).toBe("allied-elsewhere");
  });

  test("the printed five-ally cap holds", () => {
    const G = game("GE");
    for (const space of ["belgium", "netherlands", "hanover", "saxony", "bavaria"]) {
      G.spaces[space].ally = "GE";
    }
    G.spaces.greece.diplomacy = "GE";
    expect(minorAllianceProblem(G, "GE", "greece")).toBe("ally-limit");
  });
});

describe("12.9 any player may flip an ally marker, and it keeps its owner", () => {
  test("a third party's flip restores the original ally's diplomacy marker", () => {
    const G = game("GE");
    G.spaces.greece.ally = "UK";
    expect(moves.removeMinorAlliance(G, makeCtx("GE"), "greece")).toBeUndefined();
    expect(G.spaces.greece.ally).toBeNull();
    // 4.8/12.9: the flipped side belongs to the player it was flipped from.
    expect(G.spaces.greece.diplomacy).toBe("UK");
    expect(G.cpRemaining).toBe(16);
  });

  test("the row is offered on someone else's alliance — the other half of the bug", () => {
    // The panel used to disable the row unless the ally was the viewer, while
    // the engine allowed anyone: the drift ran in both directions.
    const G = game("GE");
    G.spaces.greece.ally = "UK";
    expect(removeMinorAllianceProblem(G, "greece")).toBeNull();
  });

  test("an empty space offers nothing to flip", () => {
    expect(removeMinorAllianceProblem(game("GE"), "greece")).toBe("no-ally");
  });
});

describe("12.6 removing a marker", () => {
  test("own markers only", () => {
    const G = game("GE");
    G.spaces.greece.diplomacy = "UK";
    expect(removeMarkerProblem(G, "GE", "greece")).toBe("no-own-marker");
  });

  test("the Berlin Conference bar applies to influence in Africa", () => {
    const G = game("UK");
    G.persistent.berlinConference = true;
    G.spaces.rhodesia.influence = "UK";
    expect(removeMarkerProblem(G, "UK", "rhodesia")).toBe("africa-after-berlin");
    expect(moves.removeInfluence(G, makeCtx("UK"), "rhodesia")).toBe("INVALID_MOVE");
  });

  test("the bar is printed against influence, so diplomacy still lifts", () => {
    const G = game("UK");
    G.persistent.berlinConference = true;
    G.spaces.egypt.diplomacy = "UK";
    expect(removeMarkerProblem(G, "UK", "egypt")).toBeNull();
  });

  test("another player's unit blocks removing *influence*", () => {
    // 12.6: "Players cannot remove influence in a space that contains a unit
    // belonging to another player."  The bar is printed against influence.
    const G = game("GE");
    G.spaces.oman.influence = "GE";
    placeUnit(G, "UK", "army", "oman", 2);
    expect(removeMarkerProblem(G, "GE", "oman")).toBe("foreign-unit-present");
  });

  test("the same bar does not apply to a diplomacy marker", () => {
    const G = game("GE");
    G.spaces.greece.diplomacy = "GE";
    placeUnit(G, "UK", "army", "greece", 2);
    expect(removeMarkerProblem(G, "GE", "greece")).toBeNull();
  });
});

describe("no drift between the Orders panel and the engine", () => {
  /** The five rows the diplomacy group offers, and the move each runs. */
  const rows = [
    {id: "diplomacy", move: "placeDiplomacy"},
    {id: "influence", move: "placeInfluence"},
    {id: "minorAlliance", move: "minorAlliance"},
    {id: "removeInfluence", move: "removeInfluence"},
    {id: "breakAlliance", move: "removeMinorAlliance"},
  ] as const;

  test("every power × every space agrees", () => {
    // The scan that would have caught the original report: 392 rows were
    // offered and then refused before the shared gate.
    const drift: string[] = [];
    for (const power of POWERS) {
      for (const space of Object.keys(SPACES)) {
        for (const row of rows) {
          const G = game(power);
          const offered = spaceActionsFor(G, power, space).find((candidate) => candidate.id === row.id);
          if (offered === undefined) continue;
          const probe = game(power);
          const accepted = (moves as unknown as Record<string, (...args: unknown[]) => unknown>)[row.move](
            probe, makeCtx(power), space,
          ) === undefined;
          if (offered.enabled !== accepted) {
            drift.push(`${power}/${space}/${row.id}: panel=${offered.enabled} engine=${accepted} control=${G.spaces[space].control}`);
          }
        }
      }
    }
    expect(drift).toEqual([]);
  });
});

describe("every refusal code is translated", () => {
  test("both locales have a sentence for each code the panel can show", () => {
    // Imported here so the module graph stays acyclic for the engine suites.
    const {foreignAffairsText} = require("./components/actionAvailability") as typeof import("./components/actionAvailability");
    const codes = [
      "unknown-space", "independent-india", "already-controlled", "already-influenced",
      "already-marked", "africa-limit", "no-loc", "not-minor-power", "qing-china",
      "the-south", "japan-not-in-play", "minor-home-space", "needs-diplomacy",
      "allied-elsewhere", "already-allied", "ally-limit", "no-own-marker",
      "africa-after-berlin", "foreign-unit-present", "no-ally",
    ] as const;
    for (const code of codes) {
      expect(foreignAffairsText(code, "en").length).toBeGreaterThan(0);
      expect(foreignAffairsText(code, "zh_CN").length).toBeGreaterThan(0);
      expect(foreignAffairsText(code, "zh_CN")).not.toBe(foreignAffairsText(code, "en"));
    }
  });
});

/** Local wrapper so the scan reads the panel exactly as the board does. */
const spaceActionsFor = (
  G: ImperialElegyState,
  power: Power,
  space: string,
): {id: string; enabled: boolean}[] => {
  const {spaceActions} = require("./components/actionAvailability") as typeof import("./components/actionAvailability");
  return spaceActions({
    G,
    viewer: power,
    phase: "action",
    space,
    selectedUnit: null,
    cp: G.cpRemaining,
    canAct: true,
    canActionCard: true,
    war: null,
    me: G.powers[power],
    moves: moves as never,
    doAction: (fn: () => void) => fn(),
    myOnMapArmies: 1,
    myForts: 0,
    myMinorAllies: 0,
    ownLandInSelected: [],
    ownNavalInSelected: [],
    potentialLandTargets: [],
    potentialNavalTargets: [],
    deployLimit: 0,
    deployFree: false,
    canDeployHere: false,
    canGwDraft: false,
    canGwDeployHere: false,
    polishArmyDecision: null,
    polishReserveDecision: null,
    gwJointNavalAllies: [],
    gwJointNavalUnitIds: () => [],
    startBattle: () => undefined,
    startNavalBattle: () => undefined,
    warCp: 2,
    onDeclareWar: () => null,
    locale: "en",
  });
};
