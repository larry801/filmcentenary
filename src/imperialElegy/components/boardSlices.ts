/**
 * Layout slices of the board model.
 *
 * The board's value bag is large (every rules helper any panel may want).  The
 * layout only needs grouped views of it: four suites replace `React.useContext`
 * with a stub returning `undefined`, so a deep React context per slice is not an
 * option and plain props are.  Each layout region takes exactly one slice:
 *
 *   core        shell: track strip, map column, what is waiting, reference opening
 *   interaction map selection and targeting
 *   orders      the turn panel's Action tab
 *   hand        the hand tray
 *   war         the turn panel's War tab
 *   reference   the reference drawer
 *
 * `ModelValues` is hand-maintained so slices can pick members by name; the hook
 * spreads the slices over the same object, so a member that is missing (or
 * renamed in the hook) is a compile error rather than an `undefined` at run
 * time.
 */
import type {ModelValues} from "./modelValues";
import type {ieStringsFor} from "./i18n";

export type {
  ModelValues, ModelDeps, TargetIntentLike, InteractionLike, SetState, Decision, CostedDecision,
} from "./modelValues";

export type T = ReturnType<typeof ieStringsFor>;

const pick = <K extends keyof ModelValues>(values: ModelValues, keys: readonly K[]): Pick<ModelValues, K> => {
  const out = {} as Pick<ModelValues, K>;
  for (const key of keys) out[key] = values[key];
  return out;
};

/** Shell and map column: whose seat this is, what the map shows, what is waiting. */
const CORE_KEYS = [
  "G", "ctx", "moves", "playerID", "hotseat", "t", "locale", "actualLocale", "decade", "viewer", "me",
  "phase", "active", "isActive", "eliminated", "botSeats", "isBotViewer", "pending", "war", "gw",
  "battle", "hasPhaseButtons", "phaseActions", "canDecide", "canAct", "canActionCard", "cpBudget",
  "mapLegalTargets",
  "canSpend", "dockVisible", "dockSummary", "dockCollapsed", "setDockCollapsed", "isCurrentSeat",
  "isPhone", "mobileTab", "setMobileTab", "trayOpen", "setTrayOpen", "trayExpanded", "setTrayExpanded",
  "otherSeatPending", "seatUi", "pendingPrompt", "pendingKind", "responseWindow", "handChoicesHint",
  "cardFaceMode", "setCardFaceMode", "confirmActions", "setConfirmActions", "board", "setBoard", "railTab", "setRailTab", "choiceKinds",
  "choicesProps", "targetingHint", "handCounts", "goalCounts", "minorMarkerRows", "homeCardTitle",
  "doAction", "mapHint", "pendingSpaceTargets", "optionLabel", "optionFace", "optionAction", "canDecline",
  "jihadDecision", "jihadReason", "onOpenReference", "refAnchor", "setRefAnchor",
  "toast", "dismissToast",
] as const;

/** Map interaction: selection, targeting and the legal-target layers. */
const INTERACTION_KEYS = [
  "selected", "selectedUnit", "onSelect", "targeting", "modePill", "mapTargets", "mapFocusedTarget", "chooser",
  "unitMoveTargets", "interaction", "dispatch", "selectedState",
  "selectedUnitDef", "commandsSelected", "battleFrom", "navalFrom",
] as const;

/** The turn panel's Action tab. */
const ORDERS_KEYS = [
  "G", "t", "locale", "actualLocale", "viewer", "me", "phase", "canAct", "canSpend", "cpBudget",
  "selectedUnitIds", "toggleUnitSelection", "selectUnitGroup", "startMoveTargeting",
  "canActionCard", "pending", "canDecide", "war", "warAim", "setWarAim", "warCp", "setWarCp",
  "secondObjective", "setSecondObjective", "targetControlledSpaces", "warTargetControl", "onOpenReference",
  "warMinorTarget", "warEntitlement", "warTargetAllowed",
  "warTargetCandidates", "warTargetsOpen", "setWarTargetsOpen", "chooseWarTarget",
  "canDeclareWar", "secondTargetOptions", "secondTargetValue", "setSecondTarget",
  "warPrimaryValue", "setWarPrimary", "forbidPlayers", "setForbidPlayers", "forbidPlayersAllowed",
  "gwJointNavalAllies", "gwJointNavalUnitIds", "polishReserve", "setPolishReserve",
  "deployLimit", "deployFree", "canDeployHere", "canGwDraft", "canGwDeployHere", "polishArmyDecision",
  "polishReserveDecision", "myOnMapArmies", "myForts", "myMinorAllies", "ownLandInSelected",
  "ownNavalInSelected", "potentialLandTargets", "potentialNavalTargets", "selectedUnitDef",
  "doAction", "confirmActions", "moves", "selected", "selectedUnit", "setSelectedUnit", "battleFrom", "setBattleFrom",
  "navalFrom", "setNavalFrom", "showNationalActions", "zouaveInPlay", "zouaveReason",
  "auReformValue", "setAuReformTarget", "auReformDecision", "auReformReason", "auCitizenValue",
  "setAuCitizenTarget", "auCitizenDecision", "auCitizenReason", "auSacrifice", "setAuSacrifice",
  "auIncorporateCandidates", "auIncorporateValue", "setAuIncorporateTarget", "auIncorporate",
  "auIncorporateReason", "tsrrArmies", "tsrrUnitValue", "setTsrrUnitId", "tsrrDestinations",
  "tsrrToValue", "setTsrrTo", "tsrrDecision", "tsrrReason", "amphibiousVisible", "amphibiousOrigins",
  "amphibiousFromValue", "setAmphibiousFrom", "amphibiousTargets", "amphibiousToValue",
  "setAmphibiousTo", "amphibiousArmies", "amphibiousArmyValue", "toggleAmphibiousArmy",
  "amphibiousCanGo", "amphibiousReason", "amphibiousCheck",
  "beginAmphibiousTargeting", "beginNavalTransportTargeting", "beginNavalInterceptTargeting",
  "transportVisible", "transportOrigins",
  "transportFromValue", "setTransportFrom", "transportLands", "transportLandValue", "setTransportLand",
  "transportTargets", "transportToValue", "setTransportTo", "transportFleet", "transportCanGo",
  "transportReason", "interceptVisible", "lastNavalBox", "lastNavalMover", "interceptPorts",
  "interceptPortValue", "setInterceptPort", "interceptCheck", "interceptReason",
  "jihadDecision", "jihadReason",
  "commandedOwner", "commandsSelected", "hand",
  // The Orders panel's own page state and the derived "is there a naval flow"
  // flag the fourth page hinges on.
  "ordersTab", "setOrdersTab", "navalVisible",
] as const;

