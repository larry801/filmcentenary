import {localizeLogLine} from "./logText";

/**
 * Regression coverage for the engine log templates that used to fall through
 * to English in the Chinese UI.  Each line is a realistic rendering of one
 * `pushLog` template; the sweep asserts that no Latin word survives the
 * translation.
 */

const ENGLISH_WORD = /[A-Za-z][A-Za-z'’-]{2,}/g;

const LINES: string[] = [
    "Grand Vizier adds 4 regular in Vienna.",
    "Untimely Death: no listed leader remains in play.",
    "henryIII is dead; the betrothal is cancelled.",
    "English Catholic Rebellion: Spain controls London.",
    "English Catholic Rebellion: conversionsAndRebellion.",
    "English Catholic Rebellion: loseOperatives.",
    "Spain plays Sir Edward Stafford to cancel Walsingham.",
    "St. Bartholomew's Day Massacre: Paris becomes Catholic.",
    "France attempts a free 2 CP assassination of Coligny.",
    "Northern Rising: York becomes Catholic.",
    "Northern Rising: unrest in York.",
    "England plays Northern Rising; Spain resolves it.",
    "St. Bartholomew's Day Massacre: 3 Protestant mercenaries in France removed; the Protestant gains a +1 Card marker.",
    "Double Agent would remove England's informant; England may respond with Walsingham.",
    "Mercenaries for Hire not granted this turn are lost.",
    "Spain plays Sultan's Harem: the Ottoman skips its next action round and Spain draws a card.",
    "Scottish Lords Rebel: Scotland was already evaluated this turn, so the event is ignored (rule 24.6).",
    "Scottish Lords Rebel: no power wins the Scottish diplomacy check; Scottish control is unchanged and no units are displaced.",
    "Don Antonio places 2 Portuguese regular(s) in Lisbon.",
    "2-unit foreign army appears in France; England must commit 3–8 land units.",
    "England finds no retrievable card in the discard pile.",
    "England takes the Black Queen from the discard pile.",
    "An extra treasure joins the Spanish treasure row.",
    "Foxe's Book of Martyrs converts 2 English Catholic space(s).",
    "Council of Troubles converts the Netherlands and takes 2 space(s); the Protestant gains a +1 Card marker.",
    "Sir Edward Stafford discards the Black Queen from Spain.",
    "Sir Edward Stafford discards a 2 CP treasure from Spain.",
    "Ottoman Tribute: no legal target; the event has no effect.",
    "Venice cannot pay tribute; the Ottoman declares war and gains 2 CP.",
    "Spain declines to move 2 rebels.",
    "ireland rebels move from ulster to dublin.",
    "Spain uses the Spanish Road from Milan to Paris.",
    "Dutch Revolt: 2 Netherlands space(s) under Spanish control.",
    "Act of Abjuration: the Protestant accepts Spain's offer.",
    "Papal Bull sponsors Titian for Spain.",
    "Grand Tour makes peace between Spain and France.",
    "Grand Tour clears French unrest and reinforces Paris for Spain.",
    "Genoese Bankers launch Drake's colonist expedition and grant 3 CP.",
    "Muscovy Company grants Spain an extra card next year.",
    "Knights of St. John reduce the Ottoman's piracy VP.",
    "Knights of St. John take the Black Queen from the Ottoman.",
    "Knights of St. John deploy 2 regulars and a fortress in Malta.",
    "Holy League adds Spain +1, France +0 influence for Spain.",
    "Treachery! forces an assault on Paris.",
    "City State Rebels: Spain must allocate 2 hit(s) in Paris.",
    "Army Mutiny strikes Spain in Paris.",
    "El Dorado: 2 treasure(s) are lost with the expedition.",
    "Drake departs for El Dorado; the expedition ends and returns next turn.",
    "Philosopher's Stone cancels Titian's work.",
    "Richard Topcliffe removes 2 Jesuit(s), converts England, and Spain gains +1 Card.",
    "Foreign Volunteers place 2 of 3 regular(s) for Spain.",
    "Diplomatic Faux Pas removes 2 influence from Spain.",
    "German Recruitment Curtailed removes regular; merc.",
    "Unrest in the Realm places 2 unrest in Spain home spaces.",
    "Sea Beggars seize Paris for the Protestant.",
    "Border Reivers take the Black Queen from Spain.",
    "Border Reivers add 4 Spain influence in Scotland.",
    "Dunkirk Privateers [1,2] = 1 hit(s) against Calais.",
    "Gregorian Calendar: Spain will begin the next action round.",
    "Polish Royal Election ends the Polish war; the Holy Roman Empire is considered victorious.",
    "Polish election: Spain bids 2 and rolls 4 = 6.",
    "The Black Queen sends a spy against Spain.",
    "The Black Queen sends an agent to assassinate alba.",
    "The Black Queen takes the Black Queen from Spain.",
    "Sultana Safiye gives Spain 2 influence in Venice.",
    "Sultana Safiye exchanges a card with Spain.",
    "Edmund Campion: no Jesuit remains on Spain's power board.",
    "Edmund Campion places a Jesuit in Paris; 2 conversion attempt(s).",
    "Tenth Penny: Spain takes the Black Queen from the Protestant; it cannot be played this impulse.",
    "Taxis Family Courier gives the Black Queen to Spain.",
    "Black Magic discards the Black Queen from Spain.",
    "Black Magic takes the Black Queen from Spain.",
    "Armada Pardon grants Spain 2 CP for the Armada.",
    "Convention of Estates converts 2 Netherlands space(s) to Protestant.",
    "Puritans draw the Black Queen from England; England discards it.",
    "Puritans draw the Black Queen from England; England gives it to Spain.",
    "Puritans place unrest in 2 English space(s).",
    "Northwest Passage: Drake rolls 3 and remains safe.",
    "Northwest Passage: 2 treasure(s) are lost with the expedition.",
    "Northwest Passage: Drake rolls 3 then 2 and dies.",
    "Northwest Passage: Drake rolls 3 then 2; the expedition ends and he returns next turn.",
    "Menéndez de Avilés adds a galleon to the Treasure Fleet escorts.",
    "Menéndez de Avilés fortifies Paris and adds a patrol.",
    "Nostradamus' Prophecies: Spain keeps the Black Queen and returns the rest.",
    "John Knox converts Scotland, sparing Paris.",
    "John Knox adds 4 Spain influence in Scotland.",
    "Index of Prohibited Books cancels Titian's work.",
    "Patron of Arts draws two cards and gives the Black Queen to Spain.",
    "Patron of Arts sponsors Titian for the Holy Roman Empire.",
    "Italian Expert sponsors Titian for Spain.",
    "Sack! roll at Paris: 4, 5 vs 2 defender(s).",
    "Spanish Fury seizes the Black Queen from Spain; Spain draws a card and the defender gains +1 Card.",
    "Drake becomes an Experienced Navigator (Navigation 2).",
    "Gouvernante de France converts 2 French space(s); Protestant rebellions are blocked this turn.",
    "Enterprise of England: 2 Jesuit(s), 2 Catholic, 2 Spanish-controlled, 2 Spanish regulars = 8.",
    "The Spanish Armada is placed in Lisbon; Spain gains 5 CP.",
    "Spain gains 9 CP for the Armada.",
    "Spain plays the Black Queen as an event.",
    "Sir Edward Stafford cancels Walsingham for Spain.",
    "William of Orange arrives but finds no friendly capital; he stays in the pool.",
    "William of Orange is held back and may lead a Protestant rebellion.",
    "Spain gives a random card to France.",
    "Spain gives a mercenary to France in Paris.",
    "Spain gives a treasure to France.",
    "Spain takes shared Sea Captain Drake (first come, first served; 5.2/17.4).",
    "Duke of Alba is caught alone and returns to the Turn Track.",
    "The siege of Paris is lifted.",
    "Duke of Alba is placed on the Turn Track after his fleet is destroyed.",
    "Spain and France announce an agreement: ",
    "Spain takes a treasure from the hand.",
    "Spain takes the Black Queen from the hand.",
    "The Spanish Armada is eliminated by piracy.",
    "The Spanish Armada is downgraded to strength 2 by piracy.",
    "Spanish Road deploys 2 land unit(s) from Milan to Paris.",
    "City State Rebels in Paris: land:spain:regular.",
    "2 spent treasure(s) return to the pool.",
    "The treasure pool holds only 2 of 4 Spanish treasure(s).",
    "Drake is lost before Drake; the companion absorbs the elimination.",
    "Spain takes a Portuguese treasure.",
    "Mary Queen of Scots enters the Royal Weddings pool.",
    "Spain declares war on Ireland at no cost (24.2 step 6).",
    "Spain diplomacy: France 7; England 5.",
    "Spain land force pool is full; 2 regular counter(s) could not be placed.",
    "Spain land force pool is full; 2 regular counter(s) could not be added to the foreign war.",
    "Spain naval force pool is full; 2 galley counter(s) could not be placed.",
    "William of Orange has arrived; Protestant must choose to place him in the capital or hold him back for a rebellion.",
    "The Protestant seizes Paris.",
    "The Protestant designates Paris as its capital.",
    "Rudolf II is murdered; the Holy Roman Empire drops to 1 Admin and 0 card bonus.",
    "Le Testu's scientist counter is removed from play with his sea captain marker.",
    "Le Testu's sea captain marker is removed from play with his scientific work.",
    "Titian returns to the available pool with the Observatory bonus.",
    "Catholic League: Spain takes Reims; Spain must now choose 2 unfortified French home spaces.",
    "Catholic League: France removes 2 regular(s) and 2 mercenar(y/ies).",
    "Catholic League: Spain adds 2 regular(s) to the Reims garrison.",
    "Catholic League: the Duke of Guise joins the League in Reims.",
    "The Catholic League has formed; Spain may make no deals with France or the Protestant this coming Diplomacy Segment.",
    "Catholic League: Spain takes Paris.",
    "Catholic League spaces: Paris, Reims.",
    "Catholic League: no further unfortified French home spaces are available.",
    "Morisco Revolt: unrest in Granada.",
    "Morisco Revolt: only 2 unoccupied space(s) within 2 of Granada.",
    "Morisco Revolt: no unoccupied space within 2 of Granada.",
    "Spain keeps the automatic Morisco unrest placement.",
    "Morisco Revolt: the unrest marker in Granada is withdrawn.",
    "Morisco Revolt ends: the Morisco unit is removed and card #28 leaves play.",
    "Morisco Revolt: Granada is cleared, unrest spreads, and 2 Morisco unit(s) appear.",
    "Morisco Revolt: the Morisco unit is besieging a fortified space at Winter and is eliminated.",
    "England-Spain war cost is now 2 CP.",
    "The Armada is reinforced with 2 galleon(s) in Lisbon (+1 VP).",
    "Spain recruits 1 regular directly into the Spain war.",
    "Spain commits 2 unit(s) and alba to the France war.",
    "Spain loses 2 unit(s); France loses 1.",
    "Spain returns 2 overstacked unit(s) from Paris to Orleans (2 lost to winter attrition).",
    "Spain withdraws 2 unit(s) from Paris to Orleans (2 lost to winter attrition).",
    "Spain moves 2 unit(s) from Paris to Orleans for the winter (2 lost to winter attrition).",
    "Holy Roman replacement: Mercenaries for Hire marker moves from 0 to 4.",
    "Spain discards the Black Queen.",
    "Spain continues to Paris.",
    "Spain returns to Paris.",
    "Spain preaches a sermon in England.",
    "Spain suppresses heresy in England.",
    "Ruler Falls Ill: alba returns to Paris.",
    "Gain Intelligence: 3 dice [1,2,3] = 1 hits; defense 2 [4,5] = 1 hits",
    "City State Rebels [1,2] = 1 hit(s) in Paris.",
    "Spain Patronage: Titian 3+4+rating 2+bonus 1=10",
];

describe("log template coverage", () => {
    it("leaves no English words in the Chinese rendering", () => {
        const untranslated = LINES
            .map((line) => ({line, out: localizeLogLine(line)}))
            .filter(({out}) => new RegExp(ENGLISH_WORD.source, "g").test(out))
            .map(({line, out}) => `${line} => ${out}`);
        expect(untranslated).toEqual([]);
    });

    it("keeps names, places and card titles translated inside the templates", () => {
        expect(localizeLogLine("ireland rebels move from ulster to dublin."))
            .toBe("爱尔兰叛军从 阿尔斯特 移动到 都柏林。");
        expect(localizeLogLine("Spain takes the Black Queen from France."))
            .toBe("西班牙 从 法国 取得 黑太后。");
        expect(localizeLogLine("Ruler Falls Ill: alba returns to Paris."))
            .toBe("统治者患病：阿尔瓦公爵 返回 巴黎。");
        expect(localizeLogLine("The Black Queen sends a spy against Spain."))
            .toBe("黑王后派间谍针对 西班牙。");
        expect(localizeLogLine("Spain pays tribute: the Ottoman takes a treasure."))
            .toBe("西班牙 纳贡：奥斯曼帝国 取得一个宝藏。");
    });

    it("localizes the dice summaries that are logged on their own", () => {
        expect(localizeLogLine("Gain Intelligence: 3 dice [1,2,3] = 1 hits; defense 2 [4,5] = 1 hits"))
            .toBe("获取情报：3 个骰子 [1,2,3] = 1 次命中；防御 2 [4,5] = 1 次命中");
        expect(localizeLogLine("City State Rebels [1,2] = 1 hit(s) in Paris."))
            .toBe("城邦起义 [1,2] = 1 次命中（巴黎）。");
        expect(localizeLogLine("Spain Patronage: Titian 3+4+rating 2+bonus 1=10"))
            .toBe("西班牙 赞助：提香 3+4+评级 2+加成 1=10");
    });

    it("uses the right semantics for the rules that used to drop detail", () => {
        expect(localizeLogLine("John Knox adds 4 Spain influence in Scotland."))
            .toBe("约翰·诺克斯在苏格兰为 西班牙 增加 4 点影响力。");
        expect(localizeLogLine("Portugal removes the colony at Florida and draws a treasure."))
            .toBe("葡萄牙 移除 佛罗里达 的殖民地并抽一个宝藏。");
        expect(localizeLogLine("Spain moves 2 unit(s) from Paris to Orleans for the winter (2 lost to winter attrition)."))
            .toBe("西班牙 冬季将 2 个单位从 巴黎 移至 奥尔良（2 个因冬季损耗损失）。");
        expect(localizeLogLine("Holy Roman replacement: Mercenaries for Hire marker moves from 0 to 4."))
            .toBe("神圣罗马帝国 冬季补员：雇佣兵征募标记从 0 移到 4。");
    });
});
