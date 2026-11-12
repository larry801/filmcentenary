/**
 * Live Crisis Table flow (rulebook 23.0–23.5).
 *
 * These drive the real moves: a card that raises the WTT to 5 opens the
 * "Roll on the Crisis Table" decision, `resolvePending` rolls, and any special
 * result opens its follow-up choice through the same pending decision pattern.
 * The dice are scripted, so every scenario is deterministic.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {AllianceBox, ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {outbreakGreatWar} from "./engine/greatWar";
import {crisisRoll} from "./engine/greatWar";
import {playCard, resolvePending, declinePending} from "./moves";

/** A ctx factory that shares one dice cursor, so multi-step flows stay scripted. */
const scripted = (dice: number[]): ((playerID?: string | null) => Ctx) => {
  let index = 0;
  return (playerID: string | null = "0"): Ctx =>
    ({
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
    }) as unknown as Ctx;
};

const seat = (power: Power): string => String(POWERS.indexOf(power));

const fresh = (): ImperialElegyState => setupImperialElegy(scripted([3])("0"));

/** Put the game in the action phase with GE holding `card` and the WTT at 4. */
const armCard = (G: ImperialElegyState, card: string): void => {
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 0;
  G.pending = null;
  G.wtt = 4;
  G.powers.GE.hand.push(card);
};

const setAlliances = (G: ImperialElegyState, boxes: Partial<Record<Power, AllianceBox>>): void => {
  for (const power of POWERS) {
    G.powers[power].alliance = boxes[power] ?? "neutral";
  }
};

const lastLog = (G: ImperialElegyState, key: string) => [...G.log].reverse().find((entry) => entry.key === key);

describe("23.1 crisis roll sequencing", () => {
  test("an International Conference resets the WTT and resumes the inciting card", () => {
    const G = fresh();
    armCard(G, "IE-A017");
    const next = scripted([5]);
    // The WTT increase opens the crisis before the card's target choice.
    expect(playCard(G, next("0"), "IE-A017", "event")).toBeUndefined();
    expect(G.pending?.kind).toBe("crisis");
    expect(G.wtt).toBe(5);

    expect(resolvePending(G, next("0"), "roll")).toBeUndefined();
    expect(G.gw).toBeNull();
    expect(G.wtt).toBe(4);
    expect(G.persistent.conferenceUsed).toBe(true);
    // 23.1: "If it doesn't break out, the rest of the text is followed" — the
    // Assassination's own "choose a player" is now the open decision.
    expect(G.pending?.kind).toBe("eventTargetPower");
  });

  test("a second conference result rerolls the die instead of starting the war", () => {
    const G = fresh();
    armCard(G, "IE-A017");
    G.persistent.conferenceUsed = true;
    const next = scripted([6, 3]);
    playCard(G, next("0"), "IE-A017", "event");
    expect(resolvePending(G, next("0"), "roll")).toBeUndefined();
    // The 6 was a conference (already used) so the 3 was rolled: bordering
    // nation, which asks for the assassination target.
    expect(G.gw).toBeNull();
    expect(G.pending?.kind).toBe("crisisIncident");
    const reroll = G.log.filter((entry) => entry.key === "crisisRoll" && /reroll/.test(String(entry.args?.result)));
    expect(reroll.length).toBeGreaterThan(0);
  });

  test("the crisis DRM is applied once and consumed", () => {
    const G = fresh();
    armCard(G, "IE-A017");
    G.flags.crisisDrm = 2;
    const next = scripted([3]);
    playCard(G, next("0"), "IE-A017", "event");
    resolvePending(G, next("0"), "roll");
    // 3 + 2 = 5: conference, not the bordering nation a bare 3 would give.
    expect(G.persistent.conferenceUsed).toBe(true);
    expect(G.wtt).toBe(4);
    expect(G.flags.crisisDrm).toBe(0);
    const rollLog = G.log.filter((entry) => entry.key === "crisisRoll");
    // The logged total includes the DRM (3 + 2), and it is a conference.
    expect(rollLog.some((entry) => entry.args?.roll === 5 && entry.args?.result === "International Conference")).toBe(true);
  });

  test("a total above 6 is an International Conference", () => {
    const G = fresh();
    armCard(G, "IE-A017");
    G.flags.crisisDrm = 3;
    const next = scripted([4]);
    playCard(G, next("0"), "IE-A017", "event");
    resolvePending(G, next("0"), "roll");
    expect(G.gw).toBeNull();
    expect(G.wtt).toBe(4);
    expect(G.persistent.conferenceUsed).toBe(true);
  });
});

