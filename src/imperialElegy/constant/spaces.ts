import {ConnectionDef, ConnectionType, Power, SpaceDef, SpaceId, SpaceState} from "../types";

interface Row {
  id: SpaceId;
  name: string;
  nameZh: string;
  type: SpaceDef["type"];
  region: SpaceDef["region"];
  submap: SpaceDef["submap"];
  control: SpaceDef["control"];
  home?: Power | null;
  minorHome?: string | null;
  ports?: string[];
  keyType?: SpaceDef["keyType"];
  otLandLocKeyType?: SpaceDef["otLandLocKeyType"];
  flashpoints?: string[];
  influence?: Power | null;
  nationalities?: string[];
  special?: SpaceDef["special"];
  x: number;
  y: number;
}

const R = (row: Row): SpaceDef => ({
  id: row.id,
  name: row.name,
  nameZh: row.nameZh,
  type: row.type,
  keyType: row.keyType,
  otLandLocKeyType: row.otLandLocKeyType,
  region: row.region,
  submap: row.submap,
  ports: row.ports,
  home: row.home ?? null,
  minorHome: row.minorHome ?? null,
  control: row.control,
  influence: row.influence ?? null,
  flashpoints: row.flashpoints ?? [],
  nationalities: row.nationalities,
  x: row.x,
  y: row.y,
  special: row.special,
});

/**
 * The campaign map.
 *
 * Names, colours and positions were transcribed from the module's world-map
 * zones (see data/generated/module.json) and the printed map; connections and
 * terrain were transcribed from the printed connection lines rather than
 * inferred from the coordinates.  Key/territory classification is validated
 * against the starting track totals in `spaces.test.ts`.
 *
 * `nationalities` follows the large flags printed in each space (rule 3.2.6);
 * names are the stable English labels used by the card and characteristic
 * rules (e.g. "Italians", "Czechs", "Serbians", "Poles").  Spaces without a
 * printed flag have no entry, so an empty list means "no minority nationality"
 * rather than "not yet transcribed".
 */
