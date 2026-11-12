import fs from "fs";
import path from "path";
import {CARD_BY_ID} from "../engine/deck";
import {SPACES} from "../constant/spaces";
import {POWER_DEFS} from "../constant/powers";
import {ieStringsFor} from "./i18n";
import {LOG_TEXT_KEYS, LogLocale, LogTextEntry, logText} from "./logText";

const LOCALES: LogLocale[] = ["en", "zh_CN"];
const CARD_ID = Object.keys(CARD_BY_ID)[0];
const CARD = CARD_BY_ID[CARD_ID];

/**
 * One realistic entry per engine log key.  Keeping this table local means a
 * new key either gets a sample here or the key-coverage test fails.
 */
const SAMPLES: Record<string, LogTextEntry> = {
  campaignStarted: {key: "campaignStarted", args: {}},
  seatOrder: {key: "seatOrder", args: {order: "GE, UK, FR, AU, RU, OT"}},
  deckPrepared: {key: "deckPrepared", args: {decade: "1850s", entering: 5, deck: 42}},
  deckReshuffled: {key: "deckReshuffled", args: {deck: 30}},
  cardsDrawn: {key: "cardsDrawn", power: "GE", args: {count: 2}},
  cardRemoved: {key: "cardRemoved", power: "GE", args: {card: CARD_ID}},
  discard: {key: "discard", power: "GE", args: {card: CARD_ID}},
  endOfTurnDiscard: {key: "endOfTurnDiscard", power: "GE", args: {card: CARD_ID}},
  gwOutbreakDiscard: {key: "gwOutbreakDiscard", power: "GE", args: {card: CARD_ID}},
  polishRevolt: {key: "polishRevolt", power: "RU", args: {card: CARD_ID}},
  nationalism: {key: "nationalism", power: "AU", args: {card: CARD_ID}},
  nationalistUprising: {key: "nationalistUprising", power: "OT", args: {card: CARD_ID}},
  economicPanic: {key: "economicPanic", power: "FR", args: {card: CARD_ID}},
  worldsFair: {key: "worldsFair", power: "UK", args: {card: CARD_ID}},
  revolution1905: {key: "revolution1905", power: "RU", args: {card: CARD_ID}},
  eventDiscard: {key: "eventDiscard", power: "GE", args: {card: CARD_ID}},
  prepStabilityDiscard: {key: "prepStabilityDiscard", power: "GE", args: {card: CARD_ID}},
  atAnyCostDiscard: {key: "atAnyCostDiscard", power: "GE", args: {card: CARD_ID}},
  cardPlayed: {key: "cardPlayed", power: "GE", args: {card: CARD_ID, mode: "cp"}},
  passed: {key: "passed", power: "GE", args: {}},
  warDeclared: {key: "warDeclared", power: "GE", args: {target: "FR", aim: "conquest", objectives: "paris,berlin"}},
  combatCardPlayed: {key: "combatCardPlayed", power: "GE", args: {card: CARD_ID, space: "paris"}},
  battleRoll: {
    key: "battleRoll",
    power: "GE",
    args: {from: "berlin", to: "paris", attackerRoll: 5, defenderRoll: 3, differential: 2, attackerLosses: 1, defenderLosses: 2, winner: "attacker"},
  },
  battleEnded: {key: "battleEnded", power: "GE", args: {to: "paris", winner: "attacker", decisive: true}},
  decisiveFollowUpBattle: {key: "decisiveFollowUpBattle", power: "GE", args: {from: "paris", to: "orleans"}},
  decisiveFollowUpMove: {key: "decisiveFollowUpMove", power: "GE", args: {from: "paris", to: "orleans"}},
  decisiveFollowUpFailed: {key: "decisiveFollowUpFailed", power: "GE", args: {space: "paris"}},
  battleReroll: {
    key: "battleReroll",
    power: "GE",
    args: {side: "attacker", attackerRoll: 6, defenderRoll: 3, differential: 3, attackerLosses: 0, defenderLosses: 2},
  },
  supportDenied: {key: "supportDenied", power: "GE", args: {space: "bavaria", battle: "paris"}},
  noLegalTarget: {key: "noLegalTarget", power: "GE", args: {card: CARD_ID}},
  allianceResolution: {key: "allianceResolution", power: "GE", args: {te: 12, ta: 7, steps: 2}},
  allianceShifted: {
    key: "allianceShifted",
    power: "FR",
    args: {from: "neutral", to: "teAligned", steps: 1, attacker: "GE", forced: false},
  },
  allianceShiftChoice: {
    key: "allianceShiftChoice",
    power: "FR",
    args: {attacker: "GE", from: "neutral"},
  },
  woiIndependence: {key: "woiIndependence", args: {space: "serbia", minor: "Serbia", power: "OT", stability: -1}},
  militarism: {key: "militarism", power: "FR", args: {choice: "fort", space: "champagne", level: 2}},
  manpowerExcess: {key: "manpowerExcess", power: "GE", args: {space: "berlin", kind: "army"}},
  nonPlayerBuild: {key: "nonPlayerBuild", args: {minor: "Serbia", space: "serbia", kind: "minorArmy", promoted: false}},
  nonPlayerCounterExhausted: {key: "nonPlayerCounterExhausted", args: {owner: "Serbia", kind: "minorArmy", pool: "army", space: "serbia"}},
  meiji: {key: "meiji", power: "GE", args: {}},
  looseGrip: {key: "looseGrip", power: "UK", args: {space: "egypt"}},
  looseGripRemoved: {key: "looseGripRemoved", power: "UK", args: {}},
  navalTransport: {key: "navalTransport", power: "UK", args: {from: "london", to: "brittany", unit: "u1", naval: "u2,u3", count: 3, path: "london,north-atlantic,brittany"}},
  gwTurnZero: {key: "gwTurnZero", power: "GE", args: {card: "IE-GW-10"}},
  gwExhaustionActivated: {key: "gwExhaustionActivated", power: "GE", args: {mode: "stability"}},
  minorAllianceRemoved: {key: "minorAllianceRemoved", power: "AU", args: {space: "saxony"}},
  unhandledSpecial: {key: "unhandledSpecial", power: "GE", args: {handler: "mystery", card: CARD_ID}},
  italyOttomanWar: {key: "italyOttomanWar", power: "FR", args: {}},
  italyLostDream: {key: "italyLostDream", power: "FR", args: {}},
  italyUnified: {key: "italyUnified", power: "FR", args: {}},
  greatWarOutbreak: {key: "greatWarOutbreak", args: {incident: CARD_ID, te: "GE,AU", ta: "FR,UK,RU", neutrals: "OT"}},
  crisisRoll: {key: "crisisRoll", power: "GE", args: {roll: 3, inciting: CARD_ID}},
  internationalConference: {key: "internationalConference", power: "GE", args: {}},
  gwPlanning: {key: "gwPlanning", args: {turn: 2}},
  gwManeuver: {key: "gwManeuver", args: {turn: 2}},
  gwImpulse: {key: "gwImpulse", power: "GE", args: {kind: "power", index: 1, slot: "GE", bonus: false}},
  gwCpTransfer: {key: "gwCpTransfer", power: "GE", args: {to: "AU", amount: 2}},
  gwCombatCardFaceup: {key: "gwCombatCardFaceup", power: "GE", args: {card: CARD_ID}},
  gwCombatCardFlipped: {key: "gwCombatCardFlipped", power: "GE", args: {card: CARD_ID}},
  deployedReserves: {key: "deployedReserves", power: "GE", args: {space: "berlin", count: 2, free: false}},
  gwManeuverAction: {
    key: "gwManeuverAction",
    power: "GE",
    args: {kind: "landBattle", from: "berlin", to: "paris", unitIds: ["u1"], cost: 1},
  },
  gwUsNorthAmericaBlocked: {
    key: "gwUsNorthAmericaBlocked",
    power: "FR",
    args: {unitIds: "u1", to: "berlin", required: "mexico,canada", unoccupied: "mexico"},
  },
  gwFreeMarch: {key: "gwFreeMarch", power: "FR", args: {from: "paris", to: "silesia", control: "GE"}},
  gwNeutralEntry: {key: "gwNeutralEntry", power: "OT", args: {side: "te"}},
  gwNeutralEntryBlocked: {key: "gwNeutralEntryBlocked", power: "OT", args: {side: "te"}},
  gwNeutralStayOut: {key: "gwNeutralStayOut", power: "OT", args: {}},
  gwNeutralBonusCp: {key: "gwNeutralBonusCp", power: "OT", args: {target: "GE"}},
  gwNeutralRedeploy: {key: "gwNeutralRedeploy", power: "OT", args: {unit: "u1", from: "istanbul", to: "izmir"}},
  gwNeutralDeploy: {key: "gwNeutralDeploy", power: "OT", args: {space: "istanbul", units: "u1,u2"}},
  gwBonusImpulse: {key: "gwBonusImpulse", args: {side: "ta", te: 3, ta: 2}},
  gwBonusImpulseRemoved: {key: "gwBonusImpulseRemoved", args: {te: 2, ta: 2}},
  gwBlockade: {key: "gwBlockade", power: "GE", args: {maxIndustry: 5, industry: 5, reduced: true}},
  gwColonialLoss: {key: "gwColonialLoss", power: "GE", args: {region: "africa", unit: "u1", kind: "army", space: "south-africa", eliminated: false}},
  gwColonialTransfer: {key: "gwColonialTransfer", power: "GE", args: {region: "africa", space: "nigeria", from: ""}},
  gwColonialStability: {key: "gwColonialStability", power: "UK", args: {delta: -1, reason: "lost the africa colonial war"}},
  gwColonialBonusCp: {key: "gwColonialBonusCp", args: {side: "te", pool: 3, regions: "africa,asia", recipients: "UK,FR", lost: false}},
  gwAllyEntry: {key: "gwAllyEntry", args: {ally: "IT", side: "ta"}},
  gwKeyLost: {key: "gwKeyLost", power: "RU", args: {space: "st-petersburg", by: "GE", stability: -1}},
  gwKeyRecaptured: {key: "gwKeyRecaptured", power: "RU", args: {space: "st-petersburg"}},
  gwMajorStability: {key: "gwMajorStability", args: {major: "US", delta: -1, stability: 2, cause: "northAtlantic", space: "north-atlantic"}},
  gwMajorSurrender: {key: "gwMajorSurrender", args: {major: "IT", side: "te", reason: "stability", removed: 4}},
  gwItalyCapitalTaken: {key: "gwItalyCapitalTaken", args: {space: "rome", by: "AU"}},
  gwMajorEntry: {key: "gwMajorEntry", power: "FR", args: {major: "US", side: "te", box: "teAligned", entered: false}},
  gwItalyOutbreak: {key: "gwItalyOutbreak", args: {outcome: "alignedWithdrew", box: "taAligned", side: null, roll: 2, incident: CARD_ID}},
  gwItalyPresence: {key: "gwItalyPresence", args: {spaces: "piedmont,tuscany", reserve: 2}},
  gwMajorEntryNone: {key: "gwMajorEntryNone", power: "FR", args: {drew: true}},
  imperialGermanyManpower: {key: "imperialGermanyManpower", power: "GE", args: {}},
  colonialWar: {key: "colonialWar", args: {region: "africa", teRoll: 7, taRoll: 5, winner: "te"}},
  greatWarEnded: {key: "greatWarEnded", args: {victor: "te", winners: "GE,AU"}},
  auUnstable: {key: "auUnstable", power: "AU", args: {roll: 2, rights: 1}},
  frThirdRepublic: {key: "frThirdRepublic", power: "FR", args: {}},
  powerEliminated: {key: "powerEliminated", power: "OT", args: {}},
  allyMarkerReassigned: {key: "allyMarkerReassigned", power: "GE", args: {space: "tuscany", from: "AU", to: "GE", side: "ta"}},
  minorUnitsDisbanded: {key: "minorUnitsDisbanded", power: "GE", args: {minor: "Tuscany", leaving: "GE", displaced: 1, eliminated: 0, units: "u1"}},
  warAllyKnockout: {key: "warAllyKnockout", power: "GE", args: {power: "RU", by: "attacker", capital: "st-petersburg"}},
  wttMax: {key: "wttMax", args: {incitingCard: CARD_ID}},
  germanUnification: {key: "germanUnification", power: "GE", args: {}},
  italianUnification: {key: "italianUnification", args: {}},
  superiorStaffWork: {key: "superiorStaffWork", power: "GE", args: {space: "berlin", count: 1, scope: "war"}},
  superiorStaffWorkDeclined: {key: "superiorStaffWorkDeclined", power: "GE", args: {scope: "gw"}},
  germanConfederation: {key: "germanConfederation", power: "GE", args: {minor: "Bavaria", space: "bavaria"}},
  germanConfederationDeclined: {key: "germanConfederationDeclined", power: "GE", args: {}},
  bloodAndIron: {key: "bloodAndIron", power: "GE", args: {goal: "NG-08"}},
  napoleonsLegacyRevealed: {key: "napoleonsLegacyRevealed", power: "FR", args: {discount: 2}},
  gameOver: {key: "gameOver", args: {winners: "GE,AU", reason: "autoVictory:GE"}},
  diplomacyStarted: {key: "diplomacyStarted", args: {}},
  homeCardChosen: {key: "homeCardChosen", power: "GE", args: {card: CARD_ID}},
  metternichAlliance: {key: "metternichAlliance", power: "AU", args: {space: "saxony"}},
  actionPhaseStarted: {key: "actionPhaseStarted", args: {}},
  cardGiven: {key: "cardGiven", power: "GE", args: {card: CARD_ID, target: "FR"}},
  recruited: {key: "recruited", power: "GE", args: {kind: "army", space: "berlin"}},
  fleetBuilt: {key: "fleetBuilt", power: "UK", args: {space: "london", kind: "squadron"}},
  navalMove: {key: "navalMove", power: "UK", args: {from: "north-atlantic", to: "western-mediterranean", count: 2}},
  navalReturnToPort: {key: "navalReturnToPort", power: "UK", args: {from: "north-atlantic", to: "london", count: 1, eliminated: false}},
  expeditionary: {key: "expeditionary", power: "FR", args: {space: "paris"}},
  influencePlaced: {key: "influencePlaced", power: "FR", args: {space: "paris"}},
  diplomacyPlaced: {key: "diplomacyPlaced", power: "FR", args: {space: "paris"}},
  minorAlliance: {key: "minorAlliance", power: "FR", args: {space: "saxony"}},
  pacified: {key: "pacified", power: "FR", args: {space: "paris", roll: 4}},
  pacificationFailed: {key: "pacificationFailed", power: "FR", args: {space: "paris", roll: 2}},
  fortBuilt: {key: "fortBuilt", power: "FR", args: {space: "paris", level: 2}},
  indianFortPlaced: {key: "indianFortPlaced", args: {space: "india", level: 1}},
  indianArmyDisplaced: {key: "indianArmyDisplaced", power: "UK", args: {unit: "u1", from: "london", to: "bengal", reason: "endOfTurn"}},
  indiaIndependence: {key: "indiaIndependence", power: "UK", args: {displaced: 3, eliminated: 1, armiesKept: 1, armiesEliminated: 2, fortRemoved: true}},
  indiaMarkerRejected: {key: "indiaMarkerRejected", power: "GE", args: {space: "india", marker: "control"}},
  rapidDeployment: {key: "rapidDeployment", power: "UK", args: {from: "north-atlantic", to: "western-mediterranean", count: 2, scope: "limited"}},
  joinYourCountrysArmy: {key: "joinYourCountrysArmy", power: "UK", args: {armies: 2}},
  joinYourCountrysArmyLimited: {key: "joinYourCountrysArmyLimited", power: "UK", args: {gained: 3, placeable: 1}},
  industrializeCard: {key: "industrializeCard", power: "GE", args: {card: CARD_ID}},
  cpChained: {key: "cpChained", power: "GE", args: {card: CARD_ID}},
  minorJoinedWar: {key: "minorJoinedWar", power: "GE", args: {minor: "Saxony", side: "attacker"}},
  minorAllyAsked: {key: "minorAllyAsked", power: "GE", args: {minor: "Belgium", power: "FR", step: 0, diplomacy: false}},
  minorAidRoll: {key: "minorAidRoll", power: "GE", args: {minor: "Belgium", order: "UK,GE", rolls: "UK:5,GE:2"}},
  minorAidGranted: {key: "minorAidGranted", power: "GE", args: {minor: "Belgium", ally: "FR", space: "belgium"}},
  minorAbandoned: {key: "minorAbandoned", power: "FR", args: {minor: "Italy", stability: -1, from: "neutral", to: "teAligned", italyInfluence: 10}},
  italyMpitGained: {key: "italyMpitGained", args: {major: "IT", track: "neutral", amount: 10, total: 10, reason: "abandoned"}},
  italyAllianceResolution: {key: "italyAllianceResolution", args: {major: "IT", te: 3, ta: 12, neutral: 4, direction: "ta", steps: 1, blocked: false, from: "neutral", to: "taAligned"}},
  minorUnopposed: {key: "minorUnopposed", power: "GE", args: {target: "Belgium"}},
  warVictory: {key: "warVictory", power: "GE", args: {kind: "major", primary: "major", victor: "attacker", treaties: 2}},
  treatyApplied: {key: "treatyApplied", power: "GE", args: {option: "territorialCession", target: "FR", spaces: "paris", minor: ""}},
  warEnded: {key: "warEnded", power: "GE", args: {victor: "attacker", truceTurns: 1, reserves: 3}},
  warSettlementIssues: {
    key: "warSettlementIssues",
    args: {issues: "too-many-treaties:2>1,treaty-not-applied:colonialCession"},
  },
  allyJoinedWar: {key: "allyJoinedWar", power: "GE", args: {ally: "AU"}},
  responsePlayed: {key: "responsePlayed", power: "GE", args: {card: CARD_ID}},
  saveCard: {key: "saveCard", power: "GE", args: {card: CARD_ID, saved: true}},
  mpitPlaced: {key: "mpitPlaced", power: "GE", args: {target: "FR", track: "te"}},
  warManeuverStarted: {key: "warManeuverStarted", power: "GE", args: {}},
  recruitRejected: {key: "recruitRejected", power: "UK", args: {kind: "reserveArmy", space: "london", reasons: "UK may not build reserve armies"}},
  industrializeRejected: {key: "industrializeRejected", power: "OT", args: {card: CARD_ID, reasons: "Ottoman own card cannot be used for industrialization"}},
  eventNotPlayable: {key: "eventNotPlayable", power: "GE", args: {card: CARD_ID, reason: "egypt-minor"}},
  auActionRejected: {key: "auActionRejected", power: "AU", args: {action: "reforms", reasons: "Germans is not one of the eight AU nationalities"}},
  auRightsGranted: {key: "auRightsGranted", power: "AU", args: {nationality: "Czechs"}},
  auCitizenshipRoll: {key: "auCitizenshipRoll", power: "AU", args: {nationality: "Hungarians", roll: 4, needed: 3, success: true, stabilitySpent: false}},
  auIncorporated: {key: "auIncorporated", power: "AU", args: {space: "tuscany", minor: "Tuscany", nationality: "Italians"}},
  auUnstableDiscard: {key: "auUnstableDiscard", power: "AU", args: {card: CARD_ID}},
  dualMonarchyAdded: {key: "dualMonarchyAdded", power: "AU", args: {card: "IE-A047"}},
  thirdRepublicCp: {key: "thirdRepublicCp", power: "FR", args: {cp: 2}},
  zouaveRebuilt: {key: "zouaveRebuilt", power: "FR", args: {space: "algeria", free: true}},
  zouaveRebuildRejected: {key: "zouaveRebuildRejected", power: "FR", args: {reasons: "The Zouaves are already in play"}},
  tsrrRail: {key: "tsrrRail", power: "RU", args: {unitId: "u1", from: "moscow", to: "urals"}},
  tsrrRailRejected: {key: "tsrrRailRejected", power: "RU", args: {unitId: "u1", to: "riga", reasons: "The Trans-Siberian Railroad is not complete"}},
  jihadMarkersGained: {key: "jihadMarkersGained", power: "OT", args: {markers: 3, total: 3}},
  jihadRejected: {key: "jihadRejected", power: "OT", args: {reasons: "No Jihad marker is available for this battle"}},
  jihadUsed: {key: "jihadUsed", power: "OT", args: {space: "istanbul", opponent: "RU", markers: 2}},
  jihadDiscarded: {key: "jihadDiscarded", power: "OT", args: {markers: 2}},
  secondRome: {key: "secondRome", power: "RU", args: {space: "istanbul"}},
  secondRomeVp: {key: "secondRomeVp", power: "RU", args: {vp: 2}},
  allyCalledToWar: {key: "allyCalledToWar", power: "GE", args: {ally: "AU", side: "attacker"}},
  balanceOfPower: {
    key: "balanceOfPower",
    power: "UK",
    args: {result: "accepted", defender: "OT", navalBase: "rhodes"},
  },
  allyRefusedWar: {key: "allyRefusedWar", power: "AU", args: {caller: "GE", side: "attacker", stability: -1, neutralInfluence: 10, exemptForTruce: false}},
  demobilizationFreeAction: {key: "demobilizationFreeAction", power: "GE", args: {action: "redeploy", units: "u1", from: "paris", to: "orleans"}},
  demobilizationFreeActionSkipped: {key: "demobilizationFreeActionSkipped", power: "FR", args: {reason: "no-legal-action"}},
  demobilizationFreeActionsFinished: {key: "demobilizationFreeActionsFinished", args: {reason: "completed"}},
  dardanellesPassageRequested: {key: "dardanellesPassageRequested", power: "RU", args: {from: "black-sea", to: "eastern-mediterranean", controller: "OT"}},
  dardanellesPassage: {key: "dardanellesPassage", power: "OT", args: {requesting: "RU", from: "black-sea", to: "eastern-mediterranean", granted: true}},
  brokenLocDisplaced: {key: "brokenLocDisplaced", power: "RU", args: {unit: "u1", from: "warsaw", to: "moscow", kind: "army"}},
  unitDisplaced: {key: "unitDisplaced", power: "GE", args: {unit: "u1", owner: "GE", from: "paris", to: "berlin", kind: "land", eliminated: false}},
  polishIndependence: {key: "polishIndependence", args: {spaces: 1, reserves: 2}},
  deployedPolishReserve: {key: "deployedPolishReserve", power: "GE", args: {space: "warsaw", unit: "u9"}},
  polishReserveReturned: {key: "polishReserveReturned", power: "GE", args: {count: 1}},
  polishRecruited: {key: "polishRecruited", power: "GE", args: {kind: "army", space: "poland", unit: "u21", steps: 2, cost: 2, upgrade: false}},
  polishRecruitRejected: {key: "polishRecruitRejected", power: "GE", args: {kind: "army", space: "poland", reasons: "Polish armies already equal the 22.5 limit (2)"}},
  impulseUpkeepLoss: {key: "impulseUpkeepLoss", power: "GE", args: {space: "paris", cause: "brokenLoc", unit: "u1", kind: "army"}},
  amphibiousAssault: {key: "amphibiousAssault", power: "UK", args: {from: "western-mediterranean", to: "naples", units: "u1,u2"}},
  amphibiousLanding: {key: "amphibiousLanding", power: "UK", args: {from: "western-mediterranean", to: "naples", units: "u1,u2"}},
  amphibiousNavalBattle: {key: "amphibiousNavalBattle", power: "UK", args: {from: "western-mediterranean", to: "naples", armies: "u1,u2"}},
  navalInterception: {key: "navalInterception", power: "FR", args: {roll: 4, drm: 1, total: 5, success: true, port: "toulon", box: "western-mediterranean", ships: "u3"}},
  navalAvoidance: {key: "navalAvoidance", power: "FR", args: {roll: 4, drm: 1, total: 5, success: true, space: "western-mediterranean", to: "toulon", ports: "toulon"}},
  navalPortBoxChoice: {key: "navalPortBoxChoice", power: "UK", args: {port: "gibraltar", box: "western-mediterranean"}},
  navalContinuation: {key: "navalContinuation", power: "GE", args: {from: "baltic-sea", to: "pomerania", units: 2}},
  navalPortContinuation: {key: "navalPortContinuation", power: "GE", args: {from: "north-atlantic", to: "london", units: 2}},
  mineRetreat: {key: "mineRetreat", power: "GE", args: {from: "north-atlantic", space: "brittany", hits: 2, ignored: 2}},
  combatRetreat: {key: "combatRetreat", power: "GE", args: {space: "saxony", to: "berlin"}},
  trenchesPlaced: {key: "trenchesPlaced", args: {turn: 1, count: 24}},
  trenchBattle: {key: "trenchBattle", power: "GE", args: {space: "verdun", status: "attackerAdvantage", turn: 2}},
  trenchBattleLifted: {key: "trenchBattleLifted", power: "FR", args: {space: "verdun"}},
  empireOfTheSun: {key: "empireOfTheSun", power: "FR", args: {card: CARD_ID}},
  auctionCardsRevealed: {key: "auctionCardsRevealed", args: {auction: "urabi", cards: `${CARD_ID},${Object.keys(CARD_BY_ID)[1]}`}},
};