describe("23.0 the WTT increase inside a special handler also incites", () => {
  test("Naval Arms Race opens the crisis and a 4 is a conference", () => {
    const G = fresh();
    setAlliances(G, {GE: "taCommitted", AU: "taCommitted", UK: "teCommitted", FR: "teCommitted"});
    armCard(G, "IE-A092");
    const next = scripted([4]);
    expect(playCard(G, next("0"), "IE-A092", "event")).toBeUndefined();
    // A92 now opens the printed target choice first; its WTT increase happens
    // when the target is chosen (agent 5's live chain).
    expect(G.pending?.kind).toBe("eventTargetPower");
    expect(resolvePending(G, next("0"), "UK")).toBeUndefined();
    // The handler raised the WTT inside its own text; the post-effect check
    // still opens the printed crisis decision.
    expect(G.wtt).toBe(5);
    expect(G.pending?.kind).toBe("crisis");
    expect(resolvePending(G, next("0"), "roll")).toBeUndefined();
    expect(G.gw).toBeNull();
    expect(G.wtt).toBe(4);
    expect(G.persistent.conferenceUsed).toBe(true);
    // The card's text had no further effects, so the event is finished.
    expect(G.pending).toBeNull();
    expect(G.discard).toContain("IE-A092");
  });
});

describe("23.2/23.3 special results", () => {
  test("a bordering nation places an ally marker for the alliance opposing the target", () => {
    const G = fresh();
    setAlliances(G, {GE: "taCommitted", AU: "taCommitted", UK: "teCommitted", FR: "teCommitted"});
    armCard(G, "IE-A017");
    const next = scripted([3]);
    playCard(G, next("0"), "IE-A017", "event");
    resolvePending(G, next("0"), "roll");
    // The Assassination row's incident is "Blame": the crisis first asks who
    // was targeted, then who is blamed.
    expect(G.pending?.kind).toBe("crisisIncident");
    expect(G.pending?.power).toBe("GE");
    expect(resolvePending(G, next("0"), "power:AU")).toBeUndefined();
    expect(G.pending?.kind).toBe("crisisIncident");
    const optionIds = G.pending!.options.map((o) => o.id);
    expect(optionIds).toContain("minor:Serbia");
    // A power allied to the targeted power may not be chosen.
    expect(optionIds).not.toContain("power:GE");

    expect(resolvePending(G, next("0"), "minor:Serbia")).toBeUndefined();
    expect(G.gw?.active).toBe(true);
    // The alliance opposing AU is the TE, so the first TE player places it.
    expect(G.spaces.serbia.ally).toBe("UK");
    expect(G.gw!.te).toEqual(["UK", "FR"]);
    expect(G.gw!.ta).toEqual(["GE", "AU"]);
    const outbreak = lastLog(G, "greatWarOutbreak");
    expect(String(outbreak?.args?.crisis)).toContain("Assassination — Blame — Bordering Nation");
    expect(outbreak?.args?.blameMinor).toBe("Serbia");
  });

  test("a neutral major chosen as the bordering nation is drawn in and chooses a side", () => {
    const G = fresh();
    setAlliances(G, {GE: "taCommitted", AU: "taCommitted", UK: "teCommitted", FR: "teCommitted"});
    armCard(G, "IE-A017");
    const next = scripted([3]);
    playCard(G, next("0"), "IE-A017", "event");
    resolvePending(G, next("0"), "roll");
    expect(resolvePending(G, next("0"), "power:AU")).toBeUndefined();
    const options = G.pending!.options.map((o) => o.id);
    expect(options).toContain("power:RU");
    expect(resolvePending(G, next("0"), "power:RU")).toBeUndefined();
    // §23.5: the bordering nation is a neutral player involved in the result.
    expect(G.pending?.kind).toBe("crisisAlliance");
    expect(G.pending?.power).toBe("RU");
    expect(resolvePending(G, next(seat("RU")), "ta")).toBeUndefined();
    expect(G.powers.RU.alliance).toBe("taAligned");
    expect(G.gw?.active).toBe(true);
    expect(G.gw!.ta).toContain("RU");
  });

  test("23.4: an impossible bordering nation is narrative but the war still starts", () => {
    const G = fresh();
    // FR, GE and OT are one alliance; every power/minor bordering FR is allied
    // to it, so the bordering nation cannot be chosen.
    setAlliances(G, {FR: "teCommitted", GE: "teCommitted", OT: "teCommitted", AU: "taCommitted", RU: "taCommitted"});
    for (const space of ["bavaria", "belgium", "morocco", "piedmont"]) G.spaces[space].ally = "FR";
    armCard(G, "IE-A017");
    const next = scripted([3]);
    playCard(G, next("0"), "IE-A017", "event");
    resolvePending(G, next("0"), "roll");
    expect(resolvePending(G, next("0"), "power:FR")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.gw?.active).toBe(true);
    // "A member of the opposing alliance is blamed": the TA (AU/RU) is opposing.
    const outbreak = lastLog(G, "greatWarOutbreak");
    expect(outbreak?.args?.blame).toBe("AU");
    expect(G.log.some((entry) => entry.key === "noLegalTarget")).toBe(true);
    // Purely narrative: no ally markers were placed by the impossible choice.
    expect(G.spaces.bavaria.ally).toBe("FR");
  });

  test("the Black Hand rolls its target and draws a neutral target into an alliance", () => {
    const G = fresh();
    setAlliances(G, {
      GE: "taCommitted",
      AU: "taCommitted",
      UK: "teCommitted",
      RU: "teCommitted",
      OT: "teCommitted",
    });
    armCard(G, "IE-A101");
    const next = scripted([3, 1]); // step 1: FR is the target; step 2: minority nationality
    playCard(G, next("0"), "IE-A101", "event");
    expect(resolvePending(G, next("0"), "roll")).toBeUndefined();
    expect(G.gw).toBeNull();
    // 23.5: FR is neutral and targeted, so FR freely chooses an alliance.  The
    // TE already has three players, so only the TA is legal.
    expect(G.pending?.kind).toBe("crisisAlliance");
    expect(G.pending?.power).toBe("FR");
    expect(G.pending!.options.map((o) => o.id)).toEqual(["ta"]);
    expect(resolvePending(G, next(seat("FR")), "te")).toBe(INVALID_MOVE);
    expect(resolvePending(G, next(seat("FR")), "ta")).toBeUndefined();
    expect(G.powers.FR.alliance).toBe("taAligned");
    expect(G.gw?.active).toBe(true);
    expect(G.gw!.ta).toContain("FR");
  });

  test("the Black Hand bordering nation also handles a neutral target's join", () => {
    const G = fresh();
    setAlliances(G, {GE: "taCommitted", AU: "taCommitted", UK: "teCommitted", FR: "teCommitted"});
    armCard(G, "IE-A101");
    const next = scripted([4, 3]); // step 1: RU is the target; step 2: bordering nation
    playCard(G, next("0"), "IE-A101", "event");
    resolvePending(G, next("0"), "roll");
    expect(G.pending?.kind).toBe("crisisIncident");
    expect(resolvePending(G, next("0"), "minor:Romania")).toBeUndefined();
    // RU is neutral and involved, so it chooses an alliance before the marker
    // in Romania is placed (TE 2 vs TA 2: both legal).
    expect(G.pending?.kind).toBe("crisisAlliance");
    expect(G.pending?.power).toBe("RU");
    expect(G.pending!.options.map((o) => o.id).sort()).toEqual(["ta", "te"]);
    expect(resolvePending(G, next(seat("RU")), "te")).toBeUndefined();
    expect(G.gw?.active).toBe(true);
    // RU joined the TE, so a TA player holds Romania.
    expect(G.spaces.romania.ally).toBe("GE");
  });

  test("a Powder Keg Balkan Table joins the threatened state to the respondent", () => {
    const G = fresh();
    setAlliances(G, {GE: "taCommitted", AU: "taCommitted", UK: "teCommitted", FR: "teCommitted", RU: "taCommitted"});
    G.spaces.serbia.control = "Serbia";
    G.spaces.bulgaria.control = "Bulgaria";
    armCard(G, "IE-A053");
    // 1 = Balkan Table (roll twice); 3 = Serbia threatened; 4 = Bulgaria and
    // 6 = Greece threatening; 1 = step 2 "Ally (Russia if no ally)".
    const next = scripted([1, 3, 4, 6, 1]);
    playCard(G, next("0"), "IE-A053", "event");
    expect(resolvePending(G, next("0"), "roll")).toBeUndefined();
    expect(G.gw?.active).toBe(true);
    expect(G.pending).toBeNull();
    // Serbia had no ally, so Russia is the respondent; Serbia joins Russia.
    expect(G.spaces.serbia.ally).toBe("RU");
    // The threatening states join the alliance opposing Russia (the TE).
    expect(G.spaces.bulgaria.ally).toBe("UK");
    expect(G.spaces.greece.ally).toBe("UK");
    const rolls = G.log.filter((entry) => entry.key === "crisisRoll");
    expect(rolls.some((entry) => String(entry.args?.result).includes("Balkan Table (Roll twice)"))).toBe(true);
    expect(rolls.some((entry) => entry.args?.respondent === "RU")).toBe(true);
  });

  test("a Bosnian Crisis Balkan Table puts the states in the alliance opposing AU", () => {
    const G = fresh();
    setAlliances(G, {GE: "taCommitted", AU: "taCommitted", UK: "teCommitted", FR: "teCommitted"});
    G.spaces.serbia.control = "Serbia";
    // A103 is printed "Playable if the Ottomans do not control the Balkans
    // flashpoint"; the campaign start has the Ottomans at five Balkan keys.
    G.spaces.bulgaria.control = "Bulgaria";
    armCard(G, "IE-A103");
    // 4 = the Bosnian Crisis die raises the WTT; 1 = Balkan Table (twice);
    // 3 = Serbia and 6 = Greece.
    const next = scripted([4, 1, 3, 6]);
    playCard(G, next("0"), "IE-A103", "event");
    expect(G.pending?.kind).toBe("crisis");
    expect(resolvePending(G, next("0"), "roll")).toBeUndefined();
    expect(G.gw?.active).toBe(true);
    expect(G.spaces.serbia.ally).toBe("UK");
    expect(G.spaces.greece.ally).toBe("UK");
  });

  test("a Balkan Table 'Choice' result asks the active player for the state", () => {
    const G = fresh();
    setAlliances(G, {GE: "taCommitted", AU: "taCommitted", UK: "teCommitted", FR: "teCommitted", RU: "taCommitted"});
    G.spaces.serbia.control = "Serbia";
    G.spaces.bulgaria.control = "Bulgaria";
    armCard(G, "IE-A053");
    // 3 = Balkan Table (roll once); 3 = Serbia threatened; 1 = Choice; 1 = respondent.
    const next = scripted([3, 3, 1, 1]);
    playCard(G, next("0"), "IE-A053", "event");
    resolvePending(G, next("0"), "roll");
    expect(G.pending?.kind).toBe("crisisIncident");
    expect(G.pending!.options.map((o) => o.id)).toContain("minor:Bulgaria");
    expect(resolvePending(G, next("0"), "minor:Bulgaria")).toBeUndefined();
    expect(G.gw?.active).toBe(true);
    expect(G.spaces.serbia.ally).toBe("RU");
    expect(G.spaces.bulgaria.ally).toBe("UK");
  });
});

