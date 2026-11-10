import {Controller} from "../constant/general";

/**
 * Display catalogue for the World Map printed along the left and bottom edges
 * of the physical Virgin Queen board.  The rules data in `world.ts` deliberately
 * stays small; this catalogue only supplies positions and printed names for the
 * triangular settlement spaces shown on the map.
 */
export interface WorldMapLocation {
    id: string;
    nameEn: string;
    nameZh: string;
    /** Real longitude/latitude used by the inset projection. */
    lon: number;
    lat: number;
    /** Printed home colour on the board: Spain gold, Portugal maroon, neutral gray. */
    home?: Controller;
    /** Existing runtime settlement id whose control/colony state should drive this marker. */
    gameId?: string;
    /** Only draw when the linked runtime settlement has a control marker or colony. */
    gameOnly?: boolean;
}

export const WORLD_MAP_LOCATIONS: WorldMapLocation[] = [
    // North America / Atlantic coast
    {id: "fortCharles", nameEn: "Fort Charles", nameZh: "皇家查尔斯堡", lon: -80.7, lat: 32.4},
    {id: "montreal", nameEn: "Montreal", nameZh: "蒙特利尔", lon: -73.6, lat: 45.5},
    {id: "jamestown", nameEn: "Jamestown", nameZh: "詹姆斯敦", lon: -76.8, lat: 37.2},
    {id: "roanoke", nameEn: "Roanoke Island", nameZh: "罗阿诺克岛", lon: -75.7, lat: 35.9},
    {id: "florida", nameEn: "Florida", nameZh: "佛罗里达", lon: -81.3, lat: 29.9, gameId: "florida"},
    {id: "atlanticCoast", nameEn: "Atlantic Coast", nameZh: "大西洋沿岸", lon: -72.0, lat: 39.8,
        gameId: "atlanticCoast", gameOnly: true},

    // Caribbean / Central America
    {id: "sanJuanDeUlua", nameEn: "San Juan de Ulúa", nameZh: "圣胡安·德乌卢阿", lon: -96.1, lat: 19.2, home: "spain"},
    {id: "hispaniola", nameEn: "Hispaniola", nameZh: "伊斯帕尼奥拉", lon: -70.0, lat: 19.0, home: "spain"},
    {id: "cuba", nameEn: "Cuba", nameZh: "古巴", lon: -79.5, lat: 22.0, home: "spain"},
    {id: "puertoRico", nameEn: "Puerto Rico", nameZh: "波多黎各", lon: -66.1, lat: 18.4, home: "spain"},
    {id: "antillesColony", nameEn: "Antilles", nameZh: "安的列斯", lon: -63.0, lat: 15.8,
        gameId: "antillesColony", gameOnly: true},
    {id: "azores", nameEn: "Azores", nameZh: "亚速尔群岛", lon: -28.0, lat: 38.5, home: "portugal"},

    // Mexico / South America
    {id: "acapulco", nameEn: "Acapulco", nameZh: "阿卡普尔科", lon: -99.9, lat: 16.9, home: "spain"},
    {id: "panama", nameEn: "Nombre de Dios/Panama", nameZh: "迪奥斯港/巴拿马", lon: -79.5, lat: 9.0, home: "spain"},
    {id: "cartagena", nameEn: "Cartagena", nameZh: "卡塔赫纳", lon: -75.5, lat: 10.4, home: "spain"},
    {id: "callao", nameEn: "Callao", nameZh: "卡亚俄", lon: -77.1, lat: -12.1, home: "spain"},
    {id: "valparaiso", nameEn: "Valparaíso", nameZh: "瓦尔帕莱索", lon: -71.6, lat: -33.0, home: "spain"},
    {id: "rio", nameEn: "Rio de Janeiro", nameZh: "里约热内卢", lon: -43.2, lat: -22.9},
    {id: "laPlata", nameEn: "La Plata", nameZh: "拉普拉塔", lon: -58.4, lat: -34.6},
    {id: "imperial", nameEn: "Imperial", nameZh: "帝国镇", lon: -72.9, lat: -38.0, home: "spain"},
    {id: "salvador", nameEn: "Salvador", nameZh: "萨尔瓦多", lon: -38.5, lat: -13.0, home: "portugal"},
    {id: "southAmericaColony", nameEn: "South America", nameZh: "南美洲", lon: -54.0, lat: -8.0,
        gameId: "southAmericaColony", gameOnly: true},

    // Atlantic islands / West Africa
    {id: "canary", nameEn: "Canary Islands", nameZh: "加纳利群岛", lon: -15.4, lat: 28.1, home: "spain"},
    {id: "capeVerde", nameEn: "Cape Verde", nameZh: "佛得角群岛", lon: -23.6, lat: 15.0, home: "portugal"},
    {id: "portugueseGuinea", nameEn: "Sierra Leone", nameZh: "塞拉利昂", lon: -13.2, lat: 8.5,
        home: "portugal", gameId: "portugueseGuinea"},
    {id: "guineaCoastColony", nameEn: "Guinea Coast", nameZh: "几内亚海岸", lon: -5.0, lat: 5.0,
        gameId: "guineaCoastColony", gameOnly: true},

    // East Africa / Indian Ocean
    {id: "mombasa", nameEn: "Mombasa", nameZh: "蒙巴萨", lon: 39.7, lat: -4.0},
    {id: "zanzibar", nameEn: "Zanzibar", nameZh: "桑给巴尔", lon: 39.2, lat: -6.2, home: "portugal"},
    {id: "goa", nameEn: "Goa", nameZh: "果阿", lon: 73.8, lat: 15.5, home: "portugal"},
    {id: "ceylon", nameEn: "Ceylon", nameZh: "锡兰", lon: 80.7, lat: 7.9,
        home: "portugal", gameId: "portugueseCeylon"},
    {id: "sumatra", nameEn: "Sumatra", nameZh: "苏门答腊", lon: 99.0, lat: -1.0},
    {id: "moluccas", nameEn: "Moluccas", nameZh: "摩鹿加群岛", lon: 127.4, lat: -0.8, home: "portugal"},
    {id: "philippines", nameEn: "Philippines", nameZh: "菲律宾群岛", lon: 121.0, lat: 14.6,
        gameId: "philippines"},
    {id: "asiaColony", nameEn: "Asia", nameZh: "亚洲", lon: 108.0, lat: 7.0,
        gameId: "asiaColony", gameOnly: true},
];

export const WORLD_MAP_EXTENT = [-180, 80, 180, -60] as const;
export const WORLD_MAP_WIDTH = 360;
export const WORLD_MAP_HEIGHT = 170;

/** Projection shared by the generated Natural Earth world background and markers. */
export const projectWorld = (lon: number, lat: number): [number, number] => [
    4 + (lon - WORLD_MAP_EXTENT[0]) / (WORLD_MAP_EXTENT[2] - WORLD_MAP_EXTENT[0]) * (WORLD_MAP_WIDTH - 8),
    4 + (WORLD_MAP_EXTENT[1] - lat) / (WORLD_MAP_EXTENT[1] - WORLD_MAP_EXTENT[3]) * (WORLD_MAP_HEIGHT - 8),
];
