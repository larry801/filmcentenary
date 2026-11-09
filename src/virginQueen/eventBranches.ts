import {isPower, Power, powerName, POWERS, spaceHomes, VQGame} from "./constant/general";
import {cardById, cardName} from "./constant/cards";
import {LEADER_BY_ID, leaderName} from "./constant/leaders";
import {MINOR_DIPLOMACY} from "./data/minorDiplomacy";
import {WORLD_SETTLEMENTS} from "./data/world";
import {SPACE_BY_ID, SPACES, spaceName} from "./mapData";
import {isActivatedMajor, ownerOf} from "./ownership";
import {patronById, seaCaptainById, seaCaptainName, patronName} from "./scenario";
import {minorAvailable, rebellionTargets} from "./util";
import {espionageAvailable, informantCutTargets} from "./espionage";
import {canPlayHolyLeague} from "./holyLeague";
import {recruitmentOptions} from "./cardEvents";
import i18n from "../constant/i18n";

type VQLocale = "en" | "zh_CN";

const locale = (): VQLocale => (i18n.getLocaleName() === "en" ? "en" : "zh_CN");
/** Per-card branch wording is kept next to the rules metadata; both locales ship together. */
const text = (zh: string, en: string): string => (locale() === "en" ? en : zh);

export interface EventBranchOptionValue {
    value: string;
    label: string;
}

export interface EventBranchParam {
    id: string;
    label: string;
    /** Optional parameters offer a blank "automatic" entry. */
    optional?: boolean;
    /** Dependent parameters receive the values already chosen for this branch. */
    options: (values: Record<string, string>) => EventBranchOptionValue[];
}

export interface EventBranch {
    id: string;
    label: string;
    hint?: string;
    params: EventBranchParam[];
    /** Builds the `playCard.target` grammar, or undefined for a no-target branch. */
    target: (values: Record<string, string>) => string | undefined;
}

export interface EventBranchChoice {
    mode: "single" | "two";
    maxSelections: number;
    branches: EventBranch[];
    /** Preferred initial selection; falls back to the first available branch. */
    defaultIds?: string[];
}

const branch = (
    id: string,
    label: string,
    target: (values: Record<string, string>) => string | undefined,
    params: EventBranchParam[] = [],
    hint?: string,
): EventBranch => ({id, label, target, params, hint});

const param = (
    id: string,
    label: string,
    options: (values: Record<string, string>) => EventBranchOptionValue[],
    optional = false,
): EventBranchParam => ({id, label, options, optional});

const powerOptions = (powers: Power[]): EventBranchOptionValue[] =>
    powers.map((power) => ({value: power, label: powerName(power, locale())}));

const spaceOptions = (ids: string[]): EventBranchOptionValue[] =>
    ids.map((id) => ({value: id, label: SPACE_BY_ID[id] !== undefined ? spaceName(id, locale()) : id}));

const cardOptions = (ids: string[]): EventBranchOptionValue[] =>
    ids.map((id) => ({value: id, label: cardName(id, locale())}));

const patronOptions = (G: VQGame, ids: string[]): EventBranchOptionValue[] =>
    ids.map((id) => {
        const patron = patronById(G, id);
        return {value: id, label: patronName(patron === undefined ? undefined : {nameEn: patron.name, nameZh: patron.nameZh}, locale())};
    });

const captainOptions = (ids: string[]): EventBranchOptionValue[] =>
    ids.map((id) => ({value: id, label: seaCaptainName(seaCaptainById(id), locale())}));

const leaderOptions = (G: VQGame, ids: string[]): EventBranchOptionValue[] =>
    ids.map((id) => ({value: id, label: LEADER_BY_ID[id] !== undefined ? leaderName(id, locale()) : id}));

const playerPowers = (G: VQGame, except?: Power): Power[] =>
    POWERS.filter((power) => power !== except && ownerOf(G, power) !== undefined);

const otherPowers = (power: Power): Power[] => POWERS.filter((candidate) => candidate !== power);

/** Powers that may be targeted by an espionage event. */
const espionagePowers = (G: VQGame, power: Power): Power[] =>
    playerPowers(G, power).filter((target) => !isActivatedMajor(G, target));

const nonHomeCards = (G: VQGame, power: Power): string[] =>
    G.powers[power].cards.filter((id) => cardById(id).kind !== "home");

