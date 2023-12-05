import {CityID, ProvinceID} from "./general";

export interface Province {
    id: ProvinceID,
    name: string,
    adjacent: ProvinceID[],
    capital: CityID,
    other: CityID[],
}

export const getProvinceById: (pid: ProvinceID) => Province = (pid: ProvinceID) => {
    return idToProvince[ProvinceID.XIJINGLU];
}

const idToProvince: Record<ProvinceID, Province> = {
    [ProvinceID.XIJINGLU]:{id:ProvinceID.XIJINGLU,name:"西京路",capital:CityID.DaTong,adjacent:[RegionID.R02,RegionID.R04,RegionID.R05],other:[]},
    [ProvinceID.BEIJINGLU]:{id:ProvinceID.BEIJINGLU,name:"北京路",capital:CityID.DaDing,adjacent:[RegionID.R01,RegionID.R03,RegionID.R04],other:[]},
    [ProvinceID.YANJINGLU]:{id:ProvinceID.YANJINGLU,name:"燕京路",capital:undefined,adjacent:[RegionID.R02,RegionID.R04],other:[CityID.XiJin]},
    [ProvinceID.DONGJINGLU]:{id:ProvinceID.DONGJINGLU,name:"东京路",capital:CityID.LiaoYang,adjacent:[RegionID.R01,RegionID.R02,RegionID.R06],other:[]},
    [ProvinceID.HEDONGLU]:{id:ProvinceID.HEDONGLU,name:"河东路",capital:CityID.YangQu,adjacent:[RegionID.R01,RegionID.R06,RegionID.R08,RegionID.R09,RegionID.R10],other:[CityID.LinFen,CityID.ShangDang]},
    [ProvinceID.HEBEILIANGLU]:{id:ProvinceID.HEBEILIANGLU,name:"河北两路",capital:CityID.YuanCheng,adjacent:[RegionID.R01,RegionID.R04,RegionID.R05,RegionID.R07,RegionID.R09,RegionID.R10],other:[CityID.ZhenDing,CityID.AnXi,CityID.HeJian]},
    [ProvinceID.JINGDONGLIANGLU]:{id:ProvinceID.JINGDONGLIANGLU,name:"京东两路",capital:CityID.SongCheng,adjacent:[RegionID.R06,RegionID.R10,RegionID.R11],other:[CityID.LiCheng,CityID.XuCheng]},
    [ProvinceID.JINGXILIANGLU]:{id:ProvinceID.JINGXILIANGLU,name:"陕西六路",capital:CityID.ChangAn,adjacent:[RegionID.R05,RegionID.R09,RegionID.R12],other:[CityID.Fushi,CityID.TianXing]},
    [ProvinceID.JINGJILU]:{id:ProvinceID.JINGJILU,name:"京西两路",capital:CityID.XiangYang,adjacent:[RegionID.R05,RegionID.R06,RegionID.R08,RegionID.R10,RegionID.R11,RegionID.R12,RegionID.R13],other:[CityID.LuoYang,CityID.WanQiu]},
    [ProvinceID.HUAINANLIANGLU]:{id:ProvinceID.HUAINANLIANGLU,name:"京畿路",capital:CityID.KaiFeng,adjacent:[RegionID.R06,RegionID.R07,RegionID.R09,RegionID.R11],other:[]},
    [ProvinceID.CHUANSHANSILU]:{id:ProvinceID.CHUANSHANSILU,name:"淮南两路",capital:CityID.JiangDu,adjacent:[RegionID.R07,RegionID.R09,RegionID.R10,RegionID.R13,RegionID.R14,RegionID.R15],other:[CityID.XiaCai]},
    [ProvinceID.JINHULIANGLU]:{id:ProvinceID.JINHULIANGLU,name:"川陕四路",capital:CityID.ChengDu,adjacent:[RegionID.R08,RegionID.R09,RegionID.R13],other:[CityID.NanZhen,CityID.QiXian]},
    [ProvinceID.JIANGNANLIANGLU]:{id:ProvinceID.JIANGNANLIANGLU,name:"荆湖两路",capital:CityID.JiangLing,adjacent:[RegionID.R09,RegionID.R11,RegionID.R12,RegionID.R14],other:[CityID.AnLu,CityID.ChangSha]},
    [ProvinceID.LIANGZHELU]:{id:ProvinceID.LIANGZHELU,name:"江南两路",capital:CityID.JiangNing,adjacent:[RegionID.R11,RegionID.R13,RegionID.R15,RegionID.R16],other:[CityID.NanChang]},
    [ProvinceID.FUJIANLU]:{id:ProvinceID.FUJIANLU,name:"两浙路",capital:undefined,adjacent:[RegionID.R11,RegionID.R14,RegionID.R16],other:[CityID.WuXian]},
    [ProvinceID.SHANXILIULU]:{id:ProvinceID.SHANXILIULU,name:"福建路",capital:CityID.MinXian,adjacent:[RegionID.R14,RegionID.R15],other:[]},
};


