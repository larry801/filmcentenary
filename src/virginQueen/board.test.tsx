import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VirginQueenBoard, legalDiplomacyTarget, EventTargetField, playEventCard, betrothalChoices, HolyLeagueTargetSelect, holyLeagueHreAvailable, holyLeagueTargetOptions, holyLeagueTargetValue, HOLY_LEAGUE_DEFAULT_TARGET, PolishElectionTargetSelect, polishElectionBidOptions, polishElectionBidValue, polishElectionTargetValue, eventTargetMode, POLISH_ELECTION_AUTO_LABEL, MenendezTargetSelect, menendezTargetOptions, menendezTargetValue, actionResponderChoices, actionWindowResponders, virginQueenCombatRetrieveOptions, abjurationOfferDetails, abjurationOffers, abjurationSelection, abjurationOfferMove, acceptAbjurationOffer, ArmyMutinyTargetSelect, armyMutinySpaceOptions, armyMutinyOwnerOptions, armyMutinySpaceValue, armyMutinyOwnerValue, armyMutinyTargetValue, StaffordTargetSelect, staffordPowerOptions, staffordDiscardOptions, staffordPowerValue, staffordDiscardValue, staffordTargetValue, GermanRecruitmentTargetSelect, germanRecruitmentSpaceOptions, germanRecruitmentPowerOptions, germanRecruitmentSpaceValue, germanRecruitmentPowerValue, germanRecruitmentTargetValue} from "./components/board";
import {chooseAbjuration, proposeBetroth, respondAction} from "./moves";
import {moveError} from "./movePolicy";
import {setupGame} from "./util";
import {ownerOf} from "./ownership";
import {Power, POWERS, VQGame} from "./constant/general";
import {SPACES} from "./mapData";
import {VirginQueenGameDef} from "./game";
import {cardById} from "./constant/cards";

const fakeCtx = (): Ctx => ({
    random: {
        Die: () => 3,
        Shuffle: (a: any[]) => a,
    },
} as unknown as Ctx);

const diplomacyCtx = (playerID = "3"): Ctx => ({
    ...fakeCtx(), numPlayers: 6, currentPlayer: playerID, playerID, phase: "diplomacy",
} as Ctx);

/** Makes a royal selectable regardless of the campaign's historical status. */
const availableRoyal = (G: VQGame, id: string): void => {
    const royal = G.royals.find((r) => r.id === id);
    if (royal === undefined) throw new Error(`missing royal ${id}`);
    Object.assign(royal, {alive: true, married: false, status: "available", turn: 1});
};

/** Simulates #95 having been played by `power` this Diplomacy Phase. */
const attachLouise = (G: VQGame, power: Power): void => {
    G.year = 3;
    G.royals = G.royals.filter((royal) => royal.id !== "louiseLorraine");
    G.royals.push({id: "louiseLorraine", name: "Louise of Lorraine", power, gender: "female",
        eligibility: 2, status: "available", alive: true, married: false});
    G.louiseAttachment = {power, available: true};
};

const renderDiplomacy = (G: VQGame, playerID: string | null, currentPlayer = "1"): string =>
    renderToStaticMarkup(<VirginQueenBoard {...{
        G, ctx: {phase: "diplomacy", currentPlayer}, moves: {}, playerID, isActive: playerID === currentPlayer,
    } as any}/>);

/**
 * Two-player campaign: seat "1" is England, seat "0" is Spain/France.  England
 * holds #36 and is the attacker in a field battle, leaving Spain as the normal
 * responder; the battle card window is open for #8 in the discard pile.
 */
const virginQueenBattleGame = (): VQGame => {
    const G = setupGame({...fakeCtx(), numPlayers: 2});
    G.activePower = "england";
    G.powers.england.cards = ["vq-036"];
    G.powers.spain.cards = [];
    G.discard = ["vq-008", "vq-005", "vq-009"];
    G.pendingBattle = {phase: "field", location: "belgrade", from: "sofia", attacker: "england",
        attackers: ["england"], defenders: ["spain"], defender: "spain", responding: "spain",
        step: "defend", cards: {}};
    G.cardWindow = {kind: "combat", phase: "field", location: "belgrade", attacker: "england"};
    return G;
};

