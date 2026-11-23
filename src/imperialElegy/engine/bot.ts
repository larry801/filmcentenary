/**
 * Imperial Elegy — Rule 34 Bot
 *
 * Implements the printed Bot Player Aid (B1/B2).  The bot is a deterministic
 * decision-maker: given the current game state and a power it returns the move
 * that move that the printed priority tables prescribe.
 *
 * Entry point for boardgame.io's ai.enumerate hook: `enumerateBot`.
 * Additional exports allow the UI to drive a bot seat without MCTS.
 */

import {Ctx, PlayerID} from "boardgame.io";
import {
  CardId,
  ImperialElegyState,
  Power,
  POWERS,
  SpaceId,
} from "../types";
import {cardById} from "./deck";
import {dealsOf, negotiationDoneFor} from "./negotiation";
import {powerOfSeat, seatOf} from "./pending";
import {cpPlayability, eventPlayability, type PlayBlockReason} from "./playability";
import {SPACES, isKey, isNavalBox, neighboursOf} from "../constant/spaces";
import {
  controlledBy,
  cpBudgetFor,
  gwAllyImpulseFor,
  friendlySpace,
  hasLoc,
  isArmyKind,
  isHomeSpace,
  hostileOwner,
  landUnitsIn,
  maneuverDestinationProblem,
  navalUnitsIn,
  ownsKey,
  unitsOfPower,
} from "./rules";
import {influencePlacementProblem, minorAllianceProblem} from "./foreignAffairs";
import {impulseAlreadyUsed, recruit as recruitMove} from "../moves";
import {ottomanArmyTypeFor, passRestriction} from "./characteristics";
import {beginLandBattle} from "./combat";
import {canRecruitIn} from "./characteristics";
import {gwDraftSpaces, GwManeuverRequest, performGwManeuver} from "./greatWarFlow";
import {currentGwImpulse, gwActionAllowance, gwCardProblem, gwFinishImpulseProblem} from "./gwImpulse";
import {declarationTargetCandidates} from "./declarationTargets";
import {warDeclarationEntitlement} from "./rules";
import {reserveRemaining} from "./economy";
import {ctxWithBotRandom} from "./botRandom";
import {hasCounterFor} from "./counters";
import {holdsWarImpulse} from "./limitedWar";

// ---------------------------------------------------------------------------
// BDIT — Bot Diplomatic Interest Table (B2)
// Each cell lists the die-range that sends the bot to a given region/focus.
// ---------------------------------------------------------------------------

/** Regions on the BDIT table. */
type BditRegion =
  | "germany"
  | "italy"
  | "lowCountries"
  | "balkans"
  | "africa"
  | "greatCaucasus"
  | "japanPacific";

/**
 * BDIT roll-result → preferred diplomatic region.
 * Index 0 = die 1, index 5 = die 6 (two-dice sum maps to 1-6 by power column).
 * Entries are `[region, power-column-die-face]` pairs from the printed table.
 *
 * The table uses the first die to pick a column (GE=1, UK=2, FR=3, AU=4,
 * RU=5, OT=6) then the second die selects a row.  Here we encode as: given
 * power P and second-die value v, the preferred region.
 */
const BDIT: Record<Power, Record<number, BditRegion>> = {
  GE: {1: "germany", 2: "germany", 3: "germany", 4: "lowCountries", 5: "lowCountries", 6: "africa"},
  UK: {1: "africa", 2: "africa", 3: "africa", 4: "lowCountries", 5: "japanPacific", 6: "japanPacific"},
  FR: {1: "italy", 2: "italy", 3: "africa", 4: "africa", 5: "japanPacific", 6: "japanPacific"},
  AU: {1: "germany", 2: "germany", 3: "italy", 4: "italy", 5: "balkans", 6: "balkans"},
  RU: {1: "balkans", 2: "balkans", 3: "balkans", 4: "greatCaucasus", 5: "greatCaucasus", 6: "japanPacific"},
  OT: {1: "africa", 2: "africa", 3: "africa", 4: "balkans", 5: "balkans", 6: "balkans"},
};

// ---------------------------------------------------------------------------
// BMPIT — Bot Major Power Influence Table (B1)
// Two dice (d6 each), first die selects column (1=GE,2=UK,3=FR,4=AU,5=RU,6=OT)
// Second die selects row: 1-2=TA, 3-4=Neu, 5-6=TE.
// ---------------------------------------------------------------------------

type MpitTrack = "ta" | "neutral" | "te";
const BMPIT_ROW: Record<number, MpitTrack> = {1: "ta", 2: "ta", 3: "neutral", 4: "neutral", 5: "te", 6: "te"};

/** Given two rolled dice, return the target power and MPIT track. */
export const bmpitTarget = (die1: number, die2: number): {power: Power; track: MpitTrack} => {
  const colIndex = Math.max(0, Math.min(5, die1 - 1));
  const power = POWERS[colIndex];
  const track = BMPIT_ROW[die2] ?? "neutral";
  return {power, track};
};

/**
 * 34.3's neutral exception: "Neutral bots may split their CP" across powers.
 * The split walks the printed BMPIT columns in order so the result is
 * reproducible: the current power's next neighbour on the column its marker
 * has not yet covered, which spreads a neutral bot's CP over several powers
 * instead of pouring every point into one.
 */
export const neutralBmpitTarget = (
  G: ImperialElegyState,
  power: Power,
): {power: Power; track: MpitTrack} => {
  const own = POWERS.indexOf(power);
  // Prefer the column the bot has influenced least; ties keep the printed
  // column order, so a fixed board always yields the same answer.
  let best: Power = POWERS[(own + 1) % POWERS.length];
  let bestTotal = Number.POSITIVE_INFINITY;
  for (let offset = 1; offset < POWERS.length; offset += 1) {
    const candidate = POWERS[(own + offset) % POWERS.length];
    const mpit = G.powers[candidate]?.mpit;
    if (!mpit) continue;
    const total = mpit.te + mpit.ta + mpit.neutral;
    if (total < bestTotal) {
      best = candidate;
      bestTotal = total;
    }
  }
  const mpit = G.powers[best].mpit;
  // The row is chosen the same way the allied branch chooses it: the track the
  // bot is furthest from.  A neutral bot still has no TA commitment to keep, so
  // it steers its split towards whichever field is lowest on that power.
  const track: MpitTrack = mpit.te > mpit.ta ? "ta" : mpit.te >= 3 ? "neutral" : "te";
  return {power: best, track};
};

/**
 * 34.3 BMPIT: an allied bot spends all of its excess CP on one power, chosen
 * by the printed two-die table.  The commitment is kept for the turn so later
 * impulses keep pouring CP into the same column; the PAC's neutral exception
 * still uses the documented split walk.
 */
const alliedBmpitTarget = (
  G: ImperialElegyState,
  power: Power,
  ctx: Ctx,
): {power: Power; track: MpitTrack} => {
  // A caller without a random plugin (the fixed-seed harness, a pure
  // inspection) keeps the documented deterministic walk, so the seeded
  // regression games do not change script merely because the UI path now
  // rolls the BMPIT dice.
  if (typeof (ctx?.random as {Die?: unknown} | undefined)?.Die !== "function") {
    const next = POWERS[(POWERS.indexOf(power) + 1) % POWERS.length];
    const track: MpitTrack = G.powers[next].mpit.te >= 3 ? "neutral" : "te";
    return {power: next, track};
  }
  const p = G.powers[power];
  const stored = p.flags.bmpitTarget;
  const storedTrack = p.flags.bmpitTrack;
  if (typeof stored === "string" && POWERS.includes(stored as Power)
    && (storedTrack === "ta" || storedTrack === "neutral" || storedTrack === "te")
    && Number(p.flags.bmpitTurn ?? -1) === G.turn) {
    return {power: stored as Power, track: storedTrack};
  }
  const rolled = bmpitTarget(roll2d6(ctx), roll2d6(ctx));
  p.flags.bmpitTarget = rolled.power;
  p.flags.bmpitTrack = rolled.track;
  p.flags.bmpitTurn = G.turn;
  return rolled;
};

