import {CityID, ProvinceID, RegionID} from "./general";

export interface Province {
    id: ProvinceID,
    name: string,
    adjacent: ProvinceID[],
    capital: CityID[],
    other: CityID[],
    regions: RegionID[]
}

export const getProvinceById: (pid: ProvinceID) => Province = (pid: ProvinceID) => {
    return idToProvince[pid];
}

const idToProvince = {
    [ProvinceID.BEIJINGLU]:{id:ProvinceID.BEIJINGLU,name:"北京路",capital:[CityID.DaDing],adjacent:[ProvinceID.XIJINGLU,ProvinceID.YANJINGLU,ProvinceID.DONGJINGLU],other:[],regions:[RegionID.R05]},
    [ProvinceID.YANJINGLU]:{id:ProvinceID.YANJINGLU,name:"燕京路",capital:[],adjacent:[ProvinceID.BEIJINGLU,ProvinceID.DONGJINGLU],other:[CityID.XiJin],regions:[RegionID.R06]},
    [ProvinceID.DONGJINGLU]:{id:ProvinceID.DONGJINGLU,name:"东京路",capital:[CityID.LiaoYang],adjacent:[ProvinceID.XIJINGLU,ProvinceID.BEIJINGLU,ProvinceID.HEBEILIANGLU],other:[],regions:[RegionID.R07,RegionID.R08]},
    [ProvinceID.HEDONGLU]:{id:ProvinceID.HEDONGLU,name:"河东路",capital:[CityID.YangQu],adjacent:[ProvinceID.XIJINGLU,ProvinceID.HEBEILIANGLU,ProvinceID.SHANXILIULU,ProvinceID.JINGXILIANGLU,ProvinceID.JINGJILU],other:[CityID.LinFen,CityID.ShangDang],regions:[RegionID.R09,RegionID.R10,RegionID.R11PingYangFu,RegionID.R12LongDeFu]},
    [ProvinceID.HEBEILIANGLU]:{id:ProvinceID.HEBEILIANGLU,name:"河北两路",capital:[CityID.YuanCheng],adjacent:[ProvinceID.XIJINGLU,ProvinceID.DONGJINGLU,ProvinceID.HEDONGLU,ProvinceID.JINGDONGLIANGLU,ProvinceID.JINGXILIANGLU,ProvinceID.JINGJILU],other:[CityID.ZhenDing,CityID.AnXi,CityID.HeJian],regions:[RegionID.R13,RegionID.R14ZhongShanFu,RegionID.R15,RegionID.R16,RegionID.R17,RegionID.R18,RegionID.R19,RegionID.R20]},
    [ProvinceID.JINGDONGLIANGLU]:{id:ProvinceID.JINGDONGLIANGLU,name:"京东两路",capital:[CityID.SongCheng],adjacent:[ProvinceID.HEBEILIANGLU,ProvinceID.JINGJILU,ProvinceID.HUAINANLIANGLU],other:[CityID.LiCheng,CityID.XuCheng],regions:[RegionID.R21,RegionID.R22,RegionID.R23,RegionID.R24,RegionID.R25,RegionID.R26,RegionID.R27,RegionID.R28]},
    [ProvinceID.SHANXILIULU]:{id:ProvinceID.SHANXILIULU,name:"陕西六路",capital:[CityID.ChangAn],adjacent:[ProvinceID.HEDONGLU,ProvinceID.JINGXILIANGLU,ProvinceID.CHUANSHANSILU],other:[CityID.Fushi,CityID.TianXing],regions:[RegionID.R29,RegionID.R30,RegionID.R31,RegionID.R32,RegionID.R33,RegionID.R34,RegionID.R35,RegionID.R36]},
    [ProvinceID.JINGXILIANGLU]:{id:ProvinceID.JINGXILIANGLU,name:"京西两路",capital:[CityID.XiangYang],adjacent:[ProvinceID.HEDONGLU,ProvinceID.HEBEILIANGLU,ProvinceID.SHANXILIULU,ProvinceID.JINGJILU,ProvinceID.HUAINANLIANGLU,ProvinceID.CHUANSHANSILU,ProvinceID.JINHULIANGLU],other:[CityID.LuoYang,CityID.WanQiu],regions:[RegionID.R37,RegionID.R38,RegionID.R39,RegionID.R40,RegionID.R41,RegionID.R42]},
    [ProvinceID.XIJINGLU]:{id:ProvinceID.XIJINGLU,name:"西京路",capital:[CityID.DaTong],adjacent:[ProvinceID.BEIJINGLU,ProvinceID.DONGJINGLU,ProvinceID.HEDONGLU],other:[],regions:[RegionID.R01,RegionID.R02DaTonFu,RegionID.WuShuo2Zhou03,RegionID.R04]},
    [ProvinceID.JINGJILU]:{id:ProvinceID.JINGJILU,name:"京畿路",capital:[CityID.KaiFeng],adjacent:[ProvinceID.HEBEILIANGLU,ProvinceID.JINGDONGLIANGLU,ProvinceID.JINGXILIANGLU,ProvinceID.HUAINANLIANGLU],other:[],regions:[RegionID.R43]},
    [ProvinceID.HUAINANLIANGLU]:{id:ProvinceID.HUAINANLIANGLU,name:"淮南两路",capital:[CityID.JiangDu],adjacent:[ProvinceID.JINGDONGLIANGLU,ProvinceID.JINGXILIANGLU,ProvinceID.JINGJILU,ProvinceID.JINHULIANGLU,ProvinceID.JIANGNANLIANGLU,ProvinceID.LIANGZHELU],other:[CityID.XiaCai],regions:[RegionID.R44,RegionID.R45,RegionID.R46,RegionID.R47,RegionID.R48,RegionID.R49,RegionID.R50]},
    [ProvinceID.CHUANSHANSILU]:{id:ProvinceID.CHUANSHANSILU,name:"川陕四路",capital:[CityID.ChengDu],adjacent:[ProvinceID.SHANXILIULU,ProvinceID.JINGXILIANGLU,ProvinceID.JINHULIANGLU],other:[CityID.NanZhen,CityID.QiXian],regions:[RegionID.R51,RegionID.R52,RegionID.R53,RegionID.R54,RegionID.R55,RegionID.R56,RegionID.R57,RegionID.R58]},
    [ProvinceID.JINHULIANGLU]:{id:ProvinceID.JINHULIANGLU,name:"荆湖两路",capital:[CityID.JiangLing],adjacent:[ProvinceID.JINGXILIANGLU,ProvinceID.HUAINANLIANGLU,ProvinceID.CHUANSHANSILU,ProvinceID.JIANGNANLIANGLU],other:[CityID.AnLu,CityID.ChangSha],regions:[RegionID.R59,RegionID.R60,RegionID.R61,RegionID.R62,RegionID.R63,RegionID.R64,RegionID.R65]},
    [ProvinceID.JIANGNANLIANGLU]:{id:ProvinceID.JIANGNANLIANGLU,name:"江南两路",capital:[CityID.JiangNing],adjacent:[ProvinceID.HUAINANLIANGLU,ProvinceID.JINHULIANGLU,ProvinceID.LIANGZHELU,ProvinceID.FUJIANLU],other:[CityID.NanChang],regions:[RegionID.R66,RegionID.R67,RegionID.R68,RegionID.R69,RegionID.R70,RegionID.R71]},
    [ProvinceID.LIANGZHELU]:{id:ProvinceID.LIANGZHELU,name:"两浙路",capital:[CityID.DanTu,CityID.QianTang],adjacent:[ProvinceID.HUAINANLIANGLU,ProvinceID.JIANGNANLIANGLU,ProvinceID.FUJIANLU],other:[CityID.WuXian],regions:[RegionID.R72,RegionID.R73,RegionID.R74,RegionID.R75,RegionID.R76]},
    [ProvinceID.FUJIANLU]:{id:ProvinceID.FUJIANLU,name:"福建路",capital:[CityID.MinXian],adjacent:[ProvinceID.JIANGNANLIANGLU,ProvinceID.LIANGZHELU],other:[],regions:[RegionID.R77]},
};


