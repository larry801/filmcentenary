import {Client} from 'boardgame.io/client';
import {Local} from 'boardgame.io/multiplayer'
import {FilmCentenaryGame} from './Game';
// import {IG} from "./types/setup";

// const hasDuplicateClassicCard = (G: IG, p: number) => {
//     const validCards = [...G.pub[p].discard, ...G.secretInfo.playerDecks[p], ...G.player[p].hand];
//     console.log(validCards)
// }

jest.mock('./game/logger', () => ({
    logger: {
        info: (log: string) => process.stdout.write(`info|${log}\n`),
        debug: (log: string) => process.stdout.write(`debug|${log}\n`),
        error: (log: string) => process.stdout.write(`error|${log}\n`),
    }
}));

const gameWithSeed = (seed: string) => ({
    ...FilmCentenaryGame,
    seed
});

it('Paramount', () => {
    const spec = {
        numPlayers: 4,
        game: gameWithSeed("kgte5b65"),
        multiplayer: Local(),
    };

    const p0 = Client({...spec, playerID: '0'} as any) as any;
    const p1 = Client({...spec, playerID: '1'} as any) as any;
    const p2 = Client({...spec, playerID: '2'} as any) as any;
    const p3 = Client({...spec, playerID: '3'} as any) as any;
    p0.start()
    p1.start()
    p2.start()
    p3.start()
    expect(p0.store.getState().G.pub[2].deposit).toEqual(3)

    p0.stop()
    p1.stop()
    p2.stop()
    p3.stop()
});
it('Can play Georges Méliès', () => {
    const spec = {
        numPlayers: 4,
        game: gameWithSeed("kguuhuk3"),
        multiplayer: Local(),
    };

    const p0 = Client({...spec, playerID: '0'} as any) as any;
    const p1 = Client({...spec, playerID: '1'} as any) as any;
    const p2 = Client({...spec, playerID: '2'} as any) as any;
    const p3 = Client({...spec, playerID: '3'} as any) as any;
    p0.start()
    p1.start()
    p2.start()
    p3.start()

    expect(p0.store.getState().G.player[0].hand.length).toEqual(0)
    expect(p0.store.getState().ctx.activePlayers["0"]).toEqual("chooseTarget")
    p0.stop()
    p1.stop()
    p2.stop()
    p3.stop()
})
it('Can Peek Cards', () => {
    const spec = {
        numPlayers: 2,
        game: gameWithSeed("kh72f8zx"),
        multiplayer: Local(),
    };

    const p0 = Client({...spec, playerID: '0'} as any) as any;
    const p1 = Client({...spec, playerID: '1'} as any) as any;

    p0.start();
    p1.start();


    p0.stop();
    p1.stop();

})
it('Can build North American Studio', () => {
    const spec = {
        numPlayers: 4,
        game: gameWithSeed("khbmdztm"),
        multiplayer: Local(),
    };

    const p0 = Client({...spec, playerID: '0'} as any) as any;
    const p1 = Client({...spec, playerID: '1'} as any) as any;
    const p2 = Client({...spec, playerID: '2'} as any) as any;
    const p3 = Client({...spec, playerID: '3'} as any) as any;
    p0.start()
    p1.start()
    p2.start()
    p3.start()

    p0.stop()
    p1.stop()
    p2.stop()
    p3.stop()
})
it('Execute 40 vp award after chooseTarget', () => {

    const spec = {
        numPlayers: 4,
        game: gameWithSeed("ki7m02hf"),
        multiplayer: Local(),
    };

    const p0 = Client({...spec, playerID: '0'} as any) as any;
    const p1 = Client({...spec, playerID: '1'} as any) as any;
    const p2 = Client({...spec, playerID: '2'} as any) as any;
    const p3 = Client({...spec, playerID: '3'} as any) as any;
    p0.start()
    p1.start()
    p2.start()
    p3.start()

    {
        p0.moves.setupGameMode({"mode": "NORMAL", "order": "FIXED"});
        p0.moves.setupGameMode({"mode": "TEAM2V2", "order": "FIXED"});
        p0.moves.setupGameMode({"mode": "TEAM2V2", "order": "FIRST_RANDOM"});
        p0.moves.setupGameMode({"mode": "TEAM2V2", "order": "FIXED"});
        p0.moves.setupGameMode({"mode": "TEAM2V2", "order": "ALL_RANDOM"});
        p0.moves.setupGameMode({"mode": "TEAM2V2", "order": "FIXED"});
        p0.moves.setupGameMode({"mode": "TEAM2V2", "order": "ALL_RANDOM"});
        p0.moves.setupGameMode({"mode": "TEAM2V2", "order": "FIXED"});
        p0.moves.setupGameMode({"mode": "TEAM2V2", "order": "ALL_RANDOM"});
        p0.moves.setupGameMode({"mode": "TEAM2V2", "order": "FIXED"});
        p0.moves.setupGameMode({"mode": "TEAM2V2", "order": "ALL_RANDOM"});
        p0.moves.setupGameMode({"mode": "TEAM2V2", "order": "FIXED"});
        p0.moves.setupGameMode({"mode": "TEAM2V2", "order": "ALL_RANDOM"});
        p0.moves.setupGameMode({"mode": "TEAM2V2", "order": "FIXED"});
        p0.moves.setupGameMode({"mode": "TEAM2V2", "order": "ALL_RANDOM"});
        p0.moves.showBoardStatus({
            "regions": [{
                "normalDeckLength": 2,
                "legendDeckLength": 0,
                "completedModernScoring": false,
                "era": 0,
                "buildings": [{"building": null, "region": 0, "activated": true, "owner": ""}, {
                    "building": null,
                    "region": 0,
                    "activated": true,
                    "owner": ""
                }, {"building": null, "region": 0, "activated": false, "owner": ""}],
                "legend": {"comment": null, "region": 0, "isLegend": true, "card": "P1101"},
                "normal": [{"comment": null, "region": 0, "isLegend": false, "card": "F1108"}, {
                    "comment": null,
                    "region": 0,
                    "isLegend": false,
                    "card": "F1104"
                }, {"comment": null, "region": 0, "isLegend": false, "card": "F1109"}],
                "share": 6
            }, {
                "normalDeckLength": 2,
                "legendDeckLength": 0,
                "completedModernScoring": false,
                "era": 0,
                "buildings": [{"building": null, "region": 1, "activated": true, "owner": ""}, {
                    "building": null,
                    "region": 1,
                    "activated": true,
                    "owner": ""
                }],
                "legend": {"comment": null, "region": 1, "isLegend": true, "card": "P1202"},
                "normal": [{"comment": null, "region": 1, "isLegend": false, "card": "S1203"}, {
                    "comment": null,
                    "region": 1,
                    "isLegend": false,
                    "card": "F1211"
                }, {"comment": null, "region": 1, "isLegend": false, "card": "F1207"}],
                "share": 6
            }, {
                "normalDeckLength": 1,
                "legendDeckLength": 0,
                "completedModernScoring": false,
                "era": 0,
                "buildings": [{"building": null, "region": 2, "activated": true, "owner": ""}, {
                    "building": null,
                    "region": 2,
                    "activated": false,
                    "owner": ""
                }],
                "legend": {"comment": null, "region": 2, "isLegend": true, "card": "S1301"},
                "normal": [{"comment": null, "region": 2, "isLegend": false, "card": "F1306"}, {
                    "comment": null,
                    "region": 2,
                    "isLegend": false,
                    "card": "S1303"
                }],
                "share": 4
            }, {
                "normalDeckLength": 0,
                "legendDeckLength": 0,
                "completedModernScoring": false,
                "era": 0,
                "buildings": [{"building": null, "region": 3, "activated": true, "owner": ""}, {
                    "building": null,
                    "region": 3,
                    "activated": false,
                    "owner": ""
                }],
                "legend": {"comment": null, "region": 3, "isLegend": true, "card": null},
                "normal": [{"comment": null, "region": 3, "isLegend": false, "card": null}, {
                    "comment": null,
                    "region": 3,
                    "isLegend": false,
                    "card": null
                }],
                "share": 0
            }], "school": [], "film": [], "matchID": "-8syGLq9H", "seed": "ki7m02hf"
        });


        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0});
        p3.moves.breakthrough({"card": "B01", "idx": 1, "playerID": "3", "res": 2});
        p3.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "3"});

        p3.moves.playCard({"card": "B02", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.buyCard({"buyer": "1", "target": "F1207", "resource": 4, "deposit": 0, "helper": []});
        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0});
        p0.moves.breakthrough({"card": "B01", "idx": 0, "playerID": "0", "res": 2});
        p0.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "0"});

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.requestEndTurn("0");

        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.buyCard({"buyer": "2", "target": "F1104", "resource": 4, "deposit": 0, "helper": []});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.buyCard({"buyer": "3", "target": "S1203", "resource": 4, "deposit": 0, "helper": []});
        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card": "B07", "idx": 2, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 2, "playerID": "1", "res": 0});
        p1.moves.breakthrough({"card": "B02", "idx": 0, "playerID": "1", "res": 2});
        p1.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "1"});

        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0});
        p0.moves.buyCard({"buyer": "0", "target": "F1108", "resource": 3, "deposit": 0, "helper": ["B02"]});
        p0.moves.requestEndTurn("0");

        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0});
        p2.moves.breakthrough({"card": "B02", "idx": 0, "playerID": "2", "res": 2});
        p2.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "2"});

        p2.moves.playCard({"card": "B01", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.breakthrough({"card": "B02", "idx": 0, "playerID": "3", "res": 2});
        p3.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "3"});

        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card": "B07", "idx": 2, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 2, "playerID": "1", "res": 0});
        p1.moves.breakthrough({"card": "F1207", "idx": 1, "playerID": "1", "res": 2});
        p1.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "1"});

        p1.moves.playCard({"card": "B01", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.buyCard({"buyer": "0", "target": "S1303", "resource": 3, "deposit": 0, "helper": ["F1108"]});
        p0.moves.requestEndTurn("0");

        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0});
        p2.moves.breakthrough({"card": "B01", "idx": 0, "playerID": "2", "res": 2});
        p2.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "2"});

        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.buyCard({"buyer": "3", "target": "F1304", "resource": 3, "deposit": 0, "helper": []});
        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.buyCard({"buyer": "1", "target": "P1202", "resource": 5, "deposit": 0, "helper": []});
        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0});
        p0.moves.breakthrough({"card": "B02", "idx": 0, "playerID": "0", "res": 2});
        p0.undo();
        p0.moves.buyCard({"buyer": "0", "target": "B03", "resource": 2, "deposit": 0, "helper": []});
        p0.moves.drawCard("0");
        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "B02", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.requestEndTurn("0");

        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "F1104", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.buyCard({"buyer": "2", "target": "F1106", "resource": 3, "deposit": 0, "helper": []});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "F1304", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.buyCard({"buyer": "3", "target": "P1101", "resource": 5, "deposit": 0, "helper": []});
        p3.moves.chooseEffect({"effect": {"e": "buy", "a": "F1103", "target": "3"}, "idx": 1, "p": "3"});

        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B01", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.buyCard({"buyer": "1", "target": "F1109", "resource": 3, "deposit": 0, "helper": []});
        p1.moves.requestEndTurn("1");
        p3.moves.chooseEvent({"event": "E02", "idx": 1, "p": "3"});
        p3.moves.chooseHand({"hand": "B07", "idx": 2, "p": "3"});
        p0.moves.chooseHand({"hand": "B07", "idx": 2, "p": "0"});
        p2.moves.chooseHand({"hand": "B07", "idx": 3, "p": "2"});
        p1.moves.chooseHand({"hand": "B07", "idx": 3, "p": "1"});


        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "B03", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.breakthrough({"card": "F1108", "idx": 0, "playerID": "0", "res": 2});
        p0.moves.chooseEffect({"effect": {"e": "industryBreakthrough", "a": 1}, "idx": 0, "p": "0"});

        p0.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "0"});

        p0.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "0"});

        p0.moves.drawCard("0");
        p0.moves.playCard({"card": "B04", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.requestEndTurn("0");

        p2.moves.playCard({"card": "F1106", "idx": 2, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B07", "idx": 2, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.buyCard({"buyer": "2", "target": "F1211", "resource": 3, "deposit": 0, "helper": []});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "P1101", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.updateSlot({
            "slot": {"comment": null, "region": 0, "isLegend": true, "card": "P2103"},
            "p": "3",
            "cardId": "P2103",
            "updateHistoryIndex": 0
        });
        p3.moves.chooseTarget({"target": "1", "idx": 1, "p": "3", "targetName": "玩家1"});
        p1.moves.chooseHand({"hand": "P1202", "idx": 0, "p": "1"});

        p3.moves.buyCard({"buyer": "3", "target": "B03", "resource": 2, "deposit": 0, "helper": []});
        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.buyCard({"buyer": "1", "target": "F1306", "resource": 3, "deposit": 0, "helper": []});
        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.breakthrough({"card": "B02", "idx": 0, "playerID": "0", "res": 2});
        p0.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "0"});

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.drawCard("0");
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
        p0.undo();
        p0.undo();
        p0.moves.buyCard({"buyer": "0", "target": "F1205", "resource": 1, "deposit": 1, "helper": []});
        p0.undo();
        p0.moves.buyCard({"buyer": "0", "target": "B03", "resource": 1, "deposit": 1, "helper": []});
        p0.moves.requestEndTurn("0");

        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "F1104", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.breakthrough({"card": "F1211", "idx": 0, "playerID": "2", "res": 2});
        p2.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "2"});

        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 2, "playerID": "3", "res": 0});
        p3.moves.breakthrough({"card": "F1103", "idx": 0, "playerID": "3", "res": 2});
        p3.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "3"});

        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
        p1.moves.breakthrough({"card": "F1109", "idx": 1, "playerID": "1", "res": 2});
        p1.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "1"});
        p1.moves.payAdditionalCost({"res": 1, "deposit": 0});

        p1.moves.playCard({"card": "B01", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0});
        p0.moves.buyCard({"buyer": "0", "target": "F1208", "resource": 3, "deposit": 0, "helper": []});
        p0.moves.breakthrough({"card": "B04", "idx": 0, "playerID": "0", "res": 1});
        p0.moves.requestEndTurn("0");

        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "F1106", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "V112", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.buyCard({"buyer": "2", "target": "S1301", "resource": 5, "deposit": 1, "helper": []});
        p2.moves.requestEndTurn("2");
        p2.moves.chooseEvent({"event": "E04", "idx": 0, "p": "2"});


        p3.moves.playCard({"card": "B07", "idx": 2, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "V111", "idx": 1, "playerID": "3", "res": 0});
        p3.moves.buyCard({"buyer": "3", "target": "F1205", "resource": 2, "deposit": 0, "helper": []});
        p3.moves.playCard({"card": "F1304", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.requestEndTurn("3");
        p1.moves.chooseEvent({"event": "E01", "idx": 1, "p": "1"});
        p1.moves.chooseEffect({"effect": {"e": "industryLevelUp", "a": 1}, "idx": 0, "p": "1"});
        p0.moves.chooseEffect({"effect": {"e": "industryLevelUp", "a": 1}, "idx": 0, "p": "0"});
        p2.moves.chooseEffect({"effect": {"e": "aestheticsLevelUp", "a": 1}, "idx": 1, "p": "2"});
        p3.moves.chooseEffect({"effect": {"e": "industryLevelUp", "a": 1}, "idx": 0, "p": "3"});


        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "V113", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.drawCard("1");
        p1.moves.buyCard({"buyer": "1", "target": "F2208", "resource": 5, "deposit": 1, "helper": []});
        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "B03", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "B03", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.drawCard("0");
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.buyCard({"buyer": "0", "target": "F2306", "resource": 6, "deposit": 1, "helper": []});
        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand": "B07", "idx": 0, "p": "2"});

        p2.moves.playCard({"card": "B07", "idx": 4, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B07", "idx": 2, "playerID": "2", "res": 0});
        p2.moves.breakthrough({"card": "B02", "idx": 2, "playerID": "2", "res": 2});
        p2.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "2"});

        p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.buyCard({"buyer": "2", "target": "B03", "resource": 2, "deposit": 0, "helper": []});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "P1101", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.updateSlot({
            "slot": {"comment": null, "region": 0, "isLegend": true, "card": "S2101"},
            "p": "3",
            "cardId": "S2101",
            "updateHistoryIndex": 1
        });
        p3.moves.chooseTarget({"target": "2", "idx": 3, "p": "3", "targetName": "P3"});
        p2.moves.chooseHand({"hand": "F1106", "idx": 2, "p": "2"});

        p3.moves.drawCard("3");
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.buyCard({"buyer": "3", "target": "F2211", "resource": 4, "deposit": 0, "helper": []});
        p3.moves.requestEndTurn("3");

        p1.moves.drawCard("1");
        p1.moves.playCard({"card": "B07", "idx": 5, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "V113", "idx": 3, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "F1306", "idx": 2, "playerID": "1", "res": 0});
        p1.undo();
        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
        p1.undo();
        p1.undo();
        p1.undo();
        p1.undo();
        p1.moves.playCard({"card": "V113", "idx": 3, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "F1306", "idx": 1, "playerID": "1", "res": 0});
        p1.moves.breakthrough({"card": "B04", "idx": 1, "playerID": "1", "res": 2});
        p1.moves.breakthrough({"card": "P1202", "idx": 0, "playerID": "1", "res": 2});
        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "B07", "idx": 2, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "B03", "idx": 1, "playerID": "0", "res": 0});
        p0.moves.breakthrough({"card": "B04", "idx": 0, "playerID": "0", "res": 2});
        p0.moves.buyCard({"buyer": "0", "target": "B01", "resource": 2, "deposit": 0, "helper": []});
        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand": "B07", "idx": 3, "p": "2"});

        p2.moves.drawCard("2");
        p2.moves.playCard({"card": "B07", "idx": 3, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "F1104", "idx": 2, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "V112", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.buyCard({"buyer": "2", "target": "F2304", "resource": 4, "deposit": 2, "helper": []});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card": "P1101", "idx": 2, "playerID": "3", "res": 0});
        p3.moves.updateSlot({
            "slot": {"comment": null, "region": 3, "isLegend": false, "card": "F2406"},
            "p": "3",
            "cardId": "F2406",
            "updateHistoryIndex": 2
        });
        p3.moves.chooseTarget({"target": "1", "idx": 1, "p": "3", "targetName": "P2"});

        p3.moves.playCard({"card": "B05", "idx": 2, "playerID": "3", "res": 0});
        p3.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "3"});

        p3.moves.playCard({"card": "B03", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "F1205", "idx": 1, "playerID": "3", "res": 0});
        p3.moves.breakthrough({"card": "F1304", "idx": 0, "playerID": "3", "res": 2});
        p3.moves.comment({"target": "F2107", "comment": "B04", "p": "3"});

        p3.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "3"});

        p3.moves.drawCard("3");
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card": "B05", "idx": 2, "playerID": "1", "res": 0});
        p1.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "1"});

        p1.moves.playCard({"card": "V121", "idx": 4, "playerID": "1", "res": 0});
        p1.undo();
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
        p1.moves.breakthrough({"card": "B01", "idx": 0, "playerID": "1", "res": 2});
        p1.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "1"});

        p1.moves.breakthrough({"card": "V121", "idx": 0, "playerID": "1", "res": 2});
        p1.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "1"});

        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card": "B03", "idx": 3, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "B07", "idx": 2, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.drawCard("0");
        p0.moves.playCard({"card": "B05", "idx": 1, "playerID": "0", "res": 0});
        p0.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "0"});

        p0.undo();
        p0.undo();
        p0.undo();
        p0.undo();
        p0.moves.drawCard("0");
        p0.moves.playCard({"card": "B05", "idx": 2, "playerID": "0", "res": 0});
        p0.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "0"});

        p0.moves.playCard({"card": "F2306", "idx": 2, "playerID": "0", "res": 0});
        p0.moves.chooseHand({"hand": "B07", "idx": 0, "p": "0"});

        p0.moves.buyCard({"buyer": "0", "target": "P2103", "resource": 5, "deposit": 3, "helper": ["F1208"]});
        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand": "B07", "idx": 4, "p": "2"});

        p2.moves.playCard({"card": "B05", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "2"});

        p2.moves.playCard({"card": "F1106", "idx": 3, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B03", "idx": 3, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "V131", "idx": 2, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
        p2.undo();
        p2.undo();
        p2.undo();
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.drawCard("2");
        p2.moves.playCard({"card": "V131", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B04", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.buyCard({"buyer": "2", "target": "F2405", "resource": 6, "deposit": 0, "helper": []});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card": "V122", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.drawCard("3");
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0});
        p3.moves.breakthrough({"card": "V111", "idx": 0, "playerID": "3", "res": 2});
        p3.moves.chooseEffect({"effect": {"e": "buildStudio", "a": 1}, "idx": 1, "p": "3"});

        p3.moves.chooseRegion({"r": 0, "idx": 0, "p": "3"});
        p3.moves.payAdditionalCost({"res": 3, "deposit": 0});

        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "F2208", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "V113", "idx": 1, "playerID": "1", "res": 0});
        p1.moves.drawCard("1");
        p1.moves.playCard({"card": "B05", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "1"});

        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
        p1.moves.buyCard({"buyer": "1", "target": "S2101", "resource": 7, "deposit": 0, "helper": ["F1306"]});
        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card": "V123", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.drawCard("0");
        p0.moves.playCard({"card": "F2306", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.chooseHand({"hand": "B07", "idx": 0, "p": "0"});

        p0.moves.buyCard({"buyer": "0", "target": "F2407", "resource": 6, "deposit": 0, "helper": []});
        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand": "B04", "idx": 4, "p": "2"});

        p2.moves.playCard({"card": "V131", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.drawCard("2");
        p2.moves.playCard({"card": "F2405", "idx": 1, "playerID": "2", "res": 0});
        p2.moves.chooseEffect({
            "effect": {"e": "step", "a": [{"e": "res", "a": 1}, {"e": "update", "a": 1}]},
            "idx": 0,
            "p": "2"
        });
        p2.moves.updateSlot({
            "slot": {"comment": "B04", "region": 0, "isLegend": false, "card": "F2107"},
            "p": "2",
            "cardId": "F2107",
            "updateHistoryIndex": 3
        });

        p2.moves.breakthrough({"card": "B05", "idx": 0, "playerID": "2", "res": 2});
        p2.moves.chooseEffect({"effect": {"e": "industryBreakthrough", "a": 1}, "idx": 0, "p": "2"});

        p2.moves.chooseEffect({"effect": {"e": "buildStudio", "a": 1}, "idx": 1, "p": "2"});

        p2.moves.chooseRegion({"r": 0, "idx": 0, "p": "2"});
        p2.moves.payAdditionalCost({"res": 3, "deposit": 0});

        p2.moves.requestEndTurn("2");

        p3.moves.drawCard("3");
        p3.moves.playCard({"card": "B07", "idx": 4, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 3, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "V132", "idx": 1, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.buyCard({"buyer": "3", "target": "S2301", "resource": 5, "deposit": 4, "helper": ["F2211"]});
        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card": "F2208", "idx": 2, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "F1306", "idx": 2, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "V113", "idx": 2, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 2, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 2, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 2, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 2, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.buyCard({"buyer": "1", "target": "F2112", "resource": 6, "deposit": 0, "helper": []});
        p1.undo();
        p1.undo();
        p1.undo();
        p1.undo();
        p1.undo();
        p1.undo();
        p1.undo();
        p1.undo();
        p1.moves.playCard({"card": "B07", "idx": 3, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 3, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 3, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 3, "playerID": "1", "res": 0});
        p1.moves.breakthrough({"card": "V113", "idx": 2, "playerID": "1", "res": 2});
        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.buyCard({"buyer": "1", "target": "F2112", "resource": 6, "deposit": 0, "helper": []});
        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card": "P2103", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.chooseTarget({"target": "1", "idx": 1, "p": "0", "targetName": "玩家1"});
        p1.moves.chooseHand({"hand": "B07", "idx": 6, "p": "1"});

        p0.moves.playCard({"card": "B03", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "B03", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.breakthrough({"card": "B01", "idx": 0, "playerID": "0", "res": 2});
        p0.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "0"});

        p0.moves.playCard({"card": "B05", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "0"});

        p0.moves.playCard({"card": "F1208", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.drawCard("0");
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand": "B07", "idx": 2, "p": "2"});

        p2.moves.playCard({"card": "F2304", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "F1106", "idx": 3, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B07", "idx": 4, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B07", "idx": 3, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "F1104", "idx": 1, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.breakthrough({"card": "V112", "idx": 0, "playerID": "2", "res": 2});
        p2.moves.buyCard({"buyer": "2", "target": "F2114", "resource": 4, "deposit": 0, "helper": []});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "V122", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B05", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "3"});

        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "F1205", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.drawCard("3");
        p3.moves.playCard({"card": "P1101", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.updateSlot({
            "slot": {"comment": null, "region": 3, "isLegend": false, "card": "F2403"},
            "p": "3",
            "cardId": "F2403",
            "updateHistoryIndex": 4
        });
        p3.moves.chooseTarget({"target": "1", "idx": 0, "p": "3", "targetName": "P2"});
        p1.moves.chooseHand({"hand": "F1306", "idx": 1, "p": "1"});

        p3.moves.playCard({"card": "B03", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.buyCard({"buyer": "3", "target": "F2308", "resource": 6, "deposit": 0, "helper": []});
        p3.moves.drawCard("3");
        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card": "F2208", "idx": 1, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "F2112", "idx": 5, "playerID": "1", "res": 0});
        p1.moves.confirmRespond("no");

        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 2, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B05", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "1"});

        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
        p1.moves.buyCard({"buyer": "1", "target": "P2401", "resource": 10, "deposit": 0, "helper": []});
        p1.moves.chooseEffect({"effect": {"e": "buy", "a": "F2406", "target": "1"}, "idx": 1, "p": "1"});

        p1.moves.drawCard("1");
        p1.moves.playCard({"card": "B04", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "F2406", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "F2306", "idx": 2, "playerID": "0", "res": 0});
        p0.moves.chooseHand({"hand": "B07", "idx": 1, "p": "0"});

        p0.moves.drawCard("0");
        p0.moves.playCard({"card": "V123", "idx": 1, "playerID": "0", "res": 0});
        p0.moves.breakthrough({"card": "B05", "idx": 0, "playerID": "0", "res": 2});
        p0.moves.chooseEffect({"effect": {"e": "industryBreakthrough", "a": 1}, "idx": 0, "p": "0"});

        p0.moves.chooseEffect({"effect": {"e": "buildStudio", "a": 1}, "idx": 1, "p": "0"});

        p0.moves.chooseRegion({"r": 3, "idx": 2, "p": "0"});
        p0.moves.payAdditionalCost({"res": 3, "deposit": 0});

        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand": "B07", "idx": 3, "p": "2"});

        p2.moves.playCard({"card": "F2304", "idx": 4, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "F2114", "idx": 3, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B07", "idx": 3, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B07", "idx": 3, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B03", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.drawCard("2");
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "V131", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B04", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.buyCard({"buyer": "2", "target": "F2403", "resource": 8, "deposit": 0, "helper": []});
        p2.moves.requestEndTurn("2");
        p1.moves.chooseEvent({"event": "E05", "idx": 0, "p": "1"});


        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 2, "playerID": "3", "res": 0});
        p3.moves.breakthrough({"card": "F2211", "idx": 1, "playerID": "3", "res": 2});
        p3.moves.comment({"target": "S2204", "comment": "B04", "p": "3"});
        p3.moves.chooseEffect({"effect": {"e": "industryBreakthrough", "a": 1}, "idx": 0, "p": "3"});

        p3.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "3"});
        p3.moves.payAdditionalCost({"res": 1, "deposit": 0});

        p3.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "3"});
        p3.moves.payAdditionalCost({"res": 1, "deposit": 0});

        p3.moves.drawCard("3");
        p3.moves.playCard({"card": "V132", "idx": 1, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "F2308", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.buyCard({"buyer": "3", "target": "F2214", "resource": 4, "deposit": 1, "helper": []});
        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 2, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 2, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 2, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 3, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "F2112", "idx": 2, "playerID": "1", "res": 0});
        p1.moves.confirmRespond("no");

        p1.moves.breakthrough({"card": "F1306", "idx": 1, "playerID": "1", "res": 2});
        p1.moves.chooseEffect({"effect": {"e": "buildStudio", "a": 1}, "idx": 1, "p": "1"});

        p1.undo();
        p1.undo();
        p1.moves.playCard({"card": "P2401", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.chooseTarget({"target": "3", "idx": 2, "p": "1", "targetName": "P4"});
        p0.moves.peek({"idx": 0, "card": "F1208", "p": "0", "shownCards": ["F1208", "B05", "B03"]});

        p1.moves.buyCard({"buyer": "1", "target": "F2207", "resource": 8, "deposit": 0, "helper": []});
        p1.moves.playCard({"card": "F1306", "idx": 0, "playerID": "1", "res": 0});
        p1.undo();
        p1.undo();
        p1.moves.playCard({"card": "F1306", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.buyCard({"buyer": "1", "target": "F2113", "resource": 5, "deposit": 0, "helper": []});
        p1.moves.buyCard({"buyer": "1", "target": "F2207", "resource": 5, "deposit": 3, "helper": []});
        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card": "P2103", "idx": 2, "playerID": "0", "res": 0});
        p0.moves.chooseTarget({"target": "1", "idx": 1, "p": "0", "targetName": "P2"});
        p1.moves.chooseHand({"hand": "B04", "idx": 2, "p": "1"});

        p0.moves.playCard({"card": "B05", "idx": 5, "playerID": "0", "res": 0});
        p0.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "0"});

        p0.moves.playCard({"card": "B07", "idx": 3, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "B07", "idx": 2, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "F2407", "idx": 1, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "B03", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "V243", "idx": 1, "playerID": "0", "res": 0});
        p0.moves.breakthrough({"card": "F1208", "idx": 0, "playerID": "0", "res": 2});
        p0.moves.chooseEffect({"effect": {"e": "aestheticsBreakthrough", "a": 1}, "idx": 1, "p": "0"});

        p0.undo();
        p0.undo();
        p0.moves.buyCard({"buyer": "0", "target": "F2212", "resource": 4, "deposit": 0, "helper": ["F1208"]});
        p0.moves.buyCard({"buyer": "0", "target": "F2111", "resource": 2, "deposit": 2, "helper": []});
        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand": "B07", "idx": 2, "p": "2"});

        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "F1106", "idx": 2, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B03", "idx": 2, "playerID": "2", "res": 0});
        p2.moves.drawCard("2");
        p2.moves.playCard({"card": "B07", "idx": 2, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "F1104", "idx": 1, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "F2405", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.updateSlot({
            "slot": {"comment": null, "region": 1, "isLegend": true, "card": "P2202"},
            "p": "2",
            "cardId": "P2202",
            "updateHistoryIndex": 5
        });

        p2.moves.buyCard({"buyer": "2", "target": "F2108", "resource": 5, "deposit": 0, "helper": []});
        p2.moves.requestEndTurn("2");
        p1.moves.chooseEvent({"event": "E09", "idx": 1, "p": "1"});


        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "V132", "idx": 1, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0});
        p3.moves.drawCard("3");
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0});
        p3.moves.drawCard("3");
        p3.moves.breakthrough({"card": "B04", "idx": 1, "playerID": "3", "res": 2});
        p3.moves.playCard({"card": "B05", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "3"});

        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card": "F2406", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.peek({"idx": 0, "card": null, "p": "1", "shownCards": ["F2112", "V241", "F2113"]});

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 2, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "F2112", "idx": 4, "playerID": "1", "res": 0});
        p1.moves.confirmRespond("yes");
        p1.undo();
        p1.moves.confirmRespond("no");

        p1.moves.breakthrough({"card": "F2113", "idx": 4, "playerID": "1", "res": 2});
        p1.moves.chooseEffect({"effect": {"e": "buildCinema", "a": 1}, "idx": 2, "p": "1"});

        p1.moves.chooseRegion({"r": 1, "idx": 0, "p": "1"});
        p1.moves.payAdditionalCost({"res": 3, "deposit": 0});

        p1.moves.playCard({"card": "F2208", "idx": 1, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 4, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "F1306", "idx": 3, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "F2207", "idx": 1, "playerID": "1", "res": 0});
        p1.moves.chooseEffect({
            "effect": {"e": "step", "a": [{"e": "res", "a": 2}, {"e": "deposit", "a": 1}]},
            "idx": 0,
            "p": "1"
        });

        p1.moves.playCard({"card": "B05", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "1"});

        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
        p1.moves.buyCard({"buyer": "1", "target": "F2303", "resource": 7, "deposit": 0, "helper": []});
        p1.moves.playCard({"card": "B04", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.requestEndTurn("1");

        p0.moves.drawCard("0");
        p0.moves.playCard({"card": "F2306", "idx": 4, "playerID": "0", "res": 0});
        p0.moves.chooseHand({"hand": "B07", "idx": 0, "p": "0"});

        p0.moves.playCard({"card": "V123", "idx": 2, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "B03", "idx": 1, "playerID": "0", "res": 0});
        p0.moves.buyCard({"buyer": "0", "target": "S2204", "resource": 5, "deposit": 3, "helper": ["B05"]});
        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand": "B07", "idx": 2, "p": "2"});

        p2.moves.playCard({"card": "V131", "idx": 2, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "F2403", "idx": 1, "playerID": "2", "res": 0});
        p2.moves.peek({"idx": 0, "card": null, "p": "2", "shownCards": ["V242", "B04", "B07"]});

        p2.moves.playCard({"card": "F2114", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.comment({"target": "F3109", "comment": "B04", "p": "2"});

        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.drawCard("2");
        p2.moves.playCard({"card": "F2304", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "F2405", "idx": 1, "playerID": "2", "res": 0});
        p2.moves.chooseEffect({"effect": {"e": "breakthroughResDeduct", "a": 2}, "idx": 1, "p": "2"});
        p2.moves.chooseHand({"hand": "F1106", "idx": 0, "p": "2"});

        p2.moves.buyCard({"buyer": "2", "target": "F2309", "resource": 5, "deposit": 1, "helper": []});
        p2.moves.requestEndTurn("2");
        p2.moves.chooseEffect({"effect": {"e": "aestheticsLevelUp", "a": 1}, "idx": 1, "p": "2"});
        p3.moves.chooseEvent({"event": "E06", "idx": 1, "p": "3"});


        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "F2308", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "P1101", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.updateSlot({
            "slot": {"comment": null, "region": 3, "isLegend": true, "card": "P3402"},
            "p": "3",
            "cardId": "P3402",
            "updateHistoryIndex": 6
        });
        p3.moves.chooseTarget({"target": "1", "idx": 0, "p": "3", "targetName": "P2"});
        p1.moves.chooseHand({"hand": "P2401", "idx": 2, "p": "1"});

        p3.moves.playCard({"card": "F2214", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B03", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "V122", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.buyCard({"buyer": "3", "target": "F3311", "resource": 7, "deposit": 0, "helper": []});
        p3.moves.drawCard("3");
        p3.moves.breakthrough({"card": "F1205", "idx": 0, "playerID": "3", "res": 2});
        p3.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "3"});
        p3.moves.payAdditionalCost({"res": 1, "deposit": 0});

        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.undo();
        p1.moves.breakthrough({"card": "B04", "idx": 1, "playerID": "1", "res": 2});
        p1.moves.playCard({"card": "B05", "idx": 1, "playerID": "1", "res": 0});
        p1.undo();
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.breakthrough({"card": "B05", "idx": 0, "playerID": "1", "res": 2});
        p1.moves.chooseEffect({"effect": {"e": "industryBreakthrough", "a": 1}, "idx": 0, "p": "1"});

        p1.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "1"});
        p1.moves.payAdditionalCost({"res": 1, "deposit": 0});

        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card": "B03", "idx": 1, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "P2103", "idx": 2, "playerID": "0", "res": 0});
        p0.moves.chooseTarget({"target": "1", "idx": 1, "p": "0", "targetName": "P2"});
        p1.moves.chooseHand({"hand": "B04", "idx": 5, "p": "1"});

        p0.moves.playCard({"card": "V123", "idx": 2, "playerID": "0", "res": 0});
        p0.moves.breakthrough({"card": "B05", "idx": 2, "playerID": "0", "res": 2});
        p0.moves.chooseEffect({"effect": {"e": "industryBreakthrough", "a": 1}, "idx": 0, "p": "0"});

        p0.moves.chooseEffect({"effect": {"e": "buildCinema", "a": 1}, "idx": 1, "p": "0"});

        p0.moves.chooseRegion({"r": 1, "idx": 0, "p": "0"});
        p0.moves.payAdditionalCost({"res": 1, "deposit": 2});

        p0.moves.playCard({"card": "F2212", "idx": 1, "playerID": "0", "res": 0});
        p0.moves.comment({"target": "F3306", "comment": "B04", "p": "0"});

        p0.moves.buyCard({"buyer": "0", "target": "F2210", "resource": 4, "deposit": 2, "helper": []});
        p0.moves.playCard({"card": "B04", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand": "B07", "idx": 2, "p": "2"});

        p2.moves.playCard({"card": "F2108", "idx": 3, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "F1104", "idx": 3, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "V242", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "V212", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.breakthrough({"card": "B04", "idx": 0, "playerID": "2", "res": 2});
        p2.moves.buyCard({"buyer": "2", "target": "F3307", "resource": 2, "deposit": 7, "helper": []});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card": "B07", "idx": 2, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B03", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.breakthrough({"card": "V231", "idx": 0, "playerID": "3", "res": 2});
        p3.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "3"});
        p3.moves.payAdditionalCost({"res": 1, "deposit": 0});

        p3.moves.drawCard("3");
        p3.moves.playCard({"card": "B05", "idx": 2, "playerID": "3", "res": 0});
        p3.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "3"});

        p3.moves.playCard({"card": "B07", "idx": 2, "playerID": "3", "res": 0});
        p3.moves.breakthrough({"card": "B04", "idx": 0, "playerID": "3", "res": 1});
        p3.moves.playCard({"card": "B04", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card": "F2406", "idx": 5, "playerID": "1", "res": 0});
        p1.moves.peek({"idx": 0, "card": null, "p": "1", "shownCards": ["B07", "F2303", "B07"]});

        p1.moves.playCard({"card": "F2303", "idx": 6, "playerID": "1", "res": 0});
        p1.moves.chooseHand({"hand": "B04", "idx": 5, "p": "1"});
        p1.moves.chooseHand({"hand": "B07", "idx": 6, "p": "1"});

        p1.moves.playCard({"card": "F2112", "idx": 5, "playerID": "1", "res": 0});
        p1.moves.confirmRespond("no");

        p1.moves.playCard({"card": "F2208", "idx": 2, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 4, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 4, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "F2207", "idx": 2, "playerID": "1", "res": 0});
        p1.moves.chooseEffect({"effect": {"e": "breakthroughResDeduct", "a": 2}, "idx": 1, "p": "1"});
        p1.moves.chooseHand({"hand": "F1306", "idx": 2, "p": "1"});

        p1.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "1"});
        p1.moves.payAdditionalCost({"res": 2, "deposit": 0});

        p1.moves.breakthrough({"card": "V211", "idx": 1, "playerID": "1", "res": 2});
        p1.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "1"});
        p1.moves.payAdditionalCost({"res": 2, "deposit": 0});
        p1.moves.chooseEffect({"effect": {"e": "industryLevelUp", "a": 1}, "idx": 0, "p": "1"});

        p1.moves.breakthrough({"card": "V241", "idx": 0, "playerID": "1", "res": 2});
        p1.undo();
        p1.undo();
        p1.moves.chooseEffect({"effect": {"e": "aestheticsLevelUp", "a": 1}, "idx": 1, "p": "1"});

        p1.moves.breakthrough({"card": "V241", "idx": 0, "playerID": "1", "res": 2});
        p1.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "1"});
        p1.moves.payAdditionalCost({"res": 0, "deposit": 1});

        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card": "B05", "idx": 1, "playerID": "0", "res": 0});
        p0.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "0"});

        p0.moves.playCard({"card": "B05", "idx": 4, "playerID": "0", "res": 0});
        p0.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "0"});

        p0.moves.drawCard("0");
        p0.moves.playCard({"card": "F2306", "idx": 1, "playerID": "0", "res": 0});
        p0.moves.chooseHand({"hand": "B07", "idx": 4, "p": "0"});

        p0.moves.playCard({"card": "B03", "idx": 3, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "V213", "idx": 2, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "F2407", "idx": 1, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "V243", "idx": 0, "playerID": "0", "res": 0});
        p0.undo();
        p0.undo();
        p0.moves.breakthrough({"card": "V243", "idx": 0, "playerID": "0", "res": 2});
        p0.moves.playCard({"card": "F2407", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand": "B07", "idx": 2, "p": "2"});

        p2.moves.playCard({"card": "F2304", "idx": 2, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "F2403", "idx": 2, "playerID": "2", "res": 0});
        p2.moves.peek({"idx": 0, "card": null, "p": "2", "shownCards": ["F2405", "F1104", "B07"]});

        p2.moves.playCard({"card": "V131", "idx": 3, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B03", "idx": 1, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B05", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.chooseEffect({"effect": {"e": "aesAward", "a": 1}, "idx": 1, "p": "2"});

        p2.undo();
        p2.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "2"});

        p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0});
        p2.moves.drawCard("2");
        p2.moves.playCard({"card": "V232", "idx": 1, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "F2405", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.updateSlot({
            "slot": {"comment": "B04", "region": 0, "isLegend": false, "card": "F3109"},
            "p": "2",
            "cardId": "F3109",
            "updateHistoryIndex": 7
        });

        p2.moves.buyCard({"buyer": "2", "target": "F3310", "resource": 7, "deposit": 1, "helper": []});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card": "F2308", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "F2214", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.buyCard({"buyer": "3", "target": "F3312", "resource": 11, "deposit": 0, "helper": []});
        p3.moves.drawCard("3");
        p3.moves.playCard({"card": "V122", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.drawCard("3");
        p3.moves.requestEndTurn("3");
        p3.moves.chooseEffect({"effect": {"e": "industryLevelUp", "a": 1}, "idx": 0, "p": "3"});


        p1.moves.playCard({"card": "F2112", "idx": 7, "playerID": "1", "res": 0});
        p1.moves.confirmRespond("no");

        p1.moves.playCard({"card": "B07", "idx": 6, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 5, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 3, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B05", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "1"});

        p1.moves.playCard({"card": "B07", "idx": 3, "playerID": "1", "res": 0});
        p1.moves.breakthrough({"card": "B04", "idx": 0, "playerID": "1", "res": 2});
        p1.moves.breakthrough({"card": "B04", "idx": 1, "playerID": "1", "res": 2});
        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card": "F2212", "idx": 4, "playerID": "0", "res": 0});
        p0.moves.comment({"target": "F3305", "comment": "B04", "p": "0"});

        p0.undo();
        p0.undo();
        p0.moves.playCard({"card": "F1208", "idx": 2, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "V123", "idx": 2, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0});
        p0.moves.breakthrough({"card": "F2111", "idx": 0, "playerID": "0", "res": 2});
        p0.moves.chooseEffect({"effect": {"e": "industryBreakthrough", "a": 1}, "idx": 0, "p": "0"});

        p0.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "0"});
        p0.moves.payAdditionalCost({"res": 1, "deposit": 0});

        p0.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "0"});
        p0.moves.payAdditionalCost({"res": 1, "deposit": 0});

        p0.moves.drawCard("0");
        p0.moves.playCard({"card": "F2212", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.comment({"target": "F3110", "comment": "B04", "p": "0"});

        p0.moves.playCard({"card": "B04", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand": "B07", "idx": 4, "p": "2"});

        p2.moves.playCard({"card": "F2309", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.chooseHand({"hand": "B04", "idx": 4, "p": "2"});
        p2.moves.chooseHand({"hand": "B07", "idx": 3, "p": "2"});

        p2.moves.playCard({"card": "F2108", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "F2114", "idx": 3, "playerID": "2", "res": 0});
        p2.moves.comment({"target": "F3110", "comment": null, "p": "2"});

        p2.moves.playCard({"card": "F3307", "idx": 2, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "V242", "idx": 1, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "V212", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
        p2.undo();
        p2.undo();
        p2.undo();
        p2.moves.breakthrough({"card": "V212", "idx": 0, "playerID": "2", "res": 2});
        p2.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "2"});
        p2.moves.payAdditionalCost({"res": 1, "deposit": 0});

        p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0});
        p2.moves.breakthrough({"card": "V242", "idx": 0, "playerID": "2", "res": 2});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card": "P1101", "idx": 2, "playerID": "3", "res": 0});
        p3.moves.updateSlot({
            "slot": {"comment": null, "region": 0, "isLegend": false, "card": "F3110"},
            "p": "3",
            "cardId": "F3110",
            "updateHistoryIndex": 8
        });
        p3.moves.chooseTarget({"target": "1", "idx": 0, "p": "3", "targetName": "P2"});
        p1.moves.chooseHand({"hand": "P2401", "idx": 0, "p": "1"});

        p3.moves.playCard({"card": "F3311", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "V132", "idx": 1, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "F2214", "idx": 3, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B03", "idx": 2, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B05", "idx": 1, "playerID": "3", "res": 0});
        p3.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "3"});

        p3.moves.buyCard({"buyer": "3", "target": "F3305", "resource": 9, "deposit": 0, "helper": []});
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0});
        p3.moves.breakthrough({"card": "B05", "idx": 0, "playerID": "3", "res": 2});
        p3.moves.chooseEffect({"effect": {"e": "industryBreakthrough", "a": 1}, "idx": 0, "p": "3"});

        p3.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "3"});

        p3.undo();
        p3.undo();
        p3.undo();
        p3.moves.drawCard("3");
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0});
        p3.moves.breakthrough({"card": "B05", "idx": 0, "playerID": "3", "res": 2});
        p3.moves.chooseEffect({"effect": {"e": "industryBreakthrough", "a": 1}, "idx": 0, "p": "3"});

        p3.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "3"});
        p3.moves.payAdditionalCost({"res": 1, "deposit": 1});

        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card": "F2406", "idx": 4, "playerID": "1", "res": 0});
        p1.moves.peek({"idx": 0, "card": null, "p": "1", "shownCards": ["B07", "B07", "P2401"]});

        p1.moves.playCard({"card": "F2208", "idx": 2, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "F2303", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.chooseHand({"hand": "B04", "idx": 3, "p": "1"});
        p1.moves.chooseHand({"hand": "B07", "idx": 3, "p": "1"});

        p1.moves.playCard({"card": "F2207", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.chooseEffect({
            "effect": {"e": "step", "a": [{"e": "res", "a": 2}, {"e": "deposit", "a": 1}]},
            "idx": 0,
            "p": "1"
        });

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B05", "idx": 1, "playerID": "1", "res": 0});
        p1.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "1"});

        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
        p1.moves.drawCard("1");
        p1.moves.playCard({"card": "B04", "idx": 1, "playerID": "1", "res": 0});
        p1.moves.buyCard({"buyer": "1", "target": "F3108", "resource": 9, "deposit": 0, "helper": ["F2112"]});
        p1.moves.chooseRegion({"r": 0, "idx": 0, "p": "1"});

        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card": "F2210", "idx": 2, "playerID": "0", "res": 0});
        p0.moves.chooseEffect({"effect": {"e": "draw", "a": 2}, "idx": 0, "p": "0"});

        p0.moves.playCard({"card": "P2103", "idx": 1, "playerID": "0", "res": 0});
        p0.moves.chooseTarget({"target": "1", "idx": 1, "p": "0", "targetName": "P2"});
        p1.moves.chooseHand({"hand": "B04", "idx": 3, "p": "1"});

        p0.moves.playCard({"card": "B05", "idx": 4, "playerID": "0", "res": 0});
        p0.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "0"});

        p0.moves.playCard({"card": "B05", "idx": 4, "playerID": "0", "res": 0});
        p0.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "0"});

        p0.moves.playCard({"card": "B05", "idx": 4, "playerID": "0", "res": 0});
        p0.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "0"});

        p0.moves.playCard({"card": "B03", "idx": 3, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "F2306", "idx": 5, "playerID": "0", "res": 0});
        p0.moves.chooseHand({"hand": "B04", "idx": 3, "p": "0"});

        p0.moves.playCard({"card": "B03", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "F2407", "idx": 2, "playerID": "0", "res": 0});
        p0.moves.playCard({"card": "V213", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.buyCard({"buyer": "0", "target": "F3112", "resource": 6, "deposit": 2, "helper": []});
        p0.undo();
        p0.moves.buyCard({"buyer": "0", "target": "F3112", "resource": 6, "deposit": 2, "helper": []});
        p0.moves.breakthrough({"card": "B04", "idx": 0, "playerID": "0", "res": 0});
        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand": "B07", "idx": 3, "p": "2"});

        p2.moves.playCard({"card": "F2403", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.peek({"idx": 0, "card": null, "p": "2", "shownCards": ["B07", "V232", "V131"]});

        p2.moves.playCard({"card": "B05", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "2"});

        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.playCard({"card": "B03", "idx": 0, "playerID": "2", "res": 0});
        p2.moves.drawCard("2");
        p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0});
        p2.moves.breakthrough({"card": "F1104", "idx": 0, "playerID": "2", "res": 2});
        p2.moves.chooseEffect({"effect": {"e": "buildCinema", "a": 1}, "idx": 1, "p": "2"});

        p2.moves.chooseRegion({"r": 2, "idx": 0, "p": "2"});
        p2.moves.payAdditionalCost({"res": 3, "deposit": 0});

        p2.moves.requestEndTurn("2");
        p2.moves.chooseEffect({"effect": {"e": "aestheticsLevelUp", "a": 1}, "idx": 1, "p": "2"});


        p3.moves.playCard({"card": "F3312", "idx": 5, "playerID": "3", "res": 0});
        p3.moves.chooseTarget({"target": "1", "idx": 1, "p": "3", "targetName": "P2"});
        p3.moves.chooseHand({"hand": "B04", "idx": 2, "p": "3"});

        p3.moves.playCard({"card": "F2308", "idx": 3, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 2, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0});
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.drawCard("3");
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.buyCard({"buyer": "3", "target": "P3102", "resource": 10, "deposit": 1, "helper": []});
        p3.moves.chooseEffect({"effect": {"e": "buy", "a": "F3113", "target": "3"}, "idx": 1, "p": "3"});

        p3.moves.drawCard("3");
        p3.moves.playCard({"card": "V122", "idx": 0, "playerID": "3", "res": 0});
        p3.undo();
        p3.moves.playCard({"card": "V122", "idx": 0, "playerID": "3", "res": 0});
        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "F2208", "idx": 1, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "F2406", "idx": 1, "playerID": "1", "res": 0});
        p1.moves.peek({"idx": 0, "card": null, "p": "1", "shownCards": ["B07", "F3108", "F2112"]});

        p1.moves.playCard({"card": "F2207", "idx": 5, "playerID": "1", "res": 0});
        p1.moves.chooseEffect({"effect": {"e": "breakthroughResDeduct", "a": 2}, "idx": 1, "p": "1"});
        p1.moves.chooseHand({"hand": "B04", "idx": 3, "p": "1"});

        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "B07", "idx": 2, "playerID": "1", "res": 0});
        p1.moves.playCard({"card": "F3108", "idx": 2, "playerID": "1", "res": 0});
        p1.moves.chooseEffect({
            "effect": {
                "e": "step",
                "a": [{"e": "anyRegionShare", "a": 1}, {
                    "e": "competition",
                    "a": {"bonus": 3, "onWin": {"e": "none", "a": 1}}
                }]
            }, "idx": 1, "p": "1"
        });
        p1.undo();
        p1.moves.chooseEffect({"effect": {"e": "res", "a": 6}, "idx": 0, "p": "1"});

        p1.moves.playCard({"card": "B05", "idx": 3, "playerID": "1", "res": 0});
        p1.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "1"});

        p1.moves.playCard({"card": "F2303", "idx": 3, "playerID": "1", "res": 0});
        p1.moves.chooseHand({"hand": "B04", "idx": 1, "p": "1"});
        p1.moves.chooseHand({"hand": "B04", "idx": 2, "p": "1"});

        p1.moves.playCard({"card": "F2112", "idx": 1, "playerID": "1", "res": 0});
        p1.moves.confirmRespond("no");

        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
        p1.moves.buyCard({"buyer": "1", "target": "S3101", "resource": 12, "deposit": 0, "helper": []});
        p1.moves.buyCard({"buyer": "1", "target": "F3115", "resource": 6, "deposit": 2, "helper": []});
        p1.moves.confirmRespond("yes");

        p1.undo();
        p1.undo();
        console.log(JSON.stringify(p0.store.getState().G.regions["3"].buildings));
        p1.moves.playCard({"card": "P2401", "idx": 0, "playerID": "1", "res": 0});
        p1.moves.chooseTarget({"target": "3", "idx": 2, "p": "1", "targetName": "P4"});
        console.log(JSON.stringify(p0.store.getState().G.pub[0].discard));
        // console.log(JSON.stringify(p0.store.getState().G.secretInfo.playerDecks[0]));

        // p1.moves.buyCard({"buyer":"1","target":"F3115","resource":6,"deposit":2,"helper":[]});
        // p1.moves.confirmRespond("yes");
        // p1.moves.chooseRegion({"r":2,"idx":2,"p":"1"});
        //
        // p1.moves.requestEndTurn("1");
        //
        // p0.moves.playCard({"card":"P2103","idx":3,"playerID":"0","res":0});
        // p0.moves.chooseTarget({"target":"1","idx":1,"p":"0","targetName":"P2"});
        // p1.moves.chooseHand({"hand":"B04","idx":2,"p":"1"});
    }

    p0.stop()
    p1.stop()
    p2.stop()
    p3.stop()
})


