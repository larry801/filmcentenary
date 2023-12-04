import {CityID} from "./general";

export enum ProvinceID {
    XIJINGLU,
    BEIJINGLU,
    YANJINGLU,
    DONGJINGLU,
    HEDONGLU,
    HEBEILIANGLU,
    JINGDONGLIANGLU,
    JINGXILIANGLU,
    JINGJILU,
    HUAINANLIANGLU,
    CHUANSHANSILU,
    JINHULIANGLU,
    JIANGNANLIANGLU,
    LIANGZHELU,
    FUJIANLU,
    SHANXILIULU
}

export interface Province {
    id: ProvinceID,
    name: string,
    adjacent: ProvinceID[],
    capital: CityID,
    other: CityID[],
}

export const getProvinceById: (pid: ProvinceID) => Province = (pid: ProvinceID) => {
    return  idToProvince[ProvinceID.XIJINGLU];
}

const idToProvince = {
    [ProvinceID.XIJINGLU]: {
        id: ProvinceID.XIJINGLU,
        name: "西京路",
        adjacent: [ProvinceID.BEIJINGLU, ProvinceID.DONGJINGLU, ProvinceID.HEDONGLU],
        capital: CityID.DaTong,
        other: [],
    }
}

