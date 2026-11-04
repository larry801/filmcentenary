import {Power, VQGame} from "./constant/general";
import {MINOR_DIPLOMACY} from "./data/minorDiplomacy";
import {ownerOf} from "./ownership";
import {powerVp} from "./util";

export type HolyLeagueTrack = "papacy" | "venice" | "hre";

/**
 * #24: the Papacy and Venice tracks are always available; the HRE track only
 * exists while the HRE is a non-player major power.
 */
export const holyLeagueTracks = (G: VQGame): HolyLeagueTrack[] => [
    "papacy",
    "venice",
    ...(G.majorInfluence?.hre !== undefined && (G.playerPowers ? !Object.values(G.playerPowers).some((powers) => powers.includes("hre")) : ownerOf(G, "hre") === undefined) ? ["hre" as HolyLeagueTrack] : []),
];

/**
 * #24 Holy League is playable by "any power eligible to have diplomatic
 * influence with the Papacy, Venice or Holy Roman Empire (if not a player
 * power)", and not at all while the Ottoman has fewer than 13 VP.  A track
 * offers potential influence only while it has not been resolved this turn,
 * so an already-resolved Papacy/Venice (and, when available, HRE) cannot
 * satisfy the condition.
 */
export const canPlayHolyLeague = (G: VQGame, p: Power): boolean => {
    if (powerVp(G, "ottoman") < 13) return false;
    return holyLeagueTracks(G).some((track) => {
        if (track === "hre") {
            return G.majorInfluence?.hre?.[p] !== undefined && !G.majorDiplomacyResolved?.includes("hre");
        }
        const eligible = MINOR_DIPLOMACY[track].eligible.includes(p) ||
            (G.scenario === "tutorial" && p === "ottoman" && track === "papacy");
        return eligible && !G.minorDiplomacyResolved.includes(track);
    });
};
