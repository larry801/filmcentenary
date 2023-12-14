import {Client} from 'boardgame.io/client';
import {Local} from 'boardgame.io/multiplayer'
import {SongJinnGameDef} from './game';

const gameWithSeed = (seed: string) => ({
    ...SongJinnGameDef,
    seed
});

// @ts-ignore
it('should declare player 1 as the winner', () => {
    const spec = {
        numPlayers: 2,
        game: gameWithSeed("l2fp6gsf"),
        multiplayer: Local(),
    };

    const p0 = Client({...spec, playerID: '0'} as any) as any;
    const p1 = Client({...spec, playerID: '1'} as any) as any;

    p0.start();
    p1.start();

    p0.moves.chooseFirst('0');


})