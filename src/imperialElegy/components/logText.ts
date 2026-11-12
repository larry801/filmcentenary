import {LogEntry, POWERS} from "../types";
import {CARD_BY_ID} from "../engine/deck";
import {POWER_DEFS} from "../constant/powers";
import {SPACES, spaceLabel} from "../constant/spaces";
import {MINOR_POWER_HOMES} from "../constant/setup";
import {ieStringsFor} from "./i18n";
import type {PlayBlockReason} from "../engine/playability";

/**
 * Bilingual, key-driven rendering for the Imperial Elegy engine log.
 *
 * The engine deliberately stores a stable key plus public arguments rather
 * than a rendered sentence.  This module is the single display-time mapping
 * from that pair to English / Simplified Chinese, so the log is not locale
 * dependent state and player views never leak raw JSON.
 */

export type LogLocale = "en" | "zh_CN";

/** The fields the formatter needs.  Full `LogEntry` values are assignable. */
export type LogTextEntry = Pick<LogEntry, "key" | "args" | "power">;

type Formatter = (entry: LogTextEntry, locale: LogLocale) => string;

const text = (locale: LogLocale, en: string, zh: string): string => (locale === "zh_CN" ? zh : en);

const str = (value: unknown): string => (value === undefined || value === null ? "" : String(value));

const num = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const bool = (value: unknown): boolean => value === true || value === "true";

const list = (value: unknown): string[] =>
  str(value).split(",").map((part) => part.trim()).filter((part) => part.length > 0);

const cardWord = (count: number): string => (count === 1 ? "card" : "cards");

const unitWord = (count: number): string => (count === 1 ? "unit" : "units");

const stepWord = (count: number): string => (count === 1 ? "step" : "steps");

const article = (word: string): string => (/^[aeiou]/i.test(word) ? "an" : "a");

const HIDDEN_CARD = "hidden";

const cardLabel = (value: unknown, locale: LogLocale): string => {
  const id = str(value);
  if (id === "") return text(locale, "an unknown card", "未知卡牌");
  if (id === HIDDEN_CARD) return text(locale, "a hidden card", "隐藏卡牌");
  const card = CARD_BY_ID[id];
  if (card === undefined) return id;
  return locale === "zh_CN" ? card.titleZh : card.title;
};

const EXTRA_POWER_LABELS: Record<string, {en: string; zh: string}> = {
  IT: {en: "Italy", zh: "意大利"},
  US: {en: "United States", zh: "美国"},
  Japan: {en: "Japan", zh: "日本"},
};

const powerLabel = (value: unknown, locale: LogLocale): string => {
  const id = str(value);
  if (id === "") return text(locale, "an unknown power", "未知势力");
  const def = (POWER_DEFS as Record<string, {name: string; nameZh: string} | undefined>)[id];
  if (def !== undefined) return locale === "zh_CN" ? def.nameZh : def.name;
  const extra = EXTRA_POWER_LABELS[id];
  if (extra !== undefined) return locale === "zh_CN" ? extra.zh : extra.en;
  return id;
};

const spaceName = (value: unknown, locale: LogLocale): string => {
  const id = str(value);
  if (id === "") return text(locale, "an unknown space", "未知地区");
  const space = SPACES[id];
  return space === undefined ? id : spaceLabel(id, locale);
};

const spaceList = (value: unknown, locale: LogLocale): string => {
  const ids = list(value);
  if (ids.length === 0) return text(locale, "none", "无");
  return ids.map((id) => spaceName(id, locale)).join(locale === "zh_CN" ? "、" : ", ");
};

const powerList = (value: unknown, locale: LogLocale): string => {
  const ids = list(value);
  if (ids.length === 0) return text(locale, "none", "无");
  return ids.map((id) => powerLabel(id, locale)).join(locale === "zh_CN" ? "、" : ", ");
};

const UNIT_KINDS: Record<string, {en: string; zh: string}> = {
  army: {en: "army", zh: "军团"},
  reserveArmy: {en: "reserve army", zh: "预备军"},
  eliteCorps: {en: "elite corps", zh: "精英军"},
  expeditionary: {en: "expeditionary force", zh: "远征军"},
  eliteColonialEf: {en: "elite colonial EF", zh: "殖民远征军"},
  zouave: {en: "zouave", zh: "祖阿夫"},
  minorArmy: {en: "minor army", zh: "小国军团"},
  rebelArmy: {en: "rebel army", zh: "叛军"},
  italianArmy: {en: "Italian army", zh: "意大利军团"},
  usArmy: {en: "US army", zh: "美军"},
  squadron: {en: "squadron", zh: "分舰队"},
  dreadnought: {en: "dreadnought", zh: "无畏舰"},
};

const unitKind = (value: unknown, locale: LogLocale): string => {
  const kind = str(value);
  const entry = UNIT_KINDS[kind];
  if (entry === undefined) return kind === "" ? text(locale, "unit", "单位") : kind;
  return locale === "zh_CN" ? entry.zh : entry.en;
};

const DECADES: Record<string, {en: string; zh: string}> = {
  "1850s": {en: "1850s", zh: "1850 年代"},
  "1860s": {en: "1860s", zh: "1860 年代"},
  "1870s": {en: "1870s", zh: "1870 年代"},
  "1880s": {en: "1880s", zh: "1880 年代"},
  "1890s": {en: "1890s", zh: "1890 年代"},
  "1900s": {en: "1900s", zh: "1900 年代"},
  "1910s": {en: "1910s", zh: "1910 年代"},
};

const decadeLabel = (value: unknown, locale: LogLocale): string => {
  const decade = str(value);
  const entry = DECADES[decade];
  if (entry !== undefined) return locale === "zh_CN" ? entry.zh : entry.en;
  return decade;
};

const AIM_LABELS: Record<string, {en: string; zh: string}> = {
  conquest: {en: "conquest", zh: "征服"},
  liberation: {en: "liberation", zh: "解放"},
  unification: {en: "unification", zh: "统一"},
};

const aimLabel = (value: unknown, locale: LogLocale): string => {
  const aim = str(value);
  const entry = AIM_LABELS[aim];
  if (entry !== undefined) return locale === "zh_CN" ? entry.zh : entry.en;
  return aim;
};

const REGION_LABELS: Record<string, {en: string; zh: string}> = {
  africa: {en: "Africa", zh: "非洲"},
  asia: {en: "Asia", zh: "亚洲"},
};

const regionLabel = (value: unknown, locale: LogLocale): string => {
  const region = str(value);
  const entry = REGION_LABELS[region];
  if (entry !== undefined) return locale === "zh_CN" ? entry.zh : entry.en;
  return region;
};

const trackLabel = (value: unknown, locale: LogLocale): string => {
  const track = str(value);
  if (track === "neutral") return text(locale, "neutral", "中立");
  if (track === "te") return "TE";
  if (track === "ta") return "TA";
  return track;
};

const sideLabel = (value: unknown, locale: LogLocale): string => {
  const side = str(value);
  if (side === "te") return "TE";
  if (side === "ta") return "TA";
  if (side === "attacker") return text(locale, "attacker", "进攻方");
  if (side === "defender") return text(locale, "defender", "防守方");
  return side;
};

/** Alliance Track boxes (25.2/25.3) as printed. */
const allianceBoxLabel = (value: unknown, locale: LogLocale): string => {
  const box = str(value);
  if (box === "teAligned") return text(locale, "TE aligned", "协约国倾向框");
  if (box === "teCommitted") return text(locale, "TE committed", "协约国承诺框");
  if (box === "taAligned") return text(locale, "TA aligned", "同盟国倾向框");
  if (box === "taCommitted") return text(locale, "TA committed", "同盟国承诺框");
  return text(locale, "neutral", "中立框");
};

const REASON_LABELS: Record<string, {en: string; zh: string}> = {
  endOfTurn7: {en: "turn limit reached", zh: "达到回合上限"},
  elimination: {en: "elimination", zh: "消灭"},
  turnLimit: {en: "turn limit", zh: "回合上限"},
  "gwTurnLimit:neutralVp": {en: "Great War turn limit: neutral VP", zh: "大战回合上限：中立国 VP"},
  "gwTurnLimit:stability": {en: "Great War turn limit: stability", zh: "大战回合上限：稳定"},
  "greatWar:te": {en: "Great War: TE victory", zh: "大战：TE 胜利"},
  "greatWar:ta": {en: "Great War: TA victory", zh: "大战：TA 胜利"},
};

const reasonLabel = (value: unknown, locale: LogLocale): string => {
  const reason = str(value);
  const entry = REASON_LABELS[reason];
  if (entry !== undefined) return locale === "zh_CN" ? entry.zh : entry.en;
  if (reason.startsWith("autoVictory:")) {
    const power = reason.slice("autoVictory:".length);
    return text(locale, `auto-victory: ${powerLabel(power, locale)}`, `自动胜利：${powerLabel(power, locale)}`);
  }
  return reason === "" ? text(locale, "game end", "游戏结束") : reason;
};

const minorLabel = (value: unknown, locale: LogLocale): string => {
  const minor = str(value);
  if (minor === "") return text(locale, "a minor power", "一个中立方");
  // The German-unification realignment treats several minors as one group.
  if (minor === "German minors") return text(locale, "the German minors", "德意志诸小国");
  const home = MINOR_POWER_HOMES[minor];
  if (home !== undefined && SPACES[home] !== undefined) return spaceLabel(home, locale);
  return minor;
};

const VICTORY_KIND_LABELS: Record<string, {en: string; zh: string}> = {
  major: {en: "major", zh: "重大"},
  normal: {en: "normal", zh: "普通"},
  defensive: {en: "defensive", zh: "防御"},
  negotiated: {en: "negotiated", zh: "协商"},
  whitePeace: {en: "white-peace", zh: "白和"},
  allyKnockout: {en: "ally-knockout", zh: "盟国崩溃"},
};

const victoryKindLabel = (value: unknown, locale: LogLocale): string => {
  const kind = str(value);
  const entry = VICTORY_KIND_LABELS[kind];
  if (entry === undefined) return kind;
  return locale === "zh_CN" ? entry.zh : entry.en;
};

const TREATY_OPTION_LABELS: Record<string, {en: string; zh: string}> = {
  territorialCession: {en: "territorial cession", zh: "领土割让"},
  realignment: {en: "realignment", zh: "重新结盟"},
  warReparations: {en: "war reparations", zh: "战争赔款"},
  righteousDefense: {en: "righteous defense", zh: "正义防御"},
  colonialCession: {en: "colonial cession", zh: "殖民地割让"},
};

const treatyOptionLabel = (value: unknown, locale: LogLocale): string => {
  const option = str(value);
  const entry = TREATY_OPTION_LABELS[option];
  if (entry === undefined) return option;
  return locale === "zh_CN" ? entry.zh : entry.en;
};

/**
 * `settleLimitedWar` reports stable codes rather than prose.  Decode the ones
 * the engine can currently emit; anything newer still renders as a readable
 * token instead of an empty sentence.
 */
const settlementIssueLabel = (value: unknown, locale: LogLocale): string => {
  const issue = str(value);
  if (issue === "") return text(locale, "an unspecified issue", "未指明的问题");
  if (issue === "no-active-war") return text(locale, "no active war", "没有正在进行的战争");
  if (issue.startsWith("too-many-treaties:")) {
    const [chosenRaw, allowedRaw] = issue.slice("too-many-treaties:".length).split(">");
    const chosen = num(chosenRaw);
    const allowed = num(allowedRaw);
    return text(
      locale,
      `${chosen} treaty ${chosen === 1 ? "option" : "options"} chosen but only ${allowed} allowed`,
      `已选 ${chosen} 个条约选项，但只允许 ${allowed} 个`,
    );
  }
  if (issue.startsWith("treaty-not-applied:")) {
    const option = treatyOptionLabel(issue.slice("treaty-not-applied:".length), locale);
    return text(locale, `${option} was not applied`, `${option}未生效`);
  }
  return issue;
};

const victorLabel = (value: unknown, locale: LogLocale): string => {
  const victor = str(value);
  if (victor === "attacker") return text(locale, "attacker victory", "进攻方胜利");
  if (victor === "defender") return text(locale, "defender victory", "防守方胜利");
  if (victor === "whitePeace") return text(locale, "white peace", "白和");
  return victor;
};

/**
 * Prefix a body with the acting power.  English needs a space, Chinese does
 * not; entries without a power read as standalone sentences.
 */
const withActor = (entry: LogTextEntry, locale: LogLocale, enBody: string, zhBody: string): string => {
  const name = entry.power === undefined ? "" : powerLabel(entry.power, locale);
  if (locale === "zh_CN") return `${name}${zhBody}`;
  return name === "" ? enBody : `${name} ${enBody}`;
};

const discardText = (reasonEn: string, reasonZh: string): Formatter => (entry, locale) => {
  const card = cardLabel(entry.args?.card, locale);
  return withActor(entry, locale, `discarded ${card}${reasonEn}.`, `弃置了 ${card}${reasonZh}。`);
};

