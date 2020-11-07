import { IGameConfig } from 'gamesShared/definitions/game';
import { FilmCentenaryGame } from './Game';
import {Board} from "./board";

const config: IGameConfig = {
  bgioGame: FilmCentenaryGame,
  bgioBoard: Board,
};

export default config;
