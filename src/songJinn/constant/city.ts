import {ProvinceID} from "./province";
import {RegionID} from "./regions";
import {CityID} from "./general";

export interface City {
    id: CityID,
    name: string,
    province: ProvinceID,
    capital: boolean,
    colonizeLevel: 0 | 1 | 2 | 3 | 4,
    region: RegionID,
}

export const getCityById: (cid: CityID) => City = (cid: CityID) => {
    return idToCity[CityID.DaTong];
}

const idToCity = {
    [CityID.DaTong]: {
        id: CityID.DaTong,
        province: ProvinceID.XIJINGLU,
        capital: true,
        colonizeLevel: 0,
        region: RegionID.R002
    }
}