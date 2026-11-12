/**
 * Chinese display names for the map, sea zones and leaders.
 *
 * The data files keep the printed English names so scenario-book cross
 * references and saved games stay stable.  These tables add the Chinese names
 * that the default `zh_CN` UI shows, while `en` mode keeps the originals.
 */

export const SPACE_NAME_ZH: Record<string, string> = {
    // Iberia
    madrid: "马德里",
    barcelona: "巴塞罗那",
    valencia: "巴伦西亚",
    seville: "塞维利亚",
    cadiz: "加的斯",
    gibraltar: "直布罗陀",
    corunna: "拉科鲁尼亚",
    pamplona: "潘普洛纳",
    granada: "格拉纳达",
    lisbon: "里斯本",
    oporto: "波尔图",

    // France
    paris: "巴黎",
    rouen: "鲁昂",
    amiens: "亚眠",
    orleans: "奥尔良",
    dijon: "第戎",
    bourges: "布尔日",
    clermont: "克莱蒙",
    lyon: "里昂",
    marseille: "马赛",
    toulouse: "图卢兹",
    bordeaux: "波尔多",
    nantes: "南特",
    brest: "布雷斯特",
    laRochelle: "拉罗谢尔",
    bearn: "贝阿恩",
    montauban: "蒙托邦",
    nimes: "尼姆",
    metz: "梅斯",
    geneva: "日内瓦",

    // Netherlands and the Rhineland
    brussels: "布鲁塞尔",
    antwerp: "安特卫普",
    amsterdam: "阿姆斯特丹",
    rotterdam: "鹿特丹",
    flushing: "弗利辛恩",
    brielle: "布里勒",
    ghent: "根特",
    utrecht: "乌得勒支",
    bruges: "布鲁日",
    cologne: "科隆",
    mainz: "美因茨",
    trier: "特里尔",
    frankfurt: "法兰克福",
    nuremberg: "纽伦堡",
    munich: "慕尼黑",
    augsburg: "奥格斯堡",
    innsbruck: "因斯布鲁克",
    vienna: "维也纳",
    prague: "布拉格",
    pressburg: "普雷斯堡",
    graz: "格拉茨",
    breslau: "布雷斯劳",
    zagreb: "萨格勒布",

    // British Isles
    london: "伦敦",
    york: "约克",
    bristol: "布里斯托尔",
    plymouth: "普利茅斯",
    portsmouth: "朴茨茅斯",
    norwich: "诺里奇",
    dover: "多佛",
    edinburgh: "爱丁堡",
    stirling: "斯特灵",
    aberdeen: "阿伯丁",
    glasgow: "格拉斯哥",
    dublin: "都柏林",
    ulster: "阿尔斯特",
    cork: "科克",

    // Italy
    milan: "米兰",
    turin: "都灵",
    venice: "威尼斯",
    padua: "帕多瓦",
    florence: "佛罗伦萨",
    rome: "罗马",
    ancona: "安科纳",
    naples: "那不勒斯",
    palermo: "巴勒莫",
    messina: "墨西拿",
    cagliari: "卡利亚里",

    // Balkans, Greece and the Mediterranean
    belgrade: "贝尔格莱德",
    buda: "布达",
    temesvar: "泰梅什瓦尔",
    sarajevo: "萨拉热窝",
    sofia: "索非亚",
    athens: "雅典",
    edirne: "埃迪尔内",
    istanbul: "伊斯坦布尔",
    nicosia: "尼科西亚",
    candia: "干地亚",
    ragusa: "拉古萨",
    tunis: "突尼斯",
    algiers: "阿尔及尔",
    tripoli: "的黎波里",

    // Scenario-book additions
    lille: "里尔",
    dunkirk: "敦刻尔克",
    salonika: "塞萨洛尼基",
    scutari: "斯库台",
    oran: "奥兰",
    cartagena: "卡塔赫纳",
    genoa: "热那亚",
    malta: "马耳他",
    zara: "扎拉",
    corfu: "科孚",
    cyprus: "塞浦路斯",
    ravenna: "拉文纳",
    alkmaar: "阿尔克马尔",
    haarlem: "哈勒姆",
    arnhem: "阿纳姆",
    sHertogenbosch: "斯海尔托亨博斯",
    maastricht: "马斯特里赫特",
    calais: "加来",
    reims: "兰斯",
    amboise: "昂布瓦斯",
    rennes: "雷恩",
    poitiers: "普瓦捷",
    limoges: "利摩日",
    montpellier: "蒙彼利埃",
    avignon: "阿维尼翁",
    cognac: "干邑",
    bayonne: "巴约讷",
    berwick: "贝里克",
    carlisle: "卡莱尔",
    kinsale: "金塞尔",
    perth: "珀斯",
    szigetvar: "锡盖特堡",
};

export const SEA_ZONE_NAME_ZH: Record<string, string> = {
    atlanticOcean: "大西洋",
    irishSea: "爱尔兰海",
    englishChannel: "英吉利海峡",
    northSea: "北海",
    bayOfBiscay: "比斯开湾",
    gulfOfLyon: "利翁湾",
    tyrrhenian: "第勒尼安海",
    ionian: "爱奥尼亚海",
    adriatic: "亚得里亚海",
    aegean: "爱琴海",
    easternMediterranean: "东地中海",
    barbaryCoast: "巴巴里海岸",
    northAfricanCoast: "北非海岸",
};

/** Chinese names for every leader counter and the rule 5.1 default leaders. */
export const LEADER_NAME_ZH: Record<string, string> = {
    // Ottoman
    mehmed: "穆罕默德帕夏",
    lalaMustafa: "拉拉·穆斯塔法帕夏",
    sinanPasha: "希南帕夏",
    piyale: "皮雅利帕夏",
    dragut: "德拉加特",
    uluchAli: "乌卢奇·阿里",

    // Spain
    alba: "阿尔瓦公爵",
    parma: "帕尔马公爵",
    donJohn: "奥地利的唐·约翰",
    santaCruz: "圣克鲁斯侯爵",
    medinaSidonia: "梅迪纳·西多尼亚公爵",

    // England
    leicester: "莱斯特伯爵",
    norreys: "约翰·诺里斯",
    howard: "埃芬厄姆的霍华德勋爵",
    drake: "弗朗西斯·德雷克",
    hawkins: "约翰·霍金斯",

    // France
    guise: "吉斯公爵",
    montmorency: "安妮·德·蒙莫朗西",
    henryIII: "亨利三世",
    joyeuse: "茹瓦约斯公爵",

    // Holy Roman Empire
    schwendi: "拉扎鲁斯·冯·施文迪",
    zrinyi: "尼古拉·兹里尼",
    mansfeld: "曼斯费尔德伯爵",

    // Protestant
    coligny: "加斯帕尔·德·科利尼",
    navarre: "纳瓦拉的亨利",
    orange: "奥兰治的威廉",
    maurice: "拿骚的莫里斯",

    // Rule 5.1 default leaders
    "default-ottoman": "奥斯曼默认将领",
    "default-spain": "西班牙默认将领",
    "default-england": "英格兰默认将领",
    "default-france": "法国默认将领",
    "default-hre": "神圣罗马默认将领",
    "default-protestant": "新教默认将领",

    // English sea captains (rule 10.2)
    "captain-hawkins": "霍金斯",
    "captain-drake": "弗朗西斯·德雷克",
    "captain-frobisher": "弗罗比舍",
    "captain-raleigh": "罗利",
    "captain-cavendish": "卡文迪什",
};