// ---------------------------------------------------------------------------
// Space classification helpers for BDIT targeting
// ---------------------------------------------------------------------------

/** All map SpaceIds belonging to a BDIT region (influence/diplomacy targets). */
const spacesInBditRegion = (region: BditRegion): SpaceId[] => {
  const defs = Object.values(SPACES);
  switch (region) {
    case "germany":
      return defs.filter((s) => s.flashpoints?.includes("germany") || s.region === "europe" && s.home === "GE").map((s) => s.id);
    case "italy":
      return defs.filter((s) => s.flashpoints?.includes("italy") || s.home === null && s.region === "europe" && (s.id === "rome" || s.id === "naples" || s.id === "tuscany" || s.id === "lombardy" || s.id === "piedmont")).map((s) => s.id);
    case "lowCountries":
      return defs.filter((s) => s.id === "belgium" || s.id === "netherlands" || s.id === "luxembourg").map((s) => s.id);
    case "balkans":
      return defs.filter((s) => s.flashpoints?.includes("balkans") || s.flashpoints?.includes("ottomans")).map((s) => s.id);
    case "africa":
      return defs.filter((s) => s.region === "africa" || s.submap === "africa").map((s) => s.id);
    case "greatCaucasus":
      return defs.filter((s) => s.region === "asia" || s.id === "caucasus" || s.id === "anatolia" || s.id === "persia").map((s) => s.id);
    case "japanPacific":
      return defs.filter((s) => s.region === "pacific" || s.region === "asia" || s.submap === "asia").map((s) => s.id);
    default:
      return [];
  }
};

// ---------------------------------------------------------------------------
// Bot move type
// ---------------------------------------------------------------------------

/** A bot move as expected by boardgame.io's ai.enumerate. */
export type BotMove = {move: string; args?: unknown[]};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const powerFromPlayerID = (playerID: PlayerID): Power | undefined =>
  powerOfSeat(playerID);

/** Return friendly home spaces the bot can recruit in (has LoC, not over-stacked). */
const botHomeRecruit = (G: ImperialElegyState, power: Power): SpaceId | null => {
  for (const [id, def] of Object.entries(SPACES)) {
    if (def.home !== power) continue;
    if (!ownsKey(G, id, power)) continue;
    if (!hasLoc(G, power, id)) continue;
    const units = landUnitsIn(G, id);
    if (units.length < 3) return id;
  }
  return null;
};

/**
 * A home space that can actually take a new standing army right now.
 * `botHomeRecruit` only checks the map; manpower, nationalities and the UK's
 * Professional Army rule are enforced by `canRecruitIn`, and a recruit move
 * built on the looser check would be refused (and would stall the bot).
 */
const botRecruitSpace = (G: ImperialElegyState, power: Power): SpaceId | null => {
  for (const [id, def] of Object.entries(SPACES)) {
    if (def.home !== power) continue;
    // 33.6: an Arab key builds an Arab army from the separate Arab pool, so
    // the Turkish default would hide every legal Arab build from the bot.
    const ottoman = power === "OT" ? ottomanArmyTypeFor(id) : undefined;
    const decision = canRecruitIn(G, power, id, "army", {ottoman});
    if (!decision.allowed) continue;
    // 4.2: the printed counter pool is a real limit, and `recruit` enforces it
    // after `canRecruitIn` has said "legal".  A reduced army of the same kind is
    // upgraded in place and needs no new counter; anything else does.  Naming a
    // build the pool cannot supply made the bot repeat a refused move forever.
    const upgrade = landUnitsIn(G, id).some(
      (unit) => unit.owner === power && unit.kind === "army" && unit.steps < 2,
    );
    if (upgrade || hasCounterFor(G, power, "army")) return id;
  }
  return null;
};

/**
 * Cards the bot may spend for CP.  Every non-home card is a CP card (12.0);
 * a mandatory event played for CP resolves its event, so the bot prefers its
 * event path (`mandatoryInHand` below) but is never left without a move.
 * A105's printed hand-size clause is checked by `cpPlayability` when the move
 * is issued, and `cpPlayProblem` filters it here so the bot never names a card
 * the engine would refuse.
 */
const isCpSpendable = (cardId: CardId): boolean => cardById(cardId).kind !== "home";

/** The engine's own CP gate, so the bot never names a card the move refuses. */
const cpPlayProblem = (G: ImperialElegyState, power: Power, cardId: CardId): PlayBlockReason | undefined => {
  const decision = cpPlayability(G, power, cardId);
  return decision.ok ? undefined : decision.reason;
};

/** Mandatory cards still in hand: they block passing until the event is played. */
const mandatoryInHand = (G: ImperialElegyState, power: Power): CardId | null => {
  const found = G.powers[power].hand.find((id) => {
    const def = cardById(id);
    return def.type === "mandatory" || def.type === "mandatoryResponse";
  });
  return found ?? null;
};

/** True when card is worth playing for event (not 3-CP, not harmful per bot rules). */
const worthPlayingForEvent = (
  G: ImperialElegyState,
  power: Power,
  cardId: CardId,
): boolean => {
  const def = cardById(cardId);
  // 34.3.4: a card whose BOT BOX names this power is played for its event
  // automatically, whatever its CP value.  The box only omits a power when the
  // event would hurt it (the printed "Playable by"/exclusion clause that
  // `eventPlayability` enforces independently), so no extra harm test is due.
  if (def.botBox?.includes(power)) return true;
  // Bots never play a 3 CP event that doesn't help them.
  // Simplified heuristic: mandatory events must always play; optional events
  // with ≤2 CP are played; 3-CP optional events are skipped (bot uses CP).
  if (def.type === "mandatory" || def.type === "mandatoryResponse") return true;
  if (def.cp >= 3) return false;
  return true;
};

/**
 * B1 Priority 1 step 3 — "event that the bot will always play" from the BOT
 * BOX (9.2 / 34.3.4).
 *
 * The box is printed only on action cards, and it names the powers whose bot
 * plays that card for its event on reveal.  A card is only returned here when
 * the engine would accept the event play right now (`eventPlayability`, plus
 * the battle-window rule that keeps response/combat cards out of a normal
 * impulse — A41 is the one printed exception).  Returning an event the move
 * would refuse would leave the bot re-sending it every impulse.
 */
const botBoxEvent = (G: ImperialElegyState, power: Power): BotMove | null => {
  if (impulseAlreadyUsed(G, power)) return null; // 12.0: one card opens the impulse
  for (const cardId of G.powers[power].hand) {
    const def = cardById(cardId);
    if (def.botBox?.includes(power) !== true) continue;
    if (def.kind !== "action") continue;
    if ((def.type === "response" || def.type === "combat") && cardId !== "IE-A041") continue;
    if (!eventPlayability(G, power, cardId).ok) continue;
    return {move: "playCard", args: [cardId, "event"]};
  }
  return null;
};

/**
 * Find a minor power the bot can actually ally.  The probes are the engine's
 * own gates, so a target the move would refuse is never sent (the bot used to
 * look only for a free `ally` slot and re-sent the same refused move).
 */
const minorAllianceTarget = (G: ImperialElegyState, power: Power, region: BditRegion): SpaceId | null => {
  const candidates = spacesInBditRegion(region);
  for (const id of candidates) {
    const space = G.spaces[id];
    if (!space) continue;
    // 12.8: the bot needs its own diplomacy marker on the minor first, which
    // is what `minorAllianceProblem` checks (with the ally cap and 4.6.2).
    if (space.diplomacy !== power) continue;
    if (minorAllianceProblem(G, power, id) !== null) continue;
    return id;
  }
  return null;
};

