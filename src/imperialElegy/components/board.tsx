import React from "react";
import {Ctx} from "boardgame.io";
import Button from "@mui/material/Button";
import {ImperialElegyState, PendingOption, Power, POWERS, SpaceId, Unit} from "../types";
import {SPACES, TSRR_ROUTE, isNavalBox, neighboursOf, portBoxes, spaceLabel} from "../constant/spaces";
import {POWER_DEFS} from "../constant/powers";
import {MINOR_POWER_HOMES} from "../constant/setup";
import {effectiveKeyType, friendlySpace, gwAllyImpulseFor, hasLoc, isArmyKind, isHomeSpace, landStackingLimit, landUnitsIn, minorAlliesOf, navalUnitsIn, ownsKey} from "../engine/rules";
import {CARD_BY_ID, cardById, decadeLabel} from "../engine/deck";
import {Decade} from "../constant/cards";
import {cpChainResolution} from "../engine/economy";
import {GOALS_BY_ID} from "../constant/goals";
import {IEMap} from "./map";
import {IEBadge, IEChip, IEPanel, IESurface} from "./theme";
import {ieT} from "./i18n";
import {logText} from "./logText";
import i18n from "../../constant/i18n";
import {
  BALANCE_OF_POWER_CARD,
  amphibiousAssaultCheck,
  navalInterceptCheck,
  navalTransportCheck,
  responseCardEligibility,
  type AmphibiousBlockReason,
  type NavalInterceptBlockReason,
  type NavalTransportBlockReason,
  type ResponseBlockReason,
} from "../moves";
import {planNavalTransport} from "../engine/navalMovement";
import {
  AU_NATIONALITIES,
  auIncorporateDecision,
  auRightsDecision,
  canGrantCitizenship,
  isCwArmySpace,
  jihadUse,
  passRestriction,
  superiorStaffWorkFreeDeploy,
  TSRR_RAIL_ARMY_KINDS,
  tsrrRail,
} from "../engine/characteristics";
import {polishController, polishRecruitDecision} from "../engine/poland";
import {eventPlayability, gwEventHint} from "../engine/playability";
import {deployReserveLimit, isLoneMinorWar, loneMinorDefender, rapidMobilizationFreeDeploy} from "../engine/limitedWar";
import {polishReserveDeployer} from "../engine/poland";
import {italyAllianceBox, italyAllianceSide} from "../engine/italyEntry";
import {isIndependentItaly} from "../engine/greatWarFlow";
import {treatyOptionLabel} from "../engine/treatyChoice";

const POWER_KEYS: Power[] = ["GE", "UK", "FR", "AU", "RU", "OT"];

const isPowerKey = (value: unknown): value is Power => typeof value === "string" && (POWER_KEYS as string[]).includes(value);

/** Bilingual helper for labels that have no key in i18n.ts yet. */
const bi = (locale: "en" | "zh_CN", en: string, zh: string): string => (locale === "zh_CN" ? zh : en);

/**
 * Pick the selector value: keep the current choice when it is legal, otherwise
 * fall back to the first legal option (or the first choice so its eligibility
 * reason is still visible when nothing is legal).
 */
const pickActionTarget = (current: string, choices: readonly string[], eligible: readonly string[]): string => {
  if (current !== "" && eligible.includes(current)) return current;
  if (eligible.length > 0) return eligible[0];
  if (current !== "" && choices.includes(current)) return current;
  return choices[0] ?? "";
};

const PROMPT_ZH: Record<string, string> = {
  "Declare supporting armies or pass": "宣布支援军团或跳过",
  "Play a combat card or continue": "打出战斗牌或继续",
  "Choose a space": "选择一个空间",
  "Choose a power": "选择一个国家",
  "Choose a player": "选择一名玩家",
  "Choose an event option": "选择一个事件选项",
  "Choose a unit to take a step loss": "选择承受步骤损失的的单位",
  "Decisive victory: take another land battle action or move one additional space for free": "决定性胜利：再发动一次陆战，或免费额外移动一格",
  "At Any Cost: discard a card to play it from the discard pile": "不惜一切：弃 1 张手牌以从弃牌堆打出",
  "Choose an option": "选择一个选项",
  "Draw three National Goals and keep one": "抽三张国家目标并保留一张",
  "Allocate influence": "分配影响力",
  "Roll on the Crisis Table": "在危机表上掷骰",
  "Choose a colonial space": "选择一个殖民空间",
  "Choose an African space": "选择一个非洲空间",
  "Shift your alliance marker": "移动你的联盟标记",
  "Give the card to the Ottomans or Russians": "将牌交给奥斯曼或俄国",
  "Declare war": "宣战",
  "Choose a minor power": "选择一个小国",
  "Choose a treaty option": "选择条约选项",
  "Choose a treaty space": "选择条约空间",
  "Colonial war: choose an unoccupied space to take": "殖民战争：选择一个无人占领的空间",
  "Colonial war: choose a unit to take the loss": "殖民战争：选择承受损失的单位",
  "Unstable Situation: discard a random card or take a -1 card marker": "动荡局势：随机弃 1 张牌或获得 -1 抽牌标记",
  "Neutral player: join an alliance or stay out": "中立国：加入同盟或保持中立",
  "Choose the alliance your neutral player joins": "选择你的中立国加入的同盟",
  "Choose the space for the free deploy reserves": "选择免费部署预备军的位置",
  "Choose the free redeployment destination": "选择免费重新部署的目的地",
  "Choose a unit for the free redeployment": "选择免费重新部署的单位",
  "Choose": "选择",
};

const BATTLE_STAGE: Record<string, {en: string; zh: string}> = {
  support: {en: "Support", zh: "支援"},
  cards: {en: "Combat cards", zh: "战斗牌"},
  roll: {en: "Roll", zh: "掷骰"},
  lossesAttack: {en: "Attacker losses", zh: "攻方损失"},
  lossesDefense: {en: "Defender losses", zh: "守方损失"},
  retreat: {en: "Retreat", zh: "撤退"},
  advance: {en: "Advance", zh: "推进"},
  done: {en: "Done", zh: "结束"},
};

const OPTION_ZH: Record<string, string> = {
  "No more support": "不再支援",
  "Continue": "继续",
  "Roll": "掷骰",
  "Pass": "跳过",
  // 8.2/8.6 alliance tracks and the Crisis Table's alliance result.
  "Triple Entente": "协约国",
  "Triple Alliance": "同盟国",
  "Neutral": "中立",
  // 19.2/19.1: the naval avoidance and interception windows.
  "Fight the naval battle": "进行海战",
  "Do not intercept": "不拦截",
  "Take no further space": "不再夺取空间",
};

/** Why the response button is disabled, in the player's language. */
const responseReasonText = (locale: "en" | "zh_CN", reason: ResponseBlockReason | undefined): string => {
  switch (reason) {
    case "no-seat":
      return bi(locale, "Only a seated player can respond.", "仅入座玩家可以打出响应。");
    case "pending":
      return bi(locale, "Resolve the pending decision first.", "请先处理待决事项。");
    case "phase":
      return bi(locale, "Responses are played at the start of an impulse.", "响应牌需在行动轮开始时打出。");
    case "not-active":
      return bi(locale, "Only the active power can play a response now.", "仅当前行动国家可以打出响应。");
    case "war-status":
      return bi(locale, "A limited-war response needs its printed alliance or maneuver step.", "有限战争响应需在其联盟或机动阶段打出。");
    case "no-gw":
      return bi(locale, "The Great War is not active.", "大战尚未开始。");
    case "battle":
      return bi(locale, "Finish the battle window first.", "请先处理战斗窗口。");
    case "cp-spent":
      return bi(locale, "A response must be played before CP is spent in the impulse.", "响应牌须在本次行动消耗 CP 之前打出。");
    case "battle-window-card":
      return bi(locale, "This card is played in the battle window.", "此牌需在战斗窗口打出。");
    case "war-only":
      return bi(locale, "This card can only be played during a limited war.", "此牌只能在有限战争期间打出。");
    case "gw-only":
      return bi(locale, "This card can only be played during the Great War.", "此牌只能在大战期间打出。");
    case "not-response":
      return bi(locale, "This is not a response card.", "此牌不是响应牌。");
    case "young-turks":
      return bi(locale, "The Young Turks has been played; this response is closed.", "“青年土耳其党”已打出，此响应窗口已关闭。");
    case "printed-power":
      return bi(locale, "This response can only be played at the start of the printed power's impulse.", "此响应牌只能在卡面指定国家的行动轮开始时打出。");
    case "no-effect-gw":
      return bi(locale, "This event has no effect during the Great War.", "此事件在大战期间无效。");
    case "not-a-card":
      return bi(locale, "Unknown card.", "未知卡牌。");
    default:
      return bi(locale, "A response is played at the start of an eligible impulse.", "响应牌需在符合条件的行动轮开始时打出。");
  }
};

/** Why the 12.3 transport button is disabled, in the player's language. */
const transportReasonText = (
  locale: "en" | "zh_CN",
  reason: NavalTransportBlockReason | undefined,
): string | undefined => {
  switch (reason) {
    case undefined:
      return undefined;
    case "busy":
      return bi(locale, "Resolve the pending decision or battle first.", "请先处理待决事项或战斗。");
    case "phase":
      return bi(locale, "Naval transport is only available in a maneuver impulse.", "海上运输仅在机动行动轮可用。");
    case "not-active":
      return bi(locale, "Only the active power may transport.", "仅当前行动国家可以进行海上运输。");
    case "no-budget":
      return bi(locale, "A naval movement action costs 1 CP.", "海上移动行动需要 1 CP。");
    case "land-unit":
      return bi(locale, "Choose one of your land units in the port or box.", "请选择港口或海域中的本国陆军单位。");
    case "land-kind":
      return bi(locale, "Only an army-type land unit can be carried by sea.", "只有军团类陆军单位可以随舰队海运。");
    case "naval-unit":
      return bi(locale, "The escorting naval units must all be yours.", "护航的海军单位必须全部属于你。");
    case "different-origin":
      return bi(locale, "The fleet and the land unit must start in the same space.", "舰队与陆军单位必须从同一空间出发。");
    case "origin-not-port":
      return bi(locale, "The land unit must start in a port or naval box.", "陆军单位必须从港口或海域出发。");
    case "origin-hostile":
      return bi(locale, "You cannot load transports in an enemy port.", "不能在敌方港口装载运输船。");
    case "same-space":
      return bi(locale, "The destination must be a different port.", "目的地必须是另一个港口。");
    case "target-not-port":
      return bi(locale, "The destination must be a coastal port.", "目的地必须是沿海港口。");
    case "target-hostile":
      return bi(locale, "Land units cannot land in an enemy port (19.10); use an amphibious assault.", "陆军不能登陆敌方港口（19.10），请使用两栖登陆。");
    case "path":
      return bi(locale, "No legal naval path with one NMP.", "在 1 个海军移动点内没有合法航线。");
    case "army-stacking":
      return bi(locale, "The destination would exceed the army stacking limit (5.5.3).", "目的地将超过陆军堆叠上限（5.5.3）。");
    case "port-capacity":
      return bi(locale, "The destination port would hold more than four naval units (5.5.4).", "目的地港口将超过 4 个海军单位上限（5.5.4）。");
    case "trench-exit":
      return bi(locale, "A unit leaving a trench battle space must first enter a friendly or trench space (28.1.5).", "离开战壕战空间的单位必须先进入友好或战壕空间（28.1.5）。");
    case "us-north-america":
      return bi(locale, "32.1: US armies cannot leave North America until the enemy-held Mexico/Canada gate is occupied.", "32.1：在占领敌方控制的墨西哥/加拿大之前，美军不能离开北美。");
    case "no-seat":
      return bi(locale, "Only a seated player may transport.", "仅入座玩家可以进行海上运输。");
    default:
      return bi(locale, "The naval transport is not legal.", "海上运输不合法。");
  }
};

const cardArt = (image?: string): string | undefined => (image ? `/imperial-elegy/${image}` : undefined);

/** Why the amphibious-assault button is disabled, in the player's language. */
const amphibiousReasonText = (
  locale: "en" | "zh_CN",
  check: {reason?: AmphibiousBlockReason; enemyNaval?: number; ownNaval?: number; needShips?: number; room?: number},
): string | undefined => {
  switch (check.reason) {
    case undefined:
      return undefined;
    case "no-seat":
      return bi(locale, "Only a seated player can launch an assault.", "仅入座玩家可以发动两栖突击。");
    case "not-active":
      return bi(locale, "Only the active power can launch an assault now.", "仅当前行动国家可以发动两栖突击。");
    case "phase":
      return bi(locale, "Amphibious assaults happen in the action or limited-war phase.", "两栖突击只能在行动阶段或有限战争阶段发动。");
    case "busy":
      return bi(locale, "Resolve the pending decision or battle first.", "请先处理待决事项或战斗。");
    case "no-cp":
      return bi(locale, "Needs 1 CP in this impulse.", "本行动轮需要 1 CP。");
    case "unit-count":
      return bi(locale, "Choose one or two loaded armies.", "请选择 1 至 2 个已装载军团。");
    case "target-port":
      return bi(locale, "The target must be an enemy coastal port.", "目标必须是敌方沿海港口。");
    case "target-friendly":
      return bi(locale, "That port is friendly; only enemy ports may be assaulted.", "该港口属于友方；只能突击敌方港口。");
    case "origin":
      return bi(locale, "Choose a friendly port or a naval box as the origin.", "请选择友方港口或海域作为出发地。");
    case "origin-not-adjacent":
      return bi(locale, "The origin is not adjacent to that port.", "出发地与目标港口不相邻。");
    case "army":
      return bi(locale, "Only your own land armies can land.", "只能装载本国陆军军团。");
    case "army-location":
      return bi(locale, "The armies must be loaded in the origin box or port.", "军团必须在出发海域或装载港口。");
    case "escort": {
      const need = check.needShips ?? (check.enemyNaval ?? 0) * 2;
      return bi(
        locale,
        `Enemy naval presence: ${check.enemyNaval ?? 0} ships. You need a 2:1 escort (${need} ships); you have ${check.ownNaval ?? 0}.`,
        `敌方海上力量：${check.enemyNaval ?? 0} 艘。需要 2:1 护航（${need} 艘），你现有 ${check.ownNaval ?? 0} 艘。`,
      );
    }
    case "landing-room":
      return bi(locale, "There is no landing room for another army in that port.", "该港口已无空间让军团登陆。");
    default:
      return bi(locale, "This assault is not legal.", "该两栖突击不合法。");
  }
};

/** Why the interception button is disabled, in the player's language. */
const interceptReasonText = (
  locale: "en" | "zh_CN",
  check: {reason?: NavalInterceptBlockReason; mover?: Power; ships?: number},
): string | undefined => {
  switch (check.reason) {
    case undefined:
      return undefined;
    case "no-seat":
      return bi(locale, "Only a seated player can intercept.", "仅入座玩家可以拦截。");
    case "busy":
      return bi(locale, "Resolve the pending decision or battle first.", "请先处理待决事项或战斗。");
    case "phase":
      return bi(locale, "Interception happens during an action, limited-war or GW maneuver phase.", "拦截只能发生在行动、有限战争或大战机动阶段。");
    case "port":
      return bi(locale, "Choose one of your ports and the adjacent naval box.", "请选择己方港口与其相邻海域。");
    case "port-not-adjacent":
      return bi(locale, "That port does not touch the naval box.", "该港口与目标海域不相邻。");
    case "not-owner":
      return bi(locale, "You must control the intercepting port.", "你必须控制拦截港口。");
    case "no-naval-move":
      return bi(locale, "There is no naval move to intercept.", "当前没有可拦截的海军移动。");
    case "not-defender":
      return bi(locale, "Only the defender can intercept the enemy's naval move.", "只有防御方可以拦截敌方的海军移动。");
    case "not-active":
      return bi(locale, "The intercepting window belongs to the mover's impulse.", "拦截窗口属于移动方的行动轮。");
    case "not-at-war":
      return bi(locale, "You are not at war with that power.", "你与该国不处于战争状态。");
    case "no-ships":
      return bi(locale, "No naval units are in the intercepting port.", "拦截港口内没有海军单位。");
    default:
      return bi(locale, "This interception is not legal.", "该拦截不合法。");
  }
};

const PHASE_LABEL = (t: ReturnType<typeof ieT>, phase: string): string => (t.phases as Record<string, string>)[phase] ?? phase;

const controlLabel = (t: ReturnType<typeof ieT>, control: string | null): string => {
  if (control === null) return "—";
  if ((POWER_KEYS as string[]).includes(control)) return t.seats[control as Power];
  return control;
};

/**
 * Names that are not a player seat but still appear as war defenders or as
 * 16.2.3 war-reparation marker holders: a non-player power's control id
 * (`IT`, a minor name) or the aggregated "German minors" group.
 */
const EXTRA_NON_PLAYER_LABELS: Record<string, {en: string; zh: string}> = {
  IT: {en: "Italy", zh: "意大利"},
  Italy: {en: "Italy", zh: "意大利"},
  US: {en: "United States", zh: "美国"},
  "United States": {en: "United States", zh: "美国"},
  Japan: {en: "Japan", zh: "日本"},
  "Qing China": {en: "Qing China", zh: "清帝国"},
  "German minors": {en: "the German minors", zh: "德意志诸小国"},
};

