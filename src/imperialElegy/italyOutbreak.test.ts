/**
 * Rule 25.3 — Italy in the Great War (Outbreak Step), plus its interaction with
 * GW #2 Major Power Entry and the 26.3 Italy impulse slot.
 *
 * Covered here:
 *  - a unified Italy's Alliance Track chit (`gw.italyAlliance`);
 *  - neutral box: Italy stays out; aligned box: 4+ joins, 3 or less withdraws;
 *    committed box: automatic join; blamed incident: automatic join;
 *  - an un-unified Italy is untouched by 25.3;
 *  - Italy enters under its own flag (independent) through the printed 22.4
 *    redeployment (Rome + two frontier armies) and its own impulse slot;
 *  - GW #2 reopens a turn-0 Italy option, and its "4–6 shifts" threshold;
 *  - 25.4: Italy entering at 0 stability gains 1.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {AllianceBox, GreatWarState, ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {outbreakGreatWar, applyGwKeyCapture, keyHolder} from "./engine/greatWar";
import {italianHomeKeys} from "./engine/gwMajors";
import {
  allyImpulseController,
  enterGwAlly,
  isIndependentItaly,
  italyCommander,
  majorEntryOptions,
  usAllianceBox,
} from "./engine/greatWarFlow";
import {italyAllianceBox, italyAllianceSide, shiftItalyToward} from "./engine/italyEntry";
import {landUnitsIn, navalUnitsIn} from "./engine/rules";
import {SPACES} from "./constant/spaces";
import {gwPass, playGwCardMove, resolvePending} from "./moves";

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

const gwState = (overrides: Partial<GreatWarState> = {}): GreatWarState => ({
  active: true,
  turn: 1,
  order: ["GE", "RU"],
  belligerents: ["GE", "RU"],
  neutrals: ["UK", "FR", "AU", "OT"],
  te: ["RU"],
  ta: ["GE"],
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
  combatCardsInFront: [],
  ...overrides,
});

/** A fresh campaign with GE in the TA committed box and FR in the TE committed box. */
const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const setAlliances = (G: ImperialElegyState, boxes: Partial<Record<Power, AllianceBox>>): void => {
  for (const p of POWERS) G.powers[p].alliance = barriersDefault(p, boxes[p]);
};

const barriersDefault = (power: Power, box: AllianceBox | undefined): AllianceBox => {
  if (box !== undefined) return box;
  return power === "GE" ? "taCommitted" : power === "FR" ? "teCommitted" : "neutral";
};

/**
 * Unify Italy and choose its Alliance Track box.  The chit lives on `persistent`
 * in a real campaign (unification happens long before the war); `G.gw` is only
 * created by the outbreak, so it is the fallback slot for a later war state.
 */
const unifiedItaly = (G: ImperialElegyState, box: AllianceBox = "neutral"): void => {
  G.persistent.italyUnified = true;
  G.flags.italyUnified = true;
  G.persistent.italyAlliance = box;
};

describe("25.3 Italy's Alliance Track chit", () => {
  test("an un-unified Italy is always in the neutral box", () => {
    const G = fresh();
    G.persistent.italyAlliance = "teCommitted";
    G.gw = gwState({italyAlliance: "teCommitted"});
    expect(italyAllianceBox(G)).toBe("neutral");
    expect(italyAllianceSide(G)).toBeNull();
  });

  test("a unified Italy keeps its box; the aligned box points at an alliance", () => {
    const G = fresh();
    unifiedItaly(G, "taAligned");
    G.gw = gwState({italyAlliance: "taAligned"});
    expect(italyAllianceBox(G)).toBe("taAligned");
    expect(italyAllianceSide(G)).toBe("ta");
    G.gw.italyAlliance = "teAligned";
    expect(italyAllianceSide(G)).toBe("te");
    G.gw.italyAlliance = "teCommitted";
    expect(italyAllianceSide(G)).toBe("te");
  });

  test("a missing box reads as neutral and junk is ignored", () => {
    const G = fresh();
    unifiedItaly(G, "neutral");
    G.gw = gwState();
    expect(italyAllianceBox(G)).toBe("neutral");
    G.gw.italyAlliance = "nonsense" as AllianceBox;
    expect(italyAllianceBox(G)).toBe("neutral");
  });

  test("GW #2's shift walks Italy neutral -> aligned -> committed", () => {
    const G = fresh();
    unifiedItaly(G, "neutral");
    expect(shiftItalyToward(G, "te")).toBe("teAligned");
    expect(shiftItalyToward(G, "te")).toBe("teCommitted");
    expect(shiftItalyToward(G, "te")).toBe("teCommitted");
    // and back towards its own neutral box
    expect(shiftItalyToward(G, "ta")).toBe("teAligned");
    expect(shiftItalyToward(G, "ta")).toBe("neutral");
    expect(shiftItalyToward(G, "ta")).toBe("taAligned");
  });
});

