import type {Controller, Power} from "./constant/general";

export interface EspionageState {
    jesuits: string[];
    jesuitsOnCard: number;
    douai: boolean;
    mary: "scotland" | "captured" | "exiled" | "dead";
    maryBonusTurn?: number;
    walsingham?: "offensive" | "defensive";
    cipherKeys: Partial<Record<Power, Power>>;
    nextDraw: Partial<Record<Power, number>>;
    /** Snapshots, filtered by playerView. Never copy these into the public log. */
    inspections: {viewer: Power; target: Power; cards: string[]}[];
    catholicRebellionVictory?: boolean;
}

export interface PendingEspionage {
    kind: "intelligence" | "assassination" | "rebellion" | "jesuitEvent" | "walsingham";
    power: Power;
    targetPower: Power;
    responding: Power;
    step: "responses" | "offense" | "neutralize" | "extraNeutralize" | "defense" | "mary" |
        "conversions" | "unrest" | "rebelTarget" | "rebelLosses" | "rebelSpaces" |
        "jesuitPlace" | "jesuitMove" | "jesuitDestination" | "priestHoles" | "displace";
    target?: string;
    cp: number;
    remaining: number;
    used: string[];
    responseQueue?: Power[];
    attackBonus?: number;
    attack?: number[];
    defense?: number[];
    conversionDice?: number[];
    converted?: string[];
    conversionBase?: string[];
    conversionSide?: "catholic" | "protestant";
    unrest?: boolean;
    rebellionAfterConversions?: boolean;
    event?: string;
    movingJesuit?: string;
    neutralizeReturn?: "offense" | "walsingham" | "extraNeutralize" | "topcliffe";
    neutralizedOperatives?: string[];
    protectedJesuit?: string;
    priestQueue?: Power[];
    displacements?: {owner: Power; controller: Controller; from: string; kind: "land" | "naval"}[];
    rebellionRegularsPending?: string;
}
