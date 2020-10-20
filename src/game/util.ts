import {
    AllClassicCards,
    BasicCardID,
    BuildingType,
    CardCategory,
    CardID,
    CardType,
    ClassicCardID,
    EventCardID,
    FilmCardID,
    IBasicCard, IBuildingSlot,
    IBuyInfo,
    ICardSlot,
    ICost,
    IEra,
    INormalOrLegendCard,
    InteractiveEffectNames,
    IPubInfo,
    LegendCardCountInUse,
    NormalCardCountInUse,
    PersonCardID,
    Region,
    SchoolCardID,
    ScoreCardID,
    ShareOnBoard,
    SimpleRuleNumPlayers,
    validRegion,
    ValidRegions,
    VictoryType,
} from "../types/core";
import {IG} from "../types/setup";
import {Ctx, PlayerID} from "boardgame.io";
import {cardsByCond, filmCardsByEra, getCardById, schoolCardsByEra} from "../types/cards";
import {Stage} from "boardgame.io/core";
import {changePlayerStage, changeStage, signalEndStage, signalEndTurn} from "./logFix";
import {getCardEffect} from "../constant/effects";
import {B04} from "../constant/cards/basic";
import {eventCardByEra} from "../constant/cards/event";
import {getScoreCard, getScoreCardByID, scoreCardCount} from "../constant/cards/score";
import i18n from "../constant/i18n";
import {createLogger, format, transports} from "winston";

const {simple} = format;
const {Console} = transports;
export const logger = createLogger({
    format: simple(),
    level: 'debug',
    defaultMeta: "",
    transports: [
        new Console()
    ],
});

export const curPid = (G: IG, ctx: Ctx): number => {
    return parseInt(ctx.currentPlayer);
}

export function activePlayer(ctx: Ctx) {
    if (ctx.activePlayers === null) {
        return ctx.currentPlayer
    } else {
        let players = Object.keys(ctx.activePlayers);
        if (players.length === 1) {
            return players[0];
        }
        players.splice(players.indexOf(ctx.currentPlayer), 1);
        return players[0];
    }
}

export const curPub = (G: IG, ctx: Ctx): IPubInfo => G.pub[curPid(G, ctx)];

export const shuffle = (ctx: Ctx, arg: any[]): any[] => {
    let r = ctx.random;
    if (r === undefined) {
        throw new Error("");
    } else {
        return r.Shuffle(arg);
    }
}

export const actualStage = (G: IG, ctx: Ctx,): string => {
    if (ctx.activePlayers === null) {
        return Stage.NULL;
    } else {
        return ctx.activePlayers[activePlayer(ctx)]
    }
}

export const requireInteraction = (G: IG, eff: any): boolean => {
    switch (eff.e) {
        case "step":
            return eff.e.a.every((e: any): boolean => requireInteraction(G, e));
        default:
            return isSimpleEffect(G, eff);
    }
}

export const isSimpleEffect = (G: IG, eff: any): boolean => {
    let log = `isSimpleEffect|${eff.e}`;
    switch (eff.e) {
        case "alternative":
        case "competition":
        case "loseAnyRegionShare":
        case "anyRegionShare":
        case "noBuildingEE":
        case "vpNotHighestPlayer":
        case "highestVpPlayer":
        case "handToOthers":
        case "industryAndAestheticsBreakthrough":
        case "industryOrAestheticsBreakthrough":
        case "industryOrAestheticsLevelUp":
        case "peek":
        case "everyOtherCompany":
        case "everyPlayer":
        case "noStudio":
        case "studio":
        case "step":
        case "refactor":
        case "archive":
        case "discard":
        case "discardIndustry":
        case "discardLegend":
        case "discardAesthetics":
        case "discardNormalOrLegend":
        case "choice":
        case "update":
        case "comment":
        case "optional":
        case InteractiveEffectNames.archiveToEEBuildingVP:
            log += `|false`
            logger.debug(`${G.matchID}|${log}`);
            return false;
        default:
            log += `|true`
            logger.debug(`${G.matchID}|${log}`);
            return true;
    }
}

function loseShare(G: IG, region: validRegion, obj: IPubInfo, num: number) {
    if (obj.shares[region] >= num) {
        obj.shares[region] -= num;
        G.regions[region].share += num;
    } else {
        G.regions[region].share += obj.shares[region];
        obj.shares[region] = 0;
    }
}

function getShare(G: IG, region: validRegion, obj: IPubInfo, num: number) {
    if (G.regions[region].share >= num) {
        obj.shares[region] += num;
        G.regions[region].share -= num;
    } else {
        obj.shares[region] += G.regions[region].share;
        G.regions[region].share = 0
    }
}

export function payCost(G: IG, ctx: Ctx, p: PlayerID, cost: number): void {
    let obj = G.pub[parseInt(p)];
    let log = `payCost|p${p}|${cost}`
    if (obj.resource + obj.deposit < cost) {
        throw Error(`p${p}|cannotPay|${cost}`)
    }
    if (obj.resource >= cost) {
        log += `|res:${cost}`
        obj.resource -= cost;
    } else {
        log += `|res:${obj.resource}`
        const depCost = cost - obj.resource;
        obj.resource = 0
        log += `|deposit:${depCost}`
        obj.deposit -= depCost
    }
    logger.debug(`${G.matchID}|${log}`);
}

export function simpleEffectExec(G: IG, ctx: Ctx, p: PlayerID): void {
    let eff = G.e.stack.pop();
    let log = `simpleEffectExec|p${p}|${JSON.stringify(eff)}`
    let obj = G.pub[parseInt(p)];
    let card: INormalOrLegendCard;
    switch (eff.e) {
        case "none":
        case "skipBreakthrough":
            return;
        case "shareToVp":
            addVp(G, ctx, p, obj.shares[eff.a as validRegion]);
            return;
        case "loseVpForEachHand":
            loseVp(G, ctx, p, G.player[parseInt(p)].hand.length);
            break;
        case "aestheticsToVp":
            addVp(G, ctx, p, obj.aesthetics);
            break;
        case "industryToVp":
            addVp(G, ctx, p, obj.industry)
            break;
        case "resFromIndustry":
            obj.resource += obj.industry;
            break;
        case "enableBollywood":
            G.regions[Region.ASIA].buildings[1].activated = true;
            break;
        case "enableHollywood":
            G.regions[Region.NA].buildings[2].activated = true;
            break;

        case "loseDeposit":
            loseDeposit(G, ctx, p, eff.a);
            break;
        case "loseVp":
            loseVp(G, ctx, p, eff.a);
            break;

        case "loseShareNA":
            loseShare(G, Region.NA, obj, eff.a);
            break;
        case "shareNA":
            getShare(G, Region.NA, obj, eff.a);
            break;

        case "loseShareWE":
            loseShare(G, Region.WE, obj, eff.a);
            break;
        case "shareWE":
            getShare(G, Region.WE, obj, eff.a);
            break;

        case "loseShareEE":
            loseShare(G, Region.EE, obj, eff.a);
            break;
        case "shareEE":
            getShare(G, Region.EE, obj, eff.a);
            break;

        case "loseShareASIA":
            loseShare(G, Region.ASIA, obj, eff.a);
            break;
        case "shareASIA":
            getShare(G, Region.ASIA, obj, eff.a);
            break;

        case "deposit":
            log += `|${obj.deposit}`
            obj.deposit += eff.a;
            log += `|${obj.deposit}`
            break;
        case "res":
            let i = G.competitionInfo;
            if (i.pending) {
                log += `|pendingCompetition`
                if (p === i.atk) {
                    log += `|atk`
                    i.progress += eff.a;
                    log += `|${i.progress}`
                } else {
                    if (p === i.def) {
                        log += `|def`
                        i.progress -= eff.a;
                        log += `|${i.progress}`
                    } else {
                        log += `|notCompetitionPlayer|${obj.resource}`
                        obj.resource += eff.a;
                        log += `|${obj.resource}`
                    }
                }
            } else {
                log += `|${obj.resource}`
                obj.resource += eff.a;
                log += `|${obj.resource}`
            }
            break;
        case "vp":
        case "addVp":
        case "addExtraVp":
            addVp(G, ctx, p, eff.a);
            break;
        case "draw":
            for (let i = 0; i < eff.a; i++) {
                drawCardForPlayer(G, ctx, p);
            }
            break;
        case "buyCardToHand":
            card = getCardById(eff.a);
            doBuyToHand(G, ctx, card, p);
            break;
        case "aestheticsLevelUp":
            if (obj.aesthetics < 10) {
                log += `|${obj.aesthetics}`
                obj.aesthetics++;
                log += `|${obj.aesthetics}`
            } else {
                log += `|LV10CannotUpgrade`
            }
            break
        case "industryLevelUp":
            if (obj.industry < 10) {
                log += `|${obj.industry}`
                obj.industry++;
                log += `|${obj.industry}`
            } else {
                log += `|LV10CannotUpgrade`
            }
            break;
        case "industryAward":
            for (let i = 0; i < eff.a; i++) {
                industryAward(G, ctx, p);
            }
            break;
        case "aesAward":
            for (let i = 0; i < eff.a; i++) {
                aesAward(G, ctx, p);
            }
            break;
        case "buy":
            doBuy(G, ctx, getCardById(eff.a), p);
            break;
        default:
            logger.error("Invalid effect" + JSON.stringify(eff));
            throw new Error(JSON.stringify(eff));
    }
    logger.debug(`${G.matchID}|${log}`);
}

export const doBuyToHand = (G: IG, ctx: Ctx, card: INormalOrLegendCard | IBasicCard, p: PlayerID): void => {
    let obj = G.player[parseInt(p)];
    let pObj = G.pub[parseInt(p)];
    if (card.category === CardCategory.BASIC) {
        G.basicCards[card.cardId as BasicCardID] -= 1;
    } else {
        let slot = cardSlotOnBoard(G, ctx, card);
        if (slot === null) {
            throw new Error("Cannot buy card off board!");
        } else {
            slot.card = null;
            if (slot.comment !== null) {
                obj.hand.push(slot.comment);
                pObj.allCards.push(slot.comment);
                slot.comment = null;
            }
            doReturnSlotCard(G, ctx, slot);
        }
    }
    obj.hand.push(card.cardId);
    pObj.allCards.push(card.cardId)
}

export const doBuy = (G: IG, ctx: Ctx, card: INormalOrLegendCard | IBasicCard, p: PlayerID): void => {
    let obj = G.pub[parseInt(p)];
    let log = `doBuy|${card.cardId}|p${p}`
    if (card.category === CardCategory.BASIC) {
        let count = G.basicCards[card.cardId as BasicCardID];
        if (count > 0) {
            G.basicCards[card.cardId as BasicCardID] -= 1;
            obj.discard.push(card.cardId);
            obj.allCards.push(card.cardId);
        } else {
            log += `|${card.cardId}depleted|`
        }
    } else {
        let slot: ICardSlot | null;
        if (ctx.numPlayers === SimpleRuleNumPlayers) {
            slot = cardSlotOnBoard2p(G, ctx, card);
        } else {
            slot = cardSlotOnBoard(G, ctx, card);
        }
        if (slot === null) {
            throw new Error("Cannot buy normal or legend card off board!");
        } else {
            slot.card = null;
            if (slot.comment !== null) {
                obj.discard.push(slot.comment);
                obj.allCards.push(slot.comment);
                slot.comment = null;
            }
            let region = card.region;
            if (region !== Region.NONE) {
                let share = 0;
                if (ctx.numPlayers > SimpleRuleNumPlayers) {
                    if (slot.isLegend) {
                        share++;
                    }
                }
                if (card.type === CardType.F) {
                    share++;
                }
                if (G.regions[region].share > share) {
                    G.regions[region].share -= share;
                    obj.shares[region] += share;
                } else {
                    obj.shares[region] += G.regions[region].share;
                    G.regions[region].share = 0;
                }
            }

        }
        if (card.type === CardType.S) {
            let school = obj.school;
            let kino = schoolPlayer(G, ctx, SchoolCardID.S1303);
            if (kino !== null && p !== kino) {
                log += `|p${kino}|KinoEyes`
                addVp(G, ctx, kino, 1);
                G.pub[parseInt(kino)].deposit++;
            }
            if (school !== null) {
                if (school === SchoolCardID.S1203) {
                    if (obj.aesthetics < 10) {
                        log += `|Expressionism`
                        obj.aesthetics++;
                    }
                }
                log += `|archive|${school}`
                obj.archive.push(school);
            }
            obj.school = card.cardId as SchoolCardID;
        } else {
            log += `|pushToDiscard`
            obj.discard.push(card.cardId);
        }
        obj.allCards.push(card.cardId);
    }
    logger.debug(`${G.matchID}|${log}`);
}

