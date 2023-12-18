import {Client} from 'boardgame.io/client';
import {Local} from 'boardgame.io/multiplayer'
import {SongJinnGameDef} from './game';
import {SongJinnGame} from "./constant/general";
import {Ctx} from "boardgame.io";

const gameWithSeed = (seed: string) => ({
    ...SongJinnGameDef,
    seed
});

function combatState(p0: any) {
    console.log(JSON.stringify(p0.getState().G.combat));
    console.log(JSON.stringify(p0.getState().ctx));
}

// @ts-ignore
it('should declare player 1 as the winner', () => {
    const spec = {
        numPlayers: 2,
        game: gameWithSeed("l2fp6gsf"),
        multiplayer: Local(),
    };

    const p0 = Client<SongJinnGame, Ctx>({...spec, playerID: '0'} as any) as any;
    const p1 = Client<SongJinnGame, Ctx>({...spec, playerID: '1'} as any) as any;

    p0.start();
    p1.start();

    p0.moves.chooseFirst({choice: '0', matchID: 'test'});
    // const plan = p0.G.player['0'].plans[0];
    p0.moves.choosePlan("J01");
    p1.moves.choosePlan("J02")
    p0.moves.showPlan(["J01"]);
    p1.moves.showPlan(["J02"]);
    console.log(JSON.stringify(p0.getState().G.player));
    p0.moves.op("S11");
    p0.moves.march({"src": 18, "dst": 42, "units": [2, 1, 0, 0, 0, 0], "generals": [0], "country": "宋"});
    p0.moves.march({"src": 42, "dst": 27, "units": [2, 1, 0, 0, 0, 0], "generals": [], "country": "宋"});
    p0.moves.endRound();
    p1.moves.op("J16");
    p1.moves.march({"src": 19, "dst": 36, "units": [1, 2, 1, 0, 1, 0, 0], "generals": [0], "country": "金"});
    p1.moves.march({"src": 36, "dst": 42, "units": [3, 4, 2, 0, 1, 0, 0], "generals": [0, 1], "country": "金"});
    p0.moves.confirmRespond({"choice": false, "text": "选择不接野"});
    p1.moves.confirmRespond({"choice": false, "text": ""});
    p0.moves.combatCard([]);
    p1.moves.combatCard([]);

    combatState(p0);

    p1.moves.takeDamage({
        src: 42,
        idx: 0,
        p: 42,
        ready: [0, 0, 0, 0, 0, 0],
        standby: [0, 0, 0, 0, 0, 0],
    });
    p0.moves.takeDamage({
        src: 42,
        idx: 0,
        p: 42,
        ready: [0, 0, 0, 0, 0, 0],
        standby: [0, 0, 0, 0, 0, 0],
    });

    combatState(p0);
    p1.moves.takeDamage({
        src: 42,
        idx: 0,
        p: 42,
        ready: [0, 0, 0, 0, 0, 0],
        standby: [0, 0, 0, 0, 0, 0],
    });

    p0.moves.takeDamage({
        src: 42,
        idx: 0,
        p: 42,
        ready: [0, 0, 0, 0, 0, 0],
        standby: [0, 0, 0, 0, 0, 0],
    });

    combatState(p0);
    p1.moves.confirmRespond({"choice": false, "text": ""});
    p0.moves.confirmRespond({"choice": false, "text": ""});
    combatState(p0);


    p0.stop();
    p1.stop();

});

