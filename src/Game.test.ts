import {Client} from 'boardgame.io/client';
import {Local} from 'boardgame.io/multiplayer'
import {FilmCentenaryGame} from './Game';
import {IG} from "./types/setup";

const hasDuplicateClassicCard = (G:IG,p:number) =>{
    const validCards = [...G.pub[p].discard,...G.secretInfo.playerDecks[p],...G.player[p].hand];
    console.log(validCards)
}

const gameWithSeed = (seed: string) => ({
    ...FilmCentenaryGame,
    seed
});

it('Duplicate cards', () => {
    const spec = {
        numPlayers: 2,
        game: gameWithSeed("kgs0jz9f"),
        multiplayer: Local(),
    };

    const p0 = Client({...spec, playerID: '0'} as any) as any;
    const p1 = Client({...spec, playerID: '1'} as any) as any;
    p0.start()
    p1.start()


    p0.stop()
    p1.stop()
});
it('Nanook', () => {
    const spec = {
        numPlayers: 2,
        game: gameWithSeed("kg7q3639"),
        multiplayer: Local(),
    };

    const p0 = Client({...spec, playerID: '0'} as any) as any;
    const p1 = Client({...spec, playerID: '1'} as any) as any;
    p0.start()
    p1.start()


    p0.stop()
    p1.stop()
})
it('Sergei M. Eisenstein', () => {
    const spec = {
        numPlayers: 3,
        game: gameWithSeed("kgt5uqrj"),
        multiplayer: Local(),
    };

    const p0 = Client({...spec, playerID: '0'} as any) as any;
    const p1 = Client({...spec, playerID: '1'} as any) as any;
    const p2 = Client({...spec, playerID: '2'} as any) as any;

    p0.start();
    p1.start();
    p2.start();
    {p0.moves.showBoardStatus({"regions":[{"normalDeckLength":2,"legendDeckLength":0,"completedModernScoring":false,"era":0,"buildings":[{"building":null,"region":0,"activated":true,"owner":""},{"building":null,"region":0,"activated":true,"owner":""},{"building":null,"region":0,"activated":false,"owner":""}],"legend":{"comment":null,"region":0,"isLegend":true,"card":"P1101"},"normal":[{"comment":null,"region":0,"isLegend":false,"card":"F1104"},{"comment":null,"region":0,"isLegend":false,"card":"F1107"},{"comment":null,"region":0,"isLegend":false,"card":"F1108"}],"share":5},{"normalDeckLength":2,"legendDeckLength":0,"completedModernScoring":false,"era":0,"buildings":[{"building":null,"region":1,"activated":true,"owner":""},{"building":null,"region":1,"activated":true,"owner":""}],"legend":{"comment":null,"region":1,"isLegend":true,"card":"P1202"},"normal":[{"comment":null,"region":1,"isLegend":false,"card":"F1210"},{"comment":null,"region":1,"isLegend":false,"card":"F1206"},{"comment":null,"region":1,"isLegend":false,"card":"F1208"}],"share":5},{"normalDeckLength":1,"legendDeckLength":0,"completedModernScoring":false,"era":0,"buildings":[{"building":null,"region":2,"activated":true,"owner":""},{"building":null,"region":2,"activated":false,"owner":""}],"legend":{"comment":null,"region":2,"isLegend":true,"card":"S1301"},"normal":[{"comment":null,"region":2,"isLegend":false,"card":"F1306"},{"comment":null,"region":2,"isLegend":false,"card":"F1307"}],"share":3},{"normalDeckLength":0,"legendDeckLength":0,"completedModernScoring":false,"era":0,"buildings":[{"building":null,"region":3,"activated":true,"owner":""},{"building":null,"region":3,"activated":false,"owner":""}],"legend":{"comment":null,"region":3,"isLegend":true,"card":null},"normal":[{"comment":null,"region":3,"isLegend":false,"card":null},{"comment":null,"region":3,"isLegend":false,"card":null}],"share":0}],"school":[],"film":[],"matchID":"FwL4C7Huz","seed":"kgt5uqrj"})





        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.breakthrough({"card":"B02","idx":0,"playerID":"0","res":2})

        p0.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"0"})

        p0.moves.playCard({"card":"B01","idx":0,"playerID":"0","res":0})

        p0.moves.requestEndTurn("0");



        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})

        p1.moves.breakthrough({"card":"B02","idx":1,"playerID":"1","res":2})

        p1.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"1"})

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})

        p1.moves.requestEndTurn("1");



        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0})

        p2.moves.buyCard({"buyer":"2","target":"F1104","resource":4,"deposit":0,"helper":[]})

        p2.moves.requestEndTurn("2");



        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.buyCard({"buyer":"0","target":"F1306","resource":3,"deposit":0,"helper":[]})

        p0.moves.requestEndTurn("0");



        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0})

        p1.moves.buyCard({"buyer":"1","target":"F1108","resource":3,"deposit":0,"helper":["B01"]})

        p1.moves.requestEndTurn("1");



        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0})

        p2.moves.buyCard({"buyer":"2","target":"F1107","resource":2,"deposit":0,"helper":["B01"]})

        p2.moves.playCard({"card":"B02","idx":0,"playerID":"2","res":0})

        p2.moves.requestEndTurn("2");



        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0})

        p0.moves.breakthrough({"card":"B01","idx":0,"playerID":"0","res":2})

        p0.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"0"})

        p0.moves.requestEndTurn("0");



        p1.moves.playCard({"card":"B07","idx":3,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})

        p1.moves.breakthrough({"card":"B07","idx":1,"playerID":"1","res":2})

        p1.undo()

        p1.moves.breakthrough({"card":"B01","idx":0,"playerID":"1","res":2})

        p1.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"1"})

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})

        p1.moves.requestEndTurn("1");



        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0})

        p2.moves.playCard({"card":"F1104","idx":0,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0})

        p2.moves.playCard({"card":"F1107","idx":0,"playerID":"2","res":0})

        p2.moves.buyCard({"buyer":"2","target":"F1210","resource":3,"deposit":0,"helper":[]})

        p2.moves.requestEndTurn("2");



        p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0})

        p0.moves.breakthrough({"card":"F1306","idx":1,"playerID":"0","res":2})

        p0.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"0"})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.requestEndTurn("0");



        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0})

        p1.moves.buyCard({"buyer":"1","target":"F1208","resource":3,"deposit":0,"helper":["F1108"]})

        p1.moves.requestEndTurn("1");



        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0})

        p2.moves.buyCard({"buyer":"2","target":"B03","resource":2,"deposit":0,"helper":[]})

        p2.moves.requestEndTurn("2");



        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.buyCard({"buyer":"0","target":"F1304","resource":5,"deposit":0,"helper":[]})

        p0.moves.requestEndTurn("0");



        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0})

        p1.moves.playCard({"card":"F1208","idx":0,"playerID":"1","res":0})

        p1.undo()

        p1.moves.buyCard({"buyer":"1","target":"F1211","resource":3,"deposit":0,"helper":[]})

        p1.moves.playCard({"card":"F1208","idx":0,"playerID":"1","res":0})

        p1.moves.requestEndTurn("1");



        p2.moves.playCard({"card":"B07","idx":2,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B07","idx":2,"playerID":"2","res":0})

        p2.moves.breakthrough({"card":"B01","idx":0,"playerID":"2","res":2})

        p2.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"2"})

        p2.moves.playCard({"card":"B02","idx":0,"playerID":"2","res":0})

        p2.moves.requestEndTurn("2");



        p0.moves.playCard({"card":"F1304","idx":3,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.buyCard({"buyer":"0","target":"S1204","resource":6,"deposit":0,"helper":[]})

        p0.moves.requestEndTurn("0");



        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0})

        p1.moves.breakthrough({"card":"F1108","idx":0,"playerID":"1","res":2})

        p1.moves.chooseEffect({"effect":{"e":"industryBreakthrough","a":1},"idx":0,"p":"1"})

        p1.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"1"})

        p1.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"1"})

        p1.moves.requestEndTurn("1");



        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0})

        p2.moves.playCard({"card":"F1210","idx":1,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B03","idx":0,"playerID":"2","res":0})

        p2.moves.buyCard({"buyer":"2","target":"P1101","resource":5,"deposit":2,"helper":[]})

        p2.moves.chooseEffect({"effect":{"e":"buy","a":"F1103"},"idx":1,"p":"2"})

        p2.moves.requestEndTurn("2");

        p2.moves.chooseEvent({"event":"E01","idx":0,"p":"2"})

        p1.moves.chooseEffect({"effect":{"e":"aestheticsLevelUp","a":1},"idx":1,"p":"1"})

        p0.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"0"})

        p2.moves.chooseEffect({"effect":{"e":"aestheticsLevelUp","a":1},"idx":1,"p":"2"})



        p0.moves.playCard({"card":"F1304","idx":3,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.buyCard({"buyer":"0","target":"F1307","resource":3,"deposit":0,"helper":[]})

        p0.moves.buyCard({"buyer":"0","target":"B03","resource":2,"deposit":0,"helper":[]})

        p0.moves.requestEndTurn("0");

        p0.moves.chooseEvent({"event":"E02","idx":1,"p":"0"})

        p1.moves.chooseHand({"hand":"B07","idx":0,"p":"1"})

        p0.moves.chooseHand({"hand":"B07","idx":0,"p":"0"})



        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})

        p1.moves.buyCard({"buyer":"1","target":"B03","resource":2,"deposit":0,"helper":[]})

        p1.moves.requestEndTurn("1");



        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B07","idx":2,"playerID":"2","res":0})

        p2.moves.playCard({"card":"F1107","idx":0,"playerID":"2","res":0})

        p2.moves.breakthrough({"card":"F1104","idx":0,"playerID":"2","res":2})

        p2.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"2"})

        p2.moves.requestEndTurn("2");



        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.breakthrough({"card":"F1304","idx":0,"playerID":"0","res":2})

        p0.moves.comment({"target":"P1202","comment":"B04","p":"0"})

        p0.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"0"})

        p0.undo()

        p0.undo()

        p0.undo()

        p0.moves.drawCard("0")

        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0})

        p0.moves.playCard({"card":"F1304","idx":0,"playerID":"0","res":0})

        p0.moves.buyCard({"buyer":"0","target":"P1202","resource":4,"deposit":1,"helper":[]})

        p0.moves.requestEndTurn("0");



        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})

        p1.moves.playCard({"card":"F1211","idx":1,"playerID":"1","res":0})

        p1.moves.buyCard({"buyer":"1","target":"F1206","resource":2,"deposit":0,"helper":[]})

        p1.moves.playCard({"card":"F1208","idx":0,"playerID":"1","res":0})

        p1.moves.requestEndTurn("1");

        p1.moves.chooseEvent({"event":"E04","idx":1,"p":"1"})



        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0})

        p2.moves.breakthrough({"card":"F1107","idx":1,"playerID":"2","res":2})

        p2.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"2"})

        p2.moves.playCard({"card":"P1101","idx":0,"playerID":"2","res":0})

        p2.moves.updateSlot("S2101")

        p2.moves.chooseTarget({"target":"1","idx":2,"p":"2","targetName":"Blue"})

        p1.moves.chooseHand({"hand":"F1208","idx":0,"p":"1"})

        p2.moves.drawCard("2")

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0})

        p2.moves.requestEndTurn("2");



        p0.moves.playCard({"card":"F1307","idx":1,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B03","idx":0,"playerID":"0","res":0})

        p0.moves.breakthrough({"card":"B04","idx":2,"playerID":"0","res":2})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.breakthrough({"card":"B07","idx":0,"playerID":"0","res":2})

        p0.moves.requestEndTurn("0");



        p1.moves.drawCard("1")

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})

        p1.moves.playCard({"card":"V112","idx":1,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0})

        p1.moves.buyCard({"buyer":"1","target":"F2108","resource":4,"deposit":1,"helper":["B02"]})

        p1.moves.playCard({"card":"B04","idx":0,"playerID":"1","res":0})

        p1.moves.requestEndTurn("1");



        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0})

        p2.moves.playCard({"card":"V111","idx":0,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B03","idx":0,"playerID":"2","res":0})

        p2.moves.breakthrough({"card":"B02","idx":0,"playerID":"2","res":2})

        p2.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"2"})

        p2.undo()

        p2.undo()

        p2.undo()

        p2.undo()

        p2.moves.playCard({"card":"B03","idx":1,"playerID":"2","res":0})

        p2.moves.breakthrough({"card":"V111","idx":0,"playerID":"2","res":2})

        p2.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"2"})

        p2.moves.breakthrough({"card":"B02","idx":0,"playerID":"2","res":0})

        p2.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"2"})

        p2.undo()

        p2.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"2"})

        p2.moves.requestEndTurn("2");



        p0.moves.playCard({"card":"B05","idx":2,"playerID":"0","res":0})

        p0.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"0"})

        p0.undo()

        p0.undo()

        p0.moves.playCard({"card":"B03","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.breakthrough({"card":"B05","idx":0,"playerID":"0","res":2})

        p0.moves.chooseEffect({"effect":{"e":"industryBreakthrough","a":1},"idx":0,"p":"0"})

        p0.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"0"})

        p0.moves.payAdditionalCost({"res":1,"deposit":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.buyCard({"buyer":"0","target":"B02","resource":2,"deposit":0,"helper":[]})

        p0.moves.requestEndTurn("0");



        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})

        p1.moves.drawCard("1")

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})

        p1.moves.breakthrough({"card":"F1206","idx":0,"playerID":"1","res":2})

        p1.moves.chooseHand({"hand":"B07","idx":0,"p":"1"})

        p1.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"1"})

        p1.moves.payAdditionalCost({"res":1,"deposit":0})

        p1.moves.requestEndTurn("1");



        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0})

        p2.moves.playCard({"card":"F1103","idx":0,"playerID":"2","res":0})

        p2.undo()

        p2.moves.drawCard("2")

        p2.moves.playCard({"card":"B07","idx":3,"playerID":"2","res":0})

        p2.moves.breakthrough({"card":"F1210","idx":1,"playerID":"2","res":2})

        p2.moves.playCard({"card":"F1103","idx":0,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B04","idx":0,"playerID":"2","res":0})

        p2.moves.requestEndTurn("2");



        p0.moves.playCard({"card":"F1307","idx":3,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0})

        p0.moves.breakthrough({"card":"F1304","idx":3,"playerID":"0","res":2})

        p0.moves.comment({"target":"F2111","comment":"B03","p":"0"})

        p0.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"0"})

        p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0})

        p0.moves.playCard({"card":"V131","idx":1,"playerID":"0","res":0})

        p0.moves.playCard({"card":"V122","idx":0,"playerID":"0","res":0})

        p0.moves.buyCard({"buyer":"0","target":"F2111","resource":4,"deposit":0,"helper":[]})

        p0.moves.requestEndTurn("0");



        p1.moves.playCard({"card":"B03","idx":1,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0})

        p1.moves.drawCard("1")

        p1.moves.playCard({"card":"V121","idx":1,"playerID":"1","res":0})

        p1.moves.playCard({"card":"F1211","idx":0,"playerID":"1","res":0})

        p1.moves.comment({"target":"S2104","comment":"B04","p":"1"})

        p1.moves.buyCard({"buyer":"1","target":"F2113","resource":4,"deposit":1,"helper":["B02"]})

        p1.moves.requestEndTurn("1");



        p2.moves.playCard({"card":"P1101","idx":0,"playerID":"2","res":0})

        p2.moves.updateSlot("F2214")

        p2.undo()

        p2.moves.updateSlot("S2201")

        p2.moves.chooseTarget({"target":"0","idx":1,"p":"2","targetName":"Red"})

        p0.moves.chooseHand({"hand":"P1202","idx":0,"p":"0"})

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0})

        p2.moves.drawCard("2")

        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0})

        p2.moves.buyCard({"buyer":"2","target":"S2104","resource":4,"deposit":2,"helper":["F1103"]})

        p2.moves.requestEndTurn("2");



        p0.moves.drawCard("0")

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"V131","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.buyCard({"buyer":"0","target":"P2103","resource":6,"deposit":2,"helper":[]})

        p0.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"0"})

        p0.moves.requestEndTurn("0");



        p1.moves.playCard({"card":"F2108","idx":0,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})

        p1.moves.playCard({"card":"V112","idx":0,"playerID":"1","res":0})

        p1.moves.drawCard("1")

        p1.moves.playCard({"card":"B05","idx":0,"playerID":"1","res":0})

        p1.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"1"})

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})

        p1.moves.buyCard({"buyer":"1","target":"F2408","resource":5,"deposit":0,"helper":[]})

        p1.undo()

        p1.undo()

        p1.undo()

        p1.undo()

        p1.undo()

        p1.moves.buyCard({"buyer":"1","target":"F2408","resource":5,"deposit":0,"helper":[]})

        p1.moves.drawCard("1")

        p1.moves.playCard({"card":"B05","idx":0,"playerID":"1","res":0})

        p1.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"1"})

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})

        p1.moves.requestEndTurn("1");



        p2.moves.playCard({"card":"B07","idx":3,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B04","idx":1,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B04","idx":0,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B03","idx":0,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0})

        p2.moves.buyCard({"buyer":"2","target":"F2309","resource":5,"deposit":1,"helper":[]})

        p2.moves.requestEndTurn("2");



        p0.moves.playCard({"card":"F2111","idx":1,"playerID":"0","res":0})

        p0.moves.chooseEffect({"effect":{"e":"industryAward","a":1},"idx":1,"p":"0"})

        p0.moves.playCard({"card":"B03","idx":1,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B03","idx":1,"playerID":"0","res":0})

        p0.moves.playCard({"card":"F1307","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0})

        p0.moves.playCard({"card":"V122","idx":1,"playerID":"0","res":0})

        p0.moves.drawCard("0")

        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0})

        p0.moves.buyCard({"buyer":"0","target":"S2101","resource":7,"deposit":1,"helper":[]})

        p0.moves.playCard({"card":"B02","idx":0,"playerID":"0","res":0})

        p0.moves.requestEndTurn("0");



        p1.moves.drawCard("1")

        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0})

        p1.moves.breakthrough({"card":"F1211","idx":2,"playerID":"1","res":2})

        p1.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"1"})

        p1.moves.payAdditionalCost({"res":1,"deposit":0})

        p1.moves.playCard({"card":"F1208","idx":1,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B04","idx":0,"playerID":"1","res":0})

        p1.moves.requestEndTurn("1");



        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0})

        p2.moves.playCard({"card":"F2309","idx":2,"playerID":"2","res":0})

        p2.moves.breakthrough({"card":"B04","idx":2,"playerID":"2","res":2})

        p2.moves.playCard({"card":"B05","idx":0,"playerID":"2","res":0})

        p2.moves.chooseEffect({"effect":{"e":"aesAward","a":1},"idx":1,"p":"2"})

        p2.moves.breakthrough({"card":"B04","idx":0,"playerID":"2","res":2})

        p2.moves.requestEndTurn("2");



        p0.moves.playCard({"card":"P1202","idx":2,"playerID":"0","res":0})

        p0.moves.chooseTarget({"target":"1","idx":1,"p":"0","targetName":"Blue"})

        p0.moves.playCard({"card":"P2103","idx":1,"playerID":"0","res":0})

        p0.moves.chooseTarget({"target":"1","idx":1,"p":"0","targetName":"Blue"})

        p1.moves.chooseHand({"hand":"B07","idx":1,"p":"1"})

        p0.moves.playCard({"card":"B05","idx":5,"playerID":"0","res":0})

        p0.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"0"})

        p0.moves.playCard({"card":"F1307","idx":5,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"V131","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.buyCard({"buyer":"0","target":"F2306","resource":7,"deposit":0,"helper":[]})

        p0.moves.playCard({"card":"V122","idx":0,"playerID":"0","res":0})

        p0.undo()

        p0.undo()

        p0.moves.drawCard("0")

        p0.moves.playCard({"card":"V122","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B02","idx":0,"playerID":"0","res":0})

        p0.moves.buyCard({"buyer":"0","target":"F2207","resource":8,"deposit":0,"helper":[]})

        p0.moves.requestEndTurn("0");



        p1.moves.drawCard("1")

        p1.moves.playCard({"card":"F2408","idx":4,"playerID":"1","res":0})

        p1.moves.updateSlot("P2202")

        p1.moves.playCard({"card":"V112","idx":0,"playerID":"1","res":0})

        p1.moves.playCard({"card":"F2113","idx":0,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B03","idx":0,"playerID":"1","res":0})

        p1.moves.buyCard({"buyer":"1","target":"S2201","resource":8,"deposit":2,"helper":[]})

        p1.moves.playCard({"card":"B04","idx":0,"playerID":"1","res":0})

        p1.moves.requestEndTurn("1");



        p2.moves.playCard({"card":"P1101","idx":0,"playerID":"2","res":0})

        p2.moves.updateSlot("F2106")

        p2.undo()

        p2.moves.updateSlot("F2214")

        p2.moves.chooseTarget({"target":"0","idx":1,"p":"2","targetName":"Red"})

        p0.moves.chooseHand({"hand":"P1202","idx":5,"p":"0"})

        p2.moves.playCard({"card":"B07","idx":3,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B03","idx":0,"playerID":"2","res":0})

        p2.moves.buyCard({"buyer":"2","target":"F2212","resource":5,"deposit":1,"helper":[]})

        p2.moves.breakthrough({"card":"B04","idx":0,"playerID":"2","res":0})

        p2.moves.requestEndTurn("2");



        p0.moves.playCard({"card":"F2111","idx":0,"playerID":"0","res":0})

        p0.moves.chooseEffect({"effect":{"e":"industryAward","a":1},"idx":1,"p":"0"})

        p0.moves.playCard({"card":"B03","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B03","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0})

        p0.moves.playCard({"card":"V131","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.buyCard({"buyer":"0","target":"F2306","resource":7,"deposit":0,"helper":[]})

        p0.moves.buyCard({"buyer":"0","target":"F2208","resource":1,"deposit":5,"helper":[]})

        p0.moves.requestEndTurn("0");



        p1.moves.playCard({"card":"B05","idx":0,"playerID":"1","res":0})

        p1.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"1"})

        p1.moves.playCard({"card":"V121","idx":0,"playerID":"1","res":0})

        p1.moves.playCard({"card":"F2108","idx":1,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0})

        p1.moves.breakthrough({"card":"B02","idx":0,"playerID":"1","res":2})

        p1.moves.chooseEffect({"effect":{"e":"buildStudio","a":1},"idx":1,"p":"1"})

        p1.moves.chooseRegion({"r":0,"idx":0,"p":"1"})

        p1.moves.payAdditionalCost({"res":3,"deposit":0})

        p1.moves.drawCard("1")

        p1.moves.playCard({"card":"F1208","idx":0,"playerID":"1","res":0})

        p1.moves.requestEndTurn("1");



        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0})

        p2.moves.breakthrough({"card":"F1103","idx":0,"playerID":"2","res":2})

        p2.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"2"})

        p2.moves.payAdditionalCost({"res":1,"deposit":0})

        p2.moves.buyCard({"buyer":"2","target":"B03","resource":2,"deposit":0,"helper":[]})

        p2.moves.requestEndTurn("2");



        p0.moves.playCard({"card":"F1307","idx":4,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B05","idx":0,"playerID":"0","res":0})

        p0.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"0"})

        p0.moves.playCard({"card":"F2306","idx":6,"playerID":"0","res":0})

        p0.moves.chooseHand({"hand":"B07","idx":2,"p":"0"})

        p0.moves.playCard({"card":"P2103","idx":0,"playerID":"0","res":0})

        p0.moves.chooseTarget({"target":"1","idx":1,"p":"0","targetName":"Blue"})

        p1.moves.chooseHand({"hand":"B04","idx":2,"p":"1"})

        p0.moves.drawCard("0")

        p0.moves.playCard({"card":"F2208","idx":5,"playerID":"0","res":0})

        p0.moves.playCard({"card":"P1202","idx":5,"playerID":"0","res":0})

        p0.moves.chooseTarget({"target":"1","idx":1,"p":"0","targetName":"Blue"})

        p1.moves.chooseHand({"hand":"F2408","idx":1,"p":"1"})

        p0.moves.playCard({"card":"F2207","idx":0,"playerID":"0","res":0})

        p0.moves.chooseEffect({"effect":{"e":"step","a":[{"e":"res","a":2},{"e":"deposit","a":1}]},"idx":0,"p":"0"})

        p0.moves.playCard({"card":"V122","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B05","idx":2,"playerID":"0","res":0})

        p0.undo()

        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0})

        p0.moves.buyCard({"buyer":"0","target":"P2205","resource":9,"deposit":0,"helper":["B05"]})

        p0.moves.chooseEffect({"effect":{"e":"buy","a":"F2206"},"idx":1,"p":"0"})

        p0.moves.playCard({"card":"B02","idx":0,"playerID":"0","res":0})

        p0.moves.requestEndTurn("0");



        p1.moves.playCard({"card":"F2113","idx":0,"playerID":"1","res":0})

        p1.moves.playCard({"card":"V112","idx":0,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})

        p1.moves.drawCard("1")

        p1.moves.buyCard({"buyer":"1","target":"P2105","resource":6,"deposit":1,"helper":[]})

        p1.moves.requestEndTurn("1");



        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0})

        p2.moves.playCard({"card":"F2212","idx":0,"playerID":"2","res":0})

        p2.moves.comment({"target":"F2106","comment":"B04","p":"2"})

        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B05","idx":0,"playerID":"2","res":0})

        p2.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"2"})

        p2.moves.playCard({"card":"P1101","idx":0,"playerID":"2","res":0})

        p2.moves.updateSlot("F2303")

        p2.moves.chooseTarget({"target":"0","idx":1,"p":"2","targetName":"Red"})

        p0.moves.chooseHand({"hand":"F1307","idx":6,"p":"0"})

        p2.moves.playCard({"card":"B03","idx":0,"playerID":"2","res":0})

        p2.moves.drawCard("2")

        p2.moves.buyCard({"buyer":"2","target":"F2214","resource":5,"deposit":0,"helper":[]})

        p2.moves.playCard({"card":"F2309","idx":0,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0})

        p2.undo()

        p2.undo()

        p2.undo()

        p2.moves.playCard({"card":"F2309","idx":0,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B03","idx":0,"playerID":"2","res":0})

        p2.moves.buyCard({"buyer":"2","target":"P2302","resource":8,"deposit":0,"helper":[]})

        p2.moves.chooseEffect({"effect":{"e":"buy","a":"F2305"},"idx":1,"p":"2"})

        p2.moves.requestEndTurn("2");



        p0.moves.playCard({"card":"F2111","idx":4,"playerID":"0","res":0})

        p0.moves.chooseEffect({"effect":{"e":"industryAward","a":1},"idx":1,"p":"0"})

        p0.moves.playCard({"card":"F2208","idx":5,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B03","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B03","idx":0,"playerID":"0","res":0})

        p0.moves.breakthrough({"card":"B05","idx":3,"playerID":"0","res":2})

        p0.moves.chooseEffect({"effect":{"e":"aestheticsBreakthrough","a":1},"idx":1,"p":"0"})

        p0.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"0"})

        p0.moves.playCard({"card":"B07","idx":3,"playerID":"0","res":0})

        p0.moves.breakthrough({"card":"V131","idx":0,"playerID":"0","res":0})

        p0.undo()

        p0.moves.playCard({"card":"V131","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.undo()

        p0.undo()

        p0.undo()

        p0.undo()

        p0.undo()

        p0.undo()

        p0.undo()

        p0.moves.playCard({"card":"B05","idx":3,"playerID":"0","res":0})

        p0.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"0"})

        p0.moves.playCard({"card":"B07","idx":4,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0})

        p0.moves.breakthrough({"card":"V131","idx":0,"playerID":"0","res":2})

        p0.moves.buyCard({"buyer":"0","target":"F2214","resource":7,"deposit":0,"helper":[]})

        p0.undo()

        p0.undo()

        p0.undo()

        p0.undo()

        p0.undo()

        p0.undo()

        p0.undo()

        p0.undo()

        p0.moves.breakthrough({"card":"B05","idx":3,"playerID":"0","res":2})

        p0.moves.chooseEffect({"effect":{"e":"aestheticsBreakthrough","a":1},"idx":1,"p":"0"})

        p0.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"0"})

        p0.moves.playCard({"card":"V131","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.buyCard({"buyer":"0","target":"F2214","resource":5,"deposit":0,"helper":[]})

        p0.undo()

        p0.moves.buyCard({"buyer":"0","target":"F2405","resource":7,"deposit":1,"helper":[]})

        p0.moves.requestEndTurn("0");



        p1.moves.playCard({"card":"B07","idx":3,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B03","idx":2,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0})

        p1.moves.drawCard("1")

        p1.moves.playCard({"card":"F2113","idx":2,"playerID":"1","res":0})

        p1.moves.buyCard({"buyer":"1","target":"P2202","resource":8,"deposit":0,"helper":[]})

        p1.moves.playCard({"card":"B04","idx":0,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B04","idx":0,"playerID":"1","res":0})

        p1.moves.requestEndTurn("1");



        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B03","idx":0,"playerID":"2","res":0})

        p2.moves.buyCard({"buyer":"2","target":"F2303","resource":7,"deposit":0,"helper":[]})

        p2.moves.drawCard("2")

        p2.moves.playCard({"card":"B05","idx":0,"playerID":"2","res":0})

        p2.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"2"})

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0})

        p2.moves.requestEndTurn("2");

        p2.moves.chooseEvent({"event":"E05","idx":0,"p":"2"})

        p1.moves.chooseHand({"hand":"V112","idx":4,"p":"1"})

        p1.moves.chooseHand({"hand":"B07","idx":0,"p":"1"})



        p0.moves.playCard({"card":"P1202","idx":6,"playerID":"0","res":0})

        p0.moves.chooseTarget({"target":"1","idx":1,"p":"0","targetName":"Blue"})

        p1.moves.chooseHand({"hand":"B05","idx":2,"p":"1"})

        p0.moves.playCard({"card":"P2103","idx":4,"playerID":"0","res":0})

        p0.moves.chooseTarget({"target":"1","idx":1,"p":"0","targetName":"Blue"})

        p1.moves.chooseHand({"hand":"F1208","idx":1,"p":"1"})

        p0.moves.playCard({"card":"B05","idx":5,"playerID":"0","res":0})

        p0.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"0"})

        p0.moves.playCard({"card":"P2205","idx":5,"playerID":"0","res":0})

        p0.moves.comment({"target":"F2106","comment":null,"p":"0"})

        p0.moves.chooseTarget({"target":"1","idx":1,"p":"0","targetName":"Blue"})

        p0.moves.playCard({"card":"F2306","idx":1,"playerID":"0","res":0})

        p0.moves.chooseHand({"hand":"B07","idx":0,"p":"0"})

        p0.moves.playCard({"card":"V122","idx":0,"playerID":"0","res":0})

        p0.moves.breakthrough({"card":"B02","idx":1,"playerID":"0","res":2})

        p0.moves.chooseEffect({"effect":{"e":"buildCinema","a":1},"idx":2,"p":"0"})

        p0.moves.chooseRegion({"r":1,"idx":1,"p":"0"})

        p0.moves.payAdditionalCost({"res":1,"deposit":2})

        p0.moves.drawCard("0")

        p0.moves.playCard({"card":"F2206","idx":1,"playerID":"0","res":0})

        p0.moves.playCard({"card":"F2207","idx":0,"playerID":"0","res":0})

        p0.moves.chooseEffect({"effect":{"e":"breakthroughResDeduct","a":2},"idx":1,"p":"0"})

        p0.moves.chooseHand({"hand":"B05","idx":0,"p":"0"})

        p0.moves.chooseEffect({"effect":{"e":"industryBreakthrough","a":1},"idx":0,"p":"0"})

        p0.moves.chooseEffect({"effect":{"e":"buildStudio","a":1},"idx":1,"p":"0"})

        p0.moves.chooseRegion({"r":2,"idx":1,"p":"0"})

        p0.moves.payAdditionalCost({"res":2,"deposit":1})

        p0.undo()

        p0.undo()

        p0.undo()

        p0.undo()

        p0.undo()

        p0.undo()

        p0.undo()

        p0.moves.playCard({"card":"F2207","idx":0,"playerID":"0","res":0})

        p0.moves.chooseEffect({"effect":{"e":"step","a":[{"e":"res","a":2},{"e":"deposit","a":1}]},"idx":0,"p":"0"})

        p0.undo()

        p0.undo()

        p0.undo()

        p0.moves.playCard({"card":"F2206","idx":1,"playerID":"0","res":0})

        p0.undo()

        p0.undo()

        p0.moves.playCard({"card":"F2206","idx":1,"playerID":"0","res":0})

        p0.moves.playCard({"card":"F2207","idx":0,"playerID":"0","res":0})

        p0.moves.buyCard({"buyer":"0","target":"F2214","resource":4,"deposit":1,"helper":[]})

        p0.moves.requestEndTurn("0");

        p0.moves.chooseEvent({"event":"E09","idx":1,"p":"0"})



        p1.moves.playCard({"card":"F2108","idx":0,"playerID":"1","res":0})

        p1.moves.breakthrough({"card":"B04","idx":0,"playerID":"1","res":2})

        p1.undo()

        p1.moves.breakthrough({"card":"B04","idx":0,"playerID":"1","res":2})

        p1.moves.buyCard({"buyer":"1","target":"F2114","resource":1,"deposit":1,"helper":[]})

        p1.moves.requestEndTurn("1");

        p1.moves.chooseEffect({"effect":{"e":"aestheticsLevelUp","a":1},"idx":1,"p":"1"})



        p2.moves.playCard({"card":"F2305","idx":1,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B07","idx":2,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B03","idx":3,"playerID":"2","res":0})

        p2.moves.playCard({"card":"P1101","idx":2,"playerID":"2","res":0})

        p2.moves.updateSlot("S3201")

        p2.moves.chooseTarget({"target":"0","idx":1,"p":"2","targetName":"Red"})

        p0.moves.chooseHand({"hand":"F2111","idx":6,"p":"0"})

        p2.moves.playCard({"card":"F2212","idx":1,"playerID":"2","res":0})

        p2.moves.comment({"target":"F2106","comment":"B03","p":"2"})

        p2.moves.playCard({"card":"P2302","idx":0,"playerID":"2","res":0})

        p2.moves.playCard({"card":"F2309","idx":0,"playerID":"2","res":0})

        p2.moves.chooseHand({"hand":"B07","idx":1,"p":"2"})

        p2.moves.chooseHand({"hand":"B07","idx":1,"p":"2"})

        p2.moves.playCard({"card":"V231","idx":0,"playerID":"2","res":0})

        p2.moves.buyCard({"buyer":"2","target":"F2410","resource":5,"deposit":0,"helper":[]})

        p2.undo()

        p2.undo()

        p2.moves.breakthrough({"card":"V231","idx":0,"playerID":"2","res":2})

        p2.moves.chooseEffect({"effect":{"e":"buildStudio","a":1},"idx":1,"p":"2"})

        p2.moves.chooseRegion({"r":2,"idx":2,"p":"2"})

        p2.moves.payAdditionalCost({"res":2,"deposit":1})

        p2.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"2"})

        p2.moves.buyCard({"buyer":"2","target":"F2410","resource":0,"deposit":5,"helper":[]})

        p2.moves.requestEndTurn("2");



        p0.moves.playCard({"card":"P2205","idx":1,"playerID":"0","res":0})

        p0.moves.comment({"target":"F3209","comment":"B04","p":"0"})

        p0.moves.chooseTarget({"target":"1","idx":1,"p":"0","targetName":"Blue"})

        p0.moves.playCard({"card":"B05","idx":0,"playerID":"0","res":0})

        p0.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"0"})

        p0.moves.playCard({"card":"F2214","idx":5,"playerID":"0","res":0})

        p0.moves.playCard({"card":"P1202","idx":5,"playerID":"0","res":0})

        p0.moves.chooseTarget({"target":"1","idx":1,"p":"0","targetName":"Blue"})

        p1.moves.chooseHand({"hand":"V121","idx":2,"p":"1"})

        p0.moves.playCard({"card":"B03","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"F2207","idx":2,"playerID":"0","res":0})

        p0.undo()

        p0.moves.playCard({"card":"P2103","idx":1,"playerID":"0","res":0})

        p0.moves.chooseTarget({"target":"1","idx":1,"p":"0","targetName":"Blue"})

        p1.moves.chooseHand({"hand":"B04","idx":3,"p":"1"})

        p0.moves.playCard({"card":"F2207","idx":1,"playerID":"0","res":0})

        p0.moves.chooseHand({"hand":"B05","idx":3,"p":"0"})

        p0.moves.chooseEffect({"effect":{"e":"industryBreakthrough","a":1},"idx":0,"p":"0"})

        p0.moves.chooseEffect({"effect":{"e":"buildStudio","a":1},"idx":1,"p":"0"})

        p0.moves.chooseRegion({"r":0,"idx":0,"p":"0"})

        p0.moves.payAdditionalCost({"res":3,"deposit":0})

        p0.moves.drawCard("0")

        p0.moves.playCard({"card":"F2405","idx":1,"playerID":"0","res":0})

        p0.moves.chooseEffect({"effect":{"e":"step","a":[{"e":"res","a":1},{"e":"update","a":1}]},"idx":0,"p":"0"})

        p0.moves.updateSlot("F3207")

        p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.buyCard({"buyer":"0","target":"F2403","resource":8,"deposit":0,"helper":[]})

        p0.moves.requestEndTurn("0");

        p0.moves.chooseEvent({"event":"E08","idx":0,"p":"0"})



        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})

        p1.moves.playCard({"card":"P2105","idx":1,"playerID":"1","res":0})

        p1.moves.comment({"target":"S3101","comment":"B04","p":"1"})

        p1.moves.chooseTarget({"target":"0","idx":2,"p":"1","targetName":"Red"})

        p1.moves.playCard({"card":"P2202","idx":1,"playerID":"1","res":0})

        p1.moves.chooseHand({"hand":"B01","idx":2,"p":"1"})

        p1.moves.chooseEffect({"effect":{"e":"refactor","a":1},"idx":1,"p":"1"})

        p1.moves.chooseHand({"hand":"B04","idx":1,"p":"1"})

        p1.moves.chooseTarget({"target":"0","idx":2,"p":"1","targetName":"Red"})

        p1.moves.playCard({"card":"B05","idx":1,"playerID":"1","res":0})

        p1.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"1"})

        p1.undo()

        p1.undo()

        p1.moves.playCard({"card":"F2408","idx":0,"playerID":"1","res":0})

        p1.moves.updateSlot("P3203")

        p1.moves.buyCard({"buyer":"1","target":"S3201","resource":4,"deposit":5,"helper":["B05"]})

        p1.moves.drawCard("1")

        p1.moves.playCard({"card":"B04","idx":0,"playerID":"1","res":0})

        p1.moves.requestEndTurn("1");



        p2.moves.playCard({"card":"F2303","idx":1,"playerID":"2","res":0})

        p2.moves.chooseHand({"hand":"B07","idx":5,"p":"2"})

        p2.moves.chooseHand({"hand":"B07","idx":2,"p":"2"})

        p2.moves.playCard({"card":"F2305","idx":4,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B03","idx":3,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B05","idx":0,"playerID":"2","res":0})

        p2.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"2"})

        p2.moves.playCard({"card":"F2212","idx":2,"playerID":"2","res":0})

        p2.moves.comment({"target":"F3212","comment":"B04","p":"2"})

        p2.moves.buyCard({"buyer":"2","target":"F2404","resource":4,"deposit":3,"helper":[]})

        p2.undo()

        p2.moves.drawCard("2")

        p2.moves.playCard({"card":"B03","idx":2,"playerID":"2","res":0})

        p2.moves.playCard({"card":"P1101","idx":1,"playerID":"2","res":0})

        p2.moves.updateSlot("F3208")

        p2.moves.chooseTarget({"target":"0","idx":1,"p":"2","targetName":"Red"})

        p0.moves.chooseHand({"hand":"F1307","idx":0,"p":"0"})

        p2.moves.buyCard({"buyer":"2","target":"F2404","resource":6,"deposit":1,"helper":[]})

        p2.moves.requestEndTurn("2");

        p2.moves.chooseEvent({"event":"E07","idx":1,"p":"2"})

        p1.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"1"})

        p0.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"0"})

        p2.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"2"})



        p0.moves.playCard({"card":"F2206","idx":6,"playerID":"0","res":0})

        p0.moves.comment({"target":"F3408","comment":"B04","p":"0"})

        p0.moves.playCard({"card":"F2214","idx":7,"playerID":"0","res":0})

        p0.moves.playCard({"card":"F2208","idx":4,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B03","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"F2306","idx":3,"playerID":"0","res":0})

        p0.moves.chooseHand({"hand":"B04","idx":7,"p":"0"})

        p0.moves.breakthrough({"card":"B05","idx":3,"playerID":"0","res":2})

        p0.moves.chooseEffect({"effect":{"e":"industryBreakthrough","a":1},"idx":0,"p":"0"})

        p0.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"0"})

        p0.moves.payAdditionalCost({"res":2,"deposit":0})

        p0.moves.playCard({"card":"F2111","idx":3,"playerID":"0","res":0})

        p0.moves.chooseEffect({"effect":{"e":"industryAward","a":1},"idx":1,"p":"0"})

        p0.moves.playCard({"card":"B05","idx":6,"playerID":"0","res":0})

        p0.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"0"})

        p0.moves.playCard({"card":"F2405","idx":6,"playerID":"0","res":0})

        p0.moves.chooseEffect({"effect":{"e":"breakthroughResDeduct","a":2},"idx":1,"p":"0"})

        p0.moves.chooseHand({"hand":"V221","idx":4,"p":"0"})

        p0.moves.chooseEffect({"effect":{"e":"refactor","a":1},"idx":1,"p":"0"})

        p0.moves.chooseHand({"hand":"V122","idx":0,"p":"0"})

        p0.moves.chooseEffect({"effect":{"e":"aestheticsLevelUp","a":1},"idx":1,"p":"0"})

        p0.moves.playCard({"card":"F2403","idx":3,"playerID":"0","res":0})

        p0.moves.peek({"idx":0,"card":null,"p":"0","shownCards":["F1307","P2103","F2207"]})

        p0.moves.drawCard("0")

        p0.moves.playCard({"card":"F2207","idx":3,"playerID":"0","res":0})

        p0.moves.chooseHand({"hand":"V131","idx":1,"p":"0"})

        p0.undo()

        p0.undo()

        p0.undo()

        p0.moves.playCard({"card":"F2207","idx":3,"playerID":"0","res":0})

        p0.moves.chooseHand({"hand":"V131","idx":1,"p":"0"})

        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0})

        p0.moves.playCard({"card":"V232","idx":0,"playerID":"0","res":0})

        p0.moves.buyCard({"buyer":"0","target":"F3310","resource":6,"deposit":2,"helper":[]})

        p0.moves.requestEndTurn("0");



        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B03","idx":0,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0})

        p1.moves.drawCard("1")

        p1.moves.playCard({"card":"F2108","idx":2,"playerID":"1","res":0})

        p1.moves.playCard({"card":"V112","idx":2,"playerID":"1","res":0})

        p1.moves.playCard({"card":"F1208","idx":0,"playerID":"1","res":0})

        p1.moves.drawCard("1")

        p1.moves.playCard({"card":"F2113","idx":1,"playerID":"1","res":0})

        p1.moves.buyCard({"buyer":"1","target":"F3116","resource":7,"deposit":1,"helper":[]})

        p1.moves.playCard({"card":"B04","idx":0,"playerID":"1","res":0})

        p1.moves.requestEndTurn("1");



        p2.moves.playCard({"card":"P2302","idx":1,"playerID":"2","res":0})

        p2.moves.chooseTarget({"target":"0","idx":1,"p":"2","targetName":"Red"})

        p2.moves.chooseHand({"hand":"B04","idx":0,"p":"2"})

        p2.moves.playCard({"card":"F2410","idx":3,"playerID":"2","res":0})

        p2.moves.peek({"idx":0,"card":null,"p":"2","shownCards":["B07","B07"]})

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B07","idx":2,"playerID":"2","res":0})

        p2.moves.playCard({"card":"F2309","idx":0,"playerID":"2","res":0})

        p2.moves.chooseHand({"hand":"B04","idx":0,"p":"2"})

        p2.moves.chooseHand({"hand":"B07","idx":1,"p":"2"})

        p2.moves.playCard({"card":"B05","idx":1,"playerID":"2","res":0})

        p2.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"2"})

        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0})

        p2.moves.playCard({"card":"F2303","idx":0,"playerID":"2","res":0})

        p2.moves.chooseHand({"hand":"B07","idx":0,"p":"2"})

        p2.moves.chooseHand({"hand":"V241","idx":0,"p":"2"})

        p2.undo()

        p2.undo()

        p2.undo()

        p2.moves.breakthrough({"card":"F2303","idx":0,"playerID":"2","res":2})

        p2.moves.chooseEffect({"effect":{"e":"aestheticsBreakthrough","a":1},"idx":1,"p":"2"})

        p2.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"2"})

        p2.moves.payAdditionalCost({"res":1,"deposit":0})

        p2.moves.chooseEffect({"effect":{"e":"buildCinema","a":1},"idx":1,"p":"2"})

        p2.undo()

        p2.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"2"})

        p2.moves.payAdditionalCost({"res":1,"deposit":1})

        p2.moves.requestEndTurn("2");



        p0.moves.playCard({"card":"P2205","idx":4,"playerID":"0","res":0})

        p0.moves.comment({"target":"S3101","comment":null,"p":"0"})

        p0.moves.chooseTarget({"target":"1","idx":1,"p":"0","targetName":"Blue"})

        p0.moves.playCard({"card":"F2208","idx":8,"playerID":"0","res":0})

        p0.moves.playCard({"card":"F2111","idx":8,"playerID":"0","res":0})

        p0.moves.chooseEffect({"effect":{"e":"industryAward","a":1},"idx":1,"p":"0"})

        p0.moves.playCard({"card":"B03","idx":8,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B03","idx":3,"playerID":"0","res":0})

        p0.moves.playCard({"card":"P1202","idx":4,"playerID":"0","res":0})

        p0.moves.chooseTarget({"target":"2","idx":2,"p":"0","targetName":"Green"})

        p2.moves.chooseHand({"hand":"F2404","idx":3,"p":"2"})

        p0.moves.playCard({"card":"B07","idx":4,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":5,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})

        p0.moves.breakthrough({"card":"V242","idx":1,"playerID":"0","res":2})

        p0.moves.playCard({"card":"V211","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B04","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B04","idx":0,"playerID":"0","res":0})

        p0.moves.buyCard({"buyer":"0","target":"S3101","resource":11,"deposit":1,"helper":[]})

        p0.moves.requestEndTurn("0");



        p1.moves.playCard({"card":"F2108","idx":4,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B07","idx":4,"playerID":"1","res":0})

        p1.moves.playCard({"card":"V112","idx":4,"playerID":"1","res":0})

        p1.moves.playCard({"card":"F2114","idx":1,"playerID":"1","res":0})

        p1.moves.comment({"target":"F3408","comment":null,"p":"1"})

        p1.moves.playCard({"card":"B03","idx":3,"playerID":"1","res":0})

        p1.moves.playCard({"card":"V222","idx":0,"playerID":"1","res":0})

        p1.moves.drawCard("1")

        p1.moves.playCard({"card":"P2105","idx":2,"playerID":"1","res":0})

        p1.moves.comment({"target":"F3212","comment":null,"p":"1"})

        p1.moves.chooseTarget({"target":"0","idx":2,"p":"1","targetName":"Red"})

        p1.moves.playCard({"card":"F2408","idx":3,"playerID":"1","res":0})

        p1.moves.comment({"target":"P3102","comment":"B04","p":"1"})

        p1.moves.peek({"idx":0,"card":null,"p":"1","shownCards":["B04","B04"]})

        p1.moves.buyCard({"buyer":"1","target":"P3203","resource":5,"deposit":5,"helper":[]})

        p1.moves.chooseEffect({"effect":{"e":"buy","a":"F3212"},"idx":1,"p":"1"})

        p1.moves.breakthrough({"card":"B01","idx":2,"playerID":"1","res":0})

        p1.moves.chooseEffect({"effect":{"e":"refactor","a":1},"idx":0,"p":"1"})

        p1.moves.chooseHand({"hand":"B04","idx":1,"p":"1"})

        p1.moves.playCard({"card":"B04","idx":0,"playerID":"1","res":0})

        p1.moves.requestEndTurn("1");



        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B03","idx":1,"playerID":"2","res":0})

        p2.moves.playCard({"card":"F2305","idx":2,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B03","idx":2,"playerID":"2","res":0})

        p2.moves.drawCard("2")

        p2.moves.playCard({"card":"P1101","idx":2,"playerID":"2","res":0})

        p2.moves.updateSlot("S3204")

        p2.moves.chooseTarget({"target":"0","idx":1,"p":"2","targetName":"Red"})

        p0.moves.chooseHand({"hand":"F1307","idx":8,"p":"0"})

        p2.moves.playCard({"card":"V241","idx":0,"playerID":"2","res":0})

        p2.moves.buyCard({"buyer":"2","target":"F3307","resource":7,"deposit":2,"helper":[]})

        p2.moves.requestEndTurn("2");



        p0.moves.playCard({"card":"F3310","idx":6,"playerID":"0","res":0})

        p0.moves.playCard({"card":"V232","idx":9,"playerID":"0","res":0})

        p0.moves.buyCard({"buyer":"0","target":"F3305","resource":4,"deposit":5,"helper":[]})

        p0.moves.confirmRespond("no")

        p0.moves.playCard({"card":"F2214","idx":7,"playerID":"0","res":0})

        p0.moves.playCard({"card":"F2403","idx":7,"playerID":"0","res":0})

        p0.moves.peek({"idx":0,"card":null,"p":"0","shownCards":["P1202","B04","V211"]})

        p0.moves.playCard({"card":"F2206","idx":6,"playerID":"0","res":0})

        p0.moves.comment({"target":"F3308","comment":"B04","p":"0"})

        p0.moves.playCard({"card":"F2208","idx":9,"playerID":"0","res":0})

        p0.moves.playCard({"card":"F2111","idx":9,"playerID":"0","res":0})

        p0.moves.chooseEffect({"effect":{"e":"industryAward","a":1},"idx":1,"p":"0"})

        p0.moves.playCard({"card":"F1307","idx":10,"playerID":"0","res":0})

        p0.moves.playCard({"card":"F2306","idx":1,"playerID":"0","res":0})

        p0.moves.chooseHand({"hand":"B04","idx":9,"p":"0"})

        p0.moves.playCard({"card":"P2205","idx":8,"playerID":"0","res":0})

        p0.moves.comment({"target":"F3408","comment":"B04","p":"0"})

        p0.moves.chooseTarget({"target":"1","idx":1,"p":"0","targetName":"Blue"})

        p0.moves.chooseEffect({"effect":{"e":"aestheticsLevelUp","a":1},"idx":1,"p":"0"})

        p0.moves.playCard({"card":"F3305","idx":8,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B03","idx":8,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B03","idx":7,"playerID":"0","res":0})

        p0.moves.playCard({"card":"F2405","idx":4,"playerID":"0","res":0})

        p0.moves.chooseEffect({"effect":{"e":"breakthroughResDeduct","a":2},"idx":1,"p":"0"})

        p0.moves.chooseHand({"hand":"B07","idx":4,"p":"0"})

        p0.moves.playCard({"card":"P2103","idx":2,"playerID":"0","res":0})

        p0.moves.chooseTarget({"target":"1","idx":1,"p":"0","targetName":"Blue"})

        p1.moves.chooseHand({"hand":"B07","idx":6,"p":"1"})

        p0.moves.playCard({"card":"F2207","idx":2,"playerID":"0","res":0})

        p0.moves.chooseHand({"hand":"B04","idx":2,"p":"0"})

        p0.moves.playCard({"card":"B05","idx":0,"playerID":"0","res":0})

        p0.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"0"})

        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B05","idx":1,"playerID":"0","res":0})

        p0.moves.chooseEffect({"effect":{"e":"aesAward","a":1},"idx":1,"p":"0"})

        p0.moves.playCard({"card":"B05","idx":0,"playerID":"0","res":0})

        p0.moves.chooseEffect({"effect":{"e":"aesAward","a":1},"idx":1,"p":"0"})

        p0.moves.buyCard({"buyer":"0","target":"F3109","resource":8,"deposit":0,"helper":[]})

        p0.moves.confirmRespond("yes")

        p0.moves.chooseRegion({"r":2,"idx":2,"p":"0"})

        p0.moves.requestEndTurn("0");



        p1.moves.playCard({"card":"P2202","idx":4,"playerID":"1","res":0})

        p1.moves.chooseHand({"hand":"B05","idx":4,"p":"1"})

        p1.moves.chooseEffect({"effect":{"e":"industryBreakthrough","a":1},"idx":0,"p":"1"})

        p1.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"1"})

        p1.moves.payAdditionalCost({"res":1,"deposit":0})

        p1.moves.chooseTarget({"target":"0","idx":2,"p":"1","targetName":"Red"})

        p1.moves.playCard({"card":"F2113","idx":0,"playerID":"1","res":0})

        p1.moves.playCard({"card":"V212","idx":0,"playerID":"1","res":0})

        p1.undo()

        p1.undo()

        p1.undo()

        p1.undo()

        p1.undo()

        p1.undo()

        p1.undo()

        p1.moves.chooseHand({"hand":"V212","idx":1,"p":"1"})

        p1.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"1"})

        p1.moves.payAdditionalCost({"res":1,"deposit":0})

        p1.moves.chooseTarget({"target":"0","idx":2,"p":"1","targetName":"Red"})

        p1.moves.drawCard("1")

        p1.moves.drawCard("1")

        p1.moves.playCard({"card":"F2113","idx":0,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B05","idx":2,"playerID":"1","res":0})

        p1.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"1"})

        p1.moves.playCard({"card":"B07","idx":3,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B05","idx":1,"playerID":"1","res":0})

        p1.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"1"})

        p1.moves.playCard({"card":"B07","idx":4,"playerID":"1","res":0})

        p1.moves.breakthrough({"card":"V121","idx":0,"playerID":"1","res":2})

        p1.moves.chooseEffect({"effect":{"e":"refactor","a":1},"idx":1,"p":"1"})

        p1.moves.chooseHand({"hand":"B04","idx":1,"p":"1"})

        p1.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"1"})

        p1.moves.playCard({"card":"B04","idx":0,"playerID":"1","res":0})

        p1.moves.playCard({"card":"B04","idx":0,"playerID":"1","res":0})

        p1.moves.requestEndTurn("1");



        p2.moves.playCard({"card":"F3307","idx":2,"playerID":"2","res":0})

        p2.moves.playCard({"card":"F2212","idx":1,"playerID":"2","res":0})

        p2.moves.comment({"target":"F3312","comment":"B03","p":"2"})

        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0})

        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0})

        p2.moves.drawCard("2")

        p2.moves.playCard({"card":"B07","idx":2,"playerID":"2","res":0})

        p2.moves.buyCard({"buyer":"2","target":"F3312","resource":7,"deposit":2,"helper":[]})

        p2.moves.requestEndTurn("2");

        p2.moves.chooseEvent({"event":"E10","idx":1,"p":"2"})



        p0.moves.playCard({"card":"F2208","idx":1,"playerID":"0","res":0})

        p0.moves.playCard({"card":"F1307","idx":8,"playerID":"0","res":0})

        p0.moves.playCard({"card":"P2205","idx":0,"playerID":"0","res":0})

        p0.moves.comment({"target":"F3408","comment":null,"p":"0"})

        p0.moves.chooseTarget({"target":"1","idx":1,"p":"0","targetName":"Blue"})

        p0.moves.playCard({"card":"F2403","idx":8,"playerID":"0","res":0})

        p0.moves.peek({"idx":0,"card":null,"p":"0","shownCards":["V211","F2214","B07"]})

        p0.moves.playCard({"card":"F2214","idx":8,"playerID":"0","res":0})

        p0.moves.playCard({"card":"F2111","idx":9,"playerID":"0","res":0})

        p0.moves.chooseEffect({"effect":{"e":"industryAward","a":1},"idx":1,"p":"0"})

        p0.moves.playCard({"card":"F3305","idx":10,"playerID":"0","res":0})

        p0.moves.playCard({"card":"F3310","idx":11,"playerID":"0","res":0})

        p0.moves.playCard({"card":"F2206","idx":9,"playerID":"0","res":0})

        p0.moves.comment({"target":"P3302","comment":"B04","p":"0"})

        p0.moves.playCard({"card":"F2306","idx":12,"playerID":"0","res":0})

        p0.moves.chooseHand({"hand":"B04","idx":6,"p":"0"})

        p0.moves.playCard({"card":"F3109","idx":8,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B05","idx":9,"playerID":"0","res":0})

        p0.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"0"})

        p0.moves.buyCard({"buyer":"0","target":"F3108","resource":13,"deposit":0,"helper":[]})

        p0.moves.confirmRespond("yes")

        p0.moves.chooseRegion({"r":3,"idx":2,"p":"0"})

        p0.moves.chooseRegion({"r":3,"idx":2,"p":"0"})

        p0.moves.playCard({"card":"B05","idx":7,"playerID":"0","res":0})

        p0.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"0"})

        p0.moves.playCard({"card":"B05","idx":4,"playerID":"0","res":0})

        p0.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"0"})

        p0.moves.playCard({"card":"F3108","idx":8,"playerID":"0","res":0})

        p0.moves.chooseEffect({"effect":{"e":"res","a":6},"idx":0,"p":"0"})

        p0.moves.playCard({"card":"F2405","idx":0,"playerID":"0","res":0})

        p0.moves.chooseEffect({"effect":{"e":"breakthroughResDeduct","a":2},"idx":1,"p":"0"})

        p0.moves.chooseHand({"hand":"V332","idx":8,"p":"0"})

        p0.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"0"})

        p0.moves.payAdditionalCost({"res":2,"deposit":0})

        p0.moves.playCard({"card":"B03","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B03","idx":3,"playerID":"0","res":0})

        p0.moves.playCard({"card":"F2207","idx":0,"playerID":"0","res":0})

        p0.moves.chooseHand({"hand":"P1202","idx":2,"p":"0"})

        p0.moves.playCard({"card":"V232","idx":0,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0})

        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0})

        p0.moves.buyCard({"buyer":"0","target":"F3408","resource":7,"deposit":0,"helper":[]})

        p0.moves.confirmRespond("yes")

        p0.moves.chooseRegion({"r":1,"idx":1,"p":"0"})}
        p0.moves.requestEndTurn("0")
    p0.stop();
    p1.stop();
    p2.stop();
})

