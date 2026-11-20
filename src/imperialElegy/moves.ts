import {Ctx, PlayerID} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {
  CardId,
  EndPhaseProgress,
  GamePhase,
  ImperialElegyState,
  PendingDecision,
  Power,
  POWERS,
  PowerOrMinor,
  SpaceId,
  Unit,
  WarState,
} from "./types";
import {SPACES, isNavalBox, neighboursOf, portBoxes, spaceLabel} from "./constant/spaces";
import {FLASHPOINTS, POWER_DEFS} from "./constant/powers";
import type {Effect} from "./constant/cards";
import {CAMPAIGN_SETUP, MINOR_POWER_HOMES} from "./constant/setup";
import {GOALS_BY_ID} from "./constant/goals";
import {botPowersOf, handOverSeat} from "./configuration";
import {cardById, discardCard, drawCards, drawOne, handWithoutSpecials, isCardId, removeCard} from "./engine/deck";
import {
  autoIndustrySuccess,
  cpChainResolution,
  CP_CHAIN_MAX_CARDS,
  decadeForTurn,
  endPhaseOrder,
  industryRollNeeded,
  reserveRemaining,
} from "./engine/economy";
import {
  defaultMilitarismOption,
  initialNonPlayerBuildBox,
  italianRebuildPlan,
  manpowerExcess,
  militarismOptions,
  navalReturnPlan,
  nonPlayerBuildPlan,
  unitMinor,
  woiProgressPlan,
  type MilitarismBenefit,
  type NavalReturnEntry,
} from "./engine/endPhase";
import {
  dardanellesController,
  dardanellesGate,
  firstDardanellesPermissionCrossing,
  planNavalMove,
  planNavalTransport,
  requestDardanellesPassage,
  type NavalTransportReason,
} from "./engine/navalMovement";
import {
  allyAidShift,
  canJoinAlliance,
  declarationShift,
  declarationShiftDirection,
  sideOfAllianceBox,
  type AllianceSide,
} from "./engine/alliance";
import {
  allied,
  atWar,
  beginImpulseUpkeep,
  changeStability,
  resolveAuUnstableChoice,
  clearTurnDurationFlags,
  changeWtt,
  commandsAlliedMinor,
  computePowerProjection,
  cpBudgetFor,
  controlledBy,
  die,
  dominatedFlashpoints,
  efDestinationAllowed,
  enemiesOf,
  friendlyPort,
  friendlySpace,
  gwAllyImpulseFor,
  hasLoc,
  hostileOwner,
  isArmyKind,
  isEliteKind,
  isHomeSpace,
  isNavalKind,
  isPower,
  landStackingLimit,
  landUnitsIn,
  log,
  minorController,
  movementEndProblem,
  navalUnitsIn,
  ownsKey,
  PORT_NAVAL_LIMIT,
  powerLabel,
  recomputeTracks,
  randomIndex,
  recordOccupation,
  redeployLandPath,
  refreshPowerProjection,
  resolveImpulseLoss,
  setSpaceControl,
  spendCpFor,
  spendColonialCp,
  freeColonialCp,
  unitById,
  unitsOfPower,
  BISMARCK_HOME_CARD,
  clearWarDeclarationEntitlement,
  effectiveKeyType,
  warDeclarationAllowsTwoPowers,
  warDeclarationEntitlement,
  warDeclarationMayForbidJoins,
  warDeclarationNeutralJoinOnDouble,
  warDeclarationPolicy,
  warDeclarationTargetLegal,
  warDeclarationExemptsConquestPenalty,
} from "./engine/rules";
import {minorLabel} from "./engine/minorLabel";
import {unitKindLabel} from "./engine/unitKind";
import {
  diplomacyPlacementProblem,
  influencePlacementProblem,
  minorAllianceProblem,
  removeAllianceCost,
  removeMarkerProblem,
  removeMinorAllianceProblem,
} from "./engine/foreignAffairs";
import {hasCounterFor} from "./engine/counters";
import {
  cpPlayability,
  eventPlayability,
  removeAfterCpPlay,
  removesAfterPlay,
  responseTriggerBlock,
  youngTurksBlocksFailedReforms,
} from "./engine/playability";
import {ensureStateDefaults} from "./engine/migrations";
import {botFreeRedeployment, warBotPowers} from "./engine/botRedeployment";
import {planWartimeLandMove, wartimeRailed} from "./engine/wartimeMovement";

// The start-of-impulse penalties live in rules.ts so the GW flow can run them
// without an import cycle; re-export them for direct callers and tests.
export {beginImpulseUpkeep, resolveImpulseLoss} from "./engine/rules";
import {closeDecision, decision, openDecision, option, powerOfSeat, seatOf} from "./engine/pending";
import {finishCard, placeNonPlayerCounter, placeUnit, removeUnit, resolveCard, resolveCardDecision, resolveEffects, spendReserveSteps, addReserve, damageUnit, resolveAllianceStep, resolveItalyAllianceStep, displaceIndianArmies, grantRapidDeployment, displaceUnitToFriendlyLoc, displaceUnitsNotFriendlyTo, registerPolishIndependence, LOOSE_GRIP_CARD, looseGripRemovalDue, resolveAmericanCivilWarEndPhase} from "./engine/effects";
import {POLAND, polishDeploySpace, polishRecruitDecision, polishReserveDeployer, polishReserveIds} from "./engine/poland";
import {
  allianceResolutionOrder,
  applyAllianceResolution,
  resolveAllianceResolutionTie,
  rollAllianceResolution,
  type AllianceDirection,
  type AllianceResolutionRoll,
} from "./engine/effects";
import {
  afterCombatCardWindow,
  resolveHydraulicRecoil,
  resolveEliteBonus,
  attemptInterception,
  beginLandBattle,
  beginNavalBattle,
  beginNavalStartBattles,
  attemptNavalAvoidance,
  chooseLoss,
  chooseSupport,
  firstTransitInterceptHop,
  maybeOpenDecisiveFollowUp,
  navalDefenderPower,
  navalInterceptCandidates,
  openNavalAvoidDecision,
  openNavalContactDecision,
  openNavalTransitInterception,
  playCombatCard,
  resolveBattleRoll,
  resolveCombatDiscard,
  resolveCombatRetreat,
  resolveDecisiveFollowUp,
  resolveMineRetreat,
  resolveNavalInterception,
  resolveNavalPortBox,
  resolveNavalPortContinuation,
  resolveNextNavalStartContact,
  navalStartQueuePending,
} from "./engine/combat";
import {facedownGwCombatCards, isCombatCardId} from "./engine/combatCards";
import {usArmyMayLeaveNorthAmerica, usCanLeaveNorthAmerica} from "./engine/gwMajors";
import {
  auIncorporateDecision,
  auRightsDecision,
  canGrantCitizenship,
  canRecruitIn,
  minorBuildDecision,
  dualMonarchy,
  DUAL_MONARCHY_CARD,
  frLostWar,
  GE_UNIFICATION_GOAL,
  germanConfederationCandidates,
  grantAuCitizenship,
  industryRoll,
  jihadUse,
  NAPOLEONS_LEGACY_GOAL,
  napoleonsLegacyDecision,
  ottomanArmyTypeFor,
  canUseRapidDeployment,
  indianArmyCap,
  isIndependentIndia,
  pacificationCost,
  pacificationModifier,
  applyGermanConfederationHomeOverrides,
  markSuperiorStaffWorkGwImpulse,
  metternichAllies,
  passRestriction,
  settleCulturalSymbolLoss,
  superiorStaffWorkFreeDeploy,
  superiorStaffWorkGwFreeDeploy,
  tsrrImpulseKey,
  recruitmentLimits,
  secondRome,
  thirdRepublicCp,
  tsrrRail,
  type TsrrRailDecision,
} from "./engine/characteristics";
import {checkGermanUnification, checkItalianUnification, checkAutoVictory, finishGame, finishScenario, scoreGame} from "./engine/victory";
import {
  blocksUkAmphibiousPort,
  buildPointsRemaining,
  campaignWindow,
  drawsNgsThisTurn,
  extraPrepCards,
  hasBloodAndIron,
  isFinalTurn,
  ngDrawCount,
  openingGoalDraw,
  startingGwTurn,
  ukNoAmphibiousGermanPorts,
} from "./engine/scenario";
import {
  applyFrancoPrussianConcession,
  francoPrussianPrepRule,
  hasFrancoPrussianWar,
  pendingGoalChoice,
  resolveGoalChoice,
  spendBuildPoint,
} from "./engine/scenarioSetup";
import {grantAuNewWayForward} from "./engine/nationality";
import {
  applyInternalItalianWar,
  applyItalianPetition,
  crisisRoll,
  crisisResumeEffects,
  ITALIAN_INTERNAL_WAR_POWERS,
  italyTable,
  outbreakGreatWar,
  endGreatWar,
  resolveCrisisPending,
  resolveItalianNationalistWaveChoice,
  resolveItalyNavalBase,
  resolveItalyOttomanTerritoryChoice,
} from "./engine/greatWar";
import {addItalyMpit} from "./engine/italyEntry";
import {
  activateGwExhaustion,
  advanceGwImpulse,
  beginGwNeutralImpulses,
  resolveGwBonusImpulse,
  faceupCombatCards,
  majorEntryOptions,
  maxIndustryOf,
  performGwManeuver,
  resolveGwColonialChoice,
  resolveGwDraftSecond,
  resolveGwNeutralOption,
  resolveGwWinter,
  revealGwCombatCard,
  giftGwCombatCard,
  startGwManeuver,
  transferGwBudget,
} from "./engine/greatWarFlow";
import {
  currentGwImpulse, gwActionAllowance, gwCanEndTurn, gwCardProblem,
  gwFinishImpulseProblem, hasLiveGwImpulse, noteGwCard, recordGwAction,
} from "./engine/gwImpulse";
import {
  allyCallEligibility,
  allyRefusalPenalty,
  applyAllyRefusal,
  applyHarshTerms,
  applyItalyAidShift,
  applyMinorAidAlliance,
  applyMinorDeclarationShift,
  applyVictoryOutcome,
  belligerentsOf,
  canAidMinor,
  canSurrender,
  classifyVictory,
  conquestDeclarationPenalty,
  createWarState,
  deployReserveLimit,
  demobilizeWar,
  firstTreatySide,
  hasTruce,
  initiativeOrder,
  initiativeRollOff,
  isItalianUnificationWar,
  isMinorWarTargetArg,
  minorWarDefender,
  minorWarInfo,
  nonPlayerHome,
  rapidMobilizationFreeDeploy,
  recordWarKnockoutCapture,
  recordWarKnockouts,
  joinWarAsAlly,
  joinWarAsMinor,
  joinWarAsNeutral as applyNeutralJoin,
  mandatoryCessionPending,
  needsWhitePeaceOrderChoice,
  neutralJoinEligibility,
  rollOffAidOrder,
  seekingAidSlots,
  settleLimitedWar,
  sidePowers,
  truceRivals,
  validateWarAim,
  warBudgetFor,
  warDeclaredDefenders,
  type MinorWarInfo,
  type SeekingAidSlot,
  type TreatyChoice,
  type VictoryClassification,
  type WarAim as WarAimType,
  type WarSideName,
  type WarTarget,
} from "./engine/limitedWar";
import {
  applyTreatyChoice,
  buildTreatyPending,
  treatyChooserGroups,
  treatyMinorOptions,
  treatyOptionsFor,
  treatyPickCounts,
  treatySpaceOptions,
  type TreatyChooserGroup,
  type TreatyOptionEntry,
  type TreatyPickAvailability,
} from "./engine/treatyChoice";

const actor = (G: ImperialElegyState, playerID: PlayerID | null): Power | null => powerOfSeat(playerID) ?? null;

const requireActive = (G: ImperialElegyState, ctx: Ctx, playerID: PlayerID | null): Power | typeof INVALID_MOVE => {
  const power = actor(G, playerID);
  if (power === null) return INVALID_MOVE;
  if (G.pending !== null) return INVALID_MOVE;
  if (G.phase === "action" || G.phase === "prep" || G.phase === "diplomacy" || G.phase === "end" || G.phase === "gwPlanning" || G.phase === "gwManeuver") {
    if (power !== G.activePower) return INVALID_MOVE;
  }
  return power;
};

const spend = (G: ImperialElegyState, amount: number): boolean => {
  if (G.cpRemaining < amount) return false;
  G.cpRemaining -= amount;
  return true;
};

/**
 * Response timing bookkeeping.  A response card may only be played at the very
 * start of an impulse, so each impulse records whether its CP/action budget has
 * already been used.  The action flag is cleared when `finishImpulse` hands the
 * impulse to the next power (or the phase ends); the war flag when the maneuver
 * passes to the next belligerent.
 */
const clearActionImpulseSpend = (G: ImperialElegyState): void => {
  // A fresh impulse may belong to the same sole remaining player.
  delete G.flags.impulseUpkeepStamp;
  for (const power of POWERS) {
    delete G.powers[power].flags.actionCpSpentThisImpulse;
    delete G.powers[power].flags.allianceAtImpulseStart;
    // 12.15: a redeployment action covers one impulse; the next impulse pays
    // its own 1 CP before moving anything.
    delete G.powers[power].flags.redeployActionThisImpulse;
    // 15.2.5: the same for the wartime rail allowance.
    delete G.powers[power].flags.wartimeRailedThisImpulse;
    // 33.5 is "per impulse", so the railroad allowance resets when the
    // impulse passes to the next player (4.5).
    delete G.powers[power].flags.tsrrRailImpulse;
  }
  delete G.flags.decisiveBattle;
  delete G.flags.decisiveFollowUp;
  delete G.flags.decisiveBonusUsed;
};

/** Clear per-impulse deploy markers (15.2.3) when the maneuver moves on. */
const clearDeployedThisImpulse = (G: ImperialElegyState): void => {
  for (const unit of Object.values(G.units)) {
    if (unit.flags?.deployedThisImpulse === true) delete unit.flags.deployedThisImpulse;
  }
};

const clearWarImpulseSpend = (G: ImperialElegyState): void => {
  delete G.flags.impulseUpkeepStamp;
  for (const power of POWERS) {
    delete G.powers[power].flags.warCpSpentThisImpulse;
    // 33.5: a new wartime impulse re-enables the one-army railroad move.
    delete G.powers[power].flags.tsrrRailImpulse;
    // 15.2.5: the half-industry rail allowance is per action, and each action is
    // one impulse wide.
    delete G.powers[power].flags.wartimeRailedThisImpulse;
  }
  delete G.flags.decisiveBattle;
  delete G.flags.decisiveFollowUp;
  delete G.flags.decisiveBonusUsed;
  clearDeployedThisImpulse(G);
};

const addLog = log;

const clearCpChainPhaseFlags = (G: ImperialElegyState): void => {
  delete G.flags.cpChainActive;
  delete G.flags.cpChainSpent;
  delete G.flags.cpChainPower;
};

/**
 * Rule 12.14: cards in a CP Chain are always discarded at the end of the
 * action phase (never returned to hand and never carried into the next turn).
 * The chain cards are left faceup while the phase runs so the player can still
 * see what is funding the impulse.
 */
const discardCpChainsAtActionEnd = (G: ImperialElegyState): void => {
  for (const power of POWERS) {
    for (const cardId of [...G.powers[power].cpChain]) {
      discardCard(G, power, cardId, "discard");
    }
  }
  clearCpChainPhaseFlags(G);
};

const endActionPhase = (G: ImperialElegyState, ctx: Ctx): void => {
  clearActionImpulseSpend(G);
  discardCpChainsAtActionEnd(G);
  ctx.events?.setPhase?.("end");
};

const finishImpulse = (G: ImperialElegyState, ctx: Ctx): void => {
  if (G.phase === "action") {
    if (G.pending !== null) return;
    // The next action impulse starts with a fresh response window.
    clearActionImpulseSpend(G);
    // Reset per-impulse flags.
    for (const p of POWERS) {
      delete G.powers[p].flags.noBuildArmiesThisImpulse;
      delete G.powers[p].flags.alreadyInfluenced;
      delete G.powers[p].flags.alreadyRemovedInfluence;
      delete G.powers[p].flags.alreadyPacified;
      // 12.15: a redeployment action covers one impulse; the next impulse pays
      // its own 1 CP for a new one.
      delete G.powers[p].flags.redeployActionThisImpulse;
      // A home-card war declaration (Bismarck) belongs to the impulse that
      // played the card; a seat that hands over without declaring loses it.
      clearWarDeclarationEntitlement(G, p);
    }
    G.flags.combatDrm = 0;
    G.flags.enemyLandDrm = 0;
    G.flags.warLandDrm = G.flags.warLandDrm ?? 0;
    G.impulseCard = null;
    G.cpRemaining = 0;
    checkGermanUnification(G, ctx);
    checkItalianUnification(G, ctx);
    const auto = checkAutoVictory(G);
    if (auto !== null) {
      finishGame(G, `autoVictory:${auto}`);
      return;
    }
    const withCards = POWERS.filter((p) => G.powers[p].hand.length > 0 && !G.passed.includes(p));
    if (G.passed.length >= POWERS.length || withCards.length === 0) {
      endActionPhase(G, ctx);
      return;
    }
    let index = POWERS.indexOf(G.activePower);
    for (let i = 1; i <= POWERS.length; i += 1) {
      const next = POWERS[(index + i) % POWERS.length];
      if (!G.passed.includes(next) && G.powers[next].hand.length > 0) {
        G.activePower = next;
        ctx.events?.setActivePlayers?.({value: {[seatOf(next)]: "play"}});
        // 5.5.3 / 5.6.2: the incoming player's start-of-impulse penalties.
        beginImpulseUpkeep(G, ctx, next);
        return;
      }
    }
    endActionPhase(G, ctx);
  }
};

/**
 * A card removed by its own printed clause (`removeThisCard`, Loose Grip's
 * "remove from the game if Tunisia and Libya are no longer Ottoman controlled")
 * must not also be pushed into the discard pile, where the next reshuffle would
 * return it to the deck.
 */
const pruneRemovedFromDiscard = (G: ImperialElegyState): void => {
  if (G.removed.length === 0) return;
  const removed = new Set(G.removed);
  G.discard = G.discard.filter((id) => !removed.has(id));
};

/**
 * True when the card is currently parked as a player's industrialization card.
 * A027 Foreign Investment is played as an event and then sits face up in front
 * of the Ottoman or Russian player; the physical card must live in exactly one
 * zone, so the event-resolution tail must not also discard it.
 */
const isHeldAsIndustryCard = (G: ImperialElegyState, cardId: CardId): boolean =>
  POWERS.some((power) => G.powers[power].industryCard === cardId);

/**
 * 12.0 — an impulse starts with **one** card play (for CP or as its event) and
 * the CP that card provides may then be spent.  In the action phase the impulse
 * is therefore already used when CP are still banked, when a card has been
 * played, or when the first CP of the impulse has been spent (`requireCp`
 * records that on the same flag).  Both signals are per-impulse:
 * `finishImpulse` clears them.
 *
 * This is deliberately narrower than `hasActedThisImpulse`: the CP chain's
 * phase-long `cpChainActive` flag is part of that predicate (it decides which
 * reading of `pass` applies) but it does not stop the power from opening a
 * later impulse of the same action phase with a fresh card.  Phases with their
 * own wallet (wartime, Great War) keep the legacy CP-only reading, because
 * their spend flags are `warCpSpentThisImpulse` / `gwActionsThisImpulse`.
 */
export const impulseAlreadyUsed = (G: ImperialElegyState, power: Power): boolean => {
  if (G.cpRemaining > 0) return true;
  if (G.phase !== "action") return false;
  return G.powers[power].flags.actionCpSpentThisImpulse === true;
};

export const playCard = (G: ImperialElegyState, ctx: Ctx, cardId: CardId, mode: "cp" | "event"): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = requireActive(G, ctx, playerID);
  if (power === INVALID_MOVE) return INVALID_MOVE;
  if (!G.powers[power].hand.includes(cardId)) return INVALID_MOVE;
  const card = cardById(cardId);
  // 12.0: every card may be spent for CP — response and combat cards included.
  // A mandatory event has no "spend it and nothing happens" mode: the printed
  // event resolves first and then its CP are spent, which is exactly the event
  // path, so a CP play of a mandatory event resolves the event and must satisfy
  // the event's own printed gates too.
  const resolvesEvent = mode === "event" || card.type === "mandatory";
  // The printed "Playable if/after" clauses are engine-wide gates on the event
  // mode.  Response/combat windows keep their separate gates
  // (`playResponseCard`); a CP play only answers to its own printed clause — but
  // a CP play of a mandatory event *is* its event, so it passes the same gate.
  const gate = resolvesEvent ? eventPlayability(G, power, cardId) : cpPlayability(G, power, cardId);
  if (!gate.ok) {
    if (mode === "cp") log(G, power, "cardCpNotPlayable", {card: cardId, reason: gate.reason});
    else log(G, power, "eventNotPlayable", {card: cardId, reason: gate.reason});
    return INVALID_MOVE;
  }
  // 12.0: one card play per impulse.  Once the impulse's card has been played
  // — or its CP have been spent, even down to zero — the seat may only finish
  // the impulse; it may not open a second card in the same impulse.  The
  // mandatory-event bonus CP are that impulse's budget, so they are spent (or
  // forfeited) before the next card play, not followed by one.  There is no
  // no-pass exception: a used impulse can always be handed over through `pass`,
  // so a "rescue" play on top of banked CP would itself be a second card.
  if (impulseAlreadyUsed(G, power)) return INVALID_MOVE;
  const mandatory = card.type === "mandatory" || card.type === "mandatoryResponse";
  // 6.1/12.0: a home card is playable while it is **in hand**.  Normally only
  // the card chosen in Diplomacy is there, but A040 British Trade explicitly
  // adds the other one ("takes the home card they did not choose for this turn
  // and places it in their hand"), so hand membership — not the Diplomacy
  // selection — is the printed criterion.  A selection-only guard left that seat
  // unable to play the granted card *and* unable to pass (a home card in hand
  // forbids passing): no legal move at all.
  // Remove from hand before resolving.
  G.powers[power].hand = G.powers[power].hand.filter((id) => id !== cardId);
  if (G.powers[power].selectedHomeCard === cardId) G.powers[power].selectedHomeCard = null;
  if (G.phase === "action") G.powers[power].flags.actionCpSpentThisImpulse = true;
  // A099 Dreadnought: "if this is the first card you play this turn, gain an
  // additional dreadnought."  `firstCardPlayTurn` records the turn of the last
  // card play, so the handler can tell whether this play opens the turn.
  G.flags.firstCardThisTurn = G.flags.firstCardPlayTurn !== G.turn;
  G.flags.firstCardPlayTurn = G.turn;
  G.impulseCard = cardId;
  // A mandatory event played "for CP" is its event: the text resolves and is
  // read out, then the printed CP arrive.  That makes it a public event play
  // (12.0/12.1), never the masked CP-only line, so the log reports the mode that
  // actually happened.
  addLog(G, power, "cardPlayed", {card: cardId, mode: resolvesEvent ? "event" : mode});
  if (!resolvesEvent) {
    G.cpRemaining = card.cp;
    // A70: "Remove from the game if played for CP and Italy is unified."
    // A79: "Remove from the game if Tunisia and Libya are no longer Ottoman
    // controlled." — the CP play removes it instead of discarding it.
    const looseGripRemoved = cardId === LOOSE_GRIP_CARD && looseGripRemovalDue(G);
    if (removesAfterPlay(G, cardId) || removeAfterCpPlay(G, cardId) || looseGripRemoved) {
      if (!G.removed.includes(cardId)) G.removed.push(cardId);
      if (looseGripRemoved) log(G, undefined, "looseGripRemoved", {reason: "cp"});
      G.impulseCard = null;
    } else if (card.kind !== "home") {
      G.discard.push(cardId);
      G.impulseCard = null;
    } else {
      G.impulseCard = null;
    }
    return;
  }
  // Event; mandatory cards also grant their CP.
  if (mandatory) G.cpRemaining = card.cp;
  if (cardId === "IE-A067" && mode === "event") {
    // International Conference's printed normal-event mode is only the WTT
    // decrease; its +2 DRM belongs to the open crisis decision (above).  Do not
    // expose the OR chooser here, or the event mode could stock a DRM outside
    // the printed window.
    changeWtt(G, -1, ctx, cardId);
    if (!G.discard.includes(cardId)) G.discard.push(cardId);
    pruneRemovedFromDiscard(G);
    G.resolvingCard = null;
    G.impulseCard = null;
    if (G.cpRemaining <= 0 && G.pending === null && warDeclarationEntitlement(G, power) === null) {
      finishImpulse(G, ctx);
    }
    return undefined;
  }
  const done = resolveCard(G, ctx, power, card);
  if (!done) {
    G.flags.pendingCard = cardId;
    G.flags.pendingMandatory = card.type === "mandatory" || card.type === "mandatoryResponse";
    return;
  }
  if (done) {
    if (removesAfterPlay(G, cardId)) removeCard(G, cardId);
    // Some events park the physical card face up in front of a player (A027
    // Foreign Investment is that player's industrialization card).  That card
    // is now held in `industryCard`, so pushing it into the discard pile as
    // well would put one physical card in two zones.
    else if (card.kind !== "home" && !isHeldAsIndustryCard(G, cardId)) G.discard.push(cardId);
    pruneRemovedFromDiscard(G);
    G.resolvingCard = null;
    G.impulseCard = null;
    if (card.type !== "mandatory") {
      G.impulseCard = null;
      // Event play ends the impulse unless the card grants CP, or the event
      // itself opened a home-card war declaration (Bismarck).  That
      // entitlement belongs to this impulse: the seat declares the war here or
      // hands the impulse over (`finishImpulse` clears it).
      if (G.cpRemaining <= 0 && G.pending === null && warDeclarationEntitlement(G, power) === null) {
        finishImpulse(G, ctx);
      }
    }
  }
  return undefined;
};

/**
 * Rule 12.0 — a player may only pass with zero or one card in hand (the UK may
 * hold two) and never while holding a home card or a mandatory event.
 *
 * Cards that forbid passing (A047 The Dual Monarchy, GW #10 Exhaustion) are
 * covered by the same check through `passRestriction`: their holder must play
 * the card for CP first, which the moves already allow, so the impulse always
 * has a legal exit.
 */
export const canPassNow = (G: ImperialElegyState, power: Power): boolean => {
  const p = G.powers[power];
  const limit = power === "UK" ? 2 : 1;
  const onlyReactive = p.hand.length > 0 && p.hand.every((id) => ["response", "combat"].includes(cardById(id).type));
  if (passRestriction(G, power).forced) return false;
  if (p.hand.length > limit && !onlyReactive) return false;
  return !p.hand.some((id) => {
    const card = cardById(id);
    return card.kind === "home" || card.type === "mandatory" || card.type === "mandatoryResponse" || (power === "AU" && id === "IE-A047");
  });
};

/**
 * True when the seat has already used this impulse: a card was played (the flag
 * `playCard` sets), CP are banked from that card or from a CP chain, or the
 * chain impulse is running.  12.0's zero-or-one-card condition only decides
 * whether an *unused* impulse may be skipped; a seat that has acted is simply
 * finishing what it started, so its hand no longer restricts the exit.
 *
 * Fixtures that bank CP without going through `playCard` still count as having
 * acted, which is why `cpRemaining` is part of the signal.
 */
export const hasActedThisImpulse = (G: ImperialElegyState, power: Power): boolean =>
  G.powers[power].flags.actionCpSpentThisImpulse === true
  || G.cpRemaining > 0
  || G.flags.cpChainActive === true;

/**
 * The single way out of an action impulse (12.0 + 4.5).
 *
 * 12.0 lists three things a player may do in an impulse — spend a card for CP,
 * play its event, or pass — and there is no fourth "end my impulse" action.
 * Both outcomes therefore come through this move:
 *
 *  - **used impulse** (a card was played or CP remain): the remaining CP are
 *    forfeited and the impulse hands over.  No pass is recorded, so the seat is
 *    not treated as having dropped out of the action phase.
 *  - **unused impulse** (`hasActedThisImpulse` false): this is 12.0's pass, and
 *    the hand must satisfy `canPassNow` — zero or one card (two for the UK),
 *    no home card and no mandatory event.  The pass is recorded so the
 *    consecutive-pass counter can end the action phase.
 */
export const pass = (G: ImperialElegyState, ctx: Ctx): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = requireActive(G, ctx, playerID);
  if (power === INVALID_MOVE) return INVALID_MOVE;
  if (G.phase !== "action") return INVALID_MOVE;
  if (hasActedThisImpulse(G, power)) {
    G.cpRemaining = 0;
    finishImpulse(G, ctx);
    return undefined;
  }
  if (!canPassNow(G, power)) return INVALID_MOVE;
  if (!G.passed.includes(power)) G.passed.push(power);
  addLog(G, power, "passed", {});
  finishImpulse(G, ctx);
  return undefined;
};

export const debugMove = (G: ImperialElegyState, ctx: Ctx): string | void => {
  const playerID = ctx.playerID ?? null;
  G.flags.debug = String(playerID);
  return undefined;
};

// ------------------------------------------------------------------ prep
/**
 * The optional prep discard is a **random** draw: the player decides only
 * whether to spend a card for +1 stability, never which card.  Letting the
 * client nominate the card would turn the printed random discard into a free
 * choice (dump the card that is about to be reshuffled and keep the good one).
 * Mandatory events and home cards stay in hand; the identity is resolved from
 * `ctx.random`, so it is server-authoritative.
 */
export const discardForStability = (G: ImperialElegyState, ctx: Ctx): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  if (power === null || G.phase !== "prep") return INVALID_MOVE;
  const p = G.powers[power];
  if (p.flags.prepStability) return INVALID_MOVE;
  const eligible = handWithoutSpecials(G, power);
  if (eligible.length === 0) return INVALID_MOVE;
  const cardId = eligible[randomIndex(ctx, eligible.length)];
  discardCard(G, power, cardId, "prepStabilityDiscard");
  changeStability(G, power, 1, ctx);
  p.flags.prepStability = true;
  return undefined;
};

export const finishPrep = (G: ImperialElegyState, ctx: Ctx): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  if (power === null || G.phase !== "prep") return INVALID_MOVE;
  const p = G.powers[power];
  // A scenario's printed pre-game decisions ("prior to the Prep Phase of turn
  // 3": the Franco-Prussian War concession, the AU NG deck edit, the alternate
  // GW build points) run once, before the first prep phase can close.
  if (G.flags.setupDecisionsDone !== true) {
    if (openSetupDecisions(G, ctx)) return undefined;
    G.flags.setupDecisionsDone = true;
  }
  p.flags.prepDone = true;
  if (POWERS.every((x) => G.powers[x].flags.prepDone)) {
    ctx.events?.setPhase?.("diplomacy");
    G.phase = "diplomacy";
    G.activePower = "GE";
    log(G, undefined, "diplomacyStarted", {});
  } else {
    const index = POWERS.indexOf(G.activePower);
    const next = POWERS[(index + 1) % POWERS.length];
    G.activePower = next;
    ctx.events?.endTurn?.();
  }
  return undefined;
};

// ------------------------------------------------------------------ bot seats

/**
 * Rule 34 — hand a seat over to the bot, or take it back, mid-match.
 *
 * The lobby's `setupData.bots` only fills the seats nobody took when the match
 * was created; a player may also step out later (a misclick, a lost connection,
 * "play it out"), and a bot seat may be reclaimed by a returning player.  The
 * move writes the public `G.bots` list, which every client redraws from and the
 * server's bot driver reads on its next tick, so a handover needs no restart.
 *
 * Only the seat itself may call it: `ctx.playerID` must name the seat.  A local
 * hotseat board passes the id of the seat it is showing, and an online seat
 * passes its own, so nobody can force a bot onto an opponent.  The seat keeps
 * its boardgame.io player and credentials — that is what lets the player take
 * it back; the handover only changes who is expected to drive it.
 */
export const setSeatBot = (G: ImperialElegyState, ctx: Ctx, bot: boolean): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  if (power === null) return INVALID_MOVE;
  const before = botPowersOf(G).includes(power);
  if (handOverSeat(G, playerID, power, bot) === null) return INVALID_MOVE;
  // A repeated click (or a retried move) must not add a second log line.
  if (before !== bot) log(G, power, "botSeatChanged", {bot: bot ? "yes" : "no"});
  return undefined;
};

// ------------------------------------------------------------------ diplomacy

/** 33.4 Metternich's Legacy: mark the AU alliance with `space` and log it. */
const applyMetternichAlly = (G: ImperialElegyState, space: SpaceId): boolean => {
  const state = G.spaces[space];
  if (!state) return false;
  state.ally = "AU";
  log(G, "AU", "metternichAlliance", {space});
  return true;
};

/**
 * 33.4 Metternich's Legacy: "AU gains an alliance with two minor powers of their
 * choice."  When more than two candidates are eligible the AU player picks each
 * one through a `metternich` decision; with zero, one or exactly two candidates
 * there is nothing to choose and the (deterministic) candidate list is applied.
 * Returns true when a decision was opened.
 */
const openMetternichChoice = (G: ImperialElegyState, ctx: Ctx, picked: readonly SpaceId[]): boolean => {
  const candidates = metternichAllies(G).candidates.filter((space) => !picked.includes(space));
  const needed = 2 - picked.length;
  if (needed <= 0 || candidates.length <= needed) {
    for (const space of candidates.slice(0, Math.max(0, needed))) applyMetternichAlly(G, space);
    G.persistent.metternich = true;
    return false;
  }
  openDecision(
    G,
    ctx,
    decision(
      "metternich",
      "AU",
      `Metternich's Legacy: choose a minor power to ally (${picked.length + 1} of 2)`,
      candidates.map((space) => option(
        space,
        `Gain an alliance with ${spaceLabel(space, "en")}`,
        undefined,
        false,
        `与${spaceLabel(space, "zh_CN")}结盟`,
      )),
      {picked: [...picked]},
      {picked: picked.join(",")},
      `梅特涅的遗产：选择一个小国结盟（第 ${picked.length + 1} / 2 个）`,
    ),
  );
  return true;
};

/** Resume the diplomacy step once the Metternich choice (if any) is answered. */
const resolveMetternichChoice = (
  G: ImperialElegyState,
  ctx: Ctx,
  pending: PendingDecision,
  optionId: string,
): string | void => {
  const picked = Array.isArray(pending.context?.picked)
    ? (pending.context!.picked as SpaceId[]).filter((space): space is SpaceId => typeof space === "string")
    : [];
  G.pending = null;
  if (!applyMetternichAlly(G, optionId)) return INVALID_MOVE;
  const next = [...picked, optionId];
  if (openMetternichChoice(G, ctx, next)) return undefined;
  return startFirstActionImpulse(G, ctx);
};

/** 5.5.3 / 5.6.2: the first impulse of the action phase. */
const startFirstActionImpulse = (G: ImperialElegyState, ctx: Ctx): undefined => {
  beginImpulseUpkeep(G, ctx, "GE");
  return undefined;
};

/** Enter the action phase (the first impulse may wait for a decision). */
const beginActionPhaseAfterDiplomacy = (G: ImperialElegyState, ctx: Ctx): string | void => {
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 0;
  G.impulseCard = null;
  G.passed = [];
  clearActionImpulseSpend(G);
  ctx.events?.setPhase?.("action");
  log(G, undefined, "actionPhaseStarted", {});
  ctx.events?.setActivePlayers?.({value: {[seatOf("GE")]: "play"}});
  // 33.4 Metternich's Legacy resolves at the end of the turn-1 diplomacy
  // phase; the AU choice is answered before Germany's first impulse starts.
  if (G.turn === 1 && !G.persistent.metternich) {
    if (openMetternichChoice(G, ctx, [])) return undefined;
  }
  return startFirstActionImpulse(G, ctx);
};

export const chooseHomeCard = (G: ImperialElegyState, ctx: Ctx, cardId: CardId): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  if (power === null || G.phase !== "diplomacy") return INVALID_MOVE;
  const p = G.powers[power];
  // 1870 Franco-Prussian branch step 5: "on the first turn, GE does not select
  // a home card".  The obligation is pre-settled as the diplomacy phase opens
  // (`game.ts#diplomacyBegin`), so this is only the guard against a stale client
  // that still offers the card.
  if (francoPrussianPrepRule(G, power).noHomeCard) {
    log(G, power, "homeCardRejected", {reasons: "The Franco-Prussian War branch skips this home card on turn 1"});
    return INVALID_MOVE;
  }
  if (!p.homeCards.includes(cardId)) return INVALID_MOVE;
  if (p.selectedHomeCard !== null) return INVALID_MOVE;
  p.selectedHomeCard = cardId;
  if (!p.hand.includes(cardId)) p.hand.push(cardId);
  p.flags.homeChosen = true;
  log(G, power, "homeCardChosen", {card: cardId});
  if (POWERS.every((x) => G.powers[x].flags.homeChosen)) {
    return beginActionPhaseAfterDiplomacy(G, ctx);
  }
  const index = POWERS.indexOf(G.activePower);
  const next = POWERS[(index + 1) % POWERS.length];
  G.activePower = next;
  ctx.events?.endTurn?.();
  return undefined;
};

export const endDiplomacy = (G: ImperialElegyState, ctx: Ctx): string | void => {
  if (G.phase !== "diplomacy") return INVALID_MOVE;
  if (!POWERS.every((x) => G.powers[x].flags.homeChosen)) return INVALID_MOVE;
  return beginActionPhaseAfterDiplomacy(G, ctx);
};

/**
 * 11.1 diplomacy gift: a power hands **one random** card to another power.
 * The giver picks the recipient, not the card — the printed gift is a random
 * draw, so a specific card can never be chosen (which would otherwise let a
 * player push a doomed or unplayable card onto an ally, or hide a card's
 * identity behind a negotiated deal).
 */
export const giveCard = (G: ImperialElegyState, ctx: Ctx, target: Power): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  if (power === null || G.phase !== "diplomacy") return INVALID_MOVE;
  if (power === target) return INVALID_MOVE;
  if (!isPower(target)) return INVALID_MOVE;
  const eligible = G.powers[power].hand.filter((id) => cardById(id).kind !== "home");
  if (eligible.length === 0) return INVALID_MOVE;
  const cardId = eligible[randomIndex(ctx, eligible.length)];
  G.powers[power].hand = G.powers[power].hand.filter((id) => id !== cardId);
  G.powers[target].hand.push(cardId);
  log(G, power, "cardGiven", {card: cardId, target});
  return undefined;
};

/**
 * A GW card that has been played is no longer faceup for the turn.  The flag is
 * public (it lives in top-level `G.flags`), so only the played power's entry is
 * removed; the other powers' faceup combat cards stay visible.
 */
const clearFaceupCombat = (G: ImperialElegyState, power: Power): void => {
  const cards = faceupCombatCards(G);
  if (cards[power] === undefined) return;
  delete cards[power];
  G.flags.gwFaceupCombat = POWERS
    .filter((p) => cards[p] !== undefined)
    .map((p) => `${p}:${cards[p]}`)
    .join(",");
};

// ------------------------------------------------------------------ actions
/**
 * Rule 15.0: "If all players consecutively pass the war is over."  A wartime
 * action breaks the run of passes, so every earlier pass is forgotten; the war
 * only ends once every belligerent passes without an action in between.
 */
const noteWartimeAction = (G: ImperialElegyState): void => {
  if (G.war) G.war.passed = [];
};

const requireCp = (G: ImperialElegyState, ctx: Ctx, playerID: PlayerID | null, amount: number): Power | typeof INVALID_MOVE => {
  // GW actions use the 27.1 allowance and wallet together, never this generic
  // action-phase payer (which would bypass the one-budget-action limit). A
  // state without the live impulse ledger (legacy save / rule test) keeps the
  // pre-27.1 payer until the next activation creates it.
  if (G.phase === "gwManeuver" && hasLiveGwImpulse(G)) return INVALID_MOVE;
  const power = requireActive(G, ctx, playerID);
  if (power === INVALID_MOVE) return INVALID_MOVE;
  if (!spendCpFor(G, power, amount)) return INVALID_MOVE;
  // The first CP of an impulse closes the response window, and a wartime
  // action breaks the run of consecutive passes (15.0).
  if (G.phase === "action") {
    G.powers[power].flags.actionCpSpentThisImpulse = true;
  } else if (G.phase === "wartime") {
    G.powers[power].flags.warCpSpentThisImpulse = true;
    noteWartimeAction(G);
  }
  return power;
};

/**
 * A088 Our Place in the Sun / UK-3 Sun Never Sets: the printed "free CP" grants
 * may only pay for colonial actions (naval movement, construct fleet,
 * expeditionary force, pacification).  This payer drains the public
 * `freeColonialCp` grant first and then the ordinary wallet, so the grant is
 * spendable instead of being a flag nothing reads.  It keeps `requireCp`'s
 * impulse bookkeeping (response window and the wartime pass run).
 */
const requireColonialCp = (
  G: ImperialElegyState,
  ctx: Ctx,
  playerID: PlayerID | null,
  amount: number,
): Power | typeof INVALID_MOVE => {
  if (G.phase === "gwManeuver" && hasLiveGwImpulse(G)) return INVALID_MOVE;
  const power = requireActive(G, ctx, playerID);
  if (power === INVALID_MOVE) return INVALID_MOVE;
  const free = freeColonialCp(G, power);
  if (!spendColonialCp(G, power, amount)) {
    // Restore the grant when the ordinary wallet could not cover the rest, so a
    // refused action never burns free CP.
    if (free > 0) G.powers[power].flags.freeColonialCp = free;
    return INVALID_MOVE;
  }
  if (G.phase === "action") {
    G.powers[power].flags.actionCpSpentThisImpulse = true;
  } else if (G.phase === "wartime") {
    G.powers[power].flags.warCpSpentThisImpulse = true;
    noteWartimeAction(G);
  }
  return power;
};

export interface RecruitOptions {
  /** OT only: build a Turkish or Arab army.  Defaults to the space's kind. */
  ottoman?: "turkish" | "arab";
  /** UK only: build an Indian army (colonial manpower). */
  indian?: boolean;
  /**
   * UK only, 33.2.1: build the Commonwealth army — colonial manpower, Great
   * War only, in Australia/New Zealand or Canada.
   */
  cw?: boolean;
}

/**
 * 12.2 / 33.2 / 33.6 recruitment.
 *
 * All "how many" and "where/which" rules live in
 * `engine/characteristics.ts#recruitmentLimits`/`canRecruitIn`; this move only
 * applies the decision, spends the CP and records the typed unit flags.  Every
 * rejection is logged with the printed reason so the player sees why a build
 * was refused (the move returns INVALID_MOVE, so no state is spent).
 */
export const recruit = (
  G: ImperialElegyState,
  ctx: Ctx,
  space: SpaceId,
  kind: "army" | "reserveArmy" | "eliteCorps",
  steps = 1,
  options: RecruitOptions = {},
): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = requireActive(G, ctx, playerID);
  if (power === INVALID_MOVE) return INVALID_MOVE;
  const p = G.powers[power];

  // A83 Liberal Reforms ("no armies may be built this impulse") is one of the
  // gates inside `canRecruitIn` below, so the UI, the Rule 34 bot and this
  // move all read the same answer.  Keeping a second copy here is what let the
  // bot name a build the helper had already called legal.

  const ottoman = power === "OT" ? options.ottoman ?? ottomanArmyTypeFor(space) : undefined;
  const cw = power === "UK" && options.cw === true;
  const indian =
    power === "UK" && !cw ? options.indian ?? (space === "india" || space === "bengal") : undefined;

  if (kind === "reserveArmy") {
    // 33.2 Professional Army: the UK has no reserve box at all.
    const limits = recruitmentLimits(G, power);
    if (!limits.reserveAllowed) {
      log(G, power, "recruitRejected", {kind, space, reasons: `${power} may not build reserve armies`});
      return INVALID_MOVE;
    }
    // 7.3 / 33.5: the box holds the lower of manpower and industry (RU's
    // Russian Steamroller +1), plus A110 Extreme Militarism's bonus — the
    // same allowance the end-phase reserve growth uses.
    if (reserveRemaining(G, power) <= 0) {
      log(G, power, "recruitRejected", {kind, space, reasons: "Reserve army allowance exhausted"});
      return INVALID_MOVE;
    }
    // 4.2: reserve armies are army counters too.
    if (!hasCounterFor(G, power, "reserveArmy")) {
      log(G, power, "recruitRejected", {kind, space, reasons: "No reserve army counter available"});
      return INVALID_MOVE;
    }
    const paid = requireCp(G, ctx, playerID, steps);
    if (paid === INVALID_MOVE) return INVALID_MOVE;
    const unit = placeUnit(G, power, "reserveArmy", null, 2);
    p.reserves.push(unit.id);
    log(G, power, "recruited", {kind, space});
    recomputeTracks(G);
    return undefined;
  }

  const decision = canRecruitIn(G, power, space, kind, {ottoman, indian, cw});
  if (!decision.allowed) {
    log(G, power, "recruitRejected", {kind, space, reasons: decision.reasons.join(" | ")});
    return INVALID_MOVE;
  }
  // 33.2.2: after independence the UK may keep only one Indian army and may
  // not add another.  `canRecruitIn` already refuses this; the move re-checks
  // the typed cap so every future caller inherits the limit.
  if (power === "UK" && indian === true) {
    const cap = indianArmyCap(G);
    const current = Object.values(G.units).filter(
      (unit) => unit.owner === "UK" && Boolean(unit.flags?.indian),
    ).length;
    if (G.powers.UK.indiaIndependent === true || current >= cap) {
      log(G, power, "recruitRejected", {
        kind,
        space,
        reasons:
          G.powers.UK.indiaIndependent === true
            ? "India is independent: no new Indian armies may be built"
            : `Indian army cap ${cap} reached`,
      });
      return INVALID_MOVE;
    }
  }

  if (kind === "eliteCorps") {
    const armies = landUnitsIn(G, space).filter((u) => isArmyKind(u.kind) && (u.owner === power || G.spaces[space].ally === power));
    if (armies.length === 0) return INVALID_MOVE;
    // 12.2 / A106: a player may field one elite corps; The Young Turks lets the
    // Ottomans field two.  Additive to the shared recruitment checks.
    const ecCap = power === "OT" && G.persistent.otTwoElite === true ? 2 : 1;
    const ecs = unitsOfPower(G, power).filter((u) => u.kind === "eliteCorps").length;
    if (ecs >= ecCap) return INVALID_MOVE;
    // 4.2: the printed chart's EC counters are the physical limit.
    if (!hasCounterFor(G, power, "eliteCorps")) {
      log(G, power, "recruitRejected", {kind, space, reasons: "No elite corps counter available"});
      return INVALID_MOVE;
    }
    const paid = requireCp(G, ctx, playerID, 2);
    if (paid === INVALID_MOVE) return INVALID_MOVE;
    placeUnit(G, power, "eliteCorps", space, 1);
    log(G, power, "recruited", {kind, space});
    return undefined;
  }
  // Agent 3 already validated the build through `canRecruitIn` (stacking,
  // home key, manpower, UK/OT pools).  Agent 4's rule-4.2 counter pool is the
  // remaining guard: a build may not create a counter the power does not own.
  // The build only upgrades a counter of the same kind it is paying for: a CW
  // build must not relabel a British army (33.2.1), and a British build must
  // not consume the colonial track by upgrading a CW army.
  const existing = landUnitsIn(G, space).filter(
    (u) => u.owner === power && u.kind === "army" && (u.flags?.cw === true) === cw,
  );
  // 12.2: a step flips a reduced army rather than adding a new counter.  Pick
  // the reduced counter itself, not the first army in the space, or a stack
  // holding a full army ahead of a reduced one would build instead of refit.
  const upgrade = existing.find((unit) => unit.steps < 2);
  // The stacking gate lives in `canRecruitIn` (called above), so the UI, the
  // bot and this move all read one answer; nothing to re-check here.
  if (upgrade === undefined && !hasCounterFor(G, power, "army")) {
    log(G, power, "recruitRejected", {kind, space, reasons: "No army counter available"});
    return INVALID_MOVE;
  }
  if (G.phase === "gwManeuver" && cw && hasLiveGwImpulse(G)) {
    // The existing Commonwealth build also consumes the printed draft action
    // allowance; it must not bypass 27.1 via the generic recruitment payer.
    const allowance = gwActionAllowance(G, power, "draft");
    if (!allowance.ok || gwAllyImpulseFor(G, power) !== null) return INVALID_MOVE;
    recordGwAction(G, power, "draft", allowance);
  } else {
    const paid = requireCp(G, ctx, playerID, steps);
    if (paid === INVALID_MOVE) return INVALID_MOVE;
  }
  if (upgrade !== undefined) {
    upgrade.steps = 2;
  } else {
    const flags: Record<string, boolean> = {};
    if (ottoman === "arab") flags.arab = true;
    if (indian === true) flags.indian = true;
    if (cw) flags.cw = true;
    placeUnit(G, power, "army", space, 2, {flags});
  }
  log(G, power, "recruited", {
    kind,
    space,
    ottoman: ottoman ?? null,
    indian: indian === true,
    cw,
  });
  recomputeTracks(G);
  return undefined;
};

/**
 * 12.8 / 22.5 — player-initiated Polish recruitment.
 *
 * The controlling player (Poland's ally marker holder) may spend CP during the
 * action phase to build Polish units: standing armies onto a Polish space with
 * a LoC, the 4th/5th reserve counters into the Polish reserve armies holding
 * box, and Poland's single elite corps.  All limits — independence, control,
 * the 22.5 spaces + 1 cap, placement, stacking, CP and the printed counter
 * mix — live in `engine/poland.ts#polishRecruitDecision`; this move only
 * applies the decision and logs it.
 */
export const polishRecruit = (
  G: ImperialElegyState,
  ctx: Ctx,
  kind: "army" | "reserveArmy" | "eliteCorps",
  space: SpaceId | null = null,
  steps: 1 | 2 = 1,
): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  const decision = polishRecruitDecision(G, power, kind, space, steps);
  if (!decision.allowed) {
    log(G, power ?? undefined, "polishRecruitRejected", {
      kind,
      space,
      reasons: decision.reasons.join(" | "),
    });
    return INVALID_MOVE;
  }
  if (power === null) return INVALID_MOVE;
  const paid = requireCp(G, ctx, playerID, decision.cost);
  if (paid === INVALID_MOVE) return INVALID_MOVE;
  const upgrade = decision.upgradeUnitId === null ? undefined : G.units[decision.upgradeUnitId];
  if (upgrade) {
    upgrade.steps = 2;
  } else if (kind === "reserveArmy") {
    const box = (G.nonPlayerBuildBox ??= initialNonPlayerBuildBox());
    const polish = (box.poland ??= {reserveArmies: []});
    const unit = placeUnit(G, POLAND, "reserveArmy", null, steps);
    polish.reserveArmies.push(unit.id);
  } else if (kind === "eliteCorps") {
    placeUnit(G, POLAND, "eliteCorps", space as SpaceId, 1);
  } else {
    placeUnit(G, POLAND, "army", space as SpaceId, steps);
  }
  log(G, power, "polishRecruited", {
    kind,
    space,
    unit: upgrade?.id,
    steps: upgrade === undefined ? steps : 1,
    cost: decision.cost,
    upgrade: upgrade !== undefined,
  });
  return undefined;
};

export const stackingLimit = (_G: ImperialElegyState, space: SpaceId, _power: Power): number =>
  landStackingLimit(space);

/**
 * 12.2 / 12.4 (March 2026 errata) + 12.8: build a land or naval unit for a
 * minor power the active player is allied to, in that minor's home space.
 * The legality, the cost and the counter cap all come from
 * `characteristics.ts#minorBuildDecision` so the Orders panel, the bot and this
 * move give the same answer.
 */
export const buildForMinor = (
  G: ImperialElegyState,
  ctx: Ctx,
  minor: string,
  kind: "army" | "squadron" | "dreadnought",
  space: SpaceId,
  steps: 1 | 2 = 1,
): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = requireActive(G, ctx, playerID);
  if (power === INVALID_MOVE) return INVALID_MOVE;
  const decision = minorBuildDecision(G, power, minor, kind, space, steps);
  if (!decision.allowed) {
    log(G, power, "minorBuildRejected", {minor, kind, space, reasons: decision.reasons.join(" | ")});
    return INVALID_MOVE;
  }
  const paid = requireCp(G, ctx, playerID, decision.cost);
  if (paid === INVALID_MOVE) return INVALID_MOVE;
  if (kind === "army") {
    const existing = landUnitsIn(G, space).find(
      (unit) => unit.owner === minor && unit.kind === "minorArmy" && unit.steps < 2,
    );
    if (existing) {
      existing.steps = 2;
    } else {
      placeNonPlayerCounter(G, minor, "minorArmy", space, steps === 2 ? 2 : 1);
    }
    log(G, power, "minorBuilt", {minor, kind, space, steps, cost: decision.cost});
    return undefined;
  }
  placeNonPlayerCounter(G, minor, kind, space, 2);
  refreshPowerProjection(G);
  log(G, power, "minorBuilt", {minor, kind, space, steps: 2, cost: decision.cost});
  return undefined;
};

export const constructFleet = (G: ImperialElegyState, ctx: Ctx, space: SpaceId, kind: "squadron" | "dreadnought", reduced = false): string | void => {
  const playerID = ctx.playerID ?? null;
  // Validate the printed placement before spending anything, so a refused
  // click never costs CP.
  const power = requireActive(G, ctx, playerID);
  if (power === INVALID_MOVE) return INVALID_MOVE;
  // A92 Naval Arms Race: the discount applies "for the rest of this turn and
  // during the next turn", tracked by the flag's expiry turn.
  const discount =
    Number(G.powers[power].flags.navalDiscount ?? 0) > 0 &&
    G.turn <= Number(G.powers[power].flags.navalDiscountThrough ?? -1)
      ? 1
      : 0;
  const baseCost = kind === "dreadnought" ? (reduced ? 2 : 3) : reduced ? 1 : 2;
  const cost = Math.max(1, baseCost - discount);
  if (!isHomeSpace(G, space, power) || !ownsKey(G, space, power)) return INVALID_MOVE;
  // 12.4: "Newly built fleets must be placed in a controlled, territorial home
  // key on the main map with a port."  A colonial home key on a submap (Canada,
  // India, South Africa, Australia) is neither territorial nor on the main map.
  // A71 can reclassify a printed territorial key (Egypt) as a colonial home
  // key, so the live type — not the static map data — decides 12.4.
  if (SPACES[space]?.submap !== "main" || effectiveKeyType(G, space) !== "territorial") return INVALID_MOVE;
  if (!portBoxes(space).length) return INVALID_MOVE;
  if (kind === "dreadnought" && G.persistent.dreadnoughts !== true && !G.powers[power].flags.navalLimit) return INVALID_MOVE;
  // 4.2: GE/AU/OT may only own 2 squadrons and 2 dreadnoughts until an event
  // (A092 Naval Arms Race) raises the cap to 4/4.
  const counter = kind === "squadron" ? "squadron" : "dreadnought";
  if (!hasCounterFor(G, power, counter)) return INVALID_MOVE;
  // 5.5.4: a port holds at most 4 naval units.
  if (navalUnitsIn(G, space).length >= PORT_NAVAL_LIMIT) return INVALID_MOVE;
  // A088/UK-3: constructing a fleet is a printed colonial action.
  const paid = requireColonialCp(G, ctx, playerID, cost);
  if (paid === INVALID_MOVE) return INVALID_MOVE;
  placeUnit(G, power, kind, space, reduced ? 1 : 2);
  // 3.3.1: the naval-unit cap on power projection changes with every new ship.
  refreshPowerProjection(G);
  log(G, power, "fleetBuilt", {space, kind});
  return undefined;
};

/**
 * 12.4 Construct Fleets: the printed chart includes "Refit Naval Unit - 1 CP".
 * "Refitting a naval unit refers to flipping it from its reduced side to its
 * full strength side. Naval units cannot refit if they are in a naval box; they
 * may only refit if they are in a friendly port."
 *
 * The Great War has its own refit action (27.5.4, `gwRefitFleet`), and 15.2
 * forbids refits during a limited war, so this is the action-phase path only.
 */
export const refitNavalUnit = (G: ImperialElegyState, ctx: Ctx, unitId: string): string | void => {
  const playerID = ctx.playerID ?? null;
  if (G.phase !== "action") return INVALID_MOVE;
  const power = actor(G, playerID);
  if (power === null || power !== G.activePower || G.pending !== null) return INVALID_MOVE;
  const unit = G.units[unitId];
  if (!unit || unit.owner !== power || unit.naval !== true || !unit.space) return INVALID_MOVE;
  if (!isNavalKind(unit.kind) || unit.steps >= 2) return INVALID_MOVE;
  const space = unit.space;
  if (!friendlyPort(G, power, space)) return INVALID_MOVE;
  const paid = requireCp(G, ctx, playerID, 1);
  if (paid === INVALID_MOVE) return INVALID_MOVE;
  unit.steps = 2;
  log(G, power, "fleetRefitted", {space, kind: unit.kind});
  return undefined;
};

/**
 * 3.4.1: the shared `navalMovement.ts#requestDardanellesPassage` opens the
 * controller's permission decision before any CP/budget is spent.  The live
 * `navalMove` preview below traces the whole planned NMP route, so a multi-box
 * move that crosses the strait on an intermediate hop still asks first.
 */

export const navalMove = (G: ImperialElegyState, ctx: Ctx, unitIds: string[], to: SpaceId): string | void => {
  const playerID = ctx.playerID ?? null;
  // 3.4.1 uses a decision, not CP: validate the request before spending
  // anything, then return so the controller can answer it.
  const preview = requireActive(G, ctx, playerID);
  if (G.phase === "gwManeuver" && hasLiveGwImpulse(G) &&
      (preview === INVALID_MOVE || !gwActionAllowance(G, preview, "naval").ok)) return INVALID_MOVE;
  if (preview !== INVALID_MOVE && Array.isArray(unitIds) && unitIds.length > 0) {
    const previewUnits = unitIds
      .map((id) => G.units[id])
      .filter((unit): unit is Unit => Boolean(unit) && unit!.owner === preview && unit!.naval === true);
    const from = previewUnits[0]?.space;
    if (previewUnits.length === unitIds.length && from && previewUnits.every((unit) => unit.space === from)) {
      // Trace the intended route with the gate open to find the strait
      // crossing, then ask the controller for permission.
      const route = planNavalMove(G, preview, from, to, {
        allowEnemyDestination: true,
        ignoreDardanellesGate: true,
      });
      if (route.ok && requestDardanellesPassage(G, ctx, preview, from, to, route.path)) {
        return undefined;
      }
    }
  }
  if (G.phase === "gwManeuver") {
    // GW naval movement is one of the flow maneuvers: it validates and spends
    // the GW budget exactly once (do not also call requireCp).
    const gwPower = actor(G, playerID);
    if (gwPower === null || !G.gw) return INVALID_MOVE;
    // 33.1 Superior Staff Work: latch GE's first GW maneuver impulse.
    markSuperiorStaffWorkGwImpulse(G);
    // 19.1 transit interception: a multi-box GW maneuver enters each box in
    // turn.  Split the maneuver at the first box adjacent to an enemy port and
    // park the fleet there for the interception window; the flow action still
    // spends its one budget point and the typed transit cursor finishes the
    // move afterwards without spending again.
    const gwUnits = unitIds
      .map((id) => G.units[id])
      .filter((unit): unit is Unit => Boolean(unit) && commandsUnit(G, gwPower, unit) && unit!.naval === true);
    const gwFrom = gwUnits[0]?.space;
    if (
      gwUnits.length === unitIds.length &&
      gwFrom !== undefined &&
      gwFrom !== null &&
      gwUnits.every((unit) => unit.space === gwFrom)
    ) {
      const contact = navalUnitsIn(G, to).some((unit) => hostileOwner(G, gwPower, unit.owner));
      const route = planNavalMove(G, gwPower, gwFrom, to, {allowEnemyDestination: contact});
      if (route.ok) {
        const transitIndex = firstTransitInterceptHop(G, gwPower, route.path);
        if (transitIndex > 0) {
          const hop = route.path[transitIndex];
          const split = performGwManeuver(G, ctx, {kind: "naval", power: gwPower, unitIds, to: hop});
          if (!split.ok) return split.pending === true ? undefined : INVALID_MOVE;
          G.navalTransit = {
            power: gwPower,
            unitIds: gwUnits.map((unit) => unit.id),
            path: [...route.path],
            index: transitIndex,
          };
          openNavalTransitInterception(G, ctx);
          return undefined;
        }
        // A destination box with enemy ports but no enemy ships in it can be
        // intercepted too; the flow's own contact path only covers a box that
        // already contains hostile ships.
        if (!contact && isNavalBox(to) && navalInterceptCandidates(G, gwPower, to).length > 0) {
          const landed = performGwManeuver(G, ctx, {kind: "naval", power: gwPower, unitIds, to});
          if (!landed.ok) return landed.pending === true ? undefined : INVALID_MOVE;
          openNavalContactDecision(G, ctx, gwPower, gwFrom, to, gwUnits.map((unit) => unit.id));
          return undefined;
        }
      }
    }
    const res = performGwManeuver(G, ctx, {kind: "naval", power: gwPower, unitIds, to});
    // A 3.4.1 permission prompt is the state change; no budget was spent.
    if (!res.ok && res.pending === true) return undefined;
    return res.ok ? undefined : INVALID_MOVE;
  }
  // A088/UK-3: naval movement is a printed colonial action.
  const power = requireColonialCp(G, ctx, playerID, 1);
  if (power === INVALID_MOVE) return INVALID_MOVE;
  const units = unitIds.map((id) => G.units[id]).filter((u): u is Unit => u !== undefined && u.owner === power && u.naval === true);
  if (units.length === 0) return INVALID_MOVE;
  const from = units[0].space;
  if (!from) return INVALID_MOVE;
  // Every activated stack moves together and must start in the same space.
  if (units.some((u) => u.space !== from)) return INVALID_MOVE;
  // Rule 12.3: one NMP, traced through connected boxes and ports.  Ending in a
  // space with enemy ships is a contact battle (19.0); the enemy space is never
  // a stepping stone.
  const plan = planNavalMove(G, power, from, to, {allowEnemyDestination: true});
  if (!plan.ok) return INVALID_MOVE;
  const defenders = navalUnitsIn(G, to).filter((unit) => hostileOwner(G, power, unit.owner));
  if (defenders.length > 0) {
    // 5.5.4: "players can only attack a port space with a maximum of 4 naval
    // units."  A contacted port's defenders are not counted against the
    // attacker's move; a pure move must respect the port's own capacity.
    if (!isNavalBox(to) && units.length > PORT_NAVAL_LIMIT) return INVALID_MOVE;
  } else if (movementEndProblem(G, to, units) !== null) {
    // 5.5.3 / 5.5.4: units may pass through an overstacked space, but cannot
    // end their movement there.
    return INVALID_MOVE;
  }
  // 19.1: "when the active player's units move into a naval box that is
  // connected to a port containing enemy naval units, those enemy naval units
  // may attempt to intercept them".  A multi-box move enters each box in turn,
  // so the first intermediate box with an adjacent enemy port interrupts the
  // move there; the typed transit cursor finishes it after the window.
  const transitIndex = firstTransitInterceptHop(G, power, plan.path);
  if (transitIndex > 0) {
    const hop = plan.path[transitIndex];
    const hopFrom = plan.path[transitIndex - 1];
    for (const u of units) {
      G.spaces[from].units = G.spaces[from].units.filter((id) => id !== u.id);
      G.spaces[hop].units.push(u.id);
      u.space = hop;
    }
    G.navalTransit = {
      power,
      unitIds: units.map((u) => u.id),
      path: [...plan.path],
      index: transitIndex,
    };
    log(G, power, "navalMove", {
      from: hopFrom,
      to: hop,
      count: units.length,
      path: plan.path.slice(0, transitIndex + 1).join(","),
      nmp: plan.cost,
      transit: true,
    });
    openNavalTransitInterception(G, ctx);
    return undefined;
  }
  for (const u of units) {
    G.spaces[from].units = G.spaces[from].units.filter((id) => id !== u.id);
    G.spaces[to].units.push(u.id);
    u.space = to;
  }
  log(G, power, "navalMove", {from, to, count: units.length, path: plan.path.join(","), nmp: plan.cost});
  // 19.1 interception first, then 19.2 avoidance.  A *destination* box whose
  // adjacent enemy ports can intercept opens the same window even when no
  // enemy ships are in the box; a port destination keeps the 19.2 chain.
  const interceptAtDestination = isNavalBox(to) && navalInterceptCandidates(G, power, to).length > 0;
  if ((defenders.length > 0 || interceptAtDestination) && G.battle === null) {
    openNavalContactDecision(G, ctx, power, from, to, unitIds);
  }
  return undefined;
};

export type NavalTransportBlockReason =
  | NavalTransportReason
  | "no-seat"
  | "busy"
  | "phase"
  | "not-active"
  | "no-budget"
  | "us-north-america";

export interface NavalTransportCheck {
  ok: boolean;
  reason?: NavalTransportBlockReason;
  from?: SpaceId;
  path?: SpaceId[];
  /** 32.1 detail when the US army gate refuses the transport. */
  usRequired?: SpaceId[];
  usUnoccupied?: SpaceId[];
}

/** Charge one GW maneuver action against the phase's CP wallet (26.3). */
const spendGwManeuverBudget = (G: ImperialElegyState, power: Power): boolean => {
  if (!hasLiveGwImpulse(G)) {
    // Pre-27.1 wallet: one CP per action, with the legacy action count that
    // `currentGwImpulse` reads when such a save is resumed.
    if (!spendCpFor(G, power, 1)) return false;
    G.powers[power].flags.gwActionsThisImpulse = Number(G.powers[power].flags.gwActionsThisImpulse ?? 0) + 1;
    return true;
  }
  const allowance = gwActionAllowance(G, power, "naval");
  if (!allowance.ok) return false;
  recordGwAction(G, power, "naval", allowance);
  return true;
};

/** True when `power` may move `unit`: its own, or a US/Italian GW major's. */
const commandsUnit = (G: ImperialElegyState, power: Power, unit: Unit | undefined): boolean => {
  if (!unit) return false;
  const major = gwAllyImpulseFor(G, power);
  if (major !== null) return unit.owner === major;
  if (unit.owner === power) return true;
  // 15.4: controlled minors contribute ordinary army/fleet counters only;
  // elite corps/fleets are not army counters and cannot be carried.
  if (isPower(unit.owner) || unit.owner === "US" || unit.owner === "IT") return false;
  return (isArmyKind(unit.kind) || isNavalKind(unit.kind)) && minorController(G, unit.owner) === power;
};

/**
 * Non-mutating 12.3 transport legality, shared with the board control.
 *
 * `planNavalTransport` owns the pure movement/stacking rules; this function
 * adds the live-phase, budget and 32.1 US-exit gates so the button and the move
 * always agree.
 */
export const navalTransportCheck = (
  G: ImperialElegyState,
  power: Power,
  landUnitId: string,
  navalUnitIds: readonly string[],
  to: SpaceId,
): NavalTransportCheck => {
  if (G.pending !== null || G.battle !== null) return {ok: false, reason: "busy"};
  if (G.phase === "action") {
    if (G.activePower !== power) return {ok: false, reason: "not-active"};
  } else if (G.phase === "wartime") {
    if (!G.war || G.war.status !== "maneuver") return {ok: false, reason: "phase"};
    if (G.activePower !== power) return {ok: false, reason: "not-active"};
  } else if (G.phase === "gwManeuver") {
    if (!G.gw?.active) return {ok: false, reason: "phase"};
    if (G.activePower !== power) return {ok: false, reason: "not-active"};
  } else {
    return {ok: false, reason: "phase"};
  }
  if (G.phase === "gwManeuver" ? !gwActionAllowance(G, power, "naval").ok : cpBudgetFor(G, power) < 1) {
    return {ok: false, reason: "no-budget"};
  }
  const land = G.units[landUnitId];
  const fleet = (Array.isArray(navalUnitIds) ? [...navalUnitIds] : []).map((id) => G.units[id]);
  if (!commandsUnit(G, power, land)) return {ok: false, reason: "land-unit"};
  if (fleet.some((unit) => !commandsUnit(G, power, unit))) return {ok: false, reason: "naval-unit"};
  const plan = planNavalTransport(G, power, land, fleet, to);
  if (!plan.ok) {
    return {ok: false, reason: plan.reason === "ok" ? "path" : plan.reason, from: plan.from ?? undefined, path: plan.path};
  }
  // 32.1: a US army may not leave the North America submap while an enemy-held
  // Mexico/Canada gate remains unoccupied.
  if (land && !usArmyMayLeaveNorthAmerica(G, land, to)) {
    const exit = usCanLeaveNorthAmerica(G);
    return {
      ok: false,
      reason: "us-north-america",
      from: plan.from ?? undefined,
      path: plan.path,
      usRequired: exit.required,
      usUnoccupied: exit.unoccupied,
    };
  }
  return {ok: true, from: plan.from ?? undefined, path: plan.path};
};

/**
 * 12.3: one land unit may move with the fleet.
 *
 * The pure planner in `engine/navalMovement.ts` owns the printed path and
 * capacity rules; this wrapper adds the live-window checks (seat, phase,
 * pending), the 32.1 US exit guard and the CP/budget spend.  A US army leaving
 * the North America submap is refused while an enemy-held Mexico/Canada gate
 * remains unoccupied, with the printed reason logged.
 */
export const navalTransport = (
  G: ImperialElegyState,
  ctx: Ctx,
  landUnitId: string,
  navalUnitIds: string[],
  to: SpaceId,
): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  if (power === null) return INVALID_MOVE;
  const check = navalTransportCheck(G, power, landUnitId, navalUnitIds, to);
  if (!check.ok) {
    if (check.reason === "us-north-america") {
      log(G, power, "gwUsNorthAmericaBlocked", {
        unitIds: landUnitId,
        to,
        required: (check.usRequired ?? []).join(","),
        unoccupied: (check.usUnoccupied ?? []).join(","),
      });
    }
    return INVALID_MOVE;
  }
  // 12.3: the action costs one CP (the NMP is part of the action, not extra).
  if (G.phase === "gwManeuver") {
    if (!spendGwManeuverBudget(G, power)) return INVALID_MOVE;
  } else {
    const paid = requireCp(G, ctx, playerID, 1);
    if (paid === INVALID_MOVE) return INVALID_MOVE;
  }
  const from = check.from!;
  const path = check.path ?? [];
  const fleetIds = Array.isArray(navalUnitIds) ? navalUnitIds : [];
  const land = G.units[landUnitId];
  const fleet = fleetIds.map((id) => G.units[id]).filter((unit): unit is Unit => unit !== undefined);
  const carried: Unit[] = [land, ...fleet];
  // 12.3 + 19.1: "The land unit can move through naval boxes as if it was a
  // naval unit (they are considered to be on transports) ... units moving by
  // sea can be intercepted during wartime."  The transport enters each box on
  // the 12.3 NMP path, so an enemy port adjacent to an intermediate box may
  // intercept the whole stack there.  Park it and reuse the shared transit
  // cursor; `advanceNavalTransit` finishes the landing after the window.
  const transitIndex = firstTransitInterceptHop(G, power, path);
  if (transitIndex > 0) {
    const hop = path[transitIndex];
    for (const unit of carried) moveUnitToSpace(G, unit, hop);
    G.navalTransit = {
      power,
      unitIds: carried.map((unit) => unit.id),
      path: [...path],
      index: transitIndex,
    };
    log(G, power, "navalTransport", {
      from,
      to: hop,
      unit: landUnitId,
      naval: fleetIds.join(","),
      count: carried.length,
      path: path.slice(0, transitIndex + 1).join(","),
      transit: true,
    });
    openNavalTransitInterception(G, ctx);
    return undefined;
  }
  for (const unit of carried) moveUnitToSpace(G, unit, to);
  // 15.3: the carried land unit can occupy the destination port.
  recordOccupation(G, to);
  log(G, power, "navalTransport", {
    from,
    to,
    unit: landUnitId,
    naval: fleetIds.join(","),
    count: carried.length,
    path: path.join(","),
  });
  return undefined;
};

/**
 * 33.2 Rapid Deployment: "When the UK enters a war (including the GW) they may
 * immediately conduct one free naval movement action. Land units using this
 * movement must end their movement in a friendly port."
 *
 * The grant is typed on `PowerState.rapidDeployment` (effects.ts grants it when
 * the UK enters a war or the GW).  This move is the free naval movement action:
 * it never spends CP or GW budget, it uses the same NMP/path validation as a
 * normal naval move, and it is optional (`declineRapidDeployment`).
 *
 * Land units: the free action still moves naval units only.  The printed "land
 * units must end in a friendly port" clause belongs to the separate 12.3
 * `navalTransport` move, which is a normal 1 CP action; this free grant does
 * not carry land units (documented simplification).
 */
export const rapidDeploy = (
  G: ImperialElegyState,
  ctx: Ctx,
  unitIds: string[],
  to: SpaceId,
): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  if (power !== "UK") return INVALID_MOVE;
  if (G.pending !== null || G.battle !== null) return INVALID_MOVE;
  if (!canUseRapidDeployment(G, power)) return INVALID_MOVE;
  const grant = G.powers.UK.rapidDeployment!;
  if (G.activePower !== "UK") return INVALID_MOVE;
  if (G.phase === "wartime") {
    if (grant.scope !== "limited" || !G.war || !belligerentsOf(G.war).includes("UK")) return INVALID_MOVE;
  } else if (G.phase === "gwManeuver") {
    if (grant.scope !== "gw" || !G.gw?.active || !G.gw.belligerents.includes("UK")) return INVALID_MOVE;
  } else {
    return INVALID_MOVE;
  }
  if (!Array.isArray(unitIds) || unitIds.length === 0) return INVALID_MOVE;
  const units = unitIds
    .map((id) => G.units[id])
    .filter((unit): unit is Unit => unit !== undefined && unit.owner === "UK" && unit.naval === true);
  if (units.length !== unitIds.length) return INVALID_MOVE;
  const from = units[0].space;
  if (!from || units.some((unit) => unit.space !== from)) return INVALID_MOVE;
  // Reuse the 12.3 free-naval destination rules: NMP path, friendly port, no
  // enemy units, no enemy fort.
  const destinations = freeNavalDestinations(G, power, units[0]);
  if (!destinations.includes(to)) {
    // 3.4.1: the free naval move needs the Dardanelles controller's permission
    // just like a paid naval move; ask before spending the grant, then the
    // player repeats the same free action.
    const from = units[0].space;
    if (from && freeNavalDardanellesDestinations(G, power, units[0]).includes(to)) {
      const route = planNavalMove(G, power, from, to, {ignoreDardanellesGate: true});
      if (route.ok && requestDardanellesPassage(G, ctx, power, from, to, route.path)) return undefined;
    }
    return INVALID_MOVE;
  }
  for (const unit of units) {
    G.spaces[from].units = G.spaces[from].units.filter((id) => id !== unit.id);
    G.spaces[to].units.push(unit.id);
    unit.space = to;
  }
  // The free naval move is still a wartime action (15.0): it breaks the run of
  // consecutive passes.
  if (G.phase === "wartime") noteWartimeAction(G);
  G.powers.UK.rapidDeployment = {...grant, spent: true};
  log(G, power, "rapidDeployment", {from, to, count: units.length, scope: grant.scope});
  return undefined;
};

/** 33.2 Rapid Deployment is optional: decline the free naval movement action. */
export const declineRapidDeployment = (G: ImperialElegyState, ctx: Ctx): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  if (power !== "UK") return INVALID_MOVE;
  if (G.pending !== null) return INVALID_MOVE;
  if (!canUseRapidDeployment(G, power)) return INVALID_MOVE;
  if (G.activePower !== "UK") return INVALID_MOVE;
  if (G.phase !== "wartime" && G.phase !== "gwManeuver") return INVALID_MOVE;
  G.powers.UK.rapidDeployment = {...G.powers.UK.rapidDeployment!, spent: true};
  return undefined;
};

export const buildEf = (G: ImperialElegyState, ctx: Ctx, space: SpaceId, existing?: string): string | void => {
  const playerID = ctx.playerID ?? null;
  // 12.10: validate the printed destination before spending anything, so a
  // refused click costs no CP.  The same predicate is read by the Orders panel.
  const power = requireActive(G, ctx, playerID);
  if (power === INVALID_MOVE) return INVALID_MOVE;
  if (!efDestinationAllowed(G, space, power)) return INVALID_MOVE;
  // A088/UK-3: an expeditionary force is a colonial action, so the free
  // colonial grant may pay for it first.
  const paid = requireColonialCp(G, ctx, playerID, existing ? 1 : 2);
  if (paid === INVALID_MOVE) return INVALID_MOVE;
  if (existing) {
    const unit = G.units[existing];
    if (!unit || unit.kind !== "expeditionary" || unit.owner !== power) return INVALID_MOVE;
    if (unit.space) G.spaces[unit.space].units = G.spaces[unit.space].units.filter((id) => id !== existing);
    unit.space = space;
    G.spaces[space].units.push(existing);
  } else {
    // 4.2: a new EF is a counter the power must own.
    if (!hasCounterFor(G, power, "expeditionary")) return INVALID_MOVE;
    placeUnit(G, power, "expeditionary", space, 1);
  }
  G.spaces[space].pacification = G.spaces[space].pacification ?? 0;
  log(G, power, "expeditionary", {space});
  return undefined;
};

export const placeInfluence = (G: ImperialElegyState, ctx: Ctx, space: SpaceId): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = requireCp(G, ctx, playerID, 1);
  if (power === INVALID_MOVE) return INVALID_MOVE;
  if (G.powers[power].flags.alreadyInfluenced) return INVALID_MOVE;
  // 12.5.1 / 12.5.2 / 5.6: uncontrolled space, one marker, the African cap and
  // the LoC.  One shared gate, so the Orders panel cannot promise otherwise.
  if (influencePlacementProblem(G, power, space) !== null) return INVALID_MOVE;
  const state = G.spaces[space];
  state.influence = power;
  G.powers[power].flags.alreadyInfluenced = true;
  log(G, power, "influencePlaced", {space});
  return undefined;
};

export const placeDiplomacy = (G: ImperialElegyState, ctx: Ctx, space: SpaceId): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = requireCp(G, ctx, playerID, 1);
  if (power === INVALID_MOVE) return INVALID_MOVE;
  if (G.powers[power].flags.alreadyInfluenced) return INVALID_MOVE;
  // 12.5.3 (with 4.6.2's minor-power definition, Meiji, Qing and the ACW).
  // 5.6 requires a LoC only for influence, so this path traces none.
  if (diplomacyPlacementProblem(G, space) !== null) return INVALID_MOVE;
  const state = G.spaces[space];
  state.diplomacy = power;
  G.powers[power].flags.alreadyInfluenced = true;
  log(G, power, "diplomacyPlaced", {space});
  return undefined;
};

export const removeInfluence = (G: ImperialElegyState, ctx: Ctx, space: SpaceId): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = requireCp(G, ctx, playerID, 1);
  if (power === INVALID_MOVE) return INVALID_MOVE;
  if (G.powers[power].flags.alreadyRemovedInfluence) return INVALID_MOVE;
  // 12.6: own markers only; the Africa exception and the foreign-unit bar are
  // printed against influence and live in the shared gate.
  if (removeMarkerProblem(G, power, space) !== null) return INVALID_MOVE;
  const state = G.spaces[space];
  if (state.influence === power) state.influence = null;
  if (state.diplomacy === power) state.diplomacy = null;
  G.powers[power].flags.alreadyRemovedInfluence = true;
  return undefined;
};

export const minorAlliance = (G: ImperialElegyState, ctx: Ctx, space: SpaceId): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = requireCp(G, ctx, playerID, 3);
  if (power === INVALID_MOVE) return INVALID_MOVE;
  // Rule 12.8, including 4.2.1's five-ally cap and 4.6.2's "the US and a
  // unified Italy are not minor powers".
  if (minorAllianceProblem(G, power, space) !== null) return INVALID_MOVE;
  const state = G.spaces[space];
  state.ally = power;
  state.diplomacy = null;
  log(G, power, "minorAlliance", {space});
  return undefined;
};

export const removeMinorAlliance = (G: ImperialElegyState, ctx: Ctx, space: SpaceId): string | void => {
  const playerID = ctx.playerID ?? null;
  // 12.9 prints 4 CP; 12.9.1 lets a player with naval supremacy in an adjacent
  // naval box do the same action for 3 CP.
  const power = requireActive(G, ctx, playerID);
  if (power === INVALID_MOVE) return INVALID_MOVE;
  // The space gate runs before the wallet so a refusal here costs nothing.
  if (removeMinorAllianceProblem(G, space) !== null) return INVALID_MOVE;
  const cost = removeAllianceCost(G, power, space);
  if (!spendCpFor(G, power, cost)) return INVALID_MOVE;
  if (G.phase === "action") {
    G.powers[power].flags.actionCpSpentThisImpulse = true;
  } else if (G.phase === "wartime") {
    G.powers[power].flags.warCpSpentThisImpulse = true;
    noteWartimeAction(G);
  }
  // 12.9: "Flip any one ally marker on a minor power to its diplomacy side."
  // The diplomacy side keeps the player the alliance belonged to, not the one
  // who paid to flip it.
  const state = G.spaces[space];
  const previous = state.ally;
  state.ally = null;
  state.diplomacy = previous;
  log(G, power, "minorAllianceRemoved", {space, previous, cost});
  return undefined;
};

export const pacify = (
  G: ImperialElegyState,
  ctx: Ctx,
  space: SpaceId,
  a065?: "marker" | "rebel",
): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = requireActive(G, ctx, playerID);
  if (power === INVALID_MOVE) return INVALID_MOVE;
  if (isIndependentIndia(G, space)) return INVALID_MOVE;
  const state = G.spaces[space];
  if (!state) return INVALID_MOVE;
  if (state.influence !== power) return INVALID_MOVE;
  if (G.powers[power].flags[`pacified_${space}`]) return INVALID_MOVE;
  // 33.4 Continental Power / 33.1 Continental Focus: pacification costs 2 CP.
  const cost = pacificationCost(G, power);
  // Validate A65 before spending anything, so a wrong/stale row costs nothing.
  if (a065 !== undefined && !G.powers[power].hand.includes("IE-A065")) return INVALID_MOVE;
  // A088/UK-3: pacification is one of the printed colonial actions, so the free
  // colonial grant may pay for it first.
  const paid = requireColonialCp(G, ctx, playerID, cost.cost);
  if (paid === INVALID_MOVE) return INVALID_MOVE;
  // 9.1.3 / A65: "Play prior to a pacification roll."  The roll is immediate,
  // so the printed window is this move's optional `a065` argument (the board
  // offers one row per printed effect).  A65 is never a generic impulse
  // response; see `responseTriggerBlock`.
  if (a065 !== undefined) {
    const p = G.powers[power];
    p.hand = p.hand.filter((id) => id !== "IE-A065");
    discardCard(G, power, "IE-A065");
    if (a065 === "marker") {
      state.pacification = Math.max(0, (state.pacification ?? 0) - 1);
    } else {
      const rebel = landUnitsIn(G, space).find((unit) => unit.kind === "rebelArmy" && unit.steps === 1);
      if (rebel) rebel.steps = 2;
    }
    drawCards(G, ctx, power, 1);
    log(G, power, "responsePlayed", {card: "IE-A065"});
  }
  return rollPacification(G, ctx, power, space, cost.cost);
};

/** The printed 12.10 roll itself, after the CP and any A65 window are paid. */
const rollPacification = (G: ImperialElegyState, ctx: Ctx, power: Power, space: SpaceId, cost: number): void => {
  const state = G.spaces[space];
  const value = state.pacification ?? 0;
  // 33.3 Zouaves / A78 elite colonial EF: an elite colonial unit in the space
  // adds its printed +1 pacification DRM.
  const modifier = pacificationModifier(G, power, space);
  const roll =
    die(ctx, 6) + die(ctx, 6) + value + (hasAdjacentNaval(G, power, space) ? 1 : 0) + modifier.drm;
  G.powers[power].flags[`pacified_${space}`] = true;
  if (roll >= 10) {
    setSpaceControl(G, space, power, {clearInfluence: true});
    state.pacification = 0;
    log(G, power, "pacified", {space, roll, cost});
  } else {
    state.pacification = value + 1;
    log(G, power, "pacificationFailed", {space, roll, cost});
  }
};

const hasAdjacentNaval = (G: ImperialElegyState, power: Power, space: SpaceId): boolean =>
  (SPACES[space]?.ports ?? []).some((box) => navalUnitsIn(G, box).some((u) => u.owner === power));

/**
 * 12.1 Construct Fort: "1–2 CP; fort level = CP spent, max 3 forts per player,
 * a fort can be upgraded for 1 CP (not to level 3)."
 *
 * Placement follows the printed card that places a fort without a battle
 * ("a friendly controlled space"): a new fort needs a European space the acting
 * power controls or occupies with one of its own land units.  That gate is what
 * keeps a great power from dropping a fort into another power's capital or an
 * unallied minor's home space, which the move previously allowed.
 *
 * A space that already holds a fort is either the acting power's (the action is
 * then the printed 1 CP upgrade, capped at level 2) or someone else's (refused).
 */
export const buildFort = (G: ImperialElegyState, ctx: Ctx, space: SpaceId, level: 1 | 2 = 1): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = requireActive(G, ctx, playerID);
  if (power === INVALID_MOVE) return INVALID_MOVE;
  if (SPACES[space]?.region !== "europe") return INVALID_MOVE;
  const existing = G.spaces[space]?.fort ?? null;
  if (existing !== null) {
    if (existing.power !== power) return INVALID_MOVE;
    // 12.1's upgrade: 1 CP, one level, never to level 3.
    if (level !== 1 || existing.level >= 2) return INVALID_MOVE;
    const paid = requireCp(G, ctx, playerID, 1);
    if (paid === INVALID_MOVE) return INVALID_MOVE;
    existing.level = (existing.level + 1) as 1 | 2;
    log(G, power, "fortUpgraded", {space, level: existing.level});
    return undefined;
  }
  if (G.powers[power].flags[`fort_${space}`]) return INVALID_MOVE;
  const occupied = landUnitsIn(G, space).some((unit) => unit.owner === power);
  if (G.spaces[space]?.control !== power && !occupied) return INVALID_MOVE;
  const forts = Object.values(G.spaces).filter((s) => s.fort?.power === power).length;
  if (forts >= 3) return INVALID_MOVE;
  const paid = requireCp(G, ctx, playerID, level);
  if (paid === INVALID_MOVE) return INVALID_MOVE;
  G.spaces[space].fort = {power, level};
  G.powers[power].flags[`fort_${space}`] = true;
  log(G, power, "fortBuilt", {space, level});
  return undefined;
};

export const industrialize = (G: ImperialElegyState, ctx: Ctx, cardId: CardId): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  if (power === null || G.phase !== "action") return INVALID_MOVE;
  const p = G.powers[power];
  if (G.pending !== null || p.industryCard !== null) return INVALID_MOVE;
  // 12.14: CP chained cards cannot be used to industrialize.
  if (p.cpChain.includes(cardId)) return INVALID_MOVE;
  if (!p.hand.includes(cardId)) return INVALID_MOVE;
  const card = cardById(cardId);
  // Mandatory events (and the mandatory response) may be placed into the
  // Industry Card slot like any other card; doing so spends the impulse.
  // 12.13: a home card in hand is playable for CP or as its event, and may also
  // be the turn's industrialization card.  Only the selected home card is live.
  if (card.kind === "home" && p.selectedHomeCard !== cardId) return INVALID_MOVE;
  // 33.6 Europeanization: the Ottomans may not play their own card to
  // industrialize (the 6+ target is applied at the end phase).
  const industry = industryRoll(G, power, card.cp, {cardOwner: power, cardId});
  if (!industry.allowed) {
    log(G, power, "industrializeRejected", {card: cardId, reasons: industry.reasons.join(" | ")});
    return INVALID_MOVE;
  }
  p.hand = p.hand.filter((id) => id !== cardId);
  p.industryCard = cardId;
  if (p.selectedHomeCard === cardId) p.selectedHomeCard = null;
  log(G, power, "industrializeCard", {card: cardId});
  G.cpRemaining = 0;
  finishImpulse(G, ctx);
  return undefined;
};

// ------------------------------------------------- national characteristics
export type AuSpecialAction = "reforms" | "expandCitizenship" | "incorporate";

/**
 * AU special actions (33.4), each costing 3 CP in the action phase:
 *  - Reforms grants one eligible nationality its rights;
 *  - Expand Citizenship rolls for full citizenship (3+, +1 difficulty per
 *    existing citizen, optional -1 stability for +2 DRM);
 *  - Incorporate takes control of an allied minor power that has a nationality
 *    with full citizenship.
 */
export const auAction = (
  G: ImperialElegyState,
  ctx: Ctx,
  action: AuSpecialAction,
  target: string,
  sacrificeStability = false,
): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = requireActive(G, ctx, playerID);
  if (power === INVALID_MOVE) return INVALID_MOVE;
  if (power !== "AU" || G.phase !== "action") return INVALID_MOVE;

  if (action === "reforms") {
    const decision = auRightsDecision(G, target);
    if (!decision.allowed) {
      log(G, "AU", "auActionRejected", {action, nationality: target, reasons: decision.reasons.join(" | ")});
      return INVALID_MOVE;
    }
    const paid = requireCp(G, ctx, playerID, 3);
    if (paid === INVALID_MOVE) return INVALID_MOVE;
    G.powers.AU.rights.push(target);
    log(G, "AU", "auRightsGranted", {nationality: target});
    return undefined;
  }

  if (action === "expandCitizenship") {
    const decision = canGrantCitizenship(G, "AU", target, {sacrificeStability});
    if (!decision.allowed) {
      log(G, "AU", "auActionRejected", {action, nationality: target, reasons: decision.reasons.join(" | ")});
      return INVALID_MOVE;
    }
    const paid = requireCp(G, ctx, playerID, 3);
    if (paid === INVALID_MOVE) return INVALID_MOVE;
    // 33.4.1: the stability sacrifice is optional and paid before the roll.
    if (decision.requiresStabilityLoss) changeStability(G, "AU", -1, ctx);
    const roll = die(ctx, 6);
    const success = roll >= decision.rollNeeded;
    if (success) grantAuCitizenship(G, target);
    log(G, "AU", "auCitizenshipRoll", {
      nationality: target,
      roll,
      needed: decision.rollNeeded,
      success,
      stabilitySpent: decision.requiresStabilityLoss,
    });
    return undefined;
  }

  if (action === "incorporate") {
    const decision = auIncorporateDecision(G, target);
    if (!decision.allowed) {
      log(G, "AU", "auActionRejected", {action, space: target, reasons: decision.reasons.join(" | ")});
      return INVALID_MOVE;
    }
    const paid = requireCp(G, ctx, playerID, 3);
    if (paid === INVALID_MOVE) return INVALID_MOVE;
    const state = G.spaces[decision.space];
    setSpaceControl(G, decision.space, "AU");
    state.homeOverride = "AU";
    state.ally = null;
    state.diplomacy = null;
    if (decision.minor !== null) {
      for (const id of Object.keys(G.units)) {
        if (G.units[id].owner === decision.minor) removeUnit(G, id);
      }
    }
    recomputeTracks(G);
    log(G, "AU", "auIncorporated", {space: decision.space, minor: decision.minor, nationality: decision.nationality});
    return undefined;
  }

  return INVALID_MOVE;
};

/**
 * 33.3 The Zouaves: rebuild the eliminated Zouave in Algeria for 1 CP during
 * the action phase.  The free rebuild at the start of a Prep Phase is applied
 * by `applyPrepCharacteristics`.
 */
export const rebuildZouave = (G: ImperialElegyState, ctx: Ctx): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = requireActive(G, ctx, playerID);
  if (power === INVALID_MOVE) return INVALID_MOVE;
  if (power !== "FR" || G.phase !== "action") return INVALID_MOVE;
  if (Object.values(G.units).some((u) => u.kind === "zouave" && u.owner === "FR")) {
    log(G, "FR", "zouaveRebuildRejected", {reasons: "The Zouaves are already in play"});
    return INVALID_MOVE;
  }
  const paid = requireCp(G, ctx, playerID, 1);
  if (paid === INVALID_MOVE) return INVALID_MOVE;
  placeUnit(G, "FR", "zouave", "algeria", 1);
  log(G, "FR", "zouaveRebuilt", {space: "algeria", free: false});
  return undefined;
};

/** Unit kinds a controlled allied minor may contribute to the controller's TSRR rail move. */
const TSRR_MINOR_ARMY_KINDS: readonly Unit["kind"][] = ["army", "reserveArmy", "minorArmy"];

/**
 * 15.4 + 15.2.5: "Minor powers that are allied to a player move as part of
 * their controlling player's ... rail ... actions", and the TSRR exception
 * lets the RU player and players allied to RU rail 1 army along the line per
 * impulse.  A controlled minor's army is therefore the controller's army for
 * that allowance, which `characteristics.ts#tsrrRail` (a per-power check) does
 * not model.
 *
 * 12.8 confines a player's control of an allied minor's units to **wartime**,
 * so the wrapper only applies in a wartime impulse.  It reuses the core
 * decision and removes only the ownership reason; every other 33.5 condition
 * (TSRR complete, RU/RU-ally eligibility, route, friendly destination and the
 * once-per-impulse flag) still comes from `tsrrRail`.  Returns null when the
 * unit is not a minor army controlled by `power` (the caller then falls back to
 * the unmodified `tsrrRail`).
 */
export const tsrrMinorRailDecision = (
  G: ImperialElegyState,
  power: Power,
  unitId: string,
  to: SpaceId,
): TsrrRailDecision | null => {
  const unit = G.units[unitId];
  if (!unit || isPower(unit.owner)) return null;
  if (minorController(G, unit.owner) !== power) return null;
  const base = tsrrRail(G, power, unitId, to);
  const reasons = base.reasons.filter((reason) => reason !== "The unit is not owned by this power");
  if (G.phase !== "wartime") reasons.push("An allied minor's army may only rail during wartime (12.8)");
  if (!TSRR_MINOR_ARMY_KINDS.includes(unit.kind)) reasons.push("Only one army may be railed");
  return {...base, allowed: reasons.length === 0, reasons};
};

/**
 * 33.5 Trans-Siberian Railroad: one free army rail move along the line per
 * impulse (RU, and RU's allies during wartime).  The route and legality live
 * in `engine/characteristics.ts#tsrrRail`; a controlled allied minor's army is
 * carried through `tsrrMinorRailDecision` above (15.4).
 */
export const tsrrRailMove = (G: ImperialElegyState, ctx: Ctx, unitId: string, to: SpaceId): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = requireActive(G, ctx, playerID);
  if (power === INVALID_MOVE) return INVALID_MOVE;
  const decision = tsrrMinorRailDecision(G, power, unitId, to) ?? tsrrRail(G, power, unitId, to);
  if (!decision.allowed) {
    log(G, power, "tsrrRailRejected", {unitId, to, reasons: decision.reasons.join(" | ")});
    return INVALID_MOVE;
  }
  const unit = G.units[unitId];
  const from = unit.space ?? null;
  if (from) G.spaces[from].units = G.spaces[from].units.filter((id) => id !== unitId);
  G.spaces[to].units.push(unitId);
  unit.space = to;
  // 15.3: a railed army (a controlled minor's army, 15.4) occupies the space.
  recordOccupation(G, to);
  G.powers[power].flags.tsrrRailImpulse = tsrrImpulseKey(G);
  log(G, power, "tsrrRail", {unitId, from: decision.from, to});
  return undefined;
};

/**
 * 33.6 Jihad: spend one marker before the dice to give the opponent -1 in an
 * OT home / Caucasus / Great Game land battle.
 */
export const useJihad = (G: ImperialElegyState, ctx: Ctx): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  if (power === null || power !== "OT") return INVALID_MOVE;
  const decision = jihadUse(G, power, G.battle);
  if (!decision.allowed || G.battle === null || decision.opponentSide === null) {
    log(G, "OT", "jihadRejected", {reasons: decision.reasons.join(" | ")});
    return INVALID_MOVE;
  }
  const battle = G.battle;
  G.powers.OT.jihad = Math.max(0, (G.powers.OT.jihad ?? 1) - 1);
  if (decision.opponentSide === "attacker") battle.attackerDrm -= 1;
  else battle.defenderDrm -= 1;
  if (battle.attackDrmTotal !== undefined) {
    if (decision.opponentSide === "attacker") battle.attackDrmTotal -= 1;
    else battle.defenceDrmTotal = (battle.defenceDrmTotal ?? 0) - 1;
  }
  battle.jihadUsed = true;
  log(G, "OT", "jihadUsed", {space: battle.to, opponent: decision.opponent, markers: G.powers.OT.jihad});
  return undefined;
};

export const cpChain = (G: ImperialElegyState, ctx: Ctx, cardId: CardId): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  if (power === null || G.phase !== "action" || G.pending !== null) return INVALID_MOVE;
  const p = G.powers[power];
  if (p.cpChain.length >= CP_CHAIN_MAX_CARDS) return INVALID_MOVE;
  if (!p.hand.includes(cardId)) return INVALID_MOVE;
  const card = cardById(cardId);
  p.hand = p.hand.filter((id) => id !== cardId);
  p.cpChain.push(cardId);
  log(G, power, "cpChained", {card: cardId});
  // 12.14: a mandatory event played into the chain still triggers, controlled
  // by the active player.  Triggering it now (rather than when the banked CP
  // is later drawn) matches the rule text "played into the CP chain".
  if (card.type === "mandatory" || card.type === "mandatoryResponse") {
    const done = resolveCard(G, ctx, power, card);
    if (!done) {
      G.flags.pendingCard = cardId;
      G.flags.pendingMandatory = true;
      G.flags.pendingCardChained = true;
      return undefined;
    }
    G.resolvingCard = null;
  }
  finishImpulse(G, ctx);
  return undefined;
};

/**
 * Rule 12.14 — convert the CP Chain into CP for one action this action phase.
 *
 * The chain is the player's own bank, so this is a separate impulse start: it
 * requires no CP in hand, sets `G.cpRemaining` to the chain's spendable total
 * (capped at 4 by `cpChainResolution`), and records that the phase's single
 * chain-funded action has been used.  The physical cards stay faceup in the
 * chain until `finishImpulse` ends the action phase, which then discards them.
 */
export const useCpChain = (G: ImperialElegyState, ctx: Ctx): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = requireActive(G, ctx, playerID);
  if (power === INVALID_MOVE) return INVALID_MOVE;
  if (G.phase !== "action" || G.pending !== null) return INVALID_MOVE;
  // The chain supplements the start of a fresh impulse, never a half-spent one.
  if (G.cpRemaining > 0) return INVALID_MOVE;
  if (G.flags.cpChainSpent === true) return INVALID_MOVE;
  const p = G.powers[power];
  if (p.cpChain.length === 0) return INVALID_MOVE;
  const resolved = cpChainResolution(G, power);
  if (resolved.cpSpendable <= 0) return INVALID_MOVE;
  G.cpRemaining = resolved.cpSpendable;
  // The chain starts a fresh impulse; its CP has not been spent yet.
  delete G.powers[power].flags.actionCpSpentThisImpulse;
  G.flags.cpChainActive = true;
  G.flags.cpChainSpent = true;
  G.flags.cpChainPower = power;
  return undefined;
};

/**
 * 15.2.3 Deploy Reserves (wartime): move reserve armies from the holding box
 * to a controlled or occupied main-map space with a land-only LoC.  Deployed
 * armies cannot attack, support or move during the impulse they are placed.
 *
 * A063 Rapid Mobilization adds one army to the printed half-industry total and
 * grants one free deploy in the playing belligerent's first maneuver impulse.
 */
export const deployReserves = (
  G: ImperialElegyState,
  ctx: Ctx,
  space: SpaceId,
  count?: number,
  options: {polishReserve?: boolean} = {},
): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  if (power === null) return INVALID_MOVE;
  if (G.pending !== null || G.battle !== null) return INVALID_MOVE;
  if (G.phase !== "wartime" || !G.war || G.war.status !== "maneuver") return INVALID_MOVE;
  if (power !== G.activePower) return INVALID_MOVE;
  const def = SPACES[space];
  if (!def || isNavalBox(space) || def.submap !== "main") return INVALID_MOVE;
  const state = G.spaces[space];
  if (!state) return INVALID_MOVE;
  // 15.2.3: the space must be controlled or occupied by the active player, not
  // merely by an ally.
  if (state.control !== power && state.occupiedBy !== power) return INVALID_MOVE;
  if (!hasLoc(G, power, space, {landOnly: true})) return INVALID_MOVE;
  const p = G.powers[power];
  const limit = deployReserveLimit(G, power, G.war);
  const available = p.reserves.filter((id) => {
    const unit = G.units[id];
    return Boolean(unit) && unit!.owner === power && unit!.kind === "reserveArmy";
  });
  const room = stackingLimit(G, space, power) - landUnitsIn(G, space).filter((u) => isArmyKind(u.kind)).length;
  const requested = count === undefined ? limit : Math.floor(count);
  if (!Number.isFinite(requested) || requested < 1 || requested > limit) return INVALID_MOVE;
  const placing = Math.min(requested, available.length, Math.max(0, room));
  if (placing <= 0) return INVALID_MOVE;
  // A063 Rapid Mobilization and 33.1 Superior Staff Work both grant a free
  // deploy reserves action.  They are alternatives, not cumulative: at most
  // one free deploy is consumed per action.
  const rapidFree = rapidMobilizationFreeDeploy(G, power, G.war);
  const staffFree = !rapidFree && superiorStaffWorkFreeDeploy(G, power, G.war);
  const free = rapidFree || staffFree;
  if (!free && !spendCpFor(G, power, 1)) return INVALID_MOVE;
  // A free deploy is still an action: it closes the start-of-impulse response
  // window just like a CP-funded one (and breaks the 15.0 pass run).
  p.flags.warCpSpentThisImpulse = true;
  noteWartimeAction(G);
  const placed: string[] = [];
  for (const id of available.slice(0, placing)) {
    p.reserves = p.reserves.filter((reserveId) => reserveId !== id);
    state.units.push(id);
    const unit = G.units[id];
    unit.space = space;
    unit.flags = {...(unit.flags ?? {}), deployedThisImpulse: true};
    placed.push(id);
  }
  if (rapidFree) p.flags.rapidFreeDeployUsed = true;
  if (staffFree) {
    p.flags.superiorStaffWorkUsed = true;
    log(G, power, "superiorStaffWork", {space, count: placed.length});
  }
  // 22.5(2): a player controlling an independent Poland may also deploy one
  // Polish reserve army with the same deploy-reserves action.  It is in
  // addition to the player's own allowance and costs no extra CP.
  const polish = options.polishReserve === false ? null : deployPolishReserve(G, power, space);
  log(G, power, "deployedReserves", {space, count: placed.length, free, polish: polish !== null});
  return undefined;
};

/**
 * 22.5(2) — deploy one Polish reserve army as part of the controller's
 * deploy-reserves action.  Deterministic: the action's own target space is
 * used when Poland may deploy there, otherwise Polish home (`poland`); the
 * unit is the lowest-id reserve counter in the printed box.
 */
const deployPolishReserve = (
  G: ImperialElegyState,
  power: Power,
  preferred: SpaceId,
): string | null => {
  if (polishReserveDeployer(G) !== power) return null;
  const target = polishDeploySpace(G, power, preferred);
  if (target === null) return null;
  const id = polishReserveIds(G)[0];
  const box = G.nonPlayerBuildBox?.poland;
  const unit = id === undefined ? undefined : G.units[id];
  const state = G.spaces[target];
  if (id === undefined || !box || !unit || !state) return null;
  box.reserveArmies = box.reserveArmies.filter((reserveId) => reserveId !== id);
  state.units.push(id);
  unit.space = target;
  unit.flags = {...(unit.flags ?? {}), deployedThisImpulse: true};
  log(G, power, "deployedPolishReserve", {space: target, unit: id});
  return id;
};

/**
 * 12.15 Redeployment: "1 CP. Enables a player to move *all* their land units an
 * unlimited distance by land."
 *
 * The action is therefore paid once per impulse, not once per unit: the first
 * `redeploy` in an impulse spends the CP and opens the action, and every later
 * unit moved in the same impulse is part of that same action and costs nothing
 * more.  Moving five armies used to cost five CP, which made redeployment
 * unplayable and contradicted the printed price.
 *
 * `unitIds` accepts one unit or several so the panel can move a whole stack in
 * one click; the array form is what the rule describes.  Units that cannot make
 * the move are left where they are (the rule moves "all", and a unit with no
 * route to the destination is not moved); with no legal mover the whole call is
 * refused so a click never silently does nothing.
 */
export const redeploy = (
  G: ImperialElegyState,
  ctx: Ctx,
  unitId: string | readonly string[],
  to: SpaceId,
): string | void => {
  const playerID = ctx.playerID ?? null;
  const ids = typeof unitId === "string" ? [unitId] : [...unitId];
  if (ids.length === 0) return INVALID_MOVE;
  if (G.phase === "gwManeuver") {
    // In the Great War this button is march (adjacent) or rail (friendly path).
    // Both are flow maneuvers that spend the GW budget exactly once, and the
    // GW has no 12.15 action, so only one unit moves per maneuver.
    if (ids.length > 1) return INVALID_MOVE;
    const gwPower = actor(G, playerID);
    if (gwPower === null || !G.gw) return INVALID_MOVE;
    const unit = G.units[ids[0]];
    if (!unit) return INVALID_MOVE;
    const adjacent = unit.space ? neighboursOf(unit.space).includes(to) : false;
    // 33.1 Superior Staff Work: latch GE's first GW maneuver impulse.
    markSuperiorStaffWorkGwImpulse(G);
    const res = performGwManeuver(
      G,
      ctx,
      adjacent
        ? {kind: "march", power: gwPower, unitId: ids[0], to}
        : {kind: "rail", power: gwPower, unitId: ids[0], to},
    );
    return res.ok ? undefined : INVALID_MOVE;
  }
  // The action's own CP is charged once.  Every unit after the first rides the
  // same action, so the wallet is only touched when the action opens.
  const actorPower = actor(G, playerID);
  if (actorPower === null) return INVALID_MOVE;
  let power = actorPower;
  // 15.2.4 / 15.2.5: wartime land movement is march or rail, not 12.15.  Both
  // are one-CP actions, so they share the action's CP charge below, but each
  // unit is validated against its own printed distance and network and the
  // rail allowance is charged per army.
  const wartimeMove = G.phase === "wartime" && G.war !== null && G.war.status === "maneuver";
  if (wartimeMove) {
    if (G.powers[actorPower].flags.redeployActionThisImpulse !== true) {
      // Validate before spending: a refused click must not cost CP.
      const plan = planWartimeLandMove(G, actorPower, ids[0], to);
      if (!plan.ok) {
        log(G, actorPower, "wartimeMoveRejected", {kind: plan.kind, to, reason: plan.reason ?? ""});
        return INVALID_MOVE;
      }
    }
  }
  if (G.powers[actorPower].flags.redeployActionThisImpulse === true) {
    if (requireActive(G, ctx, playerID) === INVALID_MOVE) return INVALID_MOVE;
    // A later unit of the same action still counts as acting: the first CP of
    // the impulse closed the response window, and a redeployment that opened
    // through an event-granted free move must also break a run of passes.
    if (G.phase === "action") G.powers[power].flags.actionCpSpentThisImpulse = true;
    else if (G.phase === "wartime") G.powers[power].flags.warCpSpentThisImpulse = true;
  } else {
    const paid = requireCp(G, ctx, playerID, 1);
    if (paid === INVALID_MOVE) return INVALID_MOVE;
    power = paid;
    G.powers[power].flags.redeployActionThisImpulse = true;
  }
  let moved = 0;
  let lastError: string | void = undefined;
  for (const id of ids) {
    const result = wartimeMove
      ? moveOneWartimeLandUnit(G, power, id, to)
      : moveOneLandUnit(G, power, id, to);
    if (result === undefined) moved += 1;
    else lastError = result;
  }
  return moved > 0 ? undefined : lastError ?? INVALID_MOVE;
};

/**
 * 15.2.4 / 15.2.5: one army's part of a wartime march/rail action.
 *
 * The march validates its distance and pass-through rule, the rail validates the
 * friendly network and spends one slot of the printed half-industry allowance.
 * Everything else the peacetime path already checks (the 15.2.3 deployment lock,
 * 5.5.3 stacking at the destination and 15.3 occupation) applies unchanged.
 */
const moveOneWartimeLandUnit = (
  G: ImperialElegyState,
  power: Power,
  unitId: string,
  to: SpaceId,
): string | void => {
  const unit = G.units[unitId];
  if (!unit) return INVALID_MOVE;
  const commands = unit.owner === power || commandsAlliedMinor(G, power, unit.owner);
  if (!commands) return INVALID_MOVE;
  // 15.2.3: a reserve army deployed this impulse cannot march, rail or attack.
  if (unit.flags?.deployedThisImpulse === true) return INVALID_MOVE;
  const plan = planWartimeLandMove(G, power, unitId, to);
  if (!plan.ok) {
    log(G, power, "wartimeMoveRejected", {kind: plan.kind, to, reason: plan.reason ?? ""});
    return INVALID_MOVE;
  }
  if (movementEndProblem(G, to, [unit]) !== null) return INVALID_MOVE;
  const from = unit.space ?? null;
  if (from === null) return INVALID_MOVE;
  G.spaces[from].units = G.spaces[from].units.filter((id) => id !== unitId);
  G.spaces[to].units.push(unitId);
  unit.space = to;
  if (plan.kind === "rail") {
    G.powers[power].flags.wartimeRailedThisImpulse = wartimeRailed(G, power) + 1;
  }
  // Separate calls so the log key is a literal: the log-localization inventory
  // reads keys from the source and a computed key would be invisible to it.
  if (plan.kind === "rail") {
    log(G, power, "wartimeRail", {unit: unitId, from, to, path: plan.path.join(",")});
  } else {
    log(G, power, "wartimeMarch", {unit: unitId, from, to, path: plan.path.join(",")});
  }
  // 15.3: the last player to solely be in a space occupies it.
  recordOccupation(G, to);
  return undefined;
};

/**
 * One unit's part of a 12.15 redeployment.  Split out of `redeploy` so the
 * per-unit rules (ownership, the 15.2.3 deployment lock, friendly destination,
 * stacking and the peacetime land route) are unchanged by moving the CP charge
 * up to the action.
 */
const moveOneLandUnit = (
  G: ImperialElegyState,
  power: Power,
  unitId: string,
  to: SpaceId,
): string | void => {
  const unit = G.units[unitId];
  if (!unit || unit.owner !== power || unit.naval) return INVALID_MOVE;
  // 15.2.3: a reserve army deployed this impulse cannot move.
  if (unit.flags?.deployedThisImpulse === true) return INVALID_MOVE;
  if (!friendlySpace(G, to, power) && !(G.spaces[to].influence === power && G.spaces[to].control === null)) return INVALID_MOVE;
  // 5.5.3: units may pass through an overstacked space but cannot end their
  // movement there.  Only the destination is validated.
  if (movementEndProblem(G, to, [unit]) !== null) return INVALID_MOVE;
  const from = unit.space ?? null;
  if (from === null) return INVALID_MOVE;
  // 12.15: peacetime redeployment still needs a land route through
  // controlled/influence spaces; it is not a teleport.  Wartime land movement
  // is the 15.2 march/rail flow and keeps its own checks.
  if (G.war === null && !G.gw?.active && !redeployLandPath(G, power, from, to)) return INVALID_MOVE;
  G.spaces[from].units = G.spaces[from].units.filter((id) => id !== unitId);
  G.spaces[to].units.push(unitId);
  unit.space = to;
  // 15.3: the last player to solely be in a space occupies it.
  recordOccupation(G, to);
  return undefined;
};

export const landBattle = (G: ImperialElegyState, ctx: Ctx, from: SpaceId, to: SpaceId): string | void => {
  const playerID = ctx.playerID ?? null;
  if (G.phase === "gwManeuver") {
    // The flow maneuver owns both validation and the single GW budget charge.
    const gwPower = actor(G, playerID);
    if (gwPower === null || !G.gw) return INVALID_MOVE;
    // 33.1 Superior Staff Work: this is GE's first GW maneuver impulse if it is
    // the first GW action of the turn.
    markSuperiorStaffWorkGwImpulse(G);
    const res = performGwManeuver(G, ctx, {kind: "landBattle", power: gwPower, from, to});
    if (res.ok) settleCulturalSymbolLoss(G);
    return res.ok ? undefined : INVALID_MOVE;
  }
  const power = requireCp(G, ctx, playerID, 1);
  if (power === INVALID_MOVE) return INVALID_MOVE;
  if (G.phase !== "action" && G.phase !== "wartime") return INVALID_MOVE;
  const battle = beginLandBattle(G, ctx, power, from, to);
  if (!battle) return INVALID_MOVE;
  // 33.3 Cultural Symbol: a battle resolved in place can occupy Paris.
  settleCulturalSymbolLoss(G);
  return undefined;
};

export const navalBattle = (G: ImperialElegyState, ctx: Ctx, from: SpaceId, to: SpaceId): string | void => {
  const playerID = ctx.playerID ?? null;
  if (G.phase === "gwManeuver" && hasLiveGwImpulse(G)) {
    const power = actor(G, playerID);
    if (power === null) return INVALID_MOVE;
    const unitIds = navalUnitsIn(G, from).filter((unit) => commandsUnit(G, power, unit)).map((unit) => unit.id);
    return navalMove(G, ctx, unitIds, to);
  }
  const power = requireCp(G, ctx, playerID, 1);
  if (power === INVALID_MOVE) return INVALID_MOVE;
  if (G.phase !== "action" && G.phase !== "wartime" &&
      !(G.phase === "gwManeuver" && !hasLiveGwImpulse(G))) return INVALID_MOVE;
  // 19.2: the defender may try to avoid any naval battle, including this
  // explicit attack.  Interception (19.1) is resolved elsewhere and never
  // offers the intercepting ships an avoid attempt.
  if (G.battle === null) {
    const defenders = navalUnitsIn(G, to).filter((unit) => hostileOwner(G, power, unit.owner));
    const defender = defenders.length > 0 ? navalDefenderPower(G, to) : null;
    if (defender !== null) {
      const attackers = navalUnitsIn(G, from)
        .filter((unit) => commandsUnit(G, power, unit))
        .map((unit) => unit.id);
      if (attackers.length > 0) {
        openNavalAvoidDecision(G, ctx, power, defender, from, to, attackers);
        return undefined;
      }
    }
  }
  // 19.5 footnote: an explicit port attack from a box is treated as taking
  // place in that box for the port-count BDRMs.
  const battle = beginNavalBattle(G, ctx, power, from, to,
    !isNavalBox(to) && isNavalBox(from) && portBoxes(to).includes(from) ? {portBox: from} : {},
  );
  if (!battle) return INVALID_MOVE;
  return undefined;
};

const moveUnitToSpace = (G: ImperialElegyState, unit: Unit, to: SpaceId): void => {
  const from = unit.space;
  if (from && G.spaces[from]) G.spaces[from].units = G.spaces[from].units.filter((id) => id !== unit.id);
  if (!G.spaces[to].units.includes(unit.id)) G.spaces[to].units.push(unit.id);
  unit.space = to;
};

/**
 * Non-mutating legality check for 19.10, shared by the move and the board
 * control so a disabled button and a rejected move always agree.
 *
 * The printed checks are: the target is an enemy coastal port; the origin is
 * an adjacent naval box (or a friendly port that loads the armies into one);
 * one or two own armies start in that box/origin; an enemy fleet in the port
 * needs a 2:1 escort in the adjacent boxes; an undefended port needs stacking
 * room for the landing.
 */
export type AmphibiousBlockReason =
  | "no-seat"
  | "not-active"
  | "phase"
  | "busy"
  | "no-cp"
  | "unit-count"
  | "target-port"
  | "target-friendly"
  | "origin"
  | "origin-not-adjacent"
  | "army"
  | "army-location"
  | "escort"
  | "landing-room"
  /** GW tutorial: the UK may not assault a GE home port holding GE naval units. */
  | "scenario-german-port";

export interface AmphibiousCheck {
  ok: boolean;
  reason?: AmphibiousBlockReason;
  /** The naval box the assault launches from, when it can be resolved. */
  box?: SpaceId;
  /** Enemy naval units inside the target port. */
  enemyNaval?: number;
  /** Friendly naval units in the ports adjacent to the target. */
  ownNaval?: number;
  /** Ships required by the 2:1 escort rule. */
  needShips?: number;
  /** Stacking room left in an undefended port. */
  room?: number;
}

export const amphibiousAssaultCheck = (
  G: ImperialElegyState,
  power: Power | null,
  from: SpaceId,
  to: SpaceId,
  unitIds: string[],
): AmphibiousCheck => {
  if (power === null) return {ok: false, reason: "no-seat"};
  if (G.phase !== "action" && G.phase !== "wartime") return {ok: false, reason: "phase"};
  if (G.pending !== null || G.battle !== null) return {ok: false, reason: "busy"};
  if (G.phase === "action" && G.activePower !== power) return {ok: false, reason: "not-active"};
  if (!Array.isArray(unitIds) || unitIds.length === 0 || unitIds.length > 2) {
    return {ok: false, reason: "unit-count"};
  }
  const toDef = SPACES[to];
  if (!toDef || isNavalBox(to) || portBoxes(to).length === 0) return {ok: false, reason: "target-port"};
  const target = G.spaces[to];
  if (!target) return {ok: false, reason: "target-port"};
  if ((isPower(target.control) || target.occupiedBy) && friendlySpace(G, to, power)) {
    return {ok: false, reason: "target-friendly"};
  }
  if (cpBudgetFor(G, power) < 1) return {ok: false, reason: "no-cp"};
  const armies = unitIds
    .map((id) => G.units[id])
    .filter((unit): unit is Unit => Boolean(unit) && unit!.owner === power && !unit!.naval);
  if (armies.length !== unitIds.length || !armies.every((unit) => isArmyKind(unit.kind))) {
    return {ok: false, reason: "army"};
  }
  let box: SpaceId | null = null;
  if (isNavalBox(from)) {
    if (!portBoxes(to).includes(from)) return {ok: false, reason: "origin-not-adjacent"};
    box = from;
  } else {
    if (!SPACES[from] || portBoxes(from).length === 0) return {ok: false, reason: "origin"};
    if (!friendlySpace(G, from, power)) return {ok: false, reason: "origin"};
    box = portBoxes(from).find((candidate) => portBoxes(to).includes(candidate)) ?? null;
    if (box === null) return {ok: false, reason: "origin-not-adjacent"};
  }
  if (armies.some((unit) => unit.space !== box && unit.space !== from)) {
    return {ok: false, reason: "army-location", box};
  }
  // GW tutorial p. 7: "The UK cannot amphibiously assault GE home spaces
  // containing a GE naval unit(s)."  A scenario prints this restriction, so it
  // is read from the scenario's own rule block and only then enforced.
  if (ukNoAmphibiousGermanPorts(G) && blocksUkAmphibiousPort(G, power, to)) {
    return {ok: false, reason: "scenario-german-port"};
  }
  // 19.10: enemy naval units in the port need a 2:1 escort in adjacent boxes.
  const enemyNaval = navalUnitsIn(G, to).filter((unit) => hostileOwner(G, power, unit.owner)).length;
  let ownNaval = 0;
  if (enemyNaval > 0) {
    ownNaval = (toDef.ports ?? []).reduce(
      (count, adjacent) => count + navalUnitsIn(G, adjacent).filter((unit) => unit.owner === power).length,
      0,
    );
    const needShips = enemyNaval * 2;
    if (ownNaval < needShips) {
      return {ok: false, reason: "escort", box, enemyNaval, ownNaval, needShips};
    }
  }
  const defenders = landUnitsIn(G, to).filter((unit) => hostileOwner(G, power, unit.owner));
  if (defenders.length === 0 && !target.fort) {
    const room = stackingLimit(G, to, power) - landUnitsIn(G, to).filter((unit) => isArmyKind(unit.kind)).length;
    if (room <= 0) return {ok: false, reason: "landing-room", box, enemyNaval, ownNaval, room: 0};
    return {ok: true, box, enemyNaval, ownNaval, room};
  }
  return {ok: true, box, enemyNaval, ownNaval};
};

/**
 * 19.10 Amphibious assault: land up to two armies from a naval box (or from a
 * friendly port that loads them into the adjacent box) onto an enemy port.
 *
 * The printed checks are enforced: the port must be enemy controlled/occupied,
 * both armies must start in the same box (or the loading port), if the port has
 * enemy naval units the attacker needs twice as many ships in adjacent boxes,
 * and a defended port fights a land battle with the -1 amphibious DRM.  If the
 * port has no enemy land unit or fort, the landing is unopposed.
 */
export const amphibiousAssault = (
  G: ImperialElegyState,
  ctx: Ctx,
  from: SpaceId,
  to: SpaceId,
  unitIds: string[],
): string | void => {
  const playerID = ctx.playerID ?? null;
  // Validate before any CP is spent so an illegal target never consumes the
  // impulse budget (the old body charged first and rejected afterwards).
  const check = amphibiousAssaultCheck(G, actor(G, playerID), from, to, unitIds);
  if (!check.ok) return INVALID_MOVE;
  const power = requireCp(G, ctx, playerID, 1);
  if (power === INVALID_MOVE) return INVALID_MOVE;
  const armies = unitIds
    .map((id) => G.units[id])
    .filter((unit): unit is Unit => Boolean(unit) && unit!.owner === power && !unit!.naval);
  const box = check.box!;
  const target = G.spaces[to];
  // The origin is a naval box adjacent to the target port, or a friendly port
  // that can load the armies into such a box (19.10's printed path).
  if (armies.some((unit) => unit.space === from)) {
    for (const unit of armies) moveUnitToSpace(G, unit, box);
  }
  if ((check.enemyNaval ?? 0) > 0) {
    // 19.5 footnote: the naval battle at the port is treated as taking place
    // in the box the assault came from.
    const naval = beginNavalBattle(G, ctx, power, box, to, {portBox: box});
    if (!naval) return INVALID_MOVE;
    log(G, power, "amphibiousNavalBattle", {from: box, to, armies: armies.map((unit) => unit.id)});
    return undefined;
  }
  const defenders = landUnitsIn(G, to).filter((unit) => hostileOwner(G, power, unit.owner));
  if (defenders.length === 0 && !target.fort) {
    // 19.10: an undefended port is simply occupied.
    const room = stackingLimit(G, to, power) - landUnitsIn(G, to).filter((unit) => isArmyKind(unit.kind)).length;
    const landing = armies.slice(0, Math.max(0, room));
    if (landing.length === 0) return INVALID_MOVE;
    for (const unit of landing) moveUnitToSpace(G, unit, to);
    // 19.10: an undefended port is simply occupied (15.3).
    recordOccupation(G, to, {force: true});
    if (target.occupiedBy !== power) target.occupiedBy = power;
    // 15.6: an undefended landing can be the capture of an ally's capital.
    recordWarKnockoutCapture(G, to, power);
    log(G, power, "amphibiousLanding", {from: box, to, units: landing.map((unit) => unit.id)});
    return undefined;
  }
  const battle = beginLandBattle(G, ctx, power, box, to, true);
  if (!battle) return INVALID_MOVE;
  log(G, power, "amphibiousAssault", {from: box, to, units: armies.map((unit) => unit.id)});
  return undefined;
};

/**
 * Non-mutating legality check for 19.1 naval interception, shared with the
 * board's defender-side control.  The reactive window is keyed to the last log
 * entry: it must still be a naval move into `box` this turn.
 */
export type NavalInterceptBlockReason =
  | "no-seat"
  | "busy"
  | "phase"
  | "port"
  | "port-not-adjacent"
  | "not-owner"
  | "no-naval-move"
  | "not-defender"
  | "not-active"
  | "not-at-war"
  | "no-ships";

export interface NavalInterceptCheck {
  ok: boolean;
  reason?: NavalInterceptBlockReason;
  /** The power that made the naval move being intercepted. */
  mover?: Power;
  box?: SpaceId;
  port?: SpaceId;
  /** Naval units the interceptor has in the port. */
  ships?: number;
}

export const navalInterceptCheck = (
  G: ImperialElegyState,
  power: Power | null,
  port: SpaceId,
  box: SpaceId,
): NavalInterceptCheck => {
  if (power === null) return {ok: false, reason: "no-seat"};
  if (G.pending !== null || G.battle !== null) return {ok: false, reason: "busy"};
  if (G.phase !== "action" && G.phase !== "wartime" && G.phase !== "gwManeuver") {
    return {ok: false, reason: "phase"};
  }
  if (isNavalBox(port) || !isNavalBox(box)) return {ok: false, reason: "port"};
  if (!portBoxes(port).includes(box)) return {ok: false, reason: "port-not-adjacent"};
  if (!friendlySpace(G, port, power)) return {ok: false, reason: "not-owner"};
  const last = G.log[G.log.length - 1];
  if (!last || last.turn !== G.turn) return {ok: false, reason: "no-naval-move"};
  let mover: Power | null = null;
  if (last.key === "navalMove" && last.args?.to === box) mover = last.power ?? null;
  if (last.key === "gwManeuverAction" && last.args?.kind === "naval" && last.args?.to === box) {
    mover = last.power ?? null;
  }
  if (mover === null) return {ok: false, reason: "no-naval-move"};
  if (mover === power) return {ok: false, reason: "not-defender"};
  if (G.activePower !== mover) return {ok: false, reason: "not-active"};
  if (!atWar(G, power, mover)) return {ok: false, reason: "not-at-war"};
  const ships = navalUnitsIn(G, port).filter((unit) => unit.owner === power).length;
  if (ships === 0) return {ok: false, reason: "no-ships", mover, box, port};
  return {ok: true, mover, box, port, ships};
};

/**
 * 19.1 Naval interception, played by the defending player immediately after
 * the active player's naval move (the last log entry must be that move).  Each
 * intercepting port makes its own 5+ roll; success starts a naval battle with
 * the active player as the attacker.
 */
export const navalIntercept = (G: ImperialElegyState, ctx: Ctx, port: SpaceId, box: SpaceId): string | void => {
  const playerID = ctx.playerID ?? null;
  const interceptor = actor(G, playerID);
  const check = navalInterceptCheck(G, interceptor, port, box);
  if (!check.ok || interceptor === null || check.mover === undefined) return INVALID_MOVE;
  attemptInterception(G, ctx, check.mover, interceptor, port, box);
  return undefined;
};

// ------------------------------------------------------------------ war
/** Record a National Goal as faceup/public (33.1 Blood and Iron!, 33.3). */
const markGoalRevealed = (G: ImperialElegyState, goalId: string): void => {
  const revealed = G.revealedGoals ?? (G.revealedGoals = []);
  if (!revealed.includes(goalId)) revealed.push(goalId);
};

/**
 * Rule 13.3: apply the conquest declaration penalty (shared by player and
 * non-player declarations).
 */
const applyConquestDeclarationPenalty = (
  G: ImperialElegyState,
  ctx: Ctx,
  power: Power,
  aim: "liberation" | "unification" | "conquest",
  stabilityDiscount: number,
): void => {
  if (aim !== "conquest") return;
  // Rule 13.3: raise the WTT by one, then lose that many stability.
  // 33.3 Napoleon's Legacy reduces the loss by 2 while revealed.
  const penalty = conquestDeclarationPenalty(G, stabilityDiscount);
  changeWtt(G, penalty.wttDelta, ctx);
  changeStability(G, power, penalty.stabilityDelta, ctx, {cause: "war"});
};

/**
 * Finish a war declaration once the aim validation and CP spend succeeded and
 * any 33.3 Napoleon's Legacy reveal choice has been answered.
 *
 * `minor` is set for a rule 13.4 declaration on a non-player power.  When it
 * has a player ally that ally is the defending primary and the 14.2
 * ally-aiding shift replaces the ordinary 8.2 defender shift.  When `ally` is
 * null (13.4.2 found no aid, or 13.4.1 abandoned the minor) the non-player
 * defends alone per 15.4.2: the war is live with the non-player as the typed
 * `minorTarget` defender, and the declaration is also mirrored into the
 * `G.minorDeclarations` ledger.
 */
const finalizeWarDeclaration = (
  G: ImperialElegyState,
  ctx: Ctx,
  power: Power,
  target: PowerOrMinor,
  aim: "liberation" | "unification" | "conquest",
  objectives: SpaceId[],
  cp: number,
  stabilityDiscount = 0,
  minor: MinorWarInfo | null = null,
): string | void => {
  if (minor === null && !isPower(target)) return INVALID_MOVE;
  // The card that funds the declaration can print a conquest exception
  // ("do not increase the WTT or decrease your stability": Russo-Turkish Wars
  // and Jihad).  The id crosses any aid search / Napoleon's Legacy decision on
  // `G.flags.declarationCard`, so read it before the penalty is applied.
  const declarationCard = isCardId(G.flags.declarationCard) ? G.flags.declarationCard : null;
  // Rule 14.1's two-power clause and the two optional join clauses cross the
  // same pending decisions on the public game flags.
  const secondTarget = isPower(G.flags.declarationSecond) ? G.flags.declarationSecond : null;
  const requestedPrimary = isPower(G.flags.declarationPrimary) ? G.flags.declarationPrimary : null;
  const forbidPlayers = G.flags.declarationForbid === true;
  const allowNeutralJoin = G.flags.declarationNeutralJoin === true;
  delete G.flags.declarationSecond;
  delete G.flags.declarationPrimary;
  delete G.flags.declarationForbid;
  delete G.flags.declarationNeutralJoin;
  if (declarationCard === null || !warDeclarationExemptsConquestPenalty(declarationCard)) {
    applyConquestDeclarationPenalty(G, ctx, power, aim, stabilityDiscount);
  }
  // Rule 16.1.2: remember which spaces the attacker controlled before the war
  // so a later defensive victory can be recognised.
  G.flags.limitedWarAttackerStart = Object.values(SPACES)
    .filter((def) => controlledBy(G, def.id, power))
    .map((def) => def.id)
    .join(",");
  // 14.1: one defending player is the primary (the capital that ends the war);
  // the other is a co-defender on the same side.
  const primary = secondTarget !== null && requestedPrimary === secondTarget ? secondTarget : target;
  const coDefender: Power | null = secondTarget === null
    ? null
    : primary === secondTarget
      ? (isPower(target) ? target : null)
      : secondTarget;
  G.war = createWarState(
    G,
    power,
    primary,
    aim,
    objectives,
    cp,
    minor !== null ? {minor: {minor: minor.minor, ally: minor.ally}} : {},
  );
  if (coDefender !== null) {
    // The co-defender is recorded both as a typed declaration target and as a
    // defending-side belligerent, so every side/initiative/battle helper sees
    // it.  It played no card: 14.3's budget is its industry alone.
    G.war.coDefenders = [coDefender];
    G.war.defenderAllies.push(coDefender);
    G.war.budgets[coDefender] = warBudgetFor(G, coDefender, 0);
  }
  // Bismarck: "After declaring war you may choose to forbid other players from
  // joining the war.  Minor power allies may join the war as normal."
  G.war.forbidPlayerJoins = forbidPlayers || undefined;
  // Aux Armes: two keys or two powers open the defending side to neutral
  // volunteers.
  G.war.allowNeutralJoin = allowNeutralJoin || undefined;
  // Rule 8.2 / 14.2: the declaration itself shifts the defender one space away
  // from the attacker.  A card-driven declaration is remembered for Balance of
  // Power's "cannot be played in response to Otto von Bismarck" clause.  A home
  // card's entitlement crosses the aid search as `G.flags.declarationCard`;
  // an ordinary CP declaration of that card has no resolution-time card id.
  const stamped = G.flags.declarationCard;
  G.war.declarationCard = isCardId(stamped) ? stamped : (G.resolvingCard ?? null);
  delete G.flags.declarationCard;
  // 13.4.4 (as amended): "If China is attacked in a war of conquest, place the
  // Qing army at full strength in the targeted key."  The Qing counter row has
  // exactly one army, so this is idempotent even if a later path repeats it.
  if (minor !== null && minor.minor === "Qing China" && aim === "conquest") {
    const key = objectives[0];
    if (key !== undefined && G.spaces[key]) {
      // The chart prints one Qing army.  If a card already put it on the map,
      // the rule still moves it into the targeted key at full strength.
      const existing = unitsOfPower(G, "Qing China").find((unit) => unit.kind === "minorArmy");
      if (existing !== undefined) {
        if (existing.space && G.spaces[existing.space]) {
          G.spaces[existing.space].units = G.spaces[existing.space].units.filter((id) => id !== existing.id);
        }
        existing.space = key;
        existing.steps = 2;
        G.spaces[key].units.push(existing.id);
      } else {
        placeNonPlayerCounter(G, "Qing China", "minorArmy", key, 2);
      }
      log(G, power, "qingArmyPlaced", {space: key});
    }
  }
  if (minor !== null) {
    // Rule 13.4 / 14.2 / 8.2: the aiding player ally shifts away from the
    // attacker; the printed 8.2 random Italy shift applies when no player
    // defends a unified Italy.
    const shift = applyMinorDeclarationShift(G, ctx, power, minor);
    if (shift.allyShift !== null) {
      // 8.2: with both chits neutral the aiding ally chooses its box; record the
      // open choice so `chooseAllianceShift` can answer it and
      // `startWarManeuver` still applies the documented default fallback.
      G.war.defenderShift = {
        from: shift.allyShift.from,
        to: shift.allyShift.to,
        steps: shift.allyShift.steps,
        forced: false,
        choice: shift.allyShift.needsChoice,
      };
    }
    if (minor.ally === null) {
      // Rule 13.4.2 / 15.4.2: the declaration ledger keeps the printed 8.2
      // random Italy shift (the war itself is the live record).
      const italyShift = shift.italyShift;
      const declarations = (G.minorDeclarations ??= []);
      declarations.push({
        attacker: power,
        minor: minor.minor,
        aim,
        objectives: [...objectives],
        turn: G.turn,
        italyShift:
          italyShift !== null && italyShift.applied && italyShift.side !== null
            ? {
                roll: italyShift.roll,
                random: italyShift.random,
                side: italyShift.side,
                from: italyShift.from,
                to: italyShift.to,
              }
            : null,
      });
    }
  } else if (isPower(primary)) {
    applyDefenderDeclarationShift(G, power, primary);
    if (coDefender !== null) {
      // Rule 8.2 applies to each attacked power.  The primary's both-neutral
      // choice is the live decision above; the co-defender's shift uses the
      // deterministic Triple-Entente-first fallback (the same default 8.6
      // uses) so two simultaneous choices cannot collide on `G.pending`.
      const derived = declarationShiftDirection(G.powers[power].alliance, G.powers[coDefender].alliance);
      const side: AllianceSide = derived ?? (canJoinAlliance(G, coDefender, "te") ? "te" : "ta");
      const result = declarationShift(G, power, coDefender, side);
      log(G, coDefender, "allianceShifted", {
        from: result.from,
        to: result.to,
        steps: result.steps,
        attacker: power,
        forced: result.forced,
        secondDefender: true,
      });
    }
  }
  // 33.2 Rapid Deployment: the UK receives one free naval movement action the
  // first time it enters this war, whether it attacks or is attacked.
  if (power === "UK" || target === "UK" || secondTarget === "UK") grantRapidDeployment(G, "limited");
  G.phase = "wartime";
  ctx.events?.setPhase?.("wartime");
  G.activePower = power;
  addLog(G, power, "warDeclared", {
    target: minor?.minor ?? target,
    secondary: coDefender ?? undefined,
    primaryDefender: secondTarget !== null ? primary : undefined,
    aim,
    objectives: objectives.join(","),
    forbidPlayerJoins: forbidPlayers || undefined,
    allowNeutralJoin: allowNeutralJoin || undefined,
  });
  return undefined;
};

/**
 * Rule 13.4 — a declaration on a non-player power that no player defends.
 *
 * "If no player chooses to aid the non playing power, proceed to the
 * initiative order and war budget step" (13.4.2).  Rule 15.4.2 then governs
 * the war: the non-player stays in its space and defends, never moving or
 * attacking, and may retreat normally; it has no budget or impulse of its own.
 * The declaration is created as a real `WarState` with the non-player as the
 * typed lone defender (`minorTarget.ally === null`), mirrored into the
 * `G.minorDeclarations` ledger.
 */
const finalizeUnopposedMinorDeclaration = (
  G: ImperialElegyState,
  ctx: Ctx,
  power: Power,
  minor: MinorWarInfo,
  aim: "liberation" | "unification" | "conquest",
  objectives: SpaceId[],
  cp: number,
  stabilityDiscount: number,
): string | void => {
  const lone: MinorWarInfo = {...minor, ally: null};
  const result = finalizeWarDeclaration(
    G,
    ctx,
    power,
    minorWarDefender(lone),
    aim,
    objectives,
    cp,
    stabilityDiscount,
    lone,
  );
  if (result !== undefined) return result;
  log(G, power, "minorUnopposed", {target: minor.minor, war: true});
  return undefined;
};

// ------------------------------------------------------------------ 13.4.1 / 13.4.2
/**
 * The serializable declaration context both 13.4.1 (abandonment) and 13.4.2
 * (Seeking Aid) decisions carry so the war can be finalized after the answer.
 */
interface MinorDeclarationContext {
  attacker: Power;
  minor: string;
  aim: WarAimType;
  objectives: SpaceId[];
  cp: number;
  stabilityDiscount: number;
}

/** Serializable state of one 13.4.2 aid search (the pending chain's context). */
interface SeekingAidState extends MinorDeclarationContext {
  /** Table/choice slots not yet started, in printed order. */
  slots: SeekingAidSlot[];
  /** The slot currently being worked through, after any roll-off. */
  current: {step: number; diplomacy: boolean; candidates: Power[]} | null;
  /** Index of the next candidate inside `current`. */
  index: number;
  /** Public die rolls of the current slot's roll-off, if it had one. */
  rolls: {power: Power; roll: number}[];
}

const isWarAimValue = (value: unknown): value is WarAimType =>
  value === "liberation" || value === "unification" || value === "conquest";

const objectiveList = (value: unknown): SpaceId[] | null => {
  if (!Array.isArray(value)) return null;
  if (value.some((id) => typeof id !== "string")) return null;
  return value as SpaceId[];
};

/** Re-read the shared declaration context from a pending decision. */
const minorDeclarationContext = (pending: PendingDecision): MinorDeclarationContext | null => {
  const attacker = pending.context?.attacker;
  const minor = pending.context?.minor;
  const aim = pending.context?.aim;
  const objectives = objectiveList(pending.context?.objectives);
  const cp = Number(pending.context?.cp);
  if (!isPower(attacker)) return null;
  if (typeof minor !== "string" || minor.length === 0) return null;
  if (!isWarAimValue(aim) || objectives === null || !Number.isFinite(cp)) return null;
  const rawDiscount = Number(pending.context?.stabilityDiscount ?? 0);
  const stabilityDiscount = Number.isFinite(rawDiscount) ? rawDiscount : 0;
  return {attacker, minor, aim, objectives, cp, stabilityDiscount};
};

/** The `MinorWarInfo` for a power that aids the attacked non-player (13.4.2). */
const aidedMinorInfo = (G: ImperialElegyState, attacker: Power, minor: string, ally: Power): MinorWarInfo | null => {
  const info = minorWarInfo(G, attacker, minor);
  if (!info.ok || info.ally !== null) return null;
  return {ok: true, minor, home: info.home, ally};
};

/**
 * Rule 13.4.2: "If a player chooses to aid the attacked non-player power that
 * player immediately gains an alliance with it."  The alliance marker is
 * written before the war is created, then the aiding player becomes the
 * defending primary (13.4) exactly like a pre-existing ally.
 */
const finalizeMinorAid = (
  G: ImperialElegyState,
  ctx: Ctx,
  state: MinorDeclarationContext,
  ally: Power,
): string | void => {
  // Bismarck: "you may choose to forbid other players from joining the war."
  // 13.4.2's aid search is a player joining as the defending primary, so a
  // queued decision cannot accept once the ban is recorded.
  if (G.flags.declarationForbid === true) return INVALID_MOVE;
  if (!canAidMinor(G, state.attacker, state.minor, ally)) return INVALID_MOVE;
  const info = aidedMinorInfo(G, state.attacker, state.minor, ally);
  if (info === null) return INVALID_MOVE;
  const home = applyMinorAidAlliance(G, state.minor, ally);
  if (home === null) return INVALID_MOVE;
  // 13.4.2: the *aiding* player answers the call and gains the alliance; the
  // attacker is only the power that declared war on the minor.
  log(G, ally, "minorAidGranted", {minor: state.minor, ally, space: home});
  // 13.4.4 (as amended): "The player that aids the Qing in the war of conquest
  // gains a +1 card marker regardless of the war's outcome."
  if (state.minor === "Qing China" && state.aim === "conquest") {
    G.powers[ally].cardMarkers += 1;
    log(G, ally, "qingAidCardMarker", {
      minor: state.minor,
      cardMarkers: G.powers[ally].cardMarkers,
    });
  }
  G.pending = null;
  return finalizeWarDeclaration(
    G,
    ctx,
    state.attacker,
    ally,
    state.aim,
    state.objectives,
    state.cp,
    state.stabilityDiscount,
    info,
  );
};

/**
 * Open the next 13.4.2 aid decision.  Walks the printed order (diplomacy
 * marker first, then the table's 1st/2nd/3rd Choice), rolls off a two-player
 * cell with the injected die, and skips any candidate that has become
 * ineligible.  Returns false when the search is exhausted.
 */
const openMinorAidDecision = (
  G: ImperialElegyState,
  ctx: Ctx,
  state: SeekingAidState,
): boolean => {
  for (;;) {
    if (state.current === null || state.index >= state.current.candidates.length) {
      const next = state.slots.shift();
      if (next === undefined) return false;
      let candidates = [...next.candidates];
      let rolls: {power: Power; roll: number}[] = [];
      if (next.rollOff && candidates.length > 1) {
        // 13.4.3: "Both players roll a d6 ... the higher roll wins, reroll
        // ties."  The roll-off is public, like 14.3's initiative roll-off.
        const rolled = rollOffAidOrder(candidates, () => die(ctx, 6));
        candidates = rolled.order;
        rolls = rolled.rolls;
        // 13.4.3 is the attacked minor's search for an ally, not an attacker
        // action; the entry names the minor, so no player is the actor.
        log(G, undefined, "minorAidRoll", {
          minor: state.minor,
          order: candidates.join(","),
          rolls: rolled.rolls.map((entry) => `${entry.power}:${entry.roll}`).join(","),
        });
      }
      state.current = {step: next.step, diplomacy: next.diplomacy, candidates};
      state.index = 0;
      state.rolls = rolls;
    }
    const candidate = state.current.candidates[state.index];
    if (candidate === undefined) continue;
    if (!canAidMinor(G, state.attacker, state.minor, candidate)) {
      state.index += 1;
      continue;
    }
    openDecision(G, ctx, {
      kind: "minorAid",
      power: candidate,
      prompt: `Seeking Aid: aid ${state.minor} against ${state.attacker}?`,
      promptZh: `寻求援助：援助${minorLabel(state.minor, "zh_CN")}对抗${POWER_DEFS[state.attacker]?.nameZh ?? state.attacker}？`,
      promptArgs: {
        minor: state.minor,
        attacker: state.attacker,
        step: state.current.step,
        diplomacy: state.current.diplomacy,
      },
      options: [
        option("aid", `Aid ${state.minor} (gain its alliance)`, undefined, false, `援助${minorLabel(state.minor, "zh_CN")}（获得其同盟）`),
        option("decline", "Decline; the power asks the next candidate", undefined, false, "拒绝；该国将询问下一位候选者"),
      ],
      context: {...state, current: state.current, rolls: state.rolls},
      blocking: true,
    });
    // The minute is written by the attacked minor ("the attacked non-player
    // power immediately tries to find a player ally"); the attacker is not the
    // actor.  The minor's name is in `args.minor`.
    log(G, undefined, "minorAllyAsked", {
      minor: state.minor,
      power: candidate,
      step: state.current.step,
      diplomacy: state.current.diplomacy,
    });
    return true;
  }
};

/**
 * Rule 13.4.2 — the attacked non-player power "immediately tries to find a
 * player ally".  With no candidate the declaration proceeds unopposed: the
 * non-player becomes the lone defending power of a live war (15.4.2).
 */
const beginSeekingAid = (G: ImperialElegyState, ctx: Ctx, base: MinorDeclarationContext): string | void => {
  // Bismarck: "After declaring war you may choose to forbid other players from
  // joining the war; minor power allies may join as normal."  The 13.4.2 aid
  // search offers a *player* the defending side, so the ban suppresses it and
  // the minor defends alone (15.4.2).  Minor-power allies still join through
  // 14.0's `joinWarAsMinor` path and are deliberately not affected.
  if (G.flags.declarationForbid === true) {
    log(G, base.attacker, "minorAidForbidden", {minor: base.minor});
  } else {
    const slots = seekingAidSlots(G, base.attacker, base.minor);
    if (slots.length > 0) {
      const state: SeekingAidState = {...base, slots, current: null, index: 0, rolls: []};
      if (openMinorAidDecision(G, ctx, state)) return undefined;
    }
  }
  const home = nonPlayerHome(base.minor, G);
  return finalizeUnopposedMinorDeclaration(
    G,
    ctx,
    base.attacker,
    {ok: true, minor: base.minor, home, ally: null},
    base.aim,
    base.objectives,
    base.cp,
    base.stabilityDiscount,
  );
};

/**
 * Rule 13.4 / 13.4.1 / 13.4.2 — the live follow-up to a declaration on a
 * non-player power.  An existing player ally is first asked whether it
 * abandons the minor (13.4.1); a non-player with no ally immediately searches
 * for one (13.4.2).
 */
const beginMinorWarDeclaration = (
  G: ImperialElegyState,
  ctx: Ctx,
  power: Power,
  minor: MinorWarInfo,
  aim: WarAimType,
  objectives: SpaceId[],
  cp: number,
  stabilityDiscount: number,
): string | void => {
  const base: MinorDeclarationContext = {
    attacker: power,
    minor: minor.minor,
    aim,
    objectives: [...objectives],
    cp,
    stabilityDiscount,
  };
  if (minor.ally !== null) {
    // 13.4.1: "A player ally can decline to enter a war after the attacker
    // announces their war aim thus abandoning the minor power."
    openDecision(G, ctx, {
      kind: "minorAbandon",
      power: minor.ally,
      prompt: `${power} has declared war on ${minor.minor}. Fight for it or abandon it?`,
      promptZh: `${POWER_DEFS[power].nameZh}已对${minorLabel(minor.minor, "zh_CN")}宣战。为其而战，还是放弃它？`,
      promptArgs: {attacker: power, minor: minor.minor, ally: minor.ally, aim},
      options: [
        option("join", `Join the war for ${minor.minor}`, undefined, false, `为${minorLabel(minor.minor, "zh_CN")}参战`),
        option("abandon", "Abandon the minor (lose 1 stability, shift away)", undefined, false, "放弃该小国（失去 1 点稳定度并移出同盟）"),
      ],
      context: {...base, ally: minor.ally},
      blocking: true,
    });
    log(G, power, "minorAllyAsked", {minor: minor.minor, power: minor.ally, step: 0, diplomacy: false});
    return undefined;
  }
  return beginSeekingAid(G, ctx, base);
};

/**
 * Rules 13.4.1 / 8.5: "If Italy is attacked and a player refuses to join the
 * war Italy gains 10 neutral influence on the MPIT per player that refused to
 * join."  Italy's own typed column is written and the change is logged.
 */
const grantItalyNeutralInfluence = (
  G: ImperialElegyState,
  amount: number,
  reason: "abandoned" | "aidDeclined",
): void => {
  const mpit = addItalyMpit(G, "neutral", amount);
  log(G, undefined, "italyMpitGained", {
    major: "IT",
    track: "neutral",
    amount,
    total: mpit.neutral,
    reason,
  });
};

/**
 * Rules 13.4.1/13.4.2 + 14.0: an aid refusal also takes the printed 14.0
 * penalties.  "If Italy is attacked and a player refuses to join the war Italy
 * gains 10 neutral influence on the MPIT per player that refused to join.  This
 * is in addition to the normal penalties incurred per rule 14.0."  The
 * penalties are the refusing player's own: +5 neutral influence from an aligned
 * box, and +10 plus -1 stability from a committed box.  Rule 13.4.1's own
 * stability loss is separate, so a committed-box abandoner takes both.
 *
 * A truce-forced refusal is the 14.0 exception: no penalty at all, and it also
 * cancels the Italy clause.  Neutral powers have no 14.0 box penalty, so their
 * decline stays private (no log); only a real penalty is recorded.
 */
const applyMinorRefusal = (
  G: ImperialElegyState,
  ctx: Ctx,
  attacker: Power,
  refuser: Power,
  options: {skipStability: boolean},
): {exemptForTruce: boolean; neutralInfluence: number} => {
  const exemptForTruce = hasTruce(G, refuser, attacker);
  const penalty = allyRefusalPenalty(G, refuser, exemptForTruce);
  const stability = options.skipStability ? 0 : penalty.stability;
  if (penalty.neutralInfluence > 0 || stability !== 0) {
    applyAllyRefusal(G, null, attacker, refuser, {
      exemptForTruce,
      skipStability: options.skipStability,
    }, ctx);
  }
  return {exemptForTruce, neutralInfluence: penalty.neutralInfluence};
};

/**
 * Rule 13.4.1 — resolve the ally's abandonment choice.  "join" is the old
 * immediate behaviour; "abandon" applies the three printed consequences and
 * the minor is left to fight alone.
 */
const resolveMinorAbandon = (
  G: ImperialElegyState,
  ctx: Ctx,
  pending: PendingDecision,
  optionId: string,
): string | void => {
  if (optionId !== "join" && optionId !== "abandon") return INVALID_MOVE;
  const base = minorDeclarationContext(pending);
  if (base === null) return INVALID_MOVE;
  const info = minorWarInfo(G, base.attacker, base.minor);
  if (!info.ok || info.ally === null) return INVALID_MOVE;
  const ally = info.ally;
  if (optionId === "join") {
    G.pending = null;
    return finalizeWarDeclaration(
      G,
      ctx,
      base.attacker,
      ally,
      base.aim,
      base.objectives,
      base.cp,
      base.stabilityDiscount,
      info,
    );
  }
  G.pending = null;
  // 13.4.1: "That player loses 1 stability" and "shifts away from the
  // attacking player on the alliance track [8.2]".  Rule 14.0's refusal
  // penalty is separate and stacks with it: a committed-box ally loses its own
  // 1 stability as well.  13.4.1's Italy clause makes the 14.0 penalties
  // explicit ("in addition to the normal penalties incurred per rule 14.0").
  changeStability(G, ally, -1, ctx, {cause: "war"});
  const refusal = applyMinorRefusal(G, ctx, base.attacker, ally, {skipStability: false});
  const italyInfluence = base.minor === "Italy" && !refusal.exemptForTruce ? 10 : 0;
  const shift = allyAidShift(G, base.attacker, ally);
  log(G, ally, "allianceShifted", {
    from: shift.from,
    to: shift.to,
    steps: shift.steps,
    attacker: base.attacker,
    abandonedMinor: base.minor,
    blocked: shift.blocked,
    fallback: shift.defaultDirection,
  });
  log(G, ally, "minorAbandoned", {
    minor: base.minor,
    stability: -1,
    from: shift.from,
    to: shift.to,
    // Rules 13.4.1/14.0: the abandoning player's own refusal penalty, and the
    // 10 neutral influence an attacked Italy gains (cancelled by a truce).
    refusalInfluence: refusal.neutralInfluence,
    exemptForTruce: refusal.exemptForTruce,
    italyInfluence,
  });
  if (italyInfluence > 0) grantItalyNeutralInfluence(G, 10, "abandoned");
  // 13.4.1: "Skip to the initiative and budget step [14.3]".  A non-player
  // defender has no WarState (15.4.2), so the declaration is recorded.
  return finalizeUnopposedMinorDeclaration(
    G,
    ctx,
    base.attacker,
    {...info, ally: null},
    base.aim,
    base.objectives,
    base.cp,
    base.stabilityDiscount,
  );
};

/**
 * Rule 13.4.2 — resolve one aid decision.  "Aid" re-validates the volunteer
 * against the live state, gains the alliance and creates the war with the
 * aider as the defending primary; "decline" moves to the next printed
 * candidate (or records the unopposed declaration once the list is empty).
 */
const resolveMinorAid = (
  G: ImperialElegyState,
  ctx: Ctx,
  pending: PendingDecision,
  optionId: string,
): string | void => {
  if (optionId !== "aid" && optionId !== "decline") return INVALID_MOVE;
  const base = minorDeclarationContext(pending);
  if (base === null) return INVALID_MOVE;
  const candidate = pending.power;
  const rawSlots = pending.context?.slots;
  const rawCurrent = pending.context?.current;
  if (!Array.isArray(rawSlots) || rawCurrent === null || typeof rawCurrent !== "object") return INVALID_MOVE;
  const slots = rawSlots as SeekingAidSlot[];
  const current = rawCurrent as {step: number; diplomacy: boolean; candidates: Power[]};
  const rawRolls = pending.context?.rolls;
  const rolls = Array.isArray(rawRolls) ? (rawRolls as {power: Power; roll: number}[]) : [];
  const index = Math.max(0, Number(pending.context?.index ?? 0));

  if (optionId === "aid") {
    if (!canAidMinor(G, base.attacker, base.minor, candidate)) return INVALID_MOVE;
    return finalizeMinorAid(G, ctx, base, candidate);
  }
  // Declining is private to the asked seat; the advance is observable through
  // the next asked candidate.  The printed 14.0 penalty is added (a truce
  // refusal is exempt), and 13.4.1 counts every player that refused to join, so
  // an attacked Italy gains +10 neutral influence now.
  G.pending = null;
  const refusal = applyMinorRefusal(G, ctx, base.attacker, candidate, {skipStability: false});
  if (base.minor === "Italy" && !refusal.exemptForTruce) {
    grantItalyNeutralInfluence(G, 10, "aidDeclined");
  }
  const state: SeekingAidState = {...base, slots: [...slots], current, index: index + 1, rolls};
  if (openMinorAidDecision(G, ctx, state)) return undefined;
  const home = nonPlayerHome(base.minor, G);
  return finalizeUnopposedMinorDeclaration(
    G,
    ctx,
    base.attacker,
    {ok: true, minor: base.minor, home, ally: null},
    base.aim,
    base.objectives,
    base.cp,
    base.stabilityDiscount,
  );
};

/** Optional clauses of a home-card declaration (rules 14.1 / Bismarck / Aux Armes). */
export interface DeclareWarOptions {
  /**
   * Rule 14.1: the second player power named by the same declaration.  Only a
   * card whose policy prints the two-power clause may pass it, and only for
   * the aim that clause names.
   */
  secondTarget?: Power;
  /**
   * Rule 14.1: "the defending players determine, between the two of them, who
   * the primary defender is, and, if they cannot agree, the attacker decides."
   * The move records the resulting choice; it must be one of the two targets.
   */
  primary?: Power;
  /**
   * Bismarck: "After declaring war you may choose to forbid other players
   * from joining the war."  Minor allies still join under 14.0.
   */
  forbidPlayers?: boolean;
}

export const declareWar = (
  G: ImperialElegyState,
  ctx: Ctx,
  target: WarTarget,
  aim: "liberation" | "unification" | "conquest",
  objectives: SpaceId[],
  cp: number,
  options: DeclareWarOptions = {},
): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = requireActive(G, ctx, playerID);
  if (power === INVALID_MOVE) return INVALID_MOVE;
  if (G.phase !== "action") return INVALID_MOVE;
  if (G.war !== null) return INVALID_MOVE;
  if (G.wtt >= 3) return INVALID_MOVE;
  if (cp < 1 || cp > 4) return INVALID_MOVE;
  if (Array.isArray(objectives) === false) return INVALID_MOVE;
  if (objectives.some((id) => typeof id !== "string")) return INVALID_MOVE;

  // A home card printed "declare war using this card's CP value" (Bismarck,
  // Aux Armes, Russo-Turkish Wars, Jihad) leaves an entitlement when its event
  // resolves.  It funds this one declaration with the card's printed CP and
  // carries the card's own aim/target limits, so no ordinary impulse CP is
  // spent (errata 12.17: the card's CP all go into the war).
  const entitlement = warDeclarationEntitlement(G, power);
  const policy = entitlement !== null ? warDeclarationPolicy(entitlement.card) : null;
  if (entitlement !== null) {
    if (entitlement.aim !== null && entitlement.aim !== aim) return INVALID_MOVE;
    if (policy !== null && !policy.aims.includes(aim)) return INVALID_MOVE;
    if (cp !== entitlement.cp) return INVALID_MOVE;
  }

  // Rule 14.1: a card's two-power clause.  The printed wording names player
  // powers; a non-player target keeps the ordinary single-target 13.4 flow,
  // which suspends on the 13.4.1/13.4.2 ally decisions.
  const secondTarget = options.secondTarget;
  if (secondTarget !== undefined) {
    if (entitlement === null || policy === null) return INVALID_MOVE;
    if (!warDeclarationAllowsTwoPowers(entitlement.card, aim)) return INVALID_MOVE;
    if (!isPower(secondTarget) || secondTarget === power) return INVALID_MOVE;
    if (isMinorWarTargetArg(target)) return INVALID_MOVE;
    if (secondTarget === target) return INVALID_MOVE;
    if (hasTruce(G, power, secondTarget)) return INVALID_MOVE;
    if (!warDeclarationTargetLegal(G, entitlement, secondTarget)) return INVALID_MOVE;
    if (options.primary !== undefined && options.primary !== target && options.primary !== secondTarget) {
      return INVALID_MOVE;
    }
  } else if (options.primary !== undefined && options.primary !== target) {
    // A single-target declaration's primary is the target itself.
    return INVALID_MOVE;
  }
  if (options.forbidPlayers === true && (entitlement === null || !warDeclarationMayForbidJoins(entitlement.card))) {
    return INVALID_MOVE;
  }

  // Rule 13.4/13.5: resolve the player side of a non-player declaration.
  const minor: MinorWarInfo | null = isMinorWarTargetArg(target)
    ? minorWarInfo(G, power, target.minor)
    : null;
  if (isMinorWarTargetArg(target) && (minor === null || !minor.ok)) return INVALID_MOVE;

  let playerDefender: Power | null = null;
  let defenderForAim: PowerOrMinor;
  if (minor !== null) {
    if (minor.ally !== null) {
      playerDefender = minor.ally;
      defenderForAim = minor.ally;
    } else {
      // 13.4.2: the war aim is announced before the aid search, so the
      // objectives are validated against the non-player power itself.  A
      // unified Italy is not a player, so its control-marker id is the
      // defender for validation purposes.
      defenderForAim = minorWarDefender(minor);
    }
  } else {
    if (!isPower(target)) return INVALID_MOVE;
    if (power === target) return INVALID_MOVE;
    // Rule 13.5: players cannot break truces.
    if (hasTruce(G, power, target)) return INVALID_MOVE;
    playerDefender = target;
    defenderForAim = target;
  }
  // A card-driven declaration only names the defenders its printed target list
  // allows (Russo-Turkish Wars: OT; Jihad: RU or an Ottoman-home controller).
  // 13.4 resolves a non-player target to its player ally first, so Jihad on a
  // Russian minor ally is correctly a declaration on Russia.  A two-power
  // clause checks the second power through the same lens.
  if (!warDeclarationTargetLegal(G, entitlement, defenderForAim)) return INVALID_MOVE;
  if (secondTarget !== undefined && !warDeclarationTargetLegal(G, entitlement, secondTarget)) {
    return INVALID_MOVE;
  }
  // Rule 13.0: validate the aim (and every objective's control) before the CP
  // is spent, so an illegal declaration never mutates the state.  A two-power
  // declaration may target objectives controlled by either defender.
  const declaredDefenders: PowerOrMinor[] | undefined =
    secondTarget !== undefined ? [defenderForAim, secondTarget] : undefined;
  const validation = validateWarAim(G, power, defenderForAim, aim, objectives, {
    ruRussoTurkishWars: policy?.russianBalkanLiberation === true,
    conquestKeyLimit: policy?.conquestKeyLimit,
    ...(declaredDefenders !== undefined ? {defenders: declaredDefenders} : {}),
  });
  if (!validation.ok) return INVALID_MOVE;
  if (entitlement !== null) {
    // The declaration is paid for by the home card, not by impulse CP.  The
    // card id crosses the (possibly pending) aid search as a public game flag
    // so `finalizeWarDeclaration` can stamp `war.declarationCard` (Balance of
    // Power "cannot be played in response to Otto von Bismarck").
    G.flags.declarationCard = entitlement.card;
    // The optional clauses cross the Napoleon's Legacy decision the same way.
    if (secondTarget !== undefined) {
      G.flags.declarationSecond = secondTarget;
      G.flags.declarationPrimary = options.primary ?? defenderForAim;
    }
    if (options.forbidPlayers === true && warDeclarationMayForbidJoins(entitlement.card)) {
      G.flags.declarationForbid = true;
    }
    // Aux Armes: "if you do either [two keys or two different powers], neutral
    // powers can join the war against you."  Both halves are counted here.
    const keyCount = objectives.filter((id) => effectiveKeyType(G, id) !== undefined).length;
    if (warDeclarationNeutralJoinOnDouble(entitlement.card) && aim === "conquest"
      && (secondTarget !== undefined || keyCount >= 2)) {
      G.flags.declarationNeutralJoin = true;
    }
    clearWarDeclarationEntitlement(G, power);
  } else if (!spend(G, cp)) {
    return INVALID_MOVE;
  }
  G.powers[power].flags.actionCpSpentThisImpulse = true;
  // 33.3 Napoleon's Legacy: FR may reveal the goal as it launches a war of
  // conquest for a 2-point stability-loss discount.  The declaration is
  // already validated and paid for; the pending choice only decides the
  // reveal, then `finalizeWarDeclaration` creates the war.
  const legacy = napoleonsLegacyDecision(G, power, aim);
  if (legacy.offerReveal) {
    openDecision(
      G,
      ctx,
      decision(
        "napoleonsLegacy",
        "FR",
        "Napoleon's Legacy: reveal this National Goal for a 2-point stability discount?",
        [
          option("reveal", "Reveal Napoleon's Legacy (-2 stability loss)", undefined, false, "公开拿破仑的遗产（少受 2 点稳定度损失）"),
          option("decline", "Keep it secret (full stability loss)", undefined, false, "保守秘密（承受全部稳定度损失）"),
        ],
        {target: minor === null ? playerDefender : defenderForAim, minor: minor?.minor, aim, objectives: [...objectives], cp},
      ),
    );
    return undefined;
  }
  if (minor !== null) {
    return beginMinorWarDeclaration(G, ctx, power, minor, aim, objectives, cp, legacy.discount);
  }
  if (playerDefender === null) return INVALID_MOVE;
  return finalizeWarDeclaration(G, ctx, power, playerDefender, aim, objectives, cp, legacy.discount);
};

/**
 * Rule 8.2 / 14.2 — one declaration-driven defender shift, applied from
 * `declareWar`.
 *
 * When the direction is determined by the two chits the shift happens
 * immediately and is logged.  When both chits are in the neutral box the
 * printed choice belongs to the defender, so the war records the open choice
 * (`war.defenderShift.choice`) instead of guessing: the defender answers with
 * `chooseAllianceShift`, and `startWarManeuver` applies the deterministic
 * default (Triple Entente first, then Triple Alliance) at the alliance-shift
 * step if they have not.  Rule 8.4's printed exception is used here, so a
 * defender may be forced into an alliance that already has three players.
 */
const applyDefenderDeclarationShift = (
  G: ImperialElegyState,
  attacker: Power,
  defender: Power,
  side?: AllianceSide,
): void => {
  const war = G.war;
  if (!war) return;
  const result = declarationShift(G, attacker, defender, side);
  war.defenderShift = {
    from: result.from,
    to: result.to,
    steps: result.steps,
    forced: result.forced,
    choice: result.needsChoice,
  };
  if (result.needsChoice) {
    // Public notice: the defender's chit is still neutral until they choose.
    log(G, defender, "allianceShiftChoice", {attacker, from: result.from});
    return;
  }
  log(G, defender, "allianceShifted", {
    from: result.from,
    to: result.to,
    steps: result.steps,
    attacker,
    forced: result.forced,
  });
};

/**
 * Rule 8.2: "If both powers are in the neutral box, the defending power
 * chooses which alliance box to shift into."  Live move for the defender only.
 */
export const chooseAllianceShift = (
  G: ImperialElegyState,
  ctx: Ctx,
  side: "te" | "ta",
): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  const war = G.war;
  if (!war || power === null) return INVALID_MOVE;
  if (side !== "te" && side !== "ta") return INVALID_MOVE;
  if (!isPower(war.defender) || power !== war.defender) return INVALID_MOVE;
  if (war.status !== "warAim" && war.status !== "alliance") return INVALID_MOVE;
  if (war.defenderShift?.choice !== true) return INVALID_MOVE;
  if (G.pending !== null) return INVALID_MOVE;
  // Rule 8.1.2: a chit cannot enter the attacker's alliance box.
  if (sideOfAllianceBox(G.powers[war.attacker].alliance) === side) return INVALID_MOVE;
  // The 8.4 declaration exception applies to this forced shift.
  const result = declarationShift(G, war.attacker, power, side);
  if (result.needsChoice || result.steps === 0) return INVALID_MOVE;
  war.defenderShift = {
    from: result.from,
    to: result.to,
    steps: result.steps,
    forced: result.forced,
    choice: false,
  };
  log(G, power, "allianceShifted", {
    from: result.from,
    to: result.to,
    steps: result.steps,
    attacker: war.attacker,
    forced: result.forced,
    chosen: true,
    // 14.2: name the non-player power the declaration was aimed at, so the
    // public log reads "aiding Belgium" like the immediate shift path.
    ...(war.minorTarget ? {aidMinor: war.minorTarget.minor} : {}),
  });
  // 14.2 special: a neutral unified Italy shifts with the aiding ally once that
  // ally has chosen the both-neutral 8.2 direction.
  if (war.minorTarget?.minor === "Italy") applyItalyAidShift(G, side);
  return undefined;
};

/**
 * Rule 8.2 / 14.2: the defense shift belongs to the alliance-shift step, which
 * is the transition from the alliance step into the maneuver.  If the defender
 * never answered the both-neutral choice, apply the deterministic default so
 * the printed shift is never silently dropped (the rule expects a choice; this
 * is the documented fallback, Triple Entente first like the 8.6 default).
 */
const settleDefenderShiftChoice = (G: ImperialElegyState, war: WarState): void => {
  if (war.defenderShift?.choice !== true) return;
  // Rule 15.4.2: a lone non-player defender has no chit and no deferred 8.2
  // choice (an unaided unified Italy's shift is rolled at declaration time).
  if (!isPower(war.defender)) {
    war.defenderShift = null;
    return;
  }
  const defender = war.defender;
  const derived = declarationShiftDirection(
    G.powers[war.attacker].alliance,
    G.powers[defender].alliance,
  );
  const side: AllianceSide =
    derived ?? (canJoinAlliance(G, defender, "te") ? "te" : "ta");
  const result = declarationShift(G, war.attacker, defender, side);
  war.defenderShift = {
    from: result.from,
    to: result.to,
    steps: result.steps,
    forced: result.forced,
    choice: false,
  };
  log(G, defender, "allianceShifted", {
    from: result.from,
    to: result.to,
    steps: result.steps,
    attacker: war.attacker,
    forced: result.forced,
    fallback: true,
    ...(war.minorTarget ? {aidMinor: war.minorTarget.minor} : {}),
  });
  // 14.2 special: Italy's own chit follows the direction the default resolved.
  if (war.minorTarget?.minor === "Italy") applyItalyAidShift(G, side);
};

export const chooseWarAim = (G: ImperialElegyState, ctx: Ctx, aim: "liberation" | "unification" | "conquest"): string | void => {
  const playerID = ctx.playerID ?? null;
  if (!G.war || G.war.status !== "warAim") return INVALID_MOVE;
  // A card-funded declaration keeps its printed aim list and rules for the
  // whole aim step (13.1.2's Balkan liberation, Aux Armes' two conquest keys).
  const policy = G.war.declarationCard !== null && G.war.declarationCard !== undefined
    ? warDeclarationPolicy(G.war.declarationCard)
    : null;
  if (policy !== null && !policy.aims.includes(aim)) return INVALID_MOVE;
  // Re-check the aim against the live board: objectives may have changed
  // hands, and the declared aim may no longer satisfy rule 13.0.  A two-power
  // declaration validates against both attacked powers.
  const validation = validateWarAim(G, G.war.attacker, G.war.defender, aim, G.war.objectives, {
    ruRussoTurkishWars: policy?.russianBalkanLiberation === true,
    conquestKeyLimit: policy?.conquestKeyLimit,
    defenders: warDeclaredDefenders(G.war),
  });
  if (!validation.ok) return INVALID_MOVE;
  G.war.warAim = aim;
  G.war.status = "alliance";
  return undefined;
};

/**
 * Aux Armes, Citoyens!: "if you do either [two keys or two powers], neutral
 * powers can join the war against you."  Unlike 14.0/33.2 the volunteer acts
 * for itself; the join spends an event card and takes the ordinary 8.2 shift
 * away from the attacker, so 8.4's three-player cap still applies.
 */
export const joinWarAsNeutral = (G: ImperialElegyState, ctx: Ctx, cardId?: CardId): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  const war = G.war;
  if (power === null || war === null) return INVALID_MOVE;
  if (G.phase !== "wartime") return INVALID_MOVE;
  if (war.status !== "warAim" && war.status !== "alliance") return INVALID_MOVE;
  if (G.pending !== null || G.battle !== null) return INVALID_MOVE;
  if (!neutralJoinEligibility(G, war, power, {cardId}).ok) return INVALID_MOVE;
  if (!applyNeutralJoin(G, war, power, {cardId}).applied) return INVALID_MOVE;
  return undefined;
};

export const surrender = (G: ImperialElegyState, ctx: Ctx): string | void => {
  const playerID = ctx.playerID ?? null;
  const war = G.war;
  const power = actor(G, playerID);
  if (!war || power === null || !canSurrender(G, power)) return INVALID_MOVE;
  if (power === war.attacker && isPower(war.defender)) {
    // 15.5: only the defending primary can refuse an attacker's surrender.
    // Keep the entire maneuver state intact while the defending seat decides.
    openDecision(G, ctx, decision(
      "confirm", war.defender, "Accept the attacker's surrender or continue the war?",
      [
        option("accept", "Accept surrender (major victory)", undefined, false, "接受投降（重大胜利）"),
        option("refuse", "Refuse surrender; continue the war", undefined, false, "拒绝投降，继续战争"),
      ],
      {special: "attackerSurrender", attacker: war.attacker, defender: war.defender, startedTurn: war.startedTurn},
    ));
    log(G, power, "warSurrender", {result: "offered", attacker: war.attacker, defender: war.defender});
    return undefined;
  }
  // The defender cannot force a consent decision on the attacker. A lone
  // non-player defender has no seat, so an attacker's concession is accepted
  // automatically and classified by 15.4.2 without a player-only major award.
  if (power === war.defender) settleDefenderShiftChoice(G, war);
  war.status = "victory";
  war.victor = power === war.defender ? "attacker" : "defender";
  log(G, power, "warSurrender", {result: "surrendered", attacker: war.attacker, defender: war.defender});
  return undefined;
};

const resolveAttackerSurrender = (G: ImperialElegyState, ctx: Ctx, pending: PendingDecision, accept: boolean): string | void => {
  const war = G.war;
  const context = pending.context ?? {};
  if (!war || G.phase !== "wartime" || G.gw?.active || G.battle !== null || war.status !== "maneuver" ||
      war.victor !== null || pending.power !== war.defender || context.attacker !== war.attacker ||
      context.defender !== war.defender || context.startedTurn !== war.startedTurn) return INVALID_MOVE;
  G.pending = null;
  if (accept) {
    war.status = "victory";
    war.victor = "defender";
  }
  log(G, war.defender, "warSurrender", {result: accept ? "accepted" : "refused", attacker: war.attacker, defender: war.defender});
  return undefined;
};

/**
 * Rule 14.3 pass order.  The initiative recorded when the maneuver started is
 * authoritative; any ally that joined afterwards is appended in side order so
 * it is not silently skipped by the all-passed check.
 */
const warPassOrder = (G: ImperialElegyState, war: WarState): Power[] => {
  const belligerents = belligerentsOf(war);
  if (war.initiative.length === 0) return initiativeOrder(G, war);
  const ordered = war.initiative.filter((power) => belligerents.includes(power));
  return [...ordered, ...belligerents.filter((power) => !ordered.includes(power))];
};

const recordWarPass = (G: ImperialElegyState, ctx: Ctx, power: Power): string | void => {
  const war = G.war;
  if (!war || G.pending !== null) return INVALID_MOVE;
  if (!belligerentsOf(war).includes(power)) return INVALID_MOVE;
  // 33.1 Superior Staff Work: GE's free deploy reserves action is only
  // available during its first impulse; passing forfeits it (once per war).
  if (power === "GE" && superiorStaffWorkFreeDeploy(G, power, war)) {
    G.powers.GE.flags.superiorStaffWorkUsed = true;
    log(G, "GE", "superiorStaffWorkDeclined", {scope: "war"});
  }
  if (!war.passed.includes(power)) war.passed.push(power);
  const order = warPassOrder(G, war);
  // When every belligerent has passed the war is settled through the shared
  // classifyVictory + settleLimitedWar path.
  if (order.every((p) => war.passed.includes(p))) return resolveWar(G, ctx);
  const next = order.find((p) => !war.passed.includes(p));
  if (next) {
    G.activePower = next;
    clearWarImpulseSpend(G);
    // 5.5.3 / 5.6.2: the next belligerent's start-of-maneuver penalties.
    beginImpulseUpkeep(G, ctx, next);
  }
  return undefined;
};

export const passWar = (G: ImperialElegyState, ctx: Ctx): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  if (!G.war || power === null) return INVALID_MOVE;
  return recordWarPass(G, ctx, power);
};

// ------------------------------------------------------------------ battle choices
export const chooseSupportMove = (G: ImperialElegyState, ctx: Ctx, spaceOrDone: string): string | void => {
  const playerID = ctx.playerID ?? null;
  if (!G.battle || !G.pending || G.pending.kind !== "combatSupport") return INVALID_MOVE;
  chooseSupport(G, ctx, spaceOrDone);
  return undefined;
};

export const chooseLossMove = (G: ImperialElegyState, ctx: Ctx, unitId: string): string | void => {
  const playerID = ctx.playerID ?? null;
  if (!G.battle || !G.pending || G.pending.kind !== "combatLosses") return INVALID_MOVE;
  chooseLoss(G, ctx, unitId);
  return undefined;
};

const finalizePendingCard = (G: ImperialElegyState, ctx: Ctx): void => {
  if (G.pending !== null) return;
  const cardId = G.flags.pendingCard as CardId | undefined;
  if (!cardId) return;
  const mandatory = G.flags.pendingMandatory === true;
  const chained = G.flags.pendingCardChained === true;
  delete G.flags.pendingCard;
  delete G.flags.pendingMandatory;
  delete G.flags.pendingCardChained;
  const response = G.flags.pendingResponse === true;
  delete G.flags.pendingResponse;
  const gwCard = G.flags.pendingGwCard === true;
  delete G.flags.pendingGwCard;
  const card = cardById(cardId);
  if (chained) {
    // 12.14: the card lives in the CP Chain and is discarded when the action
    // phase ends, not when its mandatory event finishes resolving.
  } else if (!gwCard && removesAfterPlay(G, cardId)) {
    removeCard(G, cardId);
  } else if (!gwCard && card.kind !== "home" && !isHeldAsIndustryCard(G, cardId)) {
    // A027 Foreign Investment is parked as the receiving player's
    // industrialization card while its decision resolves; discarding it here
    // would leave one physical card in two zones.
    G.discard.push(cardId);
  }
  pruneRemovedFromDiscard(G);
  G.resolvingCard = null;
  G.impulseCard = null;
  if (chained) {
    // A chain insertion is one impulse; resume the next player once its
    // mandatory event has finished (unless the event itself granted CP).
    if (G.cpRemaining <= 0) finishImpulse(G, ctx);
  } else if (
    !(gwCard && hasLiveGwImpulse(G)) &&
    !mandatory &&
    !response &&
    G.cpRemaining <= 0 &&
    // A home-card war declaration (Bismarck, Aux Armes, Russo-Turkish Wars,
    // Jihad) belongs to this impulse even when its event paused on a printed
    // choice: the seat declares the war now or hands the impulse over.
    warDeclarationEntitlement(G, G.activePower) === null
  ) {
    // 27.1: a GW card's pending decision must not finish the action-phase
    // impulse. Legacy states keep the old action-phase finalization.
    finishImpulse(G, ctx);
  }
};

/** Remove the one-shot flags consumed while a limited war is settled. */
const clearWarSettlementFlags = (G: ImperialElegyState): void => {
  delete G.flags.limitedWarAttackerStart;
  delete G.flags.negotiatedPeace;
  delete G.flags.whitePeace;
  delete G.flags.defenderBlockading;
};

/**
 * Reset every known `duration: "war"` card flag.  `effects.ts` writes these
 * directly onto `G.flags`, so without an explicit reset they survive the war
 * and are inherited by the next one (e.g. `warLandDrm` would keep boosting
 * land battles, `rapidMobilization` would keep the initiative bonus).
 *
 * Game-duration flags live on `G.persistent` and are intentionally untouched.
 * The defaults mirror the `duration: "war"` effects in `cards.data.ts`.
 */
export const WAR_DURATION_FLAG_DEFAULTS: Readonly<Record<string, number | boolean>> = {
  warLandDrm: 0,
  rapidMobilization: false,
};

/** Clear the war-duration flags once a war has demobilized. */
export const clearWarDurationFlags = (G: ImperialElegyState): void => {
  for (const [flag, value] of Object.entries(WAR_DURATION_FLAG_DEFAULTS)) {
    G.flags[flag] = value;
  }
  // A063 also stamps the belligerent that played it so the Maneuver Step can
  // honour the initiative bonus; that marker belongs to the war too.
  for (const power of POWERS) {
    delete G.powers[power].flags.rapidMobilization;
    delete G.powers[power].flags.rapidFreeDeployUsed;
    delete G.powers[power].flags.superiorStaffWorkUsed;
    delete G.powers[power].flags.superiorStaffWorkDeclined;
  }
};

const victoryFromTreatyPending = (pending: PendingDecision): VictoryClassification | null => {
  const value = pending.context?.victory;
  return value !== null && typeof value === "object" ? (value as VictoryClassification) : null;
};

const treatyAppliedFromPending = (pending: PendingDecision): TreatyChoice[] =>
  Array.isArray(pending.context?.applied) ? (pending.context!.applied as TreatyChoice[]) : [];

const treatyRemainingFromPending = (pending: PendingDecision, victory: VictoryClassification): number =>
  Number(pending.context?.remaining ?? victory.totalTreatyOptions);

/** Powers whose treaty option has already been answered (16.1.6). */
const treatyAppliedTargets = (applied: readonly TreatyChoice[]): Power[] =>
  applied
    .map((choice) => choice.target)
    .filter((target): target is Power => typeof target === "string" && target.length > 0);

/** How many primary-outcome picks were already spent. */
const appliedPrimaryPicks = (applied: readonly TreatyChoice[], victory: VictoryClassification): number =>
  applied.filter((choice) => !victory.allyKnockouts.some((knockout) => knockout.power === choice.target)).length;

/** Sides whose optional primary picks were explicitly skipped with `done`. */
const treatySkippedSides = (pending: PendingDecision): WarSideName[] =>
  Array.isArray(pending.context?.skippedSides)
    ? (pending.context!.skippedSides as unknown[]).filter(
        (side): side is WarSideName => side === "attacker" || side === "defender",
      )
    : [];

/** The war side a pending's stage belongs to (white peace: attacker first). */
const treatyStageSide = (pending: PendingDecision, victory: VictoryClassification): WarSideName => {
  const firstSide: WarSideName = firstTreatySide(victory) ?? "attacker";
  const secondSide: WarSideName = firstSide === "attacker" ? "defender" : "attacker";
  return pending.context?.stage === "loser" ? secondSide : firstSide;
};

/**
 * Open the next `treatyOption` decision for one chooser group.  A `done` option
 * lets the chooser stop early when only optional primary picks remain; the
 * ally-knockout picks are mandatory (rule 16.1.6), so `done` is withheld while
 * a legal knockout allocation in this group remains.
 */
const openWarTreatyOption = (
  G: ImperialElegyState,
  ctx: Ctx,
  victory: VictoryClassification,
  group: TreatyChooserGroup,
  applied: readonly TreatyChoice[],
  skippedSides: readonly WarSideName[],
  groups: readonly TreatyChooserGroup[],
): boolean => {
  const war = G.war;
  if (!war) return false;
  const firstSide: WarSideName = firstTreatySide(victory) ?? "attacker";
  const firstStage = group.side === firstSide;
  const appliedTargets = treatyAppliedTargets(applied);
  const outstanding = group.targets.filter((target) => !appliedTargets.includes(target));
  const primaryRemaining = Math.max(0, group.primary - appliedPrimaryPicks(applied, victory));
  if (primaryRemaining + outstanding.length <= 0) return false;
  const picks: TreatyPickAvailability = {
    primary: primaryRemaining > 0,
    knockout: firstStage && outstanding.length > 0,
    loserKnockout: !firstStage && outstanding.length > 0,
    ...(firstStage ? {knockoutTargets: outstanding} : {loserChooser: group.power, loserTargets: outstanding}),
  };
  const entries = treatyOptionsFor(G, war, victory, picks);
  if (entries.length === 0) return false;
  // Total outstanding knockout options per side, for the chooser's display.
  const outstandingBySide = (side: WarSideName): number =>
    groups
      .filter((entry) => entry.side === side)
      .reduce(
        (count, entry) => count + entry.targets.filter((target) => !appliedTargets.includes(target)).length,
        0,
      );
  const firstOutstanding = outstandingBySide(firstSide);
  const secondSide: WarSideName = firstSide === "attacker" ? "defender" : "attacker";
  const secondOutstanding = outstandingBySide(secondSide);
  const pending = buildTreatyPending(G, group.power, entries, {
    victory,
    remaining: primaryRemaining + outstanding.length,
    applied,
    remainingPrimary: primaryRemaining,
    remainingKnockout: firstStage ? firstOutstanding : 0,
    remainingLoserKnockout: secondOutstanding,
    stage: firstStage ? "winner" : "loser",
    skippedSides,
  });
  // Rule 16.2.1: a victorious attacker in a liberation / Italian-unification
  // war cannot finish before selecting territorial cession.
  const mandatoryCession =
    group.side === "attacker" &&
    primaryRemaining > 0 &&
    mandatoryCessionPending(war, victory, applied);
  // Rule 16.1.6: knockout treaty options are awarded, not optional.
  if (outstanding.length === 0 && !mandatoryCession) {
    pending.options.push({id: "done", label: "Finish treaties"});
  }
  openDecision(G, ctx, pending);
  return true;
};

/**
 * Rule 16.1.6 settlement order: the first side's primary pick and its own
 * knockout options, then one mandatory group per power on the second side that
 * made a knockout.  A group with no legal option left (every treaty already
 * used) is skipped so the mandatory sequence cannot deadlock.  A side whose
 * primary picks were explicitly finished with `done` is not reopened.
 */
const openNextTreatyStage = (
  G: ImperialElegyState,
  ctx: Ctx,
  victory: VictoryClassification,
  applied: readonly TreatyChoice[],
  skippedSides: readonly WarSideName[] = [],
): boolean => {
  const war = G.war;
  if (!war) return false;
  const groups = treatyChooserGroups(war, victory);
  for (const group of groups) {
    if (skippedSides.includes(group.side)) continue;
    if (openWarTreatyOption(G, ctx, victory, group, applied, skippedSides, groups)) return true;
  }
  return false;
};

/** Open the follow-up space decision for an option that needs a target. */
const openWarTreatySpace = (
  G: ImperialElegyState,
  ctx: Ctx,
  pending: PendingDecision,
  chosen: PendingDecision["options"][number],
): boolean => {
  const victory = victoryFromTreatyPending(pending);
  if (!victory) return false;
  const entry = (chosen.data ?? {}) as unknown as TreatyOptionEntry;
  const spaces = treatySpaceOptions(G, entry, victory);
  if (spaces.length === 0) return false;
  const remaining = treatyRemainingFromPending(pending, victory);
  openDecision(G, ctx, {
    kind: "treatySpace",
    power: pending.power,
    prompt: "Choose a treaty space",
    promptArgs: {
      option: String(chosen.data?.option ?? ""),
      winner: victory.winner ?? "",
      winnerLabel: String(chosen.data?.winnerLabel ?? ""),
      remaining,
    },
    options: spaces,
    context: {
      ...(pending.context ?? {}),
      victory,
      option: chosen.data?.option,
      choice: chosen.data?.choice,
      pick: chosen.data?.pick,
      remaining,
      applied: treatyAppliedFromPending(pending),
    },
    blocking: true,
  });
  return true;
};

/** Open the follow-up realignment minor-power decision. */
const openWarTreatyMinor = (
  G: ImperialElegyState,
  ctx: Ctx,
  pending: PendingDecision,
  chosen: PendingDecision["options"][number],
): boolean => {
  const victory = victoryFromTreatyPending(pending);
  if (!victory) return false;
  const entry = (chosen.data ?? {}) as unknown as TreatyOptionEntry;
  const options = treatyMinorOptions(entry);
  // A single legal minor is unambiguous (and the GE unification special has
  // none); only ask the winner when there is a real choice.
  if (options.length <= 1) return false;
  const remaining = treatyRemainingFromPending(pending, victory);
  openDecision(G, ctx, {
    kind: "treatySpace",
    power: pending.power,
    prompt: "Choose a minor power",
    promptArgs: {
      option: "realignment",
      winner: victory.winner ?? "",
      winnerLabel: String(chosen.data?.winnerLabel ?? ""),
      remaining,
    },
    options,
    context: {
      ...(pending.context ?? {}),
      kind: "minor",
      victory,
      option: "realignment",
      choice: chosen.data?.choice,
      pick: chosen.data?.pick,
      remaining,
      applied: treatyAppliedFromPending(pending),
    },
    blocking: true,
  });
  return true;
};

/** Reconstruct the applied choice for a follow-up `treatySpace` selection. */
const treatySpaceChoice = (
  pending: PendingDecision,
  chosen: PendingDecision["options"][number],
): TreatyChoice | null => {
  const option = chosen.data?.option;
  if (typeof option !== "string") return null;
  const base = (pending.context?.choice as TreatyChoice | undefined) ?? null;
  const target = base?.target;
  if (pending.context?.kind === "minor" || option === "realignment") {
    const minor = typeof chosen.data?.minor === "string" ? chosen.data.minor : chosen.id;
    if (!minor) return null;
    const beneficiary = base?.beneficiary;
    return {
      option: "realignment",
      minor,
      ...(beneficiary ? {beneficiary} : {}),
      ...(target ? {target} : {}),
    };
  }
  const space = typeof chosen.data?.space === "string" ? (chosen.data.space as SpaceId) : undefined;
  const beneficiary = base?.beneficiary;
  if (option === "territorialCession") {
    return {
      option,
      spaces: space ? [space] : [],
      ...(beneficiary ? {beneficiary} : {}),
      ...(target ? {target} : {}),
    };
  }
  if (option === "righteousDefense" || option === "colonialCession") {
    return {option, space, ...(beneficiary ? {beneficiary} : {}), ...(target ? {target} : {})};
  }
  return null;
};

/**
 * National characteristics that resolve when a limited war ends (33.3/33.6):
 * FR's Second Empire becomes the Third Republic after losing a war, and the
 * Ottomans discard every Jihad marker at the end of a war.
 */
export const applyWarEndCharacteristics = (G: ImperialElegyState, ctx: Ctx): void => {
  const war = G.war;
  if (!war) return;
  // 33.2 The Indian Army: "Indian armies automatically displace ... at the
  // conclusion of a war the UK participated in."  As a primary belligerent or
  // an ally; the UK's units stay on the map.
  if (belligerentsOf(war).includes("UK")) displaceIndianArmies(G, "warEnd");
  const france = frLostWar(G, war);
  // A44 Paris Commune: "Play during the Victory Step of a war in which France
  // lost."  The war record is archived after this step, so stamp the trigger.
  if (france.side !== null && france.victor !== null && france.victor !== france.side) {
    G.flags.frLostWarTurn = G.turn;
  }
  if (france.applies) changeStability(G, "FR", 0, ctx, {lostWar: true});
  // 33.5 The Second Rome: a won war with Istanbul occupied hands RU the space.
  const rome = secondRome(G, war);
  if (rome.applies) {
    setSpaceControl(G, "istanbul", "RU");
    G.spaces.istanbul.homeOverride = "RU";
    // If RU takes Istanbul, Ankara becomes the Ottoman capital (33.5 special).
    G.persistent.otCapital = "ankara";
    log(G, "RU", "secondRome", {space: "istanbul"});
  }
  const markers = G.powers.OT.jihad ?? 0;
  if (markers > 0) {
    G.powers.OT.jihad = 0;
    log(G, "OT", "jihadDiscarded", {markers});
  }
};

/**
 * 33.1 German Confederation: annex one German minor ally.  The minor's control
 * marker becomes a GE control marker, every unit it owns is removed, the minor
 * is permanently eliminated and its space becomes a permanent GE home space.
 */
const applyGermanConfederation = (
  G: ImperialElegyState,
  ctx: Ctx,
  space: SpaceId,
): boolean => {
  const candidate = germanConfederationCandidates(G).find((entry) => entry.space === space);
  const state = G.spaces[space];
  if (!candidate || !state) return false;
  const minor = candidate.minor;
  // Remove the minor's units everywhere, including elite steps attached to them.
  const removed = new Set<string>();
  for (const [id, unit] of Object.entries(G.units)) {
    if (unit.owner === minor) removed.add(id);
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const [id, unit] of Object.entries(G.units)) {
      if (removed.has(id)) continue;
      if (unit.attachedTo && removed.has(unit.attachedTo)) {
        removed.add(id);
        grew = true;
      }
    }
  }
  for (const id of removed) {
    const unit = G.units[id];
    if (unit?.space && G.spaces[unit.space]) {
      G.spaces[unit.space].units = G.spaces[unit.space].units.filter((unitId) => unitId !== id);
    }
    delete G.units[id];
  }
  setSpaceControl(G, space, "GE", {clearInfluence: true, clearDiplomacy: true});
  state.ally = null;
  // "Whenever GE takes control of a German unification space it becomes a
  // permanent home space."
  state.homeOverride = "GE";
  const eliminated = G.eliminatedMinors ?? (G.eliminatedMinors = []);
  if (!eliminated.includes(minor)) eliminated.push(minor);
  if (G.nonPlayerBuildBox) {
    G.nonPlayerBuildBox.minors = G.nonPlayerBuildBox.minors.filter((entry) => entry !== minor);
  }
  recomputeTracks(G);
  checkGermanUnification(G, ctx);
  log(G, "GE", "germanConfederation", {minor, space});
  return true;
};

interface GermanConfederationContinuation {
  mode: "liveWar" | "postSettlement";
  freeActions?: {power: Power; side: "attacker" | "defender"; order: 1 | 2}[];
}

/**
 * Open the 33.1 German Confederation choice after a won GE war of unification.
 * Returns true when a pending decision was opened.  `mode` tells the resolver
 * whether the war still needs demobilizing (`liveWar`) or was already settled
 * by the direct `settleLimitedWar` path (`postSettlement`).
 */
const openGermanConfederation = (
  G: ImperialElegyState,
  ctx: Ctx,
  continuation: GermanConfederationContinuation,
): boolean => {
  const candidates = germanConfederationCandidates(G);
  if (candidates.length === 0) return false;
  const options = candidates.map((entry) =>
    option(
      entry.space,
      `Take control of ${entry.minor}`,
      undefined,
      false,
      `控制${minorLabel(entry.minor, "zh_CN")}`,
    ),
  );
  options.push(option("decline", "Do not take control of a German minor"));
  openDecision(
    G,
    ctx,
    decision(
      "germanConfederation",
      "GE",
      "German Confederation: take control of one German minor ally",
      options,
      {mode: continuation.mode, freeActions: continuation.freeActions},
      {candidates: candidates.map((entry) => entry.minor).join(",")},
    ),
  );
  return true;
};

/** Resume the settlement after the German Confederation decision. */
const resolveGermanConfederation = (
  G: ImperialElegyState,
  ctx: Ctx,
  pending: PendingDecision,
  optionId: string,
): string | void => {
  const continuation: GermanConfederationContinuation = {
    mode: pending.context?.mode === "postSettlement" ? "postSettlement" : "liveWar",
    freeActions: Array.isArray(pending.context?.freeActions)
      ? (pending.context!.freeActions as GermanConfederationContinuation["freeActions"])
      : undefined,
  };
  if (optionId === "decline") {
    log(G, "GE", "germanConfederationDeclined", {});
  } else if (!applyGermanConfederation(G, ctx, optionId)) {
    return INVALID_MOVE;
  }
  G.pending = null;
  if (continuation.mode === "liveWar") return completeWarSettlement(G, ctx);
  // The direct path already demobilized and archived the war; only the rule
  // 17.0 free actions and the one-shot settlement flags are still pending.
  beginDemobilizationFreeActions(G, ctx, continuation.freeActions ?? []);
  clearWarSettlementFlags(G);
  clearWarDurationFlags(G);
  clearWarImpulseSpend(G);
  clearActionImpulseSpend(G);
  return undefined;
};

/**
 * The Balance of Power card's end-of-war draw: "If you enter the war, draw a
 * card at the end of the war.  One player (your choice) that you invited (and
 * that joined) also draws a card at the end of the war."  The recording lives
 * on `war.postWarDraws`; this runs before demobilizeWar archives the war.
 */
const drawPostWarCards = (G: ImperialElegyState, ctx: Ctx, war: WarState): void => {
  for (const power of war.postWarDraws ?? []) {
    if (G.powers[power]?.eliminated) continue;
    // `drawCards` logs the public `cardsDrawn` entry.
    drawCards(G, ctx, power, 1);
  }
};

type PostWarDrawContinuation =
  | {mode: "interactive"; applied: readonly TreatyChoice[]}
  | {mode: "immediate"; victory: VictoryClassification; choices: readonly TreatyChoice[]};

/** Balance of Power: the UK chooses exactly one invited ally, after the war. */
const preparePostWarDraws = (G: ImperialElegyState, ctx: Ctx, continuation: PostWarDrawContinuation): boolean => {
  const war = G.war;
  if (!war || !(war.postWarDraws ?? []).includes("UK")) return false;
  // Older saves put every invited joiner directly into postWarDraws. Recover
  // that candidate list before replacing it with the printed two recipients.
  const candidates = [...new Set(war.postWarDrawCandidates ?? war.postWarDraws!.filter((power) => power !== "UK"))]
    .filter((power) => war.defenderAllies.includes(power) && !G.powers[power].eliminated);
  war.postWarDrawCandidates = candidates;
  const selected = war.postWarDrawChoice;
  if (selected !== undefined && candidates.includes(selected)) {
    war.postWarDraws = ["UK", selected];
    return false;
  }
  if (candidates.length <= 1) {
    war.postWarDraws = ["UK", ...candidates];
    if (candidates.length === 1) war.postWarDrawChoice = candidates[0];
    return false;
  }
  openDecision(G, ctx, decision(
    "eventTargetPower", "UK", "Balance of Power: choose one invited ally to draw a card",
    candidates.map((power) => option(power, POWER_DEFS[power].name, undefined, false, POWER_DEFS[power].nameZh)),
    {special: "balanceOfPowerDraw", continuation, required: true},
  ));
  return true;
};

const resolvePostWarDrawChoice = (G: ImperialElegyState, ctx: Ctx, pending: PendingDecision, chosen: string): string | void => {
  const war = G.war;
  const continuation = pending.context?.continuation as PostWarDrawContinuation | undefined;
  if (!war || !continuation || !isPower(chosen) || !war.postWarDrawCandidates?.includes(chosen) ||
      !war.defenderAllies.includes(chosen) || G.powers[chosen].eliminated) return INVALID_MOVE;
  war.postWarDrawChoice = chosen;
  war.postWarDraws = ["UK", chosen];
  G.pending = null;
  return continuation.mode === "interactive"
    ? finishWarSettlement(G, ctx, continuation.applied)
    : settleWarImmediately(G, ctx, continuation.victory, continuation.choices);
};

/**
 * 22.2: the winner of an Italian unification war receives 2 free CP to
 * influence Italy's own MPIT column.  The grant is a same-turn allowance;
 * `placeItalyMpit` spends it without touching the war budget.
 */
const grantItalianUnificationMpitCp = (
  G: ImperialElegyState,
  war: WarState,
  victor: "attacker" | "defender" | null,
): void => {
  if (!isItalianUnificationWar(war)) return;
  const winner = victor === "defender" && isPower(war.defender) ? war.defender : war.attacker;
  G.flags.italyUnificationMpitCp = 2;
  G.flags.italyUnificationMpitCpTurn = G.turn;
  G.flags.italyUnificationMpitCpPower = winner;
  log(G, winner, "italyUnificationMpitCp", {cp: 2});
};

/** Demobilize the settled war and open the rule 17.0 free actions. */
const completeWarSettlement = (G: ImperialElegyState, ctx: Ctx): string | void => {
  const war = G.war;
  if (!war) return INVALID_MOVE;
  drawPostWarCards(G, ctx, war);
  grantItalianUnificationMpitCp(G, war, war.victor);

  // 33.1 German Confederation: every space GE gained by the treaties becomes a
  // permanent home space now, before the demobilization free actions.
  applyGermanConfederationHomeOverrides(G);
  const demobilization = demobilizeWar(G, war, ctx);
  if (!demobilization.ok) return INVALID_MOVE;
  G.flags.postWarWinner = demobilization.activePower;
  // Rule 17.0: offer the free redeployment / naval movement actions (winner
  // side first) before handing the action phase back.
  beginDemobilizationFreeActions(G, ctx, demobilization.freeActions);
  clearWarSettlementFlags(G);
  clearWarDurationFlags(G);
  clearWarImpulseSpend(G);
  clearActionImpulseSpend(G);
  return undefined;
};

/**
 * Rule 17.0: the player who receives the next action phase after the war.  A
 * lone non-player defender cannot take it (15.4.2), so the attacker keeps the
 * impulse; otherwise the winning primary does.
 */
const postWarWinnerFor = (war: WarState, victor: "attacker" | "defender" | null): Power =>
  victor === "defender" && isPower(war.defender) ? war.defender : war.attacker;

/** Apply the primary outcome, clear the war and hand back the action phase. */
const finishWarSettlement = (G: ImperialElegyState, ctx: Ctx, applied: readonly TreatyChoice[] = []): string | void => {
  const war = G.war;
  if (!war) return INVALID_MOVE;
  if (preparePostWarDraws(G, ctx, {mode: "interactive", applied})) return undefined;
  applyHarshTerms(G, war, applied, ctx);
  // 33.3 / 33.6: resolves against the war that is being settled, before the
  // war state is handed to demobilizeWar.
  applyWarEndCharacteristics(G, ctx);
  // actionBegin runs after the move; seed the winner before the phase event.
  G.flags.postWarWinner = postWarWinnerFor(war, war.victor);
  // 33.1 German Confederation: after the treaties are applied (so a minor
  // gained through the realignment option is eligible), GE may annex one ally.
  if (war.warAim === "unification" && war.attacker === "GE" && war.victor === "attacker") {
    if (openGermanConfederation(G, ctx, {mode: "liveWar"})) return undefined;
  }
  return completeWarSettlement(G, ctx);
};

const settleWarImmediately = (
  G: ImperialElegyState,
  ctx: Ctx,
  victory: VictoryClassification,
  choices: readonly TreatyChoice[],
): string | void => {
  const war = G.war;
  if (!war) return INVALID_MOVE;
  // 16.2.1: an explicit settlement cannot decline the mandatory cession.
  // Reject before any war-end side effect so the war can be settled again.
  if (mandatoryCessionPending(war, victory, choices)) {
    log(G, undefined, "warSettlementIssues", {issues: "mandatory-cession-missing"});
    return undefined;
  }
  if (preparePostWarDraws(G, ctx, {mode: "immediate", victory, choices})) return undefined;
  applyWarEndCharacteristics(G, ctx);
  drawPostWarCards(G, ctx, war);
  grantItalianUnificationMpitCp(G, war, victory.victor);
  G.flags.postWarWinner = postWarWinnerFor(war, victory.victor);
  const geWonUnification =
    war.warAim === "unification" && war.attacker === "GE" && victory.victor === "attacker";
  // 33.2.2: an explicit settlement must not cede independent India either.
  // Skip such a choice with a log; `settleLimitedWar` never sees it.
  const safeChoices = choices.filter((choice) => {
    const touchesIndia =
      choice.space === "india" || (choice.spaces ?? []).includes("india");
    if (touchesIndia && isIndependentIndia(G, "india")) {
      log(G, undefined, "indiaMarkerRejected", {space: "india", marker: "control"});
      return false;
    }
    return true;
  });
  const settlement = settleLimitedWar(G, victory, safeChoices, ctx);
  // 33.1 German Confederation: a treaty/conquest gain of a German unification
  // space becomes a permanent GE home space.
  applyGermanConfederationHomeOverrides(G);
  if (settlement.demobilization) {
    // 5.7 / 16.2.1: ceded or liberated spaces expel the new controller's enemies.
    for (const treaty of settlement.treaties) {
      if (treaty.applied) displaceAfterTreaty(G, treaty.affectedSpaces);
    }
    G.flags.postWarWinner = settlement.demobilization.activePower;
    if (
      geWonUnification &&
      openGermanConfederation(G, ctx, {
        mode: "postSettlement",
        freeActions: settlement.demobilization.freeActions,
      })
    ) {
      if (!settlement.ok) {
        log(G, undefined, "warSettlementIssues", {issues: settlement.issues.join(",")});
      }
      return undefined;
    }
    beginDemobilizationFreeActions(G, ctx, settlement.demobilization.freeActions);
    clearWarSettlementFlags(G);
    clearWarDurationFlags(G);
    clearWarImpulseSpend(G);
    clearActionImpulseSpend(G);
  } else {
    delete G.flags.postWarWinner;
  }
  if (!settlement.ok) {
    log(G, undefined, "warSettlementIssues", {issues: settlement.issues.join(",")});
  }
  return undefined;
};

/**
 * 5.7 / 16.2.1: a treaty that cedes or liberates a space leaves the new
 * controller's enemies sitting in it.  Displace every unit that is not
 * friendly to that controller through the reusable 5.7 helper (closest friendly
 * controlled space with a LoC, or elimination when none exists).
 */
const displaceAfterTreaty = (G: ImperialElegyState, spaces: readonly SpaceId[]): void => {
  for (const space of spaces) {
    const state = G.spaces[space];
    if (!state) continue;
    // A liberation leaves the minor in control with the liberator recorded as
    // its ally; in that case the liberator is the friendly anchor (so its own
    // troops stay and the previous owner's troops leave).
    const keeper: PowerOrMinor | null = isPower(state.control)
      ? state.control
      : state.ally ?? state.control ?? null;
    if (keeper === null) continue;
    displaceUnitsNotFriendlyTo(G, space, keeper);
  }
};

/**
 * Rule 16.1.6: leaving one chooser's stage does not finish the settlement while
 * an optional primary pick or a later side's mandatory knockout option remains.
 */
const advanceTreatyStage = (
  G: ImperialElegyState,
  ctx: Ctx,
  pending: PendingDecision,
  victory: VictoryClassification,
): string | void => {
  const applied = treatyAppliedFromPending(pending);
  // `done`/decline ends this side's optional primary picks; the other side's
  // mandatory knockout options still have to be answered (16.1.6).
  const skipped = [...new Set([...treatySkippedSides(pending), treatyStageSide(pending, victory)])];
  if (openNextTreatyStage(G, ctx, victory, applied, skipped)) return undefined;
  return finishWarSettlement(G, ctx, applied);
};

const resolveWarTreatyPending = (
  G: ImperialElegyState,
  ctx: Ctx,
  pending: PendingDecision,
  optionId: string,
): string | void => {
  const war = G.war;
  const victory = victoryFromTreatyPending(pending);
  if (!war || !victory) return INVALID_MOVE;
  const chosen = pending.options.find((entry) => entry.id === optionId);
  if (!chosen) return INVALID_MOVE;

  if (pending.kind === "treatyOption" && optionId === "done") {
    G.pending = null;
    return advanceTreatyStage(G, ctx, pending, victory);
  }

  // Realignment with several legal minors: ask which one before applying.
  // Checked before the space branch so the entry's default minor never wins
  // silently.
  if (pending.kind === "treatyOption" && chosen.data?.requiresMinor === true) {
    const minors = Array.isArray(chosen.data?.minors) ? chosen.data.minors : [];
    if (minors.length > 1) {
      G.pending = null;
      if (openWarTreatyMinor(G, ctx, pending, chosen)) return undefined;
      // No openable chooser: fall through to the entry's validated default.
    }
  }

  if (pending.kind === "treatyOption" && chosen.data?.requiresSpace === true) {
    G.pending = null;
    if (openWarTreatySpace(G, ctx, pending, chosen)) return undefined;
    // No legal follow-up space: fall through to the entry's validated default.
  }

  const result = applyTreatyChoice(G, pending, optionId);
  if (!result.ok) {
    // 33.2.2: a stale/forged treaty cession into independent India is rejected
    // and logged; the pending decision stays open for another choice.
    if (result.issues.includes("independent-india")) {
      log(G, pending.power, "indiaMarkerRejected", {space: "india", marker: "control"});
    }
    return INVALID_MOVE;
  }
  // 5.7 / 16.2.1: enemy units in a ceded/liberated space are displaced.
  displaceAfterTreaty(G, result.result?.affectedSpaces ?? []);

  const choice =
    pending.kind === "treatyOption"
      ? ((chosen.data?.choice as TreatyChoice | undefined) ?? null)
      : treatySpaceChoice(pending, chosen);
  const applied = treatyAppliedFromPending(pending);
  const nextApplied = choice ? [...applied, choice] : applied;
  const skipped = treatySkippedSides(pending);
  G.pending = null;
  // The remaining picks are recomputed from `applied` and the live victory, so
  // a spent option (16.2: once per war) simply drops out of the next group.
  if (openNextTreatyStage(G, ctx, victory, nextApplied, skipped)) return undefined;
  return finishWarSettlement(G, ctx, nextApplied);
};

// ------------------------------------------------------------------ demobilization free actions
type DemobilizationSide = "attacker" | "defender";

interface DemobilizationQueueEntry {
  power: Power;
  side: DemobilizationSide;
  order: 1 | 2;
}

/** Pending context for the rule 17.0 free redeploy/naval sequence. */
interface DemobilizationContext {
  mode: "demobilization";
  stage: "select" | "destination";
  /** Powers still waiting after `current`, winner side first. */
  queue: DemobilizationQueueEntry[];
  current: DemobilizationQueueEntry;
  /** Units that already used their free move for this power. */
  moved: string[];
  /** Index of the archived war in `G.wars`. */
  warIndex: number;
  action?: "redeploy" | "naval";
  unitId?: string;
}

const demobilizationContext = (pending: PendingDecision): DemobilizationContext | null => {
  const context = pending.context as unknown as DemobilizationContext | undefined;
  if (!context || context.mode !== "demobilization") return null;
  return context;
};

/** A unit in `space` that is not this power's or a friendly ally's. */
const foreignUnitIn = (G: ImperialElegyState, power: Power, space: SpaceId, navalOnly: boolean): boolean => {
  for (const id of G.spaces[space]?.units ?? []) {
    const unit = G.units[id];
    if (!unit) continue;
    if (navalOnly && unit.naval !== true) continue;
    if (unit.owner === power) continue;
    if (isPower(unit.owner) && allied(G, unit.owner, power)) continue;
    if (!isPower(unit.owner) && G.spaces[space]?.ally === power) continue;
    return true;
  }
  return false;
};

const enemyFortIn = (G: ImperialElegyState, power: Power, space: SpaceId): boolean => {
  const fort = G.spaces[space]?.fort;
  if (!fort) return false;
  if (fort.power === power) return false;
  return !(isPower(fort.power) && allied(G, fort.power, power));
};

/** Rule 12.15 redeployment destinations, without the CP cost. */
const freeRedeployDestinations = (G: ImperialElegyState, power: Power, unit: Unit): SpaceId[] => {
  const from = unit.space;
  if (!from) return [];
  const out: SpaceId[] = [];
  for (const to of Object.keys(G.spaces)) {
    if (to === from || isNavalBox(to)) continue;
    const state = G.spaces[to];
    if (!state) continue;
    const endsFriendly =
      friendlySpace(G, to, power) || (state.influence === power && state.control === null);
    if (!endsFriendly) continue;
    // 12.15: a peacetime free redeployment is the same unlimited-distance
    // land move (wartime free actions keep the wartime movement rules).
    if (G.war === null && !G.gw?.active && !redeployLandPath(G, power, from, to)) continue;
    if (enemyFortIn(G, power, to)) continue;
    // The action must not start a battle: only empty/friendly stacks.
    if (foreignUnitIn(G, power, to, false)) continue;
    // 5.5.3: a free redeployment still cannot end overstacked.
    if (movementEndProblem(G, to, [unit]) !== null) continue;
    out.push(to);
  }
  return out;
};

/**
 * Rule 12.3 destination checks for a free naval move, without the path/gate
 * check (so a 3.4.1 permission prompt can be raised for an otherwise legal
 * destination).
 */
const freeNavalDestinationAllowed = (
  G: ImperialElegyState,
  power: Power,
  unit: Unit,
  to: SpaceId,
): boolean => {
  if (foreignUnitIn(G, power, to, true)) return false;
  if (!isNavalBox(to)) {
    // A port is only a legal destination when friendly (12.3).
    if (!friendlySpace(G, to, power) && G.spaces[to]?.control !== null) return false;
    if (enemyFortIn(G, power, to)) return false;
  }
  // 5.5.4: a free naval movement cannot end over a port's capacity.
  return movementEndProblem(G, to, [unit]) === null;
};

/** Rule 12.3 naval-movement destinations, without the CP cost. */
const freeNavalDestinations = (G: ImperialElegyState, power: Power, unit: Unit): SpaceId[] => {
  const from = unit.space;
  if (!from) return [];
  const out: SpaceId[] = [];
  for (const to of Object.keys(G.spaces)) {
    if (to === from) continue;
    // Rule 12.3: the free demobilisation naval move follows the same NMP path
    // as a normal naval move (the move layer charges no CP for it).
    if (!planNavalMove(G, power, from, to).ok) continue;
    if (!freeNavalDestinationAllowed(G, power, unit, to)) continue;
    out.push(to);
  }
  return out;
};

/**
 * 3.4.1: free-naval destinations that are otherwise legal and only fail on the
 * Dardanelles permission.  They are offered as explicit "(needs permission)"
 * options so choosing one raises the controller's decision; a unit whose only
 * moves are blocked stays selectable too.
 */
const freeNavalDardanellesDestinations = (
  G: ImperialElegyState,
  power: Power,
  unit: Unit,
): SpaceId[] => {
  const from = unit.space;
  if (!from) return [];
  const out: SpaceId[] = [];
  for (const to of Object.keys(G.spaces).sort()) {
    if (to === from) continue;
    if (!freeNavalDestinationAllowed(G, power, unit, to)) continue;
    const route = planNavalMove(G, power, from, to, {ignoreDardanellesGate: true});
    if (!route.ok) continue;
    if (firstDardanellesPermissionCrossing(G, power, route.path) === null) continue;
    out.push(to);
  }
  return out;
};

interface DemobilizationCandidate {
  unitId: string;
  action: "redeploy" | "naval";
  destinations: SpaceId[];
}

const demobilizationCandidates = (
  G: ImperialElegyState,
  power: Power,
  moved: readonly string[],
): DemobilizationCandidate[] => {
  const ids = Object.keys(G.units)
    .filter((id) => {
      const unit = G.units[id];
      return unit.owner === power && unit.kind !== "reserveArmy" && Boolean(unit.space) && !moved.includes(id);
    })
    .sort((a, b) => a.localeCompare(b, "en", {numeric: true}));
  const out: DemobilizationCandidate[] = [];
  for (const id of ids) {
    const unit = G.units[id];
    const action: "redeploy" | "naval" = unit.naval === true ? "naval" : "redeploy";
    const destinations =
      action === "naval" ? freeNavalDestinations(G, power, unit) : freeRedeployDestinations(G, power, unit);
    if (destinations.length > 0) {
      out.push({unitId: id, action, destinations});
    } else if (action === "naval" && freeNavalDardanellesDestinations(G, power, unit).length > 0) {
      // 3.4.1: the only legal-looking move needs the controller's permission,
      // so keep the unit selectable and ask when it is chosen.
      out.push({unitId: id, action, destinations: []});
    }
  }
  return out;
};

const demobilizationUnitLabel = (G: ImperialElegyState, unit: Unit, locale: "en" | "zh_CN" = "en"): string =>
  locale === "zh_CN"
    ? `${unitKindLabel(unit.kind, "zh_CN")}（${spaceLabel(unit.space ?? "", "zh_CN")}）`
    : `${unit.kind} in ${spaceLabel(unit.space ?? "", "en")}`;

/** Close the rule 17.0 chain and hand the action phase back. */
const finishDemobilizationFreeActions = (
  G: ImperialElegyState,
  ctx: Ctx,
  reason: "completed" | "declined" | "no-legal-action",
): string | void => {
  G.pending = null;
  log(G, undefined, "demobilizationFreeActionsFinished", {reason});
  // `demobilizeWar` already switched the phase; re-assert it for direct
  // callers and make sure the action phase is playable.
  if (G.phase !== "action") {
    G.phase = "action";
    ctx.events?.setPhase?.("action");
  }
  return undefined;
};

/** Open the free-action chooser for one power, skipping powers with nothing to do. */
const openDemobilizationSelect = (
  G: ImperialElegyState,
  ctx: Ctx,
  current: DemobilizationQueueEntry,
  queue: DemobilizationQueueEntry[],
  moved: string[],
  warIndex: number,
): boolean => {
  const candidates = demobilizationCandidates(G, current.power, moved);
  if (candidates.length === 0) {
    log(G, current.power, "demobilizationFreeActionSkipped", {reason: "no-legal-action"});
    return advanceDemobilization(G, ctx, queue, warIndex);
  }
  const options: PendingDecision["options"] = candidates.map((candidate) => {
    const unit = G.units[candidate.unitId];
    return {
      id: `${candidate.action}:${candidate.unitId}`,
      label: `${candidate.action === "redeploy" ? "Free redeploy" : "Free naval move"}: ${demobilizationUnitLabel(G, unit)}`,
      labelZh: `${candidate.action === "redeploy" ? "免费重新部署" : "免费海军移动"}：${demobilizationUnitLabel(G, unit, "zh_CN")}`,
      data: {action: candidate.action, unitId: candidate.unitId},
    };
  });
  options.push({id: "done", label: "Done with free actions", labelZh: "结束免费行动"});
  const context: DemobilizationContext = {
    mode: "demobilization",
    stage: "select",
    queue,
    current,
    moved,
    warIndex,
  };
  G.pending = null;
  openDecision(G, ctx, {
    kind: "demobilizationFreeAction",
    power: current.power,
    // 17.0: the free redeployment / naval action may move all eligible units.
    prompt: "Free demobilization actions: move any or all eligible units, then done",
    promptZh: "免费复员行动：移动任意或全部符合条件的单位，然后完成",
    promptArgs: {power: current.power, side: current.side, order: current.order, moved: moved.length},
    options,
    context: {...context},
    blocking: true,
  });
  return true;
};

/** Move to the next entitled power, or finish the chain. */
const advanceDemobilization = (
  G: ImperialElegyState,
  ctx: Ctx,
  queue: DemobilizationQueueEntry[],
  warIndex: number,
): boolean => {
  if (queue.length === 0) {
    finishDemobilizationFreeActions(G, ctx, "completed");
    return false;
  }
  const [next, ...rest] = queue;
  return openDemobilizationSelect(G, ctx, next, rest, [], warIndex);
};

/** Rule 17.0: prompt the entitled powers, winner side first, loser second. */
const beginDemobilizationFreeActions = (
  G: ImperialElegyState,
  ctx: Ctx,
  freeActions: readonly {power: Power; side: DemobilizationSide; order: 1 | 2}[],
): boolean => {
  const queue: DemobilizationQueueEntry[] = [];
  for (const entry of freeActions) {
    if (G.powers[entry.power]?.eliminated === true) {
      log(G, entry.power, "demobilizationFreeActionSkipped", {reason: "eliminated"});
      continue;
    }
    queue.push({power: entry.power, side: entry.side, order: entry.order});
  }
  if (queue.length === 0) return false;
  const [first, ...rest] = queue;
  return openDemobilizationSelect(G, ctx, first, rest, [], G.wars.length - 1);
};

/** Resolve a `demobilizationFreeAction` (unit picker) or its destination. */
const resolveDemobilizationFreeAction = (
  G: ImperialElegyState,
  ctx: Ctx,
  pending: PendingDecision,
  optionId: string,
): string | void => {
  const data = demobilizationContext(pending);
  if (!data) return INVALID_MOVE;

  if (pending.kind === "movementDestination") {
    const unit = data.unitId ? G.units[data.unitId] : undefined;
    if (!unit || unit.owner !== pending.power || data.action === undefined) return INVALID_MOVE;
    const destinations =
      data.action === "naval"
        ? freeNavalDestinations(G, pending.power, unit)
        : freeRedeployDestinations(G, pending.power, unit);
    const chosenOption = pending.options.find((entry) => entry.id === optionId);
    if (chosenOption?.data?.requiresDardanelles === true) {
      // 3.4.1: ask the controller, then reopen the free-action chooser so the
      // move can be repeated with the permission in place.
      const from = unit.space;
      if (!from) return INVALID_MOVE;
      const route = planNavalMove(G, pending.power, from, optionId as SpaceId, {ignoreDardanellesGate: true});
      if (!route.ok) return INVALID_MOVE;
      G.pending = null;
      if (!requestDardanellesPassage(G, ctx, pending.power, from, optionId as SpaceId, route.path, {
        resume: "demobilization",
        demobilization: data as unknown as Record<string, unknown>,
      })) {
        return INVALID_MOVE;
      }
      return undefined;
    }
    if (!destinations.includes(optionId)) return INVALID_MOVE;
    const from = unit.space;
    if (!from) return INVALID_MOVE;
    G.spaces[from].units = G.spaces[from].units.filter((id) => id !== unit.id);
    G.spaces[optionId].units.push(unit.id);
    unit.space = optionId;
    const war = G.wars[data.warIndex];
    if (war) {
      war.freeActions = war.freeActions ?? [];
      // 17.0 / 12.15: one free redeployment (or free naval) action moves all
      // eligible units, so repeated unit moves of the same action accumulate
      // into a single record with one endpoint entry per unit.
      const last = war.freeActions[war.freeActions.length - 1];
      if (
        last !== undefined &&
        last.power === pending.power &&
        last.side === data.current.side &&
        last.action === data.action
      ) {
        last.unitIds.push(unit.id);
        last.moves = [...(last.moves ?? [{unitId: last.unitIds[0], from: last.from, to: last.to}]), {
          unitId: unit.id,
          from,
          to: optionId,
        }];
      } else {
        war.freeActions.push({
          power: pending.power,
          side: data.current.side,
          action: data.action,
          unitIds: [unit.id],
          from,
          to: optionId,
          moves: [{unitId: unit.id, from, to: optionId}],
        });
      }
    }
    log(G, pending.power, "demobilizationFreeAction", {
      action: data.action,
      units: unit.id,
      from,
      to: optionId,
    });
    G.pending = null;
    openDemobilizationSelect(G, ctx, data.current, data.queue, [...data.moved, unit.id], data.warIndex);
    return undefined;
  }

  if (optionId === "done") {
    G.pending = null;
    advanceDemobilization(G, ctx, data.queue, data.warIndex);
    return undefined;
  }

  const chosen = pending.options.find((entry) => entry.id === optionId);
  if (!chosen) return INVALID_MOVE;
  const unitId = typeof chosen.data?.unitId === "string" ? chosen.data.unitId : "";
  const action = chosen.data?.action === "naval" ? "naval" : "redeploy";
  const unit = G.units[unitId];
  if (!unit || unit.owner !== pending.power) return INVALID_MOVE;
  const destinations =
    action === "naval"
      ? freeNavalDestinations(G, pending.power, unit)
      : freeRedeployDestinations(G, pending.power, unit);
  G.pending = null;
  const gated = action === "naval" ? freeNavalDardanellesDestinations(G, pending.power, unit) : [];
  if (destinations.length === 0 && gated.length === 0) return INVALID_MOVE;
  openDecision(G, ctx, {
    kind: "movementDestination",
    power: pending.power,
    prompt: action === "naval" ? "Choose a free naval destination" : "Choose a free redeployment destination",
    promptZh: action === "naval" ? "选择免费海军移动的目的地" : "选择免费重新部署的目的地",
    promptArgs: {power: pending.power, action, unit: unitId},
    options: [
      ...destinations.map((space) => ({
        id: space,
        label: spaceLabel(space, "en"),
        labelZh: spaceLabel(space, "zh_CN"),
      })),
      // 3.4.1: choosing a permission-blocked destination asks the Dardanelles
      // controller first; no other free naval destination is hidden by it.
      ...gated.map((space) => ({
        id: space,
        label: `${spaceLabel(space, "en")} (needs Dardanelles permission)`,
        labelZh: `${spaceLabel(space, "zh_CN")}（需达达尼尔海峡通行许可）`,
        data: {requiresDardanelles: true},
      })),
    ],
    context: {...data, stage: "destination", action, unitId},
    blocking: true,
  });
  return undefined;
};

/**
 * 23.0–23.5: the crisis decision and its follow-up choices.  The roll itself is
 * `engine/greatWar.ts#crisisRoll`; a follow-up (bordering nation, Balkan
 * choice, neutral's alliance) is resolved by `resolveCrisisPending`.
 *
 * On an International Conference the inciting card's remaining text is resumed
 * (23.1: "If it doesn't break out, the rest of the text is followed"); on an
 * outbreak the rest of the card is ignored and only the card bookkeeping runs.
 */
const resolveCrisisDecision = (
  G: ImperialElegyState,
  ctx: Ctx,
  pending: PendingDecision,
  optionId: string,
): void => {
  const context = pending.context ?? {};
  G.pending = null;
  const outcome =
    pending.kind === "crisis"
      ? crisisRoll(G, ctx, pending.power, String(context.inciting ?? ""))
      : resolveCrisisPending(G, ctx, pending, optionId);
  // 23.0/23.1: "the crisis roll happens as soon as the WTT reaches 5, and the
  // rest of the inciting event is suspended until it resolves."  Every outcome
  // must therefore continue the card's remaining text — not only the
  // `conference` story result.  Restricting this to `conference` silently
  // dropped A100's Macedonia award (and the tail of any other card whose WTT
  // increase incited a crisis).
  //
  // A crisis is a multi-step sequence (crisis -> crisisIncident ->
  // crisisAlliance), so the tail is carried on the crisis run itself and is
  // executed only once the sequence is over.
  const resume = (context.resume as unknown as Effect[] | undefined) ?? [];
  const run = context.crisis as unknown as {resumeEffects?: Effect[]} | undefined;
  if (resume.length > 0 && run !== undefined) run.resumeEffects = resume;
  // 23.1: "If GW breaks out the rest of the text on the event is ignored."  An
  // outbreak drops the suspended tail and leaves the outbreak path untouched,
  // exactly as before this change.
  if (outcome === "outbreak") {
    if (G.pending === null) finalizePendingCard(G, ctx);
    return;
  }
  const tail = crisisResumeEffects(pending);
  // `G.pending` was assigned `null` above, so TypeScript has narrowed it; read
  // it back through the state object to see what the crisis opened next.
  const stillPending = (G as ImperialElegyState).pending as PendingDecision | null;
  if (stillPending !== null) {
    // Still mid-sequence: hand the tail to the next pending's run.
    const next = stillPending.context?.crisis as unknown as {resumeEffects?: Effect[]} | undefined;
    if (next !== undefined && tail.length > 0) next.resumeEffects = tail;
    return;
  }
  // The tail may itself raise the WTT again; the `wtt` effect opens the next
  // crisis on its own, so no extra guard is needed here.
  if (tail.length > 0) resolveEffects(G, ctx, pending.power, tail, {});
  if (G.pending === null) finalizePendingCard(G, ctx);
};

/**
 * 19.1: finish the interrupted naval movement after a won interception.  The
 * action (CP or GW budget) was already spent by the move itself, so this
 * resolution only relocates the surviving ships: it never charges again.
 * "stop" keeps them where the battle left them.
 */
const resolveNavalContinuation = (
  G: ImperialElegyState,
  ctx: Ctx,
  pending: PendingDecision,
  optionId: string,
): string | void => {
  const context = pending.context ?? {};
  const contact = typeof context.contact === "string" ? context.contact : "";
  const rawUnits = Array.isArray(context.unitIds)
    ? (context.unitIds as unknown[]).filter((id): id is string => typeof id === "string")
    : [];
  const destinations = Array.isArray(context.destinations)
    ? (context.destinations as unknown[]).filter((id): id is SpaceId => typeof id === "string")
    : [];
  const ally = isPower(context.ally) ? context.ally : undefined;
  if (contact === "" || !G.spaces[contact]) return INVALID_MOVE;
  const units = rawUnits
    .map((id) => G.units[id])
    .filter((unit): unit is Unit =>
      Boolean(unit) && unit!.space === contact && unit!.steps > 0 &&
      (unit!.owner === pending.power || (ally !== undefined && unit!.owner === ally)),
    );
  G.pending = null;
  G.navalContinuation = null;
  if (optionId === "stop" || units.length === 0) {
    log(G, pending.power, "navalContinuation", {
      from: contact,
      stopped: true,
      units: units.length,
    });
    return undefined;
  }
  if (!destinations.includes(optionId as SpaceId)) return INVALID_MOVE;
  const to = optionId as SpaceId;
  // Re-validate the pick against the live state: the route, the ally's own
  // gates and the destination's stacking/capacity.
  const plan = planNavalMove(G, pending.power, contact, to);
  if (!plan.ok) return INVALID_MOVE;
  if (ally !== undefined && !planNavalMove(G, ally, contact, to).ok) return INVALID_MOVE;
  if (movementEndProblem(G, to, units) !== null) return INVALID_MOVE;
  for (const unit of units) {
    G.spaces[contact].units = G.spaces[contact].units.filter((id) => id !== unit.id);
    if (!G.spaces[to].units.includes(unit.id)) G.spaces[to].units.push(unit.id);
    unit.space = to;
  }
  log(G, pending.power, "navalContinuation", {
    from: contact,
    to,
    units: units.length,
    path: plan.path.join(","),
  });
  return undefined;
};

/**
 * 19.2: resolve the naval defender's avoid/fight choice.  "Fight" always starts
 * the battle; an avoid choice first rolls (the destination was picked before the
 * roll), and a failure starts the battle with the printed -1 modifier.
 */
const resolveNavalAvoid = (
  G: ImperialElegyState,
  ctx: Ctx,
  pending: PendingDecision,
  optionId: string,
): string | void => {
  const context = pending.context ?? {};
  const attacker = isPower(context.attacker) ? context.attacker : null;
  const from = typeof context.from === "string" ? context.from : "";
  const to = typeof context.to === "string" ? context.to : "";
  const stored = Array.isArray(context.attackerUnits)
    ? (context.attackerUnits as unknown[]).filter((id): id is string => typeof id === "string")
    : [];
  const attackerUnits = stored.length > 0
    ? stored
    : navalUnitsIn(G, to)
      .filter((unit) => unit.owner === attacker || (!isPower(unit.owner) && G.spaces[to]?.ally === attacker))
      .map((unit) => unit.id);
  // 19.5 footnote: the attacker may have chosen the adjacent box for a
  // two-box port battle; record it on the battle for audit/tests.
  const box = typeof context.box === "string" ? (context.box as SpaceId) : undefined;
  const battleOptions = {
    ...(attackerUnits.length > 0 ? {attackerUnits} : {}),
    ...(box === undefined ? {} : {portBox: box}),
  };
  if (attacker === null || from === "" || to === "") return INVALID_MOVE;
  const chosen = pending.options.find((entry) => entry.id === optionId);
  if (!chosen) return INVALID_MOVE;
  G.pending = null;
  if (optionId === "fight") {
    beginNavalBattle(G, ctx, attacker, from, to, battleOptions);
    return undefined;
  }
  const data = chosen.data ?? {};
  const destination = typeof data.space === "string" ? data.space : "";
  if (destination === "") return INVALID_MOVE;
  const ports = Array.isArray(data.ports)
    ? (data.ports as unknown[]).filter((id): id is string => typeof id === "string")
    : [];
  // 19.5 footnote: when the attacker chose the box for a two-box port battle,
  // that box alone supplies the port-count DRMs.
  const result = attemptNavalAvoidance(G, ctx, attacker, pending.power, to, {space: destination, ports}, box);
  if (result.success) {
    // 19.2: "After a force successfully avoids battle the attacking force
    // cannot continue moving", so 19.1's continuation is cancelled.
    G.navalContinuation = null;
    // 15.1: an avoided start-of-maneuver battle still drains the queue.
    if (G.pending === null && G.battle === null) resolveNextNavalStartContact(G, ctx);
  }
  if (!result.success) {
    const battle = beginNavalBattle(G, ctx, attacker, from, to, battleOptions);
    if (battle !== null) {
      // 19.5: "Failure to avoid battle (only apply if an attempt was made): -1".
      battle.defenderDrm -= 1;
      battle.notes.push("failedAvoid");
    }
  }
  return undefined;
};

/**
 * 1870 — The Franco-Prussian War.
 *
 * "Prior to the Prep Phase of turn 3, the FR player may decide to concede defeat
 * and skip the Franco-Prussian War."  Yes applies the six printed adjustments
 * (`engine/scenarioSetup.ts#applyFrancoPrussianConcession`); no leaves the
 * historical setup in place and the war is played out normally.
 */
const resolveFrancoPrussianConcession = (
  G: ImperialElegyState,
  ctx: Ctx,
  pending: PendingDecision,
  optionId: string,
): string | void => {
  if (optionId !== "concede" && optionId !== "fight") return INVALID_MOVE;
  G.pending = null;
  if (optionId === "concede") {
    applyFrancoPrussianConcession(G, ctx);
  } else {
    log(G, "FR", "francoPrussianFought", {});
  }
  continueSetupDecisions(G, ctx);
  return undefined;
};

/** The 1870/1880 printed National Goal deck edit: AU drops one of two goals. */
const resolveScenarioGoalChoice = (
  G: ImperialElegyState,
  ctx: Ctx,
  pending: PendingDecision,
  optionId: string,
): string | void => {
  if (!resolveGoalChoice(G, pending.power, optionId)) return INVALID_MOVE;
  G.pending = null;
  continueSetupDecisions(G, ctx);
  return undefined;
};

/**
 * Alternate GW build points (playbook p. 8 step 2): "each build point increases
 * either industry and stability by one."
 */
const resolveGwBuildPoint = (
  G: ImperialElegyState,
  ctx: Ctx,
  pending: PendingDecision,
  optionId: string,
): string | void => {
  if (optionId !== "stability" && optionId !== "industry") return INVALID_MOVE;
  const power = pending.power;
  if (spendBuildPoint(G, power, optionId) === false) return INVALID_MOVE;
  G.pending = null;
  continueSetupDecisions(G, ctx);
  return undefined;
};

/**
 * Walk the scenario's opening decisions in printed order.
 *
 * The 1870 scenario prints two: the Franco-Prussian War concession (FR) and the
 * AU National Goal deck edit.  Each one is optional in the sense that it is a
 * choice, but the printed procedure puts it "prior to the Prep Phase", so the
 * whole sequence runs before the first prep phase can close.
 */
export const openSetupDecisions = (G: ImperialElegyState, ctx: Ctx): boolean => {
  // ------------------------------------------------------------------ 1870 war
  if (hasFrancoPrussianWar(G) && G.persistent.francoPrussianConceded === undefined
      && G.flags.francoPrussianAsked !== true) {
    G.flags.francoPrussianAsked = true;
    openDecision(G, setupCtx(ctx), decision(
      "francoPrussianConcession",
      "FR",
      "The Franco-Prussian War: concede defeat and skip the war, or fight it out?",
      [
        option("concede", "Concede: apply the printed setup adjustments", undefined, false, "认输：套用印刷调整"),
        option("fight", "Fight the Franco-Prussian War", undefined, false, "打普法战争"),
      ],
    ));
    return true;
  }
  // ------------------------------------------------- printed NG deck edits
  const goalChoices = pendingGoalChoice(G);
  if (goalChoices.length > 0) {
    const entry = goalChoices[0];
    openDecision(G, setupCtx(ctx), decision(
      "scenarioGoalChoice",
      entry.power,
      "Remove one of these National Goals from the deck?",
      entry.candidates.map((id) => option(
        id,
        GOALS_BY_ID[id]?.title ?? id,
        undefined,
        false,
        GOALS_BY_ID[id]?.titleZh ?? id,
      )),
    ));
    return true;
  }
  // ----------------------------------------------------- alternate GW build points
  for (const power of POWERS) {
    if (buildPointsRemaining(G, power) <= 0) continue;
    openDecision(G, setupCtx(ctx), decision(
      "gwBuildPoint",
      power,
      `Spend a build point (${buildPointsRemaining(G, power)} left) on stability or industry`,
      [
        option("stability", "Increase stability by 1", undefined, false, "稳定度 +1"),
        option("industry", "Increase industry by 1", undefined, false, "工业 +1"),
      ],
      undefined,
      undefined,
      `花费 1 个建设点（剩余 ${buildPointsRemaining(G, power)}）提升稳定或工业`,
    ));
    return true;
  }
  return false;
};

/** Setup decisions run from the prep phase, where `setActivePlayers` is legal. */
const setupCtx = (ctx: Ctx): Ctx => ctx;

/** Resume the opening decision sequence, then fall through to the prep phase. */
const continueSetupDecisions = (G: ImperialElegyState, ctx: Ctx): void => {
  if (openSetupDecisions(G, ctx)) return;
};

/**
 * 33.1 Blood and Iron!: "During the end phase of turn 1 instead of drawing
 * NGs, Prussia may search their NG deck for the Unification! card.  If they do
 * this the NG must be played faceup."  Choosing the search selects NG-08
 * directly (no 3-draw/keep-1) and publishes it; the normal draw continues for
 * the other powers.
 */
const resolveBloodAndIron = (
  G: ImperialElegyState,
  ctx: Ctx,
  pending: PendingDecision,
  optionId: string,
): string | void => {
  if (optionId !== "search" && optionId !== "draw") return INVALID_MOVE;
  const progress = G.endPhase;
  if (!progress) return INVALID_MOVE;
  const p = G.powers.GE;
  if (optionId === "search") {
    if (!p.goalDeck.includes(GE_UNIFICATION_GOAL)) return INVALID_MOVE;
    p.goalDeck = p.goalDeck.filter((id) => id !== GE_UNIFICATION_GOAL);
    if (!p.goals.includes(GE_UNIFICATION_GOAL)) p.goals.push(GE_UNIFICATION_GOAL);
    delete p.flags.ngChoices;
    markGoalRevealed(G, GE_UNIFICATION_GOAL);
    log(G, "GE", "bloodAndIron", {goal: GE_UNIFICATION_GOAL});
  } else {
    const drawn = p.goalDeck.splice(0, 3);
    p.flags.ngChoices = drawn.join(",");
  }
  G.pending = null;
  // The draw step resumes after GE so the other five powers draw exactly once.
  progress.ngDraw = {index: POWERS.indexOf("GE") + 1};
  continueEndPhase(G, ctx);
  return undefined;
};

/** 33.3 Napoleon's Legacy: resolve the reveal choice and finish the declaration. */
const resolveNapoleonsLegacy = (
  G: ImperialElegyState,
  ctx: Ctx,
  pending: PendingDecision,
  optionId: string,
): string | void => {
  if (optionId !== "reveal" && optionId !== "decline") return INVALID_MOVE;
  const target = pending.context?.target;
  const rawMinor = pending.context?.minor;
  const minorName = typeof rawMinor === "string" && rawMinor.length > 0 ? rawMinor : null;
  const aim = pending.context?.aim;
  const rawObjectives = pending.context?.objectives;
  const cp = Number(pending.context?.cp);
  if (aim !== "liberation" && aim !== "unification" && aim !== "conquest") return INVALID_MOVE;
  if (!Array.isArray(rawObjectives)) return INVALID_MOVE;
  if (rawObjectives.some((id) => typeof id !== "string")) return INVALID_MOVE;
  if (!Number.isFinite(cp)) return INVALID_MOVE;
  const objectives = rawObjectives as SpaceId[];
  // Re-check the live board: the declaration was validated before the choice
  // opened and a pending decision blocks every other action.
  if (G.war !== null || G.phase !== "action") return INVALID_MOVE;
  // A home-card declaration keeps the card's printed aim/target/objective
  // rules across the decision (Aux Armes is the FR case that reaches here).
  const declarationCard = isCardId(G.flags.declarationCard) ? G.flags.declarationCard : null;
  const policy = declarationCard !== null ? warDeclarationPolicy(declarationCard) : null;
  if (policy !== null && !policy.aims.includes(aim)) return INVALID_MOVE;
  const aimRules = {
    ruRussoTurkishWars: policy?.russianBalkanLiberation === true,
    conquestKeyLimit: policy?.conquestKeyLimit,
  };
  // 14.1: the second power of a home-card declaration also crossed the
  // decision on the public flags.
  const secondTarget = isPower(G.flags.declarationSecond) ? G.flags.declarationSecond : null;
  if (secondTarget !== null && minorName !== null) return INVALID_MOVE;
  let discount = 0;
  if (optionId === "reveal") {
    markGoalRevealed(G, NAPOLEONS_LEGACY_GOAL);
    log(G, "FR", "napoleonsLegacyRevealed", {discount: 2});
    discount = 2;
  }
  if (minorName !== null) {
    // Rule 13.4: the minor declaration is re-resolved so a truce signed or a
    // marker removed while the choice was open is honoured.
    const minor = minorWarInfo(G, "FR", minorName);
    if (!minor.ok) return INVALID_MOVE;
    if (!validateWarAim(G, "FR", minorWarDefender(minor), aim, objectives, aimRules).ok) return INVALID_MOVE;
    G.pending = null;
    // 13.4.1 / 13.4.2: the ally's abandonment choice or the aid search runs
    // next, exactly as it does for a non-card declaration.
    return beginMinorWarDeclaration(G, ctx, "FR", minor, aim, objectives, cp, discount);
  }
  if (!isPower(target)) return INVALID_MOVE;
  if (secondTarget !== null) {
    if (secondTarget === target || hasTruce(G, "FR", secondTarget)) return INVALID_MOVE;
    if (!warDeclarationTargetLegal(
      G,
      declarationCard === null ? null : {card: declarationCard, cp, aim: null},
      secondTarget,
    )) return INVALID_MOVE;
  }
  if (!validateWarAim(G, "FR", target, aim, objectives, {
    ...aimRules,
    ...(secondTarget !== null ? {defenders: [target, secondTarget]} : {}),
  }).ok) return INVALID_MOVE;
  G.pending = null;
  return finalizeWarDeclaration(G, ctx, "FR", target, aim, objectives, cp, discount);
};

/**
 * 3.4.1: the Dardanelles controller grants or refuses one passage.  A grant is
 * typed on `G.dardanellesPassage` and valid for the rest of the turn for that
 * requester; a refusal leaves the strait closed.  Either way the mover's naval
 * move is a fresh action and no CP/budget was spent on the request.
 */
const resolveDardanellesPassage = (
  G: ImperialElegyState,
  ctx: Ctx,
  pending: PendingDecision,
  granted: boolean,
): string | void => {
  const context = pending.context ?? {};
  const requesting = isPower(context.requesting) ? context.requesting : null;
  const from = typeof context.from === "string" ? context.from : "";
  const to = typeof context.to === "string" ? context.to : "";
  if (requesting === null) return INVALID_MOVE;
  G.pending = null;
  if (granted) {
    const record = {
      requesting,
      granting: pending.power,
      turn: G.turn,
      ...(G.gw?.active ? {gwTurn: G.gw.turn} : {}),
    };
    G.dardanellesPassage = record;
    const others = (Array.isArray(G.dardanellesPassages) ? G.dardanellesPassages : []).filter(
      (entry) => !(entry.requesting === requesting && entry.turn === G.turn),
    );
    G.dardanellesPassages = [...others, record];
  }
  log(G, pending.power, "dardanellesPassage", {requesting, from, to, granted});
  // A free naval move (17.0 demobilisation) was interrupted for the request;
  // reopen its chooser (the newly granted crossing changes nothing else).
  if (context.resume === "demobilization" && context.demobilization) {
    const data = context.demobilization as unknown as DemobilizationContext;
    if (data && data.mode === "demobilization" && data.current) {
      openDemobilizationSelect(
        G,
        ctx,
        data.current,
        Array.isArray(data.queue) ? data.queue : [],
        Array.isArray(data.moved) ? data.moved : [],
        Number(data.warIndex) || 0,
      );
    }
  }
  return undefined;
};

/**
 * 15.3: after a live retreat, reconcile the battle space and every possible
 * retreat destination (the chosen one and the alternatives are all cheap to
 * inspect, and the helper is idempotent when nothing changed).
 */
const reconcileRetreatOccupation = (
  G: ImperialElegyState,
  battleSpace: SpaceId | null,
  pending: PendingDecision,
): void => {
  const spaces = new Set<SpaceId>();
  if (battleSpace !== null) spaces.add(battleSpace);
  const destinations = pending.context?.destinations;
  if (Array.isArray(destinations)) {
    for (const space of destinations) if (typeof space === "string") spaces.add(space);
  }
  const unitDestinations = pending.context?.unitDestinations;
  if (unitDestinations !== null && typeof unitDestinations === "object") {
    for (const value of Object.values(unitDestinations as Record<string, unknown>)) {
      if (!Array.isArray(value)) continue;
      for (const space of value) if (typeof space === "string") spaces.add(space);
    }
  }
  for (const space of [...spaces].sort()) recordOccupation(G, space);
};

/** 15.3: reconcile the spaces a decisive follow-up move touched. */
const reconcileFollowUpOccupation = (G: ImperialElegyState, optionId: string): void => {
  // 15.3 persistence: the origin keeps its occupation marker after the units
  // leave, so only the destination needs reconciling here.
  if (optionId.startsWith("move:")) {
    const to = optionId.slice("move:".length);
    if (to !== "" && G.spaces[to]) recordOccupation(G, to);
  }
};

/**
 * 33.3 Cultural Symbol: a battle that ends with an enemy in Paris costs France a
 * City of Light point.  `combat.ts` stamps `occupiedBy` directly, so the live
 * move layer settles the characteristic after every resolved decision.
 */
const settleBattleCharacteristics = (G: ImperialElegyState): void => {
  settleCulturalSymbolLoss(G);
};

export const resolvePending = (G: ImperialElegyState, ctx: Ctx, optionId: string): string | void => {
  const result = resolvePendingDecision(G, ctx, optionId);
  if (result === undefined) {
    settleBattleCharacteristics(G);
    // 15.1: a start-of-maneuver battle queue parked behind an upkeep decision
    // resumes as soon as that decision closes.
    if (G.pending === null && G.battle === null && navalStartQueuePending(G)) {
      resolveNextNavalStartContact(G, ctx);
    }
  }
  return result;
};

const resolvePendingDecision = (G: ImperialElegyState, ctx: Ctx, optionId: string): string | void => {
  const playerID = ctx.playerID ?? null;
  const pending = G.pending;
  if (!pending) return INVALID_MOVE;
  if (playerID !== seatOf(pending.power)) return INVALID_MOVE;
  const opt = pending.options.find((o) => o.id === optionId);
  if (!opt) return INVALID_MOVE;
  const context = pending.context ?? {};
  if (pending.kind === "eventTargetPower" && context.special === "balanceOfPowerDraw") {
    return resolvePostWarDrawChoice(G, ctx, pending, optionId);
  }
  if (pending.kind === "confirm" && context.special === "attackerSurrender") {
    if (optionId !== "accept" && optionId !== "refuse") return INVALID_MOVE;
    return resolveAttackerSurrender(G, ctx, pending, optionId === "accept");
  }
  if (pending.kind === "movementDestination" && context.special === "endPhaseNavalReturn") {
    return resolveNavalReturnChoice(G, ctx, pending, optionId);
  }
  if (pending.kind === "italianInternalWar") {
    // 22.1.3: the active player chose Sardinia-Piedmont or the Two Sicilies.
    if (!ITALIAN_INTERNAL_WAR_POWERS.includes(optionId as (typeof ITALIAN_INTERNAL_WAR_POWERS)[number])) {
      return INVALID_MOVE;
    }
    G.pending = null;
    applyInternalItalianWar(G, optionId);
    finalizePendingCard(G, ctx);
    return undefined;
  }
  if (pending.kind === "italianPetition") {
    // 22.1.2: remove the chosen allied minor's marker and place the +1 box marker.
    const choice = pending.options.find((entry) => entry.id === optionId)?.data as
      | {minor: (typeof ITALIAN_INTERNAL_WAR_POWERS)[number]; player: Power}
      | undefined;
    if (!choice || !applyItalianPetition(G, choice)) return INVALID_MOVE;
    G.pending = null;
    finalizePendingCard(G, ctx);
    return undefined;
  }
  if (pending.kind === "italianNationalistWave") {
    // 22.1.4: choose the minor, then its two keys, then roll unification.
    if (!resolveItalianNationalistWaveChoice(G, ctx, pending, optionId)) return INVALID_MOVE;
    if (G.pending === null) finalizePendingCard(G, ctx);
    return undefined;
  }
  if (pending.kind === "italyNavalBase") {
    // 22.3.1 result 3–4: the active player chose the free naval base.
    if (!resolveItalyNavalBase(G, pending, optionId)) return INVALID_MOVE;
    G.pending = null;
    finalizePendingCard(G, ctx);
    return undefined;
  }
  if (pending.kind === "italyOttomanWar") {
    // 22.3.1 result 7+: the active player chose Tunisia or Libya.
    if (!resolveItalyOttomanTerritoryChoice(G, pending, optionId)) return INVALID_MOVE;
    G.pending = null;
    finalizePendingCard(G, ctx);
    return undefined;
  }
  if (pending.kind === "francoPrussianConcession") {
    return resolveFrancoPrussianConcession(G, ctx, pending, optionId);
  }
  if (pending.kind === "scenarioGoalChoice") {
    return resolveScenarioGoalChoice(G, ctx, pending, optionId);
  }
  if (pending.kind === "gwBuildPoint") {
    return resolveGwBuildPoint(G, ctx, pending, optionId);
  }
  if (pending.kind === "bloodAndIron") {
    return resolveBloodAndIron(G, ctx, pending, optionId);
  }
  if (pending.kind === "germanConfederation") {
    return resolveGermanConfederation(G, ctx, pending, optionId);
  }
  if (pending.kind === "gwDraft") {
    // 27.5.2: the second drafted reduced army's controlled home key.
    return resolveGwDraftSecond(G, ctx, pending, optionId) ? undefined : INVALID_MOVE;
  }
  if (pending.kind === "napoleonsLegacy") {
    return resolveNapoleonsLegacy(G, ctx, pending, optionId);
  }
  if (pending.kind === "metternich") {
    return resolveMetternichChoice(G, ctx, pending, optionId);
  }
  if (pending.kind === "allianceTie" && pending.context?.special === "allianceResolution") {
    // 8.6: the action-phase event's tie is the same printed choice as 20.9.
    const roll = pending.context?.roll as AllianceResolutionRoll | undefined;
    if (roll === undefined || !roll.tied.includes(optionId as AllianceDirection)) return INVALID_MOVE;
    G.pending = null;
    // A later power may tie as well; that opens a new allianceTie decision.
    resolveAllianceResolutionTie(G, ctx, pending, optionId);
    // The card is only discarded once the chain has no further decision open.
    finalizePendingCard(G, ctx);
    return undefined;
  }
  if (pending.kind === "militarism" || pending.kind === "manpowerExcess" || pending.kind === "allianceTie") {
    // 20.1 / 20.5 / 20.9: record the choice and resume the printed end-phase order.
    return resolveEndPhasePending(G, ctx, pending, optionId);
  }
  if (pending.kind === "whitePeaceOrder") {
    return resolveWhitePeaceOrder(G, ctx, pending, optionId);
  }
  if (pending.kind === "treatyOption" || pending.kind === "treatySpace") {
    return resolveWarTreatyPending(G, ctx, pending, optionId);
  }
  if (pending.kind === "minorAbandon") {
    return resolveMinorAbandon(G, ctx, pending, optionId);
  }
  if (pending.kind === "minorAid") {
    return resolveMinorAid(G, ctx, pending, optionId);
  }
  if (pending.kind === "warAllyConsent") {
    if (optionId === "refuse") return resolveWarAllyConsent(G, ctx, pending, false);
    // Rule 8.2's both-neutral Status Quo invitation offers one accept option
    // per legal alliance box (`accept:te` / `accept:ta`).
    const chosenAccept = pending.options.find((entry) => entry.id === optionId);
    if (!chosenAccept || !optionId.startsWith("accept")) return INVALID_MOVE;
    const side = chosenAccept.data?.allianceSide;
    const allianceSide: AllianceSide | undefined = side === "te" || side === "ta" ? side : undefined;
    return resolveWarAllyConsent(G, ctx, pending, true, allianceSide);
  }
  if (pending.kind === "balanceOfPower") {
    if (optionId !== "accept" && optionId !== "decline") return INVALID_MOVE;
    return resolveBalanceOfPower(G, ctx, pending, optionId === "accept");
  }
  if (pending.kind === "demobilizationFreeAction" || pending.kind === "movementDestination") {
    return resolveDemobilizationFreeAction(G, ctx, pending, optionId);
  }
  if (pending.kind === "impulseLoss") {
    // 5.5.3 / 5.6.2: the owning player chooses which unit takes the step loss.
    G.pending = null;
    resolveImpulseLoss(G, ctx, pending, optionId);
    return undefined;
  }
  if (pending.kind === "auUnstable") {
    // 33.4: AU chooses between discarding a random card and the -1 marker.
    if (!resolveAuUnstableChoice(G, ctx, pending, optionId)) return INVALID_MOVE;
    finalizePendingCard(G, ctx);
    return undefined;
  }
  if (pending.kind === "navalInterception") {
    return resolveNavalInterception(G, ctx, pending, optionId) ? undefined : INVALID_MOVE;
  }
  if (pending.kind === "navalPortBox") {
    return resolveNavalPortBox(G, ctx, pending, optionId) ? undefined : INVALID_MOVE;
  }
  if (pending.kind === "navalAvoid") {
    return resolveNavalAvoid(G, ctx, pending, optionId);
  }
  if (pending.kind === "navalContinuation") {
    return resolveNavalContinuation(G, ctx, pending, optionId);
  }
  if (pending.kind === "navalPortContinuation") {
    return resolveNavalPortContinuation(G, ctx, optionId) ? undefined : INVALID_MOVE;
  }
  if (pending.kind === "mineRetreat") {
    return resolveMineRetreat(G, ctx, optionId) ? undefined : INVALID_MOVE;
  }
  if (pending.kind === "combatRetreat") {
    const battleSpace = G.battle?.to ?? null;
    if (!resolveCombatRetreat(G, ctx, optionId)) return INVALID_MOVE;
    reconcileRetreatOccupation(G, battleSpace, pending);
    return undefined;
  }
  if (pending.kind === "dardanellesPassage") {
    if (optionId !== "grant" && optionId !== "refuse") return INVALID_MOVE;
    return resolveDardanellesPassage(G, ctx, pending, optionId === "grant");
  }
  if (pending.kind === "combatSupport") {
    G.pending = null;
    chooseSupport(G, ctx, optionId);
    return undefined;
  }
  if (pending.kind === "combatLosses") {
    chooseLossMove(G, ctx, optionId);
    return undefined;
  }
  if (pending.kind === "combatElite") {
    if (optionId !== "commit" && optionId !== "decline") return INVALID_MOVE;
    const side = (pending.context?.eliteSide as "attacker" | "defender" | undefined)
      ?? (pending.context?.side as "attacker" | "defender" | undefined)
      ?? "attacker";
    // Clear the wrapper first, matching `combatSupport`: if the battle has
    // already gone, `resolveEliteBonus` returns early and a stale pending would
    // otherwise block every later decision.
    G.pending = null;
    resolveEliteBonus(G, ctx, side, optionId === "commit");
    return undefined;
  }
  if (pending.kind === "hydraulicRecoil") {
    if (optionId !== "apply" && optionId !== "decline") return INVALID_MOVE;
    return resolveHydraulicRecoil(G, ctx, optionId === "apply");
  }
  if (pending.kind === "combatDiscard") {
    if (resolveCombatDiscard(G, ctx, optionId)) return undefined;
    return INVALID_MOVE;
  }
  if (pending.kind === "decisiveBattle") {
    if (!resolveDecisiveFollowUp(G, ctx, optionId)) return INVALID_MOVE;
    reconcileFollowUpOccupation(G, optionId);
    return undefined;
  }
  if (pending.kind === "combatCard") {
    if (optionId.startsWith("card:")) {
      playCombatCard(G, ctx, optionId.slice(5));
    } else {
      G.pending = null;
      afterCombatCardWindow(G, ctx);
    }
    maybeOpenDecisiveFollowUp(G, ctx);
    return undefined;
  }
  if (pending.kind === "crisis" || pending.kind === "crisisIncident" || pending.kind === "crisisAlliance") {
    resolveCrisisDecision(G, ctx, pending, optionId);
    return undefined;
  }
  if (pending.kind === "gwBonusImpulse") {
    const result = resolveGwBonusImpulse(G, ctx, pending, optionId);
    if (!result.ok) return INVALID_MOVE;
    if (result.kind === "end") {
      G.phase = "gwWinter";
      ctx.events?.setPhase?.("gwWinter");
    }
    return undefined;
  }
  if (
    pending.kind === "gwNeutralEntry" ||
    pending.kind === "gwNeutralAction" ||
    pending.kind === "gwNeutralUnit" ||
    pending.kind === "gwNeutralDestination" ||
    pending.kind === "gwNeutralDeploy"
  ) {
    // 29.3: the engine owns the neutral-entry sequence and its follow-ups.
    return resolveGwNeutralOption(G, ctx, pending, optionId) ? undefined : INVALID_MOVE;
  }
  if (
    pending.kind === "gwColonialLoss" ||
    pending.kind === "gwColonialTransfer" ||
    pending.kind === "gwColonialBonusCp"
  ) {
    // 29.2 / 29.2.1: the losing alliance's loss / winning alliance's transfer
    // and bonus-CP choices.
    return resolveGwColonialChoice(G, ctx, pending, optionId) ? undefined : INVALID_MOVE;
  }
  // Card decisions.
  G.pending = null;
  resolveCardDecision(G, ctx, pending, optionId, opt.data ?? {});
  finalizePendingCard(G, ctx);
  return undefined;
};

export const declinePending = (G: ImperialElegyState, ctx: Ctx): string | void => {
  const result = declinePendingDecision(G, ctx);
  if (result === undefined) {
    settleBattleCharacteristics(G);
    // 15.1: an upkeep decision declined at the start of the maneuver step must
    // also let the queued start-of-maneuver battles continue.
    if (G.pending === null && G.battle === null && navalStartQueuePending(G)) {
      resolveNextNavalStartContact(G, ctx);
    }
  }
  return result;
};

const declinePendingDecision = (G: ImperialElegyState, ctx: Ctx): string | void => {
  const playerID = ctx.playerID ?? null;
  const pending = G.pending;
  if (!pending || playerID !== seatOf(pending.power)) return INVALID_MOVE;
  if (pending.kind === "gwBonusImpulse") return resolvePending(G, ctx, "skip");
  if (pending.kind === "movementDestination" && pending.context?.special === "endPhaseNavalReturn") {
    const first = pending.options[0];
    return first ? resolveNavalReturnChoice(G, ctx, pending, first.id) : INVALID_MOVE;
  }
  if (pending.kind === "confirm" && pending.context?.special === "attackerSurrender") {
    return resolveAttackerSurrender(G, ctx, pending, false);
  }
  if (pending.kind === "eventTargetPower" && pending.context?.special === "balanceOfPowerDraw") {
    // A required choice stays open instead of silently awarding a different ally.
    return INVALID_MOVE;
  }
  // These decisions have an explicit "done"/cost choice; never auto-pick one.
  if (pending.kind === "combatDiscard") return INVALID_MOVE;
  if (pending.kind === "impulseLoss") return INVALID_MOVE;
  // 19.2 always offers "fight", so declining an avoid decision cannot deadlock.
  if (pending.kind === "navalAvoid") return resolveNavalAvoid(G, ctx, pending, "fight");
  // 33.1 Blood and Iron!: declining searches nothing and draws NGs normally.
  if (pending.kind === "bloodAndIron") return resolveBloodAndIron(G, ctx, pending, "draw");
  // 33.1 German Confederation is optional: declining ends the settlement.
  if (pending.kind === "germanConfederation") {
    return resolveGermanConfederation(G, ctx, pending, "decline");
  }
  // 33.3 Napoleon's Legacy is optional: declining declares without the reveal.
  if (pending.kind === "napoleonsLegacy") {
    return resolveNapoleonsLegacy(G, ctx, pending, "decline");
  }
  // 33.4 Metternich's Legacy has no "skip": an unattended AU takes the first
  // eligible candidate (the same deterministic fallback as the old code).
  if (pending.kind === "metternich") {
    const first = pending.options[0];
    if (!first) return INVALID_MOVE;
    return resolveMetternichChoice(G, ctx, pending, first.id);
  }
  // 19.1: declining the interception window means "do not intercept"; the
  // window then advances to the next port/power or to avoidance.
  if (pending.kind === "navalInterception") {
    const skip = pending.options.find((o) => o.id === "skip");
    if (!skip) return INVALID_MOVE;
    return resolveNavalInterception(G, ctx, pending, skip.id) ? undefined : INVALID_MOVE;
  }
  // 19.5 footnote: a decline keeps the first adjacent box (deterministic).
  if (pending.kind === "navalPortBox") {
    const first = pending.options.find((o) => o.id.startsWith("box:"));
    if (!first) return INVALID_MOVE;
    return resolveNavalPortBox(G, ctx, pending, first.id) ? undefined : INVALID_MOVE;
  }
  // 19.1: declining to finish the movement keeps the ships where the battle
  // left them ("stop" is always offered).
  if (pending.kind === "navalContinuation") {
    const stop = pending.options.find((o) => o.id === "stop");
    if (!stop) return INVALID_MOVE;
    return resolveNavalContinuation(G, ctx, pending, stop.id);
  }
  // 19.8: declining the optional port move keeps the winning fleet at sea.
  if (pending.kind === "navalPortContinuation") {
    const stay = pending.options.find((o) => o.id === "stay");
    if (!stay) return INVALID_MOVE;
    return resolveNavalPortContinuation(G, ctx, stay.id) ? undefined : INVALID_MOVE;
  }
  // 19.4: an unattended attacker takes every mine hit (the deterministic
  // full-effect resolution) instead of silently retreating.
  if (pending.kind === "mineRetreat") {
    const takeAll = pending.options.find((o) => o.id === "continue");
    if (!takeAll) return INVALID_MOVE;
    return resolveMineRetreat(G, ctx, takeAll.id) ? undefined : INVALID_MOVE;
  }
  // 28.1.1: retreat is mandatory, so a decline uses the first legal space
  // instead of deadlocking the battle.
  if (pending.kind === "combatRetreat") {
    const first = pending.options[0];
    if (!first) return INVALID_MOVE;
    const battleSpace = G.battle?.to ?? null;
    if (!resolveCombatRetreat(G, ctx, first.id)) return INVALID_MOVE;
    reconcileRetreatOccupation(G, battleSpace, pending);
    return undefined;
  }
  // 3.4.1: declining a passage request is a refusal.
  if (pending.kind === "dardanellesPassage") {
    return resolveDardanellesPassage(G, ctx, pending, false);
  }
  // 8.6: declining an action-phase alliance tie takes the deterministic
  // direction (the same fallback the non-interactive resolver uses).
  if (pending.kind === "allianceTie" && pending.context?.special === "allianceResolution") {
    const roll = pending.context?.roll as AllianceResolutionRoll | undefined;
    const fallback = pending.options.find((candidate) => candidate.id === roll?.direction) ?? pending.options[0];
    if (!fallback) return INVALID_MOVE;
    G.pending = null;
    resolveAllianceResolutionTie(G, ctx, pending, fallback.id);
    finalizePendingCard(G, ctx);
    return undefined;
  }
  // 20.1/20.5/20.9 keep an explicit safe default (skip / first candidate /
  // deterministic tie direction), so an unattended end phase can never stall.
  if (pending.kind === "militarism" || pending.kind === "manpowerExcess" || pending.kind === "allianceTie") {
    return declineEndPhasePending(G, ctx, pending);
  }
  // 22.1.3 has no "skip": an unattended card takes the printed-order default
  // (Sardinia-Piedmont first), the same fallback as the one-shot path.
  if (pending.kind === "italianInternalWar") {
    const first = pending.options[0];
    if (!first) return INVALID_MOVE;
    G.pending = null;
    applyInternalItalianWar(G, first.id);
    finalizePendingCard(G, ctx);
    return undefined;
  }
  if (pending.kind === "italianPetition") {
    const first = pending.options[0];
    const choice = first?.data as {minor: (typeof ITALIAN_INTERNAL_WAR_POWERS)[number]; player: Power} | undefined;
    if (!first || !choice || !applyItalianPetition(G, choice)) return INVALID_MOVE;
    G.pending = null;
    finalizePendingCard(G, ctx);
    return undefined;
  }
  if (pending.kind === "italyNavalBase") {
    const first = pending.options[0];
    if (!first || !resolveItalyNavalBase(G, pending, first.id)) return INVALID_MOVE;
    G.pending = null;
    finalizePendingCard(G, ctx);
    return undefined;
  }
  if (pending.kind === "italyOttomanWar") {
    const first = pending.options[0];
    if (!first || !resolveItalyOttomanTerritoryChoice(G, pending, first.id)) return INVALID_MOVE;
    G.pending = null;
    finalizePendingCard(G, ctx);
    return undefined;
  }
  if (pending.kind === "italianNationalistWave") {
    let current: PendingDecision | null = pending;
    for (let guard = 0; current?.kind === "italianNationalistWave" && guard < 4; guard += 1) {
      const first = current.options[0];
      if (!first || !resolveItalianNationalistWaveChoice(G, ctx, current, first.id)) return INVALID_MOVE;
      current = G.pending;
    }
    if (G.pending === null) finalizePendingCard(G, ctx);
    return undefined;
  }
  // A card-chain step marked `required` must be answered with an explicit
  // option: declining would otherwise auto-pick the first space or card, which
  // is exactly the auto-pick the printed event cards forbid.  The auction and
  // optional-placement steps still offer an explicit "pass"/"done".
  if (pending.context?.required === true) {
    const explicit = pending.options.find((o) => o.id === "pass" || o.id === "done");
    if (!explicit) return INVALID_MOVE;
    G.pending = null;
    resolveCardDecision(G, ctx, pending, explicit.id, explicit.data ?? {});
    finalizePendingCard(G, ctx);
    return undefined;
  }
  if (pending.kind === "decisiveBattle") {
    if (!resolveDecisiveFollowUp(G, ctx, "done")) return INVALID_MOVE;
    reconcileFollowUpOccupation(G, "done");
    return undefined;
  }
  if (pending.kind === "whitePeaceOrder") {
    // 16.1.6: an unattended negotiation falls back to initiative order.
    return resolveWhitePeaceOrder(G, ctx, pending, "fallback");
  }
  if (pending.kind === "treatyOption" || pending.kind === "treatySpace") {
    // Treaty options are optional for the winner, but the losing side's
    // 16.1.6 knockout option still has to be chosen after the winner.
    const victory = victoryFromTreatyPending(pending);
    G.pending = null;
    if (!victory) return finishWarSettlement(G, ctx, treatyAppliedFromPending(pending));
    return advanceTreatyStage(G, ctx, pending, victory);
  }
  if (pending.kind === "warAllyConsent") {
    // Rule 14.0: declining a call is a refusal and takes the penalties.
    return resolveWarAllyConsent(G, ctx, pending, false);
  }
  if (pending.kind === "minorAbandon") {
    // 13.4.1's option is to abandon, so the safe default keeps the existing
    // behaviour and fights for the minor.
    return resolveMinorAbandon(G, ctx, pending, "join");
  }
  if (pending.kind === "minorAid") {
    // 13.4.2: declining is a refusal, which advances the aid search.
    return resolveMinorAid(G, ctx, pending, "decline");
  }
  if (pending.kind === "balanceOfPower") {
    // The UK's card is spent either way; a declined offer draws a card.
    return resolveBalanceOfPower(G, ctx, pending, false);
  }
  if (pending.kind === "demobilizationFreeAction" || pending.kind === "movementDestination") {
    return finishDemobilizationFreeActions(G, ctx, "declined");
  }
  if (pending.kind === "crisis" || pending.kind === "crisisIncident" || pending.kind === "crisisAlliance") {
    // A crisis choice has no "done": declining takes the first printed option
    // (the roll itself, the first legal bordering nation / Balkan state, or the
    // first legal alliance).  Never leave the crisis half-resolved.
    const first = pending.options[0];
    if (!first) return INVALID_MOVE;
    resolveCrisisDecision(G, ctx, pending, first.id);
    return undefined;
  }
  // 29.3: declining a neutral decision takes the printed "no" answer: stay
  // neutral, skip the free action, or finish the current neutral.
  if (pending.kind === "gwNeutralEntry") {
    return resolveGwNeutralOption(G, ctx, pending, "stay") ? undefined : INVALID_MOVE;
  }
  if (pending.kind === "gwNeutralAction") {
    return resolveGwNeutralOption(G, ctx, pending, "done") ? undefined : INVALID_MOVE;
  }
  if (pending.kind === "gwNeutralUnit") {
    return resolveGwNeutralOption(G, ctx, pending, "skip") ? undefined : INVALID_MOVE;
  }
  if (pending.kind === "gwNeutralDestination" || pending.kind === "gwNeutralDeploy") {
    // These need an explicit destination/space; there is no safe auto-pick.
    return INVALID_MOVE;
  }
  if (pending.kind === "gwDraft") {
    // 27.5.2: an unattended second draft forfeits the second army rather than
    // deadlocking the maneuver step.
    return resolveGwDraftSecond(G, ctx, pending, null) ? undefined : INVALID_MOVE;
  }
  // 29.2: the loss itself is mandatory, so an unattended losing alliance takes
  // the deterministic first candidate.  The transfer is optional ("may then
  // take control"), so a decline takes no further space.  29.2.1's decline is
  // the printed "no agreement": all bonus CP from that colonial pool are lost.
  if (pending.kind === "auUnstable") {
    // 33.4: an unattended AU takes the old deterministic choice (discard when
    // a card is available, otherwise the marker).
    const discard = pending.options.find((entry) => entry.id === "discard");
    const marker = pending.options.find((entry) => entry.id === "marker");
    const pick = discard ?? marker;
    if (!pick) return INVALID_MOVE;
    if (!resolveAuUnstableChoice(G, ctx, pending, pick.id)) return INVALID_MOVE;
    finalizePendingCard(G, ctx);
    return undefined;
  }
  if (pending.kind === "gwColonialLoss") {
    const first = pending.options[0];
    if (!first) return INVALID_MOVE;
    return resolveGwColonialChoice(G, ctx, pending, first.id) ? undefined : INVALID_MOVE;
  }
  if (pending.kind === "gwColonialTransfer") {
    return resolveGwColonialChoice(G, ctx, pending, "skip") ? undefined : INVALID_MOVE;
  }
  if (pending.kind === "gwColonialBonusCp") {
    return resolveGwColonialChoice(G, ctx, pending, "decline") ? undefined : INVALID_MOVE;
  }
  const done = pending.options.find((o) => o.id === "done") ?? pending.options[0];
  G.pending = null;
  if (pending.kind === "combatSupport") {
    chooseSupport(G, ctx, "done");
    return undefined;
  }
  if (done) resolveCardDecision(G, ctx, pending, done.id, done.data ?? {});
  finalizePendingCard(G, ctx);
  return undefined;
};

// ------------------------------------------------------------------ end phase
/**
 * Turn-start prep characteristics (33.3 / 33.4), applied as the next Prep Phase
 * opens: the free Zouave rebuild in Algeria and, on turn 2, The Dual Monarchy
 * added to the Austrian hand when it was not played for its event on turn 1.
 * Exported for the live tests; `endPhaseTurn` is the only production caller.
 */
export const applyPrepCharacteristics = (G: ImperialElegyState): void => {
  // 33.4 A Compromise Needed.  The helper owns the printed guard (turn 2,
  // not played, not already in hand); the game phase is set to prep first so
  // the window check sees the phase this function is opening.
  const previousPhase = G.phase;
  G.phase = "prep";
  const compromise = dualMonarchy(G);
  G.phase = previousPhase;
  if (compromise.shouldAddToHand) {
    // The card is a single physical copy: when it was played for CP on turn 1
    // it sits in the discard pile (and the prep deck merge shuffles that pile
    // straight back into `G.deck`).  Adding it to the hand without pulling the
    // other copy out leaves the game with two A047s, which then shows up as
    // the same card in the hand twice after a later draw.  Move it, never copy.
    for (const pile of [G.deck, G.discard, G.removed] as CardId[][]) {
      const index = pile.indexOf(DUAL_MONARCHY_CARD);
      if (index >= 0) pile.splice(index, 1);
    }
    for (const p of POWERS) {
      const chain = G.powers[p].cpChain;
      const index = chain.indexOf(DUAL_MONARCHY_CARD);
      if (index >= 0) chain.splice(index, 1);
      if (G.powers[p].industryCard === DUAL_MONARCHY_CARD) G.powers[p].industryCard = null;
    }
    G.powers.AU.hand.push(DUAL_MONARCHY_CARD);
    G.persistent.dualMonarchyDealt = true;
    log(G, "AU", "dualMonarchyAdded", {card: DUAL_MONARCHY_CARD});
  }
  // 33.3 The Zouaves rebuild for free in Algeria at the start of the prep phase.
  if (G.powers.FR.eliminated) return;
  if (Object.values(G.units).some((u) => u.kind === "zouave" && u.owner === "FR")) return;
  if (!G.spaces.algeria) return;
  placeUnit(G, "FR", "zouave", "algeria", 1);
  log(G, "FR", "zouaveRebuilt", {space: "algeria", free: true});
};

export const endPhaseTurn = (G: ImperialElegyState, ctx: Ctx): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  if (power === null || G.phase !== "end") return INVALID_MOVE;
  // The 20.1/20.5/20.9 decisions must be resolved before the phase can close;
  // otherwise a player could end the phase with the printed steps half-run.
  if (G.pending !== null) return INVALID_MOVE;
  const choices = String(G.powers[power].flags.ngChoices ?? "").split(",").filter(Boolean);
  if (choices.length > 0) {
    // Do not lose an undecided National Goal draw.
    chooseGoal(G, ctx, choices[0]);
  }
  G.powers[power].flags.endDone = true;
  if (POWERS.every((p) => G.powers[p].flags.endDone)) {
    // 2.2.1: "At the end of turn 7 (or the end of the scenario)".  The scenario
    // window replaces the campaign's hard-coded turn 7 so the two four-turn
    // scenarios and the two-turn tutorial end on their own printed turn.
    if (Number(G.flags.turnEnded ?? 0) >= campaignWindow(G).last) {
      finishScenario(G);
      ctx.events?.endGame?.({winner: G.result?.winners[0] ?? "GE"});
    } else {
      G.phase = "prep";
      applyPrepCharacteristics(G);
      ctx.events?.setPhase?.("prep");
    }
  }
  return undefined;
};

// ------------------------------------------------------------------ end phase

/**
 * The end phase opens its decisions from the phase's `onBegin` hook, where
 * boardgame.io forbids `setActivePlayers` (the end-phase `turn.onBegin` has
 * already made every seat active).  `openDecision` therefore runs without the
 * events plugin here; dice and stability still use the same ctx otherwise.
 */
const endPhaseCtx = (ctx: Ctx): Ctx => ({...ctx, events: undefined}) as Ctx;

/** Apply one recorded 20.1 benefit. */
export const applyMilitarismChoice = (
  G: ImperialElegyState,
  power: Power,
  choice: {benefit: MilitarismBenefit; space: SpaceId | null},
): void => {
  if (G.powers[power].eliminated) return;
  if (choice.benefit === "army" && choice.space !== null && G.spaces[choice.space]) {
    const space = choice.space;
    // 12.2: a step flips a reduced army rather than adding a new counter.
    const reduced = landUnitsIn(G, space).find(
      (unit) => unit.owner === power && unit.kind === "army" && unit.steps < 2,
    );
    if (reduced) {
      reduced.steps = 2;
    } else {
      const flags: Record<string, boolean> = {};
      if (power === "OT" && ottomanArmyTypeFor(space) === "arab") flags.arab = true;
      if (power === "UK" && (space === "india" || space === "bengal")) flags.indian = true;
      placeUnit(G, power, "army", space, 2, {flags});
    }
    log(G, power, "militarism", {choice: "army", space});
    return;
  }
  if (choice.benefit === "reserve") {
    addReserve(G, power, 1);
    log(G, power, "militarism", {choice: "reserve"});
    return;
  }
  if (choice.benefit === "fort" && choice.space !== null) {
    const fort = G.spaces[choice.space]?.fort;
    if (fort && fort.indian !== true && fort.level <= 2) {
      fort.protectedThisPhase = true;
      log(G, power, "militarism", {choice: "fort", space: choice.space, level: fort.level});
      return;
    }
  }
  log(G, power, "militarism", {choice: "skip"});
};

/**
 * 20.1 Militarism — one pending decision per non-eliminated player, in seat
 * order.  A player with no legal benefit is auto-skipped and logged.  Returns
 * true when the step suspended on a decision.
 *
 * The one-shot `resolveEnd` driver keeps the historical reserve-only behaviour
 * (`defaultMilitarismOption`), so deterministic tools and the round-1 end-phase
 * tests are unaffected; the live `beginEndPhase` always asks.
 */
const endPhaseMilitarism = (
  G: ImperialElegyState,
  ctx: Ctx,
  progress: EndPhaseProgress,
  interactive: boolean,
): boolean => {
  const settled = new Set<Power>(progress.militarismSettled ?? []);
  for (const power of POWERS) {
    if (settled.has(power)) continue;
    if (G.powers[power].eliminated) {
      settled.add(power);
      continue;
    }
    const options = militarismOptions(G, power);
    if (!interactive) {
      applyMilitarismChoice(G, power, defaultMilitarismOption(options));
      settled.add(power);
      continue;
    }
    const choosable = options.filter((candidate) => candidate.benefit !== "skip");
    if (choosable.length === 0) {
      applyMilitarismChoice(G, power, {benefit: "skip", space: null});
      settled.add(power);
      continue;
    }
    openDecision(
      G,
      endPhaseCtx(ctx),
      decision(
        "militarism",
        power,
        `End phase 20.1 — ${POWER_DEFS[power].name}: gain an army step or protect a fort from degrading`,
        options.map((candidate) => ({
          id: candidate.id,
          label: candidate.label,
          labelZh: candidate.labelZh,
          data: {benefit: candidate.benefit, space: candidate.space},
        })),
        undefined,
        undefined,
        `结束阶段 20.1 — ${POWER_DEFS[power].nameZh}：获得 1 个军团步，或保护 1 个要塞免于降级`,
      ),
    );
    progress.militarismSettled = [...settled];
    return true;
  }
  progress.militarismSettled = [...settled];
  return false;
};

/**
 * 20.2 Degrade forts, with the 33.2.3 Indian Fort exemption and the 20.1
 * protection benefit.
 *
 * The Indian Fort is created with `indian: true` by `placeIndianFort` (the Sun
 * Never Sets home card).  Older saves created before that flag existed are
 * repaired here: a UK fort in India can only be the Indian Fort, because the
 * standard Construct Fort action is restricted to Europe.
 *
 * A fort protected by this phase's 20.1 choice keeps its level; the flag is
 * consumed here so it can never protect the fort in a later end phase.
 */
const endPhaseDegradeForts = (G: ImperialElegyState): void => {
  for (const [space, s] of Object.entries(G.spaces)) {
    if (!s.fort) continue;
    if (s.fort.indian !== true && s.fort.power === "UK" && space === "india") s.fort.indian = true;
    if (s.fort.indian === true) continue;
    if (s.fort.protectedThisPhase === true) {
      delete s.fort.protectedThisPhase;
      continue;
    }
    s.fort.level -= 1;
    if (s.fort.level <= 0) s.fort = null;
  }
};

/**
 * 20.3 Non-Player Power Build Step.
 *
 * The End Phase Build Box roster lives in `G.nonPlayerBuildBox` (typed in
 * `types.ts`, defaulted from the printed campaign roster).  Each listed minor
 * gets one army step: promote a reduced army, or place a reduced army on the
 * minor's name space when it has none.  A unified Italy then flips all its
 * units to full strength and rebuilds the units waiting in the Italy box with
 * an Italian redeployment (22.4).
 */
const endPhaseNonPlayerBuild = (G: ImperialElegyState): void => {
  const box = (G.nonPlayerBuildBox ??= initialNonPlayerBuildBox());
  for (const entry of nonPlayerBuildPlan(G)) {
    if (entry.action === "placeReserve") {
      // 22.5(1): the Polish 4th/5th counters are reserve armies and belong in
      // the Polish reserve armies holding box.
      const unit = placeNonPlayerCounter(G, entry.minor, "reserveArmy", null, 1);
      if (unit === null) continue;
      const polish = (box.poland ??= {reserveArmies: []});
      polish.reserveArmies.push(unit.id);
      log(G, undefined, "nonPlayerBuild", {minor: entry.minor, space: null, kind: "reserveArmy", promoted: false, reserve: true});
    } else if (entry.action === "placeReduced" && entry.space !== null) {
      // 22.5/4.2: an independent Poland's standing counters are the chart's
      // "army" counters (3 of the 5 Polish armies), not a generic minor army.
      const kind = entry.minor === POLAND ? "army" : "minorArmy";
      if (placeNonPlayerCounter(G, entry.minor, kind, entry.space, 1) === null) continue;
      log(G, undefined, "nonPlayerBuild", {minor: entry.minor, space: entry.space, kind, promoted: false});
    } else if (entry.unitId !== null) {
      const unit = G.units[entry.unitId];
      if (unit) {
        unit.steps = Math.min(2, unit.steps + 1);
        const reserve = unit.space === null || unit.space === undefined;
        log(G, undefined, "nonPlayerBuild", {
          minor: entry.minor,
          space: reserve ? entry.home : unit.space,
          kind: unit.kind,
          promoted: true,
          reserve,
        });
      }
    }
  }
  const italy = italianRebuildPlan(G);
  if (italy === null) return;
  for (const id of italy.promote) {
    const unit = G.units[id];
    if (!unit) continue;
    unit.steps = unit.elite === true ? 1 : 2;
    log(G, undefined, "nonPlayerBuild", {minor: "Italy", space: unit.space, kind: unit.kind, promoted: true});
  }
  const rebuilt = {italianArmy: 0, squadron: 0, dreadnought: 0};
  for (const entry of italy.rebuild) {
    if (placeNonPlayerCounter(G, "IT", entry.kind, entry.space, 2) === null) continue;
    rebuilt[entry.kind] += 1;
    log(G, undefined, "nonPlayerBuild", {
      minor: "Italy",
      space: entry.space,
      kind: entry.kind,
      promoted: false,
      reserve: entry.space === null,
    });
  }
  // 22.4: only the counters actually redeployed leave the Italy box; a unit
  // with no legal 22.4 space waits there for the next end phase.
  box.italy = {
    italianArmy: Math.max(0, box.italy.italianArmy - rebuilt.italianArmy),
    squadron: Math.max(0, box.italy.squadron - rebuilt.squadron),
    dreadnought: Math.max(0, box.italy.dreadnought - rebuilt.dreadnought),
  };
};

/**
 * 20.4 Naval Units Go to Port.
 *
 * `navalReturnPlan` chooses the nearest friendly port (adjacent box first),
 * respects the four-unit port limit and reports units that must be eliminated
 * because their owner controls no port at all.
 */
const applyNavalReturn = (G: ImperialElegyState, entry: NavalReturnEntry): void => {
  const ids = entry.unitIds ?? [entry.unitId];
  const power = isPower(entry.owner) ? entry.owner : undefined;
  for (const id of ids) {
    if (entry.eliminate) { removeUnit(G, id); continue; }
    if (entry.to === null) continue;
    const unit = G.units[id];
    if (!unit) continue;
    if (unit.space && G.spaces[unit.space]) G.spaces[unit.space].units = G.spaces[unit.space].units.filter((unitId) => unitId !== id);
    G.spaces[entry.to].units.push(id);
    unit.space = entry.to;
  }
  if (entry.eliminate || entry.to !== null) log(G, power, "navalReturnToPort", {from: entry.from, to: entry.to, count: ids.length, eliminated: entry.eliminate});
};

const resolveNavalReturnChoice = (G: ImperialElegyState, ctx: Ctx, pending: PendingDecision, port: string): string | void => {
  if (G.phase !== "end" || G.endPhase === undefined) return INVALID_MOVE;
  const entry = navalReturnPlan(G).find((candidate) => candidate.unitId === pending.context?.unitId);
  if (!entry || !entry.destinations?.includes(port)) return INVALID_MOVE;
  const controller = isPower(entry.owner) ? entry.owner : minorController(G, entry.owner);
  if (controller !== pending.power) return INVALID_MOVE;
  G.pending = null;
  applyNavalReturn(G, {...entry, to: port});
  continueEndPhase(G, ctx);
  return undefined;
};

const endPhaseNavalToPort = (G: ImperialElegyState, ctx: Ctx, interactive: boolean): boolean => {
  for (const entry of navalReturnPlan(G)) {
    const controller = isPower(entry.owner) ? entry.owner : minorController(G, entry.owner);
    if (interactive && controller !== null && (entry.destinations?.length ?? 0) > 1) {
      openDecision(G, endPhaseCtx(ctx), decision(
        "movementDestination", controller, "Return to port: choose a nearest friendly port",
        entry.destinations!.map((port) => option(port, spaceLabel(port, "en"), {space: port}, false, spaceLabel(port, "zh_CN"))),
        {special: "endPhaseNavalReturn", unitId: entry.unitId, required: true},
      ));
      return true;
    }
    applyNavalReturn(G, entry);
  }
  return false;
};

/** Remove one standing army for 20.5 and log it. */
const applyManpowerElimination = (G: ImperialElegyState, power: Power, unitId: string): void => {
  const unit = G.units[unitId];
  if (!unit || unit.owner !== power) return;
  const space = unit.space ?? null;
  removeUnit(G, unitId);
  log(G, power, "manpowerExcess", {space, kind: "army"});
};

/**
 * 20.5 Set manpower (and the delayed Imperial Germany bonus).
 *
 * `recomputeTracks` applies every final manpower bonus (Imperial Germany,
 * A New Way Forward, The Young Turks) first; the resulting values are the
 * printed limit.  Owners then choose which standing armies to eliminate, one
 * decision at a time, until every track is within its limit.  A forced removal
 * (exactly one candidate) is applied without a decision, so the step can never
 * deadlock.  Reserve armies are in the holding box and are not affected.
 *
 * Returns true when the step suspended on a decision.
 */
const endPhaseSetManpower = (
  G: ImperialElegyState,
  ctx: Ctx,
  progress: EndPhaseProgress,
  interactive: boolean,
): boolean => {
  if (progress.manpowerSet !== true) {
    if (G.persistent.imperialGermany === "pending") {
      G.persistent.imperialGermany = "granted";
      log(G, "GE", "imperialGermanyManpower", {});
    }
    // 33.4 A New Way Forward: the +1 is granted once, during the end phase,
    // and latched so later recomputations keep it.
    grantAuNewWayForward(G);
    recomputeTracks(G);
    progress.manpowerSet = true;
  }
  for (const power of POWERS) {
    if (G.powers[power].eliminated) continue;
    for (;;) {
      const over = manpowerExcess(G, power)[0];
      if (over === undefined) break;
      if (!interactive || over.candidates.length <= 1) {
        applyManpowerElimination(G, power, over.candidates[0]);
        continue;
      }
      const excess = over.count - over.limit;
      openDecision(
        G,
        endPhaseCtx(ctx),
        decision(
          "manpowerExcess",
          power,
          `End phase 20.5 — ${POWER_DEFS[power].name}: eliminate ${excess} standing arm${excess === 1 ? "y" : "ies"} over the new manpower limit`,
          over.candidates.map((unitId) => {
            const space = G.units[unitId]?.space ?? null;
            return option(
              `excess:${unitId}`,
              `Eliminate the army in ${space === null ? "an unknown space" : spaceLabel(space, "en")}`,
              {unit: unitId},
              false,
              `裁减驻军：${space === null ? "未知空间" : spaceLabel(space, "zh_CN")}`,
            );
          }),
          undefined,
          undefined,
          `结束阶段 20.5 — ${POWER_DEFS[power].nameZh}：裁减超出新人力上限的 ${excess} 个常备军团`,
        ),
      );
      return true;
    }
  }
  return false;
};

/** 20.6 Industrialization (12.13). */
const endPhaseIndustrialization = (G: ImperialElegyState, ctx: Ctx): void => {
  refreshPowerProjection(G);
  for (const power of POWERS) {
    const p = G.powers[power];
    if (p.industryCard) {
      const cp = cardById(p.industryCard).cp;
      const needed = industryRollNeeded(G, power, cp);
      // 12.13: a card of any CP value succeeds automatically on the auto side.
      if (autoIndustrySuccess(G, power) || die(ctx, 6) >= needed) {
        p.industry = Math.min(maxIndustryOf(G, power), p.industry + 1);
        p.autoIndustry = false;
      } else {
        p.autoIndustry = true;
      }
      // A home card is a permanent part of its power's home slot: like a CP or
      // event play, industrialization returns it there instead of discarding it.
      if (cardById(p.industryCard).kind !== "home") G.discard.push(p.industryCard);
      p.industryCard = null;
    }
    p.flags.industryDrm = 0;
  }
};

/** 20.7 Progress truces (17.0). */
const endPhaseProgressTruces = (G: ImperialElegyState): void => {
  for (const war of G.wars) {
    if (war.truceTurns > 0) war.truceTurns = Math.max(0, war.truceTurns - 1);
  }
  // A scenario's printed truce (1880: "1 turn FR Truce") counts down with the
  // war truces so the two kinds expire on the same schedule.
  for (const key of Object.keys(G.persistent ?? {})) {
    if (!key.startsWith("scenarioTruce:")) continue;
    const remaining = Number(G.persistent[key] ?? 0);
    if (Number.isFinite(remaining) && remaining > 0) G.persistent[key] = remaining - 1;
  }
};

/**
 * 5.7: the WoI independence step displaces every unit that does not belong to
 * the newly independent minor.  The reusable helper owns the printed
 * destination/tie-breaking rules; this wrapper keeps the call site readable.
 */
const displaceUnitForWoi = (G: ImperialElegyState, unitId: string): void => {
  displaceUnitToFriendlyLoc(G, unitId);
};

/**
 * 20.8 Progress Wars of Independence.
 *
 * A marker that began the step on its +1 side gains independence: every unit
 * that does not belong to the newly independent minor is displaced (5.7), the
 * player who lost the space loses 1 stability, and the space is controlled by
 * the new minor.  All remaining 0 markers then flip to +1.
 */
const endPhaseProgressWarsOfIndependence = (G: ImperialElegyState, ctx: Ctx): void => {
  const plan = woiProgressPlan(G);
  for (const independence of plan.independence) {
    const state = G.spaces[independence.space];
    if (!state) continue;
    if (independence.controller !== null) {
      changeStability(G, independence.controller, -1, ctx, {cause: "other", space: independence.space});
    }
    for (const unitId of [...state.units]) {
      const unit = G.units[unitId];
      if (!unit) continue;
      if (unitMinor(unit.owner) === independence.minor) continue;
      displaceUnitForWoi(G, unitId);
    }
    setSpaceControl(
      G,
      independence.space,
      isIndependentIndia(G, independence.space) ? null : independence.minor,
    );
    state.rebellion = null;
    // 33.2.2: a legacy/card path that reaches a WoI in independent India must
    // not write a control marker there.  Log the rejection instead.
    if (isIndependentIndia(G, independence.space)) {
      log(G, undefined, "indiaMarkerRejected", {space: independence.space, marker: "control"});
    }
    // 22.5 / 3.8: an independent Poland gets its reserve holding box and its
    // two printed reserve-army counters, and joins the 20.3 build roster.
    if (independence.minor === "Poland") registerPolishIndependence(G);
    log(G, undefined, "woiIndependence", {
      space: independence.space,
      minor: independence.minor,
      stability: independence.controller === null ? 0 : -1,
      power: independence.controller ?? undefined,
    });
  }
  for (const space of plan.advance) {
    const rebellion = G.spaces[space]?.rebellion;
    if (rebellion) rebellion.step = 1;
  }
};

/**
 * 20.9 Conduct an Alliance Resolution Step (8.6).
 *
 * The resolutions still to run are fixed when the step starts (8.6 order:
 * highest total influence first, ties by seat order).  A tie among a power's
 * highest marker results is the printed "the player chooses how they shift"
 * (8.6), so the step suspends on a pending decision for that power.  The rolled
 * dice live in the decision's context and are never rolled twice.  Returns
 * true when the step suspended.
 */
const endPhaseAllianceResolution = (
  G: ImperialElegyState,
  ctx: Ctx,
  progress: EndPhaseProgress,
  interactive: boolean,
): boolean => {
  const state = (progress.alliance ??= {order: allianceResolutionOrder(G), index: 0});
  while (state.index < state.order.length) {
    const power = state.order[state.index];
    const roll = rollAllianceResolution(G, ctx, power);
    if (interactive && roll.tied.length > 1) {
      openDecision(
        G,
        endPhaseCtx(ctx),
        decision(
          "allianceTie",
          power,
          `${POWER_DEFS[power].name}: the alliance resolution roll is tied — choose the shift`,
          roll.tied.map((side) => option(
            side,
            side === "te" ? "Triple Entente" : side === "ta" ? "Triple Alliance" : "Neutral",
            undefined,
            false,
            side === "te" ? "协约国" : side === "ta" ? "同盟国" : "中立",
          )),
          {roll},
          undefined,
          `${POWER_DEFS[power].nameZh}：同盟结算掷骰平局——选择偏移方向`,
        ),
      );
      return true;
    }
    applyAllianceResolution(G, roll, roll.direction);
    state.index += 1;
  }
  // 8.6: "all players and a unified Italy determine if they shift".  Italy has
  // its own MPIT column (8.5); its printed tie rule rerolls instead of asking a
  // player, so no decision is opened.  The shared resolver is the same one the
  // action-phase Alliance System / Shifting Alliances events run.
  if (state.italyDone !== true) {
    state.italyDone = true;
    resolveItalyAllianceStep(G, ctx);
  }
  return false;
};

/** 20.10 Decrease World Tension by 1. */
const endPhaseDecreaseWorldTension = (G: ImperialElegyState, ctx: Ctx): void => {
  changeWtt(G, -1, ctx);
};

/**
 * 20.11 Draw NGs on turns 1, 3 and 5 (the turn that just ended).
 *
 * 33.1 Blood and Iron!: on turn 1 GE may instead search its NG deck for the
 * Unification! card.  The choice suspends the step; `progress.ngDraw` records
 * which power draws next so the other five powers draw exactly once.
 */
const endPhaseDrawNgs = (
  G: ImperialElegyState,
  ctx: Ctx,
  progress: EndPhaseProgress,
  interactive: boolean,
): boolean => {
  // 2.4 / 20.11: the campaign draws on turns 1, 3 and 5; the 1870 scenario on
  // 3 and 5 and the 1880 scenario on 4 and 6 ("instead of turns 3 and 5").
  if (!drawsNgsThisTurn(G)) return false;
  const start = progress.ngDraw?.index ?? 0;
  for (let index = start; index < POWERS.length; index += 1) {
    const power = POWERS[index];
    const p = G.powers[power];
    if (
      interactive &&
      G.turn === 1 &&
      power === "GE" &&
      hasBloodAndIron(G) &&
      !p.eliminated &&
      !p.goals.includes(GE_UNIFICATION_GOAL) &&
      p.goalDeck.includes(GE_UNIFICATION_GOAL)
    ) {
      progress.ngDraw = {index};
      openDecision(
        G,
        ctx,
        decision(
          "bloodAndIron",
          "GE",
          "Blood and Iron!: search the NG deck for Unification! and play it faceup?",
          [
            option("search", "Search for Unification! (NG-08) and reveal it"),
            option("draw", "Draw National Goals normally"),
          ],
        ),
      );
      return true;
    }
    // The 1870/1880 scenarios print "The GE player only draws 2 NGs".
    const drawn = p.goalDeck.splice(0, ngDrawCount(G, power));
    p.flags.ngChoices = drawn.join(",");
    progress.ngDraw = {index: index + 1};
  }
  delete progress.ngDraw;
  return false;
};

/** 20.12 Advance the turn (and the decade), ending the game after turn 7. */
const endPhaseAdvanceTurn = (G: ImperialElegyState): void => {
  // Every "for the rest of the turn" card flag ends with this turn.  Clearing
  // before the counter moves keeps the new turn (and the next decade) clean.
  clearTurnDurationFlags(G);
  G.flags.turnEnded = G.turn;
  G.turn += 1;
  // 10.1/10.2: keep the displayed decade in step with the new campaign turn.
  G.decade = decadeForTurn(G.turn);
};

type EndPhaseStepKey = ReturnType<typeof endPhaseOrder>[number]["key"];

/**
 * Apply one printed end-phase step.  Returns true when the step suspended on a
 * pending decision (only 20.1, 20.5 and 20.9 can).
 */
const applyEndPhaseStep = (
  G: ImperialElegyState,
  ctx: Ctx,
  key: EndPhaseStepKey,
  progress: EndPhaseProgress,
  interactive: boolean,
): boolean => {
  switch (key) {
    case "militarism":
      return endPhaseMilitarism(G, ctx, progress, interactive);
    case "degradeForts":
      endPhaseDegradeForts(G);
      return false;
    case "nonPlayerBuild":
      endPhaseNonPlayerBuild(G);
      return false;
    case "navalUnitsToPort":
      return endPhaseNavalToPort(G, ctx, interactive);
    case "setManpower":
      return endPhaseSetManpower(G, ctx, progress, interactive);
    case "industrialization":
      endPhaseIndustrialization(G, ctx);
      return false;
    case "progressTruces":
      endPhaseProgressTruces(G);
      return false;
    case "progressWarsOfIndependence":
      endPhaseProgressWarsOfIndependence(G, ctx);
      return false;
    case "allianceResolution":
      return endPhaseAllianceResolution(G, ctx, progress, interactive);
    case "decreaseWorldTension":
      endPhaseDecreaseWorldTension(G, ctx);
      return false;
    case "drawNationalGoals":
      return endPhaseDrawNgs(G, ctx, progress, interactive);
    case "advanceTurn":
      endPhaseAdvanceTurn(G);
      return false;
  }
};

/** Walk the printed twelve-step order, suspending at the first open decision. */
const runEndPhase = (
  G: ImperialElegyState,
  ctx: Ctx,
  trace: string[] | undefined,
  interactive: boolean,
): void => {
  const progress: EndPhaseProgress = interactive ? (G.endPhase ??= {step: 0}) : {step: 0};
  // A032: "At the start of the end phase roll a die" while the American Civil
  // War is in effect.  Keyed on the first step so a suspended-and-resumed end
  // phase only rolls once.
  if (progress.step === 0 && G.persistent.acw === true) {
    if (G.flags.acwRolledTurn !== G.turn) {
      G.flags.acwRolledTurn = G.turn;
      resolveAmericanCivilWarEndPhase(G, ctx);
    }
  }
  const steps = endPhaseOrder();
  while (progress.step < steps.length) {
    const step = steps[progress.step];
    trace?.push(step.key);
    if (applyEndPhaseStep(G, ctx, step.key, progress, interactive)) {
      G.phase = "end";
      return;
    }
    progress.step += 1;
  }
  if (interactive) delete G.endPhase;
  G.phase = "end";
};

/**
 * Rule 20.0 — deterministic one-shot resolution of the end phase.
 *
 * This is the non-interactive driver used by tests and tools (and by callers
 * that must never suspend): it walks the printed order and takes each step's
 * deterministic default (for 20.1 that is the historical reserve step).  The
 * live end phase is `beginEndPhase`, which asks the players through pending
 * decisions instead.
 *
 * `trace` is an optional test/debug sink: when supplied, each step key is
 * pushed as it is applied, so a test can pin the printed sequence without
 * adding bookkeeping to the serialized game state.
 */
export const resolveEnd = (G: ImperialElegyState, ctx: Ctx, trace?: string[]): void => {
  // Defensive migration for a save resumed mid-turn: boardgame.io never runs a
  // phase `onBegin` for a loaded match, and the twelve 20.x steps read the
  // round 1–6 typed records.  Additive only, so a live state is untouched.
  ensureStateDefaults(G);
  // 33.2 The Indian Army: Indian armies automatically displace to Bengal or
  // India at the end of a turn.  This runs as the end phase opens, before the
  // 20.x steps advance the turn counter.
  displaceIndianArmies(G, "endOfTurn");
  runEndPhase(G, ctx, trace, false);
};

/**
 * Rule 20.0 — live end phase: start the twelve printed steps and suspend on
 * the per-player 20.1/20.5/20.9 decisions.  `continueEndPhase` resumes after a
 * decision has been recorded.
 */
export const beginEndPhase = (G: ImperialElegyState, ctx: Ctx): void => {
  displaceIndianArmies(G, "endOfTurn");
  delete G.endPhase;
  runEndPhase(G, ctx, undefined, true);
};

/** Resume the live end phase after a pending decision (no-op when complete). */
export const continueEndPhase = (G: ImperialElegyState, ctx: Ctx): void => {
  if (G.endPhase === undefined) return;
  runEndPhase(G, ctx, undefined, true);
};

/** Record one end-phase pending decision and resume the printed order. */
const resolveEndPhasePending = (
  G: ImperialElegyState,
  ctx: Ctx,
  pending: PendingDecision,
  optionId: string,
): string | void => {
  const choice = pending.options.find((candidate) => candidate.id === optionId);
  if (!choice) return INVALID_MOVE;
  G.pending = null;
  if (pending.kind === "militarism") {
    const data = choice.data ?? {};
    const benefit = String(data.benefit ?? "skip") as MilitarismBenefit;
    const space = typeof data.space === "string" ? data.space : null;
    applyMilitarismChoice(G, pending.power, {benefit, space});
    const progress = G.endPhase;
    if (progress) {
      progress.militarismSettled = [...(progress.militarismSettled ?? []), pending.power];
    }
  } else if (pending.kind === "manpowerExcess") {
    applyManpowerElimination(G, pending.power, String(choice.data?.unit ?? ""));
  } else {
    // 20.9: the die results were rolled before the decision opened, so the
    // player's direction is applied without rerolling the tie.
    const roll = pending.context?.roll as AllianceResolutionRoll | undefined;
    if (roll !== undefined) {
      const direction: AllianceDirection = roll.tied.includes(choice.id as AllianceDirection)
        ? (choice.id as AllianceDirection)
        : roll.direction;
      applyAllianceResolution(G, roll, direction);
      if (G.endPhase?.alliance) G.endPhase.alliance.index += 1;
    }
  }
  continueEndPhase(G, ctx);
  return undefined;
};

/** Decline a 20.1/20.5/20.9 decision with its printed-safe default. */
const declineEndPhasePending = (
  G: ImperialElegyState,
  ctx: Ctx,
  pending: PendingDecision,
): string | void => {
  if (pending.kind === "militarism") {
    // Rule 20.1 offers no skip when a benefit is legal; the deterministic
    // fallback then takes the reserve step (the old one-shot default).
    const choice =
      pending.options.find((candidate) => candidate.id === "skip") ??
      pending.options.find((candidate) => candidate.id === "reserve") ??
      pending.options[0];
    if (!choice) return INVALID_MOVE;
    return resolveEndPhasePending(G, ctx, pending, choice.id);
  }
  if (pending.kind === "manpowerExcess") {
    const first = pending.options[0];
    if (!first) return INVALID_MOVE;
    return resolveEndPhasePending(G, ctx, pending, first.id);
  }
  // A tied alliance roll falls back to the deterministic 8.6 direction.
  const roll = pending.context?.roll as AllianceResolutionRoll | undefined;
  const fallback =
    pending.options.find((candidate) => candidate.id === roll?.direction) ?? pending.options[0];
  if (!fallback) return INVALID_MOVE;
  return resolveEndPhasePending(G, ctx, pending, fallback.id);
};

export const chooseGoal = (G: ImperialElegyState, ctx: Ctx, goalId: string): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  if (power === null || G.phase !== "end") return INVALID_MOVE;
  const p = G.powers[power];
  const choices = String(p.flags.ngChoices ?? "").split(",").filter(Boolean);
  if (!choices.includes(goalId)) return INVALID_MOVE;
  p.goals.push(goalId);
  p.goalDeck.push(...choices.filter((id) => id !== goalId));
  p.flags.ngChoices = "";
  return undefined;
};

export const endTurn = (G: ImperialElegyState, ctx: Ctx): void => {
  G.flags.endDone = false;
  // 2.2.1: the scenario's last turn ends the game, not a hard-coded turn 7.
  if (G.turn > campaignWindow(G).last) {
    finishScenario(G);
  }
};

// ------------------------------------------------------------------ limited-war
/**
 * Rule 16.1.6: a white peace where both sides knocked out an ally has no
 * classified victor and no printed chooser order.  Picking the order is a
 * negotiation, not a unilateral choice: the attacker proposes, the defender
 * accepts or counters, and the attacker accepts or declines the counter.  If
 * the two sides cannot agree, the initiative order breaks the tie (the side
 * whose primary belligerent opened the war goes first) rather than letting one
 * player impose the order.
 */
const whitePeaceFallbackSide = (war: WarState): WarSideName => {
  const first = war.initiative.find((power) => power === war.attacker || power === war.defender);
  return first === war.defender ? "defender" : "attacker";
};

const whitePeaceOrderPrompt = (
  stage: "propose" | "respond" | "confirm",
  proposed: WarSideName | null,
  fallback: WarSideName,
): string => {
  const sideLabel = (side: WarSideName): string => (side === "attacker" ? "attacker" : "defender");
  if (stage === "propose") {
    return "White peace with knockouts on both sides: propose which side imposes its treaty option first";
  }
  if (stage === "respond") {
    return `The attacker proposes the ${sideLabel(proposed ?? fallback)} first. Accept, or counter with the other order?`;
  }
  return `The defender counters: the ${sideLabel(proposed ?? fallback)} first. Accept, or let the initiative order (${sideLabel(fallback)} first) decide?`;
};

const whitePeaceOrderPromptZh = (
  stage: "propose" | "respond" | "confirm",
  proposed: WarSideName | null,
  fallback: WarSideName,
): string => {
  const sideLabel = (side: WarSideName): string => (side === "attacker" ? "进攻方" : "防守方");
  if (stage === "propose") {
    return "双方均有盟国崩溃的白和：提议由哪一方先行决定条约选项";
  }
  if (stage === "respond") {
    return `进攻方提议由${sideLabel(proposed ?? fallback)}先选。接受，还是反提议另一种顺序？`;
  }
  return `防守方反提议：由${sideLabel(proposed ?? fallback)}先选。接受，还是交由先手顺序决定（${sideLabel(fallback)}先）？`;
};

const openWhitePeaceOrder = (
  G: ImperialElegyState,
  ctx: Ctx,
  victory: VictoryClassification,
): boolean => {
  const war = G.war;
  if (!war) return false;
  const fallback = whitePeaceFallbackSide(war);
  openDecision(G, ctx, decision(
    "whitePeaceOrder",
    war.attacker,
    whitePeaceOrderPrompt("propose", null, fallback),
    [
      option("attacker", "Propose our side chooses first"),
      option("defender", "Propose the defending side chooses first"),
    ],
    {victory, stage: "propose", proposed: null, fallback, applied: []},
    undefined,
    whitePeaceOrderPromptZh("propose", null, fallback),
  ));
  return true;
};

const resolveWhitePeaceOrder = (
  G: ImperialElegyState,
  ctx: Ctx,
  pending: PendingDecision,
  optionId: string,
): string | void => {
  const victory = victoryFromTreatyPending(pending);
  if (!victory) return INVALID_MOVE;
  const war = G.war;
  if (!war) return INVALID_MOVE;
  const rawStage = pending.context?.stage;
  const stage = rawStage === "respond" || rawStage === "confirm" ? rawStage : "propose";
  const proposedRaw = pending.context?.proposed;
  const proposed: WarSideName | null = proposedRaw === "attacker" || proposedRaw === "defender" ? proposedRaw : null;
  const fallbackRaw = pending.context?.fallback;
  const fallback: WarSideName =
    fallbackRaw === "attacker" || fallbackRaw === "defender" ? fallbackRaw : whitePeaceFallbackSide(war);
  const settle = (side: WarSideName): string | void => {
    G.pending = null;
    return beginInteractiveWarSettlement(G, ctx, {...victory, firstSide: side});
  };

  if (optionId === "fallback") return settle(fallback);

  if (stage === "propose") {
    if (optionId !== "attacker" && optionId !== "defender") return INVALID_MOVE;
    G.pending = null;
    openDecision(G, ctx, decision(
      "whitePeaceOrder",
      war.defender,
      whitePeaceOrderPrompt("respond", optionId, fallback),
      [
        option("accept", "Accept the proposed order"),
        option("counter", "Counter-propose the other order"),
      ],
      {victory, stage: "respond", proposed: optionId, fallback, applied: []},
      undefined,
      whitePeaceOrderPromptZh("respond", optionId, fallback),
    ));
    return undefined;
  }

  if (stage === "respond") {
    if (optionId === "accept") return settle(proposed ?? fallback);
    if (optionId !== "counter") return INVALID_MOVE;
    G.pending = null;
    const counter: WarSideName = (proposed ?? fallback) === "attacker" ? "defender" : "attacker";
    openDecision(G, ctx, decision(
      "whitePeaceOrder",
      war.attacker,
      whitePeaceOrderPrompt("confirm", counter, fallback),
      [
        option("accept", "Accept the defender's order"),
        option(
          "decline",
          `Let the initiative order decide (${fallback === "attacker" ? "attacker" : "defender"} first)`,
          undefined,
          false,
          `交由先手顺序决定（${fallback === "attacker" ? "进攻方" : "防守方"}先）`,
        ),
      ],
      {victory, stage: "confirm", proposed: counter, fallback, applied: []},
      undefined,
      whitePeaceOrderPromptZh("confirm", counter, fallback),
    ));
    return undefined;
  }

  if (optionId === "accept") return settle(proposed ?? fallback);
  if (optionId === "decline") return settle(fallback);
  return INVALID_MOVE;
};

/**
 * Rule 16.2: apply the classified outcome and open the interactive treaty
 * chooser.  Shared by the direct `resolveWar` path and the 16.1.6 white-peace
 * order decision so the outcome is applied exactly once.
 */
const beginInteractiveWarSettlement = (
  G: ImperialElegyState,
  ctx: Ctx,
  victory: VictoryClassification,
): string | void => {
  const war = G.war;
  if (!war) return INVALID_MOVE;
  applyVictoryOutcome(G, war, victory, ctx);
  clearWarSettlementFlags(G);
  G.flags.postWarWinner = victory.victor === "defender" ? war.defender : war.attacker;
  if (openNextTreatyStage(G, ctx, victory, [])) return undefined;
  return finishWarSettlement(G, ctx);
};

export const resolveWar = (
  G: ImperialElegyState,
  ctx: Ctx,
  // Explicit choices settle in one step (direct callers/tests).  When omitted
  // the winner is prompted through a `treatyOption` pending decision and the
  // war demobilizes after the chooser finishes; [] means "no treaties".
  treatyChoices?: readonly TreatyChoice[],
): string | void => {
  const war = G.war;
  if (!war || G.pending !== null) return INVALID_MOVE;

  const rawStart: unknown = G.flags.limitedWarAttackerStart;
  const attackerControlledAtStart = Array.isArray(rawStart)
    ? rawStart.filter((space): space is string => typeof space === "string")
    : typeof rawStart === "string" && rawStart.length > 0
      ? rawStart.split(",").filter(Boolean)
      : [];
  const negotiatedRaw = G.flags.negotiatedPeace;
  const negotiatedPeace =
    negotiatedRaw === "attacker" || negotiatedRaw === "defender" ? negotiatedRaw : null;
  const trueFlag = (value: unknown): boolean => value === true || value === "true" || value === 1;

  // 15.6: settle any capital that was occupied without a capture hook before
  // classification, so the knockout is historical rather than re-derived.
  recordWarKnockouts(G);
  const victory = classifyVictory(G, war, {
    attackerControlledAtStart,
    negotiatedPeace,
    whitePeace: trueFlag(G.flags.whitePeace),
    defenderBlockading: trueFlag(G.flags.defenderBlockading),
  });

  if (treatyChoices !== undefined) {
    return settleWarImmediately(G, ctx, victory, treatyChoices);
  }

  // Rule 16.2: the victor chooses treaty options interactively.  Rule 16.1.6
  // keeps the knockout options even in a white peace, including a two-sided
  // white peace where both sides knocked out an ally: no primary victory and no
  // primary loser, but each knockout's captor still imposes its option.  With
  // no printed order the two primaries negotiate the order (16.1.6); if they do
  // not agree, the initiative order decides.  If no option is legal the war
  // settles immediately.
  const pickCounts = treatyPickCounts(victory);
  const totalPicks = pickCounts.primary + pickCounts.knockout + pickCounts.loserKnockout;
  if (totalPicks > 0 && treatyOptionsFor(G, war, victory).length > 0) {
    // Rule 16.1.6: no printed order exists for a two-sided white-peace
    // knockout, so offer the choice (attacker-first remains the fallback when
    // the decision is declined or no interactive settlement is used).
    if (needsWhitePeaceOrderChoice(victory) && openWhitePeaceOrder(G, ctx, victory)) return undefined;
    return beginInteractiveWarSettlement(G, ctx, victory);
  }
  return settleWarImmediately(G, ctx, victory, []);
};

export const passWarMove = (G: ImperialElegyState, ctx: Ctx): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  if (!G.war || power === null) return INVALID_MOVE;
  return recordWarPass(G, ctx, power);
};

/**
 * Rule 14.0: the called ally decides.  Accepting joins exactly as the old
 * immediate call did; refusing applies the printed penalties and records the
 * refusal so the same ally cannot be asked twice in this war.
 */
const resolveWarAllyConsent = (
  G: ImperialElegyState,
  ctx: Ctx,
  pending: PendingDecision,
  accept: boolean,
  allianceSide?: AllianceSide,
): string | void => {
  const caller = pending.context?.caller;
  const ally = pending.context?.ally;
  if (!isPower(caller) || !isPower(ally)) return INVALID_MOVE;
  const war = G.war;
  if (!war) return INVALID_MOVE;

  if (accept) {
    const cardId =
      typeof pending.context?.cardId === "string" ? (pending.context.cardId as CardId) : undefined;
    const statusQuo = pending.context?.statusQuo === true;
    // Re-run the live eligibility/join validation so a card spent or a truce
    // signed between the call and the answer is honoured.
    const joined = joinWarAsAlly(G, war, caller, ally, {cardId, statusQuo, allianceSide});
    if (!joined.applied) return INVALID_MOVE;
    // 33.2 Rapid Deployment: joining a war is entering it.
    if (ally === "UK") grantRapidDeployment(G, "limited");
    // The Balance of Power card: "one player (your choice) that you invited
    // (and that joined) also draws a card at the end of the war." Record every
    // actual invitee, then let the UK choose one at settlement.
    if (caller === "UK" && (war.postWarDraws ?? []).includes("UK")) {
      war.postWarDrawCandidates = [...new Set([...(war.postWarDrawCandidates ?? []), ally])];
    }
    G.pending = null;
    return undefined;
  }

  const side =
    war.attacker === caller || war.attackerAllies.includes(caller)
      ? "attacker"
      : war.defender === caller || war.defenderAllies.includes(caller)
        ? "defender"
        : null;
  // Rule 14.0 exception: a refusal forced by a truce carries no penalty.
  const opposing = side === null ? [] : sidePowers(war, side === "attacker" ? "defender" : "attacker");
  const exemptForTruce = truceRivals(G, ally).some((rival) => opposing.includes(rival));
  applyAllyRefusal(G, war, caller, ally, {exemptForTruce}, ctx);
  const refused = war.refusedAllies ?? (war.refusedAllies = []);
  if (!refused.includes(ally)) refused.push(ally);
  G.pending = null;
  return undefined;
};

export const callWarAlly = (G: ImperialElegyState, ctx: Ctx, ally: Power): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  if (!G.war || power === null) return INVALID_MOVE;
  // One call at a time: the previous called ally must answer first.
  if (G.pending !== null) return INVALID_MOVE;
  // Rule 14.0: a caller may ask the same ally only once per war.
  if ((G.war.refusedAllies ?? []).includes(ally)) return INVALID_MOVE;
  // 33.2 Maintaining the Status Quo: a UK that is the war's primary defender
  // may invite neutral players as well as allies during the alliance step.
  const statusQuo =
    power === "UK" && G.war.defender === "UK" && G.war.status === "alliance";
  // Rule 14.0: only a primary belligerent may call an ally, the ally must be
  // in the same alliance box (or neutral under 33.2), and its joining card
  // must be a playable event (never a mandatory, response or combat card).
  const call = allyCallEligibility(G, G.war, power, ally, {
    truceWith: truceRivals(G, ally),
    statusQuo,
  });
  if (!call.ok) return INVALID_MOVE;
  // 8.4: a called ally must already be a member of the caller's alliance, or
  // be a Status Quo neutral entering a box with room.  Check the shared
  // predicate anyway so a future join path cannot bypass the cap.
  const callerSide = sideOfAllianceBox(G.powers[power].alliance);
  if (call.allianceSide === null && callerSide !== null && !canJoinAlliance(G, ally, callerSide)) {
    return INVALID_MOVE;
  }
  // Rule 8.2's both-neutral case is the printed "the defending power chooses
  // which alliance box to shift into"; the invited neutral makes that choice
  // when the attacker's chit gives no direction.
  const choicesForNeutral: Array<{
    id: string;
    label: string;
    labelZh?: string;
    data?: Record<string, unknown>;
    secret?: boolean;
  }> = [];
  if (call.allianceSide !== null) {
    const derived = declarationShiftDirection(
      G.powers[G.war.attacker].alliance,
      G.powers[ally].alliance,
    );
    if (derived === null) {
      for (const side of ["te", "ta"] as const) {
        if (!canJoinAlliance(G, ally, side)) continue;
        if (sideOfAllianceBox(G.powers[G.war.attacker].alliance) === side) continue;
        choicesForNeutral.push({
          id: `accept:${side}`,
          label: `Join ${powerLabel(power)} and shift into the ${
            side === "te" ? "Triple Entente" : "Triple Alliance"
          } box`,
          labelZh: `加入${POWER_DEFS[power].nameZh}并转入${
            side === "te" ? "协约国" : "同盟国"
          }阵营`,
          data: {allianceSide: side},
        });
      }
    }
  }
  const acceptOptions = choicesForNeutral.length > 0
    ? choicesForNeutral
    : [{id: "accept", label: `Join the war with ${powerLabel(power)}`, labelZh: `与${POWER_DEFS[power].nameZh}并肩参战`}];
  // The call itself is public; the accept/refuse choice is private to the
  // called ally (playerView hides options/context from every other seat).
  openDecision(G, ctx, {
    kind: "warAllyConsent",
    power: ally,
    prompt: call.allianceSide !== null
      ? "Maintaining the Status Quo: the UK invites you to join the war"
      : "A player ally has called you to war",
    promptZh: call.allianceSide !== null
      ? "维持现状：英国邀请你参战"
      : "一位玩家盟友召唤你参战",
    promptArgs: {
      caller: power,
      callerLabel: powerLabel(power),
      ally,
      allyLabel: powerLabel(ally),
      side: call.side ?? "",
      warAim: G.war.warAim ?? "",
      statusQuo: call.allianceSide !== null,
    },
    options: [
      ...acceptOptions,
      {id: "refuse", label: "Refuse the call (rule 14.0 penalties)", labelZh: "拒绝召唤（适用 14.0 惩罚）"},
    ],
    context: {
      caller: power,
      ally,
      side: call.side,
      cardId: call.cardId,
      budget: call.budget,
      warStartedTurn: G.war.startedTurn,
      statusQuo: call.allianceSide !== null,
      allianceSide: call.allianceSide,
    },
    blocking: true,
  });
  log(G, power, "allyCalledToWar", {
    ally,
    side: call.side ?? "",
    statusQuo: call.allianceSide !== null,
  });
  return undefined;
};

// ------------------------------------------------------------------ Balance of Power
/** UK home card 4, the declaration-response card. */
export const BALANCE_OF_POWER_CARD: CardId = "IE-H-UK-4";
/** "Otto von Bismarck": Balance of Power "cannot be played in response to" it. */
export const BISMARCK_CARD: CardId = BISMARCK_HOME_CARD;

/**
 * The Ottoman naval base in the Eastern Mediterranean that the Balance of
 * Power card hands to the UK "as soon as you enter the war" when it intervenes
 * to help the Ottomans.  Rhodes is the printed base; the lookup stays data
 * driven so a future base joins the same clause instead of a hard-coded id.
 */
export const ottomanEasternMedBase = (G: ImperialElegyState): SpaceId | null => {
  const base = Object.values(SPACES).find(
    (space) =>
      space.type === "navalBase" &&
      space.home === "OT" &&
      (space.ports ?? []).includes("eastern-mediterranean") &&
      G.spaces[space.id]?.control === "OT",
  );
  return base?.id ?? null;
};

/**
 * Rule 14.2.1 / the UK Balance of Power home card:
 *
 * > Gain 1 stability.  If the defender agrees, you become the primary
 * > belligerent and you enter the war on the defending side.  Use this card's
 * > CP value for your CP war budget.  If you enter the war, draw a card at the
 * > end of the war.  One player (your choice) that you invited (and that
 * > joined) also draws a card at the end of the war.  Additionally, if
 * > intervening to help the Ottomans, take control of an Ottoman naval base in
 * > the Eastern Mediterranean as soon as you enter the war.  If the defender
 * > does not agree draw a card.  Play when another player declares war; cannot
 * > be played in response to Otto von Bismarck.
 *
 * Live path for the Option A (intervention) half of the card.  The UK may call
 * this move during the war's declaration window, before the alliance step
 * closes; the defender then answers through the generic pending panel.  Option
 * B ("play as an event to gain 1 stability, draw a card") remains the normal
 * `playCard` event path.
 */
export const playBalanceOfPower = (G: ImperialElegyState, ctx: Ctx): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  const war = G.war;
  if (power !== "UK" || !war) return INVALID_MOVE;
  if (G.pending !== null) return INVALID_MOVE;
  if (G.phase !== "wartime") return INVALID_MOVE;
  if (war.status !== "warAim" && war.status !== "alliance") return INVALID_MOVE;
  if (!G.powers.UK.hand.includes(BALANCE_OF_POWER_CARD)) return INVALID_MOVE;
  // "Play when another player declares war": the UK cannot answer its own.
  if (war.attacker === "UK") return INVALID_MOVE;
  if (belligerentsOf(war).includes("UK")) return INVALID_MOVE;
  // "Cannot be played in response to Otto von Bismarck."
  if (war.declarationCard === BISMARCK_CARD) return INVALID_MOVE;
  // 15.4.2: an unaided non-player defender has no player to accept the offer,
  // so the card has no defender decision to open (13.4.2's aid search is the
  // only route to a player joining the defending side).
  if (!isPower(war.defender)) return INVALID_MOVE;
  // Rule 13.5: the UK cannot enter a war against a power it holds a truce with.
  if (hasTruce(G, "UK", war.attacker)) return INVALID_MOVE;
  // 8.1.2: a power inside an alliance box cannot join the other side.
  const ukSide = sideOfAllianceBox(G.powers.UK.alliance);
  if (ukSide !== null && ukSide === sideOfAllianceBox(G.powers[war.attacker].alliance)) {
    return INVALID_MOVE;
  }
  const defender = war.defender;
  // The card is spent either way ("If the defender does not agree draw a card").
  G.powers.UK.hand = G.powers.UK.hand.filter((id) => id !== BALANCE_OF_POWER_CARD);
  if (G.powers.UK.selectedHomeCard === BALANCE_OF_POWER_CARD) G.powers.UK.selectedHomeCard = null;
  changeStability(G, "UK", 1, ctx);
  log(G, "UK", "balanceOfPower", {result: "offered", defender});
  openDecision(G, ctx, {
    kind: "balanceOfPower",
    power: defender,
    prompt: "The UK offers to become the primary belligerent on your side",
    promptZh: "英国提出成为你方的主要交战国",
    promptArgs: {card: BALANCE_OF_POWER_CARD, uk: "UK", defender},
    options: [
      {id: "accept", label: "Accept the UK's aid (it becomes the primary defender)", labelZh: "接受英国的援助（英国成为主要防御方）"},
      {id: "decline", label: "Decline (the UK draws a card)", labelZh: "拒绝（英国抽一张牌）"},
    ],
    context: {warStartedTurn: war.startedTurn, defender},
    blocking: true,
  });
  return undefined;
};

/** The defender's answer to Balance of Power; also the `declinePending` path. */
const resolveBalanceOfPower = (
  G: ImperialElegyState,
  ctx: Ctx,
  pending: PendingDecision,
  accept: boolean,
): string | void => {
  const war = G.war;
  if (!war || pending.kind !== "balanceOfPower") return INVALID_MOVE;
  const defender = typeof pending.context?.defender === "string" ? pending.context.defender : null;
  if (!isPower(defender) || war.defender !== defender) return INVALID_MOVE;
  if (war.status !== "warAim" && war.status !== "alliance") return INVALID_MOVE;
  if (belligerentsOf(war).includes("UK")) return INVALID_MOVE;
  if (!accept) {
    G.pending = null;
    drawCards(G, ctx, "UK", 1);
    log(G, "UK", "balanceOfPower", {result: "declined", defender});
    return undefined;
  }
  // 14.1: "the UK becomes the primary belligerent if the defender accepts
  // their aid".  The original defender stays on the defending side as an ally,
  // so every settlement helper keeps its invariants (the UK is the primary
  // treaty target and its capital ends the war).
  war.defenderAllies = [defender, ...war.defenderAllies.filter((power) => power !== defender)];
  war.defender = "UK";
  war.budgets.UK = warBudgetFor(G, "UK", cardById(BALANCE_OF_POWER_CARD).cp);
  war.postWarDraws = [...new Set<Power>([...(war.postWarDraws ?? []), "UK"])];
  G.powers.UK.flags.balanceOfPower = true;
  // 33.2 Rapid Deployment: entering a war grants the free naval movement.
  grantRapidDeployment(G, "limited");
  // "Additionally, if intervening to help the Ottomans, take control of an
  // Ottoman naval base in the Eastern Mediterranean as soon as you enter the
  // war."
  let navalBase: SpaceId | null = null;
  if (defender === "OT") {
    navalBase = ottomanEasternMedBase(G);
    if (navalBase !== null) setSpaceControl(G, navalBase, "UK");
  }
  G.pending = null;
  log(G, "UK", "balanceOfPower", {
    result: "accepted",
    defender,
    navalBase: navalBase ?? "",
  });
  return undefined;
};

/** Rule 14.0: minor allies join their caller's side for free. */
export const callWarMinor = (G: ImperialElegyState, ctx: Ctx, minor: string): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  if (!G.war || power === null) return INVALID_MOVE;
  const joined = joinWarAsMinor(G, G.war, power, minor);
  return joined.applied ? undefined : INVALID_MOVE;
};

// ------------------------------------------------------------------ Great War
export const endGwPlanningMove = (G: ImperialElegyState, ctx: Ctx): string | void => {
  if (G.phase !== "gwPlanning" || !G.gw) return INVALID_MOVE;
  const res = startGwManeuver(G, ctx);
  if (!res.ok) return INVALID_MOVE;
  ctx.events?.setPhase?.("gwManeuver");
  return undefined;
};

export const gwPass = (G: ImperialElegyState, ctx: Ctx): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  if (!hasLiveGwImpulse(G)) {
    // Pre-27.1 pass guard: active seat, no open decision, and the printed
    // Exhaustion/"cannot pass" restriction on the card in hand.
    if (G.phase !== "gwManeuver" || !G.gw || power === null || power !== G.activePower) return INVALID_MOVE;
    if (G.pending !== null || G.battle !== null) return INVALID_MOVE;
    const heldCard = G.powers[power].gwCard;
    if (heldCard && passRestriction(G, power, [heldCard]).forced) return INVALID_MOVE;
  } else if (power === null || gwFinishImpulseProblem(G, power) !== null || !G.gw) {
    return INVALID_MOVE;
  }
  const impulse = currentGwImpulse(G, power);
  const major = gwAllyImpulseFor(G, power);
  markSuperiorStaffWorkGwImpulse(G);
  // The shared guard distinguishes ending a completed action from passing an
  // unused impulse, and enforces the budget / Exhaustion / card-bonus gates.
  // 33.1 Superior Staff Work: a Great War first impulse that ends without the
  // free deploy reserves action forfeits it (once per GW).
  if (
    power === "GE" && major === null && !G.gw.neutralImpulses &&
    G.powers.GE.flags.superiorStaffWorkGwUsed !== true &&
    G.gw.belligerents.includes("GE")
  ) {
    if (superiorStaffWorkGwFreeDeploy(G)) {
      log(G, "GE", "superiorStaffWorkDeclined", {scope: "gw"});
    }
    G.powers.GE.flags.superiorStaffWorkGwUsed = true;
  }
  // 25.7.1: passing an optional bonus slot does not pass the player's normal
  // slot as well. The same player can still act at its next ordinary impulse.
  if (!impulse.acted && !G.gw.neutralImpulses) {
    if (major !== null) (G.gw.majorPassed ??= {})[major] = true;
    else if (G.gw.order[G.turnIndex] !== "bonus") G.powers[power].flags.passedGw = true;
  }
  // GW-10: the event chosen this impulse "takes effect at the end of this
  // impulse", i.e. now, before the next power is activated.
  activateGwExhaustion(G);
  // `advanceGwImpulse` ends the step once every belligerent has passed, after
  // first giving an entered US/Italy their impulse (26.3).
  const next = advanceGwImpulse(G, ctx);
  if (!next.ok) return INVALID_MOVE;
  if (next.kind === "end") {
    G.phase = "gwWinter";
    ctx.events?.setPhase?.("gwWinter");
  }
  return undefined;
};

export const gwDraft = (G: ImperialElegyState, ctx: Ctx, space: SpaceId): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  if (G.phase !== "gwManeuver" || !G.gw || power === null) return INVALID_MOVE;
  markSuperiorStaffWorkGwImpulse(G);
  const res = performGwManeuver(G, ctx, {kind: "draft", power, space});
  return res.ok ? undefined : INVALID_MOVE;
};

export const gwRefit = (G: ImperialElegyState, ctx: Ctx, unitId: string): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  if (G.phase !== "gwManeuver" || !G.gw || power === null) return INVALID_MOVE;
  markSuperiorStaffWorkGwImpulse(G);
  const res = performGwManeuver(G, ctx, {kind: "refit", power, unitId});
  return res.ok ? undefined : INVALID_MOVE;
};

export const gwRefitFleet = (G: ImperialElegyState, ctx: Ctx, unitId: string): string | void => {
  const power = actor(G, ctx.playerID ?? null);
  if (power === null) return INVALID_MOVE;
  const res = performGwManeuver(G, ctx, {kind: "refitFleet", power, unitId});
  return res.ok ? undefined : INVALID_MOVE;
};

export const gwEliteCorps = (G: ImperialElegyState, ctx: Ctx, unitId: string): string | void => {
  const power = actor(G, ctx.playerID ?? null);
  if (power === null) return INVALID_MOVE;
  const res = performGwManeuver(G, ctx, {kind: "eliteCorps", power, unitId});
  return res.ok ? undefined : INVALID_MOVE;
};

export const gwDeploy = (G: ImperialElegyState, ctx: Ctx, space: SpaceId, unitId?: string): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  if (G.phase !== "gwManeuver" || !G.gw || power === null) return INVALID_MOVE;
  // The shared allowance keeps the free staff action outside both the normal
  // budget action and the card bonus; no provisional charge/refund is needed.
  markSuperiorStaffWorkGwImpulse(G);
  const res = performGwManeuver(G, ctx, {kind: "deploy", power, space, unitId});
  if (!res.ok) return INVALID_MOVE;
  return undefined;
};

export const gwMarch = (G: ImperialElegyState, ctx: Ctx, unitId: string, to: SpaceId): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  if (G.phase !== "gwManeuver" || !G.gw || power === null) return INVALID_MOVE;
  markSuperiorStaffWorkGwImpulse(G);
  const res = performGwManeuver(G, ctx, {kind: "march", power, unitId, to});
  return res.ok ? undefined : INVALID_MOVE;
};

export const gwRail = (G: ImperialElegyState, ctx: Ctx, unitId: string, to: SpaceId): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  if (G.phase !== "gwManeuver" || !G.gw || power === null) return INVALID_MOVE;
  markSuperiorStaffWorkGwImpulse(G);
  const res = performGwManeuver(G, ctx, {kind: "rail", power, unitId, to});
  return res.ok ? undefined : INVALID_MOVE;
};

export const gwJointNaval = (
  G: ImperialElegyState,
  ctx: Ctx,
  ally: Power,
  unitIds: string[],
  allyUnitIds: string[],
  to: SpaceId,
): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  if (G.phase !== "gwManeuver" || !G.gw || power === null) return INVALID_MOVE;
  // 3.4.1: `performGwManeuver` raises the controller's permission decision for
  // either contingent before the budget is spent.
  markSuperiorStaffWorkGwImpulse(G);
  const res = performGwManeuver(G, ctx, {kind: "jointNaval", power, ally, unitIds, allyUnitIds, to});
  if (!res.ok && res.pending === true) return undefined;
  return res.ok ? undefined : INVALID_MOVE;
};

export const gwTransferBudget = (G: ImperialElegyState, ctx: Ctx, to: Power, amount: number): string | void => {
  const playerID = ctx.playerID ?? null;
  const from = actor(G, playerID);
  if (G.phase !== "gwPlanning" || !G.gw || from === null) return INVALID_MOVE;
  const res = transferGwBudget(G, ctx, from, to, amount);
  return res.ok ? undefined : INVALID_MOVE;
};

/**
 * 26.1: give one faceup GW combat card to an ally during planning, after the
 * cards have been flipped faceup.
 */
export const gwGiftCombatCard = (
  G: ImperialElegyState,
  ctx: Ctx,
  to: Power,
  cardId: CardId,
): string | void => {
  const playerID = ctx.playerID ?? null;
  const from = actor(G, playerID);
  if (G.phase !== "gwPlanning" || !G.gw || from === null) return INVALID_MOVE;
  if (G.pending !== null) return INVALID_MOVE;
  const res = giftGwCombatCard(G, from, to, cardId);
  return res.ok ? undefined : INVALID_MOVE;
};

export const gwRevealCombat = (G: ImperialElegyState, ctx: Ctx): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  if (!G.gw || power === null) return INVALID_MOVE;
  if (G.phase !== "gwPlanning" && G.phase !== "gwManeuver") return INVALID_MOVE;
  if (G.pending !== null) return INVALID_MOVE;
  const res = revealGwCombatCard(G, power);
  return res.ok ? undefined : INVALID_MOVE;
};

export const gwEndTurn = (G: ImperialElegyState, ctx: Ctx): string | void => {
  const power = actor(G, ctx.playerID ?? null);
  if (!hasLiveGwImpulse(G)) {
    // Legacy states skip the whole maneuver turn the old way: no neutral
    // event impulses were part of the pre-27.4 flow. The 27.1 end-condition
    // guard still applies, so a player cannot skip another's remaining budget.
    if (power === null || !gwCanEndTurn(G, power)) return INVALID_MOVE;
    activateGwExhaustion(G);
    G.phase = "gwWinter";
    ctx.events?.setPhase?.("gwWinter");
    return undefined;
  }
  if (power === null || !gwCanEndTurn(G, power)) return INVALID_MOVE;
  activateGwExhaustion(G);
  const next = beginGwNeutralImpulses(G, ctx);
  if (next.kind === "end") {
    G.phase = "gwWinter";
    ctx.events?.setPhase?.("gwWinter");
  }
  return undefined;
};

/**
 * 29.0: retry the winter resolution when the `gwWinter` phase hook could not
 * finish it (an open decision or a blocked step left `G.phase` in the winter).
 * The hook runs before any player can act, so a stalled winter has no other
 * way out; `resolveGwWinter` itself is guarded by its `gw.winter` sentinel, so
 * running it twice is safe.
 */
export const gwResolveWinter = (G: ImperialElegyState, ctx: Ctx): string | void => {
  if (!G.gw || G.phase !== "gwWinter") return INVALID_MOVE;
  // An open decision is answered with `resolvePending`; the phase hook resumes
  // the winter from there.
  if (G.pending !== null) return INVALID_MOVE;
  const res = resolveGwWinter(G, ctx);
  if (!res.ok) return INVALID_MOVE;
  // resolveGwWinter mutates G.phase out of the winter; widen it so TS does not
  // keep the narrowed "gwWinter" type from the guard above.
  const phaseAfter = G.phase as GamePhase;
  if (!res.ended && phaseAfter === "gwPlanning") ctx.events?.setPhase?.("gwPlanning");
  return undefined;
};

// ------------------------------------------------------------------ GW cards

/** GW cards never enter the action discard pile (it is reshuffled into the
 *  action deck); they are consumed into the separate Great War discard. */
const discardGwCard = (G: ImperialElegyState, cardId: CardId): void => {
  if (!G.gw) return;
  const pile = G.gw.discard ?? (G.gw.discard = []);
  pile.push(cardId);
};

/** Identify the current GW impulse so a one-per-impulse event stays spent. */
const gwImpulseKey = (G: ImperialElegyState): string =>
  G.gw?.impulseSeq === undefined
    ? `${G.gw?.turn ?? 0}:${G.turnIndex}:${G.activePower}`
    : `${G.gw.turn}:impulse${G.gw.impulseSeq}:${G.activePower}`;

/**
 * GW-05 "Capable Commander" may be played as a normal event at the start of a
 * player's GW impulse to flip a facedown GW combat card.  Its battle reroll
 * mode is handled by `combat.ts` and never reaches this move.
 */
const canPlayGw05Event = (G: ImperialElegyState, power: Power): boolean => {
  if (G.phase !== "gwManeuver" || G.gw?.active !== true) return false;
  if (G.activePower !== power) return false;
  if (G.pending !== null || G.battle !== null) return false;
  if (Number(G.powers[power].flags.gwActionsThisImpulse ?? 0) !== 0) return false;
  if (G.flags.gw05PlayedImpulse === gwImpulseKey(G)) return false;
  return facedownGwCombatCards(G).length > 0;
};

export const playGwCardMove = (G: ImperialElegyState, ctx: Ctx, mode: "event" | "cp"): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  if (power === null || !G.gw || (mode !== "event" && mode !== "cp")) return INVALID_MOVE;
  if (gwCardProblem(G, power, mode) !== null) return INVALID_MOVE;
  const p = G.powers[power];
  const cardId = p.gwCard;
  if (!cardId) return INVALID_MOVE;
  const card = cardById(cardId);
  const isGw05Event = cardId === "IE-GW-05" && mode === "event";
  // Check before touching `gwCard`: an illegal GW-05 event leaves the card in
  // hand, so the player can still use it for its battle reroll.
  if (isGw05Event && !canPlayGw05Event(G, power)) return INVALID_MOVE;
  // GW #2 Major Power Entry: "cannot be played on GW turn 0".  The one exception
  // is Italy still outside the war when it breaks out: 25.3 has already had its
  // say, and GW #2 is the way Italian diplomacy works during the opening.  The
  // guard is read *before* the flag below is set, so the card can resolve once.
  const outbreakItaly = cardId === "IE-GW-02" && mode === "event" && (G.gw.turn ?? 0) === 0;
  if (outbreakItaly && !majorEntryOptions(G, power).includes("IT")) return INVALID_MOVE;
  if (isGw05Event) G.flags.gw05PlayedImpulse = gwImpulseKey(G);
  const mandatory = cardId === "IE-GW-10";
  const legacy = !hasLiveGwImpulse(G);
  const bonus = !G.gw.neutralImpulses && (mode === "cp" || mandatory);
  noteGwCard(G, power, bonus);
  p.gwCard = null;
  // The played card is no longer faceup; remove only this power's stale entry
  // so other powers' public combat cards remain visible for the turn.
  clearFaceupCombat(G, power);
  G.resolvingCard = cardId;
  if (mode === "cp" && (legacy || !mandatory)) {
    // 27.2: spend the bonus immediately as a separate action, not banked CP.
    // Pre-27.1 states still bank the printed CP into the GW wallet.
    if (legacy) p.gwBudget = (p.gwBudget ?? 0) + card.cp;
    if (removesAfterPlay(G, cardId)) G.removed.push(cardId);
    else discardGwCard(G, cardId);
    G.resolvingCard = null;
    return;
  }
  if (outbreakItaly) G.flags.gwMajorEntryOutbreak = true;
  const done = resolveCard(G, ctx, power, card);
  // A GW event is consumed as soon as it is played, even when its effect opens
  // a decision.  Do not let `finalizePendingCard` put it in the action discard.
  // GW #2 asks for its own removal when neither major can join.
  const removeNow = removesAfterPlay(G, cardId) || G.flags.gwRemoveAfterEvent === cardId;
  if (G.flags.gwRemoveAfterEvent === cardId) G.flags.gwRemoveAfterEvent = "";
  if (removeNow) removeCard(G, cardId);
  else discardGwCard(G, cardId);
  if (!done) {
    G.flags.pendingCard = cardId;
    G.flags.pendingMandatory = card.type === "mandatory";
    G.flags.pendingGwCard = true;
    return;
  }
  G.resolvingCard = null;
  return;
};

// ------------------------------------------------------------------ response cards

/**
 * Cards that are printed as responses but belong to the battle window, not the
 * start-of-impulse window.  GW-06 is a GW response card played when a player is
 * forced to retreat, so `playResponseCard` must never consume it.
 */
export const RESPONSE_BATTLE_WINDOW_CARDS: ReadonlySet<CardId> = new Set([
  "IE-A043",
  "IE-A058",
  "IE-A059",
  "IE-A060",
  "IE-A061",
  "IE-A062",
  "IE-A066",
  "IE-GW-06",
]);

export type ResponseBlockReason =
  | "no-seat"
  | "pending"
  | "phase"
  | "not-active"
  | "war-status"
  | "no-gw"
  | "battle"
  | "cp-spent"
  | "not-a-card"
  | "not-response"
  | "battle-window-card"
  | "war-only"
  | "gw-only"
  /** A54 Failed Reforms: The Young Turks has already been played. */
  | "young-turks"
  /** A41/A98/A54: the printed window names one power's impulse. */
  | "printed-power"
  /** A41/A98: "This event has no effect during the Great War." */
  | "no-effect-gw"
  /** A67: "Play when the WTT reaches 5." */
  | "crisis-window"
  /** A67: "exception: cannot be played in response to Impulsive Ruler." */
  | "impulsive-ruler"
  /** A44: France must have lost a war or lost stability this turn. */
  | "france-trigger"
  /** A89/A109: Russian stability must have been decreased. */
  | "russia-trigger"
  /** A65: "Play prior to a pacification roll." */
  | "pacification-window";

export interface ResponseEligibility {
  ok: boolean;
  reason?: ResponseBlockReason;
  /**
   * Set when the card is refused by its own printed text *and* the impulse
   * window is shut as well.  The move layer only ever looks at `ok`, so this is
   * for the board: it can say why the card is closed without hiding the window.
   */
  window?: ResponseBlockReason;
}

const eligible = (): ResponseEligibility => ({ok: true});
const blocked = (reason: ResponseBlockReason, window?: ResponseBlockReason): ResponseEligibility =>
  ({ok: false, reason, ...(window !== undefined ? {window} : {})});

/**
 * Is `power` at the start of an impulse in one of the response windows?
 *
 * Action phase: no CP may have been spent in this impulse (the `cpRemaining`
 * check is not enough once the last CP is spent, so the move layer records the
 * first spend explicitly).
 * Wartime alliance: every belligerent (attacker, defender and allies) may use
 * the alliance-step window; there is no active-maneuver impulse yet.
 * Wartime maneuver: only the active belligerent, and only before it has spent
 * any of its war budget this impulse.
 * Great War maneuver: only before the first GW maneuver action of the impulse
 * (`gwActionsThisImpulse` is maintained by `greatWarFlow`).
 */
export const responseWindowFor = (
  G: ImperialElegyState,
  power: Power | null,
): ResponseEligibility => {
  if (power === null) return blocked("no-seat");
  if (G.pending !== null) return blocked("pending");
  if (G.phase === "action") {
    if (G.activePower !== power) return blocked("not-active");
    if (G.cpRemaining > 0 || G.powers[power].flags.actionCpSpentThisImpulse === true) {
      return blocked("cp-spent");
    }
    return eligible();
  }
  if (G.phase === "wartime") {
    if (!G.war) return blocked("war-status");
    if (G.war.status === "alliance") {
      // The alliance step belongs to the whole war, not to the power holding
      // the current maneuver impulse; every participating belligerent may
      // answer with its printed alliance response.
      if (!belligerentsOf(G.war).includes(power)) return blocked("not-active");
      if (G.battle !== null) return blocked("battle");
      return eligible();
    }
    if (G.war.status !== "maneuver") return blocked("war-status");
    if (G.activePower !== power) return blocked("not-active");
    if (G.battle !== null) return blocked("battle");
    if (G.powers[power].flags.warCpSpentThisImpulse === true) return blocked("cp-spent");
    return eligible();
  }
  if (G.phase === "gwManeuver") {
    if (!G.gw || !G.gw.active) return blocked("no-gw");
    if (G.activePower !== power) return blocked("not-active");
    if (G.battle !== null) return blocked("battle");
    if (Number(G.powers[power].flags.gwActionsThisImpulse ?? 0) > 0) return blocked("cp-spent");
    return eligible();
  }
  return blocked("phase");
};

/**
 * Cards printed "Playable at the start of [power]'s impulse".
 *
 * The generic response window already requires the active power, but a shared
 * action deck can put these cards in any player's hand; without the printed
 * power the event would fire for the wrong seat (A41 gives Germany the DRM,
 * A98 gives France -1, A54 flips Ottoman armies).
 */
export const PRINTED_RESPONSE_POWERS: Readonly<Partial<Record<CardId, Power>>> = Object.freeze({
  "IE-A041": "GE",
  "IE-A054": "OT",
  "IE-A098": "FR",
});

/** A41/A98 are printed "This event has no effect during the Great War." */
const NO_EFFECT_GW_RESPONSES: ReadonlySet<CardId> = new Set(["IE-A041", "IE-A098"]);

/** True when the card's printed impulse window belongs to another power. */
export const printedResponsePower = (cardId: CardId): Power | undefined =>
  PRINTED_RESPONSE_POWERS[cardId];

/** War-only cards whose printed window is the maneuver step. */
const WAR_MANEUVER_RESPONSES: ReadonlySet<CardId> = new Set(["IE-A023", "IE-A024", "IE-A063"]);
/** A063 is printed for the Maneuver Step but may also be played at the
 *  alliance-to-maneuver transition; A064 is alliance-step only. */
const WAR_ALLIANCE_RESPONSES: ReadonlySet<CardId> = new Set(["IE-A063", "IE-A064"]);

/** Window plus per-card restrictions; safe to call from the UI. */
export const responseCardEligibility = (
  G: ImperialElegyState,
  power: Power | null,
  cardId: CardId,
): ResponseEligibility => {
  // The card's own printed gates are asked first.  A player looking at a card
  // whose printed text closes it ("printed for France's impulse", "no effect
  // during the Great War") needs that answer, not the generic "responses are
  // played at the start of an impulse": the second one is true of every
  // response card and would hide the reason this one cannot be used at all.
  // The window is still enforced below, so a card that passes its own gates
  // while the window is shut is refused exactly as before.
  const window = responseWindowFor(G, power);
  // 9.1.3: a response must also meet its own printed trigger.  A67's window is
  // the open crisis decision (which is itself a pending), so it answers before
  // the generic impulse window below.
  if (isCardId(cardId) && cardById(cardId).type === "response" && power !== null) {
    const trigger = responseTriggerBlock(G, power, cardId);
    if (trigger !== null) return blocked(trigger, window.ok ? undefined : window.reason);
    if (cardId === "IE-A067") return eligible();
  }
  const ownGate = (): ResponseEligibility | null => {
    if (!isCardId(cardId)) return null;
    const card = cardById(cardId);
    if (card.type !== "response") return null;
    const printedPower = printedResponsePower(cardId);
    const withWindow = (reason: ResponseBlockReason): ResponseEligibility =>
      blocked(reason, window.ok ? undefined : window.reason);
    if (printedPower !== undefined && printedPower !== power) return withWindow("printed-power");
    if (NO_EFFECT_GW_RESPONSES.has(cardId) && G.gw?.active === true) return withWindow("no-effect-gw");
    if (youngTurksBlocksFailedReforms(G, cardId)) return withWindow("young-turks");
    return null;
  };
  const own = ownGate();
  if (own !== null) return own;
  if (!window.ok) return window;
  if (!isCardId(cardId)) return blocked("not-a-card");
  const card = cardById(cardId);
  if (card.type !== "response") return blocked("not-response");
  // Printed "Playable at the start of [power]'s impulse" (A41/A54/A98).
  const printedPower = printedResponsePower(cardId);
  if (printedPower !== undefined && printedPower !== power) return blocked("printed-power");
  // A41/A98: "This event has no effect during the Great War."
  if (NO_EFFECT_GW_RESPONSES.has(cardId) && G.gw?.active === true) return blocked("no-effect-gw");
  // A54's printed "Cannot be played after The Young Turks" turn gate.
  if (youngTurksBlocksFailedReforms(G, cardId)) return blocked("young-turks");
  // Combat cards and GW-06 are played in the battle card window instead.
  if (RESPONSE_BATTLE_WINDOW_CARDS.has(cardId) || isCombatCardId(cardId) || card.kind === "greatWar") {
    return blocked("battle-window-card");
  }
  // `warOnly` is a limited-war window, never the action phase or the GW.
  if (card.warOnly) {
    if (G.phase !== "wartime" || G.war === null) return blocked("war-only");
    if (G.war.status === "alliance") {
      // The alliance step opens only A063/A064; A023/A024 are maneuver-only.
      if (!WAR_ALLIANCE_RESPONSES.has(cardId)) return blocked("war-status");
    } else if (G.war.status === "maneuver") {
      // A064 is printed for the alliance step only.
      if (!WAR_MANEUVER_RESPONSES.has(cardId)) return blocked("war-status");
    } else {
      return blocked("war-status");
    }
  } else if (G.phase === "wartime" && G.war?.status === "alliance") {
    // Generic impulse responses have no impulse during the alliance step.
    return blocked("war-status");
  }
  if (card.gwOnly && G.gw?.active !== true) return blocked("gw-only");
  return eligible();
};

export const playResponseCard = (G: ImperialElegyState, ctx: Ctx, cardId: CardId): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  if (power === null) return INVALID_MOVE;
  if (!G.powers[power].hand.includes(cardId)) return INVALID_MOVE;
  if (!responseCardEligibility(G, power, cardId).ok) return INVALID_MOVE;
  const p = G.powers[power];
  const card = cardById(cardId);
  if (cardId === "IE-A067") {
    // Crisis window (23.0/23.1): the printed response use is the +2 DRM.  Do
    // not open the card's OR chooser — that belongs to its normal-event play —
    // and keep the crisis decision open so its owner can roll.
    p.hand = p.hand.filter((id) => id !== cardId);
    G.flags.crisisDrm = Number(G.flags.crisisDrm ?? 0) + 2;
    discardCard(G, power, cardId);
    log(G, power, "responsePlayed", {card: cardId});
    return undefined;
  }
  p.hand = p.hand.filter((id) => id !== cardId);
  G.resolvingCard = cardId;
  log(G, power, "responsePlayed", {card: cardId});
  const done = resolveCard(G, ctx, power, card);
  if (cardId === "IE-A063" && G.flags.rapidMobilization === true) {
    // A063's war flag is shared on `G.flags`; stamp the playing belligerent so
    // `startWarManeuver` knows whose initiative it must win.
    G.powers[power].flags.rapidMobilization = true;
  }
  if (!done) {
    G.flags.pendingCard = cardId;
    G.flags.pendingMandatory = false;
    G.flags.pendingResponse = true;
    return;
  }
  if (removesAfterPlay(G, cardId)) removeCard(G, cardId);
  else if (card.kind !== "home") G.discard.push(cardId);
  pruneRemovedFromDiscard(G);
  G.resolvingCard = null;
  G.impulseCard = null;
  return;
};

// ------------------------------------------------------------------ card economy
export const saveCard = (G: ImperialElegyState, ctx: Ctx, cardId: CardId): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  if (power === null || (G.phase !== "action" && G.phase !== "end")) return INVALID_MOVE;
  const p = G.powers[power];
  if (!p.hand.includes(cardId)) return INVALID_MOVE;
  const card = cardById(cardId);
  if (card.kind === "home" || card.type === "mandatory" || card.type === "mandatoryResponse") return INVALID_MOVE;
  const current = String(p.flags.savedCards ?? "").split(",").filter(Boolean);
  const limit = power === "UK" ? 2 : 1;
  let next: string[];
  if (current.includes(cardId)) next = current.filter((id) => id !== cardId);
  else next = [...current, cardId].slice(-limit);
  p.flags.savedCards = next.join(",");
  log(G, power, "saveCard", {card: cardId, saved: next.includes(cardId)});
  return undefined;
};

// ------------------------------------------------------------------ influence track
export const placeMpit = (G: ImperialElegyState, ctx: Ctx, target: Power, track: "te" | "ta" | "neutral"): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = requireActive(G, ctx, playerID);
  if (power === INVALID_MOVE) return INVALID_MOVE;
  if (!G.powers[target]) return INVALID_MOVE;
  // 33.3 The Third Republic: FR's 2 free CP are spendable only on alliance
  // track actions, i.e. here, and only during the turn they were granted.
  const freeTurn = Number(G.flags.frAllianceCpTurn ?? -1);
  const freeCp = Number(G.flags.frAllianceCp ?? 0);
  let free = false;
  if (power === "FR" && freeTurn === G.turn && freeCp > 0) {
    G.flags.frAllianceCp = freeCp - 1;
    free = true;
  } else {
    const paid = requireCp(G, ctx, playerID, 1);
    if (paid === INVALID_MOVE) return INVALID_MOVE;
  }
  G.powers[target].mpit[track] += 1;
  log(G, power, "mpitPlaced", {target, track, free});
  return undefined;
};

/**
 * 22.2: spend one of the two free CP the winner of an Italian unification war
 * may use to influence Italy's MPIT column.  The grant never touches the
 * player's ordinary CP budget.
 */
export const placeItalyMpit = (
  G: ImperialElegyState,
  ctx: Ctx,
  track: "te" | "ta" | "neutral",
): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = actor(G, playerID);
  if (power === null) return INVALID_MOVE;
  if (track !== "te" && track !== "ta" && track !== "neutral") return INVALID_MOVE;
  if (G.flags.italyUnificationMpitCpPower !== power) return INVALID_MOVE;
  if (Number(G.flags.italyUnificationMpitCpTurn ?? -1) !== G.turn) return INVALID_MOVE;
  const left = Number(G.flags.italyUnificationMpitCp ?? 0);
  if (left <= 0) return INVALID_MOVE;
  G.flags.italyUnificationMpitCp = left - 1;
  const mpit = addItalyMpit(G, track, 1);
  log(G, power, "italyUnificationMpit", {track, remaining: left - 1, total: mpit[track]});
  return undefined;
};

/**
 * The belligerent that played A063 Rapid Mobilization.  The printed effect is
 * a war-duration flag on the shared `G.flags`, so `playResponseCard` also
 * stamps the playing power.  Older states fall back to the latest A063 log
 * entry (or the active belligerent) when only the shared flag is present.
 */
const rapidMobilizationBelligerent = (G: ImperialElegyState, war: WarState): Power | null => {
  const belligerents = belligerentsOf(war);
  const stamped = belligerents.find((p) => G.powers[p].flags.rapidMobilization === true);
  if (stamped) return stamped;
  if (G.flags.rapidMobilization !== true) return null;
  for (let i = G.log.length - 1; i >= 0; i -= 1) {
    const entry = G.log[i];
    if (
      entry.key === "responsePlayed" &&
      entry.args?.card === "IE-A063" &&
      entry.power !== undefined &&
      belligerents.includes(entry.power)
    ) {
      return entry.power;
    }
  }
  return belligerents.includes(G.activePower) ? G.activePower : null;
};

export const startWarManeuver = (G: ImperialElegyState, ctx: Ctx): string | void => {
  const playerID = ctx.playerID ?? null;
  const power = requireActive(G, ctx, playerID);
  if (power === INVALID_MOVE) return INVALID_MOVE;
  if (!G.war || (G.war.attacker !== power && G.war.defender !== power)) return INVALID_MOVE;
  if (G.war.status !== "warAim" && G.war.status !== "alliance") return INVALID_MOVE;
  const rapid = rapidMobilizationBelligerent(G, G.war);
  G.war.status = "maneuver";
  // 8.2 / 14.2: the alliance-shift step closes the defender's open choice.
  settleDefenderShiftChoice(G, G.war);
  // Rule 14.3: card CP first, GE only wins ties (Bewegungskrieg), then
  // industry.  The helper also handles allies that joined before the start.
  // Remaining ties are broken by a roll-off (dice drawn only for true ties).
  G.war.initiative = initiativeOrder(G, G.war, {tieBreak: initiativeRollOff(() => die(ctx, 6))});
  if (rapid !== null) {
    // A063 Rapid Mobilization: the power that played it automatically moves
    // first during this war's Maneuver Step.
    G.war.initiative = [rapid, ...G.war.initiative.filter((p) => p !== rapid)];
  }
  G.activePower = G.war.initiative[0] ?? G.war.attacker;
  G.war.passed = [];
  clearWarImpulseSpend(G);
  // 33.3 The Third Republic: 2 free alliance-track CP once per turn at the
  // beginning of the alliance resolution step (this war's maneuver start).
  const republic = thirdRepublicCp(G);
  const frBelligerent =
    G.war.attacker === "FR" ||
    G.war.defender === "FR" ||
    G.war.attackerAllies.includes("FR") ||
    G.war.defenderAllies.includes("FR");
  if (republic.applies && frBelligerent) {
    G.flags.frAllianceCp = Number(G.flags.frAllianceCp ?? 0) + republic.cp;
    G.flags.frAllianceCpTurn = G.turn;
    log(G, "FR", "thirdRepublicCp", {cp: republic.cp});
  }
  // 34.4.5: a bot belligerent redeploys for free before the first impulse.  Run
  // first so a 15.1 battle below uses the redeployed positions.
  botFreeRedeployment(G, ctx, warBotPowers(G), `war:${G.turn}:${G.war.attacker}:${G.war.defender}`);
  // 5.5.3 / 5.6.2: the first maneuver impulse's penalties.
  beginImpulseUpkeep(G, ctx, G.activePower);
  // 15.1: opposing fleets sharing a naval box fight immediately.  The upkeep
  // decision above (if any) keeps the queue parked; `resolvePending` drains it
  // once that decision closes.
  beginNavalStartBattles(G, ctx, G.war.initiative);
  log(G, power, "warManeuverStarted", {});
  return undefined;
};