describe("25.3 the Outbreak Step", () => {
  test("neutral: a unified Italy does not join and its slot is absent", () => {
    const G = fresh();
    setAlliances(G, {});
    unifiedItaly(G, "neutral");
    outbreakGreatWar(G, makeCtx([4]), "GE", "IE-A015");
    expect(G.gw!.italyIn).toBe(false);
    expect(G.gw!.order).not.toContain("IT");
    expect(G.gw!.belligerents).not.toContain("IT");
    expect(isIndependentItaly(G)).toBe(false);
  });

  test("aligned and 4 or more: Italy joins at once on that alliance's side", () => {
    const G = fresh();
    setAlliances(G, {});
    unifiedItaly(G, "teAligned");
    outbreakGreatWar(G, makeCtx([4]), "GE", "IE-A017");
    expect(G.gw!.italyIn).toBe(true);
    expect(G.flags.italySide).toBe("te");
    expect(isIndependentItaly(G)).toBe(true);
  });

  test("aligned and 3 or less: Italy withdraws to the neutral box", () => {
    const G = fresh();
    setAlliances(G, {});
    unifiedItaly(G, "taAligned");
    // Incident A015 (Shifting Alliances) is not blamed on Italy, so the die stands.
    outbreakGreatWar(G, makeCtx([3]), "GE", "IE-A015");
    expect(G.gw!.italyIn).toBe(false);
    expect(G.gw!.italyAlliance).toBe("neutral");
    expect(italyAllianceBox(G)).toBe("neutral");
  });

  test("committed: Italy joins automatically without a die", () => {
    const G = fresh();
    setAlliances(G, {});
    unifiedItaly(G, "taCommitted");
    // A die of 1 would withdraw an aligned Italy; a committed one ignores it.
    outbreakGreatWar(G, makeCtx([1]), "GE", "IE-A017");
    expect(G.gw!.italyIn).toBe(true);
    expect(G.flags.italySide).toBe("ta");
  });

  test("committed to the opposing alliance of GE still joins its own side", () => {
    const G = fresh();
    setAlliances(G, {});
    unifiedItaly(G, "teCommitted");
    outbreakGreatWar(G, makeCtx([1]), "GE", "IE-A017");
    expect(G.flags.italySide).toBe("te");
    expect(G.gw!.te).not.toContain("IT");
    expect(G.gw!.belligerents).not.toContain("IT");
  });

  test("blamed for the inciting incident: Italy joins even from the neutral box", () => {
    const G = fresh();
    setAlliances(G, {});
    unifiedItaly(G, "neutral");
    // The final index of the [functions, die, functions] replace passes the die
    // value straight through, so the first makeCtx([4]) only feeds setup.
    const dieValue = (value: number): Ctx =>
      ({...makeCtx([4]), random: {Die: () => value}} as unknown as Ctx);
    // Assassination! is one of the Crisis Table's "Blame" rows; the power that
    // played the incident takes Italy into its own alliance.
    outbreakGreatWar(G, dieValue(4), "GE", "IE-A017");
    expect(G.gw!.italyIn).toBe(true);
    expect(G.flags.italySide).toBe("ta");
    expect(G.gw!.italyAlliance).toBe("taCommitted");
    expect(G.gw!.order).toContain("IT");
  });

  test("not blamed: a neutral Italy still stays out", () => {
    const G = fresh();
    setAlliances(G, {});
    unifiedItaly(G, "neutral");
    outbreakGreatWar(G, makeCtx([6]), "GE", "IE-A015");
    expect(G.gw!.italyIn).toBe(false);
  });

  test("an un-unified Italy is unaffected even from a committed box", () => {
    const G = fresh();
    setAlliances(G, {});
    G.persistent.italyUnified = false;
    G.gw = gwState({italyAlliance: "teCommitted", turn: 0});
    // `outbreakGreatWar` rebuilds the GW state; keep the chit by pre-setting it.
    G.gw = null;
    outbreakGreatWar(G, makeCtx([6]), "GE", "IE-A017");
    expect(G.gw!.italyIn).toBe(false);
    expect(G.gw!.order).not.toContain("IT");
  });
});

