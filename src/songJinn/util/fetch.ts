import {SongJinnGame} from "../constant/setup";
import {
    ActiveEvents,
    CardID,
    CityID,
    Country,
    GeneralStatus,
    isMountainPassID,
    isOtherCountryID,
    JinnEarlyCardID,
    JinnLateCardID,
    JinnMidCardID,
    MountainPassID,
    Nations, ProvinceID,
    RegionID,
    SJPlayer,
    SongEarlyCardID,
    SongLateCardID,
    SongMidCardID,
    Troop,
    UNIT_SHORTHAND
} from "../constant/general";
import {Ctx, LogEntry, PlayerID} from "boardgame.io";
import {getRegionById} from "../constant/regions";
import {Stage} from "boardgame.io/core";
import {activePlayer} from "../../game/util";
import {sjCardById} from "../constant/cards";
import {getProvinceById} from "../constant/province";


export const StrProvince: Map<string, ProvinceID> = new Map(Object.values(ProvinceID).map(
    (memberValue) => [`${memberValue}`, memberValue] as const
))

export const getReadyGenerals = (G: SongJinnGame, pid: PlayerID) => {
    const readyGenerals = [];
    switch (pid as SJPlayer) {
        case SJPlayer.P1:
            for (let i = 0; i < 6; i++) {
                if (G.song.generals[i] === GeneralStatus.READY) {
                    readyGenerals.push(i);
                }
            }
            break;
        case SJPlayer.P2:
            for (let i = 0; i < 6; i++) {
                if (G.jinn.generals[i] === GeneralStatus.READY) {
                    readyGenerals.push(i);
                }
            }
            break;
    }
    return readyGenerals;
}

export const getMovePlan = (G: SongJinnGame) => {
    const plans = [...G.song.plan, ...G.jinn.plan];
    if (G.song.completedPlan.length > 0 && !G.events.includes(ActiveEvents.YanJingYiNan)) {
        const songTop = G.song.completedPlan[G.song.completedPlan.length - 1];
        plans.push(songTop);
    }
    if (G.jinn.completedPlan.length > 0) {
        plans.push(G.jinn.completedPlan[G.jinn.completedPlan.length - 1])
    }
    return plans;
}

export const diplomaticVictory = (G: SongJinnGame) => {
    if (G.jinn.nations.length + G.removedCountries.length === Nations.length) {
        return Country.JINN;
    } else {
        if (G.song.nations.length + G.removedCountries.length === Nations.length) {
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

export const getJinnTroopByRegion = (G: SongJinnGame, r: RegionID):Troop|null => {
    G.jinn.troops.forEach(t => {
        if (t.p === r) {
            return t;
        }
    })
    return null;
}

export const getSongTroopByRegion = (G: SongJinnGame, r: RegionID):Troop|null => {
    G.song.troops.forEach(t => {
        if (t.p === r) {
            return t;
        }
    })
    return null;
}

export const getJinnTroopByCity = (G: SongJinnGame, r: CityID):Troop|null => {
    G.jinn.troops.forEach(t => {
        if (t.c === r) {
            return t;
        }
    })
    return null;
}

export const getSongTroopByCity = (G: SongJinnGame, r: CityID):Troop|null => {
    G.song.troops.forEach(t => {
        if (t.c === r) {
            return t;
        }
    })
    return null;
}

export const getSongDeployCities = (G: SongJinnGame, r: CityID) => {
    G.song.cities.filter((cid) => {
        const troop = getJinnTroopByCity(G, cid);
        return troop === null;
    })
}

export const getJinnDeployCities = (G: SongJinnGame, r: CityID) => {
    G.jinn.cities.filter((cid) => {
        const troop = getSongTroopByCity(G, cid);
        return troop === null;
    })
}

export const getTroopDst = (G: SongJinnGame, t: Troop) => {
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

export function unitsToString(units: number[]) {
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
    return sjCardById(a).op - sjCardById(b).op;
}

export const cardToSearch = (G: SongJinnGame, ctx: Ctx, pid: PlayerID): CardID[] => {
    const isSong = pid as SJPlayer === SJPlayer.P1;
    let totalDeck: CardID[] = isSong ? SongEarlyCardID : JinnEarlyCardID;
    if (G.turn > 3) {
        const mid = isSong ? [...SongMidCardID] : [...JinnMidCardID];
        totalDeck = [...totalDeck, ...mid];
    }
    if (G.turn > 6) {
        const late = isSong ? [...SongLateCardID] : [...JinnLateCardID];
        totalDeck = [...totalDeck, ...late];
    }
    const discard = isSong ? G.song.discard : G.jinn.discard;
    const remove = isSong ? G.song.remove : G.jinn.remove;
    const hand = isSong ? G.player[SJPlayer.P1].hand : G.player[SJPlayer.P2].hand;
    return totalDeck.filter(c => !(hand.includes(c) || discard.includes(c) || remove.includes(c)))
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