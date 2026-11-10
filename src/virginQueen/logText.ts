import {AREA_NAMES, MINOR_NAMES, POWER_NAMES, POWERS, VQLocale} from "./constant/general";
import {LEADERS} from "./constant/leaders";
import {SEA_ZONES, SPACES} from "./mapData";
import {PATRONS} from "./data/patrons";
import {ROYALS} from "./data/royals";
import {SEA_CAPTAINS} from "./data/seaCaptains";
import {WORLD_SEA_ZONES, WORLD_SETTLEMENTS} from "./data/world";

/**
 * Display-time Chinese translation for the engine log.
 *
 * The engine keeps writing English (the exported log, saved games and the
 * tests all rely on that).  The board resolves each line through this module
 * instead, so the same match can be viewed in Chinese or English without the
 * log becoming locale-dependent state.
 */

type Rule = [RegExp, string | ((...matches: string[]) => string)];

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const names = new Map<string, string>();

const addName = (english: string | undefined, chinese: string | undefined): void => {
    if (english === undefined || chinese === undefined || english === chinese) return;
    names.set(english, chinese);
};

for (const space of SPACES) addName(space.name, space.nameZh);
for (const zone of SEA_ZONES) addName(zone.name, zone.nameZh);
for (const zone of SEA_ZONES) addName(zone.id, zone.nameZh);
for (const leader of LEADERS) addName(leader.name, leader.nameZh);
for (const royal of ROYALS) addName(royal.nameEn, royal.nameZh);
for (const patron of PATRONS) addName(patron.nameEn, patron.nameZh);
for (const captain of SEA_CAPTAINS) addName(captain.nameEn, captain.nameZh);
for (const zone of WORLD_SEA_ZONES) addName(zone.nameEn, zone.nameZh);
for (const settlement of WORLD_SETTLEMENTS) {
    addName(settlement.nameEn, settlement.nameZh);
    addName(settlement.id, settlement.nameZh);
}
for (const [id, entry] of Object.entries(MINOR_NAMES)) {
    addName(id, entry.zh);
    addName(entry.en, entry.zh);
}
for (const power of POWERS) {
    addName(power, POWER_NAMES[power].zh);
    addName(POWER_NAMES[power].en, POWER_NAMES[power].zh);
    addName(POWER_NAMES[power].short, POWER_NAMES[power].zh);
}
for (const [id, entry] of Object.entries(AREA_NAMES)) addName(entry.en, entry.zh);
addName("Protestant", "新教联盟");
addName("Protestants", "新教联盟");
addName("Ottoman", "奥斯曼帝国");
addName("Spanish", "西班牙");
addName("English", "英格兰");
addName("French", "法国");
addName("Catholic", "天主教");
addName("Protestant", "新教");
addName("Persia", "波斯");
addName("Poland", "波兰");
addName("The Duke of Guise", "吉斯公爵");
addName("Catholic League", "天主教联盟");
addName("Holy League", "神圣联盟");
addName("Spanish Armada", "西班牙无敌舰队");
addName("The Armada", "无敌舰队");
addName("Armada", "无敌舰队");
addName("Duke of Guise", "吉斯公爵");
addName("Mary Queen of Scots", "苏格兰女王玛丽");
addName("Virgin Queen", "童贞女王");
addName("Treasure Fleet", "珍宝舰队");
addName("Turn Track", "回合记录轨");
addName("Mercenaries for Hire", "雇佣兵征募标记");
addName("Prague Cultural Center", "布拉格文化中心");
addName("Prague", "布拉格");

