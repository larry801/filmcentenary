import {Client} from 'boardgame.io/client';
import {Local} from 'boardgame.io/multiplayer'
import {FilmCentenaryGame} from './Game';
import {IG} from "./types/setup";

const hasDuplicateClassicCard = (G: IG, p: number) => {
    const validCards = [...G.pub[p].discard, ...G.secretInfo.playerDecks[p], ...G.player[p].hand];
    console.log(validCards)
}

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
    {
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
                "normal": [{"comment": null, "region": 0, "isLegend": false, "card": "F1103"}, {
                    "comment": null,
                    "region": 0,
                    "isLegend": false,
                    "card": "F1106"
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
                "normal": [{"comment": null, "region": 1, "isLegend": false, "card": "F1207"}, {
                    "comment": null,
                    "region": 1,
                    "isLegend": false,
                    "card": "F1208"
                }, {"comment": null, "region": 1, "isLegend": false, "card": "F1205"}],
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
            }], "school": [], "film": [], "matchID": "4sfWlVrbv", "seed": "kgte5b65"
        })
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.buyCard({"buyer": "0", "target": "F1207", "resource": 4, "deposit": 0, "helper": []})
        p0.moves.requestEndTurn("0");
        p1.moves.playCard({"card": "B07", "idx": 2, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.breakthrough({"card": "B01", "idx": 1, "playerID": "1", "res": 2})
        p1.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "1"})
        p1.moves.playCard({"card": "B02", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.requestEndTurn("1");
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.buyCard({"buyer": "2", "target": "F1205", "resource": 4, "deposit": 0, "helper": []})
        p2.moves.requestEndTurn("2");
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0})
        p3.moves.buyCard({"buyer": "3", "target": "F1306", "resource": 3, "deposit": 0, "helper": ["B02"]})
        p3.moves.requestEndTurn("3");
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})
        p0.moves.breakthrough({"card": "B02", "idx": 1, "playerID": "0", "res": 2})
        p0.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "0"})
        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.buyCard({"buyer": "1", "target": "S1203", "resource": 4, "deposit": 0, "helper": []})
        p1.moves.requestEndTurn("1");


        p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 2, "playerID": "2", "res": 0})
        p2.moves.breakthrough({"card": "B01", "idx": 1, "playerID": "2", "res": 2})
        p2.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "2"})
        p2.moves.playCard({"card": "B02", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.requestEndTurn("2");


        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.breakthrough({"card": "B01", "idx": 0, "playerID": "3", "res": 2})
        p3.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "3"})
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.requestEndTurn("3");


        p0.moves.playCard({"card": "B07", "idx": 2, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 2, "playerID": "0", "res": 0})
        p0.moves.breakthrough({"card": "F1207", "idx": 1, "playerID": "0", "res": 2})
        p0.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "0"})
        p0.moves.playCard({"card": "B01", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.buyCard({"buyer": "1", "target": "F1304", "resource": 3, "deposit": 0, "helper": []})
        p1.moves.requestEndTurn("1");


        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0})
        p2.moves.buyCard({"buyer": "2", "target": "F1211", "resource": 3, "deposit": 0, "helper": []})
        p2.moves.requestEndTurn("2");


        p3.moves.playCard({"card": "B07", "idx": 2, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 2, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.breakthrough({"card": "F1306", "idx": 0, "playerID": "3", "res": 2})
        p3.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "3"})
        p3.moves.requestEndTurn("3");


        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.buyCard({"buyer": "0", "target": "S1303", "resource": 5, "deposit": 0, "helper": []})
        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0})
        p1.moves.breakthrough({"card": "B02", "idx": 0, "playerID": "1", "res": 2})
        p1.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "1"})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.requestEndTurn("1");


        p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 2, "playerID": "2", "res": 0})
        p2.moves.breakthrough({"card": "B02", "idx": 1, "playerID": "2", "res": 2})
        p2.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "2"})
        p2.undo()
        p2.undo()
        p2.moves.playCard({"card": "F1205", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.buyCard({"buyer": "2", "target": "F1103", "resource": 4, "deposit": 0, "helper": ["B02"]})
        p2.moves.requestEndTurn("2");


        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.breakthrough({"card": "B02", "idx": 0, "playerID": "3", "res": 2})
        p3.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "3"})
        p3.undo()
        p3.undo()
        p3.moves.buyCard({"buyer": "3", "target": "F1108", "resource": 3, "deposit": 0, "helper": []})
        p3.moves.requestEndTurn("3");


        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.buyCard({"buyer": "0", "target": "F1109", "resource": 5, "deposit": 0, "helper": []})
        p0.moves.drawCard("0")
        p0.undo()
        p0.undo()
        p0.moves.buyCard({"buyer": "0", "target": "F1106", "resource": 3, "deposit": 0, "helper": []})
        p0.moves.buyCard({"buyer": "0", "target": "B01", "resource": 2, "deposit": 0, "helper": []})
        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "F1304", "idx": 1, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.buyCard({"buyer": "1", "target": "P1101", "resource": 5, "deposit": 0, "helper": []})
        p1.moves.requestEndTurn("1");


        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.breakthrough({"card": "F1211", "idx": 1, "playerID": "2", "res": 2})
        p2.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "2"})
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.requestEndTurn("2");


        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0})
        p3.moves.breakthrough({"card": "B02", "idx": 0, "playerID": "3", "res": 2})
        p3.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "3"})
        p3.moves.requestEndTurn("3");


        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})
        p0.moves.breakthrough({"card": "B01", "idx": 0, "playerID": "0", "res": 2})
        p0.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "0"})
        p0.moves.buyCard({"buyer": "0", "target": "B03", "resource": 2, "deposit": 0, "helper": []})
        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "P1101", "idx": 3, "playerID": "1", "res": 0})
        p1.moves.updateSlot("F1110")
        p1.moves.chooseTarget({"target": "1", "idx": 0, "p": "1", "targetName": "Blue(*)"})
        p1.undo()
        p1.moves.chooseTarget({"target": "0", "idx": 3, "p": "1", "targetName": "Red"})
        p0.moves.chooseHand({"hand": "F1106", "idx": 2, "p": "0"})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.buyCard({"buyer": "1", "target": "F1208", "resource": 3, "deposit": 0, "helper": []})
        p1.moves.requestEndTurn("1");


        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.breakthrough({"card": "B02", "idx": 0, "playerID": "2", "res": 2})
        p2.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "2"})
        p2.moves.requestEndTurn("2");


        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0})
        p3.moves.buyCard({"buyer": "3", "target": "F1109", "resource": 3, "deposit": 0, "helper": ["F1108"]})
        p3.moves.requestEndTurn("3");


        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.buyCard({"buyer": "0", "target": "F1110", "resource": 4, "deposit": 0, "helper": []})
        p0.moves.drawCard("0")
        p0.moves.playCard({"card": "B01", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.requestEndTurn("0");
        p0.moves.chooseEvent({"event": "E03", "idx": 1, "p": "0"})


        p1.moves.playCard({"card": "F1304", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.drawCard("1")
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.buyCard({"buyer": "1", "target": "S1301", "resource": 7, "deposit": 0, "helper": []})
        p1.moves.requestEndTurn("1");
        p1.moves.chooseEvent({"event": "E01", "idx": 0, "p": "1"})
        p0.moves.chooseEffect({"effect": {"e": "industryLevelUp", "a": 1}, "idx": 0, "p": "0"})
        p3.moves.chooseEffect({"effect": {"e": "industryLevelUp", "a": 1}, "idx": 0, "p": "3"})
        p2.moves.chooseEffect({"effect": {"e": "industryLevelUp", "a": 1}, "idx": 0, "p": "2"})
        p1.moves.chooseEffect({"effect": {"e": "industryLevelUp", "a": 1}, "idx": 0, "p": "1"})


        p2.moves.playCard({"card": "F1205", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0})
        p2.moves.drawCard("2")
        p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0})
        p2.moves.buyCard({"buyer": "2", "target": "F2113", "resource": 5, "deposit": 0, "helper": ["F1103"]})
        p2.moves.requestEndTurn("2");


        p3.moves.drawCard("3")
        p3.moves.playCard({"card": "B07", "idx": 4, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "F1109", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.buyCard({"buyer": "3", "target": "P1202", "resource": 5, "deposit": 0, "helper": []})
        p3.moves.requestEndTurn("3");
        p2.moves.chooseEvent({"event": "E04", "idx": 0, "p": "2"})


        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 2, "playerID": "0", "res": 0})
        p0.moves.breakthrough({"card": "B01", "idx": 1, "playerID": "0", "res": 2})
        p0.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "0"})
        p0.moves.playCard({"card": "F1110", "idx": 0, "playerID": "0", "res": 0})
        p0.undo()
        p0.moves.breakthrough({"card": "F1110", "idx": 0, "playerID": "0", "res": 1})
        p0.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "0"})
        p0.moves.requestEndTurn("0");


        p1.moves.chooseHand({"hand": "P1101", "idx": 3, "p": "1"})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "V113", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "F1208", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.buyCard({"buyer": "1", "target": "F2213", "resource": 4, "deposit": 1, "helper": []})
        p1.undo()
        p1.undo()
        p1.moves.playCard({"card": "F1208", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.buyCard({"buyer": "1", "target": "F2213", "resource": 4, "deposit": 1, "helper": []})
        p1.moves.drawCard("1")
        p1.moves.playCard({"card": "B05", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "1"})
        p1.moves.requestEndTurn("1");


        p2.moves.playCard({"card": "B07", "idx": 3, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 2, "playerID": "2", "res": 0})
        p2.moves.breakthrough({"card": "B02", "idx": 2, "playerID": "2", "res": 2})
        p2.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "2"})
        p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0})
        p2.undo()
        p2.undo()
        p2.undo()
        p2.undo()
        p2.undo()
        p2.undo()
        p2.moves.playCard({"card": "B07", "idx": 3, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 2, "playerID": "2", "res": 0})
        p2.moves.breakthrough({"card": "B02", "idx": 2, "playerID": "2", "res": 2})
        p2.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "2"})
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.buyCard({"buyer": "2", "target": "B03", "resource": 2, "deposit": 0, "helper": []})
        p2.undo()
        p2.moves.buyCard({"buyer": "2", "target": "B03", "resource": 2, "deposit": 0, "helper": []})
        p2.moves.requestEndTurn("2");


        p3.moves.drawCard("3")
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "F1109", "idx": 1, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "V112", "idx": 1, "playerID": "3", "res": 0})
        p3.moves.breakthrough({"card": "F1108", "idx": 0, "playerID": "3", "res": 2})
        p3.moves.chooseEffect({"effect": {"e": "industryBreakthrough", "a": 1}, "idx": 0, "p": "3"})
        p3.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "3"})
        p3.moves.payAdditionalCost({"res": 1, "deposit": 0})
        p3.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "3"})
        p3.moves.requestEndTurn("3");


        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B03", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "F1106", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.drawCard("0")
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.buyCard({"buyer": "0", "target": "F2207", "resource": 7, "deposit": 1, "helper": []})
        p0.moves.requestEndTurn("0");


        p1.moves.chooseHand({"hand": "P1101", "idx": 3, "p": "1"})
        p1.moves.playCard({"card": "F2213", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 2, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "V131", "idx": 1, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.buyCard({"buyer": "1", "target": "F2211", "resource": 4, "deposit": 0, "helper": []})
        p1.moves.buyCard({"buyer": "1", "target": "B03", "resource": 2, "deposit": 0, "helper": []})
        p1.moves.requestEndTurn("1");


        p2.moves.playCard({"card": "F2113", "idx": 3, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 2, "playerID": "2", "res": 0})
        p2.moves.breakthrough({"card": "F1103", "idx": 1, "playerID": "2", "res": 2})
        p2.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "2"})
        p2.moves.payAdditionalCost({"res": 1, "deposit": 0})
        p2.moves.breakthrough({"card": "B04", "idx": 0, "playerID": "2", "res": 2})
        p2.moves.requestEndTurn("2");


        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "P1202", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.chooseTarget({"target": "1", "idx": 2, "p": "3", "targetName": "Blue"})
        p1.moves.chooseHand({"hand": "F1304", "idx": 0, "p": "1"})
        p3.moves.buyCard({"buyer": "3", "target": "F2111", "resource": 4, "deposit": 0, "helper": []})
        p3.moves.buyCard({"buyer": "3", "target": "B03", "resource": 2, "deposit": 0, "helper": []})
        p3.moves.requestEndTurn("3");


        p0.moves.playCard({"card": "F1106", "idx": 2, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 2, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B03", "idx": 2, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "F2207", "idx": 1, "playerID": "0", "res": 0})
        p0.moves.chooseEffect({
            "effect": {"e": "step", "a": [{"e": "res", "a": 2}, {"e": "deposit", "a": 1}]},
            "idx": 0,
            "p": "0"
        })
        p0.moves.playCard({"card": "B04", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.buyCard({"buyer": "0", "target": "F2208", "resource": 6, "deposit": 2, "helper": []})
        p0.undo()
        p0.moves.drawCard("0")
        p0.moves.playCard({"card": "V111", "idx": 0, "playerID": "0", "res": 0})
        p0.undo()
        p0.moves.buyCard({"buyer": "0", "target": "F2406", "resource": 6, "deposit": 0, "helper": ["V111"]})
        p0.undo()
        p0.moves.buyCard({"buyer": "0", "target": "F2208", "resource": 6, "deposit": 0, "helper": ["V111"]})
        p0.moves.requestEndTurn("0");


        p1.moves.chooseHand({"hand": "B04", "idx": 1, "p": "1"})
        p1.moves.playCard({"card": "P1101", "idx": 1, "playerID": "1", "res": 0})
        p1.moves.updateSlot("S2101")
        p1.moves.chooseTarget({"target": "3", "idx": 2, "p": "1", "targetName": "玩家3"})
        p1.moves.drawCard("1")
        p1.moves.playCard({"card": "B07", "idx": 2, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.breakthrough({"card": "V131", "idx": 0, "playerID": "1", "res": 2})
        p1.moves.requestEndTurn("1");


        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 2, "playerID": "2", "res": 0})
        p2.moves.breakthrough({"card": "F1205", "idx": 0, "playerID": "2", "res": 2})
        p2.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "2"})
        p2.moves.drawCard("2")
        p2.undo()
        p2.undo()
        p2.undo()
        p2.undo()
        p2.undo()
        p2.moves.drawCard("2")
        p2.moves.playCard({"card": "F2113", "idx": 4, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 2, "playerID": "2", "res": 0})
        p2.moves.buyCard({"buyer": "2", "target": "F2309", "resource": 6, "deposit": 0, "helper": ["F1205"]})
        p2.moves.playCard({"card": "B04", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.requestEndTurn("2");


        p3.moves.drawCard("3")
        p3.moves.playCard({"card": "V132", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B03", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "V122", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.buyCard({"buyer": "3", "target": "F2303", "resource": 7, "deposit": 0, "helper": []})
        p3.moves.requestEndTurn("3");


        p0.moves.playCard({"card": "V123", "idx": 1, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.drawCard("0")
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.buyCard({"buyer": "0", "target": "F2114", "resource": 6, "deposit": 0, "helper": []})
        p0.moves.requestEndTurn("0");


        p1.moves.chooseHand({"hand": "B07", "idx": 3, "p": "1"})
        p1.moves.playCard({"card": "B05", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "1"})
        p1.moves.playCard({"card": "B07", "idx": 3, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "V113", "idx": 1, "playerID": "1", "res": 0})
        p1.moves.drawCard("1")
        p1.moves.playCard({"card": "B03", "idx": 2, "playerID": "1", "res": 0})
        p1.moves.breakthrough({"card": "F2211", "idx": 1, "playerID": "1", "res": 2})
        p1.moves.comment({"target": "F2406", "comment": "B04", "p": "1"})
        p1.moves.chooseEffect({"effect": {"e": "aestheticsBreakthrough", "a": 1}, "idx": 1, "p": "1"})
        p1.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "1"})
        p1.undo()
        p1.undo()
        p1.undo()
        p1.moves.comment({"target": "F2112", "comment": "B04", "p": "1"})
        p1.moves.chooseEffect({"effect": {"e": "aestheticsBreakthrough", "a": 1}, "idx": 1, "p": "1"})
        p1.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "1"})
        p1.moves.chooseEffect({"effect": {"e": "buildCinema", "a": 1}, "idx": 2, "p": "1"})
        p1.moves.chooseRegion({"r": 1, "idx": 1, "p": "1"})
        p1.moves.playCard({"card": "F1208", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.requestEndTurn("1");


        p2.moves.playCard({"card": "B03", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0})
        p2.moves.breakthrough({"card": "B05", "idx": 0, "playerID": "2", "res": 2})
        p2.moves.chooseEffect({"effect": {"e": "industryBreakthrough", "a": 1}, "idx": 0, "p": "2"})
        p2.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "2"})
        p2.moves.payAdditionalCost({"res": 1, "deposit": 0})
        p2.moves.drawCard("2")
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.requestEndTurn("2");


        p3.moves.playCard({"card": "F2111", "idx": 1, "playerID": "3", "res": 0})
        p3.moves.chooseEffect({"effect": {"e": "industryAward", "a": 1}, "idx": 1, "p": "3"})
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 2, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "P1202", "idx": 2, "playerID": "3", "res": 0})
        p3.moves.chooseTarget({"target": "1", "idx": 2, "p": "3", "targetName": "Blue"})
        p1.moves.chooseHand({"hand": "F1304", "idx": 3, "p": "1"})
        p3.moves.playCard({"card": "F1109", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.drawCard("3")
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0})
        p3.moves.buyCard({"buyer": "3", "target": "F2308", "resource": 6, "deposit": 2, "helper": ["B05"]})
        p3.moves.requestEndTurn("3");


        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B04", "idx": 2, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "F2114", "idx": 1, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B05", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "0"})
        p0.undo()
        p0.undo()
        p0.undo()
        p0.moves.playCard({"card": "F2114", "idx": 1, "playerID": "0", "res": 0})
        p0.moves.breakthrough({"card": "B05", "idx": 0, "playerID": "0", "res": 2})
        p0.undo()
        p0.moves.buyCard({"buyer": "0", "target": "F2406", "resource": 4, "deposit": 2, "helper": ["B05"]})
        p0.undo()
        p0.moves.drawCard("0")
        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})
        p0.moves.buyCard({"buyer": "0", "target": "F2406", "resource": 5, "deposit": 1, "helper": ["B05"]})
        p0.moves.requestEndTurn("0");


        p1.moves.chooseHand({"hand": "B07", "idx": 3, "p": "1"})
        p1.moves.playCard({"card": "F2213", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B03", "idx": 2, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.buyCard({"buyer": "1", "target": "F2304", "resource": 6, "deposit": 0, "helper": []})
        p1.undo()
        p1.moves.drawCard("1")
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.buyCard({"buyer": "1", "target": "S2204", "resource": 8, "deposit": 0, "helper": []})
        p1.moves.requestEndTurn("1");


        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0})
        p2.moves.breakthrough({"card": "V121", "idx": 0, "playerID": "2", "res": 2})
        p2.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "2"})
        p2.moves.drawCard("2")
        p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "F1205", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.requestEndTurn("2");


        p3.moves.playCard({"card": "F2303", "idx": 1, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B05", "idx": 1, "playerID": "3", "res": 0})
        p3.undo()
        p3.moves.playCard({"card": "V112", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "V122", "idx": 2, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B05", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "3"})
        p3.moves.playCard({"card": "F2111", "idx": 1, "playerID": "3", "res": 0})
        p3.moves.chooseEffect({"effect": {"e": "industryAward", "a": 1}, "idx": 1, "p": "3"})
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0})
        p3.moves.buyCard({"buyer": "3", "target": "F2106", "resource": 7, "deposit": 0, "helper": ["F1109"]})
        p3.moves.drawCard("3")
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.undo()
        p3.undo()
        p3.undo()
        p3.moves.drawCard("3")
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0})
        p3.moves.buyCard({"buyer": "3", "target": "F2106", "resource": 9, "deposit": 0, "helper": []})
        p3.moves.playCard({"card": "F1109", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.requestEndTurn("3");


        p0.moves.playCard({"card": "F2207", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.chooseEffect({"effect": {"e": "breakthroughResDeduct", "a": 2}, "idx": 1, "p": "0"})
        p0.moves.chooseHand({"hand": "V123", "idx": 2, "p": "0"})
        p0.moves.playCard({"card": "B03", "idx": 1, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "F2208", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.buyCard({"buyer": "0", "target": "F2108", "resource": 5, "deposit": 0, "helper": []})
        p0.moves.drawCard("0")
        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "P1101", "idx": 1, "playerID": "1", "res": 0})
        p1.moves.updateSlot("P2202")
        p1.moves.chooseTarget({"target": "3", "idx": 2, "p": "1", "targetName": "玩家3"})
        p3.moves.chooseHand({"hand": "P1202", "idx": 3, "p": "3"})
        p1.moves.playCard({"card": "B05", "idx": 1, "playerID": "1", "res": 0})
        p1.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "1"})
        p1.moves.playCard({"card": "F1208", "idx": 3, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "V113", "idx": 2, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.drawCard("1")
        p1.moves.buyCard({"buyer": "1", "target": "F2209", "resource": 5, "deposit": 0, "helper": []})
        p1.moves.playCard({"card": "B04", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.requestEndTurn("1");


        p2.moves.drawCard("2")
        p2.moves.playCard({"card": "B07", "idx": 5, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "F2113", "idx": 4, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 3, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B03", "idx": 2, "playerID": "2", "res": 0})
        p2.moves.buyCard({"buyer": "2", "target": "S2201", "resource": 7, "deposit": 3, "helper": ["F2309"]})
        p2.moves.playCard({"card": "B04", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.requestEndTurn("2");


        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B03", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "F2308", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.drawCard("3")
        p3.moves.playCard({"card": "V132", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.buyCard({"buyer": "3", "target": "P2102", "resource": 8, "deposit": 0, "helper": []})
        p3.moves.requestEndTurn("3");


        p0.moves.playCard({"card": "F1106", "idx": 1, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})
        p0.moves.breakthrough({"card": "V111", "idx": 0, "playerID": "0", "res": 2})
        p0.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "0"})
        p0.moves.payAdditionalCost({"res": 1, "deposit": 0})
        p0.moves.drawCard("0")
        p0.undo()
        p0.undo()
        p0.moves.payAdditionalCost({"res": 1, "deposit": 0})
        p0.moves.buyCard({"buyer": "0", "target": "B01", "resource": 2, "deposit": 0, "helper": []})
        p0.undo()
        p0.undo()
        p0.undo()
        p0.undo()
        p0.moves.drawCard("0")
        p0.moves.playCard({"card": "B03", "idx": 1, "playerID": "0", "res": 0})
        p0.moves.breakthrough({"card": "V111", "idx": 0, "playerID": "0", "res": 2})
        p0.moves.chooseEffect({"effect": {"e": "buildStudio", "a": 1}, "idx": 1, "p": "0"})
        p0.moves.chooseRegion({"r": 2, "idx": 2, "p": "0"})
        p0.moves.payAdditionalCost({"res": 3, "deposit": 0})
        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "B05", "idx": 4, "playerID": "1", "res": 0})
        p1.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "1"})
        p1.moves.playCard({"card": "V113", "idx": 4, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0})
        p1.moves.breakthrough({"card": "F1304", "idx": 0, "playerID": "1", "res": 2})
        p1.moves.comment({"target": "S2101", "comment": "B04", "p": "1"})
        p1.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "1"})
        p1.moves.payAdditionalCost({"res": 1, "deposit": 0})
        p1.moves.buyCard({"buyer": "1", "target": "F2210", "resource": 3, "deposit": 1, "helper": []})
        p1.moves.requestEndTurn("1");


        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 2, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "F2113", "idx": 2, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "F1205", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.buyCard({"buyer": "2", "target": "F2403", "resource": 4, "deposit": 0, "helper": ["F2309"]})
        p2.moves.buyCard({"buyer": "2", "target": "F2408", "resource": 3, "deposit": 0, "helper": []})
        p2.moves.requestEndTurn("2");


        p3.moves.playCard({"card": "F2303", "idx": 2, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "P2102", "idx": 4, "playerID": "3", "res": 0})
        p3.moves.chooseTarget({"target": "1", "idx": 2, "p": "3", "targetName": "Blue"})
        p1.moves.chooseHand({"hand": "F1208", "idx": 4, "p": "1"})
        p3.moves.confirmRespond("no")
        p3.moves.playCard({"card": "F2308", "idx": 4, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "V132", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.buyCard({"buyer": "3", "target": "S2101", "resource": 7, "deposit": 0, "helper": []})
        p3.moves.playCard({"card": "P1202", "idx": 1, "playerID": "3", "res": 0})
        p3.moves.chooseTarget({"target": "2", "idx": 3, "p": "3", "targetName": "Green"})
        p3.moves.breakthrough({"card": "B05", "idx": 0, "playerID": "3", "res": 2})
        p3.moves.chooseEffect({"effect": {"e": "aestheticsBreakthrough", "a": 1}, "idx": 1, "p": "3"})
        p3.undo()
        p3.undo()
        p3.moves.playCard({"card": "B05", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.chooseEffect({"effect": {"e": "draw", "a": 1}, "idx": 0, "p": "3"})
        p3.moves.playCard({"card": "B03", "idx": 0, "playerID": "3", "res": 0})
        p3.undo()
        p3.undo()
        p3.undo()
        p3.undo()
        p3.moves.chooseTarget({"target": "2", "idx": 3, "p": "3", "targetName": "Green"})
        p3.moves.breakthrough({"card": "B05", "idx": 0, "playerID": "3", "res": 2})
        p3.moves.chooseEffect({"effect": {"e": "industryBreakthrough", "a": 1}, "idx": 0, "p": "3"})
        p3.undo()
        p3.moves.chooseEffect({"effect": {"e": "aestheticsBreakthrough", "a": 1}, "idx": 1, "p": "3"})
        p3.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "3"})
        p3.moves.requestEndTurn("3");


        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "F2114", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.buyCard({"buyer": "0", "target": "P2302", "resource": 6, "deposit": 2, "helper": []})
        p0.undo()
        p0.moves.drawCard("0")
        p0.moves.playCard({"card": "F2207", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.buyCard({"buyer": "0", "target": "P2302", "resource": 8, "deposit": 0, "helper": []})
        p0.moves.requestEndTurn("0");


        p1.moves.drawCard("1")
        p1.moves.playCard({"card": "B03", "idx": 4, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B04", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.buyCard({"buyer": "1", "target": "P2105", "resource": 5, "deposit": 2, "helper": []})
        p1.moves.requestEndTurn("1");


        p2.moves.playCard({"card": "B07", "idx": 5, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B03", "idx": 1, "playerID": "2", "res": 0})
        p2.moves.buyCard({"buyer": "2", "target": "F2404", "resource": 5, "deposit": 0, "helper": []})
        p2.undo()
        p2.moves.buyCard({"buyer": "2", "target": "F2304", "resource": 4, "deposit": 0, "helper": []})
        p2.moves.breakthrough({"card": "B04", "idx": 0, "playerID": "2", "res": 2})
        p2.moves.requestEndTurn("2");
        console.log(p0.store.getState().G.pub[2].deposit)
        p0.moves.chooseEvent({"event": "E05", "idx": 0, "p": "0"})

    }
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

    {
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
                "normal": [{"comment": null, "region": 0, "isLegend": false, "card": "F1105"}, {
                    "comment": null,
                    "region": 0,
                    "isLegend": false,
                    "card": "F1107"
                }, {"comment": null, "region": 0, "isLegend": false, "card": "F1103"}],
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
                "legend": {"comment": null, "region": 1, "isLegend": true, "card": "P1201"},
                "normal": [{"comment": null, "region": 1, "isLegend": false, "card": "F1210"}, {
                    "comment": null,
                    "region": 1,
                    "isLegend": false,
                    "card": "F1207"
                }, {"comment": null, "region": 1, "isLegend": false, "card": "S1204"}],
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
                "normal": [{"comment": null, "region": 2, "isLegend": false, "card": "S1303"}, {
                    "comment": null,
                    "region": 2,
                    "isLegend": false,
                    "card": "F1304"
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
            }], "school": [], "film": [], "matchID": "X_BToxoyS", "seed": "kguuhuk3"
        })
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})
        p0.moves.breakthrough({"card": "B01", "idx": 0, "playerID": "0", "res": 2})
        p0.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "0"})
        p0.undo()
        p0.undo()
        p0.moves.buyCard({"buyer": "0", "target": "B02", "resource": 2, "deposit": 0, "helper": []})
        p0.moves.playCard({"card": "B01", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.requestEndTurn("0");

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.breakthrough({"card": "B01", "idx": 0, "playerID": "1", "res": 2})
        p1.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "1"})
        p1.moves.requestEndTurn("1");

        p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.breakthrough({"card": "B02", "idx": 1, "playerID": "2", "res": 2})
        p2.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "2"})
        p2.moves.playCard({"card": "B01", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0})
        p3.moves.breakthrough({"card": "B02", "idx": 0, "playerID": "3", "res": 2})
        p3.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "3"})
        p3.moves.playCard({"card": "B01", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.breakthrough({"card": "B02", "idx": 0, "playerID": "0", "res": 2})
        p0.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "0"})
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.requestEndTurn("0");

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.breakthrough({"card": "B07", "idx": 1, "playerID": "1", "res": 2})
        p1.undo()
        p1.moves.breakthrough({"card": "B02", "idx": 0, "playerID": "1", "res": 2})
        p1.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "1"})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.requestEndTurn("1");

        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.buyCard({"buyer": "2", "target": "F1207", "resource": 4, "deposit": 0, "helper": []})
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.buyCard({"buyer": "3", "target": "F1210", "resource": 3, "deposit": 0, "helper": []})
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B01", "idx": 0, "playerID": "0", "res": 0})
        p0.undo()
        p0.moves.buyCard({"buyer": "0", "target": "F1209", "resource": 2, "deposit": 0, "helper": ["B01"]})
        p0.moves.requestEndTurn("0");

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.buyCard({"buyer": "1", "target": "F1103", "resource": 4, "deposit": 0, "helper": []})
        p1.moves.requestEndTurn("1");

        p2.moves.playCard({"card": "B07", "idx": 3, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 2, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0})
        p2.moves.buyCard({"buyer": "2", "target": "F1108", "resource": 3, "deposit": 0, "helper": ["B01"]})
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0})
        p3.moves.buyCard({"buyer": "3", "target": "F1205", "resource": 2, "deposit": 0, "helper": []})
        p3.moves.playCard({"card": "F1210", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card": "B02", "idx": 1, "playerID": "0", "res": 0})
        p0.undo()
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})
        p0.moves.breakthrough({"card": "B02", "idx": 0, "playerID": "0", "res": 2})
        p0.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "0"})
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.undo()
        p0.moves.requestEndTurn("0");

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.buyCard({"buyer": "1", "target": "F1107", "resource": 2, "deposit": 0, "helper": []})
        p1.moves.requestEndTurn("1");

        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.breakthrough({"card": "F1207", "idx": 0, "playerID": "2", "res": 2})
        p2.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "2"})
        p2.moves.playCard({"card": "B07", "idx": 0, "playerID": "2", "res": 0})
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.breakthrough({"card": "B01", "idx": 0, "playerID": "3", "res": 2})
        p3.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "3"})
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.buyCard({"buyer": "0", "target": "S1303", "resource": 5, "deposit": 0, "helper": []})
        p0.moves.requestEndTurn("0");

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.breakthrough({"card": "F1103", "idx": 0, "playerID": "1", "res": 2})
        p1.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "1"})
        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})
        p1.moves.requestEndTurn("1");

        p2.moves.playCard({"card": "B07", "idx": 2, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0})
        p2.moves.breakthrough({"card": "B01", "idx": 0, "playerID": "2", "res": 2})
        p2.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "2"})
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card": "F1210", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.undo()
        p3.undo()
        p3.undo()
        p3.undo()
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0})
        p3.moves.buyCard({"buyer": "3", "target": "B03", "resource": 2, "deposit": 0, "helper": []})
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card": "F1209", "idx": 2, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 3, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})
        p0.moves.drawCard("0")
        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B01", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.buyCard({"buyer": "0", "target": "P1201", "resource": 5, "deposit": 0, "helper": []})
        p0.moves.requestEndTurn("0");

        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0})
        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0})
        p1.moves.breakthrough({"card": "F1107", "idx": 0, "playerID": "1", "res": 2})
        p1.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "1"})
        p1.moves.requestEndTurn("1");

        p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0})
        p2.moves.playCard({"card": "B07", "idx": 1, "playerID": "2", "res": 0})
        p2.moves.buyCard({"buyer": "2", "target": "S1204", "resource": 4, "deposit": 0, "helper": ["F1108"]})
        p2.moves.requestEndTurn("2");
        p0.moves.chooseEvent({"event": "E02", "idx": 0, "p": "0"})
        p1.moves.chooseHand({"hand": "B07", "idx": 0, "p": "1"})
        p2.moves.chooseHand({"hand": "B07", "idx": 0, "p": "2"})
        p1.moves.chooseHand({"hand": "B07", "idx": 0, "p": "1"})
        p0.moves.chooseHand({"hand": "B07", "idx": 0, "p": "0"})

        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0})
        p3.moves.playCard({"card": "B07", "idx": 1, "playerID": "3", "res": 0})
        p3.moves.breakthrough({"card": "F1210", "idx": 0, "playerID": "3", "res": 2})
        p3.moves.playCard({"card": "B07", "idx": 0, "playerID": "3", "res": 0})
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.drawCard("0")
        p0.moves.buyCard({"buyer": "0", "target": "F1105", "resource": 3, "deposit": 0, "helper": []})
        p0.moves.playCard({"card": "P1201", "idx": 0, "playerID": "0", "res": 0})

    }
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
        game: gameWithSeed("kgvkb0f2"),
        multiplayer: Local(),
    };

    const p0 = Client({...spec, playerID: '0'} as any) as any;
    const p1 = Client({...spec, playerID: '1'} as any) as any;

    p0.start();
    p1.start();

    {
        p0.moves.showBoardStatus({
            "regions": [],
            "school": [{"comment": null, "region": 4, "isLegend": false, "card": "S1203"}, {
                "comment": null,
                "region": 4,
                "isLegend": false,
                "card": "S1301"
            }],
            "film": [{"comment": null, "region": 4, "isLegend": false, "card": "F1205"}, {
                "comment": null,
                "region": 4,
                "isLegend": false,
                "card": "F1208"
            }, {"comment": null, "region": 4, "isLegend": false, "card": "F1211"}, {
                "comment": null,
                "region": 4,
                "isLegend": false,
                "card": "F1304"
            }],
            "matchID": "nz5PwbplD",
            "seed": "kgvkb0f2"
        })
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})
        p0.moves.breakthrough({"card": "B01", "idx": 0, "playerID": "0", "res": 2})

        p0.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "0"})

        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.breakthrough({"card": "B01", "idx": 0, "playerID": "1", "res": 2})

        p1.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "1"})

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.undo()

        p1.moves.requestEndTurn("1");


        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.buyCard({"buyer": "0", "target": "F1205", "resource": 2, "deposit": 0, "helper": ["B02"]})

        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.buyCard({"buyer": "1", "target": "S1203", "resource": 4, "deposit": 0, "helper": []})

        p1.moves.requestEndTurn("1");


        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.breakthrough({"card": "B02", "idx": 0, "playerID": "0", "res": 2})

        p0.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "0"})

        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0})

        p1.moves.breakthrough({"card": "B02", "idx": 0, "playerID": "1", "res": 2})

        p1.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "1"})

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.requestEndTurn("1");


        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.buyCard({"buyer": "0", "target": "F1304", "resource": 3, "deposit": 0, "helper": ["F1205"]})

        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.buyCard({"buyer": "1", "target": "F1306", "resource": 3, "deposit": 0, "helper": []})

        p1.moves.requestEndTurn("1");


        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.buyCard({"buyer": "0", "target": "F1103", "resource": 4, "deposit": 0, "helper": []})

        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.breakthrough({"card": "F1306", "idx": 0, "playerID": "1", "res": 2})

        p1.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "1"})

        p1.moves.requestEndTurn("1");


        p0.moves.playCard({"card": "F1205", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "F1304", "idx": 0, "playerID": "0", "res": 0})

        p0.undo()

        p0.undo()

        p0.undo()

        p0.undo()

        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.breakthrough({"card": "F1205", "idx": 0, "playerID": "0", "res": 2})

        p0.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "0"})

        p0.moves.playCard({"card": "F1304", "idx": 0, "playerID": "0", "res": 0})

        p0.undo()

        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.buyCard({"buyer": "1", "target": "F1305", "resource": 5, "deposit": 0, "helper": []})

        p1.moves.requestEndTurn("1");


        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.breakthrough({"card": "F1304", "idx": 0, "playerID": "0", "res": 2})

        p0.moves.comment({"target": "S1301", "comment": "B02", "p": "0"})

        p0.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "0"})

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "F1305", "idx": 1, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.buyCard({"buyer": "1", "target": "S1204", "resource": 5, "deposit": 0, "helper": []})

        p1.moves.requestEndTurn("1");


        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "F1103", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.buyCard({"buyer": "0", "target": "S1301", "resource": 4, "deposit": 0, "helper": []})

        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.buyCard({"buyer": "1", "target": "F1208", "resource": 3, "deposit": 0, "helper": []})

        p1.moves.buyCard({"buyer": "1", "target": "B03", "resource": 2, "deposit": 0, "helper": []})

        p1.moves.requestEndTurn("1");


        p0.moves.chooseHand({"hand": "B07", "idx": 4, "p": "0"})

        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.breakthrough({"card": "B02", "idx": 0, "playerID": "0", "res": 2})

        p0.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "0"})

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.drawCard("0")

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "F1305", "idx": 2, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B03", "idx": 3, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 3, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0})

        p1.moves.breakthrough({"card": "B07", "idx": 0, "playerID": "1", "res": 2})

        p1.moves.buyCard({"buyer": "1", "target": "F1307", "resource": 3, "deposit": 0, "helper": []})

        p1.moves.playCard({"card": "F1208", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.requestEndTurn("1");


        p0.moves.chooseHand({"hand": "B07", "idx": 2, "p": "0"})

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "F1103", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.buyCard({"buyer": "0", "target": "F1104", "resource": 4, "deposit": 0, "helper": []})

        p0.moves.buyCard({"buyer": "0", "target": "B03", "resource": 2, "deposit": 0, "helper": []})

        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "F1307", "idx": 3, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 3, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.undo()

        p1.moves.breakthrough({"card": "B07", "idx": 0, "playerID": "1", "res": 2})

        p1.moves.buyCard({"buyer": "1", "target": "F1207", "resource": 3, "deposit": 1, "helper": []})

        p1.undo()

        p1.undo()

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.buyCard({"buyer": "1", "target": "F1211", "resource": 3, "deposit": 0, "helper": []})

        p1.undo()

        p1.moves.buyCard({"buyer": "1", "target": "F1207", "resource": 4, "deposit": 0, "helper": []})

        p1.moves.buyCard({"buyer": "1", "target": "F1211", "resource": 1, "deposit": 2, "helper": []})

        p1.moves.requestEndTurn("1");


        p0.moves.chooseHand({"hand": "B07", "idx": 1, "p": "0"})

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "F1103", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B03", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.buyCard({"buyer": "0", "target": "F1106", "resource": 3, "deposit": 0, "helper": []})

        p0.moves.buyCard({"buyer": "0", "target": "F1210", "resource": 3, "deposit": 0, "helper": []})

        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "F1305", "idx": 2, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "F1307", "idx": 4, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "F1208", "idx": 2, "playerID": "1", "res": 0})

        p1.undo()

        p1.moves.playCard({"card": "B03", "idx": 1, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "F1208", "idx": 1, "playerID": "1", "res": 0})

        p1.moves.breakthrough({"card": "B07", "idx": 2, "playerID": "1", "res": 2})

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.breakthrough({"card": "B07", "idx": 0, "playerID": "1", "res": 2})

        p1.moves.requestEndTurn("1");


        p0.moves.chooseHand({"hand": "B07", "idx": 3, "p": "0"})

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B03", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "F1104", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.drawCard("0")

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.buyCard({"buyer": "0", "target": "S2204", "resource": 5, "deposit": 3, "helper": []})

        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 2, "playerID": "1", "res": 0})

        p1.moves.breakthrough({"card": "F1207", "idx": 0, "playerID": "1", "res": 2})

        p1.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "1"})

        p1.moves.breakthrough({"card": "F1211", "idx": 0, "playerID": "1", "res": 2})

        p1.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "1"})

        p1.moves.requestEndTurn("1");


        p0.moves.playCard({"card": "F1106", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.breakthrough({"card": "F1210", "idx": 2, "playerID": "0", "res": 2})

        p0.moves.breakthrough({"card": "B04", "idx": 0, "playerID": "0", "res": 2})

        p0.moves.playCard({"card": "B04", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "B03", "idx": 1, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.drawCard("1")

        p1.moves.playCard({"card": "B07", "idx": 2, "playerID": "1", "res": 0})

        p1.moves.buyCard({"buyer": "1", "target": "F2408", "resource": 4, "deposit": 1, "helper": ["F1208"]})

        p1.moves.requestEndTurn("1");


        p0.moves.playCard({"card": "B07", "idx": 2, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 2, "playerID": "0", "res": 0})

        p0.moves.breakthrough({"card": "F1103", "idx": 0, "playerID": "0", "res": 2})

        p0.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "0"})

        p0.moves.playCard({"card": "F1104", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.buyCard({"buyer": "0", "target": "B01", "resource": 1, "deposit": 1, "helper": []})

        p0.moves.playCard({"card": "B04", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "F1307", "idx": 2, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "F1305", "idx": 2, "playerID": "1", "res": 0})

        p1.moves.chooseHand({"hand": "B04", "idx": 0, "p": "1"})

        p1.moves.drawCard("1")

        p1.moves.playCard({"card": "F2408", "idx": 2, "playerID": "1", "res": 0})

        p1.undo()

        p1.moves.playCard({"card": "F2408", "idx": 2, "playerID": "1", "res": 0})

        p1.moves.updateSlot("S2104")

        p1.moves.playCard({"card": "B03", "idx": 1, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.buyCard({"buyer": "1", "target": "B02", "resource": 2, "deposit": 0, "helper": []})

        p1.moves.requestEndTurn("1");


        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "F1106", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B03", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.buyCard({"buyer": "0", "target": "F2405", "resource": 6, "deposit": 0, "helper": []})

        p0.moves.drawCard("0")

        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 1, "playerID": "1", "res": 0})

        p1.moves.breakthrough({"card": "F1208", "idx": 0, "playerID": "1", "res": 2})

        p1.moves.chooseEffect({"effect": {"e": "industryBreakthrough", "a": 1}, "idx": 0, "p": "1"})

        p1.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "1"})

        p1.moves.payAdditionalCost({"res": 1, "deposit": 0})

        p1.moves.buyCard({"buyer": "1", "target": "B01", "resource": 2, "deposit": 0, "helper": []})

        p1.moves.requestEndTurn("1");


        p0.moves.playCard({"card": "B07", "idx": 2, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 3, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "F2405", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.chooseEffect({"effect": {"e": "breakthroughResDeduct", "a": 2}, "idx": 1, "p": "0"})

        p0.moves.chooseHand({"hand": "B04", "idx": 0, "p": "0"})

        p0.moves.breakthrough({"card": "F1104", "idx": 0, "playerID": "0", "res": 2})

        p0.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "0"})

        p0.moves.payAdditionalCost({"res": 1, "deposit": 0})

        p0.moves.drawCard("0")

        p0.moves.playCard({"card": "B01", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "F1307", "idx": 1, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "F2408", "idx": 1, "playerID": "1", "res": 0})

        p1.moves.updateSlot("F2210")

        p1.moves.playCard({"card": "B03", "idx": 1, "playerID": "1", "res": 0})

        p1.moves.drawCard("1")

        p1.moves.playCard({"card": "F1305", "idx": 1, "playerID": "1", "res": 0})

        p1.moves.chooseHand({"hand": "B07", "idx": 1, "p": "1"})

        p1.moves.breakthrough({"card": "B02", "idx": 0, "playerID": "1", "res": 2})

        p1.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "1"})

        p1.moves.payAdditionalCost({"res": 1, "deposit": 0})

        p1.moves.requestEndTurn("1");


        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 2, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 2, "playerID": "0", "res": 0})

        p0.moves.breakthrough({"card": "B01", "idx": 0, "playerID": "0", "res": 2})

        p0.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "0"})

        p0.moves.payAdditionalCost({"res": 1, "deposit": 0})

        p0.moves.playCard({"card": "F2405", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.updateSlot("S2101")

        p0.moves.buyCard({"buyer": "0", "target": "B02", "resource": 2, "deposit": 0, "helper": []})

        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "F2408", "idx": 3, "playerID": "1", "res": 0})

        p1.moves.updateSlot("F2206")

        p1.moves.playCard({"card": "B03", "idx": 3, "playerID": "1", "res": 0})

        p1.moves.breakthrough({"card": "B01", "idx": 1, "playerID": "1", "res": 2})

        p1.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "1"})

        p1.moves.payAdditionalCost({"res": 1, "deposit": 0})

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.buyCard({"buyer": "1", "target": "F2112", "resource": 4, "deposit": 2, "helper": []})

        p1.moves.requestEndTurn("1");


        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B03", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 2, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "F1106", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.buyCard({"buyer": "0", "target": "F2309", "resource": 6, "deposit": 0, "helper": []})

        p0.moves.breakthrough({"card": "B02", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "0"})

        p0.moves.payAdditionalCost({"res": 0, "deposit": 1})

        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "F1307", "idx": 1, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "F1305", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.chooseHand({"hand": "B07", "idx": 1, "p": "1"})

        p1.moves.playCard({"card": "B03", "idx": 1, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "F2408", "idx": 0, "playerID": "1", "res": 0})

        p1.undo()

        p1.moves.playCard({"card": "F2408", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.updateSlot("F2306")

        p1.moves.playCard({"card": "B07", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.buyCard({"buyer": "1", "target": "F2214", "resource": 5, "deposit": 0, "helper": []})

        p1.moves.requestEndTurn("1");


        p0.moves.playCard({"card": "B07", "idx": 2, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 2, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 2, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "F2405", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.chooseEffect({
            "effect": {"e": "step", "a": [{"e": "res", "a": 1}, {"e": "update", "a": 1}]},
            "idx": 0,
            "p": "0"
        })

        p0.moves.updateSlot("F2208")

        p0.moves.buyCard({"buyer": "0", "target": "F2209", "resource": 5, "deposit": 0, "helper": []})

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B03", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.buyCard({"buyer": "0", "target": "B02", "resource": 2, "deposit": 0, "helper": []})

        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "F1307", "idx": 2, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "F1305", "idx": 2, "playerID": "1", "res": 0})

        p1.moves.chooseHand({"hand": "B07", "idx": 2, "p": "1"})

        p1.moves.playCard({"card": "F2214", "idx": 2, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "F2112", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.confirmRespond("no")

        p1.moves.playCard({"card": "F2408", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.updateSlot("F2409")

        p1.moves.buyCard({"buyer": "1", "target": "F2106", "resource": 7, "deposit": 0, "helper": []})

        p1.moves.buyCard({"buyer": "1", "target": "F2213", "resource": 2, "deposit": 3, "helper": []})

        p1.moves.requestEndTurn("1");


        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "F1106", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})

        p0.undo()

        p0.moves.playCard({"card": "F2405", "idx": 2, "playerID": "0", "res": 0})

        p0.moves.chooseEffect({"effect": {"e": "breakthroughResDeduct", "a": 2}, "idx": 1, "p": "0"})

        p0.moves.chooseHand({"hand": "B07", "idx": 1, "p": "0"})

        p0.moves.playCard({"card": "F2309", "idx": 0, "playerID": "0", "res": 0})

        p0.undo()

        p0.moves.playCard({"card": "F2309", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.buyCard({"buyer": "0", "target": "F2211", "resource": 4, "deposit": 0, "helper": []})

        p0.moves.buyCard({"buyer": "0", "target": "B01", "resource": 2, "deposit": 0, "helper": []})

        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "F2213", "idx": 2, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "F1307", "idx": 1, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "F1305", "idx": 3, "playerID": "1", "res": 0})

        p1.undo()

        p1.moves.playCard({"card": "F2106", "idx": 2, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "F2112", "idx": 1, "playerID": "1", "res": 0})

        p1.moves.confirmRespond("no")

        p1.moves.buyCard({"buyer": "1", "target": "S2201", "resource": 10, "deposit": 1, "helper": ["F1305"]})

        p1.moves.playCard({"card": "F2408", "idx": 1, "playerID": "1", "res": 0})

        p1.moves.updateSlot("F2207")

        p1.moves.playCard({"card": "B03", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.buyCard({"buyer": "1", "target": "F2308", "resource": 3, "deposit": 1, "helper": []})

        p1.moves.requestEndTurn("1");


        p0.moves.playCard({"card": "B07", "idx": 2, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "F1106", "idx": 3, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 3, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "F2209", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.buyCard({"buyer": "0", "target": "F2113", "resource": 5, "deposit": 0, "helper": []})

        p0.undo()

        p0.moves.buyCard({"buyer": "0", "target": "F2108", "resource": 5, "deposit": 0, "helper": []})

        p0.moves.playCard({"card": "F2309", "idx": 2, "playerID": "0", "res": 0})

        p0.moves.breakthrough({"card": "B03", "idx": 1, "playerID": "0", "res": 1})

        p0.undo()

        p0.moves.breakthrough({"card": "F2211", "idx": 2, "playerID": "0", "res": 1})

        p0.moves.comment({"target": "S2101", "comment": "B04", "p": "0"})

        p0.moves.chooseEffect({"effect": {"e": "industryBreakthrough", "a": 1}, "idx": 0, "p": "0"})

        p0.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "0"})

        p0.moves.payAdditionalCost({"res": 1, "deposit": 0})

        p0.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "0"})

        p0.moves.playCard({"card": "B02", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "F2213", "idx": 2, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "F1307", "idx": 3, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "F2106", "idx": 2, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "F2112", "idx": 2, "playerID": "1", "res": 0})

        p1.moves.chooseEffect({"effect": {"e": "industryLevelUp", "a": 1}, "idx": 0, "p": "1"})

        p1.moves.confirmRespond("no")

        p1.moves.buyCard({"buyer": "1", "target": "F2210", "resource": 4, "deposit": 0, "helper": []})

        p1.undo()

        p1.moves.playCard({"card": "F2408", "idx": 1, "playerID": "1", "res": 0})

        p1.moves.updateSlot("F2113")

        p1.moves.playCard({"card": "F1305", "idx": 2, "playerID": "1", "res": 0})

        p1.moves.chooseHand({"hand": "B03", "idx": 1, "p": "1"})

        p1.moves.buyCard({"buyer": "1", "target": "F2210", "resource": 4, "deposit": 0, "helper": []})

        p1.moves.buyCard({"buyer": "1", "target": "F2206", "resource": 4, "deposit": 0, "helper": []})

        p1.moves.playCard({"card": "F2214", "idx": 0, "playerID": "1", "res": 0})

        p1.undo()

        p1.moves.playCard({"card": "F2214", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.requestEndTurn("1");


        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 2, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B03", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.buyCard({"buyer": "0", "target": "F2409", "resource": 4, "deposit": 0, "helper": []})

        p0.moves.playCard({"card": "F2405", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.chooseEffect({"effect": {"e": "breakthroughResDeduct", "a": 2}, "idx": 1, "p": "0"})

        p0.moves.chooseHand({"hand": "B07", "idx": 1, "p": "0"})

        p0.moves.playCard({"card": "B01", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.drawCard("0")

        p0.moves.playCard({"card": "B02", "idx": 0, "playerID": "0", "res": 0})

        p0.undo()

        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "F1307", "idx": 1, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "F2213", "idx": 4, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "F2308", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "F2112", "idx": 3, "playerID": "1", "res": 0})

        p1.moves.confirmRespond("yes")

        p1.moves.competitionCard([])

        p0.moves.competitionCard({"pass": false, "card": "F2108", "idx": 4, "p": "0"})

        p1.moves.showCompetitionResult({
            "info": {
                "region": 0,
                "atk": "1",
                "atkPlayedCard": false,
                "atkCard": "F2106",
                "def": "0",
                "defPlayedCard": false,
                "defCard": "F2108",
                "progress": 7,
                "pending": true,
                "onWin": {"e": "none", "a": 1}
            }
        })

        p1.moves.chooseRegion({"r": 3, "idx": 2, "p": "1"})

        p1.moves.playCard({"card": "V321", "idx": 2, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "F2206", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "F1305", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.buyCard({"buyer": "1", "target": "F2109", "resource": 5, "deposit": 0, "helper": []})

        p1.moves.buyCard({"buyer": "1", "target": "F2207", "resource": 4, "deposit": 2, "helper": []})

        p1.undo()

        p1.moves.buyCard({"buyer": "1", "target": "F2208", "resource": 4, "deposit": 2, "helper": []})

        p1.moves.requestEndTurn("1");


        p0.moves.playCard({"card": "F2209", "idx": 4, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "F2409", "idx": 3, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 2, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 2, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "F2309", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "F1106", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B03", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.buyCard({"buyer": "0", "target": "F2306", "resource": 7, "deposit": 0, "helper": []})

        p0.moves.breakthrough({"card": "B02", "idx": 0, "playerID": "0", "res": 2})

        p0.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "0"})

        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "F2308", "idx": 3, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "F2210", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.chooseEffect({"effect": {"e": "draw", "a": 2}, "idx": 0, "p": "1"})

        p1.moves.playCard({"card": "F1307", "idx": 2, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "F2106", "idx": 2, "playerID": "1", "res": 0})

        p1.undo()

        p1.moves.playCard({"card": "F2112", "idx": 5, "playerID": "1", "res": 0})

        p1.moves.confirmRespond("yes")

        p1.moves.competitionCard([])

        p0.moves.competitionCard({"pass": false, "card": "B07", "idx": 0, "p": "0"})

        p1.moves.showCompetitionResult({
            "info": {
                "region": 0,
                "atk": "1",
                "atkPlayedCard": false,
                "atkCard": "F2106",
                "def": "0",
                "defPlayedCard": false,
                "defCard": "B07",
                "progress": 5,
                "pending": true,
                "onWin": {"e": "none", "a": 1}
            }
        })

        p1.moves.chooseRegion({"r": 2, "idx": 2, "p": "1"})

        p1.moves.playCard({"card": "F2408", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.updateSlot("F2113")

        p1.moves.buyCard({"buyer": "1", "target": "F2207", "resource": 6, "deposit": 0, "helper": []})

        p1.moves.playCard({"card": "F2214", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.chooseEffect({"effect": {"e": "aestheticsLevelUp", "a": 1}, "idx": 1, "p": "1"})

        p1.moves.breakthrough({"card": "V321", "idx": 1, "playerID": "1", "res": 2})

        p1.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "1"})

        p1.moves.payAdditionalCost({"res": 1, "deposit": 0})

        p1.moves.playCard({"card": "F1305", "idx": 0, "playerID": "1", "res": 0})

        p1.undo()

        p1.undo()

        p1.undo()

        p1.undo()

        p1.undo()

        p1.moves.chooseEffect({"effect": {"e": "industryLevelUp", "a": 1}, "idx": 0, "p": "1"})

        p1.moves.breakthrough({"card": "V321", "idx": 1, "playerID": "1", "res": 2})

        p1.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "1"})

        p1.moves.payAdditionalCost({"res": 1, "deposit": 0})

        p1.moves.playCard({"card": "F1305", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.requestEndTurn("1");


        p0.moves.playCard({"card": "B07", "idx": 2, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 3, "playerID": "0", "res": 0})

        p0.moves.breakthrough({"card": "B01", "idx": 2, "playerID": "0", "res": 2})

        p0.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "0"})

        p0.undo()

        p0.undo()

        p0.undo()

        p0.undo()

        p0.moves.playCard({"card": "F2209", "idx": 5, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "F2405", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.chooseEffect({"effect": {"e": "breakthroughResDeduct", "a": 2}, "idx": 1, "p": "0"})

        p0.moves.chooseHand({"hand": "B07", "idx": 1, "p": "0"})

        p0.moves.playCard({"card": "F2108", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.buyCard({"buyer": "0", "target": "F2113", "resource": 5, "deposit": 0, "helper": []})

        p0.moves.drawCard("0")

        p0.moves.playCard({"card": "B01", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "F2208", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "F1307", "idx": 5, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "F2109", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.comment({"target": "S2101", "comment": null, "p": "1"})

        p1.undo()

        p1.undo()

        p1.moves.playCard({"card": "F2308", "idx": 4, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "F2408", "idx": 4, "playerID": "1", "res": 0})

        p1.moves.updateSlot("S2101")

        p1.moves.playCard({"card": "F2206", "idx": 2, "playerID": "1", "res": 0})

        p1.moves.breakthrough({"card": "F2213", "idx": 1, "playerID": "1", "res": 2})

        p1.moves.chooseEffect({"effect": {"e": "industryBreakthrough", "a": 1}, "idx": 0, "p": "1"})

        p1.moves.chooseEffect({"effect": {"e": "industryLevelUpCost", "a": 1}, "idx": 0, "p": "1"})

        p1.moves.payAdditionalCost({"res": 2, "deposit": 0})

        p1.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "1"})

        p1.moves.payAdditionalCost({"res": 1, "deposit": 0})

        p1.moves.playCard({"card": "F2106", "idx": 1, "playerID": "1", "res": 0})

        p1.moves.breakthrough({"card": "F2109", "idx": 0, "playerID": "1", "res": 2})

        p1.moves.chooseHand({"hand": "F1305", "idx": 0, "p": "1"})

        p1.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "1"})

        p1.moves.payAdditionalCost({"res": 2, "deposit": 0})

        p1.moves.chooseEffect({"effect": {"e": "aestheticsLevelUpCost", "a": 1}, "idx": 0, "p": "1"})

        p1.moves.payAdditionalCost({"res": 2, "deposit": 0})

        p1.moves.requestEndTurn("1");

        p1.moves.chooseEffect({"effect": {"e": "aestheticsLevelUp", "a": 1}, "idx": 1, "p": "1"})


        p0.moves.playCard({"card": "F1106", "idx": 5, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "B07", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "F2409", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.updateSlot("F3103")

        p0.moves.playCard({"card": "B03", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.drawCard("0")

        p0.moves.playCard({"card": "F2309", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.chooseHand({"hand": "B04", "idx": 4, "p": "0"})

        p0.moves.chooseHand({"hand": "B04", "idx": 1, "p": "0"})

        p0.moves.playCard({"card": "B07", "idx": 2, "playerID": "0", "res": 0})

        p0.moves.buyCard({"buyer": "0", "target": "F3414", "resource": 5, "deposit": 2, "helper": []})

        p0.moves.playCard({"card": "F2108", "idx": 1, "playerID": "0", "res": 0})

        p0.moves.playCard({"card": "F2306", "idx": 0, "playerID": "0", "res": 0})

        p0.moves.chooseHand({"hand": "B04", "idx": 0, "p": "0"})

        p0.moves.requestEndTurn("0");


        p1.moves.playCard({"card": "F2210", "idx": 1, "playerID": "1", "res": 0})

        p1.moves.chooseEffect({"effect": {"e": "draw", "a": 2}, "idx": 0, "p": "1"})

        p1.undo()

        p1.undo()

        p1.moves.playCard({"card": "F2214", "idx": 2, "playerID": "1", "res": 0})

        p1.moves.playCard({"card": "F2206", "idx": 5, "playerID": "1", "res": 0})

        p1.moves.comment({"target": "S3105", "comment": "B04", "p": "1"})

        p1.moves.playCard({"card": "F2112", "idx": 0, "playerID": "1", "res": 0})

        p1.moves.confirmRespond("no")

        p1.moves.playCard({"card": "F2308", "idx": 2, "playerID": "1", "res": 0})

        p1.moves.buyCard({"buyer": "1", "target": "F3110", "resource": 6, "deposit": 0, "helper": []})

        p1.moves.playCard({"card": "F2408", "idx": 3, "playerID": "1", "res": 0})
    }
    p0.stop();
    p1.stop();

})

