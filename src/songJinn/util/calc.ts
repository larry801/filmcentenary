import {SongJinnGame} from "../constant/setup";
import {ActiveEvents, Country, isMountainPassID, isRegionID, SJPlayer, TerrainType, Troop} from "../constant/general";
import {Ctx} from "boardgame.io";
import {getRegionById} from "../constant/regions";
import {getCityById} from "../constant/city";
import {Terrain} from "@material-ui/icons";

export const getLeadingPlayer = (G: SongJinnGame): SJPlayer => {
    return G.jinn.civil > G.song.civil ? SJPlayer.P2 : SJPlayer.P1;
}

export function troopIsArmy(G: SongJinnGame, ctx: Ctx, troop: Troop) {
    return troopEndurance(G, ctx, troop) !== 0;
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