import {SongJinnGame} from "../constant/setup";
import {
    CityID,
    Country,
    General,
    GeneralStatus,
    isNationID,
    NationID,
    Nations,
    ProvinceID,
    RegionID,
    SJPlayer,
    Troop,
    TroopPlace
} from "../constant/general";
import {
    getCountryById,
    getJinnTroopByRegion,
    getOpponentStateById,
    getSongTroopByCity,
    getSongTroopByRegion,
    getStateById,
    playerById
} from "./fetch";
import {rm} from "./card";
import {getCityById} from "../constant/city";
import {Ctx, PlayerID} from "boardgame.io";
import {sjCardById} from "../constant/cards";
import {getRegionById} from "../constant/regions";
import {troopEmpty} from "./check";


export const changeCivil = (G: SongJinnGame, pid: PlayerID, a: number) => {
    const pub = getStateById(G, pid);
    if (pub.civil + a < 1) {
        pub.civil = 1;
    } else {
        if (pub.civil + a > 7) {
            pub.civil = 7;
        } else {
            pub.civil += a;
        }
    }
}

export const doControlProvince = (G: SongJinnGame, pid: PlayerID, prov: ProvinceID, opponent: boolean) => {
    const pub = getStateById(G, pid);
    const oppo = getOpponentStateById(G, pid);
    if (oppo.provinces.includes(prov)) {
        rm(prov, oppo.provinces);
    } else {
        pub.provinces.push(prov);
    }
}

export const doControlCity = (G: SongJinnGame, pid: PlayerID, cid: CityID, opponent: boolean) => {
    const pub = getStateById(G, pid);
    const oppo = getOpponentStateById(G, pid);
    if (oppo.cities.includes(cid)) {
        rm(cid, oppo.cities);
    } else {
        pub.cities.push(cid);
    }
}
export const doLoseProvince = (G: SongJinnGame, pid: PlayerID, prov: ProvinceID, opponent: boolean) => {
    const pub = getStateById(G, pid);
    const oppo = getOpponentStateById(G, pid)

    if (pid === SJPlayer.P1) {
        policyDown(G, 1);
    }
    if (pub.corruption > 0) {
        pub.corruption--;
    }
    if (pub.provinces.includes(prov)) {
        rm(prov, pub.provinces);
        if (opponent) {
            oppo.provinces.push(prov);
        }
    }
}


export const changeMilitary = (G: SongJinnGame, pid: PlayerID, a: number) => {
    const pub = getStateById(G, pid);
    if (pub.military + a < 1) {
        pub.military = 1;
    } else {
        if (pub.military + a > 7) {
            pub.military = 7;
        } else {
            pub.military += a;
        }
    }
}

export const removeUnitOnTroop = (G: SongJinnGame, units: number[], pid: PlayerID, idx: number) => {
    const pub = getStateById(G, pid);
    const t = pub.troops[idx];
    if (t === undefined) {
        return null;
    }
    for (let i = 0; i < units.length; i++) {
        if (units[i] > t.u[i]) {
            pub.standby[i] += t.u[i];
            t.u[i] = 0;
        } else {
            pub.standby[i] += units[i]
            t.u[i] -= units[i]
        }
    }
    if (troopEmpty(t)) {
        rm(t, pub.troops);
    }
}

export const doRecruit = (G: SongJinnGame, units: number[], pid: PlayerID) => {
    const actualUnits = [...units];
    const pub = getStateById(G, pid);
    for (let i = 0; i < units.length; i++) {
        if (pub.standby[i] > units[i]) {
            actualUnits[i] = units[i]
            pub.standby[i] -= units[i];
        } else {
            actualUnits[i] = pub.standby[i];
            pub.standby[i] = 0;
        }
        pub.ready[i] += actualUnits[i];
    }
}