export const cardInDeck = (G: IG, ctx: Ctx, p: number, cardId: CardID): boolean => {
    return G.secretInfo.playerDecks[p].filter(c => c === cardId).length > 0;
}
export const cardInHand = (G: IG, ctx: Ctx, p: number, cardId: CardID): boolean => {
    return G.player[p].hand.filter(c => c === cardId).length > 0;
}
export const cardInDiscard = (G: IG, ctx: Ctx, p: number, cardId: CardID): boolean => {
    return G.pub[p].discard.filter(c => c === cardId).length > 0;
}
export const ownCardPlayers = (G: IG, ctx: Ctx, cardId: CardID): PlayerID[] => {
    let p: PlayerID[] = [];
    G.order.forEach((i, idx) => {
            if (cardInHand(G, ctx, idx, cardId) || cardInDeck(G, ctx, idx, cardId) || cardInDiscard(G, ctx, idx, cardId)) {
                p.push(idx.toString());
            }
        }
    );
    return p;
}

export const buildingInRegion = (G: IG, ctx: Ctx, r: Region, p: PlayerID): boolean => {
    return studioInRegion(G, ctx, r, p) || cinemaInRegion(G, ctx, r, p);
}
export const studioInRegion = (G: IG, ctx: Ctx, r: Region, p: PlayerID): boolean => {
    if (r === Region.NONE) return false;
    return G.regions[r].buildings.filter(s => s.building === BuildingType.studio && s.owner === p).length > 0;
}
export const cinemaInRegion = (G: IG, ctx: Ctx, r: Region, p: PlayerID): boolean => {
    if (r === Region.NONE) return false;
    return G.regions[r].buildings.filter(s => s.building === BuildingType.cinema && s.owner === p).length > 0;
}
export const studioPlayers = (G: IG, ctx: Ctx, r: Region): PlayerID[] => {
    if (r === Region.NONE) return [];
    return seqFromCurrentPlayer(G, ctx).filter(pid => studioInRegion(G, ctx, r, pid));
}

export const buildingPlayers = (G: IG, ctx: Ctx, r: Region): PlayerID[] => {
    if (r === Region.NONE) return [];
    return seqFromCurrentPlayer(G, ctx).filter(pid => cinemaInRegion(G, ctx, r, pid) || studioInRegion(G, ctx, r, pid));
}
export const noBuildingPlayers = (G: IG, ctx: Ctx, r: Region): PlayerID[] => {
    let log = `noBuildingPlayers|${r}`
    if (r === Region.NONE) {
        logger.debug(`${G.matchID}|${log}`);
        return [];
    }
    const allPlayers = seqFromCurrentPlayer(G, ctx);
    log += `|all|${JSON.stringify(allPlayers)}`
    const result = allPlayers.filter(pid => {
        const hasBuilding = studioInRegion(G, ctx, r, pid) || cinemaInRegion(G, ctx, r, pid);
        log += `|p${pid}|${hasBuilding}`
        return !hasBuilding
    });
    log += `|result|${result}`
    logger.debug(`${G.matchID}|${log}`);
    return result
}
export const noStudioPlayers = (G: IG, ctx: Ctx, r: Region): PlayerID[] => {
    if (r === Region.NONE) return [];
    let log = `noStudioPlayers|${r}`
    const allPlayers = seqFromCurrentPlayer(G, ctx);
    log += `|all|${JSON.stringify(allPlayers)}`
    const result = allPlayers.filter(pid => {
        const hasStudio = studioInRegion(G, ctx, r, pid)
        log += `|p${pid}|${hasStudio}`
        return !hasStudio
    });
    log += `|result|${result}`
    logger.debug(`${G.matchID}|${log}`);
    return result
}

export const posOfPlayer = (G: IG, ctx: Ctx, p: PlayerID): number => {
    return G.order.indexOf(p);
}

export const checkRegionScoring = (G: IG, ctx: Ctx, r: Region): boolean => {
    if (r === Region.NONE) return false;
    return cardDepleted(G, ctx, r) || shareDepleted(G, ctx, r);
}

export const seqFromPos = (G: IG, ctx: Ctx, pos: number): PlayerID[] => {
    let log = `seqFromPos`;
    let seq = [];
    for (let i = pos; i < ctx.numPlayers; i++) {
        log += `|push|${i}`
        seq.push(G.order[i])
    }
    for (let i = 0; i < pos; i++) {
        log += `|push|${i}`
        seq.push(G.order[i])
    }
    log += `|seq:${JSON.stringify(seq)}`
    logger.debug(`${G.matchID}|${log}`);
    return seq;
}
export const seqFromActivePlayer = (G: IG, ctx: Ctx): PlayerID[] => {
    let log = `seqFromActivePlayer`
    let act = activePlayer(ctx);
    log += `|act|p${act}`
    let pos = posOfPlayer(G, ctx, act);
    let seq = seqFromPos(G, ctx, pos);
    logger.debug(`${G.matchID}|${log}`);
    return seq;
}

export const seqFromCurrentPlayer = (G: IG, ctx: Ctx): PlayerID[] => {
    let log = `seqFromCurrentPlayer`
    log += `|cur|p${ctx.currentPlayer}`
    let pos = posOfPlayer(G, ctx, ctx.currentPlayer);
    let seq = seqFromPos(G, ctx, pos);
    logger.debug(`${G.matchID}|${log}`);
    return seq;
}

export const industryLowestPlayer = (G: IG): PlayerID[] => {
    let log = "industryLowestPlayer"
    let lowest = 10;
    let result: PlayerID[] = [];
    G.order.forEach(i => {
        if (G.pub[parseInt(i)].industry < lowest) lowest = G.pub[parseInt(i)].industry
    })
    log += `|highest|${lowest}`
    G.order.forEach(i => {
        if (G.pub[parseInt(i)].industry <= lowest) {
            log += `|p${i}|${G.pub[parseInt(i)].industry}|lowest`
            result.push(i)
        }
    })
    logger.debug(`${G.matchID}|${log}`);
    return result;
}

export const aesLowestPlayer = (G: IG): PlayerID[] => {
    let log = `aesLowestPlayer`
    let lowestAes = 10;
    let result: PlayerID[] = [];
    G.order.forEach(i => {
        if (G.pub[parseInt(i)].aesthetics < lowestAes) {
            lowestAes = G.pub[parseInt(i)].aesthetics
        }
    })
    log += `|highest|${lowestAes}`
    G.order.forEach(i => {
        if (G.pub[parseInt(i)].aesthetics <= lowestAes) {
            log += `|p${i}|${G.pub[parseInt(i)].aesthetics}|lowest`
            result.push(i)
        }
    })
    logger.debug(`${G.matchID}|${log}`);
    return result;
}

export function vpNotHighestPlayer(G: IG): PlayerID[] {
    let log = `vpNotHighestPlayer`
    let highestVp = 0;
    let result: PlayerID[] = [];
    G.order.forEach(i => {
        const vp = G.pub[parseInt(i)].vp;
        log += `|p${i}|${vp}`
        if (vp > highestVp) {
            highestVp = vp
        }
    })
    log += `|highest:${highestVp}`
    G.order.forEach((i: PlayerID) => {
        if (G.pub[parseInt(i)].vp !== highestVp) {
            log += `|p${i}|notHighest|`
            result.push(i)
        }
    })
    log += `|result|${result}`
    logger.debug(`${G.matchID}|${log}`);
    return result;
}

export function vpHighestPlayer(G: IG): PlayerID[] {
    let log = "vpHighestPlayer"
    let highestVp = 0;
    let result: PlayerID[] = [];
    G.order.forEach((i) => {
        if (G.pub[parseInt(i)].vp > highestVp) {
            highestVp = G.pub[parseInt(i)].vp
        }
    })
    log += `|highestVP|${highestVp}`
    G.order.forEach((i, idx) => {
        if (G.pub[parseInt(i)].vp === highestVp) {
            log += `|p${i}|highest`
            result.push(idx.toString())
        }
    })
    logger.debug(`${G.matchID}|${log}`);
    return result;
}

export const inferDeckRemoveHelper = (result: CardID[], remove: CardID[]): void => {
    remove.forEach(c => {
        const indexOf = result.indexOf(c)
        if (indexOf !== -1) {
            result.splice(indexOf, 1)
        }
    })
}

export const breakthroughEffectPrepare = (G: IG, card: CardID): void => {
    let log = "breakthroughEffectPrepare"
    let c = getCardById(card);
    let i = c.industry
    let a = c.aesthetics
    log += `|${c.cardId}|i${i}|a${a}`
    if (i === 0 && a === 0) {
        log += `|noMarker|return`
        logger.debug(`${G.matchID}|${log}`);
        return;
    }
    if (i > 0 && a > 0) {
        log += `|industryAndAestheticsBreakthrough`
        G.e.stack.push({
            e: "industryAndAestheticsBreakthrough", a: {
                industry: c.industry,
                aesthetics: c.aesthetics,
            }
        })
        logger.debug(`${G.matchID}|${log}`);
    } else {
        if (i === 0) {
            log += `|aestheticsBreakthrough`
            G.e.stack.push({e: "aestheticsBreakthrough", a: c.aesthetics})
            logger.debug(`${G.matchID}|${log}`);
        } else {
            log += `|industryBreakthrough`
            G.e.stack.push({e: "industryBreakthrough", a: c.industry})
            logger.debug(`${G.matchID}|${log}`);
        }
    }
}

export const startBreakThrough = (G: IG, ctx: Ctx, pid: PlayerID, card: CardID): void => {
    let p = curPub(G, ctx);
    let c = getCardById(card)
    let log = `startBreakThrough|p${pid}|${card}`
    if (p.school === SchoolCardID.S2201) {
        log += "|NeoRealism"
        p.deposit += 2;
        addVp(G, ctx, pid, 1);
    }
    if (p.school === SchoolCardID.S1204) {
        log += "|Swedish"
        p.resource += 1;
    }
    if (c.cardId === FilmCardID.F1208 || c.cardId === BasicCardID.B05) {
        log += "|MetropolisOrClassic"
        G.e.stack.push({
            e: "industryOrAestheticsBreakthrough", a: {
                industry: 1,
                aesthetics: 1,
            }
        })
        log += `|playerEffExec`
        logger.debug(`${G.matchID}|${log}`);
        playerEffExec(G, ctx, pid);
        return
    }
    if (c.type === CardType.V) {
        addVp(G, ctx, pid, c.vp);
    }
    log += `|breakthroughEffectPrepare`
    logger.debug(`${G.matchID}|${log}`);
    breakthroughEffectPrepare(G, card);
    let cardEff = getCardEffect(c.cardId);
    if (c.cardId !== FilmCardID.F1108) {
        if (cardEff.hasOwnProperty("archive")) {
            const eff = cardEff.archive;
            if (eff.e !== "none") {
                log += `|pushEffect|${JSON.stringify(eff)}`
                G.e.stack.push(eff)
            } else {
                log += `|noSpecialArchiveEffect`
            }
        } else {
            log += `|missingArchiveEffect`
        }
    } else {
        log += `|Nanook|skip`
    }
    log += `|checkNextEffect`
    logger.debug(`${G.matchID}|${log}`);
    checkNextEffect(G, ctx);
}

export const curCard = (G: IG) => {
    if (G.e.card === null) {
        throw Error("No current card")
    }
    return getCardById(G.e.card);
}

