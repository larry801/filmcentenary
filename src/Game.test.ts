import {Client} from 'boardgame.io/client';
import {Local} from 'boardgame.io/multiplayer'
import {FilmCentenaryGame} from './Game';

const gameWithSeed = (seed: string) => ({
    ...FilmCentenaryGame,
    seed
});

it('Man with a Movie Camera', () => {
    const spec = {
        numPlayers: 2,
        game: gameWithSeed("kg9au5vw"),
        multiplayer: Local(),
    };

    const p0 = Client({...spec, playerID: '0'} as any) as any;
    const p1 = Client({...spec, playerID: '1'} as any) as any;
    p0.start()
    p1.start()

    p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})
    p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})
    p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})
    p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})
    p0.moves.buyCard({"buyer":"0","target":"1211","resource":3,"deposit":0,"helper":[]})
    p0.moves.requestEndTurn("0");p0.events.endTurn()
    p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})
    p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})
    p1.moves.breakthrough({"card":"B02","idx":0,"playerID":"1","res":2})
    p1.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"1"})
    p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})
    p1.moves.requestEndTurn("1");p1.events.endTurn()
    p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0})
    p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0})
    p0.moves.buyCard({"buyer":"0","target":"1205","resource":2,"deposit":0,"helper":["B02"]})
    p0.moves.requestEndTurn("0");p0.events.endTurn()
    p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0})
    p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0})
    p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0})
    p1.moves.buyCard({"buyer":"1","target":"1108","resource":3,"deposit":0,"helper":["B01"]})
    p1.moves.requestEndTurn("1");p1.events.endTurn()
    p0.moves.playCard({"card":"1211","idx":1,"playerID":"0","res":0})
    p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0})
    p0.moves.playCard({"card":"1205","idx":1,"playerID":"0","res":0})
    p0.moves.buyCard({"buyer":"0","target":"1207","resource":4,"deposit":0,"helper":[]})
    p0.moves.requestEndTurn("0");p0.events.endTurn()
    p1.moves.playCard({"card":"B07","idx":3,"playerID":"1","res":0})
    p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0})
    p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})
    p1.moves.buyCard({"buyer":"1","target":"1306","resource":3,"deposit":0,"helper":[]})
    p1.moves.playCard({"card":"B01","idx":0,"playerID":"1","res":0})
    p1.moves.requestEndTurn("1");p1.events.endTurn()
    p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0})
    p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0})
    p0.moves.buyCard({"buyer":"0","target":"1107","resource":2,"deposit":0,"helper":["B01"]})
    p0.moves.requestEndTurn("0");p0.events.endTurn()
    p1.moves.playCard({"card":"B07","idx":3,"playerID":"1","res":0})
    p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0})
    p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})
    p1.moves.buyCard({"buyer":"1","target":"1303","resource":3,"deposit":0,"helper":["1108"]})
    p1.moves.requestEndTurn("1");p1.events.endTurn()
    p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0})
    p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0})
    p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0})
    p0.moves.buyCard({"buyer":"0","target":"1307","resource":3,"deposit":0,"helper":[]})
    p0.moves.requestEndTurn("0");p0.events.endTurn()
    p1.moves.drawCard("1")
    p1.moves.playCard({"card":"B07","idx":4,"playerID":"1","res":0})
    p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0})
    p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})
    p1.moves.buyCard({"buyer":"1","target":"1106","resource":3,"deposit":0,"helper":[]})
    p1.moves.playCard({"card":"B01","idx":0,"playerID":"1","res":0})
    p1.moves.requestEndTurn("1");p1.events.endTurn()
    p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0})
    p0.moves.playCard({"card":"1307","idx":1,"playerID":"0","res":0})
    p0.moves.playCard({"card":"1205","idx":1,"playerID":"0","res":0})
    p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0})
    p0.moves.buyCard({"buyer":"0","target":"1210","resource":3,"deposit":0,"helper":[]})
    p0.moves.requestEndTurn("0");p0.events.endTurn()
    p1.moves.playCard({"card":"1306","idx":2,"playerID":"1","res":0})
    p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0})
    p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0})
    p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0})
    p1.moves.playCard({"card":"1306","idx":2,"playerID":"1","res":0})
    p1.moves.drawCard("1")
    p1.moves.playCard({"card":"1306","idx":2,"playerID":"1","res":0})
    p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0})
    p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0})
    p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0})
    p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0})
    p1.moves.buyCard({"buyer":"1","target":"1102","resource":5,"deposit":0,"helper":["1108"]})
    p1.moves.requestEndTurn("1");p1.events.endTurn()
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
    p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})
    p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})
    p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})
    p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})
    p0.moves.buyCard({"buyer":"0","target":"1107","resource":4,"deposit":0,"helper":[]})
    p0.moves.requestEndTurn("0")
    p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})
    p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})
    p1.moves.breakthrough({"card":"B02","idx":1,"playerID":"1","res":2})
    p1.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"1"})
    p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})
    p0.moves.breakthrough({"card":"B02","idx":0,"playerID":"0","res":2})
    p0.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"0"})
    p0.moves.requestEndTurn("0")
    p0.events.endTurn()
    p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0})
    p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0})
    p1.moves.buyCard({"buyer":"1","target":"1108","resource":3,"deposit":0,"helper":["B01"]})
    p1.moves.requestEndTurn("1")
    p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0})
    p0.moves.playCard({"card":"1107","idx":1,"playerID":"0","res":0})
    p0.moves.buyCard({"buyer":"0","target":"1103","resource":4,"deposit":0,"helper":["B01"]})
    p0.moves.requestEndTurn("0")
    p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0})
    p1.moves.breakthrough({"card":"B01","idx":0,"playerID":"1","res":2})
    p1.moves.chooseEffect({"effect":{"e":"aestheticsLevelUp","a":1},"idx":0,"p":"1"})
    p1.moves.requestEndTurn("1")
    p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})
    p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})
    p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})
    p0.moves.buyCard({"buyer":"0","target":"B03","resource":2,"deposit":0,"helper":[]})
    p0.moves.requestEndTurn("0")
    p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0})
    p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0})
    p1.moves.buyCard({"buyer":"1","target":"1208","resource":3,"deposit":0,"helper":["1108"]})
    p1.moves.requestEndTurn("1")
    p0.moves.playCard({"card":"B07","idx":2,"playerID":"0","res":0})
    p0.moves.playCard({"card":"B07","idx":1,"playerID":"0","res":0})
    p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})
    p0.moves.buyCard({"buyer":"0","target":"1104","resource":5,"deposit":0,"helper":[]})
    p0.moves.requestEndTurn("0")
    p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})
    p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})
    p1.moves.playCard({"card":"B07","idx":0,"playerID":"1","res":0})
    p1.moves.playCard({"card":"B07","idx":3,"playerID":"1","res":0})
    p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0})
    p1.moves.playCard({"card":"B07","idx":1,"playerID":"1","res":0})
    p1.moves.buyCard({"buyer":"1","target":"1210","resource":3,"deposit":0,"helper":[]})
    p1.moves.playCard({"card":"1208","idx":0,"playerID":"1","res":0})
    p1.moves.requestEndTurn("1")
    p0.moves.playCard({"card":"1103","idx":1,"playerID":"0","res":0})
    p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})
    p0.moves.breakthrough({"card":"B01","idx":0,"playerID":"0","res":2})
    p0.moves.chooseEffect({"effect":{"e":"aestheticsLevelUp","a":1},"idx":0,"p":"0"})
    p1.moves.playCard({"card":"B07","idx":2,"playerID":"1","res":0})
    p1.moves.breakthrough({"card":"1108","idx":1,"playerID":"1","res":2})
    p1.moves.chooseEffect({"effect":{"e":"industryBreakthrough","a":1},"idx":0,"p":"1"})
    console.log(p0.store.getState().G)

    p0.stop()
    p1.stop()
})
it('Conform to rules', () => {
    const spec = {
        numPlayers: 4,
        game: gameWithSeed("kg3rpar0"),
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
    // p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})
    // p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})
    // p0.moves.breakthrough({"card":"B01","idx":1,"playerID":"0","res":2})
    // p0.moves.chooseEffect({"effect":{"e":"aestheticsLevelUp","a":1},"idx":0,"p":"0"})


    p0.moves.buyCard({"buyer":"0","target":"1102","resource":0,"deposit":9,"helper":[]})
    p0.moves.chooseEffect({"effect":{"e":"industryLevelUp","a":1},"idx":0,"p":"0"})
    p0.moves.buyCard({"buyer":"0","target":"1109","resource":0,"deposit":7,"helper":[]})
    p0.moves.buyCard({"buyer":"0","target":"1104","resource":0,"deposit":5,"helper":[]})
    p0.moves.buyCard({"buyer":"0","target":"1106","resource":0,"deposit":3,"helper":[]})
    p0.moves.requestEndTurn(0)
    p1.moves.buyCard({"buyer":"1","target":"1110","resource":0,"deposit":6,"helper":[]})
    p1.moves.buyCard({"buyer":"1","target":"1105","resource":0,"deposit":7,"helper":[]})
    p1.moves.requestEndTurn(1)
    p0.moves.chooseEvent({"event":"E02","idx":0,"p":"0"})
    expect(p0.store.getState().ctx.activePlayers).toEqual({"1": "chooseHand"});
    p1.moves.chooseHand({hand:"B07",idx:0,p:"1"})
    expect(p0.store.getState().ctx.activePlayers).toEqual({"2": "chooseHand"});
    console.log(JSON.stringify(p0.store.getState().G))
    p2.moves.chooseHand({hand:"B07",idx:0,p:"2"})
    p3.moves.chooseHand({hand:"B07",idx:0,p:"3"})
    p0.moves.chooseHand({hand:"B07",idx:0,p:"0"})
    expect(p0.store.getState().ctx.activePlayers).toEqual({"0": "confirmRespond"});
    p0.moves.confirmRespond("yes");
    expect(p0.store.getState().G.pub[0].vp).toEqual(2);

    p0.stop();
    p1.stop();
    p2.stop();
    p3.stop();
})
