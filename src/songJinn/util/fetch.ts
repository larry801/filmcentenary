import {SongJinnGame} from "../constant/setup";
import {
    ActiveEvents,
    CityID,
    Country,
    General,
    GeneralStatus,
    isMountainPassID,
    isNationID,
    isRegionID,
    JinnEarlyCardID,
    JinnLateCardID,
    JinnMidCardID,
    MountainPasses,
    MountainPassID,
    NationID,
    Nations,
    NationState,
    ProvinceID, ProvinceState,
    RegionID,
    SJEventCardID,
    SJPlayer,
    SongEarlyCardID,
    SongLateCardID,
    SongMidCardID,
    Troop,
    TroopPlace,
    UNIT_SHORTHAND
} from "../constant/general";
import {Ctx, LogEntry, PlayerID} from "boardgame.io";
import {getRegionById} from "../constant/regions";
import {Stage} from "boardgame.io/core";
import {activePlayer} from "../../game/util";
import {sjCardById} from "../constant/cards";
import {logger} from "../../game/logger";
import {getProvinceById} from "../constant/province";


export const StrProvince: Map<string, ProvinceID> = new Map(Object.values(ProvinceID).map(
    (memberValue) => [`${memberValue}`, memberValue] as const
));

export const getNationState = (G: SongJinnGame, n: NationID) => {
    if (G.song.nations.includes(n)) {
        return NationState.SONG;
    } else {
        if (G.jinn.nations.includes(n)) {
            return NationState.JINN;
        } else {
            return NationState.NEUTRAL;
        }
    }
}


export const ctr2pub = (G: SongJinnGame, country: Country) => country === Country.SONG ? G.song : G.jinn;
export const ctr2pid = (country: Country) => country === Country.SONG ? SJPlayer.P1 : SJPlayer.P2;
export const pid2ctr = (country: PlayerID) => country === SJPlayer.P1 ? Country.SONG : Country.JINN;


export const currentProvStatus = (G: SongJinnGame, prov: ProvinceID) => {
    const province = getProvinceById(prov);
    const allCities = [...province.capital, ...province.other];
    const songCity = allCities.filter(c => G.song.cities.includes(c)).length;
    const jinnCity = allCities.filter(c => G.jinn.cities.includes(c)).length;
    if (songCity === allCities.length) {
        return ProvinceState.SONG;
    }
    if (jinnCity === allCities.length) {
        return ProvinceState.JINN;
    }
    return ProvinceState.NEUTRAL
}
export const getPresentGeneral = (G: SongJinnGame, pid: PlayerID): General[] => {
    const generals: General[] = [];
    const pub = getStateById(G, pid);
    pub.generals.forEach((p, idx) => {
        if (p === GeneralStatus.TROOP) {
            generals.push(idx as General);
        }
    })
    return generals;
}
export const getSkillGeneral = (G: SongJinnGame, pid: PlayerID): General[] => {
    const generals: General[] = [];
    const pub = getStateById(G, pid);
    pub.generalSkill.forEach((p, idx) => {
        if (p && pub.generals[idx] === GeneralStatus.TROOP) {
            generals.push(idx as General);
        }
    })
    return generals;
}

export const getPlaceGeneral = (G: SongJinnGame, pid: PlayerID, place: TroopPlace): General[] => {
    const generals: General[] = [];
    const pub = getStateById(G, pid);
    pub.generalPlace.forEach((p, idx) => {
        if (p === place) {
            generals.push(idx as General);
        }
    })
    return generals;
}


export const optionToActualDst = (dst: string): TroopPlace => {
    const parsed = parseInt(dst);
    return (parsed === undefined || isNaN(parsed) ? dst : parsed) as TroopPlace;
}

export const getMarchDst = (G: SongJinnGame, dst: TroopPlace): TroopPlace[] => {
    if (isMountainPassID(dst)) {
        return getPassAdj(dst);
    }
    if (isRegionID(dst)) {
        const reg = getRegionById(dst);
        const result: TroopPlace[] = [...reg.land, ...reg.water];
        Nations.forEach(n => {
            if (getNationAdj(n).includes(dst)) {
                result.push(n);
            }
        })
        MountainPasses.forEach(n => {
            if (getPassAdj(n).includes(dst)) {
                result.push(n);
            }
        })
        return result;
    }
    if (isNationID(dst)) {
        return getNationAdj(dst);
    }
    // bei wei kun
    return [];
}



export const getTroopByPlace = (G: SongJinnGame, p: TroopPlace) => {
    const result:Troop[] = []
    G.song.troops.forEach(t => {
        if (t.p === p) {
            result.push(t);
        }
    });
    G.jinn.troops.forEach(t => {
        if (t.p === p) {
            result.push(t);

        }
    });
    return result;
}

function getGeneralTroop(G: SongJinnGame, pid: string, g: General) {
    return getTroopByPlace(G, getStateById(G, pid).generalPlace[g]);
}

export const generalWithOpponentTroop = (G: SongJinnGame, pid: PlayerID,): General[] => {
    const result:General[] = []
    const general = getPresentGeneral(G,pid);
    general.forEach(g=>{
        const generalTroop = getGeneralTroop(G, pid, g);
        generalTroop.forEach(t=>{
            if(t.country !== pid2ctr(pid)){
                result.push(g);
            }
        })
    })
    return result;
}
export const generalInTroop = (G: SongJinnGame, pid: PlayerID, general: General): boolean => {
    const pub = getStateById(G, pid);
    return pub.generals[general] === GeneralStatus.TROOP
}