const sourceFiles = (): string[] => {
  const root = path.resolve(__dirname, "..");
  const engine = path.join(root, "engine");
  const files = fs.readdirSync(engine)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => path.join(engine, name));
  return [...files, path.join(root, "moves.ts")];
};

/** Extract every key the engine can actually put into `G.log`. */
const engineLogKeys = (): string[] => {
  const keys = new Set<string>(["discard"]);
  for (const file of sourceFiles()) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(/\b(?:log|addLog)\(G,\s*[^,\n]+,\s*"([A-Za-z][A-Za-z0-9]*)"/g)) keys.add(match[1]);
    // `discardCard` passes its reason in the key slot.
    for (const match of source.matchAll(/discardCard\([^;\n]*?,\s*"([A-Za-z][A-Za-z0-9]*)"\s*\)/g)) keys.add(match[1]);
    for (const match of source.matchAll(/G\.log\.push\([^;\n]*?\bkey:\s*"([A-Za-z][A-Za-z0-9]*)"/g)) keys.add(match[1]);
  }
  return [...keys].sort();
};

const dictionaryShape = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(dictionaryShape);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, dictionaryShape((value as Record<string, unknown>)[key])]),
    );
  }
  return typeof value;
};

describe("Imperial Elegy engine log localization", () => {
  it("inventories every key used by the engine", () => {
    expect([...LOG_TEXT_KEYS].sort()).toEqual(engineLogKeys());
    expect(Object.keys(SAMPLES).sort()).toEqual([...LOG_TEXT_KEYS].sort());
  });

  it.each(LOG_TEXT_KEYS.flatMap((key) => LOCALES.map((locale) => [key, locale] as const)))(
    "%s renders in %s without raw JSON",
    (key, locale) => {
      const rendered = logText(SAMPLES[key], locale);
      expect(rendered.length).toBeGreaterThan(0);
      expect(rendered).not.toBe(key);
      expect(rendered).not.toMatch(/[{}]/);
      expect(rendered).not.toContain("[object Object]");
      expect(rendered).not.toContain("undefined");
      expect(rendered).not.toContain("null");
    },
  );

  it("has a distinct English and Chinese sentence for every key", () => {
    for (const key of LOG_TEXT_KEYS) {
      expect(logText(SAMPLES[key], "en")).not.toBe(logText(SAMPLES[key], "zh_CN"));
    }
  });

  it("renders card, space and power arguments through the shared data", () => {
    const played = {key: "cardPlayed", power: "GE" as const, args: {card: CARD_ID, mode: "event"}};
    expect(logText(played, "en")).toContain(CARD.title);
    expect(logText(played, "zh_CN")).toContain(CARD.titleZh);

    const influence = {key: "influencePlaced", power: "FR" as const, args: {space: "paris"}};
    expect(logText(influence, "en")).toContain(SPACES.paris.name);
    expect(logText(influence, "zh_CN")).toContain(SPACES.paris.nameZh);

    const war = {key: "warDeclared", power: "GE" as const, args: {target: "FR", aim: "conquest", objectives: "paris"}};
    expect(logText(war, "en")).toContain(POWER_DEFS.FR.name);
    expect(logText(war, "zh_CN")).toContain(POWER_DEFS.FR.nameZh);
    expect(logText(war, "zh_CN")).toContain("征服");
  });

  it("renders a lone non-player defender's victory without a player actor", () => {
    // Rule 15.4.2: the attacker's surrender is a defensive result for the
    // non-player defender, which has no player log actor and no treaty options.
    const entry: LogTextEntry = {key: "warVictory", args: {kind: "defensive", victor: "defender", treaties: 0}};
    expect(logText(entry, "en")).toContain("non-player defender");
    expect(logText(entry, "en")).toContain("defensive");
    expect(logText(entry, "zh_CN")).toContain("非玩家防守方");
  });

  it("never exposes a hidden card and keeps save state readable", () => {
    const hidden = {key: "cardRemoved", power: "FR" as const, args: {card: "hidden"}};
    expect(logText(hidden, "en")).toContain("hidden card");
    expect(logText(hidden, "zh_CN")).toContain("隐藏卡牌");
    expect(logText(hidden, "zh_CN")).not.toContain("hidden");

    const saved = {key: "saveCard", power: "GE" as const, args: {card: CARD_ID, saved: true}};
    const unsaved = {key: "saveCard", power: "GE" as const, args: {card: CARD_ID, saved: false}};
    expect(logText(saved, "zh_CN")).toContain("保留");
    expect(logText(unsaved, "zh_CN")).toContain("取消保留");
  });

  it("renders limited-war settlement issues and truce terms", () => {
    const settlement = {
      key: "warSettlementIssues",
      args: {issues: "too-many-treaties:2>1,treaty-not-applied:colonialCession"},
    };
    expect(logText(settlement, "en")).toContain("only 1 allowed");
    expect(logText(settlement, "en")).toContain("colonial cession was not applied");
    expect(logText(settlement, "zh_CN")).toContain("只允许 1 个");
    expect(logText(settlement, "zh_CN")).toContain("殖民地割让未生效");

    const ended = {
      key: "warEnded",
      power: "GE" as const,
      args: {victor: "attacker", truceTurns: 1, reserves: 3},
    };
    expect(logText(ended, "en")).toContain("1-turn truce");
    expect(logText(ended, "en")).toContain("3 reserve units returned");
    expect(logText(ended, "zh_CN")).toContain("停战 1 回合");
    expect(logText(ended, "zh_CN")).toContain("归还 3 个预备军单位");

    const realignment = {
      key: "treatyApplied",
      power: "GE" as const,
      args: {option: "realignment", target: "FR", spaces: "", minor: "German minors"},
    };
    expect(logText(realignment, "zh_CN")).toContain("德意志诸小国");
  });

  it("falls back to a readable label, never raw JSON", () => {
    const rendered = logText({key: "someBrandNewEvent", args: {card: CARD_ID, space: "paris"}}, "en");
    expect(rendered).toBe("Untranslated log entry: Some brand new event");
    expect(rendered).not.toMatch(/[{}]/);
    expect(logText({key: "someBrandNewEvent"}, "zh_CN")).toContain("未翻译的日志");
  });

  it("keeps the en and zh_CN UI dictionaries structurally identical", () => {
    const en = ieStringsFor("en");
    const zh = ieStringsFor("zh_CN");
    expect(dictionaryShape(zh)).toEqual(dictionaryShape(en));
    expect(Object.keys(en.pendingKind).sort()).toEqual(Object.keys(zh.pendingKind).sort());
    expect(Object.values(en.pendingKind).every((value) => value.length > 0)).toBe(true);
    expect(Object.values(zh.pendingKind).every((value) => value.length > 0)).toBe(true);
  });
});
