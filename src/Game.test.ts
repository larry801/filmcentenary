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
it('Edison Litigation 2 deposit', () => {
    const spec = {
        numPlayers: 4,
        game: gameWithSeed("kga78clv"),
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


    p0.stop();
    p1.stop();
    p2.stop();
    p3.stop();
})
