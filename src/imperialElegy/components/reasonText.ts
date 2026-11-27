/**
 * Localized display of the engine's refusal reasons.
 *
 * The engine speaks English on purpose: reasons are stored in decisions and
 * the public log as stable text, not as locale-dependent state.  The board is
 * the display layer, so a Chinese UI must translate them.  This module is the
 * one table for those strings: the space action rows, the AU national-action
 * panel, the log formatters and any other panel that shows a
 * `Decision.reasons` list go through `engineReasonText`, so the same refusal
 * cannot read Chinese in one panel and English in another.
 *
 * A reason list is joined with " · " by the board and with " | " by the log;
 * the caller passes the whole list and each part is translated independently,
 * keeping the separator it was given.  Unknown parts are left as printed
 * rather than replaced by a generic sentence: an untranslated rule citation is
 * more useful to a player than "不合法".
 */
import {POWER_DEFS} from "../constant/powers";
import type {Power} from "../types";
import {minorLabel} from "../engine/minorLabel";
import {unitKindLabel} from "../engine/unitKind";
import {nationalityLabel} from "../engine/nationality";
import type {IELocale} from "./i18n";

type Translator = (match: RegExpMatchArray) => string;

/** A great-power code (GE, UK, …) as the Chinese player name. */
const powerName = (code: string): string => POWER_DEFS[code as Power]?.nameZh ?? code;