const FORMATTERS: Record<string, Formatter> = {
  // ------------------------------------------------------------------ setup / deck
  campaignStarted: (_entry, locale) =>
    text(locale, "Campaign begins in 1850 with six powers.", "战役开始：1850 年，六强并立。"),

  seatOrder: (entry, locale) => {
    const order = list(entry.args?.order);
    const powers = (order.length > 0 ? order : [...POWERS]).map((power) => powerLabel(power, locale));
    return text(locale, `Seat order: ${powers.join(", ")}.`, `席位顺序：${powers.join("、")}。`);
  },

  deckPrepared: (entry, locale) => {
    const decade = decadeLabel(entry.args?.decade, locale);
    const entering = num(entry.args?.entering);
    const deck = num(entry.args?.deck);
    return text(
      locale,
      `Deck prepared for the ${decade}: ${entering} new ${cardWord(entering)}, ${deck} in deck.`,
      `为${decade}准备了牌堆：新增 ${entering} 张牌，牌堆共 ${deck} 张。`,
    );
  },

  deckReshuffled: (entry, locale) => {
    const deck = num(entry.args?.deck);
    return text(
      locale,
      `Discard pile reshuffled into the deck (${deck} ${cardWord(deck)}).`,
      `弃牌堆洗回牌堆（共 ${deck} 张牌）。`,
    );
  },

  cardsDrawn: (entry, locale) => {
    const count = num(entry.args?.count);
    return withActor(entry, locale, `drew ${count} ${cardWord(count)}.`, `抽了 ${count} 张牌。`);
  },

  cardRemoved: (entry, locale) => {
    const card = cardLabel(entry.args?.card, locale);
    if (entry.power === undefined) {
      return text(locale, `${card} was removed from the game.`, `${card} 被移出游戏。`);
    }
    return withActor(entry, locale, `removed ${card} from the game.`, `将 ${card} 移出游戏。`);
  },

  // `discardCard` uses a reason as the log key.  Each reason gets its own
  // readable sentence instead of falling through to the generic formatter.
  discard: discardText("", ""),
  endOfTurnDiscard: discardText(" at the end of the turn", "（回合结束时）"),
  gwOutbreakDiscard: discardText(" when the Great War broke out", "（大战爆发时）"),
  polishRevolt: discardText(" to the Polish Revolt", "（因波兰起义）"),
  nationalism: discardText(" to Nationalism", "（因民族主义）"),
  nationalistUprising: discardText(" to a nationalist uprising", "（因民族起义）"),
  economicPanic: discardText(" in the Economic Panic", "（因经济恐慌）"),
  worldsFair: discardText(" for the World's Fair", "（因世界博览会）"),
  revolution1905: discardText(" in the Revolution of 1905", "（因 1905 年革命）"),
  eventDiscard: discardText(" to a card event", "（因卡牌事件）"),
  prepStabilityDiscard: discardText(" for +1 stability", "（换取 +1 稳定）"),
  atAnyCostDiscard: discardText(" to play At Any Cost from the discard pile", "（以从弃牌堆打出不惜一切）"),

  // ------------------------------------------------------------------ action phase
  cardPlayed: (entry, locale) => {
    const card = cardLabel(entry.args?.card, locale);
    const mode = str(entry.args?.mode);
    if (mode === "cp") {
      return withActor(entry, locale, `played ${card} for CP.`, `将 ${card} 作为 CP 打出。`);
    }
    if (mode === "event") {
      return withActor(entry, locale, `played ${card} as an event.`, `将 ${card} 作为事件打出。`);
    }
    return withActor(entry, locale, `played ${card}.`, `打出 ${card}。`);
  },

  passed: (entry, locale) => withActor(entry, locale, "passed.", "停牌。"),

  warDeclared: (entry, locale) => {
    const target = powerLabel(entry.args?.target, locale);
    const aim = aimLabel(entry.args?.aim, locale);
    const objectives = spaceList(entry.args?.objectives, locale);
    return withActor(
      entry,
      locale,
      `declared war on ${target} (aim: ${aim}; objectives: ${objectives}).`,
      `向${target}宣战（战争目标：${aim}；目标空间：${objectives}）。`,
    );
  },

  combatCardPlayed: (entry, locale) => {
    const card = cardLabel(entry.args?.card, locale);
    const space = spaceName(entry.args?.space, locale);
    return withActor(
      entry,
      locale,
      `played combat card ${card} at ${space}.`,
      `在${space}打出战斗牌 ${card}。`,
    );
  },

  battleRoll: (entry, locale) => {
    const to = spaceName(entry.args?.to, locale);
    const from = spaceName(entry.args?.from, locale);
    const attack = num(entry.args?.attackerRoll);
    const defence = num(entry.args?.defenderRoll);
    const differential = num(entry.args?.differential);
    const attackerLosses = num(entry.args?.attackerLosses);
    const defenderLosses = num(entry.args?.defenderLosses);
    return withActor(
      entry,
      locale,
      `fought at ${to} (from ${from}): ${attack} vs ${defence}, differential ${differential}, losses ${attackerLosses}/${defenderLosses}.`,
      `在${to}（自 ${from}）交战：${attack} 对 ${defence}，差值 ${differential}，损失 ${attackerLosses}/${defenderLosses}。`,
    );
  },

  battleEnded: (entry, locale) => {
    const to = spaceName(entry.args?.to, locale);
    const decisive = bool(entry.args?.decisive);
    if (str(entry.args?.winner) === "defender") {
      return withActor(
        entry,
        locale,
        `lost the battle at ${to}${decisive ? " (decisive)" : ""}.`,
        `在${to}战败${decisive ? "（决战）" : ""}。`,
      );
    }
    return withActor(
      entry,
      locale,
      `won the battle at ${to}${decisive ? " (decisive)" : ""}.`,
      `在${to}赢得战斗${decisive ? "（决战）" : ""}。`,
    );
  },

  decisiveFollowUpBattle: (entry, locale) => {
    const from = spaceName(entry.args?.from, locale);
    const to = spaceName(entry.args?.to, locale);
    return withActor(
      entry,
      locale,
      `used the decisive-victory bonus to attack from ${from} to ${to}.`,
      `利用决战奖励从${from}进攻${to}。`,
    );
  },

  decisiveFollowUpMove: (entry, locale) => {
    const from = spaceName(entry.args?.from, locale);
    const to = spaceName(entry.args?.to, locale);
    return withActor(
      entry,
      locale,
      `used the decisive-victory bonus to move one space from ${from} to ${to}.`,
      `利用决战奖励从${from}移动一格至${to}。`,
    );
  },

  decisiveFollowUpFailed: (entry, locale) => {
    const to = spaceName(entry.args?.space, locale);
    return withActor(
      entry,
      locale,
      `could not use the decisive-victory bonus at ${to}.`,
      `无法在${to}使用决战奖励。`,
    );
  },

  battleReroll: (entry, locale) => {
    const side = sideLabel(entry.args?.side, locale);
    const attack = num(entry.args?.attackerRoll);
    const defence = num(entry.args?.defenderRoll);
    const differential = num(entry.args?.differential);
    const attackerLosses = num(entry.args?.attackerLosses);
    const defenderLosses = num(entry.args?.defenderLosses);
    return withActor(
      entry,
      locale,
      `rerolled the ${side} die: ${attack} vs ${defence}, differential ${differential}, losses ${attackerLosses}/${defenderLosses}.`,
      `重掷${side}掷骰：${attack} 对 ${defence}，差值 ${differential}，损失 ${attackerLosses}/${defenderLosses}。`,
    );
  },

  supportDenied: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    const battle = spaceName(entry.args?.battle, locale);
    return withActor(
      entry,
      locale,
      `denied support from ${space} in the battle at ${battle}.`,
      `阻止了${space}对${battle}之战的支援。`,
    );
  },

  noLegalTarget: (entry, locale) => {
    const card = cardLabel(entry.args?.card, locale);
    return withActor(
      entry,
      locale,
      `had no legal target for ${card}; the effect was skipped.`,
      `${card}没有合法目标，效果跳过。`,
    );
  },

  // ------------------------------------------------------------------ alliance / special effects
  allianceResolution: (entry, locale) => {
    const te = num(entry.args?.te);
    const ta = num(entry.args?.ta);
    const steps = num(entry.args?.steps);
    return withActor(
      entry,
      locale,
      `resolved alliance influence: TE ${te} vs TA ${ta}, ${steps} ${stepWord(steps)} shifted.`,
      `结算联盟影响：TE ${te} 对 TA ${ta}，移动 ${steps} 步。`,
    );
  },

  // Rule 8.2 / 14.2: the declaration-driven defender shift.
  allianceShifted: (entry, locale) => {
    const from = allianceBoxLabel(entry.args?.from, locale);
    const to = allianceBoxLabel(entry.args?.to, locale);
    const steps = num(entry.args?.steps);
    const flags: string[] = [];
    if (bool(entry.args?.statusQuo)) flags.push(locale === "zh_CN" ? "维持现状" : "Status Quo");
    if (bool(entry.args?.forced)) flags.push(locale === "zh_CN" ? "8.4 例外" : "8.4 exception");
    if (bool(entry.args?.chosen)) flags.push(locale === "zh_CN" ? "防御方选择" : "defender's choice");
    if (bool(entry.args?.fallback)) flags.push(locale === "zh_CN" ? "默认方向" : "default direction");
    if (bool(entry.args?.blocked)) flags.push(locale === "zh_CN" ? "8.4 上限" : "blocked by 8.4");
    if (entry.args?.aidMinor !== undefined) {
      const minor = powerLabel(entry.args?.aidMinor, locale);
      flags.push(locale === "zh_CN" ? `援助${minor}` : `aiding ${minor}`);
    }
    if (bool(entry.args?.random)) {
      flags.push(locale === "zh_CN" ? `意大利随机 ${num(entry.args?.roll)}` : `Italy random ${num(entry.args?.roll)}`);
    } else if (bool(entry.args?.italy)) {
      flags.push(locale === "zh_CN" ? "意大利宣战" : "Italy declaration shift");
    }
    const suffix = flags.length > 0 ? ` (${flags.join(", ")})` : "";
    return withActor(
      entry,
      locale,
      `shifted its alliance chit from ${from} to ${to} (${steps} ${stepWord(steps)})${suffix}.`,
      `将联盟标记从${from}移至${to}（${steps} 步）${suffix}。`,
    );
  },

  allianceShiftChoice: (entry, locale) => {
    const attacker = powerLabel(entry.args?.attacker, locale);
    const from = allianceBoxLabel(entry.args?.from, locale);
    return withActor(
      entry,
      locale,
      `was declared on by ${attacker} from the ${from} box and must choose the alliance box its chit shifts into (rule 8.2).`,
      `被${attacker}宣战（原位于${from}），须选择联盟标记移入的阵营框（规则 8.2）。`,
    );
  },

  woiIndependence: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    const minor = powerLabel(entry.args?.minor, locale);
    const stability = num(entry.args?.stability);
    return withActor(
      entry,
      locale,
      `${space} gained independence as ${minor}${stability < 0 ? " (the old controller loses 1 stability)" : ""}.`,
      `${space}以${minor}的身份独立${stability < 0 ? "（原控制方稳定 -1）" : ""}。`,
    );
  },

  // ------------------------------------------------------------------ 20.1 / 20.5
  militarism: (entry, locale) => {
    const choice = str(entry.args?.choice);
    const space = entry.args?.space === undefined || entry.args?.space === null
      ? ""
      : spaceName(entry.args?.space, locale);
    if (choice === "army") {
      return withActor(
        entry,
        locale,
        `took a standing army step in ${space} for Militarism (20.1).`,
        `因军事主义（20.1）在${space}获得一个常备军团步。`,
      );
    }
    if (choice === "reserve") {
      return withActor(
        entry,
        locale,
        "took a reserve army step for Militarism (20.1).",
        "因军事主义（20.1）获得一个预备军步。",
      );
    }
    if (choice === "fort") {
      const level = num(entry.args?.level);
      return withActor(
        entry,
        locale,
        `protected the level ${level} fort in ${space} from degrading (20.1).`,
        `保护${space}的 ${level} 级堡垒免于降级（20.1）。`,
      );
    }
    return withActor(
      entry,
      locale,
      "had no Militarism benefit (20.1).",
      "没有获得军事主义收益（20.1）。",
    );
  },

  manpowerExcess: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    return withActor(
      entry,
      locale,
      `eliminated a standing army in ${space} to meet the new manpower limit (20.5).`,
      `为符合新的人力上限（20.5），消灭了${space}的一个常备军团。`,
    );
  },

  nonPlayerBuild: (entry, locale) => {
    const minor = powerLabel(entry.args?.minor, locale);
    const space = spaceName(entry.args?.space, locale);
    const kind = unitKind(entry.args?.kind, locale);
    if (bool(entry.args?.promoted)) {
      if (bool(entry.args?.reserve)) {
        return text(
          locale,
          `${minor} brought its ${kind} in its reserve armies holding box up to full strength.`,
          `${minor}将其预备军集结框中的${kind}补至满员。`,
        );
      }
      return text(locale, `${minor} brought its ${kind} in ${space} up to full strength.`, `${minor}将${space}的${kind}补至满员。`);
    }
    if (bool(entry.args?.reserve)) {
      return text(
        locale,
        `${minor} placed a reduced ${kind} in its reserve armies holding box.`,
        `${minor}在其预备军集结框放入一个减员${kind}。`,
      );
    }
    return text(locale, `${minor} placed a reduced ${kind} in ${space}.`, `${minor}在${space}放置了减员${kind}。`);
  },

  nonPlayerCounterExhausted: (entry, locale) => {
    const owner = powerLabel(entry.args?.owner, locale);
    const kind = unitKind(entry.args?.kind, locale);
    const space = spaceName(entry.args?.space, locale);
    const place = str(entry.args?.space) === "" ? "" : ` in ${space}`;
    return text(
      locale,
      `${owner} could not place a ${kind}${place}: its printed 4.2 non-player counter pool is exhausted.`,
      `${owner}无法放置${kind}${str(entry.args?.space) === "" ? "" : `于${space}`}：其 4.2 非玩家计数器池已耗尽。`,
    );
  },

  meiji: (entry, locale) =>
    withActor(
      entry,
      locale,
      "proclaimed the Meiji Restoration; Japan modernizes.",
      "宣布明治维新；日本开始近代化。",
    ),

  looseGrip: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    return withActor(
      entry,
      locale,
      `seized ${space} as the old empire's grip loosened.`,
      `趁旧帝国控制松动夺取了${space}。`,
    );
  },

  looseGripRemoved: (entry, locale) =>
    withActor(
      entry,
      locale,
      "found Tunisia and Libya no longer Ottoman controlled and removed Loose Grip from the game.",
      "发现突尼斯与利比亚已不再由奥斯曼控制，将“控制松弛”移出游戏。",
    ),

  gwTurnZero: (entry, locale) => {
    const card = cardLabel(entry.args?.card, locale);
    return withActor(
      entry,
      locale,
      `played ${card}, but neither event triggers on GW turn 0.`,
      `打出了${card}，但首轮大战不触发任一效果。`,
    );
  },

  gwExhaustionActivated: (entry, locale) => {
    const mode = str(entry.args?.mode);
    return withActor(
      entry,
      locale,
      mode === "vp"
        ? "Exhaustion took effect at the end of the impulse: all Great War belligerents lose 1 VP."
        : "Exhaustion took effect at the end of the impulse: major defeats cost 2 stability this turn.",
      mode === "vp"
        ? "“精疲力竭”在行动轮结束时生效：所有大战参战方 -1 VP。"
        : "“精疲力竭”在行动轮结束时生效：本回合重大失败稳定 -2。",
    );
  },

  minorAllianceRemoved: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    return withActor(entry, locale, `removed the minor alliance at ${space}.`, `移除了${space}的小国联盟。`);
  },

  unhandledSpecial: (entry, locale) => {
    const handler = str(entry.args?.handler);
    const card = cardLabel(entry.args?.card, locale);
    return withActor(
      entry,
      locale,
      `hit the unhandled special "${handler}" for ${card}.`,
      `${card}的特殊处理“${handler}”尚未实现。`,
    );
  },

  // ------------------------------------------------------------------ Italy / Great War
  italyOttomanWar: (_entry, locale) =>
    text(
      locale,
      "Italy declares war on the Ottoman Empire for an Eastern Mediterranean base.",
      "意大利为取得东地中海基地向奥斯曼帝国宣战。",
    ),

  italyLostDream: (_entry, locale) =>
    text(locale, "Italy's imperial dream fades; no effect.", "意大利的帝国梦想破灭；本次无效。"),

  italyUnified: (_entry, locale) => text(locale, "Italy is unified.", "意大利完成统一。"),

  // 25.3: what the Alliance Track chit of a unified Italy does at the outbreak.
  gwItalyOutbreak: (entry, locale) => {
    const outcome = str(entry.args?.outcome);
    const box = allianceBoxLabel(entry.args?.box, locale);
    const side = sideLabel(entry.args?.side, locale);
    const roll = num(entry.args?.roll);
    switch (outcome) {
      case "alignedJoined":
        return text(
          locale,
          `25.3: Italy rolls ${roll} from the ${box} and joins the Great War on the ${side} side.`,
          `25.3：意大利自${box}掷出 ${roll}，加入大战，站在 ${side} 一方。`,
        );
      case "alignedWithdrew":
        return text(
          locale,
          `25.3: Italy rolls ${roll} from the ${box} and withdraws to the neutral box; it does not join the war at this time.`,
          `25.3：意大利自${box}掷出 ${roll}，退回中立框，此次不参战。`,
        );
      case "committed":
        return text(
          locale,
          `25.3: Italy is committed to the ${side} alliance and joins the Great War automatically.`,
          `25.3：意大利已承诺加入 ${side} 一方，自动参战。`,
        );
      case "blamed":
        return text(
          locale,
          `25.3: Italy is blamed for the inciting incident and joins the Great War on the ${side} side.`,
          `25.3：意大利被归咎为事件起因，加入大战，站在 ${side} 一方。`,
        );
      case "neutral":
        return text(locale, "25.3: Italy is in the neutral box and does not join the war.", "25.3：意大利位于中立框，不参战。");
      default:
        return text(locale, "25.3: Italy is not unified; it takes no part in the outbreak.", "25.3：意大利尚未统一，不参与大战爆发。");
    }
  },

  // 25.3 / 32.2: the Kingdom of Italy takes the field.
  gwItalyPresence: (entry, locale) => {
    const spaces = str(entry.args?.spaces).split(",").filter(Boolean).map((id) => spaceName(id, locale));
    const reserve = num(entry.args?.reserve);
    const placed = spaces.length === 0 ? text(locale, "no field armies", "没有野战军") : spaces.join(", ");
    return text(
      locale,
      `Italy takes the field: armies in ${placed}${reserve > 0 ? `, ${reserve} more in its reserve box` : ""}.`,
      `意大利出师：在 ${placed} 部署军团${reserve > 0 ? `，另有 ${reserve} 个置于后备区` : ""}。`,
    );
  },

  greatWarOutbreak: (entry, locale) => {
    const incident = str(entry.args?.incident);
    const incited = incident === "" ? "" : text(locale, ` (incited by ${cardLabel(incident, locale)})`, `（由${cardLabel(incident, locale)}引发）`);
    const te = powerList(entry.args?.te, locale);
    const ta = powerList(entry.args?.ta, locale);
    const neutrals = powerList(entry.args?.neutrals, locale);
    return text(
      locale,
      `The Great War breaks out${incited}. TE: ${te}; TA: ${ta}; neutrals: ${neutrals}.`,
      `大战爆发${incited}。TE：${te}；TA：${ta}；中立：${neutrals}。`,
    );
  },

  crisisRoll: (entry, locale) => {
    const roll = num(entry.args?.roll);
    const inciting = str(entry.args?.inciting);
    const incited = inciting === "" ? "" : text(locale, ` (incited by ${cardLabel(inciting, locale)})`, `（由${cardLabel(inciting, locale)}引发）`);
    return withActor(
      entry,
      locale,
      `rolled ${roll} on the Crisis Table${incited}.`,
      `在危机表上掷出 ${roll}${incited}。`,
    );
  },

  internationalConference: (_entry, locale) =>
    text(
      locale,
      "The international conference defuses the crisis; World Tension falls to 4.",
      "国际会议化解危机；世界紧张降至 4。",
    ),

  gwPlanning: (entry, locale) => {
    const turn = num(entry.args?.turn);
    return text(locale, `Great War planning begins for turn ${turn}.`, `大战第 ${turn} 回合计划阶段开始。`);
  },

  gwManeuver: (entry, locale) => {
    const turn = num(entry.args?.turn);
    return text(locale, `Great War maneuver begins for turn ${turn}.`, `大战第 ${turn} 回合机动阶段开始。`);
  },

  colonialWar: (entry, locale) => {
    const region = regionLabel(entry.args?.region, locale);
    const te = num(entry.args?.teRoll);
    const ta = num(entry.args?.taRoll);
    const teMod = num(entry.args?.teMod);
    const taMod = num(entry.args?.taMod);
    const controlling = str(entry.args?.controlling);
    const winner = str(entry.args?.winner);
    const outcome =
      winner === "te"
        ? text(locale, "TE wins", "TE 获胜")
        : winner === "ta"
          ? text(locale, "TA wins", "TA 获胜")
          : text(locale, "no winner", "无人获胜");
    const modifiers =
      teMod === 0 && taMod === 0
        ? ""
        : text(locale, ` (modifiers TE +${teMod}, TA +${taMod})`, `（修正 TE +${teMod}，TA +${taMod}）`);
    const continent =
      controlling === "te" || controlling === "ta"
        ? text(
            locale,
            ` TE controls the ${region} submap, so the other total counts as 0.`,
            ` TE 控制${region}子地图，对方总计按 0 计算。`,
          )
        : "";
    return text(
      locale,
      `Colonial war in ${region}: TE rolled ${te}, TA rolled ${ta}${modifiers}; ${outcome}.${continent}`,
      `${region}殖民战争：TE 掷出 ${te}，TA 掷出 ${ta}${modifiers}；${outcome}。${continent}`,
    );
  },

  greatWarEnded: (entry, locale) => {
    const winners = powerList(entry.args?.winners, locale);
    const reason = str(entry.args?.reason);
    const victor = str(entry.args?.victor);
    if (reason === "turnLimit") {
      return text(
        locale,
        `The Great War ends at the turn limit. Winners: ${winners}.`,
        `大战因回合上限结束。获胜者：${winners}。`,
      );
    }
    if (victor === "") {
      return text(locale, `The Great War ends. Winners: ${winners}.`, `大战结束。获胜者：${winners}。`);
    }
    const side = sideLabel(victor, locale);
    return text(
      locale,
      `The Great War ends: ${side} wins. Winners: ${winners}.`,
      `大战结束：${side} 获胜。获胜者：${winners}。`,
    );
  },

  // ------------------------------------------------------------------ power status
  auUnstable: (entry, locale) => {
    const roll = num(entry.args?.roll);
    const rights = num(entry.args?.rights);
    return withActor(
      entry,
      locale,
      `failed an Unstable Situation check (roll ${roll} + rights ${rights} < 6).`,
      `未通过不稳定局势检定（掷骰 ${roll} + 权利 ${rights} < 6）。`,
    );
  },

  frThirdRepublic: (entry, locale) =>
    withActor(entry, locale, "became the Third Republic.", "成为第三共和国。"),

  powerEliminated: (entry, locale) => withActor(entry, locale, "was eliminated.", "被消灭。"),

  // 30.1: the eliminated player's minor-power ally markers move to a surviving
  // alliance member (deterministically chosen when the allies cannot agree).
  allyMarkerReassigned: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    const from = powerLabel(entry.args?.from, locale);
    const to = str(entry.args?.to);
    if (to === "") {
      return text(
        locale,
        `The ally marker in ${space} was removed (${from} left the war).`,
        `移除${space}的盟友标记（${from}已退出战争）。`,
      );
    }
    return text(
      locale,
      `${powerLabel(to, locale)} took over the ally marker in ${space} from ${from}.`,
      `由${powerLabel(to, locale)}接替${from}在${space}的盟友标记。`,
    );
  },

  // 30.1: an eliminated player's minor allies that no surviving alliance
  // member inherited are disbanded (5.7 displacement, or elimination when the
  // minor has no friendly space with a LoC).
  minorUnitsDisbanded: (entry, locale) => {
    const minor = str(entry.args?.minor);
    const displaced = num(entry.args?.displaced);
    const eliminated = num(entry.args?.eliminated);
    return withActor(
      entry,
      locale,
      `disbanded ${minor}'s remaining forces after leaving the war (${displaced} displaced, ${eliminated} eliminated).`,
      `退出战争后解散${minor}的残余部队（移防 ${displaced} 个，消灭 ${eliminated} 个）。`,
    );
  },

  // 15.6: a limited-war ally is knocked out the moment its capital is taken
  // (recorded at the capture, so a recapture does not erase it).
  warAllyKnockout: (entry, locale) => {
    const victim = powerLabel(entry.args?.power, locale);
    const side = sideLabel(entry.args?.by, locale);
    const space = spaceName(entry.args?.capital, locale);
    return text(
      locale,
      `${victim} was knocked out of the war: the ${side} side took ${space}.`,
      `${victim}被逐出战争：${side} 一方攻占了${space}。`,
    );
  },

  wttMax: (entry, locale) => {
    const inciting = str(entry.args?.incitingCard);
    const incited = inciting === "" ? "" : text(locale, ` (incited by ${cardLabel(inciting, locale)})`, `（由${cardLabel(inciting, locale)}引发）`);
    return text(
      locale,
      `World Tension reaches its maximum${incited}.`,
      `世界紧张达到上限${incited}。`,
    );
  },

  germanUnification: (entry, locale) =>
    withActor(
      entry,
      locale,
      "completed German unification (Imperial Germany: +1 manpower from the next end phase).",
      "完成德国统一（德意志帝国：自下一个结束阶段起 +1 人力）。",
    ),

  imperialGermanyManpower: (entry, locale) =>
    withActor(entry, locale, "gained Imperial Germany's +1 manpower.", "获得德意志帝国的 +1 人力。"),

  italianUnification: (_entry, locale) => text(locale, "Italy is unified.", "意大利完成统一。"),

  superiorStaffWork: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    const count = num(entry.args?.count);
    const scope = str(entry.args?.scope) === "gw" ? text(locale, "Great War", "大战") : text(locale, "war", "战争");
    return withActor(
      entry,
      locale,
      `used Superior Staff Work to deploy ${count} reserve ${count === 1 ? "army" : "armies"} in ${space} for free during its first ${scope} impulse.`,
      `利用“卓越参谋工作”在${scope}首个行动轮免费向${space}部署 ${count} 个预备军。`,
    );
  },

  superiorStaffWorkDeclined: (entry, locale) => {
    const scope = str(entry.args?.scope) === "gw" ? text(locale, "Great War", "大战") : text(locale, "war", "战争");
    return withActor(
      entry,
      locale,
      `did not use Superior Staff Work during its first ${scope} impulse.`,
      `在${scope}首个行动轮未使用“卓越参谋工作”。`,
    );
  },

  germanConfederation: (entry, locale) => {
    const minor = str(entry.args?.minor);
    const space = spaceName(entry.args?.space, locale);
    return withActor(
      entry,
      locale,
      `used German Confederation: took control of ${minor} in ${space}, removed its units and permanently eliminated it.`,
      `使用“德意志邦联”：控制${space}的${minor}，移除其单位并永久将其消灭。`,
    );
  },

  germanConfederationDeclined: (entry, locale) =>
    withActor(entry, locale, "declined German Confederation.", "放弃了“德意志邦联”。"),

  bloodAndIron: (entry, locale) => {
    const goal = str(entry.args?.goal);
    return withActor(
      entry,
      locale,
      `used Blood and Iron! to search the NG deck for Unification! (${goal}) and played it faceup.`,
      `使用“铁血政策”从国家目标牌堆搜索“统一！”（${goal}）并明置。`,
    );
  },

  napoleonsLegacyRevealed: (entry, locale) => {
    const discount = num(entry.args?.discount);
    return withActor(
      entry,
      locale,
      `revealed Napoleon's Legacy: war-of-conquest stability losses are reduced by ${discount}.`,
      `揭示“拿破仑的遗产”：征服战争的稳定度损失减少 ${discount}。`,
    );
  },

  // ------------------------------------------------------------------ game flow
  gameOver: (entry, locale) => {
    const winners = powerList(entry.args?.winners, locale);
    const reason = reasonLabel(entry.args?.reason, locale);
    return text(locale, `Game over (${reason}). Winners: ${winners}.`, `游戏结束（${reason}）。获胜者：${winners}。`);
  },

  diplomacyStarted: (_entry, locale) => text(locale, "The Diplomacy phase begins.", "外交阶段开始。"),

  actionPhaseStarted: (_entry, locale) => text(locale, "The Action phase begins.", "行动阶段开始。"),

  homeCardChosen: (entry, locale) => {
    const card = cardLabel(entry.args?.card, locale);
    return withActor(entry, locale, `chose home card ${card}.`, `选择了本土牌 ${card}。`);
  },

  metternichAlliance: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    return text(
      locale,
      `Metternich's Legacy: ${space} joins Austria-Hungary.`,
      `梅特涅的遗产：${space}加入奥匈帝国。`,
    );
  },

  cardGiven: (entry, locale) => {
    const card = cardLabel(entry.args?.card, locale);
    const target = powerLabel(entry.args?.target, locale);
    return withActor(entry, locale, `gave ${card} to ${target}.`, `将 ${card} 交给${target}。`);
  },

  recruited: (entry, locale) => {
    const kind = unitKind(entry.args?.kind, locale);
    const space = spaceName(entry.args?.space, locale);
    if (bool(entry.args?.cw)) {
      return withActor(
        entry,
        locale,
        `recruited a CW army in ${space} (colonial manpower).`,
        `在${space}征募了自治领军（殖民地人力）。`,
      );
    }
    return withActor(
      entry,
      locale,
      `recruited ${article(kind)} ${kind} in ${space}.`,
      `在${space}征募了${kind}。`,
    );
  },

  deployedReserves: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    const count = num(entry.args?.count);
    const free = entry.args?.free === true;
    return withActor(
      entry,
      locale,
      `deployed ${count} reserve ${count === 1 ? "army" : "armies"} at ${space}${free ? " (free)" : ""}.`,
      `在${space}部署了 ${count} 个预备军${free ? "（免费）" : ""}。`,
    );
  },

  fleetBuilt: (entry, locale) => {
    const kind = unitKind(entry.args?.kind, locale);
    const space = spaceName(entry.args?.space, locale);
    return withActor(
      entry,
      locale,
      `built ${article(kind)} ${kind} at ${space}.`,
      `在${space}建造了${kind}。`,
    );
  },

  navalMove: (entry, locale) => {
    const from = spaceName(entry.args?.from, locale);
    const to = spaceName(entry.args?.to, locale);
    const count = num(entry.args?.count);
    return withActor(
      entry,
      locale,
      `moved ${count} naval ${unitWord(count)} from ${from} to ${to}.`,
      `将 ${count} 个海军单位从${from}移动到${to}。`,
    );
  },

  navalTransport: (entry, locale) => {
    const from = spaceName(entry.args?.from, locale);
    const to = spaceName(entry.args?.to, locale);
    const naval = list(entry.args?.naval).length;
    return withActor(
      entry,
      locale,
      `moved one land unit and ${naval} naval ${unitWord(naval)} by sea from ${from} to ${to}.`,
      `经海路将 1 个陆军单位和 ${naval} 个海军单位从${from}运送到${to}。`,
    );
  },

  navalReturnToPort: (entry, locale) => {
    const from = spaceName(entry.args?.from, locale);
    const to = entry.args?.to === null || entry.args?.to === undefined ? "" : spaceName(entry.args?.to, locale);
    const count = num(entry.args?.count);
    if (bool(entry.args?.eliminated)) {
      return withActor(
        entry,
        locale,
        `lost ${count} naval ${unitWord(count)} at sea: no friendly port controls them.`,
        `在海上损失 ${count} 个海军单位：没有可用的友方港口。`,
      );
    }
    return withActor(
      entry,
      locale,
      `returned ${count} naval ${unitWord(count)} from ${from} to ${to} for the end phase.`,
      `在结束阶段将 ${count} 个海军单位从${from}返回${to}。`,
    );
  },

  expeditionary: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    return withActor(entry, locale, `built an expeditionary force in ${space}.`, `在${space}建立远征军。`);
  },

  influencePlaced: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    return withActor(entry, locale, `placed influence in ${space}.`, `在${space}放置影响。`);
  },

  diplomacyPlaced: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    return withActor(entry, locale, `placed diplomacy in ${space}.`, `在${space}放置外交。`);
  },

  minorAlliance: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    return withActor(entry, locale, `formed a minor alliance with ${space}.`, `与${space}结盟。`);
  },

  pacified: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    const roll = num(entry.args?.roll);
    return withActor(entry, locale, `pacified ${space} (roll ${roll}).`, `绥靖${space}成功（掷骰 ${roll}）。`);
  },

  pacificationFailed: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    const roll = num(entry.args?.roll);
    return withActor(entry, locale, `failed to pacify ${space} (roll ${roll}).`, `绥靖${space}失败（掷骰 ${roll}）。`);
  },

  fortBuilt: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    const level = num(entry.args?.level);
    return withActor(entry, locale, `built a level ${level} fort in ${space}.`, `在${space}建造 ${level} 级要塞。`);
  },

  indianFortPlaced: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    const level = num(entry.args?.level);
    return text(
      locale,
      `The Indian Fort (level ${level}) was placed in ${space}.`,
      `印度要塞（${level} 级）已放置在${space}。`,
    );
  },

  industrializeCard: (entry, locale) => {
    const card = cardLabel(entry.args?.card, locale);
    return withActor(entry, locale, `industrialized ${card}.`, `将 ${card} 工业化。`);
  },

  cpChained: (entry, locale) => {
    const card = cardLabel(entry.args?.card, locale);
    return withActor(entry, locale, `chained ${card} for CP.`, `将 ${card} 加入 CP 链。`);
  },

  // ------------------------------------------------------------------ Great War flow
  gwImpulse: (entry, locale) => {
    const kind = str(entry.args?.kind);
    const index = num(entry.args?.index);
    const slot = str(entry.args?.slot);
    const slotName = slot === "" ? "" : slot === "bonus" ? text(locale, "bonus", "奖励") : powerLabel(slot, locale);
    const slotSuffix = slotName === "" ? "" : text(locale, ` (slot ${slotName})`, `（槽位 ${slotName}）`);
    if (kind === "end") {
      return text(
        locale,
        `The Great War impulse round ends at index ${index}.`,
        `大战行动轮在第 ${index} 位结束。`,
      );
    }
    const label = kind === "bonus" ? "bonus Great War" : kind === "ally" ? "allied Great War" : "Great War";
    const labelZh = kind === "bonus" ? "大战奖励" : kind === "ally" ? "大战盟国" : "大战";
    return withActor(
      entry,
      locale,
      `took a ${label} impulse${slotSuffix} at index ${index}.`,
      `进行${labelZh}行动轮${slotSuffix}，序号 ${index}。`,
    );
  },

  gwCpTransfer: (entry, locale) => {
    const to = powerLabel(entry.args?.to, locale);
    const amount = num(entry.args?.amount);
    return withActor(
      entry,
      locale,
      `transferred ${amount} CP to ${to}.`,
      `将 ${amount} 点 CP 转交给${to}。`,
    );
  },

  gwCombatCardFaceup: (entry, locale) => {
    const card = cardLabel(entry.args?.card, locale);
    return withActor(entry, locale, `revealed combat card ${card}.`, `亮出战斗牌 ${card}。`);
  },

  gwCombatCardFlipped: (entry, locale) => {
    const card = cardLabel(entry.args?.card, locale);
    return withActor(
      entry,
      locale,
      `flipped Great War combat card ${card} faceup.`,
      `将大战战斗牌 ${card} 翻至正面。`,
    );
  },

  gwUsNorthAmericaBlocked: (entry, locale) => {
    const to = spaceName(entry.args?.to, locale);
    const missing = spaceList(entry.args?.unoccupied, locale);
    return withActor(
      entry,
      locale,
      `32.1: US armies cannot leave North America for ${to} until ${missing} is occupied.`,
      `32.1：在占领${missing}之前，美军不能离开北美次地图前往${to}。`,
    );
  },

  gwManeuverAction: (entry, locale) => {
    const kind = str(entry.args?.kind);
    const cost = num(entry.args?.cost);
    const to = spaceName(entry.args?.to, locale);
    const from = spaceName(entry.args?.from, locale);
    const ally = powerLabel(entry.args?.ally, locale);
    const count = Array.isArray(entry.args?.unitIds) ? entry.args.unitIds.length : 0;
    switch (kind) {
      case "deploy":
        return withActor(entry, locale, `deployed reserves at ${to} (${cost} CP).`, `在${to}部署预备军（${cost} CP）。`);
      case "draft":
        return withActor(entry, locale, `drafted two armies at ${to} (${cost} CP).`, `在${to}征召两个军团（${cost} CP）。`);
      case "refit":
        return withActor(entry, locale, `refit a land unit (${cost} CP).`, `整补一个陆军单位（${cost} CP）。`);
      case "refitFleet":
        return withActor(entry, locale, `refit a fleet (${cost} CP).`, `整补一支舰队（${cost} CP）。`);
      case "landBattle":
        return withActor(
          entry,
          locale,
          `attacked from ${from} to ${to} (${cost} CP).`,
          `从${from}向${to}发动进攻（${cost} CP）。`,
        );
      case "rail":
        return withActor(
          entry,
          locale,
          `railed a unit from ${from} to ${to} (${cost} CP).`,
          `将单位从${from}铁路运输到${to}（${cost} CP）。`,
        );
      case "march":
        return withActor(
          entry,
          locale,
          `marched a unit from ${from} to ${to} (${cost} CP).`,
          `将单位从${from}行军到${to}（${cost} CP）。`,
        );
      case "naval":
        return withActor(
          entry,
          locale,
          `moved ${count} naval ${unitWord(count)} from ${from} to ${to} (${cost} CP).`,
          `将 ${count} 个海军单位从${from}移动到${to}（${cost} CP）。`,
        );
      case "jointNaval":
        return withActor(
          entry,
          locale,
          `moved ${count} joint naval ${unitWord(count)} with ${ally} from ${from} to ${to} (${cost} CP).`,
          `与${ally}联合调动 ${count} 个海军单位从${from}到${to}（${cost} CP）。`,
        );
      default:
        return withActor(
          entry,
          locale,
          `took the Great War maneuver action ${kind} (${cost} CP).`,
          `执行大战机动行动 ${kind}（${cost} CP）。`,
        );
    }
  },

  gwFreeMarch: (entry, locale) => {
    const from = spaceName(entry.args?.from, locale);
    const to = spaceName(entry.args?.to, locale);
    const former = powerLabel(entry.args?.control, locale);
    return withActor(
      entry,
      locale,
      `marched from ${from} to ${to} through ${former}'s former territory (30.1).`,
      `从${from}行军至${to}，穿过${former}的旧领土（30.1）。`,
    );
  },

  gwNeutralEntry: (entry, locale) => {
    const side = sideLabel(entry.args?.side, locale);
    const slot = num(entry.args?.slot);
    const placed =
      str(entry.args?.slot) === ""
        ? ""
        : text(locale, ` It takes GW order slot ${slot}.`, ` 占据大战行动顺序第 ${slot} 位。`);
    return withActor(
      entry,
      locale,
      `entered the Great War on the ${side} side.${placed}`,
      `加入大战，站在 ${side} 一方。${placed}`,
    );
  },

  gwNeutralEntryBlocked: (entry, locale) => {
    const side = sideLabel(entry.args?.side, locale);
    const reason = str(entry.args?.reason);
    if (reason === "noLegalAlliance") {
      return withActor(
        entry,
        locale,
        "stayed neutral: there is no legal alliance to join.",
        "保持中立：没有可加入的合法同盟。",
      );
    }
    if (reason === "illegalAlliance") {
      return withActor(
        entry,
        locale,
        `stayed neutral: the ${side} alliance is not a legal destination.`,
        `保持中立：${side} 同盟不是合法去向。`,
      );
    }
    return withActor(
      entry,
      locale,
      `stayed neutral: the ${side} alliance already has three player powers.`,
      `保持中立：${side} 同盟已有三名玩家势力。`,
    );
  },

  gwNeutralStayOut: (entry, locale) =>
    withActor(entry, locale, "chose to stay neutral.", "选择保持中立。"),

  gwNeutralBonusCp: (entry, locale) => {
    const target = powerLabel(entry.args?.target, locale);
    return withActor(
      entry,
      locale,
      `gave 1 bonus CP to ${target} for the next planning step.`,
      `给予${target} 1 点奖励 CP，用于下一个计划阶段。`,
    );
  },

  gwNeutralRedeploy: (entry, locale) => {
    const from = spaceName(entry.args?.from, locale);
    const to = spaceName(entry.args?.to, locale);
    return withActor(
      entry,
      locale,
      `used the free redeployment to move a unit from ${from} to ${to}.`,
      `使用免费重新部署，将一个单位从${from}移动到${to}。`,
    );
  },

  gwNeutralDeploy: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    const units = str(entry.args?.units).split(",").filter((part) => part !== "");
    const count = units.length;
    return withActor(
      entry,
      locale,
      `used the free deploy reserves to place ${count} reserve ${count === 1 ? "army" : "armies"} in ${space}.`,
      `使用免费部署预备军，在${space}放置 ${count} 个预备军。`,
    );
  },

  gwBonusImpulse: (entry, locale) => {
    const side = sideLabel(entry.args?.side, locale);
    return withActor(
      entry,
      locale,
      `gained a bonus impulse: the ${side} alliance is outnumbered.`,
      `获得奖励行动轮：${side} 同盟人数处于劣势。`,
    );
  },

  gwBonusImpulseRemoved: (entry, locale) =>
    withActor(
      entry,
      locale,
      "lost its bonus impulse: the alliances are now equal in size.",
      "失去奖励行动轮：双方同盟人数现已相等。",
    ),

  gwBlockade: (entry, locale) => {
    const max = num(entry.args?.maxIndustry);
    const industry = num(entry.args?.industry);
    const reduced = bool(entry.args?.reduced);
    if (!reduced) {
      return withActor(
        entry,
        locale,
        `is blockaded; its maximum industry is already at the floor of ${max}.`,
        `被封锁；其工业上限已处于下限 ${max}。`,
      );
    }
    return withActor(
      entry,
      locale,
      `is blockaded: maximum industry drops to ${max} and current industry is ${industry}.`,
      `被封锁：工业上限降至 ${max}，当前工业为 ${industry}。`,
    );
  },

  gwColonialLoss: (entry, locale) => {
    const region = regionLabel(entry.args?.region, locale);
    const space = spaceName(entry.args?.space, locale);
    const eliminated = bool(entry.args?.eliminated);
    const unit = unitKind(entry.args?.kind, locale);
    return withActor(
      entry,
      locale,
      eliminated
        ? `lost a ${unit} in ${space} to the ${region} colonial war.`
        : `took a step loss on a ${unit} in ${space} in the ${region} colonial war.`,
      eliminated
        ? `在${region}殖民战争中于${space}损失一个${unit}。`
        : `在${region}殖民战争中于${space}的一个${unit}承受一级损失。`,
    );
  },

  gwColonialTransfer: (entry, locale) => {
    const region = regionLabel(entry.args?.region, locale);
    if (bool(entry.args?.skip)) {
      return withActor(
        entry,
        locale,
        `found no unoccupied space it could take with a LoC in the ${region} colonial war.`,
        `未能在${region}殖民战争中找到可沿补给线取得的空置地区。`,
      );
    }
    const space = spaceName(entry.args?.space, locale);
    return withActor(
      entry,
      locale,
      `took control of ${space} in the ${region} colonial war.`,
      `在${region}殖民战争中取得${space}的控制权。`,
    );
  },

  gwColonialStability: (entry, locale) => {
    const delta = num(entry.args?.delta);
    const reason = str(entry.args?.reason);
    return withActor(
      entry,
      locale,
      `lost ${Math.abs(delta) === 1 ? "1 stability" : `${Math.abs(delta)} stability`}: ${reason}.`,
      `损失 ${Math.abs(delta)} 点稳定度：${reason}。`,
    );
  },

  gwColonialBonusCp: (entry, locale) => {
    const side = sideLabel(entry.args?.side, locale);
    const pool = num(entry.args?.pool);
    const lost = bool(entry.args?.lost);
    const recipients = powerList(entry.args?.recipients, locale);
    if (lost) {
      if (str(entry.args?.reason) === "disagreement") {
        return text(
          locale,
          `The ${side} alliance could not agree how to split its ${pool} colonial bonus CP; all are lost.`,
          `${side} 同盟无法就 ${pool} 点殖民奖励 CP 的分配达成一致；全部作废。`,
        );
      }
      return text(
        locale,
        `The ${side} alliance controls a colonial continent but all its members are blockaded; ${pool} bonus CP are lost.`,
        `${side} 同盟控制了一个殖民大陆，但其成员均被封锁；${pool} 点奖励 CP 作废。`,
      );
    }
    return text(
      locale,
      `The ${side} alliance controls a colonial continent: ${pool} bonus CP for ${recipients} next planning step.`,
      `${side} 同盟控制了一个殖民大陆：下个计划阶段 ${recipients} 获得 ${pool} 点奖励 CP。`,
    );
  },

  gwKeyLost: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    const by = powerLabel(entry.args?.by, locale);
    const delta = num(entry.args?.stability);
    if (delta === 0) {
      return withActor(
        entry,
        locale,
        `lost ${space} to ${by} with no stability loss (Scorched Earth).`,
        `${space}被${by}夺取，未损失稳定度（焦土政策）。`,
      );
    }
    return withActor(
      entry,
      locale,
      `lost ${space} to ${by} and 1 stability.`,
      `${space}被${by}夺取，损失 1 点稳定度。`,
    );
  },

  gwKeyRecaptured: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    return withActor(entry, locale, `recaptured ${space} (+1 stability).`, `收复${space}（稳定度 +1）。`);
  },

  gwMajorEntry: (entry, locale) => {
    const major = powerLabel(entry.args?.major, locale);
    const side = sideLabel(entry.args?.side, locale);
    const entered = bool(entry.args?.entered);
    if (str(entry.args?.major) === "IT") {
      const roll = num(entry.args?.roll);
      // The box recorded here is the one Italy occupied *before* the shift.
      const from = allianceBoxLabel(entry.args?.box, locale);
      return withActor(
        entry,
        locale,
        `rolled ${roll} for ${major} (${from}): ${entered ? `it shifts into the ${side} alliance and joins the war` : "no effect"}.`,
        `为${major}掷出 ${roll}（${from}）：${entered ? `移入 ${side} 联盟并参战` : "无效果"}。`,
      );
    }
    const box = str(entry.args?.box);
    return withActor(
      entry,
      locale,
      `shifted ${major} to ${allianceBoxLabel(box, locale)}${entered ? `; it joins the ${side} side` : ""}.`,
      `将${major}移至${allianceBoxLabel(box, locale)}${entered ? `，加入 ${side} 一方` : ""}。`,
    );
  },

  gwMajorEntryNone: (entry, locale) =>
    withActor(
      entry,
      locale,
      `could not bring Italy or the US into the war; Major Power Entry is removed${bool(entry.args?.drew) ? " and a replacement drawn" : ""}.`,
      `无法让意大利或美国参战；“大国参战”移出游戏${bool(entry.args?.drew) ? "并补抽一张" : ""}。`,
    ),

  gwAllyEntry: (entry, locale) => {
    const ally = powerLabel(entry.args?.ally, locale);
    const side = sideLabel(entry.args?.side, locale);
    return text(
      locale,
      `${ally} enters the Great War on the ${side} side.`,
      `${ally}加入大战，站在 ${side} 一方。`,
    );
  },

  gwMajorStability: (entry, locale) => {
    const major = powerLabel(entry.args?.major, locale);
    const delta = num(entry.args?.delta);
    const stability = num(entry.args?.stability);
    const space = spaceName(entry.args?.space, locale);
    const causes: Record<string, [string, string]> = {
      usArmyEliminated: ["a US army was eliminated", "一支美国集团军被消灭"],
      decisiveDefeat: [`a decisive defeat at ${space}`, `在${space}遭遇决定性失败`],
      northAtlantic: ["enemy ships in the North Atlantic", "北大西洋有敌方舰队"],
      homeKeyLost: [`the enemy occupied ${space}`, `敌军占领${space}`],
      homeKeyRetaken: [`${space} was retaken`, `收复${space}`],
    };
    const [en, zh] = causes[str(entry.args?.cause)] ?? [str(entry.args?.cause), str(entry.args?.cause)];
    const sign = delta > 0 ? `+${delta}` : String(delta);
    return text(
      locale,
      `${major} stability ${sign} (${en}); now ${stability}.`,
      `${major}稳定度 ${sign}（${zh}），现为 ${stability}。`,
    );
  },

  gwMajorSurrender: (entry, locale) => {
    const major = powerLabel(entry.args?.major, locale);
    const capital = str(entry.args?.reason) === "capital";
    return text(
      locale,
      `${major} surrenders${capital ? " after losing Rome" : " at 0 stability"}; its units are removed from play.`,
      `${major}${capital ? "因失去罗马" : "稳定度归零"}而投降，其单位全部移出游戏。`,
    );
  },

  gwItalyCapitalTaken: (entry, locale) => {
    const by = powerLabel(entry.args?.by, locale);
    return text(locale, `${by} takes Rome.`, `${by}攻占罗马。`);
  },

  // ------------------------------------------------------------------ limited war
  minorJoinedWar: (entry, locale) => {
    const minor = minorLabel(entry.args?.minor, locale);
    const side = sideLabel(entry.args?.side, locale);
    return withActor(
      entry,
      locale,
      `called ${minor} into the war on the ${side} side.`,
      `召唤${minor}参战，加入 ${side} 一方。`,
    );
  },

  minorAllyAsked: (entry, locale) => {
    const minor = minorLabel(entry.args?.minor, locale);
    const power = powerLabel(entry.args?.power, locale);
    const step = num(entry.args?.step);
    const CHOICES: Record<number, [string, string]> = {
      2: ["1st Choice", "第一选择"],
      3: ["2nd Choice", "第二选择"],
      4: ["3rd Choice", "第三选择"],
    };
    const [enWhere, zhWhere] = CHOICES[step] ?? ["", ""];
    if (step === 0) {
      return withActor(
        entry,
        locale,
        `asked ${power} whether it will fight for ${minor} or abandon it (13.4.1).`,
        `询问${power}是否愿意为${minor}作战，还是放弃它（13.4.1）。`,
      );
    }
    const enSource = bool(entry.args?.diplomacy) ? "diplomacy marker" : enWhere;
    const zhSource = bool(entry.args?.diplomacy) ? "外交标记" : zhWhere;
    return withActor(
      entry,
      locale,
      `asked ${power} to aid ${minor} (13.4.2, ${enSource || "table"}).`,
      `请求${power}援助${minor}（13.4.2，${zhSource || "表格"}）。`,
    );
  },

  minorAidRoll: (entry, locale) => {
    const minor = minorLabel(entry.args?.minor, locale);
    const order = powerList(entry.args?.order, locale);
    return withActor(
      entry,
      locale,
      `rolls off for ${minor}'s 13.4.3 alliance choice; the order is ${order}.`,
      `为${minor}的 13.4.3 联盟选择掷骰，顺序为 ${order}。`,
    );
  },

  minorAidGranted: (entry, locale) => {
    const minor = minorLabel(entry.args?.minor, locale);
    return withActor(
      entry,
      locale,
      `answers ${minor}'s call for aid and gains its alliance (13.4.2).`,
      `响应${minor}的求援并获得其结盟（13.4.2）。`,
    );
  },

  minorAbandoned: (entry, locale) => {
    const minor = minorLabel(entry.args?.minor, locale);
    const from = allianceBoxLabel(entry.args?.from, locale);
    const to = allianceBoxLabel(entry.args?.to, locale);
    const stability = Math.abs(num(entry.args?.stability));
    const italy = num(entry.args?.italyInfluence);
    // 13.4.1's Italy clause now writes to Italy's own typed MPIT column
    // (8.5); the dedicated `italyMpitGained` entry records the counter delta.
    const extra = italy > 0
      ? text(
          locale,
          ` Italy gains +${italy} neutral influence on its MPIT (13.4.1).`,
          ` 意大利在其 MPIT 上获得 ${italy} 点中立影响力（13.4.1）。`,
        )
      : "";
    return withActor(
      entry,
      locale,
      `abandons ${minor}: -${stability} stability and the alliance chit shifts from ${from} to ${to} (13.4.1).${extra}`,
      `放弃${minor}：稳定度 -${stability}，联盟标记从${from}移至${to}（13.4.1）。${extra}`,
    );
  },

  // Rules 13.4.1 / 8.5: neutral influence added to Italy's own MPIT column.
  italyMpitGained: (entry, locale) => {
    const track = str(entry.args?.track);
    const side = track === "te" ? "Triple Entente" : track === "ta" ? "Triple Alliance" : "neutral";
    const sideZh = track === "te" ? "协约国" : track === "ta" ? "同盟国" : "中立";
    const amount = num(entry.args?.amount);
    const total = num(entry.args?.total);
    const reason = str(entry.args?.reason);
    const cause = reason === "abandoned"
      ? text(locale, "a player abandoned Italy (13.4.1)", "有玩家放弃了意大利（13.4.1）")
      : text(locale, "players refused to aid Italy (13.4.1)", "多名玩家拒绝援助意大利（13.4.1）");
    return text(
      locale,
      `Italy's MPIT gains +${amount} ${side} influence (${cause}); its ${side} influence is now ${total}.`,
      `意大利 MPIT 获得 +${amount} 点${sideZh}影响力（${cause}）；其${sideZh}影响力现为 ${total}。`,
    );
  },

  // Rules 8.5/8.6: the unified Italy's own end-phase alliance resolution.
  italyAllianceResolution: (entry, locale) => {
    const te = num(entry.args?.te);
    const ta = num(entry.args?.ta);
    const neutral = num(entry.args?.neutral);
    const direction = str(entry.args?.direction);
    const directionLabel = direction === "te" ? "Triple Entente" : direction === "ta" ? "Triple Alliance" : "neutrality";
    const directionZh = direction === "te" ? "协约国" : direction === "ta" ? "同盟国" : "中立";
    const steps = num(entry.args?.steps);
    const from = allianceBoxLabel(entry.args?.from, locale);
    const to = allianceBoxLabel(entry.args?.to, locale);
    const blocked = bool(entry.args?.blocked)
      ? text(locale, " (stopped at the track end)", "（在轨道端点停止）")
      : "";
    return text(
      locale,
      `Italy resolves its alliance: TE ${te} vs TA ${ta} vs neutral ${neutral}, shifting ${steps} ${stepWord(steps)} toward ${directionLabel} from ${from} to ${to}${blocked}.`,
      `意大利结算其联盟：协约国 ${te} 对同盟国 ${ta} 对中立 ${neutral}，向${directionZh}移动 ${steps} 步，从${from}到${to}${blocked}。`,
    );
  },

  minorUnopposed: (entry, locale) => {
    const minor = minorLabel(entry.args?.target, locale);
    return withActor(
      entry,
      locale,
      `declares war on ${minor}; no player aids it, so the declaration proceeds unopposed (13.4.2).`,
      `向${minor}宣战；无人援助，宣战照常进行（13.4.2）。`,
    );
  },

  warVictory: (entry, locale) => {
    const kind = str(entry.args?.kind);
    const treaties = num(entry.args?.treaties);
    const victor = victorLabel(entry.args?.victor, locale);
    if (kind === "whitePeace") {
      return text(
        locale,
        `The war ends in a white peace (${treaties} treaty ${treaties === 1 ? "option" : "options"}).`,
        `战争以白和结束（${treaties} 个条约选项）。`,
      );
    }
    // Rule 15.4.2: an unaided non-player defender can win (the attacker
    // surrenders) but has no player log actor and imposes no treaty options.
    if (entry.power === undefined && str(entry.args?.victor) === "defender") {
      return text(
        locale,
        `The non-player defender wins a ${victoryKindLabel(kind, locale)} victory (${treaties} treaty ${
          treaties === 1 ? "option" : "options"
        }).`,
        `非玩家防守方取得${victoryKindLabel(kind, locale)}胜利（${treaties} 个条约选项）。`,
      );
    }
    // Legacy: every other actor-less classification (white peace with several
    // knockouts) reads as a white peace, as before.
    if (entry.power === undefined) {
      return text(
        locale,
        `The war ends in a white peace (${treaties} treaty ${treaties === 1 ? "option" : "options"}).`,
        `战争以白和结束（${treaties} 个条约选项）。`,
      );
    }
    const label = victoryKindLabel(kind, locale);
    return withActor(
      entry,
      locale,
      `won a ${label} victory (${treaties} treaty ${treaties === 1 ? "option" : "options"}; ${victor}).`,
      `取得${label}胜利（${treaties} 个条约选项；${victor}）。`,
    );
  },

  treatyApplied: (entry, locale) => {
    const option = str(entry.args?.option);
    const spaces = spaceList(entry.args?.spaces, locale);
    const target = powerLabel(entry.args?.target, locale);
    const minor = minorLabel(entry.args?.minor, locale);
    const hasTarget = str(entry.args?.target) !== "";
    // Rule 16.2: a concession may be awarded to an ally, including an
    // independent minor power, instead of the primary belligerent.
    const awardedToAlly = str(entry.args?.allocatedTo) === "ally";
    const rawBeneficiary = str(entry.args?.beneficiary);
    const beneficiary = rawBeneficiary === ""
      ? ""
      : (POWER_DEFS as Record<string, unknown>)[rawBeneficiary] !== undefined
        ? powerLabel(rawBeneficiary, locale)
        : minorLabel(rawBeneficiary, locale);
    const recipientEn = awardedToAlly && beneficiary !== "" ? ` to ${beneficiary}` : "";
    const recipientZh = awardedToAlly && beneficiary !== "" ? `，交给${beneficiary}` : "";
    switch (option) {
      case "territorialCession":
        return withActor(
          entry,
          locale,
          `took ${spaces} by territorial cession${recipientEn}.`,
          `通过领土割让取得${spaces}${recipientZh}。`,
        );
      case "realignment":
        return withActor(
          entry,
          locale,
          `realigned ${minor} to its side.`,
          `将${minor}重新结盟至己方。`,
        );
      case "warReparations":
        return withActor(
          entry,
          locale,
          hasTarget ? `took war reparations from ${target}${recipientEn}.` : "took war reparations.",
          hasTarget ? `向${target}索取战争赔款${recipientZh}。` : "索取战争赔款。",
        );
      case "righteousDefense":
        return withActor(
          entry,
          locale,
          `took ${spaces} under righteous defense${recipientEn}.`,
          `以正义防御取得${spaces}${recipientZh}。`,
        );
      case "colonialCession":
        return withActor(
          entry,
          locale,
          `took ${spaces} by colonial cession${recipientEn}.`,
          `通过殖民地割让取得${spaces}${recipientZh}。`,
        );
      default:
        return withActor(
          entry,
          locale,
          `applied the treaty option ${treatyOptionLabel(option, locale)}.`,
          `执行条约选项：${treatyOptionLabel(option, locale)}。`,
        );
    }
  },

  warSettlementIssues: (entry, locale) => {
    const issues = list(entry.args?.issues);
    const rendered = issues.length === 0
      ? text(locale, "an unspecified issue", "未指明的问题")
      : issues.map((issue) => settlementIssueLabel(issue, locale)).join(locale === "zh_CN" ? "；" : "; ");
    return text(
      locale,
      `The war settlement reported issues: ${rendered}.`,
      `战争结算报告了问题：${rendered}。`,
    );
  },

  warEnded: (entry, locale) => {
    const victor = str(entry.args?.victor);
    const loserId = str(entry.args?.loser);
    const loser = loserId === "" ? "" : powerLabel(loserId, locale);
    const major = bool(entry.args?.major);
    const truceTurns = num(entry.args?.truceTurns);
    const reserves = num(entry.args?.reserves);
    const detailsEn: string[] = [];
    const detailsZh: string[] = [];
    if (truceTurns > 0) {
      detailsEn.push(`${truceTurns}-turn truce`);
      detailsZh.push(`停战 ${truceTurns} 回合`);
    }
    if (reserves > 0) {
      detailsEn.push(`${reserves} reserve ${unitWord(reserves)} returned`);
      detailsZh.push(`归还 ${reserves} 个预备军单位`);
    }
    const suffixEn = detailsEn.length === 0 ? "" : ` (${detailsEn.join("; ")})`;
    const suffixZh = detailsZh.length === 0 ? "" : `（${detailsZh.join("；")}）`;
    if (victor === "whitePeace") {
      if (loser === "") {
        return text(locale, `The war ends in a white peace${suffixEn}.`, `战争以白和结束${suffixZh}。`);
      }
      return withActor(
        entry,
        locale,
        `made a white peace with ${loser}${suffixEn}.`,
        `与${loser}白和${suffixZh}。`,
      );
    }
    if (loser !== "") {
      return withActor(
        entry,
        locale,
        `defeated ${loser}${major ? " decisively" : ""} and ended the war${suffixEn}.`,
        `击败${loser}${major ? "（决定性胜利）" : ""}，结束战争${suffixZh}。`,
      );
    }
    return withActor(
      entry,
      locale,
      `won the war${major ? " decisively" : ""}${suffixEn}.`,
      `赢得战争${major ? "（决定性胜利）" : ""}${suffixZh}。`,
    );
  },

  allyJoinedWar: (entry, locale) => {
    const ally = powerLabel(entry.args?.ally, locale);
    return withActor(entry, locale, `called ${ally} into the war.`, `召唤${ally}参战。`);
  },

  // ------------------------------------------------------------------ card economy / MPIT
  responsePlayed: (entry, locale) => {
    const card = cardLabel(entry.args?.card, locale);
    return withActor(entry, locale, `played response card ${card}.`, `打出响应牌 ${card}。`);
  },

  saveCard: (entry, locale) => {
    const card = cardLabel(entry.args?.card, locale);
    if (bool(entry.args?.saved)) {
      return withActor(entry, locale, `saved ${card} for the end of turn.`, `保留 ${card} 至回合结束。`);
    }
    return withActor(entry, locale, `stopped saving ${card}.`, `取消保留 ${card}。`);
  },

  mpitPlaced: (entry, locale) => {
    const target = powerLabel(entry.args?.target, locale);
    const track = trackLabel(entry.args?.track, locale);
    return withActor(
      entry,
      locale,
      `placed MPIT influence on ${target} (${track}).`,
      `在${target}的 MPIT 上放置影响力（${track}）。`,
    );
  },

  warManeuverStarted: (entry, locale) =>
    withActor(entry, locale, "started the war maneuver.", "开始战争机动。"),

  // ------------------------------------------- 33 national characteristics
  recruitRejected: (entry, locale) => {
    const kind = unitKind(entry.args?.kind, locale);
    const raw = str(entry.args?.space);
    const where = raw === "" ? "" : ` in ${spaceName(raw, locale)}`;
    const reasons = str(entry.args?.reasons);
    return withActor(
      entry,
      locale,
      `could not recruit ${article(kind)} ${kind}${where}: ${reasons}.`,
      `无法征募${kind}${raw === "" ? "" : `（${spaceName(raw, locale)}）`}：${reasons}。`,
    );
  },

  industrializeRejected: (entry, locale) => {
    const card = cardLabel(entry.args?.card, locale);
    const reasons = str(entry.args?.reasons);
    return withActor(
      entry,
      locale,
      `could not industrialize with ${card}: ${reasons}.`,
      `无法用 ${card} 进行工业化：${reasons}。`,
    );
  },

  eventNotPlayable: (entry, locale) => {
    const card = cardLabel(entry.args?.card, locale);
    const reason = str(entry.args?.reason) as PlayBlockReason;
    const reasonText = ieStringsFor(locale).playBlock[reason] ?? str(entry.args?.reason);
    return withActor(
      entry,
      locale,
      `could not play ${card} as an event: ${reasonText}`,
      `无法将 ${card} 作为事件打出：${reasonText}`,
    );
  },

  auActionRejected: (entry, locale) => {
    const action = str(entry.args?.action);
    const reasons = str(entry.args?.reasons);
    return withActor(
      entry,
      locale,
      `could not resolve the ${action} special action: ${reasons}.`,
      `无法执行 ${action} 特殊行动：${reasons}。`,
    );
  },

  auRightsGranted: (entry, locale) => {
    const nationality = str(entry.args?.nationality);
    return withActor(
      entry,
      locale,
      `granted rights to the ${nationality}.`,
      `授予${nationality}权利。`,
    );
  },

  auCitizenshipRoll: (entry, locale) => {
    const nationality = str(entry.args?.nationality);
    const roll = num(entry.args?.roll);
    const needed = num(entry.args?.needed);
    const success = entry.args?.success === true;
    return withActor(
      entry,
      locale,
      `rolled ${roll} (needed ${needed}) to grant the ${nationality} full citizenship: ${success ? "success" : "failure"}.`,
      `为${nationality}争取完整公民权掷出 ${roll}（需要 ${needed}）：${success ? "成功" : "失败"}。`,
    );
  },

  auIncorporated: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    const minor = str(entry.args?.minor);
    return withActor(entry, locale, `incorporated ${minor} at ${space}.`, `吞并了${space}的${minor}。`);
  },

  auUnstableDiscard: discardText(" to Unstable Situation", "（因不稳定局势）"),

  dualMonarchyAdded: (entry, locale) => {
    const card = cardLabel(entry.args?.card, locale);
    return withActor(entry, locale, `added ${card} to hand.`, `将 ${card} 加入手牌。`);
  },

  thirdRepublicCp: (entry, locale) => {
    const cp = num(entry.args?.cp);
    return withActor(
      entry,
      locale,
      `gained ${cp} free alliance-track CP as the Third Republic.`,
      `作为第三共和国获得 ${cp} 点免费联盟轨道 CP。`,
    );
  },

  zouaveRebuilt: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    const free = entry.args?.free === true;
    return withActor(
      entry,
      locale,
      `rebuilt the Zouaves at ${space}${free ? " for free" : " for 1 CP"}.`,
      `在${space}重建祖阿夫${free ? "（免费）" : "（花费 1 CP）"}。`,
    );
  },

  zouaveRebuildRejected: (entry, locale) => {
    const reasons = str(entry.args?.reasons);
    return withActor(entry, locale, `could not rebuild the Zouaves: ${reasons}.`, `无法重建祖阿夫：${reasons}。`);
  },

  tsrrRail: (entry, locale) => {
    const from = spaceName(entry.args?.from, locale);
    const to = spaceName(entry.args?.to, locale);
    return withActor(
      entry,
      locale,
      `railed one army along the Trans-Siberian Railroad from ${from} to ${to}.`,
      `沿西伯利亚铁路将 1 个军团从${from}运至${to}。`,
    );
  },

  tsrrRailRejected: (entry, locale) => {
    const reasons = str(entry.args?.reasons);
    return withActor(
      entry,
      locale,
      `could not use the Trans-Siberian Railroad: ${reasons}.`,
      `无法使用西伯利亚铁路：${reasons}。`,
    );
  },

  jihadMarkersGained: (entry, locale) => {
    const markers = num(entry.args?.markers);
    const total = num(entry.args?.total);
    return withActor(
      entry,
      locale,
      `gained ${markers} Jihad markers (${total} total).`,
      `获得 ${markers} 个圣战标记（共 ${total} 个）。`,
    );
  },

  jihadRejected: (entry, locale) => {
    const reasons = str(entry.args?.reasons);
    return withActor(entry, locale, `could not use a Jihad marker: ${reasons}.`, `无法使用圣战标记：${reasons}。`);
  },

  jihadUsed: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    const opponent = powerLabel(entry.args?.opponent, locale);
    const markers = num(entry.args?.markers);
    return withActor(
      entry,
      locale,
      `spent a Jihad marker at ${space}: ${opponent} -1 (${markers} left).`,
      `在${space}弃置 1 个圣战标记：${opponent} -1（剩余 ${markers} 个）。`,
    );
  },

  jihadDiscarded: (entry, locale) => {
    const markers = num(entry.args?.markers);
    return withActor(
      entry,
      locale,
      `discarded ${markers} Jihad markers at the end of the war.`,
      `战争结束时弃置 ${markers} 个圣战标记。`,
    );
  },

  secondRome: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    return withActor(
      entry,
      locale,
      `took control of ${space} under The Second Rome.`,
      `依据“第二罗马”取得${space}的控制权。`,
    );
  },

  // ------------------------------------------------------------------ rule 14.0 consent
  // Rule 14.2.1 / the UK home card.
  balanceOfPower: (entry, locale) => {
    const defender = powerLabel(entry.args?.defender, locale);
    const navalBase = str(entry.args?.navalBase);
    switch (str(entry.args?.result)) {
      case "accepted":
        return withActor(
          entry,
          locale,
          `played Balance of Power: ${defender} agreed and the UK became the primary defender` +
            `${navalBase === "" ? "" : `, taking control of ${spaceName(navalBase, locale)}`}.`,
          `打出“势力均衡”：${defender}同意，英国成为主要防守方` +
            `${navalBase === "" ? "" : `，并取得${spaceName(navalBase, locale)}的控制权`}。`,
        );
      case "declined":
        return withActor(
          entry,
          locale,
          `played Balance of Power: ${defender} declined, so the UK drew a card.`,
          `打出“势力均衡”：${defender}拒绝，英国抽 1 张牌。`,
        );
      default:
        return withActor(
          entry,
          locale,
          `played Balance of Power and offered to become the primary defender on ${defender}'s side.`,
          `打出“势力均衡”，提出成为${defender}一方的主要防守方。`,
        );
    }
  },

  allyCalledToWar: (entry, locale) => {
    const ally = powerLabel(entry.args?.ally, locale);
    if (bool(entry.args?.statusQuo)) {
      return withActor(
        entry,
        locale,
        `invoked Maintaining the Status Quo to invite neutral ${ally} into the war.`,
        `援引“维持现状”，邀请中立的${ally}参战。`,
      );
    }
    return withActor(entry, locale, `called ${ally} to join the war.`, `召唤${ally}参战。`);
  },

  allyRefusedWar: (entry, locale) => {
    const caller = powerLabel(entry.args?.caller, locale);
    if (bool(entry.args?.exemptForTruce)) {
      return withActor(entry, locale, `refused ${caller}'s call (existing truce, no penalty).`, `拒绝${caller}的召唤（已有停战，无惩罚）。`);
    }
    const stability = num(entry.args?.stability);
    const influence = num(entry.args?.neutralInfluence);
    const parts: string[] = [];
    if (stability !== 0) parts.push(locale === "zh_CN" ? `稳定 ${stability}` : `${stability} stability`);
    if (influence !== 0) parts.push(locale === "zh_CN" ? `${influence} 中立影响力` : `${influence} neutral influence`);
    const penalty = parts.length > 0 ? parts.join(locale === "zh_CN" ? "、" : ", ") : (locale === "zh_CN" ? "无额外惩罚" : "no further penalty");
    return withActor(entry, locale, `refused ${caller}'s call to war (${penalty}).`, `拒绝${caller}的参战召唤（${penalty}）。`);
  },

  // ------------------------------------------------------------------ rule 17.0 free actions
  demobilizationFreeAction: (entry, locale) => {
    const from = spaceName(entry.args?.from, locale);
    const to = spaceName(entry.args?.to, locale);
    if (entry.args?.action === "naval") {
      return withActor(entry, locale, `used the free post-war naval move from ${from} to ${to}.`, `使用战后免费海军移动：${from} → ${to}。`);
    }
    return withActor(entry, locale, `used the free post-war redeployment from ${from} to ${to}.`, `使用战后免费重新部署：${from} → ${to}。`);
  },

  demobilizationFreeActionSkipped: (entry, locale) => {
    const reason = str(entry.args?.reason);
    const reasonText = reason === "eliminated"
      ? (locale === "zh_CN" ? "已消灭" : "eliminated")
      : (locale === "zh_CN" ? "没有合法行动" : "no legal action");
    return withActor(entry, locale, `skipped the post-war free actions (${reasonText}).`, `跳过战后免费行动（${reasonText}）。`);
  },

  demobilizationFreeActionsFinished: (entry, locale) => {
    const reason = str(entry.args?.reason);
    const reasonText = reason === "declined"
      ? (locale === "zh_CN" ? "玩家放弃" : "declined")
      : (locale === "zh_CN" ? "已完成" : "completed");
    return text(locale, `Demobilisation free actions finished (${reasonText}).`, `复员免费行动结束（${reasonText}）。`);
  },

  // ------------------------------------------------------------------ 5.5.3 / 5.6.2 upkeep
  brokenLocDisplaced: (entry, locale) => {
    const from = spaceName(entry.args?.from, locale);
    const to = spaceName(entry.args?.to, locale);
    const kind = unitKind(entry.args?.kind, locale);
    return withActor(entry, locale, `displaced a ${kind} with a broken LoC from ${from} to ${to}.`, `将补给线中断的${kind}从${from}转移至${to}。`);
  },

  impulseUpkeepLoss: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    const kind = unitKind(entry.args?.kind, locale);
    const cause = str(entry.args?.cause);
    const causeEn = cause === "brokenLoc" ? "a broken LoC" : "overstacking";
    const causeZh = cause === "brokenLoc" ? "补给线中断" : "超堆叠";
    return withActor(
      entry,
      locale,
      `took one step loss on a ${kind} in ${space} at the start of the impulse (${causeEn}).`,
      `行动轮开始时，${space}的${kind}因${causeZh}承受 1 步损失。`,
    );
  },

  // ------------------------------------------------------------------ 5.7 general displacement
  unitDisplaced: (entry, locale) => {
    const from = spaceName(entry.args?.from, locale);
    const to = spaceName(entry.args?.to, locale);
    const kind = unitKind(entry.args?.kind, locale);
    const owner = str(entry.args?.owner);
    const ownerLabel = entry.power ? powerLabel(entry.power, locale) : minorLabel(owner, locale);
    if (bool(entry.args?.eliminated)) {
      return text(
        locale,
        `${ownerLabel} eliminated a ${kind} displaced from ${from}: no friendly controlled space with a LoC was available (5.7).`,
        `${ownerLabel}消灭了从${from}被转移的${kind}：没有可用的、有补给线的友方控制区（5.7）。`,
      );
    }
    return text(
      locale,
      `${ownerLabel} displaced a ${kind} from ${from} to ${to} (5.7).`,
      `${ownerLabel}将${kind}从${from}转移至${to}（5.7）。`,
    );
  },

  // ------------------------------------------------------------------ 22.5 Poland
  polishIndependence: (entry, locale) => {
    const spaces = num(entry.args?.spaces);
    const reserves = num(entry.args?.reserves);
    return text(
      locale,
      `Poland gained independence (${spaces} Polish space${spaces === 1 ? "" : "s"}); its 22.5 reserve armies holding box received ${reserves} reserve armies.`,
      `波兰独立（控制 ${spaces} 个波兰地区）；其 22.5 预备军存放区放入 ${reserves} 个预备军。`,
    );
  },

  deployedPolishReserve: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    return withActor(
      entry,
      locale,
      `also deployed one Polish reserve army in ${space} (22.5).`,
      `额外在${space}部署了 1 个波兰预备军（22.5）。`,
    );
  },

  polishReserveReturned: (entry, locale) => {
    const count = num(entry.args?.count);
    return text(
      locale,
      `returned ${count} Polish reserve arm${count === 1 ? "y" : "ies"} to the Polish reserve armies holding box (22.5).`,
      `将 ${count} 个波兰预备军放回波兰预备军存放区（22.5）。`,
    );
  },

  polishRecruited: (entry, locale) => {
    const kind = str(entry.args?.kind);
    const label = kind === "reserveArmy" ? "reserve army" : kind === "eliteCorps" ? "elite corps" : "army";
    const cost = num(entry.args?.cost);
    const space = entry.args?.space ? spaceName(entry.args.space, locale) : "";
    const zhLabel = label === "army" ? "军团" : label === "reserve army" ? "预备军" : "精锐军";
    const upgrade = entry.args?.upgrade === true;
    return withActor(
      entry,
      locale,
      upgrade
        ? `flipped one reduced Polish ${label} to full strength for ${cost} CP (12.2/22.5).`
        : `built one Polish ${label}${space === "" ? "" : ` in ${space}`} for ${cost} CP (12.2/22.5).`,
      upgrade
        ? `支付 ${cost} CP，将 1 个减员的波兰${zhLabel}翻回满员（12.2/22.5）。`
        : `支付 ${cost} CP，在${space === "" ? "波兰" : space}建造 1 个波兰${zhLabel}（12.2/22.5）。`,
    );
  },

  polishRecruitRejected: (entry, locale) => {
    const reasons = str(entry.args?.reasons);
    return withActor(
      entry,
      locale,
      `could not build a Polish unit: ${reasons}.`,
      `无法建造波兰单位：${reasons}。`,
    );
  },

  // ------------------------------------------------------------------ 19.10 amphibious / 19.1 interception
  amphibiousAssault: (entry, locale) => {
    const from = spaceName(entry.args?.from, locale);
    const to = spaceName(entry.args?.to, locale);
    const units = list(entry.args?.units).length;
    return withActor(entry, locale, `launched an amphibious assault from ${from} against ${to} (${units} units).`, `从${from}对${to}发动两栖登陆（${units} 个单位）。`);
  },

  amphibiousLanding: (entry, locale) => {
    const from = spaceName(entry.args?.from, locale);
    const to = spaceName(entry.args?.to, locale);
    const units = list(entry.args?.units).length;
    return withActor(entry, locale, `landed ${units} units from ${from} at ${to}.`, `将 ${units} 个单位从${from}登陆${to}。`);
  },

  amphibiousNavalBattle: (entry, locale) => {
    const from = spaceName(entry.args?.from, locale);
    const to = spaceName(entry.args?.to, locale);
    return withActor(
      entry,
      locale,
      `had to fight the enemy fleet at ${to} before landing the troops from ${from}.`,
      `登陆${to}前必须先与敌方舰队交战（来自${from}）。`,
    );
  },

  navalInterception: (entry, locale) => {
    const port = spaceName(entry.args?.port, locale);
    const box = spaceName(entry.args?.box, locale);
    const roll = num(entry.args?.roll);
    const drm = num(entry.args?.drm);
    const total = num(entry.args?.total);
    if (bool(entry.args?.success)) {
      return withActor(entry, locale, `intercepted the enemy fleet at ${box} (roll ${roll}+${drm}=${total}).`, `在${box}拦截敌方舰队（掷骰 ${roll}+${drm}=${total}）。`);
    }
    const reason = str(entry.args?.reason);
    const reasonText = reason === "noShips" ? (locale === "zh_CN" ? "港内无舰" : "no ships in port") : (locale === "zh_CN" ? "未成功" : "failed");
    return withActor(entry, locale, `failed to intercept from ${port} to ${box} (roll ${roll}+${drm}=${total}; ${reasonText}).`, `从${port}向${box}的拦截失败（掷骰 ${roll}+${drm}=${total}；${reasonText}）。`);
  },

  navalAvoidance: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    const destination = spaceName(entry.args?.to, locale);
    const roll = num(entry.args?.roll);
    const drm = num(entry.args?.drm);
    const total = num(entry.args?.total);
    if (bool(entry.args?.success)) {
      return withActor(entry, locale, `avoided battle at ${space} by moving to ${destination} (roll ${roll}+${drm}=${total}).`, `在${space}避战并转移至${destination}（掷骰 ${roll}+${drm}=${total}）。`);
    }
    return withActor(entry, locale, `failed to avoid battle at ${space} (roll ${roll}+${drm}=${total}); the battle is fought with a -1 modifier.`, `在${space}避战失败（掷骰 ${roll}+${drm}=${total}）；战斗以 -1 修正进行。`);
  },

  navalContinuation: (entry, locale) => {
    const from = spaceName(entry.args?.from, locale);
    const units = num(entry.args?.units);
    if (bool(entry.args?.stopped)) {
      return withActor(entry, locale, `stopped the interrupted naval movement at ${from}.`, `在${from}结束被中断的海军移动。`);
    }
    const to = spaceName(entry.args?.to, locale);
    return withActor(entry, locale, `finished the interrupted naval movement from ${from} to ${to} (${units} units).`, `完成被中断的海军移动：从${from}到${to}（${units}个单位）。`);
  },

  navalPortBoxChoice: (entry, locale) => {
    const port = spaceName(entry.args?.port, locale);
    const box = spaceName(entry.args?.box, locale);
    return withActor(entry, locale, `chose ${box} as the adjacent box for the port battle at ${port} (19.5).`, `为${port}的港口战斗选择${box}作为相邻海域（19.5）。`);
  },

  navalPortContinuation: (entry, locale) => {
    const from = spaceName(entry.args?.from, locale);
    const units = num(entry.args?.units);
    if (bool(entry.args?.stopped)) {
      return withActor(entry, locale, `kept the winning fleet at sea at ${from} (19.8).`, `在${from}让获胜舰队留在海上（19.8）。`);
    }
    // A 19.8 split names every port its units moved to; a whole-force move
    // keeps the single `to` destination.
    const destinationList = typeof entry.args?.destinations === "string" && entry.args.destinations.length > 0
      ? entry.args.destinations.split(",").map((id) => spaceName(id, locale)).join(locale === "zh_CN" ? "、" : ", ")
      : null;
    if (destinationList !== null) {
      return withActor(
        entry,
        locale,
        `moved ${units} participating units into the friendly ports ${destinationList} after the naval battle at ${from} (19.8).`,
        `在${from}海战结束后将${units}个参战单位分入友方港口${destinationList}（19.8）。`,
      );
    }
    const to = spaceName(entry.args?.to, locale);
    return withActor(entry, locale, `moved ${units} participating units into the friendly port ${to} after the naval battle at ${from} (19.8).`, `在${from}海战结束后将${units}个参战单位移入友方港口${to}（19.8）。`);
  },

  mineRetreat: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    const from = spaceName(entry.args?.from, locale);
    const hits = num(entry.args?.hits);
    const ignored = num(entry.args?.ignored);
    return withActor(entry, locale, `retreated from the minefield at ${space} after ${hits} hits, ignoring ${ignored} further mine hits (19.4).`, `在${space}的水雷区承受${hits}次命中后撤退，忽略其余${ignored}次水雷命中（19.4）。`);
  },

  combatRetreat: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    const to = spaceName(entry.args?.to, locale);
    return withActor(entry, locale, `retreated from the battle at ${space} to ${to}.`, `从${space}的战斗撤退至${to}。`);
  },

  dardanellesPassageRequested: (entry, locale) => {
    const controller = powerLabel(entry.args?.controller, locale);
    const from = spaceName(entry.args?.from, locale);
    const to = spaceName(entry.args?.to, locale);
    return withActor(entry, locale, `asked ${controller} for permission to pass the Dardanelles (${from} → ${to}).`, `请求${controller}允许通过达达尼尔海峡（${from} → ${to}）。`);
  },

  dardanellesPassage: (entry, locale) => {
    const requesting = powerLabel(entry.args?.requesting, locale);
    const from = spaceName(entry.args?.from, locale);
    const to = spaceName(entry.args?.to, locale);
    if (bool(entry.args?.granted)) {
      return withActor(entry, locale, `granted ${requesting} permission to pass the Dardanelles (${from} → ${to}).`, `允许${requesting}通过达达尼尔海峡（${from} → ${to}）。`);
    }
    return withActor(entry, locale, `refused ${requesting} permission to pass the Dardanelles (${from} → ${to}).`, `拒绝${requesting}通过达达尼尔海峡（${from} → ${to}）。`);
  },

  // ------------------------------------------------------------------ 28.1 trenches
  trenchesPlaced: (entry, locale) => {
    const count = num(entry.args?.count);
    const turn = num(entry.args?.turn);
    return text(
      locale,
      `placed trenches on ${count} key spaces at the start of GW turn ${turn}.`,
      `在大战第 ${turn} 轮开始时，于 ${count} 个关键区放置战壕。`,
    );
  },

  trenchBattle: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    const status = str(entry.args?.status);
    const statusEn = status === "attackerAdvantage" ? "attacker advantage" : status === "defenderAdvantage" ? "defender advantage" : "deadlock";
    const statusZh = status === "attackerAdvantage" ? "进攻方优势" : status === "defenderAdvantage" ? "防守方优势" : "僵局";
    return withActor(entry, locale, `resolved a trench battle at ${space}: the marker is now ${statusEn}.`, `在${space}进行战壕战：标记转为${statusZh}。`);
  },

  trenchBattleLifted: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    return withActor(entry, locale, `lifted the trench battle marker at ${space}.`, `移除${space}的战壕战标记。`);
  },

  // ------------------------------------------------------------------ 33.2 India / UK characteristics
  indianArmyDisplaced: (entry, locale) => {
    const from = spaceName(entry.args?.from, locale);
    const to = spaceName(entry.args?.to, locale);
    const reason = str(entry.args?.reason);
    const reasonText = reason === "warEnd"
      ? (locale === "zh_CN" ? "战争结束时" : "at the end of the war")
      : (locale === "zh_CN" ? "回合结束时" : "at the end of the turn");
    return withActor(
      entry,
      locale,
      `displaced an Indian army from ${from} to ${to} ${reasonText}.`,
      `${reasonText}，将印度军团从${from}转移至${to}。`,
    );
  },

  indiaIndependence: (entry, locale) => {
    const displaced = num(entry.args?.displaced);
    const eliminated = num(entry.args?.eliminated);
    const kept = num(entry.args?.armiesKept);
    const removed = num(entry.args?.armiesEliminated);
    const fort = bool(entry.args?.fortRemoved);
    return text(
      locale,
      `India gained independence: ${displaced} units left India, ${eliminated} were eliminated, the UK keeps ${kept} Indian army (${removed} removed)${fort ? " and the Indian Fort is gone" : ""}. India can no longer be controlled.`,
      `印度独立：${displaced} 个单位离开印度，${eliminated} 个单位被消灭，英国保留 ${kept} 个印度军团（移除 ${removed} 个）${fort ? "，印度要塞被移除" : ""}。印度不再受任何玩家控制。`,
    );
  },

  indiaMarkerRejected: (entry, locale) => {
    const space = spaceName(entry.args?.space, locale);
    const marker = str(entry.args?.marker);
    const markerText = marker === "influence"
      ? (locale === "zh_CN" ? "影响" : "influence")
      : marker === "diplomacy"
        ? (locale === "zh_CN" ? "外交" : "diplomacy")
        : marker === "ally"
          ? (locale === "zh_CN" ? "联盟" : "alliance")
          : (locale === "zh_CN" ? "控制" : "control");
    return withActor(
      entry,
      locale,
      `tried to place a ${markerText} marker in ${space}, but independent India cannot be controlled; the write was skipped (33.2.2).`,
      `试图在${space}放置${markerText}标记，但独立的印度不受控制；该写入已被跳过（33.2.2）。`,
    );
  },

  rapidDeployment: (entry, locale) => {
    const from = spaceName(entry.args?.from, locale);
    const to = spaceName(entry.args?.to, locale);
    const count = num(entry.args?.count);
    return withActor(
      entry,
      locale,
      `used Rapid Deployment for a free naval move from ${from} to ${to} (${count} units).`,
      `使用“快速部署”免费海军移动：${from} → ${to}（${count} 个单位）。`,
    );
  },

  joinYourCountrysArmy: (entry, locale) => {
    const armies = num(entry.args?.armies);
    return text(
      locale,
      `Join Your Country's Army!: ${armies} British armies were placed in London at full strength (no manpower).`,
      `“参军去吧！”：${armies} 个英国军团以满员状态放置在伦敦（不消耗人力）。`,
    );
  },

  joinYourCountrysArmyLimited: (entry, locale) => {
    const gained = num(entry.args?.gained);
    const placeable = num(entry.args?.placeable);
    return text(
      locale,
      `Join Your Country's Army!: gained ${gained} free armies but the 4.2 UK army counter pool left room for ${placeable}; the excess is not fielded.`,
      `“参军去吧！”：获得 ${gained} 个免费军团，但 4.2 英国军团棋子池只剩 ${placeable} 个空位；超出部分不予上场。`,
    );
  },

  // ------------------------------------------------------------------ card discard reasons
  auctionCardsRevealed: (entry, locale) => {
    const cards = list(entry.args?.cards).map((id) => cardLabel(id, locale));
    const auction = str(entry.args?.auction);
    const nameEn = auction === "morocco" ? "Moroccan Crisis" : "Urabi Revolt";
    const nameZh = auction === "morocco" ? "摩洛哥危机" : "阿拉比起义";
    const joined = cards.join(locale === "zh_CN" ? "、" : ", ");
    return text(
      locale,
      `${nameEn} auction resolved: the face-down cards were ${joined}.`,
      `${nameZh}拍卖结算：暗置打出的牌为${joined}。`,
    );
  },

  empireOfTheSun: (entry, locale) => {
    const card = cardLabel(entry.args?.card, locale);
    return withActor(
      entry,
      locale,
      `discarded ${card} to Japan's Empire of the Sun.`,
      `因“太阳帝国”弃置 ${card}。`,
    );
  },
};

/** Every engine log key understood by {@link logText}. */
export const LOG_TEXT_KEYS: readonly string[] = Object.freeze(Object.keys(FORMATTERS).sort());

const humanizeKey = (key: string): string => {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return spaced.replace(/^./, (first) => first.toUpperCase());
};

/**
 * Format one engine log entry.  Known keys always return a translated
 * sentence; an unknown key degrades to a readable label rather than raw JSON.
 */
export const logText = (entry: LogTextEntry, locale: LogLocale): string => {
  const formatter = FORMATTERS[entry.key];
  if (formatter !== undefined) return formatter({...entry, args: entry.args ?? {}}, locale);
  const label = humanizeKey(entry.key);
  return text(locale, `Untranslated log entry: ${label}`, `未翻译的日志：${label}`);
};
