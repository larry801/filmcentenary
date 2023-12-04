import {ProvinceID} from "./province";
import {RegionID} from "./regions";

export enum CityID {
    DaTong = 0,

    DaDing = 1,
    LiaoYang = 2,

    XiJin = 3,

    YangQu = 4,
    LinFen = 5,

    ShangDang = 6,
    ZhenDing = 7,
    AnXi = 8,
    HeJian = 9,
    YuanCheng = 10,
    LiCheng = 11,
    XuCheng = 12,
    SongCheng = 13,

    Fushi = 14,
    TianXing = 15,
    ChangAn = 16,

    LuoYang = 17,
    WanQiu = 18,
    XiangYang = 19,

    KaiFeng = 20,

    JiangDu = 21,
    XiaCai = 22,

    NanZhen = 23,
    ChengDu = 24,

    ZhenXian = 25,
    JiangLing = 26,
    AnLu = 27,
    ChangSha = 28,

    JiangNing = 29,
    NanChang = 30,

    DanTu = 31,
    WuXian = 32,
    QianTang = 33,

    MinXian = 34
}

export interface City {
    id: CityID,
    name: string,
    province: ProvinceID,
    capital: boolean,
    colonizeLevel: 0 | 1 | 2 | 3 | 4,
    region: RegionID,
}