/** Find a space in a BDIT region where 12.5.1 actually allows influence. */
const influenceTarget = (G: ImperialElegyState, power: Power, region: BditRegion): SpaceId | null => {
  const candidates = spacesInBditRegion(region);
  for (const id of candidates) {
    // The engine's gate: uncontrolled land, one marker, the African cap, a LoC.
    if (influencePlacementProblem(G, power, id) !== null) continue;
    return id;
  }
  return null;
};

/** Find rebel armies on the map that the bot can attack (adjacent or in space). */
/**
 * A land battle the engine would actually accept.  `beginLandBattle` is the
 * same gate `landBattle` uses, so a probe that returns non-null is a move the
 * impulse can spend.  The probe ctx never rolls: the dice are only read once
 * the battle is legal.
 */
const botBattleCtx = {random: {Die: () => 3, Number: () => 0, Shuffle: (a: unknown[]) => a}} as unknown as Ctx;

const legalLandBattle = (G: ImperialElegyState, power: Power, from: SpaceId, to: SpaceId): boolean => {
  // 32.5: during the Great War rebels and non-rebel units cannot coexist, so a
  // battle targeting a rebel space is refused by the GW flow *before*
  // `beginLandBattle` runs.  Probing only `beginLandBattle` therefore said
  // "legal" and the bot re-sent a refused move every impulse.  Ask the same
  // destination gate the flow uses, then the battle gate.
  if (maneuverDestinationProblem(G, power, {kind: "landBattle", to}) !== null) return false;
  // `beginLandBattle` writes the battle into the state it is given.  Probing
  // the live state leaves that battle open, so every later decision this
  // impulse reads a board the move will never see.
  return beginLandBattle(JSON.parse(JSON.stringify(G)) as ImperialElegyState, botBattleCtx, power, from, to) !== null;
};

const findRebelTarget = (G: ImperialElegyState, power: Power): {space: SpaceId; from: SpaceId} | null => {
  for (const [spaceId, spaceState] of Object.entries(G.spaces)) {
    if (!spaceState.rebellion) continue;
    // Neighbours include the space's ports and naval boxes, which are never a
    // land-battle origin, so each candidate has to pass the engine's gate.
    for (const nId of neighboursOf(spaceId)) {
      const nState = G.spaces[nId];
      if (!nState) continue;
      const our = landUnitsIn(G, nId).filter((u) => u.owner === power);
      if (our.length > 0 && legalLandBattle(G, power, nId, spaceId)) return {space: spaceId, from: nId};
    }
    // Or we're already in the rebel space (a trench battle, 28.1.2).
    const our = landUnitsIn(G, spaceId).filter((u) => u.owner === power);
    if (our.length > 0 && legalLandBattle(G, power, spaceId, spaceId)) return {space: spaceId, from: spaceId};
  }
  return null;
};

// ---------------------------------------------------------------------------
// Pending decision — bot auto-answer
// ---------------------------------------------------------------------------

/**
 * 34.3's die for a decision the Bot PAC does not list.
 *
 * `ctx` is optional so a caller without a boardgame.io context (a pure
 * inspection) still gets a stable index instead of an exception.
 */
export const botChoiceIndex = (ctx: Ctx | undefined, count: number): number => {
  if (count <= 1) return 0;
  const random = ctx?.random as {Die?: (sides: number) => number} | undefined;
  if (typeof random?.Die === "function") return (random.Die(count) - 1) % count;
  return 0;
};

/**
 * When a pending decision is open and it belongs to this bot, return the
 * move that answers it.  Where the Bot PAC prints an answer, this follows it;
 * everywhere else 34.3 says to roll a die.
 */
export const botPendingMove = (
  G: ImperialElegyState,
  power: Power,
  ctx?: Ctx,
): BotMove | null => {
  const pending = G.pending;
  if (!pending || pending.power !== power) return null;
  if (pending.options.length === 0) return null;

  // 12.13.1 Modernization.  The default "first option" answer always picked
  // `pass`, so a bot seat never offered a card and the Ottoman bot could never
  // use the home card it is printed to rely on.  Offering is free (the giver
  // draws a replacement), so the offer round gives the cheapest card, and the
  // Ottoman seat accepts the highest CP offer: a higher CP card is more likely
  // to reach the 6 the Ottomans need.
  if (pending.context?.special === "modernization") {
    const stage = String(pending.context.stage ?? "");
    if (stage === "offer") {
      const offers = pending.options
        .filter((o) => o.id.startsWith("offer:"))
        .sort((a, b) => cardById(String(a.data?.card)).cp - cardById(String(b.data?.card)).cp);
      const pick = offers[0] ?? pending.options.find((o) => o.id === "pass") ?? pending.options[0];
      return {move: "resolvePending", args: [pick.id]};
    }
    if (stage === "accept") {
      const accepts = pending.options
        .filter((o) => o.id.startsWith("accept:"))
        .sort((a, b) => cardById(String(b.data?.card)).cp - cardById(String(a.data?.card)).cp);
      const pick = accepts[0] ?? pending.options[0];
      return {move: "resolvePending", args: [pick.id]};
    }
  }

  // For specific decision kinds, the bot has printed rules.
  switch (pending.kind) {
    case "navalAvoid":
      // Bot always fights (never avoids).
      return {move: "declinePending"};

    case "combatSupport":
      // The PAC leaves the support choice open; 34.3 rolls.
      return {move: "resolvePending", args: [pending.options[botChoiceIndex(ctx, pending.options.length)].id]};

    case "navalInterception":
      // The PAC leaves interception open; 34.3 rolls.
      return {move: "resolvePending", args: [pending.options[botChoiceIndex(ctx, pending.options.length)].id]};

    case "impulseLoss":
    case "combatLosses":
    case "combatRetreat":
    case "combatAdvance":
    case "mineRetreat":
    case "decisiveBattle":
    case "navalContinuation":
    case "navalPortContinuation":
    case "navalPortBox":
    case "combatCard":
    case "combatDiscard":
    case "combatElite":
    case "hydraulicRecoil":
      // Combat choices the PAC leaves open: roll per 34.3.
      return {move: "resolvePending", args: [pending.options[botChoiceIndex(ctx, pending.options.length)].id]};

    case "warAllyConsent":
      // Bots always call allies (B2: "Bots will always call allies").
      return {move: "resolvePending", args: [pending.options[0].id]};

    case "balanceOfPower":
      // Balance of Power has no PAC row; 34.3 rolls (the bot still gets the
      // card draw when it accepts).
      return {move: "resolvePending", args: [pending.options[botChoiceIndex(ctx, pending.options.length)].id]};

    case "treatyOption":
    case "treatySpace":
    case "whitePeaceOrder":
      return {move: "resolvePending", args: [pending.options[botChoiceIndex(ctx, pending.options.length)].id]};

    case "goalChoice":
    case "industryCard":
    case "mpitAllocation":
    case "italyTable":
    case "gwDraft":
    case "gwCard":
    case "gwWinter":
    case "scoringChoice":
      return {move: "resolvePending", args: [pending.options[botChoiceIndex(ctx, pending.options.length)].id]};

    case "militarism":
      // End phase 20.1: bot always builds army step (B1: "bots will always
      // build an army step instead of maintaining a fort").
      {
        const armyOpt = pending.options.find((o) => o.id.startsWith("army") || o.id === "army");
        const opt = armyOpt ?? pending.options[0];
        return {move: "resolvePending", args: [opt.id]};
      }

    case "manpowerExcess":
      // 20.5: which over-limit army to discard is not on the PAC; roll.
      return {move: "resolvePending", args: [pending.options[botChoiceIndex(ctx, pending.options.length)].id]};

    case "allianceTie":
    case "gwNonPlayerJoin":
    case "gwNeutralEntry":
    case "gwNeutralAction":
    case "gwNeutralUnit":
    case "gwNeutralDestination":
    case "gwNeutralDeploy":
    case "gwColonialLoss":
    case "gwColonialTransfer":
    case "gwColonialBonusCp":
    case "auUnstable":
    case "bloodAndIron":
    case "germanConfederation":
    case "napoleonsLegacy":
    case "metternich":
    case "dardanellesPassage":
    case "minorAbandon":
    case "minorAid":
    case "demobilizationFreeAction":
    case "eventTargetSpace":
    case "eventTargetPower":
    case "eventChoice":
    case "eventUnits":
    case "confirm":
    case "responseCard":
    case "discardForStability":
    case "chooseHomeCard":
    case "giveCard":
    case "movementDestination":
    case "crisisIncident":
    case "crisisAlliance":
    case "crisis":
    case "italianInternalWar":
      return {move: "resolvePending", args: [pending.options[botChoiceIndex(ctx, pending.options.length)].id]};

    case "francoPrussianConcession":
    case "scenarioGoalChoice":
      // 34.3: "if a bot ever has to make a decision that isn't explicitly laid
      // out on the bot PAC, roll a die to determine the result."  Both are
      // scenario setup decisions with no PAC row; taking option 0 always made
      // the FR bot concede the Franco-Prussian War in every solo 1870 game.
      return {
        move: "resolvePending",
        args: [pending.options[botChoiceIndex(ctx, pending.options.length)].id],
      };

    default:
      // 34.3: "if a bot ever has to make a decision that isn't explicitly laid
      // out on the bot PAC, roll a die to determine the result."  This is the
      // generic path, so it must not default to option 0.
      return {
        move: "resolvePending",
        args: [pending.options[botChoiceIndex(ctx, pending.options.length)].id],
      };
  }
};