/**
 * Display name for a player power or a non-player power.  Rule 15.4.2 stores
 * the non-player's control id in `war.defender` (typed `Power`), so indexing
 * `t.seats` with it renders a blank name; map minors through their printed
 * home space (`MINOR_POWER_HOMES`) instead.  Player seats are unchanged.
 */
const powerOrMinorLabel = (
  t: ReturnType<typeof ieT>,
  locale: "en" | "zh_CN",
  id: string | null | undefined,
): string => {
  if (id === null || id === undefined || id === "") return "—";
  if (isPowerKey(id)) return t.seats[id];
  const extra = EXTRA_NON_PLAYER_LABELS[id];
  if (extra !== undefined) return bi(locale, extra.en, extra.zh);
  const home = MINOR_POWER_HOMES[id];
  if (home !== undefined && SPACES[home] !== undefined) return spaceLabel(home, locale);
  const def = (POWER_DEFS as Record<string, {name?: string; nameZh?: string}>)[id];
  if (def?.name !== undefined) return locale === "zh_CN" ? def.nameZh ?? def.name : def.name;
  return id;
};

const unitLabel = (u: Unit, t: ReturnType<typeof ieT>): string => {
  const base = u.kind === "army" ? "army" : u.kind === "reserveArmy" ? "R army" : u.kind === "eliteCorps" ? "EC" : u.kind === "expeditionary" ? "EF" : u.kind === "squadron" ? "Sq" : u.kind === "dreadnought" ? "Dn" : u.kind;
  return `${u.owner} ${base}${u.steps > 1 ? " · full" : " · reduced"}`;
};

const LogLine = ({entry, locale}: {entry: ImperialElegyState["log"][number]; locale: "en" | "zh_CN"}) => (
  <div><span className="t">T{entry.turn}</span>{logText(entry, locale)}</div>
);

export interface IEBoardProps {
  G: ImperialElegyState;
  ctx: Ctx;
  moves: Record<string, (...args: any[]) => void>;
  playerID: string | null;
  matchID?: string;
  hotseat?: boolean;
}