const nonMandatoryCards = (G: VQGame, power: Power): string[] =>
    G.powers[power].cards.filter((id) => cardById(id).officialKind !== "mandatory");

const scotlandSpaces = (): string[] => SPACES.filter((space) => space.area === "scotland").map((space) => space.id);

const frenchBetrothal = (G: VQGame): boolean => G.betrothals.some((betrothal) => {
    const male = G.royals.find((royal) => royal.id === betrothal.male);
    const female = G.royals.find((royal) => royal.id === betrothal.female);
    return male?.power === "france" || female?.power === "france";
});

const borderPower = (G: VQGame, power: Power): boolean =>
    ["york", "carlisle", "berwick"].some((id) => G.spaces[id]?.control === power) ||
    SPACES.some((space) => space.area === "scotland" && G.spaces[space.id].control === power);

const papalAlly = (G: VQGame): Power | undefined =>
    POWERS.find((power) => G.powers[power].alliedMinors.includes("papacy") && ownerOf(G, power) !== undefined);

const availablePatrons = (G: VQGame, power: Power): string[] =>
    G.patronsAvailable.filter((id) => {
        const patron = patronById(G, id);
        return patron !== undefined && (patron.region === "italy" || patron.region === "hre") && patron.rating !== null &&
            !POWERS.some((candidate) => G.powers[candidate].patrons.includes(id)) &&
            !G.patronizedThisTurn.includes(`${power}:${patron.kind}`);
    });

const armadaPorts = (G: VQGame, power: Power): string[] =>
    ["seville", "corunna", "lisbon"].filter((id) =>
        G.spaces[id].control === power && !G.spaces[id].unrest && G.spaces[id].siege === undefined);

const portugalHomeSpaces = (G: VQGame): string[] =>
    SPACES.filter((space) => spaceHomes(space).includes("portugal") && G.spaces[space.id].control === "portugal" &&
        G.spaces[space.id].siege === undefined).map((space) => space.id);

const frenchHomeSpaces = (G: VQGame): string[] =>
    SPACES.filter((space) => space.id !== "paris" && G.spaces[space.id].control === "france").map((space) => space.id);

const informantCutLabel = (value: string): string => {
    const [enemy, from] = value.slice("cut:".length).split(">");
    if (from === undefined) return text(`剪除 ${powerName(enemy as Power, "zh_CN")} 的密探`, `Cut ${powerName(enemy as Power, "en")}'s informant`);
    return text(`剪除 ${powerName(enemy as Power, "zh_CN")} 的密探（调回 ${powerName(from as Power, "zh_CN")} 的密探）`,
        `Cut ${powerName(enemy as Power, "en")}'s informant (move the one on ${powerName(from as Power, "en")})`);
};

/**
 * Per-card branch metadata for Event/Home cards whose printed text offers a
 * choice. Cards without an entry keep the legacy free-text target field.
 */