const ROWS: Row[] = [
  // ---------------------------------------------------------------- naval boxes
  {id: "north-atlantic", name: "North Atlantic Box", nameZh: "北大西洋海域", type: "navalBox", region: "naval", submap: "naval", control: null, x: 800, y: 1026},
  {id: "south-atlantic", name: "South Atlantic Box", nameZh: "南大西洋海域", type: "navalBox", region: "naval", submap: "naval", control: null, x: 782, y: 4509},
  {id: "baltic-sea", name: "Baltic Sea Box", nameZh: "波罗的海海域", type: "navalBox", region: "naval", submap: "naval", control: null, x: 2777, y: 749},
  {id: "western-mediterranean", name: "Western Mediterranean Box", nameZh: "西地中海海域", type: "navalBox", region: "naval", submap: "naval", control: null, x: 1520, y: 3076},
  {id: "eastern-mediterranean", name: "Eastern Mediterranean Box", nameZh: "东地中海海域", type: "navalBox", region: "naval", submap: "naval", control: null, x: 3613, y: 3798},
  {id: "black-sea", name: "Black Sea Box", nameZh: "黑海海域", type: "navalBox", region: "naval", submap: "naval", control: null, x: 4122, y: 2660},
  {id: "indian-ocean", name: "Indian Ocean Box", nameZh: "印度洋海域", type: "navalBox", region: "naval", submap: "naval", control: null, x: 5765, y: 2190},
  {id: "pacific-ocean", name: "Pacific Ocean Box", nameZh: "太平洋海域", type: "navalBox", region: "naval", submap: "naval", control: null, x: 6486, y: 2622},
  {id: "south-central-pacific", name: "South & Central Pacific Ocean Box", nameZh: "南太平洋与中太平洋海域", type: "navalBox", region: "naval", submap: "naval", control: null, x: 6780, y: 3018},

  // ---------------------------------------------------------------- British Isles
  {id: "scotland", name: "Scotland", nameZh: "苏格兰", type: "key", region: "europe", submap: "main", control: "UK", home: "UK", ports: ["north-atlantic"], keyType: "territorial", nationalities: ["Scots"], x: 1525, y: 1035},
  {id: "ireland", name: "Ireland", nameZh: "爱尔兰", type: "key", region: "europe", submap: "main", control: "UK", home: "UK", ports: ["north-atlantic"], keyType: "territorial", nationalities: ["Irish"], x: 1150, y: 1310},
  {id: "northern-england", name: "Northern England", nameZh: "英格兰北部", type: "key", region: "europe", submap: "main", control: "UK", home: "UK", ports: ["north-atlantic"], keyType: "territorial", x: 1568, y: 1285},
  {id: "wales", name: "Wales", nameZh: "威尔士", type: "key", region: "europe", submap: "main", control: "UK", home: "UK", ports: ["north-atlantic"], keyType: "territorial", nationalities: ["Welsh"], x: 1324, y: 1503},
  {id: "london", name: "London", nameZh: "伦敦", type: "capital", region: "europe", submap: "main", control: "UK", home: "UK", ports: ["north-atlantic"], keyType: "territorial", x: 1576, y: 1568},

  // ---------------------------------------------------------------- North America
  {id: "canada", name: "Canada", nameZh: "加拿大", type: "key", region: "northAmerica", submap: "northAmerica", control: "UK", home: "UK", ports: ["north-atlantic"], keyType: "colonial", x: 806, y: 2070},
  {id: "the-south", name: "The South", nameZh: "南方", type: "key", region: "northAmerica", submap: "northAmerica", control: "United States", minorHome: "United States", ports: ["north-atlantic"], keyType: "colonial", x: 830, y: 2376},
  {id: "mexico", name: "Mexico", nameZh: "墨西哥", type: "key", region: "northAmerica", submap: "northAmerica", control: "Mexico", minorHome: "Mexico", ports: ["north-atlantic"], keyType: "colonial", x: 720, y: 2616},

  // ---------------------------------------------------------------- Iberia / Mediterranean
  {id: "gibraltar", name: "Gibraltar", nameZh: "直布罗陀", type: "navalBase", region: "europe", submap: "main", control: "UK", home: "UK", ports: ["north-atlantic", "western-mediterranean"], x: 782, y: 3200},
  {id: "malta", name: "Malta", nameZh: "马耳他", type: "navalBase", region: "europe", submap: "main", control: "UK", home: "UK", ports: ["western-mediterranean"], x: 2655, y: 3459},

  // ---------------------------------------------------------------- colonies
  {id: "south-africa", name: "South Africa", nameZh: "南非", type: "key", region: "africa", submap: "africa", control: "UK", home: "UK", ports: ["south-atlantic", "indian-ocean"], keyType: "colonial", x: 1329, y: 4702},
  {id: "india", name: "India", nameZh: "印度", type: "key", region: "asia", submap: "asia", control: "UK", home: "UK", ports: ["indian-ocean"], keyType: "colonial", x: 5832, y: 1812},
  {id: "bengal", name: "Bengal", nameZh: "孟加拉", type: "key", region: "asia", submap: "asia", control: "UK", home: "UK", ports: ["indian-ocean"], keyType: "colonial", x: 6111, y: 1709},
  {id: "singapore", name: "Singapore", nameZh: "新加坡", type: "key", region: "asia", submap: "asia", control: "UK", home: "UK", ports: ["indian-ocean", "pacific-ocean"], keyType: "colonial", x: 6509, y: 2243},
  {id: "australia-new-zealand", name: "Australia & New Zealand", nameZh: "澳大利亚与新西兰", type: "key", region: "asia", submap: "asia", control: "UK", home: "UK", ports: ["pacific-ocean", "south-central-pacific"], keyType: "colonial", x: 6906, y: 2393},
  {id: "hong-kong", name: "Hong Kong", nameZh: "香港", type: "territory", region: "asia", submap: "asia", control: "UK", home: "UK", ports: ["pacific-ocean"], x: 6690, y: 1800},

  // ---------------------------------------------------------------- Low Countries & Germany
  {id: "belgium", name: "Belgium", nameZh: "比利时", type: "key", region: "europe", submap: "main", control: "Belgium", minorHome: "Belgium", ports: ["north-atlantic"], flashpoints: ["lowCountries"], x: 1778, y: 1730},
  {id: "netherlands", name: "Netherlands", nameZh: "荷兰", type: "key", region: "europe", submap: "main", control: "Netherlands", minorHome: "Netherlands", ports: ["north-atlantic"], flashpoints: ["lowCountries"], x: 1972, y: 1552},
  {id: "hanover", name: "Hanover", nameZh: "汉诺威", type: "key", region: "europe", submap: "main", control: "Hanover", minorHome: "Hanover", flashpoints: ["germany"], nationalities: ["Germans"], x: 2214, y: 1550},
  {id: "saxony", name: "Saxony", nameZh: "萨克森", type: "key", region: "europe", submap: "main", control: "Saxony", minorHome: "Saxony", flashpoints: ["germany"], nationalities: ["Germans"], x: 2488, y: 1716},
  {id: "westphalia", name: "Westphalia", nameZh: "威斯特法伦", type: "key", region: "europe", submap: "main", control: "GE", home: "GE", keyType: "territorial", nationalities: ["Germans"], x: 2163, y: 1764},
  {id: "berlin", name: "Berlin", nameZh: "柏林", type: "capital", region: "europe", submap: "main", control: "GE", home: "GE", keyType: "territorial", nationalities: ["Germans"], x: 2578, y: 1515},
  {id: "bavaria", name: "Bavaria", nameZh: "巴伐利亚", type: "key", region: "europe", submap: "main", control: "Bavaria", minorHome: "Bavaria", flashpoints: ["germany"], nationalities: ["Germans"], x: 2410, y: 1928},
  {id: "silesia", name: "Silesia", nameZh: "西里西亚", type: "key", region: "europe", submap: "main", control: "GE", home: "GE", keyType: "territorial", flashpoints: ["germany", "centralEurope"], nationalities: ["Germans"], x: 2837, y: 1743},
  {id: "pomerania", name: "Pomerania", nameZh: "波美拉尼亚", type: "key", region: "europe", submap: "main", control: "GE", home: "GE", ports: ["baltic-sea"], keyType: "territorial", nationalities: ["Germans"], x: 2869, y: 1513},
  {id: "prussia", name: "Prussia", nameZh: "普鲁士", type: "key", region: "europe", submap: "main", control: "GE", home: "GE", ports: ["baltic-sea"], keyType: "territorial", nationalities: ["Germans"], x: 3103, y: 1406},

  // ---------------------------------------------------------------- France
  {id: "brittany", name: "Brittany", nameZh: "布列塔尼", type: "key", region: "europe", submap: "main", control: "FR", home: "FR", ports: ["north-atlantic"], keyType: "territorial", x: 1226, y: 1882},
  {id: "picardy", name: "Picardy", nameZh: "皮卡第", type: "key", region: "europe", submap: "main", control: "FR", home: "FR", ports: ["north-atlantic"], keyType: "territorial", x: 1539, y: 1836},
  {id: "champagne", name: "Champagne", nameZh: "香槟", type: "key", region: "europe", submap: "main", control: "FR", home: "FR", keyType: "territorial", x: 1825, y: 1954},
  {id: "paris", name: "Paris", nameZh: "巴黎", type: "capital", region: "europe", submap: "main", control: "FR", home: "FR", keyType: "territorial", x: 1566, y: 2118},
  {id: "aquitaine", name: "Aquitaine", nameZh: "阿基坦", type: "key", region: "europe", submap: "main", control: "FR", home: "FR", ports: ["north-atlantic"], keyType: "territorial", x: 1276, y: 2225},
  {id: "auvergne", name: "Auvergne", nameZh: "奥弗涅", type: "key", region: "europe", submap: "main", control: "FR", home: "FR", keyType: "territorial", x: 1608, y: 2360},
  {id: "burgundy", name: "Burgundy", nameZh: "勃艮第", type: "key", region: "europe", submap: "main", control: "FR", home: "FR", keyType: "territorial", x: 1843, y: 2225},
  {id: "provence", name: "Provence", nameZh: "普罗旺斯", type: "key", region: "europe", submap: "main", control: "FR", home: "FR", ports: ["western-mediterranean"], keyType: "territorial", x: 1652, y: 2622},
  {id: "alsace-lorraine", name: "Alsace-Lorraine", nameZh: "阿尔萨斯-洛林", type: "key", region: "europe", submap: "main", control: "FR", home: "FR", keyType: "territorial", nationalities: ["French", "Germans"], x: 2076, y: 2027},

  // ---------------------------------------------------------------- Italy
  {id: "piedmont", name: "Piedmont", nameZh: "皮埃蒙特", type: "key", region: "europe", submap: "main", control: "Sardinia-Piedmont", minorHome: "Sardinia-Piedmont", ports: ["western-mediterranean"], flashpoints: ["italy"], nationalities: ["Italians"], x: 1981, y: 2484},
  {id: "lombardy", name: "Lombardy", nameZh: "伦巴第", type: "key", region: "europe", submap: "main", control: "AU", home: "AU", keyType: "territorial", flashpoints: ["italy"], nationalities: ["Italians"], x: 2302, y: 2450},
  {id: "tuscany", name: "Tuscany", nameZh: "托斯卡纳", type: "key", region: "europe", submap: "main", control: "Tuscany", minorHome: "Tuscany", ports: ["western-mediterranean"], flashpoints: ["italy"], nationalities: ["Italians"], x: 2211, y: 2695},
  // Rome is the printed Papal States capital: the star-shaped space between
  // Tuscany and Naples, carrying the Papal flag and the Italian unification
  // symbol in its lower-right corner (3.2.2, 3.2.6.1).  Its x/y is the centre
  // of the printed star; the VASSAL module has no Main Map zone for it, so it
  // is listed in `SPACES_WITHOUT_ZONE` rather than matched against a zone.
  {id: "rome", name: "Rome", nameZh: "罗马", type: "capital", region: "europe", submap: "main", control: "Papal States", minorHome: "Papal States", keyType: "territorial", flashpoints: ["italy"], nationalities: ["Italians"], x: 2312, y: 2905},
  {id: "naples", name: "Naples", nameZh: "那不勒斯", type: "key", region: "europe", submap: "main", control: "Two Sicilies", minorHome: "Two Sicilies", ports: ["western-mediterranean"], flashpoints: ["italy"], nationalities: ["Italians"], x: 2516, y: 3082},

  // ---------------------------------------------------------------- Austria-Hungary
  {id: "tyrol", name: "Tyrol", nameZh: "蒂罗尔", type: "key", region: "europe", submap: "main", control: "AU", home: "AU", keyType: "territorial", nationalities: ["Italians"], x: 2296, y: 2196},
  {id: "bohemia", name: "Bohemia", nameZh: "波希米亚", type: "key", region: "europe", submap: "main", control: "AU", home: "AU", keyType: "territorial", flashpoints: ["centralEurope"], nationalities: ["Czechs"], x: 2717, y: 1970},
  {id: "vienna", name: "Vienna", nameZh: "维也纳", type: "capital", region: "europe", submap: "main", control: "AU", home: "AU", keyType: "territorial", x: 2606, y: 2242},
  {id: "croatia", name: "Croatia", nameZh: "克罗地亚", type: "key", region: "europe", submap: "main", control: "AU", home: "AU", ports: ["western-mediterranean"], keyType: "territorial", nationalities: ["Croats"], x: 2534, y: 2562},
  {id: "banat", name: "Banat", nameZh: "巴纳特", type: "key", region: "europe", submap: "main", control: "AU", home: "AU", keyType: "territorial", nationalities: ["Hungarians", "Serbians", "Romanians"], x: 2922, y: 2480},
  {id: "hungary", name: "Hungary", nameZh: "匈牙利", type: "key", region: "europe", submap: "main", control: "AU", home: "AU", keyType: "territorial", nationalities: ["Hungarians"], x: 2998, y: 2190},
  {id: "transylvania", name: "Transylvania", nameZh: "特兰西瓦尼亚", type: "key", region: "europe", submap: "main", control: "AU", home: "AU", keyType: "territorial", nationalities: ["Hungarians", "Romanians"], x: 3316, y: 2300},
  {id: "galicia", name: "Galicia", nameZh: "加利西亚", type: "key", region: "europe", submap: "main", control: "AU", home: "AU", keyType: "territorial", flashpoints: ["centralEurope"], nationalities: ["Poles", "Ukrainians"], x: 3204, y: 1920},

  // ---------------------------------------------------------------- Balkans
  {id: "romania", name: "Romania", nameZh: "罗马尼亚", type: "key", region: "europe", submap: "main", control: "Romania", minorHome: "Romania", ports: ["black-sea"], flashpoints: ["balkans"], nationalities: ["Romanians"], x: 3498, y: 2520},
  {id: "greece", name: "Greece", nameZh: "希腊", type: "key", region: "europe", submap: "main", control: "Greece", minorHome: "Greece", ports: ["eastern-mediterranean"], flashpoints: ["balkans"], nationalities: ["Greeks"], x: 3175, y: 3417},
  {id: "bosnia-herzegovina", name: "Bosnia-Herzegovina", nameZh: "波斯尼亚-黑塞哥维那", type: "key", region: "europe", submap: "main", control: "OT", home: "OT", flashpoints: ["balkans"], nationalities: ["Bosnians", "Serbians", "Croats"], x: 2789, y: 2731},
  {id: "serbia", name: "Serbia", nameZh: "塞尔维亚", type: "key", region: "europe", submap: "main", control: "OT", home: "OT", flashpoints: ["balkans"], nationalities: ["Serbians"], x: 3090, y: 2700},
  {id: "bulgaria", name: "Bulgaria", nameZh: "保加利亚", type: "key", region: "europe", submap: "main", control: "OT", home: "OT", flashpoints: ["balkans"], nationalities: ["Bulgarians"], x: 3328, y: 2762},
  {id: "macedonia", name: "Macedonia", nameZh: "马其顿", type: "key", region: "europe", submap: "main", control: "OT", home: "OT", flashpoints: ["balkans"], nationalities: ["Macedonians", "Bulgarians"], x: 3186, y: 3060},

  // ---------------------------------------------------------------- Anatolia & Middle East
  {id: "istanbul", name: "Istanbul", nameZh: "伊斯坦布尔", type: "capital", region: "europe", submap: "main", control: "OT", home: "OT", ports: ["eastern-mediterranean", "black-sea"], keyType: "territorial", special: "istanbul", flashpoints: ["balkans"], x: 3662, y: 2876},
  {id: "dardanelles", name: "Dardanelles", nameZh: "达达尼尔海峡", type: "territory", region: "europe", submap: "main", control: "OT", home: "OT", ports: ["eastern-mediterranean", "black-sea"], special: "dardanelles", x: 3458, y: 3092},
  {id: "izmir", name: "Izmir", nameZh: "伊兹密尔", type: "key", region: "europe", submap: "main", control: "OT", home: "OT", ports: ["eastern-mediterranean"], keyType: "territorial", x: 3619, y: 3290},
  {id: "rhodes", name: "Rhodes", nameZh: "罗得岛", type: "navalBase", region: "europe", submap: "main", control: "OT", home: "OT", ports: ["eastern-mediterranean"], x: 3673, y: 3560},
  {id: "cyprus", name: "Cyprus", nameZh: "塞浦路斯", type: "key", region: "europe", submap: "main", control: "OT", home: "OT", ports: ["eastern-mediterranean"], x: 4218, y: 3565},
  {id: "ankara", name: "Ankara", nameZh: "安卡拉", type: "subcapital", region: "europe", submap: "main", control: "OT", home: "OT", keyType: "territorial", x: 4146, y: 2928},
  {id: "antalya", name: "Antalya", nameZh: "安塔利亚", type: "key", region: "europe", submap: "main", control: "OT", home: "OT", ports: ["eastern-mediterranean"], keyType: "territorial", x: 4172, y: 3196},
  {id: "syria", name: "Syria", nameZh: "叙利亚", type: "key", region: "europe", submap: "main", control: "OT", home: "OT", ports: ["eastern-mediterranean"], keyType: "territorial", nationalities: ["Syrians", "Arabs"], x: 4401, y: 3360},
  {id: "palestine", name: "Palestine", nameZh: "巴勒斯坦", type: "key", region: "europe", submap: "main", control: "OT", home: "OT", ports: ["eastern-mediterranean"], nationalities: ["Palestinians", "Arabs"], x: 4545, y: 3672},
  {id: "arabia", name: "Arabia", nameZh: "阿拉伯", type: "key", region: "europe", submap: "main", control: "OT", home: "OT", ports: ["indian-ocean"], keyType: "territorial", nationalities: ["Arabs"], x: 4729, y: 4052},
  {id: "mecca", name: "Mecca", nameZh: "麦加", type: "key", region: "europe", submap: "main", control: "OT", home: "OT", ports: ["indian-ocean"], keyType: "territorial", nationalities: ["Arabs"], x: 4971, y: 4520},
  {id: "sinai", name: "Sinai", nameZh: "西奈", type: "territory", region: "africa", submap: "main", control: "OT", home: "OT", minorHome: "Egypt", ports: ["indian-ocean"], special: "egypt", nationalities: ["Arabs", "Egyptians"], x: 4446, y: 3996},
  {id: "egypt", name: "Egypt", nameZh: "埃及", type: "key", region: "africa", submap: "main", control: "OT", home: "OT", minorHome: "Egypt", ports: ["western-mediterranean", "indian-ocean"], keyType: "territorial", special: "egypt", flashpoints: ["africa"], nationalities: ["Egyptians", "Arabs"], x: 4155, y: 3976},
  {id: "great-sand-sea", name: "Great Sand Sea", nameZh: "大沙海", type: "territory", region: "africa", submap: "main", control: "OT", home: "OT", minorHome: "Egypt", special: "egypt", nationalities: ["Arabs", "Egyptians"], x: 3676, y: 4098},
  {id: "benghazi", name: "Benghazi", nameZh: "班加西", type: "territory", region: "africa", submap: "main", control: "OT", home: "OT", ports: ["western-mediterranean"], special: "tripoli", x: 3142, y: 3950},
  {id: "tripoli", name: "Tripoli", nameZh: "的黎波里", type: "key", region: "africa", submap: "main", control: "OT", home: "OT", ports: ["western-mediterranean"], special: "tripoli", otLandLocKeyType: "territorial", flashpoints: ["africa"], x: 2551, y: 3924},
  {id: "tunisia", name: "Tunisia", nameZh: "突尼斯", type: "key", region: "africa", submap: "main", control: "OT", home: "OT", ports: ["western-mediterranean"], otLandLocKeyType: "territorial", flashpoints: ["africa"], x: 2043, y: 3430},
  {id: "erzurum", name: "Erzurum", nameZh: "埃尔祖鲁姆", type: "key", region: "europe", submap: "main", control: "OT", home: "OT", keyType: "territorial", nationalities: ["Armenians"], x: 4522, y: 2822},
  {id: "kayseri", name: "Kayseri", nameZh: "开塞利", type: "key", region: "europe", submap: "main", control: "OT", home: "OT", keyType: "territorial", nationalities: ["Armenians"], x: 4628, y: 3144},
  {id: "van", name: "Van", nameZh: "凡城", type: "key", region: "europe", submap: "main", control: "OT", home: "OT", keyType: "territorial", nationalities: ["Armenians"], x: 4924, y: 2909},
  {id: "mosul", name: "Mosul", nameZh: "摩苏尔", type: "key", region: "europe", submap: "main", control: "OT", home: "OT", keyType: "territorial", nationalities: ["Arabs"], x: 5001, y: 3202},
  {id: "baghdad", name: "Baghdad", nameZh: "巴格达", type: "key", region: "europe", submap: "main", control: "OT", home: "OT", ports: ["indian-ocean"], keyType: "territorial", nationalities: ["Arabs"], x: 5274, y: 3429},
  {id: "kuwait", name: "Kuwait", nameZh: "科威特", type: "key", region: "europe", submap: "main", control: "OT", home: "OT", ports: ["indian-ocean"], keyType: "territorial", flashpoints: ["greatGame"], x: 5594, y: 3738},

  // ---------------------------------------------------------------- Russia
  {id: "poland", name: "Poland", nameZh: "波兰", type: "key", region: "europe", submap: "main", control: "RU", home: "RU", keyType: "territorial", flashpoints: ["centralEurope"], nationalities: ["Poles"], x: 3103, y: 1642},
  {id: "west-ukraine", name: "West Ukraine", nameZh: "西乌克兰", type: "key", region: "europe", submap: "main", control: "RU", home: "RU", keyType: "territorial", flashpoints: ["centralEurope"], nationalities: ["Ukrainians", "Poles"], x: 3484, y: 1878},
  {id: "belorussia", name: "Belorussia", nameZh: "白俄罗斯", type: "key", region: "europe", submap: "main", control: "RU", home: "RU", keyType: "territorial", flashpoints: ["centralEurope"], nationalities: ["Belarusians", "Poles"], x: 3387, y: 1467},
  {id: "riga", name: "Riga", nameZh: "里加", type: "key", region: "europe", submap: "main", control: "RU", home: "RU", ports: ["baltic-sea"], keyType: "territorial", x: 3159, y: 1142},
  {id: "baltic-states", name: "Baltic States", nameZh: "波罗的海诸省", type: "key", region: "europe", submap: "main", control: "RU", home: "RU", ports: ["baltic-sea"], keyType: "territorial", nationalities: ["Latvians", "Lithuanians", "Estonians"], x: 3390, y: 964},
  {id: "finland", name: "Finland", nameZh: "芬兰", type: "key", region: "europe", submap: "main", control: "RU", home: "RU", ports: ["baltic-sea"], keyType: "territorial", nationalities: ["Finns"], x: 3256, y: 732},
  {id: "st-petersburg", name: "St. Petersburg", nameZh: "圣彼得堡", type: "capital", region: "europe", submap: "main", control: "RU", home: "RU", ports: ["baltic-sea"], keyType: "territorial", x: 3668, y: 794},
  {id: "novgorod", name: "Novgorod", nameZh: "诺夫哥罗德", type: "territory", region: "europe", submap: "main", control: "RU", home: "RU", x: 3663, y: 1188},
  {id: "northern-russia", name: "Northern Russia", nameZh: "俄罗斯北部", type: "territory", region: "europe", submap: "main", control: "RU", home: "RU", x: 3921, y: 1008},
  {id: "moscow", name: "Moscow", nameZh: "莫斯科", type: "subcapital", region: "europe", submap: "main", control: "RU", home: "RU", keyType: "territorial", x: 4173, y: 1152},
  {id: "smolensk", name: "Smolensk", nameZh: "斯摩棱斯克", type: "key", region: "europe", submap: "main", control: "RU", home: "RU", keyType: "territorial", x: 3674, y: 1434},
  {id: "orel", name: "Orel", nameZh: "奥廖尔", type: "territory", region: "europe", submap: "main", control: "RU", home: "RU", x: 4047, y: 1455},
  {id: "kiev", name: "Kiev", nameZh: "基辅", type: "key", region: "europe", submap: "main", control: "RU", home: "RU", keyType: "territorial", x: 3755, y: 1836},
  {id: "kharkov", name: "Kharkov", nameZh: "哈尔科夫", type: "territory", region: "europe", submap: "main", control: "RU", home: "RU", x: 4121, y: 1824},
  {id: "southern-ukraine", name: "Southern Ukraine", nameZh: "南乌克兰", type: "territory", region: "europe", submap: "main", control: "RU", home: "RU", ports: ["black-sea"], x: 4006, y: 2148},
  {id: "don", name: "Don", nameZh: "顿河", type: "territory", region: "europe", submap: "main", control: "RU", home: "RU", x: 4429, y: 1957},
  {id: "bessarabia", name: "Bessarabia", nameZh: "比萨拉比亚", type: "territory", region: "europe", submap: "main", control: "RU", home: "RU", ports: ["black-sea"], x: 3656, y: 2180},
  {id: "sevastopol", name: "Sevastopol", nameZh: "塞瓦斯托波尔", type: "key", region: "europe", submap: "main", control: "RU", home: "RU", ports: ["black-sea"], keyType: "territorial", x: 4054, y: 2440},
  {id: "tsaritsyn", name: "Tsaritsyn", nameZh: "察里津", type: "territory", region: "europe", submap: "main", control: "RU", home: "RU", x: 4738, y: 1756},
  {id: "astrakhan", name: "Astrakhan", nameZh: "阿斯特拉罕", type: "territory", region: "europe", submap: "main", control: "RU", home: "RU", x: 4981, y: 2016},
  {id: "caucasus", name: "Caucasus", nameZh: "高加索", type: "territory", region: "europe", submap: "main", control: "RU", home: "RU", ports: ["black-sea"], x: 4573, y: 2246},
  {id: "dagestan", name: "Dagestan", nameZh: "达吉斯坦", type: "territory", region: "europe", submap: "main", control: "RU", home: "RU", x: 5029, y: 2299},
  {id: "georgia", name: "Georgia", nameZh: "格鲁吉亚", type: "territory", region: "europe", submap: "main", control: "RU", home: "RU", x: 4690, y: 2512},
  {id: "azerbaijan", name: "Azerbaijan", nameZh: "阿塞拜疆", type: "territory", region: "europe", submap: "main", control: "RU", home: "RU", x: 5014, y: 2584},
  {id: "baku", name: "Baku", nameZh: "巴库", type: "territory", region: "europe", submap: "main", control: "RU", home: "RU", x: 5322, y: 2776},
  {id: "urals", name: "Urals", nameZh: "乌拉尔", type: "territory", region: "europe", submap: "main", control: "RU", home: "RU", x: 5494, y: 742},
  {id: "siberia", name: "Siberia", nameZh: "西伯利亚", type: "territory", region: "asia", submap: "main", control: "RU", home: "RU", x: 5973, y: 728},
  {id: "russian-far-east", name: "Russian Far East", nameZh: "俄罗斯远东", type: "key", region: "asia", submap: "main", control: "RU", home: "RU", ports: ["pacific-ocean"], keyType: "territorial", x: 6832, y: 744},

  // ---------------------------------------------------------------- Great Game / Asia
  {id: "central-asia", name: "Central Asia", nameZh: "中亚", type: "key", region: "asia", submap: "main", control: null, flashpoints: ["greatGame"], x: 5574, y: 1049},
  {id: "afghanistan", name: "Afghanistan", nameZh: "阿富汗", type: "key", region: "asia", submap: "main", control: null, flashpoints: ["greatGame"], x: 5682, y: 1335},
  {id: "balochistan", name: "Balochistan", nameZh: "俾路支斯坦", type: "key", region: "asia", submap: "main", control: null, flashpoints: ["greatGame"], x: 5545, y: 1642},
  {id: "qajar-persia", name: "Qajar Persia", nameZh: "卡扎尔波斯", type: "key", region: "asia", submap: "main", control: "Persia", minorHome: "Persia", flashpoints: ["greatGame"], x: 5259, y: 1416},
  {id: "oman", name: "Oman", nameZh: "阿曼", type: "key", region: "asia", submap: "main", control: null, ports: ["indian-ocean"], x: 5342, y: 1702},
  {id: "aden", name: "Aden", nameZh: "亚丁", type: "territory", region: "asia", submap: "main", control: null, ports: ["indian-ocean"], x: 5296, y: 1958},
  {id: "manchuria", name: "Manchuria", nameZh: "满洲", type: "key", region: "asia", submap: "main", control: "Qing China", minorHome: "Qing China", flashpoints: ["chinaJapan"], x: 6494, y: 1076},
  {id: "korea", name: "Korea", nameZh: "朝鲜", type: "key", region: "asia", submap: "main", control: "Korea", minorHome: "Korea", flashpoints: ["chinaJapan"], x: 6758, y: 974},
  {id: "japan", name: "Japan", nameZh: "日本", type: "key", region: "asia", submap: "main", control: "Japan", minorHome: "Japan", ports: ["pacific-ocean"], flashpoints: ["chinaJapan"], x: 6982, y: 1056},
  {id: "shanghai", name: "Shanghai", nameZh: "上海", type: "key", region: "asia", submap: "main", control: "Qing China", minorHome: "Qing China", ports: ["pacific-ocean"], flashpoints: ["chinaJapan"], x: 6648, y: 1540},
  {id: "shandong-peninsula", name: "Shandong Peninsula", nameZh: "山东半岛", type: "key", region: "asia", submap: "main", control: "Qing China", minorHome: "Qing China", flashpoints: ["chinaJapan"], x: 6768, y: 1313},
  {id: "guangzhou", name: "Guangzhou", nameZh: "广州", type: "key", region: "asia", submap: "main", control: "Qing China", minorHome: "Qing China", ports: ["pacific-ocean"], flashpoints: ["chinaJapan"], x: 6434, y: 1672},
  {id: "indochina", name: "Indochina", nameZh: "印度支那", type: "key", region: "asia", submap: "main", control: null, ports: ["indian-ocean"], flashpoints: ["chinaJapan"], x: 6483, y: 1956},
  {id: "caroline-islands", name: "Caroline Islands", nameZh: "加罗林群岛", type: "territory", region: "pacific", submap: "asia", control: null, ports: ["pacific-ocean"], x: 6958, y: 1758},
  {id: "new-guinea", name: "New Guinea", nameZh: "新几内亚", type: "territory", region: "pacific", submap: "asia", control: null, ports: ["pacific-ocean", "south-central-pacific"], x: 6927, y: 2123},

  // ---------------------------------------------------------------- Scandinavia
  {id: "denmark", name: "Denmark", nameZh: "丹麦", type: "key", region: "europe", submap: "main", control: "Denmark", minorHome: "Denmark", ports: ["north-atlantic", "baltic-sea"], special: "denmark", x: 2334, y: 1082},
  {id: "schleswig-holstein", name: "Schleswig-Holstein", nameZh: "石勒苏益格-荷尔斯泰因", type: "key", region: "europe", submap: "main", control: "Denmark", minorHome: "Denmark", ports: ["baltic-sea"], flashpoints: ["germany"], nationalities: ["Danes", "Germans"], x: 2260, y: 1306},

  // ---------------------------------------------------------------- Africa submap
  {id: "morocco", name: "Morocco", nameZh: "摩洛哥", type: "key", region: "africa", submap: "africa", control: "Morocco", minorHome: "Morocco", ports: ["western-mediterranean", "south-atlantic"], flashpoints: ["africa"], x: 700, y: 3360},
  {id: "algeria", name: "Algeria", nameZh: "阿尔及利亚", type: "territory", region: "africa", submap: "main", control: "FR", home: "FR", ports: ["western-mediterranean"], flashpoints: ["africa"], x: 1458, y: 3324},
  {id: "west-africa", name: "West Africa", nameZh: "西非", type: "territory", region: "africa", submap: "main", control: null, influence: "FR", ports: ["south-atlantic"], flashpoints: ["africa"], x: 717, y: 3848},
  {id: "nigeria", name: "Nigeria", nameZh: "尼日利亚", type: "key", region: "africa", submap: "africa", control: null, ports: ["south-atlantic"], flashpoints: ["africa"], x: 760, y: 4060},
  {id: "cameroon", name: "Cameroon", nameZh: "喀麦隆", type: "key", region: "africa", submap: "africa", control: null, ports: ["south-atlantic"], flashpoints: ["africa"], x: 950, y: 4140},
  {id: "west-congo", name: "West Congo", nameZh: "西刚果", type: "key", region: "africa", submap: "africa", control: null, ports: ["south-atlantic"], flashpoints: ["africa"], x: 1050, y: 4380},
  {id: "central-congo", name: "Central Congo", nameZh: "中刚果", type: "key", region: "africa", submap: "africa", control: null, flashpoints: ["africa"], x: 1320, y: 4230},
  {id: "east-africa", name: "East Africa", nameZh: "东非", type: "key", region: "africa", submap: "africa", control: null, ports: ["indian-ocean"], flashpoints: ["africa"], x: 1620, y: 4300},
  {id: "somalia", name: "Somalia", nameZh: "索马里", type: "key", region: "africa", submap: "africa", control: null, ports: ["indian-ocean"], flashpoints: ["africa"], x: 1790, y: 4040},
  {id: "ethiopia", name: "Ethiopia", nameZh: "埃塞俄比亚", type: "key", region: "africa", submap: "africa", control: "Ethiopia", minorHome: "Ethiopia", flashpoints: ["africa"], x: 1598, y: 4044},
  {id: "sudan", name: "Sudan", nameZh: "苏丹", type: "key", region: "africa", submap: "africa", control: null, flashpoints: ["africa"], x: 1400, y: 3840},
  {id: "southwest-africa", name: "Southwest Africa", nameZh: "西南非洲", type: "key", region: "africa", submap: "africa", control: null, ports: ["south-atlantic"], flashpoints: ["africa"], x: 1120, y: 4660},
  {id: "rhodesia", name: "Rhodesia", nameZh: "罗得西亚", type: "key", region: "africa", submap: "africa", control: null, flashpoints: ["africa"], x: 1440, y: 4620},
  {id: "madagascar", name: "Madagascar", nameZh: "马达加斯加", type: "key", region: "africa", submap: "africa", control: null, ports: ["indian-ocean"], flashpoints: ["africa"], x: 1820, y: 4760},
];

