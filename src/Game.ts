import {Game} from "boardgame.io";
import {IG, setup} from "./types/setup";
import {
  breakthrough,
  buyCard, chooseEffect, chooseEvent,
  chooseHand,
  chooseTarget, competitionCard,
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
    chooseEvent:chooseEvent,
    chooseEffect:chooseEffect,
    competitionCard:competitionCard,
    requestEndTurn:requestEndTurn,
  }
};
