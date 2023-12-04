import {CityID, TerrainType} from "./general";

export enum RegionID {
    R001,
    R002,
    R003,
    R004,
}

export interface Region {
    city: CityID | null;
    id: RegionID;
    name: string;
    land: RegionID[],
    water: RegionID[],
    terrain: TerrainType,
}
