import {SongJinnGame} from "../constant/setup";
import {
    CityID,
    Country,
    General,
    GeneralStatus,
    NationID,
    Nations,
    RegionID,
    SJPlayer,
    Troop
} from "../constant/general";
import {getCountryById, getSongTroopByCity, getSongTroopByRegion, playerById} from "./fetch";
import {remove} from "./card";
import {getCityById} from "../constant/city";
import {PlayerID} from "boardgame.io";
import {sjCardById} from "../constant/cards";
import {getRegionById} from "../constant/regions";

export const addTroop = (G: SongJinnGame, dst: RegionID, units: number[], country: Country) => {

    switch (country) {
        case Country.SONG:
            const st = getSongTroopByRegion(G,dst);
            for (let i = 0; i < units.length; i++) {

                if(G.song.standby[i] > units[i]) {
                    G.song.standby[i] -= units[i];
                }else{
                    G.song.standby[i] = 0;
                }
            }
            G.song.troops.push({
                p: dst,
                c: getRegionById(dst).city,
                country: Country.SONG,
                u: units,
                j: []
            })
            break;
        case Country.JINN:
            for (let i = 0; i < units.length; i++) {
                G.jinn.standby[i] -= units[i];
            }
            G.jinn.troops.push({
                p: dst,
                c: getRegionById(dst).city,
                country: Country.JINN,
                u: units,
                j: []
            });
            break;
        default:
            return null;
    }
}

export const colonyUp = (G: SongJinnGame, a: number) => {
    if (G.colony + a > 4) {
        G.colony = 4;
    } else {
        G.colony += a;
    }
}
export const policyUp = (G: SongJinnGame, a: number) => {
    if (G.policy + a > 3) {
        G.policy = 3;
    } else {
        G.policy += a;
    }
}
export const colonyDown = (G: SongJinnGame, a: number) => {
    if (G.colony - a < 0) {
        G.colony = 0;
    } else {
        G.colony -= a;
    }
}
export const policyDown = (G: SongJinnGame, a: number) => {
    if (G.policy - a < -3) {
        G.policy = -3;
    } else {
        G.policy -= a;
    }
}

export const removeGeneral = (G: SongJinnGame, pid: PlayerID, general: General) => {
    const country = getCountryById(pid);
    switch (country) {
        case Country.SONG:
            G.song.generals[general] = GeneralStatus.REMOVED;
            G.song.troops.forEach(t => remove(general, t.j));
            break;
        case Country.JINN:
            G.jinn.generals[general] = GeneralStatus.REMOVED;
            G.jinn.troops.forEach(t => remove(general, t.j));
            break;
    }
}

export const loseCity = (G: SongJinnGame, pid: PlayerID, c: CityID) => {
    const city = getCityById(c);
    if (city.capital) {

    } else {

    }
}

export const nationMoveJinn = (G: SongJinnGame, c: NationID) => {
    if (G.song.nations.includes(c)) {
        remove(c, G.song.nations);
    } else {
        if (!G.jinn.nations.includes(c)) {
            G.jinn.nations.push(c)
        }
    }
}

export const nationMoveSong = (G: SongJinnGame, c: NationID) => {
    if (G.jinn.nations.includes(c)) {
        remove(c, G.jinn.nations);
    } else {
        if (!G.song.nations.includes(c)) {
            G.song.nations.push(c)
        }
    }
}

export const changeDiplomacyByLOD = (G: SongJinnGame) => {
    const song = playerById(G, SJPlayer.P1);
    const jinn = playerById(G, SJPlayer.P2);
    if (song.lod.length === 0) {
        if (jinn.lod.length === 0) {
            return;
        } else {
            jinn.lod.forEach(l => nationMoveJinn(G, l.nation))
        }
    } else {
        if (jinn.lod.length === 0) {
            song.lod.forEach(l => nationMoveJinn(G, l.nation))
        } else {
            Nations.forEach(n => {
                let songPoint = 0;
                let jinnPoint = 0;
                song.lod.forEach(l => {
                    if (l.nation === n) {
                        songPoint += sjCardById(l.card).op;
                    }
                })
                jinn.lod.forEach(l => {
                    if (l.nation === n) {
                        jinnPoint += sjCardById(l.card).op;
                    }
                })
                if (songPoint > jinnPoint) {
                    nationMoveSong(G, n);

                } else {
                    if (jinnPoint > songPoint) {
                        nationMoveJinn(G, n);
                    }
                }
            })
        }
    }
    jinn.lod.forEach(l => G.jinn.discard.push(l.card));
    song.lod.forEach(l => G.song.discard.push(l.card));
    jinn.lod = [];
    song.lod = [];
}

export const heYiChange = (G: SongJinnGame, c: CityID) => {
    const songTroop: Troop | null = getSongTroopByCity(G, c);
    if (songTroop !== null) {
        // @ts-ignore
        for (let i = 0; i < songTroop.u.length; i++) {
            // @ts-ignore
            G.song.ready[i] += songTroop.u[i];
        }
    }
    remove(songTroop, G.song.troops);
    const city = getCityById(c);

    policyUp(G, city.colonizeLevel);
    const availableQianJun = G.jinn.standby[5]
    if (availableQianJun === 0) {

    } else {
        remove(c, G.song.cities);
        G.jinn.cities.push(c);
        if (availableQianJun === 1) {
            G.jinn.troops.push({
                p: city.region,
                c: c,
                u: [0, 0, 0, 0, 0, 1, 0],
                j: [],
                country: Country.JINN
            });
        } else {
            G.jinn.troops.push({
                p: city.region,
                c: c,
                u: [0, 0, 0, 0, 0, 2, 0],
                j: [],
                country: Country.JINN
            });
        }
    }

}