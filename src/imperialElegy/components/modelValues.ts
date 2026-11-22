/**
 * Types for the board model's value bag.
 *
 * `useBoardModel` returns this object; `boardSlices.ts` picks grouped views of
 * it for the layout.  Keeping the schema in its own module with type-only
 * imports means a module that needs one of these types (for a prop, a test
 * double or a slice) never pulls the hook, React or the rules into its import
 * graph — a `jest.mock` that replaces the hook can then safely `require` this
 * module inside its factory.
 */
import type {ImperialElegyState, PendingOption, Power, SpaceId, Unit} from "../types";
import type {PhaseAction} from "./PhaseActions";
import type {CardChoiceFace} from "./CardChoice";
import type {HandChoicesProps} from "./HandChoices";
import type {OrdersTab} from "./OrdersPanel";
import type {DealOffer, DiplomacyDeals} from "../types";
import type {DoAction} from "./moveFeedback";
import type {ieStringsFor} from "./i18n";

export type T = ReturnType<typeof ieStringsFor>;
export type Decision = {allowed: boolean; reasons: string[]} | null;
export type CostedDecision = {allowed: boolean; cost: number; reasons: string[]} | null;
export type SetState<T> = (value: T | ((previous: T) => T)) => void;
/** The phone bottom sheet's tabs; the dock shows one body at a time. */
export type MobileTab = "orders" | "hand" | "mat" | "log" | "war";

export type TargetIntentLike =
  | "redeploy" | "landBattle" | "navalBattle" | "amphibious" | "navalTransport"
  | "navalIntercept" | "gwMarch" | "gwRail";

export type InteractionLike =
  | {kind: "idle"}
  | {kind: "space"; space: SpaceId}
  | {kind: "unit"; space: SpaceId; unit: string}
  | {kind: "targeting"; intent: TargetIntentLike; from: SpaceId; sources: string[]; targets: SpaceId[]};

/** Everything `useBoardModel` is given (boardgame.io's board props plus hotseat). */
export interface ModelDeps {
  G: ImperialElegyState;
  ctx: unknown;
  moves: Record<string, (...args: any[]) => void>;
  playerID: string | null;
  hotseat?: boolean;
  /** Test seam: overrides for context values a stubbed React cannot provide. */
  injectedUi?: InjectedUi;
}

export interface InjectedUi {
  botSeats?: ReadonlySet<Power>;
  seatUi?: {currentSeat: Power | null; onSwitchSeat?: (power: Power) => void};
  /** The dictionary, for a suite that stubs the i18n module. */
  i18n?: T;
  /**
   * A live view of the UI language.  Suites that stub the i18n module pass a
   * getter, so a test that flips its mocked locale between renders is still
   * followed; otherwise the board asks the module.
   */
  locale?: {readonly current: "en" | "zh_CN" | null};
}

/**
 * The UI language in force for this render: the injected one (a suite that
 * stubs the i18n module) or the module's current locale.
 */
export const resolveLocale = (
  injected: InjectedUi | undefined,
  fromModule: () => string,
): "en" | "zh_CN" => {
  const override = injected?.locale?.current;
  if (override === "en" || override === "zh_CN") return override;
  return fromModule() === "en" ? "en" : "zh_CN";
};