describe("25.3 a joined Italy takes the field", () => {
  test("Italian armies stand in the Italian home keys and Italy holds them", () => {
    const G = fresh();
    setAlliances(G, {});
    unifiedItaly(G, "taCommitted");
    outbreakGreatWar(G, makeCtx([1]), "GE", "IE-A017");
    // Piedmont is held by Sardinia-Piedmont, so Italy takes it in its own name.
    const italianArmies = Object.values(G.units).filter((u) => u.owner === "IT" && u.kind === "italianArmy");
    expect(italianArmies.length).toBeGreaterThan(0);
    expect(landUnitsIn(G, "piedmont").some((u) => u.owner === "IT")).toBe(true);
    expect(G.spaces.piedmont.control).toBe("IT");
    expect(G.spaces.piedmont.diplomacy).toBeNull();
    // The minor state's army gives way to Italy's.
    expect(landUnitsIn(G, "piedmont").some((u) => u.owner === "Sardinia-Piedmont")).toBe(false);
    // Lombardy stays an AU home key and is untouched.
    expect(G.spaces.lombardy.control).toBe("AU");
    expect(landUnitsIn(G, "lombardy").some((u) => u.owner === "IT")).toBe(false);
    // 22.4: three standing armies (Rome plus the two frontier spaces) and
    // 22.2's single squadron in Naples.  The old fixed four-army seeding is
    // gone; a fourth army counter only exists if 22.3.1 grants it.
    expect(italianArmies).toHaveLength(3);
    expect(landUnitsIn(G, "rome").some((u) => u.owner === "IT")).toBe(true);
    expect(Object.values(G.units).filter((u) => u.owner === "IT" && u.space === null)).toHaveLength(0);
    expect(navalUnitsIn(G, "naples").some((u) => u.owner === "IT")).toBe(true);
  });

  test("placing the presence twice does not duplicate armies", () => {
    const G = fresh();
    setAlliances(G, {});
    unifiedItaly(G, "taCommitted");
    outbreakGreatWar(G, makeCtx([1]), "GE", "IE-A017");
    const before = Object.values(G.units).filter((u) => u.owner === "IT").length;
    // A second entry attempt is refused, so nothing is placed twice.
    expect(enterGwAlly(G, makeCtx(), "IT", "ta", {independent: true}).ok).toBe(false);
    expect(Object.values(G.units).filter((u) => u.owner === "IT").length).toBe(before);
  });

  test("Italy's slot closes the GW order and its controller is a power on its side", () => {
    const G = fresh();
    setAlliances(G, {});
    unifiedItaly(G, "taCommitted");
    outbreakGreatWar(G, makeCtx([1]), "GE", "IE-A017");
    expect(G.gw!.order[G.gw!.order.length - 1]).toBe("IT");
    expect(allyImpulseController(G, "IT")).toBe(G.gw!.ta[0]);
    // An independent Italy is commanded by itself, not by a player.
    expect(italyCommander(G)).toBe("IT");
  });

  test("GW #2 keeps Italy under the playing power instead of the Kingdom", () => {
    const G = fresh();
    setAlliances(G, {});
    unifiedItaly(G, "teCommitted");
    G.gw = gwState({italyAlliance: "teCommitted", turn: 1, te: ["FR", "RU"], ta: ["GE"]});
    expect(enterGwAlly(G, makeCtx(), "IT", "te").ok).toBe(true);
    expect(isIndependentItaly(G)).toBe(false);
    expect(italyCommander(G)).toBe(G.gw!.te[0]);
  });

  test("25.4: an Italy joining at 0 stability gains 1", () => {
    const G = fresh();
    setAlliances(G, {});
    unifiedItaly(G, "taCommitted");
    G.gw = gwState({italyAlliance: "taCommitted", italyStability: 0, turn: 0});
    G.gw.italyIn = false;
    // GW #2 cannot bring in a major with no stability left...
    unifiedItaly(G, "teCommitted");
    G.gw.italyAlliance = "teCommitted";
    expect(majorEntryOptions(G, "FR")).not.toContain("IT");
    // ...and 25.3's own entry applies 25.4 to a track that starts at 0.
    G.persistent.italyAlliance = "teCommitted";
    G.gw.active = false;
    outbreakGreatWar(G, makeCtx([1]), "GE", "IE-A015");
    expect(G.gw!.italyStability).toBe(3);
  });
});

