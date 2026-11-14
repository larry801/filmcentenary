/**
 * Pure (non-React) helpers shared across the Imperial Elegy board panels.
 */
import {ImperialElegyState, Power, SpaceId, Unit} from "../types";
import {SPACES, spaceLabel} from "../constant/spaces";
import {POWER_DEFS} from "../constant/powers";
import {MINOR_POWER_HOMES} from "../constant/setup";
import {ieT} from "./i18n";
import {
  type AmphibiousBlockReason,
  type NavalInterceptBlockReason,
  type NavalTransportBlockReason,
  type ResponseBlockReason,
} from "../moves";

export const POWER_KEYS: Power[] = ["GE", "UK", "FR", "AU", "RU", "OT"];

export const isPowerKey = (value: unknown): value is Power =>
  typeof value === "string" && (POWER_KEYS as string[]).includes(value);

/** Bilingual helper for labels that have no key in i18n.ts yet. */
export const bi = (locale: "en" | "zh_CN", en: string, zh: string): string =>
  locale === "zh_CN" ? zh : en;

/**
 * Pick the selector value: keep the current choice when it is legal, otherwise
 * fall back to the first legal option (or the first choice so its eligibility
 * reason is still visible when nothing is legal).
 */
export const pickActionTarget = (current: string, choices: readonly string[], eligible: readonly string[]): string => {
  if (current !== "" && eligible.includes(current)) return current;
  if (eligible.length > 0) return eligible[0];
  if (current !== "" && choices.includes(current)) return current;
  return choices[0] ?? "";
};

