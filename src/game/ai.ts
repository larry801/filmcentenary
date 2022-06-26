import {Ctx, PlayerID} from "boardgame.io";
import {IG} from "../types/setup";
import {
    actualStage,
    canAfford,
    getExtraScoreForFinal,
    getPlayerAction,
    getPossibleHelper,
    getSchoolHandLimit,
    resCost
} from "./util";
import {Stage} from "boardgame.io/core";
import {
    BasicCardID,
    getCardById,
    IBasicCard,
    INormalOrLegendCard,
    Region,
    SimpleRuleNumPlayers,
    valid_regions,
} from "../types/core";
import {getChooseHandChoice, getPeekChoices} from "./board-util";

const getCardNameMock = () => "";
export const buyCardArgEnumerate = (G: IG, ctx: Ctx, p: PlayerID, card: INormalOrLegendCard | IBasicCard):
    Array<{ move: string; args?: any[] }> => {
    let log = (`buyCardArgEnumerate|p${p}|${card.cardId}`);
    const moves: Array<{ move: string; args?: any[] }> = [];
    const pub = G.pub[parseInt(p)];
    const totalRes = pub.resource + pub.deposit;
    log += `|totalRes${totalRes}`
    const noHelperCost = resCost(G, ctx, {
        target: card.cardId, buyer: p, resource: 0, deposit: 0, helper: []
    })
    log += `|noHelperCost${noHelperCost}`
    if (noHelperCost <= totalRes) {
        moves.push({
            move: "buyCard", args: [{
                target: card.cardId, buyer: p,
                resource: Math.min(pub.resource, noHelperCost),
                deposit: Math.max(noHelperCost - pub.resource, 0),
                helper: []
            }]
        })
    } else {
        const validHelpers = getPossibleHelper(G, ctx, p, card.cardId);
        const len = validHelpers.length;
        const moveCount = 2 ** len;
        for (let c = 0; c < moveCount; c++) {
            for (let h = 0; h < len; h++) {
                const curHelper = []
                if ((c & (h + 1)) === 1) {
                    curHelper.push(validHelpers[h])
                }
                const curCost = resCost(G, ctx, {
                    target: card.cardId, buyer: p, resource: 0, deposit: 0, helper: curHelper
                })
                if (curCost <= totalRes) {
                    moves.push({
                        move: "buyCard", args: [{
                            target: card.cardId, buyer: p,
                            resource: Math.min(pub.resource, curCost),
                            deposit: Math.max(curCost - pub.resource, 0),
                            helper: curHelper
                        }]
                    })
                }
            }
        }
    }
    log += (`${JSON.stringify(moves)}`);
    console.log(`${G.matchID}|${log}`);
    return moves;
}