export const playerEffExec = (G: IG, ctx: Ctx, p: PlayerID): void => {
    let log = `playerEffExec|p${p}`;
    let eff = G.e.stack.pop();

    if (eff === undefined) {
        log += "|StackEmpty|checkNextEffect"
        logger.debug(`${G.matchID}|${log}`);
        checkNextEffect(G, ctx);
        return;
    }
    log += `|eff|${JSON.stringify(eff)}`;
    G.e.currentEffect = eff;
    let targetPlayer = p;
    let pub = G.pub[parseInt(p)];
    let playerObj = G.player[parseInt(p)];
    let region = curCard(G).region as validRegion;
    log += `|c:${G.e.card}|region:${region}`;
    let players = []
    let effectLength = 0;
    const handLength = playerObj.hand.length;
    let subEffect;
    let extraCost = 0
    const totalRes = pub.resource + pub.deposit;
    switch (eff.e) {
        case "aestheticsLevelUpCost":
            extraCost = additionalCostForUpgrade(G, pub.aesthetics);
            log += `|extra|${extraCost}`
            if (extraCost < totalRes && extraCost > 0) {
                log += `|canChoose|payAdditionalCost`
                G.e.extraCostToPay = extraCost;
                logger.debug(`${G.matchID}|${log}`);
                G.e.stack.push(eff);
                changePlayerStage(G, ctx, "payAdditionalCost", p);
                return;
            } else {
                payCost(G, ctx, p, extraCost);
                if (pub.aesthetics < 10) {
                    log += `|upgrade`
                    pub.aesthetics++;
                }
            }
            break
        case "industryLevelUpCost":
            extraCost = additionalCostForUpgrade(G, pub.industry);
            log += `|extra|${extraCost}`
            if (extraCost < totalRes && extraCost > 0) {
                log += `|canChoose|payAdditionalCost`
                G.e.extraCostToPay = extraCost;
                logger.debug(`${G.matchID}|${log}`);
                G.e.stack.push(eff);
                changePlayerStage(G, ctx, "payAdditionalCost", p);
                return;
            } else {
                payCost(G, ctx, p, extraCost);
                if (pub.industry < 10) {
                    log += `|upgrade`
                    pub.industry++;
                }
            }
            break;
        case "searchAndArchive":
            players = ownCardPlayers(G, ctx, eff.a);
            if (players.length === 0) {
                log += `noPlayerOwn${eff.a}`
                logger.debug(`${G.matchID}|${log}`);
                break;
            } else {
                log += `|players${JSON.stringify(players)}`
                G.e.stack.push(eff);
                logger.debug(`${G.matchID}|${log}`);
                G.e.currentEffect = eff;
                changePlayerStage(G, ctx, "confirmRespond", players[0]);
                return;
            }
        case "era":
            let era = G.regions[region].era;
            G.e.stack.push(eff.a[era]);
            break;
        case "breakthroughResDeduct":
            if (handLength > 0 && pub.action > 0) {
                log += `|chooseHand`
                G.e.stack.push(eff);
                logger.debug(`${G.matchID}|${log}`);
                changePlayerStage(G, ctx, "chooseHand", p);
                return;
            } else {
                break;
            }
        case "alternative":
            if (idOnBoard(G, ctx, eff.a.a)) {
                G.e.stack.push(eff)
                G.e.currentEffect = eff;
                log += `|confirmRespond`
                logger.debug(`${G.matchID}|${log}`);
                changePlayerStage(G, ctx, "confirmRespond", p);
                return;
            } else {
                break;
            }
        case "competition":
            if (pub.resource < 1) {
                log += `|noResourceForCompetition`
                break;
            } else {
                pub.resource--;
            }
            players = seqFromCurrentPlayer(G, ctx);
            let ownIndex = players.indexOf(p)
            if (ownIndex !== -1) {
                players.splice(ownIndex, 1)
            }
            G.c.players = players;
            G.e.stack.push(eff)
            changePlayerStage(G, ctx, "chooseTarget", p);
            return;
        case "loseAnyRegionShare":
            G.e.regions = ValidRegions.filter(r => pub.shares[r] > 0)
            if (G.e.regions.length === 0) {
                break;
            } else {
                G.e.stack.push(eff)
                changePlayerStage(G, ctx, "chooseRegion", p);
                return;
            }
        case "anyRegionShare":
            let i = G.competitionInfo;
            if (i.pending) {
                log += `|pendingCompetition`
                let winner = i.progress > 0 ? i.atk : i.def;
                let loser = i.progress > 0 ? i.def : i.atk;
                G.e.regions = ValidRegions.filter(r => G.pub[parseInt(loser)].shares[r] > 0)
                if (G.e.regions.length === 0) {
                    log += "|loserNoShare";
                    logger.debug(`${G.matchID}|${log}`);
                    competitionCleanUp(G, ctx);
                    return;
                } else {
                    log += `|p${winner}|chooseRegion`
                    G.e.stack.push(eff)
                    logger.debug(`${G.matchID}|${log}`);
                    changePlayerStage(G, ctx, "chooseRegion", winner);
                    return;
                }
            } else {
                G.e.regions = ValidRegions.filter(r => G.regions[r].share > 0)
                if (G.e.regions.length === 0) {
                    logger.debug("Target player has no share, cannot obtain from others.")
                    break;
                } else {
                    G.e.stack.push(eff)
                    changePlayerStage(G, ctx, "chooseRegion", p);
                    return;
                }
            }
        case "noBuildingEE":
            subEffect = {...eff.a};
            if (isSimpleEffect(G, subEffect)) {
                log += "|simpleEffect|execForAll"
                players = noBuildingPlayers(G, ctx, Region.EE);
                for (let p of players) {
                    G.e.stack.push(subEffect);
                    simpleEffectExec(G, ctx, p);
                }
            }
            break;
        case "vpNotHighestPlayer":
            log += `|vpNotHighestPlayer`
            subEffect = {...eff.a};
            players = vpNotHighestPlayer(G)
            if (isSimpleEffect(G, subEffect)) {
                log += "|simpleEffect|execForAll"
                for (let p of players) {
                    G.e.stack.push(subEffect);
                    simpleEffectExec(G, ctx, p);
                }
            }
            break;
        case "highestVpPlayer":
            log += "|highestVpPlayer"
            subEffect = {...eff.a};
            players = vpHighestPlayer(G);
            if (isSimpleEffect(G, subEffect)) {
                log += "|simpleEffect|execForAll"
                for (let p of players) {
                    G.e.stack.push(subEffect);
                    simpleEffectExec(G, ctx, p);
                }
            }
            break;
        case "aesLowest":
            subEffect = {...eff.a};
            players = aesLowestPlayer(G)
            if (isSimpleEffect(G, subEffect)) {
                log += "|simpleEffect|execForAll"
                for (let p of players) {
                    G.e.stack.push(subEffect);
                    simpleEffectExec(G, ctx, p);
                }
            }
            break;
        case "industryLowest":
            subEffect = {...eff.a};
            players = industryLowestPlayer(G);
            if (isSimpleEffect(G, subEffect)) {
                log += "|simpleEffect|execForAll"
                for (let p of players) {
                    G.e.stack.push(subEffect);
                    simpleEffectExec(G, ctx, p);
                }
            }
            break;
        case "handToOthers":
            log += `|handToOthers`
            players = seqFromCurrentPlayer(G, ctx);
            players.splice(players.indexOf(p), 1);
            G.c.players = players
            G.e.stack.push(eff)
            changePlayerStage(G, ctx, "chooseTarget", p);
            return;
        case "industryAndAestheticsBreakthrough":
            if (eff.a.industry === 0 && eff.a.aesthetics === 0) {
                break;
            }
            if (eff.a.industry === 0 && eff.a.aesthetics > 0) {
                G.e.stack.push(eff)
                doAestheticsBreakthrough(G, ctx, p);
                return;
            }
            if (eff.a.industry > 0 && eff.a.aesthetics === 0) {
                G.e.stack.push(eff)
                doIndustryBreakthrough(G, ctx, p);
                return;
            }
            G.e.stack.push(eff)
            G.e.choices.push({e: "industryBreakthrough", a: eff.a.industry})
            G.e.choices.push({e: "aestheticsBreakthrough", a: eff.a.aesthetics})
            changePlayerStage(G, ctx, "chooseEffect", p);
            return;
        case "industryOrAestheticsBreakthrough":
            G.e.choices.push({e: "industryBreakthrough", a: eff.a.industry})
            G.e.choices.push({e: "aestheticsBreakthrough", a: eff.a.aesthetics})
            changePlayerStage(G, ctx, "chooseEffect", p);
            return;
        case "peek":
            let peekCount = eff.a.count;
            log += `|peek|${peekCount}`
            let deck = G.secretInfo.playerDecks[curPid(G, ctx)];
            effectLength = deck.length;
            log += `|len|${effectLength}`
            const totalRemainCards = effectLength + pub.discard.length
            if (totalRemainCards < peekCount) {
                log += `|total|${totalRemainCards}`
                log += `|noEnoughCardsToPeek`
                peekCount = totalRemainCards
            }
            if (eff.a.filter.e === "choice" && eff.a.filter.a > totalRemainCards) {
                log += `|noEnoughCardToChoose`
                eff.a.filter.a = totalRemainCards;
            }
            if (effectLength < peekCount) {
                log += `|fetchRemainDeck|${JSON.stringify(deck)}`
                playerObj.cardsToPeek = [...deck];
                deck = [];
                deck = shuffle(ctx, pub.discard);
                pub.discard = [];
                log += `|shuffle|${JSON.stringify(deck)}`
                for (let i = 0; i < peekCount - effectLength; i++) {
                    let newCardId = deck.pop();
                    if (newCardId === undefined) {
                        throw Error("Should have card in deck");
                    }
                    log += `|${newCardId}`
                    playerObj.cardsToPeek.push(newCardId);
                }
            } else {
                for (let i = 0; i < peekCount; i++) {
                    let newCardId = deck.pop();
                    log += `|${newCardId}`
                    if (newCardId === undefined) {
                        throw Error("Should have card in deck");
                    }
                    playerObj.cardsToPeek.push(newCardId);
                }
            }
            G.e.stack.push(eff)
            logger.debug(`${G.matchID}|${log}`);
            changePlayerStage(G, ctx, "peek", p);
            return;
        case "buildingNA":
            subEffect = {...eff.a};
            players = buildingPlayers(G, ctx, Region.NA);
            log += "|buildingNAPlayers"
            log += `|${JSON.stringify(players)}`
            if (isSimpleEffect(G, subEffect)) {
                log += "|simpleEffect|execForAll"
                for (let p of players) {
                    G.e.stack.push(subEffect);
                    simpleEffectExec(G, ctx, p);
                }
            } else {
                if (G.e.pendingPlayers.length === 0) {
                    if (players.length > 0) {
                        G.e.pendingPlayers = players;
                        G.e.stack.push(eff);
                        log += "|pushBack"
                        break;
                    } else {
                        log += `|noOneHasBuildingNA`
                        break;
                    }
                } else {
                    if (G.e.pendingPlayers.length !== 1) {
                        log += `|morePlayerPending`
                        G.e.stack.push(eff);
                    } else {
                        log += `|onePlayerPending`
                    }
                    let player = G.e.pendingPlayers.shift() as PlayerID;
                    subEffect.target = player;
                    log += `|push|${JSON.stringify(subEffect)}`
                    G.e.stack.push(subEffect);
                    log += `|left|${G.e.pendingPlayers}`
                    log += `|execFor|p${player}`
                    logger.debug(`${G.matchID}|${log}`);
                    playerEffExec(G, ctx, player);
                    return;
                }
            }
            break;
        case "everyOtherCompany":
            log += `|everyOtherCompany`
            subEffect = {...eff.a};
            if (isSimpleEffect(G, subEffect)) {
                for (let p of G.e.pendingPlayers) {
                    G.e.stack.push(eff.a);
                    simpleEffectExec(G, ctx, p);
                }
            } else {
                if (G.e.pendingPlayers.length === 0) {
                    G.e.pendingPlayers = seqFromCurrentPlayer(G, ctx);
                    G.e.pendingPlayers.shift()
                    G.e.stack.push(eff);
                } else {
                    if (G.e.pendingPlayers.length !== 1) {
                        G.e.stack.push(eff);
                    }
                    let player = G.e.pendingPlayers.shift() as PlayerID;
                    subEffect.target = player;
                    log += `|push|${JSON.stringify(subEffect)}`
                    G.e.stack.push(subEffect);
                    logger.debug(`${G.matchID}|${log}`);
                    playerEffExec(G, ctx, player);
                    return;
                }
            }
            break;
        case "everyPlayer":
            log += "|everyPlayer"
            subEffect = {...eff.a};
            if (isSimpleEffect(G, subEffect)) {
                log += "|simpleEffect|execForAll"
                players = seqFromCurrentPlayer(G, ctx);
                for (let p of players) {
                    G.e.stack.push(subEffect);
                    simpleEffectExec(G, ctx, p);
                }
            } else {
                if (G.e.pendingPlayers.length === 0) {
                    log += "|fetchPlayers"
                    log += `|${JSON.stringify(G.e.pendingPlayers)}`
                    G.e.pendingPlayers = seqFromCurrentPlayer(G, ctx);
                    log += `|${JSON.stringify(G.e.pendingPlayers)}`
                    G.e.stack.push(eff);
                    log += "|pushBack"
                    logger.debug(`${G.matchID}|${log}`);
                } else {
                    log += "|complexEffect"
                    if (G.e.pendingPlayers.length !== 1) {
                        G.e.stack.push(eff);
                    }
                    let player = G.e.pendingPlayers.shift() as PlayerID;
                    subEffect.target = player;
                    log += `|push|${JSON.stringify(subEffect)}`
                    G.e.stack.push(subEffect);
                    logger.debug(`${G.matchID}|${log}`);
                    playerEffExec(G, ctx, player);
                    return;
                }
            }
            break
        case "noStudio":
            players = noStudioPlayers(G, ctx, region);
            log += `|region:${region}|noStudioPlayers|${JSON.stringify(players)}`
            if (players.length === 0) {
                log += `|everyOneHasStudio`
                break;
            }
            G.c.players = players;
            G.e.stack.push(eff.a);
            logger.debug(`${G.matchID}|${log}`);
            changePlayerStage(G, ctx, "chooseTarget", p);
            return;
        case "studio":
            subEffect = {...eff.a};
            players = studioPlayers(G, ctx, region);
            log += `|region:${region}|studioPlayers|${JSON.stringify(players)}`
            if (isSimpleEffect(G, subEffect)) {
                log += "|simpleEffect|execForAll"
                for (let p of players) {
                    G.e.stack.push(subEffect);
                    simpleEffectExec(G, ctx, p);
                }
            } else {
                if (G.e.pendingPlayers.length === 0) {
                    if (players.length > 0) {
                        G.e.pendingPlayers = players;
                        G.e.stack.push(eff);
                        log += "|pushBack"
                        break;
                    } else {
                        log += `|noOneHasStudio`
                        break;
                    }
                } else {
                    if (G.e.pendingPlayers.length !== 1) {
                        log += `|morePlayerPending|pushBack`
                        G.e.stack.push(eff);
                    } else {
                        log += `|onePlayerPending`
                    }
                    let player = G.e.pendingPlayers.shift() as PlayerID;
                    log += `|pending|${JSON.stringify(G.e.pendingPlayers)}`
                    subEffect.target = player;
                    log += `|push|${JSON.stringify(subEffect)}`
                    G.e.stack.push(subEffect);
                    log += `|execFor|p${player}`
                    logger.debug(`${G.matchID}|${log}`);
                    playerEffExec(G, ctx, player);
                    return;
                }
            }
            break;
        case "step":
            log += ("|step")
            effectLength = eff.a.length;
            for (let i = effectLength - 1; i >= 0; i--) {
                subEffect = {...eff.a[i]};
                if(eff.hasOwnProperty("target")){
                    log += `|specifyTarget|${eff.target}`
                    subEffect.target = eff.target;
                }
                log += `|push|${JSON.stringify(subEffect)}`
                G.e.stack.push(subEffect);
            }
            log += `|result|${JSON.stringify(G.e.stack)}`;
            break;
        case "discardNormalOrLegend":
            if (playerObj.hand.filter(i =>
                getCardById(i).category !== CardCategory.BASIC
            ).length > 0) {
                G.e.stack.push(eff);
                log += (`|Has classic cards|changePlayerStage|${p}`)
                changePlayerStage(G, ctx, "chooseHand", p);
                logger.debug(`${G.matchID}|${log}`);
                return;
            } else {
                pub.revealedHand = [...playerObj.hand]
                log += ("|NoClassicRevealHand|next")
            }
            break;
        case "discardLegend":
            if (playerObj.hand.filter(i =>
                getCardById(i).category === CardCategory.LEGEND
            ).length > 0) {
                G.e.stack.push(eff);
                changePlayerStage(G, ctx, "chooseHand", p);
                return;
            } else {
                pub.revealedHand = [...playerObj.hand]
                log += ("|NoLegendRevealHand|next")
            }
            break;
        case "discardAesthetics":
            if (playerObj.hand.filter(i =>
                getCardById(i).aesthetics > 0
            ).length > 0) {
                G.e.stack.push(eff);
                changePlayerStage(G, ctx, "chooseHand", p);
                return;
            } else {
                pub.revealedHand = [...playerObj.hand]
                log += ("|NoAestheticsRevealHand|next")
            }
            break;
        case "discardIndustry":
            if (playerObj.hand.filter(i =>
                getCardById(i).industry > 0
            ).length > 0) {
                G.e.stack.push(eff);
                changePlayerStage(G, ctx, "chooseHand", p);
                return;
            } else {
                pub.revealedHand = [...playerObj.hand]
                log += ("|NoIndustryRevealHand|next")
            }
            break;
        case "refactor":
        case "archive":
        case "discard":
            log += `|hand|${handLength}|discard|${eff.a}`
            if (handLength > 0) {
                if (handLength < eff.a) {
                    log += `|noEnoughCard`
                    eff.a = handLength
                }
                log += `|chooseHand`
                logger.debug(`${G.matchID}|${log}`);
                G.e.stack.push(eff);
                changePlayerStage(G, ctx, "chooseHand", p);
                return;
            } else {
                log += ("|EmptyHand|next")
            }
            break;
        case "choice":
            for (let choice of eff.a) {
                switch (choice.e) {
                    case "breakthroughResDeduct":
                        if (handLength > 0) {
                            G.e.choices.push(choice);
                        }
                        break;
                    case "buy":
                        if (idOnBoard(G, ctx, choice.a)) {
                            G.e.choices.push(choice);
                        }
                        break;
                    default:
                        G.e.choices.push(choice);
                }
            }
            if (G.e.choices.length === 0) {
                log += `|noValidEffect`
                break;
            } else {
                if (G.e.choices.length === 1) {
                    G.e.stack.push(G.e.choices.pop());
                    log += `|oneEffectValid|Exec`
                    logger.debug(`${G.matchID}|${log}`);
                    checkNextEffect(G, ctx);
                } else {
                    logger.debug(`${G.matchID}|${log}`);
                    changePlayerStage(G, ctx, "chooseEffect", p);
                    return;
                }
            }
            logger.debug(`${G.matchID}|${log}`);
            return;
        case "update":
            changePlayerStage(G, ctx, "updateSlot", p);
            return;
        case "comment":
            changePlayerStage(G, ctx, "comment", p);
            return;
        case "pay":
            switch (eff.a.cost.e) {
                case "res":
                    if (pub.resource < eff.a.cost.a) {
                        break
                    } else {
                        pub.resource -= eff.a.cost.a
                        G.e.stack.push(eff.a.eff);
                        break;
                    }
                case "vp":
                case "addVp":
                case "addExtraVp":
                    if (pub.vp < eff.a.cost.a) {
                        break
                    } else {
                        loseVp(G, ctx, p, eff.a.cost.a);
                        G.e.stack.push(eff.a.eff);
                        break
                    }
                case "deposit":
                    if (pub.deposit < eff.a.cost.a) {
                        break
                    } else {
                        pub.deposit -= eff.a.cost.a
                        G.e.stack.push(eff.a.eff);
                        break
                    }
                default:
                    logger.debug(`${G.matchID}|${log}`);
                    throw new Error();
            }
            break;
        case "optional":
            if (G.competitionInfo.pending && eff.a.e === "competition") {
                log += `|alreadyInCompetition|skip`
                break;
            } else {
                G.e.stack.push(eff);
                G.e.currentEffect = eff;
                logger.debug(`${G.matchID}|${log}`);
                changePlayerStage(G, ctx, "confirmRespond", p);
                return;
            }
        case "industryOrAestheticsLevelUp":
            if (eff.hasOwnProperty("target") && eff.target !== p) {
                log += `|otherPlayerVPAward`
                targetPlayer = eff.target
                pub = G.pub[parseInt(targetPlayer)];
            }
            log += `|i${pub.industry}a${pub.aesthetics}`
            if (pub.industry < 10 && pub.aesthetics < 10) {
                log += `|${JSON.stringify(G.e.choices)}|addChoice`
                G.e.choices.push({e: "industryLevelUp", a: 1});
                G.e.choices.push({e: "aestheticsLevelUp", a: 1});
                if (eff.a > 1) {
                    log += `|moreThanOne|pushBack`
                    eff.a--;
                    G.e.stack.push(eff);
                }
                log += `|chooseEffect`
                logger.debug(`${G.matchID}|${log}`);
                changePlayerStage(G, ctx, "chooseEffect", targetPlayer);
                return;
            } else {
                if (pub.industry < 10) {
                    log += `|aesthetics10AddIndustry`
                    pub.industry++;
                    log += `|i${pub.industry}`
                } else {
                    if (pub.aesthetics < 10) {
                        log += `|Industry10AddAesthetics`
                        pub.aesthetics++;
                        log += `|i${pub.aesthetics}`
                    } else {
                        log += "|bothLV10|skip"
                    }
                }
                if (eff.a > 1) {
                    eff.a--;
                    G.e.stack.push(eff);
                }
                break;
            }
        case "archiveToEEBuildingVP":
            G.e.stack.push(eff);
            log += `|chooseHand`
            logger.debug(`${G.matchID}|${log}`);
            changePlayerStage(G, ctx, "chooseHand", p);
            return;
        case "industryBreakthrough":
            if (eff.a > 1) {
                log += `|multiple`
                eff.a--;
                G.e.stack.push(eff);
            }
            logger.debug(`${G.matchID}|${log}`);
            doIndustryBreakthrough(G, ctx, p);
            return;
        case "aestheticsBreakthrough":
            if (eff.a > 1) {
                log += `|multiple`
                eff.a--;
                G.e.stack.push(eff);
            }
            logger.debug(`${G.matchID}|${log}`);
            doAestheticsBreakthrough(G, ctx, p);
            return;
        default:
            log += `|simpleEffect`
            logger.debug(`${G.matchID}|${log}`);
            G.e.stack.push(eff);
            simpleEffectExec(G, ctx, p);
    }
    log += "|checkNextEffect"
    logger.debug(`${G.matchID}|${log}`);
    checkNextEffect(G, ctx);
}

