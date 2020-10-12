import {Ctx, PlayerID} from "boardgame.io";
import {IG} from "../types/setup";
import {actualStage, canAfford, getPossibleHelper, resCost} from "./util";
import {Stage} from "boardgame.io/core";
import {IBasicCard, INormalOrLegendCard, SimpleRuleNumPlayers, ValidRegions} from "../types/core";

export const buyCardArgEnumerate = (G: IG, ctx: Ctx, p: PlayerID, card: INormalOrLegendCard | IBasicCard):
    Array<{ move: string; args?: any[] }> => {
    let moves: Array<{ move: string; args?: any[] }> = [];
    let pub = G.pub[parseInt(p)]
    let totalRes = pub.resource + pub.deposit
    let noHelperCost = resCost(G, ctx, {
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
    }else {
        let validHelpers = getPossibleHelper(G,ctx,p,card);
        let helperCost = resCost(G, ctx, {
            target: card.cardId, buyer: p, resource: 0, deposit: 0, helper: validHelpers.map(c=>c.cardId)
        })
        moves.push({
            move: "buyCard", args: [{
                target: card.cardId, buyer: p,
                resource: Math.min(pub.resource, helperCost),
                deposit: Math.max(helperCost - pub.deposit, 0),
                helper: validHelpers.map(c=>c.cardId)
            }]
        })
    }
    return moves;
}

export const enumerateMoves = (G: IG, ctx: Ctx, p: PlayerID):
    Array<{ move: string; args?: any[] }> => {
    let stage = actualStage(G, ctx);
    let moves: Array<{ move: string; args?: any[] }> = [];
    let pub = G.pub[parseInt(p)]
    let playerObj = G.player[parseInt(p)]
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
                moves.push({move: "drawCard", args: []})
                if (pub.resource >= 2) {
                    playerObj.hand.forEach((i, idx) => {
                        moves.push({
                            move: "breakthrough",
                            args: [{
                                idx: idx, card: i, playerID: p, res: 2,
                            }]
                        })
                    })
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
                }
                if (ctx.numPlayers > SimpleRuleNumPlayers) {
                    ValidRegions.forEach(r => {
                        let rObj = G.regions[r];
                        let card = rObj.legend.card;
                        if (card !== null) {
                            if (canAfford(G, ctx, card, p)) {
                                moves.concat(buyCardArgEnumerate(G, ctx, p, card));
                            }
                        }
                        for (let slot of rObj.normal) {
                            if (slot.card !== null) {
                                if (canAfford(G, ctx, slot.card, p)) {
                                    moves.concat(buyCardArgEnumerate(G, ctx, p, slot.card));
                                }
                            }
                        }
                    })
                } else {
                    G.twoPlayer.film.forEach(slot => {
                        if (slot.card !== null) {
                            if (canAfford(G, ctx, slot.card, p)) {
                                moves.concat(buyCardArgEnumerate(G, ctx, p, slot.card));

                            }
                        }
                    })
                    G.twoPlayer.school.forEach(slot => {
                        if (slot.card !== null) {
                            if (canAfford(G, ctx, slot.card, p)) {
                                moves.concat(buyCardArgEnumerate(G, ctx, p, slot.card));
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
            playerObj.hand.forEach((i, idx) => {
                moves.push({
                    move: stage, args: [{
                        idx: idx, hand: i, p: p
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
        case "chooseTarget":
            G.c.players.forEach((i, idx) => {
                moves.push({
                    move: stage, args: [{idx: idx, target: i, p: p}]
                })
            })
            break;
        case "chooseRegion":
            G.e.regions.forEach((r, idx) => moves.push({
                move: stage, args: [{region: r, idx: idx, p: p}]
            }))
            break;
        case "chooseEvent":
            G.events.forEach((r, idx) => moves.push({
                move: stage, args: [{event: r, idx: idx, p: p}]
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
            playerObj.cardsToPeek.forEach((c, idx) => moves.push({
                move: stage, args: [{idx: idx, card: c, p: p}]
            }))
            break;
        case "updateSlot":
        case "comment":
            if (ctx.numPlayers > SimpleRuleNumPlayers) {
                ValidRegions.forEach(r => {
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
                G.twoPlayer.film.forEach((slot, ) => {
                    if (slot.card !== null) {
                        moves.push({move: stage, args: [slot.card.cardId]})
                    }
                })
                G.twoPlayer.school.forEach((slot) => {
                    if (slot.card !== null) {
                        moves.push({move: stage, args: [slot.card.cardId]})
                    }
                })
            }
            break;
        case "showBoardStatus":
            return [{move: stage, args: [G.pub]}]
        case "moveBlocker":
            return [];
    }
    return moves;
}
