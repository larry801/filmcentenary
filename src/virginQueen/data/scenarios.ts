import {Controller} from "../constant/general";
import {ALL_CARD_NUMBERS, campaignCards, tournamentCards} from "./deck";
import {CAMPAIGN_ROYALS, TOURNAMENT_ROYALS, TOURNAMENT_ROYAL_STATUS} from "./royals";
import {CAMPAIGN_PATRONAGE, TOURNAMENT_PATRONAGE} from "./patrons";
import {CAMPAIGN_VP_AWARDS, TOURNAMENT_UNAVAILABLE_VP_AWARDS, TOURNAMENT_VP_AWARDS} from "./patronage";
import {SCIENCE_BONUSES} from "./scienceBonuses";
import {ScenarioPhase, ScenarioSetup, ScenarioSpaceSetup} from "./types";
import {tutorialSpaceAllowed} from "../tutorial";

/**
 * Scenario Book convention: upper-case SCM/HCM marks the Catholic side and
 * lower-case scm/hcm marks the Protestant side.  The marker colour still
 * identifies the controlling power, so lower-case entries keep that control
 * and must also set `religion: "protestant"`.
 */
const scm = (control: Controller, extra: ScenarioSpaceSetup = {}): ScenarioSpaceSetup => ({
    control,
    controlMarker: "scm",
    ...extra,
});

const hcm = (control: Controller, extra: ScenarioSpaceSetup = {}): ScenarioSpaceSetup => ({
    control,
    controlMarker: "hcm",
    ...extra,
});

const allScienceBonusIds = SCIENCE_BONUSES.map((b) => b.id);

const commonInfluence = {
    ottoman: {venice: 2},
    spain: {papacy: 1, venice: 0, ireland: 1},
    england: {scotland: 0, ireland: 2},
    france: {papacy: 0, scotland: 0, ireland: 0},
    hre: {papacy: 0, venice: 0, ireland: 0},
    protestant: {scotland: 1},
} as const;

const phaseOrder: ScenarioPhase[] = ["cardDraw", "diplomacy", "spring", "action"];

