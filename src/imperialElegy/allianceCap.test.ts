/**
 * Rule 8.4 — three-player alliance maximum.
 *
 * The cap is owned by `engine/alliance.ts` and enforced by every live path that
 * can move a player's chit into an alliance box: the alliance-resolution step
 * (20.9), the Shifting Alliances / Alliance System events and card specials
 * (through `shiftAlliance`), and the GW neutral entry.  The ally-call path can
 * only ever call a power that is already a member, so it is covered as an
 * invariant rather than a fourth-player path.
 *
 * Rule 8.4's "Important: Italy is not a player power and hence they are not
 * subject to this rule" also exempts the US major: their GW entry is tested
 * here to pin that printed exemption.
 */

import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {ImperialElegyState, Power, POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {
  ALLIANCE_MAX_PLAYERS,
  allianceAtCapacity,
  allianceMembers,
  canJoinAlliance,
  setAlliance,
  shiftAlliance,
} from "./engine/alliance";
import {resolveAllianceStep} from "./engine/effects";
import {enterGwAlly, joinNeutralAlliance, neutralEntrySides, resolveGwWinter} from "./engine/greatWarFlow";
import {createWarState} from "./engine/limitedWar";
import {CARDS} from "./constant/cards.data";
import {callWarAlly, resolvePending} from "./moves";

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

const fillAlliance = (G: ImperialElegyState, side: "te" | "ta"): Power[] => {
  const members: Power[] = side === "te" ? ["UK", "FR", "RU"] : ["AU", "GE", "RU"];
  for (const power of members) G.powers[power].alliance = side === "te" ? "teAligned" : "taAligned";
  return members;
};

// ---------------------------------------------------------------------------
// The shared helper
// ---------------------------------------------------------------------------

test("allianceAtCapacity counts three player powers and excludes the moving power", () => {
  const G = fresh();
  expect(allianceMembers(G, "te")).toEqual([]);
  fillAlliance(G, "te");

  expect(ALLIANCE_MAX_PLAYERS).toBe(3);
  expect(allianceMembers(G, "te")).toEqual(["UK", "FR", "RU"]);
  expect(allianceAtCapacity(G, "te")).toBe(true);
  // A power already in the alliance is not blocked by its own presence.
  expect(allianceAtCapacity(G, "te", "RU")).toBe(false);
  expect(canJoinAlliance(G, "RU", "te")).toBe(true);
  expect(canJoinAlliance(G, "GE", "te")).toBe(false);
});

test("setAlliance refuses to put a fourth player into a full alliance", () => {
  const G = fresh();
  fillAlliance(G, "ta");
  expect(setAlliance(G, "UK", "taAligned")).toBe(false);
  expect(G.powers.UK.alliance).toBe("neutral");
  expect(setAlliance(G, "UK", "teAligned")).toBe(true);
  expect(G.powers.UK.alliance).toBe("teAligned");
});

test("shiftAlliance stops before a full alliance but a legal third join works", () => {
  const full = fresh();
  fillAlliance(full, "te");
  const blocked = shiftAlliance(full, "GE", "te", 2);
  expect(blocked).toMatchObject({from: "neutral", to: "neutral", steps: 0, blocked: true});
  expect(full.powers.GE.alliance).toBe("neutral");

  const open = fresh();
  open.powers.UK.alliance = "teAligned";
  open.powers.FR.alliance = "teCommitted";
  const joined = shiftAlliance(open, "GE", "te", 2);
  expect(joined).toMatchObject({from: "neutral", to: "teCommitted", steps: 2, blocked: false});
  expect(allianceMembers(open, "te")).toHaveLength(3);
});

// ---------------------------------------------------------------------------
// 20.9 alliance resolution
// ---------------------------------------------------------------------------

test("the alliance-resolution step refuses a shift into a full alliance in printed order", () => {
  const G = fresh();
  fillAlliance(G, "te");
  // Germany has the highest total influence, so it resolves first and finds
  // the Entente already full.
  G.powers.GE.mpit = {te: 6, ta: 0, neutral: 0};
  G.powers.AU.mpit = {te: 0, ta: 4, neutral: 0};

  const resolved = resolveAllianceStep(G, makeCtx([1, 1, 1, 1, 1, 1, 1, 1]));
  expect(resolved[0].power).toBe("GE");
  expect(resolved[0].blocked).toBe(true);
  expect(G.powers.GE.alliance).toBe("neutral");
  // AU shifts into the still-open Triple Alliance afterwards.
  expect(G.powers.AU.alliance).toBe("taAligned");
});

test("a legal third player still joins through the alliance-resolution step", () => {
  const G = fresh();
  G.powers.UK.alliance = "teAligned";
  G.powers.FR.alliance = "teCommitted";
  // Give the existing members their matching MPIT influence so they do not
  // drift back to neutral while Germany resolves.
  G.powers.UK.mpit = {te: 1, ta: 0, neutral: 0};
  G.powers.FR.mpit = {te: 1, ta: 0, neutral: 0};
  G.powers.GE.mpit = {te: 5, ta: 0, neutral: 0};
  resolveAllianceStep(G, makeCtx());
  expect(G.powers.GE.alliance).toBe("teAligned");
  expect(allianceMembers(G, "te")).toHaveLength(3);
});

// ---------------------------------------------------------------------------
// Neutral entry (29.3)
// ---------------------------------------------------------------------------

const gwState = (G: ImperialElegyState, te: Power[], ta: Power[], neutrals: Power[]): void => {
  G.gw = {
    active: true,
    turn: 1,
    order: [...te, ...ta],
    belligerents: [...te, ...ta],
    neutrals: [...neutrals],
    te: [...te],
    ta: [...ta],
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
  };
  for (const power of te) G.powers[power].alliance = "teCommitted";
  for (const power of ta) G.powers[power].alliance = "taCommitted";
  G.phase = "gwWinter";
};

test("a neutral player cannot join a full alliance (logged) and is offered the other", () => {
  const G = fresh();
  gwState(G, ["GE", "FR", "RU"], ["AU"], ["OT", "UK"]);

  // 8.4: the three-player Entente is closed to OT.
  expect(neutralEntrySides(G, "OT")).toEqual(["ta"]);
  // The live 29.3 decision offers only the legal side plus staying neutral.
  const res = resolveGwWinter(G, makeCtx());
  expect(res.ok).toBe(true);
  if (!res.ok) throw new Error(res.message);
  expect(G.pending?.kind).toBe("gwNeutralEntry");
  expect(G.pending?.options.map((entry) => entry.id)).toEqual(["join:ta", "stay"]);
  // A direct join of the full alliance is refused through the engine helper.
  expect(joinNeutralAlliance(G, makeCtx(), "OT", "te")).toBe(false);
  expect(G.powers.OT.alliance).toBe("neutral");
  expect(G.gw?.neutrals).toContain("OT");
  expect(G.log.some((entry) => entry.key === "gwNeutralEntryBlocked" && entry.power === "OT")).toBe(true);
});

test("a neutral player enters a side that still has room", () => {
  const G = fresh();
  gwState(G, ["GE"], ["AU"], ["OT", "UK"]);

  expect(canJoinAlliance(G, "OT", "te")).toBe(true);
  expect(joinNeutralAlliance(G, makeCtx(), "OT", "te")).toBe(true);

  expect(G.powers.OT.alliance).toBe("teCommitted");
  expect(G.gw?.te).toContain("OT");
  expect(allianceMembers(G, "te")).toHaveLength(2);
});

// ---------------------------------------------------------------------------
// GW #2 — non-player majors are exempt
// ---------------------------------------------------------------------------

test("US/Italy entry is exempt from the player cap (8.4 Important)", () => {
  const G = fresh();
  gwState(G, ["GE", "FR", "RU"], ["AU"], ["OT", "UK"]);
  expect(allianceAtCapacity(G, "te")).toBe(true);
  const result = enterGwAlly(G, makeCtx(), "US", "te");
  expect(result.ok).toBe(true);
  expect(G.gw?.usIn).toBe(true);
  expect(G.flags.usSide).toBe("te");
});

// ---------------------------------------------------------------------------
// Ally calls
// ---------------------------------------------------------------------------

test("an ally call only joins an existing member, so it cannot create a fourth player", () => {
  const G = fresh();
  G.powers.GE.alliance = "taAligned";
  G.powers.AU.alliance = "taAligned";
  const joinCard = CARDS.actions.find((card) => card.type === "event")!.id;
  G.powers.AU.hand = [joinCard];
  G.war = createWarState(G, "GE", "FR", "conquest", ["alsace"], 2);
  G.war.status = "alliance";
  G.phase = "wartime";
  G.activePower = "GE";
  const ctx = makeCtx([], seat("GE"));

  // An outsider (UK, neutral) cannot be called even with an open alliance.
  expect(callWarAlly(G, ctx, "UK")).toBe(INVALID_MOVE);
  expect(G.powers.UK.alliance).toBe("neutral");
  // The existing ally can still be called normally.  Rule 14.0 requires the
  // called ally's own consent before it joins (agent 2's live flow).
  expect(callWarAlly(G, ctx, "AU")).toBeUndefined();
  expect(G.pending?.kind).toBe("warAllyConsent");
  expect(G.pending?.power).toBe("AU");
  expect(resolvePending(G, makeCtx([], seat("AU")), "accept")).toBeUndefined();
  expect(G.war.attackerAllies).toEqual(["AU"]);
  expect(allianceMembers(G, "ta")).toHaveLength(2);
});
