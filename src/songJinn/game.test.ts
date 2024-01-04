import {Client} from 'boardgame.io/client';
import {Local} from 'boardgame.io/multiplayer'
import {SongJinnGameDef} from './game';
import {Ctx} from "boardgame.io";
import {SongJinnGame} from "./constant/general";

const gameWithSeed = (seed: string) => ({
    ...SongJinnGameDef,
    seed
});

function cs(p0: any) {
    console.log(JSON.stringify(p0.getState().G.combat));
    console.log(JSON.stringify(p0.getState().G.player));
    console.log(JSON.stringify(p0.getState().ctx));
}

describe('diplomacy', () => {
    let p0: any;
    let p1: any;
    beforeEach(() => {
        const spec = {
            numPlayers: 2,
            game: gameWithSeed("l2fp6gsf"),
            multiplayer: Local(),
        };

        p0 = Client<SongJinnGame, Ctx>({...spec, playerID: '0'} as any) as any;
        p1 = Client<SongJinnGame, Ctx>({...spec, playerID: '1'} as any) as any;

        p0.start();
        p1.start();

        p0.moves.chooseFirst({choice: '0', matchID: 'test'});
        // const plan = p0.G.player['0'].plans[0];
        p0.moves.choosePlan("J03");
        p1.moves.choosePlan("J02")
        p0.moves.showPlan(["J03"]);
        p1.moves.showPlan(["J02"]);

        p0.moves.endRound();
        p1.moves.endRound();

        p0.moves.endRound();
        p1.moves.endRound();

        p0.moves.endRound();
        p1.moves.endRound();

        p0.moves.endRound();
        p1.moves.endRound();

        p0.moves.endRound();
        p1.moves.endRound();

        p0.moves.endRound();
        p1.moves.endRound();

        p0.moves.endRound();
        p1.moves.endRound();
    });
    afterEach(() => {
        p0.stop();
        p1.stop();
    });
    it('point', () => {
        p0.moves.letter({nation: "吐蕃", card: "S07"});
        p0.moves.endRound();
        p1.moves.letter({nation: "西辽", card: "J01"})
        p1.moves.endRound();

        p0.moves.takePlan(["J01"]);

        p0.moves.chooseTop("J01");
        p0.moves.endRound();
        p1.moves.takePlan(["J02"]);

        p1.moves.chooseTop("J02");
        p1.moves.endRound();
        console.log(JSON.stringify(p0.getState().G.song.nations));
        console.log(JSON.stringify(p0.getState().G.jinn.nations));
        console.log(JSON.stringify(p0.getState().ctx));
        expect(p0.getState().G.song.nations.includes("吐蕃"));
        expect(!p0.getState().G.song.nations.includes("西辽"));
    });
    it('no_letter', () => {
        p0.moves.endRound();
        p1.moves.endRound();
        p0.moves.takePlan(["J01"]);
        p0.moves.chooseTop("J01");
        p0.moves.endRound();
        p1.moves.takePlan(["J02"]);
        p1.moves.chooseTop("J02");
        p1.moves.endRound();
        console.log(JSON.stringify(p0.getState().G.song.nations));
        console.log(JSON.stringify(p0.getState().G.jinn.nations));
        console.log(JSON.stringify(p0.getState().ctx));
        expect(!p0.getState().G.song.nations.includes("吐蕃"));
        expect(!p0.getState().G.jinn.nations.includes("吐蕃"));
        expect(p0.getState().G.song.nations.includes("大理"));
        expect(p0.getState().G.song.nations.includes("西辽"));
        expect(p0.getState().G.song.nations.includes("西夏"));
        expect(p0.getState().G.song.nations.includes("高丽"));
    })

    it('march-tong-guan', () => {
        p0.moves.op("S11");
        p0.moves.march({"src": 35, "dst": "潼关", "units": [0, 1, 0, 0, 0, 0], "generals": [0], "country": "宋"});
        p0.moves.endRound();
        p1.moves.emptyRound();
        p1.moves.march({"src": 36, "dst": "潼关", "units": [2, 2, 1, 0, 0, 0, 0], "generals": [], "country": "金"});
        cs(p0);
        p0.moves.combatCard([]);
        p1.moves.combatCard([]);
        cs(p0);



        p0.moves.takeDamage({
            c: "宋",
            src: "潼关",
            ready: [0, 0, 0, 0, 0, 0],
            standby: [0, 0, 0, 0, 0, 0],
        });
        cs(p0);
        p1.moves.takeDamage({
            c: "金",
            src: "潼关",
            ready: [0, 0, 0, 0, 0, 0],
            standby: [0, 0, 0, 0, 0, 0],
        });
        cs(p0);
        p1.moves.takeDamage({
            c: "金",
            src: "潼关",
            ready: [0, 0, 0, 0, 0, 0],
            standby: [0, 0, 0, 0, 0, 0],
        });
        cs(p0);

    });
    it('march-hui-zhan', () => {
        p0.moves.op("S11");
        p0.moves.march({"src": 18, "dst": 42, "units": [2, 1, 0, 0, 0, 0], "generals": [0], "country": "宋"});
        p0.moves.march({"src": 42, "dst": 27, "units": [2, 1, 0, 0, 0, 0], "generals": [], "country": "宋"});
        p0.moves.endRound();
        p1.moves.op("J03");
        p1.moves.march({"src": 19, "dst": 42, "units": [1, 2, 1, 0, 1, 0, 0], "generals": [0], "country": "金"});
        p0.moves.confirmRespond({"choice": "no", "text": "选择不接野"});

        p1.moves.confirmRespond({"choice": "围困", "text": "围困"});
        p1.moves.march({"src": 36, "dst": 42, "units": [3, 4, 2, 0, 1, 0, 0], "generals": [0, 1], "country": "金"});
        cs(p0);
        p1.moves.confirmRespond({"choice": "攻城", "text": "攻城"});

        p0.moves.combatCard([]);
        p1.moves.combatCard([]);
        cs(p0);
        // song 0 dmg
        p1.moves.takeDamage({
            c: "金",
            src: 42,
            ready: [0, 0, 0, 0, 0, 0],
            standby: [0, 0, 0, 0, 0, 0],
        });
        cs(p0);

        p0.moves.takeDamage({
            c: "宋",
            src: "开封",
            ready: [0, 0, 0, 0, 0, 0],
            standby: [1, 0, 0, 0, 0, 0],
        });
        p1.moves.takeDamage({
            c: "金",
            src: 42,
            ready: [0, 0, 0, 0, 0, 0],
            standby: [0, 0, 0, 0, 0, 0],
        });
        cs(p0);
        expect(p0.getState().ctx.activePlayers['1'] === "confirmRespond");
    });
    it('hu-fu-archer', () => {
        console.log(p0.getState().G.player);
        p0.moves.op("S11");


        p0.moves.march({"src": 18, "dst": 42, "units": [2, 1, 0, 0, 0, 0], "generals": [0], "country": "宋"});
        cs(p0);
        cs(p1);
        // p0.moves.march({ "src": 42, "dst": 27, "units": [2, 1, 0, 0, 0, 0], "generals": [], "country": "宋" });
        p0.moves.endRound();
        p1.moves.op("J03");
        p1.moves.modifyGameState({
            "player": {
                "1": {
                    "hand": ["J32", "J34"]
                }
            }
        });
        cs(p1);
        p1.moves.march({"src": 19, "dst": 36, "units": [1, 2, 1, 0, 1, 0, 0], "generals": [0], "country": "金"});
        p1.moves.march({"src": 36, "dst": 42, "units": [3, 4, 2, 0, 1, 0, 0], "generals": [0, 1], "country": "金"});

        p0.moves.confirmRespond({"choice": "no", "text": "选择不接野"});
        p1.moves.confirmRespond({"choice": "攻城", "text": "攻城"});
        p0.moves.combatCard([]);
        p1.moves.combatCard(["J32", "J34"]);

        p0.moves.showCC([]);
        p1.moves.showCC(["J32", "J34"]);
        expect(p0.getState().ctx.activePlayers['1'] === "confirmRespond");

        p1.moves.confirmRespond({"choice": "archer", "text": "gong"});
        cs(p1);
        expect(p0.getState().ctx.activePlayers['0'] === "takeDamage");

    });
    it('hu-fu-infantry', () => {

    });

    it('march-zero', () => {
        p0.moves.op("S11");
        p0.moves.march({"src": 18, "dst": 42, "units": [2, 1, 0, 0, 0, 0], "generals": [0], "country": "宋"});
        p0.moves.march({"src": 42, "dst": 27, "units": [2, 1, 0, 0, 0, 0], "generals": [], "country": "宋"});
        p0.moves.endRound();
        p1.moves.op("J03");
        p1.moves.march({"src": 19, "dst": 36, "units": [1, 2, 1, 0, 1, 0, 0], "generals": [0], "country": "金"});
        p1.moves.march({"src": 36, "dst": 42, "units": [3, 4, 2, 0, 1, 0, 0], "generals": [0, 1], "country": "金"});

        p0.moves.confirmRespond({"choice": "no", "text": "选择不接野"});
        p1.moves.confirmRespond({"choice": "攻城", "text": "攻城"});
        p0.moves.combatCard([]);
        p1.moves.combatCard([]);

        cs(p0);
        // p1.moves.takeDamage({
        //     c: "金",
        //     src: 42,
        //     ready: [1, 0, 0, 0, 0, 0],
        //     standby: [0, 0, 0, 0, 0, 0],
        // });
        // cs(p0);
        p0.moves.takeDamage({
            c: "宋",
            src: 42,
            ready: [1, 1, 0, 0, 0, 0],
            standby: [1, 2, 0, 0, 0, 0],
        });
        cs(p0);
        // p1.moves.takeDamage({
        //     c: "金",
        //     src: 42,
        //     ready: [0, 0, 0, 0, 0, 0],
        //     standby: [0, 0, 0, 0, 0, 0],
        // });
        // cs(p0);
        expect(p0.getState().G.song.emperor === null);

    })
    it('march-twice-march', () => {
        p0.moves.op("S11");
        p0.moves.march({"src": 18, "dst": 42, "units": [2, 1, 0, 0, 0, 0], "generals": [0], "country": "宋"})
        p0.moves.march({"src": 42, "dst": 36, "units": [4, 3, 0, 0, 0, 0], "generals": [0], "country": "宋"})
        cs(p1);
        expect(p0.getState().ctx.activePlayers['1'] === 'confirmRespond');

    })
    it('jinn-remove-song', () => {
        p0.moves.endRound();
        p1.moves.removeUnit({"src": 42, "units": [0, 1, 0, 0, 0, 0, 0], "country": "宋"});
        p0.getState().G.song.troops.forEach((t: any, idx: number) => {
            expect(t.u.length <= 6);
            console.log(idx)
            console.log(JSON.stringify(t));
        });
        console.log(p0.getState().G.song.ready)
        console.log(p0.getState().G.song.standby)
        cs(p1);
        // expect(p0.getState().ctx.activePlayers['1'] === 'confirmRespond');


    })
    it('march-weiKunGon', () => {
        p0.moves.op("S11");
        p0.moves.march({"src": 18, "dst": 42, "units": [2, 2, 0, 0, 0, 0], "generals": [0], "country": "宋"});
        p0.moves.march({"src": 42, "dst": 27, "units": [2, 1, 0, 0, 0, 0], "generals": [], "country": "宋"});
        p0.moves.endRound();
        p1.moves.op("J03");
        p1.moves.march({"src": 19, "dst": 36, "units": [1, 2, 1, 0, 1, 0, 0], "generals": [0], "country": "金"});
        p1.moves.march({"src": 36, "dst": 42, "units": [3, 4, 2, 0, 1, 0, 0], "generals": [0, 1], "country": "金"});
        p0.moves.confirmRespond({"choice": "no", "text": "选择不接野"});

        p1.moves.confirmRespond({"choice": "围困", "text": "围困"});
        cs(p0);
        p1.moves.march({"src": 42, "dst": 1, "units": [3, 4, 2, 0, 1, 0, 0], "generals": [0, 1], "country": "金"});
        console.log(JSON.stringify(p0.getState().G.song.troops))
        expect(p0.getState().G.song.troops['0'].p === 42);

    });
    it('march-jiao-feng-dmg', () => {
        p0.moves.op("S11");
        p0.moves.march({"src": 18, "dst": 42, "units": [2, 2, 0, 0, 0, 0], "generals": [0], "country": "宋"});
        p0.moves.march({"src": 42, "dst": 27, "units": [2, 1, 0, 0, 0, 0], "generals": [], "country": "宋"});
        p0.moves.endRound();
        p1.moves.op("J03");
        p1.moves.march({"src": 19, "dst": 36, "units": [1, 2, 1, 0, 1, 0, 0], "generals": [0], "country": "金"});
        p1.moves.march({"src": 36, "dst": 42, "units": [3, 4, 2, 0, 1, 0, 0], "generals": [0, 1], "country": "金"});
        p0.moves.confirmRespond({"choice": "no", "text": "选择不接野"});

        p1.moves.confirmRespond({"choice": "攻城", "text": "攻城"});

        p0.moves.combatCard([]);
        p1.moves.combatCard([]);

        cs(p0);

        cs(p0);

        p0.moves.takeDamage({
            c: "宋",
            src: "开封",
            ready: [0, 0, 0, 0, 0, 0],
            standby: [0, 0, 0, 0, 0, 0],
        });
        cs(p0);
        p1.moves.takeDamage({
            c: "金",
            src: 42,
            ready: [0, 0, 0, 0, 0, 0],
            standby: [0, 0, 0, 0, 0, 0],
        });
        cs(p0);
        p0.moves.takeDamage({
            c: "宋",
            src: "开封",
            ready: [0, 0, 0, 0, 0, 0],
            standby: [0, 0, 0, 0, 0, 0],
        });
        cs(p0);
        p1.moves.takeDamage({
            c: "金",
            src: 42,
            ready: [0, 0, 0, 0, 0, 0],
            standby: [0, 0, 0, 0, 0, 0],
        });
        cs(p0);

        p1.moves.confirmRespond({"choice": "相持", "text": "相持"});
        p0.moves.confirmRespond({"choice": "撤退", "text": "撤退"});
        cs(p0)
        expect(p0.getState().ctx.activePlayers['0'] === "react");

    });
    it('yin-shu-ke-mid', () => {
        p0.moves.op("S11");

        p0.moves.modifyGameState({
            "player": {
                "1": {
                    "hand": ["J20"]
                }
            }
        });

        p0.moves.endRound();
        p1.moves.cardEvent("J20");
        p1.moves.deployGeneral({general:4,dst:17});
        p1.moves.op("J03");
        p1.moves.march({"src": 17, "dst": 24, "mid":20,"units": [1, 0, 0, 0, 0, 0, 0], "generals": [4], "country": "金"});
        cs(p1);
        console.log(p1.getState().G.jinn.troops);

    })
    it('yin-shu-ke-mid-no-city', () => {
        p0.moves.op("S11");
        p0.moves.modifyGameState({
            "player": {
                "1": {
                    "hand": ["J20"]
                }
            }
        });
        p0.moves.endRound();
        p1.moves.cardEvent("J20");
        p1.moves.op("J03");

        p1.moves.placeUnit({place:26,units:[0,1,0,0,0,0,0],"country": "金"});
        p1.moves.deployGeneral({general:4,dst:26});
        p1.moves.march({"src": 26, "dst": 40, "mid":44,"units": [0, 1, 0, 0, 0, 0, 0], "generals": [4], "country": "金"});
        cs(p1);
        console.log(JSON.stringify(p1.getState().G.jinn.troops));

    })
    it('zhu-dui-shi', () => {
        p0.moves.op("S11");
        p0.moves.march({"src": 18, "dst": 42, "units": [2, 1, 0, 0, 0, 0], "generals": [0], "country": "宋"})
        // p0.moves.march({"src": 42, "dst": 36, "units": [4, 3, 0, 0, 0, 0], "generals": [0], "country": "宋"})

        p0.moves.endRound();

        p1.moves.op("J03");
        p1.moves.march({"src": 19, "dst": 36, "units": [1, 2, 1, 0, 1, 0, 0], "generals": [0], "country": "金"});
        p1.moves.modifyGameState({"combat": {"song": {"combatCard": ["S37"]}}})
        p1.moves.march({"src": 36, "dst": 42, "units": [3, 4, 2, 0, 1, 0, 0], "generals": [0, 1], "country": "金"});

        p0.moves.confirmRespond({"choice": "no", "text": "选择不接野"});
        p1.moves.confirmRespond({"choice": "攻城", "text": "攻城"});
        p0.moves.combatCard([]);
        p1.moves.combatCard([]);

        cs(p0);
        expect(p0.getState().G.combat.phase === "驻队矢远程");

        p1.moves.takeDamage({
            c: "金",
            src: 42,
            ready: [0, 0, 0, 0, 0, 0],
            standby: [0, 0, 0, 0, 0, 0],
        });


        p0.moves.takeDamage({
            c: "宋",
            src: "开封",
            ready: [0, 0, 0, 0, 0, 0],
            standby: [0, 0, 0, 0, 0, 0],
        });

        expect(p0.getState().G.combat.phase === "驻队矢交锋");
        expect(p0.getState().ctx.activePlayers['1'] === 'takeDamage');

        p1.moves.takeDamage({
            c: "金",
            src: 42,
            ready: [0, 0, 0, 0, 0, 0],
            standby: [0, 0, 0, 0, 0, 0],
        });

        cs(p0);

        expect(p0.getState().G.combat.phase === "驻队矢交锋2");

        expect(p0.getState().ctx.activePlayers['0'] === 'takeDamage');

        p0.moves.takeDamage({
            c: "宋",
            src: "开封",
            ready: [0, 0, 0, 0, 0, 0],
            standby: [1, 0, 0, 0, 0, 0],
        });
        cs(p0);
        expect(p0.getState().ctx.activePlayers['1'] === 'takeDamage');

        p1.moves.takeDamage({
            c: "金",
            src: 42,
            ready: [0, 0, 0, 0, 0, 0],
            standby: [0, 0, 0, 0, 0, 0],
        });
        cs(p0);
        expect(p0.getState().ctx.activePlayers['1'] === 'confirmRespond');

    })
    it('no-search',()=>{
        p0.moves.endRound();
        p1.moves.endRound();
        cs(p0);
        p0.moves.endRound();
        p1.moves.endRound();
        cs(p0);

        p0.moves.endRound();
        p1.moves.endRound();
        cs(p0);

        p0.moves.endRound();
        p1.moves.endRound();
        cs(p0);
        p0.moves.endRound();
        p1.moves.endRound();
        cs(p0);
        p0.moves.endRound();
        p1.moves.endRound();
        cs(p0);
        expect(p0.getState().ctx.phase === 'chooseFirst')


    })
    it('place-city-combat',()=>{
        p0.moves.cardEvent("S13");
        p0.moves.placeUnit({"place":11,"units":[4,0,0,0,0,0],"country":"宋"});

        cs(p0);
    })
    it('place-combat',()=>{
        p0.moves.op("S11");
        p0.moves.march({"src": 18, "dst": 42, "units": [2, 2, 0, 0, 0, 0], "generals": [0], "country": "宋"});
        p0.moves.march({"src": 42, "dst": 27, "units": [2, 1, 0, 0, 0, 0], "generals": [], "country": "宋"});
        p0.moves.endRound();
        p1.moves.op("J03");
        p1.moves.march({"src": 19, "dst": 36, "units": [1, 2, 1, 0, 1, 0, 0], "generals": [0], "country": "金"});
        p1.moves.march({"src": 36, "dst": 42, "units": [3, 4, 2, 0, 1, 0, 0], "generals": [0, 1], "country": "金"});

        p0.moves.confirmRespond({"choice": "no", "text": "选择不接野"});
        p1.moves.confirmRespond({"choice": "围困", "text": "围困"});
        p1.moves.opponentMove();

        p0.moves.march({"src": 27, "dst": 42, "units": [1, 1, 0, 0, 0, 0], "generals": [], "country": "宋"});
        cs(p1);

        p0.moves.combatCard([]);
        p1.moves.combatCard([]);

        cs(p0);

        p0.moves.takeDamage({
            c: "宋",
            src: 42,
            ready: [0, 0, 0, 0, 0, 0],
            standby: [0, 0, 0, 0, 0, 0],
        });
        p1.moves.takeDamage({
            c: "金",
            src: 42,
            ready: [0, 0, 0, 0, 0, 0],
            standby: [0, 0, 0, 0, 0, 0],
        });

        p0.moves.takeDamage({
            c: "宋",
            src: 42,
            ready: [0, 0, 0, 0, 0, 0],
            standby: [0, 0, 0, 0, 0, 0],
        });
        cs(p0);
        p0.moves.confirmRespond({"choice":"相持","text":"相持"});
        p1.moves.confirmRespond({"choice":"相持","text":"相持"});
        cs(p0);
        console.log(p0.getState().G.song.troops)
        // p0.moves.confirmRespond({"choice": "no", "text": ""});
        // p1.moves.confirmRespond({"choice": "", "text": ""});
    })

    it('rescue',()=>{

    })
    it('rescue',()=>{

    })
});

describe('battle', () => {
    describe('hu-fu', ()=>{

    })
})