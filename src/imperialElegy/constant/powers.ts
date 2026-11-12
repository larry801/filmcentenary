import {Power, PowerState} from "../types";

export interface StabilityEffect {
  vp?: number;
  bm?: number;
  /** Absolute cards (replaces the industry-derived amount), or a delta when delta is true. */
  cards?: number;
  cardDelta?: number;
  abm?: number;
}

export interface PowerDef {
  id: Power;
  name: string;
  nameZh: string;
  adjective: string;
  adjectiveZh: string;
  color: string;
  dark: string;
  capital: string;
  subcapital?: string;
  /** Printed circled values of the campaign setup (playbook scenario 1). */
  start: {
    stability: number;
    manpower: number;
    secondaryManpower?: number;
    industry: number;
    territorialKeys: number;
    colonialKeys: number;
    arabKeys?: number;
  };
  stability: StabilityEffect[];
  /** Cards granted by industry level 0..7. */
  industryCards: number[];
  /** Manpower by territorial-key count.  Index = keys, value = manpower. */
  keyManpower: number[];
  /** UK colonial / OT Arab manpower by secondary-key count. */
  secondaryKeyManpower?: number[];
  /** Auto victory threshold on the key track. */
  autoVictoryKeys?: number;
  autoVictoryColonialKeys?: number;
  /** Reserve-army box limit rule. */
  reserveFormula: "minManpowerIndustry" | "none" | "manpowerPlusOne";
  /** National characteristic bullet points. */
  characteristics: {en: string; zh: string}[];
  /** Text shown on the display for persistence rules. */
  notes?: {en: string; zh: string}[];
}

const genericStability: StabilityEffect[] = [
  {vp: -2, bm: -2, cards: 1},
  {vp: -1, bm: -1, cards: 1},
  {vp: -1, bm: -1},
  {},
  {},
  {},
  {cardDelta: 1},
];

const genericIndustry = [3, 3, 3, 4, 4, 4, 5];

/** Prussia/Germany is the only display with an Industry box 7. */
const germanIndustry = [3, 3, 3, 4, 4, 4, 5, 5];

const keyManpower15 = [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5];

