import {CityID} from "./city";
import {TerrainType} from "./general";

export enum RegionID {

}

export interface Region {
    city: CityID | null;
    id: RegionID;
    name: string;
    land: RegionID[],
    water: RegionID[],
    terrain: TerrainType,

}
