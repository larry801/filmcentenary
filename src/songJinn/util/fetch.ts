import {SongJinnGame} from "../constant/setup";
import {CardID, Country, SJPlayer} from "../constant/general";
import {Ctx, PlayerID} from "boardgame.io";
import {shuffle} from "../../game/util";

export const jinnPrivate = (G: SongJinnGame) => {
    return G.player[SJPlayer.P2];
}

export const songPrivate = (G: SongJinnGame) => {
    return G.player[SJPlayer.P2];
}

export const playerById = (G: SongJinnGame, pid: PlayerID) => {
    return G.player[pid as SJPlayer];
}

export const getStateById = (G: SongJinnGame, pid: PlayerID) => {
    switch (pid as SJPlayer) {
        case SJPlayer.P1:
            return G.song;
        case SJPlayer.P2:
            return G.jinn;
    }
}

const cardIdSort = (a: CardID, b: CardID) => {
    return a - b;
}

export const cardToSearch = (G: SongJinnGame, ctx: Ctx, pid: PlayerID): CardID[] => {
    switch (pid as SJPlayer) {
        case SJPlayer.P1:
            return G.secret.songDeck.sort(cardIdSort);
        case SJPlayer.P2:
            return G.secret.jinnDeck.sort(cardIdSort);
    }
}

export const getCountryById = (pid: PlayerID) => {
    switch (pid as SJPlayer) {
        case SJPlayer.P1:
            return Country.SONG;
        case SJPlayer.P2:
            return Country.JINN;
    }
}
