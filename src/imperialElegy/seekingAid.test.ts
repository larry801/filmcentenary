/**
 * Rule 13.4.2 — Seeking Aid, and rule 13.4.3 — the Non-Player Alliance Table.
 *
 * "If the attacked non-player power does not have an ally, it will immediately
 * try to find a player ally.  The first player with the option to ally with the
 * non-player power is the player who has a diplomacy marker with it.  If no
 * player does, or that player declines, the Non-Player Alliance Table is
 * consulted.  The '1st Choice' player has the option ... followed by the '2nd
 * Choice,' and then the '3rd Choice.'  Some columns have two players listed.  If
 * two players are listed the players roll off (re-roll ties) to see who gets
 * the first chance to ally with the non-player power."
 *
 * The table is typed data (`NON_PLAYER_ALLIANCE_TABLE`), the ordering helper is
 * `seekingAidSlots`, and the live chain runs through the private `minorAid`
 * pending decision.  A search that finds no ally now creates the 15.4.2 lone
 * non-player war (see `unaidedSeekingAid.test.ts` for that path).
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {redactForView} from "./engine/privacy";
import {createWarState} from "./engine/limitedWar";
import {
  NON_PLAYER_ALLIANCE_TABLE,
  applyMinorAidAlliance,
  canAidMinor,
  nonPlayerAllianceRow,
  rollOffAidOrder,
  seekingAidSlots,
  type NonPlayerAllianceRow,
} from "./engine/limitedWar";
import {declareWar, resolvePending, declinePending} from "./moves";

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

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const beginAction = (G: ImperialElegyState, active: Power = "GE", cp = 4): void => {
  G.phase = "action";
  G.activePower = active;
  G.cpRemaining = cp;
  G.pending = null;
  G.war = null;
};

const lastLog = (G: ImperialElegyState, key: string) =>
  [...G.log].reverse().find((entry) => entry.key === key);

const declareOn = (G: ImperialElegyState, minor: string, objectives: string[], dice: number[] = []) => {
  beginAction(G);
  return declareWar(G, makeCtx(dice, seat("GE")), {minor}, "conquest", objectives, 2);
};

/** A die source that replays the given rolls, then repeats the last one. */
const diceSource = (rolls: number[]): (() => number) => {
  let index = 0;
  return () => rolls[Math.min(index++, rolls.length - 1)] ?? 3;
};

// ---------------------------------------------------------------------------
// 13.4.3 table data
// ---------------------------------------------------------------------------

describe("13.4.3 Non-Player Alliance Table data", () => {
  test("every printed row is transcribed with its three choice columns", () => {
    expect(NON_PLAYER_ALLIANCE_TABLE.map((row) => row.nation)).toEqual([
      "Netherlands/Bel.",
      "Denmark",
      "German State",
      "Balkan State",
      "Greece",
      "Italy/IT Minor",
      "Egypt",
      "Persia",
      "Japan",
      "Qing China",
      "Poland",
      "Ireland",
    ]);
    for (const row of NON_PLAYER_ALLIANCE_TABLE) {
      expect(row.nations.length).toBeGreaterThan(0);
      expect(row.choices).toHaveLength(3);
      for (const choice of row.choices) {
        if (choice === null) continue;
        expect(choice.candidates.length).toBeGreaterThan(0);
        for (const power of choice.candidates) expect(POWERS).toContain(power);
        // The printed `*` only appears on two-player cells.
        if (choice.candidates.length === 1) expect(choice.rollOff).toBe(false);
        else expect(choice.rollOff).toBe(true);
      }
    }
  });

  test("nation groups resolve to their minor powers", () => {
    const rowOf = (minor: string): NonPlayerAllianceRow | null => nonPlayerAllianceRow(minor);
    expect(rowOf("Belgium")?.nation).toBe("Netherlands/Bel.");
    expect(rowOf("Netherlands")?.nation).toBe("Netherlands/Bel.");
    expect(rowOf("Hanover")?.nation).toBe("German State");
    expect(rowOf("Saxony")?.nation).toBe("German State");
    expect(rowOf("Bavaria")?.nation).toBe("German State");
    expect(rowOf("Romania")?.nation).toBe("Balkan State");
    expect(rowOf("Serbia")?.nation).toBe("Balkan State");
    expect(rowOf("Bosnia")?.nation).toBe("Balkan State");
    expect(rowOf("Bulgaria")?.nation).toBe("Balkan State");
    expect(rowOf("Italy")?.nation).toBe("Italy/IT Minor");
    expect(rowOf("Sardinia-Piedmont")?.nation).toBe("Italy/IT Minor");
    expect(rowOf("Poland")?.nation).toBe("Poland");
    expect(rowOf("Ireland")?.nation).toBe("Ireland");
    expect(rowOf("Atlantis")).toBeNull();
  });

  test("the printed choices match the rulebook cells", () => {
    const choices = (minor: string) => nonPlayerAllianceRow(minor)?.choices;
    expect(choices("Belgium")).toEqual([
      {candidates: ["UK", "GE"], rollOff: true},
      {candidates: ["FR"], rollOff: false},
      null,
    ]);
    expect(choices("Denmark")).toEqual([
      {candidates: ["UK", "FR"], rollOff: true},
      {candidates: ["GE", "RU"], rollOff: true},
      null,
    ]);
    expect(choices("Bavaria")).toEqual([
      {candidates: ["AU", "GE"], rollOff: true},
      {candidates: ["RU"], rollOff: false},
      {candidates: ["FR"], rollOff: false},
    ]);
    expect(choices("Italy")).toEqual([
      {candidates: ["FR", "AU"], rollOff: true},
      {candidates: ["GE"], rollOff: false},
      {candidates: ["UK"], rollOff: false},
    ]);
    expect(choices("Poland")).toEqual([
      {candidates: ["FR"], rollOff: false},
      {candidates: ["AU", "GE"], rollOff: true},
      null,
    ]);
  });
});

