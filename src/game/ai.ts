import {Ctx, PlayerID} from "boardgame.io";
import {IG} from "../types/setup";
import {actualStage, canAfford, getPossibleHelper, resCost} from "./util";
import {Stage} from "boardgame.io/core";
import {
    Region,
    SimpleRuleNumPlayers,
    valid_regions,
    BasicCardID,
    IBasicCard,
    INormalOrLegendCard,
    getCardById,
} from "../types/core";
import {getChooseHandChoice, getPeekChoices} from "./board-util";
const getCardName = ()=>"";
export const buyCardArgEnumerate = (G: IG, ctx: Ctx, p: PlayerID, card: INormalOrLegendCard | IBasicCard):
    Array<{ move: string; args?: any[] }> => {
    const moves: Array<{ move: string; args?: any[] }> = [];
    const pub = G.pub[parseInt(p)]
    const totalRes = pub.resource + pub.deposit
    const noHelperCost = resCost(G, ctx, {
        target: card.cardId, buyer: p, resource: 0, deposit: 0, helper: []
    })
    if (noHelperCost <= totalRes) {
        moves.push({
            move: "buyCard", args: [{
                target: card.cardId, buyer: p,
                resource: Math.min(pub.resource, noHelperCost),
                deposit: Math.max(noHelperCost - pub.deposit, 0),
                helper: []
            }]
        })
    } else {
        const validHelpers = getPossibleHelper(G, ctx, p, card.cardId);
        const len = validHelpers.length;
        // TODO optimize with dynamic programming
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
                            deposit: Math.max(curCost - pub.deposit, 0),
                            helper: curHelper
                        }]
                    })
                }
            }
        }
    }
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
    if(ctx.phase === "InitPhase"){
        return [{move: "showBoardStatus", args: [boardStatus]}]
    }
    const stage = actualStage(G, ctx);
    let moves: Array<{ move: string; args?: any[] }> = [];
    const pub = G.pub[parseInt(p)]
    const playerObj = G.player[parseInt(p)]
    const hand = playerObj.hand

    const peek = playerObj.cardsToPeek;
    const CheapBasicCards = [BasicCardID.B01,BasicCardID.B02,BasicCardID.B03,BasicCardID.B04]
    const AvailBasicCards = CheapBasicCards.filter(b => G.basicCards[b] > 0)
    switch (stage) {
        case Stage.NULL:
            playerObj.hand.forEach((i, idx) => {
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
                moves.push({move: "drawCard", args: [p]})
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
                    }))
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
                moves.concat(buyCardArgEnumerate(G, ctx, p, getCardById(BasicCardID.B05)));
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
                                moves.concat(buyCardArgEnumerate(G, ctx, p, getCardById(slot.card)));
                            }
                        }
                    })
                    G.twoPlayer.school.forEach(slot => {
                        if (slot.card !== null) {
                            if (canAfford(G, ctx, slot.card, p)) {
                                moves.concat(buyCardArgEnumerate(G, ctx, p, getCardById(slot.card)));
                            }
                        }
                    })
                }
            }
            if (pub.action === 0 && moves.length === 0) {
                return [{move: "requestEndTurn", args: [p]}];
            }
            break;
        case"chooseHand":
            const chooseHandChoices = getChooseHandChoice(G, p, getCardName);
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
                const validChoices = getPeekChoices(G, p, getCardName).filter(c => !c.disabled);
                validChoices.forEach(c => moves.push({
                    move: stage, args: [{
                        idx: parseInt(c.value), p: p, card: peek[parseInt(c.value)], shownCards: peek
                    }]
                }))
            }
            break;
        case "updateSlot":
        case "comment":
            if (ctx.numPlayers > SimpleRuleNumPlayers) {
                valid_regions.forEach(r => {
                    let rObj = G.regions[r];
                    let card = rObj.legend.card;
                    if (card !== null) {
                        moves.push({move: stage, args: [rObj.legend]})

                    }
                    for (let slot of rObj.normal) {
                        if (slot.card !== null) {
                            moves.push({move: stage, args: [slot]})
                        }
                    }
                })
            } else {
                G.twoPlayer.film.forEach((slot,) => {
                    if (slot.card !== null) {
                        moves.push({move: stage, args: [slot.card]})
                    }
                })
                G.twoPlayer.school.forEach((slot) => {
                    if (slot.card !== null) {
                        moves.push({move: stage, args: [slot.card]})
                    }
                })
            }
            break;
        case "showBoardStatus":
            return [{move: stage, args: [boardStatus]}]
        case "moveBlocker":
            return [];
    }
    return moves;
}