export const aesAward = (G: IG, ctx: Ctx, p: PlayerID): void => {
    let o = G.pub[parseInt(p)];
    const log = `aesAward|p${p}|${o.aesthetics}`
    if (o.aesthetics > 1) {
        addVp(G, ctx, p, 2);
    }
    if (o.aesthetics > 4) {
        addVp(G, ctx, p, 1);
    }
    if (o.aesthetics > 7) {
        addVp(G, ctx, p, 1);
    }
    logger.debug(`${G.matchID}|${log}`);
}

export const industryAward = (G: IG, ctx: Ctx, p: PlayerID): void => {
    let o = G.pub[parseInt(p)];
    const log = `industryAward|p${p}|${o.industry}`
    if (o.industry > 1) o.resource += 1;
    if (o.industry > 4) drawCardForPlayer(G, ctx, p);
    if (o.industry > 7) drawCardForPlayer(G, ctx, p);
    logger.debug(`${G.matchID}|${log}`);
}

export const cardSlotOnBoard2p = (G: IG, ctx: Ctx, card: INormalOrLegendCard): ICardSlot | null => {
    if (card.region === Region.NONE) return null;
    if (card.type === CardType.S) {
        for (let slot of G.twoPlayer.school) {
            if (slot.card === card.cardId) return slot;
        }
        return null;
    } else {
        for (let slot of G.twoPlayer.film) {
            if (slot.card === card.cardId) return slot;
        }
        return null;
    }
}
export const cardSlotOnBoard = (G: IG, ctx: Ctx, card: INormalOrLegendCard): ICardSlot | null => {
    if (card.region === Region.NONE) return null;
    let r = G.regions[card.region];
    if (card.category === CardCategory.LEGEND) {
        if (r.legend.card !== null) {
            if (r.legend.card === card.cardId) {
                return r.legend;
            } else {
                return null;
            }
        } else {
            return null;
        }
    } else {
        for (let slot of r.normal) {
            if (slot.card !== null) {
                if (slot.card === card.cardId) {
                    return slot;
                }
            }
        }
        return null;
    }
}

export const cardOnBoard = (G: IG, ctx: Ctx, card: INormalOrLegendCard): boolean => {
    return cardSlotOnBoard(G, ctx, card) !== null;
}

export function idOnBoard(G: IG, ctx: Ctx, id: string): boolean {
    return cardOnBoard(G, ctx, getCardById(id));
}

export function cardDepleted(G: IG, ctx: Ctx, region: Region) {
    if (region === Region.NONE) return false;
    let r = G.regions[region];
    return r.legend.card === null &&
        r.normal.filter(value => value.card !== null).length === 0 &&
        G.secretInfo.regions[region].normalDeck.length === 0 &&
        G.secretInfo.regions[region].legendDeck.length === 0;
}

export function shareDepleted(G: IG, ctx: Ctx, region: Region) {
    if (region === Region.NONE) return false;
    return G.regions[region].share === 0;
}

export function resCost(G: IG, ctx: Ctx, arg: IBuyInfo, showLog: boolean = true): number {
    let targetCard = getCardById(arg.target);
    let cost: ICost = targetCard.cost;
    let log = `resCost|${targetCard.name}|Cost:|${cost.res}|${cost.industry}|${cost.aesthetics}`;
    let resRequired = cost.res;
    let pub = G.pub[parseInt(arg.buyer)]
    log += `|p${arg.buyer}|industry${pub.industry}|aesthetics${pub.aesthetics}`
    let aesthetics: number = cost.aesthetics
    let industry: number = cost.industry
    aesthetics -= pub.aesthetics;
    industry -= pub.industry;
    log += `|${targetCard.cardId}|i:${industry}|a:${aesthetics}`
    if (pub.school !== null) {
        let schoolCard = getCardById(pub.school);
        log += `|school:${schoolCard.name}|aes:${schoolCard.aesthetics}|ind:${schoolCard.industry}`
        aesthetics -= schoolCard.aesthetics;
        industry -= schoolCard.industry
        if (targetCard.type === CardType.S) {
            let extraCost: number = schoolCard.era + 1
            log += `|oldSchoolExtra:${extraCost}`
            resRequired += extraCost;
        }
    }
    for (const helperId of arg.helper) {
        let helperCard = getCardById(helperId) as INormalOrLegendCard;
        log += `|${helperCard.name}`
        industry -= helperCard.industry;
        aesthetics -= helperCard.aesthetics;
        log += `|i:${industry}|a:${aesthetics}`
    }
    if (aesthetics > 0) {
        log += ("Lack aesthetics " + aesthetics)
        resRequired += aesthetics * 2;
    }
    if (industry > 0) {
        log += ("Lack industry " + industry)
        resRequired += industry * 2;
    }
    if (pub.school === SchoolCardID.S2201 && targetCard.aesthetics > 0) {
        log += ("|New realism deduct")
        if (resRequired < 2) {
            resRequired = 0;
        } else {
            resRequired -= 2;
        }
    }
    log += `|${resRequired}`;
    if (showLog && process.env.NODE_ENV === "production") {
        logger.debug(`${G.matchID}|${log}`);
    }
    return resRequired;
}