/**
 * The home-card war declaration this seat still owes, as a `declareWar` move.
 *
 * Four home cards print "declare war using this card's CP value".  Their event
 * leaves a declaration entitlement instead of banking CP, and the entitlement
 * belongs to that impulse: `finishImpulse` clears it, so a seat that hands the
 * impulse over without declaring loses the printed effect entirely.  Rule 34
 * gives no table row for the declaration, but B1's "play the home card" cannot
 * be honoured without it — refusing to declare makes Bismarck, Aux Armes,
 * Russo-Turkish Wars and Jihad resolve to nothing in every bot-driven seat,
 * which is how they read as unimplemented in solo play.
 *
 * The first legal candidate from the shared enumeration is used, so the bot
 * can only send a declaration `declareWar` accepts (13.0 aim validation, 13.4
 * resolution, 13.5 truces, the card's own target/aim limits).  A restricted
 * card (RU-9: the Ottomans; Jihad: RU or an Ottoman-home controller) therefore
 * always finds exactly the printed defender.
 */
const homeDeclarationMove = (G: ImperialElegyState, power: Power): BotMove | null => {
  if (G.phase !== "action") return null;
  const entitlement = warDeclarationEntitlement(G, power);
  if (entitlement === null || G.war !== null) return null;
  const candidates = declarationTargetCandidates(G, power, entitlement);
  if (candidates.length === 0) return null;
  // Prefer the most rewarding aim the card allows: a liberation or conquest
  // declaration is what its printed text is written around, and `ALL_WAR_AIMS`
  // order otherwise puts conquest first even for RU-9's Balkan liberation.
  const preferred = candidates.find((candidate) => candidate.aim === "liberation")
    ?? candidates.find((candidate) => candidate.aim === "conquest")
    ?? candidates[0];
  return {
    move: "declareWar",
    args: [preferred.target, preferred.aim, [preferred.objective], entitlement.cp],
  };
};

// ---------------------------------------------------------------------------
// Action Phase — Priority 1
// ---------------------------------------------------------------------------

/**
 * Return a Priority 1 move if one is available, else null.
 *
 * Priority 1 (B1):
 * 1. Play home card for event†
 * 2. Attack rebels / build/move units to attack rebels
 * 3. Always-play event (checked via power-specific event box on chart)
 * 4. Industrialize (auto-industry marker only)
 * 5. GE: build armies if able
 * 6. UK: build dreadnoughts if able
 * 7. All: build armies if WTT ≥ 3
 */
const priorityOne = (G: ImperialElegyState, power: Power): BotMove | null => {
  const p = G.powers[power];

  // 1. Play home card for its event (if stability > 0 or card gives < 3 CP)
  //    †Home Card Revealed: do not play for event if stability is 6 and
  //      the event gives < 3 CP value.
  //    The card is only playable while it is still in hand: `playCard` removes
  //    it, and a later impulse must not try to play the same home card again.
  //    A card opens the impulse; its CP are spent afterwards (12.0).
  //    A040 British Trade puts the *unselected* home card into hand, and a home
  //    card in hand forbids passing (12.0), so that card has to be playable too
  //    or the seat has no legal move at all.
  const playableHome = p.hand.find((id) => cardById(id).kind === "home") ?? null;
  const homeCard = p.selectedHomeCard !== null && p.hand.includes(p.selectedHomeCard)
    ? p.selectedHomeCard
    : playableHome;
  if (homeCard !== null && !impulseAlreadyUsed(G, power)) {
    const def = cardById(homeCard);
    const skipEvent = p.stability >= 6 && def.cp < 3;
    // The revealed card may be one the engine refuses right now (AU-8
    // Kaiserreich needs The Dual Monarchy; a war-declaration home card needs a
    // legal target).  Naming it anyway stalled the self-play run on a refused
    // move, so the printed event gate and the CP gate decide the mode.  When
    // neither is legal the card stays in hand and the lower priorities run.
    if (!skipEvent && eventPlayability(G, power, homeCard).ok) {
      return {move: "playCard", args: [homeCard, "event"]};
    }
    if (cpPlayProblem(G, power, homeCard) === undefined) {
      // Play for CP instead.
      return {move: "playCard", args: [homeCard, "cp"]};
    }
  }

  // 2. Attack rebels.
  const rebel = findRebelTarget(G, power);
  if (rebel !== null && G.cpRemaining >= 1) {
    const attackers = landUnitsIn(G, rebel.from).filter((u) => u.owner === power).map((u) => u.id);
    if (attackers.length > 0) {
      // Rule 18.0: every friendly land unit in the origin space fights; the
      // move takes only the origin and the target.
      return {move: "landBattle", args: [rebel.from, rebel.space]};
    }
  }

  // 2b. A home-card war declaration is an obligation of this impulse: the card
  // already resolved (Bismarck, Aux Armes, Russo-Turkish Wars, Jihad) and the
  // printed declaration is funded by its CP.  `pass` clears the entitlement in
  // `finishImpulse`, so a bot that never declares silently loses the whole
  // printed effect — that is what made RU-9 look unimplemented in solo play.
  const declaration = homeDeclarationMove(G, power);
  if (declaration !== null) return declaration;

  // 3. Always-play event from the printed BOT BOX (B1 / 34.3.4).
  const boxEvent = botBoxEvent(G, power);
  if (boxEvent !== null) return boxEvent;

  // 4. Industrialize (only if auto-industry marker active).
  // 12.13: a card is played into the industrialization slot; the auto chit then
  // pays off at the end phase.  `industrialize` requires the card in hand, so
  // naming it while it already sits in the slot is a refused move the bot would
  // repeat forever — the card is simply already spent.
  if (p.autoIndustry && p.industryCard !== null && G.cpRemaining >= 1 && p.hand.includes(p.industryCard)) {
    return {move: "industrialize", args: [p.industryCard]};
  }

  // 5. GE special: build armies if able.
  if (power === "GE" && G.cpRemaining >= 1) {
    const space = botRecruitSpace(G, "GE");
    if (space !== null) {
      return {move: "recruit", args: [space, "army", 1, {}]};
    }
  }

  // 6. UK special: build dreadnoughts if able.
  if (power === "UK" && G.cpRemaining >= 3) {
    const unlocked = G.persistent.dreadnoughts === true || Boolean(p.flags.navalLimit);
    if (unlocked) {
      for (const [id, def] of Object.entries(SPACES)) {
        if (def.home !== "UK") continue;
        if (!ownsKey(G, id, "UK")) continue;
        if (def.ports && def.ports.length > 0 && navalUnitsIn(G, id).length < 4) {
          return {move: "constructFleet", args: [id, "dreadnought"]};
        }
      }
    }
  }

  // 7. All bots: build armies if WTT ≥ 3.
  if (G.wtt >= 3 && G.cpRemaining >= 1) {
    const space = botRecruitSpace(G, power);
    if (space !== null) {
      return {move: "recruit", args: [space, "army", 1, {}]};
    }
  }

  return null;
};

