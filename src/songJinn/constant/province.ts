import {CityID} from "./city";

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
    id:ProvinceID,
    name:string,
    adjacent:ProvinceID[],
    capital: CityID,
    otherCities: CityID[],
}

