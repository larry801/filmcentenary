import {PlayerID} from "boardgame.io";
import {IG} from "../types/setup";
import {CardCategory, CardID, getCardById, ItrEffects} from "../types/core";

export const getHandChoice = (G: IG, playerID: PlayerID, getCardName: (id: string) => string) => {
    return playerID === null ? [] : G.player[parseInt(playerID)].hand.map((c, idx) => {
        return {
            label: getCardName(c),
            disabled: false,
            hidden: false,
            value: idx.toString()
        }
    })
}
export const getChooseHandChoice = (G: IG, playerID: PlayerID, getCardName: (id: string) => string) => {
    const handChoices = getHandChoice(G, playerID, getCardName);
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
            case ItrEffects.discardBasic:
                return G.player[parseInt(playerID)].hand.map((c, idx) => {
                    return {
                        label: getCardName(c),
                        disabled: false,
                        hidden: getCardById(c).category !== CardCategory.BASIC,
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
                        hidden: getCardById(c).aesthetics === 0 || c === G.e.card,
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

export const getPeekChoices = (G: IG, playerID: PlayerID, getCardName: (id: string) => string) => {
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

export const inferDeckRemoveHelper = (result: CardID[], cardsToRemove: CardID[]): void => {
    cardsToRemove.forEach(c => {
        const indexOf = result.indexOf(c)
        if (indexOf !== -1) {
            result.splice(indexOf, 1)
        }
    })
}

export const getPlayerInferredHand = (G: IG, pid: PlayerID): CardID[] => {
    const pub = G.pub[parseInt(pid)];
    const result = [...pub.allCards]
    inferDeckRemoveHelper(result, pub.discard)
    inferDeckRemoveHelper(result, pub.playedCardInTurn)
    if (pub.school !== null) {
        let sIndex = result.indexOf(pub.school)
        if (sIndex !== -1) {
            result.splice(sIndex, 1);
        }
    }
    inferDeckRemoveHelper(result, pub.archive)
    return result;
}

