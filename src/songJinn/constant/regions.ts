import {CityID, ProvinceID, RegionID, TerrainType} from "./general";

export interface Region {
    city: CityID | null;
    id: RegionID;
    name: string;
    land: RegionID[];
    water: RegionID[];
    terrain: TerrainType,
    province: ProvinceID;
}

export const getRegionById: (rid: RegionID) => Region = (rid: RegionID) => {
    return idToRegion[rid];
}

const idToRegion = {
    [RegionID.R01]:
        {
            id: RegionID.R01,
            name: "云内洲地区",
            terrain: TerrainType.MOUNTAINS,
            province: ProvinceID.XIJINGLU,
            land: [RegionID.R02, RegionID.R03],
            water: [],
            pass: [],
            city: null
        },

    [RegionID.R02]:
        {
            id: RegionID.R02,
            name: "大同府",
            terrain: TerrainType.FLATLAND,
            province: ProvinceID.XIJINGLU,
            land: [RegionID.R01, RegionID.R03, RegionID.R04, RegionID.R05],
            water: [],
            pass: [RegionID.R07],
            city: CityID.DaTong
        },
    [RegionID.R03]:
        {
            id: RegionID.R03,
            name: "武朔两州",
            terrain: TerrainType.MOUNTAINS,
            province: ProvinceID.XIJINGLU,
            land: [RegionID.R01, RegionID.R02, RegionID.R04, RegionID.R09, RegionID.R10],
            water: [],
            pass: [],
            city: null
        },

    [RegionID.R04]:
        {
            id: RegionID.R04,
            name: "应蔚两州",
            terrain: TerrainType.MOUNTAINS,
            province: ProvinceID.XIJINGLU,
            land: [RegionID.R02, RegionID.R03, RegionID.R07, RegionID.R10, RegionID.R13, RegionID.R14],
            water: [],
            pass: [],
            city: null
        },

    [RegionID.R05]:
        {
            id: RegionID.R05,
            name: "大定府",
            terrain: TerrainType.FLATLAND,
            province: ProvinceID.BEIJINGLU,
            land: [RegionID.R02, RegionID.R06, RegionID.R07, RegionID.R08],
            water: [],
            pass: [],
            city: CityID.DaDing
        },
    [RegionID.R06]:
        {
            id: RegionID.R06,
            name: "辽阳府",
            terrain: TerrainType.FLATLAND,
            province: ProvinceID.YANJINGLU,
            land: [RegionID.R02],
            water: [],
            pass: [],
            city: CityID.LiaoYang
        },
    [RegionID.R07]:
        {
            id: RegionID.R07,
            name: "析津府",
            terrain: TerrainType.FLATLAND,
            province: ProvinceID.DONGJINGLU,
            land: [RegionID.R04, RegionID.R05, RegionID.R08, RegionID.R14, RegionID.R15],
            water: [RegionID.R16],
            pass: [RegionID.R02],
            city: CityID.XiJin
        },
    [RegionID.R08]:
        {
            id: RegionID.R08,
            name: "平州",
            terrain: TerrainType.FLATLAND,
            province: ProvinceID.DONGJINGLU,
            land: [RegionID.R05, RegionID.R07],
            water: [],
            pass: [],
            city: null
        },

    [RegionID.R09]:
        {
            id: RegionID.R09,
            name: "山西高原",
            terrain: TerrainType.MOUNTAINS,
            province: ProvinceID.HEDONGLU,
            land: [RegionID.R03, RegionID.R10, RegionID.R11],
            water: [RegionID.R32],
            pass: [],
            city: null
        },

    [RegionID.R10]:
        {
            id: RegionID.R10,
            name: "太原府",
            terrain: TerrainType.MOUNTAINS,
            province: ProvinceID.HEDONGLU,
            land: [RegionID.R03, RegionID.R04, RegionID.R09, RegionID.R11, RegionID.R12, RegionID.R13, RegionID.R17],
            water: [],
            pass: [],
            city: CityID.YangQu
        },
    [RegionID.R11]:
        {
            id: RegionID.R11,
            name: "平阳府",
            terrain: TerrainType.MOUNTAINS,
            province: ProvinceID.HEDONGLU,
            land: [RegionID.R09, RegionID.R10, RegionID.R12, RegionID.R36],
            water: [RegionID.R32],
            pass: [],
            city: CityID.LinFen
        },
    [RegionID.R12]:
        {
            id: RegionID.R12,
            name: "隆德府",
            terrain: TerrainType.MOUNTAINS,
            province: ProvinceID.HEDONGLU,
            land: [RegionID.R10, RegionID.R11, RegionID.R17, RegionID.R19],
            water: [RegionID.R37],
            pass: [],
            city: CityID.ShangDang
        },
    [RegionID.R13]:
        {
            id: RegionID.R13,
            name: "真定府",
            terrain: TerrainType.FLATLAND,
            province: ProvinceID.HEBEILIANGLU,
            land: [RegionID.R04, RegionID.R10, RegionID.R14, RegionID.R17],
            water: [],
            pass: [],
            city: CityID.ZhenDing
        },
    [RegionID.R14]:
        {
            id: RegionID.R14,
            name: "中山府",
            terrain: TerrainType.FLATLAND,
            province: ProvinceID.HEBEILIANGLU,
            land: [RegionID.R04, RegionID.R07, RegionID.R13, RegionID.R15, RegionID.R17],
            water: [RegionID.R16],
            pass: [],
            city: CityID.AnXi
        },
    [RegionID.R15]:
        {
            id: RegionID.R15,
            name: "河间府",
            terrain: TerrainType.FLATLAND,
            province: ProvinceID.HEBEILIANGLU,
            land: [RegionID.R07, RegionID.R14],
            water: [RegionID.R16],
            pass: [],
            city: CityID.HeJian
        },
    [RegionID.R16]:
        {
            id: RegionID.R16,
            name: "沧州",
            terrain: TerrainType.FLATLAND,
            province: ProvinceID.HEBEILIANGLU,
            land: [RegionID.R18],
            water: [RegionID.R14, RegionID.R15, RegionID.R17, RegionID.R21],
            pass: [],
            city: null
        },

    [RegionID.R17]:
        {
            id: RegionID.R17,
            name: "庆源府和信德府",
            terrain: TerrainType.FLATLAND,
            province: ProvinceID.HEBEILIANGLU,
            land: [RegionID.R10, RegionID.R13, RegionID.R14, RegionID.R12, RegionID.R19],
            water: [RegionID.R18],
            pass: [],
            city: null
        },

    [RegionID.R18]:
        {
            id: RegionID.R18,
            name: "大名府",
            terrain: TerrainType.FLATLAND,
            province: ProvinceID.HEBEILIANGLU,
            land: [RegionID.R16],
            water: [RegionID.R17, RegionID.R20, RegionID.R21, RegionID.R25],
            pass: [],
            city: CityID.YuanCheng
        },
    [RegionID.R19]:
        {
            id: RegionID.R19,
            name: "卫州地区",
            terrain: TerrainType.FLATLAND,
            province: ProvinceID.HEBEILIANGLU,
            land: [RegionID.R12, RegionID.R17],
            water: [RegionID.R37, RegionID.R43, RegionID.R20],
            pass: [],
            city: null
        },

    [RegionID.R20]:
        {
            id: RegionID.R20,
            name: "开德府",
            terrain: TerrainType.FLATLAND,
            province: ProvinceID.HEBEILIANGLU,
            land: [RegionID.R24, RegionID.R25, RegionID.R43],
            water: [RegionID.R18, RegionID.R19],
            pass: [],
            city: null
        },

    [RegionID.R21]:
        {
            id: RegionID.R21,
            name: "济南府",
            terrain: TerrainType.HILLS,
            province: ProvinceID.JINGDONGLIANGLU,
            land: [RegionID.R25, RegionID.R26, RegionID.R27],
            water: [RegionID.R16, RegionID.R18],
            pass: [],
            city: CityID.LiCheng
        },
    [RegionID.R22]:
        {
            id: RegionID.R22,
            name: "潍密两州",
            terrain: TerrainType.FLATLAND,
            province: ProvinceID.JINGDONGLIANGLU,
            land: [RegionID.R21, RegionID.R27, RegionID.R23, RegionID.R44],
            water: [],
            pass: [],
            city: null
        },

    [RegionID.R23]:
        {
            id: RegionID.R23,
            name: "登州",
            terrain: TerrainType.HILLS,
            province: ProvinceID.JINGDONGLIANGLU,
            land: [RegionID.R23],
            water: [],
            pass: [],
            city: null
        },

    [RegionID.R24]:
        {
            id: RegionID.R24,
            name: "兴仁府",
            terrain: TerrainType.FLATLAND,
            province: ProvinceID.JINGDONGLIANGLU,
            land: [RegionID.R20, RegionID.R25, RegionID.R28, RegionID.R43],
            water: [],
            pass: [],
            city: null
        },

    [RegionID.R25]:
        {
            id: RegionID.R25,
            name: "东平府",
            terrain: TerrainType.FLATLAND,
            province: ProvinceID.JINGDONGLIANGLU,
            land: [RegionID.R20, RegionID.R21, RegionID.R24, RegionID.R26, RegionID.R28],
            water: [RegionID.R18],
            pass: [],
            city: CityID.XuCheng
        },
    [RegionID.R26]:
        {
            id: RegionID.R26,
            name: "裘庆府",
            terrain: TerrainType.HILLS,
            province: ProvinceID.JINGDONGLIANGLU,
            land: [RegionID.R21, RegionID.R25, RegionID.R27, RegionID.R28],
            water: [],
            pass: [],
            city: null
        },

    [RegionID.R27]:
        {
            id: RegionID.R27,
            name: "沂州",
            terrain: TerrainType.HILLS,
            province: ProvinceID.JINGDONGLIANGLU,
            land: [RegionID.R21, RegionID.R22, RegionID.R26, RegionID.R28, RegionID.R44, RegionID.R45],
            water: [RegionID.R46],
            pass: [],
            city: null
        },

    [RegionID.R28]:
        {
            id: RegionID.R28,
            name: "应天府",
            terrain: TerrainType.HILLS,
            province: ProvinceID.JINGDONGLIANGLU,
            land: [RegionID.R24, RegionID.R25, RegionID.R26, RegionID.R27, RegionID.R43, RegionID.R45],
            water: [],
            pass: [],
            city: CityID.SongCheng
        },
    [RegionID.R29]:
        {
            id: RegionID.R29,
            name: "熙河路地区",
            terrain: TerrainType.MOUNTAINS,
            province: ProvinceID.JINGXILIANGLU,
            land: [RegionID.R30, RegionID.R33],
            water: [],
            pass: [],
            city: null
        },

    [RegionID.R30]:
        {
            id: RegionID.R30,
            name: "泾原路地区",
            terrain: TerrainType.MOUNTAINS,
            province: ProvinceID.JINGXILIANGLU,
            land: [RegionID.R29, RegionID.R31, RegionID.R33],
            water: [],
            pass: [],
            city: null
        },

    [RegionID.R31]:
        {
            id: RegionID.R31,
            name: "环庆路地区",
            terrain: TerrainType.MOUNTAINS,
            province: ProvinceID.JINGXILIANGLU,
            land: [RegionID.R30, RegionID.R32, RegionID.R34],
            water: [],
            pass: [],
            city: null
        },

    [RegionID.R32]:
        {
            id: RegionID.R32,
            name: "延安府",
            terrain: TerrainType.MOUNTAINS,
            province: ProvinceID.JINGXILIANGLU,
            land: [RegionID.R31, RegionID.R34],
            water: [RegionID.R09, RegionID.R11],
            pass: [],
            city: CityID.Fushi
        },
    [RegionID.R33]:
        {
            id: RegionID.R33,
            name: "凤翔府",
            terrain: TerrainType.FLATLAND,
            province: ProvinceID.JINGXILIANGLU,
            land: [RegionID.R29, RegionID.R30, RegionID.R31, RegionID.R34, RegionID.R35],
            water: [],
            pass: [RegionID.R52],
            city: CityID.TianXing
        },
    [RegionID.R34]:
        {
            id: RegionID.R34,
            name: "关中平原",
            terrain: TerrainType.FLATLAND,
            province: ProvinceID.JINGXILIANGLU,
            land: [RegionID.R30, RegionID.R31, RegionID.R32, RegionID.R33],
            water: [RegionID.R11, RegionID.R35, RegionID.R36],
            pass: [],
            city: null
        },

    [RegionID.R35]:
        {
            id: RegionID.R35,
            name: "河中府",
            terrain: TerrainType.FLATLAND,
            province: ProvinceID.JINGXILIANGLU,
            land: [RegionID.R11],
            water: [RegionID.R34, RegionID.R35, RegionID.R37],
            pass: [],
            city: null
        },

    [RegionID.R36]:
        {
            id: RegionID.R36,
            name: "京兆府",
            terrain: TerrainType.FLATLAND,
            province: ProvinceID.JINGXILIANGLU,
            land: [RegionID.R33],
            water: [RegionID.R34, RegionID.R35],
            pass: [RegionID.R37, RegionID.R40],
            city: CityID.ChangAn
        },
    [RegionID.R37]:
        {
            id: RegionID.R37,
            name: "河南府",
            terrain: TerrainType.HILLS,
            province: ProvinceID.JINGJILU,
            land: [RegionID.R38, RegionID.R40, RegionID.R43],
            water: [RegionID.R11, RegionID.R12, RegionID.R19, RegionID.R35],
            pass: [RegionID.R36],
            city: CityID.LuoYang
        },
    [RegionID.R38]:
        {
            id: RegionID.R38,
            name: "颖昌府",
            terrain: TerrainType.FLATLAND,
            province: ProvinceID.JINGJILU,
            land: [RegionID.R37, RegionID.R40, RegionID.R41, RegionID.R43],
            water: [],
            pass: [],
            city: null
        },

    [RegionID.R39]:
        {
            id: RegionID.R39,
            name: "秦巴山区",
            terrain: TerrainType.MOUNTAINS,
            province: ProvinceID.JINGJILU,
            land: [RegionID.R40, RegionID.R52],
            water: [RegionID.R42],
            pass: [],
            city: null
        },

    [RegionID.R40]:
        {
            id: RegionID.R40,
            name: "邓州地区",
            terrain: TerrainType.FLATLAND,
            province: ProvinceID.JINGJILU,
            land: [RegionID.R37, RegionID.R38, RegionID.R39, RegionID.R41, RegionID.R42],
            water: [],
            pass: [RegionID.R36],
            city: null
        },

    [RegionID.R41]:
        {
            id: RegionID.R41,
            name: "淮宁",
            terrain: TerrainType.FLATLAND,
            province: ProvinceID.JINGJILU,
            land: [RegionID.R38, RegionID.R40, RegionID.R42, RegionID.R43, RegionID.R45],
            water: [],
            pass: [],
            city: CityID.WanQiu
        },
    [RegionID.R42]:
        {
            id: RegionID.R42,
            name: "襄阳",
            terrain: TerrainType.HILLS,
            province: ProvinceID.JINGJILU,
            land: [RegionID.R39, RegionID.R40, RegionID.R41, RegionID.R61],
            water: [RegionID.R39, RegionID.R59, RegionID.R60, RegionID.R61],
            pass: [],
            city: CityID.XiangYang
        },
    [RegionID.R43]:
        {
            id: RegionID.R43,
            name: "开封府",
            terrain: TerrainType.FLATLAND,
            province: ProvinceID.HUAINANLIANGLU,
            land: [RegionID.R20, RegionID.R24, RegionID.R28, RegionID.R37, RegionID.R38, RegionID.R41, RegionID.R45],
            water: [],
            pass: [],
            city: CityID.KaiFeng
        },
    [RegionID.R44]:
        {
            id: RegionID.R44,
            name: "海州",
            terrain: TerrainType.FLATLAND,
            province: ProvinceID.CHUANSHANSILU,
            land: [RegionID.R22, RegionID.R27, RegionID.R46],
            water: [],
            pass: [],
            city: null
        },

    [RegionID.R45]:
        {
            id: RegionID.R45,
            name: "宿毫两州",
            terrain: TerrainType.FLATLAND,
            province: ProvinceID.CHUANSHANSILU,
            land: [RegionID.R27, RegionID.R28, RegionID.R41, RegionID.R43],
            water: [RegionID.R48],
            pass: [],
            city: null
        },

    [RegionID.R46]:
        {
            id: RegionID.R46,
            name: "扬州地区",
            terrain: TerrainType.SWAMP,
            province: ProvinceID.CHUANSHANSILU,
            land: [RegionID.R44, RegionID.R48, RegionID.R50],
            water: [RegionID.R27, RegionID.R45, RegionID.R66, RegionID.R72],
            pass: [],
            city: CityID.JiangDu
        },
    [RegionID.R47]:
        {
            id: RegionID.R47,
            name: "泰州地区",
            terrain: TerrainType.SWAMP,
            province: ProvinceID.CHUANSHANSILU,
            land: [RegionID.R46],
            water: [],
            pass: [],
            city: null
        },

    [RegionID.R48]:
        {
            id: RegionID.R48,
            name: "寿春府",
            terrain: TerrainType.FLATLAND,
            province: ProvinceID.CHUANSHANSILU,
            land: [RegionID.R46, RegionID.R49, RegionID.R50],
            water: [RegionID.R41, RegionID.R45],
            pass: [],
            city: CityID.XiaCai
        },
    [RegionID.R49]:
        {
            id: RegionID.R49,
            name: "江淮丘陵",
            terrain: TerrainType.HILLS,
            province: ProvinceID.CHUANSHANSILU,
            land: [RegionID.R48, RegionID.R50, RegionID.R61],
            water: [RegionID.R41, RegionID.R65, RegionID.R68, RegionID.R69],
            pass: [],
            city: null
        },

    [RegionID.R50]:
        {
            id: RegionID.R50,
            name: "巢湖平原",
            terrain: TerrainType.FLATLAND,
            province: ProvinceID.CHUANSHANSILU,
            land: [RegionID.R46, RegionID.R48, RegionID.R49],
            water: [RegionID.R66, RegionID.R67, RegionID.R69],
            pass: [],
            city: null
        },

    [RegionID.R51]:
        {
            id: RegionID.R51,
            name: "利州地区",
            terrain: TerrainType.MOUNTAINS,
            province: ProvinceID.JINHULIANGLU,
            land: [RegionID.R52],
            water: [],
            pass: [RegionID.R54, RegionID.R55],
            city: null
        },

    [RegionID.R52]:
        {
            id: RegionID.R52,
            name: "兴元府",
            terrain: TerrainType.MOUNTAINS,
            province: ProvinceID.JINHULIANGLU,
            land: [RegionID.R39, RegionID.R51, RegionID.R56],
            water: [],
            pass: [RegionID.R33],
            city: CityID.NanZhen
        },
    [RegionID.R53]:
        {
            id: RegionID.R53,
            name: "邛崃山羁縻州地区",
            terrain: TerrainType.MOUNTAINS,
            province: ProvinceID.JINHULIANGLU,
            land: [RegionID.R57],
            water: [RegionID.R54],
            pass: [],
            city: null
        },

    [RegionID.R54]:
        {
            id: RegionID.R54,
            name: "成都府",
            terrain: TerrainType.FLATLAND,
            province: ProvinceID.JINHULIANGLU,
            land: [RegionID.R51, RegionID.R55],
            water: [RegionID.R53, RegionID.R57],
            pass: [RegionID.R51],
            city: CityID.ChengDu
        },
    [RegionID.R55]:
        {
            id: RegionID.R55,
            name: "潼川府",
            terrain: TerrainType.HILLS,
            province: ProvinceID.JINHULIANGLU,
            land: [RegionID.R54, RegionID.R56],
            water: [RegionID.R57],
            pass: [RegionID.R51],
            city: CityID.QiXian
        },
    [RegionID.R56]:
        {
            id: RegionID.R56,
            name: "夔州都督府辖区",
            terrain: TerrainType.MOUNTAINS,
            province: ProvinceID.JINHULIANGLU,
            land: [RegionID.R52, RegionID.R55],
            water: [RegionID.R57, RegionID.R58, RegionID.R62, RegionID.R63, RegionID.R59],
            pass: [],
            city: null
        },

    [RegionID.R57]:
        {
            id: RegionID.R57,
            name: "乌蒙山羁縻州地区",
            terrain: TerrainType.MOUNTAINS,
            province: ProvinceID.JINHULIANGLU,
            land: [RegionID.R53, RegionID.R58],
            water: [RegionID.R54, RegionID.R55, RegionID.R56],
            pass: [],
            city: null
        },

    [RegionID.R58]:
        {
            id: RegionID.R58,
            name: "黔州地区",
            terrain: TerrainType.MOUNTAINS,
            province: ProvinceID.JINHULIANGLU,
            land: [RegionID.R57],
            water: [RegionID.R56],
            pass: [],
            city: null
        },

    [RegionID.R59]:
        {
            id: RegionID.R59,
            name: "三峡地区",
            terrain: TerrainType.MOUNTAINS,
            province: ProvinceID.JIANGNANLIANGLU,
            land: [RegionID.R60, RegionID.R63],
            water: [RegionID.R42, RegionID.R56],
            pass: [],
            city: null
        },

    [RegionID.R60]:
        {
            id: RegionID.R60,
            name: "江陵府",
            terrain: TerrainType.SWAMP,
            province: ProvinceID.JIANGNANLIANGLU,
            land: [RegionID.R59, RegionID.R63],
            water: [RegionID.R42, RegionID.R61, RegionID.R64, RegionID.R65],
            pass: [],
            city: CityID.JiangLing
        },
    [RegionID.R61]:
        {
            id: RegionID.R61,
            name: "德安府",
            terrain: TerrainType.FLATLAND,
            province: ProvinceID.JIANGNANLIANGLU,
            land: [RegionID.R41, RegionID.R42, RegionID.R49],
            water: [RegionID.R60, RegionID.R65],
            pass: [],
            city: CityID.AnLu
        },
    [RegionID.R62]:
        {
            id: RegionID.R62,
            name: "武陵山区",
            terrain: TerrainType.MOUNTAINS,
            province: ProvinceID.JIANGNANLIANGLU,
            land: [RegionID.R63, RegionID.R64],
            water: [],
            pass: [],
            city: null
        },

    [RegionID.R63]:
        {
            id: RegionID.R63,
            name: "鼎州地区",
            terrain: TerrainType.HILLS,
            province: ProvinceID.JIANGNANLIANGLU,
            land: [RegionID.R59, RegionID.R60, RegionID.R62],
            water: [RegionID.R56, RegionID.R64],
            pass: [],
            city: null
        },

    [RegionID.R64]:
        {
            id: RegionID.R64,
            name: "荆湖南路",
            terrain: TerrainType.HILLS,
            province: ProvinceID.JIANGNANLIANGLU,
            land: [RegionID.R62, RegionID.R65, RegionID.R71],
            water: [RegionID.R60, RegionID.R63],
            pass: [],
            city: CityID.ChangSha
        },
    [RegionID.R65]:
        {
            id: RegionID.R65,
            name: "鄂州地区",
            terrain: TerrainType.HILLS,
            province: ProvinceID.JIANGNANLIANGLU,
            land: [RegionID.R64, RegionID.R68],
            water: [RegionID.R49, RegionID.R60, RegionID.R61],
            pass: [],
            city: null
        },

    [RegionID.R66]:
        {
            id: RegionID.R66,
            name: "江宁府",
            terrain: TerrainType.SWAMP,
            province: ProvinceID.LIANGZHELU,
            land: [RegionID.R72, RegionID.R73, RegionID.R74, RegionID.R67],
            water: [RegionID.R46, RegionID.R50],
            pass: [],
            city: CityID.JiangNing
        },
    [RegionID.R67]:
        {
            id: RegionID.R67,
            name: "黄山地区",
            terrain: TerrainType.HILLS,
            province: ProvinceID.LIANGZHELU,
            land: [RegionID.R66, RegionID.R70, RegionID.R74, RegionID.R76],
            water: [RegionID.R69],
            pass: [],
            city: null
        },

    [RegionID.R68]:
        {
            id: RegionID.R68,
            name: "洪洲地区",
            terrain: TerrainType.HILLS,
            province: ProvinceID.LIANGZHELU,
            land: [RegionID.R65, RegionID.R69],
            water: [RegionID.R49, RegionID.R70, RegionID.R71],
            pass: [],
            city: CityID.NanChang
        },
    [RegionID.R69]:
        {
            id: RegionID.R69,
            name: "彭蠡湖区",
            terrain: TerrainType.SWAMP,
            province: ProvinceID.LIANGZHELU,
            land: [RegionID.R68],
            water: [RegionID.R49, RegionID.R50, RegionID.R67, RegionID.R70],
            pass: [],
            city: null
        },

    [RegionID.R70]:
        {
            id: RegionID.R70,
            name: "鄱阳湖平原",
            terrain: TerrainType.FLATLAND,
            province: ProvinceID.LIANGZHELU,
            land: [RegionID.R67, RegionID.R71, RegionID.R76, RegionID.R77],
            water: [RegionID.R69],
            pass: [],
            city: null
        },

    [RegionID.R71]:
        {
            id: RegionID.R71,
            name: "江南丘陵",
            terrain: TerrainType.HILLS,
            province: ProvinceID.LIANGZHELU,
            land: [RegionID.R64, RegionID.R70, RegionID.R77],
            water: [RegionID.R68],
            pass: [],
            city: null
        },

    [RegionID.R72]:
        {
            id: RegionID.R72,
            name: "镇江府",
            terrain: TerrainType.SWAMP,
            province: ProvinceID.FUJIANLU,
            land: [RegionID.R66],
            water: [RegionID.R73],
            pass: [],
            city: CityID.DanTu
        },
    [RegionID.R73]:
        {
            id: RegionID.R73,
            name: "平江府",
            terrain: TerrainType.SWAMP,
            province: ProvinceID.FUJIANLU,
            land: [RegionID.R66, RegionID.R74],
            water: [RegionID.R72],
            pass: [],
            city: CityID.WuXian
        },
    [RegionID.R74]:
        {
            id: RegionID.R74,
            name: "临安府",
            terrain: TerrainType.HILLS,
            province: ProvinceID.FUJIANLU,
            land: [RegionID.R66, RegionID.R67, RegionID.R73, RegionID.R75, RegionID.R76],
            water: [],
            pass: [],
            city: CityID.QianTang
        },
    [RegionID.R75]:
        {
            id: RegionID.R75,
            name: "越州",
            terrain: TerrainType.HILLS,
            province: ProvinceID.FUJIANLU,
            land: [RegionID.R74, RegionID.R76],
            water: [],
            pass: [],
            city: null
        },

    [RegionID.R76]:
        {
            id: RegionID.R76,
            name: "两浙路南部",
            terrain: TerrainType.HILLS,
            province: ProvinceID.FUJIANLU,
            land: [RegionID.R67, RegionID.R70, RegionID.R74, RegionID.R75, RegionID.R76, RegionID.R77],
            water: [],
            pass: [],
            city: null
        },

    [RegionID.R77]:
        {
            id: RegionID.R77,
            name: "福建路",
            terrain: TerrainType.HILLS,
            province: ProvinceID.SHANXILIULU,
            land: [RegionID.R70, RegionID.R71, RegionID.R76],
            water: [],
            pass: [],
            city: CityID.MinXian
        },
}