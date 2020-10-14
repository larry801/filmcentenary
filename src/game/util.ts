import {
    BasicCardID,
    CardCategory,
    CardType,
    EventCardID,
    IBasicCard,
    IBuyInfo,
    ICardSlot,
    ICost,
    IEra,
    INormalOrLegendCard,
    IPubInfo,
    ISchoolCard,
    LegendCardCountInUse,
    ClassicCardID,
    NormalCardCountInUse,
    Region,
    ShareOnBoard,
    validRegion,
    ValidRegions, SimpleRuleNumPlayers, CardID, SchoolCardID, ScoreCardID,
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

export const activePub = (G: IG, ctx: Ctx): IPubInfo => {
    if (ctx.activePlayers === null) {
        return G.pub[curPid(G, ctx)];
    } else {
        return G.pub[parseInt(activePlayer(ctx))];
    }
}

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

export const requireInteraction = (eff: any): boolean => {
    switch (eff.e) {
        case "step":
            return eff.e.a.every((e: any): boolean => requireInteraction(e));
        default:
            return isSimpleEffect(eff);
    }
}

export const isSimpleEffect = (eff: any): boolean => {
    switch (eff.e) {
        case "alternative":
        case "competition":
        case "loseAnyRegionShare":
        case "anyRegionShare":
        case "noBuildingEE":
        case "playerNotVpChampion":
        case "playerVpChampion":
        case "handToOthers":
        case "industryAndAestheticsBreakthrough":
        case "industryOrAestheticsBreakthrough":
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
            return false;
        default:
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

export function simpleEffectExec(G: IG, ctx: Ctx, p: PlayerID): void {
    let eff = G.e.stack.pop();
    let obj = G.pub[parseInt(p)];
    let card: INormalOrLegendCard;
    switch (eff.e) {
        case "none":
        case "skipBreakthrough":
            return;
        case "shareToVp":
            obj.vp += obj.shares[eff.a as validRegion];
            return;
        case "loseVpForEachHand":
            obj.vp -= G.player[parseInt(p)].hand.length;
            break;
        case "aestheticsToVp":
            obj.vp += obj.aesthetics;
            break;
        case "industryToVp":
            obj.vp += obj.industry;
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
        case "loseVp":
            obj.vp -= eff.a;
            if (obj.school?.cardId === "2104") {
                obj.resource++;
            }
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
            obj.deposit += eff.a;
            break;
        case "res":
            let i = G.competitionInfo;
            if (i.pending) {
                if (p === i.atk) {
                    i.progress += eff.a;
                } else {
                    if (p === i.def) {
                        i.progress -= eff.a;
                    } else {
                        obj.resource += eff.a;
                    }
                }
            } else {
                obj.resource += eff.a;
            }
            break;
        case "vp":
        case "addVp":
        case "addExtraVp":
            obj.vp += eff.a;
            let count = 0;
            if (obj.vp >= 60 && !obj.vpAward.v60) count++;
            if (obj.vp >= 90 && !obj.vpAward.v90) count++;
            if (obj.vp >= 120 && !obj.vpAward.v120) count++;
            if (obj.vp >= 150 && !obj.vpAward.v150) {
                count++;
                G.pending.lastRoundOfGame = true;
            }
            if (count > 0) {
                G.e.stack.push({e: "industryOrAestheticsLevelUp", a: count})
                playerEffExec(G, ctx, p);
            }
            break;
        case "draw":
            for (let i = 0; i < eff.a; i++) {
                drawCardForPlayer(G, ctx, p);
            }
            break;
        case "buyCardToHand":
            card = getCardById(eff.a);
            doBuyToHand(G, ctx, card, ctx.currentPlayer);
            break;
        case "aestheticsLevelUp":
            if (obj.aesthetics < 10) {
                obj.aesthetics++;
            }
            break
        case "industryLevelUp":
            if (obj.industry < 10) {
                obj.industry++;
            }
            break;
        case "industryAward":
            industryAward(G, ctx, p);
            break;
        case "aesAward":
            aesAward(G, ctx, p);
            break;
        case "buy":
            doBuy(G, ctx, getCardById(eff.a), p);
            break;
        default:
            console.error("Invalid effect" + JSON.stringify(eff));
            throw new Error(JSON.stringify(eff));
    }

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
    G.e.card = card.cardId;
    if (card.category === CardCategory.BASIC) {
        let count = G.basicCards[card.cardId as BasicCardID];
        if (count > 0) {
            G.basicCards[card.cardId as BasicCardID] -= 1;
            obj.discard.push(card.cardId);
            obj.allCards.push(card.cardId);
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
            let kino = schoolPlayer(G, ctx, "1303");
            if (kino !== null && p !== kino) {
                G.pub[parseInt(kino)].vp++;
                G.pub[parseInt(kino)].deposit++;
            }
            if (school !== null) {
                if (school.cardId === "1203") {
                    if (obj.aesthetics < 10) {
                        obj.aesthetics++;
                    }
                }
                obj.archive.push(school.cardId);
            }
            obj.school = card as ISchoolCard;
        } else {
            obj.discard.push(card.cardId);
        }
        obj.allCards.push(card.cardId);

    }

}

export const cardInDeck = (G: IG, ctx: Ctx, p: number, cardId: string): boolean => {
    return G.secretInfo.playerDecks[p].filter(c => c === cardId).length > 0;
}
export const cardInHand = (G: IG, ctx: Ctx, p: number, cardId: string): boolean => {
    return G.player[p].hand.filter(c => c === cardId).length > 0;
}
export const cardInDiscard = (G: IG, ctx: Ctx, p: number, cardId: string): boolean => {
    return G.pub[p].discard.filter(c => c === cardId).length > 0;
}
export const ownCardPlayers = (G: IG, ctx: Ctx, cardId: string): PlayerID[] => {
    let p: PlayerID[] = [];
    Array(ctx.numPlayers).fill(1).forEach((i, idx) => {
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
    return G.regions[r].buildings.filter(s => s.content === "studio" && s.owner === p).length > 0;
}
export const cinemaInRegion = (G: IG, ctx: Ctx, r: Region, p: PlayerID): boolean => {
    if (r === Region.NONE) return false;
    return G.regions[r].buildings.filter(s => s.content === "cinema" && s.owner === p).length > 0;
}
export const studioPlayers = (G: IG, ctx: Ctx, r: Region): PlayerID[] => {
    if (r === Region.NONE) return [];
    return Array(ctx.numPlayers).fill(1).map((i, idx) => idx.toString()).filter(pid => studioInRegion(G, ctx, r, pid));
}
export const cinemaPlayers = (G: IG, ctx: Ctx, r: Region): PlayerID[] => {
    if (r === Region.NONE) return [];
    return Array(ctx.numPlayers).fill(1).map((i, idx) => idx.toString()).filter(pid => cinemaInRegion(G, ctx, r, pid));
}
export const buildingPlayers = (G: IG, ctx: Ctx, r: Region): PlayerID[] => {
    if (r === Region.NONE) return [];
    return Array(ctx.numPlayers).fill(1).map((i, idx) => idx.toString()).filter(pid => cinemaInRegion(G, ctx, r, pid) || studioInRegion(G, ctx, r, pid));
}
export const noBuildingPlayers = (G: IG, ctx: Ctx, r: Region): PlayerID[] => {
    if (r === Region.NONE) return [];
    return Array(ctx.numPlayers).fill(1).map((i, idx) => idx.toString()).filter(pid => !cinemaInRegion(G, ctx, r, pid) && !studioInRegion(G, ctx, r, pid));
}
export const noStudioPlayers = (G: IG, ctx: Ctx, r: Region): PlayerID[] => {
    if (r === Region.NONE) return [];
    return Array(ctx.numPlayers).fill(1).map((i, idx) => idx.toString()).filter(pid => !studioInRegion(G, ctx, r, pid));
}

export const posOfPlayer = (G: IG, ctx: Ctx, p: PlayerID): number => {
    return G.order.indexOf(p);
}

export const checkRegionScoring = (G: IG, ctx: Ctx, r: Region): boolean => {
    if (r === Region.NONE) return false;
    return cardDepleted(G, ctx, r) || shareDepleted(G, ctx, r);
}

export const seqFromCurrentPlayer = (G: IG, ctx: Ctx): PlayerID[] => {
    let log = `seqFromCurrentPlayer|`
    let act = activePlayer(ctx);
    log += `|act:${act}`
    let pos = posOfPlayer(G, ctx, ctx.currentPlayer);
    log += `|pos${pos}`
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
    logger.debug(log);
    return seq;
}

export function industryLowestPlayer(G: IG, ctx: Ctx): PlayerID[] {
    let highestIndustry = 0;
    let result: PlayerID[] = [];
    Array(ctx.numPlayers).fill(1).forEach((i, idx) => {
        if (G.pub[idx].industry > highestIndustry) highestIndustry = G.pub[idx].industry
    })
    Array(ctx.numPlayers).fill(1).forEach((i, idx) => {
        if (G.pub[idx].industry <= highestIndustry) {
            result.push(idx.toString())
        }
    })
    return result;
}

export function aesLowestPlayer(G: IG, ctx: Ctx): PlayerID[] {
    let highestAes = 0;
    let result: PlayerID[] = [];
    Array(ctx.numPlayers).fill(1).forEach((i, idx) => {
        if (G.pub[idx].aesthetics > highestAes) highestAes = G.pub[idx].aesthetics
    })
    Array(ctx.numPlayers).fill(1).forEach((i, idx) => {
        if (G.pub[idx].aesthetics <= highestAes) {
            result.push(idx.toString())
        }
    })
    return result;
}

export function notVpChampionPlayer(G: IG, ctx: Ctx): PlayerID[] {
    let highestVp = 0;
    let result: PlayerID[] = [];
    Array(ctx.numPlayers).fill(1).forEach((i, idx) => {
        if (G.pub[idx].vp > highestVp) highestVp = G.pub[idx].vp
    })
    Array(ctx.numPlayers).fill(1).forEach((i, idx) => {
        if (G.pub[idx].vp !== highestVp) {
            result.push(idx.toString())
        }
    })
    return result;
}

export function vpChampionPlayer(G: IG, ctx: Ctx): PlayerID[] {
    let log = "vpChampionPlayer|"
    let highestVp = 0;
    let result: PlayerID[] = [];
    Array(ctx.numPlayers).fill(1).forEach((i, idx) => {
        if (G.pub[idx].vp > highestVp) highestVp = G.pub[idx].vp
    })
    log += `highestVP|${highestVp}|`
    Array(ctx.numPlayers).fill(1).forEach((i, idx) => {
        if (G.pub[idx].vp === highestVp) {
            log += `p${idx}|`
            result.push(idx.toString())
        }
    })
    logger.debug(log)
    return result;
}


export const breakthroughEffectPrepare = (G: IG, ctx: Ctx): void => {
    let log = "breakthroughEffectPrepare"
    let p = curPub(G, ctx);
    let c = getCardById(G.e.card as CardID);
    let i = c.industry
    let a = c.aesthetics
    log += `|${c.cardId}|i${i}|a${a}`
    if (i === 0 && a === 0) {
        log += `|noMarker|return`
        logger.debug(log);
        return;
    }
    if (i > 0 && a > 0) {
        log += `|industryAndAestheticsBreakthrough`
        G.e.stack.push({
            e: "industryAndAestheticsBreakthrough", a: {
                industry: p.industry,
                aesthetics: p.aesthetics,
            }
        })
        logger.debug(log);
    } else {
        if (i === 0) {
            log += `|aestheticsBreakthrough`
            G.e.stack.push({e: "aestheticsBreakthrough", a: p.aesthetics})
            logger.debug(log);
        } else {
            log += `|industryBreakthrough`
            G.e.stack.push({e: "industryBreakthrough", a: p.industry})
            logger.debug(log);
        }
    }
}

export const startBreakThrough = (G: IG, ctx: Ctx, pid: PlayerID): void => {
    let p = curPub(G, ctx);
    let c: INormalOrLegendCard | IBasicCard = curCard(G);
    let log = `startBreakThrough|p${pid}|${c.cardId}`
    if (p.school?.cardId === "2201") {
        log += "|Neo realism"
        p.deposit += 2;
        p.vp += 1;
    }
    if (p.school?.cardId === "1204") {
        log += "|Swedish"
        p.resource += 1;
    }
    if (c.cardId === "1208") {
        log += "|Metropolis"
        G.e.stack.push({
            e: "industryOrAestheticsBreakthrough", a: {
                industry: p.industry,
                aesthetics: p.aesthetics,
            }
        })

    }
    log += `|breakthroughEffectPrepare`
    logger.debug(log);
    breakthroughEffectPrepare(G, ctx);
    let eff = getCardEffect(c.cardId).archive;
    if (eff.e !== "none") {
        log += `|pushEffect|${JSON.stringify(eff)}`
        G.e.stack.push(eff)
    }
    log += `|checkNextEffect`
    logger.debug(log);
    checkNextEffect(G, ctx);
}

export const curEffectExec = (G: IG, ctx: Ctx): void => {
    let log = `curEffExec|${ctx.currentPlayer}`;
    logger.debug(log);
    playerEffExec(G, ctx, ctx.currentPlayer)
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
        logger.debug(log);
        checkNextEffect(G, ctx);
        return;
    }
    log += `eff|${JSON.stringify(eff)}`;
    G.e.currentEffect = eff;
    let obj = G.pub[parseInt(p)];
    let playerObj = G.player[parseInt(p)];
    let region = curCard(G).region as validRegion;
    let players = []
    let len = 0;
    let subEffect;
    switch (eff.e) {
        case "searchAndArchive":
            players = ownCardPlayers(G, ctx, eff.a);
            if (players.length === 0) {
                log += `noPlayerOwn${eff.a}`
                logger.debug(log);
                break;
            } else {
                log += `|players${JSON.stringify(players)}`
                G.e.stack.push(eff);
                logger.debug(log);
                G.e.currentEffect = eff;
                changePlayerStage(G, ctx, "confirmRespond", players[0]);
                return;
            }
        case "era":
            let era = G.regions[region].era;
            G.e.stack.push(eff.a[era]);
            break;
        case "breakthroughResDeduct":
            if (playerObj.hand.length > 0 && obj.action > 0) {
                changePlayerStage(G, ctx, "chooseHand", p);
                return;
            } else {
                break;
            }
        case "alternative":
            G.e.stack.push(eff)
            G.e.currentEffect = eff;
            changePlayerStage(G, ctx, "confirmRespond", p);
            return;
        case "competition":
            G.e.stack.push(eff.a)
            changePlayerStage(G, ctx, "chooseTarget", p);
            return;
        case "loseAnyRegionShare":
            G.e.regions = ValidRegions.filter(r => obj.shares[r] > 0)
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
                let winner = i.progress > 0 ? i.atk : i.def;
                let loser = i.progress > 0 ? i.def : i.atk;
                G.e.regions = ValidRegions.filter(r => G.pub[parseInt(loser)].shares[r] > 0)
                if (G.e.regions.length === 0) {
                    log += ("Target player has no share");
                    competitionCLeanUp(G, ctx);
                    return;
                } else {
                    log += `|p${winner}|chooseRegion`
                    G.e.stack.push(eff)
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
            players = noBuildingPlayers(G, ctx, Region.EE);
            for (let p of players) {
                G.e.stack.push(eff.a);
                simpleEffectExec(G, ctx, p);
            }
            break;
        case "playerNotVpChampion":
            players = notVpChampionPlayer(G, ctx);
            for (let p of players) {
                G.e.stack.push(eff.a);
                simpleEffectExec(G, ctx, p);
            }
            break
        case "playerVpChampion":
            log += "|playerVpChampion"
            if (G.e.pendingPlayers.length === 0) {
                log += "|fetchPlayers|"
                players = vpChampionPlayer(G, ctx);
                log += JSON.stringify(players);
                G.e.pendingPlayers = players;
                G.e.stack.push(eff);
                log += "|push|"
                logger.debug(log)
            } else {
                let subEffect = eff.a;

                G.e.stack.push(subEffect);
                if (isSimpleEffect(subEffect)) {
                    log += "|simpleEffect"
                    for (let p of G.e.pendingPlayers) {
                        simpleEffectExec(G, ctx, p);
                    }
                } else {
                    log += "|complexEffect"
                    if (G.e.pendingPlayers.length > 1) {
                        G.e.stack.push(eff);
                    }
                    let player = G.e.pendingPlayers.shift() as PlayerID;
                    playerEffExec(G, ctx, player);
                    return;
                }
            }
            break;
        case "aesLowest":
            players = aesLowestPlayer(G, ctx);
            for (let p of players) {
                G.e.stack.push(eff.a);
                simpleEffectExec(G, ctx, p);
            }
            break;
        case "industryLowest":
            players = industryLowestPlayer(G, ctx);
            for (let p of players) {
                G.e.stack.push(eff.a);
                simpleEffectExec(G, ctx, p);
            }
            break;
        case "handToOthers":
            G.e.stack.push(eff)
            changePlayerStage(G, ctx, "chooseHand", p);
            break;
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
            let deck = G.secretInfo.playerDecks[curPid(G, ctx)];
            len = deck.length;
            if (len < peekCount) {
                playerObj.cardsToPeek = deck;
                deck = [];
                deck = shuffle(ctx, obj.discard);
                obj.discard = [];
                for (let i = 0; i < peekCount - len; i++) {
                    playerObj.cardsToPeek.push(deck.pop() as ClassicCardID);
                }
            } else {
                for (let i = 0; i < peekCount; i++) {
                    playerObj.cardsToPeek.push(deck.pop() as ClassicCardID);
                }
            }
            G.e.stack.push(eff)
            changePlayerStage(G, ctx, "peek", p);
            break;
        case "everyOtherCompany":
            if (G.e.pendingPlayers.length === 0) {
                G.e.pendingPlayers = seqFromCurrentPlayer(G, ctx);
                G.e.pendingPlayers.shift()
                G.e.stack.push(eff);
            } else {
                if (G.e.pendingPlayers.length !== 1) {
                    G.e.stack.push(eff);
                }
                let subEffect = eff.a;
                if (isSimpleEffect(subEffect)) {
                    for (let p of G.e.pendingPlayers) {
                        G.e.stack.push(eff.a);
                        simpleEffectExec(G, ctx, p);
                    }
                } else {
                    G.e.stack.push(eff.a);
                    let player = G.e.pendingPlayers.shift() as PlayerID;
                    playerEffExec(G, ctx, player);
                    return;
                }
            }
            break;
        case "everyPlayer":
            log += "|everyPlayer"
            subEffect = eff.a;
            if (isSimpleEffect(subEffect)) {
                log += "|simpleEffect|execForAll"
                for (let p of G.e.pendingPlayers) {
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
                    log += "|push|"
                    logger.debug(log);
                } else {
                    log += "|complexEffect"
                    if (G.e.pendingPlayers.length !== 1) {
                        G.e.stack.push(eff);
                    }
                    let player = G.e.pendingPlayers.shift() as PlayerID;
                    G.e.stack.push(subEffect);
                    playerEffExec(G, ctx, player);
                    return;
                }
            }
            break
        case "noStudio":
            G.c.players = noStudioPlayers(G, ctx, region);
            if (G.c.players.length === 0) {
                break;
            }
            G.e.stack.push(eff.a);
            changePlayerStage(G, ctx, "chooseTarget", p);
            return;
        case "studio":
            players = studioPlayers(G, ctx, region);
            if (players.length === 0) {
                break;
            }
            G.e.pendingPlayers = players;
            if (G.e.pendingPlayers.length !== 1) {
                G.e.stack.push(eff);
            }
            subEffect = eff.a;
            if (isSimpleEffect(subEffect)) {
                for (let p of G.e.pendingPlayers) {
                    playerEffExec(G, ctx, p);
                }
            } else {
                G.e.stack.push(eff.a);
                let player = G.e.pendingPlayers.shift() as PlayerID;
                playerEffExec(G, ctx, player);
            }
            break;
        case "step":
            log += ("step")
            len = eff.a.length;
            for (let i = len - 1; i >= 0; i--) {
                G.e.stack.push(eff.a[i])
            }
            log += JSON.stringify(G.e.stack)
            break;
        case "discardNormalOrLegend":
            if (playerObj.hand.filter(i =>
                getCardById(i).category !== CardCategory.BASIC
            ).length > 0) {
                G.e.stack.push(eff);
                log += (`|Has classic cards|changePlayerStage|${p}`)
                changePlayerStage(G, ctx, "chooseHand", p);
                logger.debug(log);
                return;
            }
            log += ("|No classic cards|next")
            break;
        case "discardLegend":
            if (playerObj.hand.filter(i =>
                getCardById(i).category === CardCategory.LEGEND
            ).length > 0) {
                G.e.stack.push(eff);
                changePlayerStage(G, ctx, "chooseHand", p);
                return;
            }
            break;
        case "discardAesthetics":
            if (playerObj.hand.filter(i =>
                getCardById(i).aesthetics > 0
            ).length > 0) {
                G.e.stack.push(eff);
                changePlayerStage(G, ctx, "chooseHand", p);
                return;
            }
            break;
        case "discardIndustry":
            if (playerObj.hand.filter(i =>
                getCardById(i).industry > 0
            ).length > 0) {
                G.e.stack.push(eff);
                changePlayerStage(G, ctx, "chooseHand", p);
                return;
            }
            break;
        case "refactor":
        case "archive":
        case "discard":
            if (playerObj.hand.length > 0) {
                G.e.stack.push(eff);
                changePlayerStage(G, ctx, "chooseHand", p);
                return;
            }
            break;
        case "choice":
            for (let choice of eff.a) {
                switch (choice.e) {
                    case "breakthroughResDeduct":
                        if (playerObj.hand.length > 0 && obj.action > 0) {
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
                break;
            } else {
                if (G.e.choices.length === 1) {
                    G.e.stack.push(G.e.choices.pop());
                    checkNextEffect(G, ctx);
                } else {
                    changePlayerStage(G, ctx, "chooseEffect", p);
                    return;
                }
            }
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
                    if (obj.resource < eff.a.cost.a) {
                        break
                    } else {
                        obj.resource -= eff.a.cost.a
                        G.e.stack.push(eff.a.eff);
                        break;
                    }
                case "vp":
                case "addVp":
                case "addExtraVp":
                    if (obj.vp < eff.a.cost.a) {
                        break
                    } else {
                        obj.vp -= eff.a.cost.a
                        G.e.stack.push(eff.a.eff);
                        break
                    }
                case "deposit":
                    if (obj.deposit < eff.a.cost.a) {
                        break
                    } else {
                        obj.deposit -= eff.a.cost.a
                        G.e.stack.push(eff.a.eff);
                        break
                    }
                default:
                    logger.debug(log);
                    throw new Error();
            }
            break;
        case "optional":
            G.e.stack.push(eff);
            G.e.currentEffect = eff;
            changePlayerStage(G, ctx, "confirmRespond", p);
            return;
        case "industryOrAestheticsLevelUp":
            if (obj.industry < 10 && obj.aesthetics < 10) {
                G.e.choices.push({e: "industryLevelUp", a: 1});
                G.e.choices.push({e: "aestheticsLevelUp", a: 1});
                changePlayerStage(G, ctx, "chooseEffect", p);
                return;
            } else {
                if (obj.industry < 10) {
                    obj.industry++;
                } else {
                    if (obj.aesthetics < 10) {
                        obj.aesthetics++;
                    } else {
                    }
                }
                break;
            }
        case "archiveToEEBuildingVP":
            G.e.stack.push(eff);
            changePlayerStage(G, ctx, "chooseHand", p);
            return;
        case "industryBreakthrough":
            doIndustryBreakthrough(G, ctx, p);
            break;
        case "aestheticsBreakthrough":
            doAestheticsBreakthrough(G, ctx, p);
            break;
        default:
            G.e.stack.push(eff);
            simpleEffectExec(G, ctx, p);
    }
    log += "|checkNextEffect"
    logger.debug(log)
    checkNextEffect(G, ctx);
}

export const aesAward = (G: IG, ctx: Ctx, p: PlayerID): void => {
    let o = G.pub[parseInt(p)];
    if (o.aesthetics > 1) o.vp += 2;
    if (o.aesthetics > 4) o.vp += 1;
    if (o.aesthetics > 7) o.vp += 1;
}

export const industryAward = (G: IG, ctx: Ctx, p: PlayerID): void => {
    let o = G.pub[parseInt(p)];
    if (o.industry > 1) o.resource += 1;
    if (o.industry > 4) drawCardForPlayer(G, ctx, p);
    if (o.industry > 7) drawCardForPlayer(G, ctx, p);
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
        let school = pub.school;
        log += `|school:${pub.school.cardId}|aes:${school.aesthetics}|ind:${school.industry}`
        aesthetics -= school.aesthetics;
        industry -= school.industry
        if (targetCard.type === CardType.S) {
            let extraCost: number = school.era + 1
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
    if (pub.school?.cardId === "2201" && targetCard.aesthetics > 0) {
        log += ("|New realism deduct")
        if (resRequired < 2) {
            resRequired = 0;
        } else {
            resRequired -= 2;
        }
    }
    log += `|${resRequired}`;
    if (showLog) {
        logger.debug(log);
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
    }, false)
    return pub.deposit + pub.resource >= res;
}

export function canBuyCard(G: IG, ctx: Ctx, arg: IBuyInfo): boolean {
    let pub = G.pub[parseInt(arg.buyer)];
    let resRequired = resCost(G, ctx, arg, false);
    let resGiven: number = arg.resource + arg.deposit;
    return resRequired === resGiven && pub.resource >= arg.resource && pub.deposit >= arg.deposit;
}

export const fillTwoPlayerBoard = (G: IG, ctx: Ctx): void => {
    let s = G.secretInfo.twoPlayer.school;
    for (let slotL of G.twoPlayer.school) {
        if (slotL.card === null) {
            let newCard = s.pop()
            if (newCard === undefined) {

            } else {
                slotL.card = newCard as unknown as ClassicCardID;
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
    let school = schoolCardsByEra(e).map(c=>c.cardId);
    let filmCards = filmCardsByEra(e).map(c=>c.cardId);
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
            s.card = c as unknown as ClassicCardID;
        }
    }
}

export const drawForRegion = (G: IG, ctx: Ctx, r: Region, e: IEra): void => {
    logger.debug("drawForRegion" + i18n.era[e] + i18n.region[r]);
    if (r === Region.NONE) return;
    let legend = cardsByCond(r, e, true).map(c=>c.cardId);
    let normal = cardsByCond(r, e, false).map(c=>c.cardId);
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
        limit = getCardEffect(s.cardId).school.hand;
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
export const canHelp = (target: ClassicCardID | BasicCardID, helper: CardID): boolean => {
    let helperCard = getCardById(helper);
    let targetCard = getCardById(target)
    if (targetCard.cost.industry === 0) {
        if (targetCard.cost.aesthetics === 0) {
            return false;
        } else {
            return helperCard.aesthetics > 0;
        }
    } else {
        if (targetCard.cost.aesthetics === 0) {
            return helperCard.industry > 0;
        } else {
            return helperCard.aesthetics > 0 || helperCard.industry > 0;
        }
    }
}

export const getPossibleHelper = (G: IG, ctx: Ctx, p: PlayerID, card: CardID): CardID[] => {
    return G.player[parseInt(p)].hand.filter((h) => canHelp(card as BasicCardID, h))
}

export const do2pUpdateSchoolSlot = (G: IG, ctx: Ctx, slot: ICardSlot): void => {
    if (G.regions[Region.NA].era !== IEra.TWO) {
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
                slot.card = c as unknown as ClassicCardID;
            }
            if (oldCard !== null) {
                d.push(oldCard as unknown as SchoolCardID);
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
    logger.debug(log);
}

export const additionalCostForUpgrade = (level: number): number => {
    if (level < 4) {
        return 0;
    } else {
        if (level < 7) {
            return 1;
        } else {
            return 2;
        }
    }
}

export const canUpgrade = (G: IG, ctx: Ctx, p: PlayerID, isIndustry: boolean) => {
    let o = G.pub[parseInt(p)]
    let targetLevel: number;
    targetLevel = isIndustry ? o.industry + 1 : o.aesthetics + 1;
    let cost: number = additionalCostForUpgrade(targetLevel);
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
            G.pub[firstPlayer].discard.push(scoreCard.cardId);
            G.pub[firstPlayer].allCards.push(scoreCard.cardId);
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
            let era = G.regions[Region.NA].era;
            let newEra = era;
            if (era === IEra.ONE) {
                newEra = IEra.TWO
            }
            if (era === IEra.ONE) {
                newEra = IEra.THREE
            }
            if (era !== newEra) {
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
        logger.debug(log)
        regionRank(G, ctx, r as Region);
    } else {
        log += "|noRegion"
        if (
            G.pending.lastRoundOfGame &&
            posOfPlayer(G, ctx, ctx.currentPlayer)
            === (ctx.numPlayers - 1)
        ) {
            log += "|finalScoring"
            logger.debug(log);
            finalScoring(G, ctx);
        } else {
            log += "|fillEmptySlots"
            if (ctx.numPlayers > SimpleRuleNumPlayers) {
                fillEmptySlots(G, ctx);
            } else {
                fillTwoPlayerBoard(G, ctx)
            }
            log += "|signalEndStage&Turn"
            logger.debug(log)
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
        let log = `rank|${a}|${b}|`
        let p1 = G.pub[parseInt(a)];
        let p2 = G.pub[parseInt(b)];
        if (p1.shares[r] > p2.shares[r]) {
            log += `${a}win|`
            logger.debug(log);
            return -1;
        }
        if (p1.shares[r] < p2.shares[r]) {
            log += `${b}win|`
            logger.debug(log);
            return 1;
        }
        let legendCountA = legendCount(G, ctx, r, era, a);
        let legendCountB = legendCount(G, ctx, r, era, b);
        if (legendCountA > legendCountB) {
            log += `${a}win|`
            logger.debug(log);
            return -1;
        }
        if (legendCountA < legendCountB) {
            log += `${b}win|`
            logger.debug(log);
            return 1;
        }
        if (posOfPlayer(G, ctx, a) < posOfPlayer(G, ctx, b)) {
            log += `${a}win|`
            logger.debug(log);
            return -1;
        } else {
            if (posOfPlayer(G, ctx, a) > posOfPlayer(G, ctx, b)) {
                log += `${b}win|`
                logger.debug(log);
                return 1;
            } else {
                throw Error("Two player has the same pos")
            }
        }
    }
    let rankingPlayer: PlayerID[] = [];
    Array(ctx.numPlayers).fill(1).forEach((i, idx) => {
        log += `|p${idx}|`
        if (G.pub[idx].shares[r] === 0) {
            log += "no share"
            doBuy(G, ctx, B04, idx.toString())
        } else {
            log += "has share|"
            log += G.pub[idx].shares[r]
            rankingPlayer.push(idx.toString())
        }
    });
    let rankResult = rankingPlayer.sort(rank);
    log += `rankResult|${rankResult}|`;
    let firstPlayer: PlayerID = rankResult[0];
    log += (`firstPlayer:${firstPlayer}|`)
    G.pub[parseInt(firstPlayer)].champions.push({
        era: era,
        region: r,
    })
    let scoreCount = scoreCardCount(r, era);
    log += `scoreCount:${scoreCount}|`;
    let scoreCardPlayerCount = Math.min(rankResult.length, scoreCount)
    log += `scoreCardPlayerCount:${scoreCardPlayerCount}|`
    for (let i = 0; i < scoreCardPlayerCount; i++) {
        let scoreId = "V" + (era + 1).toString() + (r + 1).toString() + (i + 1).toString()
        log += `p${i}|${scoreId}`
        G.pub[parseInt(rankResult[i])].discard.push(scoreId)
        G.pub[parseInt(rankResult[i])].allCards.push(scoreId)
    }
    for (let i = scoreCardPlayerCount; i < rankResult.length; i++) {
        log += `p${i}|bad film`
        doBuy(G, ctx, B04, rankResult[i])
    }
    logger.debug(log)
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
    let newEvents =  eventCardByEra(newEra).map(c=>c.cardId);
    G.secretInfo.events = shuffle(ctx,newEvents);
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
            Array(ctx.numPlayers).fill(0).forEach((i, idx) => {
                if (G.pub[idx].action < 2) G.pub[idx].action = 2
            });
        }
        G.events = [];
        if (newEra !== era) {
            log += `|fillNewEraEvents|${newEra}`
            doFillNewEraEventDeck(G, ctx, newEra);
        }
    }
    logger.debug(log);
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
    let p = G.pub[parseInt(player)];
    let totalResource = p.resource + p.deposit;
    let additionalCost = additionalCostForUpgrade(p.industry);
    if (additionalCost <= totalResource) {
        log += `|${additionalCost}|canUpgrade`
        G.e.choices.push({e: "industryLevelUp", a: 1})
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
    logger.debug(log);
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
    let p = G.pub[parseInt(player)];
    let playerObj = G.player[parseInt(player)];
    let totalResource = p.resource + p.deposit;
    if (additionalCostForUpgrade(p.industry) <= totalResource) {
        log += ("|Can upgrade aesthetics")
        G.e.choices.push({e: "aestheticsLevelUp", a: 1})
    }
    if (playerObj.hand.length > 0) {
        log += ("|Can refactor")
        G.e.choices.push({e: "refactor", a: 1})
    }
    G.e.choices.push({e: "skipBreakthrough", a: 1})
    log += "|chooseEffect"
    logger.debug(log);
    changeStage(G, ctx, "chooseEffect")
}

export const regionEraProgress = (G: IG, ctx: Ctx) => {
    let log = "regionEraProgress"
    let r = G.currentScoreRegion;
    log += `|region|${G.currentScoreRegion}`
    if (r === Region.NONE) throw new Error();
    log += `|nextEra`
    logger.debug(log);
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
    logger.debug(log);
    tryScoring(G, ctx);
}

export function checkNextEffect(G: IG, ctx: Ctx) {
    let log = "checkNextEffect";
    if (G.e.stack.length === 0) {
        log += ("|Stack empty")
        let newWavePlayer = schoolPlayer(G, ctx, "3204");
        if (newWavePlayer !== null && G.pub[parseInt(newWavePlayer)].discardInSettle) {
            G.pub[parseInt(newWavePlayer)].discardInSettle = false;
            G.pub[parseInt(newWavePlayer)].vp++;
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
                    logger.debug(log)
                    defCardSettle(G, ctx);
                    return;
                } else {
                    log += "|competitionResultSettle"
                    i.defPlayedCard = false;
                    logger.debug(log)
                    competitionResultSettle(G, ctx);
                    return;
                }
            } else {
                if (ctx.activePlayers !== null) {
                    log += "|signalEndStage"
                    signalEndStage(G, ctx);
                    logger.debug(log)
                    return;
                }
            }
        } else {
            log += "|regionEraProgress"
            logger.debug(log)
            regionEraProgress(G, ctx);
            return;
        }
    } else {
        log += `|Next effect|${JSON.stringify(G.e.stack.slice(-1)[0])}`
        logger.debug(log)
        curEffectExec(G, ctx);
    }
}

export function loseVp(G: IG, ctx: Ctx, p: PlayerID, vp: number) {
    let atk = G.pub[parseInt(p)];
    if (vp > atk.vp) {
        atk.vp = 0;
    } else {
        atk.vp -= vp;
    }
}

export const competitionCLeanUp = (G: IG, ctx: Ctx) => {
    let i = G.competitionInfo;
    i.pending = false;
    i.progress = 0;
    checkNextEffect(G, ctx);
}

export function competitionResultSettle(G: IG, ctx: Ctx) {
    let i = G.competitionInfo;
    let atk = G.pub[parseInt(i.atk)];
    let def = G.pub[parseInt(i.def)];
    let log = `competitionResultSettle|a${i.atk}|d${i.def}`
    let winner: PlayerID = '0';
    let hasWinner = false;
    if (i.progress > 5) {
        log += `|${i.progress}overflow`
        i.progress = 5;
    }
    if (i.progress < -5) {
        log += `|${i.progress}underflow`
        i.progress = -5;
    }
    if (i.progress >= 3) {
        log += `|atk${i.atk}won`
        winner = i.atk;
        hasWinner = true;
    } else {
        if (i.progress <= -3) {
            log += `|def${i.def}won`
            winner = i.def;
            hasWinner = true;
        } else {
            log += `|noWinner`
        }
    }
    if (i.progress > 0) {
        atk.vp += i.progress;
        let schoolId = G.pub[parseInt(i.def)].school?.cardId;
        if (schoolId !== "3201" && schoolId !== "3204") {
            log += `|p${i.def}lose${i.progress}vp`
            loseVp(G, ctx, i.def, i.progress);
        } else {
            log += `|doNotLoseVP`
        }
    } else {
        let vp = -i.progress;
        def.vp += vp;
        let schoolId = G.pub[parseInt(i.atk)].school?.cardId;
        if (schoolId !== "3201" && schoolId !== "3204") {
            log += `|p${i.atk}lose${vp}vp`
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
                logger.debug(log);
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
        logger.debug(log);
        playerEffExec(G, ctx, winner);
        return;
    } else {
        competitionCLeanUp(G, ctx);
    }

}

export function atkCardSettle(G: IG, ctx: Ctx) {
    let i = G.competitionInfo;
    let cards = G.player[parseInt(i.atk)].competitionCards;
    let log = `atkCardSettle`
    if (cards.length > 0) {
        let cardId = cards[0];
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
        G.e.stack.push(eff);
        G.pub[parseInt(i.atk)].playedCardInTurn.push(cardId);
        logger.debug(log);
        // TODO may over run set a barrier effect?
        playerEffExec(G, ctx, i.atk);
    } else {
        log += "|atkNoCard|defCardSettle"
        logger.debug(log);
        defCardSettle(G, ctx);
    }
}

export const defCardSettle = (G: IG, ctx: Ctx) => {
    let log = "defCardSettle"
    let i = G.competitionInfo;
    let cards = G.player[parseInt(i.def)].competitionCards;
    if (cards.length > 0) {
        let cardId = cards[0];
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
        log += `|${JSON.stringify(eff)}`
        G.e.stack.push(eff);
        logger.debug(log);
        playerEffExec(G, ctx, i.def);
    } else {
        log += `|defNoCard|competitionResultSettle`
        logger.debug(log);
        competitionResultSettle(G, ctx);
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
    }
    if (era === IEra.TWO) {
        log += `|IEra.THREE`
        newEra = IEra.THREE;

        region.share = ShareOnBoard[r][newEra];
        region.era = newEra;
        newEra = IEra.THREE;
        drawForRegion(G, ctx, r, newEra);
    }
    if (era === IEra.THREE) {
        log += `|completedModernScoring`
        region.completedModernScoring = true;
    }
    logger.debug(log);
}

export const startCompetition = (G: IG, ctx: Ctx, atk: PlayerID, def: PlayerID) => {
    let log = `startCompetition|atk${atk}|def${def}`
    let i = G.competitionInfo;
    i.pending = true;
    i.atk = atk;
    i.def = def;
    i.region = curCard(G).region as validRegion;
    log += `|region:${i.region}`
    let classicHollywoodPlayer = schoolPlayer(G, ctx, "3101");
    if (classicHollywoodPlayer === i.atk) {
        log += `|classicHollywoodATK`
        i.progress++;
    }
    if (classicHollywoodPlayer === i.def) {
        log += `|classicHollywoodDEF`
        i.progress--
    }
    let newHollywoodPlayer = schoolPlayer(G, ctx, "3101");
    if (newHollywoodPlayer === i.atk) {
        log += `|newHollywoodATK`
        i.progress++;
    }
    if (newHollywoodPlayer === i.def) {
        log += `|newHollywoodDEF`
        i.progress--
    }
    log += `|checkCompetitionAttacker`
    logger.debug(log);
    checkCompetitionAttacker(G, ctx);
}


export const checkCompetitionDefender = (G: IG, ctx: Ctx) => {
    let i = G.competitionInfo;
    if (G.player[parseInt(i.def)].hand.length > 0) {
        logger.debug(`checkCompetitionDefender|p${i.def}|competitionCard`);
        changePlayerStage(G, ctx, "competitionCard", i.def);
    } else {
        i.defPlayedCard = true;
        logger.debug(`checkCompetitionDefender|p${i.def}|emptyHand`);
        competitionResultSettle(G, ctx);
    }
}
export const checkCompetitionAttacker = (G: IG, ctx: Ctx) => {
    let log = "checkCompetitionAttacker"
    let i = G.competitionInfo;
    if (G.player[parseInt(i.atk)].hand.length > 0) {
        log += `|p${i.atk}|competitionCard`
        logger.debug(log);
        changePlayerStage(G, ctx, "competitionCard", i.atk);
    } else {
        log += `|p${i.atk}|emtpyHand`
        i.atkPlayedCard = true;
        logger.debug(log);
        checkCompetitionDefender(G, ctx);
    }
}

export const getExtraScoreForFinal = (G: IG, ctx: Ctx, pid: PlayerID): number => {
    let i = parseInt(pid);
    let extraVP = 0;
    let p = G.pub[i];
    let s = G.player[i];
    if (p.school !== null) {
        extraVP += p.school.vp
    }
    let validID = [...G.secretInfo.playerDecks[i], ...p.discard, ...s.hand]
    let validCards = validID.map(c => getCardById(c));
    validCards.forEach(c => extraVP += c.vp);
    if (p.building.cinemaBuilt) extraVP += 3;
    if (p.building.studioBuilt) extraVP += 3;
    if (p.industry === 10) {
        for (let j = 0; j < ctx.numPlayers; i++) {
            let each = G.pub[j];
            if (each.building.cinemaBuilt) extraVP += 5;
            if (each.building.studioBuilt) extraVP += 5;
        }
    }
    if (p.aesthetics === 10) {
        extraVP += Math.round(p.vp / 5);
    }
    ValidRegions.forEach(r => {
        let championCount = p.champions.filter(c => c.region === r).length;
        extraVP += p.archive.filter(card => getCardById(card).region === r).length * championCount;
    });
    if (p.scoreEvents.includes(EventCardID.E10)) {
        for (let j = 0; j < ctx.numPlayers; i++) {
            if (j !== parseInt(pid)) {
                let other = G.pub[j];
                if (other.vp > p.vp) {
                    extraVP += 4;
                }
            }
        }
    }
    if (p.scoreEvents.includes(EventCardID.E11)) {
        G.secretInfo.playerDecks[i].filter(c => getCardById(c).type === CardType.P).forEach(() => extraVP += 4);
        extraVP += p.archive.filter(card => getCardById(card).type === CardType.P).length * 4;
    }
    if (p.scoreEvents.includes(EventCardID.E12)) {
        extraVP += p.industry;
        extraVP += p.aesthetics;
    }
    if (p.scoreEvents.includes(EventCardID.E13)) {
        let championCount = p.champions.length;
        switch (championCount) {
            case 6:
            case 5:
            case 4:
                extraVP += 20;
                break;
            case 3:
                extraVP += 12;
                break;
            case 2:
                extraVP += 6;
                break;
            case 1:
                extraVP += 2;
                break;
            default:
                break;
        }
    }
    if (p.scoreEvents.includes(EventCardID.E14)) {
        extraVP += G.secretInfo.playerDecks[i].filter(c => getCardById(c).category === CardCategory.BASIC).length;
        extraVP += p.archive.filter(card => getCardById(card).category === CardCategory.BASIC).length;
    }
    if (validID.includes("3102")) {
        extraVP += validCards.filter(c => c.industry > 0)
            .filter(c => c.category === CardCategory.LEGEND || c.category === CardCategory.NORMAL)
            .length * 2
    }
    if (validID.includes("3106")) {
        extraVP += validCards.filter(c => c.region === Region.NA)
            .filter(c => c.type === CardType.F)
            .length * 2
    }
    if (validID.includes("3402")) {
        extraVP += validCards.filter(c => c.region === Region.ASIA)
            .filter(c => c.type === CardType.F)
            .length * 2
    }
    if (validID.includes("3107")) {
        extraVP += Math.round(validCards.length / 3)
    }
    if (validID.includes("3202")) {
        extraVP += validCards.filter(c => c.region === Region.WE)
            .length * 2
    }
    if (validID.includes("3302")) {
        extraVP += p.industry * 2;
    }
    if (validID.includes("3403")) {
        extraVP += p.aesthetics * 2;
    }
    if (validID.includes("3301")) {
        extraVP += validCards.filter(c => c.region === Region.EE)
            .length * 2
    }
    if (validID.includes("3203")) {
        extraVP += validCards.filter(c => c.aesthetics > 0)
            .filter(c => c.category === CardCategory.LEGEND || c.category === CardCategory.NORMAL)
            .length * 2
    }
    if (validID.includes("3401")) {
        extraVP += validCards.filter(c => c.type === CardType.P).length * 4
    }
    return extraVP;
}

export const schoolPlayer = (G: IG, ctx: Ctx, cardId: string): PlayerID | null => {
    for (let i = 0; i < ctx.numPlayers; i++) {
        if (G.pub[i].school?.cardId === cardId) return i.toString();
    }
    return null;
}

export const rank = (G: IG, ctx: Ctx, p1: number, p2: number): number => {
    let pub1 = G.pub[p1];
    let pub2 = G.pub[p2];
    let v1, v2;
    if (ctx.gameover) {
        v1 = pub1.vp;
        v2 = pub2.vp;
    } else {
        v1 = pub1.vp + G.player[p1].finalScoringExtraVp;
        v2 = pub1.vp + G.player[p2].finalScoringExtraVp;
    }
    if (v1 > v2) {
        return 1;
    } else {
        if (v1 < v2) {
            return -1;
        } else {
            return posOfPlayer(G, ctx, p1.toString())
            < posOfPlayer(G, ctx, p2.toString()) ?
                1 : -1;
        }
    }
}
export const finalScoring = (G: IG, ctx: Ctx) => {
    let pid: number[] = [];
    for (let i = 0; i < ctx.numPlayers; i++) {
        G.pub[i].vp += getExtraScoreForFinal(G, ctx, i.toString());
        pid.push(i);
    }
    const rankFunc = (a: number, b: number) => rank(G, ctx, a, b);
    let finalRank = pid.sort(rankFunc);
    ctx?.events?.endGame?.({
        winner: finalRank[0].toString(),
        reason: "finalScoring",
    })
}

export const getCardName = (cardId: string) => {
    if (cardId in i18n.card) {
        // @ts-ignore
        return i18n.card[cardId];
    } else {
        if (cardId in ClassicCardID) {
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

export const cardEffectText = (cardId: CardID): string => {
    let effObj = getCardEffect(cardId);
    // TODO region closure capture
    let r: string[] = [];
    if (effObj.hasOwnProperty("buy") && effObj.buy.e !== "none") {
        r.push(i18n.effect.buyCardHeader);
        r.push(effName(effObj.buy));
    }
    if (effObj.hasOwnProperty("play") && effObj.play.e !== "none") {
        r.push(i18n.effect.playCardHeader);
        r.push(effName(effObj.play));
    }
    if (effObj.hasOwnProperty("archive") && effObj.archive.e !== "none") {
        r.push(i18n.effect.breakthroughHeader);
        r.push(effName(effObj.archive));
    }
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
        case "playerVpChampion":
        case "playerNotVpChampion":
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