export function canAfford(G: IG, ctx: Ctx, card: CardID, p: PlayerID) {
    let pub = G.pub[parseInt(p)]
    let res = resCost(G, ctx, {
        buyer: p,
        target: card,
        helper: G.player[parseInt(p)].hand,
        resource: 0,
        deposit: 0
    })
    return pub.deposit + pub.resource >= res;
}

export function canBuyCard(G: IG, ctx: Ctx, arg: IBuyInfo): boolean {
    let pub = G.pub[parseInt(arg.buyer)];
    let resRequired = resCost(G, ctx, arg);
    let resGiven: number = arg.resource + arg.deposit;
    return resRequired === resGiven && pub.resource >= arg.resource && pub.deposit >= arg.deposit;
}

export const fillTwoPlayerBoard = (G: IG, ctx: Ctx): void => {
    if (ctx.numPlayers > SimpleRuleNumPlayers) throw Error("Cannot call 2p for complex rules");
    let s = G.secretInfo.twoPlayer.school;
    for (let slotL of G.twoPlayer.school) {
        if (slotL.card === null) {
            let newCard = s.pop()
            if (newCard === undefined) {

            } else {
                slotL.card = newCard;
            }
        }
    }
    let f = G.secretInfo.twoPlayer.film;
    for (let slotL of G.twoPlayer.film) {
        if (slotL.card === null) {
            let newCard = f.pop()
            if (newCard === undefined) {

            } else {
                slotL.card = newCard as ClassicCardID;
            }
        }
    }
}
export const drawForTwoPlayerEra = (G: IG, ctx: Ctx, e: IEra): void => {
    let school = schoolCardsByEra(e).map(c => c.cardId);
    let filmCards = filmCardsByEra(e).map(c => c.cardId);
    let schoolDeckSize: number, filmDeckSize: number;
    if (e === IEra.ONE) {
        filmDeckSize = 11;
        schoolDeckSize = 2;
    } else {
        if (e === IEra.TWO) {
            filmDeckSize = 18;
            schoolDeckSize = 3;
        } else {
            filmDeckSize = 12;
            schoolDeckSize = 2;
        }
    }
    G.secretInfo.twoPlayer.school = shuffle(ctx, school).slice(0, schoolDeckSize + 1);
    G.secretInfo.twoPlayer.film = shuffle(ctx, filmCards).slice(0, filmDeckSize + 1);
    for (let s of G.twoPlayer.film) {
        let c = G.secretInfo.twoPlayer.film.pop();
        if (c === undefined) {
            throw new Error(c);
        } else {
            s.card = c;
        }
    }
    for (let s of G.twoPlayer.school) {
        let c = G.secretInfo.twoPlayer.school.pop();
        if (c === undefined) {
            throw new Error(c);
        } else {
            s.card = c;
        }
    }
}

export const drawForRegion = (G: IG, ctx: Ctx, r: Region, e: IEra): void => {
    logger.debug("drawForRegion" + i18n.era[e] + i18n.region[r]);
    if (r === Region.NONE) return;
    let legend = cardsByCond(r, e, true).map(c => c.cardId);
    let normal = cardsByCond(r, e, false).map(c => c.cardId);
    G.secretInfo.regions[r].legendDeck = shuffle(ctx, legend).slice(0, LegendCardCountInUse[r][e]);
    G.secretInfo.regions[r].normalDeck = shuffle(ctx, normal).slice(0, NormalCardCountInUse[r][e]);
    let l: ClassicCardID[] = G.secretInfo.regions[r].legendDeck;
    let n: ClassicCardID[] = G.secretInfo.regions[r].normalDeck;
    for (let s of G.regions[r].normal) {
        let c = n.pop();
        if (c === undefined) {
            throw new Error(c);
        } else {
            s.card = c;
        }
    }
    let c = l.pop();
    if (c === undefined) {
        throw new Error(c);
    } else {
        G.regions[r].legend.card = c;
    }
}
export const drawCardForPlayer = (G: IG, ctx: Ctx, id: PlayerID): void => {
    let pid = parseInt(id);
    let p = G.player[pid]
    let pub = G.pub[pid]
    let s = G.secretInfo.playerDecks[pid]
    if (s.length === 0) {
        G.secretInfo.playerDecks[pid] = shuffle(ctx, pub.discard);
        pub.discard = [];
    }
    let card = G.secretInfo.playerDecks[pid].pop();
    if (card === undefined) {
        // TODO what if player has no card at all?
        logger.debug("Player deck empty cannot draw!")
    } else {
        p.hand.push(card);
    }
}
export const fillPlayerHand = (G: IG, ctx: Ctx, p: PlayerID): void => {
    let i = parseInt(p);
    let s = G.pub[i].school
    let limit: number;
    if (s === null) {
        limit = 4;
    } else {
        limit = getCardEffect(s).school.hand;
    }
    let handCount: number = G.player[i].hand.length;
    if (handCount < limit) {
        let drawCount: number = limit - handCount;
        logger.debug(`p${p}|draw${drawCount}card`)
        for (let t = 0; t < drawCount; t++) {
            drawCardForPlayer(G, ctx, p);
        }
    }
}
export const canHelp = (G: IG, ctx: Ctx, p: PlayerID, target: ClassicCardID | BasicCardID, helper: CardID): boolean => {
    const pub = G.pub[parseInt(p)];
    const helperCard = getCardById(helper);
    const targetCard = getCardById(target);
    const aesMark = pub.aesthetics < targetCard.cost.aesthetics && helperCard.aesthetics > 0;
    const industryMark = pub.industry < targetCard.cost.industry && helperCard.industry > 0;
    if (targetCard.cost.industry === 0) {
        if (targetCard.cost.aesthetics === 0) {
            return false;
        } else {
            return aesMark;
        }
    } else {
        if (targetCard.cost.aesthetics === 0) {
            return industryMark
        } else {
            return industryMark || aesMark;
        }
    }
}

export const getPossibleHelper = (G: IG, ctx: Ctx, p: PlayerID, card: CardID): CardID[] => {
    return G.player[parseInt(p)].hand.filter((h) => canHelp(G, ctx, p, card as BasicCardID, h))
}

export const do2pUpdateSchoolSlot = (G: IG, ctx: Ctx, slot: ICardSlot): void => {
    if (G.twoPlayer.era !== IEra.TWO) {
        // 2p rule only show 2 school card for Era 1 and 3
        // do not need to drawNewCard if not era two
        if (slot.comment !== null) {
            let commentId: BasicCardID = slot.comment;
            G.basicCards[commentId]++;
            slot.comment = null;
        }
        return;
    } else {
        let d;
        d = G.secretInfo.twoPlayer.school;
        if (d.length === 0) {
            return;
        } else {
            let oldCard = slot.card;
            let c = d.pop();
            if (c !== undefined) {
                slot.card = c;
            }
            if (oldCard !== null) {
                d.push(oldCard as SchoolCardID);
            }
        }
    }
}
export const do2pUpdateFilmSlot = (G: IG, ctx: Ctx, slot: ICardSlot): void => {
    let d;
    if (slot.comment !== null) {
        let commentId: BasicCardID = slot.comment as BasicCardID;
        G.basicCards[commentId]++;
        slot.comment = null;
    }
    d = G.secretInfo.twoPlayer.school;
    if (d.length === 0) {
        return;
    } else {
        let oldCard = slot.card;
        let c = d.pop();
        if (c !== undefined) {
            slot.card = c as unknown as ClassicCardID;
        }
        if (oldCard !== null) {
            d.push(oldCard as unknown as SchoolCardID);
        }
    }
}

export const fillEmptySlots = (G: IG, ctx: Ctx) => {
    if (ctx.numPlayers < SimpleRuleNumPlayers) return;
    for (let r of ValidRegions) {
        let region = G.regions[r];
        let l = G.secretInfo.regions[r].legendDeck;
        let n = G.secretInfo.regions[r].normalDeck;
        if (region.legend.card === null) {
            if (l.length > 0) {
                let c = l.pop();
                if (c === undefined) {
                    throw Error("Legend deck empty")
                } else {
                    region.legend.card = c;
                }
            }
        }
        for (let slot of region.normal) {
            if (slot.card === null && n.length > 0) {
                logger.debug(n);
                let c = n.pop();
                if (c !== undefined) {
                    slot.card = c;
                }
            }
        }
    }
}

export const doReturnSlotCard = (G: IG, ctx: Ctx, slot: ICardSlot): void => {
    let log = "doReturnSlotCard"
    let d: ClassicCardID[];
    if (slot.comment !== null) {
        let commentId: BasicCardID = slot.comment as BasicCardID;
        log += `|returnComment${commentId}`
        G.basicCards[commentId]++;
        slot.comment = null;
    }
    if (slot.card === null) {
        return;
    }
    if (ctx.numPlayers > SimpleRuleNumPlayers) {
        if (slot.region === Region.NONE) return;
        if (slot.isLegend) {
            log += `|legend`
            d = G.secretInfo.regions[slot.region].legendDeck;
        } else {
            log += `|normal`
            d = G.secretInfo.regions[slot.region].normalDeck;
        }
    } else {
        log += `|simpleRule`

        if (getCardById(slot.card).type === CardType.S) {
            log += `|school`
            d = G.secretInfo.twoPlayer.school as unknown as ClassicCardID[];
        } else {
            log += `|film`
            d = G.secretInfo.twoPlayer.film;
        }
    }

    let oldCard = slot.card;
    log += `|return${oldCard}|deck${JSON.stringify(d)}`
    if (oldCard !== null) {
        d.unshift(oldCard);
        slot.card = null;
    } else {
        throw new Error("Updating an empty slot!")
    }
    logger.debug(`${G.matchID}|${log}`);
}

export const additionalCostForUpgrade = (G: IG, level: number): number => {
    let log = `additionalCostForUpgrade|${level}`
    if (level <= 2) {
        log += `|cost:0`
        logger.debug(`${G.matchID}|${log}`);
        return 0;
    } else {
        if (level <= 5) {
            log += `|cost:1`
            logger.debug(`${G.matchID}|${log}`);
            return 1;
        } else {
            log += `|cost:2`
            logger.debug(`${G.matchID}|${log}`);
            return 2;
        }
    }
}

export const canUpgrade = (G: IG, ctx: Ctx, p: PlayerID, isIndustry: boolean) => {
    let o = G.pub[parseInt(p)]
    let targetLevel: number;
    targetLevel = isIndustry ? o.industry + 1 : o.aesthetics + 1;
    let cost: number = additionalCostForUpgrade(G, targetLevel);
    if (cost === 0) {
        return true;
    } else {
        return cost <= o.resource + o.deposit;
    }
}

export const legendCount = (G: IG, ctx: Ctx, r: Region, e: IEra, p: PlayerID): number => {
    return G.pub[parseInt(p)].allCards
        .filter(c =>
            getCardById(c).category === CardCategory.LEGEND
            && getCardById(c).region === r
            && getCardById(c).era === e)
        .length;
}

export const try2pScoring = (G: IG, ctx: Ctx): void => {
    ValidRegions.forEach(r => {
        let regObj = G.regions[r];
        if (regObj.share === 0 && !regObj.completedModernScoring) {
            let firstPlayer = 1
            if (G.pub[0].shares[r] > G.pub[1].shares[r]) {
                firstPlayer = 0
            }
            let scoreCard = getScoreCard(r, IEra.THREE, 1)
            G.pub[firstPlayer].discard.push(scoreCard.cardId as ScoreCardID);
            G.pub[firstPlayer].allCards.push(scoreCard.cardId as ScoreCardID);
        }
    })
    if (G.twoPlayer.film.every(c => c.card === null)) {
        if (posOfPlayer(G, ctx, ctx.currentPlayer) === 2) {
            ValidRegions.forEach(r => {
                if (G.pub[0].shares[r] > G.pub[1].shares[r]) {
                    doBuy(G, ctx, B04, '1')
                }
                if (G.pub[0].shares[r] < G.pub[1].shares[r]) {
                    doBuy(G, ctx, B04, '0')
                }
            })
            let era = G.twoPlayer.era;
            let newEra = era;
            if (era === IEra.ONE) {
                newEra = IEra.TWO
            }
            if (era === IEra.ONE) {
                newEra = IEra.THREE
            }
            if (era !== newEra) {
                G.twoPlayer.era = newEra;
                drawForTwoPlayerEra(G, ctx, newEra)
            } else {
                finalScoring(G, ctx);
            }
        }
    }
    fillTwoPlayerBoard(G, ctx);
    signalEndTurn(G, ctx);
}

