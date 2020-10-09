import {INVALID_MOVE} from 'boardgame.io/core';
import {Client} from 'boardgame.io/client';
import {Local} from 'boardgame.io/multiplayer'
import {FilmCentenaryGame} from './Game';

const gameWithSeed = (seed: string) => ({
    ...FilmCentenaryGame,
    seed
});

const seededGame = gameWithSeed("seed");

it('should declare player 1 as the winner', () => {
    const spec = {
        game: seededGame,
        multiplayer: Local(),
    };

    const p0 = Client({...spec, playerID: '0'} as any) as any;
    const p1 = Client({...spec, playerID: '1'} as any) as any;

    p0.start();
    p1.start();

    p0.stop();
    p1.stop();
})
