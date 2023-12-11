import React from "react";
import {SJEventCardID} from "../constant/general";
import {getCardLabel} from "../util";
import ChoiceDialog from "../../components/modals";

interface IShowCardsProps {
    cards: SJEventCardID[],
    title: string;
    toggleText: string;
}

export const ShowCards = ({cards, title, toggleText}: IShowCardsProps) => {
    return <ChoiceDialog
        callback={() => {
        }}
        choices={cards.map(c => {
            return {
                label: getCardLabel(c),
                value: c,
                disabled: true,
                hidden: false

            }
        })}
        toggleText={toggleText}
        title={title}
        defaultChoice={""} show={true} initial={false}/>
}