it('Competition atk card', () => {
    const spec = {
        numPlayers: 4,
        game: gameWithSeed(
            // noinspection SpellCheckingInspection
            "kls8nbcg"
        ),
        multiplayer: Local(),
    };

    const p0 = Client({...spec, playerID: '0'} as any) as any;
    const p1 = Client({...spec, playerID: '1'} as any) as any;
    const p2 = Client({...spec, playerID: '2'} as any) as any;
    const p3 = Client({...spec, playerID: '3'} as any) as any;
    p0.start()
    p1.start()
    p2.start()
    p3.start()

    {

        {
            p0.moves.setupGameMode({"mode": "TEAM2V2", "order": "FIXED"});
            p0.moves.setupGameMode({"mode": "TEAM2V2", "order": "FIRST_RANDOM"});
            p0.moves.showBoardStatus({
                "regions": [{
                    "normalDeckLength": 2,
                    "legendDeckLength": 0,
                    "completedModernScoring": false,
                    "era": 0,
                    "buildings": [{"building": null, "region": 0, "activated": true, "owner": ""}, {
                        "building": null,
                        "region": 0,
                        "activated": true,
                        "owner": ""
                    }, {"building": null, "region": 0, "activated": false, "owner": ""}],
                    "legend": {"comment": null, "region": 0, "isLegend": true, "card": "P1101"},
                    "normal": [{"comment": null, "region": 0, "isLegend": false, "card": "F1104"}, {
                        "comment": null,
                        "region": 0,
                        "isLegend": false,
                        "card": "F1107"
                    }, {"comment": null, "region": 0, "isLegend": false, "card": "F1110"}],
                    "share": 6
                }, {
                    "normalDeckLength": 2,
                    "legendDeckLength": 0,
                    "completedModernScoring": false,
                    "era": 0,
                    "buildings": [{"building": null, "region": 1, "activated": true, "owner": ""}, {
                        "building": null,
                        "region": 1,
                        "activated": true,
                        "owner": ""
                    }],
                    "legend": {"comment": null, "region": 1, "isLegend": true, "card": "P1202"},
                    "normal": [{"comment": null, "region": 1, "isLegend": false, "card": "F1206"}, {
                        "comment": null,
                        "region": 1,
                        "isLegend": false,
                        "card": "F1211"
                    }, {"comment": null, "region": 1, "isLegend": false, "card": "F1209"}],
                    "share": 6
                }, {
                    "normalDeckLength": 1,
                    "legendDeckLength": 0,
                    "completedModernScoring": false,
                    "era": 0,
                    "buildings": [{"building": null, "region": 2, "activated": true, "owner": ""}, {
                        "building": null,
                        "region": 2,
                        "activated": false,
                        "owner": ""
                    }],
                    "legend": {"comment": null, "region": 2, "isLegend": true, "card": "P1302"},
                    "normal": [{"comment": null, "region": 2, "isLegend": false, "card": "F1307"}, {
                        "comment": null,
                        "region": 2,
                        "isLegend": false,
                        "card": "F1305"
                    }],
                    "share": 4
                }, {
                    "normalDeckLength": 0,
                    "legendDeckLength": 0,
                    "completedModernScoring": false,
                    "era": 0,
                    "buildings": [{"building": null, "region": 3, "activated": true, "owner": ""}, {
                        "building": null,
                        "region": 3,
                        "activated": false,
                        "owner": ""
                    }],
                    "legend": {"comment": null, "region": 3, "isLegend": true, "card": null},
                    "normal": [{"comment": null, "region": 3, "isLegend": false, "card": null}, {
                        "comment": null,
                        "region": 3,
                        "isLegend": false,
                        "card": null
                    }],
                    "share": 0
                }], "school": [], "film": [], "matchID": "IMDKcX8_L"
            });


            p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
            p1.moves.breakthrough({"card": "B02", "idx": 0, "playerID": "1", "res": 2});
            p1.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "1"});

            p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.requestEndTurn("1");

            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.buyCard({"buyer": "2", "target": "F1104", "resource": 4, "deposit": 0, "helper": []});
            p2.moves.requestEndTurn("2");

            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "B01", "idx": 0, "playerID": "3", "res": 0});
            p3.undo();
            p3.moves.playCard({"card": "B07", "idx": 2, "playerID": "3", "res": 0});
            p3.moves.breakthrough({"card": "B01", "idx": 0, "playerID": "3", "res": 2});
            p3.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "3"});

            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.requestEndTurn("3");

            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.breakthrough({"card": "B01", "idx": 0, "playerID": "0", "res": 2});
            p0.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "0"});

            p0.moves.requestEndTurn("0");

            p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
            p1.moves.buyCard({"buyer": "1", "target": "F1209", "resource": 2, "deposit": 0, "helper": ["B01"]});
            p1.moves.requestEndTurn("1");

            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0});
            p2.moves.breakthrough({"card": "B02", "idx": 0, "playerID": "2", "res": 2});
            p2.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "2"});

            p2.moves.requestEndTurn("2");

            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "B02", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.breakthrough({"card": "B07", "idx": 0, "playerID": "3", "res": 2});
            p3.undo();
            p3.undo();
            p3.moves.breakthrough({"card": "B02", "idx": 0, "playerID": "3", "res": 2});
            p3.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "3"});

            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.requestEndTurn("3");

            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.breakthrough({"card": "B02", "idx": 0, "playerID": "0", "res": 2});
            p0.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "0"});

            p0.moves.requestEndTurn("0");

            p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.buyCard({"buyer": "1", "target": "F1211", "resource": 3, "deposit": 0, "helper": []});
            p1.moves.requestEndTurn("1");

            p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0});
            p2.moves.breakthrough({"card": "B01", "idx": 0, "playerID": "2", "res": 2});
            p2.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "2"});

            p2.moves.requestEndTurn("2");

            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.buyCard({"buyer": "3", "target": "S1203", "resource": 4, "deposit": 0, "helper": []});
            p3.moves.requestEndTurn("3");

            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.buyCard({"buyer": "0", "target": "B03", "resource": 2, "deposit": 0, "helper": []});
            p0.moves.requestEndTurn("0");

            p1.moves.playCard({"card": "B07", "idx": 2, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B07", "idx": 2, "playerID": "1", "res": 0});
            p1.moves.breakthrough({"card": "F1209", "idx": 1, "playerID": "1", "res": 2});
            p1.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "1"});

            p1.moves.playCard({"card": "B01", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.requestEndTurn("1");

            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "B07", "idx": 2, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0});
            p2.moves.breakthrough({"card": "F1104", "idx": 0, "playerID": "2", "res": 2});
            p2.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "2"});

            p2.moves.requestEndTurn("2");

            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.buyCard({"buyer": "3", "target": "F1206", "resource": 4, "deposit": 0, "helper": []});
            p3.moves.requestEndTurn("3");

            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B03", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.buyCard({"buyer": "0", "target": "F1307", "resource": 3, "deposit": 0, "helper": []});
            p0.moves.requestEndTurn("0");

            p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
            p1.moves.buyCard({"buyer": "1", "target": "F1105", "resource": 3, "deposit": 0, "helper": []});
            p1.moves.playCard({"card": "B01", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.requestEndTurn("1");

            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.buyCard({"buyer": "2", "target": "P1202", "resource": 5, "deposit": 0, "helper": []});
            p2.moves.requestEndTurn("2");

            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.buyCard({"buyer": "3", "target": "F1304", "resource": 3, "deposit": 0, "helper": []});
            p3.moves.requestEndTurn("3");

            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B03", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.buyCard({"buyer": "0", "target": "F1106", "resource": 3, "deposit": 0, "helper": []});
            p0.moves.requestEndTurn("0");

            p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "F1211", "idx": 0, "playerID": "1", "res": 0});
            p1.undo();
            p1.moves.breakthrough({"card": "F1211", "idx": 0, "playerID": "1", "res": 2});
            p1.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "1"});

            p1.moves.requestEndTurn("1");

            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.buyCard({"buyer": "2", "target": "F1107", "resource": 2, "deposit": 0, "helper": []});
            p2.moves.requestEndTurn("2");

            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "F1206", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.buyCard({"buyer": "3", "target": "F1110", "resource": 2, "deposit": 0, "helper": []});
            p3.moves.requestEndTurn("3");

            p0.moves.playCard({"card": "F1307", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "F1106", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B03", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.buyCard({"buyer": "0", "target": "P1101", "resource": 5, "deposit": 2, "helper": []});
            p0.undo();
            p0.moves.buyCard({"buyer": "0", "target": "P1302", "resource": 5, "deposit": 2, "helper": []});
            p0.moves.chooseEffect({"effect": {"e": "aestheticsLevelUp", "a": 1, "target": "0"}, "idx": 0, "p": "0"});

            p0.moves.requestEndTurn("0");

            p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.breakthrough({"card": "B01", "idx": 0, "playerID": "1", "res": 2});
            p1.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "1"});

            p1.moves.requestEndTurn("1");

            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0});
            p2.moves.breakthrough({"card": "F1107", "idx": 1, "playerID": "2", "res": 2});
            p2.undo();
            p2.moves.breakthrough({"card": "P1202", "idx": 0, "playerID": "2", "res": 2});
            p2.moves.playCard({"card": "F1107", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.requestEndTurn("2");

            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "F1304", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.buyCard({"buyer": "3", "target": "P1101", "resource": 5, "deposit": 0, "helper": []});
            p3.moves.requestEndTurn("3");
            p3.moves.chooseEvent({"event": "E02", "idx": 0, "p": "3"});
            p1.moves.chooseHand({"hand": "B07", "idx": 0, "p": "1"});
            p0.moves.chooseHand({"hand": "P1302", "idx": 3, "p": "0"});
            p2.moves.chooseHand({"hand": "B07", "idx": 0, "p": "2"});


            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.buyCard({"buyer": "0", "target": "B02", "resource": 2, "deposit": 0, "helper": []});
            p0.moves.requestEndTurn("0");

            p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "F1105", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.buyCard({"buyer": "1", "target": "F1208", "resource": 3, "deposit": 0, "helper": []});
            p1.moves.requestEndTurn("1");
            p1.moves.chooseEvent({"event": "E03", "idx": 1, "p": "1"});


            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.drawCard("2");
            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.buyCard({"buyer": "2", "target": "F1305", "resource": 5, "deposit": 2, "helper": []});
            p2.moves.requestEndTurn("2");
            p0.moves.chooseEvent({"event": "E04", "idx": 0, "p": "0"});


            p3.moves.playCard({"card": "B07", "idx": 2, "playerID": "3", "res": 0});
            p3.moves.breakthrough({"card": "F1110", "idx": 1, "playerID": "3", "res": 2});
            p3.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "3"});

            p3.moves.playCard({"card": "F1206", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.comment({"target": "F2111", "comment": "B04", "p": "3"});

            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.buyCard({"buyer": "3", "target": "B03", "resource": 2, "deposit": 0, "helper": []});
            p3.moves.requestEndTurn("3");

            p0.moves.playCard({"card": "F1307", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B03", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0});
            p0.moves.breakthrough({"card": "B02", "idx": 0, "playerID": "0", "res": 2});
            p0.moves.chooseEffect({"effect": {"e": "buildStudio", "a": 1}, "idx": 1, "p": "0"});

            p0.moves.chooseRegion({"r": 2, "idx": 2, "p": "0"});
            p0.undo();
            p0.undo();
            p0.undo();
            p0.moves.drawCard("0");
            p0.moves.playCard({"card": "F1106", "idx": 1, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0});
            p0.moves.breakthrough({"card": "B02", "idx": 0, "playerID": "0", "res": 2});
            p0.moves.chooseEffect({"effect": {"e": "buildStudio", "a": 1}, "idx": 1, "p": "0"});

            p0.moves.chooseRegion({"r": 2, "idx": 2, "p": "0"});
            p0.moves.payAdditionalCost({"res": 3, "deposit": 0});

            p0.moves.requestEndTurn("0");

            p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.breakthrough({"card": "B02", "idx": 3, "playerID": "1", "res": 2});
            p1.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "1"});

            p1.moves.playCard({"card": "B07", "idx": 2, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
            p1.moves.breakthrough({"card": "F1105", "idx": 0, "playerID": "1", "res": 2});
            p1.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "1"});
            p1.moves.payAdditionalCost({"res": 0, "deposit": 1});

            p1.moves.requestEndTurn("1");

            p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "V122", "idx": 1, "playerID": "2", "res": 0});
            p2.moves.breakthrough({"card": "B02", "idx": 1, "playerID": "2", "res": 2});
            p2.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "2"});
            p2.moves.payAdditionalCost({"res": 1, "deposit": 0});

            p2.moves.breakthrough({"card": "F1107", "idx": 0, "playerID": "2", "res": 1});
            p2.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "2"});

            p2.moves.requestEndTurn("2");

            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.breakthrough({"card": "B07", "idx": 0, "playerID": "3", "res": 2});
            p3.undo();
            p3.undo();
            p3.moves.playCard({"card": "B05", "idx": 3, "playerID": "3", "res": 0});
            p3.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "3"});

            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.breakthrough({"card": "B04", "idx": 1, "playerID": "3", "res": 2});
            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.breakthrough({"card": "B07", "idx": 0, "playerID": "3", "res": 1});
            p3.moves.requestEndTurn("3");

            p0.moves.playCard({"card": "V131", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B07", "idx": 2, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "V113", "idx": 1, "playerID": "0", "res": 0});
            p0.moves.breakthrough({"card": "B02", "idx": 0, "playerID": "0", "res": 2});
            p0.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "0"});

            p0.moves.drawCard("0");
            p0.moves.playCard({"card": "B04", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.requestEndTurn("0");

            p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B04", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.drawCard("1");
            p1.moves.playCard({"card": "F1208", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.buyCard({"buyer": "1", "target": "S2104", "resource": 4, "deposit": 2, "helper": []});
            p1.moves.requestEndTurn("1");

            p2.moves.playCard({"card": "V112", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "V122", "idx": 0, "playerID": "2", "res": 0});
            p2.undo();
            p2.moves.breakthrough({"card": "V122", "idx": 0, "playerID": "2", "res": 2});
            p2.moves.buyCard({"buyer": "2", "target": "B03", "resource": 2, "deposit": 0, "helper": []});
            p2.moves.requestEndTurn("2");

            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.breakthrough({"card": "V111", "idx": 0, "playerID": "3", "res": 2});
            p3.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "3"});

            p3.moves.playCard({"card": "V123", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.buyCard({"buyer": "3", "target": "B03", "resource": 2, "deposit": 0, "helper": []});
            p3.moves.requestEndTurn("3");

            p0.moves.playCard({"card": "P1302", "idx": 2, "playerID": "0", "res": 0});
            p0.moves.chooseHand({"hand": "B04", "idx": 3, "p": "0"});

            p0.moves.changePlayerSetting({"classicFilmAutoMoveMode": "DRAW_CARD"});
            p0.moves.playCard({"card": "B05", "idx": 1, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.breakthrough({"card": "V113", "idx": 0, "playerID": "0", "res": 2});
            p0.moves.drawCard("0");
            p0.moves.playCard({"card": "B03", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.requestEndTurn("0");

            p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
            p1.moves.breakthrough({"card": "B04", "idx": 1, "playerID": "1", "res": 2});
            p1.moves.playCard({"card": "V121", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "F1208", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.buyCard({"buyer": "1", "target": "F2406", "resource": 4, "deposit": 2, "helper": []});
            p1.moves.requestEndTurn("1");

            p2.moves.playCard({"card": "F1305", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.chooseHand({"hand": "B07", "idx": 1, "p": "2"});

            p2.moves.changePlayerSetting({"classicFilmAutoMoveMode": "DRAW_CARD"});
            p2.moves.playCard({"card": "B05", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.breakthrough({"card": "B07", "idx": 0, "playerID": "2", "res": 2});
            p2.moves.drawCard("2");
            p2.undo();
            p2.undo();
            p2.moves.drawCard("2");
            p2.moves.breakthrough({"card": "V132", "idx": 1, "playerID": "2", "res": 2});
            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.requestEndTurn("2");

            p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0});
            p3.moves.breakthrough({"card": "P1101", "idx": 0, "playerID": "3", "res": 2});
            p3.moves.playCard({"card": "B03", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "F1206", "idx": 0, "playerID": "3", "res": 0});
            p3.undo();
            p3.undo();
            p3.undo();
            p3.undo();
            p3.moves.playCard({"card": "B03", "idx": 2, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "F1206", "idx": 2, "playerID": "3", "res": 0});
            p3.moves.comment({"target": "F2110", "comment": "B04", "p": "3"});

            p3.moves.breakthrough({"card": "P1101", "idx": 0, "playerID": "3", "res": 2});
            p3.moves.breakthrough({"card": "B07", "idx": 0, "playerID": "3", "res": 1});
            p3.moves.requestEndTurn("3");

            p0.moves.playCard({"card": "V131", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "F1106", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.drawCard("0");
            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.buyCard({"buyer": "0", "target": "F2207", "resource": 7, "deposit": 1, "helper": []});
            p0.moves.requestEndTurn("0");

            p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.breakthrough({"card": "B04", "idx": 3, "playerID": "1", "res": 2});
            p1.moves.playCard({"card": "B07", "idx": 2, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
            p1.moves.breakthrough({"card": "B05", "idx": 0, "playerID": "1", "res": 2});
            p1.moves.chooseEffect({"effect": {"e": "industryBreakthrough", "a": 1}, "idx": 0, "p": "1"});

            p1.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "1"});
            p1.moves.payAdditionalCost({"res": 1, "deposit": 0});

            p1.moves.requestEndTurn("1");

            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "V112", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "B03", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.drawCard("2");
            p2.moves.playCard({"card": "B05", "idx": 0, "playerID": "2", "res": 0});
            p2.undo();
            p2.moves.buyCard({"buyer": "2", "target": "F2409", "resource": 5, "deposit": 1, "helper": ["B05"]});
            p2.moves.requestEndTurn("2");

            p3.moves.playCard({"card": "F1304", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "F1206", "idx": 2, "playerID": "3", "res": 0});
            p3.moves.comment({"target": "S2301", "comment": "B04", "p": "3"});

            p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0});
            p3.moves.breakthrough({"card": "B01", "idx": 0, "playerID": "3", "res": 2});
            p3.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "3"});

            p3.moves.drawCard("3");
            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.requestEndTurn("3");

            p0.moves.playCard({"card": "F1307", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.undo();
            p0.moves.drawCard("0");
            p0.moves.playCard({"card": "B07", "idx": 4, "playerID": "0", "res": 0});
            p0.moves.breakthrough({"card": "V131", "idx": 1, "playerID": "0", "res": 2});
            p0.moves.playCard({"card": "B05", "idx": 2, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B07", "idx": 2, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "P1302", "idx": 1, "playerID": "0", "res": 0});
            p0.moves.chooseHand({"hand": "B07", "idx": 0, "p": "0"});

            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.requestEndTurn("0");

            p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.drawCard("1");
            p1.moves.playCard({"card": "V121", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.buyCard({"buyer": "1", "target": "P2103", "resource": 8, "deposit": 0, "helper": []});
            p1.moves.requestEndTurn("1");

            p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0});
            p2.undo();
            p2.undo();
            p2.moves.drawCard("2");
            p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "F1305", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.chooseHand({"hand": "B07", "idx": 0, "p": "2"});

            p2.moves.breakthrough({"card": "V112", "idx": 0, "playerID": "2", "res": 2});
            p2.moves.requestEndTurn("2");

            p3.moves.playCard({"card": "V123", "idx": 2, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "B07", "idx": 2, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.drawCard("3");
            p3.moves.playCard({"card": "B03", "idx": 1, "playerID": "3", "res": 0});
            p3.moves.buyCard({"buyer": "3", "target": "P2402", "resource": 5, "deposit": 1, "helper": ["B05"]});
            p3.moves.requestEndTurn("3");

            p0.moves.playCard({"card": "F1106", "idx": 3, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B03", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "F2207", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.drawCard("0");
            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.buyCard({"buyer": "0", "target": "F2109", "resource": 8, "deposit": 1, "helper": []});
            p0.moves.requestEndTurn("0");

            p1.moves.playCard({"card": "F1208", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "F2406", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "P2103", "idx": 1, "playerID": "1", "res": 0});
            p1.moves.chooseTarget({"target": "0", "idx": 3, "p": "1", "targetName": "P1"});
            p0.moves.chooseHand({"hand": "B07", "idx": 2, "p": "0"});

            p1.moves.playCard({"card": "V121", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.drawCard("1");
            p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0});
            p1.moves.buyCard({"buyer": "1", "target": "S2101", "resource": 7, "deposit": 2, "helper": []});
            p1.moves.requestEndTurn("1");

            p2.moves.playCard({"card": "B03", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "F2409", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.updateSlot({
                "slot": {"comment": "B04", "region": 2, "isLegend": true, "card": "S2301"},
                "p": "2",
                "cardId": "S2301",
                "updateHistoryIndex": 0
            });

            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.drawCard("2");
            p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0});
            p2.moves.breakthrough({"card": "B05", "idx": 0, "playerID": "2", "res": 2});
            p2.moves.chooseEffect({"effect": {"e": "industryBreakthrough", "a": 1}, "idx": 0, "p": "2"});

            p2.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "2"});
            p2.moves.payAdditionalCost({"res": 1, "deposit": 0});

            p2.moves.requestEndTurn("2");

            p3.moves.playCard({"card": "B03", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "V123", "idx": 1, "playerID": "3", "res": 0});
            p3.moves.drawCard("3");
            p3.moves.playCard({"card": "F1304", "idx": 0, "playerID": "3", "res": 0});
            p3.undo();
            p3.moves.playCard({"card": "F1304", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.breakthrough({"card": "B05", "idx": 0, "playerID": "3", "res": 2});
            p3.moves.chooseEffect({"effect": {"e": "industryBreakthrough", "a": 1}, "idx": 0, "p": "3"});

            p3.moves.chooseEffect({"effect": {"e": "buildStudio", "a": 1}, "idx": 1, "p": "3"});

            p3.moves.chooseRegion({"r": 3, "idx": 2, "p": "3"});
            p3.moves.payAdditionalCost({"res": 2, "deposit": 1});

            p3.moves.requestEndTurn("3");

            p0.moves.playCard({"card": "F1307", "idx": 1, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "P1302", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.chooseHand({"hand": "B07", "idx": 2, "p": "0"});

            p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0});
            p0.moves.drawCard("0");
            p0.moves.playCard({"card": "B03", "idx": 1, "playerID": "0", "res": 0});
            p0.moves.breakthrough({"card": "B05", "idx": 0, "playerID": "0", "res": 2});
            p0.moves.chooseEffect({"effect": {"e": "aestheticsBreakthrough", "a": 1}, "idx": 1, "p": "0"});

            p0.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "0"});

            p0.moves.requestEndTurn("0");

            p1.moves.playCard({"card": "P2103", "idx": 6, "playerID": "1", "res": 0});
            p1.moves.chooseTarget({"target": "0", "idx": 3, "p": "1", "targetName": "P1"});
            p0.moves.chooseHand({"hand": "B07", "idx": 2, "p": "0"});

            p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
            p1.moves.breakthrough({"card": "V121", "idx": 2, "playerID": "1", "res": 2});
            p1.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "1"});

            p1.moves.playCard({"card": "B05", "idx": 2, "playerID": "1", "res": 0});
            p1.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "1"});

            p1.moves.playCard({"card": "B07", "idx": 3, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "F1208", "idx": 2, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
            p1.moves.breakthrough({"card": "B07", "idx": 0, "playerID": "1", "res": 2});
            p1.moves.requestEndTurn("1");

            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "F2409", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.updateSlot({
                "slot": {"comment": null, "region": 1, "isLegend": true, "card": "P2202"},
                "p": "2",
                "cardId": "P2202",
                "updateHistoryIndex": 1
            });

            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "B03", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.drawCard("2");
            p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0});
            p2.moves.buyCard({"buyer": "2", "target": "S2301", "resource": 5, "deposit": 5, "helper": ["F1305"]});
            p2.moves.requestEndTurn("2");

            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "B03", "idx": 1, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.drawCard("3");
            p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0});
            p3.moves.buyCard({"buyer": "3", "target": "S2201", "resource": 5, "deposit": 4, "helper": ["F1206"]});
            p3.moves.requestEndTurn("3");

            p0.moves.playCard({"card": "F2207", "idx": 2, "playerID": "0", "res": 0});
            p0.moves.chooseEffect({
                "effect": {"e": "step", "a": [{"e": "res", "a": 2}, {"e": "deposit", "a": 1}]},
                "idx": 0,
                "p": "0"
            });

            p0.moves.drawCard("0");
            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.breakthrough({"card": "F2109", "idx": 1, "playerID": "0", "res": 2});
            p0.moves.chooseHand({"hand": "B07", "idx": 0, "p": "0"});

            p0.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "0"});
            p0.moves.payAdditionalCost({"res": 1, "deposit": 0});

            p0.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "0"});
            p0.moves.payAdditionalCost({"res": 1, "deposit": 0});

            p0.moves.requestEndTurn("0");

            p1.moves.changePlayerSetting({"classicFilmAutoMoveMode": "DRAW_CARD"});
            p1.moves.playCard({"card": "P2103", "idx": 3, "playerID": "1", "res": 0});
            p1.moves.chooseTarget({"target": "0", "idx": 3, "p": "1", "targetName": "P1"});
            p0.moves.chooseHand({"hand": "B04", "idx": 1, "p": "0"});

            p1.moves.playCard({"card": "F2406", "idx": 1, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B05", "idx": 1, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B05", "idx": 3, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B07", "idx": 2, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "F1208", "idx": 2, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
            p1.moves.breakthrough({"card": "B07", "idx": 0, "playerID": "1", "res": 2});
            p1.moves.buyCard({"buyer": "1", "target": "F2112", "resource": 3, "deposit": 3, "helper": []});
            p1.moves.requestEndTurn("1");

            p2.moves.playCard({"card": "B03", "idx": 3, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "B07", "idx": 3, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "F2409", "idx": 1, "playerID": "2", "res": 0});
            p2.moves.updateSlot({
                "slot": {"comment": null, "region": 3, "isLegend": false, "card": "F2403"},
                "p": "2",
                "cardId": "F2403",
                "updateHistoryIndex": 2
            });

            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.buyCard({"buyer": "2", "target": "F2208", "resource": 6, "deposit": 0, "helper": []});
            p2.moves.drawCard("2");
            p2.moves.drawCard("2");
            p2.undo();
            p2.undo();
            p2.undo();
            p2.moves.drawCard("2");
            p2.undo();
            p2.undo();
            p2.moves.drawCard("2");
            p2.moves.playCard({"card": "F1305", "idx": 1, "playerID": "2", "res": 0});
            p2.moves.chooseHand({"hand": "B07", "idx": 0, "p": "2"});

            p2.moves.buyCard({"buyer": "2", "target": "F2208", "resource": 5, "deposit": 1, "helper": []});
            p2.moves.drawCard("2");
            p2.moves.playCard({"card": "F2208", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.requestEndTurn("2");

            p3.moves.playCard({"card": "P2402", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.chooseTarget({"target": "2", "idx": 2, "p": "3", "targetName": "P3"});

            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "B07", "idx": 3, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.breakthrough({"card": "F1304", "idx": 1, "playerID": "3", "res": 2});
            p3.moves.comment({"target": "F2407", "comment": "B04", "p": "3"});

            p3.moves.chooseEffect({"effect": {"e": "refactor", "a": 1}, "idx": 1, "p": "3"});
            p3.moves.chooseHand({"hand": "V123", "idx": 0, "p": "3"});

            p3.moves.buyCard({"buyer": "3", "target": "F2209", "resource": 2, "deposit": 1, "helper": []});
            p3.moves.requestEndTurn("3");

            p0.moves.playCard({"card": "F1106", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "F1307", "idx": 1, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B03", "idx": 1, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "F2207", "idx": 1, "playerID": "0", "res": 0});
            p0.moves.chooseEffect({
                "effect": {"e": "step", "a": [{"e": "res", "a": 2}, {"e": "deposit", "a": 1}]},
                "idx": 0,
                "p": "0"
            });

            p0.moves.buyCard({"buyer": "0", "target": "P2202", "resource": 5, "deposit": 3, "helper": []});
            p0.moves.breakthrough({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.requestEndTurn("0");
            p0.moves.chooseEffect({"effect": {"e": "industryLevelUp", "a": 1}, "idx": 0, "p": "0"});


            p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "F2112", "idx": 2, "playerID": "1", "res": 0});
            p1.moves.confirmRespond("no");

            p1.moves.playCard({"card": "P2103", "idx": 2, "playerID": "1", "res": 0});
            p1.moves.chooseTarget({"target": "0", "idx": 3, "p": "1", "targetName": "P1"});
            p0.moves.chooseHand({"hand": "B07", "idx": 2, "p": "0"});

            p1.moves.playCard({"card": "B05", "idx": 1, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "F1208", "idx": 1, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B05", "idx": 2, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B05", "idx": 1, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "F1208", "idx": 2, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0});
            p1.moves.breakthrough({"card": "B07", "idx": 0, "playerID": "1", "res": 2});
            p1.moves.buyCard({"buyer": "1", "target": "F2106", "resource": 4, "deposit": 3, "helper": []});
            p1.moves.requestEndTurn("1");

            p2.moves.playCard({"card": "F2208", "idx": 1, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "F1305", "idx": 2, "playerID": "2", "res": 0});
            p2.moves.chooseHand({"hand": "B07", "idx": 0, "p": "2"});

            p2.moves.playCard({"card": "F2409", "idx": 2, "playerID": "2", "res": 0});
            p2.moves.updateSlot({
                "slot": {"comment": "B04", "region": 0, "isLegend": false, "card": "F2111"},
                "p": "2",
                "cardId": "F2111",
                "updateHistoryIndex": 3
            });

            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.playCard({"card": "B03", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.buyCard({"buyer": "2", "target": "F2111", "resource": 4, "deposit": 0, "helper": []});
            p2.undo();
            p2.moves.buyCard({"buyer": "2", "target": "F2107", "resource": 5, "deposit": 0, "helper": []});
            p2.moves.drawCard("2");
            p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0});
            p2.moves.buyCard({"buyer": "2", "target": "F2111", "resource": 1, "deposit": 3, "helper": []});
            p2.moves.requestEndTurn("2");

            p3.moves.playCard({"card": "F1206", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.comment({"target": "S2204", "comment": "B04", "p": "3"});

            p3.moves.playCard({"card": "B03", "idx": 1, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "B03", "idx": 1, "playerID": "3", "res": 0});
            p3.moves.playCard({"card": "B05", "idx": 1, "playerID": "3", "res": 0});
            p3.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "3"});

            p3.moves.playCard({"card": "P2402", "idx": 1, "playerID": "3", "res": 0});
            p3.moves.chooseTarget({"target": "2", "idx": 2, "p": "3", "targetName": "P3"});

            p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0});
            p3.moves.breakthrough({"card": "B07", "idx": 0, "playerID": "3", "res": 2});
            p3.moves.buyCard({"buyer": "3", "target": "F2206", "resource": 3, "deposit": 1, "helper": []});
            p3.moves.requestEndTurn("3");
            p3.moves.chooseEvent({"event": "E07", "idx": 1, "p": "3"});
            p3.moves.chooseEffect({"effect": {"e": "industryLevelUp", "a": 1}, "idx": 0, "p": "3"});
            p0.moves.chooseEffect({"effect": {"e": "industryLevelUp", "a": 1}, "idx": 0, "p": "0"});
            p1.moves.chooseEffect({"effect": {"e": "industryLevelUp", "a": 1}, "idx": 0, "p": "1"});
            p2.moves.chooseEffect({"effect": {"e": "industryLevelUp", "a": 1}, "idx": 0, "p": "2"});


            p0.moves.playCard({"card": "P1302", "idx": 1, "playerID": "0", "res": 0});
            p0.moves.chooseHand({"hand": "B04", "idx": 2, "p": "0"});

            p0.moves.playCard({"card": "F1307", "idx": 2, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "F1106", "idx": 2, "playerID": "0", "res": 0});
            p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0});
            p0.moves.breakthrough({"card": "B04", "idx": 0, "playerID": "0", "res": 2});
            p0.moves.breakthrough({"card": "B04", "idx": 0, "playerID": "0", "res": 1});
            p0.moves.requestEndTurn("0");

            p1.moves.playCard({"card": "F2106", "idx": 5, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B05", "idx": 2, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B05", "idx": 1, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "B05", "idx": 4, "playerID": "1", "res": 0});
            p1.moves.playCard({"card": "P2103", "idx": 5, "playerID": "1", "res": 0});
            p1.moves.chooseTarget({"target": "2", "idx": 1, "p": "1", "targetName": "P3"});
            p2.moves.chooseHand({"hand": "B07", "idx": 2, "p": "2"});

            p1.moves.playCard({"card": "F2112", "idx": 2, "playerID": "1", "res": 0});
            p1.moves.confirmRespond("no");

            p1.moves.playCard({"card": "B07", "idx": 2, "playerID": "1", "res": 0});
            p1.moves.buyCard({"buyer": "1", "target": "F2214", "resource": 5, "deposit": 0, "helper": []});
            p1.moves.playCard({"card": "F2406", "idx": 0, "playerID": "1", "res": 0});

            // p1.moves.playCard({"card":"B05","idx":2,"playerID":"1","res":0});
            // p1.moves.playCard({"card":"F2214","idx":4,"playerID":"1","res":0});
            // p1.moves.playCard({"card":"B05","idx":3,"playerID":"1","res":0});
            // p1.moves.playCard({"card":"V242","idx":3,"playerID":"1","res":0});
            // p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});

            // p1.moves.playCard({"card":"F1208","idx":1,"playerID":"1","res":0});
            // p1.moves.breakthrough({"card":"F1208","idx":0,"playerID":"1","res":2});
            // p1.moves.chooseEffect({"effect":{"e":"industryBreakthrough","a":1},"idx":0,"p":"1"});
            //
            // p1.moves.chooseEffect({"effect":{"e":"buildCinema","a":1},"idx":2,"p":"1"});
            //
            // p1.moves.chooseRegion({"r":0,"idx":0,"p":"1"});
        }
        p1.moves.peek({"idx": 0, "card": null, "p": "1", "shownCards": ["B05", "F1208", "B05"]});

        console.log(p1.getState().G.player[1]);
        console.log(p1.getState().G.pub[1]);
    }

    p0.stop()
    p1.stop()
    p2.stop()
    p3.stop()
})
