/**
 * Pure (non-React) helpers shared across the Imperial Elegy board panels.
 */
import {ImperialElegyState, Power, SpaceId, Unit} from "../types";
import {SPACES, spaceLabel} from "../constant/spaces";
import {POWER_DEFS} from "../constant/powers";
import {MINOR_POWER_HOMES} from "../constant/setup";
import {gwAllyImpulseFor, minorController} from "../engine/rules";
import {ieT} from "./i18n";
import type {GwImpulseReason} from "../engine/gwImpulse";
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
 * 12.8 / 15.4 / 26.3: whether `viewer` commands `unit` for an action.
 *
 * The seat always commands its own units, and during a US/Italian Great War
 * impulse it commands that major's units.  An allied minor power's ordinary
 * army/fleet counters join their controller during a war — limited (`wartime`)
 * or the Great War (`gwManeuver`) — but never during peace, and never
 * during a US/Italian impulse (26.3 only moves that major's own units).
 *
 * The Space panel, the Orders rows and the map one-click layer must share this
 * answer: otherwise the picker offers a chip the map then ignores.
 */
export const unitIsCommanded = (
  G: ImperialElegyState,
  viewer: Power | null,
  unit: Unit,
  phase: string,
): boolean => {
  if (viewer === null) return false;
  const commandedOwner = gwAllyImpulseFor(G, viewer) ?? viewer;
  if (unit.owner === commandedOwner) return true;
  if (commandedOwner !== viewer) return false;
  if (phase !== "wartime" && phase !== "gwManeuver") return false;
  if (isPowerKey(unit.owner) || unit.owner === "US" || unit.owner === "IT") return false;
  return minorController(G, unit.owner) === viewer;
};

export const gwImpulseReasonText = (locale: "en" | "zh_CN", reason: GwImpulseReason | null): string | undefined => {
  if (reason === null) return undefined;
  const labels: Record<GwImpulseReason, [string, string]> = {
    busy: ["Finish the pending choice or battle first.", "请先处理待决选择或战斗。"],
    notActive: ["Only during your GW maneuver impulse.", "仅限自己的大战机动行动轮。"],
    notBelligerent: ["Neutral players may only play an event.", "中立玩家只能打出事件。"],
    budget: ["No war-budget CP remains.", "战争预算 CP 已耗尽。"],
    actionUsed: ["The budget action is complete; end the impulse or play a GW card.", "预算行动已完成；结束本轮或打出大战卡。"],
    repeatAction: ["The card bonus cannot repeat this impulse's action.", "卡牌奖励不能重复本轮已执行的行动。"],
    bonusLandBattle: ["No land battle in an impulse using a card bonus action.", "使用卡牌奖励行动的本轮不能发动陆战。"],
    bonusPending: ["Spend the card's immediate bonus action first.", "请先执行卡牌授予的即时奖励行动。"],
    exhaustion: ["Play Exhaustion before passing or spending your final budget CP.", "停牌或花掉最后 1 点预算前，必须打出“精疲力竭”。"],
    mustAct: ["Take a budget action first; passing requires a budget of at most 2.", "请先执行预算行动；预算不超过 2 时才可停牌。"],
    cardWindow: ["This impulse's card window is closed.", "本轮卡牌窗口已关闭。"],
    battleCard: ["This card's event belongs in its printed battle window.", "此牌事件须在规定的战斗窗口使用。"],
    majorCard: ["Your card cannot fund a US/Italian impulse.", "玩家卡牌不能用于美意行动轮。"],
  };
  return bi(locale, ...labels[reason]);
};

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

/**
 * Fixed decision prompts: the engine writes one canonical English sentence and
 * the board prints the Chinese here.  A prompt that interpolates state (a power
 * or space name, a count) cannot be looked up and carries its own `promptZh`
 * from the engine instead.
 */
export const PROMPT_ZH: Record<string, string> = {
  "Declare supporting armies or pass": "宣布支援军团或跳过",
  "Declare attacking support or pass": "宣布进攻方支援或跳过",
  "Declare defending support or pass": "宣布防守方支援或跳过",
  "Play a combat card or continue": "打出战斗牌或继续",
  "Choose a space": "选择一个空间",
  "Choose a power": "选择一个国家",
  "Choose a player": "选择一名玩家",
  "Choose a player controlling a minority-nationality space": "选择控制少数民族空间的玩家",
  "Choose an event option": "选择一个事件选项",
  "Choose a unit to take a step loss": "选择承受步骤损失的单位",
  "Choose a unit (main force or a supporting army) to take a step loss": "选择承受步骤损失的单位（主力或支援军团）",
  "Choose a unit in the main force to take a step loss": "选择主力中承受步骤损失的单位",
  "Decisive victory: take another land battle action or move one additional space for free": "决定性胜利：再发动一次陆战，或免费额外移动一格",
  "At Any Cost: discard a card to play it from the discard pile": "不惜一切：弃 1 张手牌以从弃牌堆打出",
  "Choose an option": "选择一个选项",
  "Draw three National Goals and keep one": "抽三张国家目标并保留一张",
  "Allocate influence": "分配影响力",
  "Roll on the Crisis Table": "在危机表上掷骰",
  "Choose a colonial space": "选择一个殖民空间",
  "Choose an African space": "选择一个非洲空间",
  "Choose a space being pacified": "选择一个正在绥靖的空间",
  "Shift your alliance marker": "移动你的联盟标记",
  "Give the card to the Ottomans or Russians": "将牌交给奥斯曼或俄国",
  "Declare war": "宣战",
  "Choose a minor power": "选择一个小国",
  "Choose a treaty option": "选择条约选项",
  "Choose a treaty space": "选择条约空间",
  "Colonial war: choose an unoccupied space to take": "殖民战争：选择一个无人占领的空间",
  "Rebellions in China: place a control marker in Qing China": "中国叛乱：在清帝国放置 1 个控制标记",
  "Rebellions in China: place your control marker in Qing China": "中国叛乱：在清帝国放置你的控制标记",
  "Colonial war: choose a unit to take the loss": "殖民战争：选择承受损失的单位",
  "Unstable Situation: discard a random card or take a -1 card marker": "动荡局势：随机弃 1 张牌或获得 -1 抽牌标记",
  "Neutral player: join an alliance or stay out": "中立国：加入同盟或保持中立",
  "Choose the alliance your neutral player joins": "选择你的中立国加入的同盟",
  "Choose the space for the free deploy reserves": "选择免费部署预备军的位置",
  "Choose the free redeployment destination": "选择免费重新部署的目的地",
  "Choose a unit for the free redeployment": "选择免费重新部署的单位",
  "Choose": "选择",
  "Return to port: choose a nearest friendly port": "返回港口：选择一个最近的友方港口",
  "Accept the attacker's surrender or continue the war?": "接受进攻方投降，还是继续战争？",
  "Balance of Power: choose one invited ally to draw a card": "均势：选择一位应邀参战的盟友抽一张牌",
  "Bonus impulse: choose an alliance member or pass": "奖励行动轮：选择一位联盟成员行动，或跳过",
  /* --- Combat and naval windows ------------------------------------ */
  "19.1 interception won: finish the interrupted naval movement or stop here": "19.1 拦截成功：完成被中断的海军移动或停在此处",
  "19.4 mines: take all mine hits and fight on, or retreat after the first two hits": "19.4 水雷：承受全部水雷命中继续战斗，或在头两次命中后撤退",
  "19.8: move any participating units into adjacent friendly port space(s), or stay at sea": "19.8：将任意参战单位移入相邻友方港口空间，或留在海上",
  "Commit an elite unit for its printed +1? (attacker)": "投入精英单位以获得其印制的 +1？（进攻方）",
  "Commit an elite unit for its printed +1? (defender)": "投入精英单位以获得其印制的 +1？（防守方）",
  "Miscommunication: choose a space that cannot provide support": "沟通失误：选择一个无法提供支援的空间",
  "Choose which side rerolls its battle die": "选择哪一方重掷战斗骰",
  "Hydraulic Recoil: inflict +1 loss to both sides?": "液压后坐：双方各承受 +1 损失？",
  "Naval retreat: choose the space(s) the defeated fleet retreats to": "海军撤退：选择战败舰队撤退的空间",
  "Retreat: choose the space(s) the defeated force retreats to": "撤退：选择战败部队撤退的空间",
  "Trench battle: choose the space the defeated force retreats to": "堑壕战：选择战败部队撤退的空间",
  "Naval interception: a port may attempt to intercept the move before the defender decides whether to avoid battle": "海上拦截：港口可在防守方决定是否避战前尝试拦截此次移动",
  "Port battle adjacent to two naval boxes: the attacker chooses the box used for the 19.5 port-count DRMs": "邻接两个海军区的港口战斗：进攻方选择用于 19.5 港口计数 DRM 的海军区",
  "Naval battle: attempt to avoid battle (choose the destination before rolling) or fight": "海战：尝试避战（掷骰前选择目的地）或迎战",
  /* --- Card events --------------------------------------------------- */
  "Economic Panic: discard a random card or lose one stability": "经济恐慌：随机弃 1 张牌或失去 1 点稳定",
  "World's Fair: discard a card?": "世界博览会：弃 1 张牌？",
  "Modernization: offer the Ottomans a card?": "现代化：向奥斯曼提供 1 张牌？",
  "Modernization: accept one offered card": "现代化：接受 1 张被提供的牌",
  "Berlin Conference: you may place the Belgian control marker in Africa": "柏林会议：你可以在非洲放置比利时的控制标记",
  "Urabi Revolt: play a card face down (its CP is your bid) or pass": "乌拉比起义：暗置打出 1 张牌（其 CP 为你的出价）或跳过",
  "Moroccan Crisis: play a card face down (its CP is your bid) or pass": "摩洛哥危机：暗置打出 1 张牌（其 CP 为你的出价）或跳过",
  "Moroccan Crisis: you may play a card to help one side": "摩洛哥危机：你可以打出 1 张牌帮助一方",
  "The Balkan Wars: give Macedonia to Greece, Bulgaria, Serbia or the Ottomans": "巴尔干战争：将马其顿交给希腊、保加利亚、塞尔维亚或奥斯曼",
  "Decrease stability by 1 or discard a random card": "降低 1 点稳定或随机弃 1 张牌",
  "Polish Revolt: decrease stability by 1 or discard a random card": "波兰起义：降低 1 点稳定或随机弃 1 张牌",
  "Polish Revolt: choose a player controlling a Polish space": "波兰起义：选择控制波兰空间的玩家",
  "Revolution of 1905: decrease stability by 1 or discard a random card": "1905 年革命：降低 1 点稳定或随机弃 1 张牌",
  "Rebellions in China: choose another player to place a control marker": "中国叛乱：选择另一名玩家放置控制标记",
  "Empire of the Sun: discard a random card to give Japan -1?": "日出之国：随机弃 1 张牌让日本 -1？",
  "Empire of the Sun: choose Korea or Manchuria": "日出之国：选择朝鲜或满洲",
  "The Balkan Wars: choose another Ottoman space to gain independence": "巴尔干战争：选择另一个奥斯曼空间独立",
  "The Balkan Wars: choose an Ottoman Balkan space to gain independence": "巴尔干战争：选择一个奥斯曼巴尔干空间独立",
  "Submarines: you may add +2 or -2 to the die before rolling": "潜艇：掷骰前你可以 +2 或 -2",
  "Submarines: choose a player that is not blockaded now or last turn": "潜艇：选择当前或上回合未被封锁的玩家",
  "Uprising in Ireland: discard a 3 or 4 CP card to ignore this event": "爱尔兰起义：弃 1 张 3 或 4 CP 的牌以忽略此事件",
  "Multicultural Empire: grant rights or attempt citizenship": "多元帝国：授予权利或尝试公民权",
  "The United States: choose American Trade or Carry a Big Stick": "美国：选择“美国贸易”或“大棒政策”",
  "Naval Arms Race: choose a non-allied player (the UK, or a shared naval box)": "海军军备竞赛：选择一个非盟国玩家（英国，或共享海军区）",
  "High Seas Fleet: choose the non-British player who gains a dreadnought": "公海舰队：选择获得 1 艘无畏舰的非英国玩家",
  "Russo-Turkish Wars: choose the Balkan minor to ally": "俄土战争：选择结盟的巴尔干小国",
  "Minor Power Entry: choose how this card resolves": "小国参战：选择此牌的结算方式",
  "Minor Power Entry: choose the minor power to mark strictly neutral": "小国参战：选择标记为严格中立的小国",
  "Minor Power Entry: choose an independent minor power to roll for": "小国参战：选择为其掷骰的独立小国",
  "Major Power Entry: shift Italy or the US toward your alliance": "大国参战：将意大利或美国向你的同盟偏移",
  "Flip a facedown GW combat card faceup": "将一张暗置的大战战斗牌翻开",
  "Political Pressure: choose a player that must attack this GW turn": "政治压力：选择本大战回合必须进攻的玩家",
  "Exhaustion: choose this GW turn's effect": "精疲力竭：选择本大战回合的效果",
  /* --- Great War flow ------------------------------------------------ */
  "Draft: choose the space for the second reduced army or an EF substitute": "征召：为第二支减员军团选择空间，或以远征军替代",
  "Colonial bonus CP: allocate the next CP or reject the split": "殖民奖励 CP：分配下一个 CP 或拒绝该分配",
  "Free actions after joining the war": "参战后的免费行动",
  "Free actions while staying neutral": "保持中立期间的免费行动",
  /* --- War, treaties and the end phase ------------------------------- */
  "Free demobilization actions: move any or all eligible units, then done": "免费复员行动：移动任意或全部符合条件的单位，然后完成",
  "German Confederation: take control of one German minor ally": "德意志邦联：控制一个德意志小国盟友",
  "Napoleon's Legacy: reveal this National Goal for a 2-point stability discount?": "拿破仑的遗产：公开此国家目标以换取 2 点稳定折扣？",
  "The Franco-Prussian War: concede defeat and skip the war, or fight it out?": "普法战争：认输跳过战争，还是打到底？",
  "Remove one of these National Goals from the deck?": "从牌堆中移除其中一张国家目标？",
  "Blood and Iron!: search the NG deck for Unification! and play it faceup?": "铁血政策：在国家目标牌堆中搜寻“统一！”并公开打出？",
  "Maintaining the Status Quo: the UK invites you to join the war": "维持现状：英国邀请你参战",
  "A player ally has called you to war": "一位玩家盟友召唤你参战",
  "The UK offers to become the primary belligerent on your side": "英国提出成为你方的主要交战国",
  "Dardanelles passage: grant or refuse permission for the Black Sea / Eastern Mediterranean crossing": "达达尼尔海峡：准许或拒绝黑海／东地中海航道通行",
  "Overstacked: choose the unit that takes the step loss": "超编：选择承受步骤损失的单位",
  "Broken LoC: choose the unit that takes the step loss": "补给线中断：选择承受步骤损失的单位",
};

/** Fixed decision options: the board's fallback for an engine label with no `labelZh`. */
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
  /* --- Combat and naval windows ------------------------------------ */
  "Decline the decisive-battle bonus": "放弃决定性会战奖励",
  "Choose each unit's port individually (complete 19.8 split)": "逐个为单位选择港口（完成 19.8 分配）",
  "Stay at sea (finish the battle here)": "留在海上（在此结束战斗）",
  "Leave this unit at sea": "该单位留在海上",
  "Leave the whole force at sea": "整支舰队留在海上",
  /* --- Card events --------------------------------------------------- */
  "Play no card": "不打出牌",
  "Decline the Belgian control marker": "不放置比利时控制标记",
  "Stay out of the crisis": "置身危机之外",
  "Discard a random card (-1 to Japan's roll)": "随机弃 1 张牌（日本掷骰 -1）",
  "Keep the cards": "保留这些牌",
  "Do not take control of a German minor": "不控制任何德意志小国",
  "Search for Unification! (NG-08) and reveal it": "搜寻“统一！”（NG-08）并公开",
  "Draw National Goals normally": "正常抽取国家目标",
  "Grant permission": "准许通行",
  "Refuse permission": "拒绝通行",
  /* --- White peace --------------------------------------------------- */
  "Propose our side chooses first": "提议我方先选",
  "Propose the defending side chooses first": "提议防守方先选",
  "Accept the proposed order": "接受提议的顺序",
  "Counter-propose the other order": "反提议另一种顺序",
  "Accept the defender's order": "接受防守方的顺序",
  /* --- Free actions and treaties ------------------------------------- */
  "Finish treaties": "完成条约",
  "Done with free actions": "结束免费行动",
  "Stop here (finish the movement)": "停在此处（结束移动）",
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

/**
 * Why a response card cannot be played, in both languages.
 *
 * The tray needs these strings per reason key (it holds no locale switch of its
 * own), so the table is exported and `responseReasonText` reads it for the
 * places that want one language.
 */
export const RESPONSE_REASON_TEXT: Record<ResponseBlockReason, {en: string; zh_CN: string}> = {
  "no-seat": {en: "Only a seated player can respond.", zh_CN: "仅入座玩家可以打出响应。"},
  "pending": {en: "Resolve the pending decision first.", zh_CN: "请先处理待决事项。"},
  "phase": {en: "Responses are played at the start of an impulse.", zh_CN: "响应牌需在行动轮开始时打出。"},
  "not-active": {en: "Only the active power can play a response now.", zh_CN: "仅当前行动国家可以打出响应。"},
  "war-status": {en: "A limited-war response needs its printed alliance or maneuver step.", zh_CN: "有限战争响应需在其联盟或机动阶段打出。"},
  "no-gw": {en: "The Great War is not active.", zh_CN: "大战尚未开始。"},
  "battle": {en: "Finish the battle window first.", zh_CN: "请先处理战斗窗口。"},
  "cp-spent": {en: "A response must be played before CP is spent in the impulse.", zh_CN: "响应牌须在本次行动消耗 CP 之前打出。"},
  "battle-window-card": {en: "This card is played in the battle window.", zh_CN: "此牌需在战斗窗口打出。"},
  "war-only": {en: "This card can only be played during a limited war.", zh_CN: "此牌只能在有限战争期间打出。"},
  "gw-only": {en: "This card can only be played during the Great War.", zh_CN: "此牌只能在大战期间打出。"},
  "not-response": {en: "This is not a response card.", zh_CN: "此牌不是响应牌。"},
  "young-turks": {en: "The Young Turks has been played; this response is closed.", zh_CN: "“青年土耳其党”已打出，此响应窗口已关闭。"},
  "printed-power": {en: "This response can only be played at the start of the printed power's impulse.", zh_CN: "此响应牌只能在卡面指定国家的行动轮开始时打出。"},
  "no-effect-gw": {en: "This event has no effect during the Great War.", zh_CN: "此事件在大战期间无效。"},
  "crisis-window": {en: "Play this only when the WTT reaches 5 and the crisis roll is open.", zh_CN: "仅在世界紧张达到 5 且危机掷骰待决时打出。"},
  "impulsive-ruler": {en: "This card cannot be played in response to Impulsive Ruler.", zh_CN: "此牌不能响应“冲动统治者”打出。"},
  "france-trigger": {en: "France must have lost a war or lost stability this turn.", zh_CN: "法国必须在本回合输掉战争或失去稳定度。"},
  "russia-trigger": {en: "Russian stability must have been decreased.", zh_CN: "俄国必须已失去稳定度。"},
  "pacification-window": {en: "Play this before a pacification roll, not at the start of an impulse.", zh_CN: "此牌须在绥靖掷骰前打出，而不是在行动轮开始时。"},
  "not-a-card": {en: "Unknown card.", zh_CN: "未知卡牌。"},
};

/** Why the response button is disabled, in the player's language. */
export const responseReasonText = (locale: "en" | "zh_CN", reason: ResponseBlockReason | undefined): string => {
  if (reason !== undefined && RESPONSE_REASON_TEXT[reason] !== undefined) {
    return locale === "zh_CN" ? RESPONSE_REASON_TEXT[reason].zh_CN : RESPONSE_REASON_TEXT[reason].en;
  }
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
    case "crisis-window": return bi(locale, "Play this only when the WTT reaches 5 and the crisis roll is open.", "仅在世界紧张达到 5 且危机掷骰待决时打出。");
    case "impulsive-ruler": return bi(locale, "This card cannot be played in response to Impulsive Ruler.", "此牌不能响应“冲动统治者”打出。");
    case "france-trigger": return bi(locale, "France must have lost a war or lost stability this turn.", "法国必须在本回合输掉战争或失去稳定度。");
    case "russia-trigger": return bi(locale, "Russian stability must have been decreased.", "俄国必须已失去稳定度。");
    case "pacification-window": return bi(locale, "Play this before a pacification roll, not at the start of an impulse.", "此牌须在绥靖掷骰前打出，而不是在行动轮开始时。");
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

/**
 * Unit kinds as the pickers print them, one abbreviation per language.
 *
 * The Chinese column is what the Space page, the naval panels and the pending
 * options show; without it a zh_CN board printed "GE army · full" in English.
 */
const UNIT_KIND_LABEL: Record<string, {en: string; zh: string}> = {
  army: {en: "army", zh: "军团"},
  reserveArmy: {en: "R army", zh: "预备军"},
  eliteCorps: {en: "EC", zh: "精英军"},
  expeditionary: {en: "EF", zh: "远征军"},
  eliteColonialEf: {en: "colonial EF", zh: "殖民远征军"},
  zouave: {en: "zouave", zh: "祖阿夫"},
  minorArmy: {en: "minor army", zh: "小国军团"},
  rebelArmy: {en: "rebel army", zh: "叛军"},
  italianArmy: {en: "Italian army", zh: "意大利军团"},
  usArmy: {en: "US army", zh: "美军"},
  squadron: {en: "Sq", zh: "分舰队"},
  dreadnought: {en: "Dn", zh: "无畏舰"},
};

/**
 * A unit's chip label: owner code, kind and whether it is at full strength.
 *
 * `locale` defaults to English so the engine-side callers that only need a
 * stable debug string stay unchanged; every board caller passes the UI
 * language.
 */
export const unitLabel = (u: Unit, t: ReturnType<typeof ieT>, locale: "en" | "zh_CN" = "en"): string => {
  const kind = UNIT_KIND_LABEL[u.kind];
  const base = kind === undefined ? u.kind : bi(locale, kind.en, kind.zh);
  const strength = u.steps > 1
    ? bi(locale, " · full", " · 满编")
    : bi(locale, " · reduced", " · 减员");
  return `${u.owner} ${base}${strength}`;
};

// Satisfy the import of ImperialElegyState (used in some re-exports) without
// actually needing it at runtime — this avoids a lint warning.
export type {ImperialElegyState, SpaceId};
