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
  gwAllyImpulseFor, hasLoc, isArmyKind, isHomeSpace, minorController, ownsKey,
} from "../engine/rules";
import {gwActionAllowance} from "../engine/gwImpulse";
import {reserveRemaining} from "../engine/economy";
import {canRecruitIn, isCwArmySpace, pacificationCost} from "../engine/characteristics";
import {hasCounterFor} from "../engine/counters";
import {polishReserveDeployer} from "../engine/poland";
import type {RecruitDecision} from "../engine/characteristics";

export type ActionId =
  | "recruitArmy" | "recruitCw" | "recruitReserve" | "recruitEc" | "polishArmy" | "polishReserve"
  | "buildSquadron" | "buildDreadnought" | "buildFort" | "buildEf" | "moveEf"
  | "influence" | "diplomacy" | "minorAlliance" | "removeInfluence" | "breakAlliance" | "pacify"
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
  buildSquadron: 2,
  buildDreadnought: 3,
  buildFort: 1,
  buildEf: 2,
  moveEf: 1,
  influence: 1,
  diplomacy: 1,
  minorAlliance: 3,
  removeInfluence: 1,
  breakAlliance: 4,
  pacify: 1,
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
  "buildSquadron", "buildDreadnought", "buildFort", "buildEf", "moveEf",
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
  buildSquadron: {en: "Build squadron", zh: "建造分舰队"},
  buildDreadnought: {en: "Build dreadnought", zh: "建造无畏舰"},
  buildFort: {en: "Build fort", zh: "建造要塞"},
  buildEf: {en: "Build expeditionary force", zh: "建造远征军"},
  moveEf: {en: "Move expeditionary force here", zh: "远征军移至此处"},
  influence: {en: "Place influence", zh: "放置影响标记"},
  diplomacy: {en: "Place diplomacy", zh: "放置外交标记"},
  minorAlliance: {en: "Minor alliance", zh: "小国联盟"},
  removeInfluence: {en: "Remove influence", zh: "移除影响"},
  breakAlliance: {en: "Break minor alliance", zh: "解除小国联盟"},
  pacify: {en: "Pacify", zh: "绥靖"},
  move: {en: "Move unit here", zh: "移动单位至此"},
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
  /** Second objective for a declaration (kept in the panel). */
  warCp: number;
  /**
   * The row's own label and reason are handed to `doAction`, so a refusal the
   * engine reports can be explained in words the player is already reading.
   */
  describeRow: (row: {id: string; label: string; reason?: string}) => {label: string; reason?: string};
  onDeclareWar: () => {enabled: boolean; reason?: string} | null;
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
    myOnMapArmies, myForts, myMinorAllies, ownLandInSelected, ownNavalInSelected,
    potentialLandTargets, potentialNavalTargets, deployLimit, deployFree, canDeployHere,
    canGwDraft, canGwDeployHere, polishArmyDecision, polishReserveDecision, polishReserve, gwJointNavalAllies,
    gwJointNavalUnitIds, startBattle, startNavalBattle, onDeclareWar, locale, describeRow,
  } = input;
  const rows: SpaceAction[] = [];
  const gw = phase === "gwManeuver";
  const commandOwner = gwAllyImpulseFor(G, viewer) ?? viewer;
  const canSpend = (cost: number): boolean => canAct && input.cp >= cost;
  const spendReason = (cost: number): string => !canAct ? REASON.notYourTurn(locale) : REASON.cp(locale, cost);
  const selected = selectedUnit ? G.units[selectedUnit] : undefined;
  const commandsSelected = (unitId: string): boolean => {
    const unit = G.units[unitId];
    if (!unit) return false;
    if (unit.owner === commandOwner) return true;
    return gw && !["US", "IT"].includes(unit.owner as string) && minorController(G, unit.owner) === viewer;
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
      run: () => doAction(() => row.run(), describeRow({id: row.id, label, reason: row.reason})),
    });
  };

  // ---------------------------------------------------------------- recruit
  // The Great War ladder has its own actions; the campaign's recruitment stays
  // available (27.5's draft is what replaces it only where the GW prints it).
  {
    const army = canRecruitIn(G, viewer, space, "army");
    const armyCost = ACTION_COSTS.recruitArmy;
    const armyEnabled = army.allowed && canSpend(armyCost);
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
  }

  // ------------------------------------------------------------------ build
  {
    const hasPort = portBoxes(space).length > 0;
    const homeKey = isHomeSpace(G, space, viewer) && ownsKey(G, space, viewer);
    const homeReason = !isHomeSpace(G, space, viewer)
      ? bi(locale, "Must be your own home space.", "必须是本国核心领土。")
      : !ownsKey(G, space, viewer) ? bi(locale, "You must control a key in this space.", "必须控制此空间的关键区。") : null;
    if (hasPort) {
      const sqEnabled = homeReason === null && canSpend(ACTION_COSTS.buildSquadron);
      push({
        id: "buildSquadron", group: "build", enabled: sqEnabled,
        reason: sqEnabled ? undefined : homeReason ?? spendReason(ACTION_COSTS.buildSquadron),
        run: () => doAction(() => moves.constructFleet(space, "squadron", false)),
      });
      const dreadnoughtLocked = G.persistent.dreadnoughts !== true && !me.flags.navalLimit;
      const dnEnabled = homeReason === null && !dreadnoughtLocked && canSpend(ACTION_COSTS.buildDreadnought);
      push({
        id: "buildDreadnought", group: "build", enabled: dnEnabled,
        reason: dnEnabled ? undefined
          : homeReason ?? (dreadnoughtLocked ? bi(locale, "Dreadnought must have been played.", "需先打出“无畏舰”。") : spendReason(ACTION_COSTS.buildDreadnought)),
        // The button's label is the panel's English key; keep the printed name.
        run: () => doAction(() => moves.constructFleet(space, "dreadnought", false)),
      });
    }
    void homeKey;
    const fortPresent = G.spaces[space]?.fort !== undefined && G.spaces[space]?.fort !== null;
    const fortThisDecade = me.flags[`fort_${space}`] !== undefined;
    // A space id the map does not know has no region: treat it as a plain
    // refusal rather than crashing the whole Orders list.
    const fortReason = spaceDef === undefined ? bi(locale, "Fortresses can only be built on the map.", "只能在地图上的空间建造要塞。")
      : spaceDef.region !== "europe" ? bi(locale, "Forts can only be built in Europe.", "要塞只能在欧洲建造。")
      : fortPresent ? bi(locale, "This space already has a fort.", "此空间已有要塞。")
        : myForts >= 3 ? bi(locale, "Fort limit reached (3).", "已达要塞上限（3座）。")
          : fortThisDecade ? bi(locale, "A fort was built here this decade.", "本年代已在此建造要塞。") : null;
    const fortEnabled = fortReason === null && canSpend(ACTION_COSTS.buildFort);
    push({
      id: "buildFort", group: "build", enabled: fortEnabled,
      reason: fortEnabled ? undefined : fortReason ?? spendReason(ACTION_COSTS.buildFort),
      run: () => doAction(() => moves.buildFort(space, 1)),
    });
    const efEnabled = canSpend(ACTION_COSTS.buildEf);
    push({
      id: "buildEf", group: "build", enabled: efEnabled,
      reason: efEnabled ? undefined : spendReason(ACTION_COSTS.buildEf),
      run: () => doAction(() => moves.buildEf(space)),
    });
    if (selectedUnit !== null && selected?.kind === "expeditionary" && selected.owner === viewer && selected.space !== space) {
      const moveEnabled = canSpend(ACTION_COSTS.moveEf);
      push({
        id: "moveEf", group: "build", enabled: moveEnabled,
        reason: moveEnabled ? undefined : spendReason(ACTION_COSTS.moveEf),
        run: () => doAction(() => moves.buildEf(space, selectedUnit)),
      });
    }
  }

  // -------------------------------------------------------------- diplomacy
  {
    const state = G.spaces[space];
    const noLoc = !hasLoc(G, viewer, space);
    const influenced = me.flags.alreadyInfluenced === true;
    const influenceReason = !state ? null
      : noLoc ? bi(locale, "This space is outside your supply line.", "此空间超出你的补给线。")
        : state.control !== null ? bi(locale, "This space is already controlled.", "此空间已被控制。")
          : (state.influence ?? null) !== null ? bi(locale, "This space already has an influence marker.", "此空间已有影响标记。")
            : influenced ? bi(locale, "You already influenced this impulse.", "本行动轮已使用影响。") : null;
    const influenceEnabled = influenceReason === null && canSpend(ACTION_COSTS.influence);
    push({
      id: "influence", group: "diplomacy", enabled: influenceEnabled,
      reason: influenceEnabled ? undefined : influenceReason ?? spendReason(ACTION_COSTS.influence),
      run: () => doAction(() => moves.placeInfluence(space)),
    });
    const diplomacyReason = !state ? null
      : noLoc ? bi(locale, "This space is outside your supply line.", "此空间超出你的补给线。")
        : influenced ? bi(locale, "You already influenced this impulse.", "本行动轮已使用影响。")
          : state.diplomacy !== null ? bi(locale, "This space already has a diplomacy marker.", "此空间已有外交标记。")
            : state.control === null ? bi(locale, "The space must be controlled by a minor power.", "此空间需由小国控制。")
              : false ? "" : null;
    const diplomacyEnabled = diplomacyReason === null && canSpend(ACTION_COSTS.diplomacy);
    push({
      id: "diplomacy", group: "diplomacy", enabled: diplomacyEnabled,
      reason: diplomacyEnabled ? undefined : diplomacyReason ?? spendReason(ACTION_COSTS.diplomacy),
      run: () => doAction(() => moves.placeDiplomacy(space)),
    });
    const allyReason = !state ? null
      : state.diplomacy !== viewer ? bi(locale, "You need a diplomacy marker here first.", "需先在此放置外交标记。")
        : (state.ally ?? null) !== null ? bi(locale, "This space already has a minor ally.", "此空间已有小国盟友。")
          : myMinorAllies >= 5 ? bi(locale, "Minor ally limit reached (5).", "已达小国联盟上限（5）。") : null;
    const allyEnabled = allyReason === null && canSpend(ACTION_COSTS.minorAlliance);
    push({
      id: "minorAlliance", group: "diplomacy", enabled: allyEnabled,
      reason: allyEnabled ? undefined : allyReason ?? spendReason(ACTION_COSTS.minorAlliance),
      run: () => doAction(() => moves.minorAlliance(space)),
    });
    const state2 = G.spaces[space];
    const removeInfluenceReason = !state2 ? null
      : me.flags.alreadyRemovedInfluence === true ? bi(locale, "You already removed influence this impulse.", "本行动轮已移除影响。")
        : state2.influence !== viewer && state2.diplomacy !== viewer ? bi(locale, "No own marker here.", "此处无己方标记。") : null;
    const removeInfluenceEnabled = removeInfluenceReason === null && canSpend(ACTION_COSTS.removeInfluence);
    push({
      id: "removeInfluence", group: "diplomacy", enabled: removeInfluenceEnabled,
      reason: removeInfluenceEnabled ? undefined : removeInfluenceReason ?? spendReason(ACTION_COSTS.removeInfluence),
      run: () => doAction(() => moves.removeInfluence(space)),
    });
    const breakReason = state2 && state2.ally !== viewer ? bi(locale, "No minor ally of yours here.", "此处没有你的小国盟友。") : null;
    const breakEnabled = breakReason === null && canSpend(ACTION_COSTS.breakAlliance);
    push({
      id: "breakAlliance", group: "diplomacy", enabled: breakEnabled,
      reason: breakEnabled ? undefined : breakReason ?? spendReason(ACTION_COSTS.breakAlliance),
      run: () => doAction(() => moves.removeMinorAlliance(space)),
    });
    const pacifyCost = pacificationCost(G, viewer).cost;
    const pacifyReason = !state2 ? null
      : state2.influence !== viewer ? bi(locale, "You need your own influence marker here.", "此处需有己方影响标记。")
        : me.flags[`pacified_${space}`] !== undefined ? bi(locale, "Pacified here this decade already.", "本年代已在此绥靖。") : null;
    const pacifyEnabled = pacifyReason === null && canSpend(pacifyCost);
    push({
      id: "pacify", group: "diplomacy", enabled: pacifyEnabled,
      reason: pacifyEnabled ? undefined : pacifyReason ?? spendReason(pacifyCost),
      run: () => doAction(() => moves.pacify(space)),
    });
  }

  // ----------------------------------------------------------- move & battle
  const unitElsewhere = selectedUnit !== null && selected !== undefined && selected.space !== space;
  if (!gw && unitElsewhere && selected.owner === viewer) {
    const moveEnabled = canSpend(ACTION_COSTS.move);
    push({
      id: "move", group: "move", enabled: moveEnabled,
      reason: moveEnabled ? undefined : spendReason(ACTION_COSTS.move),
      run: () => doAction(() => selected.naval ? moves.navalMove([selected.id], space) : moves.redeploy(selected.id, space)),
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
            id: "gwNaval", group: "move", cost: ACTION_COSTS.gwNaval,
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
        : potentialLandTargets.length === 0 ? bi(locale, "No enemy army is adjacent.", "相邻空间没有敌军。")
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
  void onDeclareWar;
  void input.warCp;
  void input.canActionCard;

  return rows;
};