// ---------------------------------------------------------------------------
// Action Phase — Priority 2 (die roll 1–6)
// ---------------------------------------------------------------------------

/**
 * Priority 2 (B1) — called with the bot's die roll result (1–6):
 *
 * 1 — Place influence in Asia or Africa (BDIT), build/move EF, then pacify.
 * 2 — Gain minor alliance if able (BDIT), then place/remove diplomacy (BDIT).
 * 3-4 — Build armies (standing before reserves), then fort, then EC.
 * 5-6 — Play card for event (unless it hurts self/allies or is 3-CP unhelpful).
 *
 * Returns a move or null if the priority action cannot be taken.
 */
const priorityTwo = (
  G: ImperialElegyState,
  power: Power,
  roll: number,
  bdtDie: number,
): BotMove | null => {
  const p = G.powers[power];
  const region = BDIT[power][bdtDie] ?? "africa";

  if (roll === 1) {
    // Step 1: place influence in Asia/Africa based on BDIT.
    const target = influenceTarget(G, power, region);
    if (target !== null && G.cpRemaining >= 1) {
      return {move: "placeInfluence", args: [target]};
    }
    // Step 2: build or move EF to a space, then attempt to pacify.
    if (G.cpRemaining >= 2) {
      for (const [id, def] of Object.entries(SPACES)) {
        if (def.region !== "africa" && def.region !== "asia") continue;
        if (!friendlySpace(G, id, power)) continue;
        return {move: "buildEf", args: [id]};
      }
    }
  }

  if (roll === 2) {
    // Minor alliance (3 CP) — the move itself charges 3.
    if (G.cpRemaining >= 3) {
      const minor = minorAllianceTarget(G, power, region);
      if (minor !== null) {
        return {move: "minorAlliance", args: [minor]};
      }
    }
    // Diplomacy placement on main map (1 CP).
    if (G.cpRemaining >= 1) {
      const dipTarget = influenceTarget(G, power, region);
      if (dipTarget !== null) {
        return {move: "placeDiplomacy", args: [dipTarget]};
      }
    }
  }

  if (roll >= 3 && roll <= 4) {
    // Build standing armies (1-2 CP).
    if (G.cpRemaining >= 1) {
      const space = botRecruitSpace(G, power);
      if (space !== null) {
        return {move: "recruit", args: [space, "army", 1, {}]};
      }
    }
    // Then reserve armies.
    if (G.cpRemaining >= 1) {
      // Probe the move itself on a copy.  Re-deriving its gates here drifted
      // (the box, the counter pool and the per-power allowance each refused
      // the move on their own) and a refused recruit is re-sent forever.
      const probe = JSON.parse(JSON.stringify(G)) as ImperialElegyState;
      const accepted = recruitMove(probe, botBattleCtx, null as unknown as SpaceId, "reserveArmy", 1, {}) !== "INVALID_MOVE";
      if (accepted) return {move: "recruit", args: [null, "reserveArmy", 1, {}]};
    }
    // Then fort (3-4 sub-result: die shows 3 on the chart → build fort).
    if (roll === 3 && G.cpRemaining >= 1) {
      const space = botFortSpace(G, power);
      if (space !== null) {
        return {move: "buildFort", args: [space]};
      }
    }
    // Then EC.
    if (roll === 4 && G.cpRemaining >= 2 && hasCounterFor(G, power, "eliteCorps")) {
      for (const [id] of Object.entries(SPACES)) {
        const armies = landUnitsIn(G, id).filter((u) => u.owner === power);
        if (armies.length > 0) {
          return {move: "recruit", args: [id, "eliteCorps", 2, {}]};
        }
      }
    }
  }

  // 5-6 — play a card for its event.  `playCard` accepts an event only as the
  // impulse's single card play (12.0), so this tier is skipped once the impulse
  // is used; `botDecision` then spends the CP and reaches this tier on a later
  // impulse.  Combat cards have no event outside a battle, and
  // `eventPlayability` is the engine's own gate, so a card it refuses is never
  // named here.
  if (roll >= 5 && roll <= 6 && !impulseAlreadyUsed(G, power)) {
    for (const cardId of p.hand) {
      if (!isCpSpendable(cardId)) continue;
      if (!worthPlayingForEvent(G, power, cardId)) continue;
      if (!eventPlayability(G, power, cardId).ok) continue;
      return {move: "playCard", args: [cardId, "event"]};
    }
  }

  return null;
};

// ---------------------------------------------------------------------------
// Excess CP spending
// ---------------------------------------------------------------------------

/**
 * When the bot still has CP after all priority actions (B1):
 * First build armies, then spend on BMPIT influence.
 */
const excessCp = (G: ImperialElegyState, power: Power, ctx: Ctx): BotMove | null => {
  if (G.cpRemaining <= 0) return null;

  // Build armies first.
  const space = botRecruitSpace(G, power);
  if (space !== null) {
    return {move: "recruit", args: [space, "army", 1, {}]};
  }

  // Then BMPIT influence.  `placeInfluence` places a *map* influence marker
  // and takes a SpaceId; the alliance track is moved with `placeMpit`.
  //
  // 34.3: "Bots will always spend all their CP to influence a single power.
  // Exception: Neutral bots may split their CP, see below BMPIT on bot PAC."
  // A player in the neutral box splits its CP across powers; every allied bot
  // keeps spending on one power only.  The power/track pair comes from the
  // deterministic BMPIT walk below, so the choice stays reproducible.
  const target = G.powers[power]?.alliance === "neutral"
    ? neutralBmpitTarget(G, power)
    : alliedBmpitTarget(G, power, ctx);
  return {move: "placeMpit", args: [target.power, target.track]};
};

/**
 * A space the bot may build a fort in: a European home key it still controls,
 * with no fort and no fort built there this decade, under the three-fort cap.
 */
const botFortSpace = (G: ImperialElegyState, power: Power): SpaceId | null => {
  const forts = Object.values(G.spaces).filter((s) => s.fort?.power === power).length;
  if (forts >= 3) return null;
  for (const [id, def] of Object.entries(SPACES)) {
    if (def.home !== power) continue;
    if (def.region !== "europe") continue;
    if (!ownsKey(G, id, power)) continue;
    if (G.spaces[id]?.fort) continue;
    if (G.powers[power].flags[`fort_${id}`]) continue;
    return id;
  }
  return null;
};

