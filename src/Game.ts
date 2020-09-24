import {Game} from "boardgame.io";
import {IG, setup} from "./types/setup";
import {breakthrough, buyCard, drawCard, initialSetup, playCard} from "./game/moves";
import {InitPhase, NormalPhase} from "./game/config";

export const FilmCentenaryGame: Game<IG> = {
  setup:setup,

  phases:{
    InitPhase:InitPhase,
    NormalPhase:NormalPhase,
  },

  moves: {
    initialSetup:initialSetup,
    drawCard: drawCard,
    buyCard: buyCard,
    playCard: playCard,
    breakthrough:breakthrough,
  }
};
