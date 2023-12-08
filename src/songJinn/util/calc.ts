import {SongJinnGame} from "../constant/setup";
import {
    accumulator,
    ActiveEvents,
    Country,
    isMountainPassID,
    isRegionID,
    JinnBaseCardID,
    ProvinceID,
    SJPlayer,
    SongBaseCardID,
    TerrainType,
    Troop
} from "../constant/general";
import {Ctx, PlayerID} from "boardgame.io";
import {getRegionById} from "../constant/regions";
import {getCityById} from "../constant/city";
import {getStateById} from "./fetch";
import {sjCardById} from "../constant/cards";
import {getPlanById} from "../constant/plan";
import {rm} from "./card";

export const getLeadingPlayer = (G: SongJinnGame): SJPlayer => {
    return G.jinn.civil > G.song.civil ? SJPlayer.P2 : SJPlayer.P1;
}

export const totalDevelop = (G: SongJinnGame, ctx: Ctx, playerId: PlayerID) => {
    const pub = getStateById(G, playerId);
    const d = pub.develop.map(c => sjCardById(c).op);
    if (d.length > 0) {
        let sum = d.reduce(accumulator);
        if (pub.develop.includes(JinnBaseCardID.J40)) {
            sum += G.colony * 2 - 2;
        }
        if (pub.develop.includes(SongBaseCardID.S45)){
            sum += G.jinn.cities.filter(c=>getCityById(c).colonizeLevel > G.colony).length - 3;
        }
        return sum;
    } else {
        return 0;
    }
}

export const remainDevelop = (G: SongJinnGame, ctx: Ctx, playerId: PlayerID) => {
    return totalDevelop(G, ctx, playerId) - getStateById(G, playerId).usedDevelop;
}

export function troopIsArmy(G: SongJinnGame, ctx: Ctx, troop: Troop) {
    return troopEndurance(G, ctx, troop) !== 0;
}

export const rangeDamage = (G: SongJinnGame, troop: Troop) => {

}

export function troopEndurance(G: SongJinnGame, ctx: Ctx, troop: Troop): number {
    let endurance = 0;
    let terrainType;
    if (troop.p === null) {
        if (troop.c === null) {
            return -1;
        }
        terrainType = getRegionById(getCityById(troop.c).region).terrain;
    } else {
        if (isRegionID(troop.p)) {
            terrainType = getRegionById(troop.p).terrain;
        } else {
            if (isMountainPassID(troop.p)) {
                terrainType = TerrainType.RAMPART;
            } else {
                // TODO other country endurance
                terrainType = TerrainType.FLATLAND;
            }
        }
    }
    let unitEndurance: number[] = [];
    switch (troop.country) {
        case Country.SONG:
            unitEndurance = [2, 1, 1, 0, 0, 2];
            if (G.events.includes(ActiveEvents.ZhongBuBing)) {
                unitEndurance[0] = 3;
            }
            break;
        case Country.JINN:
            unitEndurance = [2, 1, 2, 0, 0, 1, 1];
            if (G.events.includes(ActiveEvents.ZhongBuBing)) {
                unitEndurance[0] = 3;
            }
            break;
    }
    if (terrainType === TerrainType.SWAMP) {
        unitEndurance[3] = 2;
    }
    troop.u.forEach((i, idx) => {
        endurance += i * unitEndurance[idx]
    })
    return endurance;
}

export const getSongScore = (G: SongJinnGame): number => {
    let score = getSongPower(G);
    G.song.completedPlan.forEach((pid) => {
        score += getPlanById(pid).vp;
    })
    score += G.song.military;
    score += G.song.civil;
    if(G.events.includes(ActiveEvents.YanJingYiNan)){
        score ++;
    }
    return score
}

export const getSongPower = (G: SongJinnGame): number => {
    const countedProvince = [...G.song.provinces];
    rm(ProvinceID.JINGJILU, countedProvince);
    if (!G.events.includes(ActiveEvents.XiangHaiShangFaZhan)) {
        rm(ProvinceID.FUJIANLU, countedProvince);

    }
    let power = countedProvince.length;

    if (G.song.emperor !== null) {
        power++;
    }
    if (G.events.includes(ActiveEvents.JianYanNanDu)) {
        power++;
    }
    if (G.song.civil >= 6) {
        power++;
    }
    return power;
}

export const getJinnScore = (G: SongJinnGame): number => {
    let score = getJinnPower(G);
    G.jinn.completedPlan.forEach((pid) => {
        score += getPlanById(pid).vp;
    })
    score += G.jinn.military;
    score += G.jinn.civil;
    return score;
}

export const getJinnPower = (G: SongJinnGame): number => {
    const countedProvince = [...G.jinn.provinces];
    rm(ProvinceID.JINGJILU, countedProvince);
    if (!G.events.includes(ActiveEvents.XiangHaiShangFaZhan)) {
        rm(ProvinceID.FUJIANLU, countedProvince);

    }
    let power = countedProvince.length;
    if (G.jinn.emperor !== null) {
        power++;
    }
    if (G.events.includes(ActiveEvents.JingKangZhiBian)) {
        power++;
    }
    if (G.song.civil >= 6) {
        power++;
    }
    return power;
}