export const tryScoring = (G: IG, ctx: Ctx): void => {
    let log = "tryScoring"
    if (G.scoringRegions.length > 0) {
        let r = G.scoringRegions.shift();
        G.currentScoreRegion = r as validRegion;
        log += `|region|${r}`
        log += "|regionRank"
        logger.debug(`${G.matchID}|${log}`);
        regionRank(G, ctx, r as Region);
    } else {
        log += "|noRegion"
        if (
            G.pending.lastRoundOfGame &&
            posOfPlayer(G, ctx, ctx.currentPlayer)
            === (ctx.numPlayers - 1)
        ) {
            log += "|finalScoring"
            logger.debug(`${G.matchID}|${log}`);
            finalScoring(G, ctx);
        } else {
            log += "|fillEmptySlots"
            if (ctx.numPlayers > SimpleRuleNumPlayers) {
                fillEmptySlots(G, ctx);
            } else {
                fillTwoPlayerBoard(G, ctx)
            }
            log += "|signalEndStage&Turn"
            logger.debug(`${G.matchID}|${log}`);
            signalEndStage(G, ctx);
            signalEndTurn(G, ctx);
        }
    }
};

export const regionRank = (G: IG, ctx: Ctx, r: Region): void => {
    if (r === Region.NONE) return;
    let era = G.regions[r].era;
    let log = `regionRank|${r}|${era}`
    const rank = (a: PlayerID, b: PlayerID): number => {
        let log = `rank|${a}|${b}`
        let p1 = G.pub[parseInt(a)];
        let p2 = G.pub[parseInt(b)];
        const as = p1.shares[r];
        const bs = p2.shares[r];
        log += `|share|${as}|${bs}`
        if (as > bs) {
            log += `|share|p${a}win`
            logger.debug(`${G.matchID}|${log}`);
            return -1;
        }
        if (as < bs) {
            log += `|share|p${b}win`
            logger.debug(`${G.matchID}|${log}`);
            return 1;
        }
        log += `|sameShare`
        let legendCountA = legendCount(G, ctx, r, era, a);
        let legendCountB = legendCount(G, ctx, r, era, b);
        log += `|legendCount|${legendCountA}|${legendCountB}`
        if (legendCountA > legendCountB) {
            log += `|legendCount|p${a}win`
            logger.debug(`${G.matchID}|${log}`);
            return -1;
        }
        if (legendCountA < legendCountB) {
            log += `|legendCount|p${b}win`
            logger.debug(`${G.matchID}|${log}`);
            return 1;
        }
        log += `|sameLegendCount`
        const curPos = seqFromActivePlayer(G, ctx);
        const posA = curPos.indexOf(a);
        const posB = curPos.indexOf(b);
        log += `|pos|${posA}|${posB}`
        if (posA > posB) {
            log += `|pos|p${a}win`
            logger.debug(`${G.matchID}|${log}`);
            return -1;
        } else {
            if (posA < posB) {
                log += `|pos|p${b}win`
                logger.debug(`${G.matchID}|${log}`);
                return 1;
            } else {
                throw Error("Two player cannot have the same position.")
            }
        }
    }
    let rankingPlayer: PlayerID[] = [];
    G.order.forEach((i, idx) => {
        log += `|p${idx}`
        if (G.pub[idx].shares[r] === 0) {
            log += "|badFilm"
            doBuy(G, ctx, B04, idx.toString())
        } else {
            log += `|rank`
            rankingPlayer.push(idx.toString())
        }
    });
    let rankResult = rankingPlayer.sort(rank);
    log += `|rankResult|${rankResult}`;
    let firstPlayer: PlayerID = rankResult[0];
    log += `|firstPlayer:${firstPlayer}`
    G.pub[parseInt(firstPlayer)].champions.push({
        era: era,
        region: r,
    })
    let scoreCount = scoreCardCount(r, era);

    log += `|scoreCount:${scoreCount}`;
    let scoreCardPlayerCount = Math.min(rankResult.length, scoreCount)
    if (ctx.numPlayers === 3) {
        if (scoreCardPlayerCount > 2) {
            scoreCardPlayerCount = 2;
        }
    }
    log += `|scoreCardPlayerCount:${scoreCardPlayerCount}`
    for (let i = 0; i < scoreCardPlayerCount; i++) {
        let scoreId = "V" + (era + 1).toString() + (r + 1).toString() + (i + 1).toString()
        log += `|p${i}|${scoreId}`
        G.pub[parseInt(rankResult[i])].discard.push(scoreId as ScoreCardID)
        G.pub[parseInt(rankResult[i])].allCards.push(scoreId as ScoreCardID)
    }
    for (let i = scoreCardPlayerCount; i < rankResult.length; i++) {
        log += `|p${i}|bad film`
        doBuy(G, ctx, B04, rankResult[i])
    }
    logger.debug(`${G.matchID}|${log}`);
    changePlayerStage(G, ctx, "chooseEvent", firstPlayer);
}

export function canBuildStudioInRegion(G: IG, ctx: Ctx, p: PlayerID, r: Region): boolean {
    if (r === Region.NONE) return false;
    if (G.pub[parseInt(p)].building.studioBuilt || cinemaInRegion(G, ctx, r, p)) {
        return false;
    } else {
        return G.regions[r].buildings.filter(slot => slot.activated && slot.owner === "").length > 0;
    }
}

export function cinemaSlotsAvailable(G: IG, ctx: Ctx, p: PlayerID): Region[] {
    return [Region.NA, Region.WE, Region.EE, Region.ASIA].filter(r => canBuildCinemaInRegion(G, ctx, p, r));
}

export function studioSlotsAvailable(G: IG, ctx: Ctx, p: PlayerID): Region[] {
    return [Region.NA, Region.WE, Region.EE, Region.ASIA].filter(r => canBuildStudioInRegion(G, ctx, p, r));
}

export function canBuildCinemaInRegion(G: IG, ctx: Ctx, p: PlayerID, r: Region): boolean {
    if (r === Region.NONE) return false;
    if (G.pub[parseInt(p)].building.cinemaBuilt || studioInRegion(G, ctx, r, p)) {
        return false;
    } else {
        return G.regions[r].buildings.filter(slot => slot.activated && slot.owner === "").length > 0;
    }
}

export function doFillNewEraEventDeck(G: IG, ctx: Ctx, newEra: IEra) {
    let newEvents = eventCardByEra(newEra).map(c => c.cardId);
    G.secretInfo.events = shuffle(ctx, newEvents);
    for (let i = 0; i < 2; i++) {
        let newEvent = G.secretInfo.events.pop();
        if (newEvent === undefined) {
            throw new Error();
        } else {
            G.events.push(newEvent)
        }
    }
}

export function fillEventCard(G: IG, ctx: Ctx) {
    let log = "fillEventCard|"
    let newEvent = G.secretInfo.events.pop();
    let era = getCardById(G.events[0]).era;
    if (newEvent === undefined) {
        log += "emptyEventDeck|"
    } else {
        log += newEvent
        G.events.push(newEvent)
    }
    let newEra = era === IEra.THREE ? era : era + 1;
    if (G.events.length === 1) {
        if (G.events[0] === "E03") {
            G.activeEvents.push(EventCardID.E03);
            G.order.forEach((i, idx) => {
                if (G.pub[idx].action < 2) G.pub[idx].action = 2
            });
        }
        G.events = [];
        if (newEra !== era) {
            log += `|fillNewEraEvents|${newEra}`
            doFillNewEraEventDeck(G, ctx, newEra);
        }
    }
    logger.debug(`${G.matchID}|${log}`);
}

export function doIndustryBreakthrough(G: IG, ctx: Ctx, player: PlayerID) {
    let log = `doIndustryBreakthrough|p${player}`
    if (G.e.stack.length > 0) {
        let top = G.e.stack.pop();
        log += `|stack|${JSON.stringify(top)}`
        if (top !== undefined && top.e === "industryAndAestheticsBreakthrough") {
            log += `|top:${top.a.industry}`
            top.a.industry--;
        }
        G.e.stack.push(top);
    }
    const p = G.pub[parseInt(player)];
    const totalResource = p.resource + p.deposit;
    const additionalCost = additionalCostForUpgrade(G, p.industry);
    if (additionalCost <= totalResource && p.industry < 10) {
        log += `|${additionalCost}|canUpgrade`
        G.e.choices.push({e: "industryLevelUpCost", a: 1})
    }
    if (ctx.numPlayers > SimpleRuleNumPlayers) {
        if (totalResource >= 3 && studioSlotsAvailable(G, ctx, player).length > 0) {
            log += `|studio`
            G.e.choices.push({e: "buildStudio", a: 1})
        }
        if (totalResource >= 3 && cinemaSlotsAvailable(G, ctx, player).length > 0) {
            log += `|cinema`
            G.e.choices.push({e: "buildCinema", a: 1})
        }
    }
    G.e.choices.push({e: "skipBreakthrough", a: 1})
    log += "chooseEffect"
    logger.debug(`${G.matchID}|${log}`);
    changeStage(G, ctx, "chooseEffect")
}

export function doAestheticsBreakthrough(G: IG, ctx: Ctx, player: PlayerID) {
    let log = `doAestheticsBreakthrough|p${player}|`
    if (G.e.stack.length > 0) {
        let top = G.e.stack.pop();
        log += `|stack|${JSON.stringify(top)}`
        if (top !== undefined && top.e === "industryAndAestheticsBreakthrough") {
            log += `|top:${top.a.aesthetics}`
            top.a.aesthetics--;
        }
        G.e.stack.push(top);
    }
    const p = G.pub[parseInt(player)];
    const playerObj = G.player[parseInt(player)];
    const totalResource = p.resource + p.deposit;
    const additionalCost = additionalCostForUpgrade(G, p.aesthetics);
    if (additionalCost <= totalResource && p.aesthetics < 10) {
        log += ("|Can upgrade aesthetics")
        G.e.choices.push({e: "aestheticsLevelUpCost", a: 1})
    }
    if (playerObj.hand.length > 0) {
        log += ("|Can refactor")
        G.e.choices.push({e: "refactor", a: 1})
    }
    G.e.choices.push({e: "skipBreakthrough", a: 1})
    log += "|chooseEffect"
    logger.debug(`${G.matchID}|${log}`);
    changeStage(G, ctx, "chooseEffect")
}

export const regionEraProgress = (G: IG, ctx: Ctx) => {
    let log = "regionEraProgress"
    let r = G.currentScoreRegion;
    log += `|region|${G.currentScoreRegion}`
    if (r === Region.NONE) throw new Error();
    log += `|nextEra`
    logger.debug(`${G.matchID}|${log}`);
    nextEra(G, ctx, r);
    G.currentScoreRegion = Region.NONE;
    log = "regionEraProgress|CleanUpCurrent"
    if (ValidRegions
        .filter(r => G.regions[r].completedModernScoring)
        .length >= 3) {
        log += "|lastRound"
        G.pending.lastRoundOfGame = true;
    }
    if (ValidRegions.filter(r =>
        G.regions[r].era !== IEra.ONE).length >= 2 &&
        G.regions[Region.ASIA].era === IEra.ONE
    ) {
        log += "|setUpAsia"
        drawForRegion(G, ctx, Region.ASIA, IEra.TWO);
        G.regions[Region.ASIA].era = IEra.TWO;
        G.regions[Region.ASIA].share = ShareOnBoard[Region.ASIA][IEra.TWO];
    }
    log += "|tryScoring"
    logger.debug(`${G.matchID}|${log}`);
    tryScoring(G, ctx);
}

