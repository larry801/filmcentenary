import {Client} from 'boardgame.io/client';
import {Local} from 'boardgame.io/multiplayer'
import {FilmCentenaryGame} from './Game';
// import {IG} from "./types/setup";

// const hasDuplicateClassicCard = (G: IG, p: number) => {
//     const validCards = [...G.pub[p].discard, ...G.secretInfo.playerDecks[p], ...G.player[p].hand];
//     console.log(validCards)
// }

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
it('Can build North American Studio',()=>{
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
it('Execute 40 vp award after chooseTarget',()=>{

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
        p0.moves.setupGameMode({"mode":"NORMAL","order":"FIXED"});
        p0.moves.setupGameMode({"mode":"TEAM2V2","order":"FIXED"});
        p0.moves.setupGameMode({"mode":"TEAM2V2","order":"FIRST_RANDOM"});
        p0.moves.setupGameMode({"mode":"TEAM2V2","order":"FIXED"});
        p0.moves.setupGameMode({"mode":"TEAM2V2","order":"ALL_RANDOM"});
        p0.moves.setupGameMode({"mode":"TEAM2V2","order":"FIXED"});
        p0.moves.setupGameMode({"mode":"TEAM2V2","order":"ALL_RANDOM"});
        p0.moves.setupGameMode({"mode":"TEAM2V2","order":"FIXED"});
        p0.moves.setupGameMode({"mode":"TEAM2V2","order":"ALL_RANDOM"});
        p0.moves.setupGameMode({"mode":"TEAM2V2","order":"FIXED"});
        p0.moves.setupGameMode({"mode":"TEAM2V2","order":"ALL_RANDOM"});
        p0.moves.setupGameMode({"mode":"TEAM2V2","order":"FIXED"});
        p0.moves.setupGameMode({"mode":"TEAM2V2","order":"ALL_RANDOM"});
        p0.moves.setupGameMode({"mode":"TEAM2V2","order":"FIXED"});
        p0.moves.setupGameMode({"mode":"TEAM2V2","order":"ALL_RANDOM"});
        p0.moves.showBoardStatus({"regions":[{"normalDeckLength":2,"legendDeckLength":0,"completedModernScoring":false,"era":0,"buildings":[{"building":null,"region":0,"activated":true,"owner":""},{"building":null,"region":0,"activated":true,"owner":""},{"building":null,"region":0,"activated":false,"owner":""}],"legend":{"comment":null,"region":0,"isLegend":true,"card":"P1101"},"normal":[{"comment":null,"region":0,"isLegend":false,"card":"F1108"},{"comment":null,"region":0,"isLegend":false,"card":"F1104"},{"comment":null,"region":0,"isLegend":false,"card":"F1109"}],"share":6},{"normalDeckLength":2,"legendDeckLength":0,"completedModernScoring":false,"era":0,"buildings":[{"building":null,"region":1,"activated":true,"owner":""},{"building":null,"region":1,"activated":true,"owner":""}],"legend":{"comment":null,"region":1,"isLegend":true,"card":"P1202"},"normal":[{"comment":null,"region":1,"isLegend":false,"card":"S1203"},{"comment":null,"region":1,"isLegend":false,"card":"F1211"},{"comment":null,"region":1,"isLegend":false,"card":"F1207"}],"share":6},{"normalDeckLength":1,"legendDeckLength":0,"completedModernScoring":false,"era":0,"buildings":[{"building":null,"region":2,"activated":true,"owner":""},{"building":null,"region":2,"activated":false,"owner":""}],"legend":{"comment":null,"region":2,"isLegend":true,"card":"S1301"},"normal":[{"comment":null,"region":2,"isLegend":false,"card":"F1306"},{"comment":null,"region":2,"isLegend":false,"card":"S1303"}],"share":4},{"normalDeckLength":0,"legendDeckLength":0,"completedModernScoring":false,"era":0,"buildings":[{"building":null,"region":3,"activated":true,"owner":""},{"building":null,"region":3,"activated":false,"owner":""}],"legend":{"comment":null,"region":3,"isLegend":true,"card":null},"normal":[{"comment":null,"region":3,"isLegend":false,"card":null},{"comment":null,"region":3,"isLegend":false,"card":null}],"share":0}],"school":[],"film":[],"matchID":"-8syGLq9H","seed":"ki7m02hf"});


        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"B01","idx":1,"playerID":"3","res":2});
        p3.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"3"});

        p3.moves.playCard({"card":"B02","idx":0,"playerID":"3","res":0});
        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"F1207","resource":4,"deposit":0,"helper":[]});
        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.breakthrough({"card":"B01","idx":0,"playerID":"0","res":2});
        p0.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"0"});

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.requestEndTurn("0");

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.buyCard({"buyer":"2","target":"F1104","resource":4,"deposit":0,"helper":[]});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"S1203","resource":4,"deposit":0,"helper":[]});
        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0});
        p1.moves.breakthrough({"card":"B02","idx":0,"playerID":"1","res":2});
        p1.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"1"});

        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.buyCard({"buyer":"0","target":"F1108","resource":3,"deposit":0,"helper":["B02"]});
        p0.moves.requestEndTurn("0");

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.breakthrough({"card":"B02","idx":0,"playerID":"2","res":2});
        p2.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"2"});

        p2.moves.playCard({"card":"B01","idx":0,"playerID":"2","res":0});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"B02","idx":0,"playerID":"3","res":2});
        p3.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"3"});

        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0});
        p1.moves.breakthrough({"card":"F1207","idx":1,"playerID":"1","res":2});
        p1.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"1"});

        p1.moves.playCard({"card":"B01","idx":0,"playerID":"1","res":0});
        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.buyCard({"buyer":"0","target":"S1303","resource":3,"deposit":0,"helper":["F1108"]});
        p0.moves.requestEndTurn("0");

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.breakthrough({"card":"B01","idx":0,"playerID":"2","res":2});
        p2.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"2"});

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"F1304","resource":3,"deposit":0,"helper":[]});
        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"P1202","resource":5,"deposit":0,"helper":[]});
        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.breakthrough({"card":"B02","idx":0,"playerID":"0","res":2});
        p0.undo();
        p0.moves.buyCard({"buyer":"0","target":"B03","resource":2,"deposit":0,"helper":[]});
        p0.moves.drawCard("0");
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B02","idx":0,"playerID":"0","res":0});
        p0.moves.requestEndTurn("0");

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F1104","idx":0,"playerID":"2","res":0});
        p2.moves.buyCard({"buyer":"2","target":"F1106","resource":3,"deposit":0,"helper":[]});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"F1304","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"P1101","resource":5,"deposit":0,"helper":[]});
        p3.moves.chooseEffect({"effect":{"e":"buy","a":"F1103","target":"3"},"idx":1,"p":"3"});

        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B01","idx":0,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"F1109","resource":3,"deposit":0,"helper":[]});
        p1.moves.requestEndTurn("1");
        p3.moves.chooseEvent({"event":"E02","idx":1,"p":"3"});
        p3.moves.chooseHand({"hand":"B07","idx":2,"p":"3"});
        p0.moves.chooseHand({"hand":"B07","idx":2,"p":"0"});
        p2.moves.chooseHand({"hand":"B07","idx":3,"p":"2"});
        p1.moves.chooseHand({"hand":"B07","idx":3,"p":"1"});


        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B03","idx":0,"playerID":"0","res":0});
        p0.moves.breakthrough({"card":"F1108","idx":0,"playerID":"0","res":2});
        p0.moves.chooseEffect({"effect":{"e":"industryBreakthrough","a":1},"idx":0,"p":"0"});

        p0.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"0"});

        p0.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"0"});

        p0.moves.drawCard("0");
        p0.moves.playCard({"card":"B04","idx":0,"playerID":"0","res":0});
        p0.moves.requestEndTurn("0");

        p2.moves.playCard({"card":"F1106","idx":2,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":2,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.buyCard({"buyer":"2","target":"F1211","resource":3,"deposit":0,"helper":[]});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"P1101","idx":0,"playerID":"3","res":0});
        p3.moves.updateSlot({"slot":{"comment":null,"region":0,"isLegend":true,"card":"P2103"},"p":"3","cardId":"P2103","updateHistoryIndex":0});
        p3.moves.chooseTarget({"target":"1","idx":1,"p":"3","targetName":"玩家1"});
        p1.moves.chooseHand({"hand":"P1202","idx":0,"p":"1"});

        p3.moves.buyCard({"buyer":"3","target":"B03","resource":2,"deposit":0,"helper":[]});
        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"F1306","resource":3,"deposit":0,"helper":[]});
        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.breakthrough({"card":"B02","idx":0,"playerID":"0","res":2});
        p0.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"0"});

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.drawCard("0");
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.undo();
        p0.undo();
        p0.moves.buyCard({"buyer":"0","target":"F1205","resource":1,"deposit":1,"helper":[]});
        p0.undo();
        p0.moves.buyCard({"buyer":"0","target":"B03","resource":1,"deposit":1,"helper":[]});
        p0.moves.requestEndTurn("0");

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F1104","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.breakthrough({"card":"F1211","idx":0,"playerID":"2","res":2});
        p2.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"2"});

        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":2,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"F1103","idx":0,"playerID":"3","res":2});
        p3.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"3"});

        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.breakthrough({"card":"F1109","idx":1,"playerID":"1","res":2});
        p1.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"1"});
        p1.moves.payAdditionalCost({"res":1,"deposit":0});

        p1.moves.playCard({"card":"B01","idx":0,"playerID":"1","res":0});
        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.buyCard({"buyer":"0","target":"F1208","resource":3,"deposit":0,"helper":[]});
        p0.moves.breakthrough({"card":"B04","idx":0,"playerID":"0","res":1});
        p0.moves.requestEndTurn("0");

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F1106","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"V112","idx":0,"playerID":"2","res":0});
        p2.moves.buyCard({"buyer":"2","target":"S1301","resource":5,"deposit":1,"helper":[]});
        p2.moves.requestEndTurn("2");
        p2.moves.chooseEvent({"event":"E04","idx":0,"p":"2"});


        p3.moves.playCard({"card":"B07","idx":2,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"V111","idx":1,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"F1205","resource":2,"deposit":0,"helper":[]});
        p3.moves.playCard({"card":"F1304","idx":0,"playerID":"3","res":0});
        p3.moves.requestEndTurn("3");
        p1.moves.chooseEvent({"event":"E01","idx":1,"p":"1"});
        p1.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"1"});
        p0.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"0"});
        p2.moves.chooseEffect({"effect":{"e":"aestheticsLevelUp","a":1},"idx":1,"p":"2"});
        p3.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"3"});


        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"V113","idx":0,"playerID":"1","res":0});
        p1.moves.drawCard("1");
        p1.moves.buyCard({"buyer":"1","target":"F2208","resource":5,"deposit":1,"helper":[]});
        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B03","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B03","idx":0,"playerID":"0","res":0});
        p0.moves.drawCard("0");
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.buyCard({"buyer":"0","target":"F2306","resource":6,"deposit":1,"helper":[]});
        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand":"B07","idx":0,"p":"2"});

        p2.moves.playCard({"card":"B07","idx":4,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":2,"playerID":"2","res":0});
        p2.moves.breakthrough({"card":"B02","idx":2,"playerID":"2","res":2});
        p2.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"2"});

        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.buyCard({"buyer":"2","target":"B03","resource":2,"deposit":0,"helper":[]});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"P1101","idx":0,"playerID":"3","res":0});
        p3.moves.updateSlot({"slot":{"comment":null,"region":0,"isLegend":true,"card":"S2101"},"p":"3","cardId":"S2101","updateHistoryIndex":1});
        p3.moves.chooseTarget({"target":"2","idx":3,"p":"3","targetName":"P3"});
        p2.moves.chooseHand({"hand":"F1106","idx":2,"p":"2"});

        p3.moves.drawCard("3");
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"F2211","resource":4,"deposit":0,"helper":[]});
        p3.moves.requestEndTurn("3");

        p1.moves.drawCard("1");
        p1.moves.playCard({"card":"B07","idx":5,"playerID":"1","res":0});
        p1.moves.playCard({"card":"V113","idx":3,"playerID":"1","res":0});
        p1.moves.playCard({"card":"F1306","idx":2,"playerID":"1","res":0});
        p1.undo();
        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.undo();
        p1.undo();
        p1.undo();
        p1.undo();
        p1.moves.playCard({"card":"V113","idx":3,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"F1306","idx":1,"playerID":"1","res":0});
        p1.moves.breakthrough({"card":"B04","idx":1,"playerID":"1","res":2});
        p1.moves.breakthrough({"card":"P1202","idx":0,"playerID":"1","res":2});
        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B03","idx":1,"playerID":"0","res":0});
        p0.moves.breakthrough({"card":"B04","idx":0,"playerID":"0","res":2});
        p0.moves.buyCard({"buyer":"0","target":"B01","resource":2,"deposit":0,"helper":[]});
        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand":"B07","idx":3,"p":"2"});

        p2.moves.drawCard("2");
        p2.moves.playCard({"card":"B07","idx":3,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F1104","idx":2,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"V112","idx":0,"playerID":"2","res":0});
        p2.moves.buyCard({"buyer":"2","target":"F2304","resource":4,"deposit":2,"helper":[]});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card":"P1101","idx":2,"playerID":"3","res":0});
        p3.moves.updateSlot({"slot":{"comment":null,"region":3,"isLegend":false,"card":"F2406"},"p":"3","cardId":"F2406","updateHistoryIndex":2});
        p3.moves.chooseTarget({"target":"1","idx":1,"p":"3","targetName":"P2"});

        p3.moves.playCard({"card":"B05","idx":2,"playerID":"3","res":0});
        p3.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"3"});

        p3.moves.playCard({"card":"B03","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"F1205","idx":1,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"F1304","idx":0,"playerID":"3","res":2});
        p3.moves.comment({"target":"F2107","comment":"B04","p":"3"});

        p3.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"3"});

        p3.moves.drawCard("3");
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card":"B05","idx":2,"playerID":"1","res":0});
        p1.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"1"});

        p1.moves.playCard({"card":"V121","idx":4,"playerID":"1","res":0});
        p1.undo();
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.breakthrough({"card":"B01","idx":0,"playerID":"1","res":2});
        p1.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"1"});

        p1.moves.breakthrough({"card":"V121","idx":0,"playerID":"1","res":2});
        p1.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"1"});

        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card":"B03","idx":3,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.drawCard("0");
        p0.moves.playCard({"card":"B05","idx":1,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"0"});

        p0.undo();
        p0.undo();
        p0.undo();
        p0.undo();
        p0.moves.drawCard("0");
        p0.moves.playCard({"card":"B05","idx":2,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"0"});

        p0.moves.playCard({"card":"F2306","idx":2,"playerID":"0","res":0});
        p0.moves.chooseHand({"hand":"B07","idx":0,"p":"0"});

        p0.moves.buyCard({"buyer":"0","target":"P2103","resource":5,"deposit":3,"helper":["F1208"]});
        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand":"B07","idx":4,"p":"2"});

        p2.moves.playCard({"card":"B05","idx":0,"playerID":"2","res":0});
        p2.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"2"});

        p2.moves.playCard({"card":"F1106","idx":3,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B03","idx":3,"playerID":"2","res":0});
        p2.moves.playCard({"card":"V131","idx":2,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.undo();
        p2.undo();
        p2.undo();
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.drawCard("2");
        p2.moves.playCard({"card":"V131","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B04","idx":0,"playerID":"2","res":0});
        p2.moves.buyCard({"buyer":"2","target":"F2405","resource":6,"deposit":0,"helper":[]});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card":"V122","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.drawCard("3");
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"V111","idx":0,"playerID":"3","res":2});
        p3.moves.chooseEffect({"effect":{"e":"buildStudio","a":1},"idx":1,"p":"3"});

        p3.moves.chooseRegion({"r":0,"idx":0,"p":"3"});
        p3.moves.payAdditionalCost({"res":3,"deposit":0});

        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"F2208","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"V113","idx":1,"playerID":"1","res":0});
        p1.moves.drawCard("1");
        p1.moves.playCard({"card":"B05","idx":0,"playerID":"1","res":0});
        p1.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"1"});

        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"S2101","resource":7,"deposit":0,"helper":["F1306"]});
        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card":"V123","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.drawCard("0");
        p0.moves.playCard({"card":"F2306","idx":0,"playerID":"0","res":0});
        p0.moves.chooseHand({"hand":"B07","idx":0,"p":"0"});

        p0.moves.buyCard({"buyer":"0","target":"F2407","resource":6,"deposit":0,"helper":[]});
        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand":"B04","idx":4,"p":"2"});

        p2.moves.playCard({"card":"V131","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.drawCard("2");
        p2.moves.playCard({"card":"F2405","idx":1,"playerID":"2","res":0});
        p2.moves.chooseEffect({"effect":{"e":"step","a":[{"e":"res","a":1},{"e":"update","a":1}]},"idx":0,"p":"2"});
        p2.moves.updateSlot({"slot":{"comment":"B04","region":0,"isLegend":false,"card":"F2107"},"p":"2","cardId":"F2107","updateHistoryIndex":3});

        p2.moves.breakthrough({"card":"B05","idx":0,"playerID":"2","res":2});
        p2.moves.chooseEffect({"effect":{"e":"industryBreakthrough","a":1},"idx":0,"p":"2"});

        p2.moves.chooseEffect({"effect":{"e":"buildStudio","a":1},"idx":1,"p":"2"});

        p2.moves.chooseRegion({"r":0,"idx":0,"p":"2"});
        p2.moves.payAdditionalCost({"res":3,"deposit":0});

        p2.moves.requestEndTurn("2");

        p3.moves.drawCard("3");
        p3.moves.playCard({"card":"B07","idx":4,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":3,"playerID":"3","res":0});
        p3.moves.playCard({"card":"V132","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"S2301","resource":5,"deposit":4,"helper":["F2211"]});
        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card":"F2208","idx":2,"playerID":"1","res":0});
        p1.moves.playCard({"card":"F1306","idx":2,"playerID":"1","res":0});
        p1.moves.playCard({"card":"V113","idx":2,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"F2112","resource":6,"deposit":0,"helper":[]});
        p1.undo();
        p1.undo();
        p1.undo();
        p1.undo();
        p1.undo();
        p1.undo();
        p1.undo();
        p1.undo();
        p1.moves.playCard({"card":"B07","idx":3,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":3,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":3,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":3,"playerID":"1","res":0});
        p1.moves.breakthrough({"card":"V113","idx":2,"playerID":"1","res":2});
        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"F2112","resource":6,"deposit":0,"helper":[]});
        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card":"P2103","idx":0,"playerID":"0","res":0});
        p0.moves.chooseTarget({"target":"1","idx":1,"p":"0","targetName":"玩家1"});
        p1.moves.chooseHand({"hand":"B07","idx":6,"p":"1"});

        p0.moves.playCard({"card":"B03","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B03","idx":0,"playerID":"0","res":0});
        p0.moves.breakthrough({"card":"B01","idx":0,"playerID":"0","res":2});
        p0.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"0"});

        p0.moves.playCard({"card":"B05","idx":0,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"0"});

        p0.moves.playCard({"card":"F1208","idx":0,"playerID":"0","res":0});
        p0.moves.drawCard("0");
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand":"B07","idx":2,"p":"2"});

        p2.moves.playCard({"card":"F2304","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F1106","idx":3,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":4,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":3,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F1104","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.breakthrough({"card":"V112","idx":0,"playerID":"2","res":2});
        p2.moves.buyCard({"buyer":"2","target":"F2114","resource":4,"deposit":0,"helper":[]});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"V122","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B05","idx":0,"playerID":"3","res":0});
        p3.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"3"});

        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"F1205","idx":0,"playerID":"3","res":0});
        p3.moves.drawCard("3");
        p3.moves.playCard({"card":"P1101","idx":0,"playerID":"3","res":0});
        p3.moves.updateSlot({"slot":{"comment":null,"region":3,"isLegend":false,"card":"F2403"},"p":"3","cardId":"F2403","updateHistoryIndex":4});
        p3.moves.chooseTarget({"target":"1","idx":0,"p":"3","targetName":"P2"});
        p1.moves.chooseHand({"hand":"F1306","idx":1,"p":"1"});

        p3.moves.playCard({"card":"B03","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"F2308","resource":6,"deposit":0,"helper":[]});
        p3.moves.drawCard("3");
        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card":"F2208","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"F2112","idx":5,"playerID":"1","res":0});
        p1.moves.confirmRespond("no");

        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B05","idx":0,"playerID":"1","res":0});
        p1.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"1"});

        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"P2401","resource":10,"deposit":0,"helper":[]});
        p1.moves.chooseEffect({"effect":{"e":"buy","a":"F2406","target":"1"},"idx":1,"p":"1"});

        p1.moves.drawCard("1");
        p1.moves.playCard({"card":"B04","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"F2406","idx":0,"playerID":"1","res":0});
        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"F2306","idx":2,"playerID":"0","res":0});
        p0.moves.chooseHand({"hand":"B07","idx":1,"p":"0"});

        p0.moves.drawCard("0");
        p0.moves.playCard({"card":"V123","idx":1,"playerID":"0","res":0});
        p0.moves.breakthrough({"card":"B05","idx":0,"playerID":"0","res":2});
        p0.moves.chooseEffect({"effect":{"e":"industryBreakthrough","a":1},"idx":0,"p":"0"});

        p0.moves.chooseEffect({"effect":{"e":"buildStudio","a":1},"idx":1,"p":"0"});

        p0.moves.chooseRegion({"r":3,"idx":2,"p":"0"});
        p0.moves.payAdditionalCost({"res":3,"deposit":0});

        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand":"B07","idx":3,"p":"2"});

        p2.moves.playCard({"card":"F2304","idx":4,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F2114","idx":3,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":3,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":3,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B03","idx":0,"playerID":"2","res":0});
        p2.moves.drawCard("2");
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"V131","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B04","idx":0,"playerID":"2","res":0});
        p2.moves.buyCard({"buyer":"2","target":"F2403","resource":8,"deposit":0,"helper":[]});
        p2.moves.requestEndTurn("2");
        p1.moves.chooseEvent({"event":"E05","idx":0,"p":"1"});


        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":2,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"F2211","idx":1,"playerID":"3","res":2});
        p3.moves.comment({"target":"S2204","comment":"B04","p":"3"});
        p3.moves.chooseEffect({"effect":{"e":"industryBreakthrough","a":1},"idx":0,"p":"3"});

        p3.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"3"});
        p3.moves.payAdditionalCost({"res":1,"deposit":0});

        p3.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"3"});
        p3.moves.payAdditionalCost({"res":1,"deposit":0});

        p3.moves.drawCard("3");
        p3.moves.playCard({"card":"V132","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"F2308","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"F2214","resource":4,"deposit":1,"helper":[]});
        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":3,"playerID":"1","res":0});
        p1.moves.playCard({"card":"F2112","idx":2,"playerID":"1","res":0});
        p1.moves.confirmRespond("no");

        p1.moves.breakthrough({"card":"F1306","idx":1,"playerID":"1","res":2});
        p1.moves.chooseEffect({"effect":{"e":"buildStudio","a":1},"idx":1,"p":"1"});

        p1.undo();
        p1.undo();
        p1.moves.playCard({"card":"P2401","idx":0,"playerID":"1","res":0});
        p1.moves.chooseTarget({"target":"3","idx":2,"p":"1","targetName":"P4"});
        p0.moves.peek({"idx":0,"card":"F1208","p":"0","shownCards":["F1208","B05","B03"]});

        p1.moves.buyCard({"buyer":"1","target":"F2207","resource":8,"deposit":0,"helper":[]});
        p1.moves.playCard({"card":"F1306","idx":0,"playerID":"1","res":0});
        p1.undo();
        p1.undo();
        p1.moves.playCard({"card":"F1306","idx":0,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"F2113","resource":5,"deposit":0,"helper":[]});
        p1.moves.buyCard({"buyer":"1","target":"F2207","resource":5,"deposit":3,"helper":[]});
        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card":"P2103","idx":2,"playerID":"0","res":0});
        p0.moves.chooseTarget({"target":"1","idx":1,"p":"0","targetName":"P2"});
        p1.moves.chooseHand({"hand":"B04","idx":2,"p":"1"});

        p0.moves.playCard({"card":"B05","idx":5,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"0"});

        p0.moves.playCard({"card":"B07","idx":3,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"F2407","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B03","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"V243","idx":1,"playerID":"0","res":0});
        p0.moves.breakthrough({"card":"F1208","idx":0,"playerID":"0","res":2});
        p0.moves.chooseEffect({"effect":{"e":"aestheticsBreakthrough","a":1},"idx":1,"p":"0"});

        p0.undo();
        p0.undo();
        p0.moves.buyCard({"buyer":"0","target":"F2212","resource":4,"deposit":0,"helper":["F1208"]});
        p0.moves.buyCard({"buyer":"0","target":"F2111","resource":2,"deposit":2,"helper":[]});
        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand":"B07","idx":2,"p":"2"});

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F1106","idx":2,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B03","idx":2,"playerID":"2","res":0});
        p2.moves.drawCard("2");
        p2.moves.playCard({"card":"B07","idx":2,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F1104","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F2405","idx":0,"playerID":"2","res":0});
        p2.moves.updateSlot({"slot":{"comment":null,"region":1,"isLegend":true,"card":"P2202"},"p":"2","cardId":"P2202","updateHistoryIndex":5});

        p2.moves.buyCard({"buyer":"2","target":"F2108","resource":5,"deposit":0,"helper":[]});
        p2.moves.requestEndTurn("2");
        p1.moves.chooseEvent({"event":"E09","idx":1,"p":"1"});


        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"V132","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.drawCard("3");
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.drawCard("3");
        p3.moves.breakthrough({"card":"B04","idx":1,"playerID":"3","res":2});
        p3.moves.playCard({"card":"B05","idx":0,"playerID":"3","res":0});
        p3.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"3"});

        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card":"F2406","idx":0,"playerID":"1","res":0});
        p1.moves.peek({"idx":0,"card":null,"p":"1","shownCards":["F2112","V241","F2113"]});

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0});
        p1.moves.playCard({"card":"F2112","idx":4,"playerID":"1","res":0});
        p1.moves.confirmRespond("yes");
        p1.undo();
        p1.moves.confirmRespond("no");

        p1.moves.breakthrough({"card":"F2113","idx":4,"playerID":"1","res":2});
        p1.moves.chooseEffect({"effect":{"e":"buildCinema","a":1},"idx":2,"p":"1"});

        p1.moves.chooseRegion({"r":1,"idx":0,"p":"1"});
        p1.moves.payAdditionalCost({"res":3,"deposit":0});

        p1.moves.playCard({"card":"F2208","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":4,"playerID":"1","res":0});
        p1.moves.playCard({"card":"F1306","idx":3,"playerID":"1","res":0});
        p1.moves.playCard({"card":"F2207","idx":1,"playerID":"1","res":0});
        p1.moves.chooseEffect({"effect":{"e":"step","a":[{"e":"res","a":2},{"e":"deposit","a":1}]},"idx":0,"p":"1"});

        p1.moves.playCard({"card":"B05","idx":0,"playerID":"1","res":0});
        p1.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"1"});

        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"F2303","resource":7,"deposit":0,"helper":[]});
        p1.moves.playCard({"card":"B04","idx":0,"playerID":"1","res":0});
        p1.moves.requestEndTurn("1");

        p0.moves.drawCard("0");
        p0.moves.playCard({"card":"F2306","idx":4,"playerID":"0","res":0});
        p0.moves.chooseHand({"hand":"B07","idx":0,"p":"0"});

        p0.moves.playCard({"card":"V123","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B03","idx":1,"playerID":"0","res":0});
        p0.moves.buyCard({"buyer":"0","target":"S2204","resource":5,"deposit":3,"helper":["B05"]});
        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand":"B07","idx":2,"p":"2"});

        p2.moves.playCard({"card":"V131","idx":2,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F2403","idx":1,"playerID":"2","res":0});
        p2.moves.peek({"idx":0,"card":null,"p":"2","shownCards":["V242","B04","B07"]});

        p2.moves.playCard({"card":"F2114","idx":0,"playerID":"2","res":0});
        p2.moves.comment({"target":"F3109","comment":"B04","p":"2"});

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.drawCard("2");
        p2.moves.playCard({"card":"F2304","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F2405","idx":1,"playerID":"2","res":0});
        p2.moves.chooseEffect({"effect":{"e":"breakthroughResDeduct","a":2},"idx":1,"p":"2"});
        p2.moves.chooseHand({"hand":"F1106","idx":0,"p":"2"});

        p2.moves.buyCard({"buyer":"2","target":"F2309","resource":5,"deposit":1,"helper":[]});
        p2.moves.requestEndTurn("2");
        p2.moves.chooseEffect({"effect":{"e":"aestheticsLevelUp","a":1},"idx":1,"p":"2"});
        p3.moves.chooseEvent({"event":"E06","idx":1,"p":"3"});


        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"F2308","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"P1101","idx":0,"playerID":"3","res":0});
        p3.moves.updateSlot({"slot":{"comment":null,"region":3,"isLegend":true,"card":"P3402"},"p":"3","cardId":"P3402","updateHistoryIndex":6});
        p3.moves.chooseTarget({"target":"1","idx":0,"p":"3","targetName":"P2"});
        p1.moves.chooseHand({"hand":"P2401","idx":2,"p":"1"});

        p3.moves.playCard({"card":"F2214","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B03","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"V122","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"F3311","resource":7,"deposit":0,"helper":[]});
        p3.moves.drawCard("3");
        p3.moves.breakthrough({"card":"F1205","idx":0,"playerID":"3","res":2});
        p3.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"3"});
        p3.moves.payAdditionalCost({"res":1,"deposit":0});

        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.undo();
        p1.moves.breakthrough({"card":"B04","idx":1,"playerID":"1","res":2});
        p1.moves.playCard({"card":"B05","idx":1,"playerID":"1","res":0});
        p1.undo();
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.breakthrough({"card":"B05","idx":0,"playerID":"1","res":2});
        p1.moves.chooseEffect({"effect":{"e":"industryBreakthrough","a":1},"idx":0,"p":"1"});

        p1.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"1"});
        p1.moves.payAdditionalCost({"res":1,"deposit":0});

        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card":"B03","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"P2103","idx":2,"playerID":"0","res":0});
        p0.moves.chooseTarget({"target":"1","idx":1,"p":"0","targetName":"P2"});
        p1.moves.chooseHand({"hand":"B04","idx":5,"p":"1"});

        p0.moves.playCard({"card":"V123","idx":2,"playerID":"0","res":0});
        p0.moves.breakthrough({"card":"B05","idx":2,"playerID":"0","res":2});
        p0.moves.chooseEffect({"effect":{"e":"industryBreakthrough","a":1},"idx":0,"p":"0"});

        p0.moves.chooseEffect({"effect":{"e":"buildCinema","a":1},"idx":1,"p":"0"});

        p0.moves.chooseRegion({"r":1,"idx":0,"p":"0"});
        p0.moves.payAdditionalCost({"res":1,"deposit":2});

        p0.moves.playCard({"card":"F2212","idx":1,"playerID":"0","res":0});
        p0.moves.comment({"target":"F3306","comment":"B04","p":"0"});

        p0.moves.buyCard({"buyer":"0","target":"F2210","resource":4,"deposit":2,"helper":[]});
        p0.moves.playCard({"card":"B04","idx":0,"playerID":"0","res":0});
        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand":"B07","idx":2,"p":"2"});

        p2.moves.playCard({"card":"F2108","idx":3,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F1104","idx":3,"playerID":"2","res":0});
        p2.moves.playCard({"card":"V242","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"V212","idx":0,"playerID":"2","res":0});
        p2.moves.breakthrough({"card":"B04","idx":0,"playerID":"2","res":2});
        p2.moves.buyCard({"buyer":"2","target":"F3307","resource":2,"deposit":7,"helper":[]});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card":"B07","idx":2,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B03","idx":0,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"V231","idx":0,"playerID":"3","res":2});
        p3.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"3"});
        p3.moves.payAdditionalCost({"res":1,"deposit":0});

        p3.moves.drawCard("3");
        p3.moves.playCard({"card":"B05","idx":2,"playerID":"3","res":0});
        p3.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"3"});

        p3.moves.playCard({"card":"B07","idx":2,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"B04","idx":0,"playerID":"3","res":1});
        p3.moves.playCard({"card":"B04","idx":0,"playerID":"3","res":0});
        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card":"F2406","idx":5,"playerID":"1","res":0});
        p1.moves.peek({"idx":0,"card":null,"p":"1","shownCards":["B07","F2303","B07"]});

        p1.moves.playCard({"card":"F2303","idx":6,"playerID":"1","res":0});
        p1.moves.chooseHand({"hand":"B04","idx":5,"p":"1"});
        p1.moves.chooseHand({"hand":"B07","idx":6,"p":"1"});

        p1.moves.playCard({"card":"F2112","idx":5,"playerID":"1","res":0});
        p1.moves.confirmRespond("no");

        p1.moves.playCard({"card":"F2208","idx":2,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":4,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":4,"playerID":"1","res":0});
        p1.moves.playCard({"card":"F2207","idx":2,"playerID":"1","res":0});
        p1.moves.chooseEffect({"effect":{"e":"breakthroughResDeduct","a":2},"idx":1,"p":"1"});
        p1.moves.chooseHand({"hand":"F1306","idx":2,"p":"1"});

        p1.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"1"});
        p1.moves.payAdditionalCost({"res":2,"deposit":0});

        p1.moves.breakthrough({"card":"V211","idx":1,"playerID":"1","res":2});
        p1.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"1"});
        p1.moves.payAdditionalCost({"res":2,"deposit":0});
        p1.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"1"});

        p1.moves.breakthrough({"card":"V241","idx":0,"playerID":"1","res":2});
        p1.undo();
        p1.undo();
        p1.moves.chooseEffect({"effect":{"e":"aestheticsLevelUp","a":1},"idx":1,"p":"1"});

        p1.moves.breakthrough({"card":"V241","idx":0,"playerID":"1","res":2});
        p1.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"1"});
        p1.moves.payAdditionalCost({"res":0,"deposit":1});

        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card":"B05","idx":1,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"0"});

        p0.moves.playCard({"card":"B05","idx":4,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"0"});

        p0.moves.drawCard("0");
        p0.moves.playCard({"card":"F2306","idx":1,"playerID":"0","res":0});
        p0.moves.chooseHand({"hand":"B07","idx":4,"p":"0"});

        p0.moves.playCard({"card":"B03","idx":3,"playerID":"0","res":0});
        p0.moves.playCard({"card":"V213","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"F2407","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"V243","idx":0,"playerID":"0","res":0});
        p0.undo();
        p0.undo();
        p0.moves.breakthrough({"card":"V243","idx":0,"playerID":"0","res":2});
        p0.moves.playCard({"card":"F2407","idx":0,"playerID":"0","res":0});
        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand":"B07","idx":2,"p":"2"});

        p2.moves.playCard({"card":"F2304","idx":2,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F2403","idx":2,"playerID":"2","res":0});
        p2.moves.peek({"idx":0,"card":null,"p":"2","shownCards":["F2405","F1104","B07"]});

        p2.moves.playCard({"card":"V131","idx":3,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B03","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B05","idx":0,"playerID":"2","res":0});
        p2.moves.chooseEffect({"effect":{"e":"aesAward","a":1},"idx":1,"p":"2"});

        p2.undo();
        p2.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"2"});

        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.drawCard("2");
        p2.moves.playCard({"card":"V232","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F2405","idx":0,"playerID":"2","res":0});
        p2.moves.updateSlot({"slot":{"comment":"B04","region":0,"isLegend":false,"card":"F3109"},"p":"2","cardId":"F3109","updateHistoryIndex":7});

        p2.moves.buyCard({"buyer":"2","target":"F3310","resource":7,"deposit":1,"helper":[]});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card":"F2308","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"F2214","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"F3312","resource":11,"deposit":0,"helper":[]});
        p3.moves.drawCard("3");
        p3.moves.playCard({"card":"V122","idx":0,"playerID":"3","res":0});
        p3.moves.drawCard("3");
        p3.moves.requestEndTurn("3");
        p3.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"3"});


        p1.moves.playCard({"card":"F2112","idx":7,"playerID":"1","res":0});
        p1.moves.confirmRespond("no");

        p1.moves.playCard({"card":"B07","idx":6,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":5,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":3,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B05","idx":0,"playerID":"1","res":0});
        p1.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"1"});

        p1.moves.playCard({"card":"B07","idx":3,"playerID":"1","res":0});
        p1.moves.breakthrough({"card":"B04","idx":0,"playerID":"1","res":2});
        p1.moves.breakthrough({"card":"B04","idx":1,"playerID":"1","res":2});
        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card":"F2212","idx":4,"playerID":"0","res":0});
        p0.moves.comment({"target":"F3305","comment":"B04","p":"0"});

        p0.undo();
        p0.undo();
        p0.moves.playCard({"card":"F1208","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"V123","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.breakthrough({"card":"F2111","idx":0,"playerID":"0","res":2});
        p0.moves.chooseEffect({"effect":{"e":"industryBreakthrough","a":1},"idx":0,"p":"0"});

        p0.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"0"});
        p0.moves.payAdditionalCost({"res":1,"deposit":0});

        p0.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"0"});
        p0.moves.payAdditionalCost({"res":1,"deposit":0});

        p0.moves.drawCard("0");
        p0.moves.playCard({"card":"F2212","idx":0,"playerID":"0","res":0});
        p0.moves.comment({"target":"F3110","comment":"B04","p":"0"});

        p0.moves.playCard({"card":"B04","idx":0,"playerID":"0","res":0});
        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand":"B07","idx":4,"p":"2"});

        p2.moves.playCard({"card":"F2309","idx":0,"playerID":"2","res":0});
        p2.moves.chooseHand({"hand":"B04","idx":4,"p":"2"});
        p2.moves.chooseHand({"hand":"B07","idx":3,"p":"2"});

        p2.moves.playCard({"card":"F2108","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F2114","idx":3,"playerID":"2","res":0});
        p2.moves.comment({"target":"F3110","comment":null,"p":"2"});

        p2.moves.playCard({"card":"F3307","idx":2,"playerID":"2","res":0});
        p2.moves.playCard({"card":"V242","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"V212","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.undo();
        p2.undo();
        p2.undo();
        p2.moves.breakthrough({"card":"V212","idx":0,"playerID":"2","res":2});
        p2.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"2"});
        p2.moves.payAdditionalCost({"res":1,"deposit":0});

        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.breakthrough({"card":"V242","idx":0,"playerID":"2","res":2});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card":"P1101","idx":2,"playerID":"3","res":0});
        p3.moves.updateSlot({"slot":{"comment":null,"region":0,"isLegend":false,"card":"F3110"},"p":"3","cardId":"F3110","updateHistoryIndex":8});
        p3.moves.chooseTarget({"target":"1","idx":0,"p":"3","targetName":"P2"});
        p1.moves.chooseHand({"hand":"P2401","idx":0,"p":"1"});

        p3.moves.playCard({"card":"F3311","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"V132","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"F2214","idx":3,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B03","idx":2,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B05","idx":1,"playerID":"3","res":0});
        p3.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"3"});

        p3.moves.buyCard({"buyer":"3","target":"F3305","resource":9,"deposit":0,"helper":[]});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"B05","idx":0,"playerID":"3","res":2});
        p3.moves.chooseEffect({"effect":{"e":"industryBreakthrough","a":1},"idx":0,"p":"3"});

        p3.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"3"});

        p3.undo();
        p3.undo();
        p3.undo();
        p3.moves.drawCard("3");
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"B05","idx":0,"playerID":"3","res":2});
        p3.moves.chooseEffect({"effect":{"e":"industryBreakthrough","a":1},"idx":0,"p":"3"});

        p3.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"3"});
        p3.moves.payAdditionalCost({"res":1,"deposit":1});

        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card":"F2406","idx":4,"playerID":"1","res":0});
        p1.moves.peek({"idx":0,"card":null,"p":"1","shownCards":["B07","B07","P2401"]});

        p1.moves.playCard({"card":"F2208","idx":2,"playerID":"1","res":0});
        p1.moves.playCard({"card":"F2303","idx":0,"playerID":"1","res":0});
        p1.moves.chooseHand({"hand":"B04","idx":3,"p":"1"});
        p1.moves.chooseHand({"hand":"B07","idx":3,"p":"1"});

        p1.moves.playCard({"card":"F2207","idx":0,"playerID":"1","res":0});
        p1.moves.chooseEffect({"effect":{"e":"step","a":[{"e":"res","a":2},{"e":"deposit","a":1}]},"idx":0,"p":"1"});

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B05","idx":1,"playerID":"1","res":0});
        p1.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"1"});

        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.drawCard("1");
        p1.moves.playCard({"card":"B04","idx":1,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"F3108","resource":9,"deposit":0,"helper":["F2112"]});
        p1.moves.chooseRegion({"r":0,"idx":0,"p":"1"});

        p1.moves.requestEndTurn("1");

        p0.moves.playCard({"card":"F2210","idx":2,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"draw","a":2},"idx":0,"p":"0"});

        p0.moves.playCard({"card":"P2103","idx":1,"playerID":"0","res":0});
        p0.moves.chooseTarget({"target":"1","idx":1,"p":"0","targetName":"P2"});
        p1.moves.chooseHand({"hand":"B04","idx":3,"p":"1"});

        p0.moves.playCard({"card":"B05","idx":4,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"0"});

        p0.moves.playCard({"card":"B05","idx":4,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"0"});

        p0.moves.playCard({"card":"B05","idx":4,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"0"});

        p0.moves.playCard({"card":"B03","idx":3,"playerID":"0","res":0});
        p0.moves.playCard({"card":"F2306","idx":5,"playerID":"0","res":0});
        p0.moves.chooseHand({"hand":"B04","idx":3,"p":"0"});

        p0.moves.playCard({"card":"B03","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"F2407","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"V213","idx":0,"playerID":"0","res":0});
        p0.moves.buyCard({"buyer":"0","target":"F3112","resource":6,"deposit":2,"helper":[]});
        p0.undo();
        p0.moves.buyCard({"buyer":"0","target":"F3112","resource":6,"deposit":2,"helper":[]});
        p0.moves.breakthrough({"card":"B04","idx":0,"playerID":"0","res":0});
        p0.moves.requestEndTurn("0");

        p2.moves.chooseHand({"hand":"B07","idx":3,"p":"2"});

        p2.moves.playCard({"card":"F2403","idx":0,"playerID":"2","res":0});
        p2.moves.peek({"idx":0,"card":null,"p":"2","shownCards":["B07","V232","V131"]});

        p2.moves.playCard({"card":"B05","idx":0,"playerID":"2","res":0});
        p2.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"2"});

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B03","idx":0,"playerID":"2","res":0});
        p2.moves.drawCard("2");
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.breakthrough({"card":"F1104","idx":0,"playerID":"2","res":2});
        p2.moves.chooseEffect({"effect":{"e":"buildCinema","a":1},"idx":1,"p":"2"});

        p2.moves.chooseRegion({"r":2,"idx":0,"p":"2"});
        p2.moves.payAdditionalCost({"res":3,"deposit":0});

        p2.moves.requestEndTurn("2");
        p2.moves.chooseEffect({"effect":{"e":"aestheticsLevelUp","a":1},"idx":1,"p":"2"});


        p3.moves.playCard({"card":"F3312","idx":5,"playerID":"3","res":0});
        p3.moves.chooseTarget({"target":"1","idx":1,"p":"3","targetName":"P2"});
        p3.moves.chooseHand({"hand":"B04","idx":2,"p":"3"});

        p3.moves.playCard({"card":"F2308","idx":3,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":2,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.drawCard("3");
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"P3102","resource":10,"deposit":1,"helper":[]});
        p3.moves.chooseEffect({"effect":{"e":"buy","a":"F3113","target":"3"},"idx":1,"p":"3"});

        p3.moves.drawCard("3");
        p3.moves.playCard({"card":"V122","idx":0,"playerID":"3","res":0});
        p3.undo();
        p3.moves.playCard({"card":"V122","idx":0,"playerID":"3","res":0});
        p3.moves.requestEndTurn("3");

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"F2208","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"F2406","idx":1,"playerID":"1","res":0});
        p1.moves.peek({"idx":0,"card":null,"p":"1","shownCards":["B07","F3108","F2112"]});

        p1.moves.playCard({"card":"F2207","idx":5,"playerID":"1","res":0});
        p1.moves.chooseEffect({"effect":{"e":"breakthroughResDeduct","a":2},"idx":1,"p":"1"});
        p1.moves.chooseHand({"hand":"B04","idx":3,"p":"1"});

        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0});
        p1.moves.playCard({"card":"F3108","idx":2,"playerID":"1","res":0});
        p1.moves.chooseEffect({"effect":{"e":"step","a":[{"e":"anyRegionShare","a":1},{"e":"competition","a":{"bonus":3,"onWin":{"e":"none","a":1}}}]},"idx":1,"p":"1"});
        p1.undo();
        p1.moves.chooseEffect({"effect":{"e":"res","a":6},"idx":0,"p":"1"});

        p1.moves.playCard({"card":"B05","idx":3,"playerID":"1","res":0});
        p1.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"1"});

        p1.moves.playCard({"card":"F2303","idx":3,"playerID":"1","res":0});
        p1.moves.chooseHand({"hand":"B04","idx":1,"p":"1"});
        p1.moves.chooseHand({"hand":"B04","idx":2,"p":"1"});

        p1.moves.playCard({"card":"F2112","idx":1,"playerID":"1","res":0});
        p1.moves.confirmRespond("no");

        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"S3101","resource":12,"deposit":0,"helper":[]});
        p1.moves.buyCard({"buyer":"1","target":"F3115","resource":6,"deposit":2,"helper":[]});
        p1.moves.confirmRespond("yes");

        p1.undo();
        p1.undo();
        console.log(JSON.stringify(p0.store.getState().G.regions["3"].buildings));
        p1.moves.playCard({"card":"P2401","idx":0,"playerID":"1","res":0});
        p1.moves.chooseTarget({"target":"3","idx":2,"p":"1","targetName":"P4"});
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

