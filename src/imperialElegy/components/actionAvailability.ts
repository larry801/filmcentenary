/**
 * What the player may do in a space, and what it costs.
 *
 * `spaceActions` is a pure description of the Actions tab: one row per action
 * the printed display offers, with its cost, whether it is legal right now,
 * the UI's best one-line reason when it is not, and the click that runs it.
 * The panel renders this list; nothing in the panel decides legality on its
 * own, and the drift test pins every cost here to the engine's own CP spend.
 *
 * The engine is the only authority on a move: a row that says `enabled` can
 * still be refused (a rule the UI did not model), which is what the rejection
 * toast exists for.  The reverse is not allowed: a disabled row must be one
 * the engine would refuse.
 */
import type {GwActionKind, ImperialElegyState, Power, SpaceId} from "../types";
import {SPACES, portBoxes} from "../constant/spaces";
import {
  effectiveKeyType, efDestinationAllowed, friendlyPort, gwAllyImpulseFor, isArmyKind, isHomeSpace, isPower,
  landUnitsIn, ownsKey,
} from "../engine/rules";
import {
  diplomacyPlacementProblem,
  influencePlacementProblem,
  minorAllianceProblem,
  removeAllianceCost,
  removeMarkerProblem,
  removeMinorAllianceProblem,
  type DiplomacyProblem,
  type InfluenceProblem,
  type MinorAllianceProblem,
  type RemoveAllianceProblem,
  type RemoveMarkerProblem,
} from "../engine/foreignAffairs";
import {gwActionAllowance} from "../engine/gwImpulse";
import {reserveRemaining} from "../engine/economy";
import {
  buildableMinorAllies,
  canRecruitIn,
  isCwArmySpace,
  minorBuildDecision,
  pacificationCost,
} from "../engine/characteristics";
import {hasCounterFor} from "../engine/counters";
import {phaseActionProblem, type ActionFamily} from "../engine/phaseActions";
import {
  pacificationProblem,
  type PacificationProblem,
} from "../engine/pacification";
import {polishReserveDeployer} from "../engine/poland";
import {legalUnitTargets} from "./legalTargets";
import {unitIsCommanded} from "./boardHelpers";
import type {RecruitDecision} from "../engine/characteristics";

export type ActionId =
  | "recruitArmy" | "recruitCw" | "recruitReserve" | "recruitEc" | "polishArmy" | "polishReserve"
  | "minorArmy" | "minorSquadron" | "minorDreadnought"
  | "buildSquadron" | "buildDreadnought" | "refitFleet" | "buildFort" | "buildFort2" | "upgradeFort"
  | "buildEf" | "moveEf"
  | "influence" | "diplomacy" | "minorAlliance" | "removeInfluence" | "breakAlliance" | "pacify"
  | "pacifyA065Marker" | "pacifyA065Rebel"
  | "move" | "gwNaval" | "gwMarch" | "gwRail" | "refit" | "rapidDeploy"
  | "deployReserves" | "landBattle" | "navalBattle" | "gwDraft" | "gwDeploy" | "gwElite";

/**
 * The player aid's cost list, in the order it prints them.  `rebuildZouave`
 * and `placeMpit` live in their own panels but use the same table.
 */
export const ACTION_COSTS: Record<ActionId | "rebuildZouave" | "placeMpit", number> = {
  recruitArmy: 1,
  recruitCw: 1,
  recruitReserve: 1,
  recruitEc: 2,
  polishArmy: 2,
  polishReserve: 2,
  minorArmy: 1,
  minorSquadron: 2,
  minorDreadnought: 3,
  buildSquadron: 2,
  buildDreadnought: 3,
  refitFleet: 1,
  buildFort: 1,
  buildFort2: 2,
  upgradeFort: 1,
  buildEf: 2,
  moveEf: 1,
  influence: 1,
  diplomacy: 1,
  minorAlliance: 3,
  removeInfluence: 1,
  breakAlliance: 4,
  pacify: 1,
  pacifyA065Marker: 1,
  pacifyA065Rebel: 1,
  move: 1,
  gwNaval: 1,
  gwMarch: 1,
  gwRail: 1,
  refit: 1,
  rapidDeploy: 0,
  deployReserves: 1,
  landBattle: 1,
  navalBattle: 1,
  gwDraft: 1,
  gwDeploy: 1,
  gwElite: 1,
  rebuildZouave: 1,
  placeMpit: 1,
};

/** Every fixed-cost action, in the player aid's order. */
export const ACTION_COST_ORDER: readonly ActionId[] = [
  "recruitArmy", "recruitReserve", "recruitEc", "recruitCw", "polishArmy", "polishReserve",
  "minorArmy", "minorSquadron", "minorDreadnought",
  "buildSquadron", "buildDreadnought", "refitFleet", "buildFort", "buildFort2", "upgradeFort", "buildEf", "moveEf",
  "influence", "diplomacy", "pacify", "removeInfluence", "minorAlliance", "breakAlliance",
  "move", "deployReserves", "landBattle", "navalBattle", "gwDraft", "gwDeploy", "gwElite",
  "refit", "gwMarch", "gwRail", "gwNaval", "rapidDeploy",
];