const sortedNames = [...names.keys()].sort((a, b) => b.length - a.length);
const namePattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${sortedNames.map(escapeRegExp).join("|")})(?=$|[^\\p{L}\\p{N}])`, "gu");

const localizeNames = (text: string): string =>
    text.replace(namePattern, (_match, prefix: string, english: string) =>
        `${prefix}${names.get(english) ?? english}`);

const side = (value: string): string => value === "field" ? "野战" : value === "naval" ? "海战" : "强攻";
const religion = (value: string): string => value === "catholic" ? "天主教" : value === "protestant" ? "新教" : value;
const phase = (value: string): string => value === "spring" ? "春季部署" : value === "action" ? "行动阶段" : value === "diplomacy" ? "外交阶段" : value;
const unitKind = (value: string): string => ({
    regular: "正规军", merc: "雇佣兵", mercenary: "雇佣兵", cav: "骑兵", cavalry: "骑兵",
    galley: "桨帆船", galleon: "大帆船", racebuilt: "快帆船", "race-built": "快帆船", corsair: "海盗船",
    fortress: "要塞", patrol: "巡逻队",
}[value] ?? value);

const RULES: Rule[] = [
    // ---------------------------------------------------------------- setup / turn
    [/^Winter ends\. Turn (\d+) begins\.$/, (_m, turn) => `冬季结束，第 ${turn} 回合开始。`],
    [/^Winter ends\. Scenario turn (\d+) is complete\.$/, (_m, turn) => `冬季结束，剧本第 ${turn} 回合结束。`],
    [/^Deck reshuffled from the discard pile\.$/, "弃牌堆洗回抽牌堆。"],
    [/^(.+) draws (.+) card\(s\)\.$/, (_m, p, n) => `${p} 抽 ${n} 张牌。`],
    [/^(.+) discards (.+) card\(s\)\.$/, (_m, p, n) => `${p} 弃置 ${n} 张牌。`],
    [/^(.+) discards (.+) treasure\(s\)\.$/, (_m, p, n) => `${p} 弃置 ${n} 个宝藏。`],
    [/^(.+) gains (.+) treasure\(s\)\.$/, (_m, p, n) => `${p} 获得 ${n} 个宝藏。`],
    [/^([^\s]+) gains (\d+) VP\.$/, (_m, p, n) => `${p} 获得 ${n} 分。`],
    [/^(.+) gains (.+) influence with (.+)\.$/, (_m, p, n, target) => `${p} 获得对 ${target} 的 ${n} 点影响力。`],
    [/^(.+) passes\.$/, (_m, p) => `${p} 跳过。`],
    [/^(.+) passes \(no card played\)\.$/, (_m, p) => `${p} 跳过（未出牌）。`],
    [/^(.+) replacement: \+1 regular in (.+)\.$/, (_m, p, space) => `${p} 冬季补员：${space} +1 正规军。`],
    [/^(.+) replacement: \+2 mercenaries in (.+)\.$/, (_m, p, space) => `${p} 冬季补员：${space} +2 雇佣兵。`],
    [/^(.+) replacement: (.+) marker moves from 0 to 4\.$/, (_m, p, marker) => `${p} 冬季补员：${marker.trim()}从 0 移到 4。`],
    [/^(.+) replacement: choose 1 regular, 2 mercenaries, or the (.+) marker 0→4\.$/, (_m, p, marker) => `${p} 冬季补员：选择 1 正规军、2 雇佣兵，或将 ${marker.trim()} 从 0 移到 4。`],
    // The engine logs the Catholic League check verbatim; without these rules
    // the line keeps most of its English text even in the Chinese UI.
    [/^(?:Catholic League|天主教联盟) check: the (?:Protestants|新教联盟) control (\d+) keys in (?:France|法国), so the League forms automatically\.$/,
        (_m, keys) => `天主教联盟检查：新教控制法国 ${keys} 个关键地区，联盟自动成立。`],
    [/^(?:Catholic League|天主教联盟) check: (\d+) (?:French|法国) home space\(s\) under (?:Protestant|新教) control; not formed this year\.$/,
        (_m, homes) => `天主教联盟检查：新教控制 ${homes} 个法国本土地区；本年度未成立。`],
    [/^(?:Catholic League|天主教联盟) check: (\d+) (?:French|法国) home space\(s\) \+ die (\d+) = (\d+) — (formed!|not formed\.)$/,
        (_m, homes, rolled, total, outcome) =>
            `天主教联盟检查：法国本土 ${homes} + 掷骰 ${rolled} = ${total}${outcome === "formed!" ? "，成立！" : "，未成立。"}`],
    [/^(.+) records its secret religious preference\.$/, (_m, p) => `${p} 记录了秘密宗教倾向。`],
    [/^(.+) gains (\d+) 巴黎 VP\.$/, (_m, p, n) => `${p} 获得 ${n} 点巴黎 VP。`],
    [/^(.+) returns to the pool; (.+) must choose a home port\.$/, (_m, leader, p) => `${leader} 返回人员池；${p} 必须选择本国港口。`],
    [/^(.+) returns from the pool; (.+) must choose a home port\.$/, (_m, leader, p) => `${leader} 从人员池返回；${p} 必须选择本国港口。`],
    [/^(.+) wins the Polish election and gains 2 VP\.$/, (_m, p) => `${p} 赢得波兰选举并获得 2 分。`],
    [/^(.+) ends the foreign war and gains 1 War Winner VP\.$/, (_m, p) => `${p} 结束境外战争并获得 1 点战争胜利分。`],
    [/^(.+) launches (.+)'s expedition from (.+) with a colony\.$/, (_m, p, captain, zone) => `${p} 从 ${zone} 发起 ${captain} 的远征（携带殖民地）。`],
    [/^(.+) pays tribute: (.+) takes a treasure\.$/, (_m, p, ottoman) => `${p} 纳贡：${ottoman} 取得一个宝藏。`],
    [/^(.+) pays tribute: (.+) takes a card\.$/, (_m, p, ottoman) => `${p} 纳贡：${ottoman} 取得一张牌。`],
    [/^(.+) refuses tribute; (.+) declares war and gains 2 CP\.$/, (_m, p, ottoman) => `${p} 拒绝纳贡；${ottoman} 宣战并获得 2 CP。`],
    [/^(.+) has nothing to pay; (.+) declares war and gains 2 CP\.$/, (_m, p, ottoman) => `${p} 无物可纳；${ottoman} 宣战并获得 2 CP。`],
    [/^(.+) plays (.+) as an event\.$/, (_m, p, card) => `${p} 将 ${card} 作为事件打出。`],
    [/^(.+) plays (.+) for (\d+) CP\.$/, (_m, p, card, cp) => `${p} 将 ${card} 作为 ${cp} CP 打出。`],
    [/^(.+) plays (.+) for the (field|naval|assault) battle\.$/, (_m, p, card, phaseName) => `${p} 打出 ${card} 用于${side(phaseName)}。`],
    [/^(.+) extends the impulse with a (\d+) CP treasure\.$/, (_m, p, cp) => `${p} 用一个 ${cp} CP 宝藏延续行动轮。`],
    [/^(.+) receives (\d+) CP after the mandatory event\.$/, (_m, p, cp) => `${p} 在强制事件后获得 ${cp} CP。`],
    [/^(.+) pays (\d+) CP for the declaration of war\.$/, (_m, p, cp) => `${p} 支付 ${cp} CP 宣战。`],
    [/^(.+) declares war on (.+)\.$/, (_m, p, target) => `${p} 向 ${target} 宣战。`],
    [/^(.+) and (.+) make peace\.$/, (_m, a, b) => `${a} 与 ${b} 议和。`],
    [/^(.+) and (.+) end their war by agreement\.$/, (_m, a, b) => `${a} 与 ${b} 协商结束战争。`],
    [/^(.+) and (.+) form an alliance for this turn\.$/, (_m, a, b) => `${a} 与 ${b} 本回合结盟。`],

    // ---------------------------------------------------------------- movement / control
    [/^(.+) moves (.+) unit\(s\) from (.+) to (.+)\.$/, (_m, p, n, from, to) => `${p} 将 ${n} 个单位从 ${from} 移动到 ${to}。`],
    [/^(.+) transports (.+) units from (.+) to (.+)\.$/, (_m, p, n, from, to) => `${p} 将 ${n} 个单位从 ${from} 海运到 ${to}。`],
    [/^(.+) sails from (.+) to (.+)\.$/, (_m, p, from, to) => `${p} 从 ${from} 航行到 ${to}。`],
    [/^(.+) takes control of (.+)\.$/, (_m, p, place) => `${p} 控制 ${place}。`],
    [/^(.+) removes unrest from (.+)\.$/, (_m, p, place) => `${p} 移除 ${place} 的动荡。`],
    [/^(.+) redeploys (.+) unit\(s\) from (.+) to (.+)\.$/, (_m, p, n, from, to) => `${p} 将 ${n} 个单位从 ${from} 重新部署到 ${to}。`],
    [/^(.+) loads (\d+) land unit\(s\) onto the Armada\.$/, (_m, p, n) => `${p} 将 ${n} 个陆军单位装载到无敌舰队。`],
    [/^(.+) unloads the Armada's land units into port\.$/, (_m, p) => `${p} 将无敌舰队的陆军单位卸到港口。`],
    [/^Spain places (.+) as a naval leader in (.+)\.$/, (_m, leader, port) => `西班牙将 ${leader} 作为海军将领部署到 ${port}。`],
    [/^(.+) places (.+) as a naval leader in (.+)\.$/, (_m, p, leader, port) => `${p} 将 ${leader} 作为海军将领部署到 ${port}。`],
    [/^(.+) arrives in (.+)\.$/, (_m, leader, place) => `${leader} 抵达 ${place}。`],
    [/^(.+) joins the rebellion in (.+)\.$/, (_m, leader, place) => `${leader} 加入 ${place} 的叛乱。`],
    [/^(.+) returns to the pool; (.+) must choose a home port\.$/, (_m, leader, p) => `${leader} 返回人员池；${p} 必须选择本国港口。`],
    [/^(.+) returns from the pool; (.+) must choose a home port\.$/, (_m, leader, p) => `${leader} 从人员池返回；${p} 必须选择本国港口。`],
    [/^(.+) returns to (.+) with the fleet\.$/, (_m, leader, port) => `${leader} 随舰队返回 ${port}。`],
    [/^(.+) loses the fleet and returns home\.$/, (_m, leader) => `${leader} 失去舰队并返回本土。`],

    // ---------------------------------------------------------------- recruitment / construction
    [/^(.+) recruits 1 regular for (.+) in (.+)\.$/, (_m, p, owner, place) => `${p} 在 ${place} 为 ${owner} 征募 1 个正规军。`],
    [/^(.+) recruits 1 (.+) in (.+)\.$/, (_m, p, kind, place) => `${p} 在 ${place} 征募 1 个${unitKind(kind)}。`],
    [/^(.+) builds a (.+) in (.+?)( \(Hawkins\))?\.$/, (_m, p, kind, place, hawkins) => `${p} 在 ${place} 建造 ${unitKind(kind)}${hawkins ? "（霍金斯）" : ""}。`],
    [/^(.+) builds a fortress in (.+)\.$/, (_m, p, place) => `${p} 在 ${place} 建造要塞。`],
    [/^(.+) raises (.+) mercenary unit\(s\) in (.+)\.$/, (_m, p, n, place) => `${p} 在 ${place} 征募 ${n} 个雇佣兵。`],
    [/^(.+) places (\d+) (.+) unit\(s\) in (.+)\.$/, (_m, p, n, kind, place) => `${p} 在 ${place} 放置 ${n} 个${unitKind(kind)}。`],

    // ---------------------------------------------------------------- combat
    [/^Interception from (.+): \[(.+)\] \+ (.+): (success|failed)\.$/, (_m, from, dice, mod, result) => `从 ${from} 拦截：[${dice}] + ${mod}：${result === "success" ? "成功" : "失败"}。`],
    [/^(.+) naval interception from (.+): \[(.+)\] \+ (.+) = (.+)\.$/, (_m, p, from, dice, mod, total) => `${p} 海军从 ${from} 拦截：[${dice}] + ${mod} = ${total}。`],
    [/^(.+) interception from (.+): \[(.+)\] \+ (.+) = (.+)\.$/, (_m, p, from, dice, mod, total) => `${p} 从 ${from} 拦截：[${dice}] + ${mod} = ${total}。`],
    [/^(.+) intercepts the move into (.+)\.$/, (_m, p, place) => `${p} 拦截进入 ${place} 的移动。`],
    [/^(.+) intercepts the naval move into (.+)\.$/, (_m, p, place) => `${p} 拦截驶向 ${place} 的海军移动。`],
    [/^(.+) avoid-battle at (.+): \[(.+)\] \+ (.+) = (.+)\.$/, (_m, p, place, dice, mod, total) => `${p} 在 ${place} 尝试避战：[${dice}] + ${mod} = ${total}。`],
    [/^(.+) naval avoid battle at (.+): \[(.+)\] \+ (.+) = (.+)\.$/, (_m, p, place, dice, mod, total) => `${p} 在 ${place} 尝试海上避战：[${dice}] + ${mod} = ${total}。`],
    [/^(.+) avoids battle and moves to (.+)\.$/, (_m, p, place) => `${p} 避战并移动到 ${place}。`],
    [/^(.+) avoids naval battle\.$/, (_m, p) => `${p} 避开海战。`],
    [/^(.+) automatically avoids battle after losing a field battle\.$/, (_m, p) => `${p} 在野战失败后自动避战。`],
    [/^(.+) declines Beacon Fires\.$/, (_m, p) => `${p} 放弃打出烽火。`],
    [/^(.+) plays Beacon Fires: interception succeeds automatically\.$/, (_m, p) => `${p} 打出烽火：拦截自动成功。`],
    [/^(.+) naval force is eliminated \(no retreat\)\.$/, (_m, p) => `${p} 海军部队被消灭（无路可退）。`],
    [/^(.+) naval force retreats to (.+)\.$/, (_m, p, place) => `${p} 海军部队撤退到 ${place}。`],
    [/^Both naval forces are eliminated; (.+) retains 1 galley\.$/, (_m, p) => `双方海军部队均被消灭；${p} 保留 1 艘桨帆船。`],
    [/^(.+) retains 1 unit after both sides are eliminated\.$/, (_m, p) => `双方均被消灭后，${p} 保留 1 个单位。`],
    [/^(.+) loses the battle at the end of a naval transport; (.+) transported unit\(s\) are eliminated\.$/, (_m, p, n) => `${p} 在海运结束时战败；${n} 个运输单位被消灭。`],
    [/^(.+) has no retreat; its force is destroyed\.$/, (_m, p) => `${p} 无路可退，其部队被消灭。`],
    [/^(.+) retreats to (.+)\.$/, (_m, p, place) => `${p} 撤退到 ${place}。`],
    [/^(.+) cannot besiege (.+) and withdraws\.$/, (_m, p, place) => `${p} 无法围困 ${place}，随即撤退。`],
    [/^(.+) wins the relief battle; the siege of (.+) is broken\.$/, (_m, p, place) => `${p} 赢得解围战；${place} 的围城被解除。`],
    [/^(.+) relief force is defeated; choose how many units stay inside \(max (\d+)\)\.$/, (_m, p, max) => `${p} 的解围部队战败；选择多少单位留在城内（最多 ${max} 个）。`],
    [/^The siege of (.+) is broken\.$/, (_m, place) => `${place} 的围城被解除。`],
    [/^(.+) brings (.+) relief unit\(s\) into (.+)\.$/, (_m, p, n, place) => `${p} 带领 ${n} 个解围单位进入 ${place}。`],
    [/^(.+) captures (.+)!$/, (_m, p, place) => `${p} 攻占 ${place}！`],
    [/^The defenders of (.+) withdraw into the fortifications; the space is under siege\.$/, (_m, place) => `${place} 的守军退入要塞工事；该地区被围困。`],
    [/^The defenders of (.+) withdraw into the fortifications\.$/, (_m, place) => `${place} 的守军退入要塞工事。`],
    [/^([^\s]+) is under siege\.$/, (_m, place) => `${place} 被围困。`],
    [/^(\d+) defender\(s\) withdraw into the fortifications\.$/, (_m, n) => `${n} 个守军退入要塞工事。`],
    [/^The siege is broken\.$/, "围城被解除。"],
    [/^The defenders withdraw; the active formation may spend 1 CP to continue or return\.$/, "守军撤退；行动编队可花费 1 CP 继续或返回。"],
    [/^Not enough troops to besiege the space; the formation returns\.$/, "兵力不足以围困该地区；编队返回。"],
    [/^(\d+) surplus defender\(s\) are eliminated for want of a retreat\.$/, (_m, n) => `${n} 个多余守军因无路可退被消灭。`],
    [/^(\d+) surplus defender\(s\) retreat to (.+)\.$/, (_m, n, place) => `${n} 个多余守军撤退到 ${place}。`],
    [/^(\d+) unit\(s\) stay inside; (\d+) fall back to (.+)\.$/, (_m, inside, out, place) => `${inside} 个单位留在城内；${out} 个退回 ${place}。`],
    [/^(.+) surrenders to (.+)\.$/, (_m, place, p) => `${place} 向 ${p} 投降。`],
    [/^The independent garrison is destroyed\.$/, "独立守军被消灭。"],

    // ---------------------------------------------------------------- diplomacy / influence
    [/^(.+) diplomacy: (.+)\. (.+) wins\.$/, (_m, minor, rolls, winner) => `${minor} 外交：${rolls}。${winner} 获胜。`],
    [/^(.+) deactivates (.+)\.$/, (_m, p, minor) => `${p} 使 ${minor} 停用。`],
    [/^(.+) activates (.+) as an ally\.$/, (_m, p, minor) => `${p} 使 ${minor} 作为盟友激活。`],
    [/^(.+) buys influence with (.+) \((\d+)\)\.$/, (_m, p, target, value) => `${p} 购买对 ${target} 的影响力（${value}）。`],
    [/^(.+) is activated by (.+) and draws (\d+) cards\.$/, (_m, p, ally, n) => `${p} 由 ${ally} 激活并抽 ${n} 张牌。`],
    [/^(.+) is deactivated\.$/, (_m, p) => `${p} 停用。`],
    [/^(.+) is deactivated with the Holy Roman Empire\.$/, (_m, minor) => `${minor} 随神圣罗马帝国一同停用。`],
    [/^(.+) receives (.+) VP from (.+)\.$/, (_m, ally, vp, p) => `${ally} 从 ${p} 获得 ${vp} 分。`],

    // ---------------------------------------------------------------- religion / winter / losses
    [/^(.+) land units in (.+) are eliminated \(no friendly home space\)\.$/, (_m, p, place) => `${p} 在 ${place} 的陆军单位因无友方本土而消灭。`],
    [/^(.+) land units return from (.+) to (.+)\.$/, (_m, p, from, to) => `${p} 的陆军单位从 ${from} 返回 ${to}。`],
    [/^(.+) naval units in (.+) are eliminated \(no friendly home port\)\.$/, (_m, p, place) => `${p} 在 ${place} 的海军单位因无友方本土港口而消灭。`],
    [/^(.+) naval units return from (.+) to (.+)\.$/, (_m, p, from, to) => `${p} 的海军单位从 ${from} 返回 ${to}。`],
    [/^(.+) units in (.+) are eliminated \(no friendly power\)\.$/, (_m, p, place) => `${p} 在 ${place} 的单位因无友方势力而消灭。`],
    [/^(.+) land units withdraw from (.+) to (.+)\.$/, (_m, p, from, to) => `${p} 的陆军单位从 ${from} 撤往 ${to}。`],
    [/^(.+) land units in (.+) are eliminated \(no friendly fortified space\)\.$/, (_m, p, place) => `${p} 在 ${place} 的陆军单位因无友方设防地区而消灭。`],
    [/^(.+) naval units withdraw from (.+) to (.+)\.$/, (_m, p, from, to) => `${p} 的海军单位从 ${from} 撤往 ${to}。`],
    [/^(.+) naval units in (.+) are eliminated \(no friendly port\)\.$/, (_m, p, place) => `${p} 在 ${place} 的海军单位因无友方港口而消灭。`],
    [/^(.+) land units are displaced from (.+) to (.+)\.$/, (_m, p, from, to) => `${p} 的陆军单位从 ${from} 被遣返到 ${to}。`],
    [/^(.+) naval units are displaced from (.+) to (.+)\.$/, (_m, p, from, to) => `${p} 的海军单位从 ${from} 被遣返到 ${to}。`],
    [/^(.+) loses (\d+) unit\(s\) in (.+): no winter quarters\.$/, (_m, p, n, place) => `${p} 在 ${place} 损失 ${n} 个单位：没有冬季营地。`],
    [/^(.+) loses (\d+) unit\(s\) to winter attrition in (.+)\.$/, (_m, p, n, place) => `${p} 在 ${place} 因冬季损耗损失 ${n} 个单位。`],
    [/^(.+) has no capital and loses (\d+) overstacked unit\(s\) in (.+)\.$/, (_m, p, n, place) => `${p} 没有首都，在 ${place} 损失 ${n} 个超编单位。`],
    [/^(.+) returns (\d+) unit\(s\) from (.+) to (.+)\.$/, (_m, p, n, from, to) => `${p} 将 ${n} 个单位从 ${from} 撤回 ${to}。`],
    [/^(.+) withdraws (\d+) unit\(s\) from (.+) to (.+)\.$/, (_m, p, n, from, to) => `${p} 将 ${n} 个单位从 ${from} 撤往 ${to}。`],
    [/^(.+) keeps the automatic winter losses in (.+)\.$/, (_m, p, place) => `${p} 保留 ${place} 的自动冬季损失。`],
    [/^(.+) keeps the automatic winter naval losses in (.+)\.$/, (_m, p, place) => `${p} 保留 ${place} 的自动冬季海军损失。`],
    [/^(.+) keeps the automatic winter loss composition\.$/, (_m, p) => `${p} 保留自动冬季损失构成。`],
    [/^(.+) keeps the automatic winter naval loss composition\.$/, (_m, p) => `${p} 保留自动冬季海军损失构成。`],
    [/^(.+) loses (\d+) (.+) unit\(s\) in (.+) to winter attrition\.$/, (_m, p, n, kind, place) => `${p} 在 ${place} 因冬季损耗损失 ${n} 个${unitKind(kind)}。`],
    [/^(.+) confirms the Morisco removal in (.+)\.$/, (_m, p, place) => `${p} 确认移除 ${place} 的摩尔人单位。`],
    [/^(.+) records (\d+) (.+) unit\(s\) lost in (.+) with no winter port\.$/, (_m, p, n, kind, place) => `${p} 记录在 ${place} 因无冬季港口损失 ${n} 个${unitKind(kind)}。`],
    [/^(.+) fleet in (.+) has no port to return to and is eliminated\.$/, (_m, p, place) => `${p} 在 ${place} 的舰队无港口可返，被消灭。`],
    [/^(.+) fleet returns from (.+) to (.+)\.$/, (_m, p, from, to) => `${p} 的舰队从 ${from} 返回 ${to}。`],
    [/^(.+) returns (\d+) leader\(s\) home for the winter\.$/, (_m, p, n) => `${p} 在冬季将 ${n} 名将领送回本土。`],
    [/^(.+) places (\d+) unrest in (.+) home spaces\.$/, (_m, p, n, target) => `${p} 在 ${target} 的本土地区放置 ${n} 个动荡。`],
    [/^Unrest in (.+)\.$/, (_m, place) => `${place} 出现动荡。`],
    [/^Unrest is placed in (.+)\.$/, (_m, places) => `在 ${places} 放置动荡。`],
    [/^Converted: (.+?); unrest in (\d+) space\(s\)\.$/, (_m, places, n) => `已转化：${places}；${n} 个地区出现动荡。`],
    [/^Converted: (.+)$/, (_m, places) => `已转化：${places}`],
    [/^No conversions possible\.$/, "没有可转化的地区。"],
    [/^(.+) conversions in (.+): \[(.+)\]$/, (_m, sideName, area, dice) => `${religion(sideName)}在 ${area} 的转化：[${dice}]`],
    [/^(.+) conversion in (.+)\.$/, (_m, sideName, place) => `${place} 转为${religion(sideName)}。`],

    // ---------------------------------------------------------------- rulers, royals, marriages
    [/^Rudolf II dies; the \+2 Prague Cultural Center marker is removed from the game\.$/, "鲁道夫二世死亡；+2 布拉格文化中心标记移出游戏。"],
    [/^Rudolf II marries; the \+2 Prague Cultural Center marker is removed from the game\.$/, "鲁道夫二世结婚；+2 布拉格文化中心标记移出游戏。"],
    [/^Rudolf II is assassinated; the Holy Roman Empire drops to 1 Admin and 0 card bonus\.$/, "鲁道夫二世遇刺；神圣罗马帝国降至 1 点行政、0 张额外牌。"],
    [/^Elizabeth I dies; England drops to 1 Admin and 0 card bonus\.$/, "伊丽莎白一世死亡；英格兰降至 1 点行政、0 张额外牌。"],
    [/^Henry III is murdered; France drops to 1 Admin and 0 card bonus\.$/, "亨利三世被谋杀；法国降至 1 点行政、0 张额外牌。"],
    [/^Philip II is murdered; Spain drops to 1 Admin and 0 card bonus\.$/, "腓力二世被谋杀；西班牙降至 1 点行政、0 张额外牌。"],
    [/^Charles IX is murdered; France drops to 0 Admin and 0 card bonus until Henry III takes the throne\.$/, "查理九世被谋杀；法国在亨利三世继位前降至 0 点行政、0 张额外牌。"],
    [/^Mary Queen of Scots dies\.$/, "苏格兰女王玛丽死亡。"],
    [/^Mary Queen of Scots is executed after Elizabeth's death \(−1 VP\)\.$/, "伊丽莎白死后，苏格兰女王玛丽被处决（−1 分）。"],
    [/^England executes Mary Queen of Scots \(−1 VP\)\.$/, "英格兰处决苏格兰女王玛丽（−1 分）。"],
    [/^(.+) is no longer eligible to marry\.$/, (_m, royal) => `${royal} 不再具有结婚资格。`],
    [/^(.+) & (.+): Marriage roll: (.+)$/, (_m, male, female, roll) => `${male} 与 ${female} 婚姻掷骰：${roll}`],
    [/^(.+) & (.+): (.+)$/, (_m, male, female, roll) => `${male} 与 ${female}：${roll}`],
    [/^(.+) announces the marriage of (.+) and (.+)\.$/, (_m, p, male, female) => `${p} 宣布 ${male} 与 ${female} 结婚。`],
    [/^(.+) spends 1 HRE influence to arrange a marriage between (.+) and (.+)\.$/, (_m, p, male, female) => `${p} 花费 1 点神圣罗马影响力促成 ${male} 与 ${female} 的婚姻。`],
    [/^(.+) proposes a marriage between (.+) and (.+)\.$/, (_m, p, male, female) => `${p} 提议让 ${male} 与 ${female} 结婚。`],
    [/^(.+) and (.+) are betrothed\.$/, (_m, male, female) => `${male} 与 ${female} 订婚。`],
    [/^(.+)'s marriage proposal was rejected\.$/, (_m, p) => `${p} 的婚姻提议被拒绝。`],
    [/^Founders of a Dynasty: each power gains 2 Wedding VP\.$/, "王朝奠基：各势力获得 2 点婚礼分。"],
    [/^True Love: each power gains 1 Wedding VP and a \+1 Card marker\.$/, "真爱：各势力获得 1 点婚礼分和 1 个 +1 抽牌标记。"],
    [/^Several Children: each power gains 1 Wedding VP\.$/, "多子多孙：各势力获得 1 点婚礼分。"],
    [/^Benevolent Rulers: each power gains a \+1 Card marker\.$/, "仁君：各势力获得 1 个 +1 抽牌标记。"],
    [/^No Issue: the marriage produces no effect\.$/, "无子嗣：婚姻没有效果。"],
    [/^Last Minute Cancellation: both royals return to the pool\.$/, "最后一刻取消：两位王室成员返回人员池。"],
    [/^Always Feuding: each power gains a -1 Card marker\.$/, "争吵不休：各势力获得 1 个 -1 抽牌标记。"],
    [/^Death in Childbirth: (.+) dies\.$/, (_m, female) => `难产死亡：${female} 死亡。`],
    [/^Rumors of Murder: (.+) is murdered\.$/, (_m, male) => `谋杀传闻：${male} 被谋杀。`],
    [/^(.+) is jilted by Elizabeth I: (.+)\.$/, (_m, p, roll) => `${p} 被伊丽莎白一世抛弃：${roll}。`],
    [/^Elizabeth I remains unmarried: England gains 1 Virgin Queen VP \((\d+)\/(\d+)\)\.$/, (_m, a, b) => `伊丽莎白一世仍未结婚：英格兰获得 1 点童贞女王分（${a}/${b}）。`],
    [/^(.+) gains (\d+) \+1 Card marker\(s\)\.$/, (_m, p, n) => `${p} 获得 ${n} 个 +1 抽牌标记。`],
    [/^(.+) gains (\d+) CP for Diplomatic Influence and\/or Mercenaries\.$/, (_m, p, cp) => `${p} 获得 ${cp} CP，用于外交影响力或雇佣兵。`],
    [/^No compensation is awarded\.$/, "没有补偿。"],
    [/^(.+) becomes ruler of France\.$/, (_m, ruler) => `${ruler} 成为法国统治者。`],
    [/^(.+) becomes Ottoman ruler\.$/, (_m, ruler) => `${ruler} 成为奥斯曼统治者。`],
    [/^(.+) becomes Holy Roman Emperor; the capital moves to Prague\.$/, (_m, ruler) => `${ruler} 成为神圣罗马皇帝；首都迁往布拉格。`],
    [/^Selim II succeeds Suleiman before Turn 3 \(Scenario Book card clarification #6\)\.$/, "塞利姆二世在第 3 回合前继承苏莱曼（场景书卡牌说明 #6）。"],
    [/^Selim II succeeds Suleiman; the Cyprus VP target is (.+)\.$/, (_m, target) => `塞利姆二世继承苏莱曼；塞浦路斯胜利目标为 ${target}。`],
    [/^Murad III becomes Ottoman ruler\.$/, "穆拉德三世成为奥斯曼统治者。"],

    // ---------------------------------------------------------------- cards / events (common)
    [/^(.+) falls ill: (.+) will skip its next action round\.$/, (_m, ruler, p) => `${ruler} 患病：${p} 将跳过下一个行动轮。`],
    [/^Ruler Falls Ill: (.+) will skip its next action round\.$/, (_m, p) => `统治者患病：${p} 将跳过下一个行动轮。`],
    [/^Ruler Falls Ill: (.+) returns to (.+)\.$/, (_m, leader, place) => `统治者患病：${leader} 返回 ${place}。`],
    [/^Ruler Falls Ill discards (.+) from (.+)\.$/, (_m, card, p) => `统治者患病：${p} 弃置 ${card}。`],
    [/^Siege Engineering cancels Flooding\.$/, "攻城工程取消洪水。"],
    [/^Flooding lifts the siege and halves the attacker's mercenaries\.$/, "洪水解除围城，并将攻方雇佣兵减半。"],
    [/^Desperate Assault makes attacker hits 4-6 and doubles defender dice\.$/, "绝望强攻使攻方 4–6 命中，并将守方骰数翻倍。"],
    [/^Siege Engineering adds 3 dice to the assault\.$/, "攻城工程给强攻增加 3 个骰子。"],
    [/^Tilbury Speech adds (\d+) dice to the assault\.$/, (_m, n) => `蒂尔伯里演说给强攻增加 ${n} 个骰子。`],
    [/^Tilbury Speech adds (\d+) dice to the defense\.$/, (_m, n) => `蒂尔伯里演说给防守增加 ${n} 个骰子。`],
    [/^Venetian Galleasses add (\d+) dice to the (.+)\.$/, (_m, n, sideName) => `威尼斯桨帆船给${sideName === "attacker" ? "攻方" : "守方"}增加 ${n} 个骰子。`],
    [/^(.+) leaves play because a standard army leader arrived\.$/, (_m, leader) => `${leader} 因标准陆军将领登场而离场。`],
    [/^(.+) places a Default Leader on the Turn Track\.$/, (_m, p) => `${p} 在回合记录轨放置一名默认将领。`],
    [/^(.+) returns to (.+)'s sea captain pool\.$/, (_m, captain, p) => `${captain} 返回 ${p} 的海船长池。`],
    [/^(.+) returns to (.+)'s sea captain pool at Winter\.$/, (_m, captain, p) => `${captain} 在冬季返回 ${p} 的海船长池。`],
    [/^(.+) returns to England's sea captain pool\.$/, (_m, captain) => `${captain} 返回英格兰的海船长池。`],
    [/^(.+)'s expedition is eliminated; the captain is removed from the game\.$/, (_m, captain) => `${captain} 的远征被消灭；该船长移出游戏。`],
    [/^(.+)'s already damaged expedition is eliminated; the captain goes to the Turn Track\.$/, (_m, captain) => `${captain} 已受损的远征被消灭；该船长进入回合记录轨。`],
    [/^(.+)'s expedition is damaged\.$/, (_m, captain) => `${captain} 的远征受损。`],
    [/^(.+) completes a circumnavigation; (.+) gains (\d+) VP\.$/, (_m, captain, p, vp) => `${captain} 完成环球航行；${p} 获得 ${vp} 分。`],
    [/^(.+) captures a treasure\.$/, (_m, captain) => `${captain} 夺取一个宝藏。`],
    [/^(.+) gains 1 piracy VP\.$/, (_m, p) => `${p} 获得 1 点海盗分。`],
    [/^(.+) is damaged\.$/, (_m, captain) => `${captain} 受损。`],
    [/^(.+)'s expedition is eliminated\.$/, (_m, captain) => `${captain} 的远征被消灭。`],
    [/^Colony (.+) is eliminated\.$/, (_m, settlement) => `殖民地 ${settlement} 被消灭。`],
    [/^Colony (.+) yields a treasure and 1 Virginia Dare VP\.$/, (_m, settlement) => `殖民地 ${settlement} 产出 1 个宝藏和 1 点弗吉尼亚·戴尔分。`],
    [/^Colony (.+) yields a treasure\.$/, (_m, settlement) => `殖民地 ${settlement} 产出 1 个宝藏。`],
    [/^Colony (.+) has no effect this turn\.$/, (_m, settlement) => `殖民地 ${settlement} 本回合没有效果。`],
    [/^(.+) is removed from play \(result 6 or less\)\.$/, (_m, patron) => `${patron} 被移出游戏（结果 6 或以下）。`],
    [/^(.+) is removed from play \(rating 1; result 7-8\)\.$/, (_m, patron) => `${patron} 被移出游戏（评级 1；结果 7–8）。`],
    [/^(.+) returns to the available pool \(result 7-8\)\.$/, (_m, patron) => `${patron} 返回可用池（结果 7–8）。`],
    [/^(.+) returns to the available pool \(result 9\)\.$/, (_m, patron) => `${patron} 返回可用池（结果 9）。`],
    [/^(.+) is finished and removed from the available pool\.$/, (_m, patron) => `${patron} 完成并移出可用池。`],
    [/^(.+) returns to the available pool because no award was available\.$/, (_m, patron) => `${patron} 因无可用奖项而返回可用池。`],
    [/^(.+) claims (.+) \(\+(.+) VP\)\.$/, (_m, p, award, vp) => `${p} 获得 ${award}（+${vp} 分）。`],
    [/^(.+) claims science bonus (.+)\.$/, (_m, p, bonus) => `${p} 获得科学奖励 ${bonus}。`],
    [/^(.+) sponsors (.+) for (\d+) CP; Winter Patronage resolution is pending\.$/, (_m, p, patron, cp) => `${p} 花费 ${cp} CP 赞助 ${patron}；冬季赞助结算待处理。`],
    [/^(.+) sponsors (.+) for (.+)\.$/, (_m, p, patron, target) => `${p} 为 ${target} 赞助 ${patron}。`],
    [/^(.+) cancels (.+)\.$/, (_m, source, card) => `${source} 取消 ${card}。`],

    // ---------------------------------------------------------------- foreign wars / piracy / world
    [/^(.+) commits (\d+) unit\(s\)(?: and (.+))? to the (.+) war\.$/, (_m, p, n, leader, enemy) => `${p} 向${enemy}战争投入 ${n} 个单位${leader ? `和 ${leader}` : ""}。`],
    [/^(.+) ends the foreign war( and gains 1 War Winner VP)?\.$/, (_m, p, vp) => `${p} 结束境外战争${vp ? "并获得 1 点战争胜利分" : ""}。`],
    [/^(.+) loses (\d+) unit\(s\); (.+) loses (\d+)\.$/, (_m, p, own, enemy, enemyLosses) => `${p} 损失 ${own} 个单位；${enemy} 损失 ${enemyLosses} 个。`],
    [/^(.+) recruits 1 (.+) directly into the (.+) war\.$/, (_m, p, kind, enemy) => `${p} 直接向${enemy}战争征募 1 个${unitKind(kind)}。`],
    [/^(.+) establishes a colony at (.+)\.$/, (_m, p, place) => `${p} 在 ${place} 建立殖民地。`],
    [/^(.+) launches (.+)'s expedition from (.+)( with a colony)?\.$/, (_m, p, captain, zone, colony) => `${p} 从 ${zone} 发起 ${captain} 的远征${colony ? "（携带殖民地）" : ""}。`],
    [/^(.+) sails to (.+)\.$/, (_m, p, zone) => `${p} 航行到 ${zone}。`],
    [/^(.+) is eliminated during world piracy\.$/, (_m, captain) => `${captain} 在世界海盗行动中被消灭。`],
    [/^(.+) suffers scurvy \(-1 Navigation\)\.$/, (_m, captain) => `${captain} 患上坏血病（−1 航海值）。`],
    [/^(.+) becomes an Experienced Navigator \(Navigation (\d+)\)\.$/, (_m, captain, nav) => `${captain} 成为经验丰富的航海家（航海值 ${nav}）。`],
    [/^(.+) builds a patrol in (.+)\.$/, (_m, p, zone) => `${p} 在 ${zone} 建造巡逻队。`],
    [/^(.+) builds a fortress at (.+)\.$/, (_m, p, place) => `${p} 在 ${place} 建造要塞。`],
    [/^(.+) destroys the Spanish fortress at (.+)\.$/, (_m, captain, place) => `${captain} 摧毁 ${place} 的西班牙要塞。`],
    [/^Drake and Hawkins combine into a single English expedition\.$/, "德雷克与霍金斯合并为一支英格兰远征队。"],

    // ---------------------------------------------------------------- misc card events
    [/^(.+) is completed! Ottoman gains 2 VP and \+1 card\.$/, (_m, project) => `${project} 完工！奥斯曼获得 2 分和 +1 张牌。`],
    [/^The Suez Canal is completed! Ottoman gains 2 VP and \+1 card\.$/, "苏伊士运河完工！奥斯曼获得 2 分和 +1 张牌。"],
    [/^(.+) is reinforced with 2 galleons in (.+) \(\+1 VP\)\.$/, (_m, fleet, port) => `${fleet} 在 ${port} 获得 2 艘大帆船增援（+1 分）。`],
    [/^(.+) places (\d+) unrest in (.+) home spaces\.$/, (_m, p, n, target) => `${p} 在 ${target} 的本土地区放置 ${n} 个动荡。`],
    [/^(.+) removes unrest from (.+)\.$/, (_m, p, place) => `${p} 移除 ${place} 的动荡。`],
    [/^(.+) discards a random treasure\.$/, (_m, p) => `${p} 随机弃置一个宝藏。`],
    [/^(.+) discards a (\d+) CP treasure from (.+)\.$/, (_m, who, cp, p) => `${who} 从 ${p} 弃置一个 ${cp} CP 宝藏。`],
    [/^(.+) secretly inspects (.+)'s hand\.$/, (_m, viewer, target) => `${viewer} 秘密查看 ${target} 的手牌。`],
    [/^(.+) plants a Jesuit in (.+)\.$/, (_m, p, place) => `${p} 在 ${place} 放置耶稣会士。`],
    [/^(.+) plants an informant on (.+)\.$/, (_m, p, target) => `${p} 在 ${target} 安插间谍。`],
    [/^(.+) adds an informant on (.+)\.$/, (_m, p, target) => `${p} 在 ${target} 增加一名间谍。`],
    [/^(.+) already has an informant on (.+); no informant is added\.$/, (_m, p, target) => `${p} 已在 ${target} 安插间谍；不再增加。`],
    [/^Double Agent: (.+)'s informant on (.+) returns to its force pool\.$/, (_m, enemy, p) => `双面间谍：${enemy} 在 ${p} 的间谍返回人员池。`],
    [/^John Hawkins: (.+)'s informant on (.+) is cut\.$/, (_m, enemy, p) => `约翰·霍金斯：${enemy} 在 ${p} 的间谍被剪除。`],
    [/^(.+) killed; (.+) gains 1 VP\.$/, (_m, target, p) => `${target} 被杀；${p} 获得 1 分。`],
    [/^(.+) would remove England's informant; England may respond with Walsingham\.$/, (_m, source) => `${source} 将移除英格兰的间谍；英格兰可用沃尔辛厄姆响应。`],
    [/^Priest Holes prevents Jesuit neutralization\.$/, "神父藏身所阻止耶稣会士被无效化。"],
    [/^England responds with Walsingham before the English informant is neutralized\.$/, "英格兰在间谍被无效化前用沃尔辛厄姆响应。"],
    [/^(.+) neutralized informant\(s\) returned to their owners\.$/, (_m, n) => `${n} 名被无效化的间谍返回其所属方。`],
    [/^(.+) is no longer eligible to marry\.$/, (_m, royal) => `${royal} 不再具有结婚资格。`],
    [/^(.+) finds nothing to discard\.$/, (_m, who) => `${who} 没有可弃置的牌。`],
    [/^(.+) discards (.+) from (.+)\.$/, (_m, who, card, p) => `${who} 从 ${p} 弃置 ${card}。`],
    [/^(.+) takes (.+) from (.+)\.$/, (_m, who, card, p) => `${who} 从 ${p} 取得 ${card}。`],
    [/^(.+) gives (.+) to (.+)\.$/, (_m, who, card, p) => `${who} 将 ${card} 交给 ${p}。`],
    [/^(.+) gives a random card to (.+)\.$/, (_m, p, target) => `${p} 随机给 ${target} 一张牌。`],
    [/^(.+) gives a mercenary to (.+) in (.+)\.$/, (_m, p, target, place) => `${p} 在 ${place} 给 ${target} 一名雇佣兵。`],
    [/^(.+) gives a treasure to (.+)\.$/, (_m, p, target) => `${p} 给 ${target} 一个宝藏。`],
    [/^(.+) loans one (.+) to (.+)\.$/, (_m, p, kind, target) => `${p} 借给 ${target} 一个${kind}。`],
    [/^(.+)'s loaned (.+) returns from (.+)\.$/, (_m, lender, kind, borrower) => `${lender} 借出的${kind}从 ${borrower} 返回。`],
    [/^(.+) yields control of (.+) to (.+)\.$/, (_m, p, place, target) => `${p} 将 ${place} 的控制权交给 ${target}。`],
    [/^(.+) returns (.+) to (.+) in (.+)\.$/, (_m, p, leader, owner, place) => `${p} 将 ${leader} 交还给 ${owner}，位于 ${place}。`],
    [/^(.+) is ransomed and returns to (.+)\.$/, (_m, leader, place) => `${leader} 被赎回并返回 ${place}。`],
    [/^(.+) leader\(s\) captured by (.+)\.$/, (_m, n, p) => `${p} 俘获 ${n} 名将领。`],
    [/^(.+) keeps one Home card and sets (\d+) face down on the power card\.$/, (_m, p, n) => `${p} 保留 1 张本国牌，并将 ${n} 张面朝下放在势力卡上。`],
    [/^(.+) places (\d+) (.+) unit\(s\) in (.+)\.$/, (_m, p, n, kind, place) => `${p} 在 ${place} 放置 ${n} 个${unitKind(kind)}。`],
    [/^(.+) gains (\d+) influence with (.+)\.$/, (_m, p, n, target) => `${p} 获得对 ${target} 的 ${n} 点影响力。`],
    [/^(.+) draws two cards but draws one fewer next year\.$/, (_m, p) => `${p} 抽两张牌，但下一年少抽一张。`],
    [/^(.+) draws two cards instead of taking one\.$/, (_m, p) => `${p} 抽两张牌而非一张。`],
    [/^(.+) draws two cards and gives (.+) to (.+)\.$/, (_m, p, card, target) => `${p} 抽两张牌并将 ${card} 交给 ${target}。`],
    [/^(.+) draws two cards and gives (.+) to (.+)\.$/, (_m, p, card, target) => `${p} 抽两张牌并将 ${card} 交给 ${target}。`],
    [/^(.+) exchanges a card with (.+)\.$/, (_m, p, target) => `${p} 与 ${target} 交换一张牌。`],
    [/^(.+) takes a (.+) CP treasure from (.+)\.$/, (_m, p, cp, target) => `${p} 从 ${target} 取得一个 ${cp} CP 宝藏。`],
    [/^(.+) takes a card\.$/, (_m, p) => `${p} 取得一张牌。`],
    [/^(.+) takes a treasure\.$/, (_m, p) => `${p} 取得一个宝藏。`],
    [/^(.+) refuses tribute; (.+) declares war on (.+) and gains 2 CP\.$/, (_m, p, ottoman) => `${p} 拒绝纳贡；${ottoman} 宣战并获得 2 CP。`],
    [/^(.+) pays tribute: (.+) takes a treasure\.$/, (_m, p, ottoman) => `${p} 纳贡：${ottoman} 取得一个宝藏。`],
    [/^(.+) pays tribute: (.+) takes a card\.$/, (_m, p, ottoman) => `${p} 纳贡：${ottoman} 取得一张牌。`],
    [/^(.+) has nothing to pay; (.+) declares war and gains 2 CP\.$/, (_m, p, ottoman) => `${p} 无物可纳；${ottoman} 宣战并获得 2 CP。`],
    [/^(.+) loses (\d+) unit\(s\); (.+) loses (\d+)\.$/, (_m, p, own, enemy, enemyLosses) => `${p} 损失 ${own} 个单位；${enemy} 损失 ${enemyLosses} 个。`],
    [/^(.+) adds (\d+) (.+) influence in (.+)\.$/, (_m, p, n, target) => `${p} 在 ${target} 增加 ${n} 点影响力。`],
    [/^(.+) converts (\d+) (.+) space\(s\)(.*)$/, (_m, who, n, kind, suffix) => `${who} 转化 ${n} 个${kind}地区${suffix}`],
    [/^(.+) places a Jesuit in (.+); (\d+) conversion attempt\(s\)\.$/, (_m, who, place, n) => `${who} 在 ${place} 放置耶稣会士；进行 ${n} 次转化尝试。`],
    [/^(.+) removes (\d+) Jesuit\(s\), converts England, and Spain gains \+1 Card\.$/, (_m, who, n) => `${who} 移除 ${n} 名耶稣会士，转化英格兰，西班牙获得 +1 张牌。`],
    [/^(.+) removes the colony at (.+)( and draws a treasure)?\.$/, (_m, who, place, draw) => `${who} 移除 ${place} 的殖民地${draw ? "并抽一个宝藏" : ""}。`],
    [/^(.+) fortifies (.+) and adds a patrol\.$/, (_m, who, place) => `${who} 加固 ${place} 并增加一支巡逻队。`],
    [/^(.+) adds a galleon to the Treasure Fleet escorts\.$/, (_m, who) => `${who} 为珍宝舰队护航增加 1 艘大帆船。`],
    [/^Spain assigns (\d+) galleon\(s\) to Treasure Fleet escort\.$/, (_m, n) => `西班牙指派 ${n} 艘大帆船为珍宝舰队护航。`],
    [/^(.+) assigns (\d+) galleon\(s\) to Treasure Fleet escort\.$/, (_m, p, n) => `${p} 指派 ${n} 艘大帆船为珍宝舰队护航。`],
    [/^(.+) appears in (.+) with (\d+) treasure\(s\)\.$/, (_m, fleet, zone, n) => `${fleet} 出现在 ${zone}，携带 ${n} 个宝藏。`],
    [/^An escorting galleon is eliminated\.$/, "一艘护航大帆船被消灭。"],
    [/^The Spanish Armada is rebuilt in (.+)\.$/, (_m, port) => `西班牙无敌舰队在 ${port} 重建。`],
    [/^The Armada returns to (.+)\.$/, (_m, port) => `无敌舰队返回 ${port}。`],
    [/^The Armada has no port to return to and is eliminated\.$/, "无敌舰队无港口可返，被消灭。"],
    [/^Spain has no legal port for the Armada\.$/, "西班牙没有可使无敌舰队停靠的合法港口。"],
    [/^The Spanish Armada is placed in (.+); Spain gains 5 CP\.$/, (_m, port) => `西班牙无敌舰队被放置在 ${port}；西班牙获得 5 CP。`],
    [/^Spain uses Armada naval transport at (.+)\.$/, (_m, port) => `西班牙在 ${port} 使用无敌舰队海运。`],
    [/^Spain upgrades the Armada to strength (\d+)\.$/, (_m, strength) => `西班牙将无敌舰队提升到强度 ${strength}。`],
    [/^Spain gains 7 CP for the Armada\.$/, "西班牙为无敌舰队获得 7 CP。"],
    [/^(.+) grants (.+) (\d+) CP for the Armada\.$/, (_m, card, p, cp) => `${card} 给予 ${p} ${cp} CP 用于无敌舰队。`],
    [/^Armada Pardon grants Spain (\d+) CP for the Armada\.$/, (_m, cp) => `无敌舰队赦免给予西班牙 ${cp} CP 用于无敌舰队。`],
    [/^Spanish Pay Ships Seized removes (\d+) Spanish unit\(s\) and (.+) draws a card\.$/, (_m, n, p) => `西班牙付薪船被夺取：移除 ${n} 个西班牙单位，${p} 抽一张牌。`],
    [/^(.+) upgrades English home-port galleons to race-built galleons\.$/, (_m, who) => `${who} 将英格兰本土港口的大帆船升级为快帆船。`],
    [/^(.+) grants England 5 CP for naval operations\.$/, (_m, who) => `${who} 给予英格兰 5 CP 用于海军行动。`],
    [/^(.+) places (\d+) regular\(s\) for (.+)\.$/, (_m, card, n, p) => `${card} 为 ${p} 放置 ${n} 个正规军。`],
    [/^A Small Aid adds 1 (.+) regular to (.+)\.$/, (_m, owner, place) => `小援助在 ${place} 增加 1 个${owner}正规军。`],
    [/^(.+) removes (\d+) influence from (.+)\.$/, (_m, card, n, p) => `${card} 从 ${p} 移除 ${n} 点影响力。`],
    [/^(.+) removes (.+)\.$/, (_m, card, removed) => `${card} 移除 ${removed}。`],
    [/^(.+) forces an assault on (.+)\.$/, (_m, card, place) => `${card} 迫使对 ${place} 发起强攻。`],
    [/^(.+) strikes (.+) in (.+)\.$/, (_m, card, p, place) => `${card} 打击 ${place} 的 ${p}。`],
    [/^(.+) departs for (.+); the expedition ends and returns next turn\.$/, (_m, captain, place) => `${captain} 前往 ${place}；远征结束，下回合返回。`],
    [/^(.+) cancels (.+)'s work\.$/, (_m, card, patron) => `${card} 取消 ${patron} 的作品。`],
    [/^(.+) ends the Polish war; the Holy Roman Empire is considered victorious\.$/, (_m, card) => `${card} 结束波兰战争；神圣罗马帝国被视为胜利。`],
    [/^(.+) ends the HRE's foreign war\.$/, (_m, card) => `${card} 结束神圣罗马帝国的境外战争。`],
    [/^(.+) wins the Polish election and gains 2 VP\.$/, (_m, p) => `${p} 赢得波兰选举并获得 2 分。`],
    [/^No candidate exceeds 5; no Polish election VP is awarded\.$/, "没有候选人超过 5；不颁发波兰选举分。"],
    [/^(.+) bids (\d+) and rolls (.+) = (.+)\.$/, (_m, p, bid, roll, score) => `${p} 出价 ${bid}，掷出 ${roll} = ${score}。`],
    [/^(.+) makes peace between (.+) and (.+)\.$/, (_m, card, a, b) => `${card} 促成 ${a} 与 ${b} 议和。`],
    [/^(.+) clears French unrest and reinforces Paris for (.+)\.$/, (_m, card, p) => `${card} 清除法国动荡并为 ${p} 增援巴黎。`],
    [/^(.+) takes Paris and moves the Huguenot capital there\.$/, (_m, card) => `${card} 夺取巴黎并将胡格诺首都迁往该地。`],
    [/^(.+) seizes Paris and places 4 regulars\.$/, (_m, card) => `${card} 夺取巴黎并放置 4 个正规军。`],
    [/^(.+) seizes (.+) for the Protestant\.$/, (_m, card, place) => `${card} 为新教夺取 ${place}。`],
    [/^(.+) raises the Protestant cause and takes Bayonne\.$/, (_m, card) => `${card} 振奋新教事业并夺取巴约讷。`],
    [/^(.+) raises the Protestant cause and takes (.+)\.$/, (_m, card, place) => `${card} 振奋新教事业并夺取 ${place}。`],
    [/^(.+) enters the marriage pool for (.+)\.$/, (_m, royal, p) => `${royal} 进入 ${p} 的婚姻池。`],
    [/^(.+) enters play; (?:England|英格兰) starts with 1 diplomatic influence there\.$/, (_m, power) => `${power} 进入游戏；英格兰初始拥有 1 点外交影响力。`],
    [/^(.+) rises: Ulster is cleared and 3 Irish rebels are placed\.$/, (_m, event) => `${event}：阿尔斯特被清空，并放置 3 个爱尔兰叛军。`],
    [/^(.+) places 3 Portuguese regulars in (.+)\.$/, (_m, who, place) => `${who} 在 ${place} 放置 3 个葡萄牙正规军。`],
    [/^(.+) appears in (.+); (.+) must commit 3–8 land units\.$/, (_m, n, enemy, p) => `${n} 个单位的敌军出现在 ${enemy}；${p} 必须投入 3–8 个陆军单位。`],
    [/^(.+) is dead; the Virgin Queen event has no effect\.$/, (_m, royal) => `${royal} 已死亡；童贞女王事件没有效果。`],
    [/^(.+) is dead; the card is removed after play\.$/, (_m, royal) => `${royal} 已死亡；该牌结算后移出游戏。`],
    [/^(.+) adds (\d+) French influence in Scotland\.$/, (_m, card, n) => `${card} 在苏格兰增加 ${n} 点法国影响力。`],
    [/^(.+) adds (\d+) (.+) influence in Scotland\.$/, (_m, card, n, p) => `${card} 在苏格兰增加 ${n} 点${p}影响力。`],
    [/^(.+) finds no card in the discard pile\.$/, (_m, p) => `${p} 在弃牌堆中没有找到牌。`],
    [/^(.+) retrieves (.+) from the discard pile\.$/, (_m, p, card) => `${p} 从弃牌堆取回 ${card}。`],
    [/^(.+) cannot play (.+) from the discard pile\.$/, (_m, p, card) => `${p} 无法从弃牌堆打出 ${card}。`],
    [/^(.+) cannot play (.+) now; it remains in the discard pile\.$/, (_m, p, card) => `${p} 现在无法打出 ${card}；它留在弃牌堆。`],
    [/^(.+) takes (.+) from the discard pile\.$/, (_m, p, card) => `${p} 从弃牌堆取得 ${card}。`],
    [/^(.+) remains in the discard pile\.$/, (_m, card) => `${card} 留在弃牌堆。`],
    [/^(.+) keeps (.+) and returns the rest\.$/, (_m, p, card) => `${p} 保留 ${card}，其余返回。`],
    [/^(.+) discards (.+) from (.+)\.$/, (_m, who, card, p) => `${who} 从 ${p} 弃置 ${card}。`],
    [/^(.+) places unrest in (\d+) English space\(s\)\.$/, (_m, card, n) => `${card} 在 ${n} 个英格兰地区放置动荡。`],
    [/^(.+) converts (\d+) Netherlands space\(s\) to Protestant\.$/, (_m, card, n) => `${card} 将 ${n} 个尼德兰地区转为新教。`],
    [/^(.+) removes Dutch mercenaries, secures five spaces, and raises Walloon guards\.$/, (_m, card) => `${card} 移除荷兰雇佣兵，确保五个地区，并征募瓦隆卫队。`],
    [/^(.+) removes (\d+) Jesuit\(s\), converts England, and Spain gains \+1 Card\.$/, (_m, who, n) => `${who} 移除 ${n} 名耶稣会士，转化英格兰，西班牙获得 +1 张牌。`],
    [/^(.+) is eliminated during world piracy\.$/, (_m, captain) => `${captain} 在世界海盗行动中被消灭。`],
    [/^(.+) fails to roll 4-6; England takes a -1 Slave Trader VP marker\.$/, (_m, who) => `${who} 未能掷出 4–6；英格兰获得 −1 奴隶贩子分标记。`],
    [/^A Portuguese patrol is eliminated\.$/, "一支葡萄牙巡逻队被消灭。"],
    [/^A Spanish patrol is eliminated\.$/, "一支西班牙巡逻队被消灭。"],
    [/^The Florida colony is removed and Spain takes control\.$/, "佛罗里达殖民地被移除，西班牙取得控制。"],
    [/^(.+) — the Florida colony is removed and Spain takes control\.$/, (_m, roll) => `${roll}——佛罗里达殖民地被移除，西班牙取得控制。`],
    [/^(.+) — the Florida colony survives\.$/, (_m, roll) => `${roll}——佛罗里达殖民地幸存。`],
    [/^(.+) — the colony survives\.$/, (_m, roll) => `${roll}——殖民地幸存。`],
    [/^(.+) — the colony is destroyed\.$/, (_m, roll) => `${roll}——殖民地被摧毁。`],
    [/^(.+) — Dragut dies; Uluch Ali returns next turn\.$/, (_m, roll) => `${roll}——德拉加特死亡；乌卢奇·阿里下回合返回。`],
    [/^(.+) — Dragut returns next turn\.$/, (_m, roll) => `${roll}——德拉加特下回合返回。`],
    [/^(.+) surrenders to (.+)\.$/, (_m, place, p) => `${place} 向 ${p} 投降。`],

    // ---------------------------------------------------------------- lastRolls summaries
    [/^Piracy \[(.+)\] = (.+) hits$/, (_m, dice, hits) => `海盗 [${dice}] = ${hits} 次命中`],
    [/^Piracy defense \[(.+)\] = (.+) hits\.$/, (_m, dice, hits) => `海盗防守 [${dice}] = ${hits} 次命中。`],
    [/^World piracy defense: \[(.+)\] = (.+) hit\(s\)$/, (_m, dice, hits) => `世界海盗防守：[${dice}] = ${hits} 次命中`],
    [/^World piracy \((.+)\): \[(.+)\] = (.+) hit\(s\)$/, (_m, captain, dice, hits) => `世界海盗（${captain}）：[${dice}] = ${hits} 次命中`],
    [/^City State Rebels: \[(.+)\] = (.+) hit\(s\)$/, (_m, dice, hits) => `城邦起义：[${dice}] = ${hits} 次命中`],
    [/^City State Rebels \[(.+)\] = (.+) hit\(s\)$/, (_m, dice, hits) => `城邦起义 [${dice}] = ${hits} 次命中`],
    [/^Sea Beggars piracy \[(.+)\] = (.+) hit\(s\)$/, (_m, dice, hits) => `海上乞丐海盗 [${dice}] = ${hits} 次命中`],
    [/^Dunkirk Privateers \[(.+)\] = (.+) hit\(s\)$/, (_m, dice, hits) => `敦刻尔克私掠者 [${dice}] = ${hits} 次命中`],
    [/^Rebellion dice: \[(.+)\] = (.+) hit\(s\)$/, (_m, dice, hits) => `叛乱骰：[${dice}] = ${hits} 次命中`],
    [/^Holy Roman Intercession: \[(.+)\] = (.+) unrest$/, (_m, dice, n) => `神圣罗马调停：[${dice}] = ${n} 个动荡`],
    [/^Naval battle at (.+): (.+) hits \((.+) dice\) vs (.+) (.+) hits \((.+) dice\)$/, (_m, place, ah, ad, p, dh, dd) => `${place} 海战：${ah} 次命中（${ad} 骰）对 ${p} ${dh} 次命中（${dd} 骰）`],
    [/^Field battle: (.+) (.+) hits \((.+) dice\) vs (.+) defenders (.+) hits \((.+) dice\)$/, (_m, p, ah, ad, n, dh, dd) => `野战：${p} ${ah} 次命中（${ad} 骰）对 ${n} 个守军 ${dh} 次命中（${dd} 骰）`],
    [/^Relief battle at (.+): (.+) (.+) hits \((.+) dice\) vs besiegers (.+) hits \((.+) dice\)$/, (_m, place, p, ah, ad, dh, dd) => `${place} 解围战：${p} ${ah} 次命中（${ad} 骰）对围城军 ${dh} 次命中（${dd} 骰）`],
    [/^Assault on (.+): (.+) hits \((.+) dice\) vs (.+) hits \((.+) dice\)$/, (_m, place, ah, ad, dh, dd) => `${place} 强攻：${ah} 次命中（${ad} 骰）对 ${dh} 次命中（${dd} 骰）`],
    [/^(field|naval|assault): \[(.+)\] (.+) hits; \[(.+)\] (.+) hits$/, (_m, phaseName, ad, ah, dd, dh) => `${side(phaseName)}：[${ad}] ${ah} 次命中；[${dd}] ${dh} 次命中`],
    [/^Marriage roll: (.+)$/, (_m, roll) => `婚姻掷骰：${roll}`],
    [/^Patronage: (.+) (\d+)\+(\d+)\+rating (.+)\+bonus (.+)=(.+)$/, (_m, patron, d1, d2, rating, bonus, total) => `赞助：${patron} ${d1}+${d2}+评级 ${rating}+加值 ${bonus}=${total}`],
    [/^Suez Canal attempt: (.+)$/, (_m, roll) => `苏伊士运河尝试：${roll}`],
    [/^Jilted by Elizabeth: (.+)$/, (_m, roll) => `被伊丽莎白抛弃：${roll}`],
    [/^Lost Colony \((.+)\): (.+)$/, (_m, place, roll) => `失落殖民地（${place}）：${roll}`],
    [/^Dragut Falls: (.+)$/, (_m, roll) => `德拉加特陨落：${roll}`],
    [/^Foreign war: (.+) (.+) dice \[(.+)\] = (.+); (.+) (.+) dice \[(.+)\] = (.+)$/, (_m, p, ad, ar, ah, enemy, ed, er, eh) => `境外战争：${p} ${ad} 骰 [${ar}] = ${ah}；${enemy} ${ed} 骰 [${er}] = ${eh}`],
    [/^Navigation \((.+)\): \[(.+)\] \+ (.+)(.*)$/, (_m, captain, dice, nav, rest) => `航海（${captain}）：[${dice}] + ${nav}${rest}`],
    [/^Colony (.+): \[(.+)\] \+ (.+) plantation \+ (.+) fortress = (.+)$/, (_m, place, dice, plantation, fort, total) => `殖民地 ${place}：[${dice}] + ${plantation} 种植园 + ${fort} 要塞 = ${total}`],
    [/^Treasure Fleet attack by (.+): (.+) hits vs (.+)$/, (_m, captain, hits, defense) => `${captain} 攻击珍宝舰队：${hits} 次命中对 ${defense}`],
    [/^(.+): \[(.+)\] (.+) hits; defense (.+) \[(.+)\] = (.+) hits$/, (_m, kind, atk, ah, defDice, def, dh) => `${kind}：[${atk}] ${ah} 次命中；防守 ${defDice} 骰 [${def}] = ${dh} 次命中`],
    [/^Menéndez de Avilés: (.+)$/, (_m, roll) => `梅嫩德斯·德·阿维莱斯：${roll}`],
    [/^([^:]+): \[(.+)\] = (.+) hit\(s\)$/, (_m, label, dice, hits) => `${label}：[${dice}] = ${hits} 次命中`],
    [/^([^:]+): \[(.+)\]$/, (_m, label, dice) => `${label}：[${dice}]`],
];

const STATIC: Record<string, string> = {
    "The Spanish Armada is eliminated.": "西班牙无敌舰队被消灭。",
    "Siege Engineering cancels Flooding.": "攻城工程取消洪水。",
    "No conversions possible.": "没有可转化的地区。",
    "The siege is broken.": "围城被解除。",
    "The rebellion fails.": "叛乱失败。",
    "The independent garrison is destroyed.": "独立守军被消灭。",
    "The Duke of Guise cannot leave the French religious struggle area and is eliminated.": "吉斯公爵不能离开法国宗教斗争区，被消灭。",
    "The Protestant seizes Cyprus.": "新教夺取塞浦路斯。",
    "The Ottoman seizes the Cyprus VP target and gains 1 VP.": "奥斯曼夺取塞浦路斯胜利目标并获得 1 分。",
    "The Holy Roman Empire gains 1 Master of Central Europe VP.": "神圣罗马帝国获得 1 点中欧霸主分。",
    "Deck reshuffled from the discard pile.": "弃牌堆洗回抽牌堆。",
    "Founders of a Dynasty: each power gains 2 Wedding VP.": "王朝奠基：各势力获得 2 点婚礼分。",
    "Murat Reis survives the elimination and returns to the Turn Track.": "穆拉德·雷斯在消灭中幸存，返回回合记录轨。",
    "William of Orange is placed on the Turn Track.": "奥兰治的威廉被放在回合记录轨。",
    "William of Orange returns to the pool at eligibility 2 next turn.": "奥兰治的威廉下回合以资格 2 返回人员池。",
    "Council of Troubles: Spain has fewer than 5 units in the Netherlands.": "动乱委员会：西班牙在尼德兰的单位少于 5 个。",
    "Spain conquers the Philippines and gains a fifth New World treasure box.": "西班牙征服菲律宾，获得第五个新世界宝藏箱。",
    "Sir Edward Stafford finds nothing to discard.": "爱德华·斯塔福德爵士没有可弃置的牌。",
    "Spanish Road requires Spanish control of Milan.": "西班牙之路需要西班牙控制米兰。",
    "Spain adds a regular in Milan and prepares a Spanish Road move.": "西班牙在米兰增加 1 个正规军，并准备西班牙之路移动。",
    "Henry III becomes ruler of France.": "亨利三世成为法国统治者。",
    "Murad III becomes Ottoman ruler.": "穆拉德三世成为奥斯曼统治者。",
    "Act of Abjuration: offers are made; the Protestant must choose one.": "誓绝法案：提出多项提议；新教必须选择一项。",
    "Papal Bull excommunicates Elizabeth I.": "教皇诏书将伊丽莎白一世绝罚。",
    "Knights of St. John deploy 2 regulars in Malta.": "圣约翰骑士团在马耳他部署 2 个正规军。",
    "John Hawkins upgrades English home-port galleons to race-built galleons.": "约翰·霍金斯将英格兰本土港口的大帆船升级为快帆船。",
    "John Hawkins grants England 5 CP for naval operations.": "约翰·霍金斯给予英格兰 5 CP 用于海军行动。",
    "Jeanne of Navarre raises the Protestant cause and takes Bayonne.": "纳瓦拉的珍妮振奋新教事业并夺取巴约讷。",
    "Drake and Hawkins combine into a single English expedition.": "德雷克与霍金斯合并为一支英格兰远征队。",
    "Dragut falls; Uluch Ali returns next turn and Spain gains 1 VP.": "德拉加特陨落；乌卢奇·阿里下回合返回，西班牙获得 1 分。",
    "Union of Arras removes Dutch mercenaries, secures five spaces, and raises Walloon guards.": "阿拉斯联盟移除荷兰雇佣兵，确保五个地区，并征募瓦隆卫队。",
    "Paris is Worth a Mass: the Protestant takes Paris and moves the Huguenot capital there.": "巴黎值得一场弥撒：新教夺取巴黎，并将胡格诺首都迁往该地。",
    "Day of the Barricades: Spain seizes Paris and places 4 regulars.": "街垒日：西班牙夺取巴黎并放置 4 个正规军。",
    "The Black Queen sends two agents and draws a card.": "黑王后派出两名特工并抽一张牌。",
    "The Black Queen draws two cards instead of taking one.": "黑王后抽两张牌而非一张。",
    "Black Magic: the target has no eligible card.": "黑魔法：目标没有合法牌。",
    "Rudolf II becomes Holy Roman Emperor; the capital moves to Prague.": "鲁道夫二世成为神圣罗马皇帝；首都迁往布拉格。",
    "Portuguese Raid: no eligible colony is present.": "葡萄牙突袭：没有合法殖民地。",
    "Lost Colony: no Atlantic-coast colony is present.": "失落殖民地：没有大西洋沿岸殖民地。",
    "Patron of Arts finds no card to give.": "艺术赞助人没有可给出的牌。",
    "Spanish Fury: the defender has no cards to seize.": "西班牙暴怒：守方没有可夺取的牌。",
    "Mary Queen of Scots is dead; the card is removed after play.": "苏格兰女王玛丽已死亡；该牌结算后移出游戏。",
    "Gouvernante de France: no French betrothal is available.": "法国女摄政：没有可用的法国订婚。",
    "Gouvernante de France retrieves Grand Tour from the discard pile.": "法国女摄政从弃牌堆取回壮游。",
    "Gouvernante de France places +2 Wedding Festivities on a French marriage and draws a card.": "法国女摄政在一桩法国婚姻上放置 +2 婚礼庆典并抽一张牌。",
    "The Polish Royal Election ends the HRE's foreign war.": "波兰王室选举结束神圣罗马帝国的境外战争。",
    "The Polish Royal Election ends the Polish war; the Holy Roman Empire is considered victorious.": "波兰王室选举结束波兰战争；神圣罗马帝国被视为胜利。",
    "Sultan's Harem grants the Ottoman 5 CP for corsairs, naval movement, or piracy.": "苏丹后宫给予奥斯曼 5 CP，用于海盗船、海军移动或海盗行动。",
    "The Suez Canal is completed! Ottoman gains 2 VP and +1 card.": "苏伊士运河完工！奥斯曼获得 2 分和 +1 张牌。",
    "Spain gains 7 CP for the Armada.": "西班牙为无敌舰队获得 7 CP。",
    "The Armada has no port to return to and is eliminated.": "无敌舰队无港口可返，被消灭。",
    "Hawkins fails to roll 4-6; England takes a -1 Slave Trader VP marker.": "霍金斯未能掷出 4–6；英格兰获得 −1 奴隶贩子分标记。",
};

const translateWithRules = (text: string): string | undefined => {
    const fixed = STATIC[text];
    if (fixed !== undefined) return fixed;
    for (const [pattern, replacement] of RULES) {
        const match = pattern.exec(text);
        if (match !== null) {
            return typeof replacement === "string"
                ? match[0].replace(pattern, replacement)
                : replacement(...match);
        }
    }
    return undefined;
};

/**
 * Returns the Chinese rendering of an engine log line when the active locale is
 * `zh_CN`, or the original text when a line has no translation yet.  Keeping
 * the English fallback means a newly added engine message is still readable
 * instead of disappearing.
 */
export const localizeLogLine = (text: string, locale: VQLocale = "zh_CN"): string => {
    if (locale === "en" || text === "") return text;
    const named = localizeNames(text);
    return translateWithRules(named) ?? translateWithRules(text) ?? named;
};

/** Convenience export used by tests and the log panel. */
export const logText = localizeLogLine;
