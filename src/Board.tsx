import React from "react";
import { BoardProps } from "boardgame.io/react";
import { DemoState } from "./Game";

export const DemoBoard = ({ G, moves }: BoardProps<DemoState>) => (
  <main>
    <h1>boardgame.io Typescript Demo</h1>

    <button onClick={() => moves.getNewNumbers()}>Get New Numbers</button>

    <pre>G: {JSON.stringify(G, null, 2)}</pre>
  </main>
);
