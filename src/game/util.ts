import {Logger} from "tslog";
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
    NoneBasicCardID,
    NormalCardCountInUse,
    Region,
    ShareOnBoard,
    validRegion,
    ValidRegions,
} from "../types/core";
import {IG} from "../types/setup";
import {Ctx, PlayerID} from "boardgame.io";
import {cardsByCond, filmCardsByEra, getCardById, schoolCardsByEra} from "../types/cards";
import {Stage} from "boardgame.io/core";
import {changePlayerStage, changeStage, signalEndTurn} from "./logFix";
import {getCardEffect} from "../constant/effects";
import {B04, getBasicCard} from "../constant/cards/basic";
import {eventCardByEra} from "../constant/cards/event";
import {getScoreCard, scoreCardCount} from "../constant/cards/score";
import i18n from "../constant/i18n";

export const logger: Logger = new Logger();

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

export const doConfirm = (G: IG, ctx: Ctx, a: boolean): void => {
    let stage = actualStage(G, ctx);
    if (stage === Stage.NULL) {
        // TODO
    } else {
        switch (stage) {
            case "chooseEffect":
                if (a) {
                    let eff = G.e.stack.pop();
                    if (eff === undefined) {
                        throw new Error();
                    } else {
                        G.e.stack.push(eff.a)
                    }
                    curEffectExec(G, ctx);
                } else {
                    let eff = G.e.stack.pop();
                    if (eff === undefined) {
                        // TODO
                        throw new Error();
                    } else {
                        G.e.stack.push(eff.a)
                        curEffectExec(G, ctx);
                    }
                }
                return;
            default:
                throw new Error("Unsupported stage " + stage);
        }
    }
}