describe("25.3 with GW #2 Major Power Entry", () => {
  test("an Italy left outside the war at turn 0 can still be shifted by GW #2", () => {
    const G = fresh();
    setAlliances(G, {});
    unifiedItaly(G, "neutral");
    // A015 Shifting Alliances is not a "Blame" row, so 25.3 leaves Italy out.
    outbreakGreatWar(G, makeCtx([4, 3]), "GE", "IE-A015");
    expect(G.gw!.italyIn).toBe(false);
    expect(G.gw!.turn).toBe(0);
    // GW #2 is on the table during the Outbreak Step for Italy specifically.
    expect(majorEntryOptions(G, G.gw!.ta[0])).toEqual(["IT"]);
    // Without the turn-0 exception the US cannot be chosen on GW turn 0.
    G.persistent.italyUnified = false;
    expect(majorEntryOptions(G, G.gw!.ta[0])).toEqual([]);
  });

  test("GW #2 on turn 0: a 4–6 joins Italy and a 1–3 only shifts it", () => {
    const G = fresh();
    setAlliances(G, {});
    unifiedItaly(G, "neutral");
    // Shifting Alliances does not blame Italy, so 25.3 leaves it out.
    outbreakGreatWar(G, makeCtx([4, 3]), "GE", "IE-A015");
    const ta = G.gw!.ta[0];
    G.powers[ta].gwCard = "IE-GW-02";

    // 1–3: Italy shifts to the aligned box but waits.
    const onePlay = makeCtx([3], seat(ta));
    const r = playGwCardMove(G, onePlay, "event");
    expect(r).toBeUndefined();
    expect(G.pending?.options.map((o) => o.id)).toEqual(["IT"]);
    expect(resolvePending(G, makeCtx([3], seat(ta)), "IT")).toBeUndefined();
    expect(G.gw!.italyAlliance).toBe("taAligned");
    expect(G.gw!.italyIn).toBe(false);

    // The Outbreak Step takes one GW #2: a second copy is refused (the card
    // exists once in a deck), so Italy has to wait for the next GW turn.
    G.powers[ta].gwCard = "IE-GW-02";
    expect(playGwCardMove(G, makeCtx([4], seat(ta)), "event")).toBe(INVALID_MOVE);
    G.gw!.turn = 1;
    expect(playGwCardMove(G, makeCtx([4], seat(ta)), "event")).toBeUndefined();
    expect(resolvePending(G, makeCtx([4], seat(ta)), "IT")).toBeUndefined();
    expect(G.gw!.italyIn).toBe(true);
    expect(G.flags.italySide).toBe("ta");
    // From the aligned box a 4+ promotes Italy to the committed box, and
    // GW #2 puts it under the player's control, not its own flag.
    expect(G.gw!.italyAlliance).toBe("taCommitted");
    expect(isIndependentItaly(G)).toBe(false);
    expect(G.gw!.order).toContain("IT");
  });

  test("the US path is unchanged: it shifts one box and joins at committed", () => {
    const G = fresh();
    setAlliances(G, {});
    unifiedItaly(G, "neutral");
    outbreakGreatWar(G, makeCtx([4, 3]), "GE", "IE-A015");
    const ta = G.gw!.ta[0];
    G.gw!.turn = 2;
    G.powers[ta].gwCard = "IE-GW-02";
    expect(majorEntryOptions(G, ta)).toEqual(["IT", "US"]);
    expect(playGwCardMove(G, makeCtx([2], seat(ta)), "event")).toBeUndefined();
    expect(resolvePending(G, makeCtx([2], seat(ta)), "US")).toBeUndefined();
    expect(usAllianceBox(G)).toBe("taAligned");
    expect(G.gw!.usIn).toBe(false);
  });

  test("GW #2 cannot be played on turn 0 when 25.3 already settled Italy", () => {
    const G = fresh();
    setAlliances(G, {});
    unifiedItaly(G, "taCommitted");
    outbreakGreatWar(G, makeCtx([1]), "GE", "IE-A017");
    expect(G.gw!.italyIn).toBe(true);
    G.powers[G.gw!.ta[0]].gwCard = "IE-GW-02";
    expect(playGwCardMove(G, makeCtx([3], seat(G.gw!.ta[0])), "event")).toBe(INVALID_MOVE);
  });
});