export const mergeTroopTo = (G: SongJinnGame, src: number, dst: number, pid: PlayerID) => {
    const pub = getStateById(G, pid);
    let a = pub.troops[src];
    let b = pub.troops[dst];
    if (a === undefined || b === undefined) {
        console.log(`cannot merge${a}|to|${b}`)
    } else {
        for (let i = 0; i < b.u.length; i++) {
            b.u[i] += a.u[i];
        }
        rm(a, pub.troops);
    }

}
export const addTroop = (G: SongJinnGame, dst: RegionID, units: number[], country: Country) => {
    const actualUnits = [...units];
    switch (country) {
        case Country.SONG:
            const st = getSongTroopByRegion(G, dst);
            for (let i = 0; i < units.length; i++) {
                if (G.song.standby[i] > units[i]) {
                    actualUnits[i] = units[i]
                    G.song.standby[i] -= units[i];
                } else {
                    actualUnits[i] = G.song.standby[i];
                    G.song.standby[i] = 0;
                }
            }
            if (st === null) {
                G.song.troops.push({
                    p: dst,
                    c: getRegionById(dst).city,
                    country: Country.SONG,
                    u: actualUnits,
                })
            } else {
                for (let i = 0; i < units.length; i++) {
                    st.u[i] += actualUnits[i];
                }
            }
            break;
        case Country.JINN:
            const jt = getJinnTroopByRegion(G, dst);
            for (let i = 0; i < units.length; i++) {
                if (G.jinn.standby[i] > units[i]) {
                    actualUnits[i] = units[i]
                    G.jinn.standby[i] -= units[i];
                } else {
                    actualUnits[i] = G.jinn.standby[i];
                    G.jinn.standby[i] = 0;
                }
            }
            if (jt === null) {
                G.jinn.troops.push({
                    p: dst,
                    c: getRegionById(dst).city,
                    country: Country.JINN,
                    u: actualUnits,
                })
            } else {
                for (let i = 0; i < units.length; i++) {
                    jt.u[i] += actualUnits[i];
                }
            }
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

export const deployGeneral = (G: SongJinnGame, pid: PlayerID, general: General, dst: TroopPlace) => {
    const ctr = getCountryById(pid);
    const pub = getStateById(G, pid);
    const player = playerById(G, pid);
    const gState = pub.generals[general];

}
export const moveGeneral = (G: SongJinnGame, pid: PlayerID, general: General, dst: TroopPlace) => {
    const ctr = getCountryById(pid);
    const pub = getStateById(G, pid);
    const player = playerById(G, pid);
    const gState = pub.generals[general];

    switch (gState) {
        case GeneralStatus.PRE:
            break;
        case GeneralStatus.TROOP:
            break;
        case GeneralStatus.READY:
            break;
        case GeneralStatus.REMOVED:
            break;
    }
}

//Generals


export const addGeneralTo = (G: SongJinnGame, pid: PlayerID, general: General, dst: TroopPlace) => {
    const pub = getStateById(G, pid);
    pub.generals[general] = GeneralStatus.TROOP;
    pub.generalPlace[general] = dst;
}
export const moveGeneralToReady = (G: SongJinnGame, pid: PlayerID, general: General) => {
    const pub = getStateById(G, pid);
    pub.generals[general] = GeneralStatus.READY;
}
export const moveGeneralTo = (G: SongJinnGame, pid: PlayerID, general: General, dst: TroopPlace) => {
    const pub = getStateById(G, pid);
    pub.generalPlace[general] = dst;
}


export const removeGeneral = (G: SongJinnGame, pid: PlayerID, general: General) => {
    const country = getCountryById(pid);
    switch (country) {
        case Country.SONG:
            G.song.generals[general] = GeneralStatus.REMOVED;
            break;
        case Country.JINN:
            G.jinn.generals[general] = GeneralStatus.REMOVED;
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
        rm(c, G.song.nations);
    } else {
        if (!G.jinn.nations.includes(c)) {
            G.jinn.nations.push(c)
        }
    }
}

export const nationMoveSong = (G: SongJinnGame, c: NationID) => {
    if (G.jinn.nations.includes(c)) {
        rm(c, G.jinn.nations);
    } else {
        if (!G.song.nations.includes(c)) {
            G.song.nations.push(c)
        }
    }
}

export const changeDiplomacyByLOD = (G: SongJinnGame) => {
    const log = [`changeDiplomacyByLOD`]
    const song = playerById(G, SJPlayer.P1);
    const jinn = playerById(G, SJPlayer.P2);
    if (song.lod.length === 0) {
        if (jinn.lod.length === 0) {
            log.push(`|noLOD|`)
        } else {
            log.push('|moveForJinn');
            jinn.lod.forEach(l => nationMoveJinn(G, l.nation))
        }
    } else {
        if (jinn.lod.length === 0) {
            log.push('|moveForSong');

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
    G.song.troops.forEach(t => {
        if (isNationID((t.p))) {
            log.push(`|song|${t.p}|hasTroop`);
            nationMoveJinn(G, t.p);
        }
    });
    G.jinn.troops.forEach(t => {
        if (isNationID((t.p))) {
            log.push(`|jinn|${t.p}|hasTroop`);
            nationMoveSong(G, t.p);
        }
    });
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
    rm(songTroop, G.song.troops);
    const city = getCityById(c);

    policyUp(G, city.colonizeLevel);
    const availableQianJun = G.jinn.standby[5]
    if (availableQianJun === 0) {

    } else {
        rm(c, G.song.cities);
        G.jinn.cities.push(c);
        if (availableQianJun === 1) {
            G.jinn.troops.push({
                p: city.region,
                c: c,
                u: [0, 0, 0, 0, 0, 1, 0],
                
                country: Country.JINN
            });
        } else {
            G.jinn.troops.push({
                p: city.region,
                c: c,
                u: [0, 0, 0, 0, 0, 2, 0],
                
                country: Country.JINN
            });
        }
    }

}
export const rollDiceByPid = (G: SongJinnGame, ctx: Ctx, pid: PlayerID, count: number) => {
    const country = getCountryById(pid);
    const dices = ctx.random?.D6(count);
    if (dices === undefined) {
        return;
    }
    if (country === Country.SONG) {
        G.song.dices = dices;
    } else {
        G.jinn.dices = dices;
    }
}