// ---------------------------------------------------------------------------
// Candidate eligibility and ordering
// ---------------------------------------------------------------------------

describe("13.4.2 aid eligibility", () => {
  test("the attacker, its allies, truce partners and eliminated powers cannot aid", () => {
    const G = fresh();
    // Belgium's home holds the UK diplomacy marker at setup.
    expect(canAidMinor(G, "GE", "Belgium", "UK")).toBe(true);
    expect(canAidMinor(G, "GE", "Belgium", "GE")).toBe(false);

    G.powers.GE.alliance = "taAligned";
    G.powers.UK.alliance = "taAligned";
    expect(canAidMinor(G, "GE", "Belgium", "UK")).toBe(false);
    G.powers.UK.alliance = "neutral";

    const settled = createWarState(G, "GE", "UK", "conquest", ["belgium"], 2);
    settled.truceTurns = 1;
    G.wars.push(settled);
    expect(canAidMinor(G, "GE", "Belgium", "UK")).toBe(false);
    G.wars.pop();

    G.powers.UK.eliminated = true;
    expect(canAidMinor(G, "GE", "Belgium", "UK")).toBe(false);
  });

  test("the diplomacy holder is asked first, then the table choices filter the attacker", () => {
    const G = fresh();
    // Belgium's diplomacy marker belongs to the UK at setup; the table's 1st
    // Choice is UK/GE, and GE is the attacker, so the UK is the only candidate.
    const slots = seekingAidSlots(G, "GE", "Belgium");
    expect(slots).toEqual([
      {step: 1, diplomacy: true, candidates: ["UK"], rollOff: false},
      {step: 2, diplomacy: false, candidates: ["UK"], rollOff: false},
      {step: 3, diplomacy: false, candidates: ["FR"], rollOff: false},
    ]);
  });

  test("a two-player table cell keeps its pair and marks the roll-off", () => {
    const G = fresh();
    const slots = seekingAidSlots(G, "GE", "Greece");
    expect(slots[0]).toEqual({step: 2, diplomacy: false, candidates: ["UK", "RU"], rollOff: true});
    expect(slots[1]).toEqual({step: 3, diplomacy: false, candidates: ["FR", "AU"], rollOff: true});
  });

  test("a diplomacy marker on any space the power controls counts", () => {
    const G = fresh();
    G.persistent.italyUnified = true;
    G.flags.italyUnified = true;
    G.spaces.rome.control = "IT";
    G.spaces.rome.diplomacy = null;
    G.spaces.naples.control = "IT";
    G.spaces.naples.diplomacy = "FR";
    expect(seekingAidSlots(G, "GE", "Italy")[0]).toEqual({
      step: 1,
      diplomacy: true,
      candidates: ["FR"],
      rollOff: false,
    });
  });

  test("no eligible candidate means no slots at all", () => {
    const G = fresh();
    // Put every table power of Denmark's row into the attacker's alliance.
    G.powers.GE.alliance = "taAligned";
    for (const power of ["UK", "FR", "RU"] as const) G.powers[power].alliance = "taAligned";
    expect(seekingAidSlots(G, "GE", "Denmark")).toEqual([]);
  });

  test("gaining the alliance writes the marker on the minor's home", () => {
    const G = fresh();
    expect(G.spaces.belgium.diplomacy).toBe("UK");
    expect(applyMinorAidAlliance(G, "Belgium", "FR")).toBe("belgium");
    expect(G.spaces.belgium.ally).toBe("FR");
    expect(G.spaces.belgium.diplomacy).toBeNull();
    expect(applyMinorAidAlliance(G, "Atlantis", "FR")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 13.4.3 roll-off
// ---------------------------------------------------------------------------

describe("13.4.3 roll-off", () => {
  test("the higher roll gets the first chance", () => {
    expect(rollOffAidOrder(["UK", "RU"], diceSource([2, 5])).order).toEqual(["RU", "UK"]);
    expect(rollOffAidOrder(["UK", "RU"], diceSource([6, 1])).order).toEqual(["UK", "RU"]);
  });

  test("ties are rerolled", () => {
    const rolled = rollOffAidOrder(["FR", "AU"], diceSource([3, 3, 1, 4]));
    expect(rolled.order).toEqual(["AU", "FR"]);
    expect(rolled.rolls).toEqual([
      {power: "FR", roll: 3},
      {power: "AU", roll: 3},
      {power: "FR", roll: 1},
      {power: "AU", roll: 4},
    ]);
  });

  test("an unreachable tie falls back to the printed seat order", () => {
    const rolled = rollOffAidOrder(["UK", "GE"], diceSource([4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]));
    expect(rolled.order).toEqual(["GE", "UK"]);
  });

  test("the roll-off is replayable for a fixed die sequence", () => {
    const first = rollOffAidOrder(["UK", "RU"], diceSource([2, 5]));
    const second = rollOffAidOrder(["UK", "RU"], diceSource([2, 5]));
    expect(second).toEqual(first);
  });
});

// ---------------------------------------------------------------------------
// Live aid chain
// ---------------------------------------------------------------------------

describe("13.4.2 live Seeking Aid", () => {
  test("the aid decision is a private pending owned by the asked player", () => {
    const G = fresh();
    expect(declareOn(G, "Belgium", ["belgium"])).toBeUndefined();

    expect(G.pending?.kind).toBe("minorAid");
    expect(G.pending?.power).toBe("UK");
    expect(G.pending?.options.map((entry) => entry.id).sort()).toEqual(["aid", "decline"]);
    expect(G.war).toBeNull();
    expect(G.phase).toBe("action");
    expect(lastLog(G, "minorAllyAsked")?.args).toMatchObject({minor: "Belgium", power: "UK", step: 1, diplomacy: true});

    const other = redactForView(G, seat("FR"));
    expect(other.pending?.options).toEqual([]);
    expect(other.pending?.context).toEqual({});
  });

  test("aiding gains the alliance and creates the war with the aider as defender", () => {
    const G = fresh();
    declareOn(G, "Belgium", ["belgium"]);
    expect(resolvePending(G, makeCtx([], seat("UK")), "aid")).toBeUndefined();

    // 13.4.2: "that player immediately gains an alliance with it."
    expect(G.spaces.belgium.ally).toBe("UK");
    expect(G.spaces.belgium.diplomacy).toBeNull();
    // 13.4: treated as a declaration on the aiding player.
    expect(G.war?.defender).toBe("UK");
    expect(G.war?.minorTarget).toEqual({minor: "Belgium", ally: "UK"});
    expect(G.war?.defenderMinors).toEqual(["Belgium"]);
    expect(G.phase).toBe("wartime");
    // 14.2: the aiding player shifts away from the attacker.
    expect(G.powers.UK.alliance).toBe("teAligned");
    expect(lastLog(G, "minorAidGranted")?.args).toMatchObject({minor: "Belgium", ally: "UK", space: "belgium"});
  });

  test("a decline moves through the printed order and ends unopposed", () => {
    const G = fresh();
    declareOn(G, "Belgium", ["belgium"]);

    // Diplomacy-marker step: the UK.
    expect(G.pending?.power).toBe("UK");
    expect(resolvePending(G, makeCtx([], seat("UK")), "decline")).toBeUndefined();
    // Table 1st Choice: UK is still the only eligible name (GE is the attacker).
    expect(G.pending?.kind).toBe("minorAid");
    expect(G.pending?.power).toBe("UK");
    expect(G.pending?.context?.current).toMatchObject({step: 2, diplomacy: false});
    expect(resolvePending(G, makeCtx([], seat("UK")), "decline")).toBeUndefined();
    // Table 2nd Choice: France.
    expect(G.pending?.power).toBe("FR");
    expect(resolvePending(G, makeCtx([], seat("FR")), "decline")).toBeUndefined();

    // No player aids the power: 13.4.2's "proceed to the initiative order and
    // war budget step" now creates the 15.4.2 lone non-player war (and keeps
    // the declaration ledger).
    expect(G.pending).toBeNull();
    expect(G.war).not.toBeNull();
    expect(G.war?.defender).toBe("Belgium");
    expect(G.war?.minorTarget).toEqual({minor: "Belgium", ally: null});
    expect(G.phase).toBe("wartime");
    expect(G.minorDeclarations).toHaveLength(1);
    expect(G.minorDeclarations?.[0]).toMatchObject({attacker: "GE", minor: "Belgium", aim: "conquest"});
    expect(lastLog(G, "minorUnopposed")?.args).toMatchObject({target: "Belgium"});
  });

  test("a two-player cell rolls off and the loser gets the next chance", () => {
    const G = fresh();
    // Greece has no diplomacy marker; its 1st Choice is UK/RU (roll off).
    expect(declareOn(G, "Greece", ["greece"], [5, 2])).toBeUndefined();

    expect(lastLog(G, "minorAidRoll")?.args).toMatchObject({minor: "Greece", order: "UK,RU", rolls: "UK:5,RU:2"});
    expect(G.pending?.power).toBe("UK");
    expect(resolvePending(G, makeCtx([], seat("UK")), "decline")).toBeUndefined();
    // The losing roller is asked next, before the 2nd Choice column.
    expect(G.pending?.power).toBe("RU");
    expect(G.pending?.context?.current).toMatchObject({step: 2, candidates: ["UK", "RU"]});
    expect(resolvePending(G, makeCtx([], seat("RU")), "decline")).toBeUndefined();
    expect(G.pending?.power).toBe("FR");
  });

  test("a truce partner is skipped, and the table still runs", () => {
    const G = fresh();
    const settled = createWarState(G, "GE", "UK", "conquest", ["belgium"], 2);
    settled.truceTurns = 1;
    G.wars.push(settled);
    expect(declareOn(G, "Belgium", ["belgium"])).toBeUndefined();
    // The UK cannot join a war against GE (13.5); the 1st Choice cell has no
    // other eligible name, so the 2nd Choice (France) is asked.
    expect(G.pending?.power).toBe("FR");
  });

  test("no candidate at all creates the lone war immediately", () => {
    const G = fresh();
    G.powers.GE.alliance = "taAligned";
    for (const power of ["UK", "FR", "RU"] as const) G.powers[power].alliance = "taAligned";
    expect(declareOn(G, "Denmark", ["denmark"])).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.minorDeclarations).toHaveLength(1);
    // 13.4.2 → 15.4.2: the unaided declaration is a real war on the minor.
    expect(G.war).not.toBeNull();
    expect(G.war?.defender).toBe("Denmark");
    expect(G.war?.minorTarget).toEqual({minor: "Denmark", ally: null});
    expect(G.phase).toBe("wartime");
  });

  test("declining the pending advances the search", () => {
    const G = fresh();
    declareOn(G, "Belgium", ["belgium"]);
    expect(declinePending(G, makeCtx([], seat("UK")))).toBeUndefined();
    expect(G.pending?.kind).toBe("minorAid");
    expect(G.pending?.power).toBe("UK");
  });

  test("Napoleon's Legacy on a minor declaration chains into the aid search", () => {
    const G = fresh();
    G.powers.FR.goals = ["NG-24"];
    beginAction(G, "FR");
    const stability = G.powers.FR.stability;
    expect(declareWar(G, makeCtx([], seat("FR")), {minor: "Belgium"}, "conquest", ["belgium"], 2)).toBeUndefined();
    // 33.3 asks first; the declaration (and its 13.4.2 aid search) waits.
    expect(G.pending?.kind).toBe("napoleonsLegacy");
    expect(resolvePending(G, makeCtx([], seat("FR")), "reveal")).toBeUndefined();
    expect(G.revealedGoals).toContain("NG-24");
    expect(G.pending?.kind).toBe("minorAid");

    // No aid: the unopposed declaration applies the printed 13.3 penalty with
    // the 2-point Napoleon's Legacy discount (WTT 1 - 2 = no stability loss).
    declinePending(G, makeCtx([], seat(G.pending.power)));
    if (G.pending?.kind === "minorAid") declinePending(G, makeCtx([], seat(G.pending.power)));
    if (G.pending?.kind === "minorAid") declinePending(G, makeCtx([], seat(G.pending.power)));
    expect(G.pending).toBeNull();
    expect(G.wtt).toBe(1);
    expect(G.powers.FR.stability).toBe(stability);
    expect(G.minorDeclarations).toHaveLength(1);
  });

  test("a stale/forged aid from the attacker is rejected", () => {
    const G = fresh();
    declareOn(G, "Belgium", ["belgium"]);
    const before = JSON.stringify(G);
    expect(resolvePending(G, makeCtx([], seat("GE")), "aid")).toBe(INVALID_MOVE);
    expect(resolvePending(G, makeCtx([], seat("UK")), "betray")).toBe(INVALID_MOVE);
    expect(JSON.stringify(G)).toBe(before);
  });
});