export function checkNextEffect(G: IG, ctx: Ctx) {
    let log = "checkNextEffect";
    if (G.e.stack.length === 0) {
        log += ("|Stack empty")
        let newWavePlayer = schoolPlayer(G, ctx, SchoolCardID.S3204);
        if (newWavePlayer !== null && G.pub[parseInt(newWavePlayer)].discardInSettle) {
            G.pub[parseInt(newWavePlayer)].discardInSettle = false;
            addVp(G, ctx, newWavePlayer, 1);
            drawCardForPlayer(G, ctx, newWavePlayer)
            log += `|newWave|p${newWavePlayer}|drawCard`
        }
        if (G.currentScoreRegion === Region.NONE) {
            log += ("|No scoring region")
            let i = G.competitionInfo;
            if (i.pending) {
                log += "|pendingCompetition"
                if (i.atkPlayedCard) {
                    log += "|defCardSettle"
                    i.atkPlayedCard = false;
                    logger.debug(`${G.matchID}|${log}`);
                    defCardSettle(G, ctx);
                    return;
                } else {
                    log += "|showCompetitionResult"
                    i.defPlayedCard = false;
                    logger.debug(`${G.matchID}|${log}`);
                    changePlayerStage(G, ctx, "showCompetitionResult", i.atk);
                    return;
                }
            } else {
                if (ctx.activePlayers !== null) {
                    log += "|signalEndStage"
                    signalEndStage(G, ctx);
                    logger.debug(`${G.matchID}|${log}`);
                    return;
                }
            }
        } else {
            log += "|regionEraProgress"
            logger.debug(`${G.matchID}|${log}`);
            regionEraProgress(G, ctx);
            return;
        }
    } else {
        let nextEff = G.e.stack.slice(-1)[0];
        log += `|Next effect|${JSON.stringify(nextEff)}`
        let targetPlayer = ctx.currentPlayer
        if(nextEff.hasOwnProperty("target")){
            targetPlayer = nextEff.target;
        }
        log += `|target|${targetPlayer}`
        logger.debug(`${G.matchID}|${log}`);
        playerEffExec(G, ctx, targetPlayer)
    }
}

export const addVp = (G: IG, ctx: Ctx, p: PlayerID, vp: number) => {
    let log = `addVp|${p}|${vp}`
    let obj = G.pub[parseInt(p)];
    log += `|prev|${obj.vp}`
    obj.vp += vp;
    log += `|after|${obj.vp}`
    let count = 0;
    if (obj.vp >= 60 && !obj.vpAward.v60) {
        log += `|v60`
        count++;
        obj.vpAward.v60 = true;
    }
    if (obj.vp >= 90 && !obj.vpAward.v90) {
        log += `|v90`
        count++;
        obj.vpAward.v90 = true;
    }
    if (obj.vp >= 120 && !obj.vpAward.v120) {
        log += `|v120`
        count++;
        obj.vpAward.v120 = true;
    }
    if (obj.vp >= 150 && !obj.vpAward.v150) {
        log += `|v150`
        obj.vpAward.v150 = true;
        count++;
        G.pending.lastRoundOfGame = true;
    }
    if (count > 0) {
        log += `|stack|${JSON.stringify(G.e.stack)}`
        G.e.stack.push({e: "industryOrAestheticsLevelUp", a: count, target: p})
        log += `|push|industryOrAestheticsLevelUp`
    }
    logger.debug(`${G.matchID}|${log}`);
}
export const loseDeposit = (G: IG, ctx: Ctx, p: PlayerID, deposit: number) => {
    let log = `loseDeposit|${p}|${deposit}`
    let pub = G.pub[parseInt(p)];
    log += `|before|${pub.deposit}`
    if (deposit > pub.vp) {
        pub.deposit = 0;
    } else {
        pub.deposit -= deposit;
    }
    log += `|after|${pub.deposit}`
    logger.debug(`${G.matchID}|${log}`);
}

export const loseVp = (G: IG, ctx: Ctx, p: PlayerID, vp: number) => {
    let log = `loseVp|${p}|${vp}`
    let pub = G.pub[parseInt(p)];
    log += `|before|${pub.vp}`
    if (vp > pub.vp) {
        pub.vp = 0;
    } else {
        pub.vp -= vp;
    }
    log += `|after|${pub.vp}`
    if (pub.school === SchoolCardID.S2104) {
        log += `|FilmNoir|${pub.resource}`
        pub.resource += vp;
        log += `|${pub.resource}`
    }
    logger.debug(`${G.matchID}|${log}`);
}

export const buildBuildingFor = (G: IG, ctx: Ctx, r: validRegion, p: PlayerID, building: BuildingType): void => {
    let log = `buildBuildingFor|p${p}|${r}`
    const pub = G.pub[parseInt(p)];
    const reg = G.regions[r]
    if (reg.share > 0) {
        pub.shares[r]++
        reg.share--;
    }
    let built = false;
    reg.buildings.forEach((slot: IBuildingSlot, idx: number) => {
        if (slot.activated && slot.owner === "" && !built) {
            slot.owner = p;
            if (building === BuildingType.cinema) {
                log += `|cinema`
                pub.building.cinemaBuilt = true;
            } else {
                log += `|studio`
                pub.building.studioBuilt = true;
            }
            slot.building = building;
            log += `|built|on|slot${idx}`
            built = true;
        }
    })
    logger.debug(`${G.matchID}|${log}`);
}

export const competitionCleanUp = (G: IG, ctx: Ctx) => {
    let log = `competitionCleanUp|checkNextEffect`
    let i = G.competitionInfo;
    i.pending = false;
    i.progress = 0;
    i.atkCard = null;
    i.defCard = null;
    logger.debug(`${G.matchID}|${log}`);
    checkNextEffect(G, ctx);
}

export function competitionResultSettle(G: IG, ctx: Ctx) {
    let i = G.competitionInfo;
    let log = `competitionResultSettle|pa:${i.atk}|pd:${i.def}`
    let winner: PlayerID = '0';
    let hasWinner = false;
    if (i.progress > 5) {
        log += `|${i.progress}|overflow`
        i.progress = 5;
    }
    if (i.progress < -5) {
        log += `|${i.progress}|underflow`
        i.progress = -5;
    }
    if (i.progress >= 3) {
        log += `|atk|p${i.atk}|won`
        winner = i.atk;
        hasWinner = true;
    } else {
        if (i.progress <= -3) {
            log += `|def|p${i.def}|won`
            winner = i.def;
            hasWinner = true;
        } else {
            log += `|noWinner`
        }
    }
    if (i.progress > 0) {
        addVp(G, ctx, i.atk, i.progress);
        let schoolId = G.pub[parseInt(i.def)].school;
        if (schoolId !== SchoolCardID.S3201 && schoolId !== SchoolCardID.S3204) {
            log += `|p${i.def}|lose${i.progress}vp`
            loseVp(G, ctx, i.def, i.progress);
        } else {
            log += `|doNotLoseVP`
        }
    } else {
        const vp = -i.progress;
        addVp(G, ctx, i.def, vp);
        let schoolId = G.pub[parseInt(i.atk)].school;
        if (schoolId !== SchoolCardID.S3201 && schoolId !== SchoolCardID.S3204) {
            log += `|p${i.atk}|lose${vp}vp`
            loseVp(G, ctx, i.atk, vp);
        } else {
            log += `|doNotLoseVP`
        }
    }
    if (hasWinner) {
        if (i.onWin.e !== "none") {
            log += `|onWin${JSON.stringify(i.onWin)}`
            if (i.onWin.e === "anyRegionShare") {
                log += `|moreShare${i.onWin.a}|playerEffExec|p${winner}`
                G.e.stack.push({
                    e: "anyRegionShare", a: 1 + i.onWin.a
                })
                logger.debug(`${G.matchID}|${log}`);
                playerEffExec(G, ctx, winner);
                return;
            } else {
                G.e.stack.push({...i.onWin});
                i.onWin.e = "none";
                simpleEffectExec(G, ctx, winner);
            }
        }
        log += `|getShareFromLoser`
        G.e.stack.push({
            e: "anyRegionShare", a: 1
        })
        logger.debug(`${G.matchID}|${log}`);
        playerEffExec(G, ctx, winner);
        return;
    } else {
        log += `|competitionCleanUp`
        logger.debug(`${G.matchID}|${log}`);
        competitionCleanUp(G, ctx);
    }
    logger.debug(`${G.matchID}|${log}`);
}

export function atkCardSettle(G: IG, ctx: Ctx) {
    let i = G.competitionInfo;
    let cards = G.player[parseInt(i.atk)].competitionCards;
    let log = `atkCardSettle`
    if (cards.length > 0) {
        let cardId = cards[0];
        i.atkCard = cardId;
        const pub = G.pub[parseInt(i.atk)];
        pub.playedCardInTurn.push(cardId);
        G.player[parseInt(i.atk)].competitionCards = []
        log += `|${cardId}`
        let card = getCardById(cardId)
        if (card.region === i.region) {
            log += `|sameRegion:${i.region}|++`
            i.progress++;
        }
        if (card.industry > 0) {
            log += `|industryMark|++`
            i.progress++;
        }
        let eff = getCardEffect(cardId);
        log += `|${JSON.stringify(eff.play)}`
        G.e.card = cardId;
        if (cinemaInRegion(G, ctx, i.region, i.atk)) {
            log += `|cinemaInRegion|${i.region}|${i.progress}`
            i.progress ++;
            log += `|${i.progress}`
            addVp(G, ctx, i.atk, 1);
        }
        G.e.stack.push(eff.play);
        logger.debug(`${G.matchID}|${log}`);
        // TODO may over run set a barrier effect?
        playerEffExec(G, ctx, i.atk);
    } else {
        log += "|atkNoCard|defCardSettle"
        logger.debug(`${G.matchID}|${log}`);
        defCardSettle(G, ctx);
    }
}

export const defCardSettle = (G: IG, ctx: Ctx) => {
    let log = "defCardSettle"
    let i = G.competitionInfo;
    let cards = G.player[parseInt(i.def)].competitionCards;
    if (cards.length > 0) {
        drawCardForPlayer(G, ctx, i.def);
        let cardId = cards[0];
        i.defCard = cardId;
        log += `|${cardId}`
        let card = getCardById(cardId)
        if (card.region === i.region) {
            log += `|sameRegion:${i.region}|--|${i.progress}`
            i.progress--;
        }
        if (card.industry > 0) {
            log += `|industryMark|--|${i.progress}`
            i.progress--;
        }
        G.pub[parseInt(i.def)].discard.push(cardId);
        let eff = getCardEffect(cardId);
        log += `|${JSON.stringify(eff.play)}`
        G.e.card = cardId;
        G.e.stack.push(eff.play);
        G.player[parseInt(i.def)].competitionCards = [];
        if (cinemaInRegion(G, ctx, i.region, i.def)) {
            log += `|cinemaInRegion|${i.region}|${i.progress}`
            i.progress --;
            log += `|${i.progress}`
            addVp(G, ctx, i.atk, 1);
        }
        logger.debug(`${G.matchID}|${log}`);
        playerEffExec(G, ctx, i.def);
    } else {
        log += `|defNoCard|showCompetitionResult`
        logger.debug(`${G.matchID}|${log}`);
        changePlayerStage(G, ctx, "showCompetitionResult", i.atk);
    }
}

export function nextEra(G: IG, ctx: Ctx, r: Region) {
    if (r === Region.NONE) throw new Error();
    let region = G.regions[r];
    let era = region.era;
    let log = `nexEra|${r}|era:${era}`
    let newEra;
    region.legend.card = null;
    if (region.legend.comment !== null) {
        G.basicCards[region.legend.comment as BasicCardID]++;
        region.legend.comment = null
    }
    for (let s of region.normal) {
        s.card = null;
        if (s.comment !== null) {
            G.basicCards[s.comment as BasicCardID]++;
            s.comment = null
        }
    }
    log += `|resetShare`
    for (let i = 0; i < ctx.numPlayers; i++) {
        G.pub[i].shares[r] = 0;
    }
    if (era === IEra.ONE) {
        log += `|IEra.TWO`
        newEra = IEra.TWO;
        region.era = newEra;
        drawForRegion(G, ctx, r, newEra);
        region.share = ShareOnBoard[r][newEra];
        if (ctx.numPlayers === 3) {
            region.share--;
        }
    }
    if (era === IEra.TWO) {
        log += `|IEra.THREE`
        newEra = IEra.THREE;
        region.share = ShareOnBoard[r][newEra];
        region.era = newEra;
        newEra = IEra.THREE;
        drawForRegion(G, ctx, r, newEra);
        if (ctx.numPlayers === 3) {
            region.share--;
        }
    }
    if (era === IEra.THREE) {
        log += `|completedModernScoring`
        region.completedModernScoring = true;
    }
    logger.debug(`${G.matchID}|${log}`);
}

export const startCompetition = (G: IG, ctx: Ctx, atk: PlayerID, def: PlayerID) => {
    let log = `startCompetition|atk${atk}|def${def}`
    let i = G.competitionInfo;
    i.pending = true;
    i.atk = atk;
    i.def = def;
    i.region = curCard(G).region as validRegion;
    log += `|region:${i.region}`
    let classicHollywoodPlayer = schoolPlayer(G, ctx, SchoolCardID.S3101);
    if (classicHollywoodPlayer === i.atk) {
        log += `|classicHollywoodATK`
        i.progress++;
    }
    if (classicHollywoodPlayer === i.def) {
        log += `|classicHollywoodDEF`
        i.progress--
    }
    let newHollywoodPlayer = schoolPlayer(G, ctx, SchoolCardID.S3101);
    if (newHollywoodPlayer === i.atk) {
        log += `|newHollywoodATK`
        i.progress++;
    }
    if (newHollywoodPlayer === i.def) {
        log += `|newHollywoodDEF`
        i.progress--
    }
    log += `|checkCompetitionAttacker`
    logger.debug(`${G.matchID}|${log}`);
    checkCompetitionAttacker(G, ctx);
}