const LABELS: Record<ActionId | "rebuildZouave" | "placeMpit", {en: string; zh: string}> = {
  recruitArmy: {en: "Recruit army", zh: "征募军团"},
  recruitCw: {en: "Commonwealth army", zh: "自治领军"},
  recruitReserve: {en: "Recruit reserve army", zh: "征募预备军"},
  recruitEc: {en: "Recruit elite corps", zh: "征募精锐军团"},
  polishArmy: {en: "Polish army", zh: "波兰军团"},
  polishReserve: {en: "Polish reserve army", zh: "波兰预备军"},
  minorArmy: {en: "Allied minor army", zh: "盟国小国军团"},
  minorSquadron: {en: "Allied minor squadron", zh: "盟国小国分舰队"},
  minorDreadnought: {en: "Allied minor dreadnought", zh: "盟国小国无畏舰"},
  buildSquadron: {en: "Build squadron", zh: "建造分舰队"},
  buildDreadnought: {en: "Build dreadnought", zh: "建造无畏舰"},
  refitFleet: {en: "Refit fleet", zh: "整补舰队"},
  buildFort: {en: "Build fort", zh: "建造要塞"},
  buildFort2: {en: "Build level 2 fort", zh: "建造 2 级要塞"},
  upgradeFort: {en: "Upgrade fort", zh: "升级要塞"},
  buildEf: {en: "Build expeditionary force", zh: "建造远征军"},
  moveEf: {en: "Move expeditionary force here", zh: "远征军移至此处"},
  influence: {en: "Place influence", zh: "放置影响标记"},
  diplomacy: {en: "Place diplomacy", zh: "放置外交标记"},
  minorAlliance: {en: "Minor alliance", zh: "小国联盟"},
  removeInfluence: {en: "Remove influence", zh: "移除影响"},
  breakAlliance: {en: "Break minor alliance", zh: "解除小国联盟"},
  pacify: {en: "Pacify", zh: "绥靖"},
  pacifyA065Marker: {en: "Pacify with Indian Ocean Arms Trade (−1 marker)", zh: "打出《印度洋军火贸易》绥靖（标记 -1）"},
  pacifyA065Rebel: {en: "Pacify with Indian Ocean Arms Trade (flip a rebel)", zh: "打出《印度洋军火贸易》绥靖（叛军恢复满编）"},
  move: {en: "Move selected units…", zh: "移动所选单位…"},
  gwNaval: {en: "Naval move here", zh: "海军移动至此"},
  gwMarch: {en: "March here", zh: "行军至此"},
  gwRail: {en: "Rail here", zh: "铁路运输至此"},
  refit: {en: "Refit unit", zh: "整补单位"},
  rapidDeploy: {en: "Rapid Deployment", zh: "快速部署"},
  deployReserves: {en: "Deploy reserves", zh: "部署预备军"},
  landBattle: {en: "Land battle here", zh: "在此发动陆战"},
  navalBattle: {en: "Naval battle here", zh: "在此发动海战"},
  gwDraft: {en: "Draft", zh: "征召"},
  gwDeploy: {en: "Deploy reserve army here", zh: "在此部署预备军"},
  gwElite: {en: "Attach elite corps", zh: "编入精锐军团"},
  rebuildZouave: {en: "Rebuild the Zouaves", zh: "重建祖阿夫"},
  placeMpit: {en: "Place major-power influence", zh: "放置大国影响力"},
};

export const actionCostLabel = (id: ActionId | "rebuildZouave" | "placeMpit", locale: "en" | "zh_CN"): string =>
  locale === "zh_CN" ? LABELS[id].zh : LABELS[id].en;

/**
 * The wording for every refusal code `engine/foreignAffairs` can return.
 *
 * The tables are typed with `Record<Problem, …>`, so adding a code in the engine
 * without translating it here is a compile error.  That is the point: the panel
 * and the move read the same gate, and a new printed restriction cannot reach
 * the engine while the Orders list still offers the row.
 */
/** Every refusal code the foreign-affairs gates can return. */
export type ForeignAffairsProblem =
  | DiplomacyProblem | InfluenceProblem | MinorAllianceProblem | RemoveMarkerProblem | RemoveAllianceProblem;

/**
 * The wording for every refusal code, in one exhaustive table.
 *
 * Typing it as `Record<ForeignAffairsProblem, …>` means adding a code in
 * `engine/foreignAffairs` without wording here is a compile error.  That is the
 * point of the shared module: the panel and the move read the same gate, so a
 * new printed restriction cannot reach the engine while the Orders list still
 * offers the row.
 */
const FOREIGN_AFFAIRS_TEXT: Record<ForeignAffairsProblem, [string, string]> = {
  "unknown-space": ["That is not a space on the map.", "地图上没有这个空间。"],
  "independent-india": ["India is independent and cannot be marked.", "印度已独立，不能放置标记。"],
  // 12.5.1 / 12.5.3
  "already-controlled": ["This space is already controlled.", "此空间已被控制。"],
  "already-influenced": ["This space already has an influence marker.", "此空间已有影响标记。"],
  "already-marked": ["This space already has a diplomacy marker.", "此空间已有外交标记。"],
  "africa-limit": ["Only one influence marker in Africa before the Berlin Conference.", "柏林会议前，每个玩家在非洲只能有 1 个影响标记。"],
  "no-loc": ["This space is outside your supply line.", "此空间超出你的补给线。"],
  "naval-box": ["Influence can only be placed in land spaces, not naval boxes.", "影响标记只能放在陆地空间，不能放在海军区。"],
  "not-minor-power": ["Diplomacy markers go only in minor power spaces.", "外交标记只能放在小国空间。"],
  "qing-china": ["No diplomacy markers may be placed in Qing China.", "不能在清帝国空间放置外交标记。"],
  "the-south": ["The South is out of play until the American Civil War.", "美国内战爆发前，南方不在游戏中。"],
  "japan-not-in-play": ["Japan enters play through Meiji Restoration.", "日本需通过“明治维新”进入游戏。"],
  "minor-home-space": ["Place the marker on the minor power's own home space.", "请放在该小国的同名本土空间。"],
  // 12.8 / 4.2.1
  "needs-diplomacy": ["You need a diplomacy marker here first.", "需先在此放置外交标记。"],
  "allied-elsewhere": ["That minor power is already allied to another player.", "该小国已与其它玩家结盟。"],
  "already-allied": ["This space already has a minor ally.", "此空间已有小国盟友。"],
  "ally-limit": ["Minor ally limit reached (5).", "已达小国联盟上限（5）。"],
  // 12.6 / 12.9
  "no-own-marker": ["No own marker here.", "此处无己方标记。"],
  "africa-after-berlin": ["Influence cannot be removed in Africa after the Berlin Conference.", "柏林会议后不能在非洲移除影响标记。"],
  "foreign-unit-present": ["Another player's unit is in this space.", "此空间内有他国单位。"],
  "no-ally": ["There is no minor ally marker here.", "此处没有小国盟友标记。"],
};

/** One refusal code's bilingual sentence. */
export const foreignAffairsText = (problem: ForeignAffairsProblem, locale: "en" | "zh_CN"): string => {
  const entry = FOREIGN_AFFAIRS_TEXT[problem];
  return locale === "zh_CN" ? entry[1] : entry[0];
};

/** 15.2 / 27.5: why a peacetime action is not on this phase's action list. */
export const PHASE_ACTION_TEXT: Record<"wartime-only" | "gw-only" | "peacetime-only", [string, string]> = {
  "wartime-only": [
    "15.2 replaces the peacetime actions during a war: only naval movement, joint naval, deploy reserves, march, rail and land battle are allowed.",
    "战时 15.2 以新行动表取代和平时期行动：只允许海军移动、联合海军、部署预备军、行军、铁路移动与陆战。",
  ],
  "gw-only": [
    "27.5 prints the Great War action list; this peacetime action is not on it.",
    "27.5 规定大战行动表，此和平时期行动不在其中。",
  ],
  "peacetime-only": [
    "This is an action-phase action.",
    "此行动只在行动阶段可用。",
  ],
};

