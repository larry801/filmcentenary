import {SongJinnGame} from "../constant/setup";
import {
    ActiveEvents,
    Country,
    isMountainPassID,
    isRegionID,
    SJPlayer,
    TerrainType,
    Troop,
    accumulator
} from "../constant/general";
import {Ctx, PlayerID} from "boardgame.io";
import {getRegionById} from "../constant/regions";
import {getCityById} from "../constant/city";
import {Terrain} from "@material-ui/icons";
import {getStateById} from "./fetch";
import {eventCardById} from "../constant/cards";
import {getPlanById} from "../constant/plan";

export const getLeadingPlayer = (G: SongJinnGame): SJPlayer => {
    return G.jinn.civil > G.song.civil ? SJPlayer.P2 : SJPlayer.P1;
}

export const totalDevelop = (G: SongJinnGame, ctx: Ctx, playerId: PlayerID) => {
    const d = getStateById(G, playerId).develop.map(c => eventCardById(c).op);
    if (d.length > 0) {
        return d.reduce(accumulator);
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
    return score
}

export const getSongPower = (G: SongJinnGame): number => {
    let power = G.song.provinces.length;
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
    let power = G.jinn.provinces.length;
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