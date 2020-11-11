import { IAIConfig } from 'gamesShared/definitions/game';
import { MCTSBot } from 'boardgame.io/ai';
import { enumerateMoves, objectives } from './game/ai';

class DynamicMCTSBot extends MCTSBot{

    constructor({
                    enumerate,
                    seed,
                    game,
                }: {
        enumerate: any;
        seed?: string | number;
        game: any;
    }){
        super({
            enumerate, seed,
            objectives,
            game,
            playoutDepth:100,
            iterations:50
        });
    }

}

const config: IAIConfig = {
    bgioAI: () => {
        return {
            type: DynamicMCTSBot,
            ai: {
                enumerate: enumerateMoves
            },
        };

    },
};
export default config;
