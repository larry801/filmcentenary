import { IGameConfig } from 'gamesShared/definitions/game';
import { FilmCentenaryGame } from './Game';
import { FilmCentenaryBoard } from './components/board';

const config: IGameConfig = {
  bgioGame: FilmCentenaryGame,
  bgioBoard: FilmCentenaryBoard,
};

export default config;
