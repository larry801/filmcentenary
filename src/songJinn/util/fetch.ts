import {SongJinnGame} from "../constant/setup";
import {
    ActiveEvents,
    CardID,
    CityID,
    Country,
    isMountainPassID,
    isOtherCountryID,
    MountainPassID,
    OtherCountries,
    RegionID,
    SJPlayer,
    Troop, UNIT_SHORTHAND
} from "../constant/general";
import {Ctx, LogEntry, PlayerID} from "boardgame.io";
import {getRegionById} from "../constant/regions";
import {Stage} from "boardgame.io/core";
import {activePlayer} from "../../game/util";

export const diplomaticVictory = (G: SongJinnGame) => {
    if (G.jinn.countries.length + G.removedCountries.length === OtherCountries.length) {
        return Country.JINN;
    } else {
        if (G.song.countries.length + G.removedCountries.length === OtherCountries.length) {
            return Country.SONG;
        } else {
            return null;
        }
    }
}

export const getStage = (ctx: Ctx) => {
    if (ctx.activePlayers === null) {
        return Stage.NULL;
    } else {
        return ctx.activePlayers[activePlayer(ctx)]
    }
}


export const getJinnTroopByRegion = (G: SongJinnGame, r: RegionID) => {
    G.jinn.troops.forEach(t => {
        if (t.p === r) {
            return t;
        }
    })
    return null;
}

export const getSongTroopByRegion = (G: SongJinnGame, r: RegionID) => {
    G.song.troops.forEach(t => {
        if (t.p === r) {
            return t;
        }
    })
    return null;
}

export const getJinnTroopByCity = (G: SongJinnGame, r: CityID) => {
    G.jinn.troops.forEach(t => {
        if (t.c === r) {
            return t;
        }
    })
    return null;
}

export const getSongTroopByCity = (G: SongJinnGame, r: CityID) => {
    G.song.troops.forEach(t => {
        if (t.c === r) {
            return t;
        }
    })
    return null;
}


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

export const getPolicy = (G: SongJinnGame, ctx: Ctx) => {
    if (G.events.includes(ActiveEvents.LiGang)) {
        return G.policy > 1 ? 3 : G.policy + 2;
    } else {
        return G.policy;
    }
}

export function unitsToString (units: number[]) {
    if (units.length === 7) {
        return jinnTroopStr(units);
    } else {
        return songTroopStr(units);
    }
}

export function jinnTroopStr(units: number[]) {
    let result = "";
    units.forEach((item, index) => {
        if (item > 0) {
            result = result.concat(item.toString(), UNIT_SHORTHAND[1][index]);
        }
    })
    return result;
}

export function songTroopStr(units: number[]) {
    let result = "";
    units.forEach((item, index) => {
        if (item > 0) {
            result = result.concat(item.toString(), UNIT_SHORTHAND[0][index]);
        }
    })
    return result;
}

export const getPassAdj = (pid: MountainPassID) => {
    switch (pid) {
        case MountainPassID.WuGuan:
            return [RegionID.R36, RegionID.R40];
        case MountainPassID.DaSanGuan:
            return [RegionID.R33, RegionID.R52];
        case MountainPassID.TongGuan:
            return [RegionID.R36, RegionID.R37];
        case MountainPassID.JuYongGuan:
            return [RegionID.R02, RegionID.R07];
        case MountainPassID.JianMenGuan:
            return [RegionID.R51, RegionID.R54, RegionID.R55];

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

export const getLogText = (l: LogEntry) => {

}