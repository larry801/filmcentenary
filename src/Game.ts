import { Game } from "boardgame.io";

export interface DemoState {
  numbers: [number, number];
  string?: string;
}

export const DemoGame: Game<DemoState> = {
  setup: (ctx) => ({
    numbers: [ctx.random!.D6(), ctx.random!.D6()]
  }),

  moves: {
    addString: (G, ctx, string: string) => {
      G.string = string;
    },

    deleteString: (G) => {
      delete G.string;
    },

    getNewNumbers: (G, ctx) => {
      G.numbers = [ctx.random!.D6(), ctx.random!.D6()];
    }
  }
};
