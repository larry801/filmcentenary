

export const UNIT_FULL_NAME=[
    ['步军','步射','马军','水军','霹雳炮','背嵬军'],
    ['步军','拐子马','铁浮屠','水军','鹅车','签军','齐军']
];
export const UNIT_SHORTHAND=[
    ['步','弓','骑','船','炮','背'],
    ['步','拐','铁','船','鹅','伪','齐']
];
export const MID_TERM_DECK = [17,18,19,20];
export const LATE_TERM_DECK = [];
export const INITIAL_RECRUIT_PERMISSION=[
    [true,true,false,true,false,false],
    [true,true,true,false,false,true,false]
];

export const INITIAL_RECRUIT_COST=[
    [1,1,0,2,0,0],
    [1,2,2,0,0,1,1]
];

export enum Country {
    SONG = "SONG",
    JINN = "JINN"
}

export enum IEra {
    E = "E",
    M = "M",
    L = "L"
}

export enum TerrainType {
    FLATLAND,
    HILLS,
    MOUNTAINS,
    SWAMP,
    RAMPART,
}