export const SPACES: Record<SpaceId, SpaceDef> = Object.fromEntries(ROWS.map((row) => [row.id, R(row)]));

/**
 * 33.5 Trans-Siberian Railroad: the main-map spaces joined by the printed
 * railroad (`connections` with `type: "tsrr"`) plus Siberia, which the line
 * reaches at the edge of the map.  The RU characteristic lets one army rail
 * between these spaces per impulse.
 */
export const TSRR_ROUTE: readonly SpaceId[] = ["moscow", "tsaritsyn", "urals", "siberia"];

export const SPACE_IDS = ROWS.map((r) => r.id);

export const NAVAL_BOXES = SPACE_IDS.filter((id) => SPACES[id].type === "navalBox");

export const isNavalBox = (id: SpaceId): boolean => SPACES[id]?.type === "navalBox";

/** Undirected printed connections.  Default is a clear land connection. */
const CONNECTION_ROWS: [SpaceId, SpaceId, ConnectionType?][] = [
  // British Isles
  ["scotland", "ireland"],
  ["scotland", "northern-england"],
  ["ireland", "wales"],
  ["northern-england", "wales"],
  ["northern-england", "london"],
  ["wales", "london"],
  ["london", "belgium"],
  ["london", "netherlands"],

  // North America
  ["canada", "the-south"],
  ["the-south", "mexico"],
  ["canada", "north-atlantic", "sea"],
  ["the-south", "north-atlantic", "sea"],
  ["mexico", "north-atlantic", "sea"],

  // France
  ["brittany", "picardy"],
  ["brittany", "paris"],
  ["brittany", "aquitaine"],
  ["picardy", "paris"],
  ["picardy", "champagne"],
  ["picardy", "belgium"],
  ["champagne", "paris"],
  ["champagne", "burgundy"],
  ["champagne", "alsace-lorraine"],
  ["paris", "burgundy"],
  ["paris", "aquitaine"],
  ["aquitaine", "auvergne"],
  ["auvergne", "burgundy"],
  ["auvergne", "provence"],
  ["burgundy", "provence"],
  ["burgundy", "alsace-lorraine"],
  ["alsace-lorraine", "bavaria"],
  ["alsace-lorraine", "westphalia"],
  ["provence", "piedmont", "difficult"],
  ["brittany", "north-atlantic", "sea"],
  ["picardy", "north-atlantic", "sea"],
  ["aquitaine", "north-atlantic", "sea"],
  ["provence", "western-mediterranean", "sea"],

  // Low Countries & Germany
  ["belgium", "netherlands"],
  ["belgium", "westphalia"],
  ["netherlands", "hanover"],
  ["netherlands", "westphalia"],
  ["hanover", "westphalia"],
  ["hanover", "saxony"],
  ["hanover", "berlin"],
  ["hanover", "schleswig-holstein"],
  ["westphalia", "saxony"],
  ["westphalia", "bavaria"],
  ["saxony", "berlin"],
  ["saxony", "bavaria"],
  ["saxony", "silesia"],
  ["saxony", "bohemia"],
  ["berlin", "pomerania"],
  ["berlin", "prussia"],
  ["berlin", "schleswig-holstein"],
  ["pomerania", "prussia"],
  ["pomerania", "silesia"],
  ["pomerania", "poland"],
  ["prussia", "poland"],
  ["silesia", "bohemia"],
  ["silesia", "poland"],
  ["silesia", "galicia"],
  ["bavaria", "bohemia", "difficult"],
  ["bavaria", "tyrol"],
  ["bavaria", "vienna"],
  ["schleswig-holstein", "denmark", "difficult"],
  ["schleswig-holstein", "baltic-sea", "sea"],
  ["denmark", "baltic-sea", "sea"],
  ["denmark", "north-atlantic", "sea"],
  ["prussia", "baltic-sea", "sea"],
  ["pomerania", "baltic-sea", "sea"],

  // Austria & Italy
  ["tyrol", "vienna", "difficult"],
  ["tyrol", "lombardy", "difficult"],
  ["bohemia", "vienna"],
  ["bohemia", "galicia"],
  ["vienna", "hungary"],
  ["vienna", "croatia"],
  ["vienna", "galicia"],
  ["lombardy", "piedmont", "difficult"],
  ["lombardy", "tuscany", "difficult"],
  ["lombardy", "croatia"],
  ["piedmont", "tuscany", "difficult"],
  ["tuscany", "naples"],
  // The printed central-Italian lines are dashed: Tuscany-Rome-Naples.
  ["tuscany", "rome", "difficult"],
  ["rome", "naples", "difficult"],
  ["naples", "western-mediterranean", "sea"],
  ["tuscany", "western-mediterranean", "sea"],
  ["piedmont", "western-mediterranean", "sea"],
  ["croatia", "hungary"],
  ["croatia", "banat"],
  ["croatia", "bosnia-herzegovina", "difficult"],
  ["croatia", "western-mediterranean", "sea"],
  ["hungary", "banat"],
  ["hungary", "transylvania"],
  ["hungary", "galicia"],
  ["hungary", "serbia", "difficult"],
  ["banat", "transylvania"],
  ["banat", "serbia", "difficult"],
  ["banat", "romania", "difficult"],
  ["transylvania", "romania", "difficult"],
  ["transylvania", "galicia", "difficult"],
  ["galicia", "west-ukraine"],
  ["galicia", "poland"],
  ["galicia", "romania", "difficult"],

  // Balkans
  ["bosnia-herzegovina", "serbia", "difficult"],
  ["bosnia-herzegovina", "bulgaria", "difficult"],
  ["serbia", "bulgaria", "difficult"],
  ["serbia", "macedonia", "difficult"],
  ["serbia", "romania", "difficult"],
  ["serbia", "greece", "difficult"],
  ["bulgaria", "macedonia", "difficult"],
  ["bulgaria", "romania", "difficult"],
  ["bulgaria", "istanbul", "difficult"],
  ["macedonia", "greece", "difficult"],
  ["macedonia", "istanbul", "difficult"],
  ["macedonia", "dardanelles", "difficult"],
  ["greece", "dardanelles", "sea"],
  ["greece", "eastern-mediterranean", "sea"],
  ["romania", "black-sea", "sea"],
  ["romania", "bessarabia", "difficult"],
  ["istanbul", "dardanelles"],
  ["istanbul", "ankara"],
  ["istanbul", "eastern-mediterranean", "sea"],
  ["istanbul", "black-sea", "sea"],
  ["dardanelles", "izmir"],
  ["dardanelles", "eastern-mediterranean", "sea"],
  ["dardanelles", "black-sea", "sea"],

  // Anatolia & Middle East
  ["izmir", "ankara"],
  ["izmir", "antalya"],
  ["izmir", "rhodes", "sea"],
  ["izmir", "eastern-mediterranean", "sea"],
  ["ankara", "antalya"],
  ["ankara", "kayseri"],
  ["ankara", "erzurum"],
  ["antalya", "cyprus", "sea"],
  ["antalya", "syria"],
  ["antalya", "eastern-mediterranean", "sea"],
  ["rhodes", "cyprus", "sea"],
  ["rhodes", "eastern-mediterranean", "sea"],
  ["cyprus", "syria", "sea"],
  ["cyprus", "eastern-mediterranean", "sea"],
  ["syria", "palestine"],
  ["syria", "mosul"],
  ["syria", "kayseri"],
  ["syria", "eastern-mediterranean", "sea"],
  ["palestine", "sinai"],
  ["palestine", "egypt"],
  ["palestine", "eastern-mediterranean", "sea"],
  ["sinai", "egypt"],
  ["sinai", "arabia"],
  ["sinai", "great-sand-sea"],
  ["egypt", "great-sand-sea"],
  ["egypt", "benghazi", "sea"],
  ["egypt", "western-mediterranean", "sea"],
  ["egypt", "indian-ocean", "sea"],
  ["great-sand-sea", "benghazi"],
  ["benghazi", "tripoli"],
  ["benghazi", "western-mediterranean", "sea"],
  ["tripoli", "tunisia"],
  ["tripoli", "western-mediterranean", "sea"],
  ["tunisia", "algeria"],
  ["tunisia", "western-mediterranean", "sea"],
  ["algeria", "morocco"],
  ["algeria", "western-mediterranean", "sea"],
  ["morocco", "western-mediterranean", "sea"],
  ["morocco", "south-atlantic", "sea"],
  ["arabia", "mecca"],
  ["arabia", "baghdad"],
  ["arabia", "kuwait"],
  ["arabia", "indian-ocean", "sea"],
  ["mecca", "indian-ocean", "sea"],
  ["kayseri", "erzurum"],
  ["kayseri", "mosul"],
  ["erzurum", "van"],
  ["erzurum", "mosul"],
  ["van", "mosul"],
  ["mosul", "baghdad"],
  ["baghdad", "kuwait"],
  ["baghdad", "indian-ocean", "sea"],
  ["kuwait", "indian-ocean", "sea"],

  // Russia
  ["st-petersburg", "finland"],
  ["st-petersburg", "baltic-states"],
  ["st-petersburg", "novgorod"],
  ["finland", "baltic-states"],
  ["finland", "baltic-sea", "sea"],
  ["baltic-states", "riga"],
  ["baltic-states", "novgorod"],
  ["riga", "novgorod"],
  ["riga", "belorussia"],
  ["novgorod", "northern-russia"],
  ["novgorod", "smolensk"],
  ["northern-russia", "moscow"],
  ["moscow", "smolensk"],
  ["moscow", "orel"],
  ["moscow", "tsaritsyn", "tsrr"],
  ["smolensk", "belorussia"],
  ["smolensk", "orel"],
  ["smolensk", "kiev"],
  ["orel", "kharkov"],
  ["orel", "tsaritsyn"],
  ["belorussia", "poland"],
  ["belorussia", "west-ukraine"],
  ["belorussia", "kiev"],
  ["poland", "west-ukraine"],
  ["poland", "riga"],
  ["west-ukraine", "kiev"],
  ["west-ukraine", "bessarabia"],
  ["kiev", "kharkov"],
  ["kiev", "bessarabia"],
  ["kharkov", "don"],
  ["kharkov", "southern-ukraine"],
  ["don", "tsaritsyn"],
  ["don", "southern-ukraine"],
  ["southern-ukraine", "bessarabia"],
  ["southern-ukraine", "sevastopol"],
  ["bessarabia", "sevastopol"],
  ["sevastopol", "black-sea", "sea"],
  ["southern-ukraine", "black-sea", "sea"],
  ["bessarabia", "black-sea", "sea"],
  ["tsaritsyn", "astrakhan"],
  ["tsaritsyn", "urals", "tsrr"],
  ["astrakhan", "caucasus"],
  ["caucasus", "dagestan"],
  ["caucasus", "georgia"],
  ["caucasus", "black-sea", "sea"],
  ["dagestan", "georgia"],
  ["dagestan", "azerbaijan"],
  ["georgia", "azerbaijan"],
  ["azerbaijan", "baku"],
  ["urals", "siberia"],
  ["urals", "central-asia"],
  ["siberia", "russian-far-east"],
  ["russian-far-east", "pacific-ocean", "sea"],
  ["russian-far-east", "manchuria"],
  ["riga", "baltic-sea", "sea"],
  ["baltic-states", "baltic-sea", "sea"],
  ["st-petersburg", "baltic-sea", "sea"],

  // Great Game / Asia
  ["central-asia", "afghanistan"],
  ["central-asia", "qajar-persia"],
  ["afghanistan", "balochistan"],
  ["afghanistan", "qajar-persia"],
  ["afghanistan", "india"],
  ["balochistan", "qajar-persia"],
  ["balochistan", "india"],
  ["balochistan", "oman"],
  ["qajar-persia", "oman"],
  ["qajar-persia", "baghdad"],
  ["oman", "aden"],
  ["oman", "indian-ocean", "sea"],
  ["aden", "indian-ocean", "sea"],
  ["aden", "egypt", "sea"],
  ["india", "bengal"],
  ["india", "indian-ocean", "sea"],
  ["bengal", "indian-ocean", "sea"],
  ["bengal", "indochina", "sea"],
  ["bengal", "guangzhou", "sea"],
  ["singapore", "indochina"],
  ["singapore", "indian-ocean", "sea"],
  ["singapore", "pacific-ocean", "sea"],
  ["indochina", "guangzhou", "sea"],
  ["indochina", "indian-ocean", "sea"],
  ["hong-kong", "shanghai"],
  ["hong-kong", "guangzhou"],
  ["hong-kong", "shandong-peninsula"],
  ["hong-kong", "pacific-ocean", "sea"],
  ["shanghai", "shandong-peninsula"],
  ["shanghai", "guangzhou"],
  ["shanghai", "pacific-ocean", "sea"],
  ["guangzhou", "pacific-ocean", "sea"],
  ["shandong-peninsula", "manchuria"],
  ["manchuria", "korea"],
  ["manchuria", "russian-far-east"],
  ["korea", "japan"],
  ["japan", "pacific-ocean", "sea"],
  ["caroline-islands", "pacific-ocean", "sea"],
  ["caroline-islands", "new-guinea"],
  ["new-guinea", "pacific-ocean", "sea"],
  ["new-guinea", "south-central-pacific", "sea"],
  ["australia-new-zealand", "pacific-ocean", "sea"],
  ["australia-new-zealand", "south-central-pacific", "sea"],

  // Africa
  ["west-africa", "nigeria"],
  ["west-africa", "south-atlantic", "sea"],
  ["nigeria", "cameroon"],
  ["nigeria", "south-atlantic", "sea"],
  ["cameroon", "west-congo"],
  ["cameroon", "central-congo", "severe"],
  ["west-congo", "central-congo"],
  ["west-congo", "south-atlantic", "sea"],
  ["central-congo", "east-africa"],
  ["east-africa", "somalia"],
  ["east-africa", "rhodesia"],
  ["east-africa", "madagascar", "sea"],
  ["east-africa", "indian-ocean", "sea"],
  ["somalia", "ethiopia"],
  ["somalia", "indian-ocean", "sea"],
  ["ethiopia", "sudan"],
  ["sudan", "egypt", "severe"],
  ["sudan", "central-congo"],
  ["southwest-africa", "rhodesia", "severe"],
  ["southwest-africa", "south-africa"],
  ["southwest-africa", "south-atlantic", "sea"],
  ["rhodesia", "south-africa"],
  ["south-africa", "south-atlantic", "sea"],
  ["south-africa", "indian-ocean", "sea"],
  ["madagascar", "indian-ocean", "sea"],
  ["morocco", "west-africa", "severe"],
  ["algeria", "west-africa", "severe"],
  ["tunisia", "west-africa", "severe"],

  // Naval box graph (3.2.9)
  ["north-atlantic", "baltic-sea", "sea"],
  ["north-atlantic", "western-mediterranean", "sea"],
  ["western-mediterranean", "south-atlantic", "sea"],
  ["western-mediterranean", "eastern-mediterranean", "sea"],
  ["eastern-mediterranean", "black-sea", "sea"],
  ["eastern-mediterranean", "indian-ocean", "sea"],
  ["south-atlantic", "indian-ocean", "sea"],
  ["indian-ocean", "pacific-ocean", "sea"],
  ["indian-ocean", "south-central-pacific", "sea"],
  ["pacific-ocean", "south-central-pacific", "sea"],
  ["gibraltar", "north-atlantic", "sea"],
  ["gibraltar", "western-mediterranean", "sea"],
  ["malta", "western-mediterranean", "sea"],
  ["eastern-mediterranean", "cyprus", "sea"],
  ["black-sea", "caucasus", "sea"],
  ["black-sea", "sevastopol", "sea"],
  ["indian-ocean", "kuwait", "sea"],

  // Ports that are not connected by a printed land line
  ["south-africa", "south-atlantic", "sea"],
  ["india", "indian-ocean", "sea"],
  ["bengal", "indian-ocean", "sea"],
  ["hong-kong", "pacific-ocean", "sea"],
  ["singapore", "pacific-ocean", "sea"],
  ["australia-new-zealand", "pacific-ocean", "sea"],
  ["australia-new-zealand", "south-central-pacific", "sea"],
  ["new-guinea", "south-central-pacific", "sea"],
  ["madagascar", "indian-ocean", "sea"],
  ["west-africa", "south-atlantic", "sea"],
  ["denmark", "north-atlantic", "sea"],
  ["denmark", "baltic-sea", "sea"],
  ["london", "north-atlantic", "sea"],
  ["scotland", "north-atlantic", "sea"],
  ["ireland", "north-atlantic", "sea"],
  ["northern-england", "north-atlantic", "sea"],
  ["wales", "north-atlantic", "sea"],
  ["belgium", "north-atlantic", "sea"],
  ["netherlands", "north-atlantic", "sea"],
  ["sinai", "indian-ocean", "sea"],
  ["cameroon", "south-atlantic", "sea"],
];