export const eventBranchChoice = (G: VQGame, cardId: string, power: Power, numPlayers: number): EventBranchChoice | undefined => {
    const def = cardById(cardId);
    if (def.officialNumber === undefined) return undefined;
    let branches: EventBranch[] = [];
    let mode: EventBranchChoice["mode"] = "single";

    switch (cardId) {
        case "vq-001": {
            if (recruitmentOptions(G).length > 0) {
                branches.push(branch("recruit", text("招募 4 个单位", "Recruit 4 units"), () => "recruit",
                    [], text("选择后在事件面板中逐个放置单位。", "Place the units one by one in the event panel.")));
            }
            if (G.scenario !== "tutorial" && [5, 6].includes(numPlayers) && !G.suezDone) {
                branches.push(branch("suez", text("苏伊士运河检定", "Attempt the Suez Canal"), () => "suez"));
            }
            break;
        }
        case "vq-005": {
            const ally = papalAlly(G);
            if (ally !== undefined) {
                if (!G.elizabethExcommunicated) {
                    branches.push(branch("excommunicate", text("开除伊丽莎白教籍", "Excommunicate Elizabeth I"), () => "excommunicate"));
                }
                branches.push(branch("france", text("法兰西 7 次传播", "7 Catholic attempts in France"), () => "france"));
                branches.push(branch("netherlands", text("尼德兰 7 次传播", "7 Catholic attempts in the Netherlands"), () => "netherlands"));
                const patrons = availablePatrons(G, ally);
                if (patrons.length > 0) {
                    branches.push(branch("patron", text("赞助意大利/HRE 艺术家或科学家", "Sponsor an Italian/HRE patron"),
                        (values) => `patron:${values.patron}`, [param("patron", text("赞助人", "Patron"), () => patronOptions(G, patrons))]));
                }
                if (G.discard.includes("vq-024") && canPlayHolyLeague(G, ally)) {
                    branches.push(branch("holyLeague", text("找回并执行神圣同盟", "Recover and play Holy League"), () => "holyLeague"));
                }
            }
            branches.push(branch("skip", text("不执行任何效果", "Do nothing"), () => "skip"));
            break;
        }
        case "vq-022": {
            branches.push(branch("draw", text("抽 2 张牌（下年 -1）", "Draw 2 (one fewer next year)"), () => "draw"));
            if (power !== "hre" && !(power === "ottoman" && !G.suezDone)) {
                const captains = G.powers[power].seaCaptains.filter((id) => G.worldCaptains[id] === undefined);
                if (captains.length > 0) {
                    branches.push(branch("colonist", text("组建殖民远征并 +3 CP", "Launch a colonist expedition and gain 3 CP"),
                        (values) => values.captain, [param("captain", text("航海家", "Sea captain"), () => captainOptions(captains))]));
                }
            }
            break;
        }
        case "vq-030": {
            const discardTargets = playerPowers(G, power).filter((target) => nonMandatoryCards(G, target).length > 0);
            if (discardTargets.length > 0) {
                branches.push(branch("discard", text("随机弃置目标一张手牌", "Discard a random card from the target"),
                    (values) => values.power, [param("power", text("目标势力", "Target power"), () => powerOptions(discardTargets))]));
            }
            const skipTargets = playerPowers(G, power);
            if (skipTargets.length > 0) {
                branches.push(branch("skip", text("跳过目标的下一个行动轮", "Skip the target's next action round"),
                    (values) => `${values.power}:skip`, [param("power", text("目标势力", "Target power"), () => powerOptions(skipTargets))]));
            }
            const returnTargets = playerPowers(G, power).filter((target) =>
                Object.values(G.leaders).some((leader) => leader.id !== "guise" && LEADER_BY_ID[leader.id]?.power === target &&
                    LEADER_BY_ID[leader.id]?.kind === "army" && leader.location !== "pool" && leader.location !== "dead" && G.spaces[leader.location] !== undefined));
            if (returnTargets.length > 0) {
                branches.push(branch("return", text("跳过行动轮并归还将领", "Skip the action round and return a commander"),
                    (values) => `${values.power}:return${values.leader === undefined || values.leader === "" ? "" : `:${values.leader}`}`, [
                        param("power", text("目标势力", "Target power"), () => powerOptions(returnTargets)),
                        param("leader", text("归还将领（可选）", "Commander to return (optional)"), (values) => {
                            const target = values.power as Power | undefined;
                            if (target === undefined) return [];
                            return leaderOptions(G, Object.values(G.leaders)
                                .filter((leader) => leader.id !== "guise" && LEADER_BY_ID[leader.id]?.power === target &&
                                    LEADER_BY_ID[leader.id]?.kind === "army" && leader.location !== "pool" &&
                                    leader.location !== "dead" && G.spaces[leader.location] !== undefined)
                                .map((leader) => leader.id));
                        }, true),
                    ]));
            }
            break;
        }
        case "vq-032": {
            branches.push(branch("convert", text("法兰西与尼德兰各 7 次传播", "7 attempts in France and the Netherlands"), () => "convert"));
            const targets = rebellionTargets(G);
            if (targets.length > 0) {
                branches.push(branch("rebel", text("单区 7CP 煽动叛乱", "One 7 CP rebellion"),
                    (values) => `rebel:${values.space}`, [param("space", text("地区", "Space"), () => spaceOptions(targets))]));
            }
            if (targets.length > 1) {
                branches.push(branch("double", text("两区 4+3CP 煽动叛乱", "Two rebellions at 4 + 3 CP"), (values) => `double:${values.first}:${values.second}`, [
                    param("first", text("第一地区（4CP）", "First space (4 CP)"), () => spaceOptions(targets)),
                    param("second", text("第二地区（3CP）", "Second space (3 CP)"), (values) =>
                        spaceOptions(targets.filter((id) => id !== values.first))),
                ]));
            }
            break;
        }
        case "vq-033": {
            // The drawer sees the card before it leaves the hand; the engine checks
            // the hand after removal, so the printed "3 or fewer including this card"
            // is 4 before removal.
            const conversionAvailable = (G.powers.france.wars.includes("protestant") || G.powers.protestant.wars.includes("france")) &&
                G.powers.france.cards.length <= 3;
            if (conversionAvailable) {
                branches.push(branch("convert", text("掷骰转化法国", "Roll to convert France"), () => "convert"));
            }
            if (frenchBetrothal(G)) {
                branches.push(branch("festivity", text("婚宴 +2 并抽牌", "Wedding Festivities +2 and draw"), () => "festivity"));
                if (G.discard.includes("vq-053")) {
                    branches.push(branch("retrieve", text("婚宴 +2 并取回大旅行", "Wedding Festivities +2 and recover Grand Tour"), () => "retrieve"));
                }
            }
            break;
        }
        case "vq-035": {
            const patrons = availablePatrons(G, "hre");
            if (patrons.length > 0) {
                branches.push(branch("sponsor", text("赞助意大利/HRE 艺术家或科学家", "Sponsor an Italian/HRE patron"),
                    (values) => values.patron, [param("patron", text("赞助人", "Patron"), () => patronOptions(G, patrons))]));
            }
            const giveTargets = playerPowers(G, "hre");
            if (giveTargets.length > 0) {
                branches.push(branch("give", text("抽 2 张并把一张牌交给其他势力", "Draw 2 and give a card to another power"),
                    (values) => `${values.power}${values.card === undefined || values.card === "" ? "" : `:${values.card}`}`, [
                        param("power", text("接收势力", "Receiving power"), () => powerOptions(giveTargets)),
                        param("card", text("交出的牌（可选）", "Card to give (optional)"), () => cardOptions(nonMandatoryCards(G, "hre").filter((id) => id !== cardId && cardById(id).kind !== "home")), true),
                    ]));
            }
            break;
        }
        case "vq-036": {
            const discardCards = G.discard.filter((id) => cardById(id).kind !== "home");
            if (discardCards.length > 0) {
                branches.push(branch("retrieve", text("取回弃牌堆一张牌", "Recover a card from the discard pile"),
                    (values) => values.card === undefined || values.card === "" ? "retrieve" :
                        `retrieve:${values.card}${values.mode === "play" ? ":play" : ""}`, [
                        param("card", text("取回的牌", "Card to recover"), () => cardOptions(discardCards)),
                        param("mode", text("处理方式", "Resolution"), () => [
                            {value: "keep", label: text("保留在手中", "Keep in hand")},
                            {value: "play", label: text("立即打出", "Play immediately")},
                        ]),
                    ]));
            }
            if (G.betrothals.some((betrothal) => betrothal.female === "elizabeth")) {
                branches.push(branch("jilt", text("解除伊丽莎白的婚约", "Jilt Elizabeth's suitor"), () => "jilt"));
            }
            break;
        }
        case "vq-041": {
            const stealTargets = playerPowers(G, power).filter((target) =>
                borderPower(G, power) && borderPower(G, target) && nonHomeCards(G, target).length > 0);
            if (stealTargets.length > 0) {
                branches.push(branch("steal", text("从边境势力随机抽一张牌", "Take a random card from a border power"),
                    (values) => values.power, [param("power", text("目标势力", "Target power"), () => powerOptions(stealTargets))]));
            }
            if (power === "england" || power === "france" || power === "protestant") {
                branches.push(branch("influence", text("苏格兰 +4 影响力", "+4 influence in Scotland"), () => "influence"));
            }
            break;
        }
        case "vq-053": {
            mode = "two";
            const wars = G.powers.france.wars.filter((target) => isPower(target));
            if (wars.length > 0) {
                branches.push(branch("peace", text("与一个主要势力停战", "Make peace with a major power"),
                    (values) => `peace:${values.power}`, [param("power", text("停战势力", "Power"), () => powerOptions(wars))]));
            }
            if (G.discard.includes("vq-063")) {
                branches.push(branch("retrieve", text("取回诺查丹玛斯", "Recover Nostradamus"), () => "retrieve"));
            }
            const eligibleCards = nonMandatoryCards(G, "france").filter((id) => id !== cardId && cardById(id).kind !== "home");
            if (eligibleCards.length > 0 || G.powers.france.treasures.length > 0) {
                branches.push(branch("give", text("给另一势力一张牌或宝藏", "Give a card or treasure to another power"),
                    (values) => `give:${values.power}${values.card === undefined || values.card === "" ? "" : `:${values.card}`}`, [
                        param("power", text("接收势力", "Receiving power"), () => powerOptions(playerPowers(G, "france"))),
                        param("card", text("交出的牌（可选）", "Card to give (optional)"), () => cardOptions(eligibleCards), true),
                    ]));
            }
            branches.push(branch("move", text("巴黎 +1 正规军并发兵", "Add a regular in Paris and move the stack"),
                (values) => `move:${values.space}`, [param("space", text("目的地", "Destination"), () => spaceOptions(frenchHomeSpaces(G)))]));
            break;
        }
        case "vq-056": {
            branches.push(branch("convert", text("法兰西/尼德兰/苏格兰 6 次传播", "6 Catholic attempts in France, the Netherlands and Scotland"), () => "convert"));
            const pending = [...new Set(G.pendingPatronage.map((entry) => entry.patronId))];
            if (pending.length > 0) {
                branches.push(branch("cancel", text("取消一个赞助人的工作进度", "Cancel a patron's work"),
                    (values) => values.patron, [param("patron", text("赞助人", "Patron"), () => patronOptions(G, pending))]));
            }
            break;
        }
        case "vq-059": {
            if (power === "england") {
                branches.push(branch("cp", text("获得 5CP 用于海军行动", "Gain 5 CP for naval actions"), () => "cp"));
                if (SPACES.some((space) => spaceHomes(space).includes("england") && space.ports !== undefined &&
                    (G.spaces[space.id].naval.england?.galleon ?? 0) > 0)) {
                    branches.push(branch("upgrade", text("升级本土港口大帆船", "Upgrade home-port galleons"), () => "upgrade"));
                }
            }
            const cuts = informantCutTargets(G, power);
            if (cuts.length > 0) {
                branches.push(branch("cut", text("剪除敌方密探并派遣密探", "Cut an enemy informant and plant one"),
                    (values) => values.cut, [param("cut", text("目标", "Target"), () => cuts.map((value) => ({value, label: informantCutLabel(value)})))]));
            }
            break;
        }
        case "vq-060": {
            const scotland = scotlandSpaces();
            if (scotland.length > 0) {
                branches.push(branch("convert", text("转化苏格兰（保留一个地区）", "Convert Scotland (spare one space)"),
                    (values) => values.space, [param("space", text("保留地区", "Spared space"), () => spaceOptions(scotland))]));
            }
            if (power === "england" || power === "protestant") {
                branches.push(branch("influence", text("苏格兰 +4 影响力", "+4 influence in Scotland"), () => "influence"));
            }
            break;
        }
        case "vq-061": {
            branches.push(branch("florida", text("处理佛罗里达殖民地", "Resolve the Florida colony"), () => undefined));
            branches.push(branch("escort", text("增加珍宝舰队护航", "Add a Treasure Fleet escort"), () => "escort"));
            const settlements = WORLD_SETTLEMENTS.filter((settlement) => G.worldControls[settlement.id] === "spain" &&
                G.worldFortresses?.[settlement.id] === undefined);
            if (settlements.length > 0) {
                branches.push(branch("fortress", text("建造要塞并增加巡逻队", "Build a fortress and add a patrol"),
                    (values) => `fortress:${values.settlement}`, [param("settlement", text("定居点", "Settlement"), () =>
                        settlements.map((settlement) => ({value: settlement.id, label: locale() === "en" ? settlement.nameEn : settlement.nameZh})))]));
            }
            break;
        }
        case "vq-065": {
            const cards = nonHomeCards(G, "england");
            if (cards.length > 0) {
                branches.push(branch("give", text("抽一张牌交给新教", "Draw a card and give it to the Protestant"), () => "give"));
                branches.push(branch("discard", text("抽一张牌并由英格兰弃置", "Draw a card and have England discard it"), () => "discard"));
            }
            branches.push(branch("unrest", text("在英格兰放置 3 个动荡", "Place 3 unrest in England"), () => "unrest"));
            break;
        }
        case "vq-067": {
            branches.push(branch("regulars", text("优先移除正规军", "Remove regulars first"), () => "regulars"));
            branches.push(branch("mercs", text("优先用 2 个雇佣兵代替 1 个正规军", "Use 2 mercenaries per regular first"), () => "mercs"));
            break;
        }
        case "vq-071": {
            const targets = playerPowers(G, power).filter((target) => nonHomeCards(G, target).length > 0);
            if (targets.length > 0) {
                const options = () => powerOptions(targets);
                branches.push(branch("take", text("随机抽一张牌并保留", "Take a random card"), (values) => values.power,
                    [param("power", text("目标势力", "Target power"), options)]));
                branches.push(branch("discard", text("检视手牌并弃置一张", "Inspect the hand and discard a card"), (values) => `${values.power}:discard`,
                    [param("power", text("目标势力", "Target power"), options)]));
            }
            break;
        }
        case "vq-080": {
            const leaders = Object.values(G.leaders).filter((leader) => {
                const location = leader.location;
                const space = SPACE_BY_ID[location];
                return LEADER_BY_ID[leader.id]?.kind === "army" && LEADER_BY_ID[leader.id]?.power !== power &&
                    space !== undefined && (space.area === "france" || spaceHomes(space).includes("france")) &&
                    G.spaces[location]?.leaders.includes(leader.id);
            }).map((leader) => leader.id);
            if (leaders.length > 0) {
                branches.push(branch("assassinate", text("刺杀法国境内陆军将领", "Assassinate an army leader in France"),
                    (values) => `assassinate:${values.leader}`, [param("leader", text("目标将领", "Target leader"), () => leaderOptions(G, leaders))]));
            }
            if (espionageAvailable(G)) {
                const espionageTargets = espionagePowers(G, power);
                branches.push(branch("spy", text("派遣密探并进行间谍行动", "Send a spy and run an espionage action"),
                    (values) => `spy:${values.power}`, [param("power", text("目标势力", "Target power"), () => powerOptions(espionageTargets))]));
                branches.push(branch("agents", text("派遣密探并抽一张牌", "Send agents and draw a card"), () => "agents"));
                branches.push(branch("inspectTake", text("检视手牌并随机取一张", "Inspect the hand and take a random card"),
                    (values) => values.power, [param("power", text("目标势力", "Target power"), () => powerOptions(espionageTargets))]));
                branches.push(branch("inspectDraw", text("检视手牌并改抽 2 张", "Inspect the hand and draw 2 instead"),
                    (values) => `${values.power}:draw`, [param("power", text("目标势力", "Target power"), () => powerOptions(espionageTargets))]));
            }
            break;
        }
        case "vq-081": {
            if (espionageAvailable(G)) {
                branches.push(branch("offensive", text("沃尔辛厄姆转为攻势", "Set Walsingham to offensive"), () => "offensive"));
                branches.push(branch("defensive", text("沃尔辛厄姆转为守势", "Set Walsingham to defensive"), () => "defensive"));
                branches.push(branch("neutralize", text("移除敌方密探/耶稣会士并进行情报行动", "Remove an operative and run an intelligence action"),
                    (values) => values.power, [param("power", text("目标势力", "Target power"), () => powerOptions(espionagePowers(G, power)))]));
            }
            break;
        }
        case "vq-091": {
            const targets = espionagePowers(G, power);
            if (targets.length > 0) {
                branches.push(branch("place", text("放置/移动密码表", "Place or move the Cipher Key"),
                    (values) => values.power, [param("power", text("目标势力", "Target power"), () => powerOptions(targets))]));
            }
            if (POWERS.some((target) => G.espionage?.cipherKeys[target] === power)) {
                branches.push(branch("remove", text("移除己方密码表", "Remove own Cipher Key"), () => "remove"));
            }
            break;
        }
        case "vq-098": {
            const ownEligible = nonHomeCards(G, power).filter((id) => id !== cardId);
            const canExchange = power === "ottoman" && G.powers.ottoman.ruler === "muradIII" && numPlayers >= 5 &&
                ownEligible.length > 0;
            if (canExchange) {
                const targets = otherPowers(power).filter((target) => nonHomeCards(G, target).length > 0);
                if (targets.length > 0) {
                    branches.push(branch("exchange", text("与另一势力交换手牌", "Exchange a card with another power"),
                        (values) => `${values.power}${values.card === undefined || values.card === "" ? "" : `::${values.card}`}`, [
                            param("power", text("目标势力", "Target power"), () => powerOptions(targets)),
                            param("card", text("交给对方的牌（可选）", "Card to give (optional)"), () => cardOptions(ownEligible), true),
                        ]));
                }
            }
            if (MINOR_DIPLOMACY.venice.eligible.includes(power) && !G.minorDiplomacyResolved.includes("venice")) {
                branches.push(branch("venice", text("威尼斯 +2 影响力并评议", "+2 influence in Venice and resolve diplomacy"), () => "venice"));
            }
            break;
        }
        case "vq-099": {
            if (G.armada === undefined) {
                const ports = armadaPorts(G, power);
                if (ports.length > 0) {
                    branches.push(branch("deploy", text("部署无敌舰队并 +5CP", "Deploy the Armada and gain 5 CP"),
                        (values) => `deploy:${values.port}`, [param("port", text("港口", "Port"), () => spaceOptions(ports))]));
                }
            } else {
                branches.push(branch("reinforce", text("获得 7CP 用于无敌舰队", "Gain 7 CP for the Armada"), () => "reinforce"));
            }
            break;
        }
        case "vq-105": {
            const allied = G.powers[power].alliedMinors.includes("portugal");
            if (!allied && MINOR_DIPLOMACY.portugal.eligible.includes(power) && !G.minorDiplomacyResolved.includes("portugal") && minorAvailable(G, "portugal")) {
                branches.push(branch("influence", text("葡萄牙 +3 影响力并评议", "+3 influence in Portugal and resolve diplomacy"), () => "influence"));
            }
            if (allied) {
                const spaces = portugalHomeSpaces(G);
                if (spaces.length > 0) {
                    branches.push(branch("regulars", text("在葡萄牙放置 3 个正规军", "Place 3 Portuguese regulars"),
                        (values) => values.space, [param("space", text("地区", "Space"), () => spaceOptions(spaces))]));
                }
            }
            break;
        }
        default:
            break;
    }

    // Cards that only expose one engine branch still render the panel as a
    // confirmation so the player sees which printed effect will resolve.
    if (branches.length === 0) return undefined;
    const defaultIds = cardId === "vq-005" ? ["france"]
        : cardId === "vq-053" ? ["retrieve", "move"]
        : undefined;
    return {mode, maxSelections: mode === "two" ? 2 : 1, branches, defaultIds};
};

