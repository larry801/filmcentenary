import {Game} from "boardgame.io";
import {IG, setup} from "./types/setup";
import {
  breakthrough,
  buyCard, chooseEffect,
  chooseHand,
  chooseTarget,
  drawCard,
  initialSetup,
  moveBlocker,
  playCard, requestEndTurn
} from "./game/moves";
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
    moveBlocker: moveBlocker,
    chooseTarget:chooseTarget,
    chooseHand:chooseHand,
    chooseEffect:chooseEffect,
    requestEndTurn:requestEndTurn,
  }
};