/**
 * A space a wartime deploy-reserves action may legally use: it must be a main
 * map land space that the power controls (or occupies) with a valid LoC and
 * room for another army (15.2.3 / 5.5.3).
 */
const botDeploySpace = (G: ImperialElegyState, power: Power): SpaceId | null => {
  for (const [id, def] of Object.entries(SPACES)) {
    if (def.submap !== "main") continue;
    const state = G.spaces[id];
    if (!state) continue;
    if (state.control !== power && state.occupiedBy !== power) continue;
    if (!hasLoc(G, power, id, {landOnly: true})) continue;
    if (landUnitsIn(G, id).filter((u) => isArmyKind(u.kind)).length >= 3) continue;
    return id;
  }
  return null;
};

/**
 * A home key the bot may draft a reduced army into (27.5.2).  The engine owns
 * the eligibility rules; this only picks the first legal space.
 */
const botDraftSpace = (G: ImperialElegyState, power: Power): SpaceId | null =>
  gwDraftSpaces(G, power)[0] ?? null;

// ---------------------------------------------------------------------------
// Wartime action priorities (B2)
// ---------------------------------------------------------------------------

/**
 * Wartime Priority 1 (B2):
 * - Attack/enter enemy capital
 * - Protect threatened capital
 * - Deploy reserves if undeployed > 1
 * - Pass if: budget ≤ 2 and an opponent has more CP and no viable attacks
 */
const wartimePriorityOne = (G: ImperialElegyState, power: Power): BotMove | null => {
  const war = G.war;
  if (!war) return null;
  const budget = cpBudgetFor(G, power);

  // 13.2/14.3: a freshly declared war sits in `warAim`, then the alliance step
  // (`alliance`).  The maneuver actions below are only legal once the war
  // reaches `maneuver`, and the board exposes "start maneuver" to the attacker
  // for exactly this transition.  Without it the bot named `deployReserves` in
  // `warAim`, the engine refused it, and the seat had no other move to make.
  // The defender cannot advance the war past those steps, so it waits.
  if (war.status === "warAim" || war.status === "alliance") {
    return power === war.attacker ? {move: "startWarManeuver"} : null;
  }
  // A war recorded as won (15.5 surrender, or the 16.2 chooser still running)
  // is finished by the settlement move; passing is not an option there.
  if (war.status === "victory") return {move: "resolveWar"};
  // 4.4: only the impulse holder acts; every other belligerent waits for its
  // turn instead of sending a move the engine now refuses.
  if (!holdsWarImpulse(G, power)) return null;
  // Attack enemy capital if adjacent.
  const enemyPowers = [...war.attackerAllies, war.attacker, ...war.defenderAllies, war.defender]
    .filter((p) => p !== power);
  for (const enemy of enemyPowers) {
    // War allies can name a minor power; only the six great powers have a
    // `G.powers` entry (and a capital to attack).
    const def = G.powers[enemy];
    if (!def || def.eliminated) continue;
    // Find enemy capital.
    for (const [id, spaceDef] of Object.entries(SPACES)) {
      if (spaceDef.home !== enemy && spaceDef.type !== "capital") continue;
      // Look for adjacent space with our armies.
      for (const nId of neighboursOf(id)) {
        const ourUnits = landUnitsIn(G, nId).filter((u) => u.owner === power);
        // The capital's neighbours include its ports, and the capital is only
        // an enemy while its owner is at war with us.  Both are settled by the
        // same gate the move uses.
        if (ourUnits.length > 0 && budget >= 1 && legalLandBattle(G, power, nId, id)) {
          // `landBattle` takes only (from, to): the whole force in `nId` fights.
          return {move: "landBattle", args: [nId, id]};
        }
      }
    }
  }

  // Deploy reserves if > 1 undeployed.
  if (G.powers[power].reserves.length > 1 && budget >= 1) {
    const space = botDeploySpace(G, power);
    if (space !== null) {
      return {move: "deployReserves", args: [space]};
    }
  }

  // Pass if conditions are met.
  if (budget <= 2) {
    const opponentMaxBudget = Math.max(
      ...enemyPowers.map((p) => cpBudgetFor(G, p)),
    );
    if (opponentMaxBudget > budget) {
      return {move: "passWarMove"};
    }
  }

  return null;
};

// ---------------------------------------------------------------------------
// GW Planning and Maneuver
// ---------------------------------------------------------------------------

/** Probe a GW request through the engine, like `gwRequiredAction` does. */
const gwRequestAccepted = (G: ImperialElegyState, ctx: Ctx, request: GwManeuverRequest): boolean => {
  // Test fixtures and legacy saves can carry a partial `gw`, and the fixed-seed
  // harness calls `botDecision` outside a move (no `ctx.random`).  Without a
  // live probe context there is nothing reliable to test, so keep the historic
  // answer rather than turning a draft into a refused pass.
  if (typeof (ctx?.random as {Die?: unknown} | undefined)?.Die !== "function") return true;
  if (!Array.isArray(G.gw?.order) || G.gw?.impulse === undefined) return true;
  const probe = JSON.parse(JSON.stringify(G)) as ImperialElegyState;
  return performGwManeuver(probe, {...ctx, random: {Die: () => 3}, events: undefined} as Ctx, request).ok;
};

/** GW Priority 2 (B2) — roll 1–6. */
const gwPriorityTwo = (G: ImperialElegyState, power: Power, roll: number, ctx: Ctx): BotMove | null => {
  const budget = cpBudgetFor(G, power);
  if (budget <= 0) return null;

  if (roll >= 1 && roll <= 3) {
    // Attack or move to defend stability spaces.
    // A march destination must be a *friendly* space (26.x); marching into a
    // space that holds an enemy army is illegal and `performGwManeuver` refuses
    // it, which used to leave the bot re-sending a rejected move forever.  The
    // printed way to attack an adjacent enemy is `landBattle`.  Enemies are
    // exactly the units `hostileOwner` names: another player on the opposing
    // side, or a minor — never an ally (an allied army in the space is not a
    // legal defender, so `beginLandBattle` refuses the attack).  The battle is
    // probed through the engine's own gate (trenches need a full-strength army
    // in the attack force, a trench-marker space is attacked from inside it, …)
    // so the bot never names a fight the move will refuse.
    //
    // 34.3: the PAC does not print which equally-close target to take, so roll
    // a die among every legal land battle rather than always walking the map in
    // iteration order (that made every bot attack the same first space).
    const battleCandidates: {from: SpaceId; to: SpaceId}[] = [];
    for (const [id] of Object.entries(G.spaces)) {
      // A naval box holds ships: it is never a land-battle origin, and naming
      // one makes `performGwManeuver` refuse with "Land battles need land
      // spaces" every impulse.
      if (isNavalBox(id)) continue;
      const ours = landUnitsIn(G, id).filter((u) => u.owner === power && !u.elite);
      if (ours.length === 0) continue;
      for (const to of neighboursOf(id)) {
        if (isNavalBox(to)) continue;
        const enemies = landUnitsIn(G, to).filter((u) => hostileOwner(G, power, u.owner));
        if (enemies.length === 0) continue;
        if (!gwActionAllowance(G, power, "landBattle").ok || !legalLandBattle(G, power, id, to)) continue;
        if (!gwRequestAccepted(G, ctx, {kind: "landBattle", power, from: id, to})) continue;
        battleCandidates.push({from: id, to});
      }
    }
    if (battleCandidates.length > 0) {
      // `landBattle` takes (from, to): the whole force in `from` attacks.
      const pick = battleCandidates[botChoiceIndex(ctx, battleCandidates.length)];
      return {move: "landBattle", args: [pick.from, pick.to]};
    }
  }

  if (roll >= 4 && roll <= 5) {
    // Refit (convert to 6 if all armies full strength).
    const reduced = Object.values(G.units).filter((u) => u.owner === power && !u.naval && isArmyKind(u.kind) && u.steps === 1 && u.space && hasLoc(G, power, u.space));
    if (reduced.length > 0 && gwActionAllowance(G, power, "refit").ok
      && gwRequestAccepted(G, ctx, {kind: "refit", power, unitId: reduced[0].id})) {
      return {move: "gwRefit", args: [reduced[0].id]};
    }
  }

  if (roll === 6) {
    // Draft into a legal home key; the engine decides the second placement.
    if (G.powers[power].manpower > 0) {
      const space = botDraftSpace(G, power);
      if (space !== null && hasCounterFor(G, power, "army") && gwActionAllowance(G, power, "draft").ok
        && gwRequestAccepted(G, ctx, {kind: "draft", power, space})) {
        return {move: "gwDraft", args: [space]};
      }
    }
  }

  return null;
};