/** Campaign scenario: 7 turns, 1559-1598 (Scenario Book pages 6-7). */
export const CAMPAIGN: ScenarioSetup = {
    id: "campaign",
    nameZh: "拉罗谢尔之围",
    nameEn: "The Siege of La Rochelle",
    startTurn: 1,
    endTurn: 7,
    startYear: 1559,
    endYear: 1598,
    vpStart: {
        ottoman: 11,
        spain: 17,
        england: 6,
        france: 9,
        hre: 8,
        protestant: 1,
    },
    protestantSpaces: 18,
    wars: [
        ["ottoman", "spain"],
        ["england", "france"],
    ],
    alliances: [
        ["spain", "papacy"],
        ["france", "scotland"],
    ],
    influence: commonInfluence,
    spaces: {
        // Ottoman
        istanbul: scm("ottoman", {
            leaders: ["mehmed", "piyale"],
            units: {ottoman: {regular: 8, cav: 2}},
            naval: {ottoman: {galley: 3}},
        }),
        salonika: scm("ottoman", {units: {ottoman: {regular: 1}}}),
        athens: scm("ottoman", {units: {ottoman: {regular: 1}}}),
        scutari: {units: {ottoman: {cav: 1}}},
        belgrade: scm("ottoman", {units: {ottoman: {regular: 1}}}),
        buda: scm("ottoman", {units: {ottoman: {regular: 2}}}),
        algiers: scm("ottoman", {
            leaders: ["dragut"],
            units: {ottoman: {regular: 2}},
            naval: {ottoman: {corsair: 3}},
        }),

        // Spain
        madrid: scm("spain", {leaders: ["alba"], units: {spain: {regular: 3}}}),
        barcelona: scm("spain", {units: {spain: {regular: 1}}}),
        seville: scm("spain", {naval: {spain: {galleon: 1}}, notes: "Seville/Cadiz"}),
        oran: {units: {spain: {regular: 1}}},
        milan: scm("spain", {units: {spain: {regular: 2}}}),
        genoa: scm("spain", {units: {spain: {regular: 1}}}),
        ravenna: hcm("spain", {units: {papacy: {regular: 1}}}),
        ancona: hcm("spain"),
        rome: scm("spain", {units: {papacy: {regular: 2}}}),
        naples: scm("spain", {units: {spain: {regular: 1}}}),
        messina: {
            naval: {spain: {galley: 2}, papacy: {galley: 1}},
        },
        malta: scm("spain", {units: {spain: {regular: 2}}, notes: "Knights of St. John"}),
        alkmaar: hcm("spain"),
        haarlem: hcm("spain"),
        amsterdam: scm("spain"),
        rotterdam: hcm("spain"),
        utrecht: hcm("spain"),
        arnhem: hcm("spain"),
        brielle: hcm("spain"),
        antwerp: scm("spain", {units: {spain: {regular: 1}}, notes: "Walloon regular"}),
        sHertogenbosch: hcm("spain"),
        flushing: hcm("spain"),
        ghent: hcm("spain", {religion: "protestant"}),
        brussels: scm("spain", {units: {spain: {regular: 1}}}),
        maastricht: hcm("spain"),

        // England
        london: scm("england", {units: {england: {regular: 2}}, religion: "protestant"}),
        portsmouth: {naval: {england: {galleon: 1}}},
        bristol: scm("england", {units: {england: {regular: 1}}, religion: "protestant"}),
        york: scm("england", {religion: "protestant"}),
        berwick: hcm("england", {
            units: {england: {regular: 2}},
            naval: {england: {galleon: 1}},
        }),
        dublin: scm("england", {units: {england: {regular: 1}}}),

        // France
        paris: scm("france", {
            leaders: ["montmorency"],
            units: {france: {regular: 3}},
        }),
        orleans: {units: {france: {regular: 1}}},
        calais: scm("france", {naval: {france: {galleon: 1}}}),
        rouen: scm("france", {religion: "protestant"}),
        metz: scm("france", {units: {france: {regular: 1}}}),
        lyon: scm("france", {units: {france: {regular: 1}}}),
        marseille: scm("france", {units: {france: {regular: 1}}}),
        bordeaux: {units: {france: {regular: 1}}},
        laRochelle: scm("france", {religion: "protestant"}),
        nantes: hcm("france", {religion: "protestant"}),
        amboise: hcm("france", {religion: "protestant"}),
        brest: {naval: {france: {galley: 1}}},
        edinburgh: scm("france", {units: {france: {regular: 1}}}),
        glasgow: hcm("france"),
        stirling: hcm("france"),
        perth: hcm("france", {religion: "protestant"}),

        // Holy Roman Empire
        vienna: scm("hre", {
            leaders: ["schwendi"],
            units: {hre: {regular: 2, merc: 2}},
            notes: "Holy Roman Capital",
        }),
        prague: scm("hre", {units: {hre: {regular: 1}}}),
        augsburg: scm("hre", {units: {hre: {regular: 1}}, religion: "protestant"}),
        frankfurt: scm("hre", {units: {hre: {regular: 1}}, religion: "protestant"}),
        szigetvar: {leaders: ["zrinyi"], units: {hre: {regular: 1}}},

        // Minor powers
        lisbon: {units: {portugal: {regular: 1}}, naval: {portugal: {galleon: 1}}},
        venice: {units: {venice: {regular: 2}}, naval: {venice: {galley: 3}}},
        candia: {units: {venice: {regular: 1}}},
        cyprus: {units: {venice: {regular: 1}}},
        florence: {units: {independent: {regular: 1}}},
        tunis: {units: {independent: {regular: 1}}},
    },
    worldSpaces: {},
    powerCard: {
        ottoman: {
            scmOnCard: 4,
            suezAttempts: 0,
            seaCaptains: ["muratReis"],
        },
        spain: {
            scmOnCard: 3,
            worldMapFortresses: 1,
            treasures: 1,
        },
        england: {
            scmOnCard: 3,
            seaCaptains: ["hawkins"],
        },
        france: {
            scmOnCard: 2,
            seaCaptains: ["leTestu", "villegaignon"],
            sharedSeaCaptains: ["deSores", "leClerc"],
        },
        hre: {
            scmOnCard: 4,
            mercenariesForHire: 4,
            seaCaptains: ["henszlein"],
        },
        protestant: {
            seaCaptains: ["laudonniere"],
            sharedSeaCaptains: ["deSores", "leClerc"],
            components: {
                dutch: {scmOnCard: 3},
                huguenot: {scmOnCard: 5, leadersOffMap: ["coligny"]},
            },
        },
    },
    royals: CAMPAIGN_ROYALS,
    royalStatus: {},
    patronage: {
        artists: [...CAMPAIGN_PATRONAGE.artists],
        scientists: [...CAMPAIGN_PATRONAGE.scientists],
        vpMarkers: 19,
        artistVpMarkers: 13,
        scientistVpMarkers: 6,
        scienceBonuses: [...allScienceBonusIds],
        vpAwards: [...CAMPAIGN_VP_AWARDS],
    },
    cardsInPlay: campaignCards(),
    cardsRemoved: [4, 37],
    cardsOnBoard: [],
    phaseOrder: [...phaseOrder],
    notes: [
        "Six-player Campaign setup.  #4 German Intervention and #37 The Sublime Porte are removed.",
        "Spain and the Papacy are allied; France and Scotland are allied; Ottoman-Spain and England-France are at war.",
        "Neither of the two starting wars may be ended during Turn 1 negotiations.",
        "Elisabeth de Valois has a prearranged marriage to Philip II; breaking it costs Spain one card on Turn 2.",
        "Protestant Spaces card starts at 18.",
        "VP track: Protestants 1, English 6, HRE 8, French 9, Ottoman 11, Spanish 17.",
    ],
    notesZh: [
        "六人战役设置。#4 德意志的介入与 #37 崇高的门被移除。",
        "西班牙与教宗国结盟；法国与苏格兰结盟；奥斯曼-西班牙、英格兰-法国处于战争。",
        "第 1 回合谈判中不得结束这两场初始战争。",
        "瓦卢瓦的伊丽莎白与腓力二世已有婚约；若毁约，西班牙在第 2 回合少抽 1 张牌。",
        "新教地区标记从 18 开始。",
        "VP 轨道：新教 1、英格兰 6、神圣罗马帝国 8、法国 9、奥斯曼帝国 11、西班牙 17。",
    ],
};