describe("Virgin Queen board", () => {
    it("exposes espionage result choices and private hand snapshots only to their owning seat", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        G.year = 3;
        G.activePower = "spain";
        G.pendingEspionage = {kind: "intelligence", power: "spain", targetPower: "france", responding: "spain",
            step: "offense", cp: 2, remaining: 1, used: []};
        G.espionage!.inspections = [{viewer: "spain", target: "france", cards: ["vq-020"]}];
        const view = VirginQueenGameDef.playerView as any;
        for (const playerID of ["1", "2", null]) {
            const html = renderToStaticMarkup(<VirginQueenBoard {...{
                G: view(G, fakeCtx(), playerID), ctx: {phase: "action", currentPlayer: "1", numPlayers: 6},
                moves: {}, playerID, isActive: playerID === "1",
            } as any}/>);
            expect(html).toContain("谍报结算");
            expect(html.includes(">秘密查看目标手牌<")).toBe(playerID === "1");
            expect(html.includes("秘密情报 · 法国手牌快照")).toBe(playerID === "1");
            expect(html).not.toContain(">获取情报 (2 CP)<");
        }
    });

    it("shows Jesuits on the map and the official rebellion action in Spain's action panel", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        G.year = 3; G.activePower = "spain"; G.espionage!.jesuits = ["york"];
        const html = renderToStaticMarkup(<VirginQueenBoard {...{
            G, ctx: {phase: "action", currentPlayer: "1", numPlayers: 6}, moves: {}, playerID: "1", isActive: true,
        } as any}/>);
        expect(html).toContain("官方 Espionage Table");
        expect(html).toContain(">英格兰天主教叛乱<");
        expect(html).toContain("约克 · 控制：英格兰 · 新教 · 陆军 0 / 海军 0 / 将领 0 · 耶稣会士");
        expect(html).not.toContain("可玩近似");
    });

    it.each([2, 6])("shows Grand Vizier effects only to Ottoman and limits the canal by player count (%s)", (numPlayers) => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        G.pendingCardEvent = {kind: "grandVizier", cardId: "vq-001", responding: "ottoman", step: "effect", remaining: 4};
        for (const playerID of ["0", "1", null]) {
            const html = renderToStaticMarkup(<VirginQueenBoard {...{
                G, ctx: {phase: "action", currentPlayer: "0", numPlayers}, moves: {}, playerID, isActive: playerID === "0",
            } as any}/>);
            expect(html.includes(">增募 4 个正规军／桨帆船<")).toBe(playerID === "0");
            expect(html.includes(">尝试建造苏伊士运河<")).toBe(playerID === "0" && numPlayers === 6);
            expect(html).toContain("需要响应 · 奥斯曼帝国");
        }
    });

    it("shows recruitment counts and exposes cancellation only to the Ottoman responder", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 2}, {scenario: "tutorial"});
        G.powers.ottoman.cards = ["vq-001"];
        G.pendingCardEvent = {kind: "grandVizier", cardId: "vq-001", responding: "ottoman", step: "recruit", remaining: 3};
        const render = (playerID: string | null) => renderToStaticMarkup(<VirginQueenBoard {...{
            G, ctx: {phase: "action", currentPlayer: "1", numPlayers: 2}, moves: {}, playerID, isActive: playerID === "0",
        } as any}/>);
        expect(render("0")).toContain("还可增加 3 个单位");
        G.pendingCardEvent = {kind: "cancelEvent", cardId: "vq-021", power: "spain", responding: "ottoman"};
        for (const playerID of ["0", "1", null]) {
            const html = render(playerID);
            expect(html).toContain("外国志愿军");
            expect(html.includes(">打出大维齐尔，取消事件<")).toBe(playerID === "0");
            expect(html.includes(">允许事件结算<")).toBe(playerID === "0");
            expect(html).toContain("响应：完成大维齐尔选择");
        }
    });

    it("shows Spanish Road formation controls only to the Spanish responder", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 2}, {scenario: "tutorial"});
        G.pendingTutorialEvent = {cardId: "vq-003", power: "spain", responding: "spain", step: "roadFormation",
            remaining: 1, tracks: [], roadFormation: {units: {}, leaders: []}};
        for (const playerID of ["0", "1", null]) {
            const html = renderToStaticMarkup(<VirginQueenBoard {...{
                G, ctx: {phase: "action", currentPlayer: "1"}, moves: {}, playerID, isActive: playerID === "1",
            } as any}/>);
            expect(html).toContain("先选择米兰的部队与随军将领");
            expect(html.includes(">不进行米兰部署<")).toBe(playerID === "1");
        }
    });

    it("shows remaining rebel hits and naval loss choices to the targeted controller", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 2}, {scenario: "tutorial"});
        G.spaces.tunis.control = "spain";
        G.spaces.tunis.naval = {spain: {galley: 1, galleon: 0, racebuilt: 0, corsair: 0}};
        G.pendingTutorialEvent = {cardId: "vq-018", power: "ottoman", responding: "spain", step: "rebelLosses",
            remaining: 2, tracks: [], space: "tunis"};
        for (const playerID of ["0", "1", null]) {
            const html = renderToStaticMarkup(<VirginQueenBoard {...{
                G, ctx: {phase: "action", currentPlayer: "0"}, moves: {}, playerID, isActive: playerID === "1",
            } as any}/>);
            expect(html).toContain("还需分配 2 次损失");
            expect(html.includes(">移除 西班牙 桨帆船<")).toBe(playerID === "1");
        }
    });

    it("prioritizes a battle response and exposes choices only to its responder", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 2}, {scenario: "tutorial"});
        G.pendingBattle = {phase: "field", location: "belgrade", from: "sofia", attacker: "ottoman", attackers: ["ottoman"],
            defenders: ["spain"], defender: "spain", responding: "spain", step: "defend", cards: {}};
        for (const playerID of ["0", "1"]) {
            const html = renderToStaticMarkup(<VirginQueenBoard {...{
                G, ctx: {phase: "action", currentPlayer: "0"}, moves: {}, playerID, isActive: true,
            } as any}/>);
            expect(html).toContain("需要响应 · 西班牙");
            expect(html).toContain("响应与结算");
            expect(html).toContain("响应：完成战斗选择");
            expect(html.includes(">迎战<")).toBe(playerID === "1");
        }
    });

    it("lists only legal #36 retrieve-and-play Combat cards for England", () => {
        const G = virginQueenBattleGame();
        const england = ownerOf(G, "england")!;
        expect(virginQueenCombatRetrieveOptions(G, england)).toEqual([{
            cardId: "vq-008",
            target: "retrieve:vq-008:play",
            label: "取回并立即打出 精锐部队",
        }]);

        // #9 is naval and #5 is mandatory, so neither can be registered in the
        // open field window even though both are in the discard pile.
        expect(virginQueenCombatRetrieveOptions(G, ownerOf(G, "spain"))).toEqual([]);
        expect(virginQueenCombatRetrieveOptions(G, null)).toEqual([]);

        const withoutCard = virginQueenBattleGame();
        withoutCard.powers.england.cards = [];
        expect(virginQueenCombatRetrieveOptions(withoutCard, england)).toEqual([]);

        const closedWindow = virginQueenBattleGame();
        delete closedWindow.cardWindow;
        expect(virginQueenCombatRetrieveOptions(closedWindow, england)).toEqual([]);

        const responseWindow = virginQueenBattleGame();
        responseWindow.cardWindow = {kind: "response", phase: "field"};
        expect(virginQueenCombatRetrieveOptions(responseWindow, england)).toEqual([]);

        const wrongPhase = virginQueenBattleGame();
        wrongPhase.pendingBattle!.phase = "naval";
        wrongPhase.cardWindow = {kind: "combat", phase: "naval", location: "belgrade", attacker: "england"};
        expect(virginQueenCombatRetrieveOptions(wrongPhase, england)).toEqual([{
            cardId: "vq-009",
            target: "retrieve:vq-009:play",
            label: "取回并立即打出 火攻战船",
        }]);

        const noBattle = virginQueenBattleGame();
        delete noBattle.pendingBattle;
        expect(virginQueenCombatRetrieveOptions(noBattle, england)).toEqual([]);
    });

    it("renders the #36 combat affordance only to England while the window is open", () => {
        const G = virginQueenBattleGame();
        const england = ownerOf(G, "england")!;
        const render = (playerID: string | null, currentPlayer = england): string =>
            renderToStaticMarkup(<VirginQueenBoard {...{
                G, ctx: {phase: "action", currentPlayer}, moves: {}, playerID, isActive: playerID === currentPlayer,
            } as any}/>);

        const html = render(england);
        expect(html).toContain("童贞女王（#36）：取回弃牌堆中的战斗牌并立即打出");
        expect(html).toContain("取回并立即打出 精锐部队");
        expect(html).not.toContain("取回并立即打出 火攻战船");
        expect(html).not.toContain("取回并立即打出 教宗诏书");

        expect(render(ownerOf(G, "spain"))).not.toContain("取回并立即打出");
        expect(render(null)).not.toContain("取回并立即打出");

        delete G.cardWindow;
        expect(render(england)).not.toContain("取回并立即打出");
    });

    it("only renders the viewing seat's hand summaries and leaves playing to card details", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 2}, {scenario: "tutorial"});
        G.powers.ottoman.cards = ["vq-001"];
        G.powers.spain.cards = ["vq-003"];
        const view = VirginQueenGameDef.playerView! as (state: VQGame, ctx: Ctx, playerID: string | null) => VQGame;
        for (const playerID of ["0", "1", null]) {
            const html = renderToStaticMarkup(<VirginQueenBoard {...{
                G: view(G, fakeCtx(), playerID), ctx: {phase: "action", currentPlayer: "0"}, moves: {}, playerID, isActive: playerID === "0",
            } as any}/>);
            expect(html.includes(`查看卡牌 ${cardById("vq-001").name}`)).toBe(playerID === "0");
            expect(html.includes(`查看卡牌 ${cardById("vq-003").name}`)).toBe(playerID === "1");
            expect(html).not.toContain(">作为 CP<");
        }
    });

    it("labels mandatory, response and combat cards by their printed type", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 2}, {scenario: "tutorial"});
        G.activePower = "ottoman";
        G.powers.ottoman.cards = ["vq-006", "vq-015", "vq-039"];
        const html = renderToStaticMarkup(<VirginQueenBoard {...{
            G, ctx: {phase: "action", currentPlayer: "0", numPlayers: 2}, moves: {}, playerID: "0", isActive: true,
        } as any}/>);
        expect(html).toContain("强制事件牌");
        expect(html).toContain("响应牌");
        expect(html).toContain("战斗牌");
    });

    it("disables pass and end-impulse while a mandatory event is unplayed", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 2}, {scenario: "tutorial"});
        G.activePower = "ottoman";
        G.powers.ottoman.cards = ["vq-006"];
        const html = renderToStaticMarkup(<VirginQueenBoard {...{
            G, ctx: {phase: "action", currentPlayer: "0", numPlayers: 2}, moves: {}, playerID: "0", isActive: true,
        } as any}/>);
        expect(html).toContain("请先打出强制事件：塞利姆二世");
        expect(html).toMatch(/<button[^>]*disabled[^>]*>跳过<\/button>/);
        expect(html).toMatch(/<button[^>]*disabled[^>]*>结束行动轮次<\/button>/);
    });

    it("lets the impulse end after a card, even with a Home card still in hand", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 2}, {scenario: "tutorial"});
        G.activePower = "ottoman";
        G.powers.ottoman.cards = ["vq-001", "vq-002", "vq-003"];
        G.powers.ottoman.cardPlayed = true;
        const html = renderToStaticMarkup(<VirginQueenBoard {...{
            G, ctx: {phase: "action", currentPlayer: "0", numPlayers: 2}, moves: {}, playerID: "0", isActive: true,
        } as any}/>);
        // Pass stays illegal, but "结束行动轮次" is the normal way to finish
        // an impulse after spending a card (rule 11).
        expect(html).toMatch(/<button[^>]*disabled[^>]*>跳过<\/button>/);
        expect(html).not.toMatch(/<button[^>]*disabled[^>]*>结束行动轮次<\/button>/);
    });

    it("clamps the diplomacy target away from the viewing power", () => {
        expect(legalDiplomacyTarget("spain", "spain")).toBe("ottoman");
        expect(legalDiplomacyTarget("spain", "france")).toBe("france");
        expect(legalDiplomacyTarget(undefined, "spain")).toBe("spain");
    });

    it("labels the viewed power's CP in the top bar", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 2}, {scenario: "tutorial"});
        G.activePower = "spain";
        const html = renderToStaticMarkup(<VirginQueenBoard {...{
            G, ctx: {phase: "action", currentPlayer: "1", numPlayers: 2}, moves: {}, playerID: "1", isActive: true,
        } as any}/>);
        expect(html).toContain("查看 西班牙");
    });

    it("tells hotseat users which tab holds a pending response", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 2}, {scenario: "tutorial"});
        G.pendingAction = {power: "ottoman", move: "moveLand", args: {}};
        const html = renderToStaticMarkup(<VirginQueenBoard {...{
            G, ctx: {phase: "action", currentPlayer: "0", numPlayers: 2}, moves: {}, playerID: "0", isActive: true,
            hotseat: true,
        } as any}/>);
        expect(html).toContain("请切换到 P2 标签页");
    });

    it("points hotseat users at the HRE tab while the winter choice is pending", () => {
        const G = setupGame({...fakeCtx()});
        G.activePower = "hre";
        G.pendingHreReplacement = {canRegular: true, canMercs: true, canMarker: true};
        const html = renderToStaticMarkup(<VirginQueenBoard {...{
            G, ctx: {phase: "diplomacy", currentPlayer: "4", numPlayers: 6}, moves: {}, playerID: "0", isActive: false,
            hotseat: true,
        } as any}/>);
        expect(html).toContain("请切换到 P5 标签页");
    });

    it("replaces playable actions with the result after game over", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 2}, {scenario: "tutorial"});
        const html = renderToStaticMarkup(<VirginQueenBoard {...{
            G, ctx: {phase: "action", currentPlayer: "0", gameover: {winner: "1", power: "spain", reason: "timeLimit"}},
            moves: {}, playerID: "0", isActive: true,
        } as any}/>);
        expect(html).toContain("对局结束 · 胜者：P2 西班牙");
        expect(html).not.toContain(">结束行动轮次<");
        expect(html).toContain("教学结束：回顾本局");
    });

    it("localizes the game-over reason and hides the cleared phase key", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 2}, {scenario: "tutorial"});
        const html = renderToStaticMarkup(<VirginQueenBoard {...{
            G, ctx: {phase: undefined, currentPlayer: "0", gameover: {winner: "1", power: "spain", reason: "military"}},
            moves: {}, playerID: "0", isActive: true,
        } as any}/>);
        expect(html).toContain("军事胜利：控制足够多的关键城市");
        expect(html).not.toContain("原因: military");
        expect(html).not.toContain("vq.header.phase.");
    });

    it("caps the displayed turn at the scenario's final turn after a time-limit game", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6}, {scenario: "campaign"});
        G.year = G.endTurn + 1;
        const html = renderToStaticMarkup(<VirginQueenBoard {...{
            G, ctx: {phase: undefined, currentPlayer: "0", gameover: {winner: "1", power: "spain", reason: "timeLimit"}},
            moves: {}, playerID: "0", isActive: true,
        } as any}/>);
        expect(html).toContain("回合 7");
        expect(html).not.toContain("回合 8");
        expect(html).toContain("时限胜利：第 7 回合结束时分数最高");
    });

    it("shows the Protestant spaces target in the scenario panel", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6}, {scenario: "campaign"});
        const html = renderToStaticMarkup(<VirginQueenBoard {...{
            G, ctx: {phase: "action", currentPlayer: "0"}, moves: {}, playerID: "0", isActive: true,
        } as any}/>);
        expect(html).toContain("新教地区 18 / 51");
        expect(html).toContain("超过 50 个时立即取得新教宗教胜利");
    });

    it("shows a Protestant religious victory with the correct threshold text", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6}, {scenario: "campaign"});
        const html = renderToStaticMarkup(<VirginQueenBoard {...{
            G, ctx: {phase: undefined, currentPlayer: "0",
                gameover: {winner: "5", power: "protestant", reason: "protestantReligious"}},
            moves: {}, playerID: "0", isActive: true,
        } as any}/>);
        expect(html).toContain("对局结束 · 胜者：P6 新教联盟");
        expect(html).toContain("新教宗教胜利：新教影响超过 50 个地区");
    });

    it("offers a Polish election bid instead of an End Impulse button", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        G.pendingPolishElection = {bids: {}, remaining: ["france"]};
        G.activePower = "spain";
        const props = {
            G, ctx: {phase: "action", currentPlayer: "1", numPlayers: 6},
            moves: {}, playerID: "3", isActive: false, hotseat: true,
        };
        const france = renderToStaticMarkup(<VirginQueenBoard {...props as any}/>);
        expect(france).toContain("波兰选王 · 竞标");
        expect(france).toContain("当前竞标：法国");
        expect(france).toContain("提交竞标");
        expect(france).not.toContain(">结束行动轮次<");

        const ottoman = renderToStaticMarkup(<VirginQueenBoard {...{...props, playerID: "0"} as any}/>);
        expect(ottoman).toContain("等待 法国 竞标");
        expect(ottoman).toContain("请切换到 P4 标签页");
        expect(ottoman).toContain("需要响应 · 法国");
        expect(ottoman).not.toContain(">结束行动轮次<");
    });

    it("shows teaching guidance and opens the tutorial at each player's capital", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 2}, {scenario: "tutorial"});
        for (const [playerID, capital] of [["0", "伊斯坦布尔"], ["1", "马德里"]]) {
            const html = renderToStaticMarkup(<VirginQueenBoard {...{
                G, ctx: {phase: "cardDraw", currentPlayer: "0"}, moves: {}, playerID, isActive: playerID === "0",
            } as any}/>);
            expect(html).toContain("双人教学模式 · 勒班陀海战");
            expect(html).toContain("第 1 步：确认手牌");
            expect(html).toMatch(new RegExp(`<h6[^>]*>${capital}</h6>`));
            expect(html).not.toMatch(/<h6[^>]*>伦敦<\/h6>/);
        }
    });

    it("identifies the seat and power still confirming a two-player tournament draw", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 2}, {scenario: "tournament"});
        G.activePower = "spain";
        const render = (playerID: string): string => renderToStaticMarkup(<VirginQueenBoard {...{
            G, ctx: {phase: "cardDraw", currentPlayer: "0"}, moves: {}, playerID, isActive: playerID === "0",
        } as any}/>);
        expect(render("0")).toContain("请确认 P1 · 西班牙 完成抽牌（2/5）。");
        expect(render("1")).toContain("等待 P1 · 西班牙 完成抽牌（2/5）。");
        expect(render("0")).toContain("确认西班牙抽牌完成");
        expect(render("0")).toContain("各参战强国依次确认后进入外交阶段");
    });

    it("offers only confirmation for the Morisco winter removal but swaps ordinary losses", () => {
        const G = setupGame(fakeCtx(), {scenario: "tournament"});
        G.activePower = "ottoman";
        G.winterLossChoices = [{
            power: "ottoman", space: "granada", amount: 2,
            removed: {regular: 2, merc: 0, cav: 0}, confirmOnly: true,
        }];
        const render = (): string => renderToStaticMarkup(<VirginQueenBoard {...{
            G, ctx: {phase: "cardDraw", currentPlayer: "0"}, moves: {}, playerID: "0", isActive: true,
        } as any}/>);

        const confirmOnly = render();
        expect(confirmOnly).toContain("莫里斯科人（#28）随牌离场");
        expect(confirmOnly).toContain("确认移除");
        for (const kind of ["正规军", "雇佣兵", "骑兵"]) {
            expect(confirmOnly).not.toContain(`改为失去 ${kind}`);
        }

        // An ordinary winter loss keeps the unit-type swap buttons.
        G.winterLossChoices = [{
            power: "ottoman", space: "granada", amount: 1,
            removed: {regular: 1, merc: 0, cav: 0},
        }];
        G.spaces.granada.land.ottoman = {regular: 1, merc: 1, cav: 1};
        const ordinary = render();
        expect(ordinary).toContain("改为失去 正规军");
        expect(ordinary).toContain("改为失去 雇佣兵");
        expect(ordinary).toContain("改为失去 骑兵");
        expect(ordinary).toContain("保留自动结果");
        expect(ordinary).not.toContain("确认移除");
    });

    it("flags winter attrition and city-rebel choices as pending responses", () => {
        const render = (G: VQGame, phase: string, playerID: string): string =>
            renderToStaticMarkup(<VirginQueenBoard {...{
                G, ctx: {phase, currentPlayer: playerID}, moves: {}, playerID, isActive: true,
            } as any}/>);

        const winter = setupGame(fakeCtx(), {scenario: "tournament"});
        winter.activePower = "ottoman";
        winter.winterLossChoices = [{
            power: "ottoman", space: "granada", amount: 1,
            removed: {regular: 1, merc: 0, cav: 0},
        }];
        const winterHtml = render(winter, "cardDraw", "0");
        expect(winterHtml).toContain("冬季损失：选择或确认失去的单位类型");
        expect(winterHtml).toContain("行动 · 待响应");

        const city = setupGame(fakeCtx(), {numPlayers: 6});
        city.activePower = "spain";
        city.pendingCityRebels = {power: "spain", controller: "spain", space: "brussels", remaining: 2, values: [5, 5, 4, 3, 2]};
        const cityHtml = render(city, "action", "1");
        expect(cityHtml).toContain("需要响应 · 西班牙");
        expect(cityHtml).toContain("行动 · 待响应");
    });

    it("offers all three religious preferences to HRE in its first Spring", () => {
        const G = setupGame(fakeCtx());
        G.activePower = "hre";
        const html = renderToStaticMarkup(<VirginQueenBoard {...{
            G, ctx: {phase: "spring", currentPlayer: "4"}, moves: {}, playerID: "4", isActive: true,
        } as any}/>);
        expect(html).toContain("秘密宗教倾向");
        expect(html).toContain("天主教");
        expect(html).toContain("新教");
        expect(html).toContain("平衡");
    });

    it("shows potential VP only to HRE until revelation", () => {
        const G = setupGame(fakeCtx());
        G.activePower = "hre";
        G.hreReligiousPreference = "catholic";
        G.hreReligiousPreferenceChosen = true;
        const view = VirginQueenGameDef.playerView! as (G: VQGame, ctx: Ctx, playerID: string | null) => VQGame;
        const render = (playerID: string | null): string => renderToStaticMarkup(<VirginQueenBoard {...{
            G: view(G, fakeCtx(), playerID), ctx: {phase: "action", currentPlayer: "4"}, moves: {}, playerID, isActive: false,
        } as any}/>);
        expect(render("4")).toContain("秘密：天主教 · 5 VP（未计入）");
        expect(render("1")).toContain("宗教倾向已秘密选择");
        expect(render(null)).not.toContain("秘密：天主教");
        G.hreReligiousPreferenceRevealed = true;
        expect(render(null)).toContain("已公开：天主教 · 5 VP");
    });

    it("forwards a typed event target to playCard and keeps one-click play without one", () => {
        const played: {cardId: string; asEvent: true; target?: string}[] = [];
        const playCard = (args: {cardId: string; asEvent: true; target?: string}): void => { played.push(args); };
        playEventCard(playCard, "vq-030", {typed: " spain:return:alba "});
        playEventCard(playCard, "vq-105", {typed: "   "});
        playEventCard(playCard, "vq-061", {typed: "ignored", selected: "fortress:atlanticCoast"});
        playEventCard(playCard, "vq-024", {typed: "", selected: "papacy:venice:hre"});
        expect(played).toEqual([
            {cardId: "vq-030", asEvent: true, target: "spain:return:alba"},
            {cardId: "vq-105", asEvent: true},
            {cardId: "vq-061", asEvent: true, target: "fortress:atlanticCoast"},
            {cardId: "vq-024", asEvent: true, target: "papacy:venice:hre"},
        ]);
    });

    it("offers an optional target field with card-specific examples", () => {
        const html = renderToStaticMarkup(<EventTargetField cardId="vq-030" value="spain:return:alba"
            onChange={() => undefined}/>);
        expect(html).toContain("事件目标（可选）");
        expect(html).toContain("目标参数示例：spain:return:alba 或 france:skip");
        expect(html).toContain('value="spain:return:alba"');
        const generic = renderToStaticMarkup(<EventTargetField cardId="vq-055" value="" onChange={() => undefined}/>);
        expect(generic).toContain("按卡牌文本填写；留空则无目标结算。");
    });

    it("offers Holy League #24 targets and includes the HRE only as a non-player major", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 2});
        expect(holyLeagueHreAvailable(G)).toBe(true);
        expect(holyLeagueTargetOptions(G).map((option) => option.value)).toEqual([
            "papacy", "venice", "hre", "papacy:venice", "papacy:hre", "venice:hre",
            "papacy:venice:hre", "venice:papacy:hre", "hre:papacy:venice",
        ]);
        const options = holyLeagueTargetOptions(G);
        expect(options.find((option) => option.value === "hre")?.label).toBe("神圣罗马帝国 +4");
        expect(options.find((option) => option.value === "papacy:venice:hre")?.label).toBe("教宗国 +2，威尼斯 +1，神圣罗马帝国 +1");
        expect(holyLeagueTargetValue(G, "venice:hre")).toBe("venice:hre");
        expect(holyLeagueTargetValue(G, "not-a-target")).toBe(HOLY_LEAGUE_DEFAULT_TARGET);

        // An activated HRE is run by an ally, not a direct player, so it still
        // belongs in the selector.
        G.activatedMajors = {hre: {ally: "spain", baseline: 0}};
        expect(holyLeagueHreAvailable(G)).toBe(true);
        expect(holyLeagueTargetOptions(G).map((option) => option.value)).toContain("hre");

        // A directly player-controlled HRE has no influence track to target.
        G.playerPowers!["0"].push("hre");
        expect(holyLeagueHreAvailable(G)).toBe(false);
        expect(holyLeagueTargetOptions(G).map((option) => option.value)).toEqual(["papacy", "venice", "papacy:venice"]);
        expect(holyLeagueTargetValue(G, "hre")).toBe(HOLY_LEAGUE_DEFAULT_TARGET);

        // Six-player games have no non-player HRE influence track at all.
        const sixPlayer = setupGame({...fakeCtx(), numPlayers: 6});
        expect(sixPlayer.majorInfluence).toBeUndefined();
        expect(holyLeagueHreAvailable(sixPlayer)).toBe(false);
    });

    it("renders the dedicated #24 selector with the default Papacy/Venice split", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 2});
        const html = renderToStaticMarkup(<HolyLeagueTargetSelect options={holyLeagueTargetOptions(G)}
            value={holyLeagueTargetValue(G, "")} onChange={() => undefined}/>);
        expect(html).toContain("神圣同盟目标");
        expect(html).toContain("教宗国 +2，威尼斯 +2");
        expect(html).not.toContain("事件目标（可选）");
    });

    it("offers #86 per-power card and treasure bids with defaults and clear labels", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        G.powers.france.cards = ["vq-022", "vq-001"];
        G.powers.france.treasures = [1, 3];
        G.powers.hre.cards = ["vq-086", "vq-020"];
        G.powers.spain.cards = [];
        G.powers.spain.treasures = [2];

        const france = polishElectionBidOptions(G, "france");
        expect(france.map((option) => option.value)).toEqual(["", "vq-001", "vq-022", "treasure:3", "treasure:1"]);
        expect(france[0].label).toBe(POLISH_ELECTION_AUTO_LABEL);
        expect(france.find((option) => option.value === "vq-001")?.label).toBe("大维齐尔（手牌 5 CP）");
        expect(france.find((option) => option.value === "vq-022")?.label).toContain("3 CP");
        expect(france.find((option) => option.value === "treasure:3")?.label).toBe("财宝 3（3 CP）");

        // Mandatory cards can never be bid, so #86 itself is not offered.
        expect(polishElectionBidOptions(G, "hre").map((option) => option.value)).toEqual(["", "vq-020"]);
        expect(polishElectionBidOptions(G, "spain").map((option) => option.value)).toEqual(["", "treasure:2"]);

        expect(polishElectionBidValue(G, "france", "vq-001")).toBe("vq-001");
        expect(polishElectionBidValue(G, "hre", "vq-086")).toBe("");
        expect(polishElectionBidValue(G, "france", "treasure:9")).toBe("");
        expect(polishElectionBidValue(G, "spain", undefined)).toBe("");
    });

    it("builds the #86 target grammar from per-power choices and omits auto bids", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        G.powers.france.cards = ["vq-001"];
        G.powers.france.treasures = [];
        G.powers.hre.cards = ["vq-020"];
        G.powers.spain.cards = [];
        G.powers.spain.treasures = [1];

        expect(polishElectionTargetValue(G, {france: "vq-001", hre: "vq-020", spain: "treasure:1"}))
            .toBe("france:vq-001|hre:vq-020|spain:treasure:1");
        // The grammar order is the engine's france/hre/spain order, not selection order.
        expect(polishElectionTargetValue(G, {spain: "treasure:1", hre: "vq-020", france: "vq-001"}))
            .toBe("france:vq-001|hre:vq-020|spain:treasure:1");
        expect(polishElectionTargetValue(G, {})).toBeUndefined();
        expect(polishElectionTargetValue(G, {france: "", hre: "", spain: ""})).toBeUndefined();
        expect(polishElectionTargetValue(G, {hre: "vq-020"})).toBe("hre:vq-020");
        // A bid that is no longer legal falls back to auto instead of forwarding stale state.
        expect(polishElectionTargetValue(G, {france: "vq-022"})).toBeUndefined();
    });

    it("forwards the dedicated #86 bid target and keeps free-text targeting off that card", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        G.powers.france.cards = ["vq-001"];
        G.powers.hre.cards = ["vq-020"];
        G.powers.spain.treasures = [1];
        const played: {cardId: string; asEvent: true; target?: string}[] = [];
        const playCard = (args: {cardId: string; asEvent: true; target?: string}): void => { played.push(args); };
        const choices = {france: "vq-001", hre: "vq-020", spain: "treasure:1"};

        playEventCard(playCard, "vq-086", {typed: "ignored free text", selected: polishElectionTargetValue(G, choices)});
        playEventCard(playCard, "vq-086", {typed: "", selected: polishElectionTargetValue(G, {})});

        expect(played).toEqual([
            {cardId: "vq-086", asEvent: true, target: "france:vq-001|hre:vq-020|spain:treasure:1"},
            {cardId: "vq-086", asEvent: true},
        ]);
        expect(eventTargetMode("polishRoyalElection", 0)).toBe("polishElection");
        expect(eventTargetMode("holyLeague", 0)).toBe("holyLeague");
        expect(eventTargetMode("", 0)).toBe("freeText");
        // #86 no longer advertises a free-text example.
        const field = renderToStaticMarkup(<EventTargetField cardId="vq-086" value="" onChange={() => undefined}/>);
        expect(field).toContain("按卡牌文本填写");
    });

    it("renders the dedicated #86 selector with one labeled bid per power", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        G.powers.france.cards = ["vq-001"];
        G.powers.france.treasures = [];
        G.powers.hre.cards = ["vq-020"];
        G.powers.spain.treasures = [1];
        const html = renderToStaticMarkup(<PolishElectionTargetSelect G={G} value={{france: "vq-001"}}
            onChange={() => undefined}/>);
        expect(html).toContain("选王出价");
        expect(html).toContain("法国 出价");
        expect(html).toContain("神圣罗马帝国 出价");
        expect(html).toContain("西班牙 出价");
        expect(html).toContain("大维齐尔（手牌 5 CP）");
        expect(html).not.toContain("事件目标（可选）");
    });

    it("offers #61 Florida, escort and legal fortress targets", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        G.worldControls = {florida: "spain"};
        const base = menendezTargetOptions(G);
        expect(base.map((option) => option.value)).toEqual(["", "escort", "fortress:florida"]);
        expect(base[0].label).toContain("佛罗里达殖民地");
        expect(base[1].label).toBe("珍宝舰队护航（+1 大帆船）");
        expect(base[2].label).toBe("要塞：佛罗里达");

        // Only settlements Spain controls and that have no fortress yet.
        G.worldControls.atlanticCoast = "spain";
        G.worldControls.antillesColony = "england";
        G.worldFortresses = {florida: "spain"};
        expect(menendezTargetOptions(G).map((option) => option.value))
            .toEqual(["", "escort", "fortress:atlanticCoast"]);

        expect(menendezTargetValue(G, "")).toBeUndefined();
        expect(menendezTargetValue(G, "escort")).toBe("escort");
        expect(menendezTargetValue(G, "fortress:atlanticCoast")).toBe("fortress:atlanticCoast");
        // A target that is no longer legal is dropped instead of sent stale.
        expect(menendezTargetValue(G, "fortress:florida")).toBeUndefined();
        expect(menendezTargetValue(G, "fortress:antillesColony")).toBeUndefined();
        expect(menendezTargetValue(G, "not-a-target")).toBeUndefined();
    });

    it("forwards the #61 branch and keeps free-text targeting off that card", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        G.worldControls = {florida: "spain", atlanticCoast: "spain"};
        const played: {cardId: string; asEvent: true; target?: string}[] = [];
        const playCard = (args: {cardId: string; asEvent: true; target?: string}): void => { played.push(args); };

        playEventCard(playCard, "vq-061", {typed: "", selected: menendezTargetValue(G, "")});
        playEventCard(playCard, "vq-061", {typed: "ignored free text", selected: menendezTargetValue(G, "escort")});
        playEventCard(playCard, "vq-061", {typed: "ignored free text", selected: menendezTargetValue(G, "fortress:atlanticCoast")});

        expect(played).toEqual([
            {cardId: "vq-061", asEvent: true},
            {cardId: "vq-061", asEvent: true, target: "escort"},
            {cardId: "vq-061", asEvent: true, target: "fortress:atlanticCoast"},
        ]);
        expect(eventTargetMode("menendezDeAviles", 0)).toBe("menendez");
        // Other event cards keep their free-text targeting.
        expect(eventTargetMode("johnKnox", 0)).toBe("freeText");
        const field = renderToStaticMarkup(<EventTargetField cardId="vq-061" value="fortress:florida"
            onChange={() => undefined}/>);
        expect(field).toContain("按卡牌文本填写");
    });

    it("renders the dedicated #61 selector with the chosen branch and no free text", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        G.worldControls = {florida: "spain", atlanticCoast: "spain"};
        const html = renderToStaticMarkup(<MenendezTargetSelect options={menendezTargetOptions(G)}
            value={menendezTargetValue(G, "escort") ?? ""} onChange={() => undefined}/>);
        expect(html).toContain("梅嫩德斯目标");
        // Menu items render only once the MUI menu opens, so the closed select
        // shows the chosen branch; the option labels are covered above.
        expect(html).toContain("珍宝舰队护航（+1 大帆船）");
    });
    it("offers #17 shared-space stack targets and builds the space:owner grammar", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        for (const space of Object.values(G.spaces)) space.land = {};
        G.spaces.brussels.land.france = {regular: 2, merc: 2, cav: 0};
        G.spaces.brussels.land.spain = {regular: 1, merc: 0, cav: 0};
        G.spaces.london.land.england = {regular: 3, merc: 0, cav: 1};

        expect(armyMutinySpaceOptions(G).map((option) => option.value).sort()).toEqual(["brussels", "london"]);
        expect(armyMutinySpaceOptions(G).find((option) => option.value === "brussels")?.label).toBe("布鲁塞尔");

        // POWERS order, not map order, and each label shows the stack composition.
        expect(armyMutinyOwnerOptions(G, "brussels")).toEqual([
            {value: "spain", label: "西班牙（正规军 1）"},
            {value: "france", label: "法国（正规军 2，雇佣兵 2）"},
        ]);
        expect(armyMutinyOwnerOptions(G, "london").map((option) => option.value)).toEqual(["england"]);
        expect(armyMutinyOwnerOptions(G, "nowhere")).toEqual([]);

        expect(armyMutinyTargetValue(G, {space: "brussels", owner: "france"})).toBe("brussels:france");
        // An owner that is not in the chosen space falls back to that space's first stack.
        expect(armyMutinyTargetValue(G, {space: "london", owner: "spain"})).toBe("london:england");
        // Blank and stale spaces default to the first legal space instead of forwarding bad input.
        const first = armyMutinySpaceOptions(G)[0].value;
        expect(armyMutinySpaceValue(G, "")).toBe(first);
        expect(armyMutinySpaceValue(G, "nowhere")).toBe(first);
        expect(armyMutinyOwnerValue(G, "brussels", undefined)).toBe("spain");
        expect(armyMutinyTargetValue(G, {space: ""})).toBe(`${first}:${armyMutinyOwnerOptions(G, first)[0].value}`);
        expect(armyMutinyTargetValue(G, {space: "nowhere", owner: "france"}))
            .toBe(`${first}:${armyMutinyOwnerValue(G, first, "france")}`);
    });

    it("keeps minor stacks out of #17 and omits the target when no major stack is legal", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        for (const space of Object.values(G.spaces)) space.land = {};
        G.spaces.london.land.papacy = {regular: 3, merc: 0, cav: 0};

        expect(armyMutinySpaceOptions(G)).toEqual([]);
        expect(armyMutinyOwnerOptions(G, "london")).toEqual([]);
        expect(armyMutinyTargetValue(G, {space: "london"})).toBeUndefined();

        const played: {cardId: string; asEvent: true; target?: string}[] = [];
        const playCard = (args: {cardId: string; asEvent: true; target?: string}): void => { played.push(args); };
        playEventCard(playCard, "vq-017", {typed: "", selected: armyMutinyTargetValue(G, {space: "london"})});
        expect(played).toEqual([{cardId: "vq-017", asEvent: true}]);

        // #17 now owns a dedicated control; cards without one keep the free-text fallback.
        expect(eventTargetMode("armyMutiny", 0)).toBe("armyMutiny");
        expect(eventTargetMode("rulerFallsIll", 0)).toBe("freeText");
        expect(eventTargetMode("", 0)).toBe("freeText");
    });

    it("renders the dedicated #17 space and owner selector", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        for (const space of Object.values(G.spaces)) space.land = {};
        G.spaces.brussels.land.france = {regular: 2, merc: 2, cav: 0};
        G.spaces.brussels.land.spain = {regular: 1, merc: 0, cav: 0};
        const html = renderToStaticMarkup(<ArmyMutinyTargetSelect G={G} value={{space: "brussels", owner: "france"}}
            onChange={() => undefined}/>);
        expect(html).toContain("军队哗变目标");
        expect(html).toContain("目标地区");
        expect(html).toContain("军队所属势力");
        expect(html).toContain("布鲁塞尔");
        expect(html).toContain("法国（正规军 2，雇佣兵 2）");
        expect(html).not.toContain("事件目标（可选）");
    });

    it("offers #102 Stafford target powers with their discardable cards and treasures", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        for (const power of POWERS) {
            G.powers[power].cards = [];
            G.powers[power].treasures = [];
        }
        G.powers.spain.cards = ["vq-003", "vq-020", "vq-021"];
        G.powers.spain.treasures = [3, 5, 5];
        G.powers.protestant.cards = ["vq-032"];
        G.powers.france.treasures = [1];

        expect(staffordPowerOptions(G)).toEqual([
            {value: "spain", label: "西班牙（手牌 2，财宝 3）"},
            {value: "france", label: "法国（手牌 0，财宝 1）"},
        ]);
        expect(staffordDiscardOptions(G, "spain")).toEqual([
            {value: "card:vq-020", label: "雄辩的使节（手牌 5 CP）"},
            {value: "card:vq-021", label: "外国志愿军（手牌 5 CP）"},
            {value: "treasure:5", label: "财宝 5（5 CP，共 2 件）"},
            {value: "treasure:3", label: "财宝 3（3 CP）"},
        ]);
        // Home cards are never discardable, so a power holding only one is not offered.
        expect(staffordDiscardOptions(G, "protestant")).toEqual([]);
        expect(staffordPowerOptions(G).map((option) => option.value)).not.toContain("protestant");

        // Stale or blank selections fall back to the first legal choice, never forwarding bad input.
        expect(staffordPowerValue(G, "protestant")).toBe("spain");
        expect(staffordPowerValue(G, "not-a-power")).toBe("spain");
        expect(staffordDiscardValue(G, "spain", "card:vq-102")).toBe("card:vq-020");
        expect(staffordDiscardValue(G, "spain", undefined)).toBe("card:vq-020");
        expect(staffordTargetValue(G, {power: "spain", discard: "treasure:5"})).toBe("spain:treasure:5");
        expect(staffordTargetValue(G, {power: "spain", discard: "treasure:9"})).toBe("spain:card:vq-020");
        expect(staffordTargetValue(G, {power: "protestant"})).toBe("spain:card:vq-020");
    });

    it("omits the #102 target when no power has anything to discard", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        for (const power of POWERS) {
            G.powers[power].cards = [];
            G.powers[power].treasures = [];
        }
        expect(staffordPowerOptions(G)).toEqual([]);
        expect(staffordDiscardOptions(G, "spain")).toEqual([]);
        expect(staffordTargetValue(G, {power: ""})).toBeUndefined();

        // #102 now owns a dedicated control; unrelated cards keep the free-text fallback.
        expect(eventTargetMode("sirEdwardStafford", 0)).toBe("stafford");
        expect(eventTargetMode("rulerFallsIll", 0)).toBe("freeText");
    });

    it("forwards the dedicated #102 Stafford target and keeps free-text targeting off that card", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        G.powers.spain.cards = ["vq-020"];
        G.powers.spain.treasures = [5];
        const played: {cardId: string; asEvent: true; target?: string}[] = [];
        const playCard = (args: {cardId: string; asEvent: true; target?: string}): void => { played.push(args); };

        playEventCard(playCard, "vq-102", {typed: "ignored free text", selected: staffordTargetValue(G, {power: "spain", discard: "treasure:5"})});
        playEventCard(playCard, "vq-102", {typed: "ignored free text", selected: staffordTargetValue(G, {power: "spain", discard: "card:vq-102"})});

        expect(played).toEqual([
            {cardId: "vq-102", asEvent: true, target: "spain:treasure:5"},
            {cardId: "vq-102", asEvent: true, target: "spain:card:vq-020"},
        ]);
    });

    it("renders the dedicated #102 Stafford power and discard selector", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        G.powers.spain.cards = ["vq-020", "vq-021"];
        G.powers.spain.treasures = [5, 5];
        const html = renderToStaticMarkup(<StaffordTargetSelect G={G} value={{power: "spain", discard: "treasure:5"}}
            onChange={() => undefined}/>);
        expect(html).toContain("斯塔福德目标（选择势力，再选择要弃置的手牌或财宝）");
        expect(html).toContain("目标势力");
        expect(html).toContain("弃置手牌或财宝");
        expect(html).toContain("西班牙（手牌 2，财宝 2）");
        expect(html).toContain("财宝 5（5 CP，共 2 件）");
        expect(html).not.toContain("事件目标（可选）");

        // Blank state highlights the first legal power and the first legal discard.
        const defaults = renderToStaticMarkup(<StaffordTargetSelect G={G} value={{power: ""}}
            onChange={() => undefined}/>);
        expect(defaults).toContain("西班牙（手牌 2，财宝 2）");
        expect(defaults).toContain("雄辩的使节（手牌 5 CP）");
    });
    it("offers #23 mercenary spaces/powers and builds the space:power grammar", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        G.activePower = "france";
        for (const space of Object.values(G.spaces)) space.land = {};
        G.spaces.brussels.land.spain = {regular: 1, merc: 3, cav: 0};
        G.spaces.brussels.land.france = {regular: 2, merc: 2, cav: 0};
        G.spaces.antwerp.land.france = {regular: 0, merc: 4, cav: 0};
        G.spaces.london.land.england = {regular: 3, merc: 0, cav: 0};

        // Only spaces with major-power mercenaries are selectable, in map order.
        expect(germanRecruitmentSpaceOptions(G).map((option) => option.value).sort()).toEqual(["antwerp", "brussels"]);
        expect(germanRecruitmentSpaceOptions(G).find((option) => option.value === "brussels")?.label).toBe("布鲁塞尔");
        // POWERS order, and the label shows the exact number of mercenaries removed.
        expect(germanRecruitmentPowerOptions(G, "brussels")).toEqual([
            {value: "spain", label: "西班牙（雇佣兵 3）"},
            {value: "france", label: "法国（雇佣兵 2）"},
        ]);
        expect(germanRecruitmentPowerOptions(G, "london")).toEqual([]);
        expect(germanRecruitmentPowerOptions(G, "nowhere")).toEqual([]);

        expect(germanRecruitmentTargetValue(G, {space: "brussels", power: "france"})).toBe("brussels:france");
        // A power without mercenaries in the chosen space falls back to its first legal power.
        expect(germanRecruitmentTargetValue(G, {space: "brussels", power: "england"})).toBe("brussels:spain");
        const first = germanRecruitmentSpaceOptions(G)[0].value;
        expect(germanRecruitmentSpaceValue(G, "")).toBe(first);
        expect(germanRecruitmentSpaceValue(G, "nowhere")).toBe(first);
        expect(germanRecruitmentPowerValue(G, "brussels", undefined)).toBe("spain");
        expect(germanRecruitmentTargetValue(G, {space: ""}))
            .toBe(`${first}:${germanRecruitmentPowerOptions(G, first)[0].value}`);
    });

    it("builds the two-space HRE #23 target and keeps non-HRE targets to one space", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        for (const space of Object.values(G.spaces)) space.land = {};
        G.spaces.brussels.land.spain = {regular: 1, merc: 2, cav: 0};
        G.spaces.brussels.land.england = {regular: 1, merc: 3, cav: 0};
        G.spaces.antwerp.land.france = {regular: 1, merc: 4, cav: 0};
        G.spaces.antwerp.land.england = {regular: 1, merc: 5, cav: 0};

        const twoSpaces = {space: "brussels", power: "spain" as const,
            secondSpace: "antwerp", secondPower: "france" as const};
        expect(germanRecruitmentTargetValue(G, twoSpaces, true))
            .toBe("brussels:spain:antwerp:france");
        // The active HRE gets the two-space form without an explicit flag.
        G.activePower = "hre";
        expect(germanRecruitmentTargetValue(G, twoSpaces)).toBe("brussels:spain:antwerp:france");
        // A non-HRE power can remove mercenaries from only the first named space.
        expect(germanRecruitmentTargetValue(G, twoSpaces, false)).toBe("brussels:spain");
        // The second pair is optional and must be a distinct space.
        expect(germanRecruitmentTargetValue(G, {space: "brussels", power: "spain"}, true)).toBe("brussels:spain");
        expect(germanRecruitmentTargetValue(G, {space: "brussels", power: "spain",
            secondSpace: "brussels", secondPower: "england"}, true)).toBe("brussels:spain");
        // A stale second power falls back to the first mercenary power in that space.
        expect(germanRecruitmentTargetValue(G, {space: "brussels", power: "spain",
            secondSpace: "antwerp", secondPower: "spain"}, true)).toBe("brussels:spain:antwerp:england");
        // The list shape carries both HRE picks as well.
        expect(germanRecruitmentTargetValue(G, {picks: [
            {space: "brussels", power: "spain"}, {space: "antwerp", power: "france"},
        ]}, {hre: true})).toBe("brussels:spain:antwerp:france");
    });

    it("omits #23 when no major mercenaries are present and forwards the chosen target", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        for (const space of Object.values(G.spaces)) space.land = {};
        G.spaces.london.land.england = {regular: 3, merc: 0, cav: 0};

        expect(germanRecruitmentSpaceOptions(G)).toEqual([]);
        expect(germanRecruitmentTargetValue(G, {space: "london", power: "england"})).toBeUndefined();

        G.spaces.brussels.land.france = {regular: 1, merc: 2, cav: 0};
        const target = germanRecruitmentTargetValue(G, {space: "brussels", power: "france"});
        const played: {cardId: string; asEvent: true; target?: string}[] = [];
        const playCard = (args: {cardId: string; asEvent: true; target?: string}): void => { played.push(args); };
        playEventCard(playCard, "vq-023", {typed: "ignored free text", selected: target});
        playEventCard(playCard, "vq-023", {typed: "", selected: undefined});
        expect(played).toEqual([
            {cardId: "vq-023", asEvent: true, target: "brussels:france"},
            {cardId: "vq-023", asEvent: true},
        ]);

        // #23 now owns a dedicated control; other cards keep the free-text fallback.
        expect(eventTargetMode("germanRecruitmentCurtailed", 0)).toBe("germanRecruitment");
        expect(eventTargetMode("rulerFallsIll", 0)).toBe("freeText");
        expect(eventTargetMode("", 0)).toBe("freeText");
    });

    it("renders the dedicated #23 space and power selector, with an HRE second pair", () => {
        const G = setupGame({...fakeCtx(), numPlayers: 6});
        for (const space of Object.values(G.spaces)) space.land = {};
        G.spaces.brussels.land.spain = {regular: 1, merc: 3, cav: 0};
        G.spaces.brussels.land.france = {regular: 2, merc: 2, cav: 0};
        G.spaces.antwerp.land.france = {regular: 0, merc: 4, cav: 0};
        const html = renderToStaticMarkup(<GermanRecruitmentTargetSelect G={G} hre
            value={{space: "brussels", power: "france", secondSpace: "antwerp", secondPower: "france"}}
            onChange={() => undefined}/>);
        expect(html).toContain("德意志裁军目标");
        expect(html).toContain("目标地区");
        expect(html).toContain("雇佣兵所属势力");
        expect(html).toContain("布鲁塞尔");
        expect(html).toContain("法国（雇佣兵 2）");
        expect(html).toContain("第二目标地区（神圣罗马帝国）");
        expect(html).toContain("法国（雇佣兵 4）");
        expect(html).not.toContain("事件目标（可选）");

        const single = renderToStaticMarkup(<GermanRecruitmentTargetSelect G={G} hre={false}
            value={{space: "brussels", power: "spain"}} onChange={() => undefined}/>);
        expect(single).toContain("西班牙（雇佣兵 3）");
        expect(single).not.toContain("第二目标地区");
    });

    it("renders the map, hand and action panel", () => {
        const G = setupGame(fakeCtx());
        const props: any = {
            G,
            ctx: {phase: "action", currentPlayer: "0", turn: 1, gameover: undefined},
            moves: {},
            playerID: "0",
            isActive: true,
            log: [],
            matchID: "test",
            chatMessages: [],
        };
        const html = renderToStaticMarkup(<VirginQueenBoard {...props}/>);
        expect(html).toContain("Virgin Queen");
        expect(html).toContain("伦敦");
        expect(html).toContain("奥斯曼帝国");
        expect(html).toContain("行动阶段");
        // Scenario notes are translated at render time without changing the
        // English stored in the exported log.
        expect(html).toContain("场景说明：六人战役设置");
        expect(html).not.toContain("Six-player Campaign setup");
    });

    it("shows scanned card art in the hand for official cards but not legacy cards", () => {
        const render = (cards: string[]): string => {
            const G = setupGame({...fakeCtx(), numPlayers: 2}, {scenario: "tutorial"});
            G.activePower = "ottoman";
            G.powers.ottoman.cards = cards;
            return renderToStaticMarkup(<VirginQueenBoard {...{
                G, ctx: {phase: "action", currentPlayer: "0", numPlayers: 2}, moves: {}, playerID: "0", isActive: true,
            } as any}/>);
        };
        const official = render(["vq-001"]);
        expect(official).toContain('src="/vq-cards/vq_1.webp"');
        expect(official).toContain("大维齐尔");
        const legacy = render(["vq-ev-morisco-revolt"]);
        expect(legacy).toContain("Morisco Revolt");
        expect(legacy).not.toContain("<img");
    });

    it("exposes the #95 same-power marriage option and proposes the correct pair", () => {
        const G = setupGame(fakeCtx());
        attachLouise(G, "spain");
        availableRoyal(G, "donCarlos");

        const choices = betrothalChoices(G, "spain", "donCarlos", "louiseLorraine");

        expect(choices.samePowerLouise).toBe(true);
        expect(choices.foreign.map((royal) => royal.id)).toContain("louiseLorraine");
        expect(choices.proposal).toEqual({male: "donCarlos", female: "louiseLorraine"});
        // The same-power pair is announced directly by proposeBetroth and
        // consumes the attachment; no foreign response is involved.
        expect(proposeBetroth(G, diplomacyCtx("1"), choices.proposal!)).toBeUndefined();
        expect(G.betrothals).toContainEqual({male: "donCarlos", female: "louiseLorraine", louiseAttached: true});
        expect(G.louiseAttachment).toEqual({power: "spain", available: false});
    });

    it("keeps ordinary foreign royal choices alongside the #95 option", () => {
        const G = setupGame(fakeCtx());
        G.year = 3;
        availableRoyal(G, "donCarlos");
        availableRoyal(G, "elisabethValois");

        const choices = betrothalChoices(G, "spain", "donCarlos", "elisabethValois");

        expect(choices.samePowerLouise).toBe(false);
        expect(choices.foreign.map((royal) => royal.id)).toContain("elisabethValois");
        expect(choices.proposal).toEqual({male: "donCarlos", female: "elisabethValois"});
    });

    it("offers another power's attached Louise as a normal foreign royal", () => {
        const G = setupGame(fakeCtx());
        attachLouise(G, "france");
        availableRoyal(G, "donCarlos");

        const choices = betrothalChoices(G, "spain", "donCarlos", "louiseLorraine");

        expect(choices.samePowerLouise).toBe(false);
        expect(choices.foreign.map((royal) => royal.id)).toContain("louiseLorraine");
        expect(choices.proposal).toEqual({male: "donCarlos", female: "louiseLorraine"});
    });

    it("shows the #95 same-power hint only in the card player's diplomacy panel", () => {
        const G = setupGame(fakeCtx());
        attachLouise(G, "spain");
        availableRoyal(G, "donCarlos");
        G.activePower = "spain";

        expect(renderDiplomacy(G, "1")).toContain("同国联姻：洛林的路易丝（#95）可与本国男性王室成婚。");
        expect(renderDiplomacy(G, "3")).not.toContain("同国联姻：");
        expect(renderDiplomacy(G, null)).not.toContain("同国联姻：");
    });

    it("renders the diplomacy panel and map for a spectator", () => {
        const G = setupGame(fakeCtx());
        const props: any = {
            G,
            ctx: {phase: "diplomacy", currentPlayer: "1", turn: 1, gameover: undefined},
            moves: {},
            playerID: null,
            isActive: false,
            log: [],
            matchID: "test",
            chatMessages: [],
        };
        const html = renderToStaticMarkup(<VirginQueenBoard {...props}/>);
        expect(html).toContain("外交阶段");
        expect(html).toContain("旁观模式");
    });

    describe("action-window responders", () => {
        /** Three-player seat P2 owns England and Protestant, both holding #16. */
        const multiHolderGame = (): VQGame => {
            const G = setupGame({...fakeCtx(), numPlayers: 3});
            G.phaseTurns = 1;
            G.impulse = 2;
            G.powers.england.cards = ["vq-016"];
            G.powers.protestant.cards = ["vq-016"];
            G.pendingAction = {power: "ottoman", responder: "england", responders: ["england", "protestant"],
                move: "impulse", args: {}};
            return G;
        };

        const responseCtx = (playerID: string): Ctx => ({
            ...fakeCtx(), numPlayers: 3, currentPlayer: "0", playerID, phase: "action",
            events: {setActivePlayers: jest.fn(), endStage: jest.fn(), endTurn: jest.fn()},
        } as unknown as Ctx);

        const renderBoard = (G: VQGame, playerID: string | null): string =>
            renderToStaticMarkup(<VirginQueenBoard {...{
                G, ctx: {phase: "action", currentPlayer: "0", numPlayers: 3},
                moves: {}, playerID, isActive: playerID === "1",
            } as any}/>);

        it("lists every eligible responder owned by one seat with its own validated options", () => {
            const G = multiHolderGame();
            expect(actionWindowResponders(G)).toEqual(["england", "protestant"]);

            const choices = actionResponderChoices(G, "1");
            expect(choices.map((choice) => choice.responder)).toEqual(["england", "protestant"]);
            expect(choices.map((choice) => choice.label)).toEqual(["英格兰", "新教联盟"]);
            for (const choice of choices) {
                expect(choice.options.map((option) => option.id)).toEqual(["continue", "harem"]);
            }

            // A seat that owns no responder still gets no action buttons.
            expect(actionResponderChoices(G, "0")).toEqual([]);
            expect(actionResponderChoices(G, null)).toEqual([]);
        });

        it("keeps Storms and #16 options when the responders belong to different seats", () => {
            const G = setupGame({...fakeCtx(), numPlayers: 3});
            G.phaseTurns = 1;
            G.impulse = 2;
            G.powers.spain.cards = ["vq-015"];
            G.powers.england.cards = ["vq-016"];
            G.pendingAction = {power: "ottoman", responder: "spain", responders: ["spain", "england"],
                move: "moveLand", args: {from: "istanbul", to: "edirne"}};

            expect(actionResponderChoices(G, "0").map((choice) => choice.responder)).toEqual(["spain"]);
            expect(actionResponderChoices(G, "0")[0].options.map((option) => option.id)).toEqual(["continue", "storms"]);
            expect(actionResponderChoices(G, "1").map((choice) => choice.responder)).toEqual(["england"]);
            expect(actionResponderChoices(G, "1")[0].options.map((option) => option.id)).toEqual(["continue", "harem"]);

            // A single owned responder keeps the old button-only panel.
            const html = renderBoard(G, "0");
            expect(html).toContain("打出 Storms，中断行动");
            expect(html).not.toContain("行动响应势力");
        });

        it("renders a selector so the seat can choose between its owned responders", () => {
            const html = renderBoard(multiHolderGame(), "1");
            expect(html).toContain("行动轮开始响应");
            expect(html).toContain("你控制多个可响应势力");
            expect(html).toContain("行动响应势力");
            expect(html).toContain("英格兰");
            expect(html).toContain("新教联盟");
            // The default is the first offered responder, England, whose #16
            // option must still be rendered.
            expect(html).toContain("奥斯曼跳过下次行动轮次");
        });

        it("routes an explicit responder and rejects a stale or foreign one", () => {
            const G = multiHolderGame();
            const ctx = responseCtx("1");

            expect(respondAction(G, ctx, {choice: "harem", responder: "spain"})).toBe(INVALID_MOVE);
            expect(respondAction(G, ctx, {choice: "storms", responder: "england"})).toBe(INVALID_MOVE);
            expect(respondAction(G, ctx, {choice: "harem", responder: "protestant"})).toBeUndefined();
            expect(G.pendingAction).toBeUndefined();
            expect(G.skipImpulse).toContain("ottoman");
            expect(G.powers.protestant.cards).not.toContain("vq-016");
            expect(G.powers.england.cards).toContain("vq-016");
        });

        it("keeps the first-owned fallback for callers that do not name a responder", () => {
            const G = multiHolderGame();
            expect(respondAction(G, responseCtx("1"), {choice: "continue"})).toBeUndefined();
            expect(G.pendingAction?.responders).toEqual(["protestant"]);
            expect(G.haremDeclinedImpulse).toEqual({england: G.impulse});
        });
    });

    describe("Act of Abjuration offers (#103)", () => {
        /**
         * Six-player game with three pending offers.  Home stacks and leaders
         * are cleared so the tested previews are deterministic: England has
         * five regulars in London, France three in Paris and the HRE two in
         * Vienna, each with one army leader.
         */
        const abjurationGame = (): VQGame => {
            const G = setupGame({...fakeCtx(), numPlayers: 6});
            G.year = 4;
            G.activePower = "england";
            G.pendingAbjuration = {offers: [
                {power: "england", space: "amsterdam"},
                {power: "france", space: "brussels"},
                {power: "hre", space: "rotterdam"},
            ]};
            for (const def of SPACES) {
                if (def.home !== "england" && def.home !== "france" && def.home !== "hre") continue;
                G.spaces[def.id].land[def.home] = {regular: 0, merc: 0, cav: 0};
                G.spaces[def.id].leaders = [];
            }
            for (const space of ["amsterdam", "brussels", "rotterdam"]) {
                G.spaces[space].control = "protestant";
                G.spaces[space].land = {};
            }
            G.spaces.london.land.england = {regular: 5, merc: 0, cav: 0};
            G.spaces.london.leaders = ["leicester"];
            G.leaders.leicester.location = "london";
            G.spaces.paris.land.france = {regular: 3, merc: 0, cav: 0};
            G.spaces.paris.leaders = ["guise"];
            G.leaders.guise.location = "paris";
            G.spaces.vienna.land.hre = {regular: 2, merc: 0, cav: 0};
            G.spaces.vienna.leaders = ["schwendi"];
            G.leaders.schwendi.location = "vienna";
            return G;
        };

        it("labels every offer with its power, destination, troops and leader", () => {
            const offers = abjurationOffers(abjurationGame());
            expect(offers.map((offer) => offer.power)).toEqual(["england", "france", "hre"]);
            expect(offers.map((offer) => offer.label)).toEqual([
                "英格兰：在 阿姆斯特丹 结盟 · 5 正规军 + 莱斯特伯爵",
                "法国：在 布鲁塞尔 结盟 · 3 正规军 + 吉斯公爵",
                "神圣罗马帝国：在 鹿特丹 结盟 · 2 正规军 + 拉扎鲁斯·冯·施文迪",
            ]);
            expect(offers.map(({powerName, space, spaceName, units, leaderId}) =>
                ({powerName, space, spaceName, units, leaderId}))).toEqual([
                {powerName: "英格兰", space: "amsterdam", spaceName: "阿姆斯特丹", units: 5, leaderId: "leicester"},
                {powerName: "法国", space: "brussels", spaceName: "布鲁塞尔", units: 3, leaderId: "guise"},
                {powerName: "神圣罗马帝国", space: "rotterdam", spaceName: "鹿特丹", units: 2, leaderId: "schwendi"},
            ]);
            // An offer with no home regulars still labels the destination.
            const empty = abjurationGame();
            empty.spaces.london.land.england = {regular: 0, merc: 0, cav: 0};
            empty.spaces.london.leaders = [];
            expect(abjurationOfferDetails(empty, {power: "england", space: "amsterdam"}).label)
                .toBe("英格兰：在 阿姆斯特丹 结盟 · 无正规军");
            expect(abjurationOffers({...empty, pendingAbjuration: undefined} as VQGame)).toEqual([]);
        });

        it("highlights exactly one offer and lets each one be selected for the move", () => {
            const offers = abjurationOffers(abjurationGame());
            expect(abjurationSelection(offers, undefined)).toBe(offers[0]);
            for (const offer of offers) expect(abjurationSelection(offers, offer.power)).toBe(offer);
            expect(abjurationSelection(offers, "spain" as Power)).toBe(offers[0]);
            expect(abjurationSelection([], "england")).toBeUndefined();

            const moves = {chooseAbjuration: jest.fn()};
            for (const offer of offers) {
                acceptAbjurationOffer(moves as any, offer);
                expect(moves.chooseAbjuration).toHaveBeenLastCalledWith(abjurationOfferMove(offer));
            }
            expect(moves.chooseAbjuration.mock.calls.map(([args]) => args.power))
                .toEqual(["england", "france", "hre"]);
        });

        it.each(["england", "france", "hre"] as Power[])("accepts the %s offer, moves the previewed troops, then unblocks actions", (power) => {
            const G = abjurationGame();
            const protestant = ownerOf(G, "protestant")!;
            const ctx = {...fakeCtx(), numPlayers: 6, currentPlayer: protestant, playerID: protestant, phase: "action"} as Ctx;
            const offer = G.pendingAbjuration!.offers.find((candidate) => candidate.power === power)!;
            const preview = abjurationOfferDetails(G, offer);
            const before = G.spaces[offer.space].land[power]?.regular ?? 0;

            // While the offer is pending, every other move is rejected.
            for (const move of ["endImpulse", "playCard", "moveLand", "recruit", "pass", "chooseCardEvent"]) {
                expect(moveError(G, move)).toBe("请先完成誓绝法案的提议选择。");
            }
            expect(moveError(G, "chooseAbjuration")).toBeUndefined();

            expect(chooseAbjuration(G, ctx, {power})).toBeUndefined();
            expect(G.pendingAbjuration).toBeUndefined();
            expect(G.powers[power].allies).toContain("protestant");
            expect(G.powers.protestant.allies).toContain(power);
            expect(G.spaces[offer.space].land[power]?.regular ?? 0).toBe(before + preview.units);
            if (preview.leaderId !== undefined) expect(G.leaders[preview.leaderId].location).toBe(offer.space);
            expect(moveError(G, "endImpulse")).toBeUndefined();
        });

        it("renders the labelled offers and the current selection only to the Protestant seat", () => {
            const G = abjurationGame();
            const protestant = ownerOf(G, "protestant")!;
            const render = (playerID: string): string => renderToStaticMarkup(<VirginQueenBoard {...{
                G, ctx: {phase: "action", currentPlayer: "1", numPlayers: 6},
                moves: {}, playerID, isActive: playerID === protestant,
            } as any}/>);

            const html = render(protestant);
            expect(html).toContain("誓绝法案 · 等待新教选择一项提议。");
            expect(html).toContain("英格兰：在 阿姆斯特丹 结盟 · 5 正规军 + 莱斯特伯爵");
            expect(html).toContain("法国：在 布鲁塞尔 结盟 · 3 正规军 + 吉斯公爵");
            expect(html).toContain("神圣罗马帝国：在 鹿特丹 结盟 · 2 正规军 + 拉扎鲁斯·冯·施文迪");
            expect(html).toContain("已选：英格兰 → 阿姆斯特丹 · 5 正规军 + 莱斯特伯爵");
            expect(html).toContain("接受 英格兰 的提议");
            // The first offer is selected by default and reflected in the
            // highlight attribute and the "已选" summary below it.
            expect(html).toContain('aria-pressed="true"');
            expect(html.match(/接受 英格兰 的提议/g) ?? []).toHaveLength(1);
            // The ordinary action panel is replaced, so its actions are unavailable.
            expect(html).not.toContain("结束行动轮次");

            const other = render("1");
            expect(other).toContain("誓绝法案 · 等待新教选择一项提议。");
            expect(other).toContain("等待新教玩家选择；其他势力此时无法行动。");
            expect(other).not.toContain("英格兰：在 阿姆斯特丹 结盟 · 5 正规军 + 莱斯特伯爵");
            expect(other).not.toContain("接受 英格兰 的提议");
            expect(other).not.toContain("结束行动轮次");
        });
    });
});