/** The value object `useBoardModel` returns. */
export interface ModelValues {
  modePill: {
    label: string;
    from: string;
    count: number;
    cancelLabel: string;
    onCancel: () => void;
    targets?: {id: SpaceId; label: string}[];
    onChoose?: (id: SpaceId) => void;
  } | null;
  mapLegalTargets: SpaceId[];
  mapBattleTargets: SpaceId[];
  /** The rings the map draws, one per legal target (`map.tsx#MapTarget`). */
  mapTargets: import("./map").MapTarget[];
  /** The legal target the map emphasises (the chooser's destination). */
  mapFocusedTarget: SpaceId | null;
  /** An open intent chooser (two intents at one destination), or null. */
  chooser: {
    target: SpaceId;
    targetLabel: string;
    intents: TargetIntentLike[];
    onChoose: (intent: TargetIntentLike) => void;
    onCancel: () => void;
  } | null;
  isCurrentSeat: boolean;
  otherSeatPending: boolean;
  G: ImperialElegyState;
  ctx: unknown;
  moves: Record<string, (...args: any[]) => void>;
  playerID: string | null;
  hotseat?: boolean;
  t: T;
  /** Same value as `actualLocale`; the layout regions read `locale`. */
  locale: "en" | "zh_CN";
  actualLocale: "en" | "zh_CN";
  decade: {en: string; zh: string};
  viewer: Power | null;
  selected: SpaceId | null;
  selectedUnit: string | null;
  /** Every unit of the current selection, primary first (12.15/16.1 stacks). */
  selectedUnitIds: string[];
  /** Add or remove one unit from the current selection. */
  toggleUnitSelection: (id: string) => void;
  /** Replace the selection with a whole stack (one dispatch). */
  selectUnitGroup: (ids: string[]) => void;
  /** Arm the move rings for the current selection (the Orders "move" row). */
  startMoveTargeting: () => void;
  targeting: InteractionLike | null;
  battleFrom: SpaceId | null;
  navalFrom: SpaceId | null;
  seatUi: {currentSeat: Power | null; onSwitchSeat?: (power: Power) => void};
  me: ImperialElegyState["powers"][Power] | null;
  phase: string;
  active: Power;
  isActive: boolean;
  eliminated: boolean;
  botSeats: ReadonlySet<Power>;
  isBotViewer: boolean;
  /** Rule 34: the shown seat can be handed to the bot, or taken back, right now. */
  canHandOverSeat: boolean;
  /** Hand the shown seat to the bot (`true`) or take it back (`false`). */
  setSeatBot: (bot: boolean) => void;
  pending: ImperialElegyState["pending"];
  canDecide: boolean;
  war: ImperialElegyState["war"];
  gw: ImperialElegyState["gw"];
  battle: ImperialElegyState["battle"];
  warWasActive: unknown;
  warBelligerents: Power[];
  isPrincipal: boolean;
  isBelligerent: boolean;
  cpBudget: () => number;
  canAct: boolean;
  canSpend: (cost: number) => boolean;
  canActionCard: boolean;
  canPhaseAct: boolean;
  forcedPass: boolean;
  forcedCardIds: string[];
  forcedGwCard: boolean;
  forcedPassTitle: string;
  actedThisImpulse: boolean;
  passBlocked: boolean;
  passBlockedTitle: string;
  hasPhaseButtons: boolean;
  phaseActions: PhaseAction[];
  nationalActionPhase: boolean;
  auRightsEligible: string[];
  auReformValue: string;
  auReformDecision: Decision;
  auCitizenEligible: string[];
  auCitizenValue: string;
  auCitizenDecision: Decision;
  auIncorporateCandidates: string[];
  auIncorporateEligible: string[];
  auIncorporateValue: string;
  auIncorporate: Decision;
  zouaveInPlay: boolean;
  zouaveReason: string | undefined;
  tsrrPhase: boolean;
  tsrrArmies: Unit[];
  tsrrUnitValue: string;
  tsrrFrom: SpaceId | null;
  tsrrDestinations: SpaceId[];
  tsrrToValue: string;
  tsrrDecision: Decision;
  showNationalActions: boolean;
  needsCp: (cost: number) => string;
  auReformReason: string | undefined;
  auCitizenReason: string | undefined;
  auIncorporateReason: string | undefined;
  tsrrReason: string | undefined;
  jihadDecision: {allowed: boolean; markers: number} | null;
  jihadReason: string | undefined;
  polishOwner: Power | null;
  polishArmyDecision: CostedDecision;
  polishReserveDecision: CostedDecision;
  lastLog: ImperialElegyState["log"][number] | undefined;
  lastNavalBox: SpaceId | null;
  lastNavalMover: Power | null;
  amphibiousVisible: boolean;
  ownLoadedArmyAt: (space: SpaceId) => boolean;
  amphibiousOrigins: SpaceId[];
  amphibiousFromValue: SpaceId | "";
  amphibiousTargets: SpaceId[];
  amphibiousToValue: SpaceId | "";
  amphibiousBox: SpaceId | null;
  amphibiousArmies: string[];
  chosenAmphibiousArmies: string[];
  amphibiousArmyValue: string[];
  amphibiousCheck: unknown;
  amphibiousPhaseOk: boolean;
  amphibiousReason: string | undefined;
  amphibiousCanGo: boolean;
  /** Starts armed map targeting for the operation (the select stays as fallback). */
  beginAmphibiousTargeting: () => void;
  beginNavalTransportTargeting: () => void;
  beginNavalInterceptTargeting: () => void;
  toggleAmphibiousArmy: (id: string, checked: boolean) => void;
  transportVisible: boolean;
  transportMajor: Power | null;
  transportOwns: (owner: string | undefined) => boolean;
  transportable: (id: string) => boolean;
  transportOrigins: SpaceId[];
  transportFromValue: SpaceId | "";
  transportLands: string[];
  transportLandValue: string;
  transportFleet: string[];
  transportReachableFrom: (target: SpaceId) => boolean;
  transportTargets: SpaceId[];
  transportToValue: SpaceId | "";
  transportCheck: unknown;
  transportPhaseOk: boolean;
  transportReason: string | undefined;
  transportCanGo: boolean;
  adjacentPortsToBox: SpaceId[];
  ownAdjacentPorts: SpaceId[];
  interceptPorts: SpaceId[];
  interceptPortValue: SpaceId | "";
  interceptCheck: unknown;
  interceptReason: string | undefined;
  interceptVisible: boolean;
  botTimerRef: unknown;
  botFailureRef: unknown;
  selectedState: ImperialElegyState["spaces"][SpaceId] | null;
  selectedUnitDef: Unit | undefined;
  commandedOwner: Power | null;
  commandsSelected: (unit: Unit) => boolean;
  ownUnitsInSelected: Unit[];
  ownLandInSelected: Unit[];
  ownNavalInSelected: Unit[];
  enemyLandTargetsFrom: (from: SpaceId | null) => SpaceId[];
  enemyNavalTargetsFrom: (from: SpaceId | null) => SpaceId[];
  potentialLandTargets: SpaceId[];
  potentialNavalTargets: SpaceId[];
  unitMoveTargets: SpaceId[];
  pendingSpaceTargets: SpaceId[];
  battleTargets: SpaceId[];
  myOnMapArmies: number;
  myForts: number;
  myMinorAllies: number;
  hand: string[];
  handCounts: Partial<Record<Power, number>>;
  goalCounts: Partial<Record<Power, number>>;
  doAction: DoAction;
  beginTargeting: {current: (intent: TargetIntentLike, from: SpaceId, targets: SpaceId[], sources?: string[]) => void};
  setBattleFrom: {current: (id: SpaceId | null) => void};
  setNavalFrom: {current: (id: SpaceId | null) => void};
  setSelectedUnit: (id: string | null) => void;
  submitTargeting: (target: SpaceId) => void;
  onSelectImpl: {current: (id: SpaceId) => void};
  onSelect: (id: SpaceId) => void;
  pendingKindLabels: Record<string, string>;
  pendingKind: string | null;
  pendingPrompt: string;
  optionCardId: (o: PendingOption) => string | null;
  optionLabel: (o: PendingOption) => string;
  optionFace: (o: PendingOption) => CardChoiceFace | null;
  optionAction: (o: PendingOption) => string;
  canDecline: boolean;
  warStatusLabels: Record<string, string>;
  warStatusLabel: string;
  warAimLabel: (aim: string | null) => string;
  callableAllies: Power[];
  warAllyValue: Power | undefined;
  callableMinors: string[];
  warMinorValue: string;
  warBudgetRows: Power[];
  warDefenderMinors: string[];
  minorMarkerRows: [string, number][];
  /** The live "ask before irreversible actions" preference. */
  confirmActions: boolean;
  setConfirmActions: (enabled: boolean) => void;
  /** The Great War's 28.1.1 trench battles, for the War tab list. */
  trenchRows: import("./trenchRows").TrenchRow[];
  /** True while a declaration can be made in the War panel (badges its tab). */
  declarationWaiting: boolean;
  gwOrderPowers: Power[];
  gwBudgetOrder: Power[];
  gwSlotLabel: (slot: Power | "bonus" | "IT" | "US" | null) => string;
  italyBox: string;
  italySide: string;
  italyBoxLabel: string;
  italyShowing: boolean;
  italyHow: string;
  canGwDraft: boolean;
  gwDeployRoom: number;
  canGwDeployHere: boolean;
  gwSideAllies: Power[];
  gwTransferToValue: string;
  gwTransferAmountValue: number;
  canGwTransfer: boolean;
  gwJointNavalAllies: Power[];
  gwJointNavalUnitIds: (ally: Power) => string[];
  gwCardId: string;
  gwCombatCardHeld: boolean;
  gwCardAlreadyFaceup: boolean;
  canGwReveal: boolean;
  deployFree: boolean;
  deployLimit: number;
  deployRoom: number;
  canDeployHere: boolean;
  homeCardTitle: (id: string) => string;
  saveList: string[];
  ngChoices: string[];
  /** 11.0: cards this seat has shown; 11.1: the offers it is party to. */
  shownCards: string[];
  cardsShownToMe: {card: string; from: Power}[];
  deals: DiplomacyDeals;
  /** The diplomacy deals page exists right now (seated, diplomacy phase). */
  dealsVisible: boolean;
  /** Offers this seat must confirm. */
  pendingDeals: DealOffer[];
  /** Every offer this seat is party to (proposed or accepted). */
  myDealOffers: DealOffer[];
  dealTarget: Power;
  setDealTarget: (p: Power) => void;
  dealGive: number;
  setDealGive: (n: number) => void;
  dealTake: number;
  setDealTake: (n: number) => void;
  dealPromises: string;
  setDealPromises: (s: string) => void;
  responseInHand: boolean;
  responseWindow: boolean;
  chainInfo: unknown;
  chainUsed: boolean;
  chainNonEmpty: boolean;
  chainReady: boolean;
  chainSpendable: number;
  chainCap: number;
  chainDisabledReason: string | undefined;
  targetingHint: {title: string; body: string; cancel: () => void} | null;
  choicesProps: HandChoicesProps;
  choiceKinds: {required: boolean; optional: boolean};
  dockChoices: boolean;
  dockVisible: boolean;
  dockSummary: string;
  handChoicesHint: string | null;
  mapHint: string;
  board: "world" | "greatWar";
  setBoard: (b: "world" | "greatWar") => void;
  railTab: string;
  setRailTab: (key: string) => void;
  /**
   * The Orders panel's page state (actions / space / influence / naval).  Kept
   * out of `G`: it is a view preference, so it survives neither a save nor a
   * seat switch, and the panel falls back to the actions page when a page stops
   * existing.
   */
  ordersTab: OrdersTab;
  setOrdersTab: SetState<OrdersTab>;
  /** A naval flow (amphibious, transport, interception) is offered right now. */
  navalVisible: boolean;
  warAlly: Power;
  setWarAlly: (p: Power) => void;
  warMinor: string;
  setWarMinor: (m: string) => void;
  confirmSurrender: boolean;
  setConfirmSurrender: (b: boolean) => void;
  auReformTarget: string;
  setAuReformTarget: (s: string) => void;
  auCitizenTarget: string;
  setAuCitizenTarget: (s: string) => void;
  auIncorporateTarget: string;
  setAuIncorporateTarget: (s: string) => void;
  auSacrifice: boolean;
  setAuSacrifice: (b: boolean) => void;
  tsrrUnitId: string;
  setTsrrUnitId: (s: string) => void;
  tsrrTo: string;
  setTsrrTo: (s: string) => void;
  polishReserve: boolean;
  setPolishReserve: (b: boolean) => void;
  gwTransferTo: string;
  setGwTransferTo: (s: string) => void;
  gwTransferAmount: number;
  setGwTransferAmount: (n: number) => void;
  dockCollapsed: boolean;
  setDockCollapsed: SetState<boolean>;
  /** True below 768 px; the shell renders the phone bottom sheet. */
  isPhone: boolean;
  /** The phone dock's open tab. */
  mobileTab: MobileTab;
  setMobileTab: SetState<MobileTab>;
  open: boolean;
  onToggleOpen: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  trayOpen: boolean;
  setTrayOpen: SetState<boolean>;
  trayExpanded: boolean;
  setTrayExpanded: SetState<boolean>;
  /** Render every hand row unfolded (tests/embeds); the board never sets it. */
  expandAll: boolean;
  cardFaceMode: "svg" | "print";
  setCardFaceMode: (m: "svg" | "print") => void;
  amphibiousFrom: string;
  setAmphibiousFrom: (s: string) => void;
  amphibiousTo: string;
  setAmphibiousTo: (s: string) => void;
  amphibiousUnitIds: string[];
  setAmphibiousUnitIds: (ids: string[]) => void;
  transportFrom: string;
  setTransportFrom: (s: string) => void;
  transportTo: string;
  setTransportTo: (s: string) => void;
  transportLand: string;
  setTransportLand: (s: string) => void;
  interceptPort: string;
  setInterceptPort: (s: string) => void;
  interaction: InteractionLike;
  dispatch: (action: unknown) => void;
  /** Opens the reference drawer at a printed chart/rule anchor. */
  onOpenReference: (anchor: string) => void;
  /** Reference drawer state (the drawer is a portal-like overlay of the board). */
  refAnchor: string | null;
  setRefAnchor: SetState<string | null>;
  /** The pending rejection toast (phase 1); null while there is nothing to say. */
  toast: {title: string; body?: string; tone: "info" | "warn" | "error"} | null;
  dismissToast: () => void;
}
