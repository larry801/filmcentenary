import {GoalId, Power} from "../types";

export type GoalKind =
  | "rankedEuropeanKeys"
  | "rankedFlashpoints"
  | "rankedAlliances"
  | "rankedStability"
  | "rankedAfricaKeys"
  | "achievement";

export interface GoalDef {
  id: GoalId;
  number: number;
  power: Power;
  title: string;
  titleZh: string;
  vp: number;
  /** Reduced VP alternative printed on some cards. */
  partialVp?: number;
  kind: GoalKind;
  /** Set for the Austrian ninth, scenario-only goal (31). */
  scenarioOnly?: boolean;
  /** English rule text transcribed from the playbook / card face. */
  text: string;
  textZh: string;
  /** Structured achievement evaluator key. */
  condition?: string;
  /** Does the goal require the GW not to occur? */
  noGreatWar?: boolean;
  /** Goal may be revealed during play (FR 24, RU 38). */
  revealable?: boolean;
}

const RANKED_TEXT = {
  en: "This is a ranked National Goal: compare your total with the other players. 3 VPs for first place, 2 for second and 1 for third. There are no tie breakers; when players are tied for a place the next place VP reward is skipped.",
  zh: "排名型国家目标：与其他玩家比较。第一名 3 VP，第二名 2 VP，第三名 1 VP。没有平局决胜；若并列则跳过下一名次的奖励。",
};

const ranked = (
  number: number,
  power: Power,
  title: string,
  titleZh: string,
  kind: GoalKind,
  textEn: string,
  textZh: string,
  extra: Partial<GoalDef> = {},
): GoalDef => ({
  id: `NG-${String(number).padStart(2, "0")}`,
  number,
  power,
  title,
  titleZh,
  vp: 3,
  kind,
  text: `${textEn} ${RANKED_TEXT.en}`,
  textZh: `${textZh} ${RANKED_TEXT.zh}`,
  ...extra,
});

const achievement = (
  number: number,
  power: Power,
  title: string,
  titleZh: string,
  vp: number,
  textEn: string,
  textZh: string,
  extra: Partial<GoalDef> = {},
): GoalDef => ({
  id: `NG-${String(number).padStart(2, "0")}`,
  number,
  power,
  title,
  titleZh,
  vp,
  kind: "achievement",
  text: textEn,
  textZh,
  ...extra,
});

