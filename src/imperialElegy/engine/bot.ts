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
import {powerOfSeat, seatOf} from "./pending";
import {SPACES, isKey, neighboursOf} from "../constant/spaces";
import {
  controlledBy,
  friendlySpace,
  hasLoc,
  isArmyKind,
  isHomeSpace,
  landUnitsIn,
  navalUnitsIn,
  ownsKey,
  unitsOfPower,
  isPower,
} from "./rules";
import {canPassNow} from "../moves";
import {canRecruitIn} from "./characteristics";
import {gwDraftSpaces} from "./greatWarFlow";
import {reserveRemaining} from "./economy";

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
    const decision = canRecruitIn(G, power, id, "army", {});
    if (decision.allowed) return id;
  }
  return null;
};

/**
 * Cards the bot may spend for CP.  Mandatory cards must be played for their
 * event (moves.ts refuses `mode: "cp"` for them), so selecting one here would
 * hand the board an invalid move and stall the bot.
 */
const isCpSpendable = (cardId: CardId): boolean => {
  const def = cardById(cardId);
  return def.kind !== "home"
    && def.type !== "response"
    && def.type !== "combat"
    && def.type !== "mandatory"
    && def.type !== "mandatoryResponse";
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
  // Bots never play a 3 CP event that doesn't help them.
  // Simplified heuristic: mandatory events must always play; optional events
  // with ≤2 CP are played; 3-CP optional events are skipped (bot uses CP).
  if (def.type === "mandatory" || def.type === "mandatoryResponse") return true;
  if (def.cp >= 3) return false;
  return true;
};

/** Find an independent minor power with no alliance marker that the bot can ally. */
const minorAllianceTarget = (G: ImperialElegyState, power: Power, region: BditRegion): SpaceId | null => {
  const candidates = spacesInBditRegion(region);
  for (const id of candidates) {
    const space = G.spaces[id];
    if (!space) continue;
    if (space.ally !== null && space.ally !== undefined) continue;
    const def = SPACES[id];
    if (!def || isPower(def.control)) continue;
    if (isPower(space.control)) continue;
    return id;
  }
  return null;
};

/** Find a space in a BDIT region to place influence (no existing influence or opponent's). */
const influenceTarget = (G: ImperialElegyState, power: Power, region: BditRegion): SpaceId | null => {
  const candidates = spacesInBditRegion(region);
  for (const id of candidates) {
    const space = G.spaces[id];
    if (!space) continue;
    if (space.influence === power) continue; // already ours
    return id;
  }
  return null;
};

/** Find rebel armies on the map that the bot can attack (adjacent or in space). */
const findRebelTarget = (G: ImperialElegyState, power: Power): {space: SpaceId; from: SpaceId} | null => {
  for (const [spaceId, spaceState] of Object.entries(G.spaces)) {
    if (!spaceState.rebellion) continue;
    // Check if we have an army adjacent that can attack
    for (const nId of neighboursOf(spaceId)) {
      const nState = G.spaces[nId];
      if (!nState) continue;
      const our = landUnitsIn(G, nId).filter((u) => u.owner === power);
      if (our.length > 0) return {space: spaceId, from: nId};
    }
    // Or we're already in the rebel space
    const our = landUnitsIn(G, spaceId).filter((u) => u.owner === power);
    if (our.length > 0) return {space: spaceId, from: spaceId};
  }
  return null;
};

/** True when the bot's home cards include the given card name handler. */
const homeCardHandlerOf = (power: Power): string => {
  switch (power) {
    case "GE": return "bismarckWar";
    case "UK": return "sunNeverSets";
    case "FR": return "auxArmes";
    case "AU": return "habsburgDynasty";
    case "RU": return "russoTurkishWars";
    case "OT": return "modernization";
    default: return "";
  }
};

// ---------------------------------------------------------------------------
// Pending decision — bot auto-answer
// ---------------------------------------------------------------------------

