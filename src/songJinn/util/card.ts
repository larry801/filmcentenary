import {SongJinnGame} from "../constant/setup";
import {Ctx, PlayerID} from "boardgame.io";
import {getStateById, playerById} from "./fetch";
import {JinnLateCardID, JinnMidCardID, SJPlayer, SongLateCardID, SongMidCardID} from "../constant/general";
import {getJinnPower} from "./calc";
import {shuffle} from "../../game/util";

export const drawPlanForPlayer = (G: SongJinnGame, pid: PlayerID) => {
    const p = playerById(G, pid);
    const military = getStateById(G, pid).military;
    for (let i = 0; i < military; i++) {
        const newPlan = G.secret.planDeck.pop();
        if (newPlan !== undefined) {
            p.plans.push(newPlan);
        } else {

        }
    }
}

export const drawCardForSong = (G: SongJinnGame, ctx: Ctx) => {
    let deck = G.secret.songDeck;
    const player = G.player[SJPlayer.P1];
    const card = deck.pop();
    if (card === undefined) {
        G.secret.songDeck = shuffle(ctx, G.song.discard);
        G.song.discard = [];
    } else {
        player.hand.push(card);
    }
    if (deck.length === 0) {
        G.secret.songDeck = shuffle(ctx, G.song.discard);
        G.song.discard = [];
    }
}

export const drawCardForJinn = (G: SongJinnGame, ctx: Ctx) => {
    const player = G.player[SJPlayer.P2];
    const card = G.secret.jinnDeck.pop();
    if (card === undefined) {
        G.secret.jinnDeck = shuffle(ctx, G.song.discard);
        G.jinn.discard = [];
    } else {
        player.hand.push(card);
    }
    if (G.secret.jinnDeck.length === 0) {
        G.secret.jinnDeck = shuffle(ctx, G.song.discard);
        G.jinn.discard = [];
    }
}

export const drawPhaseForSong = (G: SongJinnGame, ctx: Ctx) => {
    const player = G.player[SJPlayer.P1];
    const hand = player.hand;
    const power = getJinnPower(G);
    const deck = G.secret.jinnDeck;
    const discard = G.jinn.discard;
    const drawCount = power > 9 ? 9 : power;
    if (deck.length + hand.length + discard.length < drawCount) {
        player.hand = hand.concat(deck, discard);
        G.secret.songDeck = [];
        G.song.discard = [];
    } else {
        while (hand.length < drawCount) {
            drawCardForSong(G, ctx);
        }
    }
}

export const drawPhaseForJinn = (G: SongJinnGame, ctx: Ctx) => {
    const player = G.player[SJPlayer.P2];
    const hand = player.hand;
    const power = getJinnPower(G);
    const deck = G.secret.jinnDeck;
    const discard = G.jinn.discard;
    const drawCount = power > 9 ? 9 : power;
    if (deck.length + hand.length + discard.length < drawCount) {
        player.hand = hand.concat(deck, discard);
        G.secret.jinnDeck = [];
        G.jinn.discard = [];
    } else {
        while (hand.length < drawCount) {
            drawCardForJinn(G, ctx);
        }
    }
}

export const drawPhaseForPlayer = (G: SongJinnGame, ctx: Ctx, pid: PlayerID) => {
    switch (pid as SJPlayer) {
        case SJPlayer.P1:
            drawPhaseForSong(G, ctx);
            break;
        case SJPlayer.P2:
            drawPhaseForJinn(G, ctx);
            break;
    }
}

export const addLateTermCard = (G: SongJinnGame, ctx: Ctx) => {
    SongLateCardID.forEach(c=>G.secret.songDeck.push(c))
    JinnLateCardID.forEach(c=>G.secret.jinnDeck.push(c))
    G.secret.songDeck = shuffle(ctx, G.secret.songDeck);
    G.secret.jinnDeck = shuffle(ctx, G.secret.jinnDeck);
}

export const addMidTermCard = (G: SongJinnGame, ctx: Ctx) => {
    SongMidCardID.forEach(c=>G.secret.songDeck.push(c))
    JinnMidCardID.forEach(c=>G.secret.jinnDeck.push(c))
    G.secret.songDeck = shuffle(ctx, G.secret.songDeck);
    G.secret.jinnDeck = shuffle(ctx, G.secret.jinnDeck);
}