export const GOALS: GoalDef[] = [
  // ---------------------------------------------------------------- Germany 1-8
  ranked(1, "GE", "European Keys", "欧洲关键区", "rankedEuropeanKeys", "Control the most European keys.", "控制最多的欧洲关键区。"),
  ranked(2, "GE", "Flashpoints", "闪点", "rankedFlashpoints", "Control the most flashpoints. Both 1st and 2nd place in Power Projection count as controlling 1 flashpoint.", "控制最多的闪点；力量投射第 1 和第 2 名各计为控制 1 个闪点。"),
  ranked(3, "GE", "Look to Berlin", "放眼柏林", "rankedAlliances", "Have the most minor power alliances.", "拥有最多小国盟友。"),
  ranked(4, "GE", "Stability", "稳定", "rankedStability", "Have the highest stability.", "拥有最高稳定度。"),
  achievement(5, "GE", "Our Place in the Sun", "阳光下的地盘", 3,
    "Control 4 colonial keys, at least one of which must be on the Asia map. OR control 2 colonial keys and dominate the Power Projection flashpoint. Clarification: you receive 3 VPs if you complete one of the options, not 6 for both.",
    "控制 4 个殖民地关键区，其中至少 1 个在亚洲地图；或控制 2 个殖民地关键区并支配力量投射闪点。完成一项即得 3 VP，两项都完成不得 6 VP。",
    {condition: "GE_placeInTheSun"}),
  achievement(6, "GE", "Peace in Our Time", "我们时代的和平", 3,
    "The GW does not occur.", "大战没有爆发。", {condition: "noGreatWar", noGreatWar: true}),
  achievement(7, "GE", "Surrounded", "四面楚歌", 4,
    "This National Goal has two conditions: (1) France is either neutral or not in the opposing alliance; (2) Austria-Hungary and Russia are not both in the opposing alliance. While Germany is in the neutral box both alliances are considered opposing alliances.",
    "本目标有两个条件：(1) 法国中立或不在敌对同盟；(2) 奥匈与俄国不同时在敌对同盟。德国处于中立框时，两个同盟都视为敌对同盟。",
    {condition: "GE_surrounded"}),
  achievement(8, "GE", "German Home Spaces", "德意志本土", 3,
    "Control all German home spaces. Unification is not sufficient if you later lose a German home space. Score 2 VPs if you control at least 8 German home spaces.",
    "控制所有德意志本土空间（统一后若丢失则不算）。控制至少 8 个德意志本土空间得 2 VP。",
    {condition: "GE_germanHome", partialVp: 2}),

  // ---------------------------------------------------------------- UK 9-16
  ranked(9, "UK", "Scramble for Africa", "争夺非洲", "rankedAfricaKeys", "Control the most keys in Africa (including North Africa). Minor power alliances in Africa count as control.", "控制非洲（含北非）最多的关键区；非洲的小国盟友计为控制。"),
  ranked(10, "UK", "Flashpoints", "闪点", "rankedFlashpoints", "Control the most flashpoints. Both 1st and 2nd place in Power Projection count as controlling 1 flashpoint.", "控制最多的闪点；力量投射第 1 和第 2 名各计为控制 1 个闪点。"),
  ranked(11, "UK", "Look to London", "放眼伦敦", "rankedAlliances", "Have the most minor power alliances.", "拥有最多小国盟友。"),
  ranked(12, "UK", "Stability", "稳定", "rankedStability", "Have the highest stability. Only UK stability counts.", "拥有最高稳定度（仅计算英国稳定度）。"),
  achievement(13, "UK", "Two Power Standard", "两强标准", 3,
    "The UK has the most power projection, and UK power projection is at least double the next highest player.",
    "英国拥有最高力量投射，且至少为第二名的两倍。", {condition: "UK_twoPower"}),
  achievement(14, "UK", "Peace in Our Time", "我们时代的和平", 3,
    "The GW does not occur.", "大战没有爆发。", {condition: "noGreatWar", noGreatWar: true}),
  achievement(15, "UK", "Rule Britannia", "统治吧，不列颠", 3,
    "Control 8 colonial keys that you did not control at the beginning of the game. Controlling 2 naval bases that you did not control at the beginning of the game count as controlling 1 key for this purpose.",
    "控制 8 个游戏开始时不属于你的殖民地关键区；游戏开始后新控制的 2 个海军基地计为 1 个关键区。",
    {condition: "UK_ruleBritannia"}),
  achievement(16, "UK", "Balance of Power", "势力均衡", 4,
    "No player controls at least 1 non-home key in Europe. Gain 2 VPs if no player controls at least 2 non-home keys in Europe.",
    "没有玩家在欧洲控制至少 1 个非本土关键区。若没有玩家控制至少 2 个，得 2 VP。",
    {condition: "UK_balanceOfPower", partialVp: 2}),

  // ---------------------------------------------------------------- France 17-24 (22 restored)
  ranked(17, "FR", "European Keys", "欧洲关键区", "rankedEuropeanKeys", "Control the most European keys.", "控制最多的欧洲关键区。"),
  ranked(18, "FR", "Flashpoints", "闪点", "rankedFlashpoints", "Control the most flashpoints. Both 1st and 2nd place in Power Projection count as controlling 1 flashpoint.", "控制最多的闪点；力量投射第 1 和第 2 名各计为控制 1 个闪点。"),
  ranked(19, "FR", "Look to Paris", "放眼巴黎", "rankedAlliances", "Have the most minor power alliances.", "拥有最多小国盟友。"),
  ranked(20, "FR", "Stability", "稳定", "rankedStability", "Have the highest stability.", "拥有最高稳定度。"),
  achievement(21, "FR", "France Resurgent", "法兰西复兴", 3,
    "Control 6 colonial keys, at least two of which must be on the Asia map. Mexico counts as 2 keys. OR control 3 colonial keys (Mexico still counts as 2) and dominate the Power Projection flashpoint.",
    "控制 6 个殖民地关键区，其中至少 2 个在亚洲地图（墨西哥计 2 个）；或控制 3 个殖民地关键区（墨西哥仍计 2 个）并支配力量投射闪点。",
    {condition: "FR_franceResurgent"}),
  achievement(22, "FR", "Peace in Our Time", "我们时代的和平", 3,
    "The GW does not occur.", "大战没有爆发。",
    {condition: "noGreatWar", noGreatWar: true}),
  achievement(23, "FR", "City of Light", "光之城", 3,
    "Have 4 City of Light points.", "拥有 4 点“光之城”点数。", {condition: "FR_cityOfLight"}),
  achievement(24, "FR", "Napoleon's Legacy", "拿破仑的遗产", 4,
    "Control 4 European keys that you did not control at the beginning of the game, of which one may be substituted by a minor power alliance in Europe. You may reveal this National Goal when you launch a war of conquest; while revealed, reduce your stability loss for declaring wars of conquest by 2 (you still increase the WTT by 1). Gain 2 VPs if you control 3 such European keys (one may be substituted by a minor power alliance in Europe).",
    "控制 4 个游戏开始时不属于你的欧洲关键区，其中 1 个可由欧洲小国盟友替代。可在发动征服战争时揭示本目标；揭示后发动征服战争少失去 2 点稳定（仍提升 1 点世界紧张）。控制 3 个此类关键区得 2 VP。",
    {condition: "FR_napoleon", partialVp: 2, revealable: true}),

  // ---------------------------------------------------------------- Austria-Hungary 25-33
  ranked(25, "AU", "European Keys", "欧洲关键区", "rankedEuropeanKeys", "Control the most European keys.", "控制最多的欧洲关键区。"),
  ranked(26, "AU", "Flashpoints", "闪点", "rankedFlashpoints", "Control the most flashpoints. Both 1st and 2nd place in Power Projection count as controlling 1 flashpoint.", "控制最多的闪点；力量投射第 1 和第 2 名各计为控制 1 个闪点。"),
  ranked(27, "AU", "Look to Vienna", "放眼维也纳", "rankedAlliances", "Have the most minor power alliances.", "拥有最多小国盟友。"),
  ranked(28, "AU", "Stability", "稳定", "rankedStability", "Have the highest stability.", "拥有最高稳定度。"),
  achievement(29, "AU", "Contain Italy", "遏制意大利", 3,
    "Italian unification does not occur. A unified Italy controls 3 or fewer Italian keys.",
    "意大利未统一；若已统一，其控制的意大利关键区不超过 3 个。", {condition: "AU_containItaly"}),
  achievement(30, "AU", "Contain Prussia", "遏制普鲁士", 3,
    "German unification does not occur. A unified Germany controls 8 or fewer German keys.",
    "德意志未统一；若已统一，其控制的德意志关键区不超过 8 个。", {condition: "AU_containPrussia"}),
  achievement(31, "AU", "Precarious Position", "岌岌可危", 3,
    "This NG is only available in the 1870 and 1880 scenarios. Be in a committed alliance box with another player.",
    "本目标仅用于 1870 与 1880 剧本。与另一名玩家同处一个承诺联盟框。",
    {condition: "AU_precarious", scenarioOnly: true}),
  achievement(32, "AU", "Peace in Our Time", "我们时代的和平", 3,
    "The GW does not occur.", "大战没有爆发。", {condition: "noGreatWar", noGreatWar: true}),
  achievement(33, "AU", "Bind Them Together", "把他们绑在一起", 4,
    "Grant citizenship to 4 minority nationalities. You must control a space with that nationality for it to count. Gain 2 VPs if you grant citizenship to 3 minority nationalities and control a matching space.",
    "授予 4 个少数民族完整公民权，且必须控制相应民族空间才计数。授予 3 个并控制相应空间得 2 VP。",
    {condition: "AU_bindThemTogether", partialVp: 2}),

  // ---------------------------------------------------------------- Russia 34-41
  ranked(34, "RU", "European Keys", "欧洲关键区", "rankedEuropeanKeys", "Control the most European keys.", "控制最多的欧洲关键区。"),
  ranked(35, "RU", "Flashpoints", "闪点", "rankedFlashpoints", "Control the most flashpoints. Both 1st and 2nd place in Power Projection count as controlling 1 flashpoint.", "控制最多的闪点；力量投射第 1 和第 2 名各计为控制 1 个闪点。"),
  ranked(36, "RU", "Look to St. Petersburg", "放眼圣彼得堡", "rankedAlliances", "Have the most minor power alliances.", "拥有最多小国盟友。"),
  ranked(37, "RU", "Stability", "稳定", "rankedStability", "Have the highest stability.", "拥有最高稳定度。"),
  achievement(38, "RU", "Eastern Ambitions", "东方野心", 3,
    "Control 4 keys in Asia that you did not control at the beginning of the game. OR control 2 colonial keys on the Asia map and dominate the Power Projection flashpoint. Special: Russia may spend 3 CP to reveal this card and take control of Manchuria or Korea (once).",
    "控制 4 个游戏开始时不属于你的亚洲关键区；或在亚洲地图控制 2 个殖民地关键区并支配力量投射闪点。特殊：俄国可花 3 CP 揭示本目标并取得满洲或朝鲜的控制（一次）。",
    {condition: "RU_easternAmbitions", revealable: true}),
  achievement(39, "RU", "Peace in Our Time", "我们时代的和平", 3,
    "The GW does not occur.", "大战没有爆发。", {condition: "noGreatWar", noGreatWar: true}),
  achievement(40, "RU", "Finish off the Turks", "解决土耳其人", 3,
    "The Ottomans control 2 or fewer Balkan spaces. OR the Ottomans control no spaces in the Caucasus.",
    "奥斯曼控制的巴尔干空间不超过 2 个；或奥斯曼在高加索没有空间。", {condition: "RU_finishTurks"}),
  achievement(41, "RU", "Russian Hegemony", "俄国霸权", 4,
    "Control 5 European keys that you did not control at the beginning of the game. Alliances with minor powers in the Balkans count as control. Gain 2 VPs if you control 4 such European keys.",
    "控制 5 个游戏开始时不属于你的欧洲关键区；巴尔干小国盟友计为控制。控制 4 个得 2 VP。",
    {condition: "RU_russianHegemony", partialVp: 2}),

  // ---------------------------------------------------------------- Ottoman 42-49
  ranked(42, "OT", "Scramble for Africa", "争夺非洲", "rankedAfricaKeys", "Control the most keys in Africa (including North Africa). Minor power alliances in Africa count as control.", "控制非洲（含北非）最多的关键区；非洲的小国盟友计为控制。"),
  ranked(43, "OT", "Flashpoints", "闪点", "rankedFlashpoints", "Control the most flashpoints. Both 1st and 2nd place in Power Projection count as controlling 1 flashpoint.", "控制最多的闪点；力量投射第 1 和第 2 名各计为控制 1 个闪点。"),
  ranked(44, "OT", "Look to Istanbul", "放眼伊斯坦布尔", "rankedAlliances", "Have the most minor power alliances.", "拥有最多小国盟友。"),
  ranked(45, "OT", "Stability", "稳定", "rankedStability", "Have the highest stability.", "拥有最高稳定度。"),
  achievement(46, "OT", "Precarious Position", "岌岌可危", 3,
    "Be in a committed alliance box with another player.", "与另一名玩家同处一个承诺联盟框。",
    {condition: "OT_precarious"}),
  achievement(47, "OT", "Peace in Our Time", "我们时代的和平", 3,
    "The GW does not occur.", "大战没有爆发。", {condition: "noGreatWar", noGreatWar: true}),
  achievement(48, "OT", "Europeanization", "欧洲化", 3,
    "Have industry level 4.", "工业等级达到 4。", {condition: "OT_industry4"}),
  achievement(49, "OT", "Death Grip", "扼杀", 4,
    "You accomplish this National Goal if the total European home keys you have lost is less than (not equal to) the current turn. Egypt starts the game as a 'lost' key. Gain 2 VPs if you have lost fewer keys than the current turn + 1.",
    "若你失去的欧洲本土关键区总数小于（不等于）当前回合数，则完成本目标。埃及在游戏开始时视为已失去的关键区。若失去数小于当前回合数 +1，得 2 VP。",
    {condition: "OT_deathGrip", partialVp: 2}),
];

export const GOALS_BY_ID: Record<GoalId, GoalDef> = Object.fromEntries(GOALS.map((g) => [g.id, g]));

export const CAMPAIGN_GOALS: GoalDef[] = GOALS.filter((g) => !g.scenarioOnly);

export const goalsForPower = (power: Power): GoalDef[] =>
  CAMPAIGN_GOALS.filter((g) => g.power === power);

export const ALL_GOAL_IDS = GOALS.map((g) => g.id);
export const CAMPAIGN_GOAL_IDS = CAMPAIGN_GOALS.map((g) => g.id);

/** The playbook's goal numbering has a deliberate gap: French goal 22 was
 * omitted from the printed module but is restored from the playbook. */
export const CORRECTIONS = {
  restoredFrenchGoal: 22,
  reconstructedWilhelm: 82,
  austrianScenarioGoal: 31,
} as const;