export const enumerateMoves = (G: IG, ctx: Ctx, p: PlayerID):
    Array<{ move: string; args?: any[] }> => {
    const boardStatus = ctx.numPlayers > SimpleRuleNumPlayers ? {
        regions: [
            G.regions[Region.NA],
            G.regions[Region.WE],
            G.regions[Region.EE],
            G.regions[Region.ASIA],
        ],
        school: [],
        film: [],
        matchID: "",
        seed: "",
    } : {
        regions: [],
        school: G.twoPlayer.school,
        film: G.twoPlayer.film,
        matchID: "",
        seed: "",
    }
    if (ctx.phase === "InitPhase") {
        return [{move: "showBoardStatus", args: [boardStatus]}]
    }
    const stage = actualStage(G, ctx);
    let moves: Array<{ move: string; args?: any[] }> = [];
    const pub = G.pub[parseInt(p)]
    const playerObj = G.player[parseInt(p)]
    const hand = playerObj.hand

    const peek = playerObj.cardsToPeek;
    const CheapBasicCards = [BasicCardID.B01, BasicCardID.B02, BasicCardID.B03];
    const CommentCards = [BasicCardID.B01, BasicCardID.B02, BasicCardID.B03, BasicCardID.B04];
    const AvailBasicCards = CheapBasicCards.filter(b => G.basicCards[b] > 0);
    const actionPointLimit = getPlayerAction(G, p);
    switch (stage) {
        case Stage.NULL:
            playerObj.hand.forEach((i, idx) => {
                if (
                    i === BasicCardID.B01 ||
                    i === BasicCardID.B02
                ) {
                    return;
                }
                moves.push({
                    move: "playCard",
                    args: [{
                        idx: idx,
                        card: i,
                        playerID: p,
                        res: 0,
                    }]
                })
            })
            if (pub.action >= 1) {
                if (actionPointLimit > 1) {
                    moves.push({move: "drawCard", args: [p]});
                }
                // moves.push({
                //     move: "buyCard", args: [{
                //         target: BasicCardID.B04, buyer: p,
                //         resource: 0,
                //         deposit: 0,
                //         helper: []
                //     }]
                // });
                if (pub.resource >= 2) {
                    playerObj.hand.forEach((i, idx) => {
                        moves.push({
                            move: "breakthrough",
                            args: [{
                                idx: idx, card: i, playerID: p, res: 2,
                            }]
                        })
                    })
                    AvailBasicCards.forEach(b => moves.push({
                        move: "buyCard", args: [{
                            target: b, buyer: p,
                            resource: 2,
                            deposit: 0,
                            helper: []
                        }]
                    }));
                }
                if (pub.resource >= 1 && pub.deposit >= 1) {
                    playerObj.hand.forEach((i, idx) => {
                        moves.push({
                            move: "breakthrough",
                            args: [{
                                idx: idx, card: i, playerID: p, res: 1,
                            }]
                        })
                    })
                    AvailBasicCards.forEach(b => moves.push({
                        move: "buyCard", args: [{
                            target: b, buyer: p,
                            resource: 1,
                            deposit: 1,
                            helper: []
                        }]
                    }))
                }
                if (pub.deposit >= 2) {
                    playerObj.hand.forEach((i, idx) => {
                        moves.push({
                            move: "breakthrough",
                            args: [{
                                idx: idx, card: i, playerID: p, res: 0,
                            }]
                        })
                    })
                    AvailBasicCards.forEach(b => moves.push({
                        move: "buyCard", args: [{
                            target: b, buyer: p,
                            resource: 0,
                            deposit: 2,
                            helper: []
                        }]
                    }))
                }
                moves = [...moves, ...buyCardArgEnumerate(G, ctx, p, getCardById(BasicCardID.B05))];
                if (ctx.numPlayers > SimpleRuleNumPlayers) {
                    valid_regions.forEach(r => {
                        let rObj = G.regions[r];
                        if (rObj.legend.card === null) return;
                        let card = getCardById(rObj.legend.card);
                        if (canAfford(G, ctx, rObj.legend.card, p)) {
                            moves.concat(buyCardArgEnumerate(G, ctx, p, card));
                        }
                        for (let slot of rObj.normal) {
                            if (slot.card !== null) {
                                if (canAfford(G, ctx, slot.card, p)) {
                                    moves.concat(buyCardArgEnumerate(G, ctx, p, getCardById(slot.card)));
                                }
                            }
                        }
                    })
                } else {
                    G.twoPlayer.film.forEach(slot => {
                        if (slot.card !== null) {
                            if (canAfford(G, ctx, slot.card, p)) {
                                moves = [...moves, ...buyCardArgEnumerate(G, ctx, p, getCardById(slot.card))];
                            }
                        }
                    })
                    G.twoPlayer.school.forEach(slot => {
                        if (slot.card !== null) {
                            if (canAfford(G, ctx, slot.card, p)) {
                                moves = [...moves, ...buyCardArgEnumerate(G, ctx, p, getCardById(slot.card))];
                            }
                        }
                    })
                }
            }
            if (moves.length === 0) {
                if (actionPointLimit === 1 && pub.action > 0) {
                    return [{move: "drawCard", args: [p]}];
                } else {
                    return [{move: "requestEndTurn", args: [p]}];
                }

            }
            break;
        case"chooseHand":
            const chooseHandChoices = getChooseHandChoice(G, p, getCardNameMock);
            const validChoice = chooseHandChoices.filter(c => !c.disabled);
            validChoice.forEach((i) => {
                moves.push({
                    move: stage, args: [{
                        idx: parseInt(i.value), hand: hand[parseInt(i.value)], p: p
                    }]
                })
            })
            break;
        case "chooseEffect":
            G.e.choices.forEach((i, idx) => {
                if (G.e.choices.length > 1 && i.e === "skipBreakthrough") {
                    return;
                }
                moves.push({
                    move: stage, args: [{
                        idx: idx, effect: i, p: p
                    }]
                })
            })
            break;
        case "showCompetitionResult":
            moves.push({move: stage, args: [G.competitionInfo]});
            break;
        case "chooseTarget":
            G.c.players.forEach((i, idx) => {
                moves.push({
                    move: stage, args: [{idx: idx, target: i, p: p}]
                })
            })
            break;
        case "chooseRegion":
            G.e.regions.forEach((r, idx) => moves.push({
                move: stage, args: [{r: r, idx: idx, p: p}]
            }))
            break;
        case "chooseEvent":
            G.events.forEach((r, idx) => moves.push({
                move: stage, args: [{
                    event: r,
                    idx: idx,
                    p: p
                }]
            }))
            break;
        case "competitionCard":
            playerObj.hand.forEach((i, idx) => {
                moves.push({
                    move: stage, args: [{
                        pass: false, idx: idx, card: i, p: p
                    }]
                })
            })
            break;
        case "peek":
            const peekCardLength = peek.length.toString();
            const hasCurEffect = G.e.stack.length > 0;
            const peekChoicesDisabled = hasCurEffect && G.e.stack[0].e === "peek" ? G.e.stack[0].a.filter.e !== "choice" : true;
            if (peekChoicesDisabled) {
                moves.push({
                    move: stage, args: [{
                        idx: peekCardLength, p: p, card: null, shownCards: peek
                    }]
                })
            } else {
                const validChoices = getPeekChoices(G, p, getCardNameMock).filter(c => !c.disabled);
                validChoices.forEach(c => moves.push({
                    move: stage, args: [{
                        idx: parseInt(c.value), p: p, card: peek[parseInt(c.value)], shownCards: peek
                    }]
                }))
            }
            break;
        case "updateSlot":
            if (ctx.numPlayers > SimpleRuleNumPlayers) {
                valid_regions.forEach(r => {
                    const rObj = G.regions[r];
                    const slot = rObj.legend;
                    if (slot.card !== null) {

                        moves.push({
                            move: stage, args: [slot.card]
                        })
                    }
                    for (let slot of rObj.normal) {
                        if (slot.card !== null) {
                            moves.push({
                                move: stage, args: [slot.card]
                            })
                        }
                    }
                })
            } else {
                G.twoPlayer.film.forEach((slot,) => {
                    if (slot.card !== null) {
                        moves.push({
                            move: stage, args: [slot.card]
                        })
                    }
                })
                G.twoPlayer.school.forEach((slot) => {
                    if (slot.card !== null) {
                        moves.push({
                            move: stage, args: [slot.card]
                        })
                    }
                })
            }
            break;
        case "comment":
            if (ctx.numPlayers > SimpleRuleNumPlayers) {
                valid_regions.forEach(r => {
                    const rObj = G.regions[r];
                    const slot = rObj.legend;
                    if (slot.card !== null) {
                        if (slot.comment !== null) {
                            moves.push({
                                move: stage, args: [{
                                    target: slot.card,
                                    comment: null,
                                    p: p,
                                }]
                            })
                        } else {
                            CommentCards.forEach(c => moves.push({
                                move: stage, args: [{
                                    target: slot.card,
                                    comment: c,
                                    p: p,
                                }]
                            }))
                        }
                    }
                    for (let slot of rObj.normal) {
                        if (slot.card !== null) {
                            if (slot.comment !== null) {
                                moves.push({
                                    move: stage, args: [{
                                        target: slot.card,
                                        comment: null,
                                        p: p,
                                    }]
                                })
                            } else {
                                for (let basicCard of CommentCards) {
                                    moves.push({
                                        move: stage, args: [{
                                            target: slot.card,
                                            comment: basicCard,
                                            p: p,
                                        }]
                                    })
                                }
                            }
                        }
                    }
                })
            } else {
                G.twoPlayer.film.forEach((slot,) => {
                    if (slot.card !== null) {
                        if (slot.comment !== null) {
                            moves.push({
                                move: stage, args: [{
                                    target: slot.card,
                                    comment: null,
                                    p: p,
                                }]
                            })
                        } else {
                            CommentCards.forEach(c => moves.push({
                                move: stage, args: [{
                                    target: slot.card,
                                    comment: c,
                                    p: p,
                                }]
                            }))
                        }
                    }
                })
                G.twoPlayer.school.forEach((slot) => {
                    if (slot.card !== null) {
                        if (slot.comment !== null) {
                            moves.push({
                                move: stage, args: [{
                                    target: slot.card,
                                    comment: null,
                                    p: p,
                                }]
                            })
                        } else {
                            CommentCards.forEach(c => moves.push({
                                move: stage, args: [{
                                    target: slot.card,
                                    comment: c,
                                    p: p,
                                }]
                            }))
                        }
                    }
                })
            }
            break;
        case "showBoardStatus":
            return [{move: stage, args: [boardStatus]}]
        case "payAdditionalCost":
            const costToPay = G.e.extraCostToPay;
            const totalRes = pub.resource + pub.deposit;
            const minDeposit = Math.max(costToPay - pub.resource, 0);
            const maxExtraDeposit = costToPay - pub.resource;
            if (totalRes > costToPay) {
                for (let extraDeposit = 0; extraDeposit <= maxExtraDeposit; extraDeposit++) {
                    moves.push({
                        move: stage,
                        args: [{
                            res: costToPay - minDeposit - extraDeposit,
                            deposit: minDeposit + extraDeposit,
                        }]
                    })
                }
            } else {
                return [{
                    move: stage, args: [{
                        res: pub.resource,
                        deposit: pub.deposit
                    }]
                }]
            }
            return []
        case "moveBlocker":
            return [];
    }
    return moves;
}

