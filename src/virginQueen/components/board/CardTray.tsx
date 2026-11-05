import React from "react";
import i18n from "../../constant/i18n";
import {cardById} from "../../constant/cards";
import {CardArt} from "../board";

interface CardTrayProps {
    hand: string[];
    me?: string;
    ps?: any;
    canAct?: boolean;
    moves: any;
    isDesktop: boolean;
    handExpanded: boolean;
    setHandExpanded: (expanded: boolean) => void;
    setSelectedCard: (card?: string) => void;
    setEventTarget: (t: string) => void;
    setHolyLeagueEventTarget: (t: string) => void;
    setMenendezEventTarget: (t: string) => void;
    setPolishElectionBids: (b: any) => void;
    setStaffordSelection: (s: any) => void;
    panelID: string;
}

export const CardTray: React.FC<CardTrayProps> = (props) => {
    const {hand, me, ps, canAct, moves, isDesktop, handExpanded, setHandExpanded, 
           setSelectedCard, setEventTarget, setHolyLeagueEventTarget, 
           setMenendezEventTarget, setPolishElectionBids, setStaffordSelection, panelID} = props;
    i18n.use();
    
    return (
        <section className="vq-panel vq-hand">
            <div className="vq-panel-heading">
                <h2>{i18n.chain.vq.cardTray.hand} <span style={{fontWeight: 400}}>· {hand.length} {i18n.chain.vq.cardTray.cards}</span></h2>
                <Stack direction="row" spacing={0.5}>
                    {ps?.treasures.map((treasure: number, index: number) => 
                        <Button key={index} size="small" variant="outlined"
                            disabled={!canAct || !ps.cardPlayed || ps.treasurePlayed} 
                            onClick={() => moves.playTreasure({index})}>{i18n.chain.vq.cardTray.treasure} {treasure} {i18n.chain.vq.cardTray.cp}</Button>
                    )}
                    {isDesktop && <Button size="small" aria-expanded={handExpanded} aria-controls={`${panelID}-cards`}
                        onClick={() => setHandExpanded(!handExpanded)}>{handExpanded ? i18n.chain.vq.cardTray.collapse : i18n.chain.vq.cardTray.expand}</Button>}
                </Stack>
            </div>
            <div id={`${panelID}-cards`} hidden={isDesktop && !handExpanded}>
                {hand.length === 0 && <Typography variant="body2" color="text.secondary">{me ? i18n.chain.vq.cardTray.noCards : i18n.chain.vq.cardTray.spectator}</Typography>}
                <div className="vq-card-tray">
                    {hand.map((id: string) => {
                        const card = cardById(id);
                        return <button key={id} className="vq-card" aria-label={`${i18n.chain.vq.cardTray.viewCard} ${card.name} · ${card.cp} CP`} 
                            onClick={() => {
                                setSelectedCard(id); 
                                setEventTarget(""); 
                                setHolyLeagueEventTarget(""); 
                                setMenendezEventTarget(""); 
                                setPolishElectionBids({}); 
                                setStaffordSelection({power: ""});
                            }}>
                            <CardArt def={card} className="vq-card-art" lazy/>
                            <small>{card.kind === "home" ? i18n.chain.vq.cardTray.homeCard : card.kind === "event" ? i18n.chain.vq.cardTray.eventCard : i18n.chain.vq.cardTray.actionCard}<span className="vq-card-cp">{card.cp} CP</span></small>
                            <strong>{card.name}</strong><small>{i18n.chain.vq.cardTray.viewDetails} ↗</small>
                        </button>;
                    })}
                </div>
            </div>
        </section>
    );
};

// Need imports
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