export const POWER_DEFS: Record<Power, PowerDef> = {
  GE: {
    id: "GE",
    name: "Germany",
    nameZh: "德国",
    adjective: "German",
    adjectiveZh: "德意志",
    color: "#4a4a4a",
    dark: "#2c2c2c",
    capital: "berlin",
    start: {stability: 3, manpower: 2, industry: 1, territorialKeys: 5, colonialKeys: 0},
    stability: genericStability,
    industryCards: germanIndustry,
    keyManpower: keyManpower15,
    autoVictoryKeys: 15,
    reserveFormula: "minManpowerIndustry",
    characteristics: [
      {en: "Bewegungskrieg: win all ties when determining initiative at the start of a war.  During the GW, Germany's alliance always goes first.", zh: "运动战：开战时决定先手，德国赢得所有平局；大战期间德国所在同盟永远先行动。"},
      {en: "Superior Staff Work: during Germany's first impulse of a war or the GW they may conduct one free deploy reserves action.", zh: "卓越参谋工作：在一场战争或大战的德国首个行动轮，可免费执行一次部署预备军行动。"},
      {en: "German Confederation: after winning a war of unification, Germany may take control of one German minor ally (Bavaria, Saxony or Hanover).", zh: "德意志邦联：赢得统一战争后，德国可吞并一个德意志小国盟友（巴伐利亚、萨克森或汉诺威）。"},
      {en: "Imperial Germany: when Germany unifies, gain +1 manpower during the end phase (one time).", zh: "德意志帝国：德国统一时，在结束阶段获得 +1 人力（一次性）。"},
      {en: "Blood and Iron!: during the end phase of turn 1, Prussia may search the NG deck for Unification! and must play it faceup.", zh: "铁血政策：第 1 回合结束阶段，普鲁士可从国家目标牌堆搜索“统一！”并明置。"},
      {en: "Continental Focus: until Germany unifies its naval counter limit is 2 squadrons and 2 dreadnoughts, and pacification costs 2 CP.", zh: "大陆重心：德国统一前海军上限为 2 个分舰队和 2 艘无畏舰，绥靖行动花费 2 CP。"},
      {en: "Zollverein: German unification spaces are always territorial keys to Germany.", zh: "关税同盟：德意志统一空间对德国永远视为领土关键区。"},
    ],
  },
  UK: {
    id: "UK",
    name: "United Kingdom",
    nameZh: "英国",
    adjective: "British",
    adjectiveZh: "不列颠",
    color: "#a12b2b",
    dark: "#6d1717",
    capital: "london",
    start: {stability: 3, manpower: 3, secondaryManpower: 1, industry: 2, territorialKeys: 5, colonialKeys: 7},
    stability: genericStability,
    industryCards: genericIndustry,
    keyManpower: [1, 1, 1, 2, 2, 3],
    secondaryKeyManpower: [1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4],
    autoVictoryKeys: 15,
    autoVictoryColonialKeys: 17,
    reserveFormula: "none",
    characteristics: [
      {en: "Professional Army: the UK can never build reserve armies.  Until the GW it may only build the 1st British Army (innate +1 DRM).", zh: "职业陆军：英国永远不能建造预备军；大战前只能建造英国第 1 军团（固有 +1 DRM）。"},
      {en: "Join Your Country's Army!: armies gained during the GW outbreak are placed in London at the start of GW turn 1.", zh: "参军去吧！：大战爆发时获得的军团在首轮大战计划阶段放在伦敦。"},
      {en: "The Indian Army: Indian armies are limited by colonial manpower and displace to India or Bengal.", zh: "印度陆军：印度军团数量受殖民地人力限制，并会自动转移至印度或孟加拉。"},
      {en: "Maintaining the Status Quo: as primary defender the UK may invite neutral players to join the war.", zh: "维持现状：作为主要防御方时，英国可邀请中立国参战。"},
      {en: "Rapid Deployment: when the UK enters a war it may immediately conduct one free naval movement action.", zh: "快速部署：英国参战时立即获得一次免费海军移动行动。"},
      {en: "Crown Jewel: controlling India counts as controlling two colonial keys.", zh: "皇冠明珠：控制印度视为控制两个殖民地关键区。"},
      {en: "British Banking: the UK may pass with two cards and may save two cards for the next turn.", zh: "英国银行：英国可在手牌为 2 张时停牌，并可保留 2 张牌到下一回合。"},
      {en: "India: while India is unstable the UK draws one fewer card and Indian armies suffer -1 DRM in land battles.", zh: "印度：印度不稳定时英国少抽 1 张牌，印度军团陆战 -1 DRM。"},
    ],
  },
  FR: {
    id: "FR",
    name: "France",
    nameZh: "法国",
    adjective: "French",
    adjectiveZh: "法兰西",
    color: "#245a94",
    dark: "#153a63",
    capital: "paris",
    start: {stability: 3, manpower: 4, industry: 1, territorialKeys: 9, colonialKeys: 0},
    stability: genericStability,
    industryCards: genericIndustry,
    keyManpower: keyManpower15,
    autoVictoryKeys: 15,
    reserveFormula: "minManpowerIndustry",
    characteristics: [
      {en: "The Zouaves: an elite colonial EF.  +1 pacification and +1 land battle; may be rebuilt in Algeria for 1 CP, and for free at the start of each Prep Phase.", zh: "祖阿夫：精英殖民远征军，绥靖 +1、陆战 +1；可在阿尔及利亚花 1 CP 重建，并在每个准备阶段开始时免费重建。"},
      {en: "Second French Empire: after calculating the CP war budget (including the GW), France automatically increases it by 1.", zh: "法兰西第二帝国：计算战争预算（包括大战）后，法国自动 +1 CP。"},
      {en: "The Third Republic: once per turn at the start of the alliance resolution step, France gains 2 free CP for alliance track actions.", zh: "法兰西第三共和国：每回合联盟结算阶段开始时，法国获得 2 点免费 CP，仅用于联盟轨道行动。"},
      {en: "Cultural Symbol: with at least 4 City of Light points France draws +1 card per turn (maximum 6 points).", zh: "文化象征：拥有至少 4 点“光之城”点数时，法国每回合多抽 1 张牌（上限 6 点）。"},
    ],
  },
  AU: {
    id: "AU",
    name: "Austria-Hungary",
    nameZh: "奥匈帝国",
    adjective: "Austrian",
    adjectiveZh: "奥地利",
    color: "#c9a227",
    dark: "#8a6d12",
    capital: "vienna",
    subcapital: "hungary",
    start: {stability: 3, manpower: 4, industry: 1, territorialKeys: 9, colonialKeys: 0},
    stability: genericStability,
    industryCards: genericIndustry,
    keyManpower: keyManpower15,
    autoVictoryKeys: 15,
    reserveFormula: "minManpowerIndustry",
    characteristics: [
      {en: "Metternich's Legacy: at the end of the turn 1 diplomacy phase, Austria gains alliances with two minor powers that contain no opponent's diplomacy marker.", zh: "梅特涅的遗产：第 1 回合外交阶段结束时，奥地利获得两个不含对手外交标记的小国盟友。"},
      {en: "A Compromise Needed: during the turn 2 prep phase add The Dual Monarchy to the Austrian hand if it was not played on turn 1.", zh: "需要妥协：若“二元君主国”未在第 1 回合打出，则在第 2 回合准备阶段加入奥地利手牌。"},
      {en: "Reforms - 3 CP: grant an eligible nationality rights.  Expand Citizenship - 3 CP: roll 3+ to grant full citizenship.", zh: "改革（3 CP）：给予一个合格民族权利。扩大公民权（3 CP）：掷 3+ 以授予完整公民权。"},
      {en: "Incorporate: for 3 CP take control of a minor ally with full citizenship.  Austria may also declare wars of unification on citizen nationalities.", zh: "合并：花 3 CP 吞并一个拥有完整公民权的盟友小国；奥地利也可对拥有公民权的民族发动统一战争。"},
      {en: "Unstable Situation: whenever Austria loses stability roll a die, +1 per nationality with rights; on 6+ nothing happens, otherwise discard a card or take a -1 card marker.", zh: "动荡局势：奥地利每次失去稳定时掷骰，每个拥有权利民族 +1；6+ 无事，否则弃 1 张牌或获得 -1 抽牌标记。"},
      {en: "Continental Power: pacification actions cost 2 CP.  Arbiter of Italy: may liberate Italian nationalities before unification.", zh: "大陆强权：绥靖行动花费 2 CP。意大利仲裁者：统一前可解放意大利民族。"},
      {en: "A New Way Forward: gain +1 manpower when 4 nationalities have citizenship and Austria controls a space with that nationality.", zh: "新出路：当 4 个民族拥有公民权且奥地利控制相应民族空间时，+1 人力。"},
    ],
  },
  RU: {
    id: "RU",
    name: "Russia",
    nameZh: "俄国",
    adjective: "Russian",
    adjectiveZh: "俄罗斯",
    color: "#e8e4d8",
    dark: "#9d988a",
    capital: "st-petersburg",
    subcapital: "moscow",
    start: {stability: 3, manpower: 5, industry: 0, territorialKeys: 12, colonialKeys: 0},
    stability: [
      {vp: -2, bm: -2, cards: 1},
      {vp: -1, bm: -1, cards: 1},
      {vp: -1, bm: -1},
      {},
      {},
      {cardDelta: 1},
      {cardDelta: 1},
    ],
    industryCards: [3, 3, 3, 4, 4, 4, 5],
    keyManpower: [2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6],
    autoVictoryKeys: 20,
    reserveFormula: "manpowerPlusOne",
    characteristics: [
      {en: "Russian Steamroller: reserve army limit is the lower of manpower or industry, +1.", zh: "俄国压路机：预备军上限为人力与工业中较低者 +1。"},
      {en: "Scorched Earth: the first key Russia loses during the GW does not lower Russian stability (once).", zh: "焦土政策：大战中俄国失去的第一个关键区不降低稳定（一次）。"},
      {en: "Endless Space: armies supporting into or from a Russian home space contribute half FP.", zh: "无尽空间：支援进入或离开俄国本土空间的军团只提供一半火力。"},
      {en: "Trans-Siberian Railroad: completing the TSRR gives +1 card per turn, +2 keys, and one rail army per impulse.", zh: "西伯利亚铁路：建成后每回合 +1 张牌、+2 关键区，并且每个行动轮可沿铁路移动 1 个军团。"},
      {en: "Agrarian: Russia needs a 6 (after DRMs) to industrialize.", zh: "农业国：俄国工业化需要掷出 6（含修正）。"},
      {en: "The Second Rome: occupying Istanbul at the end of a won war gives control of it; controlling Istanbul at game end / GW start gives 2 VPs.", zh: "第二罗马：赢得战争并占领伊斯坦布尔时取得控制；游戏结束或大战开始时控制伊斯坦布尔得 2 VP。"},
      {en: "Tsarist Repression: +1 card at stability 5 (not cumulative with the stability 6 card).", zh: "沙皇镇压：稳定 5 时 +1 张牌（不与稳定 6 的 +1 叠加）。"},
    ],
  },
  OT: {
    id: "OT",
    name: "Ottoman Empire",
    nameZh: "奥斯曼帝国",
    adjective: "Ottoman",
    adjectiveZh: "奥斯曼",
    color: "#2f7a45",
    dark: "#1d4d2c",
    capital: "istanbul",
    subcapital: "ankara",
    start: {stability: 3, manpower: 3, secondaryManpower: 1, industry: 0, territorialKeys: 8, colonialKeys: 0, arabKeys: 5},
    stability: [
      {vp: -2, bm: -2, abm: -2, cards: 1},
      {vp: -1, bm: -2, abm: -2, cards: 1},
      {vp: -1, bm: -1, abm: -2},
      {abm: -1},
      {},
      {},
      {cardDelta: 1},
    ],
    industryCards: [3, 3, 3, 4, 4, 4, 5],
    keyManpower: [1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 4, 4, 4, 4],
    secondaryKeyManpower: [1, 1, 1, 1, 1, 1, 2],
    autoVictoryKeys: 14,
    reserveFormula: "minManpowerIndustry",
    characteristics: [
      {en: "Local Autonomy: keys with Arab or Egyptian nationality count only as Arab keys.  Tunisia and Tripoli do not count as keys unless a land LoC can be traced.", zh: "地方自治：拥有阿拉伯或埃及民族的关键区只计入阿拉伯关键区；突尼斯和的黎波里除非能沿陆路追溯交通线，否则不计为关键区。"},
      {en: "Ottoman Manpower: Turkish armies are built in keys without a minority nationality; Arab armies only in Arab keys.  Arab and Turkish manpower are tracked separately.", zh: "奥斯曼人力：土耳其军团只能建在无少数民族的关键区，阿拉伯军团只能建在阿拉伯关键区；阿拉伯与土耳其人力分开记录。"},
      {en: "Europeanization: the Ottomans cannot play their own cards into industrialization and need a 6 to advance industry.", zh: "欧洲化：奥斯曼不能用本国牌进行工业化，且工业化需要掷出 6。"},
      {en: "Poor Infrastructure: all Ottoman home spaces, including those in Europe, have a stacking limit of 2.", zh: "基础设施落后：所有奥斯曼本土空间（包括欧洲部分）堆叠上限为 2。"},
      {en: "Jihad: gain 3 Jihad markers at the start of the GW.  Discard one in a qualifying battle to give the opponent -1.", zh: "圣战：大战开始时获得 3 个圣战标记；在符合条件的战斗中弃 1 个使对手 -1。"},
    ],
  },
};