/** Tournament scenario: 4 turns, 1570-1593 (Scenario Book pages 8-10). */
export const TOURNAMENT: ScenarioSetup = {
    id: "tournament",
    nameZh: "荷兰起义开始",
    nameEn: "The Dutch Revolt Starts",
    startTurn: 3,
    endTurn: 6,
    startYear: 1570,
    endYear: 1593,
    vpStart: {
        ottoman: 14,
        spain: 15,
        england: 11,
        france: 10,
        hre: 8,
        protestant: 10,
    },
    protestantSpaces: 30,
    wars: [
        ["ottoman", "spain"],
        ["france", "protestant"],
    ],
    alliances: [
        ["spain", "papacy"],
        ["spain", "venice"],
    ],
    influence: commonInfluence,
    spaces: {
        // Ottoman
        istanbul: scm("ottoman", {
            leaders: ["mehmed", "piyale"],
            units: {ottoman: {regular: 6, cav: 1}},
            naval: {ottoman: {galley: 5}},
        }),
        salonika: scm("ottoman", {units: {ottoman: {regular: 1}}}),
        athens: scm("ottoman", {units: {ottoman: {regular: 1}}}),
        belgrade: scm("ottoman", {units: {ottoman: {regular: 1}}}),
        buda: scm("ottoman", {units: {ottoman: {regular: 2}}}),
        tripoli: {
            leaders: ["uluchAli"],
            naval: {ottoman: {corsair: 3}},
            notes: "Djerba/Tripoli",
        },
        tunis: scm("ottoman", {units: {ottoman: {regular: 2}}}),
        algiers: scm("ottoman", {units: {ottoman: {regular: 2}}}),
        granada: {
            units: {ottoman: {regular: 2}},
            unrest: true,
            notes: "Morisco regulars",
        },

        // Spain
        madrid: scm("spain", {
            leaders: ["donJohn"],
            units: {spain: {regular: 2, merc: 2}},
        }),
        barcelona: scm("spain", {
            units: {spain: {regular: 1}},
            naval: {spain: {galley: 1}},
        }),
        seville: scm("spain"),
        gibraltar: {unrest: true},
        cartagena: {unrest: true, naval: {spain: {galley: 1}}},
        oran: {units: {spain: {regular: 1}}},
        milan: scm("spain", {units: {spain: {regular: 1, merc: 1}}}),
        genoa: scm("spain", {
            units: {spain: {regular: 1}},
            naval: {spain: {galley: 1}},
        }),
        venice: scm("spain", {
            units: {venice: {regular: 2}},
            naval: {venice: {galley: 3}},
        }),
        zara: hcm("spain"),
        ravenna: hcm("spain", {units: {papacy: {regular: 1}}}),
        ancona: hcm("spain"),
        rome: scm("spain", {units: {papacy: {regular: 2}}}),
        naples: scm("spain", {units: {spain: {regular: 1}}}),
        messina: {naval: {spain: {galley: 1}, papacy: {galley: 1}}},
        malta: scm("spain", {units: {spain: {regular: 1}}, notes: "Knights of St. John"}),
        corfu: hcm("spain"),
        candia: hcm("spain", {units: {venice: {regular: 1}}}),
        cyprus: hcm("spain", {
            units: {venice: {regular: 1}},
            notes: "+1 VP Cyprus marker",
        }),
        alkmaar: hcm("spain", {religion: "protestant"}),
        haarlem: hcm("spain"),
        amsterdam: scm("spain", {religion: "protestant"}),
        rotterdam: hcm("spain"),
        utrecht: hcm("spain", {units: {spain: {regular: 1}}}),
        arnhem: hcm("spain"),
        brielle: hcm("spain", {religion: "protestant"}),
        antwerp: scm("spain", {
            units: {spain: {regular: 2}},
            notes: "Walloon regulars",
        }),
        sHertogenbosch: hcm("spain"),
        flushing: hcm("spain", {religion: "protestant"}),
        ghent: hcm("spain"),
        brussels: scm("spain", {leaders: ["alba"], units: {spain: {regular: 1}}}),
        maastricht: hcm("spain"),

        // England
        london: scm("england", {
            leaders: ["leicester"],
            units: {england: {regular: 3}},
            naval: {england: {galleon: 1}},
            religion: "protestant",
        }),
        york: scm("england", {units: {england: {regular: 1}}, religion: "protestant"}),
        bristol: scm("england", {units: {england: {regular: 1}}, religion: "protestant"}),
        portsmouth: {naval: {england: {galleon: 1}}},
        plymouth: {naval: {england: {galleon: 1}}},
        dublin: scm("england", {units: {england: {regular: 1}}}),
        berwick: hcm("england"),

        // France
        paris: scm("france", {
            leaders: ["henryIII"],
            units: {france: {regular: 1, merc: 2}},
        }),
        calais: scm("france", {units: {france: {regular: 1}}}),
        rouen: scm("france", {naval: {france: {galleon: 1}}}),
        metz: scm("france", {units: {france: {regular: 1}}}),
        lyon: scm("france"),
        marseille: scm("france", {units: {france: {regular: 1}}}),
        bordeaux: {units: {france: {regular: 1}}},
        rennes: hcm("france", {religion: "protestant"}),
        nantes: hcm("france", {religion: "protestant"}),
        amboise: hcm("france", {religion: "protestant"}),
        poitiers: hcm("france", {religion: "protestant"}),
        limoges: hcm("france", {religion: "protestant"}),
        montpellier: hcm("france", {religion: "protestant"}),
        avignon: hcm("france", {religion: "protestant"}),

        // Holy Roman Empire
        vienna: scm("hre", {
            leaders: ["schwendi"],
            units: {hre: {regular: 2, merc: 2}},
            notes: "Holy Roman Capital",
        }),
        prague: scm("hre", {units: {hre: {regular: 1}}}),
        augsburg: scm("hre", {units: {hre: {regular: 1}}, religion: "protestant"}),
        frankfurt: scm("hre", {units: {hre: {regular: 1}}, religion: "protestant"}),

        // Protestant - Huguenot and Dutch
        laRochelle: scm("protestant", {
            leaders: ["coligny"],
            units: {protestant: {regular: 1, merc: 2}},
            religion: "protestant",
            notes: "Huguenot Capital",
        }),
        cognac: hcm("protestant", {religion: "protestant"}),
        toulouse: hcm("protestant", {units: {protestant: {regular: 1}}, fortress: true, religion: "protestant"}),
        bayonne: hcm("protestant", {units: {protestant: {regular: 1}}, religion: "protestant"}),
        edinburgh: scm("protestant", {units: {scotland: {regular: 2}}, religion: "protestant"}),
        perth: hcm("protestant", {religion: "protestant"}),
        stirling: hcm("protestant", {religion: "protestant"}),
        glasgow: hcm("protestant"),

        // Minor powers
        lisbon: {units: {portugal: {regular: 1}}, naval: {portugal: {galleon: 1}}},
        florence: {units: {independent: {regular: 1}}},
    },
    worldSpaces: {
        florida: hcm("spain"),
    },
    powerCard: {
        ottoman: {
            scmOnCard: 3,
            suezAttempts: 0,
            ruler: "selimII",
            seaCaptains: ["muratReis"],
            bonusVpNotes: ["+1 VP Artist (Elegy for Suleiman, by Baki)"],
        },
        spain: {
            scmOnCard: 2,
            worldMapFortresses: 1,
            jesuits: 1,
            treasureFleetEscorts: 1,
            treasures: 2,
        },
        england: {
            scmOnCard: 3,
            seaCaptains: ["hawkins", "drake"],
            treasures: 1,
            bonusVpNotes: ["Two +1 VP Virgin Queen", "+1 VP Piracy"],
        },
        france: {
            scmOnCard: 4,
            seaCaptains: ["leTestu"],
            sharedSeaCaptains: ["deSores"],
            valoisMarriage: "Elisabeth de Valois",
            bonusVpNotes: ["Paris VP Turn 1", "Paris VP Turn 2"],
            outOfGame: ["montmorency", "villegaignon", "leClerc"],
        },
        hre: {
            scmOnCard: 4,
            mercenariesForHire: 4,
            seaCaptains: ["henszlein"],
            outOfGame: ["zrinyi"],
        },
        protestant: {
            seaCaptains: ["laudonniere"],
            sharedSeaCaptains: ["deSores"],
            components: {
                dutch: {
                    scmOnCard: 3,
                    leadersOffMap: ["orange"],
                    bonusVpNotes: [
                        "+2 VP Painter (Fight between Carnival and Lent, by Brueghel)",
                    ],
                },
                huguenot: {scmOnCard: 3, treasures: 1},
            },
        },
    },
    royals: TOURNAMENT_ROYALS,
    royalStatus: TOURNAMENT_ROYAL_STATUS,
    patronage: {
        artists: [...TOURNAMENT_PATRONAGE.artists],
        scientists: [...TOURNAMENT_PATRONAGE.scientists],
        vpMarkers: 17,
        artistVpMarkers: 11,
        scientistVpMarkers: 6,
        scienceBonuses: [...allScienceBonusIds],
        vpAwards: [...TOURNAMENT_VP_AWARDS],
        unavailableVpAwards: [...TOURNAMENT_UNAVAILABLE_VP_AWARDS],
    },
    cardsInPlay: tournamentCards(),
    cardsRemoved: [4, 11, 37, 58],
    cardsOnBoard: [28],
    phaseOrder: [...phaseOrder],
    notes: [
        "Six-player Tournament setup; turns 3-6 (1570-1593).",
        "Remove #11 Dragut Falls and #58 Jeanne of Navarre as events already resolved on Turns 1-2.",
        "#4 German Intervention and #37 The Sublime Porte are also removed in the 6-player game.",
        "Morisco Revolt (#28) is already on the board.",
        "Spain and the Papacy are allied; Spain and Venice are allied; Ottoman-Spain and France-Protestant are at war.",
        "Neither starting war may be ended during Turn 3 negotiations.",
        "Mary Queen of Scots is captured; Walsingham is unused; William of Orange is held off-map.",
        "Protestant Spaces card starts at 30.",
        "VP track: HRE 8, French 10, Protestants 10, English 11, Ottoman 14, Spanish 15.",
    ],
    notesZh: [
        "六人锦标赛设置；第 3-6 回合（1570-1593）。",
        "移除 #11 德拉古特之陨与 #58 纳瓦拉的珍妮，作为第 1-2 回合已结算的事件。",
        "六人局同样移除 #4 德意志的介入与 #37 崇高的门。",
        "摩尔人起义（#28）已在场上。",
        "西班牙与教宗国、西班牙与威尼斯结盟；奥斯曼-西班牙、法国-新教处于战争。",
        "第 3 回合谈判中不得结束初始战争。",
        "苏格兰女王玛丽被俘；沃尔辛厄姆未使用；奥兰治的威廉在场外。",
        "新教地区标记从 30 开始。",
        "VP 轨道：神圣罗马帝国 8、法国 10、新教 10、英格兰 11、奥斯曼帝国 14、西班牙 15。",
    ],
};