function isSimpleEffect(eff: any): boolean {
    switch (eff.e) {
        case "competition":
        case "loseAnyRegionShare":
        case "anyRegionShare":
        case "noBuildingEE":
        case "playerNotVpChampion":
        case "playerVpChampion":
        case "handToOthers":
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
        case "pay":
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

function simpleEffectExec(G: IG, ctx: Ctx, p: PlayerID): void {
    let eff = G.e.stack.pop();
    let obj = G.pub[parseInt(p)];
    let card: INormalOrLegendCard;
    let region = G.e.card.region;
    logger.debug({eff:eff})
    switch (eff.e) {
        case "none":
        case "skipBreakthrough":
            return
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
        case "buyCard":
            card = getCardById(eff.a);
            doBuy(G, ctx, card, ctx.currentPlayer);
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
            logger.error("Invalid effect" + JSON.stringify(eff));
            throw new Error(JSON.stringify(eff));
    }

}

export const doBuyToHand = (G: IG, ctx: Ctx, card: INormalOrLegendCard | IBasicCard, p: PlayerID): void => {
    let obj = G.player[parseInt(p)];
    let pObj = G.pub[parseInt(p)];
    if (card.category === CardCategory.BASIC) {
        // @ts-ignore
        G.basicCards[card.cardId] -= 1;
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
    obj.hand.push(card);
    pObj.allCards.push(card)
}

export const doBuy = (G: IG, ctx: Ctx, card: INormalOrLegendCard | IBasicCard, p: PlayerID): void => {
    let obj = G.pub[parseInt(p)];
    if (card.category === CardCategory.BASIC) {
        let count = G.basicCards[card.cardId as BasicCardID];
        if (count > 0) {
            G.basicCards[card.cardId as BasicCardID] -= 1;
            obj.discard.push(card);
            obj.allCards.push(card);
        }
    } else {
        let slot: ICardSlot | null;
        if (ctx.numPlayers === 2) {
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
                if (ctx.numPlayers !== 2) {
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
            if (ctx.numPlayers === 2) {
                if (card.type === CardType.S) {
                    do2pUpdateSchoolSlot(G, ctx, slot);
                } else {
                    do2pUpdateFilmSlot(G, ctx, slot);
                }
            } else {
                doReturnSlotCard(G, ctx, slot);
            }
        }
        if (card.type === CardType.S) {
            let school = obj.school;

            let kino = schoolPlayer(G, ctx, "1303");
            if (kino !== null) {
                G.e.stack.push(getCardEffect("1303").repsonse.effect);
                simpleEffectExec(G, ctx, kino);
            }
            if (school !== null) {
                if (school.cardId === "1203") {
                    if (obj.aesthetics < 10) {
                        obj.aesthetics++;
                    }
                }
                obj.archive.push(school);
            }
            obj.school = card as ISchoolCard;
        } else {
            obj.discard.push(card);
        }
        obj.allCards.push(card);

    }

}

export function getKinoEyePlayer(G: IG, ctx: Ctx): PlayerID | null {
    Array(ctx.numPlayers).fill(1).map((i, idx) => idx.toString())
        .forEach(i => {
            if (G.pub[parseInt(i)].school?.cardId === "1303") {
                return i;
            }
        })
    return null;
}

const idInHand = (G: IG, ctx: Ctx, p: number, cardId: string): boolean => {
    return G.player[p].hand.filter(c => c.cardId === cardId).length > 0;
}

export const getPidHasCard = (G: IG, ctx: Ctx, cardId: string): number[] => {
    let p: number[] = [];
    Array(ctx.numPlayers).fill(1).forEach((i, idx) => {
            if (idInHand(G, ctx, idx, cardId)) {
                p.push(idx);
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

export const seqFromActive = (G: IG, ctx: Ctx): PlayerID[] => {
    let act = activePlayer(ctx);
    let pos = posOfPlayer(G, ctx, act);
    let seq = [];
    for (let i = pos; i < ctx.numPlayers; i++) {
        seq.push(G.order[i])
    }
    for (let i = 0; i < pos; i++) {
        seq.push(G.order[i])
    }
    return seq;
}

export function getCardCompetition(G: IG, ctx: Ctx, card: INormalOrLegendCard | IBasicCard): number {

    return 0;
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
    let highestVp = 0;
    let result: PlayerID[] = [];
    Array(ctx.numPlayers).fill(1).forEach((i, idx) => {
        if (G.pub[idx].vp > highestVp) highestVp = G.pub[idx].vp
    })
    Array(ctx.numPlayers).fill(1).forEach((i, idx) => {
        if (G.pub[idx].vp === highestVp) {
            result.push(idx.toString())
        }
    })
    return result;
}

export const curEffectExec = (G: IG, ctx: Ctx): void => {
    let eff = G.e.stack.pop();
    let obj = G.pub[curPid(G, ctx)];
    let playerObj = G.player[curPid(G, ctx)];
    let players: PlayerID[] = [];
    //let card: INormalOrLegendCard;
    let region = G.e.card.region;
    switch (eff.e) {
        case "competition":
            changeStage(G, ctx, "chooseTarget")
            return;
        case "loseAnyRegionShare":
            // @ts-ignore
            G.e.regions = ValidRegions.filter(r => obj.shares[r] > 0)
            if (G.e.regions.length === 0) {
                break;
            } else {
                changeStage(G, ctx, "chooseRegion");
                return;
            }
        case "anyRegionShare":
            let i = G.competitionInfo;
            if (i.pending) {
                let winner = i.progress > 0 ? i.atk : i.def;
                let loser = i.progress > 0 ? i.def : i.atk;
                // @ts-ignore
                G.e.regions = ValidRegions.filter(r => G.pub[parseInt(loser)].shares[r] > 0)
                if (G.e.regions.length === 0) {
                    break;
                } else {
                    changePlayerStage(G, ctx, "chooseRegion", winner);
                    return;
                }
            } else {
                // @ts-ignore
                G.e.regions = ValidRegions.filter(r => G.regions[r].share > 0)
                if (G.e.regions.length === 0) {
                    break;
                } else {
                    changeStage(G, ctx, "chooseRegion");
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
            players = vpChampionPlayer(G, ctx);
            for (let p of players) {
                G.e.stack.push(eff.a);
                simpleEffectExec(G, ctx, p);
            }
            break;
        case "handToOthers":
            changeStage(G, ctx, "chooseHand");
            break;
        case "industryOrAestheticsBreakthrough":
            G.e.choices.push({e: "industryBreakthrough", a: eff.a.industry})
            G.e.choices.push({e: "aestheticsBreakthrough", a: eff.a.aesthetics})
            changeStage(G, ctx, "chooseEffect");
            return;
        case "peek":
            let peekCount = eff.a.count;
            let deck = G.secretInfo.playerDecks[curPid(G, ctx)];
            let len = deck.length;
            if (len < peekCount) {
                playerObj.cardsToPeek = deck;
                deck = [];
                deck = shuffle(ctx, obj.discard);
                obj.discard = [];
                for (let i = 0; i < peekCount - len; i++) {
                    playerObj.cardsToPeek.push(deck.pop() as INormalOrLegendCard);
                }
            } else {
                for (let i = 0; i < peekCount; i++) {
                    playerObj.cardsToPeek.push(deck.pop() as INormalOrLegendCard);
                }
            }
            changeStage(G, ctx, "peek")
            break;
        case "everyOtherCompany":

            if (G.c.players.length === 0) {
                G.c.players = seqFromActive(G, ctx);
                G.c.players.shift()
                G.e.stack.push(eff);
            } else {
                let subEffect = eff.a;
                if (isSimpleEffect(subEffect)) {
                    for (let p of G.c.players) {
                        playerEffExec(G, ctx, p);
                    }
                } else {
                    let player = G.c.players[0] as PlayerID;
                    playerEffExec(G, ctx, player);
                }
            }
            break;
        case "everyPlayer":
            if (G.c.players.length === 0) {
                G.c.players = seqFromActive(G, ctx);
                G.e.stack.push(eff);
            } else {
                let subEffect = eff.a;
                if (isSimpleEffect(subEffect)) {
                    for (let p of G.c.players) {
                        playerEffExec(G, ctx, p);
                    }
                } else {
                    let player = G.c.players[0] as PlayerID;
                    playerEffExec(G, ctx, player);
                }
            }
            break
        case "noStudio":
            G.c.players = noStudioPlayers(G, ctx, region);
            G.e.stack.push(eff.a);
            changeStage(G, ctx, "chooseTarget")
            return;
        case "studio":
            players = studioPlayers(G, ctx, region);
            players.forEach(p => {
                G.e.stack.push(eff.a);
                simpleEffectExec(G, ctx, p)
            });
            break;
        case "step":
            eff.a.reduceRight((_: any, item: any) => {
                return G.e.stack.push(item);
            });
            break;
        case "refactor":
        case "archive":
        case "discard":
        case "discardIndustry":
        case "discardLegend":
        case "discardAesthetics":
        case "discardNormalOrLegend":
            G.e.stack.push(eff);
            changeStage(G, ctx, "chooseHand");
            return;
        case "choice":
            for (let choice of eff.a) {
                if (choice.e === "buy") {
                    if (idOnBoard(G, ctx, choice.a)) {
                        G.e.choices.push(choice);
                    }
                } else {
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
                    changeStage(G, ctx, "chooseEffect");
                    return;
                }
            }
            return;
        case "update":
            changeStage(G, ctx, "updateSlot");
            return;
        case "comment":
            changeStage(G, ctx, "comment");
            return;
        case "pay":
            switch (eff.a.cost) {
                case "res":
                    if (obj.resource < eff.a.cost.a) {
                        checkNextEffect(G, ctx);
                        return;
                    } else {
                        G.e.stack.push(eff);
                        changeStage(G, ctx, "confirmRespond");
                        return;
                    }
                case "vp":
                case "addVp":
                case "addExtraVp":
                    if (obj.vp < eff.a.cost.a) {
                        checkNextEffect(G, ctx);
                        return;
                    } else {
                        G.e.stack.push(eff);
                        changeStage(G, ctx, "confirmRespond");
                        return;
                    }
                case "deposit":
                    if (obj.deposit < eff.a.cost.a) {
                        checkNextEffect(G, ctx);
                        return;
                    } else {
                        G.e.stack.push(eff);
                        changeStage(G, ctx, "confirmRespond");
                        return;
                    }
                default:
                    throw new Error();
            }
        case "optional":
            changeStage(G, ctx, "confirmRespond");
            return;
        default:
            G.e.stack.push(eff);
            simpleEffectExec(G, ctx, ctx.currentPlayer);
    }
    checkNextEffect(G, ctx);
}

export const nextPlayer = (G: IG, ctx: Ctx): void => {
    if (G.c.players.length > 0) {
        G.c.players.shift();
        checkNextEffect(G, ctx);
    } else {
        checkNextEffect(G, ctx);
    }
}

export const playerEffExec = (G: IG, ctx: Ctx, p: PlayerID): void => {
    let eff = G.e.stack.pop();
    let obj = G.pub[parseInt(p)];
    //let card: INormalOrLegendCard;
    //let region = G.e.card.region;

    switch (eff.e) {
        case "archive":
        case "discardIndustry":
        case "discardLegend":
        case "discardAesthetics":
        case "discardNormalOrLegend":
            changePlayerStage(G, ctx, "chooseHand", p);
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
        case "everyPlayer":
            G.e.stack.push(eff);
            switch (eff.e.a.e) {
                case "archiveToEEBuildingVP":
                    changePlayerStage(G, ctx, "chooseHand", p);
                    return;
                case "industryOrAestheticsLevelUp":
                    G.e.choices.push({e: "industryBreakthrough", a: eff.a.industry})
                    G.e.choices.push({e: "aestheticsBreakthrough", a: eff.a.aesthetics})
                    changePlayerStage(G, ctx, "chooseEffect", p);
                    return;
                default:
                    throw new Error()
            }
        default:
            G.e.stack.push(eff);
            simpleEffectExec(G, ctx, p);
    }
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
    if (o.industry > 1) o.deposit += 2;
    if (o.industry > 4) drawCardForPlayer(G, ctx, p);
    if (o.industry > 7) drawCardForPlayer(G, ctx, p);
}

export const cardSlotOnBoard2p = (G: IG, ctx: Ctx, card: INormalOrLegendCard): ICardSlot | null => {
    if (card.region === Region.NONE) return null;
    if (card.type === CardType.S) {
        for (let slot of G.twoPlayer.school) {
            if (slot.card?.cardId === card.cardId) return slot;
        }
        return null;
    } else {
        for (let slot of G.twoPlayer.film) {
            if (slot.card?.cardId === card.cardId) return slot;
        }
        return null;
    }
}
export const cardSlotOnBoard = (G: IG, ctx: Ctx, card: INormalOrLegendCard): ICardSlot | null => {
    if (card.region === Region.NONE) return null;
    let r = G.regions[card.region];
    if (card.category === CardCategory.LEGEND) {
        if (r.legend.card !== null) {
            if (r.legend.card.cardId === card.cardId) {
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
                if (slot.card.cardId === card.cardId) {
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
    return r.legend.card === null && r.normal.filter(value => value.card !== null).length === 0;
}

export function shareDepleted(G: IG, ctx: Ctx, region: Region) {
    if (region === Region.NONE) return false;
    return G.regions[region].share === 0;
}

export function resCost(G: IG, ctx: Ctx, arg: IBuyInfo): number {
    let cost: ICost = arg.target.cost;
    let resRequired = cost.res;
    let pub = G.pub[parseInt(arg.buyer)]
    let aesthetics: number = cost.aesthetics
    let industry: number = cost.industry
    aesthetics -= pub.aesthetics;
    industry -= pub.industry;
    if (pub.school !== null) {
        let school = getCardEffect(pub.school.cardId).school;
        aesthetics -= school.aesthetics;
        industry -= school.industry
        if (arg.target.type === CardType.S) {
            resRequired += pub.school.era;
        }
    }
    for (const helperItem of arg.helper) {
        // @ts-ignore
        industry -= helperItem.industry;
        // @ts-ignore
        aesthetics -= helperItem.aesthetics;
    }
    if (aesthetics > 0) resRequired += aesthetics * 2;
    if (industry > 0) resRequired += industry * 2;
    return resRequired;
}

export function canAfford(G: IG, ctx: Ctx, card: INormalOrLegendCard | IBasicCard, p: PlayerID) {
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
    let resRequired = resCost(G, ctx, arg);
    let resGiven: number = arg.resource + arg.deposit;
    return resRequired === resGiven;
}

export const drawForTwoPlayerEra = (G: IG, ctx: Ctx, e: IEra): void => {
    let school = schoolCardsByEra(e);
    let filmCards = filmCardsByEra(e);
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
            s.card = c as INormalOrLegendCard;
        }
    }
    for (let s of G.twoPlayer.school) {
        let c = G.secretInfo.twoPlayer.school.pop();
        if (c === undefined) {
            throw new Error(c);
        } else {
            s.card = c as INormalOrLegendCard;
        }
    }
}

export const drawForRegion = (G: IG, ctx: Ctx, r: Region, e: IEra): void => {
    if (r === Region.NONE) return;
    let legend = cardsByCond(r, e, true);
    let normal = cardsByCond(r, e, false);
    G.secretInfo.regions[r].legendDeck = shuffle(ctx, legend).slice(0, LegendCardCountInUse[r][e]);
    G.secretInfo.regions[r].normalDeck = shuffle(ctx, normal).slice(0, NormalCardCountInUse[r][e]);
    let l: INormalOrLegendCard[] = G.secretInfo.regions[r].legendDeck;
    let n: INormalOrLegendCard[] = G.secretInfo.regions[r].normalDeck;
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
    let s = G.secretInfo.playerDecks[pid]
    if (s.length === 0) {
        if (ctx.random === undefined) {
            throw new Error();
        } else {
            s = ctx.random.Shuffle(G.pub[pid].discard)
            G.pub[pid].discard = [];
        }
    }
    let card = s.pop();
    if (card === undefined) {
        // TODO what if player has no card at all?
        throw new Error("Error drawing card");
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
        for (let t = 0; t < drawCount; t++) {
            drawCardForPlayer(G, ctx, p);
        }
    }
}

export const do2pUpdateSchoolSlot = (G: IG, ctx: Ctx, slot: ICardSlot): void => {
    if (G.regions[Region.NA].era !== IEra.TWO) {
        if (slot.comment !== null) {
            let commentId: BasicCardID = slot.comment.cardId as BasicCardID;
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
                d.push(oldCard as ISchoolCard);
            }
        }
    }
}
export const do2pUpdateFilmSlot = (G: IG, ctx: Ctx, slot: ICardSlot): void => {
    let d;
    if (slot.comment !== null) {
        let commentId: BasicCardID = slot.comment.cardId as BasicCardID;
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
            slot.card = c;
        }
        if (oldCard !== null) {
            d.push(oldCard as ISchoolCard);
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
                region.legend.card = l.pop() as INormalOrLegendCard;
            }
        }
        for (let slot of region.normal) {
            if (slot.card === null && n.length > 0) {
                slot.card = n.pop() as INormalOrLegendCard;
            }
        }
    }
}

export const doReturnSlotCard = (G: IG, ctx: Ctx, slot: ICardSlot): void => {
    let d;
    if (slot.comment !== null) {
        let commentId: BasicCardID = slot.comment.cardId as BasicCardID;
        G.basicCards[commentId]++;
        slot.comment = null;
    }
    if (slot.region === Region.NONE) return;
    if (slot.isLegend) {
        d = G.secretInfo.regions[slot.region].legendDeck;
    } else {
        d = G.secretInfo.regions[slot.region].normalDeck;
    }

    let oldCard = slot.card;

    if (oldCard !== null) {
        d.unshift(oldCard);
    } else {

        throw new Error("")
    }


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
            c.category === CardCategory.LEGEND
            && c.region === r
            // @ts-ignore
            && c.era === e)
        .length;
}

export const getFirstPlayer = (G: IG, ctx: Ctx, r: Region): PlayerID => {
    return '0'
}

export const doEndTurn = (G: IG, ctx: Ctx,): void => {
    signalEndTurn(G, ctx);
}

export const tryScoring = (G: IG, ctx: Ctx): void => {
    if (G.scoringRegions.length > 0) {
        let r = G.scoringRegions.shift();
        G.scoringRegions.unshift(r as Region);
        regionRank(G, ctx, r as Region);
    } else {
        if (
            G.pending.lastRoundOfGame &&
            posOfPlayer(G, ctx, ctx.currentPlayer)
            === (ctx.numPlayers - 1)
        ) {
            finalScoring(G, ctx);
        } else {
            signalEndTurn(G, ctx);
        }
    }
};

export const regionRank = (G: IG, ctx: Ctx, r: Region): void => {
    if (r === Region.NONE) return;
    let era = G.regions[r].era;
    const rank = (a: PlayerID, b: PlayerID): number => {
        let p1 = G.pub[parseInt(a)];
        let p2 = G.pub[parseInt(b)];
        if (p1.shares[r] > p2.shares[r]) return 1;
        if (legendCount(G, ctx, r, era, a) > legendCount(G, ctx, r, era, b)) return 1;
        if (posOfPlayer(G, ctx, a) < posOfPlayer(G, ctx, b)) {
            return 1;
        } else {
            throw Error("Two player has the same pos")
        }
    }
    let rankingPlayer: PlayerID[] = [];
    Array(ctx.numPlayers).fill(1).forEach((i, idx) => {
        if (G.pub[idx].shares[r] === 0) {
            doBuy(G, ctx, getBasicCard(BasicCardID.B04), idx.toString())
        } else {
            rankingPlayer.push(idx.toString())
        }
    });
    let rankResult = rankingPlayer.sort(rank);
    let firstPlayer: PlayerID = rankResult[0];
    G.pub[parseInt(firstPlayer)].champions.push({
        era: era,
        region: r,
    })

    let scoreCount = scoreCardCount(r, era);
    for (let i = 0; i < scoreCount; i++) {
        // @ts-ignore
        G.pub[parseInt(rankResult[i])].discard.push(
            // @ts-ignore
            getScoreCard(r, era, i + 1)
        )
    }
    for (let i = scoreCount; i < rankResult.length; i++) {
        doBuy(G, ctx, B04, rankResult[i])
    }
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

export function doFillNewEraEvents(G: IG, ctx: Ctx, newEra: IEra) {
    G.secretInfo.events = shuffle(ctx, eventCardByEra(newEra));
    for (let i = 0; i < 2; i++) {
        let newEvent = G.secretInfo.events.pop();
        if (newEvent === undefined) {

        } else {
            G.events.push(newEvent)
        }
    }
}

export function fillEventCard(G: IG, ctx: Ctx) {
    let region = G.scoringRegions.slice(-1)[0];
    if (region === Region.NONE) return;
    let era = G.regions[region].era;
    let newEra: IEra = era === IEra.THREE ? era : era + 1;
    let newEvent = G.secretInfo.events.pop();
    if (newEvent === undefined) {
        throw new Error();
    } else {
        G.events.push(newEvent)
    }
    if (G.secretInfo.events.length === 1) {
        if (G.secretInfo.events[0].cardId === "E03") {
            G.activeEvents.push(EventCardID.E03);
            Array(ctx.numPlayers).fill(0).forEach((i, idx) => {
                if (G.pub[idx].action < 2) G.pub[idx].action = 2
            });
        }
        if (newEra !== era) {
            doFillNewEraEvents(G, ctx, newEra);
        }
    }
}

export function doIndustryBreakthrough(G: IG, ctx: Ctx, player: PlayerID) {
    let p = G.pub[parseInt(player)];
    let totalResource = p.resource + p.deposit;
    if (additionalCostForUpgrade(p.industry) <= totalResource) {
        G.e.choices.push({e: "industryLevelUp", a: 1})
    }
    if (totalResource >= 3 && studioSlotsAvailable(G, ctx, player).length > 0) {
        G.e.choices.push({e: "buildStudio", a: 1})
    }
    if (totalResource >= 3 && cinemaSlotsAvailable(G, ctx, player).length > 0) {
        G.e.choices.push({e: "buildCinema", a: 1})
    }
    G.e.choices.push({e: "skipBreakthrough", a: 1})
    changeStage(G, ctx, "chooseEffect")
}

export function doAestheticsBreakthrough(G: IG, ctx: Ctx, player: PlayerID) {
    let p = G.pub[parseInt(player)];
    let playerObj = G.player[parseInt(player)];
    let totalResource = p.resource + p.deposit;
    if (additionalCostForUpgrade(p.industry) <= totalResource) {
        G.e.choices.push({e: "aestheticsLevelUp", a: 1})
    }
    if (playerObj.hand.length > 0) {
        G.e.choices.push({e: "refactor", a: 1})
    }
    G.e.choices.push({e: "skipBreakthrough", a: 1})
    changeStage(G, ctx, "chooseEffect")
}

export function checkNextEffect(G: IG, ctx: Ctx) {
    if (G.e.stack.length === 0) {
        if (G.scoringRegions.length > 0) {
            let r = G.scoringRegions.shift();
            if (r === undefined) throw new Error();
            nextEra(G, ctx, r);

            if (ValidRegions.filter(r =>
                // @ts-ignore
                G.regions[r].completedModernScoring).length >= 3) {
                G.pending.lastRoundOfGame = true;
            }
            if (ValidRegions.filter(r =>
                    // @ts-ignore
                G.regions[r].era !== IEra.ONE).length >= 2 &&
                G.regions[Region.ASIA].era === IEra.ONE
            ) {
                drawForRegion(G, ctx, Region.ASIA, IEra.TWO);
                G.regions[Region.ASIA].era = IEra.TWO;
                G.regions[Region.ASIA].share = ShareOnBoard[Region.ASIA][IEra.TWO];
            }
            tryScoring(G, ctx);
        } else {
            let i = G.competitionInfo;
            if (i.pending) {
                if (i.atkPlayedCard) {
                    i.atkPlayedCard = false;
                    defCardSettle(G, ctx);
                } else {
                    i.defPlayedCard = false;
                }
            } else {
                if (ctx.activePlayers !== null) {
                    ctx?.events?.endStage?.();
                }
            }
        }
    } else {
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

export function competitionResultSettle(G: IG, ctx: Ctx) {
    let i = G.competitionInfo;
    let atk = G.pub[parseInt(i.atk)];
    let def = G.pub[parseInt(i.def)];
    let winner: PlayerID = '0';
    let hasWinner = false;
    if (i.progress > 5) i.progress = 5;
    if (i.progress < -5) i.progress = -5;
    if (i.progress >= 3) {
        winner = i.atk;
        hasWinner = true;
    } else {
        if (i.progress <= -2) {
            winner = i.def;
            hasWinner = true;
        }
    }
    if (i.progress > 0) {
        atk.vp += i.progress;
        let schoolId = G.pub[parseInt(i.def)].school?.cardId;
        if (schoolId !== "3201" && schoolId !== "3204") {
            loseVp(G, ctx, i.def, i.progress);
        }
    } else {
        let vp = -i.progress;
        def.vp += vp;
        let schoolId = G.pub[parseInt(i.atk)].school?.cardId;
        if (schoolId !== "3201" && schoolId !== "3204") {
            loseVp(G, ctx, i.atk, vp);
        }
    }
    if (hasWinner) {
        if(i.onWin.e!=="none"){
            if(i.onWin.e === "anyRegionShare"){
                G.e.stack.push({
                    e: "anyRegionShare", a: 2
                })
            }else {
                G.e.stack.push(i.onWin);
                i.onWin.e = "none";
                simpleEffectExec(G,ctx,winner);
            }
        }
        G.e.stack.push({
            e: "anyRegionShare", a: 1
        })
        playerEffExec(G, ctx, winner);
        return;
    }

}

export function atkCardSettle(G: IG, ctx: Ctx) {
    let i = G.competitionInfo;
    let cards = G.player[parseInt(i.atk)].competitionCards;
    if (cards.length > 0) {
        let card = cards[0];
        let eff = getCardEffect(card.cardId);
        G.e.stack.push(eff);
        G.pub[parseInt(i.atk)].playedCardInTurn.push(card);
        playerEffExec(G, ctx, i.atk);
    } else {
        defCardSettle(G, ctx);
    }
}

export function defCardSettle(G: IG, ctx: Ctx) {
    let i = G.competitionInfo;
    let cards = G.player[parseInt(i.def)].competitionCards;
    if (cards.length > 0) {
        let card = cards[0];
        let eff = getCardEffect(card.cardId);
        G.pub[parseInt(i.def)].discard.push(card);
        G.e.stack.push(eff);
        playerEffExec(G, ctx, i.def);
    } else {
        competitionResultSettle(G, ctx);
    }
}

export function nextEra(G: IG, ctx: Ctx, r: Region) {
    if (r === Region.NONE) throw new Error();
    let region = G.regions[r];
    let era = region.era;
    let newEra;
    region.legend.card = null;
    if (region.legend.comment !== null) {
        G.basicCards[region.legend.comment.cardId as BasicCardID]++;
        region.legend.comment = null
    }
    for (let s of region.normal) {
        s.card = null;
        if (s.comment !== null) {
            G.basicCards[s.comment.cardId as BasicCardID]++;
            s.comment = null
        }
    }
    if (era === IEra.ONE) {
        newEra = IEra.TWO;
        region.era = newEra;
        drawForRegion(G, ctx, r, newEra);
        region.share = ShareOnBoard[r][newEra];
    }
    if (era === IEra.TWO) {
        newEra = IEra.THREE;

        region.share = ShareOnBoard[r][newEra];
        region.era = newEra;
        newEra = IEra.THREE;
        drawForRegion(G, ctx, r, newEra);
    }
    if (era === IEra.THREE) {
        region.completedModernScoring = true;
    }
}

export const startCompetition = (G: IG, ctx: Ctx, atk: PlayerID, def: PlayerID) => {
    let i = G.competitionInfo;
    i.pending = true;
    i.atk = atk;
    i.def = def;
    i.region = G.e.card.region;
    let classicHollywoodPlayer = schoolPlayer(G, ctx, "3101");
    if (classicHollywoodPlayer === i.atk) {
        i.progress++;
    }
    if (classicHollywoodPlayer === i.def) {
        i.progress--
    }
    let newHollywoodPlayer = schoolPlayer(G, ctx, "3101");
    if (newHollywoodPlayer === i.atk) {
        i.progress++;
    }
    if (newHollywoodPlayer === i.def) {
        i.progress--
    }
    checkCompetitionAttacker(G,ctx);
}


export const checkCompetitionDefender = (G: IG, ctx: Ctx) => {
    let i = G.competitionInfo;
    if (G.player[parseInt(i.def)].hand.length > 0) {
        changePlayerStage(G, ctx, "competitionCard", i.def);
    } else {
        i.defPlayedCard = true;
        competitionResultSettle(G, ctx);
    }
}
export const checkCompetitionAttacker = (G: IG, ctx: Ctx) => {
    let i = G.competitionInfo;
    if (G.player[parseInt(i.atk)].hand.length > 0) {
        changePlayerStage(G, ctx, "competitionCard", i.atk);
    } else {
        i.atkPlayedCard = true;
        checkCompetitionDefender(G, ctx);
    }
}
export const settleCompetition = (G: IG, ctx: Ctx) => {
    let i = G.competitionInfo;
    let atkCard = G.player[parseInt(i.atk)].competitionCards[0];
    let defCard = G.player[parseInt(i.atk)].competitionCards[0];
    // @ts-ignore
    let eff = getCardEffect()
}

export const exitCompetition = (G: IG, ctx: Ctx) => {
    let i = G.competitionInfo;
    i.pending = false;
    i.progress = 0;
    i.atkPlayedCard = false;
    i.defPlayedCard = false;
}
export const getExtraScoreForFinal = (G: IG, ctx: Ctx, pid: PlayerID): number => {
    let i = parseInt(pid);
    let extraVP = 0;
    let p = G.pub[i];
    let s = G.player[i];
    if (p.school !== null) {
        extraVP += p.school.vp
    }
    let validCards =[...G.secretInfo.playerDecks[i],...p.discard, ...s.hand]
    let validID = validCards.map(c=>c.cardId);
    // @ts-ignore
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
        extraVP += p.archive.filter(card => card.region === r).length * championCount;
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
        // @ts-ignore
        G.secretInfo.playerDecks[i].filter(c => c.type === CardType.P).forEach(c => extraVP += 4);
        extraVP += p.archive.filter(card => card.type === CardType.P).length * 4;
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
        extraVP += G.secretInfo.playerDecks[i].filter(c => c.category === CardCategory.BASIC).length;
        extraVP += p.archive.filter(card => card.category === CardCategory.BASIC).length;
    }
    let allCardIds = p.allCards.map(c => c.cardId);
    if (validID.includes("3102")) {
        // @ts-ignore
        extraVP += validCards.filter(c => c.industry > 0)
            .filter(c => c.category === CardCategory.LEGEND || c.category === CardCategory.NORMAL)
            .length * 2
    }
    if (validID.includes("3106")) {
        // @ts-ignore
        extraVP += validCards.filter(c => c.region === Region.NA)
            .filter(c => c.type === CardType.F)
            .length * 2
    }
    if (validID.includes("3402")) {
        // @ts-ignore
        extraVP += validCards.filter(c => c.region === Region.ASIA)
            .filter(c => c.type === CardType.F)
            .length * 2
    }
    if (validID.includes("3107")) {
        // @ts-ignore
        extraVP += Math.round(validCards.length / 3)
    }
    if (validID.includes("3202")) {
        // @ts-ignore
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
        // @ts-ignore
        extraVP += validCards.filter(c => c.region === Region.EE)
            .length * 2
    }
    if (validID.includes("3203")) {
        // @ts-ignore
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

export const cardEffectText = (cardId: BasicCardID | NoneBasicCardID): string => {
    // @ts-ignore
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
