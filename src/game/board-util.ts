import {PlayerID} from "boardgame.io";
import {IG} from "../types/setup";
import {getCardName} from "./util";
import {CardCategory, CardID} from "../types/core";
import {
    getCardById,
} from "../types/cards"
export const getHandChoice = (G:IG, playerID:PlayerID) =>{
    return playerID === null ? [] : G.player[parseInt(playerID)].hand.map((c, idx) => {
        return {
            label: getCardName(c),
            disabled: false,
            hidden: false,
            value: idx.toString()
        }
    })
}
export const getChooseHandChoice = (G:IG, playerID:PlayerID) =>{
    const handChoices = getHandChoice(G, playerID);
    if (playerID === null) return [];
    if (G.e.stack.length > 0) {
        let eff = G.e.stack.slice(-1)[0];
        switch (eff.e) {
            case "discard":
                return handChoices;
            case "discardAesthetics":
                return G.player[parseInt(playerID)].hand.map((c, idx) => {
                    return {
                        label: getCardName(c),
                        disabled: false,
                        hidden: getCardById(c).aesthetics === 0,
                        value: idx.toString()
                    }
                })
            case "discardNormalOrLegend":
                return G.player[parseInt(playerID)].hand.map((c, idx) => {
                    let card = getCardById(c)
                    return {
                        label: getCardName(c),
                        disabled: false,
                        hidden: card.category !== CardCategory.NORMAL && card.category !== CardCategory.LEGEND,
                        value: idx.toString()
                    }
                })
            case "discardLegend":
                return G.player[parseInt(playerID)].hand.map((c, idx) => {
                    let card = getCardById(c)
                    return {
                        label: getCardName(c),
                        disabled: false,
                        hidden: card.category !== CardCategory.LEGEND,
                        value: idx.toString()
                    }
                })
            case "discardIndustry":
                return G.player[parseInt(playerID)].hand.map((c, idx) => {
                    return {
                        label: getCardName(c),
                        disabled: false,
                        hidden: getCardById(c).industry === 0,
                        value: idx.toString()
                    }
                })
            case "playedCardInTurnEffect":
                return G.pub[parseInt(playerID)].playedCardInTurn.map((c, idx) => {
                    return {
                        label: getCardName(c),
                        disabled: false,
                        hidden: getCardById(c).aesthetics === 0,
                        value: idx.toString()
                    }
                })
            default:
                return handChoices;
        }
    } else {
        return handChoices;
    }
}

export const getPeekChoices = (G:IG, playerID:PlayerID) => {
    const hasCurEffect = G.e.stack.length > 0;
    const peekChoicesDisabled = hasCurEffect && G.e.stack[0].e === "peek" ? G.e.stack[0].a.filter.e !== "choice" : true;
    const peekChoices = G.player[parseInt(playerID)].cardsToPeek
        .map((r: CardID, idx: number) => {
            return {
                label: getCardName(r),
                value: peekChoicesDisabled ? (idx + 1).toString() : idx.toString(),
                hidden: false,
                disabled: peekChoicesDisabled
            }
        });
    const peekNoChoiceChoices = [{
        label: " ",
        value: "0",
        hidden: false,
        disabled: false,
    }, ...peekChoices];
    return peekChoicesDisabled ? peekNoChoiceChoices : peekChoices;
}