/** Find a legal required action when a priority row cannot spend this impulse. */
const gwRequiredAction = (G: ImperialElegyState, ctx: Ctx, power: Power): BotMove | null => {
  const owner = gwAllyImpulseFor(G, power) ?? power;
  const candidates: {request: GwManeuverRequest; move: BotMove}[] = [];
  for (const unit of Object.values(G.units)) {
    if (unit.owner !== owner || !unit.space) continue;
    if (unit.steps < 2 && (unit.naval || isArmyKind(unit.kind))) {
      const kind = unit.naval ? "refitFleet" : "refit";
      candidates.push({request: {kind, power, unitId: unit.id}, move: {move: unit.naval ? "gwRefitFleet" : "gwRefit", args: [unit.id]}});
    }
    if (!unit.naval && isArmyKind(unit.kind)) {
      candidates.push({request: {kind: "eliteCorps", power, unitId: unit.id}, move: {move: "gwEliteCorps", args: [unit.id]}});
    }
    for (const to of neighboursOf(unit.space)) {
      if (unit.naval) {
        candidates.push({request: {kind: "naval", power, unitIds: [unit.id], to}, move: {move: "navalMove", args: [[unit.id], to]}});
      } else {
        candidates.push({request: {kind: "march", power, unitId: unit.id, to}, move: {move: "gwMarch", args: [unit.id, to]}});
        candidates.push({request: {kind: "rail", power, unitId: unit.id, to}, move: {move: "gwRail", args: [unit.id, to]}});
      }
    }
  }
  for (const space of gwDraftSpaces(G, power)) {
    candidates.push({request: {kind: "draft", power, space}, move: {move: "gwDraft", args: [space]}});
    if (G.powers[power].reserves.length) candidates.push({request: {kind: "deploy", power, space}, move: {move: "gwDeploy", args: [space]}});
  }
  for (const {request, move} of candidates) {
    if (!gwActionAllowance(G, power, request.kind).ok) continue;
    const probe = JSON.parse(JSON.stringify(G)) as ImperialElegyState;
    if (performGwManeuver(probe, {...ctx, random: {...ctx.random, Die: () => 3}, events: undefined} as Ctx, request).ok) return move;
  }
  return null;
};

// ---------------------------------------------------------------------------
// Main bot decision function
// ---------------------------------------------------------------------------

/**
 * Returns the single move a bot should make for the given power in the
 * current game state.  Used as the boardgame.io `ai.enumerate` return value.
 *
 * The bot must be called on its turn only; callers should check seat/phase.
 */
/**
 * One B1 die.  `ctx.random` is only present inside a real move (boardgame.io
 * attaches the random plugin to the move's ctx) and in the harness; a direct
 * caller that passes a bare ctx gets the documented conservative 3.
 */
const roll2d6 = (ctx: Ctx | undefined): number => {
  const random = ctx?.random;
  if (random === undefined) return 3;
  let value: number;
  try {
    value = random.Die(6);
  } catch {
    return 3;
  }
  return typeof value === "number" && value >= 1 && value <= 6 ? value : 3;
};

export const botDecision = (
  G: ImperialElegyState,
  ctx: Ctx,
  power: Power,
): BotMove => {
  return actionPhaseExitForPhase(G, botDecisionInPhase(G, ctx, power));
};

/**
 * One exit per phase, and the bot never names another phase's.
 *
 * `pass` is 12.0's action-phase exit; the Great War has `gwPass` and a limited
 * war `passWarMove`.  A decision assembled from a view that was captured just
 * before a phase change can still carry the action-phase exit — the batch sweep
 * caught the bot re-sending `pass` in the Great War until the driver's repeat
 * guard tripped.  Rewriting it to the phase's own exit is what the board gives
 * a human in the same state.
 */
export const actionPhaseExitForPhase = (G: ImperialElegyState, decision: BotMove): BotMove => {
  if (decision.move !== "pass") return decision;
  if (G.phase === "gwManeuver") return {move: "gwPass"};
  if (G.phase === "wartime") return {move: "passWarMove"};
  return decision;
};

/** The phase's own exit, for callers that need to name it directly. */
export const phaseExitMove = (G: ImperialElegyState): BotMove => actionPhaseExitForPhase(G, {move: "pass"});