/** Whole-string reasons; checked before the patterns. */
const EXACT_ZH: Readonly<Record<string, string>> = {
  "Eastern Ambitions is not in hand": "手中没有“东方野心”",
  "Eastern Ambitions is already revealed": "“东方野心”已揭示",
  "the special belongs to Russia": "该特制属于俄国",
  "the special takes Manchuria or Korea": "该特制取得满洲或朝鲜",
  "A build needs a space": "建造需要指定一个空间",
  "A unit deployed this impulse cannot move (15.2.3)": "本行动轮部署的单位不能移动（15.2.3）",
  "A draft needs a controlled home key with room for one more army and no trench battle marker (27.5.2)":
    "征召需要一个由你控制的本土关键区，且该区还能再容纳一支军团、没有战壕标记（27.5.2）",
  "Agrarian: needs a 6 after DRMs": "农业国：掷骰加修正后需 6",
  "An allied minor's army may only rail during wartime (12.8)":
    "盟国小国的军团只能在战时使用铁路移动（12.8）",
  "An army build is one or two steps": "军团建造为 1 或 2 个步骤",
  "An army needs a Polish space": "军团需要波兰空间",
  "An elite corps needs a Polish army to attach to": "精英军需有波兰军团可编入",
  "An elite corps needs a friendly army to attach to": "精锐军团需有友方军团可编入",
  "Arab armies may only be built in Arab/Egyptian keys": "阿拉伯军团只能建在阿拉伯／埃及关键区",
  "Arab manpower limit reached": "阿拉伯人力上限已达",
  "Armies may not be built this impulse (Liberal Reforms)": "本轮不能建造军团（自由改革）",
  "Armies may not be built this impulse": "本轮不能建造军团",
  "AU cannot grant citizenship or rights this turn": "奥匈帝国本回合不能授予权利或完整公民权",
  "AU has no stability to spend for the +2 DRM": "奥匈帝国没有稳定度可用于 +2 DRM",
  "Both ends of the rail move must be on the Trans-Siberian Railroad":
    "铁路移动的两端都必须在西伯利亚铁路上",
  "Continental Focus: pacification costs 2 CP until Germany unifies":
    "大陆重心：德国统一前绥靖花费 2 CP",
  "Continental Power: pacification actions cost 2 CP": "大陆强国：绥靖行动花费 2 CP",
  "CW army within colonial manpower": "殖民地自治领军团在殖民地人力之内",
  "Does not own the key": "未控制此空间的关键区",
  "Dreadnoughts must be enabled by the Dreadnought event": "需先打出“无畏舰”事件才能建造无畏舰",
  "Elite colonial EF: +1 pacification DRM": "精英殖民远征军：绥靖 +1 DRM",
  "Europeanization: needs a 6 after DRMs and may not use an OT card":
    "欧洲化：掷骰加修正后需 6，且不能使用奥斯曼牌",
  "Exhaustion (GW-10) cannot be passed": "“精疲力竭”（GW-10）不能停牌",
  "Fleets need a home space with a port": "舰队需要带港口的本土空间",
  "Flip one reduced Polish army to full strength (12.2)": "将 1 支受损的波兰军团翻回满编（12.2）",
  "Flip one reduced Polish reserve army to full strength (12.2)":
    "将 1 支受损的波兰预备军翻回满编（12.2）",
  "France does not hold Napoleon's Legacy": "法国未持有“拿破仑的遗产”",
  "France is eliminated": "法国已被消灭",
  "France is not the Second Empire": "法国已不是第二帝国",
  "France is not the Third Republic": "法国已不是第三共和国",
  "France was not a belligerent": "法国不是参战国",
  "France was on the winning side": "法国属于获胜一方",
  "Incorporate targets an allied minor power, not a player-controlled space":
    "吞并目标须为盟国小国，而非玩家控制的空间",
  "India is independent: no new Indian armies may be built": "印度已独立：不能新建印度军团",
  "Indian army within colonial manpower": "印度军团在殖民地人力之内",
  "Jihad markers only modify land battles": "圣战标记只影响陆战",
  "Jihad was already used in this battle": "本场战斗已使用过圣战",
  "Local Autonomy: Arab/Egyptian keys count as Arab keys; Tunisia/Tripoli need a land LoC":
    "地方自治：阿拉伯／埃及关键区视为阿拉伯关键区；突尼斯／的黎波里需陆上交通线",
  "Local Autonomy: Turkish armies may not be built in Arab/Egyptian keys":
    "地方自治：土耳其军团不能建在阿拉伯／埃及关键区",
  "lost the africa colonial war": "输掉了非洲殖民战争",
  "lost the asia colonial war": "输掉了亚洲殖民战争",
  "Metternich's Legacy already resolved": "“梅特涅的遗产”已结算",
  "Not enough manpower to draft": "人力不足，无法征召",
  "Napoleon's Legacy is already revealed": "“拿破仑的遗产”已公开",
  "No Arab manpower available": "没有可用的阿拉伯人力",
  "No army counter available": "已无军团棋子",
  "No battle is in progress": "当前没有进行中的战斗",
  "No colonial manpower available": "没有可用的殖民地人力",
  "No elite corps counter available": "已无精英军棋子",
  "No Jihad marker is available for this battle": "本场战斗没有可用的圣战标记",
  "No player controls Poland": "没有玩家控制波兰",
  "No player controls this minor power": "没有玩家控制该小国",
  "No Polish army counter is available": "已无波兰军团棋子",
  "No Polish elite corps counter is available": "已无波兰精英军棋子",
  "No Polish reserve army counter is available": "已无波兰预备军棋子",
  "No Polish standing army counter is available": "已无波兰常备军棋子",
  "No reserve army counter available": "已无预备军棋子",
  "No war was settled": "没有结算任何战争",
  "Not a home space": "不是本国核心领土",
  "Only applies at the end of the diplomacy phase": "仅在外交阶段结束时适用",
  "Only applies on turn 1": "仅在第 1 回合适用",
  "Only Austria-Hungary grants rights and citizenship": "只有奥匈帝国可以授予权利与完整公民权",
  "Only France can reveal Napoleon's Legacy": "只有法国可以公开“拿破仑的遗产”",
  "Only one army may be railed": "每次只能铁路移动 1 支军团",
  "Only Russia (and its allies during wartime) may use the railroad":
    "只有俄国（及其战时的盟友）可以使用该铁路",
  "Only the Ottoman player uses Jihad markers": "只有奥斯曼玩家使用圣战标记",
  "Only the player allied to Poland may build its units (12.8)":
    "只有与波兰结盟的玩家可以建造其单位（12.8）",
  "Only the player allied to this minor power may build its units (12.8)":
    "只有与该小国结盟的玩家可以建造其单位（12.8）",
  "Ottoman Manpower: Turkish and Arab manpower are tracked separately":
    "奥斯曼人力：土耳其人力与阿拉伯人力分别计算",
  "Ottoman Manpower: Turkish armies need a key without a minority nationality":
    "奥斯曼人力：土耳其军团需要没有少数民族的关键区",
  "Ottoman own card cannot be used for industrialization": "奥斯曼本国牌不能用于工业化",
  "Paris is not occupied by an enemy power": "巴黎未被敌方势力占领",
  "Paris is only counted during wartime": "巴黎只在战时计入",
  "Poland has only one elite corps counter (4.2)": "波兰只有 1 个精英军棋子（4.2）",
  "Poland is not independent": "波兰尚未独立",
  "Poland or its controlling player must control the space": "波兰或其控制玩家必须控制该空间",
  "Polish units must be built in a Polish space": "波兰单位必须建在波兰空间",
  "Polish units must be built on the main map": "波兰单位必须建在主地图",
  "Port capacity reached": "港口容量已达上限",
  "Professional Army: only the 1st British Army may be built before the GW":
    "职业陆军：大战前只能建造第 1 支英国军团",
  "Recruitment and construction are action-phase actions (12.2/12.4)":
    "征募与建造是行动阶段行动（12.2/12.4）",
  "Recruitment is an action-phase action (12.2)": "征募是行动阶段行动（12.2）",
  "Reserve army allowance exhausted": "预备军额度已用尽",
  "Reserve limit 0 reached": "预备军已满",
  "Reserve limit is the lower of manpower or industry": "预备军上限取人力与工业中的较低者",
  "Russia does not occupy Istanbul": "俄国未占领伊斯坦布尔",
  "Russia was not a belligerent": "俄国不是参战国",
  "God Save the Tsar grants at most one elite corps": "“天佑沙皇”至多授予 1 个精英军",
  "Russia was on the losing side": "俄国属于战败一方",
  "Russian Steamroller: reserve limit is the lower of manpower or industry, +1":
    "俄国压路机：预备军上限取人力与工业中的较低者，再 +1",
  "Stacking limit reached": "已达堆叠上限",
  "That is not a land space on the map": "地图上该处不是陆地空间",
  "That army has no line of communication": "该军团没有交通线",
  "The army is not on the map": "该军团不在地图上",
  "The army must move to a different railroad space": "军团必须移动到另一个铁路空间",
  "The compromise window is the turn-2 prep phase": "妥协窗口是第 2 回合的准备阶段",
  "The dice have already been rolled": "骰子已经掷过",
  "The Dual Monarchy (A047) cannot be passed": "“二元君主国”（A047）不能停牌",
  "The Dual Monarchy is already in hand": "“二元君主国”已在手牌中",
  "The Dual Monarchy was already played": "“二元君主国”已打出",
  "The Franco-Prussian War branch skips this home card on turn 1":
    "普法战争分支在第 1 回合跳过该本土牌",
  "The goal is revealed only when launching a war of conquest": "只有发动征服战争时才会公开该目标",
  "The government switch cannot happen during the Great War": "大战期间不能发生政体更替",
  "The minor power must be allied to Austria-Hungary": "该小国须与奥匈帝国结盟",
  "The minor power needs a nationality with full AU citizenship":
    "该小国须拥有已获奥匈完整公民权的民族",
  "The Ottomans are not a belligerent in this battle": "奥斯曼不是本场战斗的参战国",
  "The railroad destination must be friendly": "铁路目的地必须是友方空间",
  "The railroad move was already used this impulse": "本行动轮已使用过铁路移动",
  "The railroad move would end overstacked (5.5.3)": "铁路移动会导致终点堆叠超限（5.5.3）",
  "The space has no Polish line of communication": "该空间没有波兰的交通线",
  "The Trans-Siberian Railroad is not complete": "西伯利亚铁路尚未建成",
  "The TSRR army allowance applies to action-phase and wartime impulses":
    "西伯利亚铁路的军团额度只适用于行动阶段与战时行动轮",
  "The Third Republic bonus was already granted this turn": "本回合已获得第三共和国奖励",
  "The unit is not owned by this power": "该单位不属于此势力",
  "The war ended in a white peace": "战争以白和结束",
  "The Zouaves are already in play": "祖阿夫已在场上",
  "This occupation already reduced City of Light": "本次占领已降低过“光之城”",
  "Turn-2 prep: add the card only if it was not played on turn 1":
    "第 2 回合准备：仅当第 1 回合未打出时才加入此牌",
  "Unknown space": "未知空间",
  "Zouaves: +1 pacification DRM": "祖阿夫：绥靖 +1 DRM",
};

