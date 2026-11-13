import {Ctx, Game, PlayerID} from "boardgame.io";
import {GamePhase, ImperialElegyState, POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {cardsToDraw as cardsToDrawCount} from "./engine/rules";
import {prepareDeck, drawCards, discardHandAtEndOfTurn} from "./engine/deck";
import {beginTurnDecade} from "./engine/economy";
import {
  amphibiousAssault,
  auAction,
  buildEf,
  buildFort,
  callWarAlly,
  callWarMinor,
  chooseAllianceShift,
  chooseGoal,
  chooseHomeCard,
  chooseLossMove,
  chooseSupportMove,
  chooseWarAim,
  constructFleet,
  cpChain,
  declinePending,
  declineRapidDeployment,
  declareWar,
  deployReserves,
  discardForStability,
  endDiplomacy,
  endGwPlanningMove,
  endImpulse,
  endPhaseTurn,
  endTurn,
  finishPrep,
  giveCard,
  gwDeploy,
  gwDraft,
  gwEndTurn,
  gwJointNaval,
  gwMarch,
  gwPass,
  gwRail,
  gwRefit,
  gwRevealCombat,
  gwResolveWinter,
  gwTransferBudget,
  playGwCardMove,
  industrialize,
  landBattle,
  minorAlliance,
  navalIntercept,
  navalMove,
  navalTransport,
  navalBattle,
  pacify,
  pass,
  passWar,
  passWarMove,
  placeDiplomacy,
  placeInfluence,
  placeMpit,
  playBalanceOfPower,
  playCard,
  playResponseCard,
  polishRecruit,
  rapidDeploy,
  rebuildZouave,
  recruit,
  redeploy,
  removeInfluence,
  removeMinorAlliance,
  resolvePending,
  resolveWar,
  startWarManeuver,
  saveCard,
  surrender,
  tsrrRailMove,
  useCpChain,
  useJihad,
} from "./moves";
import {
  beginGwTurn,
  resolveGwWinter,
  startGwManeuver,
} from "./engine/greatWarFlow";
import {redactForView} from "./engine/privacy";
import {ensureStateDefaults} from "./engine/migrations";
import {beginEndPhase} from "./moves";
import {enumerateBot} from "./engine/bot";

const ALL_MOVES = {
  playCard,
  playResponseCard,
  pass,
  endImpulse,
  finishPrep,
  chooseHomeCard,
  endDiplomacy,
  giveCard,
  discardForStability,
  recruit,
  polishRecruit,
  rebuildZouave,
  auAction,
  tsrrRailMove,
  useJihad,
  amphibiousAssault,
  navalIntercept,
  navalMove,
  navalTransport,
  navalBattle,
  buildEf,
  constructFleet,
  placeInfluence,
  placeMpit,
  placeDiplomacy,
  removeInfluence,
  minorAlliance,
  removeMinorAlliance,
  pacify,
  buildFort,
  industrialize,
  cpChain,
  useCpChain,
  redeploy,
  deployReserves,
  landBattle,
  declareWar,
  chooseWarAim,
  chooseAllianceShift,
  playBalanceOfPower,
  surrender,
  passWar,
  passWarMove,
  rapidDeploy,
  declineRapidDeployment,
  resolveWar,
  startWarManeuver,
  saveCard,
  callWarAlly,
  callWarMinor,
  chooseSupportMove,
  chooseLossMove,
  resolvePending,
  declinePending,
  chooseGoal,
  endPhaseTurn,
  endGwPlanningMove,
  gwPass,
  playGwCardMove,
  gwDraft,
  gwRefit,
  gwDeploy,
  gwMarch,
  gwRail,
  gwJointNaval,
  gwTransferBudget,
  gwRevealCombat,
  gwResolveWinter,
  gwEndTurn,
  endTurn,
};
const SENSITIVE_MOVES = new Set(["playCard", "playGwCardMove", "playResponseCard", "chooseHomeCard", "giveCard", "chooseGoal", "chooseWarAim", "resolvePending", "declinePending", "industrialize", "cpChain", "useCpChain", "saveCard"]);
const MOVES = Object.fromEntries(Object.entries(ALL_MOVES).map(([name, move]) => [
  name,
  SENSITIVE_MOVES.has(name) ? {move, redact: true as const} : move,
])) as typeof ALL_MOVES;

const seatOfPower = (G: ImperialElegyState): string => String(POWERS.indexOf(G.activePower));

const prepBegin = (G: ImperialElegyState, ctx: Ctx): void => {
  // A save resumed mid-match never runs `setup`, so the earliest live hook is
  // also the first point where an old save (or a partial fixture) is migrated.
  ensureStateDefaults(G);
  G.phase = "prep";
  G.activePower = "GE";
  G.passed = [];
  G.cpRemaining = 0;
  G.impulseCard = null;
  G.resolvingCard = null;
  for (const p of POWERS) {
    G.powers[p].flags.prepDone = false;
    G.powers[p].flags.prepStability = false;
    G.powers[p].flags.homeChosen = false;
    G.powers[p].flags.endDone = false;
    G.powers[p].flags.alreadyInfluenced = false;
    G.powers[p].flags.alreadyRemovedInfluence = false;
    G.powers[p].flags.savedCards = "";
  }
  // 10.1/10.2: economy owns both the turn -> decade mapping and the "not
  // already in play anywhere" filter.  Passing the explicit list keeps
  // prepareDeck from re-adding a card that is sitting in a hand, home slot,
  // CP chain, or industry slot.
  const {decade, entering} = beginTurnDecade(G, G.turn);
  G.decade = decade;
  if (G.turn > 1) {
    prepareDeck(G, ctx, decade, entering);
    for (const p of POWERS) {
      const count = cardsToDrawCount(G, p);
      drawCards(G, ctx, p, count);
    }
  }
};

const diplomacyBegin = (G: ImperialElegyState, ctx: Ctx): void => {
  G.phase = "diplomacy";
  G.activePower = "GE";
  for (const p of POWERS) G.powers[p].flags.homeChosen = false;
};

const actionBegin = (G: ImperialElegyState, ctx: Ctx): void => {
  G.phase = "action";
  // demobilizeWar hands the action phase to the war's winner; keep that power
  // instead of always restarting with GE.
  const postWarWinner = G.flags.postWarWinner;
  delete G.flags.postWarWinner;
  G.activePower =
    typeof postWarWinner === "string" && (POWERS as readonly string[]).includes(postWarWinner)
      ? (postWarWinner as (typeof POWERS)[number])
      : "GE";
  G.passed = [];
  G.cpRemaining = 0;
  G.impulseCard = null;
  // 12.14: the chain may fund one action per action phase.  The cards
  // themselves are discarded by moves.ts when this phase ends.
  delete G.flags.cpChainActive;
  delete G.flags.cpChainSpent;
  delete G.flags.cpChainPower;
  for (const p of POWERS) G.powers[p].flags.passed = false;
};

const endBegin = (G: ImperialElegyState, ctx: Ctx): void => {
  G.phase = "end";
  for (const p of POWERS) {
    discardHandAtEndOfTurn(G, p);
  }
  // 20.0: the live end phase suspends on the per-player 20.1/20.5/20.9
  // decisions; the pending handlers resume it through `continueEndPhase`.
  beginEndPhase(G, ctx);
};

const wartimeBegin = (G: ImperialElegyState, ctx: Ctx): void => {
  G.phase = "wartime";
  // createWarState starts a freshly declared war in "warAim".  Later statuses
  // (alliance, maneuver, victory) must survive a re-entry into this phase.
  if (G.war && G.war.status === "warAim") {
    G.activePower = G.war.attacker;
    G.war.status = "warAim";
  }
};

const gwPlanningBegin = (G: ImperialElegyState, ctx: Ctx): void => {
  // beginGwTurn is safe to re-run: held cards are kept, missing cards dealt and
  // budgets/flags are recalculated.  Re-entering the phase is therefore
  // idempotent.
  const res = beginGwTurn(G, ctx);
  if (!res.ok) G.phase = "gwPlanning";
};

const gwManeuverBegin = (G: ImperialElegyState, ctx: Ctx): void => {
  // `startGwManeuver` owns the planning -> maneuver transition.  When the move
  // that triggered the phase change has already run it, G.phase is already
  // "gwManeuver" and this is a no-op apart from the shared reset below.
  if (G.phase === "gwPlanning") {
    startGwManeuver(G, ctx);
  }
  G.phase = "gwManeuver";
  G.cpRemaining = 0;
};

const gwWinterBegin = (G: ImperialElegyState, ctx: Ctx): void => {
  // Guard on the game phase so a repeated begin hook cannot resolve winter
  // twice (resolveGwWinter advances the GW turn).  A failed resolution leaves
  // G.phase as "gwWinter" so the step can be retried once unblocked.
  const phaseBefore: GamePhase = G.phase;
  if (phaseBefore !== "gwWinter" || !G.gw) return;
  const res = resolveGwWinter(G, ctx);
  // resolveGwWinter mutates G.phase; widen it so TS does not keep the narrowed
  // "gwWinter" type from the guard above.
  const phaseAfter: GamePhase = G.phase;
  if (res.ok && !res.ended && phaseAfter === "gwPlanning") {
    // resolveGwWinter has already called beginGwTurn; move the boardgame.io
    // phase as well so the next turn's stage setup is fresh.
    ctx.events?.setPhase?.("gwPlanning");
  }
};

export const ImperialElegyGameDef: Game<ImperialElegyState> = {
  name: "imperialElegy",
  ai: {enumerate: enumerateBot},
  setup: (ctx: Ctx, setupData?: unknown) => setupImperialElegy(ctx, setupData),
  minPlayers: 6,
  maxPlayers: 6,
  disableUndo: true,
  playerView: (G: ImperialElegyState, ctx: Ctx, playerID: PlayerID | null) =>
    redactForView(G, playerID, ctx),
  phases: {
    prep: {
      start: true,
      onBegin: prepBegin,
      turn: {stages: {play: {moves: MOVES}}},
      next: "diplomacy",
    },
    diplomacy: {
      onBegin: diplomacyBegin,
      turn: {stages: {play: {moves: MOVES}}},
      next: "action",
    },
    action: {
      onBegin: actionBegin,
      turn: {onBegin: (G: ImperialElegyState, ctx: Ctx) => { ctx.events?.setActivePlayers?.({all: "play"}); }, stages: {play: {moves: MOVES}}},
      next: "end",
    },
    wartime: {
      onBegin: wartimeBegin,
      turn: {onBegin: (G: ImperialElegyState, ctx: Ctx) => { ctx.events?.setActivePlayers?.({all: "play"}); }, stages: {play: {moves: MOVES}}},
      next: "action",
    },
    end: {
      onBegin: endBegin,
      turn: {onBegin: (G: ImperialElegyState, ctx: Ctx) => { ctx.events?.setActivePlayers?.({all: "play"}); }, stages: {play: {moves: MOVES}}},
      next: "prep",
    },
    gwPlanning: {
      onBegin: gwPlanningBegin,
      turn: {onBegin: (G: ImperialElegyState, ctx: Ctx) => { ctx.events?.setActivePlayers?.({all: "play"}); }, stages: {play: {moves: MOVES}}},
      next: "gwManeuver",
    },
    gwManeuver: {
      onBegin: gwManeuverBegin,
      turn: {onBegin: (G: ImperialElegyState, ctx: Ctx) => { ctx.events?.setActivePlayers?.({all: "play"}); }, stages: {play: {moves: MOVES}}},
      next: "gwWinter",
    },
    gwWinter: {
      onBegin: gwWinterBegin,
      turn: {onBegin: (G: ImperialElegyState, ctx: Ctx) => { ctx.events?.setActivePlayers?.({all: "play"}); }, stages: {play: {moves: MOVES}}},
      next: "gwPlanning",
    },
  },
  moves: MOVES,
  endIf: (G: ImperialElegyState) => {
    if (G.result) {
      return {winner: String(POWERS.indexOf(G.result.winners[0] ?? "GE")), winners: G.result.winners, reason: G.result.reason};
    }
    return undefined;
  },
};

export default ImperialElegyGameDef;
