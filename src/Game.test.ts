import {Client} from 'boardgame.io/client';
import {Local} from 'boardgame.io/multiplayer'
import {FilmCentenaryGame} from './Game';

const gameWithSeed = (seed: string) => ({
    ...FilmCentenaryGame,
    seed
});

// @ts-ignore
it('should declare player 1 as the winner', () => {
    const spec = {
        numPlayers: 4,
        game: gameWithSeed("l2fp6gsf"),
        multiplayer: Local(),
    };

    const p0 = Client({...spec, playerID: '0'} as any) as any;
    const p1 = Client({...spec, playerID: '1'} as any) as any;
    const p2 = Client({...spec, playerID: '2'} as any) as any;
    const p3 = Client({...spec, playerID: '3'} as any) as any;

    p0.start();
    p1.start();
    p2.start();
    p3.start();
    {
        p0.moves.setupGameMode({"mode":"NORMAL","order":"ALL_RANDOM"});
        p0.moves.showBoardStatus({"regions":[{"normalDeckLength":2,"legendDeckLength":0,"completedModernScoring":false,"era":0,"buildings":[{"building":null,"region":0,"activated":true,"owner":""},{"building":null,"region":0,"activated":true,"owner":""},{"building":null,"region":0,"activated":false,"owner":""}],"legend":{"comment":null,"region":0,"isLegend":true,"card":"P1102"},"normal":[{"comment":null,"region":0,"isLegend":false,"card":"F1110"},{"comment":null,"region":0,"isLegend":false,"card":"F1109"},{"comment":null,"region":0,"isLegend":false,"card":"F1106"}],"share":6},{"normalDeckLength":2,"legendDeckLength":0,"completedModernScoring":false,"era":0,"buildings":[{"building":null,"region":1,"activated":true,"owner":""},{"building":null,"region":1,"activated":true,"owner":""}],"legend":{"comment":null,"region":1,"isLegend":true,"card":"P1201"},"normal":[{"comment":null,"region":1,"isLegend":false,"card":"F1206"},{"comment":null,"region":1,"isLegend":false,"card":"F1205"},{"comment":null,"region":1,"isLegend":false,"card":"F1211"}],"share":6},{"normalDeckLength":1,"legendDeckLength":0,"completedModernScoring":false,"era":0,"buildings":[{"building":null,"region":2,"activated":true,"owner":""},{"building":null,"region":2,"activated":false,"owner":""}],"legend":{"comment":null,"region":2,"isLegend":true,"card":"S1301"},"normal":[{"comment":null,"region":2,"isLegend":false,"card":"F1304"},{"comment":null,"region":2,"isLegend":false,"card":"F1305"}],"share":4},{"normalDeckLength":0,"legendDeckLength":0,"completedModernScoring":false,"era":0,"buildings":[{"building":null,"region":3,"activated":true,"owner":""},{"building":null,"region":3,"activated":false,"owner":""}],"legend":{"comment":null,"region":3,"isLegend":true,"card":null},"normal":[{"comment":null,"region":3,"isLegend":false,"card":null},{"comment":null,"region":3,"isLegend":false,"card":null}],"share":0}],"school":[],"film":[],"matchID":"2ZvEje8DpEI"});


        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.breakthrough({"card":"B02","idx":0,"playerID":"0","res":2});
        p0.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"0"});

        p0.moves.requestEndTurn("0");

        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.breakthrough({"card":"B01","idx":0,"playerID":"2","res":2});
        p2.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"2"});

        p2.moves.requestEndTurn("2");

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0});
        p1.moves.breakthrough({"card":"B01","idx":0,"playerID":"1","res":2});
        p1.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"1"});

        p1.moves.playCard({"card":"B02","idx":0,"playerID":"1","res":0});
        p1.moves.requestEndTurn("1");

        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"B03","resource":3,"deposit":0,"helper":[]});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.buyCard({"buyer":"0","target":"B02","resource":2,"deposit":0,"helper":[]});
        p0.moves.requestEndTurn("0");

        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.buyCard({"buyer":"2","target":"B03","resource":3,"deposit":0,"helper":[]});
        p2.moves.requestEndTurn("2");

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"F1205","resource":4,"deposit":0,"helper":[]});
        p1.moves.requestEndTurn("1");

        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"B01","idx":0,"playerID":"3","res":2});
        p3.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"3"});

        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0});
        p0.moves.breakthrough({"card":"B02","idx":1,"playerID":"0","res":2});
        p0.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"0"});

        p0.moves.playCard({"card":"B01","idx":0,"playerID":"0","res":0});
        p0.moves.requestEndTurn("0");

        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.buyCard({"buyer":"2","target":"F1211","resource":3,"deposit":0,"helper":[]});
        p2.moves.requestEndTurn("2");

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0});
        p1.moves.breakthrough({"card":"B02","idx":0,"playerID":"1","res":2});
        p1.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"1"});

        p1.moves.requestEndTurn("1");

        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"B02","idx":0,"playerID":"3","res":2});
        p3.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"3"});

        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.buyCard({"buyer":"0","target":"F1109","resource":5,"deposit":0,"helper":[]});
        p0.moves.requestEndTurn("0");

        p2.moves.playCard({"card":"B03","idx":2,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.breakthrough({"card":"B02","idx":0,"playerID":"2","res":2});
        p2.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"2"});

        p2.moves.requestEndTurn("2");

        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"F1106","resource":3,"deposit":0,"helper":[]});
        p1.moves.requestEndTurn("1");

        p3.moves.playCard({"card":"B03","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"F1107","resource":2,"deposit":0,"helper":[]});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"F1109","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.buyCard({"buyer":"0","target":"P1102","resource":5,"deposit":0,"helper":[]});
        p0.moves.requestEndTurn("0");

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.buyCard({"buyer":"2","target":"F1110","resource":4,"deposit":0,"helper":[]});
        p2.moves.requestEndTurn("2");
        p0.moves.chooseEvent({"event":"E02","idx":1,"p":"0"});
        p2.moves.chooseHand({"hand":"B07","idx":2,"p":"2"});
        p1.moves.chooseHand({"hand":"B07","idx":1,"p":"1"});
        p3.moves.chooseHand({"hand":"B07","idx":0,"p":"3"});
        p0.moves.chooseHand({"hand":"B07","idx":0,"p":"0"});


        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.breakthrough({"card":"F1205","idx":0,"playerID":"1","res":2});
        p1.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"1"});

        p1.moves.requestEndTurn("1");

        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"F1209","resource":2,"deposit":0,"helper":[]});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.breakthrough({"card":"B01","idx":0,"playerID":"0","res":2});
        p0.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"0"});

        p0.moves.requestEndTurn("0");

        p2.moves.playCard({"card":"F1211","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B03","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.buyCard({"buyer":"2","target":"S1301","resource":4,"deposit":4,"helper":[]});
        p2.moves.requestEndTurn("2");

        p1.moves.playCard({"card":"F1106","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"P1201","resource":5,"deposit":1,"helper":[]});
        p1.moves.requestEndTurn("1");

        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B03","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"S1204","resource":3,"deposit":3,"helper":["F1107"]});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.breakthrough({"card":"F1109","idx":0,"playerID":"0","res":2});
        p0.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"0"});
        p0.moves.payAdditionalCost({"res":1,"deposit":0});

        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand":"B07","idx":4,"p":"2"});

        p2.moves.playCard({"card":"F1211","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.undo();
        p2.moves.drawCard("2");
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"V112","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.buyCard({"buyer":"2","target":"F1305","resource":5,"deposit":0,"helper":[]});
        p2.moves.requestEndTurn("2");

        p1.moves.playCard({"card":"F1106","idx":3,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"V113","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"F1206","resource":2,"deposit":0,"helper":[]});
        p1.moves.requestEndTurn("1");
        p1.moves.chooseEvent({"event":"E04","idx":0,"p":"1"});


        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"B04","idx":1,"playerID":"3","res":2});
        p3.moves.breakthrough({"card":"F1107","idx":0,"playerID":"3","res":2});
        p3.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"3"});

        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.breakthrough({"card":"V111","idx":1,"playerID":"0","res":2});
        p0.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"0"});
        p0.moves.payAdditionalCost({"res":1,"deposit":0});

        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand":"B07","idx":0,"p":"2"});

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B03","idx":0,"playerID":"2","res":0});
        p2.moves.breakthrough({"card":"F1110","idx":0,"playerID":"2","res":2});
        p2.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"2"});

        p2.moves.playCard({"card":"V112","idx":0,"playerID":"2","res":0});
        p2.undo();
        p2.undo();
        p2.undo();
        p2.moves.breakthrough({"card":"V112","idx":1,"playerID":"2","res":2});
        p2.moves.breakthrough({"card":"F1110","idx":0,"playerID":"2","res":1});
        p2.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"2"});

        p2.moves.requestEndTurn("2");

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.breakthrough({"card":"P1201","idx":0,"playerID":"1","res":2});
        p1.moves.requestEndTurn("1");

        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"B07","idx":0,"playerID":"3","res":2});
        p3.moves.breakthrough({"card":"F1209","idx":0,"playerID":"3","res":1});
        p3.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"3"});

        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.buyCard({"buyer":"0","target":"F1307","resource":3,"deposit":0,"helper":[]});
        p0.moves.playCard({"card":"P1102","idx":0,"playerID":"0","res":0});
        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand":"B07","idx":1,"p":"2"});

        p2.moves.playCard({"card":"F1305","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"V123","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.undo();
        p2.undo();
        p2.undo();
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.breakthrough({"card":"V123","idx":0,"playerID":"2","res":2});
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.breakthrough({"card":"B05","idx":0,"playerID":"2","res":2});
        p2.moves.chooseEffect({"effect":{"e":"industryBreakthrough","a":1},"idx":0,"p":"2"});

        p2.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"2"});

        p2.moves.requestEndTurn("2");

        p1.moves.playCard({"card":"B05","idx":2,"playerID":"1","res":0});
        p1.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"1"});

        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"V113","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"V121","idx":1,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"F1304","resource":3,"deposit":0,"helper":[]});
        p1.moves.requestEndTurn("1");
        p2.moves.chooseEvent({"event":"E03","idx":0,"p":"2"});


        p3.moves.playCard({"card":"B03","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"B07","idx":0,"playerID":"3","res":2});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"F2211","resource":3,"deposit":1,"helper":[]});
        p3.moves.requestEndTurn("3");

        p0.moves.drawCard("0");
        p0.moves.playCard({"card":"B07","idx":5,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0});
        p0.moves.breakthrough({"card":"B05","idx":0,"playerID":"0","res":2});
        p0.moves.chooseEffect({"effect":{"e":"industryBreakthrough","a":1},"idx":0,"p":"0"});

        p0.moves.chooseEffect({"effect":{"e":"buildStudio","a":1},"idx":2,"p":"0"});

        p0.moves.chooseRegion({"r":0,"idx":0,"p":"0"});
        p0.moves.payAdditionalCost({"res":3,"deposit":0});

        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand":"B07","idx":1,"p":"2"});

        p2.moves.drawCard("2");
        p2.moves.playCard({"card":"B07","idx":4,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":2,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F1211","idx":0,"playerID":"2","res":0});
        p2.undo();
        p2.moves.buyCard({"buyer":"2","target":"F2212","resource":4,"deposit":0,"helper":["F1211"]});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.requestEndTurn("2");

        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.breakthrough({"card":"B02","idx":0,"playerID":"1","res":2});
        p1.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"1"});

        p1.moves.drawCard("1");
        p1.moves.playCard({"card":"B03","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.requestEndTurn("1");

        p3.moves.playCard({"card":"B07","idx":2,"playerID":"3","res":0});
        p3.moves.playCard({"card":"V122","idx":1,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"B07","idx":0,"playerID":"3","res":2});
        p3.moves.breakthrough({"card":"B05","idx":0,"playerID":"3","res":2});
        p3.moves.chooseEffect({"effect":{"e":"aestheticsBreakthrough","a":1},"idx":1,"p":"3"});

        p3.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"3"});

        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"F1307","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"P1102","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.breakthrough({"card":"B04","idx":0,"playerID":"0","res":2});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.breakthrough({"card":"B07","idx":0,"playerID":"0","res":2});
        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand":"B07","idx":1,"p":"2"});

        p2.moves.drawCard("2");
        p2.moves.playCard({"card":"B03","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":2,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F2212","idx":2,"playerID":"2","res":0});
        p2.moves.comment({"target":"F2114","comment":"B02","p":"2"});

        p2.moves.playCard({"card":"F1305","idx":0,"playerID":"2","res":0});
        p2.moves.chooseHand({"hand":"B07","idx":0,"p":"2"});

        p2.moves.buyCard({"buyer":"2","target":"F2114","resource":5,"deposit":1,"helper":[]});
        p2.moves.requestEndTurn("2");

        p1.moves.playCard({"card":"F1106","idx":2,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.undo();
        p1.moves.playCard({"card":"B03","idx":2,"playerID":"1","res":0});
        p1.undo();
        p1.moves.breakthrough({"card":"F1206","idx":1,"playerID":"1","res":2});
        p1.undo();
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B03","idx":1,"playerID":"1","res":0});
        p1.moves.drawCard("1");
        p1.moves.playCard({"card":"F1304","idx":1,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"P2202","resource":5,"deposit":4,"helper":["F1206"]});
        p1.moves.chooseEffect({"effect":{"e":"buy","a":"F2209","target":"1"},"idx":1,"p":"1"});

        p1.moves.requestEndTurn("1");

        p3.moves.playCard({"card":"B03","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.drawCard("3");
        p3.moves.breakthrough({"card":"F2211","idx":0,"playerID":"3","res":2});
        p3.moves.comment({"target":"F2304","comment":"B04","p":"3"});
        p3.moves.chooseEffect({"effect":{"e":"industryBreakthrough","a":1},"idx":0,"p":"3"});

        p3.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"3"});

        p3.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"3"});
        p3.moves.payAdditionalCost({"res":1,"deposit":0});

        p3.moves.playCard({"card":"V122","idx":0,"playerID":"3","res":0});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.drawCard("0");
        p0.moves.playCard({"card":"F1307","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.buyCard({"buyer":"0","target":"P2102","resource":6,"deposit":2,"helper":[]});
        p0.moves.chooseEffect({"effect":{"e":"buy","a":"F2107","target":"0"},"idx":1,"p":"0"});

        p0.moves.playCard({"card":"B04","idx":0,"playerID":"0","res":0});
        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand":"B07","idx":1,"p":"2"});

        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.breakthrough({"card":"V131","idx":0,"playerID":"2","res":2});
        p2.moves.breakthrough({"card":"F1211","idx":0,"playerID":"2","res":2});
        p2.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"2"});

        p2.moves.requestEndTurn("2");

        p1.moves.playCard({"card":"B05","idx":0,"playerID":"1","res":0});
        p1.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"1"});

        p1.moves.drawCard("1");
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.breakthrough({"card":"V132","idx":0,"playerID":"1","res":2});
        p1.moves.requestEndTurn("1");

        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"V122","idx":2,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"B04","idx":0,"playerID":"3","res":2});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"B03","resource":3,"deposit":0,"helper":[]});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"P2102","idx":4,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"addCompetitionPower","a":1},"idx":1,"p":"0"});
        p0.moves.chooseTarget({"target":"2","idx":0,"p":"0","targetName":"P3"});

        p0.moves.playCard({"card":"F2107","idx":4,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0});
        p0.undo();
        p0.moves.playCard({"card":"P1102","idx":0,"playerID":"0","res":0});
        p0.undo();
        p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0});
        p0.moves.breakthrough({"card":"P1102","idx":0,"playerID":"0","res":2});
        p0.undo();
        p0.moves.playCard({"card":"P1102","idx":0,"playerID":"0","res":0});
        p0.moves.drawCard("0");
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.buyCard({"buyer":"0","target":"F2106","resource":7,"deposit":0,"helper":["B02"]});
        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand":"B07","idx":3,"p":"2"});

        p2.moves.playCard({"card":"F2114","idx":3,"playerID":"2","res":0});
        p2.moves.breakthrough({"card":"B02","idx":2,"playerID":"2","res":2});
        p2.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"2"});

        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.breakthrough({"card":"B07","idx":0,"playerID":"2","res":2});
        p2.moves.requestEndTurn("2");

        p1.moves.playCard({"card":"B07","idx":3,"playerID":"1","res":0});
        p1.moves.drawCard("1");
        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0});
        p1.moves.breakthrough({"card":"V121","idx":1,"playerID":"1","res":2});
        p1.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"1"});

        p1.moves.requestEndTurn("1");

        p3.moves.drawCard("3");
        p3.moves.playCard({"card":"B03","idx":4,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":3,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":2,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B03","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"S2301","resource":6,"deposit":3,"helper":[]});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"B07","idx":4,"playerID":"0","res":0});
        p0.moves.breakthrough({"card":"B04","idx":0,"playerID":"0","res":2});
        p0.moves.breakthrough({"card":"F1307","idx":0,"playerID":"0","res":1});
        p0.moves.chooseHand({"hand":"B07","idx":0,"p":"0"});
        p0.moves.chooseHand({"hand":"B07","idx":0,"p":"0"});

        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand":"B07","idx":3,"p":"2"});

        p2.moves.drawCard("2");
        p2.moves.playCard({"card":"F2114","idx":4,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B03","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F2212","idx":2,"playerID":"2","res":0});
        p2.moves.comment({"target":"F2407","comment":"B02","p":"2"});

        p2.moves.buyCard({"buyer":"2","target":"F2407","resource":6,"deposit":0,"helper":[]});
        p2.moves.playCard({"card":"F1305","idx":0,"playerID":"2","res":0});
        p2.moves.chooseHand({"hand":"B07","idx":0,"p":"2"});

        p2.moves.requestEndTurn("2");

        p1.moves.playCard({"card":"F1106","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B05","idx":3,"playerID":"1","res":0});
        p1.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"1"});

        p1.moves.playCard({"card":"F2209","idx":3,"playerID":"1","res":0});
        p1.moves.breakthrough({"card":"V113","idx":0,"playerID":"1","res":2});
        p1.moves.breakthrough({"card":"F1206","idx":0,"playerID":"1","res":2});
        p1.moves.chooseHand({"hand":"B07","idx":0,"p":"1"});

        p1.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"1"});

        p1.moves.requestEndTurn("1");

        p3.moves.playCard({"card":"B03","idx":4,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":3,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":2,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.drawCard("3");
        p3.moves.playCard({"card":"B03","idx":1,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"V122","idx":0,"playerID":"3","res":2});
        p3.moves.buyCard({"buyer":"3","target":"F2214","resource":5,"deposit":2,"helper":[]});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"P2102","idx":3,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"addCompetitionPower","a":1},"idx":1,"p":"0"});
        p0.moves.chooseTarget({"target":"2","idx":0,"p":"0","targetName":"P3"});

        p0.moves.playCard({"card":"F2107","idx":4,"playerID":"0","res":0});
        p0.moves.playCard({"card":"F2106","idx":0,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"shareNA","a":1},"idx":1,"p":"0"});

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"P1102","idx":1,"playerID":"0","res":0});
        p0.moves.breakthrough({"card":"B07","idx":0,"playerID":"0","res":2});
        p0.moves.buyCard({"buyer":"0","target":"F2111","resource":7,"deposit":2,"helper":[]});
        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand":"B07","idx":0,"p":"2"});

        p2.moves.drawCard("2");
        p2.moves.drawCard("2");
        p2.moves.playCard({"card":"F2114","idx":5,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F1305","idx":2,"playerID":"2","res":0});
        p2.moves.chooseHand({"hand":"B07","idx":0,"p":"2"});

        p2.moves.playCard({"card":"F2407","idx":0,"playerID":"2","res":0});
        p2.moves.chooseHand({"hand":"B02","idx":0,"p":"2"});

        p2.moves.chooseEffect({"effect":{"e":"buildStudio","a":1},"idx":2,"p":"2"});

        p2.moves.chooseRegion({"r":0,"idx":0,"p":"2"});
        p2.moves.payAdditionalCost({"res":3,"deposit":0});
        p2.moves.updateSlot({"slot":{"comment":null,"region":2,"isLegend":false,"card":"F2306"},"p":"2","cardId":"F2306","updateHistoryIndex":0});

        p2.moves.requestEndTurn("2");

        p1.moves.drawCard("1");
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"P2202","idx":1,"playerID":"1","res":0});
        p1.moves.chooseHand({"hand":"F1304","idx":0,"p":"1"});
        p1.moves.comment({"target":"S2104","comment":"B04","p":"1"});

        p1.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"1"});
        p1.moves.payAdditionalCost({"res":1,"deposit":0});
        p1.moves.chooseTarget({"target":"2","idx":3,"p":"1","targetName":"P3"});

        p1.moves.buyCard({"buyer":"1","target":"B03","resource":3,"deposit":0,"helper":[]});
        p1.moves.requestEndTurn("1");
        p1.moves.chooseEffect({"effect":{"e":"aestheticsLevelUp","a":1},"idx":1,"p":"1"});


        p3.moves.drawCard("3");
        p3.moves.playCard({"card":"F2214","idx":4,"playerID":"3","res":0});
        p3.moves.chooseEffect({"effect":{"e":"addCompetitionPower","a":1},"idx":0,"p":"3"});

        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B03","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B03","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"P2401","resource":8,"deposit":0,"helper":[]});
        p3.moves.buyCard({"buyer":"3","target":"B02","resource":1,"deposit":1,"helper":[]});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"F2111","idx":2,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"industryAward","a":1},"idx":1,"p":"0"});

        p0.moves.playCard({"card":"B07","idx":4,"playerID":"0","res":0});
        p0.moves.playCard({"card":"F2106","idx":3,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"step","a":[{"e":"addCompetitionPower","a":1},{"e":"optional","a":{"e":"competition","a":{"bonus":0,"onWin":{"e":"none","a":1}}}}]},"idx":0,"p":"0"});
        p0.moves.confirmRespond("no");

        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.breakthrough({"card":"B02","idx":0,"playerID":"0","res":2});
        p0.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"0"});
        p0.moves.payAdditionalCost({"res":1,"deposit":0});

        p0.moves.playCard({"card":"P1102","idx":0,"playerID":"0","res":0});
        p0.moves.buyCard({"buyer":"0","target":"F2303","resource":5,"deposit":2,"helper":[]});
        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand":"B07","idx":4,"p":"2"});

        p2.moves.drawCard("2");
        p2.moves.playCard({"card":"B03","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F2212","idx":0,"playerID":"2","res":0});
        p2.moves.comment({"target":"F2304","comment":null,"p":"2"});

        p2.moves.playCard({"card":"F2407","idx":0,"playerID":"2","res":0});
        p2.moves.chooseHand({"hand":"B07","idx":1,"p":"2"});
        p2.undo();
        p2.undo();
        p2.moves.playCard({"card":"F2407","idx":0,"playerID":"2","res":0});
        p2.moves.chooseHand({"hand":"B07","idx":1,"p":"2"});
        p2.moves.updateSlot({"slot":{"comment":null,"region":1,"isLegend":false,"card":"F2210"},"p":"2","cardId":"F2210","updateHistoryIndex":1});

        p2.moves.buyCard({"buyer":"2","target":"F2304","resource":4,"deposit":2,"helper":["F1305"]});
        p2.moves.requestEndTurn("2");

        p1.moves.playCard({"card":"F1106","idx":3,"playerID":"1","res":0});
        p1.moves.drawCard("1");
        p1.moves.playCard({"card":"B07","idx":3,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B03","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B03","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B05","idx":1,"playerID":"1","res":0});
        p1.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"1"});

        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"S2201","resource":6,"deposit":2,"helper":[]});
        p1.moves.requestEndTurn("1");

        p3.moves.playCard({"card":"B03","idx":4,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B03","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"B02","idx":1,"playerID":"3","res":2});
        p3.moves.chooseEffect({"effect":{"e":"buildStudio","a":1},"idx":2,"p":"3"});

        p3.moves.chooseRegion({"r":3,"idx":2,"p":"3"});
        p3.moves.payAdditionalCost({"res":2,"deposit":1});

        p3.moves.playCard({"card":"P2401","idx":0,"playerID":"3","res":0});
        p3.moves.chooseTarget({"target":"2","idx":1,"p":"3","targetName":"P3"});
        p3.moves.peek({"idx":0,"card":"F2214","p":"3","shownCards":["F2214","B07","B07"]});

        p3.moves.playCard({"card":"F2214","idx":0,"playerID":"3","res":0});
        p3.moves.chooseEffect({"effect":{"e":"addCompetitionPower","a":1},"idx":0,"p":"3"});

        p3.moves.buyCard({"buyer":"3","target":"F2308","resource":3,"deposit":2,"helper":[]});
        p3.undo();
        p3.moves.drawCard("3");
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"F2308","resource":4,"deposit":1,"helper":[]});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"P2102","idx":0,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"addCompetitionPower","a":1},"idx":1,"p":"0"});
        p0.moves.chooseTarget({"target":"3","idx":1,"p":"0","targetName":"P4"});

        p0.moves.playCard({"card":"F2107","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"F2111","idx":1,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"industryAward","a":1},"idx":1,"p":"0"});

        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.breakthrough({"card":"P1102","idx":1,"playerID":"0","res":2});
        p0.moves.breakthrough({"card":"F2303","idx":0,"playerID":"0","res":2});
        p0.moves.chooseEffect({"effect":{"e":"industryBreakthrough","a":1},"idx":0,"p":"0"});

        p0.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"0"});
        p0.moves.payAdditionalCost({"res":2,"deposit":0});

        p0.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"0"});

        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand":"B07","idx":1,"p":"2"});

        p2.moves.playCard({"card":"F2304","idx":3,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B03","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F2114","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F2407","idx":2,"playerID":"2","res":0});
        p2.moves.chooseHand({"hand":"F1305","idx":0,"p":"2"});

        p2.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"2"});
        p2.moves.payAdditionalCost({"res":1,"deposit":0});
        p2.moves.updateSlot({"slot":{"comment":null,"region":3,"isLegend":false,"card":"F2408"},"p":"2","cardId":"F2408","updateHistoryIndex":2});

        p2.moves.drawCard("2");
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F2212","idx":0,"playerID":"2","res":0});
        p2.moves.comment({"target":"P2105","comment":"B01","p":"2"});

        p2.moves.buyCard({"buyer":"2","target":"P2105","resource":7,"deposit":0,"helper":[]});
        p2.moves.requestEndTurn("2");
        p2.moves.chooseEffect({"effect":{"e":"aestheticsLevelUp","a":1},"idx":1,"p":"2"});


        p1.moves.playCard({"card":"P2202","idx":0,"playerID":"1","res":0});
        p1.moves.chooseHand({"hand":"B07","idx":0,"p":"1"});
        p1.moves.chooseTarget({"target":"2","idx":3,"p":"1","targetName":"P3"});

        p1.moves.playCard({"card":"F2209","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"F2403","resource":4,"deposit":0,"helper":[]});
        p1.moves.buyCard({"buyer":"1","target":"F2307","resource":1,"deposit":1,"helper":[]});
        p1.moves.requestEndTurn("1");

        p3.moves.playCard({"card":"F2214","idx":3,"playerID":"3","res":0});
        p3.moves.chooseEffect({"effect":{"e":"addCompetitionPower","a":1},"idx":0,"p":"3"});

        p3.moves.playCard({"card":"B07","idx":2,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B03","idx":2,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.drawCard("3");
        p3.moves.playCard({"card":"F2308","idx":1,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"F2210","resource":7,"deposit":0,"helper":[]});
        p3.moves.playCard({"card":"P2401","idx":0,"playerID":"3","res":0});
        p3.moves.chooseTarget({"target":"0","idx":0,"p":"3","targetName":"P1"});
        p3.moves.peek({"idx":2,"card":"F2210","p":"3","shownCards":["B03","B07","F2210"]});

        p3.moves.playCard({"card":"F2210","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B03","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"B02","resource":2,"deposit":0,"helper":[]});
        p3.moves.requestEndTurn("3");
        p1.moves.chooseEvent({"event":"E06","idx":0,"p":"1"});


        p0.moves.playCard({"card":"F2106","idx":0,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"step","a":[{"e":"addCompetitionPower","a":1},{"e":"optional","a":{"e":"competition","a":{"bonus":0,"onWin":{"e":"none","a":1}}}}]},"idx":0,"p":"0"});
        p0.moves.confirmRespond("no");

        p0.moves.playCard({"card":"P2102","idx":2,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"addCompetitionPower","a":1},"idx":1,"p":"0"});
        p0.moves.chooseTarget({"target":"3","idx":1,"p":"0","targetName":"P4"});

        p0.moves.playCard({"card":"F2107","idx":2,"playerID":"0","res":0});
        p0.moves.buyCard({"buyer":"0","target":"P2103","resource":8,"deposit":0,"helper":[]});
        p0.moves.playCard({"card":"F2111","idx":0,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"industryAward","a":1},"idx":1,"p":"0"});

        p0.moves.playCard({"card":"P2103","idx":3,"playerID":"0","res":0});
        p0.moves.chooseTarget({"target":"1","idx":0,"p":"0","targetName":"P2"});
        p1.moves.chooseHand({"hand":"B07","idx":1,"p":"1"});

        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.breakthrough({"card":"B04","idx":0,"playerID":"0","res":2});
        p0.moves.requestEndTurn("0");
        p0.moves.chooseEvent({"event":"E08","idx":1,"p":"0"});
        p3.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"3"});


        p2.moves.chooseHand({"hand":"B07","idx":0,"p":"2"});

        p2.moves.playCard({"card":"F2304","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B03","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F2407","idx":1,"playerID":"2","res":0});
        p2.moves.chooseHand({"hand":"B01","idx":2,"p":"2"});

        p2.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"2"});
        p2.moves.payAdditionalCost({"res":2,"deposit":0});
        p2.moves.updateSlot({"slot":{"comment":null,"region":0,"isLegend":false,"card":"F3113"},"p":"2","cardId":"F3113","updateHistoryIndex":3});

        p2.moves.playCard({"card":"P2105","idx":0,"playerID":"2","res":0});
        p2.moves.chooseTarget({"target":"1","idx":0,"p":"2","targetName":"P2"});

        p2.moves.playCard({"card":"F2114","idx":1,"playerID":"2","res":0});
        p2.moves.comment({"target":"F3110","comment":"B04","p":"2"});

        p2.moves.drawCard("2");
        p2.moves.playCard({"card":"V223","idx":2,"playerID":"2","res":0});
        p2.moves.playCard({"card":"V212","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F2212","idx":0,"playerID":"2","res":0});
        p2.undo();
        p2.moves.buyCard({"buyer":"2","target":"F3212","resource":3,"deposit":3,"helper":["F2212"]});
        p2.moves.requestEndTurn("2");

        p1.moves.playCard({"card":"P2202","idx":0,"playerID":"1","res":0});
        p1.moves.chooseHand({"hand":"B04","idx":3,"p":"1"});
        p1.moves.chooseTarget({"target":"0","idx":2,"p":"1","targetName":"P1"});

        p1.moves.playCard({"card":"F2307","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B03","idx":0,"playerID":"1","res":0});
        p1.moves.breakthrough({"card":"F1106","idx":0,"playerID":"1","res":2});
        p1.moves.buyCard({"buyer":"1","target":"F2411","resource":2,"deposit":2,"helper":[]});
        p1.moves.requestEndTurn("1");

        p3.moves.playCard({"card":"F2308","idx":4,"playerID":"3","res":0});
        p3.moves.playCard({"card":"F2210","idx":0,"playerID":"3","res":0});
        p3.moves.chooseEffect({"effect":{"e":"draw","a":2},"idx":0,"p":"3"});

        p3.moves.playCard({"card":"F2214","idx":4,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B03","idx":4,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":3,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B03","idx":2,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"B02","idx":0,"playerID":"3","res":2});
        p3.moves.chooseEffect({"effect":{"e":"buildCinema","a":1},"idx":2,"p":"3"});

        p3.moves.chooseRegion({"r":2,"idx":1,"p":"3"});
        p3.moves.payAdditionalCost({"res":3,"deposit":0});

        p3.moves.buyCard({"buyer":"3","target":"F2408","resource":0,"deposit":5,"helper":[]});
        p3.undo();
        p3.moves.drawCard("3");
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"F2408","resource":1,"deposit":4,"helper":[]});
        p3.moves.requestEndTurn("3");
        p3.moves.chooseEvent({"event":"E09","idx":1,"p":"3"});
        p3.moves.chooseEvent({"event":"E05","idx":0,"p":"3"});


        p0.moves.playCard({"card":"F2106","idx":4,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"optional","a":{"e":"competition","a":{"bonus":0,"onWin":{"e":"none","a":1}}}},"idx":1,"p":"0"});
        p0.moves.confirmRespond("yes");
        p0.moves.chooseTarget({"target":"2","idx":0,"p":"0","targetName":"P3"});
        p0.moves.showCompetitionResult({"info":{"region":4,"atk":"0","atkPlayedCard":false,"atkCard":null,"def":"2","defPlayedCard":false,"defShownCards":[],"defCard":null,"progress":5,"pending":true,"onWin":{"e":"none","a":1}}});
        p0.moves.chooseRegion({"r":1,"idx":0,"p":"0"});

        p0.moves.playCard({"card":"P2102","idx":3,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"addCompetitionPower","a":1},"idx":1,"p":"0"});
        p0.moves.chooseTarget({"target":"3","idx":1,"p":"0","targetName":"P4"});

        p0.moves.changePlayerSetting({"classicFilmAutoMoveMode":"DRAW_CARD"});
        p0.moves.playCard({"card":"B05","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":3,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"P2103","idx":1,"playerID":"0","res":0});
        p0.moves.chooseTarget({"target":"3","idx":1,"p":"0","targetName":"P4"});
        p3.moves.chooseHand({"hand":"B04","idx":5,"p":"3"});

        p0.moves.playCard({"card":"F2111","idx":2,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"industryAward","a":1},"idx":1,"p":"0"});

        p0.moves.playCard({"card":"F2107","idx":2,"playerID":"0","res":0});
        p0.moves.breakthrough({"card":"B04","idx":0,"playerID":"0","res":2});
        p0.moves.buyCard({"buyer":"0","target":"F3104","resource":6,"deposit":3,"helper":["B05","B05"]});
        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand":"B04","idx":2,"p":"2"});

        p2.moves.playCard({"card":"F3212","idx":2,"playerID":"2","res":0});
        p2.moves.chooseHand({"hand":"B07","idx":1,"p":"2"});
        p2.moves.chooseHand({"hand":"B03","idx":1,"p":"2"});
        p2.moves.chooseHand({"hand":"V223","idx":2,"p":"2"});

        p2.moves.drawCard("2");
        p2.moves.playCard({"card":"F2407","idx":2,"playerID":"2","res":0});
        p2.moves.chooseHand({"hand":"F2212","idx":1,"p":"2"});

        p2.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"2"});
        p2.moves.payAdditionalCost({"res":2,"deposit":0});
        p2.moves.updateSlot({"slot":{"comment":null,"region":0,"isLegend":true,"card":"P3102"},"p":"2","cardId":"P3102","updateHistoryIndex":4});

        p2.moves.playCard({"card":"P2105","idx":1,"playerID":"2","res":0});
        p2.moves.chooseTarget({"target":"3","idx":1,"p":"2","targetName":"P4"});

        p2.moves.playCard({"card":"F2304","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F2114","idx":2,"playerID":"2","res":0});
        p2.moves.comment({"target":"P3401","comment":"B04","p":"2"});

        p2.moves.playCard({"card":"V212","idx":1,"playerID":"2","res":0});
        p2.moves.breakthrough({"card":"B04","idx":1,"playerID":"2","res":2});
        p2.moves.playCard({"card":"B05","idx":0,"playerID":"2","res":0});
        p2.moves.chooseEffect({"effect":{"e":"aesAward","a":1},"idx":1,"p":"2"});

        p2.moves.requestEndTurn("2");

        p1.moves.playCard({"card":"B03","idx":5,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B05","idx":0,"playerID":"1","res":0});
        p1.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"1"});

        p1.moves.playCard({"card":"F2403","idx":3,"playerID":"1","res":0});
        p1.moves.peek({"idx":0,"card":null,"p":"1","shownCards":["B04","F2307","B04"]});

        p1.moves.playCard({"card":"P2202","idx":3,"playerID":"1","res":0});
        p1.moves.chooseHand({"hand":"B07","idx":0,"p":"1"});
        p1.moves.chooseTarget({"target":"0","idx":2,"p":"1","targetName":"P1"});

        p1.moves.playCard({"card":"F2209","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"F2307","idx":0,"playerID":"1","res":0});
        p1.moves.chooseEffect({"effect":{"e":"aestheticsLevelUp","a":1},"idx":1,"p":"1"});
        p1.moves.comment({"target":"P3401","comment":null,"p":"1"});

        p1.moves.drawCard("1");
        p1.moves.buyCard({"buyer":"1","target":"F3413","resource":5,"deposit":0,"helper":[]});
        p1.moves.requestEndTurn("1");

        p3.moves.playCard({"card":"F2308","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"F2408","idx":3,"playerID":"3","res":0});
        p3.moves.peek({"idx":2,"card":null,"p":"3","shownCards":["B07","B07"]});

        p3.moves.playCard({"card":"B03","idx":3,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B05","idx":2,"playerID":"3","res":0});
        p3.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"3"});

        p3.moves.playCard({"card":"B03","idx":4,"playerID":"3","res":0});
        p3.moves.playCard({"card":"P2401","idx":0,"playerID":"3","res":0});
        p3.moves.chooseTarget({"target":"0","idx":0,"p":"3","targetName":"P1"});
        p3.moves.peek({"idx":1,"card":"F2210","p":"3","shownCards":["B07","F2210","F2214"]});

        p3.moves.playCard({"card":"F2210","idx":3,"playerID":"3","res":0});
        p3.moves.chooseEffect({"effect":{"e":"draw","a":2},"idx":0,"p":"3"});

        p3.moves.playCard({"card":"V222","idx":0,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"B04","idx":0,"playerID":"3","res":2});
        p3.moves.breakthrough({"card":"B04","idx":0,"playerID":"3","res":2});
        p3.moves.buyCard({"buyer":"3","target":"P3401","resource":3,"deposit":8,"helper":[]});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.undo();
        p3.undo();
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"P3401","resource":4,"deposit":7,"helper":[]});
        p3.moves.playCard({"card":"B04","idx":0,"playerID":"3","res":0});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"B05","idx":3,"playerID":"0","res":0});
        p0.moves.drawCard("0");
        p0.moves.playCard({"card":"F2111","idx":7,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"industryAward","a":1},"idx":1,"p":"0"});

        p0.moves.playCard({"card":"P2102","idx":8,"playerID":"0","res":0});
        p0.undo();
        p0.moves.playCard({"card":"B05","idx":7,"playerID":"0","res":0});
        p0.moves.playCard({"card":"F3104","idx":8,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"optional","a":{"e":"competition","a":{"bonus":0,"onWin":{"e":"step","a":[{"e":"anyRegionShareCentral","a":1},{"e":"addCompetitionPower","a":1}]}}}},"idx":1,"p":"0"});
        p0.moves.confirmRespond("yes");
        p0.moves.chooseTarget({"target":"1","idx":1,"p":"0","targetName":"P2"});
        p0.moves.showCompetitionResult({"info":{"region":4,"atk":"0","atkPlayedCard":false,"atkCard":null,"def":"1","defPlayedCard":false,"defShownCards":[],"defCard":null,"progress":5,"pending":true,"onWin":{"e":"step","a":[{"e":"anyRegionShareCentral","a":1},{"e":"addCompetitionPower","a":1}]}}});
        p0.moves.chooseRegion({"r":3,"idx":0,"p":"0"});
        p0.moves.chooseRegion({"r":0,"idx":0,"p":"0"});

        p0.moves.playCard({"card":"F2107","idx":9,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"aestheticsLevelUp","a":1},"idx":1,"p":"0"});

        p0.moves.playCard({"card":"B07","idx":3,"playerID":"0","res":0});
        p0.moves.playCard({"card":"V232","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"V211","idx":1,"playerID":"0","res":0});
        p0.moves.buyCard({"buyer":"0","target":"F3406","resource":8,"deposit":0,"helper":[]});
        p0.moves.playCard({"card":"P2102","idx":4,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"addCompetitionPower","a":1},"idx":1,"p":"0"});
        p0.moves.chooseTarget({"target":"3","idx":1,"p":"0","targetName":"P4"});

        p0.moves.playCard({"card":"F2106","idx":3,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"addCompetitionPower","a":1},"idx":0,"p":"0"});

        p0.moves.playCard({"card":"F3406","idx":4,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"optional","a":{"e":"competition","a":{"bonus":0,"onWin":{"e":"peek","a":{"count":3,"target":"hand","filter":{"e":"industry","a":"all"}}}}}},"idx":1,"p":"0"});
        p0.moves.confirmRespond("yes");
        p0.moves.chooseTarget({"target":"3","idx":2,"p":"0","targetName":"P4"});
        p0.moves.showCompetitionResult({"info":{"region":4,"atk":"0","atkPlayedCard":false,"atkCard":null,"def":"3","defPlayedCard":false,"defShownCards":[],"defCard":null,"progress":5,"pending":true,"onWin":{"e":"peek","a":{"count":3,"target":"hand","filter":{"e":"industry","a":"all"}}}}});
        p0.moves.chooseRegion({"r":3,"idx":0,"p":"0"});

        p0.moves.playCard({"card":"P2103","idx":1,"playerID":"0","res":0});
        p0.moves.chooseTarget({"target":"1","idx":0,"p":"0","targetName":"P2"});
        p1.moves.chooseHand({"hand":"B04","idx":4,"p":"1"});

        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B04","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B05","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B05","idx":0,"playerID":"0","res":0});
        p0.undo();
        p0.moves.changePlayerSetting({"classicFilmAutoMoveMode":"AESTHETICS_AWARD"});
        p0.moves.playCard({"card":"B05","idx":0,"playerID":"0","res":0});
        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand":"B04","idx":2,"p":"2"});

        p2.moves.drawCard("2");
        p2.moves.playCard({"card":"B05","idx":4,"playerID":"2","res":0});
        p2.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"2"});

        p2.moves.playCard({"card":"B03","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F2407","idx":3,"playerID":"2","res":0});
        p2.moves.chooseHand({"hand":"V223","idx":0,"p":"2"});
        p2.moves.chooseEffect({"effect":{"e":"aestheticsLevelUp","a":1},"idx":1,"p":"2"});
        p2.moves.updateSlot({"slot":{"comment":null,"region":0,"isLegend":false,"card":"F3111"},"p":"2","cardId":"F3111","updateHistoryIndex":5});

        p2.moves.playCard({"card":"V243","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.buyCard({"buyer":"2","target":"F3116","resource":5,"deposit":4,"helper":[]});
        p2.moves.requestEndTurn("2");

        p1.moves.drawCard("1");
        p1.moves.playCard({"card":"F2411","idx":2,"playerID":"1","res":0});
        p1.moves.chooseEffect({"effect":{"e":"breakthroughResDeduct","a":2},"idx":1,"p":"1"});
        p1.moves.chooseHand({"hand":"B04","idx":4,"p":"1"});

        p1.moves.playCard({"card":"B03","idx":2,"playerID":"1","res":0});
        p1.moves.playCard({"card":"V221","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B04","idx":1,"playerID":"1","res":0});
        p1.moves.breakthrough({"card":"B05","idx":0,"playerID":"1","res":2});
        p1.moves.chooseEffect({"effect":{"e":"industryBreakthrough","a":1},"idx":0,"p":"1"});

        p1.moves.chooseEffect({"effect":{"e":"buildStudio","a":1},"idx":2,"p":"1"});

        p1.moves.chooseRegion({"r":3,"idx":2,"p":"1"});
        p1.moves.payAdditionalCost({"res":2,"deposit":1});

        p1.moves.requestEndTurn("1");

        p3.moves.playCard({"card":"F2214","idx":3,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B03","idx":5,"playerID":"3","res":0});
        p3.moves.drawCard("3");
        p3.moves.drawCard("3");
        p3.moves.playCard({"card":"F2210","idx":6,"playerID":"3","res":0});
        p3.moves.chooseEffect({"effect":{"e":"draw","a":2},"idx":0,"p":"3"});

        p3.moves.playCard({"card":"B07","idx":7,"playerID":"3","res":0});
        p3.moves.playCard({"card":"P3401","idx":6,"playerID":"3","res":0});
        p3.moves.chooseTarget({"target":"0","idx":0,"p":"3","targetName":"P1"});
        p3.moves.peek({"idx":0,"card":"P2401","p":"3","shownCards":["P2401","F2408","B05","B03"]});
        p3.moves.peek({"idx":0,"card":"F2408","p":"3","shownCards":["F2408","B05","B03"]});
        p1.moves.peek({"idx":1,"card":"F3413","p":"1","shownCards":["B04","F3413","B04","F2403"]});
        p1.moves.peek({"idx":2,"card":"F2403","p":"1","shownCards":["B04","B04","F2403"]});

        p3.moves.playCard({"card":"B07","idx":2,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":2,"playerID":"3","res":0});
        p3.moves.playCard({"card":"V231","idx":2,"playerID":"3","res":0});
        p3.moves.playCard({"card":"P2401","idx":3,"playerID":"3","res":0});
        p3.moves.chooseTarget({"target":"0","idx":0,"p":"3","targetName":"P1"});
        p3.moves.peek({"idx":0,"card":"F2308","p":"3","shownCards":["F2308","V222","B03"]});
        p1.moves.peek({"idx":2,"card":"B05","p":"1","shownCards":["B03","V221","B05"]});

        p3.moves.playCard({"card":"F2308","idx":4,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"F3103","resource":7,"deposit":3,"helper":["V241","F2408","B05"]});
        p3.moves.playCard({"card":"B04","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B04","idx":0,"playerID":"3","res":0});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"B05","idx":5,"playerID":"0","res":0});
        p0.undo();
        p0.moves.changePlayerSetting({"classicFilmAutoMoveMode":"DRAW_CARD"});
        p0.moves.playCard({"card":"B05","idx":5,"playerID":"0","res":0});
        p0.moves.playCard({"card":"F2106","idx":5,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"addCompetitionPower","a":1},"idx":0,"p":"0"});

        p0.moves.playCard({"card":"F3104","idx":4,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"optional","a":{"e":"competition","a":{"bonus":0,"onWin":{"e":"step","a":[{"e":"anyRegionShareCentral","a":1},{"e":"addCompetitionPower","a":1}]}}}},"idx":1,"p":"0"});
        p0.moves.confirmRespond("yes");
        p0.moves.chooseTarget({"target":"3","idx":2,"p":"0","targetName":"P4"});
        p0.moves.showCompetitionResult({"info":{"region":4,"atk":"0","atkPlayedCard":false,"atkCard":null,"def":"3","defPlayedCard":false,"defShownCards":[],"defCard":null,"progress":4,"pending":true,"onWin":{"e":"step","a":[{"e":"anyRegionShareCentral","a":1},{"e":"addCompetitionPower","a":1}]}}});
        p0.moves.chooseRegion({"r":0,"idx":0,"p":"0"});
        p0.moves.chooseRegion({"r":0,"idx":0,"p":"0"});

        p0.moves.playCard({"card":"B05","idx":4,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B05","idx":4,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B05","idx":3,"playerID":"0","res":0});
        p0.moves.playCard({"card":"F2111","idx":5,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"industryAward","a":1},"idx":1,"p":"0"});

        p0.moves.playCard({"card":"F2107","idx":4,"playerID":"0","res":0});
        p0.moves.playCard({"card":"P2102","idx":5,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"optional","a":{"e":"competition","a":{"bonus":0,"onWin":{"e":"none","a":1}}}},"idx":0,"p":"0"});
        p0.undo();
        p0.moves.chooseEffect({"effect":{"e":"addCompetitionPower","a":1},"idx":1,"p":"0"});
        p0.moves.chooseTarget({"target":"3","idx":1,"p":"0","targetName":"P4"});

        p0.moves.playCard({"card":"V211","idx":5,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":4,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"V232","idx":1,"playerID":"0","res":0});
        p0.moves.breakthrough({"card":"B04","idx":0,"playerID":"0","res":2});
        p0.moves.playCard({"card":"P2103","idx":0,"playerID":"0","res":0});
        p0.moves.chooseTarget({"target":"3","idx":1,"p":"0","targetName":"P4"});
        p3.moves.chooseHand({"hand":"B07","idx":4,"p":"3"});

        p0.moves.buyCard({"buyer":"0","target":"P3106","resource":9,"deposit":2,"helper":[]});
        p0.moves.chooseEffect({"effect":{"e":"buy","a":"F3112","target":"0"},"idx":1,"p":"0"});

        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand":"B04","idx":4,"p":"2"});

        p2.moves.playCard({"card":"F2304","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F2114","idx":0,"playerID":"2","res":0});
        p2.moves.comment({"target":"P3102","comment":"B04","p":"2"});

        p2.moves.playCard({"card":"P2105","idx":0,"playerID":"2","res":0});
        p2.moves.chooseTarget({"target":"1","idx":0,"p":"2","targetName":"P2"});

        p2.moves.playCard({"card":"F3212","idx":1,"playerID":"2","res":0});
        p2.moves.chooseHand({"hand":"B07","idx":1,"p":"2"});
        p2.moves.chooseHand({"hand":"B04","idx":1,"p":"2"});
        p2.moves.chooseHand({"hand":"F2407","idx":1,"p":"2"});

        p2.moves.playCard({"card":"V212","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B03","idx":0,"playerID":"2","res":0});
        p2.moves.buyCard({"buyer":"2","target":"F3211","resource":5,"deposit":2,"helper":[]});
        p2.moves.playCard({"card":"F3116","idx":1,"playerID":"2","res":0});
        p2.moves.chooseEffect({"effect":{"e":"step","a":[{"e":"draw","a":4},{"e":"discard","a":3}]},"idx":0,"p":"2"});
        p2.moves.chooseHand({"hand":"B04","idx":3,"p":"2"});
        p2.moves.chooseHand({"hand":"B07","idx":2,"p":"2"});
        p2.moves.chooseHand({"hand":"V243","idx":1,"p":"2"});

        p2.moves.drawCard("2");
        p2.moves.playCard({"card":"F3211","idx":2,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B05","idx":0,"playerID":"2","res":0});
        p2.moves.chooseEffect({"effect":{"e":"aesAward","a":1},"idx":1,"p":"2"});
        p2.moves.chooseEffect({"effect":{"e":"aestheticsLevelUp","a":1},"idx":1,"p":"2"});

        p2.moves.playCard({"card":"F2407","idx":0,"playerID":"2","res":0});
        p2.moves.updateSlot({"slot":{"comment":null,"region":1,"isLegend":false,"card":"F3207"},"p":"2","cardId":"F3207","updateHistoryIndex":6});

        p2.moves.requestEndTurn("2");

        p1.moves.playCard({"card":"F2403","idx":6,"playerID":"1","res":0});
        p1.moves.peek({"idx":2,"card":null,"p":"1","shownCards":["B03","F2307","B07"]});

        p1.moves.playCard({"card":"B05","idx":6,"playerID":"1","res":0});
        p1.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"1"});

        p1.moves.playCard({"card":"P2202","idx":3,"playerID":"1","res":0});
        p1.moves.chooseHand({"hand":"B04","idx":3,"p":"1"});
        p1.moves.chooseTarget({"target":"0","idx":2,"p":"1","targetName":"P1"});

        p1.moves.playCard({"card":"F3413","idx":3,"playerID":"1","res":0});
        p1.moves.comment({"target":"F3114","comment":"B04","p":"1"});

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"V242","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"F2209","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"F2307","idx":0,"playerID":"1","res":0});
        p1.moves.comment({"target":"F3109","comment":"B04","p":"1"});

        p1.moves.buyCard({"buyer":"1","target":"P3403","resource":9,"deposit":0,"helper":[]});
        p1.moves.buyCard({"buyer":"1","target":"F3209","resource":1,"deposit":6,"helper":[]});
        p1.moves.requestEndTurn("1");

        p3.moves.playCard({"card":"P2401","idx":3,"playerID":"3","res":0});
        p3.moves.chooseTarget({"target":"0","idx":0,"p":"3","targetName":"P1"});
        p3.moves.peek({"idx":2,"card":"F2408","p":"3","shownCards":["V241","B07","F2408"]});
        p1.moves.peek({"idx":1,"card":"F2403","p":"1","shownCards":["P2202","F2403","B03"]});

        p3.moves.playCard({"card":"F2408","idx":5,"playerID":"3","res":0});
        p3.moves.peek({"idx":2,"card":null,"p":"3","shownCards":["F2308","B04"]});

        p3.moves.playCard({"card":"P3401","idx":1,"playerID":"3","res":0});
        p3.moves.chooseTarget({"target":"2","idx":1,"p":"3","targetName":"P3"});
        p3.moves.peek({"idx":2,"card":"F2214","p":"3","shownCards":["B07","B03","F2214","V231"]});
        p3.moves.peek({"idx":2,"card":"V231","p":"3","shownCards":["B07","B03","V231"]});
        p1.moves.peek({"idx":0,"card":"V221","p":"1","shownCards":["V221","B04","B07","B03"]});
        p1.moves.peek({"idx":2,"card":"B03","p":"1","shownCards":["B04","B07","B03"]});

        p3.moves.playCard({"card":"F2308","idx":4,"playerID":"3","res":0});
        p3.moves.playCard({"card":"F2214","idx":4,"playerID":"3","res":0});
        p3.moves.playCard({"card":"F2210","idx":6,"playerID":"3","res":0});
        p3.moves.chooseEffect({"effect":{"e":"breakthroughResDeduct","a":2},"idx":1,"p":"3"});
        p3.moves.chooseHand({"hand":"V231","idx":4,"p":"3"});

        p3.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"3"});
        p3.moves.payAdditionalCost({"res":2,"deposit":0});

        p3.moves.playCard({"card":"B03","idx":2,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"B05","idx":1,"playerID":"3","res":1});
        p3.moves.chooseEffect({"effect":{"e":"industryBreakthrough","a":1},"idx":0,"p":"3"});

        p3.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"3"});
        p3.moves.payAdditionalCost({"res":0,"deposit":2});

        p3.moves.buyCard({"buyer":"3","target":"F3410","resource":0,"deposit":10,"helper":[]});
        p3.moves.playCard({"card":"F3103","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":3,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B03","idx":3,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":3,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"V222","idx":2,"playerID":"3","res":2});
        p3.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"3"});

        p3.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"3"});
        p3.moves.payAdditionalCost({"res":1,"deposit":0});

        p3.moves.playCard({"card":"B04","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B04","idx":0,"playerID":"3","res":0});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"F3406","idx":0,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"optional","a":{"e":"competition","a":{"bonus":0,"onWin":{"e":"peek","a":{"count":3,"target":"hand","filter":{"e":"industry","a":"all"}}}}}},"idx":1,"p":"0"});
        p0.moves.confirmRespond("yes");
        p0.moves.chooseTarget({"target":"3","idx":2,"p":"0","targetName":"P4"});
        p0.moves.showCompetitionResult({"info":{"region":4,"atk":"0","atkPlayedCard":false,"atkCard":null,"def":"3","defPlayedCard":false,"defShownCards":[],"defCard":null,"progress":1,"pending":true,"onWin":{"e":"peek","a":{"count":3,"target":"hand","filter":{"e":"industry","a":"all"}}}}});
        p0.moves.chooseRegion({"r":0,"idx":0,"p":"0"});
        p0.moves.peek({"idx":0,"card":null,"p":"0","shownCards":["V211","P3106","F3112"]});

        p0.moves.playCard({"card":"B05","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"P2102","idx":6,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"addCompetitionPower","a":1},"idx":1,"p":"0"});
        p0.moves.chooseTarget({"target":"3","idx":1,"p":"0","targetName":"P4"});

        p0.moves.playCard({"card":"F2111","idx":6,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"industryAward","a":1},"idx":1,"p":"0"});

        p0.moves.playCard({"card":"F3104","idx":3,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"optional","a":{"e":"competition","a":{"bonus":0,"onWin":{"e":"step","a":[{"e":"anyRegionShareCentral","a":1},{"e":"addCompetitionPower","a":1}]}}}},"idx":1,"p":"0"});
        p0.moves.confirmRespond("yes");
        p0.moves.chooseTarget({"target":"2","idx":0,"p":"0","targetName":"P3"});
        p0.moves.showCompetitionResult({"info":{"region":4,"atk":"0","atkPlayedCard":false,"atkCard":null,"def":"2","defPlayedCard":false,"defShownCards":[],"defCard":null,"progress":4,"pending":true,"onWin":{"e":"step","a":[{"e":"anyRegionShareCentral","a":1},{"e":"addCompetitionPower","a":1}]}}});
        p0.moves.chooseRegion({"r":0,"idx":0,"p":"0"});
        p0.moves.chooseRegion({"r":0,"idx":0,"p":"0"});

        p0.moves.playCard({"card":"F2107","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B05","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B05","idx":5,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B05","idx":7,"playerID":"0","res":0});
        p0.moves.playCard({"card":"P3106","idx":7,"playerID":"0","res":0});
        p0.moves.updateSlot({"slot":{"comment":"B04","region":0,"isLegend":true,"card":"P3102"},"p":"0","cardId":"P3102","updateHistoryIndex":7});
        p0.moves.chooseTarget({"target":"1","idx":0,"p":"0","targetName":"P2"});
        p1.moves.chooseHand({"hand":"B04","idx":4,"p":"1"});
        p1.moves.chooseHand({"hand":"B03","idx":6,"p":"1"});
        p0.moves.confirmRespond("no");
        p2.moves.confirmRespond("yes");
        p2.undo();
        p2.moves.confirmRespond("no");

        p0.moves.playCard({"card":"F3112","idx":7,"playerID":"0","res":0});
        p0.moves.buyCard({"buyer":"0","target":"P3102","resource":13,"deposit":0,"helper":["V211"]});
        p0.moves.playCard({"card":"B05","idx":4,"playerID":"0","res":0});
        p0.moves.playCard({"card":"P2103","idx":0,"playerID":"0","res":0});
        p0.moves.chooseTarget({"target":"1","idx":0,"p":"0","targetName":"P2"});
        p1.moves.chooseHand({"hand":"B04","idx":0,"p":"1"});

        p0.moves.playCard({"card":"F2106","idx":3,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"addCompetitionPower","a":1},"idx":0,"p":"0"});

        p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"V232","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"P3102","idx":1,"playerID":"0","res":0});
        p0.moves.chooseRegion({"r":0,"idx":0,"p":"0"});
        p0.moves.confirmRespond("yes");
        p0.moves.chooseTarget({"target":"2","idx":0,"p":"0","targetName":"P3"});
        p0.moves.showCompetitionResult({"info":{"region":4,"atk":"0","atkPlayedCard":false,"atkCard":null,"def":"2","defPlayedCard":false,"defShownCards":[],"defCard":null,"progress":3,"pending":true,"onWin":{"e":"none","a":1}}});
        p0.moves.chooseRegion({"r":1,"idx":0,"p":"0"});
        p0.moves.chooseTarget({"target":"1","idx":0,"p":"0","targetName":"P2"});
        p0.moves.chooseRegion({"r":3,"idx":1,"p":"0"});

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.buyCard({"buyer":"0","target":"F3114","resource":5,"deposit":2,"helper":[]});
        p0.moves.changePlayerSetting({"classicFilmAutoMoveMode":"AESTHETICS_AWARD"});
        p0.moves.playCard({"card":"B05","idx":0,"playerID":"0","res":0});
        p0.moves.requestEndTurn("0");
        p0.moves.chooseEvent({"event":"E10","idx":1,"p":"0"});
        p0.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"0"});


        p2.moves.chooseHand({"hand":"B04","idx":3,"p":"2"});

        p2.moves.playCard({"card":"F2304","idx":2,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F3211","idx":4,"playerID":"2","res":0});
        p2.moves.playCard({"card":"P2105","idx":0,"playerID":"2","res":0});
        p2.moves.chooseTarget({"target":"1","idx":0,"p":"2","targetName":"P2"});

        p2.moves.drawCard("2");
        p2.moves.playCard({"card":"F3212","idx":4,"playerID":"2","res":0});
        p2.moves.chooseHand({"hand":"B07","idx":0,"p":"2"});
        p2.undo();
        p2.undo();
        p2.moves.playCard({"card":"F3212","idx":4,"playerID":"2","res":0});
        p2.moves.chooseHand({"hand":"B03","idx":6,"p":"2"});
        p2.moves.chooseHand({"hand":"V212","idx":3,"p":"2"});
        p2.moves.chooseHand({"hand":"B07","idx":0,"p":"2"});

        p2.moves.playCard({"card":"B05","idx":1,"playerID":"2","res":0});
        p2.moves.chooseEffect({"effect":{"e":"aesAward","a":1},"idx":1,"p":"2"});

        p2.moves.playCard({"card":"F2114","idx":1,"playerID":"2","res":0});
        p2.moves.comment({"target":"P3202","comment":"B04","p":"2"});

        p2.moves.playCard({"card":"F3116","idx":1,"playerID":"2","res":0});
        p2.moves.chooseEffect({"effect":{"e":"step","a":[{"e":"draw","a":4},{"e":"discard","a":3}]},"idx":0,"p":"2"});
        p2.moves.chooseHand({"hand":"B04","idx":4,"p":"2"});
        p2.moves.chooseHand({"hand":"B04","idx":4,"p":"2"});
        p2.moves.chooseHand({"hand":"V243","idx":1,"p":"2"});

        p2.undo();
        p2.moves.chooseHand({"hand":"B03","idx":3,"p":"2"});

        p2.moves.playCard({"card":"V212","idx":2,"playerID":"2","res":0});
        p2.moves.playCard({"card":"V243","idx":1,"playerID":"2","res":0});
        p2.moves.buyCard({"buyer":"2","target":"F3408","resource":6,"deposit":1,"helper":["F2407"]});
        p2.moves.requestEndTurn("2");

        p1.moves.playCard({"card":"F2403","idx":3,"playerID":"1","res":0});
        p1.moves.chooseEffect({"effect":{"e":"aestheticsLevelUp","a":1},"idx":1,"p":"1"});
        p1.moves.peek({"idx":0,"card":null,"p":"1","shownCards":["F3209","B04","F2307"]});

        p1.moves.playCard({"card":"P3403","idx":1,"playerID":"1","res":0});
        p1.moves.chooseTarget({"target":"0","idx":0,"p":"1","targetName":"P1"});

        p1.moves.playCard({"card":"F2411","idx":0,"playerID":"1","res":0});
        p1.moves.chooseEffect({"effect":{"e":"breakthroughResDeduct","a":2},"idx":1,"p":"1"});
        p1.moves.chooseHand({"hand":"B04","idx":2,"p":"1"});

        p1.moves.playCard({"card":"F3209","idx":2,"playerID":"1","res":0});
        p1.moves.updateSlot({"slot":{"comment":null,"region":3,"isLegend":false,"card":"F3405"},"p":"1","cardId":"F3405","updateHistoryIndex":8});

        p1.moves.playCard({"card":"F2307","idx":2,"playerID":"1","res":0});
        p1.moves.comment({"target":"P3202","comment":null,"p":"1"});

        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0});
        p1.moves.breakthrough({"card":"V221","idx":1,"playerID":"1","res":2});
        p1.moves.chooseEffect({"effect":{"e":"skipBreakthrough","a":1},"idx":1,"p":"1"});

        p1.moves.playCard({"card":"V242","idx":0,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"F3404","resource":6,"deposit":2,"helper":[]});
        p1.moves.requestEndTurn("1");

        p3.moves.playCard({"card":"F2408","idx":6,"playerID":"3","res":0});
        p3.moves.peek({"idx":2,"card":null,"p":"3","shownCards":["B04","F2214"]});

        p3.moves.playCard({"card":"F2214","idx":6,"playerID":"3","res":0});
        p3.moves.playCard({"card":"P2401","idx":4,"playerID":"3","res":0});
        p3.moves.chooseTarget({"target":"2","idx":1,"p":"3","targetName":"P3"});
        p3.moves.peek({"idx":2,"card":"F3103","p":"3","shownCards":["B07","B07","F3103"]});
        p1.moves.peek({"idx":1,"card":"F3404","p":"1","shownCards":["B04","F3404","B07"]});

        p3.moves.playCard({"card":"F3103","idx":6,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B03","idx":8,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"F3307","resource":5,"deposit":4,"helper":[]});
        p3.moves.playCard({"card":"F3410","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":8,"playerID":"3","res":0});
        p3.moves.playCard({"card":"V241","idx":1,"playerID":"3","res":0});
        p3.undo();
        p3.moves.playCard({"card":"F2308","idx":6,"playerID":"3","res":0});
        p3.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"3"});

        p3.moves.playCard({"card":"F2210","idx":5,"playerID":"3","res":0});
        p3.moves.chooseEffect({"effect":{"e":"draw","a":2},"idx":0,"p":"3"});

        p3.moves.playCard({"card":"F3307","idx":7,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":7,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B03","idx":4,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"F3311","resource":8,"deposit":0,"helper":[]});
        p3.moves.playCard({"card":"P3401","idx":3,"playerID":"3","res":0});
        p3.moves.chooseTarget({"target":"0","idx":0,"p":"3","targetName":"P1"});
        p3.moves.peek({"idx":0,"card":"F3311","p":"3","shownCards":["F3311"]});
        p1.moves.peek({"idx":1,"card":"P3403","p":"1","shownCards":["B04","P3403","F2307","B04"]});

        p3.moves.playCard({"card":"F3311","idx":5,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"F3405","resource":6,"deposit":2,"helper":[]});
        p3.undo();
        p3.moves.buyCard({"buyer":"3","target":"F3414","resource":6,"deposit":1,"helper":["V241"]});
        p3.moves.requestEndTurn("3");
        p1.moves.chooseEvent({"event":"E14","idx":0,"p":"1"});

    }
    p0.stop();
    p1.stop();
    p2.stop();
    p3.stop();
})