export const statusEvaluation = (G: IG, ctx: Ctx, p: PlayerID): number => {
    const r: IG = JSON.parse(JSON.stringify(G));
    getExtraScoreForFinal(r, ctx, p);
    let log = `statusEvaluation|p${p}`
    const pub = r.pub[parseInt(p)];
    const totalVP = pub.finalScoring.total;
    log += `|vp|${totalVP}`
    console.log(`p${p}:${totalVP}`);
    const deckCount = pub.allCards.length;
    const optimalDeckSize = getSchoolHandLimit(G, p) + 2;
    const deckCountValue = Math.abs(deckCount - optimalDeckSize) * - 10 + 50;

    let deckMarkValue = 0;
    pub.allCards.forEach(c=>{
        const cardObj = getCardById(c);
        deckMarkValue += cardObj.aesthetics * 4;
        deckMarkValue += cardObj.industry * 4;
    })
    log += `|deckMarkValue|${deckMarkValue}`
    log += `|deckCountValue|${deckCountValue}`
    const evaluationResult = totalVP + deckMarkValue + pub.aesthetics * 10 + pub.industry * 10 + deckCountValue
    log += `|p${p}|${evaluationResult}`
    console.log(log)
    return evaluationResult
}

export const objectives = (G: IG, ctx: Ctx, p?: PlayerID) => {
    if (p === undefined) {
        return {}
    } else {
        let r = JSON.parse(JSON.stringify(G));
        getExtraScoreForFinal(r, ctx, p);
        const totalVP = r.pub[parseInt(p)].finalScoring.total;
        console.log(`p${p}:${totalVP}`);
        return {
            evaluation: {
                checker: () => true,
                weight: statusEvaluation(G, ctx, p),
            },
            vp150: {
                checker: () => totalVP > 150,
                weight: 100,
            },
            industryLevelTwo: {
                checker: (G: IG): boolean => {
                    return G.pub[parseInt(p)].industry >= 2
                },
                weight: 20,
            },
            aestheticsLevelTwo: {
                checker: (G: IG): boolean => {
                    return G.pub[parseInt(p)].aesthetics >= 2
                },
                weight: 20,
            }
        }
    }
}