describe("an entered Italy acts on its own impulse", () => {
  test("Italy's impulse is handed to a power on its side with the Italian budget", () => {
    const G = fresh();
    setAlliances(G, {});
    unifiedItaly(G, "taCommitted");
    outbreakGreatWar(G, makeCtx([1]), "GE", "IE-A017");
    // Trim the order to GE + Italy so the pass below reaches Italy's slot.
    G.gw!.order = [G.gw!.ta[0], "IT"];
    G.gw!.belligerents = [G.gw!.ta[0]];
    G.phase = "gwManeuver";
    G.activePower = G.gw!.ta[0];
    G.turnIndex = 0;
    const ctx = makeCtx([1], seat(G.gw!.ta[0]));
    expect(gwPass(G, ctx)).toBeUndefined();
    expect(G.flags.gwAllyImpulse).toBe("IT");
    expect(G.activePower).toBe(G.gw!.ta[0]);
    expect(G.gw!.italyBudget).toBe(2);
    expect(G.spaces).toBeDefined();
  });
});

describe("the map knows the Italian home keys", () => {
  test("Piedmont, Tuscany and Naples are the Italian home keys, not Lombardy", () => {
    expect(SPACES.piedmont.flashpoints).toContain("italy");
    expect(SPACES.tuscany.flashpoints).toContain("italy");
    expect(SPACES.naples.flashpoints).toContain("italy");
    expect(SPACES.lombardy.home).toBe("AU");
  });

  test("25.3 grants a fresh Italian budget when Italy joins on its own", () => {
    const G = fresh();
    setAlliances(G, {});
    unifiedItaly(G, "taCommitted");
    outbreakGreatWar(G, makeCtx([1]), "GE", "IE-A017");
    expect(G.gw!.italyBudget).toBe(2);
  });

  test("an independent Italy's keys belong to the Kingdom, not to a player", () => {
    const G = fresh();
    setAlliances(G, {});
    unifiedItaly(G, "taCommitted");
    outbreakGreatWar(G, makeCtx([1]), "GE", "IE-A015");
    // 25.3 hands Piedmont to Italy itself, so no player owns it: 30.0's capture
    // path finds no controlling player and Italy's 32.2 track starts intact.
    expect(G.spaces.piedmont.control).toBe("IT");
    const ta = G.gw!.ta[0];
    expect(keyHolder(G, "piedmont")).toBeNull();
    expect(applyGwKeyCapture(G, "piedmont", null, ta)).toEqual({loser: 0, captor: 0});
    expect(G.gw!.italyStability).toBe(3);
    // Italy's soldiers answer to the Kingdom, and its home keys are its own.
    expect(italyCommander(G)).toBe("IT");
    expect(italianHomeKeys()).toContain("piedmont");
  });
});
