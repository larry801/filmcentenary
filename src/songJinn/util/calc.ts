import {SongJinnGame} from "../constant/setup";
import {ActiveEvents, SJPlayer} from "../constant/general";

export const getLeadingPlayer = (G: SongJinnGame): SJPlayer => {
    return G.jinn.civil > G.song.civil ? SJPlayer.P2 : SJPlayer.P1;
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