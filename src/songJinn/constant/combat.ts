import {CardID, CityID, Country, RegionID, Troop} from "./general";

export const enum CombatType {
    SIEGE,
    RESCUE,
    FIELD,
    BREAKOUT
}


export interface CountryCombatInfo {
    troop: Troop,
    combatCard: CardID[],

}

export const enum BeatGongChoice {
    CONTINUE,
    STALEMATE,
    RETREAT
}

export interface CombatInfo {
    attacker: Country,
    type: CombatType,
    region: RegionID | null,
    city: CityID | null,
    song: CountryCombatInfo,
    jinn: CountryCombatInfo,
    roundTwo: boolean,

}