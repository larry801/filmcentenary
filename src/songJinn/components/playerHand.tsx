import React from "react";
import {BoardProps} from "boardgame.io/react";
import {SongJinnGame} from "../constant/setup";
import ErrorBoundary from "../../components/error";
import Grid from "@material-ui/core/Grid";
import ChoiceDialog from "../../components/modals";
import {Country, MountainPassID, OtherCountryID, RegionID, SJPlayer, UNIT_SHORTHAND, DevelopChoice, accumulator} from "../constant/general";
import {getPlanById} from "../constant/plan";
import {getStateById, playerById, getCountryById} from "../util/fetch";
import Button from "@material-ui/core/Button";
import {getCityById} from "../constant/city";
import {getRegionById} from "../constant/regions";
import Typography from "@material-ui/core/Typography";
import {getCardById} from "./constant/cards";
import Accordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';

export interface IPlayerHandProps {
    hand: CardID[],
    moves
}

export const playerHand = ({}) => {
    
}