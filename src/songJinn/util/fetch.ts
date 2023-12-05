import {SongJinnGame} from "../constant/setup";
import {
    CardID,
    Country, isMountainPassID, isOtherCountryID,
    MountainPasses,
    MountainPassID,
    OtherCountries,
    RegionID,
    SJPlayer,
    Troop
} from "../constant/general";
import {Ctx, PlayerID} from "boardgame.io";
import {getRegionById} from "../constant/regions";

export const getArmyDst = (G: SongJinnGame, t: Troop) => {
    const place = t.p;
    if (place === null) {
        // 被围困
        return [];
    }
    if (isOtherCountryID(place)) {
        return [];
    } else {
        if (isMountainPassID(place)) {
            return getPassAdj(place);
        } else {
            const region = getRegionById(place);
            return [...region.land, ...region.water]
        }
    }
}

export const getPassAdj = (pid: MountainPassID) => {
    switch (pid) {
        case MountainPassID.WuGuan:
            return [RegionID.R02, RegionID.R07];
        case MountainPassID.DaSanGuan:
            return [RegionID.R02, RegionID.R07];
        case MountainPassID.TongGuan:
            return [RegionID.R40, RegionID.R07];
        case MountainPassID.JuYongGuan:
            return [RegionID.R40, RegionID.R07];
        case MountainPassID.JianMenGuan:
            return [RegionID.R40, RegionID.R07];

    }
}

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