/** The hand tray and the card inspector. */
const HAND_KEYS = [
  "G", "t", "locale", "actualLocale", "viewer", "me", "phase", "isActive", "eliminated", "pending",
  "canActionCard", "confirmActions", "isBelligerent", "war", "forcedCardIds", "hand", "saveList", "giveCards",
  "open", "onToggleOpen", "expanded", "onToggleExpanded",
  "giveTarget", "setGiveTarget", "responseInHand",
  "responseWindow", "chainNonEmpty", "chainSpendable", "chainCap", "chainReady",
  "chainDisabledReason", "cpBudget", "doAction", "moves", "handChoicesHint", "cardFaceMode",
  "trayOpen", "setTrayOpen", "trayExpanded", "setTrayExpanded",
  "handCounts", "goalCounts",
  // Render every hand row unfolded (tests/embeds); the board never sets it.
  "expandAll",
] as const;

/** The turn panel's War tab. */
const WAR_KEYS = [
  "G", "t", "locale", "actualLocale", "viewer", "me", "active", "phase", "war", "gw", "battle",
  "pending", "warBelligerents", "isPrincipal", "isBelligerent", "eliminated", "isActive",
  "warStatusLabel", "warAimLabel", "warBudgetRows", "warDefenderMinors", "callableAllies",
  "warAllyValue", "setWarAlly", "callableMinors", "warMinorValue", "setWarMinor",
  "confirmSurrender", "setConfirmSurrender", "doAction", "moves", "selected", "gwBudgetOrder",
  "gwSlotLabel", "italyShowing", "italyBox", "italyBoxLabel", "italyHow", "gwTransferToValue",
  "setGwTransferTo", "gwTransferAmountValue", "gwTransferAmount", "setGwTransferAmount",
  "canGwTransfer", "gwSideAllies", "canGwReveal", "canGwDraft", "canGwDeployHere", "forcedGwCard",
  "minorMarkerRows", "onSelect", "trenchRows", "onOpenReference",
] as const;

/** The reference drawer: the printed charts, the other powers and the log. */
const REFERENCE_KEYS = [
  "G", "t", "locale", "actualLocale", "viewer", "me", "active", "war", "gw", "pending",
  "handCounts", "goalCounts", "minorMarkerRows", "homeCardTitle", "cpBudget", "canAct", "canSpend",
  "doAction", "moves", "trayOpen",
] as const;

export type CoreSlice = Pick<ModelValues, typeof CORE_KEYS[number]>;
export type InteractionSlice = Pick<ModelValues, typeof INTERACTION_KEYS[number]>;
export type OrdersSlice = Pick<ModelValues, typeof ORDERS_KEYS[number]>;
export type HandSlice = Pick<ModelValues, typeof HAND_KEYS[number]>;
export type WarSlice = Pick<ModelValues, typeof WAR_KEYS[number]>;
export type ReferenceSlice = Pick<ModelValues, typeof REFERENCE_KEYS[number]>;

export interface BoardSlices {
  core: CoreSlice;
  interaction: InteractionSlice;
  orders: OrdersSlice;
  hand: HandSlice;
  war: WarSlice;
  reference: ReferenceSlice;
}

const EMPTY_SLICES: BoardSlices | null = null;

/**
 * Build the six slices.  `values` is cast to `ModelValues` because the hook
 * assembles its bag at run time; `sliceModel` never reads a member it does not
 * forward, so a missing key surfaces as `undefined` in one region, not as a
 * crash in another.
 */
export const sliceModel = (values: ModelValues): BoardSlices => ({
  core: pick(values, CORE_KEYS),
  interaction: pick(values, INTERACTION_KEYS),
  orders: pick(values, ORDERS_KEYS),
  hand: pick(values, HAND_KEYS),
  war: pick(values, WAR_KEYS),
  reference: pick(values, REFERENCE_KEYS),
});