describe("23.1 the inciting card's post-WTT text", () => {
  test("a narrative outbreak ignores the rest of the Assassination! text", () => {
    const G = fresh();
    setAlliances(G, {GE: "taCommitted", AU: "taCommitted", UK: "teCommitted", FR: "teCommitted"});
    armCard(G, "IE-A017");
    const stabilityBefore = G.powers.FR.stability;
    const next = scripted([2]); // minority nationality: narrative
    playCard(G, next("0"), "IE-A017", "event");
    resolvePending(G, next("0"), "roll");
    expect(G.pending?.kind).toBe("crisisIncident"); // the "Blame" incident target
    expect(resolvePending(G, next("0"), "power:FR")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.gw?.active).toBe(true);
    // "If GW breaks out the rest of the text on the event is ignored": FR never
    // loses a card (no event discard) or stability for the Assassination.  The
    // hand is empty only because 25.1 discards every action card at the outbreak.
    expect(G.powers.FR.stability).toBe(stabilityBefore);
    expect(G.log.some((entry) => entry.key === "eventDiscard")).toBe(false);
    expect(G.discard).toContain("IE-A017");
  });

  test("a Powder Keg International Conference delays the rest of the text until after the roll", () => {
    const G = fresh();
    armCard(G, "IE-A053");
    const next = scripted([5]); // International Conference
    playCard(G, next("0"), "IE-A053", "event");
    expect(G.pending?.kind).toBe("crisis");
    // 23.1: everything after the WTT increase waits for the crisis roll.
    expect(G.spaces["bosnia-herzegovina"].rebellion).toBeNull();

    expect(resolvePending(G, next("0"), "roll")).toBeUndefined();
    expect(G.gw).toBeNull();
    expect(G.wtt).toBe(4);
    // No outbreak, so "the rest of the text is followed".
    expect(G.spaces["bosnia-herzegovina"].rebellion).not.toBeNull();
  });

  test("a Powder Keg outbreak ignores its rebel-placement text", () => {
    const G = fresh();
    setAlliances(G, {GE: "taCommitted", AU: "taCommitted", UK: "teCommitted", FR: "teCommitted", RU: "taCommitted"});
    G.spaces.serbia.control = "Serbia";
    G.spaces.bulgaria.control = "Bulgaria";
    armCard(G, "IE-A053");
    // 1 = Balkan Table (roll twice); then the printed Balkan draws/respondent.
    const next = scripted([1, 3, 4, 6, 1]);
    playCard(G, next("0"), "IE-A053", "event");
    expect(G.pending?.kind).toBe("crisis");
    expect(resolvePending(G, next("0"), "roll")).toBeUndefined();
    expect(G.gw?.active).toBe(true);
    // "If GW breaks out the rest of the text on the event is ignored": the
    // 2 rebel armies and 0 WoI markers are never placed.
    expect(G.spaces["bosnia-herzegovina"].rebellion).toBeNull();
    expect(G.spaces.macedonia.rebellion).toBeNull();
    expect(Object.values(G.units).some((unit) => unit.owner === "REBEL:Balkans")).toBe(false);
  });

  test("a Balkan Wars outbreak ignores the independence roll and Macedonia award", () => {
    const G = fresh();
    setAlliances(G, {GE: "taCommitted", AU: "taCommitted", UK: "teCommitted", FR: "teCommitted", RU: "taCommitted"});
    G.spaces.serbia.control = "Serbia";
    G.spaces.bulgaria.control = "Bulgaria";
    armCard(G, "IE-A100");
    const next = scripted([1, 3, 4, 6, 1]);
    playCard(G, next("0"), "IE-A100", "event");
    expect(G.pending?.kind).toBe("crisis");
    expect(resolvePending(G, next("0"), "roll")).toBeUndefined();
    expect(G.gw?.active).toBe(true);
    // No independence decision and no award: the printed text after the WTT
    // increase is ignored on outbreak.
    expect(G.pending).toBeNull();
    expect(G.spaces.macedonia.control).toBe("OT");
  });
});