/** Keeps stored selections valid when the board state or branch list changes. */
export const effectiveBranchIds = (choice: EventBranchChoice, selected: string[]): string[] => {
    const available = new Set(choice.branches.map((entry) => entry.id));
    const kept = [...new Set(selected.filter((id) => available.has(id)))];
    const defaults = (choice.defaultIds ?? []).filter((id) => available.has(id));
    if (choice.mode === "single") return [kept[0] ?? defaults[0] ?? choice.branches[0].id];
    if (kept.length > 0) return kept.slice(0, choice.maxSelections);
    const initial = defaults.length > 0 ? defaults : choice.branches.map((entry) => entry.id);
    return initial.slice(0, Math.min(choice.maxSelections, choice.branches.length));
};

/** Fills defaults for dependent parameters in declaration order. */
export const branchParamValues = (branchDef: EventBranch, stored: Record<string, string> = {}): Record<string, string> => {
    const values: Record<string, string> = {};
    for (const spec of branchDef.params) {
        const options = spec.options(values);
        const current = stored[spec.id];
        values[spec.id] = options.some((option) => option.value === current)
            ? current
            : (spec.optional ? "" : options[0]?.value ?? "");
    }
    return values;
};

/** Joins the selected branch targets with the `|` grammar used by #53. */
export const eventBranchTarget = (branches: EventBranch[], values: Record<string, Record<string, string>>): string | undefined => {
    const targets = branches
        .map((entry) => entry.target(values[entry.id] ?? {}))
        .filter((target): target is string => target !== undefined && target !== "");
    return targets.length === 0 ? undefined : targets.join("|");
};