/** Reasons that embed a number, a nationality or a non-player power. */
const PATTERN_ZH: ReadonlyArray<[RegExp, string | Translator]> = [
  [/^(.+) is not one of the eight AU nationalities$/, (m) => `${nationalityLabel(m[1], "zh_CN")}不是奥匈帝国的八个民族之一`],
  [/^(.+) does not have rights yet$/, (m) => `${nationalityLabel(m[1], "zh_CN")}尚未获得权利`],
  [/^(.+) already has rights$/, (m) => `${nationalityLabel(m[1], "zh_CN")}已获得权利`],
  [/^(.+) already has full citizenship$/, (m) => `${nationalityLabel(m[1], "zh_CN")}已获得完整公民权`],
  [/^Manpower\/army limit (\d+) reached$/, (m) => `人力／军团上限 ${m[1]} 已达`],
  [/^Reserve limit (\d+) reached$/, (m) => `预备军已满（上限 ${m[1]}）`],
  // 29.2.1: the Russian colonial-war check names its three spaces.
  [/^(\d+) of Central Asia, Qajar Persia and Manchuria are enemy controlled$/, (m) => `中亚、卡扎尔波斯与满洲中有 ${m[1]} 处被敌方控制`],
  [/^British manpower limit (\d+) reached$/, (m) => `英国人力上限 ${m[1]} 已达`],
  [/^Turkish manpower limit (\d+) reached$/, (m) => `土耳其人力上限 ${m[1]} 已达`],
  [/^Colonial manpower limit (\d+) reached for Indian and CW armies$/, (m) => `印度与自治领军团已达殖民地人力上限 ${m[1]}`],
  // Characteristics build gates quote the minor by name and the counter by kind.
  [/^(.+) has no (.+) counter left \(4\.2\)$/, (m) => `${minorLabel(m[1], "zh_CN")}已无${unitKindLabel(m[2], "zh_CN")}棋子（4.2）`],
  [/^(.+) must control that home space$/, (m) => `${minorLabel(m[1], "zh_CN")}必须控制该本土空间`],
  [/^The unit must be built in a home space of (.+)$/, (m) => `该单位必须建在${minorLabel(m[1], "zh_CN")}的本土空间`],
  [/^Polish army counters already equal the 22\.5 limit \((\d+)\)$/, (m) => `波兰军团棋子已达 22.5 上限（${m[1]}）`],
  [/^(.+) may not build reserve armies$/, (m) => `${powerName(m[1])}不能建造预备军`],
  [/^(.+) does not have enough army counters for a draft$/, (m) => `${powerName(m[1])}已无足够的军团棋子来征召（4.2）`],
];

/**
 * The separators a reason list is joined with: the board uses " · " and the
 * log uses " | ".  Split on either, translate each part, and put the same
 * separator back so the rendered sentence keeps its original punctuation.
 */
const SEPARATOR = /\s*([·|])\s*/;

/** Translate one engine reason list for display. */
export const engineReasonText = (locale: IELocale, reason: string): string => {
  if (locale !== "zh_CN") return reason;
  const parts = reason.split(SEPARATOR);
  return parts
    .map((part, index) => (index % 2 === 1 ? ` ${part} ` : translatePart(part)))
    .join("");
};

const translatePart = (part: string): string => {
  const exact = EXACT_ZH[part];
  if (exact !== undefined) return exact;
  for (const [pattern, replacement] of PATTERN_ZH) {
    const match = part.match(pattern);
    if (match === null) continue;
    return typeof replacement === "string" ? replacement : replacement(match);
  }
  return part;
};