/**
 * When a pending decision is open and it belongs to this bot, return the
 * move that answers it.  Bots pick the first legal option (the printed rule
 * says to roll a die for undocumented cases; here we default to first option).
 */
export const botPendingMove = (
  G: ImperialElegyState,
  power: Power,
): BotMove | null => {
  const pending = G.pending;
  if (!pending || pending.power !== power) return null;
  if (pending.options.length === 0) return null;

  // For specific decision kinds, the bot has printed rules.
  switch (pending.kind) {
    case "navalAvoid":
      // Bot always fights (never avoids).
      return {move: "declinePending"};

    case "combatSupport":
      // Bot always supports its own battles.
      return {move: "resolvePending", args: [pending.options[0].id]};

    case "navalInterception":
      // Bot always attempts interception.
      return {move: "resolvePending", args: [pending.options[0].id]};

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
      // Combat decisions: pick first option (take the loss / retreat / advance).
      return {move: "resolvePending", args: [pending.options[0].id]};

    case "warAlly":
    case "warAllyConsent":
      // Bots always call allies (B2: "Bots will always call allies").
      return {move: "resolvePending", args: [pending.options[0].id]};

    case "warAim":
    case "warInitiative":
      return {move: "resolvePending", args: [pending.options[0].id]};

    case "balanceOfPower":
      // Bot accepts Balance of Power (UK bot special: always play Sun Never Sets;
      // but as the *target* of BoP the bot accepts to get the card draw).
      return {move: "resolvePending", args: [pending.options[0].id]};

    case "treatyOption":
    case "treatySpace":
    case "whitePeaceOrder":
      return {move: "resolvePending", args: [pending.options[0].id]};

    case "goalChoice":
    case "industryCard":
    case "mpitAllocation":
    case "italyTable":
    case "gwDraft":
    case "gwCard":
    case "gwWinter":
    case "scoringChoice":
      return {move: "resolvePending", args: [pending.options[0].id]};

    case "militarism":
      // End phase 20.1: bot always builds army step (B1: "bots will always
      // build an army step instead of maintaining a fort").
      {
        const armyOpt = pending.options.find((o) => o.id.startsWith("army") || o.id === "army");
        const opt = armyOpt ?? pending.options[0];
        return {move: "resolvePending", args: [opt.id]};
      }

    case "manpowerExcess":
      // 20.5: discard first over-limit army.
      return {move: "resolvePending", args: [pending.options[0].id]};

    case "allianceTie":
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
      return {move: "resolvePending", args: [pending.options[0].id]};

    default:
      return {move: "resolvePending", args: [pending.options[0].id]};
  }
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
  //    A card may only be played while the impulse holds no CP (12.0).
  const homeCard =
    p.selectedHomeCard !== null && p.hand.includes(p.selectedHomeCard) ? p.selectedHomeCard : null;
  if (homeCard !== null && G.cpRemaining === 0) {
    const def = cardById(homeCard);
    const skipEvent = p.stability >= 6 && def.cp < 3;
    if (!skipEvent) {
      return {move: "playCard", args: [homeCard, "event"]};
    }
    // Play for CP instead.
    return {move: "playCard", args: [homeCard, "cp"]};
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

  // 4. Industrialize (only if auto-industry marker active).
  if (p.autoIndustry && p.industryCard !== null && G.cpRemaining >= 1) {
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
      // `reserveRemaining` mirrors the move's own gate (box = manpower/industry,
      // 0 for the UK).  A box with no room is an illegal move, not a cheap army.
      const room = reserveRemaining(G, power);
      if (room > 0) {
        return {move: "recruit", args: [null, "reserveArmy", 1, {}]};
      }
    }    // Then fort (3-4 sub-result: die shows 3 on the chart → build fort).
    if (roll === 3 && G.cpRemaining >= 1) {
      const space = botFortSpace(G, power);
      if (space !== null) {
        return {move: "buildFort", args: [space]};
      }
    }
    // Then EC.
    if (roll === 4 && G.cpRemaining >= 2) {
      for (const [id] of Object.entries(SPACES)) {
        const armies = landUnitsIn(G, id).filter((u) => u.owner === power);
        if (armies.length > 0) {
          return {move: "recruit", args: [id, "eliteCorps", 2, {}]};
        }
      }
    }
  }

  // 5-6 — play a card for its event.  `playCard` only accepts an event while
  // the impulse holds no CP (12.0), so this tier is skipped when CP is banked;
  // `botDecision` then spends the CP and reaches this tier on a later impulse.
  if (roll >= 5 && roll <= 6 && G.cpRemaining === 0) {
    for (const cardId of p.hand) {
      if (!isCpSpendable(cardId)) continue;
      if (worthPlayingForEvent(G, power, cardId)) {
        return {move: "playCard", args: [cardId, "event"]};
      }
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
const excessCp = (G: ImperialElegyState, power: Power): BotMove | null => {
  if (G.cpRemaining <= 0) return null;

  // Build armies first.
  const space = botRecruitSpace(G, power);
  if (space !== null) {
    return {move: "recruit", args: [space, "army", 1, {}]};
  }

  // Then BMPIT influence.  `placeInfluence` places a *map* influence marker
  // and takes a SpaceId; the alliance track is moved with `placeMpit`.
  // Deterministic first choice: the next power, on whichever of its tracks the
  // bot is furthest from, preferring TA while it is still open.
  const targetPower = POWERS[(POWERS.indexOf(power) + 1) % POWERS.length];
  const track = G.powers[targetPower].mpit.te >= 3 ? "neutral" : "te";
  return {move: "placeMpit", args: [targetPower, track]};
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
  const budget = war.budgets[power] ?? 0;

  // Attack enemy capital if adjacent.
  const enemyPowers = [...war.attackerAllies, war.attacker, ...war.defenderAllies, war.defender]
    .filter((p) => p !== power);
  for (const enemy of enemyPowers) {
    const def = G.powers[enemy];
    if (def.eliminated) continue;
    // Find enemy capital.
    for (const [id, spaceDef] of Object.entries(SPACES)) {
      if (spaceDef.home !== enemy && spaceDef.type !== "capital") continue;
      // Look for adjacent space with our armies.
      for (const nId of neighboursOf(id)) {
        const ourUnits = landUnitsIn(G, nId).filter((u) => u.owner === power);
        if (ourUnits.length > 0 && budget >= 1) {
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
      ...enemyPowers.map((p) => war.budgets[p] ?? 0),
    );
    if (opponentMaxBudget > budget) {
      return {move: "passWar"};
    }
  }

  return null;
};

// ---------------------------------------------------------------------------
// GW Planning and Maneuver
// ---------------------------------------------------------------------------

/** GW Priority 2 (B2) — roll 1–6. */
const gwPriorityTwo = (G: ImperialElegyState, power: Power, roll: number): BotMove | null => {
  const budget = G.powers[power].gwBudget ?? 0;
  if (budget <= 0) return null;

  if (roll >= 1 && roll <= 3) {
    // Attack or move to defend stability spaces.
    // Simplified: march into an adjacent space that holds enemy armies.
    for (const [id] of Object.entries(G.spaces)) {
      const ours = landUnitsIn(G, id).filter((u) => u.owner === power && !u.elite);
      if (ours.length === 0) continue;
      for (const to of neighboursOf(id)) {
        const enemies = landUnitsIn(G, to).filter((u) => isPower(u.owner) && u.owner !== power);
        if (enemies.length === 0) continue;
        // `gwMarch` takes (unitId, to): one army per action, so march the
        // strongest unit the bot has in the origin space.
        const unit = ours[0];
        return {move: "gwMarch", args: [unit.id, to]};
      }
    }
  }

  if (roll >= 4 && roll <= 5) {
    // Refit (convert to 6 if all armies full strength).
    const reduced = Object.values(G.units).filter((u) => u.owner === power && !u.naval && u.steps === 1);
    if (reduced.length > 0) {
      return {move: "gwRefit", args: [reduced[0].id]};
    }
  }

  if (roll === 6) {
    // Draft into a legal home key; the engine decides the second placement.
    if (G.powers[power].manpower > 0) {
      const space = botDraftSpace(G, power);
      if (space !== null) {
        return {move: "gwDraft", args: [space]};
      }
    }
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
export const botDecision = (
  G: ImperialElegyState,
  _ctx: Ctx,
  power: Power,
): BotMove => {
  // Handle any open pending decision first.
  const pendingMove = botPendingMove(G, power);
  if (pendingMove !== null) return pendingMove;

  const phase = G.phase;
  const p = G.powers[power];

  // ------------------------------------------------------------------ prep
  if (phase === "prep") {
    // Take stability discard if stability ≤ 2 (B1: "bots will take the
    // optional stability increase if their stability is ≤ 2").
    if (p.stability <= 2 && p.hand.length > 0) {
      const discardable = p.hand.find((id) => {
        const def = cardById(id);
        return def.type !== "mandatory" && def.type !== "mandatoryResponse" && def.kind !== "home";
      });
      if (discardable) {
        return {move: "discardForStability", args: [discardable]};
      }
    }
    return {move: "finishPrep"};
  }

  // ------------------------------------------------------------ diplomacy
  if (phase === "diplomacy") {
    // B1: "do not choose a home card for bots, instead each bot adds a
    // random home card to their pile".  Add first available home card.
    // `chooseHomeCard` is diplomacy-only and only accepts a card that has not
    // been chosen yet (moves.ts), so this branch must never run later.
    if (!p.flags.homeChosen && p.homeCards.length > 0) {
      return {move: "chooseHomeCard", args: [p.homeCards[0]]};
    }
    return {move: "endDiplomacy"};
  }

  // ------------------------------------------------------------- action
  if (phase === "action") {
    if (G.activePower !== power) {
      // Not our turn; end our stage.
      return {move: "endImpulse"};
    }

    // A mandatory card in hand forbids passing (12.0), so play it first.
    // It may only be played for its event and only while the impulse is empty.
    const mandatory = mandatoryInHand(G, power);
    if (mandatory !== null && G.cpRemaining === 0) {
      return {move: "playCard", args: [mandatory, "event"]};
    }

    // Priority 1.
    const p1 = priorityOne(G, power);
    if (p1 !== null) return p1;

    // Start a fresh impulse by playing a card for CP.
    if (G.cpRemaining === 0) {
      const cpCard = p.hand.find(isCpSpendable);
      if (cpCard !== undefined) {
        return {move: "playCard", args: [cpCard, "cp"]};
      }
    }

    // Priority 2: bot uses a fixed "die" of 3 (conservative — build armies)
    // when no random roll is available.  The UI/MCTS layer should supply a
    // real roll; this fallback ensures the bot always has a legal move.
    if (G.cpRemaining > 0) {
      const p2 = priorityTwo(G, power, 3, 3);
      if (p2 !== null) return p2;

      // Excess CP: build armies, then BMPIT.
      const excess = excessCp(G, power);
      if (excess !== null) return excess;
    }

    // Pass if allowed, else end impulse.
    if (canPassNow(G, power)) {
      return {move: "pass"};
    }
    return {move: "endImpulse"};
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
    const p2 = gwPriorityTwo(G, power, 3);
    if (p2 !== null) return p2;
    return {move: "gwPass"};
  }

  if (phase === "gwWinter") {
    // `gwEndTurn` is a maneuver move; a stalled winter is retried through
    // `gwResolveWinter`, which is the only move the phase accepts.
    return {move: "gwResolveWinter"};
  }

  // Fallback.
  return {move: "endImpulse"};
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
  const move = botDecision(G, ctx, power);
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
  botDecision(G, ctx, power);