export const checkCompetitionDefender = (G: IG, ctx: Ctx) => {
    let i = G.competitionInfo;
    if (G.player[parseInt(i.def)].hand.length > 0) {
        logger.debug(`checkCompetitionDefender|p${i.def}|competitionCard`);
        changePlayerStage(G, ctx, "competitionCard", i.def);
    } else {
        i.defPlayedCard = true;
        const log = (`checkCompetitionDefender|p${i.def}|emptyHand|showCompetitionResult`);
        logger.debug(`${G.matchID}|${log}`);
        changePlayerStage(G, ctx, "showCompetitionResult", i.atk);
    }
}
export const checkCompetitionAttacker = (G: IG, ctx: Ctx) => {
    let log = "checkCompetitionAttacker"
    let i = G.competitionInfo;
    if (G.player[parseInt(i.atk)].hand.length > 0) {
        log += `|p${i.atk}|competitionCard`
        logger.debug(`${G.matchID}|${log}`);
        changePlayerStage(G, ctx, "competitionCard", i.atk);
    } else {
        log += `|p${i.atk}|emptyHand`
        i.atkPlayedCard = true;
        logger.debug(`${G.matchID}|${log}`);
        checkCompetitionDefender(G, ctx);
    }
}

const cleanUpScore = (G: IG, ctx: Ctx, pid: PlayerID) => {
    let i = parseInt(pid);
    let p = G.pub[i];
    let f = p.finalScoring;
    f.card = 0
    f.building = 0
    f.industryAward = 0
    f.aestheticsAward = 0
    f.archive = 0
    f.events = 0
    f.total = 0
}

export const getExtraScoreForFinal = (G: IG, ctx: Ctx, pid: PlayerID): void => {
    let i = parseInt(pid);
    let p = G.pub[i];
    let s = G.player[i];
    cleanUpScore(G, ctx, pid);
    let f = p.finalScoring;
    if (p.school !== null) {
        f.card += getCardById(p.school).vp;
    }
    let validID = [...G.secretInfo.playerDecks[i], ...p.discard, ...s.hand]
    let validCards = validID.map(c => getCardById(c));
    validCards.forEach(c => {
        f.card += c.vp
    });
    if (p.building.cinemaBuilt) f.building += 3;
    if (p.building.studioBuilt) f.building += 3;
    if (p.industry === 10) {
        for (let j = 0; j < ctx.numPlayers; i++) {
            let each = G.pub[j];
            if (each.building.cinemaBuilt) f.industryAward += 5;
            if (each.building.studioBuilt) f.industryAward += 5;
        }
    }
    if (p.aesthetics === 10) {
        f.aestheticsAward += Math.round(p.vp / 5);
    }
    ValidRegions.forEach(r => {
        let championCount = p.champions.filter(c => c.region === r).length;
        f.archive += p.archive.filter(card => getCardById(card).region === r).length * championCount;
    });
    if (p.scoreEvents.includes(EventCardID.E10)) {
        for (let j = 0; j < ctx.numPlayers; i++) {
            if (j !== parseInt(pid)) {
                let other = G.pub[j];
                if (other.vp > p.vp) {
                    f.events += 4;
                }
            }
        }
    }
    if (p.scoreEvents.includes(EventCardID.E11)) {
        G.secretInfo.playerDecks[i].filter(c => getCardById(c).type === CardType.P).forEach(() => f.events += 4);
        f.events += p.archive.filter(card => getCardById(card).type === CardType.P).length * 4;
    }
    if (p.scoreEvents.includes(EventCardID.E12)) {
        f.events += p.industry;
        f.events += p.aesthetics;
    }
    if (p.scoreEvents.includes(EventCardID.E13)) {
        let championCount = p.champions.length;
        switch (championCount) {
            case 6:
            case 5:
            case 4:
                f.events += 20;
                break;
            case 3:
                f.events += 12;
                break;
            case 2:
                f.events += 6;
                break;
            case 1:
                f.events += 2;
                break;
            default:
                break;
        }
    }
    if (p.scoreEvents.includes(EventCardID.E14)) {
        f.events += G.secretInfo.playerDecks[i].filter(c => getCardById(c).category === CardCategory.BASIC).length;
        f.events += p.archive.filter(card => getCardById(card).category === CardCategory.BASIC).length;
    }
    if (validID.includes(PersonCardID.P3102)) {
        f.events += validCards.filter(c => c.industry > 0)
            .filter(c => c.category === CardCategory.LEGEND || c.category === CardCategory.NORMAL)
            .length * 2
    }
    if (validID.includes(FilmCardID.F3106)) {
        f.events += validCards.filter(c => c.region === Region.NA)
            .filter(c => c.type === CardType.F)
            .length * 2
    }
    if (validID.includes(PersonCardID.P3402)) {
        f.events += validCards.filter(c => c.region === Region.ASIA)
            .filter(c => c.type === CardType.F)
            .length * 2
    }
    if (validID.includes(FilmCardID.F3107)) {
        f.events += Math.round(validCards.length / 3)
    }
    if (validID.includes(PersonCardID.P3202)) {
        f.events += validCards.filter(c => c.region === Region.WE)
            .length * 2
    }
    if (validID.includes(PersonCardID.P3302)) {
        f.events += p.industry * 2;
    }
    if (validID.includes(PersonCardID.P3403)) {
        f.events += p.aesthetics * 2;
    }
    if (validID.includes(PersonCardID.P3301)) {
        f.events += validCards.filter(c => c.region === Region.EE)
            .length * 2
    }
    if (validID.includes(PersonCardID.P3203)) {
        f.events += validCards.filter(c => c.aesthetics > 0)
            .filter(c => c.category === CardCategory.LEGEND || c.category === CardCategory.NORMAL)
            .length * 2
    }
    if (validID.includes(PersonCardID.P3401)) {
        f.events += validCards.filter(c => c.type === CardType.P).length * 4
    }
    f.total = p.vp + f.card + f.building + f.industryAward + f.aestheticsAward + f.archive + f.events
}

export const schoolPlayer = (G: IG, ctx: Ctx, cardId: string): PlayerID | null => {
    for (let i = 0; i < ctx.numPlayers; i++) {
        if (G.pub[i].school === cardId) return i.toString();
    }
    return null;
}

export const rank = (G: IG, ctx: Ctx, p1: number, p2: number, addLog: boolean = false): number => {
    let log = `rank|${p1}|${p2}`
    let pub1 = G.pub[p1];
    let pub2 = G.pub[p2];
    const v1 = pub1.finalScoring.total;
    const v2 = pub2.finalScoring.total;
    log += `|vp|${v1}|${v2}`
    if (v1 > v2) {
        log += `|p${p1}wins`
        if (addLog) logger.debug(`${G.matchID}|${log}`);
        return -1;
    } else {
        if (v1 < v2) {
            log += `|p${p2}wins`
            if (addLog) logger.debug(`${G.matchID}|${log}`);
            return 1;
        } else {
            const pos1 = posOfPlayer(G, ctx, p1.toString());
            const pos2 = posOfPlayer(G, ctx, p2.toString());
            log += `|pos|${pos1}|${pos2}`
            if (addLog) logger.debug(`${G.matchID}|${log}`);
            if (pos1 < pos2) {
                log += `|p${p2}wins`
                if (addLog) logger.debug(`${G.matchID}|${log}`);
                return 1
            } else {
                log += `|p${p1}wins`
                if (addLog) logger.debug(`${G.matchID}|${log}`);
                return -1
            }
        }
    }
}
export const finalScoring = (G: IG, ctx: Ctx) => {
    let pid: number[] = [];
    for (let i = 0; i < ctx.numPlayers; i++) {
        getExtraScoreForFinal(G, ctx, i.toString());
        pid.push(i);
    }
    const rankFunc = (a: number, b: number) => rank(G, ctx, a, b);
    let finalRank = pid.sort(rankFunc);
    ctx?.events?.endGame?.({
        winner: finalRank[0].toString(),
        reason: VictoryType.finalScoring,
    })
}

export const getCardName = (cardId: string):string => {
    if (cardId in i18n.card) {
        // @ts-ignore
        return i18n.card[cardId];
    } else {
        if (cardId in AllClassicCards) {
            let trimmedID = cardId.slice(1)
            // @ts-ignore
            return i18n.card[trimmedID];
        } else {
            if (cardId in EventCardID) {
                // @ts-ignore
                return i18n.card[cardId]
            } else {
                if (cardId in ScoreCardID) {
                    let scoreCard = getScoreCardByID(cardId);
                    return i18n.score.cardName({
                        era: scoreCard.era,
                        region: scoreCard.region,
                        rank: scoreCard.rank,
                    })
                } else {
                    throw Error(`Unknown id ${cardId}`)
                }
            }
        }
    }
}

export const playCardEffectText = (cardId: CardID): string => {
    let effObj = getCardEffect(cardId);
    let r: string[] = [];
    if (effObj.hasOwnProperty("play") && effObj.play.e !== "none") {
        r.push(i18n.effect.playCardHeader);
        r.push(effName(effObj.play));
    }
    return r.join("");
}
export const buyCardEffectText = (cardId: CardID): string => {
    let effObj = getCardEffect(cardId);
    let r: string[] = [];
    if (effObj.hasOwnProperty("buy") && effObj.buy.e !== "none") {
        r.push(i18n.effect.buyCardHeader);
        r.push(effName(effObj.buy));
    }
    return r.join("");

}
export const schoolEffectText = (cardId: CardID): string => {
    let effObj = getCardEffect(cardId);
    let r: string[] = [];
    if (effObj.hasOwnProperty("school")) {
        r.push(i18n.effect.continuous);
        r.push(i18n.effect.school(effObj.school));
        if (effObj.hasOwnProperty("response") && effObj.response.pre.e !== "none") {
            r.push(i18n.effect.extraEffect);
            if (effObj.response.pre.e === "multiple") {
                effObj.response.effect.forEach((singleEff: any) => {
                    r.push(effName(singleEff.pre))
                    r.push(effName(singleEff.effect))
                })
            } else {
                r.push(effName(effObj.response.pre));
                r.push(effName(effObj.response.effect));
            }
        }
    } else {
        if (effObj.hasOwnProperty("response") && effObj.response.hasOwnProperty("pre") && effObj.response.pre.e !== "none") {
            r.push(i18n.effect.responseHeader);
            r.push(effName(effObj.response.pre));
            r.push(effName(effObj.response.effect));
        }
    }
    return r.join("");
}
export const archiveCardEffectText = (cardId: CardID): string => {
    let effObj = getCardEffect(cardId);
    let r: string[] = [];
    if (effObj.hasOwnProperty("archive") && effObj.archive.e !== "none") {
        r.push(i18n.effect.breakthroughHeader);
        r.push(effName(effObj.archive));
    }
    return r.join("");

}
export const scoreEffectText = (cardId: CardID): string => {
    let effObj = getCardEffect(cardId);
    let r: string[] = [];
    if (effObj.hasOwnProperty("scoring")) {
        r.push(i18n.effect.scoringHeader);
        r.push(effName(effObj.scoring));
    }
    return r.join("");
}

export const effName = (eff: any): string => {
    switch (eff.e) {
        case "everyOtherCompany":
        case "everyPlayer":
        case "highestVpPlayer":
        case "vpNotHighestPlayer":
        case "optional":
        case "alternative":
        case "studio":
        case "noStudio":
            // @ts-ignore
            return i18n.effect[eff.e] + effName(eff.a);
        default:
            break;
    }
    if (eff.e === "pay") {
        return i18n.effect.pay + effName(eff.a.cost) + effName(eff.a.eff);
    }
    if (eff.e === "era") {
        let r = []
        for (let i = 0; i < 3; i++) {
            let sub = eff.a[i];
            if (sub.e === "none") continue;
            r.push(i18n.effect.era[i as 0 | 1 | 2]);
            r.push(effName(sub));
        }
        return r.join("");
    }
    if (eff.e === "step") {
        // @ts-ignore
        return eff.a.map(e => effName(e)).join("，");
    }
    if (eff.e === "choice") {
        let res = eff.a.map((e: any, idx: number) => "（" + (idx + 1).toString() + "）" + effName(e));
        res.unshift(i18n.effect.choice)
        return res.join("");
    }
    // @ts-ignore
    let name = i18n.effect[eff.e];
    if (typeof name === "string") {
        return name;
    } else {
        if (typeof eff.a === "number" || typeof eff.a === "string") {
            return name({a: eff.a});
        } else {
            return name(eff.a);
        }
    }
}