const botDecisionInPhase = (G: ImperialElegyState, ctx: Ctx, power: Power): BotMove => {
  // Handle any open pending decision first.
  const pendingMove = botPendingMove(G, power, ctx);
  if (pendingMove !== null) return pendingMove;

  const phase = G.phase;
  const p = G.powers[power];

  // ------------------------------------------------------------------ prep
  if (phase === "prep") {
    // Take stability discard if stability ≤ 2 (B1: "bots will take the
    // optional stability increase if their stability is ≤ 2").
    //
    // `prepStability` is the move's own once-per-phase guard.  Ignoring it made
    // the bot discard, stay at stability ≤ 2 (the discard is +1, but a card can
    // push it back), and then re-issue the same refused discard forever.
    if (p.stability <= 2 && p.flags.prepStability !== true) {
      // The card itself is drawn at random by the move, so the bot only has to
      // know whether any legal card is in hand.
      const discardable = p.hand.some((id) => {
        const def = cardById(id);
        return def.type !== "mandatory" && def.type !== "mandatoryResponse" && def.kind !== "home";
      });
      if (discardable) {
        return {move: "discardForStability", args: []};
      }
    }
    return {move: "finishPrep"};
  }

  // ------------------------------------------------------------ diplomacy
  if (phase === "diplomacy") {
    // 11.1: a deal only stands if both sides agree.  The bot refuses anything
    // addressed to it rather than negotiating back and forth with a human (or
    // another bot) forever — an unanswered offer lapses when the phase closes,
    // so refusing keeps the table free for the next seat.
    const openOffer = dealsOf(G).offers.find((offer) =>
      offer.status === "proposed" && offer.to === power);
    if (openOffer !== undefined) {
      return {move: "respondDeal", args: [openOffer.id, false]};
    }
    // 9.1: every seat closes its negotiation segment before the home-card
    // step.  A bot has nothing else to say, so it declares done first; the
    // engine then refuses its home card until every human seat has done the
    // same (the driver parks a waiting bot instead of spinning on a refusal).
    if (!negotiationDoneFor(G, power)) {
      return {move: "finishNegotiation"};
    }
    // 34.2: "Do not choose a home card for bots, instead each bot adds a random
    // home card to their pile."  `pileHomeCard` adds it hidden; the card is
    // revealed at the bot's action impulse (`revealHomeCard`).  The move is
    // diplomacy-only and refuses a seat that already chose, so this branch must
    // never run later.
    if (!p.flags.homeChosen) {
      return {move: "pileHomeCard"};
    }
    return {move: "endDiplomacy"};
  }

  // ------------------------------------------------------------- action
  if (phase === "action") {
    if (G.activePower !== power) {
      // Not our turn.  In the action phase `pass` is the only exit (12.0) and it
      // refuses a non-active seat, exactly as the old `endImpulse` did, so this
      // stays a no-op the driver's repeat guard catches rather than a spin.
      return {move: "pass"};
    }

    // 34.2 Action Phase: "On a bot's impulse reveal the top card of their pile".
    // The reveal is public and precedes the priority rows, so every client sees
    // the home card before the bot plays it (or passes it over for a CP card).
    if (p.flags.homeCardRevealedTurn !== G.turn) {
      if (p.selectedHomeCard !== null && p.hand.includes(p.selectedHomeCard)) {
        return {move: "revealHomeCard"};
      }
    }

    // A mandatory card in hand forbids passing (12.0), so play it first.  Its
    // event is the printed path; a mandatory event played for CP resolves the
    // same event, so the event mode is the plain choice whenever the impulse is
    // still empty.  With CP banked the bot spends that CP first (a card play
    // while CP remain is refused), and reaches this branch again next impulse.
    const mandatory = mandatoryInHand(G, power);
    if (mandatory !== null && !impulseAlreadyUsed(G, power)) {
      return {move: "playCard", args: [mandatory, "event"]};
    }

    // A047 The Dual Monarchy and GW-10 Exhaustion also forbid passing.  Left
    // until later the bot fills the impulse with its home card and then has no
    // legal move, so the card is spent for CP as the impulse's own card play.
    const blocking = !impulseAlreadyUsed(G, power)
      ? passRestriction(G, power).cards.find((card) => isCpSpendable(card.card))
      : undefined;
    if (blocking !== undefined) {
      return {move: "playCard", args: [blocking.card, "cp"]};
    }

    // Priority 1.
    const p1 = priorityOne(G, power);
    if (p1 !== null) return p1;

    // Start a fresh impulse by playing a card for CP.
    if (!impulseAlreadyUsed(G, power)) {
      const cpCard = p.hand.find((card) => isCpSpendable(card) && cpPlayProblem(G, power, card) === undefined);
      if (cpCard !== undefined) {
        return {move: "playCard", args: [cpCard, "cp"]};
      }
    }

    // Priority 2 (B1) is driven by a 2d6 roll: 1 = influence/EF, 2 = minor
    // alliance/diplomacy, 3-4 = build armies, 5-6 = play an event.  Passing a
    // constant here collapsed the whole table onto its 3-4 branch, so the
    // non-army priorities were unreachable and the bot played the same way in
    // every game.  Roll for real when the ctx carries the random plugin; the
    // constant stays as the documented fallback for direct/test callers.
    if (G.cpRemaining > 0) {
      const p2 = priorityTwo(G, power, roll2d6(ctx), roll2d6(ctx));
      if (p2 !== null) return p2;

      // Excess CP: build armies, then BMPIT.
      const excess = excessCp(G, power, ctx);
      if (excess !== null) return excess;
    }

    // One move ends the impulse (12.0): a seat that has acted is handing over a
    // used impulse and may always do so; a seat that has not is passing, which
    // the hand restriction can refuse.  The blocked case is reached only after
    // the forced-card branches above, so naming `pass` here is the same answer
    // the board gives the human player.
    return {move: "pass"};
  }

  // ------------------------------------------------------------- wartime
  if (phase === "wartime") {
    const p1 = wartimePriorityOne(G, power);
    if (p1 !== null) return p1;
    return {move: "passWarMove"};
  }

  // ------------------------------------------------------------- end phase
  if (phase === "end") {
    // B1: bots always build army step in end phase (20.1 Militarism).
    // The pending decision handles the actual choice; `endPhaseTurn` advances.
    return {move: "endPhaseTurn"};
  }

  // --------------------------------------------------------- great war
  if (phase === "gwPlanning") {
    // End planning turn to advance to maneuver.
    return {move: "endGwPlanningMove"};
  }

  if (phase === "gwManeuver") {
    if (G.gw?.neutralImpulses) {
      return gwCardProblem(G, power, "event") === null
        ? {move: "playGwCardMove", args: ["event"]} : {move: "gwPass"};
    }
    const impulse = currentGwImpulse(G, power);
    if (impulse.bonusPending) return gwRequiredAction(G, ctx, power) ?? {move: "gwPass"};
    if (impulse.budgetAction && gwFinishImpulseProblem(G, power) === null) return {move: "gwPass"};
    if (p.gwCard === "IE-GW-10" && gwAllyImpulseFor(G, power) === null && gwCardProblem(G, power, "cp") === null) {
      // 27.3: the printed escape for a mandatory Exhaustion card is its CP
      // play, not the event; the event still resolves at the end of the impulse.
      return {move: "playGwCardMove", args: ["cp"]};
    }
    if (gwAllyImpulseFor(G, power) !== null) {
      return gwRequiredAction(G, ctx, power) ?? {move: "gwPass"};
    }
    // Same B1 die as the action phase: a constant collapsed the GW maneuver
    // table onto its attack branch.
    const p2 = gwPriorityTwo(G, power, roll2d6(ctx), ctx);
    if (p2 !== null) return p2;
    // 27.3: GW-10 Exhaustion forbids passing, and as a GW card it is not in
    // `hand` — `passRestriction` has to be asked about this turn's GW card, or
    // the bot names a move the engine refuses forever.  Playing it for CP is
    // the printed escape (the card's event is optional at this point).
    if (gwFinishImpulseProblem(G, power) !== null) return gwRequiredAction(G, ctx, power) ?? {move: "gwPass"};
    return {move: "gwPass"};
  }

  if (phase === "gwWinter") {
    // `gwEndTurn` is a maneuver move; a stalled winter is retried through
    // `gwResolveWinter`, which is the only move the phase accepts.
    return {move: "gwResolveWinter"};
  }

  // Fallback: the action-phase exit is the only impulse-ending move left, and
  // a phase that reaches here is either that phase or one with no bot branch.
  return {move: "pass"};
};

// ---------------------------------------------------------------------------
// boardgame.io ai.enumerate integration
// ---------------------------------------------------------------------------

/**
 * `ai.enumerate` hook for boardgame.io's built-in MCTS.
 *
 * Returns a single-element array with the bot's chosen move so the MCTS
 * engine treats it as the only candidate (effectively a deterministic bot
 * rather than a full MCTS search).  This keeps the rule 34 logic intact
 * while still being compatible with the `ai.enumerate` interface.
 */
export const enumerateBot = (
  G: ImperialElegyState,
  ctx: Ctx,
  playerID: PlayerID,
): BotMove[] => {
  const power = powerFromPlayerID(playerID);
  if (power === undefined) return [];
  const move = botDecision(G, ctxWithBotRandom(G, ctx, power), power);
  return [move];
};

// ---------------------------------------------------------------------------
// Public API for the UI bot driver (non-MCTS usage)
// ---------------------------------------------------------------------------

/**
 * Return true when the given seat should be driven by the bot.
 *
 * Seats marked `isBot` in `ImperialElegyState.powers[power].flags` are
 * bot-controlled.  The flag is set by the game setup and read here so the
 * board can suppress the human controls and auto-submit moves.
 */
export const isBotSeat = (G: ImperialElegyState, power: Power): boolean =>
  Boolean(G.powers[power]?.flags?.isBot);

/**
 * Return the bot's decided move for use by the board component's auto-submit
 * timer (non-MCTS path, used in hotseat mode when a seat is set to bot).
 */
export const botMoveFor = (G: ImperialElegyState, ctx: Ctx, power: Power): BotMove =>
  botDecision(G, ctxWithBotRandom(G, ctx, power), power);
