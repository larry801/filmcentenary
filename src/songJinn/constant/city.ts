import {CityID, ProvinceID, RegionID} from "./general";

export interface City {
    id: CityID,
    name: string,
    province: ProvinceID,
    capital: boolean,
    colonizeLevel: 0 | 1 | 2 | 3 | 4 | 5,
    region: RegionID,
}

export const getCityById: (cid: CityID) => City = (cid: CityID) => {
    return idToCity[cid];
}

const idToCity = {
    [CityID.DaTong]:{id:CityID.DaTong,name:"大同",capital:true,province:ProvinceID.XIJINGLU,colonizeLevel:0,region:RegionID.R02},
    [CityID.DaDing]:{id:CityID.DaDing,name:"大定",capital:true,province:ProvinceID.BEIJINGLU,colonizeLevel:0,region:RegionID.R05},
    [CityID.LiaoYang]:{id:CityID.LiaoYang,name:"辽阳",capital:true,province:ProvinceID.YANJINGLU,colonizeLevel:0,region:RegionID.R06},
    [CityID.XiJin]:{id:CityID.XiJin,name:"析津",capital:false,province:ProvinceID.DONGJINGLU,colonizeLevel:0,region:RegionID.R07},
    [CityID.YangQu]:{id:CityID.YangQu,name:"阳曲",capital:true,province:ProvinceID.HEDONGLU,colonizeLevel:1,region:RegionID.R10},
    [CityID.LinFen]:{id:CityID.LinFen,name:"临汾",capital:false,province:ProvinceID.HEDONGLU,colonizeLevel:1,region:RegionID.R11},
    [CityID.ShangDang]:{id:CityID.ShangDang,name:"上党",capital:false,province:ProvinceID.HEDONGLU,colonizeLevel:1,region:RegionID.R12},
    [CityID.ZhenDing]:{id:CityID.ZhenDing,name:"真定",capital:false,province:ProvinceID.HEBEILIANGLU,colonizeLevel:1,region:RegionID.R13},
    [CityID.AnXi]:{id:CityID.AnXi,name:"安喜",capital:false,province:ProvinceID.HEBEILIANGLU,colonizeLevel:0,region:RegionID.R14},
    [CityID.HeJian]:{id:CityID.HeJian,name:"河间",capital:false,province:ProvinceID.HEBEILIANGLU,colonizeLevel:1,region:RegionID.R15},
    [CityID.YuanCheng]:{id:CityID.YuanCheng,name:"元城",capital:true,province:ProvinceID.HEBEILIANGLU,colonizeLevel:1,region:RegionID.R18},
    [CityID.LiCheng]:{id:CityID.LiCheng,name:"历城",capital:false,province:ProvinceID.JINGDONGLIANGLU,colonizeLevel:1,region:RegionID.R21},
    [CityID.XuCheng]:{id:CityID.XuCheng,name:"须城",capital:false,province:ProvinceID.JINGDONGLIANGLU,colonizeLevel:2,region:RegionID.R25},
    [CityID.SongCheng]:{id:CityID.SongCheng,name:"宋城",capital:true,province:ProvinceID.JINGDONGLIANGLU,colonizeLevel:1,region:RegionID.R28},
    [CityID.Fushi]:{id:CityID.Fushi,name:"肤施",capital:false,province:ProvinceID.JINGXILIANGLU,colonizeLevel:1,region:RegionID.R32},
    [CityID.TianXing]:{id:CityID.TianXing,name:"天兴",capital:false,province:ProvinceID.JINGXILIANGLU,colonizeLevel:2,region:RegionID.R33},
    [CityID.ChangAn]:{id:CityID.ChangAn,name:"长安",capital:true,province:ProvinceID.JINGXILIANGLU,colonizeLevel:2,region:RegionID.R36},
    [CityID.LuoYang]:{id:CityID.LuoYang,name:"洛阳",capital:false,province:ProvinceID.JINGJILU,colonizeLevel:2,region:RegionID.R37},
    [CityID.WanQiu]:{id:CityID.WanQiu,name:"宛丘",capital:false,province:ProvinceID.JINGJILU,colonizeLevel:2,region:RegionID.R41},
    [CityID.XiangYang]:{id:CityID.XiangYang,name:"襄阳",capital:true,province:ProvinceID.JINGJILU,colonizeLevel:3,region:RegionID.R42},
    [CityID.KaiFeng]:{id:CityID.KaiFeng,name:"开封",capital:true,province:ProvinceID.HUAINANLIANGLU,colonizeLevel:2,region:RegionID.R43},
    [CityID.JiangDu]:{id:CityID.JiangDu,name:"江都",capital:true,province:ProvinceID.CHUANSHANSILU,colonizeLevel:3,region:RegionID.R46},
    [CityID.XiaCai]:{id:CityID.XiaCai,name:"下蔡",capital:false,province:ProvinceID.CHUANSHANSILU,colonizeLevel:3,region:RegionID.R48},
    [CityID.NanZhen]:{id:CityID.NanZhen,name:"南郑",capital:false,province:ProvinceID.JINHULIANGLU,colonizeLevel:3,region:RegionID.R52},
    [CityID.ChengDu]:{id:CityID.ChengDu,name:"成都",capital:true,province:ProvinceID.JINHULIANGLU,colonizeLevel:4,region:RegionID.R54},
    [CityID.QiXian]:{id:CityID.QiXian,name:"郪县",capital:false,province:ProvinceID.JINHULIANGLU,colonizeLevel:4,region:RegionID.R55},
    [CityID.JiangLing]:{id:CityID.JiangLing,name:"江陵",capital:true,province:ProvinceID.JIANGNANLIANGLU,colonizeLevel:4,region:RegionID.R60},
    [CityID.AnLu]:{id:CityID.AnLu,name:"安陆",capital:false,province:ProvinceID.JIANGNANLIANGLU,colonizeLevel:3,region:RegionID.R61},
    [CityID.ChangSha]:{id:CityID.ChangSha,name:"长沙",capital:false,province:ProvinceID.JIANGNANLIANGLU,colonizeLevel:4,region:RegionID.R64},
    [CityID.JiangNing]:{id:CityID.JiangNing,name:"江宁",capital:true,province:ProvinceID.LIANGZHELU,colonizeLevel:4,region:RegionID.R66},
    [CityID.NanChang]:{id:CityID.NanChang,name:"南昌",capital:false,province:ProvinceID.LIANGZHELU,colonizeLevel:4,region:RegionID.R68},
    [CityID.DanTu]:{id:CityID.DanTu,name:"丹徒",capital:true,province:ProvinceID.FUJIANLU,colonizeLevel:5,region:RegionID.R72},
    [CityID.WuXian]:{id:CityID.WuXian,name:"吴县",capital:false,province:ProvinceID.FUJIANLU,colonizeLevel:5,region:RegionID.R73},
    [CityID.QianTang]:{id:CityID.QianTang,name:"钱塘",capital:true,province:ProvinceID.FUJIANLU,colonizeLevel:5,region:RegionID.R74},
    [CityID.MinXian]:{id:CityID.MinXian,name:"闽县",capital:true,province:ProvinceID.SHANXILIULU,colonizeLevel:5,region:RegionID.R77},
}