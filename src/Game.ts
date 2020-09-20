import {Ctx, Game} from "boardgame.io";
import {IG, setup} from "./types/setup";
import {playCard} from "./game/moves";

export interface DemoState {
  numbers: [number, number];
  string?: string;
}

export const FilmCentenaryGame: Game<IG> = {
  setup:setup,

  phases:{

  },

  moves: {
    playCard:playCard,
  }
};
