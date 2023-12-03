import {Country} from "./general";
import {Cards} from "./cards";

export enum CombatType {
    SIEGE,
    RESCUE,
    FIELD,
    BREAKOUT
}

export interface Troop{
    country:Country,
    units:number[],
    region:number,
}

export interface CountryCombatInfo {
    troop:Troop,
    combatCard:Cards[],

}

export interface CombatInfo {
    attacker:Country,
    type:CombatType,
}