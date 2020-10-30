import {
    B04,
    BasicCardID,
    BuildingType,
    CardCategory,
    CardID,
    cardsByCond,
    CardType,
    ClassicCardID,
    eventCardByEra,
    EventCardID,
    FilmCardID,
    filmCardsByEra,
    getCardById,
    getScoreCard,
    IBasicCard,
    IBuildingSlot,
    IBuyInfo,
    ICardSlot,
    ICost,
    IEra,
    INormalOrLegendCard,
    IPubInfo,
    ItrEffects,
    LegendCardCountInUse,
    NormalCardCountInUse,
    PersonCardID,
    Region,
    SchoolCardID,
    schoolCardsByEra,
    scoreCardCount,
    ScoreCardID,
    ShareOnBoard,
    SimpleRuleNumPlayers, TwoPlayerCardCount,
    validRegion,
    ValidRegions,
    VictoryType,
} from "../types/core";
import {IG} from "../types/setup";
import {Ctx, PlayerID} from "boardgame.io";
import {Stage} from "boardgame.io/core";
import {changePlayerStage, changeStage, signalEndStage, signalEndTurn} from "./logFix";
import {getCardEffect} from "../constant/effects";

const loggerN = {
    info: (log: string) => false,
    debug: (log: string) => false,
    error: (log: string) => false,
}
const loggerD = {
    info: (log: string) => console.log(`info|${log}`),
    debug: (log: string) => console.log(`debug|${log}`),
    error: (log: string) => console.log(`error|${log}`),
}
export const logger = loggerD;
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
        case "anyRegionShareCentral":
        case "playedCardInTurnEffect":
        case "alternative":
        case "competition":
        case "loseAnyRegionShare":
        case "anyRegionShare":
        case "noBuildingEE":
        case "vpNotHighestPlayer":
        case "highestVpPlayer":
        case "handToAnyPlayer":
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
        case "pay":
        case ItrEffects.archiveToEEBuildingVP:
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
    let pub = G.pub[parseInt(p)];
    let card: INormalOrLegendCard;
    const i = G.competitionInfo;
    switch (eff.e) {
        case "none":
        case "skipBreakthrough":
            return;
        case "shareToVp":
            addVp(G, ctx, p, pub.shares[eff.a as validRegion]);
            return;
        case "loseVpForEachHand":
            loseVp(G, ctx, p, G.player[parseInt(p)].hand.length);
            break;
        case "aestheticsToVp":
            addVp(G, ctx, p, pub.aesthetics);
            break;
        case "industryToVp":
            addVp(G, ctx, p, pub.industry)
            break;
        case "resFromIndustry":
            if (i.pending) {
                log += `|pendingCompetition`
                if (p === i.atk) {
                    log += `|atk`
                    i.progress += pub.industry;
                    log += `|${i.progress}`
                } else {
                    if (p === i.def) {
                        log += `|def`
                        i.progress -= pub.industry;
                        log += `|${i.progress}`
                    } else {
                        log += `|notCompetitionPlayer|${pub.resource}`
                        pub.resource += eff.a;
                        log += `|${pub.resource}`
                    }
                }
            } else {
                log += `|${pub.resource}`
                pub.resource += pub.industry;
                log += `|${pub.resource}`
            }
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
            loseShare(G, Region.NA, pub, eff.a);
            break;
        case "shareNA":
            getShare(G, Region.NA, pub, eff.a);
            break;

        case "loseShareWE":
            loseShare(G, Region.WE, pub, eff.a);
            break;
        case "shareWE":
            getShare(G, Region.WE, pub, eff.a);
            break;

        case "loseShareEE":
            loseShare(G, Region.EE, pub, eff.a);
            break;
        case "shareEE":
            getShare(G, Region.EE, pub, eff.a);
            break;

        case "loseShareASIA":
            loseShare(G, Region.ASIA, pub, eff.a);
            break;
        case "shareASIA":
            getShare(G, Region.ASIA, pub, eff.a);
            break;

        case "deposit":
            log += `|${pub.deposit}`
            pub.deposit += eff.a;
            log += `|${pub.deposit}`
            break;
        case "res":
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
                        log += `|notCompetitionPlayer|${pub.resource}`
                        pub.resource += eff.a;
                        log += `|${pub.resource}`
                    }
                }
            } else {
                log += `|${pub.resource}`
                pub.resource += eff.a;
                log += `|${pub.resource}`
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
            if (pub.aesthetics < 10) {
                log += `|${pub.aesthetics}`
                pub.aesthetics++;
                log += `|${pub.aesthetics}`
            } else {
                log += `|LV10CannotUpgrade`
            }
            break
        case "industryLevelUp":
            if (pub.industry < 10) {
                log += `|${pub.industry}`
                pub.industry++;
                log += `|${pub.industry}`
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
            const targetCard = getCardById(eff.a);
            if (
                pub.school === SchoolCardID.S3101
                && (targetCard.category === CardCategory.NORMAL
                || targetCard.category === CardCategory.LEGEND)
                && targetCard.type === CardType.F
            ) {
                log += `|newHollyWood`
                G.e.stack.push({
                    e: "optional", a: {
                        e: "pay", a: {
                            cost: {e: "deposit", a: 1},
                            eff: {e: "anyRegionShare", a: 1}
                        }
                    },
                    target: p,
                })
                doBuy(G, ctx, targetCard, p);
                log += `|execOptional`
                logger.debug(`${G.matchID}|${log}`);
                playerEffExec(G, ctx, p);
                return
            } else {
                doBuy(G, ctx, targetCard, p);
                break;
            }
        default:
            logger.error("Invalid effect" + JSON.stringify(eff));
            throw new Error(JSON.stringify(eff));
    }
    logger.debug(`${G.matchID}|${log}`);
}

