/**
 * Localized display of the engine's refusal reasons.
 *
 * The engine speaks English on purpose: reasons are stored in decisions and
 * the public log as stable text, not as locale-dependent state.  The board is
 * the display layer, so a Chinese UI must translate them.  This module is the
 * one table for those strings: the space action rows, the AU national-action
 * panel and any other panel that shows a `Decision.reasons` list go through
 * `engineReasonText`, so the same refusal cannot read Chinese in one panel and
 * English in another.
 *
 * A reason list is joined with " · "; the caller passes the whole list and each
 * part is translated independently.  Unknown parts are left as printed rather
 * than replaced by a generic sentence: an untranslated rule citation is more
 * useful to a player than "不合法".
 */
import {nationalityLabel} from "../engine/nationality";
import type {IELocale} from "./i18n";

type Translator = (match: RegExpMatchArray) => string;

/** Whole-string reasons; checked before the patterns. */
const EXACT_ZH: Readonly<Record<string, string>> = {
  "Not a home space": "不是本国核心领土",
  "Does not own the key": "未控制此空间的关键区",
  "Stacking limit reached": "已达堆叠上限",
  "Reserve limit 0 reached": "预备军已满",
  "Armies may not be built this impulse": "本轮不能建造军团",
  "An elite corps needs a friendly army to attach to": "精锐军团需有友方军团可编入",
  "No colonial manpower available": "没有可用的殖民地人力",
  "No Arab manpower available": "没有可用的阿拉伯人力",
  "Arab manpower limit reached": "阿拉伯人力上限已达",
  "India is independent: no new Indian armies may be built": "印度已独立：不能新建印度军团",
  "Professional Army: only the 1st British Army may be built before the GW":
    "职业陆军：大战前只能建造第 1 支英国军团",
  "Arab armies may only be built in Arab/Egyptian keys": "阿拉伯军团只能建在阿拉伯／埃及关键区",
  "Local Autonomy: Turkish armies may not be built in Arab/Egyptian keys":
    "地方自治：土耳其军团不能建在阿拉伯／埃及关键区",
  "Ottoman Manpower: Turkish armies need a key without a minority nationality":
    "奥斯曼人力：土耳其军团需要没有少数民族的关键区",
  "CW army within colonial manpower": "殖民地自治领军团在殖民地人力之内",
  "Indian army within colonial manpower": "印度军团在殖民地人力之内",
  "Only Austria-Hungary grants rights and citizenship": "只有奥匈帝国可以授予权利与完整公民权",
  "AU cannot grant citizenship or rights this turn": "奥匈帝国本回合不能授予权利或完整公民权",
  "AU has no stability to spend for the +2 DRM": "奥匈帝国没有稳定度可用于 +2 DRM",
  "Unknown space": "未知空间",
  "Incorporate targets an allied minor power, not a player-controlled space":
    "吞并目标须为盟国小国，而非玩家控制的空间",
  "The minor power must be allied to Austria-Hungary": "该小国须与奥匈帝国结盟",
  "The minor power needs a nationality with full AU citizenship":
    "该小国须拥有已获奥匈完整公民权的民族",
};

/** Reasons that embed a number or a nationality. */
const PATTERN_ZH: ReadonlyArray<[RegExp, string | Translator]> = [
  [/^(.+) is not one of the eight AU nationalities$/, (m) => `${nationalityLabel(m[1], "zh_CN")}不是奥匈帝国的八个民族之一`],
  [/^(.+) does not have rights yet$/, (m) => `${nationalityLabel(m[1], "zh_CN")}尚未获得权利`],
  [/^(.+) already has rights$/, (m) => `${nationalityLabel(m[1], "zh_CN")}已获得权利`],
  [/^(.+) already has full citizenship$/, (m) => `${nationalityLabel(m[1], "zh_CN")}已获得完整公民权`],
  [/^Manpower\/army limit (\d+) reached$/, (m) => `人力／军团上限 ${m[1]} 已达`],
  [/^British manpower limit (\d+) reached$/, (m) => `英国人力上限 ${m[1]} 已达`],
  [/^Turkish manpower limit (\d+) reached$/, (m) => `土耳其人力上限 ${m[1]} 已达`],
  [/^Colonial manpower limit (\d+) reached for Indian and CW armies$/, (m) => `印度与自治领军团已达殖民地人力上限 ${m[1]}`],
];

/** Translate one engine reason list for display. */
export const engineReasonText = (locale: IELocale, reason: string): string => {
  if (locale !== "zh_CN") return reason;
  return reason
    .split(" · ")
    .map((part) => translatePart(part))
    .join(" · ");
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