/** 12.11 / 12.12.1's bilingual refusal sentences. */
export const PACIFICATION_TEXT: Record<PacificationProblem, [string, string]> = {
  "unknown-space": ["No such space.", "没有该空间。"],
  "independent-india": ["India is independent and cannot be marked or pacified.", "印度已独立，不能放置标记或绥靖。"],
  "naval-box": ["Naval boxes cannot be pacified.", "海军区不能绥靖。"],
  "no-influence": ["You need your own influence marker here.", "此处需有己方影响标记。"],
  "not-controller": ["Only the power that controls this space can clear its pacification marker.", "只有控制该空间的玩家可以清除此处的绥靖标记。"],
  "no-marker": ["There is no pacification marker here.", "此处没有绥靖标记。"],
  "no-land-unit": ["12.11 requires one of your land units in the space to pacify it.", "12.11：绥靖需在该空间有你的陆军单位。"],
  "rebel-present": ["12.12.1: a rebel army here must be eliminated in a land battle before you can pacify.", "12.12.1：须先以陆战消灭此处的叛军，才能绥靖。"],
  "already-this-impulse": ["12.11: one pacification per space per impulse — retry in a later impulse.", "12.11：每个空间每行动轮只能绥靖一次，请在后续行动轮再试。"],
};

export const pacificationText = (problem: PacificationProblem, locale: "en" | "zh_CN"): string => {
  const entry = PACIFICATION_TEXT[problem];
  return locale === "zh_CN" ? entry[1] : entry[0];
};

/**
 * The 12.1 action family of each Orders row, so 15.2 / 27.5 can gate the whole
 * list once.  Rows not listed here are printed on the war/GW lists themselves
 * (march, rail, land battle, deploy, draft, refit, joint naval) and need no
 * gate.
 */
const ACTION_PHASE_FAMILY: Partial<Record<ActionId, ActionFamily>> = {
  recruitArmy: "recruit",
  recruitCw: "recruit",
  recruitReserve: "recruit",
  recruitEc: "recruit",
  polishArmy: "recruit",
  polishReserve: "recruit",
  minorArmy: "minorAlliance",
  minorSquadron: "minorAlliance",
  minorDreadnought: "minorAlliance",
  buildSquadron: "constructFleet",
  buildDreadnought: "constructFleet",
  refitFleet: "refitFleet",
  buildFort: "buildFort",
  buildFort2: "buildFort",
  upgradeFort: "buildFort",
  buildEf: "buildEf",
  moveEf: "buildEf",
  influence: "placeInfluence",
  diplomacy: "placeDiplomacy",
  minorAlliance: "minorAlliance",
  removeInfluence: "removeInfluence",
  breakAlliance: "breakAlliance",
  pacify: "pacify",
  pacifyA065Marker: "pacify",
  pacifyA065Rebel: "pacify",
  rapidDeploy: "navalMovement",
};

/** The groups, in the order the player aid prints them. */
export type ActionGroupId = "recruit" | "build" | "diplomacy" | "move" | "greatWar";

export const ACTION_GROUP_LABELS: Record<ActionGroupId, {en: string; zh: string}> = {
  recruit: {en: "Recruit", zh: "征募"},
  build: {en: "Build", zh: "建造"},
  diplomacy: {en: "Diplomacy & influence", zh: "外交与影响"},
  move: {en: "Move & battle", zh: "移动与战斗"},
  greatWar: {en: "Great War", zh: "大战"},
};

export const ACTION_GROUP_ORDER: readonly ActionGroupId[] = ["recruit", "build", "diplomacy", "move", "greatWar"];

export interface SpaceAction {
  id: ActionId;
  /**
   * A render-unique key, because one `id` can occur more than once in a space.
   * The Great War lists "Joint naval with <ally>" once per allied contingent
   * next to the ordinary naval row, so keying on `id` gave React duplicate keys
   * and two elements the same `data-testid`.  Defaults to `id`.
   */
  uid?: string;
  group: ActionGroupId;
  label: string;
  /** CP the row costs; `0` for the free ones (Rapid Deployment, staff deploy). */
  cost: number;
  enabled: boolean;
  /** Why the row is disabled; cleared when it is enabled. */
  reason?: string;
  /** The engine call. */
  run: () => void;
}

export interface SpaceActionsInput {
  G: ImperialElegyState;
  viewer: Power;
  phase: string;
  /** The selected space (never null here; the panel shows "click a space"). */
  space: SpaceId;
  selectedUnit: string | null;
  /** CP left for this impulse. */
  cp: number;
  canAct: boolean;
  canActionCard: boolean;
  war: ImperialElegyState["war"];
  me: ImperialElegyState["powers"][Power];
  moves: Record<string, (...args: any[]) => void>;
  /** Runs a move; `describe` lets the board explain a refusal. */
  doAction: (fn: () => void, describe?: {label: string; reason?: string}) => void;
  /** Counts the panel already derives. */
  myOnMapArmies: number;
  myForts: number;
  myMinorAllies: number;
  ownLandInSelected: import("../types").Unit[];
  ownNavalInSelected: import("../types").Unit[];
  potentialLandTargets: SpaceId[];
  potentialNavalTargets: SpaceId[];
  deployLimit: number;
  deployFree: boolean;
  canDeployHere: boolean;
  canGwDraft: boolean;
  canGwDeployHere: boolean;
  polishArmyDecision: {allowed: boolean; cost: number; reasons: string[]} | null;
  polishReserveDecision: {allowed: boolean; cost: number; reasons: string[]} | null;
  /** 22.x: the viewer may decline the optional Polish reserve army. */
  polishReserve: boolean;
  gwJointNavalAllies: Power[];
  gwJointNavalUnitIds: (ally: Power) => string[];
  /** Targeting entry points. */
  startBattle: () => void;
  startNavalBattle: () => void;
  /**
   * Arm the map's move rings for the current selection (the 12.15/16.1 row).
   * The panel never moves a unit to a guessed destination; the player clicks
   * one of the highlighted spaces, which is also where the CP is spent.
   */
  startMove?: () => void;
  /**
   * The row's own label and reason are handed to `doAction`, so a refusal the
   * engine reports can be explained in words the player is already reading.
   */
  describeRow: (row: {id: string; label: string; reason?: string}) => {label: string; reason?: string};
  locale: "en" | "zh_CN";
}

const bi = (locale: "en" | "zh_CN", en: string, zh: string): string => (locale === "zh_CN" ? zh : en);

/** Short reason builders, shared with the tests. */
export const REASON = {
  cp: (locale: "en" | "zh_CN", n: number) => bi(locale, `Needs ${n} CP in this impulse.`, `本行动轮需要 ${n} CP。`),
  notYourTurn: (locale: "en" | "zh_CN") => bi(locale, "Only during your own impulse.", "仅限你的行动轮。"),
  pending: (locale: "en" | "zh_CN") => bi(locale, "Resolve the pending decision first.", "请先处理待决事项。"),
  noSpace: (locale: "en" | "zh_CN") => bi(locale, "Click a space on the map first.", "请先在地图上选择一个空间。"),
};