/**
 * The printed map carries a few connections that the detection pass could not
 * see because the line is drawn around a label.  They are recorded explicitly
 * here with a source note so they can be reviewed against the map.
 */
const MANUAL_ADDITIONS: [SpaceId, SpaceId, ConnectionType?, string?][] = [
  ["paris", "alsace-lorraine", "clear", "printed line through Champagne/Alsace"],
  ["alsace-lorraine", "westphalia", "difficult", "Rhine frontier; dashed on map"],
  ["hanover", "belgium", "clear", "printed line"],
  ["denmark", "schleswig-holstein", "difficult", "printed dashed line"],
  ["denmark", "sweden", undefined, "no Sweden space; ignored"],
];

export const CONNECTIONS: ConnectionDef[] = (() => {
  const seen = new Map<string, ConnectionDef>();
  const add = (a: SpaceId, b: SpaceId, type: ConnectionType = "clear", note?: string) => {
    if (a === b || !SPACES[a] || !SPACES[b]) return;
    const key = [a, b].sort().join("|");
    if (seen.has(key)) return;
    seen.set(key, {a, b, type, note});
  };
  for (const [a, b, type] of CONNECTION_ROWS) add(a, b, type);
  for (const [a, b, type, note] of MANUAL_ADDITIONS) add(a, b, type, note);
  return [...seen.values()];
})();

