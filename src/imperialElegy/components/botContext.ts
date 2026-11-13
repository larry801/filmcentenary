/**
 * React context that carries the hotseat bot-seat set into every BoardClient
 * instance without circular imports between local.tsx and board.tsx.
 */
import React from "react";
import {Power} from "../types";

export const BotSeatsContext = React.createContext<ReadonlySet<Power>>(new Set<Power>());
