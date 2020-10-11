import {Client} from 'boardgame.io/client';
import {Local} from 'boardgame.io/multiplayer'
import {FilmCentenaryGame} from './Game';

const gameWithSeed = (seed: string) => ({
    ...FilmCentenaryGame,
    seed
});

it('should declare player 1 as the winner', () => {
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
    p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})
    p0.moves.playCard({"card":"B07","idx":0,"playerID":"0","res":0})
    p0.moves.breakthrough({"card":"B01","idx":1,"playerID":"0","res":2})
    p0.moves.chooseEffect({"effect":{"e":"aestheticsLevelUp","a":1},"idx":0,"p":"0"})
    p0.stop();
    p1.stop();
    p2.stop();
    p3.stop();
})