export const doBuyToHand = (G: IG, ctx: Ctx, card: INormalOrLegendCard | IBasicCard, p: PlayerID): void => {
    const pub = G.pub[parseInt(p)];
    const playerObj = G.player[parseInt(p)];
    let log = `p${p}|doBuyToHand|${card.cardId}`
    if (pub.school === SchoolCardID.S2301 && card.region !== Region.EE) {
        log += `|SocialismRealism`
        if (pub.vp > 0) {
            loseVp(G, ctx, p, 1);
        }
    }
    if (card.category === CardCategory.BASIC) {
        log += `|basic`
        G.basicCards[card.cardId as BasicCardID] -= 1;
        log += `|${G.basicCards[card.cardId as BasicCardID]}left`
    } else {
        let slot = cardSlotOnBoard(G, ctx, card);
        if (slot === null) {
            throw new Error("Cannot buy card off board!");
        } else {
            slot.card = null;
            if (slot.comment !== null) {
                playerObj.hand.push(slot.comment);
                pub.allCards.push(slot.comment);
                slot.comment = null;
            }
            doReturnSlotCard(G, ctx, slot);
        }
    }
    playerObj.hand.push(card.cardId);
    pub.allCards.push(card.cardId)
    logger.debug(`${G.matchID}|${log}`);
}

export const doBuy = (G: IG, ctx: Ctx, card: INormalOrLegendCard | IBasicCard, p: PlayerID): void => {
    let pub = G.pub[parseInt(p)];
    let log = `doBuy|${card.cardId}|p${p}`
    if (pub.school === SchoolCardID.S2301 && card.region !== Region.EE) {
        log += `|SocialismRealism`
        if (pub.vp > 0) {
            loseVp(G, ctx, p, 1);
        }
    }
    if (card.category === CardCategory.BASIC) {
        let count = G.basicCards[card.cardId as BasicCardID];
        if (count > 0) {
            G.basicCards[card.cardId as BasicCardID] -= 1;
            pub.discard.push(card.cardId);
            pub.allCards.push(card.cardId);
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
                pub.discard.push(slot.comment);
                pub.allCards.push(slot.comment);
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
                    pub.shares[region] += share;
                } else {
                    pub.shares[region] += G.regions[region].share;
                    G.regions[region].share = 0;
                }
            }

        }
        if (card.type === CardType.S) {
            log += `|buySchool`
            let school = pub.school;
            const kino = schoolPlayer(G, ctx, SchoolCardID.S1303);
            log += `|kinoPlayer|${JSON.stringify(kino)}`
            if (kino !== null && p !== kino) {
                log += `|p${kino}|KinoEyes`
                addVp(G, ctx, kino, 1);
                G.pub[parseInt(kino)].deposit++;
            }
            if (school !== null) {
                log += `|hasSchool`
                if (school === SchoolCardID.S1203) {
                    if (pub.aesthetics < 10) {
                        log += `|Expressionism`
                        pub.aesthetics++;
                    }
                }
                log += `|archive|${school}`
                pub.archive.push(school);
            }
            pub.school = card.cardId as SchoolCardID;
        } else {
            log += `|pushToDiscard`
            pub.discard.push(card.cardId);
        }
        pub.allCards.push(card.cardId);
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

export const initialPosOfPlayer = (G: IG, ctx: Ctx, p: PlayerID): number => {
    return G.initialOrder.indexOf(p);
}
export const posOfPlayer = (G: IG, ctx: Ctx, p: PlayerID): number => {
    return G.order.indexOf(p);
}

export const checkRegionScoring = (G: IG, ctx: Ctx, r: Region): boolean => {
    if (r === Region.NONE) return false;
    return !G.regions[r].completedModernScoring && (cardDepleted(G, ctx, r) || shareDepleted(G, ctx, r));
}