export const ImperialElegyBoard = ({G, ctx, moves, playerID, hotseat = false}: IEBoardProps) => {
  i18n.use();
  const t = ieT();
  const actualLocale: "en" | "zh_CN" = i18n.getLocaleName() === "en" ? "en" : "zh_CN";
  const decade = decadeLabel(G.decade as Decade);
  const viewer = playerID === null || playerID === undefined ? null : POWER_KEYS[Number(playerID)] ?? null;

  const [selected, setSelected] = React.useState<SpaceId | null>(null);
  const [selectedUnit, setSelectedUnit] = React.useState<string | null>(null);
  const [battleFrom, setBattleFrom] = React.useState<SpaceId | null>(null);
  const [navalFrom, setNavalFrom] = React.useState<SpaceId | null>(null);
  const [board, setBoard] = React.useState<"world" | "greatWar">("world");
  const [showCharts, setShowCharts] = React.useState(false);
  const [showHelp, setShowHelp] = React.useState(false);
  const [warAim, setWarAim] = React.useState<"conquest" | "liberation" | "unification">("conquest");
  const [warCp, setWarCp] = React.useState(2);
  const [secondObjective, setSecondObjective] = React.useState<SpaceId | "">("");
  const [mpitTarget, setMpitTarget] = React.useState<Power>(POWER_KEYS.find((p) => p !== viewer) ?? "AU");
  const [mpitTrack, setMpitTrack] = React.useState<"te" | "ta" | "neutral">("neutral");
  const [warAlly, setWarAlly] = React.useState<Power>(POWER_KEYS.find((p) => p !== viewer) ?? "UK");
  const [warMinor, setWarMinor] = React.useState<string>("");
  const [giveTarget, setGiveTarget] = React.useState<Power>(POWER_KEYS.find((p) => p !== viewer) ?? "UK");
  const [giveCardId, setGiveCardId] = React.useState<string>("");
  const [confirmSurrender, setConfirmSurrender] = React.useState(false);
  // 33.4 / 33.3 / 33.5 national-action selectors.  These mirror the pending
  // panel's pattern but the moves take a target directly, so the board keeps
  // the chosen nationality / space / army here.
  const [auReformTarget, setAuReformTarget] = React.useState<string>("");
  const [auCitizenTarget, setAuCitizenTarget] = React.useState<string>("");
  const [auIncorporateTarget, setAuIncorporateTarget] = React.useState<string>("");
  const [auSacrifice, setAuSacrifice] = React.useState(false);
  const [tsrrUnitId, setTsrrUnitId] = React.useState<string>("");
  const [tsrrTo, setTsrrTo] = React.useState<string>("");
  // 22.5(2): the controlling player may decline the extra Polish reserve army
  // that is otherwise deployed automatically with a deploy-reserves action.
  const [polishReserve, setPolishReserve] = React.useState(true);
  // 27.6 GW planning CP transfer: recipient and amount, gated by the engine.
  const [gwTransferTo, setGwTransferTo] = React.useState<string>("");
  const [gwTransferAmount, setGwTransferAmount] = React.useState(1);
  // 19.10 / 19.1 selectors: the amphibious origin/port/armies and the port the
  // defender picks when intercepting the last naval move.
  const [amphibiousFrom, setAmphibiousFrom] = React.useState<string>("");
  const [amphibiousTo, setAmphibiousTo] = React.useState<string>("");
  const [amphibiousUnitIds, setAmphibiousUnitIds] = React.useState<string[]>([]);
  // 12.3 naval transport: the loading port/box, the one land unit and the
  // friendly destination port.
  const [transportFrom, setTransportFrom] = React.useState<string>("");
  const [transportTo, setTransportTo] = React.useState<string>("");
  const [transportLand, setTransportLand] = React.useState<string>("");
  const [interceptPort, setInterceptPort] = React.useState<string>("");

  const me = viewer ? G.powers[viewer] : null;
  const phase = G.phase;
  const active = G.activePower;
  const isActive = viewer !== null && viewer === active;
  const eliminated = me?.eliminated === true;
  const pending = G.pending;
  const canDecide = pending !== null && viewer !== null && pending.power === viewer;
  const war = G.war;
  const gw = G.gw;
  const battle = G.battle;

  const warBelligerents = war
    ? [...new Set([war.attacker, war.defender, ...war.attackerAllies, ...war.defenderAllies])]
    : [];
  const isPrincipal = viewer !== null && war !== null && (viewer === war.attacker || viewer === war.defender);
  const isBelligerent = viewer !== null && warBelligerents.includes(viewer);

  const cpBudget = (): number => {
    if (viewer === null) return 0;
    if (phase === "action") return G.cpRemaining;
    if (phase === "wartime" && war) return war.budgets[viewer] ?? 0;
    if (phase === "gwManeuver") return G.powers[viewer].gwBudget ?? 0;
    return 0;
  };
  const canAct = viewer !== null && !eliminated && isActive && pending === null && (phase === "action" || phase === "wartime" || phase === "gwManeuver");
  const canSpend = (cost: number): boolean => canAct && cpBudget() >= cost;
  const canActionCard = viewer !== null && !eliminated && isActive && phase === "action" && pending === null;
  const canPhaseAct = viewer !== null && !eliminated && (phase === "end" || phase === "gwPlanning" ? true : isActive);
  // 12.0 / 27.3: cards such as A047 The Dual Monarchy and GW #10 Exhaustion
  // must be played, so the impulse cannot be passed away while they are held.
  // The card itself is still playable (even with CP banked), which is the
  // legal way out; ending the impulse stays available so the table never
  // depends on the forced card's exact position in the hand.
  const forcedPass = viewer !== null ? passRestriction(G, viewer).forced : false;
  const forcedCardIds = viewer !== null ? passRestriction(G, viewer).cards.map((c) => c.card) : [];
  const forcedGwCard = viewer !== null && phase === "gwManeuver" && G.powers[viewer].gwCard
    ? passRestriction(G, viewer, [G.powers[viewer].gwCard as string]).forced
    : false;
  const forcedPassTitle = bi(actualLocale,
    "A card in hand forbids passing (The Dual Monarchy / Exhaustion). Play it for CP or its event first.",
    "手中有禁止停牌的牌（二元君主国 / 精疲力竭）。请先作为 CP 或事件打出。");
  const hasPhaseButtons = viewer !== null && !eliminated && ((phase === "prep" || phase === "diplomacy") ? canPhaseAct : phase === "action" ? isActive : phase === "end" ? canPhaseAct : false);

  // ------------------------------------------------------------- 33.x national actions
  const nationalActionPhase = viewer !== null && !eliminated && isActive && phase === "action" && pending === null;
  const auRightsEligible = nationalActionPhase && viewer === "AU"
    ? AU_NATIONALITIES.filter((nationality) => auRightsDecision(G, nationality).allowed)
    : [];
  const auReformValue = nationalActionPhase && viewer === "AU"
    ? pickActionTarget(auReformTarget, AU_NATIONALITIES, auRightsEligible)
    : "";
  const auReformDecision = auReformValue !== "" ? auRightsDecision(G, auReformValue) : null;
  const auCitizenEligible = nationalActionPhase && viewer === "AU"
    ? AU_NATIONALITIES.filter((nationality) => canGrantCitizenship(G, "AU", nationality, {sacrificeStability: auSacrifice}).allowed)
    : [];
  const auCitizenValue = nationalActionPhase && viewer === "AU"
    ? pickActionTarget(auCitizenTarget, AU_NATIONALITIES, auCitizenEligible)
    : "";
  const auCitizenDecision = auCitizenValue !== ""
    ? canGrantCitizenship(G, "AU", auCitizenValue, {sacrificeStability: auSacrifice})
    : null;
  const auIncorporateCandidates = nationalActionPhase && viewer === "AU"
    ? Object.values(SPACES)
        .filter((space) => {
          const control = G.spaces[space.id]?.control;
          return typeof control === "string" && !isPowerKey(control) && G.spaces[space.id]?.ally === "AU";
        })
        .map((space) => space.id)
    : [];
  const auIncorporateEligible = auIncorporateCandidates.filter((space) => auIncorporateDecision(G, space).allowed);
  const auIncorporateValue = nationalActionPhase && viewer === "AU"
    ? pickActionTarget(auIncorporateTarget, auIncorporateCandidates, auIncorporateEligible)
    : "";
  const auIncorporate = auIncorporateValue !== "" ? auIncorporateDecision(G, auIncorporateValue) : null;
  const zouaveInPlay = Object.values(G.units).some((unit) => unit.kind === "zouave" && unit.owner === "FR");
  const zouaveReason = zouaveInPlay
    ? bi(actualLocale, "The Zouaves are already in play.", "祖阿夫已在场上。")
    : cpBudget() < 1
      ? bi(actualLocale, "Needs 1 CP in this impulse.", "本行动轮需要 1 CP。")
      : undefined;
  // 33.5 also applies during a limited war (RU's own or an ally's impulse).
  const tsrrPhase = viewer !== null && !eliminated && isActive && (phase === "action" || phase === "wartime") && pending === null;
  const tsrrArmies = tsrrPhase && viewer !== null
    ? Object.values(G.units).filter((unit) => unit.owner === viewer && TSRR_RAIL_ARMY_KINDS.includes(unit.kind) && unit.space && TSRR_ROUTE.includes(unit.space))
    : [];
  const tsrrUnitValue = tsrrPhase && viewer !== null
    ? pickActionTarget(tsrrUnitId, tsrrArmies.map((unit) => unit.id), tsrrArmies.map((unit) => unit.id))
    : "";
  const tsrrFrom = tsrrUnitValue !== "" ? G.units[tsrrUnitValue]?.space ?? null : null;
  const tsrrDestinations = tsrrFrom !== null ? TSRR_ROUTE.filter((space) => space !== tsrrFrom) : [];
  const tsrrToValue = tsrrFrom !== null ? pickActionTarget(tsrrTo, tsrrDestinations, tsrrDestinations) : "";
  const tsrrDecision = tsrrUnitValue !== "" && tsrrToValue !== ""
    ? tsrrRail(G, viewer as Power, tsrrUnitValue, tsrrToValue)
    : null;
  const showNationalActions = viewer !== null && (
    (nationalActionPhase && (viewer === "FR" || viewer === "AU" || viewer === "RU")) || tsrrArmies.length > 0
  );
  const needsCp = (cost: number): string => bi(actualLocale, `Needs ${cost} CP in this impulse.`, `本行动轮需要 ${cost} CP。`);
  const auReformReason = auReformDecision === null
    ? undefined
    : auReformDecision.allowed !== true
      ? auReformDecision.reasons.join(" | ")
      : cpBudget() < 3 ? needsCp(3) : undefined;
  const auCitizenReason = auCitizenDecision === null
    ? undefined
    : auCitizenDecision.allowed !== true
      ? auCitizenDecision.reasons.join(" | ")
      : cpBudget() < 3 ? needsCp(3) : undefined;
  const auIncorporateReason = auIncorporate === null
    ? bi(actualLocale, "No allied minor power is eligible.", "没有符合条件的盟国小国。")
    : auIncorporate.allowed !== true
      ? auIncorporate.reasons.join(" | ")
      : cpBudget() < 3 ? needsCp(3) : undefined;
  const tsrrReason = tsrrArmies.length === 0
    ? bi(actualLocale, "No army is on the Trans-Siberian Railroad.", "西伯利亚铁路上没有军团。")
    : tsrrDecision !== null && tsrrDecision.allowed !== true
      ? tsrrDecision.reasons.join(" | ")
      : undefined;
  const jihadDecision = battle !== null ? jihadUse(G, "OT", battle) : null;
  const jihadReason = jihadDecision !== null && jihadDecision.allowed !== true
    ? jihadDecision.reasons.join(" | ")
    : undefined;
  // 12.8 / 22.5: the player allied to independent Poland may build Polish
  // armies (in a Polish space) and reserve armies (into the holding box).
  const polishOwner = viewer === null ? null : polishController(G);
  const polishArmyDecision = viewer !== null && selected !== null && phase === "action" && polishOwner === viewer
    ? polishRecruitDecision(G, viewer, "army", selected, 2)
    : null;
  const polishReserveDecision = viewer !== null && phase === "action" && polishOwner === viewer
    ? polishRecruitDecision(G, viewer, "reserveArmy", null, 2)
    : null;

  // ------------------------------------------------------- 19.10 / 19.1 naval controls
  // The interception window is reactive: it is keyed to the last log entry, so
  // it disappears as soon as the mover (or anyone else) acts again.
  const lastLog = G.log[G.log.length - 1];
  const lastNavalBox: SpaceId | null = (() => {
    if (!lastLog || lastLog.turn !== G.turn) return null;
    // 19.1 only applies to a naval move into a box; a move into a port has no
    // interception window.
    const destination = (): SpaceId | null => {
      if (lastLog.key === "navalMove" && typeof lastLog.args?.to === "string") return lastLog.args.to as SpaceId;
      if (lastLog.key === "gwManeuverAction" && lastLog.args?.kind === "naval" && typeof lastLog.args?.to === "string") {
        return lastLog.args.to as SpaceId;
      }
      return null;
    };
    const box = destination();
    return box !== null && isNavalBox(box) ? box : null;
  })();
  const lastNavalMover: Power | null = lastNavalBox !== null && lastLog?.power !== undefined ? lastLog.power : null;

  const amphibiousVisible = viewer !== null && !eliminated && (phase === "action" || phase === "wartime") && pending === null;
  const ownLoadedArmyAt = (space: SpaceId): boolean =>
    G.spaces[space]?.units.some((id) => {
      const unit = G.units[id];
      return unit !== undefined && unit.owner === viewer && isArmyKind(unit.kind) && !unit.naval;
    }) ?? false;
  const amphibiousOrigins: SpaceId[] = !amphibiousVisible || viewer === null
    ? []
    : Object.values(SPACES)
        .filter((def) => {
          if (!ownLoadedArmyAt(def.id)) return false;
          if (isNavalBox(def.id)) return true;
          return (def.ports?.length ?? 0) > 0 && friendlySpace(G, def.id, viewer);
        })
        .map((def) => def.id);
  const amphibiousFromValue = pickActionTarget(amphibiousFrom, amphibiousOrigins, amphibiousOrigins);
  const amphibiousTargets: SpaceId[] = (() => {
    if (!amphibiousVisible || viewer === null || amphibiousFromValue === "") return [];
    const boxes = isNavalBox(amphibiousFromValue) ? [amphibiousFromValue] : portBoxes(amphibiousFromValue);
    return Object.values(SPACES)
      .filter((def) => !isNavalBox(def.id) && (def.ports?.length ?? 0) > 0)
      .filter((def) => (def.ports ?? []).some((box) => boxes.includes(box)))
      .filter((def) => !friendlySpace(G, def.id, viewer))
      .map((def) => def.id);
  })();
  const amphibiousToValue = pickActionTarget(amphibiousTo, amphibiousTargets, amphibiousTargets);
  const amphibiousBox: SpaceId | null = (() => {
    if (amphibiousFromValue === "" || amphibiousToValue === "") return null;
    if (isNavalBox(amphibiousFromValue)) {
      return portBoxes(amphibiousToValue).includes(amphibiousFromValue) ? amphibiousFromValue : null;
    }
    return portBoxes(amphibiousFromValue).find((box) => portBoxes(amphibiousToValue).includes(box)) ?? null;
  })();
  const amphibiousArmies: string[] = amphibiousBox === null || viewer === null
    ? []
    : Object.values(G.units)
        .filter((unit) => unit.owner === viewer && !unit.naval && isArmyKind(unit.kind) && (unit.space === amphibiousBox || unit.space === amphibiousFromValue))
        .map((unit) => unit.id);
  const chosenAmphibiousArmies = amphibiousUnitIds.filter((id) => amphibiousArmies.includes(id));
  // Default to the first two loaded armies so the control is usable without a
  // click; 19.10 caps a landing at two armies.
  const amphibiousArmyValue = chosenAmphibiousArmies.length > 0
    ? chosenAmphibiousArmies.slice(0, 2)
    : amphibiousArmies.slice(0, 2);
  const amphibiousCheck = amphibiousVisible && viewer !== null
    ? amphibiousAssaultCheck(G, viewer, amphibiousFromValue, amphibiousToValue, amphibiousArmyValue)
    : null;
  const amphibiousPhaseOk = phase === "action" ? isActive : phase === "wartime" ? isBelligerent : false;
  const amphibiousReason = amphibiousCheck === null
    ? undefined
    : amphibiousOrigins.length === 0
      ? bi(actualLocale, "No friendly army is loaded in a port or naval box.", "没有已装载于港口或海域的友方军团。")
      : amphibiousReasonText(actualLocale, amphibiousCheck);
  const amphibiousCanGo = amphibiousCheck?.ok === true && amphibiousPhaseOk;
  const toggleAmphibiousArmy = (id: string, checked: boolean): void => {
    const base = amphibiousArmyValue;
    const next = checked
      ? (base.includes(id) ? base : [...base, id]).slice(0, 2)
      : base.filter((entry) => entry !== id);
    setAmphibiousUnitIds(next);
  };

  // ------------------------------------------------------- 12.3 naval transport
  const transportVisible = viewer !== null && !eliminated && pending === null && battle === null &&
    (phase === "action" || phase === "wartime" || phase === "gwManeuver");
  // A US/Italian GW impulse moves that major's units (26.3); the player at the
  // seat commands them, so they must be selectable here too.
  const transportMajor = viewer !== null ? gwAllyImpulseFor(G, viewer) : null;
  const transportOwns = (owner: string | undefined): boolean =>
    viewer !== null && (owner === viewer || (transportMajor !== null && owner === transportMajor));
  const transportable = (id: string): boolean => {
    const unit = G.units[id];
    return unit !== undefined && transportOwns(unit.owner) && unit.naval !== true && isArmyKind(unit.kind) && Boolean(unit.space);
  };
  const transportOrigins: SpaceId[] = !transportVisible || viewer === null
    ? []
    : [...new Set(Object.values(G.units).filter((unit) => transportable(unit.id)).map((unit) => unit.space as SpaceId))]
        .filter((space) => G.spaces[space] && (isNavalBox(space) || portBoxes(space).length > 0))
        .sort();
  const transportFromValue = pickActionTarget(transportFrom, transportOrigins, transportOrigins);
  const transportLands = transportFromValue === "" || viewer === null
    ? []
    : Object.values(G.units).filter((unit) => transportable(unit.id) && unit.space === transportFromValue).map((unit) => unit.id);
  const transportLandValue = pickActionTarget(transportLand, transportLands, transportLands);
  const transportFleet = transportFromValue === "" || viewer === null
    ? []
    : Object.values(G.units)
        .filter((unit) => transportOwns(unit.owner) && unit.naval === true && unit.space === transportFromValue)
        .map((unit) => unit.id);
  const transportReachableFrom = (target: SpaceId): boolean =>
    viewer !== null && transportLandValue !== "" &&
    planNavalTransport(
      G,
      viewer,
      G.units[transportLandValue],
      transportFleet.map((id) => G.units[id]),
      target,
    ).ok;
  const transportTargets: SpaceId[] = !transportVisible || viewer === null || transportLandValue === ""
    ? []
    : Object.values(SPACES)
        .filter((def) => !isNavalBox(def.id) && (def.ports?.length ?? 0) > 0 && def.id !== transportFromValue)
        .filter((def) => transportReachableFrom(def.id))
        .map((def) => def.id);
  const transportToValue = pickActionTarget(transportTo, transportTargets, transportTargets);
  const transportCheck = transportVisible && viewer !== null
    ? navalTransportCheck(G, viewer, transportLandValue, transportFleet, transportToValue)
    : null;
  const transportPhaseOk = phase === "action" ? isActive
    : phase === "wartime" ? isActive && war?.status === "maneuver"
      : phase === "gwManeuver" ? isActive
        : false;
  const transportReason = transportCheck === null
    ? undefined
    : transportOrigins.length === 0
      ? bi(actualLocale, "No land unit is in a friendly port or naval box.", "没有位于友好港口或海域的陆军单位。")
      : transportTargets.length === 0
        ? bi(actualLocale, "No friendly port is reachable with this force.", "该部队没有可抵达的友好港口。")
        : transportReasonText(actualLocale, transportCheck.reason);
  const transportCanGo = transportCheck?.ok === true && transportPhaseOk;

  const adjacentPortsToBox: SpaceId[] = lastNavalBox === null
    ? []
    : Object.values(SPACES).filter((def) => (def.ports ?? []).includes(lastNavalBox)).map((def) => def.id);
  const ownAdjacentPorts = viewer === null ? [] : adjacentPortsToBox.filter((id) => friendlySpace(G, id, viewer));
  const interceptPorts = ownAdjacentPorts.length > 0 ? ownAdjacentPorts : adjacentPortsToBox;
  const interceptPortValue = pickActionTarget(interceptPort, interceptPorts, interceptPorts);
  const interceptCheck = lastNavalBox !== null
    ? navalInterceptCheck(G, viewer, interceptPortValue, lastNavalBox)
    : null;
  const interceptReason = interceptCheck === null ? undefined : interceptReasonText(actualLocale, interceptCheck);
  const interceptVisible = lastNavalBox !== null && viewer !== null && !eliminated;

  React.useEffect(() => { (window as any).__IE_STATE__ = G; }, [G]);
  React.useEffect(() => { setSecondObjective(""); setConfirmSurrender(false); }, [selected]);
  React.useEffect(() => { setConfirmSurrender(false); }, [war?.status, war?.attacker, war?.defender]);
  React.useEffect(() => { setBattleFrom(null); setNavalFrom(null); setSelectedUnit(null); }, [phase]);

  const selectedSpace = selected ? SPACES[selected] : null;
  const selectedState = selected ? G.spaces[selected] : null;
  const selectedUnitDef = selectedUnit ? G.units[selectedUnit] : undefined;
  const ownUnitsInSelected = selectedState
    ? selectedState.units.map((id) => G.units[id]).filter((u): u is Unit => u !== undefined && viewer !== null && u.owner === viewer)
    : [];
  const ownLandInSelected = ownUnitsInSelected.filter((u) => !u.naval);
  const ownNavalInSelected = ownUnitsInSelected.filter((u) => u.naval);

  const enemyLandTargetsFrom = (from: SpaceId | null): SpaceId[] => {
    if (!from || viewer === null) return [];
    return neighboursOf(from).filter((id) => {
      const state = G.spaces[id];
      if (!state) return false;
      if (friendlySpace(G, id, viewer)) return false;
      return state.units.some((uid) => {
        const u = G.units[uid];
        return u !== undefined && !u.naval && u.owner !== viewer;
      });
    });
  };
  const enemyNavalTargetsFrom = (from: SpaceId | null): SpaceId[] => {
    if (!from || viewer === null) return [];
    return neighboursOf(from).filter((id) => {
      const state = G.spaces[id];
      if (!state) return false;
      return state.units.some((uid) => {
        const u = G.units[uid];
        return u !== undefined && u.naval === true && u.owner !== viewer;
      });
    });
  };
  const potentialLandTargets = enemyLandTargetsFrom(selected);
  const potentialNavalTargets = enemyNavalTargetsFrom(selected);

  const unitMoveTargets: SpaceId[] = (() => {
    if (!selectedUnitDef || !selectedUnitDef.space || viewer === null || selectedUnitDef.owner !== viewer) return [];
    return neighboursOf(selectedUnitDef.space).filter((id) => {
      const state = G.spaces[id];
      if (!state) return false;
      if (selectedUnitDef.naval) return true;
      return friendlySpace(G, id, viewer) || (state.influence === viewer && state.control === null);
    });
  })();

  const pendingSpaceTargets: SpaceId[] = canDecide && pending
    ? pending.options.filter((o) => SPACES[o.id]).map((o) => o.id as SpaceId)
    : [];
  const battleTargets = [...enemyLandTargetsFrom(battleFrom), ...enemyNavalTargetsFrom(navalFrom)];

  const myOnMapArmies = viewer === null ? 0 : Object.values(G.units).filter((u) => u.owner === viewer && isArmyKind(u.kind) && u.space).length;
  const myForts = viewer === null ? 0 : Object.values(G.spaces).filter((s) => s.fort?.power === viewer).length;
  const myMinorAllies = viewer === null ? 0 : Object.values(G.spaces).filter((s) => s.ally === viewer).length;

  const hand = viewer ? G.powers[viewer].hand : [];
  const handCounts = (G as unknown as {handCounts?: Partial<Record<Power, number>>}).handCounts ?? {};
  const goalCounts = (G as unknown as {goalCounts?: Partial<Record<Power, number>>}).goalCounts ?? {};

  const onSelect = (id: SpaceId) => {
    if (battleFrom) {
      if (canSpend(1)) doAction(() => moves.landBattle(battleFrom, id));
      setBattleFrom(null);
      return;
    }
    if (navalFrom) {
      if (canSpend(1)) doAction(() => moves.navalBattle(navalFrom, id));
      setNavalFrom(null);
      return;
    }
    if (canDecide && pending && pending.options.some((o) => o.id === id && SPACES[o.id])) {
      doAction(() => moves.resolvePending(id));
      return;
    }
    if (selectedUnitDef && selectedUnitDef.owner === viewer && selectedUnitDef.space && selectedUnitDef.space !== id) {
      // 27.5: a GW land move is a march or a rail move, so the destination is
      // recorded and the action panel offers both printed actions.  Naval GW
      // moves and the other phases keep their single move action.
      if (phase === "gwManeuver" && !selectedUnitDef.naval) {
        setSelected(id);
        return;
      }
      if (canSpend(1)) {
        if (selectedUnitDef.naval) doAction(() => moves.navalMove([selectedUnitDef.id], id));
        else doAction(() => moves.redeploy(selectedUnitDef.id, id));
      }
      setSelectedUnit(null);
      setSelected(id);
      return;
    }
    setSelected(id);
    setSelectedUnit(null);
  };

  const doAction = (fn: () => void) => {
    try {
      fn();
    } catch (error) {
      // The server rejects illegal moves; the UI simply keeps its current state.
      console.warn("illegal Imperial Elegy action", error);
    }
  };

  const pendingKindLabels = t.pendingKind as unknown as Record<string, string>;
  const pendingKind = pending ? pendingKindLabels[pending.kind] ?? t.pendingDecision : null;
  const pendingPrompt = pending ? (actualLocale === "zh_CN" ? PROMPT_ZH[pending.prompt] ?? pending.prompt : pending.prompt) : "";
  const optionLabel = (o: PendingOption): string => {
    if (o.secret) return t.hidden;
    // Engine-supplied bilingual text (treaties, Militarism, manpower, losses,
    // colonial transfers) takes precedence over the static fallback map.
    if (actualLocale === "zh_CN" && o.labelZh !== undefined && o.labelZh !== "") return o.labelZh;
    if (o.id === "done") return o.label === "No more support" ? bi(actualLocale, "No more support", "不再支援") : t.skip;
    const optionCard = typeof o.data?.card === "string" ? o.data.card : null;
    if (optionCard && CARD_BY_ID[optionCard]) {
      const c = CARD_BY_ID[optionCard];
      return `${actualLocale === "zh_CN" ? c.titleZh : c.title} (${bi(actualLocale, "discard", "弃牌")})`;
    }
    if (o.id.startsWith("battle:") || o.id.startsWith("move:")) {
      const target = o.id.slice(o.id.indexOf(":") + 1);
      if (SPACES[target]) {
        const prefix = o.id.startsWith("battle:")
          ? bi(actualLocale, "Another battle", "再战")
          : bi(actualLocale, "Move one space", "移动一格");
        return `${prefix}: ${spaceLabel(target, actualLocale)}`;
      }
    }
    if (SPACES[o.id]) return spaceLabel(o.id, actualLocale);
    if (G.units[o.id]) return unitLabel(G.units[o.id], t);
    if (o.label.startsWith("Play ") && CARD_BY_ID[o.label.slice(5)]) {
      const c = CARD_BY_ID[o.label.slice(5)];
      return `${t.cardType.combat}: ${actualLocale === "zh_CN" ? c.titleZh : c.title}`;
    }
    return actualLocale === "zh_CN" ? OPTION_ZH[o.label] ?? o.label : o.label;
  };
  const canDecline = canDecide && pending !== null && pending.kind !== "combatLosses" && pending.kind !== "combatCard" && pending.kind !== "combatDiscard" && pending.kind !== "decisiveBattle";

  const warStatusLabels: Record<string, string> = {
    warAim: t.warAim,
    alliance: t.warAlliance,
    shift: bi(actualLocale, "Alliance shift", "同盟转换"),
    initiative: bi(actualLocale, "Initiative", "先手"),
    maneuver: t.warManeuver,
    victory: t.warVictory,
    demobilization: t.demobilization,
    done: t.done,
  };
  const warStatusLabel = war ? warStatusLabels[war.status] ?? war.status : "";
  const warAimLabel = (aim: string | null): string =>
    aim === "conquest" ? t.conquest : aim === "liberation" ? t.liberation : aim === "unification" ? t.unification : "—";
  const callableAllies = war && viewer !== null
    ? POWER_KEYS.filter((p) => p !== viewer && !warBelligerents.includes(p) && (handCounts[p] ?? G.powers[p].hand.length) > 0)
    : [];
  const warAllyValue = callableAllies.includes(warAlly) ? warAlly : callableAllies[0];
  // Rule 14.0: a primary belligerent may call its own minor allies into the war
  // for free during the alliance step.
  const callableMinors = war && viewer !== null && (viewer === war.attacker || viewer === war.defender)
    ? minorAlliesOf(G, viewer).filter((minor) =>
      MINOR_POWER_HOMES[minor] !== undefined &&
      !war.attackerMinors.includes(minor) &&
      !war.defenderMinors.includes(minor))
    : [];
  const warMinorValue = pickActionTarget(warMinor, callableMinors, callableMinors);
  const warBudgetRows = war
    ? [...new Set([war.attacker, war.defender, ...war.attackerAllies, ...war.defenderAllies])].filter(isPowerKey)
    : [];
  // Rule 15.4.2: the lone non-player defender is already the defender name;
  // don't repeat it as a minor ally.  Player wars keep their minor allies.
  const warDefenderMinors = war
    ? [...new Set(war.defenderMinors.filter((m) => m !== war.defender && m !== loneMinorDefender(war)))]
    : [];
  // 16.2.3: war-reparation card markers awarded to a non-player power (players
  // track theirs on the power display; minors have no display of their own).
  const minorMarkerRows = Object.entries(G.minorCardMarkers ?? {})
    .filter(([, count]) => count !== 0)
    .sort(([a], [b]) => a.localeCompare(b));

  const warTargetControl = selectedState && isPowerKey(selectedState.control) && selectedState.control !== viewer ? selectedState.control : null;
  const targetControlledSpaces = warTargetControl
    ? Object.values(SPACES).filter((sp) => G.spaces[sp.id]?.control === warTargetControl && sp.id !== selected).map((sp) => sp.id)
    : [];
  const canDeclareWar = canActionCard && war === null && G.wtt < 3 && warTargetControl !== null && G.cpRemaining >= warCp;

  const gwOrderPowers = gw
    ? gw.order.map((slot) => (isPowerKey(slot) ? slot : null)).filter((p): p is Power => p !== null)
    : [];
  const gwBudgetOrder = [...new Set([...gwOrderPowers, ...POWER_KEYS])];
  const gwSlotLabel = (slot: Power | "bonus" | "IT" | "US" | null): string => {
    if (slot === null) return "—";
    if (slot === "bonus") return bi(actualLocale, "Bonus", "奖励");
    if (isPowerKey(slot)) return t.seats[slot];
    if (slot === "IT") {
      // 25.3: an Italy that entered on its own still fights under its own flag.
      return isIndependentItaly(G) ? bi(actualLocale, "Italy (its own)", "意大利（自主）") : bi(actualLocale, "Italy", "意大利");
    }
    return bi(actualLocale, "US", "美国");
  };
  // 25.3: a unified Italy's Alliance Track chit decides how it enters at the outbreak.
  const italyBox = italyAllianceBox(G);
  const italySide = italyAllianceSide(G);
  const italyBoxLabel = italyBox === "neutral"
    ? bi(actualLocale, "neutral box", "中立框")
    : `${italySide === "te" ? "TE" : "TA"} ${italyBox.endsWith("Committed") ? bi(actualLocale, "committed", "承诺框") : bi(actualLocale, "aligned", "倾向框")}`;
  const italyShowing = G.persistent.italyUnified === true && gw !== undefined;
  const italyHow = italyBox === "neutral"
    ? bi(actualLocale, "stays out of the war (25.3)", "不参战（25.3）")
    : italyBox.endsWith("Committed")
      ? bi(actualLocale, "joins automatically at the outbreak (25.3)", "大战爆发时自动参战（25.3）")
      : bi(actualLocale, "roll 4–6 at the outbreak, else back to neutral (25.3)", "爆发时掷 4–6 参战，否则退回中立（25.3）");
  const canGwDraft = selected !== null && viewer !== null && me !== null && phase === "gwManeuver" && isActive && pending === null && !eliminated && (me.gwBudget ?? 0) >= 1 && me.manpower >= 1;
  // 27.5.2 GW deploy reserves: a controlled home key with stacking room, no
  // trench battle marker and an army in the reserve box.
  const gwDeployRoom = selected !== null && selectedState !== null && selectedState !== undefined
    ? Math.max(0, landStackingLimit(selected) - landUnitsIn(G, selected).filter((u) => isArmyKind(u.kind)).length)
    : 0;
  const canGwDeployHere = Boolean(
    viewer !== null && me !== null && selected !== null && selectedState && phase === "gwManeuver" &&
    isActive && pending === null && !eliminated && (me.gwBudget ?? 0) >= 1 && me.reserves.length > 0 &&
    gwDeployRoom > 0 && !isNavalBox(selected) && friendlySpace(G, selected, viewer) &&
    (isHomeSpace(G, selected, viewer) || ownsKey(G, selected, viewer)) && !selectedState.trench,
  );
  // 27.6: CP may only move between allies during planning, once per donor.
  const gwSideAllies: Power[] = viewer === null || !gw
    ? []
    : (gw.te.includes(viewer) ? gw.te : gw.ta.includes(viewer) ? gw.ta : [])
        .filter((power) => power !== viewer && G.powers[power]?.eliminated !== true);
  const gwTransferToValue: string = gwSideAllies.includes(gwTransferTo as Power)
    ? (gwTransferTo as Power)
    : gwSideAllies[0] ?? "";
  const gwTransferAmountValue = Number.isFinite(gwTransferAmount) ? Math.max(1, Math.floor(gwTransferAmount)) : 1;
  const canGwTransfer = Boolean(
    viewer !== null && me !== null && gw !== null && phase === "gwPlanning" && isActive && pending === null &&
    !eliminated && gwTransferToValue !== "" && gwTransferAmountValue <= (me.gwBudget ?? 0) &&
    me.flags.gwCpTransferDone !== true,
  );
  // 15.2.2: a GW joint naval operation moves one contingent from each of two
  // allied powers that start together.  The selected own ship supplies the
  // origin; every naval unit that ally has in that box joins the operation.
  const gwJointNavalAllies: Power[] = (() => {
    if (viewer === null || !gw || phase !== "gwManeuver" || !selectedUnitDef || !selectedUnitDef.naval ||
      selectedUnitDef.owner !== viewer || !selectedUnitDef.space) return [];
    const side = gw.te.includes(viewer) ? gw.te : gw.ta.includes(viewer) ? gw.ta : [];
    return side.filter((ally) =>
      ally !== viewer &&
      G.powers[ally]?.eliminated !== true &&
      navalUnitsIn(G, selectedUnitDef.space!).some((unit) => unit.owner === ally),
    );
  })();
  const gwJointNavalUnitIds = (ally: Power): string[] =>
    selectedUnitDef?.space
      ? navalUnitsIn(G, selectedUnitDef.space).filter((unit) => unit.owner === ally).map((unit) => unit.id)
      : [];
  // 26.1: a held GW-03/04/06 combat card may be revealed faceup.
  const gwCardId = me?.gwCard === undefined || me?.gwCard === null ? "" : String(me.gwCard);
  const gwCombatCardHeld = ["IE-GW-03", "IE-GW-04", "IE-GW-06"].includes(gwCardId);
  const gwCardAlreadyFaceup = gwCombatCardHeld && String(me?.flags.gwFaceupCombat ?? "").includes(gwCardId);
  const canGwReveal = Boolean(
    viewer !== null && !eliminated && pending === null && me !== null && gwCombatCardHeld && !gwCardAlreadyFaceup &&
    (phase === "gwPlanning" || phase === "gwManeuver"),
  );
  // 33.1 Superior Staff Work and A063 both grant one free deploy reserves action.
  const deployFree = viewer !== null && phase === "wartime" && (
    rapidMobilizationFreeDeploy(G, viewer, war) || superiorStaffWorkFreeDeploy(G, viewer, war)
  );
  const deployLimit = viewer !== null ? deployReserveLimit(G, viewer, war) : 0;
  const deployRoom = selected !== null
    ? Math.max(0, (SPACES[selected]?.home === "OT" ? 2 : SPACES[selected]?.region === "europe" ? 3 : 2) - (selectedState ? landUnitsIn(G, selected).filter((u) => isArmyKind(u.kind)).length : 0))
    : 0;
  const canDeployHere = Boolean(
    viewer !== null && me !== null && selected !== null && selectedState &&
    phase === "wartime" && isActive && pending === null && !eliminated &&
    me.reserves.length > 0 && deployRoom > 0 && deployLimit > 0 &&
    (deployFree || cpBudget() >= 1) &&
    SPACES[selected]?.submap === "main" &&
    (selectedState.control === viewer || selectedState.occupiedBy === viewer) &&
    hasLoc(G, viewer, selected, {landOnly: true}),
  );

  const renderCard = (id: string) => {
    const card = cardById(id);
    const isMandatory = card.type === "mandatory" || card.type === "mandatoryResponse";
    const saved = String(me?.flags.savedCards ?? "").split(",").filter(Boolean).includes(id);
    const cpAllowed = !isMandatory && card.type !== "response" && card.type !== "combat";
    // A41 is printed with a second, normal-event mode ("This can also be played
    // as a standard event during your impulse").
    const eventAllowed = (card.type !== "response" && card.type !== "combat") || card.id === "IE-A041";
    const homeOk = card.kind !== "home" || me?.selectedHomeCard === card.id;
    // A no-pass card may be spent on top of banked CP (12.0): otherwise it can
    // be the only legal move left and the impulse would have no exit.
    const rescueOk = forcedCardIds.includes(id) && cpAllowed;
    const cpModeOk = canActionCard && cpAllowed && (G.cpRemaining === 0 || rescueOk) && homeOk;
    // The printed "Playable if/after" condition uses the same predicate as the
    // engine, so a disabled button and a rejected move always agree.
    const eventGate = eventAllowed && viewer !== null ? eventPlayability(G, viewer, id) : null;
    const eventBlockReason = eventGate !== null && !eventGate.ok ? t.playBlock[eventGate.reason!] : undefined;
    const eventModeOk = canActionCard && eventAllowed && G.cpRemaining === 0 && (eventGate === null || eventGate.ok);
    const responseEligible = card.type === "response" ? responseCardEligibility(G, viewer, id) : null;
    const responseOk = responseEligible?.ok === true;
    const responseReason = responseEligible && !responseEligible.ok
      ? responseReasonText(actualLocale, responseEligible.reason)
      : undefined;
    // Responses normally belong to the active player's impulse; during the
    // limited-war alliance step every participating belligerent may answer.
    // Spectators and non-belligerents never get an actionable control.
    const showResponse = card.type === "response" && viewer !== null && (
      phase === "action" ? isActive
        : phase === "wartime" ? isBelligerent && (isActive || war?.status === "alliance")
          : phase === "gwManeuver" ? isActive
            : false
    );
    const industOk = canActionCard && me !== null && me.industryCard === null && card.kind !== "home" && !isMandatory;
    const chainOk = canActionCard && me !== null && me.cpChain.length < 2;
    const saveOk = viewer !== null && (phase === "action" || phase === "end") && card.kind !== "home" && !isMandatory;
    return (
      <article key={id} className="ie-card" data-testid={`ie-card-${id}`}>
        <div className="ie-card-cp">{card.cp}</div>
        <div className="ie-card-type">{t.cardType[card.type] ?? card.type}</div>
        {cardArt(card.image) ? <img src={cardArt(card.image)} alt={card.title}/> : <div style={{padding: "18px 8px", background: "#3a2f24", color: "#f0dfba", minHeight: 180}}><strong>{card.title}</strong><div style={{fontSize: 10, marginTop: 6}}>{card.text}</div></div>}
        <div className="ie-card-body">
          <div className="ie-card-title">{actualLocale === "zh_CN" ? card.titleZh : card.title}</div>
          <div>{card.text}</div>
          <div className="ie-card-zh">{card.textZh}</div>
        </div>
        <div className="ie-card-actions">
          <button disabled={!cpModeOk} title={!cpModeOk ? bi(actualLocale, "Requires your impulse and no CP left in it.", "需在你的行动轮且当前无剩余 CP。") : undefined} onClick={() => doAction(() => moves.playCard(id, "cp"))}>{t.cpMode}</button>
          <button data-testid={`ie-play-event-${id}`} disabled={!eventModeOk} data-blocked={eventBlockReason ? eventGate?.reason : undefined} title={!eventModeOk ? (eventBlockReason ?? bi(actualLocale, "Events are played at the start of your impulse.", "事件需在你的行动轮开始时打出。")) : undefined} onClick={() => doAction(() => moves.playCard(id, "event"))}>{t.eventMode}</button>
          {showResponse && <button data-testid={`ie-response-${id}`} disabled={!responseOk} title={!responseOk ? responseReason : undefined} onClick={() => doAction(() => moves.playResponseCard(id))}>{t.playResponse}</button>}
          <button disabled={!industOk} onClick={() => doAction(() => moves.industrialize(id))}>{t.industrialize}</button>
          <button disabled={!chainOk} onClick={() => doAction(() => moves.cpChain(id))}>{t.cpChain}</button>
          <button disabled={!saveOk} aria-pressed={saved} onClick={() => doAction(() => moves.saveCard(id))}>{saved ? t.unsave : t.saveCard}</button>
        </div>
      </article>
    );
  };

  const actionGroup = (key: string, title: string, children: React.ReactNode) => {
    const content = React.Children.toArray(children);
    if (content.length === 0) return null;
    return (
      <div className="ie-action-group" data-testid={`ie-actions-${key}`}>
        <div className="ie-action-group-title">{title}</div>
        <div className="ie-actions-grid">{content}</div>
      </div>
    );
  };

  const homeCardTitle = (id: string): string => {
    const card = CARD_BY_ID[id];
    return card ? (actualLocale === "zh_CN" ? card.titleZh : card.title) : id;
  };
  const saveList = String(me?.flags.savedCards ?? "").split(",").filter(Boolean);
  const ngChoices = String(me?.flags.ngChoices ?? "").split(",").filter(Boolean);
  const giveCards = hand.filter((id) => cardById(id).kind !== "home");
  const giveCardValue = giveCards.includes(giveCardId) ? giveCardId : giveCards[0] ?? "";
  const giveTargets = POWER_KEYS.filter((p) => p !== viewer);

  const responseInHand = hand.some((id) => cardById(id).type === "response");
  const responseWindow = viewer !== null && responseInHand &&
    hand.some((id) => cardById(id).type === "response" && responseCardEligibility(G, viewer, id).ok);

  // 12.14 — the CP chain funds one fresh impulse this action phase, once.
  const chainInfo = viewer !== null && me !== null ? cpChainResolution(G, viewer) : null;
  const chainUsed = G.flags.cpChainSpent === true;
  const chainNonEmpty = me !== null && me.cpChain.length > 0;
  const chainReady = viewer !== null && me !== null && !eliminated && isActive && phase === "action" &&
    pending === null && G.cpRemaining === 0 && chainNonEmpty && !chainUsed && (chainInfo?.cpSpendable ?? 0) > 0;
  const chainSpendable = chainInfo?.cpSpendable ?? 0;
  const chainCap = chainInfo?.singleActionCap ?? 4;
  const chainDisabledReason = chainReady ? undefined
    : !chainNonEmpty ? bi(actualLocale, "No cards in the CP chain.", "CP 链中没有牌。")
      : chainUsed ? bi(actualLocale, "Already used this action phase.", "本行动阶段已使用。")
        : phase !== "action" ? bi(actualLocale, "Only usable during the action phase.", "仅在行动阶段可用。")
          : !isActive || eliminated ? bi(actualLocale, "Only the active power can use its CP chain.", "仅当前行动国家可使用 CP 链。")
            : pending !== null ? bi(actualLocale, "Resolve the pending decision first.", "请先处理待决事项。")
              : G.cpRemaining > 0 ? bi(actualLocale, "Finish this impulse first; the chain starts a fresh one.", "请先结束本次行动；CP 链需从新的行动开始。")
                : chainSpendable <= 0 ? bi(actualLocale, "The chained cards have no CP.", "CP 链中的牌没有 CP。")
                  : bi(actualLocale, "Not available now.", "当前不可用。");
  const mapHint = pendingSpaceTargets.length > 0
    ? bi(actualLocale, "Click a highlighted space to answer the pending decision.", "点击高亮空间以完成待决事项。")
    : battleFrom !== null
      ? bi(actualLocale, "Click a highlighted adjacent space to attack it.", "点击高亮的相邻空间发动进攻。")
      : navalFrom !== null
        ? bi(actualLocale, "Click a highlighted adjacent sea space to fight there.", "点击高亮的相邻海域发动海战。")
        : selectedUnitDef
          ? bi(actualLocale, "Click a highlighted space to move the selected unit there.", "点击高亮空间移动所选单位。")
          : bi(actualLocale, "Click a space; select one of your units to see its legal moves.", "点击空间；选择己方单位以查看合法移动。");

  return (
    <IESurface className="ie-board">
      <header className="ie-header">
        <div>
          <h1 className="ie-title">{t.title}</h1>
          <div className="ie-sub">{t.subtitle} · {t.turn} {G.turn} · {bi(actualLocale, decade.en, decade.zh)}</div>
        </div>
        <div className="ie-status">
          <IEBadge tone={active.toLowerCase()}>{t.active}: {t.seats[active]}</IEBadge>
          <IEBadge>{PHASE_LABEL(t, phase)}</IEBadge>
          <IEBadge tone={G.wtt >= 4 ? "warn" : "default"}>{t.wtt}: {G.wtt}/5</IEBadge>
          <IEBadge>{t.cp}: {G.cpRemaining}</IEBadge>
          {G.gw?.active && <IEBadge tone="warn">GW {G.gw.turn}</IEBadge>}
          {battle && <IEBadge tone="warn">{bi(actualLocale, battle.kind === "naval" ? "Naval battle" : "Land battle", battle.kind === "naval" ? "海战" : "陆战")}</IEBadge>}
          {pending && <IEBadge tone="warn">{t.pending}: {t.seats[pending.power]}</IEBadge>}
          {responseWindow && <IEBadge tone="warn">{t.responseWindow}</IEBadge>}
          {viewer && <IEBadge tone={viewer.toLowerCase()}>{t.seats[viewer]}</IEBadge>}
          {!viewer && <IEBadge>{t.spectators}</IEBadge>}
          <Button size="small" variant="outlined" onClick={() => setShowCharts((v) => !v)}>{t.charts}</Button>
          <Button size="small" variant="outlined" onClick={() => setShowHelp((v) => !v)}>{t.rulesCoverage}</Button>
        </div>
      </header>

      <div className="ie-layout">
        <div>
          <IEPanel
            title={<span>{board === "greatWar" ? t.greatWarMap : t.map} · {selected ? spaceLabel(selected!, actualLocale) : t.selectSpace}</span>}
            actions={<div className="ie-tabs" role="tablist">
              <button role="tab" aria-selected={board === "world"} onClick={() => setBoard("world")}>{t.map}</button>
              <button role="tab" aria-selected={board === "greatWar"} onClick={() => setBoard("greatWar")}>{t.greatWarMap}</button>
            </div>}
          >
            <IEMap G={G} selected={selected} onSelect={onSelect} locale={actualLocale} board={board}
              moveTargets={unitMoveTargets}
              battleTargets={battleTargets}
              legalTargets={pendingSpaceTargets}
            />
            <div className="ie-map-key">
              <span className="ie-key legal">{bi(actualLocale, "Legal target", "合法目标")}</span>
              <span className="ie-muted">{mapHint}</span>
            </div>
          </IEPanel>

          <div className="ie-two-col">
            <IEPanel title={t.selectSpace}>
              {!selectedSpace || !selectedState ? <div className="ie-muted">{t.noSpace}</div> : (
                <div className="ie-space-detail" data-testid="ie-space-detail">
                  <h4>{actualLocale === "zh_CN" ? selectedSpace.nameZh : selectedSpace.name} <span className="ie-muted">({selectedSpace.type})</span></h4>
                  <div><strong>{t.control}:</strong> {controlLabel(t, selectedState.control)} · <strong>{t.influence}:</strong> {controlLabel(t, selectedState.influence ?? null)} · <strong>{t.diplomacy}:</strong> {controlLabel(t, selectedState.diplomacy ?? null)} · <strong>{t.ally}:</strong> {controlLabel(t, selectedState.ally ?? null)}</div>
                  <div><strong>{t.fort}:</strong> {selectedState.fort ? `${selectedState.fort.level} (${selectedState.fort.power})` : "—"} · <strong>{t.pacification}:</strong> {selectedState.pacification ?? 0} · <strong>{t.rebellion}:</strong> {selectedState.rebellion ? `${selectedState.rebellion.minor} (${selectedState.rebellion.step})` : "—"}</div>
                  {selectedSpace.ports?.length ? <div><strong>{t.ports}:</strong> {selectedSpace.ports.map((p) => spaceLabel(p, actualLocale)).join(", ")}</div> : null}
                  {effectiveKeyType(G, selected!) !== undefined && (
                    <div data-testid="ie-space-key-type">
                      <strong>{t.keyType}:</strong>{" "}
                      {effectiveKeyType(G, selected!) === "colonial" ? t.keyTypeColonial : t.keyTypeTerritorial}
                      {selectedState.keyTypeOverride !== undefined && selectedState.keyTypeOverride !== selectedSpace.keyType
                        ? ` (${bi(actualLocale, "changed in play", "游戏中变更")})`
                        : ""}
                    </div>
                  )}
                  <div><strong>{t.connections}:</strong> {neighboursOf(selected!).map((id) => spaceLabel(id, actualLocale)).join(", ")}</div>
                  {viewer && me && <div><strong>{t.supply}:</strong> {hasLoc(G, viewer, selected!) ? t.inSupply : t.outOfSupply}</div>}
                  <div className="ie-space-units"><strong>{t.units}:</strong> {selectedState.units.length === 0 ? "—" : selectedState.units.map((id) => {
                    const u = G.units[id];
                    if (!u) return null;
                    const mine = viewer !== null && u.owner === viewer;
                    const isPendingUnit = canDecide && pending !== null && pending.options.some((o) => o.id === id);
                    if (!mine) return <span key={id} className={`ie-unit-chip${isPendingUnit ? " pending" : ""}`}>{unitLabel(u, t)}</span>;
                    if (isPendingUnit) return <button key={id} className="ie-btn secondary selected" aria-pressed onClick={() => doAction(() => moves.resolvePending(id))}>{unitLabel(u, t)}</button>;
                    return <button key={id} data-testid={`ie-unit-${id}`} className="ie-btn secondary" aria-pressed={selectedUnit === id} onClick={() => setSelectedUnit(id)}>{unitLabel(u, t)}</button>;
                  })}</div>
                  {selectedUnitDef && selectedUnitDef.owner === viewer && (
                    <div className="ie-hint">
                      {bi(actualLocale, "Selected:", "已选：")} {unitLabel(selectedUnitDef, t)}
                      {selectedUnitDef.space && selectedUnitDef.space !== selected && <span> · {bi(actualLocale, "click a highlighted space to move here.", "点击高亮空间移动至此。")}</span>}
                      <button className="ie-btn secondary ie-mini" onClick={() => setSelectedUnit(null)}>{t.cancel}</button>
                    </div>
                  )}

                  {canAct && (
                    <div className="ie-action-groups">
                      {actionGroup("recruit", bi(actualLocale, "Recruit", "征募"), [
                        <button key="army" className="ie-btn" disabled={!canSpend(1) || !me || viewer === null || !isHomeSpace(G, selected!, viewer) || !ownsKey(G, selected!, viewer) || myOnMapArmies >= me.manpower || me.flags.noBuildArmiesThisImpulse === true} onClick={() => doAction(() => moves.recruit(selected!, "army", 1))}>{t.recruitArmy}</button>,
                        // 33.2.1 CW army: Great War only, in Australia/New Zealand or Canada.
                        viewer === "UK"
                          ? <button key="cw" className="ie-btn" disabled={!canSpend(1) || !me || phase !== "gwManeuver" || !isCwArmySpace(selected) || me.flags.noBuildArmiesThisImpulse === true || (me.secondaryManpower ?? 0) <= 0} onClick={() => doAction(() => moves.recruit(selected!, "army", 1, {cw: true}))}>{bi(actualLocale, "CW army", "自治领军")}</button>
                          : null,
                        <button key="reserve" className="ie-btn" disabled={!canSpend(1) || !me || viewer === "UK" || me.reserves.length >= me.industry} onClick={() => doAction(() => moves.recruit(selected!, "reserveArmy", 1))}>{t.recruitReserve}</button>,
                        <button key="ec" className="ie-btn" disabled={!canSpend(2) || viewer === null || !landUnitsIn(G, selected!).some((u) => isArmyKind(u.kind) && (u.owner === viewer || G.spaces[selected!].ally === viewer))} onClick={() => doAction(() => moves.recruit(selected!, "eliteCorps", 1))}>{t.recruitEc}</button>,
                        // 12.8 / 22.5: build the allied minor power's units.
                        polishArmyDecision !== null
                          ? <button key="polishArmy" data-testid="ie-polish-army" className="ie-btn" disabled={polishArmyDecision.allowed !== true || !canSpend(polishArmyDecision.cost)} title={polishArmyDecision.allowed ? undefined : polishArmyDecision.reasons.join(" | ")} onClick={() => doAction(() => moves.polishRecruit("army", selected!, 2))}>{bi(actualLocale, `Polish army (${polishArmyDecision.cost} CP)`, `波兰军团（${polishArmyDecision.cost} CP）`)}</button>
                          : null,
                        polishReserveDecision !== null
                          ? <button key="polishReserve" data-testid="ie-polish-reserve" className="ie-btn secondary" disabled={polishReserveDecision.allowed !== true || !canSpend(polishReserveDecision.cost)} title={polishReserveDecision.allowed ? undefined : polishReserveDecision.reasons.join(" | ")} onClick={() => doAction(() => moves.polishRecruit("reserveArmy", null, 2))}>{bi(actualLocale, `Polish reserve (${polishReserveDecision.cost} CP)`, `波兰预备军（${polishReserveDecision.cost} CP）`)}</button>
                          : null,
                      ])}
                      {actionGroup("build", bi(actualLocale, "Build", "建造"), [
                        portBoxes(selected!).length > 0 ? <button key="sq" className="ie-btn" disabled={!canSpend(2) || !me || viewer === null || !isHomeSpace(G, selected!, viewer) || !ownsKey(G, selected!, viewer)} onClick={() => doAction(() => moves.constructFleet(selected!, "squadron", false))}>{t.buildSquadron}</button> : null,
                        portBoxes(selected!).length > 0 ? <button key="dn" className="ie-btn" disabled={!canSpend(3) || !me || viewer === null || !isHomeSpace(G, selected!, viewer) || !ownsKey(G, selected!, viewer) || (G.persistent.dreadnoughts !== true && !me.flags.navalLimit)} onClick={() => doAction(() => moves.constructFleet(selected!, "dreadnought", false))}>{t.buildDreadnought}</button> : null,
                        <button key="fort" className="ie-btn" disabled={!canSpend(1) || !me || selectedSpace.region !== "europe" || !!selectedState.fort || myForts >= 3 || !!me.flags[`fort_${selected}`]} onClick={() => doAction(() => moves.buildFort(selected!, 1))}>{t.buildFort}</button>,
                        <button key="ef" className="ie-btn" disabled={!canSpend(2)} onClick={() => doAction(() => moves.buildEf(selected!))}>{t.buildEf}</button>,
                        selectedUnitDef && selectedUnitDef.kind === "expeditionary" && selectedUnitDef.owner === viewer && selectedUnitDef.space !== selected
                          ? <button key="efmove" className="ie-btn secondary" disabled={!canSpend(1)} onClick={() => doAction(() => moves.buildEf(selected!, selectedUnitDef.id))}>{bi(actualLocale, "Move selected EF here", "移动所选远征军至此")}</button>
                          : null,
                      ])}
                      {actionGroup("diplomacy", bi(actualLocale, "Diplomacy & influence", "外交与影响"), [
                        <button key="inf" className="ie-btn" disabled={!canSpend(1) || !me || me.flags.alreadyInfluenced === true || selectedState.control !== null || (selectedState.influence ?? null) !== null || viewer === null || !hasLoc(G, viewer, selected!)} onClick={() => doAction(() => moves.placeInfluence(selected!))}>{t.placeInfluence}</button>,
                        <button key="dip" className="ie-btn" disabled={!canSpend(1) || !me || me.flags.alreadyInfluenced === true || selectedState.diplomacy !== null || selectedState.control === null || isPowerKey(selectedState.control) || viewer === null || !hasLoc(G, viewer, selected!)} onClick={() => doAction(() => moves.placeDiplomacy(selected!))}>{t.placeDiplomacy}</button>,
                        <button key="ally" className="ie-btn" disabled={!canSpend(3) || viewer === null || selectedState.diplomacy !== viewer || (selectedState.ally ?? null) !== null || myMinorAllies >= 5} onClick={() => doAction(() => moves.minorAlliance(selected!))}>{t.minorAlliance}</button>,
                        <button key="uninf" className="ie-btn secondary" disabled={!canSpend(1) || !me || me.flags.alreadyRemovedInfluence === true || viewer === null || (selectedState.influence !== viewer && selectedState.diplomacy !== viewer)} onClick={() => doAction(() => moves.removeInfluence(selected!))}>{bi(actualLocale, "Remove influence", "移除影响")}</button>,
                        <button key="unally" className="ie-btn secondary" disabled={!canSpend(4) || viewer === null || selectedState.ally !== viewer} onClick={() => doAction(() => moves.removeMinorAlliance(selected!))}>{bi(actualLocale, "Break minor alliance", "解除小国联盟")}</button>,
                        <button key="pacify" className="ie-btn" disabled={!canSpend(1) || !me || viewer === null || selectedState.influence !== viewer || !!me.flags[`pacified_${selected}`]} onClick={() => doAction(() => moves.pacify(selected!))}>{t.pacify}</button>,
                      ])}
                      {actionGroup("move", bi(actualLocale, "Move & battle", "移动与战斗"), [
                        selectedUnitDef && selectedUnitDef.owner === viewer && selectedUnitDef.space !== selected && phase !== "gwManeuver"
                          ? <button key="move" className="ie-btn" disabled={!canSpend(1)} onClick={() => doAction(() => selectedUnitDef.naval ? moves.navalMove([selectedUnitDef.id], selected!) : moves.redeploy(selectedUnitDef.id, selected!))}>{t.moveHere}</button>
                          : null,
                        selectedUnitDef && selectedUnitDef.owner === viewer && selectedUnitDef.space !== selected && phase === "gwManeuver" && selectedUnitDef.naval
                          ? <button key="gwnaval" className="ie-btn" disabled={!canSpend(1)} onClick={() => doAction(() => moves.navalMove([selectedUnitDef.id], selected!))}>{t.moveHere}</button>
                          : null,
                        selectedUnitDef && selectedUnitDef.owner === viewer && selectedUnitDef.space !== selected && phase === "gwManeuver" && selectedUnitDef.naval
                          ? gwJointNavalAllies.map((ally) => (
                              <button
                                key={`gwjoint-${ally}`}
                                data-testid={`ie-gw-joint-naval-${ally}`}
                                className="ie-btn secondary"
                                disabled={!canSpend(1)}
                                title={bi(actualLocale, "15.2.2: move one contingent from each allied power together.", "15.2.2：两国各派一支分舰队联合行动。")}
                                onClick={() => doAction(() => moves.gwJointNaval(ally, [selectedUnitDef.id], gwJointNavalUnitIds(ally), selected!))}
                              >
                                {bi(actualLocale, `Joint naval with ${t.seats[ally]}`, `与${t.seats[ally]}联合海军`)}
                              </button>
                            ))
                          : null,
                        selectedUnitDef && selectedUnitDef.owner === viewer && selectedUnitDef.space !== selected && phase === "gwManeuver" && !selectedUnitDef.naval
                          ? <React.Fragment key="gwmove">
                              <button data-testid="ie-gw-march" className="ie-btn" disabled={!canSpend(1)} onClick={() => doAction(() => moves.gwMarch(selectedUnitDef.id, selected!))}>{t.gwMarch}</button>
                              <button data-testid="ie-gw-rail" className="ie-btn secondary" disabled={!canSpend(1)} onClick={() => doAction(() => moves.gwRail(selectedUnitDef.id, selected!))}>{t.gwRail}</button>
                            </React.Fragment>
                          : null,
                        selectedUnitDef && selectedUnitDef.owner === viewer && selectedUnitDef.steps < 2 && phase === "gwManeuver"
                          ? <button key="refit" className="ie-btn" disabled={!canSpend(1)} onClick={() => doAction(() => moves.gwRefit(selectedUnitDef.id))}>{bi(actualLocale, "Refit selected unit (GW)", "整补所选单位（大战）")}</button>
                          : null,
                        // 33.2 Rapid Deployment: the UK's one free naval move per war.
                        viewer === "UK" && me?.rapidDeployment && !me.rapidDeployment.spent
                          && selectedUnitDef && selectedUnitDef.owner === "UK" && selectedUnitDef.naval && selectedUnitDef.space !== selected
                          && (phase === "wartime" || phase === "gwManeuver")
                          ? <button key="rapid" className="ie-btn secondary" onClick={() => doAction(() => moves.rapidDeploy([selectedUnitDef.id], selected!))}>{bi(actualLocale, "Rapid Deployment (free naval move)", "快速部署（免费海军移动）")}</button>
                          : null,
                        viewer === "UK" && me?.rapidDeployment && !me.rapidDeployment.spent && (phase === "wartime" || phase === "gwManeuver")
                          ? <button key="rapidDecline" className="ie-btn secondary" onClick={() => doAction(() => moves.declineRapidDeployment())}>{bi(actualLocale, "Decline Rapid Deployment", "放弃快速部署")}</button>
                          : null,
                        phase === "wartime" && me && me.reserves.length > 0
                          ? <React.Fragment key="deploy">
                              <button className="ie-btn" disabled={!canDeployHere} onClick={() => doAction(() => moves.deployReserves(selected!, deployLimit, {polishReserve}))}>{t.deployReserves}{deployFree ? bi(actualLocale, " (free)", "（免费）") : ""}</button>
                              {polishReserveDeployer(G) === viewer && (
                                <label className="ie-inline ie-check" data-testid="ie-polish-reserve-toggle" title={bi(actualLocale, "22.5(2): a deploy-reserves action may also deploy one Polish reserve army.", "22.5(2)：部署预备军行动可额外部署 1 支波兰预备军。")}>
                                  <input type="checkbox" checked={polishReserve} onChange={(e) => setPolishReserve(e.target.checked)} />
                                  {bi(actualLocale, "Also deploy 1 Polish reserve army", "同时部署 1 支波兰预备军")}
                                </label>
                              )}
                            </React.Fragment>
                          : null,
                        <button key="land" className="ie-btn secondary" disabled={!canSpend(1) || ownLandInSelected.length === 0 || potentialLandTargets.length === 0} onClick={() => { setNavalFrom(null); setBattleFrom(selected); }}>{t.battleHere}</button>,
                        <button key="naval" className="ie-btn secondary" disabled={!canSpend(1) || ownNavalInSelected.length === 0 || potentialNavalTargets.length === 0} onClick={() => { setBattleFrom(null); setNavalFrom(selected); }}>{t.navalBattle}</button>,
                      ])}
                      {canAct && phase === "gwManeuver" && actionGroup("gw", bi(actualLocale, "Great War", "大战"), [
                        <button key="draft" className="ie-btn" disabled={!canGwDraft} onClick={() => doAction(() => moves.gwDraft(selected!))}>{t.gwDraft}</button>,
                        <button key="deploy" data-testid="ie-gw-deploy-action" className="ie-btn" title={bi(actualLocale, "Deploy one reserve army here (27.5).", "在此部署一支预备军（27.5）。")} disabled={!canGwDeployHere} onClick={() => doAction(() => moves.gwDeploy(selected!))}>{t.gwDeploy}</button>,
                      ])}
                    </div>
                  )}

                  {canAct && (battleFrom !== null || navalFrom !== null) && (
                    <div className="ie-target-hint" data-testid="ie-target-hint">
                      <strong>{battleFrom ?? navalFrom}</strong>: {bi(actualLocale, "choose a highlighted adjacent target space on the map.", "在地图上选择高亮的相邻目标空间。")}
                      <button className="ie-btn secondary ie-mini" onClick={() => { setBattleFrom(null); setNavalFrom(null); }}>{t.cancel}</button>
                    </div>
                  )}

                  {canActionCard && war === null && warTargetControl !== null && (
                    <div className="ie-war-declare" data-testid="ie-war-declare">
                      <div className="ie-action-group-title">{t.declareWar}</div>
                      <div className="ie-inline">
                        <IEBadge tone={warTargetControl.toLowerCase()}>{t.target}: {t.seats[warTargetControl]}</IEBadge>
                        <select className="ie-select" value={warAim} onChange={(e) => setWarAim(e.target.value as typeof warAim)} title={t.warAim}>
                          <option value="conquest">{t.conquest}</option>
                          <option value="liberation">{t.liberation}</option>
                          <option value="unification">{t.unification}</option>
                        </select>
                        <select className="ie-select" value={warCp} onChange={(e) => setWarCp(Number(e.target.value))} title={t.cp}>
                          {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} CP</option>)}
                        </select>
                        {targetControlledSpaces.length > 0 && (
                          <select className="ie-select" value={secondObjective} onChange={(e) => setSecondObjective(e.target.value as SpaceId | "")} title={t.objectives}>
                            <option value="">{bi(actualLocale, "One objective", "单一目标")}</option>
                            {targetControlledSpaces.map((id) => <option key={id} value={id}>{spaceLabel(id, actualLocale)}</option>)}
                          </select>
                        )}
                        <button className="ie-btn" disabled={!canDeclareWar} onClick={() => doAction(() => moves.declareWar(warTargetControl, warAim, secondObjective ? [selected!, secondObjective] : [selected!], warCp))}>{t.declareWar}</button>
                      </div>
                      {G.wtt >= 3 && <div className="ie-hint">{bi(actualLocale, "World Tension is 3+; a new war cannot be declared.", "世界紧张达到 3+，无法发动新的战争。")}</div>}
                      {!canDeclareWar && G.wtt < 3 && <div className="ie-hint">{bi(actualLocale, `Needs ${warCp} CP in this impulse.`, `本行动轮需要 ${warCp} CP。`)}</div>}
                    </div>
                  )}
                </div>
              )}
            </IEPanel>

            <IEPanel title={t.pending} actions={pendingKind ? <IEBadge tone="warn">{pendingKind}</IEBadge> : undefined}>
              {!pending ? <div className="ie-muted">{t.noPending}</div> : (
                <div className="ie-pending" data-testid="ie-pending">
                  <h4>{canDecide ? t.yourDecision : `${t.waitingFor}: ${t.seats[pending.power]}`}</h4>
                  <div className="ie-pending-kind" data-testid="ie-pending-kind">{pendingKind} · {t.pendingFor}: {t.seats[pending.power]}</div>
                  <div className="ie-pending-prompt">{pendingPrompt}</div>
                  {canDecide ? (
                    <>
                      <div className="ie-section-title">{t.pendingOptions}</div>
                      <div className="ie-pending-options">
                        {pending.options.map((o) => (
                          <button key={o.id} data-testid={`ie-pending-option-${o.id}`} onClick={() => doAction(() => moves.resolvePending(o.id))}>{optionLabel(o)}</button>
                        ))}
                        {canDecline && <button className="ie-btn secondary" onClick={() => doAction(() => moves.declinePending())}>{t.decline}</button>}
                      </div>
                    </>
                  ) : <div className="ie-muted" style={{marginTop: 6}}>{t.waitingOther}</div>}
                  {canDecide && pendingSpaceTargets.length > 0 && <div className="ie-hint">{bi(actualLocale, "The matching spaces are highlighted on the map.", "对应空间已在地图上高亮。")}</div>}
                </div>
              )}
              {battle && (
                <div className="ie-battle" data-testid="ie-battle">
                  <h4>{bi(actualLocale, battle.kind === "naval" ? "Naval battle" : "Land battle", battle.kind === "naval" ? "海战" : "陆战")} · {spaceLabel(battle.from, actualLocale)} → {spaceLabel(battle.to, actualLocale)}</h4>
                  <div>{t.seats[battle.attacker]} → {t.seats[battle.defender]} · {bi(actualLocale, "Step", "阶段")}: {BATTLE_STAGE[battle.stage] ? bi(actualLocale, BATTLE_STAGE[battle.stage].en, BATTLE_STAGE[battle.stage].zh) : battle.stage}</div>
                  {(battle.attackerRoll !== undefined || battle.defenderRoll !== undefined) && <div>{bi(actualLocale, "Rolls", "掷骰")}: {battle.attackerRoll ?? "—"} / {battle.defenderRoll ?? "—"} · {bi(actualLocale, "Diff", "差")} {battle.diff ?? "—"}</div>}
                  <div>{bi(actualLocale, "Losses", "损失")}: {battle.attackerLosses} / {battle.defenderLosses} · DRM {battle.attackerDrm}/{battle.defenderDrm}</div>
                  {battle.notes.length > 0 && <div className="ie-muted">{battle.notes.join(", ")}</div>}
                  {viewer === "OT" && jihadDecision !== null && (
                    <div className="ie-inline" data-testid="ie-jihad-actions">
                      <button className="ie-btn" data-testid="ie-use-jihad" disabled={jihadDecision.allowed !== true} title={jihadReason} onClick={() => doAction(() => moves.useJihad())}>
                        {t.useJihad} ({jihadDecision.markers})
                      </button>
                    </div>
                  )}
                </div>
              )}
              {G.result && <div style={{marginTop: 8}}><IEBadge tone="warn">{t.gameOver}: {G.result.winners.map((p) => t.seats[p]).join(", ")}</IEBadge></div>}
            </IEPanel>
          </div>
        </div>

        <div className="ie-right-col">
          <IEPanel title={`${t.hand}${viewer ? ` · ${t.seats[viewer]}` : ""}`}
            actions={hasPhaseButtons ? (
              <div className="ie-inline" data-testid="ie-impulse-actions">
                {phase === "prep" && canPhaseAct && !me?.flags.prepDone && <Button size="small" variant="outlined" onClick={() => doAction(() => moves.finishPrep())}>{t.finishPrep}</Button>}
                {phase === "diplomacy" && canPhaseAct && me && me.homeCards.length > 0 && !me.selectedHomeCard && <Button size="small" variant="outlined" onClick={() => doAction(() => moves.chooseHomeCard(me.homeCards.find((id) => id !== me.selectedHomeCard) ?? me.homeCards[0]))}>{t.chooseHome}</Button>}
                {phase === "diplomacy" && canPhaseAct && me?.selectedHomeCard && <Button size="small" variant="outlined" onClick={() => doAction(() => moves.endDiplomacy())}>{t.endDiplomacy}</Button>}
                {phase === "action" && isActive && !eliminated && <Button size="small" variant="outlined" disabled={forcedPass} title={forcedPass ? forcedPassTitle : undefined} onClick={() => doAction(() => moves.pass())}>{t.pass}</Button>}
                {phase === "action" && isActive && !eliminated && <Button size="small" variant="outlined" onClick={() => doAction(() => moves.endImpulse())}>{t.endImpulse}</Button>}
                {phase === "end" && canPhaseAct && <Button size="small" variant="outlined" onClick={() => doAction(() => moves.endPhaseTurn())}>{t.continue}</Button>}
              </div>
            ) : undefined}
          >
            {!viewer || !me ? <div className="ie-muted">{t.privateInfo}: {t.hidden}. {t.spectators}.</div> : (
              <>
                <div className="ie-hand-meta">
                  <IEChip>{t.cp}: {G.cpRemaining}</IEChip>
                  <IEChip>{t.hand}: {hand.length} {t.cards}</IEChip>
                  <IEChip>{t.cpChain}: {me.cpChain.length}/2</IEChip>
                  {responseInHand && <IEChip>{t.responseCard}: {hand.filter((id) => cardById(id).type === "response").length}</IEChip>}
                  {me.industryCard && <IEChip>{t.industryCard}: {homeCardTitle(me.industryCard)}</IEChip>}
                  {saveList.length > 0 && <IEChip>{t.savedCards}: {saveList.map(homeCardTitle).join(", ")}</IEChip>}
                </div>
                <div className="ie-cp-chain" data-testid="ie-cp-chain">
                  <div className="ie-section-title">
                    <span>{t.cpChain} · {bi(actualLocale, "spendable CP", "可用 CP")}</span>
                    <span className="ie-cp-chain-total" data-testid="ie-cp-chain-total">{chainSpendable}/{chainCap}</span>
                  </div>
                  <div className="ie-inline ie-cp-chain-cards">
                    {chainNonEmpty
                      ? me.cpChain.map((id) => <IEChip key={id}>{homeCardTitle(id)}</IEChip>)
                      : <span className="ie-muted">{bi(actualLocale, "No chained cards.", "CP 链中没有牌。")}</span>}
                  </div>
                  <div className="ie-inline">
                    <button className="ie-btn" data-testid="ie-use-cp-chain" disabled={!chainReady} title={chainDisabledReason} onClick={() => doAction(() => moves.useCpChain())}>
                      {bi(actualLocale, "Use CP chain", "使用 CP 链")}
                    </button>
                    {!chainReady && chainDisabledReason && <span className="ie-muted" data-testid="ie-cp-chain-reason">{chainDisabledReason}</span>}
                  </div>
                </div>
                {responseWindow && <div className="ie-hint ie-response-hint">{bi(actualLocale, "Response window: you may play a response card instead of an impulse.", "响应窗口：你可以打出响应牌代替本次行动。")}</div>}
                <div className="ie-hand">{hand.map(renderCard)}</div>
                {hand.length === 0 && <div className="ie-muted">{t.hand}: 0 {t.cards}</div>}

                {gw?.active && me.gwCard && (phase === "gwPlanning" || phase === "gwManeuver") && (
                  <div className="ie-hand-section">
                    <div className="ie-section-title">{bi(actualLocale, "Great War card", "大战卡")} · {t.cp}: {me.gwBudget ?? 0}</div>
                    {(() => {
                      const gwId = me.gwCard!;
                      const gwCard = cardById(gwId);
                      const canGwCard = viewer !== null && !eliminated && pending === null && (phase === "gwPlanning" || (phase === "gwManeuver" && isActive));
                      const gwHint = gwEventHint(G, gwId);
                      const gwEventTitle = gwHint === "gw-turn-0"
                        ? bi(actualLocale, "Exhaustion: neither event triggers on GW turn 0.", "精疲力竭：首轮大战不触发任一效果。")
                        : undefined;
                      return (
                        <article className="ie-card" data-testid={`ie-gw-card-${gwId}`}>
                          <div className="ie-card-cp">{gwCard.cp}</div>
                          {cardArt(gwCard.image) ? <img src={cardArt(gwCard.image)} alt={gwCard.title}/> : null}
                          <div className="ie-card-body"><div className="ie-card-title">{actualLocale === "zh_CN" ? gwCard.titleZh : gwCard.title}</div><div>{gwCard.text}</div><div className="ie-card-zh">{gwCard.textZh}</div></div>
                          <div className="ie-card-actions">
                            <button disabled={!canGwCard} onClick={() => doAction(() => moves.playGwCardMove("cp"))}>{t.cpMode}</button>
                            <button disabled={!canGwCard} title={gwEventTitle} onClick={() => doAction(() => moves.playGwCardMove("event"))}>{t.eventMode}</button>
                          </div>
                        </article>
                      );
                    })()}
                  </div>
                )}

                {phase === "diplomacy" && me.homeCards.length > 0 && (
                  <div className="ie-hand-section">
                    <div className="ie-section-title">{t.chooseHome}:</div>
                    <div className="ie-inline">
                      {me.homeCards.map((id) => {
                        const chosen = me.selectedHomeCard === id;
                        return <button key={id} className={`ie-btn secondary${chosen ? " selected" : ""}`} aria-pressed={chosen} disabled={!canPhaseAct || me.selectedHomeCard !== null} onClick={() => doAction(() => moves.chooseHomeCard(id))}>{chosen ? "✓ " : ""}{homeCardTitle(id)}</button>;
                      })}
                    </div>
                  </div>
                )}

                {me.goals.length > 0 && (
                  <div className="ie-hand-section">
                    <div className="ie-section-title">{t.goals}:</div>
                    <div className="ie-inline">
                      {me.goals.map((id) => {
                        const goal = GOALS_BY_ID[id];
                        const image = goal ? `/imperial-elegy/cards/goal-${goal.power}-${String(goal.number).padStart(2, "0")}.png` : undefined;
                        return <div key={id} className="ie-card" style={{width: 130}} data-testid={`ie-goal-${id}`}>
                          {image && <img src={image} alt={goal?.title}/>}
                          <div className="ie-card-body"><div className="ie-card-title">{actualLocale === "zh_CN" ? goal?.titleZh : goal?.title}</div><div>{actualLocale === "zh_CN" ? goal?.textZh : goal?.text}</div></div>
                        </div>;
                      })}
                    </div>
                  </div>
                )}

                {phase === "end" && ngChoices.length > 0 && (
                  <div className="ie-hand-section ie-goal-choice" data-testid="ie-goal-choice">
                    <div className="ie-section-title">{bi(actualLocale, "Draw three National Goals and keep one", "抽三张国家目标并保留一张")}</div>
                    <div className="ie-inline">
                      {ngChoices.map((id) => (
                        <button key={id} className="ie-btn secondary" onClick={() => doAction(() => moves.chooseGoal(id))}>{actualLocale === "zh_CN" ? GOALS_BY_ID[id]?.titleZh : GOALS_BY_ID[id]?.title}</button>
                      ))}
                    </div>
                    <div className="ie-hint">{bi(actualLocale, "Continuing without a choice keeps the first Goal.", "未选择即继续时自动保留第一张目标。")}</div>
                  </div>
                )}

                {phase === "prep" && canPhaseAct && !me.flags.prepStability && (
                  <div className="ie-hand-section">
                    <div className="ie-section-title">{t.discardForStability}:</div>
                    <div className="ie-inline">
                      {hand.filter((id) => cardById(id).type !== "mandatory" && cardById(id).kind !== "home").map((id) => (
                        <button key={id} className="ie-btn secondary" onClick={() => doAction(() => moves.discardForStability(id))}>{homeCardTitle(id)}</button>
                      ))}
                    </div>
                  </div>
                )}

                {phase === "diplomacy" && giveCards.length > 0 && (
                  <div className="ie-hand-section" data-testid="ie-give-card">
                    <div className="ie-section-title">{bi(actualLocale, "Give a card (diplomacy)", "转交卡牌（外交阶段）")}</div>
                    <div className="ie-inline">
                      <select className="ie-select" value={giveTarget} onChange={(e) => setGiveTarget(e.target.value as Power)}>
                        {giveTargets.map((p) => <option key={p} value={p}>{t.seats[p]}</option>)}
                      </select>
                      <select className="ie-select" value={giveCardValue} onChange={(e) => setGiveCardId(e.target.value)}>
                        {giveCards.map((id) => <option key={id} value={id}>{homeCardTitle(id)}</option>)}
                      </select>
                      <button className="ie-btn" disabled={giveTarget === viewer || !giveCardValue} onClick={() => doAction(() => moves.giveCard(giveTarget, giveCardValue))}>{bi(actualLocale, "Give", "转交")}</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </IEPanel>

          <IEPanel title={t.dashboard}>
            <div className="ie-dashboard">
              {POWER_KEYS.map((p) => {
                const def = POWER_DEFS[p];
                const state = G.powers[p];
                return (
                  <div key={p} className={`ie-power ${p === active ? "active" : ""} ${state.eliminated ? "eliminated" : ""}`} data-testid={`ie-power-${p}`}>
                    <div className="ie-power-head">
                      <span className="ie-power-name">{t.seats[p]}</span>
                      <span>
                        {state.eliminated && <IEBadge tone="warn">{t.eliminated}</IEBadge>}
                        <IEBadge tone={p.toLowerCase()}>{state.alliance === "neutral" ? t.neutral : state.alliance}</IEBadge>
                      </span>
                    </div>
                    <div className="ie-power-stat">
                      <span>{t.stability} {state.stability}</span>
                      <span>{t.manpower} {state.manpower}{state.secondaryManpower !== undefined ? `/${state.secondaryManpower}` : ""}</span>
                      <span>{t.industry} {state.industry}</span>
                      <span>{t.territorialKeys} {state.territorialKeys}</span>
                      <span>{t.colonialKeys} {state.colonialKeys}</span>
                      {state.arabKeys !== undefined && <span>{t.arabKeys} {state.arabKeys}</span>}
                      <span>{t.vp} {state.vp}</span>
                      <span>{t.reserves} {state.reserves.length}</span>
                      <span>{t.hand} {handCounts[p] ?? state.hand.length}</span>
                      <span>{t.goals} {goalCounts[p] ?? state.goals.length}</span>
                      <span>{t.mpit} {state.mpit.te}/{state.mpit.ta}/{state.mpit.neutral}</span>
                    </div>
                    <div className="ie-power-chips">
                      {state.selectedHomeCard && <IEChip>{t.homeCard}: {homeCardTitle(state.selectedHomeCard)}</IEChip>}
                      {p === viewer && state.industryCard && <IEChip>{t.industryCard}: {homeCardTitle(state.industryCard)}</IEChip>}
                      {p === viewer && state.cpChain.length > 0 && <IEChip>{t.cpChainCard}: {state.cpChain.map(homeCardTitle).join(", ")}</IEChip>}
                      {p === viewer && state.goals.map((g) => <IEChip key={g}>{actualLocale === "zh_CN" ? GOALS_BY_ID[g]?.titleZh : GOALS_BY_ID[g]?.title}</IEChip>)}
                    </div>
                    <details>
                      <summary className="ie-muted">{t.characteristics}</summary>
                      <ul style={{margin: "4px 0 0 14px", padding: 0, fontSize: 11, lineHeight: 1.3}}>
                        {def.characteristics.map((c, i) => <li key={i}>{actualLocale === "zh_CN" ? c.zh : c.en}</li>)}
                      </ul>
                    </details>
                  </div>
                );
              })}
            </div>
            <div className="ie-inline" data-testid="ie-revealed-goals" style={{marginTop: 6}}>
              <span className="ie-section-title">{t.revealedGoals}:</span>
              {(G.revealedGoals ?? []).length === 0
                ? <span className="ie-muted">{bi(actualLocale, "None revealed", "暂无公开目标")}</span>
                : (G.revealedGoals ?? []).map((id) => {
                  const goal = GOALS_BY_ID[id];
                  return (
                    <span key={id} data-testid={`ie-revealed-goal-${id}`}>
                      <IEChip>
                        {actualLocale === "zh_CN" ? goal?.titleZh ?? id : goal?.title ?? id}
                        {goal ? ` · ${t.seats[goal.power]}` : ""}
                      </IEChip>
                    </span>
                  );
                })}
            </div>
            <div className="ie-inline" data-testid="ie-minor-card-markers" style={{marginTop: 6}}>
              <span className="ie-section-title">{bi(actualLocale, "War reparation markers (16.2.3)", "战争赔款标记（16.2.3）")}:</span>
              {minorMarkerRows.length === 0
                ? <span className="ie-muted">{bi(actualLocale, "None", "无")}</span>
                : minorMarkerRows.map(([minor, count]) => (
                  <span key={minor} data-testid={`ie-minor-marker-${minor}`}>
                    <IEChip>{powerOrMinorLabel(t, actualLocale, minor)} · {count}</IEChip>
                  </span>
                ))}
            </div>
          </IEPanel>

          <IEPanel title={`${t.mpit} · ${bi(actualLocale, "Influence track", "影响力轨")}`} actions={<IEBadge>{bi(actualLocale, "1 CP per marker", "每标记 1 CP")}</IEBadge>}>
            <div data-testid="ie-mpit">
              {canAct ? (
                <div className="ie-inline" data-testid="ie-mpit-controls">
                  <IEBadge tone={me ? viewer!.toLowerCase() : "default"}>{t.cp}: {cpBudget()}</IEBadge>
                  <select className="ie-select" value={mpitTarget} onChange={(e) => setMpitTarget(e.target.value as Power)} title={t.target}>
                    {POWER_KEYS.map((p) => <option key={p} value={p}>{t.seats[p]}</option>)}
                  </select>
                  <select className="ie-select" value={mpitTrack} onChange={(e) => setMpitTrack(e.target.value as typeof mpitTrack)} title={bi(actualLocale, "Track", "轨道")}>
                    <option value="te">{t.mpitTe}</option><option value="ta">{t.mpitTa}</option><option value="neutral">{t.mpitNeutral}</option>
                  </select>
                  <button className="ie-btn" disabled={!canSpend(1)} onClick={() => doAction(() => moves.placeMpit(mpitTarget, mpitTrack))}>{t.placeMpit}</button>
                </div>
              ) : <div className="ie-muted">{bi(actualLocale, "Available during your own impulse.", "仅在你的行动轮可用。")}</div>}
              <div className="ie-mpit-grid">
                {POWER_KEYS.map((p) => (
                  <div key={p} className={`ie-mpit-cell${p === viewer ? " mine" : ""}`}>
                    <b>{t.seats[p]}</b>
                    <span>{t.mpitTe} {G.powers[p].mpit.te}</span>
                    <span>{t.mpitTa} {G.powers[p].mpit.ta}</span>
                    <span>{t.mpitNeutral} {G.powers[p].mpit.neutral}</span>
                  </div>
                ))}
              </div>
            </div>
          </IEPanel>

          {showNationalActions && viewer !== null && (
            <IEPanel title={t.nationalActions} actions={<IEBadge>{t.seats[viewer]}</IEBadge>}>
              <div className="ie-national-actions" data-testid="ie-national-actions">
                {viewer === "FR" && (
                  <div className="ie-inline" data-testid="ie-fr-actions">
                    <button className="ie-btn" data-testid="ie-rebuild-zouave" disabled={cpBudget() < 1 || zouaveInPlay} title={zouaveReason} onClick={() => doAction(() => moves.rebuildZouave())}>{t.rebuildZouave}</button>
                  </div>
                )}

                {viewer === "AU" && (
                  <div data-testid="ie-au-actions">
                    <div className="ie-inline">
                      <span className="ie-section-title">{t.auReforms}</span>
                      <select className="ie-select" data-testid="ie-au-reform-target" value={auReformValue} onChange={(e) => setAuReformTarget(e.target.value)}>
                        {AU_NATIONALITIES.map((nationality) => <option key={nationality} value={nationality}>{nationality}</option>)}
                      </select>
                      <button className="ie-btn" data-testid="ie-au-reforms" disabled={auReformDecision?.allowed !== true || cpBudget() < 3} title={auReformReason} onClick={() => doAction(() => moves.auAction("reforms", auReformValue))}>{t.auReforms}</button>
                    </div>
                    <div className="ie-inline">
                      <span className="ie-section-title">{t.auExpandCitizenship}</span>
                      <select className="ie-select" data-testid="ie-au-citizenship-target" value={auCitizenValue} onChange={(e) => setAuCitizenTarget(e.target.value)}>
                        {AU_NATIONALITIES.map((nationality) => <option key={nationality} value={nationality}>{nationality}</option>)}
                      </select>
                      <label className="ie-muted">
                        <input type="checkbox" data-testid="ie-au-sacrifice" checked={auSacrifice} onChange={(e) => setAuSacrifice(e.target.checked)}/> {t.auSacrificeStability}
                      </label>
                      <button className="ie-btn" data-testid="ie-au-citizenship" disabled={auCitizenDecision?.allowed !== true || cpBudget() < 3} title={auCitizenReason} onClick={() => doAction(() => moves.auAction("expandCitizenship", auCitizenValue, auSacrifice))}>{t.auExpandCitizenship}</button>
                    </div>
                    <div className="ie-inline">
                      <span className="ie-section-title">{t.auIncorporate}</span>
                      <select className="ie-select" data-testid="ie-au-incorporate-target" value={auIncorporateValue} onChange={(e) => setAuIncorporateTarget(e.target.value)} disabled={auIncorporateCandidates.length === 0}>
                        {auIncorporateCandidates.length === 0
                          ? <option value="">{bi(actualLocale, "No allied minor power", "没有盟国小国")}</option>
                          : auIncorporateCandidates.map((space) => <option key={space} value={space}>{spaceLabel(space, actualLocale)}</option>)}
                      </select>
                      <button className="ie-btn" data-testid="ie-au-incorporate" disabled={auIncorporate?.allowed !== true || cpBudget() < 3} title={auIncorporateReason} onClick={() => doAction(() => moves.auAction("incorporate", auIncorporateValue))}>{t.auIncorporate}</button>
                    </div>
                  </div>
                )}

                {(viewer === "RU" || tsrrArmies.length > 0) && (
                  <div className="ie-inline" data-testid="ie-tsrr-actions">
                    <span className="ie-section-title">{t.tsrrRailMove}</span>
                    <select className="ie-select" data-testid="ie-tsrr-unit" value={tsrrUnitValue} onChange={(e) => setTsrrUnitId(e.target.value)} disabled={tsrrArmies.length === 0}>
                      {tsrrArmies.length === 0
                        ? <option value="">{bi(actualLocale, "No army on the railroad", "铁路上没有军团")}</option>
                        : tsrrArmies.map((unit) => <option key={unit.id} value={unit.id}>{unit.id} · {unit.space ? spaceLabel(unit.space, actualLocale) : ""}</option>)}
                    </select>
                    <select className="ie-select" data-testid="ie-tsrr-destination" value={tsrrToValue} onChange={(e) => setTsrrTo(e.target.value)} disabled={tsrrDestinations.length === 0}>
                      {tsrrDestinations.map((space) => <option key={space} value={space}>{spaceLabel(space, actualLocale)}</option>)}
                    </select>
                    <button className="ie-btn" data-testid="ie-tsrr-rail" disabled={tsrrDecision?.allowed !== true} title={tsrrReason} onClick={() => doAction(() => moves.tsrrRailMove(tsrrUnitValue, tsrrToValue))}>{t.tsrrRailMove}</button>
                  </div>
                )}
              </div>
            </IEPanel>
          )}

          {amphibiousVisible && viewer !== null && (
            <IEPanel title={`${t.amphibiousAssault} · 19.10`} actions={<IEBadge>{t.seats[viewer]}</IEBadge>}>
              <div className="ie-amphibious" data-testid="ie-amphibious">
                <div className="ie-inline">
                  <span className="ie-section-title">{bi(actualLocale, "From", "出发地")}</span>
                  <select
                    className="ie-select"
                    data-testid="ie-amphibious-from"
                    value={amphibiousFromValue}
                    onChange={(e) => setAmphibiousFrom(e.target.value)}
                  >
                    {amphibiousOrigins.length === 0
                      ? <option value="">{bi(actualLocale, "No loaded army", "没有已装载军团")}</option>
                      : amphibiousOrigins.map((id) => <option key={id} value={id}>{spaceLabel(id, actualLocale)}</option>)}
                  </select>
                  <span className="ie-section-title">{bi(actualLocale, "Target port", "目标港口")}</span>
                  <select
                    className="ie-select"
                    data-testid="ie-amphibious-to"
                    value={amphibiousToValue}
                    onChange={(e) => setAmphibiousTo(e.target.value)}
                  >
                    {amphibiousTargets.length === 0
                      ? <option value="">{bi(actualLocale, "No enemy port", "没有敌方港口")}</option>
                      : amphibiousTargets.map((id) => <option key={id} value={id}>{spaceLabel(id, actualLocale)}</option>)}
                  </select>
                </div>
                <div className="ie-amphibious-armies" data-testid="ie-amphibious-armies">
                  <span className="ie-section-title">{bi(actualLocale, "Loaded armies (up to 2)", "装载军团（至多 2）")}</span>
                  {amphibiousArmies.length === 0
                    ? <span className="ie-muted">{bi(actualLocale, "No army is loaded here.", "此处没有已装载军团。")}</span>
                    : amphibiousArmies.map((id) => {
                      const unit = G.units[id];
                      if (!unit) return null;
                      return (
                        <label key={id} className="ie-muted">
                          <input
                            type="checkbox"
                            data-testid={`ie-amphibious-unit-${id}`}
                            checked={amphibiousArmyValue.includes(id)}
                            onChange={(e) => toggleAmphibiousArmy(id, e.target.checked)}
                          />{" "}
                          {unitLabel(unit, t)}
                        </label>
                      );
                    })}
                </div>
                <div className="ie-inline">
                  <button
                    className="ie-btn"
                    data-testid="ie-amphibious-go"
                    disabled={!amphibiousCanGo}
                    title={amphibiousReason}
                    onClick={() => doAction(() => moves.amphibiousAssault(amphibiousFromValue as SpaceId, amphibiousToValue as SpaceId, amphibiousArmyValue))}
                  >
                    {t.amphibiousAssault}
                  </button>
                  {!amphibiousCanGo && amphibiousReason && (
                    <span className="ie-muted" data-testid="ie-amphibious-reason">{amphibiousReason}</span>
                  )}
                </div>
                {(amphibiousCheck?.enemyNaval ?? 0) > 0 && (
                  <div className="ie-hint" data-testid="ie-amphibious-escort">
                    {bi(
                      actualLocale,
                      `Enemy naval presence: ${amphibiousCheck?.enemyNaval ?? 0} ships; a 2:1 escort needs ${amphibiousCheck?.needShips ?? 0} (you have ${amphibiousCheck?.ownNaval ?? 0}).`,
                      `敌方海上力量：${amphibiousCheck?.enemyNaval ?? 0} 艘；2:1 护航需 ${amphibiousCheck?.needShips ?? 0} 艘（你现有 ${amphibiousCheck?.ownNaval ?? 0} 艘）。`,
                    )}
                  </div>
                )}
              </div>
            </IEPanel>
          )}

          {transportVisible && viewer !== null && (
            <IEPanel title={`${bi(actualLocale, "Naval transport", "海上运输")} · 12.3`} actions={<IEBadge>{t.seats[viewer]}</IEBadge>}>
              <div className="ie-naval-transport" data-testid="ie-naval-transport">
                <div className="ie-inline">
                  <span className="ie-section-title">{bi(actualLocale, "From", "出发地")}</span>
                  <select className="ie-select" data-testid="ie-naval-transport-from" value={transportFromValue} onChange={(e) => setTransportFrom(e.target.value)}>
                    {transportOrigins.length === 0
                      ? <option value="">{bi(actualLocale, "No loaded land unit", "没有可装载的陆军")}</option>
                      : transportOrigins.map((id) => <option key={id} value={id}>{spaceLabel(id, actualLocale)}</option>)}
                  </select>
                  <span className="ie-section-title">{bi(actualLocale, "Land unit", "陆军单位")}</span>
                  <select className="ie-select" data-testid="ie-naval-transport-land" value={transportLandValue} onChange={(e) => setTransportLand(e.target.value)}>
                    {transportLands.length === 0
                      ? <option value="">{bi(actualLocale, "No land unit", "没有陆军单位")}</option>
                      : transportLands.map((id) => {
                        const unit = G.units[id];
                        return <option key={id} value={id}>{unit ? unitLabel(unit, t) : id}</option>;
                      })}
                  </select>
                  <span className="ie-section-title">{bi(actualLocale, "Destination port", "目的港口")}</span>
                  <select className="ie-select" data-testid="ie-naval-transport-to" value={transportToValue} onChange={(e) => setTransportTo(e.target.value)}>
                    {transportTargets.length === 0
                      ? <option value="">{bi(actualLocale, "No reachable port", "没有可抵达港口")}</option>
                      : transportTargets.map((id) => <option key={id} value={id}>{spaceLabel(id, actualLocale)}</option>)}
                  </select>
                </div>
                <div className="ie-inline">
                  <button
                    className="ie-btn"
                    data-testid="ie-naval-transport-go"
                    disabled={!transportCanGo}
                    title={transportReason}
                    onClick={() => doAction(() => moves.navalTransport(transportLandValue, transportFleet, transportToValue as SpaceId))}
                  >
                    {bi(actualLocale, "Transport", "海运")}
                  </button>
                  <span className="ie-muted" data-testid="ie-naval-transport-fleet">
                    {bi(actualLocale, `Escorting fleet: ${transportFleet.length} ships`, `护航舰队：${transportFleet.length} 艘`)}
                  </span>
                  {!transportCanGo && transportReason && (
                    <span className="ie-muted" data-testid="ie-naval-transport-reason">{transportReason}</span>
                  )}
                </div>
              </div>
            </IEPanel>
          )}

          {interceptVisible && lastNavalBox !== null && (
            <IEPanel title={`${t.navalIntercept} · 19.1`} actions={<IEBadge tone="warn">{spaceLabel(lastNavalBox, actualLocale)}</IEBadge>}>
              <div className="ie-naval-intercept" data-testid="ie-naval-intercept">
                <div className="ie-muted">
                  {bi(
                    actualLocale,
                    `Last naval move: ${lastNavalMover ? t.seats[lastNavalMover] : "—"} into ${spaceLabel(lastNavalBox, actualLocale)}. The defender may attempt an interception from one of their ports.`,
                    `最近一次海军移动：${lastNavalMover ? t.seats[lastNavalMover] : "—"} 进入${spaceLabel(lastNavalBox, actualLocale)}。防御方可从其一港口尝试拦截。`,
                  )}
                </div>
                <div className="ie-inline">
                  <select
                    className="ie-select"
                    data-testid="ie-intercept-port"
                    value={interceptPortValue}
                    onChange={(e) => setInterceptPort(e.target.value)}
                    disabled={interceptPorts.length === 0}
                  >
                    {interceptPorts.length === 0
                      ? <option value="">{bi(actualLocale, "No adjacent port", "没有相邻港口")}</option>
                      : interceptPorts.map((id) => <option key={id} value={id}>{spaceLabel(id, actualLocale)}</option>)}
                  </select>
                  <button
                    className="ie-btn"
                    data-testid="ie-intercept-go"
                    disabled={interceptCheck?.ok !== true}
                    title={interceptReason}
                    onClick={() => doAction(() => moves.navalIntercept(interceptPortValue as SpaceId, lastNavalBox))}
                  >
                    {t.navalIntercept}
                  </button>
                  {interceptCheck?.ok !== true && interceptReason && (
                    <span className="ie-muted" data-testid="ie-intercept-reason">{interceptReason}</span>
                  )}
                </div>
                {interceptCheck?.ok === true && (
                  <div className="ie-hint">
                    {bi(actualLocale, `${interceptCheck.ships ?? 0} ships in the port will roll 5+.`, `${interceptCheck.ships ?? 0} 艘港口内舰船需掷 5+。`)}
                  </div>
                )}
              </div>
            </IEPanel>
          )}

          {war && (
            <IEPanel title={`${t.phases.wartime} · ${warStatusLabel}`} actions={<IEBadge tone="warn">{warStatusLabel}</IEBadge>}>
              <div className="ie-war" data-testid="ie-war">
                <div className="ie-war-sides">
                  <div className="ie-war-side">
                    <div className="ie-war-power">{t.seats[war.attacker]}</div>
                    <div className="ie-muted">{bi(actualLocale, "Attacker", "进攻方")}</div>
                    {war.attackerAllies.length > 0 && <div>{bi(actualLocale, "Allies", "盟友")}: {war.attackerAllies.map((p) => t.seats[p]).join(", ")}</div>}
                  </div>
                  <div className="ie-war-arrow">→</div>
                  <div className="ie-war-side">
                    <div className="ie-war-power" data-testid="ie-war-defender">
                      {powerOrMinorLabel(t, actualLocale, isLoneMinorWar(war) ? loneMinorDefender(war) ?? war.defender : war.defender)}
                    </div>
                    <div className="ie-muted">{bi(actualLocale, "Defender", "防守方")}</div>
                    {war.defenderAllies.length > 0 && <div>{bi(actualLocale, "Allies", "盟友")}: {war.defenderAllies.map((p) => t.seats[p]).join(", ")}</div>}
                    {warDefenderMinors.length > 0 && (
                      <div data-testid="ie-war-defender-minors">
                        {bi(actualLocale, "Minor allies", "小国盟友")}: {warDefenderMinors.map((m) => powerOrMinorLabel(t, actualLocale, m)).join(", ")}
                      </div>
                    )}
                  </div>
                </div>
                <div><strong>{t.warAim}:</strong> {warAimLabel(war.warAim)} · <strong>{t.objectives}:</strong> {war.objectives.map((id) => spaceLabel(id, actualLocale)).join(", ")}</div>
                <div className="ie-war-budgets" data-testid="ie-war-budgets"><strong>{t.cp}:</strong> {warBudgetRows.map((p) => <span key={p} className={p === active ? "active" : ""}>{t.seats[p]} {war.budgets[p] ?? 0}</span>)}</div>
                <div><strong>{t.pass}:</strong> {war.passed.map((p) => t.seats[p]).join(", ") || "—"}</div>
                {war.initiative.length > 0 && <div><strong>{bi(actualLocale, "Initiative", "先手")}:</strong> {war.initiative.map((p) => t.seats[p]).join(" → ")}</div>}
                {war.treaties.length > 0 && <div data-testid="ie-war-treaties"><strong>{t.treaty}:</strong> {war.treaties.map((option) => treatyOptionLabel(option, actualLocale)).join(", ")}</div>}
                <div className="ie-muted">{bi(actualLocale, "Status", "状态")}: {warStatusLabel} · {bi(actualLocale, "Started turn", "开始回合")} {war.startedTurn}</div>

                {isBelligerent && !eliminated && pending === null && (
                  <div className="ie-war-controls">
                    {isActive && (war.status === "warAim" || war.status === "alliance") && (
                      <button className="ie-btn" onClick={() => doAction(() => moves.startWarManeuver())}>{t.startWar}</button>
                    )}
                    {viewer === war.defender && war.defenderShift?.choice === true && (war.status === "warAim" || war.status === "alliance") && (
                      <div className="ie-inline">
                        <span className="ie-muted">{bi(actualLocale, "Alliance shift (8.2)", "联盟转变（8.2）")}:</span>
                        {(["te", "ta"] as const).map((side) => (
                          <button key={side} className="ie-btn secondary" onClick={() => doAction(() => moves.chooseAllianceShift(side))}>
                            {side === "te" ? bi(actualLocale, "Triple Entente", "协约国") : bi(actualLocale, "Triple Alliance", "同盟国")}
                          </button>
                        ))}
                      </div>
                    )}
                    {war.status === "warAim" && viewer === war.attacker && (
                      <div className="ie-inline">
                        <span className="ie-muted">{t.chooseAim}:</span>
                        {(["conquest", "liberation", "unification"] as const).map((aim) => (
                          <button key={aim} className={`ie-btn secondary${war.warAim === aim ? " selected" : ""}`} aria-pressed={war.warAim === aim} onClick={() => doAction(() => moves.chooseWarAim(aim))}>{warAimLabel(aim)}</button>
                        ))}
                      </div>
                    )}
                    {isPrincipal && (
                      <div className="ie-inline">
                        <select className="ie-select" value={warAllyValue ?? ""} disabled={callableAllies.length === 0} onChange={(e) => setWarAlly(e.target.value as Power)} title={t.callAlly}>
                          {callableAllies.length === 0 && <option value="">{bi(actualLocale, "No allied hand", "无盟友手牌")}</option>}
                          {callableAllies.map((p) => <option key={p} value={p}>{t.seats[p]}</option>)}
                        </select>
                        <button className="ie-btn" disabled={callableAllies.length === 0 || warAllyValue === undefined} onClick={() => doAction(() => moves.callWarAlly(warAllyValue!))}>{t.callAlly}</button>
                      </div>
                    )}
                    {isPrincipal && war.status === "alliance" && callableMinors.length > 0 && (
                      <div className="ie-inline" data-testid="ie-call-minor">
                        <select className="ie-select" data-testid="ie-call-minor-select" value={warMinorValue} onChange={(e) => setWarMinor(e.target.value)} title={t.callMinor}>
                          {callableMinors.map((minor) => <option key={minor} value={minor}>{minor}</option>)}
                        </select>
                        <button className="ie-btn" data-testid="ie-call-minor-button" disabled={warMinorValue === ""} onClick={() => doAction(() => moves.callWarMinor(warMinorValue))}>{t.callMinor}</button>
                      </div>
                    )}
                    {isPrincipal && (
                      <button className={`ie-btn secondary${confirmSurrender ? " danger" : ""}`} onClick={() => {
                        if (!confirmSurrender) { setConfirmSurrender(true); return; }
                        doAction(() => moves.surrender());
                        setConfirmSurrender(false);
                      }}>{confirmSurrender ? bi(actualLocale, "Confirm surrender", "确认投降") : bi(actualLocale, "Surrender", "投降")}</button>
                    )}
                    {isActive && phase === "wartime" && (
                      <button className="ie-btn" disabled={war.passed.includes(viewer!)} onClick={() => doAction(() => moves.passWarMove())}>{t.passWar}</button>
                    )}
                    {isActive && phase === "wartime" && (
                      <button className="ie-btn" onClick={() => doAction(() => moves.resolveWar())}>{t.resolveWar}</button>
                    )}
                  </div>
                )}
                {/* Rule 14.2.1: the UK may answer another player's declaration. */}
                {viewer === "UK" && !eliminated && pending === null && !warBelligerents.includes("UK")
                  && (war.status === "warAim" || war.status === "alliance")
                  && G.powers.UK.hand.includes(BALANCE_OF_POWER_CARD) && (
                  <div className="ie-war-controls">
                    <button className="ie-btn" onClick={() => doAction(() => moves.playBalanceOfPower())}>
                      {bi(actualLocale, "Balance of Power: become the primary defender", "势力均衡：成为主要防守方")}
                    </button>
                  </div>
                )}
              </div>
            </IEPanel>
          )}

          {gw && (
            <IEPanel title={`${t.greatWarMap} · GW ${gw.turn}`} actions={<IEBadge tone="warn">{PHASE_LABEL(t, phase)}</IEBadge>}>
              <div className="ie-gw" data-testid="ie-gw">
                <div className="ie-gw-sides">
                  <div><strong>TE:</strong> {gw.te.map((p) => t.seats[p]).join(", ") || "—"}</div>
                  <div><strong>TA:</strong> {gw.ta.map((p) => t.seats[p]).join(", ") || "—"}</div>
                  <div><strong>{t.neutral}:</strong> {gw.neutrals.map((p) => t.seats[p]).join(", ") || "—"}</div>
                </div>
                <div className="ie-gw-order"><span className="ie-muted">{bi(actualLocale, "Order", "顺序")}:</span> {gw.order.map((slot, index) => (
                  <span key={`${index}-${String(slot)}`} className={`ie-gw-slot${slot === active ? " active" : ""}${slot === "bonus" ? " bonus" : ""}`}>{gwSlotLabel(slot)}</span>
                ))}</div>
                <div className="ie-budget-grid">
                  {gwBudgetOrder.map((p) => (
                    <div key={p} className={`ie-budget${p === viewer ? " mine" : ""}${p === active ? " active" : ""}`}>
                      <span>{t.seats[p]}</span>
                      <b>{G.powers[p].gwBudget ?? 0}</b>
                    </div>
                  ))}
                </div>
                {italyShowing && !gw.italyIn && !gw.italySurrendered && (
                  <div className="ie-muted" data-testid="ie-gw-italy-track" data-box={italyBox}>
                    {bi(actualLocale, "Italy", "意大利")}: {italyBoxLabel} · {italyHow}
                  </div>
                )}
                {(gw.usIn || gw.italyIn || gw.usSurrendered || gw.italySurrendered) && (
                  <div className="ie-muted" data-testid="ie-gw-majors">
                    {(["US", "IT"] as const)
                      .filter((major) => (major === "US" ? gw.usIn || gw.usSurrendered : gw.italyIn || gw.italySurrendered))
                      .map((major) => {
                        const label = major === "US" ? bi(actualLocale, "US", "美国") : bi(actualLocale, "Italy", "意大利");
                        const surrendered = major === "US" ? gw.usSurrendered : gw.italySurrendered;
                        const stability = major === "US" ? gw.usStability : gw.italyStability;
                        const budget = major === "US" ? gw.usBudget : gw.italyBudget;
                        return (
                          <span key={major} data-testid={`ie-gw-major-${major}`} data-surrendered={String(Boolean(surrendered))}>
                            {surrendered
                              ? `${label}: ${bi(actualLocale, "surrendered", "已投降")}`
                              : `${label}: ${bi(actualLocale, "stability", "稳定度")} ${stability}/3 · CP ${budget}${major === "IT" ? ` · ${bi(actualLocale, "alliance track", "联盟轨道")} ${italyBoxLabel}` : ""}`}
                          </span>
                        );
                      })
                      .reduce<React.ReactNode[]>((acc, node, index) => (index === 0 ? [node] : [...acc, " · ", node]), [])}
                  </div>
                )}
                <div className="ie-muted">{bi(actualLocale, "War budget", "战争预算")}: {POWERS.map((p) => `${p} ${G.powers[p].warBudget ?? 0}`).join(" · ")}</div>
                <div className="ie-gw-front" data-testid="ie-gw-combat-cards-in-front">
                  <div className="ie-section-title">{bi(actualLocale, "GW combat cards in front", "阵前大战战斗牌")}</div>
                  {(gw.combatCardsInFront ?? []).length === 0 ? (
                    <div className="ie-muted" data-testid="ie-gw-combat-cards-in-front-empty">{bi(actualLocale, "None", "无")}</div>
                  ) : (
                    <div className="ie-gw-front-list">
                      {(gw.combatCardsInFront ?? []).map((entry, index) => {
                        const card = cardById(entry.cardId);
                        const title = actualLocale === "zh_CN" ? card.titleZh : card.title;
                        const stateLabel = entry.faceup ? bi(actualLocale, "Face up", "明置") : bi(actualLocale, "Face down", "暗置");
                        return (
                          <div
                            key={`${entry.cardId}-${index}`}
                            className={`ie-gw-front-card ${entry.faceup ? "faceup" : "facedown"}`}
                            data-testid={`ie-gw-in-front-${entry.cardId}`}
                            data-holder={entry.holder}
                            data-faceup={String(entry.faceup)}
                          >
                            <span className="ie-gw-front-title">{title}</span>
                            <span className="ie-gw-front-holder">{t.seats[entry.holder]}</span>
                            <span className={`ie-gw-front-state${entry.faceup ? " faceup" : " facedown"}`}>{stateLabel}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {gw.lastColonialWar && (
                  <div data-testid="ie-gw-winter"><strong>{t.gwWinterStep}:</strong> {bi(actualLocale, "Africa", "非洲")} {gw.lastColonialWar.africa ?? "—"} · {bi(actualLocale, "Asia", "亚洲")} {gw.lastColonialWar.asia ?? "—"}</div>
                )}
                {phase === "gwWinter" && <div className="ie-hint">{bi(actualLocale, "Winter resolves automatically: blockade, colonial war, then the next GW turn.", "冬季自动结算：封锁、殖民战争，然后进入下一个大战回合。")}</div>}

                {phase === "gwPlanning" && viewer !== null && !eliminated && (
                  <div className="ie-hint">
                    {bi(actualLocale, "All powers pick their GW card in planning; the table then starts maneuver.", "所有国家在计划阶段选择大战卡，然后进入机动。")}
                    <button className="ie-btn" data-testid="ie-gw-start" onClick={() => doAction(() => moves.endGwPlanningMove())}>{t.gwStart}</button>
                    {/* 27.6: planning CP transfer to an ally (once per donor). */}
                    {canGwTransfer && (
                      <span className="ie-inline" data-testid="ie-gw-transfer">
                        <select
                          className="ie-select"
                          data-testid="ie-gw-transfer-to"
                          value={gwTransferToValue}
                          onChange={(e) => setGwTransferTo(e.target.value)}
                          title={bi(actualLocale, "Allied recipient", "受援盟友")}
                        >
                          {gwSideAllies.map((power) => <option key={power} value={power}>{t.seats[power]}</option>)}
                        </select>
                        <input
                          className="ie-select"
                          data-testid="ie-gw-transfer-amount"
                          type="number"
                          min={1}
                          max={Math.max(1, me?.gwBudget ?? 1)}
                          value={gwTransferAmountValue}
                          onChange={(e) => setGwTransferAmount(Number(e.target.value))}
                          title={bi(actualLocale, "CP to transfer", "转交的 CP")}
                        />
                        <button
                          className="ie-btn"
                          data-testid="ie-gw-transfer-submit"
                          disabled={!canGwTransfer || gwTransferToValue === ""}
                          onClick={() => doAction(() => moves.gwTransferBudget(gwTransferToValue as Power, gwTransferAmountValue))}
                        >{t.gwTransfer}</button>
                      </span>
                    )}
                    {canGwReveal && (
                      <button className="ie-btn secondary" data-testid="ie-gw-reveal" onClick={() => doAction(() => moves.gwRevealCombat())}>{t.gwReveal}</button>
                    )}
                  </div>
                )}
                {phase === "gwManeuver" && isActive && !eliminated && pending === null && (
                  <div className="ie-inline">
                    <button className="ie-btn" data-testid="ie-gw-draft" title={t.draftArmies} disabled={!canGwDraft} onClick={() => doAction(() => moves.gwDraft(selected!))}>{t.gwDraft}{selected ? ` · ${spaceLabel(selected, actualLocale)}` : ""}</button>
                    <button className="ie-btn" data-testid="ie-gw-deploy" title={bi(actualLocale, "Deploy one reserve army here (27.5).", "在此部署一支预备军（27.5）。")} disabled={!canGwDeployHere} onClick={() => doAction(() => moves.gwDeploy(selected!))}>{t.gwDeploy}</button>
                    {canGwReveal && (
                      <button className="ie-btn secondary" data-testid="ie-gw-reveal" onClick={() => doAction(() => moves.gwRevealCombat())}>{t.gwReveal}</button>
                    )}
                    <button className="ie-btn secondary" data-testid="ie-gw-pass" disabled={forcedGwCard} title={forcedGwCard ? bi(actualLocale, "Exhaustion must be played before you can pass (27.3).", "必须先在打出手中的“精疲力竭”后才能停牌（27.3）。") : bi(actualLocale, "Pass this impulse only; the next power acts.", "仅停牌本轮，下一位国家行动。")} onClick={() => doAction(() => moves.gwPass())}>{t.gwPass}</button>
                    <button className="ie-btn secondary" data-testid="ie-gw-end" title={bi(actualLocale, "End the whole GW maneuver turn and go to winter.", "结束整个大战机动回合并进入冬季。")} onClick={() => doAction(() => moves.gwEndTurn())}>{t.gwEnd}</button>
                  </div>
                )}
                {phase === "gwManeuver" && isActive && !selected && <div className="ie-hint">{bi(actualLocale, "Select a space on the map, then draft there.", "先在地图上选择空间，然后在此征召。")}</div>}
                {phase === "gwManeuver" && !isActive && viewer !== null && <div className="ie-muted">{t.waitingOther}</div>}
              </div>
            </IEPanel>
          )}

          <IEPanel title={t.log}>
            <div className="ie-log" data-testid="ie-log">
              {G.log.slice(-80).reverse().map((entry) => <LogLine key={entry.id} entry={entry} locale={actualLocale}/>)}
            </div>
          </IEPanel>
        </div>
      </div>

      {showCharts && (
        <IEPanel title={t.charts} actions={<Button size="small" onClick={() => setShowCharts(false)}>{t.close}</Button>}>
          <div className="ie-chart-grid">
            {[
              ["map-flashpoints", "Flashpoints"],
              ["combat-crt", "Combat & CRT"],
              ["colonial-great-wars", "Colonial & Great Wars"],
              ["war-aims-minors", "War Aims & Minors"],
              ["crisis", "Crisis Table"],
              ["influence-track", "Major Power Influence"],
              ["italy-legend", "Italy & Legend"],
              ["sequence-of-play", "Sequence of Play"],
              ["counter-count", "Counter Count"],
            ].map(([id, caption]) => (
              <figure key={id}><img src={`/imperial-elegy/charts/${id}.${id === "map-flashpoints" || id === "combat-crt" || id === "colonial-great-wars" || id === "war-aims-minors" ? "png" : id === "crisis" ? "png" : "png"}`} alt={caption}/><figcaption>{caption}</figcaption></figure>
            ))}
          </div>
        </IEPanel>
      )}

      {showHelp && (
        <IEPanel title={t.rulesCoverage} actions={<Button size="small" onClick={() => setShowHelp(false)}>{t.close}</Button>}>
          <div style={{fontSize: 12, lineHeight: 1.5}}>
            <p>{actualLocale === "zh_CN" ? "本实现覆盖 1850–1920 六年玩家战役：准备、外交、行动、结束阶段，有限战争（战争目标、联盟、先手、机动、胜利、复员），大战（爆发、计划、机动、冬季、消灭与胜利），以及卡牌事件、响应窗口、国家特性、外交与联盟、征募、工业、殖民、移动、补给、陆战/海战、条约、危机、国家目标与全部战役胜利条件。" : "This implementation covers the 1850–1920 six-player campaign: Prep, Diplomacy, Action and End phases; limited wars (war aims, alliance, initiative, maneuver, victory, demobilization); the Great War (outbreak, planning, maneuver, winter, elimination and victory); card events, response windows, national characteristics, diplomacy and alliances, recruitment, industry, colonial actions, movement, supply, land/naval combat, treaties, crises, national goals and every campaign victory condition."}</p>
            <p>{actualLocale === "zh_CN" ? "资产来自 VASSAL 模块 1.1.0-beta.4；卡牌文字以卡面为准，OCR 仅作辅助。威廉二世 #82 与法国目标 #22 为文本重建，详见 docs/imperial-elegy/CORRECTIONS.md。" : "Assets come from VASSAL module 1.1.0-beta.4; card text follows the printed faces and OCR was advisory only. Wilhelm II #82 and French goal #22 are text reconstructions; see docs/imperial-elegy/CORRECTIONS.md."}</p>
          </div>
        </IEPanel>
      )}
    </IESurface>
  );
};
