import { IAIConfig } from 'gamesShared/definitions/game';
import { MCTSBot } from 'boardgame.io/ai';
import { enumerateMoves } from './game/ai';
const config: IAIConfig = {
    bgioAI: () => {
        return {
          type: MCTSBot,
          ai: {
            enumerate: enumerateMoves
          },
        };
      
    },
  };
  export default config;
  