export const TUTORIAL: ScenarioSetup = {
    ...CAMPAIGN,
    id: "tutorial",
    nameZh: "勒班陀海战",
    nameEn: "The Battle of Lepanto",
    endTurn: 3,
    endYear: 1575,
    vpStart: {ottoman: 13, spain: 0, england: 0, france: 0, hre: 0, protestant: 0},
    protestantSpaces: 18,
    wars: [["ottoman", "spain"]],
    alliances: [["spain", "papacy"]],
    influence: {ottoman: {papacy: 0, venice: 2}, spain: {papacy: 1, venice: 0}},
    spaces: Object.fromEntries(Object.entries(CAMPAIGN.spaces).filter(([id]) => tutorialSpaceAllowed(id))),
    powerCard: {ottoman: {scmOnCard: 4, ruler: "suleiman"}, spain: {scmOnCard: 6}, england: {}, france: {}, hre: {}, protestant: {}},
    royals: [],
    royalStatus: {},
    patronage: {artists: [], scientists: [], vpMarkers: 0, artistVpMarkers: 0, scientistVpMarkers: 0, scienceBonuses: [], vpAwards: []},
    cardsInPlay: Array.from({length: 31}, (_, index) => index + 1),
    cardsRemoved: Array.from({length: 81}, (_, index) => index + 32),
    cardsOnBoard: [],
    phaseOrder: ["cardDraw", "spring", "action"],
    notes: ["Scenario Book pp. 4–5: Ottoman vs Spain, turns 1–3; HRE has no independent hand."],
    notesZh: ["剧本第 4–5 页：奥斯曼对西班牙，第 1–3 回合；神圣罗马帝国不单独持有手牌。"],
};

export const SCENARIOS: Record<ScenarioSetup["id"], ScenarioSetup> = {
    campaign: CAMPAIGN,
    tournament: TOURNAMENT,
    tutorial: TUTORIAL,
};

export const scenarioById = (id: ScenarioSetup["id"]): ScenarioSetup => SCENARIOS[id];

export const ALL_SCENARIOS = [CAMPAIGN, TOURNAMENT];

/** Sanity helper shared by tests: every scenario card list partitions 1..112. */
export const allCardNumbers = ALL_CARD_NUMBERS;