export const POWER_NAMES_ZH: Record<Power, string> = {
  GE: "德国",
  UK: "英国",
  FR: "法国",
  AU: "奥匈帝国",
  RU: "俄国",
  OT: "奥斯曼帝国",
};

export const CREATURE_NAMES: Record<string, string> = {
  GE: "Prussia/Germany",
  UK: "United Kingdom",
  FR: "France",
  AU: "Austria-Hungary",
  RU: "Russia",
  OT: "Ottoman Empire",
};

/** Keys needed to dominate a flashpoint (player aid card page 2). */
export const FLASHPOINTS: Record<string, {name: string; nameZh: string; keys: number; cardBonus: number}> = {
  lowCountries: {name: "Low Countries", nameZh: "低地国家", keys: 3, cardBonus: 1},
  germany: {name: "Germany", nameZh: "德意志", keys: 6, cardBonus: 1},
  italy: {name: "Italy", nameZh: "意大利", keys: 4, cardBonus: 1},
  balkans: {name: "Balkans", nameZh: "巴尔干", keys: 4, cardBonus: 1},
  centralEurope: {name: "Central Europe", nameZh: "中欧", keys: 5, cardBonus: 1},
  africa: {name: "Africa", nameZh: "非洲", keys: 6, cardBonus: 1},
  greatGame: {name: "The Great Game", nameZh: "大博弈", keys: 5, cardBonus: 1},
  chinaJapan: {name: "Qing China & Japan", nameZh: "清帝国与日本", keys: 4, cardBonus: 1},
  powerProjection: {name: "Power Projection", nameZh: "力量投射", keys: 0, cardBonus: 0},
  suez: {name: "Suez Canal", nameZh: "苏伊士运河", keys: 1, cardBonus: 1},
};

export const SETUP_MARKERS: Partial<Record<Power, Partial<PowerState>>> = {
  GE: {flags: {continentalFocus: true}},
  UK: {indiaStable: true},
  FR: {government: "secondEmpire", cityOfLight: 0},
  AU: {rights: [], citizenship: []},
  RU: {tsrr: false, scorchedEarth: true},
  OT: {jihad: 0},
};