export const PROMPT_ZH: Record<string, string> = {
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

export const BATTLE_STAGE: Record<string, {en: string; zh: string}> = {
  support: {en: "Support", zh: "支援"},
  cards: {en: "Combat cards", zh: "战斗牌"},
  roll: {en: "Roll", zh: "掷骰"},
  lossesAttack: {en: "Attacker losses", zh: "攻方损失"},
  lossesDefense: {en: "Defender losses", zh: "守方损失"},
  retreat: {en: "Retreat", zh: "撤退"},
  advance: {en: "Advance", zh: "推进"},
  done: {en: "Done", zh: "结束"},
};

export const OPTION_ZH: Record<string, string> = {
  "No more support": "不再支援",
  "Continue": "继续",
  "Roll": "掷骰",
  "Pass": "跳过",
  "Triple Entente": "协约国",
  "Triple Alliance": "同盟国",
  "Neutral": "中立",
  "Fight the naval battle": "进行海战",
  "Do not intercept": "不拦截",
  "Take no further space": "不再夺取空间",
};

/** Why the response button is disabled, in the player's language. */
export const responseReasonText = (locale: "en" | "zh_CN", reason: ResponseBlockReason | undefined): string => {
  switch (reason) {
    case "no-seat": return bi(locale, "Only a seated player can respond.", "仅入座玩家可以打出响应。");
    case "pending": return bi(locale, "Resolve the pending decision first.", "请先处理待决事项。");
    case "phase": return bi(locale, "Responses are played at the start of an impulse.", "响应牌需在行动轮开始时打出。");
    case "not-active": return bi(locale, "Only the active power can play a response now.", "仅当前行动国家可以打出响应。");
    case "war-status": return bi(locale, "A limited-war response needs its printed alliance or maneuver step.", "有限战争响应需在其联盟或机动阶段打出。");
    case "no-gw": return bi(locale, "The Great War is not active.", "大战尚未开始。");
    case "battle": return bi(locale, "Finish the battle window first.", "请先处理战斗窗口。");
    case "cp-spent": return bi(locale, "A response must be played before CP is spent in the impulse.", "响应牌须在本次行动消耗 CP 之前打出。");
    case "battle-window-card": return bi(locale, "This card is played in the battle window.", "此牌需在战斗窗口打出。");
    case "war-only": return bi(locale, "This card can only be played during a limited war.", "此牌只能在有限战争期间打出。");
    case "gw-only": return bi(locale, "This card can only be played during the Great War.", "此牌只能在大战期间打出。");
    case "not-response": return bi(locale, "This is not a response card.", "此牌不是响应牌。");
    case "young-turks": return bi(locale, "The Young Turks has been played; this response is closed.", "“青年土耳其党”已打出，此响应窗口已关闭。");
    case "printed-power": return bi(locale, "This response can only be played at the start of the printed power's impulse.", "此响应牌只能在卡面指定国家的行动轮开始时打出。");
    case "no-effect-gw": return bi(locale, "This event has no effect during the Great War.", "此事件在大战期间无效。");
    case "not-a-card": return bi(locale, "Unknown card.", "未知卡牌。");
    default: return bi(locale, "A response is played at the start of an eligible impulse.", "响应牌需在符合条件的行动轮开始时打出。");
  }
};

/** Why the 12.3 transport button is disabled, in the player's language. */
export const transportReasonText = (
  locale: "en" | "zh_CN",
  reason: NavalTransportBlockReason | undefined,
): string | undefined => {
  switch (reason) {
    case undefined: return undefined;
    case "busy": return bi(locale, "Resolve the pending decision or battle first.", "请先处理待决事项或战斗。");
    case "phase": return bi(locale, "Naval transport is only available in a maneuver impulse.", "海上运输仅在机动行动轮可用。");
    case "not-active": return bi(locale, "Only the active power may transport.", "仅当前行动国家可以进行海上运输。");
    case "no-budget": return bi(locale, "A naval movement action costs 1 CP.", "海上移动行动需要 1 CP。");
    case "land-unit": return bi(locale, "Choose one of your land units in the port or box.", "请选择港口或海域中的本国陆军单位。");
    case "land-kind": return bi(locale, "Only an army-type land unit can be carried by sea.", "只有军团类陆军单位可以随舰队海运。");
    case "naval-unit": return bi(locale, "The escorting naval units must all be yours.", "护航的海军单位必须全部属于你。");
    case "different-origin": return bi(locale, "The fleet and the land unit must start in the same space.", "舰队与陆军单位必须从同一空间出发。");
    case "origin-not-port": return bi(locale, "The land unit must start in a port or naval box.", "陆军单位必须从港口或海域出发。");
    case "origin-hostile": return bi(locale, "You cannot load transports in an enemy port.", "不能在敌方港口装载运输船。");
    case "same-space": return bi(locale, "The destination must be a different port.", "目的地必须是另一个港口。");
    case "target-not-port": return bi(locale, "The destination must be a coastal port.", "目的地必须是沿海港口。");
    case "target-hostile": return bi(locale, "Land units cannot land in an enemy port (19.10); use an amphibious assault.", "陆军不能登陆敌方港口（19.10），请使用两栖登陆。");
    case "path": return bi(locale, "No legal naval path with one NMP.", "在 1 个海军移动点内没有合法航线。");
    case "army-stacking": return bi(locale, "The destination would exceed the army stacking limit (5.5.3).", "目的地将超过陆军堆叠上限（5.5.3）。");
    case "port-capacity": return bi(locale, "The destination port would hold more than four naval units (5.5.4).", "目的地港口将超过 4 个海军单位上限（5.5.4）。");
    case "trench-exit": return bi(locale, "A unit leaving a trench battle space must first enter a friendly or trench space (28.1.5).", "离开战壕战空间的单位必须先进入友好或战壕空间（28.1.5）。");
    case "us-north-america": return bi(locale, "32.1: US armies cannot leave North America until the enemy-held Mexico/Canada gate is occupied.", "32.1：在占领敌方控制的墨西哥/加拿大之前，美军不能离开北美。");
    case "no-seat": return bi(locale, "Only a seated player may transport.", "仅入座玩家可以进行海上运输。");
    default: return bi(locale, "The naval transport is not legal.", "海上运输不合法。");
  }
};

/** Why the amphibious-assault button is disabled, in the player's language. */
export const amphibiousReasonText = (
  locale: "en" | "zh_CN",
  check: {reason?: AmphibiousBlockReason; enemyNaval?: number; ownNaval?: number; needShips?: number; room?: number},
): string | undefined => {
  switch (check.reason) {
    case undefined: return undefined;
    case "no-seat": return bi(locale, "Only a seated player can launch an assault.", "仅入座玩家可以发动两栖突击。");
    case "not-active": return bi(locale, "Only the active power can launch an assault now.", "仅当前行动国家可以发动两栖突击。");
    case "phase": return bi(locale, "Amphibious assaults happen in the action or limited-war phase.", "两栖突击只能在行动阶段或有限战争阶段发动。");
    case "busy": return bi(locale, "Resolve the pending decision or battle first.", "请先处理待决事项或战斗。");
    case "no-cp": return bi(locale, "Needs 1 CP in this impulse.", "本行动轮需要 1 CP。");
    case "unit-count": return bi(locale, "Choose one or two loaded armies.", "请选择 1 至 2 个已装载军团。");
    case "target-port": return bi(locale, "The target must be an enemy coastal port.", "目标必须是敌方沿海港口。");
    case "target-friendly": return bi(locale, "That port is friendly; only enemy ports may be assaulted.", "该港口属于友方；只能突击敌方港口。");
    case "origin": return bi(locale, "Choose a friendly port or a naval box as the origin.", "请选择友方港口或海域作为出发地。");
    case "origin-not-adjacent": return bi(locale, "The origin is not adjacent to that port.", "出发地与目标港口不相邻。");
    case "army": return bi(locale, "Only your own land armies can land.", "只能装载本国陆军军团。");
    case "army-location": return bi(locale, "The armies must be loaded in the origin box or port.", "军团必须在出发海域或装载港口。");
    case "escort": {
      const need = check.needShips ?? (check.enemyNaval ?? 0) * 2;
      return bi(locale,
        `Enemy naval presence: ${check.enemyNaval ?? 0} ships. You need a 2:1 escort (${need} ships); you have ${check.ownNaval ?? 0}.`,
        `敌方海上力量：${check.enemyNaval ?? 0} 艘。需要 2:1 护航（${need} 艘），你现有 ${check.ownNaval ?? 0} 艘。`);
    }
    case "landing-room": return bi(locale, "There is no landing room for another army in that port.", "该港口已无空间让军团登陆。");
    default: return bi(locale, "This assault is not legal.", "该两栖突击不合法。");
  }
};

/** Why the interception button is disabled, in the player's language. */
export const interceptReasonText = (
  locale: "en" | "zh_CN",
  check: {reason?: NavalInterceptBlockReason; mover?: Power; ships?: number},
): string | undefined => {
  switch (check.reason) {
    case undefined: return undefined;
    case "no-seat": return bi(locale, "Only a seated player can intercept.", "仅入座玩家可以拦截。");
    case "busy": return bi(locale, "Resolve the pending decision or battle first.", "请先处理待决事项或战斗。");
    case "phase": return bi(locale, "Interception happens during an action, limited-war or GW maneuver phase.", "拦截只能发生在行动、有限战争或大战机动阶段。");
    case "port": return bi(locale, "Choose one of your ports and the adjacent naval box.", "请选择己方港口与其相邻海域。");
    case "port-not-adjacent": return bi(locale, "That port does not touch the naval box.", "该港口与目标海域不相邻。");
    case "not-owner": return bi(locale, "You must control the intercepting port.", "你必须控制拦截港口。");
    case "no-naval-move": return bi(locale, "There is no naval move to intercept.", "当前没有可拦截的海军移动。");
    case "not-defender": return bi(locale, "Only the defender can intercept the enemy's naval move.", "只有防御方可以拦截敌方的海军移动。");
    case "not-active": return bi(locale, "The intercepting window belongs to the mover's impulse.", "拦截窗口属于移动方的行动轮。");
    case "not-at-war": return bi(locale, "You are not at war with that power.", "你与该国不处于战争状态。");
    case "no-ships": return bi(locale, "No naval units are in the intercepting port.", "拦截港口内没有海军单位。");
    default: return bi(locale, "This interception is not legal.", "该拦截不合法。");
  }
};

export const PHASE_LABEL = (t: ReturnType<typeof ieT>, phase: string): string =>
  (t.phases as Record<string, string>)[phase] ?? phase;

export const controlLabel = (t: ReturnType<typeof ieT>, control: string | null): string => {
  if (control === null) return "—";
  if ((POWER_KEYS as string[]).includes(control)) return t.seats[control as Power];
  return control;
};

/**
 * Names that are not a player seat but still appear as war defenders or as
 * 16.2.3 war-reparation marker holders.
 */
export const EXTRA_NON_PLAYER_LABELS: Record<string, {en: string; zh: string}> = {
  IT: {en: "Italy", zh: "意大利"},
  Italy: {en: "Italy", zh: "意大利"},
  US: {en: "United States", zh: "美国"},
  "United States": {en: "United States", zh: "美国"},
  Japan: {en: "Japan", zh: "日本"},
  "Qing China": {en: "Qing China", zh: "清帝国"},
  "German minors": {en: "the German minors", zh: "德意志诸小国"},
};

/**
 * Display name for a player power or a non-player power.
 */
export const powerOrMinorLabel = (
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

export const unitLabel = (u: Unit, t: ReturnType<typeof ieT>): string => {
  const base = u.kind === "army" ? "army"
    : u.kind === "reserveArmy" ? "R army"
    : u.kind === "eliteCorps" ? "EC"
    : u.kind === "expeditionary" ? "EF"
    : u.kind === "squadron" ? "Sq"
    : u.kind === "dreadnought" ? "Dn"
    : u.kind;
  return `${u.owner} ${base}${u.steps > 1 ? " · full" : " · reduced"}`;
};

// Satisfy the import of ImperialElegyState (used in some re-exports) without
// actually needing it at runtime — this avoids a lint warning.
export type {ImperialElegyState, SpaceId};
