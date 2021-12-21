import {
    AvantGradeAP,
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
    GameMode,
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
    SimpleEffectNames,
    SimpleRuleNumPlayers,
    TwoPlayerCardCount,
    valid_regions,
    ValidRegion,
    VictoryType,
} from "../types/core";
import {IG} from "../types/setup";
import {Ctx, PlayerID} from "boardgame.io";
import {Stage} from "boardgame.io/core";
import {changePlayerStage, changeStage, signalEndStage, signalEndTurn} from "./logFix";
import {getCardEffect} from "../constant/effects";
import {logger} from "./logger";

export const curPid = (G: IG, ctx: Ctx): number => {
    return parseInt(ctx.currentPlayer);
}

export const commentBasicCardDepleted = (G: IG): boolean => {
    return G.basicCards["B04"] === 0
        && G.basicCards["B01"] === 0
        && G.basicCards["B02"] === 0
        && G.basicCards["B03"] === 0
}

export const wholeBoardDepleted = (G: IG): boolean => {
    if (G.playerCount > SimpleRuleNumPlayers) {
        return valid_regions.every(r => noRegionCardOnBoard(G, r));
    } else {
        return G.twoPlayer.film.every(s => s.card === null)
            && G.twoPlayer.school.every(s => s.card === null);
    }
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

export const die = (ctx: Ctx, faces: number): number => {
    return ctx.random?.Die(faces) || faces;
}

export const shuffle = (ctx: Ctx, arg: any[]): any[] => {
    return ctx.random?.Shuffle(arg) || arg;
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
    const log = [`isSimpleEffect|${eff.e}`];
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
        case "discardBasic":
        case "discardLegend":
        case "discardIndustry":
        case "discardAesthetics":
        case "discardNormalOrLegend":
        case "choice":
        case "update":
        case "comment":
        case "optional":
        case "pay":
        case ItrEffects.archiveToEEBuildingVP:
            log.push(`|false`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return false;
        default:
            log.push(`|true`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return true;
    }
}

export const playerLoseShare = (G: IG, r: ValidRegion, p: PlayerID, num: number) => {
    const log = [`playerLoseShare|p${p}|region${r}|num:${num}`];
    const playerIdNum = parseInt(p);
    const shareCount = G.pub[playerIdNum].shares[r];
    const boardShareCount = G.regions[r].share;
    log.push(`|region${r}share${shareCount}`);
    log.push(`|beforeLose|${G.pub[playerIdNum].shares[r]}|${G.regions[r].share}`);
    if (shareCount > num) {
        G.pub[playerIdNum].shares[r] = shareCount - num;
        G.regions[r].share = boardShareCount + num;
    } else {
        log.push(`|noEnoughShareToLose`);
        G.pub[playerIdNum].shares[r] = 0;
        G.regions[r].share = boardShareCount + shareCount;
    }
    log.push(`|afterLose|${G.pub[playerIdNum].shares[r]}|${G.regions[r].share}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
}

const loseShare = (G: IG, region: ValidRegion, obj: IPubInfo, num: number) => {
    const log = [`loseShare|region${region}|num:${num}`];
    if (obj.shares[region] >= num) {
        obj.shares[region] -= num;
        G.regions[region].share += num;
    } else {
        log.push(`|lessThanNum`)
        G.regions[region].share += obj.shares[region];
        obj.shares[region] = 0;
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}

function getShare(G: IG, region: ValidRegion, obj: IPubInfo, num: number) {
    if (G.regions[region].share >= num) {
        obj.shares[region] += num;
        G.regions[region].share -= num;
    } else {
        obj.shares[region] += G.regions[region].share;
        G.regions[region].share = 0
    }
}

export function payCost(G: IG, ctx: Ctx, p: PlayerID, cost: number): void {
    const pub = G.pub[parseInt(p)];
    const log = [`payCost|p${p}|${cost}`];
    if (pub.resource + pub.deposit < cost) {
        throw Error(`p${p}|cannotPay|${cost}`)
    }
    if (pub.resource >= cost) {
        log.push(`|res:${cost}`);
        pub.resource -= cost;
    } else {
        log.push(`|res:${pub.resource}`);
        const depCost = cost - pub.resource;
        pub.resource = 0
        log.push(`|deposit:${depCost}`);
        pub.deposit -= depCost
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export function buyCardEffectPrepare(G: IG, ctx: Ctx, cardID: CardID, p: PlayerID) {
    const log = [`buyCardEffectPrepare|card|${cardID}|p${p}`];
    const targetCard = getCardById(cardID);
    const cardEff = getCardEffect(targetCard.cardId);
    let hasEffect = false;
    if (cardEff.hasOwnProperty("buy")) {
        const eff = {...cardEff.buy};
        if (eff.e !== "none") {
            log.push(`|buyEffect|${JSON.stringify(eff)}`);
            eff.target = p;
            G.e.stack.push(eff);
            hasEffect = true;
        }
    } else {
        log.push(`|noBuyEff`);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
    return hasEffect;
}

export function simpleEffectExec(G: IG, ctx: Ctx, p: PlayerID): void {
    const eff = G.e.stack.pop();
    const log = [`simpleEffectExec|p${p}|${JSON.stringify(eff)}`];
    let card: INormalOrLegendCard;
    const pub = G.pub[parseInt(p)];
    let hasEffect = false
    switch (eff.e) {
        case "none":
        case "skipBreakthrough":
            return;
        case SimpleEffectNames.CompetitionPowerToVp:
            addVp(G, ctx, p, pub.competitionPower);
            return;
        case "shareToVp":
            const shareRegion: ValidRegion = eff.a;
            addVp(G, ctx, p, pub.shares[shareRegion]);
            return;
        case "loseVpForEachHand":
            loseVp(G, ctx, p, G.player[parseInt(p)].hand.length);
            break;
        case "aestheticsToVp":
            addVp(G, ctx, p, pub.aesthetics);
            break;
        case "industryToVp":
            addVp(G, ctx, p, pub.industry);
            break;
        case "resFromIndustry":
            addRes(G, ctx, p, pub.industry);
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
            log.push(`|${pub.deposit}`);
            pub.deposit += eff.a;
            log.push(`|${pub.deposit}`);
            break;
        case SimpleEffectNames.addCompetitionPower:
            addCompetitionPower(G, ctx, p, eff.a);
            break;
        case SimpleEffectNames.loseCompetitionPower:
            loseCompetitionPower(G, ctx, p, eff.a);
            break;
        case "res":
            addRes(G, ctx, p, eff.a);
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
        case "aestheticsLevelUp":
            if (pub.aesthetics < 10) {
                log.push(`|${pub.aesthetics}`);
                pub.aesthetics++;
                log.push(`|${pub.aesthetics}`);
            } else {
                log.push(`|LV10CannotUpgrade`);
            }
            break
        case "industryLevelUp":
            if (pub.industry < 10) {
                log.push(`|${pub.industry}`);
                pub.industry++;
                log.push(`|${pub.industry}`);
            } else {
                log.push(`|LV10CannotUpgrade`);
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
        case "buyCardToHand":
            card = getCardById(eff.a);
            doBuyToHand(G, ctx, card, p);
            const hasEffectHand = buyCardEffectPrepare(G, ctx, eff.a, p);
            if (hasEffectHand) {
                log.push(`|hasEffect|CheckNextEffect`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                checkNextEffect(G, ctx);
            } else {
                logger.debug(`${G.matchID}|${log.join('')}`);
            }
            return;
        case SimpleEffectNames.competitionLoserBuy:
            card = getCardById(eff.a);
            doBuy(G, ctx, card, G.competitionInfo.def);
            hasEffect = buyCardEffectPrepare(G, ctx, eff.a, p);
            if (hasEffect) {
                log.push(`|hasEffect|CheckNextEffect`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                checkNextEffect(G, ctx);
            } else {
                logger.debug(`${G.matchID}|${log}`)
            }
            return;
        case "buy":
            card = getCardById(eff.a);
            doBuy(G, ctx, card, p);
            hasEffect = buyCardEffectPrepare(G, ctx, eff.a, p);
            if (hasEffect) {
                log.push(`|hasEffect|CheckNextEffect`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                checkNextEffect(G, ctx);
            } else {
                logger.debug(`${G.matchID}|${log}`)
            }
            return;
        default:
            logger.error("Invalid effect" + JSON.stringify(eff));
            throw new Error(JSON.stringify(eff));
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const doBuyToHand = (G: IG, ctx: Ctx, card: INormalOrLegendCard | IBasicCard, p: PlayerID): void => {
    const pub = G.pub[parseInt(p)];
    const playerObj = G.player[parseInt(p)];
    const log = [`p${p}|doBuyToHand|${card.cardId}`];
    checkSocialismRealism(G, ctx, card, p);
    if (card.category === CardCategory.BASIC) {
        log.push(`|basic`);
        // @ts-ignore
        const convertBasicID: BasicCardID = card.cardId;
        const basicCount = G.basicCards[convertBasicID];
        if (basicCount > 0) {
            G.basicCards[convertBasicID] -= 1;
            log.push(`|${G.basicCards[convertBasicID]}|left`);
        } else {
            log.push(`|${card.cardId}|depleted`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return;
        }
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
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const checkSocialismRealism = (G: IG, ctx: Ctx, card: INormalOrLegendCard | IBasicCard, p: PlayerID): void => {
    const pub = G.pub[parseInt(p)];
    const log = [`checkSocialismRealism|${card.cardId}|p${p}`];
    const cardRegion = card.region;
    if (pub.school === SchoolCardID.S2301) {
        log.push(`|SocialismRealism`);
        switch (cardRegion) {
            case Region.EE:
                log.push(`|isEastEurope|1CP|1VP`);
                addCompetitionPower(G, ctx, p, 1);
                addVp(G, ctx, p, 1);
                break;
            default:
                log.push(`|notEastEurope|noEff`);
                break;
        }
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}
export const doBuy = (G: IG, ctx: Ctx, card: INormalOrLegendCard | IBasicCard, p: PlayerID): void => {
    const pub = G.pub[parseInt(p)];
    const log = [`doBuy|${card.cardId}|p${p}`];
    checkSocialismRealism(G, ctx, card, p);
    if (card.category === CardCategory.BASIC) {
        let count = G.basicCards[card.cardId as BasicCardID];
        if (count > 0) {
            G.basicCards[card.cardId as BasicCardID] -= 1;
            pub.discard.push(card.cardId);
            pub.allCards.push(card.cardId);
        } else {
            log.push(`|${card.cardId}|depleted`);
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
            const region = card.region;
            if (region !== Region.NONE) {
                let share = 0;
                if (ctx.numPlayers > SimpleRuleNumPlayers) {
                    log.push(`|notSimpleRule`);
                    if (slot.isLegend) {
                        log.push(`|isLegend`);
                        share++;
                    }
                }
                if (card.type === CardType.F) {
                    log.push(`|film`);
                    share++;
                }
                log.push(`|share${share}`);
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
            log.push(`|buySchool`);
            let school = pub.school;
            // const kino = schoolPlayer(G, ctx, SchoolCardID.S1303);
            // log.push(`|kinoPlayer|${JSON.stringify(kino)}`);
            // if (kino !== null && p !== kino) {
            //     log.push(`|p${kino}|KinoEyes`);
            //     addVp(G, ctx, kino, 1);
            //     G.pub[parseInt(kino)].deposit++;
            // }
            if (school !== null) {
                log.push(`|hasSchool`);
                if (school === SchoolCardID.S1203) {
                    if (pub.aesthetics < 10) {
                        log.push(`|Expressionism`);
                        pub.aesthetics++;
                    }
                }
                log.push(`|archive|${school}`);
                pub.archive.push(school);
            }
            pub.school = card.cardId as SchoolCardID;
        } else {
            log.push(`|pushToDiscard`);
            pub.discard.push(card.cardId);
        }
        pub.allCards.push(card.cardId);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
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
export const studioPlayers = (G: IG, ctx: Ctx, r: Region, p = ctx.currentPlayer): PlayerID[] => {
    if (r === Region.NONE) {
        return [];
    } else {
        const pos = posOfPlayer(G, ctx, p);
        return seqFromPos(G, ctx, pos).filter(pid => studioInRegion(G, ctx, r, pid));
    }
}

export const noBuildingPlayers = (G: IG, ctx: Ctx, r: Region, p: PlayerID): PlayerID[] => {
    const log = [`noBuildingPlayers|${r}`];
    if (r === Region.NONE) {
        logger.debug(`${G.matchID}|${log.join('')}`);
        return [];
    }
    const allPlayers = seqFromPlayer(G, ctx, p);
    log.push(`|all|${JSON.stringify(allPlayers)}`);
    const result = allPlayers.filter(pid => {
        const hasBuilding = studioInRegion(G, ctx, r, pid) || cinemaInRegion(G, ctx, r, pid);
        log.push(`|p${pid}|${hasBuilding}`);
        return !hasBuilding
    });
    log.push(`|result|${result}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return result
}

export const noStudioPlayers = (G: IG, ctx: Ctx, r: Region): PlayerID[] => {
    if (r === Region.NONE) return [];
    const log = [`noStudioPlayers|${r}`];
    const allPlayers = seqFromCurrentPlayer(G, ctx);
    log.push(`|all|${JSON.stringify(allPlayers)}`);
    const result = allPlayers.filter(pid => {
        const hasStudio = studioInRegion(G, ctx, r, pid)
        log.push(`|p${pid}|${hasStudio}`);
        return !hasStudio
    });
    log.push(`|result|${result}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
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
    return !G.regions[r].completedModernScoring && (regionCardDepleted(G, r) || shareDepleted(G, ctx, r));
}

export const seqFromPos = (G: IG, ctx: Ctx, pos: number): PlayerID[] => {
    const log = [`seqFromPos`];
    let seq = [];
    const remainPlayers = G.order.length
    for (let i = pos; i < remainPlayers; i++) {
        log.push(`|push|${i}`);
        seq.push(G.order[i])
    }
    for (let i = 0; i < pos; i++) {
        log.push(`|push|${i}`);
        seq.push(G.order[i])
    }
    log.push(`|seq:${JSON.stringify(seq)}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return seq;
}

export const seqFromActivePlayer = (G: IG, ctx: Ctx): PlayerID[] => {
    const log = [`seqFromActivePlayer`];
    let act = activePlayer(ctx);
    log.push(`|act|p${act}`);
    let pos = posOfPlayer(G, ctx, act);
    let seq = seqFromPos(G, ctx, pos);
    log.push(`|seq:${JSON.stringify(seq)}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return seq;
}

// export const buildingPlayers = (G: IG, ctx: Ctx, r: Region, p: PlayerID): PlayerID[] => {
//     if (r === Region.NONE) return [];
//     return seqFromPlayer(G, ctx, p).filter(pid => cinemaInRegion(G, ctx, r, pid) || studioInRegion(G, ctx, r, pid));
// }
//
export const isSameTeam = (p: PlayerID, q: PlayerID): boolean => {
    const log = [`isSameTeam|p${p}|p${q}`];
    let result: boolean;
    if (p === '0' || p === '2') {
        result = q === '0' || q === '2'
    } else {
        result = q === '1' || q === '3'
    }
    logger.debug(`${log.join('')}|result:${result}`);
    return result;
}

export const opponentTeamPlayers = (p: PlayerID): PlayerID[] => {
    if (p === '0' || p === '2') {
        return ['1', '3']
    } else {
        return ['0', '2']
    }
}

export const seqFromPlayer = (G: IG, ctx: Ctx, p: PlayerID): PlayerID[] => {
    const log = [`seqFromPlayer|p${p}`];
    let pos = posOfPlayer(G, ctx, p);
    let seq = seqFromPos(G, ctx, pos);
    log.push(`|seq:${JSON.stringify(seq)}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return seq;
}

export const seqFromCurrentPlayer = (G: IG, ctx: Ctx): PlayerID[] => {
    const log = [`seqFromCurrentPlayer`];
    log.push(`|cur|p${ctx.currentPlayer}`);
    const seq = seqFromPlayer(G, ctx, ctx.currentPlayer);
    log.push(`|seq:${JSON.stringify(seq)}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return seq;
}

export const getCompetitionPowerLessPlayers = (G: IG, ctx: Ctx, p: PlayerID): PlayerID[] => {
    const log = [`getCompetitionPowerLessPlayers`];
    log.push(`|cur|p${ctx.currentPlayer}`);
    const atkCompetitionPowerAfterCompetition = G.pub[parseInt(p)].competitionPower - 3;
    log.push(`|atkCompetitionPowerAfterCompetition|${atkCompetitionPowerAfterCompetition}`);
    if (atkCompetitionPowerAfterCompetition <= 0) {
        log.push(`|atkCompetitionPowerAfterCompetition<=0|return[]`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        return [];
    }
    let seq: PlayerID[] = [];
    const remainPlayers = G.order.length;
    const checkAndAdd = (i: number) => {
        const targetPlayer = G.order[i];
        const targetCompetitionPower = G.pub[parseInt(targetPlayer)].competitionPower;
        log.push(`|idx|${i}|p${targetPlayer}|CP:${targetCompetitionPower}`);
        if (targetCompetitionPower < atkCompetitionPowerAfterCompetition) {
            log.push(`|bigger`);
            if (G.mode !== GameMode.TEAM2V2) {
                log.push(`|normalMode|push|p${targetPlayer}`);
                seq.push(targetPlayer);
            } else {
                log.push(`|2v2`);
                if (isSameTeam(p, targetPlayer)) {
                    log.push(`|isSameTeam|doNotPush`)
                } else {
                    log.push(`|push|p${targetPlayer}`);
                    seq.push(targetPlayer);
                }
            }
        } else {
            log.push(`|smaller|skip`);
        }
    }

    const pos = posOfPlayer(G, ctx, p);
    for (let i = pos; i < remainPlayers; i++) {
        checkAndAdd(i);
    }
    for (let i = 0; i < pos; i++) {
        checkAndAdd(i);
    }
    log.push(`|seq:${JSON.stringify(seq)}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return seq;
}

export const getExistingLastMovePlayer = (G: IG): PlayerID => {
    const log = ["getExistingLastMovePlayer"];
    if (G.order.length === G.initialOrder.length) {
        log.push(`|noOneConcede|lastMovePlayer`);
        const lastMovePlayer = G.initialOrder[G.playerCount - 1]
        log.push(`|${lastMovePlayer}`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        return lastMovePlayer
    }
    const secondLastMovePlayer = G.initialOrder[G.playerCount - 2]
    if (G.order.includes(secondLastMovePlayer)) {
        log.push(`|secondLast`);
        log.push(`|${secondLastMovePlayer}`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        return secondLastMovePlayer
    } else {
        log.push(`|thirdLast`);
        const thirdLastMovePlayer = G.initialOrder[G.playerCount - 3]
        log.push(`|${thirdLastMovePlayer}`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        return thirdLastMovePlayer
    }
}

export const minHandCountPlayers = (G: IG): PlayerID[] => {
    return lowest(G, (G, i) => G.player[parseInt(i)].hand.length);
}

export const industryHighestPlayer = (G: IG): PlayerID[] => {
    return highestPlayer(G, (G, i) => G.pub[parseInt(i)].industry);
}

export const industryLowestPlayer = (G: IG): PlayerID[] => {
    return lowest(G, (G, i) => G.pub[parseInt(i)].industry);
}

export const getLevelSum = (G: IG, p: PlayerID): number => {
    const log = [`getLevelSum|p${p}`];
    const pub = G.pub[parseInt(p)];
    logger.debug(`${G.matchID}|${log.join('')}`);
    return pub.aesthetics + pub.industry
}
export const getLevelMarkCount = (G: IG, p: PlayerID): number => {
    const log = [`getLevelMarkCount|p${p}`];
    const pub = G.pub[parseInt(p)];
    let result = pub.aesthetics + pub.industry
    const school = pub.school;
    if (school === null) {
        log.push(`|noSchool|${result}`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        return result;
    } else {
        log.push(`|school${school}`);
        const schoolCard = getCardById(school);
        result += schoolCard.aesthetics;
        result += schoolCard.industry;
        log.push(`|${result}`);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
    return result
}

export const levelSumLowestPlayer = (G: IG): PlayerID[] => {
    return lowest(G, getLevelSum);

}

export const levelAndMarkLowestPlayer = (G: IG): PlayerID[] => {
    return lowest(G, getLevelMarkCount);
}

export const getSchoolHandLimit = (G: IG, p: PlayerID): number => {
    const school = G.pub[parseInt(p)].school;
    const log = [`getSchoolHandLimit|p${p}|school${school}`];
    const ruleLimit = G.activeEvents.includes(EventCardID.E07) ? 5 : 4;
    log.push(`|ruleLimit${ruleLimit}`);
    if (school === null) {
        log.push(`|finalLimit${ruleLimit}`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        return ruleLimit;
    } else {
        const schoolLimit = getCardEffect(school).school.hand;
        log.push(`|schoolLimit${schoolLimit}`);
        const limit = schoolLimit > ruleLimit ? schoolLimit : ruleLimit;
        log.push(`|finalLimit${limit}`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        return limit
    }
}

// export const schoolHandLowestPlayer = (G: IG): PlayerID[] => {
//     return lowest(G, getSchoolHandLimit);
// }

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
    const log = ["lowest"];
    const metrics: number[] = [];
    const result: PlayerID[] = [];
    let lowestMetric = func(G, G.order[0]);
    G.order.forEach((i) => {
        const metric = func(G, i);
        if (metric < lowestMetric) {
            log.push(`|p${i}|${metric}`);
            lowestMetric = metric;
        }
        metrics.push(metric);
    })
    log.push(`|lowest|${lowestMetric}`);
    G.order.forEach((i, idx) => {
        const m = metrics[idx];
        if (m === lowestMetric) {
            log.push(`|p${i}lowest`);
            result.push(i);
        }
    })
    log.push(`|result|${JSON.stringify(result)}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return result;
}

export function notHighestPlayer(G: IG, func: (G: IG, p: PlayerID) => number): PlayerID[] {
    const log = ["notHighestPlayer"];
    const metrics: number[] = [];
    const result: PlayerID[] = [];
    let highestMetric = 0;
    G.order.forEach((i) => {
        const metric = func(G, i);
        log.push(`|p${i}|${metric}`);
        if (metric > highestMetric) {
            highestMetric = metric;
        }
        metrics.push(metric);
    })
    log.push(`|highest|${highestMetric}`);
    G.order.forEach((i, idx) => {
        const m = metrics[idx];
        if (m !== highestMetric) {
            log.push(`|p${i}notHighest`);
            result.push(i);
        }
    })
    logger.debug(`${G.matchID}|${log.join('')}`);
    return result;
}

export function highestPlayer(G: IG, func: (G: IG, p: PlayerID) => number): PlayerID[] {
    const log = ["highestPlayer"];
    const metrics: number[] = [];
    const result: PlayerID[] = [];
    let highestMetric = 0;
    G.order.forEach((i) => {
        const metric = func(G, i);
        log.push(`|p${i}|${metric}`);
        if (metric > highestMetric) {
            highestMetric = metric;
        }
        metrics.push(metric);
    })
    log.push(`|highest|${highestMetric}`);
    G.order.forEach((i, idx) => {
        const m = metrics[idx];
        if (m === highestMetric) {
            log.push(`|p${i}highest`);
            result.push(i);
        }
    })
    logger.debug(`${G.matchID}|${log.join('')}`);
    return result;
}

export function vpHighestPlayer(G: IG): PlayerID[] {
    return highestPlayer(G, (G, p) => G.pub[parseInt(p)].vp);
}

export const breakthroughEffectPrepare = (G: IG, card: CardID): void => {
    const log = ["breakthroughEffectPrepare"];
    let c = getCardById(card);
    let i = c.industry
    let a = c.aesthetics
    log.push(`|${c.cardId}|i${i}|a${a}`);
    if (i === 0 && a === 0) {
        log.push(`|noMarker|return`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        return;
    }
    if (i > 0 && a > 0) {
        log.push(`|industryAndAestheticsBreakthrough`);
        G.e.stack.push({
            e: "industryAndAestheticsBreakthrough", a: {
                industry: c.industry,
                aesthetics: c.aesthetics,
            }
        })
        logger.debug(`${G.matchID}|${log.join('')}`);
    } else {
        if (i === 0) {
            log.push(`|aestheticsBreakthrough`);
            G.e.stack.push({e: "aestheticsBreakthrough", a: c.aesthetics})
            logger.debug(`${G.matchID}|${log.join('')}`);
        } else {
            log.push(`|industryBreakthrough`);
            G.e.stack.push({e: "industryBreakthrough", a: c.industry})
            logger.debug(`${G.matchID}|${log.join('')}`);
        }
    }
}

export const startBreakThrough = (G: IG, ctx: Ctx, pid: PlayerID, card: CardID): void => {
    const c = getCardById(card)
    const pub = G.pub[parseInt(pid)];
    const log = [`startBreakThrough|p${pid}|${card}`];
    if (c.type === CardType.V) {
        addVp(G, ctx, pid, c.vp);
    }
    if (pub.school === SchoolCardID.S2201) {
        log.push(`|neoRealism`);
        log.push(`|before|${JSON.stringify(G.e.stack)}`);
        G.e.stack.push({
            e: "vp", a: 2, target: pid
        });
        G.e.stack.push({
            e: "deposit", a: 1, target: pid
        });
        log.push(`|after|${JSON.stringify(G.e.stack)}`);
    }
    if (pub.school === SchoolCardID.S1204) {
        log.push(`|swedish`);
        log.push(`|before|${JSON.stringify(G.e.stack)}`);
        G.e.stack.push({
            e: "res", a: 1, target: pid
        })
        log.push(`|after|${JSON.stringify(G.e.stack)}`);
    }
    if (
        c.cardId === FilmCardID.F1108
    ) {
        const curDep = pub.deposit;
        if (curDep >= 1) {
            log.push(`hasCash|${curDep}|industryOrAestheticsBreakthrough`);
            G.e.stack.push({
                e: "industryAndAestheticsBreakthrough", a: {
                    industry: 1,
                    aesthetics: 1,
                }
            })
            loseDeposit(G, ctx, pid, 1);
            log.push(`|playerEffExec`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            playerEffExec(G, ctx, pid);
        } else {
            log.push(`noCash|${curDep}`);
        }
        return
    }
    if (
        c.cardId === FilmCardID.F1208
        || c.cardId === BasicCardID.B05
    ) {
        log.push("|industryAndAestheticsBreakthrough");
        G.e.stack.push({
            e: "industryOrAestheticsBreakthrough", a: {
                industry: 1,
                aesthetics: 1,
            }
        })
        log.push(`|playerEffExec`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        playerEffExec(G, ctx, pid);
        return
    }
    log.push(`|breakthroughEffectPrepare`);
    breakthroughEffectPrepare(G, card);
    const cardEff = getCardEffect(c.cardId);
    // if (c.cardId !== FilmCardID.F1108) {
    if (cardEff.hasOwnProperty("archive")) {
        const eff = {...cardEff.archive};
        if (eff.e !== "none") {
            eff.target = pid;
            log.push(`|pushEffect|${JSON.stringify(eff)}`);
            G.e.stack.push(eff)
        } else {
            log.push(`|noSpecialArchiveEffect`);
        }
    } else {
        log.push(`|missingArchiveEffect`);
    }
    // } else {
    //     log.push(`|Nanook|DoNotPushArchiveEffect`);
    // }
    log.push(`|checkNextEffect`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    checkNextEffect(G, ctx);
    return;
}

export const curCard = (G: IG) => {
    if (G.e.card === null) {
        throw Error("No current card")
    }
    return getCardById(G.e.card);
}

export const pushPlayersEffects = (G: IG, players: PlayerID[], eff: any) => {
    const log = [`pushPlayersEffects|players|${JSON.stringify(players)}`];
    const pos = players.length;
    for (let i = pos - 1; i >= 0; i--) {
        const targetEff = {...eff, target: players[i]};
        G.e.stack.push(targetEff);
    }
    log.push(`|${JSON.stringify(G.e.stack)}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const playerEffExec = (G: IG, ctx: Ctx, p: PlayerID): void => {
    const log = [`playerEffExec|p${p}`];
    let eff = G.e.stack.pop();
    if (eff === undefined) {
        log.push("|StackEmpty|checkNextEffect");
        logger.debug(`${G.matchID}|${log.join('')}`);
        checkNextEffect(G, ctx);
        return;
    }
    log.push(`|eff|${JSON.stringify(eff)}`);
    G.e.currentEffect = eff;
    let targetPlayer = p;
    let pub = G.pub[parseInt(p)];
    const playerObj = G.player[parseInt(p)];
    let region: ValidRegion;
    if (G.e.card !== null) {
        const curCardObj = curCard(G);
        region = curCardObj.region as ValidRegion;
    } else {
        region = Region.NA;
    }
    log.push(`|c:${G.e.card}|region:${region}`);
    let players = []
    const handLength = playerObj.hand.length;
    let subEffect;
    let extraCost = 0
    const totalRes = pub.resource + pub.deposit;
    let i = G.competitionInfo;
    let validCardsToDiscard: CardID[] = [];
    const discardOpsReturn = () :boolean =>{
        const validCount = validCardsToDiscard.length;
        const effectCount = eff.a;
        const deltaCount = validCount - effectCount;
        const discardStatus = deltaCount / Math.abs(deltaCount);
        log.push(`|valid${validCount}|effect${effectCount}|delta${deltaCount}|status${discardStatus}`);
        switch (discardStatus) {
            case -1:
                pub.revealedHand = [...playerObj.hand]
                log.push(`|${JSON.stringify(pub.revealedHand)}`);
                log.push(("|NoEnoughValidCardsRevealHand|next"));
                return false;
            case 0:
                for (const validCardsToDiscardElement of validCardsToDiscard) {
                    const handIdx = playerObj.hand.indexOf(validCardsToDiscardElement);
                    if(handIdx !== -1){
                        playerObj.hand.splice(handIdx);
                    }
                }
                return false;
            case 1:
                G.e.stack.push(eff);
                changePlayerStage(G, ctx, "chooseHand", p);
                return true;
            default:
                return true;
        }
    };
    switch (eff.e) {
        case "playedCardInTurnEffect":
            if (pub.playedCardInTurn.filter(c => getCardById(c).aesthetics > 0 && c !== G.e.card).length > 0) {
                log.push(`|chooseHand`);
                G.e.stack.push(eff);
                logger.debug(`${G.matchID}|${log.join('')}`);
                changePlayerStage(G, ctx, "chooseHand", p);
                return;
            }
            log.push(`|noAesMarkCardPlayed`);
            break;
        case "aestheticsLevelUpCost":
            extraCost = additionalCostForUpgrade(G, pub.aesthetics);
            log.push(`|extra|${extraCost}`);
            if (
                extraCost < totalRes &&
                extraCost > 0
            ) {
                log.push(`|canChoose|payAdditionalCost`);
                G.e.extraCostToPay = extraCost;
                logger.debug(`${G.matchID}|${log.join('')}`);
                G.e.stack.push(eff);
                changePlayerStage(G, ctx, "payAdditionalCost", p);
                return;
            } else {
                payCost(G, ctx, p, extraCost);
                if (pub.aesthetics < 10) {
                    log.push(`|upgrade`);
                    pub.aesthetics++;
                }
            }
            break
        case "industryLevelUpCost":
            extraCost = additionalCostForUpgrade(G, pub.industry);
            log.push(`|extra|${extraCost}`);
            if (extraCost < totalRes && extraCost > 0) {
                log.push(`|canChoose|payAdditionalCost`);
                G.e.extraCostToPay = extraCost;
                logger.debug(`${G.matchID}|${log.join('')}`);
                G.e.stack.push(eff);
                changePlayerStage(G, ctx, "payAdditionalCost", p);
                return;
            } else {
                payCost(G, ctx, p, extraCost);
                if (pub.industry < 10) {
                    log.push(`|upgrade`);
                    pub.industry++;
                }
            }
            break;
        case "searchAndArchive":
            players = ownCardPlayers(G, ctx, eff.a);
            if (players.length === 0) {
                log.push(`noPlayerOwn${eff.a}`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                break;
            } else {
                log.push(`|players${JSON.stringify(players)}`);
                G.e.stack.push(eff);
                logger.debug(`${G.matchID}|${log.join('')}`);
                G.e.currentEffect = eff;
                changePlayerStage(G, ctx, "confirmRespond", players[0]);
                return;
            }
        case "era":
            let era;
            if (ctx.numPlayers > SimpleRuleNumPlayers) {
                log.push(`|not2p`);
                era = G.regions[region].era;
            } else {
                log.push(`|2p`);
                era = G.twoPlayer.era;
            }
            log.push(`|era|${era}`);
            subEffect = {...eff.a[era]}
            if (eff.hasOwnProperty("target")) {
                subEffect.target = eff.target
            }
            G.e.stack.push(subEffect);
            log.push(`|era|${JSON.stringify(G.e.stack)}`);
            break;
        case "breakthroughResDeduct":
            if (handLength > 0) {
                log.push(`|chooseHand`);
                G.e.stack.push(eff);
                logger.debug(`${G.matchID}|${log.join('')}`);
                changePlayerStage(G, ctx, "chooseHand", p);
                return;
            } else {
                break;
            }
        case "alternative":
            if (idOnBoard(G, ctx, eff.a.a)) {
                G.e.stack.push(eff)
                G.e.currentEffect = eff;
                log.push(`|confirmRespond`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                changePlayerStage(G, ctx, "confirmRespond", p);
                return;
            } else {
                break;
            }
        case "competition": {
            // if (pub.school === SchoolCardID.S2101) {
            //     log.push(`|ClassicHollywood|noExtraFee`);
            // } else {
            //     if (
            //         totalRes > 1 &&
            //         pub.resource > 0 &&
            //         pub.deposit > 0
            //     ) {
            //         log.push(`|canChoose|payAdditionalCost`);
            //         G.e.extraCostToPay = 1;
            //         logger.debug(`${G.matchID}|${log.join('')}`);
            //         G.e.stack.push(eff);
            //         changePlayerStage(G, ctx, "payAdditionalCost", p);
            //         return;
            //     } else {
            //         if (totalRes === 0) {
            //             log.push(`|noResOrDeposit|pass`);
            //             break;
            //         } else {
            //             log.push(`|payDirectly`);
            //             if (pub.resource > 0) {
            //                 log.push(`prevRes:|${pub.resource}`);
            //                 pub.resource--;
            //                 log.push(`afterRes|${pub.resource}`);
            //             } else {
            //                 log.push(`prevDeposit:|${pub.deposit}`);
            //                 pub.deposit--;
            //                 log.push(`afterDeposit|${pub.deposit}`);
            //             }
            //         }
            //     }
            // }
        }
            if (ctx.numPlayers > SimpleRuleNumPlayers) {
                players = getCompetitionPowerLessPlayers(G, ctx, p);
                const ownIndex = players.indexOf(p)
                if (ownIndex !== -1) {
                    players.splice(ownIndex, 1);
                }
                log.push(`|competitionPlayers:|${JSON.stringify(players)}`);
                log.push(`|players:|${JSON.stringify(players)}`);
                switch (players.length) {
                    case 0: {
                        log.push("|checkNextEffect");
                        logger.debug(`${G.matchID}|${log.join('')}`);
                        checkNextEffect(G, ctx);
                        break;
                    }
                    case 1: {
                        G.c.players = [];
                        // G.competitionInfo.progress = eff.a.bonus;
                        G.competitionInfo.onWin = eff.a.onWin;
                        log.push(`|startCompetition`);
                        logger.debug(`${G.matchID}|${log.join('')}`);
                        startCompetition(G, ctx, p, players[0]);
                        break;
                    }
                    default: {
                        G.c.players = players;
                        G.e.stack.push(eff)
                        log.push(`|chooseTarget`);
                        logger.debug(`${G.matchID}|${log.join('')}`);
                        changePlayerStage(G, ctx, "chooseTarget", p);
                        return;
                    }
                }
                break;
            } else {
                // G.competitionInfo.progress = eff.a.bonus;
                G.competitionInfo.onWin = eff.a.onWin;
                log.push(`|startCompetition`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                const opponent2p = p === '0' ? '1' : '0';
                const opponentCompetitionPower = G.pub[parseInt(opponent2p)].competitionPower;
                const playerCompetitionPower = G.pub[parseInt(p)].competitionPower;
                if (playerCompetitionPower > opponentCompetitionPower) {
                    startCompetition(G, ctx, p, opponent2p);
                }
                break;
            }
        case "loseAnyRegionShare":
            G.e.regions = valid_regions.filter(r => pub.shares[r] > 0)
            log.push(`|${JSON.stringify(G.e.regions)}`);
            if (G.e.regions.length === 0) {
                ctx?.events?.endStage?.()
                log.push(`|endStage`);
                break;
            } else {
                G.e.stack.push(eff)
                changePlayerStage(G, ctx, "chooseRegion", p);
                return;
            }
        case ItrEffects.anyRegionShareCompetition:
            i = G.competitionInfo;
            log.push(`|pendingCompetition`);
            const winner = i.atk;
            const loser = i.def;
            G.e.regions = valid_regions.filter(r => G.pub[parseInt(loser)].shares[r] > 0)
            if (G.e.regions.length === 0) {
                log.push("|loserNoShare");
                competitionCleanUp(G, ctx);
                break;
            } else {
                log.push(`|p${winner}|chooseRegion`);
                G.e.stack.push(eff)
                logger.debug(`${G.matchID}|${log.join('')}`);
                changePlayerStage(G, ctx, "chooseRegion", winner);
                return;
            }
        case ItrEffects.anyRegionShare:
        case ItrEffects.anyRegionShareCentral:
            G.e.regions = valid_regions.filter(r => G.regions[r].share > 0)
            if (G.e.regions.length === 0) {
                log.push("No share on board, cannot obtain from others.");
                break;
            } else {
                G.e.stack.push(eff)
                changePlayerStage(G, ctx, "chooseRegion", p);
                return;
            }
        case "handToAnyPlayer":
            log.push(`|handToAnyPlayer`);
            if (playerObj.hand.length > 0) {
                players = seqFromCurrentPlayer(G, ctx);
                G.c.players = players
                G.e.stack.push(eff)
                changePlayerStage(G, ctx, "chooseTarget", p);
                return;
            } else {
                log.push(`|noCardInHand|pass`);
                break;
            }
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
            log.push(`|peek|${peekCount}cards`);
            let deck = G.secretInfo.playerDecks[parseInt(p)];
            log.push(`|deck|${JSON.stringify(deck)}`);
            log.push(`|hand${JSON.stringify(playerObj.hand)}`);
            log.push(`|discard|${JSON.stringify(pub.discard)}`);
            const totalRemainCards = deck.length + pub.discard.length
            if (totalRemainCards === 0) {
                log.push(`|noCardLeftSkip`);
                break;
            }
            log.push(`|deckAndDiscardSum|${totalRemainCards}`);
            for (let count = 0; count < peekCount; count++) {
                log.push(`|count|${count}`);
                drawPeekCardForPlayer(G, ctx, p);
            }
            log.push(`|peekCard|${JSON.stringify(playerObj.cardsToPeek)}`);
            log.push(`|afterDeck|${JSON.stringify(deck)}|afterHand${JSON.stringify(playerObj.hand)}|afterDiscard|${JSON.stringify(pub.discard)}`);
            const drawnCard = playerObj.cardsToPeek.length;
            const newEffect = {...eff}
            if (newEffect.a.filter.e === "choice" && newEffect.a.filter.a > drawnCard) {
                log.push(`||noEnoughCardToChoose`);
                newEffect.a.filter.a = drawnCard;
                log.push(`|${JSON.stringify(newEffect)}`);
            }
            G.e.stack.push(newEffect)
            logger.debug(`${G.matchID}|${log.join('')}`);
            changePlayerStage(G, ctx, "peek", p);
            return;
        case "noBuildingEE":
            players = noBuildingPlayers(G, ctx, Region.EE, G.pending.firstPlayer);
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
        case "levelSumLowestPlayer":
            players = levelSumLowestPlayer(G);
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
            players = studioPlayers(G, ctx, region, p);
            pushPlayersEffects(G, players, eff.a);
            break;
        case "minHandCountPlayers":
            players = minHandCountPlayers(G);
            pushPlayersEffects(G, players, eff.a);
            break;
        case "noBuildingPlayers":
            players = noBuildingPlayers(G, ctx, eff.region, G.pending.firstPlayer);
            pushPlayersEffects(G, players, eff.a);
            break;
        case "everyOtherCompany":
            players = seqFromCurrentPlayer(G, ctx);
            players.shift()
            pushPlayersEffects(G, players, eff.a);
            break;
        case "everyPlayer":
            const pos = posOfPlayer(G, ctx, G.pending.firstPlayer);
            log.push(`|pos${pos}`);
            players = seqFromPos(G, ctx, pos);
            log.push(`|players${players}`);
            pushPlayersEffects(G, players, eff.a);
            break;
        case "noStudio":
            players = noStudioPlayers(G, ctx, region);
            log.push(`|region:${region}|noStudioPlayers|${JSON.stringify(players)}`);
            if (players.length === 0) {
                log.push(`|everyOneHasStudio`);
                break;
            }
            G.c.players = players;
            G.e.stack.push(eff.a);
            logger.debug(`${G.matchID}|${log.join('')}`);
            changePlayerStage(G, ctx, "chooseTarget", p);
            return;
        case "step":
            log.push(("|step"));
            const effectCount = eff.a.length;
            for (let i = effectCount - 1; i >= 0; i--) {
                subEffect = {...eff.a[i]};
                if (eff.hasOwnProperty("target")) {
                    log.push(`|specifyTarget|${eff.target}`);
                    subEffect.target = eff.target;
                }
                log.push(`|push|${JSON.stringify(subEffect)}`);
                G.e.stack.push(subEffect);
            }
            log.push(`|result|${JSON.stringify(G.e.stack)}`);
            break;
        case "discardBasic":
            validCardsToDiscard = playerObj.hand.filter(i =>
                getCardById(i).category === CardCategory.BASIC
            );
            if(discardOpsReturn()){
                logger.debug(`${G.matchID}|${log.join('')}`);
                return;
            }
            break;
        case "discardNormalOrLegend":
            validCardsToDiscard = playerObj.hand.filter(i =>
                getCardById(i).category !== CardCategory.BASIC &&
                getCardById(i).category !== CardCategory.SCORE
            );
            if(discardOpsReturn()){
                logger.debug(`${G.matchID}|${log.join('')}`);
                return;
            }
            break;
        case "discardLegend":
            validCardsToDiscard = playerObj.hand.filter(i =>
                getCardById(i).category === CardCategory.LEGEND
            );
            if(discardOpsReturn()){
                logger.debug(`${G.matchID}|${log.join('')}`);
                return;
            }
            break;
        case "discardAesthetics":
            validCardsToDiscard = playerObj.hand.filter(i =>
                getCardById(i).aesthetics > 0
            );
            if(discardOpsReturn()){
                logger.debug(`${G.matchID}|${log.join('')}`);
                return;
            }
            break;
        case "discardIndustry":
            validCardsToDiscard = playerObj.hand.filter(i =>
                getCardById(i).industry > 0
            );
            if(discardOpsReturn()){
                logger.debug(`${G.matchID}|${log.join('')}`);
                return;
            }
            break;
        case "refactor":
        case "archive":
        case "discard":
            log.push(`|hand|${handLength}|discard|${eff.a}`);
            if (handLength > 0) {
                if (handLength < eff.a) {
                    log.push(`|noEnoughCard`);
                    eff.a = handLength
                }
                log.push(`|chooseHand`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                G.e.stack.push(eff);
                changePlayerStage(G, ctx, "chooseHand", p);
                return;
            } else {
                log.push(("|EmptyHand|next"));
            }
            break;
        case "choice":
            for (let choice of eff.a) {
                switch (choice.e) {
                    case "breakthroughResDeduct":
                        if (handLength > 0) {
                            if (eff.hasOwnProperty("target")) {
                                const choiceEff = {...choice};
                                choiceEff.target = eff.target;
                                G.e.choices.push(choiceEff);
                            } else {
                                G.e.choices.push(choice);
                            }
                        }
                        break;
                    case "buy":
                        if (idOnBoard(G, ctx, choice.a)) {
                            if (eff.hasOwnProperty("target")) {
                                const choiceEff = {...choice};
                                choiceEff.target = eff.target;
                                G.e.choices.push(choiceEff);
                            } else {
                                G.e.choices.push(choice);
                            }
                        }
                        break;
                    default:
                        if (eff.hasOwnProperty("target")) {
                            const choiceEff = {...choice};
                            choiceEff.target = eff.target;
                            G.e.choices.push(choiceEff);
                        } else {
                            G.e.choices.push(choice);
                        }
                }
            }
            if (G.e.choices.length === 0) {
                log.push(`|noValidEffect`);
                break;
            } else {
                if (G.e.choices.length === 1) {
                    G.e.stack.push(G.e.choices.pop());
                    log.push(`|oneEffectValid|Exec`);
                    logger.debug(`${G.matchID}|${log.join('')}`);
                    checkNextEffect(G, ctx);
                    return;
                } else {
                    logger.debug(`${G.matchID}|${log.join('')}`);
                    changePlayerStage(G, ctx, "chooseEffect", p);
                    return;
                }
            }
        case "update":
            if (wholeBoardDepleted(G)) {
                log.push(`|noSlotToUpdate`);
                break;
            } else {
                changePlayerStage(G, ctx, "updateSlot", p);
                logger.debug(`${G.matchID}|${log.join('')}`);
                return;
            }
        case "comment":
            if (
                wholeBoardDepleted(G) || commentBasicCardDepleted(G)
            ) {
                log.push(`|noTargetOrCommentCard`);
                break;
            } else {
                changePlayerStage(G, ctx, "comment", p);
                logger.debug(`${G.matchID}|${log.join('')}`);
                return;
            }
        case "pay":
            subEffect = {...eff.a.eff};
            if (eff.hasOwnProperty("target")) {
                log.push(`|target|${eff.target}`);
                subEffect.target = eff.target
            }
            switch (eff.a.cost.e) {
                case "res":
                    // if (G.competitionInfo.pending) {
                    //     log.push(`|inCompetition|noDeduct`);
                    //     G.e.stack.push(subEffect);
                    //     break;
                    // }
                    if (pub.resource < eff.a.cost.a) {
                        break;
                    } else {
                        pub.resource -= eff.a.cost.a
                        G.e.stack.push(subEffect);
                        break;
                    }
                case "vp":
                case "addVp":
                case "addExtraVp":
                    if (pub.vp < eff.a.cost.a) {
                        break;
                    } else {
                        loseVp(G, ctx, p, eff.a.cost.a);
                        G.e.stack.push(subEffect);
                        break;
                    }
                case "deposit":
                    if (pub.deposit < eff.a.cost.a) {
                        break;
                    } else {
                        loseDeposit(G, ctx, p, eff.a.cost.a);
                        G.e.stack.push(subEffect);
                        break;
                    }
                case "share":
                    loseShare(G, eff.a.cost.region, pub, eff.a.cost.a);
                    G.e.stack.push(subEffect);
                    break;
                default:
                    logger.debug(`${G.matchID}|${log.join('')}`);
                    throw new Error();
            }
            break;
        case "optional":
            if (G.competitionInfo.pending && eff.a.e === "competition") {
                log.push(`|alreadyInCompetition|skip`);
                break;
            } else {
                G.e.stack.push(eff);
                G.e.currentEffect = eff;
                logger.debug(`${G.matchID}|${log.join('')}`);
                changePlayerStage(G, ctx, "confirmRespond", p);
                return;
            }
        case "industryOrAestheticsLevelUp":
            if (eff.hasOwnProperty("target") && eff.target !== p) {
                log.push(`|otherPlayerVPAward`);
                targetPlayer = eff.target
                pub = G.pub[parseInt(targetPlayer)];
            }
            log.push(`|i${pub.industry}a${pub.aesthetics}`);
            if (pub.industry < 10 && pub.aesthetics < 10) {
                log.push(`|${JSON.stringify(G.e.choices)}|addChoice`);
                G.e.choices.push({e: "industryLevelUp", a: 1});
                G.e.choices.push({e: "aestheticsLevelUp", a: 1});
                if (eff.a > 1) {
                    log.push(`|moreThanOne|pushBack`);
                    eff.a--;
                    G.e.stack.push(eff);
                }
                log.push(`|chooseEffect`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                changePlayerStage(G, ctx, "chooseEffect", targetPlayer);
                return;
            } else {
                if (pub.industry < 10) {
                    log.push(`|aesthetics10AddIndustry`);
                    pub.industry++;
                    log.push(`|i${pub.industry}`);
                } else {
                    if (pub.aesthetics < 10) {
                        log.push(`|Industry10AddAesthetics`);
                        pub.aesthetics++;
                        log.push(`|i${pub.aesthetics}`);
                    } else {
                        log.push("|bothLV10|skip");
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
            log.push(`|chooseHand`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            changePlayerStage(G, ctx, "chooseHand", p);
            return;
        case "industryBreakthrough":
            if (eff.a > 1) {
                log.push(`|multiple`);
                eff.a--;
                G.e.stack.push(eff);
            }
            logger.debug(`${G.matchID}|${log.join('')}`);
            doIndustryBreakthrough(G, ctx, p);
            return;
        case "aestheticsBreakthrough":
            if (eff.a > 1) {
                log.push(`|multiple`);
                eff.a--;
                G.e.stack.push(eff);
            }
            logger.debug(`${G.matchID}|${log.join('')}`);
            doAestheticsBreakthrough(G, ctx, p);
            return;
        default:
            log.push(`|simpleEffect`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            G.e.stack.push(eff);
            simpleEffectExec(G, ctx, p);
    }
    log.push("|checkNextEffect");
    logger.debug(`${G.matchID}|${log.join('')}`);
    checkNextEffect(G, ctx);
    return;
}

export const aesAward = (G: IG, ctx: Ctx, p: PlayerID): void => {
    aesAwardEndTurn(G, ctx, p);
    const pub = G.pub[parseInt(p)];
    const log = [`aesAward|InTurn|p${p}|${pub.industry}`];
    if (pub.school === SchoolCardID.S3304 && ctx.currentPlayer === p) {
        log.push(`|S3304|aesAwardInTurn|Draw`);
        drawCardForPlayer(G, ctx, p);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const aesAwardEndTurn = (G: IG, ctx: Ctx, p: PlayerID): void => {
    const pub = G.pub[parseInt(p)];
    const log = [`aesAward|p${p}|${pub.aesthetics}`];
    if (pub.aesthetics > 1) {
        log.push(`|>1`);
        addVp(G, ctx, p, 1);
    }
    if (pub.aesthetics > 4) {
        log.push(`|>4`);
        addVp(G, ctx, p, 2);
    }
    if (pub.aesthetics > 7) {
        log.push(`|>7`);
        addVp(G, ctx, p, 2);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const industryAwardEndTurn = (G: IG, ctx: Ctx, p: PlayerID): void => {
    // const i = G.competitionInfo;
    const pub = G.pub[parseInt(p)];
    const log = [`industryAward|p${p}|${pub.industry}`];
    if (pub.industry > 1) {
        log.push(`|before|${pub.resource}`);
        addRes(G, ctx, p, 1);
        log.push(`|after|${pub.resource}`);
    }
    // if (i.pending) {
    //     log.push(`|inCompetition|skipNext`);
    //     logger.debug(`${G.matchID}|${log.join('')}`);
    //     return;
    // }
    if (pub.industry > 4) {
        drawCardForPlayer(G, ctx, p);
    }
    if (pub.industry > 7) {
        drawCardForPlayer(G, ctx, p);
        addCompetitionPower(G, ctx, p, 1);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}
export const industryAward = (G: IG, ctx: Ctx, p: PlayerID): void => {
    industryAwardEndTurn(G, ctx, p);
    const pub = G.pub[parseInt(p)];
    const log = [`industryAward|InTurn|p${p}|${pub.industry}`];
    if (pub.school === SchoolCardID.S3304 && ctx.currentPlayer === p) {
        log.push(`|S3304|industryAwardInTurn|loseVp`);
        loseVp(G, ctx, p, 4);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
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

export function noRegionCardOnBoard(G: IG, region: Region) {
    if (region === Region.NONE) return false;
    const r = G.regions[region];
    return r.legend.card === null &&
        r.normal.filter(value => value.card !== null).length === 0;
}

export function regionCardDepleted(G: IG, region: Region) {
    if (region === Region.NONE) return false;
    const r = G.secretInfo.regions[region];
    return noRegionCardOnBoard(G, region) && r.normalDeck.length === 0 && r.legendDeck.length === 0;
}

export function shareDepleted(G: IG, ctx: Ctx, region: Region) {
    if (region === Region.NONE) return false;
    return G.regions[region].share === 0;
}

export function resCost(G: IG, ctx: Ctx, arg: IBuyInfo, showLog: boolean = true): number {
    let targetCard = getCardById(arg.target);
    let cost: ICost = targetCard.cost;
    const log = [`resCost|${targetCard.name}|Cost:|${cost.res}|${cost.industry}|${cost.aesthetics}`];
    let resRequired = cost.res;
    let pub = G.pub[parseInt(arg.buyer)]
    log.push(`|p${arg.buyer}|industry${pub.industry}|aesthetics${pub.aesthetics}`);
    let aesthetics: number = cost.aesthetics
    let industry: number = cost.industry
    aesthetics -= pub.aesthetics;
    industry -= pub.industry;
    log.push(`|${targetCard.cardId}|i:${industry}|a:${aesthetics}`);
    if (pub.school !== null) {
        let schoolCard = getCardById(pub.school);
        log.push(`|school:${schoolCard.name}|aes:${schoolCard.aesthetics}|ind:${schoolCard.industry}`);
        aesthetics -= schoolCard.aesthetics;
        industry -= schoolCard.industry
        if (targetCard.type === CardType.S) {
            let extraCost: number = schoolCard.era + 1
            log.push(`|oldSchoolExtra:${extraCost}`);
            resRequired += extraCost;
        }
    }
    for (const helperId of arg.helper) {
        let helperCard = getCardById(helperId) as INormalOrLegendCard;
        log.push(`|${helperCard.name}`);
        industry -= helperCard.industry;
        aesthetics -= helperCard.aesthetics;
        log.push(`|i:${industry}|a:${aesthetics}`);
    }
    if (aesthetics > 0) {
        log.push(("Lack aesthetics " + aesthetics));
        resRequired += aesthetics * 2;
    }
    if (industry > 0) {
        log.push(("Lack industry " + industry));
        resRequired += industry * 2;
    }
    if (pub.school === SchoolCardID.S2201 && targetCard.type === CardType.F && targetCard.aesthetics > 0) {
        log.push(("|NewRealismDeduct"));
        if (resRequired < 2) {
            resRequired = 0;
        } else {
            resRequired -= 2;
        }
    }
    log.push(`|${resRequired}`);
    console.warn(`${G.matchID}|${log.join('')}`);
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

export const fillTwoPlayerBoard = (G: IG): CardID[] => {
    const log = ['fillTwoPlayerBoard'];
    const filledCards = [];
    const s = G.secretInfo.twoPlayer.school;
    for (let slotL of G.twoPlayer.school) {
        if (slotL.card === null) {
            let newCard = s.pop()
            if (newCard === undefined) {
                log.push(`|slotEmpty`);
            } else {
                log.push(`|fillSchool|${newCard}`);
                filledCards.push(newCard);
                slotL.card = newCard;
            }
        }
    }
    let f = G.secretInfo.twoPlayer.film;
    for (let slotL of G.twoPlayer.film) {
        if (slotL.card === null) {
            let newCard = f.pop()
            if (newCard === undefined) {
                log.push(`|slotEmpty`);
            } else {
                log.push(`|fillFilm|${newCard}`);
                filledCards.push(newCard);
                slotL.card = newCard as ClassicCardID;
            }
        }
    }
    log.push(`|filledCards|${filledCards}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return filledCards;
}
export const drawForTwoPlayerEra = (G: IG, ctx: Ctx, e: IEra): void => {
    const log = [`drawForTwoPlayerEra|era${e + 1}`];
    let school = schoolCardsByEra(e).map(c => c.cardId);
    let filmCards = filmCardsByEra(e).map(c => c.cardId);
    const schoolDeckSize: number = TwoPlayerCardCount[e].school;
    const filmDeckSize: number = TwoPlayerCardCount[e].film;
    G.secretInfo.twoPlayer.school = shuffle(ctx, school).slice(0, schoolDeckSize);
    G.secretInfo.twoPlayer.film = shuffle(ctx, filmCards).slice(0, filmDeckSize);
    log.push(`|school|${schoolDeckSize}${JSON.stringify(G.secretInfo.twoPlayer.school)}`);
    log.push(`|film|${filmDeckSize}|${JSON.stringify(G.secretInfo.twoPlayer.film)}`);
    for (let s of G.twoPlayer.film) {
        let c = G.secretInfo.twoPlayer.film.pop();
        if (c === undefined) {
            throw new Error(c);
        } else {
            log.push(`|pop|${c}`);
            s.card = c;
        }
    }
    for (let s of G.twoPlayer.school) {
        let c = G.secretInfo.twoPlayer.school.pop();
        if (c === undefined) {
            throw new Error(c);
        } else {
            log.push(`|pop|${c}`);
            s.card = c;
        }
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
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

export const drawPeekCardForPlayer = (G: IG, ctx: Ctx, id: PlayerID): void => {
    const pid = parseInt(id);
    const log = [`drawPeekCardForPlayer|p${id}`];
    const p = G.player[pid]
    const pub = G.pub[pid]
    const s = G.secretInfo.playerDecks[pid]
    log.push(`|${JSON.stringify(s)}`);
    if (s.length === 0) {
        G.secretInfo.playerDecks[pid] = shuffle(ctx, pub.discard);
        log.push(`|shuffledDeck|${JSON.stringify(s)}`);
        pub.discard = [];
    }
    let card = G.secretInfo.playerDecks[pid].pop();
    if (card === undefined) {
        log.push(`|deckEmpty`);
        log.push(`|${JSON.stringify(s)}`);
    } else {
        log.push(`|${card}`);
        p.cardsToPeek.push(card);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const drawCardForPlayer = (G: IG, ctx: Ctx, id: PlayerID): void => {
    const log = [`drawCardForPlayer${id}`];
    const i = G.competitionInfo;
    if (i.pending) {
        log.push(`|inCompetition`);
    }
    const pid = parseInt(id);
    const p = G.player[pid]
    const pub = G.pub[pid]
    let s = G.secretInfo.playerDecks[pid]
    if (s.length === 0) {
        G.secretInfo.playerDecks[pid] = shuffle(ctx, pub.discard);
        log.push(`|shuffledDeck|${JSON.stringify(s)}`);
        pub.discard = [];
    }
    let card = G.secretInfo.playerDecks[pid].pop();
    if (card === undefined) {
        log.push(`|deckEmpty`);
    } else {
        log.push(`|${card}`);
        p.hand.push(card);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}
export const fillPlayerHand = (G: IG, ctx: Ctx, p: PlayerID): void => {
    const log = [`p${p}|fillPlayerHand`];
    const limit = getSchoolHandLimit(G, p);
    log.push(`|limit${limit}`);
    let handCount: number = G.player[parseInt(p)].hand.length;
    log.push(`|hand${handCount}`);
    if (handCount < limit) {
        let drawCount: number = limit - handCount;
        log.push(`|draw${drawCount}`);
        for (let t = 0; t < drawCount; t++) {
            drawCardForPlayer(G, ctx, p);
        }
    } else {
        log.push(`|doNotDraw`);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}
export const canHelp = (G: IG, ctx: Ctx, p: PlayerID, target: ClassicCardID | BasicCardID, helper: CardID): boolean => {
    const pub = G.pub[parseInt(p)];
    const helperCard = getCardById(helper);
    const targetCard = getCardById(target);
    let aes = pub.aesthetics
    let ind = pub.industry
    if (pub.school !== null) {
        aes += getCardById(pub.school).aesthetics;
        ind += getCardById(pub.school).industry;
    }
    const aesMark = aes < targetCard.cost.aesthetics && helperCard.aesthetics > 0;
    const industryMark = ind < targetCard.cost.industry && helperCard.industry > 0;
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

// export const do2pUpdateSchoolSlot = (G: IG, ctx: Ctx, slot: ICardSlot): void => {
//     if (G.twoPlayer.era !== IEra.TWO) {
//         // 2p rule only show 2 school card for Era 1 and 3
//         // do not need to drawNewCard if not era two
//         if (slot.comment !== null) {
//             let commentId: BasicCardID = slot.comment;
//             G.basicCards[commentId]++;
//             slot.comment = null;
//         }
//         return;
//     } else {
//         let d;
//         d = G.secretInfo.twoPlayer.school;
//         if (d.length === 0) {
//             return;
//         } else {
//             let oldCard = slot.card;
//             let c = d.pop();
//             if (c !== undefined) {
//                 slot.card = c;
//             }
//             if (oldCard !== null) {
//                 d.push(oldCard as SchoolCardID);
//             }
//         }
//     }
// }
// export const do2pUpdateFilmSlot = (G: IG, ctx: Ctx, slot: ICardSlot): void => {
//     let d;
//     if (slot.comment !== null) {
//         let commentId: BasicCardID = slot.comment as BasicCardID;
//         G.basicCards[commentId]++;
//         slot.comment = null;
//     }
//     d = G.secretInfo.twoPlayer.school;
//     if (d.length === 0) {
//         return;
//     } else {
//         let oldCard = slot.card;
//         let c = d.pop();
//         if (c !== undefined) {
//             slot.card = c as unknown as ClassicCardID;
//         }
//         if (oldCard !== null) {
//             d.push(oldCard as unknown as SchoolCardID);
//         }
//     }
// }

export const fillEmptySlots = (G: IG): CardID[] => {
    const log = ["fillEmptySlots"];
    const filledCards = [];
    for (let r of valid_regions) {
        log.push(`|fill|${r}`);
        const region = G.regions[r];
        if (region.completedModernScoring) {
            log.push(`|noNotSetUpAfterModernScoring`);
            continue;
        }
        const l = G.secretInfo.regions[r].legendDeck;
        const n = G.secretInfo.regions[r].normalDeck;
        if (region.legend.card === null) {
            if (l.length > 0) {
                const c = l.pop();
                log.push(`|fillLegend|${c}`);
                if (c === undefined) {
                    throw Error("Legend deck empty")
                } else {
                    filledCards.push(c);
                    region.legend.card = c;
                }
            }
        }
        for (let slot of region.normal) {
            if (slot.card === null && n.length > 0) {
                const c = n.pop();
                log.push(`|fillNormal|${c}`);
                if (c !== undefined) {
                    filledCards.push(c);
                    slot.card = c;
                }
            }
        }
    }
    log.push(`|filledCards|${filledCards}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return filledCards;
}

export const doReturnSlotCard = (G: IG, ctx: Ctx, slot: ICardSlot): void => {
    const log = ["doReturnSlotCard"];
    let d: ClassicCardID[];
    if (slot.comment !== null) {
        log.push(`|hasComment|${slot.comment}`);
        let commentId: BasicCardID = slot.comment as BasicCardID;
        log.push(`|returnComment${commentId}`);
        G.basicCards[commentId]++;
        slot.comment = null;
    }
    log.push(`|comment${slot.comment}`);
    if (slot.card === null) {
        log.push(`|emptySlot`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        return;
    }
    if (ctx.numPlayers > SimpleRuleNumPlayers) {
        if (slot.region === Region.NONE) return;
        if (slot.isLegend) {
            log.push(`|legend`);
            d = G.secretInfo.regions[slot.region].legendDeck;
        } else {
            log.push(`|normal`);
            d = G.secretInfo.regions[slot.region].normalDeck;
        }
        log.push(`${JSON.stringify(d)}`);
    } else {
        log.push(`|simpleRule`);
        if (getCardById(slot.card).type === CardType.S) {
            log.push(`|school`);
            d = G.secretInfo.twoPlayer.school as unknown as ClassicCardID[];
        } else {
            log.push(`|film`);
            d = G.secretInfo.twoPlayer.film;
        }
        log.push(`${JSON.stringify(d)}`);
    }
    let oldCard = slot.card;
    log.push(`|return${oldCard}`);
    if (oldCard !== null) {
        d.unshift(oldCard);
        log.push(`|putToBottom|${JSON.stringify(d)}`);
        slot.card = null;
    } else {
        throw new Error("Updating an empty slot!")
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const additionalCostForUpgrade = (G: IG, level: number): number => {
    const log = [`additionalCostForUpgrade|${level}`];
    if (level <= 2) {
        log.push(`|cost:0`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        return 0;
    } else {
        if (level <= 5) {
            log.push(`|cost:1`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return 1;
        } else {
            log.push(`|cost:2`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return 2;
        }
    }
}

export const legendCount = (G: IG, r: Region, e: IEra, p: PlayerID): number => {
    return G.pub[parseInt(p)].allCards
        .filter(c =>
            getCardById(c).category === CardCategory.LEGEND
            && getCardById(c).region === r
            && getCardById(c).era === e)
        .length;
}


export const do2pRegionScoring = (G: IG, ctx: Ctx, r: ValidRegion): void => {
    let firstPlayer = 1
    if (G.pub[0].shares[r] > G.pub[1].shares[r]) {
        firstPlayer = 0
    }
    if (G.pub[0].shares[r] === G.pub[1].shares[r]) {
        firstPlayer = ctx.currentPlayer === "0" ? 0 : 1;
    }
    const scoreCard = getScoreCard(r, IEra.THREE, 1);
    // score card of current region
    // const scoreCard = getScoreCard(r, G.twoPlayer.era, 1);
    G.pub[firstPlayer].discard.push(scoreCard.cardId as ScoreCardID);
    G.pub[firstPlayer].allCards.push(scoreCard.cardId as ScoreCardID);
    G.pub[0].shares[r] = 0;
    G.pub[1].shares[r] = 0;
    // G.regions[r].share = ShareOnBoard[r][IEra.THREE];
    G.regions[r].completedModernScoring = true;
}

export const try2pScoring = (G: IG, ctx: Ctx): void => {
    const log = [`try2pScoring`];
    valid_regions.forEach(r => {
        let regObj = G.regions[r];
        if (regObj.share === 0 && !regObj.completedModernScoring) {
            do2pRegionScoring(G, ctx, r);
        }
    })
    if (
        G.pending.lastRoundOfGame &&
        ctx.currentPlayer === getExistingLastMovePlayer(G)
    ) {
        log.push("|finalScoring");
        logger.debug(`${G.matchID}|${log.join('')}`);
        finalScoring(G, ctx);
        return
    }
    if (
        G.twoPlayer.film.every(c => c.card === null)
        && initialPosOfPlayer(G, ctx, ctx.currentPlayer) === 1
    ) {
        valid_regions.forEach(r => {
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
            // Score remain regions before final scoring
            valid_regions.forEach(r => {
                let regObj = G.regions[r];
                if (!regObj.completedModernScoring) {
                    do2pRegionScoring(G, ctx, r);
                }
            })
            finalScoring(G, ctx);
            return
        }
    } else {
        fillTwoPlayerBoard(G);
        signalEndTurn(G, ctx);
        return;
    }
}

export const tryScoring = (G: IG, ctx: Ctx): void => {
    const log = ["tryScoring"];
    if (G.scoringRegions.length > 0) {
        const r = G.scoringRegions.shift();
        G.currentScoreRegion = r as ValidRegion;
        log.push(`|region|${r}`);
        log.push("|regionRank");
        G.pending.nextEraRegions.push(r as ValidRegion);
        log.push(`|nextEraRegions|${JSON.stringify(G.pending.nextEraRegions)}`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        regionRank(G, ctx, r as Region);
        return;
    } else {
        log.push("|noRegion");
        if (
            G.pending.lastRoundOfGame &&
            ctx.currentPlayer === getExistingLastMovePlayer(G)
        ) {
            log.push("|finalScoring");
            logger.debug(`${G.matchID}|${log.join('')}`);
            finalScoring(G, ctx);
            return;
        } else {
            log.push(`|setupForNextEra`);
            setupAfterScoring(G, ctx);
            log.push("|fillEmptySlots");
            if (ctx.numPlayers > SimpleRuleNumPlayers) {
                fillEmptySlots(G);
            } else {
                fillTwoPlayerBoard(G)
            }
            log.push("|signalEndStage&Turn");
            logger.debug(`${G.matchID}|${log.join('')}`);
            signalEndStage(G, ctx);
            signalEndTurn(G, ctx);
            return;
        }
    }
};

export const passCompensateMarker = (G: IG) => {
    const log = [`passCompensateMarker`];
    const markPos = G.order.indexOf(G.regionScoreCompensateMarker);
    log.push(`|p${G.regionScoreCompensateMarker}|markPos|${markPos}`);
    if (markPos > 0) {
        G.regionScoreCompensateMarker = G.order[markPos - 1];
        log.push(`|passTo|p${G.regionScoreCompensateMarker}|${markPos - 1}`);
    } else {
        G.regionScoreCompensateMarker = G.order[G.order.length - 1];
        log.push(`|passTo|p${G.regionScoreCompensateMarker}|${G.order.length - 1}`);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const regionRanker = (G: IG, ctx: Ctx, r: ValidRegion, era: IEra) => {
    return (a: PlayerID, b: PlayerID): number => {
        const log = [`rank|${a}|${b}`];
        let p1 = G.pub[parseInt(a)];
        let p2 = G.pub[parseInt(b)];
        const as = p1.shares[r];
        const bs = p2.shares[r];
        log.push(`|share|${as}|${bs}`);
        if (as > bs) {
            log.push(`|share|p${a}win`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return -1;
        }
        if (as < bs) {
            log.push(`|share|p${b}win`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return 1;
        }
        log.push(`|sameShare`);
        const legendCountA = legendCount(G, r, era, a);
        const legendCountB = legendCount(G, r, era, b);
        log.push(`|legendCount|${legendCountA}|${legendCountB}`);
        if (legendCountA > legendCountB) {
            log.push(`|legendCount|p${a}win`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return -1;
        }
        if (legendCountA < legendCountB) {
            log.push(`|legendCount|p${b}win`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return 1;
        }
        log.push(`|sameLegendCount`);
        const curPos = seqFromActivePlayer(G, ctx);
        const posA = curPos.indexOf(a);
        const posB = curPos.indexOf(b);
        log.push(`|pos|${posA}|${posB}`);
        if (posA > posB) {
            log.push(`|pos|p${b}win`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return 1;
        } else {
            if (posA < posB) {
                log.push(`|pos|p${a}win`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                return -1;
            } else {
                return a < b ? -1 : 1
            }
        }
    };
}

export const getRegionRank = (G: IG, ctx: Ctx, r: ValidRegion): PlayerID[] => {
    const log = ["getRegionRank"];
    const era = G.regions[r].era;
    const rankingPlayer: PlayerID[] = [];
    G.order.forEach((i, idx) => {
        log.push(`|p${idx}|share${G.pub[idx].shares[r]}`);
        if (G.pub[idx].shares[r] === 0) {
            log.push("|badFilm");
        } else {
            log.push(`|rank`);
            rankingPlayer.push(idx.toString())
        }
    });
    log.push(`|rankingPlayer|${JSON.stringify(rankingPlayer)}`);
    const result = rankingPlayer.sort(regionRanker(G, ctx, r, era));
    log.push(`|result|${JSON.stringify(result)}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return result;
}

export const getPlayerRegionRank = (G: IG, ctx: Ctx, pid: PlayerID, r: ValidRegion): number => {
    const pub = G.pub[parseInt(pid)]
    if (pub.shares[r] === 0) {
        return -1
    } else {
        const rankResult = getRegionRank(G, ctx, r);
        return rankResult.indexOf(pid);
    }
}

export const regionRank = (G: IG, ctx: Ctx, r: Region): void => {
    if (r === Region.NONE) return;
    let era = G.regions[r].era;
    const eraShareReturnVp = era + 1;
    const log = [`regionRank|region${r}|era${era}`];
    G.order.forEach((i, idx) => {
        const playerIdx = parseInt(i);
        const playerShareCount = G.pub[playerIdx].shares[r];
        log.push(`|orderIdx${idx}|playerIdx${playerIdx}|p${i}|i${i}|share${playerShareCount}`);
        if (playerShareCount === 0) {
            log.push("|badFilm");
            doBuy(G, ctx, B04, i);
        } else {
            addVp(G, ctx, i, playerShareCount * eraShareReturnVp);
            log.push(`|rank`);
        }
    });
    const rankResult = getRegionRank(G, ctx, r);
    log.push(`|rankResult|${rankResult}`);
    const firstPlayer: PlayerID = rankResult[0];
    G.pending.firstPlayer = firstPlayer;
    log.push(`|G.pending.firstPlayer|${G.pending.firstPlayer}`);
    log.push(`|firstPlayer:${firstPlayer}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    G.pub[parseInt(firstPlayer)].champions.push({
        era: era,
        region: r,
    })
    let scoreCount = scoreCardCount(r, era);

    log.push(`|scoreCount:${scoreCount}`);
    let scoreCardPlayerCount = Math.min(rankResult.length, scoreCount)
    if (ctx.numPlayers === 3) {
        if (scoreCardPlayerCount > 2) {
            scoreCardPlayerCount = 2;
        }
    }
    log.push(`|scoreCardPlayerCount:${scoreCardPlayerCount}`);
    for (let i = 0; i < scoreCardPlayerCount; i++) {
        let scoreId = "V" + (era + 1).toString() + (r + 1).toString() + (i + 1).toString()
        log.push(`|p${i}|${scoreId}`);
        G.pub[parseInt(rankResult[i])].discard.push(scoreId as ScoreCardID)
        G.pub[parseInt(rankResult[i])].allCards.push(scoreId as ScoreCardID)
    }
    for (let i = scoreCardPlayerCount; i < rankResult.length; i++) {
        log.push(`|p${i}|bad film`);
        doBuy(G, ctx, B04, rankResult[i])
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
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
    const log = ["fillEventCard"];
    log.push(`|eventDeck|${JSON.stringify(G.secretInfo.events)}`);
    let newEvent = G.secretInfo.events.pop();
    log.push(`|afterDeck|${JSON.stringify(G.secretInfo.events)}`);
    let era = getCardById(G.events[0]).era;
    log.push(`|events:${JSON.stringify(G.events)}`);

    if (newEvent === undefined) {
        log.push("|emptyEventDeck");
    } else {
        log.push(`|newEvent:${newEvent}`);
        G.events.push(newEvent)
        log.push(`|events:${JSON.stringify(G.events)}`);
    }
    let newEra = era === IEra.THREE ? era : era + 1;
    log.push(`|era${era}|newEra${newEra}`);

    if (G.events.length <= 1) {
        if (G.events[0] === "E03") {
            log.push(`|E03Discarded`);
            G.activeEvents.push(EventCardID.E03);
            G.order.forEach((i, idx) => {
                if (G.pub[idx].action < 2) G.pub[idx].action = 2
            });
        }
        G.events = [];
        if (newEra !== era) {
            log.push(`|fillNewEraEvents|${newEra}`);
            doFillNewEraEventDeck(G, ctx, newEra);
            log.push(`|newEventDeck|${JSON.stringify(G.secretInfo.events)}`);
        }
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export function doIndustryBreakthrough(G: IG, ctx: Ctx, player: PlayerID) {
    const log = [`doIndustryBreakthrough|p${player}`];
    if (G.e.stack.length > 0) {
        let top = G.e.stack.pop();
        log.push(`|stack|${JSON.stringify(top)}`);
        if (top !== undefined && top.e === "industryAndAestheticsBreakthrough") {
            log.push(`|top:${top.a.industry}`);
            top.a.industry--;
        }
        G.e.stack.push(top);
    }
    const p = G.pub[parseInt(player)];
    const totalResource = p.resource + p.deposit;
    const additionalCost = additionalCostForUpgrade(G, p.industry);
    if (additionalCost <= totalResource && p.industry < 10) {
        log.push(`|${additionalCost}|canUpgrade`);
        G.e.choices.push({e: "industryLevelUpCost", a: 1});
    }
    if (p.industry > p.competitionPower) {
        log.push(`|${additionalCost}|canAddCompetitionPower`);
        G.e.choices.push({e: SimpleEffectNames.addCompetitionPower, a: 2});
    }
    if (ctx.numPlayers > SimpleRuleNumPlayers) {
        if (totalResource >= 3 && studioSlotsAvailable(G, ctx, player).length > 0) {
            log.push(`|studio`);
            G.e.choices.push({e: "buildStudio", a: 1})
        }
        if (totalResource >= 3 && cinemaSlotsAvailable(G, ctx, player).length > 0) {
            log.push(`|cinema`);
            G.e.choices.push({e: "buildCinema", a: 1})
        }
    }
    G.e.choices.push({e: "skipBreakthrough", a: 1})
    log.push("chooseEffect");
    logger.debug(`${G.matchID}|${log.join('')}`);
    changeStage(G, ctx, "chooseEffect")
}

export function doAestheticsBreakthrough(G: IG, ctx: Ctx, player: PlayerID) {
    const log = [`doAestheticsBreakthrough|p${player}|`];
    if (G.e.stack.length > 0) {
        let top = G.e.stack.pop();
        log.push(`|stack|${JSON.stringify(top)}`);
        if (top !== undefined && top.e === "industryAndAestheticsBreakthrough") {
            log.push(`|top:${top.a.aesthetics}`);
            top.a.aesthetics--;
        }
        G.e.stack.push(top);
    }
    const p = G.pub[parseInt(player)];
    const playerObj = G.player[parseInt(player)];
    const totalResource = p.resource + p.deposit;
    const additionalCost = additionalCostForUpgrade(G, p.aesthetics);
    if (additionalCost <= totalResource && p.aesthetics < 10) {
        log.push(("|Can upgrade aesthetics"));
        G.e.choices.push({e: "aestheticsLevelUpCost", a: 1})
    }
    if (playerObj.hand.length > 0) {
        log.push(("|Can refactor"));
        G.e.choices.push({e: "refactor", a: 1})
    }
    G.e.choices.push({e: "skipBreakthrough", a: 1})
    log.push("|chooseEffect");
    logger.debug(`${G.matchID}|${log.join('')}`);
    changeStage(G, ctx, "chooseEffect")
}

export const regionEraProgress = (G: IG, ctx: Ctx) => {
    const log = ["regionEraProgress"];
    const r = G.currentScoreRegion;
    log.push(`|region|${r}`);
    if (r === Region.NONE) {
        logger.error("noScoringRegion");
        logger.debug(`${G.matchID}|${log.join('')}`);
        return;
    }
    if (!G.pending.nextEraRegions.includes(r)) {
        G.pending.nextEraRegions.push(r as ValidRegion);
    }
    G.currentScoreRegion = Region.NONE;
    log.push(`|nextEraRegions|${JSON.stringify(G.pending.nextEraRegions)}`);
    log.push("|tryScoring");
    logger.debug(`${G.matchID}|${log.join('')}`);
    tryScoring(G, ctx);
    return;
}

export const regionScoringCheck = (G: IG, ctx: Ctx, arg: PlayerID) => {
    const log = [`regionScoringCheck|${arg}`];
    valid_regions.forEach(r => {
        if (r === Region.ASIA && G.regions[Region.ASIA].era === IEra.ONE) {
            log.push(`|asiaNotShown|skip`);
            // return in forEach exit current iteration
            return;
        }
        const canScore = checkRegionScoring(G, ctx, r);
        if (canScore) {
            log.push(`|region${r}|canScore`);
            G.scoringRegions.push(r)
        }
    });
    log.push(`|scoreRegions|${JSON.stringify(G.scoringRegions)}`);
    if (ctx.numPlayers > SimpleRuleNumPlayers) {
        log.push("|tryScoring");
        logger.debug(`${G.matchID}|${log.join('')}`);
        tryScoring(G, ctx);
    } else {
        log.push("|try2pScoring");
        logger.debug(`${G.matchID}|${log.join('')}`);
        try2pScoring(G, ctx);
    }
    log.push(`|noRegionsToScore`);
    logger.debug(`${G.matchID}|${log.join('')}`);
}


export const setupAfterScoring = (G: IG, ctx: Ctx) => {
    const log = [`setupAfterScoring`];
    const regionsToSetup = G.pending.nextEraRegions;
    if (regionsToSetup.length > 0) {
        for (let r of regionsToSetup) {
            log.push(`|setupFor|region|${r}`);
            nextEra(G, ctx, r);
        }
        if (valid_regions.filter(r =>
                G.regions[r].era !== IEra.ONE).length >= 2 &&
            G.regions[Region.ASIA].era === IEra.ONE
        ) {
            log.push("|setUpAsia");
            drawForRegion(G, ctx, Region.ASIA, IEra.TWO);
            G.regions[Region.ASIA].era = IEra.TWO;
            G.regions[Region.ASIA].share = ShareOnBoard[Region.ASIA][IEra.TWO];
            if (ctx.numPlayers === 3) {
                G.regions[Region.ASIA].share--;
            }
        }
    } else {
        log.push(`|noRegionsToSetup`);
    }
    G.pending.nextEraRegions = [];
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const getPlayerAction = (G: IG, arg: PlayerID): number => {
    const log = [`endTurnEffect|p${arg}`];
    const pub = G.pub[parseInt(arg)];
    let act: number;
    if (pub.school !== null) {
        let schoolId = pub.school;
        log.push(`|school|${schoolId}`);
        act = getCardEffect(schoolId).school.action;
    } else {
        act = 1;
    }
    if (G.activeEvents.includes(EventCardID.E03)) {
        log.push(`|Avant-Grade`);
        if (act < AvantGradeAP) {
            log.push(`|${AvantGradeAP}AP`);
            act = AvantGradeAP;
        }
    }
    log.push(`|finalActionPoint|${act}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return act;
}

export const endTurnEffect = (G: IG, ctx: Ctx, arg: PlayerID) => {
    const log = [`endTurnEffect|p${arg}`];
    const pub = G.pub[parseInt(arg)]
    pub.playedCardInTurn.forEach(c => pub.discard.push(c));
    pub.playedCardInTurn = [];
    pub.revealedHand = [];
    pub.resource = 0;
    if (pub.deposit > 10) {
        log.push(`|depositLimitExceeded|${pub.deposit}`);
        pub.deposit = 10;
    }
    log.push(`|restore`);
    pub.newHollyWoodUsed = false;
    pub.action = getPlayerAction(G, arg);
    fillPlayerHand(G, ctx, ctx.currentPlayer);
    log.push(`| execute development rewards`);
    log.push(`|aesAwardEndTurn`);
    aesAwardEndTurn(G, ctx, ctx.currentPlayer);
    log.push(`|industryAwardEndTurn`);
    industryAwardEndTurn(G, ctx, ctx.currentPlayer);
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export function checkNextEffect(G: IG, ctx: Ctx) {
    const log = ["checkNextEffect"];
    if (G.e.stack.length === 0) {
        log.push(("|stackEmpty"));
        if (G.currentScoreRegion === Region.NONE) {
            log.push(("|No scoring region"));
            {
                if (G.player[parseInt(ctx.currentPlayer)].endTurnEffectExecuted) {
                    log.push(`|endTurnEffectExecuted`);
                    G.player[parseInt(ctx.currentPlayer)].endTurnEffectExecuted = false
                    regionScoringCheck(G, ctx, ctx.currentPlayer);
                    logger.debug(`${G.matchID}|${log.join('')}`);
                    return
                } else {
                    log.push(`|setup`);
                    setupAfterScoring(G, ctx);
                    if (ctx.activePlayers !== null) {
                        log.push("|signalEndStage");
                        signalEndStage(G, ctx);
                        logger.debug(`${G.matchID}|${log.join('')}`);
                        return;
                    } else {
                        log.push(`|notInStage|doNothing|waitingForPlayerMove`);
                        logger.debug(`${G.matchID}|${log.join('')}`);
                        return;
                    }
                }
            }
        } else {
            log.push("|regionEraProgress");
            logger.debug(`${G.matchID}|${log.join('')}`);
            regionEraProgress(G, ctx);
            return;
        }
    } else {
        const nextEff = G.e.stack.slice(-1)[0];
        log.push(`|stackNotEmpty|Next effect|${JSON.stringify(nextEff)}`);
        let targetPlayer = ctx.currentPlayer
        if (nextEff.hasOwnProperty("target")) {
            targetPlayer = nextEff.target;
        }
        log.push(`|target|${targetPlayer}`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        playerEffExec(G, ctx, targetPlayer);
    }
}

export const addCompetitionPower = (G: IG, ctx: Ctx, p: PlayerID, num: number) => {
    const log = [`p${p}|addCompetitionPower|${num}`];
    const pub = G.pub[parseInt(p)];
    log.push(`|before|${pub.competitionPower}`);
    const targetCompetitionPower = pub.competitionPower + num;
    if (targetCompetitionPower > pub.industry) {
        log.push(`|TargetCompetitionPower|${targetCompetitionPower}|exceedIndustryLevel|${pub.industry}`);
        pub.competitionPower = pub.industry;
    } else {
        pub.competitionPower += num;
    }
    log.push(`|after|${pub.competitionPower}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const loseCompetitionPower = (G: IG, ctx: Ctx, p: PlayerID, num: number) => {
    const log = [`p${p}|loseCompetitionPower|${num}`];
    let pub = G.pub[parseInt(p)];
    log.push(`|before|${pub.competitionPower}`);
    if (num > pub.competitionPower) {
        log.push(`|CompetitionPower|${pub.competitionPower}|insufficient`);
        pub.competitionPower = 0;
    } else {
        pub.competitionPower -= num;
    }
    log.push(`|after|${pub.competitionPower}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const addRes = (G: IG, ctx: Ctx, p: PlayerID, res: number) => {
    const log = [`addRes|p${p}`];
    const pub = G.pub[parseInt(p)];
    {
        log.push(`|before|${pub.resource}`);
        pub.resource += res;
        log.push(`|after|${pub.resource}`);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const addVp = (G: IG, ctx: Ctx, p: PlayerID, vp: number) => {
    const log = [`p${p}|add${vp}vp|`];
    const pub = G.pub[parseInt(p)];
    log.push(`|prev|${pub.vp}`);
    pub.vp += vp;
    log.push(`|after|${pub.vp}`);
    let count = 0;
    if (pub.vp >= 40 && !pub.vpAward.v60) {
        log.push(`|v40`);
        count++;
        pub.vpAward.v60 = true;
    }
    if (pub.vp >= 80 && !pub.vpAward.v90) {
        log.push(`|v80`);
        count++;
        pub.vpAward.v90 = true;
    }
    if (pub.vp >= 120 && !pub.vpAward.v120) {
        log.push(`|v120`);
        count++;
        pub.vpAward.v120 = true;
    }
    if (pub.vp >= 150 && !pub.vpAward.v150) {
        log.push(`|v150`);
        pub.vpAward.v150 = true;
        G.pending.lastRoundOfGame = true;
    }
    if (count > 0) {
        log.push(`|stack|${JSON.stringify(G.e.stack)}`);
        G.e.stack.push({e: "industryOrAestheticsLevelUp", a: count, target: p})
        log.push(`|push|industryOrAestheticsLevelUp`);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const loseDeposit = (G: IG, ctx: Ctx, p: PlayerID, deposit: number) => {
    const log = [`p${p}|loseDeposit|${deposit}`];
    let pub = G.pub[parseInt(p)];
    log.push(`|before|${pub.deposit}`);
    // if (G.competitionInfo.pending) {
    //     log.push(`|inCompetition|exit`);
    //     logger.debug(`${G.matchID}|${log.join('')}`);
    // }
    if (deposit >= pub.deposit) {
        pub.deposit = 0;
    } else {
        pub.deposit -= deposit;
    }
    log.push(`|after|${pub.deposit}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const loseVp = (G: IG, ctx: Ctx, p: PlayerID, vp: number) => {
    const log = [`loseVp|${p}|${vp}`];
    const pub = G.pub[parseInt(p)];
    log.push(`|before|${pub.vp}`);
    const realVpLose: number = vp >= pub.vp ? pub.vp : vp;
    // if (G.competitionInfo.pending) {
    //     log.push(`|inCompetition|noVpDeduct`);
    // } else {
    // }
    pub.vp -= realVpLose;
    if (realVpLose > 0 && pub.school === SchoolCardID.S2104 && ctx.currentPlayer === p) {
        log.push(`|FilmNoir|before|${pub.resource}`);
        addRes(G, ctx, p, realVpLose);
        log.push(`|after|${pub.resource}`);
    }
    log.push(`|after|${pub.vp}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const buildBuildingFor = (G: IG, ctx: Ctx, r: ValidRegion, p: PlayerID, building: BuildingType): void => {
    const log = [`buildBuildingFor|p${p}|${r}`];
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
                log.push(`|cinema`);
                pub.building.cinemaBuilt = true;
            } else {
                log.push(`|studio`);
                pub.building.studioBuilt = true;
            }
            slot.building = building;
            log.push(`|built|on|slot${idx}`);
            built = true;
        }
    })
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const competitionCleanUp = (G: IG, ctx: Ctx) => {
    const log = [`competitionCleanUp|checkNextEffect`];
    let i = G.competitionInfo;
    i.pending = false;
    i.region = Region.NONE;
    i.progress = 0;
    i.atkCard = null;
    i.defCard = null;
    i.atkPlayedCard = false;
    i.defShownCards = [];
    i.defPlayedCard = false;
    i.onWin = {e: "none", a: 1};
    logger.debug(`${G.matchID}|${log.join('')}`);
    // checkNextEffect(G, ctx);
    // return;
}

export function competitionResultSettle(G: IG, ctx: Ctx) {
    const i = G.competitionInfo;
    const log = [`competitionResultSettle|atk:p${i.atk}|def:p${i.def}`];
    if (i.progress > 0) {
        // TODO: change to hook
        const atkSchoolID = G.pub[parseInt(i.atk)].school;
        switch (atkSchoolID) {
            case SchoolCardID.S3101:
                log.push('|3101')
                G.e.stack.push({e: SimpleEffectNames.res, a: 2});
                break;
            default:
                log.push(`|schoolID|${atkSchoolID}`)
                break;
        }
        if (i.onWin.e !== "none") {
            log.push(`|onWin|${JSON.stringify(i.onWin)}`);
            G.e.stack.push({...i.onWin})
        }
        log.push(`|stack|${JSON.stringify(G.e.stack)}`);
        log.push(`|getShareFromLoser`);
        G.e.stack.push({
            e: ItrEffects.anyRegionShareCompetition, a: 1
        })
        log.push(`|stack|${JSON.stringify(G.e.stack)}`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        playerEffExec(G, ctx, i.atk);
        return;
    } else {
        log.push(`|noWinner|competitionCleanUp|checkNextEffect`);
        log.push(`|stack|${JSON.stringify(G.e.stack)}`);
        competitionCleanUp(G, ctx);
        logger.debug(`${G.matchID}|${log.join('')}`);
        checkNextEffect(G, ctx);
        return;
    }
}

export function atkCardSettle(G: IG, ctx: Ctx) {
    let i = G.competitionInfo;
    let cards = G.player[parseInt(i.atk)].competitionCards;
    const log = [`atkCardSettle`];
    if (cards.length > 0) {
        const cardId = cards[0];
        i.atkCard = cardId;
        const pub = G.pub[parseInt(i.atk)];
        pub.playedCardInTurn.push(cardId);
        G.player[parseInt(i.atk)].competitionCards = []
        log.push(`|${cardId}`);
        const card = getCardById(cardId);
        const industryMarkCount = card.industry;
        log.push(`|industryMarkCount:${industryMarkCount}`);
        i.progress += industryMarkCount;
        log.push(`|${i.progress}`);
        if (cinemaInRegion(G, ctx, card.region, i.atk) && card.type === CardType.F) {
            log.push(`|cinemaInRegion|${card.region}|${i.progress}`);
            i.progress++;
            log.push(`|after|${i.progress}`);
        }
        const cardEff = getCardEffect(cardId);
        if (cardEff.hasOwnProperty("play")) {
            const eff = {...cardEff.play};
            if (eff.e !== "none") {
                eff.target = i.atk;
                log.push(`|${JSON.stringify(eff)}`);
                G.e.stack.push(eff)
            } else {
                log.push(`|emptyPlayEffect`);
            }
        } else {
            log.push(`|noPlayEffect`);
        }
        G.e.card = cardId;
        logger.debug(`${G.matchID}|${log.join('')}`);
        // TODO may over run set a barrier effect?
        playerEffExec(G, ctx, i.atk);
    } else {
        log.push("|atkNoCard|defCardSettle");
        logger.debug(`${G.matchID}|${log.join('')}`);
        defCardSettle(G, ctx);
    }
}

export const defCardSettle = (G: IG, ctx: Ctx) => {
    const log = ["defCardSettle"];
    const i = G.competitionInfo;
    const cards = G.player[parseInt(i.def)].competitionCards;
    if (cards.length > 0) {
        drawCardForPlayer(G, ctx, i.def);
        const cardId = cards[0];
        i.defCard = cardId;
        log.push(`|${cardId}`);
        const card = getCardById(cardId);
        const industryMarkCount = card.industry;
        log.push(`|industryMarkCount:${industryMarkCount}`);
        i.progress -= industryMarkCount;
        log.push(`|${i.progress}`);
        G.pub[parseInt(i.def)].discard.push(cardId);
        const cardEff = getCardEffect(cardId);
        if (cardEff.hasOwnProperty("play")) {
            const eff = {...cardEff.play};
            if (eff.e !== "none") {
                eff.target = i.def;
                log.push(`|${JSON.stringify(eff)}`);
                G.e.stack.push(eff)
            } else {
                log.push(`|emptyPlayEffect`);
            }
        } else {
            log.push(`|noPlayEffect`);
        }
        G.player[parseInt(i.def)].competitionCards = [];
        if (cinemaInRegion(G, ctx, card.region, i.def) && card.type === CardType.F) {
            log.push(`|cinemaInRegion|${card.region}|${i.progress}`);
            i.progress--;
            log.push(`|after|${i.progress}`);
        }
        G.e.card = cardId;
        logger.debug(`${G.matchID}|${log.join('')}`);
        checkNextEffect(G, ctx);
    } else {
        log.push(`|defNoCard|showCompetitionResult`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        changePlayerStage(G, ctx, "showCompetitionResult", i.atk);
    }
}

export function nextEra(G: IG, ctx: Ctx, r: ValidRegion) {
    const region = G.regions[r];
    const era = region.era;
    const log = [`nextEra|${r}|era:${era}`];
    let newEra;
    log.push(`|removeCards`);
    doReturnSlotCard(G, ctx, region.legend);
    for (let slot of region.normal) {
        doReturnSlotCard(G, ctx, slot);
    }
    log.push(`|${JSON.stringify(region)}`);
    log.push(`|resetShare`);
    for (let i = 0; i < G.order.length; i++) {
        G.pub[i].shares[r] = 0;
    }
    region.share = 0;
    if (era === IEra.ONE) {
        log.push(`|IEra.TWO`);
        newEra = IEra.TWO;
        region.era = newEra;
        drawForRegion(G, ctx, r, newEra);
        region.share = ShareOnBoard[r][newEra];
        if (ctx.numPlayers === 3) {
            region.share--;
        }
    }
    if (era === IEra.TWO) {
        log.push(`|IEra.THREE`);
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
        log.push(`|eraThree`);
        log.push(`|completedModernScoring`);
        region.completedModernScoring = true;
    }
    if (valid_regions
        .filter(r => G.regions[r].completedModernScoring)
        .length >= 3) {
        log.push("3orMoreRegion|completedModernScoring");
        if (ctx.currentPlayer === getExistingLastMovePlayer(G)) {
            log.push(`|finalScoring`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            finalScoring(G, ctx);
            return;
        } else {
            log.push("|lastRound");
            G.pending.lastRoundOfGame = true
        }
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const doNotLoseVpAfterCompetitionSchool = (school: SchoolCardID): boolean => {
    switch (school) {
        case SchoolCardID.S3201:
            return true;
        case SchoolCardID.S3204:
            return true;
        case SchoolCardID.S3304:
            return true;
        default:
            return false;
    }
    // TODO: fix effect parsing
    // const eff = getCardEffect(school);
    // if (eff.hasOwnProperty("response")) {
    //     if (eff.response.hasOwnProperty("pre")) {
    //         if (eff.response.pre.e === "doNotLoseVpAfterCompetition") {
    //             return true;
    //         } else {
    //             if (eff.response.pre.e === "multiple") {
    //                 for (const sub of eff.response.pre.effect) {
    //                     if (sub.pre.e === "doNotLoseVpAfterCompetition") {
    //                         return true;
    //                     }
    //                 }
    //                 return false;
    //             } else {
    //                 return false;
    //             }
    //         }
    //     } else {
    //         return false;
    //     }
    // } else {
    //     return false;
    // }
}

export const startCompetition = (G: IG, ctx: Ctx, atk: PlayerID, def: PlayerID) => {
    const log = [`startCompetition|atk${atk}|def${def}`];
    let i = G.competitionInfo;
    i.pending = true;
    i.atk = atk;
    i.def = def;
    const defSchoolID = G.pub[parseInt(i.def)].school;
    const CompetitionPowerDelta = G.pub[parseInt(atk)].competitionPower - 3 - G.pub[parseInt(def)].competitionPower;
    log.push(`|CompetitionPowerDelta:${CompetitionPowerDelta}`);
    i.progress = CompetitionPowerDelta;
    if (defSchoolID !== null && doNotLoseVpAfterCompetitionSchool(defSchoolID)) {
        log.push(`|${defSchoolID}|doNotLoseVP`);
    } else {
        log.push(`|p${i.def}|lose${CompetitionPowerDelta}vp`);
        loseVp(G, ctx, def, CompetitionPowerDelta);
    }
    addVp(G, ctx, atk, CompetitionPowerDelta);
    loseCompetitionPower(G, ctx, atk, 3);
    addCompetitionPower(G, ctx, def, 1);
    log.push(`|showCompetitionResult`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    changePlayerStage(G, ctx, "showCompetitionResult", i.atk);
}


export const checkCompetitionDefender = (G: IG, ctx: Ctx) => {
    let i = G.competitionInfo;
    const log = [`checkCompetitionDefender|p${i.def}|emptyHand|${JSON.stringify(i)}`];
    if (G.player[parseInt(i.def)].hand.length > 0) {
        log.push(`|hasHand|changePlayerStage|competitionCard`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        changePlayerStage(G, ctx, "competitionCard", i.def);
    } else {
        i.defPlayedCard = true;
        log.push(`|hasHand|changePlayerStage|showCompetitionResult`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        changePlayerStage(G, ctx, "showCompetitionResult", i.atk);
    }
}
export const checkCompetitionAttacker = (G: IG, ctx: Ctx) => {
    const log = ["checkCompetitionAttacker"];
    let i = G.competitionInfo;
    if (G.player[parseInt(i.atk)].hand.length > 0) {
        log.push(`|p${i.atk}|competitionCard`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        changePlayerStage(G, ctx, "competitionCard", i.atk);
    } else {
        log.push(`|p${i.atk}|emptyHand`);
        i.atkPlayedCard = true;
        logger.debug(`${G.matchID}|${log.join('')}`);
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
    const i = parseInt(pid);
    const p = G.pub[i];
    const s = G.player[i];
    cleanUpScore(G, ctx, pid);
    const f = p.finalScoring;
    const log = ['getExtraScoreForFinal'];
    const validID = [...G.secretInfo.playerDecks[i], ...p.discard, ...s.hand, ...p.playedCardInTurn]
    if (p.school !== null) {
        validID.push(p.school);
    }
    const validCards = validID.map(c => getCardById(c));
    log.push(`|card|before|${f.card}`);
    validCards.forEach(c => {
        f.card += c.vp
    });
    log.push(`|after|${f.card}`);
    if (p.building.cinemaBuilt) {
        log.push(`|p${pid}|own|cinema`);
        f.building += 3;
    }
    if (p.building.studioBuilt) {
        log.push(`|p${pid}|own|studio`);
        f.building += 3;
    }
    if (p.industry === 10) {
        log.push(`|vp|${p.vp}|before|${f.industryAward}`);
        validCards.forEach(eraCard => {
            log.push(`|card:${eraCard.cardId}|era:${eraCard.era}`);
            log.push(`|before|${f.industryAward}`);
            switch (eraCard.era) {
               case IEra.ONE:
                   f.industryAward += 1;
                   break;
               case IEra.TWO:
                   f.industryAward += 2;
                   break;
               case IEra.THREE:
                   f.industryAward += 3;
                   break;
           }
            log.push(`|after|${f.industryAward}`);
        });
        log.push(`|after|${f.industryAward}`);
    }
    if (p.aesthetics === 10) {
        log.push(`|vp|${p.vp}|before|${f.aestheticsAward}`);
        f.aestheticsAward += Math.round(p.vp / 5);
        log.push(`|after|${f.aestheticsAward}`);
    }
    log.push(`|archive`);
    valid_regions.forEach(r => {
        log.push(`|region|${r}|before|${f.archive}`);
        // const championCount = p.champions.filter(c => c.region === r).length;
        let championModifier = 0;
        p.champions.filter(c => c.region === r).forEach((ch) => {
            switch (ch.era) {
                case IEra.ONE:
                    championModifier = championModifier + 1;
                    break;
                case IEra.TWO:
                    championModifier = championModifier + 2;
                    break;
                case IEra.THREE:
                    championModifier = championModifier + 3;
                    break;
                default:
                    break;
            }
        });
        log.push(`|championModifier:${championModifier}`);
        f.archive += p.archive.filter(card => getCardById(card).region === r).length * championModifier;
        log.push(`|after|${f.archive}`);
    });
    {
        // if (validID.includes(PersonCardID.P3102)) {
        //     log.push(`|before|${f.events}`);
        //     f.events += validCards.filter(c => c.industry > 0)
        //         .filter(c => c.category === CardCategory.LEGEND || c.category === CardCategory.NORMAL)
        //         .length * 2;
        //     log.push(`|after|${f.events}`);
        // }
        // if (validID.includes(PersonCardID.P3106)) {
        //     log.push(`|before|${f.events}`);
        //     f.events += validCards.filter(c => c.region === Region.NA)
        //         .length * 2
        //     log.push(`|after|${f.events}`);
        // }
        // if (validID.includes(PersonCardID.P3107)) {
        //     log.push(`|before|${f.events}`);
        //     f.events += validCards
        //         .filter(c => c.category === CardCategory.BASIC)
        //         .length;
        //     log.push(`|after|${f.events}`);
        // }
        // if (validID.includes(PersonCardID.P3202)) {
        //     log.push(`|before|${f.events}`);
        //     f.events += validCards.filter(c => c.region === Region.WE)
        //         .length * 2;
        //     log.push(`|after|${f.events}`);
        // }
        // if (validID.includes(PersonCardID.P3302)) {
        //     log.push(`|${p.industry * 2}|before|${f.events}`);
        //     f.events += p.industry * 2;
        //     log.push(`|after|${f.events}`);
        // }
        // if (validID.includes(PersonCardID.P3403)) {
        //     log.push(`|3403|before|${f.events}`);
        //     f.events += p.aesthetics;
        //     log.push(`|after|${f.events}`);
        // }
        // if (validID.includes(PersonCardID.P3301)) {
        //     log.push(`|before|${f.events}`);
        //     f.events += validCards.filter(c => c.region === Region.EE)
        //         .length * 2
        //     log.push(`|after|${f.events}`);
        // }
        // if (validID.includes(PersonCardID.P3203)) {
        //     log.push(`|3203|before|${f.events}`);
        //     f.events += validCards.filter(c => c.aesthetics > 0)
        //         .filter(c => c.category === CardCategory.LEGEND || c.category === CardCategory.NORMAL)
        //         .length * 2
        //     log.push(`|after|${f.events}`);
        // }
        // if (validID.includes(PersonCardID.P3401)) {
        //     log.push(`|3401||before|${f.events}`);
        //     // f.events += validCards.filter(c => c.type === CardType.P).length * 4;
        //     f.events += p.industry;
        //     log.push(`|after|${f.events}`);
        // }
        // if (validID.includes(PersonCardID.P3402)) {
        //     log.push(`|before|${f.events}`);
        //     f.events += validCards.filter(c => c.region === Region.ASIA)
        //         .length * 2;
        //     log.push(`|after|${f.events}`);
        // }
    }
    const industryEffIDS: PersonCardID[] = [
        PersonCardID.P3102,
        PersonCardID.P3107,
        PersonCardID.P3302,
        PersonCardID.P3401,
    ]
    for (let iCard of industryEffIDS) {
        if (validID.includes(iCard)) {
            log.push(`|industry|${iCard}|before|${f.events}`);
            f.events += p.industry;
            log.push(`|after|${f.events}`);
        }
    }
    const aesEffIDS: PersonCardID[] = [
        PersonCardID.P3106,
        PersonCardID.P3202,
        PersonCardID.P3203,
        PersonCardID.P3301,
        PersonCardID.P3402,
        PersonCardID.P3403,
    ]
    for (let aCard of aesEffIDS) {
        if (validID.includes(aCard)) {
            log.push(`|aes|${aCard}|before|${f.events}`);
            f.events += p.aesthetics;
            log.push(`|after|${f.events}`);
        }
    }
    f.total = p.vp + f.card + f.building + f.industryAward + f.aestheticsAward + f.archive + f.events;
    log.push(`|total:${f.total}`);
    // logger.debug(`${G.matchID}|${log.join('')}`);
}

export const schoolPlayer = (G: IG, ctx: Ctx, cardId: CardID): PlayerID | null => {
    const log = [`schoolPlayer|${cardId}`];
    let player = null
    G.order.forEach(p => {
        log.push(`|${p}`);
        if (G.pub[parseInt(p)].school === cardId) {
            log.push(`|kino`);
            player = p;
        } else {
            log.push(`|notKino`);
        }
    })
    log.push(`|result|${player}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return player;
}

export const rank = (G: IG, ctx: Ctx, p1: number, p2: number, addLog: boolean = false): number => {
    const log = [`rank|p${p1}|p${p2}`];
    let pub1 = G.pub[p1];
    let pub2 = G.pub[p2];
    const v1 = pub1.finalScoring.total;
    const v2 = pub2.finalScoring.total;
    log.push(`|vp|${v1}|${v2}`);
    if (v1 > v2) {
        log.push(`|p${p1}wins`);
        if (addLog) logger.debug(`${G.matchID}|${log.join('')}`);
        return -1;
    } else {
        if (v1 < v2) {
            log.push(`|p${p2}wins`);
            if (addLog) logger.debug(`${G.matchID}|${log.join('')}`);
            return 1;
        } else {
            const pos1 = initialPosOfPlayer(G, ctx, p1.toString());
            const pos2 = initialPosOfPlayer(G, ctx, p2.toString());
            log.push(`|initialPos|${pos1}|${pos2}`);
            if (addLog) logger.debug(`${G.matchID}|${log.join('')}`);
            if (pos1 < pos2) {
                log.push(`|p${p2}wins`);
                if (addLog) logger.debug(`${G.matchID}|${log.join('')}`);
                return 1
            } else {
                log.push(`|p${p1}wins`);
                if (addLog) logger.debug(`${G.matchID}|${log.join('')}`);
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