export const seqFromPos = (G: IG, ctx: Ctx, pos: number): PlayerID[] => {
    let log = `seqFromPos`;
    let seq = [];
    const remainPlayers = G.order.length
    for (let i = pos; i < remainPlayers; i++) {
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
    log += `|seq:${JSON.stringify(seq)}`
    logger.debug(`${G.matchID}|${log}`);
    return seq;
}

export const seqFromCurrentPlayer = (G: IG, ctx: Ctx): PlayerID[] => {
    let log = `seqFromCurrentPlayer`
    log += `|cur|p${ctx.currentPlayer}`
    let pos = posOfPlayer(G, ctx, ctx.currentPlayer);
    let seq = seqFromPos(G, ctx, pos);
    log += `|seq:${JSON.stringify(seq)}`
    logger.debug(`${G.matchID}|${log}`);
    return seq;
}

export const industryHighestPlayer = (G: IG): PlayerID[] => {
    let log = "industryHighestPlayer"
    let highest = 0;
    let result: PlayerID[] = [];
    G.order.forEach(i => {
        if (G.pub[parseInt(i)].industry > highest) highest = G.pub[parseInt(i)].industry
    })
    log += `|highest|${highest}`
    G.order.forEach(i => {
        if (G.pub[parseInt(i)].industry === highest) {
            log += `|p${i}|${G.pub[parseInt(i)].industry}|highest`
            result.push(i)
        }
    })
    log += `|result|${result}`
    logger.debug(`${G.matchID}|${log}`);
    return result;
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

export const getLevelMarkCount = (G: IG, p: PlayerID): number => {
    let log = `getLevelMarkCount|p${p}`
    const pub = G.pub[parseInt(p)];
    let result = pub.aesthetics + pub.industry
    const school = pub.school;
    if (school === null) {
        log += `|noSchool|${result}`
        logger.debug(`${G.matchID}|${log}`);
        return result;
    } else {
        log += `|school${school}`
        const schoolCard = getCardById(school);
        result += schoolCard.aesthetics;
        result += schoolCard.industry;
        log += `|${result}`
    }
    logger.debug(`${G.matchID}|${log}`);
    return result
}

export const levelAndMarkLowestPlayer = (G: IG): PlayerID[] => {
    return lowest(G, getLevelMarkCount);
}

export const getSchoolHandLimit = (G: IG, p: PlayerID): number => {
    const school = G.pub[parseInt(p)].school
    if (school === null) {
        return 4;
    } else {
        return getCardEffect(school).school.hand;
    }
}


export const schoolHandLowestPlayer = (G: IG): PlayerID[] => {
    return lowest(G, getSchoolHandLimit);
}
export const aesHighestPlayer = (G: IG): PlayerID[] => {
    return highestPlayer(G, (G, i) => G.pub[parseInt(i)].aesthetics);
}
export const aesLowestPlayer = (G: IG): PlayerID[] => {
    return lowest(G, (G, i) => G.pub[parseInt(i)].aesthetics);
}

export function vpNotHighestPlayer(G: IG): PlayerID[] {
    return notHighestPlayer(G, (G, i) => G.pub[parseInt(i)].vp);
}

export function lowest(G: IG, func: (G: IG, p: PlayerID) => number): PlayerID[] {
    let log = "lowest"
    const metrics: number[] = [];
    const result: PlayerID[] = [];
    let lowestMetric = func(G, G.order[0]);
    G.order.forEach((i) => {
        const metric = func(G, i);
        if (metric < lowestMetric) {
            log += `|p${i}|${metric}`
            lowestMetric = metric;
        }
        metrics.push(metric);
    })
    log += `|lowest|${lowestMetric}`
    G.order.forEach((i, idx) => {
        const m = metrics[idx];
        if (m === lowestMetric) {
            log += `|p${i}lowest`
            result.push(i);
        }
    })
    log += `|result|${JSON.stringify(result)}`
    logger.debug(`${G.matchID}|${log}`);
    return result;
}

export function notHighestPlayer(G: IG, func: (G: IG, p: PlayerID) => number): PlayerID[] {
    let log = "notHighestPlayer"
    const metrics: number[] = [];
    const result: PlayerID[] = [];
    let highestMetric = 0;
    G.order.forEach((i) => {
        const metric = func(G, i);
        log += `|p${i}|${metric}`
        if (metric > highestMetric) {
            highestMetric = metric;
        }
        metrics.push(metric);
    })
    log += `|highest|${highestMetric}`
    G.order.forEach((i, idx) => {
        const m = metrics[idx];
        if (m !== highestMetric) {
            log += `|p${i}notHighest`
            result.push(i);
        }
    })
    logger.debug(`${G.matchID}|${log}`);
    return result;
}

export function highestPlayer(G: IG, func: (G: IG, p: PlayerID) => number): PlayerID[] {
    let log = "highestPlayer"
    const metrics: number[] = [];
    const result: PlayerID[] = [];
    let highestMetric = 0;
    G.order.forEach((i) => {
        const metric = func(G, i);
        log += `|p${i}|${metric}`
        if (metric > highestMetric) {
            highestMetric = metric;
        }
        metrics.push(metric);
    })
    log += `|highest|${highestMetric}`
    G.order.forEach((i, idx) => {
        const m = metrics[idx];
        if (m === highestMetric) {
            log += `|p${i}highest`
            result.push(i);
        }
    })
    logger.debug(`${G.matchID}|${log}`);
    return result;
}

export function vpHighestPlayer(G: IG): PlayerID[] {
    return highestPlayer(G, (G, p) => G.pub[parseInt(p)].vp)
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
    let c = getCardById(card)
    let log = `startBreakThrough|p${pid}|${card}`
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
            const eff = {...cardEff.archive};
            if (eff.e !== "none") {
                eff.target = pid;
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

export const pushPlayersEffects = (G: IG, players: PlayerID[], eff: any) => {
    let log = `pushPlayersEffects|players|${JSON.stringify(players)}`
    for (let p of players) {
        const targetEff = {...eff, target: p};
        G.e.stack.push(targetEff);
    }
    log += `|${JSON.stringify(G.e.stack)}`
    logger.debug(`${G.matchID}|${log}`);
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
    let length = 0;
    const handLength = playerObj.hand.length;
    let subEffect;
    let extraCost = 0
    const totalRes = pub.resource + pub.deposit;
    switch (eff.e) {
        case "playedCardInTurnEffect":
            if (pub.playedCardInTurn.filter(c => getCardById(c).aesthetics > 0).length > 0) {
                log += `|chooseHand`
                changePlayerStage(G, ctx, "chooseHand", p);
                return;
            }
            log += `|noAesMarkCardPlayed`
            break;
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
            let era;
            if (ctx.numPlayers > SimpleRuleNumPlayers) {
                log += `|not2p`
                era = G.regions[region].era;
            } else {
                log += `|2p`
                era = G.twoPlayer.era;
            }
            log += `|era|${era}`
            G.e.stack.push(eff.a[era]);
            log += `|era|${JSON.stringify(G.e.stack)}`
            break;
        case "breakthroughResDeduct":
            if (handLength > 0) {
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
            if (ctx.numPlayers > SimpleRuleNumPlayers) {
                players = seqFromCurrentPlayer(G, ctx);
                let ownIndex = players.indexOf(p)
                if (ownIndex !== -1) {
                    players.splice(ownIndex, 1)
                }
                G.c.players = players;
                G.e.stack.push(eff)
                log += `|chooseTarget`
                logger.debug(`${G.matchID}|${log}`);
                changePlayerStage(G, ctx, "chooseTarget", p);
                return;
            } else {
                G.competitionInfo.progress = eff.a.bonus;
                G.competitionInfo.onWin = eff.a.onWin;
                log += `|startCompetition`
                logger.debug(`${G.matchID}|${log}`);
                const opponent2p = p === '0' ? '1' : '0';
                startCompetition(G, ctx, p, opponent2p);
                return;
            }
        case "loseAnyRegionShare":
            G.e.regions = ValidRegions.filter(r => pub.shares[r] > 0)
            log += `|${JSON.stringify(G.e.regions)}`
            if (G.e.regions.length === 0) {
                ctx?.events?.endStage?.()
                log += `|endStage`
                break;
            } else {
                G.e.stack.push(eff)
                changePlayerStage(G, ctx, "chooseRegion", p);
                return;
            }
        case "anyRegionShareCentral":
            G.e.regions = ValidRegions.filter(r => G.regions[r].share > 0)
            if (G.e.regions.length === 0) {
                log += "No share on board, cannot obtain from others."
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
                    log += "No share on board, cannot obtain from others."
                    logger.debug(`${G.matchID}|${log}`);
                    break;
                } else {
                    G.e.stack.push(eff)
                    changePlayerStage(G, ctx, "chooseRegion", p);
                    return;
                }
            }
        case "handToAnyPlayer":
            log += `|handToAnyPlayer`
            players = seqFromCurrentPlayer(G, ctx);
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
            log += `|peek|${peekCount}cards`
            let deck = G.secretInfo.playerDecks[curPid(G, ctx)];
            log += `|deck|${JSON.stringify(deck)}`
            log += `|hand${JSON.stringify(playerObj.hand)}`
            log += `|discard|${JSON.stringify(pub.discard)}`
            if(deck.length === 0){
                log += `|noCardInDeck`
                log += `|afterDeck|${JSON.stringify(deck)}`
                log += `|afterHand${JSON.stringify(playerObj.hand)}|afterDiscard|${JSON.stringify(pub.discard)}`
                break;
            }
            const totalRemainCards = length + pub.discard.length
            const newEffect = {...eff}
            if (newEffect.a.filter.e === "choice" && newEffect.a.filter.a > totalRemainCards) {
                log += `|noEnoughCardToChoose`
                newEffect.a.filter.a = totalRemainCards;
            }
            if(length < peekCount){
                log += `|fetchRemainDeck|${JSON.stringify(deck)}`
                playerObj.cardsToPeek = [...deck];
                log += `|deckInsufficient|shuffle`
                const shuffledDiscard = shuffle(ctx, pub.discard);
                pub.discard = [];
                G.secretInfo.playerDecks[curPid(G, ctx)] = [...shuffledDiscard]
                log += `|total|${totalRemainCards}`
                if (totalRemainCards < peekCount) {
                    log += `|noEnoughCardsToPeek`
                    peekCount = totalRemainCards
                }
                const remainDrawCount = peekCount - length;
                log += `|${remainDrawCount}cardsRemaining`
                for (let i = 0; i < remainDrawCount; i++) {
                    let newCardId = deck.pop();
                    if (newCardId === undefined) {
                        throw Error("Should have card in deck");
                    }
                    log += `|draw|${newCardId}`
                    playerObj.cardsToPeek.push(newCardId);
                }
                log += `|refDeck|${JSON.stringify(deck)}`
                log += `|deck|${JSON.stringify(G.secretInfo.playerDecks[curPid(G, ctx)])}`
            }else{
                for (let i = 0; i < peekCount; i++) {
                    let newCardId = deck.pop();
                    log += `|${newCardId}`
                    if (newCardId === undefined) {
                        if(deck.length === 0){
                            log += `|noCardInDeck`
                            log += `|afterDeck|${JSON.stringify(deck)}`
                            log += `|afterHand${JSON.stringify(playerObj.hand)}|afterDiscard|${JSON.stringify(pub.discard)}`
                            log += `|push${JSON.stringify(newEffect)}`
                            G.e.stack.push(newEffect)
                            logger.debug(`${G.matchID}|${log}`);
                            changePlayerStage(G, ctx, "peek", p);
                            return;
                        }else {
                            log += `|cannotDrawFromDeck|${JSON.stringify(deck)}`
                            if(pub.discard.length === 0 ){
                                log += `|noCardInDiscard`
                                log += `|afterDeck|${JSON.stringify(deck)}`
                                log += `|afterHand${JSON.stringify(playerObj.hand)}|afterDiscard|${JSON.stringify(pub.discard)}`
                                log += `|push${JSON.stringify(newEffect)}`
                                G.e.stack.push(newEffect)
                                logger.debug(`${G.matchID}|${log}`);
                                changePlayerStage(G, ctx, "peek", p);
                                return;
                            }else {
                                newCardId = pub.discard.pop();
                                if(newCardId === undefined){
                                    log += `|cannotDrawFromDiscard|${JSON.stringify(pub.discard)}`
                                    log += `|afterDeck|${JSON.stringify(deck)}`
                                    log += `|afterHand${JSON.stringify(playerObj.hand)}|afterDiscard|${JSON.stringify(pub.discard)}`
                                    log += `|push${JSON.stringify(newEffect)}`
                                    G.e.stack.push(newEffect)
                                    logger.debug(`${G.matchID}|${log}`);
                                    changePlayerStage(G, ctx, "peek", p);
                                    return;
                                }
                            }
                        }
                    }
                    playerObj.cardsToPeek.push(newCardId);
                }
            }
            log += `|afterDeck|${JSON.stringify(deck)}`
            log += `|afterHand${JSON.stringify(playerObj.hand)}|afterDiscard|${JSON.stringify(pub.discard)}`
            log += `|push${JSON.stringify(newEffect)}`
            G.e.stack.push(newEffect)
            logger.debug(`${G.matchID}|${log}`);
            changePlayerStage(G, ctx, "peek", p);
            return;
        case "noBuildingEE":
            players = noBuildingPlayers(G, ctx, Region.EE);
            pushPlayersEffects(G, players, eff.a);
            break;
        case "vpNotHighestPlayer":
            players = vpNotHighestPlayer(G);
            pushPlayersEffects(G, players, eff.a);
            break;
        case "highestVpPlayer":
            players = vpHighestPlayer(G);
            pushPlayersEffects(G, players, eff.a);
            break;
        case "levelAndMarkLowestPlayer":
            players = levelAndMarkLowestPlayer(G);
            pushPlayersEffects(G, players, eff.a);
            break;
        case "aesHighest":
            players = aesHighestPlayer(G);
            pushPlayersEffects(G, players, eff.a);
            break;
        case "aesLowest":
            players = aesLowestPlayer(G);
            pushPlayersEffects(G, players, eff.a);
            break;
        case "industryHighest":
            players = industryHighestPlayer(G);
            pushPlayersEffects(G, players, eff.a);
            break;
        case "industryLowest":
            players = industryLowestPlayer(G);
            pushPlayersEffects(G, players, eff.a);
            break;
        case "studio":
            players = studioPlayers(G, ctx, region);
            pushPlayersEffects(G, players, eff.a);
            break;
        case "buildingNA":
            players = buildingPlayers(G, ctx, Region.NA);
            pushPlayersEffects(G, players, eff.a);
            break;
        case "everyOtherCompany":
            players = seqFromCurrentPlayer(G, ctx);
            players.shift()
            pushPlayersEffects(G, players, eff.a);
            break;
        case "everyPlayer":
            players = seqFromCurrentPlayer(G, ctx);
            pushPlayersEffects(G, players, eff.a);
            break;
        case "noStudio":
            players = seqFromCurrentPlayer(G, ctx);
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
        case "step":
            log += ("|step")
            length = eff.a.length;
            for (let i = length - 1; i >= 0; i--) {
                subEffect = {...eff.a[i]};
                if (eff.hasOwnProperty("target")) {
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
                getCardById(i).category !== CardCategory.BASIC &&
                getCardById(i).category !== CardCategory.SCORE
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
    let log = `industryAward|p${p}|${o.industry}`
    if (o.industry > 1) {
        log += `|before|${o.resource}`
        o.resource += 1
        log += `|after|${o.resource}`
    }
    if (o.industry > 4) {
        drawCardForPlayer(G, ctx, p);
    }
    if (o.industry > 7) {
        drawCardForPlayer(G, ctx, p);
    }
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
    let log = `drawForTwoPlayerEra|era${e + 1}`
    let school = schoolCardsByEra(e).map(c => c.cardId);
    let filmCards = filmCardsByEra(e).map(c => c.cardId);
    const schoolDeckSize: number = TwoPlayerCardCount[e].school;
    const filmDeckSize: number = TwoPlayerCardCount[e].film;
    G.secretInfo.twoPlayer.school = shuffle(ctx, school).slice(0, schoolDeckSize);
    G.secretInfo.twoPlayer.film = shuffle(ctx, filmCards).slice(0, filmDeckSize);
    log += `|school|${schoolDeckSize}${JSON.stringify(G.secretInfo.twoPlayer.school)}`
    log += `|film|${filmDeckSize}|${JSON.stringify(G.secretInfo.twoPlayer.film)}`
    for (let s of G.twoPlayer.film) {
        let c = G.secretInfo.twoPlayer.film.pop();
        if (c === undefined) {
            throw new Error(c);
        } else {
            log += `|pop|${c}`;
            s.card = c;
        }
    }
    for (let s of G.twoPlayer.school) {
        let c = G.secretInfo.twoPlayer.school.pop();
        if (c === undefined) {
            throw new Error(c);
        } else {
            log += `|pop|${c}`;
            s.card = c;
        }
    }
    logger.debug(`${G.matchID}|${log}`);
}

export const drawForRegion = (G: IG, ctx: Ctx, r: Region, e: IEra): void => {
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
    const pid = parseInt(id);
    let log = `drawCardForPlayer${id}`
    const p = G.player[pid]
    const pub = G.pub[pid]
    let s = G.secretInfo.playerDecks[pid]
    if (s.length === 0) {
        G.secretInfo.playerDecks[pid] = shuffle(ctx, pub.discard);
        log += `|shuffledDeck|${JSON.stringify(s)}`
        pub.discard = [];
    }
    let card = G.secretInfo.playerDecks[pid].pop();
    if (card === undefined) {
        log += `|deckEmpty`
    } else {
        log += `|${card}`
        p.hand.push(card);
    }
    logger.debug(`${G.matchID}|${log}`);
}
export const fillPlayerHand = (G: IG, ctx: Ctx, p: PlayerID): void => {
    let log = `p${p}|fillPlayerHand`
    const limit = getSchoolHandLimit(G, p);
    log += `|limit${limit}`
    let handCount: number = G.player[parseInt(p)].hand.length;
    log += `|hand${handCount}`
    if (handCount < limit) {
        let drawCount: number = limit - handCount;
        log += `|draw${drawCount}`
        for (let t = 0; t < drawCount; t++) {
            drawCardForPlayer(G, ctx, p);
        }
    } else {
        log += `|doNotDraw`
    }
    logger.debug(`${G.matchID}|${log}`);
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
        log += `${JSON.stringify(d)}`;
    } else {
        log += `|simpleRule`
        if (getCardById(slot.card).type === CardType.S) {
            log += `|school`
            d = G.secretInfo.twoPlayer.school as unknown as ClassicCardID[];
        } else {
            log += `|film`
            d = G.secretInfo.twoPlayer.film;
        }
        log += `${JSON.stringify(d)}`;
    }
    let oldCard = slot.card;
    log += `|return${oldCard}`
    if (oldCard !== null) {
        d.unshift(oldCard);
        log += `|putToBottom|${JSON.stringify(d)}`;
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
            G.pub[0].shares[r] = 0;
            G.pub[1].shares[r] = 0;
            G.regions[r].share = ShareOnBoard[r][IEra.THREE];
            G.regions[r].completedModernScoring = true;
            let scoreCard = getScoreCard(r, IEra.THREE, 1)
            G.pub[firstPlayer].discard.push(scoreCard.cardId as ScoreCardID);
            G.pub[firstPlayer].allCards.push(scoreCard.cardId as ScoreCardID);
        }
    })
    if (
        G.twoPlayer.film.every(c => c.card === null)
        && initialPosOfPlayer(G, ctx, ctx.currentPlayer) === 1
    ) {
        ValidRegions.forEach(r => {
            if (G.pub[0].shares[r] > G.pub[1].shares[r]) {
                doBuy(G, ctx, B04, '1')
            }
            if (G.pub[0].shares[r] < G.pub[1].shares[r]) {
                doBuy(G, ctx, B04, '0')
            }
            G.pub[0].shares[r] = 0;
            G.pub[1].shares[r] = 0;
            G.regions[r].share = ShareOnBoard[r][IEra.THREE];
        })
        const era = G.twoPlayer.era;
        let newEra = era;
        if (era === IEra.ONE) {
            newEra = IEra.TWO
        }
        if (era === IEra.TWO) {
            newEra = IEra.THREE
        }
        if (era !== newEra) {
            G.twoPlayer.era = newEra;
            for (let schoolSlot of G.twoPlayer.school) {
                doReturnSlotCard(G, ctx, schoolSlot)
            }
            for (let filmSlot of G.twoPlayer.school) {
                doReturnSlotCard(G, ctx, filmSlot)
            }
            drawForTwoPlayerEra(G, ctx, newEra)
            signalEndTurn(G, ctx);
            return;
        } else {
            finalScoring(G, ctx);
            return
        }
    } else {
        fillTwoPlayerBoard(G, ctx);
        signalEndTurn(G, ctx);
        return;
    }

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
            initialPosOfPlayer(G, ctx, ctx.currentPlayer)
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

export const passCompensateMarker = (G: IG) => {
    let log = `passCompensateMarker`
    const markPos = G.order.indexOf(G.regionScoreCompensateMarker);
    log += `|p${G.regionScoreCompensateMarker}|markPos|${markPos}`
    if (markPos > 0) {
        G.regionScoreCompensateMarker = G.order[markPos - 1];
        log += `|passTo|p${G.regionScoreCompensateMarker}|${markPos - 1}`
    } else {
        G.regionScoreCompensateMarker = G.order[G.order.length - 1];
        log += `|passTo|p${G.regionScoreCompensateMarker}|${G.order.length - 1}`
    }
    logger.debug(`${G.matchID}|${log}`);
}

export const regionRank = (G: IG, ctx: Ctx, r: Region): void => {
    if (r === Region.NONE) return;
    let era = G.regions[r].era;
    let log = `regionRank|${r}|${era}`
    let compensateMarkerUsed = false;
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
        const legendCountA = legendCount(G, ctx, r, era, a);
        const legendCountB = legendCount(G, ctx, r, era, b);
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
            log += `|pos|p${b}win`
            logger.debug(`${G.matchID}|${log}`);
            return 1;
        } else {
            if (posA < posB) {
                log += `|pos|p${a}win`
                logger.debug(`${G.matchID}|${log}`);
                return -1;
            } else {
                throw Error("Two player cannot have the same position.")
            }
        }
    }
    let rankingPlayer: PlayerID[] = [];
    G.order.forEach((i, idx) => {
        log += `|p${idx}|share${G.pub[idx].shares[r]}`
        if (G.pub[idx].shares[r] === 0) {
            log += "|badFilm"
            doBuy(G, ctx, B04, idx.toString())
        } else {
            log += `|rank`
            rankingPlayer.push(idx.toString())
        }
    });
    let rankResult = rankingPlayer.sort(rank);
    if (compensateMarkerUsed) {
        passCompensateMarker(G);
    }
    log += `|rankResult|${rankResult}`;
    let firstPlayer: PlayerID = rankResult[0];
    log += `|firstPlayer:${firstPlayer}`
    logger.debug(`${G.matchID}|${log}`);
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
        if (ctx.numPlayers === 3) {
            G.regions[Region.ASIA].share--;
        }
    }
    log += "|tryScoring"
    logger.debug(`${G.matchID}|${log}`);
    tryScoring(G, ctx);
}

export const regionScoringCheck = (G: IG, ctx: Ctx, arg: PlayerID) => {
    let log = `regionScoringCheck|${arg}`
    ValidRegions.forEach(r => {
        if (r === Region.ASIA && G.regions[Region.ASIA].era === IEra.ONE) return;
        const canScore = checkRegionScoring(G, ctx, r);
        if (canScore) {
            G.scoringRegions.push(r)
        }
    })
    log += `|scoreRegions|${JSON.stringify(G.scoringRegions)}`
    if (ctx.numPlayers > SimpleRuleNumPlayers) {
        log += "|tryScoring"
        logger.debug(`${G.matchID}|${log}`);
        tryScoring(G, ctx);
    } else {
        log += "|try2pScoring"
        logger.debug(`${G.matchID}|${log}`);
        try2pScoring(G, ctx);
    }
    log += `|noRegionsToScore`
    logger.debug(`${G.matchID}|${log}`);
}
export const endTurnEffect = (G: IG, ctx: Ctx, arg: PlayerID) => {
    let log = `endTurnEffect|p${arg}`
    const pub = G.pub[parseInt(arg)]
    pub.playedCardInTurn.forEach(c => pub.discard.push(c));
    pub.playedCardInTurn = [];
    pub.revealedHand = [];
    pub.resource = 0;
    if (pub.deposit > 10) {
        log += `|depositLimitExceeded|${pub.deposit}`
        pub.deposit = 10;
    }

    log += `|restore`
    if (pub.school !== null) {
        let schoolId = pub.school;
        log += `|school|${schoolId}`
        let act = getCardEffect(schoolId).school.action;
        if (act === 1) {
            if (G.activeEvents.includes(EventCardID.E03)) {
                log += `|Avant-Grade|2ap`
                pub.action = 2
            } else {
                log += `|1ap`
                pub.action = 1
            }
        } else {
            log += `|${act}ap`
            pub.action = act;
        }
    } else {
        if (G.activeEvents.includes(EventCardID.E03)) {
            log += `|Avant-Grade|2ap`
            pub.action = 2
        } else {
            log += `|1ap`
            pub.action = 1
        }
    }
    fillPlayerHand(G, ctx, ctx.currentPlayer);
    log += `| execute development rewards`
    log += `|aesAward`
    aesAward(G, ctx, ctx.currentPlayer);
    log += `|industryAward`
    industryAward(G, ctx, ctx.currentPlayer);
    logger.debug(`${G.matchID}|${log}`);
}

export function checkNextEffect(G: IG, ctx: Ctx) {
    let log = "checkNextEffect";
    if (G.e.stack.length === 0) {
        log += ("|stackEmpty")
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
                if (G.player[parseInt(ctx.currentPlayer)].endTurnEffectExecuted) {
                    log += `|endTurnEffectExecuted`
                    G.player[parseInt(ctx.currentPlayer)].endTurnEffectExecuted = false
                    regionScoringCheck(G, ctx, ctx.currentPlayer);
                    logger.debug(`${G.matchID}|${log}`);
                    return
                } else {
                    if (ctx.activePlayers !== null) {
                        log += "|signalEndStage"
                        signalEndStage(G, ctx);
                        logger.debug(`${G.matchID}|${log}`);
                        return;
                    } else {
                        log += `|notInStage`
                        logger.debug(`${G.matchID}|${log}`);
                    }
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
        if (nextEff.hasOwnProperty("target")) {
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
    if (obj.vp >= 40 && !obj.vpAward.v60) {
        log += `|v40`
        count++;
        obj.vpAward.v60 = true;
    }
    if (obj.vp >= 80 && !obj.vpAward.v90) {
        log += `|v80`
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
    let log = `p${p}|loseDeposit|${deposit}`
    let pub = G.pub[parseInt(p)];
    log += `|before|${pub.deposit}`
    if (deposit >= pub.deposit) {
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
    if (vp >= pub.vp) {
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
            if (i.onWin.e === "anyRegionShareCentral") {
                log += `|moreShare${i.onWin.a}|playerEffExec|p${winner}`
                G.e.stack.push({
                    e: "anyRegionShare", a: 1
                })
                G.e.stack.push({...i.onWin})
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
        if (cinemaInRegion(G, ctx, i.region, i.atk)) {
            log += `|cinemaInRegion|${i.region}|${i.progress}`
            i.progress++;
            log += `|${i.progress}`
            addVp(G, ctx, i.atk, 1);
        }
        const cardEff = getCardEffect(cardId);
        if (cardEff.hasOwnProperty("play")) {
            const eff = {...cardEff.play};
            if (eff.e !== "none") {
                eff.target = i.atk;
                log += `|${JSON.stringify(eff)}`
                G.e.stack.push(eff)
            } else {
                log += `|emptyPlayEffect`
            }
        } else {
            log += `|noPlayEffect`
        }
        G.e.card = cardId;
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
        const cardEff = getCardEffect(cardId);
        if (cardEff.hasOwnProperty("play")) {
            const eff = {...cardEff.play};
            if (eff.e !== "none") {
                eff.target = i.def;
                log += `|${JSON.stringify(eff)}`
                G.e.stack.push(eff)
            } else {
                log += `|emptyPlayEffect`
            }
        } else {
            log += `|noPlayEffect`
        }
        G.player[parseInt(i.def)].competitionCards = [];
        if (cinemaInRegion(G, ctx, i.region, i.def)) {
            log += `|cinemaInRegion|${i.region}|${i.progress}`
            i.progress--;
            log += `|${i.progress}`
            addVp(G, ctx, i.atk, 1);
        }
        logger.debug(`${G.matchID}|${log}`);
        checkNextEffect(G, ctx);
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
    let log = `nextEra|${r}|era:${era}`
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
    for (let i = 0; i < G.order.length; i++) {
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
        doReturnSlotCard(G, ctx, region.legend);
        for (let slot of region.normal) {
            doReturnSlotCard(G, ctx, slot)
        }
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
    let validID = [...G.secretInfo.playerDecks[i], ...p.discard, ...s.hand, ...p.playedCardInTurn]
    let validCards = validID.map(c => getCardById(c));
    validCards.forEach(c => {
        f.card += c.vp
    });
    if (p.building.cinemaBuilt) f.building += 3;
    if (p.building.studioBuilt) f.building += 3;
    if (p.industry === 10) {
        G.order.forEach(j => {
            let each = G.pub[parseInt(j)];
            if (each.building.cinemaBuilt) f.industryAward += 5;
            if (each.building.studioBuilt) f.industryAward += 5;
        })
    }
    if (p.aesthetics === 10) {
        f.aestheticsAward += Math.round(p.vp / 5);
    }
    ValidRegions.forEach(r => {
        let championCount = p.champions.filter(c => c.region === r).length;
        f.archive += p.archive.filter(card => getCardById(card).region === r).length * championCount;
    });
    if (validID.includes(PersonCardID.P3102)) {
        f.events += validCards.filter(c => c.industry > 0)
            .filter(c => c.category === CardCategory.LEGEND || c.category === CardCategory.NORMAL)
            .length * 2
    }
    if (validID.includes(PersonCardID.P3106)) {
        f.events += validCards.filter(c => c.region === Region.NA)
            .length * 2
    }
    if (validID.includes(PersonCardID.P3402)) {
        f.events += validCards.filter(c => c.region === Region.ASIA)
            .length * 2
    }
    if (validID.includes(PersonCardID.P3107)) {
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

export const schoolPlayer = (G: IG, ctx: Ctx, cardId: CardID): PlayerID | null => {
    let log = `schoolPlayer|${cardId}`
    let player = null
    G.order.forEach(p => {
        log += `|${p}`
        if (G.pub[parseInt(p)].school === cardId) {
            log += `|kino`
            player = p;
        } else {
            log += `|notKino`
        }
    })
    log += `|result|${player}`
    logger.debug(`${G.matchID}|${log}`);
    return player;
}

export const rank = (G: IG, ctx: Ctx, p1: number, p2: number, addLog: boolean = false): number => {
    let log = `rank|p${p1}|p${p2}`
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
            const pos1 = initialPosOfPlayer(G, ctx, p1.toString());
            const pos2 = initialPosOfPlayer(G, ctx, p2.toString());
            log += `|initialPos|${pos1}|${pos2}`
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
    for (let i = 0; i < G.order.length; i++) {
        getExtraScoreForFinal(G, ctx, i.toString());
        pid.push(i);
    }
    const rankFunc = (a: number, b: number) => rank(G, ctx, a, b, true);
    let finalRank = pid.sort(rankFunc);
    ctx?.events?.endGame?.({
        winner: finalRank[0].toString(),
        reason: VictoryType.finalScoring,
    })
}

export default cleanUpScore;