export const generalRemoved = (G: SongJinnGame, pid: PlayerID, general: General): boolean => {
    const pub = getStateById(G, pid);
    return pub.generals[general] === GeneralStatus.REMOVED
}

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
    if (G.jinn.nations.length + G.removedNation.length === Nations.length) {
        return Country.JINN;
    } else {
        if (G.song.nations.length + G.removedNation.length === Nations.length) {
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

export const getJinnTroopByRegion = (G: SongJinnGame, r: RegionID): Troop | null => {
    G.jinn.troops.forEach(t => {
        if (t.p === r) {
            return t;
        }
    })
    return null;
}

export const getSongTroopByPlace = (G: SongJinnGame, r: TroopPlace): Troop | null => {
    const log = [`getSongTroopByPlace|${r}`];
    let result = null;
    G.song.troops.forEach(t => {
        if (t.p === r) {
            log.push(`|ok${JSON.stringify(t)}`);
            result = t;
        }
    });
    logger.debug(`${G.matchID}|${log.join('')}`);
    return result;
}

export const getTroopByCountryPlace = (G: SongJinnGame, ctr: Country, src: TroopPlace) => {
    return ctr === Country.SONG ? getSongTroopByPlace(G, src) : getJinnTroopByPlace(G, src)
}

export const getJinnTroopByPlace = (G: SongJinnGame, r: TroopPlace): Troop | null => {
    const log = [`getJinnTroopByPlace|${r}`];
    let result = null;
    G.jinn.troops.forEach(t => {
        if (t.p === r) {
            log.push(`|ok${JSON.stringify(t)}`);
            result = t;
        }
    });
    logger.debug(`${G.matchID}|${log.join('')}`);
    return result;
}

export const getTroopByRegion = (G: SongJinnGame, r: RegionID): Troop | null => {
    const st = getSongTroopByPlace(G, r);
    const jt = getJinnTroopByRegion(G, r);
    return st === null ? jt : st;
}

export const getTroopByCity = (G: SongJinnGame, r: CityID): Troop | null => {
    const st = getSongTroopByCity(G, r);
    const jt = getJinnTroopByCity(G, r);
    return st === null ? jt : st;
}


export const getJinnTroopByCity = (G: SongJinnGame, r: CityID): Troop | null => {
    const log = [`getJinnTroopByCity|${r}`];
    let result = null;
    G.jinn.troops.forEach(t => {
        if (t.c === r) {
            log.push(`|ok${JSON.stringify(t)}`);
            result = t;
        }
    });
    logger.debug(`${G.matchID}|${log.join('')}`);
    return result;
}

export const getSongTroopByCity = (G: SongJinnGame, r: CityID): Troop | null => {
    const log = [`getSongTroopByCity|${r}`];
    let result = null;
    G.song.troops.forEach(t => {
        if (t.c === r) {
            log.push(`|ok${JSON.stringify(t)}`);
            result = t;
        }
    });
    logger.debug(`${G.matchID}|${log.join('')}`);
    return result;
}

export const getSongDeployCities = (G: SongJinnGame) => {
    return G.song.cities.filter((cid) => {
        const troop = getJinnTroopByCity(G, cid);
        return troop === null;
    })
}

export const getJinnDeployCities = (G: SongJinnGame) => {
    return G.jinn.cities.filter((cid) => {
        const troop = getSongTroopByCity(G, cid);
        return troop === null;
    })
}

export const getPolicy = (G: SongJinnGame, ctx: Ctx) => {
    if (G.events.includes(ActiveEvents.LiGang)) {
        return G.policy > 1 ? 3 : G.policy + 2;
    } else {
        return G.policy;
    }
}


export function troopPlaceToString(p: TroopPlace) {
    if (p === null) {

    }
}

export function unitsToString(units: number[]) {
    if (units.length === 7) {
        return jinnUnitsStr(units);
    } else {
        return songUnitsStr(units);
    }
}

export function jinnUnitsStr(units: number[]) {
    let result = "";
    units.forEach((item, index) => {
        if (item > 0) {
            result = result.concat(item.toString(), UNIT_SHORTHAND[1][index]);
        }
    })
    return result;
}

export function songUnitsStr(units: number[]) {
    let result = "";
    units.forEach((item, index) => {
        if (item > 0) {
            result = result.concat(item.toString(), UNIT_SHORTHAND[0][index]);
        }
    })
    return result;
}


export const getNationAdj = (pid: NationID): TroopPlace[] => {
    switch (pid) {
        case NationID.XiLiao:
            return [NationID.XiXia];
        case NationID.XiXia:
            return [
                RegionID.R01, RegionID.R02,
                RegionID.R09,
                RegionID.R29, RegionID.R30, RegionID.R31, RegionID.R32
            ];
        case NationID.TuBo:
            return [
                RegionID.R29, RegionID.R33,
                RegionID.R51, RegionID.R53, RegionID.R54,
            ]
        case NationID.DaLi:
            return [RegionID.R53, RegionID.R57, RegionID.R58]
        case NationID.GaoLi:
            return [RegionID.R23, RegionID.R06];
    }

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

export const getOpponentStateById = (G: SongJinnGame, pid: PlayerID) => {
    if (pid as SJPlayer === SJPlayer.P1) {
        return G.jinn;
    } else {
        return G.song;
    }
}

export const getStateById = (G: SongJinnGame, pid: PlayerID) => {
    if (pid as SJPlayer === SJPlayer.P1) {
        return G.song;
    } else {
        return G.jinn;
    }
}

const cardIdSort = (a: SJEventCardID, b: SJEventCardID) => {
    return sjCardById(a).op - sjCardById(b).op;
}

export const cardToSearch = (G: SongJinnGame, ctx: Ctx, pid: PlayerID): SJEventCardID[] => {
    const isSong = pid as SJPlayer === SJPlayer.P1;
    let totalDeck: SJEventCardID[] = isSong ? SongEarlyCardID : JinnEarlyCardID;
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
