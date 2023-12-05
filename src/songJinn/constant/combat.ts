import {CardID, CityID, Country, RegionID} from "./general";

export enum CombatType {
    SIEGE,
    RESCUE,
    FIELD,
    BREAKOUT
}

export interface Troop {
    country: Country,
    units: number[],
    region: RegionID,
}

export interface CountryCombatInfo {
    troop: Troop,
    combatCard: CardID[],

}

export enum BeatGongChoice {
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