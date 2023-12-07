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
    return idToProvince[ProvinceID.XIJINGLU];
}

const idToProvince = {
    [ProvinceID.XIJINGLU]:{id:ProvinceID.XIJINGLU,name:"西京路",capital:[CityID.DaTong],adjacent:[ProvinceID.BEIJINGLU,ProvinceID.DONGJINGLU,ProvinceID.HEDONGLU],other:[],regions:[RegionID.R01,RegionID.R02,RegionID.R03,RegionID.R04]},
    [ProvinceID.BEIJINGLU]:{id:ProvinceID.BEIJINGLU,name:"北京路",capital:[CityID.DaDing],adjacent:[ProvinceID.XIJINGLU,ProvinceID.YANJINGLU,ProvinceID.DONGJINGLU],other:[],regions:[RegionID.R05]},
    [ProvinceID.YANJINGLU]:{id:ProvinceID.YANJINGLU,name:"燕京路",capital:[],adjacent:[ProvinceID.BEIJINGLU,ProvinceID.DONGJINGLU],other:[CityID.XiJin],regions:[RegionID.R06]},
    [ProvinceID.DONGJINGLU]:{id:ProvinceID.DONGJINGLU,name:"东京路",capital:[CityID.LiaoYang],adjacent:[ProvinceID.XIJINGLU,ProvinceID.BEIJINGLU,ProvinceID.HEBEILIANGLU],other:[],regions:[RegionID.R07,RegionID.R08]},
    [ProvinceID.HEDONGLU]:{id:ProvinceID.HEDONGLU,name:"河东路",capital:[CityID.YangQu],adjacent:[ProvinceID.XIJINGLU,ProvinceID.HEBEILIANGLU,ProvinceID.JINGXILIANGLU,ProvinceID.JINGJILU,ProvinceID.HUAINANLIANGLU],other:[CityID.LinFen,CityID.ShangDang],regions:[RegionID.R09,RegionID.R10,RegionID.R11,RegionID.R12]},
    [ProvinceID.HEBEILIANGLU]:{id:ProvinceID.HEBEILIANGLU,name:"河北两路",capital:[CityID.YuanCheng],adjacent:[ProvinceID.XIJINGLU,ProvinceID.DONGJINGLU,ProvinceID.HEDONGLU,ProvinceID.JINGDONGLIANGLU,ProvinceID.JINGJILU,ProvinceID.HUAINANLIANGLU],other:[CityID.ZhenDing,CityID.AnXi,CityID.HeJian],regions:[RegionID.R13,RegionID.R14,RegionID.R15,RegionID.R16,RegionID.R17,RegionID.R18,RegionID.R19,RegionID.R20]},
    [ProvinceID.JINGDONGLIANGLU]:{id:ProvinceID.JINGDONGLIANGLU,name:"京东两路",capital:[CityID.SongCheng],adjacent:[ProvinceID.HEBEILIANGLU,ProvinceID.HUAINANLIANGLU,ProvinceID.CHUANSHANSILU],other:[CityID.LiCheng,CityID.XuCheng],regions:[RegionID.R21,RegionID.R22,RegionID.R23,RegionID.R24,RegionID.R25,RegionID.R26,RegionID.R27,RegionID.R28]},
    [ProvinceID.JINGXILIANGLU]:{id:ProvinceID.JINGXILIANGLU,name:"陕西六路",capital:[CityID.ChangAn],adjacent:[ProvinceID.HEDONGLU,ProvinceID.JINGJILU,ProvinceID.JINHULIANGLU],other:[CityID.Fushi,CityID.TianXing],regions:[RegionID.R29,RegionID.R30,RegionID.R31,RegionID.R32,RegionID.R33,RegionID.R34,RegionID.R35,RegionID.R36]},
    [ProvinceID.JINGJILU]:{id:ProvinceID.JINGJILU,name:"京西两路",capital:[CityID.XiangYang],adjacent:[ProvinceID.HEDONGLU,ProvinceID.HEBEILIANGLU,ProvinceID.JINGXILIANGLU,ProvinceID.HUAINANLIANGLU,ProvinceID.CHUANSHANSILU,ProvinceID.JINHULIANGLU,ProvinceID.JIANGNANLIANGLU],other:[CityID.LuoYang,CityID.WanQiu],regions:[RegionID.R37,RegionID.R38,RegionID.R39,RegionID.R40,RegionID.R41,RegionID.R42]},
    [ProvinceID.HUAINANLIANGLU]:{id:ProvinceID.HUAINANLIANGLU,name:"京畿路",capital:[CityID.KaiFeng],adjacent:[ProvinceID.HEBEILIANGLU,ProvinceID.JINGDONGLIANGLU,ProvinceID.JINGJILU,ProvinceID.CHUANSHANSILU],other:[],regions:[RegionID.R43]},
    [ProvinceID.CHUANSHANSILU]:{id:ProvinceID.CHUANSHANSILU,name:"淮南两路",capital:[CityID.JiangDu],adjacent:[ProvinceID.JINGDONGLIANGLU,ProvinceID.JINGJILU,ProvinceID.HUAINANLIANGLU,ProvinceID.JIANGNANLIANGLU,ProvinceID.LIANGZHELU,ProvinceID.FUJIANLU],other:[CityID.XiaCai],regions:[RegionID.R44,RegionID.R45,RegionID.R46,RegionID.R47,RegionID.R48,RegionID.R49,RegionID.R50]},
    [ProvinceID.JINHULIANGLU]:{id:ProvinceID.JINHULIANGLU,name:"川陕四路",capital:[CityID.ChengDu],adjacent:[ProvinceID.JINGXILIANGLU,ProvinceID.JINGJILU,ProvinceID.JIANGNANLIANGLU],other:[CityID.NanZhen,CityID.QiXian],regions:[RegionID.R51,RegionID.R52,RegionID.R53,RegionID.R54,RegionID.R55,RegionID.R56,RegionID.R57,RegionID.R58]},
    [ProvinceID.JIANGNANLIANGLU]:{id:ProvinceID.JIANGNANLIANGLU,name:"荆湖两路",capital:[CityID.JiangLing],adjacent:[ProvinceID.JINGJILU,ProvinceID.CHUANSHANSILU,ProvinceID.JINHULIANGLU,ProvinceID.LIANGZHELU],other:[CityID.AnLu,CityID.ChangSha],regions:[RegionID.R59,RegionID.R60,RegionID.R61,RegionID.R62,RegionID.R63,RegionID.R64,RegionID.R65]},
    [ProvinceID.LIANGZHELU]:{id:ProvinceID.LIANGZHELU,name:"江南两路",capital:[CityID.JiangNing],adjacent:[ProvinceID.CHUANSHANSILU,ProvinceID.JIANGNANLIANGLU,ProvinceID.FUJIANLU,ProvinceID.SHANXILIULU],other:[CityID.NanChang],regions:[RegionID.R66,RegionID.R67,RegionID.R68,RegionID.R69,RegionID.R70,RegionID.R71]},
    [ProvinceID.FUJIANLU]:{id:ProvinceID.FUJIANLU,name:"两浙路",capital:[CityID.DanTu,CityID.QianTang],adjacent:[ProvinceID.CHUANSHANSILU,ProvinceID.LIANGZHELU,ProvinceID.SHANXILIULU],other:[CityID.WuXian],regions:[RegionID.R72,RegionID.R73,RegionID.R74,RegionID.R75,RegionID.R76]},
    [ProvinceID.SHANXILIULU]:{id:ProvinceID.SHANXILIULU,name:"福建路",capital:[CityID.MinXian],adjacent:[ProvinceID.LIANGZHELU,ProvinceID.FUJIANLU],other:[],regions:[RegionID.R77]},
};