const ADJACENCY = new Map<SpaceId, ConnectionDef[]>();
for (const conn of CONNECTIONS) {
  if (!ADJACENCY.has(conn.a)) ADJACENCY.set(conn.a, []);
  if (!ADJACENCY.has(conn.b)) ADJACENCY.set(conn.b, []);
  ADJACENCY.get(conn.a)!.push(conn);
  ADJACENCY.get(conn.b)!.push(conn);
}

export const connectionsOf = (id: SpaceId): ConnectionDef[] => ADJACENCY.get(id) ?? [];

export const neighboursOf = (id: SpaceId): SpaceId[] =>
  connectionsOf(id).map((c) => (c.a === id ? c.b : c.a));

export const connectionBetween = (a: SpaceId, b: SpaceId): ConnectionDef | undefined =>
  connectionsOf(a).find((c) => (c.a === a ? c.b : c.a) === b);

/** Ports are the boxes listed on the space; ports defined on boxes too. */
export const portBoxes = (id: SpaceId): string[] => SPACES[id]?.ports ?? [];

/** Space display name in the active locale. */
export const spaceLabel = (id: SpaceId, locale: "en" | "zh_CN"): string => {
  const s = SPACES[id];
  if (!s) return id;
  return locale === "zh_CN" ? s.nameZh : s.name;
};

export const isKey = (id: SpaceId): boolean => SPACES[id]?.keyType !== undefined;

export const createSpaceStates = (): Record<SpaceId, SpaceState> => {
  const out: Record<SpaceId, SpaceState> = {};
  for (const space of Object.values(SPACES)) {
    out[space.id] = {
      control: space.control,
      influence: space.influence ?? null,
      diplomacy: null,
      ally: null,
      fort: null,
      pacification: 0,
      rebellion: null,
      units: [],
      trench: null,
    };
  }
  return out;
};