it('Competition atk card',()=>{

    const spec = {
        numPlayers: 4,
        game: gameWithSeed(
            "kijevgsh"
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

    {p0.moves.setupGameMode({"mode":"TEAM2V2","order":"FIXED"});
        p0.moves.showBoardStatus({"regions":[{"normalDeckLength":2,"legendDeckLength":0,"completedModernScoring":false,"era":0,"buildings":[{"building":null,"region":0,"activated":true,"owner":""},{"building":null,"region":0,"activated":true,"owner":""},{"building":null,"region":0,"activated":false,"owner":""}],"legend":{"comment":null,"region":0,"isLegend":true,"card":"P1102"},"normal":[{"comment":null,"region":0,"isLegend":false,"card":"F1109"},{"comment":null,"region":0,"isLegend":false,"card":"F1104"},{"comment":null,"region":0,"isLegend":false,"card":"F1106"}],"share":6},{"normalDeckLength":2,"legendDeckLength":0,"completedModernScoring":false,"era":0,"buildings":[{"building":null,"region":1,"activated":true,"owner":""},{"building":null,"region":1,"activated":true,"owner":""}],"legend":{"comment":null,"region":1,"isLegend":true,"card":"P1202"},"normal":[{"comment":null,"region":1,"isLegend":false,"card":"F1207"},{"comment":null,"region":1,"isLegend":false,"card":"F1205"},{"comment":null,"region":1,"isLegend":false,"card":"S1203"}],"share":6},{"normalDeckLength":1,"legendDeckLength":0,"completedModernScoring":false,"era":0,"buildings":[{"building":null,"region":2,"activated":true,"owner":""},{"building":null,"region":2,"activated":false,"owner":""}],"legend":{"comment":null,"region":2,"isLegend":true,"card":"P1302"},"normal":[{"comment":null,"region":2,"isLegend":false,"card":"S1303"},{"comment":null,"region":2,"isLegend":false,"card":"F1304"}],"share":4},{"normalDeckLength":0,"legendDeckLength":0,"completedModernScoring":false,"era":0,"buildings":[{"building":null,"region":3,"activated":true,"owner":""},{"building":null,"region":3,"activated":false,"owner":""}],"legend":{"comment":null,"region":3,"isLegend":true,"card":null},"normal":[{"comment":null,"region":3,"isLegend":false,"card":null},{"comment":null,"region":3,"isLegend":false,"card":null}],"share":0}],"school":[],"film":[],"matchID":"jYFjTuCzX","seed":"kijevgsh"});


        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.undo();
        p0.moves.breakthrough({"card":"B02","idx":0,"playerID":"0","res":2});
        p0.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"0"});

        p0.moves.requestEndTurn("0");

        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0});
        p1.moves.breakthrough({"card":"B01","idx":0,"playerID":"1","res":2});
        p1.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"1"});

        p1.moves.playCard({"card":"B02","idx":0,"playerID":"1","res":0});
        p1.moves.requestEndTurn("1");

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":2,"playerID":"2","res":0});
        p2.moves.breakthrough({"card":"B02","idx":0,"playerID":"2","res":2});
        p2.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"2"});

        p2.moves.playCard({"card":"B01","idx":0,"playerID":"2","res":0});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"B02","idx":0,"playerID":"3","res":2});
        p3.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"3"});

        p3.moves.playCard({"card":"B01","idx":0,"playerID":"3","res":0});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.breakthrough({"card":"B01","idx":0,"playerID":"0","res":2});
        p0.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"0"});

        p0.moves.requestEndTurn("0");

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"S1203","resource":4,"deposit":0,"helper":[]});
        p1.moves.requestEndTurn("1");

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.buyCard({"buyer":"2","target":"F1207","resource":4,"deposit":0,"helper":[]});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"F1104","resource":4,"deposit":0,"helper":[]});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.buyCard({"buyer":"0","target":"F1205","resource":2,"deposit":0,"helper":[]});
        p0.moves.requestEndTurn("0");

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.breakthrough({"card":"B02","idx":0,"playerID":"1","res":2});
        p1.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"1"});

        p1.moves.requestEndTurn("1");

        p2.moves.playCard({"card":"B07","idx":2,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.breakthrough({"card":"F1207","idx":0,"playerID":"2","res":2});
        p2.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"2"});

        p2.moves.playCard({"card":"B01","idx":0,"playerID":"2","res":0});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"B01","idx":0,"playerID":"3","res":2});
        p3.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"3"});

        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.buyCard({"buyer":"0","target":"F1210","resource":3,"deposit":0,"helper":[]});
        p0.moves.requestEndTurn("0");

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"S1303","resource":4,"deposit":0,"helper":[]});
        p1.moves.requestEndTurn("1");

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.buyCard({"buyer":"2","target":"F1109","resource":5,"deposit":0,"helper":[]});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"F1104","idx":0,"playerID":"3","res":2});
        p3.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"3"});

        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.buyCard({"buyer":"0","target":"F1108","resource":3,"deposit":0,"helper":[]});
        p0.moves.requestEndTurn("0");

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"B03","resource":2,"deposit":0,"helper":[]});
        p1.moves.buyCard({"buyer":"1","target":"F1107","resource":2,"deposit":0,"helper":[]});
        p1.moves.requestEndTurn("1");

        p2.moves.playCard({"card":"B07","idx":3,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":2,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.buyCard({"buyer":"2","target":"P1102","resource":5,"deposit":0,"helper":[]});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"P1202","resource":5,"deposit":0,"helper":[]});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"F1205","idx":0,"playerID":"0","res":0});
        p0.undo();
        p0.moves.playCard({"card":"F1205","idx":0,"playerID":"0","res":0});
        p0.undo();
        p0.moves.breakthrough({"card":"F1205","idx":0,"playerID":"0","res":2});
        p0.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"0"});

        p0.moves.requestEndTurn("0");

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B03","idx":0,"playerID":"1","res":0});
        p1.moves.drawCard("1");
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.undo();
        p1.undo();
        p1.undo();
        p1.moves.playCard({"card":"B03","idx":0,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"F1306","resource":3,"deposit":0,"helper":[]});
        p1.moves.buyCard({"buyer":"1","target":"B03","resource":1,"deposit":1,"helper":[]});
        p1.moves.requestEndTurn("1");

        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F1109","idx":1,"playerID":"2","res":0});
        p2.moves.buyCard({"buyer":"2","target":"F1304","resource":5,"deposit":0,"helper":["B01"]});
        p2.moves.requestEndTurn("2");
        p2.moves.chooseEvent({"event":"E03","idx":0,"p":"2"});


        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"F2113","resource":5,"deposit":0,"helper":[]});
        p3.undo();
        p3.moves.drawCard("3");
        p3.moves.playCard({"card":"P1202","idx":0,"playerID":"3","res":0});
        p3.moves.chooseTarget({"target":"3","idx":0,"p":"3","targetName":"P4(*)"});

        p3.undo();
        p3.moves.chooseTarget({"target":"2","idx":3,"p":"3","targetName":"P3"});

        p3.moves.buyCard({"buyer":"3","target":"F2113","resource":5,"deposit":0,"helper":[]});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"F1210","idx":0,"playerID":"0","res":0});
        p0.undo();
        p0.moves.breakthrough({"card":"F1210","idx":0,"playerID":"0","res":2});
        p0.moves.drawCard("0");
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.requestEndTurn("0");

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.drawCard("1");
        p1.moves.playCard({"card":"F1306","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B03","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"F1107","idx":0,"playerID":"1","res":0});
        p1.undo();
        p1.undo();
        p1.moves.playCard({"card":"B03","idx":1,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"P1302","resource":5,"deposit":0,"helper":[]});
        p1.moves.playCard({"card":"F1107","idx":0,"playerID":"1","res":0});
        p1.moves.requestEndTurn("1");
        p1.moves.chooseEvent({"event":"E01","idx":0,"p":"1"});
        p1.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"1"});
        p2.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"2"});
        p3.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"3"});
        p0.moves.chooseEffect({"effect":{"e":"aestheticsLevelUp","a":1},"idx":1,"p":"0"});


        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.drawCard("2");
        p2.moves.playCard({"card":"P1102","idx":1,"playerID":"2","res":0});
        p2.moves.chooseTarget({"target":"1","idx":3,"p":"2","targetName":"P2"});

        p2.moves.breakthrough({"card":"F1109","idx":0,"playerID":"2","res":2});
        p2.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"2"});
        p2.moves.payAdditionalCost({"res":1,"deposit":0});

        p2.moves.requestEndTurn("2");

        p3.moves.drawCard("3");
        p3.moves.playCard({"card":"B07","idx":4,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":3,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"F2107","resource":5,"deposit":0,"helper":["F2113"]});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"V113","idx":1,"playerID":"0","res":0});
        p0.moves.breakthrough({"card":"F1108","idx":0,"playerID":"0","res":2});
        p0.moves.chooseEffect({"effect":{"e":"industryBreakthrough","a":1},"idx":0,"p":"0"});

        p0.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"0"});

        p0.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"0"});
        p0.moves.payAdditionalCost({"res":1,"deposit":0});

        p0.moves.drawCard("0");
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.requestEndTurn("0");

        p1.moves.playCard({"card":"B03","idx":2,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.breakthrough({"card":"B04","idx":0,"playerID":"1","res":2});
        p1.moves.buyCard({"buyer":"1","target":"F1206","resource":1,"deposit":1,"helper":[]});
        p1.moves.requestEndTurn("1");
        p0.moves.chooseEvent({"event":"E04","idx":0,"p":"0"});


        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":2,"playerID":"2","res":0});
        p2.moves.breakthrough({"card":"B01","idx":1,"playerID":"2","res":2});
        p2.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"2"});

        p2.moves.breakthrough({"card":"F1304","idx":0,"playerID":"2","res":2});
        p2.moves.comment({"target":"S2104","comment":"B04","p":"2"});

        p2.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"2"});

        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"P1202","idx":0,"playerID":"3","res":2});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"V112","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"B03","resource":2,"deposit":0,"helper":[]});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"V113","idx":0,"playerID":"0","res":0});
        p0.moves.breakthrough({"card":"B02","idx":0,"playerID":"0","res":2});
        p0.moves.chooseEffect({"effect":{"e":"buildStudio","a":1},"idx":1,"p":"0"});

        p0.moves.chooseRegion({"r":2,"idx":2,"p":"0"});
        p0.moves.payAdditionalCost({"res":3,"deposit":0});

        p0.moves.drawCard("0");
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.requestEndTurn("0");

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.breakthrough({"card":"P1302","idx":2,"playerID":"1","res":2});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"B01","resource":2,"deposit":0,"helper":[]});
        p1.moves.requestEndTurn("1");

        p2.moves.playCard({"card":"B05","idx":1,"playerID":"2","res":0});
        p2.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"2"});

        p2.moves.playCard({"card":"V132","idx":3,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":2,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.drawCard("2");
        p2.moves.playCard({"card":"B07","idx":2,"playerID":"2","res":0});
        p2.moves.playCard({"card":"V111","idx":0,"playerID":"2","res":0});
        p2.moves.buyCard({"buyer":"2","target":"F2406","resource":6,"deposit":0,"helper":[]});
        p2.moves.playCard({"card":"P1102","idx":0,"playerID":"2","res":0});
        p2.moves.chooseTarget({"target":"3","idx":1,"p":"2","targetName":"P4"});

        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card":"F2107","idx":2,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.drawCard("3");
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"S2104","resource":6,"deposit":0,"helper":["B05"]});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.breakthrough({"card":"B04","idx":0,"playerID":"0","res":2});
        p0.moves.buyCard({"buyer":"0","target":"B03","resource":2,"deposit":0,"helper":[]});
        p0.moves.requestEndTurn("0");

        p1.moves.playCard({"card":"B03","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.breakthrough({"card":"B07","idx":0,"playerID":"1","res":2});
        p1.undo();
        p1.undo();
        p1.undo();
        p1.moves.playCard({"card":"B03","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.drawCard("1");
        p1.moves.playCard({"card":"F1206","idx":0,"playerID":"1","res":0});
        p1.moves.comment({"target":"P2302","comment":"B04","p":"1"});

        p1.moves.buyCard({"buyer":"1","target":"F2303","resource":5,"deposit":2,"helper":[]});
        p1.moves.requestEndTurn("1");

        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.breakthrough({"card":"B04","idx":0,"playerID":"2","res":2});
        p2.moves.breakthrough({"card":"B07","idx":0,"playerID":"2","res":2});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card":"V112","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B03","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"F2113","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"B03","resource":2,"deposit":0,"helper":[]});
        p3.moves.buyCard({"buyer":"3","target":"P2102","resource":8,"deposit":0,"helper":[]});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B05","idx":0,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"0"});

        p0.moves.playCard({"card":"V113","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"V121","idx":0,"playerID":"0","res":0});
        p0.moves.drawCard("0");
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.buyCard({"buyer":"0","target":"F2304","resource":6,"deposit":0,"helper":[]});
        p0.moves.requestEndTurn("0");

        p1.moves.playCard({"card":"B03","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"V131","idx":0,"playerID":"1","res":0});
        p1.moves.drawCard("1");
        p1.moves.playCard({"card":"F1206","idx":2,"playerID":"1","res":0});
        p1.moves.comment({"target":"F2309","comment":"B04","p":"1"});

        p1.moves.playCard({"card":"F1306","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"F1107","idx":0,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"F2211","resource":4,"deposit":0,"helper":[]});
        p1.moves.requestEndTurn("1");

        p2.moves.playCard({"card":"P1102","idx":1,"playerID":"2","res":0});
        p2.moves.chooseTarget({"target":"1","idx":3,"p":"2","targetName":"P2"});

        p2.moves.playCard({"card":"F2406","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"V111","idx":0,"playerID":"2","res":0});
        p2.moves.drawCard("2");
        p2.moves.playCard({"card":"V132","idx":0,"playerID":"2","res":0});
        p2.moves.buyCard({"buyer":"2","target":"P2103","resource":7,"deposit":1,"helper":[]});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card":"B07","idx":3,"playerID":"3","res":0});
        p3.moves.playCard({"card":"V122","idx":2,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"B04","idx":1,"playerID":"3","res":2});
        p3.moves.playCard({"card":"P2102","idx":2,"playerID":"3","res":0});
        p3.moves.chooseTarget({"target":"2","idx":3,"p":"3","targetName":"P3"});
        p2.moves.chooseHand({"hand":"V111","idx":2,"p":"2"});
        p3.moves.confirmRespond("no");

        p3.moves.playCard({"card":"B05","idx":2,"playerID":"3","res":0});
        p3.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"3"});

        p3.moves.playCard({"card":"B07","idx":2,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"B02","idx":0,"playerID":"3","res":2});
        p3.moves.chooseEffect({"effect":{"e":"buildCinema","a":1},"idx":2,"p":"3"});

        p3.moves.chooseRegion({"r":0,"idx":0,"p":"3"});

        p3.moves.playCard({"card":"B04","idx":0,"playerID":"3","res":0});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"F2304","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"V121","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"V113","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B03","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.buyCard({"buyer":"0","target":"F2405","resource":6,"deposit":0,"helper":[]});
        p0.undo();
        p0.moves.buyCard({"buyer":"0","target":"F2405","resource":6,"deposit":0,"helper":[]});
        p0.moves.drawCard("0");
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.requestEndTurn("0");

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"V123","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B05","idx":0,"playerID":"1","res":0});
        p1.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"1"});

        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.breakthrough({"card":"B01","idx":0,"playerID":"1","res":2});
        p1.undo();
        p1.moves.drawCard("1");
        p1.moves.playCard({"card":"B03","idx":1,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"F2410","resource":5,"deposit":0,"helper":[]});
        p1.moves.playCard({"card":"B01","idx":0,"playerID":"1","res":0});
        p1.moves.requestEndTurn("1");

        p2.moves.playCard({"card":"B05","idx":0,"playerID":"2","res":0});
        p2.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"2"});

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F2406","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"V132","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"P1102","idx":0,"playerID":"2","res":0});
        p2.moves.chooseTarget({"target":"1","idx":3,"p":"2","targetName":"P2"});

        p2.moves.drawCard("2");
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.buyCard({"buyer":"2","target":"F2106","resource":6,"deposit":1,"helper":[]});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card":"B03","idx":3,"playerID":"3","res":0});
        p3.moves.playCard({"card":"F2113","idx":2,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B03","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"F2112","resource":6,"deposit":0,"helper":[]});
        p3.moves.buyCard({"buyer":"3","target":"F2110","resource":5,"deposit":1,"helper":[]});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"B05","idx":3,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"0"});

        p0.moves.playCard({"card":"B07","idx":3,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.buyCard({"buyer":"0","target":"F2408","resource":5,"deposit":0,"helper":[]});
        p0.moves.drawCard("0");
        p0.moves.playCard({"card":"V113","idx":0,"playerID":"0","res":0});
        p0.moves.requestEndTurn("0");

        p1.moves.playCard({"card":"F2303","idx":2,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":3,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.drawCard("1");
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"F2207","resource":7,"deposit":1,"helper":[]});
        p1.moves.playCard({"card":"F1107","idx":0,"playerID":"1","res":0});
        p1.moves.requestEndTurn("1");

        p2.moves.playCard({"card":"P2103","idx":3,"playerID":"2","res":0});
        p2.moves.chooseTarget({"target":"3","idx":1,"p":"2","targetName":"P4"});
        p3.moves.chooseHand({"hand":"B07","idx":4,"p":"3"});

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.drawCard("2");
        p2.moves.playCard({"card":"V132","idx":1,"playerID":"2","res":0});
        p2.moves.breakthrough({"card":"B05","idx":0,"playerID":"2","res":2});
        p2.moves.chooseEffect({"effect":{"e":"industryBreakthrough","a":1},"idx":0,"p":"2"});

        p2.moves.chooseEffect({"effect":{"e":"buildStudio","a":1},"idx":1,"p":"2"});

        p2.undo();
        p2.moves.chooseEffect({"effect":{"e":"buildCinema","a":1},"idx":2,"p":"2"});

        p2.moves.chooseRegion({"r":0,"idx":0,"p":"2"});
        p2.moves.payAdditionalCost({"res":3,"deposit":0});

        p2.moves.requestEndTurn("2");
        p3.moves.chooseEvent({"event":"E09","idx":1,"p":"3"});


        p3.moves.playCard({"card":"F2107","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"V112","idx":0,"playerID":"3","res":0});
        p3.undo();
        p3.moves.playCard({"card":"B07","idx":3,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"B04","idx":2,"playerID":"3","res":2});
        p3.moves.playCard({"card":"V112","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"V122","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"F2214","resource":7,"deposit":0,"helper":[]});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B03","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"F2405","idx":0,"playerID":"0","res":0});
        p0.moves.updateSlot({"slot":{"comment":null,"region":1,"isLegend":true,"card":"P2202"},"p":"0","cardId":"P2202","updateHistoryIndex":0});

        p0.moves.drawCard("0");
        p0.moves.breakthrough({"card":"V121","idx":0,"playerID":"0","res":2});
        p0.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"0"});
        p0.moves.payAdditionalCost({"res":1,"deposit":0});

        p0.moves.requestEndTurn("0");

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.breakthrough({"card":"B01","idx":1,"playerID":"1","res":2});
        p1.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"1"});

        p1.moves.drawCard("1");
        p1.moves.playCard({"card":"V123","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B03","idx":0,"playerID":"1","res":0});
        p1.moves.requestEndTurn("1");

        p2.moves.playCard({"card":"F2106","idx":3,"playerID":"2","res":0});
        p2.undo();
        p2.moves.playCard({"card":"P1102","idx":0,"playerID":"2","res":0});
        p2.moves.chooseTarget({"target":"1","idx":3,"p":"2","targetName":"P2"});

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B05","idx":0,"playerID":"2","res":0});
        p2.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"2"});

        p2.moves.playCard({"card":"F2406","idx":2,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F2106","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"V111","idx":0,"playerID":"2","res":0});
        p2.moves.drawCard("2");
        p2.moves.playCard({"card":"V132","idx":0,"playerID":"2","res":0});
        p2.moves.buyCard({"buyer":"2","target":"F2208","resource":6,"deposit":0,"helper":[]});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card":"B03","idx":2,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":2,"playerID":"3","res":0});
        p3.moves.playCard({"card":"F2113","idx":3,"playerID":"3","res":0});
        p3.moves.playCard({"card":"F2110","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"P2102","idx":0,"playerID":"3","res":0});
        p3.moves.chooseTarget({"target":"2","idx":3,"p":"3","targetName":"P3"});
        p2.moves.chooseHand({"hand":"V212","idx":4,"p":"2"});
        p3.moves.confirmRespond("no");

        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"B04","idx":0,"playerID":"3","res":2});
        p3.moves.buyCard({"buyer":"3","target":"F2213","resource":7,"deposit":0,"helper":[]});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"F2304","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B03","idx":4,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":3,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.drawCard("0");
        p0.moves.playCard({"card":"F2408","idx":1,"playerID":"0","res":0});
        p0.moves.updateSlot({"slot":{"comment":"B04","region":2,"isLegend":true,"card":"P2302"},"p":"0","cardId":"P2302","updateHistoryIndex":1});

        p0.moves.buyCard({"buyer":"0","target":"S2201","resource":8,"deposit":0,"helper":["B05"]});
        p0.moves.requestEndTurn("0");

        p1.moves.playCard({"card":"B05","idx":1,"playerID":"1","res":0});
        p1.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"1"});

        p1.moves.playCard({"card":"F2410","idx":3,"playerID":"1","res":0});
        p1.moves.playCard({"card":"V131","idx":2,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B03","idx":1,"playerID":"1","res":0});
        p1.moves.drawCard("1");
        p1.moves.playCard({"card":"F1306","idx":0,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"P2202","resource":5,"deposit":3,"helper":["F2211"]});
        p1.moves.chooseEffect({"effect":{"e":"buy","a":"F2209","target":"1"},"idx":1,"p":"1"});

        p1.moves.requestEndTurn("1");

        p2.moves.playCard({"card":"P2103","idx":2,"playerID":"2","res":0});
        p2.moves.chooseTarget({"target":"1","idx":3,"p":"2","targetName":"P2"});
        p1.moves.chooseHand({"hand":"B07","idx":3,"p":"1"});

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.drawCard("2");
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.buyCard({"buyer":"2","target":"F2409","resource":5,"deposit":0,"helper":["B05"]});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card":"B05","idx":0,"playerID":"3","res":0});
        p3.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"3"});

        p3.moves.playCard({"card":"F2213","idx":5,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":5,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":4,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B03","idx":0,"playerID":"3","res":0});
        p3.moves.drawCard("3");
        p3.moves.playCard({"card":"B07","idx":2,"playerID":"3","res":0});
        p3.moves.playCard({"card":"P2102","idx":1,"playerID":"3","res":0});
        p3.moves.chooseTarget({"target":"2","idx":3,"p":"3","targetName":"P3"});
        p2.moves.chooseHand({"hand":"V212","idx":4,"p":"2"});
        p3.moves.confirmRespond("no");

        p3.moves.buyCard({"buyer":"3","target":"F3104","resource":10,"deposit":1,"helper":["F2112","V211"]});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"F2405","idx":1,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"breakthroughResDeduct","a":2},"idx":1,"p":"0"});
        p0.moves.chooseHand({"hand":"V113","idx":1,"p":"0"});

        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.buyCard({"buyer":"0","target":"F2206","resource":4,"deposit":0,"helper":[]});
        p0.moves.drawCard("0");
        p0.moves.playCard({"card":"B04","idx":0,"playerID":"0","res":0});
        p0.moves.requestEndTurn("0");
        p0.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"0"});
        p1.moves.chooseEvent({"event":"E06","idx":0,"p":"1"});


        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B05","idx":1,"playerID":"1","res":0});
        p1.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"1"});

        p1.moves.drawCard("1");
        p1.moves.playCard({"card":"B07","idx":3,"playerID":"1","res":0});
        p1.moves.drawCard("1");
        p1.moves.playCard({"card":"B03","idx":3,"playerID":"1","res":0});
        p1.moves.playCard({"card":"P2202","idx":2,"playerID":"1","res":0});
        p1.moves.chooseHand({"hand":"F1206","idx":0,"p":"1"});
        p1.moves.chooseHand({"hand":"B04","idx":0,"p":"1"});

        p1.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"1"});
        p1.moves.payAdditionalCost({"res":1,"deposit":0});
        p1.moves.chooseTarget({"target":"0","idx":3,"p":"1","targetName":"P1"});

        p1.moves.requestEndTurn("1");

        p2.moves.playCard({"card":"F2106","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.drawCard("2");
        p2.moves.playCard({"card":"F2409","idx":0,"playerID":"2","res":0});
        p2.moves.updateSlot({"slot":{"comment":null,"region":0,"isLegend":false,"card":"F3108"},"p":"2","cardId":"F3108","updateHistoryIndex":2});

        p2.moves.buyCard({"buyer":"2","target":"P2402","resource":7,"deposit":3,"helper":[]});
        p2.moves.requestEndTurn("2");
        p2.moves.chooseEvent({"event":"E08","idx":0,"p":"2"});
        p1.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"1"});
        p3.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"3"});


        p3.moves.playCard({"card":"V112","idx":5,"playerID":"3","res":0});
        p3.undo();
        p3.moves.playCard({"card":"B03","idx":3,"playerID":"3","res":0});
        p3.moves.playCard({"card":"F2110","idx":2,"playerID":"3","res":0});
        p3.moves.playCard({"card":"F2214","idx":2,"playerID":"3","res":0});
        p3.moves.playCard({"card":"V122","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"F2107","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"V112","idx":0,"playerID":"3","res":0});
        p3.moves.drawCard("3");
        p3.moves.playCard({"card":"F2113","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"F3112","resource":14,"deposit":0,"helper":[]});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"F2304","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"F2408","idx":4,"playerID":"0","res":0});
        p0.moves.comment({"target":"F3115","comment":"B04","p":"0"});
        p0.moves.peek({"idx":0,"card":null,"p":"0","shownCards":["F2405","B07"]});

        p0.moves.playCard({"card":"F2405","idx":5,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"breakthroughResDeduct","a":2},"idx":1,"p":"0"});
        p0.moves.chooseHand({"hand":"B04","idx":3,"p":"0"});

        p0.moves.playCard({"card":"B07","idx":3,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B03","idx":0,"playerID":"0","res":0});
        p0.moves.drawCard("0");
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.buyCard({"buyer":"0","target":"P2302","resource":7,"deposit":1,"helper":[]});
        p0.moves.requestEndTurn("0");

        p1.moves.playCard({"card":"F2303","idx":2,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0});
        p1.moves.playCard({"card":"F2207","idx":1,"playerID":"1","res":0});
        p1.undo();
        p1.moves.drawCard("1");
        p1.moves.playCard({"card":"F2207","idx":1,"playerID":"1","res":0});
        p1.moves.chooseHand({"hand":"B04","idx":2,"p":"1"});

        p1.moves.breakthrough({"card":"F2211","idx":1,"playerID":"1","res":2});
        p1.moves.comment({"target":"F3412","comment":"B04","p":"1"});
        p1.moves.chooseEffect({"effect":{"e":"industryBreakthrough","a":1},"idx":0,"p":"1"});

        p1.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"1"});
        p1.moves.payAdditionalCost({"res":1,"deposit":0});

        p1.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"1"});
        p1.moves.payAdditionalCost({"res":1,"deposit":0});

        p1.moves.playCard({"card":"F1107","idx":0,"playerID":"1","res":0});
        p1.moves.requestEndTurn("1");

        p2.moves.playCard({"card":"P2103","idx":2,"playerID":"2","res":0});
        p2.moves.chooseTarget({"target":"3","idx":1,"p":"2","targetName":"P4"});
        p3.moves.chooseHand({"hand":"B07","idx":3,"p":"3"});

        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B05","idx":1,"playerID":"2","res":0});
        p2.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"2"});

        p2.moves.playCard({"card":"B05","idx":1,"playerID":"2","res":0});
        p2.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"2"});

        p2.moves.playCard({"card":"B05","idx":1,"playerID":"2","res":0});
        p2.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"2"});

        p2.moves.playCard({"card":"V132","idx":2,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F2406","idx":1,"playerID":"2","res":0});
        p2.moves.peek({"idx":0,"card":null,"p":"2","shownCards":["F2208","P1102","F2409"]});

        p2.moves.playCard({"card":"F2208","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B05","idx":2,"playerID":"2","res":0});
        p2.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"2"});

        p2.moves.playCard({"card":"B07","idx":2,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F2409","idx":1,"playerID":"2","res":0});
        p2.moves.updateSlot({"slot":{"comment":"B04","region":2,"isLegend":false,"card":"F2309"},"p":"2","cardId":"F2309","updateHistoryIndex":3});

        p2.moves.breakthrough({"card":"V111","idx":0,"playerID":"2","res":2});
        p2.moves.chooseEffect({"effect":{"e":"buildStudio","a":1},"idx":1,"p":"2"});

        p2.undo();
        p2.undo();
        p2.undo();
        p2.undo();
        p2.undo();
        p2.undo();
        p2.undo();
        p2.moves.playCard({"card":"F2409","idx":1,"playerID":"2","res":0});
        p2.moves.updateSlot({"slot":{"comment":"B04","region":2,"isLegend":false,"card":"F2309"},"p":"2","cardId":"F2309","updateHistoryIndex":3});

        p2.moves.breakthrough({"card":"V111","idx":0,"playerID":"2","res":2});
        p2.moves.chooseEffect({"effect":{"e":"buildStudio","a":1},"idx":1,"p":"2"});

        p2.moves.chooseRegion({"r":2,"idx":1,"p":"2"});
        p2.moves.payAdditionalCost({"res":3,"deposit":0});

        p2.moves.breakthrough({"card":"B05","idx":0,"playerID":"2","res":2});
        p2.moves.chooseEffect({"effect":{"e":"industryBreakthrough","a":1},"idx":0,"p":"2"});

        p2.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"2"});

        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card":"V122","idx":3,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"V112","idx":0,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"V211","idx":1,"playerID":"3","res":2});
        p3.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"3"});
        p3.moves.payAdditionalCost({"res":2,"deposit":0});

        p3.undo();
        p3.undo();
        p3.undo();
        p3.moves.breakthrough({"card":"B04","idx":2,"playerID":"3","res":2});
        p3.moves.breakthrough({"card":"V211","idx":1,"playerID":"3","res":2});
        p3.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"3"});
        p3.moves.payAdditionalCost({"res":2,"deposit":0});

        p3.moves.playCard({"card":"B05","idx":0,"playerID":"3","res":0});
        p3.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"3"});

        p3.moves.playCard({"card":"F2214","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"F2112","idx":0,"playerID":"3","res":0});
        p3.moves.confirmRespond("yes");
        p3.moves.payAdditionalCost({"res":1,"deposit":0});
        p3.moves.chooseTarget({"target":"0","idx":0,"p":"3","targetName":"P1"});
        p3.moves.competitionCard({"pass":false,"card":"B03","idx":0,"p":"3"});
        p0.moves.competitionCard({"pass":false,"card":"F2304","idx":3,"p":"0"});
        p3.moves.showCompetitionResult({"info":{"region":0,"atk":"3","atkPlayedCard":false,"atkCard":"B03","def":"0","defPlayedCard":false,"defCard":"F2304","progress":1,"pending":true,"onWin":{"e":"none","a":1}}});

        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"F2408","idx":3,"playerID":"0","res":0});
        p0.moves.comment({"target":"P3102","comment":"B04","p":"0"});
        p0.moves.peek({"idx":0,"card":null,"p":"0","shownCards":["F2405","P2302"]});

        p0.moves.playCard({"card":"F2206","idx":0,"playerID":"0","res":0});
        p0.moves.comment({"target":"F3116","comment":"B04","p":"0"});

        p0.moves.playCard({"card":"F2405","idx":5,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"breakthroughResDeduct","a":2},"idx":1,"p":"0"});
        p0.moves.chooseHand({"hand":"B04","idx":4,"p":"0"});

        p0.moves.playCard({"card":"B05","idx":4,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"0"});

        p0.moves.playCard({"card":"B05","idx":0,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"0"});

        p0.moves.playCard({"card":"B07","idx":3,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.breakthrough({"card":"V242","idx":0,"playerID":"0","res":2});
        p0.moves.buyCard({"buyer":"0","target":"F3213","resource":4,"deposit":1,"helper":[]});
        p0.moves.requestEndTurn("0");

        p1.moves.playCard({"card":"B03","idx":4,"playerID":"1","res":0});
        p1.moves.playCard({"card":"F2410","idx":3,"playerID":"1","res":0});
        p1.moves.peek({"idx":1,"card":"F2209","p":"1","shownCards":["F1306","F2209"]});

        p1.moves.playCard({"card":"F2209","idx":3,"playerID":"1","res":0});
        p1.moves.playCard({"card":"V131","idx":2,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.drawCard("1");
        p1.moves.playCard({"card":"V123","idx":0,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"S3105","resource":8,"deposit":2,"helper":[]});
        p1.moves.requestEndTurn("1");

        p2.moves.playCard({"card":"P2402","idx":2,"playerID":"2","res":0});
        p2.moves.chooseTarget({"target":"3","idx":1,"p":"2","targetName":"P4"});

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.breakthrough({"card":"B04","idx":0,"playerID":"2","res":2});
        p2.moves.buyCard({"buyer":"2","target":"B03","resource":2,"deposit":0,"helper":[]});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card":"F2107","idx":3,"playerID":"3","res":0});
        p3.moves.playCard({"card":"F3112","idx":4,"playerID":"3","res":0});
        p3.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"3"});

        p3.moves.playCard({"card":"F3104","idx":2,"playerID":"3","res":0});
        p3.moves.confirmRespond("no");

        p3.undo();
        p3.moves.confirmRespond("yes");
        p3.moves.payAdditionalCost({"res":1,"deposit":0});
        p3.moves.chooseTarget({"target":"0","idx":0,"p":"3","targetName":"P1"});
        p3.moves.competitionCard({"pass":false,"card":"F2110","idx":2,"p":"3"});
        p0.moves.competitionCard({"pass":false,"card":"P2302","idx":4,"p":"0"});
        p0.moves.chooseTarget({"target":"3","idx":0,"p":"0","targetName":"玩家3(*)"});
        p0.moves.chooseHand({"hand":"B07","idx":4,"p":"0"});
        p2.moves.chooseTarget({"target":"3","idx":0,"p":"2","targetName":"P4(*)"});
        p2.moves.chooseHand({"hand":"B04","idx":1,"p":"2"});
        p3.moves.showCompetitionResult({"info":{"region":0,"atk":"3","atkPlayedCard":false,"atkCard":"F2110","def":"0","defPlayedCard":false,"defCard":"P2302","progress":5,"pending":true,"onWin":{"e":"anyRegionShareCentral","a":1}}});
        p3.moves.chooseRegion({"r":2,"idx":2,"p":"3"});
        p3.undo();
        p3.moves.chooseRegion({"r":1,"idx":1,"p":"3"});
        p3.moves.chooseRegion({"r":1,"idx":0,"p":"3"});

        p3.moves.playCard({"card":"B03","idx":2,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"B04","idx":0,"playerID":"3","res":2});
        p3.moves.breakthrough({"card":"B04","idx":0,"playerID":"3","res":2});
        p3.undo();
        p3.moves.buyCard({"buyer":"3","target":"F3109","resource":15,"deposit":3,"helper":[]});
        p3.moves.playCard({"card":"B04","idx":0,"playerID":"3","res":0});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"B07","idx":3,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B03","idx":0,"playerID":"0","res":0});
        p0.moves.drawCard("0");
        p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"F2405","idx":1,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"breakthroughResDeduct","a":2},"idx":1,"p":"0"});
        p0.moves.chooseHand({"hand":"V222","idx":0,"p":"0"});

        p0.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"0"});
        p0.moves.payAdditionalCost({"res":2,"deposit":0});

        p0.moves.buyCard({"buyer":"0","target":"F3413","resource":3,"deposit":3,"helper":[]});
        p0.moves.requestEndTurn("0");

        p1.moves.playCard({"card":"V123","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"V221","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"V243","idx":3,"playerID":"1","res":0});
        p1.moves.playCard({"card":"P2202","idx":2,"playerID":"1","res":0});
        p1.moves.chooseHand({"hand":"F1306","idx":1,"p":"1"});

        p1.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"1"});
        p1.moves.payAdditionalCost({"res":1,"deposit":0});
        p1.moves.chooseTarget({"target":"0","idx":3,"p":"1","targetName":"P1"});

        p1.moves.playCard({"card":"B05","idx":0,"playerID":"1","res":0});
        p1.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"1"});

        p1.moves.drawCard("1");
        p1.moves.playCard({"card":"F2207","idx":0,"playerID":"1","res":0});
        p1.moves.chooseHand({"hand":"B07","idx":0,"p":"1"});

        p1.moves.buyCard({"buyer":"1","target":"F2307","resource":3,"deposit":1,"helper":[]});
        p1.moves.requestEndTurn("1");
        p1.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"1"});
        p0.moves.chooseEvent({"event":"E07","idx":1,"p":"0"});
        p0.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"0"});
        p1.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"1"});
        p2.moves.chooseEffect({"effect":{"e":"aestheticsLevelUp","a":1},"idx":1,"p":"2"});
        p3.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"3"});


        p2.moves.playCard({"card":"B07","idx":3,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F2208","idx":3,"playerID":"2","res":0});
        p2.moves.playCard({"card":"V132","idx":3,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F2106","idx":2,"playerID":"2","res":0});
        p2.moves.chooseEffect({"effect":{"e":"aestheticsLevelUp","a":1},"idx":1,"p":"2"});

        p2.moves.playCard({"card":"V241","idx":1,"playerID":"2","res":0});
        p2.moves.buyCard({"buyer":"2","target":"F3311","resource":6,"deposit":1,"helper":[]});
        p2.undo();
        p2.undo();
        p2.moves.breakthrough({"card":"V212","idx":0,"playerID":"2","res":2});
        p2.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"2"});
        p2.moves.payAdditionalCost({"res":2,"deposit":0});

        p2.moves.playCard({"card":"V241","idx":0,"playerID":"2","res":0});
        p2.undo();
        p2.undo();
        p2.undo();
        p2.undo();
        p2.undo();
        p2.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"2"});

        p2.moves.playCard({"card":"V241","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"V212","idx":0,"playerID":"2","res":0});
        p2.moves.drawCard("2");
        p2.moves.breakthrough({"card":"P1102","idx":0,"playerID":"2","res":2});
        p2.undo();
        p2.moves.buyCard({"buyer":"2","target":"F3311","resource":7,"deposit":0,"helper":[]});
        p2.moves.playCard({"card":"P1102","idx":0,"playerID":"2","res":0});
        p2.moves.chooseTarget({"target":"3","idx":1,"p":"2","targetName":"P4"});

        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card":"P2102","idx":5,"playerID":"3","res":0});
        p3.moves.chooseTarget({"target":"2","idx":3,"p":"3","targetName":"P3"});
        p2.moves.chooseHand({"hand":"B05","idx":0,"p":"2"});
        p3.moves.confirmRespond("yes");
        p3.moves.payAdditionalCost({"res":1,"deposit":0});
        p3.moves.chooseTarget({"target":"0","idx":0,"p":"3","targetName":"P1"});
        p3.moves.competitionCard({"pass":false,"card":"F2113","idx":1,"p":"3"});
        p0.moves.competitionCard({"pass":false,"card":"F2304","idx":4,"p":"0"});
        p3.moves.showCompetitionResult({"info":{"region":0,"atk":"3","atkPlayedCard":false,"atkCard":"F2113","def":"0","defPlayedCard":false,"defCard":"F2304","progress":3,"pending":true,"onWin":{"e":"none","a":1}}});
        p3.moves.chooseRegion({"r":3,"idx":0,"p":"3"});

        p3.moves.playCard({"card":"F2213","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":5,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":3,"playerID":"3","res":0});
        p3.moves.playCard({"card":"V223","idx":2,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B05","idx":0,"playerID":"3","res":0});
        p3.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"3"});

        p3.moves.playCard({"card":"F2107","idx":1,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"B04","idx":0,"playerID":"3","res":2});
        p3.moves.buyCard({"buyer":"3","target":"F3304","resource":9,"deposit":3,"helper":[]});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"F2408","idx":2,"playerID":"0","res":0});
        p0.moves.comment({"target":"P3106","comment":"B04","p":"0"});
        p0.moves.peek({"idx":0,"card":null,"p":"0","shownCards":["F2405","P2302"]});

        p0.moves.playCard({"card":"F2206","idx":3,"playerID":"0","res":0});
        p0.moves.comment({"target":"F3412","comment":null,"p":"0"});

        p0.moves.playCard({"card":"F3213","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"F2405","idx":4,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"step","a":[{"e":"res","a":1},{"e":"update","a":1}]},"idx":0,"p":"0"});
        p0.moves.updateSlot({"slot":{"comment":null,"region":2,"isLegend":false,"card":"F3305"},"p":"0","cardId":"F3305","updateHistoryIndex":4});

        p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B03","idx":2,"playerID":"0","res":0});
        p0.moves.buyCard({"buyer":"0","target":"P3301","resource":9,"deposit":0,"helper":["B05","B05"]});
        p0.moves.buyCard({"buyer":"0","target":"F3410","resource":0,"deposit":4,"helper":[]});
        p0.moves.requestEndTurn("0");

        p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"F2410","idx":6,"playerID":"1","res":0});
        p1.moves.peek({"idx":0,"card":"F2209","p":"1","shownCards":["F2209","B04"]});

        p1.moves.playCard({"card":"F2209","idx":6,"playerID":"1","res":0});
        p1.undo();
        p1.moves.playCard({"card":"B07","idx":5,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B03","idx":4,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":3,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0});
        p1.moves.breakthrough({"card":"F1107","idx":1,"playerID":"1","res":2});
        p1.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"1"});
        p1.moves.payAdditionalCost({"res":2,"deposit":0});

        p1.moves.breakthrough({"card":"B05","idx":0,"playerID":"1","res":2});
        p1.undo();
        p1.moves.playCard({"card":"F2209","idx":1,"playerID":"1","res":0});
        p1.moves.breakthrough({"card":"B05","idx":0,"playerID":"1","res":2});
        p1.moves.chooseEffect({"effect":{"e":"aestheticsBreakthrough","a":1},"idx":1,"p":"1"});

        p1.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"1"});
        p1.moves.payAdditionalCost({"res":2,"deposit":0});

        p1.moves.requestEndTurn("1");

        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B03","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.drawCard("2");
        p2.moves.playCard({"card":"B05","idx":0,"playerID":"2","res":0});
        p2.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"2"});

        p2.moves.playCard({"card":"F2406","idx":0,"playerID":"2","res":0});
        p2.moves.peek({"idx":0,"card":null,"p":"2","shownCards":["P2103","P2402","B05"]});

        p2.moves.playCard({"card":"B05","idx":0,"playerID":"2","res":0});
        p2.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"2"});

        p2.moves.playCard({"card":"F2409","idx":0,"playerID":"2","res":0});
        p2.moves.updateSlot({"slot":{"comment":null,"region":2,"isLegend":false,"card":"F3308"},"p":"2","cardId":"F3308","updateHistoryIndex":5});

        p2.moves.buyCard({"buyer":"2","target":"F3310","resource":8,"deposit":2,"helper":[]});
        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card":"F3104","idx":1,"playerID":"3","res":0});
        p3.moves.confirmRespond("yes");
        p3.moves.payAdditionalCost({"res":1,"deposit":0});
        p3.moves.chooseTarget({"target":"0","idx":0,"p":"3","targetName":"P1"});
        p3.moves.competitionCard({"pass":false,"card":"F2110","idx":2,"p":"3"});
        p0.moves.competitionCard({"pass":false,"card":"F2304","idx":4,"p":"0"});
        p3.moves.showCompetitionResult({"info":{"region":0,"atk":"3","atkPlayedCard":false,"atkCard":"F2110","def":"0","defPlayedCard":false,"defCard":"F2304","progress":5,"pending":true,"onWin":{"e":"anyRegionShareCentral","a":1}}});
        p3.moves.chooseRegion({"r":0,"idx":0,"p":"3"});
        p3.moves.chooseRegion({"r":2,"idx":0,"p":"3"});

        p3.moves.playCard({"card":"B03","idx":0,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B03","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"V122","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B05","idx":0,"playerID":"3","res":0});
        p3.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"3"});

        p3.moves.playCard({"card":"F3112","idx":2,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"B04","idx":0,"playerID":"3","res":2});
        p3.moves.buyCard({"buyer":"3","target":"P3402","resource":14,"deposit":5,"helper":[]});
        p3.moves.chooseEffect({"effect":{"e":"buy","a":"F3405","target":"3"},"idx":1,"p":"3"});

        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"F2405","idx":5,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"breakthroughResDeduct","a":2},"idx":1,"p":"0"});
        p0.undo();
        p0.undo();
        p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"F3413","idx":1,"playerID":"0","res":0});
        p0.moves.comment({"target":"F3407","comment":"B04","p":"0"});

        p0.moves.playCard({"card":"F3410","idx":3,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B05","idx":4,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"0"});

        p0.moves.playCard({"card":"B05","idx":1,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"0"});

        p0.moves.playCard({"card":"F2408","idx":3,"playerID":"0","res":0});
        p0.moves.comment({"target":"F3307","comment":"B04","p":"0"});
        p0.moves.peek({"idx":0,"card":null,"p":"0","shownCards":["B07","P2302"]});

        p0.moves.playCard({"card":"F2405","idx":1,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"breakthroughResDeduct","a":2},"idx":1,"p":"0"});
        p0.moves.chooseHand({"hand":"V231","idx":0,"p":"0"});

        p0.moves.chooseEffect({"effect":{"e":"buildCinema","a":1},"idx":1,"p":"0"});

        p0.moves.chooseRegion({"r":1,"idx":2,"p":"0"});
        p0.moves.payAdditionalCost({"res":3,"deposit":0});

        p0.moves.playCard({"card":"F3213","idx":0,"playerID":"0","res":0});
        p0.moves.buyCard({"buyer":"0","target":"F3305","resource":7,"deposit":0,"helper":[]});
        p0.moves.playCard({"card":"B03","idx":0,"playerID":"0","res":0});
        p0.moves.buyCard({"buyer":"0","target":"F3209","resource":2,"deposit":3,"helper":[]});
        p0.moves.requestEndTurn("0");
        p0.moves.chooseEffect({"effect":{"e":"aestheticsLevelUp","a":1},"idx":1,"p":"0"});


        p1.moves.playCard({"card":"F2410","idx":5,"playerID":"1","res":0});
        p1.moves.peek({"idx":1,"card":"V221","p":"1","shownCards":["V123","V221"]});

        p1.moves.playCard({"card":"F2209","idx":7,"playerID":"1","res":0});
        p1.moves.playCard({"card":"F2303","idx":1,"playerID":"1","res":0});
        p1.moves.chooseHand({"hand":"B07","idx":8,"p":"1"});
        p1.moves.chooseHand({"hand":"B07","idx":0,"p":"1"});

        p1.moves.playCard({"card":"B03","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B03","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"F2207","idx":2,"playerID":"1","res":0});
        p1.moves.chooseHand({"hand":"V131","idx":0,"p":"1"});

        p1.moves.drawCard("1");
        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.playCard({"card":"V221","idx":0,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"F3303","resource":10,"deposit":3,"helper":[]});
        p1.moves.requestEndTurn("1");

        p2.moves.playCard({"card":"F3310","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"P1102","idx":4,"playerID":"2","res":0});
        p2.moves.chooseTarget({"target":"3","idx":1,"p":"2","targetName":"P4"});

        p2.moves.playCard({"card":"B05","idx":1,"playerID":"2","res":0});
        p2.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"2"});

        p2.moves.playCard({"card":"F2106","idx":4,"playerID":"2","res":0});
        p2.moves.playCard({"card":"V132","idx":3,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B03","idx":2,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.drawCard("2");
        p2.moves.buyCard({"buyer":"2","target":"F3308","resource":8,"deposit":4,"helper":[]});
        p2.moves.requestEndTurn("2");
        p2.moves.chooseEvent({"event":"E05","idx":1,"p":"2"});


        p3.moves.playCard({"card":"F2112","idx":6,"playerID":"3","res":0});
        p3.moves.confirmRespond("yes");
        p3.moves.payAdditionalCost({"res":1,"deposit":0});
        p3.moves.chooseTarget({"target":"0","idx":0,"p":"3","targetName":"P1"});
        p3.moves.competitionCard({"pass":false,"card":"F3109","idx":2,"p":"3"});
        p0.moves.competitionCard({"pass":false,"card":"F3305","idx":4,"p":"0"});
        p3.moves.showCompetitionResult({"info":{"region":0,"atk":"3","atkPlayedCard":false,"atkCard":"F3109","def":"0","defPlayedCard":false,"defCard":"F3305","progress":2,"pending":true,"onWin":{"e":"none","a":1}}});

        p3.moves.playCard({"card":"F2214","idx":3,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B03","idx":5,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":4,"playerID":"3","res":0});
        p3.moves.playCard({"card":"V112","idx":3,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":2,"playerID":"3","res":0});
        p3.moves.breakthrough({"card":"B04","idx":0,"playerID":"3","res":2});
        p3.moves.playCard({"card":"B04","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"F3115","resource":8,"deposit":0,"helper":[]});
        p3.moves.requestEndTurn("3");

        p0.moves.playCard({"card":"P3301","idx":1,"playerID":"0","res":0});
        p0.moves.chooseTarget({"target":"1","idx":0,"p":"0","targetName":"P2"});
        p1.moves.chooseHand({"hand":"P2202","idx":5,"p":"1"});
        p0.moves.chooseTarget({"target":"3","idx":3,"p":"0","targetName":"P4"});
        p0.moves.chooseHand({"hand":"B07","idx":8,"p":"0"});
        p2.moves.chooseTarget({"target":"3","idx":3,"p":"2","targetName":"P4"});
        p2.moves.chooseHand({"hand":"B04","idx":0,"p":"2"});

        p0.moves.playCard({"card":"P2302","idx":9,"playerID":"0","res":0});
        p0.moves.chooseTarget({"target":"3","idx":3,"p":"0","targetName":"P4"});
        p0.moves.chooseHand({"hand":"B07","idx":1,"p":"0"});
        p2.moves.chooseTarget({"target":"3","idx":3,"p":"2","targetName":"P4"});
        p2.moves.chooseHand({"hand":"B07","idx":2,"p":"2"});

        p0.moves.playCard({"card":"F2304","idx":7,"playerID":"0","res":0});
        p0.moves.playCard({"card":"F3410","idx":8,"playerID":"0","res":0});
        p0.moves.playCard({"card":"F3413","idx":7,"playerID":"0","res":0});
        p0.moves.comment({"target":"P3107","comment":"B04","p":"0"});

        p0.moves.playCard({"card":"F2206","idx":0,"playerID":"0","res":0});
        p0.moves.comment({"target":"S3204","comment":"B04","p":"0"});

        p0.moves.playCard({"card":"F3213","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"F3209","idx":2,"playerID":"0","res":0});
        p0.moves.updateSlot({"slot":{"comment":null,"region":3,"isLegend":false,"card":"F3412"},"p":"0","cardId":"F3412","updateHistoryIndex":6});

        p0.moves.playCard({"card":"F2405","idx":3,"playerID":"0","res":0});
        p0.moves.chooseEffect({"effect":{"e":"breakthroughResDeduct","a":2},"idx":1,"p":"0"});
        p0.moves.chooseHand({"hand":"B07","idx":4,"p":"0"});

        p0.moves.playCard({"card":"F2408","idx":2,"playerID":"0","res":0});
        p0.moves.comment({"target":"F3408","comment":"B04","p":"0"});
        p0.moves.peek({"idx":0,"card":null,"p":"0","shownCards":["B04","F3305"]});

        p0.moves.playCard({"card":"F3305","idx":5,"playerID":"0","res":0});
        p0.undo();
        p0.undo();
        p0.moves.peek({"idx":0,"card":null,"p":"0","shownCards":["B04","F3305"]});

        p0.moves.playCard({"card":"B07","idx":4,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B03","idx":2,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
        p0.moves.buyCard({"buyer":"0","target":"F3208","resource":6,"deposit":0,"helper":["B05","B05"]});
        p0.moves.buyCard({"buyer":"0","target":"F3211","resource":6,"deposit":0,"helper":[]});
        p0.moves.playCard({"card":"F3305","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"F3208","idx":0,"playerID":"0","res":0});
        p0.moves.playCard({"card":"F3211","idx":1,"playerID":"0","res":0});
        p0.moves.playCard({"card":"B04","idx":0,"playerID":"0","res":0});
        p0.moves.requestEndTurn("0");
        p0.moves.chooseEffect({"effect":{"e":"aestheticsLevelUp","a":1},"idx":1,"p":"0"});


        p1.moves.playCard({"card":"F2209","idx":7,"playerID":"1","res":0});
        p1.moves.playCard({"card":"F3303","idx":6,"playerID":"1","res":0});
        p1.moves.chooseEffect({"effect":{"e":"aestheticsToVp","a":1},"idx":0,"p":"1"});

        p1.moves.playCard({"card":"V243","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"V232","idx":0,"playerID":"1","res":0});
        p1.moves.playCard({"card":"V123","idx":3,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":3,"playerID":"1","res":0});
        p1.moves.playCard({"card":"B07","idx":3,"playerID":"1","res":0});
        p1.moves.playCard({"card":"F2307","idx":0,"playerID":"1","res":0});
        p1.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"1"});
        p1.undo();
        p1.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"1"});
        p1.moves.comment({"target":"P3102","comment":null,"p":"1"});

        p1.moves.drawCard("1");
        p1.moves.playCard({"card":"F2303","idx":2,"playerID":"1","res":0});
        p1.moves.chooseHand({"hand":"B04","idx":1,"p":"1"});
        p1.moves.chooseHand({"hand":"B07","idx":1,"p":"1"});

        p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
        p1.moves.buyCard({"buyer":"1","target":"P3203","resource":10,"deposit":0,"helper":["B05"]});
        p1.moves.chooseEffect({"effect":{"e":"buy","a":"F3212","target":"1"},"idx":1,"p":"1"});

        p1.moves.requestEndTurn("1");

        p2.moves.playCard({"card":"F2406","idx":1,"playerID":"2","res":0});
        p2.moves.peek({"idx":0,"card":null,"p":"2","shownCards":["P2103","B05","F3311"]});

        p2.moves.playCard({"card":"F3311","idx":7,"playerID":"2","res":0});
        p2.moves.playCard({"card":"B07","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"F2409","idx":0,"playerID":"2","res":0});
        p2.moves.updateSlot({"slot":{"comment":"B04","region":3,"isLegend":false,"card":"F3408"},"p":"2","cardId":"F3408","updateHistoryIndex":7});

        p2.moves.playCard({"card":"V241","idx":0,"playerID":"2","res":0});
        p2.moves.playCard({"card":"P2402","idx":0,"playerID":"2","res":0});
        p2.moves.chooseTarget({"target":"3","idx":1,"p":"2","targetName":"P4"});

        p2.moves.playCard({"card":"B07","idx":1,"playerID":"2","res":0});
        p2.moves.buyCard({"buyer":"2","target":"P3102","resource":9,"deposit":0,"helper":["B05"]});
        p2.moves.breakthrough({"card":"B05","idx":0,"playerID":"2","res":1});
        p2.moves.chooseEffect({"effect":{"e":"industryBreakthrough","a":1},"idx":0,"p":"2"});

        p2.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"2"});

        p2.moves.requestEndTurn("2");

        p3.moves.playCard({"card":"F3304","idx":2,"playerID":"3","res":0});
        p3.moves.confirmRespond("yes");
        p3.moves.payAdditionalCost({"res":1,"deposit":0});
        p3.moves.chooseTarget({"target":"0","idx":0,"p":"3","targetName":"P1"});
        p3.moves.competitionCard({"pass":false,"card":"F2107","idx":0,"p":"3"});
        p0.moves.competitionCard({"pass":false,"card":"F3213","idx":5,"p":"0"});
        p3.moves.showCompetitionResult({"info":{"region":2,"atk":"3","atkPlayedCard":false,"atkCard":"F2107","def":"0","defPlayedCard":false,"defCard":"F3213","progress":0,"pending":true,"onWin":{"e":"shareEE","a":1,"r":2}}});

        p3.moves.playCard({"card":"P3402","idx":2,"playerID":"3","res":0});
        p3.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"3"});
        p3.moves.chooseTarget({"target":"0","idx":1,"p":"3","targetName":"P1"});
        p0.moves.chooseHand({"hand":"F3410","idx":3,"p":"0"});
        p0.moves.chooseHand({"hand":"F2304","idx":3,"p":"0"});

        p3.moves.playCard({"card":"B05","idx":2,"playerID":"3","res":0});
        p3.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"3"});

        p3.moves.playCard({"card":"F2213","idx":7,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":7,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":6,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":5,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":3,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":2,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B07","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"P2102","idx":0,"playerID":"3","res":0});
        p3.moves.chooseTarget({"target":"2","idx":3,"p":"3","targetName":"P3"});
        p2.moves.chooseHand({"hand":"V212","idx":0,"p":"2"});
        p3.moves.confirmRespond("no");

        p3.moves.playCard({"card":"F3112","idx":1,"playerID":"3","res":0});
        p3.moves.playCard({"card":"B04","idx":0,"playerID":"3","res":0});
        p3.moves.buyCard({"buyer":"3","target":"P3106","resource":16,"deposit":0,"helper":[]});
        p3.moves.buyCard({"buyer":"3","target":"F3210","resource":5,"deposit":4,"helper":[]});
        p3.moves.requestEndTurn("3");
        p0.moves.chooseEvent({"event":"E09","idx":0,"p":"0"});

        {
            p0.moves.playCard({"card":"F3305","idx":2,"playerID":"0","res":0});
            p0.moves.playCard({"card":"F2206","idx":2,"playerID":"0","res":0});
            p0.moves.comment({"target":"F3113","comment":"B04","p":"0"});

            p0.moves.playCard({"card":"F3209","idx":2,"playerID":"0","res":0});
            p0.moves.updateSlot({"slot":{"comment":"B04","region":0,"isLegend":false,"card":"F3113"},"p":"0","cardId":"F3113","updateHistoryIndex":8});

            p0.moves.playCard({"card":"F2405","idx":2,"playerID":"0","res":0});
            p0.moves.chooseEffect({"effect":{"e":"breakthroughResDeduct","a":2},"idx":1,"p":"0"});
            p0.moves.chooseHand({"hand":"B04","idx":2,"p":"0"});

            p0.moves.playCard({"card":"B03","idx":0,"playerID":"0","res":0});
            p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
            p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0});
            p0.moves.drawCard("0");
            p0.undo();
            p0.undo();
            p0.undo();
            p0.undo();
            p0.undo();
            p0.undo();
            p0.undo();
            p0.moves.drawCard("0");
            p0.moves.playCard({"card":"P3301","idx":5,"playerID":"0","res":0});
            p0.moves.chooseTarget({"target":"1","idx":0,"p":"0","targetName":"P2"});
            p0.moves.chooseTarget({"target":"3","idx":3,"p":"0","targetName":"P4"});
            p0.moves.chooseHand({"hand":"B04","idx":3,"p":"0"});
            p2.moves.chooseTarget({"target":"0","idx":0,"p":"2","targetName":"P1(*)"});
            p2.moves.chooseHand({"hand":"F2208","idx":0,"p":"2"});

            p0.moves.playCard({"card":"F2208","idx":7,"playerID":"0","res":0});
            p0.moves.playCard({"card":"P2302","idx":7,"playerID":"0","res":0});
            p0.moves.chooseTarget({"target":"3","idx":3,"p":"0","targetName":"P4"});
            p0.moves.chooseHand({"hand":"B07","idx":3,"p":"0"});
            p2.moves.chooseTarget({"target":"3","idx":3,"p":"2","targetName":"P4"});
            p2.moves.chooseHand({"hand":"B03","idx":5,"p":"2"});

            p0.moves.playCard({"card":"F3413","idx":4,"playerID":"0","res":0});
            p0.moves.comment({"target":"F3108","comment":"B04","p":"0"});

            p0.moves.playCard({"card":"F2405","idx":2,"playerID":"0","res":0});
            p0.moves.chooseEffect({"effect":{"e":"breakthroughResDeduct","a":2},"idx":1,"p":"0"});
            p0.moves.chooseHand({"hand":"B07","idx":1,"p":"0"});

            p0.moves.playCard({"card":"F3208","idx":3,"playerID":"0","res":0});
            p0.moves.playCard({"card":"F2408","idx":4,"playerID":"0","res":0});
            p0.moves.comment({"target":"F3103","comment":"B04","p":"0"});
            p0.moves.peek({"idx":0,"card":null,"p":"0","shownCards":["F3213","F3410"]});

            p0.moves.playCard({"card":"F3213","idx":4,"playerID":"0","res":0});
            p0.moves.playCard({"card":"F3211","idx":2,"playerID":"0","res":0});
            p0.moves.playCard({"card":"F3410","idx":3,"playerID":"0","res":0});
            p0.moves.buyCard({"buyer":"0","target":"P3403","resource":10,"deposit":0,"helper":[]});
            p0.moves.chooseEffect({"effect":{"e":"buy","a":"F3414","target":"0"},"idx":1,"p":"0"});
            //
            p0.moves.playCard({"card":"F2304","idx":3,"playerID":"0","res":0});
            p0.moves.playCard({"card":"V321","idx":3,"playerID":"0","res":0});
            p0.moves.playCard({"card":"P3403","idx":3,"playerID":"0","res":0});
            p0.moves.chooseTarget({"target":"3","idx":3,"p":"0","targetName":"P4"});

            p0.moves.playCard({"card":"F3414","idx":3,"playerID":"0","res":0});
            p0.moves.updateSlot({"slot":{"comment":"B04","region":0,"isLegend":false,"card":"F3108"},"p":"0","cardId":"F3108","updateHistoryIndex":9});

            p0.moves.playCard({"card":"B05","idx":1,"playerID":"0","res":0});
            p0.moves.chooseEffect({"effect":{"e":"aesAward","a":1},"idx":1,"p":"0"});

            p0.moves.playCard({"card":"B05","idx":1,"playerID":"0","res":0});
            p0.moves.chooseEffect({"effect":{"e":"aesAward","a":1},"idx":1,"p":"0"});

            p0.moves.requestEndTurn("0");

            p1.moves.playCard({"card":"F2410","idx":0,"playerID":"1","res":0});
            p1.moves.peek({"idx":0,"card":"F2307","p":"1","shownCards":["F2307","V332"]});

            p1.moves.playCard({"card":"F2207","idx":1,"playerID":"1","res":0});
            p1.undo();
            p1.moves.playCard({"card":"B03","idx":0,"playerID":"1","res":0});
            p1.moves.playCard({"card":"B03","idx":1,"playerID":"1","res":0});
            p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0});
            p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0});
            p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0});
            p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0});
            p1.moves.playCard({"card":"F2207","idx":0,"playerID":"1","res":0});
            p1.moves.chooseHand({"hand":"F2307","idx":1,"p":"1"});

            p1.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"1"});
            p1.moves.payAdditionalCost({"res":2,"deposit":0});

            p1.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"1"});
            p1.moves.payAdditionalCost({"res":2,"deposit":0});

            p1.moves.drawCard("1");
            p1.undo();
            p1.undo();
            p1.undo();
            p1.undo();
            p1.undo();
            p1.undo();
            p1.undo();
            p1.moves.drawCard("1");
            p1.moves.playCard({"card":"P2202","idx":3,"playerID":"1","res":0});
            p1.moves.chooseHand({"hand":"F2207","idx":0,"p":"1"});
            p1.moves.chooseEffect({"effect":{"e":"industryBreakthrough","a":1},"idx":0,"p":"1"});

            p1.moves.chooseEffect({"effect":{"e":"industryLevelUpCost","a":1},"idx":0,"p":"1"});
            p1.moves.payAdditionalCost({"res":2,"deposit":0});

            p1.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"1"});
            p1.moves.payAdditionalCost({"res":2,"deposit":0});
            p1.moves.chooseTarget({"target":"0","idx":3,"p":"1","targetName":"P1"});

            p1.moves.playCard({"card":"F2307","idx":1,"playerID":"1","res":0});
            p1.moves.comment({"target":"F3103","comment":null,"p":"1"});

            p1.moves.breakthrough({"card":"V221","idx":0,"playerID":"1","res":2});
            p1.moves.chooseEffect({"effect":{"e":"aestheticsLevelUpCost","a":1},"idx":0,"p":"1"});
            p1.moves.payAdditionalCost({"res":2,"deposit":0});

            p1.moves.requestEndTurn("1");

            p2.moves.playCard({"card":"F3310","idx":5,"playerID":"2","res":0});
            p2.moves.playCard({"card":"B07","idx":5,"playerID":"2","res":0});
            p2.moves.playCard({"card":"V132","idx":4,"playerID":"2","res":0});
            p2.moves.playCard({"card":"F2406","idx":2,"playerID":"2","res":0});
            p2.moves.peek({"idx":0,"card":null,"p":"2","shownCards":["B07","F3308","B07"]});

            p2.moves.playCard({"card":"B05","idx":2,"playerID":"2","res":0});
            p2.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"2"});

            p2.moves.playCard({"card":"P3102","idx":0,"playerID":"2","res":0});
            p2.moves.chooseRegion({"r":3,"idx":1,"p":"2"});
            p2.moves.chooseTarget({"target":"3","idx":1,"p":"2","targetName":"P4"});
            p2.moves.chooseRegion({"r":3,"idx":1,"p":"2"});
            p2.moves.confirmRespond("no");

            p2.moves.playCard({"card":"P1102","idx":2,"playerID":"2","res":0});
            p2.moves.chooseTarget({"target":"3","idx":1,"p":"2","targetName":"P4"});

            p2.moves.playCard({"card":"V241","idx":0,"playerID":"2","res":0});
            p2.moves.playCard({"card":"F3308","idx":0,"playerID":"2","res":0});
            p2.moves.updateSlot({"slot":{"comment":"B04","region":3,"isLegend":false,"card":"F3407"},"p":"2","cardId":"F3407","updateHistoryIndex":10});
            p2.moves.chooseTarget({"target":"3","idx":1,"p":"2","targetName":"P4"});
            p2.undo();
            p2.undo();
            p2.undo();
            p2.moves.drawCard("2");
            p2.moves.playCard({"card":"F2409","idx":1,"playerID":"2","res":0});
            p2.moves.updateSlot({"slot":{"comment":null,"region":0,"isLegend":false,"card":"F3113"},"p":"2","cardId":"F3113","updateHistoryIndex":10});

            p2.moves.buyCard({"buyer":"2","target":"F3407","resource":8,"deposit":0,"helper":[]});
            p2.undo();
            p2.undo();
            p2.undo();
            p2.undo();
            p2.undo();
            p2.undo();
            p2.undo();
            p2.undo();
            p2.undo();
            p2.moves.chooseRegion({"r":0,"idx":0,"p":"2"});
            p2.moves.confirmRespond("no");

            p2.moves.playCard({"card":"V241","idx":0,"playerID":"2","res":0});
            p2.moves.playCard({"card":"P1102","idx":1,"playerID":"2","res":0});
            p2.moves.chooseTarget({"target":"2","idx":0,"p":"2","targetName":"P3(*)"});

            p2.moves.drawCard("2");
            p2.moves.playCard({"card":"F2409","idx":1,"playerID":"2","res":0});
            p2.moves.updateSlot({"slot":{"comment":null,"region":0,"isLegend":false,"card":"F3113"},"p":"2","cardId":"F3113","updateHistoryIndex":10});

            p2.moves.buyCard({"buyer":"2","target":"F3407","resource":8,"deposit":0,"helper":[]});
            p2.moves.requestEndTurn("2");
            p2.moves.chooseEvent({"event":"E07","idx":0,"p":"2"});

        }
        console.log(p2.getState().G.events);

        // p3.moves.playCard({"card":"B05","idx":2,"playerID":"3","res":0});
        // p3.moves.chooseEffect({"effect":{"e":"draw","a":1},"idx":0,"p":"3"});
        //
        // p3.moves.playCard({"card":"F3104","idx":2,"playerID":"3","res":0});
        // p3.moves.confirmRespond("yes");
        // p3.moves.payAdditionalCost({"res":1,"deposit":0});
        // p3.moves.chooseTarget({"target":"2","idx":1,"p":"3","targetName":"P3"});
        // p3.moves.competitionCard({"pass":false,"card":"F2110","idx":8,"p":"3"});
        // p2.moves.competitionCard({"pass":false,"card":"F3311","idx":4,"p":"2"});
        // p3.moves.showCompetitionResult({"info":{"region":0,"atk":"3","atkPlayedCard":false,"atkCard":"F2110","def":"2","defPlayedCard":false,"defCard":"F3311","progress":-1,"pending":true,"onWin":{"e":"anyRegionShareCentral","a":1}}});
        //
        // p3.moves.playCard({"card":"F3405","idx":9,"playerID":"3","res":0});
        // p3.moves.chooseEffect({"effect":{"e":"step","a":[{"e":"res","a":2},{"e":"aesAward","a":1}]},"idx":0,"p":"3"});
        //
        // p3.moves.playCard({"card":"B07","idx":9,"playerID":"3","res":0});
        // p3.moves.playCard({"card":"F2113","idx":0,"playerID":"3","res":0});
        // p3.moves.playCard({"card":"V122","idx":0,"playerID":"3","res":0});
        // p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        // p3.moves.playCard({"card":"B03","idx":0,"playerID":"3","res":0});
        // p3.moves.playCard({"card":"B04","idx":1,"playerID":"3","res":0});
        // p3.moves.playCard({"card":"B03","idx":2,"playerID":"3","res":0});
        // p3.moves.playCard({"card":"V223","idx":2,"playerID":"3","res":0});
        // p3.moves.playCard({"card":"V333","idx":0,"playerID":"3","res":0});
        // p3.moves.playCard({"card":"B07","idx":0,"playerID":"3","res":0});
        // p3.moves.buyCard({"buyer":"3","target":"F3108","resource":11,"deposit":0,"helper":[]});
        // p3.moves.chooseRegion({"r":0,"idx":0,"p":"3"});
        //
        // p3.moves.buyCard({"buyer":"3","target":"F3103","resource":10,"deposit":8,"helper":[]});
        // p3.moves.requestEndTurn("3");
    }

    p0.stop()
    p1.stop()
    p2.stop()
    p3.stop()
})