const recruitReason = (locale: "en" | "zh_CN", decision: RecruitDecision): string =>
  decision.reasons.length === 0
    ? bi(locale, "Not allowed here.", "此处不允许。")
    : decision.reasons.join(" · ");

const recruitReasonText = (locale: "en" | "zh_CN", reason: string): string => {
  // The engine speaks English; the UI only translates its own best reason.
  if (locale !== "zh_CN") return reason;
  const table: Record<string, string> = {
    "Not a home space": "不是本国核心领土",
    "Does not own the key": "未控制此空间的关键区",
    "Stacking limit reached": "已达堆叠上限",
    "Reserve limit 0 reached": "预备军已满",
    "Armies may not be built this impulse": "本轮不能建造军团",
    "An elite corps needs a friendly army to attach to": "精锐军团需有友方军团可编入",
  };
  return reason.split(" · ").map((part) => table[part] ?? part).join(" · ");
};

/**
 * Every action row for the selected space, grouped.  Rows that are structurally
 * irrelevant here (a fleet in a landlocked space, the Great War ladder before
 * the Great War) are omitted; rows that exist but are illegal are returned
 * disabled with a reason, so the player sees what the printed display offers.
 */
export const spaceActions = (input: SpaceActionsInput): SpaceAction[] => {
  const {
    G, viewer, phase, space, selectedUnit, canAct, war, me, moves, doAction,
    myOnMapArmies, myForts, ownLandInSelected, ownNavalInSelected,
    potentialLandTargets, potentialNavalTargets, deployLimit, deployFree, canDeployHere,
    canGwDraft, canGwDeployHere, polishArmyDecision, polishReserveDecision, polishReserve, gwJointNavalAllies,
    gwJointNavalUnitIds, startBattle, startNavalBattle, locale, describeRow,
  } = input;
  const rows: SpaceAction[] = [];
  const gw = phase === "gwManeuver";
  const commandOwner = gwAllyImpulseFor(G, viewer) ?? viewer;
  const canSpend = (cost: number): boolean => canAct && input.cp >= cost;
  const spendReason = (cost: number): string => !canAct ? REASON.notYourTurn(locale) : REASON.cp(locale, cost);
  // A088/UK-3: the free CP grants pay for their printed actions before the
  // ordinary wallet, so a row that spends one must not be disabled for want of
  // ordinary CP.  The three grants have different scopes:
  //   freeColonialCp — naval movement, construct fleet, EF, pacification (A088)
  //   freeOperationCp — EF, pacification, naval movement (UK-3 naval option)
  //   freeIndianCp — Indian army steps or an EF in India/Bengal (UK-3 India)
  const freeColonial = Number(me.flags.freeColonialCp ?? 0);
  const freeOperation = Number(me.flags.freeOperationCp ?? 0);
  const freeIndian = Number(me.flags.freeIndianCp ?? 0);
  const indianSpace = space === "india" || space === "bengal";
  const operationBudget = freeColonial + freeOperation;
  const canSpendColonial = (cost: number): boolean =>
    canAct && operationBudget + (indianSpace ? freeIndian : 0) + input.cp >= cost;
  const canSpendOperation = (cost: number): boolean =>
    canAct && operationBudget + input.cp >= cost;
  const canSpendFleet = (cost: number): boolean =>
    canAct && freeColonial + input.cp >= cost;
  const canSpendIndianArmy = (cost: number): boolean =>
    canAct && freeIndian + input.cp >= cost;
  const colonialSpendReason = (cost: number): string =>
    !canAct ? REASON.notYourTurn(locale) : spendReason(cost);
  const selected = selectedUnit ? G.units[selectedUnit] : undefined;
  const commandsSelected = (unitId: string): boolean => {
    const unit = G.units[unitId];
    return unit !== undefined && unitIsCommanded(G, viewer, unit, phase);
  };
  const unitSelected = selected !== undefined && commandsSelected(selected.id);
  const selectedIsOther = selected !== undefined && !unitSelected;
  const spaceDef = SPACES[space];
  const gwAllowed = (kind: GwActionKind): {ok: boolean; reason?: string} => gwActionAllowance(G, viewer, kind);

  const push = (row: Omit<SpaceAction, "label" | "cost"> & {cost?: number}): void => {
    const cost = row.cost ?? ACTION_COSTS[row.id];
    const label = actionCostLabel(row.id, locale);
    rows.push({
      ...row,
      cost,
      label,
      // Every row's move goes through the board's rejection notice with the
      // label and reason the player is already reading on this row.
      run: () => doAction(() => row.run(), describeRow({id: row.uid ?? row.id, label, reason: row.reason})),
    });
  };

  // ---------------------------------------------------------------- recruit
  // The Great War ladder has its own actions; the campaign's recruitment stays
  // available (27.5's draft is what replaces it only where the GW prints it).
  {
    const army = canRecruitIn(G, viewer, space, "army");
    const armyCost = ACTION_COSTS.recruitArmy;
    // 33.2: a UK army built in India/Bengal is an Indian army, so the Sun
    // Never Sets India grant can pay for that step.
    const armyEnabled = army.allowed && (viewer === "UK" && indianSpace
      ? canSpendIndianArmy(armyCost)
      : canSpend(armyCost));
    push({
      id: "recruitArmy", group: "recruit", enabled: armyEnabled,
      reason: armyEnabled ? undefined : !army.allowed ? recruitReasonText(locale, recruitReason(locale, army)) : spendReason(armyCost),
      run: () => doAction(() => moves.recruit(space, "army", 1)),
    });
    if (viewer === "UK") {
      const cw = canRecruitIn(G, viewer, space, "army", {cw: true});
      const cwEnabled = gw === false && cw.allowed && canSpend(armyCost);
      push({
        id: "recruitCw", group: "recruit", enabled: cwEnabled,
        reason: cwEnabled ? undefined
          : phase !== "gwManeuver" && !isCwArmySpace(space) ? bi(locale, "Only in Australia/New Zealand or Canada, during the Great War.", "仅限大战期间在澳新或加拿大。")
            : !cw.allowed ? recruitReasonText(locale, recruitReason(locale, cw)) : spendReason(armyCost),
        run: () => doAction(() => moves.recruit(space, "army", 1, {cw: true})),
      });
    }
    const reserve = canRecruitIn(G, viewer, space, "reserveArmy");
    // 7.3 / 33.5: the box holds the lower of manpower and industry, plus the
    // printed national bonuses — the same helper the move and the bots read.
    const reserveRoom = reserveRemaining(G, viewer);
    const reserveCounter = hasCounterFor(G, viewer, "reserveArmy");
    const reserveEnabled = reserve.allowed && reserveRoom > 0 && reserveCounter && canSpend(ACTION_COSTS.recruitReserve);
    push({
      id: "recruitReserve", group: "recruit", enabled: reserveEnabled,
      reason: reserveEnabled ? undefined
        : !reserve.allowed ? recruitReasonText(locale, recruitReason(locale, reserve))
          : reserveRoom <= 0 ? bi(locale, "No reserve army allowance left (the lower of manpower and industry).", "预备军额度已用尽（人力与工业取低）。")
            : !reserveCounter ? bi(locale, "No reserve army counter is left.", "已无预备军棋子。")
              : spendReason(ACTION_COSTS.recruitReserve),
      run: () => doAction(() => moves.recruit(space, "reserveArmy", 1)),
    });
    const ec = canRecruitIn(G, viewer, space, "eliteCorps");
    const ecEnabled = ec.allowed && canSpend(ACTION_COSTS.recruitEc);
    push({
      id: "recruitEc", group: "recruit", enabled: ecEnabled,
      reason: ecEnabled ? undefined : !ec.allowed ? recruitReasonText(locale, recruitReason(locale, ec)) : spendReason(ACTION_COSTS.recruitEc),
      run: () => doAction(() => moves.recruit(space, "eliteCorps", 1)),
    });
    if (polishArmyDecision !== null) {
      const cost = polishArmyDecision.cost;
      const enabled = polishArmyDecision.allowed === true && canSpend(cost);
      push({
        id: "polishArmy", group: "recruit", cost, enabled,
        reason: enabled ? undefined : polishArmyDecision.allowed ? spendReason(cost) : polishArmyDecision.reasons.join(" · "),
        run: () => doAction(() => moves.polishRecruit("army", space, 2)),
      });
    }
    if (polishReserveDecision !== null) {
      const cost = polishReserveDecision.cost;
      const enabled = polishReserveDecision.allowed === true && canSpend(cost);
      push({
        id: "polishReserve", group: "recruit", cost, enabled,
        reason: enabled ? undefined : polishReserveDecision.allowed ? spendReason(cost) : polishReserveDecision.reasons.join(" · "),
        run: () => doAction(() => moves.polishRecruit("reserveArmy", null, 2)),
      });
    }
    // 12.2 / 12.4 (errata) + 12.8: build for an allied minor in its home space.
    // Only the minor whose home this space is gets a row, so the list stays as
    // short as the printed action list.
    const homeMinor = spaceDef?.minorHome ?? null;
    if (
      homeMinor !== null && homeMinor !== undefined &&
      !isPower(homeMinor) && homeMinor !== "IT" && homeMinor !== "US" &&
      buildableMinorAllies(G, viewer).includes(homeMinor)
    ) {
      const minorArmy = minorBuildDecision(G, viewer, homeMinor, "army", space, 1);
      const armyRowEnabled = minorArmy.allowed && canSpend(ACTION_COSTS.minorArmy);
      push({
        id: "minorArmy", group: "recruit", enabled: armyRowEnabled,
        reason: armyRowEnabled ? undefined
          : !minorArmy.allowed ? recruitReasonText(locale, minorArmy.reasons.join(" · "))
            : spendReason(ACTION_COSTS.minorArmy),
        run: () => doAction(() => moves.buildForMinor(homeMinor, "army", space, 1)),
      });
      if ((spaceDef.ports?.length ?? 0) > 0) {
        const squadron = minorBuildDecision(G, viewer, homeMinor, "squadron", space);
        const sqEnabled = squadron.allowed && canSpend(ACTION_COSTS.minorSquadron);
        push({
          id: "minorSquadron", group: "build", enabled: sqEnabled,
          reason: sqEnabled ? undefined
            : !squadron.allowed ? recruitReasonText(locale, squadron.reasons.join(" · "))
              : spendReason(ACTION_COSTS.minorSquadron),
          run: () => doAction(() => moves.buildForMinor(homeMinor, "squadron", space, 2)),
        });
        const dread = minorBuildDecision(G, viewer, homeMinor, "dreadnought", space);
        const dnEnabled = dread.allowed && canSpend(ACTION_COSTS.minorDreadnought);
        push({
          id: "minorDreadnought", group: "build", enabled: dnEnabled,
          reason: dnEnabled ? undefined
            : !dread.allowed ? recruitReasonText(locale, dread.reasons.join(" · "))
              : spendReason(ACTION_COSTS.minorDreadnought),
          run: () => doAction(() => moves.buildForMinor(homeMinor, "dreadnought", space, 2)),
        });
      }
    }
  }

  // ------------------------------------------------------------------ build
  {
    const hasPort = portBoxes(space).length > 0;
    const homeKey = isHomeSpace(G, space, viewer) && ownsKey(G, space, viewer);
    const homeReason = !isHomeSpace(G, space, viewer)
      ? bi(locale, "Must be your own home space.", "必须是本国核心领土。")
      : !ownsKey(G, space, viewer) ? bi(locale, "You must control a key in this space.", "必须控制此空间的关键区。") : null;
    // 12.4: "Newly built fleets must be placed in a controlled, territorial
    // home key on the main map with a port."  A colonial home key on a submap
    // (Canada, India, South Africa, Australia) has a port but is not eligible.
    const fleetHomeReason = homeReason ?? (SPACES[space]?.submap !== "main" || effectiveKeyType(G, space) !== "territorial"
      ? bi(locale, "New fleets need a territorial home key on the main map.", "新建舰队需位于主地图的本国领土关键区。")
      : null);
    if (hasPort) {
      const sqEnabled = fleetHomeReason === null && canSpendFleet(ACTION_COSTS.buildSquadron);
      push({
        id: "buildSquadron", group: "build", enabled: sqEnabled,
        reason: sqEnabled ? undefined : fleetHomeReason ?? colonialSpendReason(ACTION_COSTS.buildSquadron),
        run: () => doAction(() => moves.constructFleet(space, "squadron", false)),
      });
      const dreadnoughtLocked = G.persistent.dreadnoughts !== true && !me.flags.navalLimit;
      const dnEnabled = fleetHomeReason === null && !dreadnoughtLocked && canSpendFleet(ACTION_COSTS.buildDreadnought);
      push({
        id: "buildDreadnought", group: "build", enabled: dnEnabled,
        reason: dnEnabled ? undefined
          : fleetHomeReason ?? (dreadnoughtLocked ? bi(locale, "Dreadnought must have been played.", "需先打出“无畏舰”。") : colonialSpendReason(ACTION_COSTS.buildDreadnought)),
        // The button's label is the panel's English key; keep the printed name.
        run: () => doAction(() => moves.constructFleet(space, "dreadnought", false)),
      });
    }
    void homeKey;
    // 12.1's fort action: 1–2 CP for a new fort (its level is the CP spent), a
    // 1 CP upgrade of your own fort (never to level 3), and the printed
    // placement — a European space you control or occupy with a land unit.
    // Every row reads the same gate `buildFort` enforces.
    const existingFort = G.spaces[space]?.fort ?? null;
    const fortMobile = landUnitsIn(G, space).some((unit) => unit.owner === viewer);
    const fortPlaceable = G.spaces[space]?.control === viewer || fortMobile;
    // A space id the map does not know has no region: treat it as a plain
    // refusal rather than crashing the whole Orders list.
    const fortPlaceReason = spaceDef === undefined ? bi(locale, "Fortresses can only be built on the map.", "只能在地图上的空间建造要塞。")
      : spaceDef.region !== "europe" ? bi(locale, "Forts can only be built in Europe.", "要塞只能在欧洲建造。")
        : !fortPlaceable ? bi(locale, "A new fort needs a space you control or occupy with a land unit.", "新建要塞需位于你控制、或驻有你陆军单位的空间。")
          : null;
    const fortOwn = existingFort !== null && existingFort.power === viewer;
    // The fort action is the European one.  The Indian Fort is the UK's own
    // printed counter and is upgraded by its home card ("place/upgrade the
    // Indian fort"), so it must not offer an action `buildFort` would refuse.
    const indianFortHere = existingFort?.indian === true;
    const fortActionOnMap = spaceDef !== undefined && spaceDef.region === "europe" && !indianFortHere;
    const fortUpgradable = fortOwn && existingFort.level < 2 && fortActionOnMap;
    const fortBuildReason = fortPlaceReason
      ?? (existingFort !== null
        ? fortOwn
          ? bi(locale, "This space already holds your fort; upgrade it for 1 CP.", "此空间已有你的要塞：可花 1 CP 升级。")
          : bi(locale, "This space already has another power's fort.", "此空间已有其他势力的要塞。")
        : myForts >= 3 ? bi(locale, "Fort limit reached (3).", "已达要塞上限（3座）。") : null);
    const fortEnabled = fortBuildReason === null && canSpend(ACTION_COSTS.buildFort);
    push({
      id: "buildFort", group: "build", enabled: fortEnabled,
      reason: fortEnabled ? undefined : fortBuildReason ?? spendReason(ACTION_COSTS.buildFort),
      run: () => doAction(() => moves.buildFort(space, 1)),
    });
    const fort2Enabled = fortBuildReason === null && !fortOwn && canSpend(ACTION_COSTS.buildFort2);
    push({
      id: "buildFort2", group: "build", enabled: fort2Enabled,
      reason: fort2Enabled
        ? undefined
        : fortBuildReason
          ?? (fortOwn
            ? bi(locale, "A level 2 fort is a new fort only; upgrade instead.", "2 级要塞只能新建；已有要塞请用升级。")
            : spendReason(ACTION_COSTS.buildFort2)),
      run: () => doAction(() => moves.buildFort(space, 2)),
    });
    const upgradeEnabled = fortUpgradable && canSpend(ACTION_COSTS.upgradeFort);
    push({
      id: "upgradeFort", group: "build", enabled: upgradeEnabled,
      reason: upgradeEnabled
        ? undefined
        : !fortOwn
          ? bi(locale, "No fort of yours here to upgrade.", "此处没有你的要塞可升级。")
          : indianFortHere
            ? bi(locale, "The Indian Fort is upgraded by its home-card event, not by this action.", "印度要塞由其本土牌事件升级，不走建造要塞行动。")
            : !fortActionOnMap
              ? bi(locale, "Forts can only be built in Europe.", "要塞只能在欧洲建造。")
              : fortUpgradable
                ? spendReason(ACTION_COSTS.upgradeFort)
                : bi(locale, "A fort cannot be upgraded past level 2.", "要塞最高只能到 2 级。"),
      run: () => doAction(() => moves.buildFort(space, 1)),
    });
    // 12.10: the EF teleports, but only into a printed destination.  The row
    // reads the same predicate the move does, so it never offers a drop the
    // engine would refuse.
    const efReason = efDestinationAllowed(G, space, viewer)
      ? null
      : bi(locale, "An EF needs a friendly controlled or home space, or your influence marker.", "远征军需置于友方控制区、本国核心领土，或有你影响标记的空间。");
    const efEnabled = efReason === null && canSpendColonial(ACTION_COSTS.buildEf);
    push({
      id: "buildEf", group: "build", enabled: efEnabled,
      reason: efEnabled ? undefined : efReason ?? colonialSpendReason(ACTION_COSTS.buildEf),
      run: () => doAction(() => moves.buildEf(space)),
    });
    if (selectedUnit !== null && selected?.kind === "expeditionary" && selected.owner === viewer && selected.space !== space) {
      const moveEnabled = efReason === null && canSpendOperation(ACTION_COSTS.moveEf);
      push({
        id: "moveEf", group: "build", enabled: moveEnabled,
        reason: moveEnabled ? undefined : efReason ?? spendReason(ACTION_COSTS.moveEf),
        run: () => doAction(() => moves.buildEf(space, selectedUnit)),
      });
    }
  }

  // -------------------------------------------------------------- diplomacy
  {
    const influenced = me.flags.alreadyInfluenced === true;
    // Both placement gates come from `engine/foreignAffairs`, the same module
    // `placeInfluence`/`placeDiplomacy` consult, so a row can never offer a
    // marker the move would refuse (12.5.1 / 12.5.3).  The panel supplies only
    // the wording; the codes themselves are the engine's.
    const influenceProblem = influencePlacementProblem(G, viewer, space);
    const influenceReason = influenced ? bi(locale, "You already influenced this impulse.", "本行动轮已使用影响。")
      : influenceProblem === null ? null
        : foreignAffairsText(influenceProblem, locale);
    const influenceEnabled = influenceReason === null && canSpend(ACTION_COSTS.influence);
    push({
      id: "influence", group: "diplomacy", enabled: influenceEnabled,
      reason: influenceEnabled ? undefined : influenceReason ?? spendReason(ACTION_COSTS.influence),
      run: () => doAction(() => moves.placeInfluence(space)),
    });
    const diplomacyProblem = diplomacyPlacementProblem(G, space);
    const diplomacyReason = influenced ? bi(locale, "You already influenced this impulse.", "本行动轮已使用影响。")
      : diplomacyProblem === null ? null
        : foreignAffairsText(diplomacyProblem, locale);
    const diplomacyEnabled = diplomacyReason === null && canSpend(ACTION_COSTS.diplomacy);
    push({
      id: "diplomacy", group: "diplomacy", enabled: diplomacyEnabled,
      reason: diplomacyEnabled ? undefined : diplomacyReason ?? spendReason(ACTION_COSTS.diplomacy),
      run: () => doAction(() => moves.placeDiplomacy(space)),
    });
    const allyProblem = minorAllianceProblem(G, viewer, space);
    const allyReason = allyProblem === null ? null : foreignAffairsText(allyProblem, locale);
    const allyEnabled = allyReason === null && canSpend(ACTION_COSTS.minorAlliance);
    push({
      id: "minorAlliance", group: "diplomacy", enabled: allyEnabled,
      reason: allyEnabled ? undefined : allyReason ?? spendReason(ACTION_COSTS.minorAlliance),
      run: () => doAction(() => moves.minorAlliance(space)),
    });
    const removeProblem = removeMarkerProblem(G, viewer, space);
    const removeInfluenceReason = me.flags.alreadyRemovedInfluence === true ? bi(locale, "You already removed influence this impulse.", "本行动轮已移除影响。")
      : removeProblem === null ? null
        : foreignAffairsText(removeProblem, locale);
    const removeInfluenceEnabled = removeInfluenceReason === null && canSpend(ACTION_COSTS.removeInfluence);
    push({
      id: "removeInfluence", group: "diplomacy", enabled: removeInfluenceEnabled,
      reason: removeInfluenceEnabled ? undefined : removeInfluenceReason ?? spendReason(ACTION_COSTS.removeInfluence),
      run: () => doAction(() => moves.removeInfluence(space)),
    });
    // 12.9: "Flip any one ally marker on a minor power to its diplomacy side."
    // Any player may do it, so this row is not limited to the alliance's owner.
    // 12.9.1: a port space next to a naval box where the viewer outnumbers the
    // allied player pays 3 CP instead of the printed 4.
    const breakProblem = removeMinorAllianceProblem(G, space);
    const breakCost = removeAllianceCost(G, viewer, space);
    const breakReason = breakProblem === null ? null : foreignAffairsText(breakProblem, locale);
    const breakEnabled = breakReason === null && canSpend(breakCost);
    push({
      id: "breakAlliance", group: "diplomacy", enabled: breakEnabled, cost: breakCost,
      reason: breakEnabled ? undefined : breakReason ?? spendReason(breakCost),
      run: () => doAction(() => moves.removeMinorAlliance(space)),
    });
    const pacifyCost = pacificationCost(G, viewer).cost;
    // 12.11 / 12.12.1: the row reads the same gate `pacify` enforces (own
    // influence marker, a land unit in the space, no rebel army, and once per
    // space per impulse).  The old copy only checked the influence marker and
    // a permanent "pacified" flag, so it offered — and the move then refused —
    // a pacification the rules forbid, and it forbade the retry the rules allow.
    const pacifyProblem = pacificationProblem(G, viewer, space);
    const pacifyReason = pacifyProblem === null ? null : pacificationText(pacifyProblem, locale);
    const pacifyEnabled = pacifyReason === null
      && phaseActionProblem(G, "pacify") === null
      && canSpendOperation(pacifyCost);
    push({
      // 12.1's pacification cost is not flat: GE pays 2 CP until it unifies and
      // AU always pays 2 CP, so the row quotes the same figure the move charges.
      id: "pacify", group: "diplomacy", enabled: pacifyEnabled, cost: pacifyCost,
      reason: pacifyEnabled ? undefined : pacifyReason ?? colonialSpendReason(pacifyCost),
      run: () => doAction(() => moves.pacify(space)),
    });
    // A65 is printed "Play prior to a pacification roll".  One row per printed
    // effect keeps the card out of the generic impulse-response window while
    // still letting its holder use it at the printed moment.
    if (pacifyEnabled && me.hand.includes("IE-A065")) {
      push({
        id: "pacifyA065Marker", group: "diplomacy", enabled: true, cost: pacifyCost,
        run: () => doAction(() => moves.pacify(space, "marker")),
      });
      push({
        id: "pacifyA065Rebel", group: "diplomacy", enabled: true, cost: pacifyCost,
        run: () => doAction(() => moves.pacify(space, "rebel")),
      });
    }
  }

  // ----------------------------------------------------------- move & battle
  /**
   * 12.15 / 16.1: the move row lives in the unit's **own** space, not in the
   * destination.  It used to appear only after selecting a unit, then clicking
   * the destination and scrolling back to the Orders list there — three steps
   * for one move, and the row named a space the player was no longer looking at.
   * Now the space holding the selected stack offers "Move selected unit(s)…",
   * which arms the map's rings; the destination is the next map click.
   */
  const unitElsewhere = selectedUnit !== null && selected !== undefined && selected.space !== space;
  if (!gw && selectedUnit !== null && selected !== undefined && selected.space === space
    && selected.owner === viewer && !selected.naval) {
    const targets = legalUnitTargets({G, power: viewer, unit: selected, phase});
    const moveEnabled = canSpend(ACTION_COSTS.move) && targets.size > 0;
    push({
      id: "move", group: "move", enabled: moveEnabled,
      reason: moveEnabled ? undefined
        : targets.size === 0 ? bi(locale, "No legal destination from here.", "此处没有合法的移动目的地。")
          : spendReason(ACTION_COSTS.move),
      run: () => doAction(() => input.startMove?.()),
    });
  }
  if (gw && unitElsewhere && selectedIsOther) {
    // A non-commanded unit selected in this arena: the rail case for a minor
    // army (23.x TSRR-style rail allowances) is the board's own business.
    push({id: "gwRail", group: "move", enabled: false, reason: bi(locale, "That unit is not yours to move.", "该单位不归你指挥。"), run: () => undefined});
  }
  if (gw && unitElsewhere && selected !== undefined) {
    if (selected.naval) {
      const allowance = gwAllowed("naval");
      const enabled = allowance.ok;
      push({
        id: "gwNaval", group: "move", enabled,
        reason: enabled ? undefined : bi(locale, "Only during your Great War impulse.", "仅限你的大战行动轮。"),
        run: () => doAction(() => moves.navalMove([selected.id], space)),
      });
      if (selected.owner === viewer) {
        for (const ally of gwJointNavalAllies) {
          const joint = gwAllowed("jointNaval");
          rows.push({
            id: "gwNaval", uid: `gwNaval@${ally}`, group: "move", cost: ACTION_COSTS.gwNaval,
            label: bi(locale, `Joint naval with ${input.G.powers[ally] ? ally : ally}`, `与${ally}联合海军`),
            enabled: joint.ok,
            reason: joint.ok ? undefined : bi(locale, "Only during your Great War impulse.", "仅限你的大战行动轮。"),
            run: () => doAction(() => moves.gwJointNaval(ally, [selected.id], gwJointNavalUnitIds(ally), space)),
          });
        }
      }
    } else {
      const march = gwAllowed("march");
      push({
        id: "gwMarch", group: "move", enabled: march.ok,
        reason: march.ok ? undefined : bi(locale, "Only during your Great War impulse.", "仅限你的大战行动轮。"),
        run: () => doAction(() => moves.gwMarch(selected.id, space)),
      });
      const rail = gwAllowed("rail");
      push({
        id: "gwRail", group: "move", enabled: rail.ok,
        reason: rail.ok ? undefined : bi(locale, "Only during your Great War impulse.", "仅限你的大战行动轮。"),
        run: () => doAction(() => moves.gwRail(selected.id, space)),
      });
    }
  }
  if (gw && selected !== undefined && selected.owner === commandOwner && selected.steps < 2) {
    const refit = gwAllowed(selected.naval ? "refitFleet" : "refit");
    push({
      id: "refit", group: "move", enabled: refit.ok,
      reason: refit.ok ? undefined : bi(locale, "Only a reduced unit in a friendly port can refit.", "仅限友好港口内的受损单位整补。"),
      run: () => doAction(() => selected.naval ? moves.gwRefitFleet(selected.id) : moves.gwRefit(selected.id)),
    });
  }
  if (!gw && phase === "action" && selected !== undefined && selected.owner === viewer
    && selected.naval && selected.steps < 2 && selected.space === space) {
    // 12.4's chart: "Refit Naval Unit - 1 CP", only in a friendly port.
    const port = friendlyPort(G, viewer, space);
    const enabled = port && canSpend(ACTION_COSTS.refitFleet);
    push({
      id: "refitFleet", group: "move", enabled,
      reason: enabled ? undefined
        : port ? spendReason(ACTION_COSTS.refitFleet) : bi(locale, "A reduced fleet can only refit in a friendly port.", "受损舰队只能在友好港口内整补。"),
      run: () => doAction(() => moves.refitNavalUnit(selected.id)),
    });
  }
  if (viewer === "UK" && me.rapidDeployment && !me.rapidDeployment.spent && selectedIsOther === false
    && selected !== undefined && selected.owner === "UK" && selected.naval && selected.space !== space
    && (phase === "wartime" || gw)) {
    rows.push({
      id: "rapidDeploy", group: "move", cost: 0,
      label: bi(locale, "Rapid Deployment (free naval move)", "快速部署（免费海军移动）"),
      enabled: true,
      run: () => doAction(() => moves.rapidDeploy([selected.id], space)),
    });
  }
  if (phase === "wartime" && me.reserves.length > 0) {
    push({
      id: "deployReserves", group: "move", cost: deployFree ? 0 : ACTION_COSTS.deployReserves,
      enabled: canDeployHere,
      reason: canDeployHere ? undefined
        : me.reserves.length === 0 ? bi(locale, "No reserve army is available.", "没有可用的预备军。")
          : deployLimit <= 0 ? bi(locale, "No reserve army may deploy this impulse.", "本行动轮不能部署预备军。")
            : bi(locale, "This space cannot take another army right now.", "此空间目前无法再容纳军团。"),
      run: () => doAction(() => moves.deployReserves(space, deployLimit, {polishReserve: polishReserveDeployer(G) === viewer && polishReserve})),
    });
  }
  if (ownLandInSelected.length > 0) {
    const cost = ACTION_COSTS.landBattle;
    const enabled = (gw ? gwAllowed("landBattle").ok : canSpend(cost)) && potentialLandTargets.length > 0;
    push({
      id: "landBattle", group: "move", enabled,
      reason: enabled ? undefined
        : potentialLandTargets.length === 0 ? bi(locale, "No enemy army is adjacent, or the adjacent power has not been declared on.", "相邻空间没有敌军，或尚未对相邻势力宣战。")
          : gw ? bi(locale, "Only during your Great War impulse.", "仅限你的大战行动轮。") : spendReason(cost),
      run: startBattle,
    });
  }
  if (ownNavalInSelected.length > 0) {
    const cost = ACTION_COSTS.navalBattle;
    const enabled = (gw ? gwAllowed("naval").ok : canSpend(cost)) && potentialNavalTargets.length > 0;
    push({
      id: "navalBattle", group: "move", enabled,
      reason: enabled ? undefined
        : potentialNavalTargets.length === 0 ? bi(locale, "No enemy fleet is adjacent.", "相邻海域没有敌方舰队。")
          : gw ? bi(locale, "Only during your Great War impulse.", "仅限你的大战行动轮。") : spendReason(cost),
      run: startNavalBattle,
    });
  }

  // -------------------------------------------------------------- great war
  if (gw) {
    const draft = gwAllowed("draft");
    push({
      id: "gwDraft", group: "greatWar", enabled: canGwDraft,
      reason: canGwDraft ? undefined : draft.ok ? bi(locale, "No manpower or this space cannot draft.", "人力不足或此空间不能征召。") : bi(locale, "Only during your Great War impulse.", "仅限你的大战行动轮。"),
      run: () => doAction(() => moves.gwDraft(space)),
    });
    if (viewer === "UK" && isCwArmySpace(space)) {
      const cw = gwAllowed("draft");
      push({
        id: "recruitCw", group: "greatWar", enabled: cw.ok,
        reason: cw.ok ? undefined : bi(locale, "Only during your Great War impulse.", "仅限你的大战行动轮。"),
        run: () => doAction(() => moves.recruit(space, "army", 1, {cw: true})),
      });
    }
    const deploy = gwAllowed("deploy");
    push({
      id: "gwDeploy", group: "greatWar", enabled: canGwDeployHere,
      reason: canGwDeployHere ? undefined
        : deploy.ok ? bi(locale, "Needs one reserve army, room for it, and a friendly home or key without a trench.", "需要预备军、堆叠空间，以及无战壕的友方核心区或关键区。")
          : bi(locale, "Only during your Great War impulse.", "仅限你的大战行动轮。"),
      run: () => doAction(() => moves.gwDeploy(space)),
    });
    if (selected !== undefined && !selected.naval && isArmyKind(selected.kind)) {
      const elite = gwAllowed("eliteCorps");
      push({
        id: "gwElite", group: "greatWar", enabled: elite.ok,
        reason: elite.ok ? undefined : bi(locale, "Only during your Great War impulse.", "仅限你的大战行动轮。"),
        run: () => doAction(() => moves.gwEliteCorps(selected.id)),
      });
    }
  }

  void selectedIsOther;
  void input.canActionCard;

  // 15.2 / 27.5: one phase gate over the whole list.  A limited war replaces
  // 12.1's peacetime actions with its own list, and the Great War prints a
  // third, so a row the phase forbids is shown disabled with the printed reason
  // instead of being offered and then refused by the move.
  for (const row of rows) {
    const family = ACTION_PHASE_FAMILY[row.id];
    if (family === undefined) continue;
    const problem = phaseActionProblem(G, family);
    if (problem === null) continue;
    const [en, zh] = PHASE_ACTION_TEXT[problem];
    row.enabled = false;
    row.reason = bi(locale, en, zh);
  }

  return rows;
};