describe("23.5 neutral players joining an alliance", () => {
  test("multiple drawn neutrals are allocated without exceeding three per alliance", () => {
    const G = fresh();
    setAlliances(G, {GE: "taCommitted", AU: "taCommitted", UK: "teCommitted", FR: "teCommitted", RU: "teCommitted"});
    armCard(G, "IE-A101");
    // Step 1: RU target, step 2: minority nationality.  RU is already TE, so no
    // join; the die is not used again.
    const next = scripted([4, 1]);
    playCard(G, next("0"), "IE-A101", "event");
    resolvePending(G, next("0"), "roll");
    expect(G.gw?.active).toBe(true);
    expect(G.pending).toBeNull();
    expect(G.powers.RU.alliance).toBe("teCommitted");
  });

  test("a neutral player with no legal alliance stays neutral", () => {
    const G = fresh();
    // Both alliances already hold three players.
    setAlliances(G, {
      GE: "taCommitted",
      AU: "taCommitted",
      RU: "taCommitted",
      UK: "teCommitted",
      FR: "teCommitted",
      OT: "teCommitted",
    });
    armCard(G, "IE-A101");
    const next = scripted([1, 1]); // GE target, minority nationality; GE is not neutral
    playCard(G, next("0"), "IE-A101", "event");
    resolvePending(G, next("0"), "roll");
    expect(G.gw?.active).toBe(true);
    expect(G.powers.GE.alliance).toBe("taCommitted");
  });
});

