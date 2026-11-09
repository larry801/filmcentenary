import {
    areaName,
    controllerName,
    hreReligiousPreferenceName,
    minorName,
    powerName,
    rulerName,
    victoryText,
} from "./constant/general";
import {cardName} from "./constant/cards";
import {scenarioName, seaCaptainName, patronName, scienceBonusName} from "./scenario";
import {powerLabel, controllerLabel} from "./util";
import {spaceName, seaZoneName} from "./mapData";
import {leaderName} from "./constant/leaders";
import {localizeLogLine} from "./logText";
import {seaCaptainById} from "./scenario";
import {patronDef} from "./scenario";
import {scienceBonusById} from "./scenario";

describe("VQ bilingual helpers (zh_CN default, en on request)", () => {
    it("power names flip with locale, default zh_CN", () => {
        expect(powerName("spain")).toBe("西班牙");
        expect(powerName("spain", "zh_CN")).toBe("西班牙");
        expect(powerName("spain", "en")).toBe("Spain");
        expect(powerName("ottoman", "en")).toBe("Ottoman Empire");
    });
    it("minor / controller names flip", () => {
        expect(minorName("venice")).toBe("威尼斯");
        expect(minorName("venice", "en")).toBe("Venice");
        expect(controllerName("france")).toBe("法国");
        expect(controllerName("france", "en")).toBe("France");
        expect(controllerName("independent")).toBe("独立");
        expect(controllerName("independent", "en")).toBe("Independent");
    });
    it("area, HRE preference, ruler, victory names flip", () => {
        expect(areaName("france")).toBe("法国");
        expect(areaName("france", "en")).toBe("France");
        expect(hreReligiousPreferenceName("balanced")).toBe("平衡");
        expect(hreReligiousPreferenceName("balanced", "en")).toBe("Balanced");
        expect(rulerName("suleiman")).toBe("苏莱曼一世");
        expect(rulerName("suleiman", "en")).toBe("Suleiman the Magnificent");
        expect(victoryText("standard")).toBe("标准胜利：达到 25 分");
        expect(victoryText("standard", "en")).toBe("Standard victory: reach 25 VP");
    });
    it("card, scenario, captain, patron, science names flip", () => {
        const c = cardName("vq-001");
        expect(typeof c).toBe("string");
        expect(cardName("vq-001", "en")).not.toBe(cardName("vq-001", "zh_CN"));
        expect(scenarioName("tutorial")).toBe("勒班陀海战");
        expect(scenarioName("tutorial", "en")).not.toBe("勒班陀海战");
        const captain = seaCaptainById("drake");
        expect(seaCaptainName(captain)).not.toBe(seaCaptainName(captain, "en"));
        const patron = patronDef("titian");
        expect(patronName(patron, "en")).not.toBe(patronName(patron, "zh_CN"));
        const bonus = scienceBonusById("excavation");
        expect(scienceBonusName(bonus, "en")).toBe("Excavation");
    });
    it("util labels flip", () => {
        expect(powerLabel("england")).toBe("英格兰");
        expect(powerLabel("england", "en")).toBe("England");
        expect(controllerLabel("papacy")).toBe("教宗国");
        expect(controllerLabel("independent", "en")).toBe("Independent");
    });
    it("place and leader names flip", () => {
        expect(spaceName("paris")).toBe("巴黎");
        expect(spaceName("paris", "en")).toBe("Paris");
        expect(seaZoneName("englishChannel")).toBe("英吉利海峡");
        expect(seaZoneName("englishChannel", "en")).toBe("English Channel");
        expect(leaderName("alba")).toBe("阿尔瓦公爵");
        expect(leaderName("alba", "en")).toBe("Duke of Alba");
    });
    it("engine log lines render in Chinese but keep the English source", () => {
        expect(localizeLogLine("Rudolf II dies; the +2 Prague Cultural Center marker is removed from the game."))
            .toBe("鲁道夫二世死亡；+2 布拉格文化中心标记移出游戏。");
        expect(localizeLogLine("西班牙 land units return from Naples to Ancona."))
            .toBe("西班牙 的陆军单位从 那不勒斯 返回 安科纳。");
        expect(localizeLogLine("Spain moves into Paris")).toBe("西班牙 moves into 巴黎");
        const source = "Rudolf II dies; the +2 Prague Cultural Center marker is removed from the game.";
        expect(localizeLogLine(source, "en")).toBe(source);
    });
});