describe("25.3 blame from the Crisis Table result", () => {
  const unifiedNeutralItaly = (G: ImperialElegyState): void => {
    G.persistent.italyUnified = true;
    G.persistent.italyAlliance = "neutral";
    G.persistent.italyIndependent = false;
  };

  test("a real blamed power that is not Italy does not force Italy in", () => {
    const G = fresh();
    setAlliances(G, {GE: "taCommitted", AU: "taCommitted", UK: "teCommitted", FR: "teCommitted"});
    unifiedNeutralItaly(G);
    // The printed-card approximation would blame Italy for Assassination!;
    // the table's real blame (GE) must override it.
    outbreakGreatWar(G, scripted([6])("0"), "GE", "IE-A017", {label: "Assassination — Blame — Minority Nationality", blame: "GE"});
    expect(G.gw?.active).toBe(true);
    expect(G.gw!.italyIn).toBe(false);
    expect(G.gw!.italyAlliance).toBe("neutral");
  });

  test("Italy blamed by the table result joins from the neutral box", () => {
    const G = fresh();
    setAlliances(G, {GE: "taCommitted", AU: "taCommitted", UK: "teCommitted", FR: "teCommitted"});
    unifiedNeutralItaly(G);
    outbreakGreatWar(G, scripted([6])("0"), "GE", "IE-A017", {label: "Assassination — Blame — Bordering Nation", blame: "IT"});
    expect(G.gw?.italyIn).toBe(true);
    expect(G.flags.italySide).toBe("ta");
    expect(G.gw!.italyAlliance).toBe("taCommitted");
  });

  test("without table context the printed-card fallback still blames Italy", () => {
    const G = fresh();
    setAlliances(G, {GE: "taCommitted", AU: "taCommitted", UK: "teCommitted", FR: "teCommitted"});
    unifiedNeutralItaly(G);
    outbreakGreatWar(G, scripted([6])("0"), "GE", "IE-A017");
    expect(G.gw!.italyIn).toBe(true);
  });
});

describe("the defensive fallback row", () => {
  test("an unmatched inciting event is narrative on 1-4 and a conference on 5-6", () => {
    const narrative = fresh();
    setAlliances(narrative, {GE: "taCommitted", AU: "taCommitted", UK: "teCommitted", FR: "teCommitted"});
    expect(crisisRoll(narrative, scripted([4])("0"), "GE", "test")).toBe("outbreak");
    expect(narrative.gw?.active).toBe(true);
    // The defensive fallback is marked in the log so a missing printed row is
    // visible during play-testing.
    expect(lastLog(narrative, "crisisRoll")?.args?.fallback).toBe(true);
    expect(String(lastLog(narrative, "crisisRoll")?.args?.result)).toBe("Narrative result");

    const conference = fresh();
    setAlliances(conference, {GE: "taCommitted", AU: "taCommitted", UK: "teCommitted", FR: "teCommitted"});
    expect(crisisRoll(conference, scripted([6])("0"), "GE", "test")).toBe("conference");
    expect(conference.gw).toBeNull();
    expect(conference.wtt).toBe(4);
  });
});

describe("pending decline safety", () => {
  test("declining a crisis choice takes the first printed option", () => {
    const G = fresh();
    setAlliances(G, {GE: "taCommitted", AU: "taCommitted", UK: "teCommitted", FR: "teCommitted"});
    armCard(G, "IE-A017");
    const next = scripted([3]);
    playCard(G, next("0"), "IE-A017", "event");
    resolvePending(G, next("0"), "roll");
    expect(G.pending?.kind).toBe("crisisIncident");
    expect(declinePending(G, next("0"))).toBeUndefined();
    // Declining the target choice picks the first power (GE) and finishes.
    expect(G.pending === null || G.pending.kind === "crisisIncident").toBe(